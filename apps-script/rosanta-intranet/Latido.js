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

  CRM_SHEET_ID:     '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM', // Rosanta_CRM_Maestra
  MAESTRO_ID:       '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk', // Maestro financiero

  DIAS_CARRITOS: 10,   // los carritos son esporádicos; 10 días es "muerto", no "flojo"
  DIAS_RESERVAS: 10,
  DIAS_RESENAS:  14,   // hay semanas sin reseñas nuevas y es normal

  // --- Sexta señal: tasa de captura del CRM (p164) ---
  // Ventana móvil de 30 días y no "mes en curso" a propósito: el día 2 del mes
  // la tasa se calcula sobre tres tickets y cualquier umbral es ruido.
  DIAS_CAPTURA:    30,
  TASA_MINIMA:     0.15, // altas / tickets. El histórico sano va de 16% a 21%.
  LECTURA_MINIMA:  0.50, // confirmadas / altas. Mide el hábito, no el canal.
  GRACIA_LECTURA:  3,    // días que se le dan a una mesa para que le tecleen el monto
  MIN_TICKETS:     60    // debajo de esto la muestra no da para avisar de nada
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

  // La sexta señal mira algo distinto a las cinco anteriores: no si ENTRAN datos,
  // sino si entra la PROPORCIÓN de datos que debería. El canal de captura se cayó
  // tres veces en 2026 (abril, julio, agosto) y las tres se supieron meses después,
  // porque seguían entrando filas y las cinco señales de arriba daban verde.
  //
  // Son dos medidas y no una porque las fallas son de naturaleza distinta:
  //   · captura = altas del CRM / tickets del POS. Mide el CANAL. Si cae, la
  //     reserva no está llegando al CRM (abril y julio).
  //   · lectura = altas confirmadas / altas. Mide el HÁBITO. Si cae, la reserva
  //     sí llegó pero la mesa no se marcó, así que no se sabe quién vino (agosto).
  // Agosto es justo el caso que separa las dos: captura 25%, sana; lectura 33%.
  // Con una sola medida, agosto parecía un canal roto y no lo estaba.
  revisar_(frios, vivos, 'captura CRM', function () {
    var c = latCaptura_(LATIDO.DIAS_CAPTURA);
    if (c.tickets < LATIDO.MIN_TICKETS) return null;   // muestra corta: no opina

    if (c.tasa < LATIDO.TASA_MINIMA) {
      return 'solo ' + latPct_(c.tasa) + ' de captura en ' + LATIDO.DIAS_CAPTURA +
             ' días (' + c.altas + ' altas del CRM sobre ' + c.tickets +
             ' tickets del POS, mínimo ' + latPct_(LATIDO.TASA_MINIMA) +
             '). La reserva no está llegando al CRM.';
    }
    if (c.lectura < LATIDO.LECTURA_MINIMA) {
      return 'captura sana (' + latPct_(c.tasa) + ') pero solo ' + latPct_(c.lectura) +
             ' de las ' + c.altasL + ' reservas con más de ' + LATIDO.GRACIA_LECTURA +
             ' días tiene la visita confirmada (' + c.confirmadasL + '). Las mesas no ' +
             'se están marcando en Wix: el CAC y la retención del período no se pueden leer.';
    }
    return null;
  });

  Logger.log('Latido · al día: ' + (vivos.join(', ') || 'ninguno'));

  if (frios.length) {
    throw new Error('LATIDO ROSANTA · ' + frios.length + ' de 6 señales frías:\n· ' +
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
  soloDueno_();
  try { latido(); Logger.log('Todo al día. No habría avisado.'); }
  catch (e) { Logger.log('Habría avisado con esto:\n' + e.message); }
}

/**
 * Tasa de captura y tasa de lectura de los últimos N días (p164).
 *
 * CAPTURA = altas del CRM / tickets del POS. "Alta" es una fila del CRM cuya
 * fecha_alta cae en la ventana y cuyo segmento es una reserva de verdad:
 * "Cliente que visitó" o "Reserva histórica". NO cuentan los carritos
 * abandonados ni los cancelados, que son intentos y no visitas; meterlos
 * inflaría la tasa justo cuando el canal de reservas está caído.
 *
 * LECTURA = confirmadas / altas, donde confirmada es "Cliente que visitó".
 * Una reserva que llegó al CRM pero cuya mesa nadie marcó en Wix queda como
 * "Reserva histórica", y esa etiqueta hoy significa dos cosas: reserva vieja
 * migrada, o reserva nueva sin estado. Por eso la lectura baja se reporta
 * como aviso propio y no se mezcla con la captura.
 *
 * TICKETS: una fila de 02_Ventas_Maestro es un ticket. Se descartan los
 * eventos privados, igual que en FinanzasDatos (regla 2), porque un evento no
 * pasa por el motor de reservas y hundiría la tasa sin que nada esté roto.
 * Las cuatro primeras filas del maestro son encabezado, y la fecha con hora
 * después de mediodía cuenta al día siguiente (regla 10), como en Finanzas.
 */
function latCaptura_(dias) {
  var hasta = new Date(); hasta.setHours(0, 0, 0, 0);          // hoy no cuenta: va a medias
  var desde = new Date(hasta.getTime() - dias * 86400000);

  // ---- altas del CRM ----
  var crm = SpreadsheetApp.openById(LATIDO.CRM_SHEET_ID).getSheets()[0];
  var D = crm.getDataRange().getValues();
  var iSeg = -1, iAlta = -1;
  D[0].forEach(function (h, i) {
    var t = String(h).trim().toLowerCase();
    if (t === 'segmento')   iSeg  = i;
    if (t === 'fecha_alta') iAlta = i;
  });
  if (iSeg < 0 || iAlta < 0) throw new Error('el CRM no tiene segmento o fecha_alta');

  // La lectura se mide sobre una ventana más corta que la captura, y a propósito.
  // El monto se teclea al terminar el servicio o al día siguiente, así que una
  // reserva de anteayer sin confirmar no es un descuido: todavía no le toca.
  // Contarla hundiría la tasa todos los días por diseño. Son los mismos 3 días
  // de gracia que usa el Verificador para las mesas sin cerrar.
  var corte = new Date(hasta.getTime() - LATIDO.GRACIA_LECTURA * 86400000);

  var altas = 0, confirmadas = 0, altasL = 0, confirmadasL = 0;
  for (var r = 1; r < D.length; r++) {
    var f = latFecha_(D[r][iAlta]);
    if (!f || f < desde || f >= hasta) continue;
    var seg = String(D[r][iSeg] || '').trim();
    if (seg !== 'Cliente que visitó' && seg !== 'Reserva histórica') continue;
    altas++;
    var ok = (seg === 'Cliente que visitó');
    if (ok) confirmadas++;
    if (f < corte) { altasL++; if (ok) confirmadasL++; }
  }

  // ---- tickets del POS ----
  var V = SpreadsheetApp.openById(LATIDO.MAESTRO_ID)
            .getSheetByName('02_Ventas_Maestro').getDataRange().getValues();
  var tickets = 0;
  for (var v = 4; v < V.length; v++) {                          // 4 filas de encabezado
    var d = V[v][1];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() >= 12 ? 1 : 0));
    if (dia < desde || dia >= hasta) continue;
    if ((String(V[v][7] || '') + String(V[v][11] || '')).toUpperCase().indexOf('EVENTO') !== -1) continue;
    tickets++;
  }

  return {
    desde: desde, hasta: hasta, altas: altas, confirmadas: confirmadas, tickets: tickets,
    altasL: altasL, confirmadasL: confirmadasL,
    tasa:    tickets ? altas  / tickets : 0,
    lectura: altasL  ? confirmadasL / altasL : 0
  };
}

function latPct_(x) { return Math.round(x * 100) + '%'; }

/**
 * Calibración. Imprime la tasa de los últimos seis meses cerrados para poder
 * mirar los umbrales contra datos reales antes de confiar en la alarma.
 * Ejecutar a mano desde el editor. No avisa a nadie.
 */
function latidoCapturaHistorico() {
  soloDueno_();
  var lineas = ['ventana      altas  confirm  tickets  captura    (lectura: altas/confirm)  lectura'];
  for (var i = 6; i >= 1; i--) {
    var c = latCaptura_(i * 30);
    lineas.push('ultimos ' + (i * 30) + 'd' + (i * 30 < 100 ? ' ' : '') +
                '   ' + pad_(c.altas, 5) + pad_(c.confirmadas, 9) + pad_(c.tickets, 9) +
                pad_(latPct_(c.tasa), 9) + pad_(c.altasL, 12) + pad_(c.confirmadasL, 9) +
                pad_(latPct_(c.lectura), 9));
  }
  Logger.log(lineas.join('\n') +
             '\n\nUmbrales de hoy: captura < ' + latPct_(LATIDO.TASA_MINIMA) +
             ' avisa · lectura < ' + latPct_(LATIDO.LECTURA_MINIMA) + ' avisa' +
             ' · menos de ' + LATIDO.MIN_TICKETS + ' tickets no opina.');
}

function pad_(v, n) {
  var s = String(v);
  while (s.length < n) s = ' ' + s;
  return s;
}
