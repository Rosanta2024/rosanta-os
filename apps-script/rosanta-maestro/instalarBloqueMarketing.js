// ============================================================
// ROSANTA - Bloque MARKETING en 09_PnL_Mensual
// Preparado el 2 sep 2026.
//
// POR QUE HACE FALTA
// El gasto de marketing vive en TRES filas distintas del P&L y
// ninguna las junta, asi que hoy es imposible medirlo contra la
// banda del sector (4-8% de la venta):
//
//   · Medios (Meta + Google) -> fila 37, "Cargos Tarjeta Credito
//     BAC", revueltos con Anthropic, Workspace y demas.
//   · Gestion CON factura (Edwin) -> fila 29, dentro del bloque
//     de gastos operativos FEL, indistinguible de la abogada y la
//     contadora.
//   · Gestion SIN factura (Vanessa) -> fila 33.
//
// Este bloque los rearma en un solo lugar y los mide contra la
// banda. Se instala UNA vez; despues vive solo con las formulas.
//
// ES INFORMATIVO. NO SUMA A NINGUN TOTAL.
// Los tres componentes YA estan contados en el resultado operativo
// por sus filas de origen. Este bloque los vuelve a leer para
// mostrarlos juntos. Si alguien lo mete en un SUM, duplica el gasto
// de marketing entero. Por eso el titulo lo dice y por eso va
// despues del RESULTADO NETO, fuera de todo subtotal.
//
// EL CRITERIO DE "MEDIOS" - el mismo que la intranet
// Medios = compra de audiencia en plataforma, y nada mas. En el
// maestro se reconocen por la descripcion del cargo en la tarjeta:
// Meta trae "FACEBK" y Google trae "GOOGLE*ADS" (el asterisco es
// literal, por eso va escapado como ~* en el SUMIFS). Todo lo demas
// de MARKETING_DIGITAL es gestion, contenido o herramientas.
//
// El subtotal de medios de este bloque es EXACTAMENTE el
// denominador del ROAS de la intranet. Si algun dia no cuadran, uno
// de los dos esta mal.
//
// Los honorarios SI cuentan en el total de marketing de aca: la
// banda de 4-8% se mide sobre el gasto completo, gestion incluida.
// Lo que nunca los admite es el ROAS. Son dos preguntas distintas:
// "cuanto pesa marketing en mi operacion" y "que devuelve cada
// quetzal de pauta".
//
// A VANESSA SE LE PAGA POR DOS VIAS - resuelto 2-sep-2026
// Normalmente cobra por transferencia del Banco Industrial (las "BANCA
// ELECTRONICA"), pero en agosto la transferencia no paso y se le pago
// por PayPal con la tarjeta. Son la misma cosa por otro canal.
//
// Por eso la fila de gestion sin factura lee las DOS fuentes: la fila
// 33 del banco mas lo que en la tarjeta esta como MARKETING_DIGITAL y
// no es medios. Ese resto tambien recoge herramientas de marketing
// (MyFonts y similares), y esta bien que las recoja: la banda de 4-8%
// mide el gasto de marketing completo. Lo unico que jamas debe entrar
// ahi son los medios, que ya van en su propio subtotal arriba.
//
// Para que funcione, el cargo de tarjeta de Vanessa tiene que estar
// como MARKETING_DIGITAL. Lo deja asi AppsScript_recategorizar_pauta.gs.
//
// DEPENDE DE DOS COSAS QUE YA SE HICIERON (3-sep-2026)
//   · recategorizar_pauta: saco de MARKETING_DIGITAL los pagos de
//     Edwin y de la empresa de monitoreo. Sin eso la fila de gestion
//     sin factura sale Q16,500 inflada.
//   · filtro_anuladas: el gasto FEL ya no cuenta facturas anuladas.
// Si alguna vez se restauran esas dos, este bloque miente.
//
// USO: pegar en un archivo nuevo del proyecto, Cmd+S,
//      correr "instalarBloqueMarketing".
//      Es idempotente: si el bloque ya existe, avisa y no hace nada.
//      Para moverlo de sitio, borrar las filas a mano y volver a correr.
// ============================================================

var SHEET_ID_BMK = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJA_BMK     = '09_PnL_Mensual';
var TITULO_BMK   = 'BLOQUE MARKETING  ·  gasto total y banda del sector  (informativo, NO suma)';
var NIT_EDWIN    = '82651086';   // NIT_Emisor, col E de 01_FEL_Maestro. Estable: es de el y de nadie mas.
var USD_BMK      = 7.7;          // mismo tipo de cambio que la nota 9 del P&L

/** Ancla: el bloque se instala justo despues de esta fila, que es el
 *  RESULTADO NETO. Se busca por TEXTO y no por numero, para que siga
 *  funcionando si alguien agrega filas mas arriba. */
var ANCLA_BMK = 'RESULTADO NETO DEL MES';

function instalarBloqueMarketing() {
  var sh = SpreadsheetApp.openById(SHEET_ID_BMK).getSheetByName(HOJA_BMK);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_BMK);

  var colA = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  var ancla = 0, yaEsta = 0;
  for (var i = 0; i < colA.length; i++) {
    var t = String(colA[i][0] || '');
    if (!ancla && t.indexOf(ANCLA_BMK) === 0) ancla = i + 1;
    if (t.indexOf('BLOQUE MARKETING') === 0) yaEsta = i + 1;
  }
  if (yaEsta) {
    Logger.log('El bloque ya esta instalado en la fila ' + yaEsta + '. No hago nada.');
    Logger.log('Para reinstalarlo: borra esas filas a mano y volve a correr.');
    return;
  }
  if (!ancla) throw new Error('No encontre la fila "' + ANCLA_BMK + '". ' +
    'Cambio el P&L: revisar donde debe ir el bloque antes de insertarlo.');

  // Ventas netas del mes: se ubica por texto, misma razon que el ancla.
  var filaVentas = 0, filaSinFactura = 0;
  for (var j = 0; j < colA.length; j++) {
    var s = String(colA[j][0] || '');
    if (!filaVentas && s.indexOf('Ventas netas') === 0) filaVentas = j + 1;
    if (!filaSinFactura && s.indexOf('Marketing digital') === 0) filaSinFactura = j + 1;
  }
  if (!filaVentas || !filaSinFactura) {
    throw new Error('No encontre "Ventas netas" (' + filaVentas + ') o "Marketing digital" (' +
      filaSinFactura + ') en la columna A. Revisar el P&L antes de instalar.');
  }

  var N = 11;
  sh.insertRowsAfter(ancla, N);
  var f0 = ancla + 1;                 // primera fila del bloque (queda en blanco, de aire)

  var TC   = "'05_Tarjeta_Credito_BAC'";
  var anio = "'07_Reporte_Mensual'!$B$3";
  var mes  = "'07_Reporte_Mensual'!$D$3";
  // Q de la tarjeta (col C) + USD (col D) por el tipo de cambio. El filtro es la
  // DESCRIPCION, no la categoria: si alguien recategoriza un cargo, el medio
  // sigue contandose. "GOOGLE~*ADS*" busca el asterisco literal de GOOGLE*ADS.
  function medios(patron) {
    return '=SUMIFS(' + TC + '!C5:C2000,' + TC + '!G5:G2000,' + anio + ',' + TC + '!H5:H2000,' + mes + ',' +
           TC + '!B5:B2000,"' + patron + '")' +
           '+SUMIFS(' + TC + '!D5:D2000,' + TC + '!G5:G2000,' + anio + ',' + TC + '!H5:H2000,' + mes + ',' +
           TC + '!B5:B2000,"' + patron + '")*' + USD_BMK;
  }
  // Gestion pagada con TARJETA. Vanessa cobra por transferencia, pero cuando el
  // banco falla se le paga por PayPal con la tarjeta (agosto 2026). Se toma todo
  // lo que en la tarjeta esta como MARKETING_DIGITAL y se le restan los medios,
  // que ya van arriba. Lo que sobra es gestion, contenido o herramientas.
  // Las tres partes se filtran por la MISMA categoria, asi que la resta nunca
  // puede dar negativo: cada pedazo que se resta es un subconjunto del total.
  function tarjetaCat(patron) {
    var extra = patron ? ',' + TC + '!B5:B2000,"' + patron + '"' : '';
    return 'SUMIFS(' + TC + '!C5:C2000,' + TC + '!G5:G2000,' + anio + ',' + TC + '!H5:H2000,' + mes + ',' +
           TC + '!E5:E2000,"MARKETING_DIGITAL"' + extra + ')' +
           '+SUMIFS(' + TC + '!D5:D2000,' + TC + '!G5:G2000,' + anio + ',' + TC + '!H5:H2000,' + mes + ',' +
           TC + '!E5:E2000,"MARKETING_DIGITAL"' + extra + ')*' + USD_BMK;
  }
  var gestionTarjeta = tarjetaCat('') + '-(' + tarjetaCat('FACEBK*') + ')-(' + tarjetaCat('GOOGLE~*ADS*') + ')';

  var felEdwin = "=SUMIFS('01_FEL_Maestro'!J5:J4000,'01_FEL_Maestro'!L5:L4000," + anio +
                 ",'01_FEL_Maestro'!P5:P4000," + mes + ",'01_FEL_Maestro'!E5:E4000,\"" + NIT_EDWIN + "\")";

  var rMeta = f0 + 3, rGoog = f0 + 4, rSubM = f0 + 5, rEdw = f0 + 6, rVan = f0 + 7, rTot = f0 + 8;
  var pct = function (r) { return '=IFERROR(B' + r + '/B' + filaVentas + ',"")'; };

  var filas = [
    ['', '', '', ''],
    [TITULO_BMK, '', '', ''],
    ['Concepto', 'Mes actual', '% ventas', 'Fuente'],
    ['   Medios · Meta Ads', medios('FACEBK*'), pct(rMeta), 'TC BAC · descripcion FACEBK'],
    ['   Medios · Google Ads', medios('GOOGLE~*ADS*'), pct(rGoog), 'TC BAC · descripcion GOOGLE*ADS (USD@' + USD_BMK + ')'],
    ['Subtotal MEDIOS', '=B' + rMeta + '+B' + rGoog, pct(rSubM), 'esto y solo esto es el denominador del ROAS'],
    ['   Gestion de pauta con factura', felEdwin, pct(rEdw), 'FEL NIT ' + NIT_EDWIN + ' · ya contada en Gastos op FEL'],
    ['   Gestion sin factura y herramientas', '=B' + filaSinFactura + '+' + gestionTarjeta, pct(rVan),
      'fila ' + filaSinFactura + ' (banco) + tarjeta MARKETING_DIGITAL sin medios'],
    ['TOTAL MARKETING', '=B' + rSubM + '+B' + rEdw + '+B' + rVan, pct(rTot), 'banda del sector: 4% a 8% de la venta'],
    ['Lectura',
     '=IFERROR(IF(B' + rTot + '=0,"sin gasto el mes",IF(C' + rTot + '<0.04,"por debajo de la banda",' +
     'IF(C' + rTot + '<=0.08,"dentro de la banda","por encima de la banda"))),"")',
     '', 'la banda mide el gasto TOTAL, gestion incluida'],
    ['', '', '', 'Informativo: los tres componentes ya estan en el resultado operativo. NO sumar este bloque a nada.']
  ];
  sh.getRange(f0, 1, N, 4).setValues(filas);

  // Formato minimo, al estilo del resto de la hoja.
  sh.getRange(f0 + 1, 1, 1, 4).setFontWeight('bold');
  sh.getRange(f0 + 2, 1, 1, 4).setFontWeight('bold');
  sh.getRange(rSubM, 1, 1, 4).setFontWeight('bold');
  sh.getRange(rTot, 1, 1, 4).setFontWeight('bold');
  sh.getRange(f0 + 3, 2, 6, 1).setNumberFormat('#,##0.00');
  sh.getRange(f0 + 3, 3, 6, 1).setNumberFormat('0.0%');

  Logger.log('Bloque MARKETING instalado en las filas ' + f0 + ' a ' + (f0 + N - 1) + '.');
  Logger.log('Ventas netas leidas de la fila ' + filaVentas + '; gestion sin factura de la fila ' + filaSinFactura + '.');
  Logger.log('Revisar en pantalla que el Subtotal MEDIOS cuadre con el ROAS de la intranet.');
  verificarBloqueMarketing();
}

/** Lee el bloque ya instalado y lo escribe en el Log, para revisarlo sin
 *  tener que ir a la hoja. Sirve tambien como chequeo de cierre de mes. */
function verificarBloqueMarketing() {
  var sh = SpreadsheetApp.openById(SHEET_ID_BMK).getSheetByName(HOJA_BMK);
  var datos = sh.getDataRange().getValues(), f0 = 0;
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0] || '').indexOf('BLOQUE MARKETING') === 0) { f0 = i; break; }
  }
  if (!f0) { Logger.log('El bloque no esta instalado.'); return; }
  Logger.log('--- Bloque MARKETING, mes en el selector de 07_Reporte_Mensual ---');
  for (var r = f0 + 2; r < Math.min(f0 + 9, datos.length); r++) {
    var etq = String(datos[r][0] || '').trim();
    if (!etq) continue;
    var val = datos[r][1], p = datos[r][2];
    Logger.log('  ' + etq + '  =  ' + (typeof val === 'number' ? 'Q' + val.toFixed(2) : val) +
      (typeof p === 'number' ? '   (' + (p * 100).toFixed(1) + '% de la venta)' : ''));
  }
}
