// Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/copia-hojas');
const { planificar, llave, tipadas } = require('../src/importar-pagos');
const { PAG_H } = require('./fixtura');

const fila = (id, estatus, q) => ['COCINA', 'VERDURAS', '1001', '', '2026-10-17', q || 500, estatus || 'Pagado de caja', 111, '', 'Jeffry', new Date(2026, 9, 17, 12), id];
const hoja = (...filas) => [PAG_H.slice()].concat(filas);
const base = (h, origen) => h.slice(1).map((f, i) => ({ id: llave(f[11]), celdas: C.codificar([f])[0], origen: origen || 'hoja', orden: i + 1 }));

test('La primera vez entra todo; la segunda, nada (no se duplica)', () => {
  const h = hoja(fila('a1'), fila('b2'), fila(630e50));
  const p1 = planificar(h, []);
  assert.deepStrictEqual(p1.nuevas.map((x) => x.id), ['a1', 'b2', String(630e50)], 'el ID que quedo como numero tambien entra, con llave estable');
  const p2 = planificar(h, base(h));
  assert.deepStrictEqual([p2.nuevas.length, p2.actualizadas.length, p2.problemas.length], [0, 0, 0]);
});

test('Lo que Caja o Compras agregan en la hoja entra como nuevo', () => {
  const antes = hoja(fila('a1'));
  const despues = hoja(fila('a1'), fila('c9', 'Retiro de cajero', 85));
  const p = planificar(despues, base(antes));
  assert.deepStrictEqual(p.nuevas.map((x) => x.id), ['c9']);
});

test('Un ANULADO en la hoja actualiza la fila de la hoja', () => {
  const antes = hoja(fila('a1'));
  const p = planificar(hoja(fila('a1', 'ANULADO: Pagado de caja (Jeffry, 2026-10-18)')), base(antes));
  assert.deepStrictEqual(p.actualizadas.map((x) => x.id), ['a1']);
  assert.deepStrictEqual(p.problemas, []);
});

test('Un pago guardado en el servidor nunca se pisa desde la hoja: se avisa', () => {
  const p = planificar(hoja(fila('s1', 'Tarjeta', 999)), base(hoja(fila('s1', 'Tarjeta', 500)), 'servidor'));
  assert.strictEqual(p.actualizadas.length, 0);
  assert.match(p.problemas[0], /Conflicto en s1/);
});

test('Nada se pierde sin aviso: fila sin ID, ID repetido, o pago que falta en la hoja', () => {
  const p = planificar(hoja(fila(''), fila('d1'), fila('d1', 'Banco')), base(hoja(fila('zz'))));
  assert.ok(p.problemas.some((x) => /Fila 2 de la hoja sin ID/.test(x)));
  assert.ok(p.problemas.some((x) => /ID d1 repetido/.test(x)));
  assert.ok(p.problemas.some((x) => /zz esta en la base y ya no en la hoja/.test(x)));
  assert.deepStrictEqual(p.nuevas.map((x) => x.id), ['d1'], 'del repetido entra solo el primero');
});

test('Ordenar la hoja no cuenta como cambio de un pago', () => {
  const h = hoja(fila('a1'), fila('b2'));
  const p = planificar(hoja(fila('b2'), fila('a1')), base(h));
  assert.deepStrictEqual([p.nuevas.length, p.actualizadas.length, p.problemas.length], [0, 0, 0]);
  assert.deepStrictEqual(p.reordenar.map((x) => x.id).sort(), ['a1', 'b2']);
});

test('Las columnas con tipo salen bien de la fila', () => {
  const t = tipadas(PAG_H, fila('a1'));
  assert.deepStrictEqual(t.slice(0, 10), ['COCINA', 'VERDURAS', '1001', null, '2026-10-17', 500, 'Pagado de caja', '111', '', 'Jeffry']);
});
