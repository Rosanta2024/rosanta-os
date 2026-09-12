/**
 * Prueba de registrarPrecio() despues de unificarlo con exigirPermiso_ y bitacora_.
 * Lo que importa verificar:
 *   - que un rol sin permiso YA NO pueda escribir por este camino
 *   - que el rastro quede en BITACORA ademas de en PRECIOS
 *   - que lo que ya funcionaba siga funcionando igual
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
  setFrozenRows() {} insertColumnsAfter() {} clear() { this.g = []; }
  appendRow(f) { this.g.push(f.slice()); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.g.length, 1), Math.max(this._ancho(), 1)); }
  getRange(r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1; const self = this;
    return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = self.g[r - 1 + i] || []; const l = [];
        for (let j = 0; j < nc; j++) l.push(celda(f[c - 1 + j])); o.push(l); } return o; },
      getValue() { const f = self.g[r - 1] || []; return celda(f[c - 1]); },
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

const banco = new Hoja('BANCO DE DATOS', []);
const precios = new Hoja('PRECIOS', [['FECHA','PRODUCTO','PROVEEDOR','PRECIO','UNIDAD','Q/REC','FACTURA','QUIEN','NOTA']]);
const libro = new Libro({ 'BANCO DE DATOS': banco, 'PRECIOS': precios });

let ROL = 'dueno';

const ctx = {
  console, Logger: { log: () => {} },
  CacheService: { getScriptCache: () => ({ remove() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'x', setProperty() {} }) },
  SpreadsheetApp: { openById: () => libro },
  MimeType: { GOOGLE_SHEETS: 'x' },
  Session: { getActiveUser: () => ({ getEmail: () => 'juan@rosanta' }) },
  Utilities: { formatDate(d, tz, f) { return String(d); } }
};
vm.createContext(ctx);
['ConfigCosteo.js','EdicionRecetario.js','Proveedores.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx));

ctx.LIBRO = libro;
ctx.getRol = () => ROL;
vm.runInContext(`
  hojaCosteo_ = function(){ return LIBRO; };
  abrirPorClave_ = function(){ return LIBRO; };
  getUsuarioActual = function(){ return { email:'juan@rosanta', rol:getRol(), modulos:['recetario'], puedeEditar:true }; };
  usuarioTieneModulo = function(){ return true; };
  ubicarEnBanco_ = function(p){
    return { hoja: LIBRO.getSheetByName('BANCO DE DATOS'), fila: 4, col: 1,
             producto: 'Lomito', precioCompra: 40, precioUnidad: 2.5,
             unidadCompra: 'libra', proveedor: 'Prov A' };
  };
  construirModelo_ = function(){ return { insumos: [], recetas: {} }; };
`, ctx);

const F = n => vm.runInContext(n, ctx);
let fallas = 0;
const chequear = (q, real, esp) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + q + (ok ? '' : `   esperado ${JSON.stringify(esp)}, dio ${JSON.stringify(real)}`));
};
const bit = () => libro.getSheetByName('BITACORA');

console.log('\n=== 1. un rol CON permiso escribe, y ahora tambien en BITACORA ===');
ROL = 'dueno';
const r = F("registrarPrecio({producto:'Lomito', precioCompra:50, factura:'F-123', proveedor:'Prov B'})");
chequear('devuelve antes/ahora', [r.antes, r.ahora], [40, 50]);
chequear('escribio el precio de compra', banco.g[3][5], 50);
chequear('escribio el precio por unidad receta (factor conservado)', banco.g[3][3], 3.125);
chequear('sigue dejando rastro en PRECIOS', precios.g.length, 2);
chequear('PRECIOS conserva la factura', precios.g[1][6], 'F-123');
chequear('AHORA tambien deja rastro en BITACORA', !!bit(), true);
chequear('una sola fila de bitacora', bit().g.length, 2);

const b = bit().g[1];
chequear('accion registrarPrecio', b[3], 'registrarPrecio');
chequear('mismo campo que cambiarPrecioInsumo y el sync', b[6], 'precio compra');
chequear('antes 40, despues 50', [b[7], b[8]], [40, 50]);
chequear('la nota lleva % y factura', b[9], '+25% · factura F-123');
chequear('queda el rol', b[2], 'dueno');

console.log('\n=== 2. el agujero que se cerro: un rol SIN permiso ya no puede ===');
ROL = 'cocina';                       // en EDIT.permisos solo puede editarCantidad
const antesBanco = banco.g[3][5];
const antesBit = bit().g.length;
let err = '';
try { F("registrarPrecio({producto:'Lomito', precioCompra:99})"); } catch (e) { err = e.message; }
chequear('tira error de permiso', /no puede cambiarPrecio/.test(err), true);
chequear('NO escribio el precio', banco.g[3][5], antesBanco);
chequear('NO agrego filas a BITACORA', bit().g.length, antesBit);
chequear('NO agrego filas a PRECIOS', precios.g.length, 2);

console.log('\n=== 3. los roles que si pueden, siguen pudiendo ===');
['chef', 'administracion', 'direccion', 'dueno'].forEach(rol => {
  ROL = rol;
  let ok = true;
  try { F("registrarPrecio({producto:'Lomito', precioCompra:41})"); } catch (e) { ok = false; }
  chequear(rol + ' puede', ok, true);
});

console.log('\n=== 4. las validaciones de siempre no se rompieron ===');
ROL = 'dueno';
let e2 = '';
try { F("registrarPrecio({producto:'Lomito', precioCompra:-5})"); } catch (e) { e2 = e.message; }
chequear('precio negativo se rechaza', /mayor que cero/.test(e2), true);
let e3 = '';
try { F("registrarPrecio({})"); } catch (e) { e3 = e.message; }
chequear('sin producto se rechaza', /Falta el producto/.test(e3), true);

console.log('\n' + (fallas ? 'FALLAS: ' + fallas : 'TODO OK') + '\n');
process.exit(fallas ? 1 : 0);
