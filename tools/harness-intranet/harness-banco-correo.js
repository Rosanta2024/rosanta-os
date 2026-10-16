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
['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js', 'MedicionDatos.js', 'PagosProveedores.js', 'CierresDiarios.js', 'FelCorreo.js', 'BancoCorreo.js', 'Tiempos.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
let ok = 0, mal = 0;
const t = (n, c, info) => { if (c) ok++; else mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? '  → ' + info : '')); };

// 1. El aviso del BI (la lavanderia del 16-oct-2026, recortado a sus celdas)
const td = (a, b) => '<tr><td bgcolor="#cce6ff"><p class="style3"><strong>' + a + '</strong></p>\r\n</td><td bgcolor="#eeeeee"><p class="style3">' + b + '</p></td></tr>';
const aviso = '<table>' + td('Banco:', 'Banco Industrial S.A.') + td('Generado por:', 'CORSAGA SOCIEDAD ANONIMA                          ') +
  '<tr><td colspan="2"><p><strong>Informaci&oacute;n \r\n de destino de transacci&oacute;n</strong></p></td></tr>' +
  td('Banco:', 'INDUSTRIAL') + td('Cuenta:', '1724398') + td('Nombre:', 'ASTURIAS PAREDES GUSTAVO ') +
  td('Descripci&oacute;n de pago:', 'Lavanderia oct2026') + td('Cr&eacute;dito de:', 'Q.1,301.00') + '</table>';
const b = ctx.bcoParsear_(aviso);
t('El aviso se lee entero', b && b.banco_destino === 'INDUSTRIAL' && b.cuenta === '1724398' && b.nombre === 'ASTURIAS PAREDES GUSTAVO' && b.desc === 'Lavanderia oct2026' && b.q === 1301, JSON.stringify(b));
t('Una transferencia que no genera CORSAGA no entra', ctx.bcoParsear_(aviso.replace('CORSAGA SOCIEDAD ANONIMA', 'OTRA SA')) === null);
t('En dolares no entra', ctx.bcoParsear_(aviso.replace('Q.1,301.00', 'US$.10.00')) === null);
t('Un correo cualquiera da null', ctx.bcoParsear_('<p>Hola</p>') === null);

// 2. El cruce con el estado de cuenta (datos fijos)
const D = s => ctx.pagNumDia_(ctx.pagDia_(s));
const crudo = [
  { llave: 'BI|1', fecha: '2026-09-29', dia: D('2026-09-29'), q: 2500, glosa: '2a Septiembre jeffry', categoria: 'NOMINA' },
  { llave: 'BI|2', fecha: '2026-09-29', dia: D('2026-09-29'), q: 1250, glosa: 'Grupo Eco Septiembre', categoria: 'ALQUILER_EQUIPO' },
  { llave: 'BI|3', fecha: '2026-10-12', dia: D('2026-10-12'), q: 99, glosa: 'otra cosa', categoria: 'GASTOS_VARIOS' }];
const C = (id, fecha, q, desc, cuenta, nombre) => ({ id, fecha, dia: D(fecha), hora: '12:00', medio: 'Banco BI', q, desc, cuenta, nombre });
const correos = [
  C('m1', '2026-09-29', 2500, '2a Septiembre jeffry', '974521858', 'JEFFRY'),     // ya en el estado de cuenta
  C('m2', '2026-09-29', 1250, 'Grupo Eco Septiembre', '902673292', 'Grupo ECO SA'), // idem
  C('m3', '2026-10-05', 777, 'Algo que no llego', '1', 'X'),                        // el estado de cuenta cubre el dia y no esta
  C('m4', '2026-10-16', 2500, 'Octubre jeffry', '974521858', 'JEFFRY'),            // nueva, de planilla (la cuenta lo dice)
  C('m5', '2026-10-16', 301, 'Lavanderia oct2026', '1724398', 'ASTURIAS'),          // nueva, cuenta sin historia
  C('m6', '2026-10-16', 50, 'Quincena Juan', '55', 'JUAN')];                        // nueva, glosa de planilla
const X = ctx._bcoCruzar_(correos, crudo);
t('Lo que ya esta en el estado de cuenta no se repite', !X.pagos.some(p => /Septiembre/.test(p.glosa)), X.pagos.map(p => p.glosa).join(' | '));
t('La planilla se reconoce por la cuenta y no entra a Pagos', !X.pagos.some(p => /jeffry/i.test(p.glosa)));
t('La glosa de planilla tampoco entra', !X.pagos.some(p => /Quincena/.test(p.glosa)));
t('La nueva entra como cargo del BI por correo', X.pagos.length === 1 && X.pagos[0].banco === 'Banco BI' && X.pagos[0].correo && X.pagos[0].categoria === 'POR_CLASIFICAR' && X.pagos[0].glosa === 'Lavanderia oct2026 · ASTURIAS');
t('Su llave es la que tendra el cargo del lunes', X.pagos[0] && ctx._pagLlavePago_(X.pagos[0]) === 'Banco BI|2026-10-16|301|Lavanderia oct2026');
t('La que no aparece en un dia ya cubierto queda como faltante', X.faltantes.length === 1 && X.faltantes[0].q === 777, JSON.stringify(X.faltantes));
t('El alias lleva al cargo del estado de cuenta', X.alias['Banco BI|2026-09-29|1250|Grupo Eco Septiembre'] === 'Banco BI|2026-09-29|1250|Grupo Eco Septiembre');
t('Una glosa cortada o sin espacios cuenta como la misma', ctx._bcoMismaGlosa_('LAVANDERIAOCT2026', 'Lavanderia oct2026') && ctx._bcoMismaGlosa_('Pago Distribuidora La', 'Pago Distribuidora La Florida 123') && !ctx._bcoMismaGlosa_('S38', 'S38 Cofradia'));

// 3. De punta a punta sobre el espejo: un aviso de hoy con el nombre del proveedor y el monto de una factura abierta
ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
const E0 = ctx.pagEstado_();
const abierta = E0.facturas.filter(f => f.saldo > 0.01 && f.estado === 'Pendiente' && !f.por_correo && f.area !== 'ADMIN')
  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
const hoy = new Date(), iso = ctx.pagIso_(hoy);
CONFIG.BANCO_CORREO = [ctx.BCO_COLS_.slice(),
  [iso, '12:14', 'Banco BI', 'BAC', '903941979', abierta.razon || abierta.proveedor, abierta.proveedor + ' ' + abierta.dte, abierta.saldo, 'mx', hoy],
  // un aviso que ya esta en el estado de cuenta: no se duplica
  ['2026-09-29', '18:47', 'Banco BI', 'BAC', '902673292', 'Grupo ECO SA', 'Grupo Eco Septiembre', 1250, 'my', hoy]];
ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
const E1 = ctx.pagEstado_();
const f1 = E1.facturas.find(f => f.llave === abierta.llave);
t('La factura queda Pagada con el aviso del banco', f1 && f1.estado === 'Pagada' && f1.pagos.some(p => p.estatus === 'Banco por correo' && p.por === 'Banco BI'),
  abierta.proveedor + ' ' + abierta.dte + ' Q' + abierta.saldo + ' → ' + (f1 && f1.estado) + ' ' + JSON.stringify(f1 && f1.pagos.map(p => p.estatus)));
t('El aviso ya cargado no aparece como pendiente (solo el de hoy)', E1.banco_correo.pendientes.length === 1 && !/Grupo Eco/.test(E1.banco_correo.pendientes[0].glosa) && E1.banco_correo.faltantes.length === 0, JSON.stringify(E1.banco_correo));
const otras = E1.facturas.filter(f => f.llave !== abierta.llave && E0.facturas.find(g => g.llave === f.llave).estado !== f.estado);
t('Ninguna otra factura cambia', otras.length === 0, otras.map(f => f.proveedor + ' ' + f.dte).join(', '));
t('La fecha del banco no se corre por el aviso', E1.banco_ult === E0.banco_ult, E1.banco_ult);

console.log('\n' + ok + ' OK · ' + mal + ' fallas');
process.exit(mal ? 1 : 0);
