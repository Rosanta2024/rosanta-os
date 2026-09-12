/**
 * ============================================================================
 * BORRAR TRES FILAS DE 00_Proveedores  ·  un solo uso, 6-sep-2026
 * ============================================================================
 *
 * Juanma reviso la lista el 4-sep y confirmo que sobran tres filas:
 *
 *   BELCA               duplicado de BELCA GUATEMALA, que es la que tiene el gasto
 *   COMESA..            duplicado de COMESA (el nombre trae dos puntos de mas)
 *   PAGO PROV. QTZ DEM  no es un proveedor: es la glosa de un movimiento bancario
 *
 * POR QUE ES SEGURO, Y COMO SE COMPRUEBA
 *
 * La columna Categoria de 01_FEL_Maestro es un VLOOKUP contra esta lista. Borrar
 * un proveedor que SI aparece en alguna factura la dejaria sin categoria, y esa
 * factura se caeria del calculo en silencio.
 *
 * Por eso este script NO borra por nombre a ciegas: cuenta primero cuantas veces
 * aparece cada candidato en la columna Establecimiento del FEL y **se niega a
 * borrar cualquiera que aparezca aunque sea una vez**. Los tres deberian dar 0.
 *
 * Los duplicados no chocan entre si porque los nombres son cadenas DISTINTAS:
 * "BELCA" y "BELCA GUATEMALA" son dos llaves diferentes para el VLOOKUP, no dos
 * candidatos a la misma. Por eso borrar la vacia no cambia a que fila resuelve
 * ninguna factura.
 *
 * Borra de ABAJO HACIA ARRIBA. Borrar de arriba hacia abajo corre las filas y
 * la segunda eliminacion cae una posicion desplazada: es el error clasico.
 */

var BFP_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var BFP_HOJA = '00_Proveedores';
var BFP_FEL = '01_FEL_Maestro';
var BFP_ENCABEZADO = 4;
var BFP_FEL_COL_ESTAB = 7;      // columna Establecimiento del FEL

var BFP_BORRAR = [
  'BELCA',
  'COMESA..',
  'PAGO PROV. QTZ DEM'
];

/**
 * Borra las filas, si y solo si ninguna esta en uso en el FEL.
 *
 * Va PRIMERA en el archivo porque el editor selecciona la primera funcion al
 * abrir el archivo y las opciones del desplegable no aceptan clic. Se puso
 * primera DESPUES de correr la simulacion y con el visto bueno de Juanma, no
 * antes: el orden normal es revisar y luego aplicar.
 */
function aplicarBorradoProveedores() { _bfpCorrer(true); }

/** Solo mira y comprueba. No borra nada. */
function revisarBorradoProveedores() { _bfpCorrer(false); }

function _bfpCorrer(borrar) {
  var ss = SpreadsheetApp.openById(BFP_SHEET_ID);
  var hoja = ss.getSheetByName(BFP_HOJA);
  var fel = ss.getSheetByName(BFP_FEL);
  if (!hoja || !fel) { Logger.log('Falta ' + BFP_HOJA + ' o ' + BFP_FEL); return; }

  // ---- cuantas facturas usan cada nombre
  var uso = {};
  BFP_BORRAR.forEach(function (n) { uso[_bfpLlave(n)] = 0; });
  var f = fel.getDataRange().getValues();
  for (var r = BFP_ENCABEZADO; r < f.length; r++) {
    var k = _bfpLlave(f[r][BFP_FEL_COL_ESTAB - 1]);
    if (uso[k] !== undefined) uso[k]++;
  }

  // ---- ubicar las filas
  var filas = hoja.getDataRange().getValues();
  var hallazgos = [];
  for (var i = BFP_ENCABEZADO; i < filas.length; i++) {
    var nom = _bfpLlave(filas[i][0]);
    if (uso[nom] === undefined) continue;
    hallazgos.push({
      fila: i + 1, nombre: String(filas[i][0]).trim(),
      cat: String(filas[i][2] || ''), fam: String(filas[i][5] || ''), usos: uso[nom]
    });
  }

  Logger.log((borrar ? 'BORRADO' : 'SIMULACION') + ' - filas de 00_Proveedores');
  if (!hallazgos.length) { Logger.log('  No se encontro ninguna de las tres. Nada que hacer.'); return; }

  var enUso = 0;
  hallazgos.forEach(function (h) {
    Logger.log('  fila ' + h.fila + '  "' + h.nombre + '"  cat=' + h.cat +
               '  familia=' + (h.fam || '(vacia)') + '  facturas que la usan: ' + h.usos);
    if (h.usos > 0) enUso++;
  });

  if (enUso) {
    Logger.log('');
    Logger.log('  ABORTADO: ' + enUso + ' de estas filas SI se usan en el FEL.');
    Logger.log('  Borrarlas dejaria esas facturas sin categoria. No se toca nada.');
    return;
  }
  Logger.log('  Ninguna esta en uso en el FEL. Es seguro borrarlas.');

  if (!borrar) {
    Logger.log('');
    Logger.log('Si se ve bien, corre aplicarBorradoProveedores().');
    return;
  }

  // de abajo hacia arriba, para que borrar una no mueva a las otras
  hallazgos.sort(function (a, b) { return b.fila - a.fila; });
  hallazgos.forEach(function (h) {
    hoja.deleteRow(h.fila);
    Logger.log('  borrada la fila ' + h.fila + ': ' + h.nombre);
  });
  SpreadsheetApp.flush();
  Logger.log('  ' + hallazgos.length + ' filas borradas.');
}

function _bfpLlave(s) {
  return String(s === null || s === undefined ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
}
