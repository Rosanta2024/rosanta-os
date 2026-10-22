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
  assert.deepStrictEqual(valores(B[10], 9).slice(3, 9), ['COBRO EMISI?N ESTADO DE CUENTA', 10, 0, 540.5, 'COMISIONES_BANCARIAS', 'No'],
    'COBRO EMISION es comision (Juanma, 22-oct): la regla gana a la historia, que decia TRANSFERENCIA');
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
    [d(2026, 10, 31), 'INTERES COM', 33.33, 0, 'INTERESES_BANCARIOS', 'No']]);
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
    ['2026-10-15', 'INTERES MORATORIO (BI)', 5.5, 0, 'INTERESES_BANCARIOS', 'No'], ['2026-10-31', 'INTER/DEVENGADO (BI)', 0, 0, 'INTERESES_BANCARIOS', 'No']]);
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

// ---- decisiones de Juanma del 22-oct-2026 ------------------------------------------------------------------------

const vm = require('vm');
const DIR_AS = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-maestro');

/** Un motor con el maestro dado (pestañas como matrices, formulas { f: A1 }) y la precarga dada. */
function motor(tabs, estado) {
  const maestro = { id: M.MAESTRO, zona: 'America/Guatemala', titulos: Object.keys(tabs), props: {}, pestanas: {} };
  Object.keys(tabs).forEach((n) => { maestro.pestanas[n] = { valores: tabs[n].map((r) => r.map((x) => (x && x.f ? '' : x))), formulas: new Map(), ultima: tabs[n].length }; });
  Object.keys(tabs).forEach((n) => tabs[n].forEach((r, i) => r.forEach((x, j) => {
    if (x && x.f) { const Fo = maestro.pestanas[n].formulas; if (!Fo.has(i + 1)) Fo.set(i + 1, {}); Fo.get(i + 1)[j + 1] = x.f; }
  })));
  return { maestro, m: M.crearMotorMaestro(maestro, Object.assign({ libros: {}, carpetas: {}, respuestas: {} }, estado || {}), {}) };
}

test('Reglas: COBRO EMISION → COMISIONES_BANCARIAS; Netflix, Spotify y Apple → CUOTAS_Y_SUSCRIPCIONES con Es_Personal No, aunque la historia diga PERSONAL', async () => {
  const { m } = motor(maestroInicial());
  const P = { porDesc: { 'NETFLIX.COM 844-0000000': 'PERSONAL', 'SPOTIFY P1234 STOCKHOLM': 'PERSONAL', 'COBRO EMISI?N ESTA': 'TRANSFERENCIA' }, porRaiz: {} };
  const cat = (desc, donde, cod) => m.ctx._cbCategoria({ desc: m.ctx._cbDesc(desc), cod: cod || '', cat: '' }, donde, P)[0];
  assert.strictEqual(cat('COBRO EMISI\u0099N ESTADO DE CUENTA', 'cuenta', 'TF'), 'COMISIONES_BANCARIAS');
  assert.strictEqual(cat('NETFLIX.COM              844-0000000', 'tarjeta'), 'CUOTAS_Y_SUSCRIPCIONES');
  assert.strictEqual(cat('Spotify P1234            Stockholm', 'tarjeta'), 'CUOTAS_Y_SUSCRIPCIONES');
  assert.strictEqual(cat('APPLE.COM/BILL           866-000-000', 'tarjeta'), 'CUOTAS_Y_SUSCRIPCIONES');
  // y en la carga: la tarjeta con historia PERSONAL para Netflix entra como CUOTAS / No
  const tabs = maestroInicial();
  tabs['05_Tarjeta_Credito_BAC'].splice(5, 0, [new Date(2026, 8, 12), 'NETFLIX.COM              866-000-000', 0, 6.99, 'PERSONAL', 'Sí', f('=YEAR(A6)'), f('=MONTH(A6)'), f('=WEEKNUM(A6,21)')]);
  const { g, deps } = armar({ maestro: tabs });
  const r = await M.correrMaestro({ cierreBancos: '2026-10' }, deps);
  assert.strictEqual(r.status, 200, JSON.stringify(r.cuerpo.avisos));
  const net = H(g, '05_Tarjeta_Credito_BAC').map((x) => valores(x, 6)).find((x) => x[0] === d(2026, 10, 12));
  assert.deepStrictEqual(net.slice(4), ['CUOTAS_Y_SUSCRIPCIONES', 'No']);
});

test('crearPestanaBacUsd: crea 04b_Banco_BAC_USD despues de 04_Banco_BAC con su cabecera; si ya existe no hace nada', () => {
  const llamadas = [];
  function hoja(nombre, indice) {
    return { getName: () => nombre, getIndex: () => indice, getFrozenRows: () => 4, setFrozenRows: (n) => llamadas.push(['congelar', nombre, n]),
      getColumnWidth: (c) => 100 + c, setColumnWidth: (c, w) => llamadas.push(['ancho', nombre, c, w]),
      getRange: (fi, c, nf, nc) => ({
        copyTo: (destino) => llamadas.push(['copiar', nombre, fi, c, nf, nc, destino.hoja, destino.fi, destino.c, destino.nf, destino.nc]),
        setValue: (v) => llamadas.push(['valor', nombre, fi, c, v]), hoja: nombre, fi, c, nf, nc }) };
  }
  const libro = (existe) => {
    const hojas = { '04_Banco_BAC': hoja('04_Banco_BAC', 7) };
    if (existe) hojas['04b_Banco_BAC_USD'] = hoja('04b_Banco_BAC_USD', 8);
    return { getSheetByName: (n) => hojas[n] || null,
      insertSheet: (n, i) => { llamadas.push(['insertar', n, i]); hojas[n] = hoja(n, i + 1); return hojas[n]; } };
  };
  let actual = null;
  const ctx = { SpreadsheetApp: { openById: (id) => { llamadas.push(['abrir', id]); return actual; } } };
  vm.createContext(ctx);
  ['cargador.js', 'cierre_bancos.js'].forEach((x) => vm.runInContext(fs.readFileSync(path.join(DIR_AS, x), 'utf8'), ctx));

  actual = libro(true);
  assert.strictEqual(ctx.crearPestanaBacUsd(), 'Ya existe 04b_Banco_BAC_USD: no se toco nada.');
  assert.deepStrictEqual(llamadas, [['abrir', M.MAESTRO]]);

  llamadas.length = 0; actual = libro(false);
  assert.strictEqual(ctx.crearPestanaBacUsd(), 'Creada 04b_Banco_BAC_USD.');
  assert.deepStrictEqual(llamadas.slice(0, 3), [['abrir', M.MAESTRO], ['insertar', '04b_Banco_BAC_USD', 7],
    ['copiar', '04_Banco_BAC', 1, 1, 4, 12, '04b_Banco_BAC_USD', 1, 1, 4, 12]]);
  assert.strictEqual(llamadas.filter((x) => x[0] === 'ancho').length, 12);
  assert.deepStrictEqual(llamadas.find((x) => x[0] === 'ancho' && x[2] === 4), ['ancho', '04b_Banco_BAC_USD', 4, 104]);
  assert.ok(llamadas.some((x) => x[0] === 'congelar' && x[2] === 4));
  assert.ok(llamadas.some((x) => x[0] === 'valor' && x[2] === 1 && /DÓLARES 905757274/.test(x[4])));
  assert.ok(!llamadas.some((x) => x[0] === 'valor' && x[1] === '04_Banco_BAC'), 'no toca la pestaña de quetzales');
});

// La carga aparte de enero a abril: cargos sin fecha de la tarjeta BAC + reclasificacion de Netflix/Spotify/Apple.
const TC_ENE = { producto: '4966-64**-****-2794', corte: '31/01/2026', previo: [500, 20], contadoMal: 0,
  tarjetas: { '4966-64**-****-1638': [['02/01/2026', 'NETFLIX.COM              844-0000000', 0, 5.5], ['10/01/2026', 'TIENDA INVENTADA', 80, 0]] },
  sinFecha: [['CARGOS POR SERVICIO MES ANTERIOR', 0, 3.25], ['INTERES COM', 44.4, 0]] };
const TC_FEB = Object.assign({}, TC_ENE, { corte: '28/02/2026', previo: [624.4, 28.75],
  tarjetas: { '4966-64**-****-1638': [['05/02/2026', 'Spotify P9999            Stockholm', 0, 7.7]] }, sinFecha: [['INTERES COM', 41.1, 0]] });
function maestroCsf() {
  const fTc = (r) => [f('=YEAR(A' + r + ')'), f('=MONTH(A' + r + ')'), f('=WEEKNUM(A' + r + ',21)')];
  return {
    '00_Proveedores': [['x']],
    '05_Tarjeta_Credito_BAC': [['TARJETA BAC'], [''], [''], ENC_TC,
      [new Date(2026, 0, 2), 'NETFLIX.COM              844-0000000', 0, 5.5, 'PERSONAL', 'Sí'].concat(fTc(5)),
      [new Date(2026, 0, 10), 'TIENDA INVENTADA', 80, 0, 'ALIMENTOS', 'No'].concat(fTc(6)),
      [new Date(2026, 1, 5), 'Spotify P9999            Stockholm', 0, 7.7, 'PERSONAL', 'Sí'].concat(fTc(7)),
      [new Date(2026, 7, 2), 'NETFLIX.COM 866-000-000', 0, 6.6, 'PERSONAL', 'Sí'].concat(fTc(8)),   // agosto: fuera de ene-jul
      [new Date(2026, 4, 31), 'INTERES COM', 50, 0, 'COMISIONES_BANCARIAS', 'No'].concat(fTc(9)),
      [new Date(2026, 6, 8), 'APPLE.COM/BILL 866-000-000', 0, 12.34, 'PERSONAL', 'Sí'].concat(fTc(10))],
    '06_Tarjeta_Credito_BI': [['TARJETA BI'], [''], [''], ENC_TC,
      [new Date(2026, 8, 15), 'INTERES MORATORIO (BI)', 1.11, 0, 'COMISIONES_BANCARIAS', 'No'].concat(fTc(5)),
      [new Date(2026, 8, 16), 'PAGO TARJETA X1', -50, 0, 'PAGO_TARJETA', 'No'].concat(fTc(6))]
  };
}
const CSF_ID = '1DY3-hLOs4h5AX-nKPtgw-n5z6GOvwpY_';
function motorCsf(tabs, archivos) {
  const carpeta = { nombre: 'BAC_TC 2026', carpetas: [], archivos: [] }, textos = {};
  archivos.forEach((a, i) => { carpeta.archivos.push({ id: 'T' + i, nombre: a[0], mime: 'text/csv', modificado: '2026-05-08T22:00:00.000Z' }); textos['T' + i] = a[1].toString('latin1'); });
  const x = motor(tabs, { carpetas: { [CSF_ID]: carpeta }, textos });
  vm.runInContext(fs.readFileSync(path.join(DIR_AS, 'cargos_sin_fecha_tc_bac.js'), 'utf8'), x.m.ctx);
  vm.runInContext('CSF_RECLAS_ESPERADAS = 3; CSF_INTERESES_ESPERADOS = 2;', x.m.ctx);   // en la fixtura 3 y 2 (las de verdad, 12 y 7)
  return x;
}
const ARCH_CSF = () => [['BAC - TC 2026-01.csv', F.csvTarjeta(TC_ENE)], ['BAC - TC 2026-02.csv', F.csvTarjeta(TC_FEB)], ['BAC - TC 2026-05.txt', Buffer.from('otra cosa')]];

test('Cargos sin fecha ene-abr: revisar no escribe; cargar agrega SOLO INTERES COM y CARGOS POR SERVICIO al corte y reclasifica Netflix/Spotify/Apple de ene-jul', () => {
  const a = motorCsf(maestroCsf(), ARCH_CSF());
  const r0 = a.m.correr('revisarCargosSinFechaTcBac');
  assert.strictEqual(r0.error, null, r0.logs.join('\n'));
  assert.deepStrictEqual(r0.ops, []);
  const l0 = r0.logs.join('\n');
  assert.match(l0, /Filas que agregaria: 3/);
  assert.match(l0, /Filas que reclasificaria: 3/);
  assert.match(l0, /Intereses que pasaria a INTERESES_BANCARIOS: 2/);
  assert.match(l0, /2026-03: no encontre el CSV de la tarjeta/);

  const b = motorCsf(maestroCsf(), ARCH_CSF());
  const r = b.m.correr('cargarCargosSinFechaTcBac');
  assert.strictEqual(r.error, null, r.logs.join('\n'));
  const vals = r.ops.filter((x) => x.tipo === 'valores');
  const nuevas = JSON.parse(JSON.stringify(vals.filter((x) => x.col === 1).map((x) => [x.fila, x.valores])));
  assert.deepStrictEqual(nuevas, [
    [11, [['2026-01-31', 'CARGOS POR SERVICIO MES ANTERIOR', 0, 3.25, 'COMISIONES_BANCARIAS', 'No'], ['2026-01-31', 'INTERES COM', 44.4, 0, 'INTERESES_BANCARIOS', 'No']]],
    [13, [['2026-02-28', 'INTERES COM', 41.1, 0, 'INTERESES_BANCARIOS', 'No']]]]);
  assert.ok(!JSON.stringify(nuevas).includes('TIENDA') && !JSON.stringify(nuevas).includes('NETFLIX'), 'las compras con fecha no se tocan');
  const reclas = JSON.parse(JSON.stringify(vals.filter((x) => x.col === 5 && x.nc === 2).map((x) => [x.fila, x.valores])));
  const intereses = JSON.parse(JSON.stringify(vals.filter((x) => x.col === 5 && x.nc === 1).map((x) => [x.pestana, x.fila, x.valores])));
  assert.deepStrictEqual(intereses, [['05_Tarjeta_Credito_BAC', 9, [['INTERESES_BANCARIOS']]], ['06_Tarjeta_Credito_BI', 5, [['INTERESES_BANCARIOS']]]],
    'solo la Categoria; los INTERES COM de enero que se acaban de cargar ya entran como INTERESES_BANCARIOS');
  assert.deepStrictEqual(reclas, [[5, [['CUOTAS_Y_SUSCRIPCIONES', 'No']]], [7, [['CUOTAS_Y_SUSCRIPCIONES', 'No']]], [10, [['CUOTAS_Y_SUSCRIPCIONES', 'No']]]], 'agosto no se toca');
  assert.ok(r.ops.some((x) => x.tipo === 'formulasR1C1' && x.fila === 11));

  // otra vez sobre lo que quedo: no agrega ni reclasifica nada
  const tabs2 = maestroCsf();
  ['05_Tarjeta_Credito_BAC', '06_Tarjeta_Credito_BI'].forEach((n) => {
    const T = r.trabajo[n];
    tabs2[n] = T.M.map((row, i) => row.map((x, j) => { const fo = T.formulas.get(i + 1); return fo && fo[j + 1] ? { f: fo[j + 1] } : x; }));
  });
  const c = motorCsf(tabs2, ARCH_CSF());
  const r2 = c.m.correr('cargarCargosSinFechaTcBac');
  assert.strictEqual(r2.error, null, r2.logs.join('\n'));
  assert.deepStrictEqual(r2.ops, []);
  assert.match(r2.logs.join('\n'), /Filas nuevas en total: 0/);
  assert.match(r2.logs.join('\n'), /No queda ninguna fila de Netflix, Spotify o Apple en PERSONAL de ene-jul/);
  assert.match(r2.logs.join('\n'), /No queda ningun interes de may-sep en COMISIONES_BANCARIAS/);
});

test('Cargos sin fecha: si las filas a reclasificar no son las que se revisaron, no cambia ninguna; un estado que no cuadra no se toca', () => {
  const tabs = maestroCsf();
  tabs['05_Tarjeta_Credito_BAC'][6][4] = 'CUOTAS_Y_SUSCRIPCIONES';   // alguien ya cambio la de Spotify: quedan 2 y se esperaban 3
  const a = motorCsf(tabs, ARCH_CSF());
  const r = a.m.correr('cargarCargosSinFechaTcBac');
  assert.ok(!r.ops.some((x) => x.tipo === 'valores' && x.col === 5 && x.nc === 2), 'ninguna reclasificada');
  assert.match(r.logs.join('\n'), /hay 2 filas y la revision encontro 3\. Alguien las toco: no se cambia ninguna/);
  // y un interes de mas (alguien cargo otro): no se cambia ninguno de los intereses
  const t3 = maestroCsf();
  t3['06_Tarjeta_Credito_BI'].push([new Date(2026, 8, 30), 'INTER/DEVENGADO (BI)', 2.22, 0, 'COMISIONES_BANCARIAS', 'No', '', '', '']);
  const c = motorCsf(t3, ARCH_CSF());
  const r3 = c.m.correr('cargarCargosSinFechaTcBac');
  assert.ok(!r3.ops.some((x) => x.tipo === 'valores' && x.col === 5 && x.nc === 1), 'ningun interes cambiado');
  assert.match(r3.logs.join('\n'), /Intereses: hay 3 filas y la revision encontro 2/);

  const b = motorCsf(maestroCsf(), [['BAC - TC 2026-01.csv', F.csvTarjeta(Object.assign({}, TC_ENE, { contadoMal: 9 }))]]);
  const r2 = b.m.correr('cargarCargosSinFechaTcBac');
  assert.ok(!r2.ops.some((x) => x.tipo === 'valores' && x.col === 1), 'el estado de enero no cuadra: no se agrega nada');
  assert.match(r2.logs.join('\n'), /BAC - TC 2026-01\.csv .*NO CUADRA/);
});

test('El interes vive en UNA constante (CB_CAT_INTERES = INTERESES_BANCARIOS): la usan la regla del cierre (cuenta y tarjeta) y la carga aparte; los cargos por servicio siguen en COMISIONES', () => {
  const { m } = motor(maestroInicial());
  assert.strictEqual(m.ctx.CB_CAT_INTERES, 'INTERESES_BANCARIOS');
  const P = { porDesc: {}, porRaiz: {} };
  const cat = (desc, donde) => m.ctx._cbCategoria({ desc, cod: '', cat: '' }, donde || 'tarjeta', P)[0];
  assert.deepStrictEqual([cat('INTERES COM'), cat('INTERES MORATORIO (BI)'), cat('INTER/DEVENGADO (BI)'), cat('INTERESES SOBRE SALDO', 'cuenta'), cat('CARGOS POR SERVICIO MES ANTERIOR')],
    ['INTERESES_BANCARIOS', 'INTERESES_BANCARIOS', 'INTERESES_BANCARIOS', 'INTERESES_BANCARIOS', 'COMISIONES_BANCARIAS']);
  // se cambia en un solo lugar y cambian las dos cargas
  vm.runInContext("CB_CAT_INTERES = 'OTRA_PRUEBA';", m.ctx);
  assert.strictEqual(cat('INTERES COM'), 'OTRA_PRUEBA');
  const b = motorCsf(maestroCsf(), ARCH_CSF());
  vm.runInContext("CB_CAT_INTERES = 'OTRA_PRUEBA';", b.m.ctx);
  const r = b.m.correr('cargarCargosSinFechaTcBac');
  const filas = JSON.parse(JSON.stringify(r.ops.filter((x) => x.tipo === 'valores' && x.col === 1).map((x) => x.valores))).flat();
  assert.deepStrictEqual(filas.map((x) => [x[1], x[4]]), [['CARGOS POR SERVICIO MES ANTERIOR', 'COMISIONES_BANCARIAS'], ['INTERES COM', 'OTRA_PRUEBA'], ['INTERES COM', 'OTRA_PRUEBA']]);
});
