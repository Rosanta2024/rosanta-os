/**
 * RaaDatos.gs — Resultado · Análisis · Acción de la pantalla de Finanzas.
 *
 * Pilar 3, Finance & Data OS. Es LO UNICO de finanzas que escribe. Todo lo
 * demas del pilar es lectura del maestro; aca se guarda lo que la persona
 * decide hacer con un indicador en amarillo o rojo.
 *
 * DE DONDE SALE (especificacion del 3-sep-2026, seccion 6)
 *   1. RESULTADO  lo genera el sistema, NUNCA se escribe a mano. La regla del
 *      sistema de gestion de 5 elementos: el resultado tiene que venir del POS
 *      o de la contabilidad, no de la persona a la que se esta evaluando. Por
 *      eso el cliente manda analisis, accion y responsable, y el servidor
 *      vuelve a calcular el resultado y la zona antes de escribir la fila.
 *   2. CUANTO CUESTA  el desvio traducido a quetzales al mes. Un food cost 19
 *      puntos sobre meta no dice nada; Q29,000 al mes si.
 *   3. ANALISIS  campo libre. "Que se rompio. No vale 'fue una semana ocupada'."
 *   4. ACCION Y RESPONSABLE  una conducta concreta y UN nombre. Si todos son
 *      responsables, no lo es nadie.
 *
 * AMBITO GLOBAL: todos los .gs comparten un solo ambito. Por eso cada nombre de
 * aqui empieza con "raa" o "_raa".
 *
 * PERMISOS: el token va como PRIMER argumento y toda funcion llamable desde la
 * vista empieza con exigirModulo_(auth, 'finanzas'). doGet protege la pagina,
 * no la funcion.
 */

var RAA_HOJA = 'RAA';

/**
 * Las ocho columnas son las de la especificacion. ESCRITO_POR se agrego el
 * 12-sep-2026: la fila dice a quien se le asigno la accion (RESPONSABLE), y sin
 * esta novena no quedaba registro de quien la escribio.
 */
var RAA_COLS = ['SEMANA', 'INDICADOR', 'ZONA', 'RESULTADO', 'ANALISIS',
                'ACCION', 'RESPONSABLE', 'FECHA', 'ESCRITO_POR'];

/** El equipo, para el selector. Un nombre, no un area. */
var RAA_EQUIPO = ['Juanma', 'Jeffry', 'José', 'Nadia', 'Efraín'];

var RAA_NOMBRE = {
  food: 'Food cost (móvil 4)',
  prime: 'Prime cost (móvil 4)',
  caja: 'Caja',
  ventas: 'Ventas contra la semana anterior'
};

var RAA_CACHE = 'raa_filas_v1';

/* La clave lleva la meta (14-sep-2026): las zonas del RAA se calculan contra ella. */
function raaCacheClave_() {
  var m = metasFoodCost_();
  return RAA_CACHE + '_m' + m.global + '-' + m.BARRA;
}


/** Una vez. Crea la pestana RAA en el Sheet de config. Idempotente. */
function instalarRAA() {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(RAA_HOJA);
  if (hoja) return 'La pestana RAA ya existe con ' + Math.max(hoja.getLastRow() - 1, 0) +
                   ' filas. No se toco nada.';
  hoja = ss.insertSheet(RAA_HOJA);
  hoja.getRange(1, 1, 1, RAA_COLS.length).setValues([RAA_COLS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(4, 340);   // RESULTADO
  hoja.setColumnWidth(5, 420);   // ANALISIS
  hoja.setColumnWidth(6, 420);   // ACCION
  return 'Pestana RAA creada.';
}


// ------------------------------------------------------------------ semaforo

/**
 * La misma regla de la seccion 5 de la especificacion, del lado del SERVIDOR.
 * La vista pinta su propio semaforo para no esperar una llamada mas, pero el
 * que se guarda en la hoja es este: lo que queda escrito no depende de lo que
 * el navegador haya calculado.
 */
function _raaZona(ind, v, meta) {
  if (v === null || v === undefined) return 'gris';
  if (ind === 'food')   return v <= meta ? 'verde' : (v <= meta + 3 ? 'amarillo' : 'rojo');
  if (ind === 'prime')  return v < 60 ? 'verde' : (v <= 65 ? 'amarillo' : 'rojo');
  if (ind === 'caja')   return v >= 21 ? 'verde' : (v >= 7 ? 'amarillo' : 'rojo');
  if (ind === 'ventas') return v >= 0 ? 'verde' : (v >= -10 ? 'amarillo' : 'rojo');
  return 'gris';
}

function _raaQ(n) {
  return 'Q' + Math.round(Number(n) || 0).toLocaleString('es-GT');
}

function _raaPct(n) {
  return (n === null || n === undefined) ? '—' : Number(n).toFixed(1) + '%';
}

/**
 * Las cuatro tarjetas de la ultima semana, con su resultado y su costo.
 *
 * El costo es lo que convierte el desvio en una decision, y cada indicador se
 * traduce distinto:
 *   · food y prime  puntos sobre su umbral x la venta del MES (la semana x 4.345)
 *   · caja          lo que falta para el colchon de 21 dias. No es un costo
 *                   mensual: es un hueco, y se dice asi.
 *   · ventas        la caida de la semana llevada a mes.
 */
function _raaTarjetas(d) {
  var u = d.ultima || {};
  var meta = d.meta_cogs;
  var ventaMes = (u.ventas || 0) * FIN_SEMANAS_MES;
  var out = [];

  function tarjeta(ind, valor, zona, resultado, costo, costoTxt) {
    out.push({ ind: ind, nombre: RAA_NOMBRE[ind], valor: valor, zona: zona,
               resultado: resultado, costo: Math.round(costo || 0), costo_txt: costoTxt });
  }

  var zf = _raaZona('food', u.cogs_m4, meta);
  tarjeta('food', u.cogs_m4, zf,
    'Food cost móvil 4 de la S' + u.w + ' en ' + _raaPct(u.cogs_m4) +
    ' contra una meta de ' + _raaPct(meta) + '. Semana cruda ' + _raaPct(u.cogsp) +
    ' (' + _raaQ(u.cogs) + ' de compra sobre ' + _raaQ(u.ventas) + ' de venta).',
    Math.max((u.cogs_m4 || 0) - meta, 0) / 100 * ventaMes,
    'Cada punto sobre la meta son ' + _raaQ(ventaMes / 100) + ' al mes.');

  var zp = _raaZona('prime', u.prime_m4);
  tarjeta('prime', u.prime_m4, zp,
    'Prime cost móvil 4 de la S' + u.w + ' en ' + _raaPct(u.prime_m4) +
    '. Verde bajo 60%, rojo sobre 65%. Mano de obra de la semana ' + _raaPct(u.laborp) + '.',
    Math.max((u.prime_m4 || 0) - 60, 0) / 100 * ventaMes,
    'Medido contra el 60% que separa el verde del amarillo.');

  var zc = _raaZona('caja', d.dias_caja);
  tarjeta('caja', d.dias_caja, zc,
    'Caja al cierre de la S' + u.w + ': ' + _raaQ(d.caja) + ', o sea ' +
    Number(d.dias_caja).toFixed(1) + ' días de gasto a ' + _raaQ(d.gasto_dia) + ' por día.',
    Math.max(21 - (d.dias_caja || 0), 0) * (d.gasto_dia || 0),
    'No es un costo: es lo que falta para el colchón de 21 días.');

  var zv = _raaZona('ventas', u.dv);
  tarjeta('ventas', u.dv, zv,
    'Ventas de la S' + u.w + ': ' + _raaQ(u.ventas) + ', ' +
    ((u.dv >= 0 ? '+' : '') + _raaPct(u.dv)) + ' contra la semana anterior. ' +
    u.com + ' comensales, ticket ' + _raaQ(u.tp) + '.',
    Math.max(-(u.dv || 0), 0) / 100 * ventaMes,
    'La caída de la semana, llevada a un mes.');

  return out;
}


// -------------------------------------------------------------------- lectura

/** Las filas de la hoja RAA. Cachea 30 min; guardarRaa() borra el cache. */
function _raaFilas() {
  var cache = CacheService.getScriptCache();
  var g = cache.get(raaCacheClave_());
  if (g) {
    try { return JSON.parse(g); } catch (e) { /* cache corrupta: se relee */ }
  }
  var out = [];
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(RAA_HOJA);
  if (hoja && hoja.getLastRow() > 1) {
    var filas = hoja.getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      if (!filas[i][0] && !filas[i][1]) continue;
      var f = filas[i][7];
      out.push({
        fila: i + 1,
        semana: Number(filas[i][0]) || 0,
        ind: String(filas[i][1] || '').trim(),
        zona: String(filas[i][2] || '').trim(),
        resultado: String(filas[i][3] || '').trim(),
        analisis: String(filas[i][4] || '').trim(),
        accion: String(filas[i][5] || '').trim(),
        responsable: String(filas[i][6] || '').trim(),
        fecha: (f instanceof Date && !isNaN(f.getTime()))
          ? Utilities.formatDate(f, 'America/Guatemala', 'dd/MM/yyyy') : String(f || ''),
        quien: String(filas[i][8] || '').trim()
      });
    }
  }
  try { cache.put(raaCacheClave_(), JSON.stringify(out), 30 * 60); } catch (e2) { /* no importa */ }
  return out;
}

/**
 * Lo que pinta el bloque "Qué hay que responder".
 *
 * Trae SIEMPRE las cuatro tarjetas, tambien las verdes: una semana en verde que
 * se pueda mirar es la unica forma de saber si la accion de la semana pasada
 * funciono. La vista deja las verdes plegadas.
 */
function getRaaData(auth, forzar) {
  var u = exigirModulo_(auth, 'finanzas');
  var d = _finDatos(forzar);
  var sem = (d.ultima && d.ultima.w) || 0;
  var filas = _raaFilas();

  var guardado = {};
  filas.forEach(function (f) { if (f.semana === sem) guardado[f.ind] = f; });

  var tarjetas = _raaTarjetas(d).map(function (t) {
    var g = guardado[t.ind];
    t.analisis = g ? g.analisis : '';
    t.accion = g ? g.accion : '';
    t.responsable = g ? g.responsable : '';
    t.guardado = g ? (g.fecha + (g.quien ? ' · ' + g.quien : '')) : '';
    return t;
  });

  // El historial es lo que hace util al bloque: la semana pasada dijimos que
  // ibamos a hacer esto, y aqui esta el numero de esta semana.
  var historial = filas.filter(function (f) { return f.semana !== sem && f.accion; })
                       .sort(function (a, b) { return b.semana - a.semana; })
                       .slice(0, 10);

  return {
    semana: sem,
    ini: (d.ultima && d.ultima.ini) || '',
    fin: (d.ultima && d.ultima.fin) || '',
    meta_cogs: d.meta_cogs,
    tarjetas: tarjetas,
    equipo: RAA_EQUIPO,
    historial: historial,
    yo: u.nombre || u.email,
    gen: d.gen
  };
}


// ------------------------------------------------------------------ escritura

/**
 * Guarda (o pisa) la fila de un indicador de la semana en curso.
 *
 * datos = { ind, analisis, accion, responsable }
 *
 * La SEMANA no viene del cliente: se toma de la ultima semana del maestro. Si
 * viniera de afuera, un navegador con la pantalla abierta desde el lunes
 * anterior escribiria contra la semana vieja sin que nadie lo note.
 *
 * RESULTADO y ZONA tampoco: se recalculan aqui. Es la regla 1 de la seccion 6.
 */
function guardarRaa(auth, datos) {
  var u = exigirModulo_(auth, 'finanzas');
  datos = datos || {};

  var ind = String(datos.ind || '').trim();
  if (!RAA_NOMBRE[ind]) throw new Error('Indicador desconocido: ' + ind);

  var analisis = String(datos.analisis || '').trim();
  var accion = String(datos.accion || '').trim();
  var responsable = String(datos.responsable || '').trim();
  if (!analisis) throw new Error('Falta el análisis: qué específicamente se rompió.');
  if (!accion) throw new Error('Falta la acción: qué se hace distinto la semana que viene.');
  if (RAA_EQUIPO.indexOf(responsable) === -1) {
    throw new Error('Falta el responsable. Un nombre, no un equipo.');
  }

  var d = _finDatos(false);
  var sem = (d.ultima && d.ultima.w) || 0;
  if (!sem) throw new Error('No hay semana cerrada en el maestro todavía.');

  var tarjeta = null;
  _raaTarjetas(d).forEach(function (t) { if (t.ind === ind) tarjeta = t; });
  if (!tarjeta) throw new Error('No pude calcular el resultado de ' + ind + '.');

  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var hoja = ss.getSheetByName(RAA_HOJA);
  if (!hoja) { instalarRAA(); hoja = ss.getSheetByName(RAA_HOJA); }

  var fila = [sem, ind, tarjeta.zona, tarjeta.resultado, analisis, accion,
              responsable, new Date(), u.nombre || u.email];

  // Una sola fila por semana e indicador: la segunda vez se pisa, no se apila.
  var destino = 0;
  var vals = hoja.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (Number(vals[i][0]) === sem && String(vals[i][1]).trim() === ind) { destino = i + 1; break; }
  }
  if (!destino) destino = hoja.getLastRow() + 1;
  hoja.getRange(destino, 1, 1, RAA_COLS.length).setValues([fila]);

  // Un cache sin su invalidacion es otra regresion: se borra donde se escribe.
  try { CacheService.getScriptCache().remove(raaCacheClave_()); } catch (e) { /* no importa */ }

  return getRaaData(auth, false);
}
