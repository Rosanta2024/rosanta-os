/**
 * Diagnostico.gs — Envoltorios para correr los chequeos desde el editor.
 *
 * Por que existe: el desplegable de funciones del editor de Apps Script no fija la
 * seleccion de forma fiable. Cuando un archivo tiene varias funciones, el editor
 * vuelve a la primera y el boton Run ejecuta esa, no la que se eligio. Eso ya hizo
 * correr getCosteoData tres veces creyendo que se corria probarCosteo.
 *
 * Este archivo tiene UNA sola funcion por eso mismo: al abrirlo, es la unica opcion
 * posible y Run no se puede equivocar. Si hace falta otro chequeo, conviene otro
 * archivo de una sola funcion antes que agregar una segunda aca.
 *
 * Para verificar que corrio lo que se queria: panel de Ejecuciones, columna Function.
 */

function DIAGNOSTICO() {
  probarCosteo();
}
