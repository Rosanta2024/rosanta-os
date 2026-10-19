/**
 * Rutas de rosanta-bot-sombra (19-oct-2026). No hay pantallas aqui (van en Clientes, en la sombra 2) ni
 * webhook de Meta: este servicio solo reproduce y compara. Todo, salvo /salud, pide la clave de tareas.
 */
const express = require('express');
const crypto = require('crypto');

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** deps: { servicio, claveTareas, version, modeloEncendido } */
function crearAppBot(deps) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/salud', (req, res) => res.json({ ok: true, servicio: 'rosanta-bot-sombra', revision: deps.version, modelo: !!deps.modeloEncendido }));

  const tarea = (fn) => async (req, res) => {
    if (!iguales(req.get('x-rosanta-tarea'), deps.claveTareas)) return res.status(403).json({ error: 'Clave de tarea invalida.' });
    try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  };

  // Reloj comparar-bot-noche: el dia anterior. 409 = la sombra se aparto del bot real o la copia esta vieja (llega la alerta).
  app.post('/tareas/comparar-bot-noche', tarea(async (req, res) => {
    const r = await deps.servicio.compararNoche();
    const corto = { ok: r.ok, problemas: r.problemas,
      grabado: { corrida: r.grabado.corrida, resumen: Object.assign({}, r.grabado.resumen, { diferencias: r.grabado.resumen.diferencias.length }) },
      modelo: r.modelo && (r.modelo.error ? { error: r.modelo.error } : { corrida: r.modelo.corrida, costoUsd: r.modelo.costoUsd,
        resumen: Object.assign({}, r.modelo.resumen, { diferencias: r.modelo.resumen.diferencias.length }) }) };
    if (!r.ok) console.error('comparar-bot-noche: ' + r.problemas.join(' | '));
    res.status(r.ok ? 200 : 409).json(corto);
  }));

  // A mano: { modo: 'grabado'|'modelo', desde, hasta (ISO), maxModelo }
  app.post('/tareas/reproducir', tarea(async (req, res) => {
    const b = req.body || {};
    const r = await deps.servicio.reproducir({ modo: b.modo, desde: b.desde ? Date.parse(b.desde) : 0, hasta: b.hasta ? Date.parse(b.hasta) : 0,
      maxModelo: Math.min(Number(b.maxModelo) || 40, 200) });
    res.json({ corrida: r.corrida, modo: r.modo, version: r.version, costoUsd: r.costoUsd, errores: r.errores.slice(0, 20),
      resumen: Object.assign({}, r.resumen, { diferencias: r.resumen.diferencias.slice(0, 50) }) });
  }));

  return app;
}

module.exports = { crearAppBot, iguales };
