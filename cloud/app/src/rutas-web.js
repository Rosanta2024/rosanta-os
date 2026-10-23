/**
 * Rutas de la web nueva (AYUDANTE 4, 20-oct-2026; 21-oct: pasarela intercambiable y Adventures): "Contenido web",
 * gift cards, pagos en linea y Adventures. Tres fabricas de express.Router; NO tocan server.js ni app.js. Para
 * enchufarlas (lo hace el Estudio):
 *
 *   const W = require('./rutas-web');
 *   // en app.js, el json de siempre guardando el cuerpo crudo (lo necesita la firma del webhook):
 *   app.use(express.json({ limit: '200kb', verify: W.guardarCuerpoCrudo }));
 *   app.use(W.crearRutasContenidoWeb({ contenido, pool }));
 *   const pasarela = require('./pasarela').crearPasarela(process.env);   // PASARELA=ninguna por defecto
 *   app.use(W.crearRutasGiftcards({ giftcards, pasarela, pool, matriz, almacen, claveTareas, leerDepositos }));
 *   app.use(W.crearRutasAdventures({ adventures, pool, claveTareas }));
 *
 * El webhook acepta tambien el cuerpo crudo de express.raw (si el router se monta ANTES del json global).
 * Sin cuerpo crudo contesta 500 y no procesa: nunca se verifica una firma contra un JSON re-armado.
 *
 * Identificacion: el enlace de siempre (?u=<token> o cabecera x-rosanta-u), contra la tabla usuarios.
 */
const express = require('express');
const crypto = require('crypto');
const U = require('./usuarios');
const P = require('./permisos');
const { conciliarPagosLinea } = require('./conciliar-pagos-linea');
const pantallas = require('./pantallas-web');

/** Juanma (23-oct): las entradas del blog con fecha futura quedan ocultas hasta su fecha (hora de Guatemala).
 *  La version guardada no cambia: se filtra al servirla; el sitio se reconstruye cada dia para que aparezcan. */
function hoyGuatemala(ms) { return new Date((ms == null ? Date.now() : ms) - 6 * 3600000).toISOString().slice(0, 10); }
function sinBlogFuturo(c, hoy) {
  if (!c || !Array.isArray(c.blog)) return c;
  const blog = c.blog.filter((b) => !b.fecha || String(b.fecha).slice(0, 10) <= hoy);
  const out = Object.assign({}, c);
  if (blog.length) out.blog = blog; else delete out.blog;
  return out;
}

function guardarCuerpoCrudo(req, res, buf) { if (buf && buf.length) req.cuerpoCrudo = Buffer.from(buf); }

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function identificador(deps) {
  const buscar = deps.identificar || ((t) => U.usuarioPorToken(deps.pool, t));
  return function exigirUsuario(req, res, next) {
    const t = req.get('x-rosanta-u') || req.query.u;
    Promise.resolve(t ? buscar(t) : null).then((u) => {
      if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
      req.usuario = u;
      next();
    }).catch(next);
  };
}

/** Errores del servicio (con .status) → JSON en cristiano; el resto, 500. */
const responder = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) {
    if (e.status) return res.status(e.status).json(Object.assign({ error: e.message }, e.faltan ? { faltan: e.faltan } : {}));
    console.error('[web]', req.method, req.path, e);
    res.status(500).json({ error: 'Algo falló en el servidor. Probá de nuevo.' });
  }
};

const html = (res, s) => res.set('Cache-Control', 'no-store').set('X-Frame-Options', 'SAMEORIGIN').type('html').send(s);
const TIPOS_IMG = ['image/webp', 'image/jpeg', 'image/png'];

// ------------------------------------------------------------------------------------------------ contenido

function crearRutasContenidoWeb(deps) {
  const r = express.Router();
  const C = deps.contenido;
  const exigirUsuario = identificador(deps);
  r.use('/api/web', express.json({ limit: '200kb' }));   // solo en sus rutas: no se come el cuerpo crudo del webhook

  // Pantallas (el enlace va en ?u=; la pagina lo manda en la cabecera a la API)
  r.get('/contenido-web', (req, res) => html(res, pantallas.contenidoWeb()));
  r.get('/contenido-web/vista-previa', (req, res) => html(res, pantallas.vistaPrevia()));

  // Lo que lee el sitio al construirse: la ultima version publicada. Publico, sin datos personales.
  r.get('/api/web/contenido', responder(async (req, res) => {
    const c = await C.publicado(req.query.version);
    if (!c) { const e = new Error('Todavía no hay nada publicado.'); e.status = 404; throw e; }
    res.set('Cache-Control', 'public, max-age=60');
    return sinBlogFuturo(c, hoyGuatemala());
  }));

  r.get('/api/web/borrador', exigirUsuario, responder((req) => C.borrador(req.usuario)));
  r.get('/api/web/vista-previa', exigirUsuario, responder((req) => C.vistaPrevia(req.usuario)));
  r.get('/api/web/versiones', exigirUsuario, responder((req) => C.versiones(req.usuario)));
  r.get('/api/web/bitacora', exigirUsuario, responder((req) => C.bitacora(req.usuario, req.query.limite)));
  r.post('/api/web/publicar', exigirUsuario, responder((req) => C.publicar(req.usuario, (req.body || {}).nota)));
  r.post('/api/web/versiones/:id/volver', exigirUsuario, responder((req) => C.volverA(req.usuario, req.params.id, (req.body || {}).nota)));
  r.post('/api/web/ajustes/:clave', exigirUsuario, responder((req) => C.ajustar(req.usuario, req.params.clave, req.body)));

  // Fotos: el navegador las achica y manda los bytes (image/webp, jpeg o png), no JSON.
  const crudo = express.raw({ type: TIPOS_IMG, limit: '6mb' });
  r.post('/api/web/fotos', exigirUsuario, crudo, responder((req) => {
    if (!Buffer.isBuffer(req.body)) { const e = new Error('Mandá la foto como imagen (webp, jpg o png).'); e.status = 400; throw e; }
    return C.subirFoto(req.usuario, req.body, { ancho: req.query.ancho, alto: req.query.alto, alt_es: req.query.alt_es, alt_en: req.query.alt_en });
  }));
  r.post('/api/web/fotos/:id/chica', exigirUsuario, crudo, responder((req) => {
    if (!Buffer.isBuffer(req.body)) { const e = new Error('Mandá la foto como imagen.'); e.status = 400; throw e; }
    return C.subirFoto(req.usuario, req.body, { chicaDe: req.params.id });
  }));

  // Paginas, bloques, secciones, platos, faq, eventos y fotos (alt): crear, editar, retirar/reactivar
  r.post('/api/web/:tipo', exigirUsuario, responder((req) => C.crear(req.usuario, req.params.tipo, req.body)));
  r.patch('/api/web/:tipo/:llave', exigirUsuario, responder((req) => C.editar(req.usuario, req.params.tipo, req.params.llave, req.body)));
  r.post('/api/web/:tipo/:llave/activo', exigirUsuario, responder((req) => C.activar(req.usuario, req.params.tipo, req.params.llave, !!(req.body || {}).activo)));
  return r;
}

// ------------------------------------------------------------------------------------------------ gift cards

/** Freno simple por IP para lo publico (pedidos): n pedidos cada `ventanaMs`. */
function freno(n, ventanaMs) {
  const vistos = new Map();
  return (req, res, next) => {
    const ip = String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
    const ahora = Date.now(), lista = (vistos.get(ip) || []).filter((t) => ahora - t < ventanaMs);
    if (lista.length >= n) return res.status(429).json({ error: 'Demasiados intentos. Probá en unos minutos.' });
    lista.push(ahora); vistos.set(ip, lista);
    if (vistos.size > 5000) vistos.clear();
    next();
  };
}

function crearRutasGiftcards(deps) {
  const r = express.Router();
  const G = deps.giftcards;
  const exigirUsuario = identificador(deps);
  const M = () => (typeof deps.matriz === 'function' ? deps.matriz() : deps.matriz);
  const exigirTarea = (req, res, next) => (iguales(req.get('x-rosanta-tarea'), deps.claveTareas) ? next() : res.status(403).json({ error: 'Clave de tarea invalida.' }));
  const exigirFinanzas = (req) => { const p = P.puede(M(), req.usuario, 'finanzas', 'ver'); if (!p.ok) { const e = new Error('El reporte lo ve el dueño.'); e.status = 403; throw e; } };

  // El webhook va PRIMERO: con cuerpo crudo (express.raw aca, o req.cuerpoCrudo del json global).
  // /api/pagos/webhook/<proveedor>: solo responde el de la pasarela elegida (PASARELA); con "ninguna", 404.
  r.post('/api/pagos/webhook/:proveedor', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    const pas = deps.pasarela;
    if (!pas || !pas.encendido || req.params.proveedor !== pas.proveedor) return res.status(404).json({ error: 'No disponible.' });
    const cuerpo = Buffer.isBuffer(req.body) ? req.body : req.cuerpoCrudo;
    if (!Buffer.isBuffer(cuerpo)) {
      console.error('[giftcards] webhook sin cuerpo crudo: falta express.json({ verify: guardarCuerpoCrudo }) en app.js');
      return res.status(500).json({ error: 'sin cuerpo crudo' });
    }
    const x = await G.procesarWebhook(cuerpo, req.headers);
    if (x.status === 401) console.warn('[giftcards] webhook rechazado:', x.resultado);
    res.status(x.status).json({ resultado: x.resultado });
  });

  r.use(['/api/giftcards', '/api/pagos-linea', '/tareas'], express.json({ limit: '50kb' }));

  // Publico (lo llama el sitio)
  r.get('/gift-cards/comprar', (req, res) => html(res, pantallas.compraGiftcard()));
  r.get('/api/giftcards/precios', responder(async (req, res) => { res.set('Cache-Control', 'public, max-age=300'); return G.precios(); }));
  r.post('/api/giftcards/pedido', freno(8, 10 * 60 * 1000), responder((req) => G.crearPedido(req.body)));

  // Intranet: canje (sala y caja) y oficina (dueño)
  r.get('/giftcards', (req, res) => html(res, pantallas.canjeGiftcards()));
  r.get('/api/giftcards/buscar', exigirUsuario, responder((req) => G.buscar(req.usuario, req.query.codigo)));
  r.post('/api/giftcards/canjear', exigirUsuario, responder((req) => {
    const b = req.body || {};
    return G.canjear(req.usuario, b.codigo, b.monto, { donde: b.donde, referencia: b.referencia, nota: b.nota, forzarVencida: !!b.forzar_vencida });
  }));
  r.post('/api/giftcards/reversar', exigirUsuario, responder((req) => G.reversarCanje(req.usuario, (req.body || {}).movimiento, (req.body || {}).nota)));
  r.post('/api/giftcards/anular', exigirUsuario, responder((req) => G.anular(req.usuario, (req.body || {}).codigo, (req.body || {}).nota)));
  r.post('/api/giftcards/emitir', exigirUsuario, responder((req) => G.emitirManual(req.usuario, req.body)));

  // Reporte del mes (vendido, canjeado, vencido, saldo vivo) y conciliacion, para el dueño (y el contador)
  r.get('/api/giftcards/reporte', exigirUsuario, responder(async (req) => {
    exigirFinanzas(req);
    const mes = String(req.query.mes || '');
    if (!/^\d{4}-\d{2}$/.test(mes)) { const e = new Error('El mes va como AAAA-MM.'); e.status = 400; throw e; }
    return conciliarPagosLinea({ almacen: deps.almacen, mes, depositos: deps.leerDepositos ? await deps.leerDepositos() : null, guardar: false });
  }));
  r.post('/api/pagos-linea/liquidaciones', exigirUsuario, responder(async (req) => {
    exigirFinanzas(req);
    const b = req.body || {};
    const monto = Number(b.monto);
    if (!b.referencia || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha)) || !(monto > 0) || ['GTQ', 'USD'].indexOf(b.moneda) === -1) {
      const e = new Error('Falta la referencia, la fecha (AAAA-MM-DD), el monto o la moneda (GTQ/USD).'); e.status = 400; throw e;
    }
    try {
      const prov = deps.pasarela && deps.pasarela.proveedor;
      if (!prov || prov === 'ninguna') { const x = new Error('No hay pasarela elegida: no hay liquidaciones que cargar.'); x.status = 409; throw x; }
      return await deps.almacen.insertar('pagos_liquidaciones', { proveedor: prov, referencia: String(b.referencia).slice(0, 80), fecha: b.fecha, monto: Math.round(monto * 100) / 100, moneda: b.moneda, nota: String(b.nota || '').slice(0, 300) });
    } catch (e) { if (e.code === '23505') { const x = new Error('Esa liquidación ya está cargada.'); x.status = 409; throw x; } throw e; }
  }));

  // Tareas (Cloud Scheduler, con la clave de siempre)
  r.post('/tareas/giftcards-avisos', exigirTarea, responder(() => G.enviarAvisosPendientes()));
  r.post('/tareas/conciliar-pagos-linea', exigirTarea, async (req, res) => {
    try {
      const mes = (req.body && req.body.mes) || require('./conciliar').mesQueToca(new Date());
      if (!/^\d{4}-\d{2}$/.test(String(mes))) return res.status(400).json({ error: 'El mes va como AAAA-MM.' });
      const x = await conciliarPagosLinea({ almacen: deps.almacen, mes, depositos: deps.leerDepositos ? await deps.leerDepositos() : null, guardar: true });
      res.status(x.ok ? 200 : 409).json(x);
    } catch (e) { console.error('[giftcards] conciliar', e); res.status(500).json({ error: String(e.message || e) }); }
  });
  // NO programar hasta que el contador diga como se tratan las vencidas
  r.post('/tareas/giftcards-vencer', exigirTarea, responder(() => G.vencer()));
  return r;
}

// ------------------------------------------------------------------------------------------------ Adventures

function crearRutasAdventures(deps) {
  const r = express.Router();
  const AV = deps.adventures;
  const exigirUsuario = identificador(deps);
  const exigirTarea = (req, res, next) => (iguales(req.get('x-rosanta-tarea'), deps.claveTareas) ? next() : res.status(403).json({ error: 'Clave de tarea invalida.' }));
  r.use(['/api/adventures', '/tareas/adventures-vencimientos'], express.json({ limit: '50kb' }));

  // Publico: el formulario de consulta de cada ficha (sin cobro)
  r.post('/api/adventures/consulta', freno(6, 10 * 60 * 1000), responder((req) => AV.consulta(req.body)));
  // Dueño: las consultas, su estado y la comision; y el resumen por operador
  r.get('/api/adventures/leads', exigirUsuario, responder((req) => AV.leads(req.usuario, req.query)));
  r.patch('/api/adventures/leads/:id', exigirUsuario, responder((req) => AV.actualizarLead(req.usuario, req.params.id, req.body)));
  r.get('/api/adventures/operadores', exigirUsuario, responder((req) => AV.resumenOperadores(req.usuario)));
  // Tarea diaria: aviso a 30 dias y pausa automatica si vence la licencia o el seguro
  r.post('/tareas/adventures-vencimientos', exigirTarea, responder(() => AV.revisarVencimientos()));
  return r;
}

module.exports = { sinBlogFuturo, hoyGuatemala, crearRutasContenidoWeb, crearRutasGiftcards, crearRutasAdventures, guardarCuerpoCrudo };
