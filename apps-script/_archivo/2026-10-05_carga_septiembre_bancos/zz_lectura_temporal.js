// TEMPORAL (5-oct-2026): solo lectura, para ver como se categorizo agosto en BAC y TC
// antes de cargar septiembre. Se borra del proyecto en la misma sesion.
function zzLeerHoja(hoja, desde, hasta, filaEnc) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  var w = sh.getDataRange().getValues(), out = [w[(filaEnc || 4) - 1].map(String).join(' | ')];
  for (var r = (filaEnc || 4); r < w.length; r++) {
    var f = _fechaCarga(w[r][0]); if (!f) continue;
    var s = Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd');
    if (s < desde || s > hasta) continue;
    out.push((r + 1) + ' | ' + s + ' | ' + w[r].slice(1).map(function (x) { return x instanceof Date ? 'D' : String(x); }).join(' | '));
  }
  return out.join('\n');
}
function zzBuscar(hoja, colDesc, patron) {
  var w = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja).getDataRange().getValues(), re = new RegExp(patron, 'i'), out = [];
  for (var r = 4; r < w.length; r++) if (re.test(String(w[r][colDesc - 1]))) {
    var f = _fechaCarga(w[r][0]);
    out.push((r + 1) + ' | ' + (f ? Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd') : '') + ' | ' + w[r].slice(1, 9).map(String).join(' | '));
  }
  return out.slice(-12).join('\n');
}
