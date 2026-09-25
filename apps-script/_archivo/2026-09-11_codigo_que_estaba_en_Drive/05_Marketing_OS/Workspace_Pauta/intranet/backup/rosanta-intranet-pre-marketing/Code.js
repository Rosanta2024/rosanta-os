/**
 * Code.gs - Punto de entrada de la web app.
 */

function doGet(e) {
  let usuario;
  try {
    usuario = getUsuarioActual();
  } catch (err) {
    // CONFIG_SHEET_ID aun no configurado: modo instalacion
    return HtmlService.createHtmlOutput(
      '<p style="font-family:Georgia,serif;padding:2rem;">Falta configurar CONFIG_SHEET_ID en Config.gs</p>'
    );
  }

  if (!usuario) {
    return render_('Denied', { titulo: 'Acceso' });
  }

  const pagina = (e && e.parameter && e.parameter.page) || 'inicio';
  const urlBase = ScriptApp.getService().getUrl();

  if (pagina === 'recetario' && usuarioTieneModulo(usuario, 'recetario')) {
    return render_('RecetarioVista', { usuario: usuario, urlBase: urlBase });
  }

  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.usuario = usuario;
  tpl.urlBase = urlBase;
  return tpl.evaluate()
    .setTitle('Rosanta Intranet')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function render_(nombre, datos) {
  const tpl = HtmlService.createTemplateFromFile(nombre);
  Object.keys(datos || {}).forEach(function (k) { tpl[k] = datos[k]; });
  return tpl.evaluate()
    .setTitle('Rosanta Intranet')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Permite incluir parciales html: <?!= include('Estilos') ?> */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
