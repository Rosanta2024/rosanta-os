// Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/copia-hojas');
const { libros } = require('./fixtura');
const { comparar, resumen, diferencias, celdasConError } = require('../src/comparar-pagos');
const { crearApp } = require('../src/app');
const U = require('../src/usuarios');
const pantalla = require('../src/pantalla-pagos');

/** libros() del fixture con la llave de Config real (la que usa comparar). */
function librosReales(cambiar) {
  const L = libros();
  L[C.LIBROS.config.id] = L.CFG; delete L.CFG;
  if (cambiar) cambiar(L);
  return L;
}
/** Un cliente de Sheets de mentira: leerLibro pide spreadsheets.get y recibe estas pestañas. */
function sheetsDe(L) {
  const celda = (x) => (x instanceof Date ? { effectiveValue: { numberValue: (Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), x.getSeconds()) / 86400000) + 25569 }, effectiveFormat: { numberFormat: { type: 'DATE_TIME' } } }
    : x === '' ? {} : typeof x === 'number' ? { effectiveValue: { numberValue: x } } : typeof x === 'boolean' ? { effectiveValue: { boolValue: x } }
    : /^#(REF!|N\/A)$/.test(x) ? { effectiveValue: { errorValue: { type: x === '#REF!' ? 'REF' : 'N_A' } } } : { effectiveValue: { stringValue: x } });
  return { spreadsheets: { get: async (q) => {
    const src = L[q.spreadsheetId] || {};
    if (!q.includeGridData) return { data: { sheets: Object.keys(src).map((t) => ({ properties: { title: t } })) } };
    const nombres = q.ranges.map((r) => r.slice(1, -1).replace(/''/g, "'"));
    return { data: { sheets: nombres.filter((n) => src[n]).map((n) => ({ properties: { title: n }, data: [{ rowData: src[n].map((r) => ({ values: r.map(celda) })) }] })) } };
  } } };
}
/** Base de mentira: las fotos que se guardan y la tabla pagos_proveedores con las filas de PAGOS_PROVEEDORES de L. */
const poolFotos = (L) => {
  const fotos = [];
  const filas = L ? L[C.LIBROS.config.id].PAGOS_PROVEEDORES.slice(1) : [];
  return { fotos, query: async (sql, p) => {
    if (/INSERT INTO pagos_fotos/.test(sql)) fotos.push(p);
    if (/SELECT celdas FROM pagos_proveedores/.test(sql)) return { rows: filas.map((f) => ({ celdas: JSON.parse(JSON.stringify(C.codificar([f])[0])) })) };
    return { rows: [] };
  } };
};
const AHORA = new Date(2026, 9, 17, 23, 50);

test('Con la copia igual a las hojas: al dia, y los totales son los del recuadro de Pagos', async () => {
  const L = librosReales();
  const pool = poolFotos(L);
  const f = await comparar({ pool, sheets: sheetsDe(L), librosCopia: librosReales(), ahora: AHORA });
  assert.strictEqual(f.copia_al_dia, true, f.diferencias.join(' | '));
  assert.strictEqual(f.por_pagar_n, 3, 'las tres facturas vigentes (la anulada no)');
  assert.strictEqual(f.por_pagar_q, 1600);
  assert.strictEqual(pool.fotos.length, 1, 'la foto queda guardada');
});

test('Control negativo: una copia vieja (sin un pago nuevo) NO pasa como al dia', async () => {
  const L = librosReales((x) => x[C.LIBROS.config.id].PAGOS_PROVEEDORES.push(
    ['COCINA', 'VERDURAS DOÑA MINA', '1001', '', '2026-10-17', 500, 'Pagado de caja', '111', '', 'Jeffry', new Date(2026, 9, 17, 12), 'abc12345']));
  const f = await comparar({ pool: poolFotos(L), sheets: sheetsDe(L), librosCopia: librosReales(), ahora: AHORA });
  assert.strictEqual(f.copia_al_dia, false);
  assert.ok(f.diferencias.some((d) => /por_pagar_q: copia 1600 · hojas 1100/.test(d)), f.diferencias.join(' | '));
  assert.ok(f.diferencias.some((d) => /VERDURAS DOÑA MINA \(111\) pendiente/.test(d)));
});

test('Control negativo: si a la base le falta un pago de la hoja, NO esta al dia', async () => {
  const L = librosReales((x) => x[C.LIBROS.config.id].PAGOS_PROVEEDORES.push(
    ['COCINA', 'VERDURAS DOÑA MINA', '1001', '', '2026-10-17', 500, 'Pagado de caja', '111', '', 'Jeffry', new Date(2026, 9, 17, 12), 'abc12345']));
  const pool = poolFotos(librosReales());   // la base sin el pago nuevo
  const f = await comparar({ pool, sheets: sheetsDe(L), librosCopia: L, ahora: AHORA });
  assert.strictEqual(f.copia_al_dia, false);
  assert.ok(f.diferencias.some((d) => /Base: falta el pago abc12345/.test(d)), f.diferencias.join(' | '));
  assert.ok(f.diferencias.some((d) => /Pagos desde la base: por_pagar_q/.test(d)));
});

test('Las celdas con error del maestro se cuentan', async () => {
  const L = librosReales((x) => { x[C.LIBROS.maestro.id]['01_FEL_Maestro'][5][13] = '#REF!'; });
  const f = await comparar({ pool: poolFotos(L), sheets: sheetsDe(L), librosCopia: librosReales(), ahora: AHORA });
  assert.deepStrictEqual(f.celdas_error, { '01_FEL_Maestro': 1 });
  assert.deepStrictEqual(celdasConError({ x: { p: [['#N/A', 'ok', 3]] } }), { p: 1 });
});

test('resumen cuenta igual que el recuadro de ProfitPagosJs.html', () => {
  const r = resumen({ facturas: [{ saldo: 100, estado: 'Pendiente', fecha_pagar: '2026-10-17' }, { saldo: 0, estado: 'Banco por confirmar', fecha_pagar: '' },
    { saldo: 0, estado: 'Pagada' }, { saldo: 50.555, estado: 'Abonada', fecha_pagar: '2026-10-18' }], cuadre: [] }, '2026-10-17');
  assert.deepStrictEqual([r.por_pagar_n, r.por_pagar_q, r.vence_hoy], [3, 150.56, 1]);
  assert.deepStrictEqual(diferencias(r, JSON.parse(JSON.stringify(r))), []);
});

test('La tarea responde 409 si no coincide, y las fotos son solo del dueño', async () => {
  const usuarios = U.usuariosDeFilas([['c', 'r', 'm', 'e', 'n', 't'], ['d@x', 'Dueño', 'pagos', 'SI', 'Juanma', 'tok-d'], ['c@x', 'chef', 'pagos', 'NO', 'Jeffry', 'tok-c']]);
  const pool = { query: async (sql, p) => (/token_huella/.test(sql) ? { rows: usuarios.filter((u) => u.token_huella === p[0]) } : { rows: [{ cuando: '2026-10-17 23:50', por_pagar_n: 3 }] }) };
  let foto = { copia_al_dia: false, diferencias: ['x'], celdas_error: {} };
  const srv = crearApp({ pool, claveTareas: 'k', compararPagos: async () => foto, pantallaFotos: pantalla.armarFotos }).listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.strictEqual((await fetch(b + '/tareas/comparar-pagos', { method: 'POST' })).status, 403, 'sin clave no corre');
    assert.strictEqual((await fetch(b + '/tareas/comparar-pagos', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } })).status, 409);
    foto = { copia_al_dia: true, diferencias: [], celdas_error: {} };
    assert.strictEqual((await fetch(b + '/tareas/comparar-pagos', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } })).status, 200);
    assert.strictEqual((await fetch(b + '/api/fotos-pagos', { headers: { 'x-rosanta-u': 'tok-c' } })).status, 403, 'el chef no ve las fotos');
    const r = await fetch(b + '/api/fotos-pagos', { headers: { 'x-rosanta-u': 'tok-d' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).fotos.length, 1);
    assert.strictEqual((await fetch(b + '/pagos/fotos')).status, 200);
  } finally { srv.close(); }
});
