/**
 * Cerraduras de Marketing OS para el dia unico (21-oct-2026). No toca nada real.
 *  - sincronizarCRM: con PARAMETROS › motor_crm = base no hace nada (el CRM lo sincroniza la nube).
 *  - cotHook_: con motor_eventos = base niega batch y revision (lee igual).
 *   node pruebas-node/prueba_mktos_cerraduras.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '../apps-script/rosanta-marketing-os/');
let ok = 0, fallas = 0;
const prueba = (n, fn) => { try { fn(); ok++; console.log('OK    ' + n); } catch (e) { fallas++; console.log('FALLA ' + n + ': ' + e.message); } };

function armar(param) {
  const abiertos = [];
  const hoja = (M) => ({ getDataRange: () => ({ getValues: () => M }), getLastRow: () => M.length, getLastColumn: () => (M[0] || []).length,
    getRange: () => ({ getValues: () => M.slice(1), setValues: () => {}, setValue: () => {}, setNumberFormat: () => {} }), getMaxColumns: () => 26, getSheets: () => [] });
  const ctx = {
    SpreadsheetApp: { openById: (id) => { abiertos.push(id); return {
      getSheetByName: (n) => (n === 'PARAMETROS' ? hoja([['clave', 'valor']].concat(param)) : hoja([['id']])),
      getSheets: () => [hoja([['first_name', 'telefono', 'email']])] }; } },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ({ COTIZ_TOKEN: 'llave-de-cotizaciones-larga-123' })[k] || null, deleteProperty: () => {} }) },
    Utilities: { formatDate: () => '2026-10-21' }, Logger: { log: () => {} }, console: { log: () => {} },
    ContentService: {}, JSON, Math, Date, String, Number, Object, Array, isNaN
  };
  vm.createContext(ctx);
  ['Code.js', 'CRMSync.js', 'Cotizaciones.js'].forEach((f) => vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx));
  return { ctx, abiertos };
}
const CRM = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';

prueba('motor_crm = base: sincronizarCRM no abre el CRM ni escribe', () => {
  const a = armar([['motor_crm', 'base']]);
  const r = a.ctx.sincronizarCRM();
  if (!/servidor nuevo/.test(r)) throw new Error('no se nego: ' + r);
  if (a.abiertos.includes(CRM)) throw new Error('abrio la CRM Maestra');
});
prueba('motor_crm = sheets (o sin fila): sincroniza como siempre', () => {
  for (const p of [[['motor_crm', 'sheets']], []]) {
    const a = armar(p);
    let r = '';
    try { r = a.ctx.sincronizarCRM(); } catch (e) { r = ''; }   // la hoja de mentira no alcanza para sincronizar: importa que PASO la cerradura
    if (/servidor nuevo/.test(String(r))) throw new Error('se nego con ' + JSON.stringify(p));
    if (!a.abiertos.includes(CRM)) throw new Error('no abrio el CRM');
  }
});
prueba('en el servidor nuevo (NUBE_SERVIDOR_ = true) la cerradura no aplica', () => {
  const a = armar([['motor_crm', 'base']]);
  a.ctx.NUBE_SERVIDOR_ = true;
  let r = ''; try { r = a.ctx.sincronizarCRM(); } catch (e) { r = ''; }
  if (/servidor nuevo/.test(String(r))) throw new Error('se nego en la nube');
  if (!a.abiertos.includes(CRM)) throw new Error('no llego a abrir el CRM');
});
prueba('cotHook_: con motor_eventos = base niega batch y revision; list sigue', () => {
  const a = armar([['motor_eventos', 'base']]);
  const T = 'llave-de-cotizaciones-larga-123';
  for (const accion of ['batch', 'revision']) {
    const r = a.ctx.cotHook_({ token: T, accion, writes: [] });
    if (r.ok || !/servidor nuevo/.test(r.error)) throw new Error(accion + ' no se nego');
  }
  let l = {}; try { l = a.ctx.cotHook_({ token: T, accion: 'list' }); } catch (e) { l = {}; }   // la hoja de mentira no tiene cotizaciones
  if (l.error && /servidor nuevo/.test(l.error)) throw new Error('list se nego');
});
prueba('cotHook_: con sheets escribe como siempre; sin llave, unauthorized', () => {
  const a = armar([]);
  const r = a.ctx.cotHook_({ token: 'llave-de-cotizaciones-larga-123', accion: 'batch', writes: [] });
  if (!r.ok) throw new Error(JSON.stringify(r));
  if (a.ctx.cotHook_({ token: 'mala', accion: 'list' }).error !== 'unauthorized') throw new Error('sin llave paso');
});
console.log('\n' + ok + '/' + (ok + fallas) + ' OK');
process.exit(fallas ? 1 : 0);
