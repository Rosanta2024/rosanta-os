// ============================================================
// ROSANTA - Cargador automatico del maestro
//
// Lee una carpeta de "Reportes 2026" (SXX semanal o 2026-MM mensual),
// identifica cada archivo POR SU CONTENIDO -no por el nombre- y carga
// las filas nuevas al maestro.
//
// Que reconoce:
//   POS            -> tiene columna "TicketId"        -> 02_Ventas_Maestro
//   FEL emitidas   -> el EMISOR es CORSAGA            -> 01b_FEL_Emitidas
//   FEL recibidas  -> el emisor es otro               -> 01_FEL_Maestro
//   Todo lo demas (PDF, zip, planilla, etc.) se ignora.
//
// Nunca duplica: en FEL compara la pareja (Serie, Numero del DTE) y en
// ventas el TicketId. Si la corres dos veces, la segunda no agrega nada.
//
// Los estados de cuenta (Banco Industrial, BAC y tarjeta) NO se cargan
// aca: vienen en PDF y los procesa Claude una vez al mes, validando
// contra los totales impresos del banco.
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
  if (v instanceof Date) return v;
  var s = _norm(v);
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}
function _col(encabezados, texto) {
  for (var i = 0; i < encabezados.length; i++) {
    if (_norm(encabezados[i]).toLowerCase().indexOf(texto.toLowerCase()) === 0) return i;
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

function _cargarPOS(ss, datos) {
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

function _cargarFEL(ss, datos, emitidas) {
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

  var ultima = sh.getLastRow(), previos = {};
  if (ultima >= primera) {
    var pares = sh.getRange(primera, emitidas ? 2 : 3, ultima - primera + 1, 2).getValues();
    for (var i = 0; i < pares.length; i++) {
      var s = _norm(pares[i][0]), n = _norm(pares[i][1]).replace(/\.0$/, '');
      if (s) previos[s + '|' + n] = true;
    }
  }
  var filas = [], saltadas = 0, nuevosProv = {};
  for (var f = 1; f < datos.length; f++) {
    var serie = _norm(datos[f][c.serie]);
    var num = _norm(datos[f][c.num]).replace(/\.0$/, '');
    if (!serie) continue;
    if (previos[serie + '|' + num]) { saltadas++; continue; }
    previos[serie + '|' + num] = true;
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

function _barrido(escribir) {
  var inicio = new Date().getTime();
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  var vistos = escribir ? _progreso() : {};
  var raiz = DriveApp.getFolderById(REPORTES_2026);
  var carpetas = [], it = raiz.getFolders();
  while (it.hasNext()) {
    var c = it.next();
    if (/^(S\d{1,2}|20\d\d-\d\d)$/.test(c.getName())) carpetas.push(c);
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
        continue;
      }
      var res = tipo === 'POS'          ? _cargarPOS(ss, datos)
              : tipo === 'FEL_EMITIDAS' ? _cargarFEL(ss, datos, true)
              :                           _cargarFEL(ss, datos, false);
      vistos[huella] = 1;
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
  Logger.log('Los estados de cuenta del banco no se cargan aca: vienen en PDF.');
}

function cargarPendientes()  { _barrido(true); }
function revisarPendientes() { _barrido(false); }

/**
 * Deja la carga en automatico: todos los lunes 10:00 revisa las carpetas
 * y sube lo que hayas dejado ahi. Corre antes del espejo (10:30) y del
 * dashboard (11:04), asi que el lunes ya esta todo al dia sin tocar nada.
 * Se instala una sola vez.
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
function _avisoLog() {
  SpreadsheetApp.getUi().alert('Rosanta',
    'Listo. El detalle esta en Extensiones > Apps Script > Registros de ejecucion.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
