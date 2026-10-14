// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en InventarioDatos.js.
// Ver LEEME.txt de esta carpeta.

/** Para el tablero global: pide finanzas y rol dueno, como todo lo del tablero. */
function getInventarioCierre(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return invEstadoCierre_(new Date(), _finParametro_('inventario_cierre_dia', 5));
}
