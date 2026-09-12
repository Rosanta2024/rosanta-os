// ============================================================
// ROSANTA - Carga de las ventas de 2025 al maestro
// 4 sep 2026
//
// PARA QUE: la meta es +20% contra el mismo mes del año pasado, y hasta hoy
// el maestro solo tiene 2026. Esto trae 2025 del reporte del POS.
//
// VA A UNA HOJA NUEVA, 02b_Ventas_2025, NO a 02_Ventas_Maestro.
//   No es manía de orden. El maestro tiene formulas que suman la hoja de
//   ventas y no todas filtran por año; ya paso con las 151 formulas del FEL
//   que no miraban la columna Estado. Metiendo 2025 en la misma hoja, cualquier
//   formula que no filtre duplicaria la venta del año y nadie se dara cuenta.
//   La capa de calculo lee 2025 de esta hoja aparte, a proposito.
//
// MAPEA POR NOMBRE DE ENCABEZADO, no por posicion: el reporte de 2025 trae
// 25 columnas en otro orden que el de 2026. Si falta una columna obligatoria
// se detiene y dice cuales encontro, en vez de cargar todo en blanco.
//
// LO QUE 2025 NO TRAE: no hay columna de Comensales. Asi que de 2025 se puede
// comparar la VENTA, pero no el ticket promedio ni los comensales. No es algo
// que se pueda arreglar aca; el POS no lo exporta en ese reporte.
//
// REGLAS, las mismas que usa el resto del sistema
//   - Venta neta = Subtotal / 1.12. El Subtotal ya trae el 10% de servicio.
//   - Se excluye el ticket con EVENTO en Notas o Productos.
//   - Se excluye el que no este Confirmado.
//   - Deduplica por TicketId + Fecha: se puede correr dos veces sin dano.
//
// USO: pegar en el proyecto del maestro, Cmd+S,
//      correr "revisarVentas2025" (no escribe) y despues "cargarVentas2025".
// ============================================================

var V25_MAESTRO_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var V25_ORIGEN_ID  = '1FajOaxXoEVt6RJwB7XS5EmPL08GZTe85a6dPDS3GWWc';  // ReporteVentas_9_4_2026
var V25_HOJA       = '02b_Ventas_2025';
var V25_ANIO       = 2025;

// encabezado del origen -> columna de la hoja destino
var V25_COLS = ['TicketId', 'Fecha', 'Hora', 'Subtotal', 'TotalFinal', 'Costo',
                'Ganancia', 'Notas', 'Estado', 'Vendedor', 'Propina', 'Productos',
                'Venta_Neta', 'Mes', 'Semana_ISO'];
var V25_OBLIGATORIAS = ['TicketId', 'Fecha', 'Subtotal'];

function _v25Norm(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/\s+/g, ' ').trim().toLowerCase().replace(/[_\s]/g, '');
}

/** Fecha del POS: viene como d/m/yyyy o como Date, segun como la lea el Sheet. */
function _v25Fecha(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!m) return null;
  var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function _v25SemanaISO(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

function _v25Num(v) {
  var n = Number(String(v === null || v === undefined ? '' : v).replace(/[, ]/g, ''));
  return isNaN(n) ? 0 : n;
}

function _v25Correr(escribir) {
  var origen = SpreadsheetApp.openById(V25_ORIGEN_ID).getSheets()[0];
  var datos = origen.getDataRange().getValues();
  if (datos.length < 2) throw new Error('El reporte de origen viene vacio.');

  // ---- guardia de encabezados ----
  var enc = datos[0], idx = {};
  for (var c = 0; c < enc.length; c++) idx[_v25Norm(enc[c])] = c;
  var faltan = [];
  V25_OBLIGATORIAS.forEach(function (n) {
    if (idx[_v25Norm(n)] === undefined) faltan.push(n);
  });
  if (faltan.length) {
    throw new Error('Al reporte le faltan columnas: ' + faltan.join(', ') +
      '.\nLas que trae son: ' + enc.join(' | '));
  }
  function col(nombre) {
    var i = idx[_v25Norm(nombre)];
    return i === undefined ? -1 : i;
  }
  var cTicket = col('TicketId'), cFecha = col('Fecha'), cHora = col('Hora'),
      cSub = col('Subtotal'), cTotal = col('TotalFinal'), cCosto = col('Costo'),
      cGan = col('Ganancia'), cNotas = col('Notas'), cEstado = col('Estado'),
      cVend = col('vendedor'), cProp = col('Propina'), cProd = col('Productos');

  // ---- lo que ya esta cargado ----
  var ss = SpreadsheetApp.openById(V25_MAESTRO_ID);
  var hoja = ss.getSheetByName(V25_HOJA);
  var yaEstan = {};
  if (hoja) {
    var prev = hoja.getDataRange().getValues();
    for (var r = 1; r < prev.length; r++) {
      var f = prev[r][1];
      if (f instanceof Date) {
        yaEstan[String(prev[r][0]).trim() + '|' + Utilities.formatDate(
          f, Session.getScriptTimeZone(), 'yyyy-MM-dd')] = true;
      }
    }
  }

  var nuevas = [], porMes = {}, saltados = { evento: 0, noConfirmado: 0, sinFecha: 0,
                                             otroAnio: 0, repetido: 0 };
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!String(fila[cTicket] || '').trim()) continue;

    var fecha = _v25Fecha(fila[cFecha]);
    if (!fecha) { saltados.sinFecha++; continue; }
    if (fecha.getFullYear() !== V25_ANIO) { saltados.otroAnio++; continue; }

    if (cEstado > -1 && String(fila[cEstado] || '').trim() &&
        String(fila[cEstado]).trim().toLowerCase() !== 'confirmado') {
      saltados.noConfirmado++; continue;
    }
    var texto = String(cNotas > -1 ? fila[cNotas] : '') + String(cProd > -1 ? fila[cProd] : '');
    if (texto.toUpperCase().indexOf('EVENTO') !== -1) { saltados.evento++; continue; }

    var llave = String(fila[cTicket]).trim() + '|' +
                Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (yaEstan[llave]) { saltados.repetido++; continue; }
    yaEstan[llave] = true;

    var sub = _v25Num(fila[cSub]);
    var neta = sub / 1.12;
    var mes = fecha.getMonth() + 1;
    porMes[mes] = (porMes[mes] || 0) + neta;

    nuevas.push([
      String(fila[cTicket]).trim(), fecha,
      cHora > -1 ? fila[cHora] : '', sub,
      cTotal > -1 ? _v25Num(fila[cTotal]) : '', cCosto > -1 ? _v25Num(fila[cCosto]) : '',
      cGan > -1 ? _v25Num(fila[cGan]) : '', cNotas > -1 ? fila[cNotas] : '',
      cEstado > -1 ? fila[cEstado] : '', cVend > -1 ? fila[cVend] : '',
      cProp > -1 ? _v25Num(fila[cProp]) : '', cProd > -1 ? fila[cProd] : '',
      Math.round(neta * 100) / 100, mes, _v25SemanaISO(fecha)
    ]);
  }

  if (escribir && nuevas.length) {
    if (!hoja) {
      hoja = ss.insertSheet(V25_HOJA);
      hoja.getRange(1, 1, 1, V25_COLS.length).setValues([V25_COLS]).setFontWeight('bold');
      hoja.setFrozenRows(1);
    }
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, V25_COLS.length).setValues(nuevas);
  }

  Logger.log(escribir ? '=== CARGADAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(nuevas.length + ' filas nuevas de ' + V25_ANIO);
  Logger.log('Saltadas: ' + saltados.repetido + ' ya estaban, ' + saltados.evento +
             ' eventos, ' + saltados.noConfirmado + ' no confirmadas, ' +
             saltados.sinFecha + ' sin fecha, ' + saltados.otroAnio + ' de otro año');
  Logger.log('--- venta neta por mes (Subtotal / 1.12, sin eventos) ---');
  var total = 0;
  for (var m = 1; m <= 12; m++) {
    if (!porMes[m]) continue;
    total += porMes[m];
    Logger.log('   ' + ('0' + m).slice(-2) + ': Q' + porMes[m].toFixed(2) +
               '   ->  meta +20% = Q' + (porMes[m] * 1.2).toFixed(2));
  }
  Logger.log('   AÑO 2025: Q' + total.toFixed(2));
  if (escribir) Logger.log('Listo. La pantalla de Metas ya puede calcular el +20% sola.');
}

/** Solo reporta. No escribe. Correr esta primero. */
function revisarVentas2025() { _v25Correr(false); }

/** Carga a 02b_Ventas_2025. Se puede correr dos veces sin duplicar. */
function cargarVentas2025() { _v25Correr(true); }