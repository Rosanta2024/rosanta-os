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

/** Punto de entrada del cliente. Devuelve todo el modelo, cacheado (ver modeloCosteo_). */
/* auth: el token del enlace personal. Va PRIMERO, igual que en EdicionWeb.gs.
   Hasta el 10-sep-2026 esta funcion llamaba a getUsuarioActual() a secas: la
   pagina se abria con el token pero la llamada que trae los datos viajaba sin
   el, caia en la sesion de dominio y a quien entra con Gmail personal le tiraba
   "Sin acceso al recetario". El modulo nunca habia funcionado para Jeffry ni
   Jose; fueron los primeros en llegar hasta aca. Sin auth se comporta como
   antes, asi que las pruebas y los diagnosticos siguen llamandola sin nada. */
function getCosteoData(auth) {
  var usuario = resolverUsuario_(auth);
  if (!usuarioTieneModulo(usuario, 'recetario')) throw new Error('Sin acceso al recetario');

  var modelo = modeloCosteo_();
  // Viajan aparte del cache a proposito: la pantalla necesita la merma de cada area y
  // los alias de sub-receta para corregir su copia del modelo sin recargar (ver
  // aplicarCambios en CosteoJs_Base), y un modelo cacheado antes de este cambio no
  // los traeria.
  modelo.meta.areas = COSTEO.areas.map(function (a) {
    return { area: a.area, cmvObjetivo: a.cmvObjetivo, merma: a.merma };
  });
  modelo.meta.aliasSub = COSTEO.aliasSubReceta;
  return modelo;
}

/** Boton "actualizar" de la vista. */
function refrescarCosteo() {
  olvidarModeloCosteo_();
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

  var modelo = {
    recetas: recetas,
    insumos: insumos,
    proveedores: [],
    meta: {
      generado: new Date().toISOString(),
      areas: COSTEO.areas.map(function (a) { return { area: a.area, cmvObjetivo: a.cmvObjetivo }; })
    }
  };
  enlazarModelo_(modelo);
  return modelo;
}

/**
 * Une las piezas del modelo: ingrediente -> insumo, ingrediente -> sub-receta,
 * insumo -> las recetas que lo usan, y la lista de proveedores.
 *
 * Salio de construirModelo_ el 14-sep-2026 para poder correrlo tambien sobre un
 * modelo CORREGIDO: cuando la pantalla agrega una linea o crea una ficha, el modelo
 * cacheado se parcha con la ficha releida y se vuelve a enlazar aca, sin leer las dos
 * hojas enteras (~40 s). Es JavaScript puro: cero llamadas a servicio.
 *
 * Los ids son la posicion en el arreglo, igual que al construir. Un nombre de insumo
 * no se repite dentro de un area (leerBanco_ se queda con el primero), y entre
 * recetas con el mismo nombre gana la ultima, igual que antes.
 *
 * OJO: la pantalla tiene su copia en CosteoJs_Base.html (enlazarModelo). Si cambia
 * una regla aca, cambia alla.
 */
function enlazarModelo_(modelo) {
  var insumos = modelo.insumos, recetas = modelo.recetas;
  var porNombreInsumo = {}, porNombreReceta = {};
  insumos.forEach(function (i, idx) {
    i.id = idx;
    var k = i.area + '|' + normalizar_(i.producto);
    if (!porNombreInsumo.hasOwnProperty(k)) porNombreInsumo[k] = idx;
  });
  recetas.forEach(function (r, idx) {
    r.id = idx;
    porNombreReceta[r.area + '|' + normalizar_(r.nombre)] = idx;
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

  modelo.proveedores = agruparProveedores_(insumos);
  return modelo;
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
          total: typeof fila[colIng + 4] === 'number' ? fila[colIng + 4] : null,
          // fila REAL de la hoja, 1-indexada. Sin esto la vista no puede pedir que se
          // edite una linea: editarCantidad(ficha, fila, ...) necesita el numero exacto,
          // y buscar por nombre seria ambiguo si una ficha repite un ingrediente.
          fila: i + 1
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

  r.estado = estadoReceta_(r);
  return r;
}

/** El estado de una receta por sus numeros. Uno solo para la lectura y para el parche de precios. */
function estadoReceta_(r) {
  return !r.ingredientes.length ? 'vacia'
       : r.tipo === 'preelaborado' ? 'pre'
       : !r.precio ? 'sin_precio'
       : r.cmv > r.cmvObjetivo + 5 ? 'alto'
       : r.cmv < r.cmvObjetivo * 0.6 ? 'bajo' : 'ok';
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

/* ==========================================================================
   EL MODELO SE CORRIGE, NO SE TIRA — 14-sep-2026

   Cocina reporto que cada ingrediente que agregaba a una receta nueva dejaba la
   pantalla en blanco casi un minuto. Era asi por diseno. Cada escritura terminaba en
   invalidarCache_(), que borraba el modelo cacheado, y la pantalla hacia
   location.reload(): la recarga pedia getCosteoData con el cache vacio y el servidor
   volvia a leer las dos hojas enteras (~40 s). Una receta de ocho ingredientes eran
   seis minutos de pantalla blanca, y el que abria el recetario despues pagaba otra vez.

   Ahora, cuando la escritura viene de la pantalla:
     1. la escritura ANOTA que toco (una ficha, un producto, un precio) en vez de
        borrar el cache (anotarCambioDeModelo_, desde invalidarCache_);
     2. al terminar se relee SOLO eso: una pestana, o el Banco de un area;
     3. el modelo cacheado se corrige con lo releido y se vuelve a enlazar sin leer
        nada mas (enlazarModelo_ es JavaScript puro);
     4. lo releido vuelve a la pantalla en `cambios`, que corrige su copia sin recargar.

   Si algo de eso no se puede —el cache ya estaba vacio, otro proceso tiene el
   candado, la ficha no aparece— se vuelve a lo de antes: se borra el cache y la
   pantalla recibe cambios.recargar = true. Nunca queda un cache a medio corregir.

   Lo que escribe por fuera de la pantalla (el sync de precios, el cargador de ventas,
   el editor) no pasa por aca y sigue borrando el cache como siempre.
   ========================================================================== */

/**
 * Marca de generacion del modelo. La cambia toda escritura que toca el recetario.
 *
 * Cubre una carrera concreta: calentarCaches() empieza a reconstruir (40 s), en el
 * medio alguien agrega un ingrediente, y al terminar la reconstruccion guardaria en
 * el cache un modelo leido ANTES de ese ingrediente. Con la marca, modeloCosteo_ ve
 * que cambio mientras construia y no guarda lo viejo.
 */
var COSTEO_GEN_ = 'costeo_gen_v1';

function marcarGeneracionCosteo_(cache) {
  // La hora sola no alcanza: dos marcas en el mismo milisegundo quedarian iguales y la
  // reconstruccion creeria que nada cambio. El sufijo al azar lo hace imposible.
  try { cache.put(COSTEO_GEN_, new Date().getTime() + ':' + Math.random().toString(36).slice(2), 21600); } catch (e) {}
}

/** Borra el modelo cacheado y cambia la marca. Es lo que hacia invalidarCache_ antes. */
function olvidarModeloCosteo_() {
  var cache = CacheService.getScriptCache();
  cache.remove(COSTEO.cacheKey);
  marcarGeneracionCosteo_(cache);
}

/** El modelo del cache, o null si no hay o no se puede leer. */
function leerModeloCacheado_(cache) {
  var guardado = cache.get(COSTEO.cacheKey);
  if (!guardado) return null;
  try {
    return JSON.parse(Utilities.unzip(Utilities.newBlob(
      Utilities.base64Decode(guardado), 'application/zip'))[0].getDataAsString());
  } catch (e) { return null; }
}

/**
 * Guarda el modelo comprimido. Si no entra (100 KB por valor), BORRA lo que hubiera:
 * despues de un parche, dejar el valor viejo seria dejar un modelo que ya no coincide
 * con la hoja.
 */
function guardarModeloCacheado_(cache, modelo) {
  try {
    var zip = Utilities.zip([Utilities.newBlob(JSON.stringify(modelo), 'application/json', 'm.json')]);
    cache.put(COSTEO.cacheKey, Utilities.base64Encode(zip.getBytes()), COSTEO.cacheSegs);
    return true;
  } catch (e) {
    cache.remove(COSTEO.cacheKey);
    return false;
  }
}

/** El modelo: del cache si esta; si no, construido y guardado. */
function modeloCosteo_() {
  var cache = CacheService.getScriptCache();
  var modelo = leerModeloCacheado_(cache);
  if (modelo) return modelo;
  var gen = cache.get(COSTEO_GEN_);
  modelo = construirModelo_();
  if (cache.get(COSTEO_GEN_) === gen) guardarModeloCacheado_(cache, modelo);
  return modelo;
}

/* Lo que va tocando la escritura en curso. null = nadie esta juntando, y las
   escrituras borran el cache como siempre. Es por ejecucion: cada llamada de
   google.script.run es una ejecucion nueva y arranca en null. */
var CAMBIOS_MODELO_ = null;

/** true si habia alguien juntando y el toque quedo anotado. */
function anotarCambioDeModelo_(toque) {
  if (!CAMBIOS_MODELO_) return false;
  CAMBIOS_MODELO_.push(toque || { todo: true });
  return true;
}

/**
 * Corre fn juntando lo que toca, y al final corrige el modelo.
 * Devuelve { resultado, cambios }; cambios es null si fn no toco el recetario.
 *
 *   toque = { ficha, area }    una pestana de receta
 *         | { insumo, area }   una fila del Banco (alta, proveedor)
 *         | { precio, area }   el precio de una fila del Banco: mueve las recetas que lo usan
 *         | { proveedor }      la hoja PROVEEDORES, que no es parte del modelo
 *         | { todo: true }     no se sabe que cambio: se borra el cache
 */
function conCambiosDeModelo_(fn) {
  if (CAMBIOS_MODELO_) return { resultado: fn(), cambios: null };   // anidado: junta el de afuera
  CAMBIOS_MODELO_ = [];
  var resultado, toques;
  try {
    resultado = fn();
  } catch (e) {
    toques = CAMBIOS_MODELO_;
    CAMBIOS_MODELO_ = null;
    if (toques.length) olvidarModeloCosteo_();   // fallo despues de escribir algo
    throw e;
  }
  toques = CAMBIOS_MODELO_;
  CAMBIOS_MODELO_ = null;
  if (!toques.length) return { resultado: resultado, cambios: null };

  // La escritura ya ocurrio: nada de lo que siga puede hacerla parecer fallida.
  var cambios;
  try {
    cambios = aplicarToques_(toques);
  } catch (e) {
    olvidarModeloCosteo_();
    cambios = { fichas: [], insumos: [], recargar: true };
  }
  return { resultado: resultado, cambios: cambios };
}

/**
 * Relee lo tocado, corrige el modelo cacheado y arma lo que vuelve a la pantalla:
 * { fichas: [receta cruda...], insumos: [insumo crudo...], recargar }.
 * "Cruda" = la forma de leerFicha_ / leerBanco_, sin ids ni enlaces: la pantalla une
 * las piezas por nombre, porque sus ids no tienen por que coincidir con estos.
 */
function aplicarToques_(toques) {
  var cambios = { fichas: [], insumos: [], recargar: false };
  var fichas = {}, bancos = {}, precios = {};

  for (var t = 0; t < toques.length; t++) {
    var x = toques[t];
    if (!x || x.todo) {
      olvidarModeloCosteo_();
      cambios.recargar = true;
      return cambios;
    }
    if (x.proveedor) continue;
    var a = areaValida_(x.area);
    if (x.ficha) fichas[a + '|' + normalizar_(x.ficha)] = { area: a, ficha: x.ficha };
    var nombre = x.insumo || x.precio;
    if (nombre) {
      if (!bancos[a]) bancos[a] = {};
      bancos[a][normalizar_(nombre)] = true;
      if (x.precio) precios[a + '|' + normalizar_(nombre)] = true;
    }
  }
  if (!Object.keys(fichas).length && !Object.keys(bancos).length) return cambios;

  // Un producto NUEVO en el Banco tambien mueve a las fichas que ya lo nombraban: esa
  // linea estaba "fuera del banco", su VLOOKUP daba vacio, y ahora calcula. Si no se
  // releen, el modelo se queda con la linea en cero y el costo viejo de la ficha. Son
  // pocas (casi siempre ninguna), y se sacan del modelo cacheado sin leer ninguna hoja.
  if (Object.keys(bancos).length) {
    var previo = leerModeloCacheado_(CacheService.getScriptCache());
    if (previo) {
      var existentes = {};
      previo.insumos.forEach(function (y) { existentes[y.area + '|' + normalizar_(y.producto)] = true; });
      Object.keys(bancos).forEach(function (a) {
        Object.keys(bancos[a]).forEach(function (n) {
          if (existentes[a + '|' + n]) return;
          previo.recetas.forEach(function (r) {
            if (r.area !== a) return;   // el VLOOKUP de la ficha busca en el Banco de su propia area
            var nombra = r.ingredientes.some(function (g) { return g.insumo === null && normalizar_(g.nombre) === n; });
            if (nombra) fichas[a + '|' + normalizar_(r.nombre)] = { area: a, ficha: r.nombre };
          });
        });
      });
    }
  }

  // 1. RELEER SOLO LO TOCADO. Sin flush, las formulas de la linea recien escrita
  //    todavia no calcularon y su total llega vacio.
  SpreadsheetApp.flush();

  Object.keys(fichas).forEach(function (k) {
    var f = fichas[k];
    var leida = leerFicha_(fichaDe_(recetarioDe_(f.area), f.ficha), configArea_(f.area));
    if (leida) cambios.fichas.push(leida);
  });

  Object.keys(bancos).forEach(function (a) {
    // Mismo criterio que construirModelo_: toda pestana que empiece con "banco de
    // datos", en orden, y el primer registro de un nombre gana.
    var lista = [], indice = {}, cfg = configArea_(a);
    recetarioDe_(a).getSheets().forEach(function (hoja) {
      if (normalizar_(hoja.getName()).indexOf('banco de datos') === 0) leerBanco_(hoja, cfg, lista, indice);
    });
    Object.keys(bancos[a]).forEach(function (n) {
      var k = a + '|' + n;
      // No aparece: una fila sin precio numerico, que leerBanco_ salta. La pantalla no
      // sabria que hacer con eso; que pida el modelo entero.
      if (!indice.hasOwnProperty(k)) { cambios.recargar = true; return; }
      var i = lista[indice[k]];
      delete i.id;
      cambios.insumos.push(i);
    });
  });

  // 2. CORREGIR EL MODELO CACHEADO.
  var sinFactor = false;
  var escaladas = parchearCacheCosteo_(function (modelo) {
    var porReceta = {}, porInsumo = {};
    modelo.recetas.forEach(function (r, i) { porReceta[r.area + '|' + normalizar_(r.nombre)] = i; });
    modelo.insumos.forEach(function (y, i) {
      var k = y.area + '|' + normalizar_(y.producto);
      if (!porInsumo.hasOwnProperty(k)) porInsumo[k] = i;
    });

    cambios.fichas.forEach(function (f) {
      var k = f.area + '|' + normalizar_(f.nombre), copia = copiarJson_(f);
      if (porReceta.hasOwnProperty(k)) modelo.recetas[porReceta[k]] = copia;
      else { porReceta[k] = modelo.recetas.length; modelo.recetas.push(copia); }
    });

    // Las fichas van ANTES de escalar: una ficha recien releida ya trae el costo bueno
    // y todavia no tiene enlaces, asi que escalarRecetasPorInsumo_ no la toca.
    var tocadas = [];
    cambios.insumos.forEach(function (y) {
      var k = y.area + '|' + normalizar_(y.producto), copia = copiarJson_(y);
      if (!porInsumo.hasOwnProperty(k)) {
        porInsumo[k] = modelo.insumos.length;
        modelo.insumos.push(copia);
        return;
      }
      var pos = porInsumo[k], viejo = modelo.insumos[pos];
      if (precios[k] && viejo.precio !== y.precio) {
        if (typeof viejo.precio === 'number' && viejo.precio > 0 && typeof y.precio === 'number') {
          tocadas = tocadas.concat(escalarRecetasPorInsumo_(modelo, pos, y.precio / viejo.precio));
        } else {
          sinFactor = true;
        }
      }
      modelo.insumos[pos] = copia;
    });

    enlazarModelo_(modelo);
    return tocadas;
  });

  if (escaladas === null || sinFactor) {
    // Sin modelo cacheado, la ficha y el producto igual le sirven a la pantalla. Lo que
    // no puede saber es el efecto de un precio sobre las recetas que lo usan.
    if (Object.keys(precios).length) cambios.recargar = true;
    if (sinFactor) olvidarModeloCosteo_();
  } else {
    var ya = {};
    cambios.fichas.forEach(function (f) { ya[f.area + '|' + normalizar_(f.nombre)] = true; });
    escaladas.forEach(function (r) {
      var k = r.area + '|' + normalizar_(r.nombre);
      if (ya[k]) return;
      ya[k] = true;
      cambios.fichas.push(copiarJson_(r));
    });
  }
  return cambios;
}

/**
 * Corrige el modelo cacheado bajo candado. `aplicar(modelo)` lo modifica en el lugar;
 * lo que devuelva, se devuelve. null = no se corrigio: no habia cache, no se consiguio
 * el candado, o fallo (en esos dos ultimos casos el cache se borra).
 *
 * Candado porque leer-modificar-guardar no es atomico: dos guardados a la vez leerian
 * el mismo modelo y el segundo pisaria el parche del primero. Se espera poco a
 * proposito: si lo tiene otro proceso (el cargador de ventas lo retiene minutos), es
 * mejor borrar el cache que dejar a cocina esperando.
 */
function parchearCacheCosteo_(aplicar) {
  var cache = CacheService.getScriptCache();
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(2000)) { olvidarModeloCosteo_(); return null; }
  try {
    var modelo = leerModeloCacheado_(cache);
    if (!modelo) return null;
    var extra = aplicar(modelo);
    modelo.meta.parcheado = new Date().toISOString();
    return guardarModeloCacheado_(cache, modelo) ? (extra || []) : null;
  } catch (e) {
    cache.remove(COSTEO.cacheKey);
    return null;
  } finally {
    marcarGeneracionCosteo_(cache);
    candado.releaseLock();
  }
}

/**
 * Un precio cambio: las recetas que usan ese insumo cambian en proporcion.
 *
 * En la hoja, el total de una linea es CANTIDAD x VLOOKUP(precio del Banco), y el
 * subtotal, el costo, el costo por porcion, el CMV y el precio sugerido son todos
 * lineales en la suma de las lineas. Por eso alcanza con escalar, sin releer cada
 * pestana. La reconstruccion de cada hora corrige cualquier redondeo.
 */
function escalarRecetasPorInsumo_(modelo, pos, factor) {
  var tocadas = [];
  modelo.recetas.forEach(function (r) {
    var antes = 0, despues = 0, toca = false;
    r.ingredientes.forEach(function (g) {
      if (typeof g.total !== 'number') return;
      antes += g.total;
      if (g.insumo === pos) { g.total = g.total * factor; toca = true; }
      despues += g.total;
    });
    if (!toca) return;
    if (antes > 0) {
      var k = despues / antes;
      ['subtotal', 'costo', 'costoUnit', 'cmv', 'sugerido'].forEach(function (c) {
        if (typeof r[c] === 'number') r[c] = r[c] * k;
      });
    }
    r.estado = estadoReceta_(r);
    tocadas.push(r);
  });
  return tocadas;
}

function copiarJson_(o) { return JSON.parse(JSON.stringify(o)); }

/**
 * Diagnostico. Correr desde el editor y leer el Log ANTES de confiar en el modulo.
 * Los numeros de referencia al 24 ago 2026 (recetario COCINA v14 + barra v5):
 *   COCINA  -> 35 fichas de plato, 40 pre-elaborados, 26 con CMV, 9 vacias
 *   BARRA   -> sin cambios respecto de la v11
 *   control -> Ensalada Rosanta 15.9 | Tabla de Jamones 22.6 | Gratin de Papas 19.8
 *              Mix de Fritas 23.6 | Peras Horneadas 19.7
 *   fichas sin ingredientes y sin precio -> 0
 *
 * "con CMV" cuenta solo lo realmente costeado. Las 9 fichas vacias de la carta 2027
 * arrastran las filas de formula, asi que 7 de ellas devuelven CMV = 0 (Charlotta y
 * Panacotta ni eso, se crearon en blanco). Un 0% nunca es un costeo real: por eso el
 * contador exige cmv > 0 y las vacias se informan aparte.
 *
 * Las 9 fichas de plato que SI deben salir vacias, y no son error:
 *   Coliflor con Romesco, Brocoli con Nduja, Bok Choy, Vegetales Fermentados,
 *   Arroz Meloso, Lomito de la Casa, Estofado de Rabo, Charlotta, Panacotta Maracuya
 *
 * Mix de Fritas paso de 67.9% (v9) a 23.6% al corregir la malanga (Q45 por unidad,
 * no por libra) y el camote (Q9.50 la libra). No es un bug.
 */
function probarCosteo() {
  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  var m = construirModelo_();

  ['COCINA', 'BARRA'].forEach(function (a) {
    var rs = m.recetas.filter(function (r) { return r.area === a; });
    var pl = rs.filter(function (r) { return r.tipo === 'plato'; });
    var vacias = pl.filter(function (r) { return !r.ingredientes.length; });
    Logger.log('%s -> %s fichas de plato | %s pre-elaborados | %s con CMV | %s vacias | insumos %s',
      a, pl.length, rs.length - pl.length,
      pl.filter(function (r) { return r.cmv != null && r.cmv > 0; }).length,
      vacias.length,
      m.insumos.filter(function (i) { return i.area === a; }).length);
    vacias.forEach(function (r) { Logger.log('  VACIA: %s', r.nombre); });
  });

  // Valores de la v16 (24 ago 2026). Los de la v9 y la v14 ya no aplican.
  // La ensalada bajo de 15.9 a 15.0 al recalcularse la gremolata (Q0.20498 -> Q0.18719 por g).
  var control = {
    'ensalada rosanta'         : 15.0,
    'tabla de jamones y quesos': 22.6,
    'gratin de papas'          : 19.8,
    'mix de fritas'            : 23.6,
    'peras horneadas'          : 19.7
  };
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
