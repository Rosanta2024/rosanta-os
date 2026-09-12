/**
 * CosteoDatos.gs — Lee el Banco de Datos y las fichas, y arma el modelo normalizado
 * que consumen las vistas (Recetario Visual y Proveedores).
 *
 * Fuente de verdad: las hojas nativas del recetario. Este archivo NO las modifica.
 * Lo unico que escribe es la hoja de costeo (PROVEEDORES / PRECIOS / INDICE), y eso
 * lo hace Proveedores.gs.
 */

/** Punto de entrada del cliente. Devuelve todo el modelo, cacheado 15 min. */
function getCosteoData() {
  var usuario = getUsuarioActual();
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  var cache = CacheService.getScriptCache();
  var guardado = cache.get(COSTEO.cacheKey);
  if (guardado) {
    try { return JSON.parse(Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(guardado), 'application/zip'))[0].getDataAsString()); }
    catch (e) { /* cache invalido, se recalcula */ }
  }

  var modelo = construirModelo_();
  try {
    var zip = Utilities.zip([Utilities.newBlob(JSON.stringify(modelo), 'application/json', 'm.json')]);
    cache.put(COSTEO.cacheKey, Utilities.base64Encode(zip.getBytes()), COSTEO.cacheSegs);
  } catch (e) { /* si excede el limite de cache seguimos sin cachear */ }
  return modelo;
}

/** Boton "actualizar" de la vista. */
function refrescarCosteo() {
  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  return getCosteoData();
}

function construirModelo_() {
  var insumos = [], recetas = [], porNombreInsumo = {}, porNombreReceta = {};

  COSTEO.areas.forEach(function (cfg) {
    var ss = abrirPorClave_(cfg.clave);
    if (!ss) return;

    ss.getSheets().forEach(function (hoja) {
      var titulo = normalizar_(hoja.getName());
      var esNoReceta = COSTEO.tabsNoReceta.some(function (t) { return titulo.indexOf(normalizar_(t)) === 0; });

      if (titulo.indexOf('banco de datos') === 0) {
        leerBanco_(hoja, cfg, insumos, porNombreInsumo);
        return;
      }
      if (esNoReceta) return;

      var ficha = leerFicha_(hoja, cfg);
      if (ficha) {
        ficha.id = recetas.length;
        porNombreReceta[normalizar_(ficha.nombre)] = ficha.id;
        recetas.push(ficha);
      }
    });
  });

  // enlaces: ingrediente -> insumo, insumo de produccion -> su ficha de pre-elaborado
  insumos.forEach(function (i) {
    i.sub = porNombreReceta.hasOwnProperty(normalizar_(i.producto)) ? porNombreReceta[normalizar_(i.producto)] : null;
    i.usos = [];
  });
  recetas.forEach(function (r) {
    r.base = 0;
    r.ingredientes.forEach(function (g) {
      var k = normalizar_(g.nombre);
      g.insumo = porNombreInsumo.hasOwnProperty(k) ? porNombreInsumo[k] : null;
      if (g.insumo !== null && insumos[g.insumo].usos.indexOf(r.id) === -1) insumos[g.insumo].usos.push(r.id);
      r.base += (g.total || 0);
    });
  });

  return {
    recetas: recetas,
    insumos: insumos,
    proveedores: agruparProveedores_(insumos),
    meta: {
      generado: new Date().toISOString(),
      areas: COSTEO.areas.map(function (a) { return { area: a.area, cmvObjetivo: a.cmvObjetivo }; })
    }
  };
}

/** BANCO DE DATOS -> lista de insumos. Tolera filas de titulo y de conversiones. */
function leerBanco_(hoja, cfg, insumos, indice) {
  var datos = hoja.getDataRange().getValues();
  var colDe = null;

  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];

    if (colDe === null) {
      for (var j = 0; j < fila.length; j++) {
        if (normalizar_(fila[j]) === 'categoria' && normalizar_(fila[j + 1]) === 'producto') { colDe = j; break; }
      }
      continue;
    }

    var categoria = String(fila[colDe] || '').trim();
    var producto  = String(fila[colDe + 1] || '').trim();
    var precio    = fila[colDe + 2];

    if (!producto || !categoria) continue;
    if (normalizar_(categoria) === normalizar_(producto)) continue;   // fila separadora de categoria
    if (typeof precio !== 'number' || isNaN(precio)) continue;

    var k = normalizar_(producto);
    if (indice.hasOwnProperty(k)) continue;                            // primer registro gana

    indice[k] = insumos.length;
    insumos.push({
      id: insumos.length,
      area: cfg.area,
      categoria: categoria,
      producto: producto,
      precio: precio,
      unidad: String(fila[colDe + 3] || '').trim(),
      precioCompra: typeof fila[colDe + 4] === 'number' ? fila[colDe + 4] : null,
      unidadCompra: String(fila[colDe + 5] || '').trim(),
      conversion: String(fila[colDe + 6] || '').trim(),
      proveedor: normalizarProveedor_(fila[colDe + 7])
    });
  }
}

/** Una pestana de ficha o de pre-elaborado -> objeto receta con sus lineas. */
function leerFicha_(hoja, cfg) {
  var datos = hoja.getDataRange().getValues();
  if (!datos.length) return null;

  var r = {
    area: cfg.area, nombre: hoja.getName().trim(), tipo: 'plato', categoria: '',
    precio: null, subtotal: null, merma: cfg.merma, costo: null, sugerido: null,
    cmv: null, rinde: null, nota: '', ingredientes: [], cmvObjetivo: cfg.cmvObjetivo
  };

  var enIngredientes = false, colIng = null;

  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i], esResumen = false;

    for (var j = 0; j < fila.length; j++) {
      var celda = normalizar_(fila[j]);
      if (!celda) continue;

      if (celda.indexOf('pre-elaborado') === 0 || celda.indexOf('preelaborado') === 0) r.tipo = 'preelaborado';
      else if (celda === 'precio menu:' || celda === 'precio menu') {
        r.precio = primerNumero_(fila, j + 1);
        for (var k = 0; k < fila.length; k++) {
          var t = String(fila[k] || '').trim();
          if (t && normalizar_(t).indexOf('precio') === -1 && normalizar_(t).indexOf('ficha') === -1) { r.categoria = t; break; }
        }
        esResumen = true;
      }
      else if (celda === 'rinde:' ) { r.rinde = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda === 'ingrediente') { enIngredientes = true; colIng = j; esResumen = true; }
      else if (celda.indexOf('subtotal materia prima') === 0 || celda.indexOf('costo total del batch') === 0) {
        enIngredientes = false; r.subtotal = primerNumero_(fila, j + 1); esResumen = true;
      }
      else if (celda.indexOf('variacion') === 0 || celda.indexOf('merma') === 0) {
        var m = String(fila[j]).match(/(\d+)\s*%/); if (m) r.merma = Number(m[1]);
        esResumen = true;
      }
      else if (celda.indexOf('costo total') === 0)      { r.costo = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda.indexOf('costo por porcion') === 0) { r.costo = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda.indexOf('rinde (porciones)') === 0) { r.rinde = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda.indexOf('precio sugerido') === 0)   { r.sugerido = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda.indexOf('cmv % actual') === 0) {
        var v = primerNumero_(fila, j + 1);
        if (v !== null) r.cmv = v <= 1.5 ? v * 100 : v;
        esResumen = true;
      }
    }

    if (enIngredientes && !esResumen && colIng !== null) {
      var nombre = String(fila[colIng] || '').trim();
      var cant   = fila[colIng + 1];
      if (nombre && typeof cant === 'number' && !isNaN(cant)) {
        r.ingredientes.push({
          nombre: nombre,
          cantidad: cant,
          unidad: String(fila[colIng + 2] || '').trim(),
          total: typeof fila[colIng + 4] === 'number' ? fila[colIng + 4] : null
        });
      }
    }
  }

  if (r.costo === null && r.subtotal !== null) r.costo = r.subtotal * (1 + r.merma / 100);
  if (r.cmv === null && r.costo && r.precio) r.cmv = r.costo / r.precio * 100;
  r.estado = !r.ingredientes.length ? 'vacia'
           : !r.precio ? 'sin_precio'
           : r.cmv > r.cmvObjetivo + 5 ? 'alto'
           : r.cmv < r.cmvObjetivo - 10 ? 'bajo' : 'ok';
  return r;
}

/**
 * Unifica los alias de proveedor que hoy conviven en el Banco de Datos.
 * Cuando exista la hoja PROVEEDORES esta tabla se lee de ahi (columna ALIAS).
 */
function normalizarProveedor_(valor) {
  var v = normalizar_(valor);
  if (!v || v === '—' || v === '-' || v === 'teorico') return 'Sin proveedor';
  if (v.indexOf('precio por unidad') === 0 || v.indexOf('1 onza') === 0) return 'Sin proveedor';
  var alias = {
    'tavito': 'Don Tavito', 'don tavito': 'Don Tavito',
    'rosanta': 'Produccion Rosanta', 'produccion rosanta': 'Produccion Rosanta',
    'mercado rosanta': 'Mercado', 'mercado': 'Mercado',
    'jardin/los alpes': 'Los Alpes / Jardin'
  };
  return alias[v] || String(valor).trim();
}

function agruparProveedores_(insumos) {
  var mapa = {};
  insumos.forEach(function (i) {
    if (!mapa[i.proveedor]) mapa[i.proveedor] = { nombre: i.proveedor, productos: 0, recetas: {} };
    mapa[i.proveedor].productos++;
    i.usos.forEach(function (rid) { mapa[i.proveedor].recetas[rid] = 1; });
  });
  return Object.keys(mapa).map(function (k) {
    return { nombre: k, productos: mapa[k].productos, recetas: Object.keys(mapa[k].recetas).length };
  }).sort(function (a, b) { return b.productos - a.productos; });
}

/** Diagnostico: correr desde el editor y leer el Log. */
function probarCosteo() {
  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  var m = construirModelo_();
  Logger.log('insumos: %s | recetas: %s | proveedores: %s', m.insumos.length, m.recetas.length, m.proveedores.length);
  var huerfanos = [];
  m.recetas.forEach(function (r) {
    r.ingredientes.forEach(function (g) { if (g.insumo === null) huerfanos.push(r.nombre + ' > ' + g.nombre); });
  });
  Logger.log('lineas sin match en el Banco de Datos: %s', huerfanos.length);
  huerfanos.slice(0, 30).forEach(function (h) { Logger.log('  ' + h); });
}
