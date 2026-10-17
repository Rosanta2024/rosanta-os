// ---- de Code.js
// Prueba rápida desde el editor: inserta una fila de ejemplo (rating 4, no redirige).
function pruebaInsertar() {
  var r = enviarRespuesta({
    rating: 4, nombre: 'PRUEBA', whatsapp: '', email: '',
    fuente: 'Los encontré en Google', mesero: 'Marvin',
    cumple: '', feedback: 'Esto es una prueba', lang: 'es', website: ''
  });
  Logger.log('Resultado: ' + JSON.stringify(r));
}
