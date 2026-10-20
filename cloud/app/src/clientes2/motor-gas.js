/**
 * Motor chico para los proyectos de Apps Script que no son la intranet (19-oct-2026): la consola de
 * respuestas y el panel de reseñas. Corre su codigo REAL (copiado tal cual en cloud/app/proyectos/)
 * sobre la copia de las hojas que guarda la base, en SOLO LECTURA: toda escritura tira error.
 *
 * Lo de afuera que esos proyectos usan para escribir o llamar (Gmail, Drive, la API de Google
 * Business, Claude) no existe aca: si una funcion lo intenta, falla. Las de escribir ni se llaman
 * (las rechaza el servicio con 409 antes de llegar).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', '..', 'proyectos');

function soloLectura(nombre) { return () => { throw new Error('En la sombra la pestaña ' + nombre + ' es de solo lectura.'); }; }

/** Una pestaña en memoria (forma de Sheet de Apps Script), solo lectura. */
function hoja(nombre, R, padre) {
  const ancho = () => R.reduce((a, r) => Math.max(a, r.length), 0);
  const celda = (v) => (v === undefined || v === null ? '' : v);
  const mostrar = (v) => (v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : String(celda(v)));
  const rango = (f, c, nf, nc) => {
    const leer = (fn) => { const o = []; for (let i = 0; i < (nf || 1); i++) { const row = R[f - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(fn(row[c - 1 + j])); o.push(x); } return o; };
    return {
      getValues: () => leer(celda), getDisplayValues: () => leer(mostrar),
      getValue: () => celda((R[f - 1] || [])[c - 1]), getDisplayValue: () => mostrar((R[f - 1] || [])[c - 1]),
      setValue: soloLectura(nombre), setValues: soloLectura(nombre)
    };
  };
  return {
    getName: () => nombre,
    getParent: () => padre,
    getLastRow: () => R.length,
    getLastColumn: () => ancho(),
    getDataRange: () => rango(1, 1, R.length, ancho()),
    getRange: (a, c, nf, nc) => {
      if (typeof a !== 'string') return rango(a, c, nf, nc);
      const col = a.charCodeAt(0) - 64;   // 'A:A' + createTextFinder
      return { createTextFinder: (t) => { const b = { matchEntireCell: () => b, findNext: () => {
        const i = R.findIndex((r) => String(celda(r[col - 1])) === String(t));
        return i < 0 ? null : { getRow: () => i + 1 };
      } }; return b; } };
    },
    appendRow: soloLectura(nombre), deleteRows: soloLectura(nombre)
  };
}

/**
 * crearMotorGas({ proyecto, archivos, libros, activo, props }) — libros: { id: { pestana: filas } } (la copia);
 * activo: el id del libro que devuelve SpreadsheetApp.getActive(); props: propiedades del script.
 */
function crearMotorGas(op) {
  const libros = op.libros || {};
  const props = Object.assign({}, op.props || {});
  const libro = (id) => {
    const src = libros[id];
    if (!src) throw new Error('La sombra no tiene copia de la hoja ' + id + '.');
    const L = { getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      getSheetByName: (n) => (src[n] ? hoja(n, src[n], L) : null), insertSheet: soloLectura('nueva') };
    return L;
  };
  const cache = new Map();
  const ctx = {
    SpreadsheetApp: { openById: libro, getActive: () => (op.activo ? libro(op.activo) : null), getActiveSpreadsheet: () => (op.activo ? libro(op.activo) : null), flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: soloLectura('propiedades'), deleteProperty: soloLectura('propiedades') }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => { cache.set(k, String(v)); }, remove: (k) => cache.delete(k) }) },
    Utilities: { sleep: () => {}, formatDate: (d) => new Date(d).toISOString() },
    Logger: { log: () => {} },
    console: { log: () => {}, error: () => {} },
    JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Intl, encodeURIComponent
  };
  vm.createContext(ctx);
  op.archivos.forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, op.proyecto, f), 'utf8'), ctx, { filename: op.proyecto + '/' + f }));
  return ctx;
}

function leerProyecto(proyecto, archivo) { return fs.readFileSync(path.join(DIR, proyecto, archivo), 'utf8'); }

module.exports = { crearMotorGas, leerProyecto, DIR };
