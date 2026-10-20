// Lectura del HTML publicado por Wix (Thunderbolt, dibujado en el servidor).
// Se usa en el extractor (para construir la copia) y en el comprobador de paridad
// (para comparar Wix contra la copia con la MISMA vara).
import { parse } from 'node-html-parser';
import he from 'he';
import { ORIGEN, normRuta } from './comun.mjs';

const NO_VISIBLES = new Set(['script', 'style', 'noscript', 'svg', 'template', 'head', 'iframe', 'button']);

export function limpiar(s) {
  return (s || '').replace(/​|­/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function textoDe(nodo, out) {
  if (nodo.nodeType === 3) { out.push(nodo.rawText); return; }
  if (nodo.nodeType !== 1) return;
  const t = nodo.tagName?.toLowerCase();
  if (NO_VISIBLES.has(t)) return;
  if (nodo.getAttribute('aria-hidden') === 'true' && t !== 'div') return;
  if (nodo.getAttribute('hidden') != null) return;
  // Mejoras de la copia que en Wix viven en un iframe (formulario, FAQ): se comparan aparte.
  const par = nodo.getAttribute('data-paridad');
  if (par === 'mejora' || par === 'ignorar') return;
  const bloque = /^(p|div|h[1-6]|li|section|header|footer|main|nav|br|tr|td|th|ul|ol|article|figure|figcaption|summary|details|dt|dd)$/.test(t);
  if (bloque) out.push(' ');
  for (const c of nodo.childNodes) textoDe(c, out);
  if (bloque) out.push(' ');
}

/** Texto visible SIN JavaScript (lo que lee un bot de IA o curl). */
export function textoVisible(raiz) {
  const out = [];
  textoDe(raiz, out);
  return limpiar(decodificar(out.join('')));
}

export function decodificar(s) {
  return he.decode(s || '');
}

/** Metadatos SEO comunes a Wix y a la copia. */
export function metadatos(html) {
  const d = parse(html, { comment: false });
  const attr = (sel, a) => d.querySelector(sel)?.getAttribute(a) ?? null;
  const meta = (n) => attr(`meta[name="${n}"]`, 'content') ?? attr(`meta[property="${n}"]`, 'content');
  const jsonld = [];
  for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
    try { jsonld.push(JSON.parse(s.text)); } catch { jsonld.push({ _error: 'JSON inválido', _texto: s.text.slice(0, 200) }); }
  }
  const raizVisible = d.getElementById('SITE_CONTAINER') || d.querySelector('body') || d;
  const h1 = raizVisible.querySelectorAll('h1').map((h) => limpiar(decodificar(h.text))).filter(Boolean);
  const hreflang = d
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .map((l) => ({ hreflang: l.getAttribute('hreflang'), href: l.getAttribute('href') }))
    .sort((a, b) => (a.hreflang + a.href).localeCompare(b.hreflang + b.href));
  return {
    lang: d.querySelector('html')?.getAttribute('lang') ?? null,
    titulo: limpiar(decodificar(d.querySelector('title')?.text ?? '')),
    descripcion: meta('description') != null ? limpiar(decodificar(meta('description'))) : null,
    canonical: attr('link[rel="canonical"]', 'href'),
    robots: meta('robots'),
    hreflang,
    og: Object.fromEntries(
      d.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').map((m) => [
        m.getAttribute('property') || m.getAttribute('name'),
        decodificar(m.getAttribute('content') || ''),
      ]),
    ),
    h1,
    jsonld,
    texto: textoVisible(raizVisible),
    doc: d,
  };
}

/** Lista plana de tipos de schema (incluye @graph y anidados de primer nivel). */
export function tiposSchema(jsonld) {
  const tipos = [];
  const ver = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(ver);
    if (o['@type']) tipos.push(...[].concat(o['@type']));
    if (o['@graph']) ver(o['@graph']);
  };
  ver(jsonld);
  return tipos.sort();
}

/** Mapa compId → tipo de componente que Wix deja en el HTML ("comp-x":"HtmlComponent"). */
export function tiposComponentes(html) {
  const m = new Map();
  for (const x of html.matchAll(/"((?:comp-|TPA)[A-Za-z0-9_-]+)":"([A-Za-z_]+)"/g)) if (!m.has(x[1])) m.set(x[1], x[2]);
  return m;
}

/** Altura declarada en el CSS de Wix para un componente (#comp-x{...height:NNNpx}). */
export function alturaCSS(html, id) {
  const m = html.match(new RegExp(`#${id}\\{[^}]*?height:(\\d+)px`));
  return m ? Number(m[1]) : null;
}

/** Id de medio de Wix ("b75909_abc~mv2.jpg") a partir de cualquier URL de static.wixstatic.com. */
export function idMedio(src) {
  const m = (src || '').match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Convierte un enlace de Wix en ruta propia cuando es del mismo sitio. */
export function enlaceLocal(href) {
  if (!href) return href;
  try {
    const u = new URL(href, ORIGEN);
    if (u.hostname === 'www.rosanta.rest' || u.hostname === 'rosanta.rest') {
      return normRuta(u.pathname) + u.search + u.hash;
    }
  } catch { /* no es URL */ }
  return href;
}

/**
 * Posición de un componente dentro de su sección, según el CSS de Wix (grid de 980 px):
 *   [id="comp-x"]{margin:104px 0px 0 calc((100% - 980px) * 0.5);left:-55px;...}  #comp-x{width:651px}
 * Devuelve { x, w, top, centro } en px de la grilla de 980 (x = distancia al borde izquierdo).
 */
export function posicionCSS(html, id) {
  const reglas = [...html.matchAll(new RegExp(`\\[id="${id}"\\]\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
  const regla = reglas.find((r) => /margin:/.test(r));
  const anchos = [...html.matchAll(new RegExp(`#${id}\\{[^}]*?width:([\\d.]+)px`, 'g'))].map((m) => Number(m[1]));
  if (!regla && !anchos.length) return null;
  const out = {};
  if (anchos.length) out.w = anchos[anchos.length - 1];
  if (regla) {
    const mg = regla.match(/margin:([^;]+);/);
    const left = regla.match(/(?:^|;)left:(-?[\d.]+)px/);
    if (mg) {
      const partes = mg[1].trim().split(/\s+(?![^(]*\))/);
      const top = parseFloat(partes[0]);
      if (!Number.isNaN(top)) out.top = top;
      const abajo = parseFloat(partes[2]);
      if (!Number.isNaN(abajo) && abajo > 0) out.abajo = abajo;
      // margen izquierdo: "calc((100% - 440px) * 0.5)" = centrado en una caja de 440 px; o "Npx"
      const ml = partes[3] ?? partes[1] ?? '0';
      const c = ml.match(/calc\(\(100% - ([\d.]+)px\) \* 0\.5\)/);
      if (c) out.base = Number(c[1]);
      else out.ml = parseFloat(ml) || 0;
    }
    if (left) out.x = Number(left[1]);
    if (/justify-self:stretch/.test(regla)) out.estirar = true;
    const area = regla.match(/grid-area:([^;]+);/);
    if (area) out.area = area[1].trim();
    if (/justify-self:center/.test(regla)) out.centro = true;
  }
  return out;
}
