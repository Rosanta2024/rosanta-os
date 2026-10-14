// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en ReporteSemanalDatos.js.
// Ver LEEME.txt de esta carpeta.

/** Los fijos de la pestaña PRESUPUESTO, si existe: referencia al lado del fijo del motor. */
function _repFijosPresupuesto_(p) {
  if (!p || !p.existe || !p.secciones) return null;
  var lista = [], total = 0;
  Object.keys(p.secciones).forEach(function (k) {
    var x = p.secciones[k];
    if (!x || String(x.tipo || '').toLowerCase() !== 'fijo') return;
    var v = Number(x.valor || x.mensual || 0);
    if (!v) return;
    lista.push({ seccion: k, mensual: _finR_(v) }); total += v;
  });
  return lista.length ? { secciones: lista, total_mes: _finR_(total), total_semana: _finR_(total / FIN_SEMANAS_MES) } : null;
}

function _repHojaAcciones_(crear) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var h = ss.getSheetByName(REP_HOJA_ACCIONES);
  if (!h && crear) {
    h = ss.insertSheet(REP_HOJA_ACCIONES);
    h.getRange(1, 1, 1, REP_COLS_ACCIONES.length).setValues([REP_COLS_ACCIONES]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

/** OBSOLETA desde el 27-sep-2026: las acciones viven en ACCIONES (MedicionDatos). Queda
    solo por si alguien la corre desde el editor; ya no la lee nadie. */
function instalarReporteAcciones() {
  soloDueno_();
  var h = _repHojaAcciones_(true);
  Logger.log('REPORTE_ACCIONES lista: ' + h.getLastRow() + ' filas.');
}
