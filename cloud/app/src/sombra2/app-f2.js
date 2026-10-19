/**
 * La aplicacion web de rosanta-nube-sombra2 (17-oct-2026). Aparte de app.js (Pagos) a proposito:
 * publicar esta sombra nunca toca el servidor de Pagos. Reusa el acceso de siempre (usuarios.js:
 * el enlace ?u= contra la copia de USUARIOS que mantiene rosanta-nube; aca solo se LEE).
 *
 * deps: { pool, f2: { llamar, estado, refrescar }, comparar(), pantallas: { caja, compras, eventos, fotos },
 *         anotarTiempo(t), claveTareas, version }
 */
const express = require('express');
const crypto = require('crypto');
const U = require('../usuarios');

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function crearAppF2(deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  async function quien(req) {
    const t = req.get('x-rosanta-u') || req.query.u;
    return t ? U.usuarioPorToken(deps.pool, t) : null;
  }
  function exigirUsuario(req, res, next) {
    quien(req).then((u) => {
      if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
      req.usuario = u; next();
    }).catch(next);
  }
  function exigirTarea(req, res, next) {
    if (!iguales(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    next();
  }

  app.get('/salud', async (req, res) => {
    const t0 = Date.now();
    try {
      await deps.pool.query('SELECT 1');
      res.json({ ok: true, base: 'ok', ms: Date.now() - t0, version: deps.version || '', servicio: 'rosanta-nube-sombra2', f2: deps.f2.estado() });
    } catch (e) {
      res.status(503).json({ ok: false, base: 'sin conexion', ms: Date.now() - t0, version: deps.version || '' });
    }
  });

  // Pantallas: se entra con el enlace de siempre (?u=...). La guarda de cada funcion es la de la
  // intranet (cchQuien_, cpeQuien_, requiereEventos_): la pagina sola no muestra datos.
  const pagina = (k) => (req, res) => res.set('Cache-Control', 'no-store').type('html').send(deps.pantallas[k]());
  app.get('/caja', pagina('caja'));
  app.get('/compras', pagina('compras'));
  app.get('/clientes/reservas', pagina('reservas'));
  app.get('/clientes/carritos', pagina('carritos'));

  // ---- Clientes (18-oct-2026): lo que se ve sale de la matriz de accesos (tabla permisos).
  app.get('/api/clientes/partes', exigirUsuario, (req, res) => res.json({ partes: deps.f2.partes ? deps.f2.partes(req.usuario) : [] }));

  /** /clientes: abre la primera parte que esa persona puede ver. */
  app.get('/clientes', async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send('<p style="font-family:sans-serif;padding:16px">No pude identificarte. Entrá con tu enlace de siempre.</p>');
      const partes = deps.f2.partes ? deps.f2.partes(u) : [];
      if (!partes.length) return res.status(403).type('html').send('<p style="font-family:sans-serif;padding:16px">Tu cuenta no tiene la sección Clientes.</p>');
      res.redirect('/clientes/' + partes[0] + '?u=' + encodeURIComponent(String(req.query.u || '')));
    } catch (e) { next(e); }
  });

  /** Eventos y CRM: la plantilla real necesita saber quien entra (rol, si edita), como render_ de la intranet. */
  const vistaConUsuario = (parte) => async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send('<p style="font-family:sans-serif;padding:16px">No pude identificarte. Entrá con tu enlace de siempre.</p>');
      if (!deps.f2.partes || deps.f2.partes(u).indexOf(parte) === -1) return res.status(403).type('html').send('<p style="font-family:sans-serif;padding:16px">Tu cuenta no tiene esta parte de Clientes.</p>');
      res.set('Cache-Control', 'no-store').type('html').send(deps.pantallas[parte]({ usuario: u, authToken: String(req.query.u || '') }));
    } catch (e) { next(e); }
  };
  app.get('/clientes/eventos', vistaConUsuario('eventos'));
  /** Marketing (contenido y pauta): parte 'pauta' de la matriz (dueño y pauta). */
  app.get('/marketing', async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send('<p style="font-family:sans-serif;padding:16px">No pude identificarte. Entrá con tu enlace de siempre.</p>');
      if (!deps.f2.puede || !deps.f2.puede(u, 'pauta')) return res.status(403).type('html').send('<p style="font-family:sans-serif;padding:16px">Tu cuenta no tiene Marketing.</p>');
      res.set('Cache-Control', 'no-store').type('html').send(deps.pantallas.marketing({ usuario: u, authToken: String(req.query.u || '') }));
    } catch (e) { next(e); }
  });
  app.get('/clientes/crm', vistaConUsuario('crm'));
  app.get('/sombra2/fotos', pagina('fotos'));

  app.post('/api/llamar/:nombre', exigirUsuario, async (req, res, next) => {
    const nombre = req.params.nombre;
    const args = Array.isArray(req.body) ? req.body : [];
    try {
      if (nombre === 'anotarTiempoPantalla') {
        if (deps.anotarTiempo) await deps.anotarTiempo({ accion: String(args[0] || '').slice(0, 80), donde: 'pantalla', ms: Math.round(Number(args[1]) || 0), quien: req.usuario.email });
        return res.json({ resultado: null });
      }
      let r;
      try { r = deps.f2.llamar(req.usuario, nombre, args); } catch (e) { return res.status(e.status || 400).json({ error: String(e.message || e) }); }
      if (deps.anotarTiempo) deps.anotarTiempo({ accion: 'Sombra2 · ' + nombre, donde: 'servidor', ms: r.ms, quien: req.usuario.email }).catch(() => {});
      res.json({ resultado: r.resultado });
    } catch (e) { next(e); }
  });

  /** Copia las hojas (reloj refrescar-copia-sombra2). */
  app.post('/tareas/refrescar-copia', exigirTarea, async (req, res, next) => {
    try {
      const t0 = Date.now();
      const resumen = await deps.f2.refrescar();
      res.json({ ok: true, ms: Date.now() - t0, pestanas: resumen, aviso: resumen.aviso || undefined });
    } catch (e) {
      if (e.resumen) return res.status(500).json({ ok: false, error: String(e.message), pestanas: e.resumen });
      next(e);
    }
  });

  /** La comparacion de cada noche (reloj comparar-sombra2-noche). 409 si la copia no coincide. */
  app.post('/tareas/comparar', exigirTarea, async (req, res, next) => {
    try {
      const foto = await deps.comparar();
      res.status(foto.copia_al_dia ? 200 : 409).json({ ok: foto.copia_al_dia, caja: foto.caja, compras: foto.compras,
        eventos: foto.eventos, diferencias: foto.diferencias, avisos: foto.avisos, celdas_error: foto.celdas_error });
    } catch (e) { next(e); }
  });

  app.get('/api/fotos-f2', exigirUsuario, async (req, res, next) => {
    try {
      if (U.normalizarRol(req.usuario.rol) !== 'dueno') return res.status(403).json({ error: 'Solo el dueño ve las fotos de la comparación.' });
      const r = await deps.pool.query(`SELECT to_char(cuando AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS cuando, caja, compras, eventos, clientes,
        copia_al_dia, diferencias, celdas_error FROM caja_fotos ORDER BY id DESC LIMIT 30`);
      res.json({ fotos: r.rows });
    } catch (e) { next(e); }
  });

  // Clientes › Bot y Clientes › Reseñas y encuesta (sesion del bot en sombra, 19-oct-2026).
  require('../clientes2/rutas').montar(app, deps);

  app.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: String(err && err.message || err) });
  });
  return app;
}

module.exports = { crearAppF2 };
