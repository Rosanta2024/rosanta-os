#!/usr/bin/env node
/**
 * ENSAYO DE LOS PROCESOS EN SOMBRA (20-oct-2026): FEL, banco y "Leer cierres" leen el Gmail REAL (solo
 * lectura) desde el servidor de ensayo y comparan con la copia de Config. Nunca escriben.
 *
 * (Encabezado compartido con el ensayo de la compensacion.)
 * ENSAYO DE LA COMPENSACION (19-oct-2026, plan acelerado: 1 semana de sombra). Con Pagos, Caja y cierres
 * en base: la comparacion de cada noche y la conciliacion del cierre de mes salen limpias en caja,
 * retiros, cierres y pagos; y si alguien cambia a mano una celda de la hoja, las dos lo detectan (409).
 * 07_Caja_Chica: el ensayo lee el maestro REAL (solo lectura) y su base es otra, asi que ahi SI tiene que
 * haber diferencias (las filas ENSAYO): sirve de control de que la revision de 07 mira de verdad.
 *
 * (Lo que sigue es el encabezado del ensayo del puente, que comparte las herramientas.)
 * ENSAYO DE LOS DOS BOTONES QUE SIGUE CORRIENDO LA INTRANET (18-oct-2026, condicion de Juanma a la
 * Decision 2: "Leer cierres se usa a diario"). Con motor_pagos, motor_caja y motor_cierres = base:
 *
 *   1. "Leer cierres" (leerCierresCaja) corre con el CODIGO REAL de la intranet (motor en modo intranet).
 *      Gmail, Drive y la conversion del PDF se imitan: el texto es un cierre real de PosFile
 *      (tools/harness-intranet/fixtures). El envio al servidor (nubeGuardarCierre_) es DE VERDAD: un POST
 *      al servidor de ensayo con la clave de tareas. Se comprueba que no lo rechaza la cerradura de un
 *      solo escritor, que el cierre queda en la base y en la copia de la hoja, y que leerlo dos veces no
 *      duplica.
 *   2. Leer la foto de un comprobante (leerComprobanteCompra) con el codigo real; Claude y Drive se imitan.
 *      Se comprueba que no lo rechaza y que no escribe ninguna hoja.
 *   3. El servidor nuevo NO corre esas dos funciones (409): las corre la intranet, por el puente.
 *
 * Nunca toca produccion: servidor rosanta-nube-ensayo, base rosanta_ensayo y la COPIA de Config.
 *   ENSAYO_URL=... ENSAYO_CONFIG_ID=<copia> ENSAYO_DIR=<carpeta con ensayo-tokens.json> node cloud/herramientas/ensayo-puente.js
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets: sheetsApi } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));
const IMP = require(path.join(APP, 'src', 'importar-pagos'));
const { crearMotor } = require(path.join(APP, 'src', 'motor-pagos'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));

const URL = process.env.ENSAYO_URL, CFG = process.env.ENSAYO_CONFIG_ID, DIR = process.env.ENSAYO_DIR || '/tmp';
if (!URL || !CFG) throw new Error('Faltan ENSAYO_URL y ENSAYO_CONFIG_ID.');
if (CFG === '1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw') throw new Error('ENSAYO_CONFIG_ID es la hoja REAL. El ensayo solo corre sobre una copia.');
if (!/rosanta-nube-ensayo/.test(URL)) throw new Error('ENSAYO_URL no es el servidor de ensayo.');
const FIXTURE = path.join(process.env.HOME, 'Dev', 'Rosanta', 'tools', 'harness-intranet', 'fixtures', 'cierre_drive_2026-10-13.txt');
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const T = JSON.parse(fs.readFileSync(path.join(DIR, 'ensayo-tokens.json'), 'utf8'));
const informe = [];
const anota = (ok, txt) => { informe.push((ok ? 'OK    ' : 'FALLA ') + txt); console.log((ok ? 'OK    ' : 'FALLA ') + txt); };
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function sheetsComoServidor() {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken', {
    method: 'POST', headers: { Authorization: 'Bearer ' + gcloud(['auth', 'print-access-token']), 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '3600s' }) });
  const j = await r.json();
  const a = new OAuth2Client(); a.setCredentials({ access_token: j.accessToken });
  return sheetsApi({ version: 'v4', auth: a });
}
async function pool() {
  const a = new OAuth2Client(); a.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return crearPool({ usuario: 'app', base: 'rosanta_ensayo', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-app']), auth: a });
}
const CLAVE = gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'clave-tareas']);
async function tarea(nombre) {
  const r = await fetch(URL + '/tareas/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': CLAVE } });
  return { status: r.status, j: await r.json() };
}
async function llamar(tok, fn, args) {
  const r = await fetch(URL + '/api/llamar/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok }, body: JSON.stringify(args || []) });
  return { status: r.status, j: await r.json() };
}
async function ponerParametros(S, valores) {
  const v = (await S.spreadsheets.values.get({ spreadsheetId: CFG, range: 'PARAMETROS!A:B' })).data.values || [];
  for (const k of Object.keys(valores)) {
    const i = v.findIndex((r) => String(r[0] || '').trim() === k);
    if (i >= 0) await S.spreadsheets.values.update({ spreadsheetId: CFG, range: 'PARAMETROS!B' + (i + 1), valueInputOption: 'RAW', requestBody: { values: [[valores[k]]] } });
    else { await S.spreadsheets.values.append({ spreadsheetId: CFG, range: 'PARAMETROS!A:B', valueInputOption: 'RAW', requestBody: { values: [[k, valores[k]]] } }); v.push([k, valores[k]]); }
  }
}
async function cambiar(S, valores, listo) {
  await ponerParametros(S, valores);
  for (let i = 0; i < 6; i++) { const r = await tarea('refrescar-copia'); if (listo(r.j.en_vivo || {})) return true; }
  return false;
}



async function tareaCon(nombre, cuerpo) {
  const r = await fetch(URL + '/tareas/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': CLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { j = { error: 'sin json' }; }
  return { status: r.status, j };
}
(async () => {
  const S = await sheetsComoServidor();
  try {
    await ponerParametros(S, { proc_fel: 'sombra', proc_banco: 'sombra', proc_cierres: 'sombra' });
    await tarea('refrescar-copia');
    for (const p of ['fel', 'banco', 'cierres']) {
      const t0 = Date.now(); const r = await tareaCon('procesos/' + p, { dias: 10 });
      const j = r.j, res = JSON.stringify({ modo: j.modo, leidos: j.leidos, faltan_en_hoja: j.nuevas_que_faltan_en_hoja, distintas: (j.distintas || j.distintos || []).length, iguales: j.iguales, errores: (j.errores || []).length, error: j.error }).slice(0, 400);
      anota(r.status === 200 || r.status === 409, p + ' en sombra contra el Gmail real (' + r.status + ', ' + (Date.now() - t0) + ' ms): ' + res);
      if ((j.distintas || j.distintos || []).length) console.log('   detalle: ' + JSON.stringify(j.distintas || j.distintos).slice(0, 800));
      if ((j.errores || []).length) console.log('   errores: ' + JSON.stringify(j.errores).slice(0, 600));
    }
  } finally {
    await ponerParametros(S, { proc_fel: 'apps', proc_banco: 'apps', proc_cierres: 'apps' });
    await tarea('refrescar-copia').catch(() => {});
  }
  console.log('\nRESUMEN: ' + informe.filter((x) => /^OK/.test(x)).length + ' OK · ' + informe.filter((x) => /^FALLA/.test(x)).length + ' FALLAS');
})().catch((e) => { console.error('ERROR: ' + e.stack); process.exit(1); });
