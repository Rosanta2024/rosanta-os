// El cargador del maestro en la nube (21-oct-2026): el cargador.js real con imitaciones y precarga.
// Datos inventados (nunca ventas, facturas ni movimientos reales en el repo).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const M = require('../src/proc-maestro');
const { serieDeFecha } = require('../src/escribir-hoja');

const LUNES_26 = Date.parse('2026-10-26T12:00:00-06:00');   // semana ISO 44: la ventana mira S42, S43 y S44
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HOJA = 'application/vnd.google-apps.spreadsheet';

const { google, poolFalso } = require('./google-falso');

// ---- el maestro de mentira ---------------------------------------------------------------------------------------
const ENC_VENTAS = ['TicketId', 'Fecha', 'Hora', 'Subtotal', 'TotalFinal', 'Costo', 'Ganancia', 'Notas', 'Comensales', 'Es Contable', 'Vendedor', 'Productos', 'Año', 'Semana', 'Mes'];
const ENC_FEL = ['Fecha', 'Tipo', 'Serie', 'Numero', 'NIT', 'Emisor', 'Establecimiento', 'Estado', 'Moneda', 'Total', 'IVA', 'Año', 'Semana', 'Categoria', 'Personal', 'Mes'];
const ENC_EMI = ['Fecha', 'Serie', 'Numero', 'NIT', 'Receptor', 'Estado', 'Moneda', 'Total', 'IVA', 'Año', 'Mes'];
const ENC_BANCO = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
const f = (x) => ({ f: x });
function maestroInicial() {
  return {
    '00_Proveedores': [['Establecimiento', 'x', 'Categoria', 'Personal'], ['Tienda Uno', '', 'ALIMENTOS', 'No']],
    '02_Ventas_Maestro': [['VENTAS'], [''], [''], ENC_VENTAS,
      ['FT1', new Date(2026, 9, 6), '', 500, 500, 100, 354.55, 2, 2, 'Sí', 'Ana', '', f('=IF(B5="","",IFERROR(YEAR(B5),""))'), f('=IF(B5="","",IFERROR(WEEKNUM(B5,21),""))'), f('=IF(B5="","",IFERROR(MONTH(B5),""))')]],
    '01_FEL_Maestro': [['FEL'], [''], [''], ENC_FEL,
      [new Date(2026, 9, 7), 'FACT', 'VIEJA01', '1', '555', 'P', 'Tienda Uno', 'Vigente', 'GTQ', 10, 1.07]],
    '01b_FEL_Emitidas': [['EMITIDAS'], [''], ENC_EMI, [new Date(2026, 9, 7), 'FACE00', '4000', 'CF', 'Cliente', 'Vigente', 'GTQ', 50, 5.36]],
    '03_Banco_Industrial': [['BANCO'], [''], [''], ENC_BANCO,
      [new Date(2026, 9, 6), 111, 'Pago agua', 90, 0, '', 'SERVICIOS', 'No', f('=YEAR(A5)'), f('=MONTH(A5)'), f('=ISOWEEKNUM(A5)')],
      [new Date(2026, 9, 7), 222, 'Deposito POS', 0, 700, '', 'VENTAS', 'No', f('=YEAR(A6)'), f('=MONTH(A6)'), f('=ISOWEEKNUM(A6)')]],
    Otra: [['no se toca']]
  };
}
const POS43 = [['Tipo documento', 'No.', 'Fecha', 'Estado', 'Vendedor', 'Contable', 'Notas', 'Costo', 'Total'],
  ['Factura', 'FT10', new Date(2026, 9, 20), 'Finalizado', 'Ana', 'Sí', '4', 300, 1100],
  ['Factura', 'FT11', '21/10/2026', 'Finalizado', 'Luis', 'No', '', 1000, 6000],
  ['Factura', 'FT12', new Date(2026, 9, 21), 'Anulada', 'Luis', 'No', '2', 10, 99],
  ['TOTAL', '', '', '', '', '', '', 1310, 7199]];
const ENC_SAT = ['Fecha de emisión', 'Tipo de DTE', 'Serie', 'Número del DTE', 'NIT del emisor', 'Nombre completo del emisor', 'Nombre del establecimiento',
  'Nombre completo del receptor', 'Estado', 'Moneda', 'Gran Total (Moneda Original)', 'IVA (monto de este impuesto)'];
const FEL43 = [ENC_SAT,
  [new Date(2026, 9, 19, 23, 0), 'FACT', '09296263', '2476559877', '1234567K', 'PROVEEDOR UNO', 'Tienda Uno', 'CORSAGA', 'Vigente', 'GTQ', 500.25, 53.6],
  [new Date(2026, 9, 21), 'FACT', 'ABCD1234', '111', '7654321', 'PROVEEDOR DOS', 'Tienda Nueva', 'CORSAGA', 'Vigente', 'GTQ', 80, 8.57]];
const EMI43 = [ENC_SAT, [new Date(2026, 9, 22), 'FACT', 'FACE01', '5001', '24185930', 'CORSAGA, S.A.', 'Rosanta', 'Cliente X', 'Vigente', 'GTQ', 1100, 117.86]];
function banco43(debitos) {
  return [['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Categoría', 'Total_desde', 'Total_hasta', 'Total_debitos', 'Total_creditos'],
    ['2026-10-19', '123456', 'Pago luz', 250.5, 0, 'SERVICIOS', '2026-10-19', '2026-10-25', debitos === undefined ? 250.5 : debitos, 1000],
    ['2026-10-20', '998877', 'Deposito', 0, 1000, 'VENTAS', '', '', '', '']];
}
const VIEJO = [['TicketId', 'Fecha'], [9999, '1/8/2026']];

function driveFalso(g, opciones) {
  const o = opciones || {};
  const d = { carpetasPedidas: [], bajados: [], borrados: [], subidos: 0 };
  const xlsx = { XPOS43: POS43, XFEL43: FEL43, XEMI43: EMI43, XVIEJO: VIEJO };
  const carpetas = {
    [M.REPORTES_2026]: { nombre: 'Reportes 2026', archivos: [], carpetas: [{ id: 'C30', nombre: 'S30' }, { id: 'C42', nombre: 'S42' }, { id: 'C43', nombre: 'S43' },
      { id: 'C09', nombre: '2026-09' }, { id: 'C08', nombre: '2026-08' }, { id: 'COTRA', nombre: 'Facturas sueltas' }] },
    C30: { nombre: 'S30', carpetas: [], archivos: [{ id: 'XVIEJO', nombre: 'ReporteVentas.xlsx', mime: XLSX, modificado: '2026-07-27T16:00:00.000Z' }] },
    C42: { nombre: 'S42', carpetas: [], archivos: [] },
    C43: { nombre: 'S43', carpetas: [], archivos: [
      { id: 'XPOS43', nombre: 'ReporteFacturas_10_25.xlsx', mime: XLSX, modificado: '2026-10-26T15:00:00.000Z' },
      { id: 'XFEL43', nombre: 'FEL_recibidas_S43.xlsx', mime: XLSX, modificado: '2026-10-26T15:01:00.000Z' },
      { id: 'XEMI43', nombre: 'FEL_emitidas_S43.xlsx', mime: 'application/octet-stream', modificado: '2026-10-26T15:02:00.000Z' },
      { id: 'BANCO43', nombre: 'BANCO_BI_S43', mime: HOJA, modificado: '2026-10-26T15:03:00.000Z' },
      { id: 'PDF43', nombre: 'estado_cuenta.pdf', mime: 'application/pdf', modificado: '2026-10-26T15:04:00.000Z' }] },
    C09: { nombre: '2026-09', carpetas: [], archivos: [] },
    C08: { nombre: '2026-08', carpetas: [], archivos: [] },
    COTRA: { nombre: 'Facturas sueltas', carpetas: [], archivos: [] }
  };
  g.crear('BANCO43', { 'Hoja 1': banco43(o.debitos) });
  Object.assign(d, {
    async carpeta(id) { d.carpetasPedidas.push(id); if (!carpetas[id]) throw new Error('Drive 404 ' + id); return JSON.parse(JSON.stringify(carpetas[id])); },
    async meta(id) { return { id, mimeType: XLSX, modifiedTime: 't1' }; },
    async bajar(id) { d.bajados.push(id); return Buffer.from(JSON.stringify(xlsx[id].map((r) => r.map((x) => (x instanceof Date ? { $d: x.getTime() } : x))))); },
    async subirComoHoja(bytes, nombre) {
      const id = 'CONV' + (++d.subidos);
      const filas = JSON.parse(bytes.toString()).map((r) => r.map((x) => (x && x.$d ? new Date(x.$d) : x)));
      g.crear(id, { Hoja1: filas, Hoja2: [['otra pestaña']] });
      return id;
    },
    async borrar(id) { d.borrados.push(id); delete g.L[id]; }
  });
  return d;
}


function armar(opciones) {
  const o = opciones || {};
  const g = google(o);
  g.crear(M.MAESTRO, o.maestro || maestroInicial(), { zona: o.zona, filas: o.filas });
  const drive = driveFalso(g, o);
  const deps = { sheetsLectura: g, drive, sheetsEscritura: o.sinEscritura ? null : g, pool: poolFalso(o.modo, o.registro), relojPruebas: LUNES_26 };
  return { g, drive, deps };
}
const filasDe = (g, tab) => g.L[M.MAESTRO].hojas[tab].M;
const escrituras = (g) => g.llamadas.filter((x) => x[0] === 'batchUpdate' || x[0] === 'values.batchUpdate');

// ---------------------------------------------------------------------------------------------------------------

test('El proceso del maestro usa el mismo cargador que Apps Script', () => {
  const origen = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-maestro');
  assert.deepStrictEqual(M.archivosMaestro(), ['cargador.js', 'cierre_bancos.js']);
  M.archivosMaestro().forEach((x) => assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'maestro', x), 'utf8'), fs.readFileSync(path.join(origen, x), 'utf8'),
    x + ' se separo del de Apps Script: correr cloud/herramientas/traer-maestro.sh'));
});

test('apps (o sin fila): no hace nada', async () => {
  const { g, drive, deps } = armar();
  const r = await M.correrMaestro({}, deps);
  assert.deepStrictEqual(r, { status: 200, cuerpo: { modo: 'apps' } });
  assert.strictEqual(g.llamadas.length, 0);
  assert.strictEqual(drive.carpetasPedidas.length, 0);
  assert.strictEqual(await M.leerModo({ query: async () => { throw new Error('no existe la tabla'); } }), 'apps');
  assert.strictEqual(await M.leerModo({ query: async () => ({ rows: [{ modo: 'cualquiera' }] }) }), 'apps');
});

test('Nube sobre un maestro sin la S43: escribe solo las filas nuevas, con los tipos de Apps Script, y anota los procesados', async () => {
  const { g, drive, deps } = armar({ modo: 'nube', filas: { '01b_FEL_Emitidas': 4 } });   // a Emitidas le falta una fila: se agrega
  const r = await M.correrMaestro({}, deps);
  assert.strictEqual(r.status, 200, JSON.stringify(r.cuerpo));
  const c = r.cuerpo;
  assert.strictEqual(c.escritas, 7);
  // solo la ventana (S42, S43, 2026-09): ni S30, ni 2026-08, ni una carpeta con otro nombre
  assert.ok(!drive.carpetasPedidas.includes('C30') && !drive.carpetasPedidas.includes('C08') && !drive.carpetasPedidas.includes('COTRA'), drive.carpetasPedidas.join(','));
  assert.deepStrictEqual(c.archivos.map((a) => [a.carpeta, a.nombre, a.tipo, a.filas]).sort(), [
    ['S43', 'BANCO_BI_S43', 'BANCO_BI', 2], ['S43', 'FEL_emitidas_S43.xlsx', 'FEL_EMITIDAS', 1],
    ['S43', 'FEL_recibidas_S43.xlsx', 'FEL_RECIBIDAS', 2], ['S43', 'ReporteFacturas_10_25.xlsx', 'POS_FACTURAS', 2]]);
  // los xlsx se convirtieron y los temporales se borraron
  assert.deepStrictEqual(drive.bajados.sort(), ['XEMI43', 'XFEL43', 'XPOS43']);
  assert.strictEqual(drive.borrados.length, 3);
  assert.ok(c.avisos.some((a) => /FT11 de Q6000\.00 sin comensales/.test(a)), c.avisos.join(' | '));
  assert.ok(c.avisos.some((a) => /Proveedores nuevos.*Tienda Nueva/.test(a)));

  // 02_Ventas_Maestro: fila 6 y 7, Notas "4" queda numero (setValues teclea), la fecha como fecha, formulas de su fila
  const V = filasDe(g, '02_Ventas_Maestro');
  assert.deepStrictEqual(V[5].slice(0, 12).map((x) => (x ? x.v : '')), ['FT10', serieDeFecha(new Date(2026, 9, 20)), '', 1100, 1100, 300, 700, 4, 4, 'Sí', 'Ana', '']);
  assert.strictEqual(V[5][1].fmt, 'DATE');
  assert.strictEqual(V[5][12].f, '=IF(B6="","",IFERROR(YEAR(B6),""))');
  assert.strictEqual(V[6][0].v, 'FT11');
  assert.strictEqual(V[6][1].v, serieDeFecha(new Date(2026, 9, 21)));
  assert.strictEqual(V[6][14].f, '=IF(B7="","",IFERROR(MONTH(B7),""))');
  assert.strictEqual(V.length, 7, 'la anulada y la fila TOTAL no entran');

  // 01_FEL_Maestro: Serie y Numero como TEXTO (el '@' va antes de los valores), la hora 23:00 al dia siguiente (regla 10)
  const F = filasDe(g, '01_FEL_Maestro');
  assert.deepStrictEqual([F[5][2].v, F[5][2].fmt, F[5][3].v, F[5][3].fmt], ['09296263', 'TEXT', '2476559877', 'TEXT']);
  assert.strictEqual(F[5][0].v, serieDeFecha(new Date(2026, 9, 20)));
  assert.strictEqual(F[5][4].v, '1234567K');
  assert.strictEqual(F[6][4].v, 7654321, 'un NIT de puros digitos queda numero, como con setValues');
  assert.strictEqual(F[6][13].f, '=IF(G7="","",IFERROR(VLOOKUP(G7,\'00_Proveedores\'!A:C,3,FALSE()),"POR_CLASIFICAR"))');
  // Emitidas: la pestaña crecio para que entre la fila
  const E = filasDe(g, '01b_FEL_Emitidas');
  assert.deepStrictEqual([E[4][1].v, E[4][2].v, E[4][7].v], ['FACE01', '5001', 1100]);
  assert.strictEqual(g.L[M.MAESTRO].hojas['01b_FEL_Emitidas'].filas, 5);

  // 03_Banco_Industrial: fecha AAAA-MM-DD → fecha; docto → numero; Año/Mes/Semana copiadas de la ultima fila (R1C1)
  const B = filasDe(g, '03_Banco_Industrial');
  assert.deepStrictEqual(B[6].slice(0, 8).map((x) => (x ? x.v : '')), [serieDeFecha(new Date(2026, 9, 19)), 123456, 'Pago luz', 250.5, 0, '', 'SERVICIOS', 'No']);
  assert.strictEqual(B[6][0].fmt, 'DATE');
  assert.deepStrictEqual([B[6][8].f, B[7][10].f], ['=YEAR(A7)', '=ISOWEEKNUM(A8)']);
  // no toco otras pestañas ni la fila de encabezados
  assert.deepStrictEqual(filasDe(g, 'Otra'), [[{ v: 'no se toca' }]]);

  // el registro: los 4 archivos con datos (el pdf no cuenta); la huella es id:ms como en Apps Script
  assert.deepStrictEqual([...deps.pool.reg].sort(), ['BANCO43:' + Date.parse('2026-10-26T15:03:00.000Z'), 'XEMI43:' + Date.parse('2026-10-26T15:02:00.000Z'),
    'XFEL43:' + Date.parse('2026-10-26T15:01:00.000Z'), 'XPOS43:' + Date.parse('2026-10-26T15:00:00.000Z')]);
  assert.ok(deps.pool.consultas.some((q) => /INSERT INTO maestro_corridas/.test(q.sql)));
  assert.deepStrictEqual(c.relectura, []);

  // segunda corrida: el registro hace que no abra nada (y aunque lo abriera, la deduplicacion no repetiria)
  const n = escrituras(g).length;
  const r2 = await M.correrMaestro({}, deps);
  assert.strictEqual(r2.status, 200);
  assert.deepStrictEqual([r2.cuerpo.archivos, r2.cuerpo.escritas], [[], 0]);
  assert.strictEqual(escrituras(g).length, n);
  assert.deepStrictEqual(drive.bajados.length, 3);

  // y la SOMBRA sobre lo que escribio la nube: todo igual (valor y tipo), nada que agregar
  const s = await M.correrMaestro({ modo: 'sombra', ahora: LUNES_26 }, deps);
  assert.strictEqual(s.status, 200, JSON.stringify(s.cuerpo.detalle));
  assert.deepStrictEqual([s.cuerpo.filas_que_agregaria, s.cuerpo.iguales, s.cuerpo.distintas, s.cuerpo.faltan], [0, 7, 0, 0]);
  assert.strictEqual(escrituras(g).length, n, 'la sombra no escribe');
});

test('Sombra: lo que falta, lo distinto (valor y tipo) y lo que agregaria → 409; no escribe nada', async () => {
  const { g, deps } = armar({ modo: 'nube' });
  await M.correrMaestro({}, deps);
  // el maestro "como lo dejo Apps Script", con tres diferencias
  const V = filasDe(g, '02_Ventas_Maestro'), B = filasDe(g, '03_Banco_Industrial'), E = filasDe(g, '01b_FEL_Emitidas');
  V[5][4] = { v: 1000 };                    // FT10 TotalFinal
  B[6][1] = { v: '123456' };                // docto como TEXTO: mismo valor, otro tipo
  E[4] = [];                                // la emitida no esta
  const antes = escrituras(g).length, consultas = deps.pool.consultas.length;
  deps.pool = poolFalso('sombra');
  const r = await M.correrMaestro({ ahora: LUNES_26 }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(r.status, 409);
  const c = r.cuerpo;
  assert.deepStrictEqual([c.filas_que_agregaria, c.iguales, c.distintas, c.faltan], [1, 4, 2, 1]);
  assert.deepStrictEqual(c.detalle.agregaria.map((x) => [x.pestana, x.valores[1]]), [['01b_FEL_Emitidas', 'FACE01']]);
  assert.deepStrictEqual(c.detalle.faltan.map((x) => [x.pestana, x.llave]), [['01b_FEL_Emitidas', 'FACE01|5001']]);
  const d = Object.fromEntries(c.detalle.distintas.map((x) => [x.pestana, x]));
  assert.deepStrictEqual(d['02_Ventas_Maestro'].columnas, [{ col: 5, encabezado: 'TotalFinal', maestro: '1000', nube: '1100' }]);
  assert.strictEqual(d['02_Ventas_Maestro'].llave, 'FT10');
  assert.deepStrictEqual(d['03_Banco_Industrial'].columnas, [{ col: 2, encabezado: 'Docto', maestro: '123456 (texto)', nube: '123456 (numero)', tipo: true }]);
  assert.strictEqual(escrituras(g).length, antes, 'la sombra no escribe en el maestro');
  assert.ok(!deps.pool.consultas.some((q) => /maestro_archivos_procesados/.test(q.sql)), 'ni lee ni anota el registro');
  assert.ok(consultas > 0);
});

test('Sombra antes de que Apps Script cargue: todo lo de la semana "faltaria" y "se agregaria"', async () => {
  const { g, deps } = armar({ modo: 'sombra' });
  const r = await M.correrMaestro({ ahora: LUNES_26 }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual([r.cuerpo.filas_que_agregaria, r.cuerpo.iguales, r.cuerpo.distintas, r.cuerpo.faltan], [7, 0, 0, 7]);
  assert.ok(r.cuerpo.rondas <= 4, 'las faltas se piden juntas: ' + r.cuerpo.rondas + ' rondas');
  assert.strictEqual(escrituras(g).length, 0);
});

test('Nube: un BANCO_BI que no cuadra se frena (409), no se escribe ni se marca; lo demas entra', async () => {
  const { g, deps } = armar({ modo: 'nube', debitos: 999 });
  const r = await M.correrMaestro({}, deps);
  assert.strictEqual(r.status, 409);
  assert.ok(r.cuerpo.avisos.some((a) => /BANCO_BI NO CUADRA/.test(a)));
  assert.strictEqual(filasDe(g, '03_Banco_Industrial').length, 6);
  assert.strictEqual(r.cuerpo.escritas, 5);
  assert.ok(![...deps.pool.reg].some((h) => /^BANCO43:/.test(h)), 'el banco frenado se reintenta la proxima vez');
  assert.strictEqual(deps.pool.reg.size, 3);
});

test('Nube: si alguien escribio en las filas destino (dos escritores), no escribe nada → 409', async () => {
  const { g, deps } = armar({ modo: 'nube', antesDeRevisar: (api) => { api.L[M.MAESTRO].hojas['02_Ventas_Maestro'].M[5] = [{ v: 'FT10' }]; } });
  const r = await M.correrMaestro({}, deps);
  assert.strictEqual(r.status, 409);
  assert.match(r.cuerpo.error, /02_Ventas_Maestro fila 6.*No se escribio nada/);
  assert.strictEqual(escrituras(g).length, 0);
  assert.strictEqual(deps.pool.reg.size, 0);
});

test('El maestro en otra zona horaria: no corre (como _zonaCargaIgual_)', async () => {
  const { g, deps } = armar({ modo: 'nube', zona: 'America/Mexico_City' });
  await assert.rejects(M.correrMaestro({}, deps), (e) => e.status === 409 && /zona America\/Mexico_City/.test(e.message));
  assert.strictEqual(escrituras(g).length, 0);
});

test('Nube sin permiso de escritura o sin Drive: 503 sin tocar nada; un reloj simulado solo en sombra', async () => {
  const a = armar({ modo: 'nube', sinEscritura: true });
  await assert.rejects(M.correrMaestro({}, a.deps), (e) => e.status === 503);
  const b = armar({ modo: 'sombra' });
  await assert.rejects(M.correrMaestro({}, Object.assign({}, b.deps, { drive: null })), (e) => e.status === 503);
  const c = armar({ modo: 'nube' });
  await assert.rejects(M.correrMaestro({ ahora: LUNES_26 }, c.deps), (e) => e.status === 400);
});

test('El cargador no puede escribir fuera de sus pestañas ni con dimensiones que Apps Script rechazaria', () => {
  const p = (filas) => ({ valores: filas, formulas: new Map(), ultima: filas.length });
  const maestro = { id: M.MAESTRO, zona: 'America/Guatemala', titulos: ['00_Proveedores', '02_Ventas_Maestro'], props: {},
    pestanas: { '00_Proveedores': p([['A']]), '02_Ventas_Maestro': p([['x']]) } };
  const m = M.crearMotorMaestro(maestro, { libros: {}, carpetas: {}, respuestas: {} }, {});
  const ss = m.ctx.SpreadsheetApp.openById(M.MAESTRO);
  assert.throws(() => ss.getSheetByName('00_Proveedores').getRange(2, 1, 1, 1).setValues([['B']]), /no escribe en 00_Proveedores/);
  assert.throws(() => ss.getSheetByName('02_Ventas_Maestro').getRange(2, 1, 1, 2).setValues([['B']]), /dimensiones/);
  assert.strictEqual(ss.getSheetByName('No existe'), null);
  assert.strictEqual(M.tipoEsperado('09296263', '01_FEL_Maestro', 3), 'texto');
  assert.strictEqual(M.tipoEsperado('09296263', '02_Ventas_Maestro', 8), 'numero');
  assert.strictEqual(M.tipoEsperado('2026-10-05', '03_Banco_Industrial', 1), 'fecha');
});

test('La ruta: clave de tareas, apps no hace nada, ahora mal escrito 400 y una sombra', async () => {
  const { deps } = armar({ modo: 'sombra' });
  const app = express(); app.use(express.json());
  M.montarMaestro(app, Object.assign({}, deps, { claveTareas: 'CLAVE', sheetsEscritura: null }));
  const srv = app.listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/tareas/procesos/maestro';
  const post = (cuerpo, clave) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': clave === undefined ? 'CLAVE' : clave }, body: JSON.stringify(cuerpo || {}) })
    .then(async (r) => ({ status: r.status, j: await r.json() }));
  try {
    assert.strictEqual((await post({}, 'mala')).status, 403);
    assert.strictEqual((await post({ ahora: 'ayer' })).status, 400);
    const r = await post({ ahora: '2026-10-26T12:00:00-06:00' });
    assert.strictEqual(r.status, 409);
    assert.deepStrictEqual([r.j.modo, r.j.filas_que_agregaria, r.j.faltan], ['sombra', 7, 7]);
    deps.pool = poolFalso(null);
    const app2 = express(); app2.use(express.json());
    M.montarMaestro(app2, Object.assign({}, deps, { claveTareas: 'CLAVE' }));
    const srv2 = app2.listen(0);
    try {
      const r2 = await fetch('http://127.0.0.1:' + srv2.address().port + '/tareas/procesos/maestro', { method: 'POST', headers: { 'x-rosanta-tarea': 'CLAVE' } });
      assert.strictEqual(r2.status, 200);
      assert.deepStrictEqual(await r2.json(), { modo: 'apps' });
    } finally { srv2.close(); }
  } finally { srv.close(); }
});
