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
                 'CUADRA', 'MENSAJE_ID', 'LEIDO'];
var CIE_QUERY_ = 'from:noreply@posfile.com subject:"Cierre de Caja"';

function _cieNum_(txt, etiqueta) {
  var re = new RegExp(etiqueta + '\\s*:?\\s*(-?\\s*[\\d,]+(?:\\.\\d+)?)', 'i');
  var m = re.exec(txt);
  return m ? Number(m[1].replace(/[\s,]/g, '')) : null;
}

/** Lee el texto de un cierre. Pura: la prueba la corre con el texto del 20-sep. */
function cieParsear_(texto) {
  var t = String(texto || '').replace(/ /g, ' ');
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
  // tickets: una linea por documento, "7560 cf cf | CF 425.00"
  var docs = [], re = /^\s*(\d{3,8})\s+[^\n]*\|[^\n]*?([\d,]+\.\d{2})\s*$/gm, m;
  while ((m = re.exec(t))) docs.push({ no: m[1], total: Number(m[2].replace(/,/g, '')) });
  var vistos = {};
  docs = docs.filter(function (d) { if (vistos[d.no]) return false; vistos[d.no] = true; return true; });
  r.tickets = docs.length || null;
  var suma = docs.reduce(function (a, d) { return a + d.total; }, 0);
  r.cuadra = r.sin_propina !== null && docs.length ? Math.abs(suma - r.sin_propina) < 0.02 : false;
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
    if (!h) { h = ss.insertSheet(CIE_HOJA_); h.getRange(1, 1, 1, CIE_COLS_.length).setValues([CIE_COLS_]).setFontWeight('bold'); h.setFrozenRows(1); }
    return h;
  })();
  var v = sh.getDataRange().getValues(), fila = {}, idsLeidos = {};
  for (var i = 1; i < v.length; i++) { fila[String(v[i][0]).slice(0, 10)] = i + 1; idsLeidos[String(v[i][14])] = true; }
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
      var c = cieParsear_(_ciePdfTexto_(blob));
      if (!c.fecha || c.gran_total === null) throw new Error('no pude leer la fecha o el total');
      var row = [c.fecha, c.gran_total, c.sin_propina, c.propina, c.tarjeta, c.efectivo, c.transferencia, c.pedidos_ya,
                 c.uber_eats, c.cortesia, c.tickets, c.productos, _cieComensalesReserva_(c.fecha), c.cuadra ? 'SI' : 'NO', mm.id, new Date()];
      if (fila[c.fecha]) sh.getRange(fila[c.fecha], 1, 1, row.length).setValues([row]);
      else { sh.appendRow(row); fila[c.fecha] = sh.getLastRow(); }
      rep.nuevos++;
    } catch (e) { rep.errores.push(mm.id + ': ' + String(e && e.message || e)); }
  });
  SpreadsheetApp.flush();
  return rep;
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
               comensales_reserva: r[12] === '' ? null : Number(r[12]), cuadra: String(r[13]) === 'SI' };
  });
  return out;
}

/** Tablero › Metas y ajustes: leer los cierres ya (normalmente lo hace el vigia a las 6:00). */
function leerCierresAhora(auth, dias) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return cieLeer_(Math.min(Number(dias) || 7, 60));
}
