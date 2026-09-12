/**
 * Latido.gs — El sistema avisa cuando se queda callado.
 *
 * QUE RESUELVE
 * La auditoría del 31-ago-2026 encontró cuatro fallos, y los cuatro llevaban
 * semanas corriendo sin que nadie se enterara:
 *   · posActualizarPauta leía una carpeta vacía y salía con un Logger.log. Cuatro
 *     semanas de pauta_semanal sin comensales ni ticket.
 *   · Los webhooks de Wix dejaron de entrar el 6-7 de agosto. 25 días.
 *   · El panel de reseñas publicó en Google el razonamiento del modelo. Tres días.
 *   · La S31 tenía un número mal, calculado sobre un mes incompleto.
 * Ninguno lo detectó el sistema. Se encontraron porque alguien se puso a mirar.
 * El agujero es de atención, no de capacidad: esto lo mira solo.
 *
 * COMO AVISA
 * Lanzando excepción, a propósito. Apps Script manda el correo de "activador
 * fallido" al dueño del proyecto sin necesidad de ningún scope: MailApp exigiría
 * script.send_mail, y cambiar los scopes obliga a reautorizar un proyecto que
 * tiene un web app publicado (misma razón por la que SemaforoPrecios no usa correo).
 *
 * No escribe en ninguna hoja. No lee nada de la intranet. Solo mira fechas.
 * Si algo falla al leer, eso también se reporta: no se traga ningún error.
 *
 * COMO SE PROGRAMA
 *   Por código NO se puede: ScriptApp.newTrigger() necesita el scope
 *   script.scriptapp, que el manifiesto tampoco declara. Se agrega a mano:
 *     Editor > Activadores (el reloj, a la izquierda) > Añadir activador
 *     Función: latido
 *     Origen:  Basado en el tiempo > Temporizador semanal > lunes, 8-9am
 *   Lunes por la mañana es a propósito: la pauta de la semana anterior ya debería
 *   estar escrita, y si no lo está, este es el momento de saberlo.
 *
 * SOBRE LOS UMBRALES
 *   Un monitor ruidoso se ignora, y un monitor ignorado no existe. Por eso los
 *   umbrales son holgados: buscan "esto lleva semanas muerto", no "hoy hubo poco
 *   movimiento". Si empieza a avisar por temporada baja, subir DIAS_, no apagarlo.
 */

var LATIDO = {
  MKT_SHEET_ID:     '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc', // Rosanta Marketing OS
  RESENAS_SHEET_ID: '17VHTRhelYtEKXjkf4dckPRrAwjif8owu22OLMxBl9bo', // Control de Reseñas GBP

  DIAS_CARRITOS: 10,   // los carritos son esporádicos; 10 días es "muerto", no "flojo"
  DIAS_RESERVAS: 10,
  DIAS_RESENAS:  14    // hay semanas sin reseñas nuevas y es normal
};

function latido() {
  var frios = [];
  var vivos = [];

  revisar_(frios, vivos, 'carritos', function () {
    var d = latUltimaFecha_(LATIDO.MKT_SHEET_ID, 'carritos', 'fecha', false);
    if (!d) return 'la pestaña carritos no tiene ni una fila con fecha';
    var dias = latDiasDesde_(d);
    return dias > LATIDO.DIAS_CARRITOS
      ? 'sin carritos nuevos desde ' + latTxt_(d) + ' (' + dias + ' días). El webhook de Wix no está entrando.'
      : null;
  });

  // Ojo: en reservas la columna fecha es la fecha DE LA RESERVA, no la de llegada,
  // y puede ser futura. Por eso se ignoran las futuras: una reserva para el mes que
  // viene haría parecer viva una pestaña que lleva semanas sin recibir nada.
  revisar_(frios, vivos, 'reservas', function () {
    var d = latUltimaFecha_(LATIDO.MKT_SHEET_ID, 'reservas', 'fecha', true);
    if (!d) return 'la pestaña reservas no tiene ni una fila con fecha pasada';
    var dias = latDiasDesde_(d);
    return dias > LATIDO.DIAS_RESERVAS
      ? 'sin reservas nuevas desde ' + latTxt_(d) + ' (' + dias + ' días). El webhook de Wix no está entrando.'
      : null;
  });

  // Se acepta como buena CUALQUIERA de las dos últimas semanas, no la última a
  // secas. Motivo medido: el ReporteVentas se sube el lunes a media mañana o por
  // la tarde (S34 a las 10:27, S35 a las 16:22), y los trabajos corren el martes
  // temprano. Exigir la última semana haría saltar el aviso cada semana, y un
  // monitor que avisa en falso se ignora.
  //
  // Son dos señales y no una porque las escriben trabajos distintos: comensales y
  // ticket los pone posActualizarPauta (POS), y reservas las pone
  // reservasSemanaPasada (API de Wix). Uno puede morir sin el otro.
  revisar_(frios, vivos, 'pauta · POS', function () {
    return latPauta_(['comensales', 'ticket'], 'posActualizarPauta no escribió');
  });

  revisar_(frios, vivos, 'pauta · reservas', function () {
    return latPauta_(['reservas', 'comensalesReserva'], 'reservasSemanaPasada no escribió');
  });

  revisar_(frios, vivos, 'reseñas', function () {
    var d = latUltimaFecha_(LATIDO.RESENAS_SHEET_ID, 'Reseñas', 'Fecha detectada', false);
    if (!d) return 'la hoja de reseñas no tiene ni una fila con fecha';
    var dias = latDiasDesde_(d);
    return dias > LATIDO.DIAS_RESENAS
      ? 'sin reseñas procesadas desde ' + latTxt_(d) + ' (' + dias + ' días). El panel puede estar caído.'
      : null;
  });

  Logger.log('Latido · al día: ' + (vivos.join(', ') || 'ninguno'));

  if (frios.length) {
    throw new Error('LATIDO ROSANTA · ' + frios.length + ' de 5 señales frías:\n· ' +
                    frios.join('\n· ') +
                    '\nAl día: ' + (vivos.join(', ') || 'ninguno') + '.');
  }
}

/**
 * ¿Alguna de las dos últimas semanas ISO tiene llenas todas esas columnas de
 * pauta_semanal? Devuelve null si sí, o el texto del problema si no.
 */
function latPauta_(columnas, culpable) {
  var sh = SpreadsheetApp.openById(LATIDO.MKT_SHEET_ID).getSheetByName('pauta_semanal');
  if (!sh) return 'no existe la pestaña pauta_semanal';

  var datos = sh.getDataRange().getValues();
  var col = {};
  datos[0].forEach(function (h, i) { col[String(h).trim()] = i; });
  if (col.wk === undefined) return 'pauta_semanal no tiene columna wk';
  for (var k = 0; k < columnas.length; k++) {
    if (col[columnas[k]] === undefined) return 'pauta_semanal no tiene la columna ' + columnas[k];
  }

  var semanas = [latSemanaHace_(7), latSemanaHace_(14)];
  var ok = false;
  semanas.forEach(function (wk) {
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][col.wk]) !== String(wk)) continue;
      var completa = columnas.every(function (c) { return datos[i][col[c]] !== ''; });
      if (completa) ok = true;
      return;
    }
  });

  return ok ? null
            : 'ni la S' + semanas[0] + ' ni la S' + semanas[1] + ' tienen ' +
              columnas.join(' y ') + '. ' + culpable + ' en dos semanas.';
}

/** Corre una comprobación. Si revienta, el error es un hallazgo más, no un corte. */
function revisar_(frios, vivos, nombre, fn) {
  try {
    var problema = fn();
    if (problema) frios.push(nombre + ': ' + problema);
    else vivos.push(nombre);
  } catch (e) {
    frios.push(nombre + ': no se pudo comprobar (' + e + ')');
  }
}

/** Fecha más reciente de una columna. soloPasadas descarta las futuras. */
function latUltimaFecha_(idLibro, pestana, columna, soloPasadas) {
  var sh = SpreadsheetApp.openById(idLibro).getSheetByName(pestana);
  if (!sh) throw new Error('no existe la pestaña ' + pestana);
  var datos = sh.getDataRange().getValues();
  if (datos.length < 2) return null;

  var idx = -1;
  datos[0].forEach(function (h, i) { if (String(h).trim() === columna) idx = i; });
  if (idx < 0) throw new Error('no existe la columna ' + columna + ' en ' + pestana);

  var hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  var max = null;
  for (var i = 1; i < datos.length; i++) {
    var d = latFecha_(datos[i][idx]);
    if (!d) continue;
    if (soloPasadas && d > hoy) continue;
    if (!max || d > max) max = d;
  }
  return max;
}

/** Acepta Date, 'yyyy-MM-dd' y 'd/m/yyyy'. Lo que no entienda, lo ignora. */
function latFecha_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function latDiasDesde_(d) {
  return Math.floor((new Date().getTime() - d.getTime()) / 86400000);
}

function latTxt_(d) {
  return Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd');
}

/** Semana ISO de hace N días. Misma cuenta que usa PosPauta. */
function latSemanaHace_(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  var w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

/**
 * Prueba en seco: dice qué vería el latido sin lanzar nada.
 * Ejecutar a mano desde el editor cuando se cambien umbrales.
 */
function latidoEnSeco() {
  try { latido(); Logger.log('Todo al día. No habría avisado.'); }
  catch (e) { Logger.log('Habría avisado con esto:\n' + e.message); }
}
