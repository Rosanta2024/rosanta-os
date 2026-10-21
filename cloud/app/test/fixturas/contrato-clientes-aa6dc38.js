// COPIA FIJA del contrato de rosanta-clientes (Fase 2), rama claude/nube-clientes-vivo, commit aa6dc38:
// cloud/app/src/vivo-clientes/web.js (validadores) y hooks-wix.js (limpiarReserva, texto, numero). NO se edita a mano:
// si Fase 2 cambia el contrato, se vuelve a copiar de su commit y se corre test/contrato-clientes.test.js.
'use strict';
function texto(v, max) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? null : s;
}
function numero(v, max) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HW = { limpiarReserva: (function () {
function limpiarReserva(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'cuerpo invalido' };
  const extra = Object.keys(b).filter((k) => ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'].indexOf(k) === -1);
  if (extra.length) return { error: 'campos de mas' };
  const c = {
    id: texto(b.id, 80), fecha: texto(b.fecha, 10), nombre: texto(b.nombre, 160), email: texto(b.email, 160),
    telefono: texto(b.telefono, 40), personas: numero(b.personas, 500), gasto: numero(b.gasto, 1000000),
    estado: texto(b.estado, 40), optin: texto(b.optin, 3)
  };
  if (Object.keys(c).some((k) => c[k] === null)) return { error: 'campo invalido' };
  if (!c.id && !c.email && !c.telefono) return { error: 'reserva sin id ni contacto' };
  if (c.fecha && !FECHA.test(c.fecha)) return { error: 'fecha invalida' };
  return { cuerpo: c };
}
return limpiarReserva; })() };
const ESTADOS = ['RESERVED', 'CANCELED', 'FINISHED', 'NO_SHOW', 'SEATED', 'REQUESTED', 'DECLINED', 'HELD'];

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

module.exports = { limpiarReserva, limpiarCapi, limpiarAdventure, limpiarCotizacion, esPrueba, COMMIT: 'aa6dc38' };
