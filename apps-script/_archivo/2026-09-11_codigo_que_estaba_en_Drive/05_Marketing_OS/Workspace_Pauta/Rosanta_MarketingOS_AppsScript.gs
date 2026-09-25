/**
 * ROSANTA MARKETING OS — Capa de datos + Webhook de carritos
 * Fuente única de verdad del Sistema de Marketing (calendario, piezas,
 * carritos, pauta semanal, aprendizajes) + recepción automática de carritos
 * abandonados de SonTickets con reenvío opcional a Meta CAPI.
 *
 * Sheet: "Rosanta Marketing OS"
 * ID:    1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc
 *
 * DESPLIEGUE (una sola vez, ~5 min):
 *  1. En la Sheet: Extensiones > Apps Script. Pega este archivo completo.
 *  2. Cambia TOKEN por tu clave (ya está: rosanta2026xy).
 *  3. Ejecuta setup() una vez. Autoriza. Crea las 5 pestañas.
 *  4. Implementar > Nueva implementación > Aplicación web.
 *       - Ejecutar como: Yo (restaurante@rosanta.rest)
 *       - Quién tiene acceso: Cualquier usuario
 *     Copia la URL /exec.
 *  5. Cada cambio de código futuro: Implementar > Gestionar implementaciones >
 *     editar (lápiz) > Versión: Nueva versión > Implementar.  (Sin esto, el
 *     Web App sigue corriendo el código viejo.)
 *
 * WEBHOOK DE CARRITOS (SonTickets o Make/Zapier):
 *   Apunta el webhook a:  <URL /exec>?token=rosanta2026xy&hook=sontickets
 *   Método POST, cuerpo JSON con el carrito abandonado. El receptor mapea
 *   nombre, email, telefono, fecha y valor de forma flexible.
 *
 * META CAPI (opcional, para recuperar carritos como Custom Audience/eventos):
 *   Para activarlo, en Apps Script: Configuración del proyecto > Propiedades del
 *   script > agrega META_CAPI_TOKEN = <access token de sistema con ads_management>.
 *   El dataset ya está fijado abajo (Rosanta Reservas). Sin ese token, el carrito
 *   igual se guarda en la Sheet; solo se omite el envío a Meta.
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TOKEN    = 'rosanta2026xy';
var META_DATASET_ID = '1107259034759950'; // Rosanta Reservas

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

/** GET ?token=...&tab=calendario  -> filas como JSON */
function doGet(e) {
  try {
    if (e.parameter.token !== TOKEN) return json({error:'unauthorized'});
    var tab = e.parameter.tab;
    if (!SCHEMA[tab]) return json({error:'tab desconocida'});
    return json({tab:tab, rows:readTab(tab)});
  } catch(err){ return json({error:String(err)}); }
}

/**
 * POST. Dos usos:
 *  A) API del sistema: body {token, tab, action:"upsert|delete|replace", row|rows|id}
 *  B) Webhook de carritos: URL ...?token=...&hook=sontickets  + body JSON del carrito
 */
function doPost(e) {
  try {
    var qToken = e.parameter.token;
    var body = {};
    try { body = JSON.parse(e.postData.contents || '{}'); } catch(_) {}

    // --- Webhook de carritos ---
    if (e.parameter.hook === 'sontickets') {
      if (qToken !== TOKEN) return json({error:'unauthorized'});
      return json(intakeCarrito(body));
    }

    // --- API del sistema ---
    if (body.token !== TOKEN) return json({error:'unauthorized'});
    var tab = body.tab;
    if (!SCHEMA[tab]) return json({error:'tab desconocida'});
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    var out;
    if (body.action === 'delete')       out = del(tab, body.id);
    else if (body.action === 'replace') out = replaceAll(tab, body.rows||[]);
    else                                out = upsert(tab, body.row||{});
    lock.releaseLock();
    return json({ok:true, result:out});
  } catch(err){ return json({error:String(err)}); }
}

/** Mapea un carrito de SonTickets/Make a la pestaña carritos (+ CAPI opcional). */
function intakeCarrito(p) {
  var pick = function(keys){ for (var i=0;i<keys.length;i++){ var v=deepGet(p,keys[i]); if (v!==undefined && v!==null && v!=='') return v; } return ''; };
  var nombre = String(pick(['nombre','name','first_name','customer_name','cliente','contact.name'])).trim();
  var email  = String(pick(['email','correo','contact.email','customer_email'])).trim().toLowerCase();
  var tel    = String(pick(['telefono','phone','celular','contact.phone','customer_phone'])).trim();
  var valor  = Number(pick(['valor','value','total','amount','monto'])) || 0;
  var fechaR = String(pick(['fecha','date','created_at','timestamp'])) || new Date().toISOString().slice(0,10);
  var canal  = tel ? 'WhatsApp' : (email ? 'Email' : 'SonTickets');

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var row = { id:'c'+Date.now(), fecha:String(fechaR).slice(0,10), nombre:nombre||'(sin nombre)', canal:canal, valor:valor, estado:'Pendiente' };
  upsert('carritos', row);
  lock.releaseLock();

  var capi = sendToCAPI(email, tel, valor);
  return { ok:true, carrito:row.id, capi:capi };
}

/** Envía evento AddToCart a Meta CAPI si hay token en Propiedades del script. */
function sendToCAPI(email, tel, valor) {
  var tok = PropertiesService.getScriptProperties().getProperty('META_CAPI_TOKEN');
  if (!tok) return 'omitido (sin META_CAPI_TOKEN)';
  try {
    var ud = {};
    if (email) ud.em = [sha256(email)];
    if (tel)   ud.ph = [sha256(tel.replace(/[^0-9]/g,''))];
    var payload = { data:[{
      event_name:'AddToCart', event_time:Math.floor(Date.now()/1000),
      action_source:'system_generated', user_data:ud,
      custom_data:{ currency:'GTQ', value:valor }
    }]};
    var res = UrlFetchApp.fetch(
      'https://graph.facebook.com/v19.0/'+META_DATASET_ID+'/events?access_token='+encodeURIComponent(tok),
      { method:'post', contentType:'application/json', payload:JSON.stringify(payload), muteHttpExceptions:true });
    return res.getResponseCode()===200 ? 'enviado' : ('error '+res.getResponseCode());
  } catch(err){ return 'error '+err; }
}

// ---------- helpers ----------
function deepGet(o, path){ return path.split('.').reduce(function(a,k){ return (a&&a[k]!==undefined)?a[k]:undefined; }, o); }
function sha256(s){
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
}
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
  var key = head[0];
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
