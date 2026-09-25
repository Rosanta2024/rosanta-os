// ============================================================
// ROSANTA - Pagos de gestion de pauta fuera del doble conteo
// Preparado el 2 sep 2026, confirmado por Juanma.
//
// EL PROBLEMA
// Edwin Daniel Flores Gonzalez factura Q2,000 al mes por FEL con
// categoria SERVICIOS PROFESIONALES. Esa factura ya entra al P&L
// por la fila 29 ('07_Reporte_Mensual'!B44 incluye B32).
// La transferencia del Banco Industrial que PAGA esa factura estaba
// como MARKETING_DIGITAL, y la nota 5 del P&L suma esa categoria
// en la fila 33. Resultado: el mismo gasto contado dos veces,
// Q2,000 por mes, Q14,000 en 2026.
//
// El mismo error, mas chico, con la empresa de monitoreo: el pago de
// marzo a EX SECURITY GROUP quedo como MARKETING_DIGITAL en vez de
// SERVICIO DE MONITOREO Y ALARMA. Q250 mas contados dos veces.
//
// LA CORRECCION
// Recategorizar esas transferencias a SERVICIOS_PROFESIONALES, que
// es lo que realmente son. Esa categoria NO esta en la lista de la
// nota 5, asi que sale sola del P&L sin tocar ninguna formula. La
// factura sigue entrando una vez, por FEL.
//
// Mismo criterio que ALIMENTOS o BEBIDAS: el pago por banco de una
// factura que ya esta en FEL no se suma, se excluye.
//
// NO TOCA EL ROAS. El denominador del ROAS de la intranet nunca
// leyo el maestro: sale de las APIs de Meta y Google. Esto es
// exclusivamente el lado del DRE.
//
// Busca cada movimiento por su CONTENIDO (fecha + descripcion +
// monto), nunca por numero de fila. Y cada uno declara de que categoria
// viene: solo se toca si la celda todavia dice eso. Ese es el candado
// que lo hace idempotente.
//
// USO (igual que el de anuladas):
//   1. correr "recategorizarPautaGestion" tal cual -> solo dice que haria
//   2. poner PREVIEW_RPG = false
//   3. correr otra vez -> escribe
//   Es idempotente: cada fila declara de que categoria viene, asi que
//   una vez movida ya no vuelve a tocarse.
// ============================================================

var PREVIEW_RPG  = true;   // <-- poner en false para escribir de verdad

var SHEET_ID_RPG = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// hoja -> [colFecha, colDesc, colDebito, colCredito, colCategoria, colPersonal]
var MAPA_RPG = {
  '03_Banco_Industrial':    [1, 3, 4, 5, 7, 8],
  '05_Tarjeta_Credito_BAC': [1, 2, 3, 4, 5, 6]   // debito = Quetzales, credito = Dolares
};

// [hoja, fecha, descripcion, debito, credito, categoriaNUEVA, esPersonal, categoriaACTUAL]
// La categoria actual es el candado: si la celda ya no dice eso, no se toca.
// Por eso se puede correr dos veces sin dano y por eso cada fila declara de
// donde viene, no solo a donde va.
//
// Los siete pagos a Edwin. Febrero trae Q4,000 porque cubre las
// facturas de diciembre y enero, que son de 2025 y no estan en este
// libro; sale igual del P&L de febrero porque el gasto no pertenece
// a ese mes. Abril trae Q250 de mas que el resto: si esos Q250 son
// otra cosa metida en la misma transferencia, hay que separarlos a
// mano, porque una fila del banco no se puede partir por script.
var LOTE_RPG = [
  ['03_Banco_Industrial', '2026-02-06', 'Dic y Enero marketing', 4000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-03-24', 'Marketing Marzo26', 2000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-04-17', 'Marketing Abril 2026', 2250, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-05-14', 'Marketing Mayo26', 2000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-06-16', 'junio marketing', 2000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-07-20', 'MarketingJulio', 2000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],
  ['03_Banco_Industrial', '2026-08-26', 'ContenidoAgosto2026', 2000, 0, 'SERVICIOS_PROFESIONALES', 'No', 'MARKETING_DIGITAL'],

  // BTS = EX SECURITY GROUP, la empresa de monitoreo. Nada que ver con
  // marketing: cayo en esa categoria por error. Factura Q250 al mes por
  // FEL, y sus pagos de enero, febrero, mayo, junio y julio ya estan en
  // SERVICIO DE MONITOREO Y ALARMA. Marzo era el unico suelto, asi que
  // esto ademas destapa un doble conteo de Q250 en marzo, igual que Edwin.
  ['03_Banco_Industrial', '2026-03-24', 'BTS Marzo26', 250, 0, 'SERVICIO DE MONITOREO Y ALARMA', 'No', 'MARKETING_DIGITAL'],

  // Vanessa, agosto. La transferencia del banco no paso, asi que se le pago por
  // PayPal con la tarjeta. Mismo honorario de siempre, otra via de pago, pero
  // habia quedado como SERVICIOS_PROFESIONALES y por eso el bloque de marketing
  // no lo veia. Va a MARKETING_DIGITAL para que quede igual que sus otros pagos.
  //
  // Esto NO duplica nada: la fila 37 del P&L suma TODOS los cargos de tarjeta
  // sin mirar categoria, asi que el gasto ya estaba contado una vez y sigue
  // contado una vez. Lo unico que cambia es que ahora se puede identificar.
  ['05_Tarjeta_Credito_BAC', '2026-08-21', 'PAYPAL *VANEWILCHES17 4029357733', 0, 190, 'MARKETING_DIGITAL', 'No', 'SERVICIOS_PROFESIONALES']
];

// ------------------------------------------------------------
// LAS CUATRO "BANCA ELECTRONICA" NO SE TOCAN - resuelto 2-sep-2026
//
//   2026-04-17  Q1,791.70    2026-06-23  Q1,592.85
//   2026-05-14  Q1,590.80    2026-07-20  Q1,592.85    total Q6,568.20
//
// Son los honorarios de Vanessa Wilches, que gestiona la pauta desde
// Colombia. Tres de los cuatro caen el mismo dia que el pago a Edwin;
// el de junio va una semana despues. La fecha no es el criterio. NO emite FEL guatemalteca y no va a emitirla: es
// proveedora del exterior. Se confirmo buscando en las 1,037 facturas
// del libro, ninguna cuadra con esos montos.
//
// Por eso se quedan en MARKETING_DIGITAL y el P&L las sigue sumando.
// Es gasto de marketing real, pagado por banco, sin factura: el mismo
// caso que NOMINA o MANTENIMIENTO, y justo para lo que existe la
// lista de la nota 5.
//
// NO las pases a SERVICIOS_PROFESIONALES. Esa categoria funciona para
// Edwin porque su factura entra por FEL y el gasto se cuenta igual
// una vez. Sin factura detras, moverlas las saca del P&L y no entran
// por ningun otro lado: se borrarian Q6,568.20 de gasto real. Es el
// mismo error del doble conteo, en la direccion contraria.
//
// La fila 33 del P&L se llama "Marketing digital (agencia Colombia)".
// Despues de esta correccion el rotulo por fin dice la verdad: ahi
// queda Vanessa y nada mas.
// ------------------------------------------------------------

function _fRPG(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _nRPG(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function recategorizarPautaGestion() {
  var ss = SpreadsheetApp.openById(SHEET_ID_RPG);
  var escritas = 0, monto = 0, avisos = [];

  for (var i = 0; i < LOTE_RPG.length; i++) {
    var it = LOTE_RPG[i], c = MAPA_RPG[it[0]], sh = ss.getSheetByName(it[0]);
    if (!sh) { avisos.push('No existe la hoja ' + it[0]); continue; }

    var datos = sh.getDataRange().getValues(), hit = 0;
    for (var r = 0; r < datos.length; r++) {
      var fila = datos[r];
      if (_fRPG(fila[c[0] - 1]) !== it[1]) continue;
      if (String(fila[c[1] - 1] || '').trim().toUpperCase() !== it[2].toUpperCase()) continue;
      if (Math.abs(_nRPG(fila[c[2] - 1]) - it[3]) > 0.01) continue;
      // El candado: solo se toca lo que todavia esta mal clasificado.
      // Corrido dos veces, la segunda no encuentra nada y lo dice.
      if (sh.getRange(r + 1, c[4]).getValue() !== it[7]) continue;
      if (!PREVIEW_RPG) {
        sh.getRange(r + 1, c[4]).setValue(it[5]);
        sh.getRange(r + 1, c[5]).setValue(it[6]);
      }
      Logger.log('  ' + (PREVIEW_RPG ? 'haria: ' : 'movido: ') + it[1] + '  ' + it[2] +
                 '  Q' + it[3] + '   ' + it[7] + ' -> ' + it[5]);
      escritas++; hit++;
      // Solo cuenta como doble conteo lo que SALE de MARKETING_DIGITAL.
      // Lo que entra (Vanessa) no estaba duplicado, solo mal clasificado.
      if (it[7] === 'MARKETING_DIGITAL') monto += it[3];
    }
    if (!hit) avisos.push('Sin coincidencias pendientes: ' + it[1] + ' ' + it[2] + ' Q' + it[3]);
  }

  Logger.log((PREVIEW_RPG ? 'PREVIEW · movimientos que se moverian: ' : 'Movimientos recategorizados: ') +
             escritas + ' de ' + LOTE_RPG.length);
  Logger.log('Gasto que deja de contarse dos veces: Q' + monto.toFixed(2));
  for (var z = 0; z < avisos.length; z++) Logger.log('  ' + avisos[z]);
  if (PREVIEW_RPG) {
    Logger.log('');
    Logger.log('PREVIEW: no se escribio nada. Poner PREVIEW_RPG = false y volver a correr.');
    return;
  }
  resumenMarketingRPG();
}

/** Que queda en MARKETING_DIGITAL despues de la limpieza: solo gasto
 *  de marketing SIN factura, que es lo que esa categoria debe tener.
 *  Esperado Q6,568.20 - solo las cuatro de Vanessa.
 *  Si aparece algo mas, es que entro un movimiento nuevo sin revisar. */
function resumenMarketingRPG() {
  var sh = SpreadsheetApp.openById(SHEET_ID_RPG).getSheetByName('03_Banco_Industrial');
  var datos = sh.getDataRange().getValues(), total = 0, n = 0;
  Logger.log('--- Queda en MARKETING_DIGITAL (Banco Industrial) ---');
  for (var r = 1; r < datos.length; r++) {
    if (datos[r][6] !== 'MARKETING_DIGITAL') continue;
    var d = _nRPG(datos[r][3]);
    total += d; n++;
    Logger.log('  ' + _fRPG(datos[r][0]) + '  ' + String(datos[r][2]).trim() + '  Q' + d.toFixed(2));
  }
  Logger.log('  ' + n + ' movimiento(s), Q' + total.toFixed(2));
}
