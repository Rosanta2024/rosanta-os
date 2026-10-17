/**
 * Motor de Pagos (Fase 1, 17-oct-2026): corre el CODIGO REAL de la intranet (PagosProveedores.js y
 * lo que necesita, copiado tal cual en cloud/app/intranet/) dentro del servidor, sobre la copia de
 * las hojas que guarda la base. Asi la logica de dinero es la misma por construccion: no hay una
 * segunda version de Pagos que se pueda separar de la primera.
 *
 * Lo que el codigo de Apps Script espera (SpreadsheetApp, CacheService, LockService...) se imita
 * aca con lo minimo, como en tools/harness-intranet/harness-pagos.js. Las escrituras quedan
 * anotadas en `escrituras` para que el servidor las guarde; en la etapa de sombra se rechazan.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'intranet');
const ZONA = 'America/Guatemala';

/** Utilities.formatDate para los formatos que usa la intranet (dd, MM, yyyy, HH, mm, ss). */
function formatDate(d, tz, fmt) {
  const partes = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz || ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach((p) => { partes[p.type] = p.value; });
  return String(fmt).replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => ({ yyyy: partes.year, MM: partes.month, dd: partes.day, HH: partes.hour, mm: partes.minute, ss: partes.second })[k]);
}

/** Una pestaña en memoria con la forma de Sheet de Apps Script. editable: si acepta escrituras. */
function hoja(nombre, R, anotar) {
  const ancho = () => R.reduce((a, r) => Math.max(a, r.length), 0);
  const escribir = (fila, col, valor) => {
    if (!anotar) throw new Error('En el servidor nuevo la pestaña ' + nombre + ' es de solo lectura.');
    while (R.length < fila) R.push([]);
    const r = R[fila - 1];
    while (r.length < col) r.push('');
    r[col - 1] = valor;
    anotar(fila);
  };
  const rango = (fila, col, nf, nc) => {
    const g = {
      getValues: () => {
        const o = [];
        for (let i = 0; i < (nf || 1); i++) { const row = R[fila - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(row[col - 1 + j] === undefined ? '' : row[col - 1 + j]); o.push(x); }
        return o;
      },
      getValue: () => { const row = R[fila - 1] || []; return row[col - 1] === undefined ? '' : row[col - 1]; },
      setValues: (v) => { v.forEach((row, i) => row.forEach((x, j) => escribir(fila + i, col + j, x))); return g; },
      setValue: (x) => { escribir(fila, col, x); return g; },
      setNumberFormat: () => g, setFontWeight: () => g, setNote: () => g
    };
    return g;
  };
  const self = {
    getName: () => nombre,
    getLastRow: () => R.length,
    getLastColumn: () => ancho(),
    getDataRange: () => ({ getValues: () => R.map((r) => { const x = r.slice(); while (x.length < ancho()) x.push(''); return x; }) }),
    getRange: (a, c, nf, nc) => (typeof a === 'string' ? rango(1, 1, 1, 1) : rango(a, c, nf, nc)),
    setFrozenRows: () => self
  };
  return self;
}

/**
 * crearMotor({ libros, configId, editables }) — libros: { libroId: { pestana: matriz } } (la copia).
 * editables: { libroId: [pestanas que se pueden escribir] }.
 */
function crearMotor(opciones) {
  const libros = opciones.libros;
  const configId = opciones.configId;
  const editables = opciones.editables || {};
  let escrituras = null;   // { 'libro|pestana': Set(filas) } durante una llamada

  const cache = new Map();
  const ctx = {
    SpreadsheetApp: {
      openById: (id) => {
        const src = libros[id];
        if (!src) throw new Error('El servidor nuevo no tiene copia de la hoja ' + id + '.');
        const mk = (n) => hoja(n, src[n], (editables[id] || []).indexOf(n) !== -1
          ? (fila) => { const k = id + '|' + n; (escrituras[k] = escrituras[k] || new Set()).add(fila); } : null);
        return {
          getId: () => id,
          getSheetByName: (n) => (src[n] ? mk(n) : null),
          getSheets: () => Object.keys(src).map(mk),
          insertSheet: (n) => { throw new Error('El servidor nuevo no crea pestañas (' + n + ').'); }
        };
      },
      flush: () => {}
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ({ CONFIG_SHEET_ID: configId })[k] || null, setProperty: () => {}, deleteProperty: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => { const e = cache.get(k); if (!e || e.vence < Date.now()) { cache.delete(k); return null; } return e.v; },
      put: (k, v, seg) => { cache.set(k, { v: String(v), vence: Date.now() + 1000 * (seg || 600) }); },
      remove: (k) => { cache.delete(k); },
      removeAll: (ks) => ks.forEach((k) => cache.delete(k))
    }) },
    // Un solo servidor (max 1 instancia) y cada llamada corre entera sin pausas: el candado real lo
    // pone la base al guardar. tryLock siempre consigue.
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate, getUuid: () => crypto.randomUUID(), sleep: () => {}, base64EncodeWebSafe: (s) => Buffer.from(String(s)).toString('base64url') },
    Session: { getActiveUser: () => ({ getEmail: () => '' }) },
    Logger: { log: (...a) => console.log('[intranet]', ...a) },
    ScriptApp: { getService: () => ({ getUrl: () => '' }), getOAuthToken: () => { throw new Error('No disponible en el servidor nuevo.'); } },
    UrlFetchApp: { fetch: () => { throw new Error('No disponible en el servidor nuevo.'); } },
    console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Intl
  };
  vm.createContext(ctx);
  const lista = fs.readFileSync(path.join(DIR, 'LISTA.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  lista.forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: 'intranet/' + f }));

  /**
   * Corre una funcion de la intranet como `usuario` (de la tabla usuarios). Devuelve
   * { resultado, escrituras: { 'libro|pestana': [filas tocadas] } }. Si la funcion tira, no
   * queda nada anotado (el que llama recarga la copia para descartar lo que haya cambiado en memoria).
   */
  function correr(usuario, nombre, args) {
    if (typeof ctx[nombre] !== 'function') throw new Error('La intranet no tiene la funcion ' + nombre + '.');
    const u = usuario && { email: usuario.email, rol: usuario.rol, modulos: usuario.modulos || [], puedeEditar: !!usuario.puede_editar, nombre: usuario.nombre };
    ctx.resolverUsuario_ = () => u || null;
    ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };   // lo leido es por llamada, como en Apps Script
    escrituras = {};
    try {
      const resultado = ctx[nombre].apply(null, ['(token-verificado-por-el-servidor)'].concat(args || []));
      const e = {}; Object.keys(escrituras).forEach((k) => { e[k] = Array.from(escrituras[k]).sort((a, b) => a - b); });
      return { resultado: JSON.parse(JSON.stringify(resultado === undefined ? null : resultado)), escrituras: e };
    } finally { escrituras = null; ctx.resolverUsuario_ = () => null; }
  }

  return { correr, ctx, archivos: lista };
}

module.exports = { crearMotor, formatDate, hoja };
