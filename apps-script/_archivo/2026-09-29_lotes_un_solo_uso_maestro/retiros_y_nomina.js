// ============================================================
// ROSANTA - Retiros de Juanma y pagos al personal (15 sep 2026)
// Decisiones de Juanma del 15-sep-2026, para la proyeccion de caja (p94) y la
// medicion del objetivo operacional (p122).
//
// 1. RETIROS DE JUANMA: 17 transferencias del BAC a su cuenta 974954208
//    ("TEF A : 974954208"), de abril a agosto. Son su retiro semanal (Q1,000 por
//    semana, Q5,000 al mes). Estaban como DEVOLUCION_INVERSION (abr-jun) y como
//    TRANSFERENCIA (jul-ago).
//    -> PERSONAL, Es_Personal Si.
//    OJO: DEVOLUCION_INVERSION queda solo para los acreedores (Raul, Kristinsa,
//    Manuel Lemus). Mezclar ahi el retiro de Juanma inflaba la "devolucion" y
//    escondia el retiro.
//
// 2. PAGOS AL PERSONAL del 18-ago: Q800 a Fernanda (974522203) y Q850 a Jeffry
//    (974521858), como TRANSFERENCIA. Son planilla: Fernanda tiene cuenta propia, y
//    parte del personal de cocina no tiene cuenta, asi que Jeffry recibe el deposito
//    y les da el efectivo.
//    -> NOMINA.
//
// COMO FUNCIONA
// Busca cada fila por Referencia y verifica FECHA + DESCRIPCION + DEBITO, nunca por
// numero de fila. Solo escribe si la categoria de hoy es la esperada. Escribe como
// texto y relee lo escrito. Se puede correr dos veces sin dano.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarRetirosYNomina()    no escribe. Tiene que decir 19 filas y "Sin avisos".
//   2. aplicarRetirosYNomina()
//   3. revisarRetirosYNomina()    tiene que decir 0 filas y 19 ya estaban bien.
//   4. generarEspejo()
// ============================================================

var SHEET_ID_RN = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// 04_Banco_BAC: 1 Fecha · 2 Referencia · 4 Descripcion · 5 Debito · 8 Categoria · 9 Es_Personal
// [Referencia, fecha, descripcion, debito, categoria nueva, Es_Personal nuevo ('' = no tocar), categoria ESPERADA hoy]
var LOTE_RN = [
  ['406463793', '2026-04-23', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406471528', '2026-05-02', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406494291', '2026-05-08', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406481657', '2026-05-09', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406471218', '2026-05-14', 'TEF A : 974954208', 2000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406482295', '2026-05-21', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406456272', '2026-06-05', 'TEF A : 974954208',  500.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406485038', '2026-06-05', 'TEF A : 974954208',  290.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406496319', '2026-06-07', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406424134', '2026-06-16', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406495458', '2026-06-20', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406417875', '2026-06-26', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'DEVOLUCION_INVERSION'],
  ['406428470', '2026-07-14', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'TRANSFERENCIA'],
  ['406475977', '2026-07-24', 'TEF A : 974954208',  500.00, 'PERSONAL', 'Si', 'TRANSFERENCIA'],
  ['406439215', '2026-08-07', 'TEF A : 974954208',  100.00, 'PERSONAL', 'Si', 'TRANSFERENCIA'],
  ['406436856', '2026-08-15', 'TEF A : 974954208', 1000.00, 'PERSONAL', 'Si', 'TRANSFERENCIA'],
  ['406473786', '2026-08-27', 'TEF A : 974954208',  850.00, 'PERSONAL', 'Si', 'TRANSFERENCIA'],
  // total retiros Q15,240.00 (con las dos de nomina, Q16,890.00)
  ['406430175', '2026-08-18', 'TEF A : 974522203',  800.00, 'NOMINA', '', 'TRANSFERENCIA'],   // Fernanda
  ['406430350', '2026-08-18', 'TEF A : 974521858',  850.00, 'NOMINA', '', 'TRANSFERENCIA']    // Jeffry, para cocina
];

function _rnLlave(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _rnFecha(d) {
  if (!(d instanceof Date)) return String(d || '').trim();
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}
function _rnTexto(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function _rnCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_RN);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var sh = ss.getSheetByName('04_Banco_BAC');
  var datos = sh.getDataRange().getValues();
  var idx = {};
  for (var r = 4; r < datos.length; r++) {
    var k = _rnLlave(datos[r][1]);
    if (k) (idx[k] = idx[k] || []).push(r);
  }
  var avisos = [], tareas = [], yaEstaban = 0, total = 0;
  LOTE_RN.forEach(function (it) {
    var filas = idx[it[0]] || [];
    if (!filas.length) { avisos.push('Sin coincidencia: Referencia ' + it[0]); return; }
    if (filas.length > 1) { avisos.push('REFERENCIA REPETIDA ' + it[0] + ' (' + filas.length + ' filas). No se toca.'); return; }
    var fila = filas[0];
    var f = _rnFecha(datos[fila][0]), d = _rnTexto(datos[fila][3]), m = Math.round(Number(datos[fila][4]) * 100) / 100;
    if (f !== it[1] || d !== _rnTexto(it[2]) || Math.abs(m - it[3]) > 0.01) {
      avisos.push('NO CUADRA Referencia ' + it[0] + ' · la hoja dice ' + f + ' "' + d + '" Q' + m +
                  ' · se esperaba ' + it[1] + ' "' + it[2] + '" Q' + it[3] + '. No se toca.');
      return;
    }
    var actual = _rnTexto(datos[fila][7]);
    if (actual === it[4]) { yaEstaban++; return; }
    if (actual !== it[6]) {
      avisos.push('OJO Referencia ' + it[0] + ' dice "' + actual + '" y se esperaba "' + it[6] + '". No se toca.');
      return;
    }
    tareas.push({ fila: fila + 1, it: it });
    total += it[3];
  });

  var noQuedaron = [];
  if (escribir && !avisos.length && tareas.length) {
    tareas.forEach(function (t) {
      sh.getRange(t.fila, 8).setValue(t.it[4]);
      if (t.it[5]) sh.getRange(t.fila, 9).setValue(t.it[5]);
    });
    SpreadsheetApp.flush();
    var releida = sh.getRange(1, 8, sh.getLastRow(), 2).getValues();
    tareas.forEach(function (t) {
      var cat = _rnTexto(releida[t.fila - 1][0]), per = _rnTexto(releida[t.fila - 1][1]);
      if (cat !== t.it[4] || (t.it[5] && per !== t.it[5])) {
        noQuedaron.push('Referencia ' + t.it[0] + ' fila ' + t.fila + ': la hoja dice "' + cat + '" / "' + per + '"');
      }
    });
  }

  Logger.log(escribir ? (avisos.length ? '=== NO SE ESCRIBIO: hay avisos ===' : '=== ESCRITAS ===')
                      : '=== SIMULACION, no se escribio nada ===');
  Logger.log(tareas.length + ' filas por Q' + total.toFixed(2) + ' · ya estaban bien: ' + yaEstaban);
  tareas.forEach(function (t) {
    Logger.log('   fila ' + t.fila + ' ' + t.it[1] + ' ' + t.it[2] + ' Q' + t.it[3] + ': ' + t.it[6] + ' -> ' + t.it[4]);
  });
  if (escribir && !avisos.length && tareas.length) {
    Logger.log(noQuedaron.length ? '--- NO QUEDARON ---' : 'Releidas: todo quedo escrito.');
    noQuedaron.forEach(function (x) { Logger.log('   ' + x); });
  }
  if (avisos.length) {
    Logger.log('--- revisar ---');
    avisos.forEach(function (x) { Logger.log('   ' + x); });
  } else {
    Logger.log('Sin avisos.');
  }
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarRetirosYNomina() { _rnCorrer(false); }

/** Escribe las 19 categorias. No escribe nada si la revision tiene avisos. */
function aplicarRetirosYNomina() { _rnCorrer(true); }
