/**
 * COMPRAS EN EFECTIVO Y CON DEBITO (14-oct-2026). Profit OS › Día a día › Compras.
 *
 * El cuadre de retiros de cajero contra facturas (10-ago al 11-oct-2026) dejo Q16,390 sin
 * respaldo: el efectivo se registraba DESPUES, cuando llegaba el banco, y nadie lo anotaba
 * (Vigia: "0 de 11 retiros con detalle"). Juanma: "que se registren todas las compras de estos
 * dos metodos". Esta pestaña reemplaza a la seccion vieja "Compras en efectivo" de Cocina y
 * hace tres cosas:
 *   1. SOLICITUD DE RETIRO: antes de ir al cajero se anota lugar y cantidad. No se aprueba
 *      (decision de Juanma, 14-oct): queda registrada y se casa sola con el retiro del banco.
 *   2. REGISTRO DE COMPRA: efectivo o tarjeta de debito BI, a mano o leyendo una foto del
 *      recibo o una captura (Claude propone, la persona confirma). Se guarda en el MISMO
 *      registro de Pagos (PAGOS_PROVEEDORES): sin factura como "SIN FACTURA"; con factura,
 *      como pago de esa factura. Asi el food cost, el maestro y Pagos la ven sin cambiar nada.
 *        efectivo -> ESTATUS 'Retiro de cajero'
 *        debito   -> ESTATUS 'Tarjeta', DETALLE "[Tarjeta débito BI] ..."
 *   3. EL CUADRE: lo retirado (banco + solicitudes que el banco todavia no trae) menos lo
 *      registrado en efectivo = efectivo por justificar. Y los cargos de la tarjeta de debito
 *      que no tienen ni factura casada ni compra registrada.
 *
 * Arranque: CPE_ARRANQUE_. Lo de antes quedo cerrado en el cuadre del 14-oct-2026 (Juanma:
 * "cierra todas las cuentas contra pagos de efectivo"); medRetirosMes_ ya no lo pide.
 * Quien entra: el dueño, cocina (chef) y barra/sala, con el modulo pagos.
 *
 * AMBITO GLOBAL: todo empieza con cpe / _cpe; lo privado termina en guion bajo.
 */

var CPE_ARRANQUE_ = '2026-10-12';
var CPE_SOL_HOJA_ = 'RETIROS_SOLICITUDES';
var CPE_SOL_COLS_ = ['FECHA', 'LUGAR', 'MONTO', 'AREA', 'NOTA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'];
var CPE_EFECTIVO_ = 'Retiro de cajero';
var CPE_DEBITO_ = 'Tarjeta débito BI';
// El banco registra el retiro el mismo dia o hasta 4 dias despues de la solicitud (fin de semana).
var CPE_SOL_ANTES_ = 1, CPE_SOL_DESPUES_ = 4;
// Un cargo de debito y la compra registrada: mismo monto (Q0.50) y hasta 3 dias de diferencia.
var CPE_DEB_DIAS_ = 3, CPE_DEB_TOL_ = 0.5;
// Un retiro esta justificado cuando lo registrado cubre al menos este porcentaje.
var CPE_JUSTIFICADO_ = 0.9;
// Los cajeros que mas se usan (cuadre del 14-oct-2026), para no escribirlos cada vez.
var CPE_LUGARES_ = ['ATM 095 Agencia Recolección Antigua', 'ATM 603 Despensa Antigua', 'ATM 152 Agencia Antigua 5'];
var CPE_CARPETA_ = 'Comprobantes_compras';
var CPE_FACTURAS_DIAS_ = 45;
// Una compra cuya factura todavia no se emite (14-oct-2026, Juanma: "no es que sea sin factura,
// la factura esta pendiente de ser emitida"). Va como SIN FACTURA con esta marca al inicio del
// DETALLE; cuando la factura llega al FEL se le asigna (asignarFacturaACompra) y pasa a ser el
// pago de esa factura. Lo que de verdad no factura (el mercado) va sin la marca.
var CPE_PENDIENTE_ = '[Factura pendiente]';
// Los proveedores que se pagan en efectivo o con la tarjeta de debito: la lista de Juanma del
// 14-oct-2026, con sus nombres y en su orden (primero los tres que antes no facturaban), y despues
// los otros comercios del debito que pidio sumar al cuadre. nit (varios con |): para mostrar solo
// sus facturas. No agregar proveedores sin que Juanma los pida.
var CPE_PROVEEDORES_ = [
  { n: 'DISTRIBUIDORA DE FRUTAS Y VERDURAS "DOÑA MINA Y DON ROLANDO"', nit: '52496325' },
  { n: 'PESCADERIA EL TIBURONCITO', nit: '47687916' }, { n: 'CARNICERIA "SANTA ROSA"', nit: '7616325' },
  { n: 'BELCA', nit: '50476327' }, { n: 'CAOBA MARKET', nit: '96814357' },
  { n: 'CENTRAL PROVEEDORA DE COMERCIOS', nit: '97421847' }, { n: 'COMESA', nit: '8069948' },
  { n: 'COMSERSA SANTA LUCIA MILPAS ALTAS I', nit: '89370422' }, { n: 'DISTRIBUIDORA XELAC 4', nit: '5124298' },
  { n: 'LA BODEGONA', nit: '1965314K|64853063' }, { n: 'NUEVOS TERRITORIOS', nit: '39005356' },
  { n: 'PRICESMART ESCUINTLA', nit: '14940450' }, { n: 'RESTAURANTE Y CAFETERIA LA CENICIENTA', nit: '113077203' },
  { n: 'SALA DE VENTAS ANTIGUA GUATEMALA, AVICOLA VILLALOBOS', nit: '336211' },
  { n: 'SUPERMERCADOS LA TORRE', nit: '26532476' }, { n: 'TABLE SOLUTIONS', nit: '29998158' },
  { n: 'CEMACO ZONA SIETE', nit: '32375913' }, { n: 'CHINA MALL ANTIGUA', nit: '110476824' },
  { n: 'CONVENIENCIA COMERCIAL UXMAL', nit: '38010496' }, { n: 'DOLLARCITY ANTIGUA GUATEMALA', nit: '73999504' },
  { n: 'FERRETERIA ESPAÑA', nit: '36028630' },
  // los otros comercios del debito (Juanma: "suma los otros comercios del debito al cuadre")
  { n: 'PRODUCTOS PARMA', nit: '8244707' }, { n: 'LA NACIONAL', nit: '345377' },
  { n: 'DISTRIBUIDORA LA NUEVA', nit: '4962966' }, { n: 'MIXOKIT', nit: '70408971' },
  { n: 'LA PASTELERIA', nit: '9783490' }, { n: 'HIT DISTRIBUIDORES', nit: '' },
  { n: 'Mercado (sin factura)', nit: '' }
];

/** Quien entra y que areas toca. */
function cpeQuien_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  if (rol !== 'dueno' && !((rol === 'chef' || rol === 'sala') && usuarioTieneModulo(u, 'pagos')))
    throw new Error('Compras en efectivo es para cocina, barra y el dueño.');
  return { u: u, rol: rol, areas: PAG_AREAS_ROL_[rol], nombre: u.nombre || u.email || '' };
}

function _cpeSolHoja_(crear) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(CPE_SOL_HOJA_);
  if (!sh && crear) {
    sh = ss.insertSheet(CPE_SOL_HOJA_);
    sh.getRange(1, 1, 1, CPE_SOL_COLS_.length).setValues([CPE_SOL_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('H:H').setNumberFormat('@');
  }
  return sh;
}

/** Las solicitudes de retiro, sin las anuladas. */
function cpeSolicitudes_() {
  var sh = _cpeSolHoja_(false);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var ix = {}; CPE_SOL_COLS_.forEach(function (c) { ix[c] = H.indexOf(c); });
  var out = [];
  for (var r = 1; r < v.length; r++) {
    if (/^ANULADO/i.test(String(v[r][ix.ESTATUS] || ''))) continue;
    var d = pagDia_(v[r][ix.FECHA]);
    if (!d) continue;
    out.push({ id: String(v[r][ix.ID] || ''), fecha: pagIso_(d), lugar: String(v[r][ix.LUGAR] || ''),
               q: _finR_(_finNum_(v[r][ix.MONTO])), area: String(v[r][ix.AREA] || '').toUpperCase(),
               nota: String(v[r][ix.NOTA] || ''), por: String(v[r][ix['ESCRITO POR']] || '') });
  }
  return out;
}

/** Los retiros de cajero del banco entre dos fechas ISO (misma regla que medRetirosMes_). */
function cpeRetirosBanco_(ss, desde, hasta) {
  var lista = [];
  [['03_Banco_Industrial', 'BI'], ['04_Banco_BAC', 'BAC']].forEach(function (b) {
    var sh = ss.getSheetByName(b[0]);
    if (!sh) return;
    var v = sh.getDataRange().getValues(), hi = -1;
    for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('Categoría') >= 0) { hi = i; break; }
    if (hi < 0) return;
    var H = v[hi].map(function (h) { return String(h || '').trim(); });
    var iF = H.indexOf('Fecha'), iD = H.indexOf('Descripción'), iDe = H.indexOf('Débito'), iC = H.indexOf('Categoría');
    for (var r = hi + 1; r < v.length; r++) {
      if (String(v[r][iC] || '').trim() !== 'ALIMENTOS_EFECTIVO') continue;
      var desc = String(v[r][iD] || '').trim();
      if (!/^(ATM|RETIRO|A-|F-)/i.test(desc)) continue;
      var d = pagDia_(v[r][iF]), f = pagIso_(d);
      if (!d || f < desde || (hasta && f > hasta)) continue;
      lista.push({ fecha: f, q: _finR_(_finNum_(v[r][iDe])), desc: desc, banco: b[1] });
    }
  });
  return lista.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
}

function _cpeDias_(a, b) { return pagNumDia_(pagDia_(b)) - pagNumDia_(pagDia_(a)); }
function _cpeMasDias_(iso, n) { var d = pagDia_(iso); return medFechaIso_(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }

/**
 * Los retiros (banco y solicitudes casados) y lo justificado de cada uno: lo registrado en
 * efectivo se reparte en orden (cada compra sale del retiro mas viejo de antes). Liviano: no
 * lee las facturas, lo usan medRetirosMes_ (Hoy y el vigia) y el cuadre de la pantalla.
 */
function cpeRetirosJustificados_(ss, desde, bancoUlt) {
  var banco = cpeRetirosBanco_(ss, desde, ''), sols = cpeSolicitudes_().filter(function (s) { return s.fecha >= desde; });
  bancoUlt = bancoUlt || banco.reduce(function (a, x) { return x.fecha > a ? x.fecha : a; }, '');
  // 1. cada solicitud con su retiro del banco: mismo monto, del dia antes a 4 dias despues
  var usado = {};
  sols.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).forEach(function (s) {
    for (var i = 0; i < banco.length; i++) {
      var d = _cpeDias_(s.fecha, banco[i].fecha);
      if (!usado[i] && Math.abs(banco[i].q - s.q) < 0.01 && d >= -CPE_SOL_ANTES_ && d <= CPE_SOL_DESPUES_) {
        usado[i] = 1; s.banco = banco[i]; banco[i].solicitud = s; break;
      }
    }
    s.estado = s.banco ? 'En el banco' : (bancoUlt && _cpeDias_(s.fecha, bancoUlt) > CPE_SOL_DESPUES_ ? 'No aparece en el banco' : 'Falta cargar el banco');
  });
  // lo retirado: el banco, mas las solicitudes que el banco todavia no puede traer
  var retiros = banco.map(function (b) {
    return { fecha: b.fecha, q: b.q, origen: 'banco', lugar: b.solicitud ? b.solicitud.lugar : b.desc, desc: b.desc,
             solicitud: b.solicitud ? b.solicitud.id : '', por: b.solicitud ? b.solicitud.por : '' };
  });
  sols.forEach(function (s) {
    if (!s.banco && s.estado === 'Falta cargar el banco')
      retiros.push({ fecha: s.fecha, q: s.q, origen: 'solicitud', lugar: s.lugar, desc: '', solicitud: s.id, por: s.por });
  });
  retiros.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
  // 2. lo registrado en efectivo y con debito (facturas y sin factura), desde el arranque
  var movs = pagMovimientos_().filter(function (m) { return m.fecha_pagado >= desde; });
  var efectivo = movs.filter(function (m) { return m.estatus === CPE_EFECTIVO_; });
  var debito = movs.filter(function (m) { return m.estatus === 'Tarjeta' && m.detalle.indexOf('[' + CPE_DEBITO_ + ']') === 0; });
  // 3. lo justificado de cada retiro: cada compra sale del retiro mas viejo que todavia tenga
  //    plata y que sea de ese dia o de antes (el dia siguiente cuenta: el banco a veces lo
  //    registra un dia tarde). Una compra sin retiro anterior sale del primero que haya.
  var gastos = efectivo.slice().sort(function (a, b) { return a.fecha_pagado < b.fecha_pagado ? -1 : 1; });
  retiros.forEach(function (r) { r.justificado = 0; });
  gastos.forEach(function (g) {
    var falta = g.q, lim = _cpeMasDias_(g.fecha_pagado, 1);
    [true, false].forEach(function (antes) {
      retiros.forEach(function (r) {
        if (falta < 0.005 || (antes && r.fecha > lim)) return;
        var toma = Math.min(falta, r.q - r.justificado);
        if (toma > 0) { r.justificado += toma; falta -= toma; }
      });
    });
  });
  retiros.forEach(function (r) { r.justificado = _finR_(r.justificado); r.ok = r.justificado >= r.q * CPE_JUSTIFICADO_; });
  return { banco: banco, solicitudes: sols, retiros: retiros, efectivo: efectivo, debito: debito, banco_ult: bancoUlt };
}

/**
 * El cuadre. ss: el maestro. E: pagEstado_() (para no leerlo dos veces). Devuelve los retiros
 * (banco y solicitudes casados), las compras registradas, lo justificado de cada retiro (en
 * orden: lo primero que se gasto sale del primer retiro) y los cargos de debito sin registro.
 */
function cpeCuadre_(ss, E, desde) {
  desde = desde || CPE_ARRANQUE_;
  var R = cpeRetirosJustificados_(ss, desde, (E && E.banco_ult) || '');
  var banco = R.banco, sols = R.solicitudes, retiros = R.retiros, efectivo = R.efectivo, debito = R.debito, bancoUlt = R.banco_ult;

  // 4. los cargos de la tarjeta de debito: casados con una factura (Pagos) o con una compra registrada
  var cargos = pagPagosBanco_(ss).filter(function (p) { return p.banco === CPE_DEBITO_ && p.fecha >= desde; });
  var confirmados = {};
  ((E && E.facturas) || []).forEach(function (f) {
    (f.pagos || []).forEach(function (x) {
      if (x.estatus === 'Tarjeta confirmada' && x.por === CPE_DEBITO_) confirmados[x.fecha + '|' + x.detalle] = f.proveedor + ' ' + f.dte;
    });
  });
  var regUsado = {};
  cargos.forEach(function (p) {
    var fac = confirmados[p.fecha + '|' + p.glosa];
    if (fac) { p.casado = 'Factura ' + fac; return; }
    for (var i = 0; i < debito.length; i++) {
      if (!regUsado[i] && Math.abs(debito[i].q - p.q) <= CPE_DEB_TOL_ && Math.abs(_cpeDias_(debito[i].fecha_pagado, p.fecha)) <= CPE_DEB_DIAS_) {
        regUsado[i] = 1; p.casado = debito[i].proveedor + ': ' + debito[i].detalle.replace(/^\[[^\]]+\]\s*/, ''); break;
      }
    }
  });
  var q = function (arr, k) { return _finR_(arr.reduce(function (a, x) { return a + (x[k || 'q'] || 0); }, 0)); };
  var sinReg = cargos.filter(function (p) { return !p.casado; });
  return {
    desde: desde, banco_ult: bancoUlt, solicitudes: sols, retiros: retiros, efectivo: efectivo, debito: debito,
    cargos_debito: cargos.map(function (p) { return { fecha: p.fecha, q: p.q, glosa: p.glosa, casado: p.casado || '' }; }),
    resumen: { retirado: q(retiros), registrado: q(efectivo), por_justificar: _finR_(q(retiros) - q(efectivo)),
               retiros_sin_justificar: retiros.filter(function (r) { return !r.ok; }).length,
               debito_sin_registro: sinReg.length, q_debito_sin_registro: q(sinReg),
               sin_solicitud: banco.filter(function (b) { return !b.solicitud; }).length }
  };
}

/** La pantalla. */
function getComprasEfectivo(auth) {
  var Q = cpeQuien_(auth);
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID), E = pagEstado_(), C = cpeCuadre_(ss, E);
  var ve = function (a) { return Q.areas.indexOf(a) !== -1; };
  // la fecha de la factura (emision), aparte de la del pago (Juanma, 14-oct-2026)
  var emision = {}; E.facturas.forEach(function (f) { emision[f.llave] = f.fecha; });
  // solo efectivo (14-oct-2026: el debito se paga desde Pagos con Tarjeta débito BI)
  var reg = C.efectivo.filter(function (m) { return Q.rol === 'dueno' || ve(m.area) || m.por === Q.nombre; })
    .sort(function (a, b) { return a.fecha_pagado < b.fecha_pagado ? 1 : -1; })
    .map(function (m) {
      return { id: m.id, fecha: m.fecha_pagado, metodo: m.estatus === CPE_EFECTIVO_ ? 'Efectivo' : 'Débito',
               proveedor: m.proveedor, factura: m.dte === PAG_SIN_FACTURA_ ? '' : m.dte, fecha_factura: emision[m.nit + '|' + m.dte] || '', q: m.q, area: m.area,
               pendiente: m.dte === PAG_SIN_FACTURA_ && m.detalle.indexOf(CPE_PENDIENTE_) === 0,
               detalle: m.detalle.replace(/^\[[^\]]+\]\s*/, ''), por: m.por };
    });
  // las facturas que se pueden pagar desde aca: las abiertas de sus areas de los ultimos
  // CPE_FACTURAS_DIAS_ dias, las mas nuevas primero (las viejas se pagan desde Pagos)
  var hace = medFechaIso_(new Date(Date.now() - CPE_FACTURAS_DIAS_ * 86400000));
  var abiertas = E.facturas.filter(function (f) { return f.saldo > 0.01 && ve(f.area) && f.fecha >= hace; })
    .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 150)
    .map(function (f) { return { llave: f.llave, proveedor: f.proveedor, nit: f.nit, dte: f.dte, fecha: f.fecha, saldo: f.saldo, area: f.area }; });
  return {
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm'),
    rol: Q.rol, areas: Q.areas.filter(function (a) { return a !== 'ADMIN'; }), nombre: Q.nombre, hoy: medFechaIso_(new Date()),
    desde: C.desde, banco_ult: C.banco_ult, resumen: C.resumen, lugares: CPE_LUGARES_,
    retiros: C.retiros, solicitudes: C.solicitudes.map(function (s) {
      return { id: s.id, fecha: s.fecha, lugar: s.lugar, q: s.q, area: s.area, nota: s.nota, por: s.por, estado: s.estado };
    }),
    cargos_debito: C.cargos_debito, registradas: reg, facturas: abiertas,
    // la lista de efectivo y debito, y despues lo que ya se registro en Compras que no este en ella
    proveedores: _cpeProveedores_(C.efectivo.concat(C.debito))
  };
}

/** CPE_PROVEEDORES_ y los proveedores ya registrados en Compras sin factura que no estan en ella. */
function _cpeProveedores_(movs) {
  var clave = function (x) { return normalizar_(x).replace(/[^a-z0-9]/g, ''); };
  var ya = CPE_PROVEEDORES_.map(function (x) { return clave(x.n); }), out = CPE_PROVEEDORES_.slice();
  movs.forEach(function (m) {
    var k = clave(m.proveedor);
    if (m.dte !== PAG_SIN_FACTURA_ || k.length < 3 || ya.some(function (y) { return y.indexOf(k) !== -1 || k.indexOf(y) !== -1; })) return;
    ya.push(k); out.push({ n: m.proveedor, nit: '' });
  });
  return out;
}

/** Solicitud de retiro: lugar y cantidad. Queda registrada; no se aprueba. */
/* Privada desde el 14-oct-2026 (auditoria): la pantalla usa registrarRetiroYCompras. Queda para el harness. */
function solicitarRetiro_(auth, fecha, lugar, monto, nota) {
  _cpeAnotarRetiro_(cpeQuien_(auth), fecha, lugar, monto, nota);
  return getComprasEfectivo(auth);
}
function _cpeValidarRetiro_(fecha, lugar, monto) {
  fecha = _pagFechaValida_(fecha, 'Fecha');
  lugar = String(lugar || '').trim();
  if (lugar.length < 3) throw new Error('Escribí en qué cajero se retiró.');
  monto = _finR_(Number(monto));
  if (!(monto > 0)) throw new Error('Escribí cuánto se retiró.');
  return { fecha: fecha, lugar: lugar, monto: monto };
}
function _cpeAnotarRetiro_(Q, fecha, lugar, monto, nota) {
  var V = _cpeValidarRetiro_(fecha, lugar, monto);
  fecha = V.fecha; lugar = V.lugar; monto = V.monto;
  _pagConCandado_(function () {   // el mismo candado que Pagos: puede ir dentro de registrarRetiroYCompras
    var sh = _cpeSolHoja_(true);
    var fila = [fecha, lugar.slice(0, 120), monto, Q.rol === 'sala' ? 'BARRA' : 'COCINA', String(nota || '').trim().slice(0, 300),
                Q.nombre, new Date(), Utilities.getUuid().slice(0, 8), ''];
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 8).setNumberFormat('@');
    sh.getRange(r, 1, 1, fila.length).setValues([fila]);
    SpreadsheetApp.flush();
  });
}

/** Anula una solicitud: quien la hizo o el dueño. */
function anularSolicitudRetiro(auth, id) {
  var Q = cpeQuien_(auth);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = _cpeSolHoja_(false);
    if (!sh) throw new Error('No hay solicitudes.');
    var v = sh.getDataRange().getValues(), H = v[0].map(String);
    var iId = H.indexOf('ID'), iE = H.indexOf('ESTATUS'), iP = H.indexOf('ESCRITO POR');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iId]) !== String(id)) continue;
      if (Q.rol !== 'dueno' && String(v[r][iP]) !== Q.nombre) throw new Error('Esa solicitud la hizo ' + v[r][iP] + '.');
      sh.getRange(r + 1, iE + 1).setValue('ANULADO (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')');
      SpreadsheetApp.flush();
      break;
    }
  } finally { lock.releaseLock(); }
  return getComprasEfectivo(auth);
}

function _cpeCarpeta_() {
  var padre = DriveApp.getFileById(getSheetId_('CONFIG_SHEET_ID')).getParents().next();
  var it = padre.getFoldersByName(CPE_CARPETA_);
  return it.hasNext() ? it.next() : padre.createFolder(CPE_CARPETA_);
}

/** Guarda la foto o captura en Drive y devuelve su enlace. a: {nombre, mime, datos (base64)}. */
function _cpeGuardarArchivo_(a) {
  var sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd_HHmm');
  var blob = Utilities.newBlob(Utilities.base64Decode(a.datos), String(a.mime || 'image/jpeg'), sello + '_' + String(a.nombre || 'recibo.jpg'));
  return _cpeCarpeta_().createFile(blob).getUrl();
}

/**
 * Registra una compra pagada en efectivo o con la tarjeta de debito.
 * c: { fecha, metodo: 'efectivo'|'debito', proveedor, detalle, monto, area, llave (factura, opcional),
 *      archivo: {nombre, mime, datos} (opcional), archivo_url (si la foto ya se subio al leerla) }
 */
/* Privada desde el 14-oct-2026 (auditoria): la pantalla usa registrarRetiroYCompras. Queda para el harness. */
function registrarCompraEfectivo_(auth, c) {
  var Q = cpeQuien_(auth);
  c = c || {};
  var metodo = c.metodo === 'debito' ? 'debito' : c.metodo === 'efectivo' ? 'efectivo' : '';
  if (!metodo) throw new Error('Elegí si se pagó en efectivo o con tarjeta de débito.');
  var fecha = _pagFechaValida_(c.fecha, 'Fecha');
  var monto = _finR_(Number(c.monto));
  if (!(monto > 0)) throw new Error('Monto invalido.');
  var url = _cpeUrlRecibo_(c.archivo_url);
  if (!url && c.archivo && c.archivo.datos) url = _cpeGuardarArchivo_(c.archivo);
  var detalle = String(c.detalle || '').trim();
  if (url) detalle += (detalle ? ' · ' : '') + 'recibo: ' + url;
  if (c.llave) {
    // con factura: es el pago de esa factura (mismas reglas que Pagos)
    var estatus = metodo === 'efectivo' ? CPE_EFECTIVO_ : 'Tarjeta';
    _pagRegistrarPago_(Q, [c.llave], estatus, fecha, monto, 0, detalle, metodo === 'debito' ? CPE_DEBITO_ : '');
  } else {
    if (String(c.detalle || '').trim().length < 3) throw new Error('Escribí qué se compró.');
    var area = String(c.area || '').toUpperCase();
    if (Q.areas.indexOf(area) === -1 || area === 'ADMIN') area = Q.areas[0];
    if (metodo === 'debito') detalle = '[' + CPE_DEBITO_ + '] ' + detalle;
    _pagEscribir_([{ AREA: area, PROVEEDOR: String(c.proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado', DTE: PAG_SIN_FACTURA_,
                     'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': monto, 'ESTATUS DE PAGO': metodo === 'efectivo' ? CPE_EFECTIVO_ : 'Tarjeta',
                     DETALLE: detalle.slice(0, 900), 'ESCRITO POR': Q.nombre }]);
  }
  return getComprasEfectivo(auth);
}

/** Anula una compra registrada (misma regla que Pagos: lo que anoto uno mismo, o el dueño). */
function anularCompraEfectivo(auth, id) {
  cpeQuien_(auth);
  anularMovimientoPago(auth, id);
  return getComprasEfectivo(auth);
}

/**
 * El retiro y sus compras en un solo guardado (14-oct-2026, Juanma: "primero se registra el
 * retiro en el cajero respectivo" y "agrega 5 pestañas de qué se compró, para guardar una sola
 * vez"). x: { fecha, retiro: {lugar, monto, nota} | null (ya estaba registrado),
 *             compras: [{ proveedor, llave (factura) | '', sin_factura (no dan factura), detalle,
 *                         monto, area, archivo_url }] }
 * Auditoria del 14-oct-2026: todo bajo UN candado; adentro se relee y se valida todo, las compras
 * se escriben en UNA sola escritura y el retiro va al final (si algo falla antes, no queda un
 * retiro suelto que al reintentar se duplique). Si una fila esta mal no se guarda nada.
 */
function registrarRetiroYCompras(auth, x) {
  var Q = cpeQuien_(auth);
  x = x || {};
  var fecha = _pagFechaValida_(x.fecha, 'Fecha');
  var ret = x.retiro && (x.retiro.lugar || Number(x.retiro.monto) > 0) ? x.retiro : null;
  var compras = (x.compras || []).filter(function (c) {
    return c && (Number(c.monto) > 0 || String(c.detalle || '').trim() || c.llave || String(c.proveedor || '').trim());
  });
  if (!ret && !compras.length) throw new Error('Anotá el retiro o al menos una compra.');
  if (ret) _cpeValidarRetiro_(fecha, ret.lugar, ret.monto);
  compras.forEach(function (c, i) {
    var n = 'Compra ' + (i + 1) + ': ';
    c.monto = _finR_(Number(c.monto));
    if (!(c.monto > 0)) throw new Error(n + 'falta el monto.');
    if (!c.llave && String(c.detalle || '').trim().length < 3) throw new Error(n + 'escribí qué se compró.');
    if (c.archivo_url) c.archivo_url = _cpeUrlRecibo_(c.archivo_url);
  });
  _pagConCandado_(function () {
    _pagOlvidar_(true);   // adentro del candado se relee todo
    var porLlave = {}, vistas = {};
    if (compras.some(function (c) { return c.llave; })) pagEstado_().facturas.forEach(function (f) { porLlave[f.llave] = f; });
    compras.forEach(function (c, i) {
      if (!c.llave) return;
      var n = 'Compra ' + (i + 1) + ': ', f = porLlave[c.llave];
      if (!f) throw new Error(n + 'no encontré esa factura. Tocá Actualizar.');
      if (Q.areas.indexOf(f.area) === -1) throw new Error(n + 'la factura ' + f.dte + ' es de ' + f.area + '.');
      if (f.saldo <= 0.01) throw new Error(n + 'la factura ' + f.dte + ' ya está pagada.');
      if (vistas[c.llave]) throw new Error(n + 'la factura ' + f.dte + ' está dos veces.');
      vistas[c.llave] = 1;
    });
    var filas = [];
    compras.forEach(function (c) {
      var detalle = String(c.detalle || '').trim();
      if (c.archivo_url) detalle += (detalle ? ' · ' : '') + 'recibo: ' + c.archivo_url;
      if (c.llave) { filas = filas.concat(_pagRegistrarPago_(Q, [c.llave], CPE_EFECTIVO_, fecha, c.monto, 0, detalle, '', true)); return; }
      var area = String(c.area || '').toUpperCase();
      if (Q.areas.indexOf(area) === -1 || area === 'ADMIN') area = Q.areas[0];
      filas.push({ AREA: area, PROVEEDOR: String(c.proveedor || 'Mercado').trim().slice(0, 80) || 'Mercado', DTE: PAG_SIN_FACTURA_,
                   'FECHA PAGADO': fecha, 'CANTIDAD PAGADA': c.monto, 'ESTATUS DE PAGO': CPE_EFECTIVO_,
                   DETALLE: ((c.sin_factura ? '' : CPE_PENDIENTE_ + ' ') + detalle).slice(0, 900), 'ESCRITO POR': Q.nombre });
    });
    if (filas.length) _pagEscribir_(filas);
    if (ret) _cpeAnotarRetiro_(Q, fecha, ret.lugar, ret.monto, ret.nota);   // al final
  }, 30000);
  return getComprasEfectivo(auth);
}

/**
 * Llego la factura de una compra que estaba "factura pendiente": la compra pasa a ser el pago
 * de esa factura (misma fecha, cantidad y forma) y el registro pendiente queda anulado. Asi la
 * factura no aparece por pagar ni la compra cuenta dos veces.
 * Auditoria del 14-oct-2026 (bloqueaba la @188): todo bajo UN candado y releyendo adentro (dos
 * toques seguidos pagaban la factura dos veces); PRIMERO se anula la compra ("ANULADO: asignada
 * a la factura ...") y DESPUES se paga, y si el pago falla la compra vuelve a como estaba; solo
 * compras con la marca [Factura pendiente], del mismo NIT si la compra lo trae, y sin pasarse del
 * saldo de la factura.
 */
function asignarFacturaACompra(auth, id, llave) {
  var Q = cpeQuien_(auth);
  id = String(id || ''); llave = String(llave || '');
  _pagConCandado_(function () {
    _pagOlvidar_(true);
    var m = pagMovimientos_().filter(function (x) { return x.id === id; })[0];
    if (!m || m.dte !== PAG_SIN_FACTURA_ || m.estatus !== CPE_EFECTIVO_) throw new Error('No encontré esa compra (¿ya se asignó?). Tocá Actualizar.');
    if (m.detalle.indexOf(CPE_PENDIENTE_) !== 0) throw new Error('Esa compra no está marcada como factura pendiente.');
    if (Q.rol !== 'dueno' && m.por !== Q.nombre && Q.areas.indexOf(m.area) === -1) throw new Error('Esa compra es de ' + m.area + '.');
    var f = pagEstado_().facturas.filter(function (x) { return x.llave === llave; })[0];
    if (!f) throw new Error('No encontré esa factura. Tocá Actualizar.');
    if (Q.areas.indexOf(f.area) === -1) throw new Error('La factura ' + f.dte + ' es de ' + f.area + '.');
    if (f.saldo <= 0.01) throw new Error('La factura ' + f.dte + ' ya está pagada.');
    if (m.nit && f.nit !== m.nit) throw new Error('La factura ' + f.dte + ' es de otro proveedor.');
    if (m.q > f.saldo + 0.01) throw new Error('La compra es de Q' + m.q + ' y la factura ' + f.dte + ' debe Q' + f.saldo + ': no coinciden. Revisá que sea la factura correcta.');
    var det = m.detalle.replace(/^\[[^\]]+\]\s*/, '');
    var A = _pagAnular_({ nombre: Q.nombre, rol: 'dueno', areas: ['COCINA', 'BARRA', 'ADMIN'] }, m.id,
                        'ANULADO: asignada a la factura ' + f.dte + ' (' + Q.nombre + ', ' + medFechaIso_(new Date()) + ')');
    try {
      _pagRegistrarPago_(Q, [llave], CPE_EFECTIVO_, m.fecha_pagado, m.q, 0,
                         ('Era la compra del ' + m.fecha_pagado + ' con factura pendiente. ' + det).slice(0, 300), '');
    } catch (e) { _pagDesanular_(A); throw e; }
  }, 30000);
  return getComprasEfectivo(auth);
}

/** El enlace del recibo: solo uno de Google Drive (auditoria, 14-oct-2026). Vacio si no lo es. */
function _cpeUrlRecibo_(u) {
  u = String(u || '').trim();
  return u.split(/\s+/).filter(function (x) { return /^https:\/\/(drive|docs)\.google\.com\//.test(x); }).join(' ');
}

/* ---- Leer la foto del recibo o la captura ----
   Claude lee proveedor, NIT, numero de factura, productos, total y como se pago. Nada se guarda
   sin que la persona lo confirme. La foto queda en Drive (Comprobantes_compras). */
var CPE_ESQUEMA_ = {
  type: 'object', additionalProperties: false, required: ['compras'],
  properties: { compras: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['fecha', 'proveedor', 'nit', 'factura', 'detalle', 'total', 'metodo', 'confianza', 'nota'],
    properties: {
      fecha: { type: 'string' }, proveedor: { type: 'string' }, nit: { type: 'string' }, factura: { type: 'string' },
      detalle: { type: 'string' }, total: { type: 'number' },
      metodo: { type: 'string', enum: ['efectivo', 'debito', 'no_dice'] },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'] }, nota: { type: 'string' } } } } }
};
var CPE_INSTRUCCION_ =
  'Sos el asistente de compras del restaurante Rosanta (Antigua Guatemala). Te paso fotos de recibos, facturas, ' +
  'vouchers de tarjeta o capturas de WhatsApp con un proveedor. Por cada compra que veas devuelve: fecha (AAAA-MM-DD; ' +
  'si falta el año es 2026; si no hay fecha, vacio), proveedor (nombre comercial), nit (solo digitos y K, vacio si no ' +
  'aparece), factura (el numero de DTE o de factura, vacio si no hay), detalle (lo comprado en una linea corta: ' +
  'productos y cantidades), total en quetzales (0 si no se lee), metodo (debito si hay voucher o dice tarjeta/debito, ' +
  'efectivo si dice efectivo o contado, no_dice si no se sabe), confianza (alta, media o baja) y nota (una frase en ' +
  'español con la duda, o vacio).\n\nNo inventes: lo que no se lee va vacio o en 0. Una factura y su voucher de la ' +
  'misma compra son UNA compra.';

/** Lee las fotos y propone las compras. archivos: [{nombre, mime, datos}]. No escribe en los libros. */
function leerComprobanteCompra(auth, archivos) {
  var Q = cpeQuien_(auth);
  archivos = archivos || [];
  if (!archivos.length) throw new Error('Subí al menos una foto o captura.');
  if (archivos.length > 6) throw new Error('Máximo 6 fotos por vez.');
  var contenido = [], urls = [];
  archivos.forEach(function (a) {
    var mime = String(a.mime || '');
    if (!/^image\/(jpeg|png|gif|webp)$/.test(mime)) throw new Error('No puedo leer ' + a.nombre + '. Subí fotos o capturas (JPG o PNG).');
    urls.push(_cpeGuardarArchivo_(a));
    contenido.push({ type: 'image', source: { type: 'base64', media_type: mime, data: a.datos } });
  });
  contenido.push({ type: 'text', text: CPE_INSTRUCCION_ });
  var body = claudeLlamar_({
    model: MED_RET_MODELO_, max_tokens: 4000, fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CPE_ESQUEMA_ } },
    messages: [{ role: 'user', content: contenido }]
  }, ['server-side-fallback-2026-07-01']);
  if (body.stop_reason === 'refusal') throw new Error('No se pudo leer la foto. Probá con otra o anotalo a mano.');
  var txt = (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  var compras = JSON.parse(txt).compras || [];
  // si trae NIT y numero, se busca la factura abierta en Pagos para pagarla en vez de duplicarla
  var abiertas = pagEstado_().facturas.filter(function (f) { return f.saldo > 0.01 && Q.areas.indexOf(f.area) !== -1; });
  compras.forEach(function (c) {
    var nit = pagNit_(c.nit), num = String(c.factura || '').replace(/\D/g, '');
    var f = abiertas.filter(function (x) { return (nit && x.nit === nit && num && String(x.dte).replace(/\D/g, '') === num); })[0] ||
            abiertas.filter(function (x) { return nit && x.nit === nit && Math.abs(x.saldo - c.total) < 0.01; })[0];
    c.llave = f ? f.llave : '';
    c.factura_txt = f ? f.proveedor + ' ' + f.dte + ' (Q' + f.saldo + ')' : '';
  });
  return { compras: compras, archivo_url: urls.join(' ') };
}
