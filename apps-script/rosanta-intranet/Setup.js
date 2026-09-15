/**
 * Setup.gs - Ejecutar setupInicial() UNA VEZ desde el editor de Apps Script.
 * Crea los Sheets de configuracion y recetario, y guarda sus IDs
 * en Script Properties (Config.gs los lee de ahi).
 */

/**
 * Habilita los módulos nuevos SOLO para restaurante@rosanta.rest, para probarlos
 * sin que el equipo vea cambios. Ejecutar una vez desde el editor y mirar el Log.
 *
 * Es idempotente (no duplica módulos) y toca UNA sola fila: si el correo no está
 * en USUARIOS, aborta sin escribir nada. El resto del equipo queda igual, así que
 * sus tarjetas siguen siendo finanzas/recetario y nada más.
 *
 * Para habilitarlos a otros después: agregar los módulos a mano en la hoja, o
 * cambiar DUENO_ y volver a ejecutar.
 */
var DUENO_ = 'restaurante@rosanta.rest';
var MODULOS_NUEVOS_ = ['marketing', 'crm', 'consola', 'resenas'];

function habilitarModulosDueno() {
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  var filas = hoja.getDataRange().getValues();

  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]).toLowerCase().trim() !== DUENO_) continue;

    var actuales = String(filas[i][2]).split(',')
      .map(function (m) { return m.trim(); })
      .filter(function (m) { return m; });

    var antes = actuales.join(',');
    MODULOS_NUEVOS_.forEach(function (m) {
      if (actuales.indexOf(m) === -1) actuales.push(m);
    });
    var despues = actuales.join(',');

    if (antes === despues) {
      Logger.log('Sin cambios: ' + DUENO_ + ' ya tenía [' + despues + ']');
      return;
    }
    hoja.getRange(i + 1, 3).setValue(despues); // columna "modulos", sólo esta fila
    Logger.log('OK. ' + DUENO_ + ': [' + antes + '] -> [' + despues + ']');
    Logger.log('Filas en USUARIOS sin tocar: ' + (filas.length - 2));
    return;
  }
  Logger.log('ABORTADO: ' + DUENO_ + ' no está en USUARIOS. No se escribió nada.');
}

function setupInicial() {
  const props = PropertiesService.getScriptProperties();

  // 1. Sheet de configuracion
  if (!props.getProperty('CONFIG_SHEET_ID')) {
    const cfg = SpreadsheetApp.create('Rosanta_Intranet_Config');
    const usuarios = cfg.getActiveSheet().setName('USUARIOS');
    usuarios.getRange(1, 1, 1, 5).setValues([[
      'correo', 'rol', 'modulos', 'puede_editar', 'nombre'
    ]]).setFontWeight('bold');
    usuarios.getRange(2, 1, 1, 5).setValues([[
      'restaurante@rosanta.rest', 'dueno', 'finanzas,recetario', 'SI', 'Juanma'
    ]]);
    const params = cfg.insertSheet('PARAMETROS');
    params.getRange(1, 1, 3, 2).setValues([
      ['parametro', 'valor'],
      ['margen_minimo_pct', 60],
      // 28: decision de Juanma el 14-sep-2026 (antes 30, y antes de eso 32).
      // Es LA meta: la leen Finanzas, el recetario, la ingenieria de menu y el
      // techo de compra, todos por metasFoodCost_ en ConfigCosteo.gs. Barra va en
      // food_cost_barra_pct y vale 20 si la fila no existe.
      ['food_cost_objetivo_pct', 28]
    ]);
    props.setProperty('CONFIG_SHEET_ID', cfg.getId());
    Logger.log('Config creado: ' + cfg.getUrl());
  }

  // Nota: el recetario NO se crea aqui. Ya existe en tres Sheets vivas
  // (Rosanta_Insumos, Rosanta_Platillos, Rosanta_Recetas); sus IDs estan en Config.gs.
  // Si una ejecucion anterior creo "Rosanta_Recetario", puede borrarse de Drive.
  props.deleteProperty('RECETARIO_SHEET_ID');

  Logger.log('Setup completo. IDs guardados en Script Properties.');
}
