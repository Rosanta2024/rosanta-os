/**
 * ROSANTA MARKETING OS · VERIFICADOR DE CIRCUITOS
 * Archivo ADITIVO. No modifica Code.gs, CRMSync.gs ni ningun SCHEMA.
 * Todo lo de aqui lleva prefijo vc_ / vc para no chocar con el codigo existente.
 *
 * QUE VIGILA (los tres circuitos vivos del sistema):
 *   1. reservas  <- webhook hook=reserva  (Wix -> backend/crmReservas.js -> intakeReserva)
 *   2. carritos  <- webhook de carritos de WIX -> intakeCarrito -> Meta CAPI
 *      (SonTickets quedo fuera del sistema en agosto 2026)
 *   3. pauta_semanal <- Google Ads Script + Apps Script "WIX Reservas" (semanal, lunes)
 *
 * COMO LO VIGILA: crecimiento de filas guardado en Script Properties.
 * La columna `fecha` de reservas es la fecha DE LA RESERVA, no la de creacion
 * (hay reservas de octubre cargadas en agosto), asi que medir por fecha mas
 * reciente daria verde con el circuito muerto. Por eso se mide por filas nuevas.
 *
 * INSTALACION: correr vcInstalar() UNA vez. Crea el trigger diario 9am GT.
 * NO requiere nueva implementacion /exec: los triggers usan el codigo guardado.
 * NUNCA correr setup() de Code.gs: hace clear() de todas las pestanas.
 */

var VC_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var VC_EMAIL    = 'restaurante@rosanta.rest';

// maxDias = dias sin una sola fila nueva antes de dar la alarma.
// Calibrado con el historico real: carritos tuvo huecos naturales de 4 dias
// (16->20 ago, 30 ago->3 sep); reservas entra todos los dias.
var VC_CHECKS = [
  { tab: 'reservas', label: 'Reservas (Wix, hook=reserva)',     maxDias: 3 },
    { tab: 'carritos', label: 'Carritos (webhook de WIX)',  maxDias: 6 }
];

/** Punto de entrada del trigger diario. */
function vcVerificarCircuito() {
  var ss = SpreadsheetApp.openById(VC_SHEET_ID);
  var props = PropertiesService.getScriptProperties();
  var ahora = new Date();
  var fallas = [];

  VC_CHECKS.forEach(function (chk) {
    var sh = ss.getSheetByName(chk.tab);
    if (!sh) { fallas.push('La pestana `' + chk.tab + '` ya no existe en la Sheet.'); return; }

    var filas = Math.max(0, sh.getLastRow() - 1);
    var kFilas = 'vc_' + chk.tab + '_filas';
    var kVisto = 'vc_' + chk.tab + '_visto';
    var prev = parseInt(props.getProperty(kFilas), 10);
    var visto = props.getProperty(kVisto);

    if (isNaN(prev) || !visto) {           // primera corrida: fija la linea base
      props.setProperty(kFilas, String(filas));
      props.setProperty(kVisto, vcSemilla(sh, ahora).toISOString());
      return;
    }

    if (filas > prev) {                    // hubo movimiento: circuito sano
      props.setProperty(kFilas, String(filas));
      props.setProperty(kVisto, ahora.toISOString());
      return;
    }

    if (filas < prev) {                    // alguien borro filas: el accidente del 4-ago
      props.setProperty(kFilas, String(filas));
      fallas.push(chk.label + ': la pestana PERDIO filas (' + prev + ' -> ' + filas +
                  '). Revisar quien escribio sobre `' + chk.tab + '`.');
      return;
    }

    var dias = Math.floor((ahora - new Date(visto)) / 86400000);
    if (dias > chk.maxDias) {
      fallas.push(chk.label + ': ' + dias + ' dias sin una sola fila nueva (' +
                  filas + ' filas, tope ' + chk.maxDias + '). El webhook no esta entrando.');
    }
  });

  var p = vcRevisarPauta(ss, ahora);
  if (p) fallas.push(p);

  vcNotificar(fallas, props, ahora);
}

/** Linea base al instalar: la fecha real mas reciente que no sea futura. */
function vcSemilla(sh, ahora) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return ahora;
  var col = sh.getRange(2, 2, n, 1).getValues();   // columna B = fecha en ambas pestanas
  var max = null;
  for (var i = 0; i < col.length; i++) {
    var d = col[i][0] instanceof Date ? col[i][0] : new Date(col[i][0]);
    if (isNaN(d)) continue;
    if (d > ahora) continue;                        // ignora reservas a futuro
    if (!max || d > max) max = d;
  }
  return max || ahora;
}

/** La pauta semanal se escribe los lunes 7-8am. Desde el martes ya deberia estar. */
function vcRevisarPauta(ss, ahora) {
  var dow = ahora.getDay();                         // 0 dom, 1 lun
  if (dow === 0 || dow === 1) return null;          // aun no le toca

  var sh = ss.getSheetByName('pauta_semanal');
  if (!sh) return 'La pestana `pauta_semanal` ya no existe en la Sheet.';

  var objetivo = vcSemanaISO(new Date(ahora.getTime() - 7 * 86400000));
  var datos = sh.getDataRange().getValues();
  var enc = datos[0];
  var iWk = enc.indexOf('wk'), iG = enc.indexOf('gCosto'), iM = enc.indexOf('mCosto'), iR = enc.indexOf('reservas');
  if (iWk < 0) return 'pauta_semanal: no encuentro la columna `wk`.';

  for (var i = 1; i < datos.length; i++) {
    if (parseInt(datos[i][iWk], 10) !== objetivo) continue;
    var faltan = [];
    if (iG >= 0 && datos[i][iG] === '') faltan.push('Google (gCosto)');
    if (iM >= 0 && datos[i][iM] === '') faltan.push('Meta (mCosto)');
    if (iR >= 0 && datos[i][iR] === '') faltan.push('reservas');
    return faltan.length
      ? 'pauta_semanal S' + objetivo + ': la fila existe pero le falta ' + faltan.join(' y ') + '.'
      : null;
  }
  return 'pauta_semanal: la semana S' + objetivo + ' no se escribio. Revisar el Google Ads Script y el trigger de WIX Reservas.';
}

function vcSemanaISO(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

/** Correo solo cuando algo esta roto, una vez al dia, y uno al restablecerse. */
function vcNotificar(fallas, props, ahora) {
  var hoy = Utilities.formatDate(ahora, 'America/Guatemala', 'yyyy-MM-dd');
  var firma = fallas.join('|');
  var firmaPrev = props.getProperty('vc_firma') || '';
  var avisoPrev = props.getProperty('vc_aviso') || '';

  if (!fallas.length) {
    if (firmaPrev) {
      MailApp.sendEmail(VC_EMAIL, 'Marketing OS: circuitos restablecidos',
        'Los circuitos volvieron a moverse. Sin alertas activas.\n\n' + vcResumen());
      props.deleteProperty('vc_firma');
      props.deleteProperty('vc_aviso');
    }
    return;
  }

  if (firma === firmaPrev && avisoPrev === hoy) return;   // ya avise hoy por lo mismo

  MailApp.sendEmail(VC_EMAIL,
    'Marketing OS: ' + fallas.length + (fallas.length === 1 ? ' circuito caido' : ' circuitos caidos'),
    fallas.map(function (f, i) { return (i + 1) + '. ' + f; }).join('\n\n') +
    '\n\n---\n' + vcResumen() +
    '\n\nSheet: https://docs.google.com/spreadsheets/d/' + VC_SHEET_ID);

  props.setProperty('vc_firma', firma);
  props.setProperty('vc_aviso', hoy);
}

function vcResumen() {
  var ss = SpreadsheetApp.openById(VC_SHEET_ID);
  return VC_CHECKS.map(function (c) {
    var sh = ss.getSheetByName(c.tab);
    return c.tab + ': ' + (sh ? Math.max(0, sh.getLastRow() - 1) + ' filas' : 'pestana ausente');
  }).join(' · ');
}

/** Correr UNA vez a mano. Deja el trigger diario listo. */
function vcInstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'vcVerificarCircuito') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('vcVerificarCircuito').timeBased()
    .atHour(9).everyDays(1).inTimezone('America/Guatemala').create();
  vcVerificarCircuito();                    // fija la linea base con datos reales
  Logger.log('Verificador instalado. Linea base: ' + vcResumen());
}

/** Prueba manual: muestra el diagnostico sin depender del trigger. */
function vcProbar() {
  var ss = SpreadsheetApp.openById(VC_SHEET_ID);
  var props = PropertiesService.getScriptProperties();
  var out = [];
  VC_CHECKS.forEach(function (c) {
    var sh = ss.getSheetByName(c.tab);
    out.push(c.tab + ': ' + (sh ? sh.getLastRow() - 1 : '?') + ' filas · ultimo movimiento ' +
             (props.getProperty('vc_' + c.tab + '_visto') || 'sin linea base'));
  });
  out.push('pauta_semanal: ' + (vcRevisarPauta(ss, new Date()) || 'al dia'));
  Logger.log(out.join('\n'));
  return out.join('\n');
}
