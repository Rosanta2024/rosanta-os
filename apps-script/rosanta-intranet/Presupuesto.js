/**
 * PRESUPUESTO DE GASTO POR SECCION DEL DRE
 * =======================================
 *
 * Nacio el 22-sep-2026, pedido por Juanma. Hasta entonces el sistema NO tenia
 * ningun presupuesto de gasto: lo unico mensual que existia era la meta de
 * VENTA (pestana METAS) y el techo de compra que se deriva de ella. "El gasto"
 * comparaba cada seccion contra el tope de la banda del sector aplicado a la
 * meta de venta, que es un benchmark ajeno, no una decision de la casa.
 *
 * Vive en una pestana del Sheet de configuracion, no en el codigo: el
 * presupuesto lo decide Juanma y tiene que poder cambiarlo sin publicar.
 *
 * FORMA DE LA HOJA
 *   Seccion | Mensual | Ene | Feb | ... | Dic
 *
 * - "Mensual" es el presupuesto por defecto de esa seccion, todos los meses.
 * - Las doce columnas de mes son OPCIONALES y pisan al mensual cuando tienen
 *   algo. Sirven para la estacionalidad: el marketing de noviembre no tiene por
 *   que ser el de febrero.
 * - Una celda vacia NO es un cero: significa "sin presupuesto", y la pantalla
 *   cae de vuelta a la referencia del sector diciendo que lo hace. Un cero
 *   escrito a mano SI es un presupuesto de cero.
 *
 * Para instalarla: abrir el editor de Apps Script y correr instalarPresupuesto()
 * una vez. Crea la pestana con las 11 partidas (ver _presuPartidas_) y las columnas vacias.
 */

var PRESU_HOJA = 'PRESUPUESTO';
var PRESU_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                   'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
var PRESU_COLS = ['Seccion', 'Tipo', 'Valor'].concat(PRESU_MESES);

/**
 * LOS TRES TIPOS DE GASTO (22-sep-2026, despues de que Juanma reviso la carga)
 *
 * La primera version de esta hoja tenia UNA sola forma —monto mensual— para
 * tres cosas distintas, y por eso varios rubros quedaron mal cuantificados:
 *
 *   fijo    Vale lo mismo todos los meses. "Valor" es el monto mensual.
 *           Alquiler, telefonos, honorarios.
 *
 *   %venta  Se mueve con la venta, exactamente. "Valor" es un PORCENTAJE y el
 *           presupuesto del mes se calcula sobre la venta de ese mes. Las
 *           propinas son el 10% de servicio: fijarlas en un monto es incorrecto
 *           por construccion, porque suben y bajan con lo que se vendio.
 *
 *   anual   Se compra de vez en cuando. "Valor" es el presupuesto del AÑO y se
 *           compara contra el ACUMULADO del año, no contra el mes. Uniformes se
 *           compra cada cinco meses: con un mensual de Q300 se veria "Q0 de
 *           Q300" once veces y "Q3,000 de Q300" una, y ninguna de las doce
 *           lecturas serviria para nada.
 *
 * Las doce columnas de mes pisan al "Valor" en fijo y en %venta. En anual no
 * aplican: un presupuesto anual no tiene version de mes.
 */
var PRESU_TIPOS = ['fijo', '%venta', 'anual'];

/**
 * LAS FILAS DE LA HOJA SON PARTIDAS DE LOS 9 BLOQUES DEL DRE (28-sep-2026).
 * La hoja se quedo con sus 11 filas de siempre: al pasar el motor al formato del DRE
 * varias caen en el mismo bloque (Nomina lleva la planilla, las propinas y los
 * uniformes) y cada una conserva su tipo. Asi Juanma no tuvo que rehacer la hoja.
 * Tambien se acepta una fila con el nombre del bloque tal cual.
 */
// Funcion y no constante: los archivos .js se cargan en un orden que no se controla
// y FIN_B vive en FinanzasDatos.js. Una constante de nivel superior podria leerlo
// antes de que exista.
function _presuPartidas_() {
  return {
    'Inmueble y ocupacion': FIN_B.OCU, 'Tarifas y servicios': FIN_B.TAR,
    'Prestadores y honorarios': FIN_B.EXT, 'Nomina y salarios': FIN_B.NOM,
    'Propinas al equipo': FIN_B.NOM, 'Uniformes': FIN_B.NOM, 'Impuestos': FIN_B.IMP,
    'Marketing': FIN_B.MKT, 'Mantencion': FIN_B.MAN, 'Comisiones y cargos': FIN_B.FIN,
    'Bienes de uso': FIN_B.BIE
  };
}
function _finPresuBloque_(nombre) {
  return _presuPartidas_()[nombre] || (FIN_REF.hasOwnProperty(nombre) ? nombre : null);
}

/**
 * Crea la pestana. Herramienta de editor: soloDueno_ la cierra a Juanma.
 *
 * Sin esa guarda seria una funcion global sin guion bajo y cualquiera podria
 * llamarla con google.script.run desde cualquier pagina del despliegue, que es
 * el agujero que encontro la auditoria del 14-sep-2026.
 */
function instalarPresupuesto() {
  soloDueno_();
  return instalarPresupuesto_();
}

function instalarPresupuesto_() {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(PRESU_HOJA);
  if (hoja) {
    return 'La pestana ' + PRESU_HOJA + ' ya existe con ' +
           Math.max(hoja.getLastRow() - 1, 0) + ' filas. No se toco nada.';
  }
  hoja = ss.insertSheet(PRESU_HOJA);
  hoja.getRange(1, 1, 1, PRESU_COLS.length).setValues([PRESU_COLS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(1, 220);

  // Las secciones salen de FIN_REF, que es la lista canonica de bloques del
  // DRE. Si manana nace un bloque nuevo, la prueba de la bateria avisa que le
  // falta su fila en vez de dejarlo sin presupuesto en silencio.
  var secciones = Object.keys(_presuPartidas_()).sort();
  var filas = secciones.map(function (s) {
    return [s].concat(new Array(PRESU_COLS.length - 1).fill(''));
  });
  hoja.getRange(2, 1, filas.length, PRESU_COLS.length).setValues(filas);
  // Dos decimales: la columna Valor lleva montos y tambien porcentajes.
  hoja.getRange(2, 3, filas.length, PRESU_COLS.length - 2).setNumberFormat('#,##0.##');
  hoja.setColumnWidth(2, 90);
  // El tipo se elige de una lista: escrito a mano, un "Fijo" con mayuscula o un
  // "% venta" con espacio entrarian como tipo desconocido.
  var reglas = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRESU_TIPOS, true).setAllowInvalid(false).build();
  hoja.getRange(2, 2, filas.length, 1).setDataValidation(reglas);

  return 'Pestana ' + PRESU_HOJA + ' creada con ' + filas.length + ' secciones. ' +
         'Llena la columna "Mensual" de las que quieras presupuestar; las de mes ' +
         'son opcionales y pisan al mensual.';
}

/**
 * Lee el presupuesto. Devuelve siempre un objeto utilizable, tambien cuando la
 * pestana no existe: { existe:false, secciones:{} }.
 *
 * Una seccion escrita en la hoja que no sea un bloque del DRE se guarda en
 * "desconocidas": no se puede aplicar a nada, y callarla dejaria a Juanma
 * creyendo que presupuesto algo que el calculo no mira.
 */
function _finPresupuesto_() {
  var out = { existe: false, secciones: {}, bloques: {}, desconocidas: [], sin_tipo: [], error: '' };
  var ss;
  try {
    ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  } catch (e) {
    out.error = 'No pude abrir el Sheet de configuracion: ' + String(e && e.message || e);
    return out;
  }
  var hoja = ss.getSheetByName(PRESU_HOJA);
  if (!hoja) return out;
  out.existe = true;

  var filas;
  try { filas = hoja.getDataRange().getValues(); } catch (e) { return out; }
  if (filas.length < 2) return out;

  var cab = filas[0].map(function (c) {
    return _finSinAcentos_(String(c || '')).toLowerCase().trim();
  });
  var cSec = cab.indexOf('seccion');
  var cTipo = cab.indexOf('tipo');
  // "valor" es el nombre nuevo; "mensual" era el de la primera version y se
  // sigue aceptando para no romper una hoja que no se haya migrado.
  var cVal = cab.indexOf('valor');
  if (cVal < 0) cVal = cab.indexOf('mensual');
  if (cSec < 0 || cVal < 0) return out;

  var cMes = {};
  PRESU_MESES.forEach(function (m, i) {
    var j = cab.indexOf(m.toLowerCase());
    if (j >= 0) cMes[i + 1] = j;
  });

  for (var r = 1; r < filas.length; r++) {
    var nombre = String(filas[r][cSec] || '').trim();
    if (!nombre) continue;
    if (!_finPresuBloque_(nombre)) { out.desconocidas.push(nombre); continue; }

    function celda(j) {
      if (j === undefined || j < 0) return null;
      var v = filas[r][j];
      if (v === '' || v === null || v === undefined) return null;
      var n = _finNum_(v);
      return isNaN(n) ? null : n;
    }

    var valor = celda(cVal);
    var meses = {};
    Object.keys(cMes).forEach(function (m) {
      var v = celda(cMes[m]);
      if (v !== null) meses[m] = v;
    });
    if (valor === null && !Object.keys(meses).length) continue;   // fila en blanco

    // Sin tipo no se puede saber si un 4.24 son quetzales o un porcentaje. Se
    // asume 'fijo', que es como se comportaba la hoja vieja, y se reporta:
    // adivinar en silencio es lo que produjo los numeros que Juanma rechazo.
    var tipo = cTipo >= 0
      ? _finSinAcentos_(String(filas[r][cTipo] || '')).toLowerCase().trim()
      : '';
    if (PRESU_TIPOS.indexOf(tipo) === -1) {
      out.sin_tipo.push(nombre + (tipo ? ' ("' + tipo + '")' : ''));
      tipo = 'fijo';
    }
    var bloque = _finPresuBloque_(nombre);
    out.secciones[nombre] = { tipo: tipo, valor: valor, meses: meses, bloque: bloque };
    (out.bloques[bloque] = out.bloques[bloque] || []).push(nombre);
  }
  return out;
}



/* migrarPresupuestoATipos y etiquetarExtrasPorArea (con sus tablas) ya corrieron en sep-2026:
   archivadas el 14-oct-2026 (auditoria, Fase 4) en apps-script/_archivo/2026-10-14_limpieza_auditoria/. */


/**
 * EL punto de equilibrio de Rosanta (decision de Juanma, 28-sep-2026: "que mande el
 * presupuesto"). Una sola formula para la semana (La semana, tablero) y para el mes
 * (Escenarios):
 *
 *   fijos     las secciones tipo "fijo" del PRESUPUESTO, con el monto del mes si lo trae,
 *             MAS las tipo "anual" divididas entre 12 (Juanma, 28-sep-2026: sin ellas faltaban
 *             ~Q20,000 al mes y el equilibrio daba enero a julio en verde con perdida)
 *   variables las secciones tipo "%venta" (comisiones, propinas) + la mercaderia REAL
 *             del periodo (compra / venta: la movil de 4 en la semana, el mes en el mes)
 *   margen    100 - variables
 *   PE        fijos / margen
 *
 * Antes Escenarios usaba el gasto fijo y variable del BANCO del mes: con el margen de
 * agosto (8.3%) daba Q677,000 al mes, y mezclaba nomina pagada con resultado devengado.
 * mercPct null o margen <= 0 -> pe_mes null. Sin pestaña PRESUPUESTO -> null.
 */
function _finEquilibrioPresu_(presu, mesN, mercPct) {
  if (!presu || !presu.existe || !presu.secciones) return null;
  var fijos = [], fijoMes = 0, pctVenta = [], pctTotal = 0;
  Object.keys(presu.secciones).forEach(function (k) {
    var x = presu.secciones[k];
    if (x.tipo === 'fijo') {
      var delMes = !!(x.meses && x.meses[mesN] !== undefined);
      var v = delMes ? x.meses[mesN] : x.valor;
      if (v) { fijos.push({ seccion: k, mensual: _finR_(v), del_mes: delMes }); fijoMes += v; }
    } else if (x.tipo === 'anual' && x.valor) {
      fijos.push({ seccion: k, mensual: _finR_(x.valor / 12), anual: true }); fijoMes += x.valor / 12;
    } else if (x.tipo === '%venta' && x.valor) {
      pctVenta.push({ seccion: k, pct: x.valor }); pctTotal += x.valor;
    }
  });
  var sinMerc = mercPct === null || mercPct === undefined || isNaN(mercPct);
  var mc = sinMerc ? null : 100 - mercPct - pctTotal;
  return { fijos: fijos, fijo_mes: _finR_(fijoMes), pct_venta: pctVenta, pct_total: pctTotal,
           merc_pct: sinMerc ? null : _finR_(mercPct, 1), mc: mc === null ? null : _finR_(mc, 1),
           pe_mes: (fijoMes && mc !== null && mc > 0) ? _finR_(fijoMes / (mc / 100)) : null };
}
