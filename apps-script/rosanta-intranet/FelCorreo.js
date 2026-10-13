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
 *  - Se guarda en la pestaña FEL_CORREO del Sheet de config, NO en el maestro. El maestro
 *    sigue llenandose con el export del FEL, que es la fuente del DRE.
 *  - Pagos la muestra solo mientras el FEL del maestro no la trae (llave NIT|numero).
 *    Cuando entra el lunes, manda la del maestro y la del correo deja de verse sola.
 *  - La categoria sale de la historia del NIT en el FEL (la que mas usa). Un NIT nuevo
 *    queda en ADMIN, POR CLASIFICAR, hasta la carga del lunes.
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

