/**
 * ROSANTA · BOT — CONVIVENCIA CON EL BOT DE LA NUBE (@68, 21-oct-2026, aprobada por Juanma)
 * Archivo ADITIVO. Prefijo nube.
 *
 * Desde el día único (jueves 29-oct) el bot de la nube atiende WhatsApp, Instagram y Messenger. Este proyecto sigue
 * publicado como red de seguridad (la nube le reenvía lo que no pudo atender), pero sus RELOJES se hacen a un lado
 * cuando la nube atiende, para que nada salga dos veces:
 *   - enviarRespuestasPendientes (cada minuto): Salientes de la consola, "Devolver al bot" y chats que vuelven al bot.
 *   - resumenDiarioBot (cada noche).
 * (El correo ya lo hace desde la @64 con su propio interruptor. refrescarTokenIG sigue: renovar el token no duplica nada.)
 * Volver atrás = interruptor 'bot' de la nube en 'puente': en menos de un minuto los relojes retoman.
 * Si la nube no contesta se usa la última respuesta (10 min); sin ninguna, atiende este bot: mejor dos que ninguno.
 */
var NUBE_BOT_QUIEN_URL = 'https://rosanta-bot-sombra-512086396641.northamerica-south1.run.app/bot/quien';

function nubeAtiendeBot_() {
  var cache = CacheService.getScriptCache();
  var modo = '';
  try {
    var r = UrlFetchApp.fetch(NUBE_BOT_QUIEN_URL, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() === 200) {
      modo = String((JSON.parse(r.getContentText() || '{}') || {}).modo || '');
      cache.put('bot_quien', modo || 'puente', 600);
    }
  } catch (e) { Logger.log('bot_quien: ' + e); }
  if (!modo) modo = cache.get('bot_quien') || 'puente';
  return modo === 'vivo';
}

/**
 * EDITOR (una vez, el día único a las ~9:15): copia las Propiedades de este bot SIN claves a la pestaña "EstadoBot" de
 * Rosanta Leads, para que la nube sepa quién está esperando a una persona y con qué configuración trabaja. Solo lee
 * las Propiedades: no cambia nada del bot.
 */
var NUBE_NO_COPIAR = /TOKEN|KEY|SECRET|SECRETO|CLAVE/i;
function exportarEstadoNube() {
  var props = PROPS.getProperties();
  var filas = [['clave', 'valor', 'copiado']], ahora = new Date(), omitidas = 0;
  Object.keys(props).sort().forEach(function (k) {
    if (NUBE_NO_COPIAR.test(k)) { omitidas++; return; }
    filas.push([k, String(props[k]), ahora]);
  });
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName('EstadoBot') || ss.insertSheet('EstadoBot');
  sh.clearContents();
  sh.getRange(1, 1, filas.length, 3).setValues(filas);
  console.log('EstadoBot: ' + (filas.length - 1) + ' propiedades copiadas · ' + omitidas + ' claves NO copiadas.');
  return { copiadas: filas.length - 1, omitidas: omitidas };
}
