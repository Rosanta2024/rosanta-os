// Corre con TZ=America/Guatemala.
const fs_ = require('fs');
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
  // cada una es de una pantalla real: Pagos (IVA) o Caja/Compras (leer el correo, la foto del comprobante)
  assert.deepStrictEqual(SOLO_INTRANET.filter((n) => ESCRITURA.indexOf(n) === -1 && ['leerCierresCaja', 'leerComprobanteCompra'].indexOf(n) === -1), []);
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

// ---- Caja chica y Compras (18-oct-2026): los interruptores en la intranet, con el codigo real ----
function motorCaja(valores, enServidor) {
  const L = librosFix();
  L.CFG.PARAMETROS = [['parametro', 'valor']].concat(Object.keys(valores).map((k) => [k, valores[k]]));
  L.CFG.USUARIOS = [['correo', 'rol', 'modulos', 'edita', 'nombre', 'token'], ['sala@x', 'sala', 'pagos,recetario', 'NO', 'Maco', 'tok-sala']];
  const M0 = crearMotor({ libros: L, configId: 'CFG', listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  L.CFG.CAJA_CHICA = [M0.ctx.CCH_COLS_.slice()];
  L.CFG.RETIROS_SOLICITUDES = [M0.ctx.CPE_SOL_COLS_.slice()];
  const M = crearMotor({ libros: L, configId: 'CFG', editables: { CFG: ['PAGOS_PROVEEDORES', 'CAJA_CHICA', 'RETIROS_SOLICITUDES'] }, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  if (!enServidor) M.ctx.NUBE_SERVIDOR_ = undefined;
  M.ctx._cchLeerSiFaltan_ = () => null; M.ctx.cchSincronizarMaestro_ = () => ({ escrito: false });
  return M;
}
const SALA_ = { email: 'sala@x', rol: 'sala', modulos: ['pagos', 'recetario'], nombre: 'Maco' };
const gasto = ['SALIDA', '2026-10-18', 'barra', 'limones', 30, '', ''];

test('Caja en base pero Pagos en sheets: Caja sigue en la intranet (nunca escriben por dos lados)', () => {
  const M = motorCaja({ motor_pagos: 'sheets', motor_caja: 'base' }, false);
  assert.strictEqual(M.ctx.cajaMotor_(), 'sheets');
  const r = M.correr(SALA_, 'registrarMovimientoCaja', gasto);
  assert.ok(r.escrituras['CFG|CAJA_CHICA'] || r.escrituras['CFG|PAGOS_PROVEEDORES'], 'la intranet anoto el gasto: ' + JSON.stringify(r.escrituras));
});

test('Caja y Pagos en base: en la intranet Caja chica y Compras no guardan', () => {
  const M = motorCaja({ motor_pagos: 'base', motor_caja: 'base' }, false);
  assert.strictEqual(M.ctx.cajaMotor_(), 'base');
  assert.throws(() => M.correr(SALA_, 'registrarMovimientoCaja', gasto), /pantalla nueva/);
  assert.throws(() => M.correr(SALA_, 'registrarConteoCaja', ['2026-10-18', 500, '']), /pantalla nueva/);
  assert.throws(() => M.correr(SALA_, 'anularSolicitudRetiro', ['x']), /pantalla nueva/);
  assert.throws(() => M.correr(SALA_, 'registrarRetiroYCompras', [{ fecha: '2026-10-18' }]), /pantalla nueva/);
  assert.ok(M.correr(SALA_, 'getCajaChica', []).resultado.dias, 'mirar sigue funcionando');
});

test('En el servidor nuevo, Caja chica guarda aunque los interruptores digan base', () => {
  const M = motorCaja({ motor_pagos: 'base', motor_caja: 'base' }, true);
  const r = M.correr(SALA_, 'registrarMovimientoCaja', gasto);
  assert.ok(Object.keys(r.escrituras).length > 0);
});

test('getCajaDestino arma la direccion de /caja o /compras con el mismo enlace', () => {
  const M = motorCaja({ motor_pagos: 'base', motor_caja: 'base' }, false);
  // directo, con el enlace de verdad (por el motor el enlace viaja como marcador)
  M.ctx.resolverUsuario_ = () => ({ email: 'sala@x', rol: 'sala', modulos: ['pagos'], nombre: 'Maco' });
  const d = M.ctx.getCajaDestino('tok-sala', 'compras');
  assert.strictEqual(d.base, true);
  assert.match(d.url, /^https:\/\/rosanta-nube-.*\/compras\?u=tok-sala&dentro=1$/);
  assert.deepStrictEqual(motorCaja({ motor_pagos: 'sheets', motor_caja: 'base' }, false).correr(SALA_, 'getCajaDestino', ['caja']).resultado, { base: false });
});

test('modos(): Caja solo en vivo con Pagos en vivo; cierres por su cuenta', () => {
  const { modos } = require('../src/servicio-pagos');
  const L = (p, c, k) => ({ [C.LIBROS.config.id]: { PARAMETROS: [['p', 'v'], ['motor_pagos', p], ['motor_caja', c], ['motor_cierres', k]] } });
  assert.deepStrictEqual(modos('vivo', L('base', 'base', 'sheets')), { pagos: true, caja: true, cierres: false });
  assert.deepStrictEqual(modos('vivo', L('sheets', 'base', 'base')), { pagos: false, caja: false, cierres: true });
  assert.deepStrictEqual(modos('sombra', L('base', 'base', 'base')), { pagos: false, caja: false, cierres: false }, 'si el servidor no lo permite, nada');
});

test('/tareas/cierre: pide la clave, valida la fila y pasa al servicio', async () => {
  const { crearApp } = require('../src/app');
  const recibido = [];
  const pagos = { guardarCierre: async (fila) => { recibido.push(fila); return { fecha: '2026-12-31', nuevo: true }; }, estado: () => ({}) };
  const srv = crearApp({ pool: { query: async () => ({ rows: [] }) }, claveTareas: 'k', pagos }).listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    const sin = await fetch(b + '/tareas/cierre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fila":[]}' });
    assert.strictEqual(sin.status, 403);
    const mal = await fetch(b + '/tareas/cierre', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': 'k' }, body: '{}' });
    assert.strictEqual(mal.status, 400);
    const ok = await fetch(b + '/tareas/cierre', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': 'k' }, body: '{"fila":["2026-12-31",10]}' });
    assert.strictEqual(ok.status, 200); assert.deepStrictEqual(recibido, [['2026-12-31', 10]]);
  } finally { srv.close(); }
  // server.js tiene que pasarle guardarCierre a la app (en el ensayo del 18-oct no se lo pasaba)
  const fs = require('fs');
  assert.match(fs.readFileSync(require('path').join(__dirname, '..', 'src', 'server.js'), 'utf8'), /guardarCierre: pagos\.guardarCierre/);
});

test('Un cierre con una fecha mal escrita se rechaza (antes entraba como fecha invalida)', () => {
  const { fechasMalas } = require('../src/servicio-pagos');
  assert.deepStrictEqual(fechasMalas(['2026-10-13', 10, { $d: '2026-10-18T19:14:09' }]), []);
  assert.strictEqual(fechasMalas([{ $d: "2026-10-18'T'19:14:09" }]).length, 1);
  assert.strictEqual(fechasMalas([{ $d: 'NaN-NaN-NaNTNaN:NaN:NaN' }, { otra: 1 }]).length, 2);
});

test('?nube=ensayo: solo el dueño ve la pantalla del servidor de ENSAYO (aunque todo este en sheets); los demas, nada', () => {
  const M = motorCaja({ motor_pagos: 'sheets', motor_caja: 'sheets' }, false);
  M.ctx.resolverUsuario_ = () => ({ email: 'sala@x', rol: 'sala', modulos: ['pagos'], nombre: 'Maco' });
  assert.strictEqual(JSON.stringify(M.ctx.getCajaDestino('tok-sala', 'caja', 'ensayo')), '{"base":false}', 'sala no entra al ensayo');
  M.ctx.resolverUsuario_ = () => ({ email: 'dueno@x', rol: 'dueño', modulos: ['pagos', 'recetario'], nombre: 'Juanma' });
  const d = M.ctx.getCajaDestino('tok-dueno', 'caja', 'ensayo');
  assert.strictEqual(d.base, true); assert.strictEqual(d.ensayo, true);
  assert.match(d.url, /^https:\/\/rosanta-nube-ensayo-.*\/caja\?u=tok-dueno&dentro=1$/);
  const p = M.ctx.getPagosDestino('tok-dueno', '', 'ensayo');
  assert.match(p.url, /^https:\/\/rosanta-nube-ensayo-.*\/pagos\?u=tok-dueno&dentro=1$/);
  assert.strictEqual(JSON.stringify(M.ctx.getCajaDestino('tok-dueno', 'caja', 'otra')), '{"base":false}', 'sin ?nube=ensayo, lo de siempre');
});

test('Sheets: las lecturas reintentan 429 y 5xx; las escrituras SOLO 429 (un 5xx puede haber escrito ya)', () => {
  const s = fs_.readFileSync(require('path').join(__dirname, '..', 'src', 'server.js'), 'utf8');
  assert.match(s, /LECTURA_CON_REINTENTOS = REINTENTOS\(\[\[429, 429\], \[500, 599\]\]\)/);
  assert.match(s, /ESCRITURA_CON_REINTENTOS = REINTENTOS\(\[\[429, 429\]\]\)/);
  assert.match(s, /spreadsheets'\] \}\) \}, ESCRITURA_CON_REINTENTOS\)/, 'el cliente que escribe usa la regla de escritura');
});

test('proc_fel/proc_banco/proc_cierres = nube: la intranet NO lee el correo (un solo escritor); el servidor si', () => {
  const M = motorCaja({ motor_pagos: 'sheets', proc_fel: 'nube', proc_banco: 'nube', proc_cierres: 'sombra' }, false);
  let gmail = 0;
  M.ctx.Gmail = { Users: { Messages: { list: () => { gmail++; return { messages: [] }; } } } };
  assert.strictEqual(JSON.stringify(M.ctx.fecLeer_(3)), JSON.stringify({ correos: 0, nuevos: 0, repetidos: 0, errores: [], en_la_nube: true }));
  assert.strictEqual(M.ctx.bcoLeer_(3).en_la_nube, true);
  assert.strictEqual(gmail, 0, 'no toco Gmail');
  assert.strictEqual(M.ctx.procEnNube_('proc_cierres'), false, 'sombra: la intranet sigue leyendo');
  const S = motorCaja({ motor_pagos: 'sheets', proc_fel: 'nube' }, true);
  assert.strictEqual(S.ctx.procEnNube_('proc_fel'), false, 'en el servidor nuevo no aplica');
});
