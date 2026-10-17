/**
 * La aplicacion web (Fase 0). Se arma aparte de server.js para que las pruebas la usen con una
 * base de mentira, sin red.
 *
 * deps: { pool, leerUsuariosHoja, claveTareas, version }
 *   - pool: algo con query() y connect() (pg.Pool o el falso de las pruebas)
 *   - leerUsuariosHoja(): devuelve las filas de la hoja USUARIOS
 *   - claveTareas: la clave que deben traer las tareas automaticas (cabecera x-rosanta-tarea)
 */
const express = require('express');
const crypto = require('crypto');
const U = require('./usuarios');

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function crearApp(deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  /** El enlace de siempre: ?u=<token>, o la cabecera x-rosanta-u desde la pantalla. */
  async function quien(req) {
    const t = req.get('x-rosanta-u') || req.query.u;
    return t ? U.usuarioPorToken(deps.pool, t) : null;
  }

  function exigirUsuario(req, res, next) {
    quien(req).then((u) => {
      if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
      req.usuario = u;
      next();
    }).catch(next);
  }

  function exigirTarea(req, res, next) {
    if (!iguales(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    next();
  }

  /** Salud: responde aunque nadie este identificado; no devuelve datos de nadie. */
  app.get('/salud', async (req, res) => {
    const t0 = Date.now();
    try {
      const r = await deps.pool.query('SELECT count(*)::int AS n FROM usuarios');
      res.json({ ok: true, base: 'ok', usuarios: r.rows[0].n, ms: Date.now() - t0, version: deps.version || '' });
    } catch (e) {
      res.status(503).json({ ok: false, base: 'sin conexion', ms: Date.now() - t0, version: deps.version || '' });
    }
  });

  app.get('/yo', exigirUsuario, (req, res) => {
    const u = req.usuario;
    res.json({ nombre: u.nombre, rol: u.rol, modulos: u.modulos });
  });

  /** Copia la hoja USUARIOS a la base. La llama una tarea (o Claude a mano) con la clave. */
  app.post('/tareas/sincronizar-usuarios', exigirTarea, async (req, res, next) => {
    try {
      const filas = await deps.leerUsuariosHoja();
      const usuarios = U.usuariosDeFilas(filas);
      if (!usuarios.length) return res.status(422).json({ error: 'La hoja USUARIOS vino vacia: no se toco la base.' });
      const n = await U.guardarUsuarios(deps.pool, usuarios);
      res.json({ ok: true, usuarios: n, con_enlace: usuarios.filter((u) => u.token_huella).length });
    } catch (e) { next(e); }
  });

  app.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: String(err && err.message || err) });
  });

  return app;
}

module.exports = { crearApp };
