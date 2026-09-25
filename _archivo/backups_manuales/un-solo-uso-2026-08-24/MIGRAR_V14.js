/**
 * MIGRAR_V14.gs — La migracion del recetario de cocina a la v14, en un solo boton.
 *
 * Un archivo con UNA sola funcion, por la razon que explica Diagnostico.gs: el
 * desplegable del editor no fija la seleccion y Run termina corriendo la primera
 * funcion del archivo. Abriendo este archivo, la unica opcion posible es la correcta.
 *
 * Hace, en orden y parando en el primer problema:
 *   1. convierte el .xlsx v14 a hoja nativa
 *   2. verifica que los VLOOKUP contra BANCO DE DATOS sigan calculando
 *      -> si estan rotos, NO repunta la propiedad y aborta
 *   3. repunta RECETARIO_COCINA_SHEET_ID y limpia los caches
 *   4. refrescarMapaPOS()
 *   5. probarCosteo()
 *
 * Es de una sola vez. Correrla dos veces deja una hoja nativa duplicada en Drive.
 *
 * Numeros esperados (verificados contra el .xlsx el 24 ago 2026):
 *   platos mapeados: 33 | ignorar: 7 | retirar: 5 | sin ficha: 7 | alta: 2
 *   COCINA -> 35 fichas de plato | 40 pre-elaborados | 26 con CMV | 9 vacias
 */

/** .xlsx de la v14 ya subido a Drive (carpeta Rosanta OS/04_Profit_OS/Recetario). */
var XLSX_V14 = '1UAN0sJ04K3sWbqxKltbpBgGxKwAtsBt_';

function MIGRAR_V14() {
  Logger.log('=== 1. convertir y verificar ===');
  var id = migrarRecetarioCocina(XLSX_V14, 'Rosanta_Recetario_Cocina_2027_v14');

  Logger.log('=== 2. mapa del POS ===');
  refrescarMapaPOS();

  Logger.log('=== 3. costeo ===');
  probarCosteo();

  Logger.log('=== listo. RECETARIO_COCINA_SHEET_ID = %s ===', id);
  Logger.log('Si algo no cuadra, la version anterior quedo en RECETARIO_COCINA_SHEET_ID_ANTERIOR.');
  return id;
}
