'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function buscar(expr) {
  const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { search: { expression: expr, fields: ['fields.textValue'] }, cursorPaging: { limit: 30 } } }) });
  return ((await r.json()).contents || []);
}
async function todos(filtro) {
  let out = [], cursor = null, v = 0;
  do {
    v++;
    const body = cursor ? { search: { cursorPaging: { cursor } } } : { search: { filter: filtro, cursorPaging: { limit: 100 } } };
    const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) break;
    out = out.concat(j.contents || []);
    cursor = (j.pagingMetadata && j.pagingMetadata.cursors && j.pagingMetadata.cursors.next) || null;
  } while (cursor && v < 80);
  return out;
}

(async () => {
  // 1) coordenadas del pie y etiquetas Gallery/Menu
  for (const expr of ['91° W · Antigua', 'Gallery', 'Menu']) {
    console.log('\n====== "' + expr + '"');
    const cs = (await buscar(expr)).filter(c => c.locale === 'en');
    for (const c of cs.slice(0, 8)) {
      const t = limpiar(Object.values(c.fields)[0].textValue);
      if (expr !== '91° W · Antigua' && t.length > 40) continue; // solo etiquetas cortas
      console.log('  ' + c.schemaId.slice(0, 8) + ' · ' + c.entityId + ' · parent ' + (c.parentEntityId || '-') + ' · ' + JSON.stringify(t.slice(0, 80)));
    }
  }

  // 2) ids de páginas EVENTS, COTIZACIONES, Términos
  const paginas = await todos({ schemaId: { $eq: '08f9ebfa-ca43-4bfa-9960-757069a7b52b' }, locale: { $eq: 'en' } });
  const buscarPg = (nom) => paginas.find(p => limpiar((p.fields.title || {}).textValue).toLowerCase().includes(nom.toLowerCase()));
  const pgEvents = buscarPg('EVENTS'), pgCoti = buscarPg('COTIZACIONES'), pgTerm = buscarPg('Términos');
  console.log('\npáginas: EVENTS=' + (pgEvents && pgEvents.entityId) + ' · COTIZACIONES=' + (pgCoti && pgCoti.entityId) + ' · Términos=' + (pgTerm && pgTerm.entityId));

  // 3) pendientes por página
  const texEn = await todos({ schemaId: { $eq: '181ccb6b-dfb5-4b18-aacc-eadac190f94b' }, locale: { $eq: 'en' } });
  const botEn = await todos({ schemaId: { $eq: 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4' }, locale: { $eq: 'en' } });
  const texEs = new Set((await todos({ schemaId: { $eq: '181ccb6b-dfb5-4b18-aacc-eadac190f94b' }, locale: { $eq: 'es' } })).map(c => c.entityId));
  const botEs = new Set((await todos({ schemaId: { $eq: 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4' }, locale: { $eq: 'es' } })).map(c => c.entityId));
  const pendientesDe = (pgId) => [...texEn, ...botEn].filter(c => c.parentEntityId === pgId && !texEs.has(c.entityId) && !botEs.has(c.entityId));

  for (const [nom, pg] of [['EVENTS', pgEvents], ['COTIZACIONES', pgCoti]]) {
    console.log('\n====== pendientes de ' + nom + ':');
    if (!pg) { console.log('  (página no hallada)'); continue; }
    for (const c of pendientesDe(pg.entityId)) {
      console.log('  · ' + c.entityId + ': ' + JSON.stringify(limpiar(Object.values(c.fields)[0].textValue)));
    }
  }

  // 4) Términos y Condiciones: idioma real y enlace
  console.log('\n====== Términos y Condiciones:');
  if (pgTerm) {
    const cs = pendientesDe(pgTerm.entityId);
    console.log('  pendientes: ' + cs.length);
    for (const c of cs.slice(0, 3)) console.log('  muestra: ' + JSON.stringify(limpiar(Object.values(c.fields)[0].textValue).slice(0, 220) + '…'));
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
