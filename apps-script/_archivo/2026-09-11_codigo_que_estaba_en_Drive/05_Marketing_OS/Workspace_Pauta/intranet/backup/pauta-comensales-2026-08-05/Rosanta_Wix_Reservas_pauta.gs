/**
 * ROSANTA · Reservas de Wix → Sheet "Rosanta Marketing OS" (pestaña pauta_semanal)
 * ------------------------------------------------------------------------------
 * Cuenta las reservas por semana ISO desde Wix Table Reservations y escribe la
 * columna "reservas". No toca Google ni Meta (eso lo llena el Google Ads Script).
 *
 * DÓNDE VA: Apps Script del proyecto "Rosanta Marketing OS" (el de la Sheet) o
 * un proyecto nuevo. Extensiones → Apps Script → pega este archivo.
 *
 * CREDENCIALES (ya deberían estar en la pestaña  config  de la Sheet):
 *   config!A2 = API key de Wix
 *   config!A3 = Site ID  (47968b83-c2c2-4b11-8f94-ef2c7488debc)
 *
 * USO:
 *   1. Ejecuta  backfillReservas()   -> llena S27..S31 de una vez.
 *   2. Ejecuta  reservasSemanaPasada() una vez para probar.
 *   3. Activador (⏰ Triggers) → reservasSemanaPasada → Semanal → lunes 7-8am.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB      = 'pauta_semanal';
var YEAR     = 2026;

/** Rellena varias semanas de golpe. Cambia la lista si necesitas otras. */
function backfillReservas() {
  [27, 28, 29, 30, 31].forEach(function(w) { procesarSemana(w); });
}

/** Para el activador semanal: procesa la semana que acaba de cerrar. */
function reservasSemanaPasada() {
  var now = new Date(), dow = (now.getDay() + 6) % 7;
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  procesarSemana(isoWeek(lastMon));
}

function procesarSemana(wk) {
  var mon = mondayOfIsoWeek(YEAR, wk);
  var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  var desde = Utilities.formatDate(mon, 'America/Guatemala', "yyyy-MM-dd'T'00:00:00.000'Z'");
  var hasta = Utilities.formatDate(sun, 'America/Guatemala', "yyyy-MM-dd'T'23:59:59.999'Z'");

  var n = contarReservas(desde, hasta);
  if (n === null) { Logger.log('S' + wk + ': sin datos (revisa credenciales o permisos)'); return; }
  escribirReservas(wk, n);
  Logger.log('S' + wk + ' → ' + n + ' reservas');
}

/** Query Reservations de Wix, paginando. Devuelve el conteo o null si falla. */
function contarReservas(desde, hasta) {
  var cfg = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  var apiKey = String(cfg.getRange('A2').getValue() || '').trim();
  var siteId = String(cfg.getRange('A3').getValue() || '').trim();
  if (!apiKey || !siteId) { Logger.log('Falta config!A2 (API key) o config!A3 (Site ID)'); return null; }

  var url = 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/query';
  var total = 0, offset = 0, limit = 100, guard = 0;

  while (guard++ < 50) {
    var payload = {
      query: {
        filter: {
          '$and': [
            { 'details.startDate': { '$gte': desde } },
            { 'details.startDate': { '$lte': hasta } }
          ]
        },
        paging: { limit: limit, offset: offset }
      }
    };
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': apiKey, 'wix-site-id': siteId },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code !== 200) { Logger.log('Wix HTTP ' + code + ': ' + res.getContentText().slice(0, 300)); return null; }

    var data = JSON.parse(res.getContentText());
    var lote = (data.reservations || []).length;
    total += lote;
    if (lote < limit) break;
    offset += limit;
  }
  return total;
}

function escribirReservas(wk, reservas) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
  var data = sh.getDataRange().getValues();
  var head = data[0], col = {};
  head.forEach(function(h, i) { col[h] = i; });

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
  sh.getRange(rowIdx, col['reservas'] + 1).setValue(reservas);
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
