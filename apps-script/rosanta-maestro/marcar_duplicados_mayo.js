// ============================================================
// ROSANTA - Marcar como DUPLICADO las 54 filas repetidas de mayo
// Preparado el 3 sep 2026.
//
// QUE PASO
// Un bloque contiguo de filas de mayo entro DOS VECES al libro. La
// copia mala se reconoce sola: no trae Numero_DTE, y existe otra fila
// con la MISMA serie, el MISMO proveedor y el MISMO monto que si lo
// trae, fechada un dia despues.
//
// Confirmado contra SAT en el caso de EX SECURITY GROUP: existe una
// sola factura, serie D1964C6C, DTE 2476559877. La copia sin DTE no
// existe en ninguna parte salvo en este libro.
//
// 54 filas, Q21,748.40 de gasto que nunca ocurrio, todo en mayo.
//
// POR QUE MARCAR Y NO BORRAR
// El 3-sep se agrego el filtro Estado="Vigente" a las 151 formulas que
// suman el FEL. Entonces cualquier fila cuyo Estado NO diga exactamente
// "Vigente" ya queda fuera de todos los calculos, sin excepcion.
//
// Marcarlas como DUPLICADO logra exactamente el mismo efecto en los
// numeros que borrarlas, y ademas:
//   · la fila sigue ahi, con su fecha, proveedor y monto
//   · se deshace cambiando una celda (desmarcarDuplicadosMayo)
//   · queda constancia de POR QUE se excluyo, que es lo que un libro
//     contable deberia conservar
// Borrar filas de un libro no se deshace y no deja rastro. Marcar es
// mejor por los tres lados.
//
// COMO DECIDE QUE MARCAR - no hay lista fija
// El script no lleva un listado de filas: lo reconstruye leyendo la
// hoja cada vez. Marca una fila solo si se cumplen las CINCO:
//   1. no tiene Numero_DTE
//   2. es del año y mes configurados abajo
//   3. su Estado dice hoy "Vigente" (o sea, todavia esta contando)
//   4. existe otra fila con la misma serie que SI tiene Numero_DTE
//   5. esa otra fila tiene el mismo proveedor y el mismo monto
// Si la gemela no aparece, la fila NO se toca y se reporta. Asi el
// script no puede marcar algo que no sea un duplicado probado, aunque
// la hoja haya cambiado desde que se escribio esto.
//
// La condicion 3 es ademas lo que lo hace idempotente: una vez marcada,
// la fila ya no dice "Vigente" y no se vuelve a tocar.
//
// LAS 5 QUE NO SE TOCAN
// Hay otras 5 filas sin DTE en mayo que NO tienen gemela (Q1,583.36).
// Su "serie" ademas es un numero y no un codigo hexadecimal de FEL,
// asi que entraron por otra via. El script las deja y las reporta.
// Revisarlas una por una antes de decidir nada.
//
// Y LO IMPORTANTE, QUE ESTE SCRIPT NO ARREGLA
// Esto limpia el sintoma. Si el proceso que importo mayo sigue igual,
// vuelve a pasar. Despues de correr esto hay que averiguar por que se
// duplico: el arreglo de fondo esta en la carga, no en el libro.
// revisarFilasSinDTE() sirve de control despues de cada carga mensual.
//
// USO
//   1. correr "marcarDuplicadosMayo" tal cual -> lista, no escribe
//   2. revisar la lista contra REVISION_duplicados_mayo.md
//   3. poner PREVIEW_DUP = false
//   4. correr otra vez -> marca
//   Para deshacer: "desmarcarDuplicadosMayo".
// ============================================================

var PREVIEW_DUP = false;   // revisado y autorizado por Juanma el 3-sep-2026

var SHEET_ID_DUP = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_DUP     = '01_FEL_Maestro';
var ANIO_DUP     = 2026;
var MES_DUP      = 5;      // solo mayo: es el unico mes con el bloque duplicado.
                           // Si vuelve a pasar en otro mes, cambiar esto DESPUES
                           // de verificar el patron ahi, no antes.
var FILA_1_DUP   = 5;      // primera fila de datos
var MARCA_DUP    = 'DUPLICADO';   // cualquier cosa distinta de "Vigente" excluye la fila.
                                  // Se usa una palabra propia para no confundirla con
                                  // "Anulado", que significa otra cosa: esa la anulo el
                                  // proveedor en SAT, esta la duplico nuestra carga.

// Columnas de 01_FEL_Maestro (1 = A)
var C_FECHA = 1, C_SERIE = 3, C_DTE = 4, C_PROV = 7, C_ESTADO = 8,
    C_TOTAL = 10, C_ANIO = 12, C_CAT = 14, C_MES = 16;

function _txtDUP(v) { return String(v == null ? '' : v).trim(); }
function _numDUP(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function _fechaDUP(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return _txtDUP(v);
}

function marcarDuplicadosMayo() {
  var sh = SpreadsheetApp.openById(SHEET_ID_DUP).getSheetByName(HOJA_DUP);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_DUP);

  var datos = sh.getDataRange().getValues();

  // Indice de series que SI tienen DTE, para buscar la gemela.
  var conDte = {};
  for (var r = FILA_1_DUP - 1; r < datos.length; r++) {
    var serie = _txtDUP(datos[r][C_SERIE - 1]);
    if (!serie || !_txtDUP(datos[r][C_DTE - 1])) continue;
    if (!conDte[serie]) conDte[serie] = [];
    conDte[serie].push({ fila: r + 1, prov: _txtDUP(datos[r][C_PROV - 1]),
                         monto: _numDUP(datos[r][C_TOTAL - 1]),
                         fecha: _fechaDUP(datos[r][C_FECHA - 1]),
                         dte: _txtDUP(datos[r][C_DTE - 1]) });
  }

  var marcar = [], sinGemela = [], total = 0;
  for (var r2 = FILA_1_DUP - 1; r2 < datos.length; r2++) {
    var f = datos[r2];
    if (_txtDUP(f[C_DTE - 1])) continue;                                // 1. tiene DTE -> no es copia
    if (!_txtDUP(f[C_SERIE - 1])) continue;                             // fila vacia
    if (Number(f[C_ANIO - 1]) !== ANIO_DUP) continue;                   // 2. año
    if (Number(f[C_MES - 1]) !== MES_DUP) continue;                     //    y mes
    if (_txtDUP(f[C_ESTADO - 1]) !== 'Vigente') continue;               // 3. ya marcada o anulada
    var serie2 = _txtDUP(f[C_SERIE - 1]);
    var prov = _txtDUP(f[C_PROV - 1]), monto = _numDUP(f[C_TOTAL - 1]);
    var cand = conDte[serie2] || [];
    var gemela = null;
    for (var k = 0; k < cand.length; k++) {                             // 4. y 5. gemela exacta
      if (cand[k].prov === prov && Math.abs(cand[k].monto - monto) < 0.01) { gemela = cand[k]; break; }
    }
    var info = { fila: r2 + 1, fecha: _fechaDUP(f[C_FECHA - 1]), prov: prov, monto: monto,
                 serie: serie2, cat: _txtDUP(f[C_CAT - 1]), gemela: gemela };
    if (gemela) { marcar.push(info); total += monto; }
    else sinGemela.push(info);
  }

  Logger.log((PREVIEW_DUP ? 'PREVIEW · se marcarian ' : 'Marcadas ') + marcar.length +
             ' filas como ' + MARCA_DUP + ' · Q' + total.toFixed(2));
  marcar.forEach(function (x) {
    Logger.log('  fila ' + x.fila + '  ' + x.fecha + '  ' + x.prov + '  Q' + x.monto.toFixed(2) +
               '   serie ' + x.serie + '  ->  gemela en fila ' + x.gemela.fila +
               ' (' + x.gemela.fecha + ', DTE ' + x.gemela.dte + ')');
  });

  if (sinGemela.length) {
    Logger.log('');
    Logger.log('SIN GEMELA - no se tocan, revisar a mano: ' + sinGemela.length);
    sinGemela.forEach(function (x) {
      Logger.log('  fila ' + x.fila + '  ' + x.fecha + '  ' + x.prov + '  Q' + x.monto.toFixed(2) +
                 '   serie ' + x.serie + '  [' + x.cat + ']');
    });
  }

  if (!marcar.length) {
    Logger.log('');
    Logger.log('Nada que marcar. Puede que ya se haya corrido.');
    return;
  }

  if (PREVIEW_DUP) {
    Logger.log('');
    Logger.log('PREVIEW: no se escribio nada. Contrastar esta lista con REVISION_duplicados_mayo.md,');
    Logger.log('poner PREVIEW_DUP = false y volver a correr.');
    return;
  }

  marcar.forEach(function (x) { sh.getRange(x.fila, C_ESTADO).setValue(MARCA_DUP); });

  Logger.log('');
  Logger.log('LISTO: ' + marcar.length + ' filas marcadas como ' + MARCA_DUP + ', Q' + total.toFixed(2) +
             ' de gasto duplicado fuera de los calculos.');
  Logger.log('Las filas siguen en el libro: solo dejaron de sumar, porque las 151 formulas');
  Logger.log('del maestro exigen Estado="Vigente" desde el filtro del 3-sep.');
  Logger.log('Revisar el P&L de mayo 2026: el resultado operativo mejora en ese monto, y el IVA');
  Logger.log('credito del mes baja, asi que el "A pagar" a SAT sube.');
  Logger.log('Para deshacer: desmarcarDuplicadosMayo().');
}

/** Deshace el marcado: todo lo que diga DUPLICADO vuelve a Vigente. */
function desmarcarDuplicadosMayo() {
  var sh = SpreadsheetApp.openById(SHEET_ID_DUP).getSheetByName(HOJA_DUP);
  var datos = sh.getDataRange().getValues(), n = 0, tot = 0;
  for (var r = FILA_1_DUP - 1; r < datos.length; r++) {
    if (_txtDUP(datos[r][C_ESTADO - 1]) !== MARCA_DUP) continue;
    sh.getRange(r + 1, C_ESTADO).setValue('Vigente');
    n++; tot += _numDUP(datos[r][C_TOTAL - 1]);
  }
  Logger.log('Devueltas a "Vigente": ' + n + ' fila(s), Q' + tot.toFixed(2));
  Logger.log('Vuelven a contar en el P&L.');
}

/** Control de solo lectura: cuantas filas sin DTE hay y en que meses.
 *  Correr despues de cada carga mensual: si aparecen muchas de un mismo
 *  mes, esa carga entro dos veces. */
function revisarFilasSinDTE() {
  var sh = SpreadsheetApp.openById(SHEET_ID_DUP).getSheetByName(HOJA_DUP);
  var datos = sh.getDataRange().getValues(), porMes = {}, n = 0, tot = 0;
  for (var r = FILA_1_DUP - 1; r < datos.length; r++) {
    if (!_txtDUP(datos[r][C_SERIE - 1])) continue;
    if (_txtDUP(datos[r][C_DTE - 1])) continue;
    var k = _txtDUP(datos[r][C_ANIO - 1]) + '-' + _txtDUP(datos[r][C_MES - 1]);
    var m = _numDUP(datos[r][C_TOTAL - 1]);
    porMes[k] = (porMes[k] || 0) + m; n++; tot += m;
  }
  Logger.log('--- Filas de FEL sin Numero_DTE ---');
  for (var k2 in porMes) Logger.log('  ' + k2 + ':  Q' + porMes[k2].toFixed(2));
  Logger.log('  ' + n + ' fila(s), Q' + tot.toFixed(2));
  Logger.log('Una fila sin DTE no es siempre un duplicado, pero si aparecen muchas de un mes,');
  Logger.log('la carga de ese mes entro dos veces.');
}
