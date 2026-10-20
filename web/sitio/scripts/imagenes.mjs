// Baja las imágenes de Rosanta que usa el sitio (de static.wixstatic.com), optimizadas a WebP,
// más los PDF que Wix sirve en /_files/... y la fuente Peskia (subida por Rosanta a Wix).
// Se guardan en public/ y se versionan en git (presupuesto: 40 MB en total; hoy ~3 MB).
// Si algún día no alcanza, este mismo script se corre en la construcción (npm run imagenes)
// y public/img/ se saca de git.
//
// Uso: node scripts/imagenes.mjs [--forzar]
import path from 'node:path';
import { mkdir, writeFile, stat, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { DATA, RAIZ, ORIGEN, pedir, leerJSON, escribirJSON, enLotes } from './lib/comun.mjs';

const FORZAR = process.argv.includes('--forzar');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHO_MAX = 1600;
const PRESUPUESTO_MB = 40;

export function archivoImagen(medio) {
  return medio.replace(/~mv2/, '').replace(/\.(jpe?g|png|webp|gif)$/i, '') + '.webp';
}

async function existe(f) { try { return (await stat(f)).size > 0; } catch { return false; } }

async function bajarImagen(img) {
  const dest = path.join(PUBLIC, 'img', archivoImagen(img.medio));
  if (img.og) {
    // Imagen para redes (og:image): JPEG, que lo leen todas las plataformas.
    const jpg = dest.replace(/\.webp$/, '.jpg');
    if (FORZAR || !(await existe(jpg))) {
      const r = await pedir(`https://static.wixstatic.com/media/${img.medio}/v1/fit/w_1200,h_1200,q_90/${img.medio}`, { redirect: 'follow' });
      if (!r.ok) throw new Error(`${r.status} og ${img.medio}`);
      await mkdir(path.dirname(jpg), { recursive: true });
      await writeFile(jpg, await sharp(Buffer.from(await r.arrayBuffer())).jpeg({ quality: 82 }).toBuffer());
    }
    img = { ...img, og_archivo: '/img/' + path.basename(jpg) };
  }
  if (!FORZAR && (await existe(dest))) {
    const m = await sharp(dest).metadata();
    return { ...img, archivo: '/img/' + archivoImagen(img.medio), ancho: m.width, alto: m.height };
  }
  const w = Math.min(ANCHO_MAX, Math.max(800, (img.anchoMax || 800) * 2));
  const url = `https://static.wixstatic.com/media/${img.medio}/v1/fit/w_${w},h_${w},q_90/${img.medio}`;
  let r = await pedir(url, { redirect: 'follow' });
  // Algunas imágenes no aceptan la transformación: se baja el original y se achica aquí.
  if (!r.ok) r = await pedir(`https://static.wixstatic.com/media/${img.medio}`, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const out = await sharp(buf).rotate().resize({ width: ANCHO_MAX, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, out);
  const m = await sharp(out).metadata();
  console.log('img', archivoImagen(img.medio), m.width + 'x' + m.height, Math.round(out.length / 1024) + ' KB');
  return { ...img, archivo: '/img/' + archivoImagen(img.medio), ancho: m.width, alto: m.height };
}

async function bajarArchivo(a) {
  const dest = path.join(PUBLIC, a.ruta);
  if (!FORZAR && (await existe(dest))) return;
  const r = await pedir(ORIGEN + a.ruta, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${a.ruta}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  console.log('pdf', a.ruta);
}

async function bajarFuente() {
  // Peskia Bold: la fuente de títulos de Rosanta, subida por Rosanta a Wix (ufonts).
  const dest = path.join(PUBLIC, 'fonts', 'peskia-bold.woff2');
  if (!FORZAR && (await existe(dest))) return;
  const r = await pedir('https://static.wixstatic.com/ufonts/b75909_7675c6a1bb6e453d887a28cc47e76310/woff2/file.woff2', { redirect: 'follow' });
  if (!r.ok) throw new Error('fuente ' + r.status);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  console.log('fuente peskia-bold.woff2');
}

async function favicon() {
  // El mismo ícono de Wix (b75909_045bbfcd…png), en 192 y 32 px.
  const medio = 'b75909_045bbfcd01d242eea5dd11b61aaedb76~mv2.png';
  for (const [n, w] of [['favicon.png', 192], ['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
    const dest = path.join(PUBLIC, n);
    if (!FORZAR && (await existe(dest))) continue;
    const r = await pedir(`https://static.wixstatic.com/media/${medio}/v1/fill/w_${w},h_${w}/${medio}`, { redirect: 'follow' });
    if (!r.ok) throw new Error('favicon ' + r.status);
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  }
}

async function imagenOG(imgs) {
  // El schema de Wix apunta a https://www.rosanta.rest/og-image.jpg, que hoy da 400 en Wix.
  // En la copia existe: se arma desde la foto de portada (1200x630).
  const dest = path.join(PUBLIC, 'og-image.jpg');
  if (!FORZAR && (await existe(dest))) return;
  const portada = imgs.find((i) => (i.alt || []).includes('portadaweb.jpg')) || imgs[0];
  const src = path.join(PUBLIC, portada.archivo);
  await writeFile(dest, await sharp(src).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer());
  console.log('og-image.jpg desde', portada.archivo);
}

async function pesoTotal(dir) {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) total += (await stat(path.join(e.parentPath ?? e.path, e.name))).size;
  }
  return total;
}

async function main() {
  const imgs = await leerJSON(path.join(DATA, 'imagenes.json'));
  const archivos = await leerJSON(path.join(DATA, 'archivos.json'));
  const hechas = await enLotes(imgs, 4, bajarImagen);
  await escribirJSON(path.join(DATA, 'imagenes.json'), hechas);
  for (const a of archivos) await bajarArchivo(a);
  await bajarFuente();
  await favicon();
  await imagenOG(hechas);
  const mb = (await pesoTotal(PUBLIC)) / 1024 / 1024;
  console.log(`\npublic/ pesa ${mb.toFixed(1)} MB (presupuesto ${PRESUPUESTO_MB} MB)`);
  if (mb > PRESUPUESTO_MB) {
    console.error('Pasa el presupuesto: sacar public/img de git y correr este script en la construcción.');
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
