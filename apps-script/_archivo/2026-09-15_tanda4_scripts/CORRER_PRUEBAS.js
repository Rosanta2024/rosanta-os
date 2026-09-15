/**
 * CORRER_PRUEBAS.gs — UNA sola funcion, a proposito.
 *
 * El desplegable del editor no fija la seleccion y corre la primera funcion del
 * archivo. Con una sola adentro no se puede equivocar. Misma razon que Diagnostico.gs.
 *
 * OJO con el nombre: el disco del Mac no distingue mayusculas, asi que este archivo
 * NO se puede llamar PRUEBAS.js mientras exista Pruebas.js. Serian el mismo archivo
 * y uno pisaria al otro sin avisar.
 *
 * Corre la bateria completa y escribe el resultado en el Log (Ver > Registros).
 * No escribe nada en ninguna hoja.
 */
function CORRER_PRUEBAS() {
  soloDueno_();
  var res = correrPruebas_();
  Logger.log(pruebasATexto_(res));
  return res;
}
