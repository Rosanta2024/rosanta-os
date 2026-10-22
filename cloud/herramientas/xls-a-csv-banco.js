#!/usr/bin/env node
/**
 * DEL BANCO AL CSV NORMALIZADO, EN LA MAC (22-oct-2026). Para el cierre de mes mientras el maestro lo carga Apps Script
 * (octubre: cierre el 3 o 4-nov): Drive NO convierte el .xls del BAC, asi que Apps Script no lo puede leer; esto lo pasa
 * al CSV normalizado que lee cierre_bancos.js (cargarCierreBancos). Usa el MISMO normalizador que la nube
 * (cloud/app/src/banco-normalizar.js, SheetJS oficial).
 *
 *   node cloud/herramientas/xls-a-csv-banco.js "<Reportes Mensual>/2026-10/_sistema"
 *   node cloud/herramientas/xls-a-csv-banco.js "<...>/_sistema/Transacciones del mes (1).xls"   (un archivo suelto)
 *   --revisar   no escribe nada: solo dice que saldria
 *
 * Lee los .xls del BAC (cuenta en quetzales, cuenta en dolares, tarjeta) y el CSV de la tarjeta BAC, con cualquier
 * nombre ("BAC Q 2026-10.xls", "Transacciones del mes (1).xls"...): la cuenta sale del NUMERO DE CUENTA O DE TARJETA del
 * encabezado y el mes de las fechas de los movimientos. Deja cada CSV en la MISMA carpeta _sistema, con el nombre fijo:
 * "BAC Q 2026-10.csv", "BAC $ 2026-10.csv", "TC BAC 2026-10.csv". Los PDF no se tocan (son del contador).
 *
 * SE DETIENE Y NO ESCRIBE NADA si: una cuenta no se reconoce, dos archivos son de la misma cuenta y del mismo mes, un
 * estado no cuadra consigo mismo (cadena de saldos, totales del banco, saldo anterior + movimientos = pago de contado),
 * o ya hay un CSV con ese nombre y es distinto (un CSV igual se deja como esta).
 */
const fs = require('fs');
const path = require('path');
const N = require(path.join(__dirname, '..', 'app', 'src', 'banco-normalizar'));

function main(argv) {
  const revisar = argv.includes('--revisar');
  const rutas = argv.filter((a) => !a.startsWith('--'));
  if (rutas.length !== 1) { console.log('Uso: node xls-a-csv-banco.js <carpeta _sistema | archivo> [--revisar]'); return 2; }
  const ruta = path.resolve(rutas[0]);
  if (!fs.existsSync(ruta)) { console.log('No existe: ' + ruta); return 2; }
  const esCarpeta = fs.statSync(ruta).isDirectory();
  const carpeta = esCarpeta ? ruta : path.dirname(ruta);
  if (path.basename(carpeta) !== '_sistema') console.log('AVISO: la carpeta no se llama _sistema (' + carpeta + '). El cargador solo lee <mes>/_sistema/.');
  const archivos = esCarpeta ? fs.readdirSync(carpeta).filter((n) => /\.(xls|csv)$/i.test(n) && !n.startsWith('.')).map((n) => path.join(carpeta, n)) : [ruta];

  const salen = [], errores = [];
  archivos.forEach((f) => {
    let r;
    try { r = N.normalizar(fs.readFileSync(f), path.basename(f)); } catch (e) { errores.push(path.basename(f) + ': ' + e.message); return; }
    if (!r) { if (!esCarpeta) errores.push(path.basename(f) + ': no es un archivo del BAC que se conozca (ni el normalizado).'); return; }
    salen.push(Object.assign({ origen: f, destino: path.join(carpeta, r.resumen.nombre) }, r));
  });
  // dos archivos de la misma cuenta y mes
  const porNombre = {};
  salen.forEach((s) => { (porNombre[s.resumen.nombre] = porNombre[s.resumen.nombre] || []).push(s); });
  Object.keys(porNombre).forEach((n) => {
    if (porNombre[n].length > 1) errores.push(n + ': ' + porNombre[n].length + ' archivos son de la misma cuenta y del mismo mes (' + porNombre[n].map((s) => path.basename(s.origen)).join(', ') + '). Dejar uno solo.');
  });
  salen.forEach((s) => {
    if (path.resolve(s.origen) === path.resolve(s.destino)) errores.push(path.basename(s.origen) + ': el archivo del banco se llama igual que el CSV que tiene que salir. Renombrarlo (por ejemplo "TC BAC 2026-10 banco.csv").');
    else if (fs.existsSync(s.destino) && fs.readFileSync(s.destino, 'utf8') !== s.texto) errores.push(s.resumen.nombre + ': ya existe y es distinto. Revisar a mano cual vale; no se pisa.');
  });

  salen.forEach((s) => {
    const x = s.resumen;
    console.log(path.basename(s.origen) + '  ->  ' + x.nombre + '  · ' + x.movimientos + ' movimientos · ' +
      (x.formato === 'CUENTA' ? 'cuenta ' + x.cuenta + ' ' + x.moneda + ' · debitos ' + x.debitos.toFixed(2) + ' · creditos ' + x.creditos.toFixed(2) +
        ' · saldo inicial ' + x.inicial.toFixed(2) + ' · final ' + x.final.toFixed(2) + (x.generado ? ' · bajado el ' + x.generado : '')
        : 'tarjeta ' + x.cuenta + ' · corte ' + x.corte + ' · quetzales ' + x.quetzales.toFixed(2) + ' · dolares ' + x.dolares.toFixed(2)));
  });
  if (errores.length) {
    console.log('\nSE DETUVO, no se escribio nada:');
    errores.forEach((e) => console.log('  ' + e));
    return 1;
  }
  if (!salen.length) { console.log('No hay archivos del banco en ' + carpeta + '.'); return 0; }
  if (revisar) { console.log('\n(--revisar: no se escribio nada)'); return 0; }
  salen.forEach((s) => { if (!fs.existsSync(s.destino)) fs.writeFileSync(s.destino, s.texto, 'utf8'); });
  console.log('\nListo: ' + salen.length + ' CSV en ' + carpeta + '. Ahora, en el maestro: revisarCierreBancos("AAAA-MM") y despues cargarCierreBancos("AAAA-MM").');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
