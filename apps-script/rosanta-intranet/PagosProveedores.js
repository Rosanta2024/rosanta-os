/**
 * PAGOS A PROVEEDORES (p213, 29-sep-2026). Reemplaza a COMPRAS_2026 desde el 5-oct-2026.
 *
 * El flujo va al reves que en el Excel: el FEL ya entra solo con el cargador de los
 * lunes, asi que la pantalla muestra las facturas que faltan pagar y Jeffry (cocina) o
 * Maco (barra) confirman con un toque eligiendo la forma de pago. Lo que no trae factura
 * (el mercado) se anota con su boton. De ahi sale el cuadre por proveedor.
 *
 * Decisiones de Juanma (29-sep-2026):
 *  - COMPRAS_2026 queda como historial de solo lectura; no se migra.
 *  - Entran las facturas desde el 28-sep-2026 (PAG_DESDE_). Lo anterior vive en el Excel.
 *    13-oct-2026 (Juanma): "todas las no pagadas deben aparecer". PAG_DESDE_ pasa al 1-ago y
 *    lo de antes del arranque (PAG_ARRANQUE_) que COMPRAS_2026 da por pagado cuenta como
 *    pagado (_pagPagadasCompras_). El banco casa el resto como siempre.
 *  - Modulo nuevo 'pagos'. El chef ve cocina, sala (Maco) ve barra, el dueño todo.
 *  - Las columnas son las del Excel: AREA · PROVEEDOR · DTE · FECHA DE PAGAR ·
 *    FECHA PAGADO · CANTIDAD PAGADA · ESTATUS DE PAGO.
 *  - Lo pagado por Banco queda provisorio hasta que entra el estado de cuenta, y se
 *    confirma solo cuando la casada es segura (ver _pagCasarBanco_). Lo dudoso lo ve el dueño.
 *
 * El registro vive en la pestaña PAGOS_PROVEEDORES de Rosanta_Intranet_Config. Una fila
 * por movimiento, nunca se borra: un error se marca ANULADO en el estatus.
 */
var PAG_HOJA_ = 'PAGOS_PROVEEDORES';
var PAG_COLS_ = ['AREA', 'PROVEEDOR', 'DTE', 'FECHA DE PAGAR', 'FECHA PAGADO', 'CANTIDAD PAGADA',
                 'ESTATUS DE PAGO', 'NIT', 'DETALLE', 'ESCRITO POR', 'REGISTRADO', 'ID'];
var PAG_DESDE_ = '2026-08-01';
// El dia que esta pantalla reemplazo a COMPRAS_2026: lo pagado antes se anoto alla.
var PAG_ARRANQUE_ = '2026-09-28';
// Formas de pago que se eligen con un toque.
// 'Retiro de cajero' tambien paga facturas (14-oct-2026): lo que se paga con el efectivo del cajero
// cuenta en el cuadre de Compras en efectivo (ComprasEfectivo.js).
var PAG_FORMAS_ = ['Pagado de caja', 'Tarjeta', 'Banco', 'Retiro de cajero', 'Pagó Maco', 'Pagó Jeffry'];
var PAG_FORMAS_MERCADO_ = ['Retiro de cajero', 'Pagado de caja', 'Tarjeta', 'Pagó Maco', 'Pagó Jeffry'];
var PAG_SIN_FACTURA_ = 'SIN FACTURA';
// El banco confirma una factura marcada "Banco" entre 3 dias antes y 45 despues de la marca,
// y una factura sin marcar si se emitio entre 45 dias antes y 10 despues del pago (regla 15).
var PAG_BANCO_ANTES_ = 3, PAG_BANCO_DESPUES_ = 45;
// La limpieza la paga cocina (Juanma, 29-sep-2026: Doorways y M.C. Industrial / Vijusa).
var PAG_AREA_CAT_ = { ALIMENTOS: 'COCINA', BEBIDAS: 'BARRA', COCTELERIA: 'BARRA', LICORES: 'BARRA', 'SUMINISTRO DE LIMPIEZA': 'COCINA' };
var PAG_AREAS_ROL_ = { chef: ['COCINA'], sala: ['BARRA'], dueno: ['COCINA', 'BARRA', 'ADMIN'] };
// El AREA que se ve es la del Excel (Juanma, 29-sep-2026: "formato parecido al del excel").
// El permiso sigue siendo cocina / barra / admin; esto solo agrupa la lista.
var PAG_GRUPO_CAT_ = { ALIMENTOS: 'ALIMENTOS', BEBIDAS: 'BEBIDAS Y COCTELERIA', COCTELERIA: 'BEBIDAS Y COCTELERIA',
  LICORES: 'BEBIDAS Y COCTELERIA', 'SUMINISTRO DE LIMPIEZA': 'MANTENIMIENTO Y LIMPIEZA',
  'MANTENIMIENTO Y ACCESORIOS EQUIPO': 'MANTENIMIENTO Y LIMPIEZA', GAS: 'GAS', EVENTOS: 'EVENTOS' };
var PAG_GRUPOS_ORDEN_ = ['ALIMENTOS', 'BEBIDAS Y COCTELERIA', 'GAS', 'MANTENIMIENTO Y LIMPIEZA', 'EVENTOS', 'ADMIN'];
// Una factura de antes de PAG_DESDE_ que sigue sin pagar se trae a mano (traerFacturaAnterior):
// la fila guarda el SALDO que falta en CANTIDAD PAGADA y la diferencia con el total cuenta
// como pagada antes. Asi entraron las de la pestaña SEMANA #19 de COMPRAS_2026 (29-sep-2026).
var PAG_ANTERIOR_ = 'Pendiente anterior';
// Facturas para reducir IVA (Juanma, 13-oct-2026): facturas a nombre de CORSAGA ajenas al
// giro, pedidas solo para el credito fiscal. El boton escribe FACTURA_AJENA en la Categoría
// de esa factura en 01_FEL_Maestro (pisa la formula de esa fila): sale de Pagos y del DRE
// (FIN_FUERA) y los reportes del maestro no la suman en ninguna categoria de gasto. El IVA lo
// sigue declarando el contador desde el FEL. La pestaña PAG_HOJA_IVA_ del maestro las lista.
var PAG_AJENA_ = 'FACTURA_AJENA';
var PAG_HOJA_IVA_ = '01c_FEL_Para_IVA';
var PAG_IVA_MARCA_ = 'Para IVA', PAG_IVA_DEVUELTA_ = 'Devuelta de Para IVA';
// Posibles pagos (13-oct-2026): un cargo del banco o de una tarjeta con el monto exacto de una
// factura (o de varias del mismo proveedor) que el cruce automatico no se atrevio a casar. El
// dueño lo confirma con un toque; la fila guarda la llave del pago para no ofrecerlo de nuevo.
var PAG_CONF_BANCO_ = 'Confirmado con banco';
// Un cargo del banco que el dueño marco "No pertenece" en Posibles pagos (14-oct-2026). Lleva "Banco"
// en el nombre a proposito: el Balance del año ignora esos estatus. DETALLE termina en "pago: <llave>".
var PAG_DESCARTADO_ = 'Banco: no pertenece';
// Las cuentas y tarjetas (los nombres que usa pagPagosBanco_ para cada cargo)
var PAG_MEDIOS_BANCO_ = ['Banco BI', 'Banco BAC'];
var PAG_MEDIOS_TARJETA_ = ['Tarjeta débito BI', 'Tarjeta crédito BI', 'Tarjeta crédito BAC'];
// Lo que José (Maco) y Jeffry pagan de su bolsa a proveedores y Rosanta les devuelve
// (Juanma, 13-oct-2026). Suma "Pagó X" (facturas y mercado) menos "Devuelto a X".
// La devolucion la anota el dueño; va con AREA ADMIN, asi solo el dueño la anula.
var PAG_EQUIPO_ = [{ nombre: 'José', forma: 'Pagó Maco', devuelto: 'Devuelto a Maco', rol: 'sala' },
                   { nombre: 'Jeffry', forma: 'Pagó Jeffry', devuelto: 'Devuelto a Jeffry', rol: 'chef' }];
// Proveedores sin factura que mas se usan, para el boton de mercado. Medido en las 19
// pestañas de 2026 de COMPRAS_2026 (29-sep-2026); arriba se suman los que ya se anotaron aca.
var PAG_PROV_MERCADO_ = ['Mercado', 'Carnicería Nueva Concepción', 'Mariscos', 'La Torre', 'La Bodegona',
  'Avícola Villa Lobos', 'Julio Hartman', 'Gas evento', 'Dollar City', 'Plásticos', 'Cemaco'];

/** Quien entra y que areas ve. Modulo 'pagos' (el dueño entra siempre). */
function pagQuien_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  if (rol !== 'dueno' && !usuarioTieneModulo(u, 'pagos')) throw new Error('Tu cuenta no tiene pagos.');
  var areas = PAG_AREAS_ROL_[rol];
  if (!areas) throw new Error('Pagos es para cocina, barra y el dueño.');
  if (_PAG_RELOJ_) _PAG_RELOJ_.quien(u.nombre || u.email || '');
  return { u: u, rol: rol, areas: areas, nombre: u.nombre || u.email || '' };
}

/** Una fecha de celda al dia, venga como Date (regla 10) o como texto AAAA-MM-DD o DD/MM/AAAA. */
function pagDia_(v) {
  if (_finEsFecha_(v)) { var d = _finDia_(v); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var s = String(v == null ? '' : v).trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function pagIso_(d) { return d ? medFechaIso_(d) : ''; }
function pagNumDia_(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function pagNit_(v) { return String(v == null ? '' : v).trim().replace(/\.0$/, '').toUpperCase(); }

function pagHoja_(crear) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(PAG_HOJA_);
  if (!sh && crear) {
    sh = ss.insertSheet(PAG_HOJA_);
    sh.getRange(1, 1, 1, PAG_COLS_.length).setValues([PAG_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // las fechas y el DTE como texto: la hoja no los convierte ni les come ceros
    sh.getRange('C:E').setNumberFormat('@');
  }
  return sh;
}

/*
 * Lo leido en ESTA ejecucion (14-oct-2026, Juanma: "el periodo de guardado es muy largo").
 * Guardar un pago armaba el estado dos veces (antes de escribir y para devolver la pantalla):
 * leia dos veces el FEL, los dos bancos y las dos tarjetas del maestro, y cuatro veces
 * PAGOS_PROVEEDORES. Ahora el maestro se lee una vez por ejecucion y los movimientos una vez
 * entre escritura y escritura. Toda escritura llama a _pagOlvidar_ (movs, o todo si toco el FEL).
 */
var _PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
function _pagOlvidar_(todo) {
  _PAG_LEIDO_.movs = null; _PAG_LEIDO_.escribio = true;
  if (todo) { _PAG_LEIDO_.hojas = {}; _PAG_LEIDO_.ss = null; }
}
function _pagMaestro_() { return _PAG_LEIDO_.ss || (_PAG_LEIDO_.ss = SpreadsheetApp.openById(FIN_MAESTRO_ID)); }
/** Los valores de una pestaña del maestro (null si no existe), una sola lectura por ejecucion. */
function _pagValores_(ss, nombre) {
  if (ss !== _PAG_LEIDO_.ss) { var sh0 = ss.getSheetByName(nombre); return sh0 ? sh0.getDataRange().getValues() : null; }
  if (!(nombre in _PAG_LEIDO_.hojas)) { var sh = ss.getSheetByName(nombre); _PAG_LEIDO_.hojas[nombre] = sh ? sh.getDataRange().getValues() : null; }
  return _PAG_LEIDO_.hojas[nombre];
}

/** Los movimientos anotados, sin los anulados. Copias: quien los use puede cambiarlos. */
function pagMovimientos_() {
  if (!_PAG_LEIDO_.movs) _PAG_LEIDO_.movs = _pagLeerMovimientos_();
  return _PAG_LEIDO_.movs.map(function (m) { return Object.assign({}, m); });
}
function _pagLeerMovimientos_() {
  var sh = pagHoja_(false);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var ix = {}; PAG_COLS_.forEach(function (c) { ix[c] = H.indexOf(c); });
  var out = [];
  for (var r = 1; r < v.length; r++) {
    var est = String(v[r][ix['ESTATUS DE PAGO']] || '').trim();
    if (!est || /^ANULADO/i.test(est)) continue;
    var fp = pagDia_(v[r][ix['FECHA PAGADO']]), fa = pagDia_(v[r][ix['FECHA DE PAGAR']]);
    out.push({
      fila: r + 1, id: String(v[r][ix.ID] || ''), area: String(v[r][ix.AREA] || '').trim().toUpperCase(),
      proveedor: String(v[r][ix.PROVEEDOR] || '').trim(), dte: String(v[r][ix.DTE] || '').trim(),
      nit: pagNit_(v[r][ix.NIT]), fecha_pagar: pagIso_(fa), fecha_pagado: pagIso_(fp),
      q: _finR_(_finNum_(v[r][ix['CANTIDAD PAGADA']])), estatus: est,
      detalle: String(v[r][ix.DETALLE] || ''), por: String(v[r][ix['ESCRITO POR']] || '')
    });
  }
  return out;
}

/** El area de mercaderia de cada NIT segun su historia en el FEL (la categoria que mas usa). */
function _pagAreaPorNit_(filas, iNit, iCat) {
  var cuenta = {};
  filas.forEach(function (f) {
    var a = PAG_AREA_CAT_[String(f[iCat] || '').trim()];
    if (!a) return;
    var n = pagNit_(f[iNit]);
    cuenta[n] = cuenta[n] || {}; cuenta[n][a] = (cuenta[n][a] || 0) + 1;
  });
  var out = {};
  Object.keys(cuenta).forEach(function (n) {
    out[n] = Object.keys(cuenta[n]).sort(function (a, b) { return cuenta[n][b] - cuenta[n][a]; })[0];
  });
  return out;
}

/** Las facturas desde PAG_DESDE_: ni anuladas ni personales, con su area. */
function pagFacturas_(ss, anteriores, ajenas, correo) {
  anteriores = anteriores || {};
  var v = _pagValores_(ss, '01_FEL_Maestro');
  var hi = -1;
  for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  if (hi < 0) throw new Error('No encontre el encabezado de 01_FEL_Maestro.');
  var H = v[hi].map(function (h) { return String(h || '').trim(); });
  var c = function (n) { var k = H.indexOf(n); if (k < 0) throw new Error('01_FEL_Maestro no tiene la columna ' + n); return k; };
  var iF = c('Fecha'), iS = c('Serie'), iN = c('Numero_DTE'), iNit = c('NIT_Emisor'), iNom = c('Nombre_Emisor'),
      iEst = c('Establecimiento'), iE = c('Estado'), iT = c('Gran_Total'), iC = c('Categoría'), iP = c('Es_Personal'),
      iTipo = H.indexOf('Tipo_DTE');
  var filas = v.slice(hi + 1), porNit = _pagAreaPorNit_(filas, iNit, iC);
  var desde = pagDia_(PAG_DESDE_), out = [], iIva = H.indexOf('IVA');
  filas.forEach(function (f, k) {
    var d = pagDia_(f[iF]);
    // Las de reducir IVA van a su lista (todo el año, sin importar PAG_DESDE_)
    if (ajenas && d && String(f[iC] || '').trim() === PAG_AJENA_ && String(f[iE] || '').trim() !== 'Anulado') {
      var nA = String(f[iN] || '').trim().replace(/\.0$/, '');
      ajenas.push({ llave: pagNit_(f[iNit]) + '|' + nA, nit: pagNit_(f[iNit]), dte: nA, fila: hi + k + 2, fecha: pagIso_(d),
        proveedor: String(f[iEst] || '').trim() || String(f[iNom] || '').trim(), total: _finR_(_finNum_(f[iT])),
        iva: iIva >= 0 ? _finR_(_finNum_(f[iIva])) : 0 });
    }
    var nitF = pagNit_(f[iNit]), numF = String(f[iN] || '').trim().replace(/\.0$/, '');
    if (!d || (d < desde && !anteriores[nitF + '|' + numF])) return;
    if (String(f[iE] || '').trim() === 'Anulado') return;
    if (String(f[iP] || '').trim() === 'Sí') return;
    var tipo = iTipo >= 0 ? String(f[iTipo] || '').trim().toUpperCase() : '';
    var total = _finR_(_finNum_(f[iT]));
    if (!(total > 0) || tipo === 'NCRE') return;   // las notas de credito no se pagan
    var nit = pagNit_(f[iNit]), cat = String(f[iC] || '').trim();
    if (cat === 'PERSONAL' || cat === 'FACTURA_AJENA') return;   // no las paga Rosanta
    // La comision de tarjeta tampoco se paga: el banco la descuenta del deposito de la
    // liquidacion. En Pagos quedaba Pendiente para siempre e inflaba la cantidad a pagar
    // (Juanma, 8-oct-2026). Sigue siendo gasto en el DRE (FinanzasDatos no lee este filtro).
    if (cat === 'COMISION TARJETA DE CREDITO') return;
    var numero = String(f[iN] || '').trim().replace(/\.0$/, '');
    out.push({
      llave: nit + '|' + numero, nit: nit, dte: numero, serie: String(f[iS] || '').trim(), fila: hi + k + 2,
      proveedor: String(f[iEst] || '').trim() || String(f[iNom] || '').trim(),
      razon: String(f[iNom] || '').trim(), fecha: pagIso_(d), dia: pagNumDia_(d), total: total, categoria: cat,
      area: PAG_AREA_CAT_[cat] || porNit[nit] || 'ADMIN',
      grupo: _pagGrupo_(cat, porNit[nit])
    });
  });
  // Las que SAT aviso por correo y el FEL del maestro todavia no trae (FelCorreo.js). La
  // llave mira TODAS las filas del FEL, anuladas incluidas: si el lunes entro, manda esa.
  if (correo && correo.length) {
    var enFel = {}, catNit = _pagCatPorNit_(filas, iNit, iC, iP);
    filas.forEach(function (f) { enFel[pagNit_(f[iNit]) + '|' + String(f[iN] || '').trim().replace(/\.0$/, '')] = 1; });
    correo.forEach(function (x) {
      var llave = x.nit + '|' + x.numero, h = catNit[x.nit] || { cat: '', personal: false };
      if (enFel[llave] || !x.fecha || x.fecha < desde) return;
      if (x.tipo === 'NCRE' || x.moneda !== 'GTQ' || !(x.total > 0)) return;   // los dolares entran con el FEL
      if (h.personal || ['PERSONAL', PAG_AJENA_, 'COMISION TARJETA DE CREDITO'].indexOf(h.cat) !== -1) return;
      enFel[llave] = 1;
      var cat = h.cat || 'POR CLASIFICAR';
      out.push({
        llave: llave, nit: x.nit, dte: x.numero, serie: x.serie, fila: null, por_correo: true,
        proveedor: x.establecimiento || x.nombre, razon: x.nombre, fecha: pagIso_(x.fecha), dia: pagNumDia_(x.fecha),
        total: x.total, categoria: cat, area: PAG_AREA_CAT_[cat] || porNit[x.nit] || 'ADMIN', grupo: _pagGrupo_(cat, porNit[x.nit])
      });
    });
  }
  return out;
}

/** El grupo que se ve (el del Excel) segun la categoria y el area de mercaderia del NIT. */
function _pagGrupo_(cat, areaNit) {
  var a = PAG_AREA_CAT_[cat] || areaNit;
  return PAG_GRUPO_CAT_[cat] || (a ? (a === 'BARRA' ? 'BEBIDAS Y COCTELERIA' : 'ALIMENTOS') : 'ADMIN');
}

/** La categoria que mas usa cada NIT en el FEL, y si la mayoria de sus facturas es personal. */
function _pagCatPorNit_(filas, iNit, iCat, iPers) {
  var c = {};
  filas.forEach(function (f) {
    var n = pagNit_(f[iNit]), k = String(f[iCat] || '').trim();
    if (!n) return;
    var x = c[n] = c[n] || { cats: {}, n: 0, pers: 0 };
    x.n++; if (String(f[iPers] || '').trim() === 'Sí') x.pers++;
    if (k && k !== 'POR_CLASIFICAR') x.cats[k] = (x.cats[k] || 0) + 1;
  });
  var out = {};
  Object.keys(c).forEach(function (n) {
    var x = c[n];
    out[n] = { cat: Object.keys(x.cats).sort(function (a, b) { return x.cats[b] - x.cats[a]; })[0] || '', personal: x.pers * 2 > x.n };
  });
  return out;
}

/** Los debitos del BI y del BAC desde unos dias antes de PAG_DESDE_, sin retiros de cajero. */
function pagPagosBanco_(ss) {
  var desde = pagNumDia_(pagDia_(PAG_DESDE_)) - 10, out = [];
  [['03_Banco_Industrial', 'Banco BI', 'Débito'], ['04_Banco_BAC', 'Banco BAC', 'Débito']].forEach(function (b) {
    var v = _pagValores_(ss, b[0]), hi = -1;
    if (!v) return;
    for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('Categoría') >= 0) { hi = i; break; }
    if (hi < 0) return;
    var H = v[hi].map(function (h) { return String(h || '').trim(); });
    var iF = H.indexOf('Fecha'), iD = H.indexOf('Descripción'), iDe = H.indexOf(b[2]), iC = H.indexOf('Categoría'), iP = H.indexOf('Es_Personal');
    for (var r = hi + 1; r < v.length; r++) {
      var d = pagDia_(v[r][iF]);
      if (!d || pagNumDia_(d) < desde) continue;
      var q = _finR_(_finNum_(v[r][iDe]));
      if (!(q > 0)) continue;
      var cat = String(v[r][iC] || '').trim();
      if (String(v[r][iP] || '').trim() === 'Sí' || cat === 'PERSONAL' || /^NOMINA|^IGSS|^DEVOLUCION|^PROPINA/.test(cat)) continue;
      var desc = String(v[r][iD] || '').trim();
      if (/^(ATM|RETIRO|A-|F-)/i.test(desc)) continue;   // retiros de cajero: van por Compras en efectivo
      out.push({ llave: b[0] + '|' + r, banco: b[1] === 'Banco BI' ? _pagMedioBI_(desc) : b[1], fecha: pagIso_(d), dia: pagNumDia_(d), q: q, glosa: desc, categoria: cat });
    }
  });
  // Las dos tarjetas de credito (13-oct-2026). Antes Pagos no las leia: lo pagado con tarjeta
  // quedaba Pendiente si nadie lo marcaba "Tarjeta" (Delicadezas Españolas, HG Libreria, Tigo).
  // Mismas columnas que FIN_LIBROS; solo los cargos en quetzales (las facturas son en GTQ).
  FIN_LIBROS.filter(function (L) { return /^0[56]_Tarjeta/.test(L.hoja); }).forEach(function (L) {
    var v = _pagValores_(ss, L.hoja);
    if (!v) return;
    var nom = L.hoja.indexOf('_BI') > 0 ? 'Tarjeta crédito BI' : 'Tarjeta crédito BAC';
    for (var r = FIN_PRIMERA_FILA - 1; r < v.length; r++) {
      var d = pagDia_(v[r][0]);
      if (!d || pagNumDia_(d) < desde) continue;
      var q = _finR_(_finNum_(v[r][L.monto - 1]));
      if (!(q > 0)) continue;
      var cat = String(v[r][L.cat - 1] || '').trim();
      if (String(v[r][L.pers - 1] || '').trim() === 'Sí' || cat === 'PERSONAL' || /^PAGO_TARJETA|^MARKETING_DIGITAL/.test(cat)) continue;
      out.push({ llave: L.hoja + '|' + r, banco: nom, fecha: pagIso_(d), dia: pagNumDia_(d), q: q,
                 glosa: String(v[r][L.desc - 1] || '').trim(), categoria: cat, tarjeta: true });
    }
  });
  return out;
}

/**
 * Con que se pago desde la cuenta BI (Juanma, 13-oct-2026: "identificar qué tarjeta fue usada").
 * La tarjeta de DEBITO BI cobra de la misma cuenta y el banco escribe el comercio en mayusculas
 * terminado en GT ("LA TORRE ANTIGUA 3 DB GT", "PARMAVELGT"); las transferencias las escribe
 * Rosanta a mano ("S31Mercado", "Grupo Eco Septiembre"). Las de credito vienen de su hoja.
 */
function _pagMedioBI_(glosa) {
  var g = String(glosa || '').trim();
  if (g === g.toUpperCase() && /GT$/.test(g) && !/^(ATM|PORTAL|PAGO|PAG\.|TRANSF|TEF|VISANET)/.test(g)) return 'Tarjeta débito BI';
  return 'Banco BI';
}

/** La llave de un pago del banco que no depende de la fila (las hojas se reordenan). */
function _pagLlavePago_(p) { return p.banco + '|' + p.fecha + '|' + p.q + '|' + String(p.glosa || '').slice(0, 40); }

var PAG_PALABRAS_VACIAS_ = ['sociedad', 'anonima', 'distribuidora', 'distribuidor', 'comercial', 'comercializadora',
  'guatemala', 'industrias', 'industria', 'grupo', 'empresa', 'servicios', 'varios', 'pago', 'pagos', 'transferencia',
  // lugares y genericos (13-oct-2026): con los nombres pegados del banco, "antigua" de La Bodegona
  // aparecia dentro de "LATORREANTIGUA2DBGT"
  'antigua', 'sacatepequez', 'vieja', 'ciudad', 'zona', 'central', 'super', 'supermercado', 'supermercados', 'market', 'tienda'];
function _pagPalabras_(s) {
  return normalizar_(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function (w) {
    return w.length >= 4 && !/^\d+$/.test(w) && PAG_PALABRAS_VACIAS_.indexOf(w) === -1;
  });
}

/**
 * El nombre del proveedor en la glosa del banco: como palabra ("S38 XELAC VARIOS") o pegado,
 * como lo escribe Banco Industrial en los cargos de tarjeta de debito ("LATORREANTIGUA2DBGT",
 * "PARMAVELGT", "COMESAGT", "Posfilejulio2026"; 13-oct-2026). Pegado pide 5 letras o mas: con
 * 4, "mesa" o "casa" aparecen dentro de cualquier cosa.
 */
function _pagNombreEnGlosa_(palabras, glosa) {
  var pal = _pagPalabras_(glosa), pegado = normalizar_(glosa).replace(/[^a-z0-9]/g, '');
  return (palabras || []).some(function (w) { return pal.indexOf(w) !== -1 || (w.length >= 5 && pegado.indexOf(w) !== -1); });
}

/** Subconjuntos de 2 a 4 facturas que suman q. Corta en 3 soluciones: con mas, es ambiguo igual. */
function _pagSumas_(lista, q) {
  var sols = [];
  if (lista.length > 14) return sols;
  (function rec(ini, suma, sel) {
    if (sols.length > 2) return;
    if (sel.length >= 2 && Math.abs(suma - q) < 0.011) { sols.push(sel.slice()); return; }
    if (sel.length === 4 || suma > q + 0.011) return;
    for (var i = ini; i < lista.length; i++) { sel.push(lista[i]); rec(i + 1, suma + lista[i].saldo, sel); sel.pop(); }
  })(0, 0, []);
  return sols;
}

/**
 * EL BANCO CONFIRMA (funcion pura; la bateria la prueba con datos de juguete).
 * facturas: [{ llave, nit, dte, dia, saldo, palabras, marcaBanco (dia o null) }] con saldo > 0.
 * pagos: [{ llave, dia, q, glosa }]. Devuelve { casados: { llave factura: llave pago }, dudosos: [pago], sueltos: [pago] }.
 *
 * Solo se casa cuando es seguro. Por orden:
 *  1. La glosa trae el numero de DTE ("S35 Cofradia 3542436084"): esa factura, sola o con las
 *     otras del mismo NIT marcadas Banco, si suman exacto el pago.
 *  2. Facturas marcadas "Banco" por cocina o barra: las de un mismo NIT que suman exacto, si
 *     hay un solo NIT que lo cumpla.
 *  3. Sin marca: el nombre del proveedor en la glosa y una sola factura, o una sola suma de
 *     facturas del mismo NIT, que da el monto exacto.
 * Lo que tiene varias salidas va a "dudosos" para el dueño; lo que no tiene ninguna, a "sueltos".
 * Nunca combina facturas de NIT distintos: combinar montos hasta que sumen es como se
 * fabrican pares falsos (p192).
 */
function _pagCasarBanco_(facturas, pagos) {
  var usadas = {}, casados = {}, dudosos = [], sueltos = [];
  var libres = function () { return facturas.filter(function (f) { return !usadas[f.llave]; }); };
  var suma = function (l) { return l.reduce(function (a, f) { return a + f.saldo; }, 0); };
  var casar = function (lista, p) { lista.forEach(function (f) { usadas[f.llave] = true; casados[f.llave] = p.llave; }); };
  var enVentana = function (f, p) {
    if (f.marcaBanco != null) { var dm = p.dia - f.marcaBanco; return dm >= -PAG_BANCO_ANTES_ && dm <= PAG_BANCO_DESPUES_; }
    var d = p.dia - f.dia; return d >= -FIN_FM_DIAS_DESPUES && d <= FIN_FM_DIAS_ANTES;
  };
  pagos.slice().sort(function (a, b) { return a.dia - b.dia; }).forEach(function (p) {
    var cand = libres().filter(function (f) { return enVentana(f, p); });
    // 1. el numero de DTE en la glosa
    var nums = String(p.glosa || '').match(/\d{6,}/g) || [];
    var porDte = cand.filter(function (f) { return f.dte && nums.indexOf(f.dte) !== -1; });
    if (porDte.length) {
      var nits = {}; porDte.forEach(function (f) { nits[f.nit] = 1; });
      var otras = cand.filter(function (f) { return nits[f.nit] && f.marcaBanco != null && porDte.indexOf(f) === -1; });
      if (Math.abs(suma(porDte) - p.q) < 0.011) return casar(porDte, p);
      if (Math.abs(suma(porDte.concat(otras)) - p.q) < 0.011) return casar(porDte.concat(otras), p);
      return dudosos.push(p);
    }
    // 2. las marcadas Banco, por NIT
    var grupos = {};
    cand.forEach(function (f) { if (f.marcaBanco != null) (grupos[f.nit] = grupos[f.nit] || []).push(f); });
    var exactos = [];
    Object.keys(grupos).forEach(function (n) {
      var g = grupos[n];
      if (Math.abs(suma(g) - p.q) < 0.011) exactos.push(g);
      else {
        var una = g.filter(function (f) { return Math.abs(f.saldo - p.q) < 0.011; });
        if (una.length === 1) exactos.push(una);
        else { var s = _pagSumas_(g, p.q); if (s.length === 1) exactos.push(s[0]); else if (s.length > 1) exactos.push(null); }
      }
    });
    if (exactos.length === 1 && exactos[0]) return casar(exactos[0], p);
    if (exactos.length) return dudosos.push(p);
    // 3. sin marca: el nombre del proveedor tiene que estar en la glosa
    var conNombre = cand.filter(function (f) { return _pagNombreEnGlosa_(f.palabras, p.glosa); });
    if (!conNombre.length) return sueltos.push(p);
    var sol = [];
    var uno = conNombre.filter(function (f) { return Math.abs(f.saldo - p.q) < 0.011; });
    uno.forEach(function (f) { sol.push([f]); });
    var porNit = {};
    conNombre.forEach(function (f) { (porNit[f.nit] = porNit[f.nit] || []).push(f); });
    Object.keys(porNit).forEach(function (n) { sol = sol.concat(_pagSumas_(porNit[n], p.q)); });
    if (sol.length === 1) return casar(sol[0], p);
    if (sol.length) return dudosos.push(p);
    return sueltos.push(p);
  });
  return { casados: casados, dudosos: dudosos, sueltos: sueltos };
}

/**
 * POSIBLES PAGOS (funcion pura). Para cada pago libre del banco o de una tarjeta: las facturas
 * abiertas con su monto exacto (una sola, o 2 a 4 del mismo NIT que suman) emitidas entre 3
 * dias despues y 60 dias antes del pago. No casa nada: lo ofrece. Primero los que traen el
 * nombre del proveedor en la glosa, despues los de tarjeta del mismo dia, despues el resto.
 */
// Las categorias del banco que dicen poco de a quien se pago: con estas cualquier factura puede ser.
var PAG_CAT_GENERICAS_ = ['', 'POR_CLASIFICAR', 'PAGO_FACTURA_FEL', 'TRANSFERENCIA_SALIENTE', 'GASTOS_VARIOS'];
function _pagCatCompatible_(catPago, catFactura) {
  if (PAG_CAT_GENERICAS_.indexOf(catPago) !== -1 || !catFactura) return true;
  var base = function (c) { return String(c).replace(/_EFECTIVO$/, '').replace(/_/g, ' '); };
  return base(catPago) === base(catFactura);
}

/**
 * La ventana entre un pago y su factura. La mercaderia se factura al comprar y se paga despues
 * (3 dias antes a 60 despues). La renta y los servicios se facturan DESPUES de cobrar (Juanma,
 * 13-oct-2026: la renta de agosto se pago el 22 y el 29-ago y la factura es del 18-sep): ahi el
 * pago puede ser hasta 45 dias anterior a la factura.
 */
function _pagEnVentanaPosible_(p, f) {
  var d = p.dia - f.dia, antes = _finEn_(FIN_COGS_CATS, f.categoria) ? 3 : 45;
  return d >= -antes && d <= 60;
}

/*
 * dtes (14-oct-2026, Juanma: "S36 Industrias VGS 1156465795 hace referencia a la factura que se
 * pago"): { numero de DTE: true si sigue abierta, false si ya esta pagada } de TODAS las facturas.
 * Un cargo cuya glosa trae el numero de una factura ES el pago de esa factura: si ya esta pagada
 * (por COMPRAS_2026, a mano o por otro cargo) no se ofrece para otra; si esta abierta, se ofrece
 * solo para esa. Sin dtes (el harness viejo) se comporta como antes.
 */
function _pagDteEnGlosa_(glosa, dtes) {
  var nums = String(glosa || '').match(/\d{6,}/g) || [];
  for (var i = 0; i < nums.length; i++) if (dtes && Object.prototype.hasOwnProperty.call(dtes, nums[i])) return nums[i];
  return '';
}
function _pagPosibles_(abiertas, pagos, dtes) {
  var out = [];
  pagos.forEach(function (p) {
    var dteG = _pagDteEnGlosa_(p.glosa, dtes);
    if (dteG && !dtes[dteG]) return;   // el pago de una factura que ya esta pagada
    // no son pagos a proveedores: traspasos entre cuentas, pago y cobros de la tarjeta, nomina,
    // pauta, comisiones (S41 Corsaga BAC, PAGO TARJETA X616..., COBRO ADMTVO.)
    var cat = p.categoria || '';
    if (cat !== 'PAGO_FACTURA_FEL' && cat !== 'POR_CLASIFICAR' && _finEn_(FIN_FUERA, cat)) return;
    if (/^(NOMINA|IGSS|PROPINA|MARKETING|COMISION)/.test(cat)) return;
    if (/CORSAGA|PAGO TARJETA|PAG\.A TAR|COBRO ADM|MARKETING/i.test(p.glosa || '')) return;
    var cand = dteG ? abiertas.filter(function (f) { return f.dte === dteG; })
                    : abiertas.filter(function (f) { return _pagEnVentanaPosible_(p, f) && _pagCatCompatible_(cat, f.categoria); });
    var ops = cand.filter(function (f) { return Math.abs(f.saldo - p.q) < 0.011; }).map(function (f) { return [f]; });
    var porNit = {};
    cand.forEach(function (f) { (porNit[f.nit] = porNit[f.nit] || []).push(f); });
    Object.keys(porNit).forEach(function (n) { ops = ops.concat(_pagSumas_(porNit[n], p.q)); });
    // Un ABONO (13-oct-2026, la renta en dos partes): si nada da el monto exacto. Desde el 14-oct-2026
    // (Juanma: "los pagos siempre suelen ser exactos, no dejan abonos tan grandes") solo si la glosa
    // NOMBRA al proveedor o trae el numero de la factura; ya no por la sola categoria (asi salian
    // abonos a Doorways de cargos de MC Industrias y Bodega Feliz). Desde el 16-oct-2026, nunca de un
    // cargo anterior a la factura: el BAC del 18-ago por Q414 ("TEF A : 902410067") pago la de julio
    // y salio como abono a la 2629453712 del 2-sep.
    var abono = false;
    if (!ops.length) {
      ops = cand.filter(function (f) {
        return f.saldo > p.q + 0.01 && p.dia >= f.dia && (dteG || _pagNombreEnGlosa_(f.palabras, p.glosa));
      }).map(function (f) { return [f]; });
      abono = ops.length > 0;
    }
    if (!ops.length) return;
    var opciones = ops.slice(0, 3).map(function (l) {
      return { llaves: l.map(function (f) { return f.llave; }), abono: abono, nombre: l.some(function (f) { return _pagNombreEnGlosa_(f.palabras, p.glosa); }),
               mismo_dia: /^Tarjeta/.test(p.banco) && l.every(function (f) { return Math.abs(p.dia - f.dia) <= 2; }),
               facturas: l.map(function (f) { return { dte: f.dte, proveedor: f.proveedor, fecha: f.fecha, saldo: f.saldo, area: f.area }; }) };
    });
    opciones.sort(function (a, b) { return (b.nombre ? 2 : b.mismo_dia ? 1 : 0) - (a.nombre ? 2 : a.mismo_dia ? 1 : 0); });
    out.push({ pago: { llave: _pagLlavePago_(p), banco: p.banco, fecha: p.fecha, q: p.q, glosa: p.glosa }, opciones: opciones,
               fuerza: opciones[0].nombre ? 2 : opciones[0].mismo_dia ? 1 : 0 });
  });
  // PAGOS FRACCIONADOS (13-oct-2026, Juanma): una o varias facturas de un mismo proveedor pagadas
  // con 2 o 3 cargos (la renta de agosto: 15,212.50 + 5,000; tres facturas de Cofradia con dos
  // transferencias). Por proveedor (NIT): cargos suyos (nombre en la glosa, o la misma categoria
  // si no es mercaderia) desde 3 dias antes de la primera factura hasta 60 despues de la ultima,
  // y un grupo de 1 a 4 facturas abiertas cuyos saldos suman exacto lo mismo.
  var usadosFr = {}, porNitF = {};
  abiertas.forEach(function (f) { (porNitF[f.nit] = porNitF[f.nit] || []).push(f); });
  Object.keys(porNitF).forEach(function (nit) {
    var FS = porNitF[nit].slice().sort(function (a, b) { return a.dia - b.dia; }).slice(0, 10);
    var dMin = FS[0].dia, dMax = FS[FS.length - 1].dia;
    var mios = pagos.filter(function (p) {
      var cat = p.categoria || '';
      if (p.dia < dMin - 45 || p.dia > dMax + 60 || usadosFr[p.llave]) return false;
      if (cat !== 'PAGO_FACTURA_FEL' && cat !== 'POR_CLASIFICAR' && _finEn_(FIN_FUERA, cat)) return false;
      if (/CORSAGA|PAGO TARJETA|PAG\.A TAR|COBRO ADM|MARKETING/i.test(p.glosa || '')) return false;
      // un cargo con el numero de OTRA factura en la glosa es el pago de esa (14-oct-2026)
      var dg = _pagDteEnGlosa_(p.glosa, dtes);
      if (dg && !FS.some(function (f) { return f.dte === dg; })) return false;
      return FS.some(function (f) {
        var catOk = PAG_CAT_GENERICAS_.indexOf(cat) === -1 && cat === f.categoria && !_finEn_(FIN_COGS_CATS, cat);
        return catOk || _pagNombreEnGlosa_(f.palabras, p.glosa);
      });
    }).sort(function (a, b) { return a.dia - b.dia; }).slice(0, 10);
    if (mios.length < 2) return;
    // las sumas de 2 o 3 cargos, y las de 1 a 4 facturas (solo facturas emitidas antes del ultimo cargo + 3 dias)
    var subs = function (lista, min, max, val) {
      var out2 = [];
      (function rec(ini, suma, sel) {
        if (sel.length >= min) out2.push({ sel: sel.slice(), suma: _finR_(suma) });
        if (sel.length === max) return;
        for (var i = ini; i < lista.length; i++) { sel.push(lista[i]); rec(i + 1, suma + val(lista[i]), sel); sel.pop(); }
      })(0, 0, []);
      return out2;
    };
    var sumP = subs(mios, 2, 3, function (p) { return p.q; }), sumF = subs(FS, 1, 4, function (f) { return f.saldo; });
    var hecho = false;
    sumP.forEach(function (sp) {
      if (hecho) return;
      // cada factura del grupo en la ventana de cada cargo (la renta: cargos antes de la factura)
      var sf = sumF.filter(function (x) { return Math.abs(x.suma - sp.suma) < 0.011 && x.sel.every(function (f) { return sp.sel.every(function (p) { return _pagEnVentanaPosible_(p, f); }); }); })[0];
      if (!sf) return;
      hecho = true;
      sp.sel.forEach(function (p) { usadosFr[p.llave] = 1; });
      var ult = sp.sel[sp.sel.length - 1];
      out.push({ pago: { llave: sp.sel.map(_pagLlavePago_).join(' + '), banco: sp.sel.map(function (p) { return p.banco; }).filter(function (b, i, l) { return l.indexOf(b) === i; }).join(' y '),
                         fecha: ult.fecha, q: sp.suma, glosa: sp.sel.map(function (p) { return p.glosa + ' (' + p.fecha.slice(8, 10) + '/' + p.fecha.slice(5, 7) + ', Q' + p.q + ')'; }).join(' + ') },
                 pagos: sp.sel.map(function (p) { return { llave: _pagLlavePago_(p), banco: p.banco, fecha: p.fecha, q: p.q, glosa: p.glosa }; }),
                 opciones: [{ llaves: sf.sel.map(function (f) { return f.llave; }), fraccionado: true, mismo_dia: false,
                              nombre: sp.sel.some(function (p) { return sf.sel.some(function (f) { return _pagNombreEnGlosa_(f.palabras, p.glosa); }); }),
                              facturas: sf.sel.map(function (f) { return { dte: f.dte, proveedor: f.proveedor, fecha: f.fecha, saldo: f.saldo, area: f.area }; }) }],
                 fuerza: 1 });
    });
  });
  // Lo fraccionado manda: un cargo que ya explica una factura junto con otros no se ofrece suelto,
  // y a esa factura no se le ofrecen abonos de otros cargos (el 6-oct no es abono de la renta de agosto).
  var enFr = {}, factFr = {};
  out.forEach(function (x) { if (x.pagos) { x.pagos.forEach(function (p) { enFr[p.llave] = 1; }); x.opciones[0].llaves.forEach(function (k) { factFr[k] = 1; }); } });
  out = out.filter(function (x) {
    if (x.pagos) return true;
    if (enFr[x.pago.llave]) return false;
    x.opciones = x.opciones.filter(function (o) { return !o.llaves.some(function (k) { return factFr[k]; }); });
    return x.opciones.length > 0;
  });
  return out.sort(function (a, b) { return b.fuerza - a.fuerza || (a.pago.fecha < b.pago.fecha ? 1 : -1); });
}

/**
 * "No pertenece" (14-oct-2026, Juanma): el cargo no es el pago de ninguna de esas facturas. Queda
 * anotado (quien y cuando) y no vuelve a ofrecerse ni a casarse solo. Se deshace anulando la fila
 * (la lista de descartados de Posibles pagos tiene "volver a ofrecer").
 */
function descartarPosiblePago(auth, pagoLlave) {
  var Q = pagQuien_(auth);
  if (Q.rol !== 'dueno') throw new Error('Descartar pagos del banco lo hace el dueño.');
  var P = pagEstado_().posibles.filter(function (x) { return x.pago.llave === pagoLlave; })[0];
  if (!P) throw new Error('Ese pago ya no está entre los posibles. Actualizá la pantalla.');
  var llaves = P.pagos ? P.pagos.map(function (pg) { return pg.llave; }) : [P.pago.llave];
  _pagEscribir_([{ AREA: 'ADMIN', PROVEEDOR: '(cargo del banco)', DTE: '', NIT: '', 'FECHA PAGADO': P.pago.fecha, 'CANTIDAD PAGADA': 0,
                   'ESTATUS DE PAGO': PAG_DESCARTADO_,
                   DETALLE: (P.pago.banco + ' · Q' + P.pago.q + ' · ' + P.pago.glosa).slice(0, 250) + ' · pago: ' + llaves.join(' ; '), 'ESCRITO POR': Q.nombre }]);
  return getPagosProveedores(auth);
}

/** El dueño confirma que un pago del banco o de la tarjeta es el de esa(s) factura(s). */
function confirmarPosiblePago(auth, pagoLlave, llaves) {
  var Q = pagQuien_(auth);
  if (Q.rol !== 'dueno') throw new Error('Confirmar pagos del banco lo hace el dueño.');
  llaves = [].concat(llaves || []).sort();
  var E = pagEstado_();
  var P = E.posibles.filter(function (x) { return x.pago.llave === pagoLlave; })[0];
  var op = P && P.opciones.filter(function (o) { return o.llaves.slice().sort().join(',') === llaves.join(','); })[0];
  if (!op) throw new Error('Ese pago ya no está entre los posibles (¿lo confirmaron recién?). Actualizá la pantalla.');
  var porLlave = {}; E.facturas.forEach(function (f) { porLlave[f.llave] = f; });
  // un pago fraccionado: una fila por cargo, cada una con su llave (asi ninguno se vuelve a ofrecer)
  if (op.fraccionado && op.llaves.length > 1) {
    var llavesP = P.pagos.map(function (pg) { return pg.llave; }).join(' ; ');
    _pagEscribir_(op.llaves.map(function (k) {
      var f = porLlave[k];
      return { AREA: f.area, PROVEEDOR: f.proveedor, NIT: f.nit, DTE: f.dte, 'FECHA PAGADO': P.pago.fecha, 'CANTIDAD PAGADA': f.saldo,
               'ESTATUS DE PAGO': PAG_CONF_BANCO_, DETALLE: ('Pagos: ' + P.pago.glosa).slice(0, 300) + ' · pago: ' + llavesP, 'ESCRITO POR': Q.nombre };
    }));
    return getPagosProveedores(auth);
  }
  if (op.fraccionado) {
    var f0 = porLlave[op.llaves[0]];
    _pagEscribir_(P.pagos.map(function (pg) {
      return { AREA: f0.area, PROVEEDOR: f0.proveedor, NIT: f0.nit, DTE: f0.dte, 'FECHA PAGADO': pg.fecha, 'CANTIDAD PAGADA': pg.q,
               'ESTATUS DE PAGO': PAG_CONF_BANCO_, DETALLE: (pg.banco + ' ' + pg.glosa).slice(0, 200) + ' · pago: ' + pg.llave, 'ESCRITO POR': Q.nombre };
    }));
    return getPagosProveedores(auth);
  }
  _pagEscribir_(op.llaves.map(function (k) {
    var f = porLlave[k];
    // un abono paga el monto del cargo; si no, el saldo de cada factura
    return { AREA: f.area, PROVEEDOR: f.proveedor, NIT: f.nit, DTE: f.dte, 'FECHA PAGADO': P.pago.fecha, 'CANTIDAD PAGADA': op.abono ? P.pago.q : f.saldo,
             'ESTATUS DE PAGO': PAG_CONF_BANCO_, DETALLE: (P.pago.banco + ' ' + P.pago.glosa).slice(0, 200) + ' · pago: ' + P.pago.llave, 'ESCRITO POR': Q.nombre };
  }));
  return getPagosProveedores(auth);
}

/**
 * Los DTE que COMPRAS_2026 (el Excel de antes del arranque) da por pagados: { dte: {hoja, estatus, fecha} }.
 * Pagada = la fila trae estatus de pago (caja, tarjeta, BI, Maco...), fecha pagado o referencia
 * del banco. Una fila sin nada de eso estaba por pagar. Se guarda 6 h: el Excel ya no cambia.
 */
function _pagPagadasCompras_() {
  var cache = CacheService.getScriptCache(), k = 'pag_compras_pagadas_v1', g = cache.get(k);
  if (g) { try { return JSON.parse(g); } catch (e) { /* se vuelve a leer */ } }
  var out = {};
  try {
    SpreadsheetApp.openById(PAG_COMPRAS_ID_).getSheets().forEach(function (sh) {
      var hoja = sh.getName().trim();
      sh.getDataRange().getValues().forEach(function (row) {
        var dtes = String(row[2] == null ? '' : row[2]).replace(/\.0\b/g, '').match(/\d{6,}/g);
        if (!dtes) return;
        var est = String(row[6] == null ? '' : row[6]).trim(), fp = row[4] instanceof Date ? pagIso_(row[4]) : '';
        var ref = String(row[7] == null ? '' : row[7]).trim();
        if (!est && !fp && !/\d{5,}/.test(ref)) return;
        dtes.forEach(function (d) { if (!out[d]) out[d] = { hoja: hoja, estatus: (est || (ref ? 'Ref. ' + ref.replace(/\.0$/, '') : 'Pagado')).slice(0, 60), fecha: fp }; });
      });
    });
    try { cache.put(k, JSON.stringify(out), 6 * 60 * 60); } catch (e) { /* muy grande: se lee cada vez */ }
  } catch (e) { Logger.log('No pude leer COMPRAS_2026: ' + e.message); }
  return out;
}

/** Arma el estado de cada factura y el cuadre por proveedor. Sin filtrar por area. */
function pagEstado_() {
  var ss = _pagMaestro_();
  var movs = pagMovimientos_(), anteriores = {};
  movs.forEach(function (m) { if (m.estatus === PAG_ANTERIOR_) anteriores[m.nit + '|' + m.dte] = m.q; });
  var ajenas = [], facturas = pagFacturas_(ss, anteriores, ajenas, fecFacturas_()), banco = pagPagosBanco_(ss);
  // los pagos que el dueño ya confirmo a mano no se vuelven a casar ni a ofrecer
  var yaConfirmados = {};
  movs.forEach(function (m) {
    var k = (m.estatus === PAG_CONF_BANCO_ || m.estatus === PAG_DESCARTADO_) && /pago: (.+)$/.exec(m.detalle);
    if (k) k[1].split(' ; ').forEach(function (x) { yaConfirmados[x] = 1; });   // un pago fraccionado guarda varias
  });
  var bancoUlt = banco.filter(function (p) { return !p.tarjeta; }).reduce(function (a, p) { return p.fecha > a ? p.fecha : a; }, '');
  banco = banco.filter(function (p) { return !yaConfirmados[_pagLlavePago_(p)]; });
  var porLlave = {};
  facturas.forEach(function (f) {
    f.pagado = 0; f.favor_usado = 0; f.pagos = []; f.fecha_pagar = ''; f.marca_banco = null;
    porLlave[f.llave] = f;
  });
  var favor = {}, mercado = [], favores = [];   // saldo a favor por NIT; compras sin factura
  movs.forEach(function (m) {
    if (m.dte === PAG_SIN_FACTURA_) { mercado.push(m); return; }
    if (m.estatus === 'Saldo a favor') { favor[m.nit] = (favor[m.nit] || 0) + m.q; favores.push(m); return; }
    if (m.estatus === PAG_IVA_MARCA_ || m.estatus === PAG_IVA_DEVUELTA_) return;   // bitacora, no es pago
    if (PAG_EQUIPO_.some(function (e) { return e.devuelto === m.estatus; })) return;   // devolucion al equipo, no es pago a proveedor
    var f = porLlave[m.nit + '|' + m.dte];
    if (!f) return;
    if (m.estatus === 'Programado') { f.fecha_pagar = m.fecha_pagar; return; }
    if (m.estatus === PAG_ANTERIOR_) {   // lo que ya se habia pagado antes de traerla
      var previo = _finR_(f.total - m.q);
      if (previo > 0.01) { f.pagado += previo; f.pagos.push({ id: m.id, fecha: '', q: previo, estatus: 'Pagado antes (COMPRAS_2026)', por: m.por, detalle: m.detalle }); }
      else f.pagos.push({ id: m.id, fecha: '', q: 0, estatus: 'Traida de antes', por: m.por, detalle: m.detalle });
      f.anterior = true;
      if (m.fecha_pagar) f.fecha_pagar = m.fecha_pagar;
      return;
    }
    if (m.fecha_pagar) f.fecha_pagar = m.fecha_pagar;
    if (m.estatus === 'Saldo a favor usado') { f.favor_usado += m.q; favor[m.nit] = (favor[m.nit] || 0) - m.q; }
    else if (m.estatus === 'Banco') {
      // Un pago marcado "Banco" cuenta YA por su monto (13-oct-2026): un abono baja el saldo y la
      // factura muestra lo que falta. Queda "por confirmar" hasta que el banco traiga ese monto
      // (la renta se paga en dos partes: 10,212.50 el 6-oct y 10,000 el 13-oct).
      f.marca_banco = pagNumDia_(pagDia_(m.fecha_pagado) || new Date());
      var med = /^\[([^\]]+)\]/.exec(m.detalle || '');
      (f.marcas = f.marcas || []).push({ id: m.id, q: m.q, dia: f.marca_banco, medio: med ? med[1] : '' });
      f.pagado += m.q;
    }
    else f.pagado += m.q;
    f.pagos.push({ id: m.id, fecha: m.fecha_pagado, q: m.q, estatus: m.estatus, por: m.por, detalle: m.detalle });
  });
  // Antes del arranque los pagos se anotaban en COMPRAS_2026: lo que alla esta pagado no se debe.
  // Las traidas a mano (Pendiente anterior) mandan: alguien ya reviso que se deben.
  var arranque = pagIso_(pagDia_(PAG_ARRANQUE_)), compras = _pagPagadasCompras_();
  facturas.forEach(function (f) {
    if (f.anterior || f.fecha >= arranque || f.pagado > 0.01 || f.marca_banco != null) return;
    var c = compras[f.dte];
    if (!c) return;
    f.pagado = f.total;
    f.pagos.push({ id: '', fecha: c.fecha, q: f.total, estatus: 'Pagado antes (COMPRAS_2026)', por: c.hoja, detalle: c.estatus });
  });
  // 1. Los pagos marcados "Banco": cada marca se confirma con un pago del banco de SU monto, y
  //    las marcas de un mismo proveedor que no se confirmaron solas, con un pago que las sume.
  var usadoMarca = {}, conMarca = facturas.filter(function (f) { return f.marcas; });
  var enVent = function (p, dia) { var d = p.dia - dia; return d >= -PAG_BANCO_ANTES_ && d <= PAG_BANCO_DESPUES_; };
  conMarca.forEach(function (f) { f.marcas.forEach(function (mk) {
    // de la cuenta elegida (Banco BI incluye lo pagado con la tarjeta de debito, que sale de la misma cuenta)
    var medioOk = function (p) { return !mk.medio || p.banco === mk.medio || (mk.medio === 'Banco BI' && p.banco === 'Tarjeta débito BI'); };
    var p = banco.filter(function (p) { return !usadoMarca[p.llave] && medioOk(p) && Math.abs(p.q - mk.q) < 0.011 && enVent(p, mk.dia); })[0];
    if (p) { usadoMarca[p.llave] = 1; mk.pago = p; }
  }); });
  var sinConf = {};
  conMarca.forEach(function (f) { f.marcas.forEach(function (mk) { if (!mk.pago) (sinConf[f.nit] = sinConf[f.nit] || []).push(mk); }); });
  Object.keys(sinConf).forEach(function (n) {
    var g = sinConf[n], tot = _finR_(g.reduce(function (a, mk) { return a + mk.q; }, 0)), dia = Math.max.apply(null, g.map(function (mk) { return mk.dia; }));
    if (g.length < 2) return;
    var p = banco.filter(function (p) { return !usadoMarca[p.llave] && Math.abs(p.q - tot) < 0.011 && enVent(p, dia); })[0];
    if (p) { usadoMarca[p.llave] = 1; g.forEach(function (mk) { mk.pago = p; }); }
  });
  conMarca.forEach(function (f) {
    f.por_confirmar = 0;
    f.marcas.forEach(function (mk) {
      var x = f.pagos.filter(function (y) { return y.id === mk.id; })[0];
      // la fecha que se anoto (el dia del pago) y la que trae el banco (el dia que lo registro)
      if (mk.pago && x) { x.estatus = /^Tarjeta/.test(mk.pago.banco) ? 'Tarjeta confirmada' : 'Banco confirmado'; x.por = mk.pago.banco; x.detalle = mk.pago.glosa; x.fecha_marca = x.fecha; x.fecha = mk.pago.fecha; }
      else f.por_confirmar += mk.q;
    });
    f.por_confirmar = _finR_(f.por_confirmar);
  });
  banco = banco.filter(function (p) { return !usadoMarca[p.llave]; });
  // 2. El banco confirma lo que falta pagar (lo que ya tiene marcas, por su saldo)
  var abiertas = facturas.filter(function (f) { return f.total - f.pagado - f.favor_usado > 0.01; }).map(function (f) {
    return { llave: f.llave, nit: f.nit, dte: f.dte, dia: f.dia, saldo: _finR_(f.total - f.pagado - f.favor_usado),
             palabras: _pagPalabras_(f.proveedor + ' ' + f.razon), marcaBanco: null };
  });
  var cb = _pagCasarBanco_(abiertas, banco), pagoPorLlave = {};
  banco.forEach(function (p) { pagoPorLlave[p.llave] = p; });
  facturas.forEach(function (f) {
    var pl = cb.casados[f.llave];
    if (pl) {
      var p = pagoPorLlave[pl], s = _finR_(f.total - f.pagado - f.favor_usado);
      f.pagado += s;
      // por: el medio (Banco BI, Tarjeta débito BI, Tarjeta crédito BI / BAC, Banco BAC)
      f.pagos.push({ id: '', fecha: p.fecha, q: s, estatus: /^Tarjeta/.test(p.banco) ? 'Tarjeta confirmada' : 'Banco confirmado', por: p.banco, detalle: p.glosa });
    }
    f.saldo = _finR_(f.total - f.pagado - f.favor_usado);
    f.pagado = _finR_(f.pagado);
    f.por_confirmar = f.por_confirmar || 0;
    f.estado = f.saldo <= 0.01 ? (f.por_confirmar > 0.01 ? 'Banco por confirmar' : f.saldo < -0.01 ? 'Pagada de más' : 'Pagada')
             : f.pagado > 0.01 ? 'Abonada' : 'Pendiente';
    delete f.dia; delete f.marca_banco; delete f.marcas;
  });
  var usados = {}; Object.keys(cb.casados).forEach(function (k) { usados[cb.casados[k]] = 1; });
  var abiertasYa = facturas.filter(function (f) { return f.saldo > 0.01 && !f.por_correo; }).map(function (f) {
    return { llave: f.llave, nit: f.nit, dte: f.dte, proveedor: f.proveedor, fecha: f.fecha, dia: pagNumDia_(pagDia_(f.fecha)),
             saldo: f.saldo, area: f.area, categoria: f.categoria,
             // con los alias del banco (14-oct-2026: "TEF A : 902410067" es Doorways); solo para Posibles pagos
             palabras: _pagPalabras_(f.proveedor + ' ' + f.razon).concat(PAG_ALIAS_BANCO_[f.nit] || []) };
  });
  return { facturas: facturas, mercado: mercado, favor: favor, favores: favores, ajenas: ajenas,
           banco_dudosos: cb.dudosos, banco_sueltos: cb.sueltos.filter(function (p) { return PAG_AREA_CAT_[p.categoria]; }),
           posibles: _pagPosibles_(abiertasYa, banco.filter(function (p) { return !usados[p.llave]; }),
                                   (function () { var d = {}; facturas.forEach(function (f) { d[f.dte] = d[f.dte] || f.saldo > 0.01; }); return d; })()),
           banco_ult: bancoUlt };
}

/** El cuadre por proveedor: facturado, pagado, pendiente, abonos, saldo a favor y pagos de mas. */
function _pagCuadre_(facturas, favor) {
  var P = {};
  facturas.forEach(function (f) {
    var x = P[f.nit] = P[f.nit] || { nit: f.nit, proveedor: f.proveedor, area: f.area, grupo: f.grupo, n: 0, facturado: 0, pagado: 0,
                                     pendiente: 0, abonadas: 0, de_mas: 0, favor: 0, por_confirmar: 0 };
    x.n++; x.facturado += f.total; x.pagado += f.pagado + f.favor_usado;
    if (f.saldo > 0.01) x.pendiente += f.saldo;
    if (f.saldo < -0.01) x.de_mas -= f.saldo;
    if (f.estado === 'Abonada') x.abonadas++;
    x.por_confirmar += f.por_confirmar || 0;
  });
  Object.keys(favor).forEach(function (n) { if (P[n]) P[n].favor = favor[n]; });
  return Object.keys(P).map(function (n) {
    var x = P[n];
    ['facturado', 'pagado', 'pendiente', 'de_mas', 'favor', 'por_confirmar'].forEach(function (k) { x[k] = _finR_(x[k]); });
    return x;
  }).sort(function (a, b) { return b.pendiente - a.pendiente || (a.proveedor < b.proveedor ? -1 : a.proveedor > b.proveedor ? 1 : a.nit < b.nit ? -1 : a.nit > b.nit ? 1 : 0); });
}

/** La pantalla: las facturas del area de quien entra, el mercado y el cuadre. */
function getPagosProveedores(auth) {
  var Q = pagQuien_(auth);
  // las facturas que SAT aviso por correo (FelCorreo.js). Despues de guardar no se lee Gmail:
  // es lo mas lento y la pantalla se refresca al abrirla o con Actualizar (14-oct-2026)
  var fec = _PAG_LEIDO_.escribio ? null : fecLeerSiToca_();
  return _pagPantalla_(Q, pagEstado_(), fec);
}

/** Las facturas que ve Q, en el orden de la pantalla, y el saldo a favor de sus proveedores. */
function _pagVisibles_(Q, E) {
  var ve = function (a) { return Q.areas.indexOf(a) !== -1; };
  var facturas = E.facturas.filter(function (f) { return ve(f.area); });
  var og = function (g) { var i = PAG_GRUPOS_ORDEN_.indexOf(g); return i < 0 ? 99 : i; };
  // Orden total (15-oct-2026): con un empate (mismo proveedor y fecha) decide la llave. Asi la
  // pantalla, al pegar lo que devuelve el camino rapido, ordena igual (ProfitPagosJs.html).
  facturas.sort(function (a, b) { return og(a.grupo) - og(b.grupo) || (a.proveedor < b.proveedor ? -1 : a.proveedor > b.proveedor ? 1 :
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.llave < b.llave ? -1 : a.llave > b.llave ? 1 : 0); });
  var favor = {};
  facturas.forEach(function (f) { if (E.favor[f.nit]) favor[f.nit] = E.favor[f.nit]; });
  return { facturas: facturas, favor: favor, ve: ve };
}

/** La pantalla entera, armada de un estado ya calculado (getPagosProveedores y la prueba). */
function _pagPantalla_(Q, E, fec) {
  var V = _pagVisibles_(Q, E), ve = V.ve, facturas = V.facturas, favor = V.favor;
  var out = {
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm'), desde: PAG_DESDE_,
    rol: Q.rol, areas: Q.areas, formas: PAG_FORMAS_, formas_mercado: PAG_FORMAS_MERCADO_,
    medios_banco: PAG_MEDIOS_BANCO_, medios_tarjeta: PAG_MEDIOS_TARJETA_,
    facturas: facturas, cuadre: _pagCuadre_(facturas, favor),
    mercado: E.mercado.filter(function (m) { return ve(m.area); }),
    proveedores_mercado: _pagProvMercado_(E.mercado), grupos: PAG_GRUPOS_ORDEN_,
    // cada saldo a favor anotado, con su id para poder anularlo si se escribio por error
    favores: E.favores.filter(function (m) { return favor[m.nit] !== undefined; }),
    banco_ult: E.banco_ult,
    por_devolver: _pagPorDevolver_(Q),
    // quien es el que entra en Por devolver (Jeffry o José), para que agregue lo suyo
    mi_equipo: (PAG_EQUIPO_.filter(function (e) { return e.rol === Q.rol; })[0] || {}).nombre || '',
    aviso_correo: fec && fec.errores && fec.errores.length ? 'No pude leer todos los avisos del FEL en el correo: ' + fec.errores.slice(0, 2).join(' · ') : ''
  };
  // Para reducir IVA es comun (Juanma, 13-oct-2026): Maco y Jeffry marcan las suyas y todos ven
  // la lista con quien marco cada una (la ultima marca de la bitacora de esa factura).
  var anio = String(new Date().getFullYear()), marco = {};
  pagMovimientos_().forEach(function (m) { if (m.estatus === PAG_IVA_MARCA_) marco[m.nit + '|' + m.dte] = m.por; });
  out.para_iva = E.ajenas.filter(function (a) { return a.fecha.slice(0, 4) === anio; })
    .map(function (a) { a.marco = marco[a.llave] || ''; return a; })
    .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  out.hoja_iva = PAG_HOJA_IVA_;
  out.mi_nombre = Q.nombre;
  if (Q.rol === 'dueno') {
    out.banco_dudosos = E.banco_dudosos; out.banco_sueltos = E.banco_sueltos; out.posibles = E.posibles;
    // los "No pertenece", para poder deshacerlos (los ultimos 20)
    out.descartados = pagMovimientos_().filter(function (m) { return m.estatus === PAG_DESCARTADO_; }).slice(-20).reverse()
      .map(function (m) { return { id: m.id, fecha: m.fecha_pagado, detalle: m.detalle.replace(/\s*·\s*pago: .*$/, ''), por: m.por }; });
    // La pestaña del maestro existe desde que el dueño abre Pagos, aunque no marque nada
    if (!_PAG_LEIDO_.escribio) try { _pagHojaIva_(_pagMaestro_()); } catch (e) { out.aviso_iva = 'No pude crear la pestaña ' + PAG_HOJA_IVA_ + ': ' + e.message; }
  }
  return out;
}

/*
 * EL CAMINO RAPIDO (15-oct-2026, Juanma: "tarda mucho y no sabes si esta cargando"). Medido en
 * /dev: el guardado escribe en ~1 s y despues armaba la pantalla ENTERA (~3 s y 134 KB de vuelta)
 * para repintar todo y cerrar lo que la persona estaba viendo. Ahora el guardado devuelve solo lo
 * que cambio, con el patron `cambios` de recetas: las facturas de los proveedores tocados, su fila
 * del cuadre, su saldo a favor, y las listas chicas (mercado, por devolver). La pantalla lo pega
 * sobre lo que ya tiene; "Actualizar" y abrir Pagos siguen trayendo todo.
 *
 * Sale del MISMO estado que la pantalla completa (_pagVisibles_ y _pagCuadre_ son los mismos):
 * la bateria compara las dos ("El camino rapido de Pagos da lo mismo que la pantalla completa").
 *
 * nits: los proveedores tocados. E: el estado ya recalculado, o null cuando el guardado no toca
 * facturas (mercado, devolucion al equipo): ahi no se lee el maestro.
 */
function _pagCambios_(Q, E, nits, resumen) {
  var ve = function (a) { return Q.areas.indexOf(a) !== -1; };
  var movs = pagMovimientos_();
  var mercado = movs.filter(function (m) { return m.dte === PAG_SIN_FACTURA_; });
  var out = { rapido: true, resumen: resumen || '', nits: [],
              gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm'),
              mercado: mercado.filter(function (m) { return ve(m.area); }),
              proveedores_mercado: _pagProvMercado_(mercado),
              por_devolver: _pagPorDevolver_(Q) };
  if (!E) return out;
  var V = _pagVisibles_(Q, E), toca = {};
  (nits || []).forEach(function (n) { toca[pagNit_(n)] = 1; });
  out.nits = Object.keys(toca);
  out.facturas = V.facturas.filter(function (f) { return toca[f.nit]; });
  out.cuadre = _pagCuadre_(out.facturas, V.favor);
  out.favor = {}; out.nits.forEach(function (n) { out.favor[n] = V.favor[n] || 0; });
  out.favores = E.favores.filter(function (m) { return toca[m.nit] && V.favor[m.nit] !== undefined; });
  return out;
}

/** "Q1,250.00" para la confirmacion. */
function _pagQ_(n) { return 'Q' + _finR_(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/** Los proveedores de mercado: primero los que mas se anotaron aca, despues la lista base. */
function _pagProvMercado_(mercado) {
  var n = {}, nombre = {};
  (mercado || []).forEach(function (m) { var k = normalizar_(m.proveedor); if (!k) return; n[k] = (n[k] || 0) + 1; nombre[k] = nombre[k] || m.proveedor; });
  var usados = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).map(function (k) { return nombre[k]; });
  PAG_PROV_MERCADO_.forEach(function (p) { if (!n[normalizar_(p)]) usados.push(p); });
  return usados;
}

/*
 * EL CANDADO, REENTRANTE (14-oct-2026, auditoria de la @188). LockService.getScriptLock() es uno
 * solo por proyecto: si una funcion lo toma y llama a otra que tambien lo toma y lo suelta, el
 * releaseLock de adentro suelta el de afuera. _pagConCandado_ lo toma solo la primera vez en la
 * ejecucion; las de adentro corren sin volver a tomarlo y solo la de afuera lo suelta. Asi una
 * operacion entera (asignar una factura, guardar un retiro con sus compras) va bajo UN candado.
 */
var _PAG_CANDADO_ = 0;
function _pagConCandado_(fn, ms) {
  if (_PAG_CANDADO_ > 0) return fn();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(ms || 20000)) throw new Error('Alguien más está guardando en este momento. Esperá unos segundos y probá de nuevo.');
  _PAG_CANDADO_++;
  try { return fn(); } finally { _PAG_CANDADO_--; lock.releaseLock(); }
}

/*
 * Cronometro de los guardados (15-oct-2026, Tiempos.js). _pagMedir_ corre el guardado y la
 * pantalla que devuelve, y anota cuanto tardo cada tramo: validar (leer el maestro y calcular
 * el estado antes de escribir), escribir, y recalcular (armar la pantalla de vuelta).
 */
var _PAG_RELOJ_ = null;
function _pagTramo_(nombre) { if (_PAG_RELOJ_) _PAG_RELOJ_.tramo(nombre); }
function _pagMedir_(accion, auth, fn) {
  _PAG_RELOJ_ = tiempoInicio_('Pagos · ' + accion);
  try {
    var out = fn();
    _pagTramo_('recalcular');
    _PAG_RELOJ_.fin();
    return out;
  } finally { _PAG_RELOJ_ = null; }
}

function _pagEscribir_(filas) {
  return _pagConCandado_(function () {
    var sh = pagHoja_(true);
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var datos = filas.map(function (o) {
      o.ID = Utilities.getUuid().slice(0, 8); o.REGISTRADO = new Date();
      return H.map(function (h) { return o.hasOwnProperty(h) ? o[h] : ''; });
    });
    var desde = sh.getLastRow() + 1, iId = H.indexOf('ID');
    // El ID como texto: la hoja guardaba "630e50xx" como el numero 6.30E+50 (un pago a
    // Tiburoncito del 2-oct-2026) y dos IDs asi podian quedar iguales.
    if (iId > -1) sh.getRange(desde, iId + 1, datos.length, 1).setNumberFormat('@');
    sh.getRange(desde, 1, datos.length, H.length).setValues(datos);
    SpreadsheetApp.flush();
    _pagOlvidar_(false);
    _pagTramo_('escribir');
    return datos.length;
  });
}

function _pagFechaValida_(s, nombre) {
  s = String(s || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error((nombre || 'Fecha') + ' invalida: ' + s);
  return s;
}

/**
 * Paga una o varias facturas del MISMO proveedor con una forma de pago. Con una sola factura
 * y un monto menor a su saldo, es un abono. favorUsado: parte del saldo a favor del
 * proveedor que se aplica (el Excel: "pagar Q340, saldo a favor de 85").
 */
function registrarPagoFacturas(auth, llaves, estatus, fechaPagado, monto, favorUsado, detalle, medio) {
  return _pagMedir_('pago de ' + [].concat(llaves || []).length + ' factura(s)', auth, function () {
    var Q = pagQuien_(auth);
    _pagRegistrarPago_(Q, llaves, estatus, fechaPagado, monto, favorUsado, detalle, medio);
    var u = _PAG_ULTIMO_;
    return _pagCambios_(Q, pagEstado_(), [u.nit], (u.abono ? 'Abono guardado: ' : 'Pago guardado: ') + _pagQ_(u.q) + ' a ' + u.proveedor +
      (u.n > 1 ? ' (' + u.n + ' facturas)' : '') + (u.favor > 0.01 ? ' + ' + _pagQ_(u.favor) + ' de saldo a favor' : ''));
  });
}

/** El pago en si. Q: { nombre, areas }. La Caja chica lo llama con todas las areas (Maco paga
 *  de la caja facturas de cocina y de barra). */
function _pagRegistrarPago_(Q, llaves, estatus, fechaPagado, monto, favorUsado, detalle, medio, soloFilas) {
  // Con que se pago (13-oct-2026, Juanma: "¿cómo se identifica con qué banco fue pagado?"). Banco y
  // Tarjeta piden la cuenta o la tarjeta; va al inicio del DETALLE entre corchetes, y un "Banco"
  // solo se confirma con un pago de ESE medio.
  medio = String(medio || '').trim();
  if (estatus === 'Banco' && PAG_MEDIOS_BANCO_.indexOf(medio) === -1) throw new Error('Elegí de qué cuenta salió la transferencia: BI o BAC.');
  if (estatus === 'Tarjeta' && PAG_MEDIOS_TARJETA_.indexOf(medio) === -1) throw new Error('Elegí con qué tarjeta: ' + PAG_MEDIOS_TARJETA_.join(', ') + '.');
  if (medio && (estatus === 'Banco' || estatus === 'Tarjeta')) detalle = '[' + medio + '] ' + String(detalle || '');
  if (PAG_FORMAS_.indexOf(estatus) === -1) throw new Error('Forma de pago desconocida: ' + estatus);
  fechaPagado = _pagFechaValida_(fechaPagado, 'Fecha pagado');
  llaves = [].concat(llaves || []);
  if (!llaves.length) throw new Error('Elegí al menos una factura.');
  var E = pagEstado_(), porLlave = {};
  _pagTramo_('validar');
  E.facturas.forEach(function (f) { porLlave[f.llave] = f; });
  var fs = llaves.map(function (k) {
    var f = porLlave[k];
    if (!f) throw new Error('No encontre la factura ' + k + '. Recarga la pantalla.');
    if (Q.areas.indexOf(f.area) === -1) throw new Error('La factura ' + f.dte + ' es de ' + f.area + '.');
    if (f.saldo <= 0.01) throw new Error('La factura ' + f.dte + ' de ' + f.proveedor + ' ya esta pagada.');
    return f;
  });
  if (fs.some(function (f) { return f.nit !== fs[0].nit; })) throw new Error('Un pago junta facturas de un solo proveedor.');
  favorUsado = _finR_(Number(favorUsado) || 0);
  if (favorUsado < 0) throw new Error('El saldo a favor no puede ser negativo.');
  if (favorUsado > (E.favor[fs[0].nit] || 0) + 0.01) throw new Error('Ese proveedor tiene Q' + _finR_(E.favor[fs[0].nit] || 0) + ' a favor, no Q' + favorUsado + '.');
  var total = _finR_(fs.reduce(function (a, f) { return a + f.saldo; }, 0));
  monto = monto === '' || monto == null ? _finR_(total - favorUsado) : _finR_(Number(monto));
  if (!(monto >= 0)) throw new Error('Monto invalido.');
  if (fs.length > 1 && Math.abs(monto + favorUsado - total) > 0.01) throw new Error('Varias facturas se pagan completas (Q' + total + '). Para abonar, elegí una sola.');
  var base = { AREA: fs[0].area, PROVEEDOR: fs[0].proveedor, NIT: fs[0].nit, 'FECHA PAGADO': fechaPagado,
               'ESTATUS DE PAGO': estatus, DETALLE: String(detalle || '').slice(0, 300), 'ESCRITO POR': Q.nombre };
  var filas = [], restoFavor = favorUsado;
  fs.forEach(function (f, i) {
    var usa = Math.min(restoFavor, f.saldo); restoFavor = _finR_(restoFavor - usa);
    var q = fs.length === 1 ? monto : _finR_(f.saldo - usa);
    if (q > 0 || estatus === 'Banco') filas.push(Object.assign({}, base, { DTE: f.dte, 'CANTIDAD PAGADA': q }));
    if (usa > 0) filas.push(Object.assign({}, base, { DTE: f.dte, 'CANTIDAD PAGADA': usa, 'ESTATUS DE PAGO': 'Saldo a favor usado' }));
  });
  if (soloFilas) return filas;   // registrarRetiroYCompras junta todo y escribe una sola vez
  _pagEscribir_(filas);
  // para la confirmacion de la pantalla ("Pago guardado: Q1,250.00 a Doorways")
  _PAG_ULTIMO_ = { nit: fs[0].nit, proveedor: fs[0].proveedor, n: fs.length, q: _finR_(monto),
                   favor: favorUsado, abono: fs.length === 1 && monto + favorUsado < fs[0].saldo - 0.01 };
  return filas.length;
}
var _PAG_ULTIMO_ = null;

/** Fecha en que se piensa pagar una factura (la columna FECHA DE PAGAR del Excel). */
function programarPagoFactura(auth, llave, fechaPagar) {
  var Q = pagQuien_(auth);
  fechaPagar = _pagFechaValida_(fechaPagar, 'Fecha de pagar');
  var f = pagEstado_().facturas.filter(function (x) { return x.llave === llave; })[0];
  if (!f) throw new Error('No encontre la factura. Recarga la pantalla.');
  if (Q.areas.indexOf(f.area) === -1) throw new Error('La factura es de ' + f.area + '.');
  _pagEscribir_([{ AREA: f.area, PROVEEDOR: f.proveedor, NIT: f.nit, DTE: f.dte, 'FECHA DE PAGAR': fechaPagar,
                   'ESTATUS DE PAGO': 'Programado', 'ESCRITO POR': Q.nombre }]);
  return _pagCambios_(Q, pagEstado_(), [f.nit], 'Fecha de pago guardada: ' + f.proveedor + ', factura ' + f.dte + ', el ' + fechaPagar.slice(8, 10) + '/' + fechaPagar.slice(5, 7));
}

/**
 * Trae a la lista una factura de ANTES de PAG_DESDE_ que sigue sin pagar (solo el dueño).
 * saldo: lo que falta pagar; vacio = la factura entera. La diferencia cuenta como pagada antes.
 * Busca la factura en el FEL por su numero de DTE (y el NIT si hay dos con el mismo numero).
 */
function traerFacturaAnterior(auth, dte, saldo, nit, detalle) {
  var Q = pagQuien_(auth);
  if (Q.rol !== 'dueno') throw new Error('Traer una factura anterior lo hace el dueño.');
  dte = String(dte || '').replace(/\D/g, '');
  if (dte.length < 5) throw new Error('Escribí el número de DTE de la factura.');
  var v = SpreadsheetApp.openById(FIN_MAESTRO_ID).getSheetByName('01_FEL_Maestro').getDataRange().getValues(), hi = -1;
  for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  var H = v[hi].map(function (h) { return String(h || '').trim(); });
  var iN = H.indexOf('Numero_DTE'), iNit = H.indexOf('NIT_Emisor'), iT = H.indexOf('Gran_Total'), iE = H.indexOf('Estado'),
      iEst = H.indexOf('Establecimiento'), iNom = H.indexOf('Nombre_Emisor');
  var hall = v.slice(hi + 1).filter(function (f) {
    return String(f[iN] || '').trim().replace(/\.0$/, '') === dte && String(f[iE] || '').trim() !== 'Anulado' &&
           (!nit || pagNit_(f[iNit]) === pagNit_(nit));
  });
  if (!hall.length) throw new Error('La factura ' + dte + ' no está en el FEL cargado.');
  if (hall.length > 1) throw new Error('Hay ' + hall.length + ' facturas con el número ' + dte + ': indicá el NIT.');
  var f = hall[0], total = _finR_(_finNum_(f[iT]));
  saldo = saldo === '' || saldo == null ? total : _finR_(Number(saldo));
  if (!(saldo > 0) || saldo > total + 0.01) throw new Error('El saldo tiene que estar entre Q0.01 y el total, Q' + total + '.');
  var llave = pagNit_(f[iNit]) + '|' + dte;
  if (pagMovimientos_().some(function (m) { return m.estatus === PAG_ANTERIOR_ && m.nit + '|' + m.dte === llave; }))
    throw new Error('La factura ' + dte + ' ya está en la lista.');
  _pagEscribir_([{ AREA: '', PROVEEDOR: String(f[iEst] || '').trim() || String(f[iNom] || '').trim(), NIT: pagNit_(f[iNit]), DTE: dte,
                   'CANTIDAD PAGADA': saldo, 'ESTATUS DE PAGO': PAG_ANTERIOR_, DETALLE: String(detalle || '').slice(0, 300), 'ESCRITO POR': Q.nombre }]);
  return getPagosProveedores(auth);
}

/** La columna Categoría de 01_FEL_Maestro: { hoja, col (1-based) }. */
function _pagColCategoria_(ss) {
  var sh = ss.getSheetByName('01_FEL_Maestro'), v = sh.getRange(1, 1, 10, sh.getLastColumn()).getValues();
  for (var i = 0; i < v.length; i++) {
    var H = v[i].map(function (h) { return String(h || '').trim(); });
    if (H.indexOf('NIT_Emisor') >= 0) return { hoja: sh, col: H.indexOf('Categoría') + 1, cNit: H.indexOf('NIT_Emisor') + 1, cDte: H.indexOf('Numero_DTE') + 1 };
  }
  throw new Error('No encontre el encabezado de 01_FEL_Maestro.');
}

/** Confirma que la fila del FEL sigue siendo la factura (NIT + DTE) antes de escribirle. */
function _pagFilaEs_(C, fila, nit, dte) {
  var r = C.hoja.getRange(fila, 1, 1, Math.max(C.cNit, C.cDte)).getValues()[0];
  if (pagNit_(r[C.cNit - 1]) !== nit || String(r[C.cDte - 1] || '').trim().replace(/\.0$/, '') !== dte)
    throw new Error('El FEL cambio mientras tanto: tocá Actualizar y probá de nuevo.');
}

/** La pestaña del maestro con las facturas para reducir IVA. Se crea una vez; despues se llena sola. */
function _pagHojaIva_(ss) {
  if (ss.getSheetByName(PAG_HOJA_IVA_)) return;
  var sh = ss.insertSheet(PAG_HOJA_IVA_), F = "'01_FEL_Maestro'!";
  sh.getRange('A1').setValue('Facturas para reducir IVA (FACTURA_AJENA)').setFontWeight('bold');
  sh.getRange('A2').setValue('A nombre de CORSAGA pero ajenas al giro: solo sirven para el credito fiscal. No entran en Pagos, ni en el DRE, ni en ninguna categoria de gasto de los reportes. ' +
    'Se marcan con el boton "Es para reducir IVA" de Pagos en la intranet. Esta pestaña se llena sola desde 01_FEL_Maestro: no escribir aca.');
  sh.getRange('I1:K1').setValues([['Facturas', 'Total', 'IVA']]).setFontWeight('bold');
  sh.getRange('I2:K2').setFormulas([[
    '=COUNTIFS(' + F + 'N5:N4051,"' + PAG_AJENA_ + '",' + F + 'H5:H4051,"Vigente")',
    '=SUMIFS(' + F + 'J5:J4051,' + F + 'N5:N4051,"' + PAG_AJENA_ + '",' + F + 'H5:H4051,"Vigente")',
    '=SUMIFS(' + F + 'K5:K4051,' + F + 'N5:N4051,"' + PAG_AJENA_ + '",' + F + 'H5:H4051,"Vigente")']]);
  sh.getRange('A4:K4').setValues([['Fecha', 'Tipo_DTE', 'Serie', 'Numero_DTE', 'NIT_Emisor', 'Nombre_Emisor', 'Establecimiento', 'Estado', 'Moneda', 'Gran_Total', 'IVA']]).setFontWeight('bold');
  // Sin llaves {..}: el separador de columnas de un arreglo cambia con la configuracion regional.
  sh.getRange('A5').setFormula('=IFERROR(SORT(FILTER(' + F + 'A5:K4051,' + F + 'N5:N4051="' + PAG_AJENA_ + '",' +
    F + 'H5:H4051="Vigente"),1,FALSE),"Sin facturas para IVA")');
  sh.getRange('A5:A').setNumberFormat('dd/mm/yyyy');
  sh.setFrozenRows(4);
}

/**
 * Marca una factura como "para reducir IVA" (solo el dueño): escribe FACTURA_AJENA en su
 * Categoría del FEL. No se puede si ya tiene pagos anotados o casados con el banco: una
 * factura que Rosanta pago es de la operacion.
 */
function marcarFacturaParaIva(auth, llave, nota) {
  var Q = pagQuien_(auth);
  var f = pagEstado_().facturas.filter(function (x) { return x.llave === llave; })[0];
  if (!f) throw new Error('No encontre esa factura en Pagos.');
  // Maco y Jeffry marcan las de su area (13-oct-2026); el dueño, cualquiera
  if (Q.rol !== 'dueno' && Q.areas.indexOf(f.area) === -1) throw new Error('La factura ' + f.dte + ' es de ' + f.area + ': la marca quien lleva esa área o el dueño.');
  if (f.por_correo) throw new Error('La factura ' + f.dte + ' llego por correo y todavia no esta en el FEL del maestro. Se puede marcar despues de la carga del lunes.');
  var pagos = f.pagos.filter(function (p) { return !/antes/i.test(p.estatus); });
  if (pagos.length) throw new Error('La factura ' + f.dte + ' ya tiene pagos anotados (' + pagos.map(function (p) { return p.estatus; }).join(', ') +
    '). Si es para reducir IVA, anulá primero esos pagos.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID), C = _pagColCategoria_(ss);
    _pagFilaEs_(C, f.fila, f.nit, f.dte);
    C.hoja.getRange(f.fila, C.col).setValue(PAG_AJENA_);
    _pagHojaIva_(ss);
    SpreadsheetApp.flush();
    _pagOlvidar_(true);   // cambio la Categoria del FEL: el maestro se vuelve a leer
  } finally { lock.releaseLock(); }
  _pagEscribir_([{ AREA: f.area, PROVEEDOR: f.proveedor, NIT: f.nit, DTE: f.dte, 'CANTIDAD PAGADA': f.total, 'ESTATUS DE PAGO': PAG_IVA_MARCA_,
                   DETALLE: ('Antes ' + f.categoria + '. ' + String(nota || '')).trim().slice(0, 300), 'ESCRITO POR': Q.nombre }]);
  try { CacheService.getScriptCache().remove(finCacheClave_()); } catch (e) { /* el DRE se pone al dia cuando venza su cache */ }
  return getPagosProveedores(auth);
}

/**
 * Devuelve una factura marcada para IVA a su categoria de siempre (solo el dueño): vuelve a
 * poner la formula que toma la categoria de 00_Proveedores. Si el proveedor entero esta como
 * FACTURA_AJENA (la gasolinera), se cambia en 00_Proveedores, no aca.
 */
function devolverFacturaParaIva(auth, llave) {
  var Q = pagQuien_(auth);
  var a = pagEstado_().ajenas.filter(function (x) { return x.llave === llave; })[0];
  if (!a) throw new Error('Esa factura ya no esta marcada para reducir IVA.');
  // la devuelve quien la marco, o el dueño
  if (Q.rol !== 'dueno') {
    var marco = ''; pagMovimientos_().forEach(function (m) { if (m.estatus === PAG_IVA_MARCA_ && m.nit + '|' + m.dte === llave) marco = m.por; });
    if (marco !== Q.nombre) throw new Error('Esa factura la marcó ' + (marco || 'el dueño') + ': la devuelve esa persona o el dueño.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID), C = _pagColCategoria_(ss);
    _pagFilaEs_(C, a.fila, a.nit, a.dte);
    var celda = C.hoja.getRange(a.fila, C.col);
    if (celda.getFormula()) throw new Error('El proveedor ' + a.proveedor + ' esta entero como FACTURA_AJENA en 00_Proveedores: se cambia ahi, no factura por factura.');
    celda.setFormula('=IF(G' + a.fila + '="","",IFERROR(VLOOKUP(G' + a.fila + ",'00_Proveedores'!A:C,3,FALSE()),\"POR_CLASIFICAR\"))");
    SpreadsheetApp.flush();
    _pagOlvidar_(true);
  } finally { lock.releaseLock(); }
  _pagEscribir_([{ PROVEEDOR: a.proveedor, NIT: a.nit, DTE: a.dte, 'CANTIDAD PAGADA': a.total, 'ESTATUS DE PAGO': PAG_IVA_DEVUELTA_, 'ESCRITO POR': Q.nombre }]);
  try { CacheService.getScriptCache().remove(finCacheClave_()); } catch (e) { /* idem */ }
  return getPagosProveedores(auth);
}

/**
 * Lo que Rosanta le debe a cada uno del equipo por pagar proveedores de su bolsa. Lee solo
 * PAGOS_PROVEEDORES (sin FEL ni banco): la pantalla de inicio lo pide en cada entrada.
 * El dueño ve a los dos; José y Jeffry, solo lo suyo.
 */
function _pagPorDevolver_(Q) {
  var movs = pagMovimientos_();
  // Pestaña en comun (Juanma, 13-oct-2026): cada quien agrega las facturas que pago de su bolsa
  // y todos ven las de todos, asi cada uno identifica las suyas.
  return PAG_EQUIPO_.map(function (e) {
    var x = { nombre: e.nombre, forma: e.forma, pagado: 0, devuelto: 0, n: 0, movs: [] };
    movs.forEach(function (m) {
      if (m.estatus === e.forma) { x.pagado += m.q; x.n++; }
      else if (m.estatus === e.devuelto) x.devuelto += m.q;
      else return;
      x.movs.push({ id: m.id, fecha: m.fecha_pagado, proveedor: m.proveedor, dte: m.dte, q: m.q, estatus: m.estatus, detalle: m.detalle, por: m.por });
    });
    x.movs.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    x.pagado = _finR_(x.pagado); x.devuelto = _finR_(x.devuelto); x.pendiente = _finR_(x.pagado - x.devuelto);
    return x;
  });
}

/** De quien es un pago de su bolsa: el que entra (Jeffry o José); el dueño elige por nombre. */
function _pagEquipoDe_(Q, nombre) {
  var e = Q.rol === 'dueno' ? PAG_EQUIPO_.filter(function (x) { return x.nombre === nombre; })[0]
                            : PAG_EQUIPO_.filter(function (x) { return x.rol === Q.rol; })[0];
  if (!e) throw new Error('Por devolver es de Jeffry y José.');
  if (Q.rol !== 'dueno' && nombre && nombre !== e.nombre) throw new Error('Solo podés agregar lo que pagaste vos.');
  return e;
}

/** Las facturas por pagar de todas las areas, para elegir la que uno pago de su bolsa. */
function getFacturasParaDevolver(auth) {
  pagQuien_(auth);
  return pagEstado_().facturas.filter(function (f) { return f.saldo > 0.01; }).map(function (f) {
    return { llave: f.llave, proveedor: f.proveedor, dte: f.dte, fecha: f.fecha, saldo: f.saldo, total: f.total, grupo: f.grupo, estado: f.estado };
  }).sort(function (a, b) { return a.proveedor < b.proveedor ? -1 : a.proveedor > b.proveedor ? 1 : (a.fecha < b.fecha ? -1 : 1); });
}

/** Por devolver: una o varias facturas (del mismo proveedor) que uno pago de su bolsa. Salen de Por pagar. */
function agregarFacturaDeSuBolsa(auth, nombre, llaves, fecha, monto, nota) {
  var Q = pagQuien_(auth), e = _pagEquipoDe_(Q, nombre);
  // cualquier area: Maco a veces paga una factura de cocina y Jeffry una de barra
  _pagRegistrarPago_({ nombre: Q.nombre, rol: Q.rol, areas: ['COCINA', 'BARRA', 'ADMIN'] }, llaves, e.forma, fecha,
                     monto === '' || monto == null ? null : monto, 0, nota);
  var u = _PAG_ULTIMO_;
  return _pagCambios_(Q, pagEstado_(), [u.nit], 'Anotado en Por devolver: ' + _pagQ_(u.q) + ' a ' + u.proveedor);
}

/** Por devolver: una compra sin factura que uno pago de su bolsa. */
function agregarCompraDeSuBolsa(auth, nombre, fecha, proveedor, detalle, monto) {
  var Q = pagQuien_(auth), e = _pagEquipoDe_(Q, nombre);
  fecha = _pagFechaValida_(fecha, 'Fecha');
  monto = _finR_(Number(monto));
  if (!(monto > 0)) throw new Error('Escribí cuánto pagaste.');
  detalle = String(detalle || '').trim();
  if (detalle.length < 3) throw new Error('Escribí qué se compró.');
  _pagEscribir_([{ AREA: e.rol === 'sala' ? 'BARRA' : 'COCINA', PROVEEDOR: String(proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado',
                   DTE: PAG_SIN_FACTURA_, 'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': e.forma,
                   DETALLE: detalle.slice(0, 600), 'ESCRITO POR': Q.nombre }]);
  return _pagCambios_(Q, null, [], 'Anotado en Por devolver: ' + _pagQ_(monto) + ' de ' + (String(proveedor || 'Mercado').trim() || 'Mercado'));
}

/** Para la pantalla de inicio: cuanto se le debe a José y a Jeffry. */
function getPorDevolverEquipo(auth) {
  var Q = pagQuien_(auth);
  return { rol: Q.rol, personas: _pagPorDevolver_(Q).map(function (x) {
    return { nombre: x.nombre, pagado: x.pagado, devuelto: x.devuelto, pendiente: x.pendiente, n: x.n }; }) };
}

/** El dueño anota que le devolvio a José o a Jeffry lo que pagaron de su bolsa. */
function registrarDevolucionEquipo(auth, nombre, monto, fecha, detalle) {
  return _pagMedir_('devolución al equipo', auth, function () {
    var Q = pagQuien_(auth);
    if (Q.rol !== 'dueno') throw new Error('Registrar una devolución lo hace el dueño.');
    var e = PAG_EQUIPO_.filter(function (x) { return x.nombre === nombre; })[0];
    if (!e) throw new Error('No conozco a ' + nombre + '.');
    fecha = _pagFechaValida_(fecha, 'Fecha');
    monto = _finR_(Number(monto));
    if (!(monto > 0)) throw new Error('Monto invalido.');
    var x = _pagPorDevolver_(Q).filter(function (p) { return p.nombre === nombre; })[0];
    if (monto > x.pendiente + 0.01) throw new Error('A ' + nombre + ' se le deben Q' + x.pendiente.toFixed(2) + '; no se puede devolver Q' + monto.toFixed(2) + '.');
    _pagEscribir_([{ AREA: 'ADMIN', PROVEEDOR: 'Devolución a ' + nombre, 'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto,
                     'ESTATUS DE PAGO': e.devuelto, DETALLE: String(detalle || '').slice(0, 300), 'ESCRITO POR': Q.nombre }]);
    return _pagCambios_(Q, null, [], 'Devolución anotada: ' + _pagQ_(monto) + ' a ' + nombre);
  });
}

/** Un saldo a favor que el proveedor le reconoce a Rosanta (credito, devolucion, pago de mas). */
function registrarSaldoFavor(auth, nit, monto, detalle) {
  return _pagMedir_('saldo a favor', auth, function () {
    var Q = pagQuien_(auth);
    nit = pagNit_(nit); monto = _finR_(Number(monto));
    if (!(monto > 0)) throw new Error('Monto invalido.');
    if (String(detalle || '').trim().length < 3) throw new Error('Escribí de dónde sale el saldo a favor.');
    var f = pagEstado_().facturas.filter(function (x) { return x.nit === nit && Q.areas.indexOf(x.area) !== -1; })[0];
    if (!f) throw new Error('Ese proveedor no tiene facturas de tu area desde el ' + PAG_DESDE_ + '.');
    _pagEscribir_([{ AREA: f.area, PROVEEDOR: f.proveedor, NIT: nit, 'FECHA PAGADO': medFechaIso_(new Date()),
                     'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': 'Saldo a favor', DETALLE: String(detalle).slice(0, 300), 'ESCRITO POR': Q.nombre }]);
    return _pagCambios_(Q, pagEstado_(), [nit], 'Saldo a favor anotado: ' + _pagQ_(monto) + ' de ' + f.proveedor);
  });
}

/**
 * Compra de mercado sin factura. Queda en el mismo registro, con DTE "SIN FACTURA" (como en el
 * Excel: "MERCADO", "Gas evento SIN DTE"). Si salio de un retiro de cajero, Compras en efectivo
 * la ofrece como detalle de ese retiro cuando el banco lo traiga (medMercadoDeRetiros_).
 */
function registrarCompraMercado(auth, fecha, proveedor, detalle, monto, area, estatus, medio) {
  return _pagMedir_('compra de mercado', auth, function () {
    var Q = pagQuien_(auth);
    fecha = _pagFechaValida_(fecha, 'Fecha');
    monto = _finR_(Number(monto));
    if (!(monto > 0)) throw new Error('Monto invalido.');
    detalle = String(detalle || '').trim();
    if (detalle.length < 3) throw new Error('Escribí qué se compró.');
    if (PAG_FORMAS_MERCADO_.indexOf(estatus) === -1) throw new Error('Forma de pago desconocida: ' + estatus);
    // con Tarjeta, cual (14-oct-2026): igual que en las facturas, entre corchetes al inicio del
    // DETALLE. "[Tarjeta débito BI]" es lo que lee el cuadre de Compras (ComprasEfectivo.js).
    medio = String(medio || '').trim();
    if (estatus === 'Tarjeta') {
      if (PAG_MEDIOS_TARJETA_.indexOf(medio) === -1) throw new Error('Elegí con qué tarjeta: ' + PAG_MEDIOS_TARJETA_.join(', ') + '.');
      detalle = '[' + medio + '] ' + detalle;
    }
    area = String(area || '').toUpperCase();
    if (Q.areas.indexOf(area) === -1 || area === 'ADMIN') area = Q.areas[0];
    var prov = String(proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado';
    _pagEscribir_([{ AREA: area, PROVEEDOR: prov, DTE: PAG_SIN_FACTURA_,
                     'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': estatus,
                     DETALLE: detalle.slice(0, 600), 'ESCRITO POR': Q.nombre }]);
    // sin factura no cambia ninguna factura: no se lee el maestro
    return _pagCambios_(Q, null, [], 'Compra guardada: ' + _pagQ_(monto) + ' en ' + prov);
  });
}

/** Anula un movimiento anotado por error. No se borra: el estatus pasa a "ANULADO: ...". */
function anularMovimientoPago(auth, id) {
  return _pagMedir_('anular', auth, function () {
    var Q = pagQuien_(auth);
    var m = pagMovimientos_().filter(function (x) { return x.id === String(id || '').trim(); })[0];
    _pagAnular_(Q, id);
    _pagTramo_('escribir');
    var que = m ? _pagQ_(m.q) + ' · ' + m.proveedor : '';
    // Solo los pagos comunes van por el camino rapido. Anular un "No pertenece", un "Confirmado con
    // banco", una marca de IVA o una factura traida mueve Posibles pagos y la lista de IVA: pantalla entera.
    var comun = m && (PAG_FORMAS_.indexOf(m.estatus) !== -1 || PAG_FORMAS_MERCADO_.indexOf(m.estatus) !== -1 ||
      ['Saldo a favor', 'Saldo a favor usado', 'Programado'].indexOf(m.estatus) !== -1 ||
      PAG_EQUIPO_.some(function (e) { return e.forma === m.estatus || e.devuelto === m.estatus; }));
    if (!comun) return getPagosProveedores(auth);
    // sin factura o devolucion al equipo: no toca facturas, no se lee el maestro
    if (!m.nit || m.dte === PAG_SIN_FACTURA_) return _pagCambios_(Q, null, [], 'Anulado: ' + que);
    return _pagCambios_(Q, pagEstado_(), [m.nit], 'Anulado: ' + que);
  });
}
/**
 * El anular en si. Q: { nombre, rol, areas }. Tambien lo usa Compras al asignar la factura.
 * texto: el estatus nuevo (por defecto "ANULADO: <el de antes> (quien, fecha)"). Devuelve
 * { fila, col, antes } para poder devolverlo (_pagDesanular_). Desde el 14-oct-2026 avisa si no
 * encontro el movimiento o si ya estaba anulado (antes salia callado).
 */
function _pagAnular_(Q, id, texto) {
  id = String(id || '').trim();
  if (!id) throw new Error('Falta el movimiento.');
  return _pagConCandado_(function () {
    var sh = pagHoja_(false);
    if (!sh) throw new Error('No hay movimientos.');
    var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
    var iId = H.indexOf('ID'), iE = H.indexOf('ESTATUS DE PAGO'), iA = H.indexOf('AREA'), iP = H.indexOf('ESCRITO POR');
    var miForma = (PAG_EQUIPO_.filter(function (e) { return e.rol === Q.rol; })[0] || {}).forma;
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iId]) !== id) continue;
      var est = String(v[r][iE] || '');
      if (/^ANULADO/i.test(est)) throw new Error('Ese movimiento ya estaba anulado. Tocá Actualizar.');
      if (est === PAG_ANTERIOR_ && Q.rol !== 'dueno') throw new Error('Esa fila es la que trajo la factura desde COMPRAS_2026, no un pago. Si la factura no se debe, avisá al dueño.');
      // lo que uno agrego en Por devolver lo anula el mismo, aunque la factura sea de la otra area
      var suyo = miForma && est === miForma && String(v[r][iP]) === Q.nombre;
      if (Q.rol !== 'dueno' && !suyo && Q.areas.indexOf(String(v[r][iA]).toUpperCase()) === -1) throw new Error('Ese movimiento es de ' + v[r][iA] + '.');
      sh.getRange(r + 1, iE + 1).setValue(texto || ('ANULADO: ' + est + ' (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')'));
      SpreadsheetApp.flush();
      _pagOlvidar_(false);
      return { fila: r + 1, col: iE + 1, antes: est };
    }
    throw new Error('No encontré ese movimiento. Tocá Actualizar.');
  });
}
/** Devuelve el estatus que tenia un movimiento antes de _pagAnular_ (si lo que seguia fallo). */
function _pagDesanular_(A) {
  return _pagConCandado_(function () {
    pagHoja_(false).getRange(A.fila, A.col).setValue(A.antes);
    SpreadsheetApp.flush();
    _pagOlvidar_(false);
  });
}

/**
 * Para Compras en efectivo: las compras de mercado pagadas con un retiro de cajero, por
 * fecha, para ofrecerlas como detalle del retiro. No lee el FEL ni el banco.
 */
function medMercadoDeRetiros_() {
  try {
    return pagMovimientos_().filter(function (m) { return m.dte === PAG_SIN_FACTURA_ && m.estatus === 'Retiro de cajero'; })
      .map(function (m) { return { fecha: m.fecha_pagado, q: m.q, proveedor: m.proveedor, detalle: m.detalle, area: m.area }; });
  } catch (e) { return []; }
}

/* ---- BALANCE DEL AÑO POR PROVEEDOR (29-sep-2026, pedido de Juanma) ----
   Lo facturado en 2026 (FEL) contra lo pagado, por NIT. Lo pagado sale de tres lados:
   (1) el banco y la tarjeta, cuando la glosa trae un DTE del proveedor o su nombre;
   (2) COMPRAS_2026, las filas pagadas de caja, tarjeta o por Maco/Jeffry (el historial
       antes de esta pantalla; las filas "BI" se cuentan por el banco, no aca);
   (3) este registro (PAGOS_PROVEEDORES), lo que no es Banco.
   La diferencia NO es deuda confirmada: lo pagado en enero puede ser de diciembre de 2025,
   el banco llega hasta su ultima carga y una glosa sin el nombre no se cuenta. Es la lista
   para preguntar, y al lado va lo que ya esta cargado por pagar para ver cuanto queda sin
   explicar. Solo el dueño. */
var PAG_COMPRAS_ID_ = '1Py2KLc8o2GYzJhosnpi_R0OsDU76xa6d_F9B_UuUq0o';
// Proveedores cuyo nombre en el banco no se parece al del FEL.
var PAG_ALIAS_BANCO_ = { '336211': ['avicola', 'villalobos'], '37027107': ['tavito', 'donis'], '96569239': ['doorway', '902410067'],
  '47215682': ['elder', 'marroquin'], '110989163': ['migdalia', 'alpes'],
  '52496325': ['verdura', 'dona mina', 'anona'], '47687916': ['marisco', 'tiburon', 'pescad'], '345377': ['licorera', 'nacional'], '5564662': ['altogas'], '74382489': ['entrevinos', 'vinos de altura'] };
var PAG_VACIAS_BAL_ = ['antigua', 'ventas', 'productos', 'alimentos', 'bebidas', 'market', 'supermercados', 'super', 'tienda',
  'agencia', 'condado', 'naranjo', 'vinos', 'cafe', 'sala', 'central', 'nueva concepcion'];
var PAG_EFECTIVO_ = /carnic|carne|marraner/;
// Proveedores que se pagaron en efectivo hasta una fecha (Juanma, 29-sep-2026: Doña Mina y la
// pescaderia, julio y agosto). Sus facturas hasta ese dia cuentan como pagadas de caja.
var PAG_EFECTIVO_HASTA_ = { '52496325': '2026-08-31', '47687916': '2026-08-31' };
var PAG_CAT_BAL_ = ['ALIMENTOS', 'BEBIDAS', 'COCTELERIA', 'LICORES', 'SUMINISTRO DE LIMPIEZA', 'GAS', 'MANTENIMIENTO', 'MANTENIMIENTO Y ACCESORIOS EQUIPO', 'EVENTOS'];

function _pagClaves_(nombres, nit) {
  var ks = {};
  nombres.forEach(function (s) { _pagPalabras_(s).forEach(function (w) { if (w.length >= 5 && PAG_VACIAS_BAL_.indexOf(w) === -1) ks[w] = 1; }); });
  (PAG_ALIAS_BANCO_[nit] || []).forEach(function (w) { ks[w] = 1; });
  return Object.keys(ks);
}

/** El NIT al que apunta un texto: primero por DTE, despues por nombre (unico). null si no se sabe. */
function _pagNitDeTexto_(texto, porDte, claves) {
  var nums = String(texto || '').match(/\d{6,}/g) || [];
  for (var i = 0; i < nums.length; i++) if (porDte[nums[i]]) return porDte[nums[i]];
  var t = ' ' + normalizar_(texto).replace(/[^a-z0-9 ]/g, ' ') + ' ' + String(texto || '');
  var hits = {};
  Object.keys(claves).forEach(function (n) {
    claves[n].forEach(function (k) { if (t.indexOf(k) !== -1) hits[n] = (hits[n] || 0) + 1; });
  });
  var ns = Object.keys(hits).sort(function (a, b) { return hits[b] - hits[a]; });
  if (!ns.length) return null;
  // empate: solo vale si son el mismo proveedor con dos NIT (La Bodegona), que se suman en una fila
  var emp = ns.filter(function (n) { return hits[n] === hits[ns[0]]; });
  if (emp.length > 1 && emp.some(function (n) { return claves[n].join() !== claves[emp[0]].join(); })) return null;
  return ns[0];
}

function _pagBalance_(anio) {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var v = ss.getSheetByName('01_FEL_Maestro').getDataRange().getValues(), hi = -1;
  for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  var H = v[hi].map(function (h) { return String(h || '').trim(); }), c = function (n) { return H.indexOf(n); };
  var P = {}, porDte = {}, nombres = {};
  v.slice(hi + 1).forEach(function (f) {
    var d = pagDia_(f[c('Fecha')]);
    if (!d || d.getFullYear() !== anio || String(f[c('Estado')] || '').trim() === 'Anulado' || String(f[c('Es_Personal')] || '').trim() === 'Sí') return;
    var cat = String(f[c('Categoría')] || '').trim(), nit = pagNit_(f[c('NIT_Emisor')]);
    var num = String(f[c('Numero_DTE')] || '').trim().replace(/\.0$/, '');
    porDte[num] = nit;
    if (PAG_CAT_BAL_.indexOf(cat) === -1) return;
    var q = _finR_(_finNum_(f[c('Gran_Total')]));
    if (!(q > 0)) return;
    var x = P[nit] = P[nit] || { nit: nit, proveedor: String(f[c('Establecimiento')] || '').trim() || String(f[c('Nombre_Emisor')] || '').trim(),
      grupo: PAG_GRUPO_CAT_[cat] || 'ADMIN', n: 0, facturado: 0, banco: 0, caja: 0, registro: 0, pendiente: 0, n_pagos: 0, ult_pago: '', primera: pagIso_(d), ultima: pagIso_(d) };
    x.n++; x.facturado += q;
    if (PAG_EFECTIVO_HASTA_[nit] && pagIso_(d) <= PAG_EFECTIVO_HASTA_[nit]) { x.caja += q; x.efectivo_hasta = PAG_EFECTIVO_HASTA_[nit]; }
    if (pagIso_(d) < x.primera) x.primera = pagIso_(d);
    if (pagIso_(d) > x.ultima) x.ultima = pagIso_(d);
    // Por el nombre COMERCIAL: el legal suele ser el de una persona y choca con el equipo
    // (el de Altogas lleva "Efrain", igual que un mesero: su planilla se le sumaba).
    nombres[nit] = (nombres[nit] || []).concat([String(f[c('Establecimiento')] || '').trim() || String(f[c('Nombre_Emisor')] || '')]);
  });
  var claves = {};
  Object.keys(P).forEach(function (n) { claves[n] = _pagClaves_(nombres[n] || [], n); });
  var anota = function (nit, q, fecha, campo) {
    var x = P[nit]; if (!x) return;
    x[campo] += q; x.n_pagos++;
    if (fecha && fecha > x.ult_pago) x.ult_pago = fecha;
  };
  // (1) banco y tarjeta
  var bancoHasta = {};
  [['03_Banco_Industrial', 'Débito', 'Descripción'], ['04_Banco_BAC', 'Débito', 'Descripción'], ['05_Tarjeta_Credito_BAC', 'Quetzales', 'Descripción'], ['06_Tarjeta_Credito_BI', 'Quetzales', 'Descripción']].forEach(function (b) {
    var sh = ss.getSheetByName(b[0]); if (!sh) return;
    var w = sh.getDataRange().getValues(), h = -1;
    for (var i = 0; i < Math.min(w.length, 10); i++) if (w[i].map(String).indexOf('Categoría') >= 0) { h = i; break; }
    if (h < 0) return;
    var HB = w[h].map(function (x) { return String(x || '').trim(); });
    var iF = HB.indexOf('Fecha'), iQ = HB.indexOf(b[1]), iD = HB.indexOf(b[2]), iP = HB.indexOf('Es_Personal'), iC = HB.indexOf('Categoría');
    for (var r = h + 1; r < w.length; r++) {
      var d = pagDia_(w[r][iF]); if (!d || d.getFullYear() !== anio) continue;
      var fi = pagIso_(d); if (!bancoHasta[b[0]] || fi > bancoHasta[b[0]]) bancoHasta[b[0]] = fi;
      var q = _finR_(_finNum_(w[r][iQ])); if (!(q > 0) || String(w[r][iP] || '').trim() === 'Sí') continue;
      // lo que no es pago a un proveedor no se busca: planilla, propinas, impuestos, personal, retiros
      if (/^(NOMINA|PROPINA|IGSS|PERSONAL|DEVOLUCION|IMPUESTO|ISR|IVA|INGRESO|TRANSFERENCIA|COMISION)/.test(String(w[r][iC] || '').trim())) continue;
      // los retiros de cajero no nombran a nadie; los pagos "S31 Mariscos" o "Mercado Verduras"
      // van como ALIMENTOS_EFECTIVO pero son transferencias con nombre y si cuentan
      if (/^(ATM|RETIRO|A-|F-)/i.test(String(w[r][iD] || '').trim())) continue;
      var nit = _pagNitDeTexto_(w[r][iD], porDte, claves);
      if (nit) anota(nit, q, fi, 'banco');
    }
  });
  // (2) COMPRAS_2026: solo lo pagado fuera del banco
  var avisos = [];
  try {
    var CAJA = /caja|tarjet|targ|maco|jeffry|visalink|efectivo/i;
    SpreadsheetApp.openById(PAG_COMPRAS_ID_).getSheets().forEach(function (sh) {
      sh.getDataRange().getValues().forEach(function (row) {
        var resto = row.slice(3, 10).map(function (x) { return x instanceof Date ? pagIso_(x) : String(x); }).join(' ');
        if (!CAJA.test(resto) || /saldo a favor/i.test(resto)) return;
        var q = null;
        for (var k = 3; k < 8 && q === null; k++) if (typeof row[k] === 'number' && row[k] > 0.5 && row[k] < 100000) q = row[k];
        if (q === null) return;
        var dtes = String(row[2] || '').match(/\d{6,}/g) || [];
        var fp = null; for (var j = 3; j < 6; j++) if (row[j] instanceof Date) { fp = row[j]; break; }
        // el año: por la factura si trae DTE del FEL, si no por la fecha pagado; sin ninguno, fuera
        var es = dtes.some(function (d) { return porDte[d]; }) || (fp && fp.getFullYear() === anio);
        if (!es) return;
        var nit = _pagNitDeTexto_(String(row[2] || '') + ' ' + String(row[1] || ''), porDte, claves);
        if (nit) anota(nit, _finR_(q), fp ? pagIso_(fp) : '', 'caja');
      });
    });
  } catch (e) { avisos.push('No pude leer COMPRAS_2026: ' + e.message); }
  // (3) este registro, y lo que ya esta cargado por pagar
  var E = pagEstado_();
  pagMovimientos_().forEach(function (m) {
    if (m.dte === PAG_SIN_FACTURA_ || /Banco|Saldo a favor|Programado|Pendiente anterior|Devuelto a|Para IVA/.test(m.estatus)) return;
    if (m.fecha_pagado && m.fecha_pagado.slice(0, 4) === String(anio)) anota(m.nit, m.q, m.fecha_pagado, 'registro');
  });
  E.facturas.forEach(function (f) { if (P[f.nit] && f.saldo > 0.01) P[f.nit].pendiente += f.saldo; });
  // un mismo nombre comercial con varios NIT (La Bodegona) va en una sola fila
  var U = {};
  Object.keys(P).forEach(function (n) {
    var x = P[n], k = normalizar_(x.proveedor);
    if (!U[k]) { U[k] = x; return; }
    var u = U[k];
    ['n', 'facturado', 'banco', 'caja', 'registro', 'pendiente', 'n_pagos'].forEach(function (c) { u[c] += x[c]; });
    u.nit += ' · ' + x.nit;
    if (x.ult_pago > u.ult_pago) u.ult_pago = x.ult_pago;
  });
  var filas = Object.keys(U).map(function (n) {
    var x = U[n];
    ['facturado', 'banco', 'caja', 'registro', 'pendiente'].forEach(function (k) { x[k] = _finR_(x[k]); });
    x.pagado = _finR_(x.banco + x.caja + x.registro);
    x.diferencia = _finR_(x.facturado - x.pagado);
    x.sin_explicar = _finR_(x.diferencia - x.pendiente);
    // Lo unico que se paga en efectivo es la carne (Juanma, 29-sep-2026): no se le busca pago.
    x.efectivo = PAG_EFECTIVO_.test(normalizar_(x.proveedor));
    return x;
  }).sort(function (a, b) { return b.sin_explicar - a.sin_explicar; });
  return { anio: anio, filas: filas, banco_hasta: bancoHasta, avisos: avisos,
           gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
}

/** La pestaña Balance del año de Pagos. Solo el dueño; caché de 20 minutos. */
function getBalanceProveedores(auth, forzar) {
  var Q = pagQuien_(auth);
  if (Q.rol !== 'dueno') throw new Error('El balance del año es solo para el dueño.');
  var anio = new Date().getFullYear(), cache = CacheService.getScriptCache(), clave = 'pag_balance_v1_' + anio;
  if (!forzar) { var c = cache.get(clave); if (c) return JSON.parse(c); }
  var r = _pagBalance_(anio);
  try { cache.put(clave, JSON.stringify(r), 1200); } catch (e) {}
  return r;
}
