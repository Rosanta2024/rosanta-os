/**
 * ROSANTA · BOT — RESUMEN DEL DÍA (17-oct-2026)
 * Decisión de Juanma: las reservas que el bot hace solo (por chat o por correo) no pasan por él;
 * en el cierre del día recibe un aviso de lo que se movió. Activador diario (se crea a mano en
 * el editor: Activadores › resumenDiarioBot › Basado en tiempo › Diario › 9 p. m. a 10 p. m.).
 * Si en el día no hubo movimientos, no manda nada.
 * @70 (23-oct-2026, Juanma): cuenta las ÚLTIMAS 24 HORAS, no "lo de hoy". El activador quedó a las 9 a. m. y así solo
 * contaba de 0:00 a 9:00: casi todo lo del día no entraba nunca en ningún resumen. Ahora sirve a cualquier hora.
 */
function resumenDiarioBot() {
  if (nubeAtiendeBot_()) return;   // @68: con el bot de la nube atendiendo, el resumen lo manda la nube (Nube.js)
  var tz = 'America/Guatemala';
  var hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var desde24 = Date.now() - 24 * 3600000;
  var filas = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('Leads').getDataRange().getValues().slice(1);
  var mov = [], pasaron = [];
  filas.forEach(function (r) {
    var t = r[0] instanceof Date ? r[0].getTime() : 0;
    if (t < desde24) return;
    var resumen = String(r[7] || ''), quien = (r[3] || r[14] || r[11] || '') + ' (' + r[1] + ')';
    if (/^Reserva (creada|CAMBIADA|CANCELADA)/.test(resumen)) mov.push('• ' + quien + ': ' + resumen.replace(/ por el bot/, ''));
    else if (r[9] === 'Sí') pasaron.push('• ' + quien + ': ' + resumen);
  });
  // @70 (Ashley, 21-oct): arriba, los chats que siguen esperando a una persona, con su hora límite de WhatsApp.
  var pend = [];
  try { pend = avisoPendientes_(); } catch (eP) { Logger.log('resumen pendientes: ' + eP); }
  if (!mov.length && !pasaron.length && !pend.length) return;
  var ahoraMs = Date.now();
  var lineasPend = pend.map(function (x) {
    var lim = x.limite ? (x.limite > ahoraMs ? 'contestar antes de ' + avisoHora_(x.limite) : 'VENTANA CERRADA (' + avisoHora_(x.limite) + '): solo por plantilla o por correo') : 'sin límite (correo)';
    return '• ' + (String(x.nombre || '').split(' ')[0] || 'Cliente') + ' (' + x.canal + ' …' + String(x.contacto).slice(-4) + ') · ' + x.tema + ' · ' + lim;
  });
  var cuerpo = (pend.length ? 'PENDIENTES SIN RESPONDER (' + pend.length + ')\n' + lineasPend.join('\n') + '\n👉 ' + avisoConsola_() + '\n\n' : '') +
    'Lo que hizo el bot en las últimas 24 horas (hasta ' + Utilities.formatDate(new Date(), tz, 'dd-MMM HH:mm') + '). Las reservas son solo un aviso: no hace falta hacer nada con ellas.\n\n' +
    'RESERVAS (' + mov.length + ')\n' + (mov.join('\n') || '• Ninguna') + '\n\n' +
    'CHATS QUE TE PASÓ (' + pasaron.length + ')\n' + (pasaron.join('\n') || '• Ninguno') + '\n';
  var asunto = (pend.length ? '⚠️ ' + pend.length + (pend.length === 1 ? ' chat espera' : ' chats esperan') + ' respuesta · ' : '') +
    'Rosanta · Lo que hizo el bot (últimas 24 h, ' + mov.length + ' reservas)';
  MailApp.sendEmail({ to: 'restaurante@rosanta.rest', subject: asunto, body: cuerpo, name: 'Bot Rosanta' });
}
