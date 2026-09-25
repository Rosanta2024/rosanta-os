/**
 * Rosanta CRM — Apps Script para la Google Sheet maestra
 * =====================================================================
 * QUÉ HACE: agrega un menú "CRM Rosanta" a tu hoja con:
 *   ➕ Agregar contacto  — formulario para alta manual (con dedup)
 *   📥 Importar CSV       — pega/carga un CSV y lo integra (con dedup)
 *   🔄 Append SonTickets  — mergea el export de SonTickets (pestaña "Entrada_SonTickets")
 * Todo escribe EN VIVO en la maestra, normaliza el teléfono a +502… y evita duplicados.
 *
 * INSTALACIÓN (una sola vez):
 *   1. Abre la Google Sheet > Extensiones > Apps Script.
 *   2. Borra lo que haya y pega TODO este archivo. Guarda (💾).
 *   3. Recarga la hoja. Aparece el menú "CRM Rosanta" arriba.
 *   4. La primera vez que uses una opción, Google pedirá autorizar: aceptá.
 *
 * Se adapta a las columnas por su ENCABEZADO (no importa el orden):
 *   first_name, telefono, email, idioma, fuente, segmento, ultima_reserva, gasto_gtq, opt_in, notas
 */

// ---- etiquetas de segmento (las que usa tu hoja) ----
var SEG_LABEL = { cliente:"Cliente que visitó", reservo_activo:"Reserva activa",
  carrito_abandonado:"Carrito abandonado", cancelado:"Cancelado",
  reserva_historica:"Reserva histórica", lead:"Lead" };
var SEG_PRI = { "Cliente que visitó":5, "Reserva activa":4, "Carrito abandonado":3,
  "Cancelado":2, "Reserva histórica":1, "Lead":0, "":0 };
var CUTOFF = new Date(2026, 0, 1); // ene-2026: inicio de identificación de carritos abandonados

function onOpen() {
  SpreadsheetApp.getUi().createMenu("CRM Rosanta")
    .addItem("➕ Agregar contacto", "showAddForm")
    .addItem("📥 Importar CSV", "showCsvForm")
    .addSeparator()
    .addItem("🔄 Append SonTickets (pestaña Entrada_SonTickets)", "appendSonTickets")
    .addToUi();
}

// ============================ helpers de hoja ============================
function master_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var h = sheets[i].getRange(1, 1, 1, sheets[i].getLastColumn()).getValues()[0].map(String);
    if (h.indexOf("first_name") >= 0 && h.indexOf("telefono") >= 0) return sheets[i];
  }
  return ss.getSheets()[0];
}
function headerIdx_(sh) {
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(x){return String(x).trim();});
  var m = {}; h.forEach(function(name, i){ m[name] = i; }); // 0-based
  m.__len = h.length; return m;
}
function readAll_(sh) {
  var lr = sh.getLastRow();
  if (lr < 2) return [];
  return sh.getRange(2, 1, lr - 1, sh.getLastColumn()).getValues();
}
function buildIndex_(data, idx) {
  var byPhone = {}, byEmail = {};
  for (var r = 0; r < data.length; r++) {
    var p = String(data[r][idx.telefono] || "").trim();
    var e = String(data[r][idx.email] || "").trim().toLowerCase();
    if (p) byPhone[p] = r;
    if (e) byEmail[e] = r;
  }
  return { byPhone: byPhone, byEmail: byEmail };
}

// ============================ normalización ============================
function normEmail(v){ v=String(v||"").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)?v:""; }
function normPhone(raw){
  var d=String(raw||"").replace(/\D/g,""); if(d.indexOf("00")===0)d=d.slice(2);
  if(!d)return "";
  if(d.indexOf("502")===0 && d.length===11)return "+"+d;
  if(d.length===8)return "+502"+d;
  if(d.charAt(0)==="1" && d.length===11)return "+"+d;
  if(d.length===10)return (d.charAt(0)==="3"?"+57":"+1")+d;
  if(d.length>=11 && d.length<=15)return "+"+d;
  return "";
}
function idiomaAuto(phone){ return phone.indexOf("+502")===0?"ES":(phone?"EN":""); }
function rowArray_(idx, fields){
  var arr = new Array(idx.__len).fill("");
  Object.keys(fields).forEach(function(k){ if(idx[k]!==undefined) arr[idx[k]] = fields[k]; });
  return arr;
}

// ============================ ALTA MANUAL ============================
function showAddForm(){
  var html = HtmlService.createHtmlOutput(ADD_HTML()).setTitle("Agregar contacto").setWidth(330);
  SpreadsheetApp.getUi().showSidebar(html);
}
/** Llamado desde el formulario. Devuelve {ok, msg, total}. */
function addContact(payload){
  var sh = master_(), idx = headerIdx_(sh), data = readAll_(sh), ix = buildIndex_(data, idx);
  var phone = normPhone(payload.telefono), email = normEmail(payload.email);
  if(!phone && !email) return { ok:false, msg:"Necesita al menos teléfono o email válido." };
  if((phone && ix.byPhone[phone]!==undefined) || (email && ix.byEmail[email]!==undefined))
    return { ok:false, msg:"Ya existe un contacto con ese teléfono o email." };
  var idi = (payload.idioma==="ES"||payload.idioma==="EN") ? payload.idioma : idiomaAuto(phone);
  var seg = payload.segmento || "Lead";
  var gasto = Math.max(0, parseInt(String(payload.gasto||"0").replace(/[^\d]/g,""),10) || 0);
  var fields = {
    first_name: (payload.first_name||"").trim(),
    telefono: phone, email: email, idioma: idi,
    fuente: payload.fuente || "walk-in", segmento: seg,
    ultima_reserva: payload.ultima_reserva || "",
    gasto_gtq: gasto || "", opt_in: payload.opt_in || "sí",
    notas: (payload.notas||"").trim()
  };
  sh.appendRow(rowArray_(idx, fields));
  return { ok:true, msg:"Contacto agregado ✓", total: sh.getLastRow()-1 };
}

// ============================ IMPORTAR CSV ============================
function showCsvForm(){
  var html = HtmlService.createHtmlOutput(CSV_HTML()).setTitle("Importar CSV").setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}
/** Recibe el texto del CSV. Devuelve {ok,added,dup,bad,msg}. */
function importCsvText(text){
  var rows;
  try { rows = Utilities.parseCsv(text); } catch(e){ return {ok:false,msg:"No pude leer el CSV."}; }
  if(!rows || rows.length < 2) return {ok:false,msg:"El CSV no tiene datos."};
  var H = rows[0].map(function(x){return String(x).trim().toLowerCase();});
  function find(){ for(var i=0;i<arguments.length;i++){var k=H.indexOf(arguments[i]);if(k>=0)return k;} return -1; }
  var iN=find("nombre","first_name","first name","fn"),
      iP=find("telefono","teléfono","phone","celular","tel"),
      iE=find("email","correo","e-mail"),
      iI=find("idioma","language"), iF=find("fuente","source"),
      iS=find("segmento","segment"), iG=find("gasto","gasto_gtq","gasto_total","valor","valor total");
  if(iP<0 && iE<0) return {ok:false,msg:"No encontré columna de teléfono ni email."};

  var sh = master_(), idx = headerIdx_(sh), data = readAll_(sh), ix = buildIndex_(data, idx);
  var seen = {}; // dedup dentro del mismo archivo
  var add=[], dup=0, bad=0;
  for(var r=1;r<rows.length;r++){
    var row=rows[r];
    var phone=iP>=0?normPhone(row[iP]):"", email=iE>=0?normEmail(row[iE]):"";
    if(!phone && !email){ bad++; continue; }
    var key=phone+"|"+email;
    if(seen[key] || (phone&&ix.byPhone[phone]!==undefined) || (email&&ix.byEmail[email]!==undefined)){ dup++; continue; }
    seen[key]=1;
    var first=iN>=0?String(row[iN]||"").trim().split(/\s+/)[0]:"";
    var idi=iI>=0?String(row[iI]||"").trim().toUpperCase():""; if(idi!=="ES"&&idi!=="EN")idi=idiomaAuto(phone);
    var fue=(iF>=0&&String(row[iF]).trim())?String(row[iF]).trim():"walk-in";
    var seg=iS>=0?String(row[iS]||"").trim():"Lead"; if(SEG_PRI[seg]===undefined) seg="Lead";
    var gasto=iG>=0?Math.max(0,parseInt(String(row[iG]||"").replace(/[^\d]/g,""),10)||0):0;
    add.push(rowArray_(idx, { first_name:first, telefono:phone, email:email, idioma:idi,
      fuente:fue, segmento:seg, ultima_reserva:"", gasto_gtq:gasto||"", opt_in:"sí", notas:"" }));
    if(phone) ix.byPhone[phone]=1; if(email) ix.byEmail[email]=1;
  }
  if(add.length) sh.getRange(sh.getLastRow()+1, 1, add.length, idx.__len).setValues(add);
  return { ok:true, added:add.length, dup:dup, bad:bad,
    msg:"Importados "+add.length+" · duplicados "+dup+" · sin contacto "+bad };
}

// ============================ APPEND SONTICKETS ============================
function appendSonTickets(){
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var eSheet = ss.getSheetByName("Entrada_SonTickets");
  if(!eSheet){ ui.alert("Falta la pestaña 'Entrada_SonTickets'. Pegá ahí el export de SonTickets (con encabezados) y volvé a correr."); return; }
  var ed = eSheet.getDataRange().getValues(); if(ed.length<2){ ui.alert("La pestaña Entrada_SonTickets está vacía."); return; }
  var eh = ed[0];
  function col(row,name){ var i=eh.indexOf(name); return i<0?"":row[i]; }

  var sh = master_(), idx = headerIdx_(sh), data = readAll_(sh), ix = buildIndex_(data, idx);
  var today = new Date();
  var updated=0, add=[];
  function toVal(s){ var v=parseFloat(String(s||"0").replace(/[^\d.]/g,"")); return isNaN(v)?0:v; }
  function parseDate(s){ s=String(s||"").trim(); var m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1]); var d=new Date(s); return isNaN(d)?null:d; }
  var ES_SET={"redes sociales":1,"referencia":1,"ya soy cliente":1};
  var EN_SET={"social media":1,"referral":1,"already a customer":1};
  function idiomaFrom(c,phone){ c=String(c||"").trim().toLowerCase();
    if(ES_SET[c])return "ES"; if(EN_SET[c])return "EN"; return idiomaAuto(phone); }
  function estadoOf(estraw,val,d){
    if(val>0) return "cliente";
    if(estraw==="cancelled") return "cancelado";
    if(d && d>today && (estraw==="pending"||estraw==="confirmed")) return "reservo_activo";
    if(d && d>=CUTOFF) return "carrito_abandonado";
    return "reserva_historica";
  }
  for(var i=1;i<ed.length;i++){
    var row=ed[i];
    var name=String(col(row,"Nombre")||"").trim();
    var email=normEmail(col(row,"Email")), phone=normPhone(col(row,"Celular"));
    if(!email && !phone) continue;
    var dom=email?email.split("@")[1]:"";
    if(/test/i.test(name)||dom==="rosanta.rest"||dom==="usermedia.co") continue;
    var val=toVal(col(row,"Valor Total")), d=parseDate(col(row,"Fecha reserva"));
    var seg=SEG_LABEL[estadoOf(String(col(row,"Estado")||"").trim().toLowerCase(),val,d)];
    var idi=idiomaFrom(col(row,"¿Cómo nos conociste?"),phone);
    var first=name?name.split(/\s+/)[0]:"";
    var tgt = (phone&&ix.byPhone[phone]!==undefined)?ix.byPhone[phone]
            : (email&&ix.byEmail[email]!==undefined)?ix.byEmail[email] : -1;
    if(tgt>=0){
      var cur=data[tgt];
      if((SEG_PRI[seg]||0) > (SEG_PRI[String(cur[idx.segmento])]||0)) cur[idx.segmento]=seg;
      var cd=cur[idx.ultima_reserva]?new Date(cur[idx.ultima_reserva]):null;
      if(d && (!cd||d>cd)) cur[idx.ultima_reserva]=d;
      if(val>0) cur[idx.gasto_gtq]=(parseFloat(cur[idx.gasto_gtq])||0)+val;
      if(!cur[idx.first_name]&&first) cur[idx.first_name]=first;
      if(!cur[idx.idioma]&&idi) cur[idx.idioma]=idi;
      if(!cur[idx.email]&&email){ cur[idx.email]=email; ix.byEmail[email]=tgt; }
      if(!cur[idx.telefono]&&phone){ cur[idx.telefono]=phone; ix.byPhone[phone]=tgt; }
      if(String(cur[idx.fuente])==="GHL") cur[idx.fuente]="GHL+SonTickets";
      updated++;
    } else {
      add.push(rowArray_(idx,{ first_name:first, telefono:phone, email:email, idioma:idi,
        fuente:"SonTickets", segmento:seg, ultima_reserva:d||"", gasto_gtq:(val>0?val:""), opt_in:"sí", notas:"" }));
      if(phone) ix.byPhone[phone]=1; if(email) ix.byEmail[email]=1;
    }
  }
  if(data.length) sh.getRange(2,1,data.length,idx.__len).setValues(data);
  if(add.length) sh.getRange(sh.getLastRow()+1,1,add.length,idx.__len).setValues(add);
  ui.alert("Append SonTickets listo.\nActualizados: "+updated+"\nNuevos: "+add.length);
}

// ============================ HTML de los formularios ============================
function ADD_HTML(){ return [
'<!DOCTYPE html><html><head><base target="_top"><style>',
'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#22302B;padding:6px 4px}',
'h3{color:#1F4A3F;margin:2px 0 10px} label{display:block;font-size:11px;color:#6B7A73;text-transform:uppercase;letter-spacing:.4px;margin:8px 0 2px}',
'input,select{width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #E7E3D8;border-radius:8px;font-size:13px}',
'button{margin-top:12px;width:100%;padding:9px;border:0;border-radius:9px;background:#1F4A3F;color:#fff;font-size:14px;cursor:pointer}',
'.msg{margin-top:10px;font-size:12px;min-height:16px}.ok{color:#1F4A3F}.err{color:#B00020}',
'</style></head><body>',
'<h3>Agregar contacto</h3>',
'<label>Nombre (pila)</label><input id="first_name" placeholder="María">',
'<label>Teléfono</label><input id="telefono" placeholder="+502 5555 1234 o 55551234">',
'<label>Email</label><input id="email" placeholder="correo@ejemplo.com">',
'<label>Idioma</label><select id="idioma"><option value="">(auto)</option><option>ES</option><option>EN</option></select>',
'<label>Fuente</label><select id="fuente"><option>walk-in</option><option>SonTickets</option><option>GHL</option><option>referido</option></select>',
'<label>Segmento</label><select id="segmento"><option>Lead</option><option>Cliente que visitó</option><option>Carrito abandonado</option><option>Reserva activa</option><option>Cancelado</option></select>',
'<label>Gasto Q (opcional)</label><input id="gasto" type="number" min="0" placeholder="0">',
'<label>Notas</label><input id="notas" placeholder="">',
'<button id="save">Guardar contacto</button>',
'<div class="msg" id="msg"></div>',
'<script>',
'function g(id){return document.getElementById(id).value;}',
'document.getElementById("save").onclick=function(){',
' var b=document.getElementById("save"); b.disabled=true;',
' var m=document.getElementById("msg"); m.className="msg"; m.textContent="Guardando…";',
' var p={first_name:g("first_name"),telefono:g("telefono"),email:g("email"),idioma:g("idioma"),fuente:g("fuente"),segmento:g("segmento"),gasto:g("gasto"),notas:g("notas")};',
' google.script.run.withSuccessHandler(function(res){',
'   b.disabled=false; m.className="msg "+(res.ok?"ok":"err"); m.textContent=res.msg+(res.ok?" ("+res.total+" en total)":"");',
'   if(res.ok){["first_name","telefono","email","gasto","notas"].forEach(function(id){document.getElementById(id).value="";});}',
' }).withFailureHandler(function(e){b.disabled=false;m.className="msg err";m.textContent="Error: "+e.message;}).addContact(p);',
'};',
'</scr'+'ipt></body></html>' ].join("\n"); }

function CSV_HTML(){ return [
'<!DOCTYPE html><html><head><base target="_top"><style>',
'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#22302B;padding:6px 4px}',
'h3{color:#1F4A3F;margin:2px 0 8px} p{color:#6B7A73;font-size:12px;line-height:1.4}',
'input[type=file]{width:100%;margin:8px 0} button{width:100%;padding:9px;border:0;border-radius:9px;background:#1F4A3F;color:#fff;font-size:14px;cursor:pointer}',
'.msg{margin-top:10px;font-size:12px}.ok{color:#1F4A3F}.err{color:#B00020}',
'</style></head><body>',
'<h3>Importar CSV</h3>',
'<p>El CSV debe tener encabezados. Se reconocen: <b>nombre/first_name</b>, <b>telefono/phone/celular</b>, <b>email/correo</b>, <b>idioma</b>, <b>fuente</b>, <b>segmento</b>, <b>gasto</b>. Cada fila necesita teléfono o email. Se normaliza y deduplica solo.</p>',
'<input type="file" id="f" accept=".csv,text/csv">',
'<button id="imp">Importar</button>',
'<div class="msg" id="msg"></div>',
'<script>',
'document.getElementById("imp").onclick=function(){',
' var f=document.getElementById("f").files[0]; var m=document.getElementById("msg");',
' if(!f){m.className="msg err";m.textContent="Elegí un archivo CSV.";return;}',
' var b=this; b.disabled=true; m.className="msg"; m.textContent="Procesando…";',
' var rd=new FileReader();',
' rd.onload=function(){ google.script.run.withSuccessHandler(function(res){',
'   b.disabled=false; m.className="msg "+(res.ok?"ok":"err"); m.textContent=res.msg;',
' }).withFailureHandler(function(e){b.disabled=false;m.className="msg err";m.textContent="Error: "+e.message;}).importCsvText(rd.result); };',
' rd.readAsText(f);',
'};',
'</scr'+'ipt></body></html>' ].join("\n"); }