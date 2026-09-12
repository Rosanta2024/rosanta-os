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
// 6. Tres pagos de productos de limpieza en Banco Industrial que
//    estaban como BEBIDAS. Verificado el 3-sep contra generar_finanzas.py:
//    NO estaban dentro del COGS. La regla 3 de esa capa salta las
//    categorias de mercaderia en Banco Industrial para no duplicar con
//    FEL, asi que estaban cayendose del P&L entero. El cambio no mueve
//    dinero dentro del COGS: agrega Q2,046.92 de gasto en julio.
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
//   975912296 Jorge Fernando Estrada Martin (empleado)
//   904004173 DHL (mensajeria)          901552505 El Mastil (materiales)
//   GRUPO AGMN, S.A. (personal)
//
// SUELDO vs PROPINA: se separa por el monto. Los de propina son los de
// la columna Propina de la planilla de ese mes (1812 y 1153 en mayo,
// 2052 y 1306 en junio). Todo lo demas es sueldo. La propina no es
// costo del negocio: la paga el cliente y solo pasa por la cuenta.
//   OJO, no es cierto todavia que quede fuera del prime cost.
//   generar_finanzas.py:67 mapea PROPINAS_AL_EQUIPO a "Nomina y salarios".
//   Hoy no se nota porque esas filas estan en el BAC y esa hoja no se lee.
//   El dia que el BAC entre al calculo, estos Q16,411 se suman al costo
//   laboral del DRE salvo que se arregle el mapa. La vista de los cinco
//   numeros no tiene el problema: ahi la nomina sale de PLANILLA.
//
// EL PAGO DE GAS Y EL DOBLE CONTEO
//   El Q1,380 del 17/03 es el pago de la factura de gas de febrero, que
//   ya entro por FEL. Se clasifica como GAS porque eso es lo que es: el
//   maestro guarda la verdad. Evitar el doble conteo es trabajo de la
//   capa de calculo.
//   OJO: hoy esa capa NO lo evita para GAS. Solo descarta las categorias
//   de mercaderia en Banco Industrial y el alquiler que viene por FEL.
//   Mientras el BAC no se lea no pasa nada; al conectarlo, este Q1,380 se
//   cuenta dos veces.
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
// LO QUE ESTE SCRIPT NO ARREGLA, Y HAY QUE SABERLO ANTES DE CORRERLO
//   Las 54 filas del LOTE_BAC no mueven el DRE. generar_finanzas.py:88
//   define LIBROS con FEL, Banco Industrial y la tarjeta. 04_Banco_BAC no
//   esta: solo se usa para el saldo bancario y para contar POR_CLASIFICAR.
//   Son Q279,520.89 del año que la capa de calculo no lee. Despues de
//   correr esto, febrero seguira mostrando Q5,988 de nomina en el DRE.
//   Lo que si arregla es el libro, que es donde vive la verdad, y las 9
//   filas de Banco Industrial, que esas si cuentan.
//   Correr "python3 generar_finanzas.py" y mirar el bloque COBERTURA.
//
// RESUELTO el 4-sep-2026
//   - Marzo, abril y agosto identificados por Juanma: Fogliasana (alimentos,
//     SI factura), Jonas Antonio Dobias Nuila (pescaderia, SIN factura) y La
//     Cofradia de los Vinos (bebidas, SI factura).
//     OJO con la diferencia: los que SI facturan van a su categoria de
//     mercaderia y la regla 3 los salta, porque el gasto ya entra por FEL. El
//     que NO factura va a ALIMENTOS_EFECTIVO, que si suma al COGS porque no
//     llega por ningun otro lado. Confundirlos duplica o borra el gasto.
//   - Enero y febrero, 8 movimientos por Q4,600: no identificables. El BAC no
//     da el destinatario y el historico no llega tan atras. Se quedan como
//     TRANSFERENCIA_SALIENTE, fuera del P&L.
//   - Nueve salidas del BAC por Q30,800 que parecian pagos sueltos son
//     TRASLADOS ENTRE CUENTAS PROPIAS: salieron del BAC y entraron a Banco
//     Industrial el MISMO DIA, y el credito de alla dice "ACH CORSAGA,
//     SOCIEDAD ANONIMA". Ahi estaban los siete pagos redondos de abril a
//     agosto que no calzaban con nada.
//     El metodo sirve para cualquier salida sin identificar del BAC: buscar un
//     credito del mismo monto en Banco Industrial a menos de cuatro dias. Lo
//     que el extracto del BAC no dice, lo dice el otro lado del traslado.
//   - BAC 20/05 ref 406496009 Q1,300 iba a la cuenta 975862723, que es
//     Volcan. Juanma lo confirmo y ya esta en el lote como EVENTOS.
//   - Otras tres cuentas que estaban sin dueño: 975912296 es Jorge Fernando
//     Estrada Martin, empleado, dos pagos de Q450 en febrero que faltaban al
//     costo laboral. 904004173 es DHL. 901552505 es El Mastil, y su categoria
//     estaba en 00_Proveedores desde siempre: MATERIALES. Esa hoja tiene 2,009
//     proveedores con su categoria normalizada; hay que mirarla ANTES de
//     preguntar o de inventar una categoria.
//     Ojo: DHL esta dos veces ahi, como SERVICIOS PROFESIONALES y como
//     GASTOS_ADMINISTRATIVOS. Se uso la segunda.
//
// PENDIENTE
//   - BAC 04/02 ref 900456582 Q21,000 "TF:ACH PERSONAS 900". Es un pago a
//     proveedor SIN IDENTIFICAR. El Historico transaccional del BAC solo
//     llega hasta marzo, asi que el destino no se puede recuperar en
//     linea. Verificado que NO entro a Banco Industrial ni a la cuenta
//     personal del BAC. Decision de Juanma el 3-sep: se marca PERSONAL
//     para no seguir bloqueado. Queda pendiente pedirle el detalle al
//     banco con esa referencia; si resulta ser del negocio hay que
//     revertirlo, porque son Q21,000 de gasto que hoy quedan fuera.
//   - Banco Industrial docto 255458, 15/07, Q200, Tavito. Se saco del
//     lote. Esta como NOMINA, que es falso, pero NOMINA si suma en el
//     P&L y COCTELERIA en Banco Industrial se cae por la regla 3. Se
//     arregla cuando se decida que hacer con esa regla; moverla hoy
//     borraria Q200 de gasto real.
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
var LIBROS_REC = {
  BAC: { hoja: '04_Banco_BAC',        llave: 2, fecha: 1, debito: 5, cat: 8, pers: 9 },
  BI:  { hoja: '03_Banco_Industrial', llave: 2, fecha: 1, debito: 4, cat: 7, pers: 8 },
  FEL: { hoja: '01_FEL_Maestro',      llave: 4, fecha: 1, debito: 10, cat: 14, pers: 15 }
};

// [llave, fecha, debito, categoria nueva, Es_Personal ('' = no tocar), categoria ESPERADA hoy]
var LOTE_BAC = [
  ['900487223','2026-04-17',3850.00,'MANTENIMIENTO','','TRANSFERENCIA_SALIENTE'],   // Magdalena Pietrzyk · diseno de jardin, mejoramiento. Sin factura
  ['900432347','2026-08-20',2520.00,'ALIMENTOS_EFECTIVO','','TRANSFERENCIA_SALIENTE'],   // Byron Melgar · "S33 Pescado". Alimentos SIN FACTURA
  ['900492396','2026-06-02',1306.00,'PROPINAS_AL_EQUIPO','','TRANSFERENCIA_SALIENTE'],   // Marvin · propina de mayo, por ACH sin cuenta guardada
  ['900456582','2026-02-04',21000.00,'PERSONAL','Si','TRANSFERENCIA_SALIENTE'],   // pago a proveedor SIN IDENTIFICAR. Decision de Juanma el 3-sep: se marca personal para cerrarlo. OJO: si aparece que era del negocio, hay que revertirlo, son Q21,000 de gasto fuera del P&L
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
  ['406496009','2026-05-20',1300.00,'EVENTOS','','TRANSFERENCIA_SALIENTE'],   // Volcan · cuenta 975862723. Confirmado por Juanma el 4-sep-2026
  ['406479130','2026-02-16',450.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jorge Fernando Estrada Martin · empleado · cuenta 975912296
  ['406433320','2026-02-25',450.00,'NOMINA','','TRANSFERENCIA_SALIENTE'],   // Jorge Fernando Estrada Martin · empleado · cuenta 975912296
  ['406464704','2026-02-16',377.65,'GASTOS_ADMINISTRATIVOS','','TRANSFERENCIA_SALIENTE'],   // DHL · mensajeria · cuenta 904004173
  ['406439664','2026-02-16',10.60,'MATERIALES','','TRANSFERENCIA_SALIENTE'],   // El Mastil · cuenta 901552505 · 00_Proveedores fila 100
  ['900405413','2026-04-27',5000.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900439464','2026-05-16',3200.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900406586','2026-07-15',3500.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900443817','2026-07-22',4000.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900400047','2026-07-27',3500.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900409447','2026-07-27',250.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900438353','2026-03-17',444.00,'ALIMENTOS','','TRANSFERENCIA_SALIENTE'],   // Fogliasana · SI factura, 9 DTE en FEL. La regla 3 lo salta: se cuenta por FEL
  ['900454637','2026-04-14',1000.00,'ALIMENTOS_EFECTIVO','','TRANSFERENCIA_SALIENTE'],   // Jonas Antonio Dobias Nuila · pescaderia SIN FEL
  ['900487541','2026-04-17',1000.00,'ALIMENTOS_EFECTIVO','','TRANSFERENCIA_SALIENTE'],   // Jonas Antonio Dobias Nuila · pescaderia SIN FEL
  ['900467532','2026-08-19',1027.00,'BEBIDAS','','TRANSFERENCIA_SALIENTE'],   // La Cofradia de los Vinos · SI factura. La regla 3 lo salta
  ['900476839','2026-08-21',5000.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900499713','2026-08-24',1450.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
  ['900479299','2026-08-31',4900.00,'TRANSFERENCIA','','TRANSFERENCIA_SALIENTE'],   // entro a Industrial el mismo dia · ACH CORSAGA
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
];

function _fREC(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function _nREC(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _correr(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_RC);
  var avisos = [], porCat = {}, hechas = { BAC: 0, BI: 0, FEL: 0 }, yaEstaban = 0;
  var lotes = { BAC: LOTE_BAC, BI: LOTE_BI, FEL: LOTE_FEL };

  for (var libro in lotes) {
    var cfg = LIBROS_REC[libro], lote = lotes[libro];
    var sh = ss.getSheetByName(cfg.hoja);
    if (!sh) { avisos.push('No existe la hoja ' + cfg.hoja); continue; }
    var datos = sh.getDataRange().getValues();

    for (var i = 0; i < lote.length; i++) {
      var it = lote[i], hallada = false;

      for (var r = 0; r < datos.length; r++) {
        if (String(datos[r][cfg.llave - 1] || '').trim() !== it[0]) continue;
        if (_fREC(datos[r][cfg.fecha - 1]) !== it[1]) continue;
        if (Math.abs(_nREC(datos[r][cfg.debito - 1]) - it[2]) > 0.01) continue;

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
