#!/usr/bin/env node
/** Revisión de contenido visible en ES y EN (sin JSON-LD ni scripts). */
'use strict';
const BASE = 'https://www.rosanta.rest';
const get = async (u) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u + '?c=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } });
      return r.ok ? await r.text() : '';
    } catch (e) { await new Promise(s => setTimeout(s, 1500)); }
  }
  return '';
};
const visible = (h) => h
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#[0-9]+;/g, ' ')
  .replace(/\s+/g, ' ');

(async () => {
  const es = await get(BASE + '/es');
  const esMenu = await get(BASE + '/es/full-menu');
  const esGift = await get(BASE + '/es/gift-ideas');
  const en = await get(BASE + '/');
  const enMenu = await get(BASE + '/full-menu');

  const vEs = visible(es), vMenu = visible(esMenu), vGift = visible(esGift), vEn = visible(en), vEnMenu = visible(enMenu);

  const bloque = (titulo, texto, marcas) => {
    const falta = marcas.filter(m => !texto.includes(m));
    console.log((falta.length ? '  ✗ ' : '  ✓ ') + titulo + ': ' + (marcas.length - falta.length) + '/' + marcas.length + (falta.length ? '   FALTAN: ' + JSON.stringify(falta) : ''));
    return falta;
  };

  console.log('HOME EN ESPAÑOL (/es)');
  bloque('hero', vEs, ['UN JARDÍN QUE DA', 'Y UNA COCINA AGRADECIDA']);
  bloque('the joy', vEs, ['EL PLACER DE LA COCINA HONESTA', 'Aquí el sabor empieza en la tierra', 'Reservaciones']);
  bloque('cocina honesta', vEs, ['COCINA HONESTA:', 'Empieza en la tierra', 'Buena parte de lo que pruebas', 'La barra cuenta la misma historia', 'Aquí nada se apura', 'Y luego está el jardín', 'Así que acomódate']);
  bloque('bloque menú', vEs, ['MENÚ', 'MENÚ COMPLETO']);
  bloque('propósito', vEs, ['COCINA CON PROPÓSITO', 'Cada detalle que encuentras', 'Muchos de los ingredientes', 'Cocinamos con principios', 'Así se hace gastronomía sostenible', 'Cocina que nace de la tierra']);
  bloque('lockup/coordenadas', vEs, ['JARDÍN', 'COSECHA', 'MESA', 'REUNIÓN', 'SOBREMESA', 'RECUERDO', '91° O', 'Las coordenadas de Antigua']);
  bloque('pie', vEs, ['CONTACTO', 'DIRECCIÓN', 'HORARIOS', 'Lunes', 'Martes', 'Mié - Jue', 'Viernes - Sábado', 'Domingo', 'Del jardín a tu mesa']);
  bloque('navegación', vEs, ['COCINA HONESTA', 'MENÚ', 'GALERÍA', 'RESERVACIONES', 'EVENTOS', 'IDEAS PARA REGALAR']);

  console.log('\nMENÚ EN ESPAÑOL (/es/full-menu)');
  bloque('cabecera', vMenu, ['MENÚ ROSANTA · ANTIGUA GUATEMALA', 'Cocina de temporada en el corazón', 'nuestra carta de cocteles']);
  bloque('secciones', vMenu, ['PARA EMPEZAR', 'OPCIONES SALUDABLES', 'HAMBURGUESAS', 'ALGO MÁS FUERTE', 'Para Acompañar', 'BEBIDAS', 'CÓCTELES', 'VINOS', 'CAVA']);
  bloque('platos', vMenu, ['Ensalada Rosanta', 'Lomito Rosanta', 'Bol Mediterráneo', 'Pescado del Día', 'Pasta de la Casa', 'Coliflor a la Parrilla']);
  bloque('variantes', vMenu, ['Normal', 'Lomito', 'Camarones', 'Copa', 'Botella']);
  bloque('etiquetas', vMenu, ['Hecho en casa', 'De origen local', 'Opción vegana']);

  console.log('\nGIFT IDEAS EN ESPAÑOL (/es/gift-ideas)');
  bloque('todo', vGift, ['IDEAS PARA REGALAR', 'Hay regalos que terminan en un cajón', 'REGALA UNA NOCHE', 'Hay regalos que se abren una vez', 'Disponibles en Q500 y Q300', 'REGALA ROSANTA', 'SABORES DE ROMANCE', 'La Cena Romántica', 'HAZ RECUERDOS QUE VALGA LA PENA GUARDAR']);

  console.log('\nFUGAS DE INGLÉS EN LAS PÁGINAS ESPAÑOLAS');
  const fugas = (nom, texto, marcas) => {
    const hay = marcas.filter(m => texto.includes(m));
    console.log((hay.length ? '  ⚠ ' : '  ✓ ') + nom + ': ' + (hay.length ? hay.length + ' → ' + JSON.stringify(hay) : 'limpio'));
  };
  fugas('/es', vEs, ['COOKING WITH PURPOSE', 'THE JOY OF HONEST', 'It begins in the soil', 'Every detail you find', 'Much of what you', 'GRATEFUL KITCHEN', 'Monday', 'Tuesday', 'Sunday', 'OPEN HOURS', 'ADDRESS', 'CONTACT INFO', 'From the garden to your table', 'FULL MENU', 'HONEST COOKING', 'GALLERY', 'RESERVATIONS', 'GIFT IDEAS']);
  fugas('/es/full-menu', vMenu, ['ROSANTA MENU ·', 'Seasonal cooking in the heart', 'signature', 'TO START', 'HEALTHY OPTIONS', 'SOMETHING STRONGER', 'DRINKS', 'COCKTAILS', 'WINES', 'Rosanta Salad', 'Mediterranean Bowl', 'Glass', 'Bottle', 'House-made']);
  fugas('/es/gift-ideas', vGift, ['GIVE A NIGHT', 'FLAVOURS OF ROMANCE', 'GIVE ROSANTA', 'Some gifts', 'MAKE MEMORIES']);

  console.log('\nFUGAS DE ESPAÑOL EN LAS PÁGINAS INGLESAS');
  fugas('/', vEn, ['UN JARDÍN QUE DA', 'COCINA CON PROPÓSITO', 'EL PLACER', 'Reservaciones', 'MENÚ COMPLETO', 'CONTACTO', 'DIRECCIÓN', 'HORARIOS']);
  fugas('/full-menu', vEnMenu, ['MENÚ ROSANTA', 'PARA EMPEZAR', 'Ensalada Rosanta', 'Bol Mediterráneo', 'Copa', 'Botella']);

  console.log('\nTÉRMINO PROHIBIDO ("de autor" / "signature")');
  for (const [nom, t] of [['/', vEn], ['/es', vEs], ['/full-menu', vEnMenu], ['/es/full-menu', vMenu], ['/es/gift-ideas', vGift]]) {
    const a = (t.match(/de autor/gi) || []).length, s = (t.match(/signature/gi) || []).length;
    console.log('  ' + (a + s ? '⚠ ' : '✓ ') + nom.padEnd(16) + ' "de autor": ' + a + ' · "signature": ' + s);
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
