// TEMPORAL (5-oct-2026): solo lectura. Se borra del proyecto en la misma sesion.
function zzBuscarMonto(hoja, colMonto, montos) {
  var w = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja).getDataRange().getValues(), out = [];
  for (var r = 4; r < w.length; r++) for (var i = 0; i < montos.length; i++) if (Math.abs(Number(w[r][colMonto - 1]) - montos[i]) < 0.005) {
    var f = _fechaCarga(w[r][0]);
    out.push((r + 1) + ' | ' + (f ? Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd') : '') + ' | ' + w[r].slice(1, 9).map(String).join(' | '));
  }
  return out.join('\n');
}
// Correccion del 5-oct-2026 (Juanma): aportes, no cobros. Solo toca la fila si coincide.
function zzRecatBAC() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('04_Banco_BAC'), out = [];
  [[314, 'ACH DE Sociedad Interna', 73.89], [317, 'ACH DE Sociedad Interna', 10684.34], [325, 'TEF DE:JUAN MANUEL', 450]].forEach(function (x) {
    var w = sh.getRange(x[0], 1, 1, 9).getValues()[0];
    var ok = String(w[3]) === x[1] && Math.abs(Number(w[5]) - x[2]) < 0.005 && String(w[7]) === 'INGRESO_TRANSFERENCIA';
    if (ok) sh.getRange(x[0], 8).setValue('TRANSFERENCIA');
    out.push(x[0] + ' ' + w[3] + ' ' + w[5] + ': ' + (ok ? 'INGRESO_TRANSFERENCIA -> TRANSFERENCIA' : 'NO coincide (' + w[7] + '), no se toca'));
  });
  SpreadsheetApp.flush();
  return out.join('\n');
}
