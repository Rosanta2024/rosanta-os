/**
 * PROCESOS EN LA NUBE: "LEER CIERRES" Y LA FOTO DEL COMPROBANTE (20-oct-2026, servicio de procesos).
 *
 * Corre el CODIGO REAL de la intranet (CierresDiarios.js › _cieLeer_, ComprasEfectivo.js › leerComprobanteCompra)
 * dentro del motor (motor-pagos.js), con Gmail, Drive y Claude imitados desde una PRECARGA: el codigo de la intranet es
 * sincronico y aca nunca se hace HTTP sincronico. Todo lo de afuera (correos, texto de los PDF, la respuesta de Claude,
 * la foto en Drive) se trae ANTES con async y despues se corre el codigo de siempre contestando desde lo traido.
 *
 * INTERRUPTOR PARAMETROS › proc_cierres (se lee de la copia de Config que ya tiene el servicio de pagos):
 *   apps (o vacio) → no hace nada: los cierres los sigue leyendo la intranet (vigia y boton "Leer cierres").
 *   sombra         → lee los correos de PosFile, corre _cieLeer_ real, ANOTA lo que habria guardado y lo COMPARA con
 *                    CIERRES_DIARIOS de la base (filas_vivas). 409 si algo no coincide. No escribe nada.
 *   nube           → lo mismo, pero guarda cada fila con pagos.guardarCierre (upsert por FECHA + copia a la hoja).
 *                    Solo vale con motor_cierres = base (y MODO_PAGOS=vivo): si no, 409.
 *
 * DOS PASADAS (para no convertir PDF de mas): la primera corre _cieLeer_ con el texto de los PDF "sin precargar" y anota
 * que adjuntos pide (los correos ya guardados que cuadran se saltan solos, con la regla de la intranet); se convierten
 * solo esos con cuenta.pdfATexto y la segunda pasada corre de verdad. La foto del comprobante usa el mismo truco: la
 * primera pasada anota las fotos y el pedido EXACTO que la intranet le haria a Claude; se hacen con async; la segunda
 * pasada contesta desde ahi.
 *
 * COMENSALES_RESERVA: la intranet los saca de Marketing OS › reservas (_cieComensalesReserva_). Aca corre esa MISMA
 * funcion sobre la copia de reservas que guarda la sombra 2 (hojas_copia_f2). Si no hay copia (o la funcion no puede),
 * se deja el valor que ya tiene la base para ese dia (o vacio si es un dia nuevo). La respuesta dice que fuente uso.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./copia-hojas');
const IMP = require('./importar-pagos');
const F2 = require('./sombra2/servicio-f2');
const { crearMotor, formatDate } = require('./motor-pagos');
const { precargaGmail, shimGmail } = require('./google-cuenta');
const { fechasMalas } = require('./servicio-pagos');

const PESTANA = 'CIERRES_DIARIOS';
// Lo que no se compara en sombra: la hora de lectura y el texto de diagnostico (Drive lo saca distinto cada vez).
const NO_COMPARAR = ['LEIDO', 'TEXTO_SI_NO_CUADRA'];
const SIN_PRECARGA = 'NUBE_SIN_PRECARGA';

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

/** Un interruptor de procesos en la copia de Config: apps | sombra | nube (cualquier otra cosa = apps). */
function interruptorProc(libros, clave) {
  const p = libros && libros[C.LIBROS.config.id] && libros[C.LIBROS.config.id].PARAMETROS;
  const f = (p || []).find((r) => String(r[0] || '').trim().toLowerCase() === clave);
  const v = f ? String(f[1] || '').trim().toLowerCase() : '';
  return v === 'sombra' || v === 'nube' ? v : 'apps';
}

/** Como la clave de tareas de app.js (exigirTarea): comparacion de tiempo constante. */
function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

const huella = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');

/** Lo que Apps Script da y el motor no trae: los blobs y base64Decode (como en ensayo-puente.js). */
function prepararUtilities(ctx) {
  ctx.Utilities.base64Decode = (s) => Array.from(Buffer.from(String(s), 'base64'));
  ctx.Utilities.newBlob = (bytes, mime, nombre) => ({ bytes, mime, nombre, getBytes: () => bytes, getName: () => nombre });
}

/** Una pestaña reordenada a las columnas de la intranet (el codigo de los cierres lee por posicion). */
function aColumnas(M, cols) {
  if (!M || !M.length) return [cols.slice()];
  const H = M[0].map((h) => String(h || '').trim());
  return [cols.slice()].concat(M.slice(1).map((f) => cols.map((c) => { const i = H.indexOf(c); return i < 0 || f[i] === undefined ? '' : f[i]; })));
}

/** La fila como la manda nubeGuardarCierre_ (NubePagos.js): las fechas como {$d: 'AAAA-MM-DDTHH:MM:SS'} de Guatemala. */
function codificarComoIntranet(fila) {
  return fila.map((x) => (x instanceof Date ? { $d: formatDate(x, 'America/Guatemala', "yyyy-MM-dd'T'HH:mm:ss") } : x));
}

/** Para comparar: fechas como texto, vacio = '' y los numeros con 0.005 de tolerancia. */
function normal(col, v) {
  if (v instanceof Date) v = C.codificar([[v]])[0][0].$d;
  else if (v && typeof v === 'object' && typeof v.$d === 'string') v = v.$d;
  if (v === null || v === undefined) return '';
  if (col === 'FECHA') return String(v).slice(0, 10);
  if (typeof v === 'string') { const t = v.trim(); return t !== '' && !isNaN(Number(t)) && /^-?[\d.]+$/.test(t) ? Number(t) : t; }
  return v;
}
function igualCelda(col, a, b) {
  const x = normal(col, a), y = normal(col, b);
  if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) < 0.005;
  return x === y;
}

/** Compara lo que habria guardado (una fila por fecha, la ultima gana) con la base. */
function comparar(cols, filasNube, basePorFecha, encBase) {
  const iguales_ = [], distintos = [];
  for (const [fecha, fila] of filasNube) {
    const b = basePorFecha.get(fecha);
    if (!b) { distintos.push({ fecha, motivo: 'no está en la base (CIERRES_DIARIOS)' }); continue; }
    const columnas = [];
    cols.forEach((c, i) => {
      if (NO_COMPARAR.indexOf(c) !== -1) return;
      const j = encBase.indexOf(c);
      const vb = j < 0 ? '' : b[j];
      if (!igualCelda(c, fila[i], vb)) columnas.push({ columna: c, base: normal(c, vb), nube: normal(c, fila[i]) });
    });
    if (columnas.length) distintos.push({ fecha, columnas }); else iguales_.push(fecha);
  }
  return { iguales: iguales_, distintos };
}

/** Las filas de CIERRES_DIARIOS en la base (filas_vivas), con el encabezado de la hoja. */
async function cierresDeBase(pool, enc) {
  const M = await IMP.matrizDesdeFilas(pool, PESTANA, enc);
  const iF = enc.indexOf('FECHA'), porFecha = new Map();
  M.slice(1).forEach((f) => { const k = IMP.llave(f[iF]); if (k) porFecha.set(k, f); });
  return { M, porFecha };
}

/** La copia de Marketing OS › reservas que guarda la sombra 2 (o null si no hay). */
async function reservasCopia(pool, mktId) {
  try {
    const r = await pool.query("SELECT filas, leida FROM hojas_copia_f2 WHERE libro = $1 AND pestana = 'reservas'", [mktId]);
    if (!r.rows.length || !Array.isArray(r.rows[0].filas) || !r.rows[0].filas.length) return null;
    return { matriz: C.decodificar(r.rows[0].filas), leida: r.rows[0].leida };
  } catch (e) { return null; }
}

/**
 * Corre "Leer cierres" en la nube. o: { pool, pagos, cuenta, modo: 'sombra'|'nube', dias, forzar }.
 * Devuelve { status, cuerpo }.
 */
async function leerCierres(o) {
  const t0 = Date.now();
  const copia = o.pagos.copia();
  if (!copia || !copia.libros || !copia.libros[C.LIBROS.config.id]) throw error('El servidor todavía no tiene la copia de Config.', 503);
  const cfgId = C.LIBROS.config.id;

  // el motor: solo Config (PARAMETROS y CIERRES_DIARIOS) y, si hay, la copia de reservas. Nada compartido con Pagos.
  // (el motor lee `libros` al abrir cada hoja, asi que se llena despues de crearlo: hace falta CIE_COLS_ de la intranet)
  const libros = {};
  const M2 = crearMotor({ libros, configId: cfgId, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  const ctx = M2.ctx, cols = ctx.CIE_COLS_.slice();
  prepararUtilities(ctx);
  // _cieComensalesReserva_ usa mktSheet_ (MarketingDatos.js, de la lista de Clientes): solo ese archivo, tal cual
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'intranet', 'MarketingDatos.js'), 'utf8'), ctx, { filename: 'intranet/MarketingDatos.js' });
  const encHoja = ((copia.libros[cfgId][PESTANA] || [])[0] || []).map((h) => String(h || '').trim());
  const encBase = encHoja.length ? encHoja : cols.slice();
  const base = await cierresDeBase(o.pool, encBase);
  const reservas = await reservasCopia(o.pool, ctx.MKT_SHEET_ID);   // Marketing OS, el id de la intranet
  // en sombra se parte de la pestaña VACIA, asi se relee todo lo de los ultimos dias y se compara entero; en nube, de lo
  // que ya tiene la base, para que la regla de la intranet salte lo ya guardado (y lo que no cuadra lo relea).
  const hojaCierres = o.modo === 'sombra' ? [cols.slice()] : aColumnas(base.M, cols);
  libros[cfgId] = { PARAMETROS: structuredClone(copia.libros[cfgId].PARAMETROS || [['parametro', 'valor']]), [PESTANA]: hojaCierres };
  if (reservas) libros[ctx.MKT_SHEET_ID] = { reservas: reservas.matriz };

  // Gmail: la misma busqueda que _cieLeer_ (CIE_QUERY_ + newer_than), precargada
  const dias = Math.min(Math.max(Number(o.dias) || 20, 1), 60);
  const q = ctx.CIE_QUERY_ + ' newer_than:' + dias + 'd';
  let pre;
  try {
    pre = await precargaGmail(o.cuenta, q, { max: 60, quiereAdjunto: (p) => !!(p.filename && /\.pdf$/i.test(p.filename)) });
  } catch (e) {
    throw error('Gmail no dejó leer los correos de PosFile: ' + String(e.message || e) +
      '. Revisá el permiso de restaurante@rosanta.rest (secreto gmail-restaurante-oauth; volver a autorizar con cloud/herramientas/autorizar-google.js).', 502);
  }
  ctx.Gmail = shimGmail(pre);

  // el texto de cada PDF: desde la precarga (por la huella de sus bytes); en la primera pasada se anota que se pide
  const textos = new Map(), pedidos = new Map();
  ctx._ciePdfTexto_ = (blob) => {
    const h = huella(blob.bytes);
    if (textos.has(h)) return textos.get(h);
    pedidos.set(h, blob);
    throw new Error(SIN_PRECARGA);
  };
  // comensales: la funcion real sobre la copia de reservas; si no puede, lo que ya tiene la base
  const iCom = encBase.indexOf('COMENSALES_RESERVA');
  const comReal = ctx._cieComensalesReserva_;
  const fuenteCom = reservas ? 'copia de Marketing OS › reservas (hojas_copia_f2, leída ' + new Date(reservas.leida).toISOString() + ')' : 'la base (no hay copia de reservas)';
  ctx._cieComensalesReserva_ = (fecha) => {
    const n = reservas ? comReal(fecha) : null;
    if (n !== null && n !== undefined) return n;
    const b = base.porFecha.get(fecha);
    return b && iCom >= 0 && b[iCom] !== '' ? b[iCom] : null;
  };
  // en vez de mandarlo al servidor por HTTP (nubeGuardarCierre_), se anota; nube lo guarda despues con guardarCierre
  let anotadas = [];
  ctx.cierresMotor_ = () => 'base';
  ctx.nubeGuardarCierre_ = (fila) => { anotadas.push(fila.slice()); return { ok: true }; };

  // primera pasada: que PDF hay que convertir
  ctx._cieLeer_(dias, !!o.forzar);
  for (const [h, blob] of pedidos) {
    try { textos.set(h, await o.cuenta.pdfATexto(Buffer.from(blob.bytes), blob.nombre || 'tmp_cierre_posfile')); } catch (e) {
      throw error('Drive no convirtió el PDF del cierre (' + (blob.nombre || '') + '): ' + String(e.message || e), 502);
    }
  }
  // segunda pasada, la de verdad
  anotadas = [];
  const rep = ctx._cieLeer_(dias, !!o.forzar);
  const errores = (rep.errores || []).slice();

  // una fila por fecha: si un dia llega dos veces, gana la ultima (como en la hoja)
  const iF = cols.indexOf('FECHA'), porFecha = new Map();
  anotadas.forEach((f) => porFecha.set(String(f[iF]).slice(0, 10), f));
  const lectura = { correos: rep.correos, nuevos: rep.nuevos, repetidos: rep.repetidos };

  if (o.modo === 'sombra') {
    const c = comparar(cols, porFecha, base.porFecha, encBase);
    const ok = !c.distintos.length && !errores.length;
    return { status: ok ? 200 : 409, cuerpo: { ok, modo: 'sombra', leidos: porFecha.size, iguales: c.iguales.length, fechas_iguales: c.iguales,
      distintos: c.distintos, errores, lectura, comensales: fuenteCom, ms: Date.now() - t0 } };
  }

  // nube: cada fila (en el orden en que se leyo) con guardarCierre, que hace upsert por FECHA y copia a la hoja
  const guardados = [];
  for (const f of anotadas) {
    const cod = codificarComoIntranet(f);
    const malas = fechasMalas(cod);   // la misma revision que guardarCierre (antes entraba "2026-10-18'T'19:14:09")
    if (malas.length) { errores.push(String(f[iF]) + ': fecha que no se entiende ' + JSON.stringify(malas[0])); continue; }
    try { guardados.push(await o.pagos.guardarCierre(cod)); } catch (e) { errores.push(String(f[iF]) + ': no se guardó (' + String(e.message || e) + ')'); }
  }
  const ok = !errores.length;
  return { status: ok ? 200 : 409, cuerpo: { ok, modo: 'nube', leidos: anotadas.length, guardados, errores, lectura, comensales: fuenteCom, ms: Date.now() - t0 } };
}

/**
 * montar(app, deps) → POST /tareas/procesos/cierres (cabecera x-rosanta-tarea = clave de tareas). Cuerpo opcional
 * { dias (1-60, por defecto 20 como el vigia), forzar }.
 * deps: { pool, pagos (con copia(), estado(), guardarCierre()), cuenta (google-cuenta) o null, claveTareas,
 *         leerInterruptor(clave) opcional (por defecto: PARAMETROS de la copia de pagos) }.
 */
function montar(app, deps) {
  let enCurso = false;
  const leer = deps.leerInterruptor || ((clave) => interruptorProc(deps.pagos && deps.pagos.copia && (deps.pagos.copia() || {}).libros, clave));

  app.post('/tareas/procesos/cierres', (req, res, next) => {
    if (!iguales(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    next();
  }, async (req, res, next) => {
    try {
      if (!deps.pagos || !deps.pagos.copia) return res.status(404).json({ error: 'No disponible.' });
      const modo = leer('proc_cierres');
      if (modo === 'apps') return res.json({ ok: true, modo: 'apps', nota: 'Los cierres los lee la intranet (PARAMETROS › proc_cierres = apps).' });
      if (modo === 'nube' && !(deps.pagos.estado().en_vivo || {}).cierres) {
        return res.status(409).json({ error: 'proc_cierres = nube solo vale con motor_cierres = base (y MODO_PAGOS=vivo en el servicio): ' +
          'si no, la hoja manda y el servidor no puede guardar cierres. Poné motor_cierres = base o proc_cierres = sombra.' });
      }
      if (!deps.cuenta) return res.status(503).json({ error: 'El servidor no tiene la cuenta de Google (falta GMAIL_OAUTH): no puede leer Gmail.' });
      if (enCurso) return res.status(409).json({ error: 'Otra lectura de cierres en curso: probá en un par de minutos.' });
      enCurso = true;
      try {
        const b = req.body || {};
        const r = await leerCierres({ pool: deps.pool, pagos: deps.pagos, cuenta: deps.cuenta, modo, dias: b.dias, forzar: b.forzar });
        res.status(r.status).json(r.cuerpo);
      } finally { enCurso = false; }
    } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
  });
}

/* ---- La foto del comprobante (leerComprobanteCompra) ----------------------------------------------------------------
 * PREPARADA, SIN USAR: sigue en SOLO_INTRANET de servicio-pagos.js. Interruptor PARAMETROS › proc_comprobante = apps | nube.
 * Corre el leerComprobanteCompra REAL en dos pasadas: la primera anota las fotos y el pedido exacto a Claude
 * (claudeLlamar_ de Servicios.js: POST /v1/messages con x-api-key, anthropic-version y anthropic-beta); con async se
 * guarda cada foto (deps.guardarFoto, la cuenta de servicio del servidor) y se llama a Claude (ANTHROPIC_API_KEY); la
 * segunda pasada contesta desde ahi. Sin guardarFoto, la foto queda 'pendiente': la lectura sale igual, sin enlace.
 * deps: { pagos (copia(), para Pagos: pagEstado_ busca la factura abierta), apiKey (o env ANTHROPIC_API_KEY),
 *         fetch, guardarFoto({nombre, mime, datos, carpeta}) → url, leerInterruptor }.
 */
const URL_CLAUDE = 'https://api.anthropic.com/v1/messages';
const PRIMERA = 'NUBE_PRIMERA_PASADA';

async function leerComprobanteNube(deps, usuario, archivos) {
  const leer = deps.leerInterruptor || ((clave) => interruptorProc((deps.pagos.copia() || {}).libros, clave));
  if (leer('proc_comprobante') !== 'nube') throw error('La foto del comprobante se lee en la intranet (PARAMETROS › proc_comprobante = apps).', 409);
  const key = deps.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw error('Falta ANTHROPIC_API_KEY en el servidor.', 503);
  const copia = deps.pagos.copia();
  if (!copia || !copia.libros) throw error('El servidor todavía no tiene la copia de las hojas.', 503);
  const m = crearMotor({ libros: structuredClone(copia.libros), configId: C.LIBROS.config.id, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  F2.anularEscriturasAlLeer(m.ctx);
  prepararUtilities(m.ctx);
  const X = m.ctx;

  // primera pasada: que fotos guardar y que pedirle a Claude (las validaciones de la intranet tiran aca: 400)
  const fotos = [];
  let pedido = null;
  X._cpeGuardarArchivo_ = (a) => { fotos.push(a); return ''; };
  X.claudeLlamar_ = (payload, betas) => { pedido = { payload, betas }; throw new Error(PRIMERA); };
  try { m.correr(usuario, 'leerComprobanteCompra', [archivos]); } catch (e) {
    if (String(e.message) !== PRIMERA) throw error(String(e.message || e), 400);
  }
  if (!pedido) throw error('La intranet no llegó a pedirle nada a Claude.', 500);

  // lo de afuera, con async
  const sello = formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd_HHmm');
  const urls = [];
  for (const a of fotos) {
    urls.push(deps.guardarFoto ? await deps.guardarFoto({ nombre: sello + '_' + String(a.nombre || 'recibo.jpg'), mime: String(a.mime || 'image/jpeg'), datos: a.datos, carpeta: X.CPE_CARPETA_ }) : '');
  }
  const headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (pedido.betas && pedido.betas.length) headers['anthropic-beta'] = pedido.betas.join(',');
  const r = await (deps.fetch || fetch)(URL_CLAUDE, { method: 'POST', headers, body: JSON.stringify(pedido.payload) });
  const body = await r.json().catch(() => ({}));
  if (r.status !== 200) throw error('Claude respondió ' + r.status + ': ' + ((body.error && body.error.message) || 'error desconocido'), 502);

  // segunda pasada, la de verdad
  let i = 0;
  X._cpeGuardarArchivo_ = () => urls[i++] || '';
  X.claudeLlamar_ = () => body;
  let out;
  try { out = m.correr(usuario, 'leerComprobanteCompra', [archivos]); } catch (e) { throw error(String(e.message || e), 400); }
  if (Object.keys(out.escrituras).length) throw error('Leer la foto quiso escribir en una hoja. No se usa.', 500);
  const res = out.resultado;
  res.archivo_url = String(res.archivo_url || '').trim();
  res.foto = deps.guardarFoto ? 'guardada' : 'pendiente';
  return res;
}

module.exports = { montar, leerCierres, leerComprobanteNube, interruptorProc, comparar, codificarComoIntranet, aColumnas };
