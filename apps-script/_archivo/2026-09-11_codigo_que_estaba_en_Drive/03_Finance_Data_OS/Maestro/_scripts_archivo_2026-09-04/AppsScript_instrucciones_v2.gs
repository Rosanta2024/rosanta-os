// ============================================================
// ROSANTA - Instrucciones del maestro + correccion del catalogo
//
// Dos funciones, se corren una vez cada una:
//   regenerarInstrucciones()  reescribe la hoja 00_Instrucciones
//                             con el flujo real (carga automatica)
//   corregirCatalogo()        Cemaco -> MATERIALES
//                             Delicadezas Espanolas -> equipo
//                             y las 4 celdas escritas a mano que
//                             el VLOOKUP no alcanza
//
// USO: reemplaza el contenido de clasificar.gs (ya cumplio su
//      funcion) o crea un archivo nuevo. Cmd+A, Delete, pegar, Cmd+S.
// ============================================================

var SHEET_ID_DOC = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// ------------------------------------------------------------
// 1) CATALOGO
// ------------------------------------------------------------

// [nombre en 00_Proveedores, categoria nueva, categoria original]
var CATALOGO = [
  ['CEMACO SAN KRIS',        'MATERIALES', 'Materiales'],
  ['CEMACO SAN LUCAS',       'MATERIALES', 'Materiales'],
  ['CEMACO TELARES ANTIGUA', 'MATERIALES', 'Materiales'],
  ['CEMACO ZONA CUATRO',     'MATERIALES', 'Materiales'],
  ['DELICADEZAS ESPAÑOLAS',  'MANTENIMIENTO Y ACCESORIOS EQUIPO', 'Mantenimiento']
];

// Celdas con la categoria escrita a mano: el VLOOKUP no las toca.
// [hoja, texto que debe contener la descripcion, colDesc, colCat, categoria nueva]
var A_MANO = [
  ['03_Banco_Industrial',    'CEMACO',    3, 7, 'MATERIALES'],
  ['05_Tarjeta_Credito_BAC', 'EL MASTIL', 2, 5, 'MATERIALES']
];

function corregirCatalogo() {
  var ss = SpreadsheetApp.openById(SHEET_ID_DOC);
  var prov = ss.getSheetByName('00_Proveedores');
  var datos = prov.getRange(1, 1, prov.getLastRow(), 3).getValues();
  var cambios = 0, avisos = [];

  for (var i = 0; i < CATALOGO.length; i++) {
    var nombre = CATALOGO[i][0], nueva = CATALOGO[i][1], original = CATALOGO[i][2];
    var encontrado = false;
    for (var r = 0; r < datos.length; r++) {
      if (String(datos[r][0]).trim() !== nombre) continue;
      encontrado = true;
      if (String(datos[r][2]).trim() === nueva) {
        avisos.push(nombre + ' ya estaba en ' + nueva);
        break;
      }
      prov.getRange(r + 1, 2).setValue(original);
      prov.getRange(r + 1, 3).setValue(nueva);
      cambios++;
      break;
    }
    if (!encontrado) avisos.push('No encontre "' + nombre + '" en 00_Proveedores');
  }

  for (var j = 0; j < A_MANO.length; j++) {
    var hoja = A_MANO[j][0], buscar = A_MANO[j][1];
    var colD = A_MANO[j][2], colC = A_MANO[j][3], cat = A_MANO[j][4];
    var sh = ss.getSheetByName(hoja);
    if (!sh) { avisos.push('No existe la hoja ' + hoja); continue; }
    var vals = sh.getRange(1, 1, sh.getLastRow(), Math.max(colD, colC)).getValues();
    for (var k = 0; k < vals.length; k++) {
      var desc = String(vals[k][colD - 1] || '').toUpperCase();
      if (desc.indexOf(buscar) < 0) continue;
      if (String(vals[k][colC - 1]).trim() === cat) continue;
      sh.getRange(k + 1, colC).setValue(cat);
      cambios++;
    }
  }

  Logger.log('Celdas corregidas: ' + cambios);
  for (var z = 0; z < avisos.length; z++) Logger.log('  ' + avisos[z]);
  Logger.log('Las facturas FEL de esos proveedores se reclasifican solas por el VLOOKUP.');
}

// ------------------------------------------------------------
// 2) INSTRUCCIONES
// ------------------------------------------------------------

function regenerarInstrucciones() {
  var ss = SpreadsheetApp.openById(SHEET_ID_DOC);
  var vieja = ss.getSheetByName('00_Instrucciones');
  if (vieja) ss.deleteSheet(vieja);
  var sh = ss.insertSheet('00_Instrucciones', 0);

  var filas = [
    ['titulo', 'ROSANTA - MAESTRO FINANCIERO 2026', 'CORSAGA, S.A. - Antigua Guatemala'],
    ['nota', 'Ultima revision', '1 de septiembre de 2026'],
    ['', '', ''],

    ['seccion', 'LO PRIMERO QUE HAY QUE SABER', ''],
    ['texto', 'Este archivo es la fuente unica de verdad de las finanzas de Rosanta.', 'Se edita SOLO aca. Cualquier archivo que empiece con ZZ_ARCHIVO_ esta muerto y no se toca. Tampoco se usa nada que este dentro de 00_CIERRE_MAESTRO: esa carpeta guarda las fuentes crudas, no un maestro.'],
    ['texto', 'La carga de ventas y facturas es AUTOMATICA. No se pega nada a mano.', 'Vos solo dejas los archivos en la carpeta que corresponde dentro de Reportes 2026. El resto lo hace un Apps Script.'],
    ['', '', ''],

    ['seccion', 'COMO ENTRA LA INFORMACION', ''],
    ['texto', 'Paso 1 - Vos: dejar los archivos en su carpeta.', 'Semanal en la carpeta SXX (POS y FEL recibidas). Mensual en la carpeta 2026-MM (POS del mes, FEL recibidas, FEL emitidas y los estados de cuenta en PDF). El nombre del archivo da igual: el cargador los identifica por su contenido.'],
    ['texto', 'Paso 2 - Automatico, lunes 10:00: cargarPendientes', 'Recorre todas las carpetas de Reportes 2026 y sube al maestro lo que todavia no este. Nunca duplica: compara Serie y Numero en las facturas, y TicketId en las ventas. Recuerda que archivos ya proceso.'],
    ['texto', 'Paso 3 - Automatico, lunes 10:30: generarEspejo', 'Exporta el maestro como Rosanta_Maestro_ESPEJO.xlsx a la misma carpeta. El espejo es un DERIVADO que necesita el generador del dashboard. Nunca lo edites: se sobrescribe entero cada vez.'],
    ['texto', 'Paso 4 - Automatico, lunes 11:04: el dashboard', 'Se refresca el tablero semanal con la ultima semana cargada.'],
    ['texto', 'Si no queres esperar al lunes', 'Menu Rosanta (arriba, junto a Ayuda) > Cargar lo que falte. Ese menu tambien tiene Solo revisar, que informa sin escribir nada.'],
    ['texto', 'LOS ESTADOS DE CUENTA NO SE CARGAN SOLOS.', 'Vienen en PDF y los procesa Claude, una vez al mes, validando contra los totales impresos del banco. Es el unico paso que sigue siendo manual y es a proposito: ahi esta el control.'],
    ['', '', ''],

    ['seccion', 'LAS 14 HOJAS', ''],
    ['texto', 'BASES DE DATOS (las llena el cargador, no vos)', ''],
    ['texto', '00_Proveedores', 'Catalogo. Cada proveedor con su Categoria_Normalizada y Es_Personal. Las hojas de FEL lo consultan por VLOOKUP, asi que cambiar una categoria aca reclasifica todo el historico de ese proveedor.'],
    ['texto', '01_FEL_Maestro', 'Facturas RECIBIDAS (compras).'],
    ['texto', '01b_FEL_Emitidas', 'Facturas EMITIDAS (ventas). Fuente del IVA debito.'],
    ['texto', '02_Ventas_Maestro', 'Tickets del POS.'],
    ['texto', '03_Banco_Industrial', 'Cuenta 6500002057.'],
    ['texto', '04_Banco_BAC', 'Cuenta 904802543 (quetzales).'],
    ['texto', '05_Tarjeta_Credito_BAC', 'Tarjeta 4966-64**-****-2794, en Q y USD.'],
    ['', '', ''],
    ['texto', 'REPORTES (se calculan solos)', ''],
    ['texto', '04_Reporte_Semanal', 'Selector: celda D3 = numero de semana ISO.'],
    ['texto', '05_Reporte_Contador', 'Version semanal limpia. CONTROL INTERNO: ya no se entrega al contador.'],
    ['texto', '06_Dashboard_Operativo', 'Marketing, ROAS y reservas.'],
    ['texto', '07_Reporte_Mensual', 'Selectores: B3 = ano, D3 = mes (1-12).'],
    ['texto', '08_Reporte_Contador_Mensual', 'CONTROL INTERNO: sirve para verificar el trabajo del contador, no se le manda.'],
    ['texto', '09_PnL_Mensual', 'Estado de resultados del mes.'],
    ['', '', ''],

    ['seccion', 'LA REGLA QUE NO SE ROMPE', ''],
    ['texto', 'Un mes no esta cerrado hasta que cuadra contra el banco.', 'La suma de debitos y creditos de cada hoja de banco tiene que dar EXACTAMENTE igual a los totales impresos al final del PDF. Si no cuadra, hay un error de carga: se corrige antes de seguir.'],
    ['texto', 'Por que existe esta regla', 'En mayo de 2026 el maestro tenia Q86,055 de gasto que nunca ocurrio: una linea del estado de cuenta se partio mal y el numero de documento entro como si fuera un monto. Estuvo meses sin que nadie lo notara, porque este paso no existia. Los ocho meses de 2026 ya estan validados al centavo; la cadena no se rompe.'],
    ['', '', ''],

    ['seccion', 'REGLAS DE CATEGORIZACION', ''],
    ['texto', 'Banco Industrial', ''],
    ['texto', 'VISANET', 'INGRESO_TARJETA'],
    ['texto', 'ATM, Bancared y A-PASEO ANTIGUA', 'ALIMENTOS_EFECTIVO. Todo retiro de efectivo va aca porque es compra de mercado. NO es ALIMENTOS: esa categoria es la compra facturada y mezclarlas distorsiona el COGS.'],
    ['texto', 'S## o "1a/2a Mes" + nombre del roster', 'NOMINA. Roster: Marvin, Eddy, Melvin, Fernanda, Andre, Toni, Yazmin, Jeffry, Nadia, Efrain, Maco.'],
    ['texto', '"1a/2a Mes" SIN nombre, de unos Q10,000', 'ALQUILER. La renta se paga por quincena.'],
    ['texto', 'S## + proveedor o concepto', 'La categoria del proveedor, no nomina. Ej: S31Elitemarcas = BEBIDAS.'],
    ['texto', 'PAGO ELECTRONICO BCA.TOTAL', 'IGSS. No es comision bancaria: estuvo mal clasificado de febrero a agosto 2026.'],
    ['texto', 'BANCA ELECTRONICA', 'SERVICIOS_PROFESIONALES. Es la transferencia internacional a Vanessa por la pauta.'],
    ['texto', 'ACH CORSAGA SOCIEDAD ANONIMA', 'INGRESO_TRANSFERENCIA entre cuentas propias. Si trae nombre de empleado es una devolucion de nomina rechazada y va a NOMINA como credito.'],
    ['', '', ''],
    ['texto', 'BAC por codigo', ''],
    ['texto', 'L1 / PT y DB / MD / TF / MC / 59 y 3F', 'INGRESO_TARJETA / PAGO_TARJETA_CREDITO / TRANSFERENCIA_SALIENTE / TRANSFERENCIA / INGRESO_TRANSFERENCIA / COMISIONES_BANCARIAS'],
    ['', '', ''],
    ['texto', 'Tarjeta de credito', ''],
    ['texto', 'GOOGLE*ADS y FACEBK', 'MARKETING_DIGITAL'],
    ['texto', 'GOOGLE*WORKSPACE, HIGHLEVEL, ANTHROPIC', 'CUOTAS_Y_SUSCRIPCIONES'],
    ['texto', 'TIGO y CLARO', 'TELEFONOS_Y_CELULARES'],
    ['texto', 'Restaurantes y cafes de Antigua, viajes y consumo en el exterior', 'PERSONAL con Es_Personal = Si'],
    ['', '', ''],
    ['texto', 'Materiales vs mantenimiento', 'MATERIALES = construccion y reparaciones: Cemaco, Acuario Antigua, El Mastil. MANTENIMIENTO Y ACCESORIOS EQUIPO = menaje y equipo de cocina y salon: Bello Hogar, Decomerlasa, Alquifiestas, Delicadezas Espanolas.'],
    ['', '', ''],

    ['seccion', 'EVENTOS PRIVADOS', ''],
    ['texto', 'No se mezclan con la venta de restaurante.', 'Se reportan como ingreso adicional, aparte.'],
    ['texto', 'Como reconocerlos', 'Un ticket inusualmente grande, sin comensales en Notas, pagado con cheque o en "Otros". El cargador avisa solo cuando encuentra uno de mas de Q5,000.'],
    ['texto', 'Como marcarlos', 'EVENTO en la columna Notas y "EVENTO PRIVADO - detalle" en Productos. El dashboard los separa automaticamente.'],
    ['texto', 'Por que importa', 'En 2026 fueron Q43,439 en cinco meses. Mezclado, un solo evento de agosto subia el ticket promedio de Q291 a Q369 y hundia el COGS aparente de 27.6% a 21.8%.'],
    ['', '', ''],

    ['seccion', 'OTRAS REGLAS', ''],
    ['texto', 'Nunca borres historico.', 'Si hay un error, agrega una fila correctiva y deja constancia en la columna Nota.'],
    ['texto', 'Nunca identifiques una fila por su numero.', 'Las hojas se ordenan y se filtran. Se busca por contenido: fecha, descripcion y monto.'],
    ['texto', 'Los gastos con Es_Personal = Si se excluyen solos de los reportes.', ''],
    ['texto', 'Las semanas son ISO 8601, con WEEKNUM(fecha, 21).', 'No se escriben a mano.'],
    ['texto', 'COGS son tres categorias: ALIMENTOS, BEBIDAS, COCTELERIA.', 'Todo lo demas es gasto operativo.'],
    ['texto', 'Vigilar el costo de alimentos.', 'Alimentos (efectivo + facturado) sobre venta de restaurante. La banda normal de 2026 es 19% a 26%. Agosto cerro en 32.1% y quedo en observacion.'],
    ['', '', ''],
    ['nota', 'Rosanta - Cocina con Carisma - 14 N / 91 W', '']
  ];

  var datos = [];
  for (var i = 0; i < filas.length; i++) datos.push([filas[i][1], filas[i][2]]);
  sh.getRange(1, 1, datos.length, 2).setValues(datos);

  var VERDE = '#456B50', CREMA = '#F0EDE6', TINTA = '#2c2a26', GRIS = '#7d7a72';
  sh.setColumnWidth(1, 440);
  sh.setColumnWidth(2, 640);
  sh.getRange(1, 1, datos.length, 2)
    .setFontFamily('Lato').setFontSize(10).setFontColor(TINTA)
    .setVerticalAlignment('top').setWrap(true);

  for (var j = 0; j < filas.length; j++) {
    var r = j + 1, tipo = filas[j][0];
    if (tipo === 'titulo') {
      sh.getRange(r, 1, 1, 2).setBackground(VERDE).setFontColor('#FFFFFF')
        .setFontSize(15).setFontWeight('bold').setFontFamily('Playfair Display');
      sh.setRowHeight(r, 38);
    } else if (tipo === 'seccion') {
      sh.getRange(r, 1, 1, 2).setBackground(CREMA).setFontWeight('bold').setFontSize(11);
      sh.setRowHeight(r, 26);
    } else if (tipo === 'nota') {
      sh.getRange(r, 1, 1, 2).setFontColor(GRIS).setFontStyle('italic');
    } else if (tipo === 'texto') {
      sh.getRange(r, 1).setFontWeight('bold');
    }
  }
  sh.setFrozenRows(2);
  Logger.log('00_Instrucciones regenerada con ' + datos.length + ' filas.');
}
