/* Harness de Compras en efectivo y con debito (14-oct-2026): corre ComprasEfectivo.js real sobre el
   espejo del maestro. PAGOS_PROVEEDORES y RETIROS_SOLICITUDES viven en memoria (SI se escriben).
   Uso: node harness-compras.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(process.env.HOME, 'Dev/Rosanta/apps-script/rosanta-intranet');
function revive(v) {
  if (v && typeof v === 'object' && '$d' in v) { const [d, t] = v.$d.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm, ss] = t.split(':').map(Number); return new Date(y, m - 1, dd, hh, mm, ss); }
  return v === null || v === undefined ? '' : v;
}
const maestro = JSON.parse(fs.readFileSync(path.join(__dirname, 'maestro.json')));
Object.keys(maestro).forEach(k => { maestro[k] = maestro[k].map(r => r.map(revive)); });
const CONFIG = { USUARIOS: [['correo', 'rol', 'modulos', 'puede_editar', 'nombre', 'token'],
  ['restaurante@rosanta.rest', 'dueno', 'finanzas,recetario', 'SI', 'Juanma', 'tok'],
  ['chef@x.com', 'chef', 'recetario,pagos', 'SI', 'Jeffry', 'tokchef'],
  ['maco@x.com', 'sala', 'recetario,pagos', 'SI', 'Maco', 'tokmaco'],
  ['sinpagos@x.com', 'chef', 'recetario', 'SI', 'Otro', 'toksin']] };
const SHEETS = { '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk': maestro, CONFIG: CONFIG };
function Sheet(name, R) {
  const w = () => R.reduce((a, r) => Math.max(a, r.length), 0);
  const rng = (r, c, nr, nc) => { const g = {
    getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = R[r - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
    setValues: v => { v.forEach((row, i) => { R[r - 1 + i] = R[r - 1 + i] || []; row.forEach((x, j) => { R[r - 1 + i][c - 1 + j] = x; }); }); return g; },
    setValue: x => { R[r - 1] = R[r - 1] || []; R[r - 1][c - 1] = x; return g; },
    setFontWeight: () => g, setNumberFormat: () => g }; return g; };
  const self = { getName: () => name, getLastRow: () => R.length, getLastColumn: () => w(),
    getDataRange: () => ({ getValues: () => R.map(r => { const x = r.slice(); while (x.length < w()) x.push(''); return x; }) }),
    getRange: (a, c, nr, nc) => typeof a === 'string' ? rng(1, 1, 1, 1) : rng(a, c, nr, nc), setFrozenRows: () => self };
  return self;
}
function Spreadsheet(id) {
  const src = SHEETS[id]; if (!src) throw new Error('openById ' + id);
  return { getId: () => id, getSheetByName: n => src[n] ? Sheet(n, src[n]) : null,
           insertSheet: n => { src[n] = []; return Sheet(n, src[n]); } };
}
let uuid = 0;
const ctx = { SpreadsheetApp: { openById: Spreadsheet, flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => ({ CONFIG_SHEET_ID: 'CONFIG' })[k] || null }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  Utilities: { formatDate: d => d.toISOString(), getUuid: () => ('0000000' + (++uuid)).slice(-8) + '-x' },
  Session: { getActiveUser: () => ({ getEmail: () => '' }) },
  LockService: { getScriptLock: () => ({ waitLock: () => true, tryLock: () => true, releaseLock: () => {} }) },
  Logger: { log: () => {} }, console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN };
vm.createContext(ctx);
let archivos = 0;
ctx.DriveApp = { getFileById: () => ({ getParents: () => ({ next: () => ({ getFoldersByName: () => ({ hasNext: () => false }),
  createFolder: () => ({ createFile: () => ({ getUrl: () => 'https://drive.google.com/file/d/foto' + (++archivos) }) }) }) }) }) };
ctx.Utilities.newBlob = () => ({}); ctx.Utilities.base64Decode = () => [];
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'PagosProveedores.js', 'CierresDiarios.js', 'FelCorreo.js', 'ComprasEfectivo.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
// el espejo llega hasta el 11-oct: el cuadre se prueba desde septiembre
vm.runInContext("PAG_DESDE_ = '2026-08-01'; CPE_ARRANQUE_ = '2026-09-01'; fecLeerSiToca_ = function () { return null; }; fecFacturas_ = function () { return []; };", ctx);
let ok = 0, mal = 0;
const t = (n, c, info) => { if (c) ok++; else mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };
const tira = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

// 1. quien entra
t('Sin modulo pagos no entra', /cocina, barra y el dueño/.test(tira(() => ctx.cpeQuien_('toksin'))));
t('Maco (sala) entra con BARRA', ctx.cpeQuien_('tokmaco').areas.join() === 'BARRA');
t('Jeffry (chef) entra con COCINA', ctx.cpeQuien_('tokchef').areas.join() === 'COCINA');

// 2. la pantalla vacia
let D = ctx.getComprasEfectivo('tok');
const ret0 = D.retiros.length, q0 = D.resumen.retirado;
t('Lee los retiros del banco desde el arranque', ret0 > 5 && D.retiros.every(r => r.origen === 'banco'), ret0 + ' retiros, ' + q0);
t('Sin nada registrado, todo el retiro esta por justificar', Math.abs(D.resumen.por_justificar - q0) < 0.01 && D.resumen.registrado === 0);
t('Sin solicitudes, cada retiro sale "Sin solicitud"', D.resumen.sin_solicitud === ret0);
t('Lee los cargos de la tarjeta de debito', D.cargos_debito.length > 0, D.cargos_debito.length + ' cargos, ' + D.cargos_debito.filter(c => c.casado).length + ' con factura');

// 3. solicitud de retiro: se casa sola con el retiro del banco (06-oct, Q2,000)
t('Solicitud sin lugar: error', /cajero/.test(tira(() => ctx.solicitarRetiro('tokchef', '2026-10-05', '', 2000, ''))));
D = ctx.solicitarRetiro('tokchef', '2026-10-05', 'ATM 095 Agencia Recolección Antigua', 2000, 'mercado');
let s = D.solicitudes[0];
t('La solicitud del 05-oct se casa con el retiro del 06-oct', s && s.estado === 'En el banco', s && s.estado);
t('El retiro casado muestra el lugar y quien pidio', D.retiros.some(r => r.fecha === '2026-10-06' && r.solicitud === s.id && r.por === 'Jeffry'));
D = ctx.solicitarRetiro('tokchef', '2026-09-02', 'ATM 603', 777, '');
t('Una solicitud que el banco no trae (ya cargado): "No aparece en el banco"', D.solicitudes.some(x => x.q === 777 && x.estado === 'No aparece en el banco'));
t('Maco no anula la solicitud de Jeffry', /Jeffry/.test(tira(() => ctx.anularSolicitudRetiro('tokmaco', D.solicitudes.filter(x => x.q === 777)[0].id))));
D = ctx.anularSolicitudRetiro('tokchef', D.solicitudes.filter(x => x.q === 777)[0].id);
t('Jeffry anula la suya', !D.solicitudes.some(x => x.q === 777));
D = ctx.solicitarRetiro('tokmaco', '2026-10-20', 'ATM 152', 500, '');
t('Una solicitud despues del banco cuenta como retirada (Falta cargar el banco)', D.retiros.some(r => r.origen === 'solicitud' && r.q === 500) && Math.abs(D.resumen.retirado - q0 - 500) < 0.01);

// 4. compra en efectivo sin factura
t('Compra sin metodo: error', /efectivo o con tarjeta/.test(tira(() => ctx.registrarCompraEfectivo('tokchef', { fecha: '2026-09-03', monto: 10, detalle: 'tomate' }))));
t('Compra sin detalle: error', /qué se compró/.test(tira(() => ctx.registrarCompraEfectivo('tokchef', { fecha: '2026-09-03', metodo: 'efectivo', monto: 10, detalle: '' }))));
D = ctx.registrarCompraEfectivo('tokchef', { fecha: '2026-09-03', metodo: 'efectivo', proveedor: 'Carnicería Santa Rosa', detalle: '10 lb lomito', monto: 900, area: 'BARRA',
  archivo: { nombre: 'r.jpg', mime: 'image/jpeg', datos: 'xx' } });
let m = ctx.pagMovimientos_().filter(x => x.proveedor === 'Carnicería Santa Rosa')[0];
t('Queda en PAGOS_PROVEEDORES: SIN FACTURA, Retiro de cajero, area de quien la anota', m && m.dte === 'SIN FACTURA' && m.estatus === 'Retiro de cajero' && m.area === 'COCINA', m && (m.area + ' ' + m.estatus));
t('La foto queda como respaldo en el detalle', m && /recibo: https:\/\/drive/.test(m.detalle));
t('El primer retiro queda justificado en Q900', D.retiros[0].justificado === Math.min(900, D.retiros[0].q), D.retiros[0].fecha + ' ' + D.retiros[0].justificado + ' de ' + D.retiros[0].q);
t('Una compra no justifica un retiro posterior a ella', D.retiros.filter(r => r.fecha > '2026-09-04').every(r => r.justificado === 0));
t('Por justificar baja en Q900', Math.abs(D.resumen.por_justificar - (q0 + 500 - 900)) < 0.01);

// 5. compra con factura: paga esa factura
let E = ctx.pagEstado_();
let f = E.facturas.filter(x => x.saldo > 0.01 && x.area === 'COCINA')[0];
D = ctx.registrarCompraEfectivo('tokchef', { fecha: '2026-09-05', metodo: 'efectivo', llave: f.llave, monto: f.saldo, detalle: '' });
let f2 = ctx.pagEstado_().facturas.filter(x => x.llave === f.llave)[0];
t('Con factura: la factura queda pagada con "Retiro de cajero"', f2.saldo <= 0.01 && f2.pagos.some(p => p.estatus === 'Retiro de cajero'), f.proveedor + ' ' + f.dte + ' Q' + f.saldo);
t('Y cuenta como efectivo registrado', Math.abs(D.resumen.registrado - 900 - f.saldo) < 0.01);
let fb = E.facturas.filter(x => x.saldo > 0.01 && x.area === 'BARRA')[0];
t('Jeffry no paga una factura de barra', fb && /BARRA/.test(tira(() => ctx.registrarCompraEfectivo('tokchef', { fecha: '2026-09-05', metodo: 'efectivo', llave: fb.llave, monto: fb.saldo }))));

// 6. debito sin factura: se casa con el cargo del banco
const libre = D.cargos_debito.filter(c => !c.casado)[0];
D = ctx.registrarCompraEfectivo('tokchef', { fecha: libre.fecha, metodo: 'debito', proveedor: libre.glosa, detalle: 'insumos', monto: libre.q });
m = ctx.pagMovimientos_().filter(x => x.detalle.indexOf('[Tarjeta débito BI] insumos') === 0)[0];
t('Debito sin factura: estatus Tarjeta con [Tarjeta débito BI]', m && m.estatus === 'Tarjeta' && m.dte === 'SIN FACTURA');
t('El cargo del banco queda casado con la compra', D.cargos_debito.some(c => c.fecha === libre.fecha && c.q === libre.q && /insumos/.test(c.casado)), libre.glosa + ' ' + libre.q);
t('El debito no cuenta como efectivo', Math.abs(D.resumen.registrado - 900 - f.saldo) < 0.01);

// 7. anular
const idC = D.registradas.filter(x => x.proveedor === 'Carnicería Santa Rosa')[0].id;
t('Maco no anula una compra de cocina', /COCINA/.test(tira(() => ctx.anularCompraEfectivo('tokmaco', idC))));
D = ctx.anularCompraEfectivo('tokchef', idC);
t('Jeffry anula la suya y vuelve a estar por justificar', !D.registradas.some(x => x.id === idC) && Math.abs(D.resumen.registrado - f.saldo) < 0.01);

// 8. Hoy y el vigia: lo de antes del arranque queda cerrado
vm.runInContext("CPE_ARRANQUE_ = '2026-10-01';", ctx);
const ago = ctx.medRetirosMes_(2026, 8), oct = ctx.medRetirosMes_(2026, 10);
t('Agosto: todos los retiros cerrados en el cuadre del 14-oct', ago.n > 0 && ago.con_detalle === ago.n, ago.con_detalle + ' de ' + ago.n);
t('Octubre: los retiros desde el arranque sin compras siguen sin detalle', oct.lista.filter(x => x.fecha >= '2026-10-01').every(x => !x.detalle || /Compras registradas/.test(x.detalle)));

console.log('\n' + ok + ' OK · ' + mal + ' fallas');
process.exit(mal ? 1 : 0);
