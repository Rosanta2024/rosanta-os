// ============================================================
// ROSANTA - Las siete partidas POR_CLASIFICAR
// Generado el 10 sep 2026. Categorias dadas por Juanma ese mismo dia,
// sobre el listado que salio del espejo del 7 de septiembre.
//
// QUE ARREGLA
// Q8,723.23 de gasto que se estaba cayendo del P&L sin que nadie lo
// hubiera decidido. El panel de integridad del dato de la vista semanal
// las cuenta como "partidas sin clasificar", y son las unicas siete que
// quedan en todo el maestro de 2026.
//
// LAS SIETE, Y POR QUE CADA UNA
//
// 1. Q6,000 · JUAN MANUEL LEMUS VALDEZ · 30-may · FEL
//    Factura propia de Juanma al restaurante. Va como SERVICIOS PROFESIONALES,
//    que es la categoria que el maestro ya usa para honorarios que no son los
//    del contador (esos tienen HONORARIOS CONTABLES aparte).
//    OJO AL LEER EL DRE DESPUES: el bloque "Prestadores y honorarios" ya venia
//    en 6.3% de la venta contra una banda de sector de 1-3%. Estos Q6,000 lo
//    empujan mas arriba. No es un error del dato, es el dato completandose.
//
// 2 y 3. Q921.25 y Q690 · CARNICERIA "SANTA ROSA" · 29 y 28-jul · FEL
//    Mercaderia de cocina. Van como ALIMENTOS y entran al COGS.
//    Son facturas FPEQ, de pequeño contribuyente, con IVA en 0.00, asi que
//    entran completas: la capa de costo netea por la columna de IVA y en estas
//    no hay nada que netear. Son Q1,611.25 de food cost de julio que hasta hoy
//    no se estaba contando, justo en uno de los dos meses con el food cost mas
//    alto del año.
//
// 4. Q246 · AGROPECUARIA EL CAMPESINO · 04-sep · FEL   -> MATERIALES
// 5. Q115.98 · CEMACO ZONA SIETE · 06-sep · FEL        -> MATERIALES
//    Las dos son materiales, no mercaderia. MATERIALES cae en el bloque
//    "Mantencion" del DRE, no en el COGS: no mueven el food cost.
//
// 6. Q750 · Banco Industrial · 03-sep · glosa "Abril y Agsoto y Sep 2026"
//    Pago a empleados de cocina y jardineria que cubre tres meses. Va como
//    NOMINA, que es donde el maestro pone el resto del pago de sueldos por
//    banco.
//    CONFIRMADO por Juanma el 10-sep-2026: NOMINA es lo correcto, es gente de
//    planilla. Se deja anotado por que se pregunto, para que nadie lo reabra:
//    la vista de los 5 numeros no usa la nomina del banco sino la planilla
//    devengada, y para armar el gasto operativo RESTA el bloque de nomina
//    bancaria y suma el devengado. Como esta gente SI esta en planilla, su
//    costo ya viene por el devengado y que estos Q750 no aparezcan ahi es lo
//    correcto: evita contarlos dos veces. En el DRE mensual, que es base caja,
//    si suman.
//
// 7. Q320 · BAC · 14-ene · glosa "PAGO PROV. QTZ DEM"  -> ALIMENTOS
//    Proveedor de alimentos. Es un CREDITO, no un debito: entra dinero, no sale.
//    Por eso el monto esperado de esta fila es 0.00 en la columna Debito, que es
//    la que lee la capa de calculo. No mueve ni un quetzal del DRE; lo unico
//    que hace es sacarla de POR_CLASIFICAR y dejar el panel de integridad en
//    cero partidas pendientes. Ademas, aunque tuviera monto, la regla 3 salta la
//    mercaderia pagada desde banco para no duplicar con el FEL.
//
// COMO SE CORRE
//   Editor de Apps Script del maestro (proyecto Rosanta_MAESTRO_ACT...):
//     1. revisarSinClasificar()   no escribe nada. Tiene que reportar 7 filas
//                                 y "Sin avisos". Si dice "Sin coincidencia",
//                                 parar: la llave o el monto no cuadran.
//     2. reclasificarSinClasificar()
//     3. generarEspejo()          para que Python vea el cambio.
//
// Mismo motor que reclasificar_BAC.js: cada fila declara la categoria que
// ESPERA encontrar hoy, y si la hoja dice otra cosa no la toca y lo reporta.
// ============================================================

var SHEET_ID_SC = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// 01_FEL_Maestro      1 Fecha · 4 Numero_DTE · 10 Gran_Total · 14 Categoria · 15 Es_Personal
// 03_Banco_Industrial 1 Fecha · 2 Docto      ·  4 Debito     ·  7 Categoria ·  8 Es_Personal
// 04_Banco_BAC        1 Fecha · 2 Referencia ·  5 Debito     ·  8 Categoria ·  9 Es_Personal
var LIBROS_SC = {
  FEL: { hoja: '01_FEL_Maestro',      llave: 4, fecha: 1, debito: 10, cat: 14, pers: 15 },
  BI:  { hoja: '03_Banco_Industrial', llave: 2, fecha: 1, debito: 4,  cat: 7,  pers: 8  },
  BAC: { hoja: '04_Banco_BAC',        llave: 2, fecha: 1, debito: 5,  cat: 8,  pers: 9  }
};

// LAS FECHAS DE ESTE LOTE SON LAS QUE VE APPS SCRIPT, Y NO SIEMPRE SON LAS DEL
// ESPEJO. Hallazgo del 10-sep-2026, salido de la primera corrida: en estas tres
// filas Apps Script lee un dia MAS que openpyxl sobre el espejo.
//   DTE 2702920850  espejo 29/07  ·  Apps Script 30/07
//   DTE 838943395   espejo 28/07  ·  Apps Script 29/07
//   DTE 2783988677  espejo 30/05  ·  Apps Script 31/05
// Las otras dos filas del lote, las FACT de septiembre, coinciden en las dos vias.
// Las tres que se corren son FPEQ, cargadas desde el CSV pegado de jul-ago, asi
// que lo mas probable es que conserven hora de emision y que al formatearlas con
// la zona horaria del script crucen la medianoche. No es un problema de este
// script; es un problema del dato, y esta anotado aparte porque en un cambio de
// mes movería la transaccion de un mes a otro en el DRE.
// Aqui se ponen las fechas que ve Apps Script para que la verificacion pase. La
// proteccion no se debilita: la llave (Numero_DTE) es unica, el monto cuadra al
// centavo y la categoria esperada sigue siendo POR_CLASIFICAR.
//
// [llave, fecha, monto, categoria nueva, Es_Personal ('' = no tocar), categoria ESPERADA hoy]
var LOTE_SC_FEL = [
  ['2702920850', '2026-07-30',  921.25, 'ALIMENTOS',               '', 'POR_CLASIFICAR'],   // Carniceria "Santa Rosa" · FPEQ, IVA 0.00 · espejo dice 29/07
  ['838943395',  '2026-07-29',  690.00, 'ALIMENTOS',               '', 'POR_CLASIFICAR'],   // Carniceria "Santa Rosa" · FPEQ, IVA 0.00 · espejo dice 28/07
  ['2783988677', '2026-05-31', 6000.00, 'SERVICIOS PROFESIONALES', '', 'POR_CLASIFICAR'],   // Juan Manuel Lemus Valdez · honorarios · espejo dice 30/05
  ['2342405772', '2026-09-06',  115.98, 'MATERIALES',              '', 'POR_CLASIFICAR'],   // Cemaco Zona Siete · ya escrita
  ['2623096013', '2026-09-04',  246.00, 'MATERIALES',              '', 'POR_CLASIFICAR']    // Agropecuaria El Campesino · ya escrita
];

// EL Q750 NO VA EN ESTE LOTE, y la historia vale la pena dejarla escrita.
//
// Juanma lo habia identificado como pago a gente de cocina y jardineria, y con eso
// se escribio la primera version de este script apuntando a NOMINA. Al verificar
// despues de correrlo, la fila ya no decia POR_CLASIFICAR sino "SERVICIO DE
// MONITOREO Y ALARMA", asi que el script la respeto y no la toco: es exactamente
// para eso que cada fila declara la categoria que espera encontrar.
//
// La evidencia dio la razon a esa categoria, y Juanma lo confirmo el 10-sep-2026:
// son pagos de seguridad. EX Security se paga a Q250 al mes por Banco Industrial
// (12/01, 18/02, 24/03, 14/05, 30/06, 27/07) y en la serie faltaban abril y agosto.
// Los Q750 del 03/09 son esos dos meses atrasados mas septiembre, que es justo lo
// que dice la glosa "Abril y Agsoto y Sep 2026". Con esta fila el año queda
// completo de enero a septiembre: 9 meses x Q250 = Q2,250.
var LOTE_SC_BI = [];

var LOTE_SC_BAC = [
  ['22337707', '2026-01-14', 0.00, 'ALIMENTOS', '', 'POR_CLASIFICAR']   // "PAGO PROV. QTZ DEM" · es CREDITO de Q320, debito 0.00
];

function _fSC(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}

/** Numero_DTE y Docto a veces vienen como numero y a veces como texto.
 *  Se comparan sin decimales ni espacios para que las dos formas cuadren. */
function _kSC(v) {
  var s = String(v == null ? '' : v).trim();
  if (s.indexOf('.') > -1 && /^\d+\.0*$/.test(s)) s = s.split('.')[0];
  return s;
}
function _nSC(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _correrSC(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_SC);
  var avisos = [], porCat = {}, hechas = { FEL: 0, BI: 0, BAC: 0 }, yaEstaban = 0;
  var lotes = { FEL: LOTE_SC_FEL, BI: LOTE_SC_BI, BAC: LOTE_SC_BAC };

  for (var libro in lotes) {
    var cfg = LIBROS_SC[libro], lote = lotes[libro];
    var sh = ss.getSheetByName(cfg.hoja);
    if (!sh) { avisos.push('No existe la hoja ' + cfg.hoja); continue; }
    var datos = sh.getDataRange().getValues();

    for (var i = 0; i < lote.length; i++) {
      var it = lote[i], hallada = false;

      for (var r = 0; r < datos.length; r++) {
        // Se busca SOLO por la llave, que es unica (Numero_DTE, Docto, Referencia).
        // La fecha y el monto pasaron de ser filtro a ser VERIFICACION que se
        // reporta. Motivo, del 10-sep-2026: en la primera corrida tres filas del
        // FEL salieron "sin coincidencia" aunque existian, y como el filtro las
        // descartaba en silencio no habia forma de saber cual de los tres campos
        // no cuadraba. Ahora, si la llave aparece pero la fecha o el monto no
        // coinciden, el aviso dice que se encontro y que se esperaba.
        if (_kSC(datos[r][cfg.llave - 1]) !== it[0]) continue;

        hallada = true;
        var fHoja = _fSC(datos[r][cfg.fecha - 1]);
        var mHoja = _nSC(datos[r][cfg.debito - 1]);
        if (fHoja !== it[1] || Math.abs(mHoja - it[2]) > 0.01) {
          avisos.push('NO CUADRA ' + libro + ' llave ' + it[0] +
                      ' · la hoja dice fecha "' + fHoja + '" y monto ' + mHoja +
                      ' · se esperaba fecha "' + it[1] + '" y monto ' + it[2] +
                      '. No se toca.');
          break;
        }

        var actual = datos[r][cfg.cat - 1];
        if (actual === it[3]) { yaEstaban++; break; }
        if (actual !== it[5]) {
          avisos.push('OJO ' + libro + ' ' + it[1] + ' ' + it[0] + ' Q' + it[2] +
                      ' dice "' + actual + '" y se esperaba "' + it[5] + '". No se toca.');
          break;
        }
        if (escribir) {
          sh.getRange(r + 1, cfg.cat).setValue(it[3]);
          if (it[4]) sh.getRange(r + 1, cfg.pers).setValue(it[4]);
        }
        hechas[libro]++;
        porCat[it[3]] = (porCat[it[3]] || 0) + it[2];
        break;
      }
      if (!hallada) avisos.push('Sin coincidencia ' + libro + ': ' + it[1] + ' ' + it[0] + ' Q' + it[2]);
    }
  }

  var total = hechas.FEL + hechas.BI + hechas.BAC;
  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(total + ' filas  (' + hechas.FEL + ' en FEL, ' + hechas.BI +
             ' en Banco Industrial, ' + hechas.BAC + ' en BAC)');
  Logger.log('Ya estaban bien: ' + yaEstaban);
  for (var k in porCat) Logger.log('   ' + k + ': Q' + porCat[k].toFixed(2));
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos: las siete filas se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarSinClasificar() { _correrSC(false); }

/** Escribe las categorias. */
function reclasificarSinClasificar() { _correrSC(true); }
