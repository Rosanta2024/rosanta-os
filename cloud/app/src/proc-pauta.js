/**
 * PROCESO DE PAUTA DE LOS LUNES EN LA NUBE (20-oct-2026, servicio de procesos).
 *
 * La pestaña pauta_semanal de "Rosanta Marketing OS" tiene cuatro escritores, todos los lunes:
 *   pauta_ads_import  Google Ads Script (vive en Google Ads y NO se muda): sigue escribiendo la hoja y la nube
 *                     IMPORTA sus columnas (gCosto gClics gImp mCosto mAlcance fecha_registro) a la tabla.
 *   pauta_pos         PosPauta.js        → comensales, ticket (todas las semanas que encuentra en los POS)
 *   pauta_wix         WixReservasPauta.js → reservas, comensalesReserva (la semana que acaba de cerrar)
 *   pauta_clientes    ClientesNuevos.js  → clientes_nuevos, repetidos (la semana que acaba de cerrar)
 * Los tres de Apps Script corren aca con su CODIGO REAL (copias exactas en cloud/app/mkt/, traer-mkt.sh) dentro de
 * un vm, con imitaciones de SpreadsheetApp, DriveApp, UrlFetchApp, PropertiesService y Utilities.
 *
 * PRECARGA POR RONDAS. El codigo de Apps Script es sincronico y aca nunca se hace HTTP sincronico. El motor corre
 * la funcion real; cada cosa que pide y que todavia no esta precargada (una hoja, una pestaña, una carpeta de
 * Drive, una llamada a Wix, la conversion de un xlsx) queda anotada como FALTA y corta esa corrida. Node trae
 * todas las faltas (asincronico, con las claves del servidor, que nunca entran al vm) y vuelve a correr la funcion
 * DESDE CERO sobre copias limpias. Se repite hasta que corre sin faltas. Asi el pedido es exactamente el que arma
 * el codigo real (las fechas de Wix, la paginacion, que archivos del POS toma) y no una segunda version.
 *
 * Interruptor por escritor en la tabla interruptores (migracion 013), sin fila = 'apps':
 *   apps    no hace nada (sigue mandando el activador de Apps Script)
 *   sombra  calcula lo que el escritor habria puesto y lo COMPARA con lo que la hoja tiene hoy (409 si difiere);
 *           no escribe en ningun lado
 *   nube    escribe sus columnas en la tabla pauta_semanal (migracion 007) y copia a la hoja SOLO esas celdas
 *           (el activador de Apps Script de ese escritor tiene que estar apagado)
 * Para pauta_ads_import: sombra = revisa la hoja y dice que cambiaria en la tabla; nube = lo importa.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { formatDate } = require('./motor-pagos');
const C = require('./copia-hojas');

const DIR = path.join(__dirname, '..', 'mkt');
const LIBRO_MKT = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';   // Rosanta Marketing OS
const PESTANA = 'pauta_semanal';
const WIX_SITE_ID = '47968b83-c2c2-4b11-8f94-ef2c7488debc';          // no es secreto (WixReservasPauta.js)
const MIME_HOJA = 'application/vnd.google-apps.spreadsheet';
const MIME_CARPETA = 'application/vnd.google-apps.folder';
const MAX_RONDAS = 40;

/** Orden de la hoja: SCHEMA.pauta_semanal de la intranet (MarketingDatos.js) + repetidos (ClientesNuevos.js). */
const COLUMNAS = ['wk', 'gCosto', 'gClics', 'gImp', 'mCosto', 'mAlcance', 'reservas', 'fecha_registro', 'comensales',
  'comensalesReserva', 'ticket', 'clientes_nuevos', 'repetidos'];
const COLS_ADS = ['gCosto', 'gClics', 'gImp', 'mCosto', 'mAlcance', 'fecha_registro'];

/** Los escritores de Apps Script: la funcion del activador de los lunes y las columnas que le tocan. */
const ESCRITORES = {
  pauta_pos: { funcion: 'posActualizarPauta', columnas: ['comensales', 'ticket'], act: 'act_pos' },
  pauta_wix: { funcion: 'reservasSemanaPasada', columnas: ['reservas', 'comensalesReserva'], act: 'act_wix' },
  pauta_clientes: { funcion: 'cnSemanal', columnas: ['clientes_nuevos', 'repetidos'], act: 'act_clientes' }
};
// En este orden, como los activadores de Apps Script (POS 5-6, Wix 7-8, clientes 9:30, Google Ads 10-11).
const MODULOS = ['pauta_ads_import', 'pauta_pos', 'pauta_wix', 'pauta_clientes'];
const MODOS = ['apps', 'sombra', 'nube'];

// ---------------------------------------------------------------------------------------------------------------
// Imitaciones de Apps Script
// ---------------------------------------------------------------------------------------------------------------

/** Una falta de precarga: se anota y corta la corrida (el codigo real la puede atrapar; igual queda anotada). */
class FaltaPrecarga extends Error {
  constructor(f) { super('PRECARGA: falta ' + JSON.stringify(f)); this.falta = f; }
}

/** Date con el reloj fijo en `ms` (para reproducir un lunes pasado). Las fechas de las hojas siguen siendo Date. */
function relojFijo(ms) {
  const Base = Date;
  class D extends Base {
    constructor(...a) { if (a.length === 0) super(ms); else super(...a); }
    static now() { return ms; }
    static [Symbol.hasInstance](x) { return x instanceof Base; }
  }
  return D;
}

const iter = (xs) => { let i = 0; return { hasNext: () => i < xs.length, next: () => xs[i++] }; };

/**
 * Un motor nuevo por ronda. estado: { libros, carpetas, respuestas } (la precarga; no se modifica aca salvo las
 * faltas). opciones: { ahora (ms), env: { WIX_API_KEY presente?, WIX_SITE_ID } }.
 */
function crearMotorPauta(estado, opciones) {
  const o = opciones || {};
  const faltas = [], vistas = new Set(), logs = [], escrituras = [];
  const trabajo = {};   // 'libro|pestana' → matriz de trabajo (copia)
  const falta = (f) => {
    const k = JSON.stringify(f);
    if (!vistas.has(k)) { vistas.add(k); faltas.push(f); }
    throw new FaltaPrecarga(f);
  };

  function datos(id, n) {
    const k = id + '|' + n;
    if (trabajo[k]) return trabajo[k];
    const orig = estado.libros[id].datos[n];
    if (!orig) falta({ tipo: 'pestana', id, nombre: n });
    trabajo[k] = orig.map((r) => r.slice());
    return trabajo[k];
  }

  function pestana(id, n) {
    const editable = id === LIBRO_MKT && n === PESTANA;
    const R = () => datos(id, n);
    const ancho = () => R().reduce((a, r) => Math.max(a, r.length), 0);
    const escribir = (fila, col, valor) => {
      if (!editable) throw new Error('El proceso de pauta no escribe en ' + n + ' (' + id + ').');
      if (fila < 1 || col < 1) throw new Error('Celda invalida (' + fila + ',' + col + ').');
      const M = R();
      while (M.length < fila) M.push([]);
      const r = M[fila - 1];
      while (r.length < col) r.push('');
      r[col - 1] = valor instanceof Date ? new Date(valor.getTime()) : valor;
      escrituras.push({ fila, col, valor });
    };
    const rango = (fila, col, nf, nc) => {
      const g = {
        getValues: () => {
          const M = R(), out = [];
          for (let i = 0; i < (nf || 1); i++) {
            const row = M[fila - 1 + i] || [], x = [];
            for (let j = 0; j < (nc || 1); j++) x.push(row[col - 1 + j] === undefined ? '' : row[col - 1 + j]);
            out.push(x);
          }
          return out;
        },
        getValue: () => g.getValues()[0][0],
        setValue: (v) => { escribir(fila, col, v); return g; },
        setValues: (v) => { v.forEach((row, i) => row.forEach((x, j) => escribir(fila + i, col + j, x))); return g; },
        setFontWeight: () => g, setNumberFormat: () => g
      };
      return g;
    };
    const self = {
      getName: () => n,
      getLastRow: () => { const M = R(); let u = 0; M.forEach((r, i) => { if (r.some((x) => x !== '' && x !== undefined)) u = i + 1; }); return u; },
      getLastColumn: () => ancho(),
      getMaxColumns: () => Math.max(ancho(), 26),
      getMaxRows: () => Math.max(R().length, 1000),
      getDataRange: () => ({ getValues: () => { const w = ancho(); return R().map((r) => { const x = r.slice(); while (x.length < w) x.push(''); return x; }); } }),
      getRange: (a, c, nf, nc) => {
        if (typeof a === 'string') throw new Error('El proceso de pauta no imita rangos A1 (' + a + ').');
        return rango(a, c, nf, nc);
      },
      appendRow: (fila) => { const u = self.getLastRow(); fila.forEach((x, j) => escribir(u + 1, j + 1, x)); return self; },
      insertColumnsAfter: () => self,
      setFrozenRows: () => self
    };
    return self;
  }

  const ctx = {
    SpreadsheetApp: {
      openById: (id) => {
        const L = estado.libros[id];
        if (!L) falta({ tipo: 'libro', id });
        return {
          getId: () => id,
          getSheetByName: (n) => (L.titulos.indexOf(n) === -1 ? null : pestana(id, n)),
          getSheets: () => L.titulos.map((n) => pestana(id, n)),
          insertSheet: (n) => { throw new Error('El proceso de pauta no crea pestañas (' + n + ').'); }
        };
      },
      flush: () => {}
    },
    DriveApp: {
      getFolderById: (id) => {
        const c = estado.carpetas[id];
        if (!c) falta({ tipo: 'carpeta', id });
        const carpeta = (cid, nombre) => ({
          getId: () => cid, getName: () => nombre,
          getFolders: () => { const x = estado.carpetas[cid]; if (!x) falta({ tipo: 'carpeta', id: cid }); return iter(x.carpetas.map((s) => carpeta(s.id, s.nombre))); },
          getFiles: () => { const x = estado.carpetas[cid]; if (!x) falta({ tipo: 'carpeta', id: cid }); return iter(x.archivos.map(archivo)); }
        });
        return carpeta(id, c.nombre);
      },
      getFileById: (id) => {
        if (String(id).indexOf('tmp:') !== 0) throw new Error('El proceso de pauta solo toca los temporales que crea (' + id + ').');
        // el temporal de la conversion ya se borro en la precarga, apenas se leyo
        return { getId: () => id, setTrashed: () => {} };
      }
    },
    UrlFetchApp: {
      fetch: (url, op) => {
        const p = op || {};
        const metodo = String(p.method || 'get').toUpperCase();
        const cuerpo = p.payload === undefined ? '' : String(p.payload);
        const clave = metodo + ' ' + url + ' ' + cuerpo;
        const r = estado.respuestas[clave];
        // los encabezados (la llave de Wix, el token de Google) NO se anotan: los pone Node
        if (!r) falta({ tipo: 'url', clave, url, metodo, cuerpo, contentType: p.contentType || '' });
        if (!p.muteHttpExceptions && r.code >= 400) throw new Error('Request failed for ' + url + ' returned code ' + r.code + '. Truncated server response: ' + r.texto.slice(0, 200));
        return { getResponseCode: () => r.code, getContentText: () => r.texto };
      }
    },
    PropertiesService: { getScriptProperties: () => ({
      // la llave de verdad nunca entra al vm: Node la pone al llamar a Wix
      getProperty: (k) => ({ WIX_API_KEY: (o.env && o.env.WIX_API_KEY) ? '(la pone la nube)' : '', WIX_SITE_ID: (o.env && o.env.WIX_SITE_ID) || '' })[k] || null,
      setProperty: () => {}, deleteProperty: () => {}
    }) },
    ScriptApp: {
      getOAuthToken: () => '(lo pone la nube)',
      getProjectTriggers: () => [], deleteTrigger: () => {},
      newTrigger: () => { throw new Error('En la nube los relojes son de Cloud Scheduler.'); }
    },
    Utilities: { formatDate, sleep: () => {}, getUuid: () => crypto.randomUUID() },
    Logger: { log: (...a) => { logs.push(a.map(String).join(' ')); } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    console: { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push(a.map(String).join(' ')), warn: (...a) => logs.push(a.map(String).join(' ')) },
    JSON, Math, Date: o.ahora ? relojFijo(o.ahora) : Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Intl, Symbol
  };
  vm.createContext(ctx);
  archivosPauta().forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: 'mkt/' + f }));

  function archivo(f) {
    return { getId: () => f.id, getName: () => f.nombre, getMimeType: () => f.mime };
  }

  /** Corre la funcion real. Devuelve { faltas, error, escrituras, logs, pauta (la matriz de trabajo final) }. */
  function correr(nombre) {
    if (typeof ctx[nombre] !== 'function') throw new Error('Marketing OS no tiene la funcion ' + nombre + '.');
    let error = null;
    try { ctx[nombre](); } catch (e) { if (!(e instanceof FaltaPrecarga)) error = String(e && e.message || e); }
    return { faltas, error, escrituras, logs, pauta: trabajo[LIBRO_MKT + '|' + PESTANA] || null };
  }
  return { correr, ctx };
}

function archivosPauta() {
  return fs.readFileSync(path.join(DIR, 'LISTA-PAUTA.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------
// La precarga (Node, asincronica)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Lo minimo de Drive para el POS, con la cuenta de restaurante@ (google-cuenta.js): listar (drive.readonly),
 * bajar el xlsx (drive.readonly), subirlo convertido a Hoja de Google y borrarlo (drive.file: solo toca lo suyo).
 */
function crearDrive(cuenta, fetchFn) {
  const f = fetchFn || fetch;
  const D = 'https://www.googleapis.com/drive/v3/files';
  async function pedir(url, op) {
    const p = Object.assign({}, op || {});
    p.headers = Object.assign({ Authorization: 'Bearer ' + await cuenta.accessToken() }, p.headers || {});
    const r = await f(url, p);
    if (!r.ok) throw new Error('Drive respondio ' + r.status + ' en ' + url.replace(/\?.*/, '') + ': ' + (await r.text()).slice(0, 200));
    return r;
  }
  return {
    async carpeta(id) {
      const meta = await (await pedir(D + '/' + encodeURIComponent(id) + '?fields=id,name&supportsAllDrives=true')).json();
      const hijos = [];
      let token = '';
      do {
        const q = new URLSearchParams({ q: "'" + id + "' in parents and trashed = false", pageSize: '1000', supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)' });
        if (token) q.set('pageToken', token);
        const j = await (await pedir(D + '?' + q)).json();
        hijos.push(...(j.files || []));
        token = j.nextPageToken || '';
      } while (token);
      return { nombre: meta.name,
        carpetas: hijos.filter((x) => x.mimeType === MIME_CARPETA).map((x) => ({ id: x.id, nombre: x.name })),
        archivos: hijos.filter((x) => x.mimeType !== MIME_CARPETA).map((x) => ({ id: x.id, nombre: x.name, mime: x.mimeType, modificado: x.modifiedTime || '' })) };
    },
    async meta(id) { return (await pedir(D + '/' + encodeURIComponent(id) + '?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true')).json(); },
    async bajar(id) { return Buffer.from(await (await pedir(D + '/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true')).arrayBuffer()); },
    /** Sube los bytes convirtiendolos a Hoja de Google (el mismo convertidor que el /copy de PosPauta.js). */
    async subirComoHoja(bytes, nombre, mimeOrigen) {
      const limite = 'rosanta' + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: nombre, mimeType: MIME_HOJA });
      const cuerpo = Buffer.concat([
        Buffer.from('--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + limite + '\r\nContent-Type: ' + (mimeOrigen || 'application/octet-stream') + '\r\n\r\n'),
        Buffer.from(bytes), Buffer.from('\r\n--' + limite + '--')]);
      const j = await (await pedir('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + limite }, body: cuerpo })).json();
      return j.id;
    },
    async borrar(id) { await pedir(D + '/' + encodeURIComponent(id), { method: 'DELETE' }); }
  };
}

/**
 * Un cliente de Sheets de solo lectura con la cuenta de restaurante@ (drive.readonly alcanza para leer cualquier
 * hoja que la cuenta ve, y drive.file para los temporales que crea). Solo spreadsheets.get, que es lo que usa
 * copia-hojas.leerLibro.
 */
function sheetsDeCuenta(cuenta, fetchFn) {
  const f = fetchFn || fetch;
  return { spreadsheets: { async get(p) {
    const q = new URLSearchParams();
    (p.ranges || []).forEach((r) => q.append('ranges', r));
    if (p.includeGridData) q.set('includeGridData', 'true');
    if (p.fields) q.set('fields', p.fields);
    const r = await f('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(p.spreadsheetId) + '?' + q,
      { headers: { Authorization: 'Bearer ' + await cuenta.accessToken() } });
    if (!r.ok) throw new Error('Sheets respondio ' + r.status + ' leyendo ' + p.spreadsheetId + ': ' + (await r.text()).slice(0, 200));
    return { data: await r.json() };
  } } };
}

async function titulosDe(sheets, id) {
  const m = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
  return m.data.sheets.map((s) => s.properties.title);
}

/** Lee un libro: los nombres de todas sus pestañas y los datos de `pestanas` (o de la primera). */
async function cargarLibro(sheets, id, pestanas) {
  const titulos = await titulosDe(sheets, id);
  const quiero = (pestanas || titulos.slice(0, 1)).filter((n) => titulos.indexOf(n) !== -1);
  const datos = quiero.length ? await C.leerLibro(sheets, id, quiero) : {};
  return { titulos, datos };
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Trae una falta. deps: { sheetsLectura, drive, fetch, env, esperar, conversiones (Map) }. */
async function resolverFalta(f, estado, deps) {
  if (f.tipo === 'libro') {
    estado.libros[f.id] = await cargarLibro(deps.sheetsLectura, f.id);
    return;
  }
  if (f.tipo === 'pestana') {
    const L = estado.libros[f.id];
    Object.assign(L.datos, await C.leerLibro(deps.sheetsLectura, f.id, [f.nombre]));
    if (!L.datos[f.nombre]) L.datos[f.nombre] = [];
    return;
  }
  if (f.tipo === 'carpeta') {
    if (!deps.drive) throw new Error('El proceso de pauta necesita Drive (la cuenta de restaurante@, GMAIL_OAUTH) para leer la carpeta ' + f.id + '.');
    // la carpeta y, de una vez, sus subcarpetas (PosPauta recorre las S## una por una: asi es una sola ronda)
    const c = await deps.drive.carpeta(f.id);
    estado.carpetas[f.id] = c;
    for (const s of c.carpetas) if (!estado.carpetas[s.id]) estado.carpetas[s.id] = await deps.drive.carpeta(s.id);
    return;
  }
  if (f.tipo === 'url') {
    estado.respuestas[f.clave] = await responderUrl(f, estado, deps);
    return;
  }
  throw new Error('Falta desconocida: ' + JSON.stringify(f));
}

async function responderUrl(f, estado, deps) {
  const fetchFn = deps.fetch || fetch;
  if (f.url.indexOf('https://www.wixapis.com/') === 0) {
    const env = deps.env || {};
    if (!env.WIX_API_KEY) throw new Error('Falta WIX_API_KEY en el servidor (secreto wix-api-key).');
    let r = null;
    for (let intento = 1; intento <= 3; intento++) {
      const res = await fetchFn(f.url, { method: f.metodo, headers: { Authorization: env.WIX_API_KEY, 'wix-site-id': env.WIX_SITE_ID || WIX_SITE_ID,
        'Content-Type': f.contentType || 'application/json' }, body: f.metodo === 'GET' ? undefined : f.cuerpo });
      r = { code: res.status, texto: await res.text() };
      if ([429, 500, 502, 503, 504].indexOf(r.code) === -1) break;
      await (deps.esperar || esperar)(1500 * intento);
    }
    return r;
  }
  const m = f.url.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^/?]+)\/copy$/);
  if (m && f.metodo === 'POST') {
    // PosPauta.posLeerTabla_: copia convertida del xlsx. Aca: se baja, se sube convertido, se lee y se borra.
    const pedido = JSON.parse(f.cuerpo || '{}');
    if (pedido.mimeType !== MIME_HOJA) throw new Error('El proceso de pauta solo imita la copia convertida a Hoja de Google.');
    const id = decodeURIComponent(m[1]);
    estado.libros['tmp:' + id] = await convertir(id, pedido.name, estado, deps);
    return { code: 200, texto: JSON.stringify({ id: 'tmp:' + id, name: pedido.name, mimeType: MIME_HOJA }) };
  }
  throw new Error('El proceso de pauta no sabe precargar ' + f.metodo + ' ' + f.url.replace(/\?.*/, ''));
}

/** El xlsx del POS como lo ve el codigo real despues de convertirlo: la primera pestaña, como getValues(). */
async function convertir(id, nombre, estado, deps) {
  if (!deps.drive) throw new Error('El proceso de pauta necesita Drive para convertir el POS ' + id + '.');
  const archivoVisto = Object.values(estado.carpetas).reduce((a, c) => a || c.archivos.find((x) => x.id === id), null);
  const meta = archivoVisto ? { mime: archivoVisto.mime, modificado: archivoVisto.modificado } : await deps.drive.meta(id).then((j) => ({ mime: j.mimeType, modificado: j.modifiedTime }));
  const clave = id + '|' + (meta.modificado || '');
  if (deps.conversiones && deps.conversiones.has(clave)) return deps.conversiones.get(clave);
  const bytes = await deps.drive.bajar(id);
  const tmp = await deps.drive.subirComoHoja(bytes, nombre || 'tmp_pos_nube', meta.mime);
  let libro;
  try { libro = await cargarLibro(deps.sheetsCuenta || deps.sheetsLectura, tmp); } finally { await deps.drive.borrar(tmp).catch(() => {}); }
  libro = { titulos: libro.titulos.slice(0, 1), datos: libro.datos };
  if (deps.conversiones) deps.conversiones.set(clave, libro);
  return libro;
}

/** Hasta 4 faltas a la vez (25 POS de a uno tardan demasiado). */
async function resolverFaltas(faltas, estado, deps) {
  const cola = faltas.slice();
  const trabajador = async () => { while (cola.length) await resolverFalta(cola.shift(), estado, deps); };
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
}

/** Corre la funcion real hasta que no le falte nada. Devuelve el resultado de la ultima ronda. */
async function correrConPrecarga(funcion, estado, deps, opciones) {
  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    const m = crearMotorPauta(estado, opciones);
    const r = m.correr(funcion);
    if (!r.faltas.length) return Object.assign(r, { rondas: ronda });
    await resolverFaltas(r.faltas, estado, deps);
  }
  throw new Error(funcion + ': despues de ' + MAX_RONDAS + ' rondas de precarga todavia le faltan datos.');
}

// ---------------------------------------------------------------------------------------------------------------
// Lo que escribio, la comparacion y la copia
// ---------------------------------------------------------------------------------------------------------------

const cab = (M) => (M && M[0] ? M[0].map((h) => String(h).trim()) : []);

/** Las escrituras del motor → { semanas: {wk: {columna: valor}}, encabezado: [columnas nuevas], ajenas: [...] }. */
function leerEscrituras(r, columnas) {
  const M = r.pauta || [];
  const H = cab(M), iWk = H.indexOf('wk');
  const semanas = {}, encabezado = [], ajenas = [];
  r.escrituras.forEach((e) => {
    if (e.fila === 1) { if (columnas.indexOf(String(e.valor)) === -1) ajenas.push('encabezado ' + e.valor); else encabezado.push(String(e.valor)); return; }
    const nombre = H[e.col - 1];
    if (nombre === 'wk') return;   // appendRow pone el wk de la fila nueva
    if (columnas.indexOf(nombre) === -1) {
      if (e.valor !== '' || !M[e.fila - 1] || M[e.fila - 1][e.col - 1] !== '') ajenas.push('S' + M[e.fila - 1][iWk] + ' ' + (nombre || 'columna ' + e.col));
      return;   // appendRow escribe '' en todas las columnas de la fila nueva: eso no es tocar lo ajeno
    }
    const wk = Number(M[e.fila - 1][iWk]);
    (semanas[wk] = semanas[wk] || {})[nombre] = M[e.fila - 1][e.col - 1];
  });
  return { semanas, encabezado, ajenas };
}

function iguales(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return a === b;
}

/** Fila de la semana como la buscan los escritores: la primera con String(wk) igual. */
function filaDe(M, wk) {
  const iWk = cab(M).indexOf('wk');
  for (let i = 1; i < M.length; i++) if (String(M[i][iWk]) === String(wk)) return i;
  return -1;
}

/** Lo que calculo el escritor contra lo que la hoja tiene hoy. */
function comparar(semanas, hoja) {
  const H = cab(hoja), dif = [];
  Object.keys(semanas).forEach((wk) => {
    const i = filaDe(hoja, wk);
    Object.keys(semanas[wk]).forEach((col) => {
      const j = H.indexOf(col);
      const enHoja = i < 0 ? '(sin fila)' : j < 0 ? '(sin columna)' : (hoja[i][j] === undefined ? '' : hoja[i][j]);
      if (!iguales(semanas[wk][col], enHoja)) dif.push({ wk: Number(wk), columna: col, hoja: enHoja, nube: semanas[wk][col] });
    });
  });
  return dif;
}

const p2 = (n) => (n < 10 ? '0' : '') + n;
const diaLocal = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

/** Un valor de la hoja → el de la tabla (null, numero o 'AAAA-MM-DD'). Devuelve { v } o { problema }. */
function aBase(col, x) {
  if (x === '' || x === null || x === undefined) return { v: null };
  if (col === 'fecha_registro') {
    if (x instanceof Date) return { v: diaLocal(x) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(x).trim())) return { v: String(x).trim() };
    return { problema: 'fecha invalida' };
  }
  if (typeof x === 'number' && Number.isFinite(x)) return { v: x };
  if (typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x.trim())) return { v: Number(x.trim()) };
  return { problema: 'no es un numero' };
}

const q = (c) => '"' + c + '"';

/** Escribe en la tabla las columnas de un escritor, semana por semana, en una transaccion. */
async function guardarEnBase(pool, semanas, columnas, act) {
  const wks = Object.keys(semanas);
  if (!wks.length) return 0;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const wk of wks) {
      const cols = columnas.filter((x) => x in semanas[wk]);
      const vals = cols.map((x) => { const b = aBase(x, semanas[wk][x]); if (b.problema) throw new Error('S' + wk + ' ' + x + ': ' + b.problema); return b.v; });
      const lista = cols.map(q).concat([act]);
      const sql = 'INSERT INTO pauta_semanal (wk, ' + lista.join(', ') + ') VALUES ($1, ' + cols.map((_, i) => '$' + (i + 2)).concat(['now()']).join(', ') +
        ') ON CONFLICT (wk) DO UPDATE SET ' + lista.map((x) => x + ' = EXCLUDED.' + x).join(', ');
      await c.query(sql, [Number(wk)].concat(vals));
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  return wks.length;
}

/** Columna 1 → A, 27 → AA. */
function letra(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/**
 * Copia a la hoja SOLO las celdas del escritor (como sus setValue de Apps Script). La fila de la semana se busca
 * en la hoja tal como esta al momento de copiar; si no esta, se agrega al final (como su appendRow).
 */
async function copiarAHoja(sheets, semanas, encabezado, libroId) {
  const id = libroId || LIBRO_MKT;
  const v = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'" + PESTANA + "'", valueRenderOption: 'UNFORMATTED_VALUE' });
  const V = v.data.values || [];
  const H = cab(V);
  if (H.indexOf('wk') < 0) throw new Error('pauta_semanal no tiene la columna wk.');
  const data = [];
  encabezado.forEach((n) => { if (H.indexOf(n) === -1) { H.push(n); data.push({ range: "'" + PESTANA + "'!" + letra(H.length) + '1', values: [[n]] }); } });
  const nuevas = [];
  Object.keys(semanas).forEach((wk) => {
    const i = filaDe(V, wk);
    const cols = Object.keys(semanas[wk]);
    cols.forEach((col) => { if (H.indexOf(col) === -1) throw new Error('pauta_semanal no tiene la columna ' + col + '.'); });
    if (i < 0) {
      const linea = H.map(() => '');
      linea[H.indexOf('wk')] = Number(wk);
      cols.forEach((col) => { linea[H.indexOf(col)] = semanas[wk][col]; });
      nuevas.push(linea);
      return;
    }
    cols.forEach((col) => data.push({ range: "'" + PESTANA + "'!" + letra(H.indexOf(col) + 1) + (i + 1), values: [[semanas[wk][col]]] }));
  });
  if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: 'RAW', data } });
  for (const linea of nuevas) {
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: "'" + PESTANA + "'!A1", valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [linea] } });
  }
  return { celdas: data.length, filas_nuevas: nuevas.length };
}

// ---------------------------------------------------------------------------------------------------------------
// Google Ads (importar de la hoja)
// ---------------------------------------------------------------------------------------------------------------

/** Las columnas del Google Ads Script de cada semana de la hoja. */
function filasAds(hoja) {
  const H = cab(hoja), iWk = H.indexOf('wk'), semanas = {}, problemas = [];
  if (iWk < 0) return { semanas, problemas: ['pauta_semanal no tiene la columna wk.'] };
  for (let i = 1; i < hoja.length; i++) {
    const w = hoja[i][iWk];
    if (w === '' || w === undefined) continue;
    const wk = Number(w);
    if (!Number.isInteger(wk) || wk < 1 || wk > 53) { problemas.push('Fila ' + (i + 1) + ': wk invalido (' + w + ').'); continue; }
    if (semanas[wk]) { problemas.push('S' + wk + ' esta dos veces (filas ' + semanas[wk]._fila + ' y ' + (i + 1) + '); se toma la primera, como los escritores.'); continue; }
    const s = { _fila: i + 1 };
    COLS_ADS.forEach((col) => {
      const j = H.indexOf(col);
      const b = aBase(col, j < 0 ? '' : hoja[i][j]);
      if (b.problema) problemas.push('S' + wk + ' ' + col + ': ' + b.problema + ' (' + hoja[i][j] + ').');
      else s[col] = b.v;
    });
    semanas[wk] = s;
  }
  Object.values(semanas).forEach((s) => { delete s._fila; });
  return { semanas, problemas };
}

/** Lo que la tabla tiene hoy de las columnas de Google Ads: {wk: {col: valor}} con numeros y 'AAAA-MM-DD'. */
async function adsEnBase(pool) {
  const r = await pool.query('SELECT wk, ' + COLS_ADS.map(q).join(', ') + ' FROM pauta_semanal');
  const out = {};
  r.rows.forEach((x) => {
    const s = {};
    COLS_ADS.forEach((c) => {
      const v = x[c];
      s[c] = v === null || v === undefined ? null : c === 'fecha_registro' ? (v instanceof Date ? diaLocal(v) : String(v).slice(0, 10)) : Number(v);
    });
    out[x.wk] = s;
  });
  return out;
}

async function importarAds(hoja, modo, deps) {
  const { semanas, problemas } = filasAds(hoja);
  const ok = !problemas.length;
  if (modo === 'sombra' || !deps.pool) {
    let cambiarian = null;
    if (deps.pool) {
      const hoy = await adsEnBase(deps.pool);
      cambiarian = Object.keys(semanas).filter((wk) => !hoy[wk] || COLS_ADS.some((c) => hoy[wk][c] !== semanas[wk][c])).map(Number);
    }
    return { ok, semanas, problemas, cambiarian };
  }
  const n = await guardarEnBase(deps.pool, semanas, COLS_ADS, 'act_ads');
  return { ok, semanas, problemas, escritas: { base: n, hoja: 0 } };
}

// ---------------------------------------------------------------------------------------------------------------
// La corrida
// ---------------------------------------------------------------------------------------------------------------

/** Los modos de la tabla interruptores. Sin tabla o sin fila: 'apps'. */
async function leerModos(pool) {
  const out = {};
  MODULOS.forEach((m) => { out[m] = 'apps'; });
  if (!pool) return out;
  try {
    const r = await pool.query('SELECT modulo, modo FROM interruptores WHERE modulo = ANY($1)', [MODULOS]);
    r.rows.forEach((x) => { if (MODOS.indexOf(x.modo) !== -1) out[x.modulo] = x.modo; });
  } catch (e) { /* sin tabla todavia: apps */ }
  return out;
}

function sinFechas(o) { return JSON.parse(JSON.stringify(o, (k, v) => v)); }

/**
 * correrPauta({ modos, ahora, soloModulos }, deps)
 *   modos: { modulo: 'apps'|'sombra'|'nube' } (de leerModos, o forzados por el ensayo)
 *   ahora: ms del reloj simulado (solo con todo en sombra)
 * deps: { sheetsLectura, sheetsCuenta, sheetsEscritura, drive, fetch, env, pool, conversiones, guardarCorridas }
 * Devuelve { status, modulos: { modulo: {...} } }.
 */
async function correrPauta(opciones, deps) {
  const o = opciones || {};
  const modos = o.modos;
  const activos = MODULOS.filter((m) => modos[m] && modos[m] !== 'apps' && (!o.soloModulos || o.soloModulos.indexOf(m) !== -1));
  if (o.ahora && activos.some((m) => modos[m] === 'nube')) throw Object.assign(new Error('Con un reloj simulado solo se corre en sombra.'), { status: 400 });
  const resultado = {};
  MODULOS.forEach((m) => { if (activos.indexOf(m) === -1) resultado[m] = { modo: modos[m] || 'apps', corrio: false }; });
  if (!activos.length) return { status: 200, modulos: resultado };

  // la hoja como esta ahora: contra esto compara la sombra y desde esto arrancan los escritores
  const estado = o.estado || { libros: {}, carpetas: {}, respuestas: {} };
  estado.libros[LIBRO_MKT] = await cargarLibro(deps.sheetsLectura, LIBRO_MKT, [PESTANA]);
  const hoja = estado.libros[LIBRO_MKT].datos[PESTANA];
  if (!hoja) throw new Error('Marketing OS no tiene la pestaña ' + PESTANA + '.');
  const original = hoja.map((r) => r.slice());
  const env = deps.env || {};

  for (const m of activos) {
    const t0 = Date.now(), modo = modos[m];
    let r;
    try {
      if (m === 'pauta_ads_import') {
        r = await importarAds(original, modo, deps);
      } else {
        const E = ESCRITORES[m];
        // relojPruebas: solo las pruebas fijan la hora de un lunes en modo nube (la ruta no lo acepta)
        const x = await correrConPrecarga(E.funcion, estado, deps, { ahora: o.ahora || deps.relojPruebas, env });
        const esc = leerEscrituras(x, E.columnas);
        r = { semanas: esc.semanas, rondas: x.rondas, logs: x.logs.slice(-40), error: x.error || '' };
        if (esc.ajenas.length) r.error = (r.error ? r.error + ' · ' : '') + 'escribio fuera de sus columnas: ' + esc.ajenas.join(', ');
        if (modo === 'sombra') r.diferencias = comparar(esc.semanas, original);
        if (modo === 'nube' && !esc.ajenas.length) {
          r.escritas = { base: await guardarEnBase(deps.pool, esc.semanas, E.columnas, E.act), hoja: 0 };
          if (!deps.sheetsEscritura) throw new Error('Modo nube sin permiso de escritura en la hoja (sheetsEscritura).');
          const cp = await copiarAHoja(deps.sheetsEscritura, esc.semanas, esc.encabezado);
          r.escritas.hoja = cp.celdas; r.escritas.filas_nuevas = cp.filas_nuevas;
        }
        // los que siguen arrancan de la hoja con lo de este (como pasa con los activadores en fila)
        if (x.pauta) estado.libros[LIBRO_MKT].datos[PESTANA] = x.pauta;
        r.ok = !r.error && !(r.diferencias && r.diferencias.length);
      }
    } catch (e) {
      r = Object.assign(r || {}, { ok: false, error: String(e && e.message || e) });
    }
    r.modo = modo; r.corrio = true; r.ms = Date.now() - t0;
    resultado[m] = r;
    if (deps.pool && deps.guardarCorridas !== false) {
      await deps.pool.query('INSERT INTO pauta_corridas (modulo, modo, ahora, ok, semanas, diferencias, escritas, error, ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [m, modo, o.ahora ? new Date(o.ahora) : null, !!r.ok, JSON.stringify(sinFechas(r.semanas || {})), JSON.stringify(sinFechas(r.diferencias || [])),
          JSON.stringify(r.escritas || {}), String(r.error || (r.problemas || []).join(' · ')).slice(0, 2000), r.ms]).catch((e) => { r.aviso = 'No se anoto la corrida: ' + e.message; });
    }
  }
  const errores = activos.some((m) => resultado[m].error);
  const difieren = activos.some((m) => (resultado[m].diferencias || []).length || (resultado[m].problemas || []).length);
  return { status: errores ? 500 : difieren ? 409 : 200, modulos: resultado };
}

// ---------------------------------------------------------------------------------------------------------------
// La ruta
// ---------------------------------------------------------------------------------------------------------------

function claveIgual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/**
 * POST /tareas/procesos/pauta (cabecera x-rosanta-tarea = clave-tareas). Cuerpo opcional:
 *   { modulos: ['pauta_wix', ...] }  solo esos
 *   { ahora: '2026-10-13T12:00:00-06:00' }  reproduce ese momento (solo si todo lo que corre esta en sombra)
 * 200 todo bien · 409 la sombra difiere o la hoja trae algo raro · 500 fallo un escritor (el reloj avisa por correo).
 * deps: { pool, claveTareas, sheetsLectura, sheetsCuenta, sheetsEscritura, drive, env, fetch }
 */
function montarPauta(app, deps) {
  let corriendo = false;
  app.post('/tareas/procesos/pauta', async (req, res, next) => {
    if (!claveIgual(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    const b = req.body || {};
    if (b.modulos !== undefined && (!Array.isArray(b.modulos) || b.modulos.some((m) => MODULOS.indexOf(m) === -1))) return res.status(400).json({ error: 'modulos: ' + MODULOS.join(', ') + '.' });
    let ahora = null;
    if (b.ahora !== undefined) { ahora = Date.parse(b.ahora); if (!Number.isFinite(ahora)) return res.status(400).json({ error: 'ahora va como fecha ISO.' }); }
    if (corriendo) return res.status(409).json({ error: 'Ya hay una corrida de pauta en marcha.' });
    corriendo = true;
    const t0 = Date.now();
    try {
      const modos = await leerModos(deps.pool);
      const r = await correrPauta({ modos, ahora, soloModulos: b.modulos }, Object.assign({ conversiones: deps.conversiones || new Map() }, deps));
      res.status(r.status).json({ ok: r.status === 200, ms: Date.now() - t0, modulos: r.modulos });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    } finally { corriendo = false; }
  });
}

module.exports = {
  LIBRO_MKT, PESTANA, COLUMNAS, COLS_ADS, ESCRITORES, MODULOS, MODOS, WIX_SITE_ID,
  crearMotorPauta, correrConPrecarga, resolverFalta, crearDrive, sheetsDeCuenta, cargarLibro, relojFijo, archivosPauta,
  leerEscrituras, comparar, aBase, filasAds, guardarEnBase, copiarAHoja, letra, leerModos, correrPauta, montarPauta
};
