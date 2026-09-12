/**
 * ============================================================================
 * FAMILIA DE PROVEEDOR  ·  columna nueva en 00_Proveedores
 * ============================================================================
 *
 * Para que el techo de compra pueda decir QUE comprar y no solo CUANTO, cada
 * proveedor de mercaderia necesita una familia de producto.
 *
 * La lista de abajo la prellenó Claude el 4-sep-2026 leyendo el NOMBRE del
 * proveedor. Donde el nombre no alcanzaba quedo REVISAR: son 26 proveedores,
 * pero solo 9 pesan mas de Q1,000 en el año. Esos los corrigen Jeffry y Jose.
 *
 * REGLA: este script SOLO escribe en celdas VACIAS. Una familia corregida a
 * mano nunca se pisa al volver a correrlo. Por eso se puede correr las veces
 * que haga falta sin miedo.
 *
 * Familias de cocina: VERDURA, CARNE, AVES, PESCADO, LACTEOS, PANADERIA,
 *   ABARROTES, SUPERMERCADO, ESPECIAS_ACEITES, DELI_IMPORTADO
 *
 * ABARROTES y SUPERMERCADO no son lo mismo y por eso van separadas: la primera
 * es producto seco comprado a distribuidor (Belca, Comesa); la segunda es un
 * CANAL, y La Bodegona o La Torre venden de todo.
 * Familias de barra:  VINO, CERVEZA, LICOR, MIXOLOGIA, HIELO_AGUA
 *
 * SUPERMERCADO es un canal, no una familia de producto: La Bodegona y La Torre
 * venden de todo. Se deja aparte a proposito, porque saber que Q36,000 al año
 * se van en supermercado ya es un dato accionable por si mismo.
 */

// El proyecto del maestro es standalone, NO esta pegado al Sheet: getActive()
// devuelve null. Se abre por id, igual que el resto de los scripts de aqui.
var FAM_SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var FAM_HOJA = '00_Proveedores';
var FAM_ENCABEZADO = 4;          // fila 4 trae los titulos
var FAM_COL_TITULO = 'Familia';

var FAM_PRELLENADO = [
  ['"TAVI"', 'LICOR'],
  ['16 PATAS', 'REVISAR'],
  ['2 ONZAS MIXOLOGY', 'MIXOLOGIA'],
  ['2ONZAS EVENTS', 'MIXOLOGIA'],
  ['ALCAZAREN ANTIGUA GUATEMALA', 'VINO'],
  ['ALIMENTOS XELAPAN', 'PANADERIA'],
  ['ALIMENTOS Y BEBIDAS SAN LUCAS', 'REVISAR'],
  ['AM CROPS', 'VERDURA'],
  ['ANNIE Y FELIX', 'REVISAR'],
  ['AQUA', 'HIELO_AGUA'],
  ['BELCA', 'REVISAR'],
  ['BELCA GUATEMALA', 'ABARROTES'],
  ['BLUE ICE', 'HIELO_AGUA'],
  ['BODEGA DOÑA LEONOR', 'SUPERMERCADO'],
  ['BODEGA FELIZ', 'CERVEZA'],
  ['C.C. EXPRESS', 'SUPERMERCADO'],
  ['CALDER', 'REVISAR'],
  ['CAOBA MARKET', 'SUPERMERCADO'],
  ['CARNES Y EMBUTIDOS DOÑA NOY', 'CARNE'],
  ['CENTRAL PROVEEDORA DE COMERCIOS', 'REVISAR'],
  ['COMESA', 'ABARROTES'],
  ['COMESA..', 'REVISAR'],
  ['COMSERSA SANTA LUCIA MILPAS ALTAS I', 'SUPERMERCADO'],
  ['CORALOIBISA 1', 'REVISAR'],
  ['CULPAN', 'LICOR'],
  ['DELICADEZAS ESPAÑOLAS', 'DELI_IMPORTADO'],
  ['DEPOSITO SAN FRANCISCO', 'LICOR'],
  ['DESPENSA FAMILIAR ANTIGUA GUATEMALA', 'SUPERMERCADO'],
  ['DISTRIBUCIONES LA TORTILLA', 'PANADERIA'],
  ['DISTRIBUIDORA DE ALIMENTOS LOS ALPES', 'VERDURA'],
  ['DISTRIBUIDORA DE FRUTAS Y VERDURAS "DOÑA MINA Y DON ROLANDO"', 'VERDURA'],
  ['DISTRIBUIDORA DE LOMITO DE RES LA ASUNCION', 'CARNE'],
  ['DISTRIBUIDORA DON TAVITO', 'LICOR'],
  ['DISTRIBUIDORA LA NUEVA, AGENCIA CONDADO NARANJO', 'CERVEZA'],
  ['DISTRIBUIDORA MARTE S.A.', 'LICOR'],
  ['DISTRIBUIDORA OLAM', 'REVISAR'],
  ['DISTRIBUIDORA XELAC 4', 'LACTEOS'],
  ['DISTRIBUIDORA XELAC 4 (BODEGA GUATE)', 'LACTEOS'],
  ['DISTRIBUIDORA Y COMERCIAL LA CANASTA', 'REVISAR'],
  ['DONDE JOSELITO', 'REVISAR'],
  ['EL CAZADOR ITALIANO DELICATESSEN', 'DELI_IMPORTADO'],
  ['EL CAZADOR ITALIANO PIZZERIA', 'DELI_IMPORTADO'],
  ['EL ILEGAL', 'LICOR'],
  ['ELITE MARCAS', 'LICOR'],
  ['ENTRE VOLCANES', 'CERVEZA'],
  ['ENTREVINOS', 'VINO'],
  ['FOGLIASANA', 'DELI_IMPORTADO'],
  ['FOGLIASANA S.A.', 'DELI_IMPORTADO'],
  ['FRANCONIA S.A.', 'VINO'],
  ['GRUPO ECO', 'HIELO_AGUA'],
  ['JUANITA\'S DISTRIBUIDORA', 'REVISAR'],
  ['LA BODEGONA', 'SUPERMERCADO'],
  ['LA COFRADIA DE LOS VINOS', 'VINO'],
  ['LA COSECHA', 'VERDURA'],
  ['LA NACIONAL', 'LICOR'],
  ['LA PASTELERIA', 'PANADERIA'],
  ['MARIA ISABELLA HARTAMANN HOLAS', 'LACTEOS'],
  ['MARRANERIA CARNE DE K-LIDAD', 'CARNE'],
  ['MIXOKIT', 'MIXOLOGIA'],
  ['MULTIVENTAS MARROQUIN', 'PESCADO'],
  ['NOBLE LIFE', 'LICOR'],
  ['NUEVOS TERRITORIOS', 'CARNE'],
  ['OVOPAST', 'LACTEOS'],
  ['PACHAMAMA', 'VERDURA'],
  ['PAGO PROV. QTZ DEM', 'REVISAR'],
  ['PASTELES HANSEL Y GRETEL', 'PANADERIA'],
  ['PESCADERIA EL TIBURONCITO', 'PESCADO'],
  ['PITA PINTA', 'PANADERIA'],
  ['PRICESMART', 'SUPERMERCADO'],
  ['PRICESMART (GUATEMALA), S.A.', 'SUPERMERCADO'],
  ['PRICESMART ESCUINTLA', 'SUPERMERCADO'],
  ['PRICESMART SAN CRISTOBAL', 'SUPERMERCADO'],
  ['PRIME FOOD IMPORTS, SOCIEDAD ANÓNIMA', 'CARNE'],
  ['PRIMODEROMA', 'REVISAR'],
  ['PRODUCTOS ALIMENTICIOS DON QUINCHO', 'REVISAR'],
  ['PRODUCTOS PARMA', 'LACTEOS'],
  ['PRODUCTOS SUPERB ESPECIAS', 'ESPECIAS_ACEITES'],
  ['PRODUCTOS SUPERB ESPECIAS S.A.', 'ESPECIAS_ACEITES'],
  ['SALA DE VENTAS ANTIGUA GUATEMALA, AVICOLA VILLALOBOS', 'AVES'],
  ['SAN MARTIN ANTIGUA', 'PANADERIA'],
  ['SAN MARTIN ANTIGUA TELARES', 'PANADERIA'],
  ['SERVAPROINAGRO', 'REVISAR'],
  ['SUPER 24 PLAZA CIUDAD VIEJA, SACATEPEQUEZ', 'SUPERMERCADO'],
  ['SUPER TIENDA LUCKY', 'SUPERMERCADO'],
  ['SUPERMARKET EL PANORAMA', 'SUPERMERCADO'],
  ['SUPERMERCADOS LA TORRE', 'SUPERMERCADO'],
  ['SURTI-ACEITES MENDEZ', 'ESPECIAS_ACEITES'],
  ['TECOAVI FINCA', 'AVES'],
  ['TIENDA SUR', 'SUPERMERCADO'],
  ['WILD DAUGHTER', 'REVISAR'],
  ['ÁGUILA ENTRE VOLCANES', 'CERVEZA']
];

/**
 * Escribe la columna Familia en las celdas VACIAS y aplica las correcciones
 * declaradas al final del archivo.
 *
 * Va PRIMERA en el archivo a proposito: el editor selecciona la primera funcion
 * al abrir el archivo, y las opciones del desplegable son dificiles de acertar.
 */
function aplicarFamilias() {
  _famCorrer(true);
}

/** Solo mira. No escribe nada. */
function revisarFamilias() {
  _famCorrer(false);
}

function _famCorrer(escribir) {
  var hoja = SpreadsheetApp.openById(FAM_SHEET_ID).getSheetByName(FAM_HOJA);
  if (!hoja) { Logger.log('No existe la hoja ' + FAM_HOJA); return; }

  var ultFila = hoja.getLastRow(), ultCol = hoja.getLastColumn();
  var cab = hoja.getRange(FAM_ENCABEZADO, 1, 1, ultCol).getValues()[0];

  var col = 0;
  for (var i = 0; i < cab.length; i++) {
    if (String(cab[i]).trim().toLowerCase() === FAM_COL_TITULO.toLowerCase()) { col = i + 1; break; }
  }
  if (!col) {
    col = ultCol + 1;
    if (escribir) {
      hoja.getRange(FAM_ENCABEZADO, col).setValue(FAM_COL_TITULO).setFontWeight('bold');
      Logger.log('Columna "' + FAM_COL_TITULO + '" creada en la posicion ' + col + '.');
    } else {
      Logger.log('La columna "' + FAM_COL_TITULO + '" NO existe. Se crearia en la posicion ' + col + '.');
    }
  }

  // mapa nombre -> familia, en mayusculas y sin espacios de sobra
  var mapa = {};
  FAM_PRELLENADO.forEach(function (p) { mapa[_famLlave(p[0])] = p[1]; });

  var prim = FAM_ENCABEZADO + 1, n = ultFila - FAM_ENCABEZADO;
  if (n < 1) { Logger.log('La hoja no tiene filas de datos.'); return; }

  var nombres = hoja.getRange(prim, 1, n, 1).getValues();
  var cats = hoja.getRange(prim, 3, n, 1).getValues();
  var actual = (col <= ultCol) ? hoja.getRange(prim, col, n, 1).getValues()
                               : nombres.map(function () { return ['']; });

  var MERC = { ALIMENTOS: 1, BEBIDAS: 1, COCTELERIA: 1 };
  var escritas = 0, respetadas = 0, revisar = 0, sinMapa = [];

  for (var r = 0; r < n; r++) {
    var nom = String(nombres[r][0] || '').trim();
    if (!nom) continue;
    if (!MERC[String(cats[r][0] || '').trim().toUpperCase()]) continue;  // solo mercaderia

    if (String(actual[r][0] || '').trim()) { respetadas++; continue; }   // ya tiene, no se toca

    var f = mapa[_famLlave(nom)];
    if (!f) { sinMapa.push(nom); f = 'REVISAR'; }
    if (f === 'REVISAR') revisar++;
    actual[r][0] = f;
    escritas++;
  }

  if (escribir) {
    hoja.getRange(prim, col, n, 1).setValues(actual);
    SpreadsheetApp.flush();
  }

  Logger.log((escribir ? 'APLICADO' : 'SIMULACION') + ' · familias de proveedor');
  Logger.log('  celdas ' + (escribir ? 'escritas' : 'que se escribirian') + ': ' + escritas);
  Logger.log('  de esas, en REVISAR: ' + revisar);
  Logger.log('  ya tenian familia y NO se tocan: ' + respetadas);
  if (sinMapa.length) {
    Logger.log('  proveedores nuevos que la lista no conocia (' + sinMapa.length + '):');
    sinMapa.slice(0, 40).forEach(function (x) { Logger.log('    ' + x); });
  }
  // Las correcciones declaradas van en la MISMA corrida. Llenar vacias y
  // corregir lo ya resuelto son dos pasos del mismo trabajo, y separarlos en
  // dos funciones solo obliga a acordarse de correr las dos.
  _famCorregir(escribir);

  if (!escribir) Logger.log('\nSi se ve bien, corre aplicarFamilias().');
}

function _famLlave(s) {
  return String(s === null || s === undefined ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * ============================================================================
 * CORRECCIONES  ·  lo unico que puede pisar una familia ya escrita
 * ============================================================================
 *
 * aplicarFamilias() nunca sobrescribe: si una celda ya dice algo, la respeta.
 * Eso protege el trabajo del equipo, pero deja sin arreglar las que se
 * escribieron REVISAR y despues alguien resolvio.
 *
 * Esta lista es la salida para eso, y va con la misma proteccion que el resto
 * de los lotes de este proyecto: cada linea declara el valor que ESPERA
 * encontrar. Si la celda dice otra cosa, NO se toca y se reporta. Asi el lote
 * se puede volver a correr sin miedo y nunca pisa una correccion posterior.
 *
 * [proveedor, lo que deberia decir hoy, lo que debe quedar, quien lo dijo]
 */
var FAM_CORRECCIONES = [
  ['DISTRIBUIDORA DE ALIMENTOS LOS ALPES', 'REVISAR', 'VERDURA',
   'Juanma 4-sep-2026: frutas y verduras del mercado'],
  ['MULTIVENTAS MARROQUIN', 'REVISAR', 'PESCADO',
   'Juanma 4-sep-2026: pescado'],
  ['LA NACIONAL', 'REVISAR', 'LICOR',
   'Juanma 4-sep-2026: licor'],
  ['DISTRIBUIDORA LA NUEVA, AGENCIA CONDADO NARANJO', 'REVISAR', 'CERVEZA',
   'Juanma 4-sep-2026: cerveza'],
  ['BODEGA FELIZ', 'REVISAR', 'CERVEZA',
   'Juanma 4-sep-2026: cerveza'],
  ['MARIA ISABELLA HARTAMANN HOLAS', 'REVISAR', 'LACTEOS',
   'Juanma 4-sep-2026: quesos artesanales'],
  // Embutidos. No hay familia propia para charcuteria y abrir una para un solo
  // proveedor de Q1,640 al año fragmenta el reparto mas de lo que aclara.
  ['NUEVOS TERRITORIOS', 'REVISAR', 'CARNE',
   'Juanma 4-sep-2026: embutidos'],
  ['BELCA GUATEMALA', 'REVISAR', 'ABARROTES',
   'Juanma 4-sep-2026: abarroteria'],
  ['COMESA', 'REVISAR', 'ABARROTES',
   'Juanma 4-sep-2026: abarroteria']
];

function revisarCorrecciones() { _famCorregir(false); }
function aplicarCorrecciones() { _famCorregir(true); }

function _famCorregir(escribir) {
  var hoja = SpreadsheetApp.openById(FAM_SHEET_ID).getSheetByName(FAM_HOJA);
  if (!hoja) { Logger.log('No existe la hoja ' + FAM_HOJA); return; }

  var ultFila = hoja.getLastRow(), ultCol = hoja.getLastColumn();
  var cab = hoja.getRange(FAM_ENCABEZADO, 1, 1, ultCol).getValues()[0];
  var col = 0;
  for (var i = 0; i < cab.length; i++) {
    if (String(cab[i]).trim().toLowerCase() === FAM_COL_TITULO.toLowerCase()) { col = i + 1; break; }
  }
  if (!col) { Logger.log('La columna "' + FAM_COL_TITULO + '" no existe. Corre aplicarFamilias() primero.'); return; }

  var prim = FAM_ENCABEZADO + 1, n = ultFila - FAM_ENCABEZADO;
  var nombres = hoja.getRange(prim, 1, n, 1).getValues();
  var fams = hoja.getRange(prim, col, n, 1).getValues();

  var hechas = 0, saltadas = 0, noHallados = 0;
  FAM_CORRECCIONES.forEach(function (c) {
    var llave = _famLlave(c[0]), visto = 0;
    for (var r = 0; r < n; r++) {
      if (_famLlave(nombres[r][0]) !== llave) continue;
      visto++;
      var hoy = String(fams[r][0] || '').trim().toUpperCase();
      if (hoy !== c[1]) {
        Logger.log('  SALTADA  ' + c[0] + ': esperaba "' + c[1] + '" y dice "' + hoy + '"');
        saltadas++; continue;
      }
      fams[r][0] = c[2];
      Logger.log('  ' + (escribir ? 'ok       ' : 'se haria ') + c[0] + ': ' + c[1] + ' -> ' + c[2] +
                 '  (' + c[3] + ')');
      hechas++;
    }
    if (!visto) { Logger.log('  NO ESTA  ' + c[0]); noHallados++; }
  });

  if (escribir && hechas) { hoja.getRange(prim, col, n, 1).setValues(fams); SpreadsheetApp.flush(); }

  Logger.log((escribir ? 'APLICADO' : 'SIMULACION') + ' - correcciones de familia');
  Logger.log('  ' + (escribir ? 'escritas' : 'que se escribirian') + ': ' + hechas +
             ' | saltadas: ' + saltadas + ' | proveedor no encontrado: ' + noHallados);
  if (!escribir) Logger.log('Si se ve bien, corre aplicarCorrecciones().');
}
