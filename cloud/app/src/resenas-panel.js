/**
 * El panel de reseñas EN VIVO, en rosanta-nube (22-oct-2026; decision de la Central, el Estudio y Fase 2).
 *
 *   GET  /clientes/resenas?u=<enlace>[&dentro=1]   la MISMA pantalla del panel de Apps Script (copia exacta en
 *                                                 proyectos/panel-de-reseas-de-google), con la paleta de siempre.
 *   POST /api/resenas/<funcion>                    lo que la pantalla llama con google.script.run.
 *
 * Quien entra lo decide la matriz de la base (tabla permisos, parte 'resenas': hoy solo el dueño).
 * Leer: todas las reseñas de Google (resenas_gbp_google) con el borrador y el estado de resenas_gbp.
 * Escribir (publicar, editar lo publicado, guardar, regenerar, no responder): resenas-vivo.js. Con el
 * interruptor 'resenas' en puente responde 409 y la pantalla avisa que todavia publica el panel de siempre.
 *
 * La pestaña Reseñas de la intranet abre esta pagina solo cuando el interruptor esta en 'base'
 * (NubeResenas.js de la intranet); con 'puente' sigue abriendo el panel de Apps Script.
 */
const P = require('./pantalla-pagos');
const U = require('./usuarios');
const permisos = require('./permisos');
const fs = require('fs');
const path = require('path');

const HTML_PANEL = path.join(__dirname, '..', 'proyectos', 'panel-de-reseas-de-google', 'Panel de Reseñas de Google.html');
const LECTURA = ['getDatosDashboard'];
const ESCRITURA = ['publicarDesdePanel', 'editarRespuestaPublicada', 'guardarBorrador', 'regenerarBorrador', 'descartarBorrador'];
const PARTE = 'resenas';

/** google.script.run sin AUTH en los argumentos → POST /api/resenas/<funcion>, con el ?u= en la cabecera. */
function traductor() {
  const t = P.TRADUCTOR
    .replace('var args = [].slice.call(arguments, 1);   // el primero es AUTH: va en la cabecera', 'var args = [].slice.call(arguments, 0);   // sin AUTH en los argumentos')
    .replace("fetch('/api/llamar/' + encodeURIComponent(nombre)", "fetch('/api/resenas/' + encodeURIComponent(nombre)");
  if (t.indexOf('/api/resenas/') < 0 || t.indexOf('slice.call(arguments, 0)') < 0) throw new Error('pantalla-pagos.js cambio el traductor: revisar resenas-panel.js.');
  return t + '\nwindow.AUTH = new URLSearchParams(location.search).get("u") || "";';
}

/** La pantalla: el HTML real del panel + paleta + traductor + un aviso que dice quien publica hoy. */
function armarPanel(html) {
  const h = html || fs.readFileSync(HTML_PANEL, 'utf8');
  if (h.split('<body>').length !== 2 || h.split('</head>').length !== 2) throw new Error('Panel de Reseñas de Google.html cambio de forma.');
  const aviso = '<div id="nb-modo" style="display:none;background:var(--rosanta-lila-tint,#ecebf8);border-radius:12px;padding:10px 14px;margin:10px 16px;' +
    'font:14px var(--rosanta-font-body,Lato,sans-serif)"></div><script>fetch("/resenas/modo").then(function(r){return r.json()}).then(function(j){' +
    'if(j.modo!=="base"){var d=document.getElementById("nb-modo");d.innerHTML="<b>Todavía publica el panel de siempre.</b> Esta pantalla del servidor nuevo por ahora solo muestra; ' +
    'para publicar usá la pestaña Reseñas de la intranet.";d.style.display="block"}}).catch(function(){})</script>';
  return h.replace('</head>', () => P.paleta() + '<script>' + traductor() + '</script></head>').replace('<body>', () => '<body>' + aviso);
}

/** getDatosDashboard desde la base, con la forma que espera la pantalla. Sin lectura de Google todavia: vacio. */
async function datosDesdeBase(pool) {
  const g = await pool.query(`SELECT g.review_id, g.estrellas, g.cliente, g.resena, coalesce(g.creada, g.actualizada) AS t, g.respuesta,
    b.respuesta AS borrador, b.estado FROM resenas_gbp_google g LEFT JOIN resenas_gbp b ON b.review_id = g.review_id
    ORDER BY coalesce(g.creada, g.actualizada) DESC NULLS LAST`);
  const c = await pool.query("SELECT resumen FROM resenas_corridas WHERE tarea = 'leer-google' ORDER BY id DESC LIMIT 1");
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const reviews = g.rows.map((x) => {
    if (dist[x.estrellas] !== undefined) dist[x.estrellas]++;
    const resp = x.respuesta || '';
    // Si la nube ya publico pero el lector todavia no paso, manda lo de la base.
    const publicadaBase = /^PUBLICADA/.test(x.estado || '') && !resp ? (x.borrador || '') : '';
    const reply = resp || publicadaBase;
    return { id: x.review_id, stars: Number(x.estrellas) || 0, name: x.cliente || 'Anónimo', comment: x.resena || '',
      time: x.t instanceof Date ? x.t.toISOString() : String(x.t || ''), hasReply: !!reply, reply,
      borrador: reply ? '' : (x.borrador || ''), estado: x.estado || '' };
  });
  const r = (c.rows[0] && c.rows[0].resumen) || {};
  const suma = reviews.reduce((a, x) => a + x.stars, 0);
  return { average: Number(r.promedio) || (reviews.length ? Math.round(suma / reviews.length * 100) / 100 : 0),
    total: Number(r.total_google) || reviews.length, fetched: reviews.length, dist, reviews, fuente: 'base' };
}

/** deps: { pool, vivo (resenas-vivo, opcional), matriz (para pruebas: { permisos, soloDueno }) } */
function montarPanel(app, deps) {
  let M = deps.matriz || null, leida = 0;
  async function matriz() {
    if (deps.matriz) return deps.matriz;
    if (!M || Date.now() - leida > 60000) { M = await permisos.cargarDeBase(deps.pool); leida = Date.now(); }
    return M;
  }
  const quien = (req) => { const t = req.get('x-rosanta-u') || req.query.u; return t ? U.usuarioPorToken(deps.pool, t) : Promise.resolve(null); };
  const NO = (msg) => '<p style="font-family:sans-serif;padding:16px">' + msg + '</p>';
  let html = null;

  app.get('/clientes/resenas', async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send(NO('No pude identificarte. Entrá con tu enlace de siempre.'));
      const p = permisos.puede(await matriz(), u, PARTE, 'ver');
      if (!p.ok) return res.status(403).type('html').send(NO('Tu cuenta no tiene las reseñas.'));
      if (!html) html = armarPanel();
      res.set('Cache-Control', 'no-store').type('html').send(html);
    } catch (e) { next(e); }
  });

  app.post('/api/resenas/:nombre', async (req, res) => {
    const nombre = req.params.nombre, a = Array.isArray(req.body) ? req.body : [];
    try {
      const u = await quien(req);
      if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
      const M2 = await matriz();
      if (LECTURA.includes(nombre)) {
        if (!permisos.puede(M2, u, PARTE, 'ver').ok) return res.status(403).json({ error: 'Tu cuenta no tiene las reseñas.' });
        return res.json({ resultado: await datosDesdeBase(deps.pool) });
      }
      if (!ESCRITURA.includes(nombre)) return res.status(404).json({ error: 'Esa función no está disponible en el servidor nuevo.' });
      const p = permisos.puede(M2, u, PARTE, 'ingresar');
      if (!p.ok) return res.status(403).json({ error: p.motivo });
      if (!deps.vivo) return res.status(409).json({ error: 'Todavía publica el panel de siempre: usá la pestaña Reseñas de la intranet.' });
      const r = await deps.vivo[nombre](String(a[0] || ''), a[1]);
      res.json({ resultado: r === undefined ? null : r });
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  });
}

module.exports = { montarPanel, armarPanel, datosDesdeBase, traductor, LECTURA, ESCRITURA };
