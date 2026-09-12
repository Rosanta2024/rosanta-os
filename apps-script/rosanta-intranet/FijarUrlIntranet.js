/**
 * FijarUrlIntranet.gs — Pone INTRANET_URL, validando la forma. UNA sola funcion.
 *
 * POR QUE EXISTE, con el caso del 10-sep-2026:
 *
 *   La propiedad tenia la URL con prefijo de DOMINIO:
 *       https://script.google.com/a/macros/rosanta.rest/s/<ID>/exec
 *
 *   Esa forma redirige a www.google.com/a/rosanta.rest/ServiceLogin, que es el
 *   login EXCLUSIVO del dominio: solo acepta identidades @rosanta.rest. A quien
 *   entra con Gmail personal —que es el caso de Jeffry y Jose— le pide una
 *   contraseña que no tiene.
 *
 *   La forma sin dominio redirige al selector generico de Google y acepta
 *   cualquier cuenta:
 *       https://script.google.com/macros/s/<ID>/exec
 *
 *   Mismo despliegue, misma app. Comprobado con curl: las dos devuelven 302 pero
 *   a pantallas de login distintas.
 *
 * Se corre con el ID del despliegue PUBLICADO (no el de @HEAD):
 *     clasp run fijarUrlIntranet --params '["https://script.google.com/macros/s/<ID>/exec"]'
 *
 * Valida antes de escribir. Si la URL no sirve, no toca nada y dice por que.
 */
function fijarUrlIntranet(url) {
  url = String(url || '').trim().replace(/\/+$/, '');

  var problemas = [];
  if (url.indexOf('https://script.google.com/') !== 0) {
    problemas.push('no empieza con https://script.google.com/');
  }
  if (url.indexOf('script.google.com/a/') > -1) {
    problemas.push('lleva prefijo de dominio (/a/): eso obliga a entrar con una ' +
                   'cuenta del dominio y deja afuera a los Gmail personales');
  }
  if (url.slice(-5) !== '/exec') {
    problemas.push('no termina en /exec (/dev exige permiso de editor)');
  }
  if (problemas.length) {
    Logger.log('NO SE CAMBIO NADA. La URL no sirve:');
    problemas.forEach(function (p) { Logger.log('  · ' + p); });
    Logger.log('Recibido: %s', url || '(vacio)');
    return { ok: false, problemas: problemas };
  }

  var props = PropertiesService.getScriptProperties();
  var antes = props.getProperty('INTRANET_URL');
  props.setProperty('INTRANET_URL', url);

  Logger.log('INTRANET_URL');
  Logger.log('  antes:  %s', antes || '(sin poner)');
  Logger.log('  ahora:  %s', url);
  Logger.log('OJO: los enlaces YA repartidos siguen con la base vieja.');
  Logger.log('Hay que volver a correr generarTokensUsuarios() y reenviarlos.');
  return { ok: true, antes: antes || null, ahora: url };
}
