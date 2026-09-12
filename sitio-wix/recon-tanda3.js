'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function buscar(expr) {
  const r = await fetch(U + '/search', { method: 'POST', headers: H, body: JSON.stringify({ search: { search: { expression: expr, fields: ['fields.textValue'] }, cursorPaging: { limit: 30 } } }) });
  return ((await r.json()).contents || []);
}

(async () => {
  // 1) piezas sin mapear
  for (const expr of ['A GARDEN THAT GIVES', 'GREATFUL', 'GIFT IDEAS', 'CONTACT INFO', 'ADDRESS', 'OPEN HOURS', 'LOCATION']) {
    console.log('\n====== "' + expr + '"');
    const cs = await buscar(expr);
    const rel = cs.filter(c => c.locale === 'en' && Object.values(c.fields || {}).some(f => limpiar(f.textValue).toUpperCase().includes(expr.toUpperCase())));
    if (!rel.length) { console.log('  (sin resultados en)'); continue; }
    for (const c of rel.slice(0, 6)) {
      const t = limpiar(Object.values(c.fields)[0].textValue);
      console.log('  ' + c.schemaId.slice(0, 8) + ' · ' + c.entityId + ' · parent ' + (c.parentEntityId || '-') + ' · ' + JSON.stringify(t.length > 90 ? t.slice(0, 90) + '…' : t));
    }
  }

  // 2) estructura del menú de navegación (es existente)
  console.log('\n====== CUSTOM_MAIN_MENU (es) estructura');
  const r = await fetch(U + '/11fb2ee2-4a78-4372-a236-f149c50aa6f7', { headers: H });
  const j = await r.json();
  const c = j.content;
  console.log('parent: ' + (c.parentEntityId || '-') + ' · campos: ' + Object.keys(c.fields).length);
  for (const [k, f] of Object.entries(c.fields)) {
    console.log('  ' + k + ' = ' + JSON.stringify(String(f.textValue)) + ' [pub:' + f.published + ']');
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
