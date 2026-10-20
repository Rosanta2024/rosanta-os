#!/usr/bin/env node
/**
 * Carga inicial del motor de reservas (migracion 051) desde las tablas wix_* (050). NO llama a Wix: lee lo que
 * ya guardo el importador del historial. NO SE HA CORRIDO: espera la configuracion real (llave del 23-oct),
 * la 050 y la 051 aplicadas por el Estudio.
 *
 *   node cloud/herramientas/cargar-reservas-desde-wix.js --seco --base rosanta_ensayo   (primero: conteos, sin escribir)
 *   node cloud/herramientas/cargar-reservas-desde-wix.js --base rosanta_ensayo
 *   node cloud/herramientas/cargar-reservas-desde-wix.js                                (rosanta, con el si del Estudio)
 *
 * Con motor_reservas = base se niega (la base ya manda). Imprime conteos y avisos: nunca nombres, correos ni telefonos.
 * Entra como "app" con la clave de Secret Manager (db-app) y el token de gcloud de quien la corre.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
const { cargarDesdeWix } = require(path.join(APP, 'src', 'reservas', 'carga-wix'));

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, {
  CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'
});
function gcloud(args) {
  return execFileSync(GCLOUD, args.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const iBase = process.argv.indexOf('--base');
const BASE = iBase > -1 ? process.argv[iBase + 1] : 'rosanta';
if (!/^rosanta(_[a-z0-9]+)?$/.test(BASE)) throw new Error('Nombre de base invalido: ' + BASE);
const SECO = process.argv.includes('--seco');

(async () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const pool = await crearPool({ usuario: 'app', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-app']), base: BASE, auth });
  try {
    const r = await cargarDesdeWix(pool, { seco: SECO });
    console.log(JSON.stringify(Object.assign({ base: BASE }, r), null, 2));
  } finally { await cerrarPool(pool).catch(() => {}); }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
