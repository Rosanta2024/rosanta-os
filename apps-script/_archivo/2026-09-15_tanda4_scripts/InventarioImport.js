/**
 * InventarioImport.gs — Proveedores y precios desde los inventarios mensuales 2026.
 *
 * Regla de negocio (Juanma, 21 ago 2026): el proveedor y el precio de compra de cada
 * insumo salen del documento mensual de inventarios, no del Banco de Datos. El Banco
 * pasa a ser el destino, no la fuente.
 *
 * Este archivo NO reescribe nada del modulo de costeo: solo agrega el importador.
 * sembrarProveedores_() sigue existiendo para el arranque en frio; a partir de ahora
 * la siembra buena es importarInventario().
 *
 * Propiedades de la secuencia de comandos:
 *   INVENTARIO_COCINA_SHEET_ID -> FIN_JULIO_26        (hoja NATIVA)
 *   INVENTARIO_BARRA_SHEET_ID  -> Inventario Barra 2026 (hoja NATIVA, la de Jose)
 *
 * Los dos inventarios tienen layouts distintos y ninguno es estable:
 *   cocina -> PRODUCTO | PRECIO ANTERIOR | PRECIO ACTUALIZADO | PRESENTACION | PROVEEDOR
 *   barra  -> Destilado | Producto | Distribuidor | Precio | <fecha> | Variacion
 * Por eso el lector busca el bloque por ETIQUETA y nunca por posicion, igual que
 * leerFicha_ hace con las recetas. Una misma fila puede abrir dos bloques (en barra
 * hay dos tablas lado a lado), asi que se detectan todos los "PRODUCTO" de la fila.
 */

var INVENTARIO = {
  fuentes: [
    { clave: 'INVENTARIO_COCINA_SHEET_ID', area: 'COCINA' },
    { clave: 'INVENTARIO_BARRA_SHEET_ID',  area: 'BARRA'  }
  ],

  /** Pestanas del inventario que no son listas de precios. */
  hojasIgnoradas: ['herramientas', 'cristaleria', 'hoja '],

  /**
   * Nombre en el inventario -> nombre en el Banco de Datos, cuando no coinciden.
   * Lo llena previsualizarInventario(): corre el dry-run, mira "sin match" y agrega
   * aca solo los que de verdad son el mismo insumo. Nunca adivinar.
   */
  alias: {
    'botran 12 anos'      : 'BOTRAN 12',
    'reserva blanca'      : 'BOTRAN RESERVA',
    'buchannas 12 litro'  : 'BUCHANNAS LITRO',
    'glenmorangie original': 'GLENMORANGIE ORIGINAL'
  },

  /** Un precio que se mueve mas que esto no se aplica solo: se reporta y se decide a mano. */
  saltoSospechoso: 0.60,

  /**
   * Proveedores cuyo precio NO se importa nunca.
   *
   * "Produccion Rosanta" son los pre-elaborados: su precio en el Banco es el COSTO
   * POR ml/g que sale de su propia ficha, no un precio de compra. El inventario en
   * cambio les pone el valor de un envase para poder contar existencias. Son dos
   * numeros distintos: la Salsa Bordolesa cuesta Q149.15 el batch y el inventario
   * la valua a Q26.50 el litro. Importar eso rompe el costeo de toda la carta.
   */
  proveedoresNoImportables: ['produccion rosanta'],

  /**
   * Equivalencias de unidad entre el inventario (PRESENTACION) y el Banco
   * (UNIDAD_COMPRA). Si no se puede confirmar que son la misma unidad, no se importa:
   * el factor de conversion solo es valido si el precio nuevo esta en la misma
   * unidad que el viejo.
   */
  unidadesEquivalentes: {
    'libra': 'libra', 'lb': 'libra', 'libras': 'libra',
    'unidad': 'unidad', 'unida': 'unidad', 'unidades': 'unidad', 'u': 'unidad',
    'litro': 'litro', 'lt': 'litro', 'l': 'litro',
    'ml': 'ml', 'gramo': 'g', 'gramos': 'g', 'g': 'g',
    'onza': 'onza', 'onzas': 'onza', 'oz': 'onza',
    'galon': 'galon', 'gallon': 'galon',
    'frasco': 'frasco', 'bote': 'bote', 'lata': 'lata', 'manojo': 'manojo',
    'rollo': 'rollo', 'caja': 'caja', 'saco': 'saco', 'bolsa': 'bolsa'
  }
};

/** Normaliza una unidad a su forma canonica, o '' si no se reconoce. */
function unidadCanonica_(txt) {
  var t = normalizar_(txt);
  if (!t) return '';
  if (INVENTARIO.unidadesEquivalentes[t]) return INVENTARIO.unidadesEquivalentes[t];
  // "Tarro 500 ml", "bolsa de 5 lb", "8 onzas": se queda con la ultima palabra util
  var partes = t.split(/[\s\d.,]+/).filter(function (p) { return p; });
  for (var i = partes.length - 1; i >= 0; i--) {
    if (INVENTARIO.unidadesEquivalentes[partes[i]]) return INVENTARIO.unidadesEquivalentes[partes[i]];
  }
  return '';
}

/* ------------------------------------------------------------------ *
 *  Lectura
 * ------------------------------------------------------------------ */

/** Encuentra los bloques de tabla que abre una fila. Devuelve [{cProd,cProv,cPrecio}]. */
function detectarBloques_(fila) {
  var bloques = [];
  for (var j = 0; j < fila.length; j++) {
    if (normalizar_(fila[j]) !== 'producto') continue;

    var cProv = null, cPrecio = null, cPrecioAlt = null, cPres = null;
    for (var k = j + 1; k < Math.min(j + 8, fila.length); k++) {
      var t = normalizar_(fila[k]);
      if (!t) continue;
      if (cProv === null && (t === 'proveedor' || t === 'distribuidor')) cProv = k;
      if (cPres === null && (t.indexOf('presentacion') === 0 || t.indexOf('medida') === 0)) cPres = k;
      // "precio actualizado" manda sobre "precio anterior"; en barra solo hay "precio"
      if (t.indexOf('precio actualizado') === 0 || t.indexOf('precio actual') === 0) cPrecio = k;
      else if (cPrecioAlt === null && t.indexOf('precio') === 0) cPrecioAlt = k;
    }
    if (cPrecio === null) cPrecio = cPrecioAlt;
    if (cProv !== null && cPrecio !== null) {
      bloques.push({ cProd: j, cProv: cProv, cPrecio: cPrecio, cPrecioAlt: cPrecioAlt, cPres: cPres });
    }
  }
  return bloques;
}

/** Lee un inventario completo. Devuelve [{area,categoria,producto,precio,proveedor,hoja}]. */
function leerInventario_(ss, area) {
  var filas = [];

  ss.getSheets().forEach(function (hoja) {
    var nombreHoja = normalizar_(hoja.getName());
    for (var z = 0; z < INVENTARIO.hojasIgnoradas.length; z++) {
      if (nombreHoja.indexOf(INVENTARIO.hojasIgnoradas[z]) !== -1) return;
    }

    var datos = hoja.getDataRange().getValues();
    var bloques = [], categoria = '';

    for (var i = 0; i < datos.length; i++) {
      var fila = datos[i];

      var nuevos = detectarBloques_(fila);
      if (nuevos.length) { bloques = nuevos; continue; }
      if (!bloques.length) {
        // antes del primer encabezado, la fila con una sola celda llena es la categoria
        var llenas = fila.filter(function (v) { return String(v == null ? '' : v).trim(); });
        if (llenas.length === 1) categoria = String(llenas[0]).trim();
        continue;
      }

      // fila de categoria dentro del bloque: producto lleno, precio vacio, proveedor vacio
      var soloTitulo = true;
      bloques.forEach(function (b) {
        if (typeof fila[b.cPrecio] === 'number' || String(fila[b.cProv] || '').trim()) soloTitulo = false;
      });
      var prodPrimero = String(fila[bloques[0].cProd] || '').trim();
      if (soloTitulo && prodPrimero) { categoria = prodPrimero; continue; }

      bloques.forEach(function (b) {
        var producto = String(fila[b.cProd] || '').trim();
        if (!producto) return;

        var precio = fila[b.cPrecio];
        if (typeof precio !== 'number' || isNaN(precio)) {
          precio = b.cPrecioAlt !== null ? fila[b.cPrecioAlt] : null;   // cae al precio anterior
        }
        if (typeof precio !== 'number' || isNaN(precio) || precio <= 0) return;

        var proveedor = String(fila[b.cProv] || '').trim();
        if (!proveedor) return;

        filas.push({
          area: area,
          categoria: categoria,
          producto: producto,
          precio: precio,
          proveedor: proveedor,
          presentacion: b.cPres !== null ? String(fila[b.cPres] || '').trim() : '',
          hoja: hoja.getName()
        });
      });
    }
  });

  // un producto puede repetirse entre pestanas (cierre de julio y de junio): gana el primero
  var visto = {}, unicas = [];
  filas.forEach(function (f) {
    var k = f.area + '|' + normalizar_(f.producto);
    if (visto[k]) return;
    visto[k] = true;
    unicas.push(f);
  });
  return unicas;
}

/** Todos los inventarios configurados, juntos. */
function leerInventarios_() {
  var todo = [];
  INVENTARIO.fuentes.forEach(function (f) {
    var ss = abrirPorClave_(f.clave);
    if (!ss) { Logger.log('AVISO: falta la propiedad %s, se omite %s', f.clave, f.area); return; }
    var filas = leerInventario_(ss, f.area);
    Logger.log('%s -> %s lineas con proveedor y precio (%s)', f.area, filas.length, ss.getName());
    todo = todo.concat(filas);
  });
  return todo;
}

/* ------------------------------------------------------------------ *
 *  Indice del Banco de Datos (una pasada por area, no una por producto)
 * ------------------------------------------------------------------ */

/** { 'AREA|producto normalizado' -> {hoja,fila,col,...} } para todos los Bancos. */
function indexarBancos_() {
  var idx = {};
  COSTEO.areas.forEach(function (cfg) {
    var ss = abrirPorClave_(cfg.clave);
    if (!ss) return;
    ss.getSheets().forEach(function (hoja) {
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
        var producto = String(fila[colDe + 1] || '').trim();
        if (!producto) continue;
        var k = cfg.area + '|' + normalizar_(producto);
        if (idx.hasOwnProperty(k)) continue;
        idx[k] = {
          hoja: hoja, fila: i + 1, col: colDe, area: cfg.area, producto: producto,
          precioUnidad: typeof fila[colDe + 2] === 'number' ? fila[colDe + 2] : null,
          unidad: String(fila[colDe + 3] || '').trim(),
          precioCompra: typeof fila[colDe + 4] === 'number' ? fila[colDe + 4] : null,
          unidadCompra: String(fila[colDe + 5] || '').trim(),
          proveedor: String(fila[colDe + 7] || '').trim()
        };
      }
    });
  });
  return idx;
}

/** Busca la fila del Banco para una linea de inventario, probando el alias. */
function ubicarConAlias_(idx, fila) {
  var k = normalizar_(fila.producto);
  if (idx.hasOwnProperty(fila.area + '|' + k)) return idx[fila.area + '|' + k];

  var alias = INVENTARIO.alias[k];
  if (alias && idx.hasOwnProperty(fila.area + '|' + normalizar_(alias))) {
    return idx[fila.area + '|' + normalizar_(alias)];
  }
  // el mismo insumo puede estar cargado en el Banco de la otra area
  var otras = ['COCINA', 'BARRA'];
  for (var i = 0; i < otras.length; i++) {
    if (otras[i] === fila.area) continue;
    if (idx.hasOwnProperty(otras[i] + '|' + k)) return idx[otras[i] + '|' + k];
  }
  return null;
}

/**
 * Decide que hacer con una linea del inventario. La previsualizacion y el import
 * usan exactamente esta funcion, para que el dry-run nunca mienta sobre lo que
 * va a pasar de verdad.
 *
 * Devuelve { estado, banco, nuevoUnidad, salto, texto } con estado en:
 *   no-importable | sin-match | sin-factor | unidad-distinta | igual | cambia | salto
 */
function clasificarLinea_(f, idx) {
  var etq = f.area + ' > ' + f.producto + '  (' + f.proveedor + ')';

  if (INVENTARIO.proveedoresNoImportables.indexOf(normalizar_(f.proveedor)) !== -1) {
    return { estado: 'no-importable', texto: etq };
  }

  var b = ubicarConAlias_(idx, f);
  if (!b) return { estado: 'sin-match', texto: etq };

  if (b.precioCompra === null || b.precioCompra === 0 || b.precioUnidad === null) {
    return { estado: 'sin-factor', banco: b, texto: b.producto + '  (inventario Q' + f.precio + ')' };
  }

  // El factor solo es valido si el precio nuevo esta en la misma unidad que el viejo.
  var uInv = unidadCanonica_(f.presentacion);
  var uBanco = unidadCanonica_(b.unidadCompra);
  if (!uInv || !uBanco || uInv !== uBanco) {
    return {
      estado: 'unidad-distinta', banco: b,
      texto: b.producto + ': banco "' + (b.unidadCompra || '?') + '" vs inventario "' +
             (f.presentacion || '?') + '"  (Q' + b.precioCompra.toFixed(2) + ' vs Q' + f.precio.toFixed(2) + ')'
    };
  }

  if (Math.abs(b.precioCompra - f.precio) < 0.005) return { estado: 'igual', banco: b };

  var salto = Math.abs(f.precio - b.precioCompra) / b.precioCompra;
  var texto = b.producto + ': Q' + b.precioCompra.toFixed(2) + ' -> Q' + f.precio.toFixed(2) +
              '  (' + (salto * 100).toFixed(0) + '%)  ' + f.proveedor;

  return {
    estado: salto > INVENTARIO.saltoSospechoso ? 'salto' : 'cambia',
    banco: b, salto: salto, texto: texto,
    nuevoUnidad: f.precio * (b.precioUnidad / b.precioCompra)
  };
}

/* ------------------------------------------------------------------ *
 *  Dry run: no escribe nada
 * ------------------------------------------------------------------ */

/**
 * Corre el importador en seco y deja el diagnostico en el Log.
 * SIEMPRE correr esto antes de importarInventario().
 */
function previsualizarInventario() {
  soloDueno_();
  var filas = leerInventarios_();
  var idx = indexarBancos_();

  var proveedores = {}, grupos = {
    'no-importable': [], 'sin-match': [], 'sin-factor': [],
    'unidad-distinta': [], 'igual': [], 'cambia': [], 'salto': []
  };

  filas.forEach(function (f) {
    proveedores[f.proveedor] = (proveedores[f.proveedor] || 0) + 1;
    var r = clasificarLinea_(f, idx);
    grupos[r.estado].push(r.texto || '');
  });

  function bloque(titulo, lista, tope) {
    Logger.log('--------------------------------------------------');
    Logger.log('%s: %s', titulo, lista.length);
    lista.slice(0, tope).forEach(function (s) { if (s) Logger.log('   ' + s); });
    if (lista.length > tope) Logger.log('   ... y %s mas', lista.length - tope);
  }

  Logger.log('==================================================');
  Logger.log('lineas leidas del inventario: %s', filas.length);
  Logger.log('proveedores distintos: %s', Object.keys(proveedores).length);
  Object.keys(proveedores).sort().forEach(function (p) {
    Logger.log('   %s (%s productos)', p, proveedores[p]);
  });

  Logger.log('==================================================');
  Logger.log('SE VAN A APLICAR: %s', grupos['cambia'].length);
  grupos['cambia'].forEach(function (c) { Logger.log('   ' + c); });

  Logger.log('==================================================');
  Logger.log('NO se tocan:');
  bloque('ya coinciden con el Banco', grupos['igual'], 0);
  bloque('pre-elaborados (su precio sale de la ficha, no del inventario)', grupos['no-importable'], 8);
  bloque('UNIDAD DISTINTA entre inventario y Banco', grupos['unidad-distinta'], 40);
  bloque('salto sospechoso (>' + (INVENTARIO.saltoSospechoso * 100).toFixed(0) + '%)', grupos['salto'], 40);
  bloque('sin PRECIO_COMPRA en el Banco', grupos['sin-factor'], 20);
  bloque('sin match en el Banco de Datos', grupos['sin-match'], 40);

  return {
    leidas: filas.length, proveedores: Object.keys(proveedores).length,
    aplicar: grupos['cambia'].length, iguales: grupos['igual'].length,
    unidadDistinta: grupos['unidad-distinta'].length, saltos: grupos['salto'].length,
    preelaborados: grupos['no-importable'].length,
    sinFactor: grupos['sin-factor'].length, sinMatch: grupos['sin-match'].length
  };
}

/* ------------------------------------------------------------------ *
 *  Import de verdad
 * ------------------------------------------------------------------ */

/**
 * Escribe proveedores y precios del inventario en la hoja de costeo y en el Banco.
 * Conserva el factor de conversion de cada insumo, igual que registrarPrecio():
 * factor = precio_por_unidad_receta / precio_de_compra. Nunca reinterpreta la
 * columna CONVERSION, que esta escrita de quince formas distintas.
 *
 * Los saltos de precio mayores a INVENTARIO.saltoSospechoso NO se aplican: se
 * reportan para revisarlos a mano. Un decimal mal tecleado en el inventario si no
 * se filtra recalcula el CMV de media carta.
 */
function importarInventario(aplicarSaltos) {
  soloDueno_();
  var usuario = getUsuarioActual();
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  var filas = leerInventarios_();
  var idx = indexarBancos_();
  var ss = hojaCosteo_();

  var hojaPrecios = ss.getSheetByName(COSTEO.hojas.precios);
  var nuevasPrecios = [], aplicados = 0, omitidos = [], proveedores = {};
  var ahora = new Date();
  var quien = (usuario && usuario.email) || Session.getActiveUser().getEmail();

  filas.forEach(function (f) {
    proveedores[f.proveedor] = f;

    var r = clasificarLinea_(f, idx);
    if (r.estado === 'salto' && aplicarSaltos) r.estado = 'cambia';   // decision explicita
    if (r.estado === 'salto') { omitidos.push(r.texto); return; }
    if (r.estado !== 'cambia') return;

    var b = r.banco;
    b.hoja.getRange(b.fila, b.col + 3).setValue(r.nuevoUnidad);  // PRECIO / UNIDAD RECETA
    b.hoja.getRange(b.fila, b.col + 5).setValue(f.precio);       // PRECIO COMPRA
    b.hoja.getRange(b.fila, b.col + 8).setValue(f.proveedor);    // PROVEEDOR

    nuevasPrecios.push([
      ahora, b.producto, f.proveedor, f.precio, b.unidad, r.nuevoUnidad,
      'inventario ' + f.hoja, quien, 'importado del inventario mensual 2026'
    ]);
    aplicados++;
  });

  if (nuevasPrecios.length) {
    hojaPrecios.getRange(hojaPrecios.getLastRow() + 1, 1, nuevasPrecios.length, 9)
               .setValues(nuevasPrecios);
  }

  var sembrados = sembrarProveedoresInventario_(proveedores);
  CacheService.getScriptCache().remove(COSTEO.cacheKey);

  Logger.log('precios aplicados al Banco: %s', aplicados);
  Logger.log('proveedores nuevos en la hoja PROVEEDORES: %s', sembrados);
  Logger.log('omitidos por salto sospechoso: %s', omitidos.length);
  omitidos.forEach(function (o) { Logger.log('   ' + o); });
  if (omitidos.length) Logger.log('Para aplicarlos igual: importarInventario(true)');

  return { aplicados: aplicados, proveedoresNuevos: sembrados, omitidos: omitidos.length };
}

/** Agrega a PROVEEDORES los que aparecen en el inventario y todavia no estan. */
function sembrarProveedoresInventario_(proveedores) {
  var hoja = hojaCosteo_().getSheetByName(COSTEO.hojas.proveedores);
  var yaHay = {};
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues().forEach(function (f) {
      yaHay[normalizar_(f[0])] = true;
      String(f[1] || '').split('·').forEach(function (a) {
        if (a.trim()) yaHay[normalizar_(a)] = true;
      });
    });
  }

  var cats = {};
  Object.keys(proveedores).forEach(function (p) {
    var f = proveedores[p];
    if (!cats[p]) cats[p] = {};
    if (f.categoria) cats[p][f.categoria] = 1;
  });

  var nuevas = Object.keys(proveedores)
    .filter(function (p) { return !yaHay[normalizar_(p)]; })
    .map(function (p) {
      return [p, '', '', '', Object.keys(cats[p] || {}).join(' · '), 'SI', 'del inventario 2026'];
    });

  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 7).setValues(nuevas);
  }
  return nuevas.length;
}
