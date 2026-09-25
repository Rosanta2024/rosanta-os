// ============================================================
// ROSANTA - Los dos proveedores nuevos de S38 (decididos por Juanma el 21 sep 2026)
//
// 1. MERCEDES MORENO (Maria Mercedes Moreno Gil, NIT 108020010)
//    Proveedor nuevo de alimentos -> ALIMENTOS.
//    Factura DTE 2869511609 · 17-sep-2026 · Q210.
//
// 2. LMDMT DE GUATE (Emanuel Alejandro Rivera Paz, NIT 50982303)
//    NO es del restaurante y tampoco es personal -> FACTURA_AJENA.
//    Factura DTE 1366115979 · 18-sep-2026 · Q160.
//    FACTURA_AJENA queda fuera del DRE a proposito (FIN_FUERA en FinanzasDatos.js
//    y FUERA en generar_finanzas.py). No cuenta como gasto ni como extraccion.
//
// Los dos entran a 00_Proveedores para que la proxima factura se clasifique sola.
//
// COMO FUNCIONA
// Busca cada factura por Numero_DTE y verifica NIT + fecha + monto antes de tocar.
// Solo escribe si la categoria de hoy es POR_CLASIFICAR. Relee lo escrito. Se puede
// correr dos veces sin dano.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarProveedoresS38()   no escribe. Tiene que decir 4 cambios y "Sin avisos".
//   2. aplicarProveedoresS38()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_PS38 = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// [Numero_DTE, NIT, fecha, monto, establecimiento, categoria nueva, nota del proveedor]
var LOTE_PS38 = [
  ['2869511609', '108020010', '2026-09-17', 210, 'MERCEDES MORENO', 'ALIMENTOS',
   'Maria Mercedes Moreno Gil, NIT 108020010. Proveedor de alimentos. Agregado el 21-sep-2026.'],
  ['1366115979', '50982303', '2026-09-18', 160, 'LMDMT DE GUATE', 'FACTURA_AJENA',
   'Emanuel Alejandro Rivera Paz, NIT 50982303. No es del restaurante ni personal: fuera del DRE. Agregado el 21-sep-2026.']
];

function _ps38Llave_(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _ps38Fecha_(d) {
  if (Object.prototype.toString.call(d) !== '[object Date]') return String(d || '').trim().slice(0, 10);
  // regla 10: de 12:00 en adelante es el dia siguiente
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() >= 12 ? 1 : 0));
  return Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _ps38Correr_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_PS38);
  var fel = ss.getSheetByName('01_FEL_Maestro'), prov = ss.getSheetByName('00_Proveedores');
  var F = fel.getDataRange().getValues(), P = prov.getDataRange().getValues();
  var avisos = [], cambios = [], yaEstaban = [], tareas = [], facturas = [];

  LOTE_PS38.forEach(function (L) {
    var dte = L[0], nit = L[1], fecha = L[2], monto = L[3], estab = L[4], cat = L[5], nota = L[6];

    // ---- el proveedor en 00_Proveedores (A Proveedor · C Categoria_Normalizada · D Es_Personal)
    var filasProv = [];
    for (var p = 4; p < P.length; p++) if (String(P[p][0] || '').trim() === estab) filasProv.push(p);
    if (filasProv.length > 1) {
      avisos.push('00_Proveedores: ' + filasProv.length + ' filas con "' + estab + '". No se toca.');
    } else if (filasProv.length === 1) {
      var catProv = String(P[filasProv[0]][2] || '').trim();
      if (catProv === cat) yaEstaban.push('00_Proveedores ya tiene "' + estab + '" como ' + cat);
      else avisos.push('00_Proveedores fila ' + (filasProv[0] + 1) + ' "' + estab + '" dice "' + catProv + '". Revisar.');
    } else {
      cambios.push('00_Proveedores: agregar "' + estab + '" como ' + cat + ', Es_Personal No');
      tareas.push({ fila: [estab, '', cat, 'No', nota, ''], que: '00_Proveedores ' + estab });
    }

    // ---- la factura en 01_FEL_Maestro (D Numero_DTE · E NIT · J Gran_Total · N Categoria)
    var filas = [];
    for (var r = 4; r < F.length; r++) if (_ps38Llave_(F[r][3]) === dte) filas.push(r);
    if (filas.length !== 1) {
      avisos.push('FEL DTE ' + dte + ': ' + filas.length + ' filas (se esperaba 1). No se toca.');
      return;
    }
    var rf = filas[0], catHoy = String(F[rf][13] || '').trim();
    var ok = _ps38Llave_(F[rf][4]) === nit && _ps38Fecha_(F[rf][0]) === fecha &&
             Math.abs(Number(F[rf][9]) - monto) < 0.01;
    if (!ok) {
      avisos.push('FEL DTE ' + dte + ' no cuadra: NIT ' + F[rf][4] + ' · fecha ' + _ps38Fecha_(F[rf][0]) +
                  ' · monto ' + F[rf][9] + '. No se toca.');
    } else if (catHoy === cat) {
      yaEstaban.push('FEL DTE ' + dte + ' ya dice ' + cat);
    } else if (catHoy !== 'POR_CLASIFICAR') {
      avisos.push('FEL DTE ' + dte + ' dice "' + catHoy + '" y se esperaba POR_CLASIFICAR. No se toca.');
    } else {
      var celda = fel.getRange(rf + 1, 14), formula = celda.getFormula();
      cambios.push('FEL fila ' + (rf + 1) + ' DTE ' + dte + ' (' + estab + ', Q' + monto + '): POR_CLASIFICAR -> ' + cat +
                   (formula ? ' (la celda es formula: la corrige el proveedor)' : ''));
      if (!formula) tareas.push({ celda: celda, valor: cat, que: 'FEL DTE ' + dte });
      facturas.push({ fila: rf + 1, cat: cat, dte: dte });
    }
  });

  var noQuedaron = [];
  if (escribir && !avisos.length) {
    tareas.forEach(function (t) { if (t.fila) prov.appendRow(t.fila); else t.celda.setValue(t.valor); });
    SpreadsheetApp.flush();
    facturas.forEach(function (x) {
      var ahora = String(fel.getRange(x.fila, 14).getValue()).trim();
      if (ahora !== x.cat) noQuedaron.push('FEL DTE ' + x.dte + ' sigue diciendo "' + ahora + '"');
    });
    var P2 = prov.getDataRange().getValues();
    LOTE_PS38.forEach(function (L) {
      var n = 0;
      for (var p = 4; p < P2.length; p++) {
        if (String(P2[p][0] || '').trim() === L[4] && String(P2[p][2] || '').trim() === L[5]) n++;
      }
      if (n !== 1) noQuedaron.push('00_Proveedores: "' + L[4] + '" aparece ' + n + ' veces como ' + L[5]);
    });
  }

  Logger.log(escribir ? (avisos.length ? '=== NO SE ESCRIBIO: hay avisos ===' : '=== ESCRITAS ===')
                      : '=== SIMULACION, no se escribio nada ===');
  Logger.log('%s cambio(s) · %s ya estaban bien', cambios.length, yaEstaban.length);
  cambios.forEach(function (c) { Logger.log('  ' + c); });
  yaEstaban.forEach(function (c) { Logger.log('  (ya) ' + c); });
  if (avisos.length) { Logger.log('--- AVISOS ---'); avisos.forEach(function (a) { Logger.log('  ' + a); }); }
  else Logger.log('Sin avisos.');
  if (escribir && !avisos.length) {
    if (noQuedaron.length) {
      Logger.log('>> REVISAR, no quedo como debia:');
      noQuedaron.forEach(function (n) { Logger.log('  ' + n); });
    } else Logger.log('OK: releido de la hoja. Falta correr generarEspejo().');
  }
}

function revisarProveedoresS38() { _ps38Correr_(false); }
function aplicarProveedoresS38() { _ps38Correr_(true); }
