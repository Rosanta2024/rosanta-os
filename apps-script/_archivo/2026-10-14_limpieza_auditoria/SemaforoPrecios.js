/**
 * SemaforoPrecios.gs — El sync avisa solo, sin correo.
 *
 * Que resuelve: detectar, deshacer y auditar ya funcionan, pero los tres dependen de
 * que alguien se acuerde de abrir el editor. El agujero original —el lomito subio 19%
 * y nadie se entero en dos meses— era de atencion, no de capacidad. Esto lo mira solo.
 *
 * Corre `sincronizarPreciosDeCierre_()` (que NO escribe) y vuelca el resultado en la
 * pestana SEMAFORO_PRECIOS del libro de costeo. La unica celda que toca en todo el
 * sistema es la de esa pestana: no escribe en el Banco, ni en las fichas, ni en el log.
 *
 * NO USA CORREO A PROPOSITO. MailApp necesitaria el scope script.send_mail, y cambiar
 * los scopes obliga a reautorizar el proyecto, que hoy tiene un web app publicado.
 *
 * COMO SE PROGRAMA
 *   Por codigo NO se puede: ScriptApp.newTrigger() necesita el scope script.scriptapp,
 *   que el manifiesto tampoco declara. Se agrega a mano y no cuesta nada:
 *     Editor > Activadores (el reloj, a la izquierda) > Anadir activador
 *     Funcion: refrescarSemaforoPrecios
 *     Origen:  Basado en el tiempo > Temporizador mensual > dia 5, 8-9am
 *   El dia 5 es a proposito: da margen a que el cierre del mes anterior este cargado
 *   y convertido a hoja nativa. Si se adelanta, el semaforo va a decir SIN CIERRE
 *   todos los meses y se vuelve ruido.
 *
 * ESTADOS
 *   SIN CIERRE — no esta cargado el cierre del mes. Es el peor caso y por eso es el
 *                mas ruidoso: sin cierre no se esta vigilando nada, y hasta hoy eso
 *                fallaba en silencio.
 *   REVISAR    — hay precios que se movieron. Alguien tiene que decidir.
 *   AL DIA     — el Banco coincide con el cierre.
 *   ERROR      — algo se rompio. Se escribe el mensaje, no se traga.
 */

var SEMAFORO = {
  // RETIRADO el 15-sep-2026 (auditoria A6, decision de Juanma): la UNICA fuente de
  // precios al Banco es el cierre de inventario de la intranet (InventarioDatos.gs). Dos
  // caminos proponian el mismo precio con datos distintos, y el del Excel podia devolver
  // lo que la intranet ya habia subido. APLICAR_SEMAFORO y APLICAR_BARRA pasaron a
  // apps-script/_archivo/2026-09-15_tanda3_semaforo/. La pestana queda como historico.
  retirado: true,
  hoja: 'SEMAFORO_PRECIOS',
  maxFilas: 40,       // por bloque. Lo que se corta se dice, no se esconde.
  colAprobar: 8,      // H — la casilla que se tilda a mano
  // Lo que cuenta como tilde. Se acepta de todo a proposito: si alguien escribe una
  // x en vez de usar la casilla, la intencion es obvia y no hay que hacerla fallar.
  tildes: ['true', 'x', 'si', 'sí', 'ok', 'v', '1']
};

/** Solo las lineas que proponen un cambio de precio se pueden aprobar. */
function esAprobable_(que) {
  var q = normalizar_(que);
  return q.indexOf('alerta') === 0 || q === 'cambia';
}

/** true si la celda de APROBAR esta tildada. */
function estaTildado_(v) {
  if (v === true) return true;
  return SEMAFORO.tildes.indexOf(normalizar_(v)) !== -1;
}

function refrescarSemaforoPrecios() {
  // Sigue existiendo y publica porque el activador mensual la llama: si desapareciera,
  // el activador fallaria todos los meses. Borralo en Editor > Activadores.
  if (SEMAFORO.retirado) {
    Logger.log('Semaforo del Excel retirado el 15-sep-2026: los precios entran por el cierre de inventario. Borra este activador.');
    return { retirado: true };
  }
  var stamp = new Date();
  var cuando = Utilities.formatDate(stamp, 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var filas = [];
  var estados = [];

  for (var i = 0; i < COSTEO.areas.length; i++) {
    var cfg = COSTEO.areas[i];
    var area = cfg.area;

    // Un area sin recetario configurado NO es un error: no esta en juego. Si contara
    // como error, el semaforo quedaria en rojo para siempre por algo que nadie va a
    // arreglar — y un semaforo siempre en rojo se deja de mirar, que es exactamente
    // el problema que esto vino a resolver.
    var ssArea = null;
    try { ssArea = abrirPorClave_(cfg.clave); } catch (e0) { ssArea = null; }
    if (!ssArea) {
      estados.push({ area: area, estado: 'NO CONFIGURADA', cuenta: false,
                     detalle: 'falta ' + cfg.clave + ' — esta area no se vigila' });
      filas.push([area, 'NO CONFIGURADA', 'falta ' + cfg.clave, '', '', '', '']);
      continue;
    }

    var r = null, err = null;
    try {
      r = sincronizarPreciosDeCierre_(area);
    } catch (e) {
      err = e.message || String(e);
    }

    if (err) {
      // Un area rota NO frena a la otra, y el motivo queda escrito.
      var esFaltaDeCierre = err.indexOf('INVENTARIO_CIERRE_SHEET_ID') !== -1;
      estados.push({ area: area, estado: esFaltaDeCierre ? 'SIN CIERRE' : 'ERROR',
                     cuenta: true, detalle: err });
      filas.push([area, esFaltaDeCierre ? 'SIN CIERRE' : 'ERROR', err, '', '', '', '']);
      continue;
    }

    var res = r.resumen;
    var estado = (res.cambian || res.alertas) ? 'REVISAR' : 'AL DIA';
    estados.push({
      area: area, estado: estado, cuenta: true,
      detalle: res.cambian + ' cambian · ' + res.alertas + ' alerta(s) de ±' + SYNC.alertaPct +
               '% · ' + res.unidadDistinta + ' con unidad distinta · ' + res.iguales + ' iguales'
    });

    // Las alertas primero: son las que piden una decision.
    filas = filas.concat(bloqueSemaforo_(area, 'ALERTA ±' + SYNC.alertaPct + '%', r.alertas, function (c) {
      return [c.producto, c.precioViejo, c.precioNuevo, c.pct + '%',
              c.unidad + (c.proveedor ? ' · ' + c.proveedor : '')];
    }));

    var soloCambios = r.cambios.filter(function (c) { return Math.abs(c.pct) < SYNC.alertaPct; });
    filas = filas.concat(bloqueSemaforo_(area, 'cambia', soloCambios, function (c) {
      return [c.producto, c.precioViejo, c.precioNuevo, c.pct + '%',
              c.unidad + (c.proveedor ? ' · ' + c.proveedor : '')];
    }));

    // No se tocan, pero hay que verlas: una unidad distinta suele ser un error de
    // captura en el cierre, y es lo que caza el candado 1.
    filas = filas.concat(bloqueSemaforo_(area, 'unidad distinta — NO se toca', r.unidadDistinta, function (c) {
      return [c.producto, c.banco, c.cierre, '', 'banco vs cierre'];
    }));

    filas = filas.concat(bloqueSemaforo_(area, 'sin match', r.sinMatch, function (c) {
      return [c.producto, c.motivo, '', '', ''];
    }));
  }

  escribirSemaforo_(cuando, estados, filas);

  var resumen = estados.map(function (e) { return e.area + ': ' + e.estado; }).join(' | ');
  Logger.log('SEMAFORO_PRECIOS actualizado %s — %s', cuando, resumen);
  estados.forEach(function (e) { Logger.log('  %s — %s', e.area, e.detalle); });
  return { cuando: cuando, estados: estados, filas: filas.length };
}

/** Un bloque de filas, con el corte declarado si lo hubo. */
function bloqueSemaforo_(area, etiqueta, lista, mapear) {
  if (!lista || !lista.length) return [];
  var out = [];
  var n = Math.min(lista.length, SEMAFORO.maxFilas);
  for (var i = 0; i < n; i++) out.push([area, etiqueta].concat(mapear(lista[i])));
  if (lista.length > n) {
    out.push([area, etiqueta, '… y ' + (lista.length - n) + ' mas, no listadas', '', '', '', '']);
  }
  return out;
}

/**
 * Vuelca todo en la pestana. Se reescribe entera cada vez: el semaforo es una foto
 * del ahora, no un historico. El historico es SYNC_PRECIOS.
 */
function escribirSemaforo_(cuando, estados, filas) {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(SEMAFORO.hoja);
  if (!h) h = ss.insertSheet(SEMAFORO.hoja);

  // Los tildes que ya estaban se conservan, pero SOLO si la propuesta es identica.
  // Si el precio propuesto cambio, el tilde se cae: aprobaste otro numero. Perder un
  // tilde cuesta un clic; arrastrarlo sobre un precio distinto escribe algo que nadie
  // aprobo.
  var previos = leerTildes_(h);
  h.clear();

  // Solo pesan las areas que de verdad se vigilan. El estado global se acompana
  // SIEMPRE del area que lo causa: "ERROR" a secas no dice donde mirar.
  var vigiladas = estados.filter(function (e) { return e.cuenta; });
  var peor = 'AL DIA', culpable = '';
  var orden = { 'SIN CIERRE': 3, 'ERROR': 3, 'REVISAR': 2, 'AL DIA': 1 };
  if (!vigiladas.length) {
    peor = 'SIN VIGILAR';
  } else {
    for (var i = 0; i < vigiladas.length; i++) {
      if (orden[vigiladas[i].estado] > orden[peor]) {
        peor = vigiladas[i].estado;
        culpable = vigiladas[i].area;
      }
    }
    if (peor !== 'AL DIA') peor = peor + ' (' + culpable + ')';
  }

  var cab = [
    ['SEMAFORO DE PRECIOS — lo regenera refrescarSemaforoPrecios(). No escribir aca.', '', '', '', '', '', ''],
    ['ULTIMA CORRIDA', cuando, '', '', '', '', ''],
    ['ESTADO', peor, '', '', '', '', '']
  ];
  estados.forEach(function (e) { cab.push([e.area, e.estado, e.detalle, '', '', '', '']); });
  // Si la fecha de arriba quedo vieja, el activador dejo de correr. Es el unico modo
  // de falla que esta pestana no puede gritar sola.
  cab.push(['', '', '', '', '', '', '']);
  cab.push(['Si ULTIMA CORRIDA quedo vieja, revisá el activador en Editor > Activadores.', '', '', '', '', '', '']);
  cab.push(['', '', '', '', '', '', '']);
  cab.push(['Para aplicar un cambio: tildá APROBAR y corré APLICAR_SEMAFORO.', '', '', '', '', '', '', '']);
  cab.push(['', '', '', '', '', '', '', '']);
  cab.push(['AREA', 'QUE', 'PRODUCTO', 'ANTES', 'AHORA', 'VAR %', 'UNIDAD / PROVEEDOR', 'APROBAR']);

  var cuerpo = filas.length ? filas : [['', '', '(nada que reportar)', '', '', '', '']];
  var todo = [];
  for (var c = 0; c < cab.length; c++) todo.push(anchoOcho_(cab[c]));

  // Las filas de datos arrancan aca. Se necesita la posicion absoluta para poner las
  // casillas y para devolver los tildes conservados.
  var filaPrimerDato = cab.length + 1;
  var aprobables = [];
  for (var d = 0; d < cuerpo.length; d++) {
    var fila = anchoOcho_(cuerpo[d]);
    // Vacio, no false: una fila que NO se puede aprobar tiene que verse SIN casilla.
    // Un false suelto se lee como casilla destildada e invita a tildar algo que el
    // que aplica va a ignorar.
    var tildado = '';
    if (esAprobable_(fila[1])) {
      aprobables.push(filaPrimerDato + d);
      tildado = !!previos[claveFila_(fila)];
    }
    fila[SEMAFORO.colAprobar - 1] = tildado;
    todo.push(fila);
  }

  h.getRange(1, 1, todo.length, 8).setValues(todo);
  h.setFrozenRows(cab.length);

  // Casillas de verdad, en bloques contiguos. Van DESPUES de setValues porque
  // insertCheckboxes deja la celda destildada, y despues se reponen los tildes.
  var grupos = [];
  for (var a = 0; a < aprobables.length; a++) {
    var ult = grupos[grupos.length - 1];
    if (ult && ult.fin === aprobables[a] - 1) ult.fin = aprobables[a];
    else grupos.push({ ini: aprobables[a], fin: aprobables[a] });
  }
  for (var g = 0; g < grupos.length; g++) {
    var alto = grupos[g].fin - grupos[g].ini + 1;
    var rango = h.getRange(grupos[g].ini, SEMAFORO.colAprobar, alto, 1);
    rango.insertCheckboxes();
    var vals = [];
    for (var v = 0; v < alto; v++) vals.push([todo[grupos[g].ini - 1 + v][SEMAFORO.colAprobar - 1]]);
    rango.setValues(vals);
  }
}

/** Rellena una fila a 8 celdas sin tocar lo que ya trae. */
function anchoOcho_(fila) {
  var out = fila.slice();
  while (out.length < 8) out.push('');
  return out;
}

/** Identidad de una propuesta: area + producto + de cuanto + a cuanto. */
function claveFila_(fila) {
  return normalizar_(fila[0]) + '|' + normalizar_(fila[2]) + '|' + fila[3] + '|' + fila[4];
}

/** Los tildes que hay hoy en la pestana, por clave de propuesta. */
function leerTildes_(h) {
  var out = {};
  if (!h || h.getLastRow() < 2 || h.getLastColumn() < SEMAFORO.colAprobar) return out;
  var datos = h.getRange(1, 1, h.getLastRow(), SEMAFORO.colAprobar).getValues();
  for (var r = 0; r < datos.length; r++) {
    if (!esAprobable_(datos[r][1])) continue;
    if (estaTildado_(datos[r][SEMAFORO.colAprobar - 1])) out[claveFila_(datos[r])] = true;
  }
  return out;
}

/**
 * Los productos tildados, por area. Devuelve SOLO nombres — nunca precios.
 * El que aplica relee los numeros del cierre; la pestana es editable a mano y no
 * puede ser la fuente de un precio.
 */
function aprobadosDelSemaforo_() {
  var h = hojaCosteo_().getSheetByName(SEMAFORO.hoja);
  if (!h) throw new Error('No existe la pestana ' + SEMAFORO.hoja + '. Corré refrescarSemaforoPrecios() primero.');
  if (h.getLastColumn() < SEMAFORO.colAprobar) return {};

  var datos = h.getRange(1, 1, h.getLastRow(), SEMAFORO.colAprobar).getValues();
  var out = {};
  for (var r = 0; r < datos.length; r++) {
    var f = datos[r];
    if (!esAprobable_(f[1])) continue;
    if (!estaTildado_(f[SEMAFORO.colAprobar - 1])) continue;
    var area = String(f[0] || '').trim();
    if (!out[area]) out[area] = [];
    out[area].push({ producto: String(f[2] || '').trim(), esperadoDe: f[3], esperadoA: f[4] });
  }
  return out;
}
