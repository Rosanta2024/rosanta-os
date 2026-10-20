/**
 * Partes de Clientes que suma la sesion "Nube: bot, reseñas y encuesta en sombra" (19-oct-2026).
 * servicio-f2.js lee PARTES (y, si las junta, NOMBRES y LIBROS) sin que haga falta editarlo.
 *
 * Las partes son las de la matriz de accesos (migracion 020): 'consola' (consola del bot) y
 * 'resenas' (reseñas y encuesta). Las dos, solo el dueño. La comparacion del bot en sombra va dentro
 * de 'consola'; la encuesta, dentro de 'resenas' (la nota de la 020 dice "reseñas y encuesta").
 */
const GBP_ID = '17VHTRhelYtEKXjkf4dckPRrAwjif8owu22OLMxBl9bo';        // Rosanta - Control de Reseñas GBP
const ENCUESTA_ID = '1zZuqsBgjC3hYRJfdXe6zz8SxYCNbMBtBDvc3qy1nPf0';   // Rosanta_Encuesta_Satisfaccion

module.exports = {
  PARTES: ['consola', 'resenas'],
  NOMBRES: { consola: 'Bot', resenas: 'Reseñas y encuesta' },
  // Hojas que la copia de la sombra 2 tiene que traer para estas partes (Lector). Rosanta Leads y
  // la pestaña cotizaciones de Marketing OS ya estan en su copia.
  LIBROS: {
    resenas: { id: GBP_ID, pestanas: ['Reseñas', 'TripAdvisor'] },
    encuesta: { id: ENCUESTA_ID, pestanas: ['Encuesta 2026'] }
  },
  GBP_ID, ENCUESTA_ID
};
