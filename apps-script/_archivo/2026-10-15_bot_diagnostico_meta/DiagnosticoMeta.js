/**
 * ROSANTA · BOT — DIAGNÓSTICO DE META (15-oct-2026), SOLO LECTURA.
 * Desde el 14-oct 17:56 no entra ningún doPost. Pregunta a Meta si los webhooks
 * siguen suscritos y si los tokens sirven. No cambia nada ni manda mensajes.
 * Archivo aparte para que al abrirlo quede elegida esta función.
 */
function diagnosticoMeta() {
  var v = CONFIG.GRAPH_VERSION;
  var waba = '4419411291677705';
  function get(nombre, url, token) {
    try {
      var r = UrlFetchApp.fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {}, muteHttpExceptions: true });
      console.log(nombre + ' → HTTP ' + r.getResponseCode() + ': ' + r.getContentText().substring(0, 700));
    } catch (e) { console.log(nombre + ' → EXCEPCIÓN ' + e); }
  }
  console.log('GRAPH_VERSION=' + v + ' · WA_PHONE_NUMBER_ID=' + PROPS.getProperty('WA_PHONE_NUMBER_ID') +
    ' · WEBHOOK_SECRET definido=' + !!PROPS.getProperty('WEBHOOK_SECRET'));
  get('WA token (debug)', 'https://graph.facebook.com/' + v + '/debug_token?input_token=' +
    encodeURIComponent(CONFIG.WHATSAPP_TOKEN), CONFIG.WHATSAPP_TOKEN);
  get('WA apps suscritas a la WABA', 'https://graph.facebook.com/' + v + '/' + waba + '/subscribed_apps', CONFIG.WHATSAPP_TOKEN);
  get('WA número', 'https://graph.facebook.com/' + v + '/' + PROPS.getProperty('WA_PHONE_NUMBER_ID') +
    '?fields=display_phone_number,status,quality_rating,code_verification_status,name_status,throughput,webhook_configuration',
    CONFIG.WHATSAPP_TOKEN);
  get('Messenger página', 'https://graph.facebook.com/' + v + '/me?fields=id,name', CONFIG.MESSENGER_TOKEN);
  get('Messenger apps suscritas', 'https://graph.facebook.com/' + v + '/me/subscribed_apps', CONFIG.MESSENGER_TOKEN);
  get('Instagram cuenta', 'https://graph.instagram.com/' + v + '/me?fields=user_id,username', CONFIG.IG_TOKEN);
  get('Instagram apps suscritas', 'https://graph.instagram.com/' + v + '/me/subscribed_apps', CONFIG.IG_TOKEN);
  get('WA salud del número', 'https://graph.facebook.com/' + v + '/' + PROPS.getProperty('WA_PHONE_NUMBER_ID') + '?fields=health_status', CONFIG.WHATSAPP_TOKEN);
  get('WA salud de la cuenta', 'https://graph.facebook.com/' + v + '/' + waba + '?fields=name,health_status,account_review_status', CONFIG.WHATSAPP_TOKEN);
  try {
    var r = UrlFetchApp.fetch('https://graph.instagram.com/' + v + '/me/subscribed_apps', { headers: { Authorization: 'Bearer ' + CONFIG.IG_TOKEN }, muteHttpExceptions: true });
    console.log('Instagram suscripción (campos) → ' + r.getContentText().replace(/"id":"\d+"/g, '').substring(0, 900));
  } catch (e) {}
  console.log('URL de este proyecto (producción): ' + ScriptApp.getService().getUrl());
}
