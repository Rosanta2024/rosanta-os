#!/usr/bin/env node
/**
 * PASO 1 (solo lectura): localizar en el Translation Content API los textos
 * nuevos de la home y mostrar schema/entity/clave + texto EN, y si ya tienen es.
 */
'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';

const FRASES = [
  'Cooking with purpose',
  'Every plate here starts with the same question',
  'Nothing is rushed and nothing is dressed up',
  'HONEST COOKING: SEASONAL, LOCAL, INTENTIONAL',
  'It begins in the soil',
  'THE JOY OF HONEST COOKING',
  'Reservations'
];

async function buscarTexto(expr) {
  const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({
    search: { search: { expression: expr, fields: ['fields.textValue'] }, cursorPaging: { limit: 20 } }
  }) });
  if (!r.ok) { console.log('  search HTTP ' + r.status); return []; }
  return (await r.json()).contents || [];
}

async function esDe(schemaId, entityId) {
  const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({
    search: { filter: { schemaId: { $eq: schemaId }, entityId: { $eq: entityId }, locale: { $eq: 'es' } }, cursorPaging: { limit: 5 } }
  }) });
  if (!r.ok) return null;
  return ((await r.json()).contents || [])[0] || null;
}

function limpiar(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  const vistos = new Set();
  for (const frase of FRASES) {
    console.log('\n================ "' + frase + '"');
    const cs = await buscarTexto(frase);
    const relevantes = cs.filter(c => Object.values(c.fields || {}).some(f => limpiar(f.textValue).toLowerCase().includes(frase.toLowerCase())));
    if (!relevantes.length) { console.log('  (sin resultados)'); continue; }
    for (const c of relevantes) {
      const clave = c.schemaId + '|' + c.entityId + '|' + c.locale;
      if (vistos.has(clave)) { console.log('  (ya listado arriba: entity ' + c.entityId.slice(0, 20) + '…)'); continue; }
      vistos.add(clave);
      console.log('  contentId: ' + c.id);
      console.log('  schemaId:  ' + c.schemaId);
      console.log('  entityId:  ' + c.entityId);
      console.log('  locale:    ' + c.locale);
      for (const [k, f] of Object.entries(c.fields || {})) {
        const t = limpiar(f.textValue);
        console.log('    campo "' + k + '": ' + JSON.stringify(t.length > 160 ? t.slice(0, 160) + '…' : t));
      }
      if (c.locale === 'en') {
        const es = await esDe(c.schemaId, c.entityId);
        console.log('  ¿tiene es?: ' + (es ? 'SÍ (id ' + es.id + ')' : 'NO'));
      }
    }
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
