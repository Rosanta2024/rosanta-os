'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const FRASES = [
  'Garden to Table in Antigua',
  'Every plate here starts with the same question',
  'Nothing is rushed and nothing is dressed up',
  'The menu changes with the seasons',
  'FULL MENU'
];
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
(async () => {
  const vistos = new Set();
  for (const frase of FRASES) {
    console.log('\n====== "' + frase + '"');
    const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { search: { expression: frase, fields: ['fields.textValue'] }, cursorPaging: { limit: 20 } } }) });
    const cs = (await r.json()).contents || [];
    const rel = cs.filter(c => Object.values(c.fields || {}).some(f => limpiar(f.textValue).toLowerCase().includes(frase.toLowerCase())));
    if (!rel.length) { console.log('  (sin resultados)'); continue; }
    for (const c of rel) {
      const k = c.schemaId + '|' + c.entityId + '|' + c.locale;
      if (vistos.has(k)) continue;
      vistos.add(k);
      console.log('  ' + c.locale + ' · schema ' + c.schemaId.slice(0, 8) + ' · entity ' + c.entityId + ' · parent ' + (c.parentEntityId || '-') + ' · contentId ' + c.id);
      for (const [key, f] of Object.entries(c.fields || {})) {
        const t = limpiar(f.textValue);
        console.log('    ' + key + ': ' + JSON.stringify(t.length > 200 ? t.slice(0, 200) + '…' : t));
      }
    }
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
