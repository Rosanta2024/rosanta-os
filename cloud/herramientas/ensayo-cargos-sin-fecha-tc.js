#!/usr/bin/env node
/**
 * ENSAYO DE SOLO LECTURA de apps-script/rosanta-maestro/cargos_sin_fecha_tc_bac.js (22-oct-2026): los cargos sin fecha
 * de la tarjeta BAC de enero a abril (INTERES COM, CARGOS POR SERVICIO MES ANTERIOR), la reclasificacion de Netflix,
 * Spotify y Apple (ene-jul) de PERSONAL a CUOTAS_Y_SUSCRIPCIONES y los intereses ya cargados (may-sep) de
 * COMISIONES_BANCARIAS a INTERESES_BANCARIOS. Esperado: 8 / 12 / 7 y despues 0 / 0 / 0.
 *
 *   node cloud/herramientas/ensayo-cargos-sin-fecha-tc.js [--montos]
 *
 * Corre el codigo REAL (cargador.js + cierre_bancos.js + cargos_sin_fecha_tc_bac.js) con el motor de proc-maestro.js:
 *   1) revisarCargosSinFechaTcBac() sobre el maestro real;
 *   2) cargarCargosSinFechaTcBac() sobre una COPIA EN MEMORIA del maestro (no escribe en Google): muestra las filas
 *      exactas que escribiria y las celdas que cambiaria;
 *   3) otra vez cargarCargosSinFechaTcBac() sobre esa copia ya cargada: tiene que dar 0, 0 y 0 (no duplica).
 * Los CSV se leen del disco (la carpeta de Drive BAC_TC 2026 sincronizada en la Mac). El maestro, con restaurante@.
 * Sin --montos, los montos salen enmascarados ("1,3xx.xx").
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const M = require(path.join(APP, 'src', 'proc-maestro'));
const P = require(path.join(APP, 'src', 'proc-pauta'));
const { crearCuenta } = require(path.join(APP, 'src', 'google-cuenta'));

if (process.env.TZ !== 'America/Guatemala') {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: 'America/Guatemala' }) });
  process.exit(r.status === null ? 2 : r.status);
}
const SCRIPT = path.join(__dirname, '..', '..', 'apps-script', 'rosanta-maestro', 'cargos_sin_fecha_tc_bac.js');
const CARPETA_LOCAL = path.join(process.env.HOME, 'My Drive', 'Rosanta OS', '03_Finance_Data_OS', 'Contabilidad', 'BANCOS', 'Tarjeta de Credito - BAC', 'BAC_TC 2026');
const CSF_ID = '1DY3-hLOs4h5AX-nKPtgw-n5z6GOvwpY_';
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
function secreto(nombre) {
  try { return execFileSync(GCLOUD, ['secrets', 'versions', 'access', 'latest', '--secret', nombre, '--project', 'rosanta-apps-script'], { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}
const montos = process.argv.includes('--montos');
const mascara = (s) => (montos ? String(s) : String(s).replace(/-?\d[\d,]*\.\d{2}/g, (m) => { const neg = m[0] === '-' ? '-' : ''; const d = m.replace(/[-,]/g, '').split('.')[0]; return neg + d[0] + d.slice(1).replace(/\d/g, 'x') + '.xx'; }));

function correr(maestro, funcion) {
  const carpeta = { nombre: 'BAC_TC 2026', carpetas: [], archivos: [] }, textos = {};
  fs.readdirSync(CARPETA_LOCAL).forEach((n, i) => {
    carpeta.archivos.push({ id: 'L' + i, nombre: n, mime: /\.csv$/i.test(n) ? 'text/csv' : 'application/octet-stream', modificado: '2026-10-22T12:00:00.000Z' });
    if (/\.csv$/i.test(n)) textos['L' + i] = fs.readFileSync(path.join(CARPETA_LOCAL, n)).toString('latin1');   // getDataAsString('ISO-8859-1')
  });
  const m = M.crearMotorMaestro(maestro, { libros: {}, respuestas: {}, carpetas: { [CSF_ID]: carpeta }, textos }, {});
  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), m.ctx, { filename: 'cargos_sin_fecha_tc_bac.js' });
  const r = m.correr(funcion);
  if (r.faltas.length) throw new Error('Le falto precarga: ' + JSON.stringify(r.faltas));
  return r;
}
/** La copia del maestro despues de una corrida (para la tercera). */
function maestroDespues(maestro, r) {
  const pestanas = Object.assign({}, maestro.pestanas);
  Object.keys(r.trabajo).forEach((n) => { const T = r.trabajo[n]; pestanas[n] = { valores: T.M, formulas: T.formulas, ultima: T.ocupada }; });
  return Object.assign({}, maestro, { pestanas });
}

async function main() {
  const credencial = process.env.GMAIL_OAUTH || secreto('gmail-restaurante-oauth');
  if (!credencial) throw new Error('Falta el permiso de restaurante@ (GMAIL_OAUTH o el secreto gmail-restaurante-oauth).');
  const maestro = await M.leerMaestro(P.sheetsDeCuenta(crearCuenta({ credencial })), M.MAESTRO);
  console.log('Maestro leido (solo lectura).');

  const r1 = correr(maestro, 'revisarCargosSinFechaTcBac');
  console.log('\n=== 1) revisar (sobre el maestro real) ===');
  r1.logs.forEach((l) => console.log(mascara(l)));
  if (r1.error) console.log('ERROR: ' + r1.error);

  const r2 = correr(maestro, 'cargarCargosSinFechaTcBac');
  console.log('\n=== 2) cargar sobre una COPIA EN MEMORIA (no se escribe en Google) ===');
  if (r2.error) console.log('ERROR: ' + r2.error);
  r2.ops.filter((x) => x.tipo === 'valores').forEach((x) => x.valores.forEach((v, i) => console.log('  ' + x.pestana + ' fila ' + (x.fila + i) + ' col ' + x.col + ': ' + mascara(v.map((y) => (typeof y === 'number' ? y.toFixed(2) : y)).join(' | ')))));

  const r3 = correr(maestroDespues(maestro, r2), 'cargarCargosSinFechaTcBac');
  console.log('\n=== 3) otra vez sobre la copia ya cargada (tiene que dar 0, 0 y 0) ===');
  r3.logs.filter((l) => /Filas nuevas en total|Filas reclasificadas|Intereses pasados|NO se escribio|No queda/.test(l)).forEach((l) => console.log(mascara(l)));
  const ok = !r1.error && !r2.error && !r3.error && r3.ops.length === 0;
  console.log('\n' + (ok ? 'OK: ' : 'REVISAR: ') + 'no se escribio nada en el maestro.');
  return ok ? 0 : 1;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
