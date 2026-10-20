// 6b. COMPROBADOR DE PARIDAD: para cada página publicada, compara Wix contra la copia en lo que
// lee Google o una IA: texto visible (sin JavaScript), título, descripción, H1, canonical,
// hreflang y tipos de schema. Separa las diferencias ESPERADAS (documentadas en
// data/mejoras-seo.json y data/restaurante.json) de las que hay que revisar.
//
// Uso:
//   node scripts/paridad.mjs                       → Wix (caché .cache/) contra dist/
//   node scripts/paridad.mjs --refrescar           → vuelve a bajar Wix (GET)
//   node scripts/paridad.mjs --copia https://nuevo.rosanta.rest   → contra la copia publicada
// Salida: informes/paridad.md y informes/paridad.json. Código de salida 1 si hay "a revisar".
import path from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { RAIZ, DATA, pedirTexto, pedir, urlDe, leerJSON, normRuta } from './lib/comun.mjs';
import { metadatos, tiposSchema } from './lib/wix.mjs';

const args = process.argv.slice(2);
const REFRESCAR = args.includes('--refrescar');
const COPIA = args.includes('--copia') ? args[args.indexOf('--copia') + 1] : null;
const DIST = path.join(RAIZ, 'dist');

// Frases que Wix agrega para lectores de pantalla y que no son contenido.
// "More" es la entrada de desborde del menú de Wix (agrupa lo que no cabe); la copia no la usa.
const RELLENO_WIX = [/\btop of page\b/gi, /\bbottom of page\b/gi, /Use tab to navigate through the menu items\./gi, /Skip to Main Content/gi, /(LOCATION) More\b/g];

function normalizarTexto(t) {
  let s = t;
  for (const r of RELLENO_WIX) s = s.replace(r, (m, g1) => (typeof g1 === 'string' ? g1 : ' '));
  return s.replace(/[​­]/g, '').replace(/\s+/g, ' ').trim();
}
const palabras = (t) => normalizarTexto(t).toLowerCase().split(' ').filter(Boolean);

/** Diferencia de multiconjuntos de palabras: qué falta en la copia y qué sobra. */
function difPalabras(a, b) {
  const cuenta = new Map();
  for (const w of a) cuenta.set(w, (cuenta.get(w) || 0) + 1);
  const sobran = [];
  for (const w of b) {
    if (cuenta.get(w)) cuenta.set(w, cuenta.get(w) - 1);
    else sobran.push(w);
  }
  const faltan = [];
  for (const [w, n] of cuenta) for (let i = 0; i < n; i++) faltan.push(w);
  return { faltan, sobran };
}

async function htmlCopia(ruta) {
  if (COPIA) {
    const r = await pedir(urlDe(ruta, COPIA), { redirect: 'follow' });
    return { estado: r.status, html: await r.text() };
  }
  const f = path.join(DIST, ruta === '/' ? 'index.html' : ruta.slice(1).normalize('NFC') + '.html');
  if (!existsSync(f)) return { estado: 404, html: '' };
  return { estado: 200, html: readFileSync(f, 'utf8') };
}

const igualesConjunto = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function main() {
  const inv = await leerJSON(path.join(DATA, 'inventario.json'));
  const mejoras = await leerJSON(path.join(DATA, 'mejoras-seo.json'));
  const redir = mejoras.redirigir || {};
  const filas = [];
  for (const ruta of inv.paginas_publicadas) {
    const wixHtml = await pedirTexto(urlDe(ruta), { refrescar: REFRESCAR });
    const w = metadatos(wixHtml);
    const fila = { ruta, esperadas: [], revisar: [] };
    if (redir[ruta]) {
      fila.esperadas.push(`301 → ${redir[ruta]} (data/mejoras-seo.json: ${mejoras.redirigir._nota.split('.')[0]})`);
      filas.push(fila);
      continue;
    }
    const { estado, html } = await htmlCopia(ruta);
    if (estado !== 200) { fila.revisar.push(`la copia responde ${estado}`); filas.push(fila); continue; }
    const c = metadatos(html);

    // título
    if (w.titulo !== c.titulo) fila.revisar.push(`título: Wix «${w.titulo}» · copia «${c.titulo}»`);
    // descripción
    if (w.descripcion !== c.descripcion) {
      if (!w.descripcion && c.descripcion && mejoras.descripciones?.[ruta] === c.descripcion) fila.esperadas.push('descripción AGREGADA (Wix no tiene)');
      else fila.revisar.push(`descripción: Wix «${w.descripcion}» · copia «${c.descripcion}»`);
    }
    // canonical
    if (normRuta(w.canonical || '') !== normRuta(c.canonical || '')) fila.revisar.push(`canonical: Wix ${w.canonical} · copia ${c.canonical}`);
    // hreflang
    const hl = (m) => m.hreflang.map((h) => `${h.hreflang}=${decodeURI(h.href).normalize('NFC')}`);
    if (!igualesConjunto(hl(w), hl(c))) fila.revisar.push(`hreflang: Wix [${hl(w).join(', ')}] · copia [${hl(c).join(', ')}]`);
    // H1
    if (JSON.stringify(w.h1) !== JSON.stringify(c.h1)) {
      const promovida = (mejoras.promover_h1?.rutas || []).includes(ruta) && !w.h1.length && c.h1.length === 1;
      const deComponente = !w.h1.length && c.h1.length === 1 && /preguntas-frecuentes|pol[ií]tica-de-privacidad/.test(ruta);
      if (promovida) fila.esperadas.push(`H1 AGREGADO (el primer título pasa a h1): «${c.h1[0]}»`);
      else if (deComponente) fila.esperadas.push(`H1 AGREGADO (el del componente, antes dentro del iframe): «${c.h1[0]}»`);
      else fila.revisar.push(`H1: Wix ${JSON.stringify(w.h1)} · copia ${JSON.stringify(c.h1)}`);
    }
    // schema
    const tw = tiposSchema(w.jsonld);
    const tc = tiposSchema(c.jsonld);
    if (JSON.stringify(tw) !== JSON.stringify(tc)) {
      const sinRestWeb = (l) => l.filter((t) => t !== 'Restaurant' && t !== 'WebSite');
      const nRest = tc.filter((t) => t === 'Restaurant').length;
      const nWeb = tc.filter((t) => t === 'WebSite').length;
      if (JSON.stringify(sinRestWeb(tw)) === JSON.stringify(sinRestWeb(tc)) && nRest === 1 && nWeb <= 1)
        fila.esperadas.push(`schema: un solo Restaurant${tw.filter((t) => t === 'WebSite').length > 1 ? ' y un solo WebSite' : ''} (Wix: ${tw.filter((t) => t === 'Restaurant').length} Restaurant, ${tw.filter((t) => t === 'WebSite').length} WebSite)`);
      else fila.revisar.push(`schema: Wix [${tw.join(', ')}] · copia [${tc.join(', ')}]`);
    }
    // texto visible
    const pw = palabras(w.texto);
    const pc = palabras(c.texto);
    if (pw.join(' ') !== pc.join(' ')) {
      const { faltan, sobran } = difPalabras(pw, pc);
      const omitidos = Object.entries(mejoras.omitir_bloques || {}).filter(([k]) => !k.startsWith('_') && wixHtml.includes(`id="${k}"`));
      if (!faltan.length && !sobran.length) fila.esperadas.push('texto: mismas palabras, en otro orden (layout)');
      else if (omitidos.length && sobran.length === 0) fila.esperadas.push(`texto: faltan ${faltan.length} palabras del bloque omitido ${omitidos.map(([k]) => k).join(', ')} («${faltan.slice(0, 12).join(' ')}…»)`);
      else fila.revisar.push(`texto: faltan ${faltan.length} palabras [${faltan.slice(0, 25).join(' ')}${faltan.length > 25 ? ' …' : ''}] · sobran ${sobran.length} [${sobran.slice(0, 25).join(' ')}${sobran.length > 25 ? ' …' : ''}]`);
    }
    // mejoras visibles (FAQ, privacidad, formulario): texto que en Wix vive en un iframe
    const mejora = (html.match(/data-paridad="mejora"/g) || []).length;
    if (mejora) fila.esperadas.push(`${mejora} bloque(s) que en Wix viven en un iframe ahora son HTML visible (no cuentan en la comparación de texto)`);
    fila.caracteres = { wix: normalizarTexto(w.texto).length, copia: normalizarTexto(c.texto).length };
    filas.push(fila);
  }

  const identicas = filas.filter((f) => !f.revisar.length && !f.esperadas.length);
  const soloEsperadas = filas.filter((f) => !f.revisar.length && f.esperadas.length);
  const aRevisar = filas.filter((f) => f.revisar.length);
  const md = [
    `# Paridad Wix ↔ copia · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `Copia: ${COPIA || 'dist/ (construcción local)'} · Wix: https://www.rosanta.rest${REFRESCAR ? ' (bajado ahora)' : ' (caché)'}`,
    '',
    `- **${filas.length} páginas** comparadas`,
    `- **${identicas.length} idénticas** en todo lo que se compara`,
    `- **${soloEsperadas.length} con diferencias esperadas** (mejoras documentadas)`,
    `- **${aRevisar.length} a revisar**`,
    '',
    ...filas.flatMap((f) => [
      `## ${f.ruta} ${f.revisar.length ? '· A REVISAR' : f.esperadas.length ? '· esperadas' : '· idéntica'}`,
      ...(f.caracteres ? [`Texto visible: Wix ${f.caracteres.wix} caracteres · copia ${f.caracteres.copia}`] : []),
      ...f.revisar.map((x) => `- ❗ ${x}`),
      ...f.esperadas.map((x) => `- ✓ ${x}`),
      '',
    ]),
  ].join('\n');
  mkdirSync(path.join(RAIZ, 'informes'), { recursive: true });
  writeFileSync(path.join(RAIZ, 'informes', 'paridad.md'), md);
  writeFileSync(path.join(RAIZ, 'informes', 'paridad.json'), JSON.stringify({ identicas: identicas.length, esperadas: soloEsperadas.length, revisar: aRevisar.length, filas }, null, 2));
  console.log(`${filas.length} páginas · ${identicas.length} idénticas · ${soloEsperadas.length} con diferencias esperadas · ${aRevisar.length} a revisar`);
  for (const f of aRevisar) console.log(' ❗', f.ruta, '\n    ' + f.revisar.join('\n    '));
  process.exitCode = aRevisar.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
