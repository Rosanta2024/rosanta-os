// ============================================================
// ROSANTA - Importar FEL emitidas a 01b_FEL_Emitidas
//
// Lee el archivo PEGAR_01b_FEL_Emitidas_jul-ago2026.csv de la carpeta
// Maestro y escribe las filas al final de la hoja 01b_FEL_Emitidas.
//
// Trae julio (195 facturas, Q143,539.10, IVA Q15,379.19) y
// agosto (230 facturas, Q169,947.55, IVA Q18,208.67).
//
// Antes de escribir cada fila verifica que la pareja (Serie, Numero)
// no exista ya en la hoja. Si la corres dos veces, la segunda no
// duplica nada: reporta cuantas salteo.
//
// Las columnas J (Ano) y K (Mes) se rellenan con la formula, igual
// que las filas que ya estaban.
//
// USO: Files > + > Script, nombre "importarFEL", pegar, guardar,
//      correr "importarFELEmitidas".
// ============================================================

var SHEET_ID_FEL = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var CSV_ID = '1MShOsp9ciLI9DDaqHvs-KGGMRhOF-9Ib';
var HOJA_FEL = '01b_FEL_Emitidas';

function importarFELEmitidas() {
  var ss = SpreadsheetApp.openById(SHEET_ID_FEL);
  var sh = ss.getSheetByName(HOJA_FEL);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_FEL);

  // --- lo que ya esta cargado: pareja (Serie, Numero)
  var ultima = sh.getLastRow();
  var existentes = {};
  if (ultima >= 4) {
    var previos = sh.getRange(4, 2, ultima - 3, 2).getValues();
    for (var i = 0; i < previos.length; i++) {
      var s = String(previos[i][0] || '').trim();
      var n = String(previos[i][1] || '').trim().replace(/\.0$/, '');
      if (s) existentes[s + '|' + n] = true;
    }
  }

  // --- leer el CSV (viene separado por tabuladores)
  var texto = DriveApp.getFileById(CSV_ID).getBlob().getDataAsString('UTF-8');
  var lineas = texto.split('\n');
  var nuevas = [], saltadas = 0;

  for (var j = 0; j < lineas.length; j++) {
    var linea = lineas[j].replace(/\r$/, '');
    if (!linea) continue;
    var c = linea.split('\t');
    if (c.length < 9) continue;

    var serie = String(c[1]).trim();
    var numero = String(c[2]).trim().replace(/\.0$/, '');
    if (existentes[serie + '|' + numero]) { saltadas++; continue; }
    existentes[serie + '|' + numero] = true;

    var p = String(c[0]).split('-');
    nuevas.push([
      new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])), // Fecha
      serie,                    // Serie
      numero,                   // Numero
      String(c[3]).trim(),      // NIT_Emisor
      String(c[4]).trim(),      // Receptor
      String(c[5]).trim(),      // Estado
      String(c[6]).trim(),      // Moneda
      Number(c[7]),             // Gran_Total
      Number(c[8])              // IVA
    ]);
  }

  if (!nuevas.length) {
    Logger.log('No habia nada nuevo que importar. Saltadas por duplicado: ' + saltadas);
    return;
  }

  var inicio = ultima + 1;
  sh.getRange(inicio, 1, nuevas.length, 9).setValues(nuevas);

  // Formulas de Ano y Mes, iguales a las filas que ya estaban
  var formulas = [];
  for (var k = 0; k < nuevas.length; k++) {
    var f = inicio + k;
    formulas.push(['=IF(A' + f + '="","",YEAR(A' + f + '))',
                   '=IF(A' + f + '="","",MONTH(A' + f + '))']);
  }
  sh.getRange(inicio, 10, formulas.length, 2).setFormulas(formulas);

  sh.getRange(inicio, 1, nuevas.length, 1).setNumberFormat('yyyy-mm-dd');

  var totQ = 0, totIVA = 0;
  for (var m = 0; m < nuevas.length; m++) { totQ += nuevas[m][7]; totIVA += nuevas[m][8]; }

  Logger.log('Importadas: ' + nuevas.length + ' facturas (filas ' + inicio +
             ' a ' + (inicio + nuevas.length - 1) + ')');
  Logger.log('Gran Total: Q' + totQ.toFixed(2) + ' | IVA: Q' + totIVA.toFixed(2));
  Logger.log('Saltadas por duplicado: ' + saltadas);
}

/** Resumen de lo que hay cargado, por mes. */
function resumenFELEmitidas() {
  var sh = SpreadsheetApp.openById(SHEET_ID_FEL).getSheetByName(HOJA_FEL);
  var datos = sh.getRange(4, 1, sh.getLastRow() - 3, 9).getValues();
  var acum = {};
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i][0];
    if (!(f instanceof Date)) continue;
    var k = f.getFullYear() + '-' + ('0' + (f.getMonth() + 1)).slice(-2);
    if (!acum[k]) acum[k] = { n: 0, q: 0, iva: 0 };
    acum[k].n++;
    acum[k].q += Number(datos[i][7]) || 0;
    acum[k].iva += Number(datos[i][8]) || 0;
  }
  var meses = Object.keys(acum).sort();
  for (var j = 0; j < meses.length; j++) {
    var a = acum[meses[j]];
    Logger.log(meses[j] + ': ' + a.n + ' facturas | Q' + a.q.toFixed(2) +
               ' | IVA Q' + a.iva.toFixed(2));
  }
}
