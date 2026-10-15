/**
 * LATIDO DE RESERVAS WEB (15-oct-2026)
 *
 * Antes lo hacia una tarea programada de la Mac (rosanta-latido-reservas-web), que solo corre
 * con la app de Claude abierta, la Mac despierta y un cupo libre: del 25-sep al 13-oct no
 * corrio ni una vez. Lo que hay que vigilar si o si va aca, colgado del vigia (cada hora).
 *
 * Que revisa, igual que la tarea de la Mac (decision de Juanma, 15-oct-2026):
 *   1. /_functions/slots de mañana y pasado: HTTP 200, JSON con "slots" (lista). Falla si las
 *      DOS fechas traen 0 franjas (una sola con 0 puede ser un dia cerrado).
 *   2. /_functions/reservaPing: HTTP 200 y "ok": true (el bot de WhatsApp puede reservar).
 *   3. POST /_functions/reservar con {} y SIN datos: lo bueno es 400 "Missing required fields"
 *      (la funcion existe). Nunca se manda una reserva real ni se llama a reservaBot/cancelarBot.
 *
 * Si algo falla: UN correo al dueño por dia (y otro si cambia lo que falla), mas la marca
 * PROC_reservasWeb para que Procesos lo repita si sigue caido.
 *
 * AMBITO GLOBAL: todo empieza con rlat; lo privado termina en guion bajo.
 */

var RLAT_BASE_ = 'https://www.rosanta.rest/_functions/';

/** Pura (la bateria la corre con respuestas inventadas). r = [slots1, slots2, ping, reservar],
 *  cada una { codigo, cuerpo }. Devuelve { fallas: [texto], resumen }. */
function rlatEvaluar_(r) {
  var fallas = [], franjas = [];
  var json = function (x) { try { return JSON.parse(x.cuerpo); } catch (e) { return null; } };
  var corto = function (x) { return String(x.cuerpo || '').replace(/\s+/g, ' ').slice(0, 200); };
  [r[0], r[1]].forEach(function (x, i) {
    var j = json(x), cual = i ? 'pasado mañana' : 'mañana';
    if (x.codigo !== 200 || !j || j.error || !Array.isArray(j.slots)) {
      fallas.push('Horarios de ' + cual + ': HTTP ' + x.codigo + ' · ' + corto(x));
      franjas.push(null);
    } else franjas.push(j.slots.length);
  });
  if (franjas[0] === 0 && franjas[1] === 0) fallas.push('Horarios: mañana y pasado mañana traen 0 franjas (el formulario diría "no hay mesas").');
  var p = json(r[2]);
  if (r[2].codigo !== 200 || !p || p.ok !== true) fallas.push('Bot (reservaPing): HTTP ' + r[2].codigo + ' · ' + corto(r[2]));
  var c = json(r[3]);
  if (r[3].codigo !== 400 || !c || !/Missing required fields/i.test(String(c.error || '')))
    fallas.push('Crear reserva (reservar sin datos): esperaba 400 "Missing required fields", llegó HTTP ' + r[3].codigo + ' · ' + corto(r[3]));
  return { fallas: fallas,
           resumen: 'mañana ' + franjas[0] + ' franjas · pasado ' + franjas[1] + ' · bot ' + (p && p.ok === true ? 'ok' : 'NO') +
                    ' · reservar ' + r[3].codigo };
}

/** Mañana y pasado mañana en Guatemala, AAAA-MM-DD. */
function rlatFechas_(hoy) {
  hoy = hoy || new Date();
  return [1, 2].map(function (n) {
    return Utilities.formatDate(new Date(hoy.getTime() + n * 864e5), 'America/Guatemala', 'yyyy-MM-dd');
  });
}

/** La revision de verdad: 4 llamadas, marca del proceso y correo si algo falla. */
function rlatRevisar_() {
  var f = rlatFechas_();
  var pedidos = [
    { url: RLAT_BASE_ + 'slots?date=' + f[0] + '&partySize=2', muteHttpExceptions: true },
    { url: RLAT_BASE_ + 'slots?date=' + f[1] + '&partySize=2', muteHttpExceptions: true },
    { url: RLAT_BASE_ + 'reservaPing', muteHttpExceptions: true },
    { url: RLAT_BASE_ + 'reservar', method: 'post', contentType: 'text/plain', payload: '{}', muteHttpExceptions: true }
  ];
  var r;
  try {
    r = UrlFetchApp.fetchAll(pedidos).map(function (x) { return { codigo: x.getResponseCode(), cuerpo: x.getContentText() }; });
  } catch (e) {
    r = pedidos.map(function () { return { codigo: 0, cuerpo: 'sin respuesta: ' + String(e && e.message || e) }; });
  }
  var ev = rlatEvaluar_(r);
  if (!ev.fallas.length) {
    procMarcar_('reservasWeb');
    return 'Latido reservas OK · ' + ev.resumen;
  }
  procMarcar_('reservasWeb', ev.fallas.join(' | '));
  var p = PropertiesService.getScriptProperties();
  var sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd') + '|' +
              ev.fallas.map(function (x) { return x.split(':')[0]; }).join('|');
  if (p.getProperty('RLAT_AVISO') !== sello) {
    MailApp.sendEmail({ to: DUENO_CORREO_, name: 'Rosanta · Reservas web',
      subject: 'Rosanta · FALLA el canal de reservas web (' + ev.fallas.length + ')',
      body: 'El latido de reservas web encontró problemas:\n\n· ' + ev.fallas.join('\n· ') +
            '\n\nArreglo conocido: backend/reservations.web.js en Wix › Editor › Dev Mode › Backend; ' +
            'copia buena en Drive 05_Marketing_OS/Reservas_WIX/2026-09-15_reservations.web.js_PARA_PEGAR_EN_WIX.js ' +
            'y en el repo rosanta-wix (src/backend). Ver p165 del tablero.\n\nSe revisa a las 8:00 y a las 14:00; ' +
            'llega un correo por día mientras siga el problema.' });
    p.setProperty('RLAT_AVISO', sello);
  }
  return 'Latido reservas FALLA · ' + ev.fallas.join(' | ');
}
