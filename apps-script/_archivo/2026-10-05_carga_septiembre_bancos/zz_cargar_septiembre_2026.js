// ============================================================
// ROSANTA - Carga de septiembre 2026: Banco Industrial (28-30/09), BAC Q y Tarjeta BAC
// Un solo uso. Se saca del proyecto apenas corre (regla del 28-sep-2026) y queda en
// apps-script/_archivo/2026-10-05_carga_septiembre_bancos.
//
// Fuentes (Reportes Mensual/2026-09, id 112FyTQGLs3QBBsAscqQgVLil1s5-Ze5u):
//   174539_JUAN_6500002057_202610518158.pdf   BI 27/09 al 30/09  totales 17,589.70 / 13,583.98
//   BAC Q 2026-09                             BAC 01/09 al 30/09 totales 36,700.10 / 36,669.95
//   TC BAC 2026-09                            corte 30/09: previo 22,986.40 Q / 6,453.56 $,
//                                             pago contado 25,619.08 Q / 6,210.09 $
// BAC $ 2026-09 (cuenta USD 905757274) no se carga: esa cuenta nunca estuvo en el maestro.
//
// Categorias: las de agosto para lo repetido. Decidio Juanma el 5-oct-2026:
//   S28 Personal Cocina y Limpieza = NOMINA · Uber = VIATICOS · Apple = CUOTAS_Y_SUSCRIPCIONES
//   SN IGNACIO ENTREPINO (El Salvador) = PERSONAL · ACH DE Sociedad Interna = aporte para SAT
//   (INGRESO_TRANSFERENCIA) · Pago SAT2000 = IMPUESTOS (como DECLARAGUATE en BI).
//
//   clasp run revisarSeptiembre2026   no escribe
//   clasp run cargarSeptiembre2026
// ============================================================

var ZS = {
  BI: {
    hoja: '03_Banco_Industrial', cols: 11,
    enc: ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'],
    // [fecha, docto, descripcion, debito, credito, categoria]
    lote: [
      ['2026-09-27', '187310', 'VISANET AF:087972000', 0, 2284.53, 'INGRESO_TARJETA'],
      ['2026-09-27', '786669', 'VISANET AF:087972000', 0, 3860.49, 'INGRESO_TARJETA'],
      ['2026-09-27', '391', 'ATM 603 DESPENSA ANTIGUA GUATEMALA', 2000.00, 0, 'ALIMENTOS_EFECTIVO'],
      ['2026-09-28', '769637', 'VISANET AF:087972000', 0, 696.47, 'INGRESO_TARJETA'],
      ['2026-09-28', '159929', 'S38 Fernanda', 800.00, 0, 'NOMINA'],
      ['2026-09-28', '174658', 'LA TORRE ANTIGUA 3 DB GT', 276.70, 0, 'ALIMENTOS'],
      ['2026-09-28', '175741', 'S28 Personal Cocina y Limpieza', 700.00, 0, 'NOMINA'],
      ['2026-09-28', '192294', 'S38 Cofradia VARIOS', 2198.00, 0, 'BEBIDAS'],
      ['2026-09-29', '128665', 'ACH CORSAGA, SOCIEDAD AN A', 0, 4200.00, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-29', '801442', 'VISANET AF:087972000', 0, 1169.87, 'INGRESO_TARJETA'],
      ['2026-09-29', '123089', 'Grupo Eco Septiembre', 1250.00, 0, 'ALQUILER_EQUIPO'],
      ['2026-09-29', '191708', '2a Septiembre jeffry', 2500.00, 0, 'NOMINA'],
      ['2026-09-29', '207611', '2a Septiembre jose', 2500.00, 0, 'NOMINA'],
      ['2026-09-29', '207620', '2a Septiembre Nadia', 2000.00, 0, 'NOMINA'],
      ['2026-09-29', '207629', '2a Septiembre Efrain', 2000.00, 0, 'NOMINA'],
      ['2026-09-30', '965234', 'VISANET AF:087972000', 0, 1372.62, 'INGRESO_TARJETA'],
      ['2026-09-30', '133583', 'BAC Tarjeta', 1365.00, 0, 'TRANSFERENCIA']
    ],
    totales: [17589.70, 13583.98],
    fila: function (f) {
      return [f[0], f[1], f[2], f[3], f[4], '', f[5], f[5] === 'PERSONAL' ? 'Si' : 'No'];
    },
    clave: function (fecha, w) { return fecha + '|' + _zsTxt_(w[1]) + '|' + _zsNum_(w[3]).toFixed(2) + '|' + _zsNum_(w[4]).toFixed(2); },
    sumas: function (w) { return [_zsNum_(w[3]), _zsNum_(w[4])]; }
  },

  BAC: {
    hoja: '04_Banco_BAC', cols: 12,
    enc: ['Fecha', 'Referencia', 'Codigo', 'Descripción', 'Débito', 'Crédito', 'Balance', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'],
    // [fecha, referencia, codigo, descripcion, debito, credito, balance, categoria]
    lote: [
      ['2026-09-01', '406430820', 'TF', 'TEF A : 974954208', 15.00, 0, 15.67, 'PERSONAL'],
      ['2026-09-02', '504219360', 'L1', 'AFI97680000 LIQ625042', 0, 268.53, 284.20, 'INGRESO_TARJETA'],
      ['2026-09-06', '536491290', 'L1', 'AFI97680000 LIQ625364', 0, 9305.72, 9589.92, 'INGRESO_TARJETA'],
      ['2026-09-06', '546886536', 'L1', 'AFI97680000 LIQ625468', 0, 1853.92, 11443.84, 'INGRESO_TARJETA'],
      ['2026-09-07', '32239', 'PT', 'PAGO 4966-64**-****-163', 11353.50, 0, 90.34, 'PAGO_TARJETA_CREDITO'],
      ['2026-09-07', '406431163', 'TF', 'TEF A : 974954208', 50.00, 0, 40.34, 'PERSONAL'],
      ['2026-09-07', '557667887', 'L1', 'AFI97680000 LIQ625576', 0, 2371.82, 2412.16, 'INGRESO_TARJETA'],
      ['2026-09-08', '406471000', 'TF', 'TEF A : 974954208', 1000.00, 0, 1412.16, 'PERSONAL'],
      ['2026-09-10', '580264021', 'L1', 'AFI97680000 LIQ625802', 0, 1161.92, 2574.08, 'INGRESO_TARJETA'],
      ['2026-09-11', '40403', 'PT', 'PAGO 4966-64**-****-279', 2349.00, 0, 225.08, 'PAGO_TARJETA_CREDITO'],
      ['2026-09-11', '591019380', 'L1', 'AFI97680000 LIQ625910', 0, 1226.71, 1451.79, 'INGRESO_TARJETA'],
      ['2026-09-12', '406495740', 'TF', 'TEF DE:JAVIER ESTUAR', 0, 400.00, 1851.79, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-12', '601812180', 'L1', 'AFI97680000 LIQ626018', 0, 93.89, 1945.68, 'INGRESO_TARJETA'],
      ['2026-09-16', '644548240', 'L1', 'AFI97680000 LIQ626445', 0, 537.07, 2482.75, 'INGRESO_TARJETA'],
      ['2026-09-17', '406468656', 'TF', 'TEF A : 974954208', 1500.00, 0, 982.75, 'PERSONAL'],
      ['2026-09-18', '666031348', 'L1', 'AFI97680000 LIQ626660', 0, 506.08, 1488.83, 'INGRESO_TARJETA'],
      ['2026-09-20', '406402672', 'TF', 'TEF A : 974954208', 500.00, 0, 988.83, 'PERSONAL'],
      ['2026-09-21', '697962226', 'L1', 'AFI97680000 LIQ626979', 0, 516.41, 1505.24, 'INGRESO_TARJETA'],
      ['2026-09-23', '900412999', 'MD', 'TF:ACH PERSONAS 900', 1490.00, 0, 15.24, 'TRANSFERENCIA'],
      ['2026-09-23', '99999', 'TF', 'COBRO EMISI?N ESTA', 10.00, 0, 5.24, 'TRANSFERENCIA'],
      ['2026-09-23', '719426170', 'L1', 'AFI97680000 LIQ627194', 0, 1476.94, 1482.18, 'INGRESO_TARJETA'],
      ['2026-09-24', '500004637', 'MC', 'ACH DE Sociedad Interna', 0, 73.89, 1556.07, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-24', '40150', 'PT', 'PAGO 4966-64**-****-163', 1489.60, 0, 66.47, 'PAGO_TARJETA_CREDITO'],
      ['2026-09-24', '720110984', 'L1', 'AFI97680000 LIQ627201', 0, 2142.13, 2208.60, 'INGRESO_TARJETA'],
      ['2026-09-25', '500008248', 'MC', 'ACH DE Sociedad Interna', 0, 10684.34, 12892.94, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-25', '730849473', 'L1', 'AFI97680000 LIQ627308', 0, 867.56, 13760.50, 'INGRESO_TARJETA'],
      ['2026-09-27', '400431447', 'TF', 'Pago SAT2000 52 878 34', 10868.00, 0, 2892.50, 'IMPUESTOS'],
      ['2026-09-28', '46003400', 'MC', 'ACH DE 0000000000002', 0, 450.00, 3342.50, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-28', '762838961', 'L1', 'AFI97680000 LIQ627628', 0, 918.02, 4260.52, 'INGRESO_TARJETA'],
      ['2026-09-29', '900461477', 'MD', 'TF: ACH INMEDIATO 900', 4200.00, 0, 60.52, 'TRANSFERENCIA'],
      ['2026-09-29', '900461477', '59', 'COMISION TF: ACH INM', 5.00, 0, 55.52, 'COMISIONES_BANCARIAS'],
      ['2026-09-30', '156029592', 'MC', 'ACH DE CORSAGA SOC', 0, 1365.00, 1420.52, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-30', '406408478', 'TF', 'TEF DE:JUAN MANUEL', 0, 450.00, 1870.52, 'INGRESO_TRANSFERENCIA'],
      ['2026-09-30', '62099', 'DB', 'PAGO 4966-64**-****-163', 1870.00, 0, 0.52, 'PAGO_TARJETA_CREDITO']
    ],
    totales: [36700.10, 36669.95],
    fila: function (f) {
      return [f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[7] === 'PERSONAL' ? 'Si' : 'No'];
    },
    clave: function (fecha, w) { return fecha + '|' + _zsTxt_(w[1]) + '|' + _zsNum_(w[4]).toFixed(2) + '|' + _zsNum_(w[5]).toFixed(2); },
    sumas: function (w) { return [_zsNum_(w[4]), _zsNum_(w[5])]; }
  },

  TC: {
    hoja: '05_Tarjeta_Credito_BAC', cols: 9,
    enc: ['Fecha', 'Descripción', 'Quetzales', 'Dólares', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'],
    // [fecha, descripcion, quetzales, dolares, categoria]. Los cargos sin fecha van al corte.
    lote: [
      ['2026-09-01', 'CLINICA DE FISIOTERAPIA RLA ANTIGUA', 475.00, 0, 'PERSONAL'],
      ['2026-09-01', 'GOOGLE*CLOUD ZVLHFZ SUPPORT.GOO', 0, 3.06, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-01', 'GOOGLE*ADS74007-01**-****-2530000', 0, 120.56, 'MARKETING_DIGITAL'],
      ['2026-09-01', 'GOOGLE*WORKSPACE ROSAN 650-2530000', 0, 20.60, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-04', 'Tigo Guatemala GUATEMALA', 140.00, 0, 'TELEFONOS_Y_CELULARES'],
      ['2026-09-05', 'Spotify P4682E03CF Stockholm', 0, 9.99, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-07', 'SU PAGO RECIBIDO GRACIAS', 0, -250.00, 'PAGO_TARJETA'],
      ['2026-09-07', 'SU PAGO RECIBIDO GRACIAS', 0, -1450.00, 'PAGO_TARJETA'],
      ['2026-09-07', 'SN IGNACIO ENTREPINO -BP-CHALATENANG', 0, 750.00, 'PERSONAL'],
      ['2026-09-07', 'PAYPAL *DRAKOFERRER 4029357733', 0, 750.00, 'PERSONAL'],
      ['2026-09-08', 'FACEBK *KBDK65J2S4 Dublin', 1434.00, 0, 'MARKETING_DIGITAL'],
      ['2026-09-11', 'SU PAGO RECIBIDO GRACIAS', 0, -300.00, 'PAGO_TARJETA'],
      ['2026-09-15', 'FACEBK *ZWT578A2S4 Dublin', 550.03, 0, 'MARKETING_DIGITAL'],
      ['2026-09-16', 'Portal Facturas Tigo GUATEMALA', 440.00, 0, 'TELEFONOS_Y_CELULARES'],
      ['2026-09-16', 'COACHING* RANGE OF STR LOWER SACKV', 0, 44.44, 'PERSONAL'],
      ['2026-09-18', 'WIX.COM*1262867631 14156399034', 0, 40.00, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-20', 'UBER*RIDES GUATEMALA', 49.93, 0, 'VIATICOS'],
      ['2026-09-21', 'NETFLIX.COM 866-579-717', 0, 6.99, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-22', 'APPLE.COM/BILL 866-712-775', 0, 9.99, 'CUOTAS_Y_SUSCRIPCIONES'],
      ['2026-09-22', 'LUANA CAFE SACATEPEQUE', 35.00, 0, 'PERSONAL'],
      ['2026-09-24', 'SU PAGO RECIBIDO GRACIAS', 0, -190.00, 'PAGO_TARJETA'],
      ['2026-09-30', 'COBRO ADMTVO. POR PAGO TARDIO', 280.00, 0, 'COMISIONES_BANCARIAS'],
      ['2026-09-30', 'SU PAGO RECIBIDO GRACIAS', -1870.00, 0, 'PAGO_TARJETA'],
      ['2026-09-30', 'CARGOS POR SERVICIO MES ANTERIOR', 0, 190.90, 'COMISIONES_BANCARIAS'],
      ['2026-09-30', 'INTERES COM', 1098.72, 0, 'COMISIONES_BANCARIAS']
    ],
    // previo + suma del lote = pago de contado del estado de cuenta
    totales: [25619.08 - 22986.40, 6210.09 - 6453.56],
    fila: function (f) { return [f[0], f[1], f[2], f[3], f[4], f[4] === 'PERSONAL' ? 'Sí' : 'No']; },
    clave: function (fecha, w) { return fecha + '|' + _zsTxt_(w[1]) + '|' + _zsNum_(w[2]).toFixed(2) + '|' + _zsNum_(w[3]).toFixed(2); },
    sumas: function (w) { return [_zsNum_(w[2]), _zsNum_(w[3])]; }
  }
};

function _zsNum_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function _zsTxt_(v) { return String(v === null || v === undefined ? '' : v).replace(/\.0+$/, '').trim(); }
function _zsDia_(v) {
  var d = _fechaCarga(v);
  return d ? Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd') : '';
}
function _zsSemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

function _zsLibro_(ss, L, escribir, log) {
  var sh = ss.getSheetByName(L.hoja), frenos = [];
  var enc = sh.getRange(4, 1, 1, L.cols).getValues()[0].map(function (x) { return String(x).trim(); });
  L.enc.forEach(function (e, i) { if (enc[i] !== e) frenos.push('encabezado distinto en la columna ' + (i + 1) + ': "' + enc[i] + '"'); });

  // el lote contra el banco
  var filasLote = L.lote.map(L.fila), s = [0, 0];
  filasLote.forEach(function (w) { var x = L.sumas(w); s[0] += x[0]; s[1] += x[1]; });
  s = s.map(_zsNum_);
  var t = L.totales.map(_zsNum_);
  log.push(L.hoja + ': lote de ' + filasLote.length + ' filas, sumas ' + s[0].toFixed(2) + ' / ' + s[1].toFixed(2) +
           ' contra el banco ' + t[0].toFixed(2) + ' / ' + t[1].toFixed(2));
  if (s[0] !== t[0] || s[1] !== t[1]) frenos.push('NO CUADRA contra el banco');

  // lo que ya esta
  var datos = sh.getRange(1, 1, sh.getLastRow(), L.cols).getValues(), ya = {}, ultima = 4;
  for (var r = 4; r < datos.length; r++) {
    if (_zsTxt_(datos[r][0]) === '' && _zsTxt_(datos[r][1]) === '') continue;
    ultima = r + 1;
    ya[L.clave(_zsDia_(datos[r][0]), datos[r])] = 1;
  }
  var nuevas = filasLote.filter(function (w) { return !ya[L.clave(w[0], w)]; });
  log.push('  ultima fila ' + ultima + ' · ya estaban ' + (filasLote.length - nuevas.length) + ' · por agregar ' + nuevas.length);
  frenos.forEach(function (f) { log.push('  FRENO: ' + f); });
  if (!escribir || !nuevas.length || frenos.length) return { ok: !frenos.length, escritas: 0 };

  // Año, Mes y Semana: formula si la ultima fila trae formula, valor si trae valor
  var formulas = sh.getRange(ultima, L.cols - 2, 1, 3).getFormulasR1C1()[0];
  var bloque = nuevas.map(function (w) {
    var p = w[0].split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return w.concat([formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _zsSemanaISO_(d)]);
  });
  var inicio = ultima + 1;
  sh.getRange(inicio, 1, bloque.length, L.cols).setValues(bloque);
  SpreadsheetApp.flush();

  // releer
  var leido = sh.getRange(inicio, 1, bloque.length, L.cols).getValues(), malas = 0, s2 = [0, 0];
  leido.forEach(function (w, i) {
    if (!(w[0] instanceof Date) || _zsDia_(w[0]) !== nuevas[i][0]) malas++;
    var x = L.sumas(w); s2[0] += x[0]; s2[1] += x[1];
  });
  log.push('  escritas filas ' + inicio + ' a ' + (inicio + bloque.length - 1) + ' · fechas mal: ' + malas +
           ' · releido ' + _zsNum_(s2[0]).toFixed(2) + ' / ' + _zsNum_(s2[1]).toFixed(2));
  return { ok: !malas, escritas: bloque.length };
}

function _zsCorrer_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID), log = [escribir ? '=== CARGA ===' : '=== REVISION, no escribe ==='];
  // primero se revisan los tres; si alguno frena, no se escribe ninguno
  var ok = ['BI', 'BAC', 'TC'].every(function (k) { return _zsLibro_(ss, ZS[k], false, log).ok; });
  if (escribir) {
    if (!ok) { log.push('>> NO se escribio nada: hay un freno.'); return log.join('\n'); }
    ['BI', 'BAC', 'TC'].forEach(function (k) { _zsLibro_(ss, ZS[k], true, log); });
  }
  return log.join('\n');
}

function revisarSeptiembre2026() { return _zsCorrer_(false); }
function cargarSeptiembre2026()  { return _zsCorrer_(true); }
