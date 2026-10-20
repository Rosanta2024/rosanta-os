// Datos del sitio (capturados de Wix por scripts/extraer.mjs) y reglas de la copia.
// Lo usan las páginas de Astro, el postbuild (sitemaps, llms.txt, 301) y las pruebas.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.ROSANTA_SITIO_RAIZ || process.cwd();
const DATA = path.join(RAIZ, 'data');
const leer = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));

export const SITIO = 'https://www.rosanta.rest';

let _cache;
export function datos() {
  if (_cache) return _cache;
  const paginas = readdirSync(path.join(DATA, 'paginas'))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => leer(path.join('paginas', f)));
  const imagenes = new Map(leer('imagenes.json').map((i) => [i.medio, i]));
  _cache = {
    paginas,
    comun: leer('comun.json'),
    imagenes,
    restaurante: leer('restaurante.json').jsonld,
    mejoras: leer('mejoras-seo.json'),
    inventario: leer('inventario.json'),
    faq: existsSync(path.join(DATA, 'componentes', 'faq.json')) ? leer('componentes/faq.json') : null,
    privacidad: existsSync(path.join(DATA, 'componentes', 'privacidad.json')) ? leer('componentes/privacidad.json') : null,
  };
  return _cache;
}

/** Páginas que la copia sirve con 200 (las publicadas en Wix menos las que pasan a 301). */
export function paginasDelSitio() {
  const { paginas, mejoras } = datos();
  const redir = mejoras.redirigir || {};
  return paginas.filter((p) => !redir[p.ruta]).sort((a, b) => a.ruta.localeCompare(b.ruta));
}

export function imagenLocal(medio) {
  const i = datos().imagenes.get(medio);
  return i?.archivo ? i : null;
}

export function descripcion(p) {
  return p.descripcion ?? datos().mejoras.descripciones?.[p.ruta] ?? null;
}

export function robots(p) {
  const malos = datos().mejoras.robots_invalidos?.valores || [];
  return p.robots && !malos.includes(p.robots) ? p.robots : null;
}

/**
 * Schema de la página: el mismo JSON-LD que publica Wix, con estas reglas:
 * - UN solo Restaurant (el completo, data/restaurante.json) en lugar de los 1 o 2 de Wix.
 * - UN solo WebSite (Wix pone dos en la portada en inglés), sin el SearchAction a /search,
 *   que en la copia no existe.
 * - El resto (Menu, MenuSection, FAQPage, BreadcrumbList, Product) se copia tal cual.
 */
export function schema(p) {
  const { restaurante } = datos();
  const out = [];
  let hayRest = false;
  let website = null;
  for (const j of p.jsonld) {
    const t = j['@type'];
    if (t === 'Restaurant') {
      if (!hayRest) { out.push(restaurante); hayRest = true; }
      continue;
    }
    if (t === 'WebSite') {
      if (!website) {
        website = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Rosanta', url: SITIO + (p.idioma === 'es' ? '/es' : '/') };
        out.push(website);
      }
      continue;
    }
    out.push(j);
  }
  if (!hayRest) out.unshift(restaurante);
  return out;
}

/** Ruta de la otra versión de idioma (para el selector EN | ES). */
export function rutaOtroIdioma(p) {
  const destino = p.idioma === 'es' ? 'en-us' : 'es-es';
  const h = p.hreflang.find((x) => x.hreflang === destino);
  if (h) {
    const u = new URL(h.href);
    return (decodeURI(u.pathname).normalize('NFC').replace(/\/$/, '') || '/');
  }
  if (p.idioma === 'es') return p.ruta === '/es' ? '/' : p.ruta.slice(3);
  return p.ruta === '/' ? '/es' : '/es' + p.ruta;
}

/** Enlace de una entrada del menú (resuelve las anclas de la portada). */
export function hrefMenu(item, idioma) {
  const anclas = datos().comun[idioma]?.anclas || {};
  if (item.ancla && anclas[item.ancla]) {
    const base = idioma === 'es' ? '/es' : '/';
    return `${base}#${anclas[item.ancla]}`;
  }
  return item.href;
}

/** Ajusta los tamaños de letra grandes de Wix (pensados para 980 px) a pantallas chicas. */
export function htmlResponsivo(html) {
  return html.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (m, n) => {
    const px = Number(n);
    if (px <= 22) return m;
    const min = Math.max(20, Math.round(px * 0.42));
    return `font-size:clamp(${min}px, ${(px / 9.8).toFixed(2)}vw, ${px}px)`;
  });
}

/** Cambia el primer título (h2-h6) por h1 cuando la página no tiene H1 (mejoras-seo.json). */
export function promoverH1(html) {
  return html.replace(/<h([2-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/, '<h1$2>$3</h1>');
}

export function rutaArchivo(ruta) {
  // dist/ con build.format 'file': "/" → index.html, "/reservas" → reservas.html
  return ruta === '/' ? 'index.html' : ruta.slice(1) + '.html';
}
