#!/usr/bin/env node
/**
 * Reservas pedidas por el restaurante, por la API de Wix y con el registro del bot (Manual.js, 19-oct-2026).
 * Para la Central o para quien atienda un pedido como el de Louise: nada de abrir el panel de Wix.
 *
 *   node scripts/reserva-bot.js buscar   --nombre Thomas            (o --email / --telefono, --fecha 2026-10-26)
 *   node scripts/reserva-bot.js cambiar  --id <id de buscar> --fecha 2026-10-25 --hora 18:00 [--personas 3] [--nota "Pidió mesa adentro"]
 *   node scripts/reserva-bot.js cancelar --email x@y.com --fecha 2026-10-26 [--hora 17:30]
 *   opciones: --avisar-cliente (le manda al cliente el correo de siempre; por defecto NO se le escribe)
 *             --quien Central  (queda en el registro)
 *
 * El secreto es el WIX_RESERVAS_SECRETO del bot, guardado en Secret Manager como wix-reservas-secreto.
 * Nunca se imprime ni va en la línea de comandos.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const BOT = 'https://script.google.com/macros/s/AKfycbw0PnfbHHtxaCH8tZtYT0yMHFAsT1h2uZXZ1pz2GC_wiaOAWD8CZ5WoU2DVwtpK0DvIAg/exec?accion=reserva';
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');

const [accion, ...resto] = process.argv.slice(2);
if (!['buscar', 'cambiar', 'cancelar'].includes(accion)) {
  console.log('Uso: buscar | cambiar | cancelar  (ver la cabecera del archivo)');
  process.exit(1);
}
const p = { accion, quien: 'Central' };
for (let i = 0; i < resto.length; i++) {
  const k = resto[i].replace(/^--/, '');
  if (k === 'avisar-cliente') { p.avisar_cliente = true; continue; }
  p[k] = resto[++i];
}
if (accion === 'cambiar') console.log('Pedido: ' + JSON.stringify(p));

const secreto = execFileSync(GCLOUD, ['secrets', 'versions', 'access', 'latest', '--secret', 'wix-reservas-secreto', '--project', 'rosanta-apps-script'],
  { encoding: 'utf8', env: Object.assign({ CLOUDSDK_PYTHON: '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' }, process.env), stdio: ['ignore', 'pipe', 'pipe'] }).trim();

fetch(BOT, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ secreto }, p)) })
  .then((r) => r.text())
  .then((t) => {
    let o; try { o = JSON.parse(t); } catch (e) { console.error('Respuesta rara del bot: ' + t.slice(0, 200)); process.exit(2); }
    console.log(JSON.stringify(o, null, 1));
    process.exit(o.ok ? 0 : 3);
  })
  .catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
