const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const P = require('../src/permisos');
const PW = require('../src/permisos-web');
const A = require('../src/almacen-web');
const G = require('../src/giftcards');
const R = require('../src/recurrente');
const PA = require('../src/pasarela');
const AD = require('../src/adaptadores-web');
const { crearRutasGiftcards, guardarCuerpoCrudo } = require('../src/rutas-web');

// Datos inventados: ningun cliente real.
const M = PW.conPropuesta(P.cargarDeMigracion());
const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño', nombre: 'Juanma' };
const maco = { email: 'maco@prueba.test', rol: 'sala', nombre: 'Maco' };
const otraSala = { email: 'sala2@prueba.test', rol: 'sala', nombre: 'Sala 2' };
const jeffry = { email: 'chef@prueba.test', rol: 'chef', nombre: 'Jeffry' };
const vanessa = { email: 'vanessa@prueba.test', rol: 'pauta', nombre: 'Vanessa' };
const CONTACTO = { correo: 'giftcards@prueba.test', whatsapp: '+502 0000 0000' };
const status = (n) => (e) => e.status === n;
const HOY = new Date('2026-11-10T16:00:00Z');   // 10-nov, 10:00 en Guatemala

function armar(o) {
  const op = o || {};
  const almacen = A.crearAlmacenMemoria({ ahora: () => op.ahora || HOY });
  const recurrente = op.pasarela || R.recurrenteDoble({ ahoraS: Math.floor((op.ahora || HOY).getTime() / 1000) });
  const avisos = AD.avisosDoble(op.avisos), fel = AD.felDoble();
  const S = G.crearGiftcards({ almacen, matriz: M, pasarela: recurrente, avisos, fel, ahora: () => op.ahora || HOY, azar: op.azar, contacto: CONTACTO });
  return { almacen, recurrente, avisos, fel, S };
}
const emitir = (S, valor) => S.emitirManual(juanma, { valor_q: valor || 300, referencia: 'BI depósito 123', comprador_nombre: 'Comprador Prueba', destinatario_nombre: 'Destino Prueba' });

/** Un intent.succeeded como el de la documentacion de Recurrente, para el checkout dado. */
function eventoPago(ch, centavos, moneda, extra) {
  return Object.assign({ event_type: 'intent.succeeded', type: 'payment', id: 'in_' + ch.id, status: 'succeeded', created_at: HOY.toISOString(),
    amount_in_cents: centavos, currency: moneda || 'GTQ', tax_invoice_url: null,
    checkout: { id: ch.id, status: 'paid', metadata: ch.metadata, currency: moneda || 'GTQ' },
    details: { fee: Math.round(centavos * 0.045) + 200, tax_invoicing_fee: 0, vat_withheld: 0 } }, extra || {});
}
function firmado(ev, o) {
  const cuerpo = Buffer.from(JSON.stringify(ev));
  return { cuerpo, cab: R.cabecerasFirmadas(cuerpo, Object.assign({ ts: Math.floor(HOY.getTime() / 1000) }, o)) };
}
async function pedir(S, extra) {
  return S.crearPedido(Object.assign({ valor_q: 300, moneda: 'GTQ', idioma: 'es', comprador: { nombre: 'Comprador Prueba', email: 'comprador@prueba.test' },
    destinatario: { nombre: 'Destino Prueba', email: 'destino@prueba.test' }, mensaje: '¡Feliz cumpleaños!' }, extra));
}

// ---------------------------------------------------------------- codigos

test('Códigos: formato RSNT-XXXX-XXXX, sin letras confundibles, al azar y únicos', () => {
  const vistos = new Set();
  for (let i = 0; i < 20000; i++) {
    const c = G.generarCodigo();
    assert.match(c, G.RE_CODIGO);
    assert.doesNotMatch(c.slice(5), /[01OIL]/);
    vistos.add(c);
  }
  assert.strictEqual(vistos.size, 20000, 'en 20.000 no se repite ninguno');
  assert.ok(Math.log2(Math.pow(G.ALFABETO.length, 8)) > 39, 'más de 39 bits de azar');
  assert.strictEqual(G.normalizarCodigo(' rsnt abcd 2345 '), 'RSNT-ABCD-2345');
  assert.strictEqual(G.normalizarCodigo('ABCD2345'), 'RSNT-ABCD-2345');
  assert.strictEqual(G.normalizarCodigo('RSNT-ABC0-2345'), null, 'el 0 no existe en los códigos');
  assert.strictEqual(G.normalizarCodigo("RSNT-ABCD-2345' OR 1=1"), null);
});

test('Códigos: si el azar repite, se busca otro; el UNIQUE es la última guardia', async () => {
  const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
  let i = 0;
  const { S, almacen } = armar({ azar: () => seq[i++ % seq.length] });
  const a = await emitir(S), b = await emitir(S);
  assert.strictEqual(a.codigo, 'RSNT-2222-2222');
  assert.strictEqual(b.codigo, 'RSNT-3333-3333', 'el segundo choca y se genera otro');
  await assert.rejects(almacen.insertar('gift_cards', { codigo: a.codigo, monto: 1, saldo: 1, vence: '2027-01-01', comprador_nombre: 'x', destinatario_nombre: 'y', origen: 'intranet', creada_por: 'p' }), (e) => e.code === '23505');
});

test('Montos: Q300 y Q500 fijos, libre desde Q200, referencia en US$ redondeada hacia arriba', () => {
  const a = G.AJUSTES_DEFECTO;
  assert.deepStrictEqual(G.cotizar(300, 'GTQ', a, 7.7), { valor_q: 300, moneda: 'GTQ', monto_cobro: 300, tipo_cambio: null });
  assert.strictEqual(G.cotizar(300, 'USD', a, 7.7).monto_cobro, 39);   // 38.96 → 39
  assert.strictEqual(G.cotizar(500, 'USD', a, 7.7).monto_cobro, 65);
  assert.strictEqual(G.cotizar(250, 'GTQ', a, 7.7).monto_cobro, 250);
  assert.throws(() => G.cotizar(150, 'GTQ', a, 7.7), status(400));
  assert.throws(() => G.cotizar(250.5, 'GTQ', a, 7.7), status(400));
  assert.throws(() => G.cotizar(300, 'EUR', a, 7.7), status(400));
  assert.strictEqual(G.cotizar(300, 'USD', G.validarAjustesGiftcards({ usd_fijos: { 300: 45 } }), 7.7).monto_cobro, 45, 'precio fijo en US$ si el dueño lo carga');
  assert.throws(() => G.validarAjustesGiftcards({ minimo_q: 100 }), status(400));
  assert.strictEqual(G.sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(G.sumarMeses('2026-11-10', 12), '2027-11-10');
});

// ---------------------------------------------------------------- canje

test('Canje parcial: descuenta, deja cada movimiento y agota en cero', async () => {
  const { S, almacen } = armar();
  const t = await emitir(S, 500);
  assert.strictEqual(t.vence, '2027-11-10', 'vence a los 12 meses');
  let r = await S.canjear(maco, t.codigo.toLowerCase(), '120.50', { donde: 'sala', referencia: 'Mesa 7' });
  assert.deepStrictEqual([r.canjeado, r.saldo, r.estado], [120.5, 379.5, 'activa']);
  r = await S.canjear(maco, t.codigo, 379.5, { donde: 'caja', referencia: 'Cuenta 1043' });
  assert.deepStrictEqual([r.saldo, r.estado], [0, 'agotada']);
  await assert.rejects(S.canjear(maco, t.codigo, 1, { donde: 'sala', referencia: 'Mesa 1' }), (e) => e.status === 409 && /no tiene saldo/.test(e.message));
  const v = await S.buscar(maco, t.codigo);
  assert.deepStrictEqual(v.movimientos.map((m) => [m.tipo, m.monto, m.saldo_despues]), [['venta', 500, 500], ['canje', 120.5, 379.5], ['canje', 379.5, 0]]);
  assert.strictEqual((await almacen.lista('gift_cards_movimientos')).length, 3);
});

test('El saldo nunca baja de cero: monto mayor, negativo, cero, y dos canjes a la vez', async () => {
  const { S, almacen } = armar();
  const t = await emitir(S, 300);
  const o = { donde: 'sala', referencia: 'Mesa 2' };
  await assert.rejects(S.canjear(maco, t.codigo, 300.01, o), (e) => e.status === 409 && /no alcanza/.test(e.message));
  await assert.rejects(S.canjear(maco, t.codigo, -50, o), status(400));
  await assert.rejects(S.canjear(maco, t.codigo, 0, o), status(400));
  await assert.rejects(S.canjear(maco, t.codigo, '10.001', o), status(400));
  await assert.rejects(S.canjear(maco, t.codigo, 10, { donde: 'sala' }), (e) => e.status === 400 && /mesa/.test(e.message));
  await assert.rejects(S.canjear(maco, t.codigo, 10, { referencia: 'x' }), status(400));
  // dos personas canjean Q200 al mismo tiempo sobre Q300: una pasa, la otra no
  const res = await Promise.allSettled([S.canjear(maco, t.codigo, 200, o), S.canjear(otraSala, t.codigo, 200, o)]);
  assert.strictEqual(res.filter((x) => x.status === 'fulfilled').length, 1);
  assert.strictEqual(res.filter((x) => x.status === 'rejected').length, 1);
  const tarjeta = (await almacen.lista('gift_cards'))[0];
  assert.strictEqual(tarjeta.saldo, 100);
  // y la base lo frenaria aunque el codigo fallara
  await assert.rejects(almacen.actualizar('gift_cards', tarjeta.id, { saldo: -1 }), (e) => e.code === '23514');
  await assert.rejects(almacen.insertar('gift_cards_movimientos', { gift_card_id: tarjeta.id, tipo: 'canje', monto: 150, saldo_antes: 100, saldo_despues: -50, quien: 'x', rol: 'x', donde: 'sala' }), (e) => e.code === '23514');
});

test('Deshacer un canje: el suyo sí, el ajeno solo el dueño, y una sola vez', async () => {
  const { S } = armar();
  const t = await emitir(S, 300);
  const c = await S.canjear(maco, t.codigo, 100, { donde: 'sala', referencia: 'Mesa 3' });
  await assert.rejects(S.reversarCanje(otraSala, c.movimiento, 'error'), (e) => e.status === 403 && /dueño/.test(e.message));
  const r = await S.reversarCanje(maco, c.movimiento, 'me equivoqué de tarjeta');
  assert.strictEqual(r.saldo, 300);
  await assert.rejects(S.reversarCanje(juanma, c.movimiento), (e) => e.status === 409 && /ya se deshizo/.test(e.message));
  const c2 = await S.canjear(otraSala, t.codigo, 300, { donde: 'caja', referencia: 'Cuenta 9' });
  const r2 = await S.reversarCanje(juanma, c2.movimiento, 'canje ajeno, lo corrige el dueño');
  assert.deepStrictEqual([r2.saldo, r2.estado], [300, 'activa'], 'la agotada vuelve a activa');
});

test('Vencida: sala no la acepta, el dueño sí; anular es del dueño', async () => {
  const x = armar();
  const t = await emitir(x.S, 300);
  const despues = G.crearGiftcards({ almacen: x.almacen, matriz: M, pasarela: x.recurrente, avisos: x.avisos, ahora: () => new Date('2027-11-11T16:00:00Z') });
  const v = await despues.buscar(maco, t.codigo);
  assert.strictEqual(v.estado, 'vencida'); assert.strictEqual(v.se_puede_canjear, false);
  await assert.rejects(despues.canjear(maco, t.codigo, 50, { donde: 'sala', referencia: 'Mesa 1' }), (e) => e.status === 409 && /venció/.test(e.message));
  await assert.rejects(despues.canjear(maco, t.codigo, 50, { donde: 'sala', referencia: 'Mesa 1', forzarVencida: true }), status(403));
  const r = await despues.canjear(juanma, t.codigo, 50, { donde: 'sala', referencia: 'Mesa 1', forzarVencida: true });
  assert.strictEqual(r.saldo, 250);
  await assert.rejects(despues.anular(maco, t.codigo, 'x'), status(403));
  await assert.rejects(despues.anular(juanma, t.codigo, ''), status(400));
  const a = await despues.anular(juanma, t.codigo, 'pedido del cliente');
  assert.strictEqual(a.saldo_anulado, 250);
  await assert.rejects(despues.canjear(juanma, t.codigo, 1, { donde: 'sala', referencia: 'x' }), /anulada/);
  const tarea = await despues.vencer();
  assert.deepStrictEqual(tarea, { vencidas: 0, saldo_vencido: 0 }, 'la anulada no se vence');
});

test('La tarea de vencer deja un movimiento de vencimiento con el saldo', async () => {
  const x = armar();
  const t = await emitir(x.S, 300);
  await x.S.canjear(maco, t.codigo, 100, { donde: 'sala', referencia: 'Mesa 1' });
  const despues = G.crearGiftcards({ almacen: x.almacen, matriz: M, pasarela: x.recurrente, avisos: x.avisos, ahora: () => new Date('2027-11-11T16:00:00Z') });
  assert.deepStrictEqual(await despues.vencer(), { vencidas: 1, saldo_vencido: 200 });
  const v = await despues.buscar(juanma, t.codigo);
  assert.deepStrictEqual([v.estado, v.saldo, v.movimientos.pop().tipo], ['vencida', 0, 'vencimiento']);
});

test('Permisos del canje: sala y dueño sí; cocina y pauta no; emitir solo el dueño', async () => {
  const { S } = armar();
  const t = await emitir(S, 300);
  await assert.rejects(S.buscar(jeffry, t.codigo), status(403));
  await assert.rejects(S.buscar(vanessa, t.codigo), status(403));
  await assert.rejects(S.canjear(jeffry, t.codigo, 10, { donde: 'sala', referencia: 'x' }), status(403));
  await assert.rejects(emitir(Object.assign({}, S, { emitirManual: (u, d) => S.emitirManual(maco, d) })), status(403));
  await assert.rejects(S.emitirManual(juanma, { valor_q: 300, comprador_nombre: 'a', destinatario_nombre: 'b' }), (e) => /depósito/.test(e.message));
  assert.ok((await S.buscar(maco, t.codigo)).se_puede_canjear);
  const G0 = G.crearGiftcards({ almacen: A.crearAlmacenMemoria(), matriz: P.cargarDeMigracion(), pasarela: R.recurrenteDoble(), avisos: AD.avisosDoble() });
  await assert.rejects(G0.buscar(juanma, t.codigo), status(403), 'sin las filas de la sesión C, nadie');
});

// ---------------------------------------------------------------- compra y webhook

test('Compra: el pedido abre el checkout de Recurrente con el monto en centavos y sin datos personales', async () => {
  const { S, recurrente, almacen } = armar();
  const p = await pedir(S, { moneda: 'USD', origen: { utm_source: 'instagram' } });
  assert.match(p.checkout_url, /^https:\/\/app\.recurrente\.com\//);
  const ch = recurrente.checkouts[0];
  assert.deepStrictEqual([ch.items[0].currency, ch.items[0].amount_in_cents, ch.items[0].quantity], ['USD', 3900, 1]);
  assert.deepStrictEqual(Object.keys(ch.metadata).sort(), ['concepto', 'referencia']);
  assert.ok(!JSON.stringify(ch).includes('@'), 'el checkout no lleva correos');
  const ped = (await almacen.lista('gift_cards_pedidos'))[0];
  assert.deepStrictEqual([ped.estado, ped.proveedor, ped.cobro_id, ped.valor_q, ped.monto_cobro, ped.tipo_cambio], ['pendiente', 'recurrente', ch.id, 300, 39, 7.7]);
  await assert.rejects(pedir(S, { comprador: { nombre: 'x', email: 'no-es-correo' } }), status(400));
  await assert.rejects(pedir(S, { destinatario: { nombre: '' } }), status(400));
  await assert.rejects(pedir(S, { valor_q: 100 }), status(400));
  await assert.rejects(pedir(S, { sitio_web: 'http://spam' }), status(400), 'el campo trampa frena robots');
  await assert.rejects(pedir(S, { enviar_el: '2026-11-01' }), status(400), 'no se envía en el pasado');
  const sinLlaves = G.crearGiftcards({ almacen, matriz: M, pasarela: PA.crearPasarela({ PASARELA: 'recurrente' }), avisos: AD.avisosDoble() });
  await assert.rejects(pedir(sinLlaves), (e) => e.status === 503 && /Escríbenos/.test(e.message), 'Recurrente sin llaves no cobra');
});

test('Webhook: el pago crea la tarjeta, el pago en línea y el aviso; repetido no duplica', async () => {
  const { S, recurrente, almacen, avisos, fel } = armar();
  await pedir(S);
  const ev = eventoPago(recurrente.checkouts[0], 30000);
  const { cuerpo, cab } = firmado(ev, { id: 'msg_1' });
  const r = await S.procesarWebhook(cuerpo, cab);
  assert.strictEqual(r.status, 200);
  const codigo = r.resultado.replace('creada ', '');
  assert.match(codigo, G.RE_CODIGO);
  const t = (await almacen.lista('gift_cards'))[0];
  assert.deepStrictEqual([t.monto, t.saldo, t.origen, t.vence, t.aviso_estado], [300, 300, 'web', '2027-11-10', 'enviado']);
  const p = (await almacen.lista('pagos_en_linea'))[0];
  assert.deepStrictEqual([p.tipo, p.proveedor_id, p.bruto, p.comision, p.neto, p.moneda, p.concepto, p.concepto_id, p.estado, p.fel_estado],
    ['cobro', ev.id, 300, 15.5, 284.5, 'GTQ', 'gift_card', codigo, 'pagado', 'pendiente']);
  assert.strictEqual(avisos.enviados.length, 1);
  assert.strictEqual(avisos.enviados[0].enviar_a, 'destinatario');
  assert.match(avisos.enviados[0].svg, new RegExp(codigo));
  assert.strictEqual(fel.pedidas.length, 1, 'se llamó al gancho de la FEL');

  // el mismo mensaje otra vez (reintento de Svix) y el mismo pago con otro id de mensaje
  assert.deepStrictEqual(await S.procesarWebhook(cuerpo, cab), { status: 200, resultado: 'ya_procesado' });
  const otro = firmado(ev, { id: 'msg_2' });
  assert.deepStrictEqual(await S.procesarWebhook(otro.cuerpo, otro.cab), { status: 200, resultado: 'ya_procesado' });
  assert.strictEqual((await almacen.lista('gift_cards')).length, 1);
  assert.strictEqual((await almacen.lista('pagos_en_linea')).length, 1);
  assert.strictEqual((await almacen.lista('gift_cards_movimientos')).length, 1);
  assert.strictEqual(avisos.enviados.length, 1, 'un solo correo');
});

test('Firmas: se rechaza la mala, la vieja, la de otro secreto y el cuerpo cambiado, sin guardar nada', async () => {
  const { S, recurrente, almacen } = armar();
  await pedir(S);
  const ev = eventoPago(recurrente.checkouts[0], 30000);
  const bueno = firmado(ev, { id: 'msg_real' });
  const casos = [
    { cuerpo: Buffer.from(JSON.stringify(Object.assign({}, ev, { amount_in_cents: 1 }))), cab: bueno.cab },          // cuerpo cambiado
    { cuerpo: bueno.cuerpo, cab: Object.assign({}, bueno.cab, { 'svix-signature': 'v1,' + Buffer.alloc(32).toString('base64') }) },
    firmado(ev, { id: 'msg_real', secreto: 'whsec_' + Buffer.from('otro-secreto').toString('base64') }),
    firmado(ev, { id: 'msg_real', ts: Math.floor(HOY.getTime() / 1000) - 3600 }),                                   // de hace una hora
    { cuerpo: bueno.cuerpo, cab: { 'svix-id': 'msg_real' } },
    { cuerpo: bueno.cuerpo, cab: Object.assign({}, bueno.cab, { 'svix-signature': 'v2,' + bueno.cab['svix-signature'].slice(3) }) }
  ];
  for (const c of casos) {
    const r = await S.procesarWebhook(c.cuerpo, c.cab);
    assert.strictEqual(r.status, 401, r.resultado);
  }
  assert.strictEqual((await almacen.lista('pagos_webhooks')).length, 0, 'nada guardado: el id real sigue libre');
  assert.strictEqual((await almacen.lista('gift_cards')).length, 0);
  assert.strictEqual((await S.procesarWebhook(bueno.cuerpo, bueno.cab)).status, 200, 'el verdadero entra después');
  // varias firmas en la cabecera (rotación de secreto): alcanza con una buena
  const dos = firmado(ev, { id: 'msg_dos' });
  dos.cab['svix-signature'] = 'v1,' + Buffer.alloc(32).toString('base64') + ' ' + dos.cab['svix-signature'];
  assert.strictEqual(R.verificarFirmaSvix(R.SECRETO_PRUEBA, dos.cuerpo, dos.cab, Math.floor(HOY.getTime() / 1000)).ok, true);
});

test('Webhook: monto distinto no crea tarjeta; pago fallido; evento ajeno; error adentro no deja nada', async () => {
  const { S, recurrente, almacen } = armar();
  await pedir(S);
  const ch = recurrente.checkouts[0];
  let w = firmado(eventoPago(ch, 100), { id: 'm1' });
  let r = await S.procesarWebhook(w.cuerpo, w.cab);
  assert.match(r.resultado, /^revisar: monto distinto/);
  assert.strictEqual((await almacen.lista('gift_cards')).length, 0);
  assert.strictEqual((await almacen.lista('pagos_en_linea')).length, 1, 'el pago queda: la plata entró');
  assert.strictEqual((await almacen.lista('gift_cards_pedidos'))[0].estado, 'revisar');

  await pedir(S);
  const ch2 = recurrente.checkouts[1];
  w = firmado({ event_type: 'intent.failed', id: 'in_f', checkout: { id: ch2.id, metadata: ch2.metadata }, details: { failure_reason: 'tarjeta rechazada' } }, { id: 'm2' });
  r = await S.procesarWebhook(w.cuerpo, w.cab);
  assert.match(r.resultado, /fallido/);
  w = firmado({ event_type: 'intent.succeeded', id: 'in_x', amount_in_cents: 500, currency: 'GTQ', checkout: { id: 'ch_de_otra_cosa', metadata: {} } }, { id: 'm3' });
  assert.match((await S.procesarWebhook(w.cuerpo, w.cab)).resultado, /^ignorado/);
  w = firmado({ event_type: 'dispute.create' }, { id: 'm4' });
  assert.match((await S.procesarWebhook(w.cuerpo, w.cab)).resultado, /^ignorado: dispute.create/);

  // un pago sin id: error adentro → 500, nada escrito, Recurrente reintenta
  await pedir(S);
  const ch3 = recurrente.checkouts[2];
  const antes = (await almacen.lista('pagos_webhooks')).length;
  w = firmado(eventoPago(ch3, 30000, 'GTQ', { id: '' }), { id: 'm5' });
  r = await S.procesarWebhook(w.cuerpo, w.cab);
  assert.strictEqual(r.status, 500);
  assert.strictEqual((await almacen.lista('pagos_webhooks')).length, antes, 'el mensaje no quedó como procesado');
});

test('Webhook en US$: guarda tipo de cambio y bruto en quetzales; la tarjeta vale en Q', async () => {
  const { S, recurrente, almacen } = armar();
  await pedir(S, { valor_q: 500, moneda: 'USD' });
  const w = firmado(eventoPago(recurrente.checkouts[0], 6500, 'USD'), { id: 'mu' });
  await S.procesarWebhook(w.cuerpo, w.cab);
  const p = (await almacen.lista('pagos_en_linea'))[0], t = (await almacen.lista('gift_cards'))[0];
  assert.deepStrictEqual([p.moneda, p.bruto, p.tipo_cambio, p.bruto_q], ['USD', 65, 7.7, 500.5]);
  assert.deepStrictEqual([t.moneda, t.monto], ['GTQ', 500]);
});

test('Reembolso en Recurrente: fila nueva, cobro reembolsado y tarjeta anulada', async () => {
  const { S, recurrente, almacen } = armar();
  await pedir(S);
  const ev = eventoPago(recurrente.checkouts[0], 30000);
  let w = firmado(ev, { id: 'ma' });
  const codigo = (await S.procesarWebhook(w.cuerpo, w.cab)).resultado.replace('creada ', '');
  const rf = { event_type: 'refund.create', refund: { id: 're_1', status: 'succeeded', customer_refunded_amount_in_cents: 30000, account_refunded_amount_in_cents: 30000, currency: 'GTQ' }, intentable: { id: ev.id } };
  w = firmado(rf, { id: 'mb' });
  const r = await S.procesarWebhook(w.cuerpo, w.cab);
  assert.match(r.resultado, /reembolso total .* tarjeta anulada/);
  const pagos = await almacen.lista('pagos_en_linea');
  assert.deepStrictEqual(pagos.map((p) => [p.tipo, p.estado]), [['cobro', 'reembolsado'], ['reembolso', 'reembolso']]);
  assert.strictEqual(pagos[1].pago_original_id, pagos[0].id);
  const t = await S.buscar(juanma, codigo);
  assert.deepStrictEqual([t.estado, t.saldo, t.movimientos.pop().tipo], ['anulada', 0, 'anulacion']);
  w = firmado(rf, { id: 'mc' });
  assert.strictEqual((await S.procesarWebhook(w.cuerpo, w.cab)).resultado, 'ya_procesado');
});

test('Aviso: con fecha futura queda programado y sale con la tarea; si el correo falla se reintenta', async () => {
  const x = armar({ avisos: { falla: true } });
  await pedir(x.S, { enviar_el: '2026-11-20' });
  let w = firmado(eventoPago(x.recurrente.checkouts[0], 30000), { id: 'm1' });
  await x.S.procesarWebhook(w.cuerpo, w.cab);
  assert.strictEqual((await x.almacen.lista('gift_cards'))[0].aviso_estado, 'programado');
  await pedir(x.S);
  w = firmado(eventoPago(x.recurrente.checkouts[1], 30000), { id: 'm2' });
  assert.strictEqual((await x.S.procesarWebhook(w.cuerpo, w.cab)).status, 200, 'si el correo falla, la tarjeta igual queda');
  assert.strictEqual((await x.almacen.lista('gift_cards'))[1].aviso_estado, 'error');
  const avisos = AD.avisosDoble();
  const el20 = G.crearGiftcards({ almacen: x.almacen, matriz: M, pasarela: x.recurrente, avisos, ahora: () => new Date('2026-11-20T15:00:00Z') });
  assert.deepStrictEqual(await el20.enviarAvisosPendientes(), { enviados: 2, errores: 0, programados: 0 });
  assert.strictEqual(avisos.enviados.length, 2);
  assert.deepStrictEqual(await el20.enviarAvisosPendientes(), { enviados: 0, errores: 0, programados: 0 }, 'no se manda dos veces');
});

test('Imagen de la tarjeta: escapa lo que escribió el comprador', () => {
  const svg = G.tarjetaSvg({ codigo: 'RSNT-ABCD-2345', monto: 300, vence: '2027-11-10', destinatario_nombre: '<script>x</script>', mensaje: 'Hola "amor" & <b>' }, 'es');
  assert.doesNotMatch(svg, /<script>|<b>/);
  assert.match(svg, /RSNT-ABCD-2345/); assert.match(svg, /Q300/); assert.match(svg, /Vence el 2027-11-10/);
});

test('Recurrente detrás de la interfaz: sin llaves no sale, solo las llamadas permitidas, sk_live frenada', async () => {
  const llamadas = [];
  const fetchFalso = async (u, o) => { llamadas.push({ u, o }); return { ok: true, status: 201, json: async () => ({ id: 'ch_1', checkout_url: 'https://app.recurrente.com/x', status: 'pending' }) }; };
  const cobro = { concepto: 'gift_card', referencia: 'gc_x', descripcion: 'Gift card', moneda: 'GTQ', monto: 300, url_exito: 'https://x.test/ok', url_cancelar: 'https://x.test/no' };
  const sinLlaves = R.crearRecurrente({ fetch: fetchFalso });
  assert.strictEqual(sinLlaves.modo, 'apagado');
  await assert.rejects(sinLlaves.crearCobro(cobro), status(503));
  const prueba = R.crearRecurrente({ secretKey: 'sk_test_x', publicKey: 'pk_test_x', fetch: fetchFalso });
  assert.deepStrictEqual(await prueba.crearCobro(cobro), { id: 'ch_1', url: 'https://app.recurrente.com/x' });
  assert.strictEqual(llamadas[0].u, 'https://app.recurrente.com/api/checkouts');
  assert.strictEqual(llamadas[0].o.headers['X-SECRET-KEY'], 'sk_test_x');
  const body = JSON.parse(llamadas[0].o.body);
  assert.deepStrictEqual([body.items[0].amount_in_cents, body.items[0].currency, body.metadata.referencia], [30000, 'GTQ', 'gc_x']);
  await prueba.reembolsar({ pago_id: 'in_1', monto: 50 });
  assert.strictEqual(llamadas[1].u, 'https://app.recurrente.com/api/refunds');
  assert.deepStrictEqual(JSON.parse(llamadas[1].o.body), { intent_id: 'in_1', amount_in_cents: 5000 });
  assert.ok(llamadas[1].o.headers['Idempotency-Key']);
  await assert.rejects(prueba.preautorizar({}), status(501), 'Recurrente no documenta preautorizar');
  const vivo = R.crearRecurrente({ secretKey: 'sk_live_x', fetch: fetchFalso });
  await assert.rejects(vivo.crearCobro(cobro), (e) => e.status === 503 && /RECURRENTE_VIVO/.test(e.message));
  assert.strictEqual(llamadas.length, 2, 'ni sin llaves ni vivo-sin-permiso salen a la red');
  assert.strictEqual(prueba.verificarWebhook(Buffer.from('{}'), {}).ok, false, 'sin secreto de webhook no pasa nada');
});

// ---------------------------------------------------------------- rutas

test('Rutas: webhook con cuerpo crudo (json global con verify, o raw), canje con enlace, tareas con clave', async () => {
  const x = armar();
  const tokens = { 'tok-maco': maco, 'tok-juanma': juanma };
  const app = express();
  app.use(express.json({ limit: '200kb', verify: guardarCuerpoCrudo }));
  app.use(crearRutasGiftcards({ giftcards: x.S, pasarela: x.recurrente, almacen: x.almacen, matriz: M, claveTareas: 'clave-prueba', identificar: async (t) => tokens[t] || null }));
  const sinVerify = express();
  sinVerify.use(express.json());   // json global SIN verify: el webhook no puede verificar y no procesa
  sinVerify.use(crearRutasGiftcards({ giftcards: x.S, pasarela: x.recurrente, almacen: x.almacen, matriz: M, claveTareas: 'k' }));
  const srv = app.listen(0), srv2 = sinVerify.listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port, b2 = 'http://127.0.0.1:' + srv2.address().port;
  try {
    let r = await fetch(b + '/api/giftcards/precios');
    assert.deepStrictEqual((await r.json()).montos, [{ q: 300, usd: 39 }, { q: 500, usd: 65 }]);
    r = await fetch(b + '/api/giftcards/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valor_q: 300, moneda: 'GTQ', comprador: { nombre: 'A', email: 'a@prueba.test' }, destinatario: { nombre: 'B' } }) });
    assert.strictEqual(r.status, 200);
    const ev = eventoPago(x.recurrente.checkouts[0], 30000);
    const w = firmado(ev, { id: 'mr' });
    r = await fetch(b2 + '/api/pagos/webhook/recurrente', { method: 'POST', headers: w.cab, body: w.cuerpo });
    assert.strictEqual(r.status, 500, 'sin cuerpo crudo no se procesa');
    r = await fetch(b + '/api/pagos/webhook/recurrente', { method: 'POST', headers: Object.assign({}, w.cab, { 'svix-signature': 'v1,AAAA' }), body: w.cuerpo });
    assert.strictEqual(r.status, 401);
    r = await fetch(b + '/api/pagos/webhook/bac', { method: 'POST', headers: w.cab, body: w.cuerpo });
    assert.strictEqual(r.status, 404, 'solo responde el webhook de la pasarela elegida');
    r = await fetch(b + '/api/pagos/webhook/recurrente', { method: 'POST', headers: w.cab, body: w.cuerpo });
    const j = await r.json();
    assert.strictEqual(r.status, 200); assert.match(j.resultado, /^creada RSNT-/);
    const codigo = j.resultado.slice(7);
    r = await fetch(b + '/api/giftcards/buscar?codigo=' + codigo); assert.strictEqual(r.status, 401);
    r = await fetch(b + '/api/giftcards/canjear', { method: 'POST', headers: { 'x-rosanta-u': 'tok-maco', 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, monto: 75, donde: 'sala', referencia: 'Mesa 4' }) });
    assert.deepStrictEqual((await r.json()).saldo, 225);
    r = await fetch(b + '/api/giftcards/reporte?mes=2026-11', { headers: { 'x-rosanta-u': 'tok-maco' } }); assert.strictEqual(r.status, 403, 'el reporte es del dueño');
    r = await fetch(b + '/api/giftcards/reporte?mes=2026-11', { headers: { 'x-rosanta-u': 'tok-juanma' } });
    const rep = await r.json(); assert.deepStrictEqual([rep.totales.giftcards.vendido, rep.totales.giftcards.canjeado, rep.totales.giftcards.saldo_cierre], [300, 75, 225]);
    r = await fetch(b + '/tareas/giftcards-avisos', { method: 'POST' }); assert.strictEqual(r.status, 403);
    r = await fetch(b + '/tareas/giftcards-avisos', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave-prueba' } }); assert.strictEqual(r.status, 200);
    r = await fetch(b + '/giftcards'); assert.match(await r.text(), /canje en sala y caja/);
    r = await fetch(b + '/gift-cards/comprar?lang=en'); assert.strictEqual(r.status, 200);
  } finally { srv.close(); srv2.close(); }
});
