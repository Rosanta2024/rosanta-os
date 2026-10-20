/**
 * Adaptador de Recurrente (pasarela guatemalteca), AYUDANTE 4, 20-oct-2026. Estudio §8.
 * Documentacion: https://docs.recurrente.com (leida el 20-oct-2026).
 *
 * HOY NO HAY LLAVES: RECURRENTE_SECRET_KEY, RECURRENTE_PUBLIC_KEY y RECURRENTE_WEBHOOK_SECRET no existen.
 * Sin llaves, crearRecurrente() devuelve un adaptador APAGADO que contesta 503 "todavia no se cobra en linea".
 * Las pruebas usan recurrenteDoble(): nada sale a la red.
 *
 * Lo que se usa de la API (cualquier otra direccion se niega antes de salir):
 *   POST https://app.recurrente.com/api/checkouts   cabecera X-SECRET-KEY (y X-PUBLIC-KEY si esta)
 *     items: [{ name, currency: GTQ|USD, amount_in_cents, quantity: 1, image_url }], success_url, cancel_url,
 *     metadata, expires_at. Minimo Q5 (500) o US$1 (100). Responde { id: 'ch_...', checkout_url, status }.
 *     OJO: una cuenta SIN VERIFICAR no puede pasar de Q500 / US$50 acumulado (error 422 amount_exceeds_unverified_limit).
 *
 * Webhooks (los manda Recurrente por Svix): cabeceras svix-id, svix-timestamp, svix-signature ("v1,<base64>",
 * puede traer varias separadas por espacio). Firma = base64(HMAC-SHA256(clave, `${id}.${timestamp}.${cuerpo crudo}`)),
 * clave = base64-decode de lo que sigue a "whsec_". Se compara en tiempo constante y se rechaza un timestamp
 * con mas de 5 minutos de diferencia (contra repeticiones). Esto esta en la guia de webhooks de Recurrente;
 * igual queda detras de la interfaz `verificarFirma` por si confirman otra cosa (pregunta para Recurrente).
 */
const crypto = require('crypto');

const BASE = 'https://app.recurrente.com';
const PERMITIDAS = [{ metodo: 'POST', ruta: '/api/checkouts' }];
const TOLERANCIA_S = 300;

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ---------------------------------------------------------------- firma (Svix)

function claveDeSecreto(secreto) {
  const s = String(secreto || '');
  if (!/^whsec_[A-Za-z0-9+/=]+$/.test(s)) throw new Error('El secreto del webhook tiene que ser whsec_...');
  return Buffer.from(s.slice(6), 'base64');
}

function firmar(secreto, id, ts, cuerpo) {
  return crypto.createHmac('sha256', claveDeSecreto(secreto)).update(id + '.' + ts + '.').update(Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(String(cuerpo), 'utf8')).digest('base64');
}

/**
 * verificarFirmaSvix(secreto, cuerpoCrudo, cabeceras, ahoraS?) → { ok, motivo, eventoId }
 * cabeceras: objeto con llaves en minuscula (req.headers de Express ya viene asi).
 */
function verificarFirmaSvix(secreto, cuerpo, cab, ahoraS) {
  const no = (motivo) => ({ ok: false, motivo });
  if (!secreto) return no('sin secreto');
  if (!Buffer.isBuffer(cuerpo)) return no('sin cuerpo crudo');
  const id = cab['svix-id'], ts = cab['svix-timestamp'], sig = cab['svix-signature'];
  if (!id || !ts || !sig) return no('faltan cabeceras svix');
  if (!/^\d{1,12}$/.test(String(ts))) return no('timestamp invalido');
  const ahora = ahoraS === undefined ? Math.floor(Date.now() / 1000) : ahoraS;
  if (Math.abs(ahora - Number(ts)) > TOLERANCIA_S) return no('timestamp fuera de tolerancia');
  let esperada;
  try { esperada = Buffer.from(firmar(secreto, id, ts, cuerpo), 'base64'); } catch (e) { return no('secreto invalido'); }
  const buena = String(sig).split(' ').some((p) => {
    const [ver, val] = p.split(',');
    if (ver !== 'v1' || !val) return false;
    const b = Buffer.from(val, 'base64');
    return b.length === esperada.length && crypto.timingSafeEqual(b, esperada);
  });
  return buena ? { ok: true, eventoId: String(id) } : no('firma no coincide');
}

// ---------------------------------------------------------------- adaptador real

/**
 * crearRecurrente({ secretKey, publicKey, webhookSecret, fetch, permitirVivo })
 * Sin secretKey: adaptador apagado. Una llave sk_live_ solo se acepta con permitirVivo (RECURRENTE_VIVO=si),
 * para que nadie cobre de verdad por error mientras se prueba.
 */
function crearRecurrente(o) {
  const op = o || {};
  const fetchFn = op.fetch || fetch;
  const encendido = !!op.secretKey;
  const vivo = /^sk_live_/.test(op.secretKey || '');
  async function llamar(metodo, ruta, cuerpo) {
    if (!PERMITIDAS.some((p) => p.metodo === metodo && p.ruta === ruta)) throw new Error('Llamada a Recurrente no permitida: ' + metodo + ' ' + ruta);
    if (!encendido) throw error(503, 'Todavía no se cobra en línea (faltan las llaves de Recurrente).');
    if (vivo && !op.permitirVivo) throw error(503, 'La llave de Recurrente es de producción y RECURRENTE_VIVO no está en "si".');
    const h = { 'Content-Type': 'application/json', 'X-SECRET-KEY': op.secretKey };
    if (op.publicKey) h['X-PUBLIC-KEY'] = op.publicKey;
    const r = await fetchFn(BASE + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw error(r.status === 422 ? 422 : 502, 'Recurrente contestó ' + r.status + (j && j.message ? ': ' + String(j.message).slice(0, 200) : ''));
    return j;
  }
  return {
    encendido,
    modo: !encendido ? 'apagado' : (vivo ? 'vivo' : 'prueba'),
    async crearCheckout(c) {
      const j = await llamar('POST', '/api/checkouts', c);
      if (!j.id || !j.checkout_url) throw error(502, 'Recurrente no devolvió el checkout.');
      return { id: j.id, checkout_url: j.checkout_url };
    },
    verificarFirma(cuerpo, cab) { return verificarFirmaSvix(op.webhookSecret, cuerpo, cab); }
  };
}

/** Desde las variables de entorno (Secret Manager). */
function recurrenteDesdeEntorno(env) {
  const e = env || process.env;
  return crearRecurrente({ secretKey: e.RECURRENTE_SECRET_KEY, publicKey: e.RECURRENTE_PUBLIC_KEY, webhookSecret: e.RECURRENTE_WEBHOOK_SECRET, permitirVivo: e.RECURRENTE_VIVO === 'si' });
}

// ---------------------------------------------------------------- doble para pruebas

const SECRETO_PRUEBA = 'whsec_' + Buffer.from('secreto-de-prueba-rosanta-no-real').toString('base64');

function recurrenteDoble(o) {
  const op = o || {};
  const checkouts = [];
  let n = 0;
  return {
    encendido: true, modo: 'doble', checkouts,
    async crearCheckout(c) {
      if (op.falla) throw error(502, 'Recurrente contestó 500');
      const items = c.items || [];
      const total = items.reduce((a, i) => a + i.amount_in_cents * (i.quantity || 1), 0);
      const min = items[0] && items[0].currency === 'USD' ? 100 : 500;
      if (total < min) throw error(400, 'Recurrente: monto menor al mínimo');
      const id = 'ch_prueba' + (++n);
      checkouts.push(Object.assign({ id }, c));
      return { id, checkout_url: 'https://app.recurrente.com/checkout-session/' + id };
    },
    verificarFirma(cuerpo, cab) { return verificarFirmaSvix(op.secreto || SECRETO_PRUEBA, cuerpo, cab, op.ahoraS); }
  };
}

/** Cabeceras firmadas como las manda Recurrente (solo pruebas y ensayos). */
function cabecerasFirmadas(cuerpo, o) {
  const op = o || {};
  const id = op.id || 'msg_' + crypto.randomBytes(8).toString('hex');
  const ts = String(op.ts || Math.floor(Date.now() / 1000));
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v1,' + firmar(op.secreto || SECRETO_PRUEBA, id, ts, cuerpo), 'content-type': 'application/json' };
}

module.exports = { crearRecurrente, recurrenteDesdeEntorno, recurrenteDoble, verificarFirmaSvix, cabecerasFirmadas, firmar, SECRETO_PRUEBA, BASE };
