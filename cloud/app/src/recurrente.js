/**
 * Recurrente (pasarela guatemalteca): UNA implementacion de la interfaz de pasarela.js. AYUDANTE 4, 20-oct-2026.
 * La pasarela NO esta decidida (Juanma cotiza BAC y NeoNet contra Recurrente): esto se usa solo con PASARELA=recurrente.
 * Documentacion: https://docs.recurrente.com (leida el 20-oct-2026).
 *
 * HOY NO HAY LLAVES: RECURRENTE_SECRET_KEY, RECURRENTE_PUBLIC_KEY y RECURRENTE_WEBHOOK_SECRET no existen. Sin llave
 * secreta, todo lo que cobra responde 503. Una llave sk_live_ solo se acepta con RECURRENTE_VIVO=si.
 *
 * Lo que se usa de la API (cualquier otra direccion se niega antes de salir):
 *   POST /api/checkouts   cabecera X-SECRET-KEY. items [{ name, currency GTQ|USD, amount_in_cents, quantity }], success_url,
 *                         cancel_url, metadata, expires_at. Minimo Q5 / US$1. Responde { id: 'ch_…', checkout_url }.
 *                         Cuenta SIN VERIFICAR: tope Q500 / US$50 acumulado (422 amount_exceeds_unverified_limit).
 *   POST /api/refunds     { intent_id, amount_in_cents? } con Idempotency-Key.
 * Preautorizacion: la documentacion tiene el evento payment_intent.requires_capture pero no un endpoint documentado
 * para capturar o liberar: queda "no disponible" hasta que Recurrente lo confirme.
 *
 * Webhooks por Svix: svix-id, svix-timestamp, svix-signature ("v1,<base64>", puede traer varias separadas por espacio).
 * Firma = base64(HMAC-SHA256(clave, `${id}.${timestamp}.${cuerpo crudo}`)), clave = base64-decode de lo que sigue a
 * "whsec_". Tiempo constante y 5 minutos de tolerancia (contra repeticiones).
 */
const crypto = require('crypto');

const BASE = 'https://app.recurrente.com';
const PERMITIDAS = [{ metodo: 'POST', ruta: '/api/checkouts' }, { metodo: 'POST', ruta: '/api/refunds' }];
const TOLERANCIA_S = 300;
const r2 = (x) => Math.round(Number(x) * 100) / 100;

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

/** verificarFirmaSvix(secreto, cuerpoCrudo, cabeceras, ahoraS?) → { ok, motivo, eventoId } */
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

// ---------------------------------------------------------------- eventos → forma comun

/**
 * Un evento de Recurrente → el evento comun de pasarela.js:
 *   { tipo: pago_exitoso|pago_fallido|reembolso|ignorado, evento, cobro_id, referencia, pago_id, moneda, bruto, comision,
 *     otros, fecha, fel_url, motivo, reembolso: { id, pago_id, al_cliente, de_la_cuenta, estado } }
 */
function interpretarEvento(ev) {
  const tipoRaw = String((ev && (ev.event_type || ev.type)) || '');
  const ch = (ev && ev.checkout) || {};
  const meta = ch.metadata || {};
  const base = { evento: tipoRaw, cobro_id: ch.id || null, referencia: meta.referencia || meta.pedido_ref || null };
  if (tipoRaw === 'intent.succeeded' || tipoRaw === 'payment_intent.succeeded') {
    const d = ev.details || {};
    return Object.assign(base, { tipo: 'pago_exitoso', pago_id: ev.id ? String(ev.id) : null, moneda: String(ev.currency || ch.currency || '').toUpperCase(),
      bruto: r2((Number(ev.amount_in_cents) || 0) / 100), comision: r2((Number(d.fee) || 0) / 100),
      otros: r2(((Number(d.tax_invoicing_fee) || 0) + (Number(d.vat_withheld) || 0)) / 100), fecha: ev.created_at || null, fel_url: ev.tax_invoice_url || null });
  }
  if (tipoRaw === 'intent.failed' || tipoRaw === 'payment_intent.failed') return Object.assign(base, { tipo: 'pago_fallido', pago_id: ev.id || null, motivo: String((ev.details || {}).failure_reason || '') });
  if (tipoRaw === 'refund.create') {
    const rf = ev.refund || {}, it = ev.intentable || {};
    return Object.assign(base, { tipo: 'reembolso', fecha: rf.created_at || null, reembolso: { id: rf.id ? String(rf.id) : null, pago_id: String(it.id || it.intent_id || it.payment_intent_id || '') || null,
      al_cliente: r2((Number(rf.customer_refunded_amount_in_cents) || 0) / 100), de_la_cuenta: r2((Number(rf.account_refunded_amount_in_cents) || 0) / 100), estado: rf.status || null } });
  }
  return Object.assign(base, { tipo: 'ignorado' });
}

// ---------------------------------------------------------------- implementacion

/**
 * crearRecurrente({ secretKey, publicKey, webhookSecret, fetch, permitirVivo, ahoraS })
 * Cumple la interfaz de pasarela.js.
 */
function crearRecurrente(o) {
  const op = o || {};
  const fetchFn = op.fetch || fetch;
  const encendido = !!op.secretKey;
  const vivo = /^sk_live_/.test(op.secretKey || '');
  async function llamar(metodo, ruta, cuerpo, extra) {
    if (!PERMITIDAS.some((p) => p.metodo === metodo && p.ruta === ruta)) throw new Error('Llamada a Recurrente no permitida: ' + metodo + ' ' + ruta);
    if (!encendido) throw error(503, 'Recurrente no está configurado (faltan las llaves).');
    if (vivo && !op.permitirVivo) throw error(503, 'La llave de Recurrente es de producción y RECURRENTE_VIVO no está en "si".');
    const h = Object.assign({ 'Content-Type': 'application/json', 'X-SECRET-KEY': op.secretKey }, extra || {});
    if (op.publicKey) h['X-PUBLIC-KEY'] = op.publicKey;
    const r = await fetchFn(BASE + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw error(r.status === 422 ? 422 : 502, 'Recurrente contestó ' + r.status + (j && j.message ? ': ' + String(j.message).slice(0, 200) : ''));
    return j;
  }
  async function crearCobro(c) {
    const j = await llamar('POST', '/api/checkouts', {
      items: [{ name: c.descripcion, currency: c.moneda, amount_in_cents: Math.round(c.monto * 100), quantity: 1, tax_category: 'service', available_installments: [] }],
      success_url: c.url_exito, cancel_url: c.url_cancelar, metadata: { referencia: c.referencia, concepto: c.concepto },
      expires_at: c.vence ? new Date(c.vence).toISOString() : undefined
    });
    if (!j.id || !j.checkout_url) throw error(502, 'Recurrente no devolvió el checkout.');
    return { id: j.id, url: j.checkout_url };
  }
  const noDisponible = async () => { throw error(501, 'Recurrente no documenta la preautorización (pregunta abierta).'); };
  return {
    proveedor: 'recurrente', encendido, modo: !encendido ? 'apagado' : (vivo ? 'vivo' : 'prueba'),
    capacidades: { cobro: true, link: true, reembolso: true, preautorizacion: false },
    crearCobro,
    crearLink: crearCobro,   // en Recurrente el enlace de pago es un checkout
    verificarWebhook(cuerpo, cab) { return verificarFirmaSvix(op.webhookSecret, cuerpo, cab || {}, op.ahoraS); },
    interpretarEvento,
    async reembolsar(x) {
      const j = await llamar('POST', '/api/refunds', { intent_id: x.pago_id, amount_in_cents: x.monto ? Math.round(x.monto * 100) : undefined },
        { 'Idempotency-Key': x.clave || crypto.randomUUID() });
      return { id: j.id || null, estado: j.status || null };
    },
    preautorizar: noDisponible, capturar: noDisponible, liberar: noDisponible
  };
}

// ---------------------------------------------------------------- pruebas

const SECRETO_PRUEBA = 'whsec_' + Buffer.from('secreto-de-prueba-rosanta-no-real').toString('base64');

/** Recurrente con un fetch de mentira (nada sale a la red). Guarda los checkouts pedidos. */
function recurrenteDoble(o) {
  const op = o || {};
  const checkouts = [], reembolsos = [];
  let n = 0;
  const fetchFalso = async (url, req) => {
    const cuerpo = JSON.parse(req.body);
    if (op.falla) return { ok: false, status: 500, json: async () => ({}) };
    if (url.endsWith('/api/refunds')) { reembolsos.push(cuerpo); return { ok: true, status: 202, json: async () => ({ id: 're_prueba' + reembolsos.length, status: 'pending' }) }; }
    const i = cuerpo.items[0];
    if (i.amount_in_cents < (i.currency === 'USD' ? 100 : 500)) return { ok: false, status: 400, json: async () => ({ message: 'monto menor al minimo' }) };
    const id = 'ch_prueba' + (++n);
    checkouts.push(Object.assign({ id }, cuerpo));
    return { ok: true, status: 201, json: async () => ({ id, checkout_url: 'https://app.recurrente.com/checkout-session/' + id }) };
  };
  const p = crearRecurrente({ secretKey: 'sk_test_prueba', webhookSecret: op.secreto || SECRETO_PRUEBA, fetch: fetchFalso, ahoraS: op.ahoraS });
  return Object.assign(p, { modo: 'doble', checkouts, reembolsos });
}

/** Cabeceras firmadas como las manda Recurrente (solo pruebas y ensayos). */
function cabecerasFirmadas(cuerpo, o) {
  const op = o || {};
  const id = op.id || 'msg_' + crypto.randomBytes(8).toString('hex');
  const ts = String(op.ts || Math.floor(Date.now() / 1000));
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v1,' + firmar(op.secreto || SECRETO_PRUEBA, id, ts, cuerpo), 'content-type': 'application/json' };
}

module.exports = { crearRecurrente, recurrenteDoble, verificarFirmaSvix, interpretarEvento, cabecerasFirmadas, firmar, SECRETO_PRUEBA, BASE };
