// ============================================================
// ROSANTA - Duplicados de 00_Proveedores y las filas que quedaron mal
// 4 sep 2026
//
// QUE PASO. La lista de proveedores tiene 339 nombres y 26 estan repetidos.
// En seis de esos, las dos filas dicen categorias distintas. Como la categoria
// se asigna con un VLOOKUP, que devuelve la PRIMERA coincidencia, la fila de
// abajo nunca se aplica.
//
// El patron delata como paso: las filas correctoras estan todas en el bloque
// 317-324, agregadas de golpe al final. Alguien corrigio esas categorias
// AGREGANDO filas nuevas en vez de editar las originales, y ninguna surtio
// efecto. En cinco de los seis, la que gana dice SERVICIOS PROFESIONALES.
//
// QUE ARREGLA. Deja UNA sola categoria por proveedor: escribe la correcta en
// las DOS filas, la que gana y la duplicada. Asi no hay que borrar filas —
// borrar mueve todo lo de abajo y el VLOOKUP apunta a un rango— y da igual
// cual encuentre primero.
//
// LAS SEIS, con lo que Juanma confirmo el 4-sep:
//   Sistemas Logisticos  -> MANTENIMIENTO Y ACCESORIOS EQUIPO   Q13,999.02
//   DHL                  -> GASTOS_ADMINISTRATIVOS              Q 2,218.01
//   Talishte             -> EVENTOS                             Q 1,500.00
//   Solutecnic-Pro       -> MANTENIMIENTO Y ACCESORIOS EQUIPO   Q   200.00
//   Lavanderia Candelaria-> SUMINISTRO DE LIMPIEZA              Q   147.00
//   Distrib. Agricola El Panorama -> MATERIALES                 Q    90.00
//
// OJO CON "EL PANORAMA". Hay cuatro proveedores distintos con ese nombre:
// la Distribuidora Agricola, la Estacion de Servicio, la Farmacia Fenix y el
// Supermarket. Solo la Distribuidora Agricola es materiales. Buscar por
// "PANORAMA" a secas arrastra los otros tres, que estan bien como estan.
//
// NO CAMBIA EL RESULTADO, cambia de bloque: son Q18,154.03 que hoy inflan
// Prestadores y honorarios, que va en 7.6 por ciento contra una banda de 1 a 3.
//
// USO: correr "revisarDup" (no escribe) y despues "aplicarDup".
//      Al terminar, generarEspejo().
// ============================================================

var DUP_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// 00_Proveedores: 1 Proveedor · 3 Categoria_Normalizada
// [proveedor, categoria nueva, categoria esperada hoy]
var DUP_PROV = [
  ['DHL','GASTOS_ADMINISTRATIVOS','SERVICIOS PROFESIONALES'],
  ['DISTRIBUIDORA AGRICOLA EL PANORAMA','MATERIALES','SUMINISTRO DE LIMPIEZA'],
  ['LAVANDERÍA LA CANDELARIA','SUMINISTRO DE LIMPIEZA','SERVICIOS PROFESIONALES'],
  ['SISTEMAS LOGISTICOS Y CORPORATIVOS','MANTENIMIENTO Y ACCESORIOS EQUIPO','SERVICIOS PROFESIONALES'],
  ['SOLUTECNIC-PRO','MANTENIMIENTO Y ACCESORIOS EQUIPO','SERVICIOS PROFESIONALES'],
  ['TALISHTE PRODUCCIONES','EVENTOS','SERVICIOS PROFESIONALES'],
  ['TALISHTE PRODUCCIONES','EVENTOS','MARKETING_DIGITAL'],
  ['DISTRIBUIDORA AGRICOLA EL PANORAMA','MATERIALES','ALIMENTOS'],
];

// 01_FEL_Maestro: 1 Fecha · 4 Numero_DTE · 10 Gran_Total · 14 Categoria
// [numero DTE, fecha, monto, categoria nueva, categoria esperada hoy]
var DUP_FEL = [
  ['2344307523','2026-01-03',147.00,'SUMINISTRO DE LIMPIEZA','SERVICIOS PROFESIONALES'],   // JOSÉ JAVIER , ASTURIAS MOR
  ['1132020437','2026-03-12',90.00,'MATERIALES','SUMINISTRO DE LIMPIEZA'],   // DERVIN AUGUSTO , HERNANDEZ
  ['1816412533','2026-03-14',13999.00,'MANTENIMIENTO Y ACCESORIOS EQUIPO','SERVICIOS PROFESIONALES'],   // SISTEMAS LOGISTICOS Y CORP
  ['2126794355','2026-03-14',0.02,'MANTENIMIENTO Y ACCESORIOS EQUIPO','SERVICIOS PROFESIONALES'],   // SISTEMAS LOGISTICOS Y CORP
  ['738282832','2026-04-13',2218.01,'GASTOS_ADMINISTRATIVOS','SERVICIOS PROFESIONALES'],   // DHL, SOCIEDAD ANONIMA
  ['2187215247','2026-04-17',1500.00,'EVENTOS','SERVICIOS PROFESIONALES'],   // TALISHTE PRODUCCIONES, SOC
  ['1102595603','2026-06-17',200.00,'MANTENIMIENTO Y ACCESORIOS EQUIPO','SERVICIOS PROFESIONALES'],   // DANIEL EDUARDO , GARCIA MO
];

function _dupFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _dupLlave(v) {
  if (typeof v === 'number' && v === Math.floor(v)) return String(v);
  return String(v === null || v === undefined ? '' : v).trim();
}
function _dupNum(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _dupCorrer(escribir) {
  var ss = SpreadsheetApp.openById(DUP_SHEET_ID);
  var avisos = [], nProv = 0, nFel = 0, suma = 0;

  var sp = ss.getSheetByName('00_Proveedores');
  var dp = sp.getDataRange().getValues();
  for (var i = 0; i < DUP_PROV.length; i++) {
    var it = DUP_PROV[i], ok = false;
    for (var r = 0; r < dp.length; r++) {
      if (String(dp[r][0] || '').trim() !== it[0]) continue;
      var actual = String(dp[r][2] || '').trim();
      if (actual === it[1]) { ok = true; break; }
      if (actual !== it[2]) continue;
      if (escribir) sp.getRange(r + 1, 3).setValue(it[1]);
      nProv++; ok = true; break;
    }
    if (!ok) avisos.push('Sin coincidencia en proveedores: ' + it[0] + ' (esperaba "' + it[2] + '")');
  }

  var sf = ss.getSheetByName('01_FEL_Maestro');
  var df = sf.getDataRange().getValues();
  for (var j = 0; j < DUP_FEL.length; j++) {
    var f = DUP_FEL[j], hallada = false;
    for (var q = 0; q < df.length; q++) {
      if (_dupLlave(df[q][3]) !== f[0]) continue;
      if (_dupFecha(df[q][0]) !== f[1]) continue;
      if (Math.abs(_dupNum(df[q][9]) - f[2]) > 0.01) continue;
      hallada = true;
      var act = String(df[q][13] || '').trim();
      if (act === f[3]) break;
      if (act !== f[4]) {
        avisos.push('OJO FEL ' + f[1] + ' DTE ' + f[0] + ' dice "' + act + '" y se esperaba "' + f[4] + '"');
        break;
      }
      if (escribir) sf.getRange(q + 1, 14).setValue(f[3]);
      nFel++; suma += f[2];
      break;
    }
    if (!hallada) avisos.push('Sin coincidencia en FEL: DTE ' + f[0] + ' ' + f[1] + ' Q' + f[2]);
  }

  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(nProv + ' de ' + DUP_PROV.length + ' filas de 00_Proveedores');
  Logger.log(nFel + ' de ' + DUP_FEL.length + ' filas de FEL  ·  Q' + suma.toFixed(2) + ' cambian de bloque');
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos: todas las filas se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. */
function revisarDup() { _dupCorrer(false); }

/** Escribe. */
function aplicarDup() { _dupCorrer(true); }
