/**
 * CONECTAR_POS.gs — Conecta el catalogo del POS y verifica el puente. De un solo uso.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs.
 *
 * Hace dos cosas en un Run:
 *   1. guarda POS_CATALOGO_SHEET_ID (lo unico que escribe: una propiedad de script)
 *   2. limpia el cache del mapa POS y corre verificarNombresPOS()
 *
 * El paso 2 es el que importa: sin el, habria que configurar la propiedad y despues
 * correr la bateria entera para saber si quedo bien. Asi se ve en el acto.
 *
 * El cache se limpia porque el mapa vive 15 minutos y la columna H de RESUMEN CMV
 * cambio hace un rato: los cuatro postres pasaron del boton generico a su llave propia.
 *
 * Catalogo del 24-ago-2026 20:20, ya con Peras Horneadas (396) y Mousse de Chocolate
 * (397) dados de alta, y el Lomito de la Casa corregido a Q180.
 *
 * BORRAR este archivo despues de correrlo. La propiedad queda guardada; el archivo no
 * sirve de nuevo, y con una ID hardcodeada solo puede confundir cuando llegue el
 * proximo catalogo.
 */

var CATALOGO_POS = '1veZF3Yx3j6H9YyHivtwqLKlGv0c6hFVwiiriLM5Epek';

function CONECTAR_POS() {
  var props = PropertiesService.getScriptProperties();
  var previo = props.getProperty('POS_CATALOGO_SHEET_ID');

  if (previo !== CATALOGO_POS) {
    props.setProperty('POS_CATALOGO_SHEET_ID', CATALOGO_POS);
    Logger.log('POS_CATALOGO_SHEET_ID: %s  ->  %s', previo || '(vacia)', CATALOGO_POS);
  } else {
    Logger.log('POS_CATALOGO_SHEET_ID ya estaba en %s', CATALOGO_POS);
  }

  CacheService.getScriptCache().remove(POS_CFG.cacheKey);
  Logger.log('--- verificacion del puente ---');

  var r = verificarNombresPOS(CATALOGO_POS);

  Logger.log('--- resultado ---');
  Logger.log('platos que resuelven contra un producto real del POS: %s', r.ok);
  Logger.log('nombres rotos: %s   (esperado 0)', r.rotos.length);
  Logger.log('precios distintos: %s   (esperado 0)', r.precios.length);

  if (!r.rotos.length && !r.precios.length) {
    Logger.log('Puente limpio. Ahora correr CORRER_PRUEBAS para el chequeo completo.');
  } else {
    Logger.log('Revisar el detalle de arriba antes de confiar en el cruce de ventas.');
    Logger.log('OJO con los precios: el campo Pventa del catalogo no siempre esta al dia.');
    Logger.log('El precio real se verifica contra las lineas de los tickets, no contra el catalogo.');
  }
  return r;
}
