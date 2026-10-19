/**
 * Rutas de Clientes › Bot y Clientes › Reseñas y encuesta (19-oct-2026). Se montan en la app de la
 * sombra 2 con UNA linea en app-f2.js: require('../clientes2/rutas').montar(app, deps).
 *
 * Se entra con el enlace de siempre (?u=). Quien ve cada parte lo decide la matriz (deps.f2.puede).
 */
const U = require('../usuarios');
const { crearServicioClientes2 } = require('./servicio');
const pant = require('./pantallas');

function montar(app, deps) {
  const servicio = crearServicioClientes2({ pool: deps.pool, copia: () => (deps.f2.copia ? deps.f2.copia() : {}), puede: (u, p) => !!(deps.f2.puede && deps.f2.puede(u, p)) });
  const html = { consola: pant.armarConsola(), resenas: pant.armarResenas(), sombra: pant.armarBotSombra(), encuesta: pant.armarEncuesta() };
  const quien = (req) => { const t = req.get('x-rosanta-u') || req.query.u; return t ? U.usuarioPorToken(deps.pool, t) : Promise.resolve(null); };
  const NO = (msg) => '<p style="font-family:sans-serif;padding:16px">' + msg + '</p>';

  const pagina = (parte, k) => async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).type('html').send(NO('No pude identificarte. Entrá con tu enlace de siempre.'));
      if (!deps.f2.puede || !deps.f2.puede(u, parte)) return res.status(403).type('html').send(NO('Tu cuenta no tiene esta parte de Clientes.'));
      res.set('Cache-Control', 'no-store').type('html').send(html[k]);
    } catch (e) { next(e); }
  };
  app.get('/clientes/consola', pagina('consola', 'consola'));
  app.get('/clientes/consola/sombra', pagina('consola', 'sombra'));
  app.get('/clientes/resenas', pagina('resenas', 'resenas'));
  app.get('/clientes/resenas/encuesta', pagina('resenas', 'encuesta'));

  app.post('/api/clientes2/:parte/:nombre', async (req, res, next) => {
    try {
      const u = await quien(req);
      if (!u) return res.status(401).json({ error: 'No pude identificarte. Volvé a entrar con tu enlace.' });
      let r;
      try { r = await servicio.llamar(u, req.params.parte, req.params.nombre, Array.isArray(req.body) ? req.body : []); }
      catch (e) { return res.status(e.status || 400).json({ error: String(e.message || e) }); }
      res.json({ resultado: r === undefined ? null : r });
    } catch (e) { next(e); }
  });
  return servicio;
}

module.exports = { montar };
