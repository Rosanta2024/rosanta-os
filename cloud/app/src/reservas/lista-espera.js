/**
 * Lista de espera de reservas (23-oct-2026, AYUDANTE SV-NUBE). Tabla lista_espera (migracion 051 + columnas de la 056).
 * APAGADA por defecto: solo existe si LISTA_ESPERA=encendida (server-web.js no la monta si no). Apagada, el servicio
 * se comporta exactamente igual que antes: las rutas no existen (404) y el gancho del motor es el de siempre.
 *
 *   Publico (CORS como el motor: rosanta.rest, www, nuevo y el iframe de Wix):
 *     POST /api/reservas/lista-espera
 *       entra { fecha 'AAAA-MM-DD', desde 'HH:MM', hasta 'HH:MM', personas, nombre, email, telefono?, idioma 'es'|'en', fuente? }
 *         fuente: texto corto ('web', 'bot_whatsapp'...) → columna origen; o un objeto { utm_source, gclid... } → fuente_trafico
 *       sale  200 { ok: true, id }   (si la misma persona ya esta esperando ese dia, el mismo id: no se duplica)
 *             400 { ok: false, error, motivo }   · 429 demasiados intentos
 *   Equipo (enlace de siempre; permisos de la parte 'reservas', como el panel):
 *     GET  /api/reservas/equipo/lista-espera?fecha=AAAA-MM-DD           la lista del dia (todos los estados)
 *     POST /api/reservas/equipo/lista-espera/:id/estado { estado: avisado|reservo, reserva_id? }
 *
 * Aviso automatico: cuando una reserva se CANCELA (o se rechaza) o se MUEVE y deja libre su hora vieja, se avisa por
 * correo al PRIMERO de la lista de ese dia (por orden de llegada) que tenga una franja libre dentro de su rango de horas,
 * con la plantilla "espera_mesa_libre" (cloud/app/avisos/plantillas.*.md) y el enlace para reservar. La mesa NO queda
 * apartada: la toma quien reserve primero (el correo lo dice).
 * IDEMPOTENTE en dos capas:
 *   - lista_espera.aviso_por (UNICO) = 'cancelada:<reserva>:v<version>': la misma liberacion avisa a UNA sola persona,
 *     aunque el gancho corra dos veces o a la vez (el candado por fecha del motor ordena las corridas);
 *   - envios.clave (052): el mismo correo nunca sale dos veces.
 * Con AVISOS_MODO=apagado no se avisa a nadie (la lista queda para que el equipo avise a mano desde el panel).
 */
const express = require('express');
const C = require('./comun');
const A = require('./almacen');

const PLANTILLA = 'espera_mesa_libre';
const LIBERAN = ['cancelada', 'rechazada', 'cambiada'];
const ESTADOS_EQUIPO = ['avisado', 'reservo'];
const MIN = 60000;

const encendida = (env) => String((env || {}).LISTA_ESPERA || '').trim().toLowerCase() === 'encendida';

function hhmm(x) { const m = String(x == null ? '' : x).match(/^(\d{2}):(\d{2})/); return m ? m[1] + ':' + m[2] : null; }
function dia(x) {
  // pg arma la fecha a medianoche LOCAL; pg-mem (pruebas), a medianoche UTC. Las dos dan el mismo dia.
  if (x instanceof Date) return x.getUTCHours() === 0 && x.getUTCMinutes() === 0 ? x.toISOString().slice(0, 10)
    : x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  return String(x || '').slice(0, 10);
}
const iso = (t) => new Date(t).toISOString();

/** Fila de la base → objeto con tipos de JS. */
function deFila(r) {
  if (!r) return null;
  const x = Object.assign({}, r);
  x.id = Number(r.id); x.personas = Number(r.personas);
  x.fecha = dia(r.fecha); x.desde = hhmm(r.desde); x.hasta = hhmm(r.hasta);
  if (typeof x.fuente_trafico === 'string') { try { x.fuente_trafico = JSON.parse(x.fuente_trafico); } catch (e) { x.fuente_trafico = {}; } }
  ['creada', 'actualizada', 'avisado', 'aviso_hasta'].forEach((k) => { if (x[k]) x[k] = iso(x[k]); });
  return x;
}

/** Lo que ve el equipo (sin columnas internas). */
function vistaEquipo(x) {
  return { id: x.id, fecha: x.fecha, desde: x.desde, hasta: x.hasta, personas: x.personas, nombre: x.nombre, email: x.email || '', telefono: x.telefono || '',
    idioma: x.idioma, origen: x.origen, estado: x.estado, avisado: x.avisado || null, aviso_hora: x.aviso_hora || null, aviso_automatico: !!x.aviso_por,
    reserva_id: x.reserva_id || null, notas: x.notas || '', creada: x.creada };
}

/** La "reserva" que recibe el adaptador de avisos (avisos.programar) para una persona de la lista. Sin columnas de mas. */
function comoReserva(fila, inicio) {
  return { id: 'espera:' + fila.id, origen: 'web', canal: 'lista_espera', estado: fila.estado, inicio: iso(inicio), personas: fila.personas,
    nombre: fila.nombre || '', apellido: '', email: fila.email || '', telefono: fila.telefono || '', idioma: fila.idioma === 'es' ? 'es' : 'en',
    mesa_ids: [], alergias: '', nota_equipo: '', version: 1 };
}

const RE_CORREO = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
function malo(motivo, error) { return { status: 400, body: { ok: false, motivo, error } }; }

/** Revisa lo que manda el formulario. Devuelve { fila } o { status, body } (el error). Pura. */
function validar(d, ahoraMs, topePersonas) {
  if (!d || typeof d !== 'object') return malo('CUERPO_INVALIDO', 'Se esperaba JSON.');
  const fecha = String(d.fecha || '');
  if (!C.fechaValida(fecha)) return malo('FECHA_INVALIDA', 'La fecha va como AAAA-MM-DD.');
  const hoy = C.diaGt(ahoraMs);
  if (fecha < hoy) return malo('FECHA_EN_PASADO', 'Esa fecha ya pasó.');
  if (fecha > C.sumarDias(hoy, 120)) return malo('FECHA_LEJANA', 'La lista de espera es para los próximos 120 días.');
  const desde = String(d.desde || ''), hasta = String(d.hasta || '');
  const ok = (h) => C.RE_HORA.test(h) && C.minutosDe(h) < 24 * 60 && Number(h.slice(3)) < 60;
  if (!ok(desde) || !ok(hasta)) return malo('HORA_INVALIDA', 'Desde y hasta van como HH:MM.');
  if (C.minutosDe(desde) > C.minutosDe(hasta)) return malo('RANGO_INVALIDO', '"Desde" tiene que ser antes de "hasta".');
  if (C.instante(fecha, hasta).getTime() <= ahoraMs) return malo('FECHA_EN_PASADO', 'Ese rango de horas ya pasó.');
  const personas = Number(d.personas);
  const tope = Number(topePersonas) || 10;
  if (!Number.isInteger(personas) || personas < 1 || personas > tope) return malo('PERSONAS_INVALIDO', 'Personas: de 1 a ' + tope + '.');
  const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim();
  if (!nombre || nombre.length > 120) return malo('FALTA_NOMBRE', 'Falta el nombre.');
  const email = C.correoClave(d.email);
  if (!RE_CORREO.test(email) || email.length > 200) return malo('CORREO_INVALIDO', 'Falta un correo válido: por ahí te avisamos.');
  let telefono = null;
  if (d.telefono != null && String(d.telefono).trim() !== '') {
    if (String(d.telefono).replace(/[^0-9]/g, '').length < 8 || String(d.telefono).length > 30) return malo('TELEFONO_INVALIDO', 'Teléfono inválido.');
    telefono = C.telE164(d.telefono);
  }
  const idioma = String(d.idioma || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  let origen = 'web', fuente = {};
  if (typeof d.fuente === 'string' && /^[a-z_]{1,30}$/.test(d.fuente)) origen = d.fuente;
  else if (d.fuente && typeof d.fuente === 'object' && !Array.isArray(d.fuente)) {
    Object.keys(d.fuente).slice(0, 20).forEach((k) => { if (/^[a-z_]{1,40}$/i.test(k) && typeof d.fuente[k] === 'string') fuente[k] = d.fuente[k].slice(0, 300); });
  }
  return { fila: { fecha, desde, hasta, personas, nombre, email, telefono, llave_crm: C.llaveCrm(email, telefono), idioma, origen, fuente_trafico: fuente } };
}

/** La hora libre que se le ofrece: la que se libero si cae en su rango; si no, la libre mas cercana dentro del rango. */
function horaLibre(franjas, f, horaLiberada, ahoraMs) {
  const d = C.minutosDe(f.desde || '00:00'), h = C.minutosDe(f.hasta || '23:59');
  const libres = (franjas || []).filter((s) => s.estado === 'AVAILABLE' && new Date(s.startDate).getTime() > ahoraMs)
    .map((s) => C.horaGt(s.startDate)).filter((x) => C.minutosDe(x) >= d && C.minutosDe(x) <= h);
  if (!libres.length) return null;
  if (libres.indexOf(horaLiberada) !== -1) return horaLiberada;
  const m = C.minutosDe(horaLiberada);
  return libres.slice().sort((a, b) => Math.abs(C.minutosDe(a) - m) - Math.abs(C.minutosDe(b) - m) || (a < b ? -1 : 1))[0];
}

/**
 * crearListaEspera({ pool, motor, avisos, reloj, registrar })
 *   motor:  el del motor de reservas (franjasDia y config)
 *   avisos: crearAvisos(...) de reservas-avisos (programar y modo). Sin avisos, no se avisa solo.
 */
function crearListaEspera(deps) {
  const pool = deps.pool;
  const reloj = () => new Date(deps.reloj ? deps.reloj() : Date.now()).getTime();
  const registrar = deps.registrar || ((m) => console.error(m));

  async function anotar(d) {
    let tope = 10;
    try { tope = (await deps.motor.config()).reglas.tope_web || 10; } catch (e) { /* sin configuracion: el tope de siempre */ }
    const v = validar(d, reloj(), tope);
    if (!v.fila) return v;
    const f = v.fila;
    const r = await A.enTransaccion(pool, [f.fecha], async (c) => {
      const ya = await c.query("SELECT id FROM lista_espera WHERE fecha = $1 AND email = $2 AND estado = 'esperando' ORDER BY id LIMIT 1", [f.fecha, f.email]);
      if (ya.rows.length) {
        await c.query('UPDATE lista_espera SET desde = $2, hasta = $3, personas = $4, actualizada = $5, actualizada_por = $6 WHERE id = $1',
          [ya.rows[0].id, f.desde, f.hasta, f.personas, iso(reloj()), 'web']);
        return { id: Number(ya.rows[0].id), repetida: true };
      }
      const x = await c.query(`INSERT INTO lista_espera (fecha, desde, hasta, personas, nombre, email, telefono, llave_crm, idioma, origen, fuente_trafico, creada, actualizada, actualizada_por)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, 'web') RETURNING id`,
      [f.fecha, f.desde, f.hasta, f.personas, f.nombre, f.email, f.telefono, f.llave_crm, f.idioma, f.origen, JSON.stringify(f.fuente_trafico), iso(reloj())]);
      return { id: Number(x.rows[0].id) };
    });
    registrar('LISTA DE ESPERA · ' + f.fecha + ' ' + f.desde + '-' + f.hasta + ' · ' + f.personas + 'p · id ' + r.id + (r.repetida ? ' (ya estaba)' : ''));
    return { status: 200, body: { ok: true, id: r.id } };
  }

  async function delDia(fecha) {
    const r = await pool.query('SELECT * FROM lista_espera WHERE fecha = $1 ORDER BY creada, id', [fecha]);
    return r.rows.map(deFila).map(vistaEquipo);
  }

  /** El equipo marca "avisado" (le escribieron a mano) o "reservo". quien: el correo de quien lo marca. */
  async function marcar(id, estado, quien, reservaId) {
    if (ESTADOS_EQUIPO.indexOf(estado) === -1) return { status: 400, body: { ok: false, error: 'Estado: avisado o reservo.' } };
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return { status: 404, body: { ok: false, error: 'No existe.' } };
    const fila = deFila((await pool.query('SELECT * FROM lista_espera WHERE id = $1', [n])).rows[0]);
    if (!fila) return { status: 404, body: { ok: false, error: 'No existe.' } };
    const desde = estado === 'avisado' ? ['esperando'] : ['esperando', 'avisado'];
    if (fila.estado === estado) return { status: 200, body: { ok: true, item: vistaEquipo(fila) } };
    if (desde.indexOf(fila.estado) === -1) return { status: 409, body: { ok: false, error: 'Ya está como "' + fila.estado + '".' } };
    let reserva = null;
    if (reservaId) {
      const rv = await A.porId(pool, String(reservaId).slice(0, 80));
      if (!rv) return { status: 400, body: { ok: false, error: 'No encontré esa reserva.' } };
      reserva = rv.id;
    }
    const ahora = iso(reloj());
    await pool.query(`UPDATE lista_espera SET estado = $2, avisado = coalesce(avisado, CASE WHEN $2 = 'avisado' THEN $3::timestamptz ELSE NULL END),
        reserva_id = coalesce($4, reserva_id), actualizada = $3, actualizada_por = $5 WHERE id = $1`, [n, estado, ahora, reserva, String(quien || 'equipo').slice(0, 200)]);
    const nueva = deFila((await pool.query('SELECT * FROM lista_espera WHERE id = $1', [n])).rows[0]);
    return { status: 200, body: { ok: true, item: vistaEquipo(nueva) } };
  }

  /**
   * Una reserva libero lugar: avisa al primero de la lista que tenga hora libre en su rango. v: vista del motor;
   * evento: el del gancho; extra.antes: como estaba antes (para 'cambiada').
   */
  async function alLiberar(v, evento, extra) {
    if (!v || LIBERAN.indexOf(evento) === -1) return { omitido: 'no_libera' };
    let libre;
    if (evento === 'cambiada') {
      const a = extra && extra.antes;
      if (!a) return { omitido: 'sin_antes' };
      const misma = new Date(a.inicio).getTime() === new Date(v.inicio).getTime();
      if (misma && Number(v.personas) >= Number(a.personas)) return { omitido: 'no_libera' };
      libre = { inicio: a.inicio };
    } else libre = { inicio: v.inicio };
    if (!deps.avisos || deps.avisos.modo === 'apagado') return { omitido: 'avisos_apagado' };
    if (new Date(libre.inicio).getTime() <= reloj()) return { omitido: 'ya_paso' };
    const llave = evento + ':' + v.id + ':v' + (v.version || 1);
    const fecha = C.diaGt(libre.inicio), horaLiberada = C.horaGt(libre.inicio);
    const elegido = await A.enTransaccion(pool, [fecha], async (c) => {
      const ya = await c.query('SELECT id FROM lista_espera WHERE aviso_por = $1', [llave]);
      if (ya.rows.length) return { ya: Number(ya.rows[0].id) };
      const filas = (await c.query("SELECT * FROM lista_espera WHERE fecha = $1 AND estado = 'esperando' ORDER BY creada, id", [fecha])).rows.map(deFila);
      const franjas = {};
      for (const f of filas) {
        if (!f.email) continue;
        if (!franjas[f.personas]) franjas[f.personas] = await deps.motor.franjasDia(fecha, f.personas, 'web');
        const hora = horaLibre(franjas[f.personas], f, horaLiberada, reloj());
        if (!hora) continue;
        await c.query(`UPDATE lista_espera SET estado = 'avisado', avisado = $2, aviso_por = $3, aviso_hora = $4, actualizada = $2, actualizada_por = 'sistema'
          WHERE id = $1 AND estado = 'esperando'`, [f.id, iso(reloj()), llave, hora]);
        return { fila: Object.assign(f, { estado: 'avisado' }), hora };
      }
      return null;
    });
    if (!elegido) return { omitido: 'nadie_esperando' };
    if (elegido.ya) return { ya_avisado: elegido.ya };
    const f = elegido.fila;
    const r = comoReserva(f, C.instante(fecha, elegido.hora));
    let x;
    try {
      x = await deps.avisos.programar(r, PLANTILLA, { distinto: llave, soloCorreo: true, contexto: { inicio: r.inicio, lista_espera: f.id, libera: llave } });
    } catch (e) { x = { estado: 'fallo', error: String((e && e.message) || e) }; registrar('lista de espera · aviso ' + f.id + ': ' + x.error); }
    await pool.query('UPDATE lista_espera SET aviso_envio = $2 WHERE id = $1', [f.id, x.clave || ('no salio: ' + (x.omitido || x.error || '?'))]);
    registrar('LISTA DE ESPERA · aviso a ' + f.id + ' (' + fecha + ' ' + elegido.hora + ', ' + f.personas + 'p) por ' + llave + ' · ' + (x.estado || x.omitido));
    return { avisado: f.id, hora: elegido.hora, envio: x };
  }

  /** Para los reintentos de la cola de avisos: la persona de la lista como "reserva" (null si no existe). */
  async function comoReservaDeId(id, inicio) {
    const fila = deFila((await pool.query('SELECT * FROM lista_espera WHERE id = $1', [Number(id)])).rows[0]);
    return fila ? comoReserva(fila, inicio || C.instante(fila.fecha, fila.aviso_hora || fila.desde || '19:00')) : null;
  }

  return { anotar, delDia, marcar, alLiberar, comoReservaDeId };
}

/**
 * El gancho de avisos del motor + la lista de espera: primero los avisos de siempre, despues (en cancelada, rechazada
 * y cambiada) la lista. Un error de la lista nunca tumba los avisos ni la reserva.
 */
function conListaEspera(ganchoAvisos, espera, registrar) {
  const log = registrar || ((m) => console.error(m));
  return async function (v, evento, extra) {
    let out, err = null;
    try { out = ganchoAvisos ? await ganchoAvisos(v, evento, extra) : []; } catch (e) { err = e; }
    if (LIBERAN.indexOf(evento) !== -1) {
      try { await espera.alLiberar(v, evento, extra); } catch (e) { log('lista de espera · ' + evento + ': ' + String((e && e.message) || e)); }
    }
    if (err) throw err;
    return out;
  };
}

/** Freno por IP para el formulario publico. */
function crearLimite(maximo, ventanaMs, reloj) {
  const vistos = new Map();
  return (llave) => {
    const t = reloj(), v = (vistos.get(llave) || []).filter((x) => t - x < ventanaMs);
    v.push(t); vistos.set(llave, v);
    if (vistos.size > 5000) vistos.clear();
    return v.length <= maximo;
  };
}

function leerCuerpo(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const s = Buffer.isBuffer(b) ? b.toString('utf8') : (typeof b === 'string' ? b : '');
  try { const j = JSON.parse(s); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

/**
 * Rutas (se montan en /api/reservas, DESPUES del router del motor). deps: { espera, origenes, quien, permisos, reloj }.
 *   permisos(usuario, parte, accion) → { ok, motivo }  (por defecto: la matriz de la base)
 */
function crearRutasListaEspera(deps) {
  const E = deps.espera;
  const reloj = () => new Date(deps.reloj ? deps.reloj() : Date.now()).getTime();
  const origenes = deps.origenes || require('./rutas').ORIGENES;
  const limite = crearLimite(deps.limite || 6, 10 * MIN, reloj);
  let M = null, t = 0;
  const permisos = deps.permisos || (async (u, parte, accion) => {
    const P = require('../permisos');
    if (!M || Date.now() - t > 300000) { M = await P.cargarDeBase(deps.pool); t = Date.now(); }
    return P.puede(M, u, parte, accion);
  });
  const quien = deps.quien || (async (req) => { const tok = req.get('x-rosanta-u') || req.query.u; return tok ? require('../usuarios').usuarioPorToken(deps.pool, tok) : null; });

  const r = express.Router();
  r.use(express.text({ type: () => true, limit: '16kb' }));   // si el router del motor ya leyo el cuerpo, no hace nada

  // CORS igual que el motor (rutas.js): solo los origenes de Rosanta; otro sitio, 403.
  function cors(req, res, next) {
    const o = req.get('origin');
    res.set('Vary', 'Origin');
    if (o && origenes.indexOf(o) !== -1) {
      res.set('Access-Control-Allow-Origin', o);
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '600');
    } else if (o) return res.status(403).json({ ok: false, error: 'Origen no permitido' });
    next();
  }
  r.options('/lista-espera', cors, (req, res) => res.status(204).end());
  r.post('/lista-espera', cors, async (req, res, next) => {
    try {
      if (!limite(String(req.ip || ''))) return res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta en unos minutos.' });
      const x = await E.anotar(leerCuerpo(req));
      res.status(x.status).json(x.body);
    } catch (e) { next(e); }
  });

  function exigir(accion) {
    return async (req, res, next) => {
      try {
        const u = await quien(req);
        if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
        const p = await permisos(u, 'reservas', accion);
        if (!p || !p.ok) return res.status(403).json({ error: (p && p.motivo) || 'Sin permiso.' });
        req.usuario = u;
        next();
      } catch (e) { next(e); }
    };
  }
  r.get('/equipo/lista-espera', exigir('ver'), async (req, res, next) => {
    try {
      const fecha = String(req.query.fecha || C.diaGt(reloj()));
      if (!C.fechaValida(fecha)) return res.status(400).json({ error: 'La fecha va como AAAA-MM-DD.' });
      res.set('Cache-Control', 'no-store').json({ fecha, lista: await E.delDia(fecha) });
    } catch (e) { next(e); }
  });
  r.post('/equipo/lista-espera/:id/estado', exigir('ingresar'), async (req, res, next) => {
    try {
      const d = leerCuerpo(req) || {};
      const x = await E.marcar(req.params.id, d.estado, (req.usuario && (req.usuario.email || req.usuario.nombre)) || 'equipo', d.reserva_id);
      res.status(x.status).json(x.body);
    } catch (e) { next(e); }
  });
  r.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    console.error('lista de espera · error: ' + String((err && err.message) || err));
    res.status(500).json({ ok: false, error: 'Error interno.' });
  });
  return r;
}

module.exports = { PLANTILLA, LIBERAN, encendida, validar, horaLibre, comoReserva, deFila, crearListaEspera, conListaEspera, crearRutasListaEspera };
