/**
 * ROSANTA MARKETING OS · VALOR REAL DE RESERVA -> META CAPI (Purchase)
 * Archivo ADITIVO en el proyecto Rosanta Marketing OS. Prefijo pv en todo.
 *
 * QUE HACE: por cada reserva ya consumida con gasto real (columna `gasto` > 0
 * de la pestana `reservas`), manda un evento Purchase al dataset con el VALOR
 * y la moneda. Eso convierte el ROAS del panel de estimado a exacto.
 *
 * QUE NO TOCA:
 *  - El SCHEMA de `reservas` queda intacto: NO agrega columnas ahi.
 *    El registro de lo ya enviado vive en una pestana nueva `capi_log`.
 *  - No toca el envio de AddToCart de los carritos que ya vive en Code.gs.
 *
 * ANTES DE ACTIVARLO:
 *  1. PV_DRY_RUN = true muestra los payloads en el log sin mandar nada.
 *  2. PV_TEST_CODE con un codigo de Test Events deja verlos en el Administrador
 *     de eventos sin que entren a atribucion. Vaciarlo para produccion.
 *  3. PV_API_VER debe coincidir con la version que ya usa Code.gs para los
 *     carritos. Si no coincide, igualarla.
 *
 * USO: pvProbar() para ver que saldria · pvEnviar() manda · pvInstalar() deja
 *      el trigger diario 10am GT (el gasto se conoce despues de la visita).
 */

var PV_SHEET_ID  = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var PV_DATASET   = '1107259034759950';        // dataset "Rosanta Reservas"
var PV_API_VER   = 'v26.0';
var PV_MONEDA    = 'GTQ';
var PV_DRY_RUN   = false;                      // ponerlo en false cuando el log se vea bien
var PV_TEST_CODE = '';                        // p.ej. 'TEST12345' mientras se valida
var PV_MAX_POR_CORRIDA = 25;
var PV_DIAS_LIMITE = 7;                       // CAPI rechaza eventos de mas de 7 dias

// Contactos internos: reservas cargadas por el equipo bajo el correo o el
// telefono del restaurante. Mandarlas ensucia el match y la atribucion.
var PV_INTERNOS = ['restaurante@rosanta.rest', 'juanma.lemus@gmail.com'];
var PV_TEL_INTERNOS = ['30795252'];           // ultimos 8 digitos
var PV_NOMBRE_FUERA = ['PRUEBA', 'CIRCUITO', 'VERIFICACION'];

function pvProbar() { return pvCorrer(true); }
function pvEnviar() { return pvCorrer(PV_DRY_RUN); }

function pvCorrer(simulacro) {
  var ss = SpreadsheetApp.openById(PV_SHEET_ID);
  var token = PropertiesService.getScriptProperties().getProperty('META_CAPI_TOKEN');
  if (!token && !simulacro) {
    Logger.log('Falta la Script Property META_CAPI_TOKEN. Nada enviado.');
    return 'sin token';
  }

  var enviados = pvYaEnviados(ss);
  var candidatos = pvCandidatos(ss, enviados);
  if (!candidatos.length) { Logger.log('Sin reservas nuevas con gasto por enviar.'); return 'nada pendiente'; }

  var log = [], ok = 0;
  candidatos.slice(0, PV_MAX_POR_CORRIDA).forEach(function (r) {
    var payload = pvPayload(r);
    if (simulacro) {
      log.push('[simulacro] ' + r.id.slice(0, 8) + ' · Q' + r.gasto + ' · ' +
               Utilities.formatDate(r.fecha, 'America/Guatemala', 'yyyy-MM-dd') +
               ' · em' + (payload.data[0].user_data.em ? '✓' : '✗') +
               ' ph' + (payload.data[0].user_data.ph ? '✓' : '✗'));
      return;
    }
    var resp = pvPost(payload, token);
    log.push(r.id.slice(0, 8) + ' · Q' + r.gasto + ' · ' + resp.resumen);
        if (resp.ok) { if (!PV_TEST_CODE) pvMarcar(ss, r, resp.resumen); ok++; }
  });

  var pendientes = candidatos.length - Math.min(candidatos.length, PV_MAX_POR_CORRIDA);
  Logger.log((simulacro ? 'SIMULACRO (no se envio nada)\n' : '') +
             candidatos.length + ' candidatas · ' + ok + ' enviadas' +
             (pendientes ? ' · ' + pendientes + ' quedan para la proxima corrida' : '') +
             '\n' + log.join('\n'));
  return log.join('\n');
}

/** Reservas con gasto real, con contacto util, dentro de la ventana de 7 dias. */
function pvCandidatos(ss, enviados) {
  var sh = ss.getSheetByName('reservas');
  if (!sh || sh.getLastRow() < 2) return [];
  var datos = sh.getDataRange().getValues();
  var e = datos[0];
  var iId = e.indexOf('id'), iF = e.indexOf('fecha'), iN = e.indexOf('nombre'),
      iE = e.indexOf('email'), iT = e.indexOf('telefono'),
      iP = e.indexOf('personas'), iG = e.indexOf('gasto'), iS = e.indexOf('estado');
  if (iId < 0 || iG < 0) throw new Error('La pestana reservas no tiene columna id o gasto.');

  var hoy = new Date(), out = [];
  for (var i = 1; i < datos.length; i++) {
    var id = String(datos[i][iId] || '').trim();
    if (!id || enviados[id]) continue;

    var gasto = Number(datos[i][iG]);
    if (!(gasto > 0)) continue;                                  // aun sin consumo real

    var f = datos[i][iF] instanceof Date ? datos[i][iF] : new Date(datos[i][iF]);
    if (isNaN(f)) continue;
    if ((hoy - f) / 86400000 > PV_DIAS_LIMITE) continue;          // CAPI ya no la acepta
    if (f > hoy) continue;                                        // reserva a futuro

    var email = String(datos[i][iE] || '').trim().toLowerCase();
    var tel = String(datos[i][iT] || '').replace(/\D/g, '');
    var nombre = String(datos[i][iN] || '').toUpperCase();

    if (PV_INTERNOS.indexOf(email) >= 0) continue;
    if (tel && PV_TEL_INTERNOS.indexOf(tel.slice(-8)) >= 0) continue;
    if (PV_NOMBRE_FUERA.some(function (p) { return nombre.indexOf(p) >= 0; })) continue;
    if (!email && tel.length < 8) continue;                       // sin llave de match no sirve

    out.push({ id: id, fecha: f, email: email, tel: tel, gasto: gasto,
               personas: Number(datos[i][iP]) || 1, estado: String(datos[i][iS] || '') });
  }
  return out;
}

function pvPayload(r) {
  var ud = {};
  if (r.email) ud.em = [pvHash(r.email)];
  if (r.tel.length >= 8) ud.ph = [pvHash(r.tel)];

  var ev = {
    event_name: 'Purchase',
    event_time: Math.floor(r.fecha.getTime() / 1000),
    event_id: 'reserva_' + r.id,          // dedup: reenviar no duplica
    action_source: 'physical_store',      // la comida ocurre en el restaurante
    user_data: ud,
    custom_data: { value: r.gasto, currency: PV_MONEDA, num_items: r.personas }
  };
  var p = { data: [ev] };
  if (PV_TEST_CODE) p.test_event_code = PV_TEST_CODE;
  return p;
}

function pvPost(payload, token) {
  var url = 'https://graph.facebook.com/' + PV_API_VER + '/' + PV_DATASET +
            '/events?access_token=' + encodeURIComponent(token);
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() === 200 && body.events_received >= 1) {
      return { ok: true, resumen: 'recibido (' + body.events_received + ')' };
    }
    return { ok: false, resumen: 'ERROR ' + res.getResponseCode() + ': ' +
             ((body.error && body.error.message) || res.getContentText()).slice(0, 180) };
  } catch (err) {
    return { ok: false, resumen: 'EXCEPCION: ' + err };
  }
}

function pvHash(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s).trim().toLowerCase())
    .map(function (b) { return ((b < 0 ? b + 256 : b) + 0x100).toString(16).slice(1); }).join('');
}

/** El registro de enviados vive en su propia pestana: `reservas` no se toca. */
function pvHojaLog(ss) {
  var sh = ss.getSheetByName('capi_log');
  if (!sh) {
    sh = ss.insertSheet('capi_log');
    sh.appendRow(['reserva_id', 'enviado', 'valor', 'moneda', 'respuesta']);
  }
  return sh;
}

function pvYaEnviados(ss) {
  var sh = pvHojaLog(ss), m = {};
  if (sh.getLastRow() < 2) return m;
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .forEach(function (f) { if (f[0]) m[String(f[0]).trim()] = true; });
  return m;
}

function pvMarcar(ss, r, resumen) {
  pvHojaLog(ss).appendRow([r.id, new Date(), r.gasto, PV_MONEDA, resumen]);
}

function pvInstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pvEnviar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pvEnviar').timeBased()
    .atHour(10).everyDays(1).inTimezone('America/Guatemala').create();
  Logger.log('Trigger diario instalado: 10am GT. Recorda poner PV_DRY_RUN en false.');
}