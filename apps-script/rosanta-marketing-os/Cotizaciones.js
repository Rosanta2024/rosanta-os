/**
 * Cotizaciones.gs — el Pipeline de Eventos vive aquí desde el 15-oct-2026.
 *
 * Decisión de Juanma (15-oct-2026): "no debería haber nada en claude.ai". El pipeline
 * salió del artifact de claude.ai y es la pestaña `cotizaciones` de esta Sheet, fuente
 * única. La pestaña `revisiones` guarda una línea por cada revisión diaria de las 7:15.
 *
 * Quién escribe:
 *   · la intranet (Sistema de Marketing › Eventos, EventosDatos.gs), con el usuario;
 *   · la tarea `revision-diaria-cotizaciones` de la Mac, por el hook ?hook=cotizaciones
 *     de este web app, con el token COTIZ_TOKEN (Propiedades del script);
 *   · el bot puede crear la fila "consulta" (mismo formato, ver COT_COLS).
 * A propósito NO están en SCHEMA: la API general (doPost con TOKEN) no puede tocarlas.
 *
 * Cada fila es un "documento" igual al del artifact viejo: proximo_paso es {texto, fecha}
 * y historial es una lista, guardados en columnas propias / JSON. `version` sube en cada
 * escritura: quien escribe manda la versión que leyó y si cambió, no se escribe nada
 * (lo mismo que hacía if_version en el artifact). Las fechas van como TEXTO AAAA-MM-DD
 * (la hoja tiene formato de texto plano para que Sheets no las convierta).
 *
 * OJO: la intranet tiene una copia de COT_COLS y de la conversión (EventosDatos.gs).
 * Si se cambia una columna, se cambia en los dos.
 */
var COT_TAB = 'cotizaciones';
var COT_REV_TAB = 'revisiones';
var COT_COLS = ['id', 'version', 'actualizado', 'cliente', 'contacto', 'email', 'telefono', 'id_chat', 'thread_id',
  'canal', 'canal_detalle', 'primer_contacto', 'idioma', 'evento', 'fecha_consulta', 'fecha_primera_respuesta',
  'respuesta_horas', 'fecha_evento', 'pax', 'presupuesto', 'formato_menu', 'monto_q', 'monto_usd', 'opciones',
  'pdf', 'fecha_envio', 'ref', 'vence', 'etapa', 'etapa_max', 'etapa_desde', 'estado', 'toques',
  'ultimo_cliente', 'fecha_visita', 'clave', 'motivo', 'pausa_hasta', 'deposito_fecha', 'deposito_q',
  'proximo_paso_texto', 'proximo_paso_fecha', 'notas', 'historial_json', 'extra_json'];
var COT_NUM = { version: 1, respuesta_horas: 1, pax: 1, monto_q: 1, monto_usd: 1, toques: 1, deposito_q: 1 };
var COT_REV_COLS = ['fecha', 'hora', 'resumen', 'contestaron', 'borradores'];

function cotHoja_(tab, cols) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
  var faltan = cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (faltan.length) {   // columnas nuevas al final, sin mover las que existen
    sh.getRange(1, head.length + 1, sh.getMaxRows(), faltan.length).setNumberFormat('@');
    sh.getRange(1, head.length + 1, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
    head = head.concat(faltan);
  }
  return { sh: sh, head: head };
}

function cotTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

/** fila (array, con su encabezado) → documento como el del artifact */
function cotFilaADoc_(head, fila) {
  var d = {};
  head.forEach(function (h, i) {
    var v = cotTxt_(fila[i]);
    if (v === '' || h === 'historial_json' || h === 'extra_json' || h.indexOf('proximo_paso_') === 0) return;
    if (COT_NUM[h]) { var n = Number(v); d[h] = isNaN(n) ? v : n; }
    else if (h === 'clave') d[h] = v === 'true' || v === 'TRUE' || v === 'Sí';
    else d[h] = v;
  });
  var iH = head.indexOf('historial_json'), iE = head.indexOf('extra_json');
  try { d.historial = iH >= 0 && fila[iH] ? JSON.parse(fila[iH]) : []; } catch (e) { d.historial = []; }
  try { if (iE >= 0 && fila[iE]) { var x = JSON.parse(fila[iE]); Object.keys(x).forEach(function (k) { if (d[k] === undefined) d[k] = x[k]; }); } } catch (e2) {}
  var pt = cotTxt_(fila[head.indexOf('proximo_paso_texto')]), pf = cotTxt_(fila[head.indexOf('proximo_paso_fecha')]);
  if (pt || pf) d.proximo_paso = { texto: pt, fecha: pf || null };
  if (!d.version) d.version = 1;
  return d;
}

/** documento → fila. Lo que no tiene columna va a extra_json: nunca se pierde un dato. */
function cotDocAFila_(head, d) {
  var extra = {};
  Object.keys(d).forEach(function (k) {
    if (k === 'historial' || k === 'proximo_paso') return;
    if (head.indexOf(k) < 0) extra[k] = d[k];
  });
  return head.map(function (h) {
    if (h === 'historial_json') return JSON.stringify(d.historial || []);
    if (h === 'extra_json') return Object.keys(extra).length ? JSON.stringify(extra) : '';
    if (h === 'proximo_paso_texto') return d.proximo_paso && d.proximo_paso.texto ? String(d.proximo_paso.texto) : '';
    if (h === 'proximo_paso_fecha') return d.proximo_paso && d.proximo_paso.fecha ? String(d.proximo_paso.fecha) : '';
    var v = d[h];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });
}

function cotLeer_() {
  var H = cotHoja_(COT_TAB, COT_COLS);
  var n = H.sh.getLastRow() - 1;
  if (n < 1) return [];
  return H.sh.getRange(2, 1, n, H.head.length).getValues()
    .filter(function (f) { return String(f[0] || '').trim(); })
    .map(function (f) { return cotFilaADoc_(H.head, f); });
}

/**
 * writes = [{op:'set'|'update', id, data, if_version}]. Todo o nada: si una versión no
 * coincide, o un set pisa una fila que ya existe sin if_version, no se escribe ninguna.
 * Devuelve {ok, versiones:{id:v}} o {ok:false, error, id, version_actual}.
 */
function cotEscribir_(writes) {
  if (!writes || !writes.length) return { ok: true, versiones: {} };
  if (writes.length > 60) return { ok: false, error: 'Máximo 60 escrituras por vez.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'La hoja está ocupada; probá de nuevo.' };
  try {
    var H = cotHoja_(COT_TAB, COT_COLS);
    var n = H.sh.getLastRow() - 1;
    var filas = n > 0 ? H.sh.getRange(2, 1, n, H.head.length).getValues() : [];
    var pos = {};
    filas.forEach(function (f, i) { var id = String(f[0] || '').trim(); if (id) pos[id] = i; });
    var plan = [], nuevas = [], vistos = {};
    for (var w = 0; w < writes.length; w++) {
      var x = writes[w] || {}, id = String(x.id || '').trim();
      if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) return { ok: false, error: 'id inválido', id: id };
      if (vistos[id]) return { ok: false, error: 'id repetido en el lote', id: id };
      vistos[id] = 1;
      var existe = pos[id] !== undefined;
      var actual = existe ? cotFilaADoc_(H.head, filas[pos[id]]) : null;
      if (existe) {
        if (x.if_version === undefined || x.if_version === null) return { ok: false, error: 'falta if_version para una fila que ya existe', id: id, version_actual: actual.version };
        if (Number(x.if_version) !== Number(actual.version)) return { ok: false, error: 'la fila cambió; releé y rehacé el cambio', id: id, version_actual: actual.version };
      } else if (x.op === 'update') return { ok: false, error: 'update de una fila que no existe', id: id };
      var data = x.data || {};
      var doc = (x.op === 'update' && actual) ? actual : {};
      Object.keys(data).forEach(function (k) {
        if (data[k] && data[k].__delete__) delete doc[k]; else doc[k] = data[k];
      });
      doc.id = id;
      doc.version = (actual ? Number(actual.version) : 0) + 1;
      doc.actualizado = new Date().toISOString();
      var fila = cotDocAFila_(H.head, doc);
      if (existe) plan.push({ i: pos[id], fila: fila, id: id, v: doc.version });
      else nuevas.push({ fila: fila, id: id, v: doc.version });
    }
    var versiones = {};
    plan.forEach(function (p) { H.sh.getRange(p.i + 2, 1, 1, H.head.length).setValues([p.fila]); versiones[p.id] = p.v; });
    if (nuevas.length) {
      H.sh.getRange(H.sh.getLastRow() + 1, 1, nuevas.length, H.head.length).setValues(nuevas.map(function (q) { return q.fila; }));
      nuevas.forEach(function (q) { versiones[q.id] = q.v; });
    }
    SpreadsheetApp.flush();
    return { ok: true, versiones: versiones };
  } finally {
    lock.releaseLock();
  }
}

function cotRevisiones_() {
  var H = cotHoja_(COT_REV_TAB, COT_REV_COLS);
  var n = H.sh.getLastRow() - 1;
  if (n < 1) return [];
  return H.sh.getRange(2, 1, n, H.head.length).getValues().map(function (f) {
    var o = {}; H.head.forEach(function (h, i) { o[h] = cotTxt_(f[i]); }); return o;
  });
}

/** Una línea por día (la fecha es la llave: se reemplaza si ya existe). */
function cotGuardarRevision_(r) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'La hoja está ocupada.' };
  try {
    var H = cotHoja_(COT_REV_TAB, COT_REV_COLS);
    var fecha = String(r.fecha || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'fecha inválida' };
    var fila = H.head.map(function (h) {
      var v = h === 'fecha' ? fecha : r[h];
      return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    var n = H.sh.getLastRow() - 1, i = -1;
    if (n > 0) H.sh.getRange(2, 1, n, 1).getValues().forEach(function (f, k) { if (cotTxt_(f[0]) === fecha) i = k; });
    if (i >= 0) H.sh.getRange(i + 2, 1, 1, H.head.length).setValues([fila]);
    else H.sh.getRange(H.sh.getLastRow() + 1, 1, 1, H.head.length).setValues([fila]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** El hook del web app. body = {token, accion:'list'|'get'|'batch'|'revision'|'revisiones', ...} */
function cotHook_(body) {
  if (!cotTokenOk_(body.token)) return { ok: false, error: 'unauthorized' };
  var a = body.accion;
  // Con PARAMETROS › motor_eventos = base, el pipeline se guarda en el servidor nuevo: aca solo se lee
  // (19-oct-2026). cot.sh ya apunta alla; si algo llega aca igual, se niega en vez de escribir por dos lados.
  if ((a === 'batch' || a === 'revision') && cotMotor_() === 'base') {
    return { ok: false, error: 'El pipeline se mudó al servidor nuevo: la revision diaria tiene que usar la direccion nueva (cot.sh).' };
  }
  if (a === 'list') return { ok: true, filas: cotLeer_() };
  if (a === 'get') {
    var f = cotLeer_().filter(function (d) { return d.id === body.id; })[0];
    return f ? { ok: true, fila: f } : { ok: false, error: 'no existe', id: body.id };
  }
  if (a === 'batch') return cotEscribir_(body.writes);
  if (a === 'revision') return cotGuardarRevision_(body.revision || {});
  if (a === 'revisiones') return { ok: true, revisiones: cotRevisiones_() };
  return { ok: false, error: 'acción desconocida' };
}

/** PARAMETROS › motor_eventos de Rosanta_Intranet_Config ('base' o 'sheets'; 1 minuto de cache). */
var COT_CONFIG_ID = '1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw';
function cotMotor_() {
  var cache = CacheService.getScriptCache(), g = null;
  try { g = cache.get('cot_motor_v1'); } catch (e) { g = null; }
  if (g === 'base' || g === 'sheets') return g;
  var m = 'sheets';
  try {
    var v = SpreadsheetApp.openById(COT_CONFIG_ID).getSheetByName('PARAMETROS').getDataRange().getValues();
    for (var i = 1; i < v.length; i++) if (String(v[i][0] || '').trim().toLowerCase() === 'motor_eventos') { m = String(v[i][1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets'; break; }
  } catch (e) { m = 'sheets'; }
  try { cache.put('cot_motor_v1', m, 60); } catch (e) { /* sin cache */ }
  return m;
}

/**
 * Token de cotizaciones (rotacion del 21-oct-2026, decision de Juanma). COTIZ_TOKEN es el vigente; el
 * anterior (COTIZ_TOKEN_VIEJO) sigue sirviendo hasta COTIZ_TOKEN_VIEJO_HASTA (AAAA-MM-DD) para que la
 * revision diaria no se corte si corre en medio del cambio; vencido, se borra solo. La rotacion se hizo
 * con una accion de una sola vez ya retirada. Ningun valor vive en el codigo ni en logs.
 */
function cotTokenOk_(t) {
  t = String(t || '');
  var P = PropertiesService.getScriptProperties();
  var tok = String(P.getProperty('COTIZ_TOKEN') || '');
  if (tok.length >= 24 && t === tok) return true;
  var viejo = String(P.getProperty('COTIZ_TOKEN_VIEJO') || ''), hasta = String(P.getProperty('COTIZ_TOKEN_VIEJO_HASTA') || '');
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  if (hasta && hoy > hasta) {   // vencido: se borra solo (no queda el valor viejo guardado)
    P.deleteProperty('COTIZ_TOKEN_VIEJO'); P.deleteProperty('COTIZ_TOKEN_VIEJO_HASTA');
    return false;
  }
  return viejo.length >= 24 && !!hasta && hoy <= hasta && t === viejo;
}

