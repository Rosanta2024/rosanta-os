// Entrega lo capturado de Wix en el "formato 1" del AYUDANTE 4
// (rama claude/web-contenido-giftcards, web/contenido/FORMATO.md), para que el editor de
// contenido lo cargue con sembrar(). El sitio NO depende de esto para construirse el 17-nov:
// se construye con data/paginas/*.json. Leer GET /api/web/contenido queda para después.
//
// Uso: node scripts/exportar-contenido.mjs → data/contenido-capturado.json
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'node-html-parser';
import { DATA, leerJSON, escribirJSON } from './lib/comun.mjs';
import { limpiar, decodificar } from './lib/wix.mjs';

const SITIO = 'https://www.rosanta.rest';
const CLAVES = {
  inicio: '/', reservas: '/reservas', menu: '/full-menu', eventos: '/events', 'eventos-privados': '/events-1',
  'gift-ideas': '/gift-ideas', 'gift-cards': '/gift-card', faq: '/preguntas-frecuentes', privacidad: '/política-de-privacidad',
  terminos: '/términos-y-condiciones', encuesta: '/encuesta',
};
const clave = (ruta) => (ruta === '/' ? 'inicio' : ruta.slice(1).replace(/\//g, '__'));
const texto = (html) => limpiar(decodificar(html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|h\d|li)>/g, '\n').replace(/<[^>]+>/g, ' ')).replace(/ *\n */g, '\n')).trim();
const textoPlano = (html) => decodificar(html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|h\d|li|div)>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

const imagenes = new Map((await leerJSON(path.join(DATA, 'imagenes.json'))).map((i) => [i.medio, i]));
let idFoto = 0;
function foto(medio, altEn, altEs) {
  const i = imagenes.get(medio);
  if (!i?.archivo) return null;
  return { id: ++idFoto, url: SITIO + i.archivo, url_chica: SITIO + i.archivo, ancho: i.ancho, alto: i.alto, alt: { es: altEs ?? altEn ?? '', en: altEn ?? '' } };
}

function aplanar(bloques, out = []) {
  for (const b of bloques) {
    if (['rico', 'boton', 'imagen'].includes(b.t)) out.push(b);
    if (b.t === 'galeria') b.imagenes.forEach((im, n) => out.push({ t: 'imagen', id: `${b.id}.foto${n + 1}`, ...im }));
    if (b.hijos) aplanar(b.hijos, out);
  }
  return out;
}

let idBloque = 0;
const paginas = {};
let orden = 0;
for (const [k, rutaEn] of Object.entries(CLAVES)) {
  const en = await leerJSON(path.join(DATA, 'paginas', clave(rutaEn) + '.json'));
  const rutaEs = rutaEn === '/' ? '/es' : '/es' + rutaEn;
  const es = await leerJSON(path.join(DATA, 'paginas', clave(rutaEs) + '.json'));
  const bEs = new Map(aplanar(es.bloques).map((b) => [b.id, b]));
  const bloques = {};
  let o = 0;
  for (const b of aplanar(en.bloques)) {
    const e = bEs.get(b.id) || b;
    const llave = `${b.id}`; // clave de bloque = id del componente de Wix (estable entre idiomas)
    if (b.t === 'rico') {
      const esTitulo = /^<div><h\d/.test(b.html);
      bloques[llave] = { id: ++idBloque, tipo: esTitulo ? 'texto' : 'parrafo', orden: o++, es: textoPlano(e.html), en: textoPlano(b.html) };
    } else if (b.t === 'boton') {
      bloques[llave] = { id: ++idBloque, tipo: 'enlace', orden: o++, es: e.texto, en: b.texto, enlace: b.href || (rutaEn === '/' ? '/' : rutaEn) };
    } else if (b.t === 'imagen') {
      const f = foto(b.medio, b.alt, e.alt);
      if (f) bloques[llave] = { id: ++idBloque, tipo: 'foto', orden: o++, es: '', en: '', foto: f };
    }
  }
  paginas[k] = {
    orden: orden++,
    ruta: { en: rutaEn, es: rutaEs },
    seo: {
      titulo: { es: es.titulo, en: en.titulo },
      descripcion: { es: es.descripcion || '', en: en.descripcion || '' },
      foto: en.og_imagen_medio ? foto(en.og_imagen_medio, '', '') : null,
    },
    bloques,
  };
}

// Menú: secciones y platos del widget de Wix, en inglés y en español (mismo orden).
function menuDe(ruta) {
  const p = (async () => (await leerJSON(path.join(DATA, 'paginas', clave(ruta) + '.json'))))();
  return p.then((pg) => {
    const w = JSON.stringify(pg.bloques).match(/"t":"widget","id":"[^"]+","html":"((?:[^"\\]|\\.)*)"/);
    const d = parse(JSON.parse('"' + w[1] + '"'));
    return d.querySelectorAll('[data-hook="section.container"]').map((s) => ({
      nombre: limpiar(s.querySelector('[data-hook="section.name"]')?.text || ''),
      nota: limpiar(s.querySelector('[data-hook="section.description"]')?.text || ''),
      platos: s.querySelectorAll('[data-hook="item.root"]').map((it) => {
        const precios = it.querySelectorAll('[data-hook="item.price"], [data-hook="variant.price"]').map((x) => Number((x.text.match(/[\d.]+/) || [])[0]));
        const variantes = it.querySelectorAll('[data-hook="item.variant"]').map((v) => v.querySelectorAll('p').map((x) => limpiar(x.text)).join(' '));
        return {
          nombre: limpiar(it.querySelector('[data-hook="item.name"]')?.text || ''),
          descripcion: limpiar(it.querySelector('[data-hook="item.description"]')?.text || '') + (variantes.length > 1 ? `\n${variantes.join(' · ')}` : ''),
          precio_q: precios.length ? precios[0] : null,
          etiquetas_wix: it.querySelectorAll('[data-hook="item.label"]').map((x) => limpiar(x.text)),
        };
      }),
    }));
  });
}
const mEn = await menuDe('/full-menu');
const mEs = await menuDe('/es/full-menu');
const menu = mEn.map((s, i) => ({
  id: i + 1,
  clave: s.nombre.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
  orden: i,
  nombre: { es: mEs[i]?.nombre || s.nombre, en: s.nombre },
  nota: { es: mEs[i]?.nota || '', en: s.nota },
  platos: s.platos.map((pl, j) => ({
    id: i * 100 + j + 1,
    orden: j,
    nombre: { es: mEs[i]?.platos[j]?.nombre || pl.nombre, en: pl.nombre },
    descripcion: { es: mEs[i]?.platos[j]?.descripcion || '', en: pl.descripcion },
    precio_q: pl.precio_q,
    precio_usd_ref: null,
    alergenos: [],
    etiquetas: [],
    foto: null,
  })),
}));

const faqData = await leerJSON(path.join(DATA, 'componentes', 'faq.json'));
const faq = faqData.faqs.map((f, i) => ({
  id: i + 1, orden: i, categoria: f.cat,
  pregunta: { es: f.q.es, en: f.q.en },
  respuesta: { es: texto(f.a.es), en: texto(f.a.en) },
}));

const cuerpo = { formato: 1, ajustes: { tipo_cambio_usd: null }, paginas, menu, faq, eventos: [], alergenos: {}, etiquetas: {}, giftcards: null };
const huella = createHash('sha256').update(JSON.stringify(cuerpo)).digest('hex');
await escribirJSON(path.join(DATA, 'contenido-capturado.json'), {
  formato: 1,
  version: 0,
  publicada: new Date().toISOString(),
  huella,
  _nota: 'Capturado de www.rosanta.rest (Wix) para sembrar() del editor. Claves de bloque = id del componente de Wix. Menú: precio_q es el primer precio; las variantes van al final de la descripción. Fotos con URL del sitio nuevo (quedan como externa/… hasta subirlas).',
  ...cuerpo,
});
console.log(`contenido-capturado.json: ${Object.keys(paginas).length} páginas, ${menu.length} secciones de menú (${menu.reduce((s, m) => s + m.platos.length, 0)} platos), ${faq.length} preguntas`);
