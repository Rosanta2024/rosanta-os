/**
 * CalentarCaches.gs — Que nadie sea el primero en abrir.
 *
 * QUE RESUELVE
 * El 10-sep-2026 se midio la apertura del recetario con el cache frio: 46.7 s, de
 * los cuales 39.7 s son getCosteoData construyendo el modelo (lee las dos hojas
 * enteras). En caliente la misma apertura son 0.27 s.
 *
 * O sea que el modulo no era "lento": era rapido para el segundo que entraba y
 * carisimo para el primero. Y como el cache duraba 15 minutos, el primero era casi
 * siempre: Jeffry abre el recetario un par de veces al dia y pagaba los 40 s cada
 * vez. Alargar el plazo solo no alcanza — despues de cualquier cambio de precio el
 * cache se invalida y el siguiente vuelve a pagarlo.
 *
 * Esto lo reconstruye ANTES de que le toque a una persona.
 *
 * NO RECONSTRUYE SI YA ESTA CALIENTE. Esa es la diferencia entre esto y un trabajo
 * que quema cuota: la mayoria de las corridas encuentran el cache servido, no hacen
 * nada y cuestan ~1 s. Solo paga los 40 s cuando de verdad hace falta, que es una
 * vez por hora o despues de una edicion.
 *
 * COMO SE PROGRAMA
 *   Por codigo NO se puede: ScriptApp.newTrigger() necesita el scope
 *   script.scriptapp, que el manifiesto no declara — misma razon que Latido.gs y
 *   SemaforoPrecios.gs. Se agrega a mano:
 *     Editor > Activadores (el reloj, a la izquierda) > Anadir activador
 *     Funcion: calentarCaches
 *     Origen:  Basado en el tiempo > Temporizador por minutos > Cada 5 minutos
 *
 *   Cada 5 minutos y no cada hora a proposito: lo que importa no es refrescar
 *   seguido, es que la ventana en la que alguien puede toparse con el cache frio
 *   sea corta. Reconstruir sigue ocurriendo una vez por hora; las otras corridas
 *   son no-ops baratas.
 *
 * SI SE APAGA, no se rompe nada: se vuelve a la conducta de antes, el primero que
 * abre paga la construccion. Por eso no lanza excepcion cuando algo falla — no es
 * un monitor, es una comodidad. Latido.gs es el que avisa.
 */

function calentarCaches() {
  var c = CacheService.getScriptCache();
  var hecho = [], ya = [], fallo = [];

  function calentar(nombre, estaFrio, construir) {
    try {
      if (!estaFrio()) { ya.push(nombre); return; }
      var a = new Date().getTime();
      construir();
      hecho.push(nombre + ' (' + ((new Date().getTime() - a) / 1000).toFixed(1) + 's)');
    } catch (e) {
      fallo.push(nombre + ': ' + String(e && e.message || e));
    }
  }

  // PRIMERO las ventas nuevas del POS, si las hay: el tablero de abajo se
  // reconstruye con ellas. La huella cambia sola al escribir SYNC_VENTAS, asi que el
  // cache viejo del tablero deja de servir sin invalidarlo a mano.
  try {
    var carga = cargarVentasSiHayPendientes_();
    if (carga && carga.pendientes) hecho.push('ventas POS (' + carga.pendientes + ' export)');
  } catch (e) {
    fallo.push('ventas POS: ' + String(e && e.message || e));
  }

  var correo = '';
  // Las facturas que SAT avisa por correo (FelCorreo.js, 13-oct-2026): asi Pagos las
  // muestra aunque nadie lo abra. Un correo ya leido se salta: casi siempre es un no-op.
  try {
    var fec = fecLeer_();
    // va aparte de 'reconstruido': es leer datos nuevos, no rehacer un cache
    if (fec.nuevos) correo = 'FEL por correo: ' + fec.nuevos + ' nuevas';
    if (fec.errores.length) fallo.push('FEL por correo: ' + fec.errores.slice(0, 2).join(' · '));
  } catch (e) {
    fallo.push('FEL por correo: ' + String(e && e.message || e));
  }

  // El caro: ~40 s. Es el que justifica todo este archivo.
  calentar('recetario', function () { return !c.get(COSTEO.cacheKey); },
           function () { getCosteoData(); });

  // El tablero. Su clave lleva la huella de los datos, asi que se pide por la via
  // normal y el que decide si sirve es getProfitOS.
  calentar('tablero', function () {
    var h = huellaDatos_();
    return !h || !c.get(claveProfitOS_(13, h));   // la misma clave que arma getProfitOS
  }, function () { getProfitOS('', 13); });

  // Los avisos: 7 s, casi todo recorriendo Drive.
  calentar('avisos', function () { return !c.get(AVISOS_CACHE.clave); },
           function () { getAvisosDashboard(); });

  // Finanzas (M26, tanda 4, 15-sep-2026): el primero que abria la pestaña pagaba el
  // calculo del maestro entero. La respuesta pesa ~25 KB, lejos de los 100 KB del cache.
  // 13-oct-2026: tambien se recalcula si el cargador del maestro agrego filas. Antes una
  // semana cargada a mano no se veia hasta que la cache (3 h) vencia: el tablero siguio
  // mostrando la S40 con la S41 ya cargada. El reporte semanal se recalcula solo porque
  // su clave lleva la huella de la ultima semana del motor.
  var cargaNueva = false;
  try {
    cargaNueva = maestroConFilasNuevas_();
  } catch (e) {
    fallo.push('filas del maestro: ' + String(e && e.message || e));
  }
  calentar('finanzas', function () { return cargaNueva || !c.get(finCacheClave_()); },
           function () { _finDatos_(true); });

  // La tarjeta real contra teorico del tablero: corre ingenieriaDeMenu_ una vez por mes.
  // Va despues de finanzas porque lee su calculo. Misma clave que getCmvRealTeorico.
  calentar('real contra teorico', function () {
    var h = huellaDatos_();
    return !h || !c.get(cmvRealTeoricoClave_(h));
  }, function () { getCmvRealTeorico(''); });

  if (cargaNueva) hecho.push('(el maestro tenia filas nuevas)');
  var linea = 'calentarCaches · reconstruido: ' + (hecho.join(', ') || 'nada') +
              ' · ya estaba: ' + (ya.join(', ') || 'nada') +
              (correo ? ' · leido: ' + correo : '') +
              (fallo.length ? ' · FALLO: ' + fallo.join(' | ') : '');
  Logger.log(linea);
  return linea;
}

/**
 * Si el maestro tiene filas nuevas desde la ultima vez que se miro (13-oct-2026).
 * El cargador solo AGREGA filas al final de las hojas base, asi que una carga se nota
 * en la ultima fila de cada una (S41: ventas 2,013 -> 2,051, FEL 1,097 -> 1,118,
 * banco 1,155 -> 1,173). Cuesta ~1 s: un openById y seis getLastRow.
 * La primera vez solo guarda el sello y devuelve false: sin un antes no hay carga que avisar.
 */
var MAESTRO_FILAS_SELLO = 'maestro_filas_sello';
function maestroConFilasNuevas_() {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var sello = ['01_FEL_Maestro', '02_Ventas_Maestro', '03_Banco_Industrial', '04_Banco_BAC',
               '05_Tarjeta_Credito_BAC', '06_Tarjeta_Credito_BI'].map(function (n) {
    var h = ss.getSheetByName(n);
    return n + ':' + (h ? h.getLastRow() : 0);
  }).join('|');
  var p = PropertiesService.getScriptProperties();
  var antes = p.getProperty(MAESTRO_FILAS_SELLO);
  if (antes === sello) return false;
  p.setProperty(MAESTRO_FILAS_SELLO, sello);
  if (antes !== null) Logger.log('calentarCaches · filas del maestro: ' + antes + ' -> ' + sello);
  return antes !== null;
}
