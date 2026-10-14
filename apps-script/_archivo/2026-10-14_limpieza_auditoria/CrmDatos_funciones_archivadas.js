// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en CrmDatos.js.
// Ver LEEME.txt de esta carpeta.

/** Para el tablero global: finanzas + rol dueno. */
function getCrmAltasMes(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return crmAltasPorMes_(new Date().getFullYear());
}
