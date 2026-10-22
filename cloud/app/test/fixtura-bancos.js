// Archivos del banco INVENTADOS con el formato exacto de los reales (22-oct-2026): el .xls "Transacciones del mes" del
// BAC (CDFV2/BIFF8, encabezado en la fila 13, Saldo Inicial en la 14, Totales con cantidad y monto) y el CSV
// "Transacciones del periodo" de la tarjeta BAC (latin-1, sin comillas). Montos, referencias y descripciones falsos.
const XLSX = require('xlsx');

const r2 = (n) => Math.round(n * 100) / 100;
const vacia = () => ['', '', '', '', '', '', '', '', '', '', ''];

/**
 * movs: [[dd/mm/aaaa, referencia, codigo, descripcion, debito, credito]]. El Balance se calcula (o se rompe con
 * romperEn). generado: numero de serie de Excel de cuando "se bajo".
 */
function xlsCuenta(o) {
  const M = [];
  for (let i = 0; i < 12; i++) M.push(vacia());
  M[1][4] = 'DETALLE DE MOVIMIENTOS DEL PERÍODO';
  M[4][0] = 'Encabezado';
  M[5][0] = 'Nombre'; M[5][1] = 'EMPRESA DE PRUEBA, S.A.'; M[5][7] = 'Saldo Inicial'; M[5][9] = o.inicial.toFixed(2);
  M[6][0] = 'Producto'; M[6][1] = o.cuenta; M[6][5] = o.moneda; M[6][7] = 'Saldo en Libros'; M[6][9] = '0.00';
  M[7][0] = 'Fecha'; M[7][1] = o.generado; M[7][7] = 'Retenidos y diferidos'; M[7][9] = '0.00';
  M[8][0] = 'Mensaje'; M[8][7] = 'Saldo Disponible'; M[8][9] = '0.00';
  M.push(['Fecha', 'Referencia', '', 'Código', 'Descripción', '', '', 'Débitos', 'Créditos', 'Balance*', '']);
  M.push(['', '', '', '', 'Saldo Inicial', '', '', '', '', o.inicial.toFixed(2), '']);
  let s = o.inicial, nd = 0, nc = 0, sd = 0, sc = 0;
  o.movs.forEach((m, i) => {
    s = r2(s - m[4] + m[5]);
    if (m[4]) { nd++; sd += m[4]; }
    if (m[5]) { nc++; sc += m[5]; }
    M.push([m[0], m[1], '', m[2], m[3], '', '', m[4], m[5], o.romperEn === i ? r2(s + 1) : s, '']);
  });
  M.push(vacia(), vacia(), ['Cuadro de Resumen', '', '', '', '', '', '', '', '', '', '']);
  M.push(['Totales', '', '', '', '', '', '', String(nd), r2(sd + (o.totalMal || 0)).toFixed(2), String(nc), r2(sc).toFixed(2)]);
  M.push(vacia(), ['* El balance mostrado es el balance en libros.', '', '', '', '', '', '', '', '', '', '']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(M), 'Report1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
}

/** El CSV de la tarjeta BAC. cargos: [[dd/mm/aaaa | '', descripcion, quetzales, dolares]] por tarjeta adicional. */
function csvTarjeta(o) {
  const l = [];
  l.push('Pro000000000000duct, Name, Date, Minimum payment/due date, Minimum payment/ Local Amount, Minimum Payment / Dollars Amount, Cash payment/Due date, Cash payment / Local amount, Cash payment / Dollar amount ');
  let q = o.previo[0], d = o.previo[1];
  Object.keys(o.tarjetas).forEach((t) => o.tarjetas[t].forEach((c) => { q += c[2]; d += c[3]; }));
  o.sinFecha.forEach((c) => { q += c[1]; d += c[2]; });
  l.push(o.producto + ', EMPRESA DE PRUEBA SA, ' + o.corte + ', 23/11/2026, 100.00, 10.00, , ' + r2(q + (o.contadoMal || 0)).toFixed(2) + ', ' + r2(d).toFixed(2) + ' ');
  l.push('Date, , Local, Dollars ');
  l.push(', Previous balance, ' + o.previo[0].toFixed(2) + ', ' + o.previo[1].toFixed(2) + ' ');
  Object.keys(o.tarjetas).forEach((t) => {
    l.push(', ' + t + ', 0.00, 0.00 ');
    o.tarjetas[t].forEach((c) => l.push(c[0] + ', ' + c[1] + ', ' + c[2].toFixed(2) + ', ' + c[3].toFixed(2) + ' '));
  });
  o.sinFecha.forEach((c) => l.push(', ' + c[0] + ', ' + c[1].toFixed(2) + ', ' + c[2].toFixed(2) + ' '));
  l.push(', PUNTOS PUNTOS BAC CREDOMATIC, 0.00, 0.00 ');
  l.push(', ASIGNADO   1000.00 REDIMIBLE   1000.00, 0.00, 0.00 ');
  l.push('CURRENT Interest MONTH/LOCAL, CURRENT Interest MONTH/DOLLARS, Balance at cut-off /Local, Balance at cut-off /Dollars ');
  l.push('1.00, 1.00, ' + r2(q + 1).toFixed(2) + ', ' + r2(d + 1).toFixed(2) + ' ');
  return Buffer.from(l.join('\r\n') + '\r\n', 'latin1');
}

// ---- el mes de prueba: octubre 2026 ----
const GENERADO_NOV = 46330.6;   // 2026-11-04
const Q_OCT = { cuenta: '904802543', moneda: 'QTZ', inicial: 100.5, generado: GENERADO_NOV, movs: [
  ['01/10/2026', '111111111', 'L1', 'AFI00000000 LIQ11111111111', 0, 1000],
  ['02/10/2026', '22222', 'PT', 'PAGO 4966-64**-****-9999', 500, 0],
  ['03/10/2026', '333333333', 'TF', 'TEF A : 123456789', 50, 0],
  ['05/10/2026', '99999', 'TF', 'COBRO EMISI\u0099N ESTADO DE CUENTA', 10, 0],
  ['06/10/2026', '444444444', 'MC', 'ACH DE Proveedor Inventado, S.A.', 0, 200.25],
  ['07/10/2026', '555555555', 'TF', 'Pago SAT2000 11 222 333 444', 300, 0],
  ['07/10/2026', '555555555', '59', 'COMISION TF: ACH INMEDIATO 555', 5, 0],
  ['08/10/2026', '666666666', 'XX', 'MOVIMIENTO RARO NUEVO', 1, 0]
] };
const USD_OCT = { cuenta: '905757274', moneda: 'USD', inicial: 20, generado: GENERADO_NOV, movs: [
  ['10/10/2026', '777', 'PT', 'PAGO 4966-64**-****-9999', 15, 0],
  ['31/10/2026', '888', '3F', 'CARGO POR SALDO MENOR LI', 1.5, 0]
] };
const TC_OCT = { producto: '4966-64**-****-2794', corte: '31/10/2026', previo: [1000, 50], contadoMal: 0,
  tarjetas: {
    '4966-64**-****-2794': [['04/10/2026', 'SU PAGO RECIBIDO GRACIAS', -300, 0]],
    '4966-64**-****-1638': [
      ['02/10/2026', 'FACEBK *ABCDEF1234       Dublin', 120.5, 0],
      ['03/10/2026', 'PANADERÍA INVENTADA      ANTIGUA', 45, 0],
      ['03/10/2026', 'PANADERÍA INVENTADA      ANTIGUA', 45, 0],
      ['09/10/2026', 'TIENDA, CON COMA         GUATEMALA', 10, 0],
      ['12/10/2026', 'NETFLIX.COM              866-000-000', 0, 6.99]]
  },
  sinFecha: [['CARGOS POR SERVICIO MES ANTERIOR', 0, 2.5], ['INTERES COM', 33.33, 0]] };

module.exports = { xlsCuenta, csvTarjeta, Q_OCT, USD_OCT, TC_OCT, GENERADO_NOV };
