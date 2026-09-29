// ============================================================
// ROSANTA - Clasificacion, correccion y reparacion del maestro  (v2)
//
// CAMBIO IMPORTANTE respecto a la version anterior: ya NO usa numeros
// de fila. Busca cada movimiento por su CONTENIDO (fecha + descripcion
// + debito + credito). Asi funciona aunque ordenes o filtres las hojas,
// que fue justo lo que paso el 1 sep 2026 y habria hecho que la version
// vieja escribiera en filas equivocadas.
//
// BLOQUE 1 PLAN        : filas en POR_CLASIFICAR
// BLOQUE 2 CORRECCIONES: categoria equivocada arrastrada desde febrero
//                        (IGSS y pauta de Vanessa como COMISIONES_BANCARIAS)
// BLOQUE 3 REPARACION  : el ACH de mayo, con los datos mal cargados
// BLOQUE 4 PROVEEDORES : alta de DELUXE en el catalogo
//
// Si una firma aparece varias veces (por ejemplo los tres pagos iguales
// a Danna's Store el mismo dia), aplica a todas las coincidencias que
// sigan en POR_CLASIFICAR. Lo que no coincide se reporta y no se toca.
// Se puede correr dos veces sin dano.
//
// USO: Files > + > Script, pegar, guardar, correr "aplicarClasificaciones".
// ============================================================

var SHEET_ID_CLAS = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// hoja -> [colFecha, colDesc, colDebito, colCredito, colCategoria, colPersonal]
var MAPA = {
  '01_FEL_Maestro':        [1, 7, 10, 0, 14, 15],
  '03_Banco_Industrial':   [1, 3,  4, 5,  7,  8],
  '04_Banco_BAC':          [1, 4,  5, 6,  8,  9],
  '05_Tarjeta_Credito_BAC':[1, 2,  3, 4,  5,  6]
};

// [hoja, fecha, descripcion, debito, credito, categoria, esPersonal]
var PLAN = [
  ['01_FEL_Maestro', '2026-08-10', 'PARAISO', 175.0, 0.0, 'PERSONAL', 'Si'],
  ['01_FEL_Maestro', '2026-07-29', 'DELUXE', 3625.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-02-23', 'MUNI ANTIGUA GUATEMALA GT', 20.0, 0.0, 'IMPUESTOS', 'No'],
  ['03_Banco_Industrial', '2026-05-25', 'S12 Hartman', 753.19, 0.0, 'ALIMENTOS', 'No'],
  ['03_Banco_Industrial', '2026-05-26', 'FARMACIA GALENO 146  GT', 26.1, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-04', 'DOMINOS 14018 ANTIGUA  GT', 250.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-04', 'DISTRIBUIDORA DE LICOR GT', 307.1, 0.0, 'BEBIDAS', 'No'],
  ['03_Banco_Industrial', '2026-05-04', 'DOLLARCITY ANTIGUA GUA GT', 48.0, 0.0, 'PAPELERIA_Y_UTILES', 'No'],
  ['03_Banco_Industrial', '2026-05-05', 'S10 2 onzas VARIOS', 1333.5, 0.0, 'COCTELERIA', 'No'],
  ['03_Banco_Industrial', '2026-05-05', 'S10 Tavito 2899067886', 350.0, 0.0, 'NOMINA', 'No'],
  ['03_Banco_Industrial', '2026-05-05', 'S10 Barra Varios', 678.55, 0.0, 'BEBIDAS', 'No'],
  ['03_Banco_Industrial', '2026-05-07', 'Lavanderia Varios', 645.0, 0.0, 'SERVICIOS_PROFESIONALES', 'No'],
  ['03_Banco_Industrial', '2026-05-08', 'Propina Abril', 1153.0, 0.0, 'PROPINAS_PASSTHROUGH', 'No'],
  ['03_Banco_Industrial', '2026-05-11', 'PARMA VEL  GT', 758.75, 0.0, 'ALIMENTOS', 'No'],
  ['03_Banco_Industrial', '2026-05-11', 'DISTRIBUIDORA DE LICOR GT', 222.0, 0.0, 'BEBIDAS', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'PAGOS DE IMPUESTOS DECLARAGUATE', 11000.0, 0.0, 'IMPUESTOS', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'S18 Toni', 500.0, 0.0, 'NOMINA', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'Marketing Mayo26', 2000.0, 0.0, 'MARKETING_DIGITAL', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'PAGO ELECTRONICO BCA.TOTAL', 2003.89, 0.0, 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'DISTRIBUIDORA DE LICOR GT', 301.0, 0.0, 'BEBIDAS', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'EX Security Mayo26', 250.0, 0.0, 'SERVICIO DE MONITOREO Y ALARMA', 'No'],
  ['03_Banco_Industrial', '2026-05-14', 'BANCA ELECTRONICA', 1590.8, 0.0, 'SERVICIOS_PROFESIONALES', 'No'],
  ['03_Banco_Industrial', '2026-05-15', 'A-PASEO ANTIGUA', 2000.0, 0.0, 'ALIMENTOS_EFECTIVO', 'No'],
  ['03_Banco_Industrial', '2026-05-18', 'Evento Marketing', 220.0, 0.0, 'MARKETING_DIGITAL', 'No'],
  ['03_Banco_Industrial', '2026-05-18', '1a Mayo Jose', 2500.0, 0.0, 'NOMINA', 'No'],
  ['03_Banco_Industrial', '2026-05-18', '1a Mayo Nadia', 2000.0, 0.0, 'NOMINA', 'No'],
  ['03_Banco_Industrial', '2026-05-18', '1a Mayo Jeffry', 2500.0, 0.0, 'NOMINA', 'No'],
  ['03_Banco_Industrial', '2026-05-18', 'CASA FELIZ  GT', 99.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-18', 'CASA FELIZ  GT', 99.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-18', 'CASA FELIZ  GT', 99.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-18', 'CASA FELIZ  GT', 44.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-18', 'CASA FELIZ  GT', 99.0, 0.0, 'PERSONAL', 'Si'],
  ['03_Banco_Industrial', '2026-05-20', 'Evento  Marketing', 1500.0, 0.0, 'MARKETING_DIGITAL', 'No'],
  ['03_Banco_Industrial', '2026-06-30', 'A-PASEO ANTIGUA', 2000.0, 0.0, 'ALIMENTOS_EFECTIVO', 'No'],
  ['03_Banco_Industrial', '2026-08-07', 'S31Individuales', 2700.0, 0.0, 'MANTENIMIENTO Y ACCESORIOS EQUIPO', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-05-18', 'INTELAF ANTIGUA LA ANTIGUA', 101.0, 0.0, 'MANTENIMIENTO Y ACCESORIOS EQUIPO', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-05-18', 'INTELAF ANTIGUA LA ANTIGUA', 21.0, 0.0, 'MANTENIMIENTO Y ACCESORIOS EQUIPO', 'No'],
  ['05_Tarjeta_Credito_BAC', '2026-07-10', 'Retiro de Efec.FARMACIAS BATRE', 100.0, 0.0, 'PERSONAL', 'Si'],
  ['05_Tarjeta_Credito_BAC', '2026-07-21', 'PLAYBOOK TECHNOLOGIES PLAYBOOKAPP', 0.0, 29.99, 'CUOTAS_Y_SUSCRIPCIONES', 'No'],
];

// [hoja, fecha, descripcion, debito, credito, categoriaEsperada, categoriaNueva, esPersonal]
// Incluye el A-PASEO ANTIGUA del 15/05: es un retiro de efectivo para compras
// de mercado, o sea ALIMENTOS_EFECTIVO, no ALIMENTOS. La distincion importa:
// ALIMENTOS entra al COGS facturado y ALIMENTOS_EFECTIVO va aparte.
var CORRECCIONES = [
  ['03_Banco_Industrial', '2026-02-18', 'PAGO ELECTRONICO BCA.TOTAL', 1987.91, 0.0, 'COMISIONES_BANCARIAS', 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-03-16', 'PAGO ELECTRONICO BCA.TOTAL', 1987.91, 0.0, 'COMISIONES_BANCARIAS', 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-04-18', 'PAGO ELECTRONICO BCA.TOTAL', 2003.89, 0.0, 'COMISIONES_BANCARIAS', 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-07-20', 'PAGOELECTRONICOBCA.TOTAL', 2003.89, 0.0, 'COMISIONES_BANCARIAS', 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-08-20', 'PAGOELECTRONICOBCA.TOTAL', 2003.89, 0.0, 'COMISIONES_BANCARIAS', 'IGSS', 'No'],
  ['03_Banco_Industrial', '2026-04-17', 'BANCA ELECTRONICA', 1791.7, 0.0, 'COMISIONES_BANCARIAS', 'SERVICIOS_PROFESIONALES', 'No'],
  ['03_Banco_Industrial', '2026-06-23', 'BANCA ELECTRONICA', 1592.85, 0.0, 'COMISIONES_BANCARIAS', 'SERVICIOS_PROFESIONALES', 'No'],
  ['03_Banco_Industrial', '2026-07-20', 'BANCAELECTRONICA', 1592.85, 0.0, 'COMISIONES_BANCARIAS', 'SERVICIOS_PROFESIONALES', 'No'],
  ['03_Banco_Industrial', '2026-05-15', 'A-PASEO ANTIGUA', 2000.0, 0.0, 'ALIMENTOS', 'ALIMENTOS_EFECTIVO', 'No'],
];

// El estado de cuenta del 16/05/2026 dice:
//   ACH CORSAGA, SOCIEDAD AN A | documento 86055 | credito 3,200.00
// El maestro guardo "SOCIEDAD AN A" como documento y 86,055 (que es el
// numero de documento) como DEBITO. Resultado: Q86,055 de gasto que nunca
// existio y Q3,200 de ingreso faltante. La contraparte esta en el BAC,
// mismo dia, mismo monto, con su comision de Q5 al lado.
var REPARACION = {
  hoja: '03_Banco_Industrial',
  buscar: ['2026-05-16', 'ACH CORSAGA', 86055.0, 0.0],
  escribir: [[2,'86055'], [3,'ACH CORSAGA, SOCIEDAD AN A'], [4,0], [5,3200],
             [7,'INGRESO_TRANSFERENCIA'], [8,'No']]
};

var PROVEEDORES_NUEVOS = [
  ['DELUXE', 'Personal', 'PERSONAL', 'Si',
   'Universo Optico S.A. NIT 83628797 - definido como personal por Juanma, 1 sep 2026']
];

function _fecha(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}
function _num(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

/** Devuelve los numeros de fila cuya firma coincide. */
function _buscar(sh, cols, fecha, desc, deb, cred) {
  var datos = sh.getDataRange().getValues();
  var hit = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    if (_fecha(fila[cols[0] - 1]) !== fecha) continue;
    if (String(fila[cols[1] - 1] || '').trim() !== desc) continue;
    if (Math.abs(_num(fila[cols[2] - 1]) - deb) > 0.01) continue;
    if (cols[3] && Math.abs(_num(fila[cols[3] - 1]) - cred) > 0.01) continue;
    hit.push(i + 1);
  }
  return hit;
}

function aplicarClasificaciones() {
  var ss = SpreadsheetApp.openById(SHEET_ID_CLAS);
  var escritas = 0, corregidas = 0, reparadas = 0, altas = 0, avisos = [];

  for (var i = 0; i < PLAN.length; i++) {
    var p = PLAN[i], cols = MAPA[p[0]], sh = ss.getSheetByName(p[0]);
    if (!sh) { avisos.push('No existe la hoja ' + p[0]); continue; }
    var filas = _buscar(sh, cols, p[1], p[2], p[3], p[4]);
    if (!filas.length) { avisos.push('No encontre: ' + p[0] + ' ' + p[1] + ' ' + p[2]); continue; }
    var aplicado = 0;
    for (var j = 0; j < filas.length; j++) {
      if (sh.getRange(filas[j], cols[4]).getValue() !== 'POR_CLASIFICAR') continue;
      sh.getRange(filas[j], cols[4]).setValue(p[5]);
      sh.getRange(filas[j], cols[5]).setValue(p[6]);
      escritas++; aplicado++;
    }
    if (!aplicado) avisos.push('Ya estaba resuelta: ' + p[0] + ' ' + p[1] + ' ' + p[2]);
  }

  for (var k = 0; k < CORRECCIONES.length; k++) {
    var c = CORRECCIONES[k], cols2 = MAPA[c[0]], sh2 = ss.getSheetByName(c[0]);
    if (!sh2) { avisos.push('No existe la hoja ' + c[0]); continue; }
    var f2 = _buscar(sh2, cols2, c[1], c[2], c[3], c[4]);
    if (!f2.length) { avisos.push('No encontre (correccion): ' + c[1] + ' ' + c[2]); continue; }
    for (var m = 0; m < f2.length; m++) {
      if (sh2.getRange(f2[m], cols2[4]).getValue() !== c[5]) {
        avisos.push('f' + f2[m] + ' esperaba "' + c[5] + '" y decia "' +
                    sh2.getRange(f2[m], cols2[4]).getValue() + '"');
        continue;
      }
      sh2.getRange(f2[m], cols2[4]).setValue(c[6]);
      sh2.getRange(f2[m], cols2[5]).setValue(c[7]);
      corregidas++;
    }
  }

  var shr = ss.getSheetByName(REPARACION.hoja), colsr = MAPA[REPARACION.hoja];
  if (shr) {
    var b = REPARACION.buscar;
    var fr = _buscar(shr, colsr, b[0], b[1], b[2], b[3]);
    if (!fr.length) {
      avisos.push('No encontre la fila a reparar (quiza ya se reparo)');
    } else {
      for (var q = 0; q < fr.length; q++) {
        for (var w = 0; w < REPARACION.escribir.length; w++) {
          shr.getRange(fr[q], REPARACION.escribir[w][0]).setValue(REPARACION.escribir[w][1]);
        }
        reparadas++;
      }
    }
  }

  var shp = ss.getSheetByName('00_Proveedores');
  if (shp) {
    var ex = shp.getRange(1, 1, shp.getLastRow(), 1).getValues();
    for (var z = 0; z < PROVEEDORES_NUEVOS.length; z++) {
      var nom = PROVEEDORES_NUEVOS[z][0], ya = false;
      for (var e = 0; e < ex.length; e++) if (String(ex[e][0]).trim() === nom) { ya = true; break; }
      if (ya) { avisos.push('Proveedor "' + nom + '" ya estaba'); continue; }
      shp.getRange(shp.getLastRow() + 1, 1, 1, 5).setValues([PROVEEDORES_NUEVOS[z]]);
      altas++;
    }
  }

  Logger.log('Clasificadas: ' + escritas + ' | Corregidas: ' + corregidas +
             ' | Reparadas: ' + reparadas + ' | Proveedores: ' + altas);
  if (avisos.length) {
    Logger.log('Avisos (' + avisos.length + '):');
    for (var y = 0; y < avisos.length; y++) Logger.log('  ' + avisos[y]);
  } else {
    Logger.log('Sin avisos.');
  }
}

function contarPendientes() {
  var ss = SpreadsheetApp.openById(SHEET_ID_CLAS);
  var total = 0;
  for (var h in MAPA) {
    var sh = ss.getSheetByName(h);
    if (!sh) continue;
    var col = sh.getRange(1, MAPA[h][4], sh.getLastRow(), 1).getValues();
    var n = 0, filas = [];
    for (var r = 0; r < col.length; r++) {
      if (col[r][0] === 'POR_CLASIFICAR') { n++; filas.push(r + 1); }
    }
    Logger.log(h + ': ' + n + (n ? '  filas ' + filas.join(', ') : ''));
    total += n;
  }
  Logger.log('TOTAL pendientes: ' + total);
}