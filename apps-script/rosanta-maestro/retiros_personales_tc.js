// ============================================================
// ROSANTA - Siete adelantos de efectivo de la tarjeta que son personales
// 21 sep 2026. Generado desde el espejo del 21-sep 12:16.
//
// QUE ARREGLA
// En 05_Tarjeta_Credito_BAC hay 7 filas "Retiro de Efec." por Q2,400 marcadas
// ALIMENTOS_EFECTIVO. Son adelantos de efectivo en la tarjeta, todos en
// gasolineras salvo uno en una agencia BAC. Juanma confirmo el 21-sep que son
// retiros PERSONALES, no compra de mercado. Pasan a PERSONAL / Es_Personal = Si.
//
// POR QUE IMPORTA
// ALIMENTOS_EFECTIVO no significa "pagado en efectivo" sino "alimentos SIN
// FACTURA", y si entra al COGS. Estas siete filas estaban sumando Q2,400 de
// food cost que nunca fue comida. PERSONAL esta en el set FUERA de
// generar_finanzas.py, asi que al moverlas salen del DRE.
//
// YA HAY PRECEDENTE EN LA MISMA HOJA
// La fila del 10-jul, "Retiro de Efec.FARMACIAS BATRE" Q100, ya esta como
// PERSONAL. Este lote deja las otras siete igual que esa.
//
// OJO CON EL ACENTO. generar_finanzas.py linea 394 compara Es_Personal con
// 'Si' CON acento. La fila de FARMACIAS BATRE quedo con 'Si' sin acento y solo
// se excluye por la categoria. Este lote escribe 'Si' CON acento, que es el
// valor mayoritario de la hoja (133 filas). Vale la pena arreglar la de
// FARMACIAS BATRE algun dia; no la toco aqui porque ya esta fuera del DRE por
// categoria y no cambia ningun numero.
//
// COMO FUNCIONA
// Busca cada fila por FECHA + DESCRIPCION + QUETZALES, nunca por numero de
// fila. Solo escribe si la categoria de hoy es la esperada. Se puede correr dos
// veces sin dano.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarRetirosPersonalesTC()     no escribe. Tiene que decir 7 filas y
//                                       "Sin avisos". Si no, parar y avisar.
//   2. aplicarRetirosPersonalesTC()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_RP = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_RP = '05_Tarjeta_Credito_BAC';
// 1 Fecha · 2 Descripcion · 3 Quetzales · 4 Dolares · 5 Categoria · 6 Es_Personal

// [fecha, descripcion, quetzales, cat nueva, Es_Personal nuevo, cat ESPERADA hoy]
var LOTE_RP = [
  ['2026-01-09', 'Retiro de Efec.Puma Roosevelt',  500.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-01-12', 'Retiro de Efec.Shell Select Al', 500.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-03-04', 'Retiro de Efec.Gasolinera Pano', 100.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-03-11', 'Retiro de Efec.BAC AG EL ROBLE', 200.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-03-16', 'Retiro de Efec.Gasolinera Pano', 500.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-04-14', 'Retiro de Efec.Gasolinera Pano', 500.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO'],
  ['2026-06-25', 'Retiro de Efec.Gasolinera Pano', 100.00, 'PERSONAL', 'Sí', 'ALIMENTOS_EFECTIVO']
  // total Q2,400.00
];

function _rpFecha(d) {
  if (!(d instanceof Date)) return String(d || '').trim();
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}

function _rpCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_RP);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var sh = ss.getSheetByName(HOJA_RP);
  var datos = sh.getDataRange().getValues();
  var avisos = [], hechas = 0, yaEstaban = 0, total = 0;

  LOTE_RP.forEach(function (it) {
    var filas = [];
    for (var r = 4; r < datos.length; r++) {
      var f = _rpFecha(datos[r][0]);
      var d = String(datos[r][1] || '').trim();
      var q = Math.round(Number(datos[r][2]) * 100) / 100;
      if (f === it[0] && d === it[1] && Math.abs(q - it[2]) < 0.01) filas.push(r);
    }
    if (!filas.length) {
      avisos.push('Sin coincidencia: ' + it[0] + ' "' + it[1] + '" Q' + it[2]);
      return;
    }
    if (filas.length > 1) {
      avisos.push('REPETIDA ' + it[0] + ' "' + it[1] + '" Q' + it[2] +
                  ' (' + filas.length + ' filas). No se toca.');
      return;
    }
    var r = filas[0];
    var actual = String(datos[r][4] || '').trim();
    if (actual === it[3]) { yaEstaban++; return; }
    if (actual !== it[5]) {
      avisos.push('OJO ' + it[0] + ' "' + it[1] + '" dice "' + actual +
                  '" y se esperaba "' + it[5] + '". No se toca.');
      return;
    }
    if (escribir) {
      sh.getRange(r + 1, 5).setValue(it[3]);   // Categoria
      sh.getRange(r + 1, 6).setValue(it[4]);   // Es_Personal
    }
    hechas++;
    total += it[2];
  });

  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(hechas + ' filas por Q' + total.toFixed(2) + ' a PERSONAL / Es_Personal = Si');
  Logger.log('Ya estaban bien: ' + yaEstaban);
  if (avisos.length) {
    Logger.log('--- revisar ---');
    avisos.forEach(function (x) { Logger.log('   ' + x); });
  } else {
    Logger.log('Sin avisos: las 7 filas del lote se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarRetirosPersonalesTC() { _rpCorrer(false); }

/** Escribe PERSONAL / Si en las siete filas. */
function aplicarRetirosPersonalesTC() { _rpCorrer(true); }
