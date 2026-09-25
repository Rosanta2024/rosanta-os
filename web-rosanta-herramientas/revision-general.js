#!/usr/bin/env node
/**
 * Revisión general del sitio en EN y ES: estructura, hreflang, canonical,
 * metadatos y contenido. Solo lectura.
 */
'use strict';

const BASE = 'https://www.rosanta.rest';
const PAGINAS = [
  ['Home', ''],
  ['Menú completo', '/full-menu'],
  ['Gift Ideas', '/gift-ideas'],
  ['Events', '/events'],
  ['Gift Card', '/gift-card'],
  ['Preguntas Frecuentes', '/preguntas-frecuentes'],
  ['Política de Privacidad', '/política-de-privacidad'],
  ['Reservas', '/reservas'],
  ['Loyalty', '/loyalty']
];

const get = async (u) => {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'rev=' + Date.now(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Cache-Control': 'no-cache' },
        redirect: 'follow'
      });
      return { status: r.status, url: r.url, html: r.ok ? await r.text() : '' };
    } catch (e) { if (intento === 2) return { status: 'ERR', url: u, html: '' }; await new Promise(s => setTimeout(s, 1500)); }
  }
};
const uno = (h, re) => { const m = h.match(re); return m ? m[1] : null; };
const hreflangs = (h) => {
  const out = {};
  for (const m of h.matchAll(/<link[^>]*rel="alternate"[^>]*>/g)) {
    const tag = m[0];
    const lang = uno(tag, /hreflang="([^"]+)"/);
    const href = uno(tag, /href="([^"]+)"/);
    if (lang) out[lang] = href;
  }
  return out;
};

(async () => {
  console.log('REVISIÓN GENERAL · rosanta.rest · ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
  console.log('='.repeat(96));

  const resumen = [];
  for (const [nombre, ruta] of PAGINAS) {
    const en = await get(BASE + (ruta || '/'));
    const es = await get(BASE + '/es' + (ruta || ''));
    const fila = { nombre, ruta, en, es };
    resumen.push(fila);

    console.log('\n■ ' + nombre + '  (' + (ruta || '/') + ')');
    console.log('   HTTP        EN ' + en.status + '   ES ' + es.status);
    if (!en.html || !es.html) { console.log('   ⚠ no se pudo leer alguna versión'); continue; }

    console.log('   lang        EN ' + JSON.stringify(uno(en.html, /<html[^>]*lang="([^"]+)"/)) + '   ES ' + JSON.stringify(uno(es.html, /<html[^>]*lang="([^"]+)"/)));

    const hEn = hreflangs(en.html), hEs = hreflangs(es.html);
    const esperadoEs = BASE + '/es' + (ruta || '');
    const esperadoEn = BASE + (ruta || '/');
    const okEn = !!hEn['es-es'] && !!hEn['en-us'] && !!hEn['x-default'];
    const okEs = !!hEs['es-es'] && !!hEs['en-us'] && !!hEs['x-default'];
    console.log('   hreflang EN ' + (okEn ? '✓' : '✗') + ' ' + JSON.stringify(hEn));
    console.log('   hreflang ES ' + (okEs ? '✓' : '✗') + ' ' + JSON.stringify(hEs));
    // reciprocidad
    if (okEn && okEs) {
      const recip = hEn['es-es'] && hEs['en-us'] && hEn['es-es'].replace(/\?.*/, '') === esperadoEs && hEs['en-us'].replace(/\?.*/, '') === esperadoEn;
      console.log('   recíproco   ' + (recip ? '✓ EN↔ES apuntan uno al otro correctamente' : '⚠ revisar: EN→' + hEn['es-es'] + ' · ES→' + hEs['en-us']));
    }

    console.log('   canonical   EN ' + JSON.stringify(uno(en.html, /<link rel="canonical" href="([^"]+)"/)));
    console.log('               ES ' + JSON.stringify(uno(es.html, /<link rel="canonical" href="([^"]+)"/)));

    const tEn = uno(en.html, /<title>([^<]*)<\/title>/) || '';
    const tEs = uno(es.html, /<title>([^<]*)<\/title>/) || '';
    console.log('   title    EN ' + JSON.stringify(tEn.slice(0, 74)));
    console.log('            ES ' + JSON.stringify(tEs.slice(0, 74)) + (tEn === tEs ? '   ⚠ idéntico al inglés' : '   ✓ propio'));

    const dEn = uno(en.html, /<meta name="description" content="([^"]*)"/) || '';
    const dEs = uno(es.html, /<meta name="description" content="([^"]*)"/) || '';
    console.log('   meta desc ES ' + JSON.stringify(dEs.slice(0, 74)) + (dEn === dEs ? '   ⚠ idéntica al inglés' : '   ✓ propia'));
  }

  // Resumen hreflang
  console.log('\n' + '='.repeat(96));
  console.log('RESUMEN HREFLANG\n');
  let conH = 0, sinH = [];
  for (const f of resumen) {
    if (!f.en.html) continue;
    const h = hreflangs(f.en.html);
    if (h['es-es'] && h['en-us'] && h['x-default']) conH++; else sinH.push(f.nombre);
  }
  console.log('   páginas con hreflang completo: ' + conH + '/' + resumen.length);
  if (sinH.length) console.log('   SIN hreflang: ' + sinH.join(', '));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
