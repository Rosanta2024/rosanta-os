/**
 * ROSANTA · CLIENTES NUEVOS para el CAC   [BLOQUE ADITIVO — no borra nada]
 * ------------------------------------------------------------------------------
 * PEGAR AL FINAL del script "WIX Reservas" que ya existe. NO reemplaces el archivo:
 * el script actual ya escribe `reservas` y `comensalesReserva`, y eso se conserva.
 *
 * Todas las funciones llevan prefijo  cn  para no chocar con las existentes.
 *
 * QUÉ HACE: cuenta, por semana, cuántas reservas vienen de un contacto SIN reservas
 * previas (= cliente nuevo) y lo escribe en la columna  clientes_nuevos.
 *      CAC = (gCosto + mCosto) / clientes_nuevos
 *
 * USO:
 *   1. cnBackfill()          → rellena S27..S33 de una vez.
 *   2. cnSemanaPasada()      → agrégale un trigger semanal (lunes 8-9am), después
 *                              del trigger que ya tienes de reservas.
 *   3. cnVerEstructura()     → solo si sale 0 en todo: loguea una reserva cruda
 *                              para ver dónde vienen email/teléfono.
 */

var CN_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var CN_TAB      = 'pauta_semanal';
var CN_YEAR     = 2026;
var CN_BASE     = '2026-01-01T00:00:00.000Z';   // histórico para saber quién ya había reservado

function cnBackfill() {
  [27, 28, 29, 30, 31, 32, 33].forEach(function(w) { cnSemana(w); });
}

function cnSemanaPasada() {
  var now = new Date(), dow = (now.getDay() + 6) % 7;
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  cnSemana(cnIsoWeek(lastMon));
}

function cnSemana(wk) {
  var mon = cnMonday(CN_YEAR, wk);
  var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  var tz = 'America/Guatemala';
  var desde = Utilities.formatDate(mon, tz, "yyyy-MM-dd'T'00:00:00.000'Z'");
  var hasta = Utilities.formatDate(sun, tz, "yyyy-MM-dd'T'23:59:59.999'Z'");

  var semana = cnTraer(desde, hasta);
  if (semana === null) { Logger.log('S' + wk + ': sin datos (credenciales o permisos)'); return; }

  var previas = cnTraer(CN_BASE, desde) || [];
  var vistos = {};
  previas.forEach(function(r) { var k = cnId(r); if (k) vistos[k] = true; });

  var nuevos = 0, sinContacto = 0;
  semana.forEach(function(r) {
    var k = cnId(r);
    if (!k) { sinContacto++; return; }
    if (!vistos[k]) { nuevos++; vistos[k] = true; }
  });

  cnEscribir(wk, nuevos);
  Logger.log('S' + wk + ' → ' + semana.length + ' reservas · ' + nuevos + ' clientes nuevos' +
             (sinContacto ? ' (' + sinContacto + ' sin contacto)' : ''));
}

/** Identificador del contacto: email en minúsculas, o últimos 8 dígitos del teléfono. */
function cnId(r) {
  var buscar = function(o, rutas) {
    for (var i = 0; i < rutas.length; i++) {
      var v = rutas[i].split('.').reduce(function(a, k) { return (a && a[k] !== undefined) ? a[k] : undefined; }, o);
      if (v) return String(v);
    }
    return '';
  };
  var email = buscar(r, ['details.contact.email', 'contact.email', 'email', 'contactDetails.email', 'details.email']);
  if (email) return 'e:' + email.trim().toLowerCase();
  var tel = buscar(r, ['details.contact.phone', 'contact.phone', 'phone', 'contactDetails.phone', 'details.phone']);
  if (tel) return 't:' + tel.replace(/[^0-9]/g, '').slice(-8);
  return '';
}

/** Trae las reservas del rango (paginado). null si falla. */
function cnTraer(desde, hasta) {
  var cfg = SpreadsheetApp.openById(CN_SHEET_ID).getSheetByName('config');
  var apiKey = String(cfg.getRange('A2').getValue() || '').trim();
  var siteId = String(cfg.getRange('A3').getValue() || '').trim();
  if (!apiKey || !siteId) { Logger.log('Falta config!A2 o config!A3'); return null; }

  var url = 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/query';
  var out = [], offset = 0, limit = 100, guard = 0;

  while (guard++ < 50) {
    var payload = { query: {
      filter: { '$and': [
        { 'details.startDate': { '$gte': desde } },
        { 'details.startDate': { '$lte': hasta } }
      ]},
      paging: { limit: limit, offset: offset }
    }};
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { 'Authorization': apiKey, 'wix-site-id': siteId },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Wix HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return null;
    }
    var lote = JSON.parse(res.getContentText()).reservations || [];
    out = out.concat(lote);
    if (lote.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Escribe SOLO la columna clientes_nuevos. No toca ninguna otra. */
function cnEscribir(wk, nuevos) {
  var sh = SpreadsheetApp.openById(CN_SHEET_ID).getSheetByName(CN_TAB);
  var data = sh.getDataRange().getValues();
  var head = data[0], col = {};
  head.forEach(function(h, i) { col[h] = i; });

  if (col['clientes_nuevos'] === undefined) {
    Logger.log('Falta el encabezado "clientes_nuevos" en pauta_semanal.');
    return;
  }
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col['wk']]) === String(wk)) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) {   // la semana aún no existe: crea la fila solo con wk
    var line = new Array(head.length).fill('');
    line[col['wk']] = wk;
    sh.appendRow(line);
    rowIdx = sh.getLastRow();
  }
  sh.getRange(rowIdx, col['clientes_nuevos'] + 1).setValue(nuevos);
}

/** Diagnóstico: ver cómo viene una reserva (si el conteo da 0 en todas las semanas). */
function cnVerEstructura() {
  var r = cnTraer(CN_BASE, new Date().toISOString());
  if (!r || !r.length) { Logger.log('Sin reservas para inspeccionar'); return; }
  Logger.log(JSON.stringify(r[0], null, 2).slice(0, 2000));
  Logger.log('cnId detectado: ' + (cnId(r[0]) || '(vacío — hay que ajustar las rutas)'));
}

function cnIsoWeek(d) {
  var date = new Date(d.getTime()); date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  var w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function cnMonday(y, w) {
  var d = new Date(y, 0, 4);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (w - 1) * 7);
  return d;
}
