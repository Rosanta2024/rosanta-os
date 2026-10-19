/**
 * Juez con Claude para lo subjetivo (19-oct-2026): tono, fiel a la base, responde lo preguntado, no finge ver una foto.
 * Una llamada por turno con todos sus criterios. Modelo barato (Haiku 5.5) y salida JSON con esquema.
 *
 * La clave NO pasa por aquí: el pedido sale por fetchSincrono (motor-bot.js), que pone la clave en un proceso
 * aparte desde la variable de entorno (CLAVE_HIJO). Sin clave, el juez no corre y esas reglas quedan "sin juez".
 */
const MODELO_JUEZ = 'claude-haiku-5-5';
const PRECIO_JUEZ = { entrada: 0.10 / 1e6, salida: 0.50 / 1e6 };   // US$ por token (prompts < 100K)

const CRITERIOS = {
  tono: 'Tono de Rosanta: cálido, cercano y natural, trata al cliente de tú, mensajes cortos fáciles de leer en el celular, sin lenguaje de robot ni de folleto, no empieza con "En Rosanta". Ante una queja: empatía sin excusas.',
  fiel_a_la_base: 'Todo dato concreto de la respuesta (horarios según el día de la semana del mensaje, precios, platos, servicios, políticas) coincide con la BASE DE CONOCIMIENTO. Si algo no está en la base, lo dice con honestidad en vez de inventarlo. Falla si inventa o contradice la base.',
  responde_lo_preguntado: 'Contesta todo lo que el cliente preguntó en su último mensaje (si preguntó dos cosas, las dos).',
  no_finge_ver_foto: 'El cliente mandó una foto que el bot NO puede ver. Pasa si la respuesta no describe ni da por entendida la foto (pregunta qué es, o lo pasa a una persona). Falla si actúa como si la hubiera visto.'
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function esquema(ids) {
  return {
    type: 'object', additionalProperties: false, required: ['criterios'],
    properties: { criterios: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'ok', 'motivo'],
      properties: { id: { type: 'string', enum: ids }, ok: { type: 'boolean' }, motivo: { type: 'string' } } } } }
  };
}

/** Arma el pedido para un turno. contexto: [{de, texto}] (los mensajes previos, cortos). */
function pedido({ ids, kb, contexto, cliente, respuesta, t, canal }) {
  const d = new Date(Date.parse(t) - 6 * 3600e3);   // hora de Guatemala
  const cuando = DIAS[d.getUTCDay()] + ' ' + d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16);
  const system = 'Eres un evaluador estricto y justo de las respuestas del asistente de chat de Rosanta, un restaurante en Antigua Guatemala. ' +
    'Calificas UNA respuesta del asistente según los criterios que se te dan. Para cada criterio devuelve ok (true/false) y un motivo de una línea en español. ' +
    'No califiques nada que no esté en los criterios.' + (ids.includes('fiel_a_la_base') ? '\n\nBASE DE CONOCIMIENTO DEL ASISTENTE:\n' + kb : '');
  const conv = contexto.slice(-6).map((m) => (m.de === 'cliente' ? 'Cliente' : m.de === 'juanma' ? 'Juanma' : 'Asistente') + ': ' + m.texto.slice(0, 600)).join('\n');
  const user = 'Canal: ' + canal + '. Fecha y hora del mensaje (Guatemala): ' + cuando + '.\n\n' +
    (conv ? 'CONVERSACIÓN PREVIA:\n' + conv + '\n\n' : '') +
    'ÚLTIMO MENSAJE DEL CLIENTE:\n' + cliente + '\n\nRESPUESTA DEL ASISTENTE A CALIFICAR:\n' + respuesta + '\n\nCRITERIOS:\n' +
    ids.map((i) => '- ' + i + ': ' + CRITERIOS[i]).join('\n');
  return {
    model: MODELO_JUEZ, max_tokens: 2000, system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema(ids) } }
  };
}

/**
 * crearJuez({ fetchSincrono, clave, gasto, sinCupo }) → juzgar(args) → { id: {ok, motivo} } | null
 * gasto: { llamadas, entrada, salida, usd } (se va sumando). Si sinCupo() da true (tope de la corrida), deja de llamar.
 */
function crearJuez(o) {
  return function juzgar(args) {
    if (o.sinCupo && o.sinCupo()) return null;
    const cuerpo = pedido(args);
    const r = o.fetchSincrono('https://api.anthropic.com/v1/messages', {
      method: 'post', headers: { 'content-type': 'application/json', 'x-api-key': '$CLAVE', 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(cuerpo)
    }, { CLAVE_HIJO: o.clave });
    let j;
    try { j = JSON.parse(r.t); } catch (e) { return { _error: 'HTTP ' + r.c }; }
    if (j.usage) {
      o.gasto.llamadas++;
      o.gasto.entrada += j.usage.input_tokens || 0;
      o.gasto.salida += j.usage.output_tokens || 0;
      o.gasto.usd = o.gasto.entrada * PRECIO_JUEZ.entrada + o.gasto.salida * PRECIO_JUEZ.salida;
    }
    if (r.c !== 200) return { _error: 'HTTP ' + r.c + ' ' + String((j.error && j.error.message) || '').slice(0, 120) };
    if (j.stop_reason === 'refusal') return { _error: 'el juez declinó' };
    const txt = ((j.content || []).find((b) => b.type === 'text') || {}).text || '';
    try {
      const out = {};
      JSON.parse(txt).criterios.forEach((c) => { out[c.id] = { ok: c.ok, motivo: c.motivo }; });
      return out;
    } catch (e) { return { _error: 'respuesta del juez ilegible' }; }
  };
}

module.exports = { crearJuez, CRITERIOS, MODELO_JUEZ, PRECIO_JUEZ, pedido };
