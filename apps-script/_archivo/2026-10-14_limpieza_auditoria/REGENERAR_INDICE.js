/**
 * REGENERAR_INDICE.gs — Rehace INDICE_INSUMO_RECETA contra el recetario actual.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs. Aca importa
 * ademas porque regenerarIndice() vive en Proveedores.gs, que tiene 8 funciones y
 * arranca con crearHojaCosteo().
 *
 * Por que hace falta: INDICE_INSUMO_RECETA es una FOTO, no una vista viva. La que
 * hay en el libro de costeo se saco antes de la v14, asi que le faltan las fichas
 * nuevas (Peras, Mousse, Charlotta, Panacotta) y todavia muestra el aceite de oliva
 * al precio viejo. Nada del modulo la lee —construirModelo_() arma todo de cero—,
 * pero es la tabla que se consulta a mano desde Sheets, y hoy miente.
 *
 * Solo LEE el recetario. Lo unico que escribe es esa pestana del libro de costeo.
 * Conviene volver a correrla cada vez que cambie la version del recetario.
 */
function REGENERAR_INDICE() {
  soloDueno_();
  var n = regenerarIndice();
  Logger.log('INDICE_INSUMO_RECETA regenerado contra el recetario en uso: %s lineas.', n);
  return n;
}
