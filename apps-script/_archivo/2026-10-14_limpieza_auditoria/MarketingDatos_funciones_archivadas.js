// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en MarketingDatos.js.
// Ver LEEME.txt de esta carpeta.

function mktReadAll(auth) {
  var u = requiereMarketing_(null, auth);
  var full = usuarioTieneModulo(u, 'marketing');
  var out = {};
  Object.keys(SCHEMA).forEach(function (tab) {
    if (tab === 'calendario_versiones') return; // respaldo; se lee aparte, no en cada arranque
    if (full || TABS_CONTENIDO[tab]) out[tab] = mktRead(tab, auth);
  });
  return out;
}

/** Para el tablero global: finanzas + rol dueno. */
function getMarketingKpisMes(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return mktKpisMes_(new Date().getFullYear(), null);
}
