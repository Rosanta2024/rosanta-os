#!/usr/bin/env node
/**
 * ENSAYO DE MARKETING (CONTENIDO Y PAUTA) EN VIVO (20-oct-2026). Nunca toca produccion: servidor
 * rosanta-nube-clientes-ensayo (MARKETING_VIVO=si), base rosanta_ensayo y la hoja de ENSAYO (no Marketing OS).
 *
 *   ENSAYO_URL=... ENSAYO_MKT=<hoja de ensayo> node cloud/herramientas/ensayo-marketing.js
 *
 * (0) siembra la hoja de ensayo con las pestañas de Marketing de Marketing OS (leidas como Lector) y pone
 *     PARAMETROS › motor_marketing = sheets;
 * (A) con sheets: la "intranet" escribe en la hoja, el servidor importa y no guarda (409);
 * (B) se enciende base: las 6 funciones de guardar por /interno/marketing, como lo haria la intranet; cada una
 *     queda en la hoja al contestar, sin duplicados, y base = hoja; lo que escribe "el Ads Script" en la hoja
 *     se respeta; quien no tiene Marketing no escribe;
 * (C) vuelta atras a sheets, con su tiempo.
 * Las personas salen de la tabla usuarios de rosanta_ensayo por rol (dueño y pauta con Marketing, y uno sin).
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets: sheetsApi } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));
const CC = require(path.join(APP, 'src', 'vivo-clientes', 'copiar-clientes'));
const MV = require(path.join(APP, 'src', 'vivo-clientes', 'marketing-vivo'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
const URL = process.env.ENSAYO_URL, MKT = process.env.ENSAYO_MKT;
const REAL = MV.MKT_ID;
if (!URL || !MKT) throw new Error('Faltan ENSAYO_URL y ENSAYO_MKT.');
if (MKT === REAL) throw new Error('ENSAYO_MKT es Marketing OS REAL. El ensayo solo corre sobre la hoja de ensayo.');
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const informe = [];
const anota = (ok, txt) => { informe.push((ok ? 'OK    ' : 'FALLA ') + txt); console.log((ok ? 'OK    ' : 'FALLA ') + txt); };

(async () => {
  const tok = await (await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken',
    { method: 'POST', headers: { Authorization: 'Bearer ' + gcloud(['auth', 'print-access-token']), 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '3600s' }) })).json();
  const a = new OAuth2Client(); a.setCredentials({ access_token: tok.accessToken });
  const S = sheetsApi({ version: 'v4', auth: a });
  const clave = gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'clave-tareas']);
  const auth = new OAuth2Client(); auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const pool = await crearPool({ usuario: 'postgres', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']), base: 'rosanta_ensayo', auth });
  const persona = async (sql) => ((await pool.query(sql)).rows[0] || {}).email;
  const DUENO = await persona("SELECT email FROM usuarios WHERE rol = 'dueno' AND 'marketing' = ANY(modulos) AND puede_editar ORDER BY email LIMIT 1");
  const PAUTA = await persona("SELECT email FROM usuarios WHERE rol = 'pauta' AND 'marketing' = ANY(modulos) AND puede_editar LIMIT 1");
  const SIN = await persona("SELECT email FROM usuarios WHERE NOT ('marketing' = ANY(modulos)) AND NOT ('contenido' = ANY(modulos)) LIMIT 1");
  if (!DUENO || !PAUTA || !SIN) throw new Error('Faltan usuarios de ensayo (dueño y pauta con Marketing, y uno sin).');

  const tarea = (ruta, cuerpo) => fetch(URL + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': clave }, body: JSON.stringify(cuerpo || {}) });
  const guardar = async (email, fn, args) => { const t0 = Date.now(); const r = await tarea('/interno/marketing', { fn, args, email }); const j = await r.json(); return { estado: r.status, j, ms: Date.now() - t0 }; };
  const titulos = async () => (await S.spreadsheets.get({ spreadsheetId: MKT, fields: 'sheets.properties(sheetId,title)' })).data.sheets.map((s) => s.properties);
  const leer = async (ps) => { const t = (await titulos()).map((x) => x.title); return C.leerLibro(S, MKT, ps.filter((p) => t.includes(p))); };
  const fila = async (p, id) => { const L = await leer([p]); return (L[p] || []).find((f, i) => i > 0 && MV.llaveDe(p)(f) === id); };
  const importar = async () => (await (await tarea('/tareas/importar-marketing')).json()).pestanas || [];
  const sinCambios = (imp) => imp.every((x) => !x.nuevas && !x.actualizadas && !x.borradas && !x.problemas.length);
  const ponerModo = async (m) => {
    const P = (await leer(['PARAMETROS'])).PARAMETROS || [];
    const i = P.findIndex((f) => String(f[0]).trim().toLowerCase() === 'motor_marketing');
    const fila1 = i > 0 ? i + 1 : P.length + 1;
    await S.spreadsheets.values.update({ spreadsheetId: MKT, range: "'PARAMETROS'!A" + fila1 + ':B' + fila1, valueInputOption: 'RAW', requestBody: { values: [['motor_marketing', m]] } });
  };

  // (0) siembra
  const real = await C.leerLibro(S, REAL, (await S.spreadsheets.get({ spreadsheetId: REAL, fields: 'sheets.properties.title' })).data.sheets.map((s) => s.properties.title).filter((t) => MV.ESCRIBE.concat(MV.SOLO_LEE).includes(t)));
  let props = await titulos();
  const faltan = Object.keys(real).filter((p) => !props.some((x) => x.title === p)).concat(props.some((x) => x.title === 'papelera') ? [] : []);
  if (faltan.length) await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: faltan.map((p) => ({ addSheet: { properties: { title: p } } })) } });
  const pap = (await titulos()).find((x) => x.title === 'papelera');
  if (pap) await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [{ deleteSheet: { sheetId: pap.sheetId } }] } });   // que el ensayo la cree
  props = await titulos();
  const req1 = [];
  for (const p of Object.keys(real)) {
    const sid = props.find((x) => x.title === p).sheetId;
    req1.push({ updateCells: { range: { sheetId: sid }, fields: 'userEnteredValue' } });
    req1.push({ updateCells: { range: { sheetId: sid, startRowIndex: 0, startColumnIndex: 0 }, rows: real[p].map((f) => ({ values: f.map((x) => CC.celda(x, false)) })), fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
  }
  await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: req1 } });
  await ponerModo('sheets');
  anota(true, '(0) hoja de ensayo sembrada con ' + Object.keys(real).length + ' pestañas de Marketing OS; motor_marketing = sheets');
  await pausa(31000);   // el servidor guarda el interruptor 30 s

  // (A) con sheets
  let imp = await importar();
  anota(imp.length >= 10, '(A) el servidor importa ' + imp.length + ' pestañas: ' + imp.map((x) => x.pestana + ' ' + x.filas_hoja).join(', '));
  let g = await guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'ensayo-c1', date: '2026-11-20', title: 'ENSAYO', estado: 'Idea' }]);
  anota(g.estado === 409, '(A) con sheets el servidor no guarda: ' + g.estado);
  const sid = (await titulos()).find((x) => x.title === 'calendario').sheetId;
  await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [{ appendCells: { sheetId: sid, rows: [{ values: ['ensayo-intranet', '2026-11-21', 'Escrito por la intranet'].map((x) => CC.celda(x, false)) }], fields: 'userEnteredValue' } }] } });
  imp = await importar();
  anota(imp.find((x) => x.pestana === 'calendario').nuevas === 1, '(A) lo que escribe la intranet en la hoja llega a la base');

  // (B) base
  await ponerModo('base');
  const t0 = Date.now();
  do { await pausa(3000); g = await guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'ensayo-c1', date: '2026-11-20', title: 'ENSAYO', tipo: 'VALOR', estado: 'Idea' }]); } while (g.estado === 409 && Date.now() - t0 < 60000);
  anota(g.estado === 200 && g.j.resultado.key === 'ensayo-c1', '(B) encendido en ' + Math.round((Date.now() - t0) / 1000) + ' s; mktUpsert nuevo en ' + g.ms + ' ms');
  let f = await fila('calendario', 'ensayo-c1');
  anota(!!f && f[1] instanceof Date, '(B) la fila esta en la hoja al contestar, con la fecha como fecha');
  g = await guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'ensayo-c1', date: '2026-11-20', title: 'ENSAYO', tipo: 'VALOR', estado: 'Lista', hook: 'h', stdc: 'See', metrica: 'm' }]);
  f = await fila('calendario', 'ensayo-c1');
  anota(g.estado === 200 && g.j.resultado.updated && f[5] === 'Lista', '(B) mktUpsert cambio en ' + g.ms + ' ms, en su lugar');
  g = await guardar(DUENO, 'calGuardarVersion', ['ensayo-v1', [{ id: 'ensayo-c1', date: '2026-11-20', title: 'ENSAYO' }]]);
  anota(g.estado === 200 && !!(await fila('calendario_versiones', 'ensayo-v1|ensayo-c1')), '(B) calGuardarVersion en ' + g.ms + ' ms');
  g = await guardar(DUENO, 'psGuardarSupuesto', [{ afirmacion: 'ENSAYO: supuesto de prueba', estado: 'por_verificar' }]);
  const sId = g.j.resultado && g.j.resultado.id;
  anota(g.estado === 200 && !!(await fila('supuestos', sId)), '(B) psGuardarSupuesto en ' + g.ms + ' ms');
  const reglas = (await leer(['reglas'])).reglas;
  const r0 = reglas.find((x, i) => i > 0 && typeof x[1] === 'number');
  g = await guardar(PAUTA, 'psGuardarRegla', [r0[0], Number(r0[1]) + 1]);
  anota(g.estado === 400 && /dueño/.test(g.j.error), '(B) pauta no cambia reglas: ' + (g.j.error || g.estado));
  g = await guardar(DUENO, 'psGuardarRegla', [r0[0], Number(r0[1]) + 1]);
  anota(g.estado === 200 && (await fila('reglas', r0[0]))[1] === Number(r0[1]) + 1, '(B) psGuardarRegla (dueño) en ' + g.ms + ' ms');
  await guardar(DUENO, 'psGuardarRegla', [r0[0], r0[1]]);
  g = await guardar(PAUTA, 'psGuardarPrueba', [{ hipotesis: 'ENSAYO: hipotesis', cambio: 'ENSAYO: cambio', metrica_juez: 'reservas_negocio' }]);
  anota(g.estado === 200 && !!(await fila('bitacora_pruebas', g.j.resultado && g.j.resultado.id)), '(B) psGuardarPrueba (propuesta) en ' + g.ms + ' ms');
  g = await guardar(SIN, 'mktUpsert', ['calendario', { id: 'ensayo-sin', title: 'no' }]);
  anota(g.estado !== 200 && !(await fila('calendario', 'ensayo-sin')), '(B) quien no tiene Marketing no escribe: ' + g.estado);
  // el Ads Script escribe en pauta_semanal mientras tanto: se respeta
  const ps = (await leer(['pauta_semanal'])).pauta_semanal;
  const psId = (await titulos()).find((x) => x.title === 'pauta_semanal').sheetId;
  const viejo = ps[1][1];
  await S.spreadsheets.batchUpdate({ spreadsheetId: MKT, requestBody: { requests: [{ updateCells: { range: { sheetId: psId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 }, rows: [{ values: [CC.celda(Number(viejo || 0) + 0.5, false)] }], fields: 'userEnteredValue' } }] } });
  imp = await importar();
  anota(imp.find((x) => x.pestana === 'pauta_semanal').actualizadas === 1, '(B) lo que escribe el Ads Script en pauta_semanal llega a la base');
  g = await guardar(DUENO, 'mktDelete', ['calendario', 'ensayo-c1']);
  const papel = (await leer(['papelera'])).papelera || [];
  anota(g.estado === 200 && !(await fila('calendario', 'ensayo-c1')) && papel.length === 2 && papel[1][3] === 'ensayo-c1', '(B) mktDelete en ' + g.ms + ' ms: sale del calendario y la papelera se crea con la fila');
  imp = await importar();
  anota(sinCambios(imp), '(B) base = hoja: importar no encuentra nada distinto ' + JSON.stringify(imp.filter((x) => x.nuevas || x.actualizadas || x.borradas || x.problemas.length)));
  const L = await leer(MV.ESCRIBE);
  const dups = Object.keys(L).filter((p) => { const ks = L[p].slice(1).map(MV.llaveDe(p)).filter(Boolean); return ks.length !== new Set(ks).size; });
  anota(!dups.length || (dups.length === 1 && dups[0] === 'calendario_versiones' && false), '(B) sin llaves repetidas en la hoja' + (dups.length ? ': ' + dups.join(', ') : ''));

  // (C) vuelta atras
  await ponerModo('sheets');
  const t1 = Date.now();
  do { await pausa(3000); g = await guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'ensayo-c2', title: 'despues' }]); } while (g.estado === 200 && Date.now() - t1 < 60000);
  anota(g.estado === 409, '(C) vuelta atras en ' + Math.round((Date.now() - t1) / 1000) + ' s: el servidor deja de guardar');
  await cerrarPool(pool);
  const fallas = informe.filter((x) => x.startsWith('FALLA')).length;
  console.log('\n' + (informe.length - fallas) + '/' + informe.length + ' OK');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
