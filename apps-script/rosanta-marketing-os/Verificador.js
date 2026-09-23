/**
 * ROSANTA MARKETING OS · VERIFICADOR DE CIRCUITOS
 * Archivo ADITIVO. No modifica Code.gs, CRMSync.gs ni ningun SCHEMA.
 * Todo lo de aqui lleva prefijo vc_ / vc para no chocar con el codigo existente.
 *
 * QUE VIGILA (los circuitos vivos del sistema):
 *   1. reservas  <- webhook hook=reserva  (Wix -> backend/crmReservas.js -> intakeReserva)
 *   2. carritos  <- webhook de carritos de WIX -> intakeCarrito -> Meta CAPI
 *      (SonTickets quedo fuera del sistema en agosto 2026)
 *   3. pauta_semanal <- Google Ads Script + Apps Script "WIX Reservas" (semanal, lunes)
 *   4. mesas sin cerrar  (agregado 23-sep-2026)
 *   5. la URL /exec que usan los consumidores externos  (agregado 23-sep-2026)
 *
 * COMO LO VIGILA: crecimiento de filas guardado en Script Properties.
 * La columna `fecha` de reservas es la fecha DE LA RESERVA, no la de creacion
 * (hay reservas de octubre cargadas en agosto), asi que medir por fecha mas
 * reciente daria verde con el circuito muerto. Por eso se mide por filas nuevas.
 *
 * POR QUE SE AGREGARON LOS CHEQUEOS 4 Y 5 (23-sep-2026): los tres primeros miden
 * que ENTREN datos, no que se COMPLETEN ni que SALGAN. Dos fallas reales vivieron
 * semanas con el verificador en verde y 0% de error:
 *   - 66 de 92 mesas pasadas quedaron en SEATED/RESERVED desde el 3-ago. La fila
 *     entra igual, asi que el conteo crecia. Pero pvEnviar solo manda el Purchase
 *     al CAPI cuando la mesa se cierra: ~Q69,000 de valor que Meta nunca vio.
 *   - La skill de pauta escribia a un deployment ARCHIVADO. Un deployment
 *     archivado no da error: contesta 200 con una pagina HTML de Drive, asi que
 *     el curl parecia exitoso y el aprendizaje del mes se perdia en silencio.
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

// --- Chequeo 4: mesas sin cerrar ---
// Una mesa recien pasada sin cerrar es normal (el cierre se hace despues del
// servicio, a veces al dia siguiente). Deuda es la que lleva dias abierta.
var VC_MESA_GRACIA = 3;    // dias de gracia antes de contarla como sin cerrar
var VC_MESA_TOPE   = 10;   // cuantas se toleran abiertas antes de avisar
var VC_ABIERTOS    = ['SEATED', 'RESERVED'];

// --- Chequeo 5: la URL /exec de los consumidores externos ---
// Esta es la MISMA URL que tienen configurada la skill de pauta y el snippet
// de WIX. Si algun dia se archiva el deployment y se publica otro, hay que
// actualizarla en los tres lugares; este chequeo avisa cuando pasa.
//
// NO usar ScriptApp.getService().getUrl() para esto: corrido desde el editor
// devuelve la URL /dev (la de @HEAD), y /dev SIEMPRE exige login, asi que
// contesta una pagina de accounts.google.com y el chequeo da falso positivo.
// Verificado el 23-sep-2026: fue exactamente lo que paso en la primera version.
var VC_EXEC_URL = 'https://script.google.com/macros/s/AKfycbzEv9C1gZ6-bODUyI2a5TPCtLVQGt5T-7gQs60TP8OYmDgymZTHQuv3hR-232cng7K3/exec';
var VC_URL_PROP = 'vc_exec_url';   // huerfana desde el 23-sep; se limpia sola

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

  var m = vcRevisarMesasSinCerrar(ss, ahora);
  if (m) fallas.push(m);

  var u = vcRevisarEndpoint(props);
  if (u) fallas.push(u);

  vcNotificar(fallas, props, ahora);
}

/**
 * Chequeo 4: mesas que ya pasaron y siguen abiertas.
 *
 * Cerrar la mesa es lo que dispara el Purchase al CAPI (ver ValorReserva.js):
 * sin cierre no hay gasto, y sin gasto Meta nunca sabe cuanto valio la reserva.
 *
 * OJO con la firma del correo: vcNotificar manda un mail por cada texto de falla
 * distinto, asi que un mensaje con el conteo exacto avisaria todos los dias al
 * cambiar de 66 a 67. Por eso el texto redondea a la decena y el numero fino va
 * solo en vcProbar() y en el resumen.
 */
function vcRevisarMesasSinCerrar(ss, ahora) {
  var sh = ss.getSheetByName('reservas');
  if (!sh) return null;                     // el chequeo 1 ya avisa si falta

  var n = sh.getLastRow() - 1;
  if (n < 1) return null;

  var datos = sh.getDataRange().getValues();
  var enc = datos[0];
  var iF = enc.indexOf('fecha'), iE = enc.indexOf('estado');
  if (iF < 0 || iE < 0) return 'reservas: no encuentro las columnas `fecha` y `estado`.';

  var corte = new Date(ahora.getTime() - VC_MESA_GRACIA * 86400000);
  var abiertas = 0, masVieja = null;

  for (var i = 1; i < datos.length; i++) {
    var d = datos[i][iF] instanceof Date ? datos[i][iF] : new Date(datos[i][iF]);
    if (isNaN(d) || d > corte) continue;                       // futura o dentro de la gracia
    var e = String(datos[i][iE] || '').trim().toUpperCase();
    if (VC_ABIERTOS.indexOf(e) < 0) continue;                  // cerrada o cancelada
    abiertas++;
    if (!masVieja || d < masVieja) masVieja = d;
  }

  if (abiertas <= VC_MESA_TOPE) return null;

  var banda = Math.floor(abiertas / 10) * 10;
  return 'Mesas sin cerrar: mas de ' + banda + ' reservas ya pasadas siguen en ' +
         VC_ABIERTOS.join(' o ') + ' (la mas vieja del ' +
         Utilities.formatDate(masVieja, 'America/Guatemala', 'yyyy-MM-dd') +
         '). Mientras no se cierren en Wix no se anota el gasto y no sale el ' +
         'Purchase al CAPI. Tope tolerado: ' + VC_MESA_TOPE + '.';
}

/**
 * Chequeo 5: que la URL /exec que usan los consumidores externos siga viva.
 *
 * Un deployment archivado devuelve una pagina HTML de Drive, y el codigo HTTP
 * varia segun como se lo llame (se han visto 200 y 404), asi que mirar el
 * codigo no alcanza: hay que exigir JSON. Un endpoint sano contesta JSON
 * incluso cuando la peticion esta mal, p.ej. {"error":"tab desconocida"}.
 * Probado el 23-sep-2026 contra las dos URLs reales, la viva y la archivada.
 */
function vcRevisarEndpoint(props) {
  if (props && props.getProperty(VC_URL_PROP)) props.deleteProperty(VC_URL_PROP);

  var cuerpo;
  try {
    cuerpo = UrlFetchApp.fetch(VC_EXEC_URL + '?token=' + encodeURIComponent(TOKEN) +
                               '&tab=reservas', { muteHttpExceptions: true })
                        .getContentText();
  } catch (err) {
    return 'Endpoint /exec: no responde (' + err + ').';
  }

  try { JSON.parse(cuerpo); } catch (err) {
    return 'Endpoint /exec: contesta algo que no es JSON. Si menciona accounts.google.com ' +
           'la URL apunta a /dev y no a /exec; si es una pagina de Drive, el deployment ' +
           'quedo archivado. En los dos casos la skill de pauta y el snippet de WIX estan ' +
           'escribiendo al vacio. Primeros 80 caracteres: ' +
           String(cuerpo).slice(0, 80).replace(/\s+/g, ' ');
  }

  return null;
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
  var ahora = new Date();
  out.push('pauta_semanal: ' + (vcRevisarPauta(ss, ahora) || 'al dia'));
  // Los mensajes de falla ya se explican solos, asi que aqui no se les antepone
  // etiqueta: hacerlo dejaba "mesas sin cerrar: Mesas sin cerrar: ..." en el log.
  out.push(vcRevisarMesasSinCerrar(ss, ahora) ||
           'mesas sin cerrar: bajo el tope de ' + VC_MESA_TOPE);
  out.push('  [detalle: ' + vcContarAbiertas(ss, ahora) + ']');
  out.push(vcRevisarEndpoint(props) || 'endpoint /exec: vivo y contestando JSON');
  // Logger.log y no console.log: un `return` no sale en el registro de ejecucion,
  // y en el editor nuevo `console.log` a secas tampoco se ve en el panel
  // "Execution log" (se va a Cloud Logging). Comprobado el 23-sep-2026: con los
  // dos la salida aparecia duplicada, y con solo console.log el panel quedaba en
  // "Execution completed" sin una linea. El unico que imprime ahi es Logger.
  Logger.log(out.join('\n'));
  return out.join('\n');
}

/** Conteo fino de mesas abiertas, para vcProbar. El aviso usa bandas, este no. */
function vcContarAbiertas(ss, ahora) {
  var sh = ss.getSheetByName('reservas');
  if (!sh || sh.getLastRow() < 2) return 'sin datos';
  var datos = sh.getDataRange().getValues();
  var enc = datos[0];
  var iF = enc.indexOf('fecha'), iE = enc.indexOf('estado');
  if (iF < 0 || iE < 0) return 'sin columnas';

  var corte = new Date(ahora.getTime() - VC_MESA_GRACIA * 86400000);
  var cuenta = {}, total = 0;
  for (var i = 1; i < datos.length; i++) {
    var d = datos[i][iF] instanceof Date ? datos[i][iF] : new Date(datos[i][iF]);
    if (isNaN(d) || d > corte) continue;
    var e = String(datos[i][iE] || '').trim().toUpperCase();
    if (VC_ABIERTOS.indexOf(e) < 0) continue;
    cuenta[e] = (cuenta[e] || 0) + 1;
    total++;
  }
  return total + ' abiertas · ' + Object.keys(cuenta).map(function (k) {
    return k + ' ' + cuenta[k];
  }).join(' · ');
}
