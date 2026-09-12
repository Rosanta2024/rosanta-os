/**
 * PROBAR_VENTANAS.gs — Corre probarIngenieriaMenu() en las ventanas que el
 * documento del 30-ago-2026 usa como oraculo, una tras otra.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs y DIAG_URL.gs:
 * el desplegable del editor elige la primera del archivo abierto, e IngenieriaMenu.gs
 * tiene nueve. Ademas probarIngenieriaMenu lleva dos argumentos que el editor no
 * puede pasar, asi que a mano solo se puede correr la ventana por defecto.
 *
 * SOLO LEE. No escribe una celda.
 *
 * QUE TIENE QUE DAR, segun el documento (ya con el ajuste a venta neta):
 *
 *   2026-05-25 -> 2026-08-23   (el trimestre)
 *     COCINA  CMV 29.7%  contribucion Q150,905  recuperable Q18,243  E/C/R/P 7/7/5/3
 *     BARRA   CMV 23.9%  contribucion Q45,027   recuperable Q10,159  E/C/R/P 18/10/14/8
 *
 *   2026-01-02 -> 2026-08-23   (todo lo cargado)
 *     COCINA  E/C/R/P 7/7/4/4
 *     BARRA   E/C/R/P 18/13/14/5
 *
 * El numero que mas importa es la CLASIFICACION DE COCINA: no se tiene que mover
 * ni un producto respecto de antes del IVA. Si se movio, el error esta en el codigo
 * y el sospechoso es el MC promedio por categoria, que tiene que ser neto igual que
 * el margen de cada plato.
 */
function PROBAR_VENTANAS() {
  /* FORZAR EL CATALOGO ANTES DE MEDIR. catalogoPOS_ cachea 15 minutos el archivo que
     resolvio, y el mapa del POS otro tanto. Quien acaba de exportar un catalogo nuevo
     y corre esto enseguida mediria contra el anterior, no veria ningun cambio y
     concluiria que la correccion no sirvio. Una funcion de verificacion que puede
     verificar datos rancios es peor que no tenerla. */
  var cat = catalogoPOS_(true);
  refrescarMapaPOS();
  // Solo el dia: fechaDeNombreInventario_ ya no devuelve hora —la del nombre es
  // ambigua— y estampar un 00:00 haria pensar que el export es de medianoche.
  Logger.log('CATALOGO EN USO: %s%s', cat.nombre,
             cat.fecha ? '  (' + Utilities.formatDate(cat.fecha, 'America/Guatemala', 'yyyy-MM-dd') + ')' : '');
  if (cat.respaldo) Logger.log('OJO: se leyo el RESPALDO, no la carpeta. %s', cat.aviso || '');
  if (cat.aviso && !cat.respaldo) Logger.log('OJO: %s', cat.aviso);
  Logger.log('');

  var ventanas = [
    ['2026-05-25', '2026-08-23', 'el trimestre'],
    ['2026-01-02', '2026-08-23', 'todo lo cargado']
  ];
  var out = [];
  ventanas.forEach(function (v) {
    Logger.log('');
    Logger.log('################  %s  (%s a %s)  ################', v[2], v[0], v[1]);
    out.push(probarIngenieriaMenu(v[0], v[1]));
  });
  return out;
}
