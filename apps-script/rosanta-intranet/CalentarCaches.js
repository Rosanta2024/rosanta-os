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
  calentar('finanzas', function () { return !c.get(finCacheClave_()); },
           function () { _finDatos_(true); });

  // La tarjeta real contra teorico del tablero: corre ingenieriaDeMenu_ una vez por mes.
  // Va despues de finanzas porque lee su calculo. Misma clave que getCmvRealTeorico.
  calentar('real contra teorico', function () {
    var h = huellaDatos_();
    return !h || !c.get(cmvRealTeoricoClave_(h));
  }, function () { getCmvRealTeorico(''); });

  var linea = 'calentarCaches · reconstruido: ' + (hecho.join(', ') || 'nada') +
              ' · ya estaba: ' + (ya.join(', ') || 'nada') +
              (fallo.length ? ' · FALLO: ' + fallo.join(' | ') : '');
  Logger.log(linea);
  return linea;
}
