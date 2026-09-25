// ============================================================
// ROSANTA - Las ultimas 12 partidas en POR_CLASIFICAR
// Clasificadas por Juanma el 1 sep 2026.
//
// Busca cada movimiento por su CONTENIDO (fecha + descripcion +
// monto), nunca por numero de fila. Solo escribe si la celda sigue
// diciendo POR_CLASIFICAR. Se puede correr dos veces sin dano.
//
// USO: pegar en un archivo nuevo del proyecto, Cmd+S,
//      correr "clasificarUltimas12".
// ============================================================

var SHEET_ID_U12 = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// hoja -> [colFecha, colDesc, colDebito, colCredito, colCategoria, colPersonal]
var MAPA_U12 = {
  '01_FEL_Maestro':         [1, 7, 10, 0, 14, 15],
  '04_Banco_BAC':           [1, 4,  5, 6,  8,  9],
  '03_Banco_Industrial':    [1, 3,  4, 5,  7,  8],
  '05_Tarjeta_Credito_BAC': [1, 2,  3, 4,  5,  6]
};

// [hoja, fecha, descripcion, debito, credito, categoria, esPersonal]
var LOTE = [
  ['01_FEL_Maestro', '2026-08-05', 'DISTRIBUIDORA OLAM', 175, 0, 'ALIMENTOS', 'No'],
  ['01_FEL_Maestro', '2026-07-29', 'CORALOIBISA 1', 60, 0, 'ALIMENTOS', 'No'],

  // Pago a proveedor sin nombre en el estado de cuenta del BAC
  ['04_Banco_BAC', '2026-01-14', 'PAGO PROV. QTZ DEM', 0, 320, 'ALIMENTOS', 'No'],

  // Cursos online de publicidad y marketing, en dolares
  ['05_Tarjeta_Credito_BAC', '2026-07-03', 'THE PASSIVE REBEL WWW.THEPASS', 0, 27, 'GASTOS_ADMINISTRATIVOS', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-07-03', 'ART OF VISUAL STORY WWW.THEPASS', 0, 49, 'GASTOS_ADMINISTRATIVOS', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-07-06', 'THESCALINGENGINE 917-5155516', 0, 97, 'GASTOS_ADMINISTRATIVOS', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-07-29', 'PLAYBOOK TECHNOLOGIES NEW YORK', 0, -28.37, 'GASTOS_ADMINISTRATIVOS', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-08-13', 'SP MYFONTS INC MYFONTS.COM', 0, 18, 'GASTOS_ADMINISTRATIVOS', 'No'],

  // Cobro fraudulento: tres cargos identicos el mismo dia, reclamados
  // al banco. Categoria propia para que NO se mezclen con el gasto
  // operativo real y queden a la vista hasta que llegue la devolucion.
  ['03_Banco_Industrial', '2026-07-22', 'DANNASSTOREGT', 800, 0, 'CARGO_FRAUDULENTO', 'No']
];

function _f12(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _n12(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function clasificarUltimas12() {
  var ss = SpreadsheetApp.openById(SHEET_ID_U12);
  var escritas = 0, avisos = [];

  for (var i = 0; i < LOTE.length; i++) {
    var it = LOTE[i], c = MAPA_U12[it[0]], sh = ss.getSheetByName(it[0]);
    if (!sh) { avisos.push('No existe la hoja ' + it[0]); continue; }

    var datos = sh.getDataRange().getValues(), hit = 0;
    for (var r = 0; r < datos.length; r++) {
      var fila = datos[r];
      if (_f12(fila[c[0] - 1]) !== it[1]) continue;
      if (String(fila[c[1] - 1] || '').trim().toUpperCase() !== it[2].toUpperCase()) continue;
      if (Math.abs(_n12(fila[c[2] - 1]) - it[3]) > 0.01) continue;
      if (c[3] && Math.abs(_n12(fila[c[3] - 1]) - it[4]) > 0.01) continue;
      if (sh.getRange(r + 1, c[4]).getValue() !== 'POR_CLASIFICAR') continue;
      sh.getRange(r + 1, c[4]).setValue(it[5]);
      sh.getRange(r + 1, c[5]).setValue(it[6]);
      escritas++; hit++;
    }
    if (!hit) avisos.push('Sin coincidencias pendientes: ' + it[0] + ' ' + it[1] + ' ' + it[2]);
  }

  Logger.log('Partidas clasificadas: ' + escritas);
  for (var z = 0; z < avisos.length; z++) Logger.log('  ' + avisos[z]);
  contarPendientesU12();
}

function contarPendientesU12() {
  var ss = SpreadsheetApp.openById(SHEET_ID_U12), total = 0;
  for (var h in MAPA_U12) {
    var sh = ss.getSheetByName(h);
    if (!sh) continue;
    var col = sh.getRange(1, MAPA_U12[h][4], sh.getLastRow(), 1).getValues(), n = 0;
    for (var r = 0; r < col.length; r++) if (col[r][0] === 'POR_CLASIFICAR') n++;
    if (n) Logger.log('  quedan en ' + h + ': ' + n);
    total += n;
  }
  Logger.log('TOTAL en POR_CLASIFICAR: ' + total);
}
