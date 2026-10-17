/**
 * ROSANTA · BOT — RESERVA DE UNA VEZ: ELAN HALPERN (17-oct-2026)
 * Archivo aparte a propósito: al abrirlo en el editor, elanReservar queda elegida sola.
 * Pidió el 26-jul (26-dic, 4 personas, cumpleaños 30) y volvió a escribir el 15-oct
 * ("7:30pm, o 8:00pm funciona también"); nunca se creó en Wix. Decisión de Juanma:
 * se reserva y se le contesta sin pasar por él. Si ya existe, Wix lo detecta y no duplica.
 * Después se archiva.
 */
function elanReservar() {
  var HILO = '19fa0878d7d819ab';
  var d = { nombre: 'Elan Halpern', email: 'elandhalpern@gmail.com', fecha: '2026-12-26', hora: '19:30',
            personas: 4, idioma: 'es', canal: 'correo', telefono: RV_TEL_CORREO };
  var r = rvLlamarWix(d);
  if (!r.ok && r.motivo === 'sin_disponibilidad') { d.hora = '20:00'; r = rvLlamarWix(d); }
  if (!r.ok) { console.log('NO SE CREÓ NADA: ' + JSON.stringify(r)); return; }

  CORREO_SIN_CORREO_CLIENTE = true;      // el correo al cliente sale en el mismo hilo, no aparte
  CORREO_AUTO = null;
  try { rvAvisar(d); } finally { CORREO_SIN_CORREO_CLIENTE = false; }
  var auto = CORREO_AUTO; CORREO_AUTO = null;
  if (!auto) { console.log('Reserva creada (' + d.hora + ') pero no se armó el correo: avisar a Juanma.'); return; }

  // Texto revisado por revisor-marca (17-oct-2026).
  var cuerpo = 'Hola Elan,\n\n' +
    'En julio te dijimos que te llegaría la confirmación y nunca llegó. Perdón por eso, y por hacerte escribir otra vez.\n\n' +
    'Tu mesa queda confirmada:\n\nFecha: sábado 26 de diciembre\nHora: ' + (d.hora === '20:00' ? '8:00 p. m.' : '7:30 p. m.') +
    '\nPersonas: 4\n\nQué buena forma de celebrar tus 30. Te esperamos en el jardín.\n\n' +
    'Para cambiarla o cancelarla, responde a este correo.\n\nRosanta\nAntigua Guatemala';
  var msgs = GmailApp.getThreadById(HILO).getMessages();
  msgs[msgs.length - 1].reply(cuerpo, { name: 'Rosanta' });
  logMensaje('correo', d.email, d.nombre, 'out', 'bot', '[Enviado solo: creada] ' + cuerpo);
  logLead({ canal: 'correo', idioma: 'es', nombre: d.nombre, email: d.email, tipo: 'reserva', urgencia: 'caliente',
            resumen: 'Reserva creada en Wix: ' + d.fecha + ' ' + d.hora + ', ' + d.personas + ' personas' + (r.duplicada ? ' (ya existía)' : ''),
            accion: 'crear_reserva', requiere_humano: false },
          'Puedes confirmar este reservación? 26-dic, 4 personas, 7:30pm u 8:00pm', d.email, cuerpo);
  console.log('LISTO: reserva ' + d.fecha + ' ' + d.hora + ' (' + d.personas + ' personas)' + (r.duplicada ? ', ya existía en Wix' : '') +
    ' y correo enviado a ' + d.email);
}
