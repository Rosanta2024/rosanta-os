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
var PAG_DESDE_ = '2026-09-28';
// Formas de pago que se eligen con un toque. 'Retiro de cajero' es solo para el mercado.
var PAG_FORMAS_ = ['Pagado de caja', 'Tarjeta', 'Banco', 'Pagó Maco', 'Pagó Jeffry'];
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

/** Los movimientos anotados, sin los anulados. */
function pagMovimientos_() {
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
function pagFacturas_(ss, anteriores) {
  anteriores = anteriores || {};
  var v = ss.getSheetByName('01_FEL_Maestro').getDataRange().getValues();
  var hi = -1;
  for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('NIT_Emisor') >= 0) { hi = i; break; }
  if (hi < 0) throw new Error('No encontre el encabezado de 01_FEL_Maestro.');
  var H = v[hi].map(function (h) { return String(h || '').trim(); });
  var c = function (n) { var k = H.indexOf(n); if (k < 0) throw new Error('01_FEL_Maestro no tiene la columna ' + n); return k; };
  var iF = c('Fecha'), iS = c('Serie'), iN = c('Numero_DTE'), iNit = c('NIT_Emisor'), iNom = c('Nombre_Emisor'),
      iEst = c('Establecimiento'), iE = c('Estado'), iT = c('Gran_Total'), iC = c('Categoría'), iP = c('Es_Personal'),
      iTipo = H.indexOf('Tipo_DTE');
  var filas = v.slice(hi + 1), porNit = _pagAreaPorNit_(filas, iNit, iC);
  var desde = pagDia_(PAG_DESDE_), out = [];
  filas.forEach(function (f) {
    var d = pagDia_(f[iF]);
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
      llave: nit + '|' + numero, nit: nit, dte: numero, serie: String(f[iS] || '').trim(),
      proveedor: String(f[iEst] || '').trim() || String(f[iNom] || '').trim(),
      razon: String(f[iNom] || '').trim(), fecha: pagIso_(d), dia: pagNumDia_(d), total: total, categoria: cat,
      area: PAG_AREA_CAT_[cat] || porNit[nit] || 'ADMIN',
      grupo: PAG_GRUPO_CAT_[cat] || (PAG_AREA_CAT_[cat] || porNit[nit] ? (PAG_AREA_CAT_[cat] || porNit[nit]) === 'BARRA' ? 'BEBIDAS Y COCTELERIA' : 'ALIMENTOS' : 'ADMIN')
    });
  });
  return out;
}

/** Los debitos del BI y del BAC desde unos dias antes de PAG_DESDE_, sin retiros de cajero. */
function pagPagosBanco_(ss) {
  var desde = pagNumDia_(pagDia_(PAG_DESDE_)) - 10, out = [];
  [['03_Banco_Industrial', 'BI', 'Débito'], ['04_Banco_BAC', 'BAC', 'Débito']].forEach(function (b) {
    var sh = ss.getSheetByName(b[0]);
    if (!sh) return;
    var v = sh.getDataRange().getValues(), hi = -1;
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
      out.push({ llave: b[0] + '|' + r, banco: b[1], fecha: pagIso_(d), dia: pagNumDia_(d), q: q, glosa: desc, categoria: cat });
    }
  });
  return out;
}

var PAG_PALABRAS_VACIAS_ = ['sociedad', 'anonima', 'distribuidora', 'distribuidor', 'comercial', 'comercializadora',
  'guatemala', 'industrias', 'industria', 'grupo', 'empresa', 'servicios', 'varios', 'pago', 'pagos', 'transferencia'];
function _pagPalabras_(s) {
  return normalizar_(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function (w) {
    return w.length >= 4 && !/^\d+$/.test(w) && PAG_PALABRAS_VACIAS_.indexOf(w) === -1;
  });
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
    var pal = _pagPalabras_(p.glosa);
    var conNombre = cand.filter(function (f) { return (f.palabras || []).some(function (w) { return pal.indexOf(w) !== -1; }); });
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

/** Arma el estado de cada factura y el cuadre por proveedor. Sin filtrar por area. */
function pagEstado_() {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var movs = pagMovimientos_(), anteriores = {};
  movs.forEach(function (m) { if (m.estatus === PAG_ANTERIOR_) anteriores[m.nit + '|' + m.dte] = m.q; });
  var facturas = pagFacturas_(ss, anteriores), banco = pagPagosBanco_(ss);
  var porLlave = {};
  facturas.forEach(function (f) {
    f.pagado = 0; f.favor_usado = 0; f.pagos = []; f.fecha_pagar = ''; f.marca_banco = null;
    porLlave[f.llave] = f;
  });
  var favor = {}, mercado = [], favores = [];   // saldo a favor por NIT; compras sin factura
  movs.forEach(function (m) {
    if (m.dte === PAG_SIN_FACTURA_) { mercado.push(m); return; }
    if (m.estatus === 'Saldo a favor') { favor[m.nit] = (favor[m.nit] || 0) + m.q; favores.push(m); return; }
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
    else if (m.estatus === 'Banco') f.marca_banco = pagNumDia_(pagDia_(m.fecha_pagado) || new Date());
    else f.pagado += m.q;
    f.pagos.push({ id: m.id, fecha: m.fecha_pagado, q: m.q, estatus: m.estatus, por: m.por, detalle: m.detalle });
  });
  // El banco confirma lo que falta pagar
  var abiertas = facturas.filter(function (f) { return f.total - f.pagado - f.favor_usado > 0.01; }).map(function (f) {
    return { llave: f.llave, nit: f.nit, dte: f.dte, dia: f.dia, saldo: _finR_(f.total - f.pagado - f.favor_usado),
             palabras: _pagPalabras_(f.proveedor + ' ' + f.razon), marcaBanco: f.marca_banco };
  });
  var cb = _pagCasarBanco_(abiertas, banco), pagoPorLlave = {};
  banco.forEach(function (p) { pagoPorLlave[p.llave] = p; });
  facturas.forEach(function (f) {
    var pl = cb.casados[f.llave];
    if (pl) {
      var p = pagoPorLlave[pl], s = _finR_(f.total - f.pagado - f.favor_usado);
      f.pagado += s;
      f.pagos.push({ id: '', fecha: p.fecha, q: s, estatus: 'Banco confirmado', por: p.banco, detalle: p.glosa });
    }
    f.saldo = _finR_(f.total - f.pagado - f.favor_usado);
    f.pagado = _finR_(f.pagado);
    f.estado = f.saldo <= 0.01 ? (f.saldo < -0.01 ? 'Pagada de más' : 'Pagada')
             : (f.marca_banco != null && !pl) ? 'Banco por confirmar'
             : f.pagado > 0.01 ? 'Abonada' : 'Pendiente';
    delete f.dia; delete f.marca_banco;
  });
  var usados = {}; Object.keys(cb.casados).forEach(function (k) { usados[cb.casados[k]] = 1; });
  return { facturas: facturas, mercado: mercado, favor: favor, favores: favores,
           banco_dudosos: cb.dudosos, banco_sueltos: cb.sueltos.filter(function (p) { return PAG_AREA_CAT_[p.categoria]; }),
           banco_ult: banco.reduce(function (a, p) { return p.fecha > a ? p.fecha : a; }, '') };
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
    if (f.estado === 'Banco por confirmar') x.por_confirmar += f.saldo;
  });
  Object.keys(favor).forEach(function (n) { if (P[n]) P[n].favor = favor[n]; });
  return Object.keys(P).map(function (n) {
    var x = P[n];
    ['facturado', 'pagado', 'pendiente', 'de_mas', 'favor', 'por_confirmar'].forEach(function (k) { x[k] = _finR_(x[k]); });
    return x;
  }).sort(function (a, b) { return b.pendiente - a.pendiente || (a.proveedor < b.proveedor ? -1 : 1); });
}

/** La pantalla: las facturas del area de quien entra, el mercado y el cuadre. */
function getPagosProveedores(auth) {
  var Q = pagQuien_(auth);
  var E = pagEstado_(), ve = function (a) { return Q.areas.indexOf(a) !== -1; };
  var facturas = E.facturas.filter(function (f) { return ve(f.area); });
  var og = function (g) { var i = PAG_GRUPOS_ORDEN_.indexOf(g); return i < 0 ? 99 : i; };
  facturas.sort(function (a, b) { return og(a.grupo) - og(b.grupo) || (a.proveedor < b.proveedor ? -1 : a.proveedor > b.proveedor ? 1 : (a.fecha < b.fecha ? -1 : 1)); });
  var favor = {};
  facturas.forEach(function (f) { if (E.favor[f.nit]) favor[f.nit] = E.favor[f.nit]; });
  var out = {
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm'), desde: PAG_DESDE_,
    rol: Q.rol, areas: Q.areas, formas: PAG_FORMAS_, formas_mercado: PAG_FORMAS_MERCADO_,
    facturas: facturas, cuadre: _pagCuadre_(facturas, favor),
    mercado: E.mercado.filter(function (m) { return ve(m.area); }),
    proveedores_mercado: _pagProvMercado_(E.mercado), grupos: PAG_GRUPOS_ORDEN_,
    // cada saldo a favor anotado, con su id para poder anularlo si se escribio por error
    favores: E.favores.filter(function (m) { return favor[m.nit] !== undefined; }),
    banco_ult: E.banco_ult
  };
  if (Q.rol === 'dueno') { out.banco_dudosos = E.banco_dudosos; out.banco_sueltos = E.banco_sueltos; }
  return out;
}

/** Los proveedores de mercado: primero los que mas se anotaron aca, despues la lista base. */
function _pagProvMercado_(mercado) {
  var n = {}, nombre = {};
  (mercado || []).forEach(function (m) { var k = normalizar_(m.proveedor); if (!k) return; n[k] = (n[k] || 0) + 1; nombre[k] = nombre[k] || m.proveedor; });
  var usados = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).map(function (k) { return nombre[k]; });
  PAG_PROV_MERCADO_.forEach(function (p) { if (!n[normalizar_(p)]) usados.push(p); });
  return usados;
}

function _pagEscribir_(filas) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
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
    return datos.length;
  } finally { lock.releaseLock(); }
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
function registrarPagoFacturas(auth, llaves, estatus, fechaPagado, monto, favorUsado, detalle) {
  var Q = pagQuien_(auth);
  if (PAG_FORMAS_.indexOf(estatus) === -1) throw new Error('Forma de pago desconocida: ' + estatus);
  fechaPagado = _pagFechaValida_(fechaPagado, 'Fecha pagado');
  llaves = [].concat(llaves || []);
  if (!llaves.length) throw new Error('Elegí al menos una factura.');
  var E = pagEstado_(), porLlave = {};
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
  _pagEscribir_(filas);
  return getPagosProveedores(auth);
}

/** Fecha en que se piensa pagar una factura (la columna FECHA DE PAGAR del Excel). */
function programarPagoFactura(auth, llave, fechaPagar) {
  var Q = pagQuien_(auth);
  fechaPagar = _pagFechaValida_(fechaPagar, 'Fecha de pagar');
  var f = pagEstado_().facturas.filter(function (x) { return x.llave === llave; })[0];
  if (!f) throw new Error('No encontre la factura. Recarga la pantalla.');
  if (Q.areas.indexOf(f.area) === -1) throw new Error('La factura es de ' + f.area + '.');
  _pagEscribir_([{ AREA: f.area, PROVEEDOR: f.proveedor, NIT: f.nit, DTE: f.dte, 'FECHA DE PAGAR': fechaPagar,
                   'ESTATUS DE PAGO': 'Programado', 'ESCRITO POR': Q.nombre }]);
  return getPagosProveedores(auth);
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

/** Un saldo a favor que el proveedor le reconoce a Rosanta (credito, devolucion, pago de mas). */
function registrarSaldoFavor(auth, nit, monto, detalle) {
  var Q = pagQuien_(auth);
  nit = pagNit_(nit); monto = _finR_(Number(monto));
  if (!(monto > 0)) throw new Error('Monto invalido.');
  if (String(detalle || '').trim().length < 3) throw new Error('Escribí de dónde sale el saldo a favor.');
  var f = pagEstado_().facturas.filter(function (x) { return x.nit === nit && Q.areas.indexOf(x.area) !== -1; })[0];
  if (!f) throw new Error('Ese proveedor no tiene facturas de tu area desde el ' + PAG_DESDE_ + '.');
  _pagEscribir_([{ AREA: f.area, PROVEEDOR: f.proveedor, NIT: nit, 'FECHA PAGADO': medFechaIso_(new Date()),
                   'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': 'Saldo a favor', DETALLE: String(detalle).slice(0, 300), 'ESCRITO POR': Q.nombre }]);
  return getPagosProveedores(auth);
}

/**
 * Compra de mercado sin factura. Queda en el mismo registro, con DTE "SIN FACTURA" (como en el
 * Excel: "MERCADO", "Gas evento SIN DTE"). Si salio de un retiro de cajero, Compras en efectivo
 * la ofrece como detalle de ese retiro cuando el banco lo traiga (medMercadoDeRetiros_).
 */
function registrarCompraMercado(auth, fecha, proveedor, detalle, monto, area, estatus) {
  var Q = pagQuien_(auth);
  fecha = _pagFechaValida_(fecha, 'Fecha');
  monto = _finR_(Number(monto));
  if (!(monto > 0)) throw new Error('Monto invalido.');
  detalle = String(detalle || '').trim();
  if (detalle.length < 3) throw new Error('Escribí qué se compró.');
  if (PAG_FORMAS_MERCADO_.indexOf(estatus) === -1) throw new Error('Forma de pago desconocida: ' + estatus);
  area = String(area || '').toUpperCase();
  if (Q.areas.indexOf(area) === -1 || area === 'ADMIN') area = Q.areas[0];
  _pagEscribir_([{ AREA: area, PROVEEDOR: String(proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado', DTE: PAG_SIN_FACTURA_,
                   'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': estatus,
                   DETALLE: detalle.slice(0, 600), 'ESCRITO POR': Q.nombre }]);
  return getPagosProveedores(auth);
}

/** Anula un movimiento anotado por error. No se borra: el estatus pasa a "ANULADO: ...". */
function anularMovimientoPago(auth, id) {
  var Q = pagQuien_(auth);
  id = String(id || '').trim();
  if (!id) throw new Error('Falta el movimiento.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = pagHoja_(false);
    if (!sh) throw new Error('No hay movimientos.');
    var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
    var iId = H.indexOf('ID'), iE = H.indexOf('ESTATUS DE PAGO'), iA = H.indexOf('AREA');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iId]) !== id) continue;
      var est = String(v[r][iE] || '');
      if (/^ANULADO/i.test(est)) break;
      if (est === PAG_ANTERIOR_ && Q.rol !== 'dueno') throw new Error('Esa fila es la que trajo la factura desde COMPRAS_2026, no un pago. Si la factura no se debe, avisá al dueño.');
      if (Q.rol !== 'dueno' && Q.areas.indexOf(String(v[r][iA]).toUpperCase()) === -1) throw new Error('Ese movimiento es de ' + v[r][iA] + '.');
      sh.getRange(r + 1, iE + 1).setValue('ANULADO: ' + est + ' (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')');
      SpreadsheetApp.flush();
      break;
    }
  } finally { lock.releaseLock(); }
  return getPagosProveedores(auth);
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
    if (m.dte === PAG_SIN_FACTURA_ || /Banco|Saldo a favor|Programado|Pendiente anterior/.test(m.estatus)) return;
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
