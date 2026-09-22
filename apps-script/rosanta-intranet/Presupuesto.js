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
 * una vez. Crea la pestana con las 11 secciones y las columnas vacias.
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
  var secciones = Object.keys(FIN_REF).sort();
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
  var out = { existe: false, secciones: {}, desconocidas: [], sin_tipo: [], error: '' };
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
    if (!FIN_REF.hasOwnProperty(nombre)) { out.desconocidas.push(nombre); continue; }

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
    out.secciones[nombre] = { tipo: tipo, valor: valor, meses: meses };
  }
  return out;
}

/**
 * El presupuesto de una seccion, resuelto segun su tipo.
 *
 *   fijo    devuelve el monto del mes (el del mes si existe, si no el Valor)
 *   %venta  devuelve ese porcentaje aplicado a ventaMes
 *   anual   devuelve el presupuesto del AÑO; se compara contra el acumulado
 *
 * Devuelve { monto, base } donde base dice contra que hay que compararlo:
 * 'mes' o 'anio'. Sin eso, la pantalla compararia un presupuesto anual contra
 * el gasto de un mes y todo se veria holgado.
 */
function _finPresuDe_(presu, seccion, mes, ventaMes) {
  var S = presu && presu.secciones && presu.secciones[seccion];
  if (!S) return null;

  if (S.tipo === 'anual') {
    if (S.valor === null) return null;
    return { monto: S.valor, base: 'anio', tipo: S.tipo };
  }

  var v = (S.meses && S.meses[mes] !== undefined) ? S.meses[mes] : S.valor;
  if (v === null || v === undefined) return null;

  if (S.tipo === '%venta') {
    if (!ventaMes) return null;          // sin venta no hay presupuesto que calcular
    return { monto: ventaMes * v / 100, base: 'mes', tipo: S.tipo, pct: v };
  }
  return { monto: v, base: 'mes', tipo: 'fijo' };
}


/**
 * LA PROPUESTA DEL 22-SEP-2026, SEGUNDA VERSION
 * ============================================
 *
 * La primera metio los once rubros en un monto mensual sacado de dividir el
 * total del año entre 9. Juanma la reviso y rechazo seis: Impuestos, Inmueble,
 * Mantencion, Propinas, Tarifas y Uniformes. Tenia razon en las seis, y en una
 * de ellas el promedio escondia un error de datos (ver el alquiler, abajo).
 *
 * Cada numero de aca dice de donde sale. Los que siguen siendo un promedio,
 * lo dicen.
 */
var PRESU_PROPUESTA = {
  // --- fijos: el mismo monto todos los meses ---------------------------------
  // El alquiler VIGENTE, leido de las 12 filas del maestro: Q21,560 hasta abril,
  // Q19,250 en mayo y Q20,212.50 de junio en adelante. El promedio del año daba
  // Q20,896 porque incluia la renta de DICIEMBRE DE 2025, pagada el 2 de enero:
  // el maestro es base caja y cayo en 2026. Son Q21,560 que no son del año.
  'Inmueble y ocupacion':     { tipo: 'fijo',   valor: 20212.50 },
  // Planilla fija mas extras al 1.8% de la venta, que es el mejor mes propio
  // (febrero), no el 4.2% de agosto. No toca la planta.
  'Nomina y salarios':        { tipo: 'fijo',   valor: 29000 },
  // Mezcla: telefonos y alquiler de equipo son fijos, luz y gas se mueven. Se
  // deja fijo al promedio porque la parte variable es chica; si resulta que
  // salta con la temporada, se parte en dos categorias.
  'Tarifas y servicios':      { tipo: 'fijo',   valor: 6600 },
  // Agencia de marketing, contador y otros servicios contratados.
  'Prestadores y honorarios': { tipo: 'fijo',   valor: 5500 },
  // NO se recorta: esta muy abajo de su banda y el problema es de venta.
  'Marketing':                { tipo: 'fijo',   valor: 5700 },

  // --- proporcionales: un PORCENTAJE de la venta del mes ---------------------
  // El 10% de servicio que se le pasa al equipo. Fue el 4.24% de la venta del
  // año. No es un monto: sube y baja con lo que se vendio.
  'Propinas al equipo':       { tipo: '%venta', valor: 4.24 },
  // Comision de tarjeta (proporcional) mas cargos bancarios (no tanto). Se deja
  // en su tasa real del año para que cualquier desvio sea señal, no ruido.
  'Comisiones y cargos':      { tipo: '%venta', valor: 6.5 },

  // --- anuales: se compran de vez en cuando, se miden contra el acumulado ----
  // Q2,750 en nueve meses. Se compra cada ~5 meses: un mensual de Q300 no
  // compra nada y da alarma once veces al año.
  'Uniformes':                { tipo: 'anual',  valor: 3700 },
  // Equipamiento y menaje. El rubro mas postergable: Q94,000 al ritmo del año,
  // presupuestado en Q70,000.
  'Bienes de uso':            { tipo: 'anual',  valor: 70000 },
  // Cae a saltos. Q68,000 al ritmo del año, presupuestado en Q60,000.
  'Mantencion':               { tipo: 'anual',  valor: 60000 },
  // IVA mensual mas ISR que no lo es. Al ritmo del año son ~Q107,000. No es
  // decision y ademas no entra al gasto operativo del DRE.
  'Impuestos':                { tipo: 'anual',  valor: 107000 }
};

/** Meses con presupuesto distinto. Solo aplica a fijo y a %venta. */
var PRESU_PROPUESTA_MESES = {
  'Marketing': { 11: 9000, 12: 9000 }   // noviembre y diciembre son temporada alta
};

/**
 * Migra la hoja a los tres tipos y carga la propuesta.
 *
 * PISA los valores de la primera carga, a proposito: los escribio esta misma
 * funcion hace un rato y estaban mal. Lo que NO pisa es una celda cuyo valor no
 * sea uno de los de la primera propuesta —o sea, algo que haya escrito Juanma—:
 * eso se respeta y se reporta.
 */
var PRESU_PRIMERA_CARGA = {
  'Nomina y salarios': 29000, 'Inmueble y ocupacion': 20900,
  'Comisiones y cargos': 8500, 'Impuestos': 8900, 'Tarifas y servicios': 6600,
  'Prestadores y honorarios': 5500, 'Marketing': 5700, 'Bienes de uso': 5500,
  'Mantencion': 4500, 'Propinas al equipo': 5500, 'Uniformes': 300
};

function migrarPresupuestoATipos() {
  soloDueno_();
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(PRESU_HOJA);
  if (!hoja) { var m = 'No existe ' + PRESU_HOJA + '. Corre instalarPresupuesto().'; console.log(m); return m; }

  var filas = hoja.getDataRange().getValues();
  var cab = filas[0].map(function (c) {
    return _finSinAcentos_(String(c || '')).toLowerCase().trim();
  });

  // 1) la columna Tipo, si falta, se inserta despues de Seccion
  if (cab.indexOf('tipo') === -1) {
    hoja.insertColumnAfter(1);
    hoja.getRange(1, 2).setValue('Tipo').setFontWeight('bold');
    hoja.setColumnWidth(2, 90);
    SpreadsheetApp.flush();
    filas = hoja.getDataRange().getValues();
    cab = filas[0].map(function (c) {
      return _finSinAcentos_(String(c || '')).toLowerCase().trim();
    });
  }
  // 2) "Mensual" pasa a llamarse "Valor": ya no siempre es un monto mensual
  var cVal = cab.indexOf('valor');
  if (cVal === -1) {
    cVal = cab.indexOf('mensual');
    if (cVal >= 0) hoja.getRange(1, cVal + 1).setValue('Valor');
  }
  var cSec = cab.indexOf('seccion'), cTipo = cab.indexOf('tipo');
  if (cSec < 0 || cTipo < 0 || cVal < 0) {
    var m2 = 'No encuentro las columnas Seccion / Tipo / Valor.'; console.log(m2); return m2;
  }
  var cMes = {};
  PRESU_MESES.forEach(function (nm, i) {
    var j = cab.indexOf(nm.toLowerCase());
    if (j >= 0) cMes[i + 1] = j;
  });

  var escritas = [], respetadas = [], sinFila = [], vistas = {};
  for (var r = 1; r < filas.length; r++) {
    var nombre = String(filas[r][cSec] || '').trim();
    var P = PRESU_PROPUESTA[nombre];
    if (!nombre || !P) continue;
    vistas[nombre] = true;

    var actual = filas[r][cVal];
    var vacia = actual === '' || actual === null || actual === undefined;
    var esDeLaPrimera = !vacia && PRESU_PRIMERA_CARGA[nombre] !== undefined &&
                        Math.abs(_finNum_(actual) - PRESU_PRIMERA_CARGA[nombre]) < 0.01;

    if (vacia || esDeLaPrimera) {
      hoja.getRange(r + 1, cTipo + 1).setValue(P.tipo);
      hoja.getRange(r + 1, cVal + 1).setValue(P.valor);
      escritas.push(nombre + ' [' + P.tipo + '] ' + P.valor);
    } else {
      hoja.getRange(r + 1, cTipo + 1).setValue(P.tipo);   // el tipo si se corrige
      respetadas.push(nombre + ' (tenia ' + actual + ', se respeto; tipo puesto en ' + P.tipo + ')');
    }

    // Un presupuesto anual no tiene version de mes: si quedaron de la carga
    // anterior, se borran, porque el lector los ignoraria y confundirian.
    var porMes = PRESU_PROPUESTA_MESES[nombre];
    Object.keys(cMes).forEach(function (mm) {
      var j = cMes[mm], v = filas[r][j];
      var quiere = (P.tipo !== 'anual' && porMes && porMes[mm] !== undefined) ? porMes[mm] : null;
      var tiene = !(v === '' || v === null || v === undefined);
      if (quiere !== null && !tiene) {
        hoja.getRange(r + 1, j + 1).setValue(quiere);
        escritas.push(nombre + ' ' + PRESU_MESES[mm - 1] + ' ' + quiere);
      } else if (quiere === null && tiene && P.tipo === 'anual') {
        hoja.getRange(r + 1, j + 1).clearContent();
        escritas.push(nombre + ' ' + PRESU_MESES[mm - 1] + ' borrado (es anual)');
      }
    });
  }
  Object.keys(PRESU_PROPUESTA).forEach(function (k) { if (!vistas[k]) sinFila.push(k); });

  // El formato de la columna Valor: DOS decimales.
  //
  // La primera instalacion la dejo en '#,##0' —entero— porque entonces todos
  // los valores eran montos. Con los tipos, esa columna ahora tambien lleva
  // porcentajes: 6.5 se veia como "7" y 4.24 como "4". El valor guardado
  // siempre estuvo bien y el motor calculaba con el numero real; lo que mentia
  // era la pantalla, que es peor, porque invita a "corregir" un dato correcto.
  var n = Math.max(hoja.getLastRow() - 1, 1);
  hoja.getRange(2, cVal + 1, n, 1).setNumberFormat('#,##0.##');

  // La lista desplegable del tipo, para que no se escriba a mano
  hoja.getRange(2, cTipo + 1, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PRESU_TIPOS, true)
      .setAllowInvalid(false).build());

  // Se relee la hoja: confirmar contra lo escrito y no contra lo que este
  // codigo cree que escribio.
  SpreadsheetApp.flush();
  var rel = hoja.getDataRange().getValues();
  var cuenta = { fijo: 0, '%venta': 0, anual: 0, sin_tipo: 0 };
  for (var r2 = 1; r2 < rel.length; r2++) {
    var nm = String(rel[r2][cSec] || '').trim();
    if (!nm) continue;
    var t = _finSinAcentos_(String(rel[r2][cTipo] || '')).toLowerCase().trim();
    if (cuenta[t] === undefined) cuenta.sin_tipo++; else cuenta[t]++;
  }

  var res = [
    'Escritas: ' + escritas.length + (escritas.length ? '\n  ' + escritas.join('\n  ') : ''),
    'Respetadas (valor tuyo, no se toco): ' + respetadas.length +
      (respetadas.length ? '\n  ' + respetadas.join('\n  ') : ''),
    'Secciones de la propuesta sin fila: ' + sinFila.length +
      (sinFila.length ? ' -> ' + sinFila.join(' · ') : ''),
    'Verificado releyendo la hoja: ' + cuenta.fijo + ' fijo · ' + cuenta['%venta'] +
      ' %venta · ' + cuenta.anual + ' anual · ' + cuenta.sin_tipo + ' sin tipo.'
  ].join('\n');
  console.log(res);
  return res;
}


/**
 * ETIQUETA A LOS EXTRAS CON SU AREA EN LA HOJA DE PLANILLA
 * =======================================================
 *
 * La columna "Puesto" dice "Extra" a secas, sin decir si el turno fue a cocina
 * o a barra. Esta funcion cambia ese valor por "Extra cocina" o "Extra barra"
 * segun la persona, en las 9 pestañas del año.
 *
 * Por que el puesto y no una columna nueva: el lector ya reconoce cualquier
 * puesto que EMPIECE con "extra", asi que etiquetar no cambia ni un numero de
 * los que ya estan — solo agrega el area. Una columna nueva habria que crearla
 * en nueve pestañas y mantenerla a mano.
 *
 * Areas dadas por Juanma el 22-sep-2026. BARRA Y SALA SON LO MISMO.
 *
 * En sala el unico de nomina es Efrain: todos los demas meseros son extras.
 * Por eso Marvin y Erickson entran por PUESTO_CORREGIR y no por aca — a ellos
 * no hay que agregarles el area sino cambiarles el rol.
 *
 * SOLO toca celdas cuyo puesto sea exactamente "Extra". Nada mas de la planilla
 * se modifica: es el documento de sueldos, no un archivo de trabajo.
 */
var EXTRA_AREA = {
  'ANDRE':  'cocina',
  'ANTONY': 'cocina',
  'EDDY':   'barra',
  'MELVIN': 'barra',
  'JORGE':  'barra'   // ya no esta en Rosanta; sus meses de ene-mar eran de sala
};

/**
 * Gente cuyo PUESTO esta mal en la planilla y hay que corregir, no solo
 * etiquetar.
 *
 * Regla de Juanma (22-sep-2026): "todos los meseros son extras; los unicos en
 * nomina en sala son Marvin y Efrain". Erickson figura como "Mesero" y por eso
 * su sueldo estaba contado como planilla FIJA. Son Q900 (Q450 en agosto y Q450
 * en septiembre) que pasan a extras de barra.
 *
 * Esto cambia el puesto de un empleado en el documento de sueldos, no solo
 * agrega una palabra. Va aparte de EXTRA_AREA justamente para que se vea que es
 * otra cosa, y la funcion lo reporta linea por linea.
 */
/** Meses en que el pago de esa persona es finiquito y no trabajo del mes. */
var EXCEPCION_FINIQUITO = { 'MARVIN': [9, 10] };

var PUESTO_CORREGIR = {
  'ERICKSON': { de: 'mesero', a: 'Extra barra' },
  // Marvin figura como "Mesero" los nueve meses pero NUNCA estuvo en nomina
  // (Juanma, 22-sep-2026). Se nota en el dato: Efrain cobra Q4,000 clavados
  // todos los meses y Marvin salta entre Q1,050 y Q3,150, que es pago por
  // turnos. Son Q19,900 que pasan de planilla fija a extras de sala.
  'MARVIN':   { de: 'mesero', a: 'Extra barra' }
};

function etiquetarExtrasPorArea() {
  soloDueno_();
  var ss;
  try {
    ss = SpreadsheetApp.openById(FIN_PLANILLA_ID);
  } catch (e) {
    var m = 'No pude abrir el Sheet de planilla: ' + String(e && e.message || e);
    console.log(m); return m;
  }

  var cambios = [], sinArea = [], yaEstaban = [], corregidos = [];
  var anio = new Date().getFullYear();

  ss.getSheets().forEach(function (hoja) {
    var mes = _finMesDePestana_(hoja.getName(), anio);
    if (!mes) return;
    var filas;
    try { filas = hoja.getDataRange().getValues(); } catch (e) { return; }

    var cPuesto = -1, cNombre = -1, rCab = -1;
    for (var r = 0; r < filas.length && rCab < 0; r++) {
      var p = -1, n = -1;
      for (var c = 0; c < filas[r].length; c++) {
        var t = _finSinAcentos_(String(filas[r][c] || '')).toLowerCase().replace(/\s+/g, ' ').trim();
        if (t === 'puesto') p = c;
        if (t === 'empleado') n = c;
      }
      if (p >= 0 && n >= 0) { cPuesto = p; cNombre = n; rCab = r; }
    }
    if (rCab < 0) return;

    for (var i = rCab + 1; i < filas.length; i++) {
      var puesto = String(filas[i][cPuesto] || '').trim();
      if (puesto.toLowerCase().indexOf('sub total') === 0) break;
      var nombre = _finSinAcentos_(String(filas[i][cNombre] || '')).toUpperCase().trim();

      // Primero las correcciones de puesto: cambian el rol, no solo el area.
      var corr = null;
      Object.keys(PUESTO_CORREGIR).forEach(function (k) {
        if (nombre.indexOf(k) === 0) corr = PUESTO_CORREGIR[k];
      });
      // Excepcion por mes: el pago de septiembre a Marvin es su FINIQUITO
      // (Q3,000, en dos partes de Q1,500 entre septiembre y octubre), no un
      // turno extra. Va con su propio puesto para que el motor lo saque del
      // ratio de extras sobre la venta, que es el que mide personal.
      var esFiniquito = EXCEPCION_FINIQUITO[nombre.split(' ')[0]];
      if (esFiniquito && esFiniquito.indexOf(mes) > -1) corr = { de: puesto.toLowerCase(), a: 'Finiquito' };
      if (corr && puesto.toLowerCase() === corr.de) {
        hoja.getRange(i + 1, cPuesto + 1).setValue(corr.a);
        corregidos.push(hoja.getName() + ' ' + String(filas[i][cNombre] || '').trim() +
                        ': "' + puesto + '" -> "' + corr.a + '"');
        continue;
      }

      // Exactamente "Extra": una fila ya etiquetada no se vuelve a tocar.
      if (puesto.toLowerCase() !== 'extra') {
        if (puesto.toLowerCase().indexOf('extra ') === 0) yaEstaban.push(hoja.getName() + ' ' + puesto);
        continue;
      }
      var area = null;
      Object.keys(EXTRA_AREA).forEach(function (k) {
        if (nombre.indexOf(k) === 0) area = EXTRA_AREA[k];
      });
      if (!area) { sinArea.push(hoja.getName() + ' ' + String(filas[i][cNombre] || '').trim()); continue; }
      hoja.getRange(i + 1, cPuesto + 1).setValue('Extra ' + area);
      cambios.push(hoja.getName() + ' ' + String(filas[i][cNombre] || '').trim() + ' -> Extra ' + area);
    }
  });

  // Se relee la planilla para confirmar contra la hoja, no contra lo que este
  // codigo cree que escribio.
  SpreadsheetApp.flush();
  var cuenta = { 'Extra cocina': 0, 'Extra barra': 0, 'Extra': 0, 'Finiquito': 0 };
  ss.getSheets().forEach(function (hoja) {
    if (!_finMesDePestana_(hoja.getName(), anio)) return;
    var f;
    try { f = hoja.getDataRange().getValues(); } catch (e) { return; }
    f.forEach(function (fila) {
      fila.forEach(function (c) {
        var v = String(c || '').trim();
        if (cuenta[v] !== undefined) cuenta[v]++;
      });
    });
  });

  var res = [
    // Los cambios de ROL van primero y aparte: no es lo mismo agregarle el area
    // a un extra que convertir a un mesero en extra. La version anterior no los
    // listaba y el reporte decia "28 etiquetadas" mientras la hoja terminaba con
    // 38 filas cambiadas: los 10 de PUESTO_CORREGIR se aplicaban en silencio.
    'Puestos CORREGIDOS (cambio de rol, no solo area): ' + corregidos.length +
      (corregidos.length ? '\n  ' + corregidos.join('\n  ') : ''),
    'Etiquetadas con su area: ' + cambios.length +
      (cambios.length ? '\n  ' + cambios.join('\n  ') : ''),
    'Total de filas tocadas: ' + (corregidos.length + cambios.length),
    'Ya tenian area: ' + yaEstaban.length,
    'Extras sin area definida (se dejan como "Extra"): ' + sinArea.length +
      (sinArea.length ? ' -> ' + sinArea.join(' · ') : ''),
    // El conteo final tiene que CUADRAR con las filas tocadas. Si no cuadra, lo
    // dice: un resumen que no cierra es la unica forma de ver un cambio que se
    // aplico y no se reporto.
    'Verificado releyendo la planilla: ' + cuenta['Extra cocina'] + ' Extra cocina · ' +
      cuenta['Extra barra'] + ' Extra barra · ' + cuenta['Finiquito'] + ' Finiquito · ' +
      cuenta['Extra'] + ' sin area.',
    (function () {
      var enHoja = cuenta['Extra cocina'] + cuenta['Extra barra'] + cuenta['Finiquito'];
      var tocadas = corregidos.length + cambios.length + yaEstaban.length;
      return enHoja === tocadas
        ? 'Cuadra: ' + enHoja + ' filas con puesto nuevo = ' + tocadas + ' reportadas.'
        : 'NO CUADRA: la hoja tiene ' + enHoja + ' filas con puesto nuevo pero se ' +
          'reportaron ' + tocadas + '. Revisar antes de confiar en el reparto.';
    })()
  ].join('\n');
  console.log(res);
  return res;
}
