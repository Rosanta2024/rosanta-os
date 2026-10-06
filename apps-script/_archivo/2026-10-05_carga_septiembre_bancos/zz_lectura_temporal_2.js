// TEMPORAL (5-oct-2026): solo lectura. Se borra del proyecto en la misma sesion.
function zzBuscarMonto(hoja, colMonto, montos) {
  var w = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja).getDataRange().getValues(), out = [];
  for (var r = 4; r < w.length; r++) for (var i = 0; i < montos.length; i++) if (Math.abs(Number(w[r][colMonto - 1]) - montos[i]) < 0.005) {
    var f = _fechaCarga(w[r][0]);
    out.push((r + 1) + ' | ' + (f ? Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd') : '') + ' | ' + w[r].slice(1, 9).map(String).join(' | '));
  }
  return out.join('\n');
}
function zzFilas(hoja, filas, cols) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  return filas.map(function (f) { return f + ' | ' + sh.getRange(f, 1, 1, cols).getValues()[0].map(function (x) { return x instanceof Date ? Utilities.formatDate(x, 'America/Guatemala', 'yyyy-MM-dd') : String(x); }).join(' | '); }).join('\n');
}
function zzBuscarTxt(hoja, colDesc, colCat, patron) {
  var w = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja).getDataRange().getValues(), re = new RegExp(patron, 'i'), c = {};
  for (var r = 4; r < w.length; r++) if (re.test(String(w[r][colDesc - 1]))) { var k = String(w[r][colCat - 1]); c[k] = (c[k] || 0) + 1; }
  return JSON.stringify(c);
}
