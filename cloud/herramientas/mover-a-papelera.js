#!/usr/bin/env node
/**
 * Mueve filas de Marketing OS › <pestaña> a la pestaña `papelera`, igual que mktDelete de la intranet
 * (MarketingDatos.js): primero copia la fila ENTERA a papelera (borrado_el, borrado_por, pestana, id,
 * encabezados_json, fila_json) y recien entonces la saca de su pestaña. No borra nada que no haya copiado.
 * Las filas se buscan por su ID (columna A) en el momento, no por numero de fila.
 *
 *   node cloud/herramientas/mover-a-papelera.js <pestana> <id1,id2,...> [--ejecutar] [--por "Nombre"]
 * Sin --ejecutar es en SECO: dice que moveria y no escribe. Necesita que rosanta-nube@ sea Editor de Marketing OS.
 * (20-oct-2026: limpieza de las reservas de prueba, pedido de Juanma por la Central.)
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets: api } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));

const MKT = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
const [pestana, lista] = process.argv.slice(2);
const EJECUTAR = process.argv.includes('--ejecutar');
const iPor = process.argv.indexOf('--por');
const POR = iPor > -1 ? process.argv[iPor + 1] : 'Claude (limpieza aprobada por Juanma)';
if (!pestana || !lista) throw new Error('Uso: mover-a-papelera.js <pestana> <id1,id2,...> [--ejecutar]');
const ids = lista.split(',').map((s) => s.trim()).filter(Boolean);
const g = (a) => execFileSync(path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud'), a.concat(['--project', 'rosanta-apps-script']), { encoding: 'utf8' }).trim();
const PAP = ['borrado_el', 'borrado_por', 'pestana', 'id', 'encabezados_json', 'fila_json'];

(async () => {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken',
    { method: 'POST', headers: { Authorization: 'Bearer ' + g(['auth', 'print-access-token']), 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '900s' }) });
  const a = new OAuth2Client(); a.setCredentials({ access_token: (await r.json()).accessToken });
  const S = api({ version: 'v4', auth: a });
  const meta = await S.spreadsheets.get({ spreadsheetId: MKT, fields: 'sheets.properties(sheetId,title)' });
  const hoja = meta.data.sheets.find((s) => s.properties.title === pestana);
  if (!hoja) throw new Error('No existe la pestaña ' + pestana);
  const M = (await C.leerLibro(S, MKT, [pestana]))[pestana];
  const filas = [];
  for (let i = 1; i < M.length; i++) if (ids.includes(String(M[i][0]).trim())) filas.push({ fila: i + 1, valores: M[i] });
  const faltan = ids.filter((id) => !filas.some((x) => String(x.valores[0]).trim() === id));
  const dobles = ids.filter((id) => filas.filter((x) => String(x.valores[0]).trim() === id).length > 1);
  filas.forEach((x) => console.log('movería fila ' + x.fila + ': ' + x.valores[0] + ' | ' + x.valores[2] + ' | ' + x.valores[7]));
  if (faltan.length) console.log('NO ESTÁN: ' + faltan.join(', '));
  if (dobles.length) throw new Error('ID repetido en la hoja, no muevo nada: ' + dobles.join(', '));
  if (!EJECUTAR) { console.log('\nEN SECO: ' + filas.length + ' filas. Para hacerlo: --ejecutar'); return; }

  // 1) copiar a papelera (la crea con su encabezado si no existe), 2) verificar, 3) recien ahi borrar de abajo hacia arriba
  let pap = meta.data.sheets.find((s) => s.properties.title === 'papelera');
  if (!pap) {
    const rr = await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [{ addSheet: { properties: { title: 'papelera', gridProperties: { frozenRowCount: 1 } } } }] } });
    pap = { properties: rr.data.replies[0].addSheet.properties };
    await S.spreadsheets.values.update({ spreadsheetId: MKT, range: "'papelera'!A1", valueInputOption: 'RAW', requestBody: { values: [PAP] } });
  }
  const ahora = new Date().toISOString();
  const nuevas = filas.map((x) => [ahora, POR, pestana, String(x.valores[0]), JSON.stringify(M[0]), JSON.stringify(x.valores)]);
  await S.spreadsheets.values.append({ spreadsheetId: MKT, range: "'papelera'!A1", valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: nuevas } });
  const P = (await C.leerLibro(S, MKT, ['papelera'])).papelera;
  const copiadas = filas.filter((x) => P.some((p) => p[0] === ahora && p[3] === String(x.valores[0]) && p[5] === JSON.stringify(x.valores)));
  if (copiadas.length !== filas.length) throw new Error('La papelera no tiene las ' + filas.length + ' filas (' + copiadas.length + '): NO borro nada.');
  // releer la pestaña justo antes de borrar: por si entro una fila nueva arriba y corrio los numeros
  const M2 = (await C.leerLibro(S, MKT, [pestana]))[pestana];
  const borrar = [];
  for (let i = 1; i < M2.length; i++) if (ids.includes(String(M2[i][0]).trim())) borrar.push(i);
  borrar.sort((x, y) => y - x);
  await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: borrar.map((i) => ({ deleteDimension: { range: { sheetId: hoja.properties.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })) } });
  const M3 = (await C.leerLibro(S, MKT, [pestana]))[pestana];
  const quedan = M3.filter((f) => ids.includes(String(f[0]).trim())).length;
  console.log('\nHECHO: ' + copiadas.length + ' copiadas a papelera, ' + borrar.length + ' sacadas de ' + pestana + '. Quedan en ' + pestana + ': ' + quedan + '. Filas antes ' + (M.length - 1) + ', ahora ' + (M3.length - 1) + '.');
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
