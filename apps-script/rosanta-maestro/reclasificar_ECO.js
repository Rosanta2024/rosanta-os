// ============================================================
// ROSANTA - Grupo ECO: el alquiler de la maquina de agua sale de BEBIDAS
// 4 sep 2026
//
// QUE ES. Grupo ECO factura el alquiler de la maquina de agua: contrato mensual
// fijo, Q1,467.14 hasta marzo y Q1,250.00 desde abril, cuando se negocio a la
// baja. Estaba categorizado como BEBIDAS, o sea dentro del COGS.
//
// POR QUE SE MUEVE. El food cost mide lo que se compra para vender y sirve
// porque se mueve con la venta. Un alquiler fijo metido ahi hace dos daños:
// infla el food cost casi un punto y sugiere que se puede bajar comprando
// mejor. No se puede: es un contrato. Ademas entierra el ahorro de la
// renegociacion (Q217 al mes, Q2,600 al año) entre la variacion normal de la
// compra de barra, donde no se ve.
//
// A DONDE VA. ALQUILER_EQUIPO, bloque "Tarifas y servicios" —junto al gas, la
// luz y el internet, que es donde vive el suministro— y marcado como costo
// FIJO, que corrige tambien la estructura fijo/variable del DRE.
//
// EFECTO: el COGS del año baja de 38.5 a 37.6 por ciento de la venta. El
// resultado no cambia: el gasto no desaparece, cambia de bloque.
//
// LAS DOS PUNTAS. Se reclasifican las 8 facturas FEL y los 5 pagos del banco.
// ALQUILER_EQUIPO quedo en SOLO_FEL / FIN_SOLO_FEL en las dos capas de calculo,
// asi que el pago del banco se salta y no hay doble conteo — misma logica que
// el gas. Si se corriera este lote sin ese cambio, se contaria dos veces.
//
// USO: correr "revisarECO" (no escribe) y despues "aplicarECO".
//      Al terminar, generarEspejo().
// ============================================================

var ECO_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

var ECO_LIBROS = {
  FEL:   { hoja: '01_FEL_Maestro',      llave: 4, fecha: 1, monto: 10, cat: 14 },
  BANCO: { hoja: '03_Banco_Industrial', llave: 2, fecha: 1, monto: 4,  cat: 7  }
};

// [llave, fecha, monto, categoria nueva, Es_Personal, categoria esperada]
var ECO_FEL = [
  ['2910076995','2026-01-01',1467.14,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['3120057295','2026-02-01',1467.14,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['2406697850','2026-03-01',1467.14,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['2602517916','2026-04-22',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['2727823773','2026-05-01',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['1909670834','2026-06-01',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['2027570495','2026-07-01',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],
  ['3101313319','2026-08-01',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],
];
var ECO_BANCO = [
  ['203052','2026-03-02',2934.28,'ALQUILER_EQUIPO','','BEBIDAS'],   // ECO enero febrero
  ['169178','2026-05-14',2500.00,'ALQUILER_EQUIPO','','BEBIDAS'],   // Grupo ECO Abril Mayo 26
  ['ND','2026-06-30',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],   // ECO Junio 2026
  ['173858','2026-07-27',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],   // GrupoEcojulio2026
  ['221341','2026-08-07',1250.00,'ALQUILER_EQUIPO','','BEBIDAS'],   // S31AgostoECO
];

function _ecoFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _ecoNum(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function _ecoLlave(v) {
  if (typeof v === 'number' && v === Math.floor(v)) return String(v);
  return String(v === null || v === undefined ? '' : v).trim();
}

function _ecoCorrer(escribir) {
  var ss = SpreadsheetApp.openById(ECO_SHEET_ID);
  var lotes = { FEL: ECO_FEL, BANCO: ECO_BANCO };
  var total = 0, yaEstaban = 0, avisos = [], suma = 0;

  for (var k in lotes) {
    var cfg = ECO_LIBROS[k], lote = lotes[k];
    var sh = ss.getSheetByName(cfg.hoja);
    if (!sh) { avisos.push('No existe la hoja ' + cfg.hoja); continue; }
    var datos = sh.getDataRange().getValues();

    for (var i = 0; i < lote.length; i++) {
      var it = lote[i], hallada = false;
      for (var r = 0; r < datos.length; r++) {
        if (_ecoLlave(datos[r][cfg.llave - 1]) !== it[0]) continue;
        if (_ecoFecha(datos[r][cfg.fecha - 1]) !== it[1]) continue;
        if (Math.abs(_ecoNum(datos[r][cfg.monto - 1]) - it[2]) > 0.01) continue;
        hallada = true;
        var actual = datos[r][cfg.cat - 1];
        if (actual === it[3]) { yaEstaban++; break; }
        if (actual !== it[5]) {
          avisos.push('OJO ' + k + ' ' + it[1] + ' ' + it[0] + ' Q' + it[2] +
                      ' dice "' + actual + '" y se esperaba "' + it[5] + '". No se toca.');
          break;
        }
        if (escribir) sh.getRange(r + 1, cfg.cat).setValue(it[3]);
        total++; suma += it[2];
        break;
      }
      if (!hallada) avisos.push('Sin coincidencia ' + k + ': ' + it[1] + ' ' + it[0] + ' Q' + it[2]);
    }
  }

  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(total + ' filas a ALQUILER_EQUIPO por Q' + suma.toFixed(2) +
             '  (ya estaban bien: ' + yaEstaban + ')');
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos: todas las filas se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. */
function revisarECO() { _ecoCorrer(false); }

/** Escribe las categorias. */
function aplicarECO() { _ecoCorrer(true); }
