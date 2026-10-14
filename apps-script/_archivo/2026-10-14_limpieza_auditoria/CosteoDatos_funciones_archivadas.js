// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en CosteoDatos.js.
// Ver LEEME.txt de esta carpeta.

/** Boton "actualizar" de la vista. */
function refrescarCosteo() {
  soloDueno_();
  olvidarModeloCosteo_();
  return getCosteoData();
}
