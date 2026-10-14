// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en IngenieriaMenu.js.
// Ver LEEME.txt de esta carpeta.

function ventanaVentas_(semanas) {
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) return null;
  var cFecha = VENTAS.cols.indexOf('FECHA') + 1;
  var col = h.getRange(2, cFecha, h.getLastRow() - 1, 1).getValues();
  var min = null, max = null;
  col.forEach(function (f) {
    var d = fechaVenta_(f[0]);
    if (!d) return;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  });
  if (!max) return null;
  if (!semanas) return { desde: min, hasta: max };          // todo
  var hasta = ultimoDomingo_(max, min);                     // semanas completas
  var t = new Date(hasta + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() - (semanas * 7 - 1));
  var desde = Utilities.formatDate(t, 'UTC', 'yyyy-MM-dd');
  return { desde: desde < min ? min : desde, hasta: hasta };
}

/**
 * Payload para la pestana. Solo lee.
 * `semanas`: 4, 13, o 0/null para todo el historico.
 */
function getIngenieriaMenu(semanas) {
  soloDueno_();
  var w = ventasYVentana_(semanas === undefined ? 13 : semanas);
  if (!w) return { ok: false, error: 'Todavia no hay ventas cargadas. Corré cargarVentasPorProducto().' };
  return menuDesdeR_(ingenieriaDeMenu_(w.desde, w.hasta, w.ventas));
}
