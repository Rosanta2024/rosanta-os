/**
 * Code.gs - Punto de entrada de la web app.
 */

function doGet(e) {
  // ?u=<token> identifica a quien entra con Gmail personal (ver Config.gs).
  // Sin ?u=, todo funciona igual que antes: login por correo del dominio.
  const authToken = (e && e.parameter && e.parameter.u) || '';
  let usuario;
  try {
    usuario = authToken ? getUsuarioPorToken_(authToken) : getUsuarioActual();
  } catch (err) {
    // CONFIG_SHEET_ID aun no configurado: modo instalacion
    return HtmlService.createHtmlOutput(
      '<p style="font-family:Georgia,serif;padding:2rem;">Falta configurar CONFIG_SHEET_ID en Config.gs</p>'
    );
  }

  if (!usuario) {
    return render_('Denied', { titulo: 'Acceso' });
  }

  let pagina = (e && e.parameter && e.parameter.page) || 'inicio';
  const urlBase = ScriptApp.getService().getUrl();

  // Quien tiene un solo modulo (Daniel, Vanessa) entra directo a Marketing OS.
  // Asi su enlace lleva un unico parametro (?u=token): sin & que se pueda
  // perder al navegar, sin panel intermedio y sin el iframe del shell, que
  // depende de cookies de terceros y Chrome ya las esta retirando.
  const mods = (usuario.modulos || []).filter(function (m) { return String(m || '').trim(); });
  if (pagina === 'inicio' && mods.length === 1 &&
      (mods[0] === 'marketing' || mods[0] === 'contenido')) {
    pagina = 'marketing-os';
  }

  if (pagina === 'recetario' && usuarioTieneModulo(usuario, 'recetario')) {
    return render_('RecetarioVista', { usuario: usuario, urlBase: urlBase, authToken: authToken });
  }

  // ---- Sistema de Marketing: shell con panel lateral (Marketing OS / Reseñas / CRM / Consola).
  // El módulo "contenido" (equipo de producción) también entra: su shell solo
  // muestra Marketing OS, y adentro Marketing.html recorta los tabs (esFull).
  if (pagina === 'marketing' && (usuarioTieneModulo(usuario, 'marketing') || usuarioTieneModulo(usuario, 'contenido'))) {
    var sub = (e && e.parameter && e.parameter.sub) || 'os';
    if (['os', 'resenas', 'crm', 'consola'].indexOf(sub) === -1) sub = 'os'; // ?sub= viene del usuario
    // Sin el módulo, el sub no se abre aunque lo escriban a mano en la URL.
    if (sub === 'resenas' && !usuarioTieneModulo(usuario, 'resenas')) sub = 'os';
    if (sub === 'crm' && !usuarioTieneModulo(usuario, 'crm')) sub = 'os';
    if (sub === 'consola' && !usuarioTieneModulo(usuario, 'consola')) sub = 'os';
    return render_('SistemaMarketing', {
      usuario: usuario, urlBase: urlBase, sub: sub, authToken: authToken,
      resenasUrl: CONFIG.RESENAS_URL, consolaUrl: CONFIG.CONSOLA_URL
    });
  }

  // Marketing OS va como página completa y no dentro del shell porque es un
  // documento con su propio <nav> y sus clases .tab: incrustado, sus selectores
  // chocarían con los de la intranet. El shell lo embebe en un iframe.
  if (pagina === 'marketing-os' && (usuarioTieneModulo(usuario, 'marketing') || usuarioTieneModulo(usuario, 'contenido'))) {
    var tplMkt = HtmlService.createTemplateFromFile('Marketing');
    tplMkt.urlBase = urlBase; // para el boton "Panel principal"
    // Vista completa solo con módulo marketing; "contenido" ve Calendario,
    // Creador, Checklist y Manual.
    tplMkt.esFull = usuarioTieneModulo(usuario, 'marketing');
    tplMkt.authToken = authToken;
    // Con un solo modulo no hay a donde volver: el boton sobra.
    tplMkt.mostrarVolver = mods.length > 1;
    // La pestana Datos expone la Sheet y los botones de sincronizacion:
    // solo para cuentas de la casa, no para invitados con Gmail.
    tplMkt.esDatos = String(usuario.email || '').indexOf('@rosanta.rest') > -1;
    return tplMkt.evaluate()
      .setTitle('Marketing OS · Rosanta')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Diagnóstico de Meta en el navegador: evita el editor de Apps Script y su
  // cache. Muestra el JSON crudo de /insights y /campaigns y la fila ya mapeada.
  if (pagina === 'diag' && usuarioTieneModulo(usuario, 'marketing')) {
    var diag;
    try {
      diag = metaDiagnosticoJson();
    } catch (errDiag) {
      diag = { ok: false, error: String(errDiag && errDiag.message || errDiag) };
    }
    try {
      diag.propiedades = propsDiagnostico();
    } catch (errProps) {
      diag.propiedades = { error: String(errProps && errProps.message || errProps) };
    }
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<body style="font-family:ui-monospace,Menlo,monospace;background:#1A1A1A;color:#e8e4da;padding:1.5rem">' +
      '<p style="font-family:Georgia,serif;color:#4CAF7D;font-size:1.1rem;margin:0 0 1rem">' +
      'Diagnóstico Meta · ' + new Date().toLocaleString('es-GT') + '</p>' +
      '<pre style="white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.5">' +
      JSON.stringify(diag, null, 2)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</pre></body>'
    ).setTitle('Diagnóstico Meta');
  }

  // Vista CRM: contactos de la maestra arriba, conversación del bot abajo.
  if (pagina === 'crm' && usuarioTieneModulo(usuario, 'crm')) {
    return render_('CrmVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, consolaUrl: CONFIG.CONSOLA_URL
    }).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.usuario = usuario;
  tpl.urlBase = urlBase;
  tpl.authToken = authToken;
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
