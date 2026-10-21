/**
 * RESEÑAS EN EL SERVIDOR NUEVO (22-oct-2026, sesion "Nube: reseñas y encuesta").
 *
 * La pestaña Reseñas del Sistema de Marketing abre:
 *   - con el interruptor 'resenas' del servidor nuevo en 'base' → el panel EN VIVO de rosanta-nube
 *     (/clientes/resenas), con el enlace de esa persona (como Pagos, getPagosDestino);
 *   - con 'puente', o si el servidor no contesta → el panel de Apps Script de siempre (CONFIG.RESENAS_URL).
 * El interruptor vive en la base del servidor nuevo (tabla interruptores), no en PARAMETROS: es el mismo que
 * leen los activadores del panel de Apps Script, asi no hay dos llaves para lo mismo. Se pregunta a
 * GET /resenas/modo y se guarda 1 minuto.
 * ?nube=ensayo: SOLO el dueño ve el panel del servidor de ENSAYO, para probarlo antes del dia unico.
 */
var NUBE_RESENAS_URL_ = 'https://rosanta-nube-512086396641.northamerica-south1.run.app';

/** 'base' o 'puente'. Sin respuesta del servidor: 'puente' (el panel de siempre). */
function resenasModoNube_() {
  var cache = CacheService.getScriptCache(), g = null;
  try { g = cache.get('res_modo_v1'); } catch (e) { g = null; }
  if (g === 'base' || g === 'puente') return g;
  var m = 'puente';
  try {
    var r = UrlFetchApp.fetch(NUBE_RESENAS_URL_ + '/resenas/modo', { muteHttpExceptions: true, followRedirects: false });
    if (r.getResponseCode() === 200 && JSON.parse(r.getContentText()).modo === 'base') m = 'base';
  } catch (e) { m = 'puente'; }
  try { cache.put('res_modo_v1', m, 60); } catch (e) { /* sin cache: se pregunta cada vez */ }
  return m;
}

/** El enlace de la persona: el ?u= con el que entro o, si entro con la sesion de rosanta.rest, el de USUARIOS. */
function resenasTokenDe_(usuario, authToken) {
  var t = String(authToken || '').trim();
  if (t || !usuario || !usuario.email) return t;
  var filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS').getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0] || '').toLowerCase().trim() === String(usuario.email).toLowerCase().trim()) return String(filas[i][5] || '').trim();
  }
  return '';
}

/** La direccion de la pestaña Reseñas. nube: el ?nube= de la direccion ('ensayo' solo vale para el dueño). */
function resenasDestino_(usuario, authToken, nube) {
  var ensayo = nube === 'ensayo' && !!usuario && normalizar_(usuario.rol) === 'dueno';
  if (!ensayo && resenasModoNube_() !== 'base') return CONFIG.RESENAS_URL;
  var token = resenasTokenDe_(usuario, authToken);
  if (!token) return CONFIG.RESENAS_URL;   // sin enlace no se puede entrar al servidor nuevo: el panel de siempre
  return (ensayo ? NUBE_ENSAYO_URL_ : NUBE_RESENAS_URL_) + '/clientes/resenas?u=' + encodeURIComponent(token) + '&dentro=1';
}
