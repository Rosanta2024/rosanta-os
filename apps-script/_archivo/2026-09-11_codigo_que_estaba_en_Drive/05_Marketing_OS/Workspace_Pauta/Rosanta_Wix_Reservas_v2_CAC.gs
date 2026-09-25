/**
 * ROSANTA · Reservas de Wix → pauta_semanal   [v2 · agrega CLIENTES NUEVOS para el CAC]
 * ------------------------------------------------------------------------------
 * Además de contar las reservas de la semana, marca cuántas vienen de un
 * contacto SIN reservas previas (= cliente nuevo). Con eso el Dashboard calcula:
 *      CAC = (gCosto Google + mCosto Meta) / clientes_nuevos
 *
 * ANTES DE CORRER (una vez):
 *   En la Sheet "Rosanta Marketing OS" → pestaña  pauta_semanal  → agrega el
 *   encabezado  clientes_nuevos  en la primera fila libre a la derecha
 *   (después de fecha_registro). El script escribe en esa columna por nombre.
 *
 * FUNCIONES:
 *   verEstructuraReserva()  → diagnóstico: loguea una reserva cruda (para confirmar
 *                             dónde vienen email/teléfono). Correr solo si algo falla.
 *   backfillReservas()      → rellena S27..S31 (reservas + clientes nuevos).
 *   reservasSemanaPasada()  → la del trigger semanal (lunes).
 *
 * Reemplaza al script anterior: mismo nombre de funciones, así el trigger sigue igual.
 */

var SHEET_ID   = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB        = 'pauta_semanal';
var YEAR       = 2026;
var DESDE_BASE = '2026-01-01T00:00:00.000Z';  // histórico para saber quién ya había reservado

function backfillReservas() {
  [27, 28, 29, 30, 31].forEach(function(w) { procesarSemana(w); });
}

function reservasSemanaPasada() {
  var now = new Date(), dow = (now.getDay() + 6) % 7;
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  procesarSemana(isoWeek(lastMon));
}

function procesarSemana(wk) {
  var mon = mondayOfIsoWeek(YEAR, wk);
  var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  var tz = 'America/Guatemala';
  var desde = Utilities.formatDate(mon, tz, "yyyy-MM-dd'T'00:00:00.000'Z'");
  var hasta = Utilities.formatDate(sun, tz, "yyyy-MM-dd'T'23:59:59.999'Z'");

  var semana = traerReservas(desde, hasta);
  if (semana === null) { Logger.log('S' + wk + ': sin datos (revisa credenciales o permisos)'); return; }

  // Contactos que YA habían reservado antes de esta semana
  var previas = traerReservas(DESDE_BASE, desde) || [];
  var vistos = {};
  previas.forEach(function(r) { var k = idContacto(r); if (k) vistos[k] = true; });

  var nuevos = 0, sinContacto = 0;
  semana.forEach(function(r) {
    var k = idContacto(r);
    if (!k) { sinContacto++; return; }
    if (!vistos[k]) { nuevos++; vistos[k] = true; }   // marca para no contar 2 veces en la misma semana
  });

  escribir(wk, semana.length, nuevos);
  Logger.log('S' + wk + ' → ' + semana.length + ' reservas · ' + nuevos + ' clientes nuevos' +
             (sinContacto ? ' (' + sinContacto + ' sin contacto)' : ''));
}

/** Identificador del contacto: email en minúsculas, o teléfono solo dígitos. */
function idContacto(r) {
  var buscar = function(o, claves) {
    for (var i = 0; i < claves.length; i++) {
      var v = claves[i].split('.').reduce(function(a, k) { return (a && a[k] !== undefined) ? a[k] : undefined; }, o);
      if (v) return String(v);
    }
    return '';
  };
  var email = buscar(r, ['details.contact.email', 'contact.email', 'email', 'contactDetails.email']);
  if (email) return 'e:' + email.trim().toLowerCase();
  var tel = buscar(r, ['details.contact.phone', 'contact.phone', 'phone', 'contactDetails.phone']);
  if (tel) return 't:' + tel.replace(/[^0-9]/g, '').slice(-8);   // últimos 8 dígitos
  return '';
}

/** Devuelve el array de reservas del rango (paginado) o null si falla. */
function traerReservas(desde, hasta) {
  var cfg = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  var apiKey = String(cfg.getRange('A2').getValue() || '').trim();
  var siteId = String(cfg.getRange('A3').getValue() || '').trim();
  if (!apiKey || !siteId) { Logger.log('Falta config!A2 (API key) o config!A3 (Site ID)'); return null; }

  var url = 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/query';
  var out = [], offset = 0, limit = 100, guard = 0;

  while (guard++ < 50) {
    var payload = {
      query: {
        filter: { '$and': [
          { 'details.startDate': { '$gte': desde } },
          { 'details.startDate': { '$lte': hasta } }
        ]},
        paging: { limit: limit, offset: offset }
      }
    };
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

/** Diagnóstico: ver cómo viene una reserva (por si email/teléfono están en otra ruta). */
function verEstructuraReserva() {
  var r = traerReservas(DESDE_BASE, new Date().toISOString());
  if (!r || !r.length) { Logger.log('Sin reservas para inspeccionar'); return; }
  Logger.log(JSON.stringify(r[0], null, 2).slice(0, 2000));
  Logger.log('idContacto detectado: ' + (idContacto(r[0]) || '(vacío — hay que ajustar las rutas)'));
}

function escribir(wk, reservas, nuevos) {
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
  if (col['clientes_nuevos'] !== undefined) {
    sh.getRange(rowIdx, col['clientes_nuevos'] + 1).setValue(nuevos);
  } else {
    Logger.log('Falta el encabezado "clientes_nuevos" en pauta_semanal: agrégalo y vuelve a correr.');
  }
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
