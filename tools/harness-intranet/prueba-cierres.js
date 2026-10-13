/* Lector de cierres de PosFile sobre textos reales (13-oct-2026). node prueba-cierres.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(process.env.HOME, 'Dev/Rosanta/apps-script/rosanta-intranet');
const ctx = { JSON, Math, Date, Number, String, Object, Array, RegExp, Error, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'CierresDiarios.js'), 'utf8'), ctx);
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
let mal = 0;
const t = (n, c, info) => { if (!c) mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };
const p = ctx.cieParsear_;
let a = p(fx('cierre_2026-10-12.txt'), 'Cierre de Caja 12/10/2026 00:01 - 12/10/2026 21:15');
t('12-oct fecha', a.fecha === '2026-10-12', a.fecha);
t('12-oct efectivo y tarjeta', a.efectivo === 297 && a.tarjeta === 4889.5, a.efectivo + ' / ' + a.tarjeta);
t('12-oct total, propina, sin propina', a.gran_total === 5186.5 && a.propina === 471.5 && a.sin_propina === 4715, a.gran_total + ' ' + a.propina + ' ' + a.sin_propina);
t('12-oct documentos', a.documentos.length === 5 && a.documentos[4].q === 297 && a.documentos[1].q === 3019.5, JSON.stringify(a.documentos[4]));
t('12-oct cuadra, gastos, productos', a.cuadra && a.gastos_pos === 0 && a.productos === 50, a.cuadra + ' ' + a.gastos_pos + ' ' + a.productos);
let b = p(fx('cierre_2026-10-05.txt'), '');
t('5-oct: fecha del titulo, sin asunto', b.fecha === '2026-10-05', b.fecha);
t('5-oct efectivo Q1,688 (el Excel dice 1,680)', b.efectivo === 1688 && b.tarjeta === 3234.5 && b.cuadra, b.efectivo);
// por columnas: el texto del PDF puede traer primero las etiquetas y despues los montos
let col = fx('cierre_2026-10-05.txt').replace('Tarjetas 3,234.50\n\nCaja (efec\n\nvo) POS 1,688.00', 'Tarjetas\nCaja (efectivo) POS\n3,234.50\n1,688.00');
let c = p(col, '');
t('por columnas', c.efectivo === 1688 && c.tarjeta === 3234.5 && c.cuadra, c.efectivo + ' / ' + c.tarjeta);
// una forma de pago que no conozco: no cuadra (no se inventa)
let d = p(fx('cierre_2026-10-05.txt').replace('Tarjetas 3,234.50', 'Tarjetas 3,000.00\n\nVale 234.50'), '');
t('forma de pago desconocida no cuadra', d.cuadra === false, d.cuadra);
// la fecha por el asunto si el titulo no se lee
let e = p(fx('cierre_2026-10-12.txt').replace('121020260001-121020262115', ''), 'Cierre de Caja 12/10/2026 00:01 - 12/10/2026 21:15');
t('fecha por el asunto (dia primero)', e.fecha === '2026-10-12', e.fecha);
console.log(mal ? mal + ' FALLAS' : 'todo OK');
process.exit(mal ? 1 : 0);
