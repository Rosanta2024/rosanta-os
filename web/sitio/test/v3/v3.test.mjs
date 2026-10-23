// Pruebas de la web v3 (rediseño). Corren sobre dist/ construido con PUBLIC_V3=si PUBLIC_PRUEBA=si:
//   PUBLIC_V3=si PUBLIC_PRUEBA=si PUBLIC_API_BASE=/api/reservas npm run build && npm run test:v3
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';

const RAIZ = process.cwd();
const DIST = path.join(RAIZ, 'dist');
const html = (r) => readFileSync(path.join(DIST, r === '/' ? 'index.html' : r.slice(1) + '.html'), 'utf8');
const dom = (r) => parse(html(r));
const PAGINAS = ['/', '/es', '/full-menu', '/es/full-menu', '/reservas', '/es/reservas', '/gift-ideas', '/es/gift-ideas', '/events-1', '/es/events-1'];

test('la construcción es la v3 de prueba (noindex, sin medición)', () => {
  for (const r of PAGINAS) {
    const t = html(r);
    assert.match(t, /class="v3"|class="v3 /, `${r}: no es v3`);
    assert.match(t, /<meta name="robots" content="noindex, nofollow"/, `${r}: sin noindex`);
    assert.ok(!/GTM-M78RL4HH|fbq\(|gtag\/js/.test(t), `${r}: tiene medición`);
  }
});

test('portada: video vertical a pantalla completa, reserva rápida (día y personas) y prueba social', () => {
  for (const r of ['/', '/es']) {
    const d = dom(r);
    const hero = d.querySelector('.v3-hero');
    assert.ok(hero.querySelector('video[data-prioridad] source[src$=".mp4"]'), `${r}: video de portada`);
    assert.ok(hero.querySelector('h1'), `${r}: h1`);
    const f = hero.querySelector('form.v3-rapida');
    assert.equal(f.getAttribute('action'), r === '/' ? '/reservas' : '/es/reservas');
    assert.equal(f.querySelectorAll('input[name=dia]').length, 4);
    assert.equal(f.querySelectorAll('input[name=personas]').length, 5);
    assert.match(hero.querySelector('.v3-prueba').text, /\d\.\d · \d+/);
    assert.ok(d.querySelector('.v3-barra .v3-barra-reservar'), `${r}: barra fija`);
    assert.ok(d.querySelector('.v3-barra a[href*="wa.me/"]'), `${r}: WhatsApp`);
  }
});

test('cada sección de la portada lleva a reservar o a cotizar', () => {
  for (const r of ['/', '/es']) {
    const d = dom(r);
    const reservar = r === '/' ? '/reservas' : '/es/reservas';
    for (const s of d.querySelectorAll('main > section')) {
      const hrefs = s.querySelectorAll('a[href], form[action]').map((a) => a.getAttribute('href') || a.getAttribute('action'));
      const ok = hrefs.some((h) => h === reservar || /events-1|gift-ideas|wa\.me|full-menu|google\.com\/maps/.test(h)) || s.classList.contains('v3-resenas') || s.classList.contains('v3-categorias');
      assert.ok(ok, `${r}: la sección ${s.getAttribute('class')} no lleva a ninguna acción`);
    }
  }
});

test('videos: sin sonido, en bucle, carga diferida (salvo la portada) y livianos (< 3.5 MB)', () => {
  for (const r of PAGINAS) {
    for (const v of dom(r).querySelectorAll('video')) {
      for (const a of ['muted', 'playsinline', 'loop']) assert.ok(v.hasAttribute(a), `${r}: video sin ${a}`);
      assert.equal(v.getAttribute('preload'), 'none');
      assert.ok(existsSync(path.join(DIST, v.getAttribute('poster'))), `${r}: póster ${v.getAttribute('poster')}`);
      for (const s of v.querySelectorAll('source')) {
        const src = s.getAttribute('src') || s.getAttribute('data-src');
        if (!v.hasAttribute('data-prioridad')) assert.ok(s.getAttribute('data-src'), `${r}: ${src} no es diferido`);
        const f = path.join(DIST, src);
        assert.ok(existsSync(f), `${r}: falta ${src}`);
        assert.ok(statSync(f).size < 3.5 * 1024 * 1024, `${src} pesa demasiado`);
      }
    }
  }
});

test('los videos con texto en español no salen en las páginas en inglés', () => {
  for (const r of PAGINAS.filter((x) => !x.startsWith('/es'))) {
    assert.ok(!/\/video\/[a-z-]+-es\.(mp4|webm|jpg)/.test(html(r)), `${r}: usa un video en español`);
  }
});

test('carta: 4 pestañas (Para compartir · Del fuego · Del jardín · La barra), precios con línea punteada y etiquetas', () => {
  for (const [r, nombres] of [['/es/full-menu', ['Para compartir', 'Del fuego', 'Del jardín', 'La barra']], ['/full-menu', ['To share', 'From the fire', 'From the garden', 'The bar']]]) {
    const d = dom(r);
    assert.deepEqual(d.querySelectorAll('[role=tab]').map((t) => t.text.trim()), nombres);
    assert.deepEqual(d.querySelectorAll('[role=tabpanel]').map((p) => p.id), ['para-compartir', 'del-fuego', 'del-jardin', 'la-barra']);
    const platos = d.querySelectorAll('.v3-plato');
    assert.ok(platos.length >= 70, `${r}: ${platos.length} platos`);
    assert.ok(platos.every((p) => p.querySelector('.v3-puntos')), `${r}: platos sin línea punteada`);
    assert.ok((d.text.match(/Q\d+/g) || []).length >= 70, `${r}: precios`);
    assert.match(d.text, r.startsWith('/es') ? /maridaje sugerido: El Fufurufo/ : /suggested pairing: El Fufurufo/);
    assert.match(d.text, r.startsWith('/es') ? /Vegetariano · opción vegana/ : /Vegetarian · vegan option/);
    assert.ok(d.querySelectorAll('.v3-plato.con-foto').length >= 15, `${r}: platos con foto`);
  }
});

test('accesibilidad básica: alt en toda imagen, botones y enlaces con nombre, un solo h1', () => {
  for (const r of PAGINAS) {
    const d = dom(r);
    for (const img of d.querySelectorAll('img')) assert.ok(img.getAttribute('alt') != null, `${r}: img sin alt ${img.getAttribute('src')}`);
    for (const a of d.querySelectorAll('a[href], button')) assert.ok(a.text.trim() || a.getAttribute('aria-label') || a.querySelector('img[alt]:not([alt=""])'), `${r}: ${a.toString().slice(0, 80)} sin nombre`);
    assert.equal(d.querySelectorAll('h1').length, 1, `${r}: h1`);
  }
});

test('enlaces internos de la v3 sin romper', () => {
  const rotos = [];
  for (const r of PAGINAS) {
    for (const a of dom(r).querySelectorAll('.v3-enc a[href], .v3-menu a[href], .v3-pie a[href], main a[href^="/"], .v3-barra a[href]')) {
      const [ruta, ancla] = a.getAttribute('href').split('#');
      if (!ruta.startsWith('/')) continue;
      const f = path.join(DIST, ruta === '/' ? 'index.html' : decodeURI(ruta).slice(1) + '.html');
      if (!existsSync(f)) { rotos.push(`${r}: ${ruta}`); continue; }
      if (ancla && !readFileSync(f, 'utf8').includes(`id="${ancla}"`)) rotos.push(`${r}: ${a.getAttribute('href')} (ancla)`);
    }
  }
  assert.deepEqual(rotos, []);
});

test('marca: sin rayas largas ni "En Rosanta" en los textos nuevos', () => {
  const v3 = readFileSync(path.join(RAIZ, 'src', 'lib', 'v3.mjs'), 'utf8');
  const textos = [...v3.matchAll(/'([^'\n]{12,})'/g)].map((m) => m[1]);
  for (const t of textos) {
    assert.ok(!t.includes('—'), `raya larga: ${t}`);
    assert.ok(!/^En Rosanta/.test(t), `abre con "En Rosanta": ${t}`);
    assert.ok(!/\bnuestr[oa]s?\b|\bour\b/i.test(t), `posesivo: ${t}`);
  }
});
