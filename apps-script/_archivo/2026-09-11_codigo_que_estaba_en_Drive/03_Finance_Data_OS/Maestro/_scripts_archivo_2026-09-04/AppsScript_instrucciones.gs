/**
 * ROSANTA — Regenera la hoja 00_Instrucciones
 *
 * Borra la hoja 00_Instrucciones vieja (hablaba de "03_Banco_BAC" y del
 * selector en B1, que ya no existen) y la reescribe con el estado real
 * del archivo al 1 de septiembre de 2026.
 *
 * Cómo usarlo:
 *   1. En el maestro: Extensiones → Apps Script
 *   2. Archivo → + → Script, nombralo "instrucciones"
 *   3. Pegá TODO este archivo ahí (no borres el script del espejo)
 *   4. Guardá, elegí "regenerarInstrucciones" en el selector y dale ▶ Ejecutar
 *   5. Volvé al Sheet: la pestaña 00_Instrucciones queda nueva y en primer lugar
 *
 * Se puede volver a correr las veces que haga falta: siempre reemplaza.
 */

function regenerarInstrucciones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var vieja = ss.getSheetByName('00_Instrucciones');
  if (vieja) ss.deleteSheet(vieja);
  var sh = ss.insertSheet('00_Instrucciones', 0);

  var T = 'titulo', H = 'seccion', B = 'texto', N = 'nota';
  var filas = [
    [T, 'ROSANTA — MAESTRO FINANCIERO 2026', 'CORSAGA, S.A. · Antigua Guatemala'],
    [N, 'Última revisión de estas instrucciones', '1 de septiembre de 2026'],
    ['', '', ''],

    [H, 'QUÉ ES ESTE ARCHIVO', ''],
    [B, 'Fuente única de verdad de las finanzas de Rosanta.', 'Se edita SOLO acá. No hay copias paralelas: cualquier archivo que empiece con ZZ_ARCHIVO_ está muerto y no se toca.'],
    [B, 'Un Apps Script exporta cada lunes 10:30 el archivo Rosanta_Maestro_ESPEJO.xlsx a esta misma carpeta.', 'Ese espejo es un DERIVADO que lee el generador del dashboard. Nunca lo edites: se sobrescribe entero en cada corrida.'],
    ['', '', ''],

    [H, 'LAS 14 HOJAS', ''],
    [B, 'BASES DE DATOS (acá se pega la información cruda)', ''],
    [B, '00_Proveedores', 'Catálogo. Cada proveedor con su Categoría_Normalizada y Es_Personal. Las hojas de FEL lo consultan por VLOOKUP.'],
    [B, '01_FEL_Maestro', 'Facturas RECIBIDAS (compras). Columnas A-K se pegan; L-P se calculan solas.'],
    [B, '01b_FEL_Emitidas', 'Facturas EMITIDAS (ventas). Fuente del IVA débito fiscal.'],
    [B, '02_Ventas_Maestro', 'Tickets del POS. Columnas A-L se pegan; M-O se calculan solas.'],
    [B, '03_Banco_Industrial', 'Cuenta 6500002057. Movimientos mensuales.'],
    [B, '04_Banco_BAC', 'Cuenta 904802543 (quetzales).'],
    [B, '05_Tarjeta_Credito_BAC', 'Tarjeta 4966-64**-****-2794, en Q y USD.'],
    ['', '', ''],
    [B, 'REPORTES (se calculan solos, no se escriben a mano)', ''],
    [B, '04_Reporte_Semanal', 'Semana operativa. Selector: celda D3 = número de semana ISO.'],
    [B, '05_Reporte_Contador', 'Versión semanal limpia.'],
    [B, '06_Dashboard_Operativo', 'Marketing, ROAS y reservas. Uso interno, no va al contador.'],
    [B, '07_Reporte_Mensual', 'Cierre del mes. Selectores: B3 = año, D3 = mes (1-12).'],
    [B, '08_Reporte_Contador_Mensual', 'Lo que se exporta a PDF y se manda al contador.'],
    [B, '09_PnL_Mensual', 'Estado de resultados del mes.'],
    ['', '', ''],

    [H, 'RUTINA SEMANAL (cada lunes)', ''],
    [B, '1. Pegá el export del POS al final de 02_Ventas_Maestro.', 'Antes de pegar, revisá que el TicketId más bajo del export sea mayor al último que ya está cargado. Si se solapan, hay duplicados.'],
    [B, '2. Pegá el FEL recibido del SAT al final de 01_FEL_Maestro.', 'Verificá duplicados por la pareja (Serie, Número del DTE). En agosto 2026 se colaron 18 facturas repetidas por saltarse este paso.'],
    [B, '3. Revisá si quedó algo en POR_CLASIFICAR.', 'Si aparece, agregá el proveedor a 00_Proveedores con su categoría y el POR_CLASIFICAR se resuelve solo.'],
    [B, '4. Cambiá D3 en 04_Reporte_Semanal al número de semana.', ''],
    ['', '', ''],

    [H, 'RUTINA MENSUAL (inicio de mes)', ''],
    [B, '1. Pegá los estados de cuenta del mes cerrado.', 'Banco Industrial → hoja 03. BAC quetzales → hoja 04. Tarjeta de crédito → hoja 05.'],
    [B, '2. VALIDÁ CONTRA EL BANCO. Regla dura, no opcional.', 'La suma de débitos y créditos de cada hoja tiene que dar EXACTAMENTE igual a los totales impresos al final del PDF del banco. Si no cuadra, hay error de carga: corregí antes de seguir. El mes no se cierra hasta que cuadre.'],
    [B, '3. Fijá B3 (año) y D3 (mes) en 07_Reporte_Mensual.', ''],
    [B, '4. Exportá 08_Reporte_Contador_Mensual a PDF y mandalo al contador.', ''],
    ['', '', ''],

    [H, 'REGLAS DE CATEGORIZACIÓN', ''],
    [B, 'Banco Industrial', ''],
    [B, 'VISANET', 'INGRESO_TARJETA'],
    [B, 'ATM y retiros Bancared', 'ALIMENTOS_EFECTIVO (son compras de mercado en efectivo)'],
    [B, 'S## o "1a/2a <Mes>" seguido de nombre del roster', 'NOMINA. Roster: Marvin, Eddy, Melvin, Fernanda, Andre, Toni, Jose, Jeffry, Nadia, Efrain.'],
    [B, 'S## seguido de proveedor o concepto', 'La categoría del proveedor, NO nómina. Ejemplos: S31Elitemarcas = BEBIDAS, S30Jardineria = MANTENIMIENTO.'],
    ['', '', ''],
    [B, 'BAC — por código de transacción', ''],
    [B, 'L1', 'INGRESO_TARJETA'],
    [B, 'PT y DB', 'PAGO_TARJETA_CREDITO'],
    [B, 'MD', 'TRANSFERENCIA_SALIENTE'],
    [B, 'TF', 'TRANSFERENCIA'],
    [B, 'MC', 'INGRESO_TRANSFERENCIA'],
    [B, '59 y 3F', 'COMISIONES_BANCARIAS'],
    ['', '', ''],
    [B, 'Tarjeta de crédito', ''],
    [B, 'GOOGLE*ADS, FACEBK', 'MARKETING_DIGITAL'],
    [B, 'GOOGLE*WORKSPACE, HIGHLEVEL, ANTHROPIC', 'CUOTAS_Y_SUSCRIPCIONES'],
    [B, 'TIGO, CLARO', 'TELEFONOS_Y_CELULARES'],
    [B, 'Restaurantes y cafés en Antigua, viajes y consumos en el exterior', 'PERSONAL con Es_Personal = Sí'],
    ['', '', ''],

    [H, 'EVENTOS PRIVADOS', ''],
    [B, 'Un evento privado NO se mezcla con las ventas de restaurante.', 'Se reporta como ingreso adicional, aparte.'],
    [B, 'Cómo reconocerlo', 'Un solo ticket inusualmente grande, sin comensales en Notas, pagado con cheque o en "Otros".'],
    [B, 'Cómo marcarlo', 'Escribí EVENTO en la columna Notas y "EVENTO PRIVADO — <detalle>" en la columna Productos. El dashboard lo separa automáticamente.'],
    [B, 'Por qué importa', 'El evento de agosto 2026 fue Q10,821 de una sola vez. Mezclado, subía el ticket promedio de Q291 a Q369 y hundía el COGS aparente de 27.6% a 21.8%.'],
    ['', '', ''],

    [H, 'REGLAS QUE NO SE ROMPEN', ''],
    [B, 'Nunca borres histórico.', 'Si te equivocaste, agregá una fila correctiva y dejá constancia en la columna Nota.'],
    [B, 'Los gastos con Es_Personal = Sí se excluyen solos del reporte al contador.', 'Desde el 1 de mayo de 2026 lo personal va en cuentas separadas.'],
    [B, 'Las semanas son ISO 8601.', 'Se calculan con WEEKNUM(fecha, 21). No las escribas a mano.'],
    [B, 'COGS son tres categorías: ALIMENTOS, BEBIDAS, COCTELERIA.', 'Todo lo demás es gasto operativo.'],
    [B, 'Si un mes viene incompleto (por ejemplo del 1 al 19), esperá el mes cerrado.', 'Cargar un mes parcial descuadra la validación contra el banco.'],
    ['', '', ''],

    [H, 'PENDIENTE ABIERTO', ''],
    [B, '01b_FEL_Emitidas solo tiene junio 2026.', 'Sin julio y agosto, el IVA débito del reporte mensual se estima desde el POS y NO es declarable. Hay que bajar de SAT el reporte de documentos EMITIDOS de esos meses y pegarlo.'],
    ['', '', ''],
    [N, 'Rosanta · Cocina con Carisma · 14° N · 91° W', '']
  ];

  var datos = filas.map(function (f) { return [f[1], f[2]]; });
  sh.getRange(1, 1, datos.length, 2).setValues(datos);

  // Formato
  var VERDE = '#456B50', CREMA = '#F0EDE6', TINTA = '#2c2a26', GRIS = '#7d7a72';
  sh.setColumnWidth(1, 430).setColumnWidth(2, 620);
  sh.getRange(1, 1, datos.length, 2)
    .setFontFamily('Lato').setFontSize(10).setFontColor(TINTA)
    .setVerticalAlignment('top').setWrap(true);

  filas.forEach(function (f, i) {
    var r = i + 1, tipo = f[0];
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
  });

  sh.setFrozenRows(2);
  sh.getRange('A1').activate();
  SpreadsheetApp.getUi().alert('Listo: 00_Instrucciones regenerada con ' + datos.length + ' filas.');
}
