/**
 * Rutas internas para rosanta-web (la web propia sin Wix; acordado con ese equipo el 20-oct-2026, sombra el 9-nov).
 * Las llama rosanta-web con x-rosanta-tarea = CLAVE_TAREAS. rosanta-nube no conoce la web (orden del Estudio).
 *
 *   POST /interno/web/crm-reserva       el mismo cuerpo que crmReservas.js de Wix → intakeReserva + CRMSync reales
 *   POST /interno/web/capi              NewReservation a Meta (el hash lo hace este servidor), sin pruebas internas
 *   POST /interno/web/pipeline-adventure  un lead de Rosanta Adventures → fila del pipeline (Cotizaciones.js real)
 *   POST /interno/web/pipeline-cotizacion "Request a quote" de /events-1 → fila del pipeline (decision de Juanma, 20-oct)
 *
 * Interruptor por ruta en la tabla `interruptores` (web_reservas, web_capi, web_adventures, web_cotizaciones):
 *   sombra (por defecto, tambien sin fila) → NO escribe ni manda nada: lo anota en hooks_wix_recibidos y contesta
 *       202 { sombra: true }. Asi, mientras Wix siga vivo, nada se duplica.
 *   base → lo hace de verdad (200). apagado → 409.
 * 400 = cuerpo con otra forma (campos de mas tambien), 403 = clave.
 */
const crypto = require('crypto');
const HW = require('../hooks-wix');
const CAPI = require('./capi');

const MODOS = ['sombra', 'base', 'apagado'];
const RUTAS = { 'crm-reserva': 'web_reservas', capi: 'web_capi', 'pipeline-adventure': 'web_adventures', 'pipeline-cotizacion': 'web_cotizaciones' };
const ESTADOS = ['RESERVED', 'CANCELED', 'FINISHED', 'NO_SHOW', 'SEATED', 'REQUESTED', 'DECLINED', 'HELD'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const txt = (v, max, opcional) => (v === null && opcional ? '' : (typeof v === 'string' && v.length <= max ? v.trim() : null));
const soloLlaves = (b, llaves) => b && typeof b === 'object' && !Array.isArray(b) && Object.keys(b).every((k) => llaves.includes(k));

/** Las pruebas internas, como capiReglas.js de Wix y esExcluido_ de CRMSync. */
function esPrueba(u) {
  const t = [u.firstName, u.lastName, u.email].join(' ').toLowerCase();
  if (/@rosanta\.rest\b|@example\.com\b|@usermedia\.co\b/.test(t)) return true;
  return /(^|[\s@._-])(prueba|test)([\s@._-]|$)/.test(t);
}

function limpiarReserva(b) {
  if (!soloLlaves(b, ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'])) return { error: 'cuerpo con otra forma' };
  const l = HW.limpiarReserva(b);
  if (l.error) return l;
  if (!l.cuerpo.id) return { error: 'falta id' };
  if (ESTADOS.indexOf(String(l.cuerpo.estado || '').toUpperCase()) === -1) return { error: 'estado invalido' };
  if (l.cuerpo.optin && ['SI', 'NO'].indexOf(l.cuerpo.optin) === -1) return { error: 'optin invalido' };
  return l;
}

function limpiarCapi(b) {
  if (!soloLlaves(b, ['evento', 'event_id', 'event_time', 'event_source_url', 'user', 'fuente_trafico', 'origen'])) return { error: 'cuerpo con otra forma' };
  if (b.evento !== 'NewReservation') return { error: 'evento invalido' };
  const id = txt(b.event_id, 120);
  if (!id) return { error: 'falta event_id' };
  const t = Number(b.event_time);
  if (!Number.isInteger(t) || t < 1.7e9 || t > 2.2e9) return { error: 'event_time invalido' };
  const url = txt(b.event_source_url, 300);
  if (!url || !/^https:\/\//.test(url)) return { error: 'event_source_url invalida' };
  const u = b.user;
  if (!soloLlaves(u, ['email', 'phone', 'firstName', 'lastName', 'externalId'])) return { error: 'user con otra forma' };
  const user = {};
  for (const k of ['email', 'phone', 'firstName', 'lastName', 'externalId']) { const v = u[k] === undefined ? '' : txt(u[k], 200, true); if (v === null) return { error: 'user.' + k + ' invalido' }; user[k] = v; }
  if (!user.email && !user.phone) return { error: 'user sin correo ni telefono' };
  return { cuerpo: { event_id: id, event_time: t, event_source_url: url, user } };
}

function limpiarAdventure(b) {
  const L = ['id', 'tipo', 'experiencia', 'titulo', 'operador', 'codigo_referido', 'nombre', 'email', 'telefono', 'idioma', 'fecha', 'personas', 'mensaje', 'cena', 'origen'];
  if (!soloLlaves(b, L) || Object.keys(b).length !== L.length) return { error: 'cuerpo con otra forma (van las 15 llaves)' };
  if (!Number.isInteger(b.id) || b.id <= 0) return { error: 'id invalido' };
  if (b.tipo !== 'adventure') return { error: 'tipo invalido' };
  if (typeof b.experiencia !== 'string' || !/^[a-z0-9-]{1,40}$/.test(b.experiencia)) return { error: 'experiencia invalida' };
  const c = {};
  for (const [k, max, opc] of [['titulo', 120], ['operador', 120], ['codigo_referido', 60], ['nombre', 120], ['email', 160], ['telefono', 40, true], ['mensaje', 2000]]) {
    const v = txt(b[k], max, opc); if (v === null) return { error: k + ' invalido' }; c[k] = v;
  }
  if (!c.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || c.email !== c.email.toLowerCase()) return { error: 'falta nombre o correo valido' };
  if (['es', 'en'].indexOf(b.idioma) === -1) return { error: 'idioma invalido' };
  if (b.fecha !== null && !(typeof b.fecha === 'string' && FECHA.test(b.fecha))) return { error: 'fecha invalida' };
  if (b.personas !== null && !(Number.isInteger(b.personas) && b.personas > 0 && b.personas <= 200)) return { error: 'personas invalido' };
  if (b.cena !== null && !(soloLlaves(b.cena, ['fecha', 'hora', 'personas']) && typeof b.cena.fecha === 'string' && FECHA.test(b.cena.fecha) && typeof b.cena.hora === 'string' && /^\d{2}:\d{2}$/.test(b.cena.hora) && Number.isInteger(b.cena.personas))) return { error: 'cena invalida' };
  if (!origenValido(b.origen)) return { error: 'origen invalido' };
  return { cuerpo: Object.assign(c, { id: b.id, experiencia: b.experiencia, idioma: b.idioma, fecha: b.fecha, personas: b.personas, cena: b.cena, origen: b.origen }) };
}

/** "Request a quote" de /events-1 (decision de Juanma del 20-oct): 13 llaves fijas. */
function limpiarCotizacion(b) {
  const L = ['id', 'tipo', 'tipo_evento', 'nombre', 'email', 'telefono', 'idioma', 'fecha', 'personas', 'menu', 'presupuesto', 'mensaje', 'origen'];
  if (!soloLlaves(b, L) || Object.keys(b).length !== L.length) return { error: 'cuerpo con otra forma (van las 13 llaves)' };
  if (typeof b.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.id)) return { error: 'id invalido (uuid en minusculas)' };
  if (b.tipo !== 'evento') return { error: 'tipo invalido' };
  if (['privado', 'boda', 'empresa', 'cumpleanos', 'otro'].indexOf(b.tipo_evento) === -1) return { error: 'tipo_evento invalido' };
  if (['degustacion', 'especiales', 'boquitas', 'no_se'].indexOf(b.menu) === -1) return { error: 'menu invalido' };
  const c = {};
  for (const [k, max, opc] of [['nombre', 120], ['email', 160], ['telefono', 40, true], ['presupuesto', 200], ['mensaje', 2000]]) {
    const v = txt(b[k], max, opc); if (v === null) return { error: k + ' invalido' }; c[k] = v;
  }
  if (!c.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || c.email !== c.email.toLowerCase()) return { error: 'falta nombre o correo valido' };
  if (['es', 'en'].indexOf(b.idioma) === -1) return { error: 'idioma invalido' };
  if (b.fecha !== null && !(typeof b.fecha === 'string' && FECHA.test(b.fecha))) return { error: 'fecha invalida' };
  if (b.personas !== null && !(Number.isInteger(b.personas) && b.personas > 0 && b.personas <= 1000)) return { error: 'personas invalido' };
  if (!origenValido(b.origen)) return { error: 'origen invalido' };
  return { cuerpo: Object.assign(c, { id: b.id, tipo_evento: b.tipo_evento, idioma: b.idioma, fecha: b.fecha, personas: b.personas, menu: b.menu, origen: b.origen }) };
}

const origenValido = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length <= 12 &&
  Object.entries(o).every(([k, v]) => /^[A-Za-z0-9_.-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 300);

function filaCotizacion(c, hoy) {
  return {
    id: 'cotizacion-web-' + c.id,
    data: {
      cliente: c.nombre, contacto: c.email, email: c.email, telefono: c.telefono || '',
      canal: 'web', canal_detalle: 'cotizacion', idioma: c.idioma, evento: 'Cotización web: ' + c.tipo_evento,
      fecha_consulta: hoy, fecha_evento: c.fecha || '', pax: c.personas || '', presupuesto: c.presupuesto, formato_menu: c.menu,
      etapa: 'consulta', estado: 'consulta', notas: c.mensaje,
      extra_json: JSON.stringify({ tipo: 'evento', tipo_evento: c.tipo_evento, menu: c.menu, presupuesto: c.presupuesto, origen: c.origen, web_id: c.id })
    }
  };
}

/** La fila del pipeline (Cotizaciones.js › cotEscribir_). La hoja no tiene "tipo": va en extra_json. */
function filaAdventure(c, hoy) {
  return {
    id: 'adventure-' + c.experiencia + '-' + c.id,
    data: {
      cliente: c.nombre, contacto: c.email, email: c.email, telefono: c.telefono || '',
      canal: 'web', canal_detalle: 'adventures', idioma: c.idioma, evento: 'Adventure: ' + c.titulo,
      fecha_consulta: hoy, fecha_evento: c.fecha || '', pax: c.personas || '', etapa: 'consulta', estado: 'consulta',
      notas: c.mensaje,
      extra_json: JSON.stringify({ tipo: 'adventure', web_id: c.id, experiencia: c.experiencia, operador: c.operador, referido: c.codigo_referido,
        fechas: c.fecha ? [c.fecha] : [], cena_combinada: c.cena, origen: c.origen })
    }
  };
}

/** deps: { pool, crm (crearCrmVivo), vivo (crearServicioVivo), capiReserva(evento) → Promise, hoy() } */
function montarWeb(app, exigirTarea, deps) {
  async function modo(ruta) {
    try {
      const r = await deps.pool.query('SELECT modo FROM interruptores WHERE modulo = $1', [RUTAS[ruta]]);
      const v = r.rows[0] && r.rows[0].modo;
      return MODOS.indexOf(v) !== -1 ? v : 'sombra';
    } catch (e) { return 'sombra'; }
  }
  async function anotar(ruta, cuerpo, m, estado, respuesta) {
    await deps.pool.query('INSERT INTO hooks_wix_recibidos (hook, cuerpo, modo, estado, ms, respuesta) VALUES ($1,$2,$3,$4,$5,$6)',
      ['web-' + ruta, JSON.stringify(cuerpo), m, estado, 0, String(respuesta || '').slice(0, 500)]).catch((e) => console.error('web: no se anoto', e.message));
  }
  const LIMPIAR = { 'crm-reserva': limpiarReserva, capi: limpiarCapi, 'pipeline-adventure': limpiarAdventure, 'pipeline-cotizacion': limpiarCotizacion };
  const FILA = { 'pipeline-adventure': filaAdventure, 'pipeline-cotizacion': filaCotizacion };

  app.post('/interno/web/:ruta', exigirTarea, async (req, res) => {
    const ruta = req.params.ruta;
    if (!LIMPIAR[ruta]) return res.status(404).json({ error: 'ruta desconocida' });
    const l = LIMPIAR[ruta](req.body);
    if (l.error) return res.status(400).json({ error: l.error });
    const m = await modo(ruta);
    if (m === 'apagado') return res.status(409).json({ error: 'interruptor ' + RUTAS[ruta] + ' apagado' });
    try {
      if (m === 'sombra') {
        const out = { sombra: true };
        if (FILA[ruta]) out.id = 'sombra-' + FILA[ruta](l.cuerpo, '').id;
        if (ruta === 'capi') out.prueba = esPrueba(l.cuerpo.user);
        await anotar(ruta, l.cuerpo, 'sombra', 202, JSON.stringify(out));
        return res.status(202).json(out);
      }
      let estado = 200, json;
      if (ruta === 'crm-reserva') {
        const r = await deps.crm.atender('reserva', l.cuerpo, { interruptor: false });
        estado = r.estado; json = r.json;
      } else if (ruta === 'capi') {
        if (esPrueba(l.cuerpo.user)) json = { ok: true, omitido: 'reserva de prueba' };
        else json = { ok: true, capi: await deps.capiReserva(l.cuerpo) };
      } else {
        const f = FILA[ruta](l.cuerpo, deps.hoy ? deps.hoy() : new Date().toISOString().slice(0, 10));
        const r = await deps.vivo.hook({ accion: 'batch', writes: [{ op: 'set', id: f.id, data: f.data }] });
        // un reintento de la web encuentra la fila ya creada (cotEscribir_ pide if_version): es el mismo lead
        if (r && (r.ok || /if_version/.test(String(r.error || '')))) json = { id: f.id };
        else { estado = 502; json = { error: (r && r.error) || 'el pipeline no guardo' }; }
      }
      await anotar(ruta, l.cuerpo, 'base', estado, JSON.stringify(json));
      res.status(estado).json(json);
    } catch (e) {
      await anotar(ruta, l.cuerpo, m, e.status || 500, String(e.message || e));
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  });
}

/** Meta CAPI de una reserva confirmada (lo que hace capi.js de Wix): datos con SHA-256, action_source website. */
function eventoReserva(c) {
  const h = (v) => [crypto.createHash('sha256').update(String(v), 'utf8').digest('hex')];
  const u = c.user, ud = {};
  if (u.email) ud.em = h(u.email.trim().toLowerCase());
  if (u.phone) ud.ph = h(u.phone.replace(/[^0-9]/g, ''));
  if (u.firstName) ud.fn = h(u.firstName.trim().toLowerCase());
  if (u.lastName) ud.ln = h(u.lastName.trim().toLowerCase());
  if (u.externalId) ud.external_id = h(u.externalId.trim());
  return { data: [{ event_name: 'NewReservation', event_id: c.event_id, event_time: c.event_time, action_source: 'website', event_source_url: c.event_source_url, user_data: ud }] };
}

function crearCapiReserva(o) {
  const f = o.fetch || fetch;
  return async (c) => {
    if (!o.token) return 'omitido (sin META_CAPI_TOKEN)';
    const r = await f('https://graph.facebook.com/v26.0/' + CAPI.DATASET + '/events?access_token=' + encodeURIComponent(o.token),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventoReserva(c)) });
    return r.status === 200 ? 'enviado' : 'error ' + r.status;
  };
}

module.exports = { montarWeb, limpiarReserva, limpiarCapi, limpiarAdventure, limpiarCotizacion, filaAdventure, filaCotizacion, eventoReserva, crearCapiReserva, esPrueba, RUTAS };
