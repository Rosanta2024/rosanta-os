// ============================================================
// ROSANTA - Borrar las facturas EMITIDAS cargadas mas de una vez
// Preparado el 2-oct-2026 a pedido de Juanma (auditoria de octubre).
//
// QUE BORRA
// En 01b_FEL_Emitidas hay 5 facturas que estan 3 veces cada una
// (Q5,819.00 de venta de mas): DTE 818692194, 138233588, 2079277744,
// 1798981534 y 1737705126.
//
// POR QUE ENTRARON
// Su serie de SAT parece un numero ("89526E69", "09296263") y Sheets la
// guardo como numero (8.9526e+69, 9296263). La llave de deduplicacion del
// cargador es "Serie|Numero": la del archivo ("89526E69|818692194") no
// coincide con la guardada ("8.9526e+69|818692194") y la factura entra de
// nuevo cada vez que se relee su carpeta. El cargador se corrigio el mismo
// dia para que no vuelva a pasar.
//
// COMO DECIDE - no hay lista de filas
// Lee la hoja cada vez. Dos filas son la misma factura si tienen el MISMO
// numero de DTE, la MISMA fecha y el MISMO Gran_Total. Se queda con la
// primera (la mas arriba) y borra las demas, de abajo hacia arriba.
// No mira la serie: es justo el campo que esta danado.
//
// SEGURIDAD
//   · revisarTriplicadosEmitidas() solo lista; no borra.
//   · Al aplicar, PRIMERO copia la hoja completa a una hoja oculta de
//     respaldo y solo despues borra.
//   · Idempotente: corrido dos veces, la segunda no encuentra nada.
//
// USO
//   1. correr "revisarTriplicadosEmitidas" -> lista, no borra
//   2. correr "borrarTriplicadosEmitidas"  -> respalda y borra
//   Despues este archivo sale a apps-script/_archivo.
// ============================================================

function borrarTriplicadosEmitidas()  { _triplicadosEmitidas(true); }
function revisarTriplicadosEmitidas() { _triplicadosEmitidas(false); }

var HOJA_TRI   = '01b_FEL_Emitidas';
var FILA_1_TRI = 4;        // primera fila de datos
// Columnas de 01b_FEL_Emitidas (1 = A)
var CT_FECHA = 1, CT_DTE = 3, CT_TOTAL = 8;

function _llaveTRI(fila) {
  var f = fila[CT_FECHA - 1];
  f = (f instanceof Date) ? Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd') : String(f).trim();
  var dte = String(fila[CT_DTE - 1] == null ? '' : fila[CT_DTE - 1]).trim().replace(/\.0$/, '');
  var tot = Math.round(Number(fila[CT_TOTAL - 1]) * 100) / 100;
  return dte ? dte + '|' + f + '|' + tot : '';
}

function _triplicadosEmitidas(borrarDeVerdad) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(HOJA_TRI);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_TRI);
  var ultima = sh.getLastRow();
  var datos = sh.getRange(FILA_1_TRI, 1, ultima - FILA_1_TRI + 1, CT_TOTAL).getValues();

  var vistas = {}, borrar = [], monto = 0;
  for (var i = 0; i < datos.length; i++) {
    var k = _llaveTRI(datos[i]);
    if (!k) continue;
    if (vistas[k]) {
      borrar.push(FILA_1_TRI + i);
      monto += Number(datos[i][CT_TOTAL - 1]) || 0;
      Logger.log('Repetida fila %s (original fila %s): DTE %s  Q%s',
                 FILA_1_TRI + i, vistas[k], datos[i][CT_DTE - 1], datos[i][CT_TOTAL - 1]);
    } else {
      vistas[k] = FILA_1_TRI + i;
    }
  }
  Logger.log('%s filas repetidas, Q%s', borrar.length, monto.toFixed(2));
  if (!borrar.length || !borrarDeVerdad) {
    Logger.log(borrarDeVerdad ? 'Nada que borrar.' : 'REVISION: no se borro nada.');
    return;
  }

  var nombre = 'ZZ_RESPALDO_01b_' + Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyyMMdd_HHmm');
  sh.copyTo(ss).setName(nombre).hideSheet();
  Logger.log('Respaldo: hoja oculta ' + nombre);

  for (var b = borrar.length - 1; b >= 0; b--) sh.deleteRow(borrar[b]);
  Logger.log('Borradas %s filas (Q%s).', borrar.length, monto.toFixed(2));
}
