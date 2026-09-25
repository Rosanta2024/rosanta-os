// ============================================================
// ROSANTA - Banco Industrial, semanas S37 y S38 (7 al 20 de sep 2026)
// Generado el 21 sep 2026 desde los dos PDF de "Consulta personalizada":
//   S37/174539_JUAN_6500002057_2026914115212.pdf   07/09 al 13/09
//   S38/174539_JUAN_6500002057_202692193453.pdf    14/09 al 20/09
//
// QUE HACE
// Agrega al FINAL de 03_Banco_Industrial los 61 movimientos de esas dos semanas,
// ya categorizados con el criterio de la historia del maestro. El maestro llegaba
// al 6-sep: sin estas filas la pestaña Caja arranca de un saldo de hace dos semanas.
//
// VALIDADO CONTRA EL BANCO (totales impresos al pie de cada PDF):
//   S37  33 filas  debitos 33,506.06  creditos 23,697.99
//   S38  28 filas  debitos 19,374.30  creditos 18,989.08
// El script vuelve a sumar antes de escribir y frena si no da eso.
//
// La columna Saldo queda VACIA: esta consulta del banco no la trae. La Caja
// reconstruye el saldo con los movimientos desde el ultimo saldo cargado.
//
// COMO FUNCIONA
// Nunca duplica: una fila que ya esta (misma fecha + Docto + debito + credito) se
// salta. Se puede correr dos veces sin dano. La fecha se escribe como TEXTO
// AAAA-MM-DD y despues de escribir se RELEE la hoja: si una fecha no quedo como
// fecha, o las sumas releidas no dan, lo dice.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarBancoS37S38()   no escribe. Tiene que decir "61 por agregar" (o menos,
//                             si alguien ya cargo parte) y "Sin avisos".
//   2. cargarBancoS37S38()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_BS38 = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_BS38 = '03_Banco_Industrial';
var FILA_ENCABEZADO_BS38 = 4;

// totales impresos por el banco: [desde, hasta, debitos, creditos]
var TOTALES_BS38 = [
  ['2026-09-07', '2026-09-13', 33506.06, 23697.99],
  ['2026-09-14', '2026-09-20', 19374.30, 18989.08]
];

// [fecha, Docto, descripcion, debito, credito, categoria]   Es_Personal = No en todas
var LOTE_BS38 = [
  ['2026-09-07', '142112', 'S36 Servicio Profesiones legal', 2000.00, 0.00, 'SERVICIOS_PROFESIONALES'],
  ['2026-09-07', '159188', 'S35 Eddy', 850.00, 0.00, 'NOMINA'],
  ['2026-09-07', '159189', 'S35 Melvin', 150.00, 0.00, 'NOMINA'],
  ['2026-09-07', '171333', 'LA BODEGONA ANTIGUA GT', 309.80, 0.00, 'ALIMENTOS'],
  ['2026-09-07', '197622', '1a Septiembre 2026', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-07', '197626', '1a Septiembre jose', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-07', '197627', '1a Septiembre Efrain', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-07', '197630', '1a Septiembre Nadia', 2000.00, 0.00, 'NOMINA'],
  ['2026-09-07', '200620', 'PARMA VEL GT', 288.75, 0.00, 'ALIMENTOS'],
  ['2026-09-08', '418678', 'VISANET AF:087972000', 0.00, 3711.20, 'INGRESO_TARJETA'],
  ['2026-09-08', '803111', 'VISANET AF:087972000', 0.00, 2480.58, 'INGRESO_TARJETA'],
  ['2026-09-08', '7289', 'ATM 603 DESPENSA ANTIGUA GUATEMALA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-08', '175258', 'S36 Marvin Finiquito', 1500.00, 0.00, 'NOMINA'],
  ['2026-09-08', '175264', 'Marketing Agosto 2026', 2250.00, 0.00, 'SERVICIOS_PROFESIONALES'],
  ['2026-09-08', '186829', 'S26 Posfile Agosto 2026', 369.16, 0.00, 'CUOTAS_Y_SUSCRIPCIONES'],
  ['2026-09-08', '186836', 'EX Security Complementos', 750.00, 0.00, 'SERVICIO DE MONITOREO Y ALARMA'],
  ['2026-09-08', '198494', 'S36 Cofradia Varios', 1777.00, 0.00, 'BEBIDAS'],
  ['2026-09-08', '208772', 'LA BODEGONA SN ANTONIO GT', 301.00, 0.00, 'ALIMENTOS'],
  ['2026-09-08', '209597', 'S36 Elite Varios', 2408.00, 0.00, 'BEBIDAS'],
  ['2026-09-08', '209608', 'S36 2onzas Varios', 526.75, 0.00, 'COCTELERIA'],
  ['2026-09-08', '209627', 'S36 Belca 2500085423', 330.00, 0.00, 'ALIMENTOS'],
  ['2026-09-08', '209637', 'S36 Industrias VGS 1156465795', 450.00, 0.00, 'BEBIDAS'],
  ['2026-09-09', '483233', 'VISANET AF:087972000', 0.00, 2536.48, 'INGRESO_TARJETA'],
  ['2026-09-09', '4458', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-10', '960882', 'VISANET AF:087972000', 0.00, 1278.68, 'INGRESO_TARJETA'],
  ['2026-09-11', '886290', 'VISANET AF:087972000', 0.00, 3121.03, 'INGRESO_TARJETA'],
  ['2026-09-11', '9595', 'ATM 152 AGENCIA ANTIGUA 5', 1000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-11', '147161', 'S36 Fernanda', 800.00, 0.00, 'NOMINA'],
  ['2026-09-11', '162297', 'S36 Empleados cocina y limpieza', 950.00, 0.00, 'NOMINA'],
  ['2026-09-11', '231574', 'BELCA CC GT', 995.60, 0.00, 'ALIMENTOS'],
  ['2026-09-12', '7900', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-13', '94738', 'VISANET AF:087972000', 0.00, 6397.15, 'INGRESO_TARJETA'],
  ['2026-09-13', '98220', 'VISANET AF:087972000', 0.00, 4172.87, 'INGRESO_TARJETA'],
  ['2026-09-14', '94172', 'VISANET AF:087972000', 0.00, 1233.91, 'INGRESO_TARJETA'],
  ['2026-09-14', '166567', 'S36 y S37 Jardineria', 565.00, 0.00, 'MANTENIMIENTO'],
  ['2026-09-14', '180343', 'S36 Eddy', 820.00, 0.00, 'NOMINA'],
  ['2026-09-14', '180346', 'S36 Melvin', 300.00, 0.00, 'NOMINA'],
  ['2026-09-14', '180352', 'S36 Erickson', 450.00, 0.00, 'NOMINA'],
  ['2026-09-14', '197795', '1a Septiembre 2026', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-14', '197811', '1a Septiembre 2026 jose', 2500.00, 0.00, 'NOMINA'],
  ['2026-09-14', '197824', '1a Septiembre 2026 Nadia', 2000.00, 0.00, 'NOMINA'],
  ['2026-09-14', '197832', '1a Septiembre 2026 Efrain', 1500.00, 0.00, 'NOMINA'],
  ['2026-09-16', '341644', 'VISANET AF:087972000', 0.00, 3258.17, 'INGRESO_TARJETA'],
  ['2026-09-16', '3183', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-16', '26611', 'PAGO TARJETA X61601211', 200.00, 0.00, 'PAGO_TARJETA_CREDITO'],
  ['2026-09-16', '176702', 'S37 Nomina Cocina', 750.00, 0.00, 'NOMINA'],
  ['2026-09-16', '193840', 'Tavito 480330786', 428.00, 0.00, 'COCTELERIA'],
  ['2026-09-16', '193852', 'MC Industrias 2253014585', 209.00, 0.00, 'SUMINISTRO DE LIMPIEZA'],
  ['2026-09-16', '207119', 'Doorways 3468575508', 686.35, 0.00, 'SUMINISTRO DE LIMPIEZA'],
  ['2026-09-16', '222995', 'Fogliasana 1886276328', 172.00, 0.00, 'ALIMENTOS'],
  ['2026-09-16', '231216', 'S37 Eddy', 850.00, 0.00, 'NOMINA'],
  ['2026-09-16', '261464', 'S37 Erickson', 450.00, 0.00, 'NOMINA'],
  ['2026-09-16', '261470', 'S37 Melvin', 150.00, 0.00, 'NOMINA'],
  ['2026-09-16', '261488', 'S37 Fernanda', 800.00, 0.00, 'NOMINA'],
  ['2026-09-17', '579782', 'VISANET AF:087972000', 0.00, 968.78, 'INGRESO_TARJETA'],
  ['2026-09-17', '837040', 'VISANET AF:087972000', 0.00, 5354.80, 'INGRESO_TARJETA'],
  ['2026-09-17', '209971', 'LA BODEGONA GT', 43.95, 0.00, 'ALIMENTOS'],
  ['2026-09-19', '712104', 'VISANET AF:087972000', 0.00, 1685.77, 'INGRESO_TARJETA'],
  ['2026-09-19', '7231', 'ATM 095 AGENCIA RECOLECCION ANTIGUA', 2000.00, 0.00, 'ALIMENTOS_EFECTIVO'],
  ['2026-09-20', '445949', 'VISANET AF:087972000', 0.00, 3981.77, 'INGRESO_TARJETA'],
  ['2026-09-20', '930840', 'VISANET AF:087972000', 0.00, 2505.88, 'INGRESO_TARJETA'],
];

function _bs38Num_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _bs38Dia_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    // regla 10 del motor: de 12:00 en adelante es el dia siguiente
    var d = new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : '';
}

function _bs38Clave_(fecha, docto, deb, cred) {
  return fecha + '|' + String(docto).replace(/\.0+$/, '').trim() + '|' +
         _bs38Num_(deb).toFixed(2) + '|' + _bs38Num_(cred).toFixed(2);
}

function _bs38SemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

/** Suma el lote por cada rango impreso del banco. Devuelve los avisos. */
function _bs38Cuadre_(filas, leer) {
  var avisos = [];
  TOTALES_BS38.forEach(function (T) {
    var deb = 0, cred = 0, n = 0;
    filas.forEach(function (f) {
      var x = leer(f);
      if (x.fecha >= T[0] && x.fecha <= T[1]) { deb += x.deb; cred += x.cred; n++; }
    });
    deb = _bs38Num_(deb); cred = _bs38Num_(cred);
    Logger.log('  %s a %s: %s filas · debitos %s · creditos %s', T[0], T[1], n, deb.toFixed(2), cred.toFixed(2));
    if (deb !== T[2] || cred !== T[3]) {
      avisos.push('NO CUADRA ' + T[0] + ' a ' + T[1] + ': el banco imprime ' + T[2].toFixed(2) +
                  ' / ' + T[3].toFixed(2));
    }
  });
  return avisos;
}

function _bs38Correr_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_BS38);
  var sh = ss.getSheetByName(HOJA_BS38);
  if (!sh) throw new Error('No encuentro la hoja ' + HOJA_BS38);
  var avisos = [];

  var enc = sh.getRange(FILA_ENCABEZADO_BS38, 1, 1, 11).getValues()[0].map(String);
  var esperado = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];
  for (var e = 0; e < esperado.length; e++) {
    if (enc[e].trim() !== esperado[e]) avisos.push('Encabezado distinto en la columna ' + (e + 1) + ': "' + enc[e] + '"');
  }

  Logger.log('=== El lote contra los totales del banco ===');
  avisos = avisos.concat(_bs38Cuadre_(LOTE_BS38, function (f) { return { fecha: f[0], deb: f[3], cred: f[4] }; }));

  // lo que ya esta en la hoja, y la ultima fila con datos de verdad
  var datos = sh.getRange(1, 1, sh.getLastRow(), 11).getValues();
  var ya = {}, ultima = FILA_ENCABEZADO_BS38;
  for (var r = FILA_ENCABEZADO_BS38; r < datos.length; r++) {
    var fila = datos[r];
    if (String(fila[0]).trim() === '' && String(fila[2]).trim() === '') continue;
    ultima = r + 1;
    ya[_bs38Clave_(_bs38Dia_(fila[0]), fila[1], fila[3], fila[4])] = 1;
  }

  var nuevas = LOTE_BS38.filter(function (f) { return !ya[_bs38Clave_(f[0], f[1], f[3], f[4])]; });
  Logger.log('=== %s ===', escribir ? 'CARGA' : 'REVISION, no se escribe nada');
  Logger.log('Ultima fila con datos: %s · en el lote: %s · ya estaban: %s · por agregar: %s',
             ultima, LOTE_BS38.length, LOTE_BS38.length - nuevas.length, nuevas.length);
  if (nuevas.length && nuevas.length !== LOTE_BS38.length) {
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
    return [f[0], f[1], f[2], f[3], f[4], '', f[5], 'No',
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _bs38SemanaISO_(d)];
  });
  sh.getRange(inicio, 1, bloque.length, 11).setValues(bloque);
  SpreadsheetApp.flush();

  // ---- RELEER lo escrito: fechas como fecha, y las sumas otra vez contra el banco
  var leido = sh.getRange(inicio, 1, bloque.length, 11).getValues();
  var malas = 0;
  for (var i = 0; i < leido.length; i++) {
    var esFecha = Object.prototype.toString.call(leido[i][0]) === '[object Date]';
    if (!esFecha || _bs38Dia_(leido[i][0]) !== nuevas[i][0]) {
      malas++;
      Logger.log('  FECHA MAL en la fila %s: quedo "%s", debia ser %s', inicio + i, leido[i][0], nuevas[i][0]);
    }
  }
  Logger.log('=== Releido de la hoja: filas %s a %s ===', inicio, inicio + bloque.length - 1);
  var avisosLeido = nuevas.length === LOTE_BS38.length
    ? _bs38Cuadre_(leido, function (f) { return { fecha: _bs38Dia_(f[0]), deb: _bs38Num_(f[3]), cred: _bs38Num_(f[4]) }; })
    : [];
  if (malas || avisosLeido.length) {
    Logger.log('>> REVISAR: %s fecha(s) mal y %s cuadre(s) que no dan. Avisar antes de seguir.', malas, avisosLeido.length);
    avisosLeido.forEach(function (a) { Logger.log('  ' + a); });
  } else {
    Logger.log('OK: %s filas escritas y releidas. Falta correr generarEspejo().', bloque.length);
  }
}

function revisarBancoS37S38() { _bs38Correr_(false); }
function cargarBancoS37S38()  { _bs38Correr_(true); }
