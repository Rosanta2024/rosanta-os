/* Harness de Node: corre el CODIGO REAL de la intranet sobre el espejo del maestro y
   los exports de inventario, con mocks minimos de Apps Script. No escribe nada. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(process.env.HOME, 'Dev/Rosanta/apps-script/rosanta-intranet');
const H = __dirname;

function revive(v) {
  if (v && typeof v === 'object' && '$d' in v) { const [d, t] = v.$d.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm, ss] = t.split(':').map(Number); return new Date(y, m - 1, dd, hh, mm, ss); }
  if (v === null || v === undefined) return '';
  return v;
}
const maestro = JSON.parse(fs.readFileSync(path.join(H, 'maestro.json')));
const inv = JSON.parse(fs.readFileSync(path.join(H, 'inventarios.json')));
Object.keys(maestro).forEach(k => { maestro[k] = maestro[k].map(r => r.map(revive)); });

const CONFIG = {
  USUARIOS: [['correo', 'rol', 'modulos', 'puede_editar', 'nombre', 'token'],
             ['restaurante@rosanta.rest', 'dueno', 'finanzas,recetario,marketing,crm,consola,resenas', 'SI', 'Juanma', 'tok'],
             ['chef@x.com', 'chef', 'recetario', 'SI', 'Chef', 'tokchef']],
  PARAMETROS: [['parametro', 'valor'], ['margen_minimo_pct', 60], ['food_cost_objetivo_pct', 28]],
  COMPROMISOS: [['CONCEPTO', 'MONTO', 'MONEDA', 'FRECUENCIA', 'CUANDO', 'TIPO', 'NOTAS'],
                ['Retiro de Juanma', 5000, 'GTQ', 'mensual por semana', 'sabado', 'piso', ''],
                ['Alquiler de la casa de Juanma', 1800, 'USD', 'mensual cuando alcance', 1, 'piso', ''],
                ['Devolucion a Raul', 100000, 'GTQ', 'unico', '2027-03-15', 'objetivo', '']],
  RAA: [['SEMANA', 'INDICADOR', 'ZONA', 'RESULTADO', 'ANALISIS', 'ACCION', 'RESPONSABLE', 'FECHA', 'ESCRITO_POR']],
  PRESUPUESTO: [['Seccion', 'Tipo', 'Valor', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                ['Inmueble y ocupacion', 'fijo', 20212.5, '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Comisiones y cargos', '%venta', 6.5, '', '', '', '', '', '', '', '', '', '', '', '']]
};
const CRM = {
  maestra: [['first_name', 'telefono', 'email', 'idioma', 'fuente', 'segmento', 'ultima_reserva', 'gasto_gtq', 'opt_in', 'notas', 'fecha_alta', 'ultimo_intento'],
    ['A', '1', '', 'ES', 'Wix', 'Cliente que visitó', '', 500, '', '', new Date(2026, 7, 3), ''],
    ['B', '2', '', 'ES', 'Wix', 'Cliente que visito', '', 500, '', '', '2026-08-10', ''],
    ['C', '3', '', 'ES', 'Wix', 'Reserva histórica', '', 0, '', '', new Date(2026, 7, 12), ''],
    ['D', '4', '', 'ES', 'Wix', 'Carrito abandonado', '', 0, '', '', new Date(2026, 7, 12), ''],
    ['E', '5', '', 'ES', 'Wix', 'Cliente que visitó', '', 700, '', '', new Date(2026, 6, 1), ''],
    ['F', '6', '', 'ES', 'Wix', 'Reserva histórica', '', 0, '', '', new Date(2026, 6, 2), ''],
    ['G', '7', '', 'ES', 'Wix', 'Reserva histórica', '', 0, '', '', new Date(2026, 6, 3), ''],
    ['H', '8', '', 'ES', 'Wix', 'Cliente que visitó', '', 700, '', '', new Date(2025, 6, 1), '']]
};
const MKT = { pauta_semanal: [['wk', 'gCosto', 'gClics', 'gImp', 'mCosto', 'mAlcance', 'reservas', 'fecha_registro', 'comensales', 'comensalesReserva', 'ticket', 'clientes_nuevos'],
  [32, 300, 0, 0, 500, 0, 0, new Date(2026, 7, 10), 40, 30, 250, 5],
  [33, 300, 0, 0, 500, 0, 0, new Date(2026, 7, 17), 30, 20, 260, 4]] };

const SHEETS = {
  '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk': maestro,
  'CONFIG': CONFIG,
  '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM': CRM,
  '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc': MKT,
  'INVC': inv.cocina, 'INVB': inv.barra,
  '1dKTJ0KRKTyLyiQEZ2pCUh3i446Cy0S_yvmqp1ac_H_E': {},   // planilla: sin pestañas -> respaldo, como el Python
  'COSTEO': {}, 'REC': {}
};
function Sheet(name, rows) {
  const R = rows.map(r => r.slice());
  const w = R.reduce((a, r) => Math.max(a, r.length), 0);
  R.forEach(r => { while (r.length < w) r.push(''); });
  const self = {
    getName: () => name,
    getLastRow: () => R.length, getLastColumn: () => w,
    getDataRange: () => ({ getValues: () => R.map(r => r.slice()) }),
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = R[r - 1 + i] || []; const o = []; for (let j = 0; j < (nc || 1); j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(o); } return out; },
      getValue: () => (R[r - 1] || [])[c - 1], setValue: () => { throw new Error('escritura en harness'); }, setValues: () => { throw new Error('escritura en harness'); },
      setFontWeight: () => self, setNumberFormat: () => self
    })
  };
  return self;
}
function Spreadsheet(id) {
  const src = SHEETS[id]; if (!src) throw new Error('openById: hoja desconocida ' + id);
  const names = Object.keys(src);
  return { getId: () => id, getName: () => id,
           getSheets: () => names.map(n => Sheet(n, src[n])),
           getSheetByName: n => src[n] ? Sheet(n, src[n]) : null,
           insertSheet: () => { throw new Error('insertSheet en harness'); } };
}
const cache = {};
const ctx = {
  SpreadsheetApp: { openById: Spreadsheet, flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => ({ CONFIG_SHEET_ID: 'CONFIG', INV_COCINA_SHEET_ID: 'INVC', INV_BARRA_SHEET_ID: 'INVB', COSTEO_SHEET_ID: 'COSTEO', RECETARIO_COCINA_SHEET_ID: 'REC', RECETARIO_BARRA_SHEET_ID: 'REC' })[k] || null, setProperty: () => {}, deleteProperty: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] === undefined ? null : cache[k], put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k]) }) },
  Utilities: { formatDate: (d, tz, f) => { const p = n => (n < 10 ? '0' : '') + n; return f.indexOf('HH') > -1 ? `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}` : (f === 'yyyy-MM-dd' ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`); },
               base64EncodeWebSafe: s => Buffer.from(String(s)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'), getUuid: () => 'uuid-1234-5678-9012', sleep: () => {} },
  Session: { getActiveUser: () => ({ getEmail: () => 'restaurante@rosanta.rest' }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }), getDocumentLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
  Logger: { log: (...a) => console.log('[Logger]', ...a) },
  HtmlService: { createTemplateFromFile: () => { throw new Error('HtmlService no disponible en harness'); }, createHtmlOutputFromFile: () => { throw new Error('HtmlService'); } },
  DriveApp: { getFolderById: () => { throw new Error('DriveApp no disponible'); } },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }) },
  console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, parseFloat, parseInt, Buffer
};
vm.createContext(ctx);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
const first = ['Config.js', 'ConfigCosteo.js', 'FinanzasDatos.js'];
const orden = first.concat(files.filter(f => first.indexOf(f) === -1).sort());
const fallas = [];
orden.forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) { fallas.push(f + ': ' + e.message); } });
console.log('archivos cargados:', orden.length, fallas.length ? '\nFALLAS DE CARGA:\n  ' + fallas.join('\n  ') : '(todos)');

const run = (n, fn) => { try { const r = fn(); console.log('\n=== ' + n + ' OK'); return r; } catch (e) { console.log('\n=== ' + n + ' FALLO: ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n')); return null; } };

// ---- 1. el motor de Finanzas con los campos nuevos, contra el Python
const d = run('_finCalcular_', () => ctx._finCalcular_());
if (d) {
  const py = JSON.parse(fs.readFileSync(process.env.CINCO_JSON || path.join(H, '..', 'datos_maestro', '_datos_finanzas', 'cinco.json')));
  const dif = [];
  d.meses.forEach(x => {
    const p = py.meses.find(z => z.mes === x.mes); if (!p) { dif.push(x.mes + ': no esta en Python'); return; }
    [['neto', 'neto'], ['ebitda', 'ebitda'], ['ebitdap', 'ebitdap'], ['eventos_n', 'eventos_n'], ['sin_factura', 'sin_factura'], ['sin_factura_iva', 'sin_factura_iva'], ['mb_comensal', 'mb_comensal'], ['com_lmx_dia', 'com_lmx_dia'], ['medios', 'medios']].forEach(([a, b]) => {
      const va = x[a], vb = p[b];
      if (va === null && vb === null) return;
      if (Math.abs((va || 0) - (vb || 0)) > 0.06) dif.push(`${x.mes}.${a}: motor ${va} vs python ${vb}`);
    });
    console.log(`${x.mes}: neto ${x.neto} · ebitda ${x.ebitda} (${x.ebitdap}%) · ev ${x.eventos_n} · sinF ${x.sin_factura} · mb/com ${x.mb_comensal} · LMX ${x.com_lmx_dia}/dia (${x.com_lmx_dias} d) · medios ${x.medios}`);
  });
  console.log('AÑO: ebitda', d.total.ebitda, d.total.ebitdap + '%', '· sin factura', d.total.sin_factura, '· medios', d.total.medios, '· dias caja', d.dias_caja);
  console.log('Python año: ebitda', py.tot.ebitda, '· sin factura', py.tot.sin_factura, '· medios', py.tot.medios);
  console.log(dif.length ? 'DIFERENCIAS motor vs Python:\n  ' + dif.join('\n  ') : 'MOTOR == PYTHON en los 9 campos nuevos, todos los meses');
  // el año del motor contra el Python
  if (Math.abs(d.total.ebitda - py.tot.ebitda) > 1) console.log('DIF año ebitda', d.total.ebitda, py.tot.ebitda);
  if (Math.abs(d.total.sin_factura - py.tot.sin_factura) > 1) console.log('DIF año sin_factura', d.total.sin_factura, py.tot.sin_factura);
}

// ---- 2. inventario al dia
const ic = run('invEstadoCierre_ (25-sep, limite 5)', () => ctx.invEstadoCierre_(new Date(2026, 8, 25), 5));
if (ic) console.log(JSON.stringify(ic, null, 1).slice(0, 1200));
const ic2 = run('invEstadoCierre_ (3-sep, limite 5: dentro del plazo)', () => ctx.invEstadoCierre_(new Date(2026, 8, 3), 5));
if (ic2) console.log('cocina', ic2.areas.COCINA.zona, '· barra', ic2.areas.BARRA.zona);

// ---- 3. altas del CRM por mes (sintetico: ago 2 visito + 1 historica + 1 carrito; jul 1 + 2)
const al = run('crmAltasPorMes_(2026)', () => ctx.crmAltasPorMes_(2026));
if (al) console.log('jul', JSON.stringify(al[7]), '\nago', JSON.stringify(al[8]), '\nesperado: ago visito 2, historica 1, lectura 66.7 · jul visito 1, historica 2, lectura 33.3');

// ---- 4. parametros
const P = run('tabParametros_', () => ctx.tabParametros_());
if (P) console.log(Object.keys(P).map(k => k + '=' + P[k].valor + ' (' + P[k].origen + ')').join(' · '));

// ---- 5. marketing kpis
const mk = run('mktKpisMes_', () => ctx.mktKpisMes_(2026, d));
if (mk) console.log('ago', JSON.stringify(mk.meses[8]), '\naltas_error:', mk.altas_error);

// ---- 6. el tablero, pilar por pilar, con el token del dueño
['fundamentos', 'management', 'finanzas', 'profit', 'marketing', 'expansion'].forEach(p => {
  const r = run('getTableroPilar(' + p + ')', () => ctx.getTableroPilar('tok', p));
  if (!r) return;
  if (r.error) console.log('  error del pilar:', r.error);
  if (r.avisos && r.avisos.length) console.log('  avisos:', r.avisos.join(' | '));
  if (r.texto) console.log('  texto:', r.texto.slice(0, 80) + '…');
  (r.kpis || []).forEach(k => console.log(`  ${k.clave} ${k.zona.padEnd(8)} ${String(k.valor).padStart(12)} ${k.unidad.padEnd(6)} ${k.periodo} · meta ${k.meta} (${k.meta_origen}) ${k.estado !== 'ok' ? '[' + k.estado + ']' : ''}${k.tendencia ? ' · vs ' + k.tendencia.etiqueta + ' ' + k.tendencia.dif : ''}`));
});
// el chef no entra
run('getTableroPilar con token de chef (debe fallar)', () => { try { ctx.getTableroPilar('tokchef', 'finanzas'); throw new Error('ENTRO'); } catch (e) { if (e.message === 'ENTRO') throw e; return 'rechazado: ' + e.message; } });

// ---- 7. "no calcula": cada valor identico a su campo
if (d) {
  const f = ctx.getTableroPilar('tok', 'finanzas');
  const by = {}; f.kpis.forEach(k => { by[k.clave] = k; });
  const mc = ctx.tabMesCerrado_(d, new Date());
  const checks = [['K04', by.K04 && by.K04.valor, d.dias_caja], ['K06', by.K06 && by.K06.valor, d.ultima.prime_m4],
                  ['K07', by.K07 && by.K07.valor, mc.ultimo && mc.ultimo.neto], ['K09', by.K09 && by.K09.valor, mc.ultimo && mc.ultimo.sin_factura],
                  ['K10', by.K10 && by.K10.valor, mc.ultimo && mc.ultimo.ebitda]];
  console.log('\n=== NO CALCULA: ' + checks.map(c => c[0] + (c[1] === c[2] ? ' ok' : ' DIF ' + c[1] + '≠' + c[2])).join(' · '));
}

// ---- 8. las pruebas nuevas de PruebasFinanzas, con el runner real
run('prFinanzas_ (grupo 8 completo, solo se listan las nuevas)', () => {
  const res = { grupos: [] };
  try { ctx.prFinanzas_(res); } catch (e) { console.log('  prFinanzas_ se corto:', e.message); }
  const g = (res.grupos || [])[0] || res[Object.keys(res)[0]];
  const lista = (g && (g.pruebas || g.items || g.lista)) || [];
  const nuevas = lista.filter(p => /EBITDA|sin factura del mes|medios del a|tablero global|metas del tablero/i.test(p.nombre || p.n || ''));
  nuevas.forEach(p => console.log('  ' + (p.estado || p.e) + ' · ' + (p.nombre || p.n) + ' · ' + (p.detalle || p.d || '')));
  return nuevas.length + ' pruebas nuevas encontradas de ' + lista.length;
});
