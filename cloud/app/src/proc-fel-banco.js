/**
 * PROCESOS: LOS CORREOS DEL FEL Y DEL BANCO EN LA NUBE (20-oct-2026, servicio de procesos).
 *
 * En Apps Script el vigia lee cada hora (y al abrir Pagos) los avisos de SAT (FelCorreo.js → pestaña FEL_CORREO
 * de Config) y los del BI (BancoCorreo.js → BANCO_CORREO). Los dos usan el servicio avanzado Gmail SOLO PARA
 * LEER (Users.Messages.list con includeSpamTrash y Users.Messages.get; el aviso viene en el HTML del correo, sin
 * adjuntos) y NO marcan, etiquetan ni borran nada en Gmail. Aca corre ese MISMO codigo (fecLeer_ / bcoLeer_) en
 * el motor, con el Gmail de mentira que contesta desde una precarga (google-cuenta.js): nada de HTTP sincronico.
 *
 * Interruptores en PARAMETROS de Config (la copia que tiene el servicio): proc_fel y proc_banco.
 *   apps (o vacio)  → la intranet lee; aca no se hace nada (200 {modo:'apps'}).
 *   sombra          → se lee y se COMPARA con la hoja, sin guardar nada en ningun lado. Dos corridas del codigo
 *                     real: (1) sobre la hoja tal cual: lo que agregaria ahora = nuevas_que_faltan_en_hoja;
 *                     (2) sobre la hoja vacia: como armaria cada fila, comparada columna por columna (menos LEIDO,
 *                     que es la hora de lectura) con la fila que la hoja ya tiene para ese MENSAJE_ID. 409 si
 *                     alguna difiere o si hubo errores leyendo (un error tambien es "no se puede confiar").
 *   nube            → la base manda: filas_vivas (migracion 008 suma estas dos pestañas), llave MENSAJE_ID (el id
 *                     del mensaje de Gmail: el mismo que la intranet usa para no leer dos veces). Primero se importa
 *                     a la base lo que la hoja tiene (misma regla que Caja), se corre la lectura sobre la base, las
 *                     filas nuevas se guardan (origen 'servidor', ON CONFLICT no duplica) y se copian a la hoja con
 *                     copiarFilas (si falla la copia, se reintenta en la proxima corrida). La intranet tiene que
 *                     dejar de leer con nube (pendiente en FelCorreo.js/BancoCorreo.js), si no escriben los dos.
 *
 * AMBITO: este archivo no toca app.js ni server.js; se monta con montarProcesos(app, deps).
 */
const crypto = require('crypto');
const C = require('./copia-hojas');
const { crearMotor } = require('./motor-pagos');
const { precargaGmail, shimGmail } = require('./google-cuenta');
const IMP = require('./importar-pagos');
const EH = require('./escribir-hoja');

const LLAVE = 'MENSAJE_ID';
const PROCESOS = {
  fel: { interruptor: 'proc_fel', pestana: 'FEL_CORREO', columnas: 'FEC_COLS_', leer: 'fecLeer_',
    q: (ctx) => ctx.FEC_QUERY_ + ' newer_than:' + ctx.FEC_DIAS_ + 'd' },
  banco: { interruptor: 'proc_banco', pestana: 'BANCO_CORREO', columnas: 'BCO_COLS_', leer: 'bcoLeer_',
    q: (ctx) => ctx.BCO_QUERY_ + ' newer_than:' + ctx.BCO_DIAS_ + 'd' }
};
const MODOS = ['apps', 'sombra', 'nube'];

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

/** proc_fel / proc_banco de PARAMETROS: 'apps' (por defecto), 'sombra' o 'nube'. */
function modoProceso(libros, clave) {
  const p = libros && libros[C.LIBROS.config.id] && libros[C.LIBROS.config.id].PARAMETROS;
  const f = (p || []).find((r) => String(r[0] || '').trim().toLowerCase() === clave);
  const v = f ? String(f[1] || '').trim().toLowerCase() : '';
  return MODOS.indexOf(v) !== -1 ? v : 'apps';
}

/**
 * Un motor con el codigo real (LISTA.txt trae FelCorreo.js y BancoCorreo.js) sobre una sola pestaña editable en
 * memoria, con Gmail y lo minimo de Utilities que usa _fecCuerpo_ (base64Decode, newBlob().getDataAsString).
 */
function motorDe(proc) {
  const cfg = C.LIBROS.config.id;
  const libros = { [cfg]: { [proc.pestana]: [] } };
  const m = crearMotor({ libros, configId: cfg, editables: { [cfg]: [proc.pestana] }, listas: ['LISTA.txt'] });
  const U = m.ctx.Utilities;
  U.base64Decode = (t) => Buffer.from(String(t), 'base64');
  U.newBlob = (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8'), getBytes: () => Buffer.from(bytes) });
  // correr() pasa el token como primer argumento: fecLeer_/bcoLeer_ lo tomarian como "dias"
  m.ctx.__procLeer = () => m.ctx[proc.leer]();
  return {
    ctx: m.ctx,
    columnas: () => (m.ctx[proc.columnas] || []).slice(),
    query: () => proc.q(m.ctx),
    /** Corre la lectura real sobre `matriz` (se copia). Devuelve { rep, nuevas: [filas agregadas] }. */
    leer(matriz, gmail) {
      const R = matriz.map((f) => f.slice());
      if (!R.length) R.push(this.columnas());
      libros[cfg][proc.pestana] = R;
      const n0 = R.length;
      m.ctx.Gmail = gmail;
      try {
        const r = m.correr(null, '__procLeer', []);
        const otras = Object.keys(r.escrituras).filter((k) => k !== cfg + '|' + proc.pestana);
        if (otras.length) throw new Error('La lectura quiso escribir fuera de ' + proc.pestana + ' (' + otras.join(', ') + ').');
        if (r.escrituras[cfg + '|' + proc.pestana] && r.escrituras[cfg + '|' + proc.pestana].some((n) => n <= n0)) {
          throw new Error('La lectura quiso reescribir filas que ya estaban en ' + proc.pestana + '.');
        }
        return { rep: r.resultado || {}, nuevas: libros[cfg][proc.pestana].slice(n0) };
      } finally { m.ctx.Gmail = undefined; }
    }
  };
}

/** Un valor para comparar hoja contra nube: fechas como texto, numeros con tolerancia de centavos. */
function norm(x) {
  if (x instanceof Date) {
    const s = C.codificar([[x]])[0][0].$d;
    return /T00:00:00$/.test(s) ? s.slice(0, 10) : s;
  }
  if (x === null || x === undefined) return '';
  return String(x).trim();
}
function igual(a, b) {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const nx = Number(x), ny = Number(y);
  return x !== '' && y !== '' && isFinite(nx) && isFinite(ny) && Math.abs(nx - ny) < 0.005;
}

/**
 * La comparacion de la sombra (pura). hoja: la pestaña como esta (encabezado + filas). columnas: las del codigo
 * (FEC_COLS_/BCO_COLS_, el orden en que escribe). filasNube: lo que armo la corrida sobre la hoja vacia.
 */
function compararConHoja(hoja, columnas, filasNube) {
  const H = ((hoja && hoja[0]) || []).map((h) => String(h || '').trim());
  const iH = H.indexOf(LLAVE), iN = columnas.indexOf(LLAVE);
  const enHoja = new Map();
  for (let r = 1; r < (hoja || []).length; r++) { const id = norm(hoja[r][iH]); if (id && !enHoja.has(id)) enHoja.set(id, hoja[r]); }
  const distintas = [];
  filasNube.forEach((f) => {
    const id = norm(f[iN]), h = enHoja.get(id);
    if (!h) return;
    const cols = [];
    columnas.forEach((c, j) => {
      if (c === 'LEIDO') return;   // la hora en que se leyo: distinta por construccion
      const k = H.indexOf(c);
      const vh = k < 0 ? '' : h[k];
      if (!igual(vh, f[j])) cols.push({ columna: c, hoja: norm(vh), nube: norm(f[j]) });
    });
    if (cols.length) distintas.push({ mensaje_id: id, columnas: cols });
  });
  return distintas;
}

/** filas → [{mensaje_id, fila (como objeto columna: valor)}] para la respuesta. */
function resumirFilas(columnas, filas) {
  const iN = columnas.indexOf(LLAVE);
  return filas.map((f) => { const o = {}; columnas.forEach((c, j) => { o[c] = norm(f[j]); }); return { mensaje_id: norm(f[iN]), fila: o }; });
}

function crearProcesos(deps) {
  const pool = deps.pool;
  const cargarCopia = deps.cargarCopia || (() => C.cargarCopia(pool));
  const colas = {};
  const enCola = (k, fn) => { const p = (colas[k] || Promise.resolve()).then(fn, fn); colas[k] = p.catch(() => {}); return p; };
  const cfgId = C.LIBROS.config.id;

  /** La cuenta de Google y la precarga: cualquier falla de permiso sale como 503 con el motivo. */
  async function precargar(motor) {
    let cuenta;
    try { cuenta = deps.cuentaGoogle ? deps.cuentaGoogle() : null; } catch (e) { throw error(String(e.message || e), 503); }
    if (!cuenta) throw error('Falta el permiso de Google (GMAIL_OAUTH): el servidor no puede leer el correo.', 503);
    try {
      // como la intranet: includeSpamTrash, 100 por pagina, hasta 5 paginas; sin adjuntos (el aviso viene en el cuerpo)
      return await precargaGmail(cuenta, motor.query(), { max: 100, paginas: 5, incluirPapelera: true, quiereAdjunto: () => false });
    } catch (e) { throw error('No se pudo leer Gmail: ' + String(e.message || e), 503); }
  }

  async function anotar(proceso, modo, ok, resumen) {
    try { await pool.query('INSERT INTO procesos_corridas (proceso, modo, ok, resumen) VALUES ($1,$2,$3,$4)', [proceso, modo, ok, JSON.stringify(resumen)]); }
    catch (e) { /* sin la migracion 008 todavia: la corrida igual responde */ }
  }

  async function sombra(proc, motor, hoja) {
    const pre = await precargar(motor);
    const G = shimGmail(pre);
    const a = motor.leer(hoja, G);                       // lo que la intranet agregaria ahora
    const b = motor.leer([motor.columnas()], G);          // como arma cada fila, para compararla
    const distintas = compararConHoja(hoja, motor.columnas(), b.nuevas);
    const errores = (a.rep.errores || []).concat((b.rep.errores || []).filter((x) => (a.rep.errores || []).indexOf(x) === -1));
    return { status: distintas.length || errores.length ? 409 : 200, cuerpo: {
      modo: 'sombra', leidos: a.rep.correos || 0, nuevas_que_faltan_en_hoja: a.nuevas.length, distintas: distintas.length, errores,
      detalle: { faltan: resumirFilas(motor.columnas(), a.nuevas).slice(0, 100), distintas: distintas.slice(0, 100) } } };
  }

  async function nube(proc, motor, hoja) {
    const P = proc.pestana;
    const enc = (hoja && hoja[0] && hoja[0].length) ? hoja[0].map((h) => String(h || '').trim()) : motor.columnas();
    // 1. lo que la hoja ya tiene entra a la base (la historia, y lo que la intranet haya leido antes del cambio)
    const importacion = hoja && hoja.length > 1 ? await IMP.importarFilas(pool, P, hoja, { llave: LLAVE }) : null;
    // 2. la lectura real sobre la base
    const pre = await precargar(motor);
    const matriz = await IMP.matrizDesdeFilas(pool, P, enc);
    const r = motor.leer(matriz, shimGmail(pre));
    // 3. guardar (una transaccion; un MENSAJE_ID que ya esta no se toca)
    const iN = motor.columnas().indexOf(LLAVE);
    let guardadas = 0;
    if (r.nuevas.length) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        for (const f of r.nuevas) {
          const id = IMP.llave(f[iN]);
          if (!id) throw new Error('La lectura armo una fila sin ' + LLAVE + '.');
          const x = await c.query(`INSERT INTO filas_vivas (pestana, llave, celdas, orden, origen) VALUES ($1,$2,$3,
              (SELECT coalesce(max(orden), 0) + 1 FROM filas_vivas WHERE pestana = $1), 'servidor')
            ON CONFLICT (pestana, llave) DO NOTHING RETURNING llave`, [P, id, JSON.stringify(C.codificar([f])[0])]);
          guardadas += x.rows.length;
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    }
    // 4. copiar a la hoja lo pendiente (lo de hoy y lo que haya fallado antes)
    const copia_hoja = await copiarPendientes(P, enc).catch((e) => ({ error: String(e.message || e) }));
    const problemas = (importacion && importacion.problemas) || [];
    const errores = r.rep.errores || [];
    const mal = problemas.length || errores.length || (copia_hoja && copia_hoja.error);
    return { status: mal ? 409 : 200, cuerpo: { modo: 'nube', leidos: r.rep.correos || 0, nuevas: guardadas, repetidos: r.rep.repetidos || 0,
      otros: r.rep.otros || 0, errores, importacion, copia_hoja } };
  }

  async function copiarPendientes(P, enc) {
    const f = await pool.query(`SELECT llave, celdas, actualizado::text AS actualizado FROM filas_vivas
      WHERE pestana = $1 AND origen = 'servidor' AND (copiado_a_hoja IS NULL OR actualizado > copiado_a_hoja) ORDER BY orden NULLS LAST, actualizado`, [P]);
    if (!f.rows.length) return { nuevas: 0, actualizadas: 0, pendientes: 0 };
    if (!deps.sheetsEscritura) return { nuevas: 0, actualizadas: 0, pendientes: f.rows.length, aviso: 'Sin permiso de escribir en Sheets: queda en la base.' };
    const h = await EH.copiarFilas(deps.sheetsEscritura(), cfgId, f.rows.map((x) => ({ id: x.llave, fila: C.decodificar([x.celdas])[0] })),
      { pestana: P, llave: LLAVE, encabezado: enc });
    for (const x of f.rows) await pool.query('UPDATE filas_vivas SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado = $3::timestamptz', [P, x.llave, x.actualizado]);
    return { nuevas: h.nuevas, actualizadas: h.actualizadas, pendientes: f.rows.length };
  }

  /** Corre un proceso ('fel' | 'banco') segun su interruptor. Devuelve { status, cuerpo }. */
  async function correr(nombre) {
    const proc = PROCESOS[nombre];
    if (!proc) throw error('No hay proceso ' + nombre + '.', 404);
    return enCola(nombre, async () => {
      const copia = await cargarCopia();
      const modo = modoProceso(copia.libros, proc.interruptor);
      if (modo === 'apps') return { status: 200, cuerpo: { modo: 'apps' } };
      const t0 = Date.now();
      const hoja = ((copia.libros[cfgId] || {})[proc.pestana] || []).map((f) => f.slice());
      const motor = motorDe(proc);
      const r = modo === 'sombra' ? await sombra(proc, motor, hoja) : await nube(proc, motor, hoja);
      r.cuerpo.ms = Date.now() - t0;
      r.cuerpo.ok = r.status === 200;
      await anotar(nombre, modo, r.status === 200, Object.assign({}, r.cuerpo, { detalle: undefined }));
      return r;
    });
  }

  return { correr };
}

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/**
 * Monta POST /tareas/procesos/fel y /tareas/procesos/banco (cabecera x-rosanta-tarea = clave de tareas).
 * deps: { pool, claveTareas, cuentaGoogle: () => cuenta de google-cuenta.js, sheetsEscritura?: () => Sheets, cargarCopia? }
 */
function montarProcesos(app, deps) {
  const P = crearProcesos(deps);
  app.post('/tareas/procesos/:nombre(fel|banco)', async (req, res, next) => {
    if (!iguales(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    try {
      const r = await P.correr(req.params.nombre);
      res.status(r.status).json(r.cuerpo);
    } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
  });
  return P;
}

module.exports = { montarProcesos, crearProcesos, modoProceso, compararConHoja, PROCESOS, LLAVE };
