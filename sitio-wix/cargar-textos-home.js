#!/usr/bin/env node
/**
 * Carga las traducciones ES de los textos nuevos de la home (aprobadas por
 * Juanma el 19-ago-2026). Solo los 5 mapeos exactos confirmados.
 * Registro de deshacer: traducciones-home-<ts>.json. Verifica leyendo de vuelta.
 * Sin machine translation.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';

const SCHEMA_TEXTO = '181ccb6b-dfb5-4b18-aacc-eadac190f94b';
const SCHEMA_BOTON = 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4';

// El HTML del campo se toma del EN vivo y se sustituye solo el texto,
// conservando etiquetas y clases (mismo estilo visual).
// `cambios`: lista de sustituciones [en, es] a aplicar dentro del HTML del EN,
// conservando etiquetas y estilos. Debe calzar TODAS o el item se salta.
const CARGAS = [
  { entityId: 'comp-msvvw9tf', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text',
    cambios: [['COOKING WITH PURPOSE', 'COCINA CON PROPÓSITO']] },
  { entityId: 'comp-mszh0tv1', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text',
    cambios: [['HONEST COOKING: ', 'COCINA HONESTA: '], ['SEASONAL, LOCAL, INTENTIONAL.', 'DE TEMPORADA, LOCAL, CON INTENCIÓN.']] },
  { entityId: 'comp-mszh26e7', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text',
    cambios: [['It begins in the soil, a few steps from your table.', 'Empieza en la tierra, a unos pasos de tu mesa.']] },
  { entityId: 'comp-mszgr7vv', schemaId: SCHEMA_TEXTO, campo: 'compFeatures-wRichText-data-styledText-text',
    cambios: [['THE JOY OF HONEST COOKING', 'EL PLACER DE LA COCINA HONESTA']] },
  { entityId: 'comp-mszgtzji', schemaId: SCHEMA_BOTON, campo: 'compFeatures-stylableButton-data-label',
    cambios: [['Reservations', 'Reservaciones']] }
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
    if (!enC) { console.log('SIN EN: ' + c.entityId + ' — salto'); continue; }
    const yaEs = await buscarUno(c.schemaId, c.entityId, 'es');
    if (yaEs) { console.log('YA TIENE ES: ' + c.entityId + ' — salto'); registro.saltados.push(c.entityId); continue; }

    let htmlEs = enC.fields[c.campo].textValue;
    const faltan = c.cambios.filter(([en]) => !htmlEs.includes(en));
    if (faltan.length) { console.log('NO CALZA en ' + c.entityId + ': ' + JSON.stringify(faltan.map(f => f[0])) + ' — salto por seguridad'); continue; }
    for (const [en, es] of c.cambios) htmlEs = htmlEs.replace(en, es);

    const r = await llamar('POST', U, { content: { schemaId: c.schemaId, entityId: c.entityId, locale: 'es', parentEntityId: enC.parentEntityId, fields: {
      [c.campo]: { textValue: htmlEs, published: true }
    } } });
    if (!r.ok) { console.log('FALLÓ ' + c.entityId + ': HTTP ' + r.status + ' ' + r.texto.slice(0, 200)); continue; }
    registro.creados.push({ id: r.json.content.id, entityId: c.entityId, schemaId: c.schemaId, es: c.cambios.map(x => x[1]).join(' ') });
    console.log('ok: ' + c.entityId + '  -> "' + c.cambios.map(x => x[1]).join(' | ') + '"');
  }

  const arch = 'traducciones-home-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nCreados: ' + registro.creados.length + ' · Registro: ' + arch);

  console.log('\n--- VERIFICACIÓN (leído de vuelta) ---');
  for (const c of CARGAS) {
    const es = await buscarUno(c.schemaId, c.entityId, 'es');
    if (!es) { console.log(c.entityId + ': (aún sin es — índice puede tardar segundos)'); continue; }
    const t = String(Object.values(es.fields)[0].textValue).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const pub = Object.values(es.fields)[0].published;
    console.log(c.entityId + ' [pub:' + pub + ']: ' + JSON.stringify(t));
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
