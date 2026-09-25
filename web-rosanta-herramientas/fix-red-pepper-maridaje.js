#!/usr/bin/env node
/**
 * Actualiza el maridaje del coctel Red Pepper al nombre nuevo del plato
 * (Rosanta Tenderloin / Lomito Rosanta), en Wix y en el TM (es).
 * Registro de deshacer: cambios-menu-<ts>.json. PATCH = reemplazo completo.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const B = 'https://www.wixapis.com/restaurants';
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const SCHEMA_ITEMS = 'f19e2412-1a6a-4c79-9192-18cbd175e35f';
const ID = '91c42417-813e-4640-b646-e568efd39c57'; // Red Pepper

const EN_DESC = 'Colonial Antigüeño rum infused with roasted red bell peppers, tobacco bitters, a touch of syrup, smoked with vanilla tobacco. Suggested pairing: Rosanta Tenderloin.';
const ES_DESC = 'Ron Colonial Antigüeño macerado en chiles morrones horneados, bitter de tabaco, un toque de jarabe y ahumado con tabaco de vainilla. Maridaje sugerido: Lomito Rosanta.';

(async () => {
  const registro = { fecha: new Date().toISOString(), items: [], tm: [] };

  const antes = (await (await fetch(B + '/menus-item/v1/items/' + ID, { headers: H })).json()).item;
  registro.items.push({ id: ID, antes: { name: antes.name, description: antes.description } });
  const cuerpo = { item: { name: antes.name, description: EN_DESC, revision: antes.revision } };
  if (antes.priceInfo) cuerpo.item.priceInfo = antes.priceInfo;
  if (antes.priceVariants) cuerpo.item.priceVariants = antes.priceVariants;
  if (antes.labels) cuerpo.item.labels = antes.labels;
  if (antes.image) cuerpo.item.image = antes.image;
  const r = await fetch(B + '/menus-item/v1/items/' + ID, { method: 'PATCH', headers: H, body: JSON.stringify(cuerpo) });
  if (!r.ok) { console.log('ITEM FALLÓ: ' + r.status + ' ' + (await r.text()).slice(0, 250)); process.exit(1); }
  console.log('Item EN ok: Red Pepper · maridaje -> Rosanta Tenderloin');

  const rEs = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { filter: { schemaId: { $eq: SCHEMA_ITEMS }, entityId: { $eq: ID }, locale: { $eq: 'es' } }, cursorPaging: { limit: 10 } } }) });
  const viejo = ((await rEs.json()).contents || [])[0];
  registro.tm.push({ entityId: ID, contentIdViejo: viejo.id, antes: { name: viejo.fields.name.textValue, description: viejo.fields.description.textValue } });
  const rDel = await fetch(U + '/' + viejo.id, { method: 'DELETE', headers: H });
  if (!rDel.ok) { console.log('TM DELETE FALLÓ: ' + rDel.status); process.exit(1); }
  const rNew = await fetch(U, { method: 'POST', headers: H, body: JSON.stringify({ content: { schemaId: SCHEMA_ITEMS, entityId: ID, locale: 'es', fields: {
    name: { textValue: 'Red Pepper', published: true },
    description: { textValue: ES_DESC, published: true }
  } } }) });
  const nuevo = await rNew.json();
  if (!rNew.ok) { console.log('TM CREATE FALLÓ: ' + JSON.stringify(nuevo).slice(0, 250)); process.exit(1); }
  registro.tm[0].contentIdNuevo = nuevo.content.id;
  console.log('TM ES ok: maridaje -> Lomito Rosanta (contentId nuevo ' + nuevo.content.id + ')');

  const arch = 'cambios-menu-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('Registro para deshacer: ' + arch);

  const it = (await (await fetch(B + '/menus-item/v1/items/' + ID, { headers: H })).json()).item;
  console.log('\nVERIFICACIÓN EN: desc termina: ' + JSON.stringify(it.description.slice(-40)) + ' · precio: ' + (it.priceInfo ? it.priceInfo.price : '?'));
  console.log('VERIFICACIÓN ES: ' + JSON.stringify(nuevo.content.fields.description.textValue.slice(-40)) + ' · published: ' + nuevo.content.fields.description.published);
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
