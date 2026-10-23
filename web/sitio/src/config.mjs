// Configuración del sitio. Lo que cambia por entorno entra por variables PUBLIC_* al construir
// (ver .env.example). Aquí NO van llaves: solo identificadores públicos que ya se ven en el HTML
// de rosanta.rest hoy (GTM, GA4, pixel de Meta, Google Ads, OpenWidget, Poptin).
const env = import.meta.env ?? {};

export const SITIO = 'https://www.rosanta.rest';

/**
 * Base de la API de reservas. Contrato (igual que Wix hoy):
 *   GET  {API_BASE}/slots?date=YYYY-MM-DD&partySize=N  → { slots: [{ startDate }] }
 *   POST {API_BASE}/reservar  (text/plain, JSON)        → { ok, status }
 * Hoy: Wix (https://www.rosanta.rest/_functions). Desde el 13-nov: la API de la nube con el MISMO
 * contrato (por ejemplo /api/reservas, que Firebase desvía a Cloud Run rosanta-web).
 * OJO: el 17-nov, al mover el DNS, www.rosanta.rest/_functions deja de ser Wix. Antes de esa fecha
 * hay que construir con PUBLIC_API_BASE apuntando a la nube.
 */
export const API_BASE = env.PUBLIC_API_BASE || 'https://www.rosanta.rest/_functions';

/** Receptor de carritos abandonados (vacío = no se envían). Sin token en el código. */
export const CARRITO_URL = env.PUBLIC_CARRITO_URL || '';

/**
 * Clave de Google Maps/Places para las estrellas de reseñas. La del sitio de Wix NO se copia.
 * Hay que crear una nueva, restringida por dominio (rosanta.rest) y por API (Places).
 * Vacía = el bloque de reseñas muestra solo el enlace a Google.
 */
export const GOOGLE_MAPS_KEY = env.PUBLIC_GOOGLE_MAPS_KEY || '';
export const GOOGLE_PLACE_ID = 'ChIJD7ZplPAPiYURYy8eOkRI_q8';

/** Compra de gift cards: en Wix es Wix Gift Cards. Hasta que esté Recurrente, va a WhatsApp. */
export const GIFTCARD_URL = env.PUBLIC_GIFTCARD_URL || '';

/** Formulario de cotización de /events-1 (Juanma, 20-oct): rosanta-web → pipeline de eventos. Firebase desvía /api/** a rosanta-web. */
export const COTIZACION_URL = env.PUBLIC_COTIZACION_URL || '/api/eventos/cotizacion';

/**
 * Versión de PRUEBA (PUBLIC_PRUEBA=si): la que revisa Juanma antes del 30-oct. Sin medición (no ensucia Analytics,
 * Meta ni Google Ads), sin chat ni pop-ups, y con noindex en todas las páginas.
 */
export const PRUEBA = env.PUBLIC_PRUEBA === 'si';
const fuera = (v) => (PRUEBA ? '' : v);

// Medición (identificadores públicos que hoy carga Wix)
export const GTM_ID = fuera('GTM-M78RL4HH');
export const GA4_ID = fuera(env.PUBLIC_GA4_ID ?? 'G-C3VYE93J0F');
export const META_PIXEL_ID = fuera(env.PUBLIC_META_PIXEL_ID ?? '1107259034759950');
export const GOOGLE_ADS_ID = fuera(env.PUBLIC_GOOGLE_ADS_ID ?? 'AW-11048575753');
export const OPENWIDGET_ORG = fuera(env.PUBLIC_OPENWIDGET_ORG ?? 'e0f92881-04e9-448b-a033-e11e7ac23c68');
export const POPTIN_ID = fuera(env.PUBLIC_POPTIN_ID ?? 'f8c6c5bcd2e35');

/** /encuesta: hoy es un iframe al Apps Script de encuestas (web app pública). */
export const ENCUESTA_URL =
  env.PUBLIC_ENCUESTA_URL ??
  'https://script.google.com/macros/s/AKfycby0mhAdlUuzOo7_tD-SHYmLMb4bNcFgT9SlI07bh5VO0tGUqA3rlqOUO6Sq7Mnm9TgefQ/exec';

export const WHATSAPP = '50230826935';
export const WAZE = 'http://waze.com/ul/h9fx6z6tn9';

/**
 * Web v3 (rediseño visual, 24-oct): PUBLIC_V3=si construye la portada, la carta, el encabezado y el pie nuevos.
 * Solo se usa en la prueba rosanta-web-v3-ensayo. Sin la variable, el sitio queda exactamente como está.
 */
export const V3 = env.PUBLIC_V3 === 'si';
