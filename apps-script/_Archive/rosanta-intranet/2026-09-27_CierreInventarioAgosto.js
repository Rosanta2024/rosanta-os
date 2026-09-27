/**
 * CierreInventarioAgosto.js — UN SOLO USO (27-sep-2026). Decisiones de Juanma:
 * cerrar agosto de cocina con lo sin contar en 0 y el rabo sin precio; pimienta a Q45
 * (las dos filas: "los precios cambian por la temporada") y aprobar ese precio al Banco.
 * Ruta: ?page=inv-cierre-agosto (plan) / inv-cierre-agosto-aplicar. BORRAR despues.
 */
function cierreInventarioAgosto_(aplicar, u) {
  var area = 'COCINA', mes = '2026-08';
  return invConCandado_(function () {
    if (!aplicar) return invCerrarMes_(area, mes, false, u, false);   // solo devuelve las listas
    var out = {};
    var ult = invUltimoMes_(invHojaDe_(area));
    if (ult.mes === mes && invEstado_(ult.d) === 'ABIERTO') {
      out.pimenta = invGuardar_(area, mes, [{ id: 'C-019', precio: 45 }], u).guardados;
      out.cierre = invCerrarMes_(area, mes, true, u, true);
    } else out.cierre = 'ya estaba cerrado (ultimo mes ' + ult.mes + ')';
    var pend = invPrecios_(u).pendientes;
    var pim = pend.filter(function (x) { return x.area === area && x.mes === mes && /pimi?enta negra/i.test(x.producto) && x.nuevo === 45; });
    out.aprobados = pim.length ? invResolverPrecios_(pim, true, u) : 'nada que aprobar';
    out.pendientesQueQuedan = invPrecios_(u).pendientes;
    return out;
  });
}
