// Reseñas de Google para la portada (Juanma, 23-oct): 4 reseñas REALES de 5 estrellas, recientes y con texto,
// más la calificación general (promedio y total). Sin widgets de terceros: se leen de la base de la nube
// (rosanta-db, base "rosanta"), donde el lector de Google Business de rosanta-nube las copia cada hora:
//   resenas_gbp_google  → cada reseña (estrellas, cliente, texto, fecha)
//   resenas_corridas    → la última corrida "leer-google" trae promedio y total de Google
// Solo LEE. Escribe data/resenas.json, que el sitio dibuja al construirse (se ve sin JavaScript).
// Si no hay acceso a la base (por ejemplo, una construcción sin gcloud), deja el archivo como está.
//
// Uso: node scripts/resenas.mjs           (entra con gcloud, como cloud/herramientas/contar-base.js)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { DATA, RAIZ, escribirJSON } from './lib/comun.mjs';

const POR_IDIOMA = 4;
const MIN = 90;    // caracteres mínimos del texto mostrado
const MAX = 900;   // las muy largas no se eligen (se ven recortadas igual, pero se pierde el sentido)

const ES = /\b(el|la|los|las|que|muy|con|para|una|del|comida|servicio|lugar|excelente|delicios[oa]|ambiente|todo)\b/gi;
const EN = /\b(the|and|was|were|with|very|food|service|place|great|delicious|we|our|amazing|garden)\b/gi;
const cuenta = (t, re) => (t.match(re) || []).length;
export function idiomaDe(t) {
  const es = cuenta(t, ES), en = cuenta(t, EN);
  if (es >= 2 && es > en) return 'es';
  if (en >= 2 && en > es) return 'en';
  return null;
}

/** Separa el texto de Google en original y traducción ("(Translated by Google)" / "(Original)"). */
export function textos(resena) {
  const t = String(resena || '').trim();
  const out = {};
  let m;
  if ((m = t.match(/^\(Translated by Google\)\s*([\s\S]*?)\s*\(Original\)\s*([\s\S]*)$/))) {
    out.en = { texto: m[1].trim(), traducida: true };
    const o = m[2].trim();
    if (idiomaDe(o) === 'es') out.es = { texto: o, traducida: false };
  } else if ((m = t.match(/^([\s\S]*?)\s*\(Translated by Google\)\s*([\s\S]*)$/))) {
    const o = m[1].trim();
    const l = idiomaDe(o);
    if (l === 'es') out.es = { texto: o, traducida: false };
    out.en = { texto: m[2].trim(), traducida: true };
  } else {
    const l = idiomaDe(t);
    if (l) out[l] = { texto: t, traducida: false };
  }
  return out;
}

/** Elige, por idioma, las 4 más recientes de 5 estrellas con texto (primero las escritas en ese idioma). */
export function elegir(filas, n = POR_IDIOMA) {
  const res = { es: [], en: [] };
  const ordenadas = [...filas].filter((f) => Number(f.estrellas) === 5).sort((a, b) => new Date(b.creada) - new Date(a.creada));
  for (const idioma of ['es', 'en']) {
    const cand = [];
    for (const f of ordenadas) {
      const t = textos(f.resena)[idioma];
      if (!t || t.texto.length < MIN || t.texto.length > MAX) continue;
      cand.push({ f, t });
    }
    // Primero las originales; si no alcanzan, las traducidas por Google (y se dice que lo son).
    const orden = cand.filter((c) => !c.t.traducida).concat(cand.filter((c) => c.t.traducida));
    for (const { f, t } of orden.slice(0, n)) {
      res[idioma].push({
        id: f.review_id, nombre: String(f.cliente || '').trim() || 'Google', estrellas: 5,
        fecha: new Date(f.creada).toISOString().slice(0, 10), texto: t.texto, traducida: t.traducida,
      });
    }
    res[idioma].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  return res;
}

async function main() {
  const APP = path.join(RAIZ, '..', '..', 'cloud', 'app');
  if (!existsSync(path.join(APP, 'node_modules'))) throw new Error('falta cloud/app/node_modules (npm ci en cloud/app)');
  const require = createRequire(path.join(APP, 'package.json'));
  process.env.DB_INSTANCIA = process.env.DB_INSTANCIA || 'rosanta-apps-script:northamerica-south1:rosanta-db';
  const { OAuth2Client } = require('google-auth-library');
  const { crearPool, cerrarPool } = require('./src/db');
  const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
  const ENV = { ...process.env, CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' };
  const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const clave = gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']);
  const pool = await crearPool({ usuario: 'postgres', clave, base: 'rosanta', auth });
  try {
    const filas = (await pool.query(
      `SELECT review_id, estrellas, cliente, resena, creada FROM resenas_gbp_google
        WHERE estrellas = 5 AND length(resena) > 0 ORDER BY creada DESC LIMIT 200`)).rows;
    const c = (await pool.query(
      `SELECT cuando, resumen FROM resenas_corridas WHERE tarea = 'leer-google' AND (resumen->>'total_google')::int > 0
        ORDER BY cuando DESC LIMIT 1`)).rows[0];
    const elegidas = elegir(filas);
    if (elegidas.es.length < POR_IDIOMA || elegidas.en.length < POR_IDIOMA) throw new Error('no alcanzan las reseñas para 4 por idioma');
    const salida = {
      _nota: 'Lo genera scripts/resenas.mjs desde rosanta-db (resenas_gbp_google y la última corrida leer-google). No editar a mano.',
      actualizado: new Date().toISOString(),
      promedio: Math.round(Number(c?.resumen?.promedio || 0) * 10) / 10,
      total: Number(c?.resumen?.total_google || 0),
      ...elegidas,
    };
    await escribirJSON(path.join(DATA, 'resenas.json'), salida);
    console.log(`resenas.json: ${salida.promedio} · ${salida.total} · ES ${salida.es.map((r) => r.nombre).join(', ')} · EN ${salida.en.map((r) => r.nombre).join(', ')}`);
  } finally { await cerrarPool(pool); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('resenas: no se actualizó (' + e.message + '). Queda el data/resenas.json anterior.'); process.exit(0); });
}
