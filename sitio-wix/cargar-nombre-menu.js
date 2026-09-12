#!/usr/bin/env node
/**
 * Traducción ES del NOMBRE y la DESCRIPCIÓN del menú (entidad de la app
 * Restaurants Menus) — lo que se ve arriba de /es/full-menu.
 * Texto aprobado por Juanma 19-ago, con la corrección "carta de cocteles"
 * (sin "de autor": término prohibido en Rosanta).
 * Registro de deshacer + verificación leyendo de vuelta.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';

const SCHEMA = '4af10413-34bf-4373-8614-2de8e0002b2c';
const ENTITY = 'd4c6af0b-a216-46b0-ac39-9348d870a023';

const NOMBRE_ES = 'MENÚ ROSANTA · ANTIGUA GUATEMALA';
const DESC_ES = 'Cocina de temporada en el corazón de Antigua Guatemala. Nuestro menú cambia con lo que da el jardín y con lo que traen los productores cercanos, así que siempre hay algo nuevo que probar. Este es el menú completo, con precios actuales.\nIncluye entradas, opciones saludables, hamburguesas, platos fuertes, acompañamientos, café y bebidas de la casa, nuestra carta de cocteles y la carta de vinos. Si prefieres verlo en la mesa, el mismo menú está impreso en el restaurante.';

async function llamar(metodo, url, cuerpo) {
  const r = await fetch(url, { method: metodo, headers: H, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { ok: r.ok, status: r.status, json: j, texto: t };
}
async function buscarUno(locale) {
  const r = await llamar('POST', U + '/search', { search: { filter: { schemaId: { $eq: SCHEMA }, entityId: { $eq: ENTITY }, locale: { $eq: locale } }, cursorPaging: { limit: 5 } } });
  return ((r.json && r.json.contents) || [])[0] || null;
}

(async () => {
  const en = await buscarUno('en');
  if (!en) { console.log('No encontré el contenido EN del menú.'); process.exit(1); }
  console.log('EN actual:');
  console.log('  name: ' + JSON.stringify(en.fields.name.textValue));
  console.log('  description contiene "signature": ' + en.fields.description.textValue.includes('signature'));

  const ya = await buscarUno('es');
  if (ya) { console.log('\nYA EXISTE traducción ES (id ' + ya.id + ') — no se sobrescribe.'); process.exit(0); }

  const cuerpo = { content: { schemaId: SCHEMA, entityId: ENTITY, locale: 'es', fields: {
    name: { textValue: NOMBRE_ES, published: true },
    description: { textValue: DESC_ES, published: true }
  } } };
  if (en.parentEntityId) cuerpo.content.parentEntityId = en.parentEntityId;

  const r = await llamar('POST', U, cuerpo);
  if (!r.ok) { console.log('\nFALLÓ: HTTP ' + r.status + ' ' + r.texto.slice(0, 300)); process.exit(1); }
  const nuevo = r.json.content;
  console.log('\nCreado ES · contentId ' + nuevo.id);

  const arch = 'traducciones-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify({ fecha: new Date().toISOString(), creados: [{ id: nuevo.id, entityId: ENTITY, schemaId: SCHEMA, que: 'nombre y descripción del menú' }] }, null, 2), 'utf8');
  console.log('Registro: ' + arch);

  await new Promise(res => setTimeout(res, 12000));
  const ver = await buscarUno('es');
  console.log('\n--- VERIFICACIÓN (leído de vuelta) ---');
  if (!ver) { console.log('(el índice aún no lo devuelve; reintentar en unos segundos)'); return; }
  for (const [k, f] of Object.entries(ver.fields)) {
    console.log(k + ' [pub:' + f.published + ']: ' + JSON.stringify(String(f.textValue).slice(0, 240)));
  }
  console.log('\n¿contiene "de autor"?: ' + ver.fields.description.textValue.includes('de autor'));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
