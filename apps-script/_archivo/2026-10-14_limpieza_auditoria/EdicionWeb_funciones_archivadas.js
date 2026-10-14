// Archivado el 14-oct-2026 (auditoria, Fase 4): codigo que nadie llamaba en EdicionWeb.js.
// Ver LEEME.txt de esta carpeta.

function webCambiarPrecioInsumo(auth, producto, precioNuevo, motivo, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return conCandadoRecetario_(function () { return cambiarPrecioInsumo_(producto, precioNuevo, u.email, u.rol, motivo, a); });
  }, 'cambiarPrecio ' + producto);
}

/** Antes de crear un insumo: que se le parece en el Banco. Evita duplicados. */
function webBuscarSimilares(auth, nombre, area) {
  return edicionCorrer_(auth, function (u) { return buscarSimilares_(nombre, areaLectura_(area, u)); });
}

/**
 * Para el campo "contenido" cuando la unidad de compra es un envase.
 * Un manojo va de 20 g a 75 g segun la hierba: no hay tabla, hay que preguntar.
 */
function webContenidosTipicos(auth, unidadCompra, unidadReceta, area) {
  return edicionCorrer_(auth, function (u) {
    return contenidosTipicos_(unidadCompra, unidadReceta, areaLectura_(area, u));
  });
}

/** Prueba la conversion sin escribir, para avisar en el formulario antes de guardar. */
function webProbarConversion(auth, unidadCompra, unidadReceta, contenido) {
  return edicionCorrer_(auth, function () {
    return factorConversion_(unidadCompra, unidadReceta, contenido);
  });
}
