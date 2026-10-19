#!/usr/bin/env node
/**
 * ENSAYO DEL PIPELINE DE EVENTOS EN VIVO (19-oct-2026, plan acelerado de Juanma). Nunca toca produccion:
 * servidor rosanta-nube-clientes-ensayo, base rosanta_ensayo (tabla filas_clientes) y la hoja de ENSAYO
 * (no Marketing OS). Usa los usuarios de prueba del ensayo del Estudio (ensayo-tokens.json: dueno, chef, sala).
 *
 *   ENSAYO_URL=... ENSAYO_MKT=<hoja de ensayo> ENSAYO_DIR=<carpeta con ensayo-tokens.json> node cloud/herramientas/ensayo-clientes.js
 *
 * Pasos: (0) sembrar la hoja de ensayo con el pipeline real (cotizaciones y revisiones de Marketing OS,
 * leido como Lector) y PARAMETROS con motor_eventos = sheets; (A) con sheets: la "intranet" y la revision
 * diaria escriben en la hoja con el CODIGO REAL (Cotizaciones.js) y el servidor importa; el servidor no
 * guarda (409); (B) se enciende base: pantalla (dueño y sala) y hook de la revision diaria guardan por el
 * servidor, se copia a la hoja; version vieja rechazada; sala no corrige lo ajeno; conflicto si alguien
 * escribe en la hoja; (C) vuelta atras a sheets, con su tiempo, y la hoja vuelve a mandar. En cada paso:
 * base = hoja, sin duplicados ni faltantes.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets: sheetsApi } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));
const EH = require(path.join(APP, 'src', 'escribir-hoja'));
const { crearMotor } = require(path.join(APP, 'src', 'motor-pagos'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));

const URL = process.env.ENSAYO_URL, MKT = process.env.ENSAYO_MKT, DIR = process.env.ENSAYO_DIR || '/tmp';
const REAL = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
if (!URL || !MKT) throw new Error('Faltan ENSAYO_URL y ENSAYO_MKT.');
if (MKT === REAL) throw new Error('ENSAYO_MKT es Marketing OS REAL. El ensayo solo corre sobre la hoja de ensayo.');
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const T = JSON.parse(fs.readFileSync(path.join(DIR, 'ensayo-tokens.json'), 'utf8'));
const informe = [];
const anota = (ok, txt) => { informe.push((ok ? 'OK    ' : 'FALLA ') + txt); console.log((ok ? 'OK    ' : 'FALLA ') + txt); };
const PEST = { cotizaciones: 'id', revisiones: 'fecha' };

async function sheetsComoServidor() {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken', {
    method: 'POST', headers: { Authorization: 'Bearer ' + gcloud(['auth', 'print-access-token']), 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '3600s' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error('Sin permiso del servidor: ' + JSON.stringify(j).slice(0, 200));
  const a = new OAuth2Client(); a.setCredentials({ access_token: j.accessToken });
  return sheetsApi({ version: 'v4', auth: a });
}
async function poolRoot() {
  const a = new OAuth2Client(); a.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return crearPool({ usuario: 'postgres', base: 'rosanta_ensayo', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']), auth: a });
}
const claveTareas = () => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'clave-tareas']);
const claveHook = () => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'cotiz-token-ensayo']);
async function tarea(nombre) {
  const r = await fetch(URL + '/tareas/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': claveTareas() } });
  return { status: r.status, j: await r.json() };
}
async function llamar(tok, fn, args) {
  const t0 = Date.now();
  const r = await fetch(URL + '/api/llamar/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok }, body: JSON.stringify(args || []) });
  return { status: r.status, j: await r.json(), ms: Date.now() - t0 };
}
async function hook(cuerpo) {
  const t0 = Date.now();
  const r = await fetch(URL + '/hooks/cotizaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token: claveHook() }, cuerpo)) });
  return { status: r.status, j: await r.json(), ms: Date.now() - t0 };
}

/** Escribe una pestaña completa (con tipos exactos) en la hoja de ensayo, creandola si falta. */
async function escribirPestana(S, nombre, matriz) {
  const meta = await S.spreadsheets.get({ spreadsheetId: MKT, fields: 'sheets.properties(sheetId,title)' });
  let h = meta.data.sheets.find((s) => s.properties.title === nombre);
  if (!h) {
    const r = await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [{ addSheet: { properties: { title: nombre } } }] } });
    h = { properties: r.data.replies[0].addSheet.properties };
  }
  const ancho = matriz.reduce((a, f) => Math.max(a, f.length), 1);
  await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [
    { updateCells: { range: { sheetId: h.properties.sheetId }, fields: 'userEnteredValue,userEnteredFormat.numberFormat' } },
    { updateCells: { range: { sheetId: h.properties.sheetId, startRowIndex: 0, startColumnIndex: 0 },
      rows: matriz.map((f) => ({ values: Array.from({ length: ancho }, (_, j) => EH.celda(f[j] === undefined ? '' : f[j], false)) })),
      fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }] } });
}
const ponerInterruptor = (S, v) => escribirPestana(S, 'PARAMETROS', [['Parámetro', 'Valor'], ['motor_eventos', v]]);

/** "La intranet / Apps Script escribe": el codigo real de Cotizaciones.js sobre la hoja de ensayo, y la fila a la hoja. */
async function escribeAppsScript(S, fn) {
  const L = await C.leerLibro(S, MKT, Object.keys(PEST));
  const m = crearMotor({ libros: { [MKT]: L }, configId: 'x', editables: { [MKT]: Object.keys(PEST) }, listas: ['LISTA-VIVO-CLIENTES.txt'] });
  m.ctx.SHEET_ID = MKT; m.ctx.MKT_SHEET_ID = MKT;
  m.ctx.__x = () => fn(m.ctx);
  const r = m.correr({ email: 'apps@script', rol: 'dueno', modulos: [], nombre: 'Apps Script' }, '__x', []);
  for (const k of Object.keys(r.escrituras)) {
    const p = k.split('|')[1], H = L[p][0].map(String), iL = H.indexOf(PEST[p]);
    await EH.copiarFilas(S, MKT, r.escrituras[k].map((f) => ({ id: String(L[p][f - 1][iL]), fila: L[p][f - 1] })), { pestana: p, llave: PEST[p] });
  }
  return r.resultado;
}

/** base = hoja: mismas llaves, una sola vez cada una, y mismas celdas. */
async function baseIgualHoja(S, pool, etiqueta) {
  const L = await C.leerLibro(S, MKT, Object.keys(PEST));
  for (const p of Object.keys(PEST)) {
    const H = L[p][0].map(String), iL = H.indexOf(PEST[p]);
    const hoja = L[p].slice(1).map((f) => [String(f[iL]).trim(), JSON.stringify(C.codificar([f])[0])]);
    const llavesHoja = hoja.map((x) => x[0]);
    const r = await pool.query('SELECT llave, celdas FROM filas_clientes WHERE pestana = $1', [p]);
    const base = new Map(r.rows.map((x) => [x.llave, JSON.stringify(x.celdas)]));
    const dup = llavesHoja.filter((x, i) => llavesHoja.indexOf(x) !== i);
    const faltan = llavesHoja.filter((x) => !base.has(x)), sobran = [...base.keys()].filter((x) => llavesHoja.indexOf(x) < 0);
    const distintas = hoja.filter(([k, c]) => base.has(k) && base.get(k) !== c).map((x) => x[0]);
    anota(!dup.length && !faltan.length && !sobran.length && !distintas.length,
      etiqueta + ' · ' + p + ': base = hoja (' + base.size + ' filas' + (dup.length ? ', repetidas ' + dup : '') + (faltan.length ? ', faltan en la base ' + faltan : '') +
      (sobran.length ? ', sobran ' + sobran : '') + (distintas.length ? ', distintas ' + distintas : '') + ')');
  }
}

async function main() {
  const S = await sheetsComoServidor();
  const pool = await poolRoot();
  try {
    // (0) sembrar la hoja de ensayo con el pipeline real (leido como Lector) e interruptor en sheets
    const real = await C.leerLibro(S, REAL, Object.keys(PEST));
    for (const p of Object.keys(PEST)) await escribirPestana(S, p, real[p]);
    await ponerInterruptor(S, 'sheets');
    anota(real.cotizaciones.length > 10, 'Hoja de ensayo sembrada con el pipeline real: ' + (real.cotizaciones.length - 1) + ' cotizaciones, ' + (real.revisiones.length - 1) + ' revisiones');

    // (A) con sheets
    let t = await tarea('importar');
    anota(t.status === 200 && t.j.modo === 'sheets', 'Importar con sheets: ' + JSON.stringify((t.j.pestanas || []).map((x) => [x.pestana, x.nuevas, x.actualizadas, x.problemas.length])));
    await baseIgualHoja(S, pool, 'A0');
    let r = await llamar(T.dueno, 'guardarEventos', [[{ op: 'set', id: 'ensayo-a', data: { cliente: 'Ensayo A' } }]]);
    anota(r.status === 409, 'Con sheets el servidor no guarda desde la pantalla (409)');
    r = await hook({ accion: 'batch', writes: [] });
    anota(r.status === 409, 'Con sheets el hook no guarda (409)');
    r = await hook({ accion: 'list' });
    anota(r.status === 200 && r.j.ok && r.j.filas.length === real.cotizaciones.length - 1, 'Con sheets el hook lee (list: ' + (r.j.filas || []).length + ' filas)');
    const x = await escribeAppsScript(S, (c) => c.cotEscribir_([{ op: 'set', id: 'ensayo-apps-script', data: { cliente: 'Escrita por Apps Script', etapa: 'consulta', estado: 'consulta' } }]));
    anota(x.ok, 'La revision diaria (codigo real de Marketing OS) escribe en la hoja');
    t = await tarea('importar');
    anota(t.status === 200 && t.j.pestanas[0].nuevas === 1, 'El servidor la trae a la base');
    await baseIgualHoja(S, pool, 'A1');

    // (B) se enciende base
    const t0 = Date.now();
    await ponerInterruptor(S, 'base');
    t = await tarea('importar');
    anota(t.status === 200 && t.j.modo === 'base', 'Encendido: motor_eventos = base (' + (Date.now() - t0) + ' ms)');
    const tiempos = [];
    r = await llamar(T.dueno, 'guardarEventos', [[{ op: 'set', id: 'ensayo-dueno', data: { cliente: 'Ensayo dueño', etapa: 'consulta', estado: 'consulta', pax: 30 } }]]);
    tiempos.push(r.ms);
    anota(r.status === 200 && r.j.resultado.ok, 'El dueño guarda una consulta por el servidor (' + r.ms + ' ms)');
    r = await llamar(T.sala, 'guardarEventos', [[{ op: 'set', id: 'ensayo-sala', data: { cliente: 'Ensayo sala', etapa: 'consulta', estado: 'consulta' } }]]);
    tiempos.push(r.ms);
    anota(r.status === 200 && r.j.resultado.ok, 'Sala ingresa una consulta (' + r.ms + ' ms)');
    r = await llamar(T.sala, 'guardarEventos', [[{ op: 'update', id: 'ensayo-dueno', data: { notas: 'x' }, if_version: 1 }]]);
    anota(r.status === 200 && r.j.resultado.ok === false, 'Sala NO corrige lo que anotó el dueño: ' + (r.j.resultado && r.j.resultado.error));
    r = await llamar(T.chef, 'getEventos', []);
    anota(r.status === 403, 'Cocina no ve el pipeline (403)');
    r = await llamar(T.dueno, 'guardarEventos', [[{ op: 'update', id: 'ensayo-dueno', data: { notas: 'vieja' }, if_version: 7 }]]);
    anota(r.status === 200 && r.j.resultado.ok === false, 'Version vieja: no se escribe nada (' + (r.j.resultado && r.j.resultado.error) + ')');
    r = await hook({ accion: 'batch', writes: [{ op: 'update', id: 'ensayo-dueno', if_version: 1, data: { etapa: 'cotizada', estado: 'cotizada', toques: 1 } }] });
    tiempos.push(r.ms);
    anota(r.status === 200 && r.j.ok && r.j.versiones['ensayo-dueno'] === 2, 'La revision diaria escribe por el hook del servidor, mismo contrato (' + r.ms + ' ms)');
    r = await hook({ accion: 'revision', revision: { fecha: '2099-01-01', hora: '07:15', resumen: 'ensayo', contestaron: 0, borradores: 0 } });
    anota(r.j.ok === true, 'El hook guarda la revision del dia');
    r = await hook({ accion: 'revision', revision: { fecha: '2099-01-01', hora: '07:20', resumen: 'ensayo 2', contestaron: 0, borradores: 0 } });
    anota(r.j.ok === true, 'La misma fecha reemplaza, no duplica');
    r = await hook({ token: 'otra', accion: 'list' });
    anota(r.j.error === 'unauthorized', 'El hook con otra clave: unauthorized');
    t = await tarea('copiar');
    anota(t.status === 200, 'Copia a la hoja (' + t.j.copiadas + ' pendientes)');
    await baseIgualHoja(S, pool, 'B1');
    t = await tarea('importar');
    anota(t.j.pestanas.every((p) => p.nuevas === 0 && p.actualizadas === 0 && !p.problemas.length), 'Importar otra vez no cambia nada');
    // alguien escribe en la hoja una fila del servidor: conflicto, no se pisa
    const L = await C.leerLibro(S, MKT, ['cotizaciones']);
    const H = L.cotizaciones[0].map(String), fila = L.cotizaciones.findIndex((f) => f[0] === 'ensayo-dueno');
    const cambiada = L.cotizaciones[fila].slice(); cambiada[H.indexOf('notas')] = 'escrito a mano en la hoja';
    await EH.copiarFilas(S, MKT, [{ id: 'ensayo-dueno', fila: cambiada }], { pestana: 'cotizaciones', llave: 'id' });
    t = await tarea('importar');
    anota(t.j.pestanas[0].problemas.some((p) => /Conflicto en ensayo-dueno/.test(p)), 'Escribir a mano en la hoja con base: CONFLICTO, la base no se pisa');
    // la siguiente escritura del servidor deja la hoja otra vez igual a la base
    r = await llamar(T.dueno, 'guardarEventos', [[{ op: 'update', id: 'ensayo-dueno', data: { notas: 'corregido desde la pantalla' }, if_version: 2 }]]);
    tiempos.push(r.ms);
    await tarea('copiar');
    await baseIgualHoja(S, pool, 'B2');

    // (C) vuelta atras
    const t1 = Date.now();
    await ponerInterruptor(S, 'sheets');
    t = await tarea('importar');
    anota(t.j.modo === 'sheets', 'Vuelta atras: motor_eventos = sheets (' + (Date.now() - t1) + ' ms)');
    r = await llamar(T.dueno, 'guardarEventos', [[{ op: 'set', id: 'ensayo-c', data: { cliente: 'C' } }]]);
    anota(r.status === 409, 'El servidor deja de guardar (409)');
    const y = await escribeAppsScript(S, (c) => c.cotEscribir_([{ op: 'update', id: 'ensayo-sala', if_version: 1, data: { notas: 'otra vez desde Apps Script' } }]));
    anota(y.ok, 'Apps Script vuelve a escribir (una fila que habia escrito el servidor)');
    t = await tarea('importar');
    anota(t.j.pestanas[0].actualizadas === 1 && !t.j.pestanas[0].problemas.length, 'Con sheets la hoja manda: se trae sin conflicto');
    await baseIgualHoja(S, pool, 'C1');
    anota(tiempos.every((ms) => ms < 1500), 'Guardados desde la Mac: ' + tiempos.join(', ') + ' ms');
  } finally { await cerrarPool(pool); }
  const fallas = informe.filter((l) => l.startsWith('FALLA')).length;
  console.log('\nENSAYO CLIENTES: ' + (informe.length - fallas) + '/' + informe.length + (fallas ? ' · ' + fallas + ' FALLAS' : ''));
  fs.writeFileSync(path.join(DIR, 'ensayo-clientes-informe.txt'), informe.join('\n') + '\n');
  process.exitCode = fallas ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(1); });
