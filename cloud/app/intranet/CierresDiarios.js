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
                 'GASTOS_POS', 'DOCUMENTOS', 'FORMATO', 'TEXTO_SI_NO_CUADRA'];
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
  // SALTOS DE LINEA (15-oct-2026): Drive exporta el texto con "\r\n". Los renglones del cierre
  // nuevo se buscan con [ \t]*(?=\n) y el "\r" los rompia: del 1 al 14-oct todos los cierres se
  // guardaron con tarjeta 0 y efectivo 0 (el total salia bien porque esa busqueda usa \s).
  var t = String(texto || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ');
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
  // "Banco Principal" (4-oct) y "Otras Plataformas" (7-oct): formas del POS nuevo que no son
  // efectivo; van con transferencia para que el cierre cuadre (14-oct-2026)
  ['transferencia', /Transferencias?|Banco\s+Principal|Otras\s+Plataformas/i],
  ['pedidos_ya', /Pedidos\s*Ya/i],
  ['uber_eats', /Uber\s*Eats/i]
];

function _cieParsearNuevo_(t, asunto) {
  // RENGLON POR RENGLON (13-oct-2026). El texto que saca Google Drive del PDF trae las secciones
  // en otro orden que el PDF (la propina total quedaba dentro de "ventas por documento" y el
  // RESUMEN vacio: los 12 cierres de octubre se guardaron con efectivo 0). Cada renglon si queda
  // entero ("Tarjetas 4,889.50", "72 Factura GTQ 297.00"), asi que cada dato se busca por su
  // renglon en todo el texto, sin depender de donde empieza o termina una seccion.
  var r = { tarjeta: 0, efectivo: 0, transferencia: 0, pedidos_ya: 0, uber_eats: 0, tickets: null, formato: 'nuevo' };
  var num = '(-?\\d[\\d,]*(?:\\.\\d+)?)';
  // La fecha: el codigo del titulo (DDMMAAAAHHMM-...) o el asunto del correo (DD/MM/AAAA)
  var f = /CIERRE DE CAJA\s+(\d{2})(\d{2})(\d{4})\d{4}\s*-/i.exec(t) || /Cierre de Caja\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(String(asunto || ''));
  r.fecha = f ? f[3] + '-' + f[2] + '-' + f[1] : null;
  // Los documentos: "68 Factura GTQ 528.00". La venta del dia es su suma (incluye la propina).
  r.documentos = [];
  var reD = /(?:^|\n)\s*(\d+)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+GTQ\s*([\d,]+\.\d{2})\s*(?=\n|$)/g, md;
  while ((md = reD.exec(t))) if (!/^total$/i.test(md[2])) r.documentos.push({ n: md[1], tipo: md[2], q: _cieNumero_(md[3]) });
  var sumaDocs = Math.round(r.documentos.reduce(function (a, d) { return a + d.q; }, 0) * 100) / 100;

  // LAS FORMAS DE PAGO, por cuatro caminos (14-oct-2026, auditoria): Drive saca el texto del PDF
  // de distintas formas. Se prueba cada camino y gana EL PRIMERO QUE CUADRA con la suma de los
  // documentos; si ninguno cuadra, el primero que encontro algo (como antes). Asi una etiqueta
  // suelta en otra parte (un gasto "Efectivo") o dos bloques iguales no dejan el cierre en 0
  // ni lo suman dos veces.
  var res = _cieBloque_(t, /RESUMEN/i, [/CORTES[IÍ]A/i, /VENTAS POR/i]);
  var camino = function (fn) { var v = { tarjeta: 0, efectivo: 0, transferencia: 0, pedidos_ya: 0, uber_eats: 0 }, n = fn(v); return n ? { v: v, n: n } : null; };
  // 1. etiqueta y monto en el MISMO renglon ("Tarjetas 4,889.50"), en todo el texto
  var mismo = function (v) {
    var n = 0;
    CIE_FORMAS_NUEVO_.forEach(function (fp) {
      var re = new RegExp('(?:^|\\n)[ \\t]*(?:' + fp[1].source + ')[ \\t]*:?[ \\t]*' + num + '[ \\t]*(?=\\n|$)', 'gi'), m;
      while ((m = re.exec(t))) { v[fp[0]] += _cieNumero_(m[1]); n++; }
    });
    return n;
  };
  // 2 y 3. el monto en el renglon de ABAJO ("\tTarjetas \n\t1,771.00"), asi lo saca Drive. Vale si
  // TODAS las etiquetas solas del texto tienen su monto abajo (si no, el RESUMEN viene por columnas)
  var abajo = function (texto) {
    return function (v) {
      var solas = 0, pares = [];
      CIE_FORMAS_NUEVO_.forEach(function (fp) {
        var reS = new RegExp('(?:^|\\n)[ \\t]*(?:' + fp[1].source + ')[ \\t]*:?[ \\t]*(?=\\n|$)', 'gi');
        while (reS.exec(texto)) solas++;
        var reP = new RegExp('(?:^|\\n)[ \\t]*(?:' + fp[1].source + ')[ \\t]*:?[ \\t]*\\n[ \\t]*' + num + '[ \\t]*(?=\\n|$)', 'gi'), mp2;
        while ((mp2 = reP.exec(texto))) pares.push([fp[0], _cieNumero_(mp2[1])]);
      });
      if (!pares.length || pares.length !== solas) return 0;
      pares.forEach(function (x) { v[x[0]] += x[1]; });
      return pares.length;
    };
  };
  // 4. por columnas: primero las etiquetas y despues los montos, emparejados por posicion en el bloque
  var columnas = function (v) {
    var b = res.replace(/Descripci[oó]n\s+TOTAL/i, ' '), etq = [];
    CIE_FORMAS_NUEVO_.forEach(function (fp) { var re = new RegExp(fp[1].source, 'ig'), m; while ((m = re.exec(b))) etq.push({ k: fp[0], i: m.index, fin: m.index + m[0].length }); });
    etq.sort(function (a, c) { return a.i - c.i; });
    var sinEtq = b, montos = [];
    etq.slice().reverse().forEach(function (e) { sinEtq = sinEtq.slice(0, e.i) + ' ' + sinEtq.slice(e.fin); });
    var reN = /-?\d[\d,]*(?:\.\d+)?/g, mn;
    while ((mn = reN.exec(sinEtq))) montos.push(_cieNumero_(mn[0]));
    if (!etq.length || etq.length !== montos.length) return 0;
    etq.forEach(function (e, k) { v[e.k] += montos[k]; });
    return etq.length;
  };
  var caminos = [camino(mismo), camino(abajo(t)), camino(abajo(res)), camino(columnas)].filter(Boolean);
  var sumaDe = function (v) { return Math.round((v.tarjeta + v.efectivo + v.transferencia + v.pedidos_ya + v.uber_eats) * 100) / 100; };
  var elegido = (r.documentos.length ? caminos.filter(function (c) { return Math.abs(sumaDe(c.v) - sumaDocs) < 0.02; })[0] : null) || caminos[0] || null;
  var vistas = elegido ? elegido.n : 0;
  if (elegido) Object.keys(elegido.v).forEach(function (k) { r[k] = elegido.v[k]; });
  var pagos = Math.round((r.tarjeta + r.efectivo + r.transferencia + r.pedidos_ya + r.uber_eats) * 100) / 100;
  r.gran_total = r.documentos.length ? sumaDocs : (vistas ? pagos : null);
  // Propina y cortesia: "Propina 471.5" solo (el renglon de productos sigue con GTQ y no cuenta)
  var mp = new RegExp('(?:^|\\n)\\s*Propina\\s*:?\\s*' + num + '\\s*(?=\\n|$)', 'i').exec(t);
  var mc = new RegExp('(?:^|\\n)\\s*Cortes[ií]a\\s*:?\\s*' + num + '\\s*(?=\\n|$)', 'i').exec(t);
  r.propina = mp ? _cieNumero_(mp[1]) : null;
  r.cortesia = mc ? Math.abs(_cieNumero_(mc[1])) : null;
  r.sin_propina = r.gran_total !== null && r.propina !== null ? Math.round((r.gran_total - r.propina) * 100) / 100 : null;
  var mpr = /TOTAL\s+(\d+)\s+GTQ\s*[\d,.]+\s+GTQ/i.exec(t);
  r.productos = mpr ? Number(mpr[1]) : null;
  // GASTOS: el "TOTAL GTQ" que sigue a la ULTIMA palabra GASTOS del texto
  var ig = t.search(/\bGASTOS\b(?![\s\S]*\bGASTOS\b)/), tg = ig >= 0 ? /TOTAL\s+GTQ\s*([\d,]+(?:\.\d+)?)/i.exec(t.slice(ig)) : null;
  r.gastos_pos = tg ? _cieNumero_(tg[1]) : null;
  // Cuadra = las formas de pago suman los documentos
  r.cuadra = vistas > 0 && r.documentos.length > 0 && Math.abs(pagos - sumaDocs) < 0.02;
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

function cieLeer_(dias, forzar) {
  // UNA LECTURA A LA VEZ (14-oct-2026, auditoria): el vigia de las 10:00 y "Leer cierres" podian
  // correr juntos y agregar la misma fecha dos veces. No es un ScriptLock a proposito: convertir
  // los PDF tarda minutos y bloquearia los guardados de Pagos, que usan ese candado.
  var cache = CacheService.getScriptCache();
  try { if (cache.get('cie_leyendo')) return { correos: 0, nuevos: 0, repetidos: 0, errores: ['otra lectura de cierres en curso: probá en un par de minutos'] }; } catch (e0) { /* sin cache: se lee */ }
  try { cache.put('cie_leyendo', '1', 600); } catch (e1) { /* idem */ }
  try { return _cieLeer_(dias, forzar); } finally { try { cache.remove('cie_leyendo'); } catch (e2) { /* se vence sola en 10 min */ } }
}
function _cieLeer_(dias, forzar) {
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
    // uno que no cuadra se relee, pero a lo sumo una vez cada 20 horas (antes, cada 20 minutos)
    var leido = v[i][15] instanceof Date ? v[i][15] : null;
    if (String(v[i][13]) === 'SI' || (!forzar && leido && new Date() - leido < 20 * 3600000)) idsLeidos[String(v[i][14])] = true;
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
      var texto = _ciePdfTexto_(blob), c = cieParsear_(texto, asunto);
      if (!c.fecha || c.gran_total === null) throw new Error('no pude leer la fecha o el total (' + asunto + ')');
      var row = [c.fecha, c.gran_total, c.sin_propina, c.propina, c.tarjeta, c.efectivo, c.transferencia, c.pedidos_ya,
                 c.uber_eats, c.cortesia, c.tickets, c.productos, _cieComensalesReserva_(c.fecha), c.cuadra ? 'SI' : 'NO', mm.id, new Date(),
                 c.gastos_pos, JSON.stringify(c.documentos || []).slice(0, 45000), c.formato,
                 // el texto de Drive, solo si no cuadra: para ver por que (13-oct-2026)
                 c.cuadra ? '' : String(texto || '').slice(0, 20000)];
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
