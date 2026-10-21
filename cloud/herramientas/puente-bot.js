#!/usr/bin/env node
/**
 * PUENTE del bot con "sombra viva" (aprobado por Juanma, 20-oct-2026; arranca el martes 27-oct después de las 10:00).
 * Meta le manda los mensajes a la nube; la nube se los reenvía tal cual al bot de Apps Script (que sigue contestando)
 * y, además, los piensa sin mandar nada. El servicio en puente NO tiene las claves de Meta.
 *
 *   node cloud/herramientas/puente-bot.js preparar   crea bot-verify-token-nube y bot-webhook-nube (al azar; no se imprimen) y le da
 *                                                    lectura a rosanta-bot-sombra@ de esos y de bot-webhook-apps (lo crea Juanma)
 *   node cloud/herramientas/puente-bot.js publicar   imprime el gcloud run deploy del puente
 *   node cloud/herramientas/puente-bot.js probar     manda a la nube un aviso de WhatsApp SIN mensajes (solo un estado de entrega):
 *                                                    la nube lo reenvía al bot de siempre, que no contesta nada; se mira bot_eventos
 *   node cloud/herramientas/puente-bot.js meta       la URL y el token de verificación que Juanma pega en Meta
 *   node cloud/herramientas/puente-bot.js eventos    los últimos mensajes y qué pasó con cada uno
 *   node cloud/herramientas/puente-bot.js volver     cómo volver atrás
 *
 * El secreto que crea Juanma: bot-webhook-apps = el valor de WEBHOOK_SECRET de las Propiedades del bot (Apps Script).
 */
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db.js'));

const PROYECTO = 'rosanta-apps-script';
const CUENTA = 'rosanta-bot-sombra@' + PROYECTO + '.iam.gserviceaccount.com';
const SERVICIO = 'rosanta-bot-sombra';
const EXEC = 'https://script.google.com/macros/s/AKfycbw0PnfbHHtxaCH8tZtYT0yMHFAsT1h2uZXZ1pz2GC_wiaOAWD8CZ5WoU2DVwtpK0DvIAg/exec';
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const env = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (args, entrada) => execFileSync(GCLOUD, args.concat(['--project', PROYECTO]), { encoding: 'utf8', env, input: entrada, stdio: [entrada === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] }).trim();
const existe = (s) => { try { gcloud(['secrets', 'describe', s, '--format=value(name)']); return true; } catch (e) { return false; } };
const secreto = (s) => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', s]);
const url = () => gcloud(['run', 'services', 'describe', SERVICIO, '--region', 'northamerica-south1', '--format=value(status.url)']);

function preparar() {
  for (const s of ['bot-verify-token-nube', 'bot-webhook-nube']) {
    if (!existe(s)) { gcloud(['secrets', 'create', s, '--replication-policy=automatic', '--data-file=-'], crypto.randomBytes(24).toString('hex')); console.log('Creado ' + s); }
  }
  for (const s of ['bot-verify-token-nube', 'bot-webhook-nube', 'bot-webhook-apps']) {
    if (!existe(s)) { console.log('FALTA el secreto ' + s + ' (lo crea Juanma: el WEBHOOK_SECRET de las Propiedades del bot).'); continue; }
    gcloud(['secrets', 'add-iam-policy-binding', s, '--member=serviceAccount:' + CUENTA, '--role=roles/secretmanager.secretAccessor', '--format=none']);
    console.log('Lectura para el bot: ' + s);
  }
}

function publicar() {
  console.log(['python3 cloud/herramientas/sellar-nube.py --servicio ' + SERVICIO,
    'gcloud run deploy ' + SERVICIO + ' --source cloud/bot --region northamerica-south1 --project ' + PROYECTO +
    ' --update-env-vars MODO_BOT=puente,BOT_APPS_SCRIPT_URL=' + EXEC + ',SV_MAX_DIA=' + (process.env.SV_MAX_DIA || 30) +
    ' --update-secrets BOT_APPS_SCRIPT_TOKEN=bot-webhook-apps:latest,BOT_VERIFY_TOKEN=bot-verify-token-nube:latest,BOT_WEBHOOK_SECRET=bot-webhook-nube:latest' +
    ' --no-cpu-throttling --max-instances 1 --timeout 300',
    '# Reloj de la comparación de cada noche (6:40):',
    'gcloud scheduler jobs create http comparar-viva-noche --location us-central1 --schedule "40 6 * * *" --time-zone America/Guatemala --uri <URL>/tareas/comparar-viva-noche --http-method POST --headers x-rosanta-tarea=<clave-tareas>'].join('\n'));
}

async function probar() {
  // Solo un estado de entrega: el bot de siempre lo recibe y no hace nada (no hay mensajes de clientes).
  const cuerpo = { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'prueba-puente' }, statuses: [{ id: 'prueba-puente-' + Date.now(), status: 'read' }] } }] }] };
  const r = await fetch(url() + '/webhook?token=' + encodeURIComponent(secreto('bot-webhook-nube')), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  console.log('La nube contestó: ' + r.status + ' ' + (await r.text()));
  await new Promise((s) => setTimeout(s, 8000));
  await eventos(3);
}

function meta() {
  // Estos dos datos van SOLO al panel de Meta (en el Chrome de Juanma).
  console.log('URL de devolución: ' + url() + '/webhook?token=' + secreto('bot-webhook-nube'));
  console.log('Token de verificación: ' + secreto('bot-verify-token-nube'));
}

async function eventos(n) {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const p = await crearPool({ usuario: 'app', clave: secreto('db-app'), base: 'rosanta', auth });
  try {
    const r = await p.query(`SELECT to_char(recibido AT TIME ZONE 'America/Guatemala', 'MM-DD HH24:MI:SS') AS h, objeto, modo, resultado, ms, error FROM bot_eventos ORDER BY id DESC LIMIT $1`, [n || 20]);
    r.rows.reverse().forEach((x) => console.log([x.h, x.objeto, x.modo, x.resultado, (x.ms || 0) + 'ms', x.error || ''].join(' · ')));
  } finally { await cerrarPool(p); }
}

function volver() {
  console.log(['VOLVER ATRÁS (5 minutos, en el Chrome de Juanma): en la app real del bot en Meta, en el webhook de WhatsApp, de Instagram',
    'y de Messenger, poner la URL y el token de verificación que tenían ANTES (anotados el día del cambio). El bot de siempre',
    'sigue igual todo el tiempo: el puente nunca cambió nada en él. Después, si se quiere, apagar el puente:',
    'gcloud run deploy ' + SERVICIO + ' ... --remove-env-vars MODO_BOT (la sombra de siempre sigue).'].join('\n'));
}

const [cmd] = process.argv.slice(2);
const fn = { preparar, publicar, probar, meta, eventos: () => eventos(20), volver }[cmd];
if (!fn) { console.log('Uso: preparar | publicar | probar | meta | eventos | volver'); process.exit(1); }
Promise.resolve(fn()).catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
