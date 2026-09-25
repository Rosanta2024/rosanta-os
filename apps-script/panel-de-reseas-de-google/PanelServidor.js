/**
 * ============================================================
 *  ROSANTA - Panel de Reseñas de Google (Web App privado)
 *  Se sirve desde el mismo proyecto del bot. Jala TODAS las
 *  reseñas en vivo desde la API de Google, calcula la puntuación
 *  global y cuántas reseñas de 5 estrellas faltan para subir.
 *  Usa las mismas CONFIG, MB_BASE y STAR_MAP de Code.gs.
 *
 *  El archivo HTML debe llamarse EXACTAMENTE: Panel de Reseñas de Google
 *
 *  24-sep-2026: el panel dejó de ser solo lectura. Las reseñas sin
 *  respuesta traen el borrador que el bot dejó en la hoja de control y
 *  se pueden editar, guardar, regenerar y publicar desde aquí mismo.
 *  Antes el único camino era abrir la Sheet y escribir SI en la columna
 *  "Aprobar", y esperar hasta 30 min al trigger `publicarAprobadas`.
 * ============================================================
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Panel de Reseñas de Google')
    .evaluate()
    .setTitle('Panel de Reseñas de Google')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Necesario para que la intranet pueda embeberlo en el Sistema de Marketing.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* La API v4 de reseñas devuelve 503 intermitentes, y el panel pagina muchas
   páginas seguidas: sin reintentos, un solo 503 tumbaba toda la carga (visto
   5-ago-2026). Los códigos transitorios (503/500/429) se reintentan con espera
   creciente; cualquier otro error se reporta de inmediato. */
function fetchConReintentos_(url) {
  var res, code;
  for (var i = 0; i < 4; i++) {
    res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    code = res.getResponseCode();
    if (code === 200) return res;
    if (code !== 503 && code !== 500 && code !== 429) break;
    if (i < 3) Utilities.sleep(800 * Math.pow(2, i)); // 0.8s, 1.6s, 3.2s
  }
  throw new Error('Error API (' + code + '): ' + res.getContentText());
}

// Devuelve todo lo que el panel necesita (se llama con google.script.run).
function getDatosDashboard() {
  var reviews = [];
  var base = MB_BASE + '/accounts/' + CONFIG.ACCOUNT_ID +
             '/locations/' + CONFIG.LOCATION_ID + '/reviews?pageSize=50&orderBy=updateTime%20desc';
  var averageRating = 0, totalReviewCount = 0, pageToken = '', guard = 0;

  do {
    var url = base + (pageToken ? '&pageToken=' + pageToken : '');
    var res = fetchConReintentos_(url);
    var data = JSON.parse(res.getContentText());
    if (data.averageRating)   averageRating = data.averageRating;
    if (data.totalReviewCount) totalReviewCount = data.totalReviewCount;
    (data.reviews || []).forEach(function (r) {
      reviews.push({
        id: idDeResena_(r),
        stars: STAR_MAP[r.starRating] || 0,
        name: (r.reviewer && r.reviewer.displayName) || 'Anónimo',
        comment: r.comment || '',
        time: r.createTime || r.updateTime || '',
        hasReply: !!(r.reviewReply && r.reviewReply.comment),
        reply: (r.reviewReply && r.reviewReply.comment) || '',
        borrador: '',   // se rellena abajo desde la hoja de control
        estado: ''
      });
    });
    pageToken = data.nextPageToken || '';
    guard++;
  } while (pageToken && guard < 40);

  // Pegar el borrador que el bot dejó en la hoja. Si la hoja todavía no existe
  // o falla, el panel sigue sirviendo: solo aparece sin borradores.
  try {
    var mapa = mapaBorradores_();
    reviews.forEach(function (r) {
      var b = mapa[r.id];
      if (!b) return;
      r.borrador = b.borrador;
      r.estado   = b.estado;
    });
  } catch (e) {
    Logger.log('No se pudo leer la hoja de control: ' + e.message);
  }

  var dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(function (r) { if (dist[r.stars] !== undefined) dist[r.stars]++; });

  return {
    average: Number(averageRating) || 0,
    total: Number(totalReviewCount) || reviews.length,
    fetched: reviews.length,
    dist: dist,
    reviews: reviews
  };
}

/* ============================================================
 *  EDICIÓN Y PUBLICACIÓN DESDE EL PANEL
 *  Las tres acciones escriben en la MISMA hoja que ya usaba el
 *  bot, con los mismos estados, para que el correo de pendientes
 *  y el trigger `publicarAprobadas` sigan cuadrando.
 * ============================================================ */

var COL_ID     = 'ReviewId';
var COL_RESP   = 'Respuesta (editable)';
var COL_ESTADO = 'Estado';
var COL_APROB  = 'Aprobar (SI/NO)';
var COL_FECHA  = 'Fecha publicada';
var MAX_RESPUESTA = 4000;   // tope duro de Google para el texto de la respuesta

// El id de una reseña: v4 a veces lo manda suelto y a veces solo dentro de `name`.
function idDeResena_(r) {
  return r.reviewId || String(r.name || '').split('/').pop() || '';
}

// reviewId -> { borrador, estado, fila }. Si un id está repetido gana la fila
// más nueva, que es la que el bot escribió al final.
function mapaBorradores_() {
  var data = getSheet_().getDataRange().getValues();
  if (data.length < 2) return {};
  var head = data[0];
  var cId = head.indexOf(COL_ID),
      cRe = head.indexOf(COL_RESP),
      cEs = head.indexOf(COL_ESTADO);
  var m = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][cId] || '').trim();
    if (!id) continue;
    m[id] = {
      borrador: String(data[i][cRe] || ''),
      estado:   String(data[i][cEs] || ''),
      fila:     i + 1
    };
  }
  return m;
}

// Localiza (o crea) la fila de una reseña. Devuelve índices de columna 1-based.
// Crea fila cuando la reseña es vieja y el bot nunca la procesó: así también se
// pueden contestar desde el panel las que quedaron atrás.
// `estadoSiSeCrea` es el estado con el que nace esa fila nueva, y vacío significa
// no crearla. Importa: una reseña que ya tiene respuesta en Google no puede nacer
// como PENDIENTE_APROBAR, porque el correo la pediría como si faltara contestar.
function filaDeResena_(sheet, reviewId, estadoSiSeCrea) {
  var data = sheet.getDataRange().getValues();
  var head = data[0];
  var cId  = head.indexOf(COL_ID);
  var fila = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cId] || '').trim() === String(reviewId).trim()) { fila = i + 1; break; }
  }

  if (!fila && estadoSiSeCrea) {
    var r = obtenerResena_(reviewId);   // datos frescos de Google
    registrar_(sheet, r, (r.reviewReply && r.reviewReply.comment) || '', estadoSiSeCrea, 'NO');
    fila = sheet.getLastRow();
  }
  if (!fila) throw new Error('Esa reseña no está en la hoja de control todavía.');

  return {
    fila:    fila,
    cResp:   head.indexOf(COL_RESP) + 1,
    cEstado: head.indexOf(COL_ESTADO) + 1,
    cAprob:  head.indexOf(COL_APROB) + 1,
    cFecha:  head.indexOf(COL_FECHA) + 1,
    cEstr:   head.indexOf('Estrellas') + 1,
    cCli:    head.indexOf('Cliente') + 1,
    cRes:    head.indexOf('Reseña original') + 1
  };
}

// Una sola reseña por id (para regenerar o para dar de alta una vieja).
function obtenerResena_(reviewId) {
  var url = MB_BASE + '/accounts/' + CONFIG.ACCOUNT_ID +
            '/locations/' + CONFIG.LOCATION_ID + '/reviews/' + reviewId;
  return JSON.parse(fetchConReintentos_(url).getContentText());
}

function validarTexto_(texto) {
  var t = String(texto || '').trim();
  if (!t) throw new Error('La respuesta está vacía.');
  if (t.length > MAX_RESPUESTA) {
    throw new Error('La respuesta tiene ' + t.length + ' caracteres; el tope de Google es ' + MAX_RESPUESTA + '.');
  }
  return t;
}

// Guarda el texto sin publicar nada. Deja Aprobar en NO a propósito: si Juanma
// solo guardó, el trigger `publicarAprobadas` no debe soltarlo a Google.
function guardarBorrador(reviewId, texto) {
  var t = validarTexto_(texto);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = filaDeResena_(sheet, reviewId, 'PENDIENTE_APROBAR');
    sheet.getRange(p.fila, p.cResp).setValue(t);
    sheet.getRange(p.fila, p.cAprob).setValue('NO');

    // Si ya se publicó, guardar texto no la devuelve a pendiente.
    var estado = String(sheet.getRange(p.fila, p.cEstado).getValue() || '');
    if (estado.indexOf('PUBLICADA') !== 0) {
      estado = 'PENDIENTE_APROBAR';
      sheet.getRange(p.fila, p.cEstado).setValue(estado);
    }
    return { ok: true, estado: estado, texto: t };
  } finally {
    lock.releaseLock();
  }
}

// Publica en Google y deja la hoja en el mismo estado que dejaría el trigger.
// Se escribe en la hoja DESPUÉS de que Google confirme: si la API falla, la
// fila no queda mintiendo que ya se publicó.
function publicarDesdePanel(reviewId, texto) {
  var t = validarTexto_(texto);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = filaDeResena_(sheet, reviewId, 'PENDIENTE_APROBAR');
    publicarRespuesta_(reviewId, t);                       // <- puede lanzar
    sheet.getRange(p.fila, p.cResp).setValue(t);
    sheet.getRange(p.fila, p.cEstado).setValue('PUBLICADA_APROBADA');
    sheet.getRange(p.fila, p.cAprob).setValue('SI');
    sheet.getRange(p.fila, p.cFecha).setValue(new Date());
    return { ok: true, estado: 'PUBLICADA_APROBADA', texto: t };
  } finally {
    lock.releaseLock();
  }
}

// Vuelve a pedirle un borrador al modelo, con las mismas reglas de voz del bot.
// No publica: solo devuelve el texto para que se vea en el panel y se edite.
function regenerarBorrador(reviewId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = filaDeResena_(sheet, reviewId, 'PENDIENTE_APROBAR');
    var estrellas = Number(sheet.getRange(p.fila, p.cEstr).getValue()) || 0;
    var nombre    = String(sheet.getRange(p.fila, p.cCli).getValue() || '');
    var texto     = String(sheet.getRange(p.fila, p.cRes).getValue() || '');

    var red = redactarRespuesta_(estrellas, nombre, texto);
    sheet.getRange(p.fila, p.cResp).setValue(red.texto);
    return { ok: true, texto: red.texto, confiable: red.confiable };
  } finally {
    lock.releaseLock();
  }
}

// "Esta no se contesta." Saca la reseña de la lista de pendientes para que el
// correo diario deje de pedirla, sin publicar nada.
function descartarBorrador(reviewId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = filaDeResena_(sheet, reviewId, 'PENDIENTE_APROBAR');
    sheet.getRange(p.fila, p.cEstado).setValue('NO_RESPONDER');
    sheet.getRange(p.fila, p.cAprob).setValue('NO');
    return { ok: true, estado: 'NO_RESPONDER' };
  } finally {
    lock.releaseLock();
  }
}

// Reemplaza en Google una respuesta YA publicada. Mismo endpoint que publicar:
// la API pisa la respuesta anterior, no agrega una segunda.
// Existe por los dos casos de julio y agosto de 2026 en que el bot publicó el
// razonamiento del modelo pegado al texto bueno. Los dos se corrigieron a mano
// entrando a Google Business; esto evita ese rodeo la próxima vez.
function editarRespuestaPublicada(reviewId, texto) {
  var t = validarTexto_(texto);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = filaDeResena_(sheet, reviewId, 'PUBLICADA_EDITADA');
    publicarRespuesta_(reviewId, t);                       // <- puede lanzar
    sheet.getRange(p.fila, p.cResp).setValue(t);
    sheet.getRange(p.fila, p.cEstado).setValue('PUBLICADA_EDITADA');
    sheet.getRange(p.fila, p.cAprob).setValue('SI');
    sheet.getRange(p.fila, p.cFecha).setValue(new Date());
    return { ok: true, estado: 'PUBLICADA_EDITADA', texto: t };
  } finally {
    lock.releaseLock();
  }
}
