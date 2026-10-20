/**
 * Prueba de setup() de Marketing OS (Code.js) contra una hoja en memoria. No toca nada real.
 * 20-oct-2026 (pedido de Juanma): setup() hacia sh.clear() en todas las pestañas del SCHEMA. Ahora se niega si
 * alguna tiene filas además del encabezado, y solo crea las que faltan, sin vaciar ninguna.
 *   node pruebas-node/prueba_mktos_setup.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const CODIGO = fs.readFileSync(path.join(__dirname, '../apps-script/rosanta-marketing-os/Code.js'), 'utf8');

let ok = 0, fallas = 0;
const prueba = (nombre, fn) => { try { fn(); ok++; console.log('OK    ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + ': ' + e.message); } };
const igual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' esperaba ' + JSON.stringify(b) + ', vino ' + JSON.stringify(a)); };

/** Un libro en memoria: { nombre: matriz }. Anota cada cosa que se escribe o se borra. */
function libro(pestanas) {
  const L = JSON.parse(JSON.stringify(pestanas)), log = [];
  const hoja = (n) => ({
    getName: () => n,
    getLastRow: () => L[n].length,
    clear: () => { log.push('clear ' + n); L[n] = []; },
    getRange: (r, c, nf, nc) => ({ setValues: (v) => { log.push('escribe ' + n); v.forEach((f, i) => { L[n][r - 1 + i] = f.slice(); }); return { setFontWeight: () => {} }; } }),
    setFrozenRows: () => {}
  });
  const ss = {
    getSheetByName: (n) => (n in L ? hoja(n) : null),
    insertSheet: (n) => { log.push('crea ' + n); L[n] = []; return hoja(n); },
    getSheets: () => Object.keys(L).map(hoja),
    deleteSheet: (h) => { log.push('borra pestaña ' + h.getName()); delete L[h.getName()]; }
  };
  return { L, log, ss };
}
function cargar(ss) {
  const ctx = { SpreadsheetApp: { openById: () => ss }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Logger: { log: () => {} }, ContentService: {}, LockService: {}, console, JSON, Math, Date, String, Number, Object, Array };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  return ctx;
}

prueba('Con datos en una pestaña, setup() se niega y no toca NADA (ni las demás)', () => {
  const { L, log, ss } = libro({ calendario: [['id', 'date'], ['c1', '2026-11-02']], reservas: [['id']] });
  const ctx = cargar(ss);
  let error = null;
  try { ctx.setup(); } catch (e) { error = e; }
  if (!error || !/se niega/.test(error.message) || !/calendario/.test(error.message)) throw new Error('no se nego: ' + (error && error.message));
  igual(log, [], 'no escribio, no vacio, no creo:');
  igual(L.calendario, [['id', 'date'], ['c1', '2026-11-02']]);
});

prueba('En una hoja nueva, crea las pestañas del SCHEMA con su encabezado y quita la hoja por defecto vacía', () => {
  const { L, log, ss } = libro({ 'Hoja 1': [] });
  const ctx = cargar(ss);
  ctx.setup();
  const esquema = Object.keys(ctx.SCHEMA);
  esquema.forEach((t) => igual(L[t], [ctx.SCHEMA[t]], t + ':'));
  if (!log.includes('borra pestaña Hoja 1')) throw new Error('no quito la hoja por defecto');
  if (log.some((x) => x.startsWith('clear'))) throw new Error('vacio algo');
});

prueba('Una pestaña que existe con solo el encabezado (o vacía) no se vacía ni se reescribe; solo se crean las que faltan', () => {
  const { L, log, ss } = libro({ calendario: [['id', 'date', 'columna_a_mano']], reservas: [], 'Hoja 1': [['algo']] });
  const ctx = cargar(ss);
  ctx.setup();
  igual(L.calendario, [['id', 'date', 'columna_a_mano']], 'calendario intacto:');
  igual(L.reservas, [], 'reservas intacta:');
  if (log.some((x) => /clear|escribe (calendario|reservas)$/.test(x))) throw new Error('toco una pestaña existente: ' + log.join(', '));
  if (!('Hoja 1' in L)) throw new Error('borro una "Hoja 1" que tenia algo');
  const faltaban = Object.keys(ctx.SCHEMA).filter((t) => t !== 'calendario' && t !== 'reservas');
  faltaban.forEach((t) => { if (!log.includes('crea ' + t)) throw new Error('no creo ' + t); });
});

prueba('El codigo ya no llama a clear() en ninguna parte de setup()', () => {
  const cuerpo = CODIGO.slice(CODIGO.indexOf('function setup()'), CODIGO.indexOf('function doGet('));
  if (/\.clear\(\)/.test(cuerpo)) throw new Error('setup() todavia tiene .clear()');
});

console.log('\n' + ok + '/' + (ok + fallas) + ' OK');
process.exit(fallas ? 1 : 0);
