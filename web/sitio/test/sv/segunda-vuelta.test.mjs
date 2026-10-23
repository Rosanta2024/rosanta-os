// Pruebas de la SEGUNDA VUELTA (gift cards, Rosanta Adventures, blog, lista de espera). Corren sobre dist-sv/,
// construido CON el interruptor, y sin red:
//   npm run probar-sv
// (Las 16 pruebas de la copia, `npm test`, siguen corriendo sobre dist/ construido SIN el interruptor.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { RAIZ } from '../../scripts/lib/comun.mjs';
import { metadatos, tiposSchema } from '../../scripts/lib/wix.mjs';
import { resolver, cargarFirebase } from '../../scripts/lib/firebase-local.mjs';

const DIST = path.join(RAIZ, process.env.ROSANTA_DIST || 'dist-sv');
const SITIO = 'https://www.rosanta.rest';
const archivo = (ruta) => path.join(DIST, ruta === '/' ? 'index.html' : ruta.slice(1) + '.html');
const html = (ruta) => readFileSync(archivo(ruta), 'utf8');
const blog = JSON.parse(readFileSync(path.join(RAIZ, 'data', 'blog-ejemplo.json'), 'utf8')).blog;
const ejemplo = JSON.parse(readFileSync(path.join(RAIZ, '..', 'contenido', 'ejemplo-contenido.json'), 'utf8'));
const exp = ejemplo.adventures.experiencias[0];

const NUEVAS = [
  '/adventures', '/es/adventures', `/adventures/${exp.slug}`, `/es/adventures/${exp.slug}`,
  '/blog', '/es/blog', ...blog.flatMap((e) => [`/blog/${e.slug}`, `/es/blog/${e.slug}`]),
];

/** Corre un trozo de código con el módulo de la segunda vuelta y otras variables (los interruptores se leen al importar). */
function conEnv(env, codigo) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `
    const SV = await import(${JSON.stringify(path.join(RAIZ, 'src', 'lib', 'segunda-vuelta.mjs'))});
    console.log(JSON.stringify(await (async () => { ${codigo} })()));`], {
    cwd: RAIZ, env: { ...process.env, PUBLIC_SEGUNDA_VUELTA: '', PUBLIC_CONTENIDO_JSON: '', ...env }, encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').pop());
}

test('la construcción con el interruptor existe (npm run probar-sv)', () => {
  assert.ok(existsSync(path.join(DIST, 'index.html')), `falta ${DIST}: correr npm run probar-sv`);
  for (const r of NUEVAS) assert.ok(existsSync(archivo(r)), `falta ${r}`);
});

test('sin el interruptor no hay páginas nuevas, ni enlaces en el menú', () => {
  const r = conEnv({}, 'return { n: SV.paginasNuevas().length, menu: SV.enlacesMenu("en").length, sv: SV.SEGUNDA_VUELTA, le: SV.LISTA_ESPERA };');
  assert.deepEqual(r, { n: 0, menu: 0, sv: false, le: false });
});

test('sin experiencias publicadas no se genera nada de Adventures (y el blog sigue)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rosanta-sv-'));
  const f = path.join(dir, 'contenido.json');
  writeFileSync(f, JSON.stringify({ ...ejemplo, adventures: { experiencias: [] }, blog }));
  const r = conEnv({ PUBLIC_SEGUNDA_VUELTA: 'si', PUBLIC_CONTENIDO_JSON: f },
    'return { rutas: SV.paginasNuevas().map((p) => p.ruta), menu: SV.enlacesMenu("es").map((m) => m.href) };');
  assert.ok(!r.rutas.some((x) => /adventures/.test(x)), r.rutas.join(', '));
  assert.ok(r.rutas.includes('/es/blog'));
  assert.deepEqual(r.menu, ['/es/blog']);
});

test('el contenido: un formato que no es el 1 hace fallar el build', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rosanta-sv-'));
  const f = path.join(dir, 'contenido.json');
  writeFileSync(f, JSON.stringify({ ...ejemplo, formato: 2 }));
  assert.throws(() => conEnv({ PUBLIC_SEGUNDA_VUELTA: 'si', PUBLIC_CONTENIDO_JSON: f }, 'return SV.paginasNuevas().length;'));
});

test('cada página nueva: title, description, canonical, hreflang, lang, un H1 y su schema', () => {
  for (const ruta of NUEVAS) {
    const c = metadatos(html(ruta));
    const es = ruta.startsWith('/es/');
    assert.ok(c.titulo && c.titulo.length > 10, `${ruta}: título`);
    assert.ok(c.descripcion && c.descripcion.length > 50 && c.descripcion.length <= 160, `${ruta}: descripción (${c.descripcion?.length})`);
    assert.equal(c.canonical, SITIO + ruta, `${ruta}: canonical`);
    assert.equal(c.lang, es ? 'es' : 'en', `${ruta}: lang`);
    assert.deepEqual(c.hreflang.map((h) => h.hreflang).sort(), ['en-us', 'es-es', 'x-default'], `${ruta}: hreflang`);
    const en = es ? ruta.slice(3) : ruta;
    assert.ok(c.hreflang.some((h) => h.hreflang === 'es-es' && h.href === SITIO + '/es' + en), `${ruta}: hreflang es`);
    assert.ok(c.hreflang.some((h) => h.hreflang === 'en-us' && h.href === SITIO + en), `${ruta}: hreflang en`);
    assert.equal(c.h1.length, 1, `${ruta}: un solo H1 (${c.h1.join(' | ')})`);
    for (const j of c.jsonld) assert.ok(!j._error, `${ruta}: JSON-LD inválido`);
    const tipos = tiposSchema(c.jsonld);
    assert.equal(tipos.filter((t) => t === 'Restaurant').length, 1, `${ruta}: un Restaurant`);
    assert.ok(tipos.includes('BreadcrumbList'), `${ruta}: BreadcrumbList`);
    const d = parse(html(ruta));
    assert.ok(d.querySelector('meta[property="og:title"]') && d.querySelector('meta[property="og:image"]'), `${ruta}: Open Graph`);
  }
});

test('Adventures: TouristTrip con Offer y FAQPage, con la URL canónica (www)', () => {
  for (const L of ['en', 'es']) {
    const ruta = (L === 'es' ? '/es' : '') + '/adventures/' + exp.slug;
    const ld = metadatos(html(ruta)).jsonld;
    const trip = ld.find((j) => j['@type'] === 'TouristTrip');
    assert.ok(trip, `${ruta}: TouristTrip`);
    assert.equal(trip.url, SITIO + ruta);
    assert.equal(trip.name, exp.titulo[L]);
    assert.equal(trip.offers['@type'], 'Offer');
    assert.equal(trip.offers.priceCurrency, 'GTQ');
    assert.equal(trip.provider.name, exp.operador.nombre);
    const faq = ld.find((j) => j['@type'] === 'FAQPage');
    assert.ok(faq && faq.mainEntity.length === exp.faq.length, `${ruta}: FAQPage`);
    assert.ok(!JSON.stringify(ld).includes('https://rosanta.rest/'), `${ruta}: quedó una URL sin www`);
  }
  assert.ok(tiposSchema(metadatos(html('/adventures')).jsonld).includes('ItemList'));
});

test('Adventures: operador y aviso legal visibles, marcado PENDIENTE DE REVISIÓN DEL ABOGADO, junto al formulario', () => {
  for (const L of ['en', 'es']) {
    const ruta = (L === 'es' ? '/es' : '') + '/adventures/' + exp.slug;
    const d = parse(html(ruta));
    const texto = metadatos(html(ruta)).texto;
    assert.ok(texto.includes(exp.operador.nombre), `${ruta}: operador`);
    assert.ok(texto.includes(exp.operador.licencia_inguat), `${ruta}: licencia INGUAT`);
    const avisos = d.querySelectorAll('[data-aviso-legal]');
    assert.equal(avisos.length, 2, `${ruta}: aviso en la ficha y junto al formulario`);
    assert.ok(d.querySelector('[data-consulta] [data-aviso-legal]'), `${ruta}: aviso dentro del formulario`);
    for (const a of avisos) {
      assert.ok(a.text.includes(exp.aviso_legal[L].slice(0, 40)), `${ruta}: texto del aviso`);
      assert.ok(a.text.includes('PENDIENTE DE REVISIÓN DEL ABOGADO'), `${ruta}: marca del abogado`);
    }
    assert.ok(d.querySelector('[data-aviso-pendiente]'), `${ruta}: franja de versión de prueba`);
    assert.ok(parse(html(L === 'es' ? '/es/adventures' : '/adventures')).querySelector('[data-aviso-legal]'), 'aviso en el listado');
  }
});

test('Adventures: el formulario va a POST /api/adventures/consulta con el contrato (incluida la cena en Rosanta)', () => {
  const t = html(`/es/adventures/${exp.slug}`);
  assert.match(t, /"url":"\/api\/adventures\/consulta"/);
  for (const campo of ['experiencia: C.slug', 'nombre:', 'email:', 'telefono:', 'idioma: C.idioma', 'fecha:', 'personas:', 'mensaje:', 'cena: conCena.checked ? { fecha:', 'hora:', 'origen:', 'sitio_web:']) {
    assert.ok(t.includes(campo), `falta ${campo}`);
  }
  const d = parse(t);
  assert.ok(d.querySelector('input[name=con_cena]'), 'casilla de cena');
  assert.ok(d.querySelector('select[name=cena_hora]'), 'hora de la cena');
  assert.ok(d.querySelector('input[name=sitio_web]'), 'campo trampa');
  assert.match(metadatos(t).texto, /cena en Rosanta/);
});

test('Blog: BlogPosting y BreadcrumbList; el cuerpo en HTML y sin HTML del contenido', () => {
  for (const e of blog) {
    for (const L of ['en', 'es']) {
      const ruta = (L === 'es' ? '/es' : '') + '/blog/' + e.slug;
      const ld = metadatos(html(ruta)).jsonld;
      const p = ld.find((j) => j['@type'] === 'BlogPosting');
      assert.ok(p, `${ruta}: BlogPosting`);
      assert.equal(p.headline, e.titulo[L]);
      assert.equal(p.datePublished, e.fecha);
      assert.equal(p.inLanguage, L);
      assert.equal(p.mainEntityOfPage, SITIO + ruta);
      assert.ok(p.image && p.author && p.publisher, `${ruta}: image, author, publisher`);
      const migas = ld.find((j) => j['@type'] === 'BreadcrumbList');
      assert.equal(migas.itemListElement.length, 3);
      const d = parse(html(ruta));
      assert.ok(d.querySelectorAll('.entrada-txt h2').length >= 3, `${ruta}: subtítulos`);
      assert.ok(d.querySelectorAll('.entrada-txt li').length >= 3, `${ruta}: listas`);
      assert.ok(!/\*\*|\]\(/.test(d.querySelector('.entrada-txt').text), `${ruta}: quedó markdown sin convertir`);
    }
  }
  assert.ok(tiposSchema(metadatos(html('/blog')).jsonld).includes('Blog'));
});

test('markdown: escapa HTML y solo deja enlaces seguros', () => {
  const r = conEnv({}, 'return SV.markdown("## Hola <b>x</b>\\n\\n<script>alert(1)</script> [a](javascript:alert(1)) [b](/reservas) **c**");');
  assert.ok(!r.includes('<script>') && !r.includes('<b>'), r);
  assert.ok(!r.includes('javascript:'), r);
  assert.ok(r.includes('<a href="/reservas">b</a>') && r.includes('<strong>c</strong>') && r.startsWith('<h2>'), r);
});

test('entradas de ejemplo: forma del formato, EN y ES, y sin el vocabulario prohibido de la marca', () => {
  assert.equal(blog.length, 2);
  for (const e of blog) {
    for (const k of ['id', 'slug', 'orden', 'fecha', 'titulo', 'resumen', 'cuerpo']) assert.ok(k in e, `${e.slug}: falta ${k}`);
    assert.ok('foto' in e);
    assert.match(e.slug, /^[a-z0-9-]+$/);
    assert.match(e.fecha, /^\d{4}-\d{2}-\d{2}$/);
    for (const L of ['es', 'en']) for (const k of ['titulo', 'resumen', 'cuerpo']) assert.ok(e[k][L], `${e.slug}: ${k}.${L}`);
    const todo = JSON.stringify(e);
    assert.ok(!/(^|[.!?:"]\s*)En Rosanta/.test(e.cuerpo.es + ' ' + e.resumen.es), `${e.slug}: abre con «En Rosanta»`);
    for (const malo of ['—', 'nuestro', 'nuestra', 'de autor', 'leña de café', 'sumérgete', 'Jardín Santa Rosa', 'brunch', 'delivery a']) {
      assert.ok(!todo.toLowerCase().includes(malo.toLowerCase()), `${e.slug}: «${malo}»`);
    }
    assert.ok(!/Q\s?\d|GTQ|US\$/.test(todo), `${e.slug}: no lleva precios`);
  }
});

test('gift card: Q300 (US$45), Q500 (US$55), libre desde Q200, vence a los 12 meses; "Escríbenos" con el mensaje escrito', () => {
  for (const [ruta, L] of [['/gift-card', 'en'], ['/es/gift-card', 'es']]) {
    const t = html(ruta);
    const c = metadatos(t);
    const d = parse(t);
    assert.equal(c.canonical, SITIO + ruta);
    assert.equal(c.hreflang.length, 3);
    assert.equal(c.h1.length, 1);
    assert.ok(c.descripcion && c.descripcion.length <= 160, `${ruta}: descripción`);
    assert.ok(!t.includes('GTQ 25'), `${ruta}: quedaron los montos viejos de Wix`);
    for (const s of ['Q300', 'US$45', 'Q500', 'US$55', 'Q200', '12']) assert.ok(c.texto.includes(s), `${ruta}: falta ${s}`);
    const wa = d.querySelector('[data-wa]').getAttribute('href');
    const mail = d.querySelector('[data-mail]').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/50230826935?text='), wa);
    assert.ok(decodeURIComponent(wa.split('text=')[1]).includes('Q300 (US$45)'), 'mensaje con el monto');
    assert.ok(mail.startsWith('mailto:restaurante@rosanta.rest?'), mail);
    assert.ok(c.texto.includes('+502 3082 6935') && c.texto.includes('restaurante@rosanta.rest'));
    assert.ok(d.querySelector('input[type=number][min="200"]'), `${ruta}: monto libre desde Q200`);
    assert.match(c.texto, L === 'es' ? /Escríbenos/ : /Write to us/);
    // Schema Product/Offer
    const prods = c.jsonld.filter((j) => j['@type'] === 'Product');
    assert.equal(prods.length, 1, `${ruta}: un Product`);
    const o = prods[0].offers;
    assert.equal(o['@type'], 'AggregateOffer');
    assert.equal(o.priceCurrency, 'GTQ');
    assert.equal(Number(o.lowPrice), 200);
    assert.deepEqual(o.offers.map((x) => [x['@type'], Number(x.price), x.priceCurrency]), [['Offer', 300, 'GTQ'], ['Offer', 500, 'GTQ']]);
    assert.equal(prods[0].brand['@type'], 'Brand');
    assert.ok(prods[0].image.startsWith(SITIO + '/img/'), 'imagen local');
    assert.equal(prods[0].url, SITIO + ruta);
    assert.equal(tiposSchema(c.jsonld).filter((t2) => t2 === 'Restaurant').length, 1);
  }
});

test('menú (rediseño del 23-oct): Adventures y Blog al principio de "Más" en todas las páginas', () => {
  for (const [ruta, adv, bl] of [['/', '/adventures', '/blog'], ['/es', '/es/adventures', '/es/blog'], ['/full-menu', '/adventures', '/blog']]) {
    const enlaces = parse(html(ruta)).querySelectorAll('nav.menu li.mas ul.sub a').map((a) => a.getAttribute('href'));
    assert.deepEqual(enlaces.slice(0, 2), [adv, bl], `${ruta}: ${enlaces.join(' ')}`);
  }
});

test('sitemaps y llms.txt: las páginas nuevas entran (en su idioma) y todas dan 200', () => {
  const hosting = cargarFirebase();
  const locs = (f) => [...readFileSync(path.join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeURI(new URL(m[1]).pathname));
  const en = locs('pages-sitemap.xml'), es = locs('es_es-pages-sitemap.xml');
  for (const r of NUEVAS) assert.ok((r.startsWith('/es/') ? es : en).includes(r), `${r} fuera del sitemap`);
  for (const r of [...en, ...es]) assert.equal(resolver(r, hosting, DIST).estado, 200, `${r} no da 200`);
  const l = readFileSync(path.join(DIST, 'llms.txt'), 'utf8');
  for (const r of NUEVAS) assert.ok(l.includes(SITIO + r), `llms.txt sin ${r}`);
  assert.match(l, /## Tarjetas de regalo/);
  assert.match(l, /operadores aliados independientes/);
});

test('sin enlaces internos rotos en TODO el sitio con el interruptor', () => {
  const hosting = cargarFirebase();
  const seguir = (ruta) => {
    let actual = ruta;
    for (let i = 0; i < 6; i++) {
      const r = resolver(actual, hosting, DIST);
      if (r.estado >= 300 && r.estado < 400) { actual = r.destino; continue; }
      return r;
    }
    return { estado: 310 };
  };
  const paginas = [];
  const recorrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (e.name.endsWith('.html') && e.name !== '404.html') paginas.push(f);
    }
  };
  recorrer(DIST);
  assert.ok(paginas.length >= 40, `${paginas.length} páginas`);
  const rotos = [];
  for (const f of paginas) {
    const d = parse(readFileSync(f, 'utf8'));
    const ids = new Set(d.querySelectorAll('[id]').map((e) => e.getAttribute('id')));
    for (const el of d.querySelectorAll('a[href], img[src], link[href], script[src], iframe[src]')) {
      const v = el.getAttribute('href') || el.getAttribute('src');
      if (!v || /^(https?:|mailto:|tel:|data:|javascript:)/.test(v) || v.startsWith('//')) continue;
      if (v.startsWith('#')) { if (v.length > 1 && !ids.has(v.slice(1))) rotos.push(`${f}: ancla ${v}`); continue; }
      const [ruta, ancla] = v.split('#');
      const r = seguir(ruta);
      if (r.estado !== 200) rotos.push(`${path.relative(DIST, f)}: ${v} (${r.estado})`);
      else if (ancla && r.archivo && !readFileSync(r.archivo, 'utf8').includes(`id="${ancla}"`)) rotos.push(`${path.relative(DIST, f)}: ${v} (sin ancla)`);
    }
  }
  assert.deepEqual(rotos, []);
});

test('lista de espera (PUBLIC_LISTA_ESPERA=si): en reservas, POST {API_BASE}/lista-espera con el contrato', () => {
  for (const ruta of ['/reservas', '/es/reservas']) {
    const t = html(ruta);
    assert.ok(parse(t).querySelector('[data-lista-espera]'), `${ruta}: bloque`);
    assert.match(t, /\/lista-espera'/);
    for (const k of ['fecha:', 'desde:', 'hasta:', 'personas:', 'nombre:', 'email:', 'telefono:', 'idioma:', 'fuente:']) assert.ok(t.includes(k), `${ruta}: ${k}`);
  }
  assert.match(html('/es/reservas'), /Avísame si se libera una mesa/);
  assert.match(html('/reservas'), /Let me know if a table opens up/);
});

test('ninguna medición nueva: las páginas nuevas cargan los mismos scripts externos que la portada', () => {
  const externos = (ruta) => new Set(parse(html(ruta)).querySelectorAll('script[src]').map((s) => s.getAttribute('src')).filter((s) => /^https?:/.test(s)));
  const base = externos('/');
  for (const r of [...NUEVAS, '/gift-card', '/reservas']) {
    for (const s of externos(r)) assert.ok(base.has(s), `${r}: script nuevo ${s}`);
    assert.ok(!/fbq\('track','(?!PageView)/.test(html(r)), `${r}: evento de pixel nuevo`);
    assert.ok(!/dataLayer\.push\(\{\s*event:\s*'(?!reserva_creada)/.test(html(r)), `${r}: evento de dataLayer nuevo`);
  }
});
