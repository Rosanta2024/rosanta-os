/**
 * MIGRAR_V16.gs — Pasar el recetario de cocina de la v14 a la v16, en un solo boton.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs y MIGRAR_V14.gs.
 *
 * ANTES DE CORRER: pegar abajo el ID del .xlsx de la v16 ya subido a Drive.
 * El ID sale de la URL del archivo en Drive:
 *   https://drive.google.com/file/d/ESTO_ES_EL_ID/view
 *
 * Hace, en orden y parando en el primer problema:
 *   1. convierte el .xlsx v16 a hoja nativa
 *   2. verifica que los VLOOKUP contra BANCO DE DATOS sigan calculando
 *      -> si estan rotos, NO repunta la propiedad y aborta
 *   3. repunta RECETARIO_COCINA_SHEET_ID y limpia los caches
 *   4. refresca el mapa del POS
 *   5. corre la bateria de pruebas y la vuelca al Log
 *
 * REVERSIBLE: la version anterior queda guardada en RECETARIO_COCINA_SHEET_ID_ANTERIOR.
 * Para volver atras, se copia ese valor de vuelta a RECETARIO_COCINA_SHEET_ID en
 * Configuracion del proyecto > Propiedades de la secuencia de comandos.
 *
 * Es de una sola vez. Correrla dos veces deja una hoja nativa duplicada en Drive.
 *
 * QUE DEBERIA PASAR: las 5 fallas de hoy se apagan juntas, porque las cinco salian
 * de leer la v14.
 *   Version del recetario ....... v14 -> v16
 *   CMV ensalada rosanta ........ 15.9 -> 15.0
 *   Platos mapeados ............. 33 -> 35
 *   Todos tienen pestana ........ 33 sin pestana -> 0
 *   Nombres resueltos ........... 0 -> 35
 */

/**
 * .xlsx de la v16, subido a Drive el 24-ago-2026 en
 * Rosanta OS / 04_Profit_OS / Recetario, al lado del de la v14.
 */
var XLSX_V16 = '1E0OG5O_ng4yi46EvlnkX1RlYWqyz3HDo';

function MIGRAR_V16() {
  if (!XLSX_V16 || XLSX_V16 === 'PEGAR_AQUI_EL_ID') {
    throw new Error('Falta el ID del .xlsx de la v16. Editar XLSX_V16 arriba de este archivo.');
  }

  Logger.log('=== 1. convertir y verificar los VLOOKUP ===');
  var id = migrarRecetarioCocina(XLSX_V16, 'Rosanta_Recetario_Cocina_2027_v16');

  Logger.log('=== 2. mapa del POS ===');
  refrescarMapaPOS();

  Logger.log('=== 3. bateria de pruebas ===');
  try {
    Logger.log(pruebasATexto_(correrPruebas()));
  } catch (e) {
    // Si la bateria se pasa del limite de tiempo, la migracion YA quedo hecha.
    // No es para alarmarse: se corre CORRER_PRUEBAS aparte.
    Logger.log('La bateria no termino: %s', String(e && e.message || e));
    Logger.log('La migracion si quedo hecha. Correr CORRER_PRUEBAS por separado.');
  }

  Logger.log('=== listo. RECETARIO_COCINA_SHEET_ID = %s ===', id);
  Logger.log('La version anterior quedo en RECETARIO_COCINA_SHEET_ID_ANTERIOR.');
  return id;
}
