/**
 * Dashboard.gs — Los seis indicadores del Dashboard Operativo de Profit OS.
 *
 * EL LIMITE DEL PILAR: Profit OS va del insumo al plato — que cuesta, que deja, y
 * que tan confiable es esa medicion. Todo lo que meta planilla, alquiler, servicios
 * o resultado del mes es Finance & Data OS y NO va aca. Prime Cost, SPLH y costo
 * laboral quedan explicitamente afuera.
 *
 * CINCO DE SEIS salen de lo que ingenieriaDeMenu_() ya calcula, reagrupado para
 * contestar otra pregunta. Por eso este archivo casi no tiene matematica propia: si
 * la tuviera, el tablero y la pestana de al lado dirian dos cosas distintas del
 * mismo indicador.
 *
 * EL SEXTO —CMV real contra teorico— falta, y es el que convierte a Profit OS de un
 * ejercicio de recetario en una medicion del negocio. Necesita compras FEL y un
 * metodo para las de mercado. Se declara como pendiente EN LA PANTALLA en vez de
 * esconderlo: un tablero al que le falta el indicador que lo justifica tiene que
 * decirlo.
 *
 * TODO PORCENTAJE VA SOBRE VENTA NETA. Ver COSTEO.iva.
 *
 * DOS LLAMADAS Y NO UNA, a proposito:
 *   getDashboard()        los seis indicadores. Una pasada de ingenieriaDeMenu_().
 *   getAvisosDashboard()  la franja de avisos. Toca Drive, el catalogo del POS y el
 *                         cierre — lento y de otra naturaleza.
 * Juntarlas haria esperar los numeros por culpa de una lectura de Drive. La pantalla
 * pinta los seis y despues rellena los avisos.
 *
 * Solo LEE. Ninguna funcion de este archivo escribe una celda.
 */

var DASH = {
  /** Cuantas unidades mas al mes se asume por producto al valuar la palanca de sala. */
  udsExtraAlMes: 5,
  /** Cuantos productos se nombran en cada lista corta. */
  top: 3,
  /** Arriba de esto, el punto ciego deja de ser un detalle y pasa a ser el titular. */
  ciegoTolerable: 0.05
};

/* ==========================================================================
   LOS SEIS INDICADORES
   ========================================================================== */

/**
 * `semanas`: 4, 13 o 52. La misma ventana que la ingenieria de menu y por la misma
 * razon (multiplos enteros de semana; ver IM_VENTANAS en CosteoVista.html).
 */
function getDashboard(semanas) {
  var w = ventasYVentana_(semanas === undefined ? 13 : semanas);
  if (!w) return { ok: false, error: 'Todavia no hay ventas cargadas. Corré cargarVentasPorProducto().' };
  return tableroDesdeR_(ingenieriaDeMenu_(w.desde, w.hasta, w.ventas));
}

/**
 * Las DOS pantallas de una sola pasada.
 *
 * getDashboard y getIngenieriaMenu leian la hoja de ventas y clasificaban los 130
 * productos cada una por su cuenta: abrir el modulo y tocar la pestana de al lado
 * costaba 21 segundos de los 40 que midio DIAG_TABLERO. Aca se calcula una vez y se
 * reparte. La pantalla guarda las dos y la segunda pestana abre al instante.
 */
/**
 * LA HUELLA DE LOS DATOS. Dos celdas, y con eso alcanza para saber si el calculo
 * guardado sigue valiendo.
 *
 * Las ventas del POS solo cambian cuando alguien corre cargarVentasPorProducto(),
 * o sea los lunes; los costos, cuando alguien escribe algo, y TODA escritura deja
 * su marca en BITACORA. Asi que la ultima fila de SYNC_VENTAS y la ultima de
 * BITACORA, juntas, identifican el estado de los datos.
 *
 * Y el CATALOGO DEL POS, que es la tercera fuente: los precios y costos de barra
 * salen de ahi, y desde el 30-ago-2026 se resuelve solo —aparece un export nuevo y
 * la pantalla lo toma sin que nadie toque nada—. Sin el en la huella, exportar un
 * catalogo nuevo dejaba el tablero mostrando los costos viejos hasta seis horas,
 * que es exactamente el problema que resolver el catalogo solo vino a matar.
 *
 * Se hace asi y no con invalidaciones desperdigadas por los seis archivos que
 * escriben: una invalidacion que alguien se olvide de poner deja el tablero
 * mintiendo, y eso no se nota. Una huella no se puede olvidar.
 *
 * Si algo falla, devuelve vacio y el caller no cachea. Un tablero lento es un
 * problema; un tablero viejo es una mentira.
 */
/* La huella cuesta ~1.6 s: abre el libro, lee dos hojas y consulta Drive. Se
   recalculaba en CADA getProfitOS, y la pantalla llama una vez por ventana de
   semanas: cambiar el selector pagaba 1.6 s antes de mirar siquiera el cache.
   Con 60 s de memoria eso se paga una vez. El precio de esta memoria es que un
   cambio de precio tarda hasta un minuto en invalidar el tablero, que para un
   panel de gestion es intrascendente. */
var HUELLA_CACHE = { clave: 'huella_datos_v1', segs: 60 };

function huellaDatos_() {
  var c = CacheService.getScriptCache();
  var guardada = c.get(HUELLA_CACHE.clave);
  if (guardada) return guardada;
  var h = huellaDatosCalculada_();
  if (h) c.put(HUELLA_CACHE.clave, h, HUELLA_CACHE.segs);
  return h;
}

function huellaDatosCalculada_() {
  try {
    var ss = hojaCosteo_(), sello = '';
    var hv = ss.getSheetByName(VENTAS.hojaLog);
    sello += hv ? hv.getLastRow() + ':' + String(hv.getRange(hv.getLastRow(), 1).getValue()) : 'sv';
    var hb = ss.getSheetByName(EDIT.hojaBitacora);
    sello += '|' + (hb ? hb.getLastRow() + ':' + String(hb.getRange(hb.getLastRow(), 1).getValue()) : 'sb');
    // catalogoInfo_ y no catalogoPOS_: hace falta saber CUAL es, no abrirlo.
    var cat = catalogoInfo_();
    sello += '|' + cat.id + ':' + (cat.fecha ? cat.fecha.getTime() : 0);
    return Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sello)).slice(0, 16);
  } catch (e) { return ''; }
}

/**
 * Guarda y recupera el payload de getProfitOS. El cache de Apps Script topa en
 * 100 KB por clave, y este payload no entra: va partido en pedazos, con una clave
 * indice que dice cuantos son. Si algo del rescate no cuadra —falta un pedazo, no
 * parsea— se devuelve null y se recalcula: mejor tardar que servir a medias.
 */
var PROFIT_CACHE = { pref: 'profitos_v1_', segs: 21600, trozo: 90000, maxTrozos: 12 };

function profitGuardado_(clave) {
  var c = CacheService.getScriptCache();
  var n = c.get(clave);
  if (!n) return null;
  var claves = [];
  for (var i = 0; i < +n; i++) claves.push(clave + '_' + i);
  var partes = c.getAll(claves);
  var txt = '';
  for (var j = 0; j < +n; j++) {
    if (partes[clave + '_' + j] == null) return null;   // un pedazo vencio: no sirve
    txt += partes[clave + '_' + j];
  }
  try { return JSON.parse(txt); } catch (e) { return null; }
}

function profitGuardar_(clave, obj) {
  try {
    var txt = JSON.stringify(obj);
    var n = Math.ceil(txt.length / PROFIT_CACHE.trozo);
    if (n > PROFIT_CACHE.maxTrozos) return;             // demasiado grande: no se cachea
    var mapa = {};
    for (var i = 0; i < n; i++) {
      mapa[clave + '_' + i] = txt.substr(i * PROFIT_CACHE.trozo, PROFIT_CACHE.trozo);
    }
    var c = CacheService.getScriptCache();
    c.putAll(mapa, PROFIT_CACHE.segs);
    c.put(clave, String(n), PROFIT_CACHE.segs);         // el indice va ULTIMO
  } catch (e) { /* que no se pueda cachear no puede romper la pantalla */ }
}

function getProfitOS(auth, semanas) {
  exigirModulo_(auth, 'recetario');
  var sem = semanas === undefined ? 13 : semanas;
  var huella = huellaDatos_();
  var clave = huella ? PROFIT_CACHE.pref + sem + '_' + huella : '';
  if (clave) {
    var guardado = profitGuardado_(clave);
    if (guardado) { guardado.deCache = true; return guardado; }
  }
  var res = getProfitOSCalculado_(sem);
  if (clave && res.tablero && res.tablero.ok) profitGuardar_(clave, res);
  return res;
}

function getProfitOSCalculado_(semanas) {
  var w = ventasYVentana_(semanas === undefined ? 13 : semanas);
  if (!w) {
    var e = { ok: false, error: 'Todavia no hay ventas cargadas. Corré cargarVentasPorProducto().' };
    return { tablero: e, menu: e };
  }
  var r = ingenieriaDeMenu_(w.desde, w.hasta, w.ventas);
  return { tablero: tableroDesdeR_(r), menu: menuDesdeR_(r) };
}

/** El payload del tablero, a partir de un calculo YA HECHO. */
function tableroDesdeR_(r) {

  // --- 1. CMV teorico, global y por area.
  // El global va PONDERADO por la venta de cada area, no promediado: promediar un
  // area que vende cuatro veces mas que la otra da un numero que no existe.
  var tot = { costo: 0, ventaNeta: 0, contrib: 0, recup: 0, recupProd: 0,
              metaPorVenta: 0 };
  var porArea = {};
  ['COCINA', 'BARRA'].forEach(function (a) {
    var x = r.areas[a];
    var firmes = x.lista.filter(function (p) { return p.firme; });
    var costo = 0, ventaNeta = 0, metaPorVenta = 0, recup = 0, recupProd = 0;
    firmes.forEach(function (p) {
      costo += p.costo * p.uds;
      ventaNeta += p.precioNeto * p.uds;
      metaPorVenta += p.meta * p.precioNeto * p.uds;
      if (p.vsMeta > 0) { recup += p.vsMeta; recupProd++; }
    });
    porArea[a] = {
      cmv: ventaNeta ? costo / ventaNeta : 0,
      // La meta del area, ponderada por venta. Cocina es 30% y punto; barra tiene una
      // meta por categoria (un vino por botella no se mide como un coctel de autor),
      // asi que su "meta" es la mezcla real de lo que vendio, no un 20% de adorno.
      meta: ventaNeta ? metaPorVenta / ventaNeta : 0,
      contribucion: x.contribucion,
      recuperable: recup, recuperableProductos: recupProd,
      productos: x.productos, firmes: x.firmes,
      ventaNeta: ventaNeta, costo: costo
    };
    tot.costo += costo; tot.ventaNeta += ventaNeta; tot.contrib += x.contribucion;
    tot.recup += recup; tot.recupProd += recupProd; tot.metaPorVenta += metaPorVenta;
  });

  // --- 5. Oportunidad en sala.
  // Rompecabezas con al menos una venta al mes, valuados a DASH.udsExtraAlMes mas
  // al mes cada uno. Va al lado del recuperable a proposito: la palanca de sala pesa
  // casi lo mismo que toda la de costo junta, y un tablero que solo muestra costos
  // empuja a la gerencia hacia el lado equivocado.
  var sala = [], salaTotal = 0;
  ['COCINA', 'BARRA'].forEach(function (a) {
    r.areas[a].lista.forEach(function (p) {
      if (!p.firme || p.clase !== 'ROMPECABEZAS') return;
      if (p.udsAlMes < IMENU.ventaMinimaAlMes) return;
      var valor = p.mc * DASH.udsExtraAlMes * 12;
      salaTotal += valor;
      sala.push({ n: p.nombre, area: a, cat: p.categoria, valor: valor,
                  udsMes: p.udsAlMes, mc: p.mc });
    });
  });
  sala.sort(function (x, y) { return y.valor - x.valor; });

  // --- 4. La lista de trabajo, en quetzales.
  var fuera = [];
  ['COCINA', 'BARRA'].forEach(function (a) {
    r.areas[a].lista.forEach(function (p) {
      if (p.firme && p.vsMeta > 0) {
        fuera.push({ n: p.nombre, area: a, cat: p.categoria, valor: p.vsMeta,
                     cmv: p.cmv, meta: p.meta, uds: p.uds });
      }
    });
  });
  fuera.sort(function (x, y) { return y.valor - x.valor; });

  // --- 6. El punto ciego. VALIDA A LOS OTROS CINCO: con 18% a ciegas, el CMV es
  // "29.7% de lo que si sabemos medir". La venta va BRUTA arriba y abajo, asi que
  // el porcentaje no depende del IVA; el quetzal se rotula como bruto en pantalla.
  var ciegoVenta = 0, ciegoUds = 0, ciegoProd = 0, ventaBrutaClasificable = 0;
  ['COCINA', 'BARRA'].forEach(function (a) {
    r.areas[a].lista.forEach(function (p) {
      ventaBrutaClasificable += p.venta;
      if (!p.firme) { ciegoVenta += p.venta; ciegoUds += p.uds; ciegoProd++; }
    });
  });

  var cargado = ultimaCargaVentas_();

  return {
    ok: true,
    desde: r.desde, hasta: r.hasta, dias: r.dias, tickets: r.tickets,
    ventaBruta: r.venta, ventaNeta: tot.ventaNeta,
    cargadoEl: cargado.cuando, diasDesdeCarga: cargado.dias,

    cmv: {
      global: tot.ventaNeta ? tot.costo / tot.ventaNeta : 0,
      metaGlobal: tot.ventaNeta ? tot.metaPorVenta / tot.ventaNeta : 0,
      cocina: porArea.COCINA, barra: porArea.BARRA
    },
    contribucion: { total: tot.contrib,
                    cocina: porArea.COCINA.contribucion,
                    barra: porArea.BARRA.contribucion },
    recuperable: { total: tot.recup, productos: tot.recupProd,
                   top: fuera.slice(0, DASH.top), lista: fuera.slice(0, 12) },
    sala: { total: salaTotal, productos: sala.length,
            top: sala.slice(0, DASH.top), lista: sala.slice(0, 12) },
    ciego: {
      pctVenta: ventaBrutaClasificable ? ciegoVenta / ventaBrutaClasificable : 0,
      venta: ciegoVenta, uds: ciegoUds, productos: ciegoProd,
      tolerable: DASH.ciegoTolerable
    },
    // El indicador 2 no se calcula todavia y la pantalla lo dice. Ver el encabezado.
    real: { disponible: false,
            falta: 'Compras FEL del periodo y un metodo para las compras de mercado. ' +
                   'Los inventarios inicial y final ya los da el cierre mensual.' }
  };
}

/** Cuando se cargo el POS por ultima vez, y hace cuantos dias. */
function ultimaCargaVentas_() {
  try {
    var h = hojaCosteo_().getSheetByName(VENTAS.hojaLog);
    if (!h || h.getLastRow() < 2) return { cuando: '', dias: null };
    // CARGADO EL se escribe como texto 'yyyy-MM-dd HH:mm', pero Sheets lo guarda como
    // Date y al releerlo vuelve un objeto. String(Date) da "Thu Sep 10 2026 18:18:00
    // GMT-0600", la regex de abajo no lo reconocia y los dias desde la carga salian
    // null: el tablero no podia marcar en rojo un feed viejo.
    var v = h.getRange(h.getLastRow(), 1).getValue();
    var txt = Object.prototype.toString.call(v) === '[object Date]'
      ? Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd HH:mm')
      : String(v || '');
    var m = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { cuando: txt, dias: null };
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    var hoy = new Date();
    return { cuando: txt, dias: Math.floor((hoy - d) / 86400000) };
  } catch (e) { return { cuando: '', dias: null }; }
}

/* ==========================================================================
   LA FRANJA DE AVISOS

   No son indicadores: son cosas que hay que atender esta semana. Una linea cada
   una, y solo aparecen si hay algo. Un aviso que siempre esta se deja de mirar —
   la misma razon por la que el semaforo no cuenta NO CONFIGURADA como rojo.

   Van en una llamada aparte de los seis indicadores porque tocan Drive, el
   catalogo del POS y el cierre. Cada uno se envuelve en su propio try: que la
   carpeta de Drive no responda no puede dejar sin avisos a los otros tres.
   ========================================================================== */

/* LOS AVISOS SE CACHEAN 30 MINUTOS.
   Medidos el 10-sep-2026: 10.59 s en total, de los cuales avisoExports_ se lleva
   7.26 s recorriendo Drive. Van encadenados despues de los numeros, asi que no
   retrasan el primer pintado, pero la pantalla se queda otros diez segundos
   trabajando y eso es lo que se siente como "sigue lenta".
   Son avisos de mantenimiento —exports sin cargar, platos sin ficha—, no cifras
   en vivo: media hora de desactualizacion no cambia ninguna decision. Y el aviso
   que mas molesta, el de los exports, lo borra cargarVentasPorProducto() al
   terminar, que es justo la accion que lo resuelve: desaparece en el acto y no
   media hora despues. */
var AVISOS_CACHE = { clave: 'avisos_dash_v1', segs: 1800 };

/** La borra quien resuelve un aviso, para que no quede colgado media hora. */
function olvidarAvisosDashboard_() {
  try { CacheService.getScriptCache().remove(AVISOS_CACHE.clave); } catch (e) {}
}

function getAvisosDashboard(auth) {
  exigirModulo_(auth, 'recetario');
  var c = CacheService.getScriptCache();
  try {
    var guardado = c.get(AVISOS_CACHE.clave);
    if (guardado) {
      var r = JSON.parse(guardado);
      r.deCache = true;
      return r;
    }
  } catch (e) { /* cache invalido: se recalcula */ }

  var res = getAvisosDashboardCalculado_();
  try {
    var txt = JSON.stringify(res);
    if (txt.length < 90000) c.put(AVISOS_CACHE.clave, txt, AVISOS_CACHE.segs);
  } catch (e) { /* si no cabe, no se cachea: no es motivo para fallar */ }
  return res;
}

function getAvisosDashboardCalculado_() {
  var avisos = [];
  [avisoPrecios_, avisoExports_, avisoSinFicha_, avisoCierre_].forEach(function (f) {
    try {
      var a = f();
      if (a) avisos.push(a);
    } catch (e) {
      avisos.push({ clave: 'error', nivel: 'error',
                    texto: 'Un aviso no se pudo calcular: ' + String(e && e.message || e),
                    detalle: [] });
    }
  });
  return { ok: true, avisos: avisos };
}

/**
 * 1. Precios del POS que no coinciden con el recetario.
 *
 * EL DOCUMENTO PIDE compararlos "contra el precio vigente en la fecha de la venta,
 * no contra el de hoy". Eso hoy NO SE PUEDE del todo: el historial de precios de
 * carta vive en BITACORA, que arranco el 24-ago-2026. Para una venta de enero no
 * hay historial y el unico precio conocido es el de hoy — justo lo que el documento
 * quiere evitar.
 *
 * Asi que el aviso compara contra el precio actual y LO DICE. Cuando la bitacora
 * acumule meses, este aviso mejora solo sin tocar nada mas.
 */
function avisoPrecios_() {
  // verificarNombresPOS EXIGE el id del catalogo: llamarla sin argumento tira
  // "Cannot read properties of undefined". Si la propiedad falta, el aviso lo dice
  // en vez de reventar y dejar sin franja a los otros tres.
  var id = PropertiesService.getScriptProperties().getProperty('POS_CATALOGO_SHEET_ID');
  if (!id) {
    return { clave: 'precios', nivel: 'info',
             texto: 'No se puede comparar precios con el POS: falta POS_CATALOGO_SHEET_ID.',
             detalle: [] };
  }
  // OJO: verificarNombresPOS llama a mapaPOS_(TRUE) por dentro, o sea que TIRA el
  // cache del mapa y lo reconstruye. Eso esta bien en un diagnostico que se corre a
  // mano; aca lo paga la pantalla en cada carga, y ademas deja el cache frio para
  // todo lo que venga despues. Se vuelve a calentar aca mismo para que la proxima
  // llamada no pague la reconstruccion otra vez.
  var r = verificarNombresPOS(id);        // solo lee y devuelve {ok, rotos, precios}
  var n = (r.precios || []).length;
  if (!n) return null;
  return {
    clave: 'precios',
    nivel: 'alerta',
    texto: n + (n === 1 ? ' plato tiene' : ' platos tienen') +
           ' un precio distinto en el POS y en el recetario.',
    nota: 'Comparado contra el precio de HOY: la bitácora de precios de carta ' +
          'empezó el 24-ago-2026 y todavía no cubre las ventas viejas.',
    detalle: r.precios.slice(0, 8)
  };
}

/** 2. Exports que estan en la carpeta de Drive y todavia no se cargaron. */
function avisoExports_() {
  var enDrive = ventasArchivosEnDrive_();
  var yaEstan = ventasYaCargados_();
  var pend = enDrive.filter(function (a) { return !yaEstan[a.id]; });
  if (!pend.length) return null;
  return {
    clave: 'exports',
    nivel: 'accion',
    texto: pend.length + (pend.length === 1 ? ' export del POS está' : ' exports del POS están') +
           ' en Drive sin cargar. Corré cargarVentasPorProducto().',
    detalle: pend.slice(0, 8).map(function (a) { return a.nombre + '  (' + a.carpeta + ')'; })
  };
}

/**
 * 3. Platos que el POS vende y no tienen ficha.
 * Sale del MAPA POS, que ya los marca a mano: SIN FICHA y ALTA. No se adivina.
 */
function avisoSinFicha_() {
  var m = mapaPOS_();
  var lista = (m.sinFicha || []).concat(m.alta || []);
  if (!lista.length) return null;
  return {
    clave: 'sinficha',
    nivel: 'alerta',
    texto: lista.length + (lista.length === 1 ? ' plato del POS no tiene ficha' :
                                                ' platos del POS no tienen ficha') +
           ': se venden sin costo y no entran a la matriz.',
    detalle: lista.slice(0, 8).map(function (x) { return String(x.pos || x); })
  };
}

/**
 * 4. Precios del ultimo cierre con movimientos sospechosos.
 *
 * Lee la pestana SEMAFORO_PRECIOS, que ya calculo refrescarSemaforoPrecios(). NO
 * recalcula: el semaforo abre el archivo del cierre y eso tarda, y este aviso se
 * pinta junto a otros tres. Si la pestana no existe todavia, el aviso lo dice en
 * vez de romperse.
 */
function avisoCierre_() {
  var h = hojaCosteo_().getSheetByName(SEMAFORO.hoja);
  if (!h || h.getLastRow() < 2) {
    return { clave: 'cierre', nivel: 'info',
             texto: 'El semáforo de precios nunca se ha refrescado. Corré refrescarSemaforoPrecios().',
             detalle: [] };
  }
  // La hoja son bloques con encabezado. Se cuentan las filas que traen un producto y
  // un porcentaje: no se asume ni el orden de los bloques ni el numero de columnas.
  var filas = h.getDataRange().getValues(), revisar = [];
  filas.forEach(function (f) {
    var estado = String(f[0] || '').trim().toUpperCase();
    if (estado !== 'REVISAR') return;
    revisar.push(f.slice(1, 5).filter(function (c) { return c !== '' && c != null; }).join(' · '));
  });
  if (!revisar.length) return null;
  return {
    clave: 'cierre',
    nivel: 'alerta',
    texto: revisar.length + (revisar.length === 1 ? ' precio del último cierre se movió' :
                                                    ' precios del último cierre se movieron') +
           ' más de lo esperable. Revisalos antes de aplicar el sync.',
    detalle: revisar.slice(0, 8)
  };
}
