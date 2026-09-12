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
 *   - SHEET_ID           : ID del Google Sheet (ya viene el de Rosanta por defecto)
 *   - SHEET_NAME         : nombre de la pestaña destino
 *   - GOOGLE_REVIEW_URL  : tu link directo "escribir reseña" de Google
 *  (Ver la guía para obtener el GOOGLE_REVIEW_URL.)
 */

var CFG = {
  SHEET_ID:   prop_('SHEET_ID')   || '1I-98EGh6oFj0X5EeWsnbJ5KPMctdv8fAjc2ML1tLnEc',
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

// Prueba rápida desde el editor: inserta una fila de ejemplo (rating 4, no redirige).
function pruebaInsertar() {
  var r = enviarRespuesta({
    rating: 4, nombre: 'PRUEBA', whatsapp: '', email: '',
    fuente: 'Los encontré en Google', mesero: 'Marvin',
    cumple: '', feedback: 'Esto es una prueba', lang: 'es', website: ''
  });
  Logger.log('Resultado: ' + JSON.stringify(r));
}