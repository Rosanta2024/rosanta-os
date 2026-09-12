/**
 * ROSANTA · Google Ads Script → Sheet "Rosanta Marketing OS" (pestaña pauta_semanal)
 * v4 — 31-ago-2026.
 * ------------------------------------------------------------------------------
 * NO VIVE EN APPS SCRIPT. Corre dentro de Google Ads:
 *   Google Ads → Herramientas y configuración → Acciones masivas → Scripts
 *
 * Esta copia vive en _google-ads-scripts/ y NO en la carpeta de ningún proyecto
 * clasp, a propósito: si estuviera dentro de rosanta-marketing-os, el próximo
 * `clasp push` lo subiría al proyecto de Apps Script, donde AdsApp no existe.
 *
 * Cada semana escribe, por número de semana ISO:
 *   - Google (nativo AdsApp): gCosto, gClics, gImp
 *   - Meta (Graph API vía UrlFetch): mCosto, mAlcance
 *
 * TOKEN DE META: pestaña `config` de la Sheet, celda A1. Los Google Ads Scripts
 * NO tienen PropertiesService, así que una celda es la única alternativa a
 * hardcodearlo. Consecuencia que hay que asumir: cualquiera con permiso de
 * LECTURA sobre la Sheet lo ve. Mitigación real = restringir el acceso a la
 * Sheet y rotar el token periódicamente, no buscar dónde esconderlo.
 *
 * ------------------------------------------------------------------------------
 * CAMBIO v4 — el importante:
 *
 * BACKFILL AHORA ES ADITIVO. Antes era excluyente: si tenía semanas, la actual
 * NO se escribía. Eso es lo que congeló gCosto en la S31 durante cuatro semanas,
 * del 5 al 31 de agosto, sin que nadie lo notara.
 *
 * El fallo real no fue olvidar vaciar BACKFILL. Fue que olvidarlo tuviera
 * consecuencias silenciosas. Ahora la semana pasada se procesa SIEMPRE, y el
 * backfill solo agrega semanas extra. Si alguien vuelve a dejarlo lleno seis
 * meses, lo único que pasa es que el script trabaja de más.
 *
 * La v3 resolvía esto avisando en el log. Un aviso en un log que nadie abre no
 * es una defensa: es documentación del fallo mientras ocurre.
 *
 * Resto de la v3 que se conserva:
 *  - Falla fuerte al final: los errores se acumulan y se lanza excepción DESPUÉS
 *    de escribir lo que sí salió, para que Google Ads mande su aviso.
 *  - Token ausente = fallo, no omisión silenciosa.
 *  - 0 filas de AdsApp se reporta como problema: cero filas no es cero gasto.
 *
 * ------------------------------------------------------------------------------
 * HORARIO — leer antes de programarlo:
 *
 * Tres procesos escriben `pauta_semanal` y ninguno puede usar LockService
 * (no existe en Google Ads Scripts). Los tres hacen appendRow si la fila de la
 * semana no existe todavía, así que si dos coinciden con la fila aún sin crear,
 * nacen filas duplicadas. Se evita por horario, no por código:
 *
 *   · posActualizarPauta      (Apps Script) → lunes 5-6am
 *   · WixReservasPauta        (Apps Script) → lunes 7-8am
 *   · ESTE script             (Google Ads)  → lunes 10-11am
 *
 * Google Ads Scripts solo permite elegir hora, no minuto exacto, así que dejar
 * al menos dos horas de margen entre cada uno.
 *
 * INSTALAR: Google Ads → Herramientas → Acciones masivas → Scripts → (+) →
 *   pega esto → Autorizar (con restaurante@rosanta.rest) → Ejecutar.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TAB      = 'pauta_semanal';
var META_ACCOUNT = 'act_780001897477414';   // Rosanta rosanta.rest
var YEAR = 2026;

/* SEMANAS EXTRA A RELLENAR (además de la semana pasada, que va siempre).
 *
 * []            = modo normal. Solo la semana pasada.
 * [32,33,34,35] = además de la semana pasada, recalcula esas cuatro.
 *
 * Dejarlo lleno ya NO rompe nada: la semana actual se escribe igual. Vaciarlo
 * cuando termines el backfill es higiene, no urgencia. */
var BACKFILL = [32, 33, 34, 35];

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var problemas = [];

  // La semana pasada SIEMPRE entra. El backfill solo suma.
  var semanaPasada = isoWeek(lastMonday());
  var weeks = [semanaPasada];

  (BACKFILL || []).forEach(function (w) {
    if (weeks.indexOf(w) === -1) weeks.push(w);
  });
  weeks.sort(function (a, b) { return a - b; });

  if (BACKFILL && BACKFILL.length) {
    Logger.log('Backfill activo: ademas de la S' + semanaPasada + ' se recalculan ' +
               BACKFILL.join(', ') + '. Vacia BACKFILL cuando ya no haga falta.');
  }

  var token = getMetaToken(problemas);

  weeks.forEach(function (w) {
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
      problemas.push('S' + w + ': AdsApp devolvio 0 filas. Es el script corriendo en la cuenta con las campanas?');
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
  Logger.log('OK · ' + weeks.length + ' semana(s) escrita(s): ' + weeks.join(', '));
}

function fetchMeta(since, until, token, wk, problemas) {
  try {
    var url = 'https://graph.facebook.com/v19.0/' + META_ACCOUNT + '/insights' +
              '?level=account&fields=spend,reach' +
              '&time_range=' + encodeURIComponent(JSON.stringify({ since: since, until: until })) +
              '&access_token=' + encodeURIComponent(token);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      // El cuerpo del error de Graph NO se registra completo a propósito: puede
      // venir con el token reflejado y el log de Google Ads es legible por
      // cualquiera con acceso a la cuenta.
      var cuerpo = res.getContentText();
      var msg = '';
      try { msg = (JSON.parse(cuerpo).error || {}).message || ''; } catch (e) { msg = ''; }
      problemas.push('S' + wk + ' Meta: HTTP ' + res.getResponseCode() +
                     (msg ? ' · ' + msg.slice(0, 120) : ''));
      return { spend: '', reach: '' };
    }
    var d = JSON.parse(res.getContentText());
    var row = (d.data && d.data[0]) || {};
    return {
      spend: row.spend ? Math.round(Number(row.spend) * 100) / 100 : 0,
      reach: row.reach ? Number(row.reach) : 0
    };
  } catch (e) {
    problemas.push('S' + wk + ' Meta: ' + e);
    return { spend: '', reach: '' };
  }
}

function getMetaToken(problemas) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  if (!sh) {
    problemas.push('No existe la pestana "config" en la Sheet: Meta no se puede escribir. ' +
                   'El token va en config!A1.');
    return '';
  }
  var t = String(sh.getRange('A1').getValue() || '').trim();
  if (!t) {
    problemas.push('config!A1 esta vacia: Meta no se puede escribir. ' +
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

  // Si la cabecera cambia de nombre, mejor fallar que escribir en la columna
  // equivocada: col['gCosto'] indefinido haría setValue en la columna 0.
  ['wk','gCosto','gClics','gImp'].forEach(function (c) {
    if (col[c] === undefined) {
      throw new Error('La pestana ' + TAB + ' no tiene la columna "' + c + '". ' +
                      'Revisa la cabecera antes de volver a correr.');
    }
  });

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
  if (mCosto   !== '' && col['mCosto']   !== undefined) sh.getRange(rowIdx, col['mCosto']   + 1).setValue(mCosto);
  if (mAlcance !== '' && col['mAlcance'] !== undefined) sh.getRange(rowIdx, col['mAlcance'] + 1).setValue(mAlcance);
  if (col['fecha_registro'] !== undefined) sh.getRange(rowIdx, col['fecha_registro'] + 1).setValue(fecha);

  Logger.log('S' + wk + '  Google Q' + gCosto + ' · ' + gClics + ' clics · ' + gImp + ' impr   |   Meta Q' + mCosto + ' · alcance ' + mAlcance + '   (fila ' + rowIdx + ')');
}
