// Funciones del bot archivadas el 17-oct-2026 (limpieza pedida por Juanma). No se usan.

// ---- de Code.js ----
function testBot() {
  const r = askClaude('whatsapp', 'Juanma', '¿A qué hora abren el sábado?', 'test-123');
  Logger.log('RESPUESTA: ' + r.respuesta);
  Logger.log('LEAD: ' + JSON.stringify(r.lead));
  logLead(r.lead, 'PRUEBA: ¿A qué hora abren el sábado?');
}

// ---- de Code.js ----
// Para lanzarlo a mano desde el editor.
function archivarSalientesAhora() {
  Logger.log('Archivadas ' + archivarSalientes_() + ' filas.');
}

// ---- de Code.js ----
function crearTriggerRespuestas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarRespuestasPendientes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarRespuestasPendientes').timeBased().everyMinutes(1).create();
  Logger.log('Trigger creado: revisa la columna Respuesta cada minuto.');
}

// ---- de Code.js ----
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

// ---- de Code.js ----
// ===== Ejecutá esta UNA vez para crear el trigger semanal =====
function crearTriggerTokenIG() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refrescarTokenIG') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refrescarTokenIG').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  Logger.log('Trigger semanal de refresco de token IG creado.');
}

// ---- de Code.js ----
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

// ---- de Code.js ----
// ===== Obtener Page Access Token permanente desde System User Token =====
function obtenerPageToken() {
  var suToken = CONFIG.MESSENGER_TOKEN; // ahora mismo tiene el token del System User
  var pageId  = '107770048847191';      // tu página Rosanta
  var r = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION +
    '/' + pageId + '?fields=name,access_token&access_token=' + encodeURIComponent(suToken),
    { muteHttpExceptions: true });
  Logger.log(r.getContentText());
}

// ---- de Code.js ----
function probarConversaciones() {
  logMensaje('whatsapp', '50212345678', 'Prueba', 'in', 'cliente', 'mensaje de prueba');
  logMensaje('whatsapp', '50212345678', 'Prueba', 'out', 'bot', 'respuesta de prueba');
  Logger.log('listo, revisa la pestaña Conversaciones');
}

// ---- de Reservas.js ----
/** Prueba de punta a punta SIN pasar por Claude. Cambia los datos y corre. */
function rvProbar() {
  var falso = {
    respuesta: 'Dame un segundo.',
    lead: { accion: 'crear_reserva', idioma: 'es', nombre: 'Prueba Bot',
            email: 'restaurante@rosanta.rest', fecha: '', hora: '20:00', personas: 2 }
  };
  var hoy = new Date();
  falso.lead.fecha = Utilities.formatDate(hoy, 'America/Guatemala', 'yyyy-MM-dd');
  var r = rvCerrar(falso, 'whatsapp', '50230795252');
  Logger.log('RESPUESTA AL CLIENTE:\n' + r.respuesta + '\n\nLEAD: ' + JSON.stringify(r.lead));
  return r.respuesta;
}
