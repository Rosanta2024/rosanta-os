/* Harness de la Caja chica (13-oct-2026): corre CajaChica.js real (con Pagos, Cierres y
   FinanzasDatos) en Node. La config va en memoria: PAGOS_PROVEEDORES y CIERRES_DIARIOS
   reales si se pasa CONFIG_XLSX_JSON, mas movimientos armados para cada caso de descuadre.
   Uso: node harness-caja.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = path.join(__dirname, '../../apps-script/rosanta-intranet');   // relativo: corre en cualquier worktree
function revive(v) {
  if (v && typeof v === 'object' && '$d' in v) { const [d, t] = v.$d.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm, ss] = t.split(':').map(Number); return new Date(y, m - 1, dd, hh, mm, ss); }
  return v === null || v === undefined ? '' : v;
}
const maestro = JSON.parse(fs.readFileSync(path.join(__dirname, 'maestro.json')));
Object.keys(maestro).forEach(k => { maestro[k] = maestro[k].map(r => r.map(revive)); });
// el espejo no trae la tarjeta del BI (entro al maestro el 5-oct): vacia, para que Finanzas corra
if (!maestro['06_Tarjeta_Credito_BI']) maestro['06_Tarjeta_Credito_BI'] = [[], [], [], []];
const CONFIG = { USUARIOS: [['correo', 'rol', 'modulos', 'puede_editar', 'nombre', 'token'],
  ['restaurante@rosanta.rest', 'dueno', 'finanzas,recetario', 'SI', 'Juanma', 'tok'],
  ['chef@x.com', 'chef', 'recetario,pagos', 'SI', 'Jeffry', 'tokchef'],
  ['maco@x.com', 'sala', 'recetario,pagos', 'SI', 'Maco', 'tokmaco'],
  ['sala2@x.com', 'sala', 'recetario', 'SI', 'Otro', 'toksala']] };
if (process.env.CONFIG_JSON) Object.assign(CONFIG, JSON.parse(fs.readFileSync(process.env.CONFIG_JSON)));
Object.keys(CONFIG).forEach(k => { CONFIG[k] = CONFIG[k].map(r => r.map(revive)); });
const SHEETS = { '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk': maestro, CONFIG: CONFIG };
function Sheet(name, R) {
  const w = () => R.reduce((a, r) => Math.max(a, r.length), 0);
  const rng = (r, c, nr, nc) => { const g = {
    getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = R[r - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
    setValues: v => { v.forEach((row, i) => { R[r - 1 + i] = R[r - 1 + i] || []; row.forEach((x, j) => { R[r - 1 + i][c - 1 + j] = x; }); }); return g; },
    setValue: x => { R[r - 1] = R[r - 1] || []; R[r - 1][c - 1] = x; return g; },
    clearContent: () => { for (let i = 0; i < (nr || 1); i++) if (R[r - 1 + i]) for (let j = 0; j < (nc || 1); j++) R[r - 1 + i][c - 1 + j] = ''; while (R.length && R[R.length - 1].every(x => x === '')) R.pop(); return g; },
    getFormula: () => '', setFormula: x => { R[r - 1] = R[r - 1] || []; R[r - 1][c - 1] = 'FORMULA'; return g; },
    setFontWeight: () => g, setNumberFormat: () => g }; return g; };
  const self = { getName: () => name, getLastRow: () => R.length, getLastColumn: () => w(),
    getDataRange: () => ({ getValues: () => R.map(r => { const x = r.slice(); while (x.length < w()) x.push(''); return x; }) }),
    getRange: (a, c, nr, nc) => typeof a === 'string' ? rng(1, 1, 1, 1) : rng(a, c, nr, nc), setFrozenRows: () => self };
  return self;
}
function Spreadsheet(id) {
  const src = SHEETS[id]; if (!src) throw new Error('openById ' + id);
  return { getId: () => id, getSheetByName: n => src[n] ? Sheet(n, src[n]) : null, insertSheet: n => { src[n] = []; return Sheet(n, src[n]); } };
}
let uuid = 0; const PROPS = { CONFIG_SHEET_ID: 'CONFIG' };
const ctx = { SpreadsheetApp: { openById: Spreadsheet, flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => PROPS[k] || null, setProperty: (k, v) => { PROPS[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  Utilities: { formatDate: d => d.toISOString(), getUuid: () => ('0000000' + (++uuid)).slice(-8) + '-x',
    DigestAlgorithm: { MD5: 'md5' }, computeDigest: (a, s) => [...crypto.createHash('md5').update(s).digest()], base64Encode: b => Buffer.from(b).toString('base64') },
  Session: { getActiveUser: () => ({ getEmail: () => '' }) },
  LockService: { getScriptLock: () => ({ waitLock: () => true, tryLock: () => true, releaseLock: () => {} }) },
  Logger: { log: () => {} }, console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN };
vm.createContext(ctx);
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'Presupuesto.js', 'PagosProveedores.js', 'CierresDiarios.js', 'CajaChica.js', 'FelCorreo.js', 'ComprasEfectivo.js', 'ProfitHoy.js', 'Tiempos.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
// sin Gmail ni Drive: _pagPagadasCompras_ y el correo del FEL quedan vacios
vm.runInContext("_pagPagadasCompras_ = function () { return {}; }; fecLeerSiToca_ = function () { return null; }; _pagHojaIva_ = function () {}; finCacheClave_ = function () { return 'x'; }; if (typeof fecFacturas_ !== 'function') fecFacturas_ = function () { return []; };", ctx);
let ok = 0, mal = 0;
const t = (n, c, info) => { if (c) ok++; else mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };
const tira = fn => { try { fn(); return ''; } catch (e) { return e.message; } };

// ---- 1. el calculo puro, con dias armados
const C = (efectivo, extra) => Object.assign({ efectivo, cuadra: true, gran_total: efectivo + 1000, tarjeta: 1000, documentos: [], gastos_pos: 0 }, extra || {});
const M = (fecha, tipo, q, extra) => Object.assign({ id: fecha + tipo + q, fecha, tipo, q, categoria: '', concepto: '', ref: '', por: 'Maco' }, extra || {});
const E = ctx.cchCalcular_({
  arranque: { fecha: '2026-10-10', saldo: 1861, nota: 'Excel' }, hoy: '2026-10-17',
  cierres: { '2026-10-11': C(500), '2026-10-12': C(297, { documentos: [{ n: '70', q: 621.5 }, { n: '72', q: 297 }] }),
             '2026-10-13': C(0), '2026-10-14': C(400), '2026-10-15': C(0, { gastos_pos: 80 }) },
  movs: [M('2026-10-11', 'SALIDA', 100), M('2026-10-11', 'CONTEO', 2261),                 // cuadra: 1861+500-100
         M('2026-10-12', 'CONTEO', 1936.5),                                               // faltante 621.5 = doc 70
         M('2026-10-13', 'CONTEO', 1936.5),                                               // sobrante 200 = pago anotado este dia
         M('2026-10-14', 'CONTEO', 2136.5),                                               // faltante 200, compensa el 13
         M('2026-10-15', 'CORRECCION', -50, { ref: 't 9' }), M('2026-10-15', 'CONTEO', 2086.5) ],
  pagos: [{ id: 'p1', fecha: '2026-10-13', q: 200, proveedor: 'Xelac', dte: '1', mercado: false }] });
const d = f => E.dias.find(x => x.fecha === f);
t('11-oct cuadra (1,861 + 500 − 100 = 2,261)', d('2026-10-11').estado === 'Cuadra' && d('2026-10-11').esperado === 2261, d('2026-10-11').estado);
t('12-oct faltante 621.50 y pista del documento 70', d('2026-10-12').estado === 'Faltante' && d('2026-10-12').abierta === -621.5 && /documento 70/.test(d('2026-10-12').pistas.join()), d('2026-10-12').pistas[0]);
t('13-oct arranca de lo contado el 12 (1,936.50)', d('2026-10-13').inicial === 1936.5);
t('13-oct sobrante 200 con pista del pago anotado ese dia', d('2026-10-13').estado === 'Sobrante' && /Xelac/.test(d('2026-10-13').pistas.join()), d('2026-10-13').pistas.join(' | '));
t('14-oct faltante que compensa el 13', d('2026-10-14').estado === 'Faltante' && /Compensa/.test(d('2026-10-14').pistas.join()), d('2026-10-14').pistas.join(' | '));
t('15-oct con corrección cuadra y avisa gastos del POS', d('2026-10-15').estado === 'Cuadra' && /POS registró/.test(d('2026-10-15').pistas.join()), d('2026-10-15').pistas.join(' | '));
t('16-oct sin cierre: Falta el cierre', d('2026-10-16').estado === 'Falta el cierre');
t('17-oct (hoy) en curso', d('2026-10-17').estado === 'En curso');
t('resumen: 3 descuadres, falta 821.50, sobra 200', E.resumen.descuadres === 3 && E.resumen.faltante === 821.5 && E.resumen.sobrante === 200, JSON.stringify(E.resumen));
const E2 = ctx.cchCalcular_({ arranque: { fecha: '2026-10-10', saldo: 1861, nota: 'Excel' }, hoy: '2026-10-12', cierres: { '2026-10-11': C(0) },
  movs: [M('2026-10-11', 'CONTEO', 1800), M('2026-10-11', 'ACEPTADO', -61, { concepto: 'no se encontró' })], pagos: [] });
t('Diferencia aceptada deja de contar como abierta', E2.dias[0].estado === 'Diferencia aceptada' && E2.resumen.descuadres === 0);
const E3 = ctx.cchCalcular_({ arranque: { fecha: '2026-10-10', saldo: 1861, nota: 'Excel' }, hoy: '2026-10-13', cierres: {},
  movs: [M('2026-10-11', 'ARRANQUE', 1500, { concepto: 'conteo' }), M('2026-10-12', 'EFECTIVO_CIERRE', 0), M('2026-10-12', 'CONTEO', 1500)], pagos: [] });
t('Un ARRANQUE del dueño reemplaza al del Excel', E3.arranque.saldo === 1500 && E3.dias[0].fecha === '2026-10-12' && E3.dias[0].estado === 'Cuadra', E3.dias[0].estado);

// Sin conteo cubierto por un conteo posterior (14-oct-2026)
const E4 = ctx.cchCalcular_({ arranque: { fecha: '2026-10-10', saldo: 1861, nota: 'Excel' }, hoy: '2026-10-15',
  cierres: { '2026-10-11': C(209), '2026-10-12': C(297), '2026-10-13': C(0) }, movs: [M('2026-10-13', 'CONTEO', 2367)], pagos: [] });
t('11 y 12 sin conteo quedan cubiertos por el conteo del 13', E4.dias[0].cubierto === '2026-10-13' && E4.dias[1].cubierto === '2026-10-13' && E4.resumen.sin_conteo === 0,
  E4.dias.map(d => d.fecha.slice(8) + ' ' + d.estado + (d.cubierto ? ' cubierto' : '')).join(' · '));
const E5 = ctx.cchCalcular_({ arranque: { fecha: '2026-10-10', saldo: 1861, nota: 'Excel' }, hoy: '2026-10-15',
  cierres: { '2026-10-11': C(209), '2026-10-12': C(297), '2026-10-13': C(0) }, movs: [M('2026-10-11', 'CONTEO', 2070)], pagos: [] });
t('Sin conteo DESPUES del ultimo conteo sigue pendiente', !E5.dias[1].cubierto && !E5.dias[2].cubierto && E5.resumen.sin_conteo === 2);

// ---- 2. la pantalla y las escrituras sobre la config en memoria
t('El chef no entra a la caja', /lleva Maco/.test(tira(() => ctx.getCajaChica('tokchef'))));
t('Sala sin el modulo pagos no entra', /lleva Maco/.test(tira(() => ctx.getCajaChica('toksala'))));
const hoy = ctx.medFechaIso_(new Date());
const mov = (...a) => ctx.registrarMovimientoCaja(...a);
t('No se anota antes del arranque', /arranca el/.test(tira(() => mov('tokmaco', 'SALIDA', '2026-10-09', 'otro', 'algo', 10, '', ''))));
t('Maco no acepta diferencias', /dueño/.test(tira(() => mov('tokmaco', 'ACEPTADO', hoy, '', 'x y z', 5, '', ''))));
t('Corrección pide el ticket', /ticket/.test(tira(() => mov('tokmaco', 'CORRECCION', hoy, '', '', -198, '', ''))));
let P = ctx.getCajaChica('tokmaco');
t('Maco ve la caja', P.dias.length > 0, P.dias.length + ' días desde el ' + P.arranque.fecha + ', saldo ' + P.resumen.saldo);
P = mov('tokmaco', 'SALIDA', hoy, 'mantenimiento', 'manguera', 75, '', 'Cemaco');
const nPag = () => Math.max(0, (CONFIG.PAGOS_PROVEEDORES || []).length - 1);
const antes = nPag();
P = mov('tokmaco', 'SALIDA', hoy, 'cocina', 'limones y menta', 60, '', 'Mercado');
t('Compra de cocina sin factura va a Pagos como Pagado de caja', nPag() === antes + 1 && P.dias[0].pagos_mercado >= 60, P.dias[0].pagos_mercado);
P = ctx.registrarConteoCaja('tokmaco', hoy, P.dias[0].esperado - 100, '');
t('Conteo con 100 menos: faltante', P.dias[0].estado === 'Faltante' && P.dias[0].abierta === -100, P.dias[0].estado + ' ' + P.dias[0].abierta);
t('Un monto redondo sin otra pista lo dice', P.dias[0].pistas.length > 0, P.dias[0].pistas.join(' | '));
const filas07 = maestro['07_Caja_Chica'] || [];
t('El maestro tiene 07_Caja_Chica con las salidas', filas07.length >= 6 && filas07.slice(4).some(r => r[4] === 'MANTENIMIENTO') && filas07.slice(4).some(r => r[4] === 'ALIMENTOS_EFECTIVO'),
  (filas07.length - 4) + ' filas: ' + filas07.slice(4).map(r => r[4]).join(', '));
const idSal = P.dias[0].movs.find(m => m.tipo === 'SALIDA').id;
t('Otro sala no anula lo de Maco', /lleva Maco|anula el dueño/.test(tira(() => ctx.anularMovimientoCaja('toksala', idSal))));
P = ctx.anularMovimientoCaja('tokmaco', idSal);
t('Maco anula su salida', !P.dias[0].movs.some(m => m.id === idSal));
const idMerc = P.dias[0].pagos.find(p => p.mercado).id;
P = ctx.anularMovimientoCaja('tokmaco', idMerc);
t('Maco anula su compra de cocina desde la caja (aunque en Pagos es de cocina)', !P.dias[0].pagos.some(p => p.id === idMerc));
// pagar una factura de cocina desde la caja la saca de Por pagar
const facts = ctx.getFacturasParaCaja('tokmaco');
const coc = facts.find(f => f.grupo === 'ALIMENTOS');
t('Maco ve facturas de cocina para pagar de caja', !!coc, facts.length + ' por pagar');
if (coc) {
  P = ctx.pagarFacturaDeCaja('tokmaco', [coc.llave], hoy, null, 'de caja');
  const sigue = ctx.getFacturasParaCaja('tokmaco').find(f => f.llave === coc.llave);
  t('La factura pagada de caja sale de Por pagar y aparece en la caja', !sigue && P.dias[0].pagos.some(p => !p.mercado && p.dte === coc.dte), coc.proveedor + ' ' + coc.dte + ' ' + coc.saldo);
  t('En el maestro va como PAGO_FACTURA_FEL', (maestro['07_Caja_Chica'] || []).slice(4).some(r => r[4] === 'PAGO_FACTURA_FEL'));
}
// Por devolver en comun (13-oct-2026): todos ven a todos; cada quien agrega lo suyo
let G = ctx.getPagosProveedores('tokchef');
t('El chef ve Por devolver de José y de Jeffry', G.por_devolver.length === 2 && G.mi_equipo === 'Jeffry', G.por_devolver.map(x => x.nombre).join(', '));
t('El chef no agrega a nombre de José', /pagaste vos/.test(tira(() => ctx.agregarCompraDeSuBolsa('tokchef', 'José', hoy, 'Mercado', 'limones', 20))));
const fCoc = ctx.getFacturasParaDevolver('tokmaco').find(f => f.grupo === 'ALIMENTOS');
if (fCoc) {
  G = ctx.agregarFacturaDeSuBolsa('tokmaco', 'José', [fCoc.llave], hoy, null, 'de mi bolsa');
  const jose = G.por_devolver.find(x => x.nombre === 'José');
  t('Maco agrega una factura de cocina que pagó de su bolsa', jose.movs.some(m => m.dte === fCoc.dte), fCoc.proveedor + ' ' + fCoc.saldo);
  const idJ = jose.movs.find(m => m.dte === fCoc.dte).id;
  G = ctx.anularMovimientoPago('tokmaco', idJ);
  t('Maco anula lo suyo aunque la factura sea de cocina', !G.por_devolver.find(x => x.nombre === 'José').movs.some(m => m.id === idJ));
}
G = ctx.agregarCompraDeSuBolsa('tokchef', '', hoy, 'Mercado', 'limones y menta', 45);
t('Jeffry agrega una compra sin factura', G.por_devolver.find(x => x.nombre === 'Jeffry').pendiente >= 45);
// Para reducir IVA en comun (13-oct-2026)
{
  const P0 = ctx.getPagosProveedores('tokchef');
  const fc = P0.facturas.find(f => f.saldo > 0.01 && f.area === 'COCINA' && !f.pagos.length && !f.por_correo);
  const fb = ctx.getPagosProveedores('tokmaco').facturas.find(f => f.saldo > 0.01 && f.area === 'BARRA' && !f.pagos.length && !f.por_correo);
  t('Jeffry no marca una factura de barra', fb && /BARRA/.test(tira(() => ctx.marcarFacturaParaIva('tokchef', fb.llave, ''))));
  if (fc) {
    const P1 = ctx.marcarFacturaParaIva('tokchef', fc.llave, 'gasto de la casa');
    const x = P1.para_iva.find(a => a.llave === fc.llave);
    t('Jeffry marca una de cocina y la lista dice que la marcó él', x && x.marco === 'Jeffry', fc.proveedor + ' ' + fc.dte);
    t('Maco ve la lista y no puede devolver la de Jeffry', ctx.getPagosProveedores('tokmaco').para_iva.some(a => a.llave === fc.llave) && /marcó Jeffry/.test(tira(() => ctx.devolverFacturaParaIva('tokmaco', fc.llave))));
    const P2 = ctx.devolverFacturaParaIva('tokchef', fc.llave);
    t('Jeffry la devuelve', !P2.para_iva.some(a => a.llave === fc.llave));
  }
}
// Pagos contra banco y tarjetas (13-oct-2026)
{
  t('Nombre pegado en la glosa (5+ letras)', ctx._pagNombreEnGlosa_(['supermercados', 'torre'], 'LATORREANTIGUA2DBGT') && !ctx._pagNombreEnGlosa_(['mesa'], 'COMESAGT'));
  const B = ctx.pagPagosBanco_(ctx.SpreadsheetApp.openById(ctx.FIN_MAESTRO_ID));
  t('Pagos lee las tarjetas', B.some(p => p.tarjeta), B.filter(p => p.tarjeta).length + ' cargos de tarjeta');
  const E0 = ctx.pagEstado_();
  t('Hay posibles pagos y ninguno es un traspaso propio', Array.isArray(E0.posibles) && !E0.posibles.some(x => /CORSAGA|PAGO TARJETA/i.test(x.pago.glosa)), E0.posibles.length + ' posibles');
  if (E0.posibles.length) {
    const P = E0.posibles[0], o = P.opciones[0];
    t('Maco no confirma pagos del banco', /dueño/.test(tira(() => ctx.confirmarPosiblePago('tokmaco', P.pago.llave, o.llaves))));
    const G2 = ctx.confirmarPosiblePago('tok', P.pago.llave, o.llaves);
    const E1 = ctx.pagEstado_();
    t('Confirmado: la factura queda pagada y el pago ya no se ofrece', o.llaves.every(k => E1.facturas.find(f => f.llave === k).saldo <= 0.01) && !E1.posibles.some(x => x.pago.llave === P.pago.llave),
      o.facturas.map(f => f.proveedor + ' ' + f.dte).join('+') + ' ← ' + P.pago.banco + ' ' + P.pago.glosa);
  }
}
// Abonos marcados Banco (13-oct-2026): bajan el saldo y quedan por confirmar
{
  const fa = ctx.pagEstado_().facturas.find(f => f.saldo > 100 && f.area === 'COCINA' && !f.pagos.length && !f.por_correo);
  if (fa) {
    const mitad = Math.round(fa.saldo / 2 * 100) / 100;
    ctx.registrarPagoFacturas('tokchef', [fa.llave], 'Banco', ctx.medFechaIso_(new Date()), mitad, 0, 'abono', 'Banco BI');
    t('Banco sin cuenta no se guarda', /transferencia/.test(tira(() => ctx.registrarPagoFacturas('tokchef', [fa.llave], 'Banco', ctx.medFechaIso_(new Date()), 1, 0, '', ''))));
    const f1 = ctx.pagEstado_().facturas.find(f => f.llave === fa.llave);
    t('Un abono marcado Banco baja el saldo y queda por confirmar', f1.estado === 'Abonada' && Math.abs(f1.saldo - (fa.saldo - mitad)) < 0.02 && Math.abs(f1.por_confirmar - mitad) < 0.02,
      fa.proveedor + ' ' + f1.estado + ' saldo ' + f1.saldo + ' por confirmar ' + f1.por_confirmar);
  }
}
// Pago fraccionado (13-oct-2026): dos cargos del mismo proveedor que suman la factura
{
  const F = [{ llave: 'r', nit: '9', dte: '1', proveedor: 'ARRENDAMIENTOS SANTA ROSA', fecha: '2026-08-18', dia: 100, saldo: 20212.5, area: 'ADMIN', categoria: 'ALQUILERES', palabras: ['arrendamientos', 'santa', 'rosa'] }];
  const P = [{ llave: 'a', banco: 'Banco BI', fecha: '2026-08-24', dia: 106, q: 15212.5, glosa: '1aRentaAgosto2026', categoria: 'ALQUILERES' },
             { llave: 'b', banco: 'Banco BI', fecha: '2026-08-31', dia: 113, q: 5000, glosa: '2aRentaAgosto2026', categoria: 'ALQUILERES' },
             { llave: 'c', banco: 'Banco BI', fecha: '2026-08-31', dia: 113, q: 5000, glosa: 'S35 Mercado', categoria: 'ALIMENTOS_EFECTIVO' }];
  const R = ctx._pagPosibles_(F, P), fr = R.find(x => x.pagos);
  const F2 = [['c1', 500, 100], ['c2', 300, 102], ['c3', 700, 104]].map(([k, q, d]) => ({ llave: k, nit: '7', dte: k, proveedor: 'LA COFRADIA DE LOS VINOS', fecha: '2026-08-2' + (d - 100), dia: d, saldo: q, area: 'BARRA', categoria: 'LICORES', palabras: ['cofradia', 'vinos'] }));
  const P2 = [{ llave: 'x', banco: 'Banco BI', fecha: '2026-08-28', dia: 108, q: 800, glosa: 'S35 Cofradia', categoria: 'LICORES' },
              { llave: 'y', banco: 'Banco BI', fecha: '2026-08-30', dia: 110, q: 700, glosa: 'S35 Cofradia 2', categoria: 'LICORES' }];
  const R2 = ctx._pagPosibles_(F2, P2), fr2 = R2.find(x => x.pagos);
  t('Tres facturas con dos transferencias del mismo proveedor: pago fraccionado', fr2 && fr2.pagos.length === 2 && fr2.opciones[0].llaves.length === 3, fr2 && fr2.opciones[0].llaves.join('+') + ' ← ' + fr2.pago.glosa);
  t('Renta en dos partes: se ofrece como pago fraccionado', fr && fr.pagos.length === 2 && fr.pagos.every(p => p.glosa.indexOf('Renta') >= 0), fr && fr.pago.glosa);
}
// Hoy (13-oct-2026): la lista de cada uno
vm.runInContext("invEstadoCierre_ = function () { return { esperado: '2026-09', dia_limite: 5, areas: { COCINA: { estado_esperado: 'ABIERTO', zona: 'rojo', dias_atraso: 8 }, BARRA: { estado_esperado: 'CERRADO', zona: 'verde' } } }; };", ctx);
const H = tok => ctx.getHoyProfit(tok);
const hD = H('tok'), hC = H('tokchef'), hM = H('tokmaco');
const vistas = h => h.items.map(x => x.vista).join(',');
t('Hoy del dueño: pagos, inventario, caja, retiros', /pagos/.test(vistas(hD)) && /inventario/.test(vistas(hD)) && hD.fallas.length === 0, hD.items.map(x => (x.urgente ? '!' : '') + x.texto).join(' | ') + (hD.fallas.length ? ' FALLAS ' + hD.fallas : ''));
t('Hoy de Jeffry: sin caja, con inventario de cocina', !/caja/.test(vistas(hC)) && hC.items.some(x => /cocina de septiembre/.test(x.texto)) && hC.fallas.length === 0, hC.items.map(x => x.texto).join(' | '));
t('Hoy de Maco: sin inventario de barra (cerrado) ni retiros de cocina', !hM.items.some(x => /inventario/.test(x.texto)) && !/cocina/.test(vistas(hM)), hM.items.map(x => x.texto).join(' | '));
t('Hoy: lo urgente va primero', hD.items.every((x, i, a) => i === 0 || !x.urgente || a[i - 1].urgente));
t('Hoy: Jeffry ve lo que se le debe', hC.items.some(x => /te debe/.test(x.texto)));
// Hoy: SAT sin avisar (14-oct-2026)
const D_ = (y, m, d, h) => new Date(y, m - 1, d, h || 10);
t('SAT: el dia siguiente al ultimo aviso todavia no avisa', ctx.fecDiasSinAviso_(D_(2026, 10, 13), D_(2026, 10, 14, 18)) === 0);
t('SAT: un dia habil completo sin avisos', ctx.fecDiasSinAviso_(D_(2026, 10, 13), D_(2026, 10, 15)) === 1);
t('SAT: el domingo no cuenta', ctx.fecDiasSinAviso_(D_(2026, 10, 17), D_(2026, 10, 19)) === 0 && ctx.fecDiasSinAviso_(D_(2026, 10, 13), D_(2026, 10, 19)) === 4);
const FC = ['FECHA', 'TIPO', 'SERIE', 'NUMERO', 'NIT', 'NOMBRE', 'ESTABLECIMIENTO', 'MONEDA', 'MONTO', 'AUTORIZACION', 'MENSAJE_ID', 'LEIDO'];
const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
CONFIG.FEL_CORREO = [FC, ['2026-10-01', 'FACT', 'A', '111', '1', 'X', 'ECONTRISA', 'GTQ', 1680, 'a', 'm1', hace(4)],
                         ['', '', '', '', '', 'no es aviso de DTE', '', '', '', '', 'm2', hace(0)]];
let hS = H('tok');
const sat = hS.items.filter(x => /SAT no avisa/.test(x.texto))[0];
t('Hoy del dueño: avisa que SAT no manda avisos (el "no es aviso" no cuenta)', sat && sat.vista === 'pagos' && /ECONTRISA/.test(sat.detalle), sat ? sat.texto + ' · ' + sat.detalle : hS.fallas.join(' | '));
t('Jeffry no ve la alerta de SAT', !H('tokchef').items.some(x => /SAT/.test(x.texto)));
CONFIG.FEL_CORREO[1][11] = hace(0);
t('Con un aviso de hoy no hay alerta', !H('tok').items.some(x => /SAT no avisa/.test(x.texto)));
PROPS.CORREOS_DEL_DIA = JSON.stringify({ cuando: new Date().toISOString(), fel: { errores: ['Gmail caido'] } });
const hErr = H('tok').items.filter(x => /lectura de correos de las 10:00|No se pudo leer el correo/.test(x.texto));
t('Si la lectura de las 10:00 falló, avisa UNA vez (Correos del día)', hErr.length === 1 && hErr[0].urgente, hErr.map(x => x.texto).join(' | '));
delete PROPS.CORREOS_DEL_DIA; delete CONFIG.FEL_CORREO;
// Hoy: cada boton lleva al punto exacto y las acciones tienen "Listo" (14-oct-2026)
t('Hoy: cada boton de Pagos y Caja lleva su punto exacto', hD.items.filter(x => x.vista === 'pagos' || x.vista === 'caja').every(x => x.sub), hD.items.map(x => x.vista + ':' + (x.sub || '-')).join(' '));
const hoyIso = new Date().toISOString().slice(0, 10);
CONFIG.ACCIONES = [['SEMANA', 'PILAR', 'ACCION', 'DUENO', 'FECHA_LIMITE', 'ESTADO', 'ESCRITO_POR', 'CREADA', 'CERRADA', 'REGLA', 'PORQUE', 'META'],
  ['2026-S42', 'profit', 'Revisar porciones del lomito', 'Jeffry', hoyIso, 'pendiente', 'Vigía', new Date(), '', '', '', ''],
  ['2026-S42', 'profit', 'Llamar cotizaciones', 'Juanma', hoyIso, 'pendiente', 'Vigía', new Date(), '', '', '', '']];
let hJ = H('tokchef'), accJ = hJ.items.filter(x => x.accion)[0];
t('Jeffry ve su acción con Listo (y no la de Juanma)', accJ && accJ.accion.fila === 2 && !hJ.items.some(x => /cotizaciones/.test(x.texto)), hJ.items.map(x => x.texto).join(' | '));
t('Jeffry no marca la de Juanma', /es de Juanma/.test(tira(() => ctx.marcarAccionHoy('tokchef', 3, 'Llamar cotizaciones'))));
t('Texto cambiado: no se marca', /cambió/.test(tira(() => ctx.marcarAccionHoy('tokchef', 2, 'otra cosa'))));
hJ = ctx.marcarAccionHoy('tokchef', 2, 'Revisar porciones del lomito');
t('Jeffry marca la suya: queda hecha y sale de Hoy', CONFIG.ACCIONES[1][5] === 'hecha' && !hJ.items.some(x => x.accion));
delete CONFIG.ACCIONES;

// el DRE lee 07_Caja_Chica sin romperse
let fd = ''; try { ctx._finDatos_(true); } catch (e) { fd = e.stack.split('\n').slice(0, 4).join(' | '); }
t('Finanzas corre con la pestaña nueva', fd === '', fd);
if (!fd) { const F = ctx._finDatos_(true); const cob = F.integridad && F.integridad.cobertura && F.integridad.cobertura['07_Caja_Chica'];
  t('El DRE cubre 07_Caja_Chica', !!cob, JSON.stringify(cob)); }
console.log(mal ? mal + ' FALLAS de ' + (ok + mal) : 'todo OK (' + ok + ')');
process.exit(mal ? 1 : 0);
