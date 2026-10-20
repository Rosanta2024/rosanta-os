/**
 * Reseñas de Google y encuesta en la base (21-oct-2026, sesion "Nube: reseñas y encuesta"; migracion 040).
 * Vive en rosanta-nube (el servicio que queda). Primera parte: SOLO COPIA Y LECTURA.
 *
 *   POST /tareas/resenas/copiar-hojas   copia "Control de Reseñas GBP › Reseñas" y "Encuesta 2026" a
 *                                       resenas_gbp y encuesta_respuestas. Se puede repetir: no duplica.
 *   POST /tareas/resenas/leer-google    lee TODAS las reseñas de Google Business Profile (solo GET), las guarda
 *                                       en resenas_gbp_google y las compara con la copia de la hoja.
 *                                       409 si hay algo que mirar (el reloj lo marca y avisa, como comparar-pagos).
 *
 * Un solo escritor: hasta el dia unico (5-nov) escribe Apps Script (las hojas). Aca nada publica en Google ni
 * escribe en las hojas: el cliente de Google de este archivo solo hace GET (gbpGet lo hace cumplir).
 *
 * Google Business Profile: la API esta aprobada en el proyecto rosanta-gbp-bot (comprobado el 20-oct: cuota de
 * 300/min y ListReviews/UpdateReviewReply con 200 desde el panel de Apps Script). El permiso de Juanma
 * (business.manage) queda en el secreto gbp-oauth, como JSON {client_id, client_secret, refresh_token, ...}
 * (cloud/herramientas/autorizar-google.js, jueves 22-oct). En Cloud Run:
 *   --set-secrets GBP_OAUTH=gbp-oauth:latest   y, si se conocen, GBP_CUENTA=<n> GBP_UBICACION=<n>
 *   (sin esas dos, se buscan solas la primera vez: la cuenta y la ficha de Rosanta).
 *
 * Montaje en app.js (antes del manejador de errores), igual que entrada.js y hooks-wix.js:
 *   if (deps.resenas) require('./resenas-nube').montarResenas(app, Object.assign({ pool: deps.pool, claveTareas: deps.claveTareas }, deps.resenas));
 * y en server.js:
 *   resenas: { sheets: clienteSheets, gbp: gbpDelEntorno(process.env) },
 */
const crypto = require('crypto');
const { leerLibro } = require('./copia-hojas');

const GBP_ID = '17VHTRhelYtEKXjkf4dckPRrAwjif8owu22OLMxBl9bo';        // Rosanta - Control de Reseñas GBP
const ENCUESTA_ID = '1zZuqsBgjC3hYRJfdXe6zz8SxYCNbMBtBDvc3qy1nPf0';   // Rosanta_Encuesta_Satisfaccion
const PESTANA_RESENAS = 'Reseñas';
const PESTANA_ENCUESTA = 'Encuesta 2026';

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const MB_V4 = 'https://mybusiness.googleapis.com/v4';
const CUENTAS = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const FICHAS = 'https://mybusinessbusinessinformation.googleapis.com/v1/';
const UNA_HORA = 3600 * 1000;

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
const fecha = (v) => (v instanceof Date && !isNaN(v) ? v : (v ? (isNaN(new Date(v)) ? null : new Date(v)) : null));
const txt = (v) => (v === null || v === undefined ? '' : String(v));
const plano = (s) => txt(s).replace(/\s+/g, ' ').trim();

// ---- Las hojas → filas de la base -----------------------------------------------------------------------

/** "Reseñas" (getValues) → una fila por review_id; si se repite gana la mas nueva (como mapaBorradores_). */
function filasResenas(matriz) {
  if (!matriz || matriz.length < 2) return [];
  const h = matriz[0].map((x) => txt(x).trim());
  const c = (n) => h.indexOf(n);
  if (c('ReviewId') < 0) throw new Error('La pestaña Reseñas no tiene la columna ReviewId: no se copia nada.');
  const porId = new Map();
  matriz.slice(1).forEach((f, i) => {
    const id = txt(f[c('ReviewId')]).trim();
    if (!id) return;
    porId.set(id, {
      review_id: id, fecha_detectada: fecha(f[c('Fecha detectada')]), estrellas: Number(f[c('Estrellas')]) || 0,
      cliente: txt(f[c('Cliente')]), resena: txt(f[c('Reseña original')]), respuesta: txt(f[c('Respuesta (editable)')]),
      estado: txt(f[c('Estado')]).trim(), aprobar: txt(f[c('Aprobar (SI/NO)')]).trim(), fecha_publicada: fecha(f[c('Fecha publicada')]),
      fila_hoja: i + 2
    });
  });
  return Array.from(porId.values());
}

/** "Encuesta 2026" (A Fecha | B Calificacion | C Que mejorar) → filas con huella estable para no duplicar. */
function filasEncuesta(matriz) {
  if (!matriz || matriz.length < 2) return [];
  const vistas = new Map(), out = [];
  matriz.slice(1).forEach((f, i) => {
    const d = fecha(f[0]), cal = Number(f[1]) || 0, mejorar = txt(f[2]);
    if (!d || !cal) return;   // filas vacias o rotas: se saltan (la comparacion las cuenta)
    const base = d.toISOString() + '|' + cal + '|' + mejorar;
    const n = (vistas.get(base) || 0) + 1;   // dos respuestas identicas en el mismo segundo: las dos cuentan
    vistas.set(base, n);
    out.push({ fecha: d, calificacion: cal, mejorar, huella: crypto.createHash('sha256').update(base + '#' + n).digest('hex').slice(0, 32), fila_hoja: i + 2 });
  });
  return out;
}

async function enTransaccion(pool, fn) {
  if (!pool.connect) return fn(pool);
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

/** Copia las dos hojas. Las filas que ya escribio la nube (escrito_por = 'nube') no se pisan. */
async function copiarHojas(deps) {
  const sh = deps.sheets();
  const [gbp, enc] = await Promise.all([leerLibro(sh, GBP_ID, [PESTANA_RESENAS]), leerLibro(sh, ENCUESTA_ID, [PESTANA_ENCUESTA])]);
  const res = filasResenas(gbp[PESTANA_RESENAS]);
  const encuesta = filasEncuesta(enc[PESTANA_ENCUESTA]);
  const filasEnc = Math.max(0, (enc[PESTANA_ENCUESTA] || []).length - 1);
  return enTransaccion(deps.pool, async (q) => {
    for (const r of res) {
      await q.query(`INSERT INTO resenas_gbp (review_id, fecha_detectada, estrellas, cliente, resena, respuesta, estado, aprobar, fecha_publicada, fila_hoja, escrito_por, actualizado)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'hoja', now())
        ON CONFLICT (review_id) DO UPDATE SET fecha_detectada = EXCLUDED.fecha_detectada, estrellas = EXCLUDED.estrellas, cliente = EXCLUDED.cliente,
          resena = EXCLUDED.resena, respuesta = EXCLUDED.respuesta, estado = EXCLUDED.estado, aprobar = EXCLUDED.aprobar,
          fecha_publicada = EXCLUDED.fecha_publicada, fila_hoja = EXCLUDED.fila_hoja, actualizado = now()
        WHERE resenas_gbp.escrito_por = 'hoja'`,
      [r.review_id, r.fecha_detectada, r.estrellas, r.cliente, r.resena, r.respuesta, r.estado, r.aprobar, r.fecha_publicada, r.fila_hoja]);
    }
    let nuevas = 0;
    for (const e of encuesta) {
      const x = await q.query(`INSERT INTO encuesta_respuestas (fecha, calificacion, mejorar, huella, origen, fila_hoja) VALUES ($1,$2,$3,$4,'hoja',$5)
        ON CONFLICT (huella) DO NOTHING`, [e.fecha, e.calificacion, e.mejorar, e.huella, e.fila_hoja]);
      nuevas += x.rowCount || 0;
    }
    const resumen = { resenas: res.length, encuesta: encuesta.length, encuesta_nuevas: nuevas, encuesta_filas_saltadas: filasEnc - encuesta.length };
    await q.query('INSERT INTO resenas_corridas (tarea, ok, resumen) VALUES ($1,$2,$3)', ['copiar-hojas', true, JSON.stringify(resumen)]);
    return resumen;
  });
}

// ---- Google Business Profile, SOLO LECTURA ----------------------------------------------------------------

/** El secreto gbp-oauth del entorno. Sin el, el lector contesta 503 (falta el permiso de Juanma). */
function gbpDelEntorno(env) {
  let oauth = null;
  try { oauth = env.GBP_OAUTH ? JSON.parse(env.GBP_OAUTH) : null; } catch (e) { oauth = null; }
  return { oauth, cuenta: env.GBP_CUENTA || '', ubicacion: env.GBP_UBICACION || '' };
}

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

/**
 * Cliente de solo lectura. NO hay forma de publicar con esto: gbpGet rechaza cualquier metodo que no sea GET.
 * Publicar va en otro paso, con su interruptor y el sí de Juanma.
 */
function crearLectorGbp(cfg, opciones) {
  const o = opciones || {};
  const fetchFn = o.fetch || fetch;
  const ahora = o.ahora || Date.now;
  const espera = o.espera || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let token = null, vence = 0, cuenta = cfg.cuenta, ubicacion = cfg.ubicacion;

  async function acceso() {
    if (token && ahora() < vence - 60000) return token;
    const a = cfg.oauth;
    if (!a || !a.refresh_token || !a.client_id || !a.client_secret) throw error(503, 'Falta el permiso de Google Business (secreto gbp-oauth).');
    const r = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: a.client_id, client_secret: a.client_secret, refresh_token: a.refresh_token, grant_type: 'refresh_token' }).toString() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw error(502, 'Google no renovo el permiso de Business Profile (' + r.status + ' ' + (j.error || '') + '). Puede que haya que autorizar de nuevo.');
    token = j.access_token; vence = ahora() + (Number(j.expires_in) || 3600) * 1000;
    return token;
  }

  /** GET con reintentos ante 429/500/503 (igual que fetchConReintentos_ del panel). */
  async function gbpGet(url, metodo) {
    if (metodo && metodo !== 'GET') throw new Error('El lector de reseñas solo lee: ' + metodo + ' no esta permitido.');
    let ultimo = null;
    for (let i = 0; i < 4; i++) {
      const r = await fetchFn(url, { method: 'GET', headers: { Authorization: 'Bearer ' + await acceso() } });
      if (r.ok) return r.json();
      ultimo = r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200);
      if ([429, 500, 503].indexOf(r.status) === -1) break;
      if (i < 3) await espera(800 * Math.pow(2, i));
    }
    throw error(502, 'Google Business respondio ' + ultimo);
  }

  /** La cuenta y la ficha: del entorno o, si faltan, buscadas una vez (la ficha cuyo nombre dice Rosanta). */
  async function ficha() {
    if (cuenta && ubicacion) return { cuenta, ubicacion };
    const cs = (await gbpGet(CUENTAS)).accounts || [];
    for (const c of cs) {
      const ls = (await gbpGet(FICHAS + c.name + '/locations?readMask=name,title&pageSize=100')).locations || [];
      const l = ls.find((x) => /rosanta/i.test(x.title || '')) || (ls.length === 1 ? ls[0] : null);
      if (l) { cuenta = c.name.split('/').pop(); ubicacion = l.name.split('/').pop(); return { cuenta, ubicacion }; }
    }
    throw error(404, 'No encontre la ficha de Rosanta en las cuentas de Google Business que ve el permiso.');
  }

  /** Todas las reseñas, con promedio y total de Google. */
  async function resenas() {
    const f = await ficha();
    const base = MB_V4 + '/accounts/' + f.cuenta + '/locations/' + f.ubicacion + '/reviews?pageSize=50&orderBy=updateTime%20desc';
    const out = []; let pagina = '', vueltas = 0, promedio = 0, total = 0;
    do {
      const d = await gbpGet(base + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''));
      if (d.averageRating) promedio = Number(d.averageRating);
      if (d.totalReviewCount) total = Number(d.totalReviewCount);
      (d.reviews || []).forEach((r) => out.push({
        review_id: r.reviewId || txt(r.name).split('/').pop(), estrellas: STAR_MAP[r.starRating] || 0,
        cliente: (r.reviewer && r.reviewer.displayName) || '', resena: r.comment || '', creada: fecha(r.createTime), actualizada: fecha(r.updateTime),
        respuesta: (r.reviewReply && r.reviewReply.comment) || '', respuesta_fecha: fecha(r.reviewReply && r.reviewReply.updateTime)
      }));
      pagina = d.nextPageToken || ''; vueltas++;
    } while (pagina && vueltas < 40);
    return { reviews: out, promedio, total, ficha: f };
  }

  return { resenas, gbpGet };
}

/**
 * Lo que Google dice contra lo que dice la hoja. Lo que se alerta:
 *  - faltan_en_hoja: reseñas en Google con mas de 2 h que el bot de Apps Script no anoto (corre cada hora);
 *  - publicada_sin_respuesta: la hoja dice PUBLICADA_* y en Google no hay respuesta;
 *  - respuesta_distinta: las dos tienen respuesta pero el texto no coincide (p. ej. editada a mano en Google).
 * Lo que solo se informa: cuantas siguen sin responder en Google.
 */
function comparar(google, hoja, ahora) {
  const porId = new Map(hoja.map((h) => [h.review_id, h]));
  const d = { faltan_en_hoja: [], publicada_sin_respuesta: [], respuesta_distinta: [] };
  let sinResponder = 0;
  google.forEach((g) => {
    if (!g.respuesta) sinResponder++;
    const h = porId.get(g.review_id);
    if (!h) {
      const t = g.creada || g.actualizada;
      if (!t || ahora - t.getTime() > 2 * UNA_HORA) d.faltan_en_hoja.push(g.review_id);
      return;
    }
    const publicada = /^PUBLICADA/.test(h.estado || '');
    if (publicada && !g.respuesta) d.publicada_sin_respuesta.push(g.review_id);
    else if (publicada && plano(h.respuesta) !== plano(g.respuesta)) d.respuesta_distinta.push(g.review_id);
  });
  const alertas = d.faltan_en_hoja.length + d.publicada_sin_respuesta.length + d.respuesta_distinta.length;
  return { en_google: google.length, en_hoja: hoja.length, sin_responder: sinResponder, alertas, diferencias: d };
}

async function leerGoogle(deps) {
  const lector = deps.lectorGbp || crearLectorGbp(deps.gbp || gbpDelEntorno(process.env), { fetch: deps.fetch, ahora: deps.ahora });
  const g = await lector.resenas();
  const hoja = (await deps.pool.query('SELECT review_id, estado, respuesta FROM resenas_gbp')).rows;
  const c = comparar(g.reviews, hoja, (deps.ahora || Date.now)());
  const resumen = Object.assign({ promedio: g.promedio, total_google: g.total }, c);
  await enTransaccion(deps.pool, async (q) => {
    for (const r of g.reviews) {
      await q.query(`INSERT INTO resenas_gbp_google (review_id, estrellas, cliente, resena, creada, actualizada, respuesta, respuesta_fecha, visto)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
        ON CONFLICT (review_id) DO UPDATE SET estrellas = EXCLUDED.estrellas, cliente = EXCLUDED.cliente, resena = EXCLUDED.resena, creada = EXCLUDED.creada,
          actualizada = EXCLUDED.actualizada, respuesta = EXCLUDED.respuesta, respuesta_fecha = EXCLUDED.respuesta_fecha, visto = now()`,
      [r.review_id, r.estrellas, r.cliente, r.resena, r.creada, r.actualizada, r.respuesta, r.respuesta_fecha]);
    }
    await q.query('INSERT INTO resenas_corridas (tarea, ok, resumen) VALUES ($1,$2,$3)', ['leer-google', c.alertas === 0, JSON.stringify(resumen)]);
  });
  return resumen;
}

// ---- Rutas ------------------------------------------------------------------------------------------------

function montarResenas(app, deps) {
  const exigirTarea = (req, res, next) => (iguales(req.get('x-rosanta-tarea'), deps.claveTareas) ? next() : res.status(403).json({ error: 'Clave de tarea invalida.' }));
  const responder = (fn, conAlerta) => async (req, res) => {
    try {
      const r = await fn(deps);
      res.status(conAlerta && r.alertas ? 409 : 200).json(Object.assign({ ok: !(conAlerta && r.alertas) }, r));
    } catch (e) {
      res.status(e.status || 500).json({ ok: false, error: String(e.message || e) });
    }
  };
  app.post('/tareas/resenas/copiar-hojas', exigirTarea, responder(copiarHojas, false));
  app.post('/tareas/resenas/leer-google', exigirTarea, responder(leerGoogle, true));
}

module.exports = { montarResenas, filasResenas, filasEncuesta, copiarHojas, crearLectorGbp, comparar, leerGoogle, gbpDelEntorno, GBP_ID, ENCUESTA_ID };
