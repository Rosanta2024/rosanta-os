/* Archivado el 15-oct-2026 desde MedicionDatos.js (tarea 3 de "Solidez de la intranet, dia 3").
   Ninguna pantalla lo llamaba: Compras en efectivo (ComprasEfectivo.js, registrarRetiroYCompras)
   reemplazo esta pantalla el 14-oct. medRetirosMes_ se quedo en el proyecto (la usan el vigia,
   el tablero y Compras). */

function medPuedeRetiros_(u) {
  var r = normalizar_(u && u.rol);
  if (r !== 'dueno' && r !== 'chef') throw new Error('Anotar retiros lo hace cocina (chef) o el dueño.');
}

/** La pantalla de retiros: este mes y el anterior. */
function getRetirosPendientes(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  medPuedeRetiros_(u);
  var hoy = new Date();
  var ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return { actual: medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1),
           anterior: medRetirosMes_(ant.getFullYear(), ant.getMonth() + 1),
           // las compras de mercado anotadas en Pagos con "Retiro de cajero" (p213)
           mercado: medMercadoDeRetiros_() };
}

/** Anota que se compro con un retiro de cajero. Devuelve la lista actualizada. */
function registrarRetiro(auth, fecha, monto, detalle, area, archivo) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  medPuedeRetiros_(u);
  fecha = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha invalida: ' + fecha);
  monto = Number(monto);
  if (!(monto > 0)) throw new Error('Monto invalido.');
  detalle = String(detalle || '').trim();
  if (detalle.length < 3) throw new Error('Escribi que se compro (al menos una palabra).');
  area = String(area || '').toUpperCase() === 'BARRA' ? 'BARRA' : 'COCINA';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var sh = ss.getSheetByName(MED_RETIROS_HOJA_);
    if (!sh) {
      sh = ss.insertSheet(MED_RETIROS_HOJA_);
      sh.getRange(1, 1, 1, MED_RETIROS_COLS_.length).setValues([MED_RETIROS_COLS_]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    var fila = [fecha, monto, detalle.slice(0, 600), area, u.nombre || u.email || '', new Date()];
    if (archivo) {   // el comprobante del que salio el detalle (29-sep-2026), en su propia columna
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), iA = head.indexOf('ARCHIVO');
      if (iA === -1) { iA = head.length; sh.getRange(1, iA + 1).setValue('ARCHIVO').setFontWeight('bold'); }
      while (fila.length < iA) fila.push('');
      fila[iA] = String(archivo).slice(0, 1000);
    }
    sh.appendRow(fila);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  var p = fecha.split('-');
  var r = medRetirosMes_(Number(p[0]), Number(p[1]));
  var ok = r.lista.some(function (x) { return x.fecha === fecha && Math.abs(x.monto - monto) < 0.01 && x.detalle; });
  return { ok: ok, mes: r,
           aviso: ok ? '' : 'Quedo anotado, pero no hay un retiro de cajero de Q' + monto + ' el ' + fecha + ' en el banco cargado. Revisa la fecha y el monto.' };
}

/* ---- El comprobante de retiros (29-sep-2026, pedido de Juanma) ----
   Jeffry pide el mercado por WhatsApp. En vez de escribir cada compra, sube lo que ya
   tiene: capturas de los chats con los proveedores, un Excel o un Google Sheet. Claude lee
   el archivo, saca proveedor, productos y montos, y propone a que retiro de cajero
   corresponde cada compra. Nada se guarda sin que Jeffry lo confirme (registrarRetiro).
   El archivo queda en Drive, carpeta Comprobantes_retiros junto a la config. */
var MED_RET_CARPETA_ = 'Comprobantes_retiros';
var MED_RET_MODELO_ = 'claude-opus-5';
var MED_RET_ESQUEMA_ = {
  type: 'object', additionalProperties: false, required: ['compras'],
  properties: { compras: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['fecha', 'proveedor', 'productos', 'total', 'retiro_fecha', 'retiro_monto', 'confianza', 'nota'],
    properties: {
      fecha: { type: 'string' }, proveedor: { type: 'string' },
      productos: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['producto', 'cantidad', 'unidad', 'precio'],
        properties: { producto: { type: 'string' }, cantidad: { type: 'number' }, unidad: { type: 'string' }, precio: { type: 'number' } } } },
      total: { type: 'number' }, retiro_fecha: { type: 'string' }, retiro_monto: { type: 'number' },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'] }, nota: { type: 'string' } } } } }
};
var MED_RET_INSTRUCCION_ =
  'Sos el asistente de compras del restaurante Rosanta (Antigua Guatemala). El chef retira efectivo del cajero ' +
  'y con eso paga el mercado; los pedidos los hace por WhatsApp a cada proveedor. Te paso capturas de esos chats ' +
  'o tablas, y la lista de retiros de cajero que todavia no tienen detalle.\n\n' +
  'Por cada compra que veas, devuelve: fecha (AAAA-MM-DD; si falta el año es 2026; si no hay fecha, vacio), ' +
  'proveedor (el nombre del contacto o del negocio), productos con cantidad, unidad y precio (0 si no aparece), ' +
  'y total (el que diga el proveedor; si no dice, la suma de los precios; si no hay precios, 0).\n\n' +
  'Despues asigna cada compra a UN retiro de la lista: el mismo dia o hasta 3 dias despues del retiro, y con un ' +
  'total que quepa en el monto. Varias compras pueden ir al mismo retiro. Si ninguno encaja, deja retiro_fecha ' +
  'vacio y retiro_monto 0. confianza: alta si fecha y monto cuadran, media si solo la fecha, baja si es una ' +
  'suposicion. En nota, una frase corta en español con la duda si la hay.\n\n' +
  'No inventes: lo que no se lee, va vacio o en 0. Ignora mensajes que no sean pedidos o cobros.\n\n' +
  'Retiros sin detalle (fecha y monto en quetzales): ';

function _medRetCarpeta_() {
  var padre = DriveApp.getFileById(getSheetId_('CONFIG_SHEET_ID')).getParents().next();
  var it = padre.getFoldersByName(MED_RET_CARPETA_);
  return it.hasNext() ? it.next() : padre.createFolder(MED_RET_CARPETA_);
}

function _medRetTablaTexto_(valores) {
  return valores.slice(0, 400).filter(function (r) { return r.join('').trim() !== ''; }).map(function (r) {
    return r.map(function (c) { return c instanceof Date ? medFechaIso_(c) : String(c); }).join(' | ');
  }).join('\n');
}

/** Un Excel o CSV a texto. El Excel se convierte a Sheet temporal con Drive y se tira. */
function _medRetLeerTabla_(blob, nombre, carpeta) {
  if (/\.csv$/i.test(nombre) || /csv/i.test(blob.getContentType())) return _medRetTablaTexto_(Utilities.parseCsv(blob.getDataAsString()));
  var tmp = Drive.Files.create({ name: 'tmp_' + nombre, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [carpeta.getId()] },
                              blob, { fields: 'id' });
  try {
    var ss = SpreadsheetApp.openById(tmp.id);
    return ss.getSheets().map(function (sh) { return 'Hoja ' + sh.getName() + ':\n' + _medRetTablaTexto_(sh.getDataRange().getValues()); }).join('\n\n');
  } finally { DriveApp.getFileById(tmp.id).setTrashed(true); }
}

/**
 * Lee el comprobante y propone. archivos: [{nombre, mime, datos (base64)}]; sheetUrl opcional.
 * Devuelve { compras, pendientes, archivos } y no escribe nada en los libros.
 */
function leerComprobanteRetiros(auth, archivos, sheetUrl) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  medPuedeRetiros_(u);
  archivos = archivos || [];
  sheetUrl = String(sheetUrl || '').trim();
  if (!archivos.length && !sheetUrl) throw new Error('Sube al menos una captura, un Excel o pega el link de un Google Sheet.');
  if (archivos.length > 8) throw new Error('Máximo 8 archivos por vez.');
  var carpeta = _medRetCarpeta_(), sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd_HHmm');
  var contenido = [], guardados = [];
  archivos.forEach(function (a, i) {
    var mime = String(a.mime || ''), nombre = String(a.nombre || ('archivo' + (i + 1)));
    var blob = Utilities.newBlob(Utilities.base64Decode(a.datos), mime, sello + '_' + nombre);
    var f = carpeta.createFile(blob);
    guardados.push({ nombre: nombre, url: f.getUrl() });
    if (/^image\/(jpeg|png|gif|webp)$/.test(mime)) {
      contenido.push({ type: 'image', source: { type: 'base64', media_type: mime, data: a.datos } });
    } else if (/\.(xlsx|xls|csv)$/i.test(nombre) || /spreadsheet|excel|csv/i.test(mime)) {
      contenido.push({ type: 'text', text: 'Archivo ' + nombre + ':\n' + _medRetLeerTabla_(blob, nombre, carpeta) });
    } else {
      throw new Error('No puedo leer ' + nombre + '. Sube capturas (JPG o PNG), un Excel o un CSV.');
    }
  });
  if (sheetUrl) {
    var ss;
    try { ss = SpreadsheetApp.openByUrl(sheetUrl); }
    catch (e) { throw new Error('No pude abrir el Sheet. Compártelo con restaurante@rosanta.rest como lector y vuelve a intentar.'); }
    contenido.push({ type: 'text', text: 'Google Sheet ' + ss.getName() + ':\n' +
      ss.getSheets().map(function (sh) { return _medRetTablaTexto_(sh.getDataRange().getValues()); }).join('\n\n') });
    guardados.push({ nombre: ss.getName(), url: ss.getUrl() });
  }
  var hoy = new Date(), ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  var pend = medRetirosMes_(ant.getFullYear(), ant.getMonth() + 1).lista.concat(medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1).lista)
    .filter(function (x) { return !x.detalle; }).map(function (x) { return { fecha: x.fecha, monto: x.monto }; });
  contenido.push({ type: 'text', text: MED_RET_INSTRUCCION_ + JSON.stringify(pend) });
  var body = claudeLlamar_({
    model: MED_RET_MODELO_, max_tokens: 8000, fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: MED_RET_ESQUEMA_ } },
    messages: [{ role: 'user', content: contenido }]
  }, ['server-side-fallback-2026-07-01']);
  if (body.stop_reason === 'refusal') throw new Error('No se pudo leer el comprobante. Prueba con otra captura o anótalo a mano.');
  if (body.stop_reason === 'max_tokens') throw new Error('El comprobante es demasiado largo: súbelo en partes.');
  var txt = (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  var r = JSON.parse(txt);
  (r.compras || []).forEach(function (c) {
    // el retiro propuesto tiene que existir de verdad en la lista; si no, se deja sin asignar
    var ok = pend.some(function (p) { return p.fecha === c.retiro_fecha && Math.abs(p.monto - c.retiro_monto) < 0.01; });
    if (!ok) { c.retiro_fecha = ''; c.retiro_monto = 0; }
  });
  return { compras: r.compras || [], pendientes: pend, archivos: guardados };
}

