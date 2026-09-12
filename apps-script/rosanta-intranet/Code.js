/**
 * Code.gs - Punto de entrada de la web app.
 */

function doGet(e) {
  // ?u=<token> identifica a quien entra con Gmail personal (ver Config.gs).
  // Sin ?u=, todo funciona igual que antes: login por correo del dominio.
  let authToken = (e && e.parameter && e.parameter.u) || '';
  let pagina = (e && e.parameter && e.parameter.page) || 'inicio';

  // RESCATE DE ENLACES VIEJOS (10-sep-2026)
  // Hasta la Version 69 las seis tarjetas del panel imprimian la query con el
  // scriptlet que escapa, y dentro de un href el escapado contextual codifica
  // los reservados: "&u=" viajaba como "%26u%3d". Google entrega entonces UN
  // solo parametro "page" con el token adentro ("costeo&u=<token>") y ningun
  // "u". Sin token la sesion cae en getUsuarioActual(), que para un Gmail
  // personal devuelve null, y la respuesta es Denied: fue lo que le paso a
  // Jeffry. La plantilla ya esta corregida, pero esos enlaces estan repartidos
  // por WhatsApp y no hay forma de retirarlos. Asi que en vez de cerrarles la
  // puerta, aca se desarma el parametro y se recupera el token.
  if (pagina.indexOf('&') > -1) {
    var trozos = pagina.split('&');
    pagina = trozos.shift();
    for (var t = 0; t < trozos.length; t++) {
      var par = trozos[t].split('=');
      if (par[0] === 'u' && !authToken) authToken = String(par[1] || '').trim();
    }
  }

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
    // La puerta cerrada decia solo "tu cuenta no tiene acceso". El 10-sep-2026
    // eso nos costo medio dia: el mismo cartel sale por tres causas distintas
    // (enlace sin token, token que ya no esta en la hoja, y sesion de dominio
    // sin fila en USUARIOS) y desde afuera no se distinguen. Ahora la pagina
    // dice cual de las tres fue y con que cuenta de Google llego la visita, que
    // es lo primero que preguntamos siempre.
    var correoSesion = '';
    try { correoSesion = Session.getActiveUser().getEmail() || ''; } catch (err2) { correoSesion = ''; }
    return render_('Denied', {
      titulo: 'Acceso',
      motivo: authToken ? 'token-desconocido' : 'sin-token',
      correoSesion: correoSesion
    });
  }

  // De aca salen los tres enlaces de la intranet. Ver urlIntranet_() en Config.gs:
  // getUrl() devolvia el despliegue de pruebas y todo enlace interno contestaba
  // "You need access".
  const urlBase = urlIntranet_();

  // Quien tiene un solo modulo (Daniel, Vanessa) entra directo a Marketing OS.
  // Asi su enlace lleva un unico parametro (?u=token): sin & que se pueda
  // perder al navegar, sin panel intermedio y sin el iframe del shell, que
  // depende de cookies de terceros y Chrome ya las esta retirando.
  const mods = (usuario.modulos || []).filter(function (m) { return String(m || '').trim(); });
  if (pagina === 'inicio' && mods.length === 1 &&
      (mods[0] === 'marketing' || mods[0] === 'contenido')) {
    pagina = 'marketing-os';
  }

  // Recetario visual + Proveedores. Reemplaza a la vista vieja ?page=recetario,
  // retirada el 21 ago 2026: definia leerFicha_ y primerNumero_ con los mismos
  // nombres que el modulo de costeo y, como los .gs comparten un solo ambito
  // global, pisaba las funciones nuevas. Sigue usando el modulo 'recetario':
  // el chef entra, contenido no. Los datos los pide por google.script.run
  // (getCosteoData, getHistorialPrecios, registrarPrecio, getReporteHigiene);
  // los unicos scriptlets son urlBase y authToken, para el boton de volver al
  // panel — hasta el 27-ago-2026 CosteoVista era la unica vista de modulo sin el.
  if (pagina === 'costeo' && usuarioTieneModulo(usuario, 'recetario')) {
    var tplCosteo = HtmlService.createTemplateFromFile('CosteoVista');
    tplCosteo.urlBase = urlBase;      // para el boton "Panel principal"
    tplCosteo.authToken = authToken;
    return tplCosteo.evaluate()
      .setTitle('Rosanta \u00b7 Recetario y Proveedores')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

  // Bateria de pruebas de la intranet. Solo direccion: el resultado trae nombres de
  // documentos y correos del equipo. La pagina se pinta al instante y pide los datos
  // por google.script.run, para no dejar el navegador colgado mientras corre.
  if (pagina === 'pruebas' && String(usuario.rol || '').toLowerCase() === 'dueno') {
    var tplPruebas = HtmlService.createTemplateFromFile('PruebasVista');
    tplPruebas.urlBase = urlBase;
    tplPruebas.authToken = authToken;
    return tplPruebas.evaluate()
      .setTitle('Pruebas \u00b7 Rosanta Intranet')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Vista CRM: contactos de la maestra arriba, conversación del bot abajo.
  if (pagina === 'crm' && usuarioTieneModulo(usuario, 'crm')) {
    return render_('CrmVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, consolaUrl: CONFIG.CONSOLA_URL
    }).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ---- Finanzas & Data: shell con panel lateral (Semana / Metas / 2026 contra 2025).
  // Hasta el 12-sep-2026 estas tres pantallas eran tres tarjetas sueltas del panel
  // principal, con el mismo permiso ('finanzas') y del mismo pilar: el panel mezclaba
  // pilares con vistas de adentro y crecia una tarjeta por pantalla nueva. Ahora es
  // una puerta, igual que Marketing.
  if (pagina === 'finanzas' && usuarioTieneModulo(usuario, 'finanzas')) {
    var subFin = (e && e.parameter && e.parameter.sub) || 'semana';
    // El ?sub= lo escribe quien quiera: si no es uno de los tres, abre el primero.
    if (['semana', 'metas', 'comparativo', 'escenarios'].indexOf(subFin) === -1) subFin = 'semana';
    return render_('SistemaFinanzas', {
      usuario: usuario, urlBase: urlBase, sub: subFin, authToken: authToken
    });
  }

  // Las tres de adentro. Cada una sigue teniendo su enlace directo —el de Metas anda
  // circulando por el equipo y no se rompe— y las tres se dejan embeber, que es lo
  // que el shell necesita. Con ?embed=1 esconden su boton "Panel principal": dentro
  // del shell ese boton se saltaba el lateral y sacaba al usuario de la seccion.
  var embebida = !!(e && e.parameter && e.parameter.embed);

  // Pantalla de Finanzas: analisis y estructura de costo. Solo lectura de
  // punta a punta; no captura nada. Las acciones no viven aqui.
  if (pagina === 'finanzas-semana' && usuarioTieneModulo(usuario, 'finanzas')) {
    return render_('FinanzasVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, mostrarVolver: !embebida
    }).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Metas de la semana: el panel de ritmo. Pocos numeros, para el equipo.
  // La meta se edita en la pestana METAS del Sheet de config, no aqui.
  if (pagina === 'metas' && usuarioTieneModulo(usuario, 'finanzas')) {
    return render_('MetasVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, mostrarVolver: !embebida
    }).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Comparativo contra el año pasado. Solo lectura, como todo lo de finanzas.
  if (pagina === 'comparativo' && usuarioTieneModulo(usuario, 'finanzas')) {
    return render_('ComparativoVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, mostrarVolver: !embebida
    }).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Escenarios y punto de equilibrio: lo unico del pilar que no reporta lo que
  // paso sino que modela lo que pasaria. Entro el 12-sep-2026 al unificar el
  // pilar en la intranet: era el artefacto rosanta-dre-mensual, que vivia fuera
  // y se alimentaba de un JSON que alguien tenia que generar a mano con Python.
  // Lee lo mismo que la pantalla de la semana, asi que no hay un segundo motor
  // que se pueda desincronizar.
  if (pagina === 'escenarios' && usuarioTieneModulo(usuario, 'finanzas')) {
    return render_('EscenariosVista', {
      usuario: usuario, urlBase: urlBase, authToken: authToken, mostrarVolver: !embebida
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

/**
 * Permite incluir parciales html: <?!= include('Estilos') ?>
 *
 * Lee el archivo CRUDO. Eso significa que un include escrito DENTRO de un parcial
 * no se resuelve: se imprimiria literal en la pagina. Por eso Logo.html se pide
 * desde cada vista y no desde Estilos.html.
 *
 * Se probo evaluar el parcial (createTemplateFromFile().evaluate()) para permitir
 * el anidado, y el 30-ago-2026 reventó con "evaluate is not a function". No vale
 * la pena: el anidado no hace falta si cada vista declara lo que usa, y asi se lee
 * de un vistazo que parciales entran en cada pagina.
 *
 * Los parciales no reciben variables: si alguno necesita una, va como plantilla
 * propia desde render_(), no por aca.
 */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/**
 * Pega un parcial TAL CUAL, sin sanitizar: <?!= incluirCrudo_('CosteoJs_Base') ?>
 *
 * Existe aparte de include() por una sola razon, y es la que importa:
 * createHtmlOutputFromFile SANITIZA. Sobre CosteoVista devolvia 108.722 de los
 * 121.691 caracteres del archivo, sin avisar y sin error. Para un parcial de
 * estilo o de logo da igual; para un parcial que es JavaScript significa que el
 * navegador recibe codigo cortado a la mitad.
 *
 * getRawContent() devuelve el texto exacto del archivo.
 *
 * Lleva guion bajo A PROPOSITO, al reves que include(): devuelve el codigo fuente
 * de cualquier archivo del proyecto, y una funcion sin guion bajo la puede llamar
 * cualquiera con google.script.run. Con guion bajo sigue sirviendo desde la
 * plantilla —los scriptlets corren del lado del servidor— y desde el navegador no
 * se alcanza.
 *
 * La contrapartida de leer crudo es que el parcial NO se evalua: los scriptlets
 * <?= ?> que traiga se imprimirian literales. Por eso los CosteoJs_* no llevan ninguno y la unica variable que
 * necesitan —AUTH— se declara en CosteoVista.html antes de incluirlos.
 */
function incluirCrudo_(nombre) {
  return HtmlService.createTemplateFromFile(nombre).getRawContent();
}
