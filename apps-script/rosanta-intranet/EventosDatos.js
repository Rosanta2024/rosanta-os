/**
 * EventosDatos.gs — Sistema de Marketing › Eventos (Pipeline de Eventos), 15-oct-2026.
 *
 * El pipeline vive en Rosanta Marketing OS › cotizaciones (antes, en un artifact de
 * claude.ai; decisión de Juanma del 15-oct-2026). Esta capa lee y escribe esa pestaña
 * para la pantalla EventosVista. Es COPIA de Cotizaciones.gs del Marketing OS (que
 * atiende a la revisión diaria de la Mac por su web app): mismas columnas, misma
 * conversión fila <-> documento y misma regla de versión. Si se cambia una columna,
 * se cambia en los dos.
 */

/** Rol dueño o módulo marketing (no "contenido": el pipeline tiene montos y clientes). */
function requiereEventos_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  if (String(u.rol || '').toLowerCase() !== 'dueno' && !usuarioTieneModulo(u, 'marketing'))
    throw new Error('Eventos es para el módulo de marketing.');
  return u;
}

function getEventos(auth) {
  requiereEventos_(auth);
  return { ok: true, filas: evLeer_(), revisiones: evRevisiones_() };
}

/** writes = [{op:'set'|'update', id, data, if_version}]. Devuelve la lista fresca. */
function guardarEventos(auth, writes) {
  var u = requiereEventos_(auth);
  if (!u.puedeEditar && String(u.rol || '').toLowerCase() !== 'dueno') throw new Error('Tu usuario es de solo lectura.');
  var r = evEscribir_(writes);
  if (!r.ok) return r;
  return { ok: true, versiones: r.versiones, filas: evLeer_(), revisiones: evRevisiones_() };
}

var EV_TAB = 'cotizaciones';
var EV_REV_TAB = 'revisiones';
var EV_COLS = ['id', 'version', 'actualizado', 'cliente', 'contacto', 'email', 'telefono', 'id_chat', 'thread_id',
  'canal', 'canal_detalle', 'primer_contacto', 'idioma', 'evento', 'fecha_consulta', 'fecha_primera_respuesta',
  'respuesta_horas', 'fecha_evento', 'pax', 'presupuesto', 'formato_menu', 'monto_q', 'monto_usd', 'opciones',
  'pdf', 'fecha_envio', 'ref', 'vence', 'etapa', 'etapa_max', 'etapa_desde', 'estado', 'toques',
  'ultimo_cliente', 'fecha_visita', 'clave', 'motivo', 'pausa_hasta', 'deposito_fecha', 'deposito_q',
  'proximo_paso_texto', 'proximo_paso_fecha', 'notas', 'historial_json', 'extra_json'];
var EV_NUM = { version: 1, respuesta_horas: 1, pax: 1, monto_q: 1, monto_usd: 1, toques: 1, deposito_q: 1 };
var EV_REV_COLS = ['fecha', 'hora', 'resumen', 'contestaron', 'borradores'];

function evHoja_(tab, cols) {
  var ss = SpreadsheetApp.openById(MKT_SHEET_ID);
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

function evTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

/** fila (array, con su encabezado) → documento como el del artifact */
function evFilaADoc_(head, fila) {
  var d = {};
  head.forEach(function (h, i) {
    var v = evTxt_(fila[i]);
    if (v === '' || h === 'historial_json' || h === 'extra_json' || h.indexOf('proximo_paso_') === 0) return;
    if (EV_NUM[h]) { var n = Number(v); d[h] = isNaN(n) ? v : n; }
    else if (h === 'clave') d[h] = v === 'true' || v === 'TRUE' || v === 'Sí';
    else d[h] = v;
  });
  var iH = head.indexOf('historial_json'), iE = head.indexOf('extra_json');
  try { d.historial = iH >= 0 && fila[iH] ? JSON.parse(fila[iH]) : []; } catch (e) { d.historial = []; }
  try { if (iE >= 0 && fila[iE]) { var x = JSON.parse(fila[iE]); Object.keys(x).forEach(function (k) { if (d[k] === undefined) d[k] = x[k]; }); } } catch (e2) {}
  var pt = evTxt_(fila[head.indexOf('proximo_paso_texto')]), pf = evTxt_(fila[head.indexOf('proximo_paso_fecha')]);
  if (pt || pf) d.proximo_paso = { texto: pt, fecha: pf || null };
  if (!d.version) d.version = 1;
  return d;
}

/** documento → fila. Lo que no tiene columna va a extra_json: nunca se pierde un dato. */
function evDocAFila_(head, d) {
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

function evLeer_() {
  var H = evHoja_(EV_TAB, EV_COLS);
  var n = H.sh.getLastRow() - 1;
  if (n < 1) return [];
  return H.sh.getRange(2, 1, n, H.head.length).getValues()
    .filter(function (f) { return String(f[0] || '').trim(); })
    .map(function (f) { return evFilaADoc_(H.head, f); });
}

/**
 * writes = [{op:'set'|'update', id, data, if_version}]. Todo o nada: si una versión no
 * coincide, o un set pisa una fila que ya existe sin if_version, no se escribe ninguna.
 * Devuelve {ok, versiones:{id:v}} o {ok:false, error, id, version_actual}.
 */
function evEscribir_(writes) {
  if (!writes || !writes.length) return { ok: true, versiones: {} };
  if (writes.length > 60) return { ok: false, error: 'Máximo 60 escrituras por vez.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'La hoja está ocupada; probá de nuevo.' };
  try {
    var H = evHoja_(EV_TAB, EV_COLS);
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
      var actual = existe ? evFilaADoc_(H.head, filas[pos[id]]) : null;
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
      var fila = evDocAFila_(H.head, doc);
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

function evRevisiones_() {
  var H = evHoja_(EV_REV_TAB, EV_REV_COLS);
  var n = H.sh.getLastRow() - 1;
  if (n < 1) return [];
  return H.sh.getRange(2, 1, n, H.head.length).getValues().map(function (f) {
    var o = {}; H.head.forEach(function (h, i) { o[h] = evTxt_(f[i]); }); return o;
  });
}

/** Una línea por día (la fecha es la llave: se reemplaza si ya existe). */
function evGuardarRevision_(r) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'La hoja está ocupada.' };
  try {
    var H = evHoja_(EV_REV_TAB, EV_REV_COLS);
    var fecha = String(r.fecha || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'fecha inválida' };
    var fila = H.head.map(function (h) {
      var v = h === 'fecha' ? fecha : r[h];
      return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    var n = H.sh.getLastRow() - 1, i = -1;
    if (n > 0) H.sh.getRange(2, 1, n, 1).getValues().forEach(function (f, k) { if (evTxt_(f[0]) === fecha) i = k; });
    if (i >= 0) H.sh.getRange(i + 2, 1, 1, H.head.length).setValues([fila]);
    else H.sh.getRange(H.sh.getLastRow() + 1, 1, 1, H.head.length).setValues([fila]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

