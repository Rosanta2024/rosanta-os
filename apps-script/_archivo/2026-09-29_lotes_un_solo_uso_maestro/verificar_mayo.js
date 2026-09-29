// ============================================================
// ROSANTA - Verificacion despues del borrado manual de mayo
// 3 sep 2026.
//
// Juanma borro a mano las 54 filas duplicadas de mayo. Este script
// comprueba que el borrado salio limpio: ni de menos, ni de mas, ni
// en el mes equivocado.
//
// Los valores esperados salen del espejo del 2-sep, ANTES del borrado,
// restando exactamente las 54 filas identificadas. Si algo no cuadra,
// lo dice con nombre y apellido.
//
// NO ESCRIBE NADA. Se puede correr las veces que sea.
//
// USO: correr "verificarMayo" y leer el Log.
// ============================================================

var SHEET_ID_VER = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var FILA_1_VER   = 5;
var CV_SERIE = 3, CV_DTE = 4, CV_PROV = 7, CV_TOTAL = 10, CV_ANIO = 12, CV_MES = 16;

// mes -> [filas esperadas, monto esperado]  (2026, despues del borrado)
// CORREGIDO 3-sep-2026, despues del borrado.
// La primera version esperaba 982 filas y 5 sin DTE, porque yo habia contado
// solo 54 duplicados. Eran 59: cuatro de las cinco que crei "sin gemela" si la
// tenian, pero la serie venia en notacion cientifica en una copia y normal en
// la otra ('1.0402673E7' contra '10402673'), y mi comparacion era de texto.
// Leccion: al buscar duplicados por un identificador numerico, normalizar el
// formato antes de comparar. Alquifiestas Q250 no tenia gemela pero estaba
// anulada, asi que ya no contaba de todas formas.
var ESPERADO_VER = {
  1: [100,  51370.33], 2: [140,  73731.26], 3: [128, 144093.88], 4: [145, 128229.59],
  5: [117,  61406.44], 6: [100, 130306.67], 7: [126, 121173.08], 8: [121,  60958.63]
};
var TOTAL_ESPERADO_VER = 977;

function _tVER(v) { return String(v == null ? '' : v).trim(); }
function _nVER(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function verificarMayo() {
  var sh = SpreadsheetApp.openById(SHEET_ID_VER).getSheetByName('01_FEL_Maestro');
  var d = sh.getDataRange().getValues();

  var porMes = {}, total = 0, sinDte = [], porSerie = {};
  for (var r = FILA_1_VER - 1; r < d.length; r++) {
    var serie = _tVER(d[r][CV_SERIE - 1]);
    if (!serie) continue;
    var monto = _nVER(d[r][CV_TOTAL - 1]);
    if (!monto && !_tVER(d[r][CV_PROV - 1])) continue;
    total++;
    var mes = Number(d[r][CV_MES - 1]) || 0;
    if (!porMes[mes]) porMes[mes] = [0, 0];
    porMes[mes][0]++; porMes[mes][1] += monto;
    if (!porSerie[serie]) porSerie[serie] = [];
    porSerie[serie].push({ fila: r + 1, prov: _tVER(d[r][CV_PROV - 1]), monto: monto,
                           dte: _tVER(d[r][CV_DTE - 1]) });
    if (!_tVER(d[r][CV_DTE - 1])) {
      sinDte.push({ fila: r + 1, mes: mes, prov: _tVER(d[r][CV_PROV - 1]),
                    monto: monto, serie: serie });
    }
  }

  var fallos = [];
  Logger.log('=== 1. Filas y montos por mes ===');
  Logger.log('  mes   filas(hoy/esperado)        monto(hoy)        monto(esperado)');
  for (var m = 1; m <= 8; m++) {
    var hoy = porMes[m] || [0, 0], esp = ESPERADO_VER[m];
    var okF = hoy[0] === esp[0], okM = Math.abs(hoy[1] - esp[1]) < 0.05;
    Logger.log('   ' + m + '     ' + hoy[0] + ' / ' + esp[0] + '  ' + (okF ? 'ok ' : '<-- NO CUADRA ') +
               '   Q' + hoy[1].toFixed(2) + '   Q' + esp[1].toFixed(2) + '  ' + (okM ? 'ok' : '<-- NO CUADRA'));
    if (!okF) fallos.push('mes ' + m + ': hay ' + hoy[0] + ' filas y deberian ser ' + esp[0]);
    if (!okM) fallos.push('mes ' + m + ': monto Q' + hoy[1].toFixed(2) + ', esperado Q' + esp[1].toFixed(2));
  }
  Logger.log('  TOTAL: ' + total + ' filas (esperado ' + TOTAL_ESPERADO_VER + ')');
  if (total !== TOTAL_ESPERADO_VER) fallos.push('total ' + total + ', esperado ' + TOTAL_ESPERADO_VER);

  Logger.log('');
  Logger.log('=== 2. Filas sin Numero_DTE (deben quedar 0) ===');
  sinDte.forEach(function (x) {
    Logger.log('  fila ' + x.fila + '  mes ' + x.mes + '  ' + x.prov + '  Q' + x.monto.toFixed(2) +
               '  serie ' + x.serie);
  });
  Logger.log('  total: ' + sinDte.length);
  if (sinDte.length !== 0) fallos.push('quedan ' + sinDte.length + ' filas sin DTE, deberian ser 0');

  Logger.log('');
  Logger.log('=== 3. Series repetidas que todavia tengan una copia sin DTE ===');
  var restan = 0;
  for (var s in porSerie) {
    var v = porSerie[s];
    if (v.length < 2) continue;
    var haySin = false;
    for (var i = 0; i < v.length; i++) if (!v[i].dte) haySin = true;
    if (!haySin) continue;
    restan++;
    Logger.log('  serie ' + s + ' -> filas ' + v.map(function (x) { return x.fila; }).join(', '));
  }
  Logger.log('  duplicados sin resolver: ' + restan);
  if (restan) fallos.push(restan + ' serie(s) siguen duplicadas');

  Logger.log('');
  if (fallos.length) {
    Logger.log('*** REVISAR: ' + fallos.length + ' cosa(s) no cuadran ***');
    fallos.forEach(function (x) { Logger.log('  - ' + x); });
    Logger.log('No toques nada mas hasta resolverlo.');
  } else {
    Logger.log('TODO CUADRA. El borrado salio limpio:');
    Logger.log('  977 filas, mayo en Q61,406.44, ninguna fila sin DTE y ninguna');
    Logger.log('  serie duplicada pendiente. Los otros siete meses, intactos.');
  }
}
