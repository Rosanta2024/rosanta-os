#!/usr/bin/env node
/**
 * Auditoría del multilenguaje del sitio (solo lectura).
 * Para cada página relevante: estado HTTP en EN y ES, atributo lang, hreflang,
 * enlace del selector al otro idioma, navegación traducida y fugas de inglés.
 */
'use strict';

const PAGINAS = [
  ['Home', ''],
  ['Menú completo', '/full-menu'],
  ['Gift Ideas', '/gift-ideas'],
  ['Events', '/events'],
  ['Gift Card', '/gift-card'],
  ['Preguntas Frecuentes', '/preguntas-frecuentes'],
  ['Política de Privacidad', '/política-de-privacidad'],
  ['Reservas', '/reservas'],
  ['Loyalty', '/loyalty']
];

// palabras de navegación: si el ES muestra la versión inglesa, hay fuga
const NAV_EN = ['>HONEST COOKING<', '>GALLERY<', '>RESERVATIONS<', '>EVENTS<', '>GIFT IDEAS<'];
const NAV_ES = ['>COCINA HONESTA<', '>GALERÍA<', '>RESERVACIONES<', '>EVENTOS<', '>IDEAS PARA REGALAR<'];

const get = async (u) => {
  try {
    const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'a=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' }, redirect: 'follow' });
    return { status: r.status, url: r.url, html: r.ok ? await r.text() : '' };
  } catch (e) { return { status: 'ERR ' + e.message, url: u, html: '' }; }
};
const cuenta = (h, arr) => arr.filter(s => h.includes(s)).length;
const attr = (h, re) => { const m = h.match(re); return m ? m[1] : null; };

(async () => {
  const base = 'https://www.rosanta.rest';
  console.log('AUDITORÍA MULTILENGUAJE · rosanta.rest\n' + '='.repeat(78));

  for (const [nombre, ruta] of PAGINAS) {
    const en = await get(base + (ruta || '/'));
    const es = await get(base + '/es' + (ruta || ''));
    console.log('\n■ ' + nombre + '   ' + (ruta || '/'));
    console.log('   EN ' + en.status + '   ES ' + es.status);
    if (!es.html) { console.log('   ⚠ la versión ES no cargó'); continue; }

    const lang = attr(es.html, /<html[^>]*lang="([^"]+)"/);
    console.log('   lang del HTML en ES: ' + JSON.stringify(lang) + (lang === 'es' ? ' ✓' : ' ✗'));

    // hreflang
    const hre = (es.html.match(/hreflang="[^"]+"[^>]*href="[^"]+"|href="[^"]+"[^>]*hreflang="[^"]+"/g) || []);
    const tags = [...new Set((es.html.match(/hreflang="([^"]+)"/g) || []).map(x => x.replace(/hreflang="|"/g, '')))];
    console.log('   hreflang: ' + (tags.length ? tags.join(', ') : '(ninguno)') + (tags.includes('x-default') ? ' ✓' : ''));

    // selector: ¿la página EN enlaza a /es y la ES a la raíz?
    const enLinkaEs = /href="[^"]*rosanta\.rest\/es(\/|"|\?)/.test(en.html) || /href="\/es(\/|"|\?)/.test(en.html);
    const esLinkaEn = /href="[^"]*rosanta\.rest\/(?!es)[^"]*"[^>]*>\s*EN\s*</.test(es.html) || es.html.includes('>EN<');
    console.log('   selector: EN→/es ' + (enLinkaEs ? '✓' : '✗') + '   ES muestra EN|ES ' + (esLinkaEn ? '✓' : '✗'));

    // navegación
    const nEs = cuenta(es.html, NAV_ES), nEn = cuenta(es.html, NAV_EN);
    console.log('   navegación en ES: ' + nEs + '/5 en español' + (nEn ? '  ⚠ ' + nEn + ' etiqueta(s) en inglés' : ' ✓'));
  }

  // Chequeo de contenido específico
  console.log('\n' + '='.repeat(78) + '\nCONTENIDO CLAVE EN ESPAÑOL\n');
  const home = await get(base + '/es');
  const menu = await get(base + '/es/full-menu');
  const gi = await get(base + '/es/gift-ideas');

  const bloques = [
    ['Home · hero', home, ['UN JARDÍN QUE DA', 'Y UNA COCINA AGRADECIDA']],
    ['Home · cocina honesta', home, ['COCINA HONESTA:', 'Empieza en la tierra', 'Buena parte de lo que pruebas', 'La barra cuenta la misma historia']],
    ['Home · propósito', home, ['COCINA CON PROPÓSITO', 'Cada detalle que encuentras', 'Cocina que nace de la tierra', '91° O']],
    ['Home · joy + botones', home, ['EL PLACER DE LA COCINA HONESTA', 'Aquí el sabor empieza', 'MENÚ COMPLETO', 'Reservaciones']],
    ['Home · pie', home, ['CONTACTO', 'DIRECCIÓN', 'HORARIOS', 'Lunes', 'Mié - Jue', 'Del jardín a tu mesa']],
    ['Menú · secciones', menu, ['PARA EMPEZAR', 'OPCIONES SALUDABLES', 'HAMBURGUESAS', 'ALGO MÁS FUERTE', 'BEBIDAS', 'CÓCTELES', 'VINOS']],
    ['Menú · platos', menu, ['Ensalada Rosanta', 'Lomito Rosanta', 'Bol Mediterráneo', 'Pescado del Día', 'Pasta de la Casa']],
    ['Menú · variantes/labels', menu, ['Normal', 'Lomito', 'Camarones', 'Copa', 'Botella']],
    ['Gift Ideas', gi, ['IDEAS PARA REGALAR', 'REGALA UNA NOCHE', 'REGALA ROSANTA', 'SABORES DE ROMANCE', 'La Cena Romántica', 'HAZ RECUERDOS']]
  ];
  for (const [nom, pg, marcas] of bloques) {
    const falt = marcas.filter(m => !pg.html.includes(m));
    console.log('   ' + (falt.length ? '✗' : '✓') + ' ' + nom + ': ' + (marcas.length - falt.length) + '/' + marcas.length + (falt.length ? '  faltan: ' + JSON.stringify(falt) : ''));
  }

  // fugas de inglés en ES
  console.log('\nFUGAS DE INGLÉS EN LAS PÁGINAS ES\n');
  const fugas = [
    ['Home', home, ['COOKING WITH PURPOSE', 'THE JOY OF HONEST COOKING', 'It begins in the soil', 'Every detail you find here', 'Much of what you', 'GRATEFUL KITCHEN', 'Monday', 'OPEN HOURS', 'Reservations<']],
    ['Menú', menu, ['TO START', 'HEALTHY OPTIONS', 'SOMETHING STRONGER', 'Rosanta Salad', 'Mediterranean Bowl', 'Glass', 'Bottle']],
    ['Gift Ideas', gi, ['GIVE A NIGHT', 'FLAVOURS OF ROMANCE', 'Some gifts end up in a drawer', 'MAKE MEMORIES']]
  ];
  for (const [nom, pg, marcas] of fugas) {
    const hay = marcas.filter(m => pg.html.includes(m));
    console.log('   ' + (hay.length ? '⚠' : '✓') + ' ' + nom + ': ' + (hay.length ? hay.length + ' fuga(s) → ' + JSON.stringify(hay) : 'sin inglés residual'));
  }

  // hreflang de la home EN (el que ve Google)
  console.log('\n' + '='.repeat(78) + '\nHREFLANG DE LA HOME (lo que lee Google)\n');
  const enHome = await get(base + '/');
  const alt = (enHome.html.match(/<link[^>]*alternate[^>]*>/g) || []);
  for (const a of alt.slice(0, 10)) console.log('   ' + a.replace(/\s+/g, ' '));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
