/**
 * ============================================================
 *  ROSANTA - Encuesta de satisfacción (reemplazo del form de GHL)
 *  Apps Script Web App: sirve el formulario, guarda en el mismo
 *  Google Sheet y aplica la lógica de redirección:
 *     5 estrellas  -> redirige a Google Reviews
 *     1-4 estrellas -> guarda feedback interno (sin redirigir)
 * ============================================================
 *
 *  Configura en "Propiedades del script":
 *   - SHEET_ID           : ID del Google Sheet. El default ya es la hoja propia de
 *                          Rosanta; la propiedad, si existe, MANDA sobre el default.
 *   - SHEET_NAME         : nombre de la pestaña destino
 *   - GOOGLE_REVIEW_URL  : tu link directo "escribir reseña" de Google
 *  (Ver la guía para obtener el GOOGLE_REVIEW_URL.)
 */

var CFG = {
  // 12-sep-2026: hasta hoy el default era 1I-98EGh6oFj0X5EeWsnbJ5KPMctdv8fAjc2ML1tLnEc,
  // el Sheet 'Recoleccion de data - Rosanta', PROPIEDAD DE UN TERCERO
  // (Eli_Juli@lacocinaquesuena.com). Rosanta ya no trabaja con ellos y toda respuesta
  // caia en una cuenta ajena que podia revocar el acceso o borrarla. Se copio la hoja a
  // Rosanta OS/05_Marketing_OS/Resenas_y_Reputacion/Rosanta_Encuesta_Satisfaccion y el
  // default apunta a esa copia. OJO: si la propiedad SHEET_ID del proyecto todavia tiene
  // el id viejo, GANA LA PROPIEDAD y este cambio no hace nada. Ver p81.
  SHEET_ID:   hojaRosanta_(),
  SHEET_NAME: prop_('SHEET_NAME') || 'Encuesta 2026',
  // Link directo de reseña de Rosanta (Google Business Profile):
  GOOGLE_REVIEW_URL: prop_('GOOGLE_REVIEW_URL') || 'https://g.page/r/CWMvHjpESP6vEAE/review'
};

// ---- Sirve el formulario ----
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Rosanta · Tu opinión')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // permite incrustar en tu sitio
}

// ---- Recibe la respuesta del formulario ----
function enviarRespuesta(data) {
  // Anti-spam: si el honeypot trae algo, lo ignoramos en silencio.
  if (data && data.website) return { redirect: null };

  var rating = parseInt(data.rating, 10) || 0;
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sheet = ss.getSheetByName(CFG.SHEET_NAME);
  if (!sheet) throw new Error('No se encontró la pestaña: ' + CFG.SHEET_NAME);

  // Hoja "Encuesta 2026" — solo 3 columnas:
  // A Fecha | B Calificación | C ¿Qué podríamos mejorar?
  sheet.appendRow([
    new Date(),            // A Fecha
    rating,                // B Calificación
    data.feedback || ''    // C ¿Qué podríamos mejorar?
  ]);

  // Lógica de redirección (review gating actual)
  if (rating >= 5) {
    return { redirect: CFG.GOOGLE_REVIEW_URL };
  }
  return { redirect: null };
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * El id de la hoja donde cae la encuesta.
 *
 * No es un prop_() a secas a proposito. El valor viejo,
 * 1I-98EGh6oFj0X5EeWsnbJ5KPMctdv8fAjc2ML1tLnEc, es el Sheet
 * 'Recoleccion de data - Rosanta', PROPIEDAD DE UN TERCERO
 * (Eli_Juli@lacocinaquesuena.com) con quien Rosanta ya no trabaja. Si ese id
 * quedo escrito en la propiedad SHEET_ID, un prop_() || default lo dejaria
 * ganar y las respuestas seguirian cayendo en una cuenta ajena aunque el
 * codigo se vea corregido. Aca se ignora explicitamente.
 */
function hojaRosanta_() {
  // Se ignora la propiedad SHEET_ID a proposito, no por descuido.
  //
  // El 12-sep-2026 se intento respetarla ignorando solo el valor exacto del id
  // ajeno. NO FUNCIONO: se publico, se probo con una respuesta real de 4
  // estrellas y la fila cayo igual en el Sheet del tercero. La propiedad tiene
  // el id viejo en alguna forma que una comparacion exacta no atrapa (espacio
  // al final, la URL completa, algo asi), y no se puede leer desde fuera del
  // editor para saber cual.
  //
  // Mientras la propiedad exista con ese contenido, cualquier `prop_() || x`
  // manda las respuestas a una cuenta ajena aunque el codigo se vea corregido.
  // Si algun dia hace falta cambiar de hoja, se cambia esta constante.
  return '1zZuqsBgjC3hYRJfdXe6zz8SxYCNbMBtBDvc3qy1nPf0';
}

// Prueba rápida desde el editor: inserta una fila de ejemplo (rating 4, no redirige).
function pruebaInsertar() {
  var r = enviarRespuesta({
    rating: 4, nombre: 'PRUEBA', whatsapp: '', email: '',
    fuente: 'Los encontré en Google', mesero: 'Marvin',
    cumple: '', feedback: 'Esto es una prueba', lang: 'es', website: ''
  });
  Logger.log('Resultado: ' + JSON.stringify(r));
}