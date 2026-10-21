#!/usr/bin/env node
/**
 * ENSAYO DEL MES CERRADO (19-oct-2026, decision de Juanma): con un mes cerrado, el equipo NO puede corregir,
 * anular ni agregar nada con fecha de ese mes; el dueño si, y queda en la bitacora (tambien lo nuevo).
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



async function poolRoot() {
  const a = new OAuth2Client(); a.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return crearPool({ usuario: 'postgres', base: 'rosanta_ensayo', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']), auth: a });
}
const HOY = C.codificar([[new Date()]])[0][0].$d.slice(0, 10);

(async () => {
  const S = await sheetsComoServidor();
  const P = await pool(), ROOT = await poolRoot();
  try {
    anota(await cambiar(S, { motor_pagos: 'base', motor_caja: 'base', motor_cierres: 'base' }, (ev) => ev.pagos && ev.caja && ev.cierres), 'Pagos, Caja y cierres en base');
    // un gasto de sala ANTES de cerrar el mes, para despues intentar corregirlo
    let w = await llamar(T.sala, 'registrarMovimientoCaja', ['SALIDA', HOY, 'limpieza', 'ENSAYO MC antes de cerrar', 12, '', 'Ferretería']);
    anota(w.status === 200, 'sala anota un gasto con el mes abierto (' + w.status + ')');
    await ROOT.query("INSERT INTO meses_cerrados (mes, cerrado_el, nota) VALUES ($1, current_date, 'ENSAYO MC') ON CONFLICT DO NOTHING", [HOY.slice(0, 7)]);
    const n0 = (await P.query("SELECT count(*)::int n FROM bitacora WHERE mes_cerrado")).rows[0].n;
    w = await llamar(T.sala, 'registrarMovimientoCaja', ['SALIDA', HOY, 'limpieza', 'ENSAYO MC sala con mes cerrado', 10, '', 'Ferretería']);
    anota(w.status === 403 && /mes ya cerrado/.test(w.j.error || ''), 'mes cerrado: sala NO puede agregar un gasto con esa fecha → ' + (w.j.error || w.status));
    w = await llamar(T.sala, 'registrarConteoCaja', [HOY, 999, 'ENSAYO MC conteo']);
    anota(w.status === 403, 'mes cerrado: sala NO puede anotar un conteo → ' + (w.j.error || w.status));
    w = await llamar(T.chef, 'registrarRetiroYCompras', [{ fecha: HOY, retiro: { lugar: 'ATM 603 Despensa Antigua', monto: 100, nota: 'ENSAYO MC' },
      compras: [{ proveedor: 'Mercado', detalle: 'ENSAYO MC tomate', monto: 50, sin_factura: true, area: 'COCINA' }] }]);
    anota(w.status === 403, 'mes cerrado: cocina NO puede anotar una compra en efectivo con esa fecha → ' + (w.j.error || w.status));
    let caja = (await llamar(T.sala, 'getCajaChica')).j.resultado;
    const mov = [].concat(...caja.dias.map((d) => d.movs || d.movimientos || [])).find((m) => /ENSAYO MC antes de cerrar/.test(m.concepto || ''));
    w = await llamar(T.sala, 'anularMovimientoCaja', [mov && mov.id]);
    anota(w.status === 403, 'mes cerrado: sala NO puede anular ni lo suyo → ' + (w.j.error || w.status));
    w = await llamar(T.dueno, 'registrarMovimientoCaja', ['SALIDA', HOY, 'limpieza', 'ENSAYO MC dueño con mes cerrado', 7, '', 'Ferretería']);
    anota(w.status === 200, 'mes cerrado: el dueño SÍ puede agregar (' + w.status + (w.status !== 200 ? ' ' + w.j.error : '') + ')');
    w = await llamar(T.dueno, 'anularMovimientoCaja', [mov && mov.id]);
    anota(w.status === 200, 'mes cerrado: el dueño SÍ puede anular (' + w.status + (w.status !== 200 ? ' ' + w.j.error : '') + ')');
    const b = (await P.query("SELECT accion, antes IS NULL OR antes = 'null'::jsonb AS sin_antes, quien FROM bitacora WHERE mes_cerrado ORDER BY id DESC LIMIT 5")).rows;
    const n1 = (await P.query("SELECT count(*)::int n FROM bitacora WHERE mes_cerrado")).rows[0].n;
    anota(n1 - n0 >= 2 && b.some((x) => x.sin_antes && /dueno/.test(x.quien)) && b.some((x) => x.accion === 'borrar'), 'la bitácora tiene lo del dueño en el mes cerrado (lo nuevo y la anulación): ' + JSON.stringify(b.slice(0, 3)));
    const nada = (await P.query("SELECT count(*)::int n FROM filas_vivas WHERE celdas::text LIKE '%ENSAYO MC sala con mes cerrado%' OR celdas::text LIKE '%ENSAYO MC conteo%'")).rows[0].n;
    anota(nada === 0, 'lo que se negó no quedó en la base (' + nada + ')');
  } finally {
    await ROOT.query("DELETE FROM meses_cerrados WHERE nota = 'ENSAYO MC'");
    await ponerParametros(S, { motor_pagos: 'sheets', motor_caja: 'sheets', motor_cierres: 'sheets' });
    await tarea('refrescar-copia').catch(() => {});
    await cerrarPool(P); await cerrarPool(ROOT);
  }
  console.log('\nRESUMEN: ' + informe.filter((x) => /^OK/.test(x)).length + ' OK · ' + informe.filter((x) => /^FALLA/.test(x)).length + ' FALLAS');
  fs.writeFileSync(path.join(DIR, 'ensayo-mes-cerrado-informe.txt'), informe.join('\n') + '\n');
})().catch((e) => { console.error('ERROR: ' + e.stack); process.exit(1); });
