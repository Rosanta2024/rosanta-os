// El cierre de bancos (22-oct-2026): banco-normalizar.js (SheetJS), la herramienta de la Mac y cierre_bancos.js corriendo
// en la nube (proc-maestro.js). Archivos del banco INVENTADOS con el formato exacto de los reales (fixtura-bancos.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('../src/proc-maestro');
const N = require('../src/banco-normalizar');
const F = require('./fixtura-bancos');
const { google, poolFalso } = require('./google-falso');
const { serieDeFecha } = require('../src/escribir-hoja');
const herramienta = require('../../herramientas/xls-a-csv-banco');

const XLS = 'application/vnd.ms-excel';
const f = (x) => ({ f: x });
const ENC_BAC = ['Fecha', 'Referencia', 'Codigo', 'Descripción', 'Débito', 'Crédito', 'Balance', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
const ENC_TC = ['Fecha', 'Descripción', 'Quetzales', 'Dólares', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
const formBac = (r) => [f('=YEAR(A' + r + ')'), f('=MONTH(A' + r + ')'), f('=WEEKNUM(A' + r + ',21)')];
const vaciaBac = (r) => ['', '', '', '', '', '', '', '', '', f('=IF(A' + r + '="","",YEAR(A' + r + '))'), f('=IF(A' + r + '="","",MONTH(A' + r + '))'), f('=IF(A' + r + '="","",WEEKNUM(A' + r + ',21))')];
const vaciaTc = (r) => ['', '', '', '', '', '', f('=IF(A' + r + '="","",YEAR(A' + r + '))'), f('=IF(A' + r + '="","",MONTH(A' + r + '))'), f('=IF(A' + r + '="","",WEEKNUM(A' + r + ',21))')];

/** El maestro de mentira: septiembre cargado (con su historia de categorias) y filas vacias con formulas, como el real. */
function maestroInicial(o) {
  const op = o || {};
  const t = {
    '00_Proveedores': [['Establecimiento', 'x', 'Categoria', 'Personal']],
    '04_Banco_BAC': [['BANCO BAC'], [''], [''], ENC_BAC,
      [new Date(2026, 8, 10), '406000001', 'TF', 'TEF A : 123456789', 20, 0, 80, 'PERSONAL', 'Si'].concat(formBac(5)),
      [new Date(2026, 8, 20), 99999, 'TF', 'COBRO EMISI?N ESTA', 10, 0, 70, 'TRANSFERENCIA', 'No'].concat(formBac(6)),
      [new Date(2026, 8, 25), 500000001, 'MC', 'ACH DE Proveedor Inv', 0, 30.5, op.balanceSep === undefined ? 100.5 : op.balanceSep, 'INGRESO_TRANSFERENCIA', 'No'].concat(formBac(7)),
      vaciaBac(8), vaciaBac(9), vaciaBac(10)],
    '05_Tarjeta_Credito_BAC': [['TARJETA BAC'], [''], [''], ENC_TC,
      [new Date(2026, 8, 20), 'PANADERÍA INVENTADA      ANTIGUA', 30, 0, 'ALIMENTOS', 'No', f('=YEAR(A5)'), f('=MONTH(A5)'), f('=WEEKNUM(A5,21)')],
      [new Date(2026, 8, 21), 'CAFE DE JUANMA', 30, 0, 'PERSONAL', 'Sí', f('=YEAR(A6)'), f('=MONTH(A6)'), f('=WEEKNUM(A6,21)')],
      // una fila de octubre que alguien ya cargo a mano (con espacios dobles, como las de enero)
      [new Date(2026, 9, 3), 'PANADERÍA INVENTADA      ANTIGUA', 45, 0, 'ALIMENTOS', 'No', f('=YEAR(A7)'), f('=MONTH(A7)'), f('=WEEKNUM(A7,21)')],
      vaciaTc(8), vaciaTc(9)],
    '06_Tarjeta_Credito_BI': [['TARJETA BI'], [''], [''], ENC_TC,
      [new Date(2026, 8, 16), 'PAGO TARJETA X1', -200, 0, 'PAGO_TARJETA', 'No', f('=IF(A5="","",YEAR(A5))'), f('=IF(A5="","",MONTH(A5))'), f('=IF(A5="","",WEEKNUM(A5,21))')]]
  };
  if (!op.sinUsd) t['04b_Banco_BAC_USD'] = [['BANCO BAC USD'], [''], [''], ENC_BAC];
  return t;
}

const MENSUAL = 'RMEN', MES10 = 'C10', SIS10 = 'S10';
/** Drive de mentira: Reportes 2026/Reportes Mensual/2026-10/_sistema con los archivos que se pasen. */
function driveFalso(archivos) {
  const d = { bajados: [], carpetasPedidas: [] };
  const bytes = {};
  const carpetas = {
    [M.REPORTES_2026]: { nombre: 'Reportes 2026', archivos: [], carpetas: [{ id: MENSUAL, nombre: 'Reportes Mensual' }, { id: 'C43', nombre: 'S43' }] },
    [MENSUAL]: { nombre: 'Reportes Mensual', archivos: [], carpetas: [{ id: MES10, nombre: '2026-10' }, { id: 'C09', nombre: '2026-09' }] },
    [MES10]: { nombre: '2026-10', carpetas: [{ id: SIS10, nombre: '_sistema' }], archivos: [{ id: 'PDF', nombre: 'BAC Q 2026-10.pdf', mime: 'application/pdf', modificado: '2026-11-04T15:00:00.000Z' }] },
    [SIS10]: { nombre: '_sistema', carpetas: [], archivos: [] }
  };
  (archivos || []).forEach((a, i) => {
    bytes[a.id] = a.bytes;
    carpetas[SIS10].archivos.push({ id: a.id, nombre: a.nombre, mime: a.mime, modificado: '2026-11-04T15:0' + i + ':00.000Z' });
  });
  return Object.assign(d, {
    async carpeta(id) { d.carpetasPedidas.push(id); if (!carpetas[id]) throw new Error('Drive 404 ' + id); return JSON.parse(JSON.stringify(carpetas[id])); },
    async bajar(id) { d.bajados.push(id); if (!bytes[id]) throw new Error('Drive 404 ' + id); return Buffer.from(bytes[id]); },
    async meta(id) { throw new Error('no se pide meta ' + id); }
  });
}
const ARCHIVOS = () => [
  { id: 'XQ', nombre: 'Transacciones del mes.xls', mime: XLS, bytes: F.xlsCuenta(F.Q_OCT) },
  { id: 'XU', nombre: 'BAC $ 2026-10.xls', mime: XLS, bytes: F.xlsCuenta(F.USD_OCT) },
  { id: 'TCC', nombre: 'TC BAC 2026-10 banco.csv', mime: 'text/csv', bytes: F.csvTarjeta(F.TC_OCT) }
];

function armar(o) {
  const op = o || {};
  const g = google();
  g.crear(M.MAESTRO, op.maestro || maestroInicial(op));
  const drive = driveFalso(op.archivos || ARCHIVOS());
  const deps = { sheetsLectura: g, drive, sheetsEscritura: g, pool: poolFalso(op.modo || 'nube', op.registro) };
  return { g, drive, deps };
}
const H = (g, tab) => g.L[M.MAESTRO].hojas[tab].M;
const valores = (fila, n) => fila.slice(0, n).map((x) => (x ? x.v : ''));
const escrituras = (g) => g.llamadas.filter((x) => x[0] === 'batchUpdate' || x[0] === 'values.batchUpdate');
const d = (a, m, dd) => serieDeFecha(new Date(a, m - 1, dd));

// ---------------------------------------------------------------------------------------------------------------

test('Normalizador: el .xls del BAC (formato real, datos inventados) → el CSV normalizado; la cuenta sale del archivo', () => {
  const r = N.normalizar(F.xlsCuenta(F.Q_OCT), 'Transacciones del mes (3).xls');
  assert.deepStrictEqual([r.resumen.nombre, r.resumen.movimientos, r.resumen.debitos, r.resumen.creditos, r.resumen.final, r.resumen.generado],
    ['BAC Q 2026-10.csv', 8, 866, 1200.25, 434.75, '2026-11-04']);
  const l = r.texto.split('\n');
  assert.strictEqual(l[0], N.CAB_CUENTA);
  assert.strictEqual(l[1], 'INICIAL,904802543,QTZ,,,,Saldo inicial,,,100.50,');
  assert.strictEqual(l[2], 'MOV,904802543,QTZ,2026-10-01,111111111,L1,AFI00000000 LIQ11111111111,0.00,1000.00,1100.50,');
  assert.strictEqual(l[6], 'MOV,904802543,QTZ,2026-10-06,444444444,MC,"ACH DE Proveedor Inventado, S.A.",0.00,200.25,740.75,');
  assert.ok(l[5].includes('COBRO EMISI\u0099N'), 'el caracter raro del BAC se guarda tal cual; el cargador lo vuelve "?"');
  assert.strictEqual(l[10], 'TOTAL,904802543,QTZ,,,,Totales del banco,866.00,1200.25,434.75,');
  assert.strictEqual(l[11], 'GENERADO,904802543,QTZ,2026-11-04,,,Fecha en que se bajo del banco,,,,');
  assert.strictEqual(N.normalizar(F.xlsCuenta(F.USD_OCT), 'x.xls').resumen.nombre, 'BAC $ 2026-10.csv');
});

test('Normalizador: el CSV de la tarjeta BAC → normalizado (cargos sin fecha al corte, tarjeta adicional, coma en la descripcion)', () => {
  const r = N.normalizar(F.csvTarjeta(F.TC_OCT), 'TC BAC 2026-10 banco.csv');
  assert.deepStrictEqual([r.resumen.nombre, r.resumen.movimientos, r.resumen.corte], ['TC BAC 2026-10.csv', 8, '2026-10-31']);
  const l = r.texto.split('\n');
  assert.deepStrictEqual(l.slice(0, 3), [N.CAB_TARJETA, 'CORTE,4966-64**-****-2794,2026-10-31,Fecha de corte,,,', 'PREVIO,,,Saldo anterior,1000.00,50.00,']);
  assert.strictEqual(l[3], 'MOV,4966-64**-****-2794,2026-10-04,SU PAGO RECIBIDO GRACIAS,-300.00,0.00,');
  assert.strictEqual(l[5], 'MOV,4966-64**-****-1638,2026-10-03,PANADERÍA INVENTADA      ANTIGUA,45.00,0.00,');
  assert.strictEqual(l[7], 'MOV,4966-64**-****-1638,2026-10-09,"TIENDA, CON COMA         GUATEMALA",10.00,0.00,');
  assert.strictEqual(l[9], 'MOV,4966-64**-****-1638,2026-10-31,CARGOS POR SERVICIO MES ANTERIOR,0.00,2.50,');
  assert.strictEqual(l[11], 'CONTADO,,,Pago de contado,953.83,59.49,');
  assert.ok(!r.texto.includes('PUNTOS') && !r.texto.includes('ASIGNADO'));
});

test('Normalizador: no adivina — cadena rota, totales que no dan, cuenta desconocida, meses mezclados, contado que no da', () => {
  assert.throws(() => N.normalizar(F.xlsCuenta(Object.assign({}, F.Q_OCT, { romperEn: 2 })), 'a.xls'), /cadena de saldos se rompe en el movimiento 3/);
  assert.throws(() => N.normalizar(F.xlsCuenta(Object.assign({}, F.Q_OCT, { totalMal: 1 })), 'a.xls'), /no dan los Totales del banco/);
  assert.throws(() => N.normalizar(F.xlsCuenta(Object.assign({}, F.Q_OCT, { cuenta: '111222333' })), 'a.xls'), /"111222333" no es ninguna de las conocidas/);
  const mezcla = Object.assign({}, F.USD_OCT, { movs: [['30/09/2026', '1', 'PT', 'X', 1, 0], ['01/10/2026', '2', 'PT', 'Y', 1, 0]] });
  assert.throws(() => N.normalizar(F.xlsCuenta(mezcla), 'a.xls'), /2026-09, 2026-10; tiene que ser un solo mes/);
  assert.throws(() => N.normalizar(F.csvTarjeta(Object.assign({}, F.TC_OCT, { contadoMal: 5 })), 'a.csv'), /no da el pago de contado/);
  assert.strictEqual(N.normalizar(Buffer.from(N.CAB_CUENTA + '\n'), 'ya.csv'), null, 'el normalizado no se vuelve a normalizar');
  assert.strictEqual(N.normalizar(Buffer.from('Fecha,TT,Descripción\n'), 'otro.csv'), null);
});

test('Nube: el cierre de octubre escribe las tres pestañas con los tipos de Apps Script, sin duplicar, y anota los procesados', async () => {
  const { g, drive, deps } = armar();
  const r = await M.correrMaestro({ cierreBancos: '2026-10' }, deps);
  assert.strictEqual(r.status, 200, JSON.stringify(r.cuerpo));
  const c = r.cuerpo;
  assert.strictEqual(c.escritas, 8 + 2 + 7);
  assert.ok(!drive.bajados.includes('PDF'), 'los PDF son del contador: el sistema no los lee');
  assert.ok(c.avisos.some((a) => /\(cuenta 904802543\): 1 movimiento\(s\) quedan POR_CLASIFICAR/.test(a)), c.avisos.join(' | '));
  assert.ok(c.avisos.some((a) => /\(tarjeta 4966-64\*\*-\*\*\*\*-2794\): 1 de 8 movimientos ya estaban/.test(a)));

  // 04_Banco_BAC: desde la fila 8 (despues de la ultima con datos, sobre las filas que ya traian formulas)
  const B = H(g, '04_Banco_BAC');
  assert.deepStrictEqual(valores(B[7], 9), [d(2026, 10, 1), 111111111, 'L1', 'AFI00000000 LIQ11111111111', 0, 1000, 1100.5, 'INGRESO_TARJETA', 'No']);
  assert.strictEqual(B[7][0].fmt, 'DATE');
  assert.deepStrictEqual(valores(B[9], 9).slice(3), ['TEF A : 123456789', 50, 0, 550.5, 'PERSONAL', 'Si'], 'categoria por historia; Es_Personal como lo escribe la pestaña');
  assert.deepStrictEqual(valores(B[10], 9).slice(3, 8), ['COBRO EMISI?N ESTADO DE CUENTA', 10, 0, 540.5, 'TRANSFERENCIA'], 'el maestro tenia la descripcion cortada del PDF');
  assert.deepStrictEqual(valores(B[11], 9).slice(7), ['INGRESO_TRANSFERENCIA', 'No']);
  assert.deepStrictEqual([B[12][7].v, B[13][7].v, B[14][7].v], ['IMPUESTOS', 'COMISIONES_BANCARIAS', 'POR_CLASIFICAR']);
  assert.deepStrictEqual([B[7][9].f, B[14][11].f], ['=YEAR(A8)', '=WEEKNUM(A15,21)'], 'Año/Mes/Semana copiadas de la ultima fila con datos');
  assert.strictEqual(B.length, 15);
  // 04b_Banco_BAC_USD: pestaña vacia → Año, Mes y Semana como valores
  const U = H(g, '04b_Banco_BAC_USD');
  assert.deepStrictEqual(valores(U[4], 12), [d(2026, 10, 10), 777, 'PT', 'PAGO 4966-64**-****-9999', 15, 0, 5, 'PAGO_TARJETA_CREDITO', 'No', 2026, 10, 41]);
  assert.deepStrictEqual(valores(U[5], 9).slice(6, 8), [3.5, 'COMISIONES_BANCARIAS']);
  // 05_Tarjeta_Credito_BAC: la panaderia repetida entra UNA vez (la otra ya estaba); espacios dobles fuera
  const T = H(g, '05_Tarjeta_Credito_BAC');
  const nuevasTc = T.slice(7).map((x) => valores(x, 6));
  assert.deepStrictEqual(nuevasTc, [
    [d(2026, 10, 4), 'SU PAGO RECIBIDO GRACIAS', -300, 0, 'PAGO_TARJETA', 'No'],
    [d(2026, 10, 2), 'FACEBK *ABCDEF1234 Dublin', 120.5, 0, 'MARKETING_DIGITAL', 'No'],
    [d(2026, 10, 3), 'PANADERÍA INVENTADA ANTIGUA', 45, 0, 'ALIMENTOS', 'No'],
    [d(2026, 10, 9), 'TIENDA, CON COMA GUATEMALA', 10, 0, 'POR_CLASIFICAR', 'No'],
    [d(2026, 10, 12), 'NETFLIX.COM 866-000-000', 0, 6.99, 'CUOTAS_Y_SUSCRIPCIONES', 'No'],
    [d(2026, 10, 31), 'CARGOS POR SERVICIO MES ANTERIOR', 0, 2.5, 'COMISIONES_BANCARIAS', 'No'],
    [d(2026, 10, 31), 'INTERES COM', 33.33, 0, 'COMISIONES_BANCARIAS', 'No']]);
  assert.strictEqual(T[7][6].f, '=YEAR(A8)');
  assert.deepStrictEqual(c.relectura, []);
  assert.deepStrictEqual([...deps.pool.reg].map((h) => h.split(':')[0]).sort(), ['TCC', 'XQ', 'XU']);

  // segunda corrida con el registro: no abre nada
  const n = escrituras(g).length;
  const r2 = await M.correrMaestro({ cierreBancos: '2026-10' }, deps);
  assert.deepStrictEqual([r2.status, r2.cuerpo.escritas], [200, 0]);
  // y SIN registro (base nueva): la deduplicacion tampoco repite
  const r3 = await M.correrMaestro({ cierreBancos: '2026-10' }, Object.assign({}, deps, { pool: poolFalso('nube') }));
  assert.deepStrictEqual([r3.status, r3.cuerpo.escritas], [200, 0]);
  assert.strictEqual(escrituras(g).length, n, 'ninguna escritura nueva');

  // la SOMBRA sobre lo que escribio la nube: todo igual
  const s = await M.correrMaestro({ modo: 'sombra', cierreBancos: '2026-10' }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(s.status, 200, JSON.stringify(s.cuerpo.detalle));
  assert.deepStrictEqual([s.cuerpo.filas_que_agregaria, s.cuerpo.iguales, s.cuerpo.valor, s.cuerpo.faltan, s.cuerpo.sobran], [0, 18, 0, 0, 0]);
  assert.strictEqual(escrituras(g).length, n, 'la sombra no escribe');
});

test('Sombra antes de cargar: todo "se agregaria" y "falta" (409); no escribe', async () => {
  const { g, deps } = armar({ modo: 'sombra' });
  const r = await M.correrMaestro({ cierreBancos: '2026-10' }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual([r.cuerpo.filas_que_agregaria, r.cuerpo.iguales, r.cuerpo.faltan, r.cuerpo.sobran], [17, 1, 17, 0]);
  assert.strictEqual(escrituras(g).length, 0);
});

test('Sombra: la descripcion cortada del PDF y la categoria cambiada a mano se cuentan aparte; un monto distinto es 409', async () => {
  const { g, deps } = armar();
  await M.correrMaestro({ cierreBancos: '2026-10' }, deps);
  const B = H(g, '04_Banco_BAC');
  B[7][3] = { v: 'AFI00000000 LIQ1111' };        // como la dejaba el PDF
  B[14][7] = { v: 'MANTENIMIENTO' };             // Juanma la clasifico despues
  const s1 = await M.correrMaestro({ modo: 'sombra', cierreBancos: '2026-10' }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(s1.status, 200, JSON.stringify(s1.cuerpo.detalle.diferencias));
  assert.deepStrictEqual([s1.cuerpo.iguales, s1.cuerpo.solo_desc_corta, s1.cuerpo.categoria], [16, 1, 1]);
  B[8][4] = { v: 499 };
  const s2 = await M.correrMaestro({ modo: 'sombra', cierreBancos: '2026-10' }, Object.assign({}, deps, { sheetsEscritura: null }));
  assert.strictEqual(s2.status, 409);
  // con el monto cambiado la llave ya no casa: falta la del archivo y sobra la del maestro
  assert.deepStrictEqual([s2.cuerpo.faltan, s2.cuerpo.sobran], [1, 1]);
});

test('Frena sin escribir esa cuenta: saldo inicial distinto al ultimo Balance, pestaña USD inexistente, bajado antes de fin de mes', async () => {
  const a = armar({ balanceSep: 99 });
  const r = await M.correrMaestro({ cierreBancos: '2026-10' }, a.deps);
  assert.strictEqual(r.status, 409);
  assert.ok(r.cuerpo.avisos.some((x) => /saldo inicial del banco \(100\.50\) no es el ultimo Balance de 04_Banco_BAC antes de 2026-10 \(99\.00\)/.test(x)), r.cuerpo.avisos.join(' | '));
  assert.strictEqual(H(a.g, '04_Banco_BAC').length, 10, 'la cuenta frenada no se escribe');
  assert.strictEqual(r.cuerpo.escritas, 9, 'lo demas si entra');
  assert.ok(![...a.deps.pool.reg].some((h) => /^XQ:/.test(h)), 'el archivo frenado se reintenta');

  const b = armar({ sinUsd: true });
  const r2 = await M.correrMaestro({ cierreBancos: '2026-10' }, b.deps);
  assert.ok(r2.cuerpo.avisos.some((x) => /no tiene la pestaña 04b_Banco_BAC_USD \(crearla con crearPestanaBacUsd/.test(x)));
  assert.strictEqual(r2.status, 409);

  const temprano = Object.assign({}, F.USD_OCT, { generado: 46320.5 });   // 2026-10-25
  const c = armar({ archivos: [{ id: 'XU', nombre: 'BAC $ 2026-10.xls', mime: XLS, bytes: F.xlsCuenta(temprano) }] });
  const r3 = await M.correrMaestro({ cierreBancos: '2026-10' }, c.deps);
  assert.ok(r3.cuerpo.avisos.some((x) => /se bajo del banco el 2026-10-25, antes de que terminara 2026-10/.test(x)));
  assert.strictEqual(r3.cuerpo.escritas, 0);
});

test('Dos archivos distintos de la misma cuenta y mes: frena y no adivina; el .xls y su CSV normalizado son uno solo', async () => {
  const otro = Object.assign({}, F.Q_OCT, { movs: F.Q_OCT.movs.slice(0, 3) });
  const a = armar({ archivos: ARCHIVOS().concat([{ id: 'XQ2', nombre: 'Transacciones del mes (1).xls', mime: XLS, bytes: F.xlsCuenta(otro) }]) });
  const r = await M.correrMaestro({ cierreBancos: '2026-10' }, a.deps);
  assert.strictEqual(r.status, 409);
  assert.ok(r.cuerpo.avisos.some((x) => /cuenta 904802543: hay 2 archivos distintos para 2026-10/.test(x)), r.cuerpo.avisos.join(' | '));
  assert.strictEqual(H(a.g, '04_Banco_BAC').length, 10);

  const csvQ = N.normalizar(F.xlsCuenta(F.Q_OCT), 'x.xls').texto;
  const b = armar({ archivos: ARCHIVOS().concat([{ id: 'CQ', nombre: 'BAC Q 2026-10.csv', mime: 'text/csv', bytes: Buffer.from(csvQ) }]) });
  const r2 = await M.correrMaestro({ cierreBancos: '2026-10' }, b.deps);
  assert.strictEqual(r2.status, 200, r2.cuerpo.avisos.join(' | '));
  assert.strictEqual(r2.cuerpo.escritas, 17);
  assert.ok(b.deps.pool.reg.size === 4, 'las dos huellas quedan anotadas');
});

test('Apps Script (sin ROSANTA_NUBE): lee solo el CSV normalizado; una fila mal formada frena y dice cual; el .xls pide la Mac', () => {
  const csvQ = N.normalizar(F.xlsCuenta(F.Q_OCT), 'x.xls').texto.split('\n');
  csvQ[3] = csvQ[3].replace('2026-10-02', '02/10/2026');
  const p = (filas) => ({ valores: filas, formulas: new Map(), ultima: filas.length });
  const ini = maestroInicial();
  const maestro = { id: M.MAESTRO, zona: 'America/Guatemala', titulos: Object.keys(ini), props: {}, pestanas: {} };
  Object.keys(ini).forEach((n) => { maestro.pestanas[n] = p(ini[n].map((r) => r.map((x) => (x && x.f ? '' : x)))); });
  const estado = { libros: {}, respuestas: {}, carpetas: {
    [M.REPORTES_2026]: { nombre: 'Reportes 2026', archivos: [], carpetas: [{ id: MENSUAL, nombre: 'Reportes Mensual' }] },
    [MENSUAL]: { nombre: 'Reportes Mensual', archivos: [], carpetas: [{ id: 'C10B', nombre: '2026-10 (1)' }] },
    C10B: { nombre: '2026-10 (1)', archivos: [], carpetas: [{ id: SIS10, nombre: '_sistema' }] },
    [SIS10]: { nombre: '_sistema', carpetas: [], archivos: [
      { id: 'CQ', nombre: 'BAC Q 2026-10.csv', mime: 'text/csv', modificado: '2026-11-04T15:00:00.000Z' },
      { id: 'XU', nombre: 'BAC $ 2026-10.xls', mime: XLS, modificado: '2026-11-04T15:00:00.000Z' }] } },
  textos: { CQ: csvQ.join('\n') } };
  const m = M.crearMotorMaestro(maestro, estado, {});
  m.ctx.ROSANTA_NUBE = undefined;
  const r = m.correr('revisarCierreBancos', ['2026-10']);
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(r.faltas, []);
  const log = r.logs.join('\n');
  assert.match(log, /2026-10 \(1\)\/_sistema\/BAC Q 2026-10\.csv \(cuenta 904802543\): fila 4: fecha ilegible "02\/10\/2026" \(va AAAA-MM-DD\)/);
  assert.match(log, />> 2026-10 \(1\)\/_sistema\/BAC Q 2026-10\.csv \(cuenta 904802543\): NO se escribio nada\./);
  assert.match(log, /BAC \$ 2026-10\.xls: es del banco y falta pasarlo al CSV normalizado/);
  assert.deepStrictEqual(r.ops, []);
});

test('Tarjeta BI pegada a mano: cuadra saldo anterior + movimientos = saldo final y entra a 06_Tarjeta_Credito_BI', () => {
  const p = (filas) => ({ valores: filas, formulas: new Map(), ultima: filas.length });
  const ini = maestroInicial();
  const maestro = { id: M.MAESTRO, zona: 'America/Guatemala', titulos: Object.keys(ini), props: {}, pestanas: {} };
  Object.keys(ini).forEach((n) => { maestro.pestanas[n] = p(ini[n].map((r) => r.map((x) => (x && x.f ? x.f : x)))); });
  maestro.pestanas['06_Tarjeta_Credito_BI'].formulas.set(5, { 7: '=IF(A5="","",YEAR(A5))', 8: '=IF(A5="","",MONTH(A5))', 9: '=IF(A5="","",WEEKNUM(A5,21))' });
  const lista = ['CORTE;2026-10-31', 'SALDO_ANTERIOR;100.00', 'SALDO_FINAL;155.50', '2026-10-05;TIENDA INVENTADA GT;50.00;ALIMENTOS',
    '2026-10-15;INTERES MORATORIO (BI);5.50', '2026-10-31;INTER/DEVENGADO (BI);0.00'].join('\n');
  const m = M.crearMotorMaestro(maestro, { libros: {}, carpetas: {}, respuestas: {} }, {});
  const r = m.correr('cargarTarjetaBIPegada', [lista]);
  assert.strictEqual(r.error, null, r.logs.join('\n'));
  const v = r.ops.filter((x) => x.tipo === 'valores')[0];
  assert.deepStrictEqual([v.pestana, v.fila], ['06_Tarjeta_Credito_BI', 6]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v.valores)), [['2026-10-05', 'TIENDA INVENTADA GT', 50, 0, 'ALIMENTOS', 'No'],
    ['2026-10-15', 'INTERES MORATORIO (BI)', 5.5, 0, 'COMISIONES_BANCARIAS', 'No'], ['2026-10-31', 'INTER/DEVENGADO (BI)', 0, 0, 'COMISIONES_BANCARIAS', 'No']]);
  // no cuadra → no escribe
  const m2 = M.crearMotorMaestro(maestro, { libros: {}, carpetas: {}, respuestas: {} }, {});
  const r2 = m2.correr('cargarTarjetaBIPegada', [lista.replace('155.50', '150.00')]);
  assert.deepStrictEqual(r2.ops, []);
  assert.match(r2.logs.join('\n'), /NO CUADRA: saldo anterior \+ movimientos = 155\.50 Q/);
});

test('Herramienta de la Mac: convierte _sistema con nombres fijos; se detiene con dos archivos de la misma cuenta o una cuenta desconocida', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cierre-bancos-'));
  const sis = path.join(tmp, '2026-10', '_sistema');
  fs.mkdirSync(sis, { recursive: true });
  fs.writeFileSync(path.join(sis, 'Transacciones del mes.xls'), F.xlsCuenta(F.Q_OCT));
  fs.writeFileSync(path.join(sis, 'Transacciones del mes (1).xls'), F.xlsCuenta(F.USD_OCT));
  fs.writeFileSync(path.join(sis, 'TC BAC 2026-10 banco.csv'), F.csvTarjeta(F.TC_OCT));
  const log = console.log; const salida = []; console.log = (...a) => salida.push(a.join(' '));
  try {
    assert.strictEqual(herramienta.main([sis]), 0, salida.join('\n'));
    assert.deepStrictEqual(fs.readdirSync(sis).filter((n) => /\.csv$/.test(n) && !/banco/.test(n)).sort(), ['BAC $ 2026-10.csv', 'BAC Q 2026-10.csv', 'TC BAC 2026-10.csv']);
    assert.strictEqual(fs.readFileSync(path.join(sis, 'BAC Q 2026-10.csv'), 'utf8'), N.normalizar(F.xlsCuenta(F.Q_OCT), 'x').texto);
    assert.strictEqual(herramienta.main([sis]), 0, 'la segunda vez no cambia nada');
    // dos de la misma cuenta y mes
    fs.writeFileSync(path.join(sis, 'BAC Q 2026-10.xls'), F.xlsCuenta(Object.assign({}, F.Q_OCT, { movs: F.Q_OCT.movs.slice(0, 2) })));
    fs.unlinkSync(path.join(sis, 'BAC Q 2026-10.csv'));
    salida.length = 0;
    assert.strictEqual(herramienta.main([sis]), 1);
    assert.ok(salida.some((x) => /BAC Q 2026-10\.csv: 2 archivos son de la misma cuenta y del mismo mes/.test(x)), salida.join('\n'));
    assert.ok(!fs.existsSync(path.join(sis, 'BAC Q 2026-10.csv')), 'no escribio nada');
    fs.unlinkSync(path.join(sis, 'BAC Q 2026-10.xls'));
    // cuenta desconocida
    fs.writeFileSync(path.join(sis, 'raro.xls'), F.xlsCuenta(Object.assign({}, F.Q_OCT, { cuenta: '111222333' })));
    salida.length = 0;
    assert.strictEqual(herramienta.main([sis]), 1);
    assert.ok(salida.some((x) => /"111222333" no es ninguna de las conocidas/.test(x)));
  } finally { console.log = log; fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('La ruta: cierre_bancos mal escrito → 400', async () => {
  await assert.rejects(M.correrMaestro({ modo: 'sombra', cierreBancos: '2026-13' }, {}), (e) => e.status === 400);
});
