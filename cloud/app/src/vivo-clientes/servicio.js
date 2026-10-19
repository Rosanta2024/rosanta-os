/**
 * Clientes EN VIVO: el pipeline de eventos (19-oct-2026, rama claude/nube-clientes-vivo).
 *
 * UN SOLO ESCRITOR. Hoy escriben en Marketing OS › cotizaciones y revisiones:
 *   (1) la pantalla Eventos de la intranet (guardarEventos → evEscribir_), dueño y sala;
 *   (2) la revision diaria de la Mac (cot.sh → ?hook=cotizaciones → cotHook_ de Marketing OS).
 *   (El bot NO escribe ahi: manda el correo "Lead para atender" y la revision diaria crea la fila.)
 * Con el interruptor motor_eventos = base, los dos entran por ESTE servidor:
 *   (1) la pantalla Eventos del servidor nuevo (mismo codigo: EventosDatos.js real);
 *   (2) /hooks/cotizaciones, con el MISMO contrato que cotHook_ (list, get, batch, revision, revisiones),
 *       que corre el Cotizaciones.js real de Marketing OS. cot.sh solo cambia de direccion.
 * La base manda; cada guardado se copia a la hoja (copia de lectura con las mismas columnas) para la
 * consola, el CRM y el informe del mes, que la siguen leyendo. Con sheets, el servidor no guarda nada
 * (409) e importa la hoja a la base cada 15 min: asi la base esta al dia el dia que se enciende, y
 * volver atras es poner el interruptor en sheets (lo que se guardo en la base ya esta en la hoja).
 *
 * Reglas: un guardado por vez (cola); la version de cada fila la controla el codigo real
 * (if_version: todo o nada); nunca se borra una fila; un cambio en la hoja de una fila escrita por el
 * servidor es un CONFLICTO (no se pisa, se avisa) salvo que la hoja mande (interruptor en sheets).
 */
const C = require('../copia-hojas');
const { crearMotor } = require('../motor-pagos');
const IMP = require('../importar-pagos');
const EH = require('../escribir-hoja');
const P = require('../permisos');

const PESTANAS = { cotizaciones: 'id', revisiones: 'fecha' };
const LISTAS = ['LISTA-VIVO-CLIENTES.txt'];
const LECTURA = ['getEventos', 'getInformeEventos'];
const ESCRITURA = ['guardarEventos'];

/** El interruptor motor_eventos de una pestaña PARAMETROS (matriz como getValues): 'base' o 'sheets'. */
function interruptor(matriz, clave) {
  const f = (matriz || []).find((r) => String(r[0] || '').trim().toLowerCase() === (clave || 'motor_eventos'));
  return f && String(f[1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets';
}

/** Una pestaña armada desde filas_clientes (encabezado + filas en su orden). */
async function matrizDesdeBase(q, pestana, encabezado) {
  const r = await q.query('SELECT celdas FROM filas_clientes WHERE pestana = $1 ORDER BY orden NULLS LAST, actualizado, llave', [pestana]);
  return [encabezado.slice()].concat(C.decodificar(r.rows.map((x) => x.celdas)));
}

/** El encabezado de una pestaña: el de la hoja (si ya se importo) o el del codigo. */
function encabezadoDe(ctx, pestana) {
  return pestana === 'cotizaciones' ? ctx.EV_COLS.slice() : ctx.EV_REV_COLS.slice();
}

/**
 * opciones: { mktId, sheets() → cliente de Sheets, leerInterruptor() → 'base'|'sheets', permisos,
 *   leerHoja(pestanas) y copiar(pestana, filas, opts): por defecto, la API de Sheets (las pruebas pasan una hoja en memoria) }.
 */
function crearServicioVivo(pool, opciones) {
  const o = opciones || {};
  const mktId = o.mktId;
  if (!mktId) throw new Error('Falta el id de la hoja del pipeline.');
  let M = o.permisos || null, modo = 'sheets', encabezados = {}, ultimaImportacion = null;
  const leerHoja = o.leerHoja || ((pestanas) => C.leerLibro(o.sheets(), mktId, pestanas));
  const copiar = o.copiar || ((pestana, filas, op) => EH.copiarFilas(o.sheets(), mktId, filas, op));

  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };
  let colaCopia = Promise.resolve();
  const enColaCopia = (fn) => { const p = colaCopia.then(fn, fn); colaCopia = p.catch(() => {}); return p; };

  /** Un motor con el codigo real, sobre lo que hay en la base (q: pool o cliente de una transaccion). */
  async function motorDesdeBase(q) {
    const sonda = crearMotor({ libros: {}, configId: 'x', listas: LISTAS });
    const libro = {};
    for (const p of Object.keys(PESTANAS)) libro[p] = await matrizDesdeBase(q, p, encabezados[p] || encabezadoDe(sonda.ctx, p));
    const m = crearMotor({ libros: { [mktId]: libro }, configId: 'x', editables: { [mktId]: Object.keys(PESTANAS) }, listas: LISTAS });
    m.ctx.MKT_SHEET_ID = mktId;   // EventosDatos.js
    m.ctx.SHEET_ID = mktId;       // Cotizaciones.js de Marketing OS
    return { m, libro };
  }

  async function cargar() {
    if (!o.permisos) M = await P.cargarDeBase(pool);
    modo = o.leerInterruptor ? await o.leerInterruptor() : 'sheets';
  }

  /**
   * Corre una funcion del codigo real que ESCRIBE, dentro de una transaccion: lo que toco en las
   * pestañas se guarda en la base (origen servidor, sin copiar todavia) y despues se copia a la hoja.
   */
  function escribir(usuario, correr) {
    return enCola(async () => {
      if (modo !== 'base') { const e = new Error('El pipeline todavía se guarda en la intranet (interruptor motor_eventos en sheets).'); e.status = 409; throw e; }
      const c = await pool.connect();
      let tocadas = [];
      let resultado;
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(4242012)');   // un guardado de Clientes por vez, tambien entre instancias
        const { m, libro } = await motorDesdeBase(c);
        const r = correr(m);
        resultado = r.resultado;
        for (const k of Object.keys(r.escrituras || {})) {
          const pestana = k.split('|')[1];
          const H = libro[pestana][0].map(String), iL = H.indexOf(PESTANAS[pestana]);
          for (const fila of r.escrituras[k]) {
            const valores = libro[pestana][fila - 1];
            const llave = IMP.llave(valores[iL]);
            if (!llave) throw new Error('Una fila guardada en ' + pestana + ' quedo sin ' + PESTANAS[pestana] + '.');
            await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja)
              VALUES ($1,$2,$3,'servidor',$4,now(),NULL)
              ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL`,
            [pestana, llave, JSON.stringify(C.codificar([valores])[0]), fila - 1]);
            tocadas.push({ pestana, llave });
          }
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      if (tocadas.length) enColaCopia(() => copiarPendientes()).catch((e) => console.error('Copia a la hoja:', e.message));
      return { resultado, tocadas };
    });
  }

  /** Copia a la hoja las filas guardadas en el servidor que todavia no estan alla. */
  async function copiarPendientes() {
    if (!o.sheets && !o.copiar) return { copiadas: 0 };
    let copiadas = 0;
    for (const p of Object.keys(PESTANAS)) {
      const r = await pool.query('SELECT llave, celdas, actualizado FROM filas_clientes WHERE pestana = $1 AND copiado_a_hoja IS NULL ORDER BY orden NULLS LAST, llave', [p]);
      if (!r.rows.length) continue;
      await copiar(p, r.rows.map((x) => ({ id: x.llave, fila: C.decodificar([x.celdas])[0] })),
        { pestana: p, llave: PESTANAS[p], encabezado: encabezados[p] });
      for (const x of r.rows) {
        await pool.query('UPDATE filas_clientes SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado = $3', [p, x.llave, x.actualizado]);
      }
      copiadas += r.rows.length;
    }
    return { copiadas };
  }

  /**
   * Trae la hoja a la base (cada 15 min). Con sheets la hoja manda (se acepta cualquier cambio);
   * con base, un cambio en la hoja de una fila del servidor es conflicto y no se pisa.
   */
  function importar() {
    return enCola(async () => {
      if (!o.sheets && !o.leerHoja) throw new Error('Sin cliente de Sheets.');
      if (o.leerInterruptor) modo = await o.leerInterruptor();   // el interruptor se relee en cada importacion
      // primero se copia lo pendiente: si no, una fila recien guardada en la base y todavia vieja en la
      // hoja pareceria un conflicto
      if (modo === 'base') await copiarPendientes();
      const leido = await leerHoja(Object.keys(PESTANAS));
      const out = [];
      for (const p of Object.keys(PESTANAS)) {
        const matriz = leido[p] || [];
        if (matriz[0]) encabezados[p] = matriz[0].map(String);
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await c.query('SELECT llave AS id, celdas, origen, orden FROM filas_clientes WHERE pestana = $1 FOR UPDATE', [p]);
          const plan = IMP.planificar(matriz.length ? matriz : [[PESTANAS[p]]], r.rows, { llave: PESTANAS[p], hojaManda: modo !== 'base' });
          for (const x of plan.reordenar) await c.query('UPDATE filas_clientes SET orden = $3 WHERE pestana = $1 AND llave = $2', [p, x.id, x.orden]);
          for (const x of plan.actualizadas) {
            await c.query(`UPDATE filas_clientes SET celdas = $3, orden = $4, origen = 'hoja', actualizado = now(), copiado_a_hoja = now()
              WHERE pestana = $1 AND llave = $2`, [p, x.id, JSON.stringify(x.celdas), x.orden]);
          }
          for (const x of plan.nuevas) {
            await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, orden, origen, copiado_a_hoja) VALUES ($1,$2,$3,$4,'hoja',now())`,
              [p, x.id, JSON.stringify(x.celdas), x.orden]);
          }
          await c.query('INSERT INTO filas_clientes_importaciones (pestana, filas_hoja, nuevas, actualizadas, problemas) VALUES ($1,$2,$3,$4,$5)',
            [p, plan.filas_hoja, plan.nuevas.length, plan.actualizadas.length, JSON.stringify(plan.problemas)]);
          await c.query('COMMIT');
          out.push({ pestana: p, filas_hoja: plan.filas_hoja, nuevas: plan.nuevas.length, actualizadas: plan.actualizadas.length, problemas: plan.problemas });
        } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      }
      ultimaImportacion = new Date();
      return out;
    });
  }

  /** La pantalla: dueño y sala segun la matriz; el codigo real vuelve a revisar (puedeEventos_, sala solo lo suyo). */
  async function llamar(usuario, nombre, args) {
    if (!M) { const e = new Error('Cargando permisos.'); e.status = 503; throw e; }
    const accion = ESCRITURA.includes(nombre) ? 'ingresar' : 'ver';
    if (!LECTURA.includes(nombre) && !ESCRITURA.includes(nombre)) { const e = new Error('Esa funcion no esta disponible.'); e.status = 404; throw e; }
    const v = P.puede(M, usuario, 'eventos', accion);
    if (!v.ok) { const e = new Error(v.motivo); e.status = 403; throw e; }
    const t0 = Date.now();
    if (ESCRITURA.includes(nombre)) {
      const r = await escribir(usuario, (m) => m.correr(usuario, nombre, args || []));
      return { resultado: r.resultado, ms: Date.now() - t0 };
    }
    const { m } = await motorDesdeBase(pool);
    return { resultado: m.correr(usuario, nombre, args || []).resultado, ms: Date.now() - t0 };
  }

  /** El hook de la revision diaria: MISMO contrato que cotHook_ (el token lo revisa la app antes). */
  async function hook(body) {
    const a = body && body.accion;
    const leer = async (fn) => { const { m } = await motorDesdeBase(pool); return fn(m.ctx); };
    if (a === 'list') return { ok: true, filas: await leer((x) => x.cotLeer_()) };
    if (a === 'get') {
      const f = (await leer((x) => x.cotLeer_())).filter((d) => d.id === body.id)[0];
      return f ? { ok: true, fila: f } : { ok: false, error: 'no existe', id: body.id };
    }
    if (a === 'revisiones') return { ok: true, revisiones: await leer((x) => x.cotRevisiones_()) };
    const SISTEMA = { email: 'revision-diaria@servidor', rol: 'dueno', modulos: [], nombre: 'Revisión diaria' };
    if (a === 'batch' || a === 'revision') {
      const fn = a === 'batch' ? (x) => x.cotEscribir_(body.writes) : (x) => x.cotGuardarRevision_(body.revision || {});
      // Cotizaciones.js no recibe token: se envuelve para correrlo con el motor (que anota sus escrituras)
      const r = await escribir(SISTEMA, (m) => { m.ctx.__cotHook = () => fn(m.ctx); return m.correr(SISTEMA, '__cotHook', []); });
      return r.resultado;
    }
    return { ok: false, error: 'acción desconocida' };
  }

  return {
    cargar, importar, copiarPendientes, llamar, hook,
    modo: () => modo,
    puede: (u, parte, accion) => !!(M && P.puede(M, u, parte, accion || 'ver').ok),
    estado: () => ({ modo, ultima_importacion: ultimaImportacion, permisos: !!M })
  };
}

module.exports = { crearServicioVivo, interruptor, matrizDesdeBase, PESTANAS, LECTURA, ESCRITURA };
