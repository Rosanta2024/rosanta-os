/**
 * Servicio del bot en sombra (19-oct-2026).
 *
 * Cada noche (reloj comparar-bot-noche) reproduce los chats del dia anterior con el codigo real del bot
 * y guarda la comparacion en la base (bot_corridas, bot_turnos; migracion 030), ya anonimizada.
 *
 *   - Modo 'grabado' (siempre, gratis): si la tuberia del bot se aparta de lo que hizo el bot real en un
 *     mensaje atendido por la MISMA version, es una falla: la tarea responde 409 y llega la alerta.
 *   - Modo 'modelo' (solo si existe la clave ANTHROPIC_SOMBRA): el modelo de verdad decide. Sus
 *     diferencias se muestran, no alertan (el modelo no contesta dos veces igual).
 *
 * Lee la copia de Rosanta Leads que ya guarda la sombra 2 (hojas_copia_f2, solo lectura).
 */
const fs = require('fs');
const path = require('path');
const { armarChats, crearAnonimizador } = require('./conversaciones');
const { reproducirChat, resumir, compararTurno } = require('./reproductor');

// Tope de mensajes al modelo en la comparación de cada noche (Central, 20-oct-2026: el espacio "Sombra nube" tiene US$10/mes).
const MAX_MODELO_NOCHE = Number(process.env.MAX_MODELO_NOCHE || 15);
const LEADS_ID = '1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc';   // Rosanta Leads
const KB_DOC_ID = '1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I';   // base de conocimiento del bot (Google Doc)
const COPIA_VIEJA_MS = 2 * 3600 * 1000;
const DIA_MS = 86400000;
const PRECIO = { entrada: 2 / 1e6, salida: 10 / 1e6 };   // claude-sonnet-5-5, US$ por token (19-oct-2026)

/** La version del bot copiada: "@58 · 2026-10-17T10:16:30-06:00 · 4eae1b3". Desde esa hora la comparacion vale. */
function versionBot() {
  const t = fs.readFileSync(path.join(__dirname, '..', 'bot-rosanta', 'VERSION.txt'), 'utf8').trim().split('\n')[0].trim();
  const m = t.match(/@(\d+)\s*·\s*(\S+)/);
  return { texto: t, numero: m ? Number(m[1]) : null, desde: m ? Date.parse(m[2]) : 0 };
}

/** Medianoche de Guatemala del dia de `ms` (Guatemala no tiene horario de verano: UTC-6 fijo). */
function medianocheGt(ms) {
  const d = new Date(ms - 6 * 3600 * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 6 * 3600 * 1000;
}

/** Claude de verdad, sincrono (el bot espera la respuesta como UrlFetchApp). Junta lo gastado en `gasto`. */
function crearClaudeModelo(clave, gasto) {
  return function (cuerpo, aux) {
    const r = aux.fetchSincrono('https://api.anthropic.com/v1/messages', { method: 'post', headers: aux.headers, payload: JSON.stringify(cuerpo) }, { CLAVE_HIJO: clave });
    let body = r.t;
    if (r.c !== 200) { gasto.fallas = (gasto.fallas || 0) + 1; gasto.ultimoError = 'HTTP ' + r.c + ' ' + String(r.t).slice(0, 160); }
    try {
      const j = JSON.parse(r.t);
      if (j.usage) {
        gasto.llamadas++;
        gasto.entrada += j.usage.input_tokens || 0;
        gasto.salida += j.usage.output_tokens || 0;
      }
      body = j;
    } catch (e) { /* el bot maneja la respuesta rota como siempre */ }
    return { code: r.c, body };
  };
}

/**
 * crearServicioBot({ pool, kb, claveModelo }) — kb(): Promise<string> (texto del Doc); claveModelo: la clave
 * de Anthropic de la sombra o '' (sin ella no hay modo 'modelo').
 */
function crearServicioBot(deps) {
  const pool = deps.pool;

  async function leerCopia() {
    const r = await pool.query("SELECT pestana, filas, leida FROM hojas_copia_f2 WHERE libro = $1 AND pestana IN ('Conversaciones', 'Leads')", [LEADS_ID]);
    const p = {};
    let leida = null;
    r.rows.forEach((x) => { p[x.pestana] = x.filas; if (!leida || x.leida < leida) leida = x.leida; });
    if (!p.Conversaciones || !p.Leads) throw new Error('La base no tiene la copia de Rosanta Leads (la guarda la sombra 2).');
    return { conversaciones: p.Conversaciones, leads: p.Leads, leida };
  }

  /**
   * reproducir({ modo, desde, hasta, maxModelo }) → { corrida, resumen, ... }. Guarda todo en la base.
   * desde/hasta en ms. Solo compara mensajes desde que se publico la version copiada.
   */
  async function reproducir(op) {
    const o = op || {};
    const v = versionBot();
    const modo = o.modo === 'modelo' ? 'modelo' : 'grabado';
    if (modo === 'modelo' && !deps.claveModelo) throw new Error('Falta la clave ANTHROPIC_SOMBRA: el modo con el modelo no esta encendido.');
    const desde = Math.max(o.desde || 0, v.desde);
    const hasta = o.hasta || Date.now();
    const copia = await leerCopia();
    const an = crearAnonimizador();
    let chats = armarChats(copia.conversaciones, copia.leads, { desde: new Date(desde), hasta: new Date(hasta), anonimizador: an });
    const gasto = { llamadas: 0, entrada: 0, salida: 0, fallas: 0 };
    let kb = '';
    let claudeModelo = null;
    if (modo === 'modelo') {
      kb = await deps.kb();
      claudeModelo = deps.crearClaude ? deps.crearClaude(gasto) : crearClaudeModelo(deps.claveModelo, gasto);   // crearClaude: solo pruebas
      // Tope de gasto: solo los primeros maxModelo mensajes del rango van al modelo; el resto queda fuera de la corrida.
      let cupo = o.maxModelo || 40;
      chats = chats.filter((c) => { const n = c.eventos.filter((e) => e.tipo === 'cliente' && e.enRango).length; if (n > cupo) return false; cupo -= n; return true; });
    }
    const t0 = Date.now();
    const resultados = chats.map((c) => reproducirChat(c, { modo, kb, claudeModelo }));
    const resumen = resumir(resultados);
    // Si el modelo no contesto, el bot responde su mensaje de respaldo: esa corrida no dice nada de las decisiones.
    if (modo === 'modelo') { resumen.modeloFallas = gasto.fallas; resumen.modeloLlamadas = gasto.llamadas; if (gasto.fallas) resumen.modeloError = gasto.ultimoError; }
    resumen.ms = Date.now() - t0;
    resumen.seguimientos = resultados.reduce((a, r) => ({ real: a.real + r.seguimientos.filter((s) => s.real).length,
      sombra: a.sombra + r.seguimientos.filter((s) => s.sombra).length }), { real: 0, sombra: 0 });
    const costo = gasto.entrada * PRECIO.entrada + gasto.salida * PRECIO.salida;
    const ins = await pool.query(
      'INSERT INTO bot_corridas (modo, desde, hasta, version_bot, copia_leida, resumen, gasto, costo_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [modo, new Date(desde), new Date(hasta), v.texto, copia.leida, JSON.stringify(resumen), JSON.stringify(gasto), costo.toFixed(4)]);
    const corrida = ins.rows[0].id;
    for (const r of resultados) {
      for (const t of r.turnos) {
        await pool.query('INSERT INTO bot_turnos (corrida, chat, canal, nombre, t, cliente, real, sombra, diferencias) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [corrida, r.id, r.canal, r.nombre, new Date(t.t), t.cliente, JSON.stringify(t.real || {}), JSON.stringify(t.sombra), JSON.stringify(compararTurno(t))]);
      }
    }
    const errores = resultados.reduce((a, r) => a.concat(r.errores.map((e) => r.id + ': ' + e)), []);
    return { corrida, modo, version: v.texto, desde, hasta, copiaLeida: copia.leida, resumen, errores, gasto, costoUsd: Number(costo.toFixed(4)) };
  }

  /** La tarea de cada noche: el dia anterior (Guatemala). 409 si la tuberia se aparto o la copia esta vieja. */
  async function compararNoche(ahora) {
    const n = ahora || Date.now();
    const hasta = medianocheGt(n);
    const desde = hasta - DIA_MS;
    const g = await reproducir({ modo: 'grabado', desde, hasta });
    const problemas = [];
    if (!g.copiaLeida || n - new Date(g.copiaLeida).getTime() > COPIA_VIEJA_MS) problemas.push('La copia de Rosanta Leads tiene mas de 2 horas.');
    if (g.errores.length) problemas.push(g.errores.length + ' errores al reproducir: ' + g.errores.slice(0, 3).join(' | '));
    // "El bot real no contesto" puede ser que Juanma escribio desde la app de Instagram (la pausa la pone el eco de
    // Meta, que no queda en Conversaciones): se muestra, no alerta. Todo lo demas, en modo grabado, es falla.
    const graves = g.resumen.diferencias.filter((d) => d.dif.some((x) => x !== 'la sombra contestó y el bot real no'));
    if (graves.length) problemas.push(graves.length + ' mensajes en que la sombra no hizo lo mismo que el bot real (modo grabado).');
    let m = null;
    if (deps.claveModelo) {
      try { m = await reproducir({ modo: 'modelo', desde, hasta, maxModelo: MAX_MODELO_NOCHE }); } catch (e) { m = { error: e.message }; }
      if (m.error) problemas.push('El modo con el modelo no corrio: ' + m.error);
      else if (m.resumen.modeloFallas) problemas.push('Claude no contesto ' + m.resumen.modeloFallas + ' veces (' + m.resumen.modeloError + '): revisar la clave anthropic-sombra.');
    }
    return { ok: problemas.length === 0, problemas, grabado: g, modelo: m };
  }

  return { reproducir, compararNoche, leerCopia };
}

module.exports = { crearServicioBot, versionBot, medianocheGt, crearClaudeModelo, LEADS_ID, KB_DOC_ID, PRECIO };
