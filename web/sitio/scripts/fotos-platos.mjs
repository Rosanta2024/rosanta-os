// Fotos de la carta y de la galería de /reservas (Juanma, 23-oct), desde Drive (Marketing - Dani) o desde
// public/img. Las recorta y comprime a WebP en public/img/platos/. Se corre a mano cuando cambian las fotos
// (las fuentes viven en Drive y no en el repo):   node scripts/fotos-platos.mjs
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { DATA, RAIZ } from './lib/comun.mjs';

const DRIVE = process.env.ROSANTA_FOTOS || path.join(process.env.HOME, 'My Drive/Rosanta OS/05_Marketing_OS/Marketing - Dani');
const OUT = path.join(RAIZ, 'public', 'img', 'platos');
const cfg = JSON.parse(await readFile(path.join(DATA, 'fotos-platos.json'), 'utf8'));
const imagenes = new Map(JSON.parse(await readFile(path.join(DATA, 'imagenes.json'), 'utf8')).map((i) => [i.medio, i]));

function fuente(f) {
  if (f.startsWith('img:')) return path.join(RAIZ, 'public', imagenes.get(f.slice(4)).archivo);
  return path.join(DRIVE, f);
}
async function base(f, recorte) {
  let img = sharp(fuente(f), { failOn: 'none' }).rotate();
  if (recorte) {
    const m = await sharp(await img.clone().toBuffer()).metadata();
    const [x, y, w, h] = recorte;
    img = sharp(await img.toBuffer()).extract({ left: Math.round(x * m.width), top: Math.round(y * m.height), width: Math.round(w * m.width), height: Math.round(h * m.height) });
  }
  return img.toBuffer();
}
async function hacer(nombre, f, recorte, proporcion, anchos) {
  const b = await base(f, recorte);
  for (const w of anchos) {
    const h = Math.round(w / proporcion);
    await sharp(b).resize(w, h, { fit: 'cover', position: 'centre' }).webp({ quality: 72 }).toFile(path.join(OUT, `${nombre}-${w}.webp`));
  }
}
await mkdir(OUT, { recursive: true });
for (const [k, p] of Object.entries(cfg.platos)) await hacer(k, p.fuente, p.recorte, 1, [160, 320]);
for (const [k, s] of Object.entries(cfg.secciones)) await hacer(`seccion-${k}`, s.fuente, s.recorte, 16 / 7, [640, 1200]);
for (const [i, g] of cfg.galeria_reservas.entries()) await hacer(`reservas-${i + 1}`, g.fuente, g.recorte, 4 / 5, [400, 800]);
// Imagen para compartir (Open Graph) de la portada y de reservas: 1200x630.
if (cfg.og) await sharp(await base(cfg.og.fuente, cfg.og.recorte)).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, 'og-rosanta.jpg'));
console.log('fotos-platos: listo en public/img/platos');
