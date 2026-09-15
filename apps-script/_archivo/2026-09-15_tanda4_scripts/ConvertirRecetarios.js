/**
 * ConvertirRecetarios.gs - Ejecutar convertirRecetarios() UNA VEZ desde el editor.
 * Convierte los dos xlsx del recetario (ya en Drive) a hojas nativas de Google
 * y guarda los IDs en Script Properties. A partir de ahi, el equipo edita las
 * fichas en las hojas nativas y la intranet lee en vivo.
 * Requiere el servicio avanzado de Drive (ya habilitado en appsscript.json).
 */

/**
 * OJO: estas dos IDs son las del arranque (18 ago 2026) y YA NO SE USAN.
 * convertirRecetarios() solo escribe si la propiedad esta vacia, y las dos ya estan
 * puestas, asi que en la practica no corre. Se dejan como registro del origen.
 * Para cambiar de version del recetario de cocina usar migrarRecetarioCocina().
 */
const RECETARIO_XLSX = {
  BARRA: '1r_5FCMuH_wnMLpCx5y0Eq8GMd0Jzoab_',   // Rosanta_Recetario_Barra_v5_corregido.xlsx
  COCINA: '1shVWGSwzUcrodqqq7jgqXloPvteyAIC8'   // Rosanta_Recetario_Completo_Cocina (1).xlsx
};

function convertirRecetarios() {
  soloDueno_();
  const props = PropertiesService.getScriptProperties();

  if (!props.getProperty('RECETARIO_BARRA_SHEET_ID')) {
    const barra = Drive.Files.copy(
      { name: 'Rosanta_Recetario_Barra', mimeType: 'application/vnd.google-apps.spreadsheet' },
      RECETARIO_XLSX.BARRA
    );
    props.setProperty('RECETARIO_BARRA_SHEET_ID', barra.id);
    Logger.log('Barra convertido: https://docs.google.com/spreadsheets/d/' + barra.id);
  }

  if (!props.getProperty('RECETARIO_COCINA_SHEET_ID')) {
    const cocina = Drive.Files.copy(
      { name: 'Rosanta_Recetario_Cocina', mimeType: 'application/vnd.google-apps.spreadsheet' },
      RECETARIO_XLSX.COCINA
    );
    props.setProperty('RECETARIO_COCINA_SHEET_ID', cocina.id);
    Logger.log('Cocina convertido: https://docs.google.com/spreadsheets/d/' + cocina.id);
  }

  Logger.log('Conversion completa. El equipo debe editar SOLO las hojas nativas nuevas; los xlsx quedan como respaldo historico.');
}

/**
 * Comprueba que los VLOOKUP contra BANCO DE DATOS sobrevivieron la conversion a nativa.
 *
 * Mira la columna E (PRECIO UNIT.) de las fichas que se le pasen: tiene que seguir
 * siendo una formula que apunta a BANCO DE DATOS y tiene que devolver un numero.
 * Una conversion rota deja #REF!, #NAME? o el texto de la formula.
 *
 * Devuelve { ok:bool, detalle:[] }.
 */
function verificarVlookups_(ss, nombresFicha) {
  var det = [], ok = true;

  nombresFicha.forEach(function (nombre) {
    var h = ss.getSheetByName(nombre);
    if (!h) { det.push(nombre + ' -> NO EXISTE la pestana'); ok = false; return; }

    var formulas = h.getRange(1, 5, Math.min(h.getLastRow(), 40), 1).getFormulas();
    var valores  = h.getRange(1, 5, Math.min(h.getLastRow(), 40), 1).getValues();

    var conFormula = 0, conNumero = 0, errores = [];
    for (var i = 0; i < formulas.length; i++) {
      var f = formulas[i][0], v = valores[i][0];
      if (f && f.toUpperCase().indexOf('BANCO DE DATOS') !== -1) {
        conFormula++;
        if (typeof v === 'number' && !isNaN(v)) conNumero++;
        else if (typeof v === 'string' && v.charAt(0) === '#') errores.push(v);
      }
    }

    if (!conFormula) {
      det.push(nombre + ' -> SIN FORMULAS contra BANCO DE DATOS');
      ok = false;
    } else if (errores.length) {
      det.push(nombre + ' -> ' + conFormula + ' formulas, ' + errores.length +
               ' en error (' + errores.slice(0, 3).join(', ') + ')');
      ok = false;
    } else if (!conNumero) {
      det.push(nombre + ' -> ' + conFormula + ' formulas pero ninguna devuelve numero');
      ok = false;
    } else {
      det.push(nombre + ' -> OK  ' + conFormula + ' formulas, ' + conNumero + ' con numero');
    }
  });

  return { ok: ok, detalle: det };
}

/**
 * Migra el recetario de COCINA a una version nueva.
 * Convierte el .xlsx (que ya tiene que estar subido a Drive) a hoja NATIVA,
 * VERIFICA que los VLOOKUP sigan vivos y solo entonces repunta
 * RECETARIO_COCINA_SHEET_ID.
 *
 * Si la verificacion falla, la propiedad NO se toca: el modulo se queda leyendo
 * la version anterior y la hoja nueva queda en Drive para revisarla a mano.
 *
 * Deja el ID anterior en RECETARIO_COCINA_SHEET_ID_ANTERIOR para poder volver.
 *
 *   migrarRecetarioCocina('<id del xlsx en Drive>', 'Rosanta_Recetario_Cocina_2027_v14')
 */
function migrarRecetarioCocina(fileIdXlsx, nombre, fichasDePrueba) {
  soloDueno_();
  if (!fileIdXlsx) throw new Error('Falta el ID del .xlsx en Drive.');
  const props = PropertiesService.getScriptProperties();
  const anterior = props.getProperty('RECETARIO_COCINA_SHEET_ID');

  const nueva = Drive.Files.copy(
    { name: nombre || 'Rosanta_Recetario_Cocina', mimeType: 'application/vnd.google-apps.spreadsheet' },
    fileIdXlsx
  );
  Logger.log('Convertida a nativa: %s', nueva.id);
  Logger.log('https://docs.google.com/spreadsheets/d/' + nueva.id);

  const ss = SpreadsheetApp.openById(nueva.id);
  const chk = verificarVlookups_(ss, fichasDePrueba ||
    ['ENSALADA ROSANTA', 'MIX DE FRITAS', 'TABLA DE JAMONES Y QUESOS']);
  chk.detalle.forEach(function (l) { Logger.log('  VLOOKUP ' + l); });

  if (!chk.ok) {
    Logger.log('LOS VLOOKUP NO SOBREVIVIERON. No se toco RECETARIO_COCINA_SHEET_ID:');
    Logger.log('sigue en %s. Revisar la hoja nueva a mano antes de repuntar.', anterior);
    throw new Error('Conversion rota: los VLOOKUP no calculan. Property sin cambios.');
  }

  if (anterior) props.setProperty('RECETARIO_COCINA_SHEET_ID_ANTERIOR', anterior);
  props.setProperty('RECETARIO_COCINA_SHEET_ID', nueva.id);

  const cache = CacheService.getScriptCache();
  cache.remove(COSTEO.cacheKey);
  cache.remove(POS_CFG.cacheKey);

  Logger.log('ANTERIOR: %s', anterior || '(no habia)');
  Logger.log('NUEVA:    %s  <- RECETARIO_COCINA_SHEET_ID', nueva.id);
  return nueva.id;
}
