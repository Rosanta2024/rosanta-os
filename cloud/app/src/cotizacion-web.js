/**
 * Formulario de cotización de eventos (21-oct-2026). Decisión de Juanma (20-oct): "Request a quote" de /events-1 lleva a un
 * formulario que entra al pipeline de eventos (rosanta-clientes, Fase 2) y le avisa a Juanma por correo.
 *
 *   POST /api/eventos/cotizacion   (público, con freno por IP y campo trampa)
 *     → gancho pipeline(cuerpo) = POST rosanta-clientes /interno/web/pipeline-cotizacion (forma fija, 13 llaves)
 *     → gancho avisarJuanma({ asunto, texto })
 * rosanta-web no guarda la cotización: la fuente es el pipeline. Si el pipeline falla, el aviso a Juanma igual sale
 * (lleva todos los datos), para que la consulta no se pierda.
 */
const crypto = require('crypto');
const express = require('express');

const TIPOS = ['privado', 'boda', 'empresa', 'cumpleanos', 'otro'];
const MENUS = ['degustacion', 'especiales', 'boquitas', 'no_se'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function limpio(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function hoyGT(ms) { return new Date(ms - 6 * 3600000).toISOString().slice(0, 10); }

/** Lo que manda el formulario → el cuerpo de forma fija para rosanta-clientes, o { error } en el idioma del cliente. */
function armarCotizacion(x, ahoraMs, nuevoId) {
  const d = x && typeof x === 'object' ? x : {};
  const en = d.idioma !== 'es';
  const t = (es, ing) => (en ? ing : es);
  if (d.sitio_web) return { error: t('No se pudo enviar.', 'Could not send.') };   // campo trampa
  const c = {
    id: nuevoId(), tipo: 'evento',
    tipo_evento: TIPOS.indexOf(d.tipo_evento) !== -1 ? d.tipo_evento : 'otro',
    nombre: limpio(d.nombre, 120), email: limpio(d.email, 160).toLowerCase(), telefono: limpio(d.telefono, 40) || null,
    idioma: en ? 'en' : 'es',
    fecha: d.fecha ? limpio(d.fecha, 10) : null,
    personas: d.personas === undefined || d.personas === null || d.personas === '' ? null : Number(d.personas),
    menu: MENUS.indexOf(d.menu) !== -1 ? d.menu : 'no_se',
    presupuesto: limpio(d.presupuesto, 120), mensaje: limpio(d.mensaje, 2000),
    origen: {}
  };
  if (d.origen && typeof d.origen === 'object' && !Array.isArray(d.origen)) {
    Object.entries(d.origen).slice(0, 12).forEach(([k, v]) => { const kk = limpio(k, 40).replace(/[^A-Za-z0-9_.-]/g, '_'); if (kk) c.origen[kk] = limpio(v, 300); });
  }
  if (!c.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return { error: t('Falta tu nombre o un correo válido.', 'Your name and a valid email are required.') };
  if (c.fecha && (!FECHA.test(c.fecha) || c.fecha < hoyGT(ahoraMs))) return { error: t('La fecha no es válida.', 'Invalid date.') };
  if (c.personas !== null && !(Number.isInteger(c.personas) && c.personas >= 1 && c.personas <= 500)) return { error: t('¿Cuántas personas? (1 a 500)', 'How many guests? (1 to 500)') };
  return { cuerpo: c };
}

function textoAviso(c) {
  return ['Cotización de evento desde la web', '',
    'Quién: ' + c.nombre + ' · ' + c.email + (c.telefono ? ' · ' + c.telefono : '') + ' · idioma ' + c.idioma,
    'Tipo: ' + c.tipo_evento + ' · fecha: ' + (c.fecha || 'sin fecha') + ' · personas: ' + (c.personas || '?'),
    'Menú: ' + c.menu + (c.presupuesto ? ' · presupuesto: ' + c.presupuesto : ''),
    '', 'Mensaje: ' + (c.mensaje || '(sin mensaje)')].join('\n');
}

/** Freno simple por IP: n pedidos por ventana. */
function freno(n, ms) {
  const vistos = new Map();
  return (req, res, next) => {
    const t = Date.now(), k = req.ip || 'x', v = (vistos.get(k) || []).filter((x) => t - x < ms);
    v.push(t); vistos.set(k, v); if (vistos.size > 5000) vistos.clear();
    return v.length <= n ? next() : res.status(429).json({ ok: false, error: 'Demasiados envíos. Probá en unos minutos.' });
  };
}

/** deps: { pipeline(cuerpo) → { id }, avisarJuanma({ asunto, texto }), reloj, nuevoId, origenes } */
function crearRutasCotizacion(deps) {
  const d = deps || {};
  const reloj = d.reloj || (() => Date.now());
  const nuevoId = d.nuevoId || (() => crypto.randomUUID());
  const origenes = d.origenes || ['https://www.rosanta.rest', 'https://rosanta.rest', 'https://nuevo.rosanta.rest'];
  const r = express.Router();
  r.use('/api/eventos', (req, res, next) => {
    const o = req.get('Origin');
    if (o && origenes.indexOf(o) === -1) return res.status(403).json({ ok: false });
    if (o) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.set('Access-Control-Allow-Methods', 'POST, OPTIONS'); }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  }, express.json({ limit: '20kb' }), express.urlencoded({ extended: false, limit: '20kb' }));   // urlencoded: el formulario sin JavaScript
  r.post('/api/eventos/cotizacion', freno(5, 10 * 60 * 1000), async (req, res) => {
    const a = armarCotizacion(req.body, reloj(), nuevoId);
    if (a.error) return res.status(400).json({ ok: false, error: a.error });
    const c = a.cuerpo;
    if (d.prueba) return res.json({ ok: true, prueba: true });   // version de prueba: no entra al pipeline ni avisa a nadie
    let pipeline = null, aviso = null;
    try { pipeline = d.pipeline ? await d.pipeline(c) : null; } catch (e) { pipeline = { error: String(e.message || e).slice(0, 200) }; console.error('[web] cotización → pipeline: ' + pipeline.error); }
    try { aviso = d.avisarJuanma ? await d.avisarJuanma({ asunto: 'Cotización web: ' + c.tipo_evento + ' (' + c.nombre + ')', texto: textoAviso(c) + (pipeline && pipeline.error ? '\n\nOJO: no entró al pipeline (' + pipeline.error + '). Cargarla a mano.' : '') }) : null; } catch (e) { console.error('[web] cotización → aviso: ' + e.message); }
    if ((!pipeline || pipeline.error || pipeline.estado === 'sin_gancho') && !(aviso && aviso.estado === 'enviado')) {
      // Ni pipeline ni correo: que el cliente lo sepa y escriba por otro lado.
      return res.status(503).json({ ok: false, error: c.idioma === 'en' ? 'We could not send it. Please write to restaurante@rosanta.rest or WhatsApp +502 3082 6935.' : 'No pudimos enviarla. Escríbenos a restaurante@rosanta.rest o por WhatsApp al +502 3082 6935.' });
    }
    res.json({ ok: true });
  });
  return r;
}

module.exports = { crearRutasCotizacion, armarCotizacion, textoAviso, TIPOS, MENUS };
