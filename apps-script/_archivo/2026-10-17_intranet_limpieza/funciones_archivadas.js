// ---- de EventosDatos.js
/** Una línea por día (la fecha es la llave: se reemplaza si ya existe). */
function evGuardarRevision_(r) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'La hoja está ocupada.' };
  try {
    var H = evHoja_(EV_REV_TAB, EV_REV_COLS);
    var fecha = String(r.fecha || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'fecha inválida' };
    var fila = H.head.map(function (h) {
      var v = h === 'fecha' ? fecha : r[h];
      return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    var n = H.sh.getLastRow() - 1, i = -1;
    if (n > 0) H.sh.getRange(2, 1, n, 1).getValues().forEach(function (f, k) { if (evTxt_(f[0]) === fecha) i = k; });
    if (i >= 0) H.sh.getRange(i + 2, 1, 1, H.head.length).setValues([fila]);
    else H.sh.getRange(H.sh.getLastRow() + 1, 1, 1, H.head.length).setValues([fila]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}


// ---- de Setup.js
/**
 * Habilita los módulos nuevos SOLO para restaurante@rosanta.rest, para probarlos
 * sin que el equipo vea cambios. Ejecutar una vez desde el editor y mirar el Log.
 *
 * Es idempotente (no duplica módulos) y toca UNA sola fila: si el correo no está
 * en USUARIOS, aborta sin escribir nada. El resto del equipo queda igual, así que
 * sus tarjetas siguen siendo finanzas/recetario y nada más.
 *
 * Para habilitarlos a otros después: agregar los módulos a mano en la hoja, o
 * cambiar DUENO_ y volver a ejecutar.
 */
var DUENO_ = 'restaurante@rosanta.rest';
var MODULOS_NUEVOS_ = ['marketing', 'crm', 'consola', 'resenas'];

function habilitarModulosDueno() {
  soloDueno_();
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  var filas = hoja.getDataRange().getValues();

  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]).toLowerCase().trim() !== DUENO_) continue;

    var actuales = String(filas[i][2]).split(',')
      .map(function (m) { return m.trim(); })
      .filter(function (m) { return m; });

    var antes = actuales.join(',');
    MODULOS_NUEVOS_.forEach(function (m) {
      if (actuales.indexOf(m) === -1) actuales.push(m);
    });
    var despues = actuales.join(',');

    if (antes === despues) {
      Logger.log('Sin cambios: ' + DUENO_ + ' ya tenía [' + despues + ']');
      return;
    }
    hoja.getRange(i + 1, 3).setValue(despues); // columna "modulos", sólo esta fila
    Logger.log('OK. ' + DUENO_ + ': [' + antes + '] -> [' + despues + ']');
    Logger.log('Filas en USUARIOS sin tocar: ' + (filas.length - 2));
    return;
  }
  Logger.log('ABORTADO: ' + DUENO_ + ' no está en USUARIOS. No se escribió nada.');
}


