// ============================================================
// ROSANTA - Marketing: honorarios aparte de la pauta (15 sep 2026)
// Decision de Juanma del 15-sep-2026, para el CAC de Marketing OS (p10).
//
// QUE SE MUEVE Y POR QUE
// 1. VANESSA WILCHES, honorarios de marketing digital. Cuatro transferencias del
//    Banco Industrial de abril a julio (descripcion generica "BANCA ELECTRONICA",
//    ~US$207 al mes) y el PayPal de agosto (US$190, "PAYPAL *VANEWILCHES17").
//    Estaban como MARKETING_DIGITAL.
//    -> MARKETING_HONORARIOS, categoria nueva.
// 2. SP MYFONTS INC (US$18, tarjeta, agosto): una tipografia, no es pauta.
//    -> CUOTAS_Y_SUSCRIPCIONES.
//
// EL DRE NO CAMBIA: MARKETING_DIGITAL, MARKETING_HONORARIOS y CUOTAS_Y_SUSCRIPCIONES
// caen las tres en el bloque Marketing. Lo que cambia es que MARKETING_DIGITAL queda
// SOLO con medios —FACEBK y GOOGLE*ADS, que se cobran a la tarjeta del BAC— y el CAC
// puede excluir los honorarios por categoria en vez de por el texto del banco, que es
// lo fragil: las cuatro transferencias de Vanessa dicen "BANCA ELECTRONICA".
//
// LO QUE NO SE TOCA: los pagos a Edwin Flores ("Marketing Marzo26", "junio marketing")
// siguen en SERVICIOS_PROFESIONALES. Son el pago de su factura FEL y la regla 9 ya los
// descuenta para que no cuenten dos veces.
//
// COMO FUNCIONA
// Busca cada fila por FECHA + DESCRIPCION + MONTO, nunca por numero de fila, y ademas
// verifica el Docto en el banco. Solo escribe si la categoria de hoy es la esperada.
// Relee lo escrito. Se puede correr dos veces sin dano.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarReclasMarketing()   no escribe. Tiene que decir 6 filas y "Sin avisos".
//   2. aplicarReclasMarketing()
//   3. revisarReclasMarketing()   tiene que decir 0 filas y 6 ya estaban bien.
//   4. generarEspejo()
// ============================================================

var SHEET_ID_MK = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// Columnas de cada hoja (1 = A). 'usd' solo existe en la tarjeta.
var HOJAS_MK = {
  '03_Banco_Industrial':    { fecha: 1, docto: 2, desc: 3, monto: 4, cat: 7 },
  '05_Tarjeta_Credito_BAC': { fecha: 1, desc: 2, monto: 3, usd: 4, cat: 5 }
};

// [hoja, fecha, descripcion, monto, moneda, categoria nueva, categoria ESPERADA hoy, docto]
var LOTE_MK = [
  ['03_Banco_Industrial', '2026-04-17', 'BANCA ELECTRONICA', 1791.70, 'Q', 'MARKETING_HONORARIOS', 'MARKETING_DIGITAL', '17197374'],
  ['03_Banco_Industrial', '2026-05-14', 'BANCA ELECTRONICA', 1590.80, 'Q', 'MARKETING_HONORARIOS', 'MARKETING_DIGITAL', '14086764'],
  ['03_Banco_Industrial', '2026-06-23', 'BANCA ELECTRONICA', 1592.85, 'Q', 'MARKETING_HONORARIOS', 'MARKETING_DIGITAL', '23181375'],
  ['03_Banco_Industrial', '2026-07-20', 'BANCA ELECTRONICA', 1592.85, 'Q', 'MARKETING_HONORARIOS', 'MARKETING_DIGITAL', '20152786'],
  // total Vanessa por transferencia Q6,568.20; con el PayPal de agosto, US$190 mas.
  ['05_Tarjeta_Credito_BAC', '2026-08-21', 'PAYPAL *VANEWILCHES17 4029357733', 190.00, 'USD', 'MARKETING_HONORARIOS', 'MARKETING_DIGITAL', ''],
  ['05_Tarjeta_Credito_BAC', '2026-08-13', 'SP MYFONTS INC MYFONTS.COM', 18.00, 'USD', 'CUOTAS_Y_SUSCRIPCIONES', 'MARKETING_DIGITAL', '']
];

function _mkFecha(d) {
  if (!(d instanceof Date)) return String(d || '').trim();
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}
function _mkTexto(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function _mkNum(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function _mkLlave(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}

function _mkCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_MK);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }

  var hojas = {}, datos = {};
  Object.keys(HOJAS_MK).forEach(function (n) {
    hojas[n] = ss.getSheetByName(n);
    datos[n] = hojas[n] ? hojas[n].getDataRange().getValues() : null;
  });

  var avisos = [], tareas = [], yaEstaban = 0;
  LOTE_MK.forEach(function (it) {
    var nombre = it[0], C = HOJAS_MK[nombre], d = datos[nombre];
    var etiqueta = nombre.slice(0, 6) + ' ' + it[1] + ' "' + it[2] + '"';
    if (!d) { avisos.push('Falta la hoja ' + nombre); return; }

    var col = (it[4] === 'USD') ? C.usd : C.monto;
    var encontradas = [];
    for (var r = 4; r < d.length; r++) {
      if (_mkFecha(d[r][C.fecha - 1]) !== it[1]) continue;
      if (_mkTexto(d[r][C.desc - 1]) !== _mkTexto(it[2])) continue;
      if (Math.abs(_mkNum(d[r][col - 1]) - it[3]) > 0.01) continue;
      if (it[7] && C.docto && _mkLlave(d[r][C.docto - 1]) !== it[7]) continue;
      encontradas.push(r);
    }
    if (!encontradas.length) { avisos.push('Sin coincidencia: ' + etiqueta + ' ' + it[4] + it[3]); return; }
    if (encontradas.length > 1) {
      avisos.push('FILA REPETIDA: ' + etiqueta + ' aparece ' + encontradas.length + ' veces. No se toca.');
      return;
    }
    var fila = encontradas[0];
    var actual = _mkTexto(d[fila][C.cat - 1]);
    if (actual === it[5]) { yaEstaban++; return; }
    if (actual !== it[6]) {
      avisos.push('OJO ' + etiqueta + ' dice "' + actual + '" y se esperaba "' + it[6] + '". No se toca.');
      return;
    }
    tareas.push({ hoja: nombre, fila: fila + 1, col: C.cat, it: it });
  });

  var noQuedaron = [];
  if (escribir && !avisos.length && tareas.length) {
    tareas.forEach(function (t) { hojas[t.hoja].getRange(t.fila, t.col).setValue(t.it[5]); });
    SpreadsheetApp.flush();
    var releidas = {};
    Object.keys(HOJAS_MK).forEach(function (n) {
      releidas[n] = hojas[n].getRange(1, HOJAS_MK[n].cat, hojas[n].getLastRow(), 1).getValues();
    });
    tareas.forEach(function (t) {
      var cat = _mkTexto(releidas[t.hoja][t.fila - 1][0]);
      if (cat !== t.it[5]) {
        noQuedaron.push(t.hoja.slice(0, 6) + ' fila ' + t.fila + ': la hoja dice "' + cat + '"');
      }
    });
  }

  Logger.log(escribir ? (avisos.length ? '=== NO SE ESCRIBIO: hay avisos ===' : '=== ESCRITAS ===')
                      : '=== SIMULACION, no se escribio nada ===');
  Logger.log(tareas.length + ' filas · ya estaban bien: ' + yaEstaban);
  tareas.forEach(function (t) {
    Logger.log('   ' + t.hoja.slice(0, 6) + ' fila ' + t.fila + ' ' + t.it[1] + ' ' + t.it[2] +
               ' ' + t.it[4] + t.it[3] + ': ' + t.it[6] + ' -> ' + t.it[5]);
  });
  if (escribir && !avisos.length && tareas.length) {
    Logger.log(noQuedaron.length ? '--- NO QUEDARON ---' : 'Releidas: todo quedo escrito.');
    noQuedaron.forEach(function (x) { Logger.log('   ' + x); });
  }
  if (avisos.length) {
    Logger.log('--- revisar ---');
    avisos.forEach(function (x) { Logger.log('   ' + x); });
  } else {
    Logger.log('Sin avisos.');
  }
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarReclasMarketing() { _mkCorrer(false); }

/** Escribe las 6 categorias. No escribe nada si la revision tiene avisos. */
function aplicarReclasMarketing() { _mkCorrer(true); }
