/**
 * MarketingDatos.gs — capa de datos del módulo Marketing.
 *
 * La UI (Marketing.html) llama a estas funciones con google.script.run, en vez
 * del fetch con token que usaba el artefacto Cowork. Eso arregla el sync que el
 * sandbox bloqueaba: misma sesión de Google, sin token, sin CORS.
 *
 * Fuente: Sheet "Rosanta Marketing OS". El esquema es el mismo que el Code.gs
 * de ese proyecto — si cambia allá, cambia aquí.
 */

var MKT_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';

var SCHEMA = {
  calendario:    ['id','date','title','tipo','eje','estado','canal','notas','contenido','hook','stdc','metrica','utm','embudo','formato','uso'],
  calendario_versiones: ['version','snapshot','id','date','title','tipo','eje','estado','canal','notas','contenido','hook','stdc','metrica','utm','embudo','formato','uso'],
  piezas:        ['id','name','score','total','fecha'],
  carritos:      ['id','fecha','nombre','canal','valor','estado','consentimiento','contacto'],
  /* comensales/comensalesReserva/ticket/clientes_nuevos van AL FINAL a propósito:
     mktRead mapea por posición y las columnas originales ya existen en la Sheet en
     este orden. clientes_nuevos la llena solo el script de Wix (primeras reservas). */
  pauta_semanal: ['wk','gCosto','gClics','gImp','mCosto','mAlcance','reservas','fecha_registro','comensales','comensalesReserva','ticket','clientes_nuevos'],
  aprendizajes:  ['id','fecha','fuente','hallazgo','accion'],
  propuestas:    ['id','fecha','autor','titulo','estado','contenido'],
  debates:       ['id','fecha','tema','participantes','resultado']
};

/**
 * Guard de la intranet: el permiso lo da la hoja USUARIOS, no el dominio.
 * Cada función que toca datos pasa por aquí, así que un usuario sin módulo
 * no puede leer ni escribir la Sheet aunque llame a mano.
 *
 * Dos niveles:
 *  - módulo "marketing": acceso completo a todas las pestañas.
 *  - módulo "contenido" (equipo de producción): solo calendario, piezas y
 *    aprendizajes. Pestañas de pauta/carritos quedan fuera también del lado
 *    del servidor, no solo de la vista.
 */
var TABS_CONTENIDO = { calendario: 1, piezas: 1, aprendizajes: 1 };

function requiereMarketing_(tab, auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('Tu correo no está en la hoja USUARIOS.');
  if (usuarioTieneModulo(u, 'marketing')) return u;
  if (usuarioTieneModulo(u, 'contenido')) {
    if (tab && !TABS_CONTENIDO[tab]) {
      throw new Error('Tu usuario es de contenido: acceso solo a calendario, piezas y aprendizajes.');
    }
    return u;
  }
  throw new Error('Tu usuario no tiene el módulo Marketing.');
}

/** Para servicios exclusivos de pauta (Meta, Espía, Drive, panel): solo módulo marketing. */
function requiereSoloMarketing_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('Tu correo no está en la hoja USUARIOS.');
  if (!usuarioTieneModulo(u, 'marketing')) throw new Error('Tu usuario no tiene el módulo Marketing.');
  return u;
}

/** Sólo los que pueden editar escriben. Lectura la tiene cualquiera con el módulo. */
function requiereEdicionMarketing_(tab, auth) {
  var u = requiereMarketing_(tab, auth);
  if (!u.puedeEditar) throw new Error('Tu usuario es de solo lectura.');
  return u;
}

function mktSheet_(tab) {
  var ss = SpreadsheetApp.openById(MKT_SHEET_ID);
  var sh = ss.getSheetByName(tab);
  if (!sh && SCHEMA[tab]) {
    sh = ss.insertSheet(tab);
    sh.getRange(1, 1, 1, SCHEMA[tab].length).setValues([SCHEMA[tab]]).setFontWeight('bold');
  }
  if (!sh) throw new Error('Falta la pestaña "' + tab + '" en la Sheet Marketing OS.');
  if (tab === 'calendario') calEnsureCols_(sh); // auto-alta de embudo/formato/uso
  if (tab === 'pauta_semanal') pautaEnsureCols_(sh); // auto-alta de comensales/comensalesReserva/ticket/clientes_nuevos
  return sh;
}

/* Añade las columnas nuevas de pauta_semanal (comensales, comensalesReserva,
   ticket, clientes_nuevos) sin tocar las filas de datos: solo escribe la fila 1 completa en el
   orden del SCHEMA. Las 8 columnas originales conservan su posición, así que
   los scripts externos (Google Ads, Wix) que ubican por nombre siguen igual.
   Idempotente: si ya están, no hace nada. */
function pautaEnsureCols_(sh) {
  var need = SCHEMA.pauta_semanal;
  var lastCol = sh.getLastColumn();
  var head = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
  var faltan = need.filter(function (h) { return head.indexOf(h) < 0; });
  if (!faltan.length) return;
  if (sh.getMaxColumns() < need.length) sh.insertColumnsAfter(sh.getMaxColumns(), need.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, need.length).setValues([need]).setFontWeight('bold');
}

/* Añade las columnas nuevas (embudo, formato, uso) a la pestaña calendario sin
   tocar las 11 filas aprobadas: sólo escribe la fila 1 (encabezados) y, si hace
   falta, inserta columnas. Idempotente: si ya están, no hace nada. */
function calEnsureCols_(sh) {
  var need = SCHEMA.calendario; // 16
  var lastCol = sh.getLastColumn();
  var head = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
  var faltan = need.filter(function (h) { return head.indexOf(h) < 0; });
  if (!faltan.length) return;
  if (sh.getMaxColumns() < need.length) sh.insertColumnsAfter(sh.getMaxColumns(), need.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, need.length).setValues([need]).setFontWeight('bold');
}

/* Guarda un respaldo nombrado del plan del mes antes de regenerar. Cada fila del
   snapshot lleva el nombre de versión y el timestamp; nada se borra. */
function calGuardarVersion(nombre, rows, auth) {
  requiereEdicionMarketing_('calendario', auth);
  var sh = mktSheet_('calendario_versiones');
  var head = SCHEMA.calendario_versiones;
  var ts = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var nom = String(nombre || ts);
  var data = (rows || []).map(function (r) {
    return head.map(function (h) {
      if (h === 'version') return nom;
      if (h === 'snapshot') return ts;
      return r[h] !== undefined && r[h] !== null ? r[h] : '';
    });
  });
  if (data.length) sh.getRange(sh.getLastRow() + 1, 1, data.length, head.length).setValues(data);
  return { version: nom, filas: data.length };
}

/** Las fechas viajan mal por google.script.run: las pasamos a YYYY-MM-DD. */
function mktNormalize_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd');
  return v;
}

function mktRead(tab, auth) {
  requiereMarketing_(tab, auth);
  var head = SCHEMA[tab];
  if (!head) throw new Error('Pestaña desconocida: ' + tab);
  var vals = mktSheet_(tab).getDataRange().getValues();
  if (vals.length < 2) return [];
  vals.shift();
  return vals.filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = mktNormalize_(r[i]); });
      return o;
    });
}

function mktReadAll(auth) {
  var u = requiereMarketing_(null, auth);
  var full = usuarioTieneModulo(u, 'marketing');
  var out = {};
  Object.keys(SCHEMA).forEach(function (tab) {
    if (tab === 'calendario_versiones') return; // respaldo; se lee aparte, no en cada arranque
    if (full || TABS_CONTENIDO[tab]) out[tab] = mktRead(tab, auth);
  });
  return out;
}

function mktUpsert(tab, row, auth) {
  requiereEdicionMarketing_(tab, auth);
  var head = SCHEMA[tab];
  if (!head) throw new Error('Pestaña desconocida: ' + tab);
  var key = head[0];
  if (!row[key]) row[key] = tab.slice(0, 1) + Date.now();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = mktSheet_(tab);
    var vals = sh.getDataRange().getValues();
    var idx = -1;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(row[key])) { idx = i + 1; break; }
    }
    var line = head.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    if (idx > 0) sh.getRange(idx, 1, 1, head.length).setValues([line]);
    else sh.appendRow(line);
    return { key: row[key], updated: idx > 0, row: row };
  } finally {
    lock.releaseLock();
  }
}

/** Lo que usa el auto-sync del sistema (osAutoPush -> action:'replace'). */
function mktReplace(tab, rows, auth) {
  requiereEdicionMarketing_(tab, auth);
  var head = SCHEMA[tab];
  if (!head) throw new Error('Pestaña desconocida: ' + tab);
  rows = rows || [];

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = mktSheet_(tab);
    sh.clearContents();
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    if (rows.length) {
      var data = rows.map(function (row) {
        return head.map(function (h) { return row[h] !== undefined && row[h] !== null ? row[h] : ''; });
      });
      sh.getRange(2, 1, data.length, head.length).setValues(data);
    }
    return { count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function mktDelete(tab, id, auth) {
  requiereEdicionMarketing_(tab, auth);
  if (!SCHEMA[tab]) throw new Error('Pestaña desconocida: ' + tab);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = mktSheet_(tab);
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(id)) { sh.deleteRow(i + 1); return { deleted: id }; }
    }
    return { deleted: null };
  } finally {
    lock.releaseLock();
  }
}
