#!/usr/bin/env node
/**
 * Tres correcciones al menú (17-ago-2026, pedidas por Juanma), en Wix y en el
 * Translation Manager (es). Deja registro cambios-menu-<ts>.json para deshacer
 * y verifica leyendo de vuelta. PATCH de items = reemplazo completo.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const B = 'https://www.wixapis.com/restaurants';
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const SCHEMA_ITEMS = 'f19e2412-1a6a-4c79-9192-18cbd175e35f';

const CAMBIOS = [
  { id: '3c835736-5ad8-472e-b3f2-1ed5b2420ac1', // Grilled Tenderloin (NO el Sliced de la hamburguesa)
    en: { name: 'Rosanta Tenderloin', desc: 'Tenderloin medallion cooked to your liking, with a spinach and rosemary purée over black garlic sauce, finished with fermented carrots. Suggested pairing: Red Pepper.' },
    es: { name: 'Lomito Rosanta', desc: 'Medallón de lomito al término de tu preferencia, acompañado de puré de espinaca y romero, sobre una salsa de ajo negro complementado con zanahorias fermentadas. Maridaje sugerido: Red Pepper.' } },
  { id: '50828e60-a628-47bc-b396-db1d44dfa5ba', // Catch of the Day
    en: { name: 'Catch of the Day', desc: "The day's catch, served with a white wine sauce scented with sage, sweet potato purée and roasted carrots, tender green beans and grilled bok choy. Gentle, herbal preparation." },
    es: { name: 'Pescado del Día', desc: 'Pesca del día, servida con una salsa de vino blanco aromatizada con salvia, puré de camote y zanahorias horneadas, ejotes tiernos y bok choy asado. Preparación suave y herbal.' } }
];

(async () => {
  const registro = { fecha: new Date().toISOString(), items: [], tm: [] };

  for (const c of CAMBIOS) {
    const antes = (await (await fetch(B + '/menus-item/v1/items/' + c.id, { headers: H })).json()).item;
    registro.items.push({ id: c.id, antes: { name: antes.name, description: antes.description } });
    const cuerpo = { item: { name: c.en.name, description: c.en.desc, revision: antes.revision } };
    if (antes.priceInfo) cuerpo.item.priceInfo = antes.priceInfo;
    if (antes.priceVariants) cuerpo.item.priceVariants = antes.priceVariants;
    if (antes.labels) cuerpo.item.labels = antes.labels;
    if (antes.image) cuerpo.item.image = antes.image;
    const r = await fetch(B + '/menus-item/v1/items/' + c.id, { method: 'PATCH', headers: H, body: JSON.stringify(cuerpo) });
    if (!r.ok) { console.log('ITEM FALLÓ ' + c.id + ': ' + r.status + ' ' + (await r.text()).slice(0, 250)); process.exit(1); }
    console.log('Item EN ok: ' + antes.name + ' -> ' + c.en.name);

    const rEs = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { filter: { schemaId: { $eq: SCHEMA_ITEMS }, entityId: { $eq: c.id }, locale: { $eq: 'es' } }, cursorPaging: { limit: 10 } } }) });
    const viejo = ((await rEs.json()).contents || [])[0];
    registro.tm.push({ entityId: c.id, contentIdViejo: viejo.id, antes: { name: viejo.fields.name.textValue, description: viejo.fields.description && viejo.fields.description.textValue } });
    const rDel = await fetch(U + '/' + viejo.id, { method: 'DELETE', headers: H });
    if (!rDel.ok) { console.log('TM DELETE FALLÓ: ' + rDel.status); process.exit(1); }
    const rNew = await fetch(U, { method: 'POST', headers: H, body: JSON.stringify({ content: { schemaId: SCHEMA_ITEMS, entityId: c.id, locale: 'es', fields: {
      name: { textValue: c.es.name, published: true },
      description: { textValue: c.es.desc, published: true }
    } } }) });
    const nuevo = await rNew.json();
    if (!rNew.ok) { console.log('TM CREATE FALLÓ: ' + JSON.stringify(nuevo).slice(0, 250)); process.exit(1); }
    registro.tm[registro.tm.length - 1].contentIdNuevo = nuevo.content.id;
    console.log('TM ES ok: ' + registro.tm[registro.tm.length - 1].antes.name + ' -> ' + c.es.name);
  }

  const arch = 'cambios-menu-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nRegistro para deshacer: ' + arch);

  console.log('\n--- VERIFICACIÓN (leído de vuelta) ---');
  for (const c of CAMBIOS) {
    const it = (await (await fetch(B + '/menus-item/v1/items/' + c.id, { headers: H })).json()).item;
    const precio = it.priceInfo ? it.priceInfo.price : it.priceVariants.variants.map(v => v.priceInfo.price).join('/');
    console.log('EN ' + it.name + ' · desc termina: ' + JSON.stringify(it.description.slice(-45)) + ' · precio intacto: ' + precio + ' · labels: ' + ((it.labels || []).length));
    const rEs = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { filter: { schemaId: { $eq: SCHEMA_ITEMS }, entityId: { $eq: c.id }, locale: { $eq: 'es' } }, cursorPaging: { limit: 10 } } }) });
    const es = ((await rEs.json()).contents || [])[0];
    console.log('ES ' + es.fields.name.textValue + ' · desc termina: ' + JSON.stringify(es.fields.description.textValue.slice(-45)) + ' · published: ' + es.fields.name.published);
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
