#!/usr/bin/env node
/**
 * Despliega una carpeta a Firebase Hosting por la API REST (sin firebase-tools), con el token de gcloud de quien la corre.
 * 24-oct-2026.
 *
 *   node cloud/herramientas/desplegar-firebase.mjs --sitio rosanta-apps-script --carpeta web/sitio/dist --config web/sitio/firebase.json
 *   node cloud/herramientas/desplegar-firebase.mjs --sitio rosanta-en --config web/sitio/redirecciones-idioma/en/firebase.json
 *   --sin-rewrites   no manda los rewrites a Cloud Run (p. ej. la prueba, que habla con la API de ensayo)
 *   --noindex        agrega X-Robots-Tag: noindex a todo (la prueba en nuevo.rosanta.rest)
 *   --seco           arma la version y cuenta los archivos, pero no publica
 *
 * Pasos de la API: crear version (con la config de firebase.json traducida) → populateFiles (hash sha256 del gzip) →
 * subir solo lo que falta → FINALIZED → release.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const SITIO = arg('--sitio'); const CARPETA = arg('--carpeta'); const CONFIG = arg('--config');
const SECO = process.argv.includes('--seco'); const SIN_REWRITES = process.argv.includes('--sin-rewrites');
const NOINDEX = process.argv.includes('--noindex');   // version de prueba: X-Robots-Tag en todo
if (!/^[a-z0-9-]+$/.test(SITIO || '')) throw new Error('Falta --sitio');
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk/bin/gcloud');
const env = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const TOKEN = execFileSync(GCLOUD, ['auth', 'print-access-token'], { env, encoding: 'utf8' }).trim();
const API = 'https://firebasehosting.googleapis.com/v1beta1';
const cab = { Authorization: 'Bearer ' + TOKEN, 'x-goog-user-project': 'rosanta-apps-script' };

async function pedir(metodo, url, cuerpo, extra) {
  const r = await fetch(url, { method: metodo, headers: Object.assign({ 'Content-Type': 'application/json' }, cab, extra || {}),
    body: cuerpo === undefined ? undefined : (Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo)) });
  const t = await r.text();
  if (!r.ok) throw new Error(metodo + ' ' + url + ' → ' + r.status + ' ' + t.slice(0, 400));
  return t ? JSON.parse(t) : {};
}

/** firebase.json (hosting) → ServingConfig de la API. */
function servingConfig(h) {
  const c = {};
  if (h.cleanUrls) c.cleanUrls = true;
  if (h.trailingSlash === false) c.trailingSlashBehavior = 'REMOVE'; else if (h.trailingSlash === true) c.trailingSlashBehavior = 'ADD';
  if (h.redirects) c.redirects = h.redirects.map((x) => {
    const o = { location: x.destination, statusCode: x.type || 301 };
    if (/[:]/.test(x.source)) o.path = x.source; else o.glob = x.source;   // "/:ruta*" usa path con captura
    return o;
  });
  if (h.rewrites && !SIN_REWRITES) c.rewrites = h.rewrites.map((x) => (x.run ? { glob: x.source, run: { serviceId: x.run.serviceId, region: x.run.region } } : { glob: x.source, path: x.destination }));
  if (h.headers) c.headers = h.headers.map((x) => ({ glob: x.source, headers: Object.fromEntries(x.headers.map((k) => [k.key, k.value])) }));
  if (NOINDEX) c.headers = (c.headers || []).concat([{ glob: '**', headers: { 'X-Robots-Tag': 'noindex, nofollow' } }]);
  return c;
}

function archivos(dir) {
  const out = [];
  (function andar(d) { for (const n of readdirSync(d)) { const f = path.join(d, n); if (statSync(f).isDirectory()) andar(f); else out.push(f); } })(dir);
  return out;
}

const hosting = JSON.parse(readFileSync(CONFIG, 'utf8')).hosting;
const config = servingConfig(hosting);
const lista = CARPETA ? archivos(CARPETA) : [];
const porRuta = {}, porHash = {};
for (const f of lista) {
  const gz = gzipSync(readFileSync(f), { level: 9 });
  const h = crypto.createHash('sha256').update(gz).digest('hex');
  porRuta['/' + path.relative(CARPETA, f).split(path.sep).join('/')] = h; porHash[h] = gz;
}
console.log('sitio', SITIO, '| archivos', lista.length, '| redirecciones', (config.redirects || []).length, '| rewrites', (config.rewrites || []).length);
if (SECO) process.exit(0);
const v = await pedir('POST', `${API}/sites/${SITIO}/versions`, { config });
if (lista.length) {
  const p = await pedir('POST', `${API}/${v.name}:populateFiles`, { files: porRuta });
  const faltan = p.uploadRequiredHashes || [];
  for (const h of faltan) {
    const r = await fetch(`${p.uploadUrl}/${h}`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/octet-stream' }, cab), body: porHash[h] });
    if (!r.ok) throw new Error('subir ' + h + ' → ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  console.log('subidos', faltan.length, 'de', Object.keys(porHash).length);
}
await pedir('PATCH', `${API}/${v.name}?update_mask=status`, { status: 'FINALIZED' });
const rel = await pedir('POST', `${API}/sites/${SITIO}/releases?versionName=${encodeURIComponent(v.name)}`, {});
console.log('publicado:', rel.name, rel.version && rel.version.status);
