/**
 * FinanzasDatos.gs — datos de la pantalla de Finanzas de la intranet.
 *
 * Pilar 3, Finance & Data OS. Es una pantalla de ANALISIS: sirve para mirar la
 * estructura de costo y decidir. No captura acciones ni escribe nada: este
 * archivo es de solo lectura sobre el maestro, de principio a fin.
 *
 * Mismo calculo que generar_finanzas.py, portado para que la intranet no
 * dependa de que alguien corra Python en su Mac.
 *
 * AMBITO GLOBAL: todos los .gs del proyecto comparten un solo ambito. Por eso
 * cada nombre de aqui empieza con "fin" o "_fin". Ya paso una vez en el maestro
 * que dos archivos definieran _fecha y uno pisara al otro en silencio.
 *
 * LAS REGLAS QUE NO SE PUEDEN CAMBIAR SIN ROMPER LOS NUMEROS
 *   1. Ventas netas = Subtotal / 1.12. El POS muestra precios con IVA incluido.
 *   2. Se excluye toda fila con EVENTO en Notas o Productos: ingreso adicional,
 *      no venta de restaurante.
 *   3. COGS = FEL + tarjeta en las 4 categorias de mercaderia, MAS las
 *      categorias SIN FACTURA del banco (FIN_EFECTIVO). NO se suma la
 *      mercaderia de los bancos: ese es el pago de la factura que ya vino por
 *      FEL. El COGS del FEL va NETO DE IVA, porque ese IVA es credito
 *      recuperable y no es costo. La compra SIN FACTURA va en bruto: ahi el
 *      IVA queda embebido y no se recupera, y por eso el mismo plato comprado
 *      sin factura cuesta 12% mas.
 *   4. La nomina es DEVENGADA, de la planilla, no del pago bancario.
 *   5. Las propinas van en su PROPIO bloque, no dentro de Nomina y salarios.
 *      Siguen dentro del gasto porque el cobro ya esta en la venta: el Subtotal
 *      del POS incluye el 10% de servicio. Lo que se evita es que contaminen el
 *      bloque de nomina, que se compara contra la banda de 25-30%.
 *   6. Semana = semana ISO, con su año (clave AAAAWW) y CONSECUTIVA: una semana
 *      corta o sin venta queda en la lista y entra a la movil de 4 (A13).
 *   8. El GAS solo se cuenta por FEL: el movimiento del banco es el pago de esa
 *      misma factura. Sin la regla habia doble conteo (Q12,661 en FEL contra
 *      Q8,456 en Banco Industrial, los dos sumando).
 *   9. Hay proveedores que SIEMPRE facturan por FEL (FIN_PAGO_DE_FACTURA): su
 *      pago de banco o tarjeta es el pago de esa factura y no se suma. El banco
 *      no trae NIT: el pago se reconoce por su texto. Medido el 14-sep-2026:
 *      Q49,629 del año se contaban dos veces. La bateria vigila que cada uno
 *      siga facturando; si deja de hacerlo, la regla borraria gasto real.
 *  10. Una fecha del maestro con hora se lleva a su DIA (_finDia_): 12:00 o mas es
 *      el dia siguiente. 157 filas se guardaron a las 22:00/23:00 del dia anterior
 *      (zona horaria del Sheet distinta de la del script) y se verifico contra las
 *      fuentes que la fecha verdadera es el dia siguiente (p120, 15-sep-2026).
 *  11. Un mes sin planilla cargada usa la ULTIMA planilla cargada, marcada como
 *      estimada (A14, decision de Juanma del 15-sep-2026). Antes el mes sumaba
 *      solo el IGSS y se pintaba rentable, y la semana usaba 29000 fijo.
 *  12. UNIFORMES es su propio bloque (Juanma, 15-sep-2026). Dentro de Nomina y
 *      salarios se perdia: esa nomina se reemplaza por la planilla devengada.
 *  13. Una factura con Estado "Anulado" en 01_FEL_Maestro no suma a nada. Hasta el
 *      15-sep-2026 el calculo no miraba esa columna: 15 anuladas, Q7,535 en 2026. Las
 *      formulas del maestro ya filtraban "Vigente" desde el 2-sep.
 *   7. El semaforo se pone SIEMPRE sobre la media movil de 4, nunca sobre la
 *      semana cruda: cruda, el food cost va de 16% a 68% porque la compra no
 *      cae en la semana en que se consume.
 */

var FIN_MAESTRO_ID = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var FIN_PRIMERA_FILA = 5;          // las cuatro primeras son encabezado
var FIN_SEMANAS_MES = 4.345;
// Tipo de cambio de los cargos en dolares de la tarjeta. Valor por defecto: la
// celda tipo_cambio_usd de PARAMETROS manda si existe. Estaba en 7.7 aqui y en
// generar_finanzas.py, y en 7.72 en el documento del objetivo operacional.
var FIN_USD_DEF = 7.7;

/**
 * Planilla devengada por mes: "Sub total" de la columna "Salario base" del
 * Sheet nativo de planilla.
 *
 * RESUELTO el 12-sep-2026. Hasta hoy este objeto ERA la fuente, y estaba
 * copiado igual en generar_finanzas.py: dos lugares que habia que tocar a mano
 * al cerrar cada mes y nada avisaba si uno se quedaba atras. Los dos se
 * quedaron en agosto. Ahora la fuente es el Sheet (_finPlanilla_()) y esto es
 * RESPALDO: solo cubre los meses que el Sheet no traiga, y la pantalla dice de
 * donde salio cada mes.
 *
 * No se borra a proposito: si el Sheet cambia de forma, la pantalla sigue
 * dando numeros en vez de reventar. Si los dos no coinciden, manda el Sheet.
 */
var FIN_PLANILLA_RESPALDO = { 1: 28850, 2: 28875, 3: 27600, 4: 27100,
                              5: 31925, 6: 29900, 7: 29010, 8: 31450 };

var FIN_PLANILLA_ID = '1dKTJ0KRKTyLyiQEZ2pCUh3i446Cy0S_yvmqp1ac_H_E';

var FIN_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
var FIN_COGS_CATS = ['ALIMENTOS', 'BEBIDAS', 'COCTELERIA', 'LICORES'];
// Las hojas de banco. La mercaderia pagada desde CUALQUIERA de las dos es el
// pago de una factura que ya vino por FEL. Hasta el 4-sep-2026 la regla 3 solo
// miraba Banco Industrial y eso dejo un doble conteo al conectar el BAC.
var FIN_BANCOS = ['03_Banco_Industrial', '04_Banco_BAC'];
// Compra SIN FACTURA. "EFECTIVO" no significa "pagado en efectivo": significa que
// no hay FEL, y por eso entra al COGS — no llega por ningun otro lado. El cruce
// del 4-sep-2026 encontro Q32,212 que se estaban borrando.
var FIN_EFECTIVO = ['ALIMENTOS_EFECTIVO', 'BEBIDAS_EFECTIVO', 'COCTELERIA_EFECTIVO'];
// Categorias que SIEMPRE vienen con factura: se cuentan por FEL y el movimiento
// del banco se salta, porque es el pago de esa misma factura.
var FIN_SOLO_FEL = ['GAS', 'ALQUILER_EQUIPO'];
// Proveedores que SIEMPRE facturan por FEL: su pago desde banco o tarjeta es el
// pago de esa misma factura y se salta (regla 9). El banco no trae NIT, asi que
// el pago se reconoce por el texto del movimiento y, donde el texto no alcanza,
// tambien por la categoria. El NIT es para cotejar contra la factura.
// Quedan fuera a proposito: Tigo, que paga 2.5 veces lo que factura, y los
// comercios de tarjeta (PriceSmart, gasolineras), que no siempre dan FEL.
// Mismo listado en generar_finanzas.py (PAGO_DE_FACTURA).
var FIN_PAGO_DE_FACTURA = [
  { prov: 'EEGSA', nit: '326445', hojas: ['03_Banco_Industrial', '04_Banco_BAC'], texto: /EEGSA/ },
  { prov: 'Claro', nit: '9929290', hojas: ['03_Banco_Industrial'], texto: /CLARO/ },
  { prov: 'Doorways', nit: '96569239', hojas: ['03_Banco_Industrial'], texto: /DOORWAY/ },
  { prov: 'Doorways', nit: '96569239', hojas: ['04_Banco_BAC'], texto: /TEF A ?: ?902410067/ },
  { prov: 'Posfile', nit: '107902699', hojas: ['03_Banco_Industrial', '05_Tarjeta_Credito_BAC'], texto: /POSFILE/ },
  { prov: 'EX Security', nit: '104313218', hojas: ['03_Banco_Industrial'],
    cats: ['SERVICIO DE MONITOREO Y ALARMA'] },
  { prov: 'Edwin Flores', nit: '82651086', hojas: ['03_Banco_Industrial'],
    texto: /MARKETING|CONTENIDO/, cats: ['SERVICIOS_PROFESIONALES'] },
  { prov: 'Aseguradora La Ceiba', nit: '5022193', hojas: ['03_Banco_Industrial'],
    texto: /SEGURO/, cats: ['SEGUROS_Y_FIANZAS'] }
];

// Regla 15 (21-sep-2026, Juanma): LA FACTURA MANDA. "Se le da prioridad a las facturas;
// si no existe factura, se usan los bancos." Un pago de banco o tarjeta que tiene su
// factura FEL no suma: es el pago de esa factura. Las reglas 8 y 9 lo resolvian por
// categoria y por lista de proveedores, y cada proveedor nuevo se contaba dos veces
// hasta que alguien lo veia (medido el 21-sep: 54 pagos, Q13,950 del año).
// Se casa cada pago con UNA factura: mismo bloque del DRE, mismo monto y factura
// emitida entre 45 dias antes y 10 dias despues del pago. Solo en los bloques donde
// el gasto viene con factura de proveedor: nomina, propinas, impuestos, comisiones e
// inmueble quedan fuera a proposito. Mismo algoritmo en generar_finanzas.py (casar_pagos).
var FIN_FACTURA_MANDA_BLOQUES = ['Tarifas y servicios', 'Prestadores y honorarios', 'Marketing',
                                 'Mantencion', 'Bienes de uso', 'Uniformes'];
var FIN_FM_DIAS_ANTES = 45, FIN_FM_DIAS_DESPUES = 10;   // la factura, respecto del pago

/**
 * facturas y pagos: [{ dia (numero de dia), q, bloque, llave, orden }]. Devuelve
 * { llave del pago: llave de la factura }. Los pagos se recorren por fecha; gana la
 * factura mas cercana en dias y, a igual distancia, la primera de la hoja. Una factura
 * casa con un solo pago. Funcion pura: la bateria la prueba con datos de juguete.
 */
function _finCasarPagos_(facturas, pagos) {
  var usadas = {}, casados = {};
  var enOrden = pagos.slice().sort(function (a, b) { return a.dia - b.dia || a.orden - b.orden; });
  enOrden.forEach(function (p) {
    var mejor = null, dist = null;
    for (var i = 0; i < facturas.length; i++) {
      var f = facturas[i];
      if (usadas[f.llave] || f.bloque !== p.bloque) continue;
      if (Math.abs(f.q - p.q) > 0.011) continue;
      var dd = p.dia - f.dia;
      if (dd < -FIN_FM_DIAS_DESPUES || dd > FIN_FM_DIAS_ANTES) continue;
      if (dist === null || Math.abs(dd) < dist) { mejor = f; dist = Math.abs(dd); }
    }
    if (mejor) { usadas[mejor.llave] = true; casados[p.llave] = mejor.llave; }
  });
  return casados;
}

/** Los pagos del año que tienen factura: { 'hoja|fila': llave de la factura }. */
function _finPagosConFactura_(hojas, anio, usd) {
  var facturas = [], pagos = [];
  FIN_LIBROS.forEach(function (L, i) {
    var filas = hojas[L.hoja];
    for (var r = FIN_PRIMERA_FILA - 1; r < filas.length; r++) {
      var f = _finDia_(filas[r][0]);
      if (!_finEsFecha_(f) || f.getFullYear() !== anio) continue;
      if (L.estado && String(filas[r][L.estado - 1] || '').trim() === 'Anulado') continue;
      if (String(filas[r][L.pers - 1] || '').trim() === 'S\u00ed') continue;
      var cat = String(filas[r][L.cat - 1] || '').trim();
      var d = FIN_MAP[cat];
      if (!d || !_finEn_(FIN_FACTURA_MANDA_BLOQUES, d[0])) continue;
      var q = _finNum_(filas[r][L.monto - 1]);
      if (L.usd) q += _finNum_(filas[r][L.usd - 1]) * usd;
      q = Math.round(q * 100) / 100;
      if (q <= 0) continue;
      var fila = { dia: Math.round(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) / 86400000),
                   q: q, bloque: d[0], llave: L.hoja + '|' + r, orden: i * 1000000 + r };
      if (L.hoja === '01_FEL_Maestro') facturas.push(fila);
      else if (!_finEn_(FIN_SOLO_FEL, cat) &&
               !(L.desc && _finPagoDeFactura_(L.hoja, filas[r][L.desc - 1], cat))) pagos.push(fila);
    }
  });
  return _finCasarPagos_(facturas, pagos);
}

/** El proveedor si la fila es el pago de una factura FEL; si no, ''. */
function _finPagoDeFactura_(hoja, texto, cat) {
  var t = String(texto || '').toUpperCase().replace(/\s+/g, ' ');
  for (var i = 0; i < FIN_PAGO_DE_FACTURA.length; i++) {
    var P = FIN_PAGO_DE_FACTURA[i];
    if (!_finEn_(P.hojas, hoja)) continue;
    if (P.texto && !P.texto.test(t)) continue;
    if (P.cats && !_finEn_(P.cats, cat)) continue;
    return P.prov;
  }
  return '';
}

/** Por proveedor de la regla 9: pago saltado del año contra su factura FEL, por NIT. */
function _finPagoFacturaResumen_(saltado, felNit) {
  var out = {};
  FIN_PAGO_DE_FACTURA.forEach(function (P) {
    out[P.prov] = { nit: P.nit, pago: _finR_(saltado[P.prov] || 0),
                    factura: _finR_(felNit[P.nit] || 0) };
  });
  return out;
}

/**
 * Meta de food cost ponderada por el mix: (mix_cocina x 30%) + (mix_barra x 20%).
 * Medida el 3-sep-2026 sobre los tickets del año: cocina 77.9 / barra 22.1.
 * PENDIENTE (especificacion 4.7): guardarla como formula del mix. El 32 fijo
 * que habia en PARAMETROS mentia en cuanto el mix se moviera.
 */
var FIN_MIX = { cocina: 77.9, barra: 22.1 };

/**
 * Meta de food cost de cada area, para el techo de compra.
 *
 * Hasta el 14-sep-2026 era una constante (cocina 30, barra 20) escrita aca, aparte de
 * la meta global de PARAMETROS. Ahora sale del mismo lugar que todas: metasFoodCost_
 * en ConfigCosteo.gs. Decision de Juanma: cocina 28, barra 20.
 *
 * Siguen siendo dos numeros distintos a proposito: la global mide lo que paso, la de
 * area limita lo que se compra esta semana.
 */
function _finMetaArea_() {
  return { cocina: metaDeArea_('COCINA'), barra: metaDeArea_('BARRA') };
}

// De que area es cada categoria de mercaderia. Toda categoria de FIN_COGS_CATS y
// de FIN_EFECTIVO tiene que estar aca: _compra() descarta en silencio lo que no
// tiene area (C6 de la auditoria: LICORES sumaba al food cost y a ningun techo).
// La bateria lo vigila en 'Toda categoria de mercaderia tiene area'.
var FIN_AREA_CAT = {
  ALIMENTOS: 'cocina', ALIMENTOS_EFECTIVO: 'cocina',
  BEBIDAS: 'barra', BEBIDAS_EFECTIVO: 'barra',
  COCTELERIA: 'barra', COCTELERIA_EFECTIVO: 'barra',
  LICORES: 'barra'
};
/**
 * META DE FOOD COST: 28%, leida de PARAMETROS del Sheet de config.
 *
 * Decision de Juanma el 10-sep-2026: la meta NO es la mezclada del mix. Hasta
 * el 12-sep esta pantalla seguia calculando 27.8 (77.9 x 30 + 22.1 x 20)
 * mientras generar_finanzas.py ya usaba 30. Decision del 14-sep-2026: pasa de
 * 30 a 28, y es la misma para la global y para cocina.
 *
 * Hay UN solo lugar: la celda PARAMETROS!food_cost_objetivo_pct. El 28 de
 * COSTEO.areas es solo el valor por defecto si la celda no existe.
 *
 * El mix se sigue publicando (FIN_MIX) porque dice donde se vende, pero ya no
 * define la meta.
 */

/** Un parametro de la pestana PARAMETROS del Sheet de config. Cachea 10 minutos. */
function _finParametro_(clave, defecto) {
  var cache = CacheService.getScriptCache();
  // v2 (14-sep-2026): la version anterior guardaba estos valores 6 horas con la clave
  // 'fin_par_'. Al cambiar la meta a 28 en PARAMETROS, el codigo nuevo seguia leyendo
  // el 30 que habia dejado la vieja. Clave nueva = ese cache viejo deja de existir.
  var k = 'fin_par_v2_' + clave;
  var g = cache.get(k);
  if (g !== null && g !== undefined && g !== '') {
    var n = Number(g);
    if (!isNaN(n)) return n;
  }
  var val = defecto;
  try {
    var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'))
                 .getSheetByName('PARAMETROS');
    if (hoja) {
      var filas = hoja.getDataRange().getValues();
      for (var i = 1; i < filas.length; i++) {
        if (String(filas[i][0] || '').trim() === clave) {
          var v = Number(filas[i][1]);
          if (!isNaN(v) && v !== 0) val = v;
          break;
        }
      }
    }
  } catch (e) {
    // Sin Sheet de config la pantalla sigue de pie con el valor por defecto.
  }
  // 10 minutos y no 6 horas (14-sep-2026): con 6 h, cambiar la meta en PARAMETROS
  // tardaba hasta medio dia en verse, y el boton "Actualizar datos" no lo forzaba.
  // Leer la pestana es una sola lectura chica.
  try { cache.put(k, String(val), 10 * 60); } catch (e2) { /* no importa */ }
  return val;
}

function _finMetaFood_() { return metasFoodCost_().global; }

/**
 * La planilla devengada de los meses del año, leida del Sheet de planilla.
 *
 * Una pestana por mes. Se busca la fila cuyo texto sea "Sub total" (vive en la
 * columna Puesto) y la columna cuyo encabezado sea "Salario base".
 *
 * LAS PESTANAS SE LLAMAN 2026-01, 2026-02... (AAAA-MM). Corregido el
 * 12-sep-2026: la primera version casaba por nombre de mes ("ago", "jul") y no
 * encontro NINGUNA. La bateria lo cazo ("0 meses del Sheet, 8 del respaldo")
 * y la pantalla habria seguido mostrando el respaldo congelado sin decir nada
 * distinto a lo de antes. Ver _finMesDePestana_(): se filtra por AÑO, porque el
 * dia que exista 2027-08 no puede pisar a 2026-08.
 *
 * Devuelve { valores: {mes: monto}, origen: {mes: 'sheet'|'respaldo'}, error }.
 * Cualquier mes que el Sheet no traiga cae en FIN_PLANILLA_RESPALDO, y la
 * pantalla muestra de donde salio: un numero de respaldo en octubre es un
 * numero viejo, y eso tiene que verse.
 */
function _finPlanilla_() {
  var out = { valores: {}, origen: {}, detalle: {}, error: '' };
  var ss = null;
  try {
    ss = SpreadsheetApp.openById(FIN_PLANILLA_ID);
  } catch (e) {
    out.error = 'No pude abrir el Sheet de planilla: ' + String(e && e.message || e);
  }
  if (ss) {
    var anio = new Date().getFullYear();
    var hojas = ss.getSheets();
    for (var h = 0; h < hojas.length; h++) {
      var mes = _finMesDePestana_(hojas[h].getName(), anio);
      if (!mes || out.valores[mes]) continue;
      var v = _finSubTotalSalario_(hojas[h]);
      if (v) {
        out.valores[mes] = v;
        out.origen[mes] = 'sheet';
        var det = _finPlanillaDetalle_(hojas[h]);
        if (det) {
          // Si la suma de las filas no cuadra con el Sub total de la hoja, el
          // reparto es de una base distinta del total que usa el DRE. Se marca
          // en vez de taparlo: la pantalla lo dice.
          det.subtotal = v;
          det.cuadra = Math.abs(det.suma - v) < 1;
          out.detalle[mes] = det;
        }
      }
    }
  }
  Object.keys(FIN_PLANILLA_RESPALDO).map(Number).forEach(function (m) {
    if (!out.valores[m]) {
      out.valores[m] = FIN_PLANILLA_RESPALDO[m];
      out.origen[m] = 'respaldo';
    }
  });
  return out;
}

/**
 * El mes (1-12) que representa una pestana de la planilla, o 0 si no es de
 * este año o no se reconoce.
 *
 *   2026-08, 2026_08, 2026/8   -> el formato real del Sheet (AAAA-MM)
 *   08-2026                    -> por si algun dia se invierte
 *   Agosto, AGO 2026           -> nombre de mes, el formato que se supuso al
 *                                 principio. Se deja como respaldo, pero si el
 *                                 nombre trae OTRO año se descarta.
 */
function _finMesDePestana_(nombre, anio) {
  var n = _finSinAcentos_(String(nombre || '')).toLowerCase().replace(/\s+/g, ' ').trim();
  var m = n.match(/^(\d{4})\s*[-_\/.]\s*(\d{1,2})$/);
  if (m) return (Number(m[1]) === anio && +m[2] >= 1 && +m[2] <= 12) ? +m[2] : 0;
  m = n.match(/^(\d{1,2})\s*[-_\/.]\s*(\d{4})$/);
  if (m) return (Number(m[2]) === anio && +m[1] >= 1 && +m[1] <= 12) ? +m[1] : 0;
  var otroAnio = n.match(/\b(\d{4})\b/);
  if (otroAnio && Number(otroAnio[1]) !== anio) return 0;
  for (var i = 1; i <= 12; i++) {
    if (n.indexOf(_finSinAcentos_(FIN_MESES[i - 1]).toLowerCase()) === 0) return i;
  }
  return 0;
}

/**
 * Planilla de una pestana partida en FIJA y EXTRA.
 *
 * La hoja de planilla tiene una columna "Puesto" donde el personal variable ya
 * viene marcado como "Extra" —lo escribe Juanma al armar cada mes—, pero hasta
 * el 22-sep-2026 nadie la leia: el motor tomaba solo el "Sub total" de "Salario
 * base" y devolvia UN numero por mes. Sin ese corte no habia forma de mirar
 * cuanto del personal se mueve con la venta y cuanto no.
 *
 * NO reemplaza a _finSubTotalSalario_: ese sigue siendo el total que alimenta
 * el DRE y el prime cost, y no se toca. Este devuelve el reparto ademas, con
 * la suma de las filas al lado para que una hoja donde el Sub total no cuadre
 * con sus filas se vea en vez de pasar desapercibida.
 *
 * Devuelve null si la pestana no tiene las dos columnas: sin "Puesto" no se
 * puede repartir, y repartir a ojo seria inventar.
 */
function _finPlanillaDetalle_(hoja) {
  var filas;
  try { filas = hoja.getDataRange().getValues(); } catch (e) { return null; }
  var cPuesto = -1, cBase = -1, rCab = -1, cDev = -1, cBono = -1, cHoras = -1;
  for (var r = 0; r < filas.length && rCab < 0; r++) {
    var p = -1, b = -1, dv = -1, bo = -1, ho = -1;
    for (var c = 0; c < filas[r].length; c++) {
      var t = _finSinAcentos_(String(filas[r][c] || '')).toLowerCase().replace(/\s+/g, ' ').trim();
      if (t === 'puesto') p = c;
      if (t === 'salario base') b = c;
      if (t === 'salario devengado') dv = c;
      if (t === 'bono dto') bo = c;
      if (t === 'horas extras') ho = c;
    }
    if (p >= 0 && b >= 0) { cPuesto = p; cBase = b; cDev = dv; cBono = bo; cHoras = ho; rCab = r; }
  }
  if (rCab < 0) return null;

  /* Cuanto se le pago a una fila.
     Hasta el 22-sep-2026 esto era solo "Salario base", y por eso los Q3,000 del
     finiquito de Marvin —que estan en "Horas extras" con el base VACIO— no los
     veia nadie: ni el DRE, ni el prime cost, ni esta pantalla.
     "Salario devengado" entra SOLO si el base esta vacio: en enero los cuatro
     que lo tienen lleno repiten ahi su propio base, y sumarlo seria contar
     Q18,000 dos veces. Verificado fila por fila.
     La propina NO entra: es del cliente y va a su propio bloque del DRE. */
  function _pago(fila) {
    var base = _finNum_(fila[cBase]);
    if (!base && cDev >= 0) base = _finNum_(fila[cDev]);
    var extra = 0;
    if (cBono >= 0) extra += _finNum_(fila[cBono]);
    if (cHoras >= 0) extra += _finNum_(fila[cHoras]);
    return (base || 0) + extra;
  }

  var fija = 0, extra = 0, nFija = 0, nExtra = 0;
  // El area del extra sale del propio puesto: "Extra cocina" / "Extra barra".
  // Un "Extra" a secas cuenta igual como extra pero sin area, y eso se ve en la
  // pantalla en vez de repartirse a ojo.
  var porArea = { cocina: 0, barra: 0, sin_area: 0 };
  var finiquito = 0;
  for (var i = rCab + 1; i < filas.length; i++) {
    var puesto = _finSinAcentos_(String(filas[i][cPuesto] || '')).toLowerCase().trim();
    if (puesto.indexOf('sub total') === 0 || puesto.indexOf('subtotal') === 0) break;
    var v = _pago(filas[i]);
    if (!v) continue;
    /* El finiquito es costo de nomina pero NO es mano de obra de la operacion:
       no dice cuanta gente hizo falta ese mes. Va en su propia bolsa para que
       no ensucie el ratio de extras sobre la venta, que es el que se mira para
       decidir personal. Igual suma al total. */
    if (puesto.indexOf('finiquito') === 0) { finiquito += v; continue; }
    // Se compara por prefijo para que "Extra ", "Extras" y "Extra cocina" entren.
    if (puesto.indexOf('extra') === 0) {
      extra += v; nExtra++;
      var resto = puesto.slice(5).replace(/^s?\s+/, '').trim();
      // barra y sala son lo mismo (Juanma, 22-sep-2026)
      if (resto.indexOf('cocina') === 0) porArea.cocina += v;
      else if (resto.indexOf('barra') === 0 || resto.indexOf('sala') === 0) porArea.barra += v;
      else porArea.sin_area += v;
    } else { fija += v; nFija++; }
  }
  return { fija: fija, extra: extra, finiquito: finiquito,
           suma: fija + extra + finiquito, n_fija: nFija, n_extra: nExtra,
           extra_cocina: porArea.cocina, extra_barra: porArea.barra,
           extra_sin_area: porArea.sin_area };
}

/** "Sub total" de la columna "Salario base" de una pestana de la planilla. */
function _finSubTotalSalario_(hoja) {
  var filas;
  try { filas = hoja.getDataRange().getValues(); } catch (e) { return 0; }
  var col = -1, fila = -1;
  for (var r = 0; r < filas.length && (col < 0 || fila < 0); r++) {
    for (var c = 0; c < filas[r].length; c++) {
      var t = _finSinAcentos_(String(filas[r][c] || '')).toLowerCase().replace(/\s+/g, ' ').trim();
      if (col < 0 && t === 'salario base') col = c;
      if (fila < 0 && (t === 'sub total' || t === 'subtotal')) fila = r;
    }
  }
  if (col < 0 || fila < 0) return 0;
  var v = Number(filas[fila][col]);
  return isNaN(v) ? 0 : v;
}

function _finSinAcentos_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/[\u00e1\u00e0\u00e4\u00e2]/g, 'a').replace(/[\u00e9\u00e8\u00eb\u00ea]/g, 'e')
    .replace(/[\u00ed\u00ec\u00ef\u00ee]/g, 'i').replace(/[\u00f3\u00f2\u00f6\u00f4]/g, 'o')
    .replace(/[\u00fa\u00f9\u00fc\u00fb]/g, 'u').replace(/\u00f1/g, 'n')
    .replace(/[\u00c1\u00c0\u00c4\u00c2]/g, 'A').replace(/[\u00c9\u00c8\u00cb\u00ca]/g, 'E')
    .replace(/[\u00cd\u00cc\u00cf\u00ce]/g, 'I').replace(/[\u00d3\u00d2\u00d6\u00d4]/g, 'O')
    .replace(/[\u00da\u00d9\u00dc\u00db]/g, 'U').replace(/\u00d1/g, 'N');
}

// categoria -> [bloque del DRE, tipo F=fijo S=semivariable V=variable]
var FIN_MAP = {
  'ALQUILERES': ['Inmueble y ocupacion', 'F'], 'ALQUILER': ['Inmueble y ocupacion', 'F'],
  'SERVICIOS_PUBLICOS': ['Tarifas y servicios', 'V'], 'SERVICIOS PUBLICOS': ['Tarifas y servicios', 'V'],
  'GAS': ['Tarifas y servicios', 'V'], 'TELEFONOS_Y_CELULARES': ['Tarifas y servicios', 'F'],
  // alquiler de la maquina de agua: contrato mensual fijo, no mercaderia.
  // Estaba como BEBIDAS e inflaba el food cost casi un punto.
  'ALQUILER_EQUIPO': ['Tarifas y servicios', 'F'],
  'TELEFONOS Y CELULARES': ['Tarifas y servicios', 'F'], 'SERVICIO DE INTERNET': ['Tarifas y servicios', 'F'],
  'SERVICIOS_PROFESIONALES': ['Prestadores y honorarios', 'F'],
  'SERVICIOS PROFESIONALES': ['Prestadores y honorarios', 'F'],
  'HONORARIOS CONTABLES': ['Prestadores y honorarios', 'F'],
  'SERVICIO DE MONITOREO Y ALARMA': ['Prestadores y honorarios', 'F'],
  'SUMINISTRO DE LIMPIEZA': ['Prestadores y honorarios', 'S'],
  'NOMINA': ['Nomina y salarios', 'S'], 'IGSS': ['Nomina y salarios', 'S'],
  'PROPINAS_AL_EQUIPO': ['Propinas al equipo', 'V'], 'PROPINAS_PASSTHROUGH': ['Propinas al equipo', 'V'],
  // regla 12: bloque propio. Dentro de Nomina y salarios se perdia (Q2,750 en jul-ago)
  'UNIFORMES': ['Uniformes', 'V'],
  'IMPUESTOS': ['Impuestos', 'V'], 'TRIBUTO': ['Impuestos', 'V'],
  'COMISIONES_BANCARIAS': ['Comisiones y cargos', 'V'],
  'COMISION TARJETA DE CREDITO': ['Comisiones y cargos', 'V'],
  'MARKETING_DIGITAL': ['Marketing', 'S'], 'CUOTAS_Y_SUSCRIPCIONES': ['Marketing', 'F'],
  // Honorarios de marketing digital (15-sep-2026, decision de Juanma). MISMO BLOQUE que
  // la pauta —el DRE no cambia— pero categoria aparte, para que el CAC de Marketing OS
  // excluya los honorarios POR CATEGORIA y deje de depender del texto del banco.
  // Con esto MARKETING_DIGITAL queda solo con medios: FACEBK y GOOGLE*ADS de la tarjeta.
  'MARKETING_HONORARIOS': ['Marketing', 'F'],
  'CUOTAS Y SUSCRIPCIONES': ['Marketing', 'F'],
  'MANTENIMIENTO': ['Mantencion', 'V'], 'MANTENIMIENTO Y ACCESORIOS EQUIPO': ['Mantencion', 'V'],
  'MATERIALES': ['Mantencion', 'V'],
  'PAPELERIA_Y_UTILES': ['Bienes de uso', 'V'], 'PAPELERIA Y UTILES': ['Bienes de uso', 'V'],
  'ATENCION A CLIENTES': ['Bienes de uso', 'V'], 'GASTOS_ADMINISTRATIVOS': ['Bienes de uso', 'V'],
  'GASTOS_VARIOS': ['Bienes de uso', 'V'], 'VIATICOS': ['Bienes de uso', 'V'],
  'PARQUEOS': ['Bienes de uso', 'V'], 'SEGUROS_Y_FIANZAS': ['Bienes de uso', 'F'],
  'SEGUROS Y FIANZAS': ['Bienes de uso', 'F'], 'EVENTOS': ['Bienes de uso', 'V']
};

// Banda del sector por bloque, en % de la venta. De aca sale el "sobre la banda".
var FIN_REF = {
  'Inmueble y ocupacion': [6, 10], 'Tarifas y servicios': [4, 6],
  'Prestadores y honorarios': [1, 3], 'Nomina y salarios': [25, 30],
  'Impuestos': [0, 0], 'Comisiones y cargos': [3, 5], 'Marketing': [4, 8],
  'Mantencion': [2, 4], 'Bienes de uso': [3, 5],
  'Propinas al equipo': [0, 0],  // sin banda: es pass-through del cliente
  'Uniformes': [0, 0]            // sin banda del sector
};

// Lo que no es gasto de la operacion y no entra al DRE.
// ANULADA no es una categoria del maestro: la pone el calculo a la factura con
// Estado "Anulado" (regla 13).
var FIN_FUERA = ['DEVOLUCION_INVERSION', 'CARGO_FRAUDULENTO', 'PAGO_TARJETA_CREDITO',
                 'PAGO_TARJETA', 'TRANSFERENCIA', 'TRANSFERENCIA_SALIENTE',
                 'PERSONAL', 'SALDO', 'POR_CLASIFICAR', 'ANULADA',
                 // 21-sep-2026 (Juanma): factura a nombre de la empresa que no es del
                 // restaurante ni gasto personal. No es gasto ni extraccion.
                 'FACTURA_AJENA'];

// Hoja -> columnas. Seccion 3 de la especificacion.
var FIN_LIBROS = [
  { hoja: '01_FEL_Maestro',         monto: 10, usd: 0, cat: 14, pers: 15, iva: 11, prov: 7, nit: 5, estado: 8 },
  { hoja: '03_Banco_Industrial',    monto: 4,  usd: 0, cat: 7,  pers: 8,  desc: 3 },
  { hoja: '04_Banco_BAC',           monto: 5,  usd: 0, cat: 8,  pers: 9,  desc: 4 },
  { hoja: '05_Tarjeta_Credito_BAC', monto: 3,  usd: 4, cat: 5,  pers: 6,  desc: 2 }
];

// 04_Banco_BAC entro al calculo el 4-sep-2026. Antes solo se leia para el saldo
// bancario y eso dejaba Q279,521 del año fuera del DRE. De esos, Q59,496 son
// gasto real; el resto es pago de tarjeta, retiros del socio y gasto personal,
// que siguen fuera por FIN_FUERA o por Es_Personal.


// ---------------------------------------------------------------- utilidades

function _finSemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;             // domingo = 7, no 0
  t.setUTCDate(t.getUTCDate() + 4 - dia);   // al jueves de su semana
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}
function _finEsFecha_(v) { return v instanceof Date && !isNaN(v.getTime()); }

/**
 * Un numero de celda, aunque venga escrito como texto: "1,234.50", "Q 1,000".
 * NaN si no es numero. M17 (15-sep-2026): Number('1,234.50') es NaN y _finNum_
 * lo volvia 0 sin avisar; una caja escrita como texto daba 0 dias de caja.
 */
function _finNumero_(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  var t = v.replace(/[Q\s,]/g, '');
  return t === '' ? NaN : Number(t);
}
function _finNum_(v) { var n = _finNumero_(v); return isNaN(n) ? 0 : n; }

/** Regla 10. El dia de una fecha del maestro, a medianoche: 12:00 o mas es el dia siguiente. */
function _finDia_(v) {
  if (!_finEsFecha_(v) || (!v.getHours() && !v.getMinutes())) return v;
  return new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
}

/** La semana ISO con su año, como numero AAAAWW (202637). Ordena bien entre años. */
function _finClaveSemana_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() * 100 + Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

/** El lunes de una clave AAAAWW. La semana 1 es la que tiene el 4 de enero. */
function _finLunesDeClave_(k) {
  var anio = Math.floor(k / 100), ene4 = new Date(anio, 0, 4);
  return new Date(anio, 0, 4 - (ene4.getDay() || 7) + 1 + (k % 100 - 1) * 7);
}

/**
 * Regla 11. La planilla de un mes: la del mes si esta cargada; si no, la del
 * ultimo mes anterior que la tenga; si no hay anterior, la siguiente.
 * Devuelve { valor, origen: 'planilla' | 'estimada' | 'sin dato', desde: mes }.
 * Mismo criterio que ultimo_devengado() en generar_finanzas.py.
 */
function _finUltimoDevengado_(valores, m) {
  if (valores[m]) return { valor: valores[m], origen: 'planilla', desde: m };
  for (var k = m - 1; k >= 1; k--) if (valores[k]) return { valor: valores[k], origen: 'estimada', desde: k };
  for (var j = m + 1; j <= 12; j++) if (valores[j]) return { valor: valores[j], origen: 'estimada', desde: j };
  return { valor: 0, origen: 'sin dato', desde: 0 };
}
function _finDDMM_(d) {
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function _finFecha_(d) { return _finDDMM_(d) + '/' + d.getFullYear(); }
function _finR_(n, dec) {
  var f = Math.pow(10, dec === undefined ? 2 : dec);
  return Math.round(n * f) / f;
}
function _finEn_(lista, v) { return lista.indexOf(v) !== -1; }


// ------------------------------------------------------------------ el calculo

/**
 * Todo lo que pinta la pantalla. Cachea 3 horas: el maestro se actualiza una
 * vez por semana y la vista la abren varias personas el mismo dia.
 *
 * EL TOKEN VA PRIMERO. Hasta el 12-sep-2026 esta funcion no pedia nada: la
 * vista la llamaba con google.script.run.getFinanzasData() a secas. El repaso
 * de permisos del 10-sep cerro getMetasData y getComparativoData —que la
 * llaman por dentro— pero dejo abierta la puerta de calle: cualquiera que
 * pudiera ejecutar la web app se llevaba el maestro entero, que es justo lo que
 * esas dos protegian. doGet protege la PAGINA, no la FUNCION.
 *
 * Sin auth cae en la sesion del dominio, que es como funcionan la bateria de
 * pruebas, los diagnosticos y calentarCaches() desde el editor.
 */
function getFinanzasData(auth, forzar) {
  exigirModulo_(auth, 'finanzas');
  return _finDatos_(forzar);
}

/**
 * El mismo dato, sin control de acceso. Es privada a proposito: solo la llaman
 * las funciones de este archivo que YA verificaron a quien las llamo. Asi el
 * permiso se pide una vez por peticion y no una vez por capa.
 */
/* La clave lleva la meta (14-sep-2026). El calculo guarda meta_cogs y meta_area
   adentro: al pasar la meta de 30 a 28 en PARAMETROS, la bateria leyo 30 de un calculo
   de hacia minutos, cacheado 3 horas. Con la meta en la clave, cambiarla deja de servir
   el calculo viejo en el acto. */
function finCacheClave_() {
  var m = metasFoodCost_();
  // v6 (15-sep-2026): semanas con año y consecutivas, planilla estimada, bloque
  // Uniformes y meses sin venta. Una cache v5 pintaria la pantalla nueva con el
  // calculo viejo.
  // v7 (15-sep-2026): food cost sobre venta sin servicio (ventas_ss, regla 14).
  // v8 (21-sep-2026): FACTURA_AJENA fuera a proposito. Una cache v7 la mostraria como fuga.
  // v9 (21-sep-2026): regla 15, la factura manda. Una cache v8 traeria el doble conteo.
  return 'finanzas_v9_m' + m.global + '-' + m.BARRA;
}

function _finDatos_(forzar) {
  var cache = CacheService.getScriptCache();
  if (!forzar) {
    var guardado = cache.get(finCacheClave_());
    if (guardado) {
      try { return JSON.parse(guardado); } catch (e) { /* cache corrupta: se recalcula */ }
    }
  }
  var datos = _finCalcular_();
  try {
    // v5 (14-sep-2026): regla 9, los pagos a proveedores que facturan por FEL
    // dejan de sumar. Una cache v4 mostraria el DRE con el doble conteo.
    // v4 (12-sep-2026, tarde): la v3 se lleno con el lector de planilla roto
    // y habria dicho "8 meses del respaldo" hasta 3 horas despues del arreglo.
    // v3 (12-sep-2026): el payload cambio (meta de food cost, cobertura,
    // equilibrio) y una cache vieja habria pintado la pantalla nueva con el
    // dato viejo, sin error y sin aviso.
    cache.put(finCacheClave_(), JSON.stringify(datos), 3 * 60 * 60);
  } catch (e) {
    // Si no cabe en cache no es motivo para no devolver los datos.
  }
  return datos;
}

/** Para el boton "actualizar" de la vista: recalcula sin esperar a la cache. */
function refrescarFinanzas(auth) {
  exigirModulo_(auth, 'finanzas');
  // Tambien los parametros: si alguien acaba de cambiar la meta o el tipo de cambio,
  // "Actualizar" tiene que mostrarlo ya.
  CacheService.getScriptCache().removeAll(['fin_par_v2_food_cost_objetivo_pct',
    'fin_par_v2_food_cost_barra_pct', 'fin_par_v2_tipo_cambio_usd']);
  METAS_FC_MEMO_ = null;
  return _finDatos_(true);
}


function _finCalcular_() {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var anio = new Date().getFullYear();
  // Los dos parametros y la planilla se leen UNA vez, antes de las pasadas.
  // Regla 3 de Apps Script: nada de llamadas a servicio dentro de un bucle.
  var usd = _finParametro_('tipo_cambio_usd', FIN_USD_DEF);
  var metaFood = _finMetaFood_();
  var planilla = _finPlanilla_();

  var mes = {}, sem = {};
  function _mes(m) {
    if (!mes[m]) mes[m] = { m: m, ventas: 0, ventas_ss: 0, eventos: 0, com: 0, cogs: 0, igss: 0,
                            dev: 0, pers: 0, tickets: 0, bloques: {}, tipo: { F: 0, S: 0, V: 0 },
                            // venta por semana ISO contando SOLO los dias que caen en
                            // este mes. Una semana a caballo entre dos meses no puede
                            // atribuirse entera a ninguno de los dos.
                            porSemana: {} };
    return mes[m];
  }
  function _sem(k) {                                   // k = clave AAAAWW
    // area y bloques se agregaron el 22-sep-2026 para la pantalla "El gasto":
    // hasta entonces la compra por area y las secciones del DRE solo existian
    // por MES, asi que no habia forma de mirar el gasto semana a semana. No se
    // lee nada nuevo del maestro: son los mismos montos que ya pasan por este
    // bucle, guardados ademas por semana.
    if (!sem[k]) sem[k] = { clave: k, v: 0, v_ss: 0, com: 0, tickets: 0, cogs: 0,
                            area: { cocina: 0, barra: 0 }, bloques: {},
                            ini: null, fin: null };
    return sem[k];
  }

  // ---- ventas ----------------------------------------------------------
  var V = ss.getSheetByName('02_Ventas_Maestro').getDataRange().getValues();
  var ultVenta = null;
  for (var r = FIN_PRIMERA_FILA - 1; r < V.length; r++) {
    var f = _finDia_(V[r][1]);                          // col 2: Fecha (regla 10)
    if (!_finEsFecha_(f) || f.getFullYear() !== anio) continue;
    if (!ultVenta || f > ultVenta) ultVenta = f;
    var neto = _finNum_(V[r][3]) / 1.12;                 // regla 1: col 4 con IVA
    // regla 14 (Juanma, 15-sep-2026): el food cost va sobre la venta SIN servicio,
    // que es la base de la meta y de las fichas. El Subtotal trae el 10% de servicio;
    // la base del ticket es Costo + Ganancia (cols 6 y 7): Subtotal / 1.10 en 1,797
    // de 1,902 tickets. Una tarjeta de regalo no lleva servicio: si la base viene
    // vacia o mayor que el Subtotal, vale el Subtotal.
    var base = (_finNum_(V[r][5]) + _finNum_(V[r][6])) / 1.12;
    var sinServ = (base > 0 && base < neto) ? base : neto;
    var M = _mes(f.getMonth() + 1);
    // regla 2: el evento privado es ingreso adicional, no venta de restaurante
    if ((String(V[r][7] || '') + String(V[r][11] || '')).toUpperCase().indexOf('EVENTO') !== -1) {
      M.eventos += neto;
      continue;
    }
    M.ventas += neto;
    M.ventas_ss += sinServ;
    M.tickets += 1;
    M.com += Math.round(_finNum_(V[r][8]));              // col 9: comensales
    var wISO = _finSemanaISO_(f);
    if (!M.porSemana[wISO]) M.porSemana[wISO] = { v: 0, com: 0 };
    M.porSemana[wISO].v += neto;
    M.porSemana[wISO].com += Math.round(_finNum_(V[r][8]));
    var S = _sem(_finClaveSemana_(f));
    S.v += neto; S.v_ss += sinServ; S.tickets += 1; S.com += Math.round(_finNum_(V[r][8]));
    if (!S.ini || f < S.ini) S.ini = f;
    if (!S.fin || f > S.fin) S.fin = f;
  }

  // ---- gasto: una sola pasada que arma el DRE y el COGS semanal ---------
  // Controles de cobertura. Existen porque una vez se escribio una
  // reclasificacion contra la hoja sin mirar esta capa: si una categoria no
  // esta en el mapa, el dinero se cae en silencio. Aqui se hace visible.
  var porClasificar = 0, ultCarga = {}, felCompra = 0, efeCompra = 0;
  var anuladasN = 0, anuladasQ = 0;
  var sinMapear = 0, sinIdentificar = 0;

  // COBERTURA: que pasa con cada quetzal de cada hoja. No cambia ningun numero;
  // dice donde termina el dinero. Estaba solo en generar_finanzas.py y era la
  // unica parte del pilar que no se podia ver sin correr Python en un Mac.
  var cob = {}, desconocidas = {};
  var felNit = {}, pagoSaltado = {};   // regla 9: factura por NIT y pago saltado por proveedor
  FIN_LIBROS.forEach(function (L) { cob[L.hoja] = {}; });

  // Compra de mercaderia partida por area y por familia de producto. Es lo que
  // convierte el techo de compra en algo que Jeffry y Jose pueden usar: deja de
  // ser un numero del restaurante y pasa a ser el de cada quien.
  var fam = _finFamilias_();
  var compra = { cocina: { total: 0, f: {}, mes: {} }, barra: { total: 0, f: {}, mes: {} } };
  // La misma categoria -> area que usa _compra, pero guardando en la SEMANA.
  // Va aparte y no dentro de _compra porque _compra agrupa por mes y por
  // familia de proveedor, y eso no se quiere repetir por semana: infla la
  // respuesta y nadie lo mira a ese nivel.
  function _semArea(S, cat, monto) {
    var area = FIN_AREA_CAT[cat];
    if (!area) return;                  // sin area no se inventa: igual que _compra
    S.area[area] += monto;
  }

  function _compra(cat, mes, prov, monto) {
    var area = FIN_AREA_CAT[cat];
    if (!area) return;
    var A = compra[area];
    A.total += monto;
    A.mes[mes] = (A.mes[mes] || 0) + monto;
    // Sin factura no hay proveedor con quien casar: se agrupa aparte a
    // proposito. Saber cuanto se compra fuera de factura ES el dato.
    var f = (cat.indexOf('_EFECTIVO') > 0) ? 'SIN_FACTURA'
          : (fam[_finLlaveProv_(prov)] || 'REVISAR');
    A.f[f] = (A.f[f] || 0) + monto;
  }
  // Los cuatro libros se leen UNA vez: la regla 15 necesita verlos todos antes de sumar.
  var hojasFin = {};
  FIN_LIBROS.forEach(function (L) { hojasFin[L.hoja] = ss.getSheetByName(L.hoja).getDataRange().getValues(); });
  var conFactura = _finPagosConFactura_(hojasFin, anio, usd);
  var facturaMandaN = 0, facturaMandaQ = 0;
  FIN_LIBROS.forEach(function (L) {
    var filas = hojasFin[L.hoja];
    for (var r = FIN_PRIMERA_FILA - 1; r < filas.length; r++) {
      var f = _finDia_(filas[r][0]);                    // regla 10
      if (!_finEsFecha_(f) || f.getFullYear() !== anio) continue;
      if (!ultCarga[L.hoja] || f > ultCarga[L.hoja]) ultCarga[L.hoja] = f;

      var cat = String(filas[r][L.cat - 1] || '').trim();
      // regla 13: la factura anulada en SAT no es gasto, sea cual sea su categoria
      var anulada = !!L.estado && String(filas[r][L.estado - 1] || '').trim() === 'Anulado';
      if (anulada) cat = 'ANULADA';
      if (cat === 'POR_CLASIFICAR') porClasificar++;

      var q = _finNum_(filas[r][L.monto - 1]);
      if (L.usd) q += _finNum_(filas[r][L.usd - 1]) * usd;
      if (anulada) { anuladasN++; anuladasQ += q; }

      // Espeja a proposito las reglas de abajo en vez de reusarlas: si las dos
      // se separan, la cobertura deja de cuadrar y eso mismo es la alarma.
      var esPers = String(filas[r][L.pers - 1] || '').trim() === 'S\u00ed';
      var pagoDe = L.desc ? _finPagoDeFactura_(L.hoja, filas[r][L.desc - 1], cat) : '';
      var tieneFactura = !!conFactura[L.hoja + '|' + r];
      var dest = _finDestino_(cat, L.hoja, esPers, pagoDe, tieneFactura);
      if (L.nit && !anulada) {
        var nit = String(filas[r][L.nit - 1] || '').trim().replace(/\.0$/, '');
        felNit[nit] = (felNit[nit] || 0) + q;
      }
      if (dest === 'REGLA 9: pago de factura FEL') pagoSaltado[pagoDe] = (pagoSaltado[pagoDe] || 0) + q;
      cob[L.hoja][dest] = (cob[L.hoja][dest] || 0) + q;
      if (dest === 'CATEGORIA DESCONOCIDA') {
        var kd = cat || '(sin categoria)';
        desconocidas[kd] = (desconocidas[kd] || 0) + q;
      }
      // El IVA de una compra con factura es credito recuperable, no costo. La
      // columna vale 0 en las facturas de pequeño contribuyente, asi que restar
      // por ella sirve para los dos casos sin suponer una tasa. La tarjeta no
      // trae columna de IVA: esa mercaderia se queda en bruto.
      var costo = q - (L.iva ? _finNum_(filas[r][L.iva - 1]) : 0);
      var M = _mes(f.getMonth() + 1);

      if (anulada) continue;                            // regla 13
      if (esPers || cat === 'PERSONAL') {
        M.pers += q; continue;                          // gasto personal: nunca es del negocio
      }
      if (cat === 'DEVOLUCION_INVERSION') { M.dev += q; continue; }
      // lo que salio del banco y todavia no se sabe a quien
      if (cat === 'TRANSFERENCIA_SALIENTE') sinIdentificar += q;
      if (!cat || _finEn_(FIN_FUERA, cat) || cat.indexOf('INGRESO') === 0) continue;

      if (_finEn_(FIN_COGS_CATS, cat)) {
        // regla 3: la mercaderia pagada desde un banco es el pago de la factura
        // que ya vino por FEL. Sumarla seria contarla dos veces.
        if (_finEn_(FIN_BANCOS, L.hoja)) continue;
        M.cogs += costo; felCompra += q;   // costo neto; el ratio de factura va bruto
        var Sc = _sem(_finClaveSemana_(f));
        Sc.cogs += costo;                             // A13: tambien en semana sin venta
        _semArea(Sc, cat, costo);
        _compra(cat, f.getMonth() + 1, L.prov ? filas[r][L.prov - 1] : '', costo);
        continue;
      }
      if (_finEn_(FIN_EFECTIVO, cat)) {                 // compra sin factura
        M.cogs += q; efeCompra += q;
        var Se = _sem(_finClaveSemana_(f));
        Se.cogs += q;
        _semArea(Se, cat, q);
        _compra(cat, f.getMonth() + 1, '', q);
        continue;
      }
      // el alquiler se cuenta por el banco, no por la factura
      if ((cat === 'ALQUILERES' || cat === 'ALQUILER') && L.hoja === '01_FEL_Maestro') continue;
      // regla 8: hay categorias que solo se cuentan por FEL; el movimiento del
      // banco es el pago de esa misma factura
      if (_finEn_(FIN_SOLO_FEL, cat) && L.hoja !== '01_FEL_Maestro') continue;
      // regla 9: pago de un proveedor que siempre factura por FEL
      if (pagoDe) continue;
      // regla 15: la factura manda. El pago con factura FEL no suma.
      if (tieneFactura) { facturaMandaN++; facturaMandaQ += q; continue; }
      if (cat === 'IGSS') M.igss += q;

      var d = FIN_MAP[cat];
      if (!d) { sinMapear += q; continue; }             // categoria sin mapear: no se inventa
      M.bloques[d[0]] = (M.bloques[d[0]] || 0) + q;
      M.tipo[d[1]] += q;
      var Sb = _sem(_finClaveSemana_(f));
      Sb.bloques[d[0]] = (Sb.bloques[d[0]] || 0) + q;
    }
  });

  // ---- caja: ultimo saldo de cada banco en cada semana ------------------
  // Por clave AAAAWW. El arrastre de una semana sin movimiento se hace al armar
  // las semanas, abajo. El saldo tambien se lee si viene como texto (M17).
  var saldosUlt = { bi: {}, bac: {} };
  [{ hoja: '03_Banco_Industrial', col: 6, k: 'bi' },
   { hoja: '04_Banco_BAC', col: 7, k: 'bac' }].forEach(function (B) {
    var filas = ss.getSheetByName(B.hoja).getDataRange().getValues();
    for (var r = FIN_PRIMERA_FILA - 1; r < filas.length; r++) {
      var f = _finDia_(filas[r][0]);
      if (!_finEsFecha_(f) || f.getFullYear() !== anio) continue;
      if (!ultCarga[B.hoja] || f > ultCarga[B.hoja]) ultCarga[B.hoja] = f;
      var s = _finNumero_(filas[r][B.col - 1]);
      if (!isNaN(s)) saldosUlt[B.k][_finClaveSemana_(f)] = s;
    }
  });

  // ---- el mes: DRE y los cinco numeros ---------------------------------
  var meses = [], bloquesVivos = {}, sinVenta = [];
  Object.keys(mes).map(Number).sort(function (a, b) { return a - b; }).forEach(function (m) {
    var M = mes[m];
    var gop = 0;
    Object.keys(M.bloques).forEach(function (b) {
      if (b !== 'Impuestos') gop += M.bloques[b];
      if (M.bloques[b]) bloquesVivos[b] = true;
    });
    if (!M.ventas) {
      // M20 (15-sep-2026): un mes con gasto y sin venta (los primeros dias del
      // mes, antes de cargar el POS) no se pinta, pero su dinero SI va al año.
      // Hasta hoy desaparecia. Sin su nomina de banco: la del DRE es la planilla.
      if (M.cogs || gop) {
        sinVenta.push({ m: m, mes: FIN_MESES[m - 1], cogs: M.cogs,
                        gop: gop - (M.bloques['Nomina y salarios'] || 0),
                        bloques: M.bloques, pers: M.pers, dev: M.dev });
      }
      return;
    }
    // regla 4: la nomina del DRE sale de la planilla, no del banco
    // regla 11: sin planilla del mes, la ultima cargada, marcada como estimada
    var pl = _finUltimoDevengado_(planilla.valores, m);
    var devengado = pl.origen === 'planilla' ? pl.valor : null;
    // El mes EN CURSO con planilla estimada lleva solo la parte de los dias con
    // venta cargada (Juanma, 15-sep-2026): una planilla entera contra medio mes de
    // venta daba prime 73.8% en septiembre. Un mes cerrado sin planilla va entero.
    var parte = 1;
    if (pl.origen === 'estimada' && ultVenta && ultVenta.getFullYear() === anio &&
        ultVenta.getMonth() + 1 === m) {
      parte = ultVenta.getDate() / new Date(anio, m, 0).getDate();
    }
    var labor = pl.valor * parte + M.igss;
    var gopDev = gop - (M.bloques['Nomina y salarios'] || 0) + labor;
    meses.push({
      m: m, mes: FIN_MESES[m - 1], ventas: _finR_(M.ventas), ventas_ss: _finR_(M.ventas_ss),
      eventos: _finR_(M.eventos),
      com: M.com, cogs: _finR_(M.cogs), labor: _finR_(labor), igss: _finR_(M.igss),
      devengado: devengado !== null,
      // El reparto fijo/extra del mes, cuando la pestana de planilla lo trae.
      // Va del mes de la planilla que se USO (pl.desde), no del mes del
      // calendario: un mes estimado con la planilla de agosto muestra el
      // reparto de agosto, y la pantalla dice que es estimado.
      planilla: (planilla.detalle && planilla.detalle[pl.desde])
        ? { fija: _finR_(planilla.detalle[pl.desde].fija),
            extra: _finR_(planilla.detalle[pl.desde].extra),
            extra_cocina: _finR_(planilla.detalle[pl.desde].extra_cocina || 0),
            extra_barra: _finR_(planilla.detalle[pl.desde].extra_barra || 0),
            extra_sin_area: _finR_(planilla.detalle[pl.desde].extra_sin_area || 0),
            finiquito: _finR_(planilla.detalle[pl.desde].finiquito || 0),
            n_extra: planilla.detalle[pl.desde].n_extra,
            cuadra: planilla.detalle[pl.desde].cuadra,
            origen: pl.origen, desde: pl.desde }
        : null,
      labor_origen: pl.origen, labor_desde: pl.desde ? FIN_MESES[pl.desde - 1] : '',
      labor_parte: _finR_(parte, 3),
      gop: _finR_(gopDev), imp: _finR_(M.bloques['Impuestos'] || 0),
      dev: _finR_(M.dev), pers: _finR_(M.pers),
      neto: _finR_(M.ventas - M.cogs - gopDev),
      cogsp: _finR_(M.cogs / (M.ventas_ss || M.ventas) * 100, 1),   // regla 14: sin servicio
      laborp: _finR_(labor / M.ventas * 100, 1),
      primep: _finR_((M.cogs + labor) / M.ventas * 100, 1),
      netop: _finR_((M.ventas - M.cogs - gopDev) / M.ventas * 100, 1),
      tickets: M.tickets,
      // Punto de equilibrio del mes: gasto fijo / margen de contribucion. Lo
      // semivariable entra a la mitad, a los dos lados.
      //
      // CORREGIDO el 22-sep-2026. Hasta esa fecha el margen era
      // (ventas - cogs) / ventas: solo restaba la mercaderia. El gasto
      // operativo que se mueve con la venta —lo variable mas la mitad de lo
      // semivariable— no estaba ni en el fijo ni restado del margen, o sea que
      // desaparecia del calculo. El efecto era un equilibrio sistematicamente
      // bajo: la tabla daba holgura positiva en los NUEVE meses de un año que
      // cerro en -Q51,014. Un equilibrio que da verde todos los meses de un año
      // con perdida no es un equilibrio. Lo vio Juanma.
      //
      // Que NO cambia: el fijo sigue siendo F + S/2. Y sigue en pie el aviso
      // viejo: el fijo sale de la clasificacion F/S/V del gasto BANCARIO, o sea
      // que su nomina es la pagada, no la devengada, mientras el resto de la
      // pantalla va devengada.
      //
      // M.tipo NO incluye la mercaderia: las categorias de FIN_COGS_CATS y
      // FIN_EFECTIVO hacen continue antes de llegar a FIN_MAP. Verificado al
      // corregir; si eso cambiara, aca se estaria restando el COGS dos veces.
      fijo: _finR_(M.tipo.F + M.tipo.S * 0.5),
      variable: _finR_(M.tipo.V + M.tipo.S * 0.5),
      mc: _finR_((M.ventas - M.cogs - (M.tipo.V + M.tipo.S * 0.5)) / M.ventas * 100, 1),
      // Un margen de contribucion <= 0 significa que el mes no llega al
      // equilibrio a ningun volumen: cada quetzal vendido trae mas costo
      // variable del que deja. Se devuelve null, no 0, para que la pantalla
      // diga "no alcanzable" en vez de dibujar un equilibrio de Q0.
      bev: (M.ventas - M.cogs - (M.tipo.V + M.tipo.S * 0.5)) > 0
        ? _finR_((M.tipo.F + M.tipo.S * 0.5) /
                 ((M.ventas - M.cogs - (M.tipo.V + M.tipo.S * 0.5)) / M.ventas))
        : null,
      bloques: M.bloques, tipo: M.tipo, porSemana: M.porSemana
    });
  });

  var anioTot = { ventas: 0, ventas_ss: 0, cogs: 0, labor: 0, gop: 0, neto: 0, eventos: 0,
                  com: 0, pers: 0, dev: 0, bloques: {}, tipo: { F: 0, S: 0, V: 0 } };
  meses.forEach(function (x) {
    ['ventas', 'ventas_ss', 'cogs', 'labor', 'gop', 'neto', 'eventos', 'com', 'pers', 'dev'].forEach(function (k) {
      anioTot[k] += x[k];
    });
    Object.keys(x.bloques).forEach(function (b) {
      anioTot.bloques[b] = (anioTot.bloques[b] || 0) + x.bloques[b];
    });
    ['F', 'S', 'V'].forEach(function (t) { anioTot.tipo[t] += x.tipo[t]; });
  });
  // M20: el dinero de los meses sin venta tambien es del año.
  sinVenta.forEach(function (x) {
    anioTot.cogs += x.cogs; anioTot.gop += x.gop; anioTot.neto -= x.cogs + x.gop;
    anioTot.pers += x.pers; anioTot.dev += x.dev;
    Object.keys(x.bloques).forEach(function (b) {
      if (b !== 'Nomina y salarios') anioTot.bloques[b] = (anioTot.bloques[b] || 0) + x.bloques[b];
    });
  });
  ['ventas', 'ventas_ss', 'cogs', 'labor', 'gop', 'neto', 'eventos', 'pers', 'dev'].forEach(function (k) {
    anioTot[k] = _finR_(anioTot[k]);
  });
  anioTot.cogsp = _finR_(anioTot.cogs / (anioTot.ventas_ss || anioTot.ventas) * 100, 1);   // regla 14
  anioTot.laborp = _finR_(anioTot.labor / anioTot.ventas * 100, 1);
  anioTot.primep = _finR_((anioTot.cogs + anioTot.labor) / anioTot.ventas * 100, 1);
  anioTot.netop = _finR_(anioTot.neto / anioTot.ventas * 100, 1);

  // Cada bloque contra su banda del sector. El desvio va en quetzales al mes,
  // que es lo unico que permite compararlos entre si.
  // regla 4 tambien aca: el bloque de nomina va DEVENGADO, no el pago bancario.
  // Si se dejara el banco, esta tabla estaria en una base distinta al resto de
  // la pantalla y el bloque leeria 21.9% "bajo la banda" cuando no lo esta.
  anioTot.bloques['Nomina y salarios'] = anioTot.labor;
  bloquesVivos['Nomina y salarios'] = true;

  var bloques = Object.keys(bloquesVivos).map(function (b) {
    var q = anioTot.bloques[b] || 0;
    var p = _finR_(q / anioTot.ventas * 100, 1);
    var ref = FIN_REF[b] || [0, 0];
    var sobre = ref[1] ? _finR_(Math.max(p - ref[1], 0) / 100 * anioTot.ventas / meses.length) : 0;
    return { bloque: b, q: _finR_(q), pct: p, min: ref[0], max: ref[1],
             zona: !ref[1] ? 'gris' : (p <= ref[1] ? (p < ref[0] ? 'bajo' : 'verde') : 'rojo'),
             sobre_mes: sobre };
  }).sort(function (a, b) { return b.q - a.q; });

  // ---- la semana -------------------------------------------------------
  // A13 (decision de Juanma, 15-sep-2026): semanas CONSECUTIVAS, de la primera a
  // la ultima con venta. Una semana corta (bajo Q1,000) o sin venta (un cierre por
  // vacaciones) queda en la lista y entra a la movil de 4 con su compra. Antes se
  // descartaba: su COGS no entraba en ninguna semana y la movil saltaba por encima
  // como si las semanas de al lado fueran seguidas.
  var S = [];
  var conVenta = Object.keys(sem).map(Number)
    .filter(function (k) { return sem[k].v > 0; }).sort(function (a, b) { return a - b; });
  if (conVenta.length) {
    var ordSaldo = {}, iSaldo = { bi: 0, bac: 0 }, prevSaldo = { bi: 0, bac: 0 };
    ['bi', 'bac'].forEach(function (b) {
      ordSaldo[b] = Object.keys(saldosUlt[b]).map(Number).sort(function (a, c) { return a - c; });
    });
    var ultClave = conVenta[conVenta.length - 1];
    for (var lunes = _finLunesDeClave_(conVenta[0]); _finClaveSemana_(lunes) <= ultClave;
         lunes = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 7)) {
      var k = _finClaveSemana_(lunes);
      var d = sem[k] || { v: 0, v_ss: 0, com: 0, tickets: 0, cogs: 0,
                          area: { cocina: 0, barra: 0 }, bloques: {},
                          ini: null, fin: null };
      var ini = d.ini || lunes;
      var fin = d.fin || new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
      ['bi', 'bac'].forEach(function (b) {      // el ultimo saldo hasta esta semana
        while (iSaldo[b] < ordSaldo[b].length && ordSaldo[b][iSaldo[b]] <= k) {
          prevSaldo[b] = saldosUlt[b][ordSaldo[b][iSaldo[b]]];
          iSaldo[b]++;
        }
      });
      // regla 11: sin planilla del mes, la ultima cargada (antes: 29000 fijo)
      var lab = _finUltimoDevengado_(planilla.valores, ini.getMonth() + 1).valor / FIN_SEMANAS_MES;
      S.push({ w: k % 100, clave: k, ini: _finDDMM_(ini), fin: _finDDMM_(fin),
               ventas: _finR_(d.v), ventas_ss: _finR_(d.v_ss), com: d.com, tickets: d.tickets,
               tp: d.com ? _finR_(d.v / d.com) : 0,
               cogs: _finR_(d.cogs), cogsp: d.v_ss ? _finR_(d.cogs / d.v_ss * 100, 1) : null,
               cocina: _finR_((d.area || {}).cocina || 0),
               barra: _finR_((d.area || {}).barra || 0),
               bloques: _finRedondear_(d.bloques || {}),
               labor: _finR_(lab), laborp: d.v ? _finR_(lab / d.v * 100, 1) : null,
               prime: d.v ? _finR_((d.cogs + lab) / d.v * 100, 1) : null,
               caja: _finR_(prevSaldo.bi + prevSaldo.bac),
               corta: d.v < 1000 });
    }
  }
  // regla 7: media movil de 4 = cociente de las sumas, NO promedio de porcentajes
  for (var i = 3; i < S.length; i++) {
    var vv = 0, vs = 0, cc = 0, ll = 0;
    for (var j = i - 3; j <= i; j++) { vv += S[j].ventas; vs += S[j].ventas_ss; cc += S[j].cogs; ll += S[j].labor; }
    S[i].cogs_m4 = vs ? _finR_(cc / vs * 100, 1) : null;   // regla 14: sin servicio; el prime no
    S[i].prime_m4 = vv ? _finR_((cc + ll) / vv * 100, 1) : null;
  }
  for (var k = 1; k < S.length; k++) {
    var p = S[k - 1];
    S[k].dv = p.ventas ? _finR_((S[k].ventas - p.ventas) / p.ventas * 100, 1) : 0;
    S[k].dc = S[k].com - p.com;
    S[k].dtp = _finR_(S[k].tp - p.tp);
  }

  // ---- integridad del dato --------------------------------------------
  var u = S[S.length - 1] || {};
  var gastoMes = meses.length ? (anioTot.cogs + anioTot.gop) / meses.length : 0;
  var gastoDia = _finR_(gastoMes / 30);
  var ult = {};
  Object.keys(ultCarga).forEach(function (h) { ult[h] = _finFecha_(ultCarga[h]); });
  if (ultVenta) ult['02_Ventas_Maestro'] = _finFecha_(ultVenta);

  return {
    anio: anio,
    total: anioTot,
    meses: meses,
    bloques: bloques,
    semanas: S,
    ultima: u,
    meta_cogs: metaFood,
    meta_area: _finMetaArea_(),
    // El presupuesto de gasto por seccion del DRE (pestana PRESUPUESTO del
    // Sheet de config). Puede no existir: devuelve {existe:false} y la pantalla
    // cae a la referencia del sector diciendo que lo hace.
    presupuesto: _finPresupuesto_(),
    usd: usd,
    mix: FIN_MIX,
    compra: compra,
    caja: u.caja || 0,
    gasto_dia: gastoDia,
    dias_caja: gastoDia ? _finR_((u.caja || 0) / gastoDia, 1) : 0,
    integridad: {
      por_clasificar: porClasificar,
      factura_pct: (felCompra + efeCompra) ? _finR_(felCompra / (felCompra + efeCompra) * 100, 1) : 0,
      fel: _finR_(felCompra), efectivo: _finR_(efeCompra),
      sin_mapear: _finR_(sinMapear),
      sin_identificar: _finR_(sinIdentificar),
      ult: ult,
      dias_atraso: ultVenta ? Math.floor((new Date() - ultVenta) / 86400000) : 999,
      // De donde salio la planilla de cada mes. Un mes en "respaldo" es un
      // numero congelado en el codigo: tiene que verse, no esconderse.
      planilla: planilla.origen,
      planilla_error: planilla.error,
      cobertura: _finRedondear_(cob),
      fugas: _finFugas_(cob),
      desconocidas: _finRedondear_(desconocidas),
      // regla 9: lo saltado de cada proveedor contra su factura del año
      pago_factura: _finPagoFacturaResumen_(pagoSaltado, felNit),
      // M20: meses con gasto y sin venta. No se pintan, pero su dinero esta en el año.
      meses_sin_venta: sinVenta.map(function (x) {
        return { m: x.m, mes: x.mes, cogs: _finR_(x.cogs), gop: _finR_(x.gop) };
      }),
      // regla 13: facturas anuladas en SAT que quedaron fuera del calculo
      anuladas: { n: anuladasN, q: _finR_(anuladasQ) },
      factura_manda: { n: facturaMandaN, q: _finR_(facturaMandaQ) }   // regla 15
    },
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm')
  };
}


// ============================================================================
// METAS Y RITMO
//
// Panel de resultados: donde vamos contra el objetivo del mes y cuanto hay que
// vender esta semana para llegar. Es la pantalla que mira el equipo.
//
// La meta vive en la pestana METAS del Sheet de config, no en el codigo, para
// que se pueda cambiar sin tocar un archivo. Correr instalarMetas() una vez
// para crearla; despues esto solo lee.
//
// De donde sale la meta: el objetivo es +20% contra el mismo mes del año
// pasado. Mientras 2025 no este cargado en el maestro no hay contra que medir,
// asi que el numero se pone a mano y la columna ORIGEN dice de donde salio.
// Cuando 2025 entre, esta misma pestana se llena sola y la pantalla no cambia.
// ============================================================================

var FIN_HOJA_METAS = 'METAS';

// La hoja donde vive 2025, cargada por AppsScript_cargar_ventas_2025.gs en el
// proyecto del maestro. Va aparte de 02_Ventas_Maestro a proposito: hay
// formulas en el maestro que suman la hoja de ventas sin filtrar por año.
var FIN_HOJA_2025 = '02b_Ventas_2025';
var FIN_CRECIMIENTO = 1.20;   // el objetivo: +20% contra el mismo mes del año pasado
var FIN_PISO_MESES = 3;       // el piso: promedio de los ultimos N meses cerrados
var FIN_METAS_COLS = ['ANIO', 'MES', 'META_VENTA', 'META_FOOD_PCT', 'ORIGEN'];

/** Una vez. Crea la pestana METAS con los meses que faltan del año. */
function instalarMetas() {
  soloDueno_();
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(FIN_HOJA_METAS);
  if (hoja) return 'La pestana METAS ya existe. No se toco nada.';

  hoja = ss.insertSheet(FIN_HOJA_METAS);
  hoja.getRange(1, 1, 1, FIN_METAS_COLS.length).setValues([FIN_METAS_COLS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  var anio = new Date().getFullYear();
  var filas = [];
  for (var m = new Date().getMonth() + 1; m <= 12; m++) {
    filas.push([anio, m, 154500, _finMetaFood_(),
                'PROVISIONAL: promedio de los ultimos 3 meses +20%. Cambiar cuando entre 2025.']);
  }
  if (filas.length) hoja.getRange(2, 1, filas.length, FIN_METAS_COLS.length).setValues(filas);
  hoja.setColumnWidth(5, 460);
  return 'Pestana METAS creada con ' + filas.length + ' meses. Edita META_VENTA ahi.';
}

function _finMeta_(anio, m) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(FIN_HOJA_METAS);
  if (!hoja) return null;
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (Number(filas[i][0]) === anio && Number(filas[i][1]) === m) {
      var venta = _finNum_(filas[i][2]);
      if (!venta) return null;
      // META_FOOD_PCT de esta pestana se IGNORA desde el 14-sep-2026: era una copia de
      // la meta congelada por instalarMetas(), y cambiar PARAMETROS no la movia. La
      // tarjeta de Metas decia un numero y el semaforo de la semana otro.
      return { venta: venta, food: _finMetaFood_(),
               origen: String(filas[i][4] || '').trim(),
               provisional: String(filas[i][4] || '').toUpperCase().indexOf('PROVISIONAL') === 0 };
    }
  }
  return null;
}

/**
 * Venta neta y tickets de cada mes de un AÑO, para el comparativo y la meta de Metas.
 *
 * M15 (tanda 4, 15-sep-2026): el año ya no va escrito a mano. Hasta esta fecha el
 * comparativo decia "2026 contra 2025" fijo, y el 1 de enero habria comparado 2027
 * vacio contra 2025. Cada año se compara contra el anterior:
 *   2025 y antes      la hoja 02b_Ventas_2025 (columnas 13 Venta_Neta y 14 Mes).
 *   2026 en adelante  02_Ventas_Maestro, que sigue acumulando años (decision de Juanma),
 *                     con las mismas reglas que _finCalcular_: Subtotal / 1.12, sin
 *                     eventos y con el dia verdadero de la regla 10.
 * De 2025 el POS no exporta comensales, solo tickets. Por eso la comparacion se hace
 * TICKET contra TICKET: es lo unico que existe en los dos años.
 */
function _finVentasAnio_(anio) {
  var out = {};
  try {
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
    if (anio <= 2025) {
      var h25 = ss.getSheetByName(FIN_HOJA_2025);
      if (!h25 || h25.getLastRow() < 2) return null;
      var f25 = h25.getDataRange().getValues();
      for (var r = 1; r < f25.length; r++) {
        var m = Number(f25[r][13]);
        if (!m || m < 1 || m > 12) continue;
        if (!out[m]) out[m] = { ventas: 0, tickets: 0 };
        out[m].ventas += _finNum_(f25[r][12]);
        out[m].tickets += 1;
      }
    } else {
      var V = ss.getSheetByName('02_Ventas_Maestro').getDataRange().getValues();
      for (var i = FIN_PRIMERA_FILA - 1; i < V.length; i++) {
        var f = _finDia_(V[i][1]);                                  // regla 10
        if (!_finEsFecha_(f) || f.getFullYear() !== anio) continue;
        if ((String(V[i][7] || '') + String(V[i][11] || '')).toUpperCase().indexOf('EVENTO') !== -1) continue;
        var mm = f.getMonth() + 1;
        if (!out[mm]) out[mm] = { ventas: 0, tickets: 0 };
        out[mm].ventas += _finNum_(V[i][3]) / 1.12;                 // regla 1
        out[mm].tickets += 1;
      }
    }
  } catch (e) { return null; }
  if (!Object.keys(out).length) return null;
  Object.keys(out).forEach(function (k) { out[k].ventas = _finR_(out[k].ventas); });
  return out;
}

/** Los doce meses de 2025. Se queda porque la estacionalidad de la Caja lo usa. */
function _finAnio2025_() { return _finVentasAnio_(2025); }

/** Venta y tickets del mismo mes del año anterior. null si no hay dato. */
function _finBaseAnterior_(anio, m) {
  var v = _finVentasAnio_(anio - 1);
  return (v && v[m]) ? v[m] : null;
}

/**
 * El ritmo del mes en curso. Se apoya en _finDatos_() para no volver a
 * leer el maestro entero.
 *
 * Los dias son dias de calendario, no dias de operacion: si el restaurante
 * cierra un dia fijo a la semana, el ritmo esperado queda un poco optimista a
 * mitad de semana y se empareja al cierre.
 */
function getMetasData(auth, forzar) {
  exigirModulo_(auth, 'finanzas');
  var d = _finDatos_(forzar);
  // El mes en curso del calendario, NO el ultimo mes con ventas. Si se toma el
  // ultimo con ventas, el dia 4 de septiembre el panel muestra agosto, que ya
  // cerro, y dice que no falta nada.
  var hoy = new Date();
  var anio = hoy.getFullYear(), m = hoy.getMonth() + 1;
  var mesActual = null;
  d.meses.forEach(function (x) { if (x.m === m) mesActual = x; });

  var meta = _finMeta_(anio, m);
  var base = _finBaseAnterior_(anio, m);   // M15: el año anterior, no 2025 fijo

  // El piso: promedio de los ultimos meses cerrados de este año.
  //
  // Existe porque el negocio crecio ~65% contra 2025, y para varios meses el
  // +20% del año pasado queda POR DEBAJO de lo que ya se hace de rutina. El
  // caso extremo es septiembre: 2025 cerro en Q24,105 y el +20% daria Q28,926,
  // cuando agosto de 2026 hizo Q137,739. Una meta asi se cumple la primera
  // semana y le enseña al equipo a ignorarla.
  var cerrados = [], sumaPiso = 0;
  d.meses.forEach(function (x) { if (x.m < m) cerrados.push(x); });
  cerrados = cerrados.slice(-FIN_PISO_MESES);
  cerrados.forEach(function (x) { sumaPiso += x.ventas; });
  var piso = cerrados.length ? _finR_(sumaPiso / cerrados.length) : 0;
  var porAnioPasado = base ? _finR_(base.ventas * FIN_CRECIMIENTO) : 0;

  // Una meta escrita a mano en METAS le gana a las dos, salvo que su ORIGEN
  // diga PROVISIONAL: eso marca un tapa-agujeros de cuando no habia con que medir.
  if ((base || piso) && (!meta || meta.provisional)) {
    var mandaPiso = piso > porAnioPasado;
    var texto;
    if (mandaPiso && porAnioPasado) {
      texto = 'Promedio de los ultimos ' + cerrados.length + ' meses (Q' +
              piso.toLocaleString('es-GT') + '). Manda el piso porque el +' +
              Math.round((FIN_CRECIMIENTO - 1) * 100) + '% sobre ' + FIN_MESES[m - 1] +
              ' ' + (anio - 1) + ' daria solo Q' + porAnioPasado.toLocaleString('es-GT') + '.';
    } else if (mandaPiso) {
      texto = 'Promedio de los ultimos ' + cerrados.length + ' meses cerrados. ' +
              'De ' + FIN_MESES[m - 1] + ' ' + (anio - 1) + ' no hay dato con que comparar.';
    } else {
      texto = '+' + Math.round((FIN_CRECIMIENTO - 1) * 100) + '% sobre ' + FIN_MESES[m - 1] +
              ' ' + (anio - 1) + ', que cerro en Q' + base.ventas.toLocaleString('es-GT') + '.';
    }
    meta = { venta: Math.max(porAnioPasado, piso), food: (meta && meta.food) || _finMetaFood_(),
             origen: texto, provisional: false, automatica: true, manda_piso: mandaPiso };
  }

  var diasMes = new Date(anio, m, 0).getDate();

  // El corte va hasta donde llega el dato CARGADO, no hasta hoy: si la carga
  // viene atrasada, medir contra hoy haria ver el mes peor de lo que esta.
  var ultima = d.integridad.ult['02_Ventas_Maestro'] || '';
  var partes = ultima.split('/');
  var diaCorte = (partes.length === 3 && Number(partes[1]) === m && Number(partes[2]) === anio)
    ? Number(partes[0]) : 0;

  var acumulado = mesActual ? mesActual.ventas : 0;
  // dia 0 = no hay nada cargado de este mes; el ritmo esperado arranca en cero
  // en vez de fingir que vamos al dia.

  // ---- desglose semanal del mes
  //
  // Las semanas ISO no caen enteras dentro del mes: la primera y la ultima
  // casi siempre estan partidas. Repartir la meta en partes iguales le carga
  // a una semana de 3 dias la misma cuota que a una de 7, y esa semana
  // aparece incumplida de nacimiento. Se reparte por dias reales.
  var porSem = (mesActual && mesActual.porSemana) || {};
  var semanas = [], idx = {};
  for (var dia = 1; dia <= diasMes; dia++) {
    var f = new Date(anio, m - 1, dia);
    var w = _finSemanaISO_(f);
    if (idx[w] === undefined) {
      idx[w] = semanas.length;
      semanas.push({ w: w, dia_ini: dia, dia_fin: dia, dias: 0,
                     dias_corridos: 0, ventas: 0, com: 0 });
    }
    var S = semanas[idx[w]];
    S.dia_fin = dia;
    S.dias++;
    if (dia <= diaCorte) S.dias_corridos++;
  }
  semanas.forEach(function (S) {
    var v = porSem[S.w] || { v: 0, com: 0 };
    S.ventas = _finR_(v.v);
    S.com = v.com;
    S.ini = S.dia_ini + '/' + m;
    S.fin = S.dia_fin + '/' + m;
    S.cerrada = S.dias_corridos >= S.dias;
    S.en_curso = S.dias_corridos > 0 && !S.cerrada;
    S.futura = S.dias_corridos === 0;
  });

  var out = {
    anio: anio, m: m, mes: FIN_MESES[m - 1],
    sin_datos_del_mes: !diaCorte,
    meta: meta,
    dias: { total: diasMes, corridos: diaCorte, restantes: Math.max(diasMes - diaCorte, 0) },
    acumulado: _finR_(acumulado),
    comensales: mesActual ? mesActual.com : 0,
    semanas: semanas,
    ultima_carga: ultima,
    meta_food: (meta && meta.food) || _finMetaFood_(),
    base_2025: base,          // nombre viejo: es el mismo mes del año ANTERIOR
    base_anterior: base, anio_ant: anio - 1,
    piso: piso,
    por_anio_pasado: porAnioPasado,
    gen: d.gen
  };

  if (!meta) {
    out.sin_meta = true;
    return out;
  }

  var esperado = meta.venta * diaCorte / diasMes;
  var falta = Math.max(meta.venta - acumulado, 0);
  var restantes = out.dias.restantes;

  out.esperado = _finR_(esperado);
  out.brecha = _finR_(acumulado - esperado);
  out.avance = _finR_(acumulado / meta.venta * 100, 1);
  out.falta = _finR_(falta);
  out.necesario_dia = restantes ? _finR_(falta / restantes) : 0;
  out.necesario_semana = restantes ? _finR_(falta / restantes * Math.min(7, restantes)) : 0;
  out.proyeccion = diaCorte ? _finR_(acumulado / diaCorte * diasMes) : 0;
  out.proyeccion_pct = _finR_(out.proyeccion / meta.venta * 100, 1);

  // La meta de cada semana, proporcional a sus dias dentro del mes, y el
  // acumulado corrido para poder leer la pestaña de arriba hacia abajo.
  var acMeta = 0, acVenta = 0;
  semanas.forEach(function (S) {
    S.meta = _finR_(meta.venta * S.dias / diasMes);
    acMeta += S.meta;
    acVenta += S.ventas;
    S.meta_acum = _finR_(acMeta);
    S.acum = _finR_(acVenta);
    // Una semana en curso se juzga contra los dias que lleva, no contra los 7.
    S.meta_hoy = _finR_(meta.venta * S.dias_corridos / diasMes);
    S.dif = S.futura ? null : _finR_(S.ventas - S.meta_hoy);
    S.cumple = S.futura ? null : _finR_(S.ventas / (S.meta_hoy || 1) * 100, 1);
    S.falta = S.futura ? S.meta : _finR_(Math.max(S.meta - S.ventas, 0));
  });

  // El techo de compra de la semana: lo que se puede comprar sin romper la meta
  // de food cost sobre la venta que hay que hacer. Es un techo de compra, no un
  // costo teorico: medimos base compra contra una meta base receta.
  // Regla 14: la meta de food cost es sobre venta sin servicio y la venta que hay que
  // hacer (meta.venta) va con servicio. El techo se mide sobre su parte sin servicio,
  // con la proporcion del año (Juanma, 15-sep-2026: baja el techo cerca de 9%).
  var sinServ = (d.total && d.total.ventas && d.total.ventas_ss) ? d.total.ventas_ss / d.total.ventas : 1;
  out.factor_sin_servicio = _finR_(sinServ, 4);
  out.compra_tope = _finR_(out.necesario_semana * sinServ * out.meta_food / 100);

  // ---- el techo, partido por area y por familia
  //
  // Un solo numero del restaurante no lo puede usar nadie: no es de nadie.
  // Partido por area, Jeffry tiene el suyo y Jose el suyo.
  //
  // Y va en DOS tiempos a proposito. El semanal es guia de que llevar al
  // mercado; el que controla es el ACUMULADO DEL MES, porque la compra va a
  // saltos y el consumo es parejo: una caja de vino se paga una semana y se
  // toma en tres. Medir la compra de una semana suelta da falsas alarmas.
  var C = d.compra || { cocina: { total: 0, f: {}, mes: {} }, barra: { total: 0, f: {}, mes: {} } };
  out.techo = {};
  var metaArea = _finMetaArea_();
  ['cocina', 'barra'].forEach(function (a) {
    var A = C[a] || { total: 0, f: {}, mes: {} };
    var ventaSem = out.necesario_semana * sinServ * FIN_MIX[a] / 100;   // sin servicio
    var ventaMes = meta.venta * sinServ * FIN_MIX[a] / 100;
    var topeSem = _finR_(ventaSem * metaArea[a] / 100);
    var topeMes = _finR_(ventaMes * metaArea[a] / 100);
    var gastado = _finR_(A.mes[m] || 0);

    // El reparto por familia es el HISTORICO del año, no una regla: dice donde
    // suele irse el dinero de esa area, para saber que se puede llevar.
    var fams = [];
    FIN_FAM_AREA[a].forEach(function (k) {
      var v = A.f[k] || 0;
      if (!v) return;
      fams.push({ k: k, nombre: FIN_FAM_NOMBRE[k] || k, anio: _finR_(v),
                  pct: A.total ? _finR_(v / A.total * 100, 1) : 0,
                  semana: A.total ? _finR_(topeSem * v / A.total) : 0 });
    });

    out.techo[a] = {
      area: a, mix: FIN_MIX[a], meta: metaArea[a],
      venta_semana: _finR_(ventaSem), venta_mes: _finR_(ventaMes),
      semana: topeSem, mes: topeMes,
      gastado_mes: gastado, saldo_mes: _finR_(topeMes - gastado),
      consumo_pct: ventaMes ? _finR_(gastado / ventaMes * 100, 1) : null,
      familias: fams,
      // Cuanta de la compra del area no tiene familia todavia. Sin esto, un
      // reparto a medio clasificar se leeria como si estuviera completo.
      sin_clasificar: A.total ? _finR_((A.f.REVISAR || 0) / A.total * 100, 1) : 0
    };
  });

  return out;
}

/**
 * ============================================================================
 * COMPARATIVO: el año del calculo contra el anterior, mes a mes (M15, 15-sep-2026).
 * ============================================================================
 *
 * Notas de meses en los que la comparacion NO se puede leer como crecimiento.
 * Sin esto, septiembre sale con +471% y parece una hazaña: lo que pasa es que
 * en 2025 el restaurante estuvo cerrado por vacaciones casi todo el mes.
 */
var FIN_NOTAS_2025 = {
  9: 'En 2025 el restaurante estuvo de vacaciones casi todo septiembre: cerró con ' +
     '52 tickets. La variación de este mes no mide crecimiento.'
};
// Las notas van por el año ANTERIOR de la comparacion. FIN_NOTAS_2025 se queda con su
// nombre porque la estacionalidad de la Caja lo lee.
var FIN_NOTAS_POR_ANIO = { 2025: FIN_NOTAS_2025 };

function getComparativoData(auth, forzar) {
  exigirModulo_(auth, 'finanzas');
  var d = _finDatos_(forzar);
  if (d.error) return { error: d.error };
  return _finComparativo_(d, new Date());
}

/**
 * Separado de la puerta para que la bateria lo pruebe con otra fecha. Las claves v25,
 * v26, t25, tp25... quedan por compatibilidad: 25 es el año ANTERIOR y 26 el del
 * calculo, cualquiera sea. La pantalla rotula con anio_ant y anio.
 */
function _finComparativo_(d, hoy) {
  var anio = d.anio, anioAnt = anio - 1;
  var ant = _finVentasAnio_(anioAnt);
  if (!ant) return { error: 'No hay ventas de ' + anioAnt + ' en el maestro' +
                           (anioAnt <= 2025 ? ' (' + FIN_HOJA_2025 + ')' : '') + '.' };
  var notas = FIN_NOTAS_POR_ANIO[anioAnt] || {};

  var act = {};
  d.meses.forEach(function (x) { act[x.m] = x; });

  var mesEnCurso = hoy.getFullYear() === anio ? hoy.getMonth() + 1 : 0;

  var filas = [], tA = 0, tB = 0, tkA = 0, tkB = 0;
  for (var m = 1; m <= 12; m++) {
    var a = ant[m] || null;
    var b = act[m] || null;
    var f = {
      m: m, mes: FIN_MESES[m - 1],
      v25: a ? a.ventas : null, t25: a ? a.tickets : null,
      v26: b ? _finR_(b.ventas) : null, t26: b ? b.tickets : null,
      // El mes en curso todavia no esta completo: compararlo contra el mes
      // ENTERO del año pasado da una caida que no existe.
      parcial: m === mesEnCurso,
      nota: notas[m] || ''
    };
    f.tp25 = (a && a.tickets) ? _finR_(a.ventas / a.tickets, 2) : null;
    f.tp26 = (b && b.tickets) ? _finR_(b.ventas / b.tickets, 2) : null;
    if (f.v25 !== null && f.v26 !== null) {
      f.dif = _finR_(f.v26 - f.v25);
      f.pct = f.v25 ? _finR_((f.v26 / f.v25 - 1) * 100, 1) : null;
      f.dif_tk = f.t26 - f.t25;
      // El total del año solo suma meses COMPLETOS de los dos años. Meter el
      // mes en curso inflaria la comparacion a favor de 2025.
      if (!f.parcial) { tA += f.v25; tB += f.v26; tkA += f.t25; tkB += f.t26; }
    }
    filas.push(f);
  }

  return {
    anio: anio, anio_ant: anioAnt,
    filas: filas,
    mes_en_curso: mesEnCurso,
    // maximo para escalar las barras de las dos series con la misma regla
    tope: filas.reduce(function (mx, f) {
      return Math.max(mx, f.v25 || 0, f.v26 || 0);
    }, 0),
    total: {
      v25: _finR_(tA), v26: _finR_(tB), dif: _finR_(tB - tA),
      pct: tA ? _finR_((tB / tA - 1) * 100, 1) : null,
      t25: tkA, t26: tkB,
      tp25: tkA ? _finR_(tA / tkA, 2) : null,
      tp26: tkB ? _finR_(tB / tkB, 2) : null,
      meses: filas.filter(function (f) {
        return f.v25 !== null && f.v26 !== null && !f.parcial;
      }).length
    },
    gen: d.gen
  };
}

/**
 * Familia de producto de cada proveedor, leida de 00_Proveedores.
 *
 * La columna la prellena el script familias_proveedores.js del maestro y la
 * corrigen Jeffry y Jose. Si la columna todavia no existe, esto devuelve un
 * mapa vacio y el panel muestra todo como REVISAR: se degrada, no se rompe.
 */
function _finFamilias_() {
  var out = {};
  var hoja;
  try {
    hoja = SpreadsheetApp.openById(FIN_MAESTRO_ID).getSheetByName('00_Proveedores');
  } catch (e) { return out; }
  if (!hoja || hoja.getLastRow() < 5) return out;

  var filas = hoja.getDataRange().getValues();
  var cab = filas[3] || [];                    // fila 4 = encabezados
  var col = -1;
  for (var i = 0; i < cab.length; i++) {
    if (String(cab[i]).trim().toLowerCase() === 'familia') { col = i; break; }
  }
  if (col < 0) return out;

  for (var r = 4; r < filas.length; r++) {
    var nom = String(filas[r][0] || '').trim();
    var f = String(filas[r][col] || '').trim().toUpperCase();
    if (nom && f) out[_finLlaveProv_(nom)] = f;
  }
  return out;
}

/**
 * Donde termina una fila con esta categoria. Espeja la logica de _finCalcular.
 * Solo se usa para el panel de cobertura: no mueve ningun numero del DRE.
 */
function _finDestino_(cat, hoja, esPersonal, pagoDe, tieneFactura) {
  if (cat === 'ANULADA') return 'anulada en SAT';
  if (esPersonal || cat === 'PERSONAL') return 'personal';
  if (cat === 'DEVOLUCION_INVERSION') return 'devolucion';
  if (!cat) return 'SIN CATEGORIA';
  if (cat.indexOf('INGRESO') === 0) return 'ingreso';
  if (cat === 'POR_CLASIFICAR') return 'POR CLASIFICAR';
  if (_finEn_(FIN_FUERA, cat)) return 'fuera (a proposito)';
  if (_finEn_(FIN_COGS_CATS, cat)) {
    return _finEn_(FIN_BANCOS, hoja) ? 'REGLA 3: no suma' : 'COGS';
  }
  if (_finEn_(FIN_EFECTIVO, cat)) return 'COGS';
  if ((cat === 'ALQUILERES' || cat === 'ALQUILER') && hoja === '01_FEL_Maestro') {
    return 'alquiler por banco: no suma';
  }
  if (_finEn_(FIN_SOLO_FEL, cat) && hoja !== '01_FEL_Maestro') return 'REGLA 8: ya vino por FEL';
  if (pagoDe) return 'REGLA 9: pago de factura FEL';
  if (tieneFactura && FIN_MAP[cat]) return 'REGLA 15: tiene factura FEL';
  if (FIN_MAP[cat]) return 'DRE \u00b7 ' + FIN_MAP[cat][0];
  return 'CATEGORIA DESCONOCIDA';
}

/**
 * Fuga = dinero que no llega al DRE y que NADIE decidio que se quedara fuera.
 * La regla 3 y el alquiler por banco si son decisiones y van aparte.
 */
var FIN_PERDIDO = ['CATEGORIA DESCONOCIDA', 'SIN CATEGORIA', 'POR CLASIFICAR'];

function _finFugas_(cob) {
  var out = {};
  Object.keys(cob).forEach(function (h) {
    var suma = 0;
    Object.keys(cob[h]).forEach(function (k) {
      if (_finEn_(FIN_PERDIDO, k)) suma += cob[h][k];
    });
    out[h] = _finR_(suma);
  });
  return out;
}

/** Redondea a dos decimales un mapa plano o un mapa de mapas. */
function _finRedondear_(obj) {
  var out = {};
  Object.keys(obj).forEach(function (k) {
    var v = obj[k];
    if (v && typeof v === 'object') {
      out[k] = {};
      Object.keys(v).forEach(function (k2) { out[k][k2] = _finR_(v[k2]); });
    } else {
      out[k] = _finR_(v);
    }
  });
  return out;
}

function _finLlaveProv_(s) {
  return String(s === null || s === undefined ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Las familias de cada area, en el orden en que se quieren leer. */
var FIN_FAM_AREA = {
  cocina: ['CARNE', 'AVES', 'PESCADO', 'VERDURA', 'LACTEOS', 'PANADERIA',
           'ABARROTES', 'ESPECIAS_ACEITES', 'DELI_IMPORTADO', 'SUPERMERCADO',
           'SIN_FACTURA', 'REVISAR'],
  barra:  ['VINO', 'CERVEZA', 'LICOR', 'MIXOLOGIA', 'HIELO_AGUA', 'SIN_FACTURA', 'REVISAR']
};

var FIN_FAM_NOMBRE = {
  CARNE: 'Carne', AVES: 'Pollo y aves', PESCADO: 'Pescado y mariscos',
  VERDURA: 'Frutas y verduras', LACTEOS: 'Lácteos y huevo', PANADERIA: 'Panadería',
  ABARROTES: 'Abarrotes',
  ESPECIAS_ACEITES: 'Especias y aceites', DELI_IMPORTADO: 'Deli e importado',
  SUPERMERCADO: 'Supermercado', VINO: 'Vino', CERVEZA: 'Cerveza', LICOR: 'Licor',
  MIXOLOGIA: 'Mixología', HIELO_AGUA: 'Hielo y agua',
  SIN_FACTURA: 'Compra sin factura', REVISAR: 'Sin familia asignada'
};
