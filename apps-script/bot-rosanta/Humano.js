/**
 * ROSANTA · BOT — PASO A JUANMA Y VUELTA AL BOT
 * Archivo ADITIVO (15-oct-2026). Prefijo hum.
 *
 * Decisiones de Juanma (15-oct-2026):
 *   1. Cuando el bot le pasa un chat, se CALLA hasta que Juanma conteste.
 *      Excepción: en eventos solo avisa y sigue juntando presupuesto y menú.
 *   2. Juanma contesta desde la consola. Cuando termina, el bot retoma:
 *      con el botón "Devolver al bot" de la consola, o solo cuando Juanma lleva
 *      30 minutos sin escribir en ese chat.
 *   3. Al retomar, el bot escribe PRIMERO un mensaje de seguimiento, sabiendo lo
 *      que Juanma habló (lo lee de Conversaciones). Solo dentro de las 24 h desde
 *      el último mensaje del cliente (regla de WhatsApp e Instagram).
 *
 * Estado por contacto en Propiedades del script (sobrevive más de 6 h, a
 * diferencia de la caché): hum_<contactoId> = {estado, canal, desde, ultimoHumano}
 *   estado 'esperando'  → el bot escaló y espera a Juanma (máx. 24 h)
 *   estado 'atendiendo' → Juanma ya escribió; el bot espera a que termine
 */

var HUM_MIN_INACTIVO = 30;            // minutos sin que Juanma escriba → retoma el bot
var HUM_HORAS_ESPERA_MAX = 24;        // si Juanma nunca contesta, el estado se descarta
var HUM_HORAS_VENTANA = 24;           // Meta solo deja escribir 24 h después del último mensaje del cliente
var HUM_MSGS_CONTEXTO = 16;           // mensajes de Conversaciones que se le dan al modelo al retomar

function humClave_(contactoId) { return 'hum_' + String(contactoId); }

function humLeer_(contactoId) {
  try {
    var raw = PROPS.getProperty(humClave_(contactoId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function humGuardar_(contactoId, st) {
  PROPS.setProperty(humClave_(contactoId), JSON.stringify(st));
}
function humBorrar_(contactoId) {
  PROPS.deleteProperty(humClave_(contactoId));
}

/** ¿El bot debe callarse en este chat? (lo usa botEnPausa) */
function humCallado_(contactoId) {
  var st = humLeer_(contactoId);
  if (!st) return false;
  if (st.estado === 'esperando' &&
      Date.now() - Number(st.desde || 0) > HUM_HORAS_ESPERA_MAX * 3600000) {
    humBorrar_(contactoId);
    fichaEstadoBot_(st.canal, contactoId, '');
    return false;
  }
  return true;
}

/** El bot le pasó el chat a Juanma. En eventos no se calla. Devuelve true si se calló. */
function humEscalar_(canal, contactoId, lead) {
  if (!contactoId || !lead || !lead.requiere_humano) return false;
  if (canal === 'correo') return false;                 // en correo Juanma ya revisa cada borrador
  if (lead.tipo === 'evento' || lead.accion === 'escalar_evento') return false;
  if (humLeer_(contactoId)) return true;           // ya estaba en manos de Juanma
  humGuardar_(contactoId, { estado: 'esperando', canal: canal, desde: Date.now(), ultimoHumano: 0 });
  fichaEstadoBot_(canal, contactoId, 'Esperando a Juanma');
  return true;
}

/** Juanma acaba de mandar un mensaje desde la consola. */
function humAtendiendo_(canal, contactoId) {
  if (!contactoId) return;
  var st = humLeer_(contactoId) || { canal: canal, desde: Date.now() };
  st.estado = 'atendiendo';
  st.canal = String(canal || st.canal || 'whatsapp').toLowerCase();
  st.ultimoHumano = Date.now();
  humGuardar_(contactoId, st);
  fichaEstadoBot_(st.canal, contactoId, 'Juanma atendiendo');
}

/**
 * Corre cada minuto (al final de enviarRespuestasPendientes): devuelve al bot los
 * chats en los que Juanma lleva 30 min sin escribir. "Devolver al bot" de la consola
 * llega por Salientes (Tipo 'devolver') y llama humRetomar_ directo.
 */
function humRevisar_() {
  try {
    var props = PROPS.getProperties();
    Object.keys(props).forEach(function (k) {
      if (k.indexOf('hum_') !== 0) return;
      var id = k.substring(4), st;
      try { st = JSON.parse(props[k]); } catch (e) { return; }
      if (st.estado === 'atendiendo' &&
          Date.now() - Number(st.ultimoHumano || 0) >= HUM_MIN_INACTIVO * 60000) {
        humRetomar_(st.canal, id, 'inactivo');
      } else if (st.estado === 'esperando') {
        humCallado_(id);                            // descarta los que pasaron 24 h
      }
    });
  } catch (e) { Logger.log('humRevisar_: ' + e); }
}

/** El bot vuelve al chat y escribe primero. motivo: 'boton' | 'inactivo' */
function humRetomar_(canal, contactoId, motivo) {
  var st = humLeer_(contactoId);
  canal = String(canal || (st && st.canal) || 'whatsapp').toLowerCase();
  humBorrar_(contactoId);
  try { CacheService.getScriptCache().remove('pausa_' + contactoId); } catch (e) {}
  fichaEstadoBot_(canal, contactoId, '');

  var conv = humConversacion_(canal, contactoId);
  if (!conv.length) { Logger.log('humRetomar_: sin conversación para ' + contactoId); return null; }
  var ultimoIn = 0;
  conv.forEach(function (m) { if (m.direccion === 'in') ultimoIn = Math.max(ultimoIn, m.fecha); });
  if (!ultimoIn || Date.now() - ultimoIn > HUM_HORAS_VENTANA * 3600000) {
    Logger.log('humRetomar_: pasaron más de 24 h desde el último mensaje del cliente; el bot retoma sin escribir.');
    return null;
  }

  var hist = humHistoria_(conv);
  var nota = '(Nota del sistema, no la escribió el cliente.) Juanma atendió este chat en persona y ' +
    (motivo === 'boton' ? 'te lo devolvió.' : 'ya terminó de escribir.') +
    ' Escribe UN mensaje corto de seguimiento para el cliente, en su idioma: retoma el siguiente paso que quedó ' +
    'pendiente (por ejemplo, los datos que faltan para la reserva o el evento) o, si no queda nada pendiente, ' +
    'pregúntale con calidez si puedes ayudarle con algo más. Si el cliente escribió algo que nadie contestó, ' +
    'contéstalo. No repitas lo que Juanma ya dijo, no te presentes de nuevo y no contradigas lo que Juanma prometió. ' +
    'Si la conversación quedó cerrada (el cliente se despidió o agradeció y no hay nada pendiente), deja "respuesta" vacía.';
  CacheService.getScriptCache().put('hist_' + contactoId, JSON.stringify(hist.slice(-8)), 1800);

  var nombre = '';
  conv.forEach(function (m) { if (m.nombre) nombre = m.nombre; });
  var r0 = askClaude(canal, (nombre || '').split(' ')[0] || '', nota, contactoId, { permitirVacia: true });
  if (!r0 || !String(r0.respuesta || '').trim() || !r0._modelo) {
    Logger.log('humRetomar_: el modelo decidió no escribir (o falló); el bot queda atento al siguiente mensaje.');
    return null;
  }
  var respuestaModelo = r0.respuesta;
  var result = rvCerrar(r0, canal, contactoId);
  result.botones = btDecidir_(result, contactoId, false, respuestaModelo);

  btEnviar_(canal, contactoId, result.respuesta, result.botones, PROPS.getProperty('WA_PHONE_NUMBER_ID'));
  logMensaje(canal, contactoId, nombre, 'out', 'bot', btTextoLog_(result));
  logLead(result.lead, '(seguimiento del bot tras Juanma)', contactoId, result.respuesta);
  fichaActualizar_(canal, contactoId, nombre, result.lead);
  if (result.lead && result.lead.requiere_humano) {
    notificarHumano(canal, result.lead, '(seguimiento del bot tras Juanma)', contactoId);   // vuelve a callarse
  }
  return result;
}

/** Últimos mensajes del chat desde la pestaña Conversaciones, del más viejo al más nuevo. */
function humConversacion_(canal, contactoId) {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Conversaciones');
  if (!sh || sh.getLastRow() < 2) return [];
  var n = Math.min(sh.getLastRow() - 1, 3000);    // basta con lo reciente
  var vals = sh.getRange(sh.getLastRow() - n + 1, 1, n, 7).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[2]) !== String(contactoId)) continue;
    if (String(r[1] || '').toLowerCase() !== canal) continue;
    out.push({ fecha: r[0] ? new Date(r[0]).getTime() : 0, nombre: String(r[3] || ''),
      direccion: String(r[4] || '').toLowerCase(), autor: String(r[5] || '').toLowerCase(), texto: String(r[6] || '') });
  }
  return out.slice(-HUM_MSGS_CONTEXTO);
}

/** Convierte la conversación en turnos para el modelo (alternados, empieza con el cliente). */
function humHistoria_(conv) {
  var turnos = [];
  conv.forEach(function (m) {
    var rol = m.direccion === 'in' ? 'user' : 'assistant';
    var texto = m.texto.replace(/\n\[Botones: [^\]]*\]$/, '');
    if (rol === 'assistant') {
      texto = JSON.stringify(m.autor === 'humano'
        ? { respuesta: texto, nota_sistema: 'Este mensaje lo escribió Juanma en persona, no el bot.' }
        : { respuesta: texto });
    }
    var ult = turnos[turnos.length - 1];
    if (ult && ult.role === rol) {
      if (rol === 'user') ult.content += '\n' + texto;
      else ult.content = humUnirAsistente_(ult.content, texto);
    } else {
      turnos.push({ role: rol, content: texto });
    }
  });
  while (turnos.length && turnos[0].role !== 'user') turnos.shift();
  if (turnos.length && turnos[turnos.length - 1].role === 'user') {
    // askClaude agrega la nota como el último mensaje del cliente: hay que cerrar con un turno del asistente
    turnos.push({ role: 'assistant', content: JSON.stringify({ respuesta: '', nota_sistema: 'Sin respuesta todavía.' }) });
  }
  return turnos;
}
function humUnirAsistente_(a, b) {
  try {
    var ja = JSON.parse(a), jb = JSON.parse(b);
    return JSON.stringify({ respuesta: [ja.respuesta, jb.respuesta].filter(String).join('\n'),
      nota_sistema: [ja.nota_sistema, jb.nota_sistema].filter(Boolean).join(' ') || undefined });
  } catch (e) { return a + '\n' + b; }
}

/** Escribe el estado del bot en la ficha (columna estado_bot), para que la consola lo muestre. */
function fichaEstadoBot_(canal, contactoId, valor) {
  try {
    var sh = fichaHoja_();
    var col = FICHA_COLS.indexOf('estado_bot') + 1;
    var celda = sh.getRange('A:A').createTextFinder(canal + '|' + contactoId).matchEntireCell(true).findNext();
    if (celda) sh.getRange(celda.getRow(), col).setValue(valor || '');
    else if (valor) fichaActualizar_(canal, contactoId, '', { tipo: '' }, { estado_bot: valor });
  } catch (e) { Logger.log('fichaEstadoBot_: ' + e); }
}
