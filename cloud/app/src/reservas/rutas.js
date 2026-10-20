/**
 * Motor de reservas · rutas HTTP (20-oct-2026). Un express.Router que el Estudio monta donde quiera, p. ej.:
 *
 *   const { crearRutasReservas } = require('./reservas/rutas');
 *   app.use('/api/reservas', crearRutasReservas({ pool, avisos, crm, capi, permisos, quien }));   // ANTES de app.use(express.json())
 *
 * (Este archivo NO toca server.js ni app.js: lo monta el Estudio.)
 *
 *   Web (CORS solo rosanta.rest, www, nuevo y el iframe de Wix):
 *     GET  /slots?date=&partySize=          POST /reservar            (mismo contrato que /_functions de Wix)
 *   Bot (sin CORS; secreto en el cuerpo):
 *     GET  /bot/reservaPing   POST /bot/reservaBot   GET /bot/cancelarPing   POST /bot/cancelarBot
 *     POST /bot/consultarBot  POST /bot/cambiarBot
 *     → el bot pone WIX_RESERVAS_URL = https://<nube>/api/reservas/bot/reservaBot y deriva las demas como hoy.
 *   Mi reserva (enlace firmado; la pantalla es del AYUDANTE 2):
 *     GET  /mi/:codigo        POST /mi/:codigo/cancelar      POST /mi/:codigo/cambiar { fecha, hora, personas }
 *   Equipo (enlace de siempre: ?u= o cabecera x-rosanta-u; permisos de la parte 'reservas'):
 *     GET  /equipo/estado                      GET  /equipo/dia?fecha=
 *     GET  /equipo/franjas?fecha=&personas=    GET  /equipo/reservas/:id
 *     POST /equipo/reservas  (alta por telefono o walk-in)
 *     POST /equipo/reservas/:id/estado { estado: llego|termino|no_vino|cancelada|confirmada (aprobar)|rechazada, motivo? }
 *     POST /equipo/reservas/:id/cambiar { fecha?, hora?, personas?, mesa_ids?, nota_equipo?, forzar? }
 *     POST /equipo/reservas/:id/consumo { consumo_q }
 *     GET  /equipo/cierres     POST /equipo/cierres { fecha, hasta_fecha?, motivo }     POST /equipo/cierres/:id/reabrir
 *
 * deps: { pool, reloj, secretos: { bot, enlace }, avisos, crm, capi, espejoWix, permisos, quien, puenteWix, registrar,
 *         origenes, limiteReservarPorMinuto, motor }
 *   - permisos(usuario, parte, accion, reg) → { ok, motivo }   (por defecto: la matriz de la base, permisos.js)
 *   - quien(req) → usuario | null                              (por defecto: token ?u= / x-rosanta-u contra usuarios)
 *   - puenteWix(nombre, { metodo, query, cuerpo }) → { status, body }: con motor_reservas = 'wix' reenvia a /_functions
 *     de Wix (lo arma el Estudio para la sombra; sin el, las escrituras devuelven MOTOR_EN_WIX).
 */
const express = require('express');
const C = require('./comun');
const { crearMotor, ErrorMotor } = require('./motor');
const { crearContratoBot } = require('./contrato-bot');
const { crearContratoWeb } = require('./contrato-web');
const { firmarEnlace, verificarEnlace } = require('./enlaces');
const G = require('./ganchos');

const ORIGENES = ['https://www.rosanta.rest', 'https://rosanta.rest', 'https://nuevo.rosanta.rest', 'https://www-rosanta-rest.filesusr.com'];

/** Lee el cuerpo venga como texto (text/plain del formulario) o ya como objeto (si antes corrio express.json). null si no es JSON. */
function cuerpo(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const s = Buffer.isBuffer(b) ? b.toString('utf8') : (typeof b === 'string' ? b : '');
  if (!s.trim()) return null;
  try { const j = JSON.parse(s); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

function crearLimite(maximo, reloj) {
  const vistos = new Map();
  return function pasa(llave) {
    const t = reloj(), v = (vistos.get(llave) || []).filter((x) => t - x < 60000);
    v.push(t); vistos.set(llave, v);
    if (vistos.size > 5000) vistos.clear();
    return v.length <= maximo;
  };
}

function permisosPorDefecto(pool) {
  const P = require('../permisos');
  let M = null, t = 0;
  return async (usuario, parte, accion, reg) => {
    if (!M || Date.now() - t > 300000) { M = await P.cargarDeBase(pool); t = Date.now(); }
    return P.puede(M, usuario, parte, accion, reg);
  };
}
function quienPorDefecto(pool) {
  const U = require('../usuarios');
  return async (req) => { const tok = req.get('x-rosanta-u') || req.query.u; return tok ? U.usuarioPorToken(pool, tok) : null; };
}

function crearRutasReservas(deps) {
  const reloj = () => new Date(deps.reloj ? deps.reloj() : Date.now()).getTime();
  const registrar = deps.registrar || ((m) => console.log(m));
  const motor = deps.motor || crearMotor({ pool: deps.pool, reloj, registrar,
    ganchos: { avisos: deps.avisos, crm: deps.crm, capi: deps.capi, espejoWix: deps.espejoWix } });
  const secretos = Object.assign({ bot: process.env.BOT_RESERVAS_SECRETO, enlace: process.env.RESERVAS_ENLACE_SECRETO }, deps.secretos || {});
  const bot = crearContratoBot({ motor, secreto: secretos.bot, registrar, avisos: deps.avisos });
  const web = crearContratoWeb({ motor, registrar });
  const origenes = deps.origenes || ORIGENES;
  const limite = crearLimite(deps.limiteReservarPorMinuto || 20, reloj);
  const permisos = deps.permisos || permisosPorDefecto(deps.pool);
  const quien = deps.quien || quienPorDefecto(deps.pool);

  const r = express.Router();
  r.use(express.text({ type: () => true, limit: '64kb' }));

  const enviar = (res, x) => res.status(x.status).json(x.body);

  // ---------------------------------------------------------------- web + CORS
  function cors(req, res, next) {
    const o = req.get('origin');
    res.set('Vary', 'Origin');
    if (o && origenes.indexOf(o) !== -1) {
      res.set('Access-Control-Allow-Origin', o);
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '600');
    } else if (o) {
      // Un navegador desde otro sitio: no se le contesta (el formulario de texto plano no hace preflight).
      return res.status(403).json({ ok: false, error: 'Origen no permitido' });
    }
    next();
  }
  r.options(['/slots', '/reservar'], cors, (req, res) => res.status(204).end());

  /** Con motor_reservas = 'wix' y un puente, la pregunta va a Wix tal cual. */
  async function quizasPuente(nombre, req, escribe) {
    if ((await motor.modo()) === 'base') return null;
    if (deps.puenteWix) return deps.puenteWix(nombre, { metodo: req.method, query: req.query, cuerpo: cuerpo(req) });
    if (escribe) return { status: 503, body: nombre === 'reservar' ? { ok: false, error: 'MOTOR_EN_WIX' } : { ok: false, motivo: 'MOTOR_EN_WIX' } };
    return null;   // lectura sin puente: calcula el motor (sirve para la sombra)
  }

  r.get('/slots', cors, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let p = null;
    try { p = await quizasPuente('slots', req, false); } catch (e) {
      // con Wix mandando, mostrar franjas propias que Wix no tiene haria fallar la reserva: mejor decir que no se pudo
      return res.status(502).json({ error: 'No se pudo consultar la disponibilidad (Wix).' });
    }
    enviar(res, p || await web.slots(req.query));
  });
  r.post('/reservar', cors, async (req, res) => {
    if (!limite('reservar|' + (req.ip || ''))) return res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta en un minuto.' });
    let p = null;
    try { p = await quizasPuente('reservar', req, true); } catch (e) { return res.status(502).json({ ok: false, error: 'Wix no respondio.' }); }
    if (p) return enviar(res, p);
    enviar(res, await web.reservar(cuerpo(req), String(req.get('accept-language') || '').slice(0, 2)));
  });

  // ---------------------------------------------------------------- bot (sin CORS)
  const BOT = { reservaBot: true, cancelarBot: true, consultarBot: false, cambiarBot: true };
  r.get('/bot/reservaPing', async (req, res) => enviar(res, await bot.reservaPing()));
  r.get('/bot/cancelarPing', async (req, res) => enviar(res, await bot.cancelarPing()));
  Object.keys(BOT).forEach((nombre) => {
    r.post('/bot/' + nombre, async (req, res) => {
      const d = cuerpo(req);
      if (!d) return enviar(res, { status: 400, body: { ok: false, motivo: 'BODY_INVALIDO' } });
      // el secreto se revisa SIEMPRE aqui, antes de cualquier puente
      if (!require('./contrato-bot').secretoOk(d.secreto, secretos.bot)) return enviar(res, { status: 400, body: { ok: false, motivo: 'SECRETO_INVALIDO' } });
      let p = null;
      try { p = await quizasPuente(nombre, req, BOT[nombre]); } catch (e) { return enviar(res, { status: 500, body: { ok: false, motivo: 'ERROR_INTERNO', detalle: 'puente a Wix: ' + String(e.message || e).slice(0, 200) } }); }
      if (p) return enviar(res, p);
      enviar(res, await bot[nombre](d));
    });
  });

  // ---------------------------------------------------------------- Mi reserva (enlace firmado)
  async function deCodigo(req, res) {
    const id = verificarEnlace(secretos.enlace, req.params.codigo);
    const rv = id ? await motor.porId(id) : null;
    if (!rv) { res.status(404).json({ ok: false, motivo: 'ENLACE_INVALIDO' }); return null; }
    return rv;
  }
  const publica = (x) => ({ fecha: C.diaGt(x.inicio), hora: C.horaGt(x.inicio), personas: x.personas, estado: C.estadoWix(x.estado),
    nombre: x.nombre || '', idioma: x.idioma || 'es', se_puede_cambiar: C.VIGENTES.indexOf(x.estado) !== -1 && x.inicio.getTime() > reloj() });
  r.get('/mi/:codigo', async (req, res, next) => {
    try { const x = await deCodigo(req, res); if (x) res.set('Cache-Control', 'no-store').json({ ok: true, reserva: publica(x) }); } catch (e) { next(e); }
  });
  r.post('/mi/:codigo/cancelar', async (req, res, next) => {
    try {
      const x = await deCodigo(req, res); if (!x) return;
      if (x.inicio.getTime() < reloj()) return res.status(409).json({ ok: false, motivo: 'YA_PASO' });
      const out = await motor.cambiarEstado(x.id, 'cancelada', { quien: 'cliente:enlace', motivo: 'Cancelada por el cliente (enlace)', soloDesde: C.VIGENTES });
      res.status(out.ok ? 200 : 409).json(out.ok ? { ok: true, reserva: publica(out.reserva) } : { ok: false, motivo: out.motivo });
    } catch (e) { next(e); }
  });
  r.post('/mi/:codigo/cambiar', async (req, res, next) => {
    try {
      const x = await deCodigo(req, res); if (!x) return;
      const d = cuerpo(req) || {};
      if (C.VIGENTES.indexOf(x.estado) === -1) return res.status(409).json({ ok: false, motivo: 'NO_VIGENTE' });
      const fecha = d.fecha || C.diaGt(x.inicio), hora = d.hora || C.horaGt(x.inicio);
      if (!C.fechaValida(fecha) || !C.RE_HORA.test(String(hora))) return res.status(400).json({ ok: false, motivo: 'FECHA_INVALIDA' });
      const inicio = C.instante(fecha, hora);
      if (inicio.getTime() < reloj()) return res.status(400).json({ ok: false, motivo: 'FECHA_EN_PASADO' });
      const cfg = await motor.config();
      const personas = d.personas ? Number(d.personas) : x.personas;
      if (!Number.isInteger(personas) || personas < 1 || personas > cfg.reglas.tope_web) return res.status(400).json({ ok: false, motivo: 'PERSONAS_INVALIDO', max: cfg.reglas.tope_web });
      const out = await motor.cambiar(x.id, { inicio, personas }, { canal: 'web', quien: 'cliente:enlace' });
      if (!out.ok) return res.status(409).json({ ok: false, motivo: out.motivo, alternativas: require('./disponibilidad').alternativas(out.libres || [], inicio, 4) });
      res.json({ ok: true, reserva: publica(out.reserva) });
    } catch (e) { next(e); }
  });

  // ---------------------------------------------------------------- equipo
  function exigir(accion) {
    return async (req, res, next) => {
      try {
        const u = await quien(req);
        if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
        let reg = null;
        if (req.params.id && accion === 'corregir') {
          const h = await motor.historial(req.params.id).catch(() => []);
          reg = { escrito_por: (h[0] && h[0].quien) || '' };
        }
        const p = await permisos(u, 'reservas', accion, reg);
        if (!p || !p.ok) return res.status(403).json({ error: (p && p.motivo) || 'Sin permiso.' });
        req.usuario = u;
        next();
      } catch (e) { next(e); }
    };
  }
  const yo = (req) => String((req.usuario && (req.usuario.email || req.usuario.nombre)) || 'equipo');

  r.get('/equipo/estado', exigir('ver'), async (req, res, next) => {
    try { res.json({ motor_reservas: await motor.modo() }); } catch (e) { next(e); }
  });
  r.get('/equipo/dia', exigir('ver'), async (req, res, next) => {
    try {
      const fecha = req.query.fecha || C.diaGt(reloj());
      if (!C.fechaValida(fecha)) return res.status(400).json({ error: 'La fecha va como AAAA-MM-DD.' });
      const d = await motor.dia(String(fecha));
      d.reservas.forEach((x) => { if (secretos.enlace) x.enlace = firmarEnlace(secretos.enlace, x.id); });
      res.set('Cache-Control', 'no-store').json(Object.assign({ motor_reservas: await motor.modo() }, d));
    } catch (e) { next(e); }
  });
  r.get('/equipo/franjas', exigir('ver'), async (req, res, next) => {
    try {
      const fecha = String(req.query.fecha || '');
      if (!C.fechaValida(fecha)) return res.status(400).json({ error: 'La fecha va como AAAA-MM-DD.' });
      const fr = await motor.franjasDia(fecha, Math.max(1, Number(req.query.personas) || 2), 'equipo');
      res.json({ fecha, franjas: fr.filter((f) => f.estado !== 'NON_WORKING_HOURS').map((f) => ({ hora: C.horaGt(f.startDate), startDate: f.startDate,
        estado: f.estado, motivo: f.motivo, mesa_ids: f.mesa_ids })) });
    } catch (e) { next(e); }
  });
  r.get('/equipo/reservas/:id', exigir('ver'), async (req, res, next) => {
    try {
      const x = await motor.porId(req.params.id);
      if (!x) return res.status(404).json({ error: 'No encontre esa reserva.' });
      res.json({ reserva: G.vista(x), historial: await motor.historial(x.id), enlace: secretos.enlace ? firmarEnlace(secretos.enlace, x.id) : null });
    } catch (e) { next(e); }
  });

  /** Alta por telefono (origen telefono) o walk-in (origen sala: hora = ahora y estado llego). */
  r.post('/equipo/reservas', exigir('ingresar'), async (req, res, next) => {
    try {
      const d = cuerpo(req) || {};
      const walkIn = d.walk_in === true || d.origen === 'sala';
      const inicio = walkIn && !d.hora ? new Date(reloj()) : C.instante(d.fecha, d.hora);
      if (!walkIn && (!C.fechaValida(d.fecha) || !C.RE_HORA.test(String(d.hora || '')))) return res.status(400).json({ error: 'Falta la fecha (AAAA-MM-DD) o la hora (HH:MM).' });
      const personas = Number(d.personas);
      if (!Number.isInteger(personas) || personas < 1) return res.status(400).json({ error: 'Personas: un numero entero.' });
      if (!walkIn && !d.nombre) return res.status(400).json({ error: 'Falta el nombre.' });
      if (!walkIn && !d.telefono && !d.email) return res.status(400).json({ error: 'Falta el telefono o el correo.' });
      const out = await motor.crear({
        nombre: d.nombre || 'Walk-in', apellido: d.apellido || '', email: d.email || null, telefono: d.telefono || null, inicio, personas,
        origen: walkIn ? 'sala' : (d.origen === 'evento' ? 'evento' : 'telefono'), canal: walkIn ? 'walk-in' : 'telefono',
        optin: d.optin == null ? null : !!d.optin, idioma: d.idioma, alergias: d.alergias, sentarse: d.sentarse, nota_equipo: d.nota_equipo,
        mesa_ids: Array.isArray(d.mesa_ids) ? d.mesa_ids.map(String) : null, estado: walkIn ? 'llego' : 'confirmada', cotizacion_id: d.cotizacion_id
      }, { canal: 'equipo', quien: yo(req), forzar: d.forzar === true });
      if (!out.ok) return res.status(409).json({ ok: false, motivo: out.motivo, detalle: out.franja && out.franja.motivo,
        alternativas: require('./disponibilidad').alternativas(out.libres || [], inicio, 4) });
      res.json({ ok: true, reserva: G.vista(out.reserva) });
    } catch (e) { next(e); }
  });

  const ACCION_ESTADO = { llego: 'ingresar', no_vino: 'ingresar', termino: 'ingresar', cancelada: 'corregir', confirmada: 'corregir', rechazada: 'corregir' };
  r.post('/equipo/reservas/:id/estado', async (req, res, next) => {
    const d = cuerpo(req) || {};
    const accion = ACCION_ESTADO[d.estado];
    if (!accion) return res.status(400).json({ error: 'Estado: llego, termino, no_vino, cancelada, confirmada o rechazada.' });
    exigir(accion)(req, res, async (err) => {
      if (err) return next(err);
      try {
        const out = await motor.cambiarEstado(req.params.id, d.estado, { quien: yo(req), motivo: d.motivo, forzar: d.forzar === true });
        res.status(out.ok ? 200 : 409).json(out.ok ? { ok: true, reserva: G.vista(out.reserva) } : { ok: false, motivo: out.motivo, mensaje: out.mensaje });
      } catch (e) { next(e); }
    });
  });
  r.post('/equipo/reservas/:id/cambiar', exigir('corregir'), async (req, res, next) => {
    try {
      const d = cuerpo(req) || {};
      const actual = await motor.porId(req.params.id);
      if (!actual) return res.status(404).json({ error: 'No encontre esa reserva.' });
      const cambio = {};
      if (d.fecha || d.hora) {
        const f = d.fecha || C.diaGt(actual.inicio), h = d.hora || C.horaGt(actual.inicio);
        if (!C.fechaValida(f) || !C.RE_HORA.test(String(h))) return res.status(400).json({ error: 'Fecha AAAA-MM-DD y hora HH:MM.' });
        cambio.inicio = C.instante(f, h);
      }
      if (d.personas) cambio.personas = Number(d.personas);
      if (Array.isArray(d.mesa_ids)) cambio.mesa_ids = d.mesa_ids.map(String);
      if (d.nota_equipo != null) cambio.nota_equipo = String(d.nota_equipo);
      const out = await motor.cambiar(actual.id, cambio, { canal: 'equipo', quien: yo(req), forzar: d.forzar === true });
      res.status(out.ok ? 200 : 409).json(out.ok ? { ok: true, reserva: G.vista(out.reserva) } : { ok: false, motivo: out.motivo,
        detalle: out.franja && out.franja.motivo });
    } catch (e) { next(e); }
  });
  r.post('/equipo/reservas/:id/consumo', exigir('ingresar'), async (req, res, next) => {
    try {
      const d = cuerpo(req) || {};
      const out = await motor.consumo(req.params.id, d.consumo_q, { quien: yo(req) });
      res.json({ ok: true, reserva: G.vista(out.reserva) });
    } catch (e) { next(e); }
  });
  r.get('/equipo/cierres', exigir('ver'), async (req, res, next) => {
    try { res.json({ cierres: await motor.cierres() }); } catch (e) { next(e); }
  });
  r.post('/equipo/cierres', exigir('corregir'), async (req, res, next) => {
    try { res.json(await motor.cerrar(cuerpo(req) || {}, { quien: yo(req) })); } catch (e) { next(e); }
  });
  r.post('/equipo/cierres/:cierre/reabrir', exigir('corregir'), async (req, res, next) => {
    try { const out = await motor.reabrir(Number(req.params.cierre)); res.status(out.ok ? 200 : 404).json(out); } catch (e) { next(e); }
  });

  r.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
    if (err instanceof ErrorMotor) return res.status(err.status).json({ ok: false, motivo: err.motivo, error: err.message });
    registrar('reservas · error: ' + String((err && err.message) || err));
    res.status(500).json({ ok: false, error: 'Error interno.' });
  });

  r.motor = motor;   // para las pruebas y para la sombra
  return r;
}

module.exports = { crearRutasReservas, ORIGENES, cuerpo };
