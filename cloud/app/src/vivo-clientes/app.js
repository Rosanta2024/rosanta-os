/**
 * La app del pipeline EN VIVO (19-oct-2026). Hoy solo corre en el servicio de ensayo
 * rosanta-nube-clientes-ensayo (base rosanta_ensayo + una hoja de ensayo); el dia del paso, con el si de
 * Juanma, se monta en el servicio de Clientes.
 *
 * deps: { pool, vivo (crearServicioVivo), pantallaEventos(o), claveTareas, claveHook, version }
 */
const express = require('express');
const crypto = require('crypto');
const U = require('../usuarios');

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function crearAppVivo(deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '500kb' }));
  const quien = (req) => { const t = req.get('x-rosanta-u') || req.query.u; return t ? U.usuarioPorToken(deps.pool, t) : Promise.resolve(null); };
  const exigirUsuario = (req, res, next) => quien(req).then((u) => {
    if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
    req.usuario = u; next();
  }).catch(next);
  const exigirTarea = (req, res, next) => (iguales(req.get('x-rosanta-tarea'), deps.claveTareas) ? next() : res.status(403).json({ error: 'Clave de tarea invalida.' }));

  app.get('/salud', (req, res) => res.json({ ok: true, version: deps.version || '', servicio: 'clientes-vivo', vivo: deps.vivo.estado() }));

  app.get('/clientes/eventos', async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send('<p style="font-family:sans-serif;padding:16px">No pude identificarte.</p>');
      if (!deps.vivo.puede(u, 'eventos')) return res.status(403).type('html').send('<p style="font-family:sans-serif;padding:16px">Tu cuenta no tiene el pipeline.</p>');
      res.set('Cache-Control', 'no-store').type('html').send(deps.pantallaEventos({ usuario: u, authToken: String(req.query.u || ''), vivo: deps.vivo.modo() === 'base' }));
    } catch (e) { next(e); }
  });

  app.post('/api/llamar/:nombre', exigirUsuario, async (req, res) => {
    try {
      const r = await deps.vivo.llamar(req.usuario, req.params.nombre, Array.isArray(req.body) ? req.body : []);
      res.json({ resultado: r.resultado, ms: r.ms });
    } catch (e) { res.status(e.status || 400).json({ error: String(e.message || e) }); }
  });

  /** La revision diaria (cot.sh): mismo cuerpo que ?hook=cotizaciones de Marketing OS, token en el cuerpo. */
  app.post('/hooks/cotizaciones', async (req, res) => {
    const b = req.body || {};
    if (!iguales(b.token, deps.claveHook) || String(deps.claveHook || '').length < 24) return res.json({ ok: false, error: 'unauthorized' });
    try { res.json(await deps.vivo.hook(b)); } catch (e) { res.status(e.status || 500).json({ ok: false, error: String(e.message || e) }); }
  });

  app.post('/tareas/importar', exigirTarea, async (req, res) => {
    // el modo se lee DESPUES de importar, que es cuando se relee el interruptor
    try { const pestanas = await deps.vivo.importar(); res.json({ ok: true, modo: deps.vivo.modo(), pestanas }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/tareas/copiar', exigirTarea, async (req, res) => {
    try { res.json(Object.assign({ ok: true }, await deps.vivo.copiarPendientes())); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  return app;
}

module.exports = { crearAppVivo };
