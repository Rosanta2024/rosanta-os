// Utilidades comunes de los scripts de captura y prueba.
// SOLO LECTURA: todo lo que sale de aquí hacia Wix es GET a páginas públicas.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA = path.join(RAIZ, 'data');
export const CACHE = path.join(RAIZ, '.cache');
export const ORIGEN = 'https://www.rosanta.rest';
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 RosantaMigracion/1.0 (solo-lectura)';

/** Ruta normalizada: NFC, decodificada, sin barra final (salvo "/"). */
export function normRuta(r) {
  let s = r;
  try { s = decodeURI(s); } catch { /* ya decodificada */ }
  s = s.normalize('NFC');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s || '/';
}

/** URL absoluta con la ruta codificada (acentos → %C3%AD). */
export function urlDe(ruta, origen = ORIGEN) {
  const r = normRuta(ruta);
  return origen.replace(/\/$/, '') + encodeURI(r === '/' ? '/' : r);
}

export async function pedir(url, { redirect = 'manual', ua = UA, intentos = 3 } = {}) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { redirect, headers: { 'user-agent': ua, 'accept-language': 'en-US,en;q=0.9' } });
      return r;
    } catch (e) {
      ultimo = e;
      await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
    }
  }
  throw ultimo;
}

/** GET con caché en disco (.cache/), para no golpear Wix en cada corrida. */
export async function pedirTexto(url, { refrescar = false } = {}) {
  await mkdir(CACHE, { recursive: true });
  const f = path.join(CACHE, createHash('sha1').update(url).digest('hex') + '.txt');
  if (!refrescar) {
    try { return await readFile(f, 'utf8'); } catch { /* no está */ }
  }
  const r = await pedir(url, { redirect: 'follow' });
  const t = await r.text();
  if (r.ok) await writeFile(f, t);
  return t;
}

export async function leerJSON(f) { return JSON.parse(await readFile(f, 'utf8')); }
export async function escribirJSON(f, d) {
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(d, null, 2) + '\n');
}

/** Nombre de archivo estable para una ruta ("/" → "inicio", "/es/full-menu" → "es__full-menu"). */
export function claveRuta(ruta) {
  const r = normRuta(ruta);
  if (r === '/') return 'inicio';
  return r.slice(1).replace(/\//g, '__');
}

export async function enLotes(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  }
  return out;
}
