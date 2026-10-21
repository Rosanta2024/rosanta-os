// Conciliacion del cierre de mes y base = hoja de caja (19-oct-2026). Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const { mesQueToca, totalMes, diasDelMes } = require('../src/conciliar');
const B = require('../src/base-vs-hoja');
const C = require('../src/copia-hojas');
const { libros } = require('./fixtura');

test('El mes que toca: del 28 en adelante el mes en curso; antes, el anterior (y enero → diciembre)', () => {
  assert.strictEqual(mesQueToca(new Date(2026, 9, 31, 23, 55)), '2026-10');
  assert.strictEqual(mesQueToca(new Date(2026, 10, 1, 7, 0)), '2026-10');
  assert.strictEqual(mesQueToca(new Date(2027, 0, 1, 7, 0)), '2026-12');
});

test('Totales del mes: sin anuladas, por grupo, con fechas como fecha o como texto', () => {
  const M = [['FECHA', 'TIPO', 'MONTO', 'ESTATUS'],
    [new Date(2026, 9, 30), 'SALIDA', 40, ''], ['2026-10-31', 'SALIDA', 10.5, ''], [new Date(2026, 9, 31), 'ENTRADA', 100, ''],
    [new Date(2026, 9, 31), 'SALIDA', 999, 'ANULADO'], [new Date(2026, 10, 1), 'SALIDA', 5, '']];
  const t = totalMes(M, '2026-10', 'FECHA', 'MONTO', 'ESTATUS', 'TIPO');
  assert.deepStrictEqual(t, { n: 3, q: 150.5, por: { SALIDA: { n: 2, q: 50.5 }, ENTRADA: { n: 1, q: 100 } } });
  assert.deepStrictEqual(totalMes(undefined, '2026-10', 'FECHA', 'MONTO'), { n: 0, q: 0, por: {} });
});

test('Días del mes: hasta ayer; un mes pasado, completo', () => {
  assert.deepStrictEqual(diasDelMes('2026-10', '2026-10-03'), ['2026-10-01', '2026-10-02']);
  assert.strictEqual(diasDelMes('2026-10', '2026-11-01').length, 31);
  assert.strictEqual(diasDelMes('2027-02', '2027-03-01').length, 28);
});

test('07_Caja_Chica: falta, sobra, distinta; hoy no cuenta (el vigia va una hora atras)', () => {
  const esp = [['2026-10-20', 'Mercado', 50, '', 'COMPRAS_COCINA', 'No', 'Pagos', 'P1'], ['2026-10-21', 'Hielo', 40, '', 'GASTOS_VARIOS', 'No', 'Caja chica', 'C1'],
    ['2026-10-22', 'Foco', 22, '', 'MANTENIMIENTO', 'No', 'Caja chica', 'C2'], ['2026-10-23', 'Hoy', 9, '', 'GASTOS_VARIOS', 'No', 'Caja chica', 'C3']];
  assert.deepStrictEqual(B.comparar07(esp, esp.slice(0, 3), '2026-10-23'), []);
  const hoja = [esp[0], ['2026-10-21', 'Hielo', 45, '', 'GASTOS_VARIOS', 'No', 'Caja chica', 'C1'], ['2026-10-19', 'Viejo', 3, '', 'X', 'No', 'Caja chica', 'C9']];
  const d = B.comparar07(esp, hoja, '2026-10-23');
  assert.strictEqual(d.length, 3);
  assert.match(d.join('\n'), /falta 2026-10-22 Foco/);
  assert.match(d.join('\n'), /C1 dice 2026-10-21 Q45 .* debería 2026-10-21 Q40/);
  assert.match(d.join('\n'), /sobra 2026-10-19 Viejo/);
  assert.deepStrictEqual(B.comparar07(esp, null, '2026-10-23'), ['07_Caja_Chica: no está en el maestro']);
});

test('07_Caja_Chica de la hoja: desde la fila 5, fechas a AAAA-MM-DD, sin filas vacías', () => {
  const L = { [C.LIBROS.maestro.id]: { '07_Caja_Chica': [['CAJA CHICA'], ['nota'], ['Arranque'], ['Fecha', 'Descripción', 'Monto'],
    [new Date(2026, 9, 20, 12), 'Mercado', 50, '', 'COMPRAS_COCINA', 'No', 'Pagos', 'P1'], ['', '', '', '', '', '', '', '']] } };
  assert.deepStrictEqual(B.filas07Hoja(L), [['2026-10-20', 'Mercado', 50, '', 'COMPRAS_COCINA', 'No', 'Pagos', 'P1']]);
});

test('07_Caja_Chica esperada: corre el codigo real de la intranet (cchFilasMaestro_) sobre los libros', () => {
  const L = libros();
  const cfg = L.CFG; delete L.CFG; L[C.LIBROS.config.id] = cfg;
  const filas = B.filas07Esperadas(L);
  assert.ok(Array.isArray(filas));
  filas.forEach((f) => { assert.match(String(f[0]), /^\d{4}-\d{2}-\d{2}$/); assert.strictEqual(f.length, 8); });
});

test('/tareas/conciliar-mes: pide la clave, valida el mes y responde 409 con diferencias', async () => {
  const { crearApp } = require('../src/app');
  const pedidos = [];
  const conciliarMes = async (mes) => { pedidos.push(mes); return mes === '2026-09' ? { mes, ok: false, diferencias: ['x'] } : { mes: mes || '2026-10', ok: true, diferencias: [] }; };
  const srv = crearApp({ pool: { query: async () => ({ rows: [] }) }, claveTareas: 'k', conciliarMes }).listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port, H = { 'Content-Type': 'application/json', 'x-rosanta-tarea': 'k' };
  try {
    assert.strictEqual((await fetch(b + '/tareas/conciliar-mes', { method: 'POST' })).status, 403);
    assert.strictEqual((await fetch(b + '/tareas/conciliar-mes', { method: 'POST', headers: H, body: '{"mes":"oct"}' })).status, 400);
    assert.strictEqual((await fetch(b + '/tareas/conciliar-mes', { method: 'POST', headers: H, body: '{}' })).status, 200);
    assert.strictEqual((await fetch(b + '/tareas/conciliar-mes', { method: 'POST', headers: H, body: '{"mes":"2026-09"}' })).status, 409);
    assert.deepStrictEqual(pedidos, [undefined, '2026-09']);
  } finally { srv.close(); }
});

test('07_Caja_Chica: un ID de solo numeros que Sheets volvio numero (sin el cero) es la misma fila', () => {
  const esp = [['2026-10-16', 'Extra Yhonathan', 100, '', 'NOMINA', 'No', 'Caja chica', '08230445']];
  assert.deepStrictEqual(B.comparar07(esp, [['2026-10-16', 'Extra Yhonathan', 100, '', 'NOMINA', 'No', 'Caja chica', 8230445]], '2026-10-19'), []);
  assert.strictEqual(B.comparar07(esp, [['2026-10-16', 'Extra Yhonathan', 100, '', 'NOMINA', 'No', 'Caja chica', 8230446]], '2026-10-19').length, 2);
});

test('FEL_CORREO y BANCO_CORREO se comparan solo cuando ya estan en la base (antes de "nube" no hay filas)', async () => {
  const H = [['MENSAJE_ID', 'X'], ['m1', 'a']];
  const pool = (filas) => ({ query: async (sql, p) => ({ rows: p[0] === 'FEL_CORREO' ? filas : [] }) });
  const fresco = { [C.LIBROS.config.id]: { FEL_CORREO: H } };
  assert.deepStrictEqual(await B.compararVivas(pool([]), fresco), [], 'sin filas en la base: no se compara');
  const d = await B.compararVivas(pool([{ id: 'm9', celdas: [{ $t: 'm9' }, 'z'] }]), fresco);
  assert.ok(d.some((x) => /FEL_CORREO/.test(x)), 'con filas: si se compara (' + d.join(' | ') + ')');
});
