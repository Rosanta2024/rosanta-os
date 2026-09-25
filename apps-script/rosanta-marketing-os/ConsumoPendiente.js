/*
 *  ROSANTA · ConsumoPendiente.js  (23-sep-2026)
 *  Lista corta semanal: reservas de la semana pasada a las que falta anotar
 *  el consumo en Wix (o marcar Seated si vinieron). Sale cada lunes a las 8 por correo al
 *  restaurante. Solo lee la pestaña 'reservas'; no escribe en ninguna hoja.
 *
 *  Regla operativa (p163): al sentarse la mesa se marca SEATED; al terminar el
 *  servicio se anota el consumo en "Consumo total de la mesa (Q)" y la reserva
 *  SE DEJA EN SEATED (verificado 23-sep-2026: la edicion posterior del monto
 *  llega a la hoja igual). FINISHED solo cuando se quiere pedir la resena de
 *  TripAdvisor; NO-SHOW solo si de verdad no llego.
 *
 *  Dos bloques:
 *    A) Vinieron y falta el consumo: SEATED o FINISHED con gasto 0.
 *    B) Sin cerrar: siguen en RESERVED aunque la fecha ya pasó.
 *  Los NO_SHOW no salen: si de verdad no vino, no hay nada que anotar.
 */

var CP_EMAIL   = 'restaurante@rosanta.rest';
var CP_DIAS    = 7;
var CP_WIX_URL = 'https://manage.wix.com/dashboard/47968b83-c2c2-4b11-8f94-ef2c7488debc/'
               + 'wix-table-reservations/table-reservations?viewId=all&reservationId=';

/** Arma la lista para los CP_DIAS días anteriores a `hoy` (hoy no entra). */
function armarListaConsumoPendiente_(hoy) {
  hoy = hoy || new Date();
  var hasta = Utilities.formatDate(new Date(hoy.getTime() - 86400000), TZ, 'yyyy-MM-dd');
  var desde = Utilities.formatDate(new Date(hoy.getTime() - CP_DIAS * 86400000), TZ, 'yyyy-MM-dd');

  var faltaConsumo = [], sinCerrar = [];
  readTab(TAB_RESERVAS).forEach(function (r) {
    var fecha = formatearFecha_(r.fecha);
    if (!fecha || fecha < desde || fecha > hasta) return;
    if (esExcluido_(String(r.nombre || '') + ' ' + String(r.email || ''))) return;
    var estado = String(r.estado || '').trim().toUpperCase();
    var gasto  = Number(r.gasto || 0);
    var item = { id: String(r.id || ''), fecha: fecha, nombre: String(r.nombre || '').trim(),
                 personas: Number(r.personas || 0), estado: estado };
    if ((estado === 'SEATED' || estado === 'FINISHED') && !(gasto > 0)) faltaConsumo.push(item);
    else if (estado === 'RESERVED') sinCerrar.push(item);
  });
  var porFecha = function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; };
  faltaConsumo.sort(porFecha); sinCerrar.sort(porFecha);
  return { desde: desde, hasta: hasta, faltaConsumo: faltaConsumo, sinCerrar: sinCerrar,
           total: faltaConsumo.length + sinCerrar.length };
}

function lineaTexto_(it) {
  return '  · ' + it.fecha + '  ' + it.nombre + '  (' + it.personas + ' pers.)';
}
function lineaHtml_(it) {
  var nombre = it.nombre.replace(/</g, '&lt;');
  var enlace = it.id ? '<a href="' + CP_WIX_URL + it.id + '">' + nombre + '</a>' : nombre;
  return '<li>' + it.fecha + ' &nbsp;' + enlace + ' &nbsp;<span style="color:#7a8a80">' + it.personas + ' pers.</span></li>';
}

function textoLista_(L) {
  var t = 'Reservas de la semana (' + L.desde + ' a ' + L.hasta + ') con consumo pendiente en Wix\n\n';
  t += 'A) VINIERON Y FALTA EL CONSUMO (' + L.faltaConsumo.length + ')\n';
  t += L.faltaConsumo.length ? L.faltaConsumo.map(lineaTexto_).join('\n') : '  (ninguna)';
  t += '\n\nB) SIN CERRAR, SIGUEN EN RESERVED (' + L.sinCerrar.length + ')\n';
  t += L.sinCerrar.length ? L.sinCerrar.map(lineaTexto_).join('\n') : '  (ninguna)';
  t += '\n\nCómo anotarlo: abrir la reserva en Wix, poner Seated si la mesa vino (No-show si no llegó), '
     + 'escribir el total del ticket en "Consumo total de la mesa (Q)" y dejarla en Seated. '
     + 'Finished solo si querés pedir la reseña.\n';
  return t;
}

function htmlLista_(L) {
  var h = '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;color:#2f3a33">';
  h += '<p>Reservas de la semana (<b>' + L.desde + '</b> a <b>' + L.hasta + '</b>) con consumo pendiente en Wix.</p>';
  h += '<p><b>A) Vinieron y falta el consumo (' + L.faltaConsumo.length + ')</b></p>';
  h += L.faltaConsumo.length ? '<ul>' + L.faltaConsumo.map(lineaHtml_).join('') + '</ul>' : '<p>(ninguna)</p>';
  h += '<p><b>B) Sin cerrar, siguen en Reserved (' + L.sinCerrar.length + ')</b></p>';
  h += L.sinCerrar.length ? '<ul>' + L.sinCerrar.map(lineaHtml_).join('') + '</ul>' : '<p>(ninguna)</p>';
  h += '<p style="color:#7a8a80;font-size:12.5px">Cada nombre abre la reserva en Wix. Poner <b>Seated</b> si la mesa vino '
     + '(No-show si no llegó), escribir el total del ticket en "Consumo total de la mesa (Q)" y <b>dejarla en Seated</b>. '
     + '<b>Finished</b> solo si querés pedir la reseña.</p></div>';
  return h;
}

/** Corrida en seco: muestra la lista en el registro sin mandar nada. */
function previsualizarListaConsumoPendiente() {
  var L = armarListaConsumoPendiente_();
  var t = textoLista_(L);
  Logger.log(t);
  return t;
}

/** La que corre el lunes. Si no falta nada, no manda correo. */
function enviarListaConsumoPendiente() {
  var L = armarListaConsumoPendiente_();
  if (!L.total) { Logger.log('Consumo pendiente: nada que reportar (' + L.desde + ' a ' + L.hasta + ')'); return 'nada'; }
  MailApp.sendEmail({
    to: CP_EMAIL,
    subject: 'Reservas con consumo pendiente en Wix · ' + L.total + ' de la semana ' + L.desde + ' a ' + L.hasta,
    body: textoLista_(L),
    htmlBody: htmlLista_(L)
  });
  return 'enviado: ' + L.total;
}

/** Correr UNA vez desde el editor: deja el activador de los lunes a las 8. */
function instalarTriggerConsumoPendiente() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarListaConsumoPendiente') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarListaConsumoPendiente').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(TZ).create();
  return 'Listo: enviarListaConsumoPendiente corre los lunes a las 8 (hora de Guatemala).';
}
