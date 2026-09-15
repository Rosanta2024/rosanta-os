// ============================================================
// ROSANTA - Seis pagos de mercado sin factura (p121)
// Generado el 15 sep 2026 desde el espejo del 14-sep 22:11.
//
// QUE ARREGLA
// Q6,605 de compra de mercado en efectivo que estan como ALIMENTOS en
// 03_Banco_Industrial. La regla 3 salta la mercaderia pagada desde el banco
// porque asume que la factura ya entro por FEL, pero de estas no hay factura:
// se estaban borrando del food cost. Pasan a ALIMENTOS_EFECTIVO, que es el
// bucket de alimentos SIN FACTURA y si entra al COGS.
//
// OJO AL LEER EL DRE DESPUES: son de julio y agosto, los dos meses con el food
// cost mas alto del año. El food cost de esos meses SUBE. Es peor cifra y mejor
// dato.
//
// LO QUE NO ENTRA, verificado el 15-sep-2026 por NIT y por establecimiento:
//   · COMESA: ya tiene sus 7 facturas por Q3,628, igual a lo pagado.
//   · Vinos de Altura: factura como VIÑEDOS DE ALTURA / ENTREVINOS (NIT
//     74382489), y los tres pagos casan con sus DTE. No hay que mover nada.
//   · La Torre Q67.24 del 12/03: tiene factura (DTE 179719553 del 11/03).
//   · Elder: queda para decidir con Juanma, no va en este lote.
//
// COMO FUNCIONA
// Busca cada fila por Docto y verifica FECHA + DESCRIPCION + DEBITO, nunca por
// numero de fila. Solo escribe si la categoria de hoy es la esperada. Se puede
// correr dos veces sin dano.
//
// COMO SE CORRE (editor del proyecto del maestro)
//   1. revisarMercadoEfectivo()     no escribe. Tiene que decir 6 filas y
//                                   "Sin avisos". Si no, parar y avisar.
//   2. reclasificarMercadoEfectivo()
//   3. generarEspejo()
// ============================================================

var SHEET_ID_ME = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// 03_Banco_Industrial: 1 Fecha · 2 Docto · 3 Descripcion · 4 Debito · 7 Categoria
// [Docto, fecha, descripcion, debito, categoria nueva, categoria ESPERADA hoy]
var LOTE_ME = [
  ['119650', '2026-07-24', 'S30MercadoVarios',      1241.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS'],
  ['188020', '2026-07-29', 'S30Mariscos3555282157',  912.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS'],
  ['217381', '2026-07-29', 'S30MercadoVerduras',     866.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS'],
  ['113235', '2026-08-03', 'S31mercado',            1281.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS'],
  ['223909', '2026-08-03', 'S31Mariscos',            805.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS'],
  ['210768', '2026-08-07', 'S31Mercado',            1500.00, 'ALIMENTOS_EFECTIVO', 'ALIMENTOS']
  // total Q6,605.00
];

function _meLlave(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _meFecha(d) {
  if (!(d instanceof Date)) return String(d || '').trim();
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}

function _meCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_ME);
  if (ss.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    Logger.log('NO SE HIZO NADA: el Sheet esta en ' + ss.getSpreadsheetTimeZone() +
               ' y el script en ' + Session.getScriptTimeZone() + '. Avisar antes de seguir.');
    return;
  }
  var sh = ss.getSheetByName('03_Banco_Industrial');
  var datos = sh.getDataRange().getValues();
  var avisos = [], hechas = 0, yaEstaban = 0, total = 0;

  LOTE_ME.forEach(function (it) {
    var filas = [];
    for (var r = 4; r < datos.length; r++) {
      if (_meLlave(datos[r][1]) === it[0]) filas.push(r);
    }
    if (!filas.length) { avisos.push('Sin coincidencia: Docto ' + it[0] + ' ' + it[1] + ' Q' + it[3]); return; }
    if (filas.length > 1) { avisos.push('DOCTO REPETIDO ' + it[0] + ' (' + filas.length + ' filas). No se toca.'); return; }
    var r = filas[0];
    var fHoja = _meFecha(datos[r][0]), dHoja = String(datos[r][2] || '').trim();
    var mHoja = Math.round(Number(datos[r][3]) * 100) / 100;
    if (fHoja !== it[1] || dHoja !== it[2] || Math.abs(mHoja - it[3]) > 0.01) {
      avisos.push('NO CUADRA Docto ' + it[0] + ' · la hoja dice ' + fHoja + ' "' + dHoja + '" Q' + mHoja +
                  ' · se esperaba ' + it[1] + ' "' + it[2] + '" Q' + it[3] + '. No se toca.');
      return;
    }
    var actual = String(datos[r][6] || '').trim();
    if (actual === it[4]) { yaEstaban++; return; }
    if (actual !== it[5]) {
      avisos.push('OJO Docto ' + it[0] + ' dice "' + actual + '" y se esperaba "' + it[5] + '". No se toca.');
      return;
    }
    if (escribir) sh.getRange(r + 1, 7).setValue(it[4]);
    hechas++;
    total += it[3];
  });

  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(hechas + ' filas por Q' + total.toFixed(2) + ' a ALIMENTOS_EFECTIVO');
  Logger.log('Ya estaban bien: ' + yaEstaban);
  if (avisos.length) {
    Logger.log('--- revisar ---');
    avisos.forEach(function (x) { Logger.log('   ' + x); });
  } else {
    Logger.log('Sin avisos: todas las filas del lote se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarMercadoEfectivo() { _meCorrer(false); }

/** Escribe ALIMENTOS_EFECTIVO en las seis filas. */
function reclasificarMercadoEfectivo() { _meCorrer(true); }
