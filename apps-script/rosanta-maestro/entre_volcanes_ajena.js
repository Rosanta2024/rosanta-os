// ============================================================
// ROSANTA - Entre Volcanes es gasolinera: de BEBIDAS a FACTURA_AJENA
// 8 oct 2026. Generado desde el espejo del 5-oct 19:38.
//
// QUE ARREGLA
// El NIT 115729917 (AGUILA ENTRE VOLCANES, S.A., establecimiento "ENTRE VOLCANES")
// estaba en 00_Proveedores como BEBIDAS, familia CERVEZA. Sus facturas son de
// gasolina SUPER con IDP. Juanma, 8-oct-2026: es gasolinera, y esas facturas se
// piden a nombre de CORSAGA solo para rebajar el IVA; no son de la operacion.
// Primero se dijo VIATICOS y se corrigio en el acto: VIATICOS entra al DRE como gasto.
// Pasa a FACTURA_AJENA (21-sep-2026: factura a nombre de la empresa que no es del
// restaurante ni gasto personal; FIN_FUERA en FinanzasDatos.js, fuera de Pagos). Ningun
// pago a este proveedor sale de las cuentas ni tarjetas de Rosanta (espejo del 5-oct),
// asi que tampoco es extraccion. El IVA lo declara el contador desde el FEL: la
// categoria del maestro no lo cambia.
//
// POR QUE IMPORTA
// BEBIDAS suma al COGS de barra: eran ~Q2,580 de 2026 (37 facturas) contados como
// compra de barra, y en la pantalla de Pagos le aparecian a Maco como suyas.
// Con FACTURA_AJENA salen del DRE y de Pagos.
//
// QUE ESCRIBE
//  1. 00_Proveedores: las dos filas del proveedor ("ENTRE VOLCANES" y "AGUILA ENTRE
//     VOLCANES") -> Categoria_Original y Categoria_Normalizada = FACTURA_AJENA, Familia
//     vacia, y una nota. 33 de las 37 facturas toman la categoria por VLOOKUP sobre
//     esta hoja, asi que cambian solas.
//  2. 01_FEL_Maestro: las 4 facturas de mayo que tienen BEBIDAS escrito a mano (no
//     formula) -> FACTURA_AJENA. Se buscan por NIT + Numero_DTE, nunca por numero de fila.
// Solo escribe donde el valor de hoy es el esperado. Se puede correr dos veces.
//
// COMO SE CORRE: menu "Rosanta" del maestro, "Reclasificar lote: revisar" y despues
// "Reclasificar lote: APLICAR" (ver cargador.js, menuReclas*).
// ============================================================

var EV_NIT = '115729917';
var EV_PROVEEDORES = ['ENTRE VOLCANES', 'ÁGUILA ENTRE VOLCANES'];
var EV_NUEVA = 'FACTURA_AJENA';
var EV_NOTA = 'Gasolinera. Facturas a nombre de CORSAGA solo para el IVA, no son de la operacion (Juanma, 8-oct-2026). Antes BEBIDAS / CERVEZA.';
// [Numero_DTE, Gran_Total] de las facturas con la categoria escrita a mano
var EV_FEL_FIJAS = [['1864256779', 75.03], ['626541406', 93.26], ['2867415383', 85.02], ['3095742584', 75.11]];

function _evNit(v) { return String(v == null ? '' : v).trim().replace(/\.0$/, ''); }

function _evCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var avisos = [], hechas = [];

  // 1. 00_Proveedores (encabezados en la fila 4)
  var hp = ss.getSheetByName('00_Proveedores'), dp = hp.getDataRange().getValues();
  var cab = (dp[3] || []).map(function (h) { return String(h).trim(); });
  var cOrig = cab.indexOf('Categoría_Original'), cNorm = cab.indexOf('Categoría_Normalizada'),
      cNota = cab.indexOf('Notas'), cFam = cab.indexOf('Familia');
  if (cOrig < 0 || cNorm < 0) { Logger.log('NO SE HIZO NADA: 00_Proveedores no tiene las columnas de categoria en la fila 4.'); return; }
  EV_PROVEEDORES.forEach(function (nom) {
    var filas = [];
    for (var r = 4; r < dp.length; r++) if (String(dp[r][0] || '').trim().toUpperCase() === nom) filas.push(r);
    if (filas.length !== 1) { avisos.push('00_Proveedores: "' + nom + '" aparece ' + filas.length + ' veces. No se toca.'); return; }
    var r = filas[0], actual = String(dp[r][cNorm] || '').trim();
    if (actual === EV_NUEVA) { hechas.push('00_Proveedores "' + nom + '": ya estaba en ' + EV_NUEVA + ''); return; }
    if (actual !== 'BEBIDAS') { avisos.push('00_Proveedores "' + nom + '" dice "' + actual + '", se esperaba BEBIDAS. No se toca.'); return; }
    if (escribir) {
      hp.getRange(r + 1, cOrig + 1).setValue(EV_NUEVA);
      hp.getRange(r + 1, cNorm + 1).setValue(EV_NUEVA);
      if (cFam >= 0) hp.getRange(r + 1, cFam + 1).setValue('');
      if (cNota >= 0) hp.getRange(r + 1, cNota + 1).setValue(EV_NOTA);
    }
    hechas.push('00_Proveedores fila ' + (r + 1) + ' "' + nom + '": BEBIDAS -> ' + EV_NUEVA + '');
  });

  // 2. 01_FEL_Maestro: las cuatro con la categoria escrita a mano
  var hf = ss.getSheetByName('01_FEL_Maestro'), df = hf.getDataRange().getValues(), hi = -1;
  for (var i = 0; i < Math.min(df.length, 10); i++) if (df[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  if (hi < 0) { Logger.log('NO SE HIZO NADA: no encontre el encabezado de 01_FEL_Maestro.'); return; }
  var H = df[hi].map(function (h) { return String(h).trim(); });
  var iNit = H.indexOf('NIT_Emisor'), iNum = H.indexOf('Numero_DTE'), iTot = H.indexOf('Gran_Total'), iCat = H.indexOf('Categoría');
  var formulas = hf.getRange(1, iCat + 1, df.length, 1).getFormulas();
  var delNit = 0;
  for (var r2 = hi + 1; r2 < df.length; r2++) if (_evNit(df[r2][iNit]) === EV_NIT) delNit++;
  EV_FEL_FIJAS.forEach(function (it) {
    var filas = [];
    for (var r = hi + 1; r < df.length; r++) {
      if (_evNit(df[r][iNit]) === EV_NIT && _evNit(df[r][iNum]) === it[0]) filas.push(r);
    }
    if (filas.length !== 1) { avisos.push('FEL ' + it[0] + ': ' + filas.length + ' filas. No se toca.'); return; }
    var r = filas[0], tot = Math.round(Number(df[r][iTot]) * 100) / 100, actual = String(df[r][iCat] || '').trim();
    if (Math.abs(tot - it[1]) > 0.01) { avisos.push('FEL ' + it[0] + ': total ' + tot + ', se esperaba ' + it[1] + '. No se toca.'); return; }
    if (formulas[r][0]) { hechas.push('FEL ' + it[0] + ': ya es formula, cambia sola'); return; }
    if (actual === EV_NUEVA) { hechas.push('FEL ' + it[0] + ': ya estaba en ' + EV_NUEVA + ''); return; }
    if (actual !== 'BEBIDAS') { avisos.push('FEL ' + it[0] + ' dice "' + actual + '", se esperaba BEBIDAS. No se toca.'); return; }
    if (escribir) hf.getRange(r + 1, iCat + 1).setValue(EV_NUEVA);
    hechas.push('FEL ' + it[0] + ' (Q' + it[1] + '): BEBIDAS -> ' + EV_NUEVA + '');
  });

  Logger.log(escribir ? '=== ENTRE VOLCANES: ESCRITAS ===' : '=== ENTRE VOLCANES: SIMULACION, no se escribio nada ===');
  hechas.forEach(function (x) { Logger.log('   ' + x); });
  Logger.log('Facturas del NIT ' + EV_NIT + ' en 01_FEL_Maestro: ' + delNit + ' (el espejo del 5-oct tenia 37)');

  // Relee lo escrito: un "escritas" que no se verifica no prueba nada
  if (escribir) {
    SpreadsheetApp.flush();
    var df2 = hf.getDataRange().getValues(), quedan = [];
    for (var r3 = hi + 1; r3 < df2.length; r3++) {
      if (_evNit(df2[r3][iNit]) === EV_NIT && String(df2[r3][iCat] || '').trim() !== EV_NUEVA) quedan.push(_evNit(df2[r3][iNum]) + '=' + df2[r3][iCat]);
    }
    if (quedan.length) avisos.push('Releido: ' + quedan.length + ' factura(s) del NIT siguen sin ' + EV_NUEVA + ': ' + quedan.join(', '));
    else Logger.log('Releido: las ' + delNit + ' facturas del NIT quedaron en ' + EV_NUEVA + '.');
  }
  if (avisos.length) { Logger.log('--- revisar ---'); avisos.forEach(function (x) { Logger.log('   ' + x); }); }
  else Logger.log('Sin avisos (Entre Volcanes).');
}

/** Solo reporta. No escribe nada. */
function revisarEntreVolcanesAjena() { _evCorrer(false); }

/** Escribe FACTURA_AJENA. */
function aplicarEntreVolcanesAjena() { _evCorrer(true); }
