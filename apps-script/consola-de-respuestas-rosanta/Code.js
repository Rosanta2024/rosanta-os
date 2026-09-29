/**
 * ROSANTA — Consola tipo chat
 * Lee la pestaña "Conversaciones" (la llena el bot) y muestra cada
 * contacto como un hilo. Para responder, encola en "Salientes"; el BOT
 * la envía con su trigger enviarRespuestasPendientes() en <1 min.
 *
 * Propiedad opcional: SPREADSHEET_ID -> ID del Sheet "Rosanta Leads"
 * (si el proyecto está vinculado al Sheet, no hace falta).
 */

function cfg_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === '') ? (fallback || '') : v;
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Rosanta · Consola de chats')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getSS_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    var id = cfg_('SPREADSHEET_ID', '');
    if (!id) throw new Error('Falta la propiedad SPREADSHEET_ID con el ID del Sheet.');
    ss = SpreadsheetApp.openById(id);
  }
  return ss;
}

/** Lista de hilos (un contacto = un chat), ordenados por último mensaje. */
function getThreads(limit) {
  limit = limit || 300;
  var sh = getSS_().getSheetByName('Conversaciones');
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  var map = {};
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var id = String(r[2] || '').trim();
    if (!id) continue;
    var canal = String(r[1] || '').toLowerCase();
    var key = canal + '|' + id;
    var fecha = r[0] ? new Date(r[0]).getTime() : 0;
    var nombre = String(r[3] || '').trim();
    var dir = String(r[4] || '').toLowerCase();
    var autor = String(r[5] || '').toLowerCase();
    var texto = String(r[6] || '');
    if (!map[key]) map[key] = { id: id, canal: canal, nombre: nombre, ultimoTexto: texto, ultimaFecha: fecha, ultimaDir: dir, ultimoAutor: autor };
    var t = map[key];
    if (nombre && !t.nombre) t.nombre = nombre;
    if (fecha >= t.ultimaFecha) { t.ultimaFecha = fecha; t.ultimoTexto = texto; t.ultimaDir = dir; t.ultimoAutor = autor; }
  }
  var arr = [];
  for (var k in map) {
    var th = map[k];
    th.pendiente = (th.ultimaDir === 'in');
    th.ultimaFechaIso = th.ultimaFecha ? new Date(th.ultimaFecha).toISOString() : '';
    arr.push(th);
  }
  arr.sort(function (a, b) { return b.ultimaFecha - a.ultimaFecha; });
  return arr.slice(0, limit);
}

/** Todos los mensajes de un contacto, en orden. */
function getMensajes(canal, contactoId) {
  canal = String(canal || '').toLowerCase();
  contactoId = String(contactoId || '').trim();
  var sh = getSS_().getSheetByName('Conversaciones');
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[2] || '').trim() !== contactoId) continue;
    if (canal && String(r[1] || '').toLowerCase() !== canal) continue;
    out.push({
      fecha: r[0] ? new Date(r[0]).toISOString() : '',
      direccion: String(r[4] || '').toLowerCase(),
      autor: String(r[5] || '').toLowerCase(),
      texto: String(r[6] || '')
    });
  }
  return out;
}

/** Encola una respuesta; el bot la envía en <1 min por el canal correcto. */
function enviarMensaje(canal, contactoId, texto) {
  texto = (texto || '').trim();
  canal = String(canal || '').toLowerCase();
  contactoId = String(contactoId || '').trim();
  if (!texto) return { ok: false, msg: 'El mensaje está vacío.' };
  if (!contactoId) return { ok: false, msg: 'Falta el contacto.' };
  hojaSalientes_().appendRow([new Date(), canal, contactoId, texto, 'libre', '']);
  return { ok: true, msg: 'En camino. El bot lo enviará en menos de un minuto.' };
}

function hojaSalientes_() {
  var ss = getSS_();
  var sh = ss.getSheetByName('Salientes');
  if (!sh) {
    sh = ss.insertSheet('Salientes');
    sh.appendRow(['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']);
  }
  return sh;
}

/**
 * Encola una foto. Se guarda en Drive compartida con enlace (el bot la baja
 * por URL y se la sube a Meta) y va a "Salientes" con Tipo "imagen:<ID>".
 * El texto, si hay, viaja como pie de foto.
 */
function enviarImagen(canal, contactoId, base64, mime, caption) {
  canal = String(canal || '').toLowerCase();
  contactoId = String(contactoId || '').trim();
  caption = (caption || '').trim();
  if (!contactoId) return { ok: false, msg: 'Falta el contacto.' };
  if (!base64) return { ok: false, msg: 'No llegó la foto.' };
  if (mime !== 'image/jpeg' && mime !== 'image/png') return { ok: false, msg: 'Solo fotos JPG o PNG.' };
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime,
    'foto-' + contactoId + '-' + Date.now() + (mime === 'image/png' ? '.png' : '.jpg'));
  if (blob.getBytes().length > 5 * 1024 * 1024) return { ok: false, msg: 'La foto pesa más de 5 MB.' };
  var file = carpetaFotos_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  hojaSalientes_().appendRow([new Date(), canal, contactoId, caption, 'imagen:' + file.getId(), '']);
  return { ok: true, msg: 'Foto en camino. El bot la enviará en menos de un minuto.' };
}

/** Carpeta de Drive donde quedan las fotos enviadas (se crea la primera vez). */
function carpetaFotos_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOTOS_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  var f = DriveApp.createFolder('Rosanta · Fotos enviadas desde la consola');
  props.setProperty('FOTOS_FOLDER_ID', f.getId());
  return f;
}

/** Correr UNA vez desde el editor para autorizar el permiso de Drive. */
function autorizarDrive() {
  Logger.log('Carpeta de fotos: ' + carpetaFotos_().getUrl());
}