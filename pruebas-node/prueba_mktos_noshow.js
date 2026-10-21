/**
 * Prueba de CerrarMesasNoShow.js (Marketing OS) contra una hoja y un Wix en memoria. No toca nada real.
 * 21-oct-2026: el cierre en Wix por la API no dispara el aviso de Wix, asi que la hoja `reservas` quedaba en RESERVED
 * (11 de agosto). Ahora la funcion marca la hoja ella misma y pone al dia las que Wix ya cerro.
 *   node pruebas-node/prueba_mktos_noshow.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const DIR = path.join(__dirname, '../apps-script/rosanta-marketing-os/');

let ok = 0, fallas = 0;
const prueba = (n, fn) => { try { fn(); ok++; console.log('OK    ' + n); } catch (e) { fallas++; console.log('FALLA ' + n + ': ' + e.message); } };
const igual = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' esperaba ' + JSON.stringify(b) + ', vino ' + JSON.stringify(a)); };

const ago = (d) => new Date(2026, 7, d, 12);
function armar() {
  const H = ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'];
  const hoja = [H,
    ['r1', ago(3), 'Ana', 'a@x', '', 2, 0, 'RESERVED', 'SI'],      // Wix RESERVED → se cierra
    ['r2', ago(5), 'Beto', 'b@x', '', 4, 0, 'RESERVED', ''],       // Wix ya NO_SHOW (cierre viejo) → la hoja se pone al dia
    ['r3', ago(4), 'Caro', 'c@x', '', 2, 0, 'RESERVED', ''],       // Wix archivada → no se toca
    ['r4', new Date(2026, 11, 31), 'Dani', 'd@x', '', 2, 0, 'RESERVED', ''],   // futura → no se toca
    ['r5', ago(6), 'Eva', 'e@x', '', 3, 900, 'SEATED', 'SI']       // sentada → no se toca
  ];
  const wix = {
    r1: { id: 'r1', revision: '3', status: 'RESERVED', details: { startDate: '2026-08-03T18:00:00Z', partySize: 2 }, reservee: { firstName: 'Ana' } },
    r2: { id: 'r2', revision: '7', status: 'NO_SHOW', details: { startDate: '2026-08-05T18:00:00Z', partySize: 4 }, reservee: { firstName: 'Beto' } },
    r3: { id: 'r3', revision: '2', status: 'RESERVED', archived: true, details: { startDate: '2026-08-04T18:00:00Z', partySize: 2 }, reservee: { firstName: 'Caro' } }
  };
  const parches = [], escrituras = [];
  const sh = {
    getDataRange: () => ({ getValues: () => hoja.map((f) => f.slice()) }),
    getRange: (f, c) => ({ setValue: (v) => { escrituras.push([f, c, v]); hoja[f - 1][c - 1] = v; } })
  };
  const ctx = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'reservas' ? sh : null) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 16), sleep: () => {} },
    Logger: { log: () => {} }, LockService: {}, ContentService: {},
    console: { log: () => {} }, JSON, Math, Date, String, Number, Object, Array, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(DIR + 'Code.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(DIR + 'CerrarMesasNoShow.js', 'utf8'), ctx);
  ctx.wixCredenciales_ = () => ({ apiKey: 'k', siteId: 's' });
  // la busqueda de Wix trae solo r1 (como el 5-oct: la query no devuelve todo); el resto se pide uno por uno
  ctx.wixFetch_ = (url, o) => ({ getContentText: () => JSON.stringify(/query$/.test(url) ? { reservations: [wix.r1] } : { reservation: wix[url.split('/').pop()] }) });
  ctx.UrlFetchApp = { fetch: (url, o) => { const id = url.split('/').pop(); parches.push(id); wix[id].status = JSON.parse(o.payload).reservation.status;
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ reservation: wix[id] }) }; } };
  const estado = (id) => hoja.find((f) => f[0] === id)[7];
  return { ctx, hoja, wix, parches, escrituras, estado };
}

prueba('revisarMesasNoShow no escribe nada (ni en Wix ni en la hoja)', () => {
  const a = armar();
  a.ctx.revisarMesasNoShow();
  igual(a.parches, []); igual(a.escrituras, []);
});

prueba('cerrarMesasNoShow cierra en Wix solo la vencida en RESERVED y MARCA LA HOJA (antes quedaba en RESERVED)', () => {
  const a = armar();
  a.ctx.cerrarMesasNoShow();
  igual(a.parches, ['r1'], 'solo r1 se cambia en Wix:');
  igual(a.estado('r1'), 'NO_SHOW', 'r1 en la hoja:');
});

prueba('la que Wix ya habia cerrado (cierre del 5-oct) se pone al dia en la hoja, sin tocar Wix', () => {
  const a = armar();
  a.ctx.cerrarMesasNoShow();
  igual(a.estado('r2'), 'NO_SHOW');
  if (a.parches.includes('r2')) throw new Error('r2 no debia tocarse en Wix');
});

prueba('archivada, futura y sentada no se tocan; solo cambia la celda del estado', () => {
  const a = armar();
  a.ctx.cerrarMesasNoShow();
  igual([a.estado('r3'), a.estado('r4'), a.estado('r5')], ['RESERVED', 'RESERVED', 'SEATED']);
  igual(a.escrituras.map((e) => e[1]), [8, 8], 'solo la columna estado (8), dos filas:');
  igual(a.hoja.find((f) => f[0] === 'r1')[6], 0, 'el consumo no se toca');
});

prueba('correrla dos veces no cambia nada mas', () => {
  const a = armar();
  a.ctx.cerrarMesasNoShow();
  const n = a.escrituras.length, p = a.parches.length;
  a.ctx.cerrarMesasNoShow();
  igual([a.escrituras.length, a.parches.length], [n, p]);
});

console.log('\n' + ok + '/' + (ok + fallas) + ' OK');
process.exit(fallas ? 1 : 0);
