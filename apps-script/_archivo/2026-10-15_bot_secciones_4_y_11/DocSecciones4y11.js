/**
 * ROSANTA · BOT — UNA SOLA VEZ (15-oct-2026): corrige en la base de conocimiento
 * las secciones 4 (reservas) y 11 (qué no hace), que decían que el bot no toma
 * reservas. Si algún texto viejo no aparece exactamente una vez, no cambia nada.
 * El Doc guarda historial de versiones. Se archiva después de correrla.
 */
function corregirSecciones4y11() {
  var cambios = [
    { buscar: 'el bot NO las toma por chat',
      etiqueta: 'Reservas de mesa:',
      nuevo: ' el bot las toma por chat (hasta 15 personas) con nombre, correo, fecha, hora y número de personas, y quedan creadas en el sistema de reservas. Si el cliente prefiere hacerlo solo, comparte el link en su idioma.' },
    { buscar: 'Se definirá el flujo por separado más adelante',
      etiqueta: 'Solicitudes de eventos:',
      nuevo: ' se tratan aparte (ver sección 7).' },
    { buscar: 'el bot comparte el link según idioma',
      etiqueta: 'Si el cliente prefiere reservar solo:',
      nuevo: ' el bot comparte el link según idioma:' },
    { buscar: 'para crear/cambiar, usar el link',
      etiqueta: 'Cambiar o cancelar una reserva:',
      nuevo: ' el bot lo hace por chat. Para cambiarla, la cancela y toma la nueva.' },
    { buscar: 'te confirmo en breve',
      etiqueta: '',
      nuevo: 'No confirma reservas como definitivas: el sistema las confirma. Cuando pasa a una persona, usa la frase de paso a persona (Juanma, con el plazo).' }
  ];
  var body = DocumentApp.openById(CONFIG.KB_DOC_ID).getBody();
  var n = body.getNumChildren(), hallados = [];
  cambios.forEach(function (c) {
    var idx = [];
    for (var i = 0; i < n; i++) {
      var el = body.getChild(i);
      if (typeof el.getText === 'function' && String(el.getText()).indexOf(c.buscar) >= 0) idx.push(i);
    }
    if (idx.length !== 1) throw new Error('"' + c.buscar + '" aparece ' + idx.length + ' veces. No se cambió nada.');
    hallados.push(idx[0]);
  });
  cambios.forEach(function (c, k) {
    var el = body.getChild(hallados[k]);
    console.log('ANTES: ' + el.getText());
    var t = el.editAsText();
    t.setText(c.etiqueta + c.nuevo);
    t.setBold(false);
    if (c.etiqueta) t.setBold(0, c.etiqueta.length - 1, true);
    console.log('AHORA: ' + el.getText());
  });
  CacheService.getScriptCache().remove('kb');
  var txt = body.getText();
  console.log('LISTO. Queda "NO las toma": ' + (txt.indexOf('NO las toma') >= 0) + ' · "en breve": ' + (txt.indexOf('en breve') >= 0));
}
