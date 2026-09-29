// ============================================================
// ROSANTA - REVERSA: 13 pagos que NO eran sin factura
// 4 sep 2026
//
// QUE PASO. El lote sin_factura.js movio 28 pagos del banco a las categorias
// SIN FACTURA porque el cruce contra 01_FEL_Maestro no les encontro factura.
// El cruce estaba mal hecho de dos formas:
//
//   1. Se busco solo por monto y fecha. Varias descripciones del banco traen el
//      NUMERO DE DTE escrito —"S6 Elite 2845134344" es el DTE 2845134344— y esa
//      llave no se uso. Era la buena.
//   2. Se concluyo que Elite no factura porque no aparece en FEL. Lo que pasa es
//      que sus facturas no estan CARGADAS en FEL. En COMPRAS_2026 tiene 33
//      registros con DTE.
//
// Resultado: 21 de los 28 pagos si tenian DTE. De esos, estos 13 tienen sus
// facturas YA CARGADAS en FEL, o sea que el gasto se estaba contando dos veces:
// una por la factura y otra por el pago del banco reclasificado. Son
// Q15,253.00 de COGS inflado.
//
// ESTA REVERSA los devuelve a su categoria original, donde la regla 3 los vuelve
// a saltar y el gasto queda contado una sola vez, por FEL.
//
// LO QUE NO SE REVIERTE AQUI
//   - 6 pagos por Q8,914.46 cuya factura EXISTE pero no esta cargada en FEL.
//     Se quedan como SIN FACTURA por ahora: al menos asi el costo se cuenta.
//     Cuando se carguen esas facturas hay que revertirlos tambien, o se
//     duplicaran igual que estos.
//   - 2 pagos por Q1,468.00 con parte de sus DTE cargados y parte no.
//   - 7 pagos por Q6,576.75 sin rastro de DTE en ningun lado. Esos si parecen
//     compra sin factura.
//
// USO: correr "revisarReversa" (no escribe) y despues "aplicarReversa".
//      Al terminar, generarEspejo().
// ============================================================

var RV_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var RV_HOJA = '03_Banco_Industrial';   // 1 Fecha · 2 Docto · 4 Debito · 7 Categoria

// [Docto, fecha, debito, categoria a devolver, Es_Personal, categoria actual]
var LOTE_RV = [
  ['231273','2026-01-08',384.00,'ALIMENTOS','','ALIMENTOS_EFECTIVO'],   // S1 Fogliasana VARIOS · DTE 1470842053
  ['166030','2026-03-02',520.00,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // S5 Mixokit Varias · DTE 4029304478/2979614421
  ['233145','2026-04-10',1503.00,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // S13 2 Onzas VARIOS · DTE 61884744/3632155325
  ['126936','2026-05-05',1333.50,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // S10 2 onzas VARIOS · DTE 2238795625/2227585602
  ['126945','2026-05-05',350.00,'BEBIDAS','','BEBIDAS_EFECTIVO'],   // S10 Blue Ice 2019116415 · DTE 2049920934/5456192
  ['177149','2026-06-11',2108.00,'BEBIDAS','','BEBIDAS_EFECTIVO'],   // S13 Elite 3202761289 · DTE 3202761289
  ['190574','2026-06-11',1583.50,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // 2 Onzas Varios · DTE 2868594956/1316765870
  ['140296','2026-06-22',1592.00,'BEBIDAS','','BEBIDAS_EFECTIVO'],   // S14 Elite Varios · DTE 4247602173/3849473842
  ['196827','2026-07-15',350.00,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // S14mixokitVarios · DTE 2049920934/5456192
  ['210610','2026-07-15',1592.00,'BEBIDAS','','BEBIDAS_EFECTIVO'],   // S14EliteVarias · DTE 4247602173/3849473842
  ['188020','2026-07-29',912.00,'ALIMENTOS','','ALIMENTOS_EFECTIVO'],   // S30Mariscos3555282157 · DTE 3555282157
  ['243607','2026-08-03',2163.00,'BEBIDAS','','BEBIDAS_EFECTIVO'],   // S31ElitemarcasVarios · DTE 496714202/2314879490
  ['136312','2026-08-24',862.00,'COCTELERIA','','COCTELERIA_EFECTIVO'],   // S342onzasVarios · DTE 918571270/2627226699
];

function _rvFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _rvNum(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _rvCorrer(escribir) {
  var sh = SpreadsheetApp.openById(RV_SHEET_ID).getSheetByName(RV_HOJA);
  var datos = sh.getDataRange().getValues();
  var hechas = 0, yaEstaban = 0, avisos = [], suma = 0;

  for (var i = 0; i < LOTE_RV.length; i++) {
    var it = LOTE_RV[i], hallada = false;
    for (var r = 0; r < datos.length; r++) {
      if (String(datos[r][1] || '').trim() !== it[0]) continue;
      if (_rvFecha(datos[r][0]) !== it[1]) continue;
      if (Math.abs(_rvNum(datos[r][3]) - it[2]) > 0.01) continue;
      hallada = true;
      var actual = datos[r][6];
      if (actual === it[3]) { yaEstaban++; break; }
      if (actual !== it[5]) {
        avisos.push('OJO ' + it[1] + ' doc ' + it[0] + ' Q' + it[2] + ' dice "' + actual +
                    '" y se esperaba "' + it[5] + '". No se toca.');
        break;
      }
      if (escribir) sh.getRange(r + 1, 7).setValue(it[3]);
      hechas++; suma += it[2];
      break;
    }
    if (!hallada) avisos.push('Sin coincidencia: ' + it[1] + ' doc ' + it[0] + ' Q' + it[2]);
  }

  Logger.log(escribir ? '=== REVERTIDAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(hechas + ' de ' + LOTE_RV.length + ' filas · Q' + suma.toFixed(2) +
             ' de COGS duplicado que sale  (ya estaban bien: ' + yaEstaban + ')');
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. */
function revisarReversa() { _rvCorrer(false); }

/** Devuelve las 13 filas a su categoria original. */
function aplicarReversa() { _rvCorrer(true); }
