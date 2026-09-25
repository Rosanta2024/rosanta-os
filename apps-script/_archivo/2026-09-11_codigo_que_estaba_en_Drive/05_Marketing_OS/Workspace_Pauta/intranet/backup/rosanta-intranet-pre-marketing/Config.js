/**
 * Config.gs - Constantes y acceso a la configuracion.
 * Rellenar los IDs cuando se creen los Sheets.
 */

const CONFIG = {
  APP_NAME: 'Rosanta Intranet',
  MONEDA: 'Q'
  // Recetario: dos hojas nativas (Barra y Cocina) convertidas de los xlsx v5.
  // IDs en Script Properties: RECETARIO_BARRA_SHEET_ID, RECETARIO_COCINA_SHEET_ID
  // (los guarda convertirRecetarios()). Estructura: BANCO DE DATOS + una pestana
  // "ficha" por receta. Fuente unica de verdad tras la conversion.
};

/** IDs guardados por setupInicial() en Script Properties. */
function getSheetId_(clave) {
  const id = PropertiesService.getScriptProperties().getProperty(clave);
  if (!id) throw new Error('Falta ' + clave + '. Ejecuta setupInicial() en Setup.gs');
  return id;
}

/**
 * Devuelve el usuario actual con su rol, o null si no esta autorizado.
 * Pestana USUARIOS: correo | rol | modulos (csv) | puede_editar (SI/NO) | nombre
 */
function getUsuarioActual() {
  const email = Session.getActiveUser().getEmail().toLowerCase().trim();
  if (!email) return null;
  const hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  const filas = hoja.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][0]).toLowerCase().trim() === email) {
      return {
        email: email,
        rol: String(filas[i][1]).trim(),
        modulos: String(filas[i][2]).split(',').map(function (m) { return m.trim(); }),
        puedeEditar: String(filas[i][3]).toUpperCase() === 'SI',
        nombre: String(filas[i][4] || '').trim()
      };
    }
  }
  return null;
}

function usuarioTieneModulo(usuario, modulo) {
  return usuario && usuario.modulos.indexOf(modulo) !== -1;
}
