// ============================================================
// ROSANTA - Scripts del maestro financiero
// Proyecto: Rosanta_MAESTRO_ACTIVO_2026
//
// Este archivo funciona en un proyecto SUELTO (standalone), que es
// como esta el tuyo. Por eso apunta al Sheet por ID y no usa
// getActiveSpreadsheet(), que en un proyecto suelto devuelve null.
//
// INSTALACION
//   1. Click dentro del editor, Cmd+A, Delete (que quede vacio)
//   2. Pega este archivo entero
//   3. Cmd+S para guardar
//   4. Selector de arriba: elegi "generarEspejo" y dale Run
//   5. Autoriza cuando lo pida (Revisar permisos > tu cuenta >
//      Configuracion avanzada > Ir a Rosanta_MAESTRO_ACTIVO_2026 > Permitir)
//   6. Run otra vez. El log debe decir "Espejo actualizado"
//   7. Elegi "instalarTrigger", Run una vez
//   8. Elegi "regenerarInstrucciones", Run una vez
// ============================================================

var SHEET_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var NOMBRE_ESPEJO = 'Rosanta_Maestro_ESPEJO.xlsx';

function abrirMaestro() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss) {
    throw new Error('No pude abrir el Sheet ' + SHEET_ID + '. Revisa el ID y tus permisos.');
  }
  return ss;
}

// ------------------------------------------------------------
// 1) ESPEJO: exporta el Sheet a xlsx en la misma carpeta
// ------------------------------------------------------------
function generarEspejo() {
  var carpeta = DriveApp.getFileById(SHEET_ID).getParents().next();

  var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=xlsx';
  var respuesta = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (respuesta.getResponseCode() !== 200) {
    throw new Error('Google devolvio ' + respuesta.getResponseCode() + ' al exportar.');
  }

  var blob = respuesta.getBlob().setName(NOMBRE_ESPEJO);

  var previos = carpeta.getFilesByName(NOMBRE_ESPEJO);
  while (previos.hasNext()) {
    previos.next().setTrashed(true);
  }

  var archivo = carpeta.createFile(blob);
  Logger.log('Espejo actualizado en "' + carpeta.getName() + '" - ' +
             Math.round(archivo.getSize() / 1024) + ' KB');
  return archivo.getId();
}

function instalarTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'generarEspejo') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('generarEspejo')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(30)
    .create();
  Logger.log('Trigger instalado: lunes cerca de las 10:30');
}

// ------------------------------------------------------------
// 2) INSTRUCCIONES: borra 00_Instrucciones y la reescribe
// ------------------------------------------------------------
function regenerarInstrucciones() {
  var ss = abrirMaestro();

  var vieja = ss.getSheetByName('00_Instrucciones');
  if (vieja) ss.deleteSheet(vieja);
  var sh = ss.insertSheet('00_Instrucciones', 0);

  var filas = [
    ['titulo', 'ROSANTA - MAESTRO FINANCIERO 2026', 'CORSAGA, S.A. - Antigua Guatemala'],
    ['nota', 'Ultima revision de estas instrucciones', '1 de septiembre de 2026'],
    ['', '', ''],

    ['seccion', 'QUE ES ESTE ARCHIVO', ''],
    ['texto', 'Fuente unica de verdad de las finanzas de Rosanta.', 'Se edita SOLO aca. Cualquier archivo que empiece con ZZ_ARCHIVO_ esta muerto y no se toca.'],
    ['texto', 'Un Apps Script exporta cada lunes 10:30 el archivo Rosanta_Maestro_ESPEJO.xlsx a esta misma carpeta.', 'Ese espejo es un DERIVADO que lee el generador del dashboard. Nunca lo edites: se sobrescribe entero en cada corrida.'],
    ['', '', ''],

    ['seccion', 'LAS 14 HOJAS', ''],
    ['texto', 'BASES DE DATOS (aca se pega la informacion cruda)', ''],
    ['texto', '00_Proveedores', 'Catalogo. Cada proveedor con su Categoria_Normalizada y Es_Personal. Las hojas de FEL lo consultan por VLOOKUP.'],
    ['texto', '01_FEL_Maestro', 'Facturas RECIBIDAS (compras). Columnas A-K se pegan; L-P se calculan solas.'],
    ['texto', '01b_FEL_Emitidas', 'Facturas EMITIDAS (ventas). Fuente del IVA debito fiscal.'],
    ['texto', '02_Ventas_Maestro', 'Tickets del POS. Columnas A-L se pegan; M-O se calculan solas.'],
    ['texto', '03_Banco_Industrial', 'Cuenta 6500002057.'],
    ['texto', '04_Banco_BAC', 'Cuenta 904802543 (quetzales).'],
    ['texto', '05_Tarjeta_Credito_BAC', 'Tarjeta 4966-64**-****-2794, en Q y USD.'],
    ['', '', ''],
    ['texto', 'REPORTES (se calculan solos, no se escriben a mano)', ''],
    ['texto', '04_Reporte_Semanal', 'Semana operativa. Selector: celda D3 = numero de semana ISO.'],
    ['texto', '05_Reporte_Contador', 'Version semanal limpia.'],
    ['texto', '06_Dashboard_Operativo', 'Marketing, ROAS y reservas. Uso interno, no va al contador.'],
    ['texto', '07_Reporte_Mensual', 'Cierre del mes. Selectores: B3 = ano, D3 = mes (1-12).'],
    ['texto', '08_Reporte_Contador_Mensual', 'Lo que se exporta a PDF y se manda al contador.'],
    ['texto', '09_PnL_Mensual', 'Estado de resultados del mes.'],
    ['', '', ''],

    ['seccion', 'RUTINA SEMANAL (cada lunes)', ''],
    ['texto', '1. Pega el export del POS al final de 02_Ventas_Maestro.', 'Antes de pegar, revisa que el TicketId mas bajo del export sea mayor al ultimo ya cargado. Si se solapan, hay duplicados.'],
    ['texto', '2. Pega el FEL recibido del SAT al final de 01_FEL_Maestro.', 'Verifica duplicados por la pareja (Serie, Numero del DTE). En agosto 2026 se colaron 18 facturas repetidas por saltarse este paso.'],
    ['texto', '3. Revisa si quedo algo en POR_CLASIFICAR.', 'Agrega el proveedor a 00_Proveedores con su categoria y se resuelve solo.'],
    ['texto', '4. Cambia D3 en 04_Reporte_Semanal al numero de semana.', ''],
    ['', '', ''],

    ['seccion', 'RUTINA MENSUAL (inicio de mes)', ''],
    ['texto', '1. Pega los estados de cuenta del mes cerrado.', 'Banco Industrial a la hoja 03. BAC quetzales a la 04. Tarjeta de credito a la 05.'],
    ['texto', '2. VALIDA CONTRA EL BANCO. Regla dura, no opcional.', 'La suma de debitos y creditos de cada hoja tiene que dar EXACTAMENTE igual a los totales impresos al final del PDF del banco. Si no cuadra, hay error de carga: corregi antes de seguir. El mes no se cierra hasta que cuadre.'],
    ['texto', '3. Fija B3 (ano) y D3 (mes) en 07_Reporte_Mensual.', ''],
    ['texto', '4. Exporta 08_Reporte_Contador_Mensual a PDF y mandalo al contador.', ''],
    ['', '', ''],

    ['seccion', 'REGLAS DE CATEGORIZACION', ''],
    ['texto', 'Banco Industrial', ''],
    ['texto', 'VISANET', 'INGRESO_TARJETA'],
    ['texto', 'ATM y retiros Bancared', 'ALIMENTOS_EFECTIVO (son compras de mercado en efectivo)'],
    ['texto', 'S## o "1a/2a Mes" seguido de nombre del roster', 'NOMINA. Roster: Marvin, Eddy, Melvin, Fernanda, Andre, Toni, Jose, Jeffry, Nadia, Efrain.'],
    ['texto', 'S## seguido de proveedor o concepto', 'La categoria del proveedor, NO nomina. Ejemplos: S31Elitemarcas = BEBIDAS, S30Jardineria = MANTENIMIENTO.'],
    ['', '', ''],
    ['texto', 'BAC - por codigo de transaccion', ''],
    ['texto', 'L1', 'INGRESO_TARJETA'],
    ['texto', 'PT y DB', 'PAGO_TARJETA_CREDITO'],
    ['texto', 'MD', 'TRANSFERENCIA_SALIENTE'],
    ['texto', 'TF', 'TRANSFERENCIA'],
    ['texto', 'MC', 'INGRESO_TRANSFERENCIA'],
    ['texto', '59 y 3F', 'COMISIONES_BANCARIAS'],
    ['', '', ''],
    ['texto', 'Tarjeta de credito', ''],
    ['texto', 'GOOGLE*ADS, FACEBK', 'MARKETING_DIGITAL'],
    ['texto', 'GOOGLE*WORKSPACE, HIGHLEVEL, ANTHROPIC', 'CUOTAS_Y_SUSCRIPCIONES'],
    ['texto', 'TIGO, CLARO', 'TELEFONOS_Y_CELULARES'],
    ['texto', 'Restaurantes y cafes en Antigua, viajes y consumos en el exterior', 'PERSONAL con Es_Personal = Si'],
    ['', '', ''],

    ['seccion', 'EVENTOS PRIVADOS', ''],
    ['texto', 'Un evento privado NO se mezcla con las ventas de restaurante.', 'Se reporta como ingreso adicional, aparte.'],
    ['texto', 'Como reconocerlo', 'Un solo ticket inusualmente grande, sin comensales en Notas, pagado con cheque o en "Otros".'],
    ['texto', 'Como marcarlo', 'Escribi EVENTO en la columna Notas y "EVENTO PRIVADO - detalle" en la columna Productos. El dashboard lo separa automaticamente.'],
    ['texto', 'Por que importa', 'El evento de agosto 2026 fue Q10,821 de una sola vez. Mezclado, subia el ticket promedio de Q291 a Q369 y hundia el COGS aparente de 27.6% a 21.8%.'],
    ['', '', ''],

    ['seccion', 'REGLAS QUE NO SE ROMPEN', ''],
    ['texto', 'Nunca borres historico.', 'Si te equivocaste, agrega una fila correctiva y deja constancia en la columna Nota.'],
    ['texto', 'Los gastos con Es_Personal = Si se excluyen solos del reporte al contador.', 'Desde el 1 de mayo de 2026 lo personal va en cuentas separadas.'],
    ['texto', 'Las semanas son ISO 8601.', 'Se calculan con WEEKNUM(fecha, 21). No las escribas a mano.'],
    ['texto', 'COGS son tres categorias: ALIMENTOS, BEBIDAS, COCTELERIA.', 'Todo lo demas es gasto operativo.'],
    ['texto', 'Si un mes viene incompleto, espera el mes cerrado.', 'Cargar un mes parcial descuadra la validacion contra el banco.'],
    ['', '', ''],

    ['seccion', 'PENDIENTE ABIERTO', ''],
    ['texto', '01b_FEL_Emitidas solo tiene junio 2026.', 'Sin julio y agosto, el IVA debito del reporte mensual se estima desde el POS y NO es declarable. Hay que bajar de SAT el reporte de documentos EMITIDOS de esos meses y pegarlo.'],
    ['', '', ''],
    ['nota', 'Rosanta - Cocina con Carisma - 14 N / 91 W', '']
  ];

  var datos = [];
  for (var i = 0; i < filas.length; i++) {
    datos.push([filas[i][1], filas[i][2]]);
  }
  sh.getRange(1, 1, datos.length, 2).setValues(datos);

  var VERDE = '#456B50', CREMA = '#F0EDE6', TINTA = '#2c2a26', GRIS = '#7d7a72';
  sh.setColumnWidth(1, 430);
  sh.setColumnWidth(2, 620);
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
