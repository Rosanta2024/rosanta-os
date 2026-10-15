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
  LockService: { getScriptLock: () => ({ waitLock: () => true, tryLock: () => true, releaseLock: () => {} }) },
  Logger: { log: () => {} }, console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN };
vm.createContext(ctx);
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'PagosProveedores.js', 'CierresDiarios.js', 'FelCorreo.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
const desde = process.argv[2] || '2026-08-01';
vm.runInContext("PAG_DESDE_ = '" + desde + "';", ctx);
let ok = 0, mal = 0;
const t = (n, c, info) => { if (c) ok++; else mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };
const tira = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

// Posibles pagos (14-oct-2026, Juanma): "S36 Industrias VGS 1156465795" y "MC Industrias 2253014585"
// traen el numero de la factura que pagan. En la intranet esas facturas ya estaban pagadas (COMPRAS_2026)
// y los cargos se ofrecian como abonos a Doorways o como pago de otra factura de Bodega Feliz.
{
  const origCompras = ctx._pagPagadasCompras_;
  ctx._pagPagadasCompras_ = () => ({ '1156465795': { hoja: 'S34', estatus: 'Pagado', fecha: '2026-09-08' }, '2253014585': { hoja: 'S33', estatus: 'Pagado', fecha: '2026-09-16' } });
  ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
  const EP = ctx.pagEstado_();
  const glosas = EP.posibles.map(x => x.pago.glosa);
  t('Un cargo con el numero de una factura ya pagada no se ofrece para otra', !glosas.some(g => /1156465795|2253014585/.test(g)), glosas.filter(g => /\d{9}/.test(g)).join(' | '));
  t('No se ofrecen abonos por la sola categoria (Doorways)', !EP.posibles.some(x => x.opciones.some(o => o.abono && o.facturas.some(f => /DOORWAYS/i.test(f.proveedor)) && !/doorway/i.test(x.pago.glosa))));
  const tav = EP.posibles.filter(x => /480330786/.test(x.pago.glosa))[0];
  t('Con el numero de una factura abierta, solo se ofrece esa', !tav || tav.opciones.every(o => o.facturas.length === 1 && o.facturas[0].dte === '480330786'));
  ctx._pagPagadasCompras_ = origCompras;
  ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
}

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
// Comisiones de tarjeta fuera de Pagos (8-oct-2026): con control positivo, para que la
// prueba no pase en verde con un espejo que no las trae.
const felCom = (() => { const v = maestro['01_FEL_Maestro']; const hi = v.findIndex(r => r.map(String).indexOf('NIT_Emisor') >= 0);
  const iC = v[hi].indexOf('Categoría'), iF = v[hi].indexOf('Fecha');
  return v.slice(hi + 1).filter(r => String(r[iC]).trim() === 'COMISION TARJETA DE CREDITO' && ctx.pagDia_(r[iF]) >= ctx.pagDia_(desde)).length; })();
t('El espejo trae comisiones de tarjeta desde ' + desde + ' (control)', felCom > 0, felCom);
t('Ninguna comision de tarjeta llega a Pagos', fs_.every(f => f.categoria !== 'COMISION TARJETA DE CREDITO') &&
  ctx.getPagosProveedores('tok').facturas.every(f => f.categoria !== 'COMISION TARJETA DE CREDITO'));
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
v = ctx.registrarPagoFacturas('tokchef', [f1.llave], 'Tarjeta', '2026-09-30', null, 10, '', 'Tarjeta crédito BAC');
g = v.facturas.find(f => f.llave === f1.llave);
t('Saldo a favor + pago cierran la factura', g.estado === 'Pagada' && Math.abs(g.saldo) < 0.011, g.estado + ' ' + g.saldo);
const cu = v.cuadre.find(x => x.nit === f1.nit);
t('Cuadre: el saldo a favor usado vuelve a 0', Math.abs(cu.favor) < 0.011, JSON.stringify(cu));
t('Pagar una factura ya pagada tira', /ya esta pagada/.test(tira(() => ctx.registrarPagoFacturas('tokchef', [f1.llave], 'Tarjeta', '2026-09-30', null, 0, '', 'Tarjeta crédito BAC'))));
const dosNit = pend.filter(f => f.nit !== f1.nit);
const otro = dosNit.find(f => f.nit !== dosNit[0].nit);
t('No junta dos proveedores', /un solo proveedor/.test(tira(() => ctx.registrarPagoFacturas('tokchef', [dosNit[0].llave, otro.llave], 'Tarjeta', '2026-09-30', null, 0, '', 'Tarjeta crédito BAC'))));
t('Y el intento fallido no escribio nada', v.facturas.find(f => f.llave === dosNit[0].llave).estado === 'Pendiente');
const f2 = pend.find(f => f.nit !== f1.nit);
v = ctx.registrarPagoFacturas('tokchef', [f2.llave], 'Banco', '2026-09-29', null, 0, '', 'Banco BI');
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
t('La fila de una factura anterior no se puede anular', /no un pago/.test(tira(() => ctx.anularMovimientoPago('tokmaco', CONFIG.PAGOS_PROVEEDORES.find(r => r[6] === 'Pendiente anterior' && r[7] === '5213541')[11]))));
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

// 3. FEL por correo (13-oct-2026): un Gmail de mentira con el aviso real de ECONTRISA (el HTML
//    tal cual llega), el mismo aviso repetido, una factura ya cargada en el FEL y un correo que no es aviso.
const td = (a, b) => "<tr><td style='background-color: #4682B4;'>" + a + " </td><td style='border: 1px solid black;'>" + b + '</td></tr>';
const aviso = (tipo, num, emisor, est, fecha, monto) => "<img src='x'><hr><b><h3>Guatemala</h3></b><div align='center'><table width='70%'><tr><td colspan=5> <b> INFORMACIÓN DEL DOCUMENTO</b></td></tr>" +
  td('Tipo', tipo) + td('Número Autorización  ', '8E42DDAB-F394-4BE4-8B57-36F650588E39') + td('Serie  ', '8E42DDAB') + td('Número', num) +
  td('Emisor  ', emisor) + td('Establecimiento  ', est) + td('Fecha de emisión  ', fecha) + td('Monto  ', monto) + '</table></div>';
const b64 = h => Buffer.from(h, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const MSGS = {
  m1: aviso('FACT - Factura', '4086582244', '67283667 - ESTRATEGIAS CONTABLES Y TRIBUTARIAS, SOCIEDAD ANONIMA', '1 - ECONTRISA', '2026-10-13T10:04:00', 'GTQ - 1,680.00'),
  m2: aviso('FACT - Factura', '4086582244', '67283667 - ESTRATEGIAS CONTABLES Y TRIBUTARIAS, SOCIEDAD ANONIMA', '1 - ECONTRISA', '2026-10-13T10:04:00', 'GTQ - 1,680.00'),
  m3: aviso('FACT - Factura', '4195500623', '76431754 - ESTACION DE SERVICIO EL PANORAMA , SOCIEDAD ANONIMA', '1 - ESTACION DE SERVICIO EL PANORAMA', '2026-10-05T08:13:30.001-06:00', 'GTQ - 200.00'),
  m4: '<p>Otra cosa</p>' };
let consultas = [];
ctx.Gmail = { Users: { Messages: {
  list: (u, o) => { consultas.push(o); return { messages: Object.keys(MSGS).map(id => ({ id })) }; },
  get: (u, id) => ({ payload: { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b64(MSGS[id]) } }] } }) } } };
ctx.Utilities.base64Decode = s => Buffer.from(s, 'base64');
ctx.Utilities.newBlob = b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') });
const p1 = ctx.fecParsear_(MSGS.m1);
t('Aviso de SAT: se lee cada campo', p1 && p1.tipo === 'FACT' && p1.numero === '4086582244' && p1.nit === '67283667' && p1.establecimiento === 'ECONTRISA' && p1.fecha === '2026-10-13' && p1.monto === 1680, JSON.stringify(p1));
t('Correo que no es aviso: null', ctx.fecParsear_(MSGS.m4) === null);
const antes = ctx.pagEstado_().facturas.length;
const r1 = ctx.fecLeer_();
t('Lectura: 2 nuevas, la repetida se salta, la que no es aviso se anota para no releerla', r1.nuevos === 2 && r1.repetidos === 1 && r1.otros === 1 && !r1.errores.length, JSON.stringify(r1));
t('Busca tambien en la papelera', consultas[0].includeSpamTrash === true && /notificacionesfel@sat\.gob\.gt/.test(consultas[0].q));
const r2 = ctx.fecLeer_();
t('Segunda lectura: nada nuevo', r2.nuevos === 0 && r2.repetidos === 4, JSON.stringify(r2));
const e2 = ctx.pagEstado_(), ec = e2.facturas.filter(f => f.dte === '4086582244'), pan = e2.facturas.filter(f => f.dte === '4195500623');
t('ECONTRISA aparece una vez, por correo, en ADMIN', ec.length === 1 && ec[0].por_correo && ec[0].area === 'ADMIN' && ec[0].total === 1680 && ec[0].fecha === '2026-10-13', ec[0] && (ec[0].categoria + ' / ' + ec[0].grupo + ' / ' + ec[0].estado));
t('El Panorama ya esta en el FEL: no se duplica ni queda como por correo', pan.length <= 1 && pan.every(f => !f.por_correo), pan.length + ' fila(s)');
t('Total de facturas = las del FEL + 1', e2.facturas.length === antes + 1, antes + ' → ' + e2.facturas.length);
const dueno = ctx.getPagosProveedores('tok');
t('La pantalla del dueño la trae y sin aviso de error', dueno.facturas.some(f => f.dte === '4086582244' && f.por_correo) && !dueno.aviso_correo, dueno.aviso_correo);
t('Cocina no la ve (es de ADMIN)', !ctx.getPagosProveedores('tokchef').facturas.some(f => f.dte === '4086582244'));
t('Para reducir IVA: no se puede marcar una por correo', /llego por correo/.test(tira(() => ctx.marcarFacturaParaIva('tok', ec[0].llave, ''))));
ctx.Gmail.Users.Messages.list = () => { throw new Error('Gmail caido'); };
// una ejecucion nueva de Apps Script: lo leido en la anterior (y la marca de que se guardo) no sigue
ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
const caido = ctx.getPagosProveedores('tok');
t('Si Gmail falla, Pagos abre igual y avisa', caido.facturas.length > 0 && /Gmail caido/.test(caido.aviso_correo), caido.aviso_correo);
console.log('\nPestaña PAGOS_PROVEEDORES (' + (CONFIG.PAGOS_PROVEEDORES.length - 1) + ' filas):');
CONFIG.PAGOS_PROVEEDORES.forEach(r => console.log('  ' + r.slice(0, 9).map(x => x instanceof Date ? 'fecha' : String(x)).join(' | ')));

// "No pertenece" en Posibles pagos (14-oct-2026)
{
  ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
  const antes = ctx.getPagosProveedores('tok'), P0 = antes.posibles[0];
  if (P0) {
    t('Jeffry no puede descartar un posible pago', /dueño/.test(tira(() => ctx.descartarPosiblePago('tokchef', P0.pago.llave))));
    ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
    const bal0 = ctx._pagBalance_ ? JSON.stringify(ctx._pagBalance_(2026).filas.map(x => x.pagado)) : '';
    const desp = ctx.descartarPosiblePago('tok', P0.pago.llave);
    t('No pertenece: el cargo sale de Posibles pagos', !desp.posibles.some(x => x.pago.llave === P0.pago.llave), P0.pago.glosa);
    t('…y queda en la lista de descartados', desp.descartados.length >= 1 && desp.descartados[0].detalle.indexOf(P0.pago.glosa.slice(0, 10)) !== -1, desp.descartados[0] && desp.descartados[0].detalle);
    if (bal0) t('…y el Balance del año no cambia', JSON.stringify(ctx._pagBalance_(2026).filas.map(x => x.pagado)) === bal0);
    ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
    const vuelve = ctx.anularMovimientoPago('tok', desp.descartados[0].id);
    t('Volver a ofrecer: el cargo reaparece', vuelve.posibles.some(x => x.pago.llave === P0.pago.llave));
  }
}
console.log('\n' + ok + ' OK · ' + mal + ' fallas');
function _r(n) { return Math.round(n * 100) / 100; }
process.exit(mal ? 1 : 0);
