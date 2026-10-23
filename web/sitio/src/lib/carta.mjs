// Carta con fotos (Juanma, 23-oct): miniatura junto a cada plato que tiene foto, foto de cabecera en algunas
// categorías y, dentro de cada categoría, primero los platos con foto. Trabaja sobre el HTML del menú capturado
// de Wix (data/paginas/*full-menu.json); las fotos y sus alt están en data/fotos-platos.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';

const RAIZ = process.env.ROSANTA_SITIO_RAIZ || process.cwd();
let _cfg;
const cfg = () => (_cfg ??= JSON.parse(readFileSync(path.join(RAIZ, 'data', 'fotos-platos.json'), 'utf8')));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

export function fotoDePlato(nombre, idioma) {
  const n = norm(nombre);
  for (const [k, p] of Object.entries(cfg().platos)) if (norm(p[idioma] || '') === n || norm(p.es) === n || norm(p.en) === n) return { clave: k, alt: p.alt[idioma] || p.alt.en };
  return null;
}

export function cartaConFotos(html, idioma) {
  const raiz = parse(html);
  const secciones = raiz.querySelectorAll('[data-hook="section.container"]');
  secciones.forEach((sec, i) => {
    const cab = cfg().secciones[String(i)];
    const desc = sec.querySelector('[data-hook="section.description"]') || sec.querySelector('[data-hook="section.name"]')?.parentNode;
    if (cab && desc) {
      desc.insertAdjacentHTML('afterend', `<figure class="carta-cabecera"><img src="/img/platos/seccion-${i}-640.webp" srcset="/img/platos/seccion-${i}-640.webp 640w, /img/platos/seccion-${i}-1200.webp 1200w" sizes="(max-width: 960px) 100vw, 920px" width="1200" height="525" alt="${esc(cab.alt[idioma] || cab.alt.en)}" loading="lazy" decoding="async"></figure>`);
    }
    const cont = sec.querySelector('[data-hook="items.container"]');
    if (!cont) return;
    const items = cont.querySelectorAll(':scope > [data-hook="item.root"]');
    const con = [], sin = [];
    for (const it of items) {
      const nombre = it.querySelector('[data-hook="item.name"]')?.text || '';
      const f = fotoDePlato(nombre, idioma);
      if (f) {
        it.setAttribute('class', 'con-foto');
        it.querySelector('[data-hook="item.container"]')?.insertAdjacentHTML('afterbegin',
          `<img class="plato-foto" src="/img/platos/${f.clave}-160.webp" srcset="/img/platos/${f.clave}-160.webp 160w, /img/platos/${f.clave}-320.webp 320w" sizes="(max-width: 640px) 88px, 112px" width="160" height="160" alt="${esc(f.alt)}" loading="lazy" decoding="async">`);
        con.push(it);
      } else sin.push(it);
    }
    // Primero los platos con foto (el resto en el mismo orden de siempre); los separadores <hr> de Wix se quitan
    // y la línea entre platos la pone el CSS.
    cont.childNodes.slice().forEach((n) => cont.removeChild(n));
    [...con, ...sin].forEach((n) => cont.appendChild(n));
  });
  return raiz.toString();
}

/** Para el informe: qué platos de la carta tienen foto y cuáles no. */
export function resumenFotos(html, idioma) {
  const raiz = parse(html); const con = [], sin = [];
  for (const sec of raiz.querySelectorAll('[data-hook="section.container"]')) {
    const s = sec.querySelector('[data-hook="section.name"]')?.text.trim();
    for (const n of sec.querySelectorAll('[data-hook="item.name"]')) (fotoDePlato(n.text, idioma) ? con : sin).push(`${s} › ${n.text.trim()}`);
  }
  return { con, sin };
}
