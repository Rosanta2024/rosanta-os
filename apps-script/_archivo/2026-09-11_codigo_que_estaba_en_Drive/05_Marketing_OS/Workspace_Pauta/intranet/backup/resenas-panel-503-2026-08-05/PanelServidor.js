/**
 * ============================================================
 *  ROSANTA - Panel de Reseñas de Google (Web App privado)
 *  Se sirve desde el mismo proyecto del bot. Jala TODAS las
 *  reseñas en vivo desde la API de Google, calcula la puntuación
 *  global y cuántas reseñas de 5 estrellas faltan para subir.
 *  Usa las mismas CONFIG, MB_BASE y STAR_MAP de Code.gs.
 *
 *  El archivo HTML debe llamarse EXACTAMENTE: Panel de Reseñas de Google
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

// Devuelve todo lo que el panel necesita (se llama con google.script.run).
function getDatosDashboard() {
  var reviews = [];
  var base = MB_BASE + '/accounts/' + CONFIG.ACCOUNT_ID +
             '/locations/' + CONFIG.LOCATION_ID + '/reviews?pageSize=50&orderBy=updateTime%20desc';
  var averageRating = 0, totalReviewCount = 0, pageToken = '', guard = 0;

  do {
    var url = base + (pageToken ? '&pageToken=' + pageToken : '');
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      throw new Error('Error API (' + res.getResponseCode() + '): ' + res.getContentText());
    }
    var data = JSON.parse(res.getContentText());
    if (data.averageRating)   averageRating = data.averageRating;
    if (data.totalReviewCount) totalReviewCount = data.totalReviewCount;
    (data.reviews || []).forEach(function (r) {
      reviews.push({
        stars: STAR_MAP[r.starRating] || 0,
        name: (r.reviewer && r.reviewer.displayName) || 'Anónimo',
        comment: r.comment || '',
        time: r.createTime || r.updateTime || '',
        hasReply: !!(r.reviewReply && r.reviewReply.comment),
        reply: (r.reviewReply && r.reviewReply.comment) || ''
      });
    });
    pageToken = data.nextPageToken || '';
    guard++;
  } while (pageToken && guard < 40);

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