/**
 * Los receptores de Wix en la nube (20-oct-2026, orden del dia unico): carritos y reservas.
 *
 *   POST /hooks/carrito?token=…&hook=carrito   lo manda el formulario de reservas de la pagina PUBLICA
 *                                              (sendBeacon con text/plain, o fetch no-cors).
 *   POST /hooks/reserva?token=…&hook=reserva   lo manda backend/crmReservas.js de Wix (JSON).
 *
 * Viven en rosanta-nube (el servicio que queda), no en uno de sombra: si se borra o renombra el
 * servicio, Wix queda apuntando a la nada y Juanma tiene que volver a tocar el Editor.
 *
 * Interruptor por modulo en la base (tabla interruptores, migracion 013; caché de 30 s):
 *   hooks_carrito / hooks_reserva = 'puente' (por defecto, y si la tabla o la fila no existen)
 *     → reenvia el cuerpo LIMPIO al /exec viejo de Marketing OS (con la misma llave) y devuelve su respuesta.
 *       Asi Juanma puede cambiar las URLs de Wix durante la sombra sin que cambie nada.
 *   'base' → lo atiende deps.enBase(hook, cuerpo) (CRMSync en la base; se monta cuando este listo).
 *       Mientras no haya enBase, 'base' se comporta como 'puente'. Volver atras = poner 'puente'.
 * Cada pedido aceptado se guarda en hooks_wix_recibidos (si la tabla existe): sirve para comparar
 * cada noche y para reproducir lo historico.
 *
 * Llaves: hook=carrito contra el secreto wix-hook-carrito y hook=reserva contra wix-hook-reserva (rotadas
 * por la sesion C; ver tokensDelEntorno). La de carritos igual queda a la vista en la pagina PUBLICA de Wix:
 * no se trata como secreto.
 * Por eso: cuerpo con forma fija y tamaño maximo, limite de pedidos por minuto (por IP y total), y lo
 * unico que puede hacer es crear un carrito. El de reservas va por backend y si es secreto.
 */
const express = require('express');

const EXEC_URL = 'https://script.google.com/macros/s/AKfycbzEv9C1gZ6-bODUyI2a5TPCtLVQGt5T-7gQs60TP8OYmDgymZTHQuv3hR-232cng7K3/exec';
const MODOS = ['puente', 'base'];
const CACHE_MS = 30 * 1000;
const MAX_CUERPO = '16kb';

/** Texto corto y sin caracteres de control. */
function texto(v, max) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? null : s;
}
function numero(v, max) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** El carrito tal como lo arma el formulario de Wix. Devuelve el cuerpo limpio, o un error. */
function limpiarCarrito(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'cuerpo invalido' };
  const extra = Object.keys(b).filter((k) => ['nombre', 'email', 'telefono', 'valor', 'consentimiento', 'fecha'].indexOf(k) === -1);
  if (extra.length) return { error: 'campos de mas' };
  const c = {
    nombre: texto(b.nombre, 120), email: texto(b.email, 160), telefono: texto(b.telefono, 40),
    valor: numero(b.valor, 100000), consentimiento: texto(b.consentimiento, 3), fecha: texto(b.fecha, 10)
  };
  if (Object.keys(c).some((k) => c[k] === null)) return { error: 'campo invalido' };
  if (!c.nombre || !(c.email || c.telefono)) return { error: 'falta nombre o contacto' };
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return { error: 'correo invalido' };
  if (c.telefono && !/^[0-9+()\s.-]{6,40}$/.test(c.telefono)) return { error: 'telefono invalido' };
  if (c.consentimiento && ['SI', 'NO'].indexOf(c.consentimiento.toUpperCase()) === -1) return { error: 'consentimiento invalido' };
  if (c.fecha && !FECHA.test(c.fecha)) return { error: 'fecha invalida' };
  return { cuerpo: c };
}

/** La reserva tal como la arma backend/crmReservas.js. */
function limpiarReserva(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'cuerpo invalido' };
  const extra = Object.keys(b).filter((k) => ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'].indexOf(k) === -1);
  if (extra.length) return { error: 'campos de mas' };
  const c = {
    id: texto(b.id, 80), fecha: texto(b.fecha, 10), nombre: texto(b.nombre, 160), email: texto(b.email, 160),
    telefono: texto(b.telefono, 40), personas: numero(b.personas, 500), gasto: numero(b.gasto, 1000000),
    estado: texto(b.estado, 40), optin: texto(b.optin, 3)
  };
  if (Object.keys(c).some((k) => c[k] === null)) return { error: 'campo invalido' };
  if (!c.id && !c.email && !c.telefono) return { error: 'reserva sin id ni contacto' };
  if (c.fecha && !FECHA.test(c.fecha)) return { error: 'fecha invalida' };
  return { cuerpo: c };
}

/** Ventana de un minuto: cuantos pedidos por clave. */
function crearLimite(porMinuto, ahora) {
  const cuenta = new Map();
  return (clave) => {
    const t = ahora(), v = cuenta.get(clave);
    if (!v || t - v.desde >= 60000) { cuenta.set(clave, { desde: t, n: 1 }); if (cuenta.size > 5000) cuenta.clear(); return true; }
    v.n += 1;
    return v.n <= porMinuto;
  };
}

/**
 * deps: { pool, tokens (por defecto, del entorno: tokensDelEntorno), execUrl, fetch, enBase, ahora,
 *         limites: { carritoIp, carritoTotal, reservaTotal } }
 */
function montarHooks(app, deps) {
  const ahora = deps.ahora || Date.now;
  const fetchFn = deps.fetch || fetch;
  const execUrl = deps.execUrl || EXEC_URL;
  const tokens = deps.tokens || tokensDelEntorno(process.env);
  const lim = Object.assign({ carritoIp: 10, carritoTotal: 60, reservaTotal: 120 }, deps.limites || {});
  const limites = { carritoIp: crearLimite(lim.carritoIp, ahora), carritoTotal: crearLimite(lim.carritoTotal, ahora), reservaTotal: crearLimite(lim.reservaTotal, ahora) };
  const cache = {};

  async function modo(hook) {
    const k = 'hooks_' + hook, c = cache[k];
    if (c && ahora() - c.t < CACHE_MS) return c.v;
    let v = 'puente';
    try {
      const r = await deps.pool.query('SELECT modo FROM interruptores WHERE modulo = $1', [k]);
      if (r.rows[0] && MODOS.indexOf(r.rows[0].modo) !== -1) v = r.rows[0].modo;
    } catch (e) { /* sin tabla todavia: puente */ }
    cache[k] = { t: ahora(), v };
    return v;
  }

  async function guardar(hook, cuerpo, m, estado, ms, respuesta) {
    try {
      await deps.pool.query('INSERT INTO hooks_wix_recibidos (hook, cuerpo, modo, estado, ms, respuesta) VALUES ($1, $2, $3, $4, $5, $6)',
        [hook, JSON.stringify(cuerpo), m, estado, ms, String(respuesta || '').slice(0, 500)]);
    } catch (e) { /* sin tabla todavia: no frena al cliente */ }
  }

  // El /exec viejo acepta las mismas llaves (sesion C, 20-oct): se reenvia con la que llego.
  async function puente(hook, cuerpo, token) {
    const ctl = new AbortController();
    const tope = setTimeout(() => ctl.abort(), 25000);
    try {
      // Apps Script responde 302 a googleusercontent: fetch lo sigue con GET, que es como se lee la respuesta.
      const r = await fetchFn(execUrl + '?token=' + encodeURIComponent(token) + '&hook=' + hook,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), redirect: 'follow', signal: ctl.signal });
      const t = await r.text();
      let j; try { j = JSON.parse(t); } catch (e) { j = { error: 'respuesta no JSON del puente', estado: r.status }; }
      return { estado: r.ok && !j.error ? 200 : 502, json: j, texto: t };
    } catch (e) {
      return { estado: 502, json: { error: 'el puente no contesto' }, texto: String(e && e.message || e) };
    } finally { clearTimeout(tope); }
  }

  // El error del lector (cuerpo grande o mal codificado) se contesta aca: el manejador general de app.js lo volveria 500.
  const lector = express.text({ type: () => true, limit: MAX_CUERPO });
  const leerCuerpo = (req, res, next) => lector(req, res, (err) => (err ? res.status(err.status === 413 ? 413 : 400).json({ error: 'cuerpo invalido' }) : next()));

  function receptor(hook, limpiar, pasaLimite) {
    return [leerCuerpo, async (req, res, next) => {
      try {
        res.set('Cache-Control', 'no-store');
        if (!pasaLimite(req)) return res.status(429).json({ error: 'demasiados pedidos' });
        const validos = tokens[hook] || [];
        if (!validos.length || validos.indexOf(String(req.query.token || '')) === -1) return res.status(401).json({ error: 'unauthorized' });
        let b = req.body;
        if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { return res.status(400).json({ error: 'cuerpo no JSON' }); } }
        const l = limpiar(b);
        if (l.error) return res.status(400).json({ error: l.error });
        const t0 = ahora();
        const m = await modo(hook);
        const r = (m === 'base' && deps.enBase) ? await deps.enBase(hook, l.cuerpo) : await puente(hook, l.cuerpo, String(req.query.token));
        await guardar(hook, l.cuerpo, m === 'base' && deps.enBase ? 'base' : 'puente', r.estado, ahora() - t0, r.texto || JSON.stringify(r.json));
        res.status(r.estado).json(r.json);
      } catch (e) { next(e); }
    }];
  }

  const ip = (req) => String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
  app.post('/hooks/carrito', receptor('carrito', limpiarCarrito, (req) => limites.carritoTotal('t') && limites.carritoIp(ip(req))));
  app.post('/hooks/reserva', receptor('reserva', limpiarReserva, () => limites.reservaTotal('t')));
  return { modo };
}

/**
 * Llaves desde el entorno. En Cloud Run salen de Secret Manager (las crea el Estudio; los valores no pasan
 * por el chat): --set-secrets HOOK_TOKENS_CARRITO=wix-hook-carrito:latest,HOOK_TOKENS_RESERVA=wix-hook-reserva:latest
 * Sin llave, ese receptor contesta 401 a todo.
 */
function tokensDelEntorno(env) {
  const lista = (v) => String(v || '').split(',').map((s) => s.trim()).filter((s) => s.length >= 8);
  return { carrito: lista(env.HOOK_TOKENS_CARRITO), reserva: lista(env.HOOK_TOKENS_RESERVA) };
}

module.exports = { montarHooks, limpiarCarrito, limpiarReserva, tokensDelEntorno, EXEC_URL };
