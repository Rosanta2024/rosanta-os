/**
 * Panel de reservas, "Mi reserva", relojes y webhook de los avisos (Ayudante 2, 20-oct-2026).
 * Un express.Router que el Estudio monta SIN tocar server.js ni app.js, junto al del motor (Ayudante 1):
 *
 *   const { crearRutasReservas } = require('./reservas/rutas');
 *   const { crearAvisos } = require('./reservas-avisos/avisos');
 *   const { crearRutasAvisos } = require('./reservas-avisos/rutas');
 *   const { canalesDesdeEntorno } = require('./reservas-avisos/adaptadores');
 *   const avisos = crearAvisos({ pool, canales: canalesDesdeEntorno(process.env), secretoEnlace: process.env.RESERVAS_ENLACE_SECRETO,
 *     baseEnlace: 'https://www.rosanta.rest/r/', basePanel: 'https://<nube>/reservas/panel' });
 *   const rutas = crearRutasReservas({ pool, avisos: avisos.gancho, ... });
 *   app.use('/api/reservas', rutas);                                         // ANTES de app.use(express.json())
 *   app.use(crearRutasAvisos({ pool, avisos, motor: rutas.motor, claveTareas: process.env.CLAVE_TAREAS,
 *     resendWebhookSecreto: process.env.RESEND_WEBHOOK_SECRETO }));           // tambien ANTES de express.json()
 *
 * Las pantallas hablan con las rutas del MOTOR (/api/reservas/equipo/* y /api/reservas/mi/*): aqui no se repite
 * ninguna. Lo que se agrega:
 *   GET  /reservas/panel                       la pantalla del equipo (entra con el enlace de siempre: ?u=...)
 *   GET  /reservas/panel/api/yo                quien soy y que puedo hacer (matriz de permisos, parte 'reservas')
 *   GET  /reservas/panel/api/semana?desde=     7 dias: reservas, personas, por aprobar, alergias
 *   GET  /reservas/panel/api/avisos?fecha=     los avisos de las reservas de ese dia (¿le llego la confirmacion?)
 *   GET  /r/:codigo                            "Mi reserva" (publica, enlace firmado, EN/ES)
 *   POST /tareas/avisos/recordatorios          reloj (clave de tareas, cabecera x-rosanta-tarea), cada 15 min
 *   POST /tareas/avisos/resenas                reloj, cada 30 min
 *   POST /hooks/resend                         webhook de Resend (firma Svix): entregado, rebotado, spam
 *
 * deps: { pool, avisos, motor, permisos, quien, claveTareas, resendWebhookSecreto, apiReservas ('/api/reservas'), reloj }
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const C = require('../reservas/comun');
const { firmaResendValida } = require('./adaptadores');

const DIR = path.join(__dirname, '..', '..', 'reservas');

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function crearRutasAvisos(deps) {
  const d = deps || {};
  const reloj = () => new Date(d.reloj ? d.reloj() : Date.now()).getTime();
  const api = String(d.apiReservas || '/api/reservas').replace(/\/+$/, '');
  let matriz = null, matrizT = 0;
  const permisos = d.permisos || (async (u, parte, accion, reg) => {
    const P = require('../permisos');
    if (!matriz || Date.now() - matrizT > 300000) { matriz = await P.cargarDeBase(d.pool); matrizT = Date.now(); }
    return P.puede(matriz, u, parte, accion, reg);
  });
  const quien = d.quien || (async (req) => {
    const tok = req.get('x-rosanta-u') || req.query.u;
    return tok ? require('../usuarios').usuarioPorToken(d.pool, tok) : null;
  });

  const r = express.Router();

  // ---------------------------------------------------------------- paginas
  const paginas = {};
  function pagina(archivo) {
    if (!paginas[archivo]) {
      let pal = '';
      try { pal = require('../pantalla-pagos').paleta(); } catch (e) { pal = ''; }
      paginas[archivo] = fs.readFileSync(path.join(DIR, archivo), 'utf8').replace('<!--PALETA-->', () => pal).replace(/__API__/g, api);
    }
    return paginas[archivo];
  }
  const html = (res, s) => res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
    'X-Frame-Options': 'DENY' }).type('html').send(s);

  r.get('/reservas/panel', (req, res) => html(res, pagina('panel.html')));
  r.get('/r/:codigo', (req, res) => html(res, pagina('mi-reserva.html')));

  // ---------------------------------------------------------------- panel: lo que el motor no trae
  function exigir(accion) {
    return async (req, res, next) => {
      try {
        const u = await quien(req);
        if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
        const p = await permisos(u, 'reservas', accion, null);
        if (!p || !p.ok) return res.status(403).json({ error: (p && p.motivo) || 'Sin permiso.' });
        req.usuario = u;
        next();
      } catch (e) { next(e); }
    };
  }
  const motor = () => { if (!d.motor) throw new Error('Falta el motor de reservas.'); return d.motor; };

  r.get('/reservas/panel/api/yo', exigir('ver'), async (req, res, next) => {
    try {
      const u = req.usuario;
      const ingresar = !!(await permisos(u, 'reservas', 'ingresar', null) || {}).ok;
      // corregir lo de otros (aprobar, rechazar, cancelar, mover, cerrar fechas): sin registro propio = lo de otro
      const corregir = !!(await permisos(u, 'reservas', 'corregir', { escrito_por: '(otra persona)' }) || {}).ok;
      res.json({ nombre: u.nombre || u.email || '', rol: u.rol || '', puede: { ver: true, ingresar, corregir },
        avisos: d.avisos ? d.avisos.modo : 'apagado', motor_reservas: await motor().modo(), hoy: C.diaGt(reloj()) });
    } catch (e) { next(e); }
  });

  r.get('/reservas/panel/api/semana', exigir('ver'), async (req, res, next) => {
    try {
      const desde = String(req.query.desde || C.diaGt(reloj()));
      if (!C.fechaValida(desde)) return res.status(400).json({ error: 'La fecha va como AAAA-MM-DD.' });
      const cierres = await motor().cierres();
      const dias = [];
      for (let i = 0; i < 7; i++) {
        const f = C.sumarDias(desde, i);
        const dd = await motor().dia(f);
        const vivas = dd.reservas.filter((x) => ['cancelada', 'rechazada'].indexOf(x.estado) === -1);
        const ini = C.instante(f, '00:00').getTime(), fin = C.instante(C.sumarDias(f, 1), '00:00').getTime();
        const cierre = cierres.find((c) => c.cerrado !== false && new Date(c.desde).getTime() < fin && new Date(c.hasta).getTime() > ini);
        dias.push({ fecha: f, reservas: vivas.length, personas: vivas.reduce((s, x) => s + (Number(x.personas) || 0), 0),
          pendientes: dd.resumen.pendientes, alergias: vivas.filter((x) => x.alergias).length, cerrado: cierre ? (cierre.motivo || 'Cerrado') : '' });
      }
      res.set('Cache-Control', 'no-store').json({ desde, dias });
    } catch (e) { next(e); }
  });

  r.get('/reservas/panel/api/avisos', exigir('ver'), async (req, res, next) => {
    try {
      const fecha = String(req.query.fecha || C.diaGt(reloj()));
      if (!C.fechaValida(fecha)) return res.status(400).json({ error: 'La fecha va como AAAA-MM-DD.' });
      if (!d.avisos) return res.json({ modo: 'apagado', avisos: [] });
      const dd = await motor().dia(fecha);
      const filas = await d.avisos.deReservas(dd.reservas.map((x) => x.id));
      res.set('Cache-Control', 'no-store').json({ modo: d.avisos.modo, avisos: filas.map((x) => ({ reserva_id: x.reserva_id, plantilla: x.plantilla,
        canal: x.canal, estado: x.estado, destinatario: x.destinatario, para_equipo: x.para_equipo, modo: x.modo,
        cuando: x.enviado || x.programado_para, error: x.estado === 'omitido' || x.estado === 'fallo' ? x.error : null })) });
    } catch (e) { next(e); }
  });

  // ---------------------------------------------------------------- relojes
  function exigirTarea(req, res, next) {
    if (!iguales(req.get('x-rosanta-tarea'), d.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    next();
  }
  r.post('/tareas/avisos/recordatorios', exigirTarea, async (req, res, next) => {
    try { if (!d.avisos) return res.json({ ok: true, omitido: 'sin avisos' }); res.json(Object.assign({ ok: true }, await d.avisos.relojRecordatorios())); } catch (e) { next(e); }
  });
  r.post('/tareas/avisos/resenas', exigirTarea, async (req, res, next) => {
    try { if (!d.avisos) return res.json({ ok: true, omitido: 'sin avisos' }); res.json(Object.assign({ ok: true }, await d.avisos.relojResenas())); } catch (e) { next(e); }
  });

  // ---------------------------------------------------------------- webhook de Resend
  // La firma se calcula sobre el cuerpo CRUDO: este router tiene que ir antes de express.json() (o ese express.json
  // tiene que guardar req.rawBody con `verify`). Si el cuerpo ya llego como objeto, se rechaza.
  r.post('/hooks/resend', express.raw({ type: () => true, limit: '256kb' }), async (req, res, next) => {
    try {
      if (!d.resendWebhookSecreto || !d.avisos) return res.status(404).json({ error: 'No disponible.' });
      const crudo = req.rawBody ? String(req.rawBody) : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : null));
      if (crudo == null) return res.status(501).json({ error: 'Falta el cuerpo crudo para comprobar la firma (montar antes de express.json).' });
      const cab = { 'svix-id': req.get('svix-id'), 'svix-timestamp': req.get('svix-timestamp'), 'svix-signature': req.get('svix-signature') };
      if (!firmaResendValida(d.resendWebhookSecreto, cab, crudo, reloj())) return res.status(401).json({ error: 'Firma invalida.' });
      let ev; try { ev = JSON.parse(crudo); } catch (e) { return res.status(400).json({ error: 'JSON invalido.' }); }
      const x = await d.avisos.deResend(ev, cab['svix-id']);
      res.json({ ok: true, nuevo: !!x.nuevo });
    } catch (e) { next(e); }
  });

  r.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    (d.registrar || ((m) => console.error(m)))('avisos · error: ' + String((err && err.message) || err));
    res.status(500).json({ error: 'Error interno.' });
  });
  return r;
}

module.exports = { crearRutasAvisos };
