/**
 * LATIDO DE CANALES DEL BOT (16-oct-2026)
 *
 * Por que existe: Instagram no registro ningun mensaje del 26-sep al 7-oct (11 dias) y nadie
 * se entero. Lo encontro una medicion a mano el 15-oct. Ningun monitor miraba si los canales
 * del bot seguian recibiendo.
 *
 * Que revisa, una vez al dia (9:00, colgado del vigia):
 *   · Hora del ultimo mensaje ENTRANTE por canal en Rosanta Leads › Conversaciones
 *     (A Fecha/Hora, B Canal, E Direccion = 'in'). Lo escribe el bot ANTES de contestar,
 *     asi que un canal callado aca es un mensaje que no llego al bot.
 *   · Correo: ademas del silencio, si Gmail tiene correos de clientes con la etiqueta
 *     01-CLIENTES (Reservas) de hace mas de 2 h y el bot no anoto ninguno en 48 h, el lector
 *     de correos del bot esta parado (no es que nadie escriba).
 *
 * Umbrales (horas sin mensajes) en PARAMETROS, medidos con 90 dias de datos al 15-oct-2026:
 *   canal_whatsapp_h  72  (48 h habria dado 10 falsas alarmas en 90 dias; 72 h, 3)
 *   canal_instagram_h 96  (~4 falsas alarmas; habria avisado el 30-sep, al 4o dia del hueco)
 *   canal_messenger_h  0  = no se vigila por silencio: pasa 83 de 90 dias sin mensajes
 *   canal_correo_h    72  (el canal existe desde el 15-oct; revisar el 15-nov)
 * En PARAMETROS un 0 cuenta como vacio (cae al defecto), por eso Messenger no tiene fila.
 *
 * Si algo falla: UN correo al dueño por dia (otro si cambia lo que falla) y la marca
 * PROC_canales para que Procesos avise si este latido deja de correr.
 *
 * AMBITO GLOBAL: todo empieza con clat; lo privado termina en guion bajo.
 */

var CLAT_CANALES_ = [
  { clave: 'whatsapp',  nombre: 'WhatsApp',  param: 'canal_whatsapp_h',  defecto: 72 },
  { clave: 'instagram', nombre: 'Instagram', param: 'canal_instagram_h', defecto: 96 },
  { clave: 'messenger', nombre: 'Messenger', param: 'canal_messenger_h', defecto: 0 },
  { clave: 'correo',    nombre: 'Correo',    param: 'canal_correo_h',    defecto: 72 }
];
// Igual que CORREO_BUSQUEDA del bot (bot-rosanta/Correo.js), sin el "newer_than".
var CLAT_GMAIL_ = 'label:01-clientes--reservas- -label:01-clientes--reservas--cotizaciones ' +
  '-from:rosanta.rest -from:wixsiteautomations.com';

function clatTxt_(t) {
  return t ? Utilities.formatDate(new Date(t), 'America/Guatemala', 'EEE dd-MMM HH:mm') : 'nunca';
}

/**
 * Pura (la bateria la corre con datos inventados).
 *   ultimos:  { whatsapp: ms|null, instagram: ..., messenger: ..., correo: ... }
 *   ahora:    ms
 *   umbrales: { whatsapp: horas, ... }  (0 o vacio = no se vigila por silencio)
 *   gmail:    opcional { pendientes: n correos de clientes de hace >2 h en las ultimas 48 h }
 * Devuelve { fallas: ['Instagram: ...'], resumen }.
 */
function clatEvaluar_(ultimos, ahora, umbrales, gmail) {
  var fallas = [], partes = [];
  CLAT_CANALES_.forEach(function (c) {
    var t = ultimos[c.clave], u = Number(umbrales[c.clave] || 0);
    var h = t ? Math.floor((ahora - t) / 36e5) : null;
    partes.push(c.nombre + ' ' + (h === null ? 'sin datos' : 'hace ' + h + ' h'));
    // Sin ningun mensaje registrado no se opina (el correo arranco el 15-oct sin historia):
    // el lector parado lo cubre la regla de Gmail de abajo.
    if (!u || h === null) return;
    if (h >= u) fallas.push(c.nombre + ': ' + Math.floor(h / 24) + ' días sin mensajes de clientes (último ' +
                                 clatTxt_(t) + '; avisa desde ' + u + ' h).');
  });
  if (gmail && gmail.pendientes > 0) {
    var tc = ultimos.correo;
    if (!tc || ahora - tc >= 48 * 36e5)
      fallas.push('Correo (lector del bot): Gmail tiene ' + gmail.pendientes + ' correo(s) de clientes de las últimas 48 h ' +
                  'y el bot no anotó ninguno. El activador revisarCorreosClientes del bot puede estar parado.');
  }
  return { fallas: fallas, resumen: partes.join(' · ') };
}

/** Hora (ms) del ultimo mensaje entrante por canal, leyendo solo el final de Conversaciones. */
function clatUltimos_() {
  var hoja = SpreadsheetApp.openById(leadsSheetId_()).getSheetByName('Conversaciones');
  if (!hoja) throw new Error('Rosanta Leads no tiene la pestaña Conversaciones.');
  var out = { whatsapp: null, instagram: null, messenger: null, correo: null };
  var n = hoja.getLastRow();
  if (n < 2) return out;
  // De a 3,000 filas hacia atras hasta tener los 4 canales o 30,000 filas (Messenger es raro).
  var fin = n, leidas = 0;
  while (fin >= 2 && leidas < 30000) {
    var ini = Math.max(2, fin - 2999);
    var v = hoja.getRange(ini, 1, fin - ini + 1, 5).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      var r = v[i], canal = String(r[1] || '').trim().toLowerCase();
      if (String(r[4] || '').trim() !== 'in' || !(canal in out) || !(r[0] instanceof Date)) continue;
      var t = r[0].getTime();
      if (!out[canal] || t > out[canal]) out[canal] = t;
    }
    leidas += v.length;
    fin = ini - 1;
    if (out.whatsapp && out.instagram && out.messenger && out.correo) break;
  }
  return out;
}

/** Hilos de clientes de las ultimas 48 h que el bot ya deberia haber leido (lo hace cada 5 min):
 *  el ultimo mensaje es del cliente, tiene mas de 2 h y el hilo no tiene borrador. Un hilo que
 *  ya contesto Rosanta o con borrador del bot no cuenta (16-oct: el de Elise, contestado a mano
 *  antes de encender el canal, daba falsa alarma). */
function clatGmail_(ahora) {
  var lista = Gmail.Users.Threads.list('me', { q: CLAT_GMAIL_ + ' newer_than:2d', maxResults: 20 });
  var pend = 0;
  ((lista && lista.threads) || []).forEach(function (th) {
    var h = Gmail.Users.Threads.get('me', th.id, { format: 'metadata', metadataHeaders: ['From'] });
    var ms = (h && h.messages) || [];
    if (!ms.length || ms.some(function (m) { return (m.labelIds || []).indexOf('DRAFT') >= 0; })) return;
    var ult = ms[ms.length - 1];
    var de = ((ult.payload && ult.payload.headers) || []).filter(function (x) { return /^from$/i.test(x.name); })[0];
    if (de && /rosanta\.rest/i.test(de.value)) return;
    var t = Number(ult.internalDate || 0);
    if (t && ahora - t >= 2 * 36e5) pend++;
  });
  return { pendientes: pend };
}

function clatUmbrales_() {
  var u = {};
  CLAT_CANALES_.forEach(function (c) { u[c.clave] = _finParametro_(c.param, c.defecto); });
  return u;
}

/** La revision de verdad: lee, evalua, marca el proceso y avisa. prueba = umbral de 1 h, correo [PRUEBA]. */
function clatRevisar_(prueba) {
  var ahora = new Date().getTime();
  var ultimos = clatUltimos_();
  var gmail = null;
  try { gmail = clatGmail_(ahora); } catch (eG) { Logger.log('Latido canales · Gmail: ' + eG); }
  var umbrales = clatUmbrales_();
  if (prueba) CLAT_CANALES_.forEach(function (c) { umbrales[c.clave] = 1; });
  var ev = clatEvaluar_(ultimos, ahora, umbrales, gmail);
  if (!prueba) procMarcar_('canales', ev.fallas.length ? ev.fallas.join(' | ') : null);
  if (!ev.fallas.length) return 'Latido canales OK · ' + ev.resumen;

  var p = PropertiesService.getScriptProperties();
  var sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd') + '|' +
              ev.fallas.map(function (x) { return x.split(':')[0]; }).join('|');
  if (prueba || p.getProperty('CLAT_AVISO') !== sello) {
    var cual = ev.fallas.map(function (x) { return x.split(':')[0].replace(' (lector del bot)', ''); }).join(', ');
    MailApp.sendEmail({ to: DUENO_CORREO_, name: 'Rosanta · Canales del bot',
      subject: (prueba ? '[PRUEBA] ' : '') + 'Rosanta · canal callado: ' + cual,
      body: (prueba ? 'PRUEBA del aviso (umbral de 1 h en todos los canales). No hay que hacer nada.\n\n' : '') +
            'Un canal del bot no está recibiendo mensajes:\n\n· ' + ev.fallas.join('\n· ') +
            '\n\nÚltimo mensaje de clientes por canal:\n' +
            CLAT_CANALES_.map(function (c) { return '  ' + c.nombre + ': ' + clatTxt_(ultimos[c.clave]); }).join('\n') +
            '\n\nQué revisar:\n' +
            '1. Escribí desde tu cuenta personal por ese canal y anotá la hora. Si en 5 min no aparece una fila ' +
            '"in" en Rosanta Leads › Conversaciones, el mensaje no está llegando al bot.\n' +
            '2. Instagram o Messenger: en el proyecto del bot corré diagnosticoMeta (o diagnosticoCanales) ' +
            'y mirá si la cuenta sigue suscrita y si el token responde.\n' +
            '3. Correo: en el editor del bot › Activadores, que siga revisarCorreosClientes (cada 5 min).\n\n' +
            'Se revisa todos los días a las 9:00; llega un correo por día mientras siga el problema.' });
    if (!prueba) p.setProperty('CLAT_AVISO', sello);
  }
  return 'Latido canales FALLA · ' + ev.fallas.join(' | ');
}

/** EDITOR: prueba del aviso. Umbral de 1 h en todos los canales: manda el correo [PRUEBA]
 *  sin tocar la marca del proceso ni la llave del dia. */
function canalesProbarAlarma() {
  soloDueno_();
  var r = clatRevisar_(true);
  Logger.log(r);
  return r;
}
