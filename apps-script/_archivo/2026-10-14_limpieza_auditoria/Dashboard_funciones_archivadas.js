// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en Dashboard.js.
// Ver LEEME.txt de esta carpeta.

/**
 * `semanas`: 4, 13 o 52. La misma ventana que la ingenieria de menu y por la misma
 * razon (multiplos enteros de semana; ver IM_VENTANAS en CosteoVista.html).
 */
function getDashboard(semanas) {
  soloDueno_();
  var w = ventasYVentana_(semanas === undefined ? 13 : semanas);
  if (!w) return { ok: false, error: 'Todavia no hay ventas cargadas. Corré cargarVentasPorProducto().' };
  return tableroDesdeR_(ingenieriaDeMenu_(w.desde, w.hasta, w.ventas));
}
