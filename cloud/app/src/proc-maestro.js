/**
 * EL CARGADOR DEL MAESTRO FINANCIERO EN LA NUBE (21-oct-2026, servicio de procesos).
 *
 * El maestro (Sheet 1_ZiUlIUG3...) SE QUEDA en Google Sheets: lo usa el contador. Lo que se muda es quien lo carga.
 * Hoy lo carga Apps Script (apps-script/rosanta-maestro/cargador.js, cargarUltimasSemanas, lunes 10:00): lee los
 * archivos del POS, del FEL y del BANCO_BI de "Reportes 2026" (solo las ultimas 3 semanas y los 2 ultimos meses),
 * convierte los xlsx a Hoja de Google y agrega las filas nuevas a 02_Ventas_Maestro, 01_FEL_Maestro,
 * 01b_FEL_Emitidas y 03_Banco_Industrial. Aca corre ese MISMO cargador.js (copia exacta en cloud/app/maestro/,
 * herramientas/traer-maestro.sh) dentro de un vm, con imitaciones de SpreadsheetApp, DriveApp, UrlFetchApp,
 * PropertiesService, Session y Utilities.
 *
 * PRECARGA POR RONDAS, como proc-pauta.js (y reusando su Drive, su lector de hojas y su conversion de xlsx): el
 * codigo real pide algo que no esta (una carpeta, la conversion de un xlsx, un Sheet nativo) → queda anotado como
 * falta, Node lo trae y la corrida se repite DESDE CERO. Nada de HTTP sincronico; las llaves nunca entran al vm.
 * El maestro se lee una sola vez al principio (las 5 pestañas que toca el cargador, con sus formulas para saber
 * donde termina cada una como getLastRow) y el cargador escribe sobre una COPIA EN MEMORIA.
 *
 * Interruptor `maestro_cargador` en la tabla interruptores (migracion 013), sin fila = 'apps':
 *   apps    no hace nada: sigue mandando el activador de Apps Script. 200 {modo:'apps'}.
 *   sombra  NO ESCRIBE NADA (ni el maestro ni la Propiedad de procesados ni la base). Dos corridas del codigo real
 *           sin registro de procesados (mira todos los archivos de la ventana):
 *             (1) sobre el maestro tal cual: filas_que_agregaria (lo que la carga de Apps Script de ese lunes NO
 *                 dejo cargado; tendria que ser 0).
 *             (2) sobre el maestro con las LLAVES BORRADAS (TicketId; Serie y Numero; fecha, docto, debito y
 *                 credito del banco): asi el cargador arma TODAS las filas de esos archivos, y cada una se busca
 *                 en el maestro por su llave y se compara celda por celda (valor y tipo de celda):
 *                 iguales / distintas / faltan.
 *           409 si algo de eso no es cero.
 *   nube    escribe en el maestro SOLO las filas nuevas que armo el codigo real, en las mismas celdas y con los
 *           mismos tipos que Apps Script (ver planEscritura), con la cuenta de servicio del servidor
 *           (deps.sheetsEscritura: rosanta-nube@ tiene que ser Editor del maestro). El registro de archivos
 *           procesados (la Propiedad rosanta_archivos_procesados de Apps Script) vive en la tabla
 *           maestro_archivos_procesados (migracion 009). Antes de escribir revisa que las filas destino sigan
 *           vacias (un solo escritor: el activador de Apps Script tiene que estar APAGADO) y despues relee lo
 *           escrito. 409 si un BANCO_BI se freno o si la relectura no coincide.
 * Cada corrida queda en maestro_corridas (si la migracion 009 ya esta).
 *
 * El espejo xlsx (generarEspejo de Code.js, lunes 10:30) NO esta aca: sigue en Apps Script.
 * AMBITO: no toca app.js ni server.js; se monta con montarMaestro(app, deps).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { formatDate } = require('./motor-pagos');
const C = require('./copia-hojas');
const P = require('./proc-pauta');
const { serieDeFecha } = require('./escribir-hoja');
const N = require('./banco-normalizar');

const DIR = path.join(__dirname, '..', 'maestro');
const MAESTRO = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
const REPORTES_2026 = '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP';
const INTERRUPTOR = 'maestro_cargador';
const MODOS = ['apps', 'sombra', 'nube'];
const FUNCION = 'cargarUltimasSemanas';            // la del activador de los lunes 10:00
const CLAVE_PROGRESO = 'rosanta_archivos_procesados';
const ZONA = 'America/Guatemala';
const MAX_RONDAS = 60;
const MIME_HOJA = 'application/vnd.google-apps.spreadsheet';
/** Como Apps Script interpreta un texto en setValues: como si se tecleara (un "4" queda numero, "2026-10-05" fecha). */
const ENTRADA = 'USER_ENTERED';

/** Las pestañas que escribe el cargador (con su primera fila de datos) y la que solo lee. */
const ESCRIBE = {
  '02_Ventas_Maestro': { desde: 5 },
  '01_FEL_Maestro': { desde: 5 },
  '01b_FEL_Emitidas': { desde: 4 },
  '03_Banco_Industrial': { desde: 5 },
  // el cierre de bancos (cierre_bancos.js, 22-oct-2026). 04b_Banco_BAC_USD es la pestaña PROPUESTA de la cuenta en
  // dolares: mientras no exista en el maestro, esa cuenta frena.
  '04_Banco_BAC': { desde: 5 },
  '04b_Banco_BAC_USD': { desde: 5 },
  '05_Tarjeta_Credito_BAC': { desde: 5 },
  '06_Tarjeta_Credito_BI': { desde: 5 }
};
const PESTANAS = Object.keys(ESCRIBE).concat(['00_Proveedores']);
/** Las pestañas del cierre de bancos: ancho de los datos (sin Año/Mes/Semana) y columnas de descripcion y categoria. */
const CIERRE = {
  '04_Banco_BAC': { ancho: 9, desc: 4, cat: [8, 9], montos: [5, 6, 7], cuenta: true },
  '04b_Banco_BAC_USD': { ancho: 9, desc: 4, cat: [8, 9], montos: [5, 6, 7], cuenta: true },
  '05_Tarjeta_Credito_BAC': { ancho: 6, desc: 2, cat: [5, 6], montos: [3, 4], cuenta: false },
  '06_Tarjeta_Credito_BI': { ancho: 6, desc: 2, cat: [5, 6], montos: [3, 4], cuenta: false }
};
const FUNCION_CIERRE = 'cargarCierreBancos';

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

// ---------------------------------------------------------------------------------------------------------------
// Leer el maestro
// ---------------------------------------------------------------------------------------------------------------

/**
 * Una pestaña de la API → { valores (como getValues hasta la ultima fila con algo), formulas (Map fila → {col: A1}),
 * ultima }. La ultima fila cuenta las formulas aunque den "" (asi cuenta getLastRow de Apps Script).
 */
function armarPestana(rowData) {
  const filas = [], formulas = new Map();
  let ultima = 0, ancho = 0;
  (rowData || []).forEach((r, i) => {
    const vals = r.values || [];
    const fila = vals.map(C.valorCelda);
    vals.forEach((c, j) => {
      const f = c && c.userEnteredValue && c.userEnteredValue.formulaValue;
      if (f) { if (!formulas.has(i + 1)) formulas.set(i + 1, {}); formulas.get(i + 1)[j + 1] = f; }
      if (f || fila[j] !== '') { ultima = i + 1; ancho = Math.max(ancho, j + 1); }
    });
    filas.push(fila);
  });
  const valores = filas.slice(0, ultima).map((f) => { const x = f.slice(0, ancho); while (x.length < ancho) x.push(''); return x; });
  return { valores, formulas, ultima };
}

/** El maestro: zona horaria, pestañas (con sheetId y tamaño) y las 5 que toca el cargador. */
async function leerMaestro(sheets, id) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.timeZone,sheets.properties(title,sheetId,gridProperties(rowCount,columnCount))' });
  const props = {};
  meta.data.sheets.forEach((s) => { props[s.properties.title] = s.properties; });
  const quiero = PESTANAS.filter((n) => props[n]);
  const r = await sheets.spreadsheets.get({ spreadsheetId: id, ranges: quiero.map((n) => "'" + n.replace(/'/g, "''") + "'"), includeGridData: true,
    fields: 'sheets(properties.title,data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type,userEnteredValue.formulaValue))' });
  const pestanas = {};
  r.data.sheets.forEach((s) => { pestanas[s.properties.title] = armarPestana(((s.data || [])[0] || {}).rowData); });
  return { id, zona: (meta.data.properties || {}).timeZone || '', titulos: Object.keys(props), props, pestanas };
}

/**
 * El maestro con las llaves de deduplicacion borradas (para la segunda corrida de la sombra): el cargador cree que
 * no hay nada cargado y arma TODAS las filas de los archivos. Las demas columnas quedan (la categoria del banco,
 * que el cargador exige conocida; la ultima fila, para getLastRow).
 */
function sinLlaves(maestro) {
  const borrar = { '02_Ventas_Maestro': [1], '01_FEL_Maestro': [3, 4], '01b_FEL_Emitidas': [2, 3], '03_Banco_Industrial': [1, 2, 4, 5] };
  const pestanas = {};
  Object.keys(maestro.pestanas).forEach((n) => {
    const p = maestro.pestanas[n];
    const valores = p.valores.map((r) => r.slice());
    if (borrar[n]) for (let i = ESCRIBE[n].desde - 1; i < valores.length; i++) borrar[n].forEach((c) => { if (c - 1 < valores[i].length) valores[i][c - 1] = ''; });
    pestanas[n] = { valores, formulas: p.formulas, ultima: p.ultima };
  });
  return Object.assign({}, maestro, { pestanas });
}

// ---------------------------------------------------------------------------------------------------------------
// El motor: cargador.js real con imitaciones
// ---------------------------------------------------------------------------------------------------------------

class FaltaPrecarga extends Error {
  constructor(f) { super('PRECARGA: falta ' + JSON.stringify(f)); this.falta = f; }
}

const iter = (xs) => { let i = 0; return { hasNext: () => i < xs.length, next: () => xs[i++] }; };
const copiaValor = (x) => (x instanceof Date ? new Date(x.getTime()) : x);

function archivosMaestro() {
  return fs.readFileSync(path.join(DIR, 'LISTA.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Un motor nuevo por ronda.
 *   maestro: de leerMaestro (no se modifica: el cargador escribe sobre una copia)
 *   estado:  la precarga { libros, carpetas, respuestas } (la misma forma que proc-pauta)
 *   o:       { ahora (ms, reloj fijo), progreso ({huella: 1}, lo que devuelve la Propiedad) }
 */
function crearMotorMaestro(maestro, estado, opciones) {
  const o = opciones || {};
  const faltas = [], vistas = new Set(), logs = [], ops = [], abiertos = [];
  let progresoNuevo = null, actual = null, ultimoR1C1 = null;
  const anotar = (f) => { const k = JSON.stringify(f); if (!vistas.has(k)) { vistas.add(k); faltas.push(f); } };
  const falta = (f) => { anotar(f); throw new FaltaPrecarga(f); };

  // la copia de trabajo de cada pestaña del maestro
  const trabajo = {};
  Object.keys(maestro.pestanas).forEach((n) => {
    const p = maestro.pestanas[n];
    const formulas = new Map();
    p.formulas.forEach((v, k) => formulas.set(k, Object.assign({}, v)));
    trabajo[n] = { M: p.valores.map((r) => r.map(copiaValor)), ocupada: p.ultima, formulas };
  });

  function hojaMaestro(n) {
    const T = trabajo[n];
    const editable = !!ESCRIBE[n];
    const ultimaValor = () => { for (let i = T.M.length - 1; i >= 0; i--) if (T.M[i].some((x) => x !== '' && x !== undefined && x !== null)) return i + 1; return 0; };
    const lastRow = () => Math.max(T.ocupada, ultimaValor());
    const rango = (fila, col, nf, nc) => {
      nf = nf === undefined ? 1 : nf; nc = nc === undefined ? 1 : nc;
      if (!(fila >= 1 && col >= 1 && nf >= 1 && nc >= 1)) throw new Error('Rango invalido en ' + n + ' (' + [fila, col, nf, nc].join(',') + ').');
      const reg = (tipo, extra) => {
        if (!editable) throw new Error('El cargador no escribe en ' + n + '.');
        ops.push(Object.assign({ pestana: n, tipo, fila, col, nf, nc, archivo: actual }, extra));
        T.ocupada = Math.max(T.ocupada, fila + nf - 1);
      };
      const dims = (v, que) => {
        if (!Array.isArray(v) || v.length !== nf || v.some((r) => !Array.isArray(r) || r.length !== nc)) {
          throw new Error(que + ': las dimensiones no coinciden con el rango (' + nf + 'x' + nc + ') en ' + n + '.');
        }
      };
      const guardarFormulas = (v) => v.forEach((r, i) => {
        if (!T.formulas.has(fila + i)) T.formulas.set(fila + i, {});
        r.forEach((x, j) => { T.formulas.get(fila + i)[col + j] = String(x); });
      });
      const g = {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nf; i++) {
            const r = T.M[fila - 1 + i] || [], x = [];
            for (let j = 0; j < nc; j++) x.push(r[col - 1 + j] === undefined ? '' : copiaValor(r[col - 1 + j]));
            out.push(x);
          }
          return out;
        },
        getValue: () => g.getValues()[0][0],
        // Apps Script devuelve R1C1; el cargador solo mira si hay formula y la vuelve a poner con setFormulasR1C1.
        // Se devuelve el texto A1 de esa fila y se recuerda de donde salio: en la nube se COPIA esa fila (copyPaste).
        getFormulasR1C1: () => {
          const out = [];
          for (let i = 0; i < nf; i++) { const f = T.formulas.get(fila + i) || {}, x = []; for (let j = 0; j < nc; j++) x.push(f[col + j] || ''); out.push(x); }
          ultimoR1C1 = { pestana: n, fila, col, nc, formulas: out[0].slice() };
          return out;
        },
        setValues: (v) => {
          dims(v, 'setValues');
          reg('valores', { valores: v.map((r) => r.map(copiaValor)) });
          v.forEach((r, i) => {
            while (T.M.length < fila + i) T.M.push([]);
            const row = T.M[fila - 1 + i];
            while (row.length < col - 1 + nc) row.push('');
            r.forEach((x, j) => { row[col - 1 + j] = copiaValor(x); });
          });
          return g;
        },
        setFormulas: (v) => { dims(v, 'setFormulas'); reg('formulas', { valores: v.map((r) => r.map(String)) }); guardarFormulas(v); return g; },
        setFormulasR1C1: (v) => {
          dims(v, 'setFormulasR1C1');
          const u = ultimoR1C1;
          const ok = u && u.pestana === n && u.col === col && u.nc === nc && u.formulas.every((x) => x) &&
            v.every((r) => r.every((x, j) => x === u.formulas[j]));
          if (!ok) throw new Error('setFormulasR1C1 en ' + n + ' sin una fila de origen que copiar: la nube no sabe imitarlo.');
          reg('formulasR1C1', { origenFila: u.fila, valores: v.map((r) => r.map(String)) });
          guardarFormulas(v);
          return g;
        },
        setNumberFormat: (p) => { reg('formato', { patron: String(p) }); return g; }
      };
      return g;
    };
    return { getName: () => n, getLastRow: lastRow, getRange: (a, c, nf, nc) => {
      if (typeof a === 'string') throw new Error('El cargador en la nube no imita rangos A1 (' + a + ').');
      return rango(a, c, nf, nc);
    } };
  }

  const libroMaestro = {
    getId: () => maestro.id,
    getSpreadsheetTimeZone: () => maestro.zona,
    getSheetByName: (n) => {
      if (maestro.titulos.indexOf(n) === -1) return null;
      if (!trabajo[n]) throw new Error('El proceso del maestro no precarga la pestaña ' + n + '.');
      return hojaMaestro(n);
    },
    addMenu: () => { throw new Error('En la nube no hay menu.'); }
  };

  /** Un Sheet que no es el maestro (el xlsx convertido o un BANCO_BI nativo): solo lectura. */
  function libroDeDatos(id) {
    const L = estado.libros[id];
    return { getId: () => id, getSheets: () => L.titulos.map((t) => ({ getName: () => t,
      getDataRange: () => ({ getValues: () => (L.datos[t] || []).map((r) => r.map(copiaValor)) }) })) };
  }

  function carpetaObj(id, nombre) {
    return {
      getId: () => id, getName: () => nombre,
      getFolders: () => { const c = estado.carpetas[id]; if (!c) falta({ tipo: 'carpeta', id }); return iter(c.carpetas.map((s) => carpetaObj(s.id, s.nombre))); },
      getFoldersByName: (n) => { const c = estado.carpetas[id]; if (!c) falta({ tipo: 'carpeta', id }); return iter(c.carpetas.filter((s) => s.nombre === n).map((s) => carpetaObj(s.id, s.nombre))); },
      // una subcarpeta sin precargar se anota y la ronda sigue (se descarta igual): asi se piden todas juntas
      getFiles: () => { const c = estado.carpetas[id]; if (!c) { anotar({ tipo: 'carpeta', id }); return iter([]); } return iter(c.archivos.map(archivoObj)); }
    };
  }
  function archivoObj(f) {
    return { getId: () => f.id, getName: () => f.nombre, getMimeType: () => f.mime,
      getLastUpdated: () => new Date(Date.parse(f.modificado || '1970-01-01T00:00:00Z')),
      // el texto de un CSV (cierre de bancos): se anota y la ronda sigue con '' (se pide junto con los demas)
      getBlob: () => ({ getDataAsString: () => {
        if (!Object.prototype.hasOwnProperty.call(estado.textos, f.id)) { anotar({ tipo: 'texto', id: f.id }); return ''; }
        return estado.textos[f.id];
      } }) };
  }

  estado.textos = estado.textos || {};
  estado.bancos = estado.bancos || {};
  const ctx = {
    // Solo en la nube: el archivo del banco (.xls del BAC, CSV de la tarjeta) convertido al normalizado en la precarga
    // con banco-normalizar.js. { texto } | { error } | null (no es del banco). En Apps Script no existe.
    ROSANTA_NUBE: { bancoANormalizado: (id) => {
      if (!Object.prototype.hasOwnProperty.call(estado.bancos, id)) { anotar({ tipo: 'banco', id }); return null; }
      return estado.bancos[id];
    } },
    SpreadsheetApp: {
      openById: (id) => {
        if (id === maestro.id) return libroMaestro;
        if (!estado.libros[id]) {
          if (String(id).indexOf('tmp:') === 0) throw new FaltaPrecarga({ tipo: 'tmp', id });   // lo trae la conversion
          falta({ tipo: 'libro', id });
        }
        actual = id;
        if (abiertos.indexOf(id) === -1) abiertos.push(id);
        return libroDeDatos(id);
      },
      flush: () => {},
      getUi: () => { throw new Error('En la nube no hay pantalla.'); }
    },
    DriveApp: {
      getFolderById: (id) => { const c = estado.carpetas[id]; if (!c) falta({ tipo: 'carpeta', id }); return carpetaObj(id, c.nombre); },
      getFileById: (id) => {
        if (String(id).indexOf('tmp:') !== 0) throw new Error('El cargador en la nube solo toca los temporales que crea (' + id + ').');
        return { getId: () => id, setTrashed: () => {} };   // el temporal ya se borro en la precarga, apenas se leyo
      }
    },
    UrlFetchApp: {
      fetch: (url, op) => {
        const p = op || {};
        const metodo = String(p.method || 'get').toUpperCase();
        const cuerpo = p.payload === undefined ? '' : String(p.payload);
        const m = String(url).match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^/?]+)\/copy(\?.*)?$/);
        if (!m || metodo !== 'POST') throw new Error('El cargador en la nube no sabe precargar ' + metodo + ' ' + String(url).replace(/\?.*/, ''));
        const clave = metodo + ' ' + url + ' ' + cuerpo;
        let r = estado.respuestas[clave];
        if (!r) {
          // se anota y se contesta un id provisional: la ronda sigue y pide todas las conversiones juntas
          anotar({ tipo: 'url', clave, url, metodo, cuerpo, contentType: p.contentType || '' });
          r = { code: 200, texto: JSON.stringify({ id: 'tmp:' + decodeURIComponent(m[1]) }) };
        }
        if (!p.muteHttpExceptions && r.code >= 400) throw new Error('Request failed for ' + url + ' returned code ' + r.code);
        return { getResponseCode: () => r.code, getContentText: () => r.texto };
      }
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k === CLAVE_PROGRESO ? JSON.stringify(o.progreso || {}) : null),
      setProperty: (k, v) => { if (k === CLAVE_PROGRESO) progresoNuevo = JSON.parse(v); },
      deleteProperty: () => { throw new Error('En la nube el registro de procesados no se borra desde el cargador.'); }
    }) },
    Session: { getScriptTimeZone: () => ZONA },
    MimeType: { GOOGLE_SHEETS: MIME_HOJA },
    ScriptApp: {
      getOAuthToken: () => '(lo pone la nube)',
      getProjectTriggers: () => [], deleteTrigger: () => {},
      newTrigger: () => { throw new Error('En la nube los relojes son de Cloud Scheduler.'); }
    },
    Utilities: { formatDate, sleep: () => {} },
    Logger: { log: (fmt, ...a) => { let i = 0; logs.push(String(fmt).replace(/%s/g, () => String(a[i++]))); } },
    console: { log: (...a) => logs.push(a.map(String).join(' ')) },
    JSON, Math, Date: o.ahora ? P.relojFijo(o.ahora) : Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Intl, Symbol
  };
  vm.createContext(ctx);
  archivosMaestro().forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: 'maestro/' + f }));

  function correr(nombre, args) {
    if (typeof ctx[nombre] !== 'function') throw new Error('El cargador no tiene la funcion ' + nombre + '.');
    let err = null;
    try { ctx[nombre].apply(null, args || []); } catch (e) { if (!(e instanceof FaltaPrecarga)) err = String(e && e.message || e); }
    return { faltas, error: err, ops, logs, progreso: progresoNuevo, abiertos, ctx, trabajo };
  }
  return { correr, ctx };
}

// ---------------------------------------------------------------------------------------------------------------
// La precarga (Node, asincronica)
// ---------------------------------------------------------------------------------------------------------------

/** deps: { drive, sheetsLectura, sheetsCuenta?, conversiones } (las mismas de proc-pauta). */
async function resolverFalta(f, estado, deps) {
  if (f.tipo === 'carpeta') {
    if (!deps.drive) throw error('El cargador necesita Drive (la cuenta de restaurante@, GMAIL_OAUTH) para leer la carpeta ' + f.id + '.', 503);
    estado.carpetas[f.id] = await deps.drive.carpeta(f.id);
    return;
  }
  if (f.tipo === 'url') {
    // la conversion del xlsx: bajar, subir convertido, leer la primera pestaña y borrar el temporal (proc-pauta)
    await P.resolverFalta(Object.assign({}, f, { url: f.url.replace(/\?.*$/, '') }), estado, deps);
    return;
  }
  if (f.tipo === 'libro') { await P.resolverFalta(f, estado, deps); return; }
  if (f.tipo === 'texto' || f.tipo === 'banco') {
    if (!deps.drive) throw error('El cierre de bancos necesita Drive (la cuenta de restaurante@) para leer el archivo ' + f.id + '.', 503);
    const bytes = await deps.drive.bajar(f.id);
    if (f.tipo === 'texto') { estado.textos[f.id] = Buffer.from(bytes).toString('utf8'); return; }
    // el .xls del BAC o el CSV de la tarjeta → el CSV normalizado (el mismo normalizador que la herramienta de la Mac)
    try {
      const r = N.normalizar(bytes, archivoDe(estado, f.id).nombre);
      estado.bancos[f.id] = r ? { texto: r.texto } : null;
    } catch (e) { estado.bancos[f.id] = { error: e.message }; }
    return;
  }
  throw new Error('Falta desconocida: ' + JSON.stringify(f));
}

async function resolverFaltas(faltas, estado, deps) {
  const cola = faltas.slice();
  const trabajador = async () => { while (cola.length) await resolverFalta(cola.shift(), estado, deps); };
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
}

/** Corre cargarUltimasSemanas (o opciones.funcion con opciones.args: el cierre de bancos) hasta que no le falte nada. */
async function correrConPrecarga(maestro, estado, deps, opciones) {
  const fn = (opciones && opciones.funcion) || FUNCION;
  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    const r = crearMotorMaestro(maestro, estado, opciones).correr(fn, opciones && opciones.args);
    if (!r.faltas.length) return Object.assign(r, { rondas: ronda });
    await resolverFaltas(r.faltas, estado, deps);
  }
  throw new Error(fn + ': despues de ' + MAX_RONDAS + ' rondas de precarga todavia le faltan datos.');
}

// ---------------------------------------------------------------------------------------------------------------
// Lo que hizo la corrida
// ---------------------------------------------------------------------------------------------------------------

/** El archivo de Drive detras de un libro abierto (el temporal 'tmp:ID' es la conversion de ID). */
function archivoDe(estado, libroId) {
  const id = String(libroId).replace(/^tmp:/, '');
  for (const cid of Object.keys(estado.carpetas)) {
    const c = estado.carpetas[cid];
    const f = c.archivos.find((x) => x.id === id);
    if (f) return { id, nombre: f.nombre, carpeta: c.nombre };
  }
  return { id, nombre: '', carpeta: '' };
}

/** Los archivos que el cargador abrio: carpeta, nombre, tipo (por su contenido, con _identificar) y filas que agrego. */
function resumirArchivos(r, estado) {
  return r.abiertos.map((lid) => {
    const L = estado.libros[lid];
    const datos = L && L.datos[L.titulos[0]];
    const filas = r.ops.filter((x) => x.archivo === lid && x.tipo === 'valores' && x.col === 1).reduce((a, x) => a + x.nf, 0);
    return Object.assign(archivoDe(estado, lid), { tipo: datos ? r.ctx._identificar(datos) : '?', filas });
  });
}

/** Los archivos que leyo el cierre de bancos (CSV y archivos del banco) y en que formato quedaron. */
function resumirCierre(estado) {
  const ids = new Set(Object.keys(estado.textos || {}).concat(Object.keys(estado.bancos || {})));
  return [...ids].map((id) => {
    const b = (estado.bancos || {})[id], t = (estado.textos || {})[id] || '';
    const tipo = N.esCabeceraNormalizada(t) ? 'NORMALIZADO' : b && b.texto ? 'BANCO' : b && b.error ? 'BANCO_CON_ERROR' : '?';
    return Object.assign(archivoDe(estado, id), { tipo });
  });
}

/** Las lineas de "--- REVISAR ---" del registro del cargador. */
function avisosDe(logs) {
  const i = logs.indexOf('--- REVISAR ---');
  const out = i < 0 ? [] : logs.slice(i + 1).filter((l) => /^ {2}/.test(l)).map((l) => l.trim());
  logs.filter((l) => /Me quede sin tiempo/.test(l)).forEach((l) => out.push(l.trim()));
  return out;
}
const frenados = (avisos) => avisos.filter((a) => /NO se escribio nada/.test(a)).length;

/** Las filas que armo el cargador (cada setValues desde la columna 1 de una pestaña de datos). */
function filasArmadas(ops) {
  const out = [];
  ops.forEach((x) => {
    if (x.tipo !== 'valores' || x.col !== 1 || !ESCRIBE[x.pestana]) return;
    x.valores.forEach((v, i) => out.push({ pestana: x.pestana, fila: x.fila + i, archivo: x.archivo, valores: v }));
  });
  return out;
}

// ---- comparar ----

const p2 = (n) => (n < 10 ? '0' : '') + n;
function norm(x) {
  if (x instanceof Date) {
    const d = x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
    return x.getHours() || x.getMinutes() || x.getSeconds() ? d + 'T' + p2(x.getHours()) + ':' + p2(x.getMinutes()) + ':' + p2(x.getSeconds()) : d;
  }
  if (x === null || x === undefined) return '';
  return String(x).trim();
}
function igual(a, b) {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const nx = Number(x.replace(/,/g, '')), ny = Number(y.replace(/,/g, ''));
  return x !== '' && y !== '' && isFinite(nx) && isFinite(ny) && Math.abs(nx - ny) < 0.005;
}

/** Columnas con formato texto ('@') antes de escribir: Serie y Numero del FEL. */
const COLS_TEXTO = { '01_FEL_Maestro': [3, 4], '01b_FEL_Emitidas': [2, 3] };

/** El tipo de celda que deja escribir `v` como lo escribe Apps Script (setValues = como si se tecleara). */
function tipoEsperado(v, pestana, col) {
  if (v instanceof Date) return 'fecha';
  if (typeof v === 'number') return 'numero';
  if (typeof v === 'boolean') return 'logico';
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (s === '') return 'vacio';
  if ((COLS_TEXTO[pestana] || []).indexOf(col) !== -1) return 'texto';
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return 'numero';
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return 'fecha';
  return 'texto';
}
function tipoCelda(v) {
  if (v instanceof Date) return 'fecha';
  if (typeof v === 'number') return 'numero';
  if (typeof v === 'boolean') return 'logico';
  return v === '' || v === null || v === undefined ? 'vacio' : 'texto';
}

/**
 * Las llaves con que el cargador deduplica, con sus mismas funciones (_norm, _numero, _fechaCarga del vm).
 * Devuelve (pestana, fila) → [llaves] (la primera es la principal; el FEL tiene la segunda, Numero + Gran Total).
 */
function llavesDe(ctx) {
  const N = ctx._norm, num = ctx._numero;
  const dia = (v) => { const d = ctx._fechaCarga(v); return d ? formatDate(d, ZONA, 'yyyy-MM-dd') : ''; };
  const r2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
  return (pestana, f) => {
    if (pestana === '02_Ventas_Maestro') return [N(f[0])];
    if (pestana === '01_FEL_Maestro' || pestana === '01b_FEL_Emitidas') {
      const e = pestana === '01b_FEL_Emitidas';
      const s = N(f[e ? 1 : 2]), n = N(f[e ? 2 : 3]).replace(/\.0$/, ''), t = num(f[e ? 7 : 9]).toFixed(2);
      return [s ? s + '|' + n : '', n ? 'T|' + n + '|' + t : ''];
    }
    if (pestana === '03_Banco_Industrial') return [dia(f[0]) + '|' + N(f[1]).replace(/\.0+$/, '') + '|' + r2(num(f[3])) + '|' + r2(num(f[4]))];
    return [];
  };
}

/**
 * La comparacion de la sombra. armadas: filasArmadas de la corrida sin llaves; maestro: el de verdad.
 * Cada fila armada se busca en el maestro por su llave y se compara celda por celda (valor y tipo).
 */
function compararConMaestro(armadas, maestro, ctx) {
  const llaves = llavesDe(ctx);
  const indice = {};
  Object.keys(ESCRIBE).forEach((n) => {
    const p = maestro.pestanas[n];
    const m = new Map();
    if (p) for (let i = ESCRIBE[n].desde - 1; i < p.valores.length; i++) {
      llaves(n, p.valores[i]).forEach((k) => { if (k && !m.has(k)) m.set(k, i); });
    }
    indice[n] = m;
  });
  const enc = (n, c) => { const p = maestro.pestanas[n]; const h = p && p.valores[ESCRIBE[n].desde - 2]; return h ? String(h[c - 1] || '') : ''; };
  let iguales = 0;
  const distintas = [], faltan = [];
  armadas.forEach((a) => {
    const ks = llaves(a.pestana, a.valores);
    let i;
    for (const k of ks) { if (k && indice[a.pestana].has(k)) { i = indice[a.pestana].get(k); break; } }
    if (i === undefined) { faltan.push({ pestana: a.pestana, llave: ks.filter(Boolean)[0] || '', fila: a.valores.map(norm) }); return; }
    const h = maestro.pestanas[a.pestana].valores[i];
    const cols = [];
    a.valores.forEach((v, j) => {
      const enM = h[j] === undefined ? '' : h[j];
      const te = tipoEsperado(v, a.pestana, j + 1), tm = tipoCelda(enM);
      if (!igual(enM, v)) cols.push({ col: j + 1, encabezado: enc(a.pestana, j + 1), maestro: norm(enM), nube: norm(v) });
      else if (te !== tm) cols.push({ col: j + 1, encabezado: enc(a.pestana, j + 1), maestro: norm(enM) + ' (' + tm + ')', nube: norm(v) + ' (' + te + ')', tipo: true });
    });
    if (cols.length) distintas.push({ pestana: a.pestana, llave: ks.filter(Boolean)[0] || '', fila_maestro: i + 1, columnas: cols });
    else iguales++;
  });
  return { iguales, distintas, faltan };
}

// ---------------------------------------------------------------------------------------------------------------
// Escribir en el maestro (modo nube)
// ---------------------------------------------------------------------------------------------------------------

const a1 = (pestana, fila, col, nf, nc) => "'" + pestana.replace(/'/g, "''") + "'!" + P.letra(col) + fila + ':' + P.letra(col + nc - 1) + (fila + nf - 1);

/** Un valor del cargador → lo que va en values.batchUpdate (USER_ENTERED). Date → numero de serie. */
function valorParaApi(x) {
  if (x instanceof Date) return serieDeFecha(x);
  if (x === null || x === undefined) return '';
  return x;
}
function formatoApi(patron) {
  if (patron === '@') return { type: 'TEXT', pattern: '@' };
  if (/[yd]/i.test(patron)) return { type: 'DATE', pattern: patron };
  return { type: 'NUMBER', pattern: patron };
}

/**
 * Las escrituras del cargador → pasos de la API, EN EL MISMO ORDEN (el '@' de Serie/Numero va antes de los valores,
 * como en el cargador, para que "09296263" quede texto):
 *   setValues        → values.batchUpdate, USER_ENTERED (lo mismo que hace setValues con un texto); fechas como
 *                      numero de serie a medianoche (el cargador escribe Date a las 00:00 de Guatemala)
 *   setFormulas      → updateCells con formulaValue
 *   setFormulasR1C1  → copyPaste PASTE_FORMULA desde la fila de la que salieron (eso es R1C1: relativas)
 *   setNumberFormat  → repeatCell con el patron
 * Si alguna pestaña no tiene filas suficientes, primero se le agregan (appendDimension).
 */
function planEscritura(ops, maestro) {
  const pasos = [], rangos = {}, crecer = {};
  const push = (api, x) => { const u = pasos[pasos.length - 1]; if (u && u.api === api) u.items.push(x); else pasos.push({ api, items: [x] }); };
  ops.forEach((op) => {
    const pr = maestro.props[op.pestana];
    if (!pr) throw new Error('El maestro no tiene la pestaña ' + op.pestana + '.');
    const sheetId = pr.properties ? pr.properties.sheetId : pr.sheetId;
    const fin = op.fila + op.nf - 1;
    const R = rangos[op.pestana] = rangos[op.pestana] || { desde: op.fila, hasta: fin, ancho: 0 };
    R.desde = Math.min(R.desde, op.fila); R.hasta = Math.max(R.hasta, fin);
    // solo las columnas de VALORES: en 04/05 las filas vacias ya traen las formulas de Año/Mes/Semana puestas
    if (op.tipo === 'valores') R.ancho = Math.max(R.ancho, op.col + op.nc - 1);
    const filas = ((pr.gridProperties || {}).rowCount) || 0;
    if (fin > filas) crecer[op.pestana] = { sheetId, faltan: Math.max((crecer[op.pestana] || {}).faltan || 0, fin - filas) };
    const rango = { sheetId, startRowIndex: op.fila - 1, endRowIndex: fin, startColumnIndex: op.col - 1, endColumnIndex: op.col - 1 + op.nc };
    if (op.tipo === 'valores') push('valores', { range: a1(op.pestana, op.fila, op.col, op.nf, op.nc), values: op.valores.map((r) => r.map(valorParaApi)) });
    else if (op.tipo === 'formulas') push('lote', { updateCells: { range: rango, rows: op.valores.map((r) => ({ values: r.map((f) => ({ userEnteredValue: { formulaValue: f } })) })), fields: 'userEnteredValue' } });
    else if (op.tipo === 'formulasR1C1') push('lote', { copyPaste: { source: Object.assign({}, rango, { startRowIndex: op.origenFila - 1, endRowIndex: op.origenFila }), destination: rango, pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } });
    else if (op.tipo === 'formato') push('lote', { repeatCell: { range: rango, cell: { userEnteredFormat: { numberFormat: formatoApi(op.patron) } }, fields: 'userEnteredFormat.numberFormat' } });
    else throw new Error('Escritura desconocida: ' + op.tipo);
  });
  const extra = Object.keys(crecer).map((n) => ({ appendDimension: { sheetId: crecer[n].sheetId, dimension: 'ROWS', length: crecer[n].faltan } }));
  if (extra.length) pasos.unshift({ api: 'lote', items: extra });
  return { pasos, rangos };
}

/** Un solo escritor: las filas donde va a escribir tienen que seguir vacias (ni valores ni formulas). */
async function revisarDestinoVacio(sheets, id, rangos) {
  const ocupadas = [];
  for (const n of Object.keys(rangos)) {
    const R = rangos[n];
    if (!R.ancho) continue;
    const v = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: a1(n, R.desde, 1, R.hasta - R.desde + 1, R.ancho), valueRenderOption: 'FORMULA' });
    (v.data.values || []).forEach((r, i) => { if ((r || []).some((x) => x !== '' && x !== null && x !== undefined)) ocupadas.push(n + ' fila ' + (R.desde + i)); });
  }
  return ocupadas;
}

async function aplicar(sheets, id, plan) {
  for (const p of plan.pasos) {
    if (p.api === 'valores') await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: ENTRADA, data: p.items } });
    else await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: p.items } });
  }
}

/** Relee lo escrito (regla del 15-sep: un script de datos relee lo que escribio): valor y tipo de cada celda. */
async function releer(sheets, id, ops) {
  const vals = ops.filter((x) => x.tipo === 'valores');
  if (!vals.length) return [];
  const r = await sheets.spreadsheets.get({ spreadsheetId: id, ranges: vals.map((x) => a1(x.pestana, x.fila, x.col, x.nf, x.nc)), includeGridData: true,
    fields: 'sheets(properties.title,data(startRow,startColumn,rowData.values(effectiveValue,effectiveFormat.numberFormat.type)))' });
  const celdas = {};
  (r.data.sheets || []).forEach((s) => (s.data || []).forEach((d) => (d.rowData || []).forEach((row, i) => (row.values || []).forEach((c, j) => {
    celdas[s.properties.title + '|' + ((d.startRow || 0) + i + 1) + '|' + ((d.startColumn || 0) + j + 1)] = C.valorCelda(c);
  }))));
  const mal = [];
  vals.forEach((x) => x.valores.forEach((row, i) => row.forEach((v, j) => {
    const k = x.pestana + '|' + (x.fila + i) + '|' + (x.col + j);
    const leido = k in celdas ? celdas[k] : '';
    const te = tipoEsperado(v, x.pestana, x.col + j), tl = tipoCelda(leido);
    if (!igual(leido, v) || te !== tl) mal.push(x.pestana + ' fila ' + (x.fila + i) + ' col ' + (x.col + j) + ': escrito ' + norm(v) + ' (' + te + '), leido ' + norm(leido) + ' (' + tl + ')');
  })));
  return mal;
}

// ---------------------------------------------------------------------------------------------------------------
// La corrida
// ---------------------------------------------------------------------------------------------------------------

async function leerModo(pool) {
  if (!pool) return 'apps';
  try {
    const r = await pool.query('SELECT modo FROM interruptores WHERE modulo = $1', [INTERRUPTOR]);
    const m = r.rows[0] && String(r.rows[0].modo || '').trim().toLowerCase();
    return MODOS.indexOf(m) !== -1 ? m : 'apps';
  } catch (e) { return 'apps'; }   // sin tabla todavia
}

async function registro(pool) {
  const r = await pool.query('SELECT huella FROM maestro_archivos_procesados');
  const out = {};
  r.rows.forEach((x) => { out[x.huella] = 1; });
  return out;
}

const sheetsDe = (s) => (typeof s === 'function' ? s() : s);

function precondiciones(deps) {
  if (!deps.sheetsLectura || !deps.drive) throw error('Falta el permiso de Google (GMAIL_OAUTH): el servidor no puede leer Drive ni el maestro.', 503);
}

function revisarZona(maestro) {
  if (maestro.zona !== ZONA) throw error('El maestro esta en la zona ' + maestro.zona + ' y el cargador en ' + ZONA + ': con zonas distintas las fechas se corren un dia. No se corrio nada.', 409);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz !== ZONA) throw error('El servidor corre con TZ=' + tz + ' y tiene que ser ' + ZONA + ' (las fechas del maestro).', 500);
}

/**
 * SOMBRA. o: { ahora, estado (precarga compartida, para el ensayo) }. No escribe en ningun lado.
 * Devuelve { status, cuerpo }.
 */
async function correrSombra(o, deps) {
  precondiciones(deps);
  const maestro = await leerMaestro(deps.sheetsLectura, MAESTRO);
  revisarZona(maestro);
  const estado = o.estado || { libros: {}, carpetas: {}, respuestas: {} };
  const deps2 = Object.assign({ conversiones: new Map() }, deps);
  // (1) sobre el maestro tal cual, sin registro de procesados: lo que agregaria hoy
  const r1 = await correrConPrecarga(maestro, estado, deps2, { ahora: o.ahora, progreso: {} });
  // (2) sobre el maestro sin llaves: como arma cada fila, para compararla con la que el maestro ya tiene
  const r2 = r1.error ? null : await correrConPrecarga(sinLlaves(maestro), estado, deps2, { ahora: o.ahora, progreso: {} });
  const agregaria = filasArmadas(r1.ops);
  const cmp = r2 && !r2.error ? compararConMaestro(filasArmadas(r2.ops), maestro, r2.ctx) : { iguales: 0, distintas: [], faltan: [] };
  const err = r1.error || (r2 && r2.error) || '';
  const avisos = avisosDe(r1.logs);
  const difiere = agregaria.length || cmp.distintas.length || cmp.faltan.length;
  return { status: err ? 500 : difiere ? 409 : 200, cuerpo: {
    modo: 'sombra', archivos: resumirArchivos(r1, estado), filas_que_agregaria: agregaria.length,
    iguales: cmp.iguales, distintas: cmp.distintas.length, faltan: cmp.faltan.length, avisos, error: err, rondas: r1.rondas,
    detalle: { agregaria: agregaria.slice(0, 50).map((a) => ({ pestana: a.pestana, fila: a.fila, valores: a.valores.map(norm) })),
      distintas: cmp.distintas.slice(0, 100), faltan: cmp.faltan.slice(0, 100) } } };
}

/** NUBE: escribe las filas nuevas en el maestro y anota los archivos procesados. */
async function correrNube(o, deps) {
  precondiciones(deps);
  if (!deps.pool) throw error('Modo nube sin base.', 500);
  if (!deps.sheetsEscritura) throw error('Modo nube sin permiso de escribir el maestro (sheetsEscritura).', 503);
  const antes = await registro(deps.pool);
  const maestro = await leerMaestro(deps.sheetsLectura, MAESTRO);
  revisarZona(maestro);
  const estado = { libros: {}, carpetas: {}, respuestas: {} };
  // relojPruebas: solo las pruebas fijan la hora en modo nube (la ruta no lo acepta)
  const op = { progreso: antes, ahora: deps.relojPruebas };
  if (o.cierreBancos) Object.assign(op, { funcion: FUNCION_CIERRE, args: [o.cierreBancos] });
  const r = await correrConPrecarga(maestro, estado, Object.assign({ conversiones: new Map() }, deps), op);
  const archivos = o.cierreBancos ? resumirCierre(estado) : resumirArchivos(r, estado);
  const avisos = avisosDe(r.logs);
  if (r.error) return { status: 500, cuerpo: { modo: 'nube', archivos, escritas: 0, avisos, error: 'El cargador fallo y no se escribio nada: ' + r.error } };

  const sheets = sheetsDe(deps.sheetsEscritura);
  const plan = planEscritura(r.ops, maestro);
  let relectura = [];
  if (r.ops.length) {
    const ocupadas = await revisarDestinoVacio(sheets, MAESTRO, plan.rangos);
    if (ocupadas.length) {
      return { status: 409, cuerpo: { modo: 'nube', archivos, escritas: 0, avisos, error: 'El maestro cambio mientras corria (¿el activador de Apps Script sigue prendido?): ' +
        'hay algo en ' + ocupadas.slice(0, 10).join(', ') + '. No se escribio nada.' } };
    }
    await aplicar(sheets, MAESTRO, plan);
    relectura = await releer(sheets, MAESTRO, r.ops);
  }
  // el registro de procesados: lo que el cargador marco como visto (un banco frenado no se marca)
  const nuevas = Object.keys(r.progreso || {}).filter((h) => !antes[h]);
  for (const h of nuevas) {
    await deps.pool.query('INSERT INTO maestro_archivos_procesados (huella, archivo_id) VALUES ($1, $2) ON CONFLICT (huella) DO NOTHING', [h, h.split(':')[0]]);
  }
  const escritas = filasArmadas(r.ops).length;
  const mal = frenados(avisos) || relectura.length;
  return { status: mal ? 409 : 200, cuerpo: { modo: 'nube', cierre_bancos: o.cierreBancos || undefined, archivos, escritas, procesados_nuevos: nuevas.length, avisos, relectura: relectura.slice(0, 50) } };
}

// ---------------------------------------------------------------------------------------------------------------
// El cierre de bancos (cierre_bancos.js: cargarCierreBancos(mes)), 22-oct-2026
// ---------------------------------------------------------------------------------------------------------------

const p2c = (n) => (n < 10 ? '0' : '') + n;
function diaDe(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + p2c(v.getMonth() + 1) + '-' + p2c(v.getDate());
  const s = String(v === null || v === undefined ? '' : v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + p2c(+m[2]) + '-' + p2c(+m[1]);
}

/**
 * El maestro "como estaba antes del mes" en las pestañas del cierre: las filas de ese mes quedan en blanco (los datos;
 * las formulas de Año/Mes/Semana no importan). Asi el cargador arma TODAS las filas del mes y se comparan con las que
 * el maestro ya tiene. Lo de antes del mes (el ultimo Balance, la historia de categorias) queda igual.
 */
function sinMes(maestro, mes) {
  const pestanas = {};
  Object.keys(maestro.pestanas).forEach((n) => {
    const p = maestro.pestanas[n];
    if (!CIERRE[n]) { pestanas[n] = p; return; }
    const valores = p.valores.map((r, i) => {
      if (i < ESCRIBE[n].desde - 1 || diaDe(r[0]).slice(0, 7) !== mes) return r.slice();
      const x = r.slice();
      for (let c = 0; c < CIERRE[n].ancho && c < x.length; c++) x[c] = '';
      return x;
    });
    pestanas[n] = { valores, formulas: p.formulas, ultima: p.ultima };
  });
  return Object.assign({}, maestro, { pestanas });
}

/**
 * La comparacion del cierre. armadas: filasArmadas de la corrida sobre sinMes; maestro: el de verdad.
 * Cada fila armada se busca en el maestro por su llave (contando repetidos) y se compara celda por celda. Lo que
 * difiere se separa por clase, de la mas grave a la mas leve:
 *   valor          fecha, referencia, codigo, montos o saldo distintos (o el tipo de celda de la fecha o un monto)
 *   descripcion    otra descripcion
 *   categoria      Categoría o Es_Personal (en el maestro se reclasifica a mano despues de cargar)
 *   tipo           mismo valor, otro tipo de celda en Referencia o Codigo (texto en ene-ago, numero desde septiembre)
 *   desc_corta     el maestro tiene la descripcion CORTADA del PDF y el .xls la trae entera
 * faltan: armadas que el maestro no tiene. sobran: filas del mes en el maestro que el archivo no trae.
 */
function compararCierre(armadas, maestro, ctx, mes) {
  const llave = (n, f) => (CIERRE[n].cuenta ? ctx._cbClaveCuenta(diaDe(f[0]), f[1], ctx._numero(f[4]), ctx._numero(f[5]))
    : ctx._cbClaveTarjeta(diaDe(f[0]), f[1], ctx._numero(f[2]), ctx._numero(f[3])));
  const indice = {}, usadas = {};
  const tocadas = [...new Set(armadas.filter((a) => CIERRE[a.pestana]).map((a) => a.pestana))];
  tocadas.forEach((n) => {
    const p = maestro.pestanas[n], m = new Map();
    if (p) for (let i = ESCRIBE[n].desde - 1; i < p.valores.length; i++) {
      const f = p.valores[i];
      if (!diaDe(f[0])) continue;
      const k = llave(n, f);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(i);
    }
    indice[n] = m; usadas[n] = new Set();
  });
  const enc = (n, c) => { const h = maestro.pestanas[n].valores[ESCRIBE[n].desde - 2]; return h ? String(h[c - 1] || '') : ''; };
  const orden = ['valor', 'descripcion', 'categoria', 'tipo', 'desc_corta'];
  const cuenta = { iguales: 0, valor: 0, descripcion: 0, categoria: 0, tipo: 0, desc_corta: 0 };
  const detalle = [], faltan = [];
  armadas.filter((a) => CIERRE[a.pestana]).forEach((a) => {
    const C = CIERRE[a.pestana], k = llave(a.pestana, a.valores);
    const cand = (indice[a.pestana].get(k) || []).filter((i) => !usadas[a.pestana].has(i));
    if (!cand.length) { faltan.push({ pestana: a.pestana, llave: k }); return; }
    const i = cand[0]; usadas[a.pestana].add(i);
    const h = maestro.pestanas[a.pestana].valores[i], cols = [];
    for (let j = 0; j < C.ancho; j++) {
      const v = a.valores[j], enM = h[j] === undefined ? '' : h[j], col = j + 1;
      let clase = null;
      if (col === C.desc) {
        const x = ctx._cbDesc(enM).toUpperCase(), y = ctx._cbDesc(v).toUpperCase();
        if (x !== y) clase = x && y.indexOf(x) === 0 ? 'desc_corta' : 'descripcion';
      } else if (C.cat.indexOf(col) !== -1) {
        if (!igual(enM, v)) clase = 'categoria';
      } else if (!igual(enM, v)) clase = 'valor';
      else if (tipoEsperado(v, a.pestana, col) !== tipoCelda(enM)) clase = col === 1 || C.montos.indexOf(col) !== -1 ? 'valor' : 'tipo';
      if (clase) cols.push({ col, encabezado: enc(a.pestana, col), clase, maestro: norm(enM), nube: norm(v) });
    }
    if (!cols.length) { cuenta.iguales++; return; }
    const peor = orden.find((o) => cols.some((c) => c.clase === o));
    cuenta[peor]++;
    detalle.push({ pestana: a.pestana, llave: k, fila_maestro: i + 1, clase: peor, columnas: cols });
  });
  const sobran = [];
  tocadas.forEach((n) => {
    const p = maestro.pestanas[n];
    for (let i = ESCRIBE[n].desde - 1; i < p.valores.length; i++) {
      if (diaDe(p.valores[i][0]).slice(0, 7) === mes && !usadas[n].has(i)) sobran.push({ pestana: n, fila: i + 1, llave: llave(n, p.valores[i]) });
    }
  });
  return Object.assign(cuenta, { faltan, sobran, detalle });
}

/** SOMBRA del cierre: no escribe nada. Corre sobre el maestro tal cual (lo que agregaria hoy) y sobre sinMes. */
async function correrCierreSombra(o, deps) {
  precondiciones(deps);
  const maestro = o.maestro || await leerMaestro(deps.sheetsLectura, MAESTRO);
  revisarZona(maestro);
  const estado = o.estado || { libros: {}, carpetas: {}, respuestas: {} };
  const deps2 = Object.assign({ conversiones: new Map() }, deps);
  const op = { ahora: o.ahora, progreso: {}, funcion: FUNCION_CIERRE, args: [o.cierreBancos] };
  const r1 = await correrConPrecarga(maestro, estado, deps2, op);
  const r2 = r1.error ? null : await correrConPrecarga(sinMes(maestro, o.cierreBancos), estado, deps2, op);
  const agregaria = filasArmadas(r1.ops);
  const vacio = { iguales: 0, valor: 0, descripcion: 0, categoria: 0, tipo: 0, desc_corta: 0, faltan: [], sobran: [], detalle: [] };
  const cmp = r2 && !r2.error ? compararCierre(filasArmadas(r2.ops), maestro, r2.ctx, o.cierreBancos) : vacio;
  const err = r1.error || (r2 && r2.error) || '';
  const avisos = avisosDe(r1.logs);
  const difiere = agregaria.length || cmp.valor || cmp.descripcion || cmp.faltan.length || cmp.sobran.length || frenados(avisos);
  return { status: err ? 500 : difiere ? 409 : 200, cuerpo: {
    modo: 'sombra', cierre_bancos: o.cierreBancos, archivos: resumirCierre(estado), filas_que_agregaria: agregaria.length,
    iguales: cmp.iguales, solo_desc_corta: cmp.desc_corta, solo_tipo: cmp.tipo, categoria: cmp.categoria, descripcion: cmp.descripcion,
    valor: cmp.valor, faltan: cmp.faltan.length, sobran: cmp.sobran.length, avisos, error: err, rondas: r1.rondas, registro: r1.logs,
    detalle: { agregaria: agregaria.slice(0, 50).map((a) => ({ pestana: a.pestana, fila: a.fila, valores: a.valores.map(norm) })),
      diferencias: cmp.detalle.slice(0, 1000), faltan: cmp.faltan.slice(0, 100), sobran: cmp.sobran.slice(0, 100) } } };
}

async function anotar(pool, modo, ahora, r, ms) {
  if (!pool) return;
  const c = r.cuerpo;
  try {
    await pool.query('INSERT INTO maestro_corridas (modo, ahora, ok, archivos, resumen, error, ms) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [modo, ahora ? new Date(ahora) : null, r.status === 200, JSON.stringify(c.archivos || []),
        JSON.stringify(Object.assign({}, c, { archivos: undefined, detalle: c.detalle ? { distintas: c.detalle.distintas.slice(0, 20), faltan: c.detalle.faltan.slice(0, 20) } : undefined })),
        String(c.error || '').slice(0, 2000), ms]);
  } catch (e) { c.aviso_registro = 'No se anoto la corrida: ' + e.message; }   // sin la migracion 009 todavia
}

/**
 * correrMaestro({ modo, ahora, estado }, deps) → { status, cuerpo }.
 * deps: { pool, sheetsLectura, sheetsCuenta?, drive, sheetsEscritura?, conversiones?, guardarCorridas? }
 */
async function correrMaestro(opciones, deps) {
  const o = opciones || {};
  const modo = o.modo || await leerModo(deps.pool);
  if (modo === 'apps') return { status: 200, cuerpo: { modo: 'apps' } };
  if (o.ahora && modo !== 'sombra') throw error('Con un reloj simulado solo se corre en sombra.', 400);
  const t0 = Date.now();
  if (o.cierreBancos !== undefined && !/^20\d\d-(0[1-9]|1[0-2])$/.test(String(o.cierreBancos))) throw error('cierre_bancos va como AAAA-MM.', 400);
  const r = modo === 'sombra' ? await (o.cierreBancos ? correrCierreSombra(o, deps) : correrSombra(o, deps)) : await correrNube(o, deps);
  r.cuerpo.ok = r.status === 200;
  r.cuerpo.ms = Date.now() - t0;
  if (deps.guardarCorridas !== false) await anotar(deps.pool, modo, o.ahora, r, r.cuerpo.ms);
  return r;
}

function claveIgual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/**
 * POST /tareas/procesos/maestro (cabecera x-rosanta-tarea = clave-tareas). Cuerpo opcional:
 *   { ahora: '2026-10-26T12:00:00-06:00' }  reproduce ese lunes (solo en sombra)
 *   { cierre_bancos: '2026-10' }              el CIERRE DE BANCOS de ese mes (cargarCierreBancos de cierre_bancos.js) en vez de
 *                                             la carga de los lunes; lee <mes>/_sistema/ de Reportes Mensual
 * 200 bien · 409 la sombra difiere / un banco se freno / el maestro cambio / la relectura no coincide · 500 fallo.
 * deps: { pool, claveTareas, sheetsLectura, drive, sheetsEscritura }
 */
function montarMaestro(app, deps) {
  let corriendo = false;
  app.post('/tareas/procesos/maestro', async (req, res, next) => {
    if (!claveIgual(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    const b = req.body || {};
    let ahora = null;
    if (b.ahora !== undefined) { ahora = Date.parse(b.ahora); if (!Number.isFinite(ahora)) return res.status(400).json({ error: 'ahora va como fecha ISO.' }); }
    if (b.cierre_bancos !== undefined && !/^20\d\d-(0[1-9]|1[0-2])$/.test(String(b.cierre_bancos))) return res.status(400).json({ error: 'cierre_bancos va como AAAA-MM.' });
    if (corriendo) return res.status(409).json({ error: 'Ya hay una carga del maestro en marcha.' });
    corriendo = true;
    try {
      const r = await correrMaestro({ ahora, cierreBancos: b.cierre_bancos }, Object.assign({ conversiones: deps.conversiones || new Map() }, deps));
      res.status(r.status).json(r.cuerpo);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    } finally { corriendo = false; }
  });
}

module.exports = {
  MAESTRO, REPORTES_2026, INTERRUPTOR, ESCRIBE, PESTANAS, ENTRADA,
  CIERRE, sinMes, compararCierre, correrCierreSombra,
  archivosMaestro, armarPestana, leerMaestro, sinLlaves, crearMotorMaestro, correrConPrecarga, filasArmadas,
  compararConMaestro, tipoEsperado, planEscritura, leerModo, correrMaestro, montarMaestro
};
