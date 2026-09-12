/**
 * Prueba de LectorBitacora.gs contra el simulador de Sheets. No toca nada real.
 */
const fs = require('fs');
const vm = require('vm');
const DIR = process.env.HOME + '/Dev/Rosanta/apps-script/rosanta-intranet/';
const celda = v => (v === undefined ? '' : v);

class Hoja {
  constructor(n, g) { this.nombre = n; this.g = g; }
  _ancho() { return this.g.reduce((m, f) => Math.max(m, f.length), 0); }
  _aseg(r, c) { while (this.g.length < r) this.g.push([]); const f = this.g[r - 1]; while (f.length < c) f.push(''); }
  getLastRow() { return this.g.length; }
  getLastColumn() { return this._ancho(); }
  getMaxColumns() { return Math.max(this._ancho(), 26); }
  setFrozenRows() {} insertColumnsAfter() {}
  clear() { this.g = []; }
  appendRow(f) { this.g.push(f.slice()); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.g.length, 1), Math.max(this._ancho(), 1)); }
  getRange(r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1; const self = this;
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) { const f = self.g[r - 1 + i] || []; const l = [];
          for (let j = 0; j < nc; j++) l.push(celda(f[c - 1 + j])); out.push(l); }
        return out;
      },
      setValue(v) { self._aseg(r, c); self.g[r - 1][c - 1] = v; },
      insertCheckboxes() { return this; },
      setValues(vs) { for (let i = 0; i < vs.length; i++) for (let j = 0; j < vs[i].length; j++) {
        self._aseg(r + i, c + j); self.g[r - 1 + i][c - 1 + j] = vs[i][j]; } }
    };
  }
}
class Libro {
  constructor(h) { this.h = h; }
  getSheetByName(n) { return this.h[n] || null; }
  insertSheet(n) { this.h[n] = new Hoja(n, []); return this.h[n]; }
}

const hoy = new Date();
const hace = d => new Date(hoy.getTime() - d * 24 * 60 * 60 * 1000);

const bitacora = new Hoja('BITACORA', [
  ['FECHA','QUIEN','ROL','ACCION','HOJA','REFERENCIA','CAMPO','ANTES','DESPUES','NOTA'],
  [hace(1),  'juan@rosanta',  'admin', 'cambiarPrecio',  'BANCO DE DATOS', 'Lomito',   'precio compra', 40, 50,  '+25%'],
  [hace(2),  'sync',          'sync',  'sincronizarPrecios', 'BANCO DE DATOS', 'Brisket', 'precio compra', 24, 25, '+4.2% · corrida 20260824-100000-aaaa'],
  [hace(3),  'juan@rosanta',  'admin', 'cambiarPrecio',  'BANCO DE DATOS', 'Lomito',   'precio compra', 32, 40,  '+25%'],
  [hace(4),  'jeffry@rosanta','cocina','editarCantidad', 'Gremolata',      'Perejil',  'cantidad',      5,  7,   ''],
  [hace(5),  'juan@rosanta',  'admin', 'cambiarPrecio',  'BANCO DE DATOS', 'Pimienta', 'precio compra', 120, 45, '-62.5%'],
  [hace(6),  'juan@rosanta',  'admin', 'crearInsumo',    'BANCO DE DATOS', 'Cardamomo','alta',          '', 'Cardamomo', ''],
  [hace(45), 'viejo@rosanta', 'admin', 'cambiarPrecio',  'BANCO DE DATOS', 'Lomito',   'precio compra', 30, 32,  'fuera de ventana'],
  ['',       '',              '',      '',               '',               '',         '',              '', '',  '']   // fila basura
]);
const libroCosteo = new Libro({ 'BITACORA': bitacora });

const ctx = {
  console, Logger: { log: () => {} },
  CacheService: { getScriptCache: () => ({ remove() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'x', setProperty() {} }) },
  SpreadsheetApp: { openById: () => libroCosteo },
  MimeType: { GOOGLE_SHEETS: 'x' },
  Session: { getActiveUser: () => ({ getEmail: () => 't@r' }) },
  Utilities: { formatDate(d, tz, fmt) { const p = n => String(n).padStart(2, '0');
    return fmt.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1))
              .replace('dd', p(d.getDate())).replace('HH', p(d.getHours()))
              .replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds())); } }
};
vm.createContext(ctx);
['ConfigCosteo.js','EdicionRecetario.js','SincronizarPrecios.js','LectorBitacora.js']
  .forEach(f => vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx));
ctx.LC = libroCosteo;
vm.runInContext('hojaCosteo_ = function(){ return LC; }; abrirPorClave_ = function(){ return LC; };', ctx);

const F = n => vm.runInContext(n, ctx);
let fallas = 0;
const chequear = (q, real, esp) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + q + (ok ? '' : `   esperado ${JSON.stringify(esp)}, dio ${JSON.stringify(real)}`));
};

console.log('\n=== 1. historialDe: no escribe y encuentra lo que tiene que encontrar ===');
const antes = JSON.stringify(libroCosteo.h);
const lom = F("historialDe('lomito')");
chequear('3 movimientos del Lomito', lom.length, 3);
chequear('el mas nuevo primero (40 -> 50)', [lom[0].antes, lom[0].despues], [40, 50]);
chequear('el mas viejo al final (30 -> 32)', [lom[2].antes, lom[2].despues], [30, 32]);
chequear('NO escribio absolutamente nada', JSON.stringify(libroCosteo.h), antes);
chequear('no creo BITACORA_RESUMEN', !!libroCosteo.getSheetByName('BITACORA_RESUMEN'), false);

console.log('\n=== 2. busca parcial, sin acentos y por ficha ===');
chequear('"LOMI" encuentra igual', F("historialDe('LOMI')").length, 3);
chequear('busca tambien por hoja/ficha', F("historialDe('gremolata')").length, 1);
chequear('lo que no existe devuelve vacio', F("historialDe('nomeexiste')").length, 0);
chequear('sin argumento no explota', F("historialDe('')").length, 0);

console.log('\n=== 3. la fila basura no cuenta ===');
chequear('7 movimientos reales, no 8', F('leerBitacora_()').length, 7);

console.log('\n=== 4. el resumen ===');
const r = F('refrescarResumenBitacora()');
const res = libroCosteo.getSheetByName('BITACORA_RESUMEN');
const txt = JSON.stringify(res.g);
chequear('creo la pestana', !!res, true);
chequear('7 en total', r.total, 7);
chequear('6 dentro de los 30 dias', r.recientes, 6);
chequear('todas las filas tienen 6 columnas', res.g.every(f => f.length === 6), true);
chequear('tiene las 5 secciones', (txt.match(/──/g) || []).length, 10);   // 2 marcas por titulo
chequear('cuenta por accion', /cambiarPrecio/.test(txt), true);
chequear('cuenta por quien', /juan@rosanta/.test(txt), true);
chequear('el mayor salto es la Pimienta (-62.5%)', /Pimienta/.test(txt) && /-62\.5%/.test(txt), true);
chequear('NO toco la BITACORA original', bitacora.g.length, 9);

console.log('\n=== 5. la ventana de 30 dias se respeta ===');
chequear('el de hace 45 dias esta en ULTIMOS MOVIMIENTOS', /fuera de ventana/.test(txt), true);
const secQuien = txt.slice(txt.indexOf('QUIEN — ultimos'));
chequear('pero NO en los conteos recientes', /viejo@rosanta/.test(secQuien), false);

console.log('\n=== 6. se regenera, no acumula ===');
const alto = res.g.length;
F('refrescarResumenBitacora()');
chequear('mismo alto al correr de nuevo', libroCosteo.getSheetByName('BITACORA_RESUMEN').g.length, alto);

console.log('\n=== 7. bitacora vacia no explota ===');
delete libroCosteo.h['BITACORA'];
chequear('leerBitacora_ devuelve vacio', F('leerBitacora_()').length, 0);
const r2 = F('refrescarResumenBitacora()');
chequear('el resumen igual se escribe', r2.total, 0);
chequear('y lo dice', /\(nada\)/.test(JSON.stringify(libroCosteo.getSheetByName('BITACORA_RESUMEN').g)), true);

console.log('\n' + (fallas ? 'FALLAS: ' + fallas : 'TODO OK') + '\n');
process.exit(fallas ? 1 : 0);
