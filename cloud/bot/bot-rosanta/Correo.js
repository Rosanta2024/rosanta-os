/**
 * ROSANTA · BOT — CORREOS DE CLIENTES Y CHAT DE WIX (OpenWidget) (15-oct-2026)
 * Archivo ADITIVO. Prefijo correo.
 *
 * Decisión de Juanma (15-oct-2026): el bot atiende los correos con la etiqueta
 * "01-CLIENTES (Reservas)" (los filtros de Gmail ya la ponen, incluido el chat de
 * Wix que llega de noreply@openwidget.com), pero la respuesta queda como BORRADOR
 * en Gmail: Juanma la revisa y la envía. Reservas: el bot sí crea, cambia o cancela
 * en Wix lo que el cliente pide (igual que en WhatsApp); el borrador lo confirma.
 * Excepción (Juanma, 15-oct-2026): si el cliente pidió CAMBIAR o CANCELAR y quedó hecho en Wix, se le
 * contesta solo en el mismo hilo con el correo revisado por marca, sin borrador.
 *
 * Cada 5 minutos (activador que crea correoEncender):
 *   - solo mensajes posteriores al encendido (CORREO_DESDE), nunca el histórico
 *   - sin la subetiqueta Cotizaciones (eso lo lleva Juanma a mano)
 *   - si el último mensaje del hilo es de Rosanta, Juanma ya contestó: no se toca
 */

// 17-oct-2026 (Juanma): además de la etiqueta, todo lo de la bandeja Principal. El filtro de Gmail solo etiqueta
// respuestas a la confirmación de Wix y el formulario de la web: Elan y Jenni llegaron sin etiqueta y nadie los leyó.
var CORREO_BUSQUEDA = '(label:01-clientes--reservas- OR (in:inbox category:primary)) -label:01-clientes--reservas--cotizaciones ' +
  '-from:rosanta.rest -from:wixsiteautomations.com -from:sat.gob.gt -from:notificacionesbi.com.gt -from:baccredomatic.gt ' +
  '-from:baccredomatic.com -from:posfile.com -from:econtrisa.com -from:google.com -from:paypal.com -from:mailer-daemon newer_than:2d';
var CORREO_SIN_CORREO_CLIENTE = false;   // mientras se atiende un correo, el bot no manda su propio correo de confirmación
var CORREO_AUTO = null;                  // cambio o cancelación hechos en Wix: se contestan solos (Juanma, 15-oct-2026)

/** EDITOR: enciende el canal (activador cada 5 min) desde este momento. */
function correoEncender() {
  correoApagar();
  PROPS.setProperty('CORREO_DESDE', String(Date.now()));
  ScriptApp.newTrigger('revisarCorreosClientes').timeBased().everyMinutes(5).create();
  console.log('Correo ENCENDIDO: cada 5 min, borradores para los correos nuevos desde ahora. Búsqueda: ' + CORREO_BUSQUEDA);
}
/** EDITOR: apaga el canal. */
function correoApagar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarCorreosClientes') ScriptApp.deleteTrigger(t);
  });
  console.log('Correo apagado.');
}

/**
 * 20-oct-2026 (día único del paso a la nube): antes de cada vuelta, el bot le pregunta a la nube quién atiende el correo.
 * 'nube' → se hace a un lado (no lee, no contesta, no avisa). Cualquier otra respuesta, o si la nube no contesta:
 * atiende como siempre. Volver atrás = poner el interruptor de la nube en 'apps' (un minuto, sin entrar al editor).
 * Si la nube no contesta se usa la última respuesta (10 min); sin ninguna, atiende el bot: mejor dos que ninguno.
 */
var CORREO_QUIEN_URL = 'https://rosanta-bot-sombra-512086396641.northamerica-south1.run.app/correo/quien';
function correoLoAtiendeLaNube_() {
  var cache = CacheService.getScriptCache();
  var modo = '';
  try {
    var r = UrlFetchApp.fetch(CORREO_QUIEN_URL, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() === 200) {
      modo = String((JSON.parse(r.getContentText() || '{}') || {}).modo || '');
      cache.put('correo_quien', modo || 'apps', 600);
    }
  } catch (e) { Logger.log('correo_quien: ' + e); }
  if (!modo) modo = cache.get('correo_quien') || 'apps';
  return modo === 'nube';
}

function revisarCorreosClientes() {
  var desde = Number(PROPS.getProperty('CORREO_DESDE') || 0);
  if (!desde) return;
  if (correoLoAtiendeLaNube_()) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var vistos = correoVistos_();
    GmailApp.search(CORREO_BUSQUEDA, 0, 30).forEach(function (hilo) {
      try { correoHilo_(hilo, desde, vistos); }
      catch (e) {
        Logger.log('correo hilo ' + hilo.getId() + ': ' + e);
        try { correoFalla_(hilo, e, vistos); } catch (e2) { Logger.log('correoFalla_: ' + e2); }
      }
    });
    correoGuardarVistos_(vistos);
    try { correoRed_(new Date()); } catch (e) { Logger.log('correoRed_: ' + e); }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 19-oct-2026 (Louise, pedido de Juanma: "asegúrate que esto no vuelve a pasar"):
 * un correo de cliente SOLO queda como visto cuando se le contestó solo, o cuando a Juanma le
 * llegó el aviso "🔔 Lead para atender" (borrador, pausa, falta un dato, falla de Wix o del bot).
 * Antes se marcaba visto al empezar: si algo fallaba a la mitad, el correo quedaba sin respuesta y sin aviso.
 */
function correoHilo_(hilo, desde, vistos) {
  var msgs = hilo.getMessages();
  var ultimo = msgs[msgs.length - 1];
  var id = ultimo.getId();
  if (vistos.indexOf(id) >= 0) return;
  var marcar = function () { if (vistos.indexOf(id) < 0) vistos.push(id); };
  if (ultimo.getDate().getTime() <= desde) { marcar(); return; }
  if (correoEsNuestro_(ultimo.getFrom())) { marcar(); return; }           // ya contestó Juanma

  var c = correoCliente_(ultimo);
  if (!c.email) {
    correoAvisar_(hilo, ultimo, c, null, 'El bot no pudo leer quién escribe. Contesta tú.');
    marcar(); return;
  }
  if (msgs.some(function (m) { return m.isDraft && m.isDraft(); })) {
    correoAvisar_(hilo, ultimo, c, null, 'El cliente escribió y en el hilo hay un borrador sin mandar. Revísalo y contesta tú.');
    marcar(); return;
  }
  if (botEnPausa(c.email)) {
    correoAvisar_(hilo, ultimo, c, null, 'El bot está en pausa con este cliente. Contesta tú.');
    marcar(); return;
  }

  logMensaje('correo', c.email, c.nombre, 'in', 'cliente', c.texto);
  CORREO_SIN_CORREO_CLIENTE = true;
  CORREO_AUTO = null;
  var result;
  try {
    result = btAtender_('correo', c.email, (c.nombre || '').split(' ')[0] || '', { texto: c.texto, log: c.texto, boton: null });
  } finally {
    CORREO_SIN_CORREO_CLIENTE = false;
  }
  var auto = CORREO_AUTO; CORREO_AUTO = null;
  var lead = (result && result.lead) || null;
  var cuerpo = auto ? auto.cuerpo : correoCuerpo_(result && result.respuesta);
  if (!cuerpo) {
    correoAvisar_(hilo, ultimo, c, lead, 'El bot no armó ninguna respuesta. Contesta tú.');
    marcar(); return;
  }
  // Desde que el bot lee toda la bandeja Principal (17-oct): a quien no es cliente no se le contesta ni se cuenta.
  var tipoCorreo = String((lead && lead.tipo) || '');
  if (!auto && !c.openwidget && (tipoCorreo === 'otro' || tipoCorreo === 'spam')) {
    Logger.log('correo de no cliente, sin borrador: ' + c.email + ' · ' + ((lead && lead.resumen) || ''));
    correoNoCliente_(hilo.getId());
    marcar(); return;
  }
  if (auto) {
    // Reserva creada, cambiada o cancelada en Wix: se contesta sin borrador, con el correo revisado por marca.
    if (c.openwidget) GmailApp.sendEmail(c.email, auto.asunto, cuerpo, { name: 'Rosanta' });
    else ultimo.reply(cuerpo, { name: 'Rosanta' });
    marcar();   // ya salió: aunque falle lo que sigue, no se vuelve a mandar
  } else {
    if (c.openwidget) GmailApp.createDraft(c.email, 'Re: tu mensaje a Rosanta', cuerpo, { name: 'Rosanta' });
    else ultimo.createDraftReply(cuerpo);
    // Borrador = en Wix no se hizo nada y el cliente NO tiene respuesta: Juanma se entera ya, como en WhatsApp.
    var esEvento = lead && (lead.tipo === 'evento' || lead.accion === 'escalar_evento');
    if (esEvento && lead.requiere_humano && !cotizacionEnviada_(c.email)) {
      notificarHumano('correo', lead, c.texto, c.email);   // trae el bloque para el pipeline
    } else {
      correoAvisar_(hilo, ultimo, c, lead, 'Te dejé un BORRADOR en Gmail: el cliente todavía no tiene respuesta. Revísalo y mándalo.');
    }
    marcar();
  }
  try {
    logMensaje('correo', c.email, c.nombre, 'out', 'bot', (auto ? '[Enviado solo: ' + auto.caso + '] ' : '[Borrador en Gmail] ') + cuerpo);
    logLead(lead, c.texto, c.email, cuerpo);
    fichaActualizar_('correo', c.email, c.nombre, lead);
  } catch (e) { Logger.log('correo registro ' + c.email + ': ' + e); }
}

/** Un hilo que falló: se reintenta en la próxima vuelta; a la tercera, aviso a Juanma y queda visto. */
var CORREO_MAX_FALLAS = 3;
function correoFalla_(hilo, err, vistos) {
  var msgs = hilo.getMessages();
  var ultimo = msgs[msgs.length - 1];
  var id = ultimo.getId();
  var fallas = {};
  try { fallas = JSON.parse(PROPS.getProperty('CORREO_FALLAS') || '{}'); } catch (e) { fallas = {}; }
  fallas[id] = (fallas[id] || 0) + 1;
  if (fallas[id] >= CORREO_MAX_FALLAS) {
    correoAvisar_(hilo, ultimo, correoCliente_(ultimo), null,
      'El bot falló ' + fallas[id] + ' veces con este correo (' + String(err).substring(0, 150) + '). El cliente NO tiene respuesta: contesta tú.');
    delete fallas[id];
    if (vistos.indexOf(id) < 0) vistos.push(id);
  }
  var claves = Object.keys(fallas);
  if (claves.length > 50) claves.slice(0, claves.length - 50).forEach(function (k) { delete fallas[k]; });
  PROPS.setProperty('CORREO_FALLAS', JSON.stringify(fallas));
}

/** El aviso "🔔 Lead para atender" de un correo, por WhatsApp y por correo, con el enlace al hilo. Uno por mensaje. */
function correoAvisar_(hilo, ultimo, c, lead, motivo) {
  var id = ultimo.getId();
  var avisados = correoLista_('CORREO_AVISADOS');
  if (avisados.indexOf(id) >= 0) return;
  c = c || {};
  var quien = (c.nombre ? c.nombre + ' ' : '') + '<' + (c.email || '?') + '>';
  var resumen = (lead && lead.resumen) || ultimo.getSubject() || 'Sin resumen';
  var enlace = 'https://mail.google.com/mail/u/0/#all/' + hilo.getId();
  var texto = String(c.texto || '').substring(0, 400);
  // El aviso sale antes de anotarse: si se cae a la mitad, se repite en la vuelta siguiente (mejor dos que ninguno).
  var salio = false;
  try {
    MailApp.sendEmail({
      to: 'restaurante@rosanta.rest',
      subject: '🔔 Lead para atender (correo) — ' + (c.email || ultimo.getSubject()),
      body: motivo + '\n\nDe: ' + quien + '\nAsunto: ' + ultimo.getSubject() + '\nResumen: ' + resumen +
        '\nMensaje del cliente: ' + texto + '\n\nAbrir el correo: ' + enlace
    });
    salio = true;
  } catch (e) { Logger.log('correoAvisar_ correo: ' + e); }
  try {
    var owner = PROPS.getProperty('OWNER_WA'), pid = PROPS.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) {
      sendWhatsApp(pid, owner, '🔔 Lead para atender (correo)\n' + motivo + '\n' + quien + '\n' + resumen +
        '\nCliente: ' + texto.substring(0, 250) + '\n👉 ' + enlace);
      salio = true;
    }
  } catch (e) { Logger.log('correoAvisar_ WhatsApp: ' + e); }
  if (!salio) throw new Error('no salió el aviso de correo a Juanma');
  avisados.push(id);
  PROPS.setProperty('CORREO_AVISADOS', JSON.stringify(avisados.slice(-300)));
}

function correoLista_(clave) {
  try { return JSON.parse(PROPS.getProperty(clave) || '[]'); } catch (e) { return []; }
}
/** Hilos que el bot clasificó como no clientes (proveedores, publicidad): la red de cada hora no los cuenta. */
function correoNoCliente_(hiloId) {
  var l = correoLista_('CORREO_NO_CLIENTE');
  if (l.indexOf(hiloId) < 0) l.push(hiloId);
  PROPS.setProperty('CORREO_NO_CLIENTE', JSON.stringify(l.slice(-300)));
}

function correoEsNuestro_(from) {
  return /rosanta\.rest/i.test(String(from || ''));
}

/** Quién escribe y qué dijo. El chat de Wix trae el correo del visitante en el cuerpo. */
function correoCliente_(m) {
  var from = String(m.getFrom() || '');
  var cuerpo = String(m.getPlainBody() || '');
  if (/openwidget\.com/i.test(from)) {
    var em = cuerpo.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
    return { email: em ? em[1].toLowerCase() : '', nombre: '', texto: correoLimpio_(cuerpo), openwidget: true };
  }
  var mm = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  return {
    email: (mm ? mm[2] : from).trim().toLowerCase(),
    nombre: mm ? mm[1].trim() : '',
    texto: correoLimpio_(cuerpo),
    openwidget: false
  };
}

/** Quita lo citado del correo anterior ("On ... wrote:", "El ... escribió:", líneas con >). */
function correoLimpio_(t) {
  t = String(t || '').replace(/\r/g, '');
  var corte = t.search(/\n\s*(On .{5,200}wrote:|El .{5,200}escribi[oó]:|-{2,}\s*Original Message|De: .+\n)/i);
  if (corte > 0) t = t.substring(0, corte);
  t = t.split('\n').filter(function (l) { return !/^\s*>/.test(l); }).join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim().substring(0, 3000);
}

/** El texto del bot pensado para WhatsApp, pasado a correo: sin asteriscos. */
function correoCuerpo_(t) {
  return String(t || '').replace(/\*([^*\n]+)\*/g, '$1').replace(/\*/g, '').trim();
}

function correoVistos_() {
  try { return JSON.parse(PROPS.getProperty('CORREO_VISTOS') || '[]'); } catch (e) { return []; }
}
function correoGuardarVistos_(v) {
  PROPS.setProperty('CORREO_VISTOS', JSON.stringify(v.slice(-300)));
}

/**
 * RED DE SEGURIDAD (19-oct-2026, pedido de Juanma tras Louise). Una vez por hora, de 8:00 a 21:00, dentro del
 * mismo activador de cada 5 min (no hace falta crear otro): busca correos de clientes —reservas y también
 * eventos (Cotizaciones)— cuyo último mensaje es del cliente hace más de 2 horas, y le avisa a Juanma por
 * WhatsApp y por correo. Cada mensaje se avisa una sola vez. No cuenta proveedores, SAT ni bancos (misma lista
 * que CORREO_BUSQUEDA) ni lo que el bot ya clasificó como no cliente.
 */
var CORREO_RED_BUSQUEDA = '(label:01-clientes--reservas- OR label:01-clientes--reservas--cotizaciones OR (in:inbox category:primary)) ' +
  CORREO_BUSQUEDA.replace(/^.*?-label:01-clientes--reservas--cotizaciones /, '').replace('newer_than:2d', 'newer_than:4d');
var CORREO_RED_HORAS = 2;
var CORREO_RED_DIAS = 3;

function correoRed_(ahora) {
  var tz = 'America/Guatemala';
  var hora = Number(Utilities.formatDate(ahora, tz, 'H')), min = Number(Utilities.formatDate(ahora, tz, 'm'));
  if (hora < 8 || hora > 21 || (hora === 21 && min > 5)) return null;   // de 8:00 a 21:00
  var ultima = Number(PROPS.getProperty('CORREO_RED_ULTIMA') || 0);
  if (ahora.getTime() - ultima < 55 * 60000) return null;
  PROPS.setProperty('CORREO_RED_ULTIMA', String(ahora.getTime()));

  var noCliente = correoLista_('CORREO_NO_CLIENTE');
  var avisados = correoLista_('CORREO_RED_AVISADOS');
  var pendientes = [];
  GmailApp.search(CORREO_RED_BUSQUEDA, 0, 60).forEach(function (hilo) {
    if (noCliente.indexOf(hilo.getId()) >= 0) return;
    var reales = hilo.getMessages().filter(function (m) { return !(m.isDraft && m.isDraft()); });
    if (!reales.length) return;
    var u = reales[reales.length - 1];
    if (correoEsNuestro_(u.getFrom())) return;
    var edad = ahora.getTime() - u.getDate().getTime();
    if (edad < CORREO_RED_HORAS * 3600000 || edad > CORREO_RED_DIAS * 86400000) return;
    if (avisados.indexOf(u.getId()) >= 0) return;
    var c = correoCliente_(u);
    pendientes.push({ id: u.getId(), hilo: hilo.getId(), quien: c.nombre || c.email || u.getFrom(), asunto: u.getSubject(),
      horas: Math.floor(edad / 3600000), borrador: reales.length < hilo.getMessages().length });
  });
  if (!pendientes.length) return [];

  var lineas = pendientes.map(function (p) {
    return '• ' + p.quien + ' — ' + p.asunto + ' (hace ' + p.horas + ' h' + (p.borrador ? ', hay borrador sin mandar' : '') + ')\n  https://mail.google.com/mail/u/0/#all/' + p.hilo;
  });
  var texto = '⏰ Correos de clientes sin respuesta hace más de ' + CORREO_RED_HORAS + ' h (' + pendientes.length + ')\n' + lineas.join('\n');
  var salio = false;
  try {
    var owner = PROPS.getProperty('OWNER_WA'), pid = PROPS.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) { sendWhatsApp(pid, owner, texto.substring(0, 3500)); salio = true; }
  } catch (e) { Logger.log('correoRed_ WhatsApp: ' + e); }
  try {
    MailApp.sendEmail({ to: 'restaurante@rosanta.rest', subject: '⏰ ' + pendientes.length + ' correo(s) de clientes sin respuesta', body: texto, name: 'Bot Rosanta' });
    salio = true;
  } catch (e) { Logger.log('correoRed_ correo: ' + e); }
  if (salio) {
    pendientes.forEach(function (p) { avisados.push(p.id); });
    PROPS.setProperty('CORREO_RED_AVISADOS', JSON.stringify(avisados.slice(-300)));
  }
  return pendientes;
}
