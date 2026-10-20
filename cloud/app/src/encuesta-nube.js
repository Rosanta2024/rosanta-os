/**
 * La encuesta de satisfaccion en la nube (21-oct-2026; decision de Juanma del 20-oct).
 *
 * Los QR impresos y los enlaces abren el /exec de Apps Script (rosanta-encuesta). Esa pagina NO cambia: sigue
 * mostrando lo mismo y su enviarRespuesta le pasa cada respuesta a la nube (POST /encuesta/respuesta). La base
 * es el unico escritor de las respuestas; la hoja "Encuesta 2026" queda como copia.
 *
 * Interruptor 'encuesta' (tabla interruptores, migracion 013; cache 30 s; sin fila = 'puente'):
 *   'puente' → la nube NO guarda: contesta {modo:'puente'} y Apps Script escribe la hoja como hoy. La base se
 *              llena con la copia de cada hora (/tareas/resenas/copiar-hojas).
 *   'base'   → la nube guarda la respuesta (origen 'nube') y contesta {modo:'base', fecha}. Apps Script escribe la
 *              fila de COPIA en la hoja con la marca 'nube' en la columna D. Si la nube no contesta, Apps Script
 *              igual la escribe, con la marca 'sin-nube', y la copia de cada hora la sube a la base (no se pierde).
 *   Volver atras = poner 'puente'.
 *
 * Plan B (si la pagina vieja no pudiera hablar con la nube): GET /encuesta sirve la MISMA pagina (copia exacta
 * de rosanta-encuesta/Index.html) y el envio va directo a POST /encuesta/respuesta.
 *
 * Es publico (sin login): cuerpo con forma fija y tamaño maximo, limite por IP y total, y lo unico que puede
 * hacer es agregar una respuesta. La regla de siempre no cambia: solo las 5 estrellas van a la reseña de Google.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const GOOGLE_REVIEW_URL = 'https://g.page/r/CWMvHjpESP6vEAE/review';
const PAGINA = path.join(__dirname, '..', 'proyectos', 'rosanta-encuesta', 'Index.html');
const CACHE_MS = 30 * 1000;

/** {rating, feedback, lang, website, via} → limpio, o {error}. website es la trampa para robots. */
function limpiarRespuesta(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'cuerpo invalido' };
  const extra = Object.keys(b).filter((k) => ['rating', 'feedback', 'lang', 'website', 'via'].indexOf(k) === -1);
  if (extra.length) return { error: 'campos de mas' };
  if (b.website) return { robot: true };
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'calificacion invalida' };
  if (b.feedback !== undefined && typeof b.feedback !== 'string') return { error: 'comentario invalido' };
  const feedback = String(b.feedback || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
  if (feedback.length > 2000) return { error: 'comentario muy largo' };
  const via = b.via === 'exec' ? 'exec' : 'pagina';
  return { cuerpo: { rating, feedback, via } };
}

function crearLimite(porMinuto, ahora) {
  const cuenta = new Map();
  return (clave) => {
    const t = ahora(), v = cuenta.get(clave);
    if (!v || t - v.desde >= 60000) { cuenta.set(clave, { desde: t, n: 1 }); if (cuenta.size > 5000) cuenta.clear(); return true; }
    v.n += 1;
    return v.n <= porMinuto;
  };
}

/** La pagina de Apps Script tal cual, con google.script.run cambiado por un fetch a la nube (plan B). */
function armarPagina(html) {
  const shim = '<script>window.google={script:{run:(function(){function r(ok,ko){return{withSuccessHandler:function(f){return r(f,ko)},' +
    'withFailureHandler:function(f){return r(ok,f)},enviarRespuesta:function(p){fetch("/encuesta/respuesta",{method:"POST",keepalive:true,' +
    'headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}).then(function(x){if(!x.ok)throw new Error("HTTP "+x.status);return x.json()})' +
    '.then(function(j){ok&&ok(j)},function(e){ko&&ko(e)})}}}return r()})()}};</script>';
  return html.replace('<head>', '<head>' + shim);
}

/** deps: { pool, ahora, limites: { ip, total } } */
function montarEncuesta(app, deps) {
  const ahora = deps.ahora || Date.now;
  const lim = Object.assign({ ip: 10, total: 120 }, deps.limites || {});
  const porIp = crearLimite(lim.ip, ahora), total = crearLimite(lim.total, ahora);
  let cache = null;

  async function modo() {
    if (cache && ahora() - cache.t < CACHE_MS) return cache.v;
    let v = 'puente';
    try {
      const r = await deps.pool.query('SELECT modo FROM interruptores WHERE modulo = $1', ['encuesta']);
      if (r.rows[0] && ['puente', 'base'].indexOf(r.rows[0].modo) !== -1) v = r.rows[0].modo;
    } catch (e) { /* sin tabla: puente */ }
    cache = { t: ahora(), v };
    return v;
  }

  const lector = express.text({ type: () => true, limit: '8kb' });
  const leerCuerpo = (req, res, next) => lector(req, res, (err) => (err ? res.status(err.status === 413 ? 413 : 400).json({ error: 'cuerpo invalido' }) : next()));
  const ip = (req) => String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();

  app.post('/encuesta/respuesta', leerCuerpo, async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!total('t') || !porIp(ip(req))) return res.status(429).json({ error: 'demasiados pedidos' });
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { return res.status(400).json({ error: 'cuerpo no JSON' }); } }
      const l = limpiarRespuesta(b);
      if (l.robot) return res.json({ ok: true, redirect: null });   // en silencio, como Apps Script
      if (l.error) return res.status(400).json({ error: l.error });
      const c = l.cuerpo;
      const redirect = c.rating >= 5 ? GOOGLE_REVIEW_URL : null;
      const m = await modo();
      if (m !== 'base') return res.json({ ok: true, modo: 'puente', redirect });
      const r = await deps.pool.query(`INSERT INTO encuesta_respuestas (fecha, calificacion, mejorar, huella, origen) VALUES (now(), $1, $2, $3, 'nube')
        RETURNING to_char(fecha AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha`,
      [c.rating, c.feedback, 'nube-' + c.via + '-' + crypto.randomUUID()]);
      res.json({ ok: true, modo: 'base', fecha: r.rows[0].fecha, redirect });
    } catch (e) { next(e); }
  });

  let html = null;
  app.get('/encuesta', (req, res) => {
    if (!html) html = armarPagina(fs.readFileSync(PAGINA, 'utf8'));
    res.set('Cache-Control', 'no-store').type('html').send(html);
  });
  return { modo };
}

module.exports = { montarEncuesta, limpiarRespuesta, armarPagina, GOOGLE_REVIEW_URL };
