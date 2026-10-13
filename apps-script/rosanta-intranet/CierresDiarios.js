/**
 * CIERRES DIARIOS DE POSFILE (27-sep-2026)
 *
 * PosFile manda cada noche a restaurante@rosanta.rest un correo (noreply@posfile.com,
 * asunto "Cierre de Caja en PosFile MM/DD/AAAA ...") con el cierre de caja en PDF.
 * Cruzado contra el maestro el 27-sep: el cierre del 20-sep son los mismos 5 tickets y
 * los mismos Q4,191 que la carga del lunes. O sea, trae la venta de cada dia sin
 * esperar al lunes. No trae comensales ni costo: los comensales se leen del CRM
 * (personas de las reservas de ese dia, decision de Juanma) y el costo sigue saliendo
 * de la carga semanal.
 *
 * Que da: la venta de AYER y el ritmo del mes al dia (el vigia de las 6:00 lo usa) y el
 * cobro con TARJETA, que es el dato que faltaba para medir la comision de tarjeta (K08).
 *
 * Como: Gmail (servicio avanzado, solo lectura) → el PDF se convierte a Doc en Drive
 * para sacar el texto → se lee por etiquetas → pestaña CIERRES_DIARIOS del Sheet de
 * config, una fila por dia (si llega dos veces, gana el ultimo). El Doc temporal se borra.
 *
 * AMBITO GLOBAL: todo empieza con cie / _cie; lo privado termina en guion bajo.
 */

var CIE_HOJA_ = 'CIERRES_DIARIOS';
var CIE_COLS_ = ['FECHA', 'GRAN_TOTAL', 'SIN_PROPINA', 'PROPINA', 'TARJETA', 'EFECTIVO', 'TRANSFERENCIA',
                 'PEDIDOS_YA', 'UBER_EATS', 'CORTESIA', 'TICKETS', 'PRODUCTOS', 'COMENSALES_RESERVA',
                 'CUADRA', 'MENSAJE_ID', 'LEIDO',
                 // 13-oct-2026, formato nuevo de PosFile: los gastos anotados en el POS y cada
                 // documento con su monto (JSON), que usa la Caja chica para explicar un descuadre
                 'GASTOS_POS', 'DOCUMENTOS', 'FORMATO'];
var CIE_QUERY_ = 'from:noreply@posfile.com subject:"Cierre de Caja"';

function _cieNum_(txt, etiqueta) {
  var re = new RegExp(etiqueta + '\\s*:?\\s*(-?\\s*[\\d,]+(?:\\.\\d+)?)', 'i');
  var m = re.exec(txt);
  return m ? Number(m[1].replace(/[\s,]/g, '')) : null;
}

/**
 * Lee el texto de un cierre. Pura: las pruebas la corren con el texto del 20-sep (formato
 * viejo) y con los del 5 y el 12-oct (formato nuevo). asunto: el del correo, para la fecha.
 *
 * FORMATO NUEVO (desde el 1-oct-2026, cuando PosFile cambio de sistema). El asunto pasa a
 * "Cierre de Caja DD/MM/AAAA ..." (dia primero) y el PDF trae bloques con titulo:
 *   RESUMEN               Tarjetas · Caja (efectivo) POS · (otras formas de pago, si hay)
 *   CORTESÍA - PROPINA    Propina · Cortesía
 *   VENTAS POR DOCUMENTO  "68 Factura GTQ 528.00" ... TOTAL GTQ 5186.50
 *   VENTAS POR PRODUCTO   ... "TOTAL 50 GTQ 0.00 GTQ 5186.50"
 *   GASTOS                lo que se anoto como gasto en el POS ... TOTAL GTQ 0.00
 * El total de los documentos INCLUYE la propina (como el GRAN TOTAL del formato viejo).
 * Del 30-sep al 13-oct no se guardo ningun cierre: el lector viejo no encontraba sus etiquetas
 * y el vigia se tragaba el error.
 */
function cieParsear_(texto, asunto) {
  var t = String(texto || '').replace(/ /g, ' ');
  if (/CIERRE DE CAJA\s+\d{12}\s*-/i.test(t) || /Caja\s*\(\s*efec/i.test(t)) return _cieParsearNuevo_(t, asunto);
  var r = {
    tarjeta: _cieNum_(t, 'T-Cr[eé]dito'), efectivo: _cieNum_(t, 'Efectivo'),
    transferencia: _cieNum_(t, 'Transferencia'), pedidos_ya: _cieNum_(t, 'Pedidos Ya'),
    uber_eats: _cieNum_(t, 'Uber Eats'), gran_total: _cieNum_(t, 'GRAN TOTAL'),
    propina: _cieNum_(t, '(?:^|\\n)\\s*Propina'), sin_propina: _cieNum_(t, 'Total s/propina'),
    cortesia: _cieNum_(t, 'Cortes[ií]a'), productos: _cieNum_(t, 'Total de productos')
  };
  if (r.cortesia !== null) r.cortesia = Math.abs(r.cortesia);
  var f = /Fecha inicio:\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  r.fecha = f ? f[3] + '-' + f[1] + '-' + f[2] : null;
  // Las MESAS no salen del cierre diario (Juanma, 27-sep-2026: el numero de mesas solo se
  // ve en el reporte semanal). La columna TICKETS queda vacia a proposito.
  r.tickets = null;
  // Cuadra = las formas de pago suman el gran total. Es lo que el cierre si trae completo.
  var pagos = ['tarjeta', 'efectivo', 'transferencia', 'pedidos_ya', 'uber_eats']
    .reduce(function (a, k) { return a + (r[k] || 0); }, 0);
  r.cuadra = r.gran_total !== null && Math.abs(pagos - r.gran_total) < 0.02;
  r.gastos_pos = null; r.documentos = []; r.formato = 'viejo';
  return r;
}

function _cieNumero_(s) { return Number(String(s).replace(/[\s,]/g, '')); }

/** Un bloque del cierre nuevo: del titulo `desde` al primer titulo de `hasta` que le siga. */
function _cieBloque_(t, desde, hasta) {
  var m = desde.exec(t);
  if (!m) return '';
  var resto = t.slice(m.index + m[0].length), fin = resto.length;
  hasta.forEach(function (re) { var x = re.exec(resto); if (x && x.index < fin) fin = x.index; });
  return resto.slice(0, fin);
}

/** Las formas de pago del RESUMEN nuevo, por su etiqueta. La ligadura "ti" de "efectivo"
 *  se pierde al sacar el texto del PDF ("Caja (efec vo) POS"): la etiqueta la tolera. */
var CIE_FORMAS_NUEVO_ = [
  ['efectivo', /Caja\s*\(\s*efec[\s\S]{0,8}?\)\s*POS|Efectivo/i],
  ['tarjeta', /Tarjetas?|T-Cr[eé]dito/i],
  ['transferencia', /Transferencias?/i],
  ['pedidos_ya', /Pedidos\s*Ya/i],
  ['uber_eats', /Uber\s*Eats/i]
];

function _cieParsearNuevo_(t, asunto) {
  var r = { tarjeta: 0, efectivo: 0, transferencia: 0, pedidos_ya: 0, uber_eats: 0, tickets: null, formato: 'nuevo' };
  // La fecha: el codigo del titulo (DDMMAAAAHHMM-...) o el asunto del correo (DD/MM/AAAA)
  var f = /CIERRE DE CAJA\s+(\d{2})(\d{2})(\d{4})\d{4}\s*-/i.exec(t) || /Cierre de Caja\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(String(asunto || ''));
  r.fecha = f ? f[3] + '-' + f[2] + '-' + f[1] : null;
  // RESUMEN: etiquetas y montos en orden. Se emparejan por posicion, asi da lo mismo si el
  // texto del PDF los trae intercalados (etiqueta monto) o por columnas (etiquetas, montos).
  var res = _cieBloque_(t, /RESUMEN/i, [/CORTES[IÍ]A/i, /VENTAS POR/i]).replace(/Descripci[oó]n\s+TOTAL/i, ' ');
  var etiquetas = [];
  CIE_FORMAS_NUEVO_.forEach(function (fp) {
    var re = new RegExp(fp[1].source, 'ig'), m;
    while ((m = re.exec(res))) etiquetas.push({ k: fp[0], i: m.index, fin: m.index + m[0].length });
  });
  etiquetas.sort(function (a, b) { return a.i - b.i; });
  var sinEtiquetas = res, montos = [];
  etiquetas.slice().reverse().forEach(function (e) { sinEtiquetas = sinEtiquetas.slice(0, e.i) + ' ' + sinEtiquetas.slice(e.fin); });
  var reN = /-?\d[\d,]*(?:\.\d+)?/g, mn;
  while ((mn = reN.exec(sinEtiquetas))) montos.push(_cieNumero_(mn[0]));
  var formasOk = etiquetas.length > 0 && etiquetas.length === montos.length;
  if (formasOk) etiquetas.forEach(function (e, i) { r[e.k] += montos[i]; });
  var cp = _cieBloque_(t, /CORTES[IÍ]A\s*-\s*PROPINA/i, [/VENTAS POR/i]);
  var mp = /Propina\s*:?\s*(-?[\d,]+(?:\.\d+)?)/i.exec(cp), mc = /Cortes[ií]a\s*:?\s*(-?[\d,]+(?:\.\d+)?)/i.exec(cp);
  r.propina = mp ? _cieNumero_(mp[1]) : null;
  r.cortesia = mc ? Math.abs(_cieNumero_(mc[1])) : null;
  // VENTAS POR DOCUMENTO: cada documento con su monto, y el total (incluye la propina)
  var doc = _cieBloque_(t, /VENTAS POR DOCUMENTO/i, [/VENTAS POR PRODUCTO/i, /\bGASTOS\b/]);
  r.documentos = [];
  var reD = /(\d+)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+GTQ\s*([\d,]+\.\d{2})/g, md;
  while ((md = reD.exec(doc))) r.documentos.push({ n: md[1], tipo: md[2], q: _cieNumero_(md[3]) });
  var td = /TOTAL\s+GTQ\s*([\d,]+(?:\.\d+)?)/i.exec(doc);
  var totalDocs = td ? _cieNumero_(td[1]) : null;
  var pagos = r.tarjeta + r.efectivo + r.transferencia + r.pedidos_ya + r.uber_eats;
  r.gran_total = totalDocs !== null ? totalDocs : (formasOk ? Math.round(pagos * 100) / 100 : null);
  r.sin_propina = r.gran_total !== null && r.propina !== null ? Math.round((r.gran_total - r.propina) * 100) / 100 : null;
  var mpr = /TOTAL\s+(\d+)\s+GTQ\s*[\d,.]+\s+GTQ/i.exec(_cieBloque_(t, /VENTAS POR PRODUCTO/i, [/\bGASTOS\b/]));
  r.productos = mpr ? Number(mpr[1]) : null;
  // GASTOS: lo que se anoto como gasto en el POS (la Caja chica lo compara con lo suyo)
  var gs = _cieBloque_(t, /\bGASTOS\b/, [/©|Soported/i]);
  var tg = /TOTAL\s+GTQ\s*([\d,]+(?:\.\d+)?)/i.exec(gs);
  r.gastos_pos = tg ? _cieNumero_(tg[1]) : null;
  // Cuadra = las formas de pago suman el total de los documentos
  r.cuadra = formasOk && r.gran_total !== null && Math.abs(pagos - r.gran_total) < 0.02;
  return r;
}

/** El texto de un PDF: se convierte a Doc de Google, se exporta como texto y se borra. */
function _ciePdfTexto_(blob) {
  var doc = Drive.Files.create({ name: 'tmp_cierre_posfile', mimeType: 'application/vnd.google-apps.document' }, blob);
  try {
    var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('No pude exportar el cierre como texto (' + r.getResponseCode() + ').');
    return r.getContentText();
  } finally {
    try { Drive.Files.remove(doc.id); } catch (e) { /* si no se borra, queda un Doc temporal sin datos sensibles */ }
  }
}

/** Personas de las reservas de un dia en el CRM (sin canceladas ni no-show). */
function _cieComensalesReserva_(fechaIso) {
  try {
    var v = mktSheet_('reservas').getDataRange().getValues();
    var H = v[0].map(function (h) { return String(h || '').trim(); });
    var iF = H.indexOf('fecha'), iP = H.indexOf('personas'), iS = H.indexOf('estado');
    var n = 0;
    for (var i = 1; i < v.length; i++) {
      var raw = v[i][iF], f = raw instanceof Date ? medFechaIso_(raw) : String(raw || '').slice(0, 10);
      if (f !== fechaIso) continue;
      var est = String(v[i][iS] || '').replace(/\\/g, '').toUpperCase();
      if (est.indexOf('CANCEL') > -1 || est.indexOf('NO_SHOW') > -1 || est.indexOf('NOSHOW') > -1) continue;
      n += Number(v[i][iP]) || 0;
    }
    return n;
  } catch (e) { return null; }
}

/**
 * Lee los cierres de los ultimos `dias` dias y los guarda. Un dia ya guardado se
 * reemplaza solo si el correo es mas nuevo. Devuelve lo que hizo.
 */
/**
 * Los bytes del adjunto. El servicio avanzado de Gmail NO siempre entrega att.data como el
 * texto base64url de la API REST: en Apps Script llega como arreglo de bytes, y
 * base64DecodeWebSafe falla con "Could not decode string" (27-sep-2026, 38 de 38 correos).
 * Se aceptan las dos formas; el texto se normaliza a base64 comun con su relleno.
 */
function _cieBytes_(data) {
  if (data && typeof data !== 'string' && data.length !== undefined) return data;
  var t = String(data || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  while (t.length % 4) t += '=';
  return Utilities.base64Decode(t);
}

function cieLeer_(dias) {
  dias = dias || 7;
  var lista = Gmail.Users.Messages.list('me', { q: CIE_QUERY_ + ' newer_than:' + dias + 'd', maxResults: 60 });
  var msgs = (lista && lista.messages) || [];
  var sh = (function () {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var h = ss.getSheetByName(CIE_HOJA_);
    if (!h) { h = ss.insertSheet(CIE_HOJA_); h.setFrozenRows(1); }
    // el encabezado siempre completo: las columnas del formato nuevo se agregaron al final
    if (h.getLastColumn() < CIE_COLS_.length) h.getRange(1, 1, 1, CIE_COLS_.length).setValues([CIE_COLS_]).setFontWeight('bold');
    return h;
  })();
  var v = sh.getDataRange().getValues(), fila = {}, idsLeidos = {};
  // un correo ya guardado se salta, salvo que su fila no cuadre: esa se vuelve a leer (asi se
  // corrigen solas las filas que dejo la regla vieja de mesas, 27-sep-2026)
  for (var i = 1; i < v.length; i++) {
    // la fecha llega como Date: String(Date) daba "Tue Sep 29" y un dia releido se agregaba de nuevo
    fila[v[i][0] instanceof Date ? medFechaIso_(v[i][0]) : String(v[i][0]).slice(0, 10)] = i + 1;
    if (String(v[i][13]) === 'SI') idsLeidos[String(v[i][14])] = true;
  }
  var rep = { correos: msgs.length, nuevos: 0, repetidos: 0, errores: [] };
  // del mas viejo al mas nuevo: si un dia llega dos veces, el ultimo pisa al primero
  msgs.slice().reverse().forEach(function (mm) {
    if (idsLeidos[mm.id]) { rep.repetidos++; return; }
    try {
      var msg = Gmail.Users.Messages.get('me', mm.id);
      var partes = [], cola = [msg.payload];
      while (cola.length) { var p = cola.shift(); if (p.parts) cola = cola.concat(p.parts); if (p.filename && /\.pdf$/i.test(p.filename) && p.body && p.body.attachmentId) partes.push(p); }
      if (!partes.length) throw new Error('sin PDF adjunto');
      var att = Gmail.Users.Messages.Attachments.get('me', mm.id, partes[0].body.attachmentId);
      var blob = Utilities.newBlob(_cieBytes_(att.data), 'application/pdf', partes[0].filename);
      var asunto = ((msg.payload.headers || []).filter(function (h) { return /^subject$/i.test(h.name); })[0] || {}).value || '';
      var c = cieParsear_(_ciePdfTexto_(blob), asunto);
      if (!c.fecha || c.gran_total === null) throw new Error('no pude leer la fecha o el total (' + asunto + ')');
      var row = [c.fecha, c.gran_total, c.sin_propina, c.propina, c.tarjeta, c.efectivo, c.transferencia, c.pedidos_ya,
                 c.uber_eats, c.cortesia, c.tickets, c.productos, _cieComensalesReserva_(c.fecha), c.cuadra ? 'SI' : 'NO', mm.id, new Date(),
                 c.gastos_pos, JSON.stringify(c.documentos || []).slice(0, 45000), c.formato];
      if (fila[c.fecha]) sh.getRange(fila[c.fecha], 1, 1, row.length).setValues([row]);
      else { sh.appendRow(row); fila[c.fecha] = sh.getLastRow(); }
      rep.nuevos++;
    } catch (e) { rep.errores.push(mm.id + ': ' + String(e && e.message || e)); }
  });
  SpreadsheetApp.flush();
  // El resultado queda guardado: la Caja chica dice cuando un cierre no se pudo leer. Antes el
  // vigia se tragaba el error y nadie supo que del 30-sep al 13-oct no entro ningun cierre.
  rep.cuando = new Date().toISOString();
  try { PropertiesService.getScriptProperties().setProperty('CIE_ULTIMA_LECTURA', JSON.stringify(rep).slice(0, 8000)); } catch (eP) { /* sin propiedades: sigue */ }
  return rep;
}

/** Lo que paso la ultima vez que se leyeron los cierres (o null). */
function cieUltimaLectura_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CIE_ULTIMA_LECTURA') || 'null'); } catch (e) { return null; }
}

/** Los cierres guardados, por fecha ISO. */
function cieTodos_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(CIE_HOJA_);
  if (!sh || sh.getLastRow() < 2) return {};
  var out = {};
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    var f = r[0] instanceof Date ? medFechaIso_(r[0]) : String(r[0]).slice(0, 10);
    out[f] = { fecha: f, gran_total: Number(r[1]) || 0, sin_propina: Number(r[2]) || 0, propina: Number(r[3]) || 0,
               tarjeta: Number(r[4]) || 0, efectivo: Number(r[5]) || 0, tickets: r[10] === '' ? null : Number(r[10]),
               comensales_reserva: r[12] === '' ? null : Number(r[12]), cuadra: String(r[13]) === 'SI',
               gastos_pos: r[16] === '' || r[16] == null ? null : Number(r[16]),
               documentos: (function () { try { return JSON.parse(r[17] || '[]'); } catch (e) { return []; } })(),
               formato: String(r[18] || 'viejo') };
  });
  return out;
}

/** Tablero › Metas y ajustes: leer los cierres ya (normalmente lo hace el vigia a las 6:00). */
function leerCierresAhora(auth, dias) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return cieLeer_(Math.min(Number(dias) || 7, 60));
}
