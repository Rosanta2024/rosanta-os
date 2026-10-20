/**
 * La entrada de Rosanta en el teléfono (19-oct-2026, pedido de Juanma con capturas del iPhone).
 *
 * El acceso directo "Rosanta Intranet" de la pantalla de inicio salía como una "R" gris: iOS toma el ícono
 * (apple-touch-icon) de la página desde la que se agrega, y la intranet corre dentro de la página de
 * Google (script.google.com), donde no se puede poner nada. Por eso hay una entrada propia:
 *
 *   /intranet?instalar=1   página para agregar a inicio: lleva el ícono y el nombre "Rosanta" y deja la
 *                          dirección en /intranet (sin "instalar"), que es lo que guarda el acceso directo.
 *   /intranet[?u=enlace]   abre la intranet de siempre (con el mismo enlace, si lo trae).
 *   /marca/...             los íconos: la "O" de Rosanta (isotipo del Brand Kit) en crema sobre verde bosque,
 *                          con el aire que pide la regla de marca. La intranet usa /marca/favicon-32.png.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'marca');
const INTRANET_URL = 'https://script.google.com/macros/s/AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb/exec';
const ARCHIVOS = ['apple-touch-icon.png', 'favicon-32.png', 'icono-192.png', 'icono-512.png'];
const VERDE = '#4E6D5A', CREMA = '#F0ECE8';   // Brand Kit: verde bosque y crema

/** Solo un enlace con forma de enlace: va dentro de la dirección. */
const enlaceLimpio = (t) => (/^[A-Za-z0-9_-]{8,200}$/.test(String(t || '')) ? String(t) : '');

const MANIFIESTO = {
  name: 'Rosanta', short_name: 'Rosanta', start_url: '/intranet', display: 'browser',
  background_color: VERDE, theme_color: VERDE,
  icons: [{ src: '/marca/icono-192.png', sizes: '192x192', type: 'image/png' }, { src: '/marca/icono-512.png', sizes: '512x512', type: 'image/png' }]
};

function cabeza(titulo) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + titulo + '</title><meta name="apple-mobile-web-app-title" content="Rosanta"><meta name="theme-color" content="' + VERDE + '">' +
    '<link rel="apple-touch-icon" href="/marca/apple-touch-icon.png"><link rel="icon" type="image/png" sizes="32x32" href="/marca/favicon-32.png">' +
    '<link rel="manifest" href="/marca/manifest.webmanifest">' +
    '<style>body{margin:0;background:' + VERDE + ';color:' + CREMA + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}main{max-width:22rem;padding:24px}' +
    'img{width:96px;height:96px;border-radius:22px}h1{font-size:1.4rem;margin:16px 0 8px}p,li{line-height:1.5;font-size:1rem}' +
    'ol{text-align:left;padding-left:1.2rem}a.btn{display:inline-block;margin-top:16px;background:' + CREMA + ';color:' + VERDE + ';' +
    'text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;min-height:44px;box-sizing:border-box}</style></head>';
}

/** /intranet: abre la intranet de siempre (o, con ?instalar=1, la página para agregar a inicio). */
function paginaIntranet(query) {
  const u = enlaceLimpio(query && query.u);
  const destino = INTRANET_URL + (u ? '?u=' + encodeURIComponent(u) : '');
  const propia = '/intranet' + (u ? '?u=' + encodeURIComponent(u) : '');
  if (query && query.instalar) {
    return cabeza('Rosanta') + '<body><main><img src="/marca/apple-touch-icon.png" alt="">' +
      '<h1>Rosanta en tu teléfono</h1><p>Agregalo desde ESTA página, sin abrir la intranet antes:</p>' +
      '<ol><li>Tocá el botón <b>Compartir</b> (el cuadro con la flecha hacia arriba).</li>' +
      '<li>Elegí <b>Agregar a inicio</b>. Tiene que decir <b>Rosanta</b> y mostrar la O verde.</li><li>Tocá <b>Agregar</b>.</li></ol>' +
      '<p>Después abrí el ícono nuevo: te lleva a la intranet.</p></main>' +
      // A proposito SIN boton "Abrir la intranet" (20-oct-2026): Juanma lo toco antes de agregar y el acceso
      // directo se guardo desde la pagina de Google (una "R" gris llamada "Rosanta Receta…").
      // el acceso directo guarda la direccion actual: sin "instalar", para que abra la intranet directo
      '<script>try{history.replaceState(null,"",' + JSON.stringify(propia) + ')}catch(e){}</script></body></html>';
  }
  return cabeza('Rosanta') + '<body><main><img src="/marca/apple-touch-icon.png" alt=""><p>Abriendo la intranet…</p>' +
    '<a class="btn" href="' + destino + '">Abrir</a></main><script>location.replace(' + JSON.stringify(destino) + ')</script></body></html>';
}

function montarEntrada(app) {
  // iOS a veces busca los iconos en la raiz, sin mirar la pagina (20-oct-2026)
  const png = (archivo) => (req, res) => res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(fs.readFileSync(path.join(DIR, archivo)));
  app.get(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], png('apple-touch-icon.png'));
  app.get('/favicon.ico', png('favicon-32.png'));   // un PNG con nombre .ico: lo aceptan todos los navegadores de hoy
  app.get('/marca/manifest.webmanifest', (req, res) => res.set('Cache-Control', 'public, max-age=86400').type('application/manifest+json').send(JSON.stringify(MANIFIESTO)));
  app.get('/marca/:archivo', (req, res) => {
    if (ARCHIVOS.indexOf(req.params.archivo) === -1) return res.status(404).send('No existe.');
    res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(fs.readFileSync(path.join(DIR, req.params.archivo)));
  });
  app.get('/intranet', (req, res) => res.set('Cache-Control', 'no-store').type('html').send(paginaIntranet(req.query)));
}

module.exports = { montarEntrada, paginaIntranet, enlaceLimpio, INTRANET_URL, MANIFIESTO };
