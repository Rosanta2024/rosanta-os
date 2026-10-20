const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/almacen-web');
const K = require('../src/conciliar-pagos-linea');
const pantallas = require('../src/pantallas-web');

// Datos inventados.
const mov = (id, tarjeta, cuando, tipo, monto, antes, despues) => ({ id, gift_card_id: tarjeta, cuando, tipo, monto, saldo_antes: antes, saldo_despues: despues });
const tarjeta = (id, codigo, saldo, estado, vence, origen) => ({ id, codigo, saldo, estado: estado || 'activa', vence: vence || '2027-10-01', origen: origen || 'web', monto: 500 });

test('Reporte mensual de gift cards: vendido, canjeado, anulado, vencido y saldo vivo (pasivo)', () => {
  const movs = [
    mov(1, 1, '2026-10-05T18:00:00Z', 'venta', 500, 0, 500),
    mov(2, 1, '2026-10-20T02:00:00Z', 'canje', 100, 500, 400),
    mov(3, 2, '2026-11-01T05:59:00Z', 'venta', 300, 0, 300),      // 31-oct 23:59 en Guatemala: es de octubre
    mov(4, 1, '2026-11-03T20:00:00Z', 'canje', 150, 400, 250),
    mov(5, 1, '2026-11-04T20:00:00Z', 'reverso_canje', 150, 250, 400),
    mov(6, 2, '2026-11-10T20:00:00Z', 'anulacion', 300, 300, 0),
    mov(7, 3, '2026-11-12T20:00:00Z', 'venta', 200, 0, 200),
    mov(8, 3, '2026-12-02T20:00:00Z', 'canje', 50, 200, 150)
  ];
  const tarjetas = [tarjeta(1, 'RSNT-AAAA-2222', 400), tarjeta(2, 'RSNT-BBBB-3333', 0, 'anulada'), tarjeta(3, 'RSNT-CCCC-4444', 150, 'activa', '2026-12-20', 'intranet')];
  const oct = K.reporteGiftcards(movs, tarjetas, '2026-10');
  assert.deepStrictEqual([oct.saldo_inicio, oct.vendido, oct.canjeado, oct.saldo_cierre, oct.n_vendidas], [0, 800, 100, 700, 2]);
  const nov = K.reporteGiftcards(movs, tarjetas, '2026-11');
  assert.deepStrictEqual([nov.saldo_inicio, nov.vendido, nov.canjeado, nov.anulado, nov.vencido, nov.saldo_cierre], [700, 200, 0, 300, 0, 600]);
  assert.deepStrictEqual(nov.por_origen, { intranet: 200 });
  assert.strictEqual(nov.por_vencer_60d, 150);
  assert.deepStrictEqual(nov.diferencias, []);
  // un saldo guardado que no coincide con sus movimientos salta
  const mal = K.reporteGiftcards(movs, [tarjeta(1, 'RSNT-AAAA-2222', 999)].concat(tarjetas.slice(1)), '2026-11');
  assert.ok(mal.diferencias.some((d) => /RSNT-AAAA-2222/.test(d)));
});

async function conPagos() {
  const al = A.crearAlmacenMemoria();
  const pago = (id, fecha, bruto, comision, tipo, moneda) => al.insertar('pagos_en_linea', { proveedor: 'recurrente', tipo: tipo || 'cobro', proveedor_id: 'in_' + id, fecha, moneda: moneda || 'GTQ',
    bruto, comision, neto: A.r2(bruto - comision), bruto_q: bruto, concepto: 'gift_card', concepto_id: 'RSNT-AAAA-2222', estado: tipo === 'reembolso' ? 'reembolso' : 'pagado', crudo: {} });
  await pago(1, '2026-11-02T15:00:00Z', 300, 15.5);    // neto 284.50
  await pago(2, '2026-11-02T18:00:00Z', 500, 24.5);    // neto 475.50
  await pago(3, '2026-11-05T15:00:00Z', 300, 15.5);    // neto 284.50
  return al;
}

test('Liquidación: se asignan los pagos por fecha y monto, cuadra con el banco del maestro, y se guarda', async () => {
  const al = await conPagos();
  await al.insertar('pagos_liquidaciones', { proveedor: 'recurrente', referencia: 'wd_1', fecha: '2026-11-03', monto: 760, moneda: 'GTQ' });
  await al.insertar('pagos_liquidaciones', { proveedor: 'recurrente', referencia: 'wd_2', fecha: '2026-11-06', monto: 284.5, moneda: 'GTQ' });
  const depositos = [{ banco: 'BI', fecha: '2026-11-04', monto: 760, ref: 'BI|2026-11-04|1|760' }, { banco: 'BI', fecha: '2026-11-06', monto: 284.5, ref: 'BI|2026-11-06|2|284.5' }];
  const r = await K.conciliarPagosLinea({ almacen: al, mes: '2026-11', depositos, guardar: true });
  assert.deepStrictEqual(r.diferencias, []);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.totales.pagos.GTQ, { bruto: 1100, comision: 55.5, otros: 0, neto: 1044.5, reembolsos: 0, n: 3 });
  const pagos = await al.lista('pagos_en_linea');
  assert.deepStrictEqual(pagos.map((p) => p.liquidacion_id), [1, 1, 2]);
  const liqs = await al.lista('pagos_liquidaciones');
  assert.deepStrictEqual(liqs.map((l) => [l.estado, l.banco]), [['cuadra', 'BI'], ['cuadra', 'BI']]);
  // la segunda vez ya estan asignados y sigue cuadrando
  assert.strictEqual((await K.conciliarPagosLinea({ almacen: al, mes: '2026-11', depositos })).ok, true, 'los mismos depósitos otra vez (no se marcan)');
});

test('Liquidación que no cuadra, depósito que no está en el banco y depósito sin liquidación', async () => {
  const al = await conPagos();
  await al.insertar('pagos_liquidaciones', { proveedor: 'recurrente', referencia: 'wd_9', fecha: '2026-11-03', monto: 750, moneda: 'GTQ' });
  const r = await K.conciliarPagosLinea({ almacen: al, mes: '2026-11', depositos: [{ banco: 'BAC', fecha: '2026-11-20', monto: 99, ref: 'x' }], guardar: true });
  assert.strictEqual(r.ok, false);
  assert.ok(r.diferencias.some((d) => /wd_9.*pagos suman 0/.test(d)), 'ningún corte de pagos da 750');
  assert.ok(r.diferencias.some((d) => /no aparece en el banco/.test(d)));
  assert.ok(r.diferencias.some((d) => /BAC del 2026-11-20 por 99 sin liquidación/.test(d)));
  assert.strictEqual((await al.lista('pagos_liquidaciones'))[0].estado, 'diferencia');
  // con pagos asignados a mano y un reembolso que resta
  const l = await al.insertar('pagos_liquidaciones', { proveedor: 'recurrente', referencia: 'wd_10', fecha: '2026-11-07', monto: 475.5, moneda: 'GTQ' });
  const pagos = await al.lista('pagos_en_linea');
  await al.actualizar('pagos_en_linea', pagos[0].id, { liquidacion_id: l.id });
  await al.actualizar('pagos_en_linea', pagos[1].id, { liquidacion_id: l.id });
  const re = await al.insertar('pagos_en_linea', { proveedor: 'recurrente', tipo: 'reembolso', proveedor_id: 're_1', fecha: '2026-11-06T15:00:00Z', moneda: 'GTQ', bruto: 284.5, neto: 284.5, bruto_q: 284.5, concepto: 'gift_card', estado: 'reembolso', liquidacion_id: l.id, crudo: {} });
  assert.ok(re.id);
  const c = K.cuadrarLiquidacion(l, await al.lista('pagos_en_linea'));
  assert.deepStrictEqual([c.ok, c.suma, c.n], [true, 475.5, 3]);
});

test('Proponer asignación: los más viejos de la misma moneda hasta dar exacto, o nada', () => {
  const p = (id, fecha, neto, moneda) => ({ id, fecha, neto, moneda: moneda || 'GTQ', tipo: 'cobro', liquidacion_id: null });
  const pagos = [p(1, '2026-11-01T15:00:00Z', 100), p(2, '2026-11-01T16:00:00Z', 50, 'USD'), p(3, '2026-11-02T15:00:00Z', 200), p(4, '2026-11-09T15:00:00Z', 10)];
  assert.deepStrictEqual(K.proponerAsignacion({ fecha: '2026-11-03', monto: 300, moneda: 'GTQ' }, pagos), [1, 3]);
  assert.strictEqual(K.proponerAsignacion({ fecha: '2026-11-03', monto: 250, moneda: 'GTQ' }, pagos), null);
  assert.deepStrictEqual(K.proponerAsignacion({ fecha: '2026-11-03', monto: 50, moneda: 'USD' }, pagos), [2]);
  assert.strictEqual(K.proponerAsignacion({ fecha: '2026-11-03', monto: 310, moneda: 'GTQ' }, pagos), null, 'el del 9 es posterior al depósito');
});

test('Depósitos de Recurrente desde el banco del maestro (BI y BAC, encabezado en la fila 4)', () => {
  const pre = [['Rosanta'], [''], ['']];
  const libro = {
    '03_Banco_Industrial': pre.concat([['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo'],
      [new Date(2026, 10, 4), '111', 'CREDITO RECURRENTE SA', 0, 760, 1], [new Date(2026, 10, 4), '112', 'DEPOSITO', 0, 50, 1], ['2026-11-05', '113', 'RECURRENTE', 10, 0, 1]]),
    '04_Banco_BAC': pre.concat([['Fecha', 'Referencia', 'Codigo', 'Descripción', 'Débito', 'Crédito', 'Balance'], ['2026-11-06', 'R9', 'C', 'Transferencia Recurrente', 0, 284.5, 0]])
  };
  const d = K.depositosRecurrenteDelMaestro(libro);
  assert.deepStrictEqual(d.map((x) => [x.banco, x.fecha, x.monto]), [['BI', '2026-11-04', 760], ['BAC', '2026-11-06', 284.5]]);
  assert.deepStrictEqual(K.depositosRecurrenteDelMaestro({}), []);
});

test('Límites del mes en hora de Guatemala', () => {
  assert.deepStrictEqual(K.limitesMes('2026-12'), { desde: '2026-12-01T06:00:00.000Z', hasta: '2027-01-01T06:00:00.000Z', siguiente: '2027-01' });
  assert.throws(() => K.limitesMes('2026-13x'));
});

test('Las pantallas tienen JS válido y no traen datos de nadie', () => {
  for (const [nombre, f] of Object.entries(pantallas)) {
    const h = f();
    assert.match(h, /^<!doctype html>/, nombre);
    const scripts = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length, nombre + ' sin script');
    scripts.forEach((s) => assert.doesNotThrow(() => new Function(s), nombre));   // eslint-disable-line no-new-func
    assert.doesNotMatch(h, /@gmail|@rosanta\.rest/, nombre);
  }
  assert.doesNotMatch(pantallas.compraGiftcard(), /noindex/, 'la compra es pública');
  assert.match(pantallas.contenidoWeb(), /noindex/);
});
