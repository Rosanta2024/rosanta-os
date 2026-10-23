// Pruebas de la copia de rosanta.rest. Corren sobre dist/ (antes: npm run build) y sin red.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'node-html-parser';
import { RAIZ, DATA } from '../scripts/lib/comun.mjs';
import { metadatos, tiposSchema } from '../scripts/lib/wix.mjs';
import { resolver, seguir } from '../scripts/lib/firebase-local.mjs';
import { probar } from '../scripts/probar-301.mjs';
import { PALABRAS_MENU_WIX } from '../src/lib/navegacion.mjs';

const DIST = path.join(RAIZ, 'dist');
const leer = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));
const inventario = leer('inventario.json');
const mejoras = leer('mejoras-seo.json');
const paginasWix = readdirSync(path.join(DATA, 'paginas')).filter((f) => !f.startsWith('_')).map((f) => leer(path.join('paginas', f)));
const servidas = paginasWix.filter((p) => !mejoras.redirigir?.[p.ruta]);
const archivo = (ruta) => path.join(DIST, ruta === '/' ? 'index.html' : ruta.slice(1) + '.html');
const html = (ruta) => readFileSync(archivo(ruta), 'utf8');

test('la construcción existe', () => {
  assert.ok(existsSync(path.join(DIST, 'index.html')), 'falta dist/: correr npm run build');
});

test('cada dirección del inventario responde como debe (200, 301 una a una, o 404)', async () => {
  const res = await probar(async (r) => seguir(r));
  const malos = res.filter((r) => !r.ok);
  assert.equal(malos.length, 0, malos.map((m) => `${m.ruta}: ${m.nota}`).join('\n'));
  assert.ok(res.length >= 60);
});

test('ninguna 301 va a la portada y no hay cadenas', () => {
  const hosting = JSON.parse(readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')).hosting;
  for (const r of hosting.redirects) {
    assert.notEqual(r.destination, '/', r.source);
    assert.notEqual(r.destination, '/es', r.source);
    assert.equal(resolver(r.destination, hosting).estado, 200, `${r.source} → ${r.destination} no da 200`);
  }
});

test('firebase.json: /api/** y /r/** van a Cloud Run rosanta-web en northamerica-south1', () => {
  const h = JSON.parse(readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')).hosting;
  const api = h.rewrites.find((r) => r.source === '/api/**');
  assert.deepEqual(api.run, { serviceId: 'rosanta-web', region: 'northamerica-south1' });
  const mi = h.rewrites.find((r) => r.source === '/r/**');
  assert.deepEqual(mi.run, { serviceId: 'rosanta-web', region: 'northamerica-south1' });
  assert.equal(h.public, 'dist');
  assert.equal(h.cleanUrls, true);
  assert.equal(h.trailingSlash, false);
});

test('cada página tiene título, canonical, hreflang, descripción, H1 y schema como Wix', () => {
  for (const p of servidas) {
    const c = metadatos(html(p.ruta));
    assert.equal(c.titulo, p.titulo, `${p.ruta}: título`);
    assert.equal(c.canonical, p.canonical, `${p.ruta}: canonical`);
    assert.equal(c.hreflang.length, p.hreflang.length, `${p.ruta}: hreflang`);
    assert.equal(c.lang, p.lang, `${p.ruta}: lang`);
    // Lo que Wix no tiene se copia igual (decisión: corregir después del traslado).
    if (p.descripcion) assert.equal(c.descripcion, p.descripcion, `${p.ruta}: descripción`);
    for (const h of p.h1) assert.ok(c.h1.includes(h), `${p.ruta}: falta H1 «${h}»`);
    assert.equal(tiposSchema(c.jsonld).filter((t) => t === 'Restaurant').length, 1, `${p.ruta}: debe haber UN Restaurant`);
    const sin = (l) => tiposSchema(l).filter((t) => t !== 'Restaurant' && t !== 'WebSite');
    assert.deepEqual(sin(c.jsonld), sin(p.jsonld), `${p.ruta}: tipos de schema`);
    for (const j of c.jsonld) assert.ok(!j._error, `${p.ruta}: JSON-LD inválido`);
  }
});

test('las páginas indexables tienen hreflang, y el Restaurant es el completo (con el lunes)', () => {
  const r = leer('restaurante.json').jsonld;
  assert.ok(r.openingHoursSpecification.some((h) => [].concat(h.dayOfWeek).includes('Monday')));
  for (const p of servidas.filter((x) => !/reservation-details|experience-details/.test(x.ruta))) {
    assert.ok(metadatos(html(p.ruta)).hreflang.length >= 3, `${p.ruta}: sin hreflang`);
  }
});

test('el sitio se lee SIN JavaScript: texto en el HTML', () => {
  for (const p of servidas) {
    const c = metadatos(html(p.ruta));
    const w = p.texto_visible.replace(/top of page|bottom of page|Use tab to navigate through the menu items\.|LOCATION More/g, '');
    // El texto que Wix entrega sin JavaScript está también en la copia (mismas palabras).
    // Rediseño del 23-oct (Juanma): el menú de Wix (con etiquetas en inglés en /es) se rehízo en cada idioma, y en
    // Contacto se quitaron los emojis. Se ignoran esas palabras del menú de Wix y los tokens que son solo emojis.
    const faltan = w.toLowerCase().split(/\s+/).filter((x) => x && x !== 'more' && !PALABRAS_MENU_WIX.includes(x) && /[\p{L}\p{N}]/u.test(x) && !c.texto.toLowerCase().includes(x));
    assert.deepEqual(faltan, [], `${p.ruta}: palabras que faltan`);
  }
  // FAQ: las 18 preguntas en HTML (en Wix solo estaban en el schema y en un iframe)
  for (const ruta of ['/preguntas-frecuentes', '/es/preguntas-frecuentes']) {
    const d = parse(html(ruta));
    const preguntas = d.querySelectorAll('details.item summary');
    assert.equal(preguntas.length, 36, `${ruta}: 18 preguntas en cada idioma`);
    assert.ok(d.querySelectorAll('.faq-idioma:not([hidden]) details').length === 18);
  }
  // Menú: platos y precios en texto
  const menu = metadatos(html('/full-menu')).texto;
  assert.ok((menu.match(/GTQ \d+/g) || []).length > 50, 'menú con precios en texto');
});

test('sin enlaces internos rotos', () => {
  const hosting = JSON.parse(readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')).hosting;
  const rotos = [];
  for (const p of servidas) {
    const d = parse(html(p.ruta));
    const ids = new Set(d.querySelectorAll('[id]').map((e) => e.getAttribute('id')));
    for (const el of d.querySelectorAll('a[href], img[src], link[href], script[src], iframe[src]')) {
      const v = el.getAttribute('href') || el.getAttribute('src');
      if (!v || /^(https?:|mailto:|tel:|data:|javascript:)/.test(v) || v.startsWith('//')) continue;
      if (v.startsWith('#')) { if (v.length > 1 && !ids.has(v.slice(1))) rotos.push(`${p.ruta}: ancla ${v}`); continue; }
      const [ruta, ancla] = v.split('#');
      const cad = seguir(ruta, hosting);
      if (cad[cad.length - 1].estado !== 200) rotos.push(`${p.ruta}: ${v} (${cad.map((x) => x.estado).join('→')})`);
      if (ancla && cad[cad.length - 1].archivo) {
        const otro = readFileSync(cad[cad.length - 1].archivo, 'utf8');
        if (!otro.includes(`id="${ancla}"`)) rotos.push(`${p.ruta}: ${v} (no existe el ancla)`);
      }
    }
  }
  assert.deepEqual(rotos, []);
});

test('robots.txt: igual al de Wix, todos los bots (incluidos los de IA) permitidos', () => {
  const r = readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
  const wix = readFileSync(path.join(DATA, 'wix', 'robots.txt'), 'utf8');
  assert.match(r, /^User-agent: \*\nAllow: \/\n/);
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Bingbot']) {
    assert.ok(!new RegExp(`User-agent: ${bot}\\s*\\nDisallow: /\\s*\\n`, 'i').test(r), `${bot} bloqueado`);
  }
  for (const linea of wix.split('\n').filter((l) => l.trim() && !/Auto generated/.test(l))) assert.ok(r.includes(linea), `falta «${linea}»`);
  assert.match(r, /Sitemap: https:\/\/www\.rosanta\.rest\/sitemap\.xml/);
  assert.match(r, /Sitemap: https:\/\/www\.rosanta\.rest\/es_es-sitemap\.xml/);
});

test('sitemaps: mismos archivos que Wix, solo direcciones que dan 200, con hreflang', () => {
  for (const f of ['sitemap.xml', 'es_es-sitemap.xml', 'pages-sitemap.xml', 'es_es-pages-sitemap.xml', 'restaurants-menu-sitemap.xml', 'es_es-restaurants-menu-sitemap.xml']) {
    assert.ok(existsSync(path.join(DIST, f)), f);
  }
  const locs = ['pages-sitemap.xml', 'es_es-pages-sitemap.xml', 'restaurants-menu-sitemap.xml', 'es_es-restaurants-menu-sitemap.xml'].flatMap((f) =>
    [...readFileSync(path.join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
  );
  assert.ok(locs.length >= 28);
  for (const l of locs) {
    const u = new URL(l);
    assert.equal(resolver(u.pathname).estado, 200, `${l} no da 200`);
  }
  assert.match(readFileSync(path.join(DIST, 'pages-sitemap.xml'), 'utf8'), /xhtml:link rel="alternate" hreflang="es-es"/);
  // todas las páginas indexables de Wix están en algún sitemap
  const enMapas = new Set(locs.map((l) => decodeURI(new URL(l).pathname)));
  for (const p of servidas.filter((x) => !/reservation-details/.test(x.ruta))) assert.ok(enMapas.has(p.ruta), `${p.ruta} fuera del sitemap`);
});

test('llms.txt: el de Wix, sin el MCP de Wix, con datos que salen del schema', () => {
  const l = readFileSync(path.join(DIST, 'llms.txt'), 'utf8');
  const wix = readFileSync(path.join(DATA, 'wix', 'llms.txt'), 'utf8');
  assert.ok(!/_api\/mcp|MCP|Wix/i.test(l), 'quedó algo del MCP de Wix');
  assert.ok(l.startsWith(wix.slice(0, wix.indexOf('## Datos del restaurante'))), 'la presentación cambió');
  for (const s of ['1a Calle Oriente 15', '+502 7768 8880', 'restaurante@rosanta.rest', 'lunes y martes 17:00–21:00', 'domingo 15:00–20:00']) assert.ok(l.includes(s), s);
  // la sección de horarios coincide con la de Wix
  const h = (t) => t.match(/^- Horarios: .*$/m)[0];
  assert.equal(h(l), h(wix));
});

test('medición: GTM-M78RL4HH y la fuente del tráfico en todas las páginas', () => {
  for (const p of servidas) {
    const t = html(p.ruta);
    assert.ok(t.includes("'GTM-M78RL4HH'") || t.includes('"GTM-M78RL4HH"'), `${p.ruta}: GTM`);
    assert.ok(t.includes('ns.html?id=GTM-M78RL4HH'), `${p.ruta}: GTM noscript`);
    assert.ok(t.includes('/js/fuente.js'), `${p.ruta}: fuente.js`);
  }
});

test('fuente del tráfico: canal IA para ChatGPT, Perplexity, Gemini, Copilot y Claude', () => {
  const ctx = { URL, Date, JSON, module: { exports: {} } };
  vm.runInNewContext(readFileSync(path.join(RAIZ, 'public', 'js', 'fuente.js'), 'utf8'), ctx);
  const F = ctx.module.exports;
  const d = (url, ref = '') => F.detectar(url, ref);
  assert.equal(d('https://www.rosanta.rest/?utm_source=chatgpt.com').canal, 'IA');
  assert.equal(d('https://www.rosanta.rest/?utm_source=chatgpt.com').source, 'chatgpt.com');
  for (const ref of ['https://chat.openai.com/', 'https://www.perplexity.ai/search', 'https://gemini.google.com/app', 'https://copilot.microsoft.com/', 'https://claude.ai/chat/x']) {
    assert.equal(d('https://www.rosanta.rest/reservas', ref).canal, 'IA', ref);
  }
  assert.equal(d('https://www.rosanta.rest/?gclid=1').source, 'google_ads');
  assert.equal(d('https://www.rosanta.rest/?gclid=1').canal, 'Pago');
  assert.equal(d('https://www.rosanta.rest/', 'https://www.google.com/').source, 'google_organic');
  assert.equal(d('https://www.rosanta.rest/', 'https://www.instagram.com/').canal, 'Social');
  assert.equal(d('https://www.rosanta.rest/').canal, 'Directo');
});

test('formulario de reservas: en la página, API_BASE configurable, "fuente" en reserva y carrito, sin llaves', () => {
  for (const ruta of ['/reservas', '/es/reservas']) {
    const t = html(ruta);
    assert.ok(!t.includes('filesusr.com'), 'no debe ser un iframe de Wix');
    assert.match(t, /class="rsv"/);
    assert.match(t, /\/slots\?date=/);
    assert.match(t, /\/reservar/);
    assert.match(t, /fuente:\s*fuente\(\)/);
    assert.match(t, /consentimiento: permiso\(\), fecha: .*fuente: fuente\(\)/s);
  }
  assert.match(html('/es/reservas'), /RESERVA TU MESA/);
  assert.match(html('/reservas'), /BOOK YOUR TABLE/);
});

test('ninguna llave ni token en la construcción', () => {
  const malos = [];
  const recorrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(html|js|txt|xml|json|css)$/.test(e.name)) {
        const t = readFileSync(f, 'utf8');
        if (/AIza[0-9A-Za-z_-]{20,}/.test(t) || /[?&]token=[A-Za-z0-9]/.test(t) || /<CLAVE_GOOGLE_TAPADA>|<TOKEN_VIEJO_TAPADO>/.test(t)) malos.push(f);
      }
    }
  };
  recorrer(DIST);
  assert.deepEqual(malos, []);
});

test('imágenes: todas locales, con el alt de Wix, y el peso total dentro del presupuesto', () => {
  let total = 0;
  for (const i of leer('imagenes.json')) {
    assert.ok(i.archivo, `${i.medio} sin bajar`);
    total += readFileSync(path.join(RAIZ, 'public', i.archivo)).length;
  }
  assert.ok(total < 40 * 1024 * 1024);
  for (const p of servidas) {
    const d = parse(html(p.ruta));
    for (const img of d.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      assert.ok(!/wixstatic/.test(src), `${p.ruta}: imagen de Wix ${src}`);
      assert.ok(img.getAttribute('alt') != null, `${p.ruta}: img sin alt`);
    }
  }
});

// ---- Rediseño del 23-oct (comentarios de Juanma) ----
test('encabezado: 6 pestañas a la vista (5 + Reservaciones) y el resto en "Más", en EN y ES', () => {
  for (const [ruta, mas] of [['/', 'MORE'], ['/es', 'MÁS']]) {
    const d = parse(html(ruta));
    const menu = d.querySelector('nav.menu');
    const visibles = menu.querySelectorAll(':scope > ul > li:not(.li-idioma) > a');
    assert.equal(visibles.length, 6, `${ruta}: 6 pestañas`);
    assert.equal(menu.querySelector('.mas summary').text.trim(), mas);
    assert.ok(menu.querySelectorAll('.mas .sub a').length >= 4, `${ruta}: el resto en "${mas}"`);
  }
});

test('reseñas: calificación general, 4 reseñas reales con nombre, fecha y texto, y el enlace a Google (sin widgets de terceros)', () => {
  const r = leer('resenas.json');
  assert.ok(r.promedio >= 1 && r.total > 0);
  for (const ruta of ['/', '/es', '/reservas', '/es/reservas']) {
    const d = parse(html(ruta));
    const caja = d.querySelector('.resenas');
    assert.ok(caja, `${ruta}: sin reseñas`);
    assert.match(caja.querySelector('.badge').text, /\d\.\d/);
    const tarjetas = caja.querySelectorAll('.card');
    assert.equal(tarjetas.length, 4, `${ruta}: 4 reseñas`);
    for (const t of tarjetas) for (const c of ['.who', '.when', '.ctext']) assert.ok(t.querySelector(c)?.text.trim(), `${ruta}: tarjeta sin ${c}`);
    assert.match(caja.querySelector('.foot a').getAttribute('href'), /google\.com/);
  }
  assert.ok(!/maps\.googleapis\.com\/maps\/api\/js/.test(html('/')), 'no debe cargar la API de Places en el navegador');
});

test('alt: toda imagen con texto alternativo en el idioma de la página; las fotos de fondo, descritas', () => {
  const alt = leer('alt.json');
  for (const p of servidas) {
    const d = parse(html(p.ruta));
    for (const img of d.querySelectorAll('main img')) {
      const a = img.getAttribute('alt');
      const medio = Object.keys(alt).find((k) => k.startsWith(path.basename(img.getAttribute('src')).replace(/\.\w+$/, '')));
      if (medio && alt[medio].decorativa) { assert.equal(a, '', `${p.ruta}: decorativa con alt vacío`); continue; }
      assert.ok(a && a.trim().length > 3, `${p.ruta}: ${img.getAttribute('src')} sin alt`);
      if (medio && alt[medio][p.idioma]) assert.equal(a, alt[medio][p.idioma], `${p.ruta}: alt en el otro idioma`);
    }
  }
  const fondos = parse(html('/es')).querySelectorAll('img.fondo-img');
  assert.ok(fondos.length >= 4 && fondos.every((i) => i.getAttribute('alt')?.length > 3), 'fotos de fondo de la portada, con alt');
});

test('contacto: dirección, teléfono, WhatsApp, correo, horarios y el mapa en la misma sección', () => {
  for (const ruta of ['/', '/es']) {
    const s = parse(html(ruta)).querySelector('#comp-lhjc19fq');
    assert.ok(s.querySelector('a[href^="tel:+502"]') && s.querySelector('a[href*="wa.me/50230826935"]') && s.querySelector('a[href^="mailto:"]'));
    assert.equal(s.querySelectorAll('.contacto-horas dt').length, 5);
    assert.ok(s.querySelector('#mapa iframe'));
  }
});
