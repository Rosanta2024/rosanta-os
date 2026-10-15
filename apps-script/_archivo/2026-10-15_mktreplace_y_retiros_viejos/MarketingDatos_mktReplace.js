/* Archivado el 15-oct-2026 desde MarketingDatos.js. Ninguna pantalla la llamaba: OS_MAP esta vacio
   desde el 27-sep y srv() de Marketing no la tiene en su lista blanca. TABS_SIN_REPLACE se quedo
   en el proyecto (lo vigila la bateria). */

/** Lo que usa el auto-sync del sistema (osAutoPush -> action:'replace'). */
function mktReplace(tab, rows, auth) {
  requiereEdicionMarketing_(tab, auth);
  var head = SCHEMA[tab];
  if (!head) throw new Error('Pestaña desconocida: ' + tab);
  if (TABS_SIN_REPLACE[tab]) {
    throw new Error('La pestaña ' + tab + ' se sincroniza fila por fila; reemplazarla completa borraría filas escritas por fuera.');
  }
  rows = rows || [];

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = mktSheet_(tab);
    sh.clearContents();
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    if (rows.length) {
      var data = rows.map(function (row) {
        return head.map(function (h) { return row[h] !== undefined && row[h] !== null ? row[h] : ''; });
      });
      sh.getRange(2, 1, data.length, head.length).setValues(data);
    }
    return { count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

