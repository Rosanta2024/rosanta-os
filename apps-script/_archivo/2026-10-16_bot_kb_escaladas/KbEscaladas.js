/**
 * ROSANTA · BOT — CAMBIO DE UNA VEZ EN LA BASE DE CONOCIMIENTO (16-oct-2026)
 * Archivo aparte a propósito: al abrirlo en el editor, kbEscaladas queda elegida sola.
 * Textos revisados por revisor-marca (16-oct). Revisa TODO antes de tocar nada: si
 * algún texto viejo no aparece exactamente una vez, no cambia nada y lo dice.
 * Se puede correr dos veces: lo que ya está hecho se salta. Después se archiva.
 */
function kbEscaladas() {
  var doc = DocumentApp.openById(CONFIG.KB_DOC_ID);
  var body = doc.getBody();
  var texto = body.getText();
  var cambios = [
    { viejo: 'Cambiar o cancelar una reserva:', nuevo: 'Cambiar, cancelar o consultar una reserva:' },
    { viejo: 'el bot lo hace por chat. Para cambiarla, la cancela y toma la nueva.',
      nuevo: 'el bot lo hace por chat. Para cambiarla, la mueve en un solo paso: si la hora nueva no tiene lugar, la reserva actual sigue igual. Si el cliente solo pregunta a qué hora o para qué día era su reserva, el bot la busca y se la dice, sin cambiar nada.' }
  ];
  var instrViejo = '(Instrucción para el bot: cuando el cliente mande el comprobante, marca requiere_humano:true para que el equipo confirme.)';
  var fotos = 'Fotos y video: si el cliente quiere ver cómo queda la decoración, comparte este video de la Cena Romántica: https://drive.google.com/file/d/1Yd4f33KZc7t4fTYToi45NrISoFX1sO5I/view. También puedes mandarlo al Instagram @rosanta.rest. No mandes al cliente a buscar fotos en el sitio web.';
  var instrNuevo = '(Instrucción para el bot: pide la foto del comprobante UNA sola vez. Cuando el cliente diga que ya transfirió o mande el comprobante, no lo vuelvas a pedir: dile que Juanma revisa la transferencia y le confirma, y marca requiere_humano:true. Nunca des un pago por recibido.)';

  var veces = function (t) { return texto.split(t).length - 1; };
  var pendientes = cambios.filter(function (c) { return veces(c.nuevo) === 0; });
  var problemas = [];
  pendientes.forEach(function (c) { if (veces(c.viejo) !== 1) problemas.push('"' + c.viejo + '" aparece ' + veces(c.viejo) + ' veces'); });
  var hacerRomantica = veces(fotos) === 0;
  if (hacerRomantica && veces(instrViejo) !== 1) problemas.push('la instrucción vieja de la Cena Romántica aparece ' + veces(instrViejo) + ' veces');
  if (problemas.length) { console.log('NO SE CAMBIÓ NADA. ' + problemas.join(' · ')); return; }

  var esc = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  pendientes.forEach(function (c) { body.replaceText(esc(c.viejo), c.nuevo); });
  if (hacerRomantica) {
    var par = body.findText(esc(instrViejo)).getElement().getParent();
    par = par.getType() === DocumentApp.ElementType.LIST_ITEM ? par.asListItem() : par.asParagraph();
    var i = body.getChildIndex(par);
    par.setText(fotos);
    body.insertParagraph(i + 1, instrNuevo);
  }
  doc.saveAndClose();
  CacheService.getScriptCache().remove('kb');   // el bot lee la base nueva en el acto

  var final = DocumentApp.openById(CONFIG.KB_DOC_ID).getBody().getText();
  var ok = [cambios[1].nuevo, fotos, instrNuevo].every(function (t) { return final.indexOf(t) >= 0; }) && final.indexOf(instrViejo) < 0;
  console.log((ok ? 'LISTO: ' : 'REVISAR: ') + pendientes.length + ' cambios en Reservas, Cena Romántica ' +
    (hacerRomantica ? 'actualizada' : 'ya estaba') + '. Verificado leyendo el Doc: ' + (ok ? 'sí' : 'NO'));
}
