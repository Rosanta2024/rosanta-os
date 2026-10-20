// Archivos que se generan después de construir: robots.txt, sitemaps (con hreflang), llms.txt
// y el mapa de 301 (data/redirecciones.json, que firebase.json usa).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RAIZ, DATA, normRuta } from './comun.mjs';

process.env.ROSANTA_SITIO_RAIZ = RAIZ;
const { datos, paginasDelSitio, descripcion, SITIO } = await import('../../src/lib/sitio.mjs');

const DIST = path.join(RAIZ, 'dist');
const hoy = new Date().toISOString().slice(0, 10);
const enc = (r) => SITIO + (r === '/' ? '' : encodeURI(r));
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- 301 ----------
/** Mapa de 301 una a una: las que ya existen en Wix + las de mejoras-seo.json. */
export function redirecciones() {
  const { inventario, mejoras } = datos();
  const out = new Map();
  for (const d of inventario.direcciones) {
    if (d.estado >= 300 && d.estado < 400 && d.estado_final === 200 && !d.ruta.includes('?')) {
      out.set(d.ruta, { desde: d.ruta, hacia: normRuta(d.ruta_final.split('?')[0]), origen: 'wix' });
    }
  }
  for (const [desde, hacia] of Object.entries(mejoras.redirigir || {})) {
    if (desde.startsWith('_')) continue;
    out.set(desde, { desde, hacia, origen: 'copia' });
  }
  // PDF que Wix también sirve bajo /es/_files/…: 301 al mismo archivo en /_files/…
  for (const a of JSON.parse(readFileSync(path.join(DATA, 'archivos.json'), 'utf8'))) {
    for (const al of a.alias || []) out.set(al, { desde: al, hacia: a.ruta, origen: 'wix-archivo' });
  }
  const lista = [...out.values()].sort((a, b) => a.desde.localeCompare(b.desde));
  for (const r of lista) {
    if (r.hacia === '/' || r.hacia === '/es') throw new Error(`301 a la portada prohibida: ${r.desde}`);
  }
  return lista;
}

// ---------- sitemaps ----------
function urlXml(p, loc) {
  const alt = p.hreflang
    .map((h) => `<xhtml:link rel="alternate" hreflang="${xml(h.hreflang)}" href="${xml(encodeURI(decodeURI(h.href)))}"/>`)
    .join('');
  return `<url><loc>${xml(loc)}</loc><lastmod>${hoy}</lastmod>${alt}</url>`;
}
function urlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}
function indice(hijos) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${hijos
    .map((h) => `<sitemap><loc>${SITIO}/${h}</loc><lastmod>${hoy}</lastmod></sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;
}
/** Los mismos 2 índices y 4 sub-mapas que Wix, solo con páginas que responden 200. */
export function sitemaps() {
  const pags = paginasDelSitio();
  const sistema = new Set(['/reservation-details', '/es/reservation-details']); // Wix no las lista
  const listadas = pags.filter((p) => !sistema.has(p.ruta) && p.robots !== 'noindex');
  const en = listadas.filter((p) => p.idioma === 'en');
  const es = listadas.filter((p) => p.idioma === 'es');
  const menu = (l) => l.filter((p) => /\/full-menu$/.test(p.ruta));
  return {
    'sitemap.xml': indice(['restaurants-menu-sitemap.xml', 'pages-sitemap.xml']),
    'es_es-sitemap.xml': indice(['es_es-restaurants-menu-sitemap.xml', 'es_es-pages-sitemap.xml']),
    'restaurants-menu-sitemap.xml': urlset(menu(en).map((p) => urlXml(p, enc(p.ruta) + '?menu=rosanta-menu'))),
    'es_es-restaurants-menu-sitemap.xml': urlset(menu(es).map((p) => urlXml(p, enc(p.ruta) + '?menu=rosanta-menu'))),
    'pages-sitemap.xml': urlset(en.map((p) => urlXml(p, enc(p.ruta)))),
    'es_es-pages-sitemap.xml': urlset(es.map((p) => urlXml(p, enc(p.ruta)))),
  };
}

// ---------- robots.txt ----------
/** El robots.txt de Wix TAL CUAL (todos los bots, incluidos los de IA, permitidos), quitando
 *  solo la nota "Auto generated… SEO Tools" del final y agregando una línea que lo explica. */
export function robotsTxt() {
  const wix = readFileSync(path.join(DATA, 'wix', 'robots.txt'), 'utf8');
  const sinNota = wix.replace(/\n*# Auto generated[^\n]*\n?$/, '').trimEnd();
  return sinNota.replace(
    /\nSitemap:/,
    '\n# Bots de busqueda con IA (GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot,\n# Google-Extended, Bingbot): permitidos por la regla general, igual que en Wix.\n\nSitemap:',
  ) + '\n';
}

// ---------- llms.txt ----------
const DIAS = { Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábado', Sunday: 'domingo' };
const ORDEN = Object.keys(DIAS);
/** "lunes y martes 17:00–21:00 · miércoles y jueves 12:00–21:00 · …" desde el schema. */
export function horariosTexto(rest) {
  const porDia = new Map();
  for (const h of rest.openingHoursSpecification) for (const d of [].concat(h.dayOfWeek)) porDia.set(d, `${h.opens}–${h.closes}`);
  const grupos = [];
  for (const d of ORDEN) {
    const v = porDia.get(d);
    if (!v) continue;
    const g = grupos[grupos.length - 1];
    if (g && g.v === v && ORDEN.indexOf(d) === ORDEN.indexOf(g.dias[g.dias.length - 1]) + 1) g.dias.push(d);
    else grupos.push({ v, dias: [d] });
  }
  return grupos
    .map((g) => {
      const n = g.dias.map((d) => DIAS[d]);
      const nombre = n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} y ${n[1]}` : `${n[0]} a ${n[n.length - 1]}`;
      return `${nombre} ${g.v}`;
    })
    .join(' · ');
}

/**
 * llms.txt: el de Wix copiado, con los datos del restaurante generados desde data/restaurante.json
 * y SIN la parte del MCP de Wix (/_api/mcp deja de existir al salir de Wix).
 */
export function llmsTxt() {
  const { restaurante: r } = datos();
  const wix = readFileSync(path.join(DATA, 'wix', 'llms.txt'), 'utf8');
  const corte = wix.indexOf('## Acceso de agentes de IA');
  let base = corte > 0 ? wix.slice(0, corte).trimEnd() : wix.trimEnd();
  const a = r.address;
  const tel = r.telephone.replace(/^\+502(\d{4})(\d{4})$/, '+502 $1 $2');
  base = base
    .replace(/^- Dirección: .*$/m, `- Dirección: ${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion}, Guatemala`)
    .replace(/^- Teléfono: .*$/m, `- Teléfono: ${tel}`)
    .replace(/^- Email: .*$/m, `- Email: ${r.email}`)
    .replace(/^- Horarios: .*$/m, `- Horarios: ${horariosTexto(r)}`);
  return `${base}

## Acceso de agentes de IA
Todo el sitio es HTML estático: el menú con precios, las preguntas frecuentes, los horarios y las páginas de eventos se leen completos sin JavaScript. Cada página lleva datos estructurados (schema.org: Restaurant, Menu, FAQPage).
- [Preguntas frecuentes en texto](${SITIO}/preguntas-frecuentes): las 18 preguntas, en español e inglés.
- [Menú completo en texto](${SITIO}/full-menu): platos, descripciones y precios en quetzales.
- [Mapa del sitio](${SITIO}/sitemap.xml) · [Mapa del sitio en español](${SITIO}/es_es-sitemap.xml)

## Qué puede hacer un asistente de IA con este sitio
- Obtener información del negocio: dirección, teléfono, email y horarios
- Consultar el menú y los precios en quetzales
- Conocer eventos y experiencias disponibles
- Responder preguntas frecuentes (parqueo, grupos, mascotas, pagos, alergias)
- Dirigir a la persona a la página de reservaciones para apartar mesa

## Notas
- El servicio es en el restaurante: la experiencia sucede en el jardín, la pérgola y la chimenea.
- Las reservaciones se completan en la página de reservaciones del sitio (${SITIO}/reservas).
- Solo está disponible la información pública accesible en el sitio.
`;
}

export async function generarTodo() {
  mkdirSync(DIST, { recursive: true });
  writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt());
  writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt());
  for (const [f, c] of Object.entries(sitemaps())) writeFileSync(path.join(DIST, f), c);
  const r = redirecciones();
  writeFileSync(path.join(DATA, 'redirecciones.json'), JSON.stringify(r, null, 2) + '\n');
  // firebase.json se arma con las 301 del mapa (una a una).
  const { firebaseJson } = await import('./firebase.mjs');
  writeFileSync(path.join(RAIZ, 'firebase.json'), JSON.stringify(firebaseJson(r), null, 2) + '\n');
  console.log(`postbuild: robots.txt, llms.txt, 6 sitemaps, ${r.length} redirecciones 301, firebase.json`);
}
