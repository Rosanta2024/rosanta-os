#!/usr/bin/env node
/**
 * Corre el importador del historial de Wix DESDE LA MAC (con el gcloud de restaurante@rosanta.rest).
 * Lo mismo que el Cloud Run Job, pero tomando las claves de Secret Manager con gcloud.
 *
 *   node cloud/herramientas/importar-wix-reservas.js --seco --base rosanta_ensayo   (primero, sin escribir)
 *   node cloud/herramientas/importar-wix-reservas.js --base rosanta_ensayo
 *   node cloud/herramientas/importar-wix-reservas.js                                (rosanta, con el si del Estudio)
 *
 * SOLO LEE Wix. Ver cloud/app/src/wix-historial.js.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { principal } = require(path.join(APP, 'src', 'importar-wix-reservas'));

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, {
  CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'
});
function gcloud(args) {
  return execFileSync(GCLOUD, args.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const secreto = (nombre) => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', nombre]);
const auth = new OAuth2Client();
auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });

principal({ secreto, auth }).catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
