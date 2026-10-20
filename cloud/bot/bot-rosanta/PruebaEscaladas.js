/**
 * ROSANTA · BOT — PRUEBA DE ESCALADAS (16-oct-2026)
 * Archivo aparte a propósito: al abrirlo en el editor, probarEscaladas queda
 * elegida sola en el menú de funciones. Llama SOLO al modelo (askClaude):
 * no toca Wix, no envía nada a ningún cliente, no escribe en la hoja.
 * Casos sacados de los chats que pasaron a Juanma del 16-sep al 15-oct.
 */
function probarEscaladas() {
  // [canal, mensaje, acción esperada, ¿debe pasar a Juanma?]
  var casos = [
    ['whatsapp', 'Quería saber si puedo mover mi reserva para las 7:15?', 'cambiar_reserva', false],
    ['whatsapp', 'Hola quisiera cambiar el horario para las 2:30 de la tarde estamos retrasados', 'cambiar_reserva', false],
    ['whatsapp', 'I just made a reservation for 10 people at 7 pm, but there will be 11 of us. My name is Anda', 'cambiar_reserva', false],
    ['whatsapp', 'We made a reservation tonight at 19:00 but it needs to be tomorrow at the same time', 'cambiar_reserva', false],
    ['whatsapp', 'Necesito cancelar mi reserva de mañana', 'cancelar_reserva', false],
    ['whatsapp', 'tengo una reserva pero no me recuerdo que horas', 'consultar_reserva', false],
    ['instagram', 'Hi! What time was my booking? I forgot', 'consultar_reserva', false],
    ['instagram', 'Hola! Soy creadora de contenido y viajo a Antigua la otra semana, me encantaría colaborar con ustedes', 'responder_info', false],
    ['instagram', 'Hi, we are a band from Costa Rica and would love to play at your restaurant', 'responder_info', false],
    ['whatsapp', 'transferencia realizada', '', true],
    ['whatsapp', "Hi, I'm not able to pay, the info isn't working. I'd like a real person to help me, not AI", '', true],
    ['whatsapp', 'Quiero hablar con una persona', '', true],
    // Algo que no está en la base pero hay algo parecido: ofrece la Cena Romántica y no escala (Abdiel, 16-oct)
    ['whatsapp', 'Queremos un picnic romántico para 2 un domingo a las 3 pm para nuestro aniversario, ¿qué paquetes tienen?', '', false],
    // Con el nombre del perfil (aquí "Prueba") pregunta si la reserva va a ese nombre, no crea todavía (Juanma, 16-oct)
    ['whatsapp', 'Quiero reservar el sábado 17 de octubre a las 7pm para 2 personas, mi correo es prueba@rosanta.rest', 'responder_info', false]
  ];
  var ok = 0;
  casos.forEach(function (c, i) {
    var id = 'prueba-escaladas-' + i + '-' + Date.now();
    var r = askClaude(c[0], 'Prueba', c[1], id);
    var lead = r.lead || {};
    var accionOk = !c[2] || lead.accion === c[2];
    var humanoOk = !!lead.requiere_humano === c[3];
    var bien = accionOk && humanoOk;
    if (bien) ok++;
    console.log('— ' + (i + 1) + '. [' + c[0] + '] ' + c[1] +
      '\nrespuesta: ' + r.respuesta +
      '\naccion: ' + lead.accion + ' (esperada: ' + (c[2] || 'cualquiera') + ') · pasa a Juanma: ' + !!lead.requiere_humano +
      ' (esperado: ' + c[3] + ')' +
      '\n' + (bien ? 'OK' : 'FALLA'));
  });
  // Dos turnos en el mismo chat: confirma el nombre del perfil y recién ahí marca crear_reserva (solo el modelo: no crea nada en Wix).
  var id2 = 'prueba-escaladas-nombre-' + Date.now();
  var t1 = askClaude('whatsapp', 'Prueba', 'Quiero reservar el sábado 17 de octubre a las 7pm para 2 personas, mi correo es prueba@rosanta.rest', id2);
  var t2 = askClaude('whatsapp', 'Prueba', 'Sí, a mi nombre', id2);
  var pregunta = /Prueba/.test(t1.respuesta || '') && (t1.lead || {}).accion !== 'crear_reserva';
  var crea = (t2.lead || {}).accion === 'crear_reserva' && /prueba/i.test((t2.lead || {}).nombre || '');
  console.log('— Nombre del perfil, 2 turnos\nturno 1: ' + t1.respuesta + '\nbotones: ' + JSON.stringify((t1.lead || {}).opciones) +
    '\nturno 2: ' + t2.respuesta + ' · accion: ' + (t2.lead || {}).accion + ' · nombre: ' + (t2.lead || {}).nombre +
    '\n' + (pregunta && crea ? 'OK' : 'FALLA'));
  if (pregunta && crea) ok++;
  console.log('RESULTADO: ' + ok + ' de ' + (casos.length + 1) + '. Modelo: ' + CONFIG.CLAUDE_MODEL);
}
