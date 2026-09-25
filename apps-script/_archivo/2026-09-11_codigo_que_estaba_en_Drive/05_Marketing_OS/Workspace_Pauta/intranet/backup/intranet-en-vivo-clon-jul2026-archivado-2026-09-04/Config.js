/**
 * Config.gs - Constantes y acceso a la configuracion.
 * Rellenar los IDs cuando se creen los Sheets.
 */

const CONFIG = {
  APP_NAME: 'Rosanta Intranet',
  MONEDA: 'Q',

  // OJO: estas dos URLs venían cruzadas en el handoff. Verificado con
  // `clasp list-deployments` por proyecto y con el doGet de cada uno.
  // La consola es sólo para responder: la vista CRM ya muestra la conversación.
  CONSOLA_URL: 'https://script.google.com/a/macros/rosanta.rest/s/AKfycbzzy8u-qu4uemXzgzPd1ylmDrTm5giV2qqpxYKUu88y28J1dZ3_yryBGaV97rQrU7BAzg/exec',
  RESENAS_URL: 'https://script.google.com/a/macros/rosanta.rest/s/AKfycbygKOwpwfMUWzf4_E5ZyfIVtWf8XRhx6IvmCxkW5tIP3roFbf8wuyl0mqBn1Ie-K3xsMw/exec'
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

/**
 * Usuario por TOKEN de acceso (columna 6 de USUARIOS: "token").
 *
 * Para quien NO tiene correo del dominio (Gmail personal): su enlace personal
 * lleva ?u=<token>. La web app sigue ejecutándose como Juanma, así que nadie
 * necesita acceso directo a las Sheets y el rol de la hoja USUARIOS manda igual.
 * Sin token en la URL, todo se comporta como antes (login por dominio).
 *
 * El token es un secreto compartible: quien tenga el enlace entra con ese rol.
 * Para revocar a alguien, se borra o se cambia su token en la hoja.
 */
function getUsuarioPorToken_(token) {
  var t = String(token || '').trim();
  if (!t) return null;
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    var fila = String(filas[i][5] || '').trim();
    if (fila && fila === t) {
      return {
        email: String(filas[i][0]).toLowerCase().trim(),
        rol: String(filas[i][1]).trim(),
        modulos: String(filas[i][2]).split(',').map(function (m) { return m.trim(); }),
        puedeEditar: String(filas[i][3]).toUpperCase() === 'SI',
        nombre: String(filas[i][4] || '').trim(),
        token: fila
      };
    }
  }
  return null;
}

/** Identidad para las llamadas de google.script.run: token si viene, si no la sesión. */
function resolverUsuario_(auth) {
  return (auth ? getUsuarioPorToken_(auth) : null) || getUsuarioActual();
}

/** Genera tokens para quien no tenga. Ejecutar desde el editor y leer el Log. */
function generarTokensUsuarios() {
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  var filas = hoja.getDataRange().getValues();
  if (String(filas[0][5] || '').trim() !== 'token') {
    hoja.getRange(1, 6).setValue('token').setFontWeight('bold');
  }
  var base = ScriptApp.getService().getUrl();
  for (var i = 1; i < filas.length; i++) {
    var correo = String(filas[i][0] || '').trim();
    if (!correo) continue;
    var t = String(filas[i][5] || '').trim();
    if (!t) {
      t = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      hoja.getRange(i + 1, 6).setValue(t);
    }
    Logger.log(correo + '  ->  ' + base + '?u=' + t);
  }
}
