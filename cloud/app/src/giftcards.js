/**
 * Gift cards de Rosanta (AYUDANTE 4, 20-oct-2026). Estudio "Web propia sin Wix" §3.5 y §8. Tablas: migracion 054.
 *
 * Compra en el sitio → pedido → cobro en la PASARELA (pasarela.js: ninguna | recurrente | bac | neonet; por defecto
 * ninguna = no se cobra en linea) → webhook (firma verificada, idempotente) → la tarjeta se crea con un codigo
 * RSNT-XXXX-XXXX, el pago queda en pagos_en_linea y sale el aviso (correo del AYUDANTE 2).
 * Canje en la intranet (sala y caja): buscar el codigo, ver saldo y vigencia, descontar (parcial). Cada
 * movimiento queda en gift_cards_movimientos y el saldo NUNCA baja de cero (lo cuida el codigo, y la base con
 * CHECK). Sin pasarela, el dueño emite la tarjeta vendida por deposito (como hoy): el canje y el reporte funcionan igual.
 * Permisos (21-oct, "por el momento solo yo"): canjear, sala y dueño; emitir, anular y aceptar vencidas, solo el dueño.
 *
 * Las tarjetas valen en QUETZALES. Si el comprador paga en US$, se cobra la referencia en dolares y el tipo
 * de cambio queda en el pedido y en pagos_en_linea.
 */
const crypto = require('crypto');
const P = require('./permisos');
const { r2 } = require('./almacen-web');
const { formatDate } = require('./motor-pagos');

const ZONA = 'America/Guatemala';
// Sin 0/O, 1/I/L: que nadie confunda letras al dictar el codigo por telefono.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const RE_CODIGO = /^RSNT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

// usd_fijos: decision de Juanma (20-oct): Q300 = US$45 y Q500 = US$55, fijos. El monto libre usa el tipo de cambio.
const AJUSTES_DEFECTO = { montos_q: [300, 500], minimo_q: 200, maximo_q: 5000, vigencia_meses: 12, usd_fijos: { 300: 45, 500: 55 } };
const TIPO_CAMBIO_DEFECTO = 7.7;   // solo si nadie cargo web_ajustes.tipo_cambio_usd (el dueño lo ajusta)

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ---------------------------------------------------------------- codigos

/** RSNT-XXXX-XXXX con 8 caracteres al azar de 31 (≈ 40 bits): no se adivina. */
function generarCodigo(azar) {
  const pick = azar || ((n) => crypto.randomInt(n));
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[pick(ALFABETO.length)];
  return 'RSNT-' + s.slice(0, 4) + '-' + s.slice(4);
}

/** Lo que escribe la persona ("rsnt abcd 2345", "RSNTABCD2345") → 'RSNT-ABCD-2345', o null si no es un codigo. */
function normalizarCodigo(x) {
  const s = String(x || '').toUpperCase().replace(/[\s-]/g, '');
  const m = s.match(/^(?:RSNT)?([A-Z0-9]{8})$/);
  if (!m) return null;
  const c = 'RSNT-' + m[1].slice(0, 4) + '-' + m[1].slice(4);
  return RE_CODIGO.test(c) ? c : null;
}

// ---------------------------------------------------------------- fechas y montos

const hoyGT = (ahora) => formatDate(ahora || new Date(), ZONA, 'yyyy-MM-dd');
/** Un dia (AAAA-MM-DD) desde lo que devuelva la base: texto, Date de un DATE o de un timestamptz. */
function dia(x) {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  return formatDate(new Date(x), ZONA, 'yyyy-MM-dd');
}
/** El mismo dia `meses` despues (si no existe, el ultimo del mes): 2026-01-31 + 1 → 2026-02-28. */
function sumarMeses(diaTxt, meses) {
  const [y, m, d] = diaTxt.split('-').map(Number);
  const t = (y * 12 + (m - 1)) + meses, ny = Math.floor(t / 12), nm = t % 12 + 1;
  const ultimo = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return ny + '-' + String(nm).padStart(2, '0') + '-' + String(Math.min(d, ultimo)).padStart(2, '0');
}

function validarAjustesGiftcards(v) {
  const a = Object.assign({}, AJUSTES_DEFECTO, v || {});
  const montos = (Array.isArray(a.montos_q) ? a.montos_q : []).map(Number);
  if (!montos.length || montos.some((x) => !Number.isInteger(x) || x < 200 || x > 50000)) throw error(400, 'Los montos fijos son quetzales enteros desde Q200.');
  const minimo = Number(a.minimo_q), maximo = Number(a.maximo_q), meses = Number(a.vigencia_meses);
  if (!(Number.isInteger(minimo) && minimo >= 200)) throw error(400, 'El monto libre empieza en Q200 o más.');
  if (!(Number.isInteger(maximo) && maximo >= minimo && maximo <= 50000)) throw error(400, 'Monto máximo inválido.');
  if (!(Number.isInteger(meses) && meses >= 1 && meses <= 60)) throw error(400, 'La vigencia va en meses (1 a 60).');
  const fijos = {};
  Object.keys(a.usd_fijos || {}).forEach((k) => { const u = Number(a.usd_fijos[k]); if (u > 0) fijos[String(Number(k))] = r2(u); });
  return { montos_q: montos, minimo_q: minimo, maximo_q: maximo, vigencia_meses: meses, usd_fijos: fijos };
}

/**
 * Cuanto se cobra por una tarjeta de valor_q en la moneda elegida.
 * USD: el precio fijo en dolares si el dueño lo cargo (usd_fijos), si no valor_q / tipo de cambio redondeado
 * hacia arriba al dolar entero (Rosanta nunca recibe menos de lo que vale la tarjeta).
 */
function cotizar(valorQ, moneda, ajustes, tc) {
  const a = ajustes || AJUSTES_DEFECTO;
  const v = Number(valorQ);
  if (!Number.isFinite(v) || !Number.isInteger(v * 100) || v <= 0) throw error(400, 'Monto inválido.');
  const fijo = a.montos_q.indexOf(v) !== -1;
  if (!fijo && (v < a.minimo_q || v > a.maximo_q || !Number.isInteger(v))) throw error(400, 'El monto libre va de Q' + a.minimo_q + ' a Q' + a.maximo_q + ', en quetzales enteros.');
  if (moneda === 'GTQ') return { valor_q: v, moneda: 'GTQ', monto_cobro: v, tipo_cambio: null };
  if (moneda !== 'USD') throw error(400, 'La moneda es GTQ o USD.');
  const t = Number(tc) || TIPO_CAMBIO_DEFECTO;
  const usd = (a.usd_fijos && a.usd_fijos[String(v)]) || Math.ceil(v / t);
  return { valor_q: v, moneda: 'USD', monto_cobro: r2(usd), tipo_cambio: t };
}

const centavos = (x) => Math.round(Number(x) * 100);
const limpio = (x, n) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const correoValido = (x) => /^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(x) && x.length <= 200;

// ---------------------------------------------------------------- imagen con marca

const esc = (x) => String(x === null || x === undefined ? '' : x).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
/** La tarjeta como SVG (negro, crema y lila de Rosanta). El adaptador de correo la adjunta o la pasa a PDF/PNG. */
function tarjetaSvg(t, idioma) {
  const en = idioma === 'en';
  const msg = limpio(t.mensaje, 140);
  const lineas = msg ? (msg.match(/.{1,46}(\s|$)/g) || [msg]).slice(0, 3) : [];
  const monto = 'Q' + Number(t.monto).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="600" viewBox="0 0 1050 600">' +
    '<rect width="1050" height="600" rx="36" fill="#000000"/>' +
    '<rect x="24" y="24" width="1002" height="552" rx="24" fill="none" stroke="#AEAAE2" stroke-width="2"/>' +
    '<text x="70" y="120" fill="#F2EEEB" font-family="Playfair Display, Georgia, serif" font-size="64" letter-spacing="6">ROSANTA</text>' +
    '<text x="72" y="160" fill="#AEAAE2" font-family="Poppins, sans-serif" font-size="20" letter-spacing="4">' + (en ? 'GIFT CARD · ANTIGUA GUATEMALA' : 'GIFT CARD · ANTIGUA GUATEMALA') + '</text>' +
    '<text x="980" y="130" text-anchor="end" fill="#F2EEEB" font-family="Playfair Display, Georgia, serif" font-size="84">' + esc(monto) + '</text>' +
    '<text x="70" y="270" fill="#B7B5AD" font-family="Poppins, sans-serif" font-size="20">' + (en ? 'FOR' : 'PARA') + '</text>' +
    '<text x="70" y="310" fill="#F2EEEB" font-family="Avenir, Lato, sans-serif" font-size="34">' + esc(limpio(t.destinatario_nombre, 60)) + '</text>' +
    lineas.map((l, i) => '<text x="70" y="' + (360 + i * 34) + '" fill="#F2EEEB" font-family="Avenir, Lato, sans-serif" font-size="24" font-style="italic">' + esc(l.trim()) + '</text>').join('') +
    '<text x="70" y="520" fill="#AEAAE2" font-family="Courier New, monospace" font-size="44" letter-spacing="4">' + esc(t.codigo) + '</text>' +
    '<text x="980" y="520" text-anchor="end" fill="#B7B5AD" font-family="Poppins, sans-serif" font-size="20">' + (en ? 'Valid until ' : 'Vence el ') + esc(dia(t.vence)) + '</text>' +
    '</svg>';
}

// ---------------------------------------------------------------- servicio

/**
 * crearGiftcards({ almacen, matriz, pasarela, avisos, fel, ahora, urls, contacto })
 *   pasarela: la de pasarela.js (o un doble). urls: { exito, cancelar }. contacto: { correo, whatsapp } para "escríbenos".
 */
function crearGiftcards(deps) {
  const al = deps.almacen;
  const ahora = () => (deps.ahora ? deps.ahora() : new Date());
  const M = () => (typeof deps.matriz === 'function' ? deps.matriz() : deps.matriz);
  const exigir = (u, accion, reg) => { const r = P.puede(M(), u, 'giftcards', accion, reg); if (!r.ok) throw error(403, r.motivo); };
  const puede = (u, accion, reg) => P.puede(M(), u, 'giftcards', accion, reg).ok;

  async function ajustes() {
    const [g, t] = await Promise.all([al.uno('web_ajustes', { clave: 'giftcards' }), al.uno('web_ajustes', { clave: 'tipo_cambio_usd' })]);
    return { a: g ? validarAjustesGiftcards(g.valor) : AJUSTES_DEFECTO, tc: (t && Number(t.valor.q_por_usd)) || TIPO_CAMBIO_DEFECTO };
  }

  /** Para la pagina de compra (publico). */
  async function precios() {
    const { a, tc } = await ajustes();
    return { montos: a.montos_q.map((q) => ({ q, usd: cotizar(q, 'USD', a, tc).monto_cobro })), minimo_q: a.minimo_q, maximo_q: a.maximo_q,
      tipo_cambio: tc, vigencia_meses: a.vigencia_meses, cobro_en_linea: enLinea(), contacto: deps.contacto || {} };
  }

  const enLinea = () => !!(deps.pasarela && deps.pasarela.encendido && deps.pasarela.capacidades && deps.pasarela.capacidades.cobro);
  const noDisponible = (en) => error(503, en ? 'Online purchase is not available yet. Write to us and we will sell it to you by bank transfer.'
    : 'La compra en línea todavía no está disponible. Escríbenos y te la vendemos por depósito.');

  /** El sitio manda el formulario; se guarda el pedido y se devuelve la direccion de pago de la pasarela. */
  async function crearPedido(d) {
    const x = d || {};
    if (!enLinea()) throw noDisponible(x.idioma === 'en');
    if (x.sitio_web) throw error(400, 'No se pudo.');   // campo trampa para robots
    const { a, tc } = await ajustes();
    const c = cotizar(x.valor_q, x.moneda || 'GTQ', a, tc);
    const comprador = x.comprador || {}, dest = x.destinatario || {};
    const ped = {
      ref: 'gc_' + crypto.randomBytes(12).toString('hex'), proveedor: deps.pasarela.proveedor,
      valor_q: c.valor_q, moneda_cobro: c.moneda, monto_cobro: c.monto_cobro, tipo_cambio: c.tipo_cambio,
      comprador_nombre: limpio(comprador.nombre, 120), comprador_email: limpio(comprador.email, 200).toLowerCase(), comprador_telefono: limpio(comprador.telefono, 30) || null,
      destinatario_nombre: limpio(dest.nombre, 120), destinatario_email: limpio(dest.email, 200).toLowerCase() || null,
      mensaje: limpio(x.mensaje, 300), idioma: x.idioma === 'en' ? 'en' : 'es',
      enviar_el: x.enviar_el ? String(x.enviar_el).slice(0, 10) : null,
      origen_trafico: x.origen && typeof x.origen === 'object' ? Object.fromEntries(Object.entries(x.origen).slice(0, 12).map(([k, v]) => [limpio(k, 40), limpio(v, 200)])) : {}
    };
    if (!ped.comprador_nombre || !correoValido(ped.comprador_email)) throw error(400, x.idioma === 'en' ? 'Your name and a valid email are required.' : 'Falta tu nombre o un correo válido.');
    if (!ped.destinatario_nombre) throw error(400, x.idioma === 'en' ? 'Who is the gift card for?' : '¿Para quién es la gift card?');
    if (ped.destinatario_email && !correoValido(ped.destinatario_email)) throw error(400, 'El correo de quien la recibe no es válido.');
    if (ped.enviar_el) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ped.enviar_el)) throw error(400, 'Fecha de envío inválida.');
      const hoy = hoyGT(ahora());
      if (ped.enviar_el < hoy || ped.enviar_el > sumarMeses(hoy, 6)) throw error(400, 'La fecha de envío va de hoy a 6 meses.');
      if (ped.enviar_el === hoy) ped.enviar_el = null;
    }
    const fila = await al.insertar('gift_cards_pedidos', ped);
    const nombre = (ped.idioma === 'en' ? 'Rosanta gift card Q' : 'Gift card Rosanta Q') + c.valor_q;
    let ch;
    try {
      ch = await deps.pasarela.crearCobro({ concepto: 'gift_card', referencia: ped.ref, descripcion: nombre, moneda: c.moneda, monto: c.monto_cobro,
        url_exito: (deps.urls && deps.urls.exito) || 'https://rosanta.rest/gift-cards/gracias',
        url_cancelar: (deps.urls && deps.urls.cancelar) || 'https://rosanta.rest/gift-cards',
        vence: new Date(ahora().getTime() + 2 * 3600 * 1000).toISOString() });
    } catch (e) {
      await al.actualizar('gift_cards_pedidos', fila.id, { estado: 'fallido', nota: 'cobro: ' + String(e.message).slice(0, 200), actualizado: ahora().toISOString() });
      if (e.status === 503) throw noDisponible(ped.idioma === 'en');
      throw error(e.status === 422 ? 422 : 502, ped.idioma === 'en' ? 'We could not open the payment. Please try again in a moment.' : 'No se pudo abrir el pago. Prueba de nuevo en un momento.');
    }
    await al.actualizar('gift_cards_pedidos', fila.id, { cobro_id: ch.id, actualizado: ahora().toISOString() });
    return { ref: ped.ref, checkout_url: ch.url, cobro: { moneda: c.moneda, monto: c.monto_cobro } };
  }

  /** Inserta la tarjeta con un codigo nuevo (se fija antes que no exista; el UNIQUE de la base es la ultima guardia). */
  async function insertarTarjeta(tx, t) {
    for (let i = 0; i < 6; i++) {
      const codigo = generarCodigo(deps.azar);
      if (await tx.uno('gift_cards', { codigo })) continue;
      return tx.insertar('gift_cards', Object.assign({ codigo }, t));
    }
    throw new Error('No se pudo generar un código único (¿el azar está roto?).');
  }

  // ---------------------------------------------------------------- webhook

  /**
   * El webhook de la pasarela. cuerpo: Buffer con el cuerpo CRUDO; cab: cabeceras en minuscula.
   * Devuelve { status, resultado }: 401 firma mala (no se guarda nada), 200 procesado o repetido,
   * 500 si algo fallo adentro (no queda nada escrito y Recurrente reintenta).
   */
  async function procesarWebhook(cuerpo, cab) {
    const pas = deps.pasarela;
    if (!pas || !pas.encendido) return { status: 404, resultado: 'sin pasarela' };
    const v = pas.verificarWebhook(cuerpo, cab || {});
    if (!v.ok) return { status: 401, resultado: 'firma rechazada: ' + v.motivo };
    let ev;
    try { ev = JSON.parse(cuerpo.toString('utf8')); } catch (e) { return { status: 400, resultado: 'cuerpo no es JSON' }; }
    const e = pas.interpretarEvento(ev);
    const tipo = String(e.evento || e.tipo);
    const despues = [];
    let resultado;
    try {
      resultado = await al.transaccion(async (tx) => {
        // Primero se mira (en Postgres un INSERT que choca aborta la transaccion); el UNIQUE es la ultima guardia.
        if (await tx.uno('pagos_webhooks', { proveedor: pas.proveedor, evento_id: v.eventoId })) return 'ya_procesado';
        await tx.insertar('pagos_webhooks', { proveedor: pas.proveedor, evento_id: v.eventoId, tipo, cuerpo: ev });
        let r;
        if (e.tipo === 'pago_exitoso') r = await pagoExitoso(tx, e, ev, despues);
        else if (e.tipo === 'pago_fallido') r = await pagoFallido(tx, e);
        else if (e.tipo === 'reembolso') r = await reembolso(tx, e, ev);
        else r = 'ignorado: ' + tipo;
        const w = await tx.uno('pagos_webhooks', { proveedor: pas.proveedor, evento_id: v.eventoId });
        await tx.actualizar('pagos_webhooks', w.id, { procesado: ahora().toISOString(), resultado: r });
        return r;
      });
    } catch (err) {
      console.error('[giftcards] webhook', v.eventoId, err.message);
      return { status: 500, resultado: 'error: ' + err.message };
    }
    // Despues de guardar: aviso y FEL. Si fallan, la tarjeta ya existe y se reintenta con la tarea de avisos.
    for (const f of despues) { try { await f(); } catch (e) { console.error('[giftcards] despues del webhook', e.message); } }
    return { status: 200, resultado };
  }

  /** El pedido de un evento: por la referencia que viaja en el cobro, o por el id del cobro. */
  async function pedidoDe(tx, e) {
    const prov = deps.pasarela.proveedor;
    return (e.referencia && await tx.uno('gift_cards_pedidos', { ref: e.referencia }, { bloquear: true })) ||
      (e.cobro_id && await tx.uno('gift_cards_pedidos', { proveedor: prov, cobro_id: e.cobro_id }, { bloquear: true })) || null;
  }

  async function pagoExitoso(tx, e, ev, despues) {
    const prov = deps.pasarela.proveedor;
    const ped = await pedidoDe(tx, e);
    if (!ped) return 'ignorado: el cobro no es de una gift card';
    const intentId = String(e.pago_id || '');
    if (!/^[\w-]{3,80}$/.test(intentId)) throw new Error('El evento no trae el id del pago.');
    if (await tx.uno('pagos_en_linea', { proveedor: prov, tipo: 'cobro', proveedor_id: intentId })) return 'ya_procesado';
    if (ped.estado === 'pagado') return 'ya_procesado';
    const moneda = e.moneda, bruto = r2(e.bruto), comision = r2(e.comision || 0), otros = r2(e.otros || 0);
    const tcambio = moneda === 'USD' ? Number(ped.tipo_cambio) || null : null;
    const pago = await tx.insertar('pagos_en_linea', {
      proveedor: prov, tipo: 'cobro', proveedor_id: intentId, cobro_id: e.cobro_id || null, fecha: e.fecha || ahora().toISOString(), moneda: moneda === 'USD' ? 'USD' : 'GTQ',
      bruto, comision, otros_cargos: otros, neto: r2(bruto - comision - otros), tipo_cambio: tcambio, bruto_q: r2(tcambio ? bruto * tcambio : bruto),
      concepto: 'gift_card', concepto_id: null, estado: 'pagado', fel_url: e.fel_url || null, crudo: ev
    });
    // Lo cobrado tiene que ser lo del pedido. Si no, se guarda el pago (la plata entro) pero NO se crea la tarjeta.
    if (moneda !== ped.moneda_cobro || centavos(bruto) !== centavos(ped.monto_cobro)) {
      await tx.actualizar('gift_cards_pedidos', ped.id, { estado: 'revisar', nota: 'Cobrado ' + moneda + ' ' + bruto + ', pedido ' + ped.moneda_cobro + ' ' + ped.monto_cobro, actualizado: ahora().toISOString() });
      return 'revisar: monto distinto (pedido ' + ped.id + ')';
    }
    const { a } = await ajustes();
    const hoy = hoyGT(ahora());
    const tarjeta = await insertarTarjeta(tx, {
      monto: ped.valor_q, saldo: 0, vence: sumarMeses(hoy, a.vigencia_meses),
      comprador_nombre: ped.comprador_nombre, comprador_email: ped.comprador_email, comprador_telefono: ped.comprador_telefono,
      destinatario_nombre: ped.destinatario_nombre, destinatario_email: ped.destinatario_email, mensaje: ped.mensaje, idioma: ped.idioma,
      enviar_el: ped.enviar_el, origen: 'web', pedido_id: ped.id, pago_id: pago.id, creada_por: 'webhook'
    });
    await tx.insertar('gift_cards_movimientos', { gift_card_id: tarjeta.id, tipo: 'venta', monto: tarjeta.monto, saldo_antes: 0, saldo_despues: tarjeta.monto,
      quien: 'webhook', rol: 'sistema', donde: 'web', referencia: intentId, pago_id: pago.id });
    const t2 = (await tx.actualizar('gift_cards', tarjeta.id, { saldo: tarjeta.monto })).despues;
    await tx.actualizar('pagos_en_linea', pago.id, { concepto_id: t2.codigo, actualizado: ahora().toISOString() });
    await tx.actualizar('gift_cards_pedidos', ped.id, { estado: 'pagado', actualizado: ahora().toISOString() });
    despues.push(() => avisar(t2.id));
    if (deps.fel) despues.push(async () => {
      const f = await deps.fel.alPagar({ pago_id: pago.id, concepto: 'gift_card', codigo: t2.codigo, bruto_q: pago.bruto_q });
      if (f && f.fel_estado && f.fel_estado !== 'pendiente') await al.actualizar('pagos_en_linea', pago.id, { fel_estado: f.fel_estado, actualizado: ahora().toISOString() });
    });
    return 'creada ' + t2.codigo;
  }

  async function pagoFallido(tx, e) {
    const ped = await pedidoDe(tx, e);
    if (!ped) return 'ignorado: el cobro no es de una gift card';
    if (ped.estado !== 'pendiente') return 'sin cambio: el pedido está ' + ped.estado;
    await tx.actualizar('gift_cards_pedidos', ped.id, { estado: 'fallido', nota: deps.pasarela.proveedor + ': ' + limpio(e.motivo, 200), actualizado: ahora().toISOString() });
    return 'pedido ' + ped.id + ' fallido';
  }

  async function reembolso(tx, e, ev) {
    const prov = deps.pasarela.proveedor;
    const rf = e.reembolso || {};
    if (['failed', 'voided'].indexOf(rf.estado) !== -1) return 'ignorado: reembolso ' + rf.estado;
    const intentId = rf.pago_id;
    const cobro = intentId && await tx.uno('pagos_en_linea', { proveedor: prov, tipo: 'cobro', proveedor_id: String(intentId) }, { bloquear: true });
    if (!cobro) return 'revisar: reembolso de un pago que no está en la base (' + (intentId || 'sin id') + ')';
    if (!rf.id) throw new Error('El reembolso no trae id.');
    if (await tx.uno('pagos_en_linea', { proveedor: prov, tipo: 'reembolso', proveedor_id: String(rf.id) })) return 'ya_procesado';
    const alCliente = r2(rf.al_cliente || 0);
    const deLaCuenta = r2(rf.de_la_cuenta || 0);
    const tc = cobro.tipo_cambio ? Number(cobro.tipo_cambio) : null;
    await tx.insertar('pagos_en_linea', { proveedor: prov, tipo: 'reembolso', proveedor_id: String(rf.id), cobro_id: cobro.cobro_id, pago_original_id: cobro.id,
      fecha: e.fecha || ahora().toISOString(), moneda: cobro.moneda, bruto: alCliente, comision: 0, otros_cargos: 0, neto: deLaCuenta,
      tipo_cambio: tc, bruto_q: r2(tc ? alCliente * tc : alCliente), concepto: cobro.concepto, concepto_id: cobro.concepto_id, estado: 'reembolso', fel_estado: 'no_aplica', crudo: ev });
    const total = centavos(alCliente) >= centavos(cobro.bruto);
    await tx.actualizar('pagos_en_linea', cobro.id, { estado: total ? 'reembolsado' : 'reembolso_parcial', actualizado: ahora().toISOString() });
    let nota = '';
    if (cobro.concepto === 'gift_card' && cobro.concepto_id && total) {
      const t = await tx.uno('gift_cards', { codigo: cobro.concepto_id }, { bloquear: true });
      if (t && t.estado !== 'anulada') {
        const usada = r2(t.monto - t.saldo) > 0;
        if (t.saldo > 0) await tx.insertar('gift_cards_movimientos', { gift_card_id: t.id, tipo: 'anulacion', monto: t.saldo, saldo_antes: t.saldo, saldo_despues: 0,
          quien: 'webhook', rol: 'sistema', donde: 'sistema', referencia: String(rf.id), pago_id: cobro.id, nota: 'Reembolso en ' + prov });
        await tx.actualizar('gift_cards', t.id, { saldo: 0, estado: 'anulada' });
        nota = usada ? ' · REVISAR: la tarjeta ya tenía canjes' : ' · tarjeta anulada';
      }
    }
    return 'reembolso ' + (total ? 'total' : 'parcial') + ' de ' + cobro.proveedor_id + nota + (centavos(deLaCuenta) !== centavos(alCliente) ? ' · de la cuenta salió ' + deLaCuenta + ' y al cliente ' + alCliente : '');
  }

  // ---------------------------------------------------------------- avisos

  /** Manda el aviso de una tarjeta (o lo deja programado si su fecha de envio es futura). */
  async function avisar(id) {
    const t = await al.uno('gift_cards', { id });
    if (!t || t.estado !== 'activa' || t.aviso_estado === 'enviado' || t.aviso_estado === 'no_aplica') return t;
    if (t.enviar_el && dia(t.enviar_el) > hoyGT(ahora())) {
      if (t.aviso_estado !== 'programado') await al.actualizar('gift_cards', id, { aviso_estado: 'programado' });
      return t;
    }
    let r;
    try {
      r = await deps.avisos.giftCardEmitida({
        tarjeta: { codigo: t.codigo, monto: Number(t.monto), moneda: t.moneda, vence: dia(t.vence), destinatario_nombre: t.destinatario_nombre, comprador_nombre: t.comprador_nombre, mensaje: t.mensaje },
        destinatario_email: t.destinatario_email, comprador_email: t.comprador_email, enviar_a: t.destinatario_email ? 'destinatario' : 'comprador',
        idioma: t.idioma, svg: tarjetaSvg(t, t.idioma)
      });
    } catch (e) { r = { ok: false, detalle: String(e.message || e) }; }
    return (await al.actualizar('gift_cards', id, { aviso_estado: r && r.ok ? 'enviado' : 'error', aviso_enviado: r && r.ok ? ahora().toISOString() : null, aviso_detalle: limpio(r && r.detalle, 300) })).despues;
  }

  /** Tarea diaria: manda los programados que ya tocan y reintenta los que fallaron. */
  async function enviarAvisosPendientes() {
    const out = { enviados: 0, errores: 0, programados: 0 };
    for (const estado of ['programado', 'error', 'pendiente']) {
      for (const t of await al.lista('gift_cards', { aviso_estado: estado, estado: 'activa' })) {
        const r = await avisar(t.id);
        if (r.aviso_estado === 'enviado') out.enviados++; else if (r.aviso_estado === 'error') out.errores++; else out.programados++;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- intranet

  function vista(t, movs, u) {
    const hoy = hoyGT(ahora());
    const vencida = dia(t.vence) < hoy;
    return {
      codigo: t.codigo, monto: Number(t.monto), saldo: Number(t.saldo), moneda: t.moneda, estado: vencida && t.estado === 'activa' ? 'vencida' : t.estado,
      vence: dia(t.vence), emitida: new Date(t.emitida).toISOString(), destinatario_nombre: t.destinatario_nombre, comprador_nombre: t.comprador_nombre,
      mensaje: t.mensaje, origen: t.origen, aviso_estado: t.aviso_estado,
      se_puede_canjear: t.estado === 'activa' && Number(t.saldo) > 0 && (!vencida || puede(u, 'anular_giftcard')),
      movimientos: movs.map((m) => ({ id: m.id, cuando: new Date(m.cuando).toISOString(), tipo: m.tipo, monto: Number(m.monto), saldo_despues: Number(m.saldo_despues),
        quien: m.quien, donde: m.donde, referencia: m.referencia, nota: m.nota, movimiento_ref: m.movimiento_ref }))
    };
  }

  async function buscar(u, codigoTxt) {
    exigir(u, 'ver');
    const codigo = normalizarCodigo(codigoTxt);
    if (!codigo) throw error(400, 'Ese no es un código de gift card (RSNT-XXXX-XXXX).');
    const t = await al.uno('gift_cards', { codigo });
    if (!t) throw error(404, 'No existe la gift card ' + codigo + '.');
    return vista(t, await al.lista('gift_cards_movimientos', { gift_card_id: t.id }), u);
  }

  /** Canje (parcial o total). o: { donde: 'sala'|'caja', referencia (mesa o cuenta), nota } */
  async function canjear(u, codigoTxt, montoTxt, o) {
    exigir(u, 'ingresar');
    const op = o || {};
    const codigo = normalizarCodigo(codigoTxt);
    if (!codigo) throw error(400, 'Ese no es un código de gift card.');
    const monto = Number(String(montoTxt).replace(/[Q,\s]/g, ''));
    if (!Number.isFinite(monto) || monto <= 0 || !Number.isInteger(Math.round(monto * 100)) || Math.abs(monto * 100 - Math.round(monto * 100)) > 1e-6) throw error(400, 'El monto a descontar tiene que ser mayor que cero (hasta centavos).');
    const donde = op.donde === 'caja' ? 'caja' : (op.donde === 'sala' ? 'sala' : null);
    if (!donde) throw error(400, '¿Dónde se canjea: sala o caja?');
    const referencia = limpio(op.referencia, 80);
    if (!referencia) throw error(400, 'Anotá la mesa o el número de cuenta del POS.');
    return al.transaccion(async (tx) => {
      const t = await tx.uno('gift_cards', { codigo }, { bloquear: true });
      if (!t) throw error(404, 'No existe la gift card ' + codigo + '.');
      if (t.estado === 'anulada') throw error(409, 'Esta gift card está anulada.');
      if (t.estado === 'vencida' || Number(t.saldo) <= 0) throw error(409, t.estado === 'vencida' ? 'Esta gift card venció.' : 'Esta gift card ya no tiene saldo.');
      if (dia(t.vence) < hoyGT(ahora())) {
        if (!op.forzarVencida) throw error(409, 'Esta gift card venció el ' + dia(t.vence) + '. Solo el dueño puede aceptarla.');
        exigir(u, 'anular_giftcard');
      }
      const saldo = r2(t.saldo), m = r2(monto);
      if (m > saldo) throw error(409, 'El saldo es Q' + saldo.toFixed(2) + ': no alcanza para Q' + m.toFixed(2) + '.');
      const nuevo = r2(saldo - m);
      const mov = await tx.insertar('gift_cards_movimientos', { gift_card_id: t.id, tipo: 'canje', monto: m, saldo_antes: saldo, saldo_despues: nuevo,
        quien: u.email, rol: String(u.rol || ''), donde, referencia, nota: limpio(op.nota, 300) + (op.forzarVencida ? ' (aceptada vencida por el dueño)' : '') });
      const t2 = (await tx.actualizar('gift_cards', t.id, { saldo: nuevo, estado: nuevo === 0 ? 'agotada' : 'activa' })).despues;
      return { codigo, canjeado: m, saldo: Number(t2.saldo), estado: t2.estado, movimiento: mov.id };
    });
  }

  /** Deshacer un canje equivocado: quien lo hizo, o el dueño. Suma el monto de vuelta. */
  async function reversarCanje(u, movimientoId, nota) {
    exigir(u, 'ingresar');
    return al.transaccion(async (tx) => {
      const m = await tx.uno('gift_cards_movimientos', { id: Number(movimientoId) });
      if (!m || m.tipo !== 'canje') throw error(404, 'Ese movimiento no es un canje.');
      if (String(m.quien).toLowerCase() !== String(u.email).toLowerCase()) exigir(u, 'anular_giftcard');
      if (await tx.uno('gift_cards_movimientos', { movimiento_ref: m.id })) throw error(409, 'Ese canje ya se deshizo.');
      const t = await tx.uno('gift_cards', { id: m.gift_card_id }, { bloquear: true });
      if (t.estado === 'anulada') throw error(409, 'La gift card está anulada.');
      const saldo = r2(t.saldo), nuevo = r2(saldo + Number(m.monto));
      if (nuevo > Number(t.monto)) throw error(409, 'El saldo quedaría mayor que el valor de la tarjeta.');
      const mov = await tx.insertar('gift_cards_movimientos', { gift_card_id: t.id, tipo: 'reverso_canje', monto: Number(m.monto), saldo_antes: saldo, saldo_despues: nuevo,
        quien: u.email, rol: String(u.rol || ''), donde: m.donde, referencia: m.referencia, movimiento_ref: m.id, nota: limpio(nota, 300) });
      const t2 = (await tx.actualizar('gift_cards', t.id, { saldo: nuevo, estado: t.estado === 'agotada' ? 'activa' : t.estado })).despues;
      return { codigo: t.codigo, saldo: Number(t2.saldo), estado: t2.estado, movimiento: mov.id };
    });
  }

  /** Anular una tarjeta (solo el dueño). Si se pago en linea, el reembolso se hace en el panel de la pasarela. */
  async function anular(u, codigoTxt, nota) {
    exigir(u, 'anular_giftcard');
    const codigo = normalizarCodigo(codigoTxt);
    if (!codigo) throw error(400, 'Código inválido.');
    if (!limpio(nota, 300)) throw error(400, 'Anotá por qué se anula.');
    return al.transaccion(async (tx) => {
      const t = await tx.uno('gift_cards', { codigo }, { bloquear: true });
      if (!t) throw error(404, 'No existe.');
      if (t.estado === 'anulada') throw error(409, 'Ya estaba anulada.');
      const saldo = r2(t.saldo);
      await tx.insertar('gift_cards_movimientos', { gift_card_id: t.id, tipo: 'anulacion', monto: saldo, saldo_antes: saldo, saldo_despues: 0,
        quien: u.email, rol: String(u.rol || ''), donde: 'oficina', nota: limpio(nota, 300) });
      await tx.actualizar('gift_cards', t.id, { saldo: 0, estado: 'anulada' });
      return { codigo, anulada: true, saldo_anulado: saldo, pagada_en_linea: !!t.pago_id };
    });
  }

  /**
   * Emitir a mano una tarjeta vendida por deposito o transferencia (como hoy). Solo el dueño. No crea fila en
   * pagos_en_linea: el deposito ya entra al maestro por el banco. referencia: el deposito (banco y numero).
   */
  async function emitirManual(u, d) {
    exigir(u, 'anular_giftcard');
    const x = d || {};
    const { a } = await ajustes();
    const valor = cotizar(x.valor_q, 'GTQ', Object.assign({}, a, { maximo_q: 50000 })).valor_q;
    const referencia = limpio(x.referencia, 120);
    if (!referencia) throw error(400, 'Anotá el depósito (banco y número) con que se pagó.');
    const dest = limpio(x.destinatario_nombre, 120), comp = limpio(x.comprador_nombre, 120);
    if (!dest || !comp) throw error(400, 'Falta quién la compra o para quién es.');
    const correoD = limpio(x.destinatario_email, 200).toLowerCase() || null, correoC = limpio(x.comprador_email, 200).toLowerCase() || null;
    if ((correoD && !correoValido(correoD)) || (correoC && !correoValido(correoC))) throw error(400, 'Correo inválido.');
    const hoy = hoyGT(ahora());
    const t = await al.transaccion(async (tx) => {
      const tarjeta = await insertarTarjeta(tx, { monto: valor, saldo: 0, vence: sumarMeses(hoy, a.vigencia_meses), comprador_nombre: comp, comprador_email: correoC,
        comprador_telefono: limpio(x.comprador_telefono, 30) || null, destinatario_nombre: dest, destinatario_email: correoD, mensaje: limpio(x.mensaje, 300),
        idioma: x.idioma === 'en' ? 'en' : 'es', origen: 'intranet', creada_por: u.email, aviso_estado: x.enviar_correo ? 'pendiente' : 'no_aplica' });
      await tx.insertar('gift_cards_movimientos', { gift_card_id: tarjeta.id, tipo: 'venta', monto: valor, saldo_antes: 0, saldo_despues: valor,
        quien: u.email, rol: String(u.rol || ''), donde: 'oficina', referencia, nota: limpio(x.nota, 300) });
      return (await tx.actualizar('gift_cards', tarjeta.id, { saldo: valor })).despues;
    });
    if (x.enviar_correo) await avisar(t.id);
    return { codigo: t.codigo, monto: Number(t.monto), vence: dia(t.vence) };
  }

  /**
   * Tarea: marcar vencidas las activas con vence < hoy (movimiento 'vencimiento', saldo a 0).
   * NO se programa hasta que el contador diga como tratar las vencidas (Estudio §3.5).
   */
  async function vencer() {
    const hoy = hoyGT(ahora());
    let n = 0, q = 0;
    for (const t of await al.lista('gift_cards', { estado: 'activa' })) {
      if (dia(t.vence) >= hoy) continue;
      await al.transaccion(async (tx) => {
        const x = await tx.uno('gift_cards', { id: t.id }, { bloquear: true });
        if (x.estado !== 'activa') return;
        const saldo = r2(x.saldo);
        await tx.insertar('gift_cards_movimientos', { gift_card_id: x.id, tipo: 'vencimiento', monto: saldo, saldo_antes: saldo, saldo_despues: 0, quien: 'sistema', rol: 'sistema', donde: 'sistema', nota: 'Venció el ' + dia(x.vence) });
        await tx.actualizar('gift_cards', x.id, { saldo: 0, estado: 'vencida' });
        n++; q = r2(q + saldo);
      });
    }
    return { vencidas: n, saldo_vencido: q };
  }

  return { precios, crearPedido, procesarWebhook, avisar, enviarAvisosPendientes, buscar, canjear, reversarCanje, anular, emitirManual, vencer };
}

module.exports = { crearGiftcards, generarCodigo, normalizarCodigo, cotizar, sumarMeses, validarAjustesGiftcards, tarjetaSvg, hoyGT, dia, ALFABETO, RE_CODIGO, AJUSTES_DEFECTO };
