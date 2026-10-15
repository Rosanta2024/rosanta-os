/**
 * Prueba de SemaforoPrecios.gs contra el simulador de Sheets.
 * No toca nada real.
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
  insertCheckboxes() { return this; }
  clear() { this.g = []; }
  appendRow(f) { this.g.push(f.slice()); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.g.length, 1), Math.max(this._ancho(), 1)); }
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
      insertCheckboxes() {
        for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
          self._asegurar(r + i, c + j); self.g[r - 1 + i][c - 1 + j] = false;
        }
        return this;
      },
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
  constructor(h) { this.h = h; }
  getSheetByName(n) { return this.h[n] || null; }
  insertSheet(n) { this.h[n] = new Hoja(n, []); return this.h[n]; }
}

// Banco de cocina: filas 1-3 encabezado
const banco = new Hoja('BANCO DE DATOS', [
  ['', '', 'e', '', '', '', '', '', ''],
  ['', '', 'e', '', '', '', '', '', ''],
  ['', '', 'PRODUCTO', 'Q/REC', 'U.REC', 'Q/COMPRA', 'U.COMPRA', '', 'PROVEEDOR'],
  ['', '', 'Lomito',  2.5, 'onza', 40, 'libra', '', 'Prov A'],   // +25% -> ALERTA
  ['', '', 'Brisket', 1.5, 'onza', 24, 'libra', '', ''],         // +4.2% -> cambia
  ['', '', 'Camote',  1.0, 'onza', 20, 'unidad', '', ''],        // unidad distinta
  ['', '', 'Sal',     0.1, 'gramo', 5, 'libra', '', '']          // igual
]);
// PRECIO PROVEEDORES del cierre: C=prod D=ant E=actual F=present G=proveedor
const cierre = new Hoja('PRECIO PROVEEDORES', [
  ['', '', 'PRODUCTO', 'ANT', 'ACTUAL', 'PRESENTACION', 'PROVEEDOR'],
  ['', '', 'Lomito',  40, 50,  'libra',  'Prov B'],
  ['', '', 'Brisket', 24, 25,  'libra',  ''],
  ['', '', 'Camote',  20, 8,   'libra',  ''],
  ['', '', 'Sal',      5, 5,   'libra',  ''],
  ['', '', 'Fantasma', 0, 12,  'libra',  '']
]);

const libroRec = new Libro({ 'BANCO DE DATOS': banco });
const libroCierre = new Libro({ 'PRECIO PROVEEDORES': cierre });
const libroCosteo = new Libro({});

let hayCierre = true;
let hayBarra = false;

const ctx = {
  console,
  Logger: { log: () => {} },
  CacheService: { getScriptCache: () => ({ remove() {}, get: () => null, put() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'fake', setProperty() {} }) },
  SpreadsheetApp: { openById: () => libroRec },
  MimeType: { GOOGLE_SHEETS: 'x' },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@rosanta' }) },
  Utilities: {
    formatDate(d, tz, fmt) {
      const p = n => String(n).padStart(2, '0');
      return fmt.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1))
                .replace('dd', p(d.getDate())).replace('HH', p(d.getHours()))
                .replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
    }
  }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DIR + 'ConfigCosteo.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(DIR + 'EdicionRecetario.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(DIR + 'SincronizarPrecios.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(DIR + 'SemaforoPrecios.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(DIR + 'APLICAR_SEMAFORO.js', 'utf8'), ctx);

ctx.LIBROS = { rec: libroRec, cierre: libroCierre, costeo: libroCosteo };
ctx.FLAGS = () => ({ hayCierre, hayBarra });
vm.runInContext(`
  abrirPorClave_ = function (clave) {
    var f = FLAGS();
    if (clave === 'INVENTARIO_CIERRE_SHEET_ID') return f.hayCierre ? LIBROS.cierre : null;
    if (clave === 'RECETARIO_BARRA_SHEET_ID')   return f.hayBarra ? LIBROS.rec : null;
    return LIBROS.rec;
  };
  hojaCosteo_ = function () { return LIBROS.costeo; };
`, ctx);

const F = n => vm.runInContext(n, ctx);
let fallas = 0;
function chequear(que, real, esp) {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + que +
              (ok ? '' : '   esperado ' + JSON.stringify(esp) + ', dio ' + JSON.stringify(real)));
}
const tab = () => libroCosteo.getSheetByName('SEMAFORO_PRECIOS');
const buscar = re => tab().g.filter(f => f.some(c => re.test(String(c))));

console.log('\n=== 1. corrida normal: escribe la pestana y nada mas ===');
const r1 = F('refrescarSemaforoPrecios()');
chequear('creo SEMAFORO_PRECIOS', !!tab(), true);
chequear('NO toco el Banco', banco.g[3][5], 40);
chequear('NO creo SYNC_PRECIOS', !!libroCosteo.getSheetByName('SYNC_PRECIOS'), false);
chequear('NO creo BITACORA', !!libroCosteo.getSheetByName('BITACORA'), false);
chequear('todas las filas tienen 7 columnas',
         tab().g.every(f => f.length === 8), true);

console.log('\n=== 2. el contenido dice lo que tiene que decir ===');
chequear('estado REVISAR con el area', tab().g[2][1], 'REVISAR (COCINA)');
chequear('el Lomito sale como ALERTA', buscar(/Lomito/)[0][1], 'ALERTA ±10%');
chequear('con antes 40 y ahora 50', [buscar(/Lomito/)[0][3], buscar(/Lomito/)[0][4]], [40, 50]);
chequear('el Brisket sale como cambio chico', buscar(/Brisket/)[0][1], 'cambia');
chequear('el Camote sale como unidad distinta', /unidad distinta/.test(buscar(/Camote/)[0][1]), true);
chequear('el Fantasma sale como sin match', buscar(/Fantasma/)[0][1], 'sin match');
chequear('la Sal (igual) NO aparece', buscar(/\bSal\b/).length, 0);
chequear('avisa del activador', buscar(/Activadores/).length, 1);

console.log('\n=== 3. BARRA rota no frena a COCINA ===');
chequear('BARRA queda NO CONFIGURADA, no ERROR', r1.estados.find(e => e.area === 'BARRA').estado, 'NO CONFIGURADA');
chequear('BARRA no pesa en el semaforo', r1.estados.find(e => e.area === 'BARRA').cuenta, false);
chequear('COCINA igual reporta', r1.estados.find(e => e.area === 'COCINA').estado, 'REVISAR');
chequear('el Lomito sigue estando', buscar(/Lomito/).length, 1);

console.log('\n=== 4. SIN CIERRE es el caso ruidoso ===');
hayCierre = false;
const r2 = F('refrescarSemaforoPrecios()');
chequear('estado global SIN CIERRE', tab().g[2][1], 'SIN CIERRE (COCINA)');
chequear('COCINA marcada SIN CIERRE', r2.estados.find(e => e.area === 'COCINA').estado, 'SIN CIERRE');
chequear('explica que falta', /INVENTARIO_CIERRE_SHEET_ID/.test(JSON.stringify(tab().g)), true);
chequear('sigue sin tocar el Banco', banco.g[3][5], 40);

console.log('\n=== 5. se reescribe entera, no acumula ===');
hayCierre = true;
F('refrescarSemaforoPrecios()');
chequear('vuelve a REVISAR', tab().g[2][1], 'REVISAR (COCINA)');
chequear('el Lomito aparece UNA vez', buscar(/Lomito/).length, 1);
chequear('no quedo rastro del SIN CIERRE', /SIN CIERRE/.test(JSON.stringify(tab().g)), false);

console.log('\n=== 6. AL DIA cuando no hay nada que reportar ===');
banco.getRange(4, 6).setValue(50); banco.getRange(4, 4).setValue(3.125);   // Lomito ya al dia
banco.getRange(5, 6).setValue(25);                                         // Brisket al dia
banco.getRange(6, 7).setValue('libra'); banco.getRange(6, 6).setValue(8);  // Camote al dia
cierre.getRange(6, 3).setValue('');
F('SEMAFORO.maxFilas = 40');                                        // se va el Fantasma
F('refrescarSemaforoPrecios()');
chequear('estado AL DIA', tab().g[2][1], 'AL DIA');
chequear('no queda ningun producto listado', buscar(/Lomito|Brisket|Camote|Fantasma/).length, 0);
chequear('el resumen dice 4 iguales', /4 iguales/.test(JSON.stringify(tab().g)), true);
chequear('solo queda la nota de BARRA', buscar(/NO CONFIGURADA/).length > 0, true);

console.log('\n=== 7. el corte de filas se declara, no se esconde ===');
F('SEMAFORO.maxFilas = 1');
banco.getRange(4, 6).setValue(40); banco.getRange(5, 6).setValue(15);  // dos ALERTAS en el mismo bloque
F('refrescarSemaforoPrecios()');
chequear('avisa cuantas no listo', buscar(/y \d+ mas, no listadas/).length > 0, true);


// ---------------------------------------------------------------------------
console.log('\n=== 8. la casilla APROBAR ===');
F('SEMAFORO.maxFilas = 40');
banco.getRange(4, 6).setValue(40); banco.getRange(4, 4).setValue(2.5);      // Lomito 40 -> 50 (ALERTA)
banco.getRange(5, 6).setValue(24);                                          // Brisket 24 -> 25 (cambia)
banco.getRange(6, 7).setValue('unidad'); banco.getRange(6, 6).setValue(20); // Camote unidad distinta
cierre.getRange(6, 3).setValue('Fantasma');
F('refrescarSemaforoPrecios()');

const filaDe = n => tab().g.findIndex(f => String(f[2]) === n);
const APR = 7;   // indice 0-based de la columna H
chequear('el Lomito tiene casilla (false)', tab().g[filaDe('Lomito')][APR], false);
chequear('el Brisket tiene casilla (false)', tab().g[filaDe('Brisket')][APR], false);
chequear('el Camote NO es aprobable', tab().g[filaDe('Camote')][APR], '');
chequear('el Fantasma NO es aprobable', tab().g[filaDe('Fantasma')][APR], '');

console.log('\n=== 9. simular no escribe; aplicar escribe solo lo tildado ===');
tab().g[filaDe('Lomito')][APR] = true;          // se tilda SOLO el Lomito
const sim = F('APLICAR_SEMAFORO()');
chequear('simula 1', sim.aplicarian, 1);
chequear('no escribio', banco.g[3][5], 40);

F('CONFIRMAR_APLICAR = true');
const ap = F('APLICAR_SEMAFORO()');
chequear('aplica 1', ap.aplicados, 1);
chequear('el Lomito quedo en 50', banco.g[3][5], 50);
chequear('el Brisket NO se toco', banco.g[4][5], 24);
chequear('quedo en la BITACORA', libroCosteo.getSheetByName('BITACORA').g.some(f => f[5] === 'Lomito'), true);
chequear('devolvio la corrida para poder deshacer', /^\d{8}-\d{6}-/.test(ap.corridas[0]), true);
chequear('refresco la pestana: el Lomito ya no figura', filaDe('Lomito'), -1);

console.log('\n=== 10. un numero escrito a mano NO llega al Banco ===');
F('CONFIRMAR_APLICAR = false');
F('refrescarSemaforoPrecios()');
const fb = filaDe('Brisket');
tab().g[fb][APR] = true;
tab().g[fb][4] = 999;                            // alguien escribe 999 en AHORA
const sim2 = F('APLICAR_SEMAFORO()');
chequear('el candado lo frena', sim2.aplicarian, 0);
chequear('y lo cuenta como saltado', sim2.saltarian, 1);
F('CONFIRMAR_APLICAR = true');
F('APLICAR_SEMAFORO()');
chequear('el Brisket sigue en 24, no en 999', banco.g[4][5], 24);
F('CONFIRMAR_APLICAR = false');

console.log('\n=== 11. el tilde no sobrevive a un cambio de propuesta ===');
F('refrescarSemaforoPrecios()');
tab().g[filaDe('Brisket')][APR] = true;
F('refrescarSemaforoPrecios()');
chequear('si la propuesta es igual, el tilde se conserva', tab().g[filaDe('Brisket')][APR], true);
cierre.getRange(3, 5).setValue(30);              // el cierre ahora dice 30, no 25
F('refrescarSemaforoPrecios()');
chequear('si cambio el precio, el tilde se cae', tab().g[filaDe('Brisket')][APR], false);

console.log('\n=== 12. se acepta una x escrita a mano ===');
tab().g[filaDe('Brisket')][APR] = 'x';
const sim3 = F('APLICAR_SEMAFORO()');
chequear('la x cuenta como tilde', sim3.aplicarian, 1);

console.log('\n' + (fallas ? 'FALLAS: ' + fallas : 'TODO OK') + '\n');
process.exit(fallas ? 1 : 0);
