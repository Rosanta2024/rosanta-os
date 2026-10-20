/**
 * Fechas, horas, idioma, huellas y mascaras para los avisos de reservas (Ayudante 2, 20-oct-2026). Puro.
 *
 * Todo se muestra en hora de Guatemala (UTC-6, sin horario de verano) aunque el servidor corra en otra
 * zona: las pruebas no dependen de TZ.
 */
const crypto = require('crypto');

const ZONA = 'America/Guatemala';
const DESFASE = '-06:00';   // Guatemala no tiene horario de verano

const MESES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
const DIAS = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

/** 'en' salvo que el cliente diga español. Por defecto inglés (decisión del Estudio). */
function idioma(x) {
  const s = String(x || '').toLowerCase().trim();
  return s === 'es' || s.startsWith('es-') || s === 'español' || s === 'espanol' || s === 'spanish' ? 'es' : 'en';
}

/** Las partes de un instante en hora de Guatemala: { anio, mes (1-12), dia, hora, minuto, diaSemana }. */
function partes(instante) {
  const d = new Date(instante);
  if (isNaN(d)) throw new Error('Fecha invalida: ' + instante);
  const g = new Date(d.getTime() - 6 * 3600 * 1000);   // UTC-6 fijo
  return { anio: g.getUTCFullYear(), mes: g.getUTCMonth() + 1, dia: g.getUTCDate(), hora: g.getUTCHours(), minuto: g.getUTCMinutes(), diaSemana: g.getUTCDay() };
}

const dos = (n) => String(n).padStart(2, '0');

/** AAAA-MM-DD de Guatemala. */
function fechaLocal(instante) { const p = partes(instante); return p.anio + '-' + dos(p.mes) + '-' + dos(p.dia); }
/** HH:MM de Guatemala (24 h). */
function horaLocal(instante) { const p = partes(instante); return dos(p.hora) + ':' + dos(p.minuto); }

/** AAAA-MM-DD + HH:MM de Guatemala → Date. */
function instanteLocal(fecha, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) throw new Error('La fecha va como AAAA-MM-DD.');
  if (!/^\d{1,2}:\d{2}$/.test(String(hora || ''))) throw new Error('La hora va como HH:MM.');
  const h = String(hora).padStart(5, '0');
  const d = new Date(fecha + 'T' + h + ':00' + DESFASE);
  if (isNaN(d)) throw new Error('Fecha u hora invalida.');
  return d;
}

/** "viernes 23 de octubre" / "Friday, October 23". */
function fechaBonita(instante, idi) {
  const p = partes(instante);
  if (idioma(idi) === 'en') return DIAS.en[p.diaSemana] + ', ' + MESES.en[p.mes - 1] + ' ' + p.dia;
  return DIAS.es[p.diaSemana] + ' ' + p.dia + ' de ' + MESES.es[p.mes - 1];
}

/** "19:30" en español; "7:30 pm" en inglés. */
function horaBonita(instante, idi) {
  const p = partes(instante);
  if (idioma(idi) !== 'en') return dos(p.hora) + ':' + dos(p.minuto);
  const h12 = p.hora % 12 === 0 ? 12 : p.hora % 12;
  return h12 + ':' + dos(p.minuto) + ' ' + (p.hora < 12 ? 'am' : 'pm');
}

function personasTexto(n, idi) {
  const k = Number(n) || 0;
  if (idioma(idi) === 'en') return k + (k === 1 ? ' guest' : ' guests');
  return k + (k === 1 ? ' persona' : ' personas');
}

/** Solo el primer nombre (regla de marca: nunca el nombre completo). */
function primerNombre(nombre) {
  const s = String(nombre || '').trim().split(/\s+/)[0] || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Huella del destinatario: la base guarda esto, nunca el correo o el telefono. */
function huellaDestino(x) {
  const s = String(x || '').trim().toLowerCase();
  if (!s) return '';
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** "ana@ejemplo.com" → "a***@ejemplo.com" (para los asuntos de la sombra y los registros). */
function ocultarCorreo(c) {
  const s = String(c || '');
  const i = s.indexOf('@');
  if (i < 1) return '***';
  return s[0] + '***' + s.slice(i);
}
function ocultarTelefono(t) {
  const s = String(t || '').replace(/[^0-9+]/g, '');
  return s.length > 4 ? s.slice(0, s.length - 4).replace(/[0-9]/g, '•') + s.slice(-4) : '••••';
}

/** HTML seguro. */
function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Lo que la sala ve de a quién fue un aviso, sin guardar el dato: "ma***@gmail.com" / "+502 ••••1234". */
function enmascarar(canal, valor) {
  const v = String(valor || '').trim();
  if (canal === 'correo') {
    const i = v.indexOf('@');
    return i < 1 ? '***' : v.slice(0, Math.min(2, i)) + '***' + v.slice(i);
  }
  const dig = v.replace(/[^0-9]/g, '');
  const pais = v.startsWith('+') && dig.length > 8 ? '+' + dig.slice(0, dig.length - 8) + ' ' : '';
  return pais + '••••' + dig.slice(-4);
}
function correoValido(x) { return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(x || '').trim()); }
function telefonoValido(x) { return String(x || '').replace(/[^0-9]/g, '').length >= 8; }

module.exports = {
  ZONA, DESFASE, idioma, partes, fechaLocal, horaLocal, instanteLocal, fechaBonita, horaBonita, personasTexto,
  primerNombre, huellaDestino, ocultarCorreo, ocultarTelefono, esc, enmascarar, correoValido, telefonoValido
};
