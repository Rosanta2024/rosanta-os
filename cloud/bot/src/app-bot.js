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

/** deps: { servicio, claveTareas, version, modeloEncendido } y, solo en vivo: { vivo, correo, pool, verifyToken, webhookSecret, secretoReservas } */
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

  // El texto de la base de conocimiento que lee el bot (el Doc), para correr la bateria de evals con la misma base.
  app.get('/tareas/kb', tarea(async (req, res) => {
    if (!deps.kb) return res.status(404).json({ error: 'Sin lector de la base de conocimiento.' });
    res.type('text').send(await deps.kb());
  }));

  // A mano: { modo: 'grabado'|'modelo', desde, hasta (ISO), maxModelo }
  app.post('/tareas/reproducir', tarea(async (req, res) => {
    const b = req.body || {};
    const r = await deps.servicio.reproducir({ modo: b.modo, desde: b.desde ? Date.parse(b.desde) : 0, hasta: b.hasta ? Date.parse(b.hasta) : 0,
      maxModelo: Math.min(Number(b.maxModelo) || 40, 200) });
    res.json({ corrida: r.corrida, modo: r.modo, version: r.version, costoUsd: r.costoUsd, errores: r.errores.slice(0, 20),
      resumen: Object.assign({}, r.resumen, { diferencias: r.resumen.diferencias.slice(0, 50) }) });
  }));

  // ---------------- Modo en vivo (19-oct-2026): SOLO si el servidor arranco con MODO_BOT=vivo (deps.vivo). Si no, no existen.
  if (deps.vivo) montarVivo(app, deps, tarea);
  // ---------------- Canal de correo (20-oct-2026): con MODO_CORREO=si (deps.canalCorreo). El interruptor decide apps | sombra | nube.
  if (deps.canalCorreo) montarCorreo(app, deps, tarea);

  return app;
}

/** El webhook de Meta y las tareas del bot en vivo. deps: { vivo, correo, pool, verifyToken, webhookSecret } */
function montarVivo(app, deps, tarea) {
  // Verificacion del webhook (lo mismo que doGet del bot).
  app.get('/webhook', (req, res) => {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && iguales(q['hub.verify_token'], deps.verifyToken)) return res.type('text').send(String(q['hub.challenge'] || ''));
    res.status(403).type('text').send('Forbidden');
  });
  // Un mensaje de Meta: se contesta 200 enseguida (como doPost) y se atiende en orden, uno a la vez.
  app.post('/webhook', (req, res) => {
    const cuerpo = req.body || {};
    const conToken = iguales(req.query.token, deps.webhookSecret);
    res.type('text').send('EVENT_RECEIVED');
    // La misma guarda que doPost: WhatsApp e Instagram sin el token del webhook no se atienden ni se reenvian.
    if (!conToken && (cuerpo.object === 'whatsapp_business_account' || cuerpo.object === 'instagram')) {
      deps.pool.query("INSERT INTO bot_eventos (objeto, modo, resultado) VALUES ($1, 'sin_token', 'ignorado')", [cuerpo.object]).catch(() => {});
      return;
    }
    deps.vivo.recibir(cuerpo, { token: req.query.token }).catch((e) => console.error('webhook:', e.message));
  });
  // Cada minuto: Salientes de la consola, "devolver al bot", chats que vuelven al bot y correos pendientes.
  app.post('/tareas/bot-minuto', tarea(async (req, res) => {
    const r = await deps.vivo.minuto();
    const correos = deps.correo ? await deps.correo.reintentar() : 0;
    res.status(r.error ? 500 : 200).json(Object.assign({ correosReintentados: correos }, r));
  }));
  // El interruptor 'bot' (puente | vivo) vive en la tabla interruptores y lo cambia el guion del día único (cuenta de migraciones).
  // Una sola vez, el dia del paso: las Propiedades del bot de Apps Script (sin claves) pasan a la base.
  app.post('/tareas/importar-estado-bot', tarea(async (req, res) => {
    const props = (req.body || {}).props || {};
    const SECRETAS = require('./vivo').SECRETAS;
    let n = 0, omitidas = 0;
    for (const k of Object.keys(props)) {
      if (SECRETAS.includes(k) || /^INTERRUPTOR_/.test(k) || /TOKEN|KEY|SECRET/i.test(k)) { omitidas++; continue; }
      await deps.pool.query(`INSERT INTO bot_estado (clave, tipo, valor) VALUES ($1, 'prop', $2)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, tipo = 'prop', actualizado = now()`, [k, String(props[k])]);
      n++;
    }
    res.json({ ok: true, guardadas: n, clavesOmitidas: omitidas });
  }));
  // Cada noche, 21:30 (reloj, solo en vivo): el resumen de lo que hizo el bot.
  app.post('/tareas/resumen-bot', tarea(async (req, res) => {
    const r = await deps.vivo.resumen();
    res.status(r.error ? 500 : 200).json(r);
  }));
  // Reservas pedidas por el restaurante (scripts/reserva-bot.js): el mismo secreto que el ?accion=reserva del bot (WIX_RESERVAS_SECRETO).
  app.post('/reserva', async (req, res) => {
    const b = req.body || {};
    if (!iguales(b.secreto, deps.secretoReservas)) return res.status(403).json({ ok: false, motivo: 'SECRETO_INVALIDO' });
    const p = Object.assign({}, b);
    delete p.secreto;
    try { res.json(await deps.vivo.reserva(p)); } catch (e) { console.error('reserva:', e.message); res.status(500).json({ ok: false, motivo: 'excepcion' }); }
  });
  // Una vez por semana (reloj, solo en vivo): renovar el token de Instagram y guardarlo en Secret Manager.
  app.post('/tareas/refrescar-token-ig', tarea(async (req, res) => {
    const r = await deps.refrescarIg();
    res.status(r.ok ? 200 : 500).json(r);
  }));
  // Para vigilar el paso: los ultimos mensajes y que paso con cada uno.
  app.get('/tareas/bot-eventos', tarea(async (req, res) => {
    const r = await deps.pool.query(`SELECT id, to_char(recibido AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI:SS') AS recibido, objeto, modo, resultado, envios, ms, error
      FROM bot_eventos ORDER BY id DESC LIMIT 50`);
    res.json(r.rows);
  }));
}

/** El canal de correo. deps: { canalCorreo, pool } */
function montarCorreo(app, deps, tarea) {
  // Lo pregunta el bot de Apps Script (@64) en cada vuelta: si la respuesta es 'nube', se hace a un lado.
  // Sin clave a propósito: solo dice el modo (apps | sombra | nube), nada de clientes.
  app.get('/correo/quien', async (req, res) => {
    try { res.json({ modo: await deps.canalCorreo.modo() }); } catch (e) { res.status(500).json({ error: 'sin base' }); }
  });
  // Cada 5 minutos (Cloud Scheduler).
  app.post('/tareas/correo-minuto', tarea(async (req, res) => {
    const r = await deps.canalCorreo.minuto();
    res.status(r.error ? 500 : 200).json(r);
  }));
  // Cada noche: lo que anotó la sombra contra lo que hizo el bot de Apps Script en Gmail. 409 = diferencia grave o error (llega la alerta).
  app.post('/tareas/comparar-correo-noche', tarea(async (req, res) => {
    const r = await deps.canalCorreo.comparar();
    if (!r.ok) console.error('comparar-correo-noche: ' + r.distintas.filter((d) => d.grave).map((d) => d.id + ' ' + d.comparado)
      .concat(r.errores.map((e) => e.id + ' error ' + e.error)).join(' | '));
    res.status(r.ok ? 200 : 409).json(r);
  }));
  // El interruptor 'bot_correo' (apps | sombra | nube) vive en la tabla interruptores: lo cambia el guion del día único.
}

module.exports = { crearAppBot, iguales };
