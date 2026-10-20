/**
 * Meta CAPI desde el servidor (20-oct-2026): lo mismo que sendToCAPI de Marketing OS (Code.js), que en la nube
 * no puede salir del codigo copiado. Evento AddToCart por cada carrito, con correo y telefono en SHA-256.
 * El token es el secreto META_CAPI_TOKEN (Secret Manager, con el si de Juanma); sin token no se manda nada,
 * igual que Apps Script ("omitido (sin META_CAPI_TOKEN)").
 */
const crypto = require('crypto');

const DATASET = '1107259034759950';   // META_DATASET_ID de Code.js (Rosanta Reservas)
const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/** El cuerpo que arma sendToCAPI. Funcion pura (la prueba la compara con el codigo real). */
function evento(email, tel, valor, segundos) {
  const ud = {};
  if (email) ud.em = [sha256(email)];
  if (tel) ud.ph = [sha256(String(tel).replace(/[^0-9]/g, ''))];
  return { data: [{ event_name: 'AddToCart', event_time: segundos, action_source: 'system_generated', user_data: ud, custom_data: { currency: 'GTQ', value: valor } }] };
}

/** crearCapi({ token, fetch, ahora }) → (ev: { email, tel, valor }) → Promise<'enviado'|'omitido…'|'error …'> */
function crearCapi(o) {
  const f = o.fetch || fetch, ahora = o.ahora || Date.now;
  return async (ev) => {
    if (!o.token) return 'omitido (sin META_CAPI_TOKEN)';
    const r = await f('https://graph.facebook.com/v26.0/' + DATASET + '/events?access_token=' + encodeURIComponent(o.token),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento(ev.email, ev.tel, ev.valor, Math.floor(ahora() / 1000))) });
    return r.status === 200 ? 'enviado' : 'error ' + r.status;
  };
}

module.exports = { crearCapi, evento, sha256, DATASET };
