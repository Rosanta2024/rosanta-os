/**
 * ROSANTA · Google Ads Script → Sheet "Rosanta Marketing OS" (pestaña pauta_semanal)
 * v2 — Google + Meta en un solo script, con backfill.
 * ------------------------------------------------------------------------------
 * Cada semana escribe, por número de semana ISO:
 *   - Google (nativo AdsApp): gCosto, gClics, gImp
 *   - Meta (Graph API vía UrlFetch): mCosto, mAlcance
 *
 * TOKEN DE META (una vez):
 *   En la Sheet "Rosanta Marketing OS" crea una pestaña llamada  config
 *   y pega tu META_TOKEN (el de ads_read) en la celda  A1.
 *   El script lo lee de ahí. NO se pega en el código. Si A1 está vacía,
 *   solo escribe Google y omite Meta sin fallar.
 *
 * BACKFILL vs SEMANAL:
 *   - Para poner al día varias semanas: pon los números en BACKFILL (abajo),
 *     ej. [27,28,29,30,31]. Ejecuta UNA vez. Llena Google+Meta de esas semanas.
 *   - Para dejarlo automático: cambia a  var BACKFILL = [];  (vacío).
 *     Entonces procesa solo la semana pasada. Prográmalo Semanal (lunes) y
 *     BORRA el script viejo (el de solo Google) para no duplicar.
 *
 * INSTALAR: Google Ads → Herramientas → Acciones masivas → Scripts → (+) →
 *   pega esto → Autorizar (con restaurante@rosanta.rest) → Ejecutar.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB      = 'pauta_semanal';
var META_ACCOUNT = 'act_780001897477414';   // Rosanta rosanta.rest
var YEAR = 2026;
var BACKFILL = [27, 28, 29, 30, 31];         // <- semanas a rellenar. [] = solo la semana pasada.

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var token = getMetaToken();
  var weeks = (BACKFILL && BACKFILL.length) ? BACKFILL : [ isoWeek(lastMonday()) ];

  weeks.forEach(function(w) {
    var mon = mondayOfIsoWeek(YEAR, w);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var since = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
    var until = Utilities.formatDate(sun, tz, 'yyyy-MM-dd');

    // ---- Google (nativo) ----
    var q = "SELECT metrics.cost_micros, metrics.clicks, metrics.impressions " +
            "FROM customer WHERE segments.date BETWEEN '" + since + "' AND '" + until + "'";
    var it = AdsApp.report(q).rows();
    var gCosto = 0, gClics = 0, gImp = 0;
    while (it.hasNext()) {
      var r = it.next();
      gCosto += Number(r['metrics.cost_micros']) / 1e6;
      gClics += Number(r['metrics.clicks']);
      gImp   += Number(r['metrics.impressions']);
    }
    gCosto = Math.round(gCosto * 100) / 100;

    // ---- Meta (Graph API) ----
    var meta = token ? fetchMeta(since, until, token) : { spend: '', reach: '' };

    writeWeek(w, gCosto, gClics, gImp, meta.spend, meta.reach, until);
  });
}

function fetchMeta(since, until, token) {
  try {
    var url = 'https://graph.facebook.com/v19.0/' + META_ACCOUNT + '/insights' +
              '?level=account&fields=spend,reach' +
              '&time_range=' + encodeURIComponent(JSON.stringify({ since: since, until: until })) +
              '&access_token=' + encodeURIComponent(token);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { Logger.log('Meta ' + since + ': HTTP ' + res.getResponseCode()); return { spend:'', reach:'' }; }
    var d = JSON.parse(res.getContentText());
    var row = (d.data && d.data[0]) || {};
    return {
      spend: row.spend ? Math.round(Number(row.spend) * 100) / 100 : 0,
      reach: row.reach ? Number(row.reach) : 0
    };
  } catch (e) { Logger.log('Meta error ' + since + ': ' + e); return { spend:'', reach:'' }; }
}

function getMetaToken() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  if (!sh) { Logger.log('Sin pestaña "config": se omite Meta.'); return ''; }
  var t = String(sh.getRange('A1').getValue() || '').trim();
  if (!t) Logger.log('config!A1 vacía: se omite Meta.');
  return t;
}

function lastMonday() {
  var now = new Date(); var dow = (now.getDay() + 6) % 7;
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lm = new Date(thisMon); lm.setDate(thisMon.getDate() - 7); return lm;
}
function isoWeek(d) {
  var date = new Date(d.getTime()); date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  var w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function mondayOfIsoWeek(y, w) {
  var d = new Date(y, 0, 4);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (w - 1) * 7);
  return d;
}

function writeWeek(wk, gCosto, gClics, gImp, mCosto, mAlcance, fecha) {
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
  if (mCosto   !== '') sh.getRange(rowIdx, col['mCosto']   + 1).setValue(mCosto);
  if (mAlcance !== '') sh.getRange(rowIdx, col['mAlcance'] + 1).setValue(mAlcance);
  if (col['fecha_registro'] !== undefined) sh.getRange(rowIdx, col['fecha_registro'] + 1).setValue(fecha);

  Logger.log('S' + wk + '  Google Q' + gCosto + ' · ' + gClics + ' clics · ' + gImp + ' impr   |   Meta Q' + mCosto + ' · alcance ' + mAlcance + '   (fila ' + rowIdx + ')');
}
