#!/usr/bin/env node
/**
 * Corrige el ESTADO de reservas de Marketing OS › reservas que quedaron viejas (21-oct-2026: 11 de agosto que
 * CerrarMesasNoShow cerro en Wix como NO_SHOW sin que llegara el aviso, y 1 FINISHED). Las reenvia por el receptor
 * de siempre (rosanta-nube /hooks/reserva → Apps Script intakeReserva), con la fila ACTUAL de la hoja y solo el
 * estado cambiado: se guarda por id (sin duplicar) y conserva fecha, consumo y consentimiento.
 *
 *   node cloud/herramientas/corregir-estado-reservas.js "<id>=<ESTADO>,<id>=<ESTADO>" [--ejecutar]
 * Sin --ejecutar es en SECO. Despues relee la hoja y verifica.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets: api } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));

if (process.env.TZ !== 'America/Guatemala') throw new Error('Correr con TZ=America/Guatemala');
const MKT = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
const HOOK = 'https://rosanta-nube-512086396641.northamerica-south1.run.app/hooks/reserva';
const ESTADOS = ['NO_SHOW', 'FINISHED', 'SEATED', 'CANCELED', 'RESERVED'];
const pares = String(process.argv[2] || '').split(',').filter(Boolean).map((x) => x.split('='));
if (!pares.length || pares.some(([id, e]) => !id || ESTADOS.indexOf(e) === -1)) throw new Error('Uso: "<id>=<ESTADO>,…" con ESTADO en ' + ESTADOS.join('|'));
const EJECUTAR = process.argv.includes('--ejecutar');
const g = (a) => execFileSync(path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud'), a.concat(['--project', 'rosanta-apps-script']), { encoding: 'utf8' }).trim();
const dia = (x) => (x instanceof Date ? C.codificar([[x]])[0][0].$d.slice(0, 10) : String(x || '').slice(0, 10));

async function leer() {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken',
    { method: 'POST', headers: { Authorization: 'Bearer ' + g(['auth', 'print-access-token']), 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'], lifetime: '600s' }) });
  const a = new OAuth2Client(); a.setCredentials({ access_token: (await r.json()).accessToken });
  return (await C.leerLibro(api({ version: 'v4', auth: a }), MKT, ['reservas'])).reservas;
}

(async () => {
  const M = await leer(), H = M[0].map(String), col = (n) => H.indexOf(n);
  const cuerpos = [];
  for (const [id, estado] of pares) {
    const filas = M.slice(1).filter((f) => String(f[0]) === id);
    if (filas.length !== 1) { console.log('NO ESTÁ (o repetida): ' + id); continue; }
    const f = filas[0];
    const c = { id, fecha: dia(f[col('fecha')]), nombre: String(f[col('nombre')] || ''), email: String(f[col('email')] || ''),
      telefono: String(f[col('telefono')] || ''), personas: Number(f[col('personas')]) || 0, gasto: Number(f[col('gasto')]) || 0,
      estado, optin: String(f[col('optin')] || '') };
    console.log(id.slice(0, 8) + '  ' + c.fecha + '  ' + f[col('estado')] + ' -> ' + estado + '  (personas ' + c.personas + ', gasto ' + c.gasto + ', optin ' + (c.optin || '—') + ')');
    cuerpos.push(c);
  }
  if (!EJECUTAR) { console.log('\nEN SECO: ' + cuerpos.length + '. Para hacerlo: --ejecutar'); return; }
  const llave = g(['secrets', 'versions', 'access', 'latest', '--secret', 'wix-hook-reserva']);
  let ok = 0;
  for (const c of cuerpos) {
    const r = await fetch(HOOK + '?token=' + encodeURIComponent(llave) + '&hook=reserva', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 200 && j.ok && j.actualizada) ok++; else console.log('FALLÓ ' + c.id.slice(0, 8) + ': ' + r.status + ' ' + JSON.stringify(j).slice(0, 150));
    await new Promise((s) => setTimeout(s, 1500));   // la cuota de Sheets del Apps Script
  }
  const M2 = await leer(), iE = M2[0].map(String).indexOf('estado');
  const bien = pares.filter(([id, e]) => M2.some((f) => String(f[0]) === id && f[iE] === e)).length;
  const otras = M2.length - M.length;
  console.log('\nHECHO: ' + ok + ' reenviadas. En la hoja con el estado nuevo: ' + bien + ' de ' + pares.length + '. Filas antes ' + (M.length - 1) + ', ahora ' + (M2.length - 1) + (otras ? ' (entraron ' + otras + ' reservas nuevas mientras tanto)' : ' (sin duplicados)') + '.');
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
