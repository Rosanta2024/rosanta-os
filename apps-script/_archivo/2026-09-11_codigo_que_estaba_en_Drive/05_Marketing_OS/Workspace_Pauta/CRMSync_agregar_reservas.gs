// =================================================================
//  AGREGAR AL FINAL DE CRMSync.gs  ·  recepción de reservas
//  Rosanta · 3 de agosto de 2026
// =================================================================

/**
 * Recibe una reserva de Wix y la guarda en la pestaña "reservas".
 * Si esa reserva ya existe (mismo id), la actualiza en vez de duplicarla,
 * así el consumo y el estado se completan cuando cierran la mesa.
 * La llama doPost cuando el webhook trae hook=reserva.
 */
function intakeReserva(body) {
  var libro = SpreadsheetApp.openById(MKT_SHEET_ID);
  var hoja = libro.getSheetByName(TAB_RESERVAS);
  if (!hoja) {
    hoja = libro.insertSheet(TAB_RESERVAS);
    hoja.getRange(1, 1, 1, 8).setValues([[
      'id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado'
    ]]);
    hoja.setFrozenRows(1);
  }

  // Acepta varios nombres para el mismo dato, para no depender de Wix
  var id       = String(primero_(body.id, body._id, body.reservationId) || '').trim();
  var fecha    = formatearFecha_(primero_(body.fecha, body.startDate, body.date, new Date()));
  var nombre   = String(primero_(body.nombre, body.name, body.firstName) || '').trim();
  var email    = String(primero_(body.email) || '').trim().toLowerCase();
  var telefono = soloDigitos_(String(primero_(body.telefono, body.phone) || ''));
  var personas = Number(primero_(body.personas, body.partySize, 0)) || 0;
  var gasto    = Number(primero_(body.gasto, body.consumo, body.total, 0)) || 0;
  var estado   = String(primero_(body.estado, body.status) || '').trim().toUpperCase();

  if (!id && !email && !telefono) return { error: 'reserva sin id ni contacto' };
  if (!id) id = 'r' + fecha + '-' + (email || telefono);   // id de respaldo

  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    var fila = null;
    if (hoja.getLastRow() > 1) {
      var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === id) { fila = i + 2; break; }
      }
    }

    var valores = [id, fecha, nombre, email, telefono, personas, gasto, estado];

    if (fila) {
      // Actualiza, pero conserva el gasto anterior si el nuevo llega en cero
      var previo = hoja.getRange(fila, 1, 1, 8).getValues()[0];
      if (!gasto && Number(previo[6]) > 0) valores[6] = previo[6];
      if (!nombre && previo[2]) valores[2] = previo[2];
      if (!email && previo[3])  valores[3] = previo[3];
      if (!telefono && previo[4]) valores[4] = previo[4];
      hoja.getRange(fila, 1, 1, 8).setValues([valores]);
      return { ok: true, accion: 'actualizada', id: id, fila: fila };
    } else {
      hoja.appendRow(valores);
      return { ok: true, accion: 'creada', id: id, fila: hoja.getLastRow() };
    }
  } finally {
    candado.releaseLock();
  }
}

/** Devuelve el primer argumento que traiga algo. */
function primero_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

/**
 * PRUEBA · simula la reserva de Chad Caruso del 2 de agosto.
 * Ejecútala desde el editor para comprobar todo sin tocar Wix.
 */
function probarReserva() {
  var r1 = intakeReserva({
    id: 'PRUEBA-CHAD-001', fecha: '2026-08-02', nombre: 'Chad Caruso',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 0, estado: 'RESERVED'
  });
  // y ahora la misma reserva, ya cerrada con consumo
  var r2 = intakeReserva({
    id: 'PRUEBA-CHAD-001', fecha: '2026-08-02', nombre: 'Chad Caruso',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 745, estado: 'FINISHED'
  });
  var sync = sincronizarCRM();
  var msg = 'PRUEBA DE RESERVA\n\n'
    + 'Primer envío: ' + JSON.stringify(r1) + '\n'
    + 'Segundo envío (con consumo): ' + JSON.stringify(r2) + '\n\n'
    + sync + '\n\n'
    + 'Revisa la pestaña reservas: debe haber UNA sola fila de Chad, con gasto 745 '
    + 'y estado FINISHED. Y en el CRM debe aparecer como Cliente que visitó.';
  Logger.log(msg);
  return msg;
}

/** Borra la fila de prueba de la pestaña reservas cuando termines de verificar. */
function limpiarPruebaReserva() {
  var hoja = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName(TAB_RESERVAS);
  if (!hoja || hoja.getLastRow() < 2) return 'Nada que limpiar.';
  var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).indexOf('PRUEBA-') === 0) hoja.deleteRow(i + 2);
  }
  return 'Filas de prueba eliminadas de la pestaña reservas. '
       + 'El contacto de prueba en el CRM lo puedes borrar a mano si quieres.';
}
