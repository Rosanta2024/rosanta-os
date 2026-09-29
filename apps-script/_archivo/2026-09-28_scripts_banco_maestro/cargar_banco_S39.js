// ============================================================
// ROSANTA - Banco Industrial, semana S39 (21 al 27 de sep 2026)
// Generado el 28 sep 2026 desde el PDF de "Consulta personalizada":
//   S39/174539_JUAN_6500002057_20269289335.pdf   21/09 al 27/09
//
// Mismo molde que cargar_banco_S37_S38.js: agrega al FINAL de 03_Banco_Industrial
// los 20 movimientos de la semana, ya categorizados con el criterio de la historia.
//
// VALIDADO CONTRA EL BANCO (totales impresos al pie del PDF):
//   S39  20 filas  debitos 18,244.63  creditos 13,985.35
// El script vuelve a sumar antes de escribir y frena si no da eso.
//
// Categorias que decidio Juanma el 28-sep-2026:
//   'Tour peten' Q2,100           -> PERSONAL
//   'HIT DISTRIBUIDORES GT' Q150  -> ALIMENTOS (proveedor sin nombre confirmado)
// El resto sigue la historia del maestro: BCA.TOTAL = IGSS, EEGSA = SERVICIOS_PUBLICOS,
// Claro = TELEFONOS_Y_CELULARES, ACH CORSAGA (credito) = INGRESO_TRANSFERENCIA,
// retiros ATM/Bancared = ALIMENTOS_EFECTIVO y su cobro = COMISIONES_BANCARIAS.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarBancoS39()   no escribe. Tiene que decir "20 por agregar" y "Sin avisos".
//   2. cargarBancoS39()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_BS39 = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_BS39 = '03_Banco_Industrial';
var FILA_ENCABEZADO_BS39 = 4;

// totales impresos por el banco: [desde, hasta, debitos, creditos]
var TOTALES_BS39 = [
  ['2026-09-21', '2026-09-27', 18244.63, 13985.35]
];

// [fecha, Docto, descripcion, debito, credito, categoria]   Es_Personal = No
// excepto la fila PERSONAL (Tour peten), que lleva Es_Personal = Si como en la historia
var LOTE_BS39 = [
  ['2026-09-21', '899023', 'VISANET AF:087972000', 0.00, 607.45, 'INGRESO_TARJETA'],
  ['2026-09-21', '9090', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-21', '128888', 'PAGO ELECTRONICO BCA.TOTAL', 2003.89, 0.00, 'IGSS'],
  ['2026-09-21', '142354', 'Tour peten', 2100.00, 0.00, 'PERSONAL'],
  ['2026-09-21', '146748', 'HIT DISTRIBUIDORES GT', 150.00, 0.00, 'ALIMENTOS'],
  ['2026-09-22', '321198', 'VISANET AF:087972000', 0.00, 568.41, 'INGRESO_TARJETA'],
  ['2026-09-23', '126641', 'VISANET AF:087972000', 0.00, 1743.18, 'INGRESO_TARJETA'],
  ['2026-09-23', '270016', 'ACH CORSAGA, SOCIEDAD AN A', 0.00, 1490.00, 'INGRESO_TRANSFERENCIA'],
  ['2026-09-24', '595206', 'VISANET AF:087972000', 0.00, 1424.35, 'INGRESO_TARJETA'],
  ['2026-09-25', '874435', 'VISANET AF:087972000', 0.00, 2006.94, 'INGRESO_TARJETA'],
  ['2026-09-25', '170319', 'S38', 850.00, 0.00, 'NOMINA'],
  ['2026-09-25', '170321', 'S38 Erickson', 300.00, 0.00, 'NOMINA'],
  ['2026-09-25', '170324', 'S38 Melvin', 150.00, 0.00, 'NOMINA'],
  ['2026-09-25', '190077', 'PORTAL-BI PAGO EEGSA FAC 00032', 8185.74, 0.00, 'SERVICIOS_PUBLICOS'],
  ['2026-09-25', '217432', 'PORTAL-BI PAGO CLARO POS TLF 00776', 398.00, 0.00, 'TELEFONOS_Y_CELULARES'],
  ['2026-09-26', '683327', 'RETIRO EFECTIVO BANCARED', 100.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-26', '683327', 'COBRO RETIRO BANCARED', 7.00, 0.00, 'COMISIONES_BANCARIAS'],
  ['2026-09-27', '187310', 'VISANET AF:087972000', 0.00, 2284.53, 'INGRESO_TARJETA'],
  ['2026-09-27', '786669', 'VISANET AF:087972000', 0.00, 3860.49, 'INGRESO_TARJETA'],
  ['2026-09-27', '391', 'ATM 603 DESPENSA ANTIGUA GUATEMALA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
];

function _bs39Num_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _bs39Dia_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    // regla 10 del motor: de 12:00 en adelante es el dia siguiente
    var d = new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : '';
}

function _bs39Clave_(fecha, docto, deb, cred) {
  return fecha + '|' + String(docto).replace(/\.0+$/, '').trim() + '|' +
         _bs39Num_(deb).toFixed(2) + '|' + _bs39Num_(cred).toFixed(2);
}

function _bs39SemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

/** Suma el lote por cada rango impreso del banco. Devuelve los avisos. */
function _bs39Cuadre_(filas, leer) {
  var avisos = [];
  TOTALES_BS39.forEach(function (T) {
    var deb = 0, cred = 0, n = 0;
    filas.forEach(function (f) {
      var x = leer(f);
      if (x.fecha >= T[0] && x.fecha <= T[1]) { deb += x.deb; cred += x.cred; n++; }
    });
    deb = _bs39Num_(deb); cred = _bs39Num_(cred);
    Logger.log('  %s a %s: %s filas · debitos %s · creditos %s', T[0], T[1], n, deb.toFixed(2), cred.toFixed(2));
    if (deb !== T[2] || cred !== T[3]) {
      avisos.push('NO CUADRA ' + T[0] + ' a ' + T[1] + ': el banco imprime ' + T[2].toFixed(2) +
                  ' / ' + T[3].toFixed(2));
    }
  });
  return avisos;
}

function _bs39Correr_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_BS39);
  var sh = ss.getSheetByName(HOJA_BS39);
  if (!sh) throw new Error('No encuentro la hoja ' + HOJA_BS39);
  var avisos = [];

  var enc = sh.getRange(FILA_ENCABEZADO_BS39, 1, 1, 11).getValues()[0].map(String);
  var esperado = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
  for (var e = 0; e < esperado.length; e++) {
    if (enc[e].trim() !== esperado[e]) avisos.push('Encabezado distinto en la columna ' + (e + 1) + ': "' + enc[e] + '"');
  }

  Logger.log('=== El lote contra los totales del banco ===');
  avisos = avisos.concat(_bs39Cuadre_(LOTE_BS39, function (f) { return { fecha: f[0], deb: f[3], cred: f[4] }; }));

  // lo que ya esta en la hoja, y la ultima fila con datos de verdad
  var datos = sh.getRange(1, 1, sh.getLastRow(), 11).getValues();
  var ya = {}, ultima = FILA_ENCABEZADO_BS39;
  for (var r = FILA_ENCABEZADO_BS39; r < datos.length; r++) {
    var fila = datos[r];
    if (String(fila[0]).trim() === '' && String(fila[2]).trim() === '') continue;
    ultima = r + 1;
    ya[_bs39Clave_(_bs39Dia_(fila[0]), fila[1], fila[3], fila[4])] = 1;
  }

  var nuevas = LOTE_BS39.filter(function (f) { return !ya[_bs39Clave_(f[0], f[1], f[3], f[4])]; });
  Logger.log('=== %s ===', escribir ? 'CARGA' : 'REVISION, no se escribe nada');
  Logger.log('Ultima fila con datos: %s · en el lote: %s · ya estaban: %s · por agregar: %s',
             ultima, LOTE_BS39.length, LOTE_BS39.length - nuevas.length, nuevas.length);
  if (nuevas.length && nuevas.length !== LOTE_BS39.length) {
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
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _bs39SemanaISO_(d)];
  });
  sh.getRange(inicio, 1, bloque.length, 11).setValues(bloque);
  SpreadsheetApp.flush();

  // ---- RELEER lo escrito: fechas como fecha, y las sumas otra vez contra el banco
  var leido = sh.getRange(inicio, 1, bloque.length, 11).getValues();
  var malas = 0;
  for (var i = 0; i < leido.length; i++) {
    var esFecha = Object.prototype.toString.call(leido[i][0]) === '[object Date]';
    if (!esFecha || _bs39Dia_(leido[i][0]) !== nuevas[i][0]) {
      malas++;
      Logger.log('  FECHA MAL en la fila %s: quedo "%s", debia ser %s', inicio + i, leido[i][0], nuevas[i][0]);
    }
  }
  Logger.log('=== Releido de la hoja: filas %s a %s ===', inicio, inicio + bloque.length - 1);
  var avisosLeido = nuevas.length === LOTE_BS39.length
    ? _bs39Cuadre_(leido, function (f) { return { fecha: _bs39Dia_(f[0]), deb: _bs39Num_(f[3]), cred: _bs39Num_(f[4]) }; })
    : [];
  if (malas || avisosLeido.length) {
    Logger.log('>> REVISAR: %s fecha(s) mal y %s cuadre(s) que no dan. Avisar antes de seguir.', malas, avisosLeido.length);
    avisosLeido.forEach(function (a) { Logger.log('  ' + a); });
  } else {
    Logger.log('OK: %s filas escritas y releidas. Falta correr generarEspejo().', bloque.length);
  }
}

function revisarBancoS39() { _bs39Correr_(false); }
function cargarBancoS39()  { _bs39Correr_(true); }
