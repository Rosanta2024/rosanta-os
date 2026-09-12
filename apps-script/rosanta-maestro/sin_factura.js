// ============================================================
// ROSANTA - Compras sin factura que se estaban borrando del COGS
// 4 sep 2026
//
// DE DONDE SALE. Se cruzaron los 289 pagos del banco que la capa de calculo
// salta por las reglas 3 y 7 (Q196,876.90) contra las 916 facturas FEL vigentes
// de 2026. Resultado: 243 pagos por Q140,559.42 SI tienen su factura y estan
// bien saltados. Los 28 de aqui, Q32,212.21, no la tienen.
//
// POR QUE IMPORTA. La regla 3 salta la mercaderia del Banco Industrial porque
// normalmente es el pago de una factura que ya vino por FEL. Cuando NO hay
// factura, ese gasto no se cuenta en ningun lado: ni por FEL porque no existe,
// ni por banco porque la regla lo salta. Es costo real que desaparece.
//
// QUIENES SON
//   - Elite: Q15,680 en 9 pagos. No tiene UNA SOLA factura en todo 2026.
//   - Mercado y proveedores informales: carniceria, mariscos, 2 Onzas, Mixokit,
//     Belca, La Bodegona. Compra de plaza, sin factura por naturaleza.
//
// A DONDE VAN. ALIMENTOS_EFECTIVO ya existe y no significa "pagado en efectivo"
// sino "alimentos SIN FACTURA": por eso si entra al COGS. Faltaban sus gemelas
// para barra, y se crean con este lote:
//     BEBIDAS_EFECTIVO  ·  COCTELERIA_EFECTIVO
// Las dos ya estan mapeadas en generar_finanzas.py y en FinanzasDatos.js de la
// intranet. Si se corre este lote SIN ese mapeo, el dinero se cae en silencio.
//
// LO QUE NO ESTA AQUI. Otros 18 pagos por Q24,105.27 son de proveedores que SI
// facturan: Cofradia, Elder, Xelac, ECO, Altogas. Ahi la factura probablemente
// existe y no se cargo al maestro, o son pagos parciales. Van en la lista
// 2026-09-04_Pagos_sin_factura_por_revisar.md, no en este lote, porque
// clasificarlos como sin factura taparia un problema de carga.
//
// Busca cada fila por su CONTENIDO (Docto + fecha + debito), nunca por numero
// de fila, y solo escribe si la categoria actual es la esperada. Se puede
// correr dos veces sin dano.
//
// USO: correr "revisarSinFactura" (no escribe) y despues "aplicarSinFactura".
//      Al terminar, generarEspejo().
// ============================================================

var SF_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var SF_HOJA = '03_Banco_Industrial';   // 1 Fecha · 2 Docto · 4 Debito · 7 Categoria

// [Docto, fecha, debito, categoria nueva, Es_Personal, categoria esperada hoy]
var LOTE_SF = [
  ['188577','2026-01-02',363.65,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // LA BODEGONA GT
  ['137751','2026-01-08',867.46,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S1 BELCA VARIOS
  ['225654','2026-01-08',1688.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S36 Elite 3216002293
  ['231273','2026-01-08',384.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S1 Fogliasana VARIOS
  ['229254','2026-01-22',909.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // INDUSTRIAS VSG NL GT
  ['145250','2026-01-26',600.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // LOS AMIGOS MIXOLOGOS GT
  ['144755','2026-03-02',2705.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S5 Elite Varios
  ['166030','2026-03-02',520.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // S5 Mixokit Varias
  ['171996','2026-03-13',2364.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S6 Elite 2845134344
  ['136210','2026-03-26',734.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S7 Elite Varias
  ['247478','2026-03-30',367.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // DISTRIBUIDORA DE LICOR GT
  ['233145','2026-04-10',1503.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // S13 2 Onzas VARIOS
  ['126936','2026-05-05',1333.50,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // S10 2 onzas VARIOS
  ['126945','2026-05-05',350.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S10 Blue Ice 2019116415
  ['116544','2026-05-29',734.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S12 Elite Varios
  ['116547','2026-05-29',666.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S12 Belca 1833321216
  ['177149','2026-06-11',2108.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S13 Elite 3202761289
  ['190574','2026-06-11',1583.50,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // 2 Onzas Varios
  ['140296','2026-06-22',1592.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S14 Elite Varios
  ['196827','2026-07-15',350.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // S14mixokitVarios
  ['210610','2026-07-15',1592.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S14EliteVarias
  ['188020','2026-07-29',912.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S30Mariscos3555282157
  ['202346','2026-07-29',690.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S30CarniceriaMercado
  ['223894','2026-08-03',1104.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S31Mercado
  ['243607','2026-08-03',2163.00,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S31ElitemarcasVarios
  ['210758','2026-08-07',1566.00,'ALIMENTOS_EFECTIVO','','ALIMENTOS'],   // S31CarneaJeffry
  ['222341','2026-08-12',1601.10,'BEBIDAS_EFECTIVO','','BEBIDAS'],   // S32VariosBarra
  ['136312','2026-08-24',862.00,'COCTELERIA_EFECTIVO','','COCTELERIA'],   // S342onzasVarios
];

function _sfFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _sfNum(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _sfCorrer(escribir) {
  var sh = SpreadsheetApp.openById(SF_SHEET_ID).getSheetByName(SF_HOJA);
  if (!sh) throw new Error('No existe la hoja ' + SF_HOJA);
  var datos = sh.getDataRange().getValues();
  var hechas = 0, yaEstaban = 0, avisos = [], porCat = {};

  for (var i = 0; i < LOTE_SF.length; i++) {
    var it = LOTE_SF[i], hallada = false;
    for (var r = 0; r < datos.length; r++) {
      if (String(datos[r][1] || '').trim() !== it[0]) continue;
      if (_sfFecha(datos[r][0]) !== it[1]) continue;
      if (Math.abs(_sfNum(datos[r][3]) - it[2]) > 0.01) continue;
      hallada = true;
      var actual = datos[r][6];
      if (actual === it[3]) { yaEstaban++; break; }
      if (actual !== it[5]) {
        avisos.push('OJO ' + it[1] + ' doc ' + it[0] + ' Q' + it[2] + ' dice "' + actual +
                    '" y se esperaba "' + it[5] + '". No se toca.');
        break;
      }
      if (escribir) sh.getRange(r + 1, 7).setValue(it[3]);
      hechas++;
      porCat[it[3]] = (porCat[it[3]] || 0) + it[2];
      break;
    }
    if (!hallada) avisos.push('Sin coincidencia: ' + it[1] + ' doc ' + it[0] + ' Q' + it[2]);
  }

  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(hechas + ' de ' + LOTE_SF.length + ' filas · ya estaban bien: ' + yaEstaban);
  for (var k in porCat) Logger.log('   ' + k + ': Q' + porCat[k].toFixed(2));
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos: todas las filas se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarSinFactura() { _sfCorrer(false); }

/** Escribe las categorias. */
function aplicarSinFactura() { _sfCorrer(true); }
