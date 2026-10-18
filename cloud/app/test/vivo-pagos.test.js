// Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/copia-hojas');
const EH = require('../src/escribir-hoja');
const { planificar, llave } = require('../src/importar-pagos');
const { interruptor, bitacoraDe, ESCRITURA, SOLO_INTRANET } = require('../src/servicio-pagos');
const { PAG_H } = require('./fixtura');

const fila = (id, estatus, q) => ['COCINA', 'VERDURAS', '1001', '', '2026-10-18', q || 500, estatus || 'Pagado de caja', '111', '', 'Jeffry', new Date(2026, 9, 18, 9, 30, 15), id];

test('El interruptor: solo motor_pagos = base enciende el modo en vivo', () => {
  const L = (v) => ({ [C.LIBROS.config.id]: { PARAMETROS: [['parametro', 'valor'], ['margen', 60], ['motor_pagos', v]] } });
  assert.strictEqual(interruptor(L('base')), 'base');
  assert.strictEqual(interruptor(L(' Base ')), 'base');
  assert.strictEqual(interruptor(L('sheets')), 'sheets');
  assert.strictEqual(interruptor(L('')), 'sheets');
  assert.strictEqual(interruptor({}), 'sheets', 'sin la fila, sombra');
});

test('Cada celda va con su tipo: el ID como texto, la fecha como fecha, los numeros como numeros', () => {
  assert.deepStrictEqual(EH.celda('630e50', true), { userEnteredValue: { stringValue: '630e50' }, userEnteredFormat: { numberFormat: { type: 'TEXT' } } });
  assert.deepStrictEqual(EH.celda(500), { userEnteredValue: { numberValue: 500 } });
  assert.deepStrictEqual(EH.celda('2026-10-18'), { userEnteredValue: { stringValue: '2026-10-18' } }, 'la FECHA PAGADO de texto sigue siendo texto');
  assert.deepStrictEqual(EH.celda(''), { userEnteredValue: null });
  const d = new Date(2026, 9, 18, 9, 30, 15, 789);
  const c = EH.celda(d);
  assert.strictEqual(c.userEnteredFormat.numberFormat.type, 'DATE_TIME');
  const vuelta = C.fechaDeSerie(c.userEnteredValue.numberValue);
  assert.deepStrictEqual([vuelta.getHours(), vuelta.getMinutes(), vuelta.getSeconds()], [9, 30, 15], 'ida y vuelta sin perder segundos ni correr la hora');
});

test('La copia a la hoja reescribe la fila del mismo ID en su lugar y agrega las nuevas al final', () => {
  const hoja = [PAG_H.slice(), fila('a1'), fila('b2')];
  const p = EH.planCopia(hoja, [{ id: 'b2', fila: fila('b2', 'ANULADO: Pagado de caja (Jeffry, 2026-10-18)') }, { id: 'n9', fila: fila('n9') }], 77);
  assert.strictEqual(p.actualizadas, 1); assert.strictEqual(p.nuevas, 1);
  const u = p.requests.find((r) => r.updateCells).updateCells;
  assert.deepStrictEqual([u.range.sheetId, u.range.startRowIndex, u.range.endRowIndex], [77, 2, 3], 'b2 esta en la fila 3 (indice 2)');
  assert.strictEqual(u.rows[0].values[6].userEnteredValue.stringValue, 'ANULADO: Pagado de caja (Jeffry, 2026-10-18)');
  assert.ok(p.requests.find((r) => r.appendCells), 'n9 va al final');
});

test('Copiar dos veces la misma fila no la duplica', () => {
  const hoja = [PAG_H.slice(), fila('a1')];
  const p = EH.planCopia(hoja, [{ id: 'a1', fila: fila('a1') }], 1);
  assert.deepStrictEqual([p.nuevas, p.actualizadas], [0, 1]);
});

test('Lo que el servidor copia a la hoja vuelve igual en la importacion (sin conflictos falsos)', () => {
  // simula: celda escrita → leida por la API (valorCelda) → planificar contra la base
  const f = fila('s1', 'Tarjeta', 812.4);
  const escrita = f.map((x, j) => EH.celda(x, j === PAG_H.indexOf('ID')));
  const leida = escrita.map((c) => C.valorCelda(c.userEnteredValue ? { effectiveValue: c.userEnteredValue, effectiveFormat: c.userEnteredFormat } : {}));
  const base = [{ id: 's1', celdas: C.codificar([f])[0], origen: 'servidor', orden: 1 }];
  const p = planificar([PAG_H.slice(), leida], base);
  assert.deepStrictEqual([p.nuevas.length, p.actualizadas.length, p.problemas.length], [0, 0, 0], p.problemas.join(' | '));
});

test('En vivo un cambio en la hoja de un pago del servidor es conflicto; si manda la hoja (volver atras), se acepta', () => {
  const base = [{ id: 's1', celdas: C.codificar([fila('s1', 'Tarjeta')])[0], origen: 'servidor', orden: 1 }];
  const hoja = [PAG_H.slice(), fila('s1', 'ANULADO: Tarjeta (Juanma, 2026-10-19)')];
  assert.match(planificar(hoja, base).problemas[0], /Conflicto en s1/);
  const p = planificar(hoja, base, { hojaManda: true });
  assert.deepStrictEqual([p.actualizadas.length, p.problemas.length], [1, 0]);
});

test('La bitacora guarda antes y despues; anular cuenta como borrar', () => {
  const b = bitacoraDe(PAG_H, fila('a1'), fila('a1', 'ANULADO: Pagado de caja (Jeffry, 2026-10-18)'));
  assert.strictEqual(b.accion, 'borrar');
  assert.strictEqual(b.fecha, '2026-10-18');
  assert.strictEqual(b.antes['ESTATUS DE PAGO'], 'Pagado de caja');
  assert.match(b.despues['ESTATUS DE PAGO'], /^ANULADO/);
  assert.strictEqual(b.despues.REGISTRADO, '2026-10-18T09:30:15');
  assert.strictEqual(bitacoraDe(PAG_H, fila('a1'), fila('a1', 'Pagado de caja', 450)).accion, 'corregir');
});

test('Las acciones que tocan el maestro quedan en la intranet', () => {
  assert.deepStrictEqual(SOLO_INTRANET.filter((n) => ESCRITURA.indexOf(n) === -1), []);
  assert.ok(SOLO_INTRANET.includes('marcarFacturaParaIva'));
  assert.strictEqual(llave(630e50), String(630e50));
});

// ---- El lado de la intranet (NubePagos.js), con el codigo real ----
const { crearMotor } = require('../src/motor-pagos');
const { libros: librosFix } = require('./fixtura');
function motorConInterruptor(valor, enServidor) {
  const L = librosFix();
  L.CFG.PARAMETROS = [['parametro', 'valor'], ['motor_pagos', valor]];
  L.CFG.USUARIOS = [['correo', 'rol', 'modulos', 'edita', 'nombre', 'token'], ['chef@x', 'chef', 'pagos', 'NO', 'Jeffry', 'tok-chef']];
  const M = crearMotor({ libros: L, configId: 'CFG', editables: { CFG: ['PAGOS_PROVEEDORES'] } });
  if (!enServidor) M.ctx.NUBE_SERVIDOR_ = undefined;   // como si corriera en la intranet
  return M;
}
const CHEF_ = { email: 'chef@x', rol: 'chef', modulos: ['pagos'], nombre: 'Jeffry' };

test('Intranet con motor_pagos = base: Pagos no guarda desde aca', () => {
  const M = motorConInterruptor('base', false);
  assert.throws(() => M.correr(CHEF_, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-18']), /pantalla nueva/);
  assert.throws(() => M.correr(CHEF_, 'anularMovimientoPago', ['x']), /pantalla nueva/);
  assert.strictEqual(M.correr(CHEF_, 'getPagosProveedores', []).resultado.facturas.length, 2, 'mirar sigue funcionando');
});

test('Intranet con motor_pagos = base: Compras sigue anulando lo suyo (funcion de adentro)', () => {
  const M = motorConInterruptor('sheets', false);
  const w = M.correr(CHEF_, 'registrarCompraMercado', ['2026-10-18', 'Mercado', 'cebolla', 40, 'COCINA', 'Pagado de caja']);
  const id = M.ctx.SpreadsheetApp.openById('CFG').getSheetByName('PAGOS_PROVEEDORES').getDataRange().getValues()[1][11];
  assert.ok(id, 'la compra quedo anotada: ' + JSON.stringify(w.escrituras));
  M.ctx.CacheService.getScriptCache().put('pag_motor_v1', 'base', 60);   // ahora se enciende el interruptor
  assert.throws(() => M.correr(CHEF_, 'anularMovimientoPago', [id]), /pantalla nueva/);
  const r = M.correr(CHEF_, '_pagAnularMovimiento_', [id]);
  assert.match(String(r.resultado.resumen || ''), /Anulado/);
});

test('Intranet con motor_pagos = sheets: todo como siempre', () => {
  const M = motorConInterruptor('sheets', false);
  const r = M.correr(CHEF_, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-18', null, 0, '']);
  assert.match(r.resultado.resumen, /^Pago guardado/);
});

test('En el servidor nuevo la cerradura no frena (aunque el interruptor diga base)', () => {
  const M = motorConInterruptor('base', true);
  const r = M.correr(CHEF_, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-18', null, 0, '']);
  assert.match(r.resultado.resumen, /^Pago guardado/);
});

test('getPagosDestino: con base da la direccion con el enlace de esa persona; con sheets, nada', () => {
  const M = motorConInterruptor('base', false);
  const d = M.correr(CHEF_, 'getPagosDestino', ['admin:banco']).resultado;
  assert.strictEqual(d.base, true);
  assert.match(d.url, /^https:\/\/rosanta-nube-.*\/pagos\?u=.+&modo=admin%3Abanco&dentro=1$/);
  const d2 = motorConInterruptor('sheets', false).correr(CHEF_, 'getPagosDestino', ['']).resultado;
  assert.deepStrictEqual(d2, { base: false });
  const d3 = M.correr(CHEF_, 'getPagosDestino', ['admin:<script>']).resultado;
  assert.ok(!/script/.test(d3.url), 'un modo raro no pasa a la direccion');
});
