// ============================================================
// ROSANTA - Dos correcciones decididas por Juanma el 15 sep 2026
//
// 1. LA FACTURA DE LA ABOGADA (Q2,000 fuera del DRE)
//    DTE 3948563532 · 07-sep-2026 · Q2,000 · Lusmila Barrientos Barrera,
//    NIT 19644906, establecimiento "SERVICIOS PROFESIONALES DE ABOGACIA Y
//    NOTARIALES". Su Categoria dice el nombre del establecimiento, que no es una
//    categoria: el calculo no la reconoce y la dejaba fuera (fuga de Q2,000).
//    -> SERVICIOS PROFESIONALES en la factura. Y el proveedor se agrega a
//       00_Proveedores con esa categoria, para que la proxima factura entre sola.
//
// 2. Q500 "F-TORRE CUIDAD VIEJA" DEL 28-06 (03_Banco_Industrial, Docto 8304)
//    Retiro en efectivo para comprar mercado, sin factura. Estaba como ALIMENTOS:
//    la regla 3 salta la mercaderia pagada desde el banco porque asume que la
//    factura vino por FEL, y aca no hay factura.
//    -> ALIMENTOS_EFECTIVO, el bucket de alimentos sin factura, que si suma.
//
// COMO FUNCIONA
// Busca por llave (Numero_DTE, Docto, nombre del proveedor), nunca por numero de
// fila, y verifica fecha, monto y texto antes de tocar. Si algo no cuadra, no lo
// toca y lo reporta. Relee lo escrito. Se puede correr dos veces sin dano.
// Las celdas se escriben como TEXTO (lo aprendido con las fechas del FEL).
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarAbogadaYTorre()    no escribe. Tiene que decir 3 cambios y "Sin avisos".
//   2. aplicarAbogadaYTorre()
//   3. revisarAbogadaYTorre()    tiene que decir 0 cambios y 3 ya estaban bien.
//   4. generarEspejo()
// ============================================================

var SHEET_ID_PA = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var PA_ESTAB = 'SERVICIOS PROFESIONALES DE ABOGACIA Y NOTARIALES';
var PA_CAT = 'SERVICIOS PROFESIONALES';

function _paLlave(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _paFecha(d) {
  if (!(d instanceof Date)) return String(d || '').trim();
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}

function _paCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_PA);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var avisos = [], cambios = [], yaEstaban = [], tareas = [];

  // ---- 1a. la factura en 01_FEL_Maestro
  var fel = ss.getSheetByName('01_FEL_Maestro');
  var F = fel.getDataRange().getValues(), filasFel = [];
  for (var r = 4; r < F.length; r++) if (_paLlave(F[r][3]) === '3948563532') filasFel.push(r);
  if (filasFel.length !== 1) {
    avisos.push('FEL DTE 3948563532: ' + filasFel.length + ' filas (se esperaba 1). No se toca.');
  } else {
    var rf = filasFel[0], catFel = String(F[rf][13] || '').trim();
    var okFel = _paFecha(F[rf][0]) === '2026-09-07' && Math.abs(Number(F[rf][9]) - 2000) < 0.01 &&
                String(F[rf][6] || '').trim() === PA_ESTAB;
    if (!okFel) {
      avisos.push('FEL DTE 3948563532 no cuadra: fecha ' + _paFecha(F[rf][0]) + ' · monto ' + F[rf][9] +
                  ' · establecimiento "' + F[rf][6] + '". No se toca.');
    } else if (catFel === PA_CAT) {
      yaEstaban.push('FEL DTE 3948563532 ya dice ' + PA_CAT);
    } else if (catFel !== PA_ESTAB) {
      avisos.push('FEL DTE 3948563532 dice "' + catFel + '" y se esperaba "' + PA_ESTAB + '". No se toca.');
    } else {
      var celda = fel.getRange(rf + 1, 14), formula = celda.getFormula();
      cambios.push('FEL fila ' + (rf + 1) + ' DTE 3948563532: categoria "' + catFel + '" -> ' + PA_CAT +
                   (formula ? ' (la celda es formula: la corrige el proveedor)' : ''));
      if (!formula) tareas.push({ celda: celda, valor: PA_CAT, que: 'FEL DTE 3948563532' });
    }
  }

  // ---- 1b. el proveedor en 00_Proveedores (A Proveedor · C Categoria_Normalizada · D Es_Personal)
  var prov = ss.getSheetByName('00_Proveedores');
  var P = prov.getDataRange().getValues(), filasProv = [];
  for (var p = 4; p < P.length; p++) if (String(P[p][0] || '').trim() === PA_ESTAB) filasProv.push(p);
  if (filasProv.length > 1) {
    avisos.push('00_Proveedores: ' + filasProv.length + ' filas con "' + PA_ESTAB + '". No se toca.');
  } else if (filasProv.length === 1) {
    var catProv = String(P[filasProv[0]][2] || '').trim();
    if (catProv === PA_CAT) yaEstaban.push('00_Proveedores ya tiene al proveedor como ' + PA_CAT);
    else avisos.push('00_Proveedores fila ' + (filasProv[0] + 1) + ' dice "' + catProv + '". No se toca: revisar.');
  } else {
    cambios.push('00_Proveedores: agregar "' + PA_ESTAB + '" como ' + PA_CAT + ', Es_Personal No');
    tareas.push({ fila: [PA_ESTAB, '', PA_CAT, 'No',
                         'Lusmila Barrientos Barrera, NIT 19644906. Agregado el 15-sep-2026.', ''],
                  hoja: prov, que: '00_Proveedores' });
  }

  // ---- 2. el retiro de mercado en 03_Banco_Industrial
  var bi = ss.getSheetByName('03_Banco_Industrial');
  var B = bi.getDataRange().getValues(), filasBi = [];
  for (var b = 4; b < B.length; b++) if (_paLlave(B[b][1]) === '8304') filasBi.push(b);
  if (filasBi.length !== 1) {
    avisos.push('BI Docto 8304: ' + filasBi.length + ' filas (se esperaba 1). No se toca.');
  } else {
    var rb = filasBi[0], catBi = String(B[rb][6] || '').trim();
    var okBi = _paFecha(B[rb][0]) === '2026-06-28' && String(B[rb][2] || '').trim() === 'F-TORRE CUIDAD VIEJA' &&
               Math.abs(Number(B[rb][3]) - 500) < 0.01;
    if (!okBi) {
      avisos.push('BI Docto 8304 no cuadra: ' + _paFecha(B[rb][0]) + ' "' + B[rb][2] + '" Q' + B[rb][3] + '. No se toca.');
    } else if (catBi === 'ALIMENTOS_EFECTIVO') {
      yaEstaban.push('BI Docto 8304 ya dice ALIMENTOS_EFECTIVO');
    } else if (catBi !== 'ALIMENTOS') {
      avisos.push('BI Docto 8304 dice "' + catBi + '" y se esperaba "ALIMENTOS". No se toca.');
    } else {
      cambios.push('BI fila ' + (rb + 1) + ' Docto 8304: ALIMENTOS -> ALIMENTOS_EFECTIVO');
      tareas.push({ celda: bi.getRange(rb + 1, 7), valor: 'ALIMENTOS_EFECTIVO', que: 'BI Docto 8304' });
    }
  }

  // ---- escribir y releer
  var noQuedaron = [];
  if (escribir && !avisos.length) {
    tareas.forEach(function (t) {
      if (t.fila) t.hoja.appendRow(t.fila);
      else t.celda.setValue(t.valor);
    });
    SpreadsheetApp.flush();
    tareas.forEach(function (t) {
      if (t.celda && String(t.celda.getValue()).trim() !== t.valor) {
        noQuedaron.push(t.que + ': la hoja dice "' + t.celda.getValue() + '"');
      }
    });
    // si la categoria de la factura es formula, recien ahora refleja al proveedor nuevo
    if (filasFel.length === 1) {
      var ahora = String(fel.getRange(filasFel[0] + 1, 14).getValue()).trim();
      if (ahora !== PA_CAT) noQuedaron.push('FEL DTE 3948563532 sigue diciendo "' + ahora + '"');
    }
  }

  Logger.log(escribir ? (avisos.length ? '=== NO SE ESCRIBIO: hay avisos ===' : '=== ESCRITAS ===')
                      : '=== SIMULACION, no se escribio nada ===');
  Logger.log(cambios.length + ' cambios · ya estaban bien: ' + yaEstaban.length);
  cambios.forEach(function (x) { Logger.log('   ' + x); });
  yaEstaban.forEach(function (x) { Logger.log('   ok: ' + x); });
  if (escribir && !avisos.length) {
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
function revisarAbogadaYTorre() { _paCorrer(false); }

/** Escribe los tres cambios. No escribe nada si la revision tiene avisos. */
function aplicarAbogadaYTorre() { _paCorrer(true); }
