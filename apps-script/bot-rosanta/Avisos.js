/**
 * ROSANTA · BOT — AVISOS A JUANMA QUE SÍ LLEGAN (@70, 22-oct-2026, aprobada por Juanma)
 * Archivo ADITIVO. Prefijo aviso.
 *
 * Por qué (Ashley, 21-oct): el WhatsApp del aviso a Juanma es un mensaje libre del bot, y Meta solo lo entrega si Juanma
 * le escribió al número del bot en las últimas 24 h. Si no, lo acepta y después lo descarta (llega un "estado" failed
 * por el webhook), y nadie se enteraba. Ahora:
 *   1. Con la plantilla aprobada (Propiedad AVISO_PLANTILLA = 'aviso_chat_pendiente') el aviso va por plantilla: llega siempre.
 *   2. Sin plantilla y con la ventana de Juanma cerrada, no se intenta el WhatsApp: sale directo el correo URGENTE.
 *   3. Cada aviso queda anotado en la pestaña AvisosJuanma de Rosanta Leads (vía, si Meta lo aceptó, el error).
 *   4. Si Meta avisa después que un aviso falló (estado failed), sale el correo URGENTE y se anota.
 * Además: la frase de contacto siempre avisa (B), el resumen trae los PENDIENTES (D) y hay un recordatorio a ~4 h del
 * cierre de la ventana de WhatsApp del cliente (E).
 */
var AVISO_PROMESA_RE = /se pondr[aá] en contacto|get in touch with you|te escribe (juanma|alguien)|reach(es)? out to you|gets? back to you|se comunica(r[aá])? contigo/i;
var AVISO_VENTANA_H = 24;
var AVISO_RECORDAR_H = 4;          // recordatorio cuando a la ventana del cliente le quedan ~4 h
var AVISO_REVISAR_MIN = 30;        // cada cuánto se buscan pendientes (dentro del reloj de cada minuto)
var AVISO_DIAS_PENDIENTES = 3;

/** Juanma le escribió al número del bot: su ventana de 24 h queda abierta. */
function avisoJuanmaEscribio_() {
  PROPS.setProperty('OWNER_ULTIMO_MSG', String(Date.now()));
}
function avisoVentanaJuanma_() {
  var t = Number(PROPS.getProperty('OWNER_ULTIMO_MSG') || 0);
  return t && (Date.now() - t) < (AVISO_VENTANA_H - 0.5) * 3600000;
}
function avisoHora_(ms) {
  return ms ? Utilities.formatDate(new Date(ms), 'America/Guatemala', 'EEE dd-MMM HH:mm') : '—';
}
function avisoConsola_() {
  return PROPS.getProperty('CONSOLE_URL') || ('https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/edit');
}

/**
 * El aviso a Juanma. d = { canal, contacto, nombre, tema, texto (el aviso libre de siempre), limite (ms, opcional),
 * urgente (true = si no llega por WhatsApp sale el correo URGENTE) }. Nunca tira error. Devuelve 'plantilla'|'libre'|'correo'|'falló'.
 */
function avisoJuanma_(d) {
  var owner = PROPS.getProperty('OWNER_WA'), pid = PROPS.getProperty('WA_PHONE_NUMBER_ID');
  var plantilla = PROPS.getProperty('AVISO_PLANTILLA');
  var via = '', ok = false, detalle = '', wamid = '';
  try {
    if (!owner || !pid) { via = 'sin_numero'; detalle = 'falta OWNER_WA o WA_PHONE_NUMBER_ID'; }
    else if (plantilla) {
      via = 'plantilla';
      var r = UrlFetchApp.fetch('https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + pid + '/messages', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + CONFIG.WHATSAPP_TOKEN },
        payload: JSON.stringify({ messaging_product: 'whatsapp', to: owner, type: 'template', template: { name: plantilla, language: { code: 'es' },
          components: [{ type: 'body', parameters: avisoParametros_(d).map(function (t) { return { type: 'text', text: t }; }) }] } })
      });
      var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
      ok = r.getResponseCode() < 300 && !!(j.messages && j.messages[0]);
      wamid = ok ? j.messages[0].id : '';
      detalle = ok ? '' : String(r.getResponseCode()) + ' ' + String(r.getContentText()).slice(0, 160);
    } else if (avisoVentanaJuanma_()) {
      via = 'libre';
      var r2 = sendWhatsApp(pid, owner, d.texto);
      var j2 = {}; try { j2 = JSON.parse((r2 && r2.getContentText()) || '{}'); } catch (e) {}
      ok = !!(r2 && r2.getResponseCode() < 300 && j2.messages && j2.messages[0]);
      wamid = ok ? j2.messages[0].id : '';
      detalle = ok ? '' : (r2 ? String(r2.getResponseCode()) + ' ' + String(r2.getContentText()).slice(0, 160) : 'sin respuesta');
    } else {
      via = 'ventana_cerrada';
      detalle = 'Juanma no le escribe al bot hace más de 24 h y todavía no hay plantilla aprobada';
    }
  } catch (e) { detalle = String(e).slice(0, 160); }
  if (wamid) CacheService.getScriptCache().put('aviso_' + wamid, JSON.stringify({ canal: d.canal, contacto: d.contacto, nombre: d.nombre, tema: d.tema, limite: d.limite || 0 }), 21600);
  avisoAnotar_(d, via, ok ? 'aceptado' : 'no', detalle);
  if (!ok && d.urgente !== false) avisoUrgente_(d, detalle);
  return ok ? via : (d.urgente !== false ? 'correo' : 'falló');
}

function avisoParametros_(d) {
  var nombre = String(d.nombre || '').split(' ')[0] || 'Cliente';
  var c = String(d.contacto || '');
  var canal = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', correo: 'correo' }[String(d.canal || '').toLowerCase()] || String(d.canal || '');
  return [canal, nombre, c.slice(-4) || '—', String(d.tema || 'otro'), d.limite ? avisoHora_(d.limite) : 'sin límite'];
}

/** El correo URGENTE (uno por contacto cada 2 h). */
function avisoUrgente_(d, motivo) {
  var cache = CacheService.getScriptCache(), k = 'urgente_' + String(d.contacto || '');
  if (cache.get(k)) return;
  cache.put(k, '1', 7200);
  var p = avisoParametros_(d);
  try {
    MailApp.sendEmail({ to: 'restaurante@rosanta.rest', name: 'Bot Rosanta',
      subject: '⚠️ URGENTE: un cliente espera respuesta (' + p[0] + ' · ' + p[1] + ' …' + p[2] + ')',
      body: 'El aviso a tu WhatsApp no llegó (' + motivo + ').\n\nCliente: ' + p[1] + ' (…' + p[2] + ') por ' + p[0] +
        '\nTema: ' + p[3] + '\nLa ventana de WhatsApp cierra: ' + p[4] + '\n\n' + String(d.texto || '') +
        '\n\nContéstale desde la consola:\n' + avisoConsola_() +
        '\n\nPara que los avisos te lleguen al teléfono mientras se aprueba la plantilla: mándale cualquier mensaje al número del bot una vez al día.' });
  } catch (e) { Logger.log('avisoUrgente_: ' + e); }
}

/** Registro de cada aviso (pestaña AvisosJuanma de Rosanta Leads). */
function avisoAnotar_(d, via, meta, detalle) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sh = ss.getSheetByName('AvisosJuanma');
    if (!sh) { sh = ss.insertSheet('AvisosJuanma'); sh.appendRow(['Fecha/Hora', 'Canal', 'Contacto (…4)', 'Tema', 'Vía', 'Meta', 'Detalle']); }
    sh.appendRow([new Date(), d.canal || '', '…' + String(d.contacto || '').slice(-4), d.tema || '', via, meta, detalle || '']);
  } catch (e) { Logger.log('avisoAnotar_: ' + e); }
}

/** Estados que manda Meta por el webhook: si un aviso a Juanma falló, correo URGENTE y queda anotado. */
function avisoEstados_(statuses) {
  (statuses || []).forEach(function (s) {
    if (!s || s.status !== 'failed') return;
    var raw = CacheService.getScriptCache().get('aviso_' + s.id);
    if (!raw) return;
    var d = {}; try { d = JSON.parse(raw); } catch (e) { return; }
    var err = (s.errors && s.errors[0]) || {};
    var motivo = 'Meta no lo entregó: ' + (err.code || '') + ' ' + (err.title || err.message || '');
    avisoAnotar_(d, 'estado', 'falló', motivo);
    avisoUrgente_(d, motivo);
  });
}

/**
 * Chats que esperan respuesta de una persona: el bot los pasó a Juanma (Leads › ¿Humano? = Sí) en los últimos días y,
 * después de eso, nadie del equipo escribió en ese chat (Conversaciones, salida que no es del bot).
 * → [{ canal, contacto, nombre, tema, desde (ms), ultimoCliente (ms), limite (ms) }]
 */
function avisoPendientes_(ahora) {
  ahora = ahora || Date.now();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var leads = ss.getSheetByName('Leads').getDataRange().getValues().slice(1);
  var conv = ss.getSheetByName('Conversaciones').getDataRange().getValues().slice(1);
  var desde = ahora - AVISO_DIAS_PENDIENTES * 86400000;
  var esc = {};
  leads.forEach(function (r) {
    var t = r[0] instanceof Date ? r[0].getTime() : 0;
    if (t < desde || r[9] !== 'Sí') return;
    var canal = String(r[1] || ''), id = String(r[11] || '');
    if (!id || canal === 'restaurante') return;
    var k = canal + '|' + id;
    esc[k] = { canal: canal, contacto: id, nombre: String(r[3] || ''), tema: String(r[5] || 'otro'), desde: Math.max(t, (esc[k] && esc[k].desde) || 0) };
  });
  var out = [];
  Object.keys(esc).forEach(function (k) {
    var e = esc[k], ultimoCliente = 0, equipo = false;
    conv.forEach(function (c) {
      if (String(c[1]) !== e.canal || String(c[2]) !== e.contacto) return;
      var t = c[0] instanceof Date ? c[0].getTime() : 0;
      if (c[4] === 'in' && t > ultimoCliente) ultimoCliente = t;
      if (c[4] === 'out' && c[5] !== 'bot' && t >= e.desde) equipo = true;
    });
    if (equipo) return;
    e.ultimoCliente = ultimoCliente;
    e.limite = (e.canal === 'correo' || !ultimoCliente) ? 0 : ultimoCliente + AVISO_VENTANA_H * 3600000;
    out.push(e);
  });
  return out.sort(function (a, b) { return (a.limite || 9e15) - (b.limite || 9e15); });
}

/** Cada ~30 min (dentro de enviarRespuestasPendientes): recordatorio a ~4 h del cierre de la ventana de cada pendiente. */
function avisoRecordatorios_() {
  var ultima = Number(PROPS.getProperty('AVISO_REVISION') || 0);
  if (Date.now() - ultima < AVISO_REVISAR_MIN * 60000) return 0;
  PROPS.setProperty('AVISO_REVISION', String(Date.now()));
  var hechos = {};
  try { hechos = JSON.parse(PROPS.getProperty('AVISO_RECORDADOS') || '{}') || {}; } catch (e) { hechos = {}; }
  var n = 0, ahora = Date.now();
  avisoPendientes_(ahora).forEach(function (p) {
    if (!p.limite) return;
    var falta = p.limite - ahora, k = p.canal + '|' + p.contacto + '|' + p.limite;
    if (falta <= 0 || falta > AVISO_RECORDAR_H * 3600000 || hechos[k]) return;
    hechos[k] = ahora;
    avisoJuanma_({ canal: p.canal, contacto: p.contacto, nombre: p.nombre, tema: p.tema, limite: p.limite,
      texto: '⏰ Quedan ~' + Math.ceil(falta / 3600000) + ' h para contestarle a ' + (p.nombre || 'un cliente') + ' por ' + p.canal +
        ' (la ventana de 24 h cierra ' + avisoHora_(p.limite) + ').\n👉 ' + avisoConsola_() });
    n++;
  });
  Object.keys(hechos).forEach(function (k) { if (ahora - hechos[k] > 3 * 86400000) delete hechos[k]; });
  PROPS.setProperty('AVISO_RECORDADOS', JSON.stringify(hechos));
  return n;
}
