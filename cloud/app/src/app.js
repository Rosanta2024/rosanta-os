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
      res.json({ ok: true, base: 'ok', usuarios: r.rows[0].n, ms: Date.now() - t0, version: deps.version || '', pagos: deps.pagos ? deps.pagos.estado() : null });
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

  // ---- Pagos (Fase 1) -----------------------------------------------------------------------
  /** La misma pantalla de Pagos de la intranet. Se entra con el enlace de siempre: /pagos?u=... */
  app.get('/pagos', (req, res) => {
    if (!deps.pantallaPagos) return res.status(404).send('No disponible.');
    res.set('Cache-Control', 'no-store').type('html').send(deps.pantallaPagos());
  });

  app.get('/pagos/fotos', (req, res) => {
    if (!deps.pantallaFotos) return res.status(404).send('No disponible.');
    res.set('Cache-Control', 'no-store').type('html').send(deps.pantallaFotos());
  });

  // Caja chica y Compras (modo en vivo de Caja, 18-oct-2026): las mismas pantallas de la intranet
  app.get('/caja', (req, res) => { if (!deps.pantallaCaja) return res.status(404).send('No disponible.'); res.set('Cache-Control', 'no-store').type('html').send(deps.pantallaCaja()); });
  app.get('/compras', (req, res) => { if (!deps.pantallaCompras) return res.status(404).send('No disponible.'); res.set('Cache-Control', 'no-store').type('html').send(deps.pantallaCompras()); });

  /** Un cierre del dia que manda el lector de la intranet (motor_cierres = base). body: { fila: [...] } */
  app.post('/tareas/cierre', exigirTarea, async (req, res, next) => {
    try {
      if (!deps.pagos || !deps.pagos.guardarCierre) return res.status(404).json({ error: 'No disponible.' });
      const fila = req.body && req.body.fila;
      if (!Array.isArray(fila)) return res.status(400).json({ error: 'Falta la fila del cierre.' });
      const r = await deps.pagos.guardarCierre(fila);
      res.json({ ok: true, fecha: r.fecha, nuevo: r.nuevo });
    } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
  });

  /** google.script.run.<nombre>(AUTH, ...args) de la pantalla llega aca. */
  app.post('/api/llamar/:nombre', exigirUsuario, async (req, res, next) => {
    const nombre = req.params.nombre;
    const args = Array.isArray(req.body) ? req.body : [];
    try {
      if (nombre === 'anotarTiempoPantalla') {   // GuardadoEstado.html: cuanto tardo el ✓ en la pantalla
        if (deps.anotarTiempo) await deps.anotarTiempo({ accion: String(args[0] || '').slice(0, 80), donde: 'pantalla', ms: Math.round(Number(args[1]) || 0), quien: req.usuario.email });
        return res.json({ resultado: null });
      }
      if (!deps.pagos) return res.status(404).json({ error: 'No disponible.' });
      let r;
      try { r = await deps.pagos.llamar(req.usuario, nombre, args); } catch (e) { return res.status(e.status || 400).json({ error: String(e.message || e) }); }
      if (deps.anotarTiempo) deps.anotarTiempo({ accion: 'Pagos · ' + nombre, donde: 'servidor', ms: r.ms, quien: req.usuario.email }).catch(() => {});
      res.json({ resultado: r.resultado });
    } catch (e) { next(e); }
  });

  /** Vuelve a copiar las hojas que lee Pagos. La llama el reloj cada 15 min (o Claude a mano). */
  app.post('/tareas/refrescar-copia', exigirTarea, async (req, res, next) => {
    try {
      const t0 = Date.now();
      const r = await deps.pagos.refrescar();
      // si la importacion encontro problemas (conflicto, fila sin ID, una que falta en la hoja), 409: el reloj avisa
      const mal = r.importacion && r.importacion.problemas.length > 0;
      const malCaja = (r.importacion_caja || []).some((x) => x.problemas && x.problemas.length);
      res.status(mal || malCaja ? 409 : 200).json({ ok: !(mal || malCaja), ms: Date.now() - t0, modo: r.modo, en_vivo: r.en_vivo, interruptor: r.interruptor,
        pestanas: r.pestanas, importacion: r.importacion, importacion_caja: r.importacion_caja, copia_hoja: r.copia_hoja });
    } catch (e) { next(e); }
  });

  /** La comparacion de cada noche. 409 si la copia no coincide con las hojas (el reloj lo marca y avisa). */
  app.post('/tareas/comparar-pagos', exigirTarea, async (req, res, next) => {
    try {
      const foto = await deps.compararPagos();
      res.status(foto.copia_al_dia ? 200 : 409).json({ ok: foto.copia_al_dia, por_pagar_n: foto.por_pagar_n, por_pagar_q: foto.por_pagar_q,
        vence_hoy: foto.vence_hoy, diferencias: foto.diferencias, celdas_error: foto.celdas_error });
    } catch (e) { next(e); }
  });

  /**
   * Conciliacion del cierre de mes (19-oct-2026). Cuerpo opcional {mes: 'AAAA-MM'}; sin mes, el que toca
   * (del 28 en adelante el mes en curso, antes el anterior). Con una diferencia, 409: el reloj avisa por correo.
   */
  app.post('/tareas/conciliar-mes', exigirTarea, async (req, res, next) => {
    try {
      if (!deps.conciliarMes) return res.status(404).json({ error: 'No disponible.' });
      const mes = req.body && req.body.mes;
      if (mes !== undefined && !/^\d{4}-\d{2}$/.test(String(mes))) return res.status(400).json({ error: 'El mes va como AAAA-MM.' });
      const r = await deps.conciliarMes(mes);
      res.status(r.ok ? 200 : 409).json(r);
    } catch (e) { next(e); }
  });

  /** Las conciliaciones de mes guardadas. Solo el dueño. */
  app.get('/api/conciliaciones', exigirUsuario, async (req, res, next) => {
    try {
      if (U.normalizarRol(req.usuario.rol) !== 'dueno') return res.status(403).json({ error: 'Solo el dueño ve las conciliaciones.' });
      const r = await deps.pool.query(`SELECT to_char(cuando AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS cuando, mes, ok, totales, diferencias, avisos
        FROM conciliaciones ORDER BY id DESC LIMIT 24`);
      res.json({ conciliaciones: r.rows });
    } catch (e) { next(e); }
  });

  /** Las fotos de las ultimas noches, para comparar con la intranet. Solo el dueño. */
  app.get('/api/fotos-pagos', exigirUsuario, async (req, res, next) => {
    try {
      if (U.normalizarRol(req.usuario.rol) !== 'dueno') return res.status(403).json({ error: 'Solo el dueño ve las fotos de la comparación.' });
      const r = await deps.pool.query(`SELECT to_char(cuando AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS cuando, por_pagar_n, por_pagar_q::float AS por_pagar_q,
        vence_hoy, copia_al_dia, diferencias, celdas_error FROM pagos_fotos ORDER BY id DESC LIMIT 30`);
      res.json({ fotos: r.rows });
    } catch (e) { next(e); }
  });

  // la entrada del telefono (/intranet) y los iconos de Rosanta (/marca): de la sesion de la Fase 2, 19-oct
  require('./entrada').montarEntrada(app);
  // los receptores de Wix (reserva y carrito), con su interruptor puente | base: de la Fase 2, 20-oct
  require('./hooks-wix').montarHooks(app, { pool: deps.pool });
  // procesos de fondo en la nube (20-oct): FEL y banco por correo, y "Leer cierres". Cada uno con su interruptor
  // en PARAMETROS (proc_fel, proc_banco, proc_cierres = apps | sombra | nube); sin la cuenta de Google, avisan.
  require('./proc-fel-banco').montarProcesos(app, { pool: deps.pool, claveTareas: deps.claveTareas, cuentaGoogle: deps.cuentaGoogle, sheetsEscritura: deps.sheetsEscritura });
  require('./proc-cierres').montar(app, { pool: deps.pool, pagos: deps.pagos, cuenta: deps.cuentaGoogle ? deps.cuentaGoogle() : null, claveTareas: deps.claveTareas });

  app.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: String(err && err.message || err) });
  });

  return app;
}

module.exports = { crearApp };
