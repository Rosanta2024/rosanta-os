// ============================================================
// ROSANTA - Cierre de mes de los bancos BAC (22-oct-2026)
//
// Termina con los scripts de un solo uso (zz_cargar_septiembre_2026.js y anteriores).
// En el cierre de cada mes carga al maestro:
//   cuenta BAC quetzales 904802543  -> 04_Banco_BAC
//   cuenta BAC dolares   905757274  -> 04b_Banco_BAC_USD (pestaña PROPUESTA: no existe
//                                       todavia; crearla con crearPestanaBacUsd() cuando
//                                       Juanma diga. Mientras no exista, esa cuenta frena)
//   tarjeta BAC 4966-64**-****-2794 -> 05_Tarjeta_Credito_BAC
//   tarjeta BI  4042-****-****-4132 -> 06_Tarjeta_Credito_BI (sin descarga del banco: solo
//                                       capturas. Entra por la lista pegada, ver abajo)
//
// QUE LEE: SIEMPRE un CSV NORMALIZADO (UTF-8, coma, comillas RFC 4180), nunca el archivo del
// banco. Dos formatos, que se reconocen por la primera linea:
//
//   CUENTA   tipo,cuenta,moneda,fecha,referencia,codigo,descripcion,debito,credito,saldo,categoria
//     INICIAL   una fila: saldo = saldo inicial del estado
//     MOV       un movimiento: fecha AAAA-MM-DD, debito y credito positivos, saldo = Balance
//     TOTAL     una fila: debito y credito = totales que imprime el banco, saldo = saldo final
//     GENERADO  una fila (opcional): fecha en que se bajo el archivo del banco
//   TARJETA  tipo,tarjeta,fecha,descripcion,quetzales,dolares,categoria
//     CORTE     una fila: tarjeta = producto (4966-64**-****-2794), fecha = fecha de corte
//     PREVIO    una fila: saldo anterior (quetzales y dolares)
//     MOV       un cargo o abono (pagos en negativo, como los da el banco); tarjeta = la
//               tarjeta adicional de donde sale; los cargos sin fecha van con la del corte
//     CONTADO   una fila: pago de contado del estado (= previo + suma de los MOV)
//   La columna categoria es opcional: si viene llena, gana sobre las reglas.
//
// Quien arma ese CSV:
//   - En la Mac (octubre, mientras Apps Script siga escribiendo):
//       node cloud/herramientas/xls-a-csv-banco.js <archivos del banco> --carpeta <2026-MM>
//     convierte el .xls del BAC ("Archivo excel (XLS)") y el CSV de la tarjeta BAC.
//     Drive NO convierte el .xls del BAC (queda una hoja vacia, probado el 22-oct-2026),
//     por eso Apps Script no lo puede leer solo.
//   - En la nube: la precarga convierte el .xls / el CSV del banco con el mismo
//     normalizador (cloud/app/src/banco-normalizar.js, SheetJS) y se lo da a este codigo
//     por ROSANTA_NUBE.bancoANormalizado. En Apps Script ese objeto no existe.
//
// DONDE (decision de Juanma, 22-oct-2026): Reportes 2026/Reportes Mensual/2026-MM/_sistema/
// (tambien "2026-MM (1)", el nombre que deja Drive al duplicar). Ahi van los .xls del banco
// ("BAC Q 2026-MM.xls", "BAC $ 2026-MM.xls", "TC BAC 2026-MM.xls"; se acepta tambien el nombre
// de la descarga, "Transacciones del mes (1).xls") y los CSV normalizados con nombre fijo
// ("BAC Q 2026-MM.csv"...). Los PDF quedan en la carpeta del mes, para el contador: el sistema
// no los lee. La cuenta sale del numero de cuenta o tarjeta del archivo, nunca del nombre.
// Dos archivos DISTINTOS de la misma cuenta en el mes: frena, no adivina.
//
// FRENA (no escribe ESE archivo) si: el formato no es el normalizado, una fila esta mal
// formada, un movimiento cae fuera del mes, la cadena de saldos se rompe, las sumas no dan los
// totales del banco, el archivo se bajo antes de que terminara el mes, el saldo inicial no es
// el ultimo Balance del maestro para esa cuenta, la pestaña no existe o su encabezado cambio.
// NUNCA DUPLICA: cuenta = fecha|referencia|debito|credito (la llave de la carga de septiembre
// y del BANCO_BI); tarjeta = fecha|descripcion|quetzales|dolares, contando repetidos (dos
// cargos iguales el mismo dia son dos filas).
// CATEGORIA: la del CSV si viene; si no, CB_REGLAS; si no, la que esa misma descripcion tuvo
// antes en la pestaña; si no, POR_CLASIFICAR (lo cuenta estadoCierreMes y se avisa).
// Registro de procesados: el mismo del cargador (rosanta_archivos_procesados, id:fecha).
//
//   revisarCierreBancos('2026-10')   no escribe: dice que cargaria y que frena
//   cargarCierreBancos('2026-10')
//   revisarTarjetaBIPegada(texto) / cargarTarjetaBIPegada(texto)   la tarjeta BI, a mano
// ============================================================

var CB_REPORTES_MENSUAL = 'Reportes Mensual';
var CB_SISTEMA = '_sistema';
var CB_FILA_ENC = 4;
var CB_CAB_CUENTA = 'tipo,cuenta,moneda,fecha,referencia,codigo,descripcion,debito,credito,saldo,categoria';
var CB_CAB_TARJETA = 'tipo,tarjeta,fecha,descripcion,quetzales,dolares,categoria';

// ---- LA REGLA DE MAPEO, en un solo lugar ----
var CB_CUENTAS = {
  '904802543': { hoja: '04_Banco_BAC', moneda: 'QTZ', personal: 'Si' },
  '905757274': { hoja: '04b_Banco_BAC_USD', moneda: 'USD', personal: 'Si' }
};
var CB_TARJETAS = {
  '4966-64**-****-2794': { hoja: '05_Tarjeta_Credito_BAC', personal: 'Sí' },
  '4042-****-****-4132': { hoja: '06_Tarjeta_Credito_BI', personal: 'Sí' }
};
// Encabezados de la fila 4 (A en adelante). Despues vienen Año, Mes y Semana (formulas).
var CB_ENC_CUENTA = ['Fecha', 'Referencia', 'Codigo', 'Descripción', 'Débito', 'Crédito', 'Balance', 'Categoría', 'Es_Personal'];
var CB_ENC_TARJETA = ['Fecha', 'Descripción', 'Quetzales', 'Dólares', 'Categoría', 'Es_Personal'];
// LA categoria de los INTERESES (cuenta o tarjeta), en un solo lugar. Juanma decidio el 22-oct-2026 que van como
// INTERESES_BANCARIOS (bloque "Gastos Financieros" del DRE, FinanzasDatos.js). La usan las reglas de abajo y
// cargos_sin_fecha_tc_bac.js. Los CARGOS POR SERVICIO no son interes: siguen en COMISIONES_BANCARIAS.
var CB_CAT_INTERES = 'INTERESES_BANCARIOS';

// Reglas fijas (las decisiones de la carga de septiembre, 5-oct-2026). Lo demas sale de la
// historia de la pestaña. donde: 'cuenta' | 'tarjeta'; codigo: el Codigo del BAC.
var CB_REGLAS = [
  { donde: 'cuenta', codigo: 'L1', cat: 'INGRESO_TARJETA' },
  { donde: 'cuenta', re: /^PAGO (4966|TARJETA)/i, cat: 'PAGO_TARJETA_CREDITO' },
  { donde: 'cuenta', codigo: '59', cat: 'COMISIONES_BANCARIAS' },
  { donde: 'cuenta', re: /^(COMISION|CARGO POR SALDO)/i, cat: 'COMISIONES_BANCARIAS' },
  { donde: 'cuenta', re: /^Pago SAT/i, cat: 'IMPUESTOS' },
  { donde: 'cuenta', re: /^INTERES/i, interes: true },
  { donde: 'cuenta', re: /^COBRO EMISI/i, cat: 'COMISIONES_BANCARIAS' },   // COBRO EMISION ESTADO DE CUENTA (Juanma, 22-oct-2026)
  { donde: 'tarjeta', re: /^(SU PAGO RECIBIDO|PAGO TARJETA|PAGO AGENC)/i, cat: 'PAGO_TARJETA' },
  { donde: 'tarjeta', re: /^(INTERES|INTER\/)/i, interes: true },   // INTERES COM, INTERES MORATORIO (BI), INTER/DEVENGADO (BI)
  { donde: 'tarjeta', re: /^(CARGOS POR SERVICIO|COBRO ADMTVO|COMISION|COBRO POR SOBREGIRO|IVA\/COBRO)/i, cat: 'COMISIONES_BANCARIAS' },
  { donde: 'tarjeta', re: /^(FACEBK|GOOGLE\*ADS)/i, cat: 'MARKETING_DIGITAL' },
  { donde: 'tarjeta', re: /^UBER/i, cat: 'VIATICOS' },
  { donde: 'tarjeta', re: /^(APPLE\.COM|NETFLIX|SPOTIFY|WIX\.COM|GOOGLE\*(WORKSPACE|CLOUD|GOOGLE ONE))/i, cat: 'CUOTAS_Y_SUSCRIPCIONES' }
];

// ---------- utilidades ----------

function _cbR2(n) { return Math.round(n * 100) / 100; }
function _cbNum(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/,/g, '').trim();
  if (s === '') return 0;
  return /^-?\d+(\.\d+)?$/.test(s) ? _cbR2(Number(s)) : NaN;
}
/** La descripcion como va al maestro: sin espacios dobles; los caracteres de control que deja el
 *  BAC en lugar de una letra con tilde (0x99 en "EMISI?N") quedan como "?", igual que en el PDF. */
function _cbDesc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[\u0080-\u009f]/g, '?').replace(/\s+/g, ' ').trim();
}
function _cbDia(v) {
  var d = _fechaCarga(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}
function _cbFechaValida(s) {
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}
function _cbFinDeMes(mes) {
  var p = mes.split('-'), d = new Date(Number(p[0]), Number(p[1]), 0);
  return mes + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}

/** CSV RFC 4180 (comillas, comas y saltos dentro de comillas). Propio para que Apps Script y la
 *  nube lean exactamente igual (no depende de Utilities.parseCsv). */
function _cbCsv(texto) {
  var t = String(texto || '').replace(/^﻿/, ''), filas = [], fila = [], campo = '', q = false;
  for (var i = 0; i < t.length; i++) {
    var c = t.charAt(i);
    if (q) {
      if (c === '"') { if (t.charAt(i + 1) === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t.charAt(i + 1) === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(function (f) { return f.some(function (x) { return String(x).trim() !== ''; }); });
}

// ---------- leer el CSV normalizado ----------

/** texto -> { formato: 'CUENTA'|'TARJETA', ... , errores: [] } o null si no es un normalizado. */
function _cbLeerNormalizado(texto) {
  var filas = _cbCsv(texto);
  if (!filas.length) return null;
  var cab = filas[0].map(function (x) { return String(x).trim().toLowerCase(); }).join(',');
  if (cab === CB_CAB_CUENTA) return _cbLeerCuenta(filas);
  if (cab === CB_CAB_TARJETA) return _cbLeerTarjeta(filas);
  return null;
}

function _cbLeerCuenta(filas) {
  var r = { formato: 'CUENTA', cuenta: '', moneda: '', inicial: null, total: null, generado: '', movs: [], errores: [] };
  var cuentas = {};
  for (var i = 1; i < filas.length; i++) {
    var f = filas[i], n = i + 1;
    if (f.length !== 11) { r.errores.push('fila ' + n + ': tiene ' + f.length + ' columnas y son 11'); continue; }
    var tipo = String(f[0]).trim().toUpperCase(), cta = String(f[1]).trim();
    if (cta) cuentas[cta] = 1;
    if (!r.moneda && f[2]) r.moneda = String(f[2]).trim();
    if (tipo === 'INICIAL') {
      r.inicial = _cbNum(f[9]);
      if (isNaN(r.inicial)) r.errores.push('fila ' + n + ': saldo inicial ilegible "' + f[9] + '"');
    } else if (tipo === 'TOTAL') {
      r.total = { deb: _cbNum(f[7]), cred: _cbNum(f[8]), saldo: _cbNum(f[9]) };
      if (isNaN(r.total.deb) || isNaN(r.total.cred) || isNaN(r.total.saldo)) r.errores.push('fila ' + n + ': totales ilegibles');
    } else if (tipo === 'GENERADO') {
      r.generado = String(f[3]).trim();
      if (!_cbFechaValida(r.generado)) r.errores.push('fila ' + n + ': fecha de generacion ilegible "' + f[3] + '"');
    } else if (tipo === 'MOV') {
      var m = { fila: n, fecha: String(f[3]).trim(), ref: String(f[4]).trim().replace(/\.0+$/, ''), cod: String(f[5]).trim(),
                desc: _cbDesc(f[6]), deb: _cbNum(f[7]), cred: _cbNum(f[8]), saldo: _cbNum(f[9]), cat: String(f[10] || '').trim() };
      if (!_cbFechaValida(m.fecha)) { r.errores.push('fila ' + n + ': fecha ilegible "' + f[3] + '" (va AAAA-MM-DD)'); continue; }
      if (isNaN(m.deb) || isNaN(m.cred) || isNaN(m.saldo)) { r.errores.push('fila ' + n + ' (' + m.fecha + '): un monto no es numero'); continue; }
      if (m.deb < 0 || m.cred < 0) { r.errores.push('fila ' + n + ' (' + m.fecha + '): debito y credito van en positivo'); continue; }
      if (!m.ref) r.errores.push('fila ' + n + ' (' + m.fecha + '): sin referencia');
      r.movs.push(m);
    } else r.errores.push('fila ' + n + ': tipo desconocido "' + f[0] + '"');
  }
  var lista = Object.keys(cuentas);
  if (lista.length !== 1) r.errores.push('el archivo trae ' + lista.length + ' cuentas y debe traer una');
  r.cuenta = lista[0] || '';
  if (r.inicial === null) r.errores.push('falta la fila INICIAL (saldo inicial)');
  if (!r.total) r.errores.push('falta la fila TOTAL (totales del banco)');
  return r;
}

function _cbLeerTarjeta(filas) {
  var r = { formato: 'TARJETA', tarjeta: '', corte: '', previo: null, contado: null, movs: [], errores: [] };
  for (var i = 1; i < filas.length; i++) {
    var f = filas[i], n = i + 1;
    if (f.length !== 7) { r.errores.push('fila ' + n + ': tiene ' + f.length + ' columnas y son 7'); continue; }
    var tipo = String(f[0]).trim().toUpperCase();
    var q = _cbNum(f[4]), d = _cbNum(f[5]);
    if (tipo === 'CORTE') {
      r.tarjeta = String(f[1]).trim(); r.corte = String(f[2]).trim();
      if (!_cbFechaValida(r.corte)) r.errores.push('fila ' + n + ': fecha de corte ilegible "' + f[2] + '"');
    } else if (tipo === 'PREVIO' || tipo === 'CONTADO') {
      if (isNaN(q) || isNaN(d)) { r.errores.push('fila ' + n + ': ' + tipo + ' ilegible'); continue; }
      if (tipo === 'PREVIO') r.previo = [q, d]; else r.contado = [q, d];
    } else if (tipo === 'MOV') {
      var m = { fila: n, sub: String(f[1]).trim(), fecha: String(f[2]).trim(), desc: _cbDesc(f[3]), q: q, d: d, cat: String(f[6] || '').trim() };
      if (!_cbFechaValida(m.fecha)) { r.errores.push('fila ' + n + ': fecha ilegible "' + f[2] + '" (va AAAA-MM-DD)'); continue; }
      if (isNaN(q) || isNaN(d)) { r.errores.push('fila ' + n + ' (' + m.fecha + '): un monto no es numero'); continue; }
      if (!m.desc) r.errores.push('fila ' + n + ' (' + m.fecha + '): sin descripcion');
      r.movs.push(m);
    } else r.errores.push('fila ' + n + ': tipo desconocido "' + f[0] + '"');
  }
  if (!r.tarjeta) r.errores.push('falta la fila CORTE (tarjeta y fecha de corte)');
  if (!r.previo) r.errores.push('falta la fila PREVIO (saldo anterior)');
  if (!r.contado) r.errores.push('falta la fila CONTADO (pago de contado)');
  return r;
}

// ---------- cuadre contra el propio estado ----------

function _cbCuadreCuenta(n, mes) {
  var fr = [];
  var s = n.inicial, deb = 0, cred = 0, fin = _cbFinDeMes(mes);
  n.movs.forEach(function (m) {
    if (m.fecha.slice(0, 7) !== mes) fr.push('fila ' + m.fila + ': ' + m.fecha + ' no es de ' + mes);
    s = _cbR2(s - m.deb + m.cred); deb += m.deb; cred += m.cred;
    if (s !== m.saldo) { fr.push('fila ' + m.fila + ' (' + m.fecha + '): la cadena de saldos se rompe (da ' + s.toFixed(2) + ', el banco dice ' + m.saldo.toFixed(2) + ')'); s = m.saldo; }
  });
  deb = _cbR2(deb); cred = _cbR2(cred);
  if (n.total && (deb !== n.total.deb || cred !== n.total.cred)) {
    fr.push('NO CUADRA: movimientos ' + deb.toFixed(2) + ' / ' + cred.toFixed(2) + ' contra totales del banco ' + n.total.deb.toFixed(2) + ' / ' + n.total.cred.toFixed(2));
  }
  if (n.total && _cbR2(n.inicial - deb + cred) !== n.total.saldo) {
    fr.push('NO CUADRA: saldo inicial - debitos + creditos no da el saldo final del banco (' + n.total.saldo.toFixed(2) + ')');
  }
  if (n.generado && n.generado <= fin) fr.push('se bajo del banco el ' + n.generado + ', antes de que terminara ' + mes + ': puede faltar el final del mes. Bajarlo de nuevo.');
  return { frenos: fr, deb: deb, cred: cred };
}

function _cbCuadreTarjeta(n, mes) {
  var fr = [], q = 0, d = 0;
  if (n.corte && n.corte.slice(0, 7) !== mes) fr.push('el corte es del ' + n.corte + ', no de ' + mes);
  n.movs.forEach(function (m) {
    if (n.corte && m.fecha > n.corte) fr.push('fila ' + m.fila + ': ' + m.fecha + ' es despues del corte ' + n.corte);
    q += m.q; d += m.d;
  });
  q = _cbR2(q); d = _cbR2(d);
  if (n.previo && n.contado && (_cbR2(n.previo[0] + q) !== n.contado[0] || _cbR2(n.previo[1] + d) !== n.contado[1])) {
    fr.push('NO CUADRA: saldo anterior + movimientos = ' + _cbR2(n.previo[0] + q).toFixed(2) + ' Q / ' + _cbR2(n.previo[1] + d).toFixed(2) +
            ' $ contra pago de contado ' + n.contado[0].toFixed(2) + ' Q / ' + n.contado[1].toFixed(2) + ' $');
  }
  return { frenos: fr, q: q, d: d };
}

// ---------- la pestaña destino ----------

function _cbClaveCuenta(fecha, ref, deb, cred) {
  return fecha + '|' + String(ref).replace(/\.0+$/, '').trim() + '|' + _cbR2(deb).toFixed(2) + '|' + _cbR2(cred).toFixed(2);
}
function _cbClaveTarjeta(fecha, desc, q, d) {
  return fecha + '|' + _cbDesc(desc).toUpperCase() + '|' + _cbR2(q).toFixed(2) + '|' + _cbR2(d).toFixed(2);
}
/** Para buscar la categoria en la historia: sin digitos ni signos, las primeras 12 letras. */
function _cbRaiz(desc) { return _cbDesc(desc).toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12); }

/**
 * Lo que ya tiene la pestaña: llaves (con cuantas veces), categorias por descripcion, el ultimo
 * Balance antes del mes (cuentas), cuantas filas del mes, la ultima fila con datos y como se
 * escribe Es_Personal.
 */
function _cbLeerPestana(sh, esCuenta, mes, conf) {
  var ancho = esCuenta ? 9 : 6, ultima = sh.getLastRow();
  var datos = ultima > CB_FILA_ENC ? sh.getRange(CB_FILA_ENC + 1, 1, ultima - CB_FILA_ENC, ancho).getValues() : [];
  var ya = {}, porDesc = {}, porRaiz = {}, ultimaDatos = CB_FILA_ENC, saldoPrevio = null, delMes = 0, personales = {};
  var iDesc = esCuenta ? 3 : 1, iCat = esCuenta ? 7 : 4, iPers = esCuenta ? 8 : 5;
  for (var i = 0; i < datos.length; i++) {
    var p = datos[i];
    if (_norm(p[0]) === '' && _norm(p[iDesc]) === '') continue;
    ultimaDatos = CB_FILA_ENC + 1 + i;
    var dia = _cbDia(p[0]);
    var k = esCuenta ? _cbClaveCuenta(dia, p[1], _numero(p[4]), _numero(p[5])) : _cbClaveTarjeta(dia, p[1], _numero(p[2]), _numero(p[3]));
    ya[k] = (ya[k] || 0) + 1;
    if (dia.slice(0, 7) === mes) delMes++;
    if (esCuenta && dia && dia < mes + '-01' && _norm(p[6]) !== '') saldoPrevio = _numero(p[6]);
    var cat = _norm(p[iCat]);
    if (cat && cat !== 'POR_CLASIFICAR') {
      porDesc[_cbDesc(p[iDesc]).toUpperCase()] = cat;
      var rz = _cbRaiz(p[iDesc]);
      if (rz.length >= 6) { porRaiz[rz] = porRaiz[rz] || {}; porRaiz[rz][cat] = 1; }
      if (cat === 'PERSONAL' && _norm(p[iPers])) personales[_norm(p[iPers])] = (personales[_norm(p[iPers])] || 0) + 1;
    }
  }
  var si = conf.personal, max = 0;
  for (var v in personales) if (personales[v] > max) { max = personales[v]; si = v; }
  return { ya: ya, porDesc: porDesc, porRaiz: porRaiz, ultimaDatos: ultimaDatos, saldoPrevio: saldoPrevio, delMes: delMes, si: si };
}

/** La categoria de un movimiento y de donde salio ('csv' | 'regla' | 'historia' | 'sin'). */
function _cbCategoria(m, donde, P) {
  if (m.cat) return [m.cat, 'csv'];
  for (var i = 0; i < CB_REGLAS.length; i++) {
    var r = CB_REGLAS[i];
    if (r.donde !== donde) continue;
    var cat = r.interes ? CB_CAT_INTERES : r.cat;
    if (r.codigo && r.codigo === m.cod) return [cat, 'regla'];
    if (r.re && r.re.test(m.desc)) return [cat, 'regla'];
  }
  var d = m.desc.toUpperCase();
  if (P.porDesc[d]) return [P.porDesc[d], 'historia'];
  // el maestro tiene la descripcion cortada del PDF (18-23 letras): sirve si es el principio de esta
  for (var k in P.porDesc) if (k.length >= 12 && d.indexOf(k) === 0) return [P.porDesc[k], 'historia'];
  var rz = P.porRaiz[_cbRaiz(m.desc)];
  if (rz && Object.keys(rz).length === 1) return [Object.keys(rz)[0], 'historia'];
  return ['POR_CLASIFICAR', 'sin'];
}

// ---------- un archivo ----------

/**
 * Valida un normalizado contra el maestro y, con escribir, agrega sus filas nuevas.
 * filtro (opcional, function(mov) -> bool): el estado se valida ENTERO, pero solo se cargan los movimientos que
 * pasan el filtro (lo usa cargos_sin_fecha_tc_bac.js).
 * Devuelve { nuevas, avisos, frenado }.
 */
function _cbCargarNormalizado(ss, n, mes, nombre, escribir, filtro) {
  var esCuenta = n.formato === 'CUENTA';
  var conf = esCuenta ? CB_CUENTAS[n.cuenta] : CB_TARJETAS[n.tarjeta];
  var quien = nombre + (esCuenta ? ' (cuenta ' + n.cuenta + ')' : ' (tarjeta ' + n.tarjeta + ')');
  var frenos = n.errores.map(function (e) { return quien + ': ' + e; });
  var avisos = [];
  if (!conf) frenos.push(quien + ': no esta en CB_CUENTAS / CB_TARJETAS de cierre_bancos.js');
  if (esCuenta && conf && n.moneda && n.moneda !== conf.moneda) frenos.push(quien + ': moneda ' + n.moneda + ' y la cuenta es ' + conf.moneda);
  if (!frenos.length) {
    var c = esCuenta ? _cbCuadreCuenta(n, mes) : _cbCuadreTarjeta(n, mes);
    frenos = frenos.concat(c.frenos.map(function (e) { return quien + ': ' + e; }));
    Logger.log('  ' + quien + ': ' + n.movs.length + ' movimientos · ' + (esCuenta
      ? 'debitos ' + c.deb.toFixed(2) + ' · creditos ' + c.cred.toFixed(2)
      : 'quetzales ' + c.q.toFixed(2) + ' · dolares ' + c.d.toFixed(2)));
  }
  var sh = conf ? ss.getSheetByName(conf.hoja) : null;
  if (conf && !sh) frenos.push(quien + ': el maestro no tiene la pestaña ' + conf.hoja + (conf.hoja === '04b_Banco_BAC_USD' ? ' (crearla con crearPestanaBacUsd, cuando Juanma diga)' : ''));
  if (frenos.length) return { nuevas: 0, avisos: frenos.concat(['>> ' + quien + ': NO se escribio nada.']), frenado: true };

  var enc = esCuenta ? CB_ENC_CUENTA : CB_ENC_TARJETA;
  var encM = sh.getRange(CB_FILA_ENC, 1, 1, enc.length).getValues()[0];
  for (var e = 0; e < enc.length; e++) {
    if (_norm(encM[e]) !== enc[e]) frenos.push(quien + ': ' + conf.hoja + ' tiene otro encabezado en la columna ' + (e + 1) + ' ("' + _norm(encM[e]) + '")');
  }
  var P = _cbLeerPestana(sh, esCuenta, mes, conf);
  if (esCuenta && P.saldoPrevio !== null && _cbR2(P.saldoPrevio) !== _cbR2(n.inicial)) {
    frenos.push(quien + ': el saldo inicial del banco (' + n.inicial.toFixed(2) + ') no es el ultimo Balance de ' + conf.hoja +
                ' antes de ' + mes + ' (' + _cbR2(P.saldoPrevio).toFixed(2) + '): falta o sobra un movimiento de antes.');
  }
  if (frenos.length) return { nuevas: 0, avisos: frenos.concat(['>> ' + quien + ': NO se escribio nada.']), frenado: true };

  // las nuevas (contando repetidos) y su categoria
  var cuenta = {}, fuentes = { csv: 0, regla: 0, historia: 0, sin: 0 }, nuevas = [];
  var movs = filtro ? n.movs.filter(filtro) : n.movs;
  movs.forEach(function (m) {
    var k = esCuenta ? _cbClaveCuenta(m.fecha, m.ref, m.deb, m.cred) : _cbClaveTarjeta(m.fecha, m.desc, m.q, m.d);
    cuenta[k] = (cuenta[k] || 0) + 1;
    if (cuenta[k] <= (P.ya[k] || 0)) return;
    var cat = _cbCategoria(m, esCuenta ? 'cuenta' : 'tarjeta', P);
    fuentes[cat[1]]++;
    nuevas.push({ m: m, cat: cat[0] });
  });
  if (nuevas.length && nuevas.length !== movs.length) {
    avisos.push(quien + ': ' + (movs.length - nuevas.length) + ' de ' + movs.length + ' movimientos ya estaban en ' + conf.hoja + ' y se saltan.');
  } else if (!nuevas.length && P.delMes) {
    Logger.log('  ' + quien + ': ya estaba todo en ' + conf.hoja + '.');
  }
  if (fuentes.sin) avisos.push(quien + ': ' + fuentes.sin + ' movimiento(s) quedan POR_CLASIFICAR en ' + conf.hoja + ' (sin regla ni historia). Clasificarlos antes del reporte.');
  if (nuevas.length) Logger.log('  ' + quien + ': ' + nuevas.length + ' nuevas · categorias: ' + fuentes.csv + ' del CSV, ' + fuentes.regla + ' por regla, ' +
                                fuentes.historia + ' por historia, ' + fuentes.sin + ' POR_CLASIFICAR');
  if (!escribir || !nuevas.length) return { nuevas: escribir ? 0 : nuevas.length, avisos: avisos, frenado: false };

  // escribir: fecha como TEXTO AAAA-MM-DD (como el BANCO_BI: setValue(Date) puede no cambiar la celda)
  var ancho = enc.length;
  var bloque = nuevas.map(function (x) {
    var m = x.m, pers = x.cat === 'PERSONAL' ? P.si : 'No';
    return esCuenta ? [m.fecha, m.ref, m.cod, m.desc, m.deb, m.cred, m.saldo, x.cat, pers]
                    : [m.fecha, m.desc, m.q, m.d, x.cat, pers];
  });
  var inicio = P.ultimaDatos + 1;
  var formulas = P.ultimaDatos > CB_FILA_ENC ? sh.getRange(P.ultimaDatos, ancho + 1, 1, 3).getFormulasR1C1()[0] : ['', '', ''];
  sh.getRange(inicio, 1, bloque.length, ancho).setValues(bloque);
  if (formulas[0] && formulas[1] && formulas[2]) {
    sh.getRange(inicio, ancho + 1, bloque.length, 3).setFormulasR1C1(bloque.map(function () { return formulas.slice(); }));
  } else {
    sh.getRange(inicio, ancho + 1, bloque.length, 3).setValues(bloque.map(function (b) {
      var q = b[0].split('-'), d = new Date(Number(q[0]), Number(q[1]) - 1, Number(q[2]));
      return [d.getFullYear(), d.getMonth() + 1, _semanaISOCarga(d)];
    }));
  }
  SpreadsheetApp.flush();

  // releer (regla del 15-sep: un script de datos relee lo que escribio)
  var rel = sh.getRange(inicio, 1, bloque.length, ancho).getValues(), mal = 0;
  for (var j = 0; j < rel.length; j++) {
    var a = rel[j], m = nuevas[j].m;
    var ok = esCuenta ? _cbClaveCuenta(_cbDia(a[0]), a[1], _numero(a[4]), _numero(a[5])) === _cbClaveCuenta(m.fecha, m.ref, m.deb, m.cred)
                      : _cbClaveTarjeta(_cbDia(a[0]), a[1], _numero(a[2]), _numero(a[3])) === _cbClaveTarjeta(m.fecha, m.desc, m.q, m.d);
    if (!ok) mal++;
  }
  if (mal) avisos.push(quien + ': ' + mal + ' fila(s) no se releyeron igual a lo escrito. Revisar ' + conf.hoja + ' desde la fila ' + inicio + '.');
  Logger.log('  ' + quien + ': escritas filas ' + inicio + ' a ' + (inicio + bloque.length - 1) + ' de ' + conf.hoja);
  return { nuevas: nuevas.length, avisos: avisos, frenado: false };
}

// ---------- la carpeta del mes ----------

/** Las carpetas _sistema de "Reportes Mensual/2026-MM" (y "2026-MM (1)", el nombre que deja Drive al duplicar). */
function _cbCarpetasMes(mes) {
  var raiz = DriveApp.getFolderById(REPORTES_2026), it = raiz.getFoldersByName(CB_REPORTES_MENSUAL);
  if (!it.hasNext()) throw new Error('No encontre "' + CB_REPORTES_MENSUAL + '" en Reportes 2026');
  var mensual = it.next(), out = [], hijas = mensual.getFolders();
  var re = new RegExp('^' + mes + '( \\(\\d+\\))?$');
  while (hijas.hasNext()) {
    var c = hijas.next();
    if (!re.test(c.getName())) continue;
    var s = c.getFoldersByName(CB_SISTEMA);
    while (s.hasNext()) out.push({ nombre: c.getName() + '/' + CB_SISTEMA, carpeta: s.next() });
  }
  out.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
  return out;
}

/**
 * Los archivos de _sistema convertidos al normalizado: [{ nombre, huellas, norm }] y avisos.
 * Una cuenta (o tarjeta) con DOS archivos distintos en el mes frena: no se adivina cual vale.
 * Dos archivos que dan exactamente el mismo normalizado (el .xls del banco y el CSV que la Mac
 * saco de el) son el mismo estado de cuenta y entran una vez.
 */
function _cbArchivosMes(mes, vistos) {
  var carpetas = _cbCarpetasMes(mes), leidos = [], avisos = [], frenos = [];
  if (!carpetas.length) avisos.push('No hay carpeta ' + mes + '/' + CB_SISTEMA + ' en Reportes 2026/' + CB_REPORTES_MENSUAL + '.');
  var nube = typeof ROSANTA_NUBE === 'object' && ROSANTA_NUBE ? ROSANTA_NUBE : null;
  carpetas.forEach(function (c) {
    var it = c.carpeta.getFiles();
    while (it.hasNext()) {
      var f = it.next(), nombre = f.getName(), mime = f.getMimeType();
      var esCsv = /\.(csv|txt)$/i.test(nombre) || mime === 'text/csv' || mime === 'text/plain';
      var esXls = /\.xls$/i.test(nombre) || mime === 'application/vnd.ms-excel';
      if (!esCsv && !esXls) continue;
      var huella = f.getId() + ':' + f.getLastUpdated().getTime();
      if (vistos[huella]) continue;
      var texto = esCsv ? f.getBlob().getDataAsString('UTF-8') : '';
      var norm = esCsv ? _cbLeerNormalizado(texto) : null;
      if (!norm && nube) {
        // en la nube: el archivo del banco, convertido en la precarga con banco-normalizar.js.
        // Devuelve { texto } , { error } (es del banco pero no cuadra / cuenta desconocida) o null (no es del banco).
        var cv = nube.bancoANormalizado(f.getId());
        if (cv && cv.error) { avisos.push(c.nombre + '/' + nombre + ': ' + cv.error + ' >> NO se escribio nada.'); continue; }
        if (cv && cv.texto) { texto = cv.texto; norm = _cbLeerNormalizado(cv.texto); }
      }
      if (!norm) {
        if (esXls || /^Pro0*duct|^Product/.test(texto)) {
          avisos.push(c.nombre + '/' + nombre + ': es del banco y falta pasarlo al CSV normalizado ' +
                      '(node cloud/herramientas/xls-a-csv-banco.js en la Mac).');
        }
        continue;
      }
      var quien = norm.formato === 'CUENTA' ? 'cuenta ' + norm.cuenta : 'tarjeta ' + norm.tarjeta;
      leidos.push({ nombre: c.nombre + '/' + nombre, huellas: [huella], norm: norm, clave: quien, texto: texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim() });
    }
  });
  var porClave = {}, items = [];
  leidos.forEach(function (x) { (porClave[x.clave] = porClave[x.clave] || []).push(x); });
  Object.keys(porClave).sort().forEach(function (k) {
    var g = porClave[k];
    var iguales = g.every(function (x) { return x.texto === g[0].texto; });
    if (!iguales) {
      frenos.push(k + ': hay ' + g.length + ' archivos distintos para ' + mes + ' (' + g.map(function (x) { return x.nombre; }).join(', ') +
                  '). No se adivina cual vale: dejar uno solo en ' + CB_SISTEMA + '. >> ' + k + ': NO se escribio nada.');
      return;
    }
    items.push({ nombre: g.map(function (x) { return x.nombre; }).join(' = '), huellas: [].concat.apply([], g.map(function (x) { return x.huellas; })), norm: g[0].norm });
  });
  return { items: items, avisos: avisos.concat(frenos) };
}

function _cbCorrer(mes, escribir) {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(String(mes || ''))) throw new Error('El mes va como AAAA-MM (por ejemplo 2026-10).');
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  _zonaCargaIgual_(ss);
  var vistos = escribir ? _progreso() : {};
  var a = _cbArchivosMes(mes, vistos), avisos = a.avisos, total = 0;
  Logger.log(escribir ? '=== Cierre de bancos ' + mes + ' ===' : '=== Cierre de bancos ' + mes + ': revision, no se escribe ===');
  if (!a.items.length) Logger.log('No hay archivos nuevos del banco para ' + mes + '.');
  a.items.forEach(function (x) {
    Logger.log(x.nombre + '  ' + x.norm.formato);
    var r = _cbCargarNormalizado(ss, x.norm, mes, x.nombre, escribir);
    if (escribir && !r.frenado) x.huellas.forEach(function (h) { vistos[h] = 1; });   // un archivo frenado se reintenta la proxima vez
    total += r.nuevas;
    avisos = avisos.concat(r.avisos);
  });
  if (escribir) _guardarProgreso(vistos);
  Logger.log((escribir ? 'Filas nuevas en total: ' : 'Filas que agregaria: ') + total);
  if (avisos.length) {
    Logger.log('--- REVISAR ---');
    avisos.forEach(function (x) { Logger.log('  ' + x); });
  }
  return total;
}

function revisarCierreBancos(mes) { return _cbCorrer(mes, false); }
function cargarCierreBancos(mes)  { return _cbCorrer(mes, true); }

// ---------- tarjeta BI: a mano ----------

/**
 * La tarjeta BI no tiene descarga: Bi Banking solo muestra la pantalla "Detalle de movimientos
 * tarjeta de credito". Juanma (o Claude, leyendo la captura) pega una lista asi:
 *     CORTE;2026-10-31
 *     SALDO_ANTERIOR;854.26
 *     SALDO_FINAL;1020.50
 *     2026-10-15;INTERES MORATORIO (BI);8.88
 *     2026-10-16;PAGO TARJETA X61601211;-200.00;PAGO_TARJETA      <- la categoria es opcional
 * Los pagos en negativo. El "00/00/0000" de Bi Banking (intereses devengados) va con la fecha del
 * corte. Cuadra si saldo anterior + movimientos = saldo final, y entra por el mismo camino que la
 * tarjeta BAC (mismas llaves, mismas reglas) a 06_Tarjeta_Credito_BI.
 * Tambien sirve dejar un CSV normalizado de TARJETA con producto 4042-****-****-4132 en la carpeta.
 */
function _cbTextoTarjetaBI(texto) {
  var lineas = String(texto || '').split(/\r?\n/), filas = [CB_CAB_TARJETA.split(',')], corte = '', ant = '', fin = '';
  var esc = function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  lineas.forEach(function (l) {
    var p = l.split(';').map(function (x) { return x.trim(); });
    if (!p[0]) return;
    if (p[0] === 'CORTE') corte = p[1];
    else if (p[0] === 'SALDO_ANTERIOR') ant = p[1];
    else if (p[0] === 'SALDO_FINAL') fin = p[1];
    else filas.push(['MOV', '', p[0], p[1] || '', p[2] || '', '0', p[3] || '']);
  });
  filas.splice(1, 0, ['CORTE', '4042-****-****-4132', corte, '', '', '', ''], ['PREVIO', '', '', '', ant, '0', '']);
  filas.push(['CONTADO', '', '', '', fin, '0', '']);
  return filas.map(function (f) { return f.map(esc).join(','); }).join('\n');
}
function _cbTarjetaBI(texto, escribir) {
  var n = _cbLeerNormalizado(_cbTextoTarjetaBI(texto));
  var mes = /^\d{4}-\d{2}/.test(n.corte) ? n.corte.slice(0, 7) : '';
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  _zonaCargaIgual_(ss);
  var r = _cbCargarNormalizado(ss, n, mes, 'lista pegada', escribir);
  Logger.log((escribir ? 'Filas nuevas: ' : 'Filas que agregaria: ') + r.nuevas);
  if (r.avisos.length) { Logger.log('--- REVISAR ---'); r.avisos.forEach(function (x) { Logger.log('  ' + x); }); }
  return r.nuevas;
}
function revisarTarjetaBIPegada(texto) { return _cbTarjetaBI(texto, false); }
function cargarTarjetaBIPegada(texto)  { return _cbTarjetaBI(texto, true); }

// ---------- la pestaña de la cuenta en dolares (PROPUESTA, no se corre sola) ----------

/**
 * Crea 04b_Banco_BAC_USD justo despues de 04_Banco_BAC, con sus mismas 4 filas de cabecera y las
 * mismas 12 columnas (Fecha, Referencia, Codigo, Descripción, Débito, Crédito, Balance, Categoría,
 * Es_Personal, Año, Mes, Semana). Montos en DOLARES, tal cual el banco. Correr una sola vez,
 * cuando Juanma apruebe; despues cargarCierreBancos carga la cuenta 905757274.
 */
function crearPestanaBacUsd() {
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  if (ss.getSheetByName('04b_Banco_BAC_USD')) return 'Ya existe 04b_Banco_BAC_USD: no se toco nada.';
  var modelo = ss.getSheetByName('04_Banco_BAC');
  var hoja = ss.insertSheet('04b_Banco_BAC_USD', modelo.getIndex());
  modelo.getRange(1, 1, 4, 12).copyTo(hoja.getRange(1, 1, 4, 12));
  for (var c = 1; c <= 12; c++) hoja.setColumnWidth(c, modelo.getColumnWidth(c));
  hoja.setFrozenRows(modelo.getFrozenRows());
  hoja.getRange(1, 1).setValue('BANCO BAC — Cuenta en DÓLARES 905757274 (CORSAGA, S.A.)');
  hoja.getRange(2, 1).setValue('Movimientos en USD tal cual el banco, desde el cierre de mes (cierre_bancos.js). Los pagos a la tarjeta BAC salen de aqui.');
  return 'Creada 04b_Banco_BAC_USD.';
}
