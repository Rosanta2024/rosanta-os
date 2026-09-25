/**
 * ============================================================
 *  ROSANTA - Bot de respuestas a reseñas de Google Business Profile
 *  Runtime: Google Apps Script (corre bajo la cuenta Google dueña del GBP)
 *  Modelo de aprobación: HÍBRIDO POR ESTRELLAS
 *    - 4 y 5 estrellas  -> se responde y publica automáticamente
 *    - 1, 2 y 3 estrellas -> se genera borrador, NO se publica.
 *                            Se manda por correo y se deja en la hoja
 *                            para que Juanma apruebe antes de publicar.
 * ============================================================
 */

// ===================== CONFIGURACIÓN =====================
// Rellena estos valores en "Propiedades del script" (Project Settings)
// para no dejar llaves dentro del código. Ver guía de instalación.

const CONFIG = {
  // ID numérico de la cuenta GBP (formato: accounts/123456789)
  ACCOUNT_ID:   getProp_('ACCOUNT_ID'),      // p.ej. "123456789012345"
  // ID numérico de la ubicación de Rosanta
  LOCATION_ID:  getProp_('LOCATION_ID'),     // p.ej. "987654321098765"

  // Correo del dueño que aprueba las reseñas delicadas
  OWNER_EMAIL:  getProp_('OWNER_EMAIL') || 'restaurante@rosanta.rest',

  // Llave de la API de Claude (Anthropic) para redactar las respuestas
  ANTHROPIC_API_KEY: getProp_('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL:   getProp_('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',

  // ID de la Google Sheet de control (se crea sola la primera vez si está vacío)
  SHEET_ID: getProp_('SHEET_ID'),

  // Umbral: estrellas >= AUTO_MIN se publican solas. El resto van a aprobación.
  AUTO_MIN: 4
};

const STAR_MAP = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5, 'STAR_RATING_UNSPECIFIED': 0 };
const MB_BASE  = 'https://mybusiness.googleapis.com/v4';

// ===================== FUNCIÓN PRINCIPAL =====================
// Esta es la que dispara el trigger programado (cada hora / cada mañana).
function procesarResenas() {
  const sheet = getSheet_();
  const yaProcesadas = getProcesadasSet_(sheet);

  const reviews = listarResenas_();
  if (!reviews.length) {
    Logger.log('No hay reseñas devueltas por la API.');
    return;
  }

  let nuevas = 0, auto = 0, paraAprobar = 0;

  reviews.forEach(function (r) {
    const reviewId = r.reviewId || (r.name || '').split('/').pop();
    if (!reviewId || yaProcesadas[reviewId]) return;   // ya la atendimos antes
    if (r.reviewReply && r.reviewReply.comment) {       // ya tenía respuesta previa
      registrar_(sheet, r, '', 'YA_TENIA_RESPUESTA', '');
      return;
    }

    nuevas++;
    const estrellas = STAR_MAP[r.starRating] || 0;
    const nombre = (r.reviewer && r.reviewer.displayName) ? r.reviewer.displayName : '';
    const texto  = r.comment || '';

    const respuesta = redactarRespuesta_(estrellas, nombre, texto);

    if (estrellas >= CONFIG.AUTO_MIN) {
      // ---- Auto-publicar (4-5 estrellas) ----
      publicarRespuesta_(reviewId, respuesta);
      registrar_(sheet, r, respuesta, 'PUBLICADA_AUTO', '');
      auto++;
    } else {
      // ---- Dejar para aprobación (1-3 estrellas) ----
      registrar_(sheet, r, respuesta, 'PENDIENTE_APROBAR', 'NO');
      paraAprobar++;
    }
  });

  if (paraAprobar > 0) notificarPendientes_(sheet);
  Logger.log('Nuevas: %s | Auto-publicadas: %s | A aprobar: %s', nuevas, auto, paraAprobar);
}

// ===================== APROBACIÓN DE 1-3 ESTRELLAS =====================
// Segundo trigger (p.ej. cada 30 min). Lee la hoja y publica las que
// Juanma marcó como aprobadas (columna APROBAR = "SI").
function publicarAprobadas() {
  const sheet = getSheet_();
  const data  = sheet.getDataRange().getValues();
  const head  = data[0];
  const cEstado   = head.indexOf('Estado');
  const cAprobar  = head.indexOf('Aprobar (SI/NO)');
  const cRespEdit = head.indexOf('Respuesta (editable)');
  const cReviewId = head.indexOf('ReviewId');

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    if (fila[cEstado] !== 'PENDIENTE_APROBAR') continue;
    if (String(fila[cAprobar]).trim().toUpperCase() !== 'SI') continue;

    const reviewId = fila[cReviewId];
    const texto = String(fila[cRespEdit] || '').trim();
    if (!texto) continue;

    publicarRespuesta_(reviewId, texto);
    sheet.getRange(i + 1, cEstado + 1).setValue('PUBLICADA_APROBADA');
    sheet.getRange(i + 1, head.indexOf('Fecha publicada') + 1).setValue(new Date());
  }
}

// ===================== LLAMADAS A LA API DE GOOGLE =====================
function listarResenas_() {
  const url = MB_BASE + '/accounts/' + CONFIG.ACCOUNT_ID +
              '/locations/' + CONFIG.LOCATION_ID + '/reviews?pageSize=50&orderBy=updateTime%20desc';
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('Error al listar reseñas (' + code + '): ' + res.getContentText());
  }
  return (JSON.parse(res.getContentText()).reviews) || [];
}

function publicarRespuesta_(reviewId, comentario) {
  const url = MB_BASE + '/accounts/' + CONFIG.ACCOUNT_ID +
              '/locations/' + CONFIG.LOCATION_ID + '/reviews/' + reviewId + '/reply';
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ comment: comentario }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Error al publicar respuesta (' + res.getResponseCode() + '): ' + res.getContentText());
  }
}

// ===================== MOTOR DE REDACCIÓN (voz Rosanta) =====================
function redactarRespuesta_(estrellas, nombre, textoResena) {
  const prompt = construirPrompt_(estrellas, nombre, textoResena);

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: CONFIG.ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    Logger.log('Fallo LLM: ' + res.getContentText());
    return respuestaFallback_(estrellas, nombre);  // por si la API falla
  }
  const json = JSON.parse(res.getContentText());
  return (json.content && json.content[0] && json.content[0].text || '').trim();
}

// Instrucciones EXACTAS migradas del agente de GHL (mismo comportamiento probado).
function construirPrompt_(estrellas, nombre, textoResena) {
  return [
'Recibirás reseñas de clientes de Rosanta, un restaurante de gastronomía sostenible en Antigua Guatemala. Tu tarea es redactar una respuesta cálida, humana y simple.',
'',
'REGLAS OBLIGATORIAS:',
'- Responde en el MISMO idioma de la reseña (español o inglés).',
'- Usa SOLO el primer nombre del cliente. Si tiene apellido, ignóralo. Si el nombre es "Traveler", "Guest" o similar, no uses nombre.',
'- NUNCA uses "nuestro", "nuestra", "nuestros", "nuestras", "our", "ours". Habla siempre en segunda persona, el cliente es el protagonista.',
'- NUNCA empieces con "En Rosanta..." ni "Hola...".',
'- NO uses em dashes (—). Usa puntos o comas.',
'- Frases cortas, tono cálido pero no formal.',
'- Menciona algo específico que el cliente comentó (un plato, el ambiente, el servicio).',
'- Máximo 3 oraciones.',
'- No hagas preguntas de seguimiento ni despedidas formales.',
'',
'ESTRUCTURA SEGÚN RATING:',
'5 ESTRELLAS:',
'- Agradecer brevemente.',
'- Mencionar el detalle específico que destacó.',
'- Invitar a regresar.',
'4 ESTRELLAS:',
'- Agradecer.',
'- Reconocer lo positivo.',
'- Invitar a contacto privado para feedback: restaurante@rosanta.rest',
'3 ESTRELLAS O MENOS:',
'- Disculpa específica sin defenderse.',
'- Reconocer el problema mencionado.',
'- Invitar a contacto privado: restaurante@rosanta.rest',
'- NO ofrecer compensaciones públicas.',
'',
'EJEMPLOS BUENOS:',
'Reseña 5★ ES "Excelente lomito y ambiente increíble":',
'"Juan, qué alegría leer esto. El lomito es una de las recetas que más cariño recibe en la cocina. Te esperamos pronto de regreso."',
'Reseña 5★ EN "Amazing dinner, loved the cocktails":',
'"Lauren, so glad the cocktails left a mark. The bar team puts real care into every glass. Looking forward to having you back."',
'Reseña 4★ ES "Buena comida pero servicio lento":',
'"Geraldo, gracias por compartir tu visita. Nos encantaría escuchar más sobre el servicio. Escríbenos a restaurante@rosanta.rest."',
'Reseña 1★: NUNCA defenderte, SIEMPRE invitar a contacto privado en restaurante@rosanta.rest.',
'',
'EJEMPLOS PROHIBIDOS:',
'- "Gracias por venir a nuestro restaurante" (usa "nuestro")',
'- "Hola Lauren Maresco" (nombre completo)',
'- "En Rosanta nos alegra..." (empieza con "En Rosanta")',
'- "Te ofrecemos un descuento de cortesía" (compensación pública)',
'',
'=============================',
'RESEÑA A RESPONDER:',
'Calificación: ' + estrellas + ' estrellas',
'Nombre del cliente (puede venir completo, aplica la regla del primer nombre): ' + (nombre || '(sin nombre)'),
'Texto de la reseña: ' + (textoResena || '(el cliente dejó calificación sin comentario; menciona el ambiente o la experiencia de forma general)'),
'',
'Devuelve SOLO el texto de la respuesta, sin comillas ni explicaciones.'
  ].join('\n');
}

function respuestaFallback_(estrellas, nombre) {
  const n = (nombre || '').trim().split(' ')[0];
  const saludo = n ? (n + ', ') : '';
  if (estrellas >= 4) {
    return saludo + 'gracias por tus palabras y por dejar que Rosanta sea parte de tu día. Te esperamos pronto con algo rico en la barra y en la mesa.';
  }
  return saludo + 'gracias por tomarte el tiempo de escribir. Lamentamos que la experiencia no fuera la que esperabas. Nos encantaría conocer más para mejorar: escríbenos a restaurante@rosanta.rest.';
}

// ===================== HOJA DE CONTROL =====================
function getSheet_() {
  let ss;
  if (CONFIG.SHEET_ID) {
    ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } else {
    ss = SpreadsheetApp.create('Rosanta - Control de Reseñas GBP');
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
    Logger.log('Hoja creada: ' + ss.getUrl());
  }
  let sheet = ss.getSheetByName('Reseñas');
  if (!sheet) {
    sheet = ss.insertSheet('Reseñas');
    sheet.appendRow([
      'Fecha detectada', 'ReviewId', 'Estrellas', 'Cliente', 'Reseña original',
      'Respuesta (editable)', 'Estado', 'Aprobar (SI/NO)', 'Fecha publicada'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getProcesadasSet_(sheet) {
  const data = sheet.getDataRange().getValues();
  const idx = data[0].indexOf('ReviewId');
  const set = {};
  for (let i = 1; i < data.length; i++) if (data[i][idx]) set[data[i][idx]] = true;
  return set;
}

function registrar_(sheet, r, respuesta, estado, aprobar) {
  const reviewId = r.reviewId || (r.name || '').split('/').pop();
  sheet.appendRow([
    new Date(),
    reviewId,
    STAR_MAP[r.starRating] || 0,
    (r.reviewer && r.reviewer.displayName) || '',
    r.comment || '',
    respuesta,
    estado,
    aprobar || '',
    ''
  ]);
}

// ===================== NOTIFICACIÓN AL DUEÑO =====================
function notificarPendientes_(sheet) {
  const data = sheet.getDataRange().getValues();
  const head = data[0];
  const cEstado = head.indexOf('Estado');
  const cEstr   = head.indexOf('Estrellas');
  const cCli    = head.indexOf('Cliente');
  const cRes    = head.indexOf('Reseña original');
  const cResp   = head.indexOf('Respuesta (editable)');

  const pendientes = data.slice(1).filter(f => f[cEstado] === 'PENDIENTE_APROBAR');
  if (!pendientes.length) return;

  const url = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getUrl();
  let cuerpo = 'Hola Juanma,\n\nHay ' + pendientes.length +
    ' reseña(s) de 1 a 3 estrellas esperando tu aprobación antes de publicar.\n\n';
  pendientes.forEach(f => {
    cuerpo += '— ' + f[cEstr] + '★ de ' + (f[cCli] || 'Anónimo') + '\n';
    cuerpo += '  Reseña: ' + (f[cRes] || '(sin texto)') + '\n';
    cuerpo += '  Borrador propuesto: ' + f[cResp] + '\n\n';
  });
  cuerpo += 'Para publicar: abre la hoja, ajusta el texto si quieres y escribe SI en la columna "Aprobar".\n';
  cuerpo += 'Hoja de control: ' + url + '\n';

  MailApp.sendEmail(CONFIG.OWNER_EMAIL,
    '🌿 Rosanta: ' + pendientes.length + ' reseña(s) para revisar', cuerpo);
}

// ===================== UTILES =====================
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// Ejecuta esto UNA vez a mano para crear los triggers programados.
function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('procesarResenas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('publicarAprobadas').timeBased().everyMinutes(30).create();
  Logger.log('Triggers instalados.');
}

// Ejecuta esto UNA vez para descubrir tus IDs. Copia del log el número de
// ACCOUNT_ID y LOCATION_ID y guárdalos en Propiedades del script.
function imprimirIds() {
  var h = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  var acc = UrlFetchApp.fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: h, muteHttpExceptions: true });
  Logger.log('=== ACCOUNTS ===\n' + acc.getContentText());
  var accounts = (JSON.parse(acc.getContentText()).accounts) || [];
  accounts.forEach(function (a) {
    var loc = UrlFetchApp.fetch(
      'https://mybusinessbusinessinformation.googleapis.com/v1/' + a.name +
      '/locations?readMask=name,title&pageSize=100',
      { headers: h, muteHttpExceptions: true });
    Logger.log('=== LOCATIONS de ' + a.name + ' (' + (a.accountName||'') + ') ===\n' + loc.getContentText());
  });
  Logger.log('\nACCOUNT_ID = el número que sigue a "accounts/"  |  LOCATION_ID = el número que sigue a "locations/"');
}

// Ejecuta esto para una PRUEBA EN SECO: lista reseñas y redacta sin publicar.
function pruebaEnSeco() {
  const reviews = listarResenas_();
  Logger.log('Reseñas encontradas: ' + reviews.length);
  reviews.slice(0, 3).forEach(r => {
    const estrellas = STAR_MAP[r.starRating] || 0;
    const nombre = (r.reviewer && r.reviewer.displayName) || '';
    Logger.log('[' + estrellas + '★] ' + nombre + ': ' + (r.comment || '(sin texto)'));
    Logger.log('   -> ' + redactarRespuesta_(estrellas, nombre, r.comment || ''));
  });
}