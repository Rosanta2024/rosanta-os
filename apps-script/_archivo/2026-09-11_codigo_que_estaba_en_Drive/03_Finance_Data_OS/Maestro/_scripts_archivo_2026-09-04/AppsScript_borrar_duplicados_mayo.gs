// ============================================================
// ROSANTA - Borrar las 54 filas duplicadas de mayo en 01_FEL_Maestro
// Preparado el 3 sep 2026 a pedido de Juanma.
//
// QUE BORRA
// Un bloque de filas de mayo entro dos veces al libro. La copia mala se
// reconoce sola: no trae Numero_DTE, y existe otra fila con la MISMA
// serie, el MISMO proveedor y el MISMO monto que si lo trae.
// 54 filas, Q21,748.40 de gasto que nunca ocurrio.
//
// Confirmado contra SAT en el caso de EX SECURITY GROUP: existe una
// sola factura, serie D1964C6C, DTE 2476559877.
//
// COMO DECIDE - no hay lista de filas
// Reconstruye la lista leyendo la hoja cada vez. Borra una fila solo si
// se cumplen las CUATRO:
//   1. no tiene Numero_DTE
//   2. es del año y mes configurados abajo
//   3. existe otra fila con la misma serie que SI tiene Numero_DTE
//   4. esa otra fila tiene el mismo proveedor y el mismo monto
// Si la gemela no aparece, la fila NO se toca y se reporta.
//
// Nunca trabaja por numero de fila fijo: los numeros de este chat salen
// del espejo y podrian haberse movido. Y borra de abajo hacia arriba,
// que es el error clasico al hacerlo a mano.
//
// LAS 5 QUE NO SE TOCAN
// Otras 5 filas sin DTE en mayo NO tienen gemela (Q1,583.36): filas 987,
// 989, 992, 1008 y 1026 del espejo. Su "serie" es un numero y no un
// codigo de FEL, asi que entraron por otra via. Se dejan y se reportan.
//
// SEGURIDAD
//   · Arranca en PREVIEW. Borrar no se deshace, asi que la primera
//     corrida solo lista. Son dos corridas y treinta segundos.
//   · Al aplicar, PRIMERO duplica 01_FEL_Maestro completa en una hoja
//     oculta de respaldo, y solo despues borra. Si algo sale mal, ahi
//     esta el libro entero como estaba.
//   · Idempotente: corrido dos veces, la segunda no encuentra nada.
//
// EFECTO SECUNDARIO MENOR
// Las 151 formulas del maestro usan rangos 5:4000. Al borrar 54 filas
// dentro de ese rango, Sheets los encoge a 5:3946. No es problema: el
// FEL tiene ~1,040 filas y sobra muchisimo espacio.
//
// NOMBRES CON SUFIJO BOR
// En Apps Script todos los archivos comparten el ambito global. Este
// usa BOR en todo para no chocar con marcar_duplicados_mayo.js, que usa
// DUP. Los dos pueden convivir sin romperse.
//
// USO
//   1. correr "borrarDuplicadosMayo" tal cual -> lista, no borra
//   2. contrastar con la tabla del chat
//   3. poner PREVIEW_BOR = false
//   4. correr otra vez -> respalda y borra
// ============================================================

var PREVIEW_BOR = true;    // <-- poner en false para borrar de verdad

var SHEET_ID_BOR = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_BOR     = '01_FEL_Maestro';
var ANIO_BOR     = 2026;
var MES_BOR      = 5;
var FILA_1_BOR   = 5;      // primera fila de datos

// Columnas de 01_FEL_Maestro (1 = A)
var CB_FECHA = 1, CB_SERIE = 3, CB_DTE = 4, CB_PROV = 7,
    CB_TOTAL = 10, CB_ANIO = 12, CB_CAT = 14, CB_MES = 16;

function _txtBOR(v) { return String(v == null ? '' : v).trim(); }
function _numBOR(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function _fecBOR(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return _txtBOR(v);
}

function borrarDuplicadosMayo() {
  var ss = SpreadsheetApp.openById(SHEET_ID_BOR);
  var sh = ss.getSheetByName(HOJA_BOR);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_BOR);

  var datos = sh.getDataRange().getValues();

  // Indice de series que SI tienen DTE, para buscar la gemela.
  var conDte = {};
  for (var r = FILA_1_BOR - 1; r < datos.length; r++) {
    var serie = _txtBOR(datos[r][CB_SERIE - 1]);
    if (!serie || !_txtBOR(datos[r][CB_DTE - 1])) continue;
    if (!conDte[serie]) conDte[serie] = [];
    conDte[serie].push({ fila: r + 1, prov: _txtBOR(datos[r][CB_PROV - 1]),
                         monto: _numBOR(datos[r][CB_TOTAL - 1]),
                         fecha: _fecBOR(datos[r][CB_FECHA - 1]),
                         dte: _txtBOR(datos[r][CB_DTE - 1]) });
  }

  var borrar = [], sinGemela = [], total = 0;
  for (var r2 = FILA_1_BOR - 1; r2 < datos.length; r2++) {
    var f = datos[r2];
    if (_txtBOR(f[CB_DTE - 1])) continue;                 // 1. tiene DTE -> no es copia
    if (!_txtBOR(f[CB_SERIE - 1])) continue;              // fila vacia
    if (Number(f[CB_ANIO - 1]) !== ANIO_BOR) continue;    // 2. año
    if (Number(f[CB_MES - 1]) !== MES_BOR) continue;      //    y mes
    var serie2 = _txtBOR(f[CB_SERIE - 1]);
    var prov = _txtBOR(f[CB_PROV - 1]), monto = _numBOR(f[CB_TOTAL - 1]);
    var cand = conDte[serie2] || [];
    var gemela = null;
    for (var k = 0; k < cand.length; k++) {               // 3. y 4. gemela exacta
      if (cand[k].prov === prov && Math.abs(cand[k].monto - monto) < 0.01) { gemela = cand[k]; break; }
    }
    var info = { fila: r2 + 1, fecha: _fecBOR(f[CB_FECHA - 1]), prov: prov, monto: monto,
                 serie: serie2, cat: _txtBOR(f[CB_CAT - 1]), gemela: gemela };
    if (gemela) { borrar.push(info); total += monto; }
    else sinGemela.push(info);
  }

  Logger.log((PREVIEW_BOR ? 'PREVIEW · se borrarian ' : 'Borradas ') + borrar.length +
             ' filas · Q' + total.toFixed(2));
  borrar.forEach(function (x) {
    Logger.log('  fila ' + x.fila + '  ' + x.fecha + '  ' + x.prov + '  Q' + x.monto.toFixed(2) +
               '   serie ' + x.serie + '  ->  gemela en fila ' + x.gemela.fila +
               ' (' + x.gemela.fecha + ', DTE ' + x.gemela.dte + ')');
  });

  if (sinGemela.length) {
    Logger.log('');
    Logger.log('SIN GEMELA - no se tocan: ' + sinGemela.length);
    sinGemela.forEach(function (x) {
      Logger.log('  fila ' + x.fila + '  ' + x.fecha + '  ' + x.prov + '  Q' + x.monto.toFixed(2) +
                 '   serie ' + x.serie + '  [' + x.cat + ']');
    });
  }

  if (!borrar.length) {
    Logger.log('');
    Logger.log('Nada que borrar. Puede que ya se haya corrido.');
    return;
  }

  if (PREVIEW_BOR) {
    Logger.log('');
    Logger.log('PREVIEW: no se borro nada. Contrastar la lista, poner PREVIEW_BOR = false');
    Logger.log('y volver a correr.');
    return;
  }

  // Respaldo COMPLETO antes de tocar nada. Esto no se deshace de otra forma.
  var nombreBk = '_RESPALDO_01_FEL_' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  sh.copyTo(ss).setName(nombreBk).hideSheet();
  Logger.log('');
  Logger.log('Respaldo completo de la hoja en "' + nombreBk + '" (oculta).');

  // De abajo hacia arriba: borrando de arriba, los numeros de las de abajo se corren.
  borrar.sort(function (a, b) { return b.fila - a.fila; });
  borrar.forEach(function (x) { sh.deleteRow(x.fila); });

  Logger.log('LISTO: ' + borrar.length + ' filas borradas, Q' + total.toFixed(2) + ' de gasto duplicado.');
  Logger.log('Revisar el P&L de mayo 2026: el resultado operativo mejora en ese monto, y el IVA');
  Logger.log('credito del mes baja, asi que el "A pagar" a SAT sube.');
  Logger.log('Si algo quedo mal, la hoja "' + nombreBk + '" tiene el libro completo como estaba.');
}
