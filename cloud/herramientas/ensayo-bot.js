#!/usr/bin/env node
/**
 * Ensayo del bot en vivo con un número de prueba de Meta (viernes 23-oct-2026, aprobado por Juanma).
 * NUNCA toca el bot real, su app de Meta, la Rosanta Leads real ni la base `rosanta`.
 *
 *   node cloud/herramientas/ensayo-bot.js preparar <idCopiaLeads> <phoneNumberIdPrueba> <telefonoJuanma>
 *       crea los secretos ensayo-verify-token y ensayo-webhook-secret (valores al azar; no se imprimen),
 *       le da a rosanta-bot-sombra@ lectura de los secretos del ensayo, carga las Propiedades del bot de
 *       prueba en bot_estado de la base rosanta_ensayo y pone el interruptor 'bot' en 'vivo' (tabla interruptores, solo en ensayo)
 *   node cloud/herramientas/ensayo-bot.js publicar <idCopiaLeads>     imprime el gcloud run deploy del ensayo
 *   node cloud/herramientas/ensayo-bot.js webhook                     imprime la URL y el token de verificación para Meta
 *   node cloud/herramientas/ensayo-bot.js eventos                     lo que pasó con cada mensaje (bot_eventos del ensayo)
 *   node cloud/herramientas/ensayo-bot.js borrar                      imprime cómo borrar todo lo del ensayo
 *
 * El secreto que crea Juanma (con los pasos de la Central): ensayo-wa-token (token temporal de la app de prueba).
 * El de Wix ya existe (wix-reservas-secreto, 19-oct): el ensayo le da lectura al bot de prueba y al final se la quita.
 */
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db.js'));

const PROYECTO = 'rosanta-apps-script';
const CUENTA = 'rosanta-bot-sombra@' + PROYECTO + '.iam.gserviceaccount.com';
const BASE = 'rosanta_ensayo';
const SERVICIO = 'rosanta-bot-ensayo';
const LEADS_REAL = '1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc';
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const env = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (args, entrada) => execFileSync(GCLOUD, args, { encoding: 'utf8', env, input: entrada, stdio: [entrada === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] }).trim();
const existe = (s) => { try { gcloud(['secrets', 'describe', s, '--format=value(name)']); return true; } catch (e) { return false; } };

async function pool() {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return crearPool({ usuario: 'app', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-app']), base: BASE, auth });
}

async function preparar(idCopia, pidPrueba, telefono) {
  if (!idCopia || idCopia === LEADS_REAL) throw new Error('Falta el id de la COPIA de Rosanta Leads (nunca la real).');
  if (!/^\d{6,}$/.test(String(pidPrueba || ''))) throw new Error('Falta el phone_number_id del número de prueba.');
  if (!/^\d{8,15}$/.test(String(telefono || ''))) throw new Error('Falta el teléfono de Juanma (solo dígitos, con 502).');
  for (const s of ['ensayo-verify-token', 'ensayo-webhook-secret']) {
    if (!existe(s)) { gcloud(['secrets', 'create', s, '--replication-policy=automatic', '--data-file=-'], crypto.randomBytes(24).toString('hex')); console.log('Creado ' + s); }
  }
  for (const s of ['ensayo-verify-token', 'ensayo-webhook-secret', 'ensayo-wa-token', 'wix-reservas-secreto']) {
    if (!existe(s)) { console.log('FALTA el secreto ' + s + ' (lo crea Juanma).'); continue; }
    gcloud(['secrets', 'add-iam-policy-binding', s, '--member=serviceAccount:' + CUENTA, '--role=roles/secretmanager.secretAccessor', '--format=none']);
  }
  const props = { SHEET_ID: idCopia, KB_DOC_ID: '1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I', WIX_RESERVAS_URL: 'https://www.rosanta.rest/_functions/reservaBot',
    WA_PHONE_NUMBER_ID: String(pidPrueba), OWNER_WA: String(telefono), BOTONES_MODO: 'todos', CONSOLE_URL: '', GRAPH_VERSION: 'v21.0' };
  const p = await pool();
  try {
    for (const k of Object.keys(props)) {
      await p.query(`INSERT INTO bot_estado (clave, tipo, valor) VALUES ($1, 'prop', $2) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, tipo = 'prop', actualizado = now()`, [k, props[k]]);
    }
    console.log('Base ' + BASE + ': ' + Object.keys(props).length + ' propiedades del bot de prueba.');
  } finally { await cerrarPool(p); }
  await ponerInterruptor('vivo');
}

/** El interruptor 'bot' en la tabla interruptores (migración 013), SOLO en la base del ensayo. app solo lee esa tabla: va con la cuenta raíz. */
async function ponerInterruptor(modo) {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const root = await crearPool({ usuario: 'postgres', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']), base: BASE, auth });
  try {
    await root.query(`INSERT INTO interruptores (modulo, modo, por) VALUES ('bot', $1, 'ensayo-bot.js') ON CONFLICT (modulo) DO UPDATE SET modo = EXCLUDED.modo, cambiado = now(), por = EXCLUDED.por`, [modo]);
    console.log('Base ' + BASE + ': interruptor bot = ' + modo + ' (SOLO en el ensayo).');
  } finally { await cerrarPool(root); }
}

function publicar(idCopia) {
  if (!idCopia || idCopia === LEADS_REAL) throw new Error('Falta el id de la COPIA de Rosanta Leads.');
  console.log(['python3 cloud/herramientas/sellar-nube.py --servicio ' + SERVICIO,
    'gcloud run deploy ' + SERVICIO + ' --source cloud/bot --region northamerica-south1 --service-account ' + CUENTA +
    ' --set-env-vars TZ=America/Guatemala,DB_USUARIO=app,DB_BASE=' + BASE + ',MODO_BOT=vivo,BOT_APPS_SCRIPT_URL=ensayo,BOT_LEADS_ID=' + idCopia +
    ' --set-secrets DB_CLAVE=db-app:latest,CLAVE_TAREAS=clave-tareas:latest,BOT_WHATSAPP_TOKEN=ensayo-wa-token:latest,BOT_IG_TOKEN=ensayo-verify-token:latest,' +
    'BOT_MESSENGER_TOKEN=ensayo-verify-token:latest,BOT_ANTHROPIC_KEY=anthropic-sombra:3,BOT_WIX_SECRETO=wix-reservas-secreto:latest,' +
    'BOT_VERIFY_TOKEN=ensayo-verify-token:latest,BOT_WEBHOOK_SECRET=ensayo-webhook-secret:latest' +
    ' --max-instances 1 --min-instances 1 --no-cpu-throttling --memory 1Gi --timeout 300 --allow-unauthenticated'].join('\n'));
}

function webhook() {
  const url = gcloud(['run', 'services', 'describe', SERVICIO, '--region', 'northamerica-south1', '--format=value(status.url)']);
  // Estos dos valores son SOLO del ensayo (se borran al final); Juanma los pega en la app de prueba de Meta.
  console.log('URL de devolución: ' + url + '/webhook?token=' + gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'ensayo-webhook-secret']));
  console.log('Token de verificación: ' + gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'ensayo-verify-token']));
}

async function eventos() {
  const p = await pool();
  try {
    const r = await p.query(`SELECT to_char(recibido AT TIME ZONE 'America/Guatemala', 'HH24:MI:SS') AS h, objeto, modo, resultado, envios, ms, error FROM bot_eventos ORDER BY id DESC LIMIT 30`);
    r.rows.reverse().forEach((x) => console.log([x.h, x.objeto, x.modo, x.resultado, 'envios=' + x.envios, x.ms + 'ms', x.error || ''].join(' · ')));
    const c = await p.query('SELECT id, para, asunto, enviado FROM bot_correos ORDER BY id DESC LIMIT 10');
    c.rows.forEach((x) => console.log('correo ' + x.id + ' · ' + x.asunto + (x.enviado ? ' · enviado' : ' · pendiente (sin Gmail en el ensayo)')));
  } finally { await cerrarPool(p); }
}

function borrar() {
  console.log(['# Al terminar el ensayo (lo de la base de ensayo son solo filas de las tablas bot_* de ese día; el interruptor queda en puente con: node cloud/herramientas/ensayo-bot.js puente):',
    'gcloud run services delete ' + SERVICIO + ' --region northamerica-south1',
    'gcloud secrets delete ensayo-verify-token && gcloud secrets delete ensayo-webhook-secret && gcloud secrets delete ensayo-wa-token',
    'gcloud secrets remove-iam-policy-binding wix-reservas-secreto --member=serviceAccount:' + CUENTA + ' --role=roles/secretmanager.secretAccessor   # el secreto real se queda',
    '# Juanma: borrar la app de prueba en developers.facebook.com y mandar a la papelera la copia "ENSAYO Rosanta Leads".'].join('\n'));
}

const [cmd, a, b, c] = process.argv.slice(2);
const fn = { preparar: () => preparar(a, b, c), publicar: () => publicar(a), webhook, eventos, borrar, puente: () => ponerInterruptor('puente') }[cmd];
if (!fn) { console.log('Uso: preparar <idCopiaLeads> <phoneNumberIdPrueba> <telefonoJuanma> | publicar <idCopiaLeads> | webhook | eventos | borrar'); process.exit(1); }
Promise.resolve(fn()).catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
