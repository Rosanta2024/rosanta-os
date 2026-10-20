// El proceso de pauta de los lunes (20-oct-2026): el codigo real de Marketing OS con imitaciones y precarga.
// Datos inventados (nunca reservas, clientes ni ventas reales en el repo).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const P = require('../src/proc-pauta');
const { serieDeFecha } = require('../src/escribir-hoja');

const CRM = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';
const POS = '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP';
const LUNES_13 = Date.parse('2026-10-13T12:00:00-06:00');
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ---- hojas de mentira, con la forma que devuelve la API de Sheets ------------------------------------------------
function celda(x) {
  if (x instanceof Date) return { effectiveValue: { numberValue: serieDeFecha(x) }, effectiveFormat: { numberFormat: { type: 'DATE' } } };
  if (typeof x === 'number') return { effectiveValue: { numberValue: x } };
  if (x === '' || x === null || x === undefined) return {};
  return { effectiveValue: { stringValue: String(x) } };
}
function sheetsFalso(libros) {
  const pedidos = [];
  return { pedidos, libros, spreadsheets: { async get(p) {
    pedidos.push(p);
    const L = libros[p.spreadsheetId];
    if (!L) throw new Error('Sheets 404 ' + p.spreadsheetId);
    if (!p.includeGridData) return { data: { sheets: Object.keys(L).map((t) => ({ properties: { title: t } })) } };
    const nombres = p.ranges.map((r) => r.replace(/^'|'$/g, '').replace(/''/g, "'"));
    return { data: { sheets: nombres.map((t) => ({ properties: { title: t }, data: [{ rowData: L[t].map((r) => ({ values: r.map(celda) })) }] })) } };
  } } };
}
/** La hoja de verdad para escribir (values.get/batchUpdate/append), sobre una matriz. */
function sheetsEscrituraFalso(M) {
  const llamadas = [];
  const col = (l) => l.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
  return { M, llamadas, spreadsheets: { values: {
    async get() { return { data: { values: M.map((r) => r.map((x) => (x instanceof Date ? serieDeFecha(x) : x))) } }; },
    async batchUpdate(p) {
      llamadas.push(['batchUpdate', p.requestBody]);
      p.requestBody.data.forEach((d) => {
        const m = d.range.match(/!([A-Z]+)(\d+)$/); const f = Number(m[2]) - 1, c = col(m[1]) - 1;
        while (M.length <= f) M.push([]);
        while (M[f].length <= c) M[f].push('');
        M[f][c] = d.values[0][0];
      });
      return { data: {} };
    },
    async append(p) { llamadas.push(['append', p.requestBody]); M.push(p.requestBody.values[0].slice()); return { data: {} }; }
  } } };
}

const H = P.COLUMNAS;
function pauta() {
  return [H.slice(),
    [40, 100, 10, 1000, 200, 5000, 30, new Date(2026, 9, 4), 5, 60, 150, 3, 1],
    [41, 120.5, 12, 1100, 210, 5100, 2, new Date(2026, 9, 11), 4, 5, 275, 2, 2]];
}
const RES_H = ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'];
function reservasTab() {
  return [RES_H,
    ['r0', new Date(2026, 8, 30), 'E', 'e@x.com', '', 2, 0, 'CONFIRMED', 'SI'],      // S40: nueva
    ['r1', new Date(2026, 9, 6), 'A', 'a@x.com', '', 2, 0, 'CONFIRMED', 'SI'],       // S41: ya en la CRM desde 2025
    ['r2', new Date(2026, 9, 7), 'B', 'b@x.com', '', 2, 0, 'CONFIRMED', 'NO'],       // S41: nueva
    ['r3', new Date(2026, 9, 8), 'C', 'c@x.com', '', 2, 0, 'CANCELED', 'NO'],        // S41: cancelada, fuera
    ['r4', new Date(2026, 9, 9), 'D', '', '+502 5555-1234', 4, 0, 'CONFIRMED', 'NO'], // S41: nueva por telefono
    ['r5', new Date(2026, 9, 10), 'E', 'E@X.com', '', 2, 0, 'CONFIRMED', 'SI'],      // S41: ya vista en la S40
    ['r6', new Date(2026, 9, 14), 'F', 'f@x.com', '', 2, 0, 'CONFIRMED', 'SI']];     // S42: nueva (abierta el 13-oct)
}
function libros() {
  return {
    [P.LIBRO_MKT]: { calendario: [['id']], pauta_semanal: pauta(), reservas: reservasTab() },
    [CRM]: { Contactos: [['email', 'telefono', 'fecha_alta', 'ultima_reserva'], ['a@x.com', '', new Date(2025, 0, 10), new Date(2025, 5, 1)], ['g@x.com', '', new Date(2025, 0, 10), '']], Otra: [['x']] },
    // el ReporteFacturas de la S41 ya es Hoja de Google
    FACT41: { Hoja1: [['Tipo documento', 'No.', 'Fecha', 'Total', 'Notas', 'Estado'],
      ['Factura', 'FT1', new Date(2026, 9, 5), '1,100.00', '4', 'Finalizado'],
      ['Factura', 'FT2', new Date(2026, 9, 6, 13, 0), 500, '1 persona', 'Finalizado'],
      ['Factura', 'FT3', new Date(2026, 9, 10), 600, '2', 'Anulada'],
      ['TOTAL', '', '', 2200, '', '']] }
  };
}
// el xlsx de la S40 (sistema viejo): sus bytes son la matriz en JSON; "convertirlo" la registra como hoja
const VENTAS40 = [['TicketId', 'Fecha', 'TotalFinal', 'Notas', 'Estado', 'Es Contable'],
  [1001, '28/9/2026', 300, 2, 'Confirmado', 'si'],
  [1002, '29/9/2026', 450, 3, 'Confirmado', ''],
  [1003, '30/9/2026', 999, 4, 'Anulado', ''],
  ['', '', 1749, '', '', '']];
function driveFalso(sheets) {
  const d = { bajados: [], borrados: [], subidos: 0 };
  const carpetas = {
    [POS]: { nombre: 'Reportes 2026', carpetas: [{ id: 'S40', nombre: 'S40' }, { id: 'S41', nombre: 'S41' }], archivos: [] },
    S40: { nombre: 'S40', carpetas: [], archivos: [{ id: 'XL40', nombre: 'ReporteVentas_9_30_2026_1.xlsx', mime: XLSX, modificado: 't1' },
      { id: 'PR40', nombre: 'ReporteVentasProductos_9_30.xlsx', mime: XLSX, modificado: 't1' }] },
    S41: { nombre: 'S41', carpetas: [], archivos: [{ id: 'FACT41', nombre: 'ReporteFacturas_10_11', mime: 'application/vnd.google-apps.spreadsheet', modificado: 't1' }] }
  };
  Object.assign(d, {
    async carpeta(id) { if (!carpetas[id]) throw new Error('Drive 404'); return JSON.parse(JSON.stringify(carpetas[id])); },
    async meta(id) { return { id, mimeType: XLSX, modifiedTime: 't1' }; },
    async bajar(id) { d.bajados.push(id); return Buffer.from(JSON.stringify(id === 'XL40' ? VENTAS40 : [])); },
    async subirComoHoja(bytes, nombre, mime) {
      assert.strictEqual(mime, XLSX);
      const id = 'CONV' + (++d.subidos);
      sheets.libros[id] = { Hoja1: JSON.parse(bytes.toString()), Hoja2: [['otra']] };
      return id;
    },
    async borrar(id) { d.borrados.push(id); delete sheets.libros[id]; }
  });
  return d;
}
/** Wix de mentira: filtra por details.startDate y pagina como la API. */
function wixFalso(reservas) {
  const pedidos = [];
  const f = async (url, op) => {
    pedidos.push({ url, op });
    assert.ok(url.startsWith('https://www.wixapis.com/table-reservations/'));
    const b = JSON.parse(op.body).query;
    const desde = b.filter.$and[0]['details.startDate'].$gte, hasta = b.filter.$and[1]['details.startDate'].$lte;
    const todas = reservas.filter((r) => r.details.startDate >= desde && r.details.startDate <= hasta);
    const lote = todas.slice(b.paging.offset, b.paging.offset + b.paging.limit);
    return { status: 200, text: async () => JSON.stringify({ reservations: lote }) };
  };
  f.pedidos = pedidos;
  return f;
}
const reserva = (dia, n) => ({ details: { startDate: dia + 'T19:00:00.000Z', partySize: n } });

function poolFalso(modos, tabla) {
  const consultas = [];
  const q = async (sql, p) => {
    consultas.push({ sql, p });
    if (/FROM interruptores/.test(sql)) return { rows: Object.keys(modos || {}).map((m) => ({ modulo: m, modo: modos[m] })) };
    if (/^SELECT wk/.test(sql)) return { rows: tabla || [] };
    return { rows: [] };
  };
  return { consultas, query: q, connect: async () => ({ query: q, release: () => {} }) };
}

function deps(extra) {
  const sheets = sheetsFalso(libros());
  return Object.assign({ sheetsLectura: sheets, drive: driveFalso(sheets), fetch: wixFalso([reserva('2026-10-06', 2), reserva('2026-10-09', 3), reserva('2026-10-13', 8)]),
    env: { WIX_API_KEY: 'LLAVE-SECRETA', WIX_SITE_ID: 'sitio' }, conversiones: new Map(), esperar: async () => {} }, extra || {});
}
const todoEn = (modo) => ({ pauta_ads_import: modo, pauta_pos: modo, pauta_wix: modo, pauta_clientes: modo });

// -----------------------------------------------------------------------------------------------------------------

test('El proceso de pauta usa los mismos archivos que Marketing OS', () => {
  const origen = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-marketing-os');
  const lista = P.archivosPauta();
  assert.deepStrictEqual(lista, ['WixReservasPauta.js', 'PosPauta.js', 'ClientesNuevos.js']);
  lista.forEach((f) => assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'mkt', f), 'utf8'), fs.readFileSync(path.join(origen, f), 'utf8'),
    f + ' se separo de Marketing OS: correr cloud/herramientas/traer-mkt.sh'));
});

test('Sombra del lunes 13-oct: los tres escritores calculan lo mismo que tiene la hoja → 200', async () => {
  const d = deps();
  const r = await P.correrPauta({ modos: todoEn('sombra'), ahora: LUNES_13 }, d);
  const M = r.modulos;
  assert.deepStrictEqual(M.pauta_wix.semanas, { 41: { reservas: 2, comensalesReserva: 5 } }, JSON.stringify(M.pauta_wix));
  assert.deepStrictEqual(M.pauta_pos.semanas, { 40: { comensales: 5, ticket: 150 }, 41: { comensales: 4, ticket: 275 } }, JSON.stringify(M.pauta_pos));
  assert.deepStrictEqual(M.pauta_clientes.semanas, { 41: { clientes_nuevos: 2, repetidos: 2 } }, JSON.stringify(M.pauta_clientes));
  ['pauta_wix', 'pauta_pos', 'pauta_clientes'].forEach((m) => assert.deepStrictEqual(M[m].diferencias, [], m));
  assert.strictEqual(r.status, 200, JSON.stringify(r));
  // Wix: la semana que pide el codigo real (S41 = 5 al 11-oct) y la llave la pone Node, nunca el vm
  const b = JSON.parse(d.fetch.pedidos[0].op.body).query.filter.$and;
  assert.deepStrictEqual([b[0]['details.startDate'].$gte, b[1]['details.startDate'].$lte], ['2026-10-05T00:00:00.000Z', '2026-10-11T23:59:59.999Z']);
  assert.strictEqual(d.fetch.pedidos[0].op.headers.Authorization, 'LLAVE-SECRETA');
  // POS: solo el xlsx de ventas se bajo y convirtio (el de productos no); el temporal se borro
  assert.deepStrictEqual(d.drive.bajados, ['XL40']);
  assert.deepStrictEqual(d.drive.borrados, ['CONV1']);
  // Google Ads: la hoja trae numeros y fechas validos; sin base, solo revisa
  assert.deepStrictEqual(M.pauta_ads_import.problemas, []);
  assert.deepStrictEqual(M.pauta_ads_import.semanas[41], { gCosto: 120.5, gClics: 12, gImp: 1100, mCosto: 210, mAlcance: 5100, fecha_registro: '2026-10-11' });
});

test('Sombra: si la hoja dice otra cosa, 409 con la semana, la columna y los dos valores; no escribe nada', async () => {
  const d = deps();
  d.sheetsLectura.libros[P.LIBRO_MKT].pauta_semanal[2][6] = 3;    // reservas S41
  d.sheetsLectura.libros[P.LIBRO_MKT].pauta_semanal[1][10] = 149; // ticket S40
  const esc = sheetsEscrituraFalso(pauta());
  const pool = poolFalso({});
  const r = await P.correrPauta({ modos: todoEn('sombra') , ahora: LUNES_13 }, Object.assign(d, { sheetsEscritura: esc, pool }));
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(r.modulos.pauta_wix.diferencias, [{ wk: 41, columna: 'reservas', hoja: 3, nube: 2 }]);
  assert.deepStrictEqual(r.modulos.pauta_pos.diferencias, [{ wk: 40, columna: 'ticket', hoja: 149, nube: 150 }]);
  assert.strictEqual(esc.llamadas.length, 0);
  assert.ok(!pool.consultas.some((c) => /INSERT INTO pauta_semanal/.test(c.sql)));
  // cada escritor queda anotado en pauta_corridas
  assert.strictEqual(pool.consultas.filter((c) => /INSERT INTO pauta_corridas/.test(c.sql)).length, 4);
});

test('ClientesNuevos tal cual: un contacto de la CRM con ultima_reserva vacia NO cuenta como conocido (asi hace el codigo real)', async () => {
  // cnHistoriaCRM: [fecha_alta, ultima_reserva].filter(String) deja pasar el null y el reduce se queda con null.
  // No se corrige aca (la copia es exacta): queda anotado para Marketing OS.
  const d = deps();
  d.sheetsLectura.libros[P.LIBRO_MKT].reservas.push(['r7', new Date(2026, 9, 11), 'G', 'g@x.com', '', 2, 0, 'CONFIRMED', 'SI']);
  const r = await P.correrPauta({ modos: { pauta_clientes: 'sombra' }, ahora: LUNES_13 }, d);
  assert.deepStrictEqual(r.modulos.pauta_clientes.semanas, { 41: { clientes_nuevos: 3, repetidos: 2 } });
});

test('Precarga por rondas: Wix pagina de a 100 con la paginacion del codigo real', async () => {
  const muchas = []; for (let i = 0; i < 130; i++) muchas.push(reserva('2026-10-07', 2));
  const d = deps({ fetch: wixFalso(muchas) });
  const r = await P.correrPauta({ modos: { pauta_wix: 'sombra' }, ahora: LUNES_13 }, d);
  assert.deepStrictEqual(r.modulos.pauta_wix.semanas, { 41: { reservas: 130, comensalesReserva: 260 } });
  assert.deepStrictEqual(d.fetch.pedidos.map((p) => JSON.parse(p.op.body).query.paging.offset), [0, 100]);
  assert.strictEqual(r.modulos.pauta_wix.rondas, 3);
});

test('Wix rechaza la llave: el error del codigo real llega tal cual y no se reintenta un 401', async () => {
  const f = async () => ({ status: 401, text: async () => '{"message":"bad key"}' });
  f.pedidos = [];
  let n = 0;
  const d = deps({ fetch: async (u, o) => { n++; return f(u, o); } });
  const r = await P.correrPauta({ modos: { pauta_wix: 'sombra' }, ahora: LUNES_13 }, d);
  assert.strictEqual(r.status, 500);
  assert.match(r.modulos.pauta_wix.error, /Wix rechazo la peticion \(HTTP 401.*WIX_API_KEY/);
  assert.strictEqual(n, 1);
  // sin llave en el servidor, mensaje claro
  const r2 = await P.correrPauta({ modos: { pauta_wix: 'sombra' }, ahora: LUNES_13 }, deps({ env: {} }));
  assert.match(r2.modulos.pauta_wix.error, /Faltan las credenciales de Wix/);
});

test('Nube: escribe sus columnas en la base y SOLO esas celdas en la hoja; una semana nueva va al final', async () => {
  const d = deps({ fetch: wixFalso([reserva('2026-10-13', 2), reserva('2026-10-14', 6)]) });
  const esc = sheetsEscrituraFalso(pauta());
  const pool = poolFalso({});
  const r = await P.correrPauta({ modos: { pauta_wix: 'nube', pauta_clientes: 'nube' } },
    Object.assign(d, { sheetsEscritura: esc, pool, relojPruebas: Date.parse('2026-10-20T12:00:00-06:00') }));
  assert.strictEqual(r.status, 200, JSON.stringify(r.modulos));
  assert.deepStrictEqual(r.modulos.pauta_wix.semanas, { 42: { reservas: 2, comensalesReserva: 8 } });
  // S42 no existia: Wix agrega la fila (wk y lo suyo, lo demas vacio) y clientes llena sus dos celdas
  assert.deepStrictEqual(esc.M[3], [42, '', '', '', '', '', 2, '', '', 8, '', 1, 0]);
  assert.deepStrictEqual(esc.llamadas.map((x) => x[0]), ['append', 'batchUpdate']);
  // clientes_nuevos de la S42: la fila ya la habia creado Wix (los escritores van en fila, como los activadores)
  const ins = pool.consultas.filter((c) => /INSERT INTO pauta_semanal/.test(c.sql));
  assert.strictEqual(ins.length, 2);
  assert.match(ins[0].sql, /\("?wk"?, "reservas", "comensalesReserva", act_wix\)/);
  assert.match(ins[0].sql, /ON CONFLICT \(wk\) DO UPDATE SET "reservas" = EXCLUDED."reservas", "comensalesReserva" = EXCLUDED."comensalesReserva", act_wix = EXCLUDED.act_wix$/);
  assert.deepStrictEqual(ins[0].p, [42, 2, 8]);
  assert.match(ins[1].sql, /"clientes_nuevos", "repetidos", act_clientes/);
  assert.deepStrictEqual(ins[1].p, [42, 1, 0]);
  // la S40 y la S41 quedaron intactas
  assert.deepStrictEqual(esc.M.slice(0, 3).map((r) => r.map((x) => (x instanceof Date ? x.getTime() : x))), pauta().map((r) => r.map((x) => (x instanceof Date ? x.getTime() : x))));
});

test('Nube en una semana que ya existe: celda por celda, sin tocar las otras columnas', async () => {
  const d = deps({ fetch: wixFalso([reserva('2026-10-06', 2), reserva('2026-10-07', 2), reserva('2026-10-08', 2)]) });
  const esc = sheetsEscrituraFalso(pauta());
  const r = await P.correrPauta({ modos: { pauta_wix: 'nube' } }, Object.assign(d, { sheetsEscritura: esc, pool: poolFalso({}), relojPruebas: LUNES_13 }));
  assert.strictEqual(r.status, 200, JSON.stringify(r.modulos));
  assert.deepStrictEqual(esc.llamadas, [['batchUpdate', { valueInputOption: 'RAW', data: [
    { range: "'pauta_semanal'!G3", values: [[3]] }, { range: "'pauta_semanal'!J3", values: [[6]] }] }]]);
});

test('Un reloj simulado con algo en nube se niega (400): reproducir el pasado es solo sombra', async () => {
  await assert.rejects(() => P.correrPauta({ modos: { pauta_wix: 'nube' }, ahora: LUNES_13 }, deps()), /solo se corre en sombra/);
});

test('Google Ads: la importacion avisa lo raro (409) y en nube escribe solo sus columnas', async () => {
  const d = deps();
  const hoja = d.sheetsLectura.libros[P.LIBRO_MKT].pauta_semanal;
  hoja[2][1] = 'n/d';
  hoja.push([41, 1, 1, 1, 1, 1, '', '', '', '', '', '', '']);   // la S41 dos veces
  const r = await P.correrPauta({ modos: { pauta_ads_import: 'sombra' } }, Object.assign(d, { pool: poolFalso({}, [{ wk: 40, gCosto: '100', gClics: '10', gImp: '1000', mCosto: '200', mAlcance: '5000', fecha_registro: new Date(2026, 9, 4) }]) }));
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(r.modulos.pauta_ads_import.problemas, ['S41 gCosto: no es un numero (n/d).', 'S41 esta dos veces (filas 3 y 4); se toma la primera, como los escritores.']);
  assert.deepStrictEqual(r.modulos.pauta_ads_import.cambiarian, [41]);   // la S40 ya esta igual en la base

  const pool = poolFalso({});
  const r2 = await P.correrPauta({ modos: { pauta_ads_import: 'nube' } }, Object.assign(deps(), { pool }));
  assert.strictEqual(r2.status, 200);
  const ins = pool.consultas.filter((c) => /INSERT INTO pauta_semanal/.test(c.sql));
  assert.strictEqual(ins.length, 2);
  assert.match(ins[0].sql, /"gCosto", "gClics", "gImp", "mCosto", "mAlcance", "fecha_registro", act_ads/);
  assert.deepStrictEqual(ins[0].p, [40, 100, 10, 1000, 200, 5000, '2026-10-04']);
});

test('Las escrituras fuera de sus columnas se detectan; el appendRow vacio no cuenta', () => {
  const M = [['wk', 'reservas', 'ticket'], [41, 3, 99]];
  const r = P.leerEscrituras({ pauta: M, escrituras: [{ fila: 2, col: 2, valor: 3 }, { fila: 2, col: 3, valor: 99 }] }, ['reservas']);
  assert.deepStrictEqual(r.semanas, { 41: { reservas: 3 } });
  assert.deepStrictEqual(r.ajenas, ['S41 ticket']);
  const M2 = [['wk', 'reservas', 'ticket'], [42, 5, '']];
  const r2 = P.leerEscrituras({ pauta: M2, escrituras: [{ fila: 2, col: 1, valor: 42 }, { fila: 2, col: 2, valor: '' }, { fila: 2, col: 3, valor: '' }, { fila: 2, col: 2, valor: 5 }] }, ['reservas']);
  assert.deepStrictEqual(r2, { semanas: { 42: { reservas: 5 } }, encabezado: [], ajenas: [] });
});

test('Interruptores: sin tabla o sin fila = apps; un modo invalido tambien', async () => {
  assert.deepStrictEqual(await P.leerModos(null), todoEn('apps'));
  assert.deepStrictEqual(await P.leerModos(poolFalso({ pauta_wix: 'sombra', pauta_pos: 'cualquiera' })), Object.assign(todoEn('apps'), { pauta_wix: 'sombra' }));
  assert.deepStrictEqual(await P.leerModos({ query: async () => { throw new Error('no existe la tabla'); } }), todoEn('apps'));
});

test('La ruta: clave de tareas, cuerpo, todo en apps no hace nada, y una corrida en sombra', async () => {
  const app = express(); app.use(express.json());
  const d = deps({ pool: poolFalso({}), claveTareas: 'CLAVE' });
  P.montarPauta(app, d);
  const srv = app.listen(0); const url = 'http://127.0.0.1:' + srv.address().port + '/tareas/procesos/pauta';
  const post = (cuerpo, clave) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': clave === undefined ? 'CLAVE' : clave }, body: JSON.stringify(cuerpo || {}) })
    .then(async (r) => ({ status: r.status, j: await r.json() }));
  try {
    assert.strictEqual((await post({}, 'otra')).status, 403);
    assert.strictEqual((await post({ modulos: ['pauta_x'] })).status, 400);
    assert.strictEqual((await post({ ahora: 'ayer' })).status, 400);
    const nada = await post({});
    assert.strictEqual(nada.status, 200);
    assert.ok(Object.values(nada.j.modulos).every((m) => m.corrio === false && m.modo === 'apps'));
    assert.strictEqual(d.sheetsLectura.pedidos.length, 0);   // ni siquiera lee la hoja
    d.pool = poolFalso({ pauta_wix: 'sombra', pauta_clientes: 'sombra' });
    const r = await post({ ahora: '2026-10-13T12:00:00-06:00' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.deepStrictEqual(r.j.modulos.pauta_clientes.semanas, { 41: { clientes_nuevos: 2, repetidos: 2 } });
    assert.strictEqual(r.j.modulos.pauta_pos.corrio, false);
    d.pool = poolFalso({ pauta_wix: 'nube' });
    assert.strictEqual((await post({ ahora: '2026-10-13T12:00:00-06:00' })).status, 400);
  } finally { srv.close(); }
});

test('Drive y Sheets con la cuenta: listar, convertir subiendo y leer con el token de restaurante@', async () => {
  const pedidos = [];
  const cuenta = { accessToken: async () => 'AT' };
  const f = async (url, op) => {
    pedidos.push({ url, op: op || {} });
    const j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x), arrayBuffer: async () => Buffer.from('XLSX') });
    if (/files\/C1\?fields/.test(url)) return j({ id: 'C1', name: 'Reportes 2026' });
    if (/files\?q=/.test(url)) return j({ files: [{ id: 'S', name: 'S41', mimeType: 'application/vnd.google-apps.folder' }, { id: 'X', name: 'POS-S41.xlsx', mimeType: XLSX, modifiedTime: 't' }] });
    if (/upload/.test(url)) return j({ id: 'T1' });
    if (/alt=media/.test(url)) return j({});
    if (/sheets.googleapis.com/.test(url)) return j({ sheets: [{ properties: { title: 'Hoja1' } }] });
    return j({});
  };
  const D = P.crearDrive(cuenta, f);
  const c = await D.carpeta('C1');
  assert.deepStrictEqual(c, { nombre: 'Reportes 2026', carpetas: [{ id: 'S', nombre: 'S41' }], archivos: [{ id: 'X', nombre: 'POS-S41.xlsx', mime: XLSX, modificado: 't' }] });
  assert.strictEqual((await D.bajar('X')).toString(), 'XLSX');
  assert.strictEqual(await D.subirComoHoja(Buffer.from('XLSX'), 'tmp_pos_x', XLSX), 'T1');
  const subida = pedidos.find((p) => /upload/.test(p.url));
  assert.match(subida.op.body.toString(), /"mimeType":"application\/vnd.google-apps.spreadsheet"/);
  assert.match(subida.op.body.toString(), new RegExp('Content-Type: ' + XLSX.replace(/\./g, '\\.')));
  await D.borrar('T1');
  assert.strictEqual(pedidos[pedidos.length - 1].op.method, 'DELETE');
  const S = P.sheetsDeCuenta(cuenta, f);
  await S.spreadsheets.get({ spreadsheetId: 'T1', ranges: ["'Hoja1'"], includeGridData: true, fields: 'x' });
  const ult = pedidos[pedidos.length - 1];
  assert.match(ult.url, /spreadsheets\/T1\?ranges=%27Hoja1%27&includeGridData=true&fields=x/);
  assert.strictEqual(ult.op.headers.Authorization, 'Bearer AT');
  assert.ok(pedidos.every((p) => !p.op.headers || p.op.headers.Authorization === 'Bearer AT'));
});

test('Las conversiones del POS se reusan si el archivo no cambio (el ensayo de tres lunes convierte una vez)', async () => {
  const d = deps();
  await P.correrPauta({ modos: { pauta_pos: 'sombra' } }, d);
  await P.correrPauta({ modos: { pauta_pos: 'sombra' } }, d);
  assert.deepStrictEqual(d.drive.bajados, ['XL40']);
});

test('Utilidades: columna en letras y valores de la hoja a la base', () => {
  assert.deepStrictEqual([1, 13, 26, 27, 52].map(P.letra), ['A', 'M', 'Z', 'AA', 'AZ']);
  assert.deepStrictEqual(P.aBase('gCosto', ''), { v: null });
  assert.deepStrictEqual(P.aBase('gCosto', '12.5'), { v: 12.5 });
  assert.deepStrictEqual(P.aBase('fecha_registro', '2026-10-11'), { v: '2026-10-11' });
  assert.deepStrictEqual(P.aBase('fecha_registro', new Date(2026, 9, 11)), { v: '2026-10-11' });
  assert.ok(P.aBase('fecha_registro', 'domingo').problema);
});
