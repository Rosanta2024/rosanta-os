// ---- de CRMSync.js (líneas 532 al final)
/** Crea la pestaña "reservas" con sus encabezados. Segura: jamás borra nada. */
function crearPestanaReservas() {
  var libro = SpreadsheetApp.openById(MKT_SHEET_ID);
  if (libro.getSheetByName(TAB_RESERVAS)) return 'La pestaña reservas ya existe.';
  var hoja = libro.insertSheet(TAB_RESERVAS);
  hoja.getRange(1, 1, 1, 9).setValues([[
    'id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'
  ]]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  return 'Pestaña reservas creada con sus 9 encabezados.';
}

/** Deja todo corriendo solo: cada 5 minutos y al cambiar la hoja. */
function instalarTriggersCRM() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'sincronizarCRM' || f === 'alCambiarMarketingOS') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarCRM').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('alCambiarMarketingOS')
           .forSpreadsheet(MKT_SHEET_ID).onChange().create();
  return 'Listo: sincronizarCRM corre cada 5 minutos y también apenas cambia el Marketing OS.';
}

/**
 * PRUEBA · simula una reserva que llega dos veces: primero al reservar
 * y luego al cerrar la mesa con consumo. Incluye el consentimiento.
 */
function probarReserva() {
  var r1 = intakeReserva({
    id: 'PRUEBA-001', fecha: '2026-08-02', nombre: 'Chad Prueba',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 0, estado: 'RESERVED', optin: 'SI'
  });
  var r2 = intakeReserva({
    id: 'PRUEBA-001', fecha: '2026-08-02', nombre: 'Chad Prueba',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 745, estado: 'FINISHED', optin: 'NO'
  });
  var msg = 'PRUEBA DE RESERVA\n\n'
    + 'Primer envío: ' + JSON.stringify(r1) + '\n'
    + 'Segundo envío con consumo: ' + JSON.stringify(r2) + '\n\n'
    + 'Espera: una sola fila en reservas, gasto 745, estado FINISHED, optin NO.\n'
    + 'El optin cambió de SI a NO: la retractación funciona.\n'
    + 'El contacto no entra al CRM porque el correo es @example.com.';
  Logger.log(msg);
  return msg;
}

/** Borra las filas de prueba de la pestaña reservas. */
function limpiarPruebaReserva() {
  var hoja = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName(TAB_RESERVAS);
  if (!hoja || hoja.getLastRow() < 2) return 'Nada que limpiar.';
  var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).indexOf('PRUEBA-') === 0) { hoja.deleteRow(i + 2); n++; }
  }
  return n + ' fila(s) de prueba eliminadas.';
}
/**
 * UNA VEZ: normaliza la columna opt_in del CRM maestro.
 * Empieza en simulacro: no escribe nada hasta que pongas SOLO_SIMULACRO en false.
 */
function normalizarOptInCRM() {
  var SOLO_SIMULACRO = false;
  var CERO_SIGNIFICA = '';     // '' = no sabemos · 'NO' = tratarlo como negativa

  var hoja = abrirPestanaCRM_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return 'Nada que normalizar.';

  var rango = hoja.getRange(2, C.opt_in, ultima - 1, 1);
  var vals = rango.getValues();
  var conteo = {}, cambios = 0;

  for (var i = 0; i < vals.length; i++) {
    var orig = String(vals[i][0]).trim();
    var v = orig.toUpperCase();
    var nuevo = orig;

    if (v === '1' || v === 'TRUE' || v === 'SÍ' || v === 'YES') nuevo = 'SI';
    else if (v === '0' || v === 'FALSE')                        nuevo = CERO_SIGNIFICA;
    else if (v === 'SI' || v === 'NO' || v === '')               nuevo = orig;
    else                                                         nuevo = '';

    conteo[orig || '(vacío)'] = (conteo[orig || '(vacío)'] || 0) + 1;
    if (nuevo !== orig) { vals[i][0] = nuevo; cambios++; }
  }

  if (!SOLO_SIMULACRO && cambios) rango.setValues(vals);

  var msg = (SOLO_SIMULACRO ? 'SIMULACRO · no se escribió nada\n\n' : 'APLICADO\n\n')
          + 'Filas revisadas: ' + vals.length + '\n'
          + 'Cambios: ' + cambios + '\n'
          + 'Valores encontrados: ' + JSON.stringify(conteo);
  Logger.log(msg);
  return msg;
}
// ---- de ConsumoPendiente.js
/** Correr UNA vez desde el editor: deja el activador de los lunes a las 8. */
function instalarTriggerConsumoPendiente() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarListaConsumoPendiente') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarListaConsumoPendiente').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(TZ).create();
  return 'Listo: enviarListaConsumoPendiente corre los lunes a las 8 (hora de Guatemala).';
}

