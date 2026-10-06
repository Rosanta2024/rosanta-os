// ============================================================
// ROSANTA - Banco Industrial, semana S40 (28 sep al 4 oct 2026)
// Generado el 5 oct 2026 desde los dos PDF de "Consulta personalizada" de S40:
//   174539_JUAN_6500002057_202610517753.pdf   27/09 al 30/09
//   174539_JUAN_6500002057_202610517831.pdf   01/10 al 04/10
// Mismo molde que cargar_banco_S39.js. Las 3 filas del 27/09 ya estan (S39): se saltan.
//
// VALIDADO CONTRA EL BANCO (totales impresos al pie de cada PDF):
//   27/09-30/09  17 filas  debitos 17,589.70  creditos 13,583.98
//   01/10-04/10  15 filas  debitos  7,729.26  creditos 17,636.22
//
// Categorias que decidio Juanma el 5-oct-2026:
//   'S38 Cofradia VARIOS' Q2,198               -> BEBIDAS (Cofradia de los Vinos)
//   'TRANSFERENCIA T.I./BI-EN LINEA' Q854.26   -> PAGO_TARJETA_CREDITO (tarjeta BI)
//   'S28 Personal...' / 'S29 Extras...'        -> NOMINA (extra de cocina y limpieza)
//   Lavanderia: la salida es gasto (GASTOS_ADMINISTRATIVOS, como la de mayo) y la
//   entrada ACH CORSAGA es el traspaso que la cubre (INGRESO_TRANSFERENCIA)
// El resto sigue la historia: Jardineria = MANTENIMIENTO, Grupo Eco = ALQUILER_EQUIPO,
// La Torre = ALIMENTOS, BAC Tarjeta / PAG.A TAR = PAGO_TARJETA_CREDITO,
// BAC CORSAGA (traspaso a la cuenta propia del BAC) = TRANSFERENCIA.
//
// COMO SE CORRE:  revisarBancoS40() (no escribe) -> cargarBancoS40() -> generarEspejo()
// ============================================================

var SHEET_ID_BS40 = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_BS40 = '03_Banco_Industrial';
var FILA_ENCABEZADO_BS40 = 4;

var TOTALES_BS40 = [
  ['2026-09-27', '2026-09-30', 17589.70, 13583.98],
  ['2026-10-01', '2026-10-04', 7729.26, 17636.22]
];

var LOTE_BS40 = [
  ['2026-09-27', '187310', 'VISANET AF:087972000', 0.00, 2284.53, 'INGRESO_TARJETA'],
  ['2026-09-27', '786669', 'VISANET AF:087972000', 0.00, 3860.49, 'INGRESO_TARJETA'],
  ['2026-09-27', '391', 'ATM 603 DESPENSA ANTIGUA GUATEMALA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-28', '769637', 'VISANET AF:087972000', 0.00, 696.47, 'INGRESO_TARJETA'],
  ['2026-09-28', '159929', 'S38 Fernanda', 800.00, 0.00, 'NOMINA'],
  ['2026-09-28', '174658', 'LA TORRE ANTIGUA 3DB GT', 276.70, 0.00, 'ALIMENTOS'],
  ['2026-09-28', '175741', 'S28 Personal Cocina y Limpieza', 700.00, 0.00, 'NOMINA'],
  ['2026-09-28', '192294', 'S38 Cofradia VARIOS', 2198.00, 0.00, 'BEBIDAS'],
  ['2026-09-29', '128665', 'ACH CORSAGA, SOCIEDAD AN A', 0.00, 4200.00, 'INGRESO_TRANSFERENCIA'],
  ['2026-09-29', '801442', 'VISANET AF:087972000', 0.00, 1169.87, 'INGRESO_TARJETA'],
  ['2026-09-29', '123089', 'Grupo Eco Septiembre', 1250.00, 0.00, 'ALQUILER_EQUIPO'],
  ['2026-09-29', '191708', '2a Septiembre jeffry', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-29', '207611', '2a Septiembre jose', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-29', '207620', '2a Septiembre Nadia', 2000.00, 0.00, 'NOMINA'],
  ['2026-09-29', '207629', '2a Septiembre Efrain', 2000.00, 0.00, 'NOMINA'],
  ['2026-09-30', '965234', 'VISANET AF:087972000', 0.00, 1372.62, 'INGRESO_TARJETA'],
  ['2026-09-30', '133583', 'BAC Tarjeta', 1365.00, 0.00, 'PAGO_TARJETA_CREDITO'],
  ['2026-10-01', '154873', 'BAC CORSAGA', 1000.00, 0.00, 'TRANSFERENCIA'],
  ['2026-10-02', '177099', 'ACH CORSAGA SOCIEDAD ANONIMA Lanvan', 0.00, 301.00, 'INGRESO_TRANSFERENCIA'],
  ['2026-10-02', '788602', 'VISANET AF:087972000', 0.00, 5132.25, 'INGRESO_TARJETA'],
  ['2026-10-02', '737', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 1600.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-10-02', '28518', 'TRANSFERENCIA T.I./BI-EN LINEA', 854.26, 0.00, 'PAGO_TARJETA_CREDITO'],
  ['2026-10-02', '158944', 'S38 y S39 Jardineria', 500.00, 0.00, 'MANTENIMIENTO'],
  ['2026-10-02', '185764', 'S39 Eddy Sala', 850.00, 0.00, 'NOMINA'],
  ['2026-10-02', '185787', 'S39 fernandad Cocina', 800.00, 0.00, 'NOMINA'],
  ['2026-10-02', '204208', 'S29 Extras Cocina Limpeza', 600.00, 0.00, 'NOMINA'],
  ['2026-10-02', '215509', 'PAG.A TAR.D.CRED/PAG.WGT', 224.00, 0.00, 'PAGO_TARJETA_CREDITO'],
  ['2026-10-02', '224550', 'Lanvanderia Oct', 301.00, 0.00, 'GASTOS_ADMINISTRATIVOS'],
  ['2026-10-03', '245823', 'VISANET AF:087972000', 0.00, 4190.15, 'INGRESO_TARJETA'],
  ['2026-10-04', '822415', 'VISANET AF:087972000', 0.00, 5372.26, 'INGRESO_TARJETA'],
  ['2026-10-04', '995749', 'VISANET AF:087972000', 0.00, 2640.56, 'INGRESO_TARJETA'],
  ['2026-10-04', '3688', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 1000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
];

function _bs40Num_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _bs40Dia_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    // regla 10 del motor: de 12:00 en adelante es el dia siguiente
    var d = new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : '';
}

function _bs40Clave_(fecha, docto, deb, cred) {
  return fecha + '|' + String(docto).replace(/\.0+$/, '').trim() + '|' +
         _bs40Num_(deb).toFixed(2) + '|' + _bs40Num_(cred).toFixed(2);
}

function _bs40SemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

/** Suma el lote por cada rango impreso del banco. Devuelve los avisos. */
function _bs40Cuadre_(filas, leer) {
  var avisos = [];
  TOTALES_BS40.forEach(function (T) {
    var deb = 0, cred = 0, n = 0;
    filas.forEach(function (f) {
      var x = leer(f);
      if (x.fecha >= T[0] && x.fecha <= T[1]) { deb += x.deb; cred += x.cred; n++; }
    });
    deb = _bs40Num_(deb); cred = _bs40Num_(cred);
    Logger.log('  %s a %s: %s filas · debitos %s · creditos %s', T[0], T[1], n, deb.toFixed(2), cred.toFixed(2));
    if (deb !== T[2] || cred !== T[3]) {
      avisos.push('NO CUADRA ' + T[0] + ' a ' + T[1] + ': el banco imprime ' + T[2].toFixed(2) +
                  ' / ' + T[3].toFixed(2));
    }
  });
  return avisos;
}

function _bs40Correr_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_BS40);
  var sh = ss.getSheetByName(HOJA_BS40);
  if (!sh) throw new Error('No encuentro la hoja ' + HOJA_BS40);
  var avisos = [];

  var enc = sh.getRange(FILA_ENCABEZADO_BS40, 1, 1, 11).getValues()[0].map(String);
  var esperado = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
  for (var e = 0; e < esperado.length; e++) {
    if (enc[e].trim() !== esperado[e]) avisos.push('Encabezado distinto en la columna ' + (e + 1) + ': "' + enc[e] + '"');
  }

  Logger.log('=== El lote contra los totales del banco ===');
  avisos = avisos.concat(_bs40Cuadre_(LOTE_BS40, function (f) { return { fecha: f[0], deb: f[3], cred: f[4] }; }));

  // lo que ya esta en la hoja, y la ultima fila con datos de verdad
  var datos = sh.getRange(1, 1, sh.getLastRow(), 11).getValues();
  var ya = {}, ultima = FILA_ENCABEZADO_BS40;
  for (var r = FILA_ENCABEZADO_BS40; r < datos.length; r++) {
    var fila = datos[r];
    if (String(fila[0]).trim() === '' && String(fila[2]).trim() === '') continue;
    ultima = r + 1;
    ya[_bs40Clave_(_bs40Dia_(fila[0]), fila[1], fila[3], fila[4])] = 1;
  }

  var nuevas = LOTE_BS40.filter(function (f) { return !ya[_bs40Clave_(f[0], f[1], f[3], f[4])]; });
  Logger.log('=== %s ===', escribir ? 'CARGA' : 'REVISION, no se escribe nada');
  Logger.log('Ultima fila con datos: %s · en el lote: %s · ya estaban: %s · por agregar: %s',
             ultima, LOTE_BS40.length, LOTE_BS40.length - nuevas.length, nuevas.length);
  if (nuevas.length && nuevas.length !== LOTE_BS40.length) {
    avisos.push('Parte del lote ya estaba en la hoja. No es un error, pero mirar que filas: ' +
                'alguien cargo una parte a mano.');
  }

  if (avisos.length) {
    Logger.log('--- AVISOS ---');
    avisos.forEach(function (a) { Logger.log('  ' + a); });
  } else Logger.log('Sin avisos.');

  var frenos = avisos.filter(function (a) { return /NO CUADRA|Encabezado/.test(a); });
  if (!escribir || !nuevas.length || frenos.length) {
    if (escribir && frenos.length) Logger.log('>> NO se escribio nada: hay un aviso que frena.');
    return;
  }

  // Año, Mes y Semana: si la ultima fila los trae como formula, se copia la formula;
  // si los trae como valor, se escribe el valor.
  var formulas = sh.getRange(ultima, 9, 1, 3).getFormulasR1C1()[0];
  var inicio = ultima + 1;
  var bloque = nuevas.map(function (f) {
    var p = f[0].split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return [f[0], f[1], f[2], f[3], f[4], '', f[5], (f[5] === 'PERSONAL' ? 'Si' : 'No'),
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _bs40SemanaISO_(d)];
  });
  sh.getRange(inicio, 1, bloque.length, 11).setValues(bloque);
  SpreadsheetApp.flush();

  // ---- RELEER lo escrito: fechas como fecha, y las sumas otra vez contra el banco
  var leido = sh.getRange(inicio, 1, bloque.length, 11).getValues();
  var malas = 0;
  for (var i = 0; i < leido.length; i++) {
    var esFecha = Object.prototype.toString.call(leido[i][0]) === '[object Date]';
    if (!esFecha || _bs40Dia_(leido[i][0]) !== nuevas[i][0]) {
      malas++;
      Logger.log('  FECHA MAL en la fila %s: quedo "%s", debia ser %s', inicio + i, leido[i][0], nuevas[i][0]);
    }
  }
  Logger.log('=== Releido de la hoja: filas %s a %s ===', inicio, inicio + bloque.length - 1);
  var avisosLeido = nuevas.length === LOTE_BS40.length
    ? _bs40Cuadre_(leido, function (f) { return { fecha: _bs40Dia_(f[0]), deb: _bs40Num_(f[3]), cred: _bs40Num_(f[4]) }; })
    : [];
  if (malas || avisosLeido.length) {
    Logger.log('>> REVISAR: %s fecha(s) mal y %s cuadre(s) que no dan. Avisar antes de seguir.', malas, avisosLeido.length);
    avisosLeido.forEach(function (a) { Logger.log('  ' + a); });
  } else {
    Logger.log('OK: %s filas escritas y releidas. Falta correr generarEspejo().', bloque.length);
  }
}

function revisarBancoS40() { _bs40Correr_(false); }
function cargarBancoS40()  { _bs40Correr_(true); }
