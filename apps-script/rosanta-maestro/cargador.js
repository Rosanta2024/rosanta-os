// ============================================================
// ROSANTA - Cargador automatico del maestro
//
// Lee una carpeta de "Reportes 2026" (SXX semanal o 2026-MM mensual),
// identifica cada archivo POR SU CONTENIDO -no por el nombre- y carga
// las filas nuevas al maestro.
//
// Que reconoce:
//   POS            -> tiene columna "TicketId"        -> 02_Ventas_Maestro
//   POS nuevo      -> "Tipo documento" + "No." + "Total" -> 02_Ventas_Maestro
//                     (reporte de facturas del PosFile actualizado, desde el 1-oct-2026)
//   FEL emitidas   -> el EMISOR es CORSAGA            -> 01b_FEL_Emitidas
//   FEL recibidas  -> el emisor es otro               -> 01_FEL_Maestro
//   BANCO_BI       -> Sheet nativo con Docto, Categoria y Total_debitos
//                     -> 03_Banco_Industrial (desde el 8-oct-2026, p233; ver _cargarBancoBI)
//   Todo lo demas (PDF, zip, planilla, etc.) se ignora.
//
// Nunca duplica: en FEL compara la pareja (Serie, Numero del DTE) y en
// ventas el TicketId. Si la corres dos veces, la segunda no agrega nada.
//
// Banco Industrial SI se carga aca desde el 8-oct-2026 (p233), pero no desde el
// PDF: Claude lee el PDF, categoriza y deja en la carpeta SXX un Sheet NATIVO
// (BANCO_BI_SXX) con los movimientos y los totales impresos del banco; el
// cargador lo valida y lo agrega. BAC y tarjetas siguen fuera (vienen en PDF/zip).
// Antes del 8-oct el banco se cargaba con un script de un solo uso por semana. Los scripts de un solo uso que
// los cargaban (cargar_banco_SXX) se sacaron del proyecto el 28-sep-2026:
// estan en el repo, apps-script/_archivo/2026-09-28_scripts_banco_maestro.
// El de S40 (corrido el 5-oct-2026, 15 filas) y el de sus 3 proveedores nuevos estan en apps-script/_archivo/2026-10-05_banco_S40.
// Los lotes de correccion ya corridos (duplicados de mayo, reclasificaciones,
// fechas con hora, proveedores...) salieron el 29-sep-2026 (p232) a
// apps-script/_archivo/2026-09-29_lotes_un_solo_uso_maestro.
//
// USO NORMAL: desde el maestro, menu "Rosanta" > "Cargar lo que falte".
// No hay que editar codigo ni elegir carpetas.
//
//   cargarPendientes()  recorre TODAS las carpetas de Reportes 2026 y
//                       carga lo que todavia no este en el maestro.
//                       Recuerda que archivos ya proceso, asi que la
//                       segunda corrida tarda segundos. Si se queda sin
//                       tiempo, avisa y con correrla de nuevo sigue.
//   revisarPendientes() lo mismo pero SIN escribir: solo informa.
//   instalarMenu()      crea el menu "Rosanta" dentro del maestro.
//                       Se corre una sola vez.
//   olvidarProgreso()   borra el registro de archivos procesados para
//                       forzar un re-escaneo completo.
// ============================================================

var SHEET_ID_CARGA  = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var REPORTES_2026   = '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP';
var NIT_CORSAGA     = '24185930';

// ---------- utilidades ----------

function _carpeta(nombre) {
  var it = DriveApp.getFolderById(REPORTES_2026).getFoldersByName(nombre);
  if (!it.hasNext()) throw new Error('No encontre la carpeta "' + nombre + '" en Reportes 2026');
  return it.next();
}

/** Convierte un .xls/.xlsx a Sheet temporal y devuelve su id, o null. */
function _convertir(fileId, nombre) {
  var res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + fileId + '/copy?supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({
        name: 'TMP_carga_' + nombre,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      }),
      muteHttpExceptions: true
    });
  var codigo = res.getResponseCode();
  if (codigo !== 200) {
    Logger.log('  !! No pude convertir "' + nombre + '" - HTTP ' + codigo + ': ' +
               res.getContentText().substring(0, 200));
    return null;
  }
  return JSON.parse(res.getContentText()).id;
}

function _norm(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function _numero(v) {
  var n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
/** Acepta Date, "17/8/2026" y "2026-08-17T..." y devuelve un objeto Date.
 *
 *  SE LLAMA _fechaCarga Y NO _fecha A PROPOSITO (3-sep-2026).
 *  En Apps Script todos los archivos del proyecto comparten el ambito global.
 *  clasificar.js ya define un _fecha que hace lo CONTRARIO: recibe un Date y
 *  devuelve TEXTO 'yyyy-MM-dd', y lo usa para comparar con !== contra un texto.
 *  Con las dos definiciones cargadas gana una sola, segun el orden de los
 *  archivos, y si ganaba esta, aplicarClasificaciones() dejaba de clasificar
 *  nada y sin lanzar un solo error.
 *  Si agregas mas archivos a este proyecto, revisa los nombres genericos.
 */
function _fechaCarga(v) {
  // Una fecha que llega con hora (el archivo de origen en otra zona horaria) se
  // lleva a su dia: 12:00 o mas es el dia siguiente. p120, 15-sep-2026: 157 filas
  // quedaron a las 22:00/23:00 del dia anterior y la fecha verdadera era la siguiente.
  if (v instanceof Date) {
    if (!v.getHours() && !v.getMinutes()) return v;
    return new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
  }
  var s = _norm(v);
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}
/**
 * Quita los caracteres no ASCII antes de comparar.
 *
 * Existe porque el 4-sep-2026 la recarga completa del FEL se detuvo con
 * "sin las columnas: Numero del DTE" cuando el encabezado del archivo decia
 * "NAºmero del DTE": mojibake, bytes UTF-8 leidos como Latin-1 al convertir el
 * .xls a Sheet. Quitando lo no ASCII, "Numero", "Numero" con tilde y la version
 * rota se vuelven la misma cosa y las tres calzan.
 */
function _sinAcentos(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[^\x20-\x7E]/g, '');
}

function _col(encabezados, texto) {
  var buscado = _sinAcentos(texto).toLowerCase();
  for (var i = 0; i < encabezados.length; i++) {
    if (_sinAcentos(_norm(encabezados[i])).toLowerCase().indexOf(buscado) === 0) return i;
  }
  return -1;
}

/** Identifica el tipo de archivo mirando encabezados y contenido. */
function _identificar(datos) {
  if (!datos.length) return '?';
  var enc = datos[0];
  for (var i = 0; i < enc.length; i++) {
    if (_norm(enc[i]).toLowerCase() === 'ticketid') return 'POS';
  }
  if (_col(enc, 'Tipo documento') === 0 && _col(enc, 'No.') >= 0 && _col(enc, 'Total') >= 0) return 'POS_FACTURAS';
  if (_col(enc, 'Docto') >= 0 && _col(enc, 'Categor') >= 0 && _col(enc, 'Total_debitos') >= 0) return 'BANCO_BI';
  var iEmisor = _col(enc, 'Nombre completo del emisor');
  var iNit    = _col(enc, 'NIT del emisor');
  if (iEmisor < 0 && iNit < 0) return '?';
  for (var f = 1; f < Math.min(datos.length, 30); f++) {
    var nombre = iEmisor >= 0 ? _norm(datos[f][iEmisor]).toUpperCase() : '';
    var nit    = iNit    >= 0 ? _norm(datos[f][iNit]) : '';
    if (!nombre && !nit) continue;
    if (nombre.indexOf('CORSAGA') >= 0 || nit === NIT_CORSAGA) return 'FEL_EMITIDAS';
    return 'FEL_RECIBIDAS';
  }
  return '?';
}

// ---------- lectura de la carpeta ----------

function _leerCarpeta(nombreCarpeta) {
  var carpeta = _carpeta(nombreCarpeta);
  var archivos = carpeta.getFiles();
  var encontrados = [], temporales = [];

  while (archivos.hasNext()) {
    var f = archivos.next();
    var nombre = f.getName();
    var mime = f.getMimeType();
    var esExcel = mime.indexOf('spreadsheet') >= 0 || mime.indexOf('excel') >= 0 ||
                  /\.xlsx?$/i.test(nombre) || mime === 'application/octet-stream';
    if (!esExcel) {
      Logger.log('  (ignorado) ' + nombre + '  [' + mime + ']');
      continue;
    }

    var id = f.getId();
    if (mime !== MimeType.GOOGLE_SHEETS) {
      id = _convertir(f.getId(), nombre);
      if (!id) continue;
      temporales.push(id);
    }
    var datos;
    try {
      datos = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
    } catch (e) {
      Logger.log('  !! No pude leer "' + nombre + '": ' + e.message);
      continue;
    }
    encontrados.push({ nombre: nombre, tipo: _identificar(datos), datos: datos });
  }
  return { items: encontrados, temporales: temporales };
}

function _limpiar(temporales) {
  for (var i = 0; i < temporales.length; i++) {
    try { DriveApp.getFileById(temporales[i]).setTrashed(true); } catch (e) {}
  }
}

/** Solo diagnostico: dice que hay en la carpeta sin escribir nada. */
function _revisar(nombreCarpeta) {
  if (!nombreCarpeta) throw new Error('Falta el nombre de la carpeta. Usa revisar() o revisarUltimaSemana().');
  Logger.log('=== Revisando ' + nombreCarpeta + ' (no escribe nada) ===');
  var r = _leerCarpeta(nombreCarpeta);
  for (var i = 0; i < r.items.length; i++) {
    Logger.log(r.items[i].tipo + '  <-  ' + r.items[i].nombre +
               '  (' + (r.items[i].datos.length - 1) + ' filas)');
  }
  if (!r.items.length) Logger.log('No encontre archivos de Excel en ' + nombreCarpeta);
  _limpiar(r.temporales);
}

// ---------- escritura al maestro ----------

/**
 * Frena la carga si el maestro y el script estan en zonas horarias distintas.
 * Asi nacieron las 157 fechas de p120: la medianoche de Guatemala escrita en un
 * Sheet que estaba una o dos horas atras quedo como las 23:00 del dia anterior.
 * Falla fuerte a proposito: mejor una carga detenida que un mes corrido en silencio.
 */
function _zonaCargaIgual_(ss) {
  var zs = ss.getSpreadsheetTimeZone(), zc = Session.getScriptTimeZone();
  if (zs !== zc) {
    throw new Error('El maestro esta en la zona ' + zs + ' y el script en ' + zc + '. ' +
      'Con zonas distintas las fechas se corren un dia. No se cargo nada: poner el maestro en ' +
      zc + ' (Archivo > Configuracion) y volver a correr.');
  }
}

function _cargarPOS(ss, datos) {
  _zonaCargaIgual_(ss);
  var sh = ss.getSheetByName('02_Ventas_Maestro');
  var enc = datos[0];
  var c = {
    id: _col(enc, 'TicketId'), sub: _col(enc, 'Subtotal'), tot: _col(enc, 'TotalFinal'),
    costo: _col(enc, 'Costo'), gan: _col(enc, 'Ganancia'), notas: _col(enc, 'Notas'),
    fecha: _col(enc, 'Fecha'), hora: _col(enc, 'Hora'), cont: _col(enc, 'Es Contable'),
    vend: _col(enc, 'vendedor'), prod: _col(enc, 'Productos')
  };
  var ultima = sh.getLastRow();
  var previos = {};
  if (ultima >= 5) {
    var ids = sh.getRange(5, 1, ultima - 4, 1).getValues();
    for (var i = 0; i < ids.length; i++) previos[_norm(ids[i][0])] = true;
  }
  var filas = [], avisos = [], saltados = 0;
  for (var f = 1; f < datos.length; f++) {
    var id = _norm(datos[f][c.id]);
    if (!id || isNaN(Number(id))) continue;
    if (previos[id]) { saltados++; continue; }
    previos[id] = true;
    var fecha = _fechaCarga(datos[f][c.fecha]);
    if (!fecha) continue;
    var notas = _norm(datos[f][c.notas]);
    var com = /^\d+$/.test(notas) ? Number(notas) : '';
    var total = _numero(datos[f][c.tot]);
    if (com === '' && total > 5000) {
      avisos.push('Ticket ' + id + ' de Q' + total.toFixed(2) + ' sin comensales: ' +
                  'revisa si es un EVENTO PRIVADO antes de dar el reporte por bueno.');
    }
    filas.push([Number(id), fecha, _norm(datos[f][c.hora]), _numero(datos[f][c.sub]),
                total, _numero(datos[f][c.costo]), _numero(datos[f][c.gan]),
                notas, com, _norm(datos[f][c.cont]), _norm(datos[f][c.vend]),
                _norm(datos[f][c.prod])]);
  }
  if (filas.length) {
    var inicio = ultima + 1;
    sh.getRange(inicio, 1, filas.length, 12).setValues(filas);
    var form = [];
    for (var k = 0; k < filas.length; k++) {
      var r = inicio + k;
      form.push(['=IF(B' + r + '="","",IFERROR(YEAR(B' + r + '),""))',
                 '=IF(B' + r + '="","",IFERROR(WEEKNUM(B' + r + ',21),""))',
                 '=IF(B' + r + '="","",IFERROR(MONTH(B' + r + '),""))']);
    }
    sh.getRange(inicio, 13, form.length, 3).setFormulas(form);
    sh.getRange(inicio, 2, filas.length, 1).setNumberFormat('yyyy-mm-dd');
  }
  return { nuevas: filas.length, saltadas: saltados, avisos: avisos };
}

/**
 * El PosFile actualizado (arranco el 1-oct-2026, Juanma) empezo de cero y ya no saca el
 * reporte de tickets: saca el "ReporteFacturas" (Tipo documento, No., Fecha, Notas, Costo,
 * Ganancia, Total). Mientras la SAT no reciba sus facturas (quedan en "contingencia") es la
 * unica fuente de la venta, y entra a 02_Ventas_Maestro con las mismas columnas que el POS:
 *   TicketId   el No. tal cual (FT1, FT2...): no choca con los tickets numericos viejos
 *   Subtotal   el Total, que ya trae el 10% de servicio (FT1 = 1,000 x 1.10)
 *   Ganancia   Total / 1.10 - Costo. El archivo trae Ganancia = Total - Costo, con el
 *              servicio adentro; el motor saca la base sin servicio de Costo + Ganancia
 *              (regla 14), asi que se guarda como la daba el POS viejo.
 *   Comensales la columna Notas, igual que antes. Sin hora ni productos: no los trae.
 * Se saltan la fila TOTAL y las anuladas. Nunca duplica: compara el No. como el TicketId.
 */
function _cargarPOSFacturas(ss, datos) {
  _zonaCargaIgual_(ss);
  var sh = ss.getSheetByName('02_Ventas_Maestro');
  var enc = datos[0];
  var c = {
    tipo: _col(enc, 'Tipo documento'), id: _col(enc, 'No.'), fecha: _col(enc, 'Fecha'),
    estado: _col(enc, 'Estado'), vend: _col(enc, 'Vendedor'), cont: _col(enc, 'Contable'),
    notas: _col(enc, 'Notas'), costo: _col(enc, 'Costo'), tot: _col(enc, 'Total')
  };
  var ultima = sh.getLastRow();
  var previos = {};
  if (ultima >= 5) {
    var ids = sh.getRange(5, 1, ultima - 4, 1).getValues();
    for (var i = 0; i < ids.length; i++) previos[_norm(ids[i][0])] = true;
  }
  var filas = [], avisos = [], saltados = 0;
  for (var f = 1; f < datos.length; f++) {
    var id = _norm(datos[f][c.id]);
    if (!id || _norm(datos[f][c.tipo]).toUpperCase() === 'TOTAL') continue;
    if (/anul/i.test(_norm(datos[f][c.estado]))) continue;
    if (previos[id]) { saltados++; continue; }
    previos[id] = true;
    var fecha = _fechaCarga(datos[f][c.fecha]);
    if (!fecha) continue;
    var notas = _norm(datos[f][c.notas]);
    var com = /^\d+$/.test(notas) ? Number(notas) : '';
    var total = _numero(datos[f][c.tot]);
    var costo = _numero(datos[f][c.costo]);
    if (com === '' && total > 5000) {
      avisos.push('Factura ' + id + ' de Q' + total.toFixed(2) + ' sin comensales: ' +
                  'revisa si es un EVENTO PRIVADO antes de dar el reporte por bueno.');
    }
    filas.push([id, fecha, '', total, total, costo, Math.round((total / 1.10 - costo) * 100) / 100,
                notas, com, _norm(datos[f][c.cont]), _norm(datos[f][c.vend]), '']);
  }
  if (filas.length) {
    var inicio = ultima + 1;
    sh.getRange(inicio, 1, filas.length, 12).setValues(filas);
    var form = [];
    for (var k = 0; k < filas.length; k++) {
      var r = inicio + k;
      form.push(['=IF(B' + r + '="","",IFERROR(YEAR(B' + r + '),""))',
                 '=IF(B' + r + '="","",IFERROR(WEEKNUM(B' + r + ',21),""))',
                 '=IF(B' + r + '="","",IFERROR(MONTH(B' + r + '),""))']);
    }
    sh.getRange(inicio, 13, form.length, 3).setFormulas(form);
    sh.getRange(inicio, 2, filas.length, 1).setNumberFormat('yyyy-mm-dd');
  }
  return { nuevas: filas.length, saltadas: saltados, avisos: avisos };
}

/**
 * BANCO_BI (p233, 8-oct-2026): Banco Industrial desde un Sheet NATIVO ya categorizado.
 *
 * Lo arma Claude con el PDF de la semana y lo deja en la carpeta SXX como
 * BANCO_BI_SXX. Primera pestaña, fila 1 de encabezados:
 *   Fecha | Docto | Descripción | Débito | Crédito | Categoría |
 *   Total_desde | Total_hasta | Total_debitos | Total_creditos
 * A-F: un movimiento por fila (fecha AAAA-MM-DD). G-J: una fila por cada PDF, con el
 * rango y los totales IMPRESOS al pie del banco (pueden ir en las primeras filas).
 *
 * FRENA (no escribe nada) si: no hay totales, una fila cae fuera de los rangos, un
 * rango no cuadra al centavo, una fila no tiene categoria o trae una que nunca se uso
 * en 03_Banco_Industrial, o el encabezado del maestro cambio. Nunca duplica: la
 * llave es fecha|docto|debito|credito, la misma de los cargar_banco_SXX archivados.
 * Es_Personal = "Sí" solo con categoria PERSONAL. Año/Mes/Semana copian la formula
 * de la ultima fila. La fecha se escribe como TEXTO AAAA-MM-DD (setValue(Date) puede
 * no cambiar la celda sin avisar, 15-sep-2026).
 */
function _cargarBancoBI(ss, datos, escribir) {
  _zonaCargaIgual_(ss);
  var HOJA = '03_Banco_Industrial', ENC = 4;
  var sh = ss.getSheetByName(HOJA);
  var avisos = [], frenos = [];
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var dia = function (v) {
    var d = _fechaCarga(v);
    return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
  };
  var clave = function (f, doc, de, cr) {
    return f + '|' + _norm(doc).replace(/\.0+$/, '') + '|' + r2(de).toFixed(2) + '|' + r2(cr).toFixed(2);
  };

  // _col quita los acentos en vez de cambiarlos ("Débito" -> "Dbito"): aca se
  // comparan sin tilde y en minusculas, para aceptar "Débito" y "Debito".
  var enc = datos[0].map(function (h) {
    return _norm(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  });
  var col = function (t) { for (var i = 0; i < enc.length; i++) if (enc[i].indexOf(t) === 0) return i; return -1; };
  var c = {
    fecha: col('fecha'), doc: col('docto'), desc: col('descrip'),
    deb: col('debito'), cred: col('credito'), cat: col('categor'),
    tDesde: col('total_desde'), tHasta: col('total_hasta'),
    tDeb: col('total_debitos'), tCred: col('total_creditos')
  };
  for (var k in c) if (c[k] < 0) frenos.push('BANCO_BI: falta la columna ' + k);
  if (frenos.length) return { nuevas: 0, avisos: frenos, frenado: true };

  var esperado = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal'];
  var encM = sh.getRange(ENC, 1, 1, 8).getValues()[0];
  for (var e = 0; e < esperado.length; e++) {
    if (_norm(encM[e]) !== esperado[e]) frenos.push(HOJA + ': encabezado distinto en la columna ' + (e + 1));
  }

  // lo que ya esta en el maestro: llaves y categorias conocidas
  var ultima = sh.getLastRow();
  var previo = ultima > ENC ? sh.getRange(ENC + 1, 1, ultima - ENC, 7).getValues() : [];
  var ya = {}, cats = {}, ultimaDatos = ENC;
  for (var i = 0; i < previo.length; i++) {
    var p = previo[i];
    if (_norm(p[0]) === '' && _norm(p[2]) === '') continue;
    ultimaDatos = ENC + 1 + i;
    ya[clave(dia(p[0]), p[1], _numero(p[3]), _numero(p[4]))] = 1;
    if (_norm(p[6])) cats[_norm(p[6])] = 1;
  }

  var totales = [], movs = [];
  for (var f = 1; f < datos.length; f++) {
    var x = datos[f];
    if (_norm(x[c.tDesde])) {
      totales.push({ desde: dia(x[c.tDesde]), hasta: dia(x[c.tHasta]),
                     deb: r2(_numero(x[c.tDeb])), cred: r2(_numero(x[c.tCred])), sd: 0, sc: 0, n: 0 });
    }
    if (!_norm(x[c.fecha]) && !_norm(x[c.desc])) continue;
    var m = { fecha: dia(x[c.fecha]), doc: _norm(x[c.doc]).replace(/\.0+$/, ''), desc: _norm(x[c.desc]),
              deb: r2(_numero(x[c.deb])), cred: r2(_numero(x[c.cred])), cat: _norm(x[c.cat]), fila: f + 1 };
    if (!m.fecha) { frenos.push('BANCO_BI fila ' + m.fila + ': fecha ilegible'); continue; }
    if (!m.cat) frenos.push('BANCO_BI fila ' + m.fila + ' (' + m.desc + '): sin categoria');
    else if (m.cat === 'POR_CLASIFICAR') frenos.push('BANCO_BI fila ' + m.fila + ' (' + m.desc + '): POR_CLASIFICAR');
    else if (!cats[m.cat]) frenos.push('BANCO_BI fila ' + m.fila + ': categoria "' + m.cat +
      '" nunca se uso en ' + HOJA + '. Si es correcta, que Juanma la confirme; si no, corregirla.');
    movs.push(m);
  }

  if (!totales.length) frenos.push('BANCO_BI: sin totales del PDF (columnas Total_*): no se puede validar.');
  movs.forEach(function (m) {
    var t = totales.filter(function (t) { return m.fecha >= t.desde && m.fecha <= t.hasta; })[0];
    if (!t) { frenos.push('BANCO_BI fila ' + m.fila + ': ' + m.fecha + ' fuera de los rangos de los PDF'); return; }
    t.sd += m.deb; t.sc += m.cred; t.n++;
  });
  totales.forEach(function (t) {
    t.sd = r2(t.sd); t.sc = r2(t.sc);
    Logger.log('  BANCO_BI %s a %s: %s filas · debitos %s / banco %s · creditos %s / banco %s',
               t.desde, t.hasta, t.n, t.sd.toFixed(2), t.deb.toFixed(2), t.sc.toFixed(2), t.cred.toFixed(2));
    if (t.sd !== t.deb || t.sc !== t.cred) {
      frenos.push('BANCO_BI NO CUADRA ' + t.desde + ' a ' + t.hasta + ': archivo ' + t.sd.toFixed(2) + ' / ' +
                  t.sc.toFixed(2) + ' contra banco ' + t.deb.toFixed(2) + ' / ' + t.cred.toFixed(2));
    }
  });

  var nuevas = movs.filter(function (m) { return !ya[clave(m.fecha, m.doc, m.deb, m.cred)]; });
  if (nuevas.length && nuevas.length !== movs.length) {
    avisos.push('BANCO_BI: ' + (movs.length - nuevas.length) + ' de ' + movs.length +
                ' filas ya estaban en ' + HOJA + ' y se saltan. Mirar si alguien cargo parte a mano.');
  }
  if (frenos.length) {
    return { nuevas: 0, avisos: avisos.concat(frenos, ['>> BANCO_BI: NO se escribio nada.']), frenado: true };
  }
  if (!escribir || !nuevas.length) return { nuevas: 0, avisos: avisos, frenado: false };

  var formulas = sh.getRange(ultimaDatos, 9, 1, 3).getFormulasR1C1()[0];
  var bloque = nuevas.map(function (m) {
    var q = m.fecha.split('-'), d = new Date(Number(q[0]), Number(q[1]) - 1, Number(q[2]));
    return [m.fecha, m.doc, m.desc, m.deb, m.cred, '', m.cat, m.cat === 'PERSONAL' ? 'Sí' : 'No',
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _semanaISOCarga(d)];
  });
  var inicio = ultimaDatos + 1;
  sh.getRange(inicio, 1, bloque.length, 8).setValues(bloque.map(function (b) { return b.slice(0, 8); }));
  var fr = bloque.map(function (b) { return b.slice(8); });
  if (formulas[0]) sh.getRange(inicio, 9, fr.length, 3).setFormulasR1C1(fr);
  else sh.getRange(inicio, 9, fr.length, 3).setValues(fr);
  SpreadsheetApp.flush();

  // releer lo escrito (regla del 15-sep: un script de datos relee lo que escribio)
  var rel = sh.getRange(inicio, 1, bloque.length, 5).getValues(), mal = 0;
  for (var j = 0; j < rel.length; j++) {
    if (clave(dia(rel[j][0]), rel[j][1], _numero(rel[j][3]), _numero(rel[j][4])) !==
        clave(nuevas[j].fecha, nuevas[j].doc, nuevas[j].deb, nuevas[j].cred)) mal++;
  }
  if (mal) avisos.push('BANCO_BI: ' + mal + ' fila(s) no se releyeron igual a lo escrito. Revisar ' + HOJA +
                       ' desde la fila ' + inicio + '.');
  return { nuevas: nuevas.length, avisos: avisos, frenado: false };
}

function _cargarFEL(ss, datos, emitidas) {
  _zonaCargaIgual_(ss);
  var sh = ss.getSheetByName(emitidas ? '01b_FEL_Emitidas' : '01_FEL_Maestro');
  var primera = emitidas ? 4 : 5;
  var enc = datos[0];
  var c = {
    fecha: _col(enc, 'Fecha de emisi'), tipo: _col(enc, 'Tipo de DTE'),
    serie: _col(enc, 'Serie'), num: _col(enc, 'Numero del DTE'),
    nit: _col(enc, 'NIT del emisor'), emisor: _col(enc, 'Nombre completo del emisor'),
    estab: _col(enc, 'Nombre del establecimiento'),
    recep: _col(enc, 'Nombre completo del receptor'),
    estado: _col(enc, 'Estado'), moneda: _col(enc, 'Moneda'),
    total: _col(enc, 'Gran Total'), iva: _col(enc, 'IVA')
  };
  if (c.num < 0) c.num = _col(enc, 'Número del DTE');

  // GUARDIA DE ENCABEZADOS - agregada el 3-sep-2026 despues del incidente de mayo.
  //
  // _col devuelve -1 cuando no encuentra la columna. Y datos[f][-1] es undefined,
  // que _norm convierte en cadena vacia. O sea que un archivo con el encabezado
  // escrito de otra forma NO rompe nada: carga todas sus filas con ese campo en
  // blanco y nadie se entera.
  //
  // Con el numero de DTE en blanco, la llave de deduplicacion de mas abajo queda
  // "SERIE|" en vez de "SERIE|2476559877". No colisiona con lo que ya estaba
  // cargado, asi que las mismas facturas entran por segunda vez.
  //
  // Asi entraron 54 filas duplicadas de mayo 2026 (Q21,748.40 de gasto que nunca
  // ocurrio) sin un solo aviso, y ademas fechadas una hora antes, o sea en el dia
  // y la semana equivocados.
  //
  // Falla fuerte a proposito: es mejor que la carga se detenga y se vea, a que
  // duplique en silencio. Misma leccion que PosPauta en agosto de 2026.
  var faltanCols = [];
  if (c.fecha < 0) faltanCols.push('Fecha de emision');
  if (c.serie < 0) faltanCols.push('Serie');
  if (c.num   < 0) faltanCols.push('Numero del DTE');
  if (c.total < 0) faltanCols.push('Gran Total');
  if (faltanCols.length) {
    throw new Error('Archivo de FEL ' + (emitidas ? 'emitidas' : 'recibidas') +
      ' sin las columnas: ' + faltanCols.join(', ') + '. Sin ellas la deduplicacion no ' +
      'funciona y las facturas entrarian repetidas. No se cargo nada. ' +
      'Encabezados que trae el archivo: ' + enc.join(' | '));
  }

  // SEGUNDA LLAVE: Numero del DTE + Gran Total - agregada el 2-oct-2026.
  // Hay series de SAT que parecen numeros ("89526E69", "09296263") y Sheets
  // las guardo como numero (8.9526e+69, 9296263). Con eso la llave
  // "Serie|Numero" de la hoja ya no coincide con la del archivo y la misma
  // factura entraba otra vez cada vez que se releia su carpeta: 5 emitidas
  // de jul-ago quedaron 3 veces (Q5,819 de venta de mas). La segunda llave
  // no depende de la serie. Y desde ahora Serie y Numero se escriben como
  // texto (ver mas abajo) para que la serie no se vuelva a danar.
  var ultima = sh.getLastRow(), previos = {}, porTotal = {};
  var colSerie = emitidas ? 2 : 3, colTotal = emitidas ? 8 : 10;
  if (ultima >= primera) {
    var pares = sh.getRange(primera, colSerie, ultima - primera + 1, 2).getValues();
    var totales = sh.getRange(primera, colTotal, ultima - primera + 1, 1).getValues();
    for (var i = 0; i < pares.length; i++) {
      var s = _norm(pares[i][0]), n = _norm(pares[i][1]).replace(/\.0$/, '');
      if (s) previos[s + '|' + n] = true;
      if (n) porTotal[n + '|' + _numero(totales[i][0]).toFixed(2)] = true;
    }
  }
  var filas = [], saltadas = 0, nuevosProv = {};
  for (var f = 1; f < datos.length; f++) {
    var serie = _norm(datos[f][c.serie]);
    var num = _norm(datos[f][c.num]).replace(/\.0$/, '');
    if (!serie) continue;
    var llaveTotal = num + '|' + _numero(datos[f][c.total]).toFixed(2);
    if (previos[serie + '|' + num] || (num && porTotal[llaveTotal])) { saltadas++; continue; }
    previos[serie + '|' + num] = true;
    if (num) porTotal[llaveTotal] = true;
    var fecha = _fechaCarga(datos[f][c.fecha]);
    if (!fecha) continue;
    if (emitidas) {
      filas.push([fecha, serie, num, _norm(datos[f][c.nit]), _norm(datos[f][c.recep]),
                  _norm(datos[f][c.estado]), _norm(datos[f][c.moneda]),
                  _numero(datos[f][c.total]), _numero(datos[f][c.iva])]);
    } else {
      var estab = _norm(datos[f][c.estab]);
      nuevosProv[estab] = true;
      filas.push([fecha, _norm(datos[f][c.tipo]), serie, num, _norm(datos[f][c.nit]),
                  _norm(datos[f][c.emisor]), estab, _norm(datos[f][c.estado]),
                  _norm(datos[f][c.moneda]), _numero(datos[f][c.total]),
                  _numero(datos[f][c.iva])]);
    }
  }
  if (!filas.length) return { nuevas: 0, saltadas: saltadas, avisos: [] };

  var inicio = ultima + 1, ancho = emitidas ? 9 : 11;
  sh.getRange(inicio, colSerie, filas.length, 2).setNumberFormat('@');   // Serie y Numero como texto
  sh.getRange(inicio, 1, filas.length, ancho).setValues(filas);

  var form = [];
  for (var k = 0; k < filas.length; k++) {
    var r = inicio + k;
    if (emitidas) {
      form.push(['=IF(A' + r + '="","",YEAR(A' + r + '))',
                 '=IF(A' + r + '="","",MONTH(A' + r + '))']);
    } else {
      form.push(['=IF(A' + r + '="","",IFERROR(YEAR(A' + r + '),""))',
                 '=IF(A' + r + '="","",IFERROR(WEEKNUM(A' + r + ',21),""))',
                 '=IF(G' + r + '="","",IFERROR(VLOOKUP(G' + r + ",'00_Proveedores'!A:C,3,FALSE()),\"POR_CLASIFICAR\"))",
                 '=IF(G' + r + '="","",IFERROR(VLOOKUP(G' + r + ",'00_Proveedores'!A:D,4,FALSE()),\"No\"))",
                 '=IF(A' + r + '="","",IFERROR(MONTH(A' + r + '),""))']);
    }
  }
  sh.getRange(inicio, emitidas ? 10 : 12, form.length, emitidas ? 2 : 5).setFormulas(form);
  sh.getRange(inicio, 1, filas.length, 1).setNumberFormat('yyyy-mm-dd');

  // proveedores que no estan en el catalogo
  var avisos = [];
  if (!emitidas) {
    var cat = {}, prov = ss.getSheetByName('00_Proveedores');
    var lista = prov.getRange(1, 1, prov.getLastRow(), 1).getValues();
    for (var p = 0; p < lista.length; p++) cat[_norm(lista[p][0])] = true;
    var faltan = [];
    for (var nom in nuevosProv) if (nom && !cat[nom]) faltan.push(nom);
    if (faltan.length) {
      avisos.push('Proveedores nuevos, quedan en POR_CLASIFICAR hasta que los agregues a ' +
                  '00_Proveedores: ' + faltan.join(' | '));
    }
  }
  return { nuevas: filas.length, saltadas: saltadas, avisos: avisos };
}

// ============================================================
// BARRIDO AUTOMATICO
// Recorre todas las carpetas de Reportes 2026 y carga lo que falte.
// Lleva registro de los archivos ya procesados (por id + fecha de
// modificacion) para no reprocesarlos en cada corrida.
// ============================================================

var LIMITE_MS = 4.5 * 60 * 1000;   // Apps Script corta a los 6 min

// Cuantas semanas hacia atras mira la carga AUTOMATICA. Existe para que el
// activador no arrastre el historico: un barrido completo procesa las 27
// carpetas y, aunque la deduplicacion evita repetidos, agregaria facturas
// viejas que nunca entraron y eso toca meses ya cerrados. La carga a mano
// ("Cargar lo que falte") sigue mirando todo.
var VENTANA_SEMANAS = 3;

function _semanaISOCarga(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;             // domingo = 7, no 0
  t.setUTCDate(t.getUTCDate() + 4 - dia);   // al jueves de su semana
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}

/**
 * Si la carpeta entra en la ventana. Sin ventana (null o 0) entran todas.
 *
 * Nota de borde: en enero, una carpeta de las ultimas semanas del año anterior
 * daria una resta negativa y queda fuera. No importa mientras la raiz sea
 * "Reportes 2026", que es por año; al abrir "Reportes 2027" habra que cargar el
 * cierre de diciembre a mano una vez.
 */
function _dentroDeVentana(nombre, semanas) {
  if (!semanas) return true;
  var hoy = new Date();
  var s = nombre.match(/^S(\d{1,2})$/);
  if (s) {
    var atras = _semanaISOCarga(hoy) - Number(s[1]);
    return atras >= 0 && atras < semanas;
  }
  var m = nombre.match(/^(20\d\d)-(\d\d)$/);
  if (m) {                                   // el mes en curso y el anterior
    var mesCarpeta = Number(m[1]) * 12 + Number(m[2]);
    var mesHoy = hoy.getFullYear() * 12 + (hoy.getMonth() + 1);
    return mesHoy - mesCarpeta >= 0 && mesHoy - mesCarpeta <= 1;
  }
  return false;
}
var CLAVE_PROGRESO = 'rosanta_archivos_procesados';

function _progreso() {
  var txt = PropertiesService.getScriptProperties().getProperty(CLAVE_PROGRESO);
  return txt ? JSON.parse(txt) : {};
}
function _guardarProgreso(p) {
  PropertiesService.getScriptProperties().setProperty(CLAVE_PROGRESO, JSON.stringify(p));
}
function olvidarProgreso() {
  PropertiesService.getScriptProperties().deleteProperty(CLAVE_PROGRESO);
  Logger.log('Registro borrado. La proxima corrida vuelve a revisar todo.');
}

function _barrido(escribir, ventana) {
  var inicio = new Date().getTime();
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  var vistos = escribir ? _progreso() : {};
  var raiz = DriveApp.getFolderById(REPORTES_2026);
  var carpetas = [], it = raiz.getFolders();
  while (it.hasNext()) {
    var c = it.next();
    if (/^(S\d{1,2}|20\d\d-\d\d)$/.test(c.getName()) &&
        _dentroDeVentana(c.getName(), ventana)) carpetas.push(c);
  }
  if (ventana) {
    Logger.log('Ventana de ' + ventana + ' semanas: ' + carpetas.length +
               ' carpeta(s). El historico no se toca en esta corrida.');
  }
  carpetas.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });

  var lineas = [], avisos = [], sinTiempo = false, tocadas = 0;

  for (var i = 0; i < carpetas.length && !sinTiempo; i++) {
    var carpeta = carpetas[i], archivos = carpeta.getFiles(), temporales = [];
    while (archivos.hasNext()) {
      if (new Date().getTime() - inicio > LIMITE_MS) { sinTiempo = true; break; }
      var f = archivos.next();
      var nombre = f.getName(), mime = f.getMimeType();
      var esExcel = mime.indexOf('spreadsheet') >= 0 || mime.indexOf('excel') >= 0 ||
                    /\.xlsx?$/i.test(nombre) || mime === 'application/octet-stream';
      if (!esExcel) continue;

      var huella = f.getId() + ':' + f.getLastUpdated().getTime();
      if (vistos[huella]) continue;

      var id = f.getId();
      if (mime !== MimeType.GOOGLE_SHEETS) {
        id = _convertir(f.getId(), nombre);
        if (!id) continue;
        temporales.push(id);
      }
      var datos;
      try {
        datos = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
      } catch (e) {
        avisos.push('No pude leer ' + carpeta.getName() + '/' + nombre + ': ' + e.message);
        continue;
      }
      var tipo = _identificar(datos);
      if (tipo === '?') { vistos[huella] = 1; continue; }

      if (!escribir) {
        lineas.push(carpeta.getName() + '  ' + tipo + '  <-  ' + nombre);
        if (tipo === 'BANCO_BI') avisos = avisos.concat(_cargarBancoBI(ss, datos, false).avisos);
        continue;
      }
      var res = tipo === 'POS'          ? _cargarPOS(ss, datos)
              : tipo === 'BANCO_BI'     ? _cargarBancoBI(ss, datos, true)
              : tipo === 'POS_FACTURAS' ? _cargarPOSFacturas(ss, datos)
              : tipo === 'FEL_EMITIDAS' ? _cargarFEL(ss, datos, true)
              :                           _cargarFEL(ss, datos, false);
      // Un banco frenado (no cuadra, categoria nueva...) no se marca como visto:
      // la proxima corrida lo vuelve a intentar.
      if (!res.frenado) vistos[huella] = 1;
      tocadas += res.nuevas;
      if (res.nuevas) {
        lineas.push(carpeta.getName() + '  ' + tipo + ': +' + res.nuevas +
                    ' filas nuevas  (' + nombre + ')');
      }
      avisos = avisos.concat(res.avisos);
    }
    _limpiar(temporales);
  }

  if (escribir) _guardarProgreso(vistos);

  Logger.log(escribir ? '=== Carga de lo pendiente ===' : '=== Revision, no se escribio nada ===');
  if (!lineas.length) Logger.log(escribir ? 'Todo estaba al dia: no habia nada nuevo que cargar.'
                                          : 'No hay archivos sin procesar.');
  for (var j = 0; j < lineas.length; j++) Logger.log('  ' + lineas[j]);
  if (escribir) Logger.log('Filas nuevas en total: ' + tocadas);
  if (avisos.length) {
    Logger.log('--- REVISAR ---');
    for (var k = 0; k < avisos.length; k++) Logger.log('  ' + avisos[k]);
  }
  if (sinTiempo) {
    Logger.log('>> Me quede sin tiempo. Corre "Cargar lo que falte" otra vez ' +
               'para seguir donde quedo.');
  }
  Logger.log('Banco Industrial entra solo desde un Sheet BANCO_BI_SXX; BAC y tarjetas no se cargan aca.');
}

function cargarPendientes()  { _barrido(true); }
function revisarPendientes() { _barrido(false); }

// Las acotadas: solo las ultimas VENTANA_SEMANAS semanas. Son las que corre el
// activador. A mano se sigue usando cargarPendientes(), que mira todo.
function cargarUltimasSemanas()  { _barrido(true, VENTANA_SEMANAS); }
function revisarUltimasSemanas() { _barrido(false, VENTANA_SEMANAS); }

/**
 * ESTA ES LA QUE CONVIENE: deja la carga en automatico los lunes 10:00, pero
 * mirando solo las ultimas VENTANA_SEMANAS semanas. Corre antes del espejo
 * (10:30) y del dashboard (11:04), asi que el lunes ya esta todo al dia.
 *
 * Acotada a proposito: el barrido completo procesa las 27 carpetas y agregaria
 * facturas viejas que nunca entraron, tocando meses ya cerrados. Con la ventana,
 * el activador solo ve lo reciente y el historico se carga a mano cuando se
 * decida, con "Cargar lo que falte".
 *
 * Se instala una sola vez. Borra cualquier activador anterior de las dos
 * variantes, para que no queden dos corriendo.
 */
function instalarCargaAutomaticaAcotada() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var h = triggers[i].getHandlerFunction();
    if (h === 'cargarPendientes' || h === 'cargarUltimasSemanas') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('cargarUltimasSemanas')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(0)
    .create();
  Logger.log('Carga automatica instalada: lunes ~10:00, ultimas ' + VENTANA_SEMANAS +
             ' semanas. El historico no se toca.');
}

/** Que activadores hay ahora mismo. No cambia nada. */
function verActivadores() {
  var t = ScriptApp.getProjectTriggers();
  if (!t.length) { Logger.log('No hay ningun activador instalado.'); return; }
  for (var i = 0; i < t.length; i++) {
    Logger.log(t[i].getHandlerFunction() + '  ·  ' + t[i].getEventType());
  }
}

/**
 * La version SIN ventana: barre las 27 carpetas cada lunes. Queda por si algun
 * dia se quiere, pero no es la recomendada; ver instalarCargaAutomaticaAcotada().
 */
function instalarCargaAutomatica() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cargarPendientes') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('cargarPendientes')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .nearMinute(0)
    .create();
  Logger.log('Carga automatica instalada: lunes ~10:00, antes del espejo.');
}

// ---- menu dentro del maestro ----

function instalarMenu() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'alAbrirMaestro') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('alAbrirMaestro')
    .forSpreadsheet(SHEET_ID_CARGA)
    .onOpen()
    .create();
  Logger.log('Menu instalado. Abri el maestro (o recargalo) y busca "Rosanta" en la barra.');
}

function alAbrirMaestro() {
  SpreadsheetApp.openById(SHEET_ID_CARGA).addMenu('Rosanta', [
    { name: 'Cargar lo que falte',        functionName: 'menuCargar' },
    { name: 'Solo revisar (no escribe)',  functionName: 'menuRevisar' },
    null,
    { name: 'Actualizar el espejo',       functionName: 'menuEspejo' },
    null,
    { name: 'Reclasificar lote: revisar', functionName: 'menuReclasRevisar' },
    { name: 'Reclasificar lote: APLICAR', functionName: 'menuReclasAplicar' },
    null,
    { name: 'Volver a revisar todo',      functionName: 'menuOlvidar' }
  ]);
}

function menuCargar() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Rosanta', 'Voy a revisar las carpetas y cargar lo que falte.\n' +
           'Puede tardar un poco la primera vez.', ui.ButtonSet.OK);
  _barrido(true);
  ui.alert('Rosanta', 'Listo. Mira el detalle en Extensiones > Apps Script > Registros de ejecucion.',
           ui.ButtonSet.OK);
}
function menuRevisar() { _barrido(false); _avisoLog(); }
function menuEspejo()  { generarEspejo(); _avisoLog(); }
function menuOlvidar() { olvidarProgreso(); _avisoLog(); }

/* 12-sep-2026: estas dos entradas existen porque el desplegable de funciones del
   editor de Apps Script NO es confiable en este proyecto. Evidencia del mismo dia:
   se le dio Run a las 16:48:07 con el desplegable diciendo "revisarSinClasificar" y
   la pagina de Ejecuciones registro que corrio "_fSC". Tres intentos de seleccionar
   reclasificarSinClasificar —por coordenada, por teclado y por referencia de
   elemento— dejaron el desplegable donde estaba. El menu del Sheet si funciona.
   Se corre desde aca y se verifica en la pagina de Ejecuciones, que es la unica
   fuente que no miente sobre que se ejecuto.
   29-sep-2026: el lote que corre es retiros_personales_tc.js (7 adelantos de la
   tarjeta, Q2,400, a PERSONAL). El de reclasificar_sin_clasificar ya corrio el
   12-sep y se archivo. Un lote nuevo se engancha aca, cambiando estas dos
   llamadas, y el archivo sale del proyecto cuando corrio.
   8-oct-2026: corren DOS lotes. El de los adelantos de la tarjeta seguia sin correr
   (el espejo del 5-oct todavia los tiene en ALIMENTOS_EFECTIVO) y se le suma
   entre_volcanes_ajena.js (gasolinera, facturas solo para el IVA: de BEBIDAS a FACTURA_AJENA). Los dos se pueden
   correr dos veces sin dano.
   8-oct-2026 (tarde): retiros_personales_tc.js ya corrio (las 7 filas estan en
   PERSONAL) y salio a apps-script/_archivo/2026-10-08_lotes_corridos_maestro.
   Queda solo entre_volcanes_ajena.js. */
function menuReclasRevisar() { revisarEntreVolcanesAjena(); _avisoLog(); }

function menuReclasAplicar() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Rosanta \u2014 reclasificar el lote',
    'Esto ESCRIBE en el maestro.\n\n' +
    'Cada fila se verifica antes de escribir: llave unica, fecha, monto y que la ' +
    'categoria actual sea la esperada. La que no cuadre NO se toca y se reporta.\n\n' +
    'Corre primero "Reclasificar lote: revisar" y leelo. Si dijo "Sin avisos", segui.\n\n' +
    'Aplicar ahora?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) {
    ui.alert('Rosanta', 'No se escribio nada.', ui.ButtonSet.OK);
    return;
  }
  aplicarEntreVolcanesAjena();

  /* 12-sep-2026: este flush NO es decorativo. La primera corrida escribio las 36
     filas correctamente —el Sheet lo confirma— pero el espejo que se genero cinco
     segundos despues traia el FEL nuevo y las DOS FILAS DEL BAC viejas. El BAC es
     el ultimo libro que escribe el lote, asi que sus setValue seguian pendientes
     cuando generarEspejo() leyo la hoja. El dato estaba bien y el espejo mentia,
     que es la peor combinacion: el analisis local habria dicho que no se escribio. */
  SpreadsheetApp.flush();
  generarEspejo();
  ui.alert('Rosanta',
    'Lote aplicado y espejo regenerado.\n\n' +
    'VERIFICA en Extensiones > Apps Script > Ejecuciones que aparezca ' +
    '"menuReclasAplicar" y en su registro el lote de Entre Volcanes. Si no aparece, no se escribio.',
    ui.ButtonSet.OK);
}
function _avisoLog() {
  SpreadsheetApp.getUi().alert('Rosanta',
    'Listo. El detalle esta en Extensiones > Apps Script > Registros de ejecucion.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
