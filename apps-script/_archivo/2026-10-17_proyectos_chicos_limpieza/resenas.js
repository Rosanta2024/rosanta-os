// ---- de Bot de Reseñas de Google.js
// Ejecuta esto UNA vez a mano para crear los triggers programados.
function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('procesarResenas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('publicarAprobadas').timeBased().everyMinutes(30).create();
  Logger.log('Triggers instalados.');
}


// ---- de Bot de Reseñas de Google.js
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


