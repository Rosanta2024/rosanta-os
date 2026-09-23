/**
 * ROSANTA MARKETING OS · CLIENTES NUEVOS Y CAC
 * Archivo ADITIVO. Vive en el proyecto Rosanta Marketing OS.
 * Prefijo cn en todo para no chocar con el scope global compartido de Apps Script.
 *
 * QUE HACE: llena la columna `clientes_nuevos` de la pestana pauta_semanal.
 * Escribe UNA sola columna, celda por celda. Jamas toca `comensalesReserva`
 * (esa la escribe el script de WIX Reservas) ni ninguna otra columna.
 *
 * POR QUE NO VIVE EN EL SCRIPT DE WIX RESERVAS: para no tocar un archivo que ya
 * funciona. Lee la pestana `reservas` de esta misma Sheet, que el webhook llena
 * desde el 3-ago-2026, asi que no necesita la API de Wix ni credenciales nuevas.
 *
 * DEFINICION DE CLIENTE NUEVO: una reserva de la semana cuyo contacto (email o
 * telefono) no aparece antes en la CRM Maestra ni en una semana anterior de la
 * ventana. La base historica es la CRM (GHL + SonTickets + Wix, desde 2025),
 * NO solo Wix: Wix arranca a finales de julio 2026 y contra esa historia corta
 * casi todos saldrian "nuevos" y el CAC saldria falsamente barato.
 * Las reservas CANCELED no cuentan como cliente adquirido.
 *
 * USO: cnBackfill() una vez para las semanas historicas.
 *      cnInstalar() deja el trigger de los lunes 9:30am, despues de que los
 *      scripts semanales (7-8am) escriben la fila de la semana.
 */

var CN_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var CN_CRM_ID   = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';   // Rosanta_CRM_Maestra
var CN_ESTADOS_FUERA = ['CANCELED'];

/** Rellena todas las semanas que la pestana `reservas` alcanza a cubrir. */
function cnBackfill() { return cnCorrer(null); }

/** Trigger de los lunes: solo la semana que acaba de cerrar. */
function cnSemanal() {
  var d = new Date(); d.setDate(d.getDate() - 7);
  return cnCorrer(cnSemanaISO(d));
}

function cnCorrer(soloSemana) {
  var ss = SpreadsheetApp.openById(CN_SHEET_ID);
  var res = cnLeerReservas(ss);
  if (!res.length) { Logger.log('La pestana reservas esta vacia. Nada que calcular.'); return; }

  var historia = cnHistoriaCRM();
  var porSemana = {}, anioDe = {};           // wk -> reservas de esa semana
  res.forEach(function (r) {
    var wk = cnSemanaISO(r.fecha);
    (porSemana[wk] = porSemana[wk] || []).push(r);
    anioDe[wk] = r.fecha.getFullYear();
  });

  // Solo semanas CERRADAS. La semana en curso daria un numero parcial, y las
  // reservas hechas para fechas futuras caen en semanas que aun no existen.
  var hoy = new Date(), wkHoy = cnSemanaISO(hoy), anioHoy = hoy.getFullYear();
  var cerrada = function (wk) {
    return anioDe[wk] < anioHoy || (anioDe[wk] === anioHoy && wk < wkHoy);
  };

  var semanas = Object.keys(porSemana).map(Number).sort(function (a, b) { return a - b; });
  var vistos = {};                          // contactos ya contados en semanas anteriores
  var resultado = [];

  semanas.forEach(function (wk) {
    var nuevos = {}, repetidos = 0, descartados = 0;
    porSemana[wk].forEach(function (r) {
      if (CN_ESTADOS_FUERA.indexOf(String(r.estado).toUpperCase()) >= 0) { descartados++; return; }
      var claves = cnClaves(r);
      if (!claves.length) { descartados++; return; }
      var conocido = claves.some(function (k) {
        return vistos[k] || (historia[k] && historia[k] < cnInicioSemana(r.fecha));
      });
      if (conocido) { repetidos++; return; }
      nuevos[claves[0]] = true;
      claves.forEach(function (k) { vistos[k] = true; });
    });
    resultado.push({ wk: wk, nuevos: Object.keys(nuevos).length, repetidos: repetidos,
                     fuera: descartados, cerrada: cerrada(wk) });
  });

  var escritas = cnEscribir(ss, resultado, soloSemana);
  var log = resultado.map(function (x) {
    return 'S' + x.wk + ': ' + x.nuevos + ' nuevos · ' + x.repetidos + ' ya conocidos · ' +
           x.fuera + ' fuera (cancelada o sin contacto)' + (x.cerrada ? '' : '  [semana abierta, no se escribe]');
  }).join('\n');
  Logger.log('Contactos historicos en la CRM: ' + Object.keys(historia).length +
             '\n' + log + '\nCeldas escritas: ' + escritas);
  return log;
}

/** Lee la pestana reservas: fecha, email, telefono, estado. */
function cnLeerReservas(ss) {
  var sh = ss.getSheetByName('reservas');
  if (!sh || sh.getLastRow() < 2) return [];
  var datos = sh.getDataRange().getValues();
  var e = datos[0];
  var iF = e.indexOf('fecha'), iE = e.indexOf('email'), iT = e.indexOf('telefono'), iS = e.indexOf('estado');
  if (iF < 0) throw new Error('La pestana reservas no tiene columna `fecha`.');
  var out = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i][iF] instanceof Date ? datos[i][iF] : new Date(datos[i][iF]);
    if (isNaN(f)) continue;
    out.push({ fecha: f, email: iE >= 0 ? datos[i][iE] : '', tel: iT >= 0 ? datos[i][iT] : '', estado: iS >= 0 ? datos[i][iS] : '' });
  }
  return out;
}

/** Base historica: clave de contacto -> fecha en que Rosanta lo vio por primera vez. */
function cnHistoriaCRM() {
  var h = {};
  var sh;
  try { sh = SpreadsheetApp.openById(CN_CRM_ID).getSheets()[0]; }
  catch (err) { Logger.log('AVISO: no pude abrir la CRM Maestra (' + err + '). Sigo solo con la pestana reservas.'); return h; }

  var datos = sh.getDataRange().getValues();
  var e = datos[0];
  var iE = e.indexOf('email'), iT = e.indexOf('telefono'),
      iA = e.indexOf('fecha_alta'), iU = e.indexOf('ultima_reserva');
  for (var i = 1; i < datos.length; i++) {
    var fechas = [iA, iU].map(function (c) {
      if (c < 0) return null;
      var v = datos[i][c]; if (!v) return null;
      var d = v instanceof Date ? v : new Date(v);
      return isNaN(d) ? null : d;
    }).filter(String);
    if (!fechas.length) continue;
    var primera = fechas.reduce(function (a, b) { return a < b ? a : b; });
    cnClaves({ email: iE >= 0 ? datos[i][iE] : '', tel: iT >= 0 ? datos[i][iT] : '' }).forEach(function (k) {
      if (!h[k] || primera < h[k]) h[k] = primera;
    });
  }
  return h;
}

/** Un contacto puede matchear por email o por telefono. Telefono: ultimos 8 digitos. */
function cnClaves(r) {
  var k = [];
  var em = String(r.email || '').trim().toLowerCase();
  if (em && em.indexOf('@') > 0) k.push('e:' + em);
  var tel = String(r.tel || '').replace(/\D/g, '');
  if (tel.length >= 8) k.push('t:' + tel.slice(-8));
  return k;
}

function cnInicioSemana(d) {
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dn = t.getDay() || 7;
  t.setDate(t.getDate() - dn + 1);
  return t;
}

function cnSemanaISO(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

/**
 * Escribe SOLO dos columnas, celda por celda: clientes_nuevos y repetidos.
 * `repetidos` se agrega AL FINAL de la fila de encabezados si no existe.
 * Nunca inserta columnas en medio ni reescribe filas completas: los scripts
 * semanales (Google Ads y WIX Reservas) siguen escribiendo lo suyo sin enterarse.
 */
function cnEscribir(ss, resultado, soloSemana) {
  var sh = ss.getSheetByName('pauta_semanal');
  if (!sh) throw new Error('No existe la pestana pauta_semanal.');
  var e = sh.getDataRange().getValues()[0];
  var iWk = e.indexOf('wk'), iCn = e.indexOf('clientes_nuevos'), iRp = e.indexOf('repetidos');
  if (iWk < 0 || iCn < 0) throw new Error('pauta_semanal: falta la columna wk o clientes_nuevos.');

  if (iRp < 0) {                              // la creamos una sola vez, al final
    iRp = e.length;
    sh.getRange(1, iRp + 1).setValue('repetidos');
    Logger.log('Columna `repetidos` agregada al final de pauta_semanal.');
  }

  var datos = sh.getDataRange().getValues();
  var n = 0;
  resultado.forEach(function (x) {
    if (!x.cerrada) return;
    if (soloSemana && x.wk !== soloSemana) return;
    for (var i = 1; i < datos.length; i++) {
      if (parseInt(datos[i][iWk], 10) !== x.wk) continue;
      sh.getRange(i + 1, iCn + 1).setValue(x.nuevos);
      sh.getRange(i + 1, iRp + 1).setValue(x.repetidos);
      n++;
      break;
    }
  });
  return n;
}

function cnInstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cnSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cnSemanal').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).nearMinute(30)
    .inTimezone('America/Guatemala').create();
  Logger.log('Trigger semanal instalado: lunes 9:30am GT.');
}

/** Diagnostico: no escribe nada, solo muestra el calculo. */
function cnProbar() {
  var ss = SpreadsheetApp.openById(CN_SHEET_ID);
  var res = cnLeerReservas(ss);
  Logger.log('reservas: ' + res.length + ' filas leidas · CRM: ' + Object.keys(cnHistoriaCRM()).length + ' claves de contacto');
  return cnCorrer(-1);        // -1 no coincide con ninguna semana: calcula y no escribe
}
