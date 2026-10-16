// Informe mensual del embudo de eventos (16-oct-2026) con las filas reales del pipeline.
//   ~/Dev/Rosanta/tools/cotizaciones/cot.sh list > /tmp/cot.json
//   node tools/harness-intranet/harness-eventos.js /tmp/cot.json 2026 10 [AAAA-MM-DD]
// Corre el evmCalc_/evmTexto_ reales de EventosMes.js (no escribe nada).
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '..', '..', 'apps-script', 'rosanta-intranet');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'EventosMes.js'), 'utf8'), ctx);
const [archivo, anio, mes, hoy] = process.argv.slice(2);
const filas = JSON.parse(fs.readFileSync(archivo, 'utf8')).filas;
const h = hoy || new Date().toISOString().slice(0, 10);
console.log(ctx.evmTexto_(ctx.evmCalc_(filas, Number(anio), Number(mes), h), null));
