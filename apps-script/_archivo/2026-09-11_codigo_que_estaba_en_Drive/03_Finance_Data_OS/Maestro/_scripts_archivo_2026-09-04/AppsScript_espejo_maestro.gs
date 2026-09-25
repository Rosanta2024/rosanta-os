// ROSANTA - Espejo del maestro
//
// Exporta este Google Sheet como Rosanta_Maestro_ESPEJO.xlsx en la misma
// carpeta de Drive. Drive para escritorio lo sincroniza a la Mac y
// generar_dashboard.py lo lee desde ahi.
//
// El espejo es un DERIVADO: se sobrescribe entero en cada corrida.
// Nunca lo edites a mano.
//
// INSTALACION
//   1. En el maestro: Extensiones > Apps Script
//   2. Click dentro del editor y hace Cmd+A para seleccionar TODO
//   3. Borra con Delete (el editor tiene que quedar completamente vacio)
//   4. Pega este archivo entero
//   5. Guarda con Cmd+S
//   6. En el selector de arriba elegi "generarEspejo" y dale Run
//   7. Autoriza: Revisar permisos > tu cuenta > Configuracion avanzada >
//      Ir a Rosanta_MAESTRO_ACTIVO_2026 > Permitir
//   8. Volve a darle Run. En Execution log debe decir "Espejo actualizado"
//   9. Elegi "instalarTrigger" y dale Run una vez, para que corra solo

var NOMBRE_ESPEJO = 'Rosanta_Maestro_ESPEJO.xlsx';

function generarEspejo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var id = ss.getId();
  var carpeta = DriveApp.getFileById(id).getParents().next();

  var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
  var respuesta = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (respuesta.getResponseCode() !== 200) {
    throw new Error('Google devolvio ' + respuesta.getResponseCode() +
                    ' al exportar. Revisa permisos del Sheet.');
  }

  var blob = respuesta.getBlob().setName(NOMBRE_ESPEJO);

  var previos = carpeta.getFilesByName(NOMBRE_ESPEJO);
  while (previos.hasNext()) {
    previos.next().setTrashed(true);
  }

  var archivo = carpeta.createFile(blob);
  var kb = Math.round(archivo.getSize() / 1024);
  Logger.log('Espejo actualizado en carpeta ' + carpeta.getName() + ' - ' + kb + ' KB');
  return archivo.getId();
}

function instalarTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'generarEspejo') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('generarEspejo')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(30)
    .create();
  Logger.log('Trigger instalado: lunes cerca de las 10:30');
}
