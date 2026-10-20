/**
 * La app del pipeline EN VIVO (19-oct-2026). Hoy solo corre en el servicio de ensayo
 * rosanta-nube-clientes-ensayo (base rosanta_ensayo + una hoja de ensayo); el dia del paso, con el si de
 * Juanma, se monta en el servicio de Clientes.
 *
 * deps: { pool, vivo (crearServicioVivo), pantallaEventos(o), claveTareas, claveHook, version,
 *         crm (crearCrmVivo, opcional: reservas, carritos y CRM en la base), hoy() → 'AAAA-MM-DD',
 *         marketing (crearMarketingVivo, opcional), leerModoMarketing() → 'base'|'sheets' }
 *
 * Desde el 20-oct-2026 es la app del servicio DEFINITIVO rosanta-clientes (acordado con el Estudio): la
 * pantalla de Eventos, /hooks/cotizaciones (la direccion de cot.sh) y, por /interno/aviso, los avisos de
 * Wix que rosanta-nube le pasa cuando su interruptor esta en base.
 */
const express = require('express');
const crypto = require('crypto');
const U = require('../usuarios');
const HW = require('../hooks-wix');

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

  app.get('/salud', (req, res) => res.json({ ok: true, version: deps.version || '', servicio: 'clientes', vivo: deps.vivo.estado(), crm: deps.crm ? deps.crm.estado() : null }));

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
  if (deps.crm) {
    /** Un aviso de Wix que rosanta-nube recibio con el interruptor en base. Se vuelve a limpiar aca. */
    app.post('/interno/aviso', exigirTarea, async (req, res) => {
      const b = req.body || {};
      const limpio = b.hook === 'carrito' ? HW.limpiarCarrito(b.cuerpo) : b.hook === 'reserva' ? HW.limpiarReserva(b.cuerpo) : { error: 'aviso desconocido' };
      if (limpio.error) return res.status(400).json({ error: limpio.error });
      try { const r = await deps.crm.atender(b.hook, limpio.cuerpo); res.status(r.estado).json(r.json); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
    });
    app.post('/tareas/importar-crm', exigirTarea, async (req, res) => {
      // el mismo reloj trae tambien las pestañas de Marketing (si esta montado): un reloj menos
      try {
        const pestanas = await deps.crm.importar();
        if (deps.marketing) pestanas.push(...await deps.marketing.importar());
        res.json({ ok: true, pestanas });
      } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
    });
    /** La sombra de cada noche: 409 si hay diferencias (el reloj falla y llega la alerta de siempre). */
    app.post('/tareas/comparar-crm', exigirTarea, async (req, res) => {
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.desde || '')) ? req.query.desde : (deps.hoy ? deps.hoy() : new Date().toISOString().slice(0, 10));
      try {
        const r = await deps.crm.comparar(desde);
        await deps.pool.query('INSERT INTO clientes_comparaciones (desde, recibidos, diferencias, avisos) VALUES ($1,$2,$3,$4)', [desde, r.recibidos, JSON.stringify(r.diferencias), JSON.stringify(r.avisos)]).catch((e) => console.error('Foto de la comparacion:', e.message));
        res.status(r.ok ? 200 : 409).json(Object.assign({ desde }, r));
      } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
    });
  }
  if (deps.marketing) {
    /**
     * Las 6 funciones de guardar de Marketing, que la intranet manda aca con motor_marketing = base
     * (NubeClientes.js › _mktDesvio_). Cuerpo { fn, args, email }: la intranet ya identifico a la persona
     * (sesion de Google o su enlace); aca se busca en la tabla usuarios por correo y el codigo real vuelve a
     * revisar sus permisos. 409 si el interruptor no esta en base (un solo escritor).
     */
    app.post('/interno/marketing', exigirTarea, async (req, res) => {
      const b = req.body || {};
      try {
        if (deps.leerModoMarketing && (await deps.leerModoMarketing()) !== 'base') return res.status(409).json({ error: 'Marketing todavía se guarda en la intranet (motor_marketing en sheets).' });
        const email = String(b.email || '').trim().toLowerCase();
        const u = email ? (await deps.pool.query('SELECT email, rol, modulos, puede_editar, nombre FROM usuarios WHERE lower(email) = $1', [email])).rows[0] : null;
        if (!u) return res.status(403).json({ error: 'Tu correo no está en la hoja USUARIOS.' });
        res.json({ resultado: await deps.marketing.guardar(u, String(b.fn || ''), Array.isArray(b.args) ? b.args : []) });
      } catch (e) { res.status(e.status || 400).json({ error: String(e.message || e) }); }
    });
    app.post('/tareas/importar-marketing', exigirTarea, async (req, res) => {
      try { res.json({ ok: true, pestanas: await deps.marketing.importar() }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
    });
  }
  return app;
}

module.exports = { crearAppVivo };
