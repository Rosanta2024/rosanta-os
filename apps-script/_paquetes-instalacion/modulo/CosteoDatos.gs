/**
 * CosteoDatos.gs — Lee el Banco de Datos y las fichas, y arma el modelo normalizado
 * que consumen las vistas (Recetario Visual y Proveedores).
 *
 * Revision 21 ago 2026:
 *   - cada receta viaja con su AREA y su META de CMV (antes toda la barra se medía contra 30%)
 *   - las hojas de control y las fichas archivadas se excluyen bien (ver esHojaDeControl_)
 *   - los pre-elaborados guardan costo del batch, rinde y costo por unidad por separado,
 *     asi funcionan igual los de cocina ("costo por porcion") y los de barra ("costo por ml")
 *   - cada linea de ingrediente sabe si apunta a una sub-receta, para poder saltar a su ficha
 *
 * Fuente de verdad: las hojas nativas del recetario. Este archivo NO las modifica.
 */

/** Punto de entrada del cliente. Devuelve todo el modelo, cacheado 15 min. */
function getCosteoData() {
  var usuario = getUsuarioActual();
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  var cache = CacheService.getScriptCache();
  var guardado = cache.get(COSTEO.cacheKey);
  if (guardado) {
    try {
      return JSON.parse(Utilities.unzip(Utilities.newBlob(
        Utilities.base64Decode(guardado), 'application/zip'))[0].getDataAsString());
    } catch (e) { /* cache invalido, se recalcula */ }
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

      if (titulo.indexOf('banco de datos') === 0) {
        leerBanco_(hoja, cfg, insumos, porNombreInsumo);
        return;
      }
      if (esHojaDeControl_(hoja.getName())) return;

      var ficha = leerFicha_(hoja, cfg);
      if (ficha) {
        ficha.id = recetas.length;
        // el indice de recetas se guarda por area, para que un nombre repetido
        // en cocina y barra no se pise
        porNombreReceta[cfg.area + '|' + normalizar_(ficha.nombre)] = ficha.id;
        recetas.push(ficha);
      }
    });
  });

  // insumo de produccion -> su ficha de pre-elaborado (directo o por alias)
  insumos.forEach(function (i) {
    i.sub = buscarSubReceta_(i.area, i.producto, porNombreReceta);
    i.usos = [];
  });

  // ingrediente -> insumo, e ingrediente -> sub-receta
  recetas.forEach(function (r) {
    r.base = 0;
    r.ingredientes.forEach(function (g) {
      var k = normalizar_(g.nombre);
      g.insumo = porNombreInsumo.hasOwnProperty(r.area + '|' + k) ? porNombreInsumo[r.area + '|' + k] : null;
      if (g.insumo === null && porNombreInsumo.hasOwnProperty('COCINA|' + k)) g.insumo = porNombreInsumo['COCINA|' + k];
      if (g.insumo === null && porNombreInsumo.hasOwnProperty('BARRA|' + k))  g.insumo = porNombreInsumo['BARRA|' + k];

      g.receta = (g.insumo !== null && insumos[g.insumo].sub !== null)
        ? insumos[g.insumo].sub
        : buscarSubReceta_(r.area, g.nombre, porNombreReceta);

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

/** Nombre del Banco -> id de la ficha de sub-receta, probando el alias si hace falta. */
function buscarSubReceta_(area, nombre, porNombreReceta) {
  var k = normalizar_(nombre);
  if (porNombreReceta.hasOwnProperty(area + '|' + k)) return porNombreReceta[area + '|' + k];
  var alias = COSTEO.aliasSubReceta[k];
  if (alias && porNombreReceta.hasOwnProperty(area + '|' + normalizar_(alias))) {
    return porNombreReceta[area + '|' + normalizar_(alias)];
  }
  return null;
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

    var k = cfg.area + '|' + normalizar_(producto);
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

/**
 * Una pestana de ficha o de pre-elaborado -> objeto receta con sus lineas.
 * Ojo: el encabezado INGREDIENTE no esta en la misma fila en todas las fichas
 * (en unas es la 4 y en otras la 5), por eso se busca por etiqueta y nunca por posicion.
 */
function leerFicha_(hoja, cfg) {
  var datos = hoja.getDataRange().getValues();
  if (!datos.length) return null;

  var r = {
    area: cfg.area, nombre: hoja.getName().trim(), tipo: 'plato', categoria: '',
    precio: null, subtotal: null, merma: cfg.merma, costo: null, sugerido: null,
    cmv: null, rinde: null, rindeTexto: '', costoUnit: null, unidadCosto: '',
    nota: '', ingredientes: [], cmvObjetivo: cfg.cmvObjetivo
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
      else if (celda === 'rinde:') {
        r.rinde = primerNumero_(fila, j + 1);
        r.rindeTexto = primerTexto_(fila, j + 1);
        esResumen = true;
      }
      else if (celda === 'ingrediente') { enIngredientes = true; colIng = j; esResumen = true; }

      else if (celda.indexOf('subtotal materia prima') === 0 || celda.indexOf('costo total del batch') === 0) {
        enIngredientes = false; r.subtotal = primerNumero_(fila, j + 1); esResumen = true;
      }
      else if (celda.indexOf('variacion') === 0 || celda.indexOf('merma') === 0) {
        var m = String(fila[j]).match(/(\d+)\s*%/); if (m) r.merma = Number(m[1]);
        esResumen = true;
      }
      else if (celda.indexOf('costo total') === 0) { r.costo = primerNumero_(fila, j + 1); esResumen = true; }

      // cocina usa "COSTO POR PORCION"; barra usa "COSTO POR ml" o "COSTO POR GRAMO"
      else if (celda.indexOf('costo por') === 0) {
        r.costoUnit = primerNumero_(fila, j + 1);
        r.unidadCosto = String(fila[j]).replace(/costo\s+por/i, '').replace(/[()]/g, '').trim();
        esResumen = true;
      }
      // "RINDE (porciones)", "RINDE (ml)", "RINDE (gramos producidos)"
      else if (celda.indexOf('rinde') === 0) {
        var n = primerNumero_(fila, j + 1);
        if (n !== null) r.rinde = n;
        if (!r.rindeTexto) r.rindeTexto = String(fila[j]).replace(/rinde/i, '').replace(/[():]/g, '').trim();
        esResumen = true;
      }
      else if (celda.indexOf('precio sugerido') === 0) { r.sugerido = primerNumero_(fila, j + 1); esResumen = true; }
      else if (celda.indexOf('cmv % actual') === 0) {
        var v = primerNumero_(fila, j + 1);
        if (v !== null) r.cmv = v <= 1.5 ? v * 100 : v;
        esResumen = true;
      }
      // la nota de contexto que llevan las fichas en la fila 3
      else if (i <= 3 && celda.length > 25 && !esResumen && !r.nota &&
               celda.indexOf('ficha de receta') !== 0 && celda.indexOf('pre-elaborado') !== 0) {
        r.nota = String(fila[j]).trim();
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

  // costo del batch: lo que este disponible
  if (r.costo === null && r.subtotal !== null) r.costo = r.subtotal * (1 + r.merma / 100);

  // para un pre-elaborado, el costo que interesa es el unitario
  if (r.tipo === 'preelaborado') {
    if (r.costoUnit === null && r.costo !== null && r.rinde) r.costoUnit = r.costo / r.rinde;
  }

  if (r.cmv === null && r.costo && r.precio) r.cmv = r.costo / r.precio * 100;

  r.estado = !r.ingredientes.length ? 'vacia'
           : r.tipo === 'preelaborado' ? 'pre'
           : !r.precio ? 'sin_precio'
           : r.cmv > r.cmvObjetivo + 5 ? 'alto'
           : r.cmv < r.cmvObjetivo * 0.6 ? 'bajo' : 'ok';
  return r;
}

/**
 * Unifica los alias de proveedor. Si existe la hoja PROVEEDORES con la columna
 * ALIAS_EN_BANCO, esa tabla manda sobre la lista de abajo.
 */
var _aliasProv = null;
function aliasProveedores_() {
  if (_aliasProv) return _aliasProv;
  _aliasProv = {
    'tavito': 'Don Tavito', 'don tavito': 'Don Tavito',
    'rosanta': 'Produccion Rosanta', 'produccion rosanta': 'Produccion Rosanta',
    'mercado rosanta': 'Mercado', 'mercado': 'Mercado',
    'jardin/los alpes': 'Los Alpes / Jardin'
  };
  try {
    var hoja = hojaCosteo_().getSheetByName(COSTEO.hojas.proveedores);
    if (hoja && hoja.getLastRow() > 1) {
      hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues().forEach(function (f) {
        var oficial = String(f[0] || '').trim();
        if (!oficial) return;
        String(f[1] || '').split(/[·,;|]/).forEach(function (a) {
          a = normalizar_(a);
          if (a) _aliasProv[a] = oficial;
        });
      });
    }
  } catch (e) { /* la hoja aun no existe */ }
  return _aliasProv;
}

function normalizarProveedor_(valor) {
  var v = normalizar_(valor);
  if (!v || v === '—' || v === '-' || v === 'teorico') return 'Sin proveedor';
  if (v.indexOf('precio por unidad') === 0 || v.indexOf('1 onza') === 0) return 'Sin proveedor';
  var alias = aliasProveedores_();
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

/**
 * Diagnostico. Correr desde el editor y leer el Log ANTES de confiar en el modulo.
 * Los numeros de referencia al 21 ago 2026 (recetario v9 + barra v5):
 *   COCINA  -> 31 fichas de plato, 41 pre-elaborados, 24 platos con CMV
 *   BARRA   -> 27 cocteles y bebidas, 29 pre-elaborados
 *   control -> Mix de Fritas 67.9% | Tabla de Jamones 23.0% | Gratin de Papas 19.8%
 */
function probarCosteo() {
  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  var m = construirModelo_();

  ['COCINA', 'BARRA'].forEach(function (a) {
    var rs = m.recetas.filter(function (r) { return r.area === a; });
    var pl = rs.filter(function (r) { return r.tipo === 'plato'; });
    Logger.log('%s -> %s platos | %s pre-elaborados | %s con CMV | insumos %s',
      a, pl.length, rs.length - pl.length,
      pl.filter(function (r) { return r.cmv != null; }).length,
      m.insumos.filter(function (i) { return i.area === a; }).length);
  });

  var control = { 'mix de fritas': 67.9, 'tabla de jamones y quesos': 23.0, 'gratin de papas': 19.8 };
  Object.keys(control).forEach(function (k) {
    var r = m.recetas.filter(function (x) { return normalizar_(x.nombre) === k; })[0];
    if (!r) { Logger.log('CONTROL FALTA: %s', k); return; }
    var ok = r.cmv != null && Math.abs(r.cmv - control[k]) < 0.6;
    Logger.log('CONTROL %s: leido %s esperado %s -> %s', k,
      r.cmv == null ? 'null' : r.cmv.toFixed(1), control[k], ok ? 'OK' : 'REVISAR');
  });

  var huerfanos = [];
  m.recetas.forEach(function (r) {
    r.ingredientes.forEach(function (g) { if (g.insumo === null) huerfanos.push(r.nombre + ' > ' + g.nombre); });
  });
  Logger.log('lineas sin match en el Banco de Datos: %s', huerfanos.length);
  huerfanos.slice(0, 30).forEach(function (h) { Logger.log('  ' + h); });

  var basura = m.recetas.filter(function (r) { return !r.ingredientes.length && r.precio === null; });
  Logger.log('fichas sin ingredientes y sin precio (posibles hojas de control mal leidas): %s', basura.length);
  basura.forEach(function (r) { Logger.log('  ' + r.area + ' > ' + r.nombre); });
}
