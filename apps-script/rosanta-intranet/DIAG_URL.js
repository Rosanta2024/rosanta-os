/**
 * DIAG_URL.gs — Que URL devuelve ScriptApp.getService().getUrl().
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs: el desplegable
 * del editor elige la primera funcion del archivo abierto, y ya paso que corriera
 * otra cosa. Esta SOLO lee: no escribe una celda ni toca un despliegue.
 *
 * POR QUE EXISTE
 * El 30-ago-2026 el boton "Panel principal" del Recetario y las tarjetas del panel
 * contestaron "You need access" desde el enlace publicado. Los tres enlaces de la
 * intranet salen del mismo lugar —urlBase en Code.gs, que es esta llamada— asi que
 * antes de parchear nada hay que ver a donde apunta de verdad.
 *
 * La sospecha: el proyecto tiene DOS despliegues, y getUrl() puede estar devolviendo
 * el de @HEAD en vez del publicado. El de @HEAD exige permiso de editor del script;
 * a cualquiera que no lo tenga, Google le contesta exactamente "You need access".
 *
 * COMO SE LEE
 * Corré la funcion y mirá el Log. Dice cual de los dos despliegues es y si la URL
 * termina en /exec o en /dev.
 */

/** Los dos despliegues, tal como los lista `clasp list-deployments` el 30-ago-2026. */
var DIAG_DESPLIEGUES = {
  'AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU':
    'el de @HEAD (el de pruebas). Si la intranet arma sus enlaces con este, ' +
    'todo el que no sea editor del script recibe "You need access".',
  'AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb':
    'el PUBLICADO (@46). Es el que corresponde.'
};

function DIAG_URL() {
  var fija = PropertiesService.getScriptProperties().getProperty('INTRANET_URL');
  Logger.log('INTRANET_URL (la propiedad): %s', fija || '(SIN PONER)');
  Logger.log('urlIntranet_() devuelve  : %s', urlIntranet_());
  Logger.log('');
  Logger.log('--- lo que devolveria getUrl() a secas, que es lo que estaba roto ---');

  var url = ScriptApp.getService().getUrl();
  Logger.log('getUrl() devuelve:');
  Logger.log('  %s', url);
  Logger.log('');

  if (!url) {
    Logger.log('VACIA. La web app no esta desplegada, o esta corriendo sin contexto de web app.');
    return { url: url };
  }

  var cual = 'DESCONOCIDO — no es ninguno de los dos que conozco. Volvé a correr ' +
             'clasp list-deployments y actualizá DIAG_DESPLIEGUES.';
  Object.keys(DIAG_DESPLIEGUES).forEach(function (id) {
    if (url.indexOf(id) !== -1) cual = DIAG_DESPLIEGUES[id];
  });
  Logger.log('Que despliegue es: %s', cual);

  var termina = url.slice(-5) === '/exec' ? '/exec' : (url.slice(-4) === '/dev' ? '/dev' : '???');
  Logger.log('Termina en: %s', termina);
  if (termina === '/dev') {
    Logger.log('  OJO: /dev no se puede enmarcar y exige permiso de editor. Un enlace a /dev');
    Logger.log('  dentro de la intranet es exactamente el "You need access" que estamos viendo.');
  }
  Logger.log('');
  Logger.log('');
  Logger.log('--- los tres enlaces que arma Code.gs DE VERDAD (via urlIntranet_) ---');
  var base = urlIntranet_();
  Logger.log('  panel principal : %s', base);
  Logger.log('  recetario       : %s?page=costeo', base);
  Logger.log('  marketing       : %s?page=marketing', base);
  if (!fija) {
    Logger.log('');
    Logger.log('FALTA INTRANET_URL. Mientras no este, esos tres enlaces son los malos.');
  }

  return { url: url, cual: cual, termina: termina, base: base, fija: fija || null };
}
