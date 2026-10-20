/**
 * ROSANTA · Reservas de Wix → pestaña pauta_semanal (este mismo libro)
 * ------------------------------------------------------------------------------
 * Cuenta las reservas por semana ISO desde Wix Table Reservations y escribe las
 * columnas "reservas" y "comensalesReserva" (suma de details.partySize, el campo
 * obligatorio de comensales). No toca Google ni Meta (eso lo llena el Google Ads
 * Script). Las columnas nuevas las crea la intranet (Dashboard de Pauta); si
 * comensalesReserva faltara, el script lo avisa en el Log y escribe solo
 * "reservas".
 *
 * Globales con prefijo WIXRES_ para no chocar con Code.js (SHEET_ID ya existe).
 *
 * CREDENCIALES (pestaña  config  de la Sheet):
 *   config!A2 = API key de Wix
 *   config!A3 = Site ID  (47968b83-c2c2-4b11-8f94-ef2c7488debc)
 *
 * USO:
 *   1. Ejecuta  backfillReservas()   -> llena S27..S31 de una vez.
 *   2. Ejecuta  reservasSemanaPasada() una vez para probar.
 *   3. Activador (⏰ Triggers) → reservasSemanaPasada → Semanal → lunes 7-8am.
 */

var WIXRES_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var WIXRES_TAB      = 'pauta_semanal';
var WIXRES_YEAR     = 2026;

/** Rellena varias semanas de golpe. Cambia la lista si necesitas otras. */
function backfillReservas() {
  var fallos = [];
  [27, 28, 29, 30, 31].forEach(function(w) {
    try { procesarSemana(w); } catch (e) { fallos.push('S' + w + ': ' + e.message); }
  });
  // Se escriben las semanas que si salieron y recien despues se avisa: un fallo
  // en una semana no debe costar las otras cuatro.
  if (fallos.length) throw new Error('Backfill incompleto:\n· ' + fallos.join('\n· '));
}

/** Para el activador semanal: procesa la semana que acaba de cerrar. */
function reservasSemanaPasada() {
  var now = new Date(), dow = (now.getDay() + 6) % 7;
  var thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  procesarSemana(isoWeek(lastMon));
}

function procesarSemana(wk) {
  var mon = mondayOfIsoWeek(WIXRES_YEAR, wk);
  var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  var desde = Utilities.formatDate(mon, 'America/Guatemala', "yyyy-MM-dd'T'00:00:00.000'Z'");
  var hasta = Utilities.formatDate(sun, 'America/Guatemala', "yyyy-MM-dd'T'23:59:59.999'Z'");

  var r = contarReservas(desde, hasta);   // lanza si falla, no devuelve null
  escribirReservas(wk, r.reservas, r.comensales);
  Logger.log('S' + wk + ' → ' + r.reservas + ' reservas · ' + r.comensales + ' comensales');
}

/** Query Reservations de Wix, paginando. Devuelve {reservas, comensales} o null si falla. */
function contarReservas(desde, hasta) {
  var cred = wixCredenciales_();
  var apiKey = cred.apiKey, siteId = cred.siteId;
  if (!apiKey || !siteId) {
    throw new Error('Faltan las credenciales de Wix. Crear WIX_API_KEY y WIX_SITE_ID ' +
                    'en Configuracion del proyecto > Propiedades del script.');
  }

  var url = 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/query';
  var total = 0, comensales = 0, offset = 0, limit = 100, guard = 0;

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
    var res = wixFetch_(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': apiKey, 'wix-site-id': siteId },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var data = JSON.parse(res.getContentText());
    var lote = (data.reservations || []);
    lote.forEach(function(r) {
      comensales += Number((r.details && r.details.partySize) || 0);
    });
    total += lote.length;
    if (lote.length < limit) break;
    offset += limit;
  }
  return { reservas: total, comensales: comensales };
}

function escribirReservas(wk, reservas, comensales) {
  var sh = SpreadsheetApp.openById(WIXRES_SHEET_ID).getSheetByName(WIXRES_TAB);
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
  if (col['comensalesReserva'] !== undefined) {
    sh.getRange(rowIdx, col['comensalesReserva'] + 1).setValue(comensales);
  } else {
    Logger.log('Sin columna comensalesReserva: abre el Dashboard de Pauta de la intranet una vez (crea las columnas nuevas) y vuelve a correr.');
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

/**
 * Credenciales de Wix, desde Propiedades del script.
 *
 * Hasta el 31-ago-2026 vivian en la pestana `config` de este mismo libro, donde
 * las veia cualquiera con permiso de LECTURA sobre la hoja. Ahora estan en
 * Configuracion del proyecto > Propiedades del script:
 *     WIX_API_KEY   la API key de Wix
 *     WIX_SITE_ID   47968b83-c2c2-4b11-8f94-ef2c7488debc
 * Asi no salen en el codigo, ni en las versiones, ni en los respaldos, ni en un
 * clasp pull. Las celdas config!A1, A2 y A3 se vaciaron ese mismo dia.
 *
 * OJO al rotar la API key: hay que cambiarla aqui y en ningun otro sitio. El
 * token de META en cambio vive duplicado en dos proyectos (META_CAPI_TOKEN aqui
 * y META_TOKEN en la intranet) y hay que cambiarlo en los dos.
 */
function wixCredenciales_() {
  var props = PropertiesService.getScriptProperties();
  return {
    apiKey: String(props.getProperty('WIX_API_KEY') || '').trim(),
    siteId: String(props.getProperty('WIX_SITE_ID') || '').trim()
  };
}

var WIXRES_INTENTOS = 3;
var WIXRES_REINTENTABLES = [429, 500, 502, 503, 504];

/**
 * Llama a la API de Wix reintentando SOLO lo que tiene sentido reintentar.
 *
 * Un 401 o un 403 son de credenciales: reintentar es perder el tiempo tres veces
 * con el mismo error. Paso el 31-ago-2026, con una API key copiada a medias.
 * Un 429 o un 5xx si son pasajeros y merecen otro intento.
 *
 * Nunca devuelve null: o trae la respuesta o lanza. Antes devolvia null, y quien
 * llamaba escribia un Logger.log y se iba, asi que una semana podia quedarse sin
 * reservas para siempre sin que nadie se enterara. Lanzando, Apps Script manda el
 * correo de activador fallido al dueno sin necesitar ningun scope.
 */
function wixFetch_(url, opciones) {
  var ultimo = '';
  for (var intento = 1; intento <= WIXRES_INTENTOS; intento++) {
    var res = UrlFetchApp.fetch(url, opciones);
    var code = res.getResponseCode();
    if (code === 200) return res;

    ultimo = 'HTTP ' + code + ' · ' + res.getContentText().slice(0, 200);

    if (WIXRES_REINTENTABLES.indexOf(code) === -1) {
      throw new Error('Wix rechazo la peticion (' + ultimo + '). ' +
        ((code === 401 || code === 403)
          ? 'Revisa WIX_API_KEY y WIX_SITE_ID en Propiedades del script: casi siempre es una key incompleta o caducada.'
          : 'No es un error pasajero, no se reintenta.'));
    }

    Logger.log('Wix ' + ultimo + ' · reintento ' + intento + ' de ' + WIXRES_INTENTOS);
    Utilities.sleep(1500 * intento);
  }
  throw new Error('Wix sigue fallando tras ' + WIXRES_INTENTOS + ' intentos (' + ultimo + ').');
}
