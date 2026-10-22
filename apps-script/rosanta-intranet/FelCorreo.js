/**
 * FACTURAS DEL FEL POR CORREO (13-oct-2026)
 *
 * SAT manda a restaurante@rosanta.rest un aviso por cada DTE emitido a CORSAGA, en el
 * momento en que se emite (notificacionesfel@sat.gob.gt, asunto "Notificación Factura
 * Electrónica"). Hasta hoy Pagos solo veia una factura cuando entraba el FEL en la carga
 * del lunes. Juanma (13-oct-2026): "registrar las facturas en cuanto son recibidas".
 *
 * El aviso trae tipo, serie, numero, NIT y nombre del emisor, establecimiento, fecha y
 * monto: todo lo que Pagos usa. NO trae categoria, ni si es personal, ni si despues se
 * anula. Por eso:
 *  - Se guarda en la pestaña FEL_CORREO del Sheet de config y, desde el 22-oct-2026, pasa sola al
 *    FEL del maestro (fecAlMaestro_, al final de este archivo). El export del lunes no la duplica
 *    y corrige las anuladas (cargador.js).
 *  - Pagos la muestra con la etiqueta "por correo" solo los minutos que tarda en entrar al
 *    maestro (llave NIT|numero). Desde ahi manda la del maestro.
 *  - En el maestro la categoria sale de 00_Proveedores por Establecimiento, como en la carga
 *    del lunes. Un establecimiento nuevo queda en POR_CLASIFICAR hasta que se agregue alli.
 *  - Una anulada se sigue viendo hasta el lunes: SAT no avisa anulaciones por correo
 *    (revisado el 13-oct-2026 sobre 201 avisos, todos de emision).
 *
 * Se lee cada vez que se abre Pagos (con 2 minutos de respiro) y en calentarCaches, que
 * corre cada 5 minutos. Busca tambien en la papelera: borrar el aviso no borra la factura.
 *
 * AMBITO GLOBAL: todo empieza con fec / _fec; lo privado termina en guion bajo.
 */

var FEC_HOJA_ = 'FEL_CORREO';
var FEC_COLS_ = ['FECHA', 'TIPO', 'SERIE', 'NUMERO', 'NIT', 'NOMBRE', 'ESTABLECIMIENTO', 'MONEDA', 'MONTO',
                 'AUTORIZACION', 'MENSAJE_ID', 'LEIDO'];
var FEC_QUERY_ = 'from:notificacionesfel@sat.gob.gt';
var FEC_DIAS_ = 21;          // cuanto mira para atras: de sobra para cubrir un lunes sin carga
var FEC_RESPIRO_S_ = 120;    // entre dos lecturas seguidas al abrir Pagos

// La etiqueta de cada celda del aviso (sin tildes, minusculas, sin espacios) → campo
var FEC_CAMPOS_ = { tipo: 'tipo', numeroautorizacion: 'aut', serie: 'serie', numero: 'numero', emisor: 'emisor',
                    establecimiento: 'establecimiento', fechadeemision: 'fecha', monto: 'monto' };

function _fecTexto_(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&([aeiou])acute;/gi, '$1').replace(/&ntilde;/gi, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
    .replace(/\s+/g, ' ').trim();
}
function _fecLlave_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Lee un aviso de SAT (el HTML del correo). Pura: la prueba la corre con el aviso de
 * ECONTRISA del 13-oct-2026. Devuelve null si no es un aviso de DTE.
 */
function fecParsear_(html) {
  var celdas = [], re = /<td[^>]*>([\s\S]*?)<\/td>/gi, m;
  while ((m = re.exec(String(html || '')))) celdas.push(_fecTexto_(m[1]));
  var d = {};
  for (var i = 0; i + 1 < celdas.length; i++) {
    var k = FEC_CAMPOS_[_fecLlave_(celdas[i])];
    if (k && d[k] === undefined) { d[k] = celdas[i + 1]; i++; }
  }
  if (!d.numero || !d.emisor || !d.fecha || !d.monto) return null;
  var em = /^\s*([0-9]+K?)\s*-\s*(.*)$/i.exec(d.emisor) || [];
  var mo = /^\s*([A-Z]{3})\s*-\s*(-?[\d,]+(?:\.\d+)?)/.exec(d.monto) || [];
  var fe = /(\d{4}-\d{2}-\d{2})/.exec(d.fecha) || [];
  var r = {
    tipo: String(d.tipo || '').split(' - ')[0].trim().toUpperCase(),
    serie: String(d.serie || '').trim(), numero: String(d.numero).replace(/\D/g, ''),
    nit: pagNit_(em[1] || ''), nombre: String(em[2] || '').trim(),
    establecimiento: String(d.establecimiento || '').replace(/^\s*\d+\s*-\s*/, '').trim(),
    fecha: fe[1] || '', moneda: mo[1] || '', monto: mo[2] ? Number(mo[2].replace(/,/g, '')) : null,
    aut: String(d.aut || '').trim()
  };
  if (!r.numero || !r.nit || !r.fecha || r.monto === null || isNaN(r.monto)) return null;
  return r;
}

/** El HTML (o el texto) de un mensaje del servicio avanzado de Gmail. */
function _fecCuerpo_(msg) {
  var cola = [msg.payload], html = '', texto = '';
  while (cola.length) {
    var p = cola.shift();
    if (!p) continue;
    if (p.parts) cola = cola.concat(p.parts);
    if (!p.body || !p.body.data) continue;
    var s = Utilities.newBlob(_cieBytes_(p.body.data)).getDataAsString('UTF-8');
    if (/html/i.test(p.mimeType || '')) html = html || s; else texto = texto || s;
  }
  return html || texto;
}

function _fecHoja_() {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(FEC_HOJA_);
  if (!sh) {
    sh = ss.insertSheet(FEC_HOJA_);
    sh.getRange(1, 1, 1, FEC_COLS_.length).setValues([FEC_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // fecha, numero y NIT como texto: la hoja no los convierte ni les come ceros
    sh.getRange('A:A').setNumberFormat('@'); sh.getRange('C:E').setNumberFormat('@');
  }
  return sh;
}

/**
 * Lee los avisos de SAT de los ultimos `dias` dias y anota los nuevos. Un mensaje ya
 * leido se salta; una factura ya anotada (SAT a veces avisa dos veces) tambien.
 */
function fecLeer_(dias) {
  if (procEnNube_('proc_fel')) return { correos: 0, nuevos: 0, repetidos: 0, errores: [], en_la_nube: true };   // lo lee el servidor nuevo (NubePagos.js)
  dias = dias || FEC_DIAS_;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { correos: 0, nuevos: 0, repetidos: 0, errores: ['otra lectura en curso'] };
  try {
    var sh = _fecHoja_(), v = sh.getDataRange().getValues();
    var H = v[0].map(function (h) { return String(h || '').trim(); });
    var iMsg = H.indexOf('MENSAJE_ID'), iNit = H.indexOf('NIT'), iNum = H.indexOf('NUMERO');
    var ids = {}, llaves = {};
    for (var i = 1; i < v.length; i++) { ids[String(v[i][iMsg])] = 1; llaves[pagNit_(v[i][iNit]) + '|' + String(v[i][iNum]).trim()] = 1; }
    var msgs = [], tok = null, vueltas = 0;
    do {
      var opt = { q: FEC_QUERY_ + ' newer_than:' + dias + 'd', maxResults: 100, includeSpamTrash: true };
      if (tok) opt.pageToken = tok;
      var lista = Gmail.Users.Messages.list('me', opt);
      msgs = msgs.concat((lista && lista.messages) || []);
      tok = lista && lista.nextPageToken;
    } while (tok && ++vueltas < 5);
    var rep = { correos: msgs.length, nuevos: 0, repetidos: 0, otros: 0, errores: [] }, filas = [], ahora = new Date();
    msgs.forEach(function (mm) {
      if (ids[mm.id]) { rep.repetidos++; return; }
      try {
        var f = fecParsear_(_fecCuerpo_(Gmail.Users.Messages.get('me', mm.id)));
        if (!f) { rep.otros++; filas.push(['', '', '', '', '', 'no es aviso de DTE', '', '', '', '', mm.id, ahora]); return; }
        var ll = f.nit + '|' + f.numero;
        if (llaves[ll]) { rep.repetidos++; return; }
        llaves[ll] = 1;
        filas.push([f.fecha, f.tipo, f.serie, f.numero, f.nit, f.nombre, f.establecimiento, f.moneda, f.monto, f.aut, mm.id, ahora]);
        rep.nuevos++;
      } catch (e) { rep.errores.push(mm.id + ': ' + String(e && e.message || e)); }
    });
    if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, FEC_COLS_.length).setValues(filas);
    SpreadsheetApp.flush();
    return rep;
  } finally { lock.releaseLock(); }
}

/** Lee el correo si la ultima lectura fue hace mas de FEC_RESPIRO_S_. Nunca rompe a quien la llama. */
function fecLeerSiToca_() {
  var c = CacheService.getScriptCache();
  try { if (c.get('fec_ult')) return null; } catch (e) { /* sin cache: se lee */ }
  try { c.put('fec_ult', '1', FEC_RESPIRO_S_); } catch (e) { /* idem */ }
  try { return fecLeer_(); } catch (e) { return { errores: [String(e && e.message || e)] }; }
}

/**
 * El ultimo aviso de SAT que entro (14-oct-2026, Juanma: "agrega la alerta en Hoy cuando SAT no
 * avise"). Del 13 al 14-oct SAT dejo de mandar avisos y nadie se dio cuenta: las facturas de la
 * semana no entraban a Pagos. LEIDO es cuando la intranet lo encontro (cada 5 minutos), asi que
 * es la llegada del correo con 5 minutos de margen. null si la hoja no tiene avisos.
 */
function fecUltimoAviso_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(FEC_HOJA_);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var iL = H.indexOf('LEIDO'), iN = H.indexOf('NUMERO'), iF = H.indexOf('FECHA'), iE = H.indexOf('ESTABLECIMIENTO'), iM = H.indexOf('MONTO');
  var ult = null;
  for (var r = 1; r < v.length; r++) {
    if (!String(v[r][iN] || '').trim() || !(v[r][iL] instanceof Date)) continue;   // "no es aviso de DTE" no cuenta
    var fe = pagIso_(pagDia_(v[r][iF]));
    if (!ult || v[r][iL] > ult.leido || (+v[r][iL] === +ult.leido && fe > ult.fecha))
      ult = { leido: v[r][iL], fecha: fe, proveedor: String(v[r][iE] || ''), monto: _finNum_(v[r][iM]) };
  }
  return ult;
}

/**
 * Los dias habiles (lunes a sabado: los proveedores entregan tambien el sabado) que pasaron
 * COMPLETOS sin ningun aviso: los que hay entre el dia del ultimo aviso y hoy, sin contar
 * ninguno de los dos. Pura (la prueba la corre con fechas fijas).
 */
function fecDiasSinAviso_(ultimo, ahora) {
  if (!ultimo) return 0;
  var d = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 1), hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()), n = 0;
  for (; d < hoy; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++;
  return n;
}

/** Las facturas anotadas desde el correo. Solo lee la hoja: no toca Gmail. */
function fecFacturas_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(FEC_HOJA_);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), H = v[0].map(function (h) { return String(h || '').trim(); });
  var ix = {}; FEC_COLS_.forEach(function (k) { ix[k] = H.indexOf(k); });
  return v.slice(1).filter(function (r) { return String(r[ix.NUMERO] || '').trim(); }).map(function (r) {
    return { fecha: pagDia_(r[ix.FECHA]), tipo: String(r[ix.TIPO] || '').trim().toUpperCase(), serie: String(r[ix.SERIE] || '').trim(),
             numero: String(r[ix.NUMERO]).trim().replace(/\.0$/, ''), nit: pagNit_(r[ix.NIT]), nombre: String(r[ix.NOMBRE] || '').trim(),
             establecimiento: String(r[ix.ESTABLECIMIENTO] || '').trim(), moneda: String(r[ix.MONEDA] || '').trim().toUpperCase(),
             total: _finR_(_finNum_(r[ix.MONTO])) };
  });
}


/*
 * AL MAESTRO EL MISMO DIA (22-oct-2026, Juanma: "una factura que llega al correo ya fue emitida por la SAT.
 * No tiene sentido esperar al lunes para registrarla en el maestro. El lunes sirve por si un proveedor anula una
 * factura"). Cada aviso de FEL_CORREO que el FEL del maestro no tiene entra a 01_FEL_Maestro como lo escribe el
 * cargador (cargador.js, _cargarFEL): Serie y Numero como texto, Estado Vigente, IVA de 12/112 en los tipos que
 * lo llevan, y las cinco formulas (Año, Semana, Categoría por 00_Proveedores, Es_Personal, Mes). La carga del
 * lunes no la duplica (misma llave Serie|Numero o Numero|Gran_Total) y, si viene anulada, le cambia el Estado.
 * Corre en calentarCaches (cada 5 min) y al abrir Pagos. Lee la hoja FEL_CORREO, no Gmail: funciona igual si
 * la hoja la llena la intranet o el servidor nuevo (proc_fel = nube).
 * Se escribe con appendRow (una fila atomica): el cargador corre en otro proyecto y no comparte el candado.
 * Ademas (revision del Estudio, 22-oct): no escribe mientras el cargador deja "cargando hasta <ISO>" en
 * FEC_MARCA_CARGA_ (cargador.js, CARGA_MARCA_CELDA_), y cada fila lleva en la columna Nota (Q) FEC_ORIGEN_, para
 * distinguirla de las del export (la sombra del maestro las compara aparte).
 */
var FEC_MARCA_CARGA_ = 'T1';
var FEC_ORIGEN_ = 'Entró del correo de SAT';
var FEC_MAESTRO_DESDE_ = '2026-10-13';   // los avisos empezaron el 13-oct; lo anterior entro con el FEL
var FEC_TIPOS_IVA_ = ['FACT', 'FCAM', 'NCRE', 'NDEB', 'FCAP'];   // FPEQ y los recibos no llevan credito fiscal
var FEC_FEL_PRIMERA_ = 5;   // 01_FEL_Maestro: encabezado en la fila 4, datos desde la 5 (como el cargador)

function _fecTxt_(v) { return String(v == null ? '' : v).trim().replace(/\.0$/, '').toUpperCase(); }

/** Las filas que el FEL del maestro no tiene, listas para appendRow (sin las formulas). Puro: lo usa la prueba. */
function fecFilasParaMaestro_(correo, existentes) {
  var previos = {}, porTotal = {}, porNit = {}, desde = pagDia_(FEC_MAESTRO_DESDE_);
  existentes.forEach(function (r) {   // [Serie, Numero, NIT, Gran_Total]
    var s = _fecTxt_(r[0]), n = _fecTxt_(r[1]);
    if (s) previos[s + '|' + n] = 1;
    if (n) { porTotal[n + '|' + _finNum_(r[3]).toFixed(2)] = 1; porNit[pagNit_(r[2]) + '|' + n] = 1; }
  });
  var out = [];
  correo.forEach(function (x) {
    var s = _fecTxt_(x.serie), n = _fecTxt_(x.numero);
    if (!s || !n || !x.nit || !x.fecha || x.fecha < desde || !(x.total > 0)) return;
    if (previos[s + '|' + n] || porTotal[n + '|' + x.total.toFixed(2)] || porNit[x.nit + '|' + n]) return;
    previos[s + '|' + n] = porTotal[n + '|' + x.total.toFixed(2)] = porNit[x.nit + '|' + n] = 1;
    var iva = FEC_TIPOS_IVA_.indexOf(x.tipo) !== -1 ? Math.round(x.total / 1.12 * 0.12 * 100000) / 100000 : 0;
    // L a P las llenan las formulas despues; Q (Nota) lleva el origen
    out.push({ serie: s, numero: n, fila: [x.fecha, x.tipo, "'" + s, "'" + n, x.nit, x.nombre, x.establecimiento || x.nombre,
                                            'Vigente', x.moneda || 'GTQ', x.total, iva, '', '', '', '', '',
                                            FEC_ORIGEN_ + ' el ' + Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm')] });
  });
  return out;
}

/** Pasa al maestro las facturas del correo que todavia no estan. Nunca rompe a quien la llama. */
function fecAlMaestro_() {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return { nuevas: 0, errores: [] };
  var rep = { nuevas: 0, errores: [] }, lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) { rep.errores.push('otra escritura en curso'); return rep; }
  try {
    var correo = fecFacturas_();
    if (!correo.length) return rep;
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID), sh = ss.getSheetByName('01_FEL_Maestro');
    if (!sh) throw new Error('No encontre 01_FEL_Maestro.');
    var enc = sh.getRange(FEC_FEL_PRIMERA_ - 1, 1, 1, 14).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var esperado = ['Fecha', 'Tipo_DTE', 'Serie', 'Numero_DTE', 'NIT_Emisor', 'Nombre_Emisor', 'Establecimiento', 'Estado', 'Moneda', 'Gran_Total', 'IVA'];
    if (esperado.some(function (h, i) { return enc[i] !== h; }))   // falla fuerte: escribir corrido daña el FEL
      throw new Error('El encabezado de 01_FEL_Maestro cambio (' + enc.slice(0, 11).join(' | ') + '). No se escribio nada.');
    // la carga del lunes esta escribiendo: se espera a la proxima vuelta
    var marca = String(sh.getRange(FEC_MARCA_CARGA_).getValue() || ''), hasta = /^cargando hasta (\S+)/.exec(marca);
    if (hasta && new Date(hasta[1]).getTime() > Date.now()) { rep.errores.push('carga del FEL en curso'); return rep; }
    var ultima = sh.getLastRow(), ex = [];
    if (ultima >= FEC_FEL_PRIMERA_) {
      var v = sh.getRange(FEC_FEL_PRIMERA_, 3, ultima - FEC_FEL_PRIMERA_ + 1, 8).getValues();   // C:J
      ex = v.map(function (r) { return [r[0], r[1], r[2], r[7]]; });
    }
    var nuevas = fecFilasParaMaestro_(correo, ex);
    if (!nuevas.length) return rep;
    nuevas.forEach(function (x) { sh.appendRow(x.fila); });
    SpreadsheetApp.flush();
    // las formulas van con la fila fija, como las del cargador: se busca donde quedo cada una
    var fin = sh.getLastRow(), desde = Math.max(FEC_FEL_PRIMERA_, fin - nuevas.length - 50);
    var cola = sh.getRange(desde, 3, fin - desde + 1, 2).getValues(), donde = {};
    cola.forEach(function (r, i) { donde[_fecTxt_(r[0]) + '|' + _fecTxt_(r[1])] = desde + i; });
    nuevas.forEach(function (x) {
      var r = donde[x.serie + '|' + x.numero];
      if (!r) { rep.errores.push('no encontre la fila de ' + x.serie + ' ' + x.numero + ' para sus formulas'); return; }
      sh.getRange(r, 1).setNumberFormat('yyyy-mm-dd');
      sh.getRange(r, 12, 1, 5).setFormulas([['=IF(A' + r + '="","",IFERROR(YEAR(A' + r + '),""))',
        '=IF(A' + r + '="","",IFERROR(WEEKNUM(A' + r + ',21),""))',
        '=IF(G' + r + '="","",IFERROR(VLOOKUP(G' + r + ",'00_Proveedores'!A:C,3,FALSE()),\"POR_CLASIFICAR\"))",
        '=IF(G' + r + '="","",IFERROR(VLOOKUP(G' + r + ",'00_Proveedores'!A:D,4,FALSE()),\"No\"))",
        '=IF(A' + r + '="","",IFERROR(MONTH(A' + r + '),""))']]);
      rep.nuevas++;
    });
    if (typeof _pagOlvidar_ === 'function') _pagOlvidar_(true);   // quien siga en esta ejecucion relee el FEL
    return rep;
  } catch (e) {
    rep.errores.push(String(e && e.message || e));
    return rep;
  } finally { lock.releaseLock(); }
}
