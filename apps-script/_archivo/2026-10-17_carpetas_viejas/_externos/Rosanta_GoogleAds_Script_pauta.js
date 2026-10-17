/**
 * ROSANTA · Google Ads Script → Sheet "Rosanta Marketing OS" (pestaña pauta_semanal)
 * v3 — 31-ago-2026. Cambios sobre la v2 al final de esta cabecera.
 * ------------------------------------------------------------------------------
 * NO VIVE EN APPS SCRIPT. Corre dentro de Google Ads:
 *   Google Ads → Herramientas y configuración → Acciones masivas → Scripts
 * Esta copia en el repo es solo para que el script sea encontrable. El 31-ago-2026
 * costó una hora localizarlo porque no estaba en ningún sitio buscable.
 *
 * Cada semana escribe, por número de semana ISO:
 *   - Google (nativo AdsApp): gCosto, gClics, gImp
 *   - Meta (Graph API vía UrlFetch): mCosto, mAlcance
 *
 * TOKEN DE META: pestaña `config` de la Sheet, celda A1. Los Google Ads Scripts
 * NO tienen PropertiesService, así que una celda es la única alternativa a
 * hardcodearlo. OJO: cualquiera con permiso de LECTURA sobre la Sheet lo ve, y
 * cada lectura completa del libro deja una copia en las transcripciones.
 *
 * ------------------------------------------------------------------------------
 * CAMBIOS v3, y por qué:
 *
 * 1. AVISO DE MODO BACKFILL. La v2 se quedó con BACKFILL = [27..31] desde el
 *    5-ago. Resultado: cada semana reprocesaba julio y nunca escribía la semana
 *    actual. gCosto quedó congelado en la S31 durante cuatro semanas y nadie lo
 *    vio. Ahora, si BACKFILL no está vacío, lo grita en el log en cada corrida.
 *    Un modo temporal tiene que anunciarse, o se vuelve permanente en silencio.
 *
 * 2. FALLA FUERTE AL FINAL. La v2 se tragaba los errores de Meta con un
 *    Logger.log. Ahora se acumulan y se lanza excepción DESPUÉS de escribir lo
 *    que sí salió, para que Google Ads mande su aviso de error. Las semanas
 *    buenas se escriben igual: un fallo no debe costar el resto.
 *
 * 3. TOKEN AUSENTE = FALLO, no omisión. Que falte el token era "se omite Meta y
 *    seguimos". Eso es justo lo que hace que un sistema muera sin ruido.
 *
 * NO SE PUEDE usar LockService aquí (no existe en Google Ads Scripts). writeWeek
 * hace appendRow si la fila no existe, igual que PosPauta y WixReservasPauta en
 * el proyecto Apps Script. Si los tres coinciden en el tiempo con la fila aún sin
 * crear, pueden nacer filas duplicadas. Mitigado por horario: los de Apps Script
 * corren martes 7-8am y 8-9am. Programar ESTE en un día u hora distinta.
 *
 * INSTALAR: Google Ads → Herramientas → Acciones masivas → Scripts → (+) →
 *   pega esto → Autorizar (con restaurante@rosanta.rest) → Ejecutar.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB      = 'pauta_semanal';
var META_ACCOUNT = 'act_780001897477414';   // Rosanta rosanta.rest
var YEAR = 2026;

/* SEMANAS A RELLENAR.
 * [] (vacío)  = modo semanal: procesa solo la semana pasada. ES EL MODO NORMAL.
 * [32,33,34]  = modo backfill: procesa esas semanas y NO la actual.
 *
 * Al terminar un backfill hay que volver a dejarlo en []. Si no, el script se
 * queda repitiendo semanas viejas para siempre. Pasó del 5 al 31 de agosto. */
var BACKFILL = [32, 33, 34, 35];

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var problemas = [];
  var enBackfill = !!(BACKFILL && BACKFILL.length);

  if (enBackfill) {
    Logger.log('=======================================================');
    Logger.log('MODO BACKFILL: solo se procesan las semanas ' + BACKFILL.join(', ') + '.');
    Logger.log('La semana actual NO se está escribiendo.');
    Logger.log('Cuando termines, deja  var BACKFILL = [];  para volver al modo semanal.');
    Logger.log('=======================================================');
  }

  var token = getMetaToken(problemas);
  var weeks = enBackfill ? BACKFILL : [ isoWeek(lastMonday()) ];

  weeks.forEach(function(w) {
    var mon = mondayOfIsoWeek(YEAR, w);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var since = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
    var until = Utilities.formatDate(sun, tz, 'yyyy-MM-dd');

    // ---- Google (nativo) ----
    var q = "SELECT metrics.cost_micros, metrics.clicks, metrics.impressions " +
            "FROM customer WHERE segments.date BETWEEN '" + since + "' AND '" + until + "'";
    var it = AdsApp.report(q).rows();
    var gCosto = 0, gClics = 0, gImp = 0, filas = 0;
    while (it.hasNext()) {
      var r = it.next();
      filas++;
      gCosto += Number(r['metrics.cost_micros']) / 1e6;
      gClics += Number(r['metrics.clicks']);
      gImp   += Number(r['metrics.impressions']);
    }
    gCosto = Math.round(gCosto * 100) / 100;

    // Cero filas no es lo mismo que cero gasto: suele significar que el script
    // corre en una cuenta sin campañas (cambio de MCC, campaña recreada en otra
    // cuenta). AdsApp devuelve lista vacía sin lanzar error, así que hay que
    // mirarlo a propósito.
    if (filas === 0) {
      problemas.push('S' + w + ': AdsApp devolvió 0 filas. ¿El script corre en la cuenta con las campañas?');
    }

    // ---- Meta (Graph API) ----
    var meta = token ? fetchMeta(since, until, token, w, problemas) : { spend: '', reach: '' };

    writeWeek(w, gCosto, gClics, gImp, meta.spend, meta.reach, until);
  });

  // Se avisa al final, con lo bueno ya escrito.
  if (problemas.length) {
    throw new Error('Pauta Google/Meta con ' + problemas.length + ' problema(s):\n· ' +
                    problemas.join('\n· '));
  }
  Logger.log('OK · ' + weeks.length + ' semana(s) escrita(s): ' + weeks.join(', ') +
             (enBackfill ? '  [RECUERDA vaciar BACKFILL]' : ''));
}

function fetchMeta(since, until, token, wk, problemas) {
  try {
    var url = 'https://graph.facebook.com/v19.0/' + META_ACCOUNT + '/insights' +
              '?level=account&fields=spend,reach' +
              '&time_range=' + encodeURIComponent(JSON.stringify({ since: since, until: until })) +
              '&access_token=' + encodeURIComponent(token);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      problemas.push('S' + wk + ' Meta: HTTP ' + res.getResponseCode() + ' · ' +
                     res.getContentText().slice(0, 150));
      return { spend:'', reach:'' };
    }
    var d = JSON.parse(res.getContentText());
    var row = (d.data && d.data[0]) || {};
    return {
      spend: row.spend ? Math.round(Number(row.spend) * 100) / 100 : 0,
      reach: row.reach ? Number(row.reach) : 0
    };
  } catch (e) {
    problemas.push('S' + wk + ' Meta: ' + e);
    return { spend:'', reach:'' };
  }
}

function getMetaToken(problemas) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  if (!sh) {
    problemas.push('No existe la pestaña "config" en la Sheet: Meta no se puede escribir. ' +
                   'El token va en config!A1.');
    return '';
  }
  var t = String(sh.getRange('A1').getValue() || '').trim();
  if (!t) {
    problemas.push('config!A1 está vacía: Meta no se puede escribir. ' +
                   'Copia el valor de META_CAPI_TOKEN (Propiedades del script de Marketing OS).');
  }
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
