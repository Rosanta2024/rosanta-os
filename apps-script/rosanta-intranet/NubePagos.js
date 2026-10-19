/**
 * PAGOS EN EL SERVIDOR NUEVO (18-oct-2026, migracion a la nube, Fase 1).
 *
 * El interruptor es PARAMETROS › motor_pagos:
 *   sheets (o vacio) → todo como siempre: Pagos guarda en PAGOS_PROVEEDORES desde aca.
 *   base             → Pagos guarda en el servidor nuevo (Google Cloud), que copia cada pago a
 *                      PAGOS_PROVEEDORES. La pantalla de Pagos de la intranet muestra la del servidor
 *                      nuevo con el mismo enlace (el equipo no nota la mudanza, decision de Juanma), y las
 *                      funciones de guardar de Pagos de aca se niegan, para que nadie escriba por dos lados.
 * Caja chica y Compras en efectivo NO cambian: siguen escribiendo en la hoja con las funciones de
 * adentro (_pagRegistrarPago_, _pagEscribir_, _pagAnularMovimiento_) y el servidor nuevo lo importa
 * cada 15 min. Las facturas Para IVA tambien siguen aca (tocan el maestro).
 * Volver atras = poner motor_pagos = sheets.
 */
var NUBE_PAGOS_URL_ = 'https://rosanta-nube-512086396641.northamerica-south1.run.app/pagos';
/** El servidor de ENSAYO (se borra despues del paso a vivo): solo para ?nube=ensayo del dueño. */
var NUBE_ENSAYO_URL_ = 'https://rosanta-nube-ensayo-512086396641.northamerica-south1.run.app';

/** Un interruptor de PARAMETROS: 'base' o 'sheets' (texto). Se guarda 1 minuto. */
function _nubeInterruptor_(clave, cacheKey) {
  var cache = CacheService.getScriptCache(), g = null;
  try { g = cache.get(cacheKey); } catch (e) { g = null; }
  if (g === 'base' || g === 'sheets') return g;
  var m = 'sheets';
  try {
    var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('PARAMETROS');
    var v = sh ? sh.getDataRange().getValues() : [];
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0] || '').trim().toLowerCase() === clave) {
        m = String(v[i][1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets';
        break;
      }
    }
  } catch (e) { m = 'sheets'; }
  try { cache.put(cacheKey, m, 60); } catch (e) { /* sin cache: se lee cada vez */ }
  return m;
}
/** Pagos: PARAMETROS › motor_pagos. */
function pagMotor_() { return _nubeInterruptor_('motor_pagos', 'pag_motor_v1'); }
/**
 * Caja chica y Compras: PARAMETROS › motor_caja (18-oct-2026). SOLO vale si Pagos tambien esta en base:
 * Caja y Compras escriben en PAGOS_PROVEEDORES, y no pueden escribir por un lado mientras Pagos lo hace por otro.
 */
function cajaMotor_() { return pagMotor_() === 'base' && _nubeInterruptor_('motor_caja', 'caja_motor_v1') === 'base' ? 'base' : 'sheets'; }
/** Los cierres del dia: PARAMETROS › motor_cierres. Con base, el lector los manda al servidor nuevo. */
function cierresMotor_() { return _nubeInterruptor_('motor_cierres', 'cie_motor_v1'); }

/**
 * La cerradura de las funciones de GUARDAR de la pantalla de Pagos de la intranet. Con el interruptor
 * en base, se niegan. En el servidor nuevo (que corre este mismo archivo de Pagos) no aplica:
 * alli NUBE_SERVIDOR_ existe y es el que guarda.
 */
function _pagSoloConsulta_() {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return;
  if (pagMotor_() === 'base') {
    throw new Error('Pagos se guarda ahora en la pantalla nueva. Tocá Actualizar y volvé a intentarlo.');
  }
}

/**
 * Para la pantalla: si Pagos va por el servidor nuevo, la direccion a mostrar (con el enlace de esa
 * persona, el mismo de siempre). Quien entra con la sesion de rosanta.rest (sin ?u=) usa su enlace de USUARIOS.
 * modo: el de PF_PAGOS ('' o 'admin:banco', etc.).
 */
function getPagosDestino(auth, modo, prueba) {
  var Q = pagQuien_(auth);
  var ensayo = _nubeEsPruebaDueno_(auth, prueba);
  if (!ensayo && pagMotor_() !== 'base') return { base: false };
  var token = String(auth || '').trim();
  if (!token) {
    var u = resolverUsuario_(auth), filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS').getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      if (String(filas[i][0] || '').toLowerCase().trim() === u.email) { token = String(filas[i][5] || '').trim(); break; }
    }
  }
  if (!token) throw new Error('Tu cuenta no tiene enlace para la pantalla nueva de Pagos. Avisale a Juanma.');
  var m = String(modo || '').trim();
  if (m && !/^admin:(banco|balance|iva|equipo)$/.test(m)) m = '';
  return { base: true, url: (ensayo ? NUBE_ENSAYO_URL_ + '/pagos' : NUBE_PAGOS_URL_) + '?u=' + encodeURIComponent(token) + (m ? '&modo=' + encodeURIComponent(m) : '') + '&dentro=1',
           nombre: Q.nombre, ensayo: ensayo };
}

/**
 * ?nube=ensayo (19-oct-2026): el dueño, y solo el, ve la pantalla del servidor de ENSAYO dentro de la intranet
 * publicada, para probar el puente ("Leer cierres", la foto del comprobante) en su Chrome antes del paso a vivo.
 * No cambia ningun interruptor: lo que el puente corre en la intranet hace lo de siempre.
 */
function _nubeEsPruebaDueno_(auth, prueba) {
  if (prueba !== 'ensayo') return false;
  var u = resolverUsuario_(auth);
  return !!u && normalizar_(u.rol) === 'dueno';
}

/** La cerradura de las funciones de GUARDAR de Caja chica y Compras (igual que _pagSoloConsulta_). */
function _cajaSoloConsulta_() {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return;
  if (cajaMotor_() === 'base') {
    throw new Error('Caja chica y Compras se anotan ahora en la pantalla nueva. Tocá Actualizar y volvé a intentarlo.');
  }
}

/** Para la pestaña de Caja chica o Compras: si va por el servidor nuevo, la direccion (como getPagosDestino). */
function getCajaDestino(auth, cual, prueba) {
  var Q = cchQuien_(auth);
  var ensayo = _nubeEsPruebaDueno_(auth, prueba);
  if (!ensayo && cajaMotor_() !== 'base') return { base: false };
  var d = getPagosDestino(auth, '', ensayo ? 'ensayo' : '');
  if (!d.base) return { base: false };
  return { base: true, url: d.url.replace(/\/pagos\?/, '/' + (cual === 'compras' ? 'compras' : 'caja') + '?').replace(/&modo=[^&]*/, ''), nombre: Q.nombre, ensayo: ensayo };
}

/**
 * Un cierre del dia al servidor nuevo (motor_cierres = base): la fila tal cual iria a CIERRES_DIARIOS. Las
 * fechas viajan como {$d: 'AAAA-MM-DDTHH:MM:SS'} (hora de Guatemala). La clave de tareas vive en las
 * Propiedades del script (NUBE_CLAVE_TAREAS), nunca en el codigo.
 */
function nubeGuardarCierre_(fila) {
  var clave = PropertiesService.getScriptProperties().getProperty('NUBE_CLAVE_TAREAS');
  if (!clave) throw new Error('Falta NUBE_CLAVE_TAREAS en las Propiedades del script.');
  var cod = fila.map(function (x) { return x instanceof Date ? { $d: Utilities.formatDate(x, 'America/Guatemala', "yyyy-MM-dd'T'HH:mm:ss") } : x; });
  var r = UrlFetchApp.fetch(NUBE_PAGOS_URL_.replace(/\/pagos$/, '/tareas/cierre'), { method: 'post', contentType: 'application/json',
    headers: { 'x-rosanta-tarea': clave }, payload: JSON.stringify({ fila: cod }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('El servidor nuevo no guardo el cierre (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}

