/**
 * ROSANTA · BOT — UNA SOLA VEZ (15-oct-2026): cambia en la base de conocimiento
 * el bloque "Formatos de evento" de la Lista 2026 por la Lista 2027
 * (rosanta-cotizador/PRECIOS.md, revisado por revisor-marca).
 * Archivo aparte para que al abrirlo quede elegida esta función. Se archiva
 * después de correrla. El Doc guarda historial de versiones (Archivo › Historial).
 */
function precios2027EnBaseDelBot() {
  var body = DocumentApp.openById(CONFIG.KB_DOC_ID).getBody();
  var n = body.getNumChildren();
  var ini = -1, fin = -1;
  for (var i = 0; i < n; i++) {
    var c = body.getChild(i);
    var t = typeof c.getText === 'function' ? String(c.getText()) : '';
    if (ini < 0 && /Formatos de evento \(para el Paso 2\)/.test(t)) ini = i;
    if (ini >= 0 && fin < 0 && i > ini && /Tarjetas de regalo/.test(t)) fin = i;
  }
  if (ini < 0 || fin < 0) throw new Error('No encontré el bloque (inicio ' + ini + ', fin ' + fin + '). No se cambió nada.');
  var viejo = [];
  for (var j = ini; j < fin; j++) viejo.push(String(body.getChild(j).getText()));
  var txtViejo = viejo.join('\n');
  if (fin - ini > 40 || txtViejo.indexOf('Q320') < 0 || txtViejo.indexOf('Q375') < 0) {
    throw new Error('El bloque no es el esperado (' + (fin - ini) + ' párrafos). No se cambió nada.\n' + txtViejo);
  }
  console.log('SE QUITA (' + (fin - ini) + ' párrafos):\n' + txtViejo);

  var nuevo = [
    ['h', 'Formatos de evento (para el paso del menú)'],
    ['li', 'Hay tres formatos. Los precios son "desde" (el mínimo) y suben según el menú. La cotización exacta la arma Juanma y le llega al cliente por correo.'],
    ['li', 'Presenta primero los formatos 1 y 2. El formato 3 (tapas y barra libre) va solo si el cliente pide algo de pie, tapas o barra libre.'],
    ['li', 'Cada evento incluye 3 horas de servicio en el espacio.'],
    ['li', 'Sobre comida y bebidas se suma el 15% de servicio. El alquiler del espacio no paga servicio.'],
    ['li', 'Alquiler del espacio: va incluido si son más de 25 personas o si el consumo es de Q15,000 o más (antes del servicio). Si son 25 personas o menos y el consumo es menor, el alquiler cuesta Q2,500 de viernes a domingo y Q1,500 de lunes a jueves.'],
    ['b', 'IMPORTANTE:'],
    ['li', 'Bebidas en los formatos 1 y 2: son un cargo aparte. El paquete de bebidas cuesta Q165 por persona e incluye un mocktail de bienvenida y 2 bebidas con alcohol (coctel de la casa, vino o cerveza). Mencionalo siempre, junto con el 15% de servicio, para no dar un precio engañoso.'],
    ['li', 'Entrantes del formato Para Compartir: son platos al centro. Cuestan Q185 por PLATO, a razón de 1 plato por cada 2 personas (con un número impar se redondea hacia arriba). NUNCA los des como precio por persona.'],
    ['b', '1. Menú para Eventos (servido, individual, tres tiempos)'],
    ['li', 'Comida desde Q345 por persona con el menú de pollo o el vegetariano. Lomito o pescetariano: Q375 por persona.'],
    ['li', 'Incluye entrante, plato fuerte y postre.'],
    ['li', 'Bebidas aparte: Q165 por persona.'],
    ['li', 'Comida + bebidas: pollo o vegetariano desde Q510 por persona (Q586.50 con el 15% de servicio); lomito o pescetariano Q540 (Q621 con servicio).'],
    ['b', '2. Menú para Compartir (estilo Rosanta, entre familia y amigos)'],
    ['li', 'Plato fuerte a escoger: Muslos de pollo a la naranja (Q225 por persona) o Lomito en salsa de puerros (Q245 por persona). Con postre: Q290 el pollo y Q310 el lomito.'],
    ['li', 'Entrantes para compartir al centro: Q185 por PLATO, 1 plato por cada 2 personas.'],
    ['li', 'Bebidas aparte: Q165 por persona.'],
    ['li', 'Comida + bebidas: con pollo desde Q482.50 por persona (Q554.88 con el 15% de servicio); con lomito Q502.50 (Q577.88 con servicio).'],
    ['b', '3. Tapas Guatemaltecas & Barra Libre'],
    ['li', 'Combo Q415 por persona (Q477.25 con el 15% de servicio): Tapas Guatemaltecas (6 piezas) más Barra Libre (cocteles de la casa, vino y cerveza, ilimitado durante las 3 horas del evento). Aquí las bebidas ya van incluidas.'],
    ['li', 'Por separado: solo tapas Q165 o solo Barra Libre Q250 por persona.'],
    ['b', 'Otras opciones de bebidas (solo si el cliente pregunta):'],
    ['li', 'Sin alcohol (mocktails y refrescos naturales): Q110 por persona.'],
    ['li', 'Barra Libre con cualquier menú: Q250 por persona, en lugar del paquete de Q165.'],
    ['p', '']
  ];

  // Se inserta primero y se borra después, para que el Doc nunca quede sin el bloque.
  var pos = ini;
  nuevo.forEach(function (x) {
    var el;
    if (x[0] === 'li') {
      el = body.insertListItem(pos, x[1]).setGlyphType(DocumentApp.GlyphType.BULLET);
    } else {
      el = body.insertParagraph(pos, x[1]);
      el.setHeading(x[0] === 'h' ? DocumentApp.ParagraphHeading.HEADING3 : DocumentApp.ParagraphHeading.NORMAL);
    }
    el.editAsText().setBold(x[0] === 'h' || x[0] === 'b');
    pos++;
  });
  for (var k = 0; k < fin - ini; k++) body.removeChild(body.getChild(pos));

  CacheService.getScriptCache().remove('kb');   // el bot lee la base nueva en el siguiente mensaje
  var check = body.getText();
  console.log('LISTO. Quedan Q345: ' + (check.indexOf('Q345') >= 0) + ' · Q320: ' + (check.indexOf('Q320') >= 0) +
    ' · Q470: ' + (check.indexOf('Q470') >= 0) + ' · Tarjetas de regalo: ' + (check.indexOf('Tarjetas de regalo') >= 0));
}
