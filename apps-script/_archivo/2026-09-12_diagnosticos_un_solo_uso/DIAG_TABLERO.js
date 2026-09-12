/**
 * DIAG_TABLERO.gs — Cuanto tarda cada pieza del tablero y de la ingenieria de menu.
 *
 * Un archivo con UNA sola funcion. SOLO LEE.
 *
 * POR QUE EXISTE
 * El 30-ago-2026 la pestana Inicio tardaba demasiado en abrir. Ya paso una vez que
 * persiguieramos la lentitud a ojo —resulto ser 28.000 JSON.parse dentro de un
 * bucle— y perdimos una tarde. Esto mide en vez de suponer: dice cuantos segundos
 * se va cada llamada, y con eso el arreglo se decide con un numero.
 *
 * Correr desde el editor y leer el Log. Los tiempos son en segundos.
 */
function DIAG_TABLERO() {
  var t0 = new Date().getTime(), marca = t0, filas = [];
  function paso(nombre, fn) {
    var a = new Date().getTime(), r = null, err = '';
    try { r = fn(); } catch (e) { err = String(e && e.message || e); }
    var s = (new Date().getTime() - a) / 1000;
    filas.push([nombre, s, err, r]);
    Logger.log('%s s   %s%s', s.toFixed(2), nombre, err ? '   ERROR: ' + err : '');
    marca = new Date().getTime();
    return r;
  }

  Logger.log('=== EL TABLERO, pieza por pieza ===');

  var v = paso('ventanaVentas_(13)  — lee la columna FECHA entera', function () {
    return ventanaVentas_(13);
  });
  if (!v) { Logger.log('Sin ventas cargadas. No sigo.'); return; }

  paso('ventasDelRango_        — lee la hoja de ventas entera', function () {
    var x = ventasDelRango_(v.desde, v.hasta);
    return x.lineas.length + ' lineas';
  });
  paso('leerCatalogoPOS_       — abre el catalogo del POS', function () {
    return Object.keys(leerCatalogoPOS_().porNombre || {}).length + ' nombres';
  });
  paso('leerResumenCMV_        — abre RESUMEN CMV del recetario', function () {
    return Object.keys(leerResumenCMV_() || {}).length + ' platos';
  });
  paso('mapaPOS_()  cacheado', function () { return 'ok'; });
  paso('mapaPOS_(true)  FORZADO — reconstruye el cache', function () {
    return Object.keys(mapaPOS_(true).platos || {}).length + ' platos';
  });

  paso('ventasYVentana_(13)     — la lectura UNICA que las reemplaza', function () {
    var w = ventasYVentana_(13);
    return w ? w.ventas.lineas.length + ' lineas' : 'sin ventas';
  });

  Logger.log('');
  Logger.log('=== LO QUE PIDE LA PANTALLA AL ABRIR ===');
  Logger.log('Las dos se lanzan a la vez desde el navegador: lo que tarda en');
  Logger.log('abrir es la MAS LENTA de las dos, no la suma.');
  paso('getCosteoData()   — el recetario entero, la pantalla de "Cargando…"', function () {
    var d = getCosteoData();
    return (d.recetas || []).length + ' recetas · ' + (d.insumos || []).length + ' insumos';
  });
  paso('huellaDatos_()    — dos celdas, para saber si el cache sirve', function () {
    return huellaDatos_() || '(vacia: no se va a cachear)';
  });
  paso('getProfitOS(13)   — PRIMERA vez: calcula y guarda', function () {
    var d = getProfitOS('', 13);
    return d.tablero.ok ? 'CMV global ' + (d.tablero.cmv.global * 100).toFixed(1) + '%'
                        : d.tablero.error;
  });
  paso('getProfitOS(13)   — SEGUNDA vez: deberia salir del cache', function () {
    var d = getProfitOS('', 13);
    return d.deCache ? 'DEL CACHE' : 'RECALCULADO (el cache no sirvio: mirar el tamano)';
  });

  Logger.log('');
  Logger.log('=== LOS AVISOS, uno por uno ===');
  paso('avisoPrecios_   — llama a verificarNombresPOS', function () {
    var a = avisoPrecios_(); return a ? a.texto : 'sin aviso';
  });
  paso('avisoExports_   — recorre Drive', function () {
    var a = avisoExports_(); return a ? a.texto : 'sin aviso';
  });
  paso('avisoSinFicha_', function () { var a = avisoSinFicha_(); return a ? a.texto : 'sin aviso'; });
  paso('avisoCierre_', function () { var a = avisoCierre_(); return a ? a.texto : 'sin aviso'; });

  Logger.log('');
  Logger.log('TOTAL de la corrida: %s s', ((new Date().getTime() - t0) / 1000).toFixed(2));
  Logger.log('');
  Logger.log('COMO SE LEE: el tiempo de apertura es el MAYOR entre getCosteoData y');
  Logger.log('getProfitOS, no la suma: el navegador las pide a la vez. Los avisos van');
  Logger.log('encadenados despues y no cuentan para el primer pintado.');
  return filas;
}
