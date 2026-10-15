/**
 * ROSANTA · BOT — PRUEBA DEL MODELO (15-oct-2026)
 * Archivo aparte a propósito: al abrirlo en el editor, probarModeloBot queda
 * elegida sola en el menú de funciones. No envía nada a ningún cliente.
 */

// ============================================================
//  PRUEBA DEL MODELO — llama a Claude con 6 mensajes y NO envía nada a nadie.
//  Correr desde el editor y leer el registro de ejecución.
// ============================================================
function probarModeloBot() {
  var casos = [
    ['whatsapp', 'Hola, buenas tardes'],
    ['whatsapp', 'Quiero reservar para 4 personas este sábado a las 8 pm'],
    ['instagram', 'Hi! Do you have vegetarian options on the menu?'],
    ['whatsapp', 'Quiero cotizar una cena de cumpleaños para 30 personas el 20 de noviembre'],
    ['instagram', 'The food last night was cold and the waiter was rude'],
    ['messenger', 'I need to cancel my reservation for tomorrow']
  ];
  var ok = 0;
  casos.forEach(function (c, i) {
    var id = 'prueba-modelo-' + i + '-' + Date.now();
    var r = askClaude(c[0], 'Prueba', c[1], id);
    var lead = r.lead || {};
    var valido = !!(r.respuesta && lead.tipo && lead.accion && lead.idioma);
    if (valido) ok++;
    console.log('— ' + (i + 1) + '. [' + c[0] + '] ' + c[1] +
      '\nmodelo: ' + (r._modelo || '(respaldo, no respondió el modelo)') +
      '\nrespuesta: ' + r.respuesta +
      '\nlead: ' + JSON.stringify(lead) +
      '\nbotones si estuvieran encendidos: ' + JSON.stringify(btOpcionesModelo_(lead.opciones, lead.idioma).map(function (b) { return b.titulo; })) +
      '\n' + (valido ? 'OK' : 'FALLA: JSON incompleto'));
  });
  console.log('RESULTADO: ' + ok + ' de ' + casos.length + ' con JSON válido. Modelo configurado: ' + CONFIG.CLAUDE_MODEL);
}
