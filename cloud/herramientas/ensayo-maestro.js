#!/usr/bin/env node
/**
 * ENSAYO DEL CARGADOR DEL MAESTRO (21-oct-2026). Reproduce en SOMBRA los lunes de octubre con el cargador.js REAL
 * (cloud/app/src/proc-maestro.js) y compara lo que habria cargado con lo que el maestro tiene HOY (lo cargo Apps
 * Script). No escribe en el maestro, ni en la Propiedad de procesados, ni en ninguna base: sin pool y sin permiso de
 * escritura.
 *
 *   node cloud/herramientas/ensayo-maestro.js [2026-10-12 2026-10-19 2026-10-26] [--detalle]
 *
 * Cada fecha se corre a las 12:00 de Guatemala (despues de la carga de Apps Script de las 10:00). La ventana del
 * cargador depende solo de la SEMANA ISO y del mes de esa fecha: el martes 13 y el 20 dan lo mismo que el lunes 12
 * y el 19. Una fecha que todavia no llego se salta.
 * Credenciales (nunca se imprimen): GMAIL_OAUTH (o el secreto gmail-restaurante-oauth) para leer el maestro y
 * "Reportes 2026" como restaurante@.
 *
 * LO UNICO QUE TOCA: cada xlsx del POS o del FEL se convierte como lo hace el cargador (sube una copia convertida
 * a Hoja de Google en el Drive de restaurante@, la lee y la BORRA enseguida; drive.file solo toca lo que crea).
 *
 * Que esperar: filas_que_agregaria = 0 (Apps Script ya cargo esas semanas), faltan = 0 y distintas = 0. Una
 * distinta puede ser un arreglo a mano en el maestro despues de la carga (una categoria del banco corregida):
 * el detalle dice la fila, la columna y los dos valores. Las columnas de formulas (Año, Mes, Semana, Categoria
 * del FEL) no se comparan.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const M = require(path.join(APP, 'src', 'proc-maestro'));
const P = require(path.join(APP, 'src', 'proc-pauta'));
const { crearCuenta } = require(path.join(APP, 'src', 'google-cuenta'));

if (process.env.TZ !== 'America/Guatemala') {
  // las fechas del maestro son de Guatemala: se relanza con la zona correcta
  const r = require('child_process').spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: 'America/Guatemala' }) });
  process.exit(r.status === null ? 2 : r.status);
}

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
function secreto(nombre) {
  try { return execFileSync(GCLOUD, ['secrets', 'versions', 'access', 'latest', '--secret', nombre, '--project', 'rosanta-apps-script'], { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}

const args = process.argv.slice(2);
const fechas = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const LUNES = fechas.length ? fechas : ['2026-10-12', '2026-10-19', '2026-10-26'];
const detalle = args.includes('--detalle');

async function main() {
  const credencial = process.env.GMAIL_OAUTH || secreto('gmail-restaurante-oauth');
  if (!credencial) throw new Error('Falta el permiso de restaurante@ (GMAIL_OAUTH o el secreto gmail-restaurante-oauth).');
  const cuenta = crearCuenta({ credencial });
  const deps = { sheetsLectura: P.sheetsDeCuenta(cuenta), drive: P.crearDrive(cuenta), conversiones: new Map(),
    pool: null, sheetsEscritura: null, guardarCorridas: false };
  const estado = { libros: {}, carpetas: {}, respuestas: {} };   // la precarga (y cada conversion) sirve para los tres lunes
  let fallas = 0, corridos = 0;
  for (const dia of LUNES) {
    const ahora = Date.parse(dia + 'T12:00:00-06:00');
    console.log('\n=== ' + dia + ' 12:00 GT ===');
    if (ahora > Date.now()) { console.log('Todavia no llego: correrlo ese dia despues de las 12:00.'); continue; }
    corridos++;
    const r = await M.correrMaestro({ modo: 'sombra', ahora, estado }, deps);
    const c = r.cuerpo;
    const bien = r.status === 200;
    if (!bien) fallas++;
    (c.archivos || []).forEach((a) => console.log('  ' + a.carpeta + '/' + a.nombre + '  ' + a.tipo + (a.filas ? '  +' + a.filas + ' filas' : '')));
    console.log((bien ? 'OK    ' : 'FALLA ') + 'agregaria ' + c.filas_que_agregaria + ' · iguales ' + c.iguales + ' · distintas ' + c.distintas + ' · faltan ' + c.faltan +
      ' · ' + c.rondas + ' rondas · ' + c.ms + ' ms');
    if (c.error) console.log('  error: ' + c.error);
    (c.avisos || []).forEach((a) => console.log('  aviso: ' + a));
    const n = detalle ? 100 : 10;
    (c.detalle.agregaria || []).slice(0, n).forEach((x) => console.log('  agregaria ' + x.pestana + ' fila ' + x.fila + ': ' + x.valores.join(' | ')));
    (c.detalle.faltan || []).slice(0, n).forEach((x) => console.log('  falta ' + x.pestana + ' ' + x.llave));
    (c.detalle.distintas || []).slice(0, n).forEach((x) => console.log('  distinta ' + x.pestana + ' fila ' + x.fila_maestro + ' (' + x.llave + '): ' +
      x.columnas.map((k) => k.encabezado + ' maestro ' + k.maestro + ' · nube ' + k.nube).join('; ')));
  }
  console.log('\n' + (corridos ? (fallas ? fallas + ' lunes con diferencias o errores.' : 'Todo igual al maestro.') : 'Ningun lunes para reproducir todavia.'));
  process.exit(fallas ? 1 : 0);
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
