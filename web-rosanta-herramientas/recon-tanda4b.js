'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
  const get = async (u) => (await fetch(u + (u.includes('?') ? '&' : '?') + 'r=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } })).text();

  // 1) coordenadas del pie: contexto en el HTML vivo de la home EN
  const en = await get('https://www.rosanta.rest/');
  const iW = en.lastIndexOf('91°');
  console.log('1) Última aparición de 91° en home EN, contexto:');
  console.log('   ' + JSON.stringify(en.slice(iW - 150, iW + 120).replace(/<[^>]+>/g, '|')));

  // 2) Gallery / Menu en minúsculas en /es
  const es = await get('https://www.rosanta.rest/es');
  console.log('\n2) Contextos de "Gallery" y "Menu" en /es:');
  for (const pal of ['>Gallery<', '>Menu<']) {
    let i = -1, n = 0;
    while ((i = es.indexOf(pal, i + 1)) !== -1 && n < 3) {
      n++;
      console.log('   ' + pal + ' → ' + JSON.stringify(es.slice(i - 220, i + 40)).slice(0, 300));
    }
    if (!n) console.log('   ' + pal + ' → no aparece con esa forma exacta');
  }

  // 3) páginas cotizaciones (todas las que contengan el nombre)
  const paginas = await todos({ schemaId: { $eq: '08f9ebfa-ca43-4bfa-9960-757069a7b52b' }, locale: { $eq: 'en' } });
  const cotis = paginas.filter(p => limpiar((p.fields.title || {}).textValue).toLowerCase().includes('cotiza'));
  console.log('\n3) Páginas con "cotiza": ' + cotis.map(p => p.entityId + '=' + limpiar(p.fields.title.textValue)).join(' · '));
  const texEn = await todos({ schemaId: { $eq: '181ccb6b-dfb5-4b18-aacc-eadac190f94b' }, locale: { $eq: 'en' } });
  const botEn = await todos({ schemaId: { $eq: 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4' }, locale: { $eq: 'en' } });
  const texEs = new Set((await todos({ schemaId: { $eq: '181ccb6b-dfb5-4b18-aacc-eadac190f94b' }, locale: { $eq: 'es' } })).map(c => c.entityId));
  const botEs = new Set((await todos({ schemaId: { $eq: 'f2f2ef5e-8cbd-4296-ade9-b38a49424ba4' }, locale: { $eq: 'es' } })).map(c => c.entityId));
  for (const p of cotis) {
    const pend = [...texEn, ...botEn].filter(c => c.parentEntityId === p.entityId && !texEs.has(c.entityId) && !botEs.has(c.entityId));
    for (const c of pend) console.log('   pend [' + p.entityId + ']: ' + c.entityId + ' = ' + JSON.stringify(limpiar(Object.values(c.fields)[0].textValue)));
  }

  // 4) ¿Términos y Condiciones está enlazada?
  console.log('\n4) Enlaces a términos en home y gift-ideas:');
  const gi = await get('https://www.rosanta.rest/gift-ideas');
  for (const [nom, h] of [['home', en], ['gift-ideas', gi]]) {
    const m = (h.match(/href="[^"]*t[eé]rminos[^"]*"/gi) || []).concat(h.match(/href="[^"]*terms[^"]*"/gi) || []);
    console.log('   ' + nom + ': ' + (m.length ? m.join(' ') : 'sin enlaces'));
  }

  // 5) /es/gift-ideas en vivo
  const gies = await get('https://www.rosanta.rest/es/gift-ideas');
  console.log('\n5) /es/gift-ideas:');
  for (const s of ['IDEAS PARA REGALAR', 'Hay regalos que terminan en un cajón', 'REGALA UNA NOCHE', 'Hay regalos que se abren una vez', 'Disponibles en Q500 y Q300', 'Para conseguir la tuya', 'REGALA ROSANTA', 'SABORES DE ROMANCE', 'Hay noches que piden algo más', 'La Cena Romántica', 'Se prepara solo con reservación', 'HAZ RECUERDOS'])
    console.log('   ' + (gies.includes(s) ? '✓' : '✗ FALTA') + '  ' + s);
  console.log('   inglés residual GIVE A NIGHT/GIFT IDEAS h1: ' + ((gies.split('GIVE A NIGHT').length - 1) + (gies.split('FLAVOURS').length - 1)));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
