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
  IG_TOKEN:         PROPS.getProperty('IG_TOKEN'),          // page access token (Instagram)
  VERIFY_TOKEN:      PROPS.getProperty('VERIFY_TOKEN'),     // lo inventas tú; debe coincidir en Meta
  KB_DOC_ID:         PROPS.getProperty('KB_DOC_ID'),        // ID del Google Doc con la base de conocimiento
  SHEET_ID:          PROPS.getProperty('SHEET_ID'),         // ID de la Google Sheet de leads
  GRAPH_VERSION:     PROPS.getProperty('GRAPH_VERSION') || 'v21.0',
  ALERT_EMAIL:       PROPS.getProperty('ALERT_EMAIL') || 'restaurante@rosanta.rest'  // a dónde llegan las alertas de leads calientes/eventos
};

// ============================================================
//  setup() — ejecútalo UNA vez para guardar tus claves
//  (rellena los valores, corre la función, y luego BORRA las claves de aquí)
// ============================================================
function setup() {
  PROPS.setProperties({
    ANTHROPIC_API_KEY: 'sk-ant-...........',     // tu API key de Claude
    CLAUDE_MODEL:      'claude-sonnet-4-6',
    WHATSAPP_TOKEN:    'EAAG...........',         // token de WhatsApp Cloud API
    IG_TOKEN:          'EAAG...........',         // page access token de Instagram
    VERIFY_TOKEN:      'rosanta-verifica-2026',   // inventa uno y úsalo igual en Meta
    KB_DOC_ID:         'ID_DEL_GOOGLE_DOC_KB',
    SHEET_ID:          'ID_DE_LA_GOOGLE_SHEET',
    GRAPH_VERSION:     'v21.0',
    ALERT_EMAIL:       'restaurante@rosanta.rest'  // correo donde quieres recibir los avisos
  });
  Logger.log('Propiedades guardadas. Ya puedes borrar los valores de setup().');
}

// ============================================================
//  setAlertEmail() — agrega o cambia SOLO el correo de alertas
//  Úsalo si ya tenías el bot funcionando y solo quieres activar
//  las alertas, SIN tocar tus claves ya guardadas.
//  Rellena el correo, ejecuta SOLO esta función, y listo.
// ============================================================
function setAlertEmail() {
  PROPS.setProperty('ALERT_EMAIL', 'restaurante@rosanta.rest');
  Logger.log('ALERT_EMAIL guardado: ' + PROPS.getProperty('ALERT_EMAIL'));
}

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
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.object === 'whatsapp_business_account') {
      handleWhatsApp(body);
    } else if (body.object === 'instagram' || body.object === 'page') {
      handleInstagram(body);
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
        const firstName = (name || '').split(' ')[0] || '';

        const result = askClaude('whatsapp', firstName, text, from);
        sendWhatsApp(phoneNumberId, from, result.respuesta);
        logLead(result.lead, text);
        sendAlertIfNeeded(result.lead, text, from);
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
      if (!event.message || !event.message.text) return;   // ignora reacciones, lecturas, echos
      if (event.message.is_echo) return;                    // ignora mensajes propios
      if (alreadyProcessed(event.message.mid)) return;

      const senderId = event.sender.id;                     // IGSID del cliente
      const text = event.message.text;

      const result = askClaude('instagram', '', text, senderId);
      sendInstagram(senderId, result.respuesta);
      logLead(result.lead, text);
      sendAlertIfNeeded(result.lead, text, senderId);
    });
  });
}

function sendInstagram(recipientId, text) {
  const url = 'https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/me/messages';
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
}

// ============================================================
//  CLAUDE — construye el prompt, llama a la API y parsea el JSON
// ============================================================
function askClaude(canal, nombre, mensaje, senderId) {
  const system = MASTER_PROMPT
    .replace('{{canal}}', canal)
    .replace('{{nombre}}', nombre || '')
    .replace('{{base_conocimiento}}', getKnowledgeBase());

  // Historial breve para contexto (últimos turnos guardados en cache 30 min)
  const history = getHistory(senderId);
  const messages = history.concat([{ role: 'user', content: mensaje }]);

  const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: CONFIG.CLAUDE_MODEL,
      max_tokens: 1024,
      system: system,
      messages: messages
    }),
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());
  let raw = (data.content && data.content[0] && data.content[0].text) || '';

  const parsed = parseClaudeJson(raw, canal);

  // Guarda el turno en el historial
  saveHistory(senderId, mensaje, parsed.respuesta);

  return parsed;
}

// Extrae el JSON aunque venga con texto alrededor; si falla, responde seguro
function parseClaudeJson(raw, canal) {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = JSON.parse(raw.substring(start, end + 1));
    if (!json.respuesta) throw new Error('sin respuesta');
    json.lead = json.lead || {};
    json.lead.canal = json.lead.canal || canal;
    return json;
  } catch (err) {
    Logger.log('No se pudo parsear JSON de Claude: ' + err + ' | raw: ' + raw);
    return {
      respuesta: 'Gracias por tu mensaje 🌿 En un momento te responde una persona del equipo.',
      lead: {
        canal: canal, idioma: '', nombre: '', telefono: '',
        tipo: 'otro', urgencia: 'tibio',
        resumen: 'No se pudo clasificar automáticamente',
        accion: 'escalar_humano', requiere_humano: true
      }
    };
  }
}

// ============================================================
//  GOOGLE SHEETS — registra cada lead
// ============================================================
function logLead(lead, mensajeOriginal) {
  const ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Leads');
  if (!sheet) {
    sheet = ss.insertSheet('Leads');
    sheet.appendRow(['Fecha/Hora','Canal','Idioma','Nombre','Teléfono','Tipo','Urgencia','Resumen','Acción','¿Humano?','Mensaje original']);
  }
  lead = lead || {};
  sheet.appendRow([
    new Date(),
    lead.canal || '',
    lead.idioma || '',
    lead.nombre || '',
    lead.telefono || '',
    lead.tipo || '',
    lead.urgencia || '',
    lead.resumen || '',
    lead.accion || '',
    lead.requiere_humano ? 'Sí' : 'No',
    mensajeOriginal || ''
  ]);
}

// ============================================================
//  ALERTA POR CORREO — solo para leads calientes o eventos/escalados
//  Te avisa al instante para que no se te escape lo importante.
// ============================================================
function sendAlertIfNeeded(lead, mensajeOriginal, senderId) {
  lead = lead || {};

  // Dispara solo si vale la pena interrumpirte:
  const esCaliente = (lead.urgencia === 'caliente');
  const esHumano   = (lead.requiere_humano === true);
  const esEvento   = (lead.tipo === 'evento');
  const esQueja    = (lead.tipo === 'queja');
  if (!esCaliente && !esHumano && !esEvento && !esQueja) return;

  if (!CONFIG.ALERT_EMAIL) return;

  // Etiqueta corta para el asunto
  let etiqueta = '🔥 Lead caliente';
  if (esEvento) etiqueta = '🎉 Evento';
  else if (esQueja) etiqueta = '⚠️ Queja';
  else if (esHumano) etiqueta = '🙋 Requiere persona';

  const canal = (lead.canal || '').toUpperCase() || '—';
  const nombre = lead.nombre || '(sin nombre)';
  const asunto = 'Rosanta · ' + etiqueta + ' · ' + canal + ' · ' + (lead.resumen || 'nuevo mensaje');

  const cuerpo =
    etiqueta + '\n\n' +
    'Canal:     ' + canal + '\n' +
    'Nombre:    ' + nombre + '\n' +
    'Teléfono:  ' + (lead.telefono || '—') + '\n' +
    'Tipo:      ' + (lead.tipo || '—') + '\n' +
    'Urgencia:  ' + (lead.urgencia || '—') + '\n' +
    'Acción:    ' + (lead.accion || '—') + '\n' +
    'Contacto (ID del chat): ' + (senderId || '—') + '\n\n' +
    'Resumen:   ' + (lead.resumen || '—') + '\n\n' +
    'Mensaje del cliente:\n"' + (mensajeOriginal || '') + '"\n\n' +
    '— Bot de Rosanta. Abre el chat de ' + canal + ' para responder.';

  try {
    MailApp.sendEmail(CONFIG.ALERT_EMAIL, asunto, cuerpo);
  } catch (err) {
    Logger.log('No se pudo enviar la alerta por correo: ' + err);
  }
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
'RESERVAS DE MESA (no son eventos): NO tomas reservas por chat. Comparte el link en su idioma — Español: https://www.rosanta.rest/reservas — Inglés: https://www.rosanta.rest/reservations. Puedes resolver dudas, pero el cierre es en el link.',
'',
'EVENTOS (cumpleaños, privados, corporativos, catas): NO los cotizas ni cierras. Recoge tipo de evento, fecha tentativa, número de personas y contacto, di que una persona del equipo dará seguimiento, y marca requiere_humano:true.',
'',
'ESCALAR A HUMANO (requiere_humano:true) si: es evento, es queja, piden algo que no está en la base, o algo fuera de lo normal (prensa, proveedores, facturación especial, pagos).',
'',
'NO HAGAS: confirmar reservas como definitivas; prometer descuentos/cortesías sin autorización; compartir datos internos; salirte del tema del restaurante.',
'',
'FORMATO DE SALIDA: responde SIEMPRE y SOLO con un objeto JSON válido, sin texto antes ni después:',
'{',
'  "respuesta": "<mensaje para el cliente, en su idioma>",',
'  "lead": {',
'    "canal": "whatsapp | instagram",',
'    "idioma": "es | en",',
'    "nombre": "<si se conoce, si no vacío>",',
'    "telefono": "<si lo dio, si no vacío>",',
'    "tipo": "reserva | evento | consulta | queja | spam | otro",',
'    "urgencia": "caliente | tibio | frio",',
'    "resumen": "<una línea: qué quiere>",',
'    "accion": "redirigir_reservas | escalar_evento | responder_info | escalar_humano",',
'    "requiere_humano": true/false',
'  }',
'}',
'urgencia: caliente = quiere reservar/agendar ya o pide disponibilidad inmediata; tibio = interesado sin fecha concreta; frio = consulta general o spam.',
'',
'BASE DE CONOCIMIENTO:',
'{{base_conocimiento}}'
].join('\n');
