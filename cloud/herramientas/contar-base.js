#!/usr/bin/env node
/**
 * Foto de una base: filas y huella (md5 del contenido ordenado) de cada tabla (17-oct-2026).
 * Sirve para el ensayo de restauracion: se saca la foto de rosanta-db y la de la copia restaurada,
 * y se comparan. Solo LEE.
 *
 *   node cloud/herramientas/contar-base.js [instancia] [base]
 *     instancia: por defecto rosanta-db (proyecto rosanta-apps-script, Queretaro)
 *     base:      por defecto rosanta
 * Entra como postgres con la clave de Secret Manager (db-postgres-root) o, si existe, la de la
 * variable CLAVE_POSTGRES (para una instancia de ensayo creada con otra clave).
 */
const path = require('path');
const { execFileSync } = require('child_process');
const instancia = process.argv[2] || 'rosanta-db';
const base = process.argv[3] || 'rosanta';
process.env.DB_INSTANCIA = 'rosanta-apps-script:northamerica-south1:' + instancia;
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();

(async () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const clave = process.env.CLAVE_POSTGRES || gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']);
  const pool = await crearPool({ usuario: 'postgres', clave, base, auth });
  try {
    const t = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const foto = {};
    for (const { tablename } of t.rows) {
      const r = await pool.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${tablename}" x`);
      foto[tablename] = { filas: r.rows[0].n, huella: r.rows[0].h.slice(0, 12) };
    }
    console.log(JSON.stringify({ instancia, base, foto }));
  } finally { await cerrarPool(pool); }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
