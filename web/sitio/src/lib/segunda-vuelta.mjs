// SEGUNDA VUELTA del sitio (gift cards, Rosanta Adventures, blog y lista de espera).
// TODO lo de este archivo queda apagado salvo que se construya con PUBLIC_SEGUNDA_VUELTA=si.
// Sin el interruptor, el sitio es la copia exacta de Wix que sale el 30-oct (mismo dist/).
//
// Variables (se pasan en la línea de comando al construir; no se leen de .env en el postbuild):
//   PUBLIC_SEGUNDA_VUELTA=si        enciende las páginas nuevas, la gift card nueva, el menú y los mapas
//   PUBLIC_CONTENIDO_JSON=<archivo> contenido (formato 1) que publica la nube; sin ella:
//                                   web/contenido/ejemplo-contenido.json + data/blog-ejemplo.json
//   PUBLIC_LISTA_ESPERA=si          "Avísame si se libera una mesa" en el formulario de reservas
//   PUBLIC_AVISO_ABOGADO_OK=si      quita la marca "PENDIENTE DE REVISIÓN DEL ABOGADO" del aviso legal
//   PUBLIC_ADVENTURES_URL           receptor de la consulta (por defecto /api/adventures/consulta)
// No depende de la red: el contenido se lee de archivos.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SITIO } from './sitio.mjs';

const RAIZ = process.env.ROSANTA_SITIO_RAIZ || process.cwd();
const metaEnv = (() => { try { return import.meta.env || {}; } catch { return {}; } })();
const v = (k) => process.env[k] ?? metaEnv[k];

export const SEGUNDA_VUELTA = v('PUBLIC_SEGUNDA_VUELTA') === 'si';
export const LISTA_ESPERA = v('PUBLIC_LISTA_ESPERA') === 'si';
export const AVISO_ABOGADO_OK = v('PUBLIC_AVISO_ABOGADO_OK') === 'si';
export const ADVENTURES_URL = v('PUBLIC_ADVENTURES_URL') || '/api/adventures/consulta';
export const CORREO = 'restaurante@rosanta.rest';
export const WHATSAPP_TEXTO = '+502 3082 6935';

// ------------------------------------------------------------------ contenido

let _contenido;
/** El contenido (formato 1). Falla el build si el archivo no existe o el formato no es el 1. */
export function contenido() {
  if (_contenido) return _contenido;
  const archivo = v('PUBLIC_CONTENIDO_JSON');
  let c;
  if (archivo) {
    const f = path.resolve(RAIZ, archivo);
    if (!existsSync(f)) throw new Error(`PUBLIC_CONTENIDO_JSON: no existe ${f}`);
    c = JSON.parse(readFileSync(f, 'utf8'));
  } else {
    c = JSON.parse(readFileSync(path.join(RAIZ, '..', 'contenido', 'ejemplo-contenido.json'), 'utf8'));
    const blog = path.join(RAIZ, 'data', 'blog-ejemplo.json');
    if (existsSync(blog) && !c.blog) c.blog = JSON.parse(readFileSync(blog, 'utf8')).blog;
  }
  if (c.formato !== 1) throw new Error(`contenido: formato ${c.formato} desconocido (el sitio lee el formato 1)`);
  _contenido = c;
  return c;
}

// ------------------------------------------------------------------ utilidades

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escHtml = esc;
const enlaceOk = (u) => /^(\/(?!\/)|https:\/\/|mailto:|tel:)/.test(u);

/** Markdown simple → HTML seguro: ## y ### títulos, párrafos, listas (- y 1.), **negrita**, *cursiva* y [enlaces](url). */
export function markdown(md) {
  const enLinea = (t) =>
    esc(t)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
        const u = url.replace(/&amp;/g, '&');
        if (!enlaceOk(u)) return txt;
        const ext = /^https:\/\//.test(u) && !u.startsWith(SITIO);
        return `<a href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  const out = [];
  for (const bloque of String(md || '').replace(/\r/g, '').split(/\n{2,}/)) {
    const lineas = bloque.split('\n').filter((l) => l.trim());
    const h = lineas[0]?.match(/^(#{2,3})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${enLinea(h[2])}</h${h[1].length}>`); lineas.shift(); }
    if (!lineas.length) continue;
    if (lineas.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push('<ul>' + lineas.map((l) => `<li>${enLinea(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>');
      continue;
    }
    if (lineas.every((l) => /^\s*\d+\.\s+/.test(l))) {
      out.push('<ol>' + lineas.map((l) => `<li>${enLinea(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('') + '</ol>');
      continue;
    }
    out.push(`<p>${enLinea(lineas.join(' '))}</p>`);
  }
  return out.join('\n');
}

/** Texto plano de un markdown (para descripciones y el llms.txt). */
export function textoPlano(md) {
  return String(md || '').replace(/^#+\s+/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
}

const url = (ruta) => SITIO + (ruta === '/' ? '' : encodeURI(ruta));
const corta = (t, n = 158) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const IMAGEN_SITIO = SITIO + '/og-image.jpg';
const ORG = { '@type': 'Organization', name: 'Rosanta', url: SITIO, logo: { '@type': 'ImageObject', url: SITIO + '/apple-touch-icon.png' } };

function hreflang(en, es) {
  return [
    { hreflang: 'en-us', href: url(en) },
    { hreflang: 'es-es', href: url(es) },
    { hreflang: 'x-default', href: url(en) },
  ];
}
function og(titulo, desc, ruta, imagen, tipo = 'website') {
  return {
    'og:title': titulo, 'og:description': desc, 'og:url': url(ruta), 'og:site_name': 'Rosanta', 'og:type': tipo,
    'og:image': imagen || IMAGEN_SITIO, 'twitter:card': 'summary_large_image', 'twitter:title': titulo, 'twitter:image': imagen || IMAGEN_SITIO,
  };
}
function migas(idioma, pasos) {
  const inicio = idioma === 'es' ? { n: 'Inicio', r: '/es' } : { n: 'Home', r: '/' };
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [inicio, ...pasos].map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.n, item: url(p.r) })),
  };
}
/** Una página nueva con la misma forma que las de data/paginas (la usan Base.astro, los sitemaps y las pruebas). */
function pagina({ ruta, otra, idioma, titulo, descripcion, h1, jsonld, imagen, tipoOg, tipo, datos }) {
  const [en, es] = idioma === 'es' ? [otra, ruta] : [ruta, otra];
  return {
    ruta, idioma, lang: idioma, titulo, descripcion, canonical: url(ruta), robots: null,
    hreflang: hreflang(en, es), og: og(titulo, descripcion, ruta, imagen, tipoOg), og_imagen_medio: null,
    h1: [h1], jsonld, tipo, datos, nueva: true,
  };
}

// ------------------------------------------------------------------ gift cards

const USD_DEFECTO = { 300: 45, 500: 55 }; // estudio 3.5: "el correo de mayo decía US$45 y US$55"

/** Montos de la gift card: los que cargó el dueño en el contenido, o los del estudio (Q300 y Q500, libre desde Q200, 12 meses). */
export function giftcards() {
  const g = (SEGUNDA_VUELTA && contenido().giftcards) || {};
  const tc = (SEGUNDA_VUELTA && contenido().ajustes?.tipo_cambio_usd) || null;
  const fijos = { ...USD_DEFECTO, ...(g.usd_fijos || {}) };
  const montos = (g.montos_q && g.montos_q.length ? g.montos_q : [300, 500]).map((q) => ({ q, usd: fijos[q] ?? (tc ? Math.round(q / tc) : null) }));
  return { montos, minimo_q: g.minimo_q ?? 200, maximo_q: g.maximo_q ?? null, vigencia_meses: g.vigencia_meses ?? 12, tipo_cambio: tc };
}

export function mensajeGift(idioma, q, usd) {
  const monto = `Q${q}` + (usd ? ` (US$${usd})` : '');
  return idioma === 'es'
    ? `Hola, quiero una gift card de Rosanta por ${monto}. ¿Cómo la pago?`
    : `Hi, I would like a Rosanta gift card for ${monto}. How can I pay for it?`;
}

/** La página /gift-card con la segunda vuelta: título, descripción y schema Product/Offer nuevos (mismo canonical y hreflang). */
export function paginaGiftcard(p, imagenUrl) {
  const es = p.idioma === 'es';
  const g = giftcards();
  const titulo = es ? 'Tarjeta de regalo | Rosanta, Antigua Guatemala' : 'Gift Card | Rosanta, Antigua Guatemala';
  const lista = g.montos.map((m) => `Q${m.q}` + (m.usd ? ` (US$${m.usd})` : '')).join(es ? ' o ' : ' or ');
  const descripcion = es
    ? `Regala una mesa en el jardín: tarjeta de regalo de Rosanta por ${lista}, o el monto que quieras desde Q${g.minimo_q}. Vence a los ${g.vigencia_meses} meses.`
    : `Give a table in the garden: a Rosanta gift card for ${lista}, or any amount from Q${g.minimo_q}. Valid for ${g.vigencia_meses} months from issue.`;
  const nombre = es ? 'Tarjeta de regalo de Rosanta' : 'Rosanta Gift Card';
  const oferta = (q) => ({
    '@type': 'Offer', price: q.toFixed(2), priceCurrency: 'GTQ', availability: 'https://schema.org/InStock', url: p.canonical,
    seller: { '@type': 'Organization', name: 'Rosanta' },
  });
  const producto = {
    '@context': 'https://schema.org', '@type': 'Product', name: nombre, description: descripcion, url: p.canonical,
    brand: { '@type': 'Brand', name: 'Rosanta' }, category: es ? 'Tarjeta de regalo' : 'Gift card',
    ...(imagenUrl ? { image: imagenUrl } : {}),
    offers: {
      '@type': 'AggregateOffer', priceCurrency: 'GTQ', lowPrice: g.minimo_q.toFixed(2),
      ...(g.maximo_q ? { highPrice: Number(g.maximo_q).toFixed(2) } : {}),
      offerCount: g.montos.length + 1, availability: 'https://schema.org/InStock', url: p.canonical,
      offers: g.montos.map((m) => oferta(m.q)),
    },
  };
  const jsonld = [...p.jsonld.filter((j) => j['@type'] !== 'Product'), producto];
  const ogN = { ...p.og, 'og:title': titulo, 'og:description': descripcion };
  if (ogN['twitter:title']) ogN['twitter:title'] = titulo;
  return { ...p, titulo, descripcion, jsonld, og: ogN, h1: [es ? 'Tarjeta de regalo' : 'Gift card'] };
}

// ------------------------------------------------------------------ Rosanta Adventures

export function experiencias() {
  if (!SEGUNDA_VUELTA) return [];
  return [...(contenido().adventures?.experiencias || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/** El schema que trae la nube usa https://rosanta.rest; el canonical del sitio es https://www.rosanta.rest. */
function aWww(o) {
  if (typeof o === 'string') return o.replace(/^https:\/\/rosanta\.rest(?=\/|$)/, SITIO);
  if (Array.isArray(o)) return o.map(aWww);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, aWww(x)]));
  return o;
}

/** schema.org TouristTrip (+ Offer y FAQPage). Si la nube lo manda, va ese (con www); si no, se arma igual que adventures.js. */
export function schemaExperiencia(x, L) {
  if (x.schema && Array.isArray(x.schema[L]) && x.schema[L].length) return aWww(x.schema[L]);
  const u = url((L === 'es' ? '/es' : '') + '/adventures/' + x.slug);
  const trip = {
    '@context': 'https://schema.org', '@type': 'TouristTrip', '@id': u + '#trip', url: u, name: x.titulo[L], description: x.descripcion[L],
    inLanguage: L, provider: { '@type': 'Organization', name: x.operador.nombre }, disambiguatingDescription: x.aviso_legal?.[L],
  };
  if (x.foto) trip.image = [x.foto.url, ...(x.galeria || []).map((f) => f.url)];
  if (x.precio_ref_q != null) trip.offers = { '@type': 'Offer', price: Number(x.precio_ref_q).toFixed(2), priceCurrency: 'GTQ', url: u,
    description: L === 'es' ? 'Precio de referencia por persona; lo confirma el operador.' : 'Reference price per person; confirmed by the operator.',
    offeredBy: { '@type': 'Organization', name: x.operador.nombre } };
  const out = [trip];
  if (x.faq?.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map((q) => ({ '@type': 'Question', name: q.pregunta[L], acceptedAnswer: { '@type': 'Answer', text: q.respuesta[L] } })) });
  return out;
}

/** Descripción de la ficha: la del contenido, más duración, dificultad y operador (para que nunca quede corta). */
function descExperiencia(x, L) {
  const es = L === 'es';
  const extra = [x.duracion?.[L], x.dificultad_texto?.[L]].filter(Boolean).join(' · ');
  const partes = [String(x.descripcion?.[L] || '').trim().replace(/([^.!?])$/, '$1.'), extra && extra + '.',
    (es ? 'Opera ' : 'Run by ') + x.operador.nombre.replace(/([^.])$/, '$1.'), es ? 'Consulta sin costo con Rosanta, en Antigua Guatemala.' : 'Ask Rosanta with no commitment, in Antigua Guatemala.'];
  return corta(partes.filter(Boolean).join(' '));
}

function paginasAdventures() {
  const xs = experiencias();
  if (!xs.length) return [];
  const out = [];
  for (const L of ['en', 'es']) {
    const base = L === 'es' ? '/es/adventures' : '/adventures';
    const otraBase = L === 'es' ? '/adventures' : '/es/adventures';
    const titulo = L === 'es' ? 'Rosanta Adventures: qué hacer cerca de Antigua Guatemala | Rosanta' : 'Rosanta Adventures: things to do near Antigua Guatemala | Rosanta';
    const descripcion = L === 'es'
      ? 'Volcanes, fincas de café y viajes por Guatemala con operadores aliados con licencia de INGUAT. Consulta sin costo y cierra el día con una cena en Rosanta.'
      : 'Volcano hikes, coffee farms and trips around Guatemala with partner operators licensed by INGUAT. Ask with no commitment and end the day with dinner at Rosanta.';
    out.push(pagina({
      ruta: base, otra: otraBase, idioma: L, titulo, descripcion, h1: 'Rosanta Adventures', tipo: 'adventures', datos: { experiencias: xs },
      jsonld: [
        { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Rosanta Adventures',
          itemListElement: xs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: url(base + '/' + x.slug), name: x.titulo[L] })) },
        migas(L, [{ n: 'Rosanta Adventures', r: base }]),
      ],
    }));
    for (const x of xs) {
      const ruta = base + '/' + x.slug;
      const t = `${x.titulo[L]} | Rosanta Adventures`;
      out.push(pagina({
        ruta, otra: otraBase + '/' + x.slug, idioma: L, titulo: t, descripcion: descExperiencia(x, L), h1: x.titulo[L],
        imagen: x.foto?.url, tipo: 'experiencia', datos: { x },
        jsonld: [...schemaExperiencia(x, L), migas(L, [{ n: 'Rosanta Adventures', r: base }, { n: x.titulo[L], r: ruta }])],
      }));
    }
  }
  return out;
}

// ------------------------------------------------------------------ blog

export function entradas() {
  if (!SEGUNDA_VUELTA) return [];
  return [...(contenido().blog || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (a.orden ?? 0) - (b.orden ?? 0));
}

function paginasBlog() {
  const xs = entradas();
  if (!xs.length) return [];
  const out = [];
  for (const L of ['en', 'es']) {
    const base = L === 'es' ? '/es/blog' : '/blog';
    const otraBase = L === 'es' ? '/blog' : '/es/blog';
    const titulo = L === 'es' ? 'Blog de Rosanta: cocina de temporada y gastrococtelería en Antigua Guatemala' : 'Rosanta Journal: seasonal cooking and cocktails in Antigua Guatemala';
    const descripcion = L === 'es'
      ? 'Historias del jardín, la cocina y la barra de Rosanta, restaurante de gastrococtelería en Antigua Guatemala.'
      : 'Stories from the garden, the kitchen and the bar at Rosanta, a garden restaurant in Antigua Guatemala.';
    out.push(pagina({
      ruta: base, otra: otraBase, idioma: L, titulo, descripcion, h1: L === 'es' ? 'Blog' : 'Journal', tipo: 'blog', datos: { entradas: xs },
      jsonld: [
        { '@context': 'https://schema.org', '@type': 'Blog', name: L === 'es' ? 'Blog de Rosanta' : 'Rosanta Journal', url: url(base), inLanguage: L, publisher: ORG,
          blogPost: xs.map((e) => ({ '@type': 'BlogPosting', headline: e.titulo[L], url: url(base + '/' + e.slug), datePublished: e.fecha })) },
        migas(L, [{ n: 'Blog', r: base }]),
      ],
    }));
    for (const e of xs) {
      const ruta = base + '/' + e.slug;
      const desc = corta(e.resumen?.[L] || textoPlano(e.cuerpo?.[L]));
      const img = e.foto?.url || IMAGEN_SITIO;
      out.push(pagina({
        ruta, otra: otraBase + '/' + e.slug, idioma: L, titulo: `${e.titulo[L]} | Rosanta`, descripcion: desc, h1: e.titulo[L],
        imagen: e.foto?.url, tipoOg: 'article', tipo: 'entrada', datos: { e },
        jsonld: [
          { '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': url(ruta) + '#post', headline: e.titulo[L], description: desc,
            datePublished: e.fecha, dateModified: e.actualizada || e.fecha, inLanguage: L, url: url(ruta), mainEntityOfPage: url(ruta),
            image: img, author: ORG, publisher: ORG, about: { '@type': 'Restaurant', name: 'Rosanta', url: SITIO } },
          migas(L, [{ n: 'Blog', r: base }, { n: e.titulo[L], r: ruta }]),
        ],
      }));
    }
  }
  return out;
}

// ------------------------------------------------------------------ todo junto

/** Las páginas NUEVAS (sin el interruptor: ninguna). */
export function paginasNuevas() {
  if (!SEGUNDA_VUELTA) return [];
  return [...paginasAdventures(), ...paginasBlog()];
}

/** Entradas que se suman al menú del encabezado (solo con el interruptor y si hay qué mostrar). */
export function enlacesMenu(idioma) {
  if (!SEGUNDA_VUELTA) return [];
  const es = idioma === 'es';
  const out = [];
  if (experiencias().length) out.push({ texto: 'ADVENTURES', href: es ? '/es/adventures' : '/adventures', externo: false, sub: [] });
  if (entradas().length) out.push({ texto: 'BLOG', href: es ? '/es/blog' : '/blog', externo: false, sub: [] });
  return out;
}

/** Fecha legible: 23 de octubre de 2026 / October 23, 2026. */
export function fechaLarga(iso, idioma) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  return new Intl.DateTimeFormat(idioma === 'es' ? 'es-GT' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
