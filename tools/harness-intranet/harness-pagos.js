/* Harness de pagos a proveedores (p213, 29-sep-2026): corre PagosProveedores.js real sobre el
   espejo del maestro, con la pestaña PAGOS_PROVEEDORES en memoria (esta SI se escribe).
   Uso: node harness-pagos.js [desde AAAA-MM-DD]  (por defecto 2026-08-01, para tener datos) */
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
  LockService: { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) },
  Logger: { log: () => {} }, console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN };
vm.createContext(ctx);
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'PagosProveedores.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
const desde = process.argv[2] || '2026-08-01';
vm.runInContext("PAG_DESDE_ = '" + desde + "';", ctx);
let ok = 0, mal = 0;
const t = (n, c, info) => { if (c) ok++; else mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };
const tira = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

// 1. funcion pura del banco con datos de juguete
const F = (llave, nit, dte, dia, saldo, pal, marca) => ({ llave, nit, dte, dia, saldo, palabras: pal, marcaBanco: marca });
let r = ctx._pagCasarBanco_([F('a', '1', '111111', 100, 500, ['cofradia'], null), F('b', '1', '222222', 101, 300, ['cofradia'], null)],
                            [{ llave: 'p', dia: 105, q: 800, glosa: 'S35 Cofradia 111111' }]);
t('DTE en la glosa + otra del mismo NIT sin marca: dudoso, no se inventa', !r.casados.a && r.dudosos.length === 1);
r = ctx._pagCasarBanco_([F('a', '1', '111111', 100, 500, [], 104), F('b', '1', '222222', 101, 300, [], 104)],
                        [{ llave: 'p', dia: 105, q: 800, glosa: 'S35 Cofradia 111111' }]);
t('DTE en la glosa + otra marcada Banco del mismo NIT suman exacto: casa las dos', r.casados.a === 'p' && r.casados.b === 'p');
r = ctx._pagCasarBanco_([F('a', '1', '1', 100, 500, [], 104), F('c', '2', '3', 100, 500, [], 104)],
                        [{ llave: 'p', dia: 105, q: 500, glosa: 'TRANSFERENCIA' }]);
t('Dos NIT marcados con el mismo monto: dudoso', !r.casados.a && !r.casados.c && r.dudosos.length === 1);
r = ctx._pagCasarBanco_([F('a', '1', '1', 100, 500, ['xelac'], null)], [{ llave: 'p', dia: 105, q: 500, glosa: 'OTRO PROVEEDOR GT' }]);
t('Sin marca y sin el nombre en la glosa: suelto aunque el monto calce', !r.casados.a && r.sueltos.length === 1);
r = ctx._pagCasarBanco_([F('a', '1', '1', 100, 500, ['xelac'], null)], [{ llave: 'p', dia: 105, q: 500, glosa: 'S38 XELAC VARIOS' }]);
t('Sin marca, con el nombre y monto exacto: casa', r.casados.a === 'p');
r = ctx._pagCasarBanco_([F('a', '1', '1', 100, 500, [], 150)], [{ llave: 'p', dia: 105, q: 500, glosa: 'x' }]);
t('Marcada Banco despues del pago (fuera de ventana): no casa', !r.casados.a);

// 2. la pantalla sobre el espejo
const est = ctx.pagEstado_();
const fs_ = est.facturas;
const cuenta = k => fs_.filter(f => f.estado === k).length;
t('Hay facturas desde ' + desde, fs_.length > 0, fs_.length + ' facturas, Q' + Math.round(fs_.reduce((a, f) => a + f.total, 0)));
console.log('      estados: pagada ' + cuenta('Pagada') + ' · pendiente ' + cuenta('Pendiente') + ' · abonada ' + cuenta('Abonada') +
            ' · áreas ' + JSON.stringify(fs_.reduce((a, f) => (a[f.area] = (a[f.area] || 0) + 1, a), {})) +
            ' · banco dudosos ' + est.banco_dudosos.length + ' · sueltos de mercadería ' + est.banco_sueltos.length + ' · banco hasta ' + est.banco_ult);
t('Ninguna factura sin area', fs_.every(f => ['COCINA', 'BARRA', 'ADMIN'].indexOf(f.area) !== -1));
const chef = ctx.getPagosProveedores('tokchef'), maco = ctx.getPagosProveedores('tokmaco'), due = ctx.getPagosProveedores('tok');
t('El chef ve solo cocina', chef.facturas.every(f => f.area === 'COCINA') && chef.facturas.length > 0, chef.facturas.length);
t('Maco ve solo barra', maco.facturas.every(f => f.area === 'BARRA') && maco.facturas.length > 0, maco.facturas.length);
t('El dueño ve todo, y solo él el banco dudoso', due.facturas.length === fs_.length && !chef.banco_dudosos && !!due.banco_dudosos);
t('Sin modulo pagos no entra', /no tiene pagos/.test(tira(() => ctx.getPagosProveedores('toksin'))));
t('Sin token no entra', /identificarte/.test(tira(() => ctx.getPagosProveedores(''))));

// 3. escrituras
const pend = chef.facturas.filter(f => f.estado === 'Pendiente');
const f1 = pend[0];
t('Maco no puede pagar una factura de cocina', /es de COCINA/.test(tira(() => ctx.registrarPagoFacturas('tokmaco', [f1.llave], 'Pagado de caja', '2026-09-29'))));
let v = ctx.registrarPagoFacturas('tokchef', [f1.llave], 'Pagado de caja', '2026-09-29', _r(f1.total / 2), 0, 'abono');
let g = v.facturas.find(f => f.llave === f1.llave);
t('Abono deja la factura Abonada con su saldo', g.estado === 'Abonada' && Math.abs(g.saldo - (f1.total - _r(f1.total / 2))) < 0.011, g.estado + ' saldo ' + g.saldo);
v = ctx.registrarSaldoFavor('tokchef', f1.nit, 10, 'crédito de la semana');
v = ctx.registrarPagoFacturas('tokchef', [f1.llave], 'Tarjeta', '2026-09-30', null, 10);
g = v.facturas.find(f => f.llave === f1.llave);
t('Saldo a favor + pago cierran la factura', g.estado === 'Pagada' && Math.abs(g.saldo) < 0.011, g.estado + ' ' + g.saldo);
const cu = v.cuadre.find(x => x.nit === f1.nit);
t('Cuadre: el saldo a favor usado vuelve a 0', Math.abs(cu.favor) < 0.011, JSON.stringify(cu));
t('Pagar una factura ya pagada tira', /ya esta pagada/.test(tira(() => ctx.registrarPagoFacturas('tokchef', [f1.llave], 'Tarjeta', '2026-09-30'))));
const dosNit = pend.filter(f => f.nit !== f1.nit);
const otro = dosNit.find(f => f.nit !== dosNit[0].nit);
t('No junta dos proveedores', /un solo proveedor/.test(tira(() => ctx.registrarPagoFacturas('tokchef', [dosNit[0].llave, otro.llave], 'Tarjeta', '2026-09-30'))));
t('Y el intento fallido no escribio nada', v.facturas.find(f => f.llave === dosNit[0].llave).estado === 'Pendiente');
const f2 = pend.find(f => f.nit !== f1.nit);
v = ctx.registrarPagoFacturas('tokchef', [f2.llave], 'Banco', '2026-09-29');
g = v.facturas.find(f => f.llave === f2.llave);
t('Marcada Banco sin estado de cuenta: Banco por confirmar (o casada si el banco ya la trae)', g.estado === 'Banco por confirmar' || g.estado === 'Pagada', g.estado);
v = ctx.programarPagoFactura('tokchef', pend[2].llave, '2026-10-05');
t('Programar pone FECHA DE PAGAR', v.facturas.find(f => f.llave === pend[2].llave).fecha_pagar === '2026-10-05');
v = ctx.registrarCompraMercado('tokmaco', '2026-09-29', 'Mercado central', 'limones y menta', 85, 'COCINA', 'Retiro de cajero');
t('Mercado de Maco queda en BARRA aunque pida cocina', v.mercado.length === 1 && v.mercado[0].area === 'BARRA');
t('Compras en efectivo ve el mercado pagado con retiro', ctx.medMercadoDeRetiros_().length === 1);
const idm = v.mercado[0].id;
t('El chef no puede anular un movimiento de barra', /es de BARRA/.test(tira(() => ctx.anularMovimientoPago('tokchef', idm))));
v = ctx.anularMovimientoPago('tokmaco', idm);
t('Anular lo saca de la lista sin borrar la fila', v.mercado.length === 0 && CONFIG.PAGOS_PROVEEDORES.some(r => /^ANULADO/.test(r[6])));
// 4. facturas anteriores al arranque (pestaña #19 de COMPRAS_2026), con PAG_DESDE_ al 28-sep
vm.runInContext("PAG_DESDE_ = '2026-09-28';", ctx);
t('Solo el dueño trae facturas anteriores', /dueño/.test(tira(() => ctx.traerFacturaAnterior('tokchef', '1938509046'))));
t('Un DTE que no esta en el FEL se rechaza', /no está en el FEL/.test(tira(() => ctx.traerFacturaAnterior('tok', '2550065899'))));
v = ctx.traerFacturaAnterior('tok', '743853199', 64, '', 'semana 19');
let an = v.facturas.find(f => f.dte === '743853199');
t('Anterior con abono: queda por pagar solo el saldo', an && Math.abs(an.saldo - 64) < 0.011 && an.anterior && an.estado === 'Abonada', an && (an.estado + ' ' + an.saldo));
v = ctx.traerFacturaAnterior('tok', '1938509046');
an = v.facturas.find(f => f.dte === '1938509046');
t('Anterior entera: saldo = total y grupo del Excel', an && Math.abs(an.saldo - an.total) < 0.011 && an.grupo === 'BEBIDAS Y COCTELERIA', an && an.grupo);
t('Maco la ve (es de barra) y el chef no', ctx.getPagosProveedores('tokmaco').facturas.some(f => f.dte === '1938509046') && !ctx.getPagosProveedores('tokchef').facturas.some(f => f.dte === '1938509046'));
t('No se trae dos veces', /ya está/.test(tira(() => ctx.traerFacturaAnterior('tok', '1938509046'))));
t('Proveedores de mercado: primero los ya usados, despues la lista base', v.proveedores_mercado[0] === 'Mercado central' || v.proveedores_mercado.indexOf('Mercado') !== -1, v.proveedores_mercado.slice(0, 4).join(', '));
// 5. balance del año (COMPRAS_2026 no esta en el harness: tiene que avisar y seguir)
const bal = ctx._pagBalance_(2026);
const cof = bal.filas.find(x => x.nit === '86809970'), alt = bal.filas.find(x => x.nit === '5564662'), eli = bal.filas.find(x => x.nit === '5213541');
t('Balance: avisa que no leyo COMPRAS_2026 y sigue', bal.avisos.length === 1 && bal.filas.length > 10, bal.avisos[0]);
t('Balance: Cofradia facturado Q22,268 y banco por nombre', cof && Math.abs(cof.facturado - 22268) < 1 && cof.banco > 15000, cof && (cof.facturado + ' / banco ' + cof.banco));
t('Balance: Altogas cuenta el pago del BAC por alias', alt && alt.banco >= 8456, alt && alt.banco);
t('Balance: sin explicar = diferencia - ya por pagar', bal.filas.every(x => Math.abs(x.sin_explicar - (x.diferencia - x.pendiente)) < 0.02));
t('Balance: solo el dueño', /solo para el dueño/.test(tira(() => ctx.getBalanceProveedores('tokchef'))));
console.log('      top sin explicar: ' + bal.filas.slice(0, 6).map(x => x.proveedor.slice(0, 18) + ' ' + Math.round(x.sin_explicar)).join(' · '));
console.log('\nPestaña PAGOS_PROVEEDORES (' + (CONFIG.PAGOS_PROVEEDORES.length - 1) + ' filas):');
CONFIG.PAGOS_PROVEEDORES.forEach(r => console.log('  ' + r.slice(0, 9).map(x => x instanceof Date ? 'fecha' : String(x)).join(' | ')));
console.log('\n' + ok + ' OK · ' + mal + ' fallas');
function _r(n) { return Math.round(n * 100) / 100; }
process.exit(mal ? 1 : 0);
