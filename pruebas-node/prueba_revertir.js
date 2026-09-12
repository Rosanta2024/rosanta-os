/**
 * Simulador minimo de Sheets para probar aplicarSincronizacion + revertirSync_
 * fuera de Apps Script. No toca nada real.
 */
const fs = require('fs');
const vm = require('vm');
const DIR = process.env.HOME + '/Dev/Rosanta/apps-script/rosanta-intranet/';

function celda(v) { return v === undefined ? '' : v; }

class Hoja {
  constructor(nombre, grid) { this.nombre = nombre; this.g = grid; }
  _ancho() { return this.g.reduce((m, f) => Math.max(m, f.length), 0); }
  _asegurar(r, c) {
    while (this.g.length < r) this.g.push([]);
    const fila = this.g[r - 1];
    while (fila.length < c) fila.push('');
  }
  getLastRow() { return this.g.length; }
  getLastColumn() { return this._ancho(); }
  getMaxColumns() { return Math.max(this._ancho(), 26); }
  setFrozenRows() {}
  insertColumnsAfter() {}
  appendRow(fila) { this.g.push(fila.slice()); }
  getDataRange() { return this.getRange(1, 1, this.g.length, Math.max(this._ancho(), 1)); }
  getRange(r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1;
    const self = this;
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const fila = self.g[r - 1 + i] || [];
          const linea = [];
          for (let j = 0; j < nc; j++) linea.push(celda(fila[c - 1 + j]));
          out.push(linea);
        }
        return out;
      },
      setValue(v) { self._asegurar(r, c); self.g[r - 1][c - 1] = v; },
      setValues(vals) {
        for (let i = 0; i < vals.length; i++)
          for (let j = 0; j < vals[i].length; j++) {
            self._asegurar(r + i, c + j);
            self.g[r - 1 + i][c - 1 + j] = vals[i][j];
          }
      }
    };
  }
}

class Libro {
  constructor(hojas) { this.h = hojas; }
  getSheetByName(n) { return this.h[n] || null; }
  insertSheet(n) { this.h[n] = new Hoja(n, []); return this.h[n]; }
}

// --- datos de prueba -------------------------------------------------------
// BANCO DE DATOS: filas 1-3 encabezado, datos desde la 4.
// A B C=producto D=precioReceta E=unidadReceta F=precioCompra G=unidadCompra H I=proveedor
const banco = new Hoja('BANCO DE DATOS', [
  ['', '', 'enc', '', '', '', '', '', ''],
  ['', '', 'enc', '', '', '', '', '', ''],
  ['', '', 'PRODUCTO', 'Q/REC', 'U.REC', 'Q/COMPRA', 'U.COMPRA', '', 'PROVEEDOR'],
  ['', '', 'Lomito',   2.5,  'onza', 40, 'libra', '', 'Prov A'],
  ['', '', 'Brisket',  1.5,  'onza', 24, 'libra', '', ''],
  ['', '', 'Perejil',  0.5,  'gramo', 10, 'manojo', '', 'Mercado'],
  ['', '', 'Duplicado', 1,   'onza', 10, 'libra', '', ''],
  ['', '', 'Duplicado', 1,   'onza', 10, 'libra', '', '']
]);

// SYNC_PRECIOS arranca con el esquema VIEJO de 9 columnas y una fila ya escrita,
// para probar el camino de "fila de log vieja".
const logViejo = new Hoja('SYNC_PRECIOS', [
  ['FECHA','AREA','PRODUCTO','PRECIO ANTERIOR','PRECIO NUEVO','VARIACION %','PROVEEDOR','QUIEN','RESULTADO'],
  [new Date('2026-08-24T14:33:00'), 'COCINA', 'Perejil', 10, 5, -50, 'Mercado', 'viejo@rosanta', 'OK']
]);

const libroRecetario = new Libro({ 'BANCO DE DATOS': banco });
const libroCosteo = new Libro({ 'SYNC_PRECIOS': logViejo });

// --- contexto --------------------------------------------------------------
const ctx = {
  console,
  Logger: { log: (...a) => {} },
  CacheService: { getScriptCache: () => ({ remove() {}, get: () => null, put() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'fake', setProperty() {} }) },
  SpreadsheetApp: { openById: () => libroRecetario },
  MimeType: { GOOGLE_SHEETS: 'x' },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@rosanta' }) },
  Utilities: {
    // respeta el patron: el codigo usa dos distintos y la diferencia importa
    formatDate(d, tz, fmt) {
      const p = n => String(n).padStart(2, '0');
      return fmt
        .replace('yyyy', d.getFullYear())
        .replace('MM', p(d.getMonth() + 1))
        .replace('dd', p(d.getDate()))
        .replace('HH', p(d.getHours()))
        .replace('mm', p(d.getMinutes()))
        .replace('ss', p(d.getSeconds()));
    }
  }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DIR + 'ConfigCosteo.js', 'utf8'), ctx);
// EdicionRecetario trae bitacora_/bitacoraLote_, que SincronizarPrecios ahora usa
vm.runInContext(fs.readFileSync(DIR + 'EdicionRecetario.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(DIR + 'SincronizarPrecios.js', 'utf8'), ctx);
// se pisan los dos accesos a Drive por los libros de mentira
vm.runInContext('abrirPorClave_ = function(){ return LIBRO_REC; };' +
                'hojaCosteo_ = function(){ return LIBRO_COST; };', ctx);
ctx.LIBRO_REC = libroRecetario;
ctx.LIBRO_COST = libroCosteo;

const F = n => vm.runInContext(n, ctx);
const fila = n => banco.getRange(n, 3, 1, 7).getValues()[0];

let fallas = 0;
function chequear(que, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + que +
              (ok ? '' : '   esperado ' + JSON.stringify(esperado) + ', dio ' + JSON.stringify(real)));
}

console.log('\n=== 1. aplicarSincronizacion escribe y guarda D/proveedor viejos ===');
ctx.CAMBIOS = [{
  fila: 4, producto: 'Lomito', precioViejo: 40, precioNuevo: 50, unidad: 'libra',
  dViejo: 2.5, dNuevo: 3.125, pct: 25, proveedor: 'Prov B'
}];
const ap = F("aplicarSincronizacion('COCINA', CAMBIOS, 'test@rosanta')");
chequear('escribe 1 fila', ap.escritos, 1);
chequear('F (precio compra) queda en 50', fila(4)[3], 50);
chequear('D (precio receta) queda en 3.125', fila(4)[1], 3.125);
chequear('I (proveedor) queda en Prov B', fila(4)[6], 'Prov B');
const encabezado = logViejo.getRange(1, 1, 1, 12).getValues()[0];
chequear('el log migro a 12 columnas', encabezado[9] + '|' + encabezado[10], 'D ANTERIOR|PROVEEDOR ANTERIOR');
const ultima = logViejo.getRange(logViejo.getLastRow(), 1, 1, 12).getValues()[0];
chequear('guardo D viejo 2.5', ultima[9], 2.5);
chequear('guardo proveedor viejo Prov A', ultima[10], 'Prov A');

console.log('\n=== 2. simular NO escribe ===');
const antes = JSON.stringify(banco.g);
const sim = F("revertirSync_(CORRIDA, 'test@rosanta', { simular: true })".replace('CORRIDA', JSON.stringify(ap.corrida)));
chequear('el plan revierte 1', sim.revertirian, 1);
chequear('el Banco quedo intacto', JSON.stringify(banco.g), antes);

console.log('\n=== 3. revertir de verdad devuelve los tres valores ===');
const rev = F("revertirSync_(" + JSON.stringify(ap.corrida) + ", 'test@rosanta', { simular: false })");
chequear('revierte 1', rev.revertidos, 1);
chequear('F vuelve a 40', fila(4)[3], 40);
chequear('D vuelve a 2.5', fila(4)[1], 2.5);
chequear('I vuelve a Prov A', fila(4)[6], 'Prov A');

console.log('\n=== 4. es idempotente: revertir dos veces no hace nada ===');
const rev2 = F("revertirSync_(" + JSON.stringify(ap.corrida) + ", 'test@rosanta', { simular: false })");
chequear('la segunda no revierte nada', rev2.revertidos, 0);
chequear('F sigue en 40', fila(4)[3], 40);

console.log('\n=== 5. candado C: si alguien edito despues, NO se pisa ===');
ctx.C2 = [{ fila: 5, producto: 'Brisket', precioViejo: 24, precioNuevo: 30, unidad: 'libra',
            dViejo: 1.5, dNuevo: 1.875, pct: 25, proveedor: '' }];
const ap2 = F("aplicarSincronizacion('COCINA', C2, 'test@rosanta')");
banco.getRange(5, 6).setValue(33);   // alguien lo edito a mano despues del sync
const rev3 = F("revertirSync_(" + JSON.stringify(ap2.corrida) + ", 'test@rosanta', { simular: false })");
chequear('no revierte', rev3.revertidos, 0);
chequear('respeta la edicion manual (33)', fila(5)[3], 33);
chequear('lo explica en el plan', /SALTADO: el precio ya no es/.test(rev3.plan[0].accion || ''), true);

console.log('\n=== 6. fila de log vieja (9 columnas): deriva D, no toca proveedor ===');
// la fila del 24-ago: Perejil 10 -> 5. El Banco esta en 5 para que el candado C pase.
banco.getRange(6, 6).setValue(5);
banco.getRange(6, 4).setValue(0.25);         // D coherente con el precio nuevo
const rev4 = F("revertirSync_('2026-08-24 14:33:00', 'test@rosanta', { simular: false })");
chequear('revierte 1', rev4.revertidos, 1);
chequear('F vuelve a 10', fila(6)[3], 10);
chequear('D derivado = 0.25 * 10/5 = 0.5', fila(6)[1], 0.5);
chequear('el proveedor NO se toca', fila(6)[6], 'Mercado');
chequear('avisa que es fila vieja', /fila de log vieja/.test(rev4.plan[0].nota || ''), true);

console.log('\n=== 7. producto duplicado: no adivina ===');
ctx.C3 = [{ fila: 7, producto: 'Duplicado', precioViejo: 10, precioNuevo: 12, unidad: 'libra',
            dViejo: 1, dNuevo: 1.2, pct: 20, proveedor: '' }];
const ap3 = F("aplicarSincronizacion('COCINA', C3, 'test@rosanta')");
const rev5 = F("revertirSync_(" + JSON.stringify(ap3.corrida) + ", 'test@rosanta', { simular: false })");
chequear('no revierte', rev5.revertidos, 0);
chequear('dice que hay 2 filas iguales', /hay 2 filas/.test(rev5.plan[0].accion || ''), true);

console.log('\n=== 8. no se revierte una reversion ===');
let err = '';
try { F("revertirSync_(" + JSON.stringify(rev.reversion) + ", 'x', {})"); } catch (e) { err = e.message; }
chequear('tira error claro', /ES una reversion/.test(err), true);

console.log('\n=== 9. BITACORA: el sync y la reversion quedan registrados ===');
const bit = libroCosteo.getSheetByName('BITACORA');
chequear('la hoja BITACORA existe', !!bit, true);
const filasBit = bit ? bit.g.slice(1) : [];
const enc = bit ? bit.g[0] : [];
chequear('encabezado de 10 columnas', enc.length, 10);
chequear('encabezado correcto', enc[3] + '|' + enc[7] + '|' + enc[8], 'ACCION|ANTES|DESPUES');

const sincs = filasBit.filter(f => f[3] === 'sincronizarPrecios');
const revs  = filasBit.filter(f => f[3] === 'revertirSync');
chequear('hay filas de sincronizarPrecios', sincs.length > 0, true);
chequear('hay filas de revertirSync', revs.length > 0, true);

// el Lomito: 40 -> 50 al aplicar, y 50 -> 40 al revertir
const lomSync = sincs.find(f => f[5] === 'Lomito');
const lomRev  = revs.find(f => f[5] === 'Lomito');
chequear('sync del Lomito: antes 40, despues 50', [lomSync[7], lomSync[8]], [40, 50]);
chequear('reversion del Lomito: antes 50, despues 40', [lomRev[7], lomRev[8]], [50, 40]);
chequear('mismo formato de campo que cambiarPrecioInsumo', lomSync[6], 'precio compra');
chequear('la hoja es BANCO DE DATOS', lomSync[4], 'BANCO DE DATOS');
chequear('el rol queda marcado como sync', lomSync[2], 'sync');
chequear('la nota lleva el % y la corrida', /^\+25% · corrida \d{8}-\d{6}-/.test(lomSync[9]), true);
chequear('la nota de la reversion dice que deshace', /^deshace la corrida /.test(lomRev[9]), true);

// los SALTADOS no van a BITACORA: un salto no es un cambio
chequear('el Brisket saltado NO esta en BITACORA', filasBit.some(f => f[5] === 'Brisket' && f[3] === 'revertirSync'), false);
chequear('el Duplicado saltado NO esta en BITACORA', filasBit.some(f => f[5] === 'Duplicado' && f[3] === 'revertirSync'), false);

console.log('\n=== 10. bitacora_ de una fila sigue funcionando ===');
const antesN = bit.g.length;
F("bitacora_('juan', 'admin', 'editarCantidad', 'Gremolata', 'Perejil', 'cantidad', 5, 7, 'nota')");
chequear('agrego exactamente 1 fila', bit.g.length - antesN, 1);
const ult = bit.g[bit.g.length - 1];
chequear('la fila quedo bien armada', [ult[1], ult[3], ult[7], ult[8]], ['juan', 'editarCantidad', 5, 7]);

console.log('\n' + (fallas ? 'FALLAS: ' + fallas : 'TODO OK') + '\n');
process.exit(fallas ? 1 : 0);
