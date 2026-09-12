#!/usr/bin/env node
/**
 * Tanda 4 (19-ago-2026): pie de página de la home (CONTACT h3, días, blurb).
 * Español de Juanma. Registro + verificación leyendo de vuelta.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const T = '181ccb6b-dfb5-4b18-aacc-eadac190f94b';

const COMPONENTES = [
  ['comp-lhjc19kp', [["CONTACT", 'CONTACTO']]],
  ['comp-lhjc19lr', [["Monday", 'Lunes']]],
  ['comp-lhjcmbpr', [["Tuesday", 'Martes']]],
  ['comp-lidavzjr', [["Wed - Thru", 'Mié - Jue']]],
  ['comp-lidawv8i', [["Friday - Saturday", 'Viernes - Sábado']]],
  ['comp-lidaydb8', [["Sunday", 'Domingo']]],
  ['comp-lmihpanw', [["🍸🌿 From the garden to your table: fresh ingredients picked close to home, changing with every season. Come taste what grows just steps away.",
    '🍸🌿 Del jardín a tu mesa: ingredientes frescos cosechados aquí cerca, que cambian con cada temporada. Ven a probar lo que crece a unos pasos.']]]
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
function reemplazar(html, en, es) {
  for (const v of [en, en.replace(/'/g, '’')]) if (html.includes(v)) return html.replace(v, es);
  return null;
}

(async () => {
  const registro = { fecha: new Date().toISOString(), creados: [], saltados: [], noEncontrados: [] };

  for (const [entityId, cambios] of COMPONENTES) {
    const enC = await buscarUno(T, entityId, 'en');
    if (!enC) { console.log('SIN EN: ' + entityId); registro.noEncontrados.push(entityId); continue; }
    const yaEs = await buscarUno(T, entityId, 'es');
    if (yaEs) { console.log('YA TIENE ES: ' + entityId); registro.saltados.push(entityId); continue; }
    const campo = Object.keys(enC.fields)[0];
    let html = enC.fields[campo].textValue, fallo = null;
    for (const [en, es] of cambios) {
      const nuevo = reemplazar(html, en, es);
      if (nuevo === null) { fallo = en; break; }
      html = nuevo;
    }
    if (fallo) { console.log('NO CALZA en ' + entityId + ': ' + JSON.stringify(fallo.slice(0, 60))); registro.noEncontrados.push(entityId); continue; }
    const r = await llamar('POST', U, { content: { schemaId: T, entityId, locale: 'es', parentEntityId: enC.parentEntityId, fields: { [campo]: { textValue: html, published: true } } } });
    if (!r.ok) { console.log('FALLÓ ' + entityId + ': ' + r.status + ' ' + r.texto.slice(0, 150)); continue; }
    registro.creados.push({ id: r.json.content.id, entityId });
    console.log('ok: ' + entityId);
  }

  const arch = 'traducciones-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nCreados: ' + registro.creados.length + ' · Registro: ' + arch);

  await new Promise(r => setTimeout(r, 12000));
  console.log('\n--- VERIFICACIÓN ---');
  for (const [entityId] of COMPONENTES) {
    const es = await buscarUno(T, entityId, 'es');
    if (!es) { console.log(entityId + ': sin es aún'); continue; }
    const f = Object.values(es.fields)[0];
    const t = String(f.textValue).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(entityId + ' [pub:' + f.published + ']: ' + JSON.stringify(t.length > 90 ? t.slice(0, 90) + '…' : t));
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
