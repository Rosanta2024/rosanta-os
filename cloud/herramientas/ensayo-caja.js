#!/usr/bin/env node
/**
 * ENSAYO DEL MODO EN VIVO DE CAJA CHICA, COMPRAS Y CIERRES (18-oct-2026, pedido de Juanma). Nunca toca
 * produccion: servidor rosanta-nube-ensayo, base rosanta_ensayo y la COPIA de Config (la misma del
 * ensayo de Pagos). Usa los usuarios de prueba que dejo ensayo-vivo.js.
 *
 *   ENSAYO_URL=... ENSAYO_CONFIG_ID=<copia> ENSAYO_DIR=<carpeta con ensayo-tokens.json> node cloud/herramientas/ensayo-caja.js
 *
 * "La intranet escribiendo" se simula con el CODIGO REAL de Caja chica y Compras (el motor en modo
 * intranet, sobre la copia que tiene la base de ensayo), y sus filas se escriben en la copia de la hoja
 * con los tipos exactos, como lo haria setValues de Apps Script.
 *
 * Combinaciones: (A) Pagos en base + Caja en sheets (la intranet escribe, el servidor importa);
 * (B) Pagos + Caja + cierres en base (el servidor guarda); (C) vuelta atras de cada interruptor, con su
 * tiempo, y la intranet escribiendo otra vez. En cada una: base = hoja, sin duplicados ni faltantes.
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
const EH = require(path.join(APP, 'src', 'escribir-hoja'));
const { crearMotor } = require(path.join(APP, 'src', 'motor-pagos'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));

const URL = process.env.ENSAYO_URL, CFG = process.env.ENSAYO_CONFIG_ID, DIR = process.env.ENSAYO_DIR || '/tmp';
if (!URL || !CFG) throw new Error('Faltan ENSAYO_URL y ENSAYO_CONFIG_ID.');
if (CFG === '1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw') throw new Error('ENSAYO_CONFIG_ID es la hoja REAL. El ensayo solo corre sobre una copia.');
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const T = JSON.parse(fs.readFileSync(path.join(DIR, 'ensayo-tokens.json'), 'utf8'));
const informe = [];
const anota = (ok, txt) => { informe.push((ok ? 'OK    ' : 'FALLA ') + txt); console.log((ok ? 'OK    ' : 'FALLA ') + txt); };
const HOY = C.codificar([[new Date()]])[0][0].$d.slice(0, 10);
const PEST = { PAGOS_PROVEEDORES: 'ID', CAJA_CHICA: 'ID', RETIROS_SOLICITUDES: 'ID', CIERRES_DIARIOS: 'FECHA' };

async function sheetsComoServidor() {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken', {
    method: 'POST', headers: { Authorization: 'Bearer ' + gcloud(['auth', 'print-access-token']), 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '3600s' }) });
  const j = await r.json();
  const a = new OAuth2Client(); a.setCredentials({ access_token: j.accessToken });
  return sheetsApi({ version: 'v4', auth: a });
}
async function pool(usuario) {
  const a = new OAuth2Client(); a.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  return crearPool({ usuario, base: 'rosanta_ensayo', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', usuario === 'app' ? 'db-app' : 'db-postgres-root']), auth: a });
}
const clave = () => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'clave-tareas']);
async function tarea(nombre, cuerpo) {
  const r = await fetch(URL + '/tareas/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': clave(), 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { status: r.status, j: await r.json() };
}
async function llamar(tok, fn, args) {
  const t0 = Date.now();
  const r = await fetch(URL + '/api/llamar/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok }, body: JSON.stringify(args || []) });
  return { status: r.status, j: await r.json(), ms: Date.now() - t0 };
}
async function ponerParametros(S, valores) {
  const v = (await S.spreadsheets.values.get({ spreadsheetId: CFG, range: 'PARAMETROS!A:B' })).data.values || [];
  for (const k of Object.keys(valores)) {
    const i = v.findIndex((r) => String(r[0] || '').trim() === k);
    if (i >= 0) await S.spreadsheets.values.update({ spreadsheetId: CFG, range: 'PARAMETROS!B' + (i + 1), valueInputOption: 'RAW', requestBody: { values: [[valores[k]]] } });
    else { await S.spreadsheets.values.append({ spreadsheetId: CFG, range: 'PARAMETROS!A:B', valueInputOption: 'RAW', requestBody: { values: [[k, valores[k]]] } }); v.push([k, valores[k]]); }
  }
}
/** Pone los interruptores y refresca hasta que el servidor los tome; devuelve los ms. */
async function cambiar(S, valores, espera) {
  await ponerParametros(S, valores);
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    const r = await tarea('refrescar-copia');
    const ev = r.j.en_vivo || {};
    if (espera(ev)) return { ms: Date.now() - t0, ev, r };
  }
  return { ms: null };
}

/**
 * La intranet escribiendo: corre `fn` con el codigo REAL en modo intranet (sobre la copia que tiene la
 * base de ensayo) y escribe en la copia de la hoja las filas que toco, con los tipos exactos.
 */
async function laIntranet(S, P, usuario, fn, args) {
  const copia = await C.cargarCopia(P);
  const L = copia.libros, cfg = L[CFG];
  const m0 = crearMotor({ libros: L, configId: CFG, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  if (!cfg.CAJA_CHICA) cfg.CAJA_CHICA = [m0.ctx.CCH_COLS_.slice()];
  if (!cfg.RETIROS_SOLICITUDES) cfg.RETIROS_SOLICITUDES = [m0.ctx.CPE_SOL_COLS_.slice()];
  const M = crearMotor({ libros: L, configId: CFG, editables: { [CFG]: Object.keys(PEST) }, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  M.ctx.NUBE_SERVIDOR_ = undefined;                         // corre como la intranet
  M.ctx._cchLeerSiFaltan_ = () => null;                     // sin Gmail
  M.ctx.cchSincronizarMaestro_ = () => ({ escrito: false }); // sin escribir el maestro
  const r = M.correr(usuario, fn, args);
  for (const k of Object.keys(r.escrituras)) {
    const p = k.slice(k.indexOf('|') + 1), V = M.ctx.SpreadsheetApp.openById(CFG).getSheetByName(p).getDataRange().getValues();
    const iK = V[0].indexOf(PEST[p]);
    await EH.copiarFilas(S, CFG, r.escrituras[k].map((n) => ({ id: IMP.llave(V[n - 1][iK]), fila: V[n - 1] })), { pestana: p, llave: PEST[p], encabezado: V[0], llaveEsFecha: PEST[p] === 'FECHA' });
  }
  return r;
}

/** Base = hoja en las cuatro pestañas: mismas filas, sin repetidos ni faltantes. */
async function baseIgualHoja(S, P, etiqueta) {
  const g = await S.spreadsheets.get({ spreadsheetId: CFG, ranges: Object.keys(PEST).map((p) => "'" + p + "'"), includeGridData: true,
    fields: 'sheets(properties.title,data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type))' }).catch(async () => {
    const meta = await S.spreadsheets.get({ spreadsheetId: CFG, fields: 'sheets.properties.title' });
    const hay = new Set(meta.data.sheets.map((x) => x.properties.title));
    return S.spreadsheets.get({ spreadsheetId: CFG, ranges: Object.keys(PEST).filter((p) => hay.has(p)).map((p) => "'" + p + "'"), includeGridData: true,
      fields: 'sheets(properties.title,data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type))' });
  });
  for (const s of g.data.sheets) {
    const p = s.properties.title, hoja = C.matrizDeFilas(((s.data || [])[0] || {}).rowData);
    const iK = (hoja[0] || []).indexOf(PEST[p]);
    const ids = hoja.slice(1).map((f) => IMP.llave(f[iK]));
    const dup = ids.filter((x, i) => x && ids.indexOf(x) !== i);
    const base = p === 'PAGOS_PROVEEDORES'
      ? (await P.query('SELECT id, celdas FROM pagos_proveedores')).rows.map((x) => ({ id: x.id, celdas: x.celdas, origen: 'hoja' }))
      : (await P.query('SELECT llave AS id, celdas FROM filas_vivas WHERE pestana = $1', [p])).rows.map((x) => ({ id: x.id, celdas: x.celdas, origen: 'hoja' }));
    const plan = IMP.planificar(hoja, base, { llave: PEST[p] });
    const mal = plan.nuevas.length + plan.actualizadas.length + plan.problemas.length + dup.length;
    anota(mal === 0, etiqueta + ' · ' + p + ': base = hoja (' + ids.length + ' filas)' + (mal ? ' → faltan en la base ' + plan.nuevas.length + ', distintas ' +
      plan.actualizadas.length + ', repetidas ' + dup.length + ' ' + plan.problemas.slice(0, 3).join(' | ') : ''));
  }
}

(async () => {
  const S = await sheetsComoServidor();
  const P = await pool('app'), ROOT = await pool('postgres');
  const SALA = { email: 'prueba-sala@ensayo.rosanta', rol: 'sala', modulos: ['pagos'], nombre: 'Prueba Sala' };
  const CHEF = { email: 'prueba-chef@ensayo.rosanta', rol: 'chef', modulos: ['pagos'], nombre: 'Prueba Chef' };
  try {
    // (A) Pagos en base + Caja en sheets: la intranet anota, el servidor importa
    let c = await cambiar(S, { motor_pagos: 'base', motor_caja: 'sheets', motor_cierres: 'sheets' }, (ev) => ev.pagos && !ev.caja);
    anota(c.ms !== null, 'A. Pagos en base, Caja en sheets (' + c.ms + ' ms)');
    let w = await llamar(T.sala, 'registrarMovimientoCaja', ['SALIDA', HOY, 'barra', 'ENSAYO A limones', 25, '', 'Mercado']);
    anota(w.status === 409, 'A. el servidor NO anota caja con Caja en sheets (' + w.status + ')');
    await laIntranet(S, P, SALA, 'registrarMovimientoCaja', ['SALIDA', HOY, 'barra', 'ENSAYO A limones (intranet)', 25, '', 'Mercado']);
    await laIntranet(S, P, CHEF, 'registrarRetiroYCompras', [{ fecha: HOY, retiro: { lugar: 'ATM 603 Despensa Antigua', monto: 300, nota: 'ENSAYO A' },
      compras: [{ proveedor: 'Mercado', detalle: 'ENSAYO A tomate (intranet)', monto: 120, sin_factura: true, area: 'COCINA' }] }]);
    let r = await tarea('refrescar-copia');
    const imp = (r.j.importacion_caja || []).concat([r.j.importacion || {}]);
    anota(r.status === 200 && imp.every((x) => !x.problemas || !x.problemas.length), 'A. lo que anota la intranet entra a la base: ' +
      imp.map((x) => (x.pestana || 'PAGOS') + ' +' + (x.nuevas || 0)).join(', '));
    await baseIgualHoja(S, P, 'A');

    // (B) Caja y cierres en base: el servidor guarda
    c = await cambiar(S, { motor_caja: 'base', motor_cierres: 'base' }, (ev) => ev.pagos && ev.caja && ev.cierres);
    anota(c.ms !== null, 'B. Caja y cierres en base (' + c.ms + ' ms)');
    const tiempos = [];
    // limpieza y mantenimiento quedan en CAJA_CHICA; barra va a PAGOS_PROVEEDORES (compra sin factura pagada de la caja)
    for (const [cat, txt, q] of [['limpieza', 'ENSAYO B hielo', 40], ['limpieza', 'ENSAYO B jabón', 35.5], ['mantenimiento', 'ENSAYO B foco', 22], ['barra', 'ENSAYO B limones', 18]]) {
      w = await llamar(T.sala, 'registrarMovimientoCaja', ['SALIDA', HOY, cat, txt, q, '', 'Ferretería']); tiempos.push(w.ms);
      anota(w.status === 200, 'B. caja chica: gasto "' + txt + '" (' + w.ms + ' ms)' + (w.status !== 200 ? ' → ' + w.j.error : ''));
    }
    w = await llamar(T.sala, 'registrarConteoCaja', [HOY, 1234.5, 'ENSAYO B conteo']); tiempos.push(w.ms);
    anota(w.status === 200, 'B. conteo de la caja (' + w.ms + ' ms)' + (w.status !== 200 ? ' → ' + w.j.error : ''));
    w = await llamar(T.chef, 'registrarRetiroYCompras', [{ fecha: HOY, retiro: { lugar: 'ATM 095 Agencia Recolección Antigua', monto: 500, nota: 'ENSAYO B' },
      compras: [{ proveedor: 'Mercado', detalle: 'ENSAYO B cebolla', monto: 80, sin_factura: true, area: 'COCINA' },
                { proveedor: 'Carnicería Nueva Concepción', detalle: 'ENSAYO B carne', monto: 260, sin_factura: true, area: 'COCINA' }] }]); tiempos.push(w.ms);
    anota(w.status === 200, 'B. compra en efectivo con su retiro (' + w.ms + ' ms)' + (w.status !== 200 ? ' → ' + w.j.error : ''));
    anota(tiempos.every((t) => t < 1000), 'B. cada guardado en menos de 1 s: ' + tiempos.join(', ') + ' ms');
    // corregir lo propio / lo ajeno
    let caja = (await llamar(T.sala, 'getCajaChica')).j.resultado;
    const movs = [].concat(...caja.dias.map((d) => d.movs || d.movimientos || []));
    const propio = movs.find((m) => /ENSAYO B jabón/.test(m.concepto || ''));
    w = await llamar(T.sala, 'anularMovimientoCaja', [propio && propio.id]);
    anota(w.status === 200, 'B. sala anula su propio gasto' + (w.status !== 200 ? ' → ' + w.j.error : ''));
    const ajeno = movs.find((m) => m.id && m.por && !/^Prueba/.test(m.por) && !/^ANULADO/.test(m.estatus || ''));
    w = await llamar(T.sala, 'anularMovimientoCaja', [ajeno && ajeno.id]);
    anota(w.status === 400 && /dueño/.test(w.j.error || ''), 'B. sala intenta anular lo de ' + (ajeno && ajeno.por) + ': se niega → ' + (w.j.error || w.status));
    // mes cerrado: solo el dueño
    await ROOT.query("INSERT INTO meses_cerrados (mes, cerrado_el, nota) VALUES ($1, current_date, 'ENSAYO') ON CONFLICT DO NOTHING", [HOY.slice(0, 7)]);
    caja = (await llamar(T.sala, 'getCajaChica')).j.resultado;
    const hielo = [].concat(...caja.dias.map((d) => d.movs || d.movimientos || [])).find((m) => /ENSAYO B hielo/.test(m.concepto || ''));
    w = await llamar(T.sala, 'anularMovimientoCaja', [hielo && hielo.id]);
    anota(w.status === 403 && /mes ya cerrado/.test(w.j.error || ''), 'B. mes cerrado: sala NO puede anular ni lo suyo → ' + (w.j.error || w.status));
    w = await llamar(T.dueno, 'anularMovimientoCaja', [hielo && hielo.id]);
    anota(w.status === 200, 'B. mes cerrado: el dueño sí puede' + (w.status !== 200 ? ' → ' + w.j.error : ''));
    await ROOT.query("DELETE FROM meses_cerrados WHERE nota = 'ENSAYO'");
    // un cierre del dia (lo que mandaria el lector de la intranet); fecha del ensayo, lejos de las reales
    const encCie = (await S.spreadsheets.values.get({ spreadsheetId: CFG, range: "'CIERRES_DIARIOS'!1:1" })).data.values[0];
    const filaCie = encCie.map((h) => ({ FECHA: '2026-12-31', GRAN_TOTAL: 4321, SIN_PROPINA: 3900, PROPINA: 421, TARJETA: 3000, EFECTIVO: 1321, CUADRA: 'SI',
      MENSAJE_ID: 'ENSAYO', LEIDO: { $d: HOY + 'T22:15:00' }, FORMATO: 'ensayo' })[h] ?? '');
    r = await tarea('cierre', { fila: filaCie });
    anota(r.status === 200 && r.j.fecha === '2026-12-31', 'B. un cierre del día llega al servidor y se guarda (' + JSON.stringify(r.j) + ')');
    r = await tarea('cierre', { fila: filaCie });
    anota(r.status === 200 && r.j.nuevo === false, 'B. el mismo cierre otra vez no se duplica (lo reemplaza)');
    await new Promise((ok) => setTimeout(ok, 5000));
    r = await tarea('refrescar-copia');
    anota(r.status === 200, 'B. refresco con todo en base: importación sin problemas');
    await baseIgualHoja(S, P, 'B');
    const bit = await P.query("SELECT parte, accion, count(*)::int n FROM bitacora WHERE quien LIKE 'prueba-%' AND parte = 'caja' GROUP BY 1,2");
    anota(bit.rows.length > 0, 'B. bitácora de caja: ' + JSON.stringify(bit.rows));

    // (C) vuelta atras, interruptor por interruptor
    c = await cambiar(S, { motor_caja: 'sheets' }, (ev) => ev.pagos && !ev.caja);
    anota(c.ms !== null, 'C. vuelta atrás de Caja (sheets) en ' + c.ms + ' ms');
    w = await llamar(T.sala, 'registrarMovimientoCaja', ['SALIDA', HOY, 'barra', 'x', 1, '', '']);
    anota(w.status === 409, 'C. el servidor ya no anota caja (' + w.status + ')');
    await laIntranet(S, P, SALA, 'registrarMovimientoCaja', ['SALIDA', HOY, 'barra', 'ENSAYO C hielo (intranet otra vez)', 30, '', 'Mercado']);
    r = await tarea('refrescar-copia');
    anota(r.status === 200, 'C. la intranet vuelve a anotar caja y entra a la base: ' + (r.j.importacion_caja || []).map((x) => x.pestana + ' +' + x.nuevas).join(', '));
    c = await cambiar(S, { motor_cierres: 'sheets' }, (ev) => !ev.cierres);
    anota(c.ms !== null, 'C. vuelta atrás de los cierres (sheets) en ' + c.ms + ' ms');
    r = await tarea('cierre', { fila: filaCie });
    anota(r.status === 409, 'C. con cierres en sheets, el servidor ya no los recibe (' + r.status + ')');
    c = await cambiar(S, { motor_pagos: 'sheets' }, (ev) => !ev.pagos);
    anota(c.ms !== null, 'C. vuelta atrás de Pagos (sheets) en ' + c.ms + ' ms');
    await baseIgualHoja(S, P, 'C');
  } finally { await cerrarPool(P); await cerrarPool(ROOT); }
  console.log('\nRESUMEN: ' + informe.filter((x) => /^OK/.test(x)).length + ' OK · ' + informe.filter((x) => /^FALLA/.test(x)).length + ' FALLAS');
  fs.writeFileSync(path.join(DIR, 'ensayo-caja-informe.txt'), informe.join('\n') + '\n');
})().catch((e) => { console.error('ERROR: ' + e.stack); process.exit(1); });
