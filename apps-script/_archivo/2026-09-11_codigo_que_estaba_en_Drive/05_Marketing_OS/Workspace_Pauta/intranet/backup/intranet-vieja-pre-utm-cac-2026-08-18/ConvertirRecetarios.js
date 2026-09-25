/**
 * ConvertirRecetarios.gs - Ejecutar convertirRecetarios() UNA VEZ desde el editor.
 * Convierte los dos xlsx del recetario (ya en Drive) a hojas nativas de Google
 * y guarda los IDs en Script Properties. A partir de ahi, el equipo edita las
 * fichas en las hojas nativas y la intranet lee en vivo.
 * Requiere el servicio avanzado de Drive (ya habilitado en appsscript.json).
 */

const RECETARIO_XLSX = {
  BARRA: '1r_5FCMuH_wnMLpCx5y0Eq8GMd0Jzoab_',   // Rosanta_Recetario_Barra_v5_corregido.xlsx
  COCINA: '1shVWGSwzUcrodqqq7jgqXloPvteyAIC8'   // Rosanta_Recetario_Completo_Cocina (1).xlsx
};

function convertirRecetarios() {
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
