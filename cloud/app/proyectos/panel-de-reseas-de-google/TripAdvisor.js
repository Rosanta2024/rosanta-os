/**
 * ============================================================
 *  ROSANTA - Reseñas de TripAdvisor dentro del panel
 *
 *  Diferencia grande contra Google: TripAdvisor NO tiene endpoint
 *  para publicar respuestas. Se puede leer y se puede redactar el
 *  borrador, pero pegarlo es a mano en el Management Center
 *  (tripadvisor.com/Owners). Por eso aquí no existe "publicar":
 *  existe "copiar" y "marcar como respondida".
 *
 *  24-sep-2026: la Content API que usa `traerResenasTA_` está
 *  marcada como deprecada por TripAdvisor, que empuja a su
 *  plataforma nueva (Terra). Todo lo demás de este archivo es
 *  independiente de la fuente: si hay que cambiar de API, se
 *  reescribe SOLO `traerResenasTA_` para que siga devolviendo la
 *  misma lista normalizada y nada más se toca.
 * ============================================================
 */

var TA_BASE  = 'https://api.content.tripadvisor.com/api/v1';
var TA_HOJA  = 'TripAdvisor';
var TA_CABECERAS = [
  'Fecha detectada', 'ReviewId', 'Estrellas', 'Cliente', 'Titulo',
  'Reseña original', 'Respuesta sugerida', 'Estado',
  'Respuesta en TripAdvisor', 'Fecha marcada', 'URL'
];

function configTA_() {
  return {
    key:        getProp_('TA_API_KEY'),
    locationId: getProp_('TA_LOCATION_ID') || '27893564',   // ficha de Rosanta
    referer:    getProp_('TA_REFERER')     || 'https://rosanta.rest',
    idioma:     getProp_('TA_IDIOMA')      || 'es'
  };
}

/* ---------- LA ÚNICA PARTE ATADA A LA API ----------
   Devuelve un array de reseñas crudas de TripAdvisor. Si algún día hay que
   cambiar de fuente (Terra, u otra), se reescribe esta función y `normalizarTA_`
   y el resto del archivo sigue igual.

   La llave de TripAdvisor obliga a restringirse por IP o por dominio. Apps
   Script sale por IPs de Google que cambian, así que la restricción tiene que
   ser por dominio y aquí se manda la cabecera Referer que le corresponde. */
function traerResenasTA_() {
  var c = configTA_();
  if (!c.key) throw new Error('Falta TA_API_KEY en las Propiedades del script.');

  var url = TA_BASE + '/location/' + encodeURIComponent(c.locationId) + '/reviews' +
            '?key=' + encodeURIComponent(c.key) +
            '&language=' + encodeURIComponent(c.idioma);

  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Referer': c.referer, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code === 403 || code === 401) {
    throw new Error('TripAdvisor rechazó la llave (' + code + '). Casi siempre es la ' +
                    'restricción de la credencial: tiene que estar por dominio (' + c.referer +
                    '), no por IP. Respuesta: ' + res.getContentText().slice(0, 300));
  }
  if (code !== 200) {
    throw new Error('TripAdvisor respondió ' + code + ': ' + res.getContentText().slice(0, 300));
  }
  return JSON.parse(res.getContentText()).data || [];
}

// Aplana una reseña cruda a la forma que usan la hoja y el panel.
function normalizarTA_(r) {
  return {
    id:         String(r.id || ''),
    stars:      Number(r.rating) || 0,
    name:       (r.user && r.user.username) || 'Anónimo',
    title:      r.title || '',
    comment:    r.text || '',
    time:       r.published_date || '',
    url:        r.url || '',
    bubbles:    r.rating_image_url || '',
    ownerReply: (r.owner_response && r.owner_response.text) || ''
  };
}

/* ---------- HOJA ----------
   Vive como pestaña aparte dentro de la MISMA hoja de control del bot de
   Google, para no tener dos archivos que cuidar. */
function getSheetTA_() {
  var ss = getSheet_().getParent();
  var sh = ss.getSheetByName(TA_HOJA);
  if (!sh) {
    sh = ss.insertSheet(TA_HOJA);
    sh.appendRow(TA_CABECERAS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function colsTA_(head) {
  return {
    id:     head.indexOf('ReviewId'),
    estr:   head.indexOf('Estrellas'),
    cli:    head.indexOf('Cliente'),
    tit:    head.indexOf('Titulo'),
    texto:  head.indexOf('Reseña original'),
    sug:    head.indexOf('Respuesta sugerida'),
    estado: head.indexOf('Estado'),
    resp:   head.indexOf('Respuesta en TripAdvisor'),
    fecha:  head.indexOf('Fecha marcada'),
    url:    head.indexOf('URL')
  };
}

/* ---------- TRIGGER POR HORA ----------
   La API devuelve solo las 5 más recientes. Por eso esto ACUMULA: cada
   corrida guarda las que no estaban, y la hoja termina siendo el historial
   que la API no da. Hacia atrás no hay forma de recuperar nada. */
function procesarResenasTripAdvisor() {
  var sh   = getSheetTA_();
  var data = sh.getDataRange().getValues();
  var c    = colsTA_(data[0]);

  var filaDe = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][c.id] || '').trim();
    if (id) filaDe[id] = i + 1;
  }

  var nuevas = 0;
  traerResenasTA_().forEach(function (crudo) {
    var r = normalizarTA_(crudo);
    if (!r.id) return;

    var fila = filaDe[r.id];
    if (fila) {
      // Ya la conocíamos. Lo único que puede haber cambiado es que ya la
      // respondiste en TripAdvisor: eso se refleja aquí solo.
      if (r.ownerReply) {
        sh.getRange(fila, c.resp + 1).setValue(r.ownerReply);
        if (String(sh.getRange(fila, c.estado + 1).getValue() || '') === 'PENDIENTE') {
          sh.getRange(fila, c.estado + 1).setValue('RESPONDIDA');
        }
      }
      return;
    }

    // Nueva. Si ya viene respondida desde TripAdvisor, no gastamos el modelo.
    var sugerida = '';
    if (!r.ownerReply) {
      var texto = (r.title ? r.title + '. ' : '') + r.comment;
      sugerida = redactarRespuesta_(r.stars, r.name, texto).texto;
      nuevas++;
    }
    sh.appendRow([
      new Date(), r.id, r.stars, r.name, r.title, r.comment,
      sugerida, r.ownerReply ? 'RESPONDIDA' : 'PENDIENTE',
      r.ownerReply, '', r.url
    ]);
  });

  if (nuevas > 0) notificarPendientesTA_(sh);
  Logger.log('TripAdvisor | nuevas sin responder: %s', nuevas);
}

function notificarPendientesTA_(sh) {
  var data = sh.getDataRange().getValues();
  var c = colsTA_(data[0]);
  var pend = data.slice(1).filter(function (f) { return f[c.estado] === 'PENDIENTE'; });
  if (!pend.length) return;

  var cuerpo = 'Hola Juanma,\n\nHay ' + pend.length + ' reseña(s) de TripAdvisor sin responder.\n' +
    'TripAdvisor no deja publicar respuestas por API: el borrador va listo, pero hay que\n' +
    'pegarlo a mano en el Management Center.\n\n';
  pend.forEach(function (f) {
    cuerpo += '— ' + f[c.estr] + '★ de ' + (f[c.cli] || 'Anónimo') + '\n';
    if (f[c.tit]) cuerpo += '  Título: ' + f[c.tit] + '\n';
    cuerpo += '  Reseña: ' + (f[c.texto] || '(sin texto)') + '\n';
    cuerpo += '  Borrador propuesto: ' + f[c.sug] + '\n';
    if (f[c.url]) cuerpo += '  Ver: ' + f[c.url] + '\n';
    cuerpo += '\n';
  });

  var panel = getProp_('PANEL_URL') || urlDelPanel_();
  if (panel) cuerpo += 'Panel (pestaña TripAdvisor): ' + panel + '\n';
  cuerpo += 'Responder: https://www.tripadvisor.com/Owners\n';

  MailApp.sendEmail(CONFIG.OWNER_EMAIL,
    '🌿 Rosanta: ' + pend.length + ' reseña(s) de TripAdvisor sin responder', cuerpo);
}

/* ---------- LO QUE CONSUME EL PANEL ---------- */

function getDatosTripAdvisor() {
  var sh   = getSheetTA_();
  var data = sh.getDataRange().getValues();
  var c    = colsTA_(data[0]);

  var reviews = [];
  for (var i = 1; i < data.length; i++) {
    var f = data[i];
    if (!f[c.id]) continue;
    reviews.push({
      id:        String(f[c.id]),
      stars:     Number(f[c.estr]) || 0,
      name:      String(f[c.cli] || 'Anónimo'),
      title:     String(f[c.tit] || ''),
      comment:   String(f[c.texto] || ''),
      borrador:  String(f[c.sug] || ''),
      estado:    String(f[c.estado] || ''),
      respuesta: String(f[c.resp] || ''),
      url:       String(f[c.url] || ''),
      time:      f[0] instanceof Date ? f[0].toISOString() : String(f[0] || '')
    });
  }
  reviews.reverse();   // lo más nuevo primero

  return {
    reviews: reviews,
    configurada: !!getProp_('TA_API_KEY'),
    ficha: 'https://www.tripadvisor.com/Restaurant_Review-g295366-d' +
           configTA_().locationId + '-Reviews-Rosanta.html'
  };
}

function filaTA_(sh, reviewId) {
  var data = sh.getDataRange().getValues();
  var c = colsTA_(data[0]);
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][c.id] || '').trim() === String(reviewId).trim()) {
      return { fila: i + 1, c: c };
    }
  }
  throw new Error('Esa reseña de TripAdvisor no está en la hoja.');
}

function guardarBorradorTA(reviewId, texto) {
  var t = validarTexto_(texto);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheetTA_(), p = filaTA_(sh, reviewId);
    sh.getRange(p.fila, p.c.sug + 1).setValue(t);
    return { ok: true, texto: t };
  } finally { lock.releaseLock(); }
}

function regenerarBorradorTA(reviewId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheetTA_(), p = filaTA_(sh, reviewId);
    var estrellas = Number(sh.getRange(p.fila, p.c.estr + 1).getValue()) || 0;
    var nombre    = String(sh.getRange(p.fila, p.c.cli + 1).getValue() || '');
    var titulo    = String(sh.getRange(p.fila, p.c.tit + 1).getValue() || '');
    var texto     = String(sh.getRange(p.fila, p.c.texto + 1).getValue() || '');

    var red = redactarRespuesta_(estrellas, nombre, (titulo ? titulo + '. ' : '') + texto);
    sh.getRange(p.fila, p.c.sug + 1).setValue(red.texto);
    return { ok: true, texto: red.texto, confiable: red.confiable };
  } finally { lock.releaseLock(); }
}

// "Ya la pegué en TripAdvisor." No publica nada: solo la saca de pendientes.
// El trigger la confirma sola en la siguiente corrida, cuando vea el
// owner_response en la API.
function marcarRespondidaTA(reviewId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheetTA_(), p = filaTA_(sh, reviewId);
    sh.getRange(p.fila, p.c.estado + 1).setValue('MARCADA_RESPONDIDA');
    sh.getRange(p.fila, p.c.fecha + 1).setValue(new Date());
    return { ok: true, estado: 'MARCADA_RESPONDIDA' };
  } finally { lock.releaseLock(); }
}

function descartarTA(reviewId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheetTA_(), p = filaTA_(sh, reviewId);
    sh.getRange(p.fila, p.c.estado + 1).setValue('NO_RESPONDER');
    return { ok: true, estado: 'NO_RESPONDER' };
  } finally { lock.releaseLock(); }
}

/* ---------- INSTALACIÓN ---------- */

// Corré esto UNA vez después de cargar TA_API_KEY. No borra los triggers de
// Google: solo agrega el de TripAdvisor si no está.
function instalarTriggerTripAdvisor() {
  var ya = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'procesarResenasTripAdvisor';
  });
  if (ya) { Logger.log('El trigger de TripAdvisor ya estaba instalado.'); return; }
  ScriptApp.newTrigger('procesarResenasTripAdvisor').timeBased().everyHours(1).create();
  Logger.log('Trigger de TripAdvisor instalado (cada hora).');
}

// Prueba en seco de la llave: no escribe en la hoja ni manda correo.
// Si esto imprime reseñas, la integración va a funcionar.
function probarTripAdvisor() {
  var c = configTA_();
  Logger.log('locationId: %s | referer: %s | llave cargada: %s',
             c.locationId, c.referer, c.key ? 'sí' : 'NO');
  var crudas = traerResenasTA_();
  Logger.log('Reseñas devueltas: %s', crudas.length);
  crudas.forEach(function (raw) {
    var r = normalizarTA_(raw);
    Logger.log('[%s★] %s — %s | respondida: %s',
      r.stars, r.name, (r.title || r.comment).slice(0, 70), r.ownerReply ? 'sí' : 'no');
  });
}
