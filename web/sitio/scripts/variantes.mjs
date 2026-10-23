// Tamaños chicos de cada foto del sitio (23-oct, velocidad en el teléfono): dist/img/<x>-480.webp, -960.webp y
// -1280.webp (solo si la original es más ancha). Las páginas los piden con srcset (src/lib/sitio.mjs › srcsetDe).
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { RAIZ } from './lib/comun.mjs';

export const ANCHOS = [480, 960, 1280];
export async function generarVariantes(dir = path.join(RAIZ, 'dist', 'img')) {
  let n = 0;
  for (const f of await readdir(dir)) {
    if (!/\.webp$/.test(f) || /-\d+\.webp$/.test(f)) continue;
    const src = path.join(dir, f);
    const { width } = await sharp(src).metadata();
    for (const w of ANCHOS) {
      if (w >= width) continue;
      const out = src.replace(/\.webp$/, `-${w}.webp`);
      try { await stat(out); continue; } catch {}
      await sharp(src).resize({ width: w }).webp({ quality: 72 }).toFile(out); n++;
    }
  }
  return n;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log('variantes:', await generarVariantes());
