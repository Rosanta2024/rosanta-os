/**
 * Servicio propio de la web: Cloud Run "rosanta-web" (Queretaro), misma base "rosanta". 21-oct-2026.
 * Propuesta del Estudio: lo que da a internet (reservas, avisos, contenido, gift cards, Adventures) va APARTE de
 * rosanta-nube, para que nunca tumbe Pagos y Caja, y para que trust proxy y el orden de express no cambien rutas ajenas.
 *
 *   Arranque:  GOOGLE_ENTRYPOINT="node src/server-web.js"   (misma carpeta cloud/app, sello propio:
 *              python3 cloud/herramientas/sellar-nube.py --servicio rosanta-web)
 *   Firebase Hosting desvia /api/**, /r/**, /reservas/**, /contenido-web/** y /tareas/** a este servicio.
 *
 * Variables (todas por Secret Manager o el servicio; ninguna en el codigo):
 *   DB_CLAVE (db-app) · CLAVE_TAREAS · BOT_RESERVAS_SECRETO · RESERVAS_ENLACE_SECRETO
 *   AVISOS_MODO apagado|sombra|vivo · RESEND_API_KEY · RESEND_WEBHOOK_SECRETO · WHATSAPP_* (apagado por defecto)
 *   PASARELA ninguna (por defecto; cobros en pausa) · WEB_FOTOS_BUCKET · SITIO_RECONSTRUIR_URL/_CLAVE
 *   CONTACTO_CORREO · CONTACTO_WHATSAPP ("Escribenos" de las gift cards)
 *   CLIENTES_URL: rosanta-clientes (Fase 2) para las tareas internas: CRM de la reserva, CAPI y lead de Adventures al
 *             pipeline, con la cabecera x-rosanta-tarea = CLAVE_TAREAS. Sin CLIENTES_URL, esos ganchos solo dejan rastro.
 *             rosanta-nube NO conoce la web (decision del Estudio, 21-oct).
 *   El aviso a Juanma (consultas de Adventures) sale de aca por Resend, a restaurante@rosanta.rest (AVISOS_MODO != apagado).
 *
 * Version de PRUEBA (servicio rosanta-web-ensayo, base rosanta_ensayo): ENSAYO=si → noindex en todo, la cotizacion
 * contesta "ok" sin mandar nada, y SITIO_DIR sirve el sitio construido con PUBLIC_PRUEBA=si (sin medicion).
 * ORIGENES_EXTRA (separados por coma) suma origenes al CORS (p. ej. la direccion run.app de la prueba).
 *
 * El orden importa: los routers que leen el cuerpo crudo o text/plain (motor, avisos con su webhook, gift cards con
 * el webhook de la pasarela) se montan ANTES del express.json global.
 */
const express = require('express');

/** Un gancho que pide una tarea interna a rosanta-clientes (Fase 2). El motor y los servicios lo protegen si falla. */
function ganchoInterno(env, ruta, fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  return async function (cuerpo) {
    if (!env.CLIENTES_URL || !f) { console.log('[web] gancho ' + ruta + ' sin CLIENTES_URL: no se envio'); return { estado: 'sin_gancho' }; }
    const r = await f(String(env.CLIENTES_URL).replace(/\/+$/, '') + ruta, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': env.CLAVE_TAREAS || '' }, body: JSON.stringify(cuerpo)
    });
    if (!r.ok) throw new Error('rosanta-clientes contesto ' + r.status + ' en ' + ruta);
    return r.json().catch(() => ({}));
  };
}

/** El aviso a Juanma por correo (Resend, el mismo canal de los avisos; en sombra va igual a restaurante@). */
function avisoJuanma(canales) {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));
  return async function ({ asunto, texto, lead }) {
    if (!texto && lead) {
      const l = lead;
      texto = ['Consulta de Rosanta Adventures', '', 'Experiencia: ' + (l.titulo || l.experiencia) + ' (operador: ' + l.operador + ', código ' + l.codigo_referido + ')',
        'Quién: ' + l.nombre + ' · ' + l.email + (l.telefono ? ' · ' + l.telefono : '') + ' · idioma ' + l.idioma,
        'Fecha: ' + (l.fecha || 'sin fecha') + ' · personas: ' + (l.personas || '?'),
        l.cena ? 'Cena en Rosanta: ' + l.cena.fecha + ' ' + l.cena.hora + ' para ' + l.cena.personas : 'Sin cena combinada',
        '', 'Mensaje: ' + (l.mensaje || '(sin mensaje)')].join('\n');
    }
    if (!canales || canales.modo === 'apagado' || !canales.correo) { console.log('[web] aviso a Juanma (avisos apagados): ' + asunto); return { estado: 'apagado' }; }
    const r = await canales.correo.enviar({ to: ['restaurante@rosanta.rest'], asunto: String(asunto || 'Aviso de la web'), texto: String(texto || ''),
      html: '<pre style="font-family:inherit;white-space:pre-wrap">' + esc(texto) + '</pre>', etiquetas: [{ name: 'tipo', value: 'aviso_juanma' }] });
    return { estado: 'enviado', id: r.id };
  };
}

/**
 * La cena combinada de Adventures → el motor. Contrato del AYUDANTE 4:
 *   entra { fecha 'AAAA-MM-DD', hora 'HH:MM', personas, nombre, email, telefono, idioma, codigo, nota }
 *   sale  { id, pendiente } | { id: null, motivo }
 */
async function cenaAdventures(motor, c) {
  // Validar ANTES de armar la fecha: el lector de fechas de JavaScript acepta basura ("malTx") como el anio 2000.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.fecha)) || !/^\d{2}:\d{2}$/.test(String(c.hora))) return { id: null, motivo: 'fecha_invalida' };
  const inicio = new Date(String(c.fecha) + 'T' + String(c.hora) + ':00-06:00');
  if (isNaN(inicio.getTime())) return { id: null, motivo: 'fecha_invalida' };
  const r = await motor.crear({ origen: 'web', canal: 'adventures', inicio, personas: Number(c.personas), nombre: c.nombre,
    email: c.email, telefono: c.telefono, idioma: c.idioma, nota_equipo: ('Adventures ' + (c.codigo || '') + ' ' + (c.nota || '')).trim() },
  { canal: 'web', quien: 'adventures', duplicados: 'web' });
  // Sin la llave "estado": adventures.js envuelve la respuesta en { estado: 'ok', ... } y la leeria como error.
  return r.ok ? { id: r.reserva.id, pendiente: r.reserva.estado === 'pendiente' } : { id: null, motivo: r.motivo };
}

/**
 * Arma la app con todo montado. deps: { pool, env, matriz (funcion sincronica), fetch, almacenWeb, canales, pasarela }
 * (los de prueba se inyectan; en Cloud Run salen del entorno).
 */
function crearAppWeb(deps) {
  const env = deps.env || process.env;
  const pool = deps.pool;
  const matriz = deps.matriz;
  const { crearRutasReservas } = require('./reservas/rutas');
  const { crearAvisos } = require('./reservas-avisos/avisos');
  const { crearRutasAvisos } = require('./reservas-avisos/rutas');
  const { canalesDesdeEntorno } = require('./reservas-avisos/adaptadores');
  const W = require('./rutas-web');
  const AW = require('./adaptadores-web');
  const { crearAlmacenPg } = require('./almacen-web');
  const { crearContenidoWeb } = require('./contenido-web');
  const { crearGiftcards } = require('./giftcards');
  const { crearAdventures } = require('./adventures');
  const { crearPasarela } = require('./pasarela');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);   // Cloud Run / Firebase: la IP real del cliente para los limites por IP
  const ensayo = env.ENSAYO === 'si';
  if (ensayo) app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
  const extra = String(env.ORIGENES_EXTRA || '').split(',').map((x) => x.trim()).filter((x) => /^https:\/\/[a-z0-9.-]+$/.test(x));
  const { ORIGENES } = require('./reservas/rutas');
  const origenes = ORIGENES.concat(extra);
  app.get('/salud', (req, res) => res.json({ ok: true, servicio: ensayo ? 'rosanta-web (prueba)' : 'rosanta-web' }));

  // ---- Reservas y avisos (ANTES del json global: el motor lee text/plain y el webhook de Resend el cuerpo crudo)
  const canales = deps.canales || canalesDesdeEntorno(env, deps.fetch);
  const avisos = crearAvisos({ pool, canales,
    secretoEnlace: env.RESERVAS_ENLACE_SECRETO, baseEnlace: env.MI_RESERVA_BASE || 'https://www.rosanta.rest/r/',
    basePanel: env.PANEL_BASE || 'https://www.rosanta.rest/reservas/panel' });
  const rutasReservas = crearRutasReservas({ pool, avisos: avisos.gancho, origenes,
    crm: ganchoInterno(env, '/interno/web/crm-reserva', deps.fetch),
    capi: ganchoInterno(env, '/interno/web/capi', deps.fetch) });
  app.use('/api/reservas', rutasReservas);
  app.use(crearRutasAvisos({ pool, avisos, motor: rutasReservas.motor, claveTareas: env.CLAVE_TAREAS,
    resendWebhookSecreto: env.RESEND_WEBHOOK_SECRETO }));

  // ---- Contenido, gift cards (webhook de la pasarela con cuerpo crudo) y Adventures
  const almacen = deps.almacenWeb || crearAlmacenPg(pool);
  const contenido = crearContenidoWeb({ almacen, matriz,
    fotos: env.WEB_FOTOS_BUCKET ? AW.fotosCloudStorage({ bucket: env.WEB_FOTOS_BUCKET }) : { async guardar() { throw new Error('Falta WEB_FOTOS_BUCKET.'); } },
    reconstruir: AW.reconstruirPorUrl({ url: env.SITIO_RECONSTRUIR_URL, clave: env.SITIO_RECONSTRUIR_CLAVE }) });
  const pasarela = deps.pasarela || crearPasarela(env, { fetch: deps.fetch });   // PASARELA=ninguna: cobros en pausa
  const giftcards = crearGiftcards({ almacen, matriz, pasarela, avisos: AW.avisosSinCorreo(), fel: AW.felSinIntegrar(),
    urls: { exito: 'https://www.rosanta.rest/gift-card?ok=1', cancelar: 'https://www.rosanta.rest/gift-card' },
    contacto: { correo: env.CONTACTO_CORREO || 'restaurante@rosanta.rest', whatsapp: env.CONTACTO_WHATSAPP || '+502 3082 6935' } });   // Juanma, 20-oct
  const adventures = crearAdventures({ almacen, matriz, contenido, ganchos: {
    pipeline: ganchoInterno(env, '/interno/web/pipeline-adventure', deps.fetch),
    avisarJuanma: avisoJuanma(canales),
    crearReserva: (c) => cenaAdventures(rutasReservas.motor, c)
  } });
  app.use(W.crearRutasGiftcards({ giftcards, pasarela, pool, matriz, almacen, claveTareas: env.CLAVE_TAREAS }));
  app.use(W.crearRutasContenidoWeb({ contenido, pool }));
  app.use(W.crearRutasAdventures({ adventures, pool, claveTareas: env.CLAVE_TAREAS }));
  // Cotización de eventos ("Request a quote" de /events-1): al pipeline de rosanta-clientes y aviso a Juanma
  app.use(require('./cotizacion-web').crearRutasCotizacion({ pipeline: ganchoInterno(env, '/interno/web/pipeline-cotizacion', deps.fetch),
    avisarJuanma: avisoJuanma(canales), prueba: ensayo, origenes: ['https://www.rosanta.rest', 'https://rosanta.rest', 'https://nuevo.rosanta.rest'].concat(extra) }));

  // ---- El json global va al FINAL (guardando el cuerpo crudo por si algun router lo necesita)
  app.use(express.json({ limit: '200kb', verify: W.guardarCuerpoCrudo }));
  // El sitio construido (solo en la version de prueba; en produccion lo sirve Firebase Hosting)
  if (env.SITIO_DIR) app.use(express.static(env.SITIO_DIR, { extensions: ['html'], redirect: false, index: 'index.html' }));
  app.use((req, res) => res.status(404).json({ error: 'No existe.' }));
  return { app, avisos, rutasReservas, contenido, giftcards, adventures, pasarela };
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('rosanta-web tiene que correr con TZ=America/Guatemala.');
  const { crearPool } = require('./db');
  const P = require('./permisos');
  const pool = await crearPool();
  let matriz = await P.cargarDeBase(pool);
  setInterval(() => { P.cargarDeBase(pool).then((m) => { matriz = m; }).catch((e) => console.error('[web] matriz', e.message)); }, 5 * 60000).unref();
  const { app } = crearAppWeb({ pool, matriz: () => matriz });
  const puerto = Number(process.env.PORT || 8080);
  app.listen(puerto, () => console.log('rosanta-web escuchando en ' + puerto));
}

if (require.main === module) main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
module.exports = { crearAppWeb, ganchoInterno, cenaAdventures, avisoJuanma };
