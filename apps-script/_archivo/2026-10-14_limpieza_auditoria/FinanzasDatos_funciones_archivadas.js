// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en FinanzasDatos.js.
// Ver LEEME.txt de esta carpeta.

/** Una vez. Crea la pestana METAS con los meses que faltan del año. */
function instalarMetas() {
  soloDueno_();
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(FIN_HOJA_METAS);
  if (hoja) return 'La pestana METAS ya existe. No se toco nada.';

  hoja = ss.insertSheet(FIN_HOJA_METAS);
  hoja.getRange(1, 1, 1, FIN_METAS_COLS.length).setValues([FIN_METAS_COLS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  var anio = new Date().getFullYear();
  var filas = [];
  for (var m = new Date().getMonth() + 1; m <= 12; m++) {
    filas.push([anio, m, 154500, _finMetaFood_(),
                'PROVISIONAL: promedio de los ultimos 3 meses +20%. Cambiar cuando entre 2025.']);
  }
  if (filas.length) hoja.getRange(2, 1, filas.length, FIN_METAS_COLS.length).setValues(filas);
  hoja.setColumnWidth(5, 460);
  return 'Pestana METAS creada con ' + filas.length + ' meses. Edita META_VENTA ahi.';
}

/** Los doce meses de 2025. Se queda porque la estacionalidad de la Caja lo usa. */
function _finAnio2025_() { return _finVentasAnio_(2025); }

/** Venta y tickets del mismo mes del año anterior. null si no hay dato. */
function _finBaseAnterior_(anio, m) {
  var v = _finVentasAnio_(anio - 1);
  return (v && v[m]) ? v[m] : null;
}
