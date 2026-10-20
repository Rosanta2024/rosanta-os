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
const { conciliarPagosLinea } = require('../src/conciliar-pagos-linea');
const { crearRutasGiftcards, guardarCuerpoCrudo } = require('../src/rutas-web');

const M = PW.conPropuesta(P.cargarDeMigracion());
const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño' };
const maco = { email: 'maco@prueba.test', rol: 'sala' };
const status = (n) => (e) => e.status === n;
const nadaSaleALaRed = async () => { throw new Error('salió a la red'); };

test('La interfaz es la misma para ninguna, Recurrente, BAC y NeoNet', () => {
  const todas = PA.PROVEEDORES.map((p) => PA.crearPasarela({ PASARELA: p }, { fetch: nadaSaleALaRed }));
  const forma = (x) => ({ metodos: PA.METODOS.map((m) => typeof x[m]), caps: Object.keys(x.capacidades).sort(), campos: ['proveedor', 'encendido', 'modo'].map((k) => k in x) });
  todas.forEach((x) => assert.deepStrictEqual(forma(x), forma(todas[1]), x.proveedor));
  assert.deepStrictEqual(todas.map((x) => x.proveedor), ['ninguna', 'recurrente', 'bac', 'neonet']);
  assert.ok(todas.every((x) => x.encendido === false), 'hoy ninguna cobra: Recurrente sin llaves, BAC y NeoNet sin integrar');
  PA.METODOS.forEach((m) => assert.strictEqual(typeof R.recurrenteDoble()[m], 'function', 'el doble de pruebas también: ' + m));
});

test('Por defecto PASARELA=ninguna; un valor desconocido no arranca', () => {
  assert.strictEqual(PA.crearPasarela({}).proveedor, 'ninguna');
  assert.strictEqual(PA.crearPasarela({ PASARELA: ' BAC ' }).proveedor, 'bac');
  assert.throws(() => PA.crearPasarela({ PASARELA: 'stripe' }), /PASARELA desconocida/);
});

test('Sin pasarela no se puede cobrar, ni reembolsar, ni preautorizar; BAC y NeoNet dicen "no configurado"', async () => {
  const cobro = { concepto: 'gift_card', referencia: 'x', descripcion: 'x', moneda: 'GTQ', monto: 300 };
  for (const p of PA.PROVEEDORES) {
    const x = PA.crearPasarela({ PASARELA: p }, { fetch: nadaSaleALaRed });
    for (const m of ['crearCobro', 'crearLink', 'reembolsar', 'preautorizar', 'capturar', 'liberar']) {
      await assert.rejects(x[m](cobro), (e) => e.status >= 500 && e.status < 600, p + '.' + m);
    }
    assert.strictEqual(x.verificarWebhook(Buffer.from('{}'), {}).ok, false);
  }
  await assert.rejects(PA.crearPasarela({ PASARELA: 'bac' }).crearCobro(cobro), /BAC Credomatic no está configurado/);
  await assert.rejects(PA.crearPasarela({ PASARELA: 'neonet' }).crearCobro(cobro), /NeoNet no está configurado/);
  await assert.rejects(PA.crearPasarela({}).crearCobro(cobro), /Todavía no se cobra en línea/);
});

test('Con PASARELA=ninguna: la compra dice "escríbenos"; emitir por depósito, canjear y el reporte siguen', async () => {
  const almacen = A.crearAlmacenMemoria();
  const S = G.crearGiftcards({ almacen, matriz: M, pasarela: PA.crearPasarela({}), avisos: AD.avisosDoble(), contacto: { correo: 'giftcards@prueba.test', whatsapp: '+502 0000 0000' } });
  const p = await S.precios();
  assert.strictEqual(p.cobro_en_linea, false);
  assert.deepStrictEqual(p.contacto, { correo: 'giftcards@prueba.test', whatsapp: '+502 0000 0000' });
  assert.deepStrictEqual(p.montos.map((m) => m.q), [300, 500]);
  assert.strictEqual(p.minimo_q, 200); assert.strictEqual(p.vigencia_meses, 12);
  const pedido = { valor_q: 300, moneda: 'GTQ', comprador: { nombre: 'A', email: 'a@prueba.test' }, destinatario: { nombre: 'B' } };
  await assert.rejects(S.crearPedido(pedido), (e) => e.status === 503 && /Escríbenos/.test(e.message));
  await assert.rejects(S.crearPedido(Object.assign({ idioma: 'en' }, pedido)), (e) => e.status === 503 && /Write to us/.test(e.message));
  assert.strictEqual((await almacen.lista('gift_cards_pedidos')).length, 0, 'no queda ni un pedido');
  assert.strictEqual((await S.procesarWebhook(Buffer.from('{}'), {})).status, 404);
  // lo de siempre funciona
  const t = await S.emitirManual(juanma, { valor_q: 500, referencia: 'BI 1234', comprador_nombre: 'A', destinatario_nombre: 'B' });
  assert.strictEqual((await S.canjear(maco, t.codigo, 200, { donde: 'caja', referencia: 'Cuenta 5' })).saldo, 300);
  await assert.rejects(S.emitirManual(maco, { valor_q: 300, referencia: 'x', comprador_nombre: 'A', destinatario_nombre: 'B' }), status(403), 'emitir: solo el dueño');
  await assert.rejects(S.anular(maco, t.codigo, 'x'), status(403), 'anular: solo el dueño');
  const mes = G.hoyGT().slice(0, 7);
  const rep = await conciliarPagosLinea({ almacen, mes });
  assert.deepStrictEqual([rep.totales.giftcards.vendido, rep.totales.giftcards.canjeado, rep.totales.giftcards.saldo_cierre], [500, 200, 300]);
});

test('Rutas con PASARELA=ninguna: el pedido responde 503, ningún webhook existe, liquidaciones no aplican', async () => {
  const almacen = A.crearAlmacenMemoria();
  const pasarela = PA.crearPasarela({});
  const S = G.crearGiftcards({ almacen, matriz: M, pasarela, avisos: AD.avisosDoble() });
  const app = express();
  app.use(express.json({ verify: guardarCuerpoCrudo }));
  app.use(crearRutasGiftcards({ giftcards: S, pasarela, almacen, matriz: M, claveTareas: 'k', identificar: async (t) => ({ d: juanma })[t] || null }));
  const srv = app.listen(0), b = 'http://127.0.0.1:' + srv.address().port;
  try {
    let r = await fetch(b + '/api/giftcards/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valor_q: 300, moneda: 'GTQ' }) });
    assert.strictEqual(r.status, 503);
    for (const p of ['recurrente', 'bac', 'neonet', 'ninguna']) {
      r = await fetch(b + '/api/pagos/webhook/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.strictEqual(r.status, 404, p);
    }
    r = await fetch(b + '/api/pagos-linea/liquidaciones', { method: 'POST', headers: { 'x-rosanta-u': 'd', 'Content-Type': 'application/json' }, body: JSON.stringify({ referencia: 'x', fecha: '2026-11-01', monto: 1, moneda: 'GTQ' }) });
    assert.strictEqual(r.status, 409);
    r = await fetch(b + '/api/giftcards/precios');
    assert.strictEqual((await r.json()).cobro_en_linea, false);
  } finally { srv.close(); }
});
