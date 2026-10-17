/**
 * ConfigCosteo.gs — Configuracion del modulo Recetario + Proveedores.
 * Revision 24 ago 2026: metas por area, exclusiones actualizadas a la v14, alias de sub-recetas.
 *
 * Todas las IDs viven en Script Properties (Proyecto > Configuracion del proyecto >
 * Propiedades de la secuencia de comandos). Nunca escribirlas aqui.
 *
 *   RECETARIO_COCINA_SHEET_ID   -> Rosanta_Recetario_Cocina_2027_v16 (hoja NATIVA de Google)
 *   RECETARIO_BARRA_SHEET_ID    -> Rosanta_Recetario_Barra_v5        (hoja NATIVA de Google)
 *   COSTEO_SHEET_ID             -> la crea crearHojaCosteo(), no ponerla a mano
 *   RECETARIO_FOTOS_FOLDER_ID   -> carpeta de Drive con fotos de plato (opcional)
 */

var COSTEO = {
  areas: [
    // cmvObjetivo es solo el valor POR DEFECTO, si PARAMETROS no se puede leer.
    // La meta que manda sale de metasFoodCost_(), mas abajo.
    { clave: 'RECETARIO_COCINA_SHEET_ID', area: 'COCINA', cmvObjetivo: 28, merma: 10 },
    { clave: 'RECETARIO_BARRA_SHEET_ID',  area: 'BARRA',  cmvObjetivo: 20, merma: 3  }
  ],

  /**
   * Pestanas que NO son fichas de receta. Se comparan normalizadas y por PREFIJO.
   * Actualizado a los nombres de la v14. Si se renombra una hoja de control, agregarla aqui
   * o va a aparecer como una receta basura en la grilla.
   */
  tabsNoReceta: [
    // comunes
    'banco de datos', 'indice', 'indice antiguo',
    // cocina
    'resumen cmv', 'pendientes', 'respuestas de cocina', 'carta 2027', 'fuera de carta',
    'revision vs carta', 'pre-elaborados q x g', 'conversion en fichas', 'limpieza del banco',
    // hojas nuevas. Sin esto el lector las lee como fichas de receta y aparecen
    // como basura en la grilla.
    'cambios v',                   // cubre CAMBIOS v11, v16 y las que vengan.
                                   // La lista se compara POR PREFIJO: 'cambios v11'
                                   // dejaba pasar CAMBIOS v16 como si fuera receta.
    'mapa pos',                    // v14: puente de nomenclatura con el POS (lo lee ConfigPOS.gs)
    // el log de SincronizarPrecios.gs y el tablero de SemaforoPrecios.gs viven en el
    // libro de costeo, no en el recetario, pero se excluyen igual por si alguien
    // copia la hoja al recetario.
    'sync_precios',
    'semaforo_precios',
    'bitacora',                    // cubre BITACORA y BITACORA_RESUMEN: es por prefijo
    // el feed de ventas del POS (VentasPorProducto.gs). Sin esto el lector las toma
    // como fichas de receta. OJO: 'ventas 2026' de mas abajo NO las cubre — la
    // comparacion es por prefijo y "ventas x plato" no empieza con "ventas 2026".
    'ventas x plato',
    'sync_ventas',
    // nombres viejos que pueden seguir vivos en copias
    'resumen de cmv', 'que falta', 'platos fuera de la carta',
    'la ficha contra lo que dice la carta', 'lineas de ficha corregidas',
    'limpieza de nombres y unidades',
    // barra
    'ventas 2026', 'escenario precios 2026'
  ],

  /** Prefijo de las fichas archivadas. Nunca se muestran como recetas activas. */
  prefijoArchivo: 'zz archivo',

  /**
   * Alias para enlazar el nombre que usa el Banco de Datos con el nombre de la pestana
   * de la sub-receta, cuando no coinciden. Clave = nombre en el Banco, valor = pestana.
   * Sin esto el ingrediente no ofrece el salto a su ficha.
   */
  aliasSubReceta: {
    'pure de arveja'            : 'Pure de Alverja',
    'pure de camote'            : 'Pure de Camote y Zanahoria',
    'pure de platano'           : 'Pure de Platanos',
    'pure de yuca'              : 'Pure de Yuca',
    'ketchup'                   : 'Ketchup con Toque de Menta',
    'mayoneza de hierba luisa'  : 'Mayonesa de Hierbaluisa',
    'cebollitas azadas'         : 'Cebollitas Asadas',
    'fresas maceradas'          : 'Fresas Maceradas',
    'tomates rostizados'        : 'Tomates Rostizados',
    'compota de tomate'         : 'Compota de Tomate',
    'mermelada de cebolla'      : 'Mermelada de Cebolla',
    'crema de zanahorias'       : 'Crema de Zanahoria',
    'chips de malanga'          : 'Chips de Malanga',
    'chips de camote'           : 'Camotes Fritos',
    'pan de la casa'            : 'Pan de la Casa1',
    'gratin de papa'            : 'Gratin de Papa',
    'melocotones macerados'     : 'Melocoton Macerado',
    'pepinillos encurtidos'     : 'Pepinillos Encurtidos',
    'salsa tamarindo'           : 'Salsa de Tamarindo',
    'salsa pasta'               : 'Salsa Pasta del Dia',
    'salsa bordolesa'           : 'Salsa Bordolesa',
    'fetuccini de la casa'      : 'Fetuccini de la Casa',
    'salsa de chile cobanero'   : 'Salsa de Chile Cobanero'
  },

  bancoCols: ['CATEGORIA', 'PRODUCTO', 'PRECIO_UNIDAD_RECETA', 'UNIDAD_RECETA',
              'PRECIO_COMPRA', 'UNIDAD_COMPRA', 'CONVERSION', 'PROVEEDOR'],

  hojas: {
    proveedores: 'PROVEEDORES',
    precios:     'PRECIOS',
    indice:      'INDICE_INSUMO_RECETA'
  },

  /**
   * Metas de CMV para ingenieria de menu. Aca y no sueltas en el codigo, para que se
   * cambien en un solo lugar y a proposito.
   *
   * Desde el 14-sep-2026 la META no vive aca: sale de PARAMETROS (metasFoodCost_).
   * Barra dejo de tener una meta por categoria (20 a 35%): es 20% plana, decision
   * de Juanma. Lo que queda aca es QUE categorias del POS entran al analisis de
   * barra. OJO: 'Licor Botella' NO esta y es a proposito — no entra al analisis.
   */
  /**
   * EL IVA. El POS factura con IVA incluido, asi que el precio de carta lo trae;
   * el costo, no: buena parte de la compra viene de economia informal o de pequenos
   * contribuyentes que no llevan IVA, y en esos casos lo que se paga YA es neto.
   *
   * Comparar un costo neto contra un precio con IVA da un CMV corto un 12%, y
   * mientras mas informal la compra, mas optimista el numero. Por eso se corrige el
   * DENOMINADOR y no el costo: es el extremo conservador, es como la industria mide
   * la meta del 30%, y es una sola division que no le pide a nadie decidir que
   * proveedor factura y cual no.
   *
   * Decision de Juanma, 30-ago-2026. Mueve todos los porcentajes del pilar: cocina
   * pasa de 26.5% a 29.7% y deja de estar comoda bajo la meta. El negocio no
   * empeoro; el numero anterior se veia mejor de lo que era.
   */
  iva: 1.12,

  categoriasBarra: [
    'Coctel Autor', 'Coctel Casa', 'Coctel Jardín',
    'Refresco & Agua', 'Café & Té',
    'Licor Copa', 'Digestivo',
    'Vino Copa', 'Cerveza',
    'Vino Botella', 'Espumante'
  ],

  cacheKey: 'costeo_indice_v2',
  // 1 hora, no 15 minutos. El modelo tarda ~40 s en construirse: leer las dos hojas
  // enteras es lo mas caro del modulo. Con 15 minutos el cache vencia entre una
  // visita y la siguiente, asi que en la practica CASI NADIE lo aprovechaba: Jeffry
  // abre el recetario un par de veces al dia y pagaba los 40 s todas las veces.
  //
  // Alargarlo es seguro porque TODO camino que escribe ya lo invalida a mano:
  // sincronizarPrecios, aplicarSincronizacion, registrarPrecio, invalidarCache_ de
  // EdicionRecetario, InventarioImport, cargarVentasPorProducto y refrescarCosteo.
  // Lo unico que este plazo cubre es la edicion hecha DIRECTAMENTE en la hoja, sin
  // pasar por la intranet: eso ahora tarda hasta una hora en verse, y el boton
  // "actualizar" de la vista lo fuerza en el acto.
  //
  // Y para que el plazo casi nunca se sienta, calentarCaches() lo reconstruye desde
  // un activador antes de que a alguien le toque pagarlo. Ver CalentarCaches.gs.
  cacheSegs: 3600
};

/**
 * LAS METAS DE FOOD COST, DE UN SOLO LUGAR — 14-sep-2026
 *
 * Decision de Juanma: 28% global y de cocina, 20% plano en barra, siempre sobre la
 * venta NETA (sin IVA). Viven en la pestana PARAMETROS del Sheet de config:
 *   food_cost_objetivo_pct   la global y la de cocina
 *   food_cost_barra_pct      la de barra (20 si la fila no existe)
 *
 * Hasta esta fecha el numero vivia en siete lugares que no se leian entre si: el
 * semaforo de Finanzas leia PARAMETROS, pero el techo de compra (FIN_META_AREA), la
 * ficha (COSTEO.areas), la ingenieria de menu (metaCocina, metasBarra), las formulas
 * de las fichas nuevas y dos textos de pantalla tenian su propio 30 escrito a mano.
 * Cambiar la meta era cambiar siete cosas, y la ficha y el tablero ya no coincidian.
 *
 * Se lee una sola vez por ejecucion: leerFicha_ la pide por cada ficha, y
 * _finParametro es una llamada al servicio de cache.
 */
var METAS_FC_MEMO_ = null;
function metasFoodCost_() {
  if (METAS_FC_MEMO_) return METAS_FC_MEMO_;
  var porDefecto = {};
  COSTEO.areas.forEach(function (a) { porDefecto[a.area] = a.cmvObjetivo; });
  var global = _finParametro_('food_cost_objetivo_pct', porDefecto.COCINA);
  METAS_FC_MEMO_ = {
    global: global,
    COCINA: global,
    BARRA: _finParametro_('food_cost_barra_pct', porDefecto.BARRA)
  };
  return METAS_FC_MEMO_;
}

/** La meta de un area, en porcentaje (28, no 0.28). */
function metaDeArea_(area) {
  var m = metasFoodCost_();
  var a = String(area || '').trim().toUpperCase();
  return m.hasOwnProperty(a) ? m[a] : m.global;
}

/** Normaliza para comparar nombres: sin acentos, sin dobles espacios, minuscula. */
function normalizar_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** true si la pestana no es una ficha de receta. */
function esHojaDeControl_(nombreHoja) {
  var t = normalizar_(nombreHoja);
  if (t.indexOf(COSTEO.prefijoArchivo) === 0) return true;
  for (var i = 0; i < COSTEO.tabsNoReceta.length; i++) {
    if (t.indexOf(COSTEO.tabsNoReceta[i]) === 0) return true;
  }
  return false;
}

/** Primer numero de una fila a partir de una columna. */
function primerNumero_(fila, desde) {
  for (var k = desde; k < fila.length; k++) {
    if (typeof fila[k] === 'number' && !isNaN(fila[k])) return fila[k];
  }
  return null;
}

/** Primer texto no vacio de una fila a partir de una columna. */
function primerTexto_(fila, desde) {
  for (var k = desde; k < fila.length; k++) {
    var v = fila[k];
    if (v !== '' && v != null && typeof v !== 'number') return String(v).trim();
  }
  return '';
}

function abrirPorClave_(clave) {
  var id = PropertiesService.getScriptProperties().getProperty(clave);
  return id ? SpreadsheetApp.openById(id) : null;
}

function hojaCosteo_() {
  var ss = abrirPorClave_('COSTEO_SHEET_ID');
  if (!ss) throw new Error('Falta la propiedad COSTEO_SHEET_ID. Corre crearHojaCosteo() una vez.');
  return ss;
}
