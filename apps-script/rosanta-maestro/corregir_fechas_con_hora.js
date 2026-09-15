// ============================================================
// ROSANTA - Fechas del FEL y de ventas guardadas con hora (p120 / A15)
// Generado el 15 sep 2026 desde el espejo del 14-sep 22:11.
//
// QUE ARREGLA
// 157 filas del maestro (38 facturas en 01_FEL_Maestro y 119 tickets en
// 02_Ventas_Maestro) tienen la fecha a las 22:00 o 23:00 del dia ANTERIOR al
// verdadero. Lo demas del maestro esta a medianoche.
//
// POR QUE PASO
// Apps Script (el cargador y el pegado de jul-ago) escribio la medianoche de
// Guatemala en un Sheet que estaba en otra zona horaria, una hora atras en
// verano y dos en invierno. El Sheet la guardo como las 23:00 (22:00) del dia
// anterior. Python lee eso tal cual y la intranet, segun la zona del Sheet,
// leia un dia o el otro: la factura de GRUPO ECO de abril caia en marzo.
// Hoy el Sheet ya esta en (GMT-06:00) Guatemala.
//
// COMO SE SUPO CUAL ES LA FECHA VERDADERA (15-sep-2026, contra las fuentes)
//   · Ventas de julio: ticket 7013 dice 30/06 23:00 en el maestro y 1/7/2026 en
//     ReporteVentas_7_13_2026. Tickets 7019, 7047, 7048, 7083 y 7088, igual.
//   · Ventas de S37: ticket 7489 dice 06/09 23:00 y el reporte dice 7/9/2026;
//     7496 -> 8/9, 7531 -> 13/9.
//   · FEL de S37: DTE 3948563532 dice 06/09 23:00 y la SAT dice 2026-09-07;
//     601312645 -> 2026-09-11, 3045082023 -> 2026-09-09, 3523300253 -> 2026-09-13.
//   · GRUPO ECO DTE 487473840 (31/03 23:00) esta en el export del 2o trimestre.
//   En TODAS la fecha verdadera es el DIA SIGUIENTE a medianoche.
//
// COMO FUNCIONA
// Busca cada fila por su LLAVE (Numero_DTE o TicketId), nunca por numero de
// fila, y verifica que la hoja muestre HOY la fecha y hora esperadas y el monto
// esperado. Si algo no cuadra, no la toca y lo reporta. Se puede correr dos
// veces sin dano: la segunda vez las cuenta como "ya estaban bien".
// Si la zona del Sheet no es la del script, no hace nada y avisa.
// Reporta tambien las filas con hora que NO estan en el lote (cargas nuevas).
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarFechasConHora()   no escribe. Tiene que decir 157 filas y
//                               "Sin avisos". Si no, parar y avisar.
//   2. corregirFechasConHora()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_FH = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// [llave, fecha y hora que muestra HOY la hoja, monto, fecha verdadera]
var LOTE_FH_FEL = [
  ['2702920850', '2026-07-29 23:00', 921.25, '2026-07-30'],   // CARNICERIA " SANTA ROSA"
  ['838943395', '2026-07-28 23:00', 690.00, '2026-07-29'],   // CARNICERIA " SANTA ROSA"
  ['2783988677', '2026-05-30 23:00', 6000.00, '2026-05-31'],   // JUAN MANUEL LEMUS VALDEZ
  ['533677141', '2026-05-30 23:00', 6217.74, '2026-05-31'],   // COMPAÑIA DE PROCESAMIENTO DE M
  ['1028669702', '2026-05-05 23:00', 250.00, '2026-05-06'],   // ALQUIFIESTAS MEG
  ['3952822192', '2026-04-22 23:00', 336.75, '2026-04-23'],   // 2ONZAS EVENTS
  ['3971105120', '2026-04-22 23:00', 336.75, '2026-04-23'],   // 2ONZAS EVENTS
  ['487473840', '2026-03-31 23:00', 1467.14, '2026-04-01'],   // GRUPO ECO
  ['285428535', '2026-03-09 23:00', 275.00, '2026-03-10'],   // CLINICA DE FISIOTERAPIA ROCA
  ['2440711242', '2026-02-10 22:00', 520.00, '2026-02-11'],   // MIXOKIT
  ['341132076', '2026-01-24 22:00', 1500.00, '2026-01-25'],   // DISTRIBUIDORA DE ALIMENTOS LOS
  ['4243541301', '2026-01-16 22:00', 430.00, '2026-01-17'],   // 2ONZAS EVENTS
  ['3038725621', '2026-01-13 22:00', 390.00, '2026-01-14'],   // CLINICA DE FISIOTERAPIA ROCA
  ['3523300253', '2026-09-12 23:00', 97.07, '2026-09-13'],   // ENTRE VOLCANES
  ['2659076275', '2026-09-11 23:00', 70.00, '2026-09-12'],   // CAOBA MARKET
  ['325078556', '2026-09-11 23:00', 60.30, '2026-09-12'],   // CONVENIENCIA COMERCIAL UXMAL
  ['2082228796', '2026-09-11 23:00', 1589.00, '2026-09-12'],   // DISTRIBUIDORA DE FRUTAS Y VERD
  ['4052109823', '2026-09-11 23:00', 950.00, '2026-09-12'],   // DISTRIBUIDORA DE FRUTAS Y VERD
  ['3181593079', '2026-09-11 23:00', 300.00, '2026-09-12'],   // ROTONDAS
  ['4257762974', '2026-09-11 23:00', 939.53, '2026-09-12'],   // SALA DE VENTAS ANTIGUA GUATEMA
  ['601312645', '2026-09-10 23:00', 398.00, '2026-09-11'],   // TELECOMUNICACIONES DE GUATEMAL
  ['3141750372', '2026-09-10 23:00', 450.00, '2026-09-11'],   // BODEGA FELIZ
  ['629555412', '2026-09-10 23:00', 301.00, '2026-09-11'],   // LAVANDERÍA LA CANDELARIA
  ['862997603', '2026-09-10 23:00', 526.75, '2026-09-11'],   // 2ONZAS EVENTS
  ['4072295979', '2026-09-10 23:00', 702.16, '2026-09-11'],   // CREDOMATIC DE GUATEMALA
  ['2177911541', '2026-09-09 23:00', 170.00, '2026-09-10'],   // DISTRIBUIDORA LA NUEVA, AGENCI
  ['3577824228', '2026-09-09 23:00', 1317.00, '2026-09-10'],   // ELITE MARCAS
  ['2624799871', '2026-09-09 23:00', 665.60, '2026-09-10'],   // BELCA GUATEMALA
  ['1126450740', '2026-09-08 23:00', 132.00, '2026-09-09'],   // TABLE SOLUTIONS
  ['4146676770', '2026-09-08 23:00', 500.00, '2026-09-09'],   // LA COFRADIA DE LOS VINOS
  ['1031555009', '2026-09-08 23:00', 414.05, '2026-09-09'],   // NUEVOS TERRITORIOS
  ['231490424', '2026-09-08 23:00', 629.00, '2026-09-09'],   // DISTRIBUIDORA XELAC 4
  ['3045082023', '2026-09-08 23:00', 125.00, '2026-09-09'],   // LA NACIONAL
  ['1224886551', '2026-09-07 23:00', 1680.00, '2026-09-08'],   // ECONTRISA
  ['3575529784', '2026-09-07 23:00', 113.00, '2026-09-08'],   // CHINA MALL ANTIGUA
  ['1347372575', '2026-09-07 23:00', 369.16, '2026-09-08'],   // POSFILE
  ['1717257683', '2026-09-07 23:00', 1470.00, '2026-09-08'],   // ALTOGAS
  ['3948563532', '2026-09-06 23:00', 2000.00, '2026-09-07'],   // SERVICIOS PROFESIONALES DE ABO
];

var LOTE_FH_VENTAS = [
  ['7013', '2026-06-30 23:00', 209.00, '2026-07-01'],
  ['7014', '2026-06-30 23:00', 522.50, '2026-07-01'],
  ['7015', '2026-06-30 23:00', 544.50, '2026-07-01'],
  ['7016', '2026-06-30 23:00', 814.00, '2026-07-01'],
  ['7017', '2026-06-30 23:00', 885.50, '2026-07-01'],
  ['7018', '2026-06-30 23:00', 968.00, '2026-07-01'],
  ['7019', '2026-07-01 23:00', 352.00, '2026-07-02'],
  ['7020', '2026-07-01 23:00', 731.50, '2026-07-02'],
  ['7021', '2026-07-01 23:00', 984.50, '2026-07-02'],
  ['7022', '2026-07-01 23:00', 599.50, '2026-07-02'],
  ['7023', '2026-07-01 23:00', 401.50, '2026-07-02'],
  ['7024', '2026-07-01 23:00', 99.00, '2026-07-02'],
  ['7025', '2026-07-02 23:00', 803.00, '2026-07-03'],
  ['7026', '2026-07-02 23:00', 594.00, '2026-07-03'],
  ['7027', '2026-07-02 23:00', 616.00, '2026-07-03'],
  ['7028', '2026-07-02 23:00', 374.00, '2026-07-03'],
  ['7029', '2026-07-02 23:00', 687.50, '2026-07-03'],
  ['7030', '2026-07-02 23:00', 495.00, '2026-07-03'],
  ['7031', '2026-07-02 23:00', 1622.50, '2026-07-03'],
  ['7032', '2026-07-02 23:00', 390.50, '2026-07-03'],
  ['7033', '2026-07-02 23:00', 682.00, '2026-07-03'],
  ['7034', '2026-07-03 23:00', 38.50, '2026-07-04'],
  ['7035', '2026-07-03 23:00', 192.50, '2026-07-04'],
  ['7036', '2026-07-03 23:00', 1012.00, '2026-07-04'],
  ['7037', '2026-07-03 23:00', 528.00, '2026-07-04'],
  ['7038', '2026-07-03 23:00', 517.00, '2026-07-04'],
  ['7039', '2026-07-03 23:00', 522.50, '2026-07-04'],
  ['7040', '2026-07-03 23:00', 467.50, '2026-07-04'],
  ['7041', '2026-07-03 23:00', 368.50, '2026-07-04'],
  ['7042', '2026-07-03 23:00', 990.00, '2026-07-04'],
  ['7043', '2026-07-03 23:00', 1215.50, '2026-07-04'],
  ['7044', '2026-07-03 23:00', 874.50, '2026-07-04'],
  ['7045', '2026-07-03 23:00', 896.50, '2026-07-04'],
  ['7046', '2026-07-03 23:00', 495.00, '2026-07-04'],
  ['7047', '2026-07-04 23:00', 148.50, '2026-07-05'],
  ['7048', '2026-07-05 23:00', 396.00, '2026-07-06'],
  ['7049', '2026-07-05 23:00', 572.00, '2026-07-06'],
  ['7050', '2026-07-05 23:00', 313.50, '2026-07-06'],
  ['7051', '2026-07-05 23:00', 577.50, '2026-07-06'],
  ['7052', '2026-07-06 23:00', 286.00, '2026-07-07'],
  ['7053', '2026-07-07 23:00', 77.00, '2026-07-08'],
  ['7054', '2026-07-07 23:00', 786.50, '2026-07-08'],
  ['7055', '2026-07-08 23:00', 1111.00, '2026-07-09'],
  ['7056', '2026-07-08 23:00', 599.50, '2026-07-09'],
  ['7057', '2026-07-08 23:00', 1325.50, '2026-07-09'],
  ['7058', '2026-07-08 23:00', 852.50, '2026-07-09'],
  ['7059', '2026-07-08 23:00', 1001.00, '2026-07-09'],
  ['7060', '2026-07-08 23:00', 1023.00, '2026-07-09'],
  ['7061', '2026-07-08 23:00', 528.00, '2026-07-09'],
  ['7062', '2026-07-08 23:00', 348.70, '2026-07-09'],
  ['7063', '2026-07-09 23:00', 830.50, '2026-07-10'],
  ['7064', '2026-07-09 23:00', 236.50, '2026-07-10'],
  ['7065', '2026-07-09 23:00', 445.50, '2026-07-10'],
  ['7066', '2026-07-09 23:00', 577.50, '2026-07-10'],
  ['7067', '2026-07-09 23:00', 599.50, '2026-07-10'],
  ['7068', '2026-07-09 23:00', 181.50, '2026-07-10'],
  ['7069', '2026-07-09 23:00', 610.50, '2026-07-10'],
  ['7070', '2026-07-09 23:00', 379.50, '2026-07-10'],
  ['7071', '2026-07-09 23:00', 308.00, '2026-07-10'],
  ['7072', '2026-07-09 23:00', 198.00, '2026-07-10'],
  ['7073', '2026-07-10 23:00', 8027.00, '2026-07-11'],
  ['7074', '2026-07-10 23:00', 484.00, '2026-07-11'],
  ['7075', '2026-07-10 23:00', 775.50, '2026-07-11'],
  ['7076', '2026-07-10 23:00', 440.00, '2026-07-11'],
  ['7077', '2026-07-10 23:00', 1353.00, '2026-07-11'],
  ['7078', '2026-07-10 23:00', 297.00, '2026-07-11'],
  ['7079', '2026-07-10 23:00', 484.00, '2026-07-11'],
  ['7080', '2026-07-10 23:00', 1039.50, '2026-07-11'],
  ['7081', '2026-07-10 23:00', 697.40, '2026-07-11'],
  ['7082', '2026-07-10 23:00', 445.50, '2026-07-11'],
  ['7083', '2026-07-11 23:00', 603.90, '2026-07-12'],
  ['7084', '2026-07-11 23:00', 202.40, '2026-07-12'],
  ['7085', '2026-07-11 23:00', 583.00, '2026-07-12'],
  ['7086', '2026-07-11 23:00', 550.00, '2026-07-12'],
  ['7087', '2026-07-11 23:00', 984.50, '2026-07-12'],
  ['7088', '2026-07-11 23:00', 2607.00, '2026-07-12'],
  ['7489', '2026-09-06 23:00', 495.00, '2026-09-07'],
  ['7490', '2026-09-06 23:00', 484.00, '2026-09-07'],
  ['7491', '2026-09-06 23:00', 478.50, '2026-09-07'],
  ['7492', '2026-09-06 23:00', 676.50, '2026-09-07'],
  ['7493', '2026-09-06 23:00', 1985.50, '2026-09-07'],
  ['7494', '2026-09-06 23:00', 940.50, '2026-09-07'],
  ['7495', '2026-09-06 23:00', 1369.50, '2026-09-07'],
  ['7496', '2026-09-07 23:00', 2112.00, '2026-09-08'],
  ['7497', '2026-09-07 23:00', 616.00, '2026-09-08'],
  ['7498', '2026-09-07 23:00', 495.00, '2026-09-08'],
  ['7499', '2026-09-08 23:00', 896.50, '2026-09-09'],
  ['7500', '2026-09-08 23:00', 280.50, '2026-09-09'],
  ['7501', '2026-09-08 23:00', 649.00, '2026-09-09'],
  ['7502', '2026-09-08 23:00', 286.00, '2026-09-09'],
  ['7503', '2026-09-08 23:00', 561.00, '2026-09-09'],
  ['7504', '2026-09-08 23:00', 225.50, '2026-09-09'],
  ['7505', '2026-09-09 23:00', 1237.50, '2026-09-10'],
  ['7506', '2026-09-09 23:00', 324.50, '2026-09-10'],
  ['7507', '2026-09-09 23:00', 1023.00, '2026-09-10'],
  ['7508', '2026-09-10 23:00', 539.00, '2026-09-11'],
  ['7509', '2026-09-10 23:00', 632.50, '2026-09-11'],
  ['7510', '2026-09-10 23:00', 407.00, '2026-09-11'],
  ['7511', '2026-09-10 23:00', 533.50, '2026-09-11'],
  ['7512', '2026-09-10 23:00', 885.50, '2026-09-11'],
  ['7513', '2026-09-10 23:00', 995.50, '2026-09-11'],
  ['7514', '2026-09-10 23:00', 588.50, '2026-09-11'],
  ['7515', '2026-09-11 23:00', 528.00, '2026-09-12'],
  ['7516', '2026-09-11 23:00', 154.00, '2026-09-12'],
  ['7517', '2026-09-11 23:00', 1177.00, '2026-09-12'],
  ['7518', '2026-09-11 23:00', 302.50, '2026-09-12'],
  ['7519', '2026-09-11 23:00', 544.50, '2026-09-12'],
  ['7520', '2026-09-11 23:00', 643.50, '2026-09-12'],
  ['7521', '2026-09-11 23:00', 693.00, '2026-09-12'],
  ['7522', '2026-09-11 23:00', 451.00, '2026-09-12'],
  ['7523', '2026-09-12 23:00', 594.00, '2026-09-13'],
  ['7524', '2026-09-12 23:00', 885.50, '2026-09-13'],
  ['7525', '2026-09-12 23:00', 786.50, '2026-09-13'],
  ['7526', '2026-09-12 23:00', 445.50, '2026-09-13'],
  ['7527', '2026-09-12 23:00', 1281.50, '2026-09-13'],
  ['7528', '2026-09-12 23:00', 352.00, '2026-09-13'],
  ['7529', '2026-09-12 23:00', 891.00, '2026-09-13'],
  ['7530', '2026-09-12 23:00', 517.00, '2026-09-13'],
  ['7531', '2026-09-12 23:00', 979.00, '2026-09-13'],
];

// 01_FEL_Maestro:    1 Fecha · 4 Numero_DTE · 10 Gran_Total
// 02_Ventas_Maestro: 1 TicketId · 2 Fecha · 5 TotalFinal
var LIBROS_FH = [
  { nombre: 'FEL',    hoja: '01_FEL_Maestro',    llave: 4, fecha: 1, monto: 10, lote: LOTE_FH_FEL },
  { nombre: 'VENTAS', hoja: '02_Ventas_Maestro', llave: 1, fecha: 2, monto: 5,  lote: LOTE_FH_VENTAS }
];

function _fhLlave(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _fhDosDig(n) { return (n < 10 ? '0' : '') + n; }
/** Fecha y hora de pared, SIN llamar a Utilities (el script y el Sheet estan en la misma zona). */
function _fhTexto(d) {
  return d.getFullYear() + '-' + _fhDosDig(d.getMonth() + 1) + '-' + _fhDosDig(d.getDate()) +
         ' ' + _fhDosDig(d.getHours()) + ':' + _fhDosDig(d.getMinutes());
}

function _fhCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_FH);
  var zonaSheet = ss.getSpreadsheetTimeZone(), zonaScript = Session.getScriptTimeZone();
  if (zonaSheet !== zonaScript) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + zonaSheet + ' y el script en ' + zonaScript +
               '. Con zonas distintas cada lector ve otro dia. Avisar antes de seguir.');
    return;
  }
  var avisos = [], hechas = 0, yaEstaban = 0, fuera = [], pendientes = [], escritas = [];
  LIBROS_FH.forEach(function (L) {
    var sh = ss.getSheetByName(L.hoja);
    if (!sh) { avisos.push('No existe la hoja ' + L.hoja); return; }
    var datos = sh.getDataRange().getValues();
    var idx = {}, enLote = {};
    L.lote.forEach(function (it) { enLote[it[0]] = true; });
    for (var r = 4; r < datos.length; r++) {
      var k = _fhLlave(datos[r][L.llave - 1]);
      if (!k) continue;
      (idx[k] = idx[k] || []).push(r);
      var f = datos[r][L.fecha - 1];
      if (f instanceof Date && (f.getHours() || f.getMinutes()) && !enLote[k]) {
        fuera.push(L.nombre + ' ' + k + ' ' + _fhTexto(f));
      }
    }
    L.lote.forEach(function (it) {
      var filas = idx[it[0]] || [];
      if (!filas.length) { avisos.push('Sin coincidencia ' + L.nombre + ' ' + it[0]); return; }
      if (filas.length > 1) {
        avisos.push('LLAVE REPETIDA ' + L.nombre + ' ' + it[0] + ' (' + filas.length + ' filas). No se toca.');
        return;
      }
      var r = filas[0], f = datos[r][L.fecha - 1], m = Number(datos[r][L.monto - 1]);
      if (!(f instanceof Date)) { avisos.push('SIN FECHA ' + L.nombre + ' ' + it[0] + '. No se toca.'); return; }
      if (Math.abs(m - it[2]) > 0.01) {
        avisos.push('NO CUADRA EL MONTO ' + L.nombre + ' ' + it[0] + ' · hoja ' + m + ' · esperado ' + it[2] + '. No se toca.');
        return;
      }
      var hoy = _fhTexto(f);
      if (hoy === it[3] + ' 00:00') { yaEstaban++; return; }
      if (hoy !== it[1]) {
        avisos.push('NO CUADRA LA FECHA ' + L.nombre + ' ' + it[0] + ' · hoja "' + hoy + '" · esperado "' + it[1] + '". No se toca.');
        return;
      }
      if (escribir) {
        var p = it[3].split('-');
        sh.getRange(r + 1, L.fecha).setValue(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
        escritas.push({ sh: sh, nombre: L.nombre, llave: it[0], fila: r + 1, col: L.fecha, meta: it[3] + ' 00:00' });
      }
      pendientes.push(L.nombre + ' ' + it[0] + ' fila ' + (r + 1) + ' "' + hoy + '" -> ' + it[3]);
      hechas++;
    });
  });
  // 15-sep-2026: la primera corrida escribio 157 y la revision siguiente encontro 37
  // todavia con hora. Desde entonces se relee lo escrito y se dice cual no quedo.
  var noQuedaron = [];
  if (escritas.length) {
    SpreadsheetApp.flush();
    var releida = {};
    escritas.forEach(function (w) {
      var clave = w.nombre;
      if (!releida[clave]) releida[clave] = w.sh.getRange(1, w.col, w.sh.getLastRow(), 1).getValues();
      var v = releida[clave][w.fila - 1][0];
      var txt = v instanceof Date ? _fhTexto(v) : String(v);
      if (txt !== w.meta) noQuedaron.push(w.nombre + ' ' + w.llave + ' fila ' + w.fila + ': se escribio ' + w.meta + ' y la hoja dice "' + txt + '"');
    });
  }
  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(hechas + ' filas a corregir (lote: ' + LOTE_FH_FEL.length + ' FEL + ' + LOTE_FH_VENTAS.length + ' ventas)');
  Logger.log('Ya estaban bien: ' + yaEstaban);
  if (pendientes.length) {
    Logger.log('--- las que ' + (escribir ? 'se escribieron' : 'faltan') + ' ---');
    pendientes.forEach(function (x) { Logger.log('   ' + x); });
  }
  if (escribir) {
    Logger.log(noQuedaron.length ? '--- NO QUEDARON (' + noQuedaron.length + ') ---' : 'Releidas: todas quedaron a medianoche.');
    noQuedaron.forEach(function (x) { Logger.log('   ' + x); });
  }
  if (fuera.length) {
    Logger.log('--- con hora y FUERA del lote (no se tocan; avisar) ---');
    fuera.forEach(function (x) { Logger.log('   ' + x); });
  }
  if (avisos.length) {
    Logger.log('--- revisar ---');
    avisos.forEach(function (x) { Logger.log('   ' + x); });
  } else {
    Logger.log('Sin avisos: todas las filas del lote se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarFechasConHora() { _fhCorrer(false); }

/** Pone cada fecha del lote en su dia verdadero, a medianoche. */
function corregirFechasConHora() { _fhCorrer(true); }

/**
 * Diagnostico del 15-sep-2026. La segunda corrida escribio 37 fechas del FEL y al
 * releerlas en la misma ejecucion la hoja seguia con la hora vieja; las 119 de
 * ventas si quedaron. Esto mira que tienen esas celdas: formula, formato, merge,
 * validacion y protecciones.
 *
 * Escribe UNA sola celda, A984, y solo si todavia es la factura 2702920850 a las
 * 23:00 del 29-jul: la pone como TEXTO '2026-07-30' para ver si asi la acepta. Es
 * la fecha verdadera de esa fila, asi que no deja nada mal.
 */
function diagnosticarFechasFEL() {
  var ss = SpreadsheetApp.openById(SHEET_ID_FH);
  var sh = ss.getSheetByName('01_FEL_Maestro');
  Logger.log('Zona del Sheet ' + ss.getSpreadsheetTimeZone() + ' · del script ' + Session.getScriptTimeZone() +
             ' · locale ' + ss.getSpreadsheetLocale() + ' · hojas con este nombre: ' +
             ss.getSheets().filter(function (h) { return h.getName() === '01_FEL_Maestro'; }).length);
  [983, 984, 988, 996, 1022, 1023, 1047].forEach(function (f) {
    var c = sh.getRange(f, 1);
    var dv = c.getDataValidation();
    Logger.log('A' + f + ' · formula "' + c.getFormula() + '" · valor ' + c.getValue() +
               ' · se ve "' + c.getDisplayValue() + '" · formato "' + c.getNumberFormat() +
               '" · merge ' + c.isPartOfMerge() + ' · validacion ' + (dv ? dv.getCriteriaType() : 'no') +
               ' · DTE ' + sh.getRange(f, 4).getValue());
  });
  var prot = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .concat(sh.getProtections(SpreadsheetApp.ProtectionType.SHEET));
  Logger.log('Protecciones: ' + prot.length + prot.map(function (p) {
    var r = p.getRange();
    return ' · ' + (r ? r.getA1Notation() : 'hoja') + (p.isWarningOnly() ? ' (solo aviso)' : '');
  }).join(''));
  var formulas = sh.getRange(1, 1, sh.getLastRow(), 1).getFormulas();
  var conFormula = [];
  formulas.forEach(function (x, i) { if (x[0]) conFormula.push(i + 1); });
  Logger.log('Columna A con formula: ' + conFormula.length + (conFormula.length ? ' · filas ' + conFormula.slice(0, 30).join(', ') : ''));
  var cab = sh.getRange(1, 1, 4, sh.getLastColumn()).getFormulas();
  Logger.log('Formulas en las filas 1-4: ' + JSON.stringify(cab.map(function (r) { return r.filter(String); })));

  var c984 = sh.getRange(984, 1), v = c984.getValue();
  var dte = String(sh.getRange(984, 4).getValue()).replace(/\.0+$/, '');
  if (dte === '2702920850' && v instanceof Date && _fhTexto(v) === '2026-07-29 23:00') {
    c984.setValue('2026-07-30');
    SpreadsheetApp.flush();
    var d = c984.getValue();
    Logger.log('Prueba en A984 con texto "2026-07-30": la hoja dice ahora ' +
               (d instanceof Date ? '"' + _fhTexto(d) + '"' : 'texto "' + d + '"') + ' · se ve "' + c984.getDisplayValue() + '"');
  } else {
    Logger.log('Prueba en A984 no hecha: la celda ya no es la esperada (DTE ' + dte + ', valor ' + v + ')');
  }
}
