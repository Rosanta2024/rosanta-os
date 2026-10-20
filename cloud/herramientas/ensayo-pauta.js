#!/usr/bin/env node
/**
 * ENSAYO DE LA PAUTA DE LOS LUNES (20-oct-2026). Reproduce en SOMBRA los lunes de octubre con el codigo real de
 * Marketing OS (cloud/app/src/proc-pauta.js) y compara lo que cada escritor habria puesto con lo que la hoja
 * pauta_semanal tiene HOY. No escribe en ninguna hoja ni en ninguna base: sin pool y sin permiso de escritura.
 *
 *   node cloud/herramientas/ensayo-pauta.js [2026-10-13 2026-10-20 2026-10-27] [--solo pauta_wix,pauta_pos] [--sin-pos]
 *
 * Cada fecha se corre a las 12:00 de Guatemala (la hora del reloj propuesto). Una fecha que todavia no llego se
 * salta: correrla de nuevo ese lunes despues de las 12:00.
 * Credenciales (nunca se imprimen): GMAIL_OAUTH (o el secreto gmail-restaurante-oauth) para leer las hojas y Drive
 * como restaurante@; WIX_API_KEY (o el secreto wix-api-key) para Wix. Sin la llave de Wix, pauta_wix se salta.
 *
 * LO UNICO QUE TOCA: el POS en xlsx se convierte como lo hace PosPauta.js cada lunes (sube una copia convertida a
 * Hoja de Google en el Drive de restaurante@, la lee y la BORRA enseguida; drive.file solo puede tocar lo que crea).
 * Con --sin-pos no se convierte nada.
 *
 * Que esperar: la hoja de hoy tiene lo que escribio la ULTIMA corrida de cada activador. Wix y clientes escriben solo
 * la semana que cierra, asi que cada lunes se compara con su semana. PosPauta recalcula TODAS las semanas cada lunes:
 * los tres lunes comparan lo mismo (el POS de hoy) y una diferencia en una semana vieja quiere decir que un archivo
 * del POS cambio despues de la ultima corrida, o que la nube lee distinto.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const P = require(path.join(APP, 'src', 'proc-pauta'));
const { crearCuenta } = require(path.join(APP, 'src', 'google-cuenta'));

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
function secreto(nombre) {
  try { return execFileSync(GCLOUD, ['secrets', 'versions', 'access', 'latest', '--secret', nombre, '--project', 'rosanta-apps-script'], { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : null; };
const fechas = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const LUNES = fechas.length ? fechas : ['2026-10-13', '2026-10-20', '2026-10-27'];
let solo = opcion('solo') ? opcion('solo').split(',') : P.MODULOS.slice();
if (args.includes('--sin-pos')) solo = solo.filter((m) => m !== 'pauta_pos');
const desconocidos = solo.filter((m) => P.MODULOS.indexOf(m) === -1);
if (desconocidos.length) throw new Error('Modulos desconocidos: ' + desconocidos.join(', '));

const fmt = (x) => (x instanceof Date ? x.toISOString().slice(0, 10) : typeof x === 'string' && x.length > 40 ? x.slice(0, 40) + '…' : JSON.stringify(x));

async function main() {
  const credencial = process.env.GMAIL_OAUTH || secreto('gmail-restaurante-oauth');
  if (!credencial) throw new Error('Falta el permiso de restaurante@ (GMAIL_OAUTH o el secreto gmail-restaurante-oauth).');
  const cuenta = crearCuenta({ credencial });
  const wix = process.env.WIX_API_KEY || secreto('wix-api-key');
  if (!wix && solo.indexOf('pauta_wix') > -1) { console.log('Sin WIX_API_KEY: pauta_wix se salta.'); solo = solo.filter((m) => m !== 'pauta_wix'); }
  const deps = {
    sheetsLectura: P.sheetsDeCuenta(cuenta), drive: P.crearDrive(cuenta),
    env: { WIX_API_KEY: wix, WIX_SITE_ID: process.env.WIX_SITE_ID || P.WIX_SITE_ID },
    conversiones: new Map(), pool: null, sheetsEscritura: null, guardarCorridas: false
  };
  const estado = { libros: {}, carpetas: {}, respuestas: {} };   // la precarga sirve para los tres lunes
  const modos = {}; solo.forEach((m) => { modos[m] = 'sombra'; });
  let fallas = 0, corridos = 0;
  for (const dia of LUNES) {
    const ahora = Date.parse(dia + 'T12:00:00-06:00');
    console.log('\n=== Lunes ' + dia + ' 12:00 GT ===');
    if (ahora > Date.now()) { console.log('Todavia no llego: correrlo ese dia despues de las 12:00.'); continue; }
    corridos++;
    const t0 = Date.now();
    const r = await P.correrPauta({ modos, ahora, estado }, deps);
    Object.keys(r.modulos).forEach((m) => {
      const x = r.modulos[m];
      if (!x.corrio) return;
      const bien = x.ok && !(x.diferencias || []).length && !(x.problemas || []).length;
      if (!bien) fallas++;
      const sem = Object.keys(x.semanas || {});
      console.log((bien ? 'OK    ' : 'FALLA ') + m + ' · ' + (m === 'pauta_ads_import' ? sem.length + ' semanas en la hoja' :
        sem.map((w) => 'S' + w + ' ' + Object.keys(x.semanas[w]).map((c) => c + '=' + fmt(x.semanas[w][c])).join(' ')).join(' | ') || 'no escribiria nada') +
        (x.rondas ? ' · ' + x.rondas + ' rondas' : '') + ' · ' + x.ms + ' ms');
      (x.diferencias || []).forEach((d) => console.log('       S' + d.wk + ' ' + d.columna + ': hoja ' + fmt(d.hoja) + ' · nube ' + fmt(d.nube)));
      (x.problemas || []).forEach((p) => console.log('       ' + p));
      if (x.error) console.log('       error: ' + x.error);
    });
    console.log('(' + (Date.now() - t0) + ' ms)');
  }
  console.log('\n' + (corridos ? (fallas ? fallas + ' resultado(s) con diferencias o errores.' : 'Todo igual a la hoja.') : 'Ningun lunes para reproducir todavia.'));
  process.exit(fallas ? 1 : 0);
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
