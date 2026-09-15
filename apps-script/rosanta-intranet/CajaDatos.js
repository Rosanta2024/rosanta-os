/**
 * CajaDatos.gs — proyeccion de caja a 90 dias. Pestana Caja del shell de Finanzas.
 *
 * Pilar 3, Finance & Data OS. Pendientes p94 (el calendario) y p122 (la meta).
 * Diseño aprobado por Juanma el 15-sep-2026.
 *
 * QUE RESPONDE
 *   En que fecha el saldo del banco cruza cero, y el colchon de 7 dias de gasto, en
 *   tres escenarios; y cuanta venta adicional o cuanto costo menos hace falta para
 *   que no lo cruce. La caja se rompe el dia 15, no el 30: por eso es un calendario
 *   dia por dia y no un promedio mensual.
 *
 * DE DONDE SALE CADA NUMERO. Todo se mide del maestro; nada va escrito a mano.
 *   Punto de partida  el ultimo saldo cargado de Banco Industrial mas el de BAC.
 *   Venta             promedio de las ultimas 8 semanas completas (TotalFinal: con
 *                     IVA y servicio, que es lo que se cobra), por la estacionalidad
 *                     de 2025 (el mes de 2025 contra el promedio de los meses de 2025
 *                     que cubren esas 8 semanas; un mes anomalo de FIN_NOTAS_2025 vale 1).
 *   Escenarios        como salio cada una de las ultimas 20 semanas contra el promedio
 *                     de sus 8 anteriores: pesimista el cuartil bajo, base la mediana,
 *                     optimista el cuartil alto.
 *   Cobro             la parte de la venta que entra al banco en las ultimas 16
 *                     semanas, repartida por dia de la semana como entra hoy.
 *   Salidas           las ultimas 16 semanas del banco, por grupo (_cajaGrupo_):
 *                       planilla    la devengada de cada mes (_finUltimoDevengado_),
 *                                   en los tramos del mes en que se paga
 *                       propinas, IGSS, alquiler del local: promedio mensual, en sus tramos
 *                       SAT         % de la venta del mes anterior, en su tramo
 *                       mercaderia  % de la venta, dia a dia
 *                       resto       promedio diario
 *                       tarjeta     los cargos del NEGOCIO en la tarjeta, promedio diario
 *                     Quedan fuera lo personal, la devolucion de inversion, el pago de
 *                     la tarjeta y los traspasos entre cuentas propias: lo personal
 *                     entra por los COMPROMISOS y la tarjeta por sus cargos del negocio.
 *   Aguinaldo         50% de la planilla el 10-dic y 50% el 20-ene (Juanma, 15-sep-2026).
 *   Bono 14           la planilla entera el 10-jul.
 *   Compromisos       pestana COMPROMISOS del Sheet de config, que edita Juanma. Sin la
 *                     pestana se usan los de CAJA_DEFECTO y la pantalla lo dice.
 *
 * AMBITO GLOBAL: todo empieza con caja / _caja. PERMISOS: getCajaData pide el token
 * primero; instalarCompromisos es de editor y pide dueño.
 */

var CAJA_HOJA = 'COMPROMISOS';
var CAJA_COLS = ['CONCEPTO', 'MONTO', 'MONEDA', 'FRECUENCIA', 'CUANDO', 'TIPO', 'NOTAS'];

/**
 * Los compromisos de por defecto, dados por Juanma el 15-sep-2026.
 *   FRECUENCIA  semanal (CUANDO = dia de la semana) · mensual (dia del mes)
 *               mensual por semana (el MONTO del mes repartido en los CUANDO del mes)
 *               mensual cuando alcance (el primer dia en que el saldo lo cubre
 *               dejando el colchon; CUANDO = desde que dia del mes)
 *               unico (CUANDO = AAAA-MM-DD)
 *   TIPO        piso · objetivo · obligacion
 */
var CAJA_DEFECTO = [
  ['Retiro de Juanma', 5000, 'GTQ', 'mensual por semana', 'sabado', 'piso',
   'Q5,000 al mes en retiros de Q1,000 una vez por semana.'],
  ['Alquiler de la casa de Juanma', 1800, 'USD', 'mensual cuando alcance', '1', 'piso',
   'Se paga cuando hay suficiente en bancos.'],
  ['Devolucion a Raul', 100000, 'GTQ', 'unico', '2027-03-15', 'objetivo',
   'Q100,000 en el primer trimestre de 2027. Puede ser menos.']
];

var CAJA_HORIZONTE = 90;           // dias desde hoy
var CAJA_SEMANAS_BASE = 8;
var CAJA_SEMANAS_CALIBRA = 16;
var CAJA_SEMANAS_ESCENARIO = 20;
var CAJA_COLCHON_DIAS = 7;         // Juanma, 15-sep-2026
var CAJA_CACHE = 'caja_v1_';
// tramos del mes: [desde, hasta, dia en que se proyecta el pago del tramo]
var CAJA_TRAMOS = [[1, 7, 4], [8, 14, 11], [15, 21, 18], [22, 31, 26]];
var CAJA_DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
var CAJA_FIJOS = ['propinas', 'igss', 'alquiler'];


// ------------------------------------------------------------------ entradas

function getCajaData(auth, opciones) {
  exigirModulo_(auth, 'finanzas');
  return _cajaDatos_(_cajaOpciones_(opciones));
}

/* Para correr desde el EDITOR (con guarda de dueño). Crea la pestana COMPROMISOS en
   el Sheet de config con los compromisos de por defecto. Idempotente. */
function instalarCompromisos() {
  soloDueno_();
  return instalarCompromisos_();
}

function instalarCompromisos_() {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(CAJA_HOJA);
  if (hoja) return 'La pestana COMPROMISOS ya existe con ' + Math.max(hoja.getLastRow() - 1, 0) +
                   ' filas. No se toco nada.';
  hoja = ss.insertSheet(CAJA_HOJA);
  hoja.getRange(1, 1, 1, CAJA_COLS.length).setValues([CAJA_COLS]).setFontWeight('bold');
  // CUANDO como texto: '2027-03-15' escrito como fecha vuelve Date y '1' vuelve numero.
  hoja.getRange(2, 5, CAJA_DEFECTO.length, 1).setNumberFormat('@');
  hoja.getRange(2, 1, CAJA_DEFECTO.length, CAJA_COLS.length).setValues(CAJA_DEFECTO);
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(1, 240);
  hoja.setColumnWidth(7, 440);
  return 'Pestana COMPROMISOS creada con ' + CAJA_DEFECTO.length + ' compromisos.';
}

/** Solo lo que la pantalla puede mover, con topes. Lo demas se ignora. */
function _cajaOpciones_(o) {
  o = o || {};
  function num(v, min, max, def) {
    var n = Number(v);
    return (v === '' || v === null || v === undefined || isNaN(n)) ? def : Math.min(Math.max(n, min), max);
  }
  var out = {
    venta_pct: num(o.venta_pct, -50, 100, 0),
    costo_pct: num(o.costo_pct, -50, 50, 0),
    raul_monto: (o.raul_monto === '' || o.raul_monto === null || o.raul_monto === undefined)
      ? null : num(o.raul_monto, 0, 1000000, null),
    raul_fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(o.raul_fecha || '')) ? String(o.raul_fecha) : null,
    corte: /^\d{4}-\d{2}-\d{2}$/.test(String(o.corte || '')) ? String(o.corte) : null,
    // '2025' (decision de Juanma del 15-sep-2026), 'mitad' o 'no'. La prueba hacia
    // atras de ese dia mostro que la subida de julio y agosto de 2025 no se repitio.
    estacional: ['2025', 'mitad', 'no'].indexOf(o.estacional) !== -1 ? o.estacional : '2025',
    forzar: o.forzar === true || o.forzar === 'true'     // "Actualizar datos": sin cache
  };
  return out;
}

function _cajaDatos_(o) {
  var cache = CacheService.getScriptCache();
  var m = metasFoodCost_();
  var sinForzar = {};
  Object.keys(o).forEach(function (k) { if (k !== 'forzar') sinForzar[k] = o[k]; });
  var clave = CAJA_CACHE + m.global + '_' + Utilities.base64EncodeWebSafe(JSON.stringify(sinForzar)).slice(0, 180);
  var g = o.forzar ? null : cache.get(clave);
  if (g) {
    try { return JSON.parse(g); } catch (e) { /* se recalcula */ }
  }
  var datos = _cajaCalcular_(o);
  try { cache.put(clave, JSON.stringify(datos), 10 * 60); } catch (e2) { /* no cabe: se devuelve igual */ }
  return datos;
}


// ------------------------------------------------------------------ utilidades

function _cajaDiaClave_(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function _cajaMas_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function _cajaDiasEntre_(a, b) { return Math.round((b - a) / 86400000); }
function _cajaTramo_(dia) {
  for (var i = 0; i < CAJA_TRAMOS.length; i++) if (dia <= CAJA_TRAMOS[i][1]) return i;
  return CAJA_TRAMOS.length - 1;
}
function _cajaPercentil_(lista, p) {
  if (!lista.length) return null;
  var s = lista.slice().sort(function (a, b) { return a - b; });
  var x = p * (s.length - 1), i = Math.floor(x), f = x - i;
  return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * f : s[i];
}
function _cajaSinAcentos_(s) { return _finSinAcentos_(String(s || '')).toLowerCase().trim(); }
function _cajaEsSi_(v) { return /^s[ií]$/i.test(String(v || '').trim()); }

/** A que grupo va un debito del banco. Ver el encabezado. */
function _cajaGrupo_(m) {
  if (m.traspaso) return 'traspaso';
  if (_cajaEsSi_(m.pers) || m.cat === 'PERSONAL' || m.cat === 'DEVOLUCION_INVERSION') return 'personal';
  if (m.desc.indexOf('CORSAGA') !== -1) return 'traspaso';
  if (m.cat === 'PAGO_TARJETA_CREDITO' || m.cat === 'PAGO_TARJETA') return 'tarjeta';
  if (m.cat === 'NOMINA') return 'planilla';
  if (m.cat === 'PROPINAS_AL_EQUIPO' || m.cat === 'PROPINAS_PASSTHROUGH') return 'propinas';
  if (m.cat === 'IGSS') return 'igss';
  if (m.cat === 'IMPUESTOS' || m.cat === 'TRIBUTO') return 'sat';
  if (m.cat === 'ALQUILERES' || m.cat === 'ALQUILER') return 'alquiler';
  if (_finEn_(FIN_COGS_CATS, m.cat) || _finEn_(FIN_EFECTIVO, m.cat)) return 'mercaderia';
  return 'resto';
}

/** Los compromisos de la pestana, o los de por defecto. */
function _cajaCompromisos_(usd) {
  var filas = null, avisos = [];
  try {
    var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(CAJA_HOJA);
    if (hoja && hoja.getLastRow() >= 2) filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, CAJA_COLS.length).getValues();
  } catch (e) {
    avisos.push('No se pudo leer la pestana COMPROMISOS: ' + String(e && e.message || e));
  }
  var origen = filas ? 'hoja' : 'por defecto';
  var lista = [];
  (filas || CAJA_DEFECTO).forEach(function (r, i) {
    var concepto = String(r[0] || '').trim();
    if (!concepto) return;
    var monto = _finNum_(r[1]), moneda = String(r[2] || 'GTQ').trim().toUpperCase();
    var frec = _cajaSinAcentos_(r[3]), cuando = r[4], tipo = _cajaSinAcentos_(r[5]) || 'obligacion';
    if (cuando instanceof Date) {
      cuando = cuando.getFullYear() + '-' + ('0' + (cuando.getMonth() + 1)).slice(-2) + '-' + ('0' + cuando.getDate()).slice(-2);
    }
    cuando = _cajaSinAcentos_(cuando);
    var q = moneda === 'USD' ? monto * usd : monto;
    var FRECS = ['semanal', 'mensual', 'mensual por semana', 'mensual cuando alcance', 'unico'];
    if (FRECS.indexOf(frec) === -1) {
      avisos.push('Fila ' + (i + 2) + ' "' + concepto + '": frecuencia "' + r[3] + '" no se entiende. No se usa.');
      return;
    }
    if (!monto) { avisos.push('Fila ' + (i + 2) + ' "' + concepto + '": sin monto. No se usa.'); return; }
    lista.push({ concepto: concepto, monto: monto, moneda: moneda, q: q, frecuencia: frec,
                 cuando: cuando, tipo: tipo, notas: String(r[6] || '') });
  });
  return { lista: lista, origen: origen, avisos: avisos };
}


// ------------------------------------------------------------------ calculo

function _cajaCalcular_(o) {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var usd = _finParametro_('tipo_cambio_usd', FIN_USD_DEF);
  var planilla = _finPlanilla_();
  var fin = _finDatos_(!!o.forzar);
  function leer(n) { var h = ss.getSheetByName(n); return h ? h.getDataRange().getValues() : []; }
  var V = leer('02_Ventas_Maestro'), BI = leer('03_Banco_Industrial'), BAC = leer('04_Banco_BAC'),
      TC = leer('05_Tarjeta_Credito_BAC'), V25 = leer(FIN_HOJA_2025);

  // ---- movimientos del banco
  var movs = [];
  [{ filas: BI, banco: 'bi', deb: 4, cred: 5, saldo: 6, cat: 7, pers: 8, desc: 3 },
   { filas: BAC, banco: 'bac', deb: 5, cred: 6, saldo: 7, cat: 8, pers: 9, desc: 4 }].forEach(function (B) {
    for (var r = FIN_PRIMERA_FILA - 1; r < B.filas.length; r++) {
      var f = _finDia_(B.filas[r][0]);
      if (!_finEsFecha_(f)) continue;
      movs.push({ f: f, k: _cajaDiaClave_(f), banco: B.banco,
                  deb: _finNum_(B.filas[r][B.deb - 1]), cred: _finNum_(B.filas[r][B.cred - 1]),
                  saldo: _finNumero_(B.filas[r][B.saldo - 1]),
                  cat: String(B.filas[r][B.cat - 1] || '').trim(),
                  pers: String(B.filas[r][B.pers - 1] || '').trim(),
                  desc: String(B.filas[r][B.desc - 1] || '').toUpperCase() });
    }
  });
  if (!movs.length) return { error: 'No hay movimientos del banco en el maestro.' };

  var ultimoDato = movs.reduce(function (a, m) { return m.f > a ? m.f : a; }, movs[0].f);
  var corte = ultimoDato;
  if (o.corte) {
    var pc = o.corte.split('-');
    corte = new Date(Number(pc[0]), Number(pc[1]) - 1, Number(pc[2]));
  }
  var kCorte = _cajaDiaClave_(corte);

  // ---- traspasos entre cuentas propias (15-sep-2026). El credito llega con "CORSAGA" en
  // la glosa, pero el debito del otro banco sale como "TF: ACH INMEDIATO 900" con
  // categoria TRANSFERENCIA. Sin casarlos, la salida contaba como gasto (Q30,800 de abril
  // a agosto) y la entrada no contaba. Se casan por monto exacto y +-2 dias.
  movs.filter(function (m) { return m.cred > 0 && m.desc.indexOf('CORSAGA') !== -1; }).forEach(function (c) {
    for (var i = 0; i < movs.length; i++) {
      var m = movs[i];
      if (m.traspaso || m.banco === c.banco || !(m.deb > 0) || Math.abs(m.deb - c.cred) > 0.005) continue;
      if (Math.abs(_cajaDiasEntre_(m.f, c.f)) > 2) continue;
      m.traspaso = true;
      break;
    }
  });

  // ---- saldo de cada banco al cierre de cada dia, RECONSTRUIDO con los movimientos
  // (15-sep-2026). La columna Saldo no alcanza: en Banco Industrial esta vacia en mayo
  // (0 de 156 filas) y en casi todo junio, y dentro de un mismo dia el orden de las filas
  // no siempre es el del banco (57 de 147 dias). Se ancla en el ultimo saldo que trae cada
  // banco y se recorre sumando creditos y restando debitos: los movimientos estan cuadrados
  // al centavo contra los PDF, y el orden dentro del dia deja de importar.
  var anclaSaldo = {}, flujo = { bi: {}, bac: {} };
  movs.forEach(function (m) {
    flujo[m.banco][m.k] = (flujo[m.banco][m.k] || 0) + m.cred - m.deb;
    if (isNaN(m.saldo)) return;
    if (!anclaSaldo[m.banco] || m.k >= anclaSaldo[m.banco].k) anclaSaldo[m.banco] = { k: m.k, f: m.f, saldo: m.saldo };
  });
  var diasFlujo = { bi: Object.keys(flujo.bi).map(Number), bac: Object.keys(flujo.bac).map(Number) };
  function saldoAl(banco, f) {           // saldo al cierre del dia f
    var A = anclaSaldo[banco];
    if (!A) return 0;
    var s = A.saldo, kf = _cajaDiaClave_(f);
    diasFlujo[banco].forEach(function (kk) {
      if (kf < kk && kk <= A.k) s -= flujo[banco][kk];
      else if (A.k < kk && kk <= kf) s += flujo[banco][kk];
    });
    return s;
  }
  var saldo = { bi: saldoAl('bi', corte), bac: saldoAl('bac', corte) };
  var fechaSaldo = { bi: anclaSaldo.bi ? anclaSaldo.bi.f : null, bac: anclaSaldo.bac ? anclaSaldo.bac.f : null };
  var saldoInicial = saldo.bi + saldo.bac;

  // ---- venta por dia y por mes (TotalFinal, con eventos: es lo que se cobra)
  var ventaDia = {}, ventaMes = {};
  for (var r = FIN_PRIMERA_FILA - 1; r < V.length; r++) {
    var fv = _finDia_(V[r][1]);
    if (!_finEsFecha_(fv) || _cajaDiaClave_(fv) > kCorte) continue;
    var q = _finNum_(V[r][4]);
    var kd = _cajaDiaClave_(fv), km = fv.getFullYear() * 100 + fv.getMonth() + 1;
    ventaDia[kd] = (ventaDia[kd] || 0) + q;
    ventaMes[km] = (ventaMes[km] || 0) + q;
  }
  function ventaEntre(a, b) {           // a y b inclusive
    var s = 0;
    for (var d = a; d <= b; d = _cajaMas_(d, 1)) s += ventaDia[_cajaDiaClave_(d)] || 0;
    return s;
  }

  // ---- semanas completas hasta el corte (lunes a domingo)
  var finSemana = corte.getDay() === 0 ? corte : _cajaMas_(corte, -corte.getDay());
  function semana(j) {                   // j = 0 es la ultima completa
    var fs = _cajaMas_(finSemana, -7 * j);
    return ventaEntre(_cajaMas_(fs, -6), fs);
  }
  var baseSem = 0;
  for (var j = 0; j < CAJA_SEMANAS_BASE; j++) baseSem += semana(j);
  baseSem = baseSem / CAJA_SEMANAS_BASE;

  var ratios = [];
  for (var i = 0; i < CAJA_SEMANAS_ESCENARIO; i++) {
    var prev = 0, n = 0;
    for (var j2 = i + 1; j2 <= i + CAJA_SEMANAS_BASE; j2++) { prev += semana(j2); n++; }
    prev = prev / n;
    if (prev > 1000) ratios.push(semana(i) / prev);
  }
  var escOk = ratios.length >= 8;
  var ESC = {
    pesimista: escOk ? _cajaPercentil_(ratios, 0.25) : 0.85,
    base: escOk ? _cajaPercentil_(ratios, 0.5) : 1,
    optimista: escOk ? _cajaPercentil_(ratios, 0.75) : 1.1
  };

  // ---- estacionalidad de 2025
  var v25 = {};
  for (var r2 = 1; r2 < V25.length; r2++) {
    var mm = Number(V25[r2][13]);
    if (mm >= 1 && mm <= 12) v25[mm] = (v25[mm] || 0) + _finNum_(V25[r2][12]);
  }
  var mesesBase = {};
  for (var d0 = _cajaMas_(finSemana, -7 * CAJA_SEMANAS_BASE + 1); d0 <= finSemana; d0 = _cajaMas_(d0, 1)) {
    mesesBase[d0.getMonth() + 1] = true;
  }
  var refs = Object.keys(mesesBase).map(Number).filter(function (m2) { return v25[m2] && !FIN_NOTAS_2025[m2]; });
  var ref25 = refs.length ? refs.reduce(function (a, m2) { return a + v25[m2]; }, 0) / refs.length : 0;
  function estacional(mes) {
    if (o.estacional === 'no' || !ref25 || !v25[mes] || FIN_NOTAS_2025[mes]) return 1;
    var fe = Math.min(Math.max(v25[mes] / ref25, 0.5), 2.5);
    return o.estacional === 'mitad' ? 1 + (fe - 1) / 2 : fe;
  }

  // ---- calibracion: las ultimas 16 semanas del banco
  var desde = _cajaMas_(corte, -7 * CAJA_SEMANAS_CALIBRA + 1), kDesde = _cajaDiaClave_(desde);
  var diasCal = CAJA_SEMANAS_CALIBRA * 7;
  var ventaCal = ventaEntre(desde, corte);
  var G = {}, cobroCal = 0, cobroDow = [0, 0, 0, 0, 0, 0, 0], fuera = {}, debTotal = 0;
  ['planilla', 'propinas', 'igss', 'sat', 'alquiler', 'mercaderia', 'resto'].forEach(function (k) {
    G[k] = { total: 0, tramos: [0, 0, 0, 0] };
  });
  movs.forEach(function (m) {
    if (m.k < kDesde || m.k > kCorte) return;
    if (m.cred > 0 && m.cat.indexOf('INGRESO') === 0 && m.desc.indexOf('CORSAGA') === -1) {
      cobroCal += m.cred;
      cobroDow[m.f.getDay()] += m.cred;
    }
    if (m.deb > 0) {
      debTotal += m.deb;
      var gr = _cajaGrupo_(m);
      if (!G[gr]) { fuera[gr] = (fuera[gr] || 0) + m.deb; return; }
      G[gr].total += m.deb;
      G[gr].tramos[_cajaTramo_(m.f.getDate())] += m.deb;
    }
  });
  var tarjetaCal = 0;
  for (var r3 = FIN_PRIMERA_FILA - 1; r3 < TC.length; r3++) {
    var ft = _finDia_(TC[r3][0]);
    if (!_finEsFecha_(ft)) continue;
    var kt = _cajaDiaClave_(ft);
    if (kt < kDesde || kt > kCorte) continue;
    var ct = String(TC[r3][4] || '').trim();
    var qt = _finNum_(TC[r3][2]) + _finNum_(TC[r3][3]) * usd;
    if (qt > 0 && ct !== 'PERSONAL' && ct.indexOf('PAGO_TARJETA') !== 0 && !_cajaEsSi_(TC[r3][5])) tarjetaCal += qt;
  }

  var MES = 30.4375;
  var conv = ventaCal ? cobroCal / ventaCal : 0;
  var cobroPeso = cobroDow.map(function (x) { return cobroCal ? x / cobroCal * 7 : 1; });
  var mercPct = ventaCal ? G.mercaderia.total / ventaCal : 0;
  var satPct = ventaCal ? G.sat.total / ventaCal : 0;
  var restoDia = G.resto.total / diasCal, tarjetaDia = tarjetaCal / diasCal;
  var fijoMes = {};
  CAJA_FIJOS.forEach(function (k) { fijoMes[k] = G[k].total * MES / diasCal; });
  function reparto(k) {
    var t = G[k].total;
    return G[k].tramos.map(function (x) { return t ? x / t : (k === 'planilla' ? 0.5 : 0.25); });
  }
  var anioPlanilla = new Date().getFullYear();
  function planillaMes(y, m) {
    return _finUltimoDevengado_(planilla.valores, y === anioPlanilla ? m : 12).valor;
  }
  var colchon = CAJA_COLCHON_DIAS * (fin.gasto_dia || 0);

  // ---- el calendario, sin escenario: venta de referencia y pagos fijos por dia
  var hoyReal = new Date(); hoyReal = new Date(hoyReal.getFullYear(), hoyReal.getMonth(), hoyReal.getDate());
  var ancla = o.corte ? corte : hoyReal;
  var ultimo = _cajaMas_(ancla, CAJA_HORIZONTE);
  var diasP = [];
  for (var dp = _cajaMas_(corte, 1); dp <= ultimo; dp = _cajaMas_(dp, 1)) {
    var mesP = dp.getMonth() + 1;
    diasP.push({ f: dp, k: _cajaDiaClave_(dp), ventaRef: baseSem / 7 * estacional(mesP),
                 cobroPeso: cobroPeso[dp.getDay()], fijo: 0, sat: [], planilla: 0, extra: 0 });
  }
  var idxDia = {};
  diasP.forEach(function (x, ii) { idxDia[x.k] = ii; });
  function enDia(y, m, dia) {           // indice del dia proyectado, o -1
    var ult = new Date(y, m, 0).getDate();
    var k = y * 10000 + m * 100 + Math.min(dia, ult);
    return idxDia.hasOwnProperty(k) ? idxDia[k] : -1;
  }
  var mesesP = {};
  diasP.forEach(function (x) { mesesP[x.f.getFullYear() * 100 + x.f.getMonth() + 1] = true; });
  var repPlan = reparto('planilla'), repSat = reparto('sat');
  Object.keys(mesesP).map(Number).forEach(function (km) {
    var y = Math.floor(km / 100), m = km % 100;
    CAJA_TRAMOS.forEach(function (T, t) {
      var ix = enDia(y, m, T[2]);
      if (ix < 0) return;
      CAJA_FIJOS.forEach(function (k) { diasP[ix].fijo += fijoMes[k] * reparto(k)[t]; });
      diasP[ix].planilla += planillaMes(y, m) * repPlan[t];
      diasP[ix].sat.push({ km: km, parte: repSat[t] });
    });
    var ixA = enDia(y, m, 10);
    if (m === 12 && ixA >= 0) diasP[ixA].extra += planillaMes(y, 12) * 0.5;      // aguinaldo, primera mitad
    if (m === 7 && ixA >= 0) diasP[ixA].extra += planillaMes(y, 7);             // Bono 14
    var ixE = enDia(y, m, 20);
    if (m === 1 && ixE >= 0) diasP[ixE].extra += planillaMes(y - 1, 12) * 0.5;  // aguinaldo, segunda mitad
  });

  // ---- compromisos al calendario
  var comp = _cajaCompromisos_(usd);
  comp.lista.forEach(function (c) {
    if (/ra[uú]l/i.test(c.concepto)) {
      if (o.raul_monto !== null) { c.q = c.moneda === 'USD' ? o.raul_monto * usd : o.raul_monto; c.monto = o.raul_monto; }
      if (o.raul_fecha) c.cuando = o.raul_fecha;
    }
  });
  var fijosComp = [];   // [{ix, q, concepto, tipo}]
  var flotantes = [];   // [{km, desde, q, concepto, tipo}]
  comp.lista.forEach(function (c) {
    if (c.frecuencia === 'unico') {
      var p = c.cuando.split('-');
      var ix = idxDia[Number(p[0]) * 10000 + Number(p[1]) * 100 + Number(p[2])];
      if (ix !== undefined) fijosComp.push({ ix: ix, q: c.q, concepto: c.concepto, tipo: c.tipo });
      c.q_mes = c.q / 12;
      return;
    }
    if (c.frecuencia === 'semanal' || c.frecuencia === 'mensual por semana') {
      var dow = CAJA_DIAS.indexOf(c.cuando);
      if (dow < 0) dow = 6;
      var porMes = {};
      diasP.forEach(function (x, ix2) {
        if (x.f.getDay() !== dow) return;
        var km2 = x.f.getFullYear() * 100 + x.f.getMonth() + 1;
        (porMes[km2] = porMes[km2] || []).push(ix2);
      });
      Object.keys(porMes).forEach(function (km2) {
        var y2 = Math.floor(km2 / 100), m2 = km2 % 100;
        var enElMes = 0;                  // cuantos de ese dia tiene el mes entero
        for (var dd = 1; dd <= new Date(y2, m2, 0).getDate(); dd++) if (new Date(y2, m2 - 1, dd).getDay() === dow) enElMes++;
        porMes[km2].forEach(function (ix3) {
          fijosComp.push({ ix: ix3, q: c.frecuencia === 'semanal' ? c.q : c.q / enElMes, concepto: c.concepto, tipo: c.tipo });
        });
      });
      c.q_mes = c.frecuencia === 'semanal' ? c.q * 52 / 12 : c.q;
      return;
    }
    var diaMes = Math.max(1, Math.min(31, Number(c.cuando) || 1));
    Object.keys(mesesP).map(Number).forEach(function (km3) {
      var y3 = Math.floor(km3 / 100), m3 = km3 % 100;
      if (c.frecuencia === 'mensual') {
        var ix4 = enDia(y3, m3, diaMes);
        if (ix4 >= 0) fijosComp.push({ ix: ix4, q: c.q, concepto: c.concepto, tipo: c.tipo });
      } else {
        flotantes.push({ km: km3, desde: diaMes, q: c.q, concepto: c.concepto, tipo: c.tipo });
      }
    });
    c.q_mes = c.q;
  });

  // ---- simulacion
  var ctx = { diasP: diasP, saldoInicial: saldoInicial, conv: conv, mercPct: mercPct, satPct: satPct,
              restoDia: restoDia, tarjetaDia: tarjetaDia, ventaMes: ventaMes, fijosComp: fijosComp,
              flotantes: flotantes, colchon: colchon,
              // el colchon se exige desde el dia 30: antes no hay tiempo de reaccionar, y
              // si el saldo de hoy ya esta bajo el colchon, exigirlo desde el dia 1 no
              // tiene solucion con ninguna venta
              desdeColchon: idxDia.hasOwnProperty(_cajaDiaClave_(_cajaMas_(ancla, 30)))
                ? idxDia[_cajaDiaClave_(_cajaMas_(ancla, 30))] : 0 };
  var costoF = 1 - o.costo_pct / 100;
  var ventaF = 1 + o.venta_pct / 100;
  var esc = {};
  Object.keys(ESC).forEach(function (e) { esc[e] = _cajaSimular_(ctx, ESC[e] * ventaF, costoF, 0, true); });

  // ---- quiebre del escenario base: cuanta venta o cuanto costo hace falta
  function minCon(kVenta, extra) { return _cajaSimular_(ctx, kVenta, costoF, extra, false).min; }
  function minTarde(kVenta, extra) { return _cajaSimular_(ctx, kVenta, costoF, extra, false).minTarde; }
  function buscar(fn, lo, hi) {
    if (fn(lo)) return lo;
    if (!fn(hi)) return null;
    for (var it = 0; it < 30; it++) { var mid = (lo + hi) / 2; if (fn(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  var kBase = ESC.base * ventaF;
  var kCero = buscar(function (k) { return minCon(k, 0) >= 0; }, kBase, kBase * 4);
  var kColchon = buscar(function (k) { return minTarde(k, 0) >= colchon; }, kBase, kBase * 4);
  var xCero = buscar(function (x) { return minCon(kBase, x) >= 0; }, 0, 50000);
  var xColchon = buscar(function (x) { return minTarde(kBase, x) >= colchon; }, 0, 50000);
  var quiebre = {
    venta_pct_cero: kCero === null ? null : _finR_((kCero / kBase - 1) * 100, 1),
    venta_pct_colchon: kColchon === null ? null : _finR_((kColchon / kBase - 1) * 100, 1),
    costo_mes_cero: xCero === null ? null : _finR_(xCero * MES),
    costo_mes_colchon: xColchon === null ? null : _finR_(xColchon * MES)
  };

  // ---- p122: lo que deja la operacion cada mes contra el piso y el objetivo
  var piso = 0, objetivo = 0;
  comp.lista.forEach(function (c) {
    if (c.tipo === 'piso') piso += c.q_mes;
    if (c.tipo === 'piso' || c.tipo === 'objetivo') objetivo += c.q_mes;
  });
  var margen = conv - mercPct * costoF - satPct;
  var meses = esc.base.meses.map(function (x) {
    var pp = piso * x.dias / x.diasMes, po = objetivo * x.dias / x.diasMes;   // un mes parcial, en proporcion
    var fp = Math.max(pp - x.deja, 0), fo = Math.max(po - x.deja, 0);
    return { km: x.km, mes: FIN_MESES[x.km % 100 - 1] + ' ' + Math.floor(x.km / 100), dias: x.dias,
             venta: _finR_(x.venta), cobro: _finR_(x.cobro), operacion: _finR_(x.operacion), deja: _finR_(x.deja),
             piso: _finR_(piso * x.dias / x.diasMes), objetivo: _finR_(objetivo * x.dias / x.diasMes),
             venta_piso_pct: x.venta && margen > 0 ? _finR_(Math.max(piso * x.dias / x.diasMes - x.deja, 0) / margen / x.venta * 100, 1) : null,
             venta_objetivo_pct: x.venta && margen > 0 ? _finR_(Math.max(objetivo * x.dias / x.diasMes - x.deja, 0) / margen / x.venta * 100, 1) : null,
             completo: x.dias === x.diasMes, falta_piso: _finR_(fp), falta_objetivo: _finR_(fo) };
  });

  // ---- saldo real despues del corte (solo en la prueba hacia atras)
  var real = null;
  if (o.corte && ultimoDato > corte) {
    real = diasP.map(function (x) {
      return x.f <= ultimoDato ? _finR_(saldoAl('bi', x.f) + saldoAl('bac', x.f)) : null;
    });
  }

  function marca(n) {
    var k = _cajaDiaClave_(_cajaMas_(ancla, n));
    return idxDia.hasOwnProperty(k) ? idxDia[k] : null;
  }
  var R = function (x) { return _finR_(x); };
  return {
    corte: _finFecha_(corte), ultimo_dato: _finFecha_(ultimoDato), hoy: _finFecha_(ancla),
    dias_atraso: _cajaDiasEntre_(corte, ancla),
    saldo_inicial: R(saldoInicial),
    saldo_bancos: { bi: R(saldo.bi || 0), bac: R(saldo.bac || 0),
                    fecha_bi: fechaSaldo.bi ? _finFecha_(fechaSaldo.bi) : '',
                    fecha_bac: fechaSaldo.bac ? _finFecha_(fechaSaldo.bac) : '' },
    colchon: R(colchon), colchon_dias: CAJA_COLCHON_DIAS, gasto_dia: R(fin.gasto_dia || 0),
    fechas: diasP.map(function (x) { return _finDDMM_(x.f); }),
    marcas: { d30: marca(30), d60: marca(60), d90: marca(90) },
    escenarios: esc,
    factores: { pesimista: _finR_(ESC.pesimista, 3), base: _finR_(ESC.base, 3), optimista: _finR_(ESC.optimista, 3),
                medidos: escOk, semanas: ratios.length },
    semanas: esc.base.semanas,
    meses: meses,
    quiebre: quiebre,
    piso_mes: R(piso), objetivo_mes: R(objetivo),
    compromisos: comp.lista.map(function (c) {
      return { concepto: c.concepto, monto: c.monto, moneda: c.moneda, frecuencia: c.frecuencia,
               cuando: c.cuando, tipo: c.tipo, q_mes: R(c.q_mes || 0), notas: c.notas };
    }),
    compromisos_origen: comp.origen, compromisos_avisos: comp.avisos,
    supuestos: {
      venta_semana: R(baseSem), semanas_base: CAJA_SEMANAS_BASE, estacional_modo: o.estacional,
      estacional: Object.keys(mesesP).map(Number).reduce(function (a, km) {
        a[FIN_MESES[km % 100 - 1]] = _finR_(estacional(km % 100), 2); return a;
      }, {}),
      referencia_2025: refs.map(function (m) { return FIN_MESES[m - 1]; }),
      calibracion: { desde: _finFecha_(desde), hasta: _finFecha_(corte), dias: diasCal },
      conversion_pct: _finR_(conv * 100, 1), mercaderia_pct: _finR_(mercPct * 100, 1),
      sat_pct: _finR_(satPct * 100, 1),
      resto_mes: R(restoDia * MES), tarjeta_mes: R(tarjetaDia * MES),
      planilla_mes: R(planillaMes(corte.getFullYear(), corte.getMonth() + 1)),
      propinas_mes: R(fijoMes.propinas), igss_mes: R(fijoMes.igss), alquiler_mes: R(fijoMes.alquiler),
      usd: usd,
      fuera: Object.keys(fuera).reduce(function (a, k) { a[k] = R(fuera[k]); return a; }, {}),
      // todo debito de la ventana tiene que caer en un grupo o en "fuera": la bateria lo compara
      cobertura: { debitos: R(debTotal),
                   agrupados: R(Object.keys(G).reduce(function (a, k) { return a + G[k].total; }, 0) +
                                Object.keys(fuera).reduce(function (a, k) { return a + fuera[k]; }, 0)) }
    },
    real: real,
    opciones: o,
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm')
  };
}

/**
 * Corre el calendario con un multiplicador de venta, un factor de costo y un ahorro
 * diario extra. Con detalle=false solo devuelve el minimo (lo usa la busqueda).
 */
function _cajaSimular_(ctx, kVenta, costoF, extraDia, detalle) {
  var D = ctx.diasP, n = D.length;
  var porDia = new Array(n);
  for (var i = 0; i < n; i++) porDia[i] = 0;
  ctx.fijosComp.forEach(function (c) { porDia[c.ix] += c.q; });
  var pendientes = {};
  ctx.flotantes.forEach(function (fl, j) { pendientes[j] = true; });

  var saldo = ctx.saldoInicial, min = saldo, iMin = -1, cero = null, colchon = null, minT = Infinity;
  var serie = detalle ? [] : null, pagosFlot = detalle ? [] : null;
  var dia = { cobro: [], operacion: [], compromisos: [] };   // por dia, para la pantalla
  var ventaMesP = {};
  var sem = {}, mes = {};

  // la venta proyectada de cada mes, para el SAT del mes siguiente
  D.forEach(function (x) {
    var km = x.f.getFullYear() * 100 + x.f.getMonth() + 1;
    ventaMesP[km] = (ventaMesP[km] || 0) + x.ventaRef * kVenta;
  });
  function ventaDelMes(km) { return (ctx.ventaMes[km] || 0) + (ventaMesP[km] || 0); }
  function mesAnterior(km) { var y = Math.floor(km / 100), m = km % 100; return m === 1 ? (y - 1) * 100 + 12 : km - 1; }

  for (var d = 0; d < n; d++) {
    var x = D[d];
    var venta = x.ventaRef * kVenta;
    var cobro = venta * ctx.conv * x.cobroPeso;
    var sat = 0;
    for (var s = 0; s < x.sat.length; s++) sat += ctx.satPct * ventaDelMes(mesAnterior(x.sat[s].km)) * x.sat[s].parte;
    var operacion = venta * ctx.mercPct * costoF + (ctx.restoDia + ctx.tarjetaDia) * costoF +
                    x.fijo + x.planilla + x.extra + sat - extraDia;
    var compromisos = porDia[d];
    saldo += cobro - operacion - compromisos;

    var km = x.f.getFullYear() * 100 + x.f.getMonth() + 1;
    for (var j = 0; j < ctx.flotantes.length; j++) {
      var fl = ctx.flotantes[j];
      if (!pendientes[j] || fl.km !== km || x.f.getDate() < fl.desde) continue;
      var ultimoDelMes = d === n - 1 || (D[d + 1].f.getMonth() !== x.f.getMonth());
      if (saldo - fl.q >= ctx.colchon || ultimoDelMes) {
        saldo -= fl.q;
        compromisos += fl.q;
        pendientes[j] = false;
        if (detalle) pagosFlot.push({ concepto: fl.concepto, fecha: _finDDMM_(x.f), q: _finR_(fl.q),
                                      no_alcanzo: saldo < ctx.colchon });
      }
    }

    if (saldo < min) { min = saldo; iMin = d; }
    if (d >= (ctx.desdeColchon || 0) && saldo < minT) minT = saldo;
    if (cero === null && saldo < 0) cero = d;
    if (colchon === null && saldo < ctx.colchon) colchon = d;
    if (!detalle) continue;
    serie.push(_finR_(saldo));
    dia.cobro.push(_finR_(cobro)); dia.operacion.push(_finR_(operacion)); dia.compromisos.push(_finR_(compromisos));
    var ks = _finClaveSemana_(x.f);
    if (!sem[ks]) sem[ks] = { clave: ks, w: ks % 100, anio: Math.floor(ks / 100), ini: _finDDMM_(x.f),
                              entradas: 0, operacion: 0, compromisos: 0 };
    sem[ks].fin = _finDDMM_(x.f);
    sem[ks].entradas += cobro; sem[ks].operacion += operacion; sem[ks].compromisos += compromisos;
    sem[ks].saldo = saldo;
    if (!mes[km]) mes[km] = { km: km, dias: 0, diasMes: new Date(x.f.getFullYear(), x.f.getMonth() + 1, 0).getDate(),
                              venta: 0, cobro: 0, operacion: 0 };
    mes[km].dias++; mes[km].venta += venta; mes[km].cobro += cobro; mes[km].operacion += operacion;
  }
  if (!detalle) return { min: min, minTarde: minT };
  return {
    serie: serie,
    min: _finR_(min), fecha_min: iMin >= 0 ? _finDDMM_(D[iMin].f) : '',
    min_desde_30: minT === Infinity ? null : _finR_(minT),
    dia: dia,
    cruza_cero: cero === null ? null : _finFecha_(D[cero].f),
    cruza_colchon: colchon === null ? null : _finFecha_(D[colchon].f),
    flotantes: pagosFlot,
    semanas: Object.keys(sem).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var s2 = sem[k];
      return { clave: k, w: s2.w, anio: s2.anio, ini: s2.ini, fin: s2.fin, entradas: _finR_(s2.entradas),
               operacion: _finR_(s2.operacion), compromisos: _finR_(s2.compromisos), saldo: _finR_(s2.saldo) };
    }),
    meses: Object.keys(mes).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var m2 = mes[k];
      return { km: k, dias: m2.dias, diasMes: m2.diasMes, venta: m2.venta, cobro: m2.cobro,
               operacion: m2.operacion, deja: m2.cobro - m2.operacion };
    })
  };
}
