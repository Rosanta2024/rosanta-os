/**
 * ROSANTA MARKETING OS — Capa de datos
 * Fuente única de verdad para el Sistema de Marketing (calendario, piezas,
 * carritos, pauta semanal, aprendizajes). Sirve como API JSON de lectura/
 * escritura para el artefacto y, luego, para la intranet.
 *
 * Sheet: "Rosanta Marketing OS"
 * ID:    1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc
 *
 * DESPLIEGUE (una sola vez, ~5 min):
 *  1. En la Sheet: Extensiones > Apps Script. Pega este archivo completo.
 *  2. Cambia TOKEN por una clave propia (cualquier texto secreto).
 *  3. Ejecuta la función setup() una vez (Ejecutar). Autoriza los permisos.
 *     Esto crea las 5 pestañas con sus encabezados.
 *  4. Implementar > Nueva implementación > Aplicación web.
 *       - Ejecutar como: Yo (restaurante@rosanta.rest)
 *       - Quién tiene acceso: Cualquier usuario
 *     Copia la URL /exec. Esa URL + el TOKEN se pegan en el artefacto (pestaña Datos).
 *  5. Cada cambio de código futuro requiere "Implementar > Gestionar > Nueva versión".
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TOKEN    = 'rosanta2026xy'; // <-- pon tu clave secreta

// Modelo de datos: pestaña -> columnas (deben coincidir con el artefacto)
var SCHEMA = {
  calendario:    ['id','date','title','tipo','eje','estado','canal','notas','contenido'],
  piezas:        ['id','name','score','total','fecha'],
  carritos:      ['id','fecha','nombre','canal','valor','estado'],
  pauta_semanal: ['wk','gCosto','gClics','gImp','mCosto','mAlcance','reservas','fecha_registro'],
  aprendizajes:  ['id','fecha','fuente','hallazgo','accion']
};

/** Crea las pestañas con encabezados. Ejecutar una vez. */
function setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Object.keys(SCHEMA).forEach(function(tab){
    var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
    sh.clear();
    sh.getRange(1,1,1,SCHEMA[tab].length).setValues([SCHEMA[tab]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}

/** GET ?token=...&tab=calendario  -> devuelve las filas como JSON */
function doGet(e) {
  try {
    if (e.parameter.token !== TOKEN) return json({error:'unauthorized'});
    var tab = e.parameter.tab;
    if (!SCHEMA[tab]) return json({error:'tab desconocida'});
    return json({tab:tab, rows:readTab(tab)});
  } catch(err){ return json({error:String(err)}); }
}

/**
 * POST body JSON: { token, tab, action, row?, id? }
 *  action = "upsert" (crea o actualiza por id) | "delete" (por id) | "replace" (reemplaza toda la pestaña con rows[])
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== TOKEN) return json({error:'unauthorized'});
    var tab = body.tab;
    if (!SCHEMA[tab]) return json({error:'tab desconocida'});
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    var out;
    if (body.action === 'delete')      out = del(tab, body.id);
    else if (body.action === 'replace') out = replaceAll(tab, body.rows||[]);
    else                                out = upsert(tab, body.row||{});
    lock.releaseLock();
    return json({ok:true, result:out});
  } catch(err){ return json({error:String(err)}); }
}

// ---------- helpers ----------
function readTab(tab){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
  var vals = sh.getDataRange().getValues();
  var head = vals.shift();
  return vals.filter(function(r){return r.join('')!=='';}).map(function(r){
    var o={}; head.forEach(function(h,i){o[h]=r[i];}); return o;
  });
}
function upsert(tab, row){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
  var head = SCHEMA[tab];
  var key = head[0]; // primera columna es la clave (id/wk/name)
  var vals = sh.getDataRange().getValues(); var idx=-1;
  for (var i=1;i<vals.length;i++){ if (String(vals[i][0])===String(row[key])){ idx=i+1; break; } }
  var line = head.map(function(h){ return row[h]!==undefined? row[h] : ''; });
  if (idx>0) sh.getRange(idx,1,1,head.length).setValues([line]);
  else sh.appendRow(line);
  return {key:row[key], updated: idx>0};
}
function del(tab, id){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
  var vals = sh.getDataRange().getValues();
  for (var i=1;i<vals.length;i++){ if (String(vals[i][0])===String(id)){ sh.deleteRow(i+1); return {deleted:id}; } }
  return {deleted:null};
}
function replaceAll(tab, rows){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
  var head = SCHEMA[tab];
  sh.clearContents();
  sh.getRange(1,1,1,head.length).setValues([head]).setFontWeight('bold');
  if (rows.length){
    var data = rows.map(function(row){ return head.map(function(h){ return row[h]!==undefined?row[h]:''; }); });
    sh.getRange(2,1,data.length,head.length).setValues(data);
  }
  return {count:rows.length};
}
function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
} 