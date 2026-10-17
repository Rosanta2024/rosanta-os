/* Harness de Compras en efectivo y con debito (14-oct-2026): corre ComprasEfectivo.js real sobre el
   espejo del maestro. PAGOS_PROVEEDORES y RETIROS_SOLICITUDES viven en memoria (SI se escriben).
   Uso: node harness-compras.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '../../apps-script/rosanta-intranet');   // relativo: corre en cualquier worktree
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
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'PagosProveedores.js', 'CierresDiarios.js', 'FelCorreo.js', 'BancoCorreo.js', 'ComprasEfectivo.js', 'Tiempos.js']
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
t('Solicitud sin lugar: error', /cajero/.test(tira(() => ctx.solicitarRetiro_('tokchef', '2026-10-05', '', 2000, ''))));
D = ctx.solicitarRetiro_('tokchef', '2026-10-05', 'ATM 095 Agencia Recolección Antigua', 2000, 'mercado');
let s = D.solicitudes[0];
t('La solicitud del 05-oct se casa con el retiro del 06-oct', s && s.estado === 'En el banco', s && s.estado);
t('El retiro casado muestra el lugar y quien pidio', D.retiros.some(r => r.fecha === '2026-10-06' && r.solicitud === s.id && r.por === 'Jeffry'));
D = ctx.solicitarRetiro_('tokchef', '2026-09-02', 'ATM 603', 777, '');
t('Una solicitud que el banco no trae (ya cargado): "No aparece en el banco"', D.solicitudes.some(x => x.q === 777 && x.estado === 'No aparece en el banco'));
t('Maco no anula la solicitud de Jeffry', /Jeffry/.test(tira(() => ctx.anularSolicitudRetiro('tokmaco', D.solicitudes.filter(x => x.q === 777)[0].id))));
D = ctx.anularSolicitudRetiro('tokchef', D.solicitudes.filter(x => x.q === 777)[0].id);
t('Jeffry anula la suya', !D.solicitudes.some(x => x.q === 777));
D = ctx.solicitarRetiro_('tokmaco', '2026-10-20', 'ATM 152', 500, '');
t('Una solicitud despues del banco cuenta como retirada (Falta cargar el banco)', D.retiros.some(r => r.origen === 'solicitud' && r.q === 500) && Math.abs(D.resumen.retirado - q0 - 500) < 0.01);

// 4. compra en efectivo sin factura
t('Compra sin metodo: error', /efectivo o con tarjeta/.test(tira(() => ctx.registrarCompraEfectivo_('tokchef', { fecha: '2026-09-03', monto: 10, detalle: 'tomate' }))));
t('Compra sin detalle: error', /qué se compró/.test(tira(() => ctx.registrarCompraEfectivo_('tokchef', { fecha: '2026-09-03', metodo: 'efectivo', monto: 10, detalle: '' }))));
D = ctx.registrarCompraEfectivo_('tokchef', { fecha: '2026-09-03', metodo: 'efectivo', proveedor: 'Carnicería Santa Rosa', detalle: '10 lb lomito', monto: 900, area: 'BARRA',
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
D = ctx.registrarCompraEfectivo_('tokchef', { fecha: '2026-09-05', metodo: 'efectivo', llave: f.llave, monto: f.saldo, detalle: '' });
let f2 = ctx.pagEstado_().facturas.filter(x => x.llave === f.llave)[0];
t('Con factura: la factura queda pagada con "Retiro de cajero"', f2.saldo <= 0.01 && f2.pagos.some(p => p.estatus === 'Retiro de cajero'), f.proveedor + ' ' + f.dte + ' Q' + f.saldo);
t('Y cuenta como efectivo registrado', Math.abs(D.resumen.registrado - 900 - f.saldo) < 0.01);
let fb = E.facturas.filter(x => x.saldo > 0.01 && x.area === 'BARRA')[0];
t('Jeffry no paga una factura de barra', fb && /BARRA/.test(tira(() => ctx.registrarCompraEfectivo_('tokchef', { fecha: '2026-09-05', metodo: 'efectivo', llave: fb.llave, monto: fb.saldo }))));

// 6. debito sin factura: se casa con el cargo del banco
const libre = D.cargos_debito.filter(c => !c.casado)[0];
D = ctx.registrarCompraEfectivo_('tokchef', { fecha: libre.fecha, metodo: 'debito', proveedor: libre.glosa, detalle: 'insumos', monto: libre.q });
m = ctx.pagMovimientos_().filter(x => x.detalle.indexOf('[Tarjeta débito BI] insumos') === 0)[0];
t('Debito sin factura: estatus Tarjeta con [Tarjeta débito BI]', m && m.estatus === 'Tarjeta' && m.dte === 'SIN FACTURA');
t('El cargo del banco queda casado con la compra', D.cargos_debito.some(c => c.fecha === libre.fecha && c.q === libre.q && /insumos/.test(c.casado)), libre.glosa + ' ' + libre.q);
t('El debito no cuenta como efectivo', Math.abs(D.resumen.registrado - 900 - f.saldo) < 0.01);

// 7. anular
const idC = D.registradas.filter(x => x.proveedor === 'Carnicería Santa Rosa')[0].id;
t('Maco no anula una compra de cocina (la anotó Jeffry)', /solo el dueño/.test(tira(() => ctx.anularCompraEfectivo('tokmaco', idC))));
D = ctx.anularCompraEfectivo('tokchef', idC);
t('Jeffry anula la suya y vuelve a estar por justificar', !D.registradas.some(x => x.id === idC) && Math.abs(D.resumen.registrado - f.saldo) < 0.01);

// 7b. El retiro y sus compras en un solo guardado (rediseño del 14-oct-2026)
t('Compras registradas muestra solo efectivo', D.registradas.every(x => x.metodo === 'Efectivo'));
const movsAntes = ctx.pagMovimientos_().length, solsAntes = ctx.cpeSolicitudes_().length;
let fx = ctx.pagEstado_().facturas.filter(x => x.saldo > 0.01 && x.area === 'COCINA')[0];
t('Una fila mala no guarda nada (ni el retiro)', /Compra 2: escribí qué se compró/.test(tira(() => ctx.registrarRetiroYCompras('tokchef',
  { fecha: '2026-09-10', retiro: { lugar: 'ATM 095', monto: 1000 }, compras: [{ proveedor: 'Mercado', detalle: 'limones', monto: 50 }, { proveedor: 'X', detalle: '', monto: 20 }] })))
  && ctx.pagMovimientos_().length === movsAntes && ctx.cpeSolicitudes_().length === solsAntes);
t('Retiro sin cajero: error', /cajero/.test(tira(() => ctx.registrarRetiroYCompras('tokchef', { fecha: '2026-09-10', retiro: { lugar: '', monto: 1000 }, compras: [] }))));
t('La misma factura dos veces: error', /dos veces/.test(tira(() => ctx.registrarRetiroYCompras('tokchef', { fecha: '2026-09-10', retiro: null,
  compras: [{ llave: fx.llave, monto: 1 }, { llave: fx.llave, monto: 1 }] }))));
D = ctx.registrarRetiroYCompras('tokchef', { fecha: '2026-09-10', retiro: { lugar: 'ATM 095 Agencia Recolección Antigua', monto: 1000 },
  compras: [{ proveedor: 'Doña Mina', detalle: '10 lb tomate', monto: 300, area: 'COCINA' },
            { proveedor: 'Mercado', detalle: 'limones', monto: 50, sin_factura: true },
            { llave: fx.llave, monto: fx.saldo, detalle: '' },
            { proveedor: '', detalle: '', monto: '' }] });
const nuevos = ctx.pagMovimientos_().slice(movsAntes);
t('Guarda el retiro y las 3 compras de una vez (la fila vacía no cuenta)', ctx.cpeSolicitudes_().length === solsAntes + 1 && nuevos.length === 3, nuevos.length + ' movimientos');
t('Sin factura todavía: "[Factura pendiente]"', nuevos.some(x => x.proveedor === 'Doña Mina' && x.detalle.indexOf('[Factura pendiente]') === 0 && x.estatus === 'Retiro de cajero'));
t('Mercado (no dan factura): sin la marca', nuevos.some(x => x.proveedor === 'Mercado' && x.detalle === 'limones'));
t('Con factura: la paga con Retiro de cajero', ctx.pagEstado_().facturas.filter(x => x.llave === fx.llave)[0].saldo <= 0.01);
const pend = D.registradas.filter(x => x.proveedor === 'Doña Mina')[0];
t('La pantalla la marca pendiente de emitir', pend && pend.pendiente && pend.detalle === '10 lb tomate');
// llega la factura: se asigna
let fy = ctx.pagEstado_().facturas.filter(x => x.saldo > 0.01 && x.area === 'COCINA')[0];
D = ctx.asignarFacturaACompra('tokchef', pend.id, fy.llave);
const fy2 = ctx.pagEstado_().facturas.filter(x => x.llave === fy.llave)[0];
t('Asignar la factura: queda pagada con la compra (misma fecha y monto)', fy2.pagos.some(p => p.estatus === 'Retiro de cajero' && p.fecha === '2026-09-10' && Math.abs(p.q - 300) < 0.01), fy.dte);
t('Y la compra pendiente queda anulada (no cuenta doble)', !D.registradas.some(x => x.id === pend.id));
t('Asignar dos veces: error', /No encontré esa compra/.test(tira(() => ctx.asignarFacturaACompra('tokchef', pend.id, fy.llave))));

// 7c. Auditoria del 14-oct-2026: asignarFacturaACompra bajo un candado, anular primero, deshacer si falla
let tomas = 0, sueltas = 0;
ctx.LockService.getScriptLock = () => ({ waitLock: () => true, tryLock: () => { tomas++; return true; }, releaseLock: () => { sueltas++; } });
D = ctx.registrarRetiroYCompras('tokchef', { fecha: '2026-09-11', retiro: null, compras: [{ proveedor: 'Doña Mina', detalle: '5 lb cebolla', monto: 120 }, { proveedor: 'Mercado', detalle: 'cilantro', monto: 15, sin_factura: true }] });
t('Guardar compras: UN candado para todo', tomas === 1 && sueltas === 1, tomas + ' tomas / ' + sueltas + ' sueltas');
const pend2 = D.registradas.filter(x => x.detalle === '5 lb cebolla')[0], merc = D.registradas.filter(x => x.detalle === 'cilantro')[0];
let fz = ctx.pagEstado_().facturas.filter(x => x.saldo > 120 && x.area === 'COCINA')[0];
t('Sin la marca [Factura pendiente] no se asigna', /no está marcada como factura pendiente/.test(tira(() => ctx.asignarFacturaACompra('tokchef', merc.id, fz.llave))));
let fchica = ctx.pagEstado_().facturas.filter(x => x.saldo > 0.01 && x.saldo < 120 && x.area === 'COCINA')[0];
if (fchica) t('Compra mayor que el saldo de la factura: no se asigna', /no coinciden/.test(tira(() => ctx.asignarFacturaACompra('tokchef', pend2.id, fchica.llave))));
// el pago falla: la compra vuelve a quedar pendiente
const orig = ctx._pagRegistrarPago_;
ctx._pagRegistrarPago_ = function () { throw new Error('falla simulada'); };
t('Si el pago falla, se ve el error', /falla simulada/.test(tira(() => ctx.asignarFacturaACompra('tokchef', pend2.id, fz.llave))));
ctx._pagRegistrarPago_ = orig;
t('…y la compra vuelve a quedar pendiente (no se pierde)', ctx.pagMovimientos_().some(x => x.id === pend2.id && x.estatus === 'Retiro de cajero' && x.detalle.indexOf('[Factura pendiente]') === 0));
tomas = 0; sueltas = 0;
D = ctx.asignarFacturaACompra('tokchef', pend2.id, fz.llave);
t('Asignar: UN candado (anular y pagar adentro)', tomas === 1 && sueltas === 1, tomas + ' tomas / ' + sueltas + ' sueltas');
const anul = (CONFIG.PAGOS_PROVEEDORES || []).filter(r => String(r[11] || r[r.length - 1]) === pend2.id || r.indexOf(pend2.id) !== -1)[0];
t('La compra queda "ANULADO: asignada a la factura …"', anul && anul.some(c => /^ANULADO: asignada a la factura/.test(String(c))), anul && anul.join(' | ').slice(0, 120));
t('Asignar dos veces la misma compra: error', /No encontré esa compra/.test(tira(() => ctx.asignarFacturaACompra('tokchef', pend2.id, fz.llave))));
t('Anular algo ya anulado: avisa', /ya estaba anulado/.test(tira(() => ctx.anularMovimientoPago('tok', pend2.id))));
t('Anular algo que no existe: avisa', /No encontré ese movimiento/.test(tira(() => ctx.anularMovimientoPago('tok', 'no-existe'))));
t('El recibo solo acepta enlaces de Google Drive', ctx._cpeUrlRecibo_('javascript:alert(1)') === '' && ctx._cpeUrlRecibo_('https://drive.google.com/file/d/x') === 'https://drive.google.com/file/d/x');

// 8. Hoy y el vigia: lo de antes del arranque queda cerrado
vm.runInContext("CPE_ARRANQUE_ = '2026-10-01';", ctx);
const ago = ctx.medRetirosMes_(2026, 8), oct = ctx.medRetirosMes_(2026, 10);
t('Agosto: todos los retiros cerrados en el cuadre del 14-oct', ago.n > 0 && ago.con_detalle === ago.n, ago.con_detalle + ' de ' + ago.n);
t('Octubre: los retiros desde el arranque sin compras siguen sin detalle', oct.lista.filter(x => x.fecha >= '2026-10-01').every(x => !x.detalle || /Compras registradas/.test(x.detalle)));

console.log('\n' + ok + ' OK · ' + mal + ' fallas');
process.exit(mal ? 1 : 0);
