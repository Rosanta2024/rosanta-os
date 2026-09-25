/**
 * ROSANTA MARKETING OS — Capa de datos + Webhooks  · v3 (4-ago-2026)
 *
 * CAMBIOS v3 (reparación, 4-ago-2026):
 *  Al desplegar la v2 se perdieron tres cosas que la v1 sí tenía. Se restauran:
 *   1. SCHEMA.reservas — había desaparecido por completo. Sin ella, upsert()
 *      sobre "reservas" revienta y el webhook de reservas no puede guardar.
 *   2. La rama hook === 'reserva' dentro de doPost. Sin ella, Wix mandaba la
 *      reserva, el script contestaba otra cosa y nadie la guardaba. El circuito
 *      estuvo roto desde el despliegue de la v2 hasta esta versión.
 *   3. SCHEMA.carritos volvió de 6 a 8 columnas, e intakeCarrito vuelve a
 *      escribir "consentimiento" y "contacto". Sin "contacto", sincronizarCRM
 *      descarta el carrito y la recuperación se va a cero en silencio.
 *   4. El hook de carritos se llama 'carrito'. Antes se llamaba 'sontickets',
 *      nombre heredado de un sistema descontinuado. Al cambiarlo hay que
 *      cambiar TAMBIÉN la línea 11 del snippet de WIX, o los carritos se
 *      pierden sin dejar rastro.
 *
 *  OJO al tocar este archivo: doPost atiende DOS webhooks vivos, carritos y
 *  reservas, y el SCHEMA de esas dos pestañas no se toca.
 *
 * CAMBIOS v2 (ajustes del Panel de Asesores + AI CMO, 4-ago-2026):
 *  - La pestaña calendario gana 4 columnas: hook, stdc, metrica, utm.
 *      hook    = primer segundo literal del video (qué se ve + subtítulo)
 *      stdc    = intención See / Think / Do (marco de Avinash Kaushik)
 *      metrica = métrica objetivo de la pieza
 *      utm     = link de reserva con UTM (obligatorio en piezas VENTA)
 *  - Función cargarCalendario311(): carga las 10 piezas del ciclo 3-1-1 de
 *    agosto + 1 pieza banco ("4.9 con 401") + 2 aprendizajes del panel.
 *    Ejecutar UNA vez desde el editor. Re-ejecutar es seguro (upsert por id).
 *
 * GATE DE PUBLICACIÓN (regla de la casa desde 4-ago-2026):
 *    Una pieza pasa de "Idea" a "Lista" solo con hook, stdc y metrica llenas.
 *    Las piezas VENTA además necesitan la columna utm escrita.
 *
 * Sheet: "Rosanta Marketing OS"
 * ID:    1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc
 *
 * DESPLIEGUE DE ESTA VERSIÓN:
 *  1. Pega este archivo completo sobre el Code.gs existente. Guarda (⌘S).
 *  2. Implementar > Gestionar implementaciones > lápiz de la implementación
 *     QUE YA EXISTE > Versión: Nueva versión > Implementar.
 *     JAMÁS crear una implementación nueva: cambia el URL /exec y deja muertos
 *     el snippet de carritos de WIX y el webhook de reservas.
 *  3. Enseguida, cambiar la línea 11 del snippet de WIX a hook=carrito.
 *
 * ⚠️ JAMÁS ejecutar setup(): borra el contenido de TODAS las pestañas
 *    (incluye carritos y reservas). Solo era para la instalación inicial.
 *
 * WEBHOOK DE CARRITOS (WIX):     <URL /exec>?token=rosanta2026xy&hook=carrito
 * WEBHOOK DE RESERVAS (Wix Velo): <URL /exec>?token=rosanta2026xy&hook=reserva
 *    Lo llama backend/crmReservas.js del sitio de Wix. Entra por intakeReserva(),
 *    que vive en CRMSync.gs, mismo proyecto.
 * META CAPI: Script Property META_CAPI_TOKEN (igual que v1).
 */

var SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
var TOKEN    = 'rosanta2026xy';
var META_DATASET_ID = '1107259034759950'; // Rosanta Reservas

var SCHEMA = {
  calendario:    ['id','date','title','tipo','eje','estado','canal','notas','contenido','hook','stdc','metrica','utm'],
  piezas:        ['id','name','score','total','fecha'],
  carritos:      ['id','fecha','nombre','canal','valor','estado','consentimiento','contacto'],
  reservas:      ['id','fecha','nombre','email','telefono','personas','gasto','estado','optin'],
  pauta_semanal: ['wk','gCosto','gClics','gImp','mCosto','mAlcance','reservas','fecha_registro'],
  aprendizajes:  ['id','fecha','fuente','hallazgo','accion']
};

/* ================================================================
 * CARGA DEL CICLO 3-1-1 · AGOSTO 2026  (ejecutar una vez)
 * ================================================================ */

var UTM_BASE = 'https://rosanta.rest/reservas?utm_source=instagram&utm_medium=organic_social&utm_campaign=311_agosto2026&utm_content=';

var ROWS_311 = [
  { id:'cal-2026-01', date:'2026-08-07', title:'Bajando del Cerro de la Cruz', tipo:'VALOR', eje:'Ambientes', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo A] Anclaje geográfico. La calle por donde todos bajan del mirador es la de Rosanta, y el atardecer cae justo cuando arranca el servicio. 14 min, 800 m, 1a Avenida Norte. Video 9:16, subtítulos, branding en los primeros 3 s, CTA final.',
    hook:'Se ve: bajada del Cerro por 1a Avenida Norte al atardecer, cámara al hombro, wordmark en esquina. Subtítulo literal: "Esta bajada termina en una mesa".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-02', date:'2026-08-11', title:'El cóctel se sienta a la mesa', tipo:'VALOR', eje:'Gastrococtelería', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo A] Un maridaje concreto: plato y trago de igual a igual. Filo 4 de la marca. Video 9:16, subtítulos, branding 3 s, CTA final.',
    hook:'Se ve: cenital, el cóctel aterriza junto al plato como un comensal más. Subtítulo literal: "Este trago pidió silla".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-03', date:'2026-08-14', title:'Qué del huerto quieren de vuelta', tipo:'COMUNIDAD', eje:'Comunidad', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo A] Pregunta abierta sobre la carta que viene. Busca respuesta, no alcance. CTA suave a base propia: quien comenta recibe aviso por WhatsApp cuando su platillo vuelva a la carta.',
    hook:'Se ve: manos cortando hierbas en el huerto, corte a cámara. Subtítulo literal: "¿Qué del huerto quieres de vuelta en la carta?".',
    stdc:'Think', metrica:'Comentarios + guardados/compartidos por alcance ≥ promedio del mes' },

  { id:'cal-2026-04', date:'2026-08-18', title:'El productor con nombre', tipo:'VALOR', eje:'Cocina con corazón', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo A] De dónde viene un ingrediente de esta semana. Filo: lo local es real, con nombre. Video 9:16, subtítulos, branding 3 s, CTA final.',
    hook:'Se ve: primer plano de las manos del productor entregando la caja. Subtítulo literal: "Este ingrediente tiene nombre y apellido".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-05', date:'2026-08-21', title:'La reserva del fin de semana', tipo:'VENTA', eje:'Eventos', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo A] Post de venta del ciclo A. Evento más próximo o mesa del fin de semana. Link directo a reservas, cero "escríbenos" (ajuste Hormozi). GATE: sin utm escrita, sigue en Idea.',
    hook:'Se ve: mesa lista en el jardín con luz de tarde, sillas esperando. Subtítulo literal: "Tu sábado ya tiene lugar".',
    stdc:'Do', metrica:'Clics al link UTM · reservas atribuidas',
    utm: UTM_BASE + 'cal-2026-05' },

  { id:'cal-2026-06', date:'2026-08-25', title:'Qué significa 14·91', tipo:'VALOR', eje:'Educativo', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo B] La coordenada, o la historia de la leña: gravilea del cafetal, no cafeto. Dato exacto, suma credibilidad. Video 9:16, subtítulos, branding 3 s, CTA final.',
    hook:'Se ve: macro del sello 14·91 en el plato, zoom out lento. Subtítulo literal: "Este número va en cada plato y casi nadie sabe qué significa".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-07', date:'2026-08-28', title:'La fogata', tipo:'VALOR', eje:'Ambientes', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo B] El fuego que los clientes sí mencionan en reseñas. La parrilla de leña de café viene detrás, es concepto nuevo. Video 9:16, subtítulos, branding 3 s, CTA final.',
    hook:'Se ve: chispa encendiendo la fogata en cámara lenta, oscuridad alrededor. Subtítulo literal: "El fuego que aparece en tus reseñas".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-08', date:'2026-09-01', title:'Una reseña real, con permiso', tipo:'COMUNIDAD', eje:'Comunidad', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo B] Estrena el eje de reseñas: VIDEO-TESTIMONIO con permiso. Concepto separado del carrusel "4.9 con 401" (cal-2026-11) por regla Andromeda: material distinto, jamás el mismo video con otro gancho. Al pedir permiso, capturar email/WhatsApp para la base propia (ajuste Rev). CTA suave a base propia.',
    hook:'Se ve: la persona de la reseña en su mesa, frente a cámara; su reseña escrita entra como texto. Subtítulo literal: "Dejó una de las 401 reseñas. Hoy la cuenta en persona".',
    stdc:'Think', metrica:'Guardados + compartidos por alcance ≥ promedio del mes' },

  { id:'cal-2026-09', date:'2026-09-04', title:'Detrás de cámaras del huerto', tipo:'VALOR', eje:'Cocina con corazón', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo B] El día que se corta. Prueba visual del farm to table. Video 9:16, subtítulos, branding 3 s, CTA final.',
    hook:'Se ve: tijera cortando la primera hoja del día, 6 am, rocío en la hoja. Subtítulo literal: "Cortado hoy, servido hoy".',
    stdc:'See', metrica:'Hook rate ≥40% · retención ≥10%' },

  { id:'cal-2026-10', date:'2026-09-08', title:'La carta se movió con la temporada', tipo:'VENTA', eje:'Gastrococtelería', estado:'Idea', canal:'Instagram',
    notas:'[Ciclo B] Post de venta del ciclo B. La razón concreta para volver un martes. Link directo a reservas, cero "escríbenos". GATE: sin utm escrita, sigue en Idea.',
    hook:'Se ve: plato nuevo entrando al pase, vapor subiendo. Subtítulo literal: "La carta cambió y tu martes tiene plan".',
    stdc:'Do', metrica:'Clics al link UTM · reservas atribuidas',
    utm: UTM_BASE + 'cal-2026-10' },

  { id:'cal-2026-11', date:'', title:'4.9 con 401 reseñas (carrusel del logro)', tipo:'COMUNIDAD', eje:'Comunidad', estado:'Idea', canal:'Instagram',
    notas:'[Banco] Pieza FUERA del ciclo 3-1-1, sin fecha. Segundo concepto del eje de reseñas, separado del video-testimonio (cal-2026-08) por regla Andromeda: nace como material distinto para diversificación creativa el día que las reseñas se amplifiquen a pauta.',
    hook:'Slide 1: número 4.9 gigante sobre foto del jardín. Texto literal: "401 personas dejaron esto en 4.9".',
    stdc:'Think', metrica:'Guardados + compartidos por alcance ≥ promedio del mes' }
];

var APRENDIZAJES_PANEL = [
  { id:'ap-2026-08-04a', fecha:'2026-08-04', fuente:'Panel de Asesores + AI CMO',
    hallazgo:'Gate de publicación: una pieza pasa de Idea a Lista solo con hook (primer segundo literal), stdc y metrica llenas; VENTA además con utm escrita en el Sheet. Métricas por tipo: VALOR→See (hook rate ≥40%, retención ≥10%), COMUNIDAD→Think (guardados/compartidos por alcance), VENTA→Do (clics UTM, reservas atribuidas).',
    accion:'Aplicado al calendario 3-1-1 de agosto (11 filas, 4 columnas nuevas). Revisar en 30 días quién tenía razón: Savannah (hook), Kaushik (UTM), Rev (reseña #8), Ritson (60/40 si reservas planas vs julio).' },
  { id:'ap-2026-08-04b', fecha:'2026-08-04', fuente:'Panel de Asesores (lente Loomer + Rev)',
    hallazgo:'Reseñas = dos conceptos separados: video-testimonio (cal-2026-08) y carrusel del logro 4.9 con 401 (cal-2026-11). Regla Andromeda: jamás el mismo material con otro gancho. Al pedir permiso a los clientes, capturar email/WhatsApp: un movimiento, dos activos.',
    accion:'Producir como materiales distintos. Pedir permiso a 3-4 clientes de las 401 reseñas esta semana (depende de terceros, arranca ya).' }
];

/** Amplía la pestaña calendario a 13 columnas y carga las 11 piezas + 2 aprendizajes. */
function cargarCalendario311() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName('calendario');
  var head = SCHEMA.calendario;
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1,1,1,head.length).setValues([head]).setFontWeight('bold');
  sh.setFrozenRows(1);
  ROWS_311.forEach(function(r){ upsert('calendario', r); });
  APRENDIZAJES_PANEL.forEach(function(r){ upsert('aprendizajes', r); });
  Logger.log('OK: ' + ROWS_311.length + ' piezas en calendario + ' + APRENDIZAJES_PANEL.length + ' aprendizajes.');
}

/* ================================================================
 * A PARTIR DE AQUÍ, IGUAL QUE v1
 * ================================================================ */

/** Crea las pestañas con encabezados. ⚠️ BORRA TODO. Solo instalación inicial. */
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
 * POST. Tres usos:
 *  A) API del sistema: body {token, tab, action:"upsert|delete|replace", row|rows|id}
 *  B) Webhook de carritos: URL ...?token=...&hook=carrito  + body JSON del carrito
 *  C) Webhook de reservas: URL ...?token=...&hook=reserva  + body JSON de la reserva
 */
function doPost(e) {
  try {
    var qToken = e.parameter.token;
    var body = {};
    try { body = JSON.parse(e.postData.contents || '{}'); } catch(_) {}

    // --- Webhook de carritos ---
    // Lo llama el snippet del formulario de WIX (Carritos_WIX_Snippet.html).
    if (e.parameter.hook === 'carrito' || e.parameter.hook === 'sontickets') {
      if (qToken !== TOKEN) return json({error:'unauthorized'});
      return json(intakeCarrito(body));
    }

    // --- Webhook de reservas ---
    // Lo llama backend/crmReservas.js del sitio de Wix. intakeReserva() vive
    // en CRMSync.gs, mismo proyecto.
    if (e.parameter.hook === 'reserva') {
      if (qToken !== TOKEN) return json({error:'unauthorized'});
      return json(intakeReserva(body));
    }
// --- Hook desconocido: no morir en silencio ---
    if (e.parameter.hook) {
      Logger.log('HOOK DESCONOCIDO: ' + e.parameter.hook +
                 ' · body: ' + JSON.stringify(body).slice(0,300));
      return json({error:'hook desconocido', hook:e.parameter.hook});
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

/**
 * Mapea un carrito de WIX a la pestaña carritos (+ CAPI opcional).
 *
 * OJO: "contacto" es la columna con la que sincronizarCRM identifica a la
 * persona. Un carrito sin contacto se descarta y nunca llega al CRM.
 */
function intakeCarrito(p) {
  var pick = function(keys){ for (var i=0;i<keys.length;i++){ var v=deepGet(p,keys[i]); if (v!==undefined && v!==null && v!=='') return v; } return ''; };
  var nombre = String(pick(['nombre','name','first_name','customer_name','cliente','contact.name'])).trim();
  var email  = String(pick(['email','correo','contact.email','customer_email'])).trim().toLowerCase();
  var tel    = String(pick(['telefono','phone','celular','contact.phone','customer_phone'])).trim();
  var valor  = Number(pick(['valor','value','total','amount','monto'])) || 0;
  var fechaR = String(pick(['fecha','date','created_at','timestamp'])) || new Date().toISOString().slice(0,10);
  var canal  = tel ? 'WhatsApp' : (email ? 'Email' : 'Web');

  var consent  = String(pick(['consentimiento','consent','optin','opt_in','acepta'])).trim().toUpperCase();
  var contacto = email || tel;

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var row = {
    id: 'c' + Date.now(),
    fecha: String(fechaR).slice(0,10),
    nombre: nombre || '(sin nombre)',
    canal: canal,
    valor: valor,
    estado: 'Pendiente',
    consentimiento: (consent==='SI' || consent==='SÍ' || consent==='TRUE' || consent==='1') ? 'SI' : 'NO',
    contacto: contacto
  };
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
// Pestañas donde lo más nuevo va arriba, no al final
var TABS_NUEVO_ARRIBA = ['reservas', 'carritos'];

function upsert(tab, row){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
  var head = SCHEMA[tab];
  var key = head[0];
  var vals = sh.getDataRange().getValues(); var idx=-1;
  for (var i=1;i<vals.length;i++){ if (String(vals[i][0])===String(row[key])){ idx=i+1; break; } }
  var line = head.map(function(h){ return row[h]!==undefined? row[h] : ''; });
  if (idx>0) {
    sh.getRange(idx,1,1,head.length).setValues([line]);
  } else if (TABS_NUEVO_ARRIBA.indexOf(tab) > -1) {
    sh.insertRowAfter(1);                                  // justo debajo del encabezado
    sh.getRange(2,1,1,head.length).setValues([line]);
  } else {
    sh.appendRow(line);
  }
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