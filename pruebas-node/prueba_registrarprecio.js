/**
 * Prueba de registrarPrecio() despues de unificarlo con exigirPermiso_ y bitacora_.
 * Lo que importa verificar:
 *   - que un rol sin permiso YA NO pueda escribir por este camino
 *   - que el rastro quede en BITACORA ademas de en PRECIOS
 *   - que lo que ya funcionaba siga funcionando igual
 *
 * 14-oct-2026: registrarPrecio ahora es registrarPrecio(auth, datos) y saca la identidad
 * de resolverUsuario_(auth) (Config.js). Antes la prueba pisaba getUsuarioActual con un
 * rol a eleccion; ahora corre el resolverUsuario_ / getUsuarioPorToken_ REALES contra una
 * hoja USUARIOS de mentira, y cada rol entra con su token, como entra Jeffry o Jose.
 */
const fs = require('fs');
const vm = require('vm');
const DIR = require('path').join(__dirname, '../apps-script/rosanta-intranet/');
const celda = v => (v === undefined ? '' : v);

class Hoja {
  constructor(n, g) { this.nombre = n; this.g = g; }
  _ancho() { return this.g.reduce((m, f) => Math.max(m, f.length), 0); }
  _aseg(r, c) { while (this.g.length < r) this.g.push([]); const f = this.g[r - 1]; while (f.length < c) f.push(''); }
  getName() { return this.nombre; }
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
      getFormula() { return ''; },   // precioSaleDeLaFicha_: aca ninguna celda es formula
      setValue(v) { self._aseg(r, c); self.g[r - 1][c - 1] = v; return this; },
      setFontWeight() { return this; },
      insertCheckboxes() { return this; },
      setValues(vs) { for (let i = 0; i < vs.length; i++) for (let j = 0; j < vs[i].length; j++) {
        self._aseg(r + i, c + j); self.g[r - 1 + i][c - 1 + j] = vs[i][j]; } return this; }
    };
  }
}
class Libro {
  constructor(h) { this.h = h; }
  getSheetByName(n) { return this.h[n] || null; }
  getSheets() { return Object.values(this.h); }
  insertSheet(n) { this.h[n] = new Hoja(n, []); return this.h[n]; }
}

const banco = new Hoja('BANCO DE DATOS', []);
const precios = new Hoja('PRECIOS', [['FECHA','PRODUCTO','PROVEEDOR','PRECIO','UNIDAD','Q/REC','FACTURA','QUIEN','NOTA']]);
const libro = new Libro({ 'BANCO DE DATOS': banco, 'PRECIOS': precios });

// USUARIOS: correo | rol | modulos | puede_editar | nombre | token  (Config.js)
// 14-oct-2026: 'cocina' ya no es un rol del recetario (EDIT.permisos quedo en chef, sala y
// dueno el 30-ago-2026). Se deja a proposito: es exactamente el caso "rol con el modulo
// pero sin el permiso" que este camino dejaba pasar antes del 26-ago.
const usuarios = new Hoja('USUARIOS', [
  ['correo', 'rol', 'modulos', 'puede_editar', 'nombre', 'token'],
  ['restaurante@rosanta.rest', 'dueno',  'recetario,finanzas', 'SI', 'Juanma', 'tok-dueno'],
  ['jeffry@rosanta.rest',      'chef',   'recetario',          'SI', 'Jeffry', 'tok-chef'],
  ['jose@gmail.com',           'sala',   'recetario',          'SI', 'Jose',   'tok-sala'],
  ['cocina@rosanta.rest',      'cocina', 'recetario',          'SI', 'Viejo',  'tok-cocina'],
  ['dani@rosanta.rest',        'equipo', 'marketing',          'SI', 'Dani',   'tok-equipo']
]);
const libroConfig = new Libro({ 'USUARIOS': usuarios });

const ctx = {
  console, Logger: { log: () => {} },
  CacheService: { getScriptCache: () => ({ remove() {}, get: () => null, put() {} }) },
  // la propiedad devuelve su propia clave; openById la usa para elegir el libro
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => k, setProperty() {} }) },
  SpreadsheetApp: { openById: id => (id === 'CONFIG_SHEET_ID' ? libroConfig : libro), flush() {} },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  MimeType: { GOOGLE_SHEETS: 'x' },
  // sin sesion: la identidad sale SOLO del token, como para quien entra con Gmail
  Session: { getActiveUser: () => ({ getEmail: () => '' }), getScriptTimeZone: () => 'America/Guatemala' },
  Utilities: { formatDate(d, tz, f) { return String(d); } }
};
vm.createContext(ctx);
['ConfigCosteo.js', 'Config.js', 'ConfigPOS.js', 'CosteoDatos.js', 'EdicionRecetario.js',
 'EdicionWeb.js', 'Proveedores.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx, { filename: f }));

ctx.LIBRO = libro;
vm.runInContext(`
  // El Banco de esta prueba es una sola fila fija: ubicarEnBanco_ real se prueba en prueba_areas.js.
  ubicarEnBanco_ = function(p){
    return { hoja: LIBRO.getSheetByName('BANCO DE DATOS'), fila: 4, col: 1, area: 'COCINA',
             producto: 'Lomito', precioCompra: 40, precioUnidad: 2.5,
             unidadCompra: 'libra', proveedor: 'Prov A' };
  };
  // 14-oct-2026: conCambiosDeModelo_ (real) relee las fichas tocadas para corregir el modelo
  // cacheado. Eso necesita el recetario entero y no es lo que se prueba aca.
  aplicarToques_ = function(){ return { fichas: [], insumos: [], recargar: false }; };
  construirModelo_ = function(){ return { insumos: [], recetas: [] }; };
`, ctx);

const F = n => vm.runInContext(n, ctx);
let fallas = 0, total = 0;
const chequear = (q, real, esp) => {
  total++;
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + q + (ok ? '' : `   esperado ${JSON.stringify(esp)}, dio ${JSON.stringify(real)}`));
};
// si BITACORA no existe, vacia: que la prueba diga FALLA en vez de reventar
const bit = () => libro.getSheetByName('BITACORA') || { g: [] };
const intentar = n => { try { F(n); return ''; } catch (e) { return e.message; } };

console.log('\n=== 1. un rol CON permiso escribe, y ahora tambien en BITACORA ===');
const r = F("registrarPrecio('tok-dueno', {producto:'Lomito', precioCompra:50, factura:'F-123', proveedor:'Prov B'})");
chequear('devuelve antes/ahora', [r.antes, r.ahora], [40, 50]);
chequear('escribio el precio de compra', banco.g[3][5], 50);
chequear('escribio el precio por unidad receta (factor conservado)', banco.g[3][3], 3.125);
chequear('sigue dejando rastro en PRECIOS', precios.g.length, 2);
chequear('PRECIOS conserva la factura', precios.g[1][6], 'F-123');
chequear('PRECIOS dice quien, sacado del token', precios.g[1][7], 'restaurante@rosanta.rest');
chequear('AHORA tambien deja rastro en BITACORA', !!libro.getSheetByName('BITACORA'), true);
chequear('una sola fila de bitacora', bit().g.length, 2);

const b = bit().g[1] || [];
chequear('accion registrarPrecio', b[3], 'registrarPrecio');
chequear('mismo campo que cambiarPrecioInsumo y el sync', b[6], 'precio compra');
chequear('antes 40, despues 50', [b[7], b[8]], [40, 50]);
chequear('la nota lleva % y factura', b[9], '+25% · factura F-123');
chequear('queda el rol', b[2], 'dueno');
chequear('queda quien (el del token, no un parametro)', b[1], 'restaurante@rosanta.rest');

console.log('\n=== 2. el agujero que se cerro: un rol SIN permiso ya no puede ===');
const antesBanco = banco.g[3][5];
const antesBit = bit().g.length;
const err = intentar("registrarPrecio('tok-cocina', {producto:'Lomito', precioCompra:99})");
chequear('tira error de permiso', /no puede cambiarPrecio/.test(err), true);
chequear('NO escribio el precio', banco.g[3][5], antesBanco);
chequear('NO agrego filas a BITACORA', bit().g.length, antesBit);
chequear('NO agrego filas a PRECIOS', precios.g.length, 2);

// 14-oct-2026: la identidad ya no la pone quien llama. Sin modulo, o con un token que no
// existe (y sin sesion), resolverUsuario_ no deja pasar a nadie.
const errSinModulo = intentar("registrarPrecio('tok-equipo', {producto:'Lomito', precioCompra:99})");
chequear('rol sin el modulo recetario: se rechaza', /Sin acceso al recetario/.test(errSinModulo), true);
const errToken = intentar("registrarPrecio('tok-inventado', {producto:'Lomito', precioCompra:99})");
chequear('token inventado: se rechaza', /Sin acceso al recetario/.test(errToken), true);
chequear('y ninguno de los dos escribio', [banco.g[3][5], bit().g.length, precios.g.length], [antesBanco, antesBit, 2]);

console.log('\n=== 3. los roles que si pueden, siguen pudiendo ===');
// 14-oct-2026: antes eran chef, administracion, direccion y dueno. La revision del
// 30-ago-2026 (EDIT.permisos en EdicionRecetario.js) dejo solo los tres que existen en
// USUARIOS —chef, sala y dueno— con el paquete completo, por decision de Juanma.
// El Lomito de esta prueba vive en COCINA: sala escribe en BARRA, asi que aca se prueba que
// chef y dueno pueden y que sala NO puede sin area (el hueco cerrado el 14-oct-2026 en
// Proveedores.js). Que sala SI escribe en su area lo prueba prueba_areas.js.
[['chef', 'tok-chef'], ['dueno', 'tok-dueno']].forEach(([rol, tok]) => {
  const e = intentar(`registrarPrecio('${tok}', {producto:'Lomito', precioCompra:41})`);
  chequear(rol + ' puede', e, '');
});
chequear('sala SIN area no escribe un producto de COCINA',
  /no escribe en COCINA/.test(intentar("registrarPrecio('tok-sala', {producto:'Lomito', precioCompra:41})")), true);

console.log('\n=== 4. las validaciones de siempre no se rompieron ===');
chequear('precio negativo se rechaza',
  /mayor que cero/.test(intentar("registrarPrecio('tok-dueno', {producto:'Lomito', precioCompra:-5})")), true);
chequear('sin producto se rechaza',
  /Falta el producto/.test(intentar("registrarPrecio('tok-dueno', {})")), true);

console.log('\n' + total + ' chequeos · ' + (total - fallas) + ' OK · ' + fallas + ' FALLA');
console.log((fallas ? 'FALLAS: ' + fallas : 'TODO OK') + '\n');
process.exit(fallas ? 1 : 0);
