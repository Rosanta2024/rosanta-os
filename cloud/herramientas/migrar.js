#!/usr/bin/env node
/**
 * Aplica las migraciones pendientes de cloud/db/migraciones a rosanta-db (17-oct-2026).
 *
 *   node cloud/herramientas/migrar.js            → muestra cuales faltan, sin aplicar
 *   node cloud/herramientas/migrar.js --aplicar  → las aplica, cada una en su transaccion
 *   --base <nombre>   otra base de la misma instancia (por defecto rosanta), p. ej. rosanta_ensayo
 *   --solo <archivo,…> aplica SOLO esas (20-oct-2026: la 050 se aplico de mas porque estaba pendiente en la rama);
 *                     las demas pendientes se listan y se dejan. En produccion, usar siempre --solo.
 *
 * Entra como postgres con la clave de Secret Manager (db-postgres-root) y el token de gcloud de
 * quien la corre (restaurante@rosanta.rest). La primera vez crea la base "rosanta" y el usuario
 * "app" con una clave nueva que guarda en Secret Manager (db-app); ninguna clave se imprime.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, {
  CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'
});
const PROYECTO = 'rosanta-apps-script';
const DIR = path.join(__dirname, '..', 'db', 'migraciones');
const iBase = process.argv.indexOf('--base');
const BASE = iBase > -1 ? process.argv[iBase + 1] : 'rosanta';
const iSolo = process.argv.indexOf('--solo');
const SOLO = iSolo > -1 ? new Set(String(process.argv[iSolo + 1] || '').split(',').map((x) => x.trim()).filter(Boolean)) : null;
if (SOLO && !SOLO.size) throw new Error('--solo sin archivos.');
if (!/^rosanta(_[a-z0-9]+)?$/.test(BASE)) throw new Error('Nombre de base invalido: ' + BASE);

function gcloud(args, entrada) {
  return execFileSync(GCLOUD, args.concat(['--project', PROYECTO]), { env: ENV, input: entrada, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function secreto(nombre) { return gcloud(['secrets', 'versions', 'access', 'latest', '--secret', nombre]); }
function existeSecreto(nombre) {
  try { gcloud(['secrets', 'describe', nombre, '--format=value(name)']); return true; } catch (e) { return false; }
}
function authGcloud() {
  const c = new OAuth2Client();
  c.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return c;
}

async function asegurarBaseYApp(auth) {
  const root = await crearPool({ usuario: 'postgres', clave: secreto('db-postgres-root'), base: 'postgres', auth });
  try {
    const b = await root.query('SELECT 1 FROM pg_database WHERE datname = $1', [BASE]);
    if (!b.rowCount) { await root.query('CREATE DATABASE ' + BASE); console.log('Base "' + BASE + '" creada.'); }
    const r = await root.query("SELECT 1 FROM pg_roles WHERE rolname = 'app'");
    if (!r.rowCount) {
      const clave = crypto.randomBytes(24).toString('base64url');
      if (!existeSecreto('db-app')) gcloud(['secrets', 'create', 'db-app', '--data-file=-', '--replication-policy=automatic'], clave);
      else gcloud(['secrets', 'versions', 'add', 'db-app', '--data-file=-'], clave);
      await root.query("CREATE ROLE app LOGIN PASSWORD '" + clave.replace(/'/g, "''") + "'");
      console.log('Usuario "app" creado; su clave quedo en Secret Manager (db-app).');
    }
  } finally { await cerrarPool(root); }
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const auth = authGcloud();
  if (aplicar) await asegurarBaseYApp(auth);
  const pool = await crearPool({ usuario: 'postgres', clave: secreto('db-postgres-root'), base: aplicar ? BASE : 'postgres', auth });
  try {
    let hechas = new Set();
    if (aplicar) {
      await pool.query('CREATE TABLE IF NOT EXISTS schema_migraciones (archivo text PRIMARY KEY, sha256 text NOT NULL, aplicada timestamptz NOT NULL DEFAULT now())');
      const r = await pool.query('SELECT archivo, sha256 FROM schema_migraciones');
      hechas = new Map(r.rows.map((x) => [x.archivo, x.sha256]));
    } else {
      const b = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [BASE]);
      if (b.rowCount) {
        await cerrarPool(pool);
        return main2(auth);
      }
    }
    const archivos = fs.readdirSync(DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
    if (SOLO) for (const f of SOLO) if (archivos.indexOf(f) === -1) throw new Error('--solo: no existe ' + f + ' en cloud/db/migraciones.');
    for (const f of archivos) {
      const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
      const h = crypto.createHash('sha256').update(sql).digest('hex');
      if (hechas.has(f)) {
        if (hechas.get(f) !== h) throw new Error(f + ' cambio despues de aplicarse. Una migracion aplicada no se edita: va en un archivo nuevo.');
        continue;
      }
      if (!aplicar) { console.log('Pendiente: ' + f); continue; }
      if (SOLO && !SOLO.has(f)) { console.log('Pendiente, NO se aplica (no esta en --solo): ' + f); continue; }
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('INSERT INTO schema_migraciones (archivo, sha256) VALUES ($1, $2)', [f, h]);
        await c.query('COMMIT');
        console.log('Aplicada: ' + f);
      } catch (e) { await c.query('ROLLBACK'); throw new Error(f + ': ' + e.message); } finally { c.release(); }
    }
    console.log(aplicar ? 'Migraciones al dia.' : 'Sin aplicar nada (agregar --aplicar).');
  } finally { await cerrarPool(pool).catch(() => {}); }
}

// Sin --aplicar y con la base ya creada: solo lista lo pendiente leyendo schema_migraciones.
async function main2(auth) {
  const pool = await crearPool({ usuario: 'postgres', clave: secreto('db-postgres-root'), base: BASE, auth });
  try {
    const t = await pool.query("SELECT to_regclass('schema_migraciones') AS t");
    const hechas = t.rows[0].t ? new Set((await pool.query('SELECT archivo FROM schema_migraciones')).rows.map((x) => x.archivo)) : new Set();
    const archivos = fs.readdirSync(DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
    const faltan = archivos.filter((f) => !hechas.has(f));
    console.log(faltan.length ? 'Pendientes: ' + faltan.join(', ') : 'Migraciones al dia.');
  } finally { await cerrarPool(pool); }
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
