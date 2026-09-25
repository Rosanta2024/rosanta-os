#!/usr/bin/env node
/** Verificación de los hreflang inyectados: 5 páginas × 2 idiomas. */
'use strict';
const PARES = [
  ['home',        'https://www.rosanta.rest/',                      'https://www.rosanta.rest/es'],
  ['gift-ideas',  'https://www.rosanta.rest/gift-ideas',            'https://www.rosanta.rest/es/gift-ideas'],
  ['events',      'https://www.rosanta.rest/events-1',              'https://www.rosanta.rest/es/events-1'],
  ['reservas',    'https://www.rosanta.rest/reservas',              'https://www.rosanta.rest/es/reservas'],
  ['faq',         'https://www.rosanta.rest/preguntas-frecuentes',  'https://www.rosanta.rest/es/preguntas-frecuentes'],
  ['full-menu*',  'https://www.rosanta.rest/full-menu',             'https://www.rosanta.rest/es/full-menu']
];
const get = async (u) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'v=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } });
      if (r.ok) return await r.text();
    } catch (e) {}
    await new Promise(s => setTimeout(s, 1500));
  }
  return '';
};
// solo el <head> real, sin los blobs JSON donde Wix guarda una copia escapada
const head = (h) => { const i = h.indexOf('</head>'); return i > 0 ? h.slice(0, i) : h; };
const etiquetas = (h) => (head(h).match(/<link[^>]*rel="alternate"[^>]*hreflang="[^"]*"[^>]*>|<link[^>]*hreflang="[^"]*"[^>]*rel="alternate"[^>]*>/g) || [])
  .map(t => ({ lang: (t.match(/hreflang="([^"]+)"/) || [])[1], href: (t.match(/href="([^"]+)"/) || [])[1] }));

(async () => {
  console.log('VERIFICACIÓN HREFLANG · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '\n' + '='.repeat(88));
  let ok = 0, problemas = [];
  for (const [nombre, urlEn, urlEs] of PARES) {
    const [hEn, hEs] = [await get(urlEn), await get(urlEs)];
    const tEn = etiquetas(hEn), tEs = etiquetas(hEs);
    console.log('\n■ ' + nombre);
    for (const [lbl, t] of [['EN', tEn], ['ES', tEs]]) {
      console.log('   ' + lbl + ' (' + t.length + '): ' + t.map(x => x.lang + '→' + x.href.replace('https://www.rosanta.rest', '')).join('  '));
    }
    // comprobaciones
    const clave = (t) => t.map(x => x.lang + '|' + x.href).sort().join(' ');
    const tresEn = tEn.length === 3, tresEs = tEs.length === 3;
    const iguales = clave(tEn) === clave(tEs);
    const sinDuplicados = new Set(tEn.map(x => x.lang)).size === tEn.length;
    const autoref = tEn.some(x => x.href.replace(/\?.*/, '') === urlEn.replace(/\/$/, '') || x.href.replace(/\?.*/, '') === urlEn);
    const apuntaAlOtro = tEn.some(x => x.href.replace(/\?.*/, '') === urlEs);
    const linea = (tresEn && tresEs ? '✓ 3+3 etiquetas' : '✗ faltan etiquetas') + ' · ' +
                  (iguales ? '✓ idénticas EN/ES' : '✗ difieren') + ' · ' +
                  (sinDuplicados ? '✓ sin duplicados' : '⚠ hreflang repetido') + ' · ' +
                  (autoref ? '✓ autorreferencia' : '✗ sin autorreferencia') + ' · ' +
                  (apuntaAlOtro ? '✓ apunta al otro idioma' : '✗ no apunta al otro');
    console.log('   ' + linea);
    if (tresEn && tresEs && iguales && sinDuplicados && autoref && apuntaAlOtro) ok++;
    else problemas.push(nombre);
  }
  console.log('\n' + '='.repeat(88));
  console.log('RESULTADO: ' + ok + '/' + PARES.length + ' pares correctos' + (problemas.length ? ' · revisar: ' + problemas.join(', ') : ''));
  console.log('(* full-menu usa los hreflang nativos de la app de Restaurants, no un bloque nuestro)');
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
