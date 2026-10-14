// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en ConfigPOS.js.
// Ver LEEME.txt de esta carpeta.

/** Pestana de la ficha para un plato o para un nombre del POS. null si no esta. */
function pestanaDeFicha_(algo) {
  var m = mapaPOS_(), t = String(algo).trim();
  var plato = m.platos[t] ? t : (m.porPos[normalizar_(t)] || null);
  if (!plato) { var reg = registroPlato_(t); return reg ? (reg.pestana || null) : null; }
  return m.platos[plato].pestana || null;
}
