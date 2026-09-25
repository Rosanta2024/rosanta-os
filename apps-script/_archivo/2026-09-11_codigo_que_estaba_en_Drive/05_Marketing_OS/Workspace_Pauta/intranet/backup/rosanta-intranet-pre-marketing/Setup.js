/**
 * Setup.gs - Ejecutar setupInicial() UNA VEZ desde el editor de Apps Script.
 * Crea los Sheets de configuracion y recetario, y guarda sus IDs
 * en Script Properties (Config.gs los lee de ahi).
 */

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
      ['food_cost_objetivo_pct', 32]
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
