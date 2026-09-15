/**
 * Proveedores.gs — Modulo de proveedores y lista de precios con fecha y factura.
 * Revision 21 ago 2026: historial expuesto a la vista, reporte de higiene callable,
 * y el alias de proveedor se siembra en la hoja para que unifique de verdad.
 *
 * Resuelve el pendiente #24 del recetario: "no existe una lista de precios de proveedor
 * con fecha y factura; el Banco de Datos es el unico registro y sus precios no tienen
 * fecha ni respaldo".
 *
 * Como funciona:
 *   - PRECIOS guarda cada precio que entra, con fecha, proveedor, factura y quien lo cargo.
 *   - Al registrar un precio se actualiza el Banco de Datos manteniendo la conversion
 *     original (factor = precio_por_unidad_receta / precio_de_compra), asi que todas las
 *     fichas se recalculan solas por sus VLOOKUP y no hay que tocar ninguna pestana.
 *   - El historico queda para auditoria y para ver como se movio el costo en el tiempo.
 */

/* ------------------------------------------------------------------ *
 *  Instalacion (correr UNA vez desde el editor)
 * ------------------------------------------------------------------ */

function crearHojaCosteo() {
  soloDueno_();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('COSTEO_SHEET_ID')) {
    Logger.log('Ya existe COSTEO_SHEET_ID: %s', props.getProperty('COSTEO_SHEET_ID'));
    return;
  }
  var ss = SpreadsheetApp.create('Rosanta_Costeo_Proveedores');
  props.setProperty('COSTEO_SHEET_ID', ss.getId());

  var prov = ss.getSheets()[0].setName(COSTEO.hojas.proveedores);
  prov.getRange(1, 1, 1, 7).setValues([[
    'PROVEEDOR', 'ALIAS_EN_BANCO', 'CONTACTO', 'TELEFONO', 'CATEGORIAS', 'ACTIVO', 'NOTAS'
  ]]).setFontWeight('bold');
  prov.setFrozenRows(1);

  var pre = ss.insertSheet(COSTEO.hojas.precios);
  pre.getRange(1, 1, 1, 9).setValues([[
    'FECHA', 'PRODUCTO', 'PROVEEDOR', 'PRECIO_COMPRA', 'UNIDAD_COMPRA',
    'PRECIO_UNIDAD_RECETA', 'FACTURA', 'CAPTURADO_POR', 'NOTA'
  ]]).setFontWeight('bold');
  pre.setFrozenRows(1);

  var idx = ss.insertSheet(COSTEO.hojas.indice);
  idx.getRange(1, 1, 1, 8).setValues([[
    'PRODUCTO', 'PROVEEDOR', 'AREA', 'RECETA', 'TIPO', 'CANTIDAD', 'UNIDAD', 'COSTO_LINEA'
  ]]).setFontWeight('bold');
  idx.setFrozenRows(1);

  sembrarProveedores_();
  regenerarIndice();
  Logger.log('Listo. COSTEO_SHEET_ID = %s', ss.getId());
  Logger.log('URL: %s', ss.getUrl());
}

/** Llena PROVEEDORES con los nombres que hoy aparecen en el Banco de Datos. */
function sembrarProveedores_() {
  var modelo = construirModelo_();
  var hoja = hojaCosteo_().getSheetByName(COSTEO.hojas.proveedores);
  var yaHay = {};
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues()
        .forEach(function (f) { yaHay[normalizar_(f[0])] = true; });
  }
  var cats = {};
  modelo.insumos.forEach(function (i) {
    if (!cats[i.proveedor]) cats[i.proveedor] = {};
    cats[i.proveedor][i.categoria] = 1;
  });
  var filas = modelo.proveedores
    .filter(function (p) { return !yaHay[normalizar_(p.nombre)]; })
    .map(function (p) {
      return [p.nombre, '', '', '', Object.keys(cats[p.nombre] || {}).join(' · '), 'SI', ''];
    });
  if (filas.length) hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 7).setValues(filas);
  return filas.length;
}

/* ------------------------------------------------------------------ *
 *  API para la vista
 * ------------------------------------------------------------------ */

/** Historial de precios de un producto, mas reciente primero. */
function getHistorialPrecios(auth, producto) {
  var usuario = resolverUsuario_(auth);
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  var hoja = hojaCosteo_().getSheetByName(COSTEO.hojas.precios);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var k = normalizar_(producto);
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 9).getValues()
    .filter(function (f) { return normalizar_(f[1]) === k; })
    .map(function (f) {
      return {
        fecha: f[0] instanceof Date ? Utilities.formatDate(f[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(f[0]),
        producto: f[1], proveedor: f[2], precioCompra: f[3], unidadCompra: f[4],
        precioUnidad: f[5], factura: f[6], capturadoPor: f[7], nota: f[8]
      };
    })
    .reverse();
}

/**
 * Registra un precio nuevo y actualiza el Banco de Datos.
 * datos = { producto, proveedor, precioCompra, factura, nota }
 * Devuelve { producto, antes, ahora, variacion, recetasAfectadas: [...] }
 */
function registrarPrecio(auth, datos) {
  var usuario = resolverUsuario_(auth);
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  // Esta funcion escribe EXACTAMENTE las mismas celdas que cambiarPrecioInsumo_() en
  // EdicionRecetario.gs, pero hasta el 26-ago-2026 chequeaba distinto: solo pedia el
  // modulo, no el permiso del rol. O sea que un rol que en EDIT.permisos solo puede
  // 'editarCantidad' quedaba bloqueado por un camino y no por el otro, para la misma
  // escritura. Dos puertas al mismo cuarto con cerraduras distintas es lo mismo que
  // una puerta sin cerradura.
  exigirPermiso_(usuario && usuario.rol, 'cambiarPrecio');

  if (!datos || !datos.producto) throw new Error('Falta el producto');

  var nuevo = Number(datos.precioCompra);
  if (!isFinite(nuevo) || nuevo <= 0) throw new Error('El precio de compra tiene que ser un numero mayor que cero');

  // EL AREA (14-sep-2026). Sin area se buscaba el producto en las dos y ganaba COCINA:
  // registrar el precio del ajo de BARRA escribia sobre el ajo de COCINA —hay ocho
  // productos con el mismo nombre en las dos—, y como aca no se pasaba por exigirArea_,
  // el rol de sala podia escribir en cocina. Es el agujero que EdicionWeb.gs cerro el
  // 27-ago para las demas escrituras; este boton habia quedado afuera. La pantalla
  // ahora manda el area del producto. Sin area se comporta como antes, para los
  // llamadores de servidor.
  var area = datos.area ? exigirArea_(usuario && usuario.rol, datos.area) : null;

  // Lo que toca vuelve en `cambios` y la pantalla ya no recarga: ver
  // conCambiosDeModelo_ en CosteoDatos.gs.
  var hecho = conCambiosDeModelo_(function () {
    var ubic = ubicarEnBanco_(datos.producto, area);
    if (!ubic) throw new Error('El producto "' + datos.producto + '" no esta en el Banco de Datos');

    var antesCompra = ubic.precioCompra;
    var antesUnidad = ubic.precioUnidad;

    // El factor de conversion se conserva: no hay que reinterpretar el texto de la columna.
    var factor = (antesCompra && antesCompra !== 0) ? (antesUnidad / antesCompra) : null;
    if (factor === null) {
      throw new Error('No se puede convertir: el Banco de Datos no tiene precio de compra para "' +
        ubic.producto + '". Corregilo a mano una vez y despues ya funciona.');
    }

    var nuevoUnidad = nuevo * factor;

    ubic.hoja.getRange(ubic.fila, ubic.col + 3).setValue(nuevoUnidad);   // PRECIO / UNIDAD RECETA
    ubic.hoja.getRange(ubic.fila, ubic.col + 5).setValue(nuevo);         // PRECIO COMPRA
    if (datos.proveedor) ubic.hoja.getRange(ubic.fila, ubic.col + 8).setValue(datos.proveedor);

    var quien = (usuario && usuario.email) || Session.getActiveUser().getEmail();

    // PRECIOS se conserva: guarda factura y unidad de compra, que BITACORA no tiene.
    hojaCosteo_().getSheetByName(COSTEO.hojas.precios).appendRow([
      new Date(), ubic.producto, datos.proveedor || ubic.proveedor, nuevo, ubic.unidadCompra,
      nuevoUnidad, datos.factura || '', quien, datos.nota || ''
    ]);

    // Y ademas BITACORA, con el mismo formato que cambiarPrecioInsumo_() y que el sync.
    // Sin esto, "quien tocó el precio del lomito" habia que buscarlo en tres pestanas
    // distintas y ninguna tenia la historia completa. La regla del proyecto es que
    // BITACORA es el registro: un cambio que no aparece ahi es un cambio invisible.
    var pctBit = antesCompra ? Math.round((nuevo - antesCompra) / antesCompra * 1000) / 10 : 0;
    bitacora_(quien, (usuario && usuario.rol) || '', 'registrarPrecio', EDIT.hojaBanco,
              String(ubic.producto), 'precio compra', antesCompra, nuevo,
              (pctBit >= 0 ? '+' : '') + pctBit + '%' +
              (datos.factura ? ' · factura ' + datos.factura : '') +
              (datos.nota ? ' · ' + datos.nota : ''));

    invalidarCache_({ precio: ubic.producto, area: ubic.area });

    return {
      producto: ubic.producto,
      area: ubic.area,
      antes: antesCompra,
      ahora: nuevo,
      variacion: antesCompra ? (nuevo - antesCompra) / antesCompra * 100 : null
    };
  });

  var res = hecho.resultado;
  res.cambios = hecho.cambios;
  // Hasta el 14-sep-2026 aca se borraba el cache y se reconstruia el modelo entero
  // (~40 s) solo para contar las recetas afectadas, sin guardarlo: la pantalla
  // recargaba y lo volvia a pagar. Ahora salen de las fichas que el parche recalculo.
  res.recetasAfectadas = ((hecho.cambios && hecho.cambios.fichas) || []).map(function (r) {
    return { nombre: r.nombre, area: r.area, tipo: r.tipo, cmv: r.cmv, estado: r.estado };
  });
  return res;
}

/** Ubica un producto dentro de la hoja BANCO DE DATOS (busca en todas las areas). */
function ubicarEnBanco_(producto, area) {
  // Con area, se busca SOLO en esa. Sin area se recorren todas y gana la primera,
  // que es COCINA — el comportamiento viejo, y la razon por la que editar el ajo de
  // BARRA terminaba escribiendo sobre el de COCINA.
  var k = normalizar_(producto), encontrado = null;
  var soloArea = area ? areaValida_(area) : null;

  COSTEO.areas.forEach(function (cfg) {
    if (soloArea && cfg.area !== soloArea) return;
    if (encontrado) return;
    var ss = abrirPorClave_(cfg.clave);
    if (!ss) return;

    ss.getSheets().forEach(function (hoja) {
      if (encontrado) return;
      if (normalizar_(hoja.getName()).indexOf('banco de datos') !== 0) return;

      var datos = hoja.getDataRange().getValues(), colDe = null;
      for (var i = 0; i < datos.length; i++) {
        var fila = datos[i];
        if (colDe === null) {
          for (var j = 0; j < fila.length; j++) {
            if (normalizar_(fila[j]) === 'categoria' && normalizar_(fila[j + 1]) === 'producto') { colDe = j; break; }
          }
          continue;
        }
        if (normalizar_(fila[colDe + 1]) === k) {
          encontrado = {
            hoja: hoja, fila: i + 1, col: colDe,          // col es 0-based; +1 = columna CATEGORIA
            area: cfg.area,
            producto: String(fila[colDe + 1]).trim(),
            precioUnidad: typeof fila[colDe + 2] === 'number' ? fila[colDe + 2] : null,
            unidad: String(fila[colDe + 3] || '').trim(),
            precioCompra: typeof fila[colDe + 4] === 'number' ? fila[colDe + 4] : null,
            unidadCompra: String(fila[colDe + 5] || '').trim(),
            proveedor: String(fila[colDe + 7] || '').trim()
          };
          break;
        }
      }
    });
  });
  return encontrado;
}

/** Vuelca el indice insumo -> receta a una hoja, para consultarlo tambien desde Sheets. */
function regenerarIndice() {
  soloDueno_();
  var modelo = construirModelo_();
  var hoja = hojaCosteo_().getSheetByName(COSTEO.hojas.indice);
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, 8).clearContent();

  var filas = [];
  modelo.recetas.forEach(function (r) {
    r.ingredientes.forEach(function (g) {
      var i = g.insumo !== null ? modelo.insumos[g.insumo] : null;
      filas.push([g.nombre, i ? i.proveedor : 'FUERA DEL BANCO', r.area, r.nombre, r.tipo,
                  g.cantidad, g.unidad, g.total]);
    });
  });
  if (filas.length) hoja.getRange(2, 1, filas.length, 8).setValues(filas);
  Logger.log('Indice regenerado: %s lineas', filas.length);
  return filas.length;
}

/**
 * Reporte de higiene del recetario: lo que hay que corregir para que el costeo cierre.
 * Version callable desde la vista.
 */
function getReporteHigiene(auth) {
  var usuario = resolverUsuario_(auth);
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');
  return reporteHigiene_();
}

function reporteHigiene_() {
  // Del cache, no construido (14-sep-2026). Construirlo eran ~40 s cada vez que alguien
  // abria la pestana Higiene, aunque el recetario estuviera servido.
  var m = modeloCosteo_();
  var fuera = [], sinUso = [], sinPrecioCompra = [], vacias = [], sobreMeta = [], sinProveedor = [];

  m.recetas.forEach(function (r) {
    if (!r.ingredientes.length) vacias.push(r.area + ' · ' + r.nombre);
    else if (r.estado === 'alto') sobreMeta.push(r.area + ' · ' + r.nombre + ' (' + r.cmv.toFixed(1) + '% vs meta ' + r.cmvObjetivo + '%)');
    r.ingredientes.forEach(function (g) {
      if (g.insumo === null) fuera.push(r.area + ' · ' + r.nombre + ' > ' + g.nombre);
    });
  });
  m.insumos.forEach(function (i) {
    if (!i.usos.length) sinUso.push(i.producto);
    if (i.precioCompra === null) sinPrecioCompra.push(i.producto);
    if (i.proveedor === 'Sin proveedor') sinProveedor.push(i.producto);
  });

  var rep = {
    lineasFueraDelBanco: fuera,
    insumosSinUso: sinUso,
    insumosSinPrecioDeCompra: sinPrecioCompra,
    insumosSinProveedor: sinProveedor,
    fichasVacias: vacias,
    platosSobreMeta: sobreMeta
  };
  Object.keys(rep).forEach(function (k) { Logger.log('%s: %s', k, rep[k].length); });
  return rep;
}
