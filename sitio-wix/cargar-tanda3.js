#!/usr/bin/env node
/**
 * Tanda 3 (19-ago-2026): home (sostenibilidad, hero, coordenadas, MENU),
 * Gift Ideas completa, pie de página y menú de navegación.
 * Español de Juanma, carácter por carácter. Registro + verificación.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';

const T = '181ccb6b-dfb5-4b18-aacc-eadac190f94b'; // rich text

// [entityId, [[en, es], ...]]
const COMPONENTES = [
  ['comp-msvvt1t1', [
    ["Every detail you find here has a reason to be. From the fresh, local and seasonal ingredients we use, to the flavors that seek to reconnect you with what is natural. We cook with respect: for the land, for those who grow it, for what grows nearby, and for you.",
     'Cada detalle que encuentras aquí tiene una razón de ser. Desde los ingredientes frescos, locales y de temporada que usamos, hasta los sabores que buscan reconectarte con lo natural. Cocinamos con respeto: por la tierra, por quienes la trabajan, por lo que crece cerca, y por ti.'],
    ["Many of the ingredients you taste come straight from the garden, a living space grown with regenerative practices that care for the soil and fill it with life. The rest comes from local producers who share that way of seeing the world: harvesting without rush, respecting the season, strengthening the community.",
     'Muchos de los ingredientes que pruebas vienen directo del jardín, un espacio vivo cultivado con prácticas regenerativas que cuidan el suelo y lo llenan de vida. El resto llega de productores locales que comparten esa forma de ver el mundo: cosechar sin prisa, respetar la temporada, fortalecer la comunidad.'],
    ["We cook with principles that matter to us and that represent us. We prefer what is simple and true. Every dish, every cocktail, every corner of this place is meant for you to feel good, to connect with your people, with your surroundings, and with yourself.",
     'Cocinamos con principios que nos importan y que nos representan. Preferimos lo simple y lo verdadero. Cada plato, cada coctel, cada rincón de este lugar está pensado para que te sientas bien, para que conectes con los tuyos, con tu entorno, y contigo mismo.'],
    ["That is how sustainable gastronomy is done here: honest, creative and conscious. Thank you for being part of this space. Enjoy, celebrate, and make memories worth keeping.",
     'Así se hace gastronomía sostenible aquí: honesta, creativa y consciente. Gracias por ser parte de este espacio. Disfruta, celebra, y haz recuerdos que valga la pena guardar.']
  ]],
  ['comp-msvx54vc', [["Cooking that is born from the land and served with purpose.", 'Cocina que nace de la tierra y se sirve con propósito.']]],
  ['comp-msvvq3g7', [["MENU", 'MENÚ']]],
  ['comp-mt07akbq', [["A GARDEN THAT GIVES", 'UN JARDÍN QUE DA']]],
  ['comp-mt07bza3', [["AND A GREATFUL KITCHEN", 'Y UNA COCINA AGRADECIDA']]],
  ['comp-mszgypvv', [
    ["GARDEN", 'JARDÍN'], ["HARVEST", 'COSECHA'], ["TABLE", 'MESA'],
    ["GATHER", 'REUNIÓN'], ["LINGER", 'SOBREMESA'], ["REMEMBER", 'RECUERDO']
  ]],
  ['comp-msvygwmb', [
    ["14° N · 91° W", '14° N · 91° O'],
    ["The coordinates of Antigua. The exact point where almost everything that reaches your table grows.",
     'Las coordenadas de Antigua. El punto exacto donde crece casi todo lo que llega a tu mesa.']
  ]],
  ['comp-moqg08v8', [["GIFT IDEAS", 'IDEAS PARA REGALAR']]],
  ['comp-mszhr53v', [
    ["Some gifts end up in a drawer. Some nights stay with you for good. Give a table, a glass made to your taste, and an evening remembered long after the last light in the garden. This is not an object: it is flavor, a garden, and a story worth telling.",
     'Hay regalos que terminan en un cajón. Hay noches que se quedan contigo para siempre. Regala una mesa, una copa hecha a tu gusto, y una noche que se recuerda mucho después de la última luz del jardín. Esto no es un objeto: es sabor, un jardín, y una historia que vale la pena contar.']
  ]],
  ['comp-mszhs5j2', [["GIVE A NIGHT", 'REGALA UNA NOCHE']]],
  ['comp-mszhv2sb', [
    ["Some gifts are opened once. Some nights are remembered for good. A Rosanta gift card puts a whole evening in someone's hands: honest, garden-to-table cooking, cocktails built to their taste at the bar, and a garden that invites them to stay.",
     'Hay regalos que se abren una vez. Hay noches que se recuerdan para siempre. Una gift card de Rosanta pone una noche entera en las manos de alguien: cocina honesta del jardín a la mesa, cocteles hechos a su gusto en la barra, y un jardín que invita a quedarse.'],
    ["Available in Q500 and Q300, each card arrives personalized, with a note for the person you want to surprise, so the gift feels as thoughtful as the night it holds. Use it for a special meal or for the full experience at the Casa de la Gastrococtelería.",
     'Disponibles en Q500 y Q300, cada tarjeta llega personalizada, con una nota para la persona que quieres sorprender, para que el regalo se sienta tan pensado como la noche que guarda. Úsala para una comida especial o para la experiencia completa en la Casa de la Gastrococtelería.'],
    ["To get yours, write to us, visit 1a Calle Oriente 15, Antigua Guatemala, Sacatepéquez, or call",
     'Para conseguir la tuya, escríbenos, visítanos en 1a Calle Oriente 15, Antigua Guatemala, Sacatepéquez, o llama al'],
    ["(502) 7768-8880, and we will sort out every detail with you.",
     '(502) 7768-8880, y resolvemos cada detalle contigo.']
  ]],
  ['comp-mszhw6of', [["GIVE ROSANTA", 'REGALA ROSANTA']]],
  ['comp-mszhx9gp', [["FLAVOURS OF ROMANCE", 'SABORES DE ROMANCE']]],
  ['comp-mszhy56d', [
    ["Some nights ask for something more. A table for two, a quiet corner, and the rest of the world waiting outside.",
     'Hay noches que piden algo más. Una mesa para dos, un rincón tranquilo, y el resto del mundo esperando afuera.'],
    ["The Romantic Dinner is made for a whole evening: a starter and a dessert to share, two main courses, a bottle of wine to stretch every word, and the table dressed in candles and rose petals that make it a place only yours. To close, a gift to carry home, so the night lingers long after the last light in the garden. Q900 for two, valued at Q1,120.",
     'La Cena Romántica está hecha para una noche completa: un entrante y un postre para compartir, dos platos fuertes, una botella de vino para estirar cada palabra, y la mesa vestida con velas y pétalos de rosa que la vuelven un lugar solo suyo. Para cerrar, un regalo para llevar a casa, y que la noche siga después de la última luz del jardín. Q900 para dos, valorada en Q1,120.'],
    ["Prepared by reservation only, with 24 hours' notice: call 7768-8880 or write to restaurante@rosanta.rest, and we will arrange every detail so all you have to do is arrive.",
     'Se prepara solo con reservación, con 24 horas de anticipación: llama al 7768-8880 o escribe a restaurante@rosanta.rest, y arreglamos cada detalle para que lo único que tengas que hacer sea llegar.']
  ]],
  ['comp-mszi0r6k', [["MAKE MEMORIES WORTH KEEPING", 'HAZ RECUERDOS QUE VALGA LA PENA GUARDAR']]],
  ['comp-lhjc19k8', [["CONTACT INFO", 'CONTACTO']]],
  ['comp-lhjc19ki', [["ADDRESS", 'DIRECCIÓN']]],
  ['comp-lhjc19lh', [["OPEN HOURS", 'HORARIOS']]]
];

// menú de navegación: reemplazos de <label> exactos en el XML del contenido es
const MENU_ES_ID = '11fb2ee2-4a78-4372-a236-f149c50aa6f7';
const MENU_LABELS = [
  ['HONEST COOKING', 'COCINA HONESTA'],
  ['MENU', 'MENÚ'],
  ['GALLERY', 'GALERÍA'],
  ['RESERVATIONS', 'RESERVACIONES'],
  ['EVENTS', 'EVENTOS'],
  ['GIFT IDEAS', 'IDEAS PARA REGALAR'],
  ['FAQ', 'PREGUNTAS FRECUENTES'],
  ['Privacy Policy', 'Política de Privacidad'],
  ['CONTACT', 'CONTACTO'],
  ['LOCATION', 'UBICACIÓN']
];

async function llamar(metodo, url, cuerpo) {
  const r = await fetch(url, { method: metodo, headers: H, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { ok: r.ok, status: r.status, json: j, texto: t };
}
async function buscarUno(schemaId, entityId, locale) {
  const r = await llamar('POST', U + '/search', { search: { filter: { schemaId: { $eq: schemaId }, entityId: { $eq: entityId }, locale: { $eq: locale } }, cursorPaging: { limit: 5 } } });
  return ((r.json && r.json.contents) || [])[0] || null;
}
// intenta reemplazar en el HTML aceptando apóstrofo recto o tipográfico
function reemplazar(html, en, es) {
  for (const variante of [en, en.replace(/'/g, '’')]) {
    if (html.includes(variante)) return html.replace(variante, es);
  }
  return null;
}

(async () => {
  const registro = { fecha: new Date().toISOString(), creados: [], actualizados: [], saltados: [], noEncontrados: [] };

  for (const [entityId, cambios] of COMPONENTES) {
    const enC = await buscarUno(T, entityId, 'en');
    if (!enC) { console.log('SIN EN: ' + entityId); registro.noEncontrados.push(entityId); continue; }
    const yaEs = await buscarUno(T, entityId, 'es');
    if (yaEs) { console.log('YA TIENE ES: ' + entityId + ' — intacto'); registro.saltados.push(entityId); continue; }

    const campo = Object.keys(enC.fields)[0];
    let html = enC.fields[campo].textValue;
    let fallo = null;
    for (const [en, es] of cambios) {
      const nuevo = reemplazar(html, en, es);
      if (nuevo === null) { fallo = en; break; }
      html = nuevo;
    }
    if (fallo) {
      console.log('NO CALZA en ' + entityId + ': ' + JSON.stringify(fallo.slice(0, 70) + '…'));
      registro.noEncontrados.push(entityId + ' (segmento: ' + fallo.slice(0, 50) + '…)');
      continue;
    }
    const r = await llamar('POST', U, { content: { schemaId: T, entityId, locale: 'es', parentEntityId: enC.parentEntityId, fields: { [campo]: { textValue: html, published: true } } } });
    if (!r.ok) { console.log('FALLÓ ' + entityId + ': HTTP ' + r.status + ' ' + r.texto.slice(0, 160)); continue; }
    registro.creados.push({ id: r.json.content.id, entityId });
    console.log('ok: ' + entityId + ' (' + cambios.length + ' segmento/s)');
  }

  // ---- menú de navegación (PATCH del es existente) ----
  const rMenu = await llamar('GET', U + '/' + MENU_ES_ID);
  if (rMenu.ok) {
    const c = rMenu.json.content;
    let xml = c.fields.menu.textValue;
    const antes = xml;
    let aplicados = 0;
    for (const [en, es] of MENU_LABELS) {
      const tag = '<label>' + en + '</label>';
      if (xml.includes(tag)) { xml = xml.replace(tag, '<label>' + es + '</label>'); aplicados++; }
      else console.log('  menú: no hallé <label>' + en + '</label>');
    }
    if (aplicados > 0) {
      const rp = await llamar('PATCH', U + '/' + MENU_ES_ID, { content: { id: MENU_ES_ID, schemaId: c.schemaId, entityId: c.entityId, locale: 'es', parentEntityId: c.parentEntityId, fields: { menu: { textValue: xml, published: true } } } });
      if (rp.ok) {
        registro.actualizados.push({ id: MENU_ES_ID, entityId: 'CUSTOM_MAIN_MENU', etiquetas: aplicados, xmlAnterior: antes });
        console.log('ok: menú de navegación (' + aplicados + '/' + MENU_LABELS.length + ' etiquetas) — PATCH en sitio');
      } else console.log('FALLÓ menú: HTTP ' + rp.status + ' ' + rp.texto.slice(0, 200));
    }
  } else console.log('FALLÓ leer menú es: ' + rMenu.status);

  const arch = 'traducciones-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nCreados: ' + registro.creados.length + ' · Actualizados: ' + registro.actualizados.length + ' · Ya existían: ' + registro.saltados.length + ' · No encontrados: ' + registro.noEncontrados.length);
  console.log('Registro: ' + arch);
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
