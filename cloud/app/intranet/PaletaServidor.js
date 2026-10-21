/**
 * La paleta de la intranet, en UN solo lugar (decisión de Juanma, 15-oct-2026).
 *
 * Antes había 143 colores sueltos y cuatro semáforos distintos (Profit, Finanzas,
 * Marketing y Pruebas). Ahora:
 *   - las pantallas usan var(--token): cada página pega paletaCss_() en su <head>;
 *   - los correos, el PDF y las hojas (que no entienden var()) leen PALETA_ directo.
 * Ningún .html escribe un color en hexadecimal: lo vigila la prueba
 * "Ningún color suelto fuera de la paleta" (Pruebas.js).
 *
 * Nombres y valores de marca = rosanta-design-system/tokens.css = guía de marca.
 * El semáforo se movió un poco (verde hacia azul, rojo hacia naranja) para que una
 * persona daltónica distinga "bien" de "mal"; todo texto cumple contraste 4.5:1
 * sobre crema y blanco.
 */
var PALETA_ = {
  // Marca
  '--rosanta-verde': '#4E6D5A',
  '--rosanta-verde-medio': '#57A77F',
  '--rosanta-lila': '#AEAAE2',
  '--rosanta-crema': '#F2EEEB',
  '--rosanta-negro': '#000000',
  '--rosanta-blanco': '#FFFFFF',
  '--rosanta-verde-tint': '#EEF4EF',
  '--rosanta-lila-tint': '#F2F0F8',
  '--lila-texto': '#5B56A6',
  // Texto, líneas y fondos
  '--texto': '#14180F',
  '--texto-2': '#3E4438',
  '--texto-suave': '#62665D',
  '--linea': '#E3DED6',
  '--linea-2': '#C9C6C0',
  '--panel': '#EAE5DE',
  '--panel-2': '#E0DAD1',
  // Semáforo
  '--ok': '#1E6A50',
  '--ok-tint': '#E2EFE5',
  '--alerta': '#8A6420',
  '--alerta-relleno': '#C89A3C',
  '--alerta-tint': '#FBF3E2',
  '--alerta-linea': '#EAD9B0',
  '--mal': '#B23A1E',
  '--mal-relleno': '#C4553B',
  '--mal-tint': '#F6E4DF',
  '--mal-linea': '#E3A99B',
  '--info': '#40708F',
  // Sobre el encabezado verde
  '--sobre-verde-ok': '#D3F2DE',
  '--sobre-verde-alerta': '#FBE3A6',
  '--sobre-verde-mal': '#FFD9CF',
  '--sobre-verde-texto': '#DCE7DF'
};

/* Alias de uso: en claro valen lo mismo que la marca; en el modo oscuro de Profit OS
   cambian sin tocar el blanco del texto sobre verde. */
var PALETA_ALIAS_ = {
  '--superficie': 'var(--rosanta-blanco)',
  '--fondo': 'var(--rosanta-crema)',
  '--encabezado': 'var(--rosanta-verde)',
  '--rosanta-font-hero': "'Peskia', 'Playfair Display', Georgia, serif",
  '--rosanta-font-title': "'Playfair Display', Georgia, serif",
  '--rosanta-font-body': "'Avenir', 'Avenir Next', 'Lato', system-ui, sans-serif",
  '--rosanta-font-label': "'Poppins', system-ui, sans-serif",
  '--rosanta-radius-card': '14px',
  '--rosanta-radius-pill': '20px',
  '--rosanta-radius-chip': '9px'
};

/* Modo oscuro: solo Profit OS lo tenía, y solo ahí se aplica (paletaCssOscuro_). */
var PALETA_OSCURO_ = {
  '--superficie': '#1B211A',
  '--fondo': '#12160F',
  '--encabezado': '#16201B',
  '--rosanta-crema': '#12160F',
  '--panel': '#222A20',
  '--panel-2': '#2B342A',
  '--texto': '#EDEAE3',
  '--texto-2': '#CBC8C0',
  '--texto-suave': '#979E90',
  '--linea': '#2F382D',
  '--linea-2': '#3C4739',
  '--rosanta-verde': '#8FB8A0',
  '--rosanta-verde-medio': '#6FC095',
  '--rosanta-lila': '#BEBAEE',
  '--rosanta-verde-tint': '#1F2A22',
  '--rosanta-lila-tint': '#2A2838',
  '--lila-texto': '#A9A6C4',
  '--ok': '#6FC095',
  '--ok-tint': '#1F3326',
  '--alerta': '#E0B860',
  '--alerta-tint': '#3A2F17',
  '--alerta-linea': '#5C4A22',
  '--mal': '#E08A62',
  '--mal-relleno': '#E08A62',
  '--mal-tint': '#3A1F18',
  '--mal-linea': '#6B3326',
  '--info': '#7FAECB',
  '--sobre-verde-texto': '#A8C7B2'
};

function paletaBloque_(obj) {
  return Object.keys(obj).map(function (k) { return k + ':' + obj[k] + ';'; }).join('');
}

/** <link> de las letras + :root con todos los tokens + RC() para leer un token desde JS. */
function paletaCss_() {
  return '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400' +
    '&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Poppins:wght@500;600&display=swap">' +
    '<style>:root{' + paletaBloque_(PALETA_) + paletaBloque_(PALETA_ALIAS_) + '}</style>' +
    // Para SVG y Chart.js: devuelve el valor ya resuelto del token (respeta el modo oscuro).
    '<script>function RC(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}</script>';
}

/** Modo oscuro (solo Profit OS): sigue al sistema y al data-theme de la página. */
function paletaCssOscuro_() {
  var b = paletaBloque_(PALETA_OSCURO_);
  return '<style>@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + b + 'color-scheme:dark;}}' +
    ':root[data-theme="dark"]{' + b + 'color-scheme:dark;}</style>';
}

/** Para correos, PDF y hojas: el hexadecimal de un token. */
function paletaHex_(token) {
  var v = PALETA_[token];
  if (!v) throw new Error('Token de paleta inexistente: ' + token);
  return v;
}
