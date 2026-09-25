/**
 * ROSANTA · Google Ads Script → Sheet "Rosanta Marketing OS" (pestaña pauta_semanal)
 * ------------------------------------------------------------------------------
 * Escribe el GASTO, CLICS e IMPRESIONES de Google Ads de la semana pasada
 * (lunes a domingo) en la pestaña "pauta_semanal", por número de semana ISO.
 * NO toca las columnas de Meta ni de reservas: cada fuente escribe lo suyo.
 *
 * INSTALAR (una vez):
 *  1. Google Ads → Herramientas y configuración → Acciones masivas → Scripts.
 *  2. (+) Nuevo script → pega TODO esto → Guardar.
 *  3. "Autorizar" (con restaurante@rosanta.rest; también autoriza acceso a Sheets).
 *  4. "Vista previa" o "Ejecutar" una vez para probar → revisa el registro.
 *  5. Programar: Frecuencia = Semanal, Lunes por la mañana.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB      = 'pauta_semanal';

function main() {
  var tz  = AdsApp.currentAccount().getTimeZone();
  var now = new Date();
  var dow = (now.getDay() + 6) % 7;            // 0 = lunes
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  var lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
  var fmt = function(d){ return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };
  var since = fmt(lastMon), until = fmt(lastSun);

  var query = "SELECT metrics.cost_micros, metrics.clicks, metrics.impressions " +
              "FROM customer WHERE segments.date BETWEEN '" + since + "' AND '" + until + "'";
  var it = AdsApp.report(query).rows();
  var cost = 0, clicks = 0, impr = 0;
  while (it.hasNext()) {
    var r = it.next();
    cost   += Number(r['metrics.cost_micros']) / 1e6;   // micros -> GTQ
    clicks += Number(r['metrics.clicks']);
    impr   += Number(r['metrics.impressions']);
  }

  writeWeek(isoWeek(lastMon), Math.round(cost * 100) / 100, clicks, impr, until);
}

function isoWeek(d) {
  var date = new Date(d.getTime()); date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  var week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function writeWeek(wk, gCosto, gClics, gImp, fecha) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
  var data = sh.getDataRange().getValues();
  var head = data[0], col = {};
  head.forEach(function(h, i){ col[h] = i; });

  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col['wk']]) === String(wk)) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) {
    var line = new Array(head.length).fill('');
    line[col['wk']] = wk;
    sh.appendRow(line);
    rowIdx = sh.getLastRow();
  }
  sh.getRange(rowIdx, col['gCosto'] + 1).setValue(gCosto);
  sh.getRange(rowIdx, col['gClics'] + 1).setValue(gClics);
  sh.getRange(rowIdx, col['gImp']   + 1).setValue(gImp);
  if (col['fecha_registro'] !== undefined) sh.getRange(rowIdx, col['fecha_registro'] + 1).setValue(fecha);

  Logger.log('S' + wk + ' Google → Q' + gCosto + ' · ' + gClics + ' clics · ' + gImp + ' impr (fila ' + rowIdx + ')');
}
