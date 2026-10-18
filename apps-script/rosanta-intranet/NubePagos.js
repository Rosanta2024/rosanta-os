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

/** 'base' o 'sheets'. Se lee de PARAMETROS (texto) y se guarda 1 minuto. */
function pagMotor_() {
  var cache = CacheService.getScriptCache(), k = 'pag_motor_v1', g = null;
  try { g = cache.get(k); } catch (e) { g = null; }
  if (g === 'base' || g === 'sheets') return g;
  var m = 'sheets';
  try {
    var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('PARAMETROS');
    var v = sh ? sh.getDataRange().getValues() : [];
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0] || '').trim().toLowerCase() === 'motor_pagos') {
        m = String(v[i][1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets';
        break;
      }
    }
  } catch (e) { m = 'sheets'; }
  try { cache.put(k, m, 60); } catch (e) { /* sin cache: se lee cada vez */ }
  return m;
}

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
function getPagosDestino(auth, modo) {
  var Q = pagQuien_(auth);
  if (pagMotor_() !== 'base') return { base: false };
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
  return { base: true, url: NUBE_PAGOS_URL_ + '?u=' + encodeURIComponent(token) + (m ? '&modo=' + encodeURIComponent(m) : '') + '&dentro=1', nombre: Q.nombre };
}
