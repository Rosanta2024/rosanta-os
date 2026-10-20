#!/usr/bin/env node
/**
 * AUTORIZAR UNA CUENTA DE GOOGLE PARA LA NUBE (20-oct-2026). Juanma da el permiso una vez y el refresh token
 * queda en Secret Manager, sin pasar por el chat ni por un archivo del repo.
 *
 *   node cloud/herramientas/autorizar-google.js --cliente <client_secret_….json> --secreto <nombre> --scopes <a,b,c> [--cuenta restaurante@rosanta.rest] [--lectores sa1,sa2]
 *
 * --cliente: el JSON que baja la consola al crear un cliente OAuth de tipo "App de escritorio" (Desktop).
 *            Despues de guardar el secreto, el script lo BORRA del disco (tiene el client_secret).
 * El flujo: abre el navegador en la pantalla de consentimiento de Google; Google vuelve a 127.0.0.1 (este
 * mismo script escucha); se cambia el codigo por el refresh token y se guarda como JSON
 * {client_id, client_secret, refresh_token, cuenta, scopes, creado} en el secreto (version nueva si ya existe).
 * Nunca imprime el token ni el client_secret.
 *
 * Usos previstos (jueves 22-oct):
 *   Gmail para el bot y los procesos: proyecto rosanta-apps-script, --secreto gmail-restaurante-oauth,
 *     --scopes https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/drive.readonly
 *     --lectores rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com,rosanta-bot-sombra@rosanta-apps-script.iam.gserviceaccount.com
 *   Reseñas (Google Business Profile): cliente del proyecto rosanta-gbp-bot, --secreto gbp-oauth,
 *     --scopes https://www.googleapis.com/auth/business.manage
 * La pantalla de consentimiento de cada proyecto tiene que ser "Interna" (organizacion rosanta.rest): con
 * "Externa / prueba" el refresh token vence a los 7 dias.
 */
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const archivo = arg('cliente'), secreto = arg('secreto'), scopes = (arg('scopes') || '').split(',').filter(Boolean);
const cuenta = arg('cuenta') || 'restaurante@rosanta.rest';
// quienes pueden leer el secreto (cuentas de servicio de Cloud Run), separadas por coma
const lectores = (arg('lectores') || 'rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com').split(',').filter(Boolean);
if (lectores.some((x) => !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(x))) throw new Error('--lectores: solo cuentas de servicio.');
if (!archivo || !secreto || !scopes.length) { console.error('Uso: --cliente <json> --secreto <nombre> --scopes <a,b>'); process.exit(2); }
if (!/^[a-z][a-z0-9-]{2,60}$/.test(secreto)) throw new Error('Nombre de secreto invalido.');
if (scopes.some((s) => /cloud-platform/.test(s))) throw new Error('Sin cloud-platform: con ese scope el token vence por la reautenticacion de Workspace.');
const c = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const cli = c.installed || c.web;
if (!cli || !cli.client_id || !cli.client_secret) throw new Error('El JSON no parece un cliente OAuth (falta installed/web).');
if (!c.installed) console.warn('Ojo: el cliente no es de escritorio; la redireccion a 127.0.0.1 puede no estar permitida.');

const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a, entrada) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8', input: entrada, stdio: [entrada ? 'pipe' : 'ignore', 'pipe', 'pipe'] });

const estado = crypto.randomBytes(16).toString('hex');
const verificador = crypto.randomBytes(48).toString('base64url');
const desafio = crypto.createHash('sha256').update(verificador).digest('base64url');

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname !== '/') { res.writeHead(404); return res.end(); }
  const listo = (txt) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<p style="font:18px sans-serif;margin:40px">' + txt + '</p>'); };
  try {
    if (u.searchParams.get('state') !== estado) throw new Error('El estado no coincide.');
    if (u.searchParams.get('error')) throw new Error('Google dijo: ' + u.searchParams.get('error'));
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: u.searchParams.get('code'), client_id: cli.client_id, client_secret: cli.client_secret,
        redirect_uri: redir, grant_type: 'authorization_code', code_verifier: verificador }) });
    const j = await r.json();
    if (!j.refresh_token) throw new Error('Google no devolvio refresh token (' + (j.error || r.status) + ').');
    // la cuenta que autorizo, sin imprimir el token
    const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(j.access_token))).json();
    if (info.email && info.email !== cuenta) throw new Error('Autorizo ' + info.email + ', no ' + cuenta + '. No se guardo nada.');
    const valor = JSON.stringify({ client_id: cli.client_id, client_secret: cli.client_secret, refresh_token: j.refresh_token, cuenta, scopes, creado: new Date().toISOString() });
    let existe = true;
    try { gcloud(['secrets', 'describe', secreto]); } catch (e) { existe = false; }
    if (!existe) gcloud(['secrets', 'create', secreto, '--replication-policy', 'automatic']);
    gcloud(['secrets', 'versions', 'add', secreto, '--data-file=-'], valor);
    for (const sa of lectores) {
      gcloud(['secrets', 'add-iam-policy-binding', secreto, '--member', 'serviceAccount:' + sa, '--role', 'roles/secretmanager.secretAccessor']);
    }
    try { fs.unlinkSync(archivo); } catch (e) { /* si no se puede, se avisa abajo */ }
    listo('Listo: el permiso quedó guardado. Ya puede cerrar esta pestaña.');
    console.log('OK: secreto ' + secreto + (existe ? ' (version nueva)' : ' (creado)') + ' · cuenta ' + (info.email || cuenta) + ' · scopes ' + scopes.length +
      ' · archivo del cliente ' + (fs.existsSync(archivo) ? 'NO se pudo borrar: borrelo a mano' : 'borrado'));
    setTimeout(() => process.exit(0), 300);
  } catch (e) {
    listo('No se pudo: ' + String(e.message || e));
    console.error('FALLA: ' + String(e.message || e));
    setTimeout(() => process.exit(1), 300);
  }
});
let redir;
srv.listen(0, '127.0.0.1', () => {
  redir = 'http://127.0.0.1:' + srv.address().port;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: cli.client_id, redirect_uri: redir, response_type: 'code',
    scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', login_hint: cuenta, state: estado, code_challenge: desafio, code_challenge_method: 'S256' });
  console.log('Abriendo el navegador para que ' + cuenta + ' autorice. Si no se abre, este es el enlace:\n' + url);
  try { spawn('open', [url], { stdio: 'ignore', detached: true }).unref(); } catch (e) { /* queda el enlace impreso */ }
});
setTimeout(() => { console.error('Pasaron 15 minutos sin autorizar. No se guardo nada.'); process.exit(1); }, 15 * 60 * 1000);
