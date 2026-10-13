/**
 * CAJA CHICA (13-oct-2026). Reemplaza al Excel "Caja Rosanta" (jun–oct 2026). Profit OS › Pagos.
 *
 * Es el efectivo que queda en el restaurante: entra la venta en efectivo y de ahi se pagan
 * facturas, mercado, extras y lo que surja. Maco es el encargado (Juanma, 13-oct-2026).
 * El Excel se escribia a mano: el ingreso del dia, los pagos y un comentario. Esta pantalla
 * hace tres cosas que el Excel no hacia:
 *   1. La venta en efectivo NO se escribe: sale del cierre de PosFile de esa noche
 *      (CierresDiarios.gs). Lo unico que se anota a mano son las CORRECCIONES del cierre
 *      (una cuenta cerrada en efectivo que se cobro con tarjeta, o al reves), con su ticket.
 *   2. Cada noche Maco CUENTA la caja. La diferencia con lo esperado es el descuadre, y la
 *      pantalla busca la causa probable (_cchPistas_): un documento del cierre del mismo
 *      monto, un pago de caja anotado otro dia, los gastos del POS, o el descuadre del dia
 *      anterior que se compensa.
 *   3. Una factura pagada de la caja se marca aca y sale de Pagos › Por pagar (se guarda
 *      como "Pagado de caja" en PAGOS_PROVEEDORES: un solo lugar, no se cuenta dos veces).
 *      Lo marcado "Pagado de caja" desde Pagos tambien aparece aca solo.
 *
 * Decisiones de Juanma (13-oct-2026):
 *  - Se cuenta TODAS las noches.
 *  - El arranque es el ultimo dia del Excel, como CONFIRMADO (CCH_ARRANQUE_). De ahi en
 *    adelante los dias salen de los cierres de PosFile y quedan "por verificar" hasta que
 *    Maco cuenta.
 *  - Lo que sale de la caja va al maestro (pestaña CCH_HOJA_MAESTRO_, se llena sola) y de
 *    ahi al DRE (FIN_LIBROS). Las facturas van como PAGO_FACTURA_FEL (ya cuentan por el
 *    FEL) y el mercado como compra sin factura.
 *
 * El registro vive en la pestaña CAJA_CHICA de Rosanta_Intranet_Config. Una fila por
 * movimiento, nunca se borra: un error se marca ANULADO en ESTATUS.
 *
 * AMBITO GLOBAL: todo empieza con cch / _cch; lo privado termina en guion bajo.
 */

var CCH_HOJA_ = 'CAJA_CHICA';
var CCH_COLS_ = ['FECHA', 'TIPO', 'CATEGORIA', 'CONCEPTO', 'MONTO', 'REFERENCIA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'];
var CCH_HOJA_MAESTRO_ = '07_Caja_Chica';
// Ultimo dia del Excel "Caja Rosanta" con movimiento (pestaña Octubre): saldo al cierre del
// 10-oct = 117 inicial − 45 + 1,680 − 90 − 200 + 341 − 65 + 627 − 250 − 254 = Q1,861. El
// dueño lo puede reemplazar con un movimiento ARRANQUE (por ejemplo, despues de un conteo).
var CCH_ARRANQUE_ = { fecha: '2026-10-10', saldo: 1861, nota: 'Saldo final del Excel Caja Rosanta (10-oct-2026).' };
var CCH_TOLERANCIA_ = 1;   // Q1: menos que eso es redondeo, no descuadre
// Los tipos de movimiento. MONTO siempre positivo salvo CORRECCION (con signo: + entra a la caja).
//   SALIDA          un pago desde la caja que no es una factura del FEL
//   ENTRADA         efectivo que entra y no es venta (anticipo de un evento, reposicion del fondo)
//   CORRECCION      ajuste del efectivo del cierre: una cuenta cerrada con la forma de pago equivocada
//   CONTEO          lo que Maco conto al cerrar (el ultimo del dia manda)
//   EFECTIVO_CIERRE el efectivo del cierre escrito a mano, cuando el correo no llego o no se leyo
//   ACEPTADO        el dueño acepta un descuadre que no se pudo explicar (monto con signo)
//   ARRANQUE        el saldo confirmado de un dia, desde el que se calcula (solo el dueño)
var CCH_TIPOS_ = ['SALIDA', 'ENTRADA', 'CORRECCION', 'CONTEO', 'EFECTIVO_CIERRE', 'ACEPTADO', 'ARRANQUE'];
var CCH_SOLO_DUENO_ = ['ACEPTADO', 'ARRANQUE'];
// Las categorias de una salida, con su categoria del maestro. Medidas en los comentarios del
// Excel de junio a octubre. 'cocina' y 'barra' son compras sin factura: van a Pagos › Sin
// factura (las ve el food cost) y no a CAJA_CHICA. pref: el texto que el DRE necesita para
// ubicarla (_finDreDe_ separa la basura; la nomina toma los extras como "bonos").
var CCH_CATS_ = [
  { k: 'cocina', t: 'Compra de cocina sin factura', cat: 'ALIMENTOS_EFECTIVO', area: 'COCINA' },
  { k: 'barra', t: 'Compra de barra sin factura', cat: 'BEBIDAS_EFECTIVO', area: 'BARRA' },
  { k: 'personal', t: 'Extras y bonos de personal', cat: 'NOMINA', pref: 'EXTRA DE PERSONAL' },
  { k: 'mantenimiento', t: 'Mantenimiento y jardín', cat: 'MANTENIMIENTO' },
  { k: 'limpieza', t: 'Limpieza y desechables', cat: 'SUMINISTRO DE LIMPIEZA' },
  { k: 'basura', t: 'Extracción de basura', cat: 'SERVICIOS_PUBLICOS', pref: 'BASURA' },
  { k: 'evento', t: 'Insumos y decoración de evento', cat: 'EVENTOS' },
  { k: 'reintegro', t: 'Reintegro a un cliente', cat: 'REINTEGRO_CLIENTE' },
  { k: 'deposito', t: 'Depósito al banco', cat: 'TRANSFERENCIA' },
  { k: 'otro', t: 'Otro', cat: 'GASTOS_VARIOS' }
];
var CCH_CAT_MERCADO_ = { COCINA: 'ALIMENTOS_EFECTIVO', BARRA: 'BEBIDAS_EFECTIVO', ADMIN: 'GASTOS_VARIOS' };

/** Quien entra: Maco (sala) y el dueño. El chef no lleva la caja. */
function cchQuien_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  if (rol !== 'dueno' && !(rol === 'sala' && usuarioTieneModulo(u, 'pagos'))) throw new Error('La caja chica la lleva Maco. Pedile al dueño si necesitás verla.');
  return { u: u, rol: rol, areas: PAG_AREAS_ROL_[rol], nombre: u.nombre || u.email || '' };
}

function cchHoja_(crear) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(CCH_HOJA_);
  if (!sh && crear) {
    sh = ss.insertSheet(CCH_HOJA_);
    sh.getRange(1, 1, 1, CCH_COLS_.length).setValues([CCH_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');   // la fecha como texto AAAA-MM-DD
    sh.getRange('I:I').setNumberFormat('@');   // el ID como texto (ver _pagEscribir_)
  }
  return sh;
}

/** Los movimientos anotados, sin los anulados. */
function cchMovimientos_() {
  var sh = cchHoja_(false);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var ix = {}; CCH_COLS_.forEach(function (c) { ix[c] = H.indexOf(c); });
  var out = [];
  for (var r = 1; r < v.length; r++) {
    if (/^ANULADO/i.test(String(v[r][ix.ESTATUS] || ''))) continue;
    var d = pagDia_(v[r][ix.FECHA]), tipo = String(v[r][ix.TIPO] || '').trim().toUpperCase();
    if (!d || CCH_TIPOS_.indexOf(tipo) === -1) continue;
    out.push({ id: String(v[r][ix.ID] || ''), fecha: pagIso_(d), tipo: tipo, categoria: String(v[r][ix.CATEGORIA] || '').trim(),
               concepto: String(v[r][ix.CONCEPTO] || ''), q: _finR_(_finNum_(v[r][ix.MONTO])),
               ref: String(v[r][ix.REFERENCIA] || ''), por: String(v[r][ix['ESCRITO POR']] || ''), orden: r });
  }
  return out;
}

/** Lo pagado "Pagado de caja" en Pagos: facturas y compras sin factura. */
function cchPagosCaja_() {
  return pagMovimientos_().filter(function (m) { return m.estatus === 'Pagado de caja' && m.fecha_pagado; }).map(function (m) {
    return { id: m.id, fecha: m.fecha_pagado, q: m.q, proveedor: m.proveedor, dte: m.dte, area: m.area,
             mercado: m.dte === PAG_SIN_FACTURA_, detalle: m.detalle, por: m.por };
  });
}

function _cchMasDia_(iso, n) {
  var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}
function _cchDdMm_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function _cchQ_(n) { return 'Q' + (Math.round(Math.abs(n) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/**
 * El calculo, puro (la prueba lo corre en Node). Cada dia desde el arranque hasta hoy:
 *   inicial + efectivo del cierre ± correcciones + entradas − pagos = ESPERADO
 *   CONTADO − ESPERADO = diferencia. El dia siguiente arranca de lo contado (o de lo
 *   esperado si no se conto): un descuadre se ve en SU dia y no se arrastra.
 * o = { arranque: {fecha, saldo, nota}, hoy: 'AAAA-MM-DD', cierres: {iso: cierre},
 *       movs: cchMovimientos_(), pagos: cchPagosCaja_() }
 */
function cchCalcular_(o) {
  var movs = o.movs || [], pagos = o.pagos || [], cierres = o.cierres || {};
  var arr = { fecha: o.arranque.fecha, saldo: o.arranque.saldo, nota: o.arranque.nota, origen: 'Excel' };
  movs.filter(function (m) { return m.tipo === 'ARRANQUE'; }).forEach(function (m) {
    if (m.fecha >= arr.fecha) arr = { fecha: m.fecha, saldo: m.q, nota: m.concepto, origen: m.por || 'dueño' };
  });
  var porDia = function (lista, f) { return lista.filter(function (x) { return x.fecha === f; }); };
  var suma = function (l) { return _finR_(l.reduce(function (a, x) { return a + x.q; }, 0)); };
  var dias = [], saldo = arr.saldo;
  for (var f = _cchMasDia_(arr.fecha, 1); f <= o.hoy; f = _cchMasDia_(f, 1)) {
    var mv = porDia(movs, f), pg = porDia(pagos, f), c = cierres[f] || null;
    var de = function (t) { return mv.filter(function (m) { return m.tipo === t; }); };
    var manual = de('EFECTIVO_CIERRE'), conteos = de('CONTEO');
    var efectivo = manual.length ? manual[manual.length - 1].q : (c ? c.efectivo : null);
    var fuente = manual.length ? 'escrito a mano' : c ? (c.cuadra ? 'cierre' : 'cierre que no cuadra') : null;
    var facturas = pg.filter(function (p) { return !p.mercado; }), mercado = pg.filter(function (p) { return p.mercado; });
    var otras = de('SALIDA');
    var D = { fecha: f, inicial: _finR_(saldo), efectivo: efectivo, fuente: fuente,
              cierre: c ? { total: c.gran_total, tarjeta: c.tarjeta, efectivo: c.efectivo, cuadra: c.cuadra, gastos_pos: c.gastos_pos } : null,
              correcciones: suma(de('CORRECCION')), entradas: suma(de('ENTRADA')),
              pagos_facturas: suma(facturas), pagos_mercado: suma(mercado), pagos_otros: suma(otras),
              aceptado: suma(de('ACEPTADO')), movs: mv, pagos: pg, pistas: [] };
    D.salidas = _finR_(D.pagos_facturas + D.pagos_mercado + D.pagos_otros);
    D.esperado = _finR_(D.inicial + (efectivo || 0) + D.correcciones + D.entradas - D.salidas);
    D.contado = conteos.length ? conteos[conteos.length - 1].q : null;
    D.diferencia = D.contado === null ? null : _finR_(D.contado - D.esperado);
    var abierta = D.diferencia === null ? null : _finR_(D.diferencia - D.aceptado);
    if (D.contado !== null && abierta !== null && Math.abs(abierta) > CCH_TOLERANCIA_) D.estado = abierta < 0 ? 'Faltante' : 'Sobrante';
    else if (D.contado !== null && efectivo === null) D.estado = 'Falta el cierre';
    else if (D.contado !== null) D.estado = Math.abs(D.aceptado) > 0.005 ? 'Diferencia aceptada' : 'Cuadra';
    else if (f === o.hoy) D.estado = 'En curso';
    else if (efectivo === null) D.estado = 'Falta el cierre';
    else D.estado = 'Sin conteo';
    D.abierta = (D.estado === 'Faltante' || D.estado === 'Sobrante') ? abierta : 0;
    dias.push(D);
    saldo = D.contado !== null ? D.contado : D.esperado;
  }
  dias.forEach(function (D, i) { D.pistas = _cchPistas_(D, dias.slice(Math.max(0, i - 3), i), pagos, cierres[D.fecha]); });
  var ult = dias.length ? dias[dias.length - 1] : null, conteos = dias.filter(function (D) { return D.contado !== null; });
  var abiertos = dias.filter(function (D) { return D.abierta; });
  return {
    arranque: arr, dias: dias,
    resumen: {
      saldo: ult ? (ult.contado !== null ? ult.contado : ult.esperado) : arr.saldo,
      ultimo_conteo: conteos.length ? { fecha: conteos[conteos.length - 1].fecha, q: conteos[conteos.length - 1].contado } : null,
      descuadres: abiertos.length,
      faltante: _finR_(-abiertos.filter(function (D) { return D.abierta < 0; }).reduce(function (a, D) { return a + D.abierta; }, 0)),
      sobrante: _finR_(abiertos.filter(function (D) { return D.abierta > 0; }).reduce(function (a, D) { return a + D.abierta; }, 0)),
      sin_conteo: dias.filter(function (D) { return D.estado === 'Sin conteo'; }).length,
      sin_cierre: dias.filter(function (D) { return D.estado === 'Falta el cierre'; }).length
    }
  };
}

/**
 * La causa probable de un descuadre. Son los cuatro errores que aparecen en los comentarios
 * del Excel de junio a octubre: una cuenta cerrada con la forma de pago equivocada (Q1,100 el
 * 1-oct, Q198 el 8-oct, Q115 el 2-sep, Q748 el 19-jun), un pago anotado otro dia, una venta
 * que entro al dia siguiente (29 y 30-ago) y los gastos anotados en el POS.
 */
function _cchPistas_(D, previos, pagos, cierre) {
  var out = [], x = D.abierta;
  if (cierre && cierre.gastos_pos > CCH_TOLERANCIA_ && Math.abs(cierre.gastos_pos - D.salidas) > CCH_TOLERANCIA_) {
    out.push('El POS registró ' + _cchQ_(cierre.gastos_pos) + ' en gastos y aquí hay ' + _cchQ_(D.salidas) + ' de pagos anotados.');
  }
  if (!x) return out;
  var cerca = function (q) { return Math.abs(Math.abs(q) - Math.abs(x)) <= CCH_TOLERANCIA_; };
  ((cierre && cierre.documentos) || []).filter(function (d) { return cerca(d.q); }).slice(0, 3).forEach(function (d) {
    out.push(x < 0
      ? 'El documento ' + d.n + ' (' + _cchQ_(d.q) + ') pudo cerrarse en efectivo y cobrarse con tarjeta. Si fue así, anotá una corrección de −' + _cchQ_(d.q) + '.'
      : 'El documento ' + d.n + ' (' + _cchQ_(d.q) + ') pudo cerrarse con tarjeta y cobrarse en efectivo. Si fue así, anotá una corrección de +' + _cchQ_(d.q) + '.');
  });
  pagos.filter(function (p) {
    var dd = Math.abs(Date.parse(p.fecha) - Date.parse(D.fecha)) / 86400000;
    return cerca(p.q) && (x < 0 ? (p.fecha !== D.fecha && dd <= 3) : p.fecha === D.fecha);
  }).slice(0, 3).forEach(function (p) {
    out.push(x < 0
      ? 'Hay un pago de caja de ' + _cchQ_(p.q) + ' a ' + p.proveedor + ' anotado el ' + _cchDdMm_(p.fecha) + '. ¿Salió de la caja este día?'
      : 'El pago de ' + _cchQ_(p.q) + ' a ' + p.proveedor + ' está anotado este día. ¿Salió de la caja otro día?');
  });
  previos.filter(function (P) { return P.abierta && Math.abs(P.abierta + x) <= CCH_TOLERANCIA_; }).forEach(function (P) {
    out.push('Compensa el ' + (P.abierta > 0 ? 'sobrante' : 'faltante') + ' de ' + _cchQ_(P.abierta) + ' del ' + _cchDdMm_(P.fecha) +
             ': puede ser una venta o un pago anotado en el día equivocado.');
  });
  if (!out.length && Math.abs(x) >= 50 && Math.round(Math.abs(x)) % 50 === 0) out.push('Es un monto redondo: revisá si falta anotar un pago o un vuelto.');
  return out;
}

/** Todo lo de la pantalla. sincronizar: escribir la pestaña del maestro si cambio. */
function cchEstado_(sincronizar) {
  var cierres = {};
  try { cierres = cieTodos_(); } catch (e) { cierres = {}; }
  var E = cchCalcular_({ arranque: CCH_ARRANQUE_, hoy: medFechaIso_(new Date()), cierres: cierres,
                         movs: cchMovimientos_(), pagos: cchPagosCaja_() });
  if (sincronizar) {
    try { E.maestro = cchSincronizarMaestro_(E); } catch (eM) { E.aviso_maestro = 'No pude escribir ' + CCH_HOJA_MAESTRO_ + ' en el maestro: ' + eM.message; }
  }
  return E;
}

/** Las filas del maestro: todo lo que salio de la caja desde el arranque, con su categoria. */
function cchFilasMaestro_(E) {
  var filas = [], cats = {};
  CCH_CATS_.forEach(function (c) { cats[c.k] = c; });
  E.dias.forEach(function (D) {
    D.pagos.forEach(function (p) {
      filas.push([D.fecha, (p.mercado ? 'Compra sin factura · ' + p.proveedor + (p.detalle ? ': ' + p.detalle : '') : 'Factura ' + p.dte + ' · ' + p.proveedor),
                  p.q, '', p.mercado ? (CCH_CAT_MERCADO_[p.area] || 'GASTOS_VARIOS') : 'PAGO_FACTURA_FEL', 'No', 'Pagos', p.id]);
    });
    D.movs.filter(function (m) { return m.tipo === 'SALIDA'; }).forEach(function (m) {
      var c = cats[m.categoria] || cats.otro;
      filas.push([D.fecha, (c.pref ? c.pref + ' · ' : '') + c.t + ' · ' + m.concepto, m.q, '', c.cat, 'No', 'Caja chica', m.id]);
    });
  });
  return filas;
}

/**
 * La pestaña 07_Caja_Chica del maestro, con las columnas de las tarjetas (FIN_LIBROS:
 * fecha · descripcion · monto · USD · categoria · Es_Personal). Se reescribe entera, y solo
 * cuando cambia: la huella queda en las propiedades del script.
 */
function cchSincronizarMaestro_(E) {
  var filas = cchFilasMaestro_(E), huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(filas)));
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID), sh = ss.getSheetByName(CCH_HOJA_MAESTRO_);
  if (sh && props.getProperty('CCH_HUELLA_MAESTRO') === huella) return { filas: filas.length, escrito: false };
  if (!sh) sh = ss.insertSheet(CCH_HOJA_MAESTRO_);
  sh.getRange(1, 1, 4, 8).setValues([
    ['CAJA CHICA · lo que salió del efectivo del restaurante', '', '', '', '', '', '', ''],
    ['Se llena sola desde la intranet (Profit OS › Pagos › Caja chica): no escribir acá. Las facturas van como PAGO_FACTURA_FEL porque ya cuentan por el FEL; el mercado como compra sin factura.', '', '', '', '', '', '', ''],
    ['Arranque: ' + E.arranque.fecha + ' con ' + _cchQ_(E.arranque.saldo) + ' (' + E.arranque.nota + ')', '', '', '', '', '', '', ''],
    ['Fecha', 'Descripción', 'Monto', 'USD', 'Categoría', 'Es_Personal', 'Origen', 'ID']]);
  sh.getRange(4, 1, 1, 8).setFontWeight('bold');
  var viejas = sh.getLastRow() - 4;
  if (viejas > 0) sh.getRange(5, 1, viejas, 8).clearContent();
  if (filas.length) {
    sh.getRange(5, 1, filas.length, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(5, 1, filas.length, 8).setValues(filas.map(function (r) {
      var p = r[0].split('-').map(Number);
      return [new Date(p[0], p[1] - 1, p[2], 12)].concat(r.slice(1));   // al mediodia: regla 10 de FinanzasDatos
    }));
  }
  SpreadsheetApp.flush();
  props.setProperty('CCH_HUELLA_MAESTRO', huella);
  return { filas: filas.length, escrito: true };
}

// ---------------------------------------------------------------- pantalla

/** La pantalla de la caja chica. */
function getCajaChica(auth) {
  var Q = cchQuien_(auth);
  var E = cchEstado_(true);
  return {
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm'), hoy: medFechaIso_(new Date()),
    rol: Q.rol, nombre: Q.nombre, arranque: E.arranque, resumen: E.resumen,
    dias: E.dias.slice().reverse(), categorias: CCH_CATS_.map(function (c) { return { k: c.k, t: c.t }; }),
    tolerancia: CCH_TOLERANCIA_, lectura_cierres: cieUltimaLectura_(),
    maestro: E.maestro || null, aviso_maestro: E.aviso_maestro || ''
  };
}

/** Las facturas por pagar de TODAS las areas: de la caja se paga cocina y barra. */
function getFacturasParaCaja(auth) {
  cchQuien_(auth);
  return pagEstado_().facturas.filter(function (f) { return f.saldo > 0.01; }).map(function (f) {
    return { llave: f.llave, proveedor: f.proveedor, dte: f.dte, fecha: f.fecha, saldo: f.saldo, total: f.total, grupo: f.grupo, estado: f.estado };
  }).sort(function (a, b) { return a.proveedor < b.proveedor ? -1 : a.proveedor > b.proveedor ? 1 : (a.fecha < b.fecha ? -1 : 1); });
}

function _cchFecha_(fecha, E) {
  fecha = _pagFechaValida_(fecha, 'Fecha');
  if (fecha > medFechaIso_(new Date())) throw new Error('La fecha ' + fecha + ' todavía no llegó.');
  if (fecha <= E.arranque.fecha) throw new Error('La caja arranca el ' + E.arranque.fecha + ' (' + E.arranque.nota + '). Lo de antes queda en el Excel.');
  return fecha;
}

function _cchEscribir_(filas) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = cchHoja_(true);
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var datos = filas.map(function (o) {
      o.ID = Utilities.getUuid().slice(0, 8); o.REGISTRADO = new Date();
      return H.map(function (h) { return o.hasOwnProperty(h) ? o[h] : ''; });
    });
    var desde = sh.getLastRow() + 1;
    sh.getRange(desde, 1, datos.length, 1).setNumberFormat('@');
    if (H.indexOf('ID') > -1) sh.getRange(desde, H.indexOf('ID') + 1, datos.length, 1).setNumberFormat('@');
    sh.getRange(desde, 1, datos.length, H.length).setValues(datos);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

/** Lo que Maco conto al cerrar la caja. */
function registrarConteoCaja(auth, fecha, contado, nota) {
  var Q = cchQuien_(auth), E = cchEstado_(false);
  fecha = _cchFecha_(fecha, E);
  if (contado === '' || contado == null || isNaN(Number(contado)) || Number(contado) < 0) throw new Error('Escribí cuánto contaste.');
  contado = _finR_(Number(contado));
  _cchEscribir_([{ FECHA: fecha, TIPO: 'CONTEO', MONTO: contado, CONCEPTO: String(nota || '').slice(0, 300), 'ESCRITO POR': Q.nombre }]);
  return getCajaChica(auth);
}

/**
 * Un movimiento de la caja que no es pagar una factura: SALIDA, ENTRADA, CORRECCION,
 * EFECTIVO_CIERRE; y del dueño, ACEPTADO y ARRANQUE. Una SALIDA de cocina o barra es una
 * compra sin factura: se guarda en Pagos (la ve el food cost) como "Pagado de caja".
 */
function registrarMovimientoCaja(auth, tipo, fecha, categoria, concepto, monto, referencia, proveedor) {
  var Q = cchQuien_(auth), E = cchEstado_(false);
  tipo = String(tipo || '').toUpperCase();
  if (CCH_TIPOS_.indexOf(tipo) === -1 || tipo === 'CONTEO') throw new Error('Movimiento desconocido: ' + tipo);
  if (CCH_SOLO_DUENO_.indexOf(tipo) !== -1 && Q.rol !== 'dueno') throw new Error('Eso lo hace el dueño.');
  fecha = tipo === 'ARRANQUE' ? _pagFechaValida_(fecha, 'Fecha') : _cchFecha_(fecha, E);
  if (monto === '' || monto == null || isNaN(Number(monto))) throw new Error('Escribí el monto.');
  monto = _finR_(Number(monto));
  if (tipo === 'CORRECCION' || tipo === 'ACEPTADO') { if (!monto) throw new Error('La corrección no puede ser cero.'); }
  else if (tipo === 'EFECTIVO_CIERRE' || tipo === 'ARRANQUE') { if (monto < 0) throw new Error('El monto no puede ser negativo.'); }
  else if (!(monto > 0)) throw new Error('Escribí el monto.');
  concepto = String(concepto || '').trim();
  referencia = String(referencia || '').trim();
  if (tipo === 'CORRECCION' && !referencia) throw new Error('Escribí el ticket o documento que se corrige.');
  if ((tipo === 'SALIDA' || tipo === 'ENTRADA' || tipo === 'ACEPTADO' || tipo === 'ARRANQUE') && concepto.length < 3) throw new Error('Escribí qué fue.');
  if (tipo === 'SALIDA') {
    var cat = CCH_CATS_.filter(function (c) { return c.k === categoria; })[0];
    if (!cat) throw new Error('Elegí la categoría del pago.');
    if (cat.area) {
      _pagEscribir_([{ AREA: cat.area, PROVEEDOR: String(proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado', DTE: PAG_SIN_FACTURA_,
                       'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': 'Pagado de caja',
                       DETALLE: (concepto + (referencia ? ' (' + referencia + ')' : '')).slice(0, 600), 'ESCRITO POR': Q.nombre }]);
      return getCajaChica(auth);
    }
    if (proveedor) concepto = String(proveedor).trim().slice(0, 80) + ': ' + concepto;
  }
  _cchEscribir_([{ FECHA: fecha, TIPO: tipo, CATEGORIA: tipo === 'SALIDA' ? categoria : '', CONCEPTO: concepto.slice(0, 300),
                   MONTO: monto, REFERENCIA: referencia.slice(0, 80), 'ESCRITO POR': Q.nombre }]);
  return getCajaChica(auth);
}

/** Paga una o varias facturas del mismo proveedor con el efectivo de la caja. Salen de Por pagar. */
function pagarFacturaDeCaja(auth, llaves, fecha, monto, nota) {
  var Q = cchQuien_(auth), E = cchEstado_(false);
  fecha = _cchFecha_(fecha, E);
  // De la caja se pagan facturas de cocina y de barra: Maco las ve todas aca.
  _pagRegistrarPago_({ nombre: Q.nombre, rol: Q.rol, areas: ['COCINA', 'BARRA', 'ADMIN'] }, llaves, 'Pagado de caja', fecha,
                     monto === '' || monto == null ? null : monto, 0, nota);
  return getCajaChica(auth);
}

/** Anula un movimiento de la caja. Maco anula lo suyo; el dueño, cualquiera. */
function anularMovimientoCaja(auth, id) {
  var Q = cchQuien_(auth);
  id = String(id || '').trim();
  if (!id) throw new Error('Falta el movimiento.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = cchHoja_(false);
    if (!sh) throw new Error('No hay movimientos.');
    var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
    var iId = H.indexOf('ID'), iE = H.indexOf('ESTATUS'), iP = H.indexOf('ESCRITO POR'), iT = H.indexOf('TIPO');
    var hallado = false;
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iId]) !== id) continue;
      hallado = true;
      if (/^ANULADO/i.test(String(v[r][iE] || ''))) break;
      if (Q.rol !== 'dueno' && (String(v[r][iP]) !== Q.nombre || CCH_SOLO_DUENO_.indexOf(String(v[r][iT])) !== -1)) throw new Error('Ese movimiento lo anotó ' + v[r][iP] + ': lo anula el dueño.');
      sh.getRange(r + 1, iE + 1).setValue('ANULADO (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')');
      SpreadsheetApp.flush();
      break;
    }
    if (!hallado) hallado = _cchAnularPagoDeCaja_(Q, id);
    if (!hallado) throw new Error('No encontré ese movimiento.');
  } finally { lock.releaseLock(); }
  return getCajaChica(auth);
}

/**
 * Un pago "Pagado de caja" de PAGOS_PROVEEDORES (factura o compra sin factura). Maco anula lo
 * que anoto el; el dueño, cualquiera. En Pagos, Maco solo podria anular lo de barra.
 * Corre dentro del candado de anularMovimientoCaja.
 */
function _cchAnularPagoDeCaja_(Q, id) {
  var sh = pagHoja_(false);
  if (!sh) return false;
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var iId = H.indexOf('ID'), iE = H.indexOf('ESTATUS DE PAGO'), iP = H.indexOf('ESCRITO POR');
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][iId]) !== id) continue;
    var est = String(v[r][iE] || '');
    if (est !== 'Pagado de caja') throw new Error('Ese movimiento no es un pago de caja: se anula en Pagos.');
    if (Q.rol !== 'dueno' && String(v[r][iP]) !== Q.nombre) throw new Error('Ese pago lo anotó ' + v[r][iP] + ': lo anula el dueño.');
    sh.getRange(r + 1, iE + 1).setValue('ANULADO: ' + est + ' (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')');
    SpreadsheetApp.flush();
    return true;
  }
  return false;
}

/** Leer ya los cierres de PosFile de los ultimos 20 dias (normalmente lo hace el vigia a las 6:00). */
function leerCierresCaja(auth) {
  cchQuien_(auth);
  var rep = cieLeer_(20), out = getCajaChica(auth);
  out.lectura_ahora = rep;
  return out;
}
