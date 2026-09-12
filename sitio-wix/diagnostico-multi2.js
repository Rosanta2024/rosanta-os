'use strict';
const get = async (u) => {
  const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'x=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } });
  return r.ok ? await r.text() : '';
};
(async () => {
  const es = await get('https://www.rosanta.rest/es');
  const en = await get('https://www.rosanta.rest/');
  const fm = await get('https://www.rosanta.rest/full-menu');

  console.log('A) ¿De dónde sale el hreflang de /full-menu?');
  const links = (fm.match(/<link[^>]*hreflang[^>]*>/g) || []);
  for (const l of links) console.log('   ' + l.replace(/\s+/g, ' '));
  const i = fm.indexOf('hreflang');
  console.log('   contexto: ' + JSON.stringify(fm.slice(Math.max(0, i - 300), i + 200).replace(/\s+/g, ' ')));

  console.log('\nB) ¿Qué componente contiene "Monday" en /es?');
  let idx = es.indexOf('Monday');
  const antes = es.slice(Math.max(0, idx - 700), idx);
  const ids = [...antes.matchAll(/id="(comp-[a-z0-9]+)"/g)].map(m => m[1]);
  console.log('   ids justo antes de "Monday": ' + JSON.stringify(ids.slice(-3)));
  for (const dia of ['Tuesday', 'Wed - Thru', 'Friday - Saturday', 'Sunday']) {
    const k = es.indexOf(dia);
    if (k < 0) { console.log('   ' + dia + ': no aparece'); continue; }
    const prev = es.slice(Math.max(0, k - 700), k);
    const cid = [...prev.matchAll(/id="(comp-[a-z0-9]+)"/g)].map(m => m[1]).slice(-1)[0];
    console.log('   ' + dia.padEnd(18) + ' → ' + cid);
  }

  console.log('\nC) Selector de idioma: rastro en el HTML');
  for (const [nom, h] of [['EN', en], ['ES', es]]) {
    const marcas = ['languageSelector', 'LanguageMenu', 'wixui-language', 'lang-menu', 'multilingual', 'data-lang', '/es"', 'hreflang'];
    console.log('   ' + nom + ': ' + marcas.map(m => m + '=' + (h.split(m).length - 1)).join('  '));
  }
  // buscar enlaces al otro idioma
  const aEs = [...en.matchAll(/href="([^"]*\/es[^"]*)"/g)].map(m => m[1]).slice(0, 6);
  const aEn = [...es.matchAll(/href="(https:\/\/www\.rosanta\.rest\/(?!es)[^"]*)"/g)].map(m => m[1]).slice(0, 6);
  console.log('   enlaces EN→/es: ' + JSON.stringify(aEs));
  console.log('   enlaces ES→raíz: ' + JSON.stringify(aEn.slice(0, 4)));

  console.log('\nD) ¿El header de /es trae el mismo markup que el de /?');
  for (const [nom, h] of [['EN', en], ['ES', es]]) {
    const iHdr = h.indexOf('SITE_HEADER');
    console.log('   ' + nom + ' SITE_HEADER en índice ' + iHdr + ' · longitud total ' + h.length);
  }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
