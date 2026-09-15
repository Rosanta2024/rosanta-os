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
  CONSOLA_URL: 'https://script.google.com/macros/s/AKfycbzzy8u-qu4uemXzgzPd1ylmDrTm5giV2qqpxYKUu88y28J1dZ3_yryBGaV97rQrU7BAzg/exec',
  RESENAS_URL: 'https://script.google.com/macros/s/AKfycbygKOwpwfMUWzf4_E5ZyfIVtWf8XRhx6IvmCxkW5tIP3roFbf8wuyl0mqBn1Ie-K3xsMw/exec'
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
 * La direccion publica de la intranet. TODOS los enlaces que la intranet se arma a
 * si misma salen de aca: el panel principal, el boton "Panel principal" de cada
 * modulo, las tarjetas del panel y los enlaces personales con ?u=token.
 *
 * POR QUE NO USA ScriptApp.getService().getUrl() A SECAS
 * El 30-ago-2026 esa llamada devolvia el despliegue de @HEAD (AKfycbxw...) y no el
 * publicado (AKfycby814...), y ademas terminaba en /dev. Un enlace a /dev exige
 * permiso de EDITOR del script: a cualquier otro Google le contesta "You need
 * access". Eso rompia dos cosas a la vez:
 *   · volver al panel y entrar a Marketing desde adentro de un modulo, y
 *   · los enlaces personales que reparte generarTokensUsuarios(), que se corre
 *     desde el editor y por eso SIEMPRE los minteaba contra /dev. Los accesos de
 *     Jeffry y Jose nunca podrian haber funcionado con esa URL.
 *
 * La direccion buena vive en Script Properties, como todas las IDs del proyecto:
 *
 *   INTRANET_URL -> https://script.google.com/macros/s/<ID>/exec
 *
 * SIN EL PREFIJO DE DOMINIO. La forma con /a/macros/rosanta.rest/ redirige al login
 * EXCLUSIVO de rosanta.rest y le pide contrasena del dominio a quien entra con Gmail
 * personal, que son justamente los que usan los enlaces con ?u=token. Vale para las
 * TRES URLs de este archivo, no solo para INTRANET_URL: CONSOLA_URL y RESENAS_URL se
 * le entregan al navegador del usuario desde Code.gs y tenian la misma forma rota
 * hasta el 12-sep-2026.
 *
 * Se copia del dialogo Implementar > Administrar implementaciones, del despliegue
 * publicado, y termina en /exec. Si algun dia se cambia de despliegue, se cambia
 * ahi y no en el codigo.
 *
 * Sin la propiedad cae de vuelta en getUrl(): la intranet sigue de pie, pero los
 * enlaces vuelven a ser los malos. La bateria de pruebas avisa si falta.
 */
function urlIntranet_() {
  var fija = PropertiesService.getScriptProperties().getProperty('INTRANET_URL');
  if (fija && String(fija).trim()) return String(fija).trim().replace(/\/+$/, '');
  return ScriptApp.getService().getUrl();
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

/**
 * La cerradura de una funcion que la pantalla puede llamar.
 *
 * TODA funcion invocable con google.script.run tiene que pasar por aca o por
 * edicionCorrer_(). doGet decide que PAGINA se sirve, pero eso no protege a la
 * funcion: son dos puertas al mismo cuarto, y hasta el 10-sep-2026 cuatro
 * funciones —getProfitOS, getAvisosDashboard, getMetasData y getComparativoData—
 * tenian una sola. Las dos de finanzas leen el maestro entero.
 *
 * El propio proyecto ya lo habia escrito en registrarPrecio: "dos puertas al mismo
 * cuarto con cerraduras distintas es lo mismo que una puerta sin cerradura".
 *
 * Sin auth cae en la sesion del dominio, que es como se comportaba antes: por eso
 * la bateria, los diagnosticos y calentarCaches() la siguen llamando sin nada.
 */
function exigirModulo_(auth, modulo) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  if (!usuarioTieneModulo(u, modulo)) throw new Error('Tu cuenta no tiene ' + modulo + '.');
  return u;
}

/**
 * La cerradura de las HERRAMIENTAS DE EDITOR (15-sep-2026).
 *
 * El despliegue es access: ANYONE y executeAs: USER_DEPLOYING. Cualquier pagina del
 * despliegue —tambien "Esta puerta esta cerrada"— le da al navegador google.script.run
 * contra TODA funcion global cuyo nombre no termine en guion bajo, y esa funcion corre
 * como Juanma. Hasta esta fecha habia 85 asi. Entre ellas fijarUrlIntranet, que dejaba
 * redirigir los enlaces con token a otra app, y las de Finanzas con el guion ADELANTE:
 * _finDatos devolvia el maestro entero. Solo el guion AL FINAL esconde una funcion.
 *
 * Una herramienta que se corre desde el editor no puede llevar guion al final: desaparece
 * del menu Ejecutar. Por eso lleva esto en la primera linea. Desde el editor la sesion es
 * la de Juanma y pasa; desde el navegador de cualquier otra persona (Gmail con token, o
 * sin sesion) no lo es y tira.
 *
 * NO usar en lo que corre un activador ni en lo que llama una pantalla del equipo: ahi la
 * identidad va por resolverUsuario_(auth). La bateria vigila que no quede ninguna publica
 * sin una de las dos: "Ninguna funcion publica queda abierta".
 */
var DUENO_CORREO_ = 'restaurante@rosanta.rest';
function soloDueno_() {
  var correo = '';
  try { correo = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim(); } catch (e) { correo = ''; }
  if (correo !== DUENO_CORREO_) {
    throw new Error('Esta funcion es una herramienta de editor: solo la corre el dueño, desde el editor de Apps Script.');
  }
}

/** Identidad para las llamadas de google.script.run: token si viene, si no la sesión. */
function resolverUsuario_(auth) {
  return (auth ? getUsuarioPorToken_(auth) : null) || getUsuarioActual();
}

/** Genera tokens para quien no tenga. Ejecutar desde el editor y leer el Log. */
function generarTokensUsuarios() {
  soloDueno_();
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
  var filas = hoja.getDataRange().getValues();
  if (String(filas[0][5] || '').trim() !== 'token') {
    hoja.getRange(1, 6).setValue('token').setFontWeight('bold');
  }
  // urlIntranet_() y no getUrl(): esta funcion se corre DESDE EL EDITOR, donde
  // getUrl() devuelve la URL /dev del despliegue de pruebas. Cada token que se
  // repartiera con esa base daria "You need access" al abrirlo.
  var base = urlIntranet_();
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
