#!/usr/bin/env node
/**
 * Carga las traducciones al ESPAÑOL del menú en el Translation Manager de Wix,
 * vía el Translation Content API (descubierto y verificado el 17-ago-2026).
 *
 * FUENTE del español: el array MENU del index.html de GitHub (via menu-rosanta.json,
 * generado por `node wix-menu-loader.js extract`). No se redacta nada nuevo:
 * solo se transcribe. Los nombres de sección del dashboard (reorganizados a mano
 * por Juanma) se traducen con el mapa SECCIONES_ES de abajo.
 *
 * ENDPOINTS (schemas de Restaurant Menus en este sitio):
 *   POST https://www.wixapis.com/translation-content/v1/contents/search
 *   POST https://www.wixapis.com/translation-content/v1/contents         (crear)
 *   DELETE https://www.wixapis.com/translation-content/v1/contents/{id}  (deshacer)
 *
 * USO
 *   WIX_API_KEY=... WIX_SITE_ID=... node wix-menu-translate.js           (carga)
 *   WIX_API_KEY=... WIX_SITE_ID=... node wix-menu-translate.js rollback traducciones-<ts>.json
 *
 * Idempotente: si una entidad ya tiene contenido `es`, se salta.
 * NO usa Generate translations ni Machine Translation de Wix.
 */

'use strict';

const fs = require('fs');

const SCHEMAS = {
  items:     'f19e2412-1a6a-4c79-9192-18cbd175e35f', // fields: name, description
  secciones: null,  // se resuelve en vivo (buscando "Flavorful beginnings")
  labels:    null,  // se resuelve en vivo (buscando "House-made")
  variantes: 'b62891f9-98dc-40ce-87ea-c7f87de6ebf9'  // field: name
};

const VARIANTES_ES = {
  'Regular': 'Normal',
  'Tenderloin': 'Lomito',
  'Shrimp': 'Camarones',
  'With tenderloin': 'Con lomito',
  'Glass': 'Copa',
  'Bottle': 'Botella'
};

// Nombres de sección del dashboard (18-ago, reorganizados por Juanma) → español.
// "Tés especiales del jardín" corrige la errata de la fuente ("Tés especias").
const SECCIONES_ES = {
  'TO START · Flavorful beginnings': 'PARA EMPEZAR · Comienzos con sabor',
  'HEALTHY OPTIONS · Nourishing harvests': 'OPCIONES SALUDABLES · Cosechas nutritivas',
  'BURGERS · From the garden and the grill': 'HAMBURGUESAS · Del huerto y la parrilla',
  'SOMETHING STRONGER · Cooking with roots and fire': 'ALGO MÁS FUERTE · Cocina con raíz y fuego',
  'SOMETHING STRONGER · Side Dishes': 'ALGO MÁS FUERTE · Para Acompañar',
  'DRINKS · House refreshments': 'BEBIDAS · Refrescos de la casa',
  'DRINKS · Coffee from Guatemala': 'BEBIDAS · Café de Guatemala',
  'DRINKS · Garden herb teas': 'BEBIDAS · Tés especiales del jardín',
  'DRINKS · Artisan tea infusions': 'BEBIDAS · Infusiones de té artesanal',
  'DRINKS · Beers': 'BEBIDAS · Cervezas',
  'DRINKS · Craft beers': 'BEBIDAS · Cervezas artesanales',
  'DRINKS · Digestifs': 'BEBIDAS · Digestivos',
  'COCKTAILS · The Essentials': 'CÓCTELES · Los Imperdibles',
  'COCKTAILS · Seasonal Harvest': 'CÓCTELES · Cosecha de Temporada',
  'COCKTAILS · House Roots': 'CÓCTELES · Raíces de la Casa',
  'WINES · Red Wines': 'VINOS · Tintos',
  'WINES · White Wine & Rose': 'VINOS · Blancos y Rosados',
  'CAVA': 'CAVA'
};

function credenciales() {
  const key = process.env.WIX_API_KEY, site = process.env.WIX_SITE_ID;
  if (!key || !site) throw new Error('Faltan WIX_API_KEY y/o WIX_SITE_ID.');
  return { Authorization: key, 'wix-site-id': site, 'Content-Type': 'application/json' };
}

const U = 'https://www.wixapis.com/translation-content/v1/contents';

async function llamar(metodo, url, cuerpo) {
  const r = await fetch(url, { method: metodo, headers: credenciales(), body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { ok: r.ok, status: r.status, json: j, texto: t };
}

async function buscarTodos(filtro) {
  let out = [], cursor = null, vueltas = 0;
  do {
    vueltas++;
    const body = { search: { filter: filtro, cursorPaging: cursor ? { limit: 100, cursor } : { limit: 100 } } };
    const r = await llamar('POST', U + '/search', body);
    if (!r.ok) throw new Error('search HTTP ' + r.status + ': ' + r.texto.slice(0, 200));
    out = out.concat(r.json.contents || []);
    const pm = r.json.pagingMetadata || {};
    cursor = (pm.cursors && pm.cursors.next) || null;
  } while (cursor && vueltas < 30);
  return out;
}

async function schemaPorTexto(texto) {
  const r = await llamar('POST', U + '/search', { search: { search: { expression: texto, fields: ['fields.textValue'] }, cursorPaging: { limit: 10 } } });
  const c = (r.json.contents || []).find(c => Object.values(c.fields || {}).some(f => (f.textValue || '').includes(texto)));
  if (!c) throw new Error('No pude resolver el schema buscando "' + texto + '"');
  return c.schemaId;
}

async function modoCarga() {
  const d = JSON.parse(fs.readFileSync(__dirname + '/menu-rosanta.json', 'utf8'));

  SCHEMAS.secciones = await schemaPorTexto('Flavorful beginnings');
  SCHEMAS.labels = await schemaPorTexto('House-made');
  console.log('Schemas: items=' + SCHEMAS.items.slice(0, 8) + ' secciones=' + SCHEMAS.secciones.slice(0, 8) + ' labels=' + SCHEMAS.labels.slice(0, 8) + ' variantes=' + SCHEMAS.variantes.slice(0, 8));

  // Índice del español por nombre EN (con descripción para desempatar Don Luis)
  const esPorNombre = new Map();
  d.en.forEach((sec, si) => sec.items.forEach((it, ii) => {
    const esIt = d.es[si].items[ii];
    const lista = esPorNombre.get(it.name) || [];
    lista.push({ en: it, es: esIt });
    esPorNombre.set(it.name, lista);
  }));
  // Intros EN -> ES (por si las descripciones de sección coinciden con la fuente)
  const introEs = new Map();
  d.en.forEach((sec, si) => { if (sec.intro) introEs.set(sec.intro, d.es[si].intro || ''); });

  // Traducción de la etiqueta EN -> ES desde labels-map-rosanta.json (invertido)
  const mapa = JSON.parse(fs.readFileSync(__dirname + '/labels-map-rosanta.json', 'utf8'));
  const labelEs = {};
  for (const [es, en] of Object.entries(mapa.labelsEn || {})) labelEs[en] = es;

  const registro = { fecha: new Date().toISOString(), creados: [], saltados: [], sinFuente: [] };

  for (const [tipo, schemaId] of Object.entries(SCHEMAS)) {
    const en = await buscarTodos({ schemaId: { $eq: schemaId }, locale: { $eq: 'en' } });
    const es = await buscarTodos({ schemaId: { $eq: schemaId }, locale: { $eq: 'es' } });
    const yaTraducidos = new Set(es.map(c => c.entityId));
    console.log('\n' + tipo.toUpperCase() + ': ' + en.length + ' contenidos EN · ' + yaTraducidos.size + ' ya con ES');

    for (const c of en) {
      if (yaTraducidos.has(c.entityId)) { registro.saltados.push(tipo + ':' + c.entityId); continue; }
      const nombreEn = (c.fields.name && c.fields.name.textValue) || '';
      const fields = {};

      if (tipo === 'items') {
        const candidatos = esPorNombre.get(nombreEn) || [];
        let par = candidatos[0];
        if (candidatos.length > 1) {
          const descEn = (c.fields.description && c.fields.description.textValue) || '';
          par = candidatos.find(p => p.en.description === descEn) || null;
        }
        if (!par) { registro.sinFuente.push('item: ' + nombreEn); continue; }
        fields.name = { textValue: par.es.name, published: true };
        if (c.fields.description && par.es.description) fields.description = { textValue: par.es.description, published: true };
      } else if (tipo === 'secciones') {
        const nombreEsp = SECCIONES_ES[nombreEn];
        if (!nombreEsp) { registro.sinFuente.push('seccion: ' + nombreEn); continue; }
        fields.name = { textValue: nombreEsp, published: true };
        const descEn = (c.fields.description && c.fields.description.textValue) || '';
        if (descEn && introEs.get(descEn)) fields.description = { textValue: introEs.get(descEn), published: true };
      } else if (tipo === 'labels') {
        const nombreEsp = labelEs[nombreEn];
        if (!nombreEsp) { registro.sinFuente.push('label: ' + nombreEn); continue; }
        fields.name = { textValue: nombreEsp, published: true };
      } else if (tipo === 'variantes') {
        const nombreEsp = VARIANTES_ES[nombreEn];
        if (!nombreEsp) { registro.sinFuente.push('variante: ' + nombreEn); continue; }
        fields.name = { textValue: nombreEsp, published: true };
      }

      const r = await llamar('POST', U, { content: { schemaId, entityId: c.entityId, locale: 'es', fields } });
      if (r.ok) {
        registro.creados.push({ id: r.json.content.id, tipo, entityId: c.entityId, nombreEn });
        console.log('  · ' + nombreEn + ' -> ' + (fields.name.textValue));
      } else {
        console.log('  FALLÓ ' + nombreEn + ': HTTP ' + r.status + ' ' + r.texto.slice(0, 150));
      }
    }
  }

  const arch = 'traducciones-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nCreados: ' + registro.creados.length + ' · ya existían: ' + registro.saltados.length + ' · sin fuente ES: ' + registro.sinFuente.length);
  if (registro.sinFuente.length) console.log('SIN FUENTE:\n  ' + registro.sinFuente.join('\n  '));
  console.log('Registro para deshacer: ' + arch);
}

async function modoRollback(archivo) {
  if (!archivo || !fs.existsSync(archivo)) throw new Error('Pasa el archivo traducciones-<ts>.json');
  const reg = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  for (const c of reg.creados) {
    const r = await llamar('DELETE', U + '/' + c.id);
    console.log((r.ok ? 'borrado  ' : 'FALLÓ ' + r.status + '  ') + c.tipo + ' ' + c.nombreEn);
  }
}

(async () => {
  try {
    if (process.argv[2] === 'rollback') await modoRollback(process.argv[3]);
    else await modoCarga();
  } catch (e) { console.error('Error: ' + e.message); process.exit(1); }
})();
