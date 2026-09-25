// ============================================================
// ROSANTA - Reclasificacion de movimientos bancarios
// Generado el 3 sep 2026 con las cuentas que Juanma identifico,
// verificadas contra el Historico transaccional del BAC.
//
// QUE ARREGLA
// 1. Nomina y propina pagadas desde el BAC: quedaban como
//    TRANSFERENCIA_SALIENTE y desaparecian del costo laboral. Por eso
//    febrero mostraba Q5,988 de nomina contra Q28,875 de planilla real.
// 2. Retiros del socio a la cuenta de Juanma (974954208).
// 3. Pagos a empresas de eventos sin factura. Uno de ellos, Q7,600,
//    estaba como ALQUILERES e inflaba la renta del año.
// 4. Gastos personales dentro del gasto operativo, incluida la
//    "RentaPanoramajulio2026" de Q10,000 y las cuotas del gimnasio.
// 5. Proveedores que salian como transferencia generica: gas, limpieza
//    y cocteleria.
// 6. Cuatro errores en Banco Industrial en julio: tres pagos de
//    productos de limpieza contados como BEBIDAS (o sea, dentro del
//    COGS) y un pago de cocteleria contado como NOMINA.
// 7. Las 10 facturas FEL de Tavito, que estaban como BEBIDAS y son
//    cocteleria.
//
// CUENTAS IDENTIFICADAS POR JUANMA
//   974521858 Jeffry            974514929 Jose
//   974519654 Nadia             974519373 Efrain
//   974522203 Fernanda          974954208 Juanma (socio)
//   902031855 Producciones Talishte / Andrea Moreno Gil (eventos, sin factura)
//   975862723 Volcan (eventos, sin factura)
//   902409168 IGYM, S.A. (gimnasio, personal)
//   902410067 Doorways, S.A. (productos de limpieza)
//   903941979 Tavito / Felix Menelik Donis Yuman (cocteleria)
//   900438701 Oscar Asturias / Altogas (gas)
//   GRUPO AGMN, S.A. (personal)
//
// SUELDO vs PROPINA: se separa por el monto. Los de propina son los de
// la columna Propina de la planilla de ese mes (1812 y 1153 en mayo,
// 2052 y 1306 en junio). Todo lo demas es sueldo. La propina NO es
// costo del negocio: la paga el cliente y solo pasa por la cuenta, asi
// que va a PROPINAS_AL_EQUIPO y queda fuera del prime cost.
//
// EL PAGO DE GAS Y EL DOBLE CONTEO
//   El Q1,380 del 17/03 es el pago de la factura de gas de febrero, que
//   ya entro por FEL. Se clasifica como GAS porque eso es lo que es: el
//   maestro guarda la verdad. Evitar el doble conteo es trabajo de la
//   capa de calculo, que para cada categoria presente en FEL descarta el
//   movimiento bancario. Misma logica que ya se aplica a ALIMENTOS.
//
// ALIMENTOS_EFECTIVO no significa "pagado en efectivo": es el bucket de
//   alimentos SIN FACTURA. Por eso el pescado de Byron Melgar va ahi y
//   no a ALIMENTOS: si fuera ALIMENTOS se perderia del COGS.
//
// Busca cada fila por su CONTENIDO (referencia o documento + fecha +
// debito), nunca por numero de fila, y solo escribe si la categoria
// actual es la esperada, que va declarada fila por fila. Se puede
// correr dos veces sin dano.
//
// USO: pegar en un archivo nuevo del proyecto del maestro, Cmd+S,
//      correr "revisarReclas" (no escribe) y despues "reclasificar".
//      Al terminar, correr generarEspejo().
//
// PENDIENTE, NO INCLUIDO AQUI
//   - BAC 04/02 ref 900456582 Q21,000 "TF:ACH PERSONAS 900". El
//     Historico transaccional del BAC solo llega hasta marzo, asi que
//     el destino no se puede recuperar en linea. Verificado que NO
//     entro a Banco Industrial ni a la cuenta personal del BAC. Hay que
//     pedirle el detalle al banco con esa referencia.
//   - BAC 20/05 ref 406496009 Q1,300 a la cuenta de Volcan, pendiente
//     de que Juanma la verifique.
//   - BAC 14/04 y 17/04, Q1,000 cada una, a JONAS ANTONIO DOBIAS NUILA.
//     Sin identificar.
//   - Enero y febrero: 02/01 Q1,700 · 17/02 Q750 · 26/02 Q600, tambien
//     fuera de la ventana del historico.
//
// TAVITO
//   Estaba como BEBIDAS en las 10 facturas FEL y como COCTELERIA en el
//   banco. Juanma confirmo que es cocteleria, asi que las facturas se
//   alinean. Las dos categorias son COGS, o sea que el resultado no se
//   mueve; lo que se arregla es el analisis por categoria y el mix de
//   barra. Incluye una factura ANULADA de Q0.00 que se reclasifica
//   igual, para que no quede como la unica de Tavito en BEBIDAS.
// ============================================================

var SHEET_ID_RC = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';

// 04_Banco_BAC        1 Fecha · 2 Referencia · 4 Descripcion · 5 Debito · 8 Categoria · 9 Es_Personal
// 03_Banco_Industrial 1 Fecha · 2 Docto      · 3 Descripcion · 4 Debito · 7 Categoria · 8 Es_Personal
var LIBROS = {
  BAC: { hoja: '04_Banco_BAC',        llave: 2, fecha: 1, debito: 5, cat: 8, pers: 9 },
  BI:  { hoja: '03_Banco_Industrial', llave: 2, fecha: 1, debito: 4, cat: 7, pers: 8 },
  FEL: { hoja: '01_FEL_Maestro',      llave: 4, fecha: 1, debito: 10, cat: 14, pers: 15 }
};

// [llave, fecha, debito, categoria nueva, Es_Personal ('' = no tocar), categoria ESPERADA hoy]
var LOTE_BAC = [
  ['900487223','2026-04-17',3850.00,'MANTENIMIENTO','','TRANSFERENCIA_SALIENTE'],   // Magdalena Pietrzyk · diseno de jardin, mejoramiento. Sin factura
  ['900432347','2026-08-20',2520.00,'ALIMENTOS_EFECTIVO','','TRANSFERENCIA_SALIENTE'],   // Byron Melgar · "S33 Pescado". Alimentos SIN FACTURA
  ['900492396','2026-06-02',1306.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Marvin · propina de mayo, por ACH sin cuenta guardada
  ['900456582','2026-02-04',21000.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // movimiento entre cuentas propias para pagar el alquiler
  ['406440789','2026-02-16',2000.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Efrain · sueldo
  ['406464435','2026-02-16',900.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Fernanda · sueldo
  ['406440501','2026-02-16',2500.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jeffry · sueldo
  ['406464584','2026-02-16',525.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jeffry · sueldo
  ['406440581','2026-02-16',2500.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jose · sueldo
  ['406440712','2026-02-16',2000.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Nadia · sueldo
  ['406432949','2026-02-25',800.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Fernanda · sueldo
  ['406433142','2026-02-25',450.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jeffry · sueldo
  ['406463793','2026-04-23',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406455778','2026-05-01',2000.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Efrain · sueldo
  ['406455575','2026-05-01',2500.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jeffry · sueldo
  ['406455842','2026-05-01',900.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jeffry · sueldo
  ['406455666','2026-05-01',2500.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jose · sueldo
  ['406455707','2026-05-01',2000.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Nadia · sueldo
  ['406471528','2026-05-02',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406491137','2026-05-08',1153.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Efrain · propina
  ['406491097','2026-05-08',1153.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Fernanda · propina
  ['406490979','2026-05-08',1812.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Jeffry · propina
  ['406491023','2026-05-08',1812.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Jose · propina
  ['406494291','2026-05-08',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406491067','2026-05-08',1153.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Nadia · propina
  ['406481657','2026-05-09',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406471218','2026-05-14',2000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406891081','2026-05-17',800.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Fernanda · sueldo
  ['406482295','2026-05-21',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406407308','2026-06-02',1306.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Efrain · propina
  ['406407252','2026-06-02',1306.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Fernanda · propina
  ['406407007','2026-06-02',2052.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Jeffry · propina
  ['406407050','2026-06-02',2052.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Jose · propina
  ['406407181','2026-06-02',1306.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Nadia · propina
  ['406456272','2026-06-05',500.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406485038','2026-06-05',290.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406496319','2026-06-07',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406424134','2026-06-16',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406495458','2026-06-20',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406417875','2026-06-26',1000.00,'DEVOLUCION_INVERSION','','TRANSFERENCIA_SALIENTE'],   // Juanma (socio) · retiro del socio
  ['406480481','2026-04-17',1500.00,'EVENTOS','','TRANSFERENCIA_SALIENTE'],   // Producciones Talishte (sin factura)
  ['406491685','2026-05-08',1920.00,'EVENTOS','','TRANSFERENCIA_SALIENTE'],   // Producciones Talishte (sin factura)
  ['406494781','2026-03-16',375.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // gasto personal
  ['406427699','2026-03-25',100.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // gasto personal
  ['406433271','2026-05-07',475.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // gasto personal
  ['406433947','2026-05-07',100.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // gasto personal
  ['900438701','2026-03-17',1380.00,'GAS','','TRANSFERENCIA_SALIENTE'],   // Oscar Asturias / Altogas · pago de la factura de gas de febrero
  ['406406833','2026-03-17',223.59,'COCTELERIA','','TRANSFERENCIA_SALIENTE'],   // Tavito (Felix Menelik Donis Yuman)
  ['406406978','2026-03-17',553.03,'SUMINISTRO DE LIMPIEZA','','TRANSFERENCIA_SALIENTE'],   // Doorways · productos de limpieza
  ['406431273','2026-08-18',414.00,'SUMINISTRO DE LIMPIEZA','','TRANSFERENCIA'],   // Doorways · productos de limpieza
  ['900426304','2026-03-10',375.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // Grupo AGMN · personal
  ['900430219','2026-03-17',375.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // Grupo AGMN · personal
  ['900456584','2026-03-27',375.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // Grupo AGMN · personal
  ['900434175','2026-04-14',375.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // Grupo AGMN · personal
];

// FEL: la llave es el Numero_DTE
var LOTE_FEL = [
  ['372460549','2026-01-23',494.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['2979482210','2026-02-06',475.56,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['2542159572','2026-02-27',173.33,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['1608794463','2026-02-27',50.26,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['2899067886','2026-04-22',350.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['231099236','2026-05-29',371.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['1314931753','2026-06-04',200.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['1114262447','2026-06-04',0.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['480330786','2026-08-13',628.00,'COCTELERIA','','BEBIDAS'],   // Tavito
  ['4237051889','2026-08-21',305.56,'COCTELERIA','','BEBIDAS'],   // Tavito
];

var LOTE_BI = [
  ['172417','2026-05-18',7600.00,'EVENTOS','','ALQUILERES'],   // Volcan · estaba en ALQUILERES e inflaba la renta
  ['199111','2026-05-06',250.00,'EVENTOS','','ALQUILERES'],   // evento · estaba en ALQUILERES
  ['116549','2026-05-29',223.00,'EVENTOS','','ALQUILERES'],   // evento Corsaga · estaba en ALQUILERES
  ['116550','2026-05-29',625.00,'EVENTOS','','ALQUILERES'],   // evento · estaba en ALQUILERES
  ['96331','2026-07-22',10000.00,'PERSONAL','Si','ALQUILERES'],   // RentaPanoramajulio2026 · personal, no es renta del local
  ['196844','2026-07-15',763.00,'SUMINISTRO DE LIMPIEZA','','BEBIDAS'],   // Doorways · estaba como BEBIDAS, o sea contado como COGS
  ['264369','2026-07-15',580.92,'SUMINISTRO DE LIMPIEZA','','BEBIDAS'],   // Doorways · estaba como BEBIDAS
  ['232089','2026-07-29',703.00,'SUMINISTRO DE LIMPIEZA','','BEBIDAS'],   // Doorways · estaba como BEBIDAS
  ['255458','2026-07-15',200.00,'COCTELERIA','','NOMINA'],   // Tavito · estaba como NOMINA
];

function _f(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _n(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _correr(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_RC);
  var avisos = [], porCat = {}, hechas = { BAC: 0, BI: 0, FEL: 0 }, yaEstaban = 0;
  var lotes = { BAC: LOTE_BAC, BI: LOTE_BI, FEL: LOTE_FEL };

  for (var libro in lotes) {
    var cfg = LIBROS[libro], lote = lotes[libro];
    var sh = ss.getSheetByName(cfg.hoja);
    if (!sh) { avisos.push('No existe la hoja ' + cfg.hoja); continue; }
    var datos = sh.getDataRange().getValues();

    for (var i = 0; i < lote.length; i++) {
      var it = lote[i], hallada = false;

      for (var r = 0; r < datos.length; r++) {
        if (String(datos[r][cfg.llave - 1] || '').trim() !== it[0]) continue;
        if (_f(datos[r][cfg.fecha - 1]) !== it[1]) continue;
        if (Math.abs(_n(datos[r][cfg.debito - 1]) - it[2]) > 0.01) continue;

        hallada = true;
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

  var total = hechas.BAC + hechas.BI + hechas.FEL;
  Logger.log(escribir ? '=== ESCRITAS ===' : '=== SIMULACION, no se escribio nada ===');
  Logger.log(total + ' filas  (' + hechas.BAC + ' en BAC, ' + hechas.BI +
             ' en Banco Industrial, ' + hechas.FEL + ' en FEL)');
  Logger.log('Ya estaban bien: ' + yaEstaban);
  for (var k in porCat) Logger.log('   ' + k + ': Q' + porCat[k].toFixed(2));
  if (avisos.length) {
    Logger.log('--- revisar ---');
    for (var z = 0; z < avisos.length; z++) Logger.log('   ' + avisos[z]);
  } else {
    Logger.log('Sin avisos: todas las filas se encontraron como se esperaba.');
  }
  if (escribir) Logger.log('Listo. Ahora corre generarEspejo().');
}

/** Solo reporta. No escribe nada. Correr esta primero. */
function revisarReclas() { _correr(false); }

/** Escribe las categorias. */
function reclasificar() { _correr(true); }

/** Control de solo lectura: nomina, IGSS, propina y eventos por mes en los dos bancos. */
function verNominaPorMes() {
  var ss = SpreadsheetApp.openById(SHEET_ID_RC), acc = {};
  var libros = [['03_Banco_Industrial', 1, 4, 7], ['04_Banco_BAC', 1, 5, 8]];
  for (var l = 0; l < libros.length; l++) {
    var sh = ss.getSheetByName(libros[l][0]);
    if (!sh) continue;
    var d = sh.getDataRange().getValues();
    for (var r = 1; r < d.length; r++) {
      var f = d[r][libros[l][1] - 1];
      if (!(f instanceof Date) || f.getFullYear() !== 2026) continue;
      var cat = d[r][libros[l][3] - 1];
      if (cat !== 'NOMINA' && cat !== 'IGSS' && cat !== 'PROPINAS_AL_EQUIPO' && cat !== 'EVENTOS') continue;
      var k = ('0' + (f.getMonth() + 1)).slice(-2) + ' ' + cat;
      acc[k] = (acc[k] || 0) + (Number(d[r][libros[l][2] - 1]) || 0);
    }
  }
  var ks = Object.keys(acc).sort();
  for (var i = 0; i < ks.length; i++) Logger.log(ks[i] + ': Q' + acc[ks[i]].toFixed(2));
}
