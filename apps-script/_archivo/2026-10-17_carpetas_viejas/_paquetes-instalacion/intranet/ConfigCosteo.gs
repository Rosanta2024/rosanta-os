/**
 * ConfigCosteo.gs — Configuracion del modulo Recetario + Proveedores.
 *
 * Todas las IDs viven en Script Properties (Proyecto > Configuracion del proyecto >
 * Propiedades de la secuencia de comandos). Nunca escribirlas aqui.
 *
 *   RECETARIO_COCINA_SHEET_ID   -> hoja NATIVA del recetario de cocina
 *   RECETARIO_BARRA_SHEET_ID    -> hoja NATIVA del recetario de barra (NO el .xlsx)
 *   COSTEO_SHEET_ID             -> hoja nueva Rosanta_Costeo_Proveedores (la crea crearHojaCosteo)
 *   RECETARIO_FOTOS_FOLDER_ID   -> carpeta de Drive con las fotos de plato (opcional)
 *
 * OJO (10-sep-2026): este es un PAQUETE DE INSTALACION, o sea una foto de un momento.
 * El codigo vigente es el de rosanta-intranet/, no este. Aqui se nombraba el recetario
 * de cocina "v2" cuando el vivo ya iba en la v16, y el ID de barra que documentaba el
 * INSTALAR.md ya no existe. Por eso ni aqui ni alli se vuelven a escribir versiones ni
 * IDs: los valores buenos se copian de Propiedades del script del proyecto que corre.
 */

var COSTEO = {
  areas: [
    { clave: 'RECETARIO_COCINA_SHEET_ID', area: 'COCINA', cmvObjetivo: 30, merma: 10 },
    { clave: 'RECETARIO_BARRA_SHEET_ID',  area: 'BARRA',  cmvObjetivo: 20, merma: 3  }
  ],

  // Pestanas que NO son fichas de receta. Se comparan en MAYUSCULAS y sin acentos.
  tabsNoReceta: [
    'BANCO DE DATOS', 'INDICE', 'INDICE ANTIGUO', 'VENTAS 2026', 'ESCENARIO PRECIOS 2026',
    'RESUMEN DE CMV', 'RESUMEN CMV', 'QUE FALTA', 'CARTA 2027', 'PLATOS FUERA DE LA CARTA',
    'LA FICHA CONTRA LO QUE DICE LA CARTA', 'PRE-ELABORADOS Q X G', 'LINEAS DE FICHA CORREGIDAS',
    'CONVERSION EN FICHAS', 'LIMPIEZA DE NOMBRES Y UNIDADES'
  ],

  // Encabezados de la hoja BANCO DE DATOS, en orden.
  bancoCols: ['CATEGORIA', 'PRODUCTO', 'PRECIO_UNIDAD_RECETA', 'UNIDAD_RECETA',
              'PRECIO_COMPRA', 'UNIDAD_COMPRA', 'CONVERSION', 'PROVEEDOR'],

  hojas: {
    proveedores: 'PROVEEDORES',
    precios:     'PRECIOS',
    indice:      'INDICE_INSUMO_RECETA'
  },

  cacheKey: 'costeo_indice_v1',
  cacheSegs: 900
};

/** Normaliza para comparar nombres: sin acentos, sin dobles espacios, minuscula. */
function normalizar_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Primer numero de una fila a partir de una columna. */
function primerNumero_(fila, desde) {
  for (var k = desde; k < fila.length; k++) {
    if (typeof fila[k] === 'number' && !isNaN(fila[k])) return fila[k];
  }
  return null;
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
