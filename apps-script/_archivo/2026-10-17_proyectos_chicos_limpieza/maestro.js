// ---- de cargador.js
/** Solo diagnostico: dice que hay en la carpeta sin escribir nada. */
function _revisar(nombreCarpeta) {
  if (!nombreCarpeta) throw new Error('Falta el nombre de la carpeta. Usa revisar() o revisarUltimaSemana().');
  Logger.log('=== Revisando ' + nombreCarpeta + ' (no escribe nada) ===');
  var r = _leerCarpeta(nombreCarpeta);
  for (var i = 0; i < r.items.length; i++) {
    Logger.log(r.items[i].tipo + '  <-  ' + r.items[i].nombre +
               '  (' + (r.items[i].datos.length - 1) + ' filas)');
  }
  if (!r.items.length) Logger.log('No encontre archivos de Excel en ' + nombreCarpeta);
  _limpiar(r.temporales);
}


// ---- de cargador.js
/**
 * La version SIN ventana: barre las 27 carpetas cada lunes. Queda por si algun
 * dia se quiere, pero no es la recomendada; ver instalarCargaAutomaticaAcotada().
 */
function instalarCargaAutomatica() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cargarPendientes') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('cargarPendientes')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(0)
    .create();
  Logger.log('Carga automatica instalada: lunes ~10:00, antes del espejo.');
}


