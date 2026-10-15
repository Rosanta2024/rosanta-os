/**
 * ROSANTA · POS semanal → pestaña pauta_semanal (este mismo libro)
 * ------------------------------------------------------------------------------
 * Lee los exports del POS de la carpeta "Reportes semanales" de Drive (una
 * subcarpeta por semana ISO: S19, S20... más las de mes que queden) y escribe
 * por semana ISO las columnas:
 *   - comensales : suma de la columna "Notas" del POS (comensales por mesa)
 *   - ticket     : Q por comensal = ventas (TotalFinal) ÷ comensales, solo sobre
 *                  tickets que traen comensales, para que el ratio sea consistente
 *
 * OJO CON LA CARPETA (24-ago-2026): esto apuntaba a 00_CIERRE_MAESTRO, donde ya
 * no hay ningún archivo del POS. El script corría, no encontraba nada, escribía
 * un Logger.log y salía en silencio. Así se perdieron las semanas 32, 33, 34 y
 * 35 de pauta_semanal sin que nadie se enterara. Si vuelve a mover la carpeta,
 * hay que cambiar POSP_FOLDER_ID aquí.
 *
 * Acepta el export semanal actual ("ReporteVentas_8_31_2026_162246.xlsx") y el
 * mensual antiguo ("POS 2026-07" / "POS-2026-07" / "POS-S27"), y deduplica por
 * TicketId por si conviven. NO toma "ReporteVentasProductos*": ese es el reporte
 * por producto y no trae comensales por ticket.
 *
 * Columnas que espera el export (verificadas contra ReporteVentas del 24-ago):
 *   TicketId · Fecha (d/m/yyyy) · TotalFinal · Notas (= comensales de la mesa)
 *   Estado (solo "Confirmado") · Es Contable (descarta "no")
 * La última fila del export es un total sin TicketId: se descarta sola.
 *
 * PosFile CAMBIÓ DE SISTEMA EL 1-OCT-2026 (14-oct-2026): el export semanal pasó a
 * llamarse "ReporteFacturas-DD-MM-YYYY" y nadie se lo dijo a este lector, que siguió
 * leyendo solo los ReporteVentas viejos. No falló: actualizaba las semanas viejas y
 * dejaba la S40 y la S41 sin comensales. Lo cazó la señal "pauta · POS" del Latido
 * del 13-oct. Columnas del formato nuevo (verificadas contra ReporteFacturas del
 * 12-oct): No. (= ticket, "FT67") · Fecha (dd/mm/yyyy) · Estado ("finalizado") ·
 * Contable (viene "no" en TODAS las filas: aquí NO se filtra) · Notas (comensales,
 * a veces con texto: "1 persona", "2  Se realizo un anticipo…") · Total.
 * También se aceptan las copias "Copy of …" / "Copia de …" que deja Drive.
 *
 * Los .xlsx se convierten a Google Sheet temporal vía Drive API (con el token
 * de la sesión) y el temporal se manda a la papelera al terminar.
 *
 * USO:
 *   - posActualizarPauta()  -> recorre TODOS los POS disponibles y recalcula
 *     todas las semanas encontradas. Idempotente: se puede correr cuando sea.
 *   - Activador sugerido: posActualizarPauta → Semanal → lunes 7-8am (después
 *     de subir el reporte de la semana a su carpeta S##).
 *   - Si algo falla, la función LANZA excepción en vez de salir callada: así
 *     Apps Script manda el correo de "activador fallido" al dueño. No cambiar
 *     esto por un Logger.log, que es justo lo que ocultó el fallo anterior.
 *
 * Globales con prefijo POSP_ para no chocar con Code.js / WixReservasPauta.js.
 */

var POSP_SHEET_ID  = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var POSP_TAB       = 'pauta_semanal';
var POSP_FOLDER_ID = '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP'; // Reportes semanales (una subcarpeta por semana ISO)
var POSP_YEAR      = 2026;

function posActualizarPauta() {
  var tickets = {};                       // TicketId -> {fecha, total, comensales}
  var archivos = posBuscarArchivos_();

  if (!archivos.length) {
    // El nombre de la carpeta se lee de Drive para que este mensaje no pueda
    // quedar desactualizado como el anterior, que seguía diciendo 00_CIERRE_MAESTRO.
    var nombreCarpeta = DriveApp.getFolderById(POSP_FOLDER_ID).getName();
    throw new Error('POS: no hay ningún archivo POS*/ReporteVentas* en las subcarpetas de "' +
      nombreCarpeta + '" (' + POSP_FOLDER_ID + '). pauta_semanal se queda sin comensales ' +
      'ni ticket hasta que se corrija. Revisa que el reporte de la semana esté en su carpeta S##.');
  }

  // Los archivos que fallen no tumban la corrida: se anotan y se avisa al final,
  // después de haber escrito las semanas que sí se pudieron calcular.
  var fallos = [];
  archivos.forEach(function (f) {
    try {
      var vals = posLeerTabla_(f);
      posAcumularTickets_(vals, tickets);
      Logger.log('Leído: ' + f.getName());
    } catch (e) {
      fallos.push(f.getName() + ' (' + e + ')');
      Logger.log('No pude leer "' + f.getName() + '": ' + e);
    }
  });

  // Agregar por semana ISO (solo el año configurado).
  var porWk = {};
  Object.keys(tickets).forEach(function (id) {
    var t = tickets[id];
    if (!t.fecha || posIsoYear_(t.fecha) !== POSP_YEAR) return;
    if (!(t.comensales > 0)) return;      // sin comensales no aporta al ratio
    var wk = posIsoWeek_(t.fecha);
    if (!porWk[wk]) porWk[wk] = { comensales: 0, ventas: 0 };
    porWk[wk].comensales += t.comensales;
    porWk[wk].ventas     += t.total;
  });

  var semanas = Object.keys(porWk).map(Number).sort(function (a, b) { return a - b; });
  if (!semanas.length) {
    throw new Error('POS: leí ' + archivos.length + ' archivo(s) pero ninguno trae tickets con ' +
      'comensales de ' + POSP_YEAR + '. ¿Cambió el formato del export? Se esperan las columnas ' +
      'TicketId, Fecha, TotalFinal y Notas.' +
      (fallos.length ? ' Archivos ilegibles: ' + fallos.join(' · ') : ''));
  }

  semanas.forEach(function (wk) {
    var agg = porWk[wk];
    var ticket = Math.round(agg.ventas / agg.comensales * 100) / 100;
    posEscribirSemana_(wk, agg.comensales, ticket);
    Logger.log('S' + wk + ' → ' + agg.comensales + ' comensales · ticket Q' + ticket);
  });
  Logger.log('POS OK: ' + archivos.length + ' archivo(s), semanas actualizadas: ' + semanas.join(', '));

  // Se avisa al final, ya con las semanas buenas escritas: un archivo roto no
  // debe costar las semanas que sí se pudieron calcular.
  if (fallos.length) {
    throw new Error('POS: actualicé ' + semanas.length + ' semana(s) (' + semanas.join(', ') +
      ') pero ' + fallos.length + ' archivo(s) no se pudieron leer: ' + fallos.join(' · '));
  }
}

/** Exports del POS (POS* / ReporteVentas*, xlsx o Sheet) dentro de las subcarpetas
 *  de la carpeta de reportes: una por semana ISO (S19...) y las de mes que queden. */
function posBuscarArchivos_() {
  var out = [];
  var subs = DriveApp.getFolderById(POSP_FOLDER_ID).getFolders();
  while (subs.hasNext()) {
    var files = subs.next().getFiles();
    while (files.hasNext()) {
      var f = files.next();
      var n = f.getName();
      n = n.replace(/^(Copy of|Copia de)\s+/i, '');
      if (/^(POS|ReporteVentas|ReporteFacturas)[\s\-_]/i.test(n) || /^POS$/i.test(n.replace(/\.[^.]+$/, ''))) out.push(f);
    }
  }
  return out;
}

/** Devuelve la tabla (matriz de valores) del archivo: Sheet directo o xlsx convertido. */
function posLeerTabla_(file) {
  var mime = file.getMimeType();
  if (mime === 'application/vnd.google-apps.spreadsheet') {
    return SpreadsheetApp.openById(file.getId()).getSheets()[0].getDataRange().getValues();
  }
  // xlsx/xls: copia convertida a Google Sheet vía Drive API, se lee y va a la papelera.
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.getId() + '/copy', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.spreadsheet', name: 'tmp_pos_' + file.getName() }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Drive copy HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var tmpId = JSON.parse(res.getContentText()).id;
  try {
    return SpreadsheetApp.openById(tmpId).getSheets()[0].getDataRange().getValues();
  } finally {
    DriveApp.getFileById(tmpId).setTrashed(true);
  }
}

/** Suma cada fila del POS al mapa de tickets (dedupe por ticket, el último gana).
 *  Entiende los dos formatos de PosFile: ReporteVentas (hasta el 30-sep-2026) y
 *  ReporteFacturas (desde el 1-oct-2026). Ver la cabecera. */
function posAcumularTickets_(vals, tickets) {
  if (!vals || vals.length < 2) return;
  var head = vals[0].map(function (h) { return String(h).trim(); });
  var col = {};
  head.forEach(function (h, i) { col[h] = i; });

  var nuevo = col['TicketId'] === undefined && col['No.'] !== undefined;
  var cId    = nuevo ? col['No.'] : col['TicketId'];
  var cTotal = nuevo ? col['Total'] : col['TotalFinal'];
  if (cId === undefined || col['Fecha'] === undefined || cTotal === undefined) {
    throw new Error('Sin columnas TicketId/No., Fecha y TotalFinal/Total (¿es el export correcto del POS?)');
  }

  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var id = String(r[cId] || '').trim();
    if (!id) continue;
    if (col['Estado'] !== undefined) {
      var estado = String(r[col['Estado']]).trim().toLowerCase();
      if (estado !== (nuevo ? 'finalizado' : 'confirmado')) continue;
    }
    if (!nuevo && col['Es Contable'] !== undefined && String(r[col['Es Contable']]).trim().toLowerCase() === 'no') continue;
    tickets[(nuevo ? 'F:' : '') + id] = {
      fecha: posParseFecha_(r[col['Fecha']]),
      total: Number(r[cTotal]) || 0,
      comensales: posComensales_(r[col['Notas']])
    };
  }
}

/** Notas = comensales de la mesa. Toma el número del inicio ("2", "1 persona",
 *  "2  Se realizo un anticipo…"); sin número al inicio, 0 (no aporta al ratio). */
function posComensales_(v) {
  if (typeof v === 'number') return v > 0 ? v : 0;
  var m = String(v == null ? '' : v).match(/^\s*(\d{1,3})(?!\d|[.,]\d)/);
  return m ? Number(m[1]) : 0;
}

/** Fecha del POS: Date de la conversión o texto d/m/yyyy. */
function posParseFecha_(v) {
  if (v instanceof Date) return v;
  var m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function posEscribirSemana_(wk, comensales, ticket) {
  var sh = SpreadsheetApp.openById(POSP_SHEET_ID).getSheetByName(POSP_TAB);
  var data = sh.getDataRange().getValues();
  var head = data[0], col = {};
  head.forEach(function (h, i) { col[h] = i; });
  if (col['comensales'] === undefined || col['ticket'] === undefined) {
    throw new Error('pauta_semanal no tiene las columnas comensales/ticket. Abre una vez el ' +
      'Dashboard de Pauta de la intranet (pautaEnsureCols_ las crea) y vuelve a correr.');
  }

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
  sh.getRange(rowIdx, col['comensales'] + 1).setValue(comensales);
  sh.getRange(rowIdx, col['ticket'] + 1).setValue(ticket);
}

/* Semana/año ISO por el jueves de la semana (evita líos en los bordes de año). */
function posIsoWeek_(d) {
  var date = new Date(d.getTime()); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  var w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function posIsoYear_(d) {
  var date = new Date(d.getTime()); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  return date.getFullYear();
}
