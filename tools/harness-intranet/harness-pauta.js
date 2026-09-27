/* Harness de Node para el grupo "pauta" (9) y las guardas de srv() del grupo 3.
   Corre el CODIGO REAL de rosanta-intranet con mocks minimos de Apps Script, sin
   maestro ni Meta: el grupo pauta usa casos armados a mano y las guardas leen las
   vistas crudas (getRawContent). No escribe nada.

     node harness-pauta.js            → lista cada prueba del grupo 9 y las de srv()
   Sale con codigo 1 si alguna de esas pruebas falla. (27-sep-2026) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(process.env.HOME, 'Dev/Rosanta/apps-script/rosanta-intranet');

const cache = {};
const ctx = {
  SpreadsheetApp: { openById: () => { throw new Error('SpreadsheetApp no disponible en harness-pauta'); }, flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {}, deleteProperty: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] === undefined ? null : cache[k], put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k]) }) },
  Utilities: {
    formatDate: (d, tz, f) => { const p = n => (n < 10 ? '0' : '') + n; return f === 'yyyy-MM-dd' ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
    getUuid: () => 'uuid', sleep: () => {}
  },
  Session: { getActiveUser: () => ({ getEmail: () => 'restaurante@rosanta.rest' }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
  Logger: { log: () => {} },
  HtmlService: {
    createTemplateFromFile: v => ({ getRawContent: () => fs.readFileSync(path.join(DIR, v + '.html'), 'utf8') }),
    createHtmlOutputFromFile: () => { throw new Error('HtmlService sanitiza: no usar'); }
  },
  UrlFetchApp: { fetch: () => { throw new Error('UrlFetchApp no disponible en harness-pauta'); } },
  DriveApp: { getFolderById: () => { throw new Error('DriveApp no disponible'); } },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }) },
  console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt
};
vm.createContext(ctx);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
const first = ['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js'];
// Pruebas.js va al final: en su nivel superior nombra funciones de PruebasFinanzas/PruebasPauta.
const ultimo = ['Pruebas.js'];
const orden = first.filter(f => files.includes(f))
  .concat(files.filter(f => first.indexOf(f) === -1 && ultimo.indexOf(f) === -1).sort(), ultimo);
const fallasCarga = [];
orden.forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) { fallasCarga.push(f + ': ' + e.message); } });
console.log('archivos cargados:', orden.length, fallasCarga.length ? '\nFALLAS DE CARGA:\n  ' + fallasCarga.join('\n  ') : '(todos)');

let malas = fallasCarga.length;
function mostrar(g, filtro) {
  g.pruebas.filter(p => !filtro || filtro.test(p.nombre)).forEach(p => {
    if (p.estado === 'FALLA') malas++;
    console.log('  ' + p.estado.padEnd(6) + ' ' + p.nombre + (p.detalle ? ' · ' + p.detalle : '') +
      (p.estado === 'FALLA' && p.leido !== null ? ' [leido ' + p.leido + ' / esperado ' + p.esperado + ']' : ''));
  });
}

const r9 = { grupos: [] };
ctx.prPauta_(r9);
const g9 = r9.grupos[0];
console.log('\n=== ' + g9.nombre + ' (' + g9.pruebas.length + ' pruebas)');
mostrar(g9);

const r3 = { grupos: [] };
try { ctx.prPuentePOS_(r3); } catch (e) { console.log('prPuentePOS_ se corto:', e.message); }
console.log('\n=== guardas de srv() (del grupo ' + (r3.grupos[0] && r3.grupos[0].nombre) + ')');
mostrar(r3.grupos[0], /nombre en una variable|cerradura|token|identidad|srv/i);

console.log('\n' + (malas ? malas + ' FALLA(S)' : 'todo OK'));
process.exit(malas ? 1 : 0);
