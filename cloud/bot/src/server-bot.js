/**
 * Arranque de rosanta-bot-sombra en Cloud Run (19-oct-2026): el bot de Rosanta como servicio aparte, en
 * SOMBRA. No recibe mensajes de Meta (Meta manda a una sola direccion: la del bot de produccion); prueba el
 * codigo real del bot reproduciendo los chats guardados. Claves por Secret Manager (DB_CLAVE,
 * CLAVE_TAREAS y, si existe, ANTHROPIC_SOMBRA), nunca en el codigo.
 */
const { GoogleAuth } = require('google-auth-library');
const { crearPool } = require('./db');
const { crearServicioBot, KB_DOC_ID } = require('./servicio-bot');
const { crearAppBot } = require('./app-bot');

/** El texto de la base de conocimiento (Google Doc compartido con el servidor como Lector). Cache 10 min, como el bot. */
function crearLectorKb() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  let cache = null, hasta = 0;
  return async function kb() {
    if (cache && Date.now() < hasta) return cache;
    const cliente = await auth.getClient();
    const r = await cliente.request({ url: 'https://www.googleapis.com/drive/v3/files/' + KB_DOC_ID + '/export?mimeType=text/plain', responseType: 'text' });
    cache = String(r.data).replace(/^﻿/, '');
    hasta = Date.now() + 600000;
    return cache;
  };
}

/**
 * Modo en vivo (19-oct-2026). Solo arranca con MODO_BOT=vivo. Claves del bot desde Secret Manager (BOT_*);
 * el servidor necesita Rosanta Leads como Editor y, para el correo, la autorizacion de Gmail (BOT_GMAIL).
 */
async function prepararVivo(pool) {
  const { sheets } = require('@googleapis/sheets');
  const { crearEspejo } = require('./hojas-vivo');
  const { crearCorreo } = require('./correo-vivo');
  const { crearBotVivo } = require('./vivo');
  const { LEADS_ID } = require('./servicio-bot');
  const falta = ['BOT_WHATSAPP_TOKEN', 'BOT_IG_TOKEN', 'BOT_MESSENGER_TOKEN', 'BOT_ANTHROPIC_KEY', 'BOT_WIX_SECRETO', 'BOT_VERIFY_TOKEN', 'BOT_WEBHOOK_SECRET', 'BOT_APPS_SCRIPT_URL']
    .filter((k) => !process.env[k]);
  if (falta.length) throw new Error('MODO_BOT=vivo sin estas claves: ' + falta.join(', '));
  const cliente = sheets({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) });
  // En el ensayo la hoja es una COPIA de Rosanta Leads (BOT_LEADS_ID); en vivo, la real.
  const leadsId = process.env.BOT_LEADS_ID || LEADS_ID;
  if (process.env.BOT_APPS_SCRIPT_URL === 'ensayo' && leadsId === LEADS_ID) throw new Error('El ensayo no puede escribir en la Rosanta Leads real: falta BOT_LEADS_ID (la copia).');
  const espejo = crearEspejo({ sheets: cliente, id: leadsId });
  await espejo.cargar();
  const w = await pool.query("SELECT valor FROM bot_estado WHERE clave = 'WIX_RESERVAS_URL' AND valor IS NOT NULL");
  if (!w.rows[0]) throw new Error('MODO_BOT=vivo sin el estado del bot importado (falta WIX_RESERVAS_URL en bot_estado).');
  const correo = crearCorreo({ pool, gmail: process.env.BOT_GMAIL ? JSON.parse(process.env.BOT_GMAIL) : null });
  const appsScript = process.env.BOT_APPS_SCRIPT_URL;   // la URL /exec del bot de siempre, con ?token=
  const claves = { WHATSAPP_TOKEN: process.env.BOT_WHATSAPP_TOKEN, IG_TOKEN: process.env.BOT_IG_TOKEN, MESSENGER_TOKEN: process.env.BOT_MESSENGER_TOKEN,
    ANTHROPIC_API_KEY: process.env.BOT_ANTHROPIC_KEY, WIX_RESERVAS_SECRETO: process.env.BOT_WIX_SECRETO };
  // Version nueva de un secreto (solo bot-ig-token: la cuenta del bot tiene secretVersionAdder solo ahi).
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const guardarSecreto = async (nombre, valor) => {
    const c = await auth.getClient();
    await c.request({ url: 'https://secretmanager.googleapis.com/v1/projects/rosanta-apps-script/secrets/' + nombre + ':addVersion', method: 'POST',
      data: { payload: { data: Buffer.from(valor, 'utf8').toString('base64') } } });
  };
  const vivo = crearBotVivo({ pool, espejo, leadsId, kb: crearLectorKb(), wixOrigen: new URL(w.rows[0].valor).origin, claves,
    correo: (m) => correo.enviar(m),
    // En el ENSAYO (BOT_APPS_SCRIPT_URL=ensayo) la red de seguridad NO le pasa nada al bot real: solo queda anotado.
    reenviar: appsScript === 'ensayo'
      ? async (cuerpo) => { await pool.query("INSERT INTO bot_eventos (objeto, modo, resultado, error) VALUES ($1, 'ensayo', 'reenvio_simulado', 'en produccion iria al bot de Apps Script')", [cuerpo && cuerpo.object]); }
      : async (cuerpo) => {
        const r = await fetch(appsScript, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), redirect: 'follow' });
        if (r.status >= 400) throw new Error('El bot de Apps Script contesto ' + r.status);
      } });
  console.log('rosanta-bot-sombra: MODO EN VIVO preparado (interruptor en la base: ' + await vivo.interruptor() + ')');
  const refrescarIg = () => require('./vivo').refrescarTokenIg({ claves, guardarSecreto });
  return { vivo, correo, pool, refrescarIg, verifyToken: process.env.BOT_VERIFY_TOKEN, webhookSecret: process.env.BOT_WEBHOOK_SECRET,
    _paraCorreo: { espejo, leadsId, claves, wixOrigen: new URL(w.rows[0].valor).origin, correo } };
}

/**
 * Canal de correo (20-oct-2026). Solo con MODO_CORREO=si; arranca en 'apps' (no hace nada) hasta que se mueva su interruptor.
 * Con el bot en vivo usa su espejo, sus claves y su correo; sin él, solo puede correr en 'sombra' (lee, no escribe).
 * Gmail: BOT_GMAIL = el secreto gmail-restaurante-oauth ({ client_id, client_secret, refresh_token }).
 */
async function prepararCorreo(pool, kb, vivo) {
  const { crearCanalCorreo } = require('./correo-canal');
  const { crearCorreo } = require('./correo-vivo');
  const { LEADS_ID } = require('./servicio-bot');
  if (!process.env.BOT_GMAIL) throw new Error('MODO_CORREO=si sin BOT_GMAIL (secreto gmail-restaurante-oauth).');
  const gmail = JSON.parse(process.env.BOT_GMAIL);
  const v = vivo && vivo._paraCorreo;
  const correoGmail = v ? v.correo : crearCorreo({ pool, gmail });
  const tokenGmail = v ? crearCorreo({ pool, gmail }).accessToken : correoGmail.accessToken;
  const libroSombra = async () => {   // la copia de Rosanta Leads que guarda la sombra 2 (solo lectura)
    const r = await pool.query('SELECT pestana, filas FROM hojas_copia_f2 WHERE libro = $1', [LEADS_ID]);
    const libro = { Leads: [[]], Conversaciones: [[]], Salientes: [[]] };
    r.rows.forEach((x) => { libro[x.pestana] = typeof x.filas === 'string' ? JSON.parse(x.filas) : x.filas; });
    return libro;
  };
  const canalCorreo = crearCanalCorreo({ pool, kb, accessToken: tokenGmail, libroSombra, soloSombra: !v,
    espejo: v ? v.espejo : { libro: {}, aplicar: async () => 0 }, leadsId: v ? v.leadsId : LEADS_ID,
    wixOrigen: v ? v.wixOrigen : 'https://www.rosanta.rest',
    claves: v ? v.claves : { ANTHROPIC_API_KEY: process.env.BOT_ANTHROPIC_KEY || process.env.ANTHROPIC_SOMBRA, WIX_RESERVAS_SECRETO: process.env.BOT_WIX_SECRETO },
    correo: (m) => correoGmail.enviar(m) });
  console.log('rosanta-bot-sombra: canal de correo preparado (interruptor: ' + await canalCorreo.modo() + ')');
  return { canalCorreo, pool };
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala.');
  const pool = await crearPool();
  const claveModelo = process.env.ANTHROPIC_SOMBRA || '';
  const kb = crearLectorKb();
  const servicio = crearServicioBot({ pool, kb, claveModelo });
  const deps = { servicio, kb, claveTareas: process.env.CLAVE_TAREAS, version: process.env.K_REVISION || 'local', modeloEncendido: !!claveModelo };
  if (process.env.MODO_BOT === 'vivo') Object.assign(deps, await prepararVivo(pool));   // APAGADO: solo con el sí de Juanma
  if (process.env.MODO_CORREO === 'si') Object.assign(deps, await prepararCorreo(pool, kb, deps.vivo ? deps : null));
  const app = crearAppBot(deps);
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-bot-sombra escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
