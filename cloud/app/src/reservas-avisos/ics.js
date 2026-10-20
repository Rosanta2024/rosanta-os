/**
 * El archivo de calendario (.ics) que va con la confirmación, la aprobación y el cambio.
 * Mismo UID para la misma reserva: si el cliente abre el del cambio, su calendario actualiza el evento
 * en vez de duplicarlo (SEQUENCE sube con cada versión).
 */
const { personasTexto } = require('./formato');

const sello = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escapa un texto para iCalendar (RFC 5545 §3.3.11). */
function escIcs(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }

/** Corta las líneas a 75 octetos, como pide el estándar. */
function plegar(linea) {
  const out = [];
  let resto = Buffer.from(linea, 'utf8');
  let primera = true;
  while (resto.length > (primera ? 75 : 74)) {
    let corte = primera ? 75 : 74;
    while (corte > 0 && (resto[corte] & 0xc0) === 0x80) corte--;   // no partir una letra con tilde
    out.push((primera ? '' : ' ') + resto.slice(0, corte).toString('utf8'));
    resto = resto.slice(corte);
    primera = false;
  }
  out.push((primera ? '' : ' ') + resto.toString('utf8'));
  return out.join('\r\n');
}

/**
 * r: { id, inicio, duracion_min, personas }, o: { idioma, direccion, enlace, secuencia, ahora, cancelada }
 * Devuelve el texto del .ics.
 */
function armarIcs(r, o) {
  const op = o || {};
  const en = op.idioma !== 'es';
  const inicio = new Date(r.inicio);
  const fin = new Date(inicio.getTime() + (Number(r.duracion_min) || 120) * 60000);
  const titulo = (en ? 'Rosanta · table for ' : 'Rosanta · mesa para ') + personasTexto(r.personas, en ? 'en' : 'es');
  const desc = (en ? 'Your table at Rosanta, Antigua Guatemala.' : 'Tu mesa en Rosanta, Antigua Guatemala.') +
    (op.enlace ? '\n' + (en ? 'View or change it: ' : 'Verla o cambiarla: ') + op.enlace : '');
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rosanta//Reservas//ES', 'CALSCALE:GREGORIAN',
    'METHOD:' + (op.cancelada ? 'CANCEL' : 'PUBLISH'),
    'BEGIN:VEVENT',
    'UID:reserva-' + escIcs(r.id) + '@rosanta.rest',
    'SEQUENCE:' + (Number(op.secuencia) || 0),
    'DTSTAMP:' + sello(op.ahora || Date.now()),
    'DTSTART:' + sello(inicio),
    'DTEND:' + sello(fin),
    'SUMMARY:' + escIcs(titulo),
    'LOCATION:' + escIcs(op.direccion || 'Rosanta, Antigua Guatemala'),
    'DESCRIPTION:' + escIcs(desc),
    op.enlace ? 'URL:' + op.enlace : null,
    'STATUS:' + (op.cancelada ? 'CANCELLED' : 'CONFIRMED'),
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(Boolean);
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

module.exports = { armarIcs, escIcs, plegar };
