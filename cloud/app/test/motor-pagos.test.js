// Corre con TZ=America/Guatemala (lo pone sellar-nube.py y Cloud Run).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { crearMotor, formatDate } = require('../src/motor-pagos');
const C = require('../src/copia-hojas');

const { MAESTRO, libros } = require('./fixtura');
const motor = () => crearMotor({ libros: libros(), configId: 'CFG', editables: { CFG: ['PAGOS_PROVEEDORES'] } });
const CHEF = { email: 'chef@x', rol: 'chef', modulos: ['pagos'], nombre: 'Jeffry' };
const SALA = { email: 'sala@x', rol: 'sala', modulos: ['pagos'], nombre: 'Maco' };
const DUENO = { email: 'd@x', rol: 'dueno', modulos: ['finanzas'], nombre: 'Juanma' };

test('El motor usa los mismos archivos que la intranet (copias exactas)', () => {
  const dir = path.join(__dirname, '..', 'intranet');
  const origen = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-intranet');
  const lista = ['LISTA.txt', 'LISTA-VISTAS.txt'].map((l) => fs.readFileSync(path.join(dir, l), 'utf8')).join('\n').split('\n').filter(Boolean);
  assert.ok(lista.includes('PagosProveedores.js') && lista.length >= 9, 'la lista trae Pagos y sus dependencias');
  const distintos = lista.filter((f) => fs.readFileSync(path.join(dir, f), 'utf8') !== fs.readFileSync(path.join(origen, f), 'utf8'));
  assert.deepStrictEqual(distintos, [], 'correr cloud/herramientas/traer-intranet.sh');
});

test('Cada area ve lo suyo, igual que en la intranet', () => {
  const M = motor();
  const ch = M.correr(CHEF, 'getPagosProveedores', []).resultado;
  const sa = M.correr(SALA, 'getPagosProveedores', []).resultado;
  const du = M.correr(DUENO, 'getPagosProveedores', []).resultado;
  assert.deepStrictEqual(ch.facturas.map((f) => f.dte).sort(), ['1001', '1002']);
  assert.deepStrictEqual(sa.facturas.map((f) => f.dte), ['2001'], 'la anulada no aparece');
  assert.strictEqual(du.facturas.length, 3, 'el dueño ve todo aunque no tenga el modulo');
  assert.throws(() => M.correr({ email: 'x', rol: 'chef', modulos: ['recetario'], nombre: 'X' }, 'getPagosProveedores', []), /no tiene pagos/);
  assert.throws(() => M.correr(null, 'getPagosProveedores', []), /identificarte/);
});

test('Un pago se anota en PAGOS_PROVEEDORES y vuelve por el camino rapido', () => {
  const M = motor();
  const r = M.correr(CHEF, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-17', null, 0, 'prueba']);
  assert.match(r.resultado.resumen, /^Pago guardado: Q500\.00 a VERDURAS DOÑA MINA$/);
  assert.deepStrictEqual(r.escrituras, { 'CFG|PAGOS_PROVEEDORES': [2] }, 'una sola fila nueva, en la pestaña de pagos');
  const f = r.resultado.facturas.find((x) => x.dte === '1001');
  assert.strictEqual(f.estado, 'Pagada');
  // Lo leido es por llamada: la siguiente pantalla ya trae el pago
  const p = M.correr(CHEF, 'getPagosProveedores', []).resultado;
  assert.strictEqual(p.facturas.find((x) => x.dte === '1001').estado, 'Pagada');
  assert.strictEqual(p.facturas.find((x) => x.dte === '1002').estado, 'Pendiente');
});

test('Las reglas de la intranet siguen mandando (Maco no paga cocina)', () => {
  const M = motor();
  assert.throws(() => M.correr(SALA, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-17']), /es de COCINA/);
});

test('Lo que no es PAGOS_PROVEEDORES es de solo lectura en el servidor nuevo', () => {
  const M = motor();
  const ss = M.ctx.SpreadsheetApp.openById(MAESTRO);
  assert.throws(() => ss.getSheetByName('01_FEL_Maestro').getRange(5, 14).setValue('X'), /solo lectura/);
});

test('Fechas: formatDate en hora de Guatemala y serie de Sheets → fecha local', () => {
  assert.strictEqual(formatDate(new Date(Date.UTC(2026, 9, 17, 5, 30)), 'America/Guatemala', 'dd/MM/yyyy HH:mm'), '16/10/2026 23:30');
  assert.strictEqual(formatDate(new Date(2026, 0, 2), 'America/Guatemala', 'yyyy-MM-dd'), '2026-01-02');
  const d = C.fechaDeSerie(46312.5);   // 17-oct-2026 12:00 en la hoja
  assert.deepStrictEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 9, 17, 12]);
  assert.strictEqual(C.valorCelda({ effectiveValue: { numberValue: 46312 }, effectiveFormat: { numberFormat: { type: 'DATE' } } }).getDate(), 17);
  assert.strictEqual(C.valorCelda({ effectiveValue: { numberValue: 46312 } }), 46312, 'un numero sin formato de fecha sigue siendo numero');
  assert.strictEqual(C.valorCelda({ effectiveValue: { stringValue: '2026-10-17' } }), '2026-10-17', 'una fecha escrita como texto sigue siendo texto');
  assert.strictEqual(C.valorCelda({}), '');
  assert.strictEqual(C.valorCelda({ effectiveValue: { errorValue: { type: 'REF' } } }), '#REF!', 'un error se ve como en Google, no como vacio');
  assert.strictEqual(C.valorCelda({ effectiveValue: { errorValue: { type: 'N_A' } } }), '#N/A');
});

test('La copia ida y vuelta por la base no cambia nada', () => {
  const m = [['a', 1, new Date(2026, 9, 17, 14, 23, 53), ''], ['', 0, true, 'x']];
  assert.deepStrictEqual(C.decodificar(JSON.parse(JSON.stringify(C.codificar(m)))), m);
  assert.deepStrictEqual(C.matrizDeFilas([{ values: [{ effectiveValue: { stringValue: 'a' } }] }, { values: [] }, {}]), [['a']], 'filas vacias al final se recortan como getDataRange');
});

test('Otro modulo puede pasar su lista de archivos sin cambiar Pagos', () => {
  const porDefecto = motor().archivos;
  const explicito = crearMotor({ libros: libros(), configId: 'CFG', listas: ['LISTA.txt'] }).archivos;
  assert.deepStrictEqual(explicito, porDefecto);
  assert.ok(porDefecto.includes('PagosProveedores.js'));
});

test('La copia de hojas solo acepta nombres de tabla simples', async () => {
  const pool = { query: async () => ({ rows: [] }) };
  await assert.rejects(() => C.cargarCopia(pool, { tabla: 'hojas_copia; DROP TABLE usuarios' }), /Nombre de tabla invalido/);
  assert.deepStrictEqual((await C.cargarCopia(pool, { tabla: 'hojas_copia_f2' })).libros, {});
});

test('El servidor no intenta leer Gmail al abrir Pagos (eso queda en la intranet)', () => {
  const M = motor();
  assert.strictEqual(M.ctx.fecLeerSiToca_(), null);
  assert.strictEqual(M.ctx.bcoLeerSiToca_(), null);
  let gmail = 0;
  M.ctx.Gmail = { Users: new Proxy({}, { get: () => { gmail++; throw new Error('Gmail'); } }) };
  M.correr(CHEF, 'getPagosProveedores', []);
  assert.strictEqual(gmail, 0, 'ninguna llamada a Gmail');
});
