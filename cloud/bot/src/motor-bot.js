/**
 * Motor del bot en sombra (19-oct-2026): corre el CODIGO REAL del bot (apps-script/bot-rosanta,
 * copiado tal cual en cloud/bot/bot-rosanta/) dentro de Node, con todo lo de afuera imitado:
 *
 *   - Meta (WhatsApp, Instagram, Messenger): nada sale. Cada envio queda anotado en `envios`.
 *   - Wix: un Wix de mentira (`wix`) que contesta como el de verdad y anota cada llamada.
 *   - Claude: lo decide quien crea el motor (`claude`): el grabado (lo que contesto el bot real) o
 *     el modelo de verdad (con su propia clave, solo en el servidor de sombra).
 *   - Correo y Gmail: se anotan en `correos`, no se manda nada.
 *   - Hojas (Leads, Conversaciones, Fichas, Salientes): en memoria.
 *   - El reloj: lo mueve el reproductor (`reloj.poner(ms)`), asi "hoy", la hora del chat y los
 *     vencimientos del cache son los del mensaje original.
 *
 * Asi la logica del bot (cuando se calla, cuando reserva, cuando pasa a Juanma) es la misma por
 * construccion: no hay una segunda version del bot que se pueda separar de la primera.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'bot-rosanta');
const ZONA = 'America/Guatemala';
// PruebaEscaladas.js es una herramienta del editor: se copia (para que la copia sea exacta) pero no se carga.
const ARCHIVOS = ['Code.js', 'Botones.js', 'Humano.js', 'Reservas.js', 'Cancelar.js', 'Cambiar.js', 'Consultar.js', 'Correo.js', 'ResumenDiario.js', 'Manual.js', 'Nube.js'];
const WIX_URL = 'https://wix.simulado/_functions/reservarBot';
const SECRETO_WEBHOOK = 'sombra';

/** Utilities.formatDate con los formatos que usa el bot (yyyy MM dd HH mm ss y sus formas cortas, u). */
function formatDate(d, tz, fmt) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz || ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  const dia = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return String(fmt).replace(/yyyy|MM|dd|HH|mm|ss|u|M|d|H|m/g, (k) => ({
    yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second,
    u: String(dia), M: String(Number(p.month)), d: String(Number(p.day)), H: String(Number(p.hour)), m: String(Number(p.minute))
  })[k]);
}

/** Una hoja en memoria con lo que el bot usa de Sheet. */
function hoja(nombre, R, anotar) {
  const nota = anotar || (() => {});
  const ancho = () => R.reduce((a, r) => Math.max(a, r.length), 0);
  const fijar = (f, c, v) => { while (R.length < f) R.push([]); const r = R[f - 1]; while (r.length < c) r.push(''); r[c - 1] = v; };
  const rango = (f, c, nf, nc) => {
    const g = {
      getValues: () => { const o = []; for (let i = 0; i < (nf || 1); i++) { const row = R[f - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
      getValue: () => { const row = R[f - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; },
      getDisplayValue: () => { const row = R[f - 1] || []; return row[c - 1] === undefined ? '' : String(row[c - 1]); },
      setValues: (v) => { v.forEach((row, i) => row.forEach((x, j) => fijar(f + i, c + j, x))); nota({ op: 'fijar', hoja: nombre, fila: f, col: c, valores: v }); return g; },
      setValue: (x) => { fijar(f, c, x); nota({ op: 'fijar', hoja: nombre, fila: f, col: c, valores: [[x]] }); return g; },
      setNumberFormat: () => g, setFontWeight: () => g, setNote: () => g
    };
    return g;
  };
  const self = {
    getName: () => nombre,
    getLastRow: () => R.length,
    getLastColumn: () => ancho(),
    getDataRange: () => rango(1, 1, R.length, ancho()),
    getRange: (a, c, nf, nc) => {
      if (typeof a !== 'string') return rango(a, c, nf, nc);
      // 'A:A' con createTextFinder(...).matchEntireCell(true).findNext(): la fila de la ficha
      const col = a.charCodeAt(0) - 64;
      return { createTextFinder: (t) => { const b = { matchEntireCell: () => b, findNext: () => {
        const i = R.findIndex((r) => String(r[col - 1] === undefined ? '' : r[col - 1]) === String(t));
        return i < 0 ? null : { getRow: () => i + 1 };
      } }; return b; } };
    },
    appendRow: (row) => { R.push(row.slice()); nota({ op: 'agregar', hoja: nombre, fila: R.length, valores: [row.slice()] }); return self; },
    deleteRows: (desde, n) => { R.splice(desde - 1, n); nota({ op: 'borrar', hoja: nombre, fila: desde, n }); return self; },
    setFrozenRows: () => self
  };
  return self;
}

/** Fetch sincrono (UrlFetchApp lo es): un proceso hijo de node hace el pedido. La clave va por el entorno, nunca en la linea de comandos. */
function fetchSincrono(url, opciones, entornoExtra) {
  const guion = 'let d="";process.stdin.on("data",c=>d+=c).on("end",async()=>{const o=JSON.parse(d);' +
    'if(o.h["x-api-key"]==="$CLAVE")o.h["x-api-key"]=process.env.CLAVE_HIJO;' +
    'try{const r=await fetch(o.u,{method:o.m,headers:o.h,body:o.b});process.stdout.write(JSON.stringify({c:r.status,t:await r.text()}));}' +
    'catch(e){process.stdout.write(JSON.stringify({c:599,t:String(e)}));}});';
  const sal = execFileSync(process.execPath, ['-e', guion], {
    input: JSON.stringify({ u: url, m: opciones.method || 'post', h: opciones.headers || {}, b: opciones.payload }),
    env: Object.assign({ PATH: process.env.PATH }, entornoExtra || {}), maxBuffer: 20 * 1024 * 1024, timeout: 120000
  });
  return JSON.parse(String(sal));
}

function respuesta(code, cuerpo) {
  const t = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return { getResponseCode: () => code, getContentText: () => t, getBlob: () => ({ getContentType: () => 'application/json' }) };
}

/**
 * crearMotor({ claude, wix, kb, props, nombresIg }) — claude(cuerpoPedido) → { code, body } (el cuerpo de la API);
 * wix(ruta, payload) → { code, body }. Devuelve { ctx, reloj, envios, correos, wixLlamadas, hojas, logs, ... }.
 *
 * Modo en vivo (19-oct-2026, APAGADO hasta el sí de Juanma) — opciones extra:
 *   relojReal: true            la hora de verdad
 *   estado: { props, cache }   Maps que viven fuera del motor (se cargan de la base y se guardan despues)
 *   libros: { leads: {...} }   el espejo de Rosanta Leads (en vez de hojas vacias)
 *   red(url, opciones)         hace el pedido de verdad (Meta, Wix, Claude); los envios se anotan igual
 *   correo(m)                  manda el correo de verdad (MailApp); se anota igual
 *   alCambiarHoja(op)          cada fila agregada/cambiada/borrada, para copiarla a la hoja real
 *   gmail                      GmailApp de verdad (canal de correo en la nube, 20-oct-2026)
 */
function crearMotor(op) {
  const o = op || {};
  let fijo = Date.UTC(2026, 9, 19, 15, 0, 0);
  const actual = () => (o.relojReal ? Date.now() : fijo);
  const reloj = { poner: (ms) => { fijo = ms; }, ahora: () => actual(), avanzar: (ms) => { fijo += ms; } };
  const RealDate = Date;
  class FDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(actual()); else super(...a); }
    static now() { return actual(); }
  }
  FDate.UTC = RealDate.UTC; FDate.parse = RealDate.parse;

  const envios = [];       // { cuando, canal, a, tipo, texto, botones }
  const intentosEnvio = { n: 0 };   // en vivo: envios que se intentaron (aceptados o no)
  const correos = [];      // { cuando, a, asunto, cuerpo }
  const wixLlamadas = [];  // { cuando, ruta, payload }
  const claudePedidos = []; // { cuando, cuerpo }
  const logs = [];
  // Las pestañas con su encabezado, como en Rosanta Leads (Fichas la crea el bot con FICHA_COLS al usarla).
  const libros = o.libros || { leads: {
    Leads: [['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo', 'Urgencia', 'Resumen', 'Acción', '¿Humano?', 'Mensaje original', 'ID destino (no tocar)', 'Respuesta', 'Enviado', 'Email', 'Respuesta_Bot']],
    Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto']],
    Salientes: [['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']] } };
  const props = (o.estado && o.estado.props) || new Map(Object.entries(Object.assign({
    SHEET_ID: 'leads', KB_DOC_ID: 'kb', WIX_RESERVAS_URL: WIX_URL, WIX_RESERVAS_SECRETO: 'sombra',
    WA_PHONE_NUMBER_ID: 'wa-sombra', OWNER_WA: '50200000000', BOTONES_MODO: 'todos', WEBHOOK_SECRET: SECRETO_WEBHOOK,
    ANTHROPIC_API_KEY: '$CLAVE', WHATSAPP_TOKEN: 'sombra', IG_TOKEN: 'sombra', MESSENGER_TOKEN: 'sombra', VERIFY_TOKEN: 'sombra'
  }, o.props || {})));
  const cache = (o.estado && o.estado.cache) || new Map();

  const leerCache = (k) => { const e = cache.get(k); if (!e) return null; if (e.vence <= actual()) { cache.delete(k); return null; } return e.v; };
  const libro = (id) => {
    const src = libros[id];
    if (!src) throw new Error('La sombra no tiene la hoja ' + id);
    return {
      getId: () => id,
      getSheetByName: (n) => (src[n] ? hoja(n, src[n], o.alCambiarHoja) : null),
      insertSheet: (n) => { src[n] = []; if (o.alCambiarHoja) o.alCambiarHoja({ op: 'crear', hoja: n }); return hoja(n, src[n], o.alCambiarHoja); }
    };
  };

  const fetch = (url, opciones) => {
    const u = String(url);
    const opt = opciones || {};
    // @64: el bot pregunta quién atiende el correo. Dentro de la nube el código ES quien atiende: siempre sigue.
    if (/\/correo\/quien$/.test(u)) return respuesta(200, { modo: 'apps' });
    // @68: los relojes del bot preguntan si atiende la nube. Dentro de la nube el código ES la nube: siempre sigue.
    if (/\/bot\/quien$/.test(u)) return respuesta(200, { modo: 'puente' });
    if (u.indexOf('https://api.anthropic.com/') === 0) {
      const cuerpo = JSON.parse(opt.payload);
      claudePedidos.push({ cuando: actual(), cuerpo });
      if (o.red) return o.red(u, opt);
      const headers = Object.assign({ 'content-type': 'application/json' }, opt.headers || {});
      const r = o.claude ? o.claude(cuerpo, { headers, fetchSincrono }) : { code: 500, body: { error: 'sin modelo' } };
      return respuesta(r.code, r.body);
    }
    if (o.red && o.esWix && o.esWix(u)) {   // en vivo: el Wix de verdad
      const payload = JSON.parse(opt.payload || '{}');
      delete payload.secreto;
      wixLlamadas.push({ cuando: actual(), ruta: u.replace(/^.*\//, ''), payload });
      return o.red(u, opt);
    }
    if (u.indexOf('https://wix.simulado/') === 0) {
      const ruta = u.replace(/^.*\//, '');
      const payload = JSON.parse(opt.payload || '{}');
      delete payload.secreto;
      wixLlamadas.push({ cuando: actual(), ruta, payload });
      const r = o.wix ? o.wix(ruta, payload) : { code: 200, body: { ok: true } };
      return respuesta(r.code, r.body);
    }
    if (/^https:\/\/graph\.(facebook|instagram)\.com\//.test(u)) {
      if ((opt.method || 'get').toLowerCase() === 'get') {   // nombre de Instagram
        if (o.red) return o.red(u, opt);
        const id = (u.match(/\.com\/([^?\/]+)\?/) || [])[1];
        return respuesta(200, { name: (o.nombresIg && o.nombresIg[id]) || '' });
      }
      const p = typeof opt.payload === 'string' ? JSON.parse(opt.payload) : (opt.payload || {});
      const canal = /graph\.instagram\.com/.test(u) ? 'instagram' : (p.messaging_product === 'whatsapp' ? 'whatsapp' : 'messenger');
      const a = p.to || (p.recipient && p.recipient.id) || '';
      let texto = '', botones = null;
      if (p.text) texto = p.text.body;
      else if (p.interactive) {
        texto = (p.interactive.body && p.interactive.body.text) || '';
        const act = p.interactive.action || {};
        botones = act.buttons ? act.buttons.map((b) => b.reply.title)
          : (act.sections || []).reduce((acc, s) => acc.concat((s.rows || []).map((r) => r.title)), []);
      } else if (p.message) {
        texto = p.message.text || '';
        if (p.message.quick_replies) botones = p.message.quick_replies.map((q) => q.title);
      }
      if (o.red && /\/media$/.test(u)) return o.red(u, opt);   // subir la foto a WhatsApp: todavia no es un envio
      if (o.red) {   // en vivo: solo cuenta como enviado si Meta lo acepto (la red de seguridad mira esto)
        intentosEnvio.n++;
        const r = o.red(u, opt);
        if (r.getResponseCode() < 300) envios.push({ cuando: actual(), canal, a: String(a), texto, botones });
        return r;
      }
      envios.push({ cuando: actual(), canal, a: String(a), texto, botones });
      return respuesta(200, { messages: [{ id: 'sombra-' + envios.length }], message_id: 'sombra-' + envios.length });
    }
    if (o.red && o.permitido && o.permitido(u)) return o.red(u, opt);   // en vivo: la foto de Drive de la consola
    logs.push('fetch no previsto: ' + u);
    return respuesta(404, { error: 'La sombra no llama a ' + u.slice(0, 60) });
  };

  const ctx = {
    Date: FDate,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => { props.set(k, String(v)); },
      deleteProperty: (k) => { props.delete(k); },
      getProperties: () => Object.fromEntries(props)
    }) },
    CacheService: { getScriptCache: () => ({
      get: leerCache,
      put: (k, v, seg) => { cache.set(k, { v: String(v), vence: actual() + 1000 * (seg || 600) }); },
      remove: (k) => { cache.delete(k); }
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate, sleep: () => {}, getUuid: () => require('crypto').randomUUID() },
    SpreadsheetApp: { openById: libro, getActiveSpreadsheet: () => libro('leads'), flush: () => {} },
    DocumentApp: { openById: () => ({ getBody: () => ({ getText: () => o.kb || '' }) }) },
    UrlFetchApp: { fetch },
    MailApp: { sendEmail: (a, asunto, cuerpo) => {
      const m = typeof a === 'object' ? a : { to: a, subject: asunto, body: cuerpo };
      correos.push({ cuando: actual(), a: m.to, asunto: m.subject, cuerpo: m.body || m.htmlBody || '' });
      if (o.correo) o.correo(m);
    } },
    GmailApp: o.gmail || {   // en el canal de correo de la nube: la API de Gmail (gmail-sincrono.js)
      search: () => [],
      createDraft: (a, asunto, cuerpo) => { correos.push({ cuando: actual(), a, asunto: '[borrador] ' + asunto, cuerpo }); if (o.correo) o.correo({ borrador: true, to: a, subject: asunto, body: cuerpo }); },
      sendEmail: (a, asunto, cuerpo) => { correos.push({ cuando: actual(), a, asunto, cuerpo }); }
    },
    ContentService: { createTextOutput: (s) => ({ getContent: () => s }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => { throw new Error('La sombra no crea activadores.'); } },
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    console: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) },
    JSON, Math, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Intl, encodeURIComponent, decodeURIComponent
  };
  vm.createContext(ctx);
  // Un archivo que todavía no está en la versión copiada (p. ej. Nube.js antes de la @68) simplemente no se carga.
  ARCHIVOS.filter((f) => fs.existsSync(path.join(DIR, f))).forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: 'bot-rosanta/' + f }));
  // Code.js declara PROPS y CONFIG con const: quedan en el ambito del script, no en ctx. Se leen asi:
  const CONFIG = vm.runInContext('CONFIG', ctx);

  /** Un mensaje como lo manda Meta, por la puerta de siempre (doPost). */
  function recibir(body) {
    return ctx.doPost({ parameter: { token: SECRETO_WEBHOOK }, postData: { contents: JSON.stringify(body) } });
  }

  return { ctx, reloj, envios, intentosEnvio, correos, wixLlamadas, claudePedidos, logs, libros, props, cache, CONFIG, recibir, leerCache };
}

module.exports = { crearMotor, formatDate, fetchSincrono, ARCHIVOS, DIR, WIX_URL };
