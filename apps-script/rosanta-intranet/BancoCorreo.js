/**
 * TRANSFERENCIAS DEL BI POR CORREO (16-oct-2026)
 *
 * Juanma (16-oct-2026): "no tenemos que esperar a que yo cargue los lunes los movimientos
 * bancarios; el banco envia un correo con el movimiento al momento de hacer la transferencia".
 * BI manda a restaurante@rosanta.rest un aviso por cada transferencia ACH que sale de la cuenta
 * (bibanking@notificacionesbi.com.gt, asunto "BI/BB/ACH: Notificación operación") con banco y
 * cuenta destino, nombre del beneficiario, "Descripción de pago" y monto.
 *
 * Comprobado contra el estado de cuenta (29-sep y 2-oct-2026): la "Descripción de pago" del
 * aviso ES la glosa del estado de cuenta ("Grupo Eco Septiembre", "2a Septiembre jeffry") y el
 * cargo cae el mismo dia del aviso. El horario de ACH del BI (las de mas de Q20,000 despues de
 * las 15:45 se acreditan al dia habil siguiente) mueve cuando le llega al proveedor, no cuando
 * sale de la cuenta. Igual el cruce da hasta BCO_DIAS_CRUCE_ dias de margen.
 *
 * Como en FelCorreo.js, el aviso NO reemplaza al estado de cuenta:
 *  - Se guarda en la pestaña BANCO_CORREO del Sheet de config, NO en el maestro.
 *  - Pagos lo usa como un cargo del banco provisorio (estatus "Banco por correo") solo mientras
 *    el estado de cuenta no lo trae. El lunes entra el cargo de verdad y manda ese.
 *  - Si el estado de cuenta ya cubre ese dia y el cargo no esta, el dueño lo ve en
 *    "Banco por revisar" como transferencia avisada que no aparece.
 *  - La categoria sale de la historia de la cuenta destino (la que el maestro le puso a sus
 *    transferencias anteriores). Asi la planilla (NOMINA) no se ofrece como pago de una factura.
 *
 * Solo BI: BAC manda sus avisos en PDF adjunto (pendiente).
 * Las transferencias a terceros dentro del BI tambien llegan por guate-ACH (destino INDUSTRIAL).
 *
 * AMBITO GLOBAL: todo empieza con bco / _bco; lo privado termina en guion bajo.
 */

var BCO_HOJA_ = 'BANCO_CORREO';
var BCO_COLS_ = ['FECHA', 'HORA', 'MEDIO', 'BANCO_DESTINO', 'CUENTA', 'NOMBRE', 'DESCRIPCION', 'MONTO', 'MENSAJE_ID', 'LEIDO'];
var BCO_QUERY_ = 'from:bibanking@notificacionesbi.com.gt subject:"Notificación operación"';
var BCO_DIAS_ = 60;          // de sobra para aprender la categoria de cada cuenta destino
var BCO_RESPIRO_S_ = 120;    // entre dos lecturas seguidas al abrir Pagos
var BCO_DIAS_CRUCE_ = 4;     // el cargo del estado de cuenta, del dia del aviso a 4 dias despues
// Lo que no se paga a proveedores (las mismas que salta pagPagosBanco_)
var BCO_FUERA_ = /^(PERSONAL|NOMINA|IGSS|DEVOLUCION|PROPINA)/;
// Una cuenta nueva con estas glosas es planilla. Juanma (16-oct-2026): las transferencias a empleados
// llevan el nombre del empleado ("S37 Eddy", "1aAgosto2026Efrain") o "cocina extras"; los nombres los
// aprende _bcoNombresPlanilla_ de la historia.
var BCO_NOMINA_ = /n[oó]mina|planilla|quincena|aguinaldo|bono ?14|extras|empleados|finiquito|cocina y limpieza/i;
var BCO_NO_NOMBRES_ = ['enero', 'febrero', 'marzo', 'marzon', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
  'noviembre', 'diciembre', 'cocina', 'sala', 'barra', 'limpieza', 'limpeza', 'personal', 'varios', 'bono', 'complemento', 'transporte',
  'individuales', 'nomina', 'extras', 'empleados', 'finiquito', 'aguinaldo'];

var BCO_CAMPOS_ = { banco: 'banco', generadopor: 'origen', cuenta: 'cuenta', nombre: 'nombre',
                    descripciondepago: 'desc', creditode: 'monto' };

/**
 * Lee un aviso de transferencia del BI (el HTML del correo). Pura: la prueba la corre con el
 * aviso de la lavanderia del 16-oct-2026. Devuelve null si no es una transferencia que SALE
 * de CORSAGA.
 */
function bcoParsear_(html) {
  var celdas = [], re = /<td[^>]*>([\s\S]*?)<\/td>/gi, m;
  while ((m = re.exec(String(html || '')))) celdas.push(_fecTexto_(m[1]));
  var d = {}, bancos = [];
  for (var i = 0; i + 1 < celdas.length; i++) {
    var k = BCO_CAMPOS_[_fecLlave_(celdas[i])];
    if (!k) continue;
    if (k === 'banco') bancos.push(celdas[i + 1]);   // el primero es el de origen, el segundo el de destino
    else if (d[k] === undefined) d[k] = celdas[i + 1];
    i++;
  }
  if (!/CORSAGA/i.test(d.origen || '') || !d.monto) return null;
  var mo = /^\s*Q\.?\s*([\d,]+(?:\.\d+)?)\s*$/i.exec(d.monto);
  if (!mo) return null;   // en dolares u otra moneda: las facturas son en quetzales
  var q = _finR_(Number(mo[1].replace(/,/g, '')));
  if (!(q > 0)) return null;
  return { banco_destino: String(bancos[1] || '').trim(), cuenta: String(d.cuenta || '').replace(/\D/g, ''),
           nombre: String(d.nombre || '').trim(), desc: String(d.desc || '').trim(), q: q };
}

function _bcoHoja_() {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(BCO_HOJA_);
  if (!sh) {
    sh = ss.insertSheet(BCO_HOJA_);
    sh.getRange(1, 1, 1, BCO_COLS_.length).setValues([BCO_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // fecha, hora y cuenta como texto: la hoja no las convierte ni les come ceros
    sh.getRange('A:B').setNumberFormat('@'); sh.getRange('E:E').setNumberFormat('@');
  }
  return sh;
}

/**
 * Lee los avisos del BI de los ultimos `dias` dias y anota los nuevos (por MENSAJE_ID: dos
 * transferencias iguales el mismo dia son dos cargos). La fecha y la hora son las del correo
 * en Guatemala: el aviso sale en el momento de la operacion.
 */
function bcoLeer_(dias) {
  if (procEnNube_('proc_banco')) return { correos: 0, nuevos: 0, repetidos: 0, errores: [], en_la_nube: true };   // lo lee el servidor nuevo (NubePagos.js)
  dias = dias || BCO_DIAS_;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { correos: 0, nuevos: 0, repetidos: 0, errores: ['otra lectura en curso'] };
  try {
    var sh = _bcoHoja_(), v = sh.getDataRange().getValues();
    var iMsg = v[0].map(function (h) { return String(h || '').trim(); }).indexOf('MENSAJE_ID'), ids = {};
    for (var i = 1; i < v.length; i++) ids[String(v[i][iMsg])] = 1;
    var msgs = [], tok = null, vueltas = 0;
    do {
      var opt = { q: BCO_QUERY_ + ' newer_than:' + dias + 'd', maxResults: 100, includeSpamTrash: true };
      if (tok) opt.pageToken = tok;
      var lista = Gmail.Users.Messages.list('me', opt);
      msgs = msgs.concat((lista && lista.messages) || []);
      tok = lista && lista.nextPageToken;
    } while (tok && ++vueltas < 5);
    var rep = { correos: msgs.length, nuevos: 0, repetidos: 0, otros: 0, errores: [] }, filas = [], ahora = new Date();
    msgs.forEach(function (mm) {
      if (ids[mm.id]) { rep.repetidos++; return; }
      try {
        var msg = Gmail.Users.Messages.get('me', mm.id), t = new Date(Number(msg.internalDate));
        var fe = Utilities.formatDate(t, 'America/Guatemala', 'yyyy-MM-dd'), ho = Utilities.formatDate(t, 'America/Guatemala', 'HH:mm');
        var b = bcoParsear_(_fecCuerpo_(msg));
        if (!b) { rep.otros++; filas.push([fe, ho, '', '', '', 'no es transferencia de CORSAGA', '', '', mm.id, ahora]); return; }
        filas.push([fe, ho, 'Banco BI', b.banco_destino, b.cuenta, b.nombre, b.desc, b.q, mm.id, ahora]);
        rep.nuevos++;
      } catch (e) { rep.errores.push(mm.id + ': ' + String(e && e.message || e)); }
    });
    if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, BCO_COLS_.length).setValues(filas);
    SpreadsheetApp.flush();
    return rep;
  } finally { lock.releaseLock(); }
}

/** Lee el correo si la ultima lectura fue hace mas de BCO_RESPIRO_S_. Nunca rompe a quien la llama. */
function bcoLeerSiToca_() {
  var c = CacheService.getScriptCache();
  try { if (c.get('bco_ult')) return null; } catch (e) { /* sin cache: se lee */ }
  try { c.put('bco_ult', '1', BCO_RESPIRO_S_); } catch (e) { /* idem */ }
  try { return bcoLeer_(); } catch (e) { return { errores: [String(e && e.message || e)] }; }
}

/** Las transferencias anotadas desde el correo. Solo lee la hoja: no toca Gmail. */
function bcoTransferencias_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(BCO_HOJA_);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var ix = {}; BCO_COLS_.forEach(function (k) { ix[k] = H.indexOf(k); });
  return v.slice(1).filter(function (r) { return _finNum_(r[ix.MONTO]) > 0; }).map(function (r) {
    var d = pagDia_(r[ix.FECHA]);
    return { fecha: pagIso_(d), dia: pagNumDia_(d), hora: String(r[ix.HORA] || '').trim(), medio: String(r[ix.MEDIO] || 'Banco BI').trim(),
             cuenta: String(r[ix.CUENTA] || '').replace(/\D/g, ''), nombre: String(r[ix.NOMBRE] || '').trim(),
             desc: String(r[ix.DESCRIPCION] || '').trim(), q: _finR_(_finNum_(r[ix.MONTO])), id: String(r[ix.MENSAJE_ID] || '') };
  }).filter(function (t) { return t.fecha; });
}

function _bcoNorm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
/** La glosa del estado de cuenta es la descripcion del aviso (a veces cortada, o sin espacios). */
function _bcoMismaGlosa_(glosaBanco, desc) {
  var a = _bcoNorm_(glosaBanco), b = _bcoNorm_(desc);
  return !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 8 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)));
}

/**
 * EL CRUCE con el estado de cuenta (pura: la prueba la corre con datos fijos).
 *  correos: bcoTransferencias_(). crudo: TODOS los cargos de la cuenta BI del maestro (planilla
 *  incluida: hace falta para aprender que cuenta es planilla), { llave, fecha, dia, q, glosa, categoria }.
 * Un aviso esta en el estado de cuenta si hay un cargo del mismo monto entre el dia del aviso y
 * BCO_DIAS_CRUCE_ despues, con su descripcion como glosa; si ninguno trae la glosa, vale el unico
 * cargo de ese monto en ese rango. Devuelve:
 *  pagos      los avisos que el estado de cuenta todavia no trae, como cargos del banco para Pagos
 *             (sin los de planilla ni personales)
 *  alias      { llave del aviso: llave del cargo } para lo que el dueño confirmo antes del lunes
 *  faltantes  avisos de dias que el estado de cuenta ya cubre y que no aparecen en el
 *  ult        el ultimo dia que trae el estado de cuenta de la cuenta BI
 */
function _bcoCruzar_(correos, crudo) {
  var ult = crudo.reduce(function (a, p) { return p.dia > a ? p.dia : a; }, 0);
  var usados = {}, catCuenta = {}, alias = {}, sueltos = [];
  correos.slice().sort(function (a, b) { return a.dia - b.dia || (a.hora < b.hora ? -1 : 1); }).forEach(function (c) {
    var cand = crudo.filter(function (p) { return !usados[p.llave] && Math.abs(p.q - c.q) < 0.011 && p.dia - c.dia >= 0 && p.dia - c.dia <= BCO_DIAS_CRUCE_; });
    var conGlosa = cand.filter(function (p) { return _bcoMismaGlosa_(p.glosa, c.desc); });
    var p = conGlosa.length ? conGlosa.sort(function (a, b) { return a.dia - b.dia; })[0] : cand.length === 1 ? cand[0] : null;
    if (!p) { sueltos.push(c); return; }
    usados[p.llave] = 1;
    alias[_bcoLlave_(c)] = _pagLlavePago_({ banco: 'Banco BI', fecha: p.fecha, q: p.q, glosa: p.glosa });
    if (c.cuenta && p.categoria) { var k = catCuenta[c.cuenta] = catCuenta[c.cuenta] || {}; k[p.categoria] = (k[p.categoria] || 0) + 1; }
  });
  var nombres = _bcoNombresPlanilla_(crudo);
  var catDe = function (c) {
    var k = catCuenta[c.cuenta];
    if (k) return Object.keys(k).sort(function (a, b) { return k[b] - k[a] || (a < b ? -1 : 1); })[0];
    var d = _bcoNorm_(c.desc);
    return BCO_NOMINA_.test(c.desc) || nombres.some(function (n) { return d.indexOf(n) !== -1; }) ? 'NOMINA' : 'POR_CLASIFICAR';
  };
  var pagos = [], faltantes = [];
  sueltos.forEach(function (c) {
    var cat = catDe(c);
    // el estado de cuenta ya cubre ese dia (con un dia de margen) y no lo trae
    if (ult && c.dia < ult) faltantes.push({ fecha: c.fecha, hora: c.hora, q: c.q, glosa: c.desc, nombre: c.nombre, categoria: cat });
    else if (!BCO_FUERA_.test(cat))
      pagos.push({ llave: 'CORREO|' + c.id, banco: c.medio || 'Banco BI', fecha: c.fecha, dia: c.dia, q: c.q,
                   // el nombre del beneficiario ayuda a reconocer al proveedor; la llave usa solo la descripcion
                   glosa: c.desc + (c.nombre ? ' · ' + c.nombre : ''), llave_pago: _bcoLlave_(c), categoria: cat, correo: true, hora: c.hora });
  });
  return { pagos: pagos, alias: alias, faltantes: faltantes, ult: ult };
}

/**
 * Los nombres de los empleados, sacados de las glosas de planilla del estado de cuenta ("S26Eddy",
 * "1aAgosto2026Efrain", "S39 fernandad Cocina"). Un nombre cuenta si sale en 2 o mas glosas de NOMINA
 * y en mas del doble que en las de otras categorias: asi "tavito" (una sola vez mal categorizado como NOMINA, y muchas
 * como COCTELERIA) no convierte en planilla los pagos a Tavito. Pura.
 */
function _bcoNombresPlanilla_(crudo) {
  var pal = function (g) {
    return String(g || '').replace(/([a-z])([A-Z])/g, '$1 $2').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .split(/[^a-z]+/).map(function (w) { return w.replace(/^a(?=enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/, ''); })   // "1ajulio"
      .filter(function (w) { return w.length >= 4 && BCO_NO_NOMBRES_.indexOf(w) === -1; });
  };
  var enNomina = {}, fuera = {};
  crudo.forEach(function (p) {
    var dic = /^NOMINA/.test(p.categoria || '') ? enNomina : fuera, vistos = {};
    pal(p.glosa).forEach(function (w) { if (!vistos[w]) { vistos[w] = 1; dic[w] = (dic[w] || 0) + 1; } });
  });
  return Object.keys(enNomina).filter(function (w) { return enNomina[w] >= 2 && enNomina[w] > 2 * (fuera[w] || 0); });
}

/** La llave de Pagos de un aviso: la misma que tendra su cargo el lunes si la glosa es igual. */
function _bcoLlave_(c) { return _pagLlavePago_({ banco: c.medio || 'Banco BI', fecha: c.fecha, q: c.q, glosa: c.desc }); }
