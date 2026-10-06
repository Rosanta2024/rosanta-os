// ROSANTA - 3 proveedores nuevos de la S40 (FEL recibidas), decision de Juanma del 5-oct-2026.
// Script de un solo uso: se archiva en apps-script/_archivo/2026-10-05_banco_S40 despues de correrlo.
var PROV_S40 = [
  ['LA FAMILIA CAFÉ Y PANADERÍA', 'Personal', 'PERSONAL', 'Sí', 'Vilma Esmeralda Sosa Reyes - personal por Juanma, 5 oct 2026', ''],
  ['MOTODO 3', 'Personal', 'PERSONAL', 'Sí', 'Motodo, S.A. - personal por Juanma, 5 oct 2026', ''],
  ['INVERSCOPE', 'Parqueo', 'PARQUEOS', 'No', 'Inverscope, S.A. - parqueo (Juanma, 5 oct 2026)', '']
];
function agregarProveedoresS40() {
  var sh = SpreadsheetApp.openById('1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk').getSheetByName('00_Proveedores');
  var col = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  var ya = {}, ultima = 4;
  for (var i = 4; i < col.length; i++) { var v = String(col[i][0]).trim(); if (v) { ya[v.toUpperCase()] = 1; ultima = i + 1; } }
  var nuevas = PROV_S40.filter(function (p) { return !ya[p[0].toUpperCase()]; });
  if (nuevas.length) sh.getRange(ultima + 1, 1, nuevas.length, 6).setValues(nuevas);
  SpreadsheetApp.flush();
  var rel = sh.getRange(ultima + 1, 1, Math.max(nuevas.length, 1), 4).getValues();
  Logger.log('Proveedores S40: ' + nuevas.length + ' agregados desde la fila ' + (ultima + 1) + ' · releido: ' + JSON.stringify(rel));
}
