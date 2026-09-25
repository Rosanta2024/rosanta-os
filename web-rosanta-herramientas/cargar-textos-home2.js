#!/usr/bin/env node
/**
 * Segunda tanda de traducciones ES de la home (19-ago-2026, texto de Juanma):
 * los 5 párrafos de Honest Cooking, el cuerpo de The Joy y el botón FULL MENU.
 * Registro: traducciones-home-<ts>.json · verificación leyendo de vuelta.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';

const SCHEMA_TEXTO = '181ccb6b-dfb5-4b18-aacc-eadac190f94b';
const SCHEMA_BOTON = 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4';

const CARGAS = [
  { entityId: 'comp-mszh3qyb', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text', cambios: [
    ["Much of what you'll taste grew in the garden around you: picked at its peak, cooked the same day, guided by whatever the season decided to give. What the garden doesn't grow comes from nearby hands, small producers who move slow, follow the seasons, and care for the same land you're standing on.",
     'Buena parte de lo que pruebas creció en el jardín que te rodea: cosechado en su punto, cocinado el mismo día, al ritmo de lo que la temporada quiso dar. Lo que el jardín no da llega de manos cercanas, pequeños productores que van despacio, siguen las estaciones y cuidan la misma tierra que pisas.'],
    ['The bar tells the same story. Herbs cut that morning, fruit at its ripest, spirits chosen with care and mixed for you on the spot. Tell the bartender what you love, and a glass gets built around it.',
     'La barra cuenta la misma historia. Hierbas cortadas esa mañana, fruta en su punto, destilados elegidos con cuidado y mezclados para ti al momento. Dile al bartender qué te gusta, y una copa nace a tu medida.'],
    ["Nothing here is rushed or dressed up. The flavors are honest because the ingredients are: fresh, local, close to home. In every bite there's a little sun, a little rain, a little of the earth it came from.",
     'Aquí nada se apura ni se disfraza. Los sabores son honestos porque los ingredientes lo son: frescos, locales, de aquí cerca. En cada bocado hay un poco de sol, un poco de lluvia, un poco de la tierra de donde vino.'],
    ["And then there's the garden itself: string lights overhead, the evening settling in slow. A place made for lingering, for long conversations, for the kind of evening that ends far later than you planned.",
     'Y luego está el jardín: luces colgando, la noche cayendo despacio. Un lugar hecho para quedarse, para las conversaciones largas, para esas noches que no quieres que terminen.'],
    ["So settle in. Share a plate, raise a glass, let the garden light do the rest. This isn't food to rush through: it's an evening to live, one that leaves you with a memory worth carrying home, and a reason to come back.",
     'Así que acomódate. Comparte un plato, levanta una copa, deja que la luz del jardín haga el resto. Esta es comida para vivirse, no solo comerse, y para dejarte un recuerdo que te lleves a casa, y una razón para volver.']
  ] },
  { entityId: 'comp-mszgsmi2', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text', cambios: [
    ['Flavor here begins in the soil and ends at your table: fresh, local, picked the same day. Come for the food, stay for the garden, and turn an ordinary night into one worth remembering. Your table is waiting.',
     'Aquí el sabor empieza en la tierra y termina en tu mesa: fresco, local, cosechado el mismo día. Ven por la comida, quédate por el jardín, y convierte una noche cualquiera en una que vale la pena recordar. Tu mesa te espera.']
  ] },
  { entityId: 'comp-lhi26c4o', schemaId: SCHEMA_BOTON, campo: 'compFeatures-stylableButton-data-label', cambios: [
    ['FULL MENU', 'MENÚ COMPLETO']
  ] }
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

(async () => {
  const registro = { fecha: new Date().toISOString(), creados: [], saltados: [] };

  for (const c of CARGAS) {
    const enC = await buscarUno(c.schemaId, c.entityId, 'en');
    if (!enC) { console.log('SIN EN: ' + c.entityId); continue; }
    const yaEs = await buscarUno(c.schemaId, c.entityId, 'es');
    if (yaEs) { console.log('YA TIENE ES: ' + c.entityId + ' — salto'); registro.saltados.push(c.entityId); continue; }

    let htmlEs = enC.fields[c.campo].textValue;
    const faltan = c.cambios.filter(([en]) => !htmlEs.includes(en));
    if (faltan.length) {
      console.log('NO CALZAN ' + faltan.length + ' segmento(s) en ' + c.entityId + ' — salto por seguridad:');
      for (const [en] of faltan) console.log('   · ' + JSON.stringify(en.slice(0, 80) + '…'));
      continue;
    }
    for (const [en, es] of c.cambios) htmlEs = htmlEs.replace(en, es);

    const r = await llamar('POST', U, { content: { schemaId: c.schemaId, entityId: c.entityId, locale: 'es', parentEntityId: enC.parentEntityId, fields: {
      [c.campo]: { textValue: htmlEs, published: true }
    } } });
    if (!r.ok) { console.log('FALLÓ ' + c.entityId + ': HTTP ' + r.status + ' ' + r.texto.slice(0, 200)); continue; }
    registro.creados.push({ id: r.json.content.id, entityId: c.entityId, schemaId: c.schemaId });
    console.log('ok: ' + c.entityId + ' (' + c.cambios.length + ' segmento(s))');
  }

  const arch = 'traducciones-home-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nCreados: ' + registro.creados.length + ' · Registro: ' + arch);

  console.log('\n--- VERIFICACIÓN ---');
  for (const c of CARGAS) {
    const es = await buscarUno(c.schemaId, c.entityId, 'es');
    if (!es) { console.log(c.entityId + ': (sin es aún — índice tarda unos segundos)'); continue; }
    const f = Object.values(es.fields)[0];
    const t = String(f.textValue).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(c.entityId + ' [pub:' + f.published + ']: ' + JSON.stringify(t.length > 180 ? t.slice(0, 180) + '…' : t));
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
