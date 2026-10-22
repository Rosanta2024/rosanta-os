#!/usr/bin/env node
/**
 * ENSAYO DEL CIERRE DE BANCOS, SOLO LECTURA (22-oct-2026). Toma los archivos REALES del BAC que ya estan en Drive (en la
 * Mac), los pasa al CSV normalizado con banco-normalizar.js, corre cierre_bancos.js REAL en SOMBRA (proc-maestro.js,
 * cargarCierreBancos sobre el maestro sin las filas de ese mes) y compara lo que cargaria contra lo que el maestro YA
 * tiene en 04_Banco_BAC, 04b_Banco_BAC_USD y 05_Tarjeta_Credito_BAC para ese mes.
 *
 *   node cloud/herramientas/ensayo-cierre-bancos.js [2026-01 2026-02 ...] [--archivos <carpeta o archivo> ...] [--detalle]
 *
 * NO ESCRIBE NADA: ni en el maestro (no hay permiso de escritura), ni en Drive (los archivos se leen del disco y la
 * carpeta _sistema es de mentira, en memoria), ni en ninguna base. Lee el maestro con restaurante@ (GMAIL_OAUTH o el
 * secreto gmail-restaurante-oauth). No imprime montos: solo conteos y, con --detalle, las columnas que difieren con los
 * montos enmascarados.
 *
 * Por defecto lee las carpetas de 2026 del BAC (cuenta Q, cuenta $, tarjeta). La cuenta y el mes salen del contenido de
 * cada archivo, no del nombre (los nombres de esas carpetas no coinciden con su contenido). Un mes sin archivo de una
 * cuenta se dice; dos archivos distintos de la misma cuenta y mes, tambien.
 * Que esperar: "solo_desc_corta" alto en la cuenta Q (el maestro tiene la descripcion cortada del PDF y el .xls la trae
 * entera), "categoria" donde se reclasifico a mano, y 0 en valor, faltan y sobran. La cuenta en dolares frena: su
 * pestaña (04b_Banco_BAC_USD) todavia no existe.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const M = require(path.join(APP, 'src', 'proc-maestro'));
const N = require(path.join(APP, 'src', 'banco-normalizar'));
const P = require(path.join(APP, 'src', 'proc-pauta'));
const { crearCuenta } = require(path.join(APP, 'src', 'google-cuenta'));

if (process.env.TZ !== 'America/Guatemala') {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: 'America/Guatemala' }) });
  process.exit(r.status === null ? 2 : r.status);
}

const BANCOS = path.join(process.env.HOME, 'My Drive', 'Rosanta OS', '03_Finance_Data_OS', 'Contabilidad', 'BANCOS');
const POR_DEFECTO = [
  path.join(BANCOS, 'Estados de cuenta', 'BAC', 'BAC - 2026', 'BAC - Q 2026'),
  path.join(BANCOS, 'Estados de cuenta', 'BAC', 'BAC - 2026', 'BAC - $ 2026'),
  path.join(BANCOS, 'Tarjeta de Credito - BAC', 'BAC_TC 2026')
];
const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
function secreto(nombre) {
  try { return execFileSync(GCLOUD, ['secrets', 'versions', 'access', 'latest', '--secret', nombre, '--project', 'rosanta-apps-script'], { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}
/** 1234.56 → "1,2xx.xx": deja ver el tamaño sin el monto. */
function mascara(s) {
  return String(s).replace(/-?\d[\d,]*\.\d{2}/g, (m) => { const neg = m[0] === '-' ? '-' : ''; const d = m.replace(/[-,]/g, '').split('.')[0]; return neg + d[0] + d.slice(1).replace(/\d/g, 'x') + '.xx'; });
}

function leerArchivos(rutas) {
  const archivos = [];
  rutas.forEach((r) => {
    if (!fs.existsSync(r)) { console.log('(no existe ' + r + ')'); return; }
    if (fs.statSync(r).isDirectory()) fs.readdirSync(r).filter((n) => /\.(xls|csv)$/i.test(n)).forEach((n) => archivos.push(path.join(r, n)));
    else archivos.push(r);
  });
  const porClave = {};
  archivos.forEach((f) => {
    let x;
    try { x = N.normalizar(fs.readFileSync(f), path.basename(f)); } catch (e) { console.log('  ' + path.basename(f) + ': NO SE PUDO NORMALIZAR: ' + e.message); return; }
    if (!x) return;
    const k = x.resumen.nombre;   // "BAC Q 2026-01.csv": cuenta + mes
    (porClave[k] = porClave[k] || []).push({ archivo: path.basename(f), texto: x.texto, resumen: x.resumen });
  });
  return porClave;
}

async function main() {
  const args = process.argv.slice(2);
  const detalle = args.includes('--detalle');
  const iA = args.indexOf('--archivos');
  const extra = iA >= 0 ? args.slice(iA + 1).filter((a) => !a.startsWith('--')) : [];
  const meses = args.filter((a) => /^20\d\d-\d\d$/.test(a));
  const MESES = meses.length ? meses : ['2026-01', '2026-02', '2026-03', '2026-04'];

  console.log('Archivos del banco (la cuenta y el mes salen del contenido):');
  const porClave = leerArchivos(POR_DEFECTO.concat(extra));
  Object.keys(porClave).sort().forEach((k) => {
    const g = porClave[k], x = g[0].resumen;
    const iguales = g.every((y) => y.texto === g[0].texto);
    console.log('  ' + k + '  <-  ' + g.map((y) => y.archivo).join(' + ') + '  · ' + x.movimientos + ' movimientos' + (iguales ? '' : '  ** ' + g.length + ' ARCHIVOS DISTINTOS **'));
  });

  const credencial = process.env.GMAIL_OAUTH || secreto('gmail-restaurante-oauth');
  if (!credencial) throw new Error('Falta el permiso de restaurante@ (GMAIL_OAUTH o el secreto gmail-restaurante-oauth).');
  const cuenta = crearCuenta({ credencial });
  const sheets = P.sheetsDeCuenta(cuenta);
  const maestro = await M.leerMaestro(sheets, M.MAESTRO);
  console.log('Maestro leido (solo lectura). Pestañas del cierre que existen: ' + Object.keys(M.CIERRE).filter((n) => maestro.titulos.includes(n)).join(', '));
  const driveNo = { carpeta: async (id) => { throw new Error('El ensayo no lee Drive (' + id + ')'); }, bajar: async (id) => { throw new Error('El ensayo no baja de Drive (' + id + ')'); } };
  const deps = { sheetsLectura: sheets, drive: driveNo, pool: null, sheetsEscritura: null, guardarCorridas: false };

  let fallas = 0;
  for (const mes of MESES) {
    console.log('\n=== ' + mes + ' ===');
    const archivos = [], textos = {};
    ['BAC Q', 'BAC $', 'TC BAC'].forEach((cta, i) => {
      const g = porClave[cta + ' ' + mes + '.csv'];
      if (!g) { console.log('  ' + cta + ': no hay archivo del banco para ' + mes); return; }
      g.forEach((y, j) => { const id = 'LOCAL' + i + '_' + j; archivos.push({ id, nombre: cta + ' ' + mes + (j ? ' (' + j + ')' : '') + '.csv', mime: 'text/csv', modificado: '2026-10-22T12:00:00.000Z' }); textos[id] = y.texto; });
    });
    if (!archivos.length) continue;
    const estado = { libros: {}, respuestas: {}, textos, bancos: {}, carpetas: {
      [M.REPORTES_2026]: { nombre: 'Reportes 2026', archivos: [], carpetas: [{ id: 'RMEN', nombre: 'Reportes Mensual' }] },
      RMEN: { nombre: 'Reportes Mensual', archivos: [], carpetas: [{ id: 'MES', nombre: mes }] },
      MES: { nombre: mes, archivos: [], carpetas: [{ id: 'SIS', nombre: '_sistema' }] },
      SIS: { nombre: '_sistema', carpetas: [], archivos } } };
    const r = await M.correrMaestro({ modo: 'sombra', cierreBancos: mes, estado, maestro }, deps);
    const c = r.cuerpo;
    if (r.status !== 200) fallas++;
    // por pestaña
    const por = {};
    const sumar = (n, k) => { por[n] = por[n] || { armadas: 0, iguales: 0, valor: 0, descripcion: 0, categoria: 0, tipo: 0, desc_corta: 0, faltan: 0, sobran: 0 }; por[n][k]++; };
    (c.detalle.diferencias || []).forEach((x) => sumar(x.pestana, x.clase));
    (c.detalle.faltan || []).forEach((x) => sumar(x.pestana, 'faltan'));
    (c.detalle.sobran || []).forEach((x) => sumar(x.pestana, 'sobran'));
    console.log((r.status === 200 ? 'OK    ' : 'DIFIERE ') + 'iguales ' + c.iguales + ' · solo descripcion cortada ' + c.solo_desc_corta + ' · solo tipo de celda ' + c.solo_tipo +
      ' · categoria ' + c.categoria + ' · descripcion distinta ' + c.descripcion + ' · valor distinto ' + c.valor + ' · faltan ' + c.faltan + ' · sobran ' + c.sobran +
      ' · agregaria hoy ' + c.filas_que_agregaria);
    Object.keys(por).forEach((n) => console.log('  ' + n + ': ' + Object.keys(por[n]).filter((k) => por[n][k]).map((k) => k + ' ' + por[n][k]).join(' · ')));
    // por columna: cuantas filas difieren en cada una (una fila puede diferir en varias)
    const porCol = {};
    (c.detalle.diferencias || []).forEach((x) => x.columnas.forEach((k) => { const q = x.pestana + ' · ' + k.encabezado + ' (' + k.clase + ')'; porCol[q] = (porCol[q] || 0) + 1; }));
    Object.keys(porCol).sort().forEach((q) => console.log('    columna ' + q + ': ' + porCol[q]));
    if (c.error) console.log('  error: ' + c.error);
    (c.avisos || []).forEach((a) => console.log('  aviso: ' + mascara(a)));
    if (detalle) {
      (c.detalle.diferencias || []).filter((x) => x.clase !== 'desc_corta').forEach((x) => console.log('  ' + x.clase + ' ' + x.pestana + ' fila ' + x.fila_maestro + ': ' +
        x.columnas.filter((k) => k.clase !== 'desc_corta').map((k) => k.encabezado + ' maestro "' + mascara(k.maestro) + '" · archivo "' + mascara(k.nube) + '"').join('; ')));
      (c.detalle.faltan || []).forEach((x) => console.log('  falta ' + x.pestana + ' ' + mascara(x.llave)));
      (c.detalle.sobran || []).forEach((x) => console.log('  sobra ' + x.pestana + ' fila ' + x.fila + ' ' + mascara(x.llave)));
    }
  }
  console.log('\nNo se escribio nada.' + (fallas ? ' ' + fallas + ' mes(es) con diferencias.' : ''));
  return fallas ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
