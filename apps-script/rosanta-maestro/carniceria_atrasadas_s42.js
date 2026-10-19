// ============================================================
// ROSANTA - Carniceria Santa Rosa: 7 facturas atrasadas fuera del calculo
// 19 oct 2026. Generado desde el espejo del 19-oct 10:29.
//
// QUE ARREGLA
// El NIT 7616325 (MARIA ESPERANZA VASQUEZ TECUN DE PAREDES, "CARNICERIA SANTA ROSA")
// emitio el 15-oct, entre las 12:47 y las 13:25, 9 facturas FPEQ (una anulada).
// Juanma, 19-oct-2026: son facturas ATRASADAS, emitidas todas el mismo dia, de
// compras que ya se contaron cuando se pagaron con retiros de cajero
// (ALIMENTOS_EFECTIVO). En la S42 cuenta solo la ultima emitida (318658AD,
// 13:25:54, Q1,690.50). Las otras 7 (Q8,405.50) salen del calculo.
//
// POR QUE IMPORTA
// Contadas como ALIMENTOS subian la compra de cocina de la S42 a Q17,050 (114.8%
// de su venta): el mismo costo contado dos veces, por el retiro y por la factura.
//
// QUE ESCRIBE
// 01_FEL_Maestro: las 7 facturas -> Categoria = PERIODO_ANTERIOR (FIN_FUERA en
// FinanzasDatos.js: gasto de un periodo anterior que ya se conto alli). La celda
// tiene el VLOOKUP de 00_Proveedores; se escribe el valor encima SOLO en esas 7
// filas, asi el proveedor sigue en ALIMENTOS para las facturas que vengan.
// Se buscan por NIT + Numero_DTE + Gran_Total, nunca por numero de fila. Solo
// escribe donde la categoria de hoy es ALIMENTOS. Se puede correr dos veces.
//
// COMO SE CORRE: menu "Rosanta" del maestro, "Reclasificar lote: revisar" y despues
// "Reclasificar lote: APLICAR" (ver cargador.js, menuReclas*).
// ============================================================

var CS_NIT = '7616325';
var CS_NUEVA = 'PERIODO_ANTERIOR';
// [Numero_DTE, Gran_Total] de las 7 atrasadas. Queda contando la 4258680372 (Q1,690.50).
var CS_FEL = [['2365476096', 1449.00], ['3230156549', 720.00], ['2689813217', 1690.50],
              ['4170728519', 2055.50], ['4168306314', 966.00], ['3277144968', 630.00],
              ['2724021840', 894.50]];

function _csNit(v) { return String(v == null ? '' : v).trim().replace(/\.0$/, ''); }

function _csCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var avisos = [], hechas = [];
  var hf = ss.getSheetByName('01_FEL_Maestro'), df = hf.getDataRange().getValues(), hi = -1;
  for (var i = 0; i < Math.min(df.length, 10); i++) if (df[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  if (hi < 0) { Logger.log('NO SE HIZO NADA: no encontre el encabezado de 01_FEL_Maestro.'); return; }
  var H = df[hi].map(function (h) { return String(h).trim(); });
  var iNit = H.indexOf('NIT_Emisor'), iNum = H.indexOf('Numero_DTE'), iTot = H.indexOf('Gran_Total'), iCat = H.indexOf('Categoría');
  if (iNit < 0 || iNum < 0 || iTot < 0 || iCat < 0) { Logger.log('NO SE HIZO NADA: faltan columnas en 01_FEL_Maestro.'); return; }

  var filasOk = [];
  CS_FEL.forEach(function (it) {
    var filas = [];
    for (var r = hi + 1; r < df.length; r++) {
      if (_csNit(df[r][iNit]) === CS_NIT && _csNit(df[r][iNum]) === it[0]) filas.push(r);
    }
    if (filas.length !== 1) { avisos.push('FEL ' + it[0] + ': ' + filas.length + ' filas. No se toca.'); return; }
    var r = filas[0], tot = Math.round(Number(df[r][iTot]) * 100) / 100, actual = String(df[r][iCat] || '').trim();
    if (Math.abs(tot - it[1]) > 0.01) { avisos.push('FEL ' + it[0] + ': total ' + tot + ', se esperaba ' + it[1] + '. No se toca.'); return; }
    if (actual === CS_NUEVA) { hechas.push('FEL ' + it[0] + ': ya estaba en ' + CS_NUEVA); filasOk.push(r); return; }
    if (actual !== 'ALIMENTOS') { avisos.push('FEL ' + it[0] + ' dice "' + actual + '", se esperaba ALIMENTOS. No se toca.'); return; }
    if (escribir) hf.getRange(r + 1, iCat + 1).setValue(CS_NUEVA);
    filasOk.push(r);
    hechas.push('FEL ' + it[0] + ' (Q' + it[1] + '): ALIMENTOS -> ' + CS_NUEVA);
  });

  Logger.log(escribir ? '=== CARNICERIA S42: ESCRITAS ===' : '=== CARNICERIA S42: SIMULACION, no se escribio nada ===');
  hechas.forEach(function (x) { Logger.log('   ' + x); });

  // Relee lo escrito: un "escritas" que no se verifica no prueba nada
  if (escribir) {
    SpreadsheetApp.flush();
    var df2 = hf.getDataRange().getValues(), mal = [];
    filasOk.forEach(function (r) { if (String(df2[r][iCat] || '').trim() !== CS_NUEVA) mal.push(_csNit(df2[r][iNum]) + '=' + df2[r][iCat]); });
    if (mal.length) avisos.push('Releido: ' + mal.length + ' factura(s) siguen sin ' + CS_NUEVA + ': ' + mal.join(', '));
    else Logger.log('Releido: ' + filasOk.length + ' de ' + CS_FEL.length + ' facturas en ' + CS_NUEVA + '.');
  }
  if (avisos.length) { Logger.log('--- revisar ---'); avisos.forEach(function (x) { Logger.log('   ' + x); }); }
  else Logger.log('Sin avisos (Carniceria S42).');
}

/** Solo reporta. No escribe nada. */
function revisarCarniceriaS42() { _csCorrer(false); }

/** Escribe PERIODO_ANTERIOR en las 7 facturas atrasadas. */
function aplicarCarniceriaS42() { _csCorrer(true); }
