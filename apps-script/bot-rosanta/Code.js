 /**
 * ROSANTA — Bot de WhatsApp + Instagram con Claude
 * Google Apps Script (todo interno, sin plataformas externas)
 *
 * Flujo:  Meta (WhatsApp/Instagram)  ->  este Web App  ->  Claude  ->
 *         respuesta por el mismo canal  +  fila en Google Sheets
 *
 * Antes de usar:
 *   1) Ejecuta una vez la función setup() para guardar tus claves (ver guía).
 *   2) Publica como Web App (Implementar > Nueva implementación > App web).
 *   3) Configura el webhook en Meta con la URL del Web App y el VERIFY_TOKEN.
 *
 * Versión 1 — 14 jun 2026
 */

// ============================================================
//  CONFIG — se leen desde Propiedades del Script (no se escriben aquí)
// ============================================================
const PROPS = PropertiesService.getScriptProperties();

const CONFIG = {
  ANTHROPIC_API_KEY: PROPS.getProperty('ANTHROPIC_API_KEY'),
  CLAUDE_MODEL:      PROPS.getProperty('CLAUDE_MODEL') || 'claude-sonnet-4-6',
  WHATSAPP_TOKEN:    PROPS.getProperty('WHATSAPP_TOKEN'),   // token permanente de la app de Meta
  MESSENGER_TOKEN:   PROPS.getProperty('MESSENGER_TOKEN'),  // page access token (Messenger)
  IG_TOKEN:          PROPS.getProperty('IG_TOKEN'),         // page access token (Instagram)
  VERIFY_TOKEN:      PROPS.getProperty('VERIFY_TOKEN'),     // lo inventas tú; debe coincidir en Meta
  KB_DOC_ID:         PROPS.getProperty('KB_DOC_ID'),        // ID del Google Doc con la base de conocimiento
  SHEET_ID:          PROPS.getProperty('SHEET_ID'),         // ID de la Google Sheet de leads
  GRAPH_VERSION:     PROPS.getProperty('GRAPH_VERSION') || 'v21.0'
};

// ============================================================
//  doGet — verificación del webhook de Meta
// ============================================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p['hub.mode'] === 'subscribe' && p['hub.verify_token'] === CONFIG.VERIFY_TOKEN) {
    return ContentService.createTextOutput(p['hub.challenge']);
  }
  return ContentService.createTextOutput('Forbidden');
}

// ============================================================
//  doPost — recibe los mensajes de WhatsApp e Instagram
// ============================================================
function doPost(e) {
  // --- Guardia del webhook ---
  const _secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  const _tokenOK = e && e.parameter && e.parameter.token === _secret;
  if (!_tokenOK) {
    let _obj = '';
    try { _obj = (JSON.parse(e.postData.contents) || {}).object || ''; } catch (x) {}
    // Bloquea WhatsApp e Instagram sin token. Messenger (page) se deja pasar por ahora
    // (su token en Meta aún no guarda bien; se protegerá cuando se corrija).
    if (_obj === 'whatsapp_business_account' || _obj === 'instagram') {
      Logger.log('WEBHOOK_BLOQUEADO object=' + _obj);
      return ContentService.createTextOutput('no');
    }
    Logger.log('WEBHOOK_SIN_TOKEN_PERMITIDO object=' + _obj);
  }
  // --- fin del guardia ---
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.object === 'whatsapp_business_account') {
      handleWhatsApp(body);
    } else if (body.object === 'instagram') {
      handleInstagram(body);
    } else if (body.object === 'page') {
      handleMessenger(body);
    }
  } catch (err) {
    Logger.log('Error doPost: ' + err);
  }
  // Siempre responde 200 rápido para que Meta no reintente
  return ContentService.createTextOutput('EVENT_RECEIVED');
}

// ============================================================
//  WHATSAPP
// ============================================================
function handleWhatsApp(body) {
  (body.entry || []).forEach(function (entry) {
    (entry.changes || []).forEach(function (change) {
      const value = change.value || {};
      const phoneNumberId = value.metadata && value.metadata.phone_number_id;
      const messages = value.messages || [];
      const contacts = value.contacts || [];
      const name = contacts[0] && contacts[0].profile ? contacts[0].profile.name : '';

      messages.forEach(function (msg) {
        if (msg.type !== 'text') return;                 // por ahora solo texto
        if (alreadyProcessed(msg.id)) return;            // evita duplicados

        const from = msg.from;                           // número del cliente
        const text = msg.text.body;
        // Se registra SIEMPRE, aunque el bot esté en pausa o pase el límite:
        // si no, la consola se queda ciega mientras un humano atiende.
        logMensaje('whatsapp', from, name, 'in', 'cliente', text);
      if (botEnPausa(from)) return; // un humano está atendiendo este chat
        if (!dentroDeLimite(from)) {
          logLead({ canal: 'whatsapp', tipo: 'otro', urgencia: 'frio', resumen: 'Muchos mensajes seguidos — posible loop/spam', accion: 'escalar_humano', requiere_humano: true }, text, from);
          return;
        }

        const firstName = (name || '').split(' ')[0] || '';

        const result = rvCerrar(askClaude('whatsapp', firstName, text, from), 'whatsapp', from);
        sendWhatsApp(phoneNumberId, from, result.respuesta);
        logMensaje('whatsapp', from, name, 'out', 'bot', result.respuesta);
        PROPS.setProperty('WA_PHONE_NUMBER_ID', phoneNumberId);
        logLead(result.lead, text, from, result.respuesta);
        if (result.lead && result.lead.requiere_humano) notificarHumano('whatsapp', result.lead, text, from);
      });
    });
  });
}

function sendWhatsApp(phoneNumberId, to, text) {
  const url = 'https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + phoneNumberId + '/messages';
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text }
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.WHATSAPP_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// ============================================================
//  INSTAGRAM
// ============================================================
function handleInstagram(body) {
  (body.entry || []).forEach(function (entry) {
    (entry.messaging || []).forEach(function (event) {
      if (!event.message) return;
      if (event.message.is_echo) {
        var destinatarioEco = event.recipient && event.recipient.id;
        var textoEco = event.message.text || '';
        if (destinatarioEco && !esEnvioDelBot(destinatarioEco, textoEco)) {
          pausarBot(destinatarioEco, 6);
        }
        return;
      }
      if (!event.message.text) return;
      if (alreadyProcessed(event.message.mid)) return;

      const senderId = event.sender.id;
      const text = event.message.text;
      var nombreIG = nombreInstagram(senderId);
      // Se registra SIEMPRE (ver nota en handleWhatsApp).
      logMensaje('instagram', senderId, nombreIG, 'in', 'cliente', text);
      if (botEnPausa(senderId)) return;
      if (!dentroDeLimite(senderId)) {
        logLead({ canal: 'instagram', tipo: 'otro', urgencia: 'frio', resumen: 'Muchos mensajes seguidos — posible loop/spam', accion: 'escalar_humano', requiere_humano: true }, text, senderId);
        return;
      }

      const result = rvCerrar(askClaude('instagram', (nombreIG || '').split(' ')[0] || '', text, senderId), 'instagram', senderId);
      sendInstagram(senderId, result.respuesta);
      logMensaje('instagram', senderId, nombreIG, 'out', 'bot', result.respuesta);
      logLead(result.lead, text, senderId, result.respuesta);
      if (result.lead && result.lead.requiere_humano) notificarHumano('instagram', result.lead, text, senderId);
    });
  });
}

// Trae el nombre/usuario de Instagram desde el IGSID (cache 6 h)
function nombreInstagram(igsid) {
  if (!igsid) return '';
  var cache = CacheService.getScriptCache();
  var key = 'igname_' + igsid;
  var cached = cache.get(key);
  if (cached) return cached;
  var nombre = '';
  try {
    var url = 'https://graph.instagram.com/' + igsid + '?fields=name,username&access_token=' + encodeURIComponent(CONFIG.IG_TOKEN);
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      nombre = data.name || data.username || '';
    } else {
      Logger.log('nombreInstagram HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText());
    }
  } catch (e) { Logger.log('nombreInstagram error: ' + e); }
  if (nombre) cache.put(key, nombre, 21600);
  return nombre;
}

function sendInstagram(recipientId, text) {
  const url = 'https://graph.instagram.com/' + CONFIG.GRAPH_VERSION + '/me/messages';
  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.IG_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  marcarEnvioBot(recipientId, text);
}

// ============================================================
//  MESSENGER
// ============================================================
function handleMessenger(body) {
  (body.entry || []).forEach(function (entry) {
    (entry.messaging || []).forEach(function (event) {
      if (!event.message) return;
      // ECHO: mensaje que salió de la cuenta (lo mandó el bot o un humano)
      if (event.message.is_echo) {
        var destinatarioEco = event.recipient && event.recipient.id;
        var textoEco = event.message.text || '';
        if (destinatarioEco && !esEnvioDelBot(destinatarioEco, textoEco)) {
          pausarBot(destinatarioEco, 6);
        }
        return;
      }
      if (!event.message.text) return;
      if (alreadyProcessed(event.message.mid)) return;

      const senderId = event.sender.id;   // PSID del cliente
      const text = event.message.text;
      // Se registra SIEMPRE (ver nota en handleWhatsApp).
      logMensaje('messenger', senderId, '', 'in', 'cliente', text);
      if (botEnPausa(senderId)) return;
      if (!dentroDeLimite(senderId)) {
        logLead({ canal: 'messenger', tipo: 'otro', urgencia: 'frio', resumen: 'Muchos mensajes seguidos — posible loop/spam', accion: 'escalar_humano', requiere_humano: true }, text, senderId);
        return;
      }

      const result = rvCerrar(askClaude('messenger', '', text, senderId), 'messenger', senderId);
      sendMessenger(senderId, result.respuesta);
      logMensaje('messenger', senderId, '', 'out', 'bot', result.respuesta);
      logLead(result.lead, text, senderId, result.respuesta);
      if (result.lead && result.lead.requiere_humano) notificarHumano('messenger', result.lead, text, senderId);
    });
  });
}

function sendMessenger(recipientId, text) {
  const url = 'https://graph.facebook.com/' + (CONFIG.GRAPH_VERSION || 'v21.0') + '/me/messages';
  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.MESSENGER_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  marcarEnvioBot(recipientId, text);
}

// ============================================================
//  CLAUDE — construye el prompt, llama a la API y parsea el JSON
// ============================================================
function askClaude(canal, nombre, mensaje, senderId) {
  var _tz = 'America/Guatemala';
  var _dias = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var _meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var _n = new Date();
  var fechaHoy = _dias[Number(Utilities.formatDate(_n, _tz, 'u'))] + ', ' +
    Utilities.formatDate(_n, _tz, 'd') + ' de ' +
    _meses[Number(Utilities.formatDate(_n, _tz, 'M')) - 1] + ' de ' +
    Utilities.formatDate(_n, _tz, 'yyyy') + ', ' +
    Utilities.formatDate(_n, _tz, 'HH:mm') + ' hrs';

  var system = 'FECHA Y HORA ACTUAL (zona Guatemala): ' + fechaHoy +
    '. Usa SIEMPRE esta fecha para saber el día de la semana y el horario; nunca la inventes.\n\n' +
    MASTER_PROMPT
      .replace('{{canal}}', canal)
      .replace('{{nombre}}', nombre || '')
      .replace('{{base_conocimiento}}', getKnowledgeBase());

  var messages = getHistory(senderId).concat([{ role: 'user', content: mensaje }]);
  var rawUltimo = '';

  for (var intento = 1; intento <= 3; intento++) {
    try {
      var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': CONFIG.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify({ model: CONFIG.CLAUDE_MODEL, max_tokens: 2000, system: system, messages: messages }),
        muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      var body = resp.getContentText();
      if (code !== 200) {
        Logger.log('API Anthropic HTTP ' + code + ' (intento ' + intento + '): ' + body);
        Utilities.sleep(800 * intento);
        continue;
      }
      var data = JSON.parse(body);
      var raw = (data.content && data.content[0] && data.content[0].text) || '';
      rawUltimo = raw;
      var json = intentarParseJson(raw);
      if (json && json.respuesta) {
        json.lead = json.lead || {};
        json.lead.canal = canal; // el canal real lo da el webhook; Claude no lo cambia
        saveHistory(senderId, mensaje, JSON.stringify(json));
        return json;
      }
      Logger.log('JSON no parseable (intento ' + intento + '). raw: ' + raw);
    } catch (e) {
      Logger.log('Excepción askClaude (intento ' + intento + '): ' + e);
    }
    Utilities.sleep(800 * intento);
  }

  Logger.log('askClaude: fallback tras 3 intentos. Último raw: ' + rawUltimo);
  var fb = {
    respuesta: 'Gracias por tu mensaje 🌿 En un momento te responde una persona del equipo.',
    lead: { canal: canal, idioma: '', nombre: '', telefono: '', email: '',
      tipo: 'otro', urgencia: 'tibio', resumen: 'No se pudo clasificar automáticamente',
      accion: 'escalar_humano', requiere_humano: true }
  };
  saveHistory(senderId, mensaje, fb.respuesta);
  return fb;
}

function intentarParseJson(raw) {
  try {
    var txt = (raw || '').trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    var start = txt.indexOf('{'), end = txt.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(txt.substring(start, end + 1));
  } catch (e) { return null; }
}
function logLead(lead, mensajeOriginal, recipientId, respuestaBot) {
  const ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Leads');
  if (!sheet) {
    sheet = ss.insertSheet('Leads');
    sheet.appendRow(['Fecha/Hora','Canal','Idioma','Nombre','Teléfono','Tipo','Urgencia','Resumen','Acción','¿Humano?','Mensaje original','ID destino (no tocar)','Respuesta','Enviado']);
  }
  lead = lead || {};
  sheet.appendRow([
    new Date(),                          // A Fecha/Hora
    lead.canal || '',                    // B Canal
    lead.idioma || '',                   // C Idioma
    lead.nombre || '',                   // D Nombre
    lead.telefono || '',                 // E Teléfono
    lead.tipo || '',                     // F Tipo
    lead.urgencia || '',                 // G Urgencia
    lead.resumen || '',                  // H Resumen
    lead.accion || '',                   // I Acción
    lead.requiere_humano ? 'Sí' : 'No',  // J ¿Humano?
    mensajeOriginal || '',               // K Mensaje original
    recipientId || '',                   // L ID destino
    '',                                  // M Respuesta
    '',                                  // N Enviado
    lead.email || '',                    // O Email
    respuestaBot || ''                   // P Respuesta_Bot
  ]);
}

// ============================================================
//  LOG DE CONVERSACIÓN — guarda cada mensaje (cliente y nuestro)
//  para verlos como chat en la consola. Pestaña "Conversaciones".
// ============================================================
function logMensaje(canal, contactoId, nombre, direccion, autor, texto) {
  try {
    var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Conversaciones');
    if (!sh) {
      sh = ss.insertSheet('Conversaciones');
      sh.appendRow(['Fecha/Hora','Canal','ContactoID','Nombre','Direccion','Autor','Texto']);
    }
    sh.appendRow([new Date(), canal || '', String(contactoId || ''), nombre || '', direccion || '', autor || '', texto || '']);
  } catch (e) { Logger.log('logMensaje error: ' + e); }
}

// ============================================================
//  BASE DE CONOCIMIENTO — se lee del Google Doc (cache 10 min)
// ============================================================
function getKnowledgeBase() {
  const cache = CacheService.getScriptCache();
  let kb = cache.get('kb');
  if (kb) return kb;
  kb = DocumentApp.openById(CONFIG.KB_DOC_ID).getBody().getText();
  cache.put('kb', kb, 600); // 10 minutos
  return kb;
}

// ============================================================
//  HISTORIAL breve por cliente (cache 30 min)
// ============================================================
function getHistory(senderId) {
  const raw = CacheService.getScriptCache().get('hist_' + senderId);
  return raw ? JSON.parse(raw) : [];
}
function saveHistory(senderId, userMsg, botMsg) {
  let hist = getHistory(senderId);
  hist.push({ role: 'user', content: userMsg });
  hist.push({ role: 'assistant', content: botMsg });
  if (hist.length > 8) hist = hist.slice(hist.length - 8); // últimos 4 turnos
  CacheService.getScriptCache().put('hist_' + senderId, JSON.stringify(hist), 1800);
}

// ============================================================
//  Anti-duplicados (Meta reintenta el mismo mensaje)
// ============================================================

// Anti-loop: máx 4 respuestas automáticas por contacto cada 3 min
function dentroDeLimite(remitenteId) {
  const cache = CacheService.getScriptCache();
  const key = 'cnt_' + remitenteId;
  const n = parseInt(cache.get(key) || '0', 10) + 1;
  cache.put(key, String(n), 180);
  return n <= 15;
}

function alreadyProcessed(id) {
  if (!id) return false;
  const cache = CacheService.getScriptCache();
  if (cache.get('msg_' + id)) return true;
  cache.put('msg_' + id, '1', 600);
  return false;
}

// ============================================================
//  PROMPT MAESTRO (resumen operativo; la versión editable está en el doc aparte)
//  Las claves {{canal}}, {{nombre}} y {{base_conocimiento}} se rellenan solas.
// ============================================================
const MASTER_PROMPT = [
'Eres el asistente conversacional de Rosanta, un restaurante de gastrococtelería en Antigua Guatemala.',
'Atiendes clientes por WhatsApp e Instagram. Respondes con calidez y precisión, y clasificas cada conversación.',
'',
'PERSONALIDAD: amigable, humana, cercana, natural. Como un amigo que ama la buena comida, no un robot ni un folleto.',
'El cliente es el protagonista; háblale de tú. Nunca empieces con "En Rosanta...". Sin lenguaje rebuscado ni guiones largos.',
'Mensajes cortos, fáciles de leer en el celular. Usa el nombre solo si lo conoces: ' + '{{nombre}}' + '. Máximo 1 emoji.',
'',
'IDIOMA: detecta el idioma del cliente y responde SIEMPRE en ese idioma (español o inglés). Comparte links en el idioma correcto.',
'',
'CANAL: este mensaje llegó por ' + '{{canal}}' + '. Responde por ese mismo canal. NUNCA pidas escribir por el otro canal.',
'',
'FUENTE: responde SOLO con la BASE DE CONOCIMIENTO de abajo. Si algo no está ahí, NO lo inventes; dilo con honestidad y ofrece pasar con una persona. Nunca inventes precios, horarios ni disponibilidad.',
'',
'RESERVAS DE MESA (no son eventos): SÍ las tomas por chat, hasta 15 personas. Necesitas CINCO datos: NOMBRE, CORREO ELECTRÓNICO, FECHA, HORA y NÚMERO DE PERSONAS. Pide de una vez todos los que falten, como lista corta con cada uno en negrita usando asteriscos de WhatsApp (ej. "*Tu nombre:*", "*Correo:*", "*Fecha:*", "*Hora:*", "*Personas:*"). El correo es imprescindible: sin correo no se puede crear la reserva, pídelo siempre desde el principio. Cuando ya tengas los cinco, escribe una línea corta de espera (ej. "Dame un segundo que confirmo la mesa") y marca accion:"crear_reserva", con fecha en formato AAAA-MM-DD y hora en formato 24h. NUNCA digas que la reserva quedó hecha ni la des por confirmada: el sistema la crea y reemplaza tu mensaje con la confirmación real. Si son más de 15 personas es evento privado, trátalo como evento. Si el cliente prefiere reservar solo, comparte el link — Español: https://www.rosanta.rest/reservas — Inglés: https://www.rosanta.rest/reservations.',
'',
'CANCELAR RESERVA: si el cliente quiere cancelar una reserva que ya tiene, SÍ lo haces por chat. No necesitas su nombre ni la fecha: el sistema la busca por su teléfono o su correo. Escribe una línea corta de espera (ej. "Dame un segundo que la busco") y marca accion:"cancelar_reserva", incluyendo email y fecha en el lead SOLO si el cliente los dio. NUNCA digas que la reserva quedó cancelada: el sistema la cancela y reemplaza tu mensaje con el resultado real. Si lo que quiere es CAMBIAR la reserva a otra fecha u hora, cancélala primero y luego tómale la nueva.',
'',
'EVENTOS PRIVADOS (cumpleaños, corporativos, grupos a cotizar): NO los cotizas ni cierras. Recoge la info en DOS pasos, para no abrumar con muchas preguntas juntas:',
  '  PASO 1 — BÁSICOS: si todavía no los tienes, pregunta tipo de evento, fecha tentativa, número de personas, NOMBRE del cliente y CORREO ELECTRÓNICO (imprescindible: la cotización se envía por correo). Presenta los datos que faltan como una lista corta, con cada uno en negrita usando asteriscos de WhatsApp (ej. "*Tu nombre:*", "*Fecha:*", "*Personas:*", "*Correo:*"), para que el cliente los responda uno por uno. En este paso NO menciones los menús todavía.',
  '  PASO 2 — MENÚ: SOLO cuando ya tengas los básicos, presenta los 3 formatos de menú (ver "Formatos de evento" en la base) y pregunta cuál le interesa.',
  'MIENTRAS te falte algún básico (nombre, correo, fecha, personas) o el formato de menú: sigue tú la conversación, requiere_humano:false, accion:“responder_info”. SOLO cuando ya tengas TODO (básicos + formato de menú), confírmale que el equipo le enviará la cotización a su correo y marca requiere_humano:true, accion:“escalar_evento”.',
'EVENTOS PÚBLICOS DEL MES (maridajes, catas, noches temáticas con precio y cupo que aparezcan en la base): SÍ das la info completa tomada de la base y compartes el link de reservas. NO los escalas salvo grupo grande o caso especial. tipo:"evento", requiere_humano:false.',
'',
'ESCALAR A HUMANO (requiere_humano:true) si: es queja, piden algo que no está en la base, o algo fuera de lo normal (prensa, proveedores, facturación especial, pagos). Para EVENTOS privados NO escales automáticamente: maneja la recolección tú mismo y marca requiere_humano:true SOLO cuando ya tengas básicos (nombre, correo, fecha, número de personas) + formato de menú elegido.',
'',
'NO HAGAS: confirmar reservas como definitivas; prometer descuentos/cortesías sin autorización; compartir datos internos; mencionar al cliente el nombre de Juanma ni de ningún empleado (decí siempre "alguien del equipo se comunicará contigo"); salirte del tema del restaurante.',
'',
'FORMATO DE SALIDA: responde SIEMPRE y SOLO con un objeto JSON válido, sin texto antes ni después:',
'{',
'  "respuesta": "<mensaje para el cliente, en su idioma>",',
'  "lead": {',
    '    "canal": "whatsapp | instagram | messenger",',
'    "idioma": "es | en",',
'    "nombre": "<si se conoce, si no vacío>",',
'    "telefono": "<si lo dio, si no vacío>",',
'    "email": "<correo del cliente si lo dio, si no vacío>",',
  '    "fecha": "<fecha de la reserva o del evento en formato AAAA-MM-DD si la dio, si no vacío>",',
  '    "hora": "<hora de la reserva en formato 24h, ej. 20:00, si la dio; si no vacío>",',
  '    "personas": "<número de personas si lo dio, si no vacío>",',
  '    "tipo_evento": "<si es evento: boda, cumplea\u00f1os, brindis, corporativo, baby shower, aniversario, etc.; si no, vac\u00edo>",',
  '    "formato_menu": "<formato elegido: servido individual / compartir / tapas y barra; si no aplica, vacío>",',
'    "tipo": "reserva | evento | consulta | queja | spam | otro",',
'    "urgencia": "caliente | tibio | frio",',
'    "resumen": "<una línea: qué quiere>",',
'    "accion": "crear_reserva | cancelar_reserva | redirigir_reservas | escalar_evento | responder_info | escalar_humano",',
'    "requiere_humano": true/false',
'  }',
'}',
'urgencia: caliente = quiere reservar/agendar ya o pide disponibilidad inmediata; tibio = interesado sin fecha concreta; frio = consulta general o spam.',
'',
'BASE DE CONOCIMIENTO:',
'{{base_conocimiento}}'
].join('\n');

function testBot() {
  const r = askClaude('whatsapp', 'Juanma', '¿A qué hora abren el sábado?', 'test-123');
  Logger.log('RESPUESTA: ' + r.respuesta);
  Logger.log('LEAD: ' + JSON.stringify(r.lead));
  logLead(r.lead, 'PRUEBA: ¿A qué hora abren el sábado?');
}

// ============================================================
//  RESPUESTA HUMANA — envía lo que escribas en la columna "Respuesta"
// ============================================================
function enviarRespuestasPendientes() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  // 1) Respuestas escritas en la hoja Leads (columna Respuesta) — compatibilidad
  const sheet = ss.getSheetByName('Leads');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const canal = data[i][1];        // B
      const idDestino = data[i][11];   // L
      const respuesta = data[i][12];   // M
      const enviado = data[i][13];     // N
      if (respuesta && !enviado && idDestino) {
        try {
          enviarPorCanal(canal, idDestino, respuesta);
          sheet.getRange(i + 1, 14).setValue(new Date());
          logMensaje(canal, idDestino, '', 'out', 'humano', respuesta);
          pausarBot(idDestino, 6);
        } catch (err) {
          sheet.getRange(i + 1, 14).setValue('ERROR: ' + err);
        }
      }
    }
  }

  // 2) Cola de salientes desde la consola tipo chat (pestaña "Salientes")
  //    Encabezados: A Fecha/Hora · B Canal · C ContactoID · D Texto · E Tipo · F Enviado
  const cola = ss.getSheetByName('Salientes');
  if (cola) {
    const d = cola.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      const canal = d[i][1];
      const contactoId = d[i][2];
      const texto = d[i][3];
      const enviado = d[i][5];
      if (texto && contactoId && !enviado) {
        try {
          enviarPorCanal(canal, contactoId, texto);
          cola.getRange(i + 1, 6).setValue(new Date());
          logMensaje(canal, contactoId, '', 'out', 'humano', texto);
          pausarBot(contactoId, 6);
        } catch (err) {
          cola.getRange(i + 1, 6).setValue('ERROR: ' + err);
        }
      }
    }
    archivarSalientes_(ss);
  }
}

// ============================================================
//  ARCHIVADO DE "Salientes" — mueve lo ya enviado a "Salientes_Historico"
//  para que la cola no crezca sin fin (se relee entera cada minuto).
//  Corre al final de enviarRespuestasPendientes(), en la misma ejecución,
//  así nunca se cruza con el envío.
// ============================================================
var ARCHIVO_MIN_FILAS = 50;    // por debajo de esto no se toca nada
var ARCHIVO_DIAS_GRACIA = 1;   // lo enviado hace menos de 24 h se queda a la vista

function archivarSalientes_(sh_ss) {
  try {
    var ss = sh_ss || SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sh = ss.getSheetByName('Salientes');
    if (!sh) return 0;
    var last = sh.getLastRow();
    if (last - 1 < ARCHIVO_MIN_FILAS) return 0;

    var vals = sh.getRange(2, 1, last - 1, 6).getValues();
    var corte = new Date().getTime() - ARCHIVO_DIAS_GRACIA * 86400000;

    // Solo un bloque contiguo desde arriba. Se para en la primera fila que
    // siga pendiente, tenga ERROR o sea reciente: así nada se pierde, y el
    // borrado por arriba no estorba a lo que la consola añade por abajo.
    var n = 0;
    for (var i = 0; i < vals.length; i++) {
      var env = vals[i][5];
      if (!(env instanceof Date) || env.getTime() > corte) break;
      n++;
    }
    if (!n) return 0;

    var hist = ss.getSheetByName('Salientes_Historico');
    if (!hist) {
      hist = ss.insertSheet('Salientes_Historico');
      hist.appendRow(['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']);
    }
    hist.getRange(hist.getLastRow() + 1, 1, n, 6).setValues(vals.slice(0, n));
    SpreadsheetApp.flush();   // el histórico queda guardado ANTES de borrar
    sh.deleteRows(2, n);
    Logger.log('archivarSalientes_: ' + n + ' filas movidas a Salientes_Historico');
    return n;
  } catch (e) {
    Logger.log('archivarSalientes_ error: ' + e);   // nunca rompe el envío
    return 0;
  }
}

// Para lanzarlo a mano desde el editor.
function archivarSalientesAhora() {
  Logger.log('Archivadas ' + archivarSalientes_() + ' filas.');
}

// Envía un texto por el canal correcto
function enviarPorCanal(canal, idDestino, texto) {
  canal = String(canal || '').toLowerCase();
  if (canal === 'instagram') {
    sendInstagram(idDestino, texto);
  } else if (canal === 'messenger') {
    sendMessenger(idDestino, texto);
  } else { // whatsapp por defecto
    sendWhatsApp(PROPS.getProperty('WA_PHONE_NUMBER_ID'), idDestino, texto);
  }
}

function crearTriggerRespuestas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarRespuestasPendientes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarRespuestasPendientes').timeBased().everyMinutes(1).create();
  Logger.log('Trigger creado: revisa la columna Respuesta cada minuto.');
}

function activarWhatsApp() {
  var waba = '4419411291677705';
  var H = { Authorization: 'Bearer ' + CONFIG.WHATSAPP_TOKEN };

  // 1) Suscribir la app a la WABA (para RECIBIR mensajes)
  var s = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + waba + '/subscribed_apps',
    { method: 'post', headers: H, muteHttpExceptions: true });
  Logger.log('subscribed_apps: ' + s.getContentText());

  // 2) Obtener el phone_number_id
  var p = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + waba + '/phone_numbers',
    { headers: H, muteHttpExceptions: true });
  var pid = JSON.parse(p.getContentText()).data[0].id;
  Logger.log('phone_number_id: ' + pid);

  // 3) Registrar el número en Cloud API (para ENVIAR)
  var r = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + pid + '/register',
    { method: 'post', contentType: 'application/json', headers: H,
      payload: JSON.stringify({ messaging_product: 'whatsapp', pin: '197604' }), muteHttpExceptions: true });
  Logger.log('register: ' + r.getContentText());
}
// ===== Pausa del bot por contacto (cuando un humano atiende) =====
function pausarBot(id, horas) {
  if (!id) return;
  var seg = Math.min((horas || 6) * 3600, 21600); // máx 6 h (límite de CacheService)
  CacheService.getScriptCache().put('pausa_' + id, '1', seg);
}
function botEnPausa(id) {
  if (!id) return false;
  return !!CacheService.getScriptCache().get('pausa_' + id);
}


// ===== Distingue si un mensaje saliente lo mandó el bot o un humano =====
function marcarEnvioBot(recipientId, text) {
  CacheService.getScriptCache().put('botmsg_' + recipientId + '_' + hashTexto(text), '1', 600);
}
function esEnvioDelBot(recipientId, text) {
  return !!CacheService.getScriptCache().get('botmsg_' + recipientId + '_' + hashTexto(text));
}
function hashTexto(t) {
  var s = (t || '').substring(0, 200), h = 0;
  for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return String(h);
}

function cotizacionEnviada_(id) {
  var t = PROPS.getProperty('cotiz_' + id);
  if (!t) return false;
  return (Date.now() - parseInt(t, 10)) < 48 * 3600 * 1000;
}
function marcarCotizacionEnviada_(id) {
  PROPS.setProperty('cotiz_' + id, String(Date.now()));
}

function notificarHumano(canal, lead, mensajeOriginal, idDestino) {
  var tipo     = (lead && lead.tipo) || '';
  var urgencia = (lead && lead.urgencia) || '';
  var resumen  = (lead && lead.resumen) || 'Sin resumen';
  var linkHoja = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/edit';
  var linkConsola = PROPS.getProperty('CONSOLE_URL') || '';

  if (tipo === 'evento') {
    if (cotizacionEnviada_(idDestino)) return;
    marcarCotizacionEnviada_(idDestino);
  }

  // Bloque listo para pegar en Presupuestos (solo para eventos)
  var bloqueCotizar = '';
  if (tipo === 'evento') {
    bloqueCotizar =
      '\n--- PARA COTIZAR (pegar en Presupuestos) ---\n' +
      'Cliente: ' + ((lead && lead.nombre) || '') + '\n' +
      'Evento: ' + ((lead && lead.tipo_evento) || tipo) + '\n' +
      'Fecha: ' + ((lead && lead.fecha) || '') + '\n' +
      'Personas: ' + ((lead && lead.personas) || '') + '\n' +
      'Menú: ' + ((lead && lead.formato_menu) || '') + '\n' +
      'Correo: ' + ((lead && lead.email) || '') + '\n' +
      '-------------------------------------------\n';
  }

  // 1) Correo
  try {
    MailApp.sendEmail({
      to: 'restaurante@rosanta.rest',
      subject: '🔔 Lead para atender (' + canal + ') — ' + tipo,
      body:
        'El bot escaló un mensaje que necesita tu atención.\n\n' +
        'Canal: ' + canal + '\n' +
        'Tipo: ' + tipo + '   ·   Urgencia: ' + urgencia + '\n' +
        'Resumen: ' + resumen + '\n' +
        'Mensaje del cliente: ' + (mensajeOriginal || '') + '\n' +
        bloqueCotizar + '\n' +
        'Para responder, abrí la consola:\n' + (linkConsola || linkHoja)
    });
  } catch (e) { Logger.log('Error correo: ' + e); }

  // 2) WhatsApp a tu número
  try {
    var owner = PROPS.getProperty('OWNER_WA');
    var pid   = PROPS.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) {
      sendWhatsApp(pid, owner,
        '🔔 Lead para atender (' + canal + ')\n' +
        'Tipo: ' + tipo + ' · ' + urgencia + '\n' +
        resumen + '\n' +
        'Cliente: ' + (mensajeOriginal || '') +
        bloqueCotizar +
        (linkConsola ? '\n👉 Responder: ' + linkConsola : '\nEntrá a la hoja de Leads para responder.'));
    }
  } catch (e) { Logger.log('Error WhatsApp: ' + e); }
}

// ===== Refresca el token de Instagram (vive 60 días; lo renovamos antes) =====
function refrescarTokenIG() {
  var actual = PROPS.getProperty('IG_TOKEN');
  if (!actual) { Logger.log('No hay IG_TOKEN guardado.'); return; }
  var url = 'https://graph.instagram.com/refresh_access_token'
          + '?grant_type=ig_refresh_token'
          + '&access_token=' + encodeURIComponent(actual);
  try {
    var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    if (resp.getResponseCode() === 200 && data.access_token) {
      PROPS.setProperty('IG_TOKEN', data.access_token);
      Logger.log('Token IG refrescado OK. Vence en ~' + (data.expires_in || '?') + ' s.');
    } else {
      Logger.log('No se pudo refrescar token IG: ' + resp.getContentText());
      MailApp.sendEmail({
        to: 'restaurante@rosanta.rest',
        subject: '⚠️ Token de Instagram no se pudo refrescar',
        body: 'El refresco automático del token IG falló. Respuesta: ' + resp.getContentText()
            + '\nSi el token llega a expirar, hay que regenerarlo a mano en Meta.'
      });
    }
  } catch (e) {
    Logger.log('Error refrescando token IG: ' + e);
  }
}

// ===== Ejecutá esta UNA vez para crear el trigger semanal =====
function crearTriggerTokenIG() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refrescarTokenIG') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refrescarTokenIG').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  Logger.log('Trigger semanal de refresco de token IG creado.');
}

// ===== Activar Messenger: verificar token y suscribir página =====
function activarMessenger() {
  var t = CONFIG.MESSENGER_TOKEN;

  // 1) ¿El token es de PÁGINA? /me debe devolver TU página (no tu usuario)
  var me = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION +
    '/me?fields=id,name&access_token=' + encodeURIComponent(t), { muteHttpExceptions: true });
  Logger.log('me (debe ser tu página): ' + me.getContentText());

  // 2) Suscribir la página a la app para el evento messages
  var pageId = JSON.parse(me.getContentText()).id;
  var sub = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION +
    '/' + pageId + '/subscribed_apps', {
    method: 'post',
    payload: { subscribed_fields: 'messages,messaging_postbacks', access_token: t },
    muteHttpExceptions: true
  });
  Logger.log('subscribed_apps: ' + sub.getContentText());
}

// ===== Obtener Page Access Token permanente desde System User Token =====
function obtenerPageToken() {
  var suToken = CONFIG.MESSENGER_TOKEN; // ahora mismo tiene el token del System User
  var pageId  = '107770048847191';      // tu página Rosanta
  var r = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION +
    '/' + pageId + '?fields=name,access_token&access_token=' + encodeURIComponent(suToken),
    { muteHttpExceptions: true });
  Logger.log(r.getContentText());
}


function probarConversaciones() {
  logMensaje('whatsapp', '50212345678', 'Prueba', 'in', 'cliente', 'mensaje de prueba');
  logMensaje('whatsapp', '50212345678', 'Prueba', 'out', 'bot', 'respuesta de prueba');
  Logger.log('listo, revisa la pestaña Conversaciones');
}