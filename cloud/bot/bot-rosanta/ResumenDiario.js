/**
 * ROSANTA · BOT — RESUMEN DEL DÍA (17-oct-2026)
 * Decisión de Juanma: las reservas que el bot hace solo (por chat o por correo) no pasan por él;
 * en el cierre del día recibe un aviso de lo que se movió. Activador diario (se crea a mano en
 * el editor: Activadores › resumenDiarioBot › Basado en tiempo › Diario › 9 p. m. a 10 p. m.).
 * Si en el día no hubo movimientos, no manda nada.
 */
function resumenDiarioBot() {
  var tz = 'America/Guatemala';
  var hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var filas = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('Leads').getDataRange().getValues().slice(1);
  var mov = [], pasaron = [];
  filas.forEach(function (r) {
    var f = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : '';
    if (f !== hoy) return;
    var resumen = String(r[7] || ''), quien = (r[3] || r[14] || r[11] || '') + ' (' + r[1] + ')';
    if (/^Reserva (creada|CAMBIADA|CANCELADA)/.test(resumen)) mov.push('• ' + quien + ': ' + resumen.replace(/ por el bot/, ''));
    else if (r[9] === 'Sí') pasaron.push('• ' + quien + ': ' + resumen);
  });
  if (!mov.length && !pasaron.length) return;
  var cuerpo = 'Lo que hizo el bot hoy, ' + hoy + '. Es solo un aviso: no hace falta hacer nada con las reservas.\n\n' +
    'RESERVAS (' + mov.length + ')\n' + (mov.join('\n') || '• Ninguna') + '\n\n' +
    'CHATS QUE TE PASÓ (' + pasaron.length + ')\n' + (pasaron.join('\n') || '• Ninguno') + '\n';
  MailApp.sendEmail({ to: 'restaurante@rosanta.rest', subject: 'Rosanta · Lo que hizo el bot hoy (' + mov.length + ' reservas)', body: cuerpo, name: 'Bot Rosanta' });
}
