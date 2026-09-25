/**
 * Recetario.gs - Lee las hojas Rosanta_Recetario_Barra y _Cocina (fichas)
 * y arma el resumen por receta. Cachea 10 min para que la pagina cargue rapido.
 */

const RECETARIO_AREAS = [
  { clave: 'RECETARIO_BARRA_SHEET_ID', area: 'BARRA', cmvObjetivo: 20 },
  { clave: 'RECETARIO_COCINA_SHEET_ID', area: 'COCINA', cmvObjetivo: 30 }
];

const TABS_NO_RECETA = ['BANCO DE DATOS', 'INDICE', 'VENTAS 2026', 'ESCENARIO PRECIOS 2026'];

/** Llamada desde el cliente (google.script.run). */
function getRecetarioResumen() {
  const usuario = getUsuarioActual();
  if (!usuarioTieneModulo(usuario, 'recetario')) {
    throw new Error('Sin acceso al recetario');
  }
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('recetario_resumen_v1');
  if (enCache) return JSON.parse(enCache);

  const recetas = [];
  RECETARIO_AREAS.forEach(function (cfgArea) {
    const id = PropertiesService.getScriptProperties().getProperty(cfgArea.clave);
    if (!id) return;
    const ss = SpreadsheetApp.openById(id);
    ss.getSheets().forEach(function (hoja) {
      const nombre = hoja.getName().trim();
      if (TABS_NO_RECETA.indexOf(nombre.toUpperCase()) !== -1) return;
      const ficha = leerFicha_(hoja, cfgArea);
      if (ficha) recetas.push(ficha);
    });
  });

  const resultado = { generado: new Date().toISOString(), recetas: recetas };
  try {
    cache.put('recetario_resumen_v1', JSON.stringify(resultado), 600);
  } catch (e) { /* si excede el limite de cache, seguimos sin cachear */ }
  return resultado;
}

/** Fuerza recalculo (boton "actualizar" de la vista). */
function refrescarRecetario() {
  CacheService.getScriptCache().remove('recetario_resumen_v1');
  return getRecetarioResumen();
}

/**
 * Interpreta una pestana de ficha. Las etiquetas pueden estar en col A o B
 * segun el archivo de origen, asi que se busca por texto en toda la fila.
 */
function leerFicha_(hoja, cfgArea) {
  const datos = hoja.getDataRange().getValues();
  if (!datos.length) return null;

  const r = {
    area: cfgArea.area,
    nombre: hoja.getName().trim(),
    categoria: '',
    precioMenu: null,
    costoTotal: null,
    precioSugerido: null,
    cmvPct: null,
    margen: null,
    ingredientes: 0,
    estado: 'pendiente',
    alerta: ''
  };

  let enIngredientes = false;
  for (let i = 0; i < datos.length; i++) {
    const fila = datos[i];
    let filaEsResumen = false;
    for (let j = 0; j < fila.length; j++) {
      const celda = String(fila[j] || '').trim().toUpperCase();
      if (!celda) continue;

      if (celda === 'PRECIO MENÚ:' || celda === 'PRECIO MENU:') {
        r.precioMenu = primerNumero_(fila, j + 1);
        // la categoria es el primer texto de esa fila distinto de la etiqueta
        for (let k = 0; k < fila.length; k++) {
          const t = String(fila[k] || '').trim();
          if (t && t.toUpperCase().indexOf('PRECIO') === -1) { r.categoria = t; break; }
        }
        filaEsResumen = true;
      } else if (celda === 'INGREDIENTE') {
        enIngredientes = true;
      } else if (celda.indexOf('SUBTOTAL MATERIA PRIMA') === 0) {
        enIngredientes = false;
        filaEsResumen = true;
      } else if (celda === 'COSTO TOTAL') {
        r.costoTotal = primerNumero_(fila, j + 1);
        filaEsResumen = true;
      } else if (celda.indexOf('PRECIO SUGERIDO') === 0) {
        r.precioSugerido = primerNumero_(fila, j + 1);
        filaEsResumen = true;
      } else if (celda.indexOf('CMV % ACTUAL') === 0) {
        const v = primerNumero_(fila, j + 1);
        if (v !== null) r.cmvPct = v <= 1.5 ? v * 100 : v; // viene como fraccion o como %
        filaEsResumen = true;
      } else if (celda.indexOf('VARIACIÓN') === 0 || celda.indexOf('VARIACION') === 0) {
        filaEsResumen = true;
      }
    }
    if (enIngredientes && !filaEsResumen) {
      // cuenta filas de ingredientes (tienen nombre y cantidad numerica)
      const tieneNombre = fila.some(function (v) { return typeof v === 'string' && v.trim(); });
      const tieneNumero = fila.some(function (v) { return typeof v === 'number'; });
      const esHeader = fila.some(function (v) { return String(v || '').trim().toUpperCase() === 'INGREDIENTE'; });
      if (tieneNombre && tieneNumero && !esHeader) r.ingredientes++;
    }
  }

  if (r.costoTotal !== null && r.precioMenu !== null) {
    r.margen = r.precioMenu - r.costoTotal;
    if (r.cmvPct === null && r.precioMenu > 0) r.cmvPct = (r.costoTotal / r.precioMenu) * 100;
  }

  // Estado y alertas
  const objetivo = cfgArea.cmvObjetivo;
  if (r.costoTotal === null || r.ingredientes === 0) {
    r.estado = 'pendiente';
    r.alerta = 'Ficha sin costo o sin ingredientes';
  } else if (r.cmvPct !== null && r.cmvPct > 100) {
    r.estado = 'revisar';
    r.alerta = 'CMV imposible: revisar unidades de la ficha';
  } else if (r.cmvPct !== null && r.cmvPct > objetivo + 5) {
    r.estado = 'alto';
    r.alerta = 'CMV arriba del objetivo (' + objetivo + '%)';
  } else {
    r.estado = 'ok';
  }
  return r;
}

/** Diagnostico: ejecutar desde el editor y revisar el log. */
function probarRecetario() {
  CacheService.getScriptCache().remove('recetario_resumen_v1');
  const props = PropertiesService.getScriptProperties();
  Logger.log('BARRA ID: ' + props.getProperty('RECETARIO_BARRA_SHEET_ID'));
  Logger.log('COCINA ID: ' + props.getProperty('RECETARIO_COCINA_SHEET_ID'));
  const r = getRecetarioResumen();
  Logger.log('Total recetas: ' + r.recetas.length);
  if (r.recetas.length) {
    Logger.log('Primera: ' + JSON.stringify(r.recetas[0]));
    Logger.log('Ultima: ' + JSON.stringify(r.recetas[r.recetas.length - 1]));
  }
}

function primerNumero_(fila, desde) {
  for (let k = desde; k < fila.length; k++) {
    if (typeof fila[k] === 'number') return fila[k];
  }
  return null;
}
