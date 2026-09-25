#!/usr/bin/env node
/**
 * Genera el JSON-LD del menú (schema.org type Menu) desde los datos limpios
 * que ya están en Wix Restaurants Menus, vía API. Sustituye al generador
 * viejo que truncaba descripciones y perdía los precios con variantes.
 *
 * NO incluye Restaurant: ese schema vive en su propio bloque de Custom Code
 * ("Restaurant Schema Markup", aplicado a todas las páginas). El enlace entre
 * ambos se hace vía @id del Menu == URL que el Restaurant ya declara en hasMenu.
 *
 * USO
 *   export/inyectar WIX_API_KEY y WIX_SITE_ID como siempre, y:
 *   node wix-schema-menu.js
 *
 * Salida: schema-menu-rosanta.html (el <script> listo para pegar en
 * Settings > Custom Code > "Schema Menu Rosanta", solo página Menu Completo).
 */

'use strict';

const fs = require('fs');

const MENU_ID = 'd4c6af0b-a216-46b0-ac39-9348d870a023'; // "Rosanta Menu"
const MENU_URL = 'https://www.rosanta.rest/full-menu'; // slug cambiado por Juanma el 16-ago-2026 (antes /menu-completo)
// @id del Menu: idéntico a la URL que "Restaurant Schema Markup" ya usa en
// hasMenu, para que ambos nodos queden enlazados sin tocar el bloque Restaurant.
const MENU_AT_ID = MENU_URL;
const MONEDA = 'GTQ';

const B = 'https://www.wixapis.com/restaurants';

function credenciales() {
  const key = process.env.WIX_API_KEY, site = process.env.WIX_SITE_ID;
  if (!key || !site) throw new Error('Faltan WIX_API_KEY y/o WIX_SITE_ID en el entorno.');
  return { Authorization: key, 'wix-site-id': site };
}

async function traer(url) {
  const r = await fetch(url, { headers: credenciales() });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
  return r.json();
}

function ofertaDe(item, variantes) {
  if (item.priceVariants && item.priceVariants.variants && item.priceVariants.variants.length) {
    return item.priceVariants.variants.map(v => ({
      '@type': 'Offer',
      name: variantes[v.variantId] || undefined,
      price: v.priceInfo.price,
      priceCurrency: MONEDA
    }));
  }
  if (item.priceInfo && item.priceInfo.price != null) {
    return { '@type': 'Offer', price: item.priceInfo.price, priceCurrency: MONEDA };
  }
  return undefined;
}

(async () => {
  const menu = (await traer(B + '/menus/v1/menus/' + MENU_ID)).menu;

  const secciones = [];
  {
    const j = await traer(B + '/menus-section/v1/sections?paging.limit=100');
    for (const s of (j.sections || [])) secciones.push(s);
  }

  let items = [], cursor = null;
  do {
    const u = B + '/menus-item/v1/items?paging.limit=100' + (cursor ? '&paging.cursor=' + encodeURIComponent(cursor) : '');
    const j = await traer(u);
    items = items.concat(j.items || []);
    cursor = j.pagingMetadata && j.pagingMetadata.cursors && j.pagingMetadata.cursors.next;
  } while (cursor);

  const variantes = {};
  {
    const j = await traer(B + '/item-variants/v1/variants');
    for (const v of (j.variants || [])) variantes[v.id] = v.name;
  }

  const porId = {};
  for (const it of items) porId[it.id] = it;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': MENU_AT_ID,
    name: menu.name,
    url: MENU_URL,
    inLanguage: 'en',
    hasMenuSection: (menu.sectionIds || []).map(sid => {
      const sec = secciones.find(s => s.id === sid);
      if (!sec) throw new Error('Sección ' + sid + ' del menú no encontrada.');
      return {
        '@type': 'MenuSection',
        name: sec.name,
        description: sec.description || undefined,
        hasMenuItem: (sec.itemIds || []).map(iid => {
          const it = porId[iid];
          if (!it) throw new Error('Item ' + iid + ' de la sección "' + sec.name + '" no encontrado.');
          return {
            '@type': 'MenuItem',
            name: it.name,
            description: it.description || undefined,
            offers: ofertaDe(it, variantes)
          };
        })
      };
    })
  };

  // "<" escapado para que el JSON no pueda cerrar el <script> por accidente.
  const envolver = (obj) => '<script type="application/ld+json">' +
    JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>';

  const html = envolver(jsonld);
  fs.writeFileSync('schema-menu-rosanta.html', html, 'utf8');

  // El campo de Custom Code de Wix admite máximo 15.000 caracteres y el menú
  // completo no cabe. Se parte en dos <script> con el MISMO @id: en JSON-LD
  // los nodos con igual @id se fusionan, así que Google lo lee como un solo Menu.
  const LIMITE = 14000;
  const base = { '@context': jsonld['@context'], '@type': 'Menu', '@id': jsonld['@id'],
                 name: jsonld.name, url: jsonld.url, inLanguage: jsonld.inLanguage };
  const partes = [];
  let actual = { ...base, hasMenuSection: [] };
  for (const sec of jsonld.hasMenuSection) {
    const prueba = { ...actual, hasMenuSection: actual.hasMenuSection.concat([sec]) };
    if (actual.hasMenuSection.length && envolver(prueba).length > LIMITE) {
      partes.push(actual);
      actual = { ...base, hasMenuSection: [sec] };
    } else {
      actual = prueba;
    }
  }
  partes.push(actual);
  partes.forEach((p, i) => {
    const h = envolver(p);
    if (h.length > 15000) throw new Error('La parte ' + (i + 1) + ' quedó de ' + h.length + ' caracteres.');
    fs.writeFileSync('schema-menu-rosanta-parte' + (i + 1) + '.html', h, 'utf8');
    console.log('Parte ' + (i + 1) + ': ' + h.length + ' caracteres, secciones: ' + p.hasMenuSection.map(s => s.name.split(' · ')[0]).join(', '));
  });

  // Validación
  const problemas = [];
  let nItems = 0, sinPrecio = [], truncadas = [];
  for (const sec of jsonld.hasMenuSection) {
    for (const it of sec.hasMenuItem) {
      nItems++;
      if (!it.offers) sinPrecio.push(it.name);
      if (/(\.\.\.|…)$/.test((it.description || '').trim())) truncadas.push(it.name);
    }
  }
  console.log('Secciones: ' + jsonld.hasMenuSection.length + ' · Items: ' + nItems);
  console.log('Sin precio: ' + (sinPrecio.length ? sinPrecio.join(', ') : 'ninguno'));
  console.log('Descripciones truncadas: ' + (truncadas.length ? truncadas.join(', ') : 'ninguna'));
  const ens = jsonld.hasMenuSection.flatMap(s => s.hasMenuItem).find(i => i.name === 'Rosanta Salad');
  console.log('Rosanta Salad offers: ' + (Array.isArray(ens.offers) ? ens.offers.map(o => o.name + ' Q' + o.price).join(' / ') : JSON.stringify(ens.offers)));
  console.log('Tamaño: ' + html.length + ' caracteres');
  console.log('Escrito: schema-menu-rosanta.html');
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
