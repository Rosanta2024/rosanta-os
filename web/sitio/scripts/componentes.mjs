// Saca los DATOS de los componentes HTML del Editor de Wix (FAQ y política de privacidad)
// desde la copia versionada en ~/Dev/rosanta-wix, rama origin/claude/editor-componentes-html
// (solo lectura, con git show). En Wix esos textos viven dentro de un iframe; en la copia
// se dibujan como HTML visible (mejora permitida: no cambia direcciones).
//
// Uso: node scripts/componentes.mjs   → data/componentes/faq.json, privacidad.json
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { DATA, escribirJSON } from './lib/comun.mjs';

const REPO = process.env.ROSANTA_WIX_REPO || path.join(homedir(), 'Dev', 'rosanta-wix');
const RAMA = 'origin/claude/editor-componentes-html';
const ARCH = {
  faq: 'editor/html/preguntas-frecuentes__faq__3de38d_83558239.html',
  privacidad: 'editor/html/politica-de-privacidad__texto__3de38d_fe35f920.html',
};

function leer(f) {
  return execFileSync('git', ['-C', REPO, 'show', `${RAMA}:${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
}

/** Evalúa SOLO las declaraciones de datos (const x = {...}/[...];) en un contexto vacío. */
function datos(html, nombres) {
  const out = {};
  for (const n of nombres) {
    const m = html.match(new RegExp(`const ${n}\\s*=\\s*([\\[{][\\s\\S]*?\\n[\\]}]);`));
    if (!m) throw new Error(`No encontré "const ${n}" en el componente`);
    out[n] = vm.runInNewContext('(' + m[1] + ')', Object.create(null), { timeout: 1000 });
  }
  return out;
}

const faq = datos(leer(ARCH.faq), ['i18n', 'cats', 'faqs']);
const priv = datos(leer(ARCH.privacidad), ['i18n', 'sections']);
await escribirJSON(path.join(DATA, 'componentes', 'faq.json'), { fuente: `${RAMA}:${ARCH.faq}`, ...faq });
await escribirJSON(path.join(DATA, 'componentes', 'privacidad.json'), { fuente: `${RAMA}:${ARCH.privacidad}`, ...priv });
console.log(`FAQ: ${faq.faqs.length} preguntas en ${Object.keys(faq.cats).length} categorías · Privacidad: ${priv.sections.length} secciones`);
