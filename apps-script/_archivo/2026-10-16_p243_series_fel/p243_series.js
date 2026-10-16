// p243 (16-oct-2026): script de UNA vez. Reescribe como texto las 21 series FEL
// que quedaron guardadas como numero en 01b_FEL_Emitidas. Ubica cada fila por el
// Numero del DTE (columna C), no por numero de fila, y solo escribe si la serie
// actual es la que se espera. Se archiva al terminar.
// Julio y agosto: verificadas contra PEGAR_01b_FEL_Emitidas_jul-ago2026.csv (SAT).
// Septiembre (null): se leen del reporte de la SAT "Emitidos 2026-09".
var P243_SEP_ID = '12dt2E-mYg0KQBcliWBvf2yh-A8NuGsXchZcOWFPY9k0';
var P243_LISTA = [
  ['17779584', '81826423'], ['152849815', '10646478'], ['537021146', '25769312'],
  ['818692194', '89526E65'], ['1737705126', '896139E2'], ['700859352', '90198427'],
  ['949241463', '65553469'], ['1798981534', '23723E94'], ['86065950', '38452644'],
  ['1370507034', '46111596'], ['1021856557', '32695290'], ['2079277744', '09296263'],
  ['138233588', '79158E41'], ['1492601337', '77763261'], ['1957711690', null],
  ['1106398078', null], ['571034683', null], ['1372409762', null],
  ['106318002', null], ['1931300122', null], ['1168918462', null]
];

function p243Aplicar() { return p243_(true); }
function p243Revisar() { return p243_(false); }

function p243_(escribir) {
  var sh = SpreadsheetApp.openById(SHEET_ID_CARGA).getSheetByName('01b_FEL_Emitidas');
  var n = sh.getLastRow();
  var datos = sh.getRange(1, 2, n, 2).getValues();   // B = Serie, C = Numero del DTE
  var porDte = {};
  for (var i = 0; i < n; i++) {
    var dte = String(datos[i][1]).replace(/\.0+$/, '').trim();
    (porDte[dte] = porDte[dte] || []).push(i + 1);
  }
  var sep = {}, fuente = SpreadsheetApp.openById(P243_SEP_ID).getSheets()[0].getDataRange().getDisplayValues();
  for (var k = 1; k < fuente.length; k++) sep[String(fuente[k][4]).trim()] = String(fuente[k][3]).trim();
  var log = [], plan = [], problemas = 0;
  P243_LISTA.forEach(function (par) {
    par = [par[0], par[1] || sep[par[0]] || ''];
    if (!par[1]) { problemas++; log.push('DTE ' + par[0] + ': sin serie en la fuente'); return; }
    var filas = porDte[par[0]] || [];
    if (filas.length !== 1) { problemas++; log.push('DTE ' + par[0] + ': ' + filas.length + ' filas'); return; }
    var fila = filas[0], actual = datos[fila - 1][0];
    var num = Number(actual), esperado = Number(par[1]);
    var coincide = String(actual) === par[1] ||
      (isFinite(num) && isFinite(esperado) && Math.abs(num - esperado) <= Math.abs(esperado) * 1e-4);
    if (!coincide) { problemas++; log.push('DTE ' + par[0] + ' fila ' + fila + ': hoy dice ' + actual + ', esperado ~' + par[1]); return; }
    plan.push([fila, par[1]]);
    log.push('fila ' + fila + ': ' + actual + ' -> ' + par[1]);
  });
  if (escribir) {
    if (problemas) throw new Error('No se escribio nada: ' + problemas + ' problemas.\n' + log.join('\n'));
    sh.getRange(1, 2, n, 1).setNumberFormat('@');
    plan.forEach(function (p) { sh.getRange(p[0], 2).setValue(p[1]); });
    SpreadsheetApp.flush();
    var mal = plan.filter(function (p) { return sh.getRange(p[0], 2).getDisplayValue() !== p[1]; });
    log.push('Escritas ' + plan.length + '; releidas mal: ' + mal.length +
      (mal.length ? ' (' + mal.map(function (p) { return p[0]; }).join(', ') + ')' : ''));
  }
  log.push('Listas ' + plan.length + ' de 21; problemas ' + problemas);
  console.log(log.join('\n'));
  return log.join('\n');
}
