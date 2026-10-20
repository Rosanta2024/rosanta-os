/**
 * Motor de reservas · enlace firmado "Mi reserva" (rosanta.rest/r/<codigo>), sin cuenta ni contraseña. 20-oct-2026.
 *
 * No hace falta tabla: el codigo es el id de la reserva + una firma HMAC-SHA256 con la clave RESERVAS_ENLACE_SECRETO
 * (Secret Manager; nunca en el codigo). Quien no tiene la clave no puede armar un codigo valido, y cambiar una letra
 * del id rompe la firma. El enlace deja de servir solo cuando la reserva ya no esta vigente (cancelada, pasada).
 * La pantalla "Mi reserva" y los correos son del AYUDANTE 2; aqui solo se firma y se verifica.
 */
const crypto = require('crypto');

function b64(buf) { return Buffer.from(buf).toString('base64url'); }

function firma(secreto, id) {
  return b64(crypto.createHmac('sha256', String(secreto)).update('reserva:' + String(id)).digest()).slice(0, 22);
}

/** id → codigo para el enlace. */
function firmarEnlace(secreto, id) {
  if (!secreto) throw new Error('Falta RESERVAS_ENLACE_SECRETO.');
  return b64(String(id)) + '.' + firma(secreto, id);
}

/** codigo → id de la reserva, o null si la firma no cuadra. Compara en tiempo constante. */
function verificarEnlace(secreto, codigo) {
  if (!secreto) return null;
  const partes = String(codigo || '').split('.');
  if (partes.length !== 2) return null;
  let id;
  try { id = Buffer.from(partes[0], 'base64url').toString('utf8'); } catch (e) { return null; }
  if (!id) return null;
  const a = Buffer.from(firma(secreto, id)), b = Buffer.from(partes[1]);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
}

module.exports = { firmarEnlace, verificarEnlace };
