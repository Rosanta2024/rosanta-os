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

var CORREO_BUSQUEDA = 'label:01-clientes--reservas- -label:01-clientes--reservas--cotizaciones ' +
  '-from:rosanta.rest -from:wixsiteautomations.com newer_than:2d';
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

function revisarCorreosClientes() {
  var desde = Number(PROPS.getProperty('CORREO_DESDE') || 0);
  if (!desde) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var vistos = correoVistos_();
    GmailApp.search(CORREO_BUSQUEDA, 0, 30).forEach(function (hilo) {
      try { correoHilo_(hilo, desde, vistos); }
      catch (e) { Logger.log('correo hilo ' + hilo.getId() + ': ' + e); }
    });
    correoGuardarVistos_(vistos);
  } finally {
    lock.releaseLock();
  }
}

function correoHilo_(hilo, desde, vistos) {
  var msgs = hilo.getMessages();
  var ultimo = msgs[msgs.length - 1];
  if (vistos.indexOf(ultimo.getId()) >= 0) return;
  vistos.push(ultimo.getId());
  if (ultimo.getDate().getTime() <= desde) return;
  if (correoEsNuestro_(ultimo.getFrom())) return;           // ya contestó Juanma
  if (hilo.getMessages().some(function (m) { return m.isDraft && m.isDraft(); })) return;

  var c = correoCliente_(ultimo);
  if (!c.email) { Logger.log('correo sin remitente claro: ' + ultimo.getSubject()); return; }
  if (botEnPausa(c.email)) return;

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
  var cuerpo = auto ? auto.cuerpo : correoCuerpo_(result.respuesta);
  if (!cuerpo) return;
  if (auto) {
    // Cambio o cancelación ya hechos en Wix: se contestan sin borrador, con el correo revisado por marca.
    if (c.openwidget) GmailApp.sendEmail(c.email, auto.asunto, cuerpo, { name: 'Rosanta' });
    else ultimo.reply(cuerpo, { name: 'Rosanta' });
  } else if (c.openwidget) {
    GmailApp.createDraft(c.email, 'Re: tu mensaje a Rosanta', cuerpo, { name: 'Rosanta' });
  } else {
    ultimo.createDraftReply(cuerpo);
  }
  logMensaje('correo', c.email, c.nombre, 'out', 'bot', (auto ? '[Enviado solo: ' + auto.caso + '] ' : '[Borrador en Gmail] ') + cuerpo);
  logLead(result.lead, c.texto, c.email, cuerpo);
  fichaActualizar_('correo', c.email, c.nombre, result.lead);
  // Eventos: el aviso con DATOS_PIPELINE sigue saliendo (lo lee la revisión diaria).
  if (result.lead && result.lead.tipo === 'evento' && result.lead.requiere_humano) {
    notificarHumano('correo', result.lead, c.texto, c.email);
  }
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
