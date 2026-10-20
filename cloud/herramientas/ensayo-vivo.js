#!/usr/bin/env node
/**
 * ENSAYO DEL MODO EN VIVO DE PAGOS (18-oct-2026, pedido de Juanma). Nunca toca produccion:
 *   - servidor rosanta-nube-ensayo (Cloud Run), base rosanta_ensayo (aparte de rosanta);
 *   - una COPIA de Rosanta_Intranet_Config (ENSAYO_CONFIG_ID), compartida con rosanta-nube@ como Editor.
 * El maestro y COMPRAS_2026 se leen igual que en produccion (solo lectura).
 *
 *   ENSAYO_URL=https://rosanta-nube-ensayo-...run.app ENSAYO_CONFIG_ID=<copia> node cloud/herramientas/ensayo-vivo.js
 *
 * Pasos: (0) interruptor en sheets, copiar e importar; (1) encender base; (2) guardar como chef y sala:
 * abono, el resto (fraccionado), dos facturas juntas, anular lo propio, anular lo ajeno (debe negarse),
 * una compra; (3) simular Caja/Compras escribiendo en la hoja (una compra nueva y una anulacion);
 * (4) revisar base = hoja, sin duplicados ni faltantes, y la bitacora; (5) volver atras (sheets), medir,
 * simular la intranet escribiendo de nuevo y revisar todo otra vez. Imprime un informe; no imprime claves.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { sheets: sheetsApi } = require(path.join(APP, 'node_modules', '@googleapis', 'sheets'));
const C = require(path.join(APP, 'src', 'copia-hojas'));
const IMP = require(path.join(APP, 'src', 'importar-pagos'));

const URL = process.env.ENSAYO_URL, CFG = process.env.ENSAYO_CONFIG_ID;
if (!URL || !CFG) throw new Error('Faltan ENSAYO_URL y ENSAYO_CONFIG_ID.');
if (CFG === '1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw') throw new Error('ENSAYO_CONFIG_ID es la hoja REAL. El ensayo solo corre sobre una copia.');
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const SA = 'rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com';
const TOKENS = path.join(process.env.ENSAYO_DIR || '/tmp', 'ensayo-tokens.json');
const informe = [];
const anota = (ok, txt) => { informe.push((ok ? 'OK    ' : 'FALLA ') + txt); console.log((ok ? 'OK    ' : 'FALLA ') + txt); };

async function sheetsComoServidor() {
  const user = gcloud(['auth', 'print-access-token']);
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' + SA + ':generateAccessToken', {
    method: 'POST', headers: { Authorization: 'Bearer ' + user, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets'], lifetime: '3600s' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error('No pude obtener el permiso del servidor: ' + JSON.stringify(j).slice(0, 200));
  const a = new OAuth2Client(); a.setCredentials({ access_token: j.accessToken });
  return sheetsApi({ version: 'v4', auth: a });
}

const clave = () => gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'clave-tareas']);
async function tarea(nombre) {
  const r = await fetch(URL + '/tareas/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': clave() } });
  return { status: r.status, j: await r.json() };
}
async function llamar(tok, fn, args) {
  const t0 = Date.now();
  const r = await fetch(URL + '/api/llamar/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok }, body: JSON.stringify(args || []) });
  const j = await r.json();
  return { status: r.status, j, ms: Date.now() - t0 };
}
async function salud() { return (await (await fetch(URL + '/salud')).json()).pagos; }

/** Escribe un valor de PARAMETROS en la copia (agrega la fila si no esta). */
async function ponerParametro(S, nombre, valor) {
  const v = (await S.spreadsheets.values.get({ spreadsheetId: CFG, range: 'PARAMETROS!A:B' })).data.values || [];
  const i = v.findIndex((r) => String(r[0] || '').trim() === nombre);
  if (i >= 0) await S.spreadsheets.values.update({ spreadsheetId: CFG, range: 'PARAMETROS!B' + (i + 1), valueInputOption: 'RAW', requestBody: { values: [[valor]] } });
  else await S.spreadsheets.values.append({ spreadsheetId: CFG, range: 'PARAMETROS!A:B', valueInputOption: 'RAW', requestBody: { values: [[nombre, valor]] } });
}

/** Usuarios de prueba en la COPIA (tokens generados aca; se guardan solo en un archivo local, 600). */
async function usuariosDePrueba(S) {
  let T = fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, 'utf8')) : null;
  if (!T) {
    T = { dueno: crypto.randomBytes(12).toString('hex'), chef: crypto.randomBytes(12).toString('hex'), sala: crypto.randomBytes(12).toString('hex') };
    fs.writeFileSync(TOKENS, JSON.stringify(T)); fs.chmodSync(TOKENS, 0o600);
    await S.spreadsheets.values.append({ spreadsheetId: CFG, range: 'USUARIOS!A:F', valueInputOption: 'RAW', requestBody: { values: [
      ['prueba-dueno@ensayo.rosanta', 'dueno', 'pagos', 'SI', 'Prueba Dueño', T.dueno],
      ['prueba-chef@ensayo.rosanta', 'chef', 'pagos', 'NO', 'Prueba Chef', T.chef],
      ['prueba-sala@ensayo.rosanta', 'sala', 'pagos', 'NO', 'Prueba Sala', T.sala]] } });
  }
  return T;
}

/** Filas de PAGOS_PROVEEDORES de la copia (como getValues) y de la base de ensayo, por ID. */
async function compararBaseHoja(S, etiqueta) {
  const g = await S.spreadsheets.get({ spreadsheetId: CFG, ranges: ["'PAGOS_PROVEEDORES'"], includeGridData: true,
    fields: 'sheets(data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type))' });
  const hoja = C.matrizDeFilas(g.data.sheets[0].data[0].rowData);
  const H = hoja[0], iId = H.indexOf('ID');
  const ids = hoja.slice(1).map((f) => IMP.llave(f[iId]));
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  anota(dup.length === 0, etiqueta + ': la hoja no tiene IDs repetidos (' + ids.length + ' filas)' + (dup.length ? ' → ' + dup.join(',') : ''));
  const r = await tarea('comparar-pagos');
  anota(r.status === 200 && r.j.ok, etiqueta + ': comparación (base = hoja, Pagos desde la base = desde la hoja)' + (r.j.diferencias && r.j.diferencias.length ? ' → ' + r.j.diferencias.slice(0, 5).join(' | ') : ''));
  return { hoja, ids };
}

async function esperarModo(modo, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await tarea('refrescar-copia');
    if ((await salud()).modo === modo) return Date.now() - t0;
  }
  return null;
}

(async () => {
  const S = await sheetsComoServidor();
  const T = await usuariosDePrueba(S);
  // (0) interruptor en sheets, todo copiado e importado
  await ponerParametro(S, 'motor_pagos', 'sheets');
  let r = await tarea('sincronizar-usuarios'); anota(r.status === 200, '0. usuarios copiados a la base de ensayo (' + (r.j.usuarios || 0) + ')');
  r = await tarea('refrescar-copia'); anota(r.status === 200 && r.j.modo === 'sombra', '0. con sheets: sombra, importacion ' + JSON.stringify(r.j.importacion && { nuevas: r.j.importacion.nuevas, problemas: r.j.importacion.problemas.length }));
  const w0 = await llamar(T.chef, 'registrarPagoFacturas', [['x'], 'Pagado de caja', '2026-10-18']);
  anota(w0.status === 409, '0. en sombra, guardar se niega (' + w0.status + ')');

  // (1) encender
  await ponerParametro(S, 'motor_pagos', 'base');
  const tEnc = await esperarModo('vivo', 60000);
  anota(tEnc !== null, '1. interruptor en base → modo en vivo en ' + tEnc + ' ms');

  // (2) guardar
  const P = (await llamar(T.chef, 'getPagosProveedores')).j.resultado;
  const pend = P.facturas.filter((f) => f.estado === 'Pendiente' && f.saldo > 20);
  const porNit = {}; pend.forEach((f) => { (porNit[f.nit] = porNit[f.nit] || []).push(f); });
  const dos = Object.values(porNit).find((l) => l.length >= 2);
  const una = pend.find((f) => !dos || dos.indexOf(f) === -1);
  if (!una || !dos) throw new Error('No hay facturas pendientes de cocina suficientes en la copia para el ensayo.');
  const tiempos = [];
  const abono = Math.round(una.saldo * 40) / 100;
  let w = await llamar(T.chef, 'registrarPagoFacturas', [[una.llave], 'Pagado de caja', '2026-10-18', abono, 0, 'ENSAYO abono']); tiempos.push(w.ms);
  anota(w.status === 200 && /Abono guardado/.test(w.j.resultado.resumen), '2a. abono ' + una.dte + ': ' + (w.j.resultado ? w.j.resultado.resumen : w.j.error) + ' (' + w.ms + ' ms)');
  w = await llamar(T.chef, 'registrarPagoFacturas', [[una.llave], 'Tarjeta', '2026-10-18', null, 0, 'ENSAYO resto', 'Tarjeta crédito BAC']); tiempos.push(w.ms);
  const fUna = w.j.resultado && w.j.resultado.facturas.find((f) => f.llave === una.llave);
  anota(w.status === 200 && fUna && fUna.saldo <= 0.01, '2b. el resto (pago fraccionado): la factura queda ' + (fUna && fUna.estado) + ' (' + w.ms + ' ms)');
  w = await llamar(T.chef, 'registrarPagoFacturas', [dos.slice(0, 2).map((f) => f.llave), 'Banco', '2026-10-18', null, 0, 'ENSAYO dos juntas', 'Banco BI']); tiempos.push(w.ms);
  anota(w.status === 200, '2c. dos facturas de ' + dos[0].proveedor + ' juntas (' + w.ms + ' ms)');
  // anular lo propio: el abono del chef
  const movs = (await llamar(T.chef, 'getPagosProveedores')).j.resultado;
  const propio = (movs.facturas.find((f) => f.llave === una.llave).pagos || []).find((m) => /ENSAYO abono/.test(m.detalle || ''));
  w = await llamar(T.chef, 'anularMovimientoPago', [propio && propio.id]); tiempos.push(w.ms);
  anota(w.status === 200, '2d. el chef anula lo suyo (' + w.ms + ' ms)');
  // anular lo ajeno: un movimiento que anoto otra persona (de la hoja real copiada)
  const ajeno = movs.facturas.flatMap((f) => f.pagos || []).find((m) => m.id && m.por && !/^Prueba/.test(m.por) && !/^(Traida|Pagado antes)/.test(m.estatus));
  w = await llamar(T.chef, 'anularMovimientoPago', [ajeno && ajeno.id]);
  anota(w.status === 400 && /solo el dueño/.test(w.j.error || ''), '2e. el chef intenta anular lo de ' + (ajeno && ajeno.por) + ': se niega → ' + (w.j.error || w.status));
  w = await llamar(T.sala, 'registrarCompraMercado', ['2026-10-18', 'Mercado', 'ENSAYO limones', 35.5, 'BARRA', 'Pagado de caja']); tiempos.push(w.ms);
  anota(w.status === 200, '2f. sala anota una compra de mercado (' + w.ms + ' ms)');
  anota(tiempos.every((t) => t < 1000), '2. cada guardado, de punta a punta desde la Mac, en menos de 1 s: ' + tiempos.join(', ') + ' ms');

  // (3) Caja/Compras escriben en la hoja (como _pagEscribir_ en la intranet)
  await new Promise((ok) => setTimeout(ok, 4000));   // que termine la copia de los guardados
  const idCaja = crypto.randomBytes(4).toString('hex');
  const Hh = ((await S.spreadsheets.values.get({ spreadsheetId: CFG, range: 'PAGOS_PROVEEDORES!1:1' })).data.values || [[]])[0];
  const filaCaja = Hh.map((h) => ({ AREA: 'COCINA', PROVEEDOR: 'Mercado', DTE: 'SIN FACTURA', 'FECHA PAGADO': '2026-10-18', 'CANTIDAD PAGADA': 22, 'ESTATUS DE PAGO': 'Pagado de caja',
    DETALLE: 'ENSAYO caja chica (intranet)', 'ESCRITO POR': 'José', ID: idCaja })[h] || '');
  await S.spreadsheets.values.append({ spreadsheetId: CFG, range: 'PAGOS_PROVEEDORES!A:A', valueInputOption: 'RAW', requestBody: { values: [filaCaja] } });
  r = await tarea('refrescar-copia');
  anota(r.status === 200 && r.j.importacion.nuevas >= 1 && r.j.importacion.problemas.length === 0, '3. lo que Caja anota en la hoja entra a la base: ' + JSON.stringify({ nuevas: r.j.importacion.nuevas, problemas: r.j.importacion.problemas }));
  await compararBaseHoja(S, '4. en vivo');

  // (5) volver atras
  await ponerParametro(S, 'motor_pagos', 'sheets');
  const tVuelta = await esperarModo('sombra', 60000);
  anota(tVuelta !== null, '5. vuelta atrás (sheets) → sombra en ' + tVuelta + ' ms');
  w = await llamar(T.chef, 'registrarPagoFacturas', [['x'], 'Pagado de caja', '2026-10-18']);
  anota(w.status === 409, '5. de vuelta en sombra, el servidor ya no guarda (' + w.status + ')');
  // la intranet vuelve a mandar: anula en la hoja un pago que habia guardado el servidor
  const vals = (await S.spreadsheets.values.get({ spreadsheetId: CFG, range: 'PAGOS_PROVEEDORES', valueRenderOption: 'UNFORMATTED_VALUE' })).data.values;
  const iE = vals[0].indexOf('ESTATUS DE PAGO'), iD = vals[0].indexOf('DETALLE');
  // la mas reciente de ESTA corrida y sin anular (el ensayo puede correr varias veces sobre la misma copia)
  let rServ = -1;
  vals.forEach((f, i) => { if (String(f[iD] || '') === 'ENSAYO limones' && !/^ANULADO/.test(String(f[iE] || ''))) rServ = i; });
  await S.spreadsheets.values.update({ spreadsheetId: CFG, range: 'PAGOS_PROVEEDORES!' + String.fromCharCode(65 + iE) + (rServ + 1), valueInputOption: 'RAW',
    requestBody: { values: [['ANULADO: Pagado de caja (José, 2026-10-18)']] } });
  r = await tarea('refrescar-copia');
  anota(r.status === 200 && r.j.importacion.actualizadas >= 1 && r.j.importacion.problemas.length === 0, '5. la intranet anula un pago del servidor y la base lo acepta (manda la hoja): ' + JSON.stringify({ actualizadas: r.j.importacion.actualizadas, problemas: r.j.importacion.problemas }));
  await compararBaseHoja(S, '5. después de volver atrás');

  console.log('\nRESUMEN: ' + informe.filter((x) => /^OK/.test(x)).length + ' OK · ' + informe.filter((x) => /^FALLA/.test(x)).length + ' FALLAS');
  fs.writeFileSync(path.join(process.env.ENSAYO_DIR || '/tmp', 'ensayo-informe.txt'), informe.join('\n') + '\n');
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
