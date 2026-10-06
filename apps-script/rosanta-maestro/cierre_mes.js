// ============================================================
// ROSANTA - Estado del cierre de un mes (solo lectura)
//
// Lo usa la tarea mensual "rosanta-reporte-mensual" con
//   clasp run estadoCierreMes --params '[2026, 9]'
// para saber si el mes ya se puede leer, directo del Sheet nativo.
// Reemplaza la lectura del espejo .xlsx (5-oct-2026: todo es nativo).
//
// No escribe nada. Por cada libro devuelve la ultima fecha del mes,
// si ya hay filas del mes siguiente y cuantas partidas del mes siguen
// en POR_CLASIFICAR. No calcula ventas ni P&L: eso es de la intranet.
// ============================================================

var LIBROS_CIERRE = [
  // hoja, columna de fecha, columna de categoria (0 = no tiene), obligatoria
  ['03_Banco_Industrial',    1, 7,  true],
  ['04_Banco_BAC',           1, 8,  true],
  ['02_Ventas_Maestro',      2, 0,  true],
  ['01_FEL_Maestro',         1, 14, false],
  ['05_Tarjeta_Credito_BAC', 1, 5,  false],
  ['06_Tarjeta_Credito_BI',  1, 5,  false]   // desde jul-2026 (5-oct-2026)
];

/**
 * anio y mes (1-12) son opcionales: sin ellos revisa el mes anterior
 * al de hoy en Guatemala.
 */
function estadoCierreMes(anio, mes) {
  if (!anio || !mes) {
    var hoy = new Date();
    anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    mes  = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
  }
  var finMes = new Date(anio, mes, 0);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var libros = [];

  for (var i = 0; i < LIBROS_CIERRE.length; i++) {
    var hoja = LIBROS_CIERRE[i][0], cf = LIBROS_CIERRE[i][1],
        cc = LIBROS_CIERRE[i][2], obligatoria = LIBROS_CIERRE[i][3];
    var h = ss.getSheetByName(hoja);
    if (!h) { libros.push({ hoja: hoja, obligatoria: obligatoria, error: 'no existe la hoja' }); continue; }
    var filas = h.getLastRow() - 4;
    var datos = filas > 0 ? h.getRange(5, 1, filas, Math.max(cf, cc)).getValues() : [];

    var ultima = null, despues = false, porClasificar = 0, filasMes = 0;
    for (var r = 0; r < datos.length; r++) {
      var f = _fechaCarga(datos[r][cf - 1]);
      if (!f) continue;
      if (f.getFullYear() === anio && f.getMonth() === mes - 1) {
        filasMes++;
        if (!ultima || f > ultima) ultima = f;
        if (cc && String(datos[r][cc - 1] || '').trim() === 'POR_CLASIFICAR') porClasificar++;
      } else if (f > finMes) {
        despues = true;
      }
    }
    libros.push({
      hoja: hoja,
      obligatoria: obligatoria,
      filasDelMes: filasMes,
      ultimaFecha: ultima ? Utilities.formatDate(ultima, 'America/Guatemala', 'yyyy-MM-dd') : null,
      hayDatosDelMesSiguiente: despues,
      porClasificar: porClasificar
    });
  }

  return {
    mes: anio + '-' + (mes < 10 ? '0' : '') + mes,
    finDeMes: Utilities.formatDate(finMes, 'America/Guatemala', 'yyyy-MM-dd'),
    libros: libros
  };
}



