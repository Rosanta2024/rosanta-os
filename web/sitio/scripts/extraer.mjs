// 2. EXTRACTOR: de cada página publicada en Wix saca título, descripción, canonical,
// hreflang, H1, JSON-LD completo, el texto visible, las imágenes (con su alt) y la
// estructura de bloques (secciones, columnas, textos, botones, imágenes, componentes)
// para que la copia en Astro la reproduzca en el mismo orden.
// SOLO LECTURA (GET a páginas públicas; usa la caché .cache/ si existe).
//
// Uso: node scripts/extraer.mjs [--refrescar]
//   → data/paginas/<clave>.json, data/comun.json (menú, pie), data/imagenes.json, data/archivos.json
import path from 'node:path';
import { parse } from 'node-html-parser';
import { DATA, leerJSON, escribirJSON, pedirTexto, urlDe, claveRuta, normRuta } from './lib/comun.mjs';
import { metadatos, tiposComponentes, alturaCSS, posicionCSS, idMedio, enlaceLocal, limpiar, decodificar } from './lib/wix.mjs';

const REFRESCAR = process.argv.includes('--refrescar');

// ---------- tema de Wix (colores --color_N) ----------
function temaColores(html) {
  const m = new Map();
  for (const x of html.matchAll(/--color_(\d+):(\d+,\s*\d+,\s*\d+);/g)) if (!m.has(x[1])) m.set(x[1], x[2].replace(/\s/g, ''));
  return m;
}
function resolverColor(v, tema) {
  if (!v) return null;
  v = v.trim();
  if (v === 'transparent' || v === 'none') return null;
  const r = v.replace(/rgba?\(var\(--color_(\d+)\)(?:,\s*([\d.]+))?\)/g, (_, n, a) => {
    const c = tema.get(n);
    if (!c) return 'transparent';
    return a != null ? `rgba(${c},${a})` : `rgb(${c})`;
  });
  return /transparent/.test(r) ? null : r;
}
function fondoDe(html, id, tema) {
  // Wix declara el color de fondo de cada contenedor como --bg-overlay-color (sección/columna)
  // o como background-color (cajas).
  const re = new RegExp(`#${id}\\{[^}]*?--bg-overlay-color:([^;}]+)`, 'g');
  let ultimo = null;
  for (const x of html.matchAll(re)) ultimo = x[1];
  if (!ultimo) {
    const re2 = new RegExp(`#${id}\\{[^}]*?--bg:([^;}]+)`);
    const m2 = html.match(re2);
    if (m2) ultimo = m2[1];
  }
  return resolverColor(ultimo, tema);
}

// ---------- imágenes ----------
const IMAGENES = new Map(); // medio → { medio, alt:Set, paginas:Set, ancho, alto }
function registrarImagen(img, ruta) {
  const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
  const medio = idMedio(src);
  if (!medio) return null;
  const alt = decodificar(img.getAttribute('alt') || '');
  // tamaño de presentación que pidió Wix (w_NNN,h_NNN)
  const w = Number((src.match(/w_(\d+)/) || [])[1] || img.getAttribute('width') || 0);
  const h = Number((src.match(/h_(\d+)/) || [])[1] || img.getAttribute('height') || 0);
  const modo = (src.match(/\/v1\/(fill|fit|crop)\//) || [])[1] || 'fit';
  if (!IMAGENES.has(medio)) IMAGENES.set(medio, { medio, alts: new Set(), paginas: new Set(), anchoMax: 0 });
  const reg = IMAGENES.get(medio);
  if (alt) reg.alts.add(alt);
  reg.paginas.add(ruta);
  // Las de "blur_2" son el placeholder borroso: el tamaño real lo da el CSS. Se pide grande al bajar.
  reg.anchoMax = Math.max(reg.anchoMax, /blur_/.test(src) ? 1600 : w);
  return { medio, alt, w, h, modo };
}

// ---------- archivos (PDF) servidos por Wix en /_files/... ----------
const ARCHIVOS = new Map();
function registrarArchivo(href, ruta) {
  if (!href) return;
  try {
    const u = new URL(href, 'https://www.rosanta.rest');
    // Wix sirve el mismo PDF en /_files/… y en /es/_files/… (la página en español enlaza el segundo).
    const m = u.pathname.match(/^(\/es)?(\/_files\/.+)$/);
    if (/rosanta\.rest$/.test(u.hostname) && m) {
      if (!ARCHIVOS.has(m[2])) ARCHIVOS.set(m[2], { ruta: m[2], paginas: new Set(), alias: new Set() });
      ARCHIVOS.get(m[2]).paginas.add(ruta);
      if (m[1]) ARCHIVOS.get(m[2]).alias.add(u.pathname);
    }
  } catch { /* nada */ }
}

// ---------- HTML limpio ----------
const PERMITIDAS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i', 'u', 'br', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'img', 'figure', 'figcaption', 'hr', 'section', 'article']);
const ESTILOS_OK = /^(font-size|text-align|color|letter-spacing|line-height|font-weight|font-style|text-decoration|text-transform)$/;

function filtrarEstilo(st, tema) {
  if (!st) return '';
  return st
    .split(';')
    .map((x) => x.trim())
    .filter((x) => x && ESTILOS_OK.test(x.split(':')[0].trim()))
    .map((x) => {
      const [k, ...v] = x.split(':');
      const val = v.join(':').trim();
      if (k.trim() === 'color') return `color:${resolverColor(val, tema) || val}`;
      return `${k.trim()}:${val}`;
    })
    .join(';');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanear(nodo, ctx) {
  if (nodo.nodeType === 3) return esc(decodificar(nodo.rawText).replace(/\u200b/g, ''));
  if (nodo.nodeType !== 1) return '';
  const t = nodo.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'button', 'input', 'select', 'textarea', 'source'].includes(t)) return '';
  if (nodo.getAttribute('aria-hidden') === 'true' && !nodo.querySelector('img')) return '';
  const hijos = nodo.childNodes.map((c) => sanear(c, ctx)).join('');
  if (t === 'picture' || t === 'wow-image' || t === 'label') return hijos;
  if (!PERMITIDAS.has(t)) return hijos;
  if (t === 'img') {
    const im = registrarImagen(nodo, ctx.ruta);
    if (!im) return '';
    ctx.imagenes.push(im);
    return `<img data-medio="${esc(im.medio)}" alt="${esc(im.alt)}"${im.w ? ` width="${im.w}"` : ''}${im.h ? ` height="${im.h}"` : ''}>`;
  }
  if (t === 'br' || t === 'hr') return `<${t}>`;
  const attrs = [];
  if (t === 'a') {
    const href = nodo.getAttribute('href');
    registrarArchivo(href, ctx.ruta);
    if (href) attrs.push(`href="${esc(enlaceLocal(href))}"`);
    if (nodo.getAttribute('target') === '_blank') attrs.push('target="_blank" rel="noopener"');
  }
  const clases = (nodo.getAttribute('class') || '').split(/\s+/);
  const cls = clases.filter((c) => /^font_\d+$/.test(c));
  if (cls.length && ctx.rico) attrs.push(`class="${cls.join(' ')}"`);
  const hook = nodo.getAttribute('data-hook');
  if (hook && !ctx.rico && /^[a-zA-Z.\-]+$/.test(hook)) attrs.push(`data-hook="${hook}"`);
  let st = ctx.rico ? filtrarEstilo(nodo.getAttribute('style'), ctx.tema) : '';
  // Colores del tema de Wix como clase (color_44 = blanco, color_36 = verde…): se pasan a estilo.
  const cc = clases.find((c) => /^color_\d+$/.test(c));
  if (cc && ctx.rico && ctx.tema.get(cc.slice(6))) st = [st, `color:rgb(${ctx.tema.get(cc.slice(6))})`].filter(Boolean).join(';');
  const bc = clases.find((c) => /^backcolor_\d+$/.test(c));
  if (bc && ctx.rico && ctx.tema.get(bc.slice(10))) st = [st, `background-color:rgb(${ctx.tema.get(bc.slice(10))})`].filter(Boolean).join(';');
  if (st) attrs.push(`style="${esc(st)}"`);
  if (t === 'span' && !attrs.length) return hijos;
  if (t === 'div' && !attrs.length && !hijos.trim()) return '';
  if (t === 'p' && !hijos.replace(/<br>/g, '').trim()) return `<p class="vacio">${hijos}</p>`;
  return `<${t}${attrs.length ? ' ' + attrs.join(' ') : ''}>${hijos}</${t}>`;
}

// ---------- estructura de la página ----------
const CONTENEDORES = {
  ClassicSection: 'seccion', HeaderSection: 'seccion', FooterSection: 'seccion', Section: 'seccion',
  StripColumnsContainer: 'columnas', Column: 'columna',
  Container: 'caja', BoxContainer: 'caja', Group: 'grupo', HeaderContainer: 'caja', FooterContainer: 'caja',
};

function convertir(nodo, ctx) {
  if (nodo.nodeType === 3) return [];
  if (nodo.nodeType !== 1) return [];
  const t = nodo.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'template', 'link', 'meta'].includes(t)) return [];
  const id = nodo.getAttribute('id') || '';
  let tipo = ctx.tipos.get(id);
  if (!tipo && t === 'section' && id.startsWith('comp-')) tipo = 'ClassicSection';
  if (!tipo && /^TPA/.test(id)) tipo = 'TPAMultiSection';
  const hijos = () => nodo.childNodes.flatMap((c) => convertir(c, ctx));

  if (tipo && CONTENEDORES[tipo]) {
    const bg = nodo.getElementById?.(`bgMedia_${id}`) || nodo.querySelector(`#bgMedia_${id}`);
    let fondoImg = null;
    if (bg) {
      const img = bg.querySelector('img');
      if (img) { fondoImg = registrarImagen(img, ctx.ruta); if (fondoImg) ctx.imagenes.push(fondoImg); }
      bg.remove?.();
    }
    const h = hijos();
    if (!h.length && !fondoImg) return [];
    const alto = alturaCSS(ctx.html, id);
    return [{ t: CONTENEDORES[tipo], id, fondo: fondoDe(ctx.html, id, ctx.tema), fondoImg, alto, hijos: h }];
  }
  switch (tipo) {
    case 'WRichText':
      return [{ t: 'rico', id, html: sanear(nodo, { ...ctx, rico: true }) }];
    case 'StylableButton':
    case 'SiteButton':
    case 'Button': {
      const a = nodo.tagName === 'A' ? nodo : nodo.querySelector('a');
      const texto = limpiar(decodificar((nodo.querySelector('[data-testid="stylablebutton-label"]') || nodo).text));
      const href = a?.getAttribute('href') || null;
      registrarArchivo(href, ctx.ruta);
      return [{ t: 'boton', id, texto, href: href ? enlaceLocal(href) : null, ancla: a?.getAttribute('data-anchor') || null, nueva: a?.getAttribute('target') === '_blank' }];
    }
    case 'WPhoto':
    case 'ImageX':
    case 'Image': {
      const img = nodo.querySelector('img');
      const im = img ? registrarImagen(img, ctx.ruta) : null;
      if (!im) return [];
      ctx.imagenes.push(im);
      const a = nodo.querySelector('a');
      return [{ t: 'imagen', id, ...im, href: a ? enlaceLocal(a.getAttribute('href')) : null }];
    }
    case 'VectorImage': {
      const svg = nodo.querySelector('svg');
      const a = nodo.closest?.('a') || nodo.querySelector('a');
      if (!svg) return [];
      return [{ t: 'svg', id, svg: svg.toString().replace(/<script[\s\S]*?<\/script>/g, ''), href: a ? enlaceLocal(a.getAttribute('href')) : null, etiqueta: a?.getAttribute('aria-label') || null }];
    }
    case 'HtmlComponent':
      return [{ t: 'componente', id, alto: alturaCSS(ctx.html, id) }];
    case 'GoogleMap':
      return [{ t: 'mapa', id, alto: alturaCSS(ctx.html, id) }];
    case 'Anchor':
      // Wix deja el nombre del ancla como texto oculto ("Menu", "Gallery"): se conserva igual.
      return [{ t: 'ancla', id, etiqueta: limpiar(decodificar(nodo.querySelector('span')?.text || nodo.getAttribute('aria-label') || '')) || null }];
    case 'LanguageSelector':
      return [{ t: 'idioma', id }];
    case 'LinkBar': {
      const enlaces = nodo.querySelectorAll('a').map((a) => ({ href: a.getAttribute('href'), etiqueta: a.getAttribute('aria-label') || '' }));
      return [{ t: 'redes', id, enlaces }];
    }
    case 'DropDownMenu':
    case 'ExpandableMenu':
    case 'StylableHorizontalMenu': {
      const items = [];
      for (const li of nodo.querySelectorAll('li')) {
        const a = li.querySelector('a');
        const texto = limpiar(decodificar((li.querySelector('p') || li).text));
        if (!texto || items.some((x) => x.idli === li.getAttribute('id'))) continue;
        items.push({ idli: li.getAttribute('id'), texto, href: a ? enlaceLocal(a.getAttribute('href')) : null, ancla: a?.getAttribute('data-anchor') || null, sub: li.parentNode?.getAttribute?.('id')?.includes('moreContainer') || false });
      }
      return [{ t: 'menu', id, items }];
    }
    case 'tpaWidgetNative':
    case 'TPAWidget':
    case 'TPASection':
    case 'TPAMultiSection': {
      const gal = nodo.querySelectorAll('[data-hook="gallery-item-image-img"], [data-hook="gallery-item-container"] img');
      if (gal.length) {
        const imgs = [];
        const vistos = new Set();
        for (const img of gal) {
          const im = registrarImagen(img, ctx.ruta);
          if (im && !vistos.has(im.medio)) { vistos.add(im.medio); imgs.push(im); ctx.imagenes.push(im); }
        }
        return [{ t: 'galeria', id, imagenes: imgs, alto: alturaCSS(ctx.html, id) }];
      }
      const html = sanear(nodo, { ...ctx, rico: false });
      return limpiar(html.replace(/<[^>]+>/g, ' ')) || /<img/.test(html) ? [{ t: 'widget', id, html }] : [];
    }
    default:
      break;
  }
  // Elementos sueltos fuera de componentes conocidos
  if (t === 'img') {
    const im = registrarImagen(nodo, ctx.ruta);
    if (im) { ctx.imagenes.push(im); return [{ t: 'imagen', id, ...im }]; }
    return [];
  }
  return hijos();
}

function extraerNodo(doc, id, ctx) {
  const n = doc.getElementById(id);
  return n ? posiciones(convertir(n, ctx), ctx) : [];
}

// Agrega la posición de Wix (x, ancho, margen superior) a cada bloque con id, para que la copia
// lo ubique parecido en pantallas anchas. En el teléfono todo va a ancho completo.
function posiciones(bloques, ctx) {
  for (const b of bloques) {
    if (b.id && b.t !== 'seccion') {
      const p = posicionCSS(ctx.html, b.id);
      if (p) b.pos = p;
    }
    if (b.hijos) posiciones(b.hijos, ctx);
  }
  return bloques;
}

// Qué componente HTML del Editor es cada iframe (ver editor/README.md de rosanta-wix).
function nombrarComponentes(bloques, ruta) {
  const base = normRuta(ruta).replace(/^\/es(?=\/|$)/, '') || '/';
  const recorrer = (l) => l.forEach((b) => {
    if (b.t === 'componente') {
      if (base === '/') b.nombre = 'resenas-google';
      else if (base === '/reservas') b.nombre = (b.alto ?? 0) < 300 ? 'resenas-google' : 'formulario-reservas';
      else if (base === '/preguntas-frecuentes' || base === '/blank') b.nombre = 'faq';
      else if (base === '/política-de-privacidad') b.nombre = 'privacidad';
      else b.nombre = 'desconocido';
    }
    if (b.hijos) recorrer(b.hijos);
  });
  recorrer(bloques);
  return bloques;
}

// Los enlaces del menú llevan data-anchor ("anchors-lgv2q5as1", "dataItem-mszglxr3"). Wix los
// resuelve con datos que no vienen en el HTML; aquí se emparejan con la sección o el componente
// Anchor de la portada cuyo id comparte el prefijo más largo (comp-lgv2q4wf2, comp-mszglxqs).
function resolverAnclas(html, tipos) {
  const refs = [...new Set([...html.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1]))];
  const candidatos = [...tipos.entries()].filter(([, t]) => t === 'Anchor' || t === 'ClassicSection').map(([id, t]) => ({ id, t, suf: id.replace(/^comp-/, '') }));
  const out = {};
  for (const ref of refs) {
    const suf = ref.replace(/^(anchors|dataItem)-/, '');
    const preferido = ref.startsWith('dataItem-') ? 'Anchor' : 'ClassicSection';
    let mejor = null, largo = 0;
    for (const c of candidatos) {
      let n = 0;
      while (n < suf.length && suf[n] === c.suf[n]) n++;
      if (n > largo || (n === largo && c.t === preferido)) { mejor = c; largo = n; }
    }
    if (mejor && largo >= 4) out[ref] = mejor.id;
  }
  return out;
}

async function main() {
  const inv = await leerJSON(path.join(DATA, 'inventario.json'));
  const rutas = inv.paginas_publicadas;
  const indice = [];
  let comun = null;
  for (const ruta of rutas) {
    const html = await pedirTexto(urlDe(ruta), { refrescar: REFRESCAR });
    const md = metadatos(html);
    const doc = md.doc;
    const ctx = { ruta, html, tipos: tiposComponentes(html), tema: temaColores(html), imagenes: [] };
    const cuerpo = nombrarComponentes(extraerNodo(doc, 'PAGES_CONTAINER', ctx), ruta);
    const encabezado = extraerNodo(doc, 'SITE_HEADER', { ...ctx, imagenes: [] });
    const pie = extraerNodo(doc, 'SITE_FOOTER', { ...ctx, imagenes: [] });
    // og:image de Wix → se registra para bajarla y servirla desde la copia
    let ogImagen = null;
    if (md.og['og:image']) {
      const medio = idMedio(md.og['og:image']);
      if (medio) {
        if (!IMAGENES.has(medio)) IMAGENES.set(medio, { medio, alts: new Set(), paginas: new Set(), anchoMax: 1200 });
        IMAGENES.get(medio).paginas.add(ruta);
        IMAGENES.get(medio).og = true;
        ogImagen = medio;
      }
    }
    const idioma = ruta === '/es' || ruta.startsWith('/es/') ? 'es' : 'en';
    const pagina = {
      ruta,
      idioma,
      lang: md.lang,
      titulo: md.titulo,
      descripcion: md.descripcion,
      canonical: md.canonical,
      robots: md.robots,
      hreflang: md.hreflang,
      og: md.og,
      h1: md.h1,
      jsonld: md.jsonld,
      texto_visible: md.texto,
      fondo_pagina: fondoDe(html, 'SITE_BACKGROUND', ctx.tema) || null,
      og_imagen_medio: ogImagen,
      imagenes: [...new Map(ctx.imagenes.map((i) => [i.medio, { medio: i.medio, alt: i.alt }])).values()],
      bloques: cuerpo,
    };
    await escribirJSON(path.join(DATA, 'paginas', claveRuta(ruta) + '.json'), pagina);
    indice.push({ ruta, clave: claveRuta(ruta), titulo: md.titulo, idioma });
    if (ruta === '/' || ruta === '/es') {
      comun = comun || {};
      comun[idioma] = { encabezado, pie, tema: Object.fromEntries(ctx.tema), anclas: resolverAnclas(html, ctx.tipos), fondo_encabezado: fondoDe(html, 'SITE_HEADER', ctx.tema) };
    }
    console.log(ruta.padEnd(30), String(cuerpo.length).padStart(3), 'bloques', String(pagina.imagenes.length).padStart(3), 'imágenes |', md.titulo);
  }
  await escribirJSON(path.join(DATA, 'comun.json'), comun);
  await escribirJSON(path.join(DATA, 'paginas', '_indice.json'), indice);
  // Conserva lo que ya anotó scripts/imagenes.mjs (archivo local y medidas).
  let previas = new Map();
  try { previas = new Map((await leerJSON(path.join(DATA, 'imagenes.json'))).map((i) => [i.medio, i])); } catch { /* primera vez */ }
  await escribirJSON(
    path.join(DATA, 'imagenes.json'),
    [...IMAGENES.values()].map((i) => {
      const p = previas.get(i.medio) || {};
      return {
        medio: i.medio, alt: [...i.alts], paginas: [...i.paginas].sort(), anchoMax: i.anchoMax, ...(i.og ? { og: true } : {}),
        ...(p.archivo ? { archivo: p.archivo, ancho: p.ancho, alto: p.alto } : {}), ...(p.og_archivo ? { og_archivo: p.og_archivo } : {}),
      };
    }),
  );
  await escribirJSON(path.join(DATA, 'archivos.json'), [...ARCHIVOS.values()].map((a) => ({ ruta: a.ruta, paginas: [...a.paginas], alias: [...a.alias] })));
  console.log(`\n${indice.length} páginas, ${IMAGENES.size} imágenes únicas, ${ARCHIVOS.size} archivos (/_files).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
