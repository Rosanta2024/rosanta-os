#!/usr/bin/env node
/**
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

/**
 * La intranet de Apps Script, con su codigo real, sobre la copia que tiene la base de ensayo. Lo que
 * Apps Script da y aca no hay (Gmail, Drive, Claude) se imita; UrlFetchApp es de verdad (curl).
 */
async function intranet(P, gmail) {
  const L = (await C.cargarCopia(P)).libros;
  const M = crearMotor({ libros: L, configId: CFG, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });   // sin editables: si escribe una hoja, falla
  const X = M.ctx, llamadas = { fetch: [], claude: 0, drive: 0 };
  X.NUBE_SERVIDOR_ = undefined;                                   // corre como la intranet: con la cerradura puesta
  X.NUBE_PAGOS_URL_ = URL + '/pagos';                             // al servidor de ENSAYO, no al de produccion
  X.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => ({ CONFIG_SHEET_ID: CFG, NUBE_CLAVE_TAREAS: CLAVE })[k] || null, setProperty: () => {}, deleteProperty: () => {} }) };
  X.UrlFetchApp = { fetch: (url, op) => {
    llamadas.fetch.push(url);
    const a = ['-s', '-o', '-', '-w', '\n%{http_code}', '-X', String(op.method || 'get').toUpperCase(), '-H', 'Content-Type: ' + (op.contentType || 'application/json')];
    Object.keys(op.headers || {}).forEach((h) => a.push('-H', h + ': ' + op.headers[h]));
    if (op.payload) a.push('--data-binary', op.payload);
    const out = execFileSync('curl', a.concat([url]), { encoding: 'utf8' }), i = out.lastIndexOf('\n');
    return { getResponseCode: () => Number(out.slice(i + 1)), getContentText: () => out.slice(0, i) };
  } };
  X.Gmail = { Users: { Messages: {
    list: () => ({ messages: gmail.map((g) => ({ id: g.id })) }),
    get: (_, id) => ({ id, payload: { headers: [{ name: 'Subject', value: 'Cierre de Caja en PosFile 10/13/2026' }], parts: [{ filename: 'cierre.pdf', body: { attachmentId: 'a-' + id } }] } }),
    Attachments: { get: () => ({ data: 'JVBERi0xLjQK' }) } } } };
  X.Utilities.base64Decode = (s) => Array.from(Buffer.from(s, 'base64'));
  X.Utilities.newBlob = (b, mime, nombre) => ({ bytes: b, mime, nombre });
  X._ciePdfTexto_ = () => { llamadas.drive++; return fs.readFileSync(FIXTURE, 'utf8'); };
  X._cieComensalesReserva_ = () => 0;
  X._cpeGuardarArchivo_ = () => { llamadas.drive++; return 'https://drive.google.com/ensayo-foto'; };
  X.claudeLlamar_ = () => { llamadas.claude++; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ compras: [{ proveedor: 'Mercado', detalle: 'ENSAYO tomate', total: 45, nit: '', factura: '' }] }) }] }; };
  return { M, llamadas };
}

(async () => {
  const S = await sheetsComoServidor();
  const P = await pool();
  const SALA = { email: 'prueba-sala@ensayo.rosanta', rol: 'sala', modulos: ['pagos'], nombre: 'Prueba Sala' };
  const CHEF = { email: 'prueba-chef@ensayo.rosanta', rol: 'chef', modulos: ['pagos'], nombre: 'Prueba Chef' };
  const ID = 'ENSAYO-PUENTE-' + Date.now();
  try {
    const listo = await cambiar(S, { motor_pagos: 'base', motor_caja: 'base', motor_cierres: 'base' }, (ev) => ev.pagos && ev.caja && ev.cierres);
    anota(listo, 'Pagos, Caja y cierres en base en el servidor de ensayo');

    // 3. el servidor no las corre: van por el puente a la intranet
    for (const [tok, fn, args] of [[T.sala, 'leerCierresCaja', []], [T.chef, 'leerComprobanteCompra', [[{ nombre: 'f.jpg', mime: 'image/jpeg', datos: 'AAAA' }]]]]) {
      const w = await llamar(tok, fn, args);
      anota(w.status === 409, 'el servidor nuevo NO corre ' + fn + ' (' + w.status + ': ' + (w.j.error || '') + ')');
    }

    // la pantalla nueva publicada trae el puente (y solo para esas dos funciones)
    for (const pag of ['caja', 'compras']) {
      const h = await (await fetch(URL + '/' + pag + '?u=' + encodeURIComponent(T.sala) + '&dentro=1')).text();
      anota(/ROSANTA_PUENTE/.test(h) && /leerCierresCaja: 1, leerComprobanteCompra: 1/.test(h), 'la pantalla /' + pag + ' del ensayo trae el puente');
    }
    // una fecha mal escrita se rechaza (antes entraba como fecha invalida)
    const malo = await fetch(URL + '/tareas/cierre', { method: 'POST', headers: { 'x-rosanta-tarea': CLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fila: ['2026-12-30', 1, { $d: "2026-10-18'T'19:14:09" }] }) });
    anota(malo.status === 400, 'un cierre con una fecha mal escrita se rechaza (' + malo.status + ')');

    // 1. "Leer cierres" con el codigo real de la intranet
    const antes = (await P.query("SELECT count(*)::int n FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS'")).rows[0].n;
    let I = await intranet(P, [{ id: ID }]);
    anota(I.M.ctx.cierresMotor_() === 'base' && I.M.ctx.cajaMotor_() === 'base', 'la intranet ve motor_cierres = base y motor_caja = base');
    let r, t0 = Date.now();
    try { r = I.M.correr(SALA, 'leerCierresCaja', []); } catch (e) { r = { error: e.message }; }
    const lect = r.resultado && r.resultado.lectura_ahora;
    anota(!r.error && lect && lect.nuevos === 1 && !lect.errores.length, '"Leer cierres" corre en la intranet sin rechazo (' + (Date.now() - t0) + ' ms): ' +
      (r.error || JSON.stringify(lect)));
    anota(r.escrituras && Object.keys(r.escrituras).length === 0, 'la intranet no escribió ninguna hoja (escribe el servidor): ' + JSON.stringify(r.escrituras || {}));
    anota(I.llamadas.fetch.length === 1 && /rosanta-nube-ensayo.*\/tareas\/cierre$/.test(I.llamadas.fetch[0]), 'el cierre se mandó al servidor: ' + I.llamadas.fetch.join(', '));
    anota(r.resultado && Array.isArray(r.resultado.dias), 'devuelve la caja para pintar la pantalla (' + (r.resultado && r.resultado.dias ? r.resultado.dias.length + ' días' : 'sin caja') + ')');
    let fila = (await P.query("SELECT llave, celdas, origen FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS' AND celdas::text LIKE $1", ['%' + ID + '%'])).rows;
    anota(fila.length === 1 && fila[0].llave === '2026-10-13' && fila[0].origen === 'servidor', 'el cierre está en la base: ' + fila.map((x) => x.llave + ' (' + x.origen + ')').join(', '));
    const iL = (await C.cargarCopia(P)).libros[CFG].CIERRES_DIARIOS[0].indexOf('LEIDO');
    anota(fila.length === 1 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test((fila[0].celdas[iL] || {}).$d || ''), 'la hora de lectura (LEIDO) llega como fecha válida: ' + JSON.stringify(fila[0] && fila[0].celdas[iL]));
    const despues = (await P.query("SELECT count(*)::int n FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS'")).rows[0].n;

    // otra vez (el vigia de la hora siguiente, o alguien que toca de nuevo): no duplica
    await espera(6000);
    await tarea('refrescar-copia');
    I = await intranet(P, [{ id: ID + '-B' }]);
    try { r = I.M.correr(SALA, 'leerCierresCaja', []); } catch (e) { r = { error: e.message }; }
    anota(!r.error && r.resultado.lectura_ahora.nuevos === 1, 'leer otra vez el mismo día: sin rechazo (' + (r.error || JSON.stringify(r.resultado.lectura_ahora)) + ')');
    const n2 = (await P.query("SELECT count(*)::int n FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS' AND llave = '2026-10-13'")).rows[0].n;
    const total2 = (await P.query("SELECT count(*)::int n FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS'")).rows[0].n;
    anota(n2 === 1 && total2 === despues, 'una sola fila del 13-oct en la base (' + n2 + '); filas antes ' + antes + ', después ' + despues + ', al releer ' + total2);

    // la copia de la hoja: el cierre llega y no se repite
    await espera(6000);
    const r2 = await tarea('refrescar-copia');
    anota(r2.status === 200, 'refresco del servidor sin problemas (' + r2.status + ')' + (r2.status !== 200 ? ' → ' + JSON.stringify({ importacion: r2.j.importacion, importacion_caja: r2.j.importacion_caja, copia_hoja: r2.j.copia_hoja }).slice(0, 1500) : ''));
    const hoja = C.matrizDeFilas(((await S.spreadsheets.get({ spreadsheetId: CFG, ranges: ["'CIERRES_DIARIOS'"], includeGridData: true,
      fields: 'sheets(data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type))' })).data.sheets[0].data[0] || {}).rowData);
    const iF = hoja[0].indexOf('FECHA'), iM = hoja[0].indexOf('MENSAJE_ID');
    const fechas = hoja.slice(1).map((f) => IMP.llave(f[iF])).filter(Boolean);
    const dup = fechas.filter((x, i) => fechas.indexOf(x) !== i);
    const del13 = hoja.slice(1).filter((f) => IMP.llave(f[iF]) === '2026-10-13');
    anota(del13.length === 1 && String(del13[0][iM]) === ID + '-B', 'la hoja tiene el 13-oct una sola vez, con la última lectura (' + del13.map((f) => f[iM]).join(', ') + ')');
    anota(dup.length === 0, 'la hoja no tiene fechas repetidas (' + fechas.length + ' filas)' + (dup.length ? ': ' + dup.join(', ') : ''));
    const base = (await P.query("SELECT llave AS id, celdas FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS'")).rows.map((x) => ({ id: x.id, celdas: x.celdas, origen: 'hoja' }));
    const plan = IMP.planificar(hoja, base, { llave: 'FECHA' });
    anota(plan.nuevas.length + plan.actualizadas.length + plan.problemas.length === 0, 'base = hoja en CIERRES_DIARIOS (' + base.length + ' en la base)' +
      (plan.nuevas.length + plan.actualizadas.length ? ' → faltan ' + plan.nuevas.length + ', distintas ' + plan.actualizadas.length + ' ' + JSON.stringify(plan.actualizadas.slice(0, 2)).slice(0, 1500) + ' | base: ' + JSON.stringify(base.filter((b) => plan.actualizadas.some((a) => (a.id || a.llave) === b.id)).slice(0, 2)).slice(0, 1500) : ''));

    // 2. la foto del comprobante con el codigo real de la intranet
    I = await intranet(P, []);
    try { r = I.M.correr(CHEF, 'leerComprobanteCompra', [[{ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'AAAA' }]]); } catch (e) { r = { error: e.message }; }
    anota(!r.error && r.resultado.compras.length === 1 && r.resultado.archivo_url, 'leer la foto del comprobante corre en la intranet sin rechazo: ' + (r.error || JSON.stringify(r.resultado.compras)));
    anota(r.escrituras && Object.keys(r.escrituras).length === 0 && I.llamadas.fetch.length === 0, 'no escribe ninguna hoja ni manda nada al servidor (lo guarda el usuario después, en la pantalla nueva)');
  } finally {
    await ponerParametros(S, { motor_pagos: 'sheets', motor_caja: 'sheets', motor_cierres: 'sheets' });
    await tarea('refrescar-copia').catch(() => {});
    await cerrarPool(P);
  }
  console.log('\nRESUMEN: ' + informe.filter((x) => /^OK/.test(x)).length + ' OK · ' + informe.filter((x) => /^FALLA/.test(x)).length + ' FALLAS');
  fs.writeFileSync(path.join(DIR, 'ensayo-puente-informe.txt'), informe.join('\n') + '\n');
})().catch((e) => { console.error('ERROR: ' + e.stack); process.exit(1); });
