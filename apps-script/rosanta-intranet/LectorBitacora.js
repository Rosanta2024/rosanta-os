/**
 * LectorBitacora.gs — Leer de vuelta el rastro de auditoria.
 *
 * Que resuelve: la BITACORA se escribe desde el 21-ago y hasta el 26-ago NADIE la
 * leia. Un registro que nadie lee no es auditoria, es basura que crece. Once lugares
 * escriben ahi —las 9 acciones de EdicionRecetario.gs/CrearFicha.gs mas el sync y la
 * reversion— y no habia una sola linea de codigo que la abriera.
 *
 * Dos preguntas, dos funciones. Ninguna escribe en el Banco ni en las fichas:
 *
 *   historialDe('lomito')          — "esto se ve mal, ¿que le pasó?"
 *                                    Solo Logger. No escribe NADA, ni una pestana.
 *   refrescarResumenBitacora()     — "¿que paso este mes?"
 *                                    Escribe la pestana BITACORA_RESUMEN y nada mas.
 *
 * La BITACORA cruda sigue siendo la fuente. Esto no la reemplaza ni la resume de forma
 * destructiva: BITACORA_RESUMEN se regenera entera cada vez y se puede borrar sin
 * perder nada.
 */

// Los helpers de este archivo van con sufijo Bit_ a proposito. Apps Script tiene UN
// solo ambito global para todos los .gs: un fecha_() o un conteo_() sueltos son una
// colision esperando. Ya paso con leerFicha_ y primerNumero_.
var BIT = {
  hojaResumen: 'BITACORA_RESUMEN',
  dias: 30,          // ventana de "reciente"
  maxFilas: 25,      // por bloque. Lo que se corta se dice.
  cols: 6
};

/* ==========================================================================
   LECTURA
   ========================================================================== */

/**
 * La bitacora, parseada. Devuelve las filas mas nuevas primero.
 * Si la hoja no existe todavia devuelve vacio en vez de explotar: que nadie haya
 * escrito nunca es un estado valido, no un error.
 */
function leerBitacora_() {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(EDIT.hojaBitacora);
  if (!h || h.getLastRow() < 2) return [];

  var datos = h.getRange(1, 1, h.getLastRow(), 10).getValues();
  var out = [];
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    if (!f[3]) continue;                       // sin ACCION no es una fila real
    out.push({
      fecha: (Object.prototype.toString.call(f[0]) === '[object Date]') ? f[0] : null,
      quien: String(f[1] || ''), rol: String(f[2] || ''), accion: String(f[3] || ''),
      hoja: String(f[4] || ''), referencia: String(f[5] || ''), campo: String(f[6] || ''),
      antes: f[7], despues: f[8], nota: String(f[9] || '')
    });
  }
  out.sort(function (a, b) {
    return (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0);
  });
  return out;
}

/** Variacion porcentual, o null si antes/despues no son numeros utiles. */
function variacionBit_(antes, despues) {
  if (typeof antes !== 'number' || typeof despues !== 'number' || !antes) return null;
  return Math.round((despues - antes) / antes * 1000) / 10;
}

function fechaBit_(d) {
  return d ? Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd HH:mm') : '';
}

/**
 * Todo lo que le paso a un producto o a una ficha. NO escribe nada.
 *
 * Busca por coincidencia parcial en REFERENCIA y en HOJA, normalizado: 'lomito'
 * encuentra 'Lomito', 'LOMITO AL GRILL' y la ficha que lo use. Es a proposito —
 * cuando estas mirando un numero raro no te acordas del nombre exacto.
 */
function historialDe(texto) {
  if (!texto) { Logger.log('historialDe("que"): falta el nombre a buscar.'); return []; }
  var q = normalizar_(texto);
  var todo = leerBitacora_();
  var hits = todo.filter(function (m) {
    return normalizar_(m.referencia).indexOf(q) !== -1 || normalizar_(m.hoja).indexOf(q) !== -1;
  });

  if (!hits.length) {
    Logger.log('Sin movimientos para "%s" en %s filas de bitacora.', texto, todo.length);
    return [];
  }

  Logger.log('%s movimiento(s) para "%s", del mas nuevo al mas viejo:', hits.length, texto);
  hits.forEach(function (m) {
    var v = variacionBit_(m.antes, m.despues);
    Logger.log('  %s | %s | %s | %s: %s -> %s%s%s',
               fechaBit_(m.fecha), m.quien || '(sin quien)', m.accion, m.campo || '-',
               m.antes === '' ? '(vacio)' : m.antes,
               m.despues === '' ? '(vacio)' : m.despues,
               v === null ? '' : '  (' + (v >= 0 ? '+' : '') + v + '%)',
               m.nota ? '  · ' + m.nota : '');
  });
  return hits;
}

/* ==========================================================================
   RESUMEN
   ========================================================================== */

/**
 * Vuelca un digesto de la bitacora en BITACORA_RESUMEN.
 * Lo unico que toca es esa pestana. Se regenera entera cada vez.
 */
function refrescarResumenBitacora() {
  var todo = leerBitacora_();
  var ahora = new Date();
  var corte = new Date(ahora.getTime() - BIT.dias * 24 * 60 * 60 * 1000);
  var recientes = todo.filter(function (m) { return m.fecha && m.fecha >= corte; });

  var filas = [];

  filas = filas.concat(seccionBit_('ULTIMOS MOVIMIENTOS'));
  filas.push(['FECHA', 'QUIEN', 'ACCION', 'REFERENCIA', 'ANTES -> DESPUES', 'NOTA']);
  filas = filas.concat(bloqueBit_(todo, function (m) {
    var v = variacionBit_(m.antes, m.despues);
    return [fechaBit_(m.fecha), m.quien, m.accion, m.referencia,
            (m.antes === '' ? '-' : m.antes) + ' -> ' + (m.despues === '' ? '-' : m.despues) +
            (v === null ? '' : '  (' + (v >= 0 ? '+' : '') + v + '%)'),
            m.nota];
  }));

  filas = filas.concat(seccionBit_('POR ACCION — ultimos ' + BIT.dias + ' dias'));
  filas.push(['ACCION', 'VECES', '', '', '', '']);
  filas = filas.concat(conteoBit_(recientes, function (m) { return m.accion; }));

  filas = filas.concat(seccionBit_('QUIEN — ultimos ' + BIT.dias + ' dias'));
  filas.push(['QUIEN', 'VECES', '', '', '', '']);
  filas = filas.concat(conteoBit_(recientes, function (m) { return m.quien || '(sin quien)'; }));

  filas = filas.concat(seccionBit_('MAS TOCADOS — ultimos ' + BIT.dias + ' dias'));
  filas.push(['REFERENCIA', 'VECES', '', '', '', '']);
  filas = filas.concat(conteoBit_(recientes, function (m) { return m.referencia || '(sin referencia)'; }));

  // Lo que mas conviene mirar: un salto grande es o un error de captura o una
  // noticia de costos. Las dos cosas hay que verlas.
  filas = filas.concat(seccionBit_('MAYORES SALTOS DE PRECIO — ultimos ' + BIT.dias + ' dias'));
  filas.push(['REFERENCIA', 'ANTES', 'DESPUES', 'VAR %', 'QUIEN', 'FECHA']);
  var saltos = recientes.map(function (m) { return { m: m, v: variacionBit_(m.antes, m.despues) }; })
                        .filter(function (x) { return x.v !== null; })
                        .sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
  filas = filas.concat(bloqueBit_(saltos, function (x) {
    return [x.m.referencia, x.m.antes, x.m.despues, (x.v >= 0 ? '+' : '') + x.v + '%',
            x.m.quien, fechaBit_(x.m.fecha)];
  }));

  escribirResumenBitacora_(todo, recientes, ahora, filas);

  Logger.log('%s actualizado — %s movimientos en total, %s en los ultimos %s dias.',
             BIT.hojaResumen, todo.length, recientes.length, BIT.dias);
  return { total: todo.length, recientes: recientes.length };
}

/** Un separador visible: linea en blanco + titulo. Devuelve DOS filas. */
function seccionBit_(titulo) {
  return [['', '', '', '', '', ''], ['── ' + titulo + ' ──', '', '', '', '', '']];
}

/** N filas como mucho, y si se corto se dice. */
function bloqueBit_(lista, mapear) {
  if (!lista.length) return [['(nada)', '', '', '', '', '']];
  var out = [];
  var n = Math.min(lista.length, BIT.maxFilas);
  for (var i = 0; i < n; i++) out.push(anchoBit_(mapear(lista[i])));
  if (lista.length > n) out.push(['… y ' + (lista.length - n) + ' mas, no listadas', '', '', '', '', '']);
  return out;
}

/** Conteo por clave, de mayor a menor. */
function conteoBit_(lista, clave) {
  var mapa = {};
  for (var i = 0; i < lista.length; i++) {
    var k = clave(lista[i]);
    mapa[k] = (mapa[k] || 0) + 1;
  }
  var pares = Object.keys(mapa).map(function (k) { return { k: k, n: mapa[k] }; });
  pares.sort(function (a, b) { return b.n - a.n; });
  return bloqueBit_(pares, function (p) { return [p.k, p.n, '', '', '', '']; });
}

function anchoBit_(fila) {
  var out = fila.slice();
  while (out.length < BIT.cols) out.push('');
  return out.slice(0, BIT.cols);
}

function escribirResumenBitacora_(todo, recientes, ahora, filas) {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(BIT.hojaResumen);
  if (!h) h = ss.insertSheet(BIT.hojaResumen);
  h.clear();

  var masVieja = todo.length ? todo[todo.length - 1].fecha : null;
  var masNueva = todo.length ? todo[0].fecha : null;

  var cab = [
    ['BITACORA — RESUMEN. Lo regenera refrescarResumenBitacora(). No escribir aca.', '', '', '', '', ''],
    ['ULTIMA CORRIDA', fechaBit_(ahora), '', '', '', ''],
    ['MOVIMIENTOS', todo.length + ' en total · ' + recientes.length + ' en los ultimos ' + BIT.dias + ' dias', '', '', '', ''],
    ['PERIODO', fechaBit_(masVieja) + '  ->  ' + fechaBit_(masNueva), '', '', '', ''],
    ['', '', '', '', '', ''],
    ['La fuente es la pestana ' + EDIT.hojaBitacora + '. Esto se puede borrar sin perder nada.', '', '', '', '', ''],
    ['Para el detalle de un producto: historialDe("nombre") en LectorBitacora.gs.', '', '', '', '', '']
  ];

  var todoJunto = cab.concat(filas);
  h.getRange(1, 1, todoJunto.length, BIT.cols).setValues(todoJunto);
  h.setFrozenRows(cab.length);
}
