/**
 * PROBAR_SYNC.gs — La prueba de la sincronizacion de precios, en un solo boton.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs y MIGRAR_V14.gs.
 *
 * NO ESCRIBE EN EL BANCO DE DATOS. Solo apunta INVENTARIO_CIERRE_SHEET_ID al cierre
 * de julio y corre probarSincronizacion(), que compara y vuelca la propuesta al Log.
 * Para escribir hay que aprobar y correr aplicarSincronizacion() aparte, a mano.
 *
 * El cierre de julio YA es hoja nativa, asi que no hace falta convertirCierreANativa_().
 * Esa funcion queda para los cierres de los meses que entren como .xlsx.
 *
 * OJO AL LEER EL LOG: el cierre propone bajar el camote de Q9.50 a Q8/libra y la papa
 * de Q7 a Q3/libra. Las dos son correcciones deliberadas, no datos viejos, y el candado
 * de unidad NO las protege porque la unidad coincide. No aprobarlas.
 */

/** FIN_JULIO_26 — hoja nativa del cierre de julio 2026. */
var CIERRE_JULIO_26 = '1P0cp0xevmmqXg7DoLIqxucKTHfMeY-PTDprzFWthGOU';

function PROBAR_SYNC() {
  var props = PropertiesService.getScriptProperties();
  var previo = props.getProperty('INVENTARIO_CIERRE_SHEET_ID');

  if (previo !== CIERRE_JULIO_26) {
    props.setProperty('INVENTARIO_CIERRE_SHEET_ID', CIERRE_JULIO_26);
    Logger.log('INVENTARIO_CIERRE_SHEET_ID: %s -> %s', previo || '(vacia)', CIERRE_JULIO_26);
  } else {
    Logger.log('INVENTARIO_CIERRE_SHEET_ID ya estaba en %s', CIERRE_JULIO_26);
  }

  probarSincronizacion();

  Logger.log('--- Esto NO escribio nada. Revisar la propuesta antes de aplicar. ---');
  Logger.log('--- Descartar camote y papa de la lista que se apruebe. ---');
}
