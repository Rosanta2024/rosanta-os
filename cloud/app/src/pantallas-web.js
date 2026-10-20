/**
 * Pantallas de la web nueva (AYUDANTE 4, 20-oct-2026). HTML y JS sin librerias, como las de la nube, con la
 * paleta de la intranet (PaletaServidor.js, via pantalla-pagos.paleta()).
 *
 *   /contenido-web?u=…              (solo el dueño) textos EN/ES, fotos, menu, FAQ, eventos y Adventures (experiencias,
 *                                   operadores aliados y consultas); vista previa; publicar
 *   /contenido-web/vista-previa?u=… como queda el borrador (por pagina, en ES o EN)
 *   /giftcards?u=…                  canje en sala y caja; emitir por deposito, anular y reporte (dueño)
 *   /gift-cards/comprar[?lang=en]   compra publica (el sitio Astro puede usar esta o la suya contra la misma API)
 *
 * Todo texto que viene de la base se escapa (esc) antes de ir al HTML.
 */
const { paleta } = require('./pantalla-pagos');

let PALETA = null;
const pal = () => { if (PALETA === null) { try { PALETA = paleta(); } catch (e) { PALETA = ''; } } return PALETA; };

const BASE_CSS = 'body{margin:0;background:var(--fondo,#F2EEEB);color:var(--texto,#000);font-family:var(--rosanta-font-body,system-ui)}' +
  '.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px 16px;background:var(--superficie,#fff);border-bottom:1px solid var(--linea,#ddd)}' +
  '.top h1{font-family:var(--rosanta-font-title,Georgia);font-size:1.3rem;margin:0}.top small{color:var(--texto-suave,#666)}.top .esp{flex:1}' +
  'main{max-width:1100px;margin:0 auto;padding:16px}' +
  'button,.btn{font:inherit;border:1px solid var(--linea,#ccc);background:var(--superficie,#fff);color:inherit;border-radius:10px;padding:8px 12px;cursor:pointer}' +
  'button.pri{background:var(--rosanta-verde,#4E6D5A);border-color:var(--rosanta-verde,#4E6D5A);color:#fff}button:disabled{opacity:.5;cursor:default}' +
  'input,textarea,select{font:inherit;width:100%;box-sizing:border-box;border:1px solid var(--linea,#ccc);border-radius:8px;padding:8px;background:var(--superficie,#fff);color:inherit}' +
  'textarea{min-height:70px;resize:vertical}label{display:block;font-size:.75rem;color:var(--texto-suave,#666);margin:8px 0 3px;font-family:var(--rosanta-font-label,system-ui);text-transform:uppercase;letter-spacing:.04em}' +
  '.tarjeta{background:var(--superficie,#fff);border:1px solid var(--linea,#ddd);border-radius:14px;padding:14px;margin:0 0 12px}' +
  '.dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:640px){.dos{grid-template-columns:1fr}}' +
  '.fila{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.retirado{opacity:.55}' +
  '.aviso{background:var(--rosanta-lila-tint,#F2F0F8);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:.92rem}' +
  '.mal{color:var(--mal,#b00020)}.ok{color:var(--ok,#2e7d32)}.chip{display:inline-block;font-size:.75rem;border-radius:99px;padding:2px 8px;background:var(--rosanta-verde-tint,#EEF4EF)}' +
  'nav.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}nav.tabs button.on{background:var(--rosanta-negro,#000);color:#fff;border-color:#000}' +
  'table{width:100%;border-collapse:collapse}@media(max-width:720px){table{display:block;overflow-x:auto}}th,td{text-align:left;padding:6px;border-bottom:1px solid var(--linea,#ddd);font-size:.9rem;vertical-align:top}.n{text-align:right;font-variant-numeric:tabular-nums}' +
  '.fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.fotos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#eee}' +
  '#msg{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000;color:#fff;padding:10px 16px;border-radius:10px;display:none;max-width:90vw;z-index:9}';

const ESC_JS = 'function esc(x){return String(x==null?"":x).replace(/[&<>"\\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}';
const API_JS = ESC_JS + 'var U=new URLSearchParams(location.search).get("u")||"";' +
  'function msg(t,mal){var m=document.getElementById("msg");m.textContent=t;m.style.background=mal?"#b00020":"#000";m.style.display="block";clearTimeout(msg.t);msg.t=setTimeout(function(){m.style.display="none"},mal?7000:2500)}' +
  'function api(metodo,ruta,cuerpo,tipo){var h={"x-rosanta-u":U};var b;if(cuerpo instanceof Blob){h["Content-Type"]=tipo||cuerpo.type;b=cuerpo}else if(cuerpo!==undefined){h["Content-Type"]="application/json";b=JSON.stringify(cuerpo)}' +
  'return fetch(ruta,{method:metodo,headers:h,body:b}).then(function(r){return r.json().catch(function(){return{error:"Sin respuesta"}}).then(function(j){if(!r.ok){var e=new Error(j.error||("Error "+r.status));e.faltan=j.faltan;throw e}return j})})}';

function pagina(titulo, cuerpo, script) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>' + titulo + ' · Rosanta</title>' + pal() + '<style>' + BASE_CSS + '</style></head><body>' + cuerpo + '<div id="msg"></div><script>' + script + '</script></body></html>';
}

// ------------------------------------------------------------------------------------------------ Contenido web

const CONTENIDO_JS = API_JS + `
var B=null,TAB="textos",PAG=null;
var F={
 paginas:[["titulo","Título (SEO)","par"],["descripcion","Descripción (SEO)","parlargo"],["foto_id","Foto para compartir","foto"]],
 bloques:[["texto","Texto","par"],["enlace","A dónde lleva (botón)","texto"],["foto_id","Foto","foto"],["orden","Orden","num"]],
 secciones:[["nombre","Nombre","par"],["nota","Nota","par"],["orden","Orden","num"]],
 platos:[["seccion_id","Sección","seccion"],["nombre","Nombre","par"],["descripcion","Descripción","parlargo"],["precio_q","Precio (Q)","precio"],["alergenos","Alérgenos","alergenos"],["etiquetas","Etiquetas","etiquetas"],["foto_id","Foto","foto"],["orden","Orden","num"]],
 faq:[["categoria","Categoría","texto"],["pregunta","Pregunta","par"],["respuesta","Respuesta","parlargo"],["orden","Orden","num"]],
 eventos:[["titulo","Título","par"],["descripcion","Descripción","parlargo"],["inicio","Empieza","fecha"],["fin","Termina","fecha"],["precio_q","Precio (Q)","precio"],["cupo","Cupo","num"],["enlace","Enlace para reservar","texto"],["foto_id","Foto","foto"],["orden","Orden","num"]],
 fotos:[["alt","Descripción de la foto (para Google y lectores)","par"]],
 experiencias:[["operador_id","Operador aliado","operador"],["titulo","Título","par"],["descripcion","Descripción","parlargo"],["duracion","Duración","par"],["incluye","Qué incluye (una cosa por línea)","parlargo"],
  ["punto_salida","Punto de salida","par"],["temporada","Temporada","par"],["dificultad","Dificultad","dificultad"],["idiomas","Idiomas","idiomas"],["precio_ref_q","Precio de referencia por persona (Q)","precioref"],
  ["foto_id","Foto principal","foto"],["galeria","Galería (números de foto, separados por coma)","texto"],["faq","Preguntas (una por línea: Pregunta ES | Respuesta ES | Question EN | Answer EN)","faq"],["orden","Orden","num"]],
 operadores:[["nombre","Nombre (como sale en la ficha)","texto"],["razon_social","Razón social","texto"],["codigo_referido","Código de referido","texto"],["contacto_nombre","Contacto","texto"],["contacto_telefono","Teléfono","texto"],
  ["contacto_email","Correo","texto"],["contacto_emergencia","Contacto de emergencia","texto"],["licencia_inguat","Licencia INGUAT (número)","texto"],["licencia_vence","Licencia vence","dia"],
  ["seguro_aseguradora","Aseguradora","texto"],["seguro_poliza","Póliza","texto"],["seguro_vence","Seguro vence","dia"],["comision_tipo","Comisión","comtipo"],["comision_valor","Comisión: % o Q por persona","num"],
  ["acuerdo","Acuerdo (quién cobra, cómo se pasan los leads)","largo"],["requisitos","Lo que ya entregó","requisitos"],["nota","Nota","largo"]]
};
function cargar(){return api("GET","/api/web/borrador").then(function(j){B=j;pintar()}).catch(function(e){document.getElementById("app").innerHTML="<div class=aviso>"+esc(e.message)+"</div>"})}
function fechaLocal(x){if(!x)return"";var d=new Date(x);var g=new Date(d.getTime()-6*3600000);return g.toISOString().slice(0,16)}
function control(tipo,nombre,etq,f,dis){var v=f?f[nombre]:"";var d=dis?" disabled":"";
 if(tipo==="par"||tipo==="parlargo"){var t=tipo==="parlargo"||(f&&f.tipo==="parrafo");var mk=function(l){var n=nombre+"_"+l;var val=f?f[nombre==="texto"?"texto_"+l:n]:"";var cn=nombre==="texto"?"texto_"+l:n;
  return "<div><label>"+etq+" · "+(l==="es"?"Español":"English")+"</label>"+(t?"<textarea data-c=\\""+cn+"\\""+d+">"+esc(val)+"</textarea>":"<input data-c=\\""+cn+"\\" value=\\""+esc(val)+"\\""+d+">")+"</div>"};
  return "<div class=dos>"+mk("es")+mk("en")+"</div>"}
 if(tipo==="foto"){var o="<option value=\\"\\">— sin foto —</option>"+B.fotos.filter(function(x){return x.activa||x.id===v}).map(function(x){return "<option value="+x.id+(x.id===v?" selected":"")+">#"+x.id+" "+esc(x.alt_es||x.ruta.split("/").pop())+"</option>"}).join("");
  return "<label>"+etq+"</label><select data-c="+nombre+d+">"+o+"</select>"+(v&&fotoUrl(v)?"<img src=\\""+esc(fotoUrl(v))+"\\" style=\\"max-height:80px;border-radius:8px;margin-top:6px\\">":"")}
 if(tipo==="seccion"){return "<label>"+etq+"</label><select data-c="+nombre+d+">"+B.secciones.map(function(s){return "<option value="+s.id+(s.id===v?" selected":"")+">"+esc(s.nombre_es)+"</option>"}).join("")+"</select>"}
 if(tipo==="alergenos"||tipo==="etiquetas"){var dic=B[tipo];return "<label>"+etq+"</label><div class=fila data-lista="+nombre+">"+Object.keys(dic).map(function(k){return "<label style=\\"text-transform:none;font-size:.85rem;margin:0\\"><input type=checkbox value="+k+((v||[]).indexOf(k)>=0?" checked":"")+d+" style=\\"width:auto\\"> "+esc(dic[k].es)+"</label>"}).join("")+"</div>"}
 if(tipo==="precio"){var pd=dis||!B.yo.puede_precios;var usd=v!=null&&B.ajustes.tipo_cambio_usd?" ≈ US$"+Math.round(v/B.ajustes.tipo_cambio_usd.q_por_usd):"";
  return "<label>"+etq+(pd&&!dis?" · solo el dueño":"")+"</label><input data-c="+nombre+" inputmode=decimal value=\\""+(v==null?"":v)+"\\""+(pd?" disabled":"")+"><small>"+usd+"</small>"}
 if(tipo==="operador"){return "<label>"+etq+"</label><select data-c="+nombre+d+">"+B.operadores.map(function(o){return "<option value="+o.id+(o.id===v?" selected":"")+">"+esc(o.nombre)+(o.publicable.ok?"":" (no sale: "+esc(o.publicable.motivo)+")")+"</option>"}).join("")+"</select>"}
 if(tipo==="dificultad"){return "<label>"+etq+"</label><select data-c="+nombre+d+">"+Object.keys(B.dificultad).map(function(k){return "<option value="+k+(k===v?" selected":"")+">"+esc(B.dificultad[k].es)+"</option>"}).join("")+"</select>"}
 if(tipo==="comtipo"){return "<label>"+etq+"</label><select data-c="+nombre+d+">"+["porcentaje","fijo","acuerdo"].map(function(k){return "<option"+(k===v?" selected":"")+">"+k+"</option>"}).join("")+"</select>"}
 if(tipo==="idiomas"){return "<label>"+etq+"</label><div class=fila data-lista="+nombre+">"+Object.keys(B.idiomas).map(function(k){return "<label style=\\"text-transform:none;font-size:.85rem;margin:0\\"><input type=checkbox value="+k+((v||[]).indexOf(k)>=0?" checked":"")+d+" style=\\"width:auto\\"> "+esc(B.idiomas[k].es)+"</label>"}).join("")+"</div>"}
 if(tipo==="requisitos"){var rq=v||{};return "<label>"+etq+"</label><div class=fila data-obj="+nombre+">"+B.requisitos.map(function(k){return "<label style=\\"text-transform:none;font-size:.85rem;margin:0\\"><input type=checkbox value="+k+(rq[k]?" checked":"")+d+" style=\\"width:auto\\"> "+esc(k.replace(/_/g," "))+"</label>"}).join("")+"</div>"}
 if(tipo==="faq"){var tx=(v||[]).map(function(q){return [q.pregunta.es,q.respuesta.es,q.pregunta.en,q.respuesta.en].join(" | ")}).join("\\n");return "<label>"+etq+"</label><textarea data-c="+nombre+d+">"+esc(tx)+"</textarea>"}
 if(tipo==="largo")return "<label>"+etq+"</label><textarea data-c="+nombre+d+">"+esc(v==null?"":v)+"</textarea>";
 if(tipo==="dia")return "<label>"+etq+"</label><input type=date data-c="+nombre+" value=\\""+esc(v?String(v).slice(0,10):"")+"\\""+d+">";
 if(tipo==="precioref")return "<label>"+etq+"</label><input data-c="+nombre+" inputmode=decimal value=\\""+(v==null?"":v)+"\\""+d+">";
 if(tipo==="fecha")return "<label>"+etq+" (hora de Guatemala)</label><input type=datetime-local data-c="+nombre+" value=\\""+fechaLocal(v)+"\\""+d+">";
 if(tipo==="num")return "<label>"+etq+"</label><input data-c="+nombre+" inputmode=numeric value=\\""+(v==null?"":v)+"\\""+d+">";
 return "<label>"+etq+"</label><input data-c="+nombre+" value=\\""+esc(v==null?"":v)+"\\""+d+">"}
function fotoUrl(id){var f=B.fotos.filter(function(x){return x.id===id})[0];return f&&(f.url_chica||f.url)}
function leer(caja){var o={};caja.querySelectorAll("[data-c]").forEach(function(el){if(el.disabled)return;o[el.getAttribute("data-c")]=el.value});
 caja.querySelectorAll("[data-obj]").forEach(function(el){var c={};el.querySelectorAll("input").forEach(function(x){c[x.value]=x.checked});o[el.getAttribute("data-obj")]=c});
 caja.querySelectorAll("[data-lista]").forEach(function(el){var c=[];el.querySelectorAll("input:checked").forEach(function(x){c.push(x.value)});if(!el.querySelector("input:disabled"))o[el.getAttribute("data-lista")]=c});return o}
function tarjeta(tipo,f,llave,activo,titulo,campos){var dis=!B.yo.puede_editar;var cs=(campos||F[tipo]).filter(function(c){return !(tipo==="bloques"&&((c[0]==="enlace"&&f.tipo!=="enlace")||(c[0]==="foto_id"&&f.tipo!=="foto")||(c[0]==="texto"&&f.tipo==="foto")))});
 return "<div class=\\"tarjeta"+(activo?"":" retirado")+"\\" data-tipo="+tipo+" data-llave=\\""+esc(llave)+"\\"><div class=fila style=\\"margin:0\\"><b>"+esc(titulo)+"</b>"+(activo?"":" <span class=chip>retirado</span>")+"</div>"+
 cs.map(function(c){return control(c[2],c[0],c[1],f,dis)}).join("")+(dis?"":"<div class=fila><button class=pri data-acc=guardar>Guardar</button><button data-acc="+(activo?"retirar":"reactivar")+">"+(tipo==="operadores"?(activo?"Pausar":"Activar"):(activo?"Retirar":"Volver a mostrar"))+"</button></div>")+"</div>"}
function nuevo(tipo,campos,titulo){if(!B.yo.puede_editar)return"";return "<details class=tarjeta><summary><b>+ "+esc(titulo)+"</b></summary><div data-nuevo="+tipo+">"+campos+"<div class=fila><button class=pri data-acc=crear>Agregar</button></div></div></details>"}
function pintar(){var a=document.getElementById("app");var y=B.yo;
 document.getElementById("estado").innerHTML=(B.ultima_version?"Publicado: versión "+B.ultima_version.id:"Nada publicado todavía")+(B.cambios_sin_publicar?" · <b>hay cambios sin publicar</b>":" · al día");
 document.getElementById("bPub").style.display=y.puede_publicar?"":"none";
 var h="";
 if(!y.puede_publicar)h+="<div class=aviso>Lo que cambies queda en <b>borrador</b>. Juanma lo revisa en la vista previa y lo publica.</div>";
 if(TAB==="textos"){var ps=B.paginas;if(!PAG&&ps[0])PAG=ps[0].clave;
  h+="<div class=fila style=\\"margin:0 0 12px\\"><label style=\\"margin:0\\">Página</label><select id=selPag style=\\"width:auto\\">"+ps.map(function(p){return "<option value=\\""+esc(p.clave)+"\\""+(p.clave===PAG?" selected":"")+">"+esc(p.clave)+" ("+esc(p.ruta_en)+")</option>"}).join("")+"</select></div>";
  var p=ps.filter(function(x){return x.clave===PAG})[0];
  if(p){h+=tarjeta("paginas",p,p.clave,p.activa,"SEO de la página");
   B.bloques.filter(function(b){return b.pagina===PAG}).forEach(function(b){h+=tarjeta("bloques",b,b.id,b.activo,b.clave+" · "+b.tipo)});
   h+=nuevo("bloques","<input type=hidden data-c=pagina value=\\""+esc(PAG)+"\\"><label>Clave (p. ej. heroe.titulo)</label><input data-c=clave><label>Tipo</label><select data-c=tipo><option value=texto>Texto corto</option><option value=parrafo>Párrafo</option><option value=enlace>Botón</option><option value=foto>Foto</option></select>","Agregar un bloque a esta página")}}
 if(TAB==="menu"){B.secciones.forEach(function(s){h+=tarjeta("secciones",s,s.id,s.activa,"Sección: "+s.nombre_es);
   B.platos.filter(function(p){return p.seccion_id===s.id}).forEach(function(p){h+=tarjeta("platos",p,p.id,p.activo,p.nombre_es+(p.precio_q!=null?" · Q"+p.precio_q:""))})});
  h+=nuevo("secciones","<label>Clave (p. ej. entradas)</label><input data-c=clave>"+control("par","nombre","Nombre",null),"Agregar una sección");
  if(B.secciones.length)h+=nuevo("platos",control("seccion","seccion_id","Sección",{seccion_id:B.secciones[0].id})+control("par","nombre","Nombre",null)+control("parlargo","descripcion","Descripción",null)+control("precio","precio_q","Precio (Q)",null),"Agregar un plato")}
 if(TAB==="faq"){B.faq.forEach(function(q){h+=tarjeta("faq",q,q.id,q.activa,q.pregunta_es)});h+=nuevo("faq",control("par","pregunta","Pregunta",null)+control("parlargo","respuesta","Respuesta",null),"Agregar una pregunta")}
 if(TAB==="eventos"){B.eventos.forEach(function(e){h+=tarjeta("eventos",e,e.id,e.activo,e.titulo_es+" · "+fechaLocal(e.inicio).replace("T"," "))});
  h+=nuevo("eventos","<label>Dirección (p. ej. cena-maridaje-noviembre)</label><input data-c=slug>"+control("par","titulo","Título",null)+control("fecha","inicio","Empieza",null),"Agregar un evento")}
 if(TAB==="fotos"){if(y.puede_editar)h+="<div class=tarjeta><b>Subir fotos</b><p><small>Se achican solas antes de subir (1600 px y 600 px, WebP). Escribí la descripción después.</small></p><input type=file id=archivos accept=\\"image/*\\" multiple></div>";
  h+="<div class=fotos>"+B.fotos.map(function(f){return "<div>"+"<img loading=lazy src=\\""+esc(f.url_chica||f.url)+"\\" alt=\\""+esc(f.alt_es)+"\\"><small>#"+f.id+" · "+f.ancho+"×"+f.alto+"</small></div>"}).join("")+"</div><h3>Descripciones</h3>";
  B.fotos.forEach(function(f){h+=tarjeta("fotos",f,f.id,f.activa,"Foto #"+f.id)})}
 if(TAB==="adventures"){if(!B.operadores.length)h+="<div class=aviso>Primero carga un operador aliado (pestaña Operadores).</div>";
  B.experiencias.forEach(function(e){var op=B.operadores.filter(function(o){return o.id===e.operador_id})[0];h+=tarjeta("experiencias",e,e.id,e.activa,e.titulo_es+(op&&!op.publicable.ok?" · NO SALE: "+op.publicable.motivo:""))});
  if(B.operadores.length)h+=nuevo("experiencias","<label>Dirección (p. ej. acatenango-dos-dias)</label><input data-c=slug>"+control("operador","operador_id","Operador aliado",{operador_id:B.operadores[0].id})+control("par","titulo","Título",null),"Agregar una experiencia")}
 if(TAB==="operadores"){h+="<div class=aviso>Ningún operador sale en el sitio sin licencia de INGUAT y seguro vigentes. 30 días antes de que venzan te llega un aviso; si vencen, sus fichas salen solas del sitio.</div>";
  B.operadores.forEach(function(o){h+=tarjeta("operadores",o,o.id,o.estado==="activo",o.nombre+" · "+o.estado+(o.publicable.ok?"":" · "+o.publicable.motivo))});
  h+=nuevo("operadores","<label>Nombre</label><input data-c=nombre><label>Código de referido (p. ej. ACAT-01)</label><input data-c=codigo_referido>","Agregar un operador aliado")}
 if(TAB==="consultas"){h+="<div class=tarjeta><b>Por operador</b><div id=resOp>Leyendo…</div></div><div class=tarjeta><b>Consultas de Adventures</b><div id=leads>Leyendo…</div></div>"}
 if(TAB==="versiones"){h+="<div class=tarjeta><b>Versiones publicadas</b><div id=vers>Leyendo…</div></div><div class=tarjeta><b>Quién cambió qué</b><div id=bit>Leyendo…</div></div>";
  if(y.puede_precios){var gc=B.ajustes.giftcards||{montos_q:[300,500],usd_fijos:{}};
   h+="<div class=tarjeta><b>Tipo de cambio de referencia (Q por US$)</b><div class=fila><input id=tc style=\\"width:120px\\" value=\\""+(B.ajustes.tipo_cambio_usd?B.ajustes.tipo_cambio_usd.q_por_usd:"")+"\\"><button data-acc=tc>Guardar</button></div></div>"+
   "<div class=tarjeta><b>Gift cards: precio fijo en US$ (vacío = se calcula con el tipo de cambio)</b><div class=fila>"+(gc.montos_q||[300,500]).map(function(q){return "<label style=\\"margin:0\\">Q"+q+"</label><input data-usd="+q+" style=\\"width:90px\\" value=\\""+((gc.usd_fijos||{})[q]||"")+"\\">"}).join("")+"<button data-acc=usd>Guardar</button></div></div>"}}
 a.innerHTML=h;
 var sp=document.getElementById("selPag");if(sp)sp.onchange=function(){PAG=sp.value;pintar()};
 var ar=document.getElementById("archivos");if(ar)ar.onchange=function(){subir([].slice.call(ar.files))};
 if(TAB==="versiones")verVersiones();if(TAB==="consultas")verLeads()}
var EST=["nuevo","pasado_al_operador","confirmado","vendido","perdido"];
function q2(n){return n==null?"":"Q"+Number(n).toLocaleString("es-GT")}
function verLeads(){api("GET","/api/adventures/operadores").then(function(v){document.getElementById("resOp").innerHTML="<table><tr><th>Operador</th><th>Código</th><th class=n>Consultas</th><th class=n>Vendidas</th><th class=n>Comisión</th><th class=n>Cenas</th></tr>"+v.map(function(o){return "<tr><td>"+esc(o.nombre)+"</td><td>"+esc(o.codigo_referido)+"</td><td class=n>"+o.leads+"</td><td class=n>"+o.vendidos+"</td><td class=n>"+q2(o.comision_q)+"</td><td class=n>"+o.cenas+"</td></tr>"}).join("")+"</table>"}).catch(function(e){msg(e.message,1)});
 api("GET","/api/adventures/leads").then(function(v){var exp={};B.experiencias.forEach(function(e){exp[e.id]=e.titulo_es});
  document.getElementById("leads").innerHTML=v.length?v.map(function(l){return "<div class=tarjeta data-lead="+l.id+"><b>"+esc(l.nombre)+"</b> · "+esc(exp[l.experiencia_id]||"")+" · "+esc(l.codigo_referido)+"<br><small>"+esc(new Date(l.creado).toLocaleString("es-GT"))+" · "+esc(l.email)+" "+esc(l.telefono||"")+" · "+(l.personas||"?")+" pers. · "+esc(l.fecha_deseada||"sin fecha")+(l.combinar_cena?" · cena "+esc(l.cena_fecha)+" "+esc(l.cena_hora)+" ("+esc(l.cena_estado)+")":"")+"</small><p>"+esc(l.mensaje)+"</p>"+
  "<div class=dos><div><label>Estado</label><select data-l=estado>"+EST.map(function(e){return "<option"+(e===l.estado?" selected":"")+">"+e+"</option>"}).join("")+"</select></div><div><label>Venta del operador (Q)</label><input data-l=venta_q value=\\""+(l.venta_q==null?"":l.venta_q)+"\\"></div></div>"+
  "<label>Comisión para Rosanta (Q) — vacío = se calcula con el acuerdo</label><input data-l=comision_q value=\\""+(l.comision_q==null?"":l.comision_q)+"\\"><div class=fila><button class=pri data-acc=lead>Guardar</button></div></div>"}).join(""):"Todavía no hay consultas."}).catch(function(e){msg(e.message,1)})}
function verVersiones(){api("GET","/api/web/versiones").then(function(v){document.getElementById("vers").innerHTML=v.length?"<table><tr><th>#</th><th>Cuándo</th><th>Quién</th><th>Nota</th><th>Sitio</th><th></th></tr>"+v.map(function(x){return "<tr><td>"+x.id+"</td><td>"+esc(new Date(x.publicada).toLocaleString("es-GT"))+"</td><td>"+esc(x.publicada_por)+"</td><td>"+esc(x.nota)+(x.restaurada_de?" <span class=chip>vuelta a #"+x.restaurada_de+"</span>":"")+"</td><td>"+esc(x.reconstruccion)+"</td><td>"+(B.yo.puede_publicar&&B.ultima_version&&x.id!==B.ultima_version.id?"<button data-volver="+x.id+">Volver a esta</button>":"")+"</td></tr>"}).join("")+"</table>":"Todavía no se publicó nada."}).catch(function(e){msg(e.message,1)});
 api("GET","/api/web/bitacora?limite=60").then(function(v){document.getElementById("bit").innerHTML="<table><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Dónde</th></tr>"+v.map(function(x){return "<tr><td>"+esc(new Date(x.cuando).toLocaleString("es-GT"))+"</td><td>"+esc(x.quien)+"</td><td>"+esc(x.accion)+"</td><td>"+esc(x.tabla.replace("web_",""))+" "+esc(x.registro_id)+"</td></tr>"}).join("")+"</table>"}).catch(function(){})}
function achicar(file,lado){return createImageBitmap(file).then(function(img){var k=Math.min(1,lado/Math.max(img.width,img.height));var c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
 c.getContext("2d").drawImage(img,0,0,c.width,c.height);return new Promise(function(ok){c.toBlob(function(b){ok({blob:b,ancho:c.width,alto:c.height})},"image/webp",0.82)})})}
function subir(files){if(!files.length)return cargar();var f=files.shift();msg("Subiendo "+f.name+"…");
 achicar(f,1600).then(function(g){return api("POST","/api/web/fotos?ancho="+g.ancho+"&alto="+g.alto,g.blob,"image/webp")}).then(function(foto){return achicar(f,600).then(function(c){return api("POST","/api/web/fotos/"+foto.id+"/chica",c.blob,"image/webp")})})
 .then(function(){subir(files)}).catch(function(e){msg(f.name+": "+e.message,1);subir(files)})}
document.addEventListener("click",function(ev){var t=ev.target;
 if(t.matches("nav.tabs button")){TAB=t.getAttribute("data-tab");document.querySelectorAll("nav.tabs button").forEach(function(b){b.classList.toggle("on",b===t)});pintar();return}
 var vol=t.getAttribute("data-volver");if(vol){if(!confirm("¿Volver el sitio a la versión "+vol+"? El borrador también queda como esa versión."))return;api("POST","/api/web/versiones/"+vol+"/volver",{}).then(function(r){msg("Listo: versión "+r.version+" publicada");cargar()}).catch(function(e){msg(e.message,1)});return}
 var acc=t.getAttribute("data-acc");if(!acc)return;
 if(acc==="lead"){var cj=t.closest("[data-lead]"),o={};cj.querySelectorAll("[data-l]").forEach(function(x){if(x.value!==""||x.getAttribute("data-l")==="estado")o[x.getAttribute("data-l")]=x.value});
  api("PATCH","/api/adventures/leads/"+cj.getAttribute("data-lead"),o).then(function(){msg("Guardado ✓");verLeads()}).catch(function(e){msg(e.message,1)});return}
 if(acc==="usd"){var gc=Object.assign({montos_q:[300,500],minimo_q:200,maximo_q:5000,vigencia_meses:12},B.ajustes.giftcards||{});gc.usd_fijos={};document.querySelectorAll("[data-usd]").forEach(function(x){if(x.value)gc.usd_fijos[x.getAttribute("data-usd")]=Number(x.value)});
  api("POST","/api/web/ajustes/giftcards",gc).then(function(){msg("Guardado");cargar()}).catch(function(e){msg(e.message,1)});return}
 if(acc==="tc"){api("POST","/api/web/ajustes/tipo_cambio_usd",{q_por_usd:document.getElementById("tc").value}).then(function(){msg("Guardado");cargar()}).catch(function(e){msg(e.message,1)});return}
 if(acc==="crear"){var n=t.closest("[data-nuevo]");api("POST","/api/web/"+n.getAttribute("data-nuevo"),leer(n)).then(function(){msg("Agregado");cargar()}).catch(function(e){msg(e.message,1)});return}
 var c=t.closest("[data-tipo]");var ruta="/api/web/"+c.getAttribute("data-tipo")+"/"+encodeURIComponent(c.getAttribute("data-llave"));
 var p=acc==="guardar"?api("PATCH",ruta,leer(c)):api("POST",ruta+"/activo",{activo:acc==="reactivar"});
 t.disabled=true;p.then(function(){msg("Guardado ✓");cargar()}).catch(function(e){t.disabled=false;msg(e.message,1)})});
document.getElementById("bVista").onclick=function(){window.open("/contenido-web/vista-previa?u="+encodeURIComponent(U),"_blank")};
document.getElementById("bPub").onclick=function(){var nota=prompt("¿Qué cambia en esta publicación? (queda en la bitácora)","");if(nota===null)return;
 api("POST","/api/web/publicar",{nota:nota}).then(function(r){msg("Publicada la versión "+r.version+(r.reconstruccion==="pedida"?". El sitio se actualiza en 1–2 minutos.":" ("+r.reconstruccion+")"));cargar()})
 .catch(function(e){msg(e.message,1)})};
cargar();`;

function contenidoWeb() {
  return pagina('Contenido web',
    '<header class="top"><h1>Contenido web</h1><small id="estado">…</small><span class="esp"></span><button id="bVista">Vista previa</button><button id="bPub" class="pri" style="display:none">Publicar</button></header>' +
    '<main><nav class="tabs"><button class="on" data-tab="textos">Textos</button><button data-tab="menu">Menú</button><button data-tab="faq">Preguntas</button><button data-tab="eventos">Eventos</button><button data-tab="fotos">Fotos</button><button data-tab="adventures">Adventures</button><button data-tab="operadores">Operadores</button><button data-tab="consultas">Consultas</button><button data-tab="versiones">Versiones</button></nav><div id="app">Leyendo…</div></main>',
    CONTENIDO_JS);
}

// ------------------------------------------------------------------------------------------------ Vista previa

const PREVIA_JS = API_JS + `
var L=new URLSearchParams(location.search).get("lang")==="en"?"en":"es",C=null,PG=null;
function t(x){return x?(x[L]||""):""}
function q(n){return n==null?"":"Q"+Number(n).toLocaleString("es-GT")}
function img(f){return f?"<img src=\\""+esc(f.url_chica)+"\\" alt=\\""+esc(t(f.alt))+"\\" style=\\"max-width:100%;border-radius:12px\\">":""}
function pintar(){var a=document.getElementById("app");var h="";
 if(C.faltan.length)h+="<div class=aviso><b>Antes de publicar falta:</b><ul>"+C.faltan.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ul></div>";
 if(C.fuera&&C.fuera.length)h+="<div class=aviso>"+C.fuera.map(esc).join("<br>")+"</div>";
 var c=C.contenido,ks=Object.keys(c.paginas);if(c.adventures&&c.adventures.experiencias.length&&ks.indexOf("adventures")<0)ks.push("adventures");if(!PG)PG=ks[0];
 h+="<div class=fila style=\\"margin:0 0 12px\\">"+ks.map(function(k){return "<button "+(k===PG?"class=on ":"")+"data-p=\\""+esc(k)+"\\">"+esc(k)+"</button>"}).join("")+"<span class=esp></span><button data-l=es"+(L==="es"?" class=pri":"")+">ES</button><button data-l=en"+(L==="en"?" class=pri":"")+">EN</button></div>";
 var p=c.paginas[PG]||null;
 if(p){h+="<div class=tarjeta><small>"+esc(p.ruta[L])+"</small><h1 style=\\"font-family:var(--rosanta-font-title)\\">"+esc(t(p.seo.titulo))+"</h1><p><small>"+esc(t(p.seo.descripcion))+"</small></p></div>";
  Object.keys(p.bloques).forEach(function(k){var b=p.bloques[k];h+="<div class=tarjeta><small>"+esc(k)+"</small>"+(b.tipo==="foto"?img(b.foto):b.tipo==="enlace"?"<p><a class=btn href=\\"#\\">"+esc(t(b))+"</a> <small>→ "+esc(b.enlace)+"</small></p>":"<p style=\\"white-space:pre-wrap\\">"+esc(t(b))+"</p>")+"</div>"})}
 if(PG==="menu"||/menu/.test(PG))c.menu.forEach(function(s){h+="<div class=tarjeta><h2>"+esc(t(s.nombre))+"</h2><p><small>"+esc(t(s.nota))+"</small></p>"+s.platos.map(function(x){return "<p><b>"+esc(t(x.nombre))+"</b> "+q(x.precio_q)+(x.precio_usd_ref?" <small>≈ US$"+x.precio_usd_ref+"</small>":"")+"<br><small>"+esc(t(x.descripcion))+(x.alergenos.length?" · "+x.alergenos.map(function(k){return esc(c.alergenos[k][L])}).join(", "):"")+"</small></p>"}).join("")+"</div>"});
 if(/faq|pregunta/.test(PG))c.faq.forEach(function(f){h+="<div class=tarjeta><b>"+esc(t(f.pregunta))+"</b><p style=\\"white-space:pre-wrap\\">"+esc(t(f.respuesta))+"</p></div>"});
 if(PG==="adventures")c.adventures.experiencias.forEach(function(x){h+="<div class=tarjeta><h3>"+esc(t(x.titulo))+"</h3><small>"+esc(t(x.duracion))+" · "+esc(t(x.dificultad_texto))+" · "+(x.precio_ref_q!=null?q(x.precio_ref_q):"")+" · "+esc(x.operador.nombre)+"</small>"+img(x.foto)+"<p style=\\"white-space:pre-wrap\\">"+esc(t(x.descripcion))+"</p><p><small><i>"+esc(t(x.aviso_legal))+"</i></small></p></div>"});
 if(/event/.test(PG))c.eventos.forEach(function(e){h+="<div class=tarjeta><h3>"+esc(t(e.titulo))+"</h3><small>"+esc(new Date(e.inicio).toLocaleString(L==="en"?"en-US":"es-GT",{timeZone:"America/Guatemala"}))+" · "+q(e.precio_q)+"</small>"+img(e.foto)+"<p>"+esc(t(e.descripcion))+"</p></div>"});
 a.innerHTML=h}
document.addEventListener("click",function(e){var p=e.target.getAttribute("data-p"),l=e.target.getAttribute("data-l");if(p){PG=p;pintar()}if(l){L=l;pintar()}});
api("GET","/api/web/vista-previa").then(function(j){C=j;pintar()}).catch(function(e){document.getElementById("app").innerHTML="<div class=aviso>"+esc(e.message)+"</div>"});`;

function vistaPrevia() {
  return pagina('Vista previa', '<header class="top"><h1>Vista previa del borrador</h1><small>así quedaría al publicar (el diseño final es el del sitio)</small></header><main><div id="app">Leyendo…</div></main>', PREVIA_JS);
}

// ------------------------------------------------------------------------------------------------ Gift cards: canje

const CANJE_JS = API_JS + `
var T=null;
function q(n){return "Q"+Number(n||0).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2})}
function buscar(){var c=document.getElementById("codigo").value;if(!c)return;api("GET","/api/giftcards/buscar?codigo="+encodeURIComponent(c)).then(function(t){T=t;pintar()}).catch(function(e){T=null;document.getElementById("tarj").innerHTML="<div class=aviso>"+esc(e.message)+"</div>"})}
function pintar(){var t=T,h="<div class=tarjeta><div class=fila style=\\"margin:0\\"><b style=\\"font-size:1.2rem\\">"+esc(t.codigo)+"</b><span class=chip>"+esc(t.estado)+"</span></div>"+
 "<p style=\\"font-size:2rem;margin:10px 0\\">Saldo <b>"+q(t.saldo)+"</b> <small>de "+q(t.monto)+"</small></p><p>Para <b>"+esc(t.destinatario_nombre)+"</b> · de "+esc(t.comprador_nombre)+" · vence el <b>"+esc(t.vence)+"</b></p>";
 if(t.se_puede_canjear)h+="<div class=dos><div><label>Monto a descontar (Q)</label><input id=monto inputmode=decimal></div><div><label>Mesa o número de cuenta del POS</label><input id=ref></div></div>"+
  "<label>Dónde</label><select id=donde><option value=sala>Sala</option><option value=caja>Caja</option></select><label>Nota (opcional)</label><input id=nota>"+
  (t.estado==="vencida"?"<p class=mal>Venció: solo el dueño puede aceptarla.</p>":"")+"<div class=fila><button class=pri id=bCanje>Descontar</button></div>";
 else h+="<p class=mal>No se puede canjear ("+esc(t.estado)+").</p>";
 h+="</div><div class=tarjeta><b>Movimientos</b><table><tr><th>Cuándo</th><th>Qué</th><th class=n>Monto</th><th class=n>Saldo</th><th>Quién</th><th>Ref.</th><th></th></tr>"+t.movimientos.map(function(m){
  var hecho=t.movimientos.some(function(x){return x.movimiento_ref===m.id});
  return "<tr><td>"+esc(new Date(m.cuando).toLocaleString("es-GT"))+"</td><td>"+esc(m.tipo)+"</td><td class=n>"+q(m.monto)+"</td><td class=n>"+q(m.saldo_despues)+"</td><td>"+esc(m.quien)+"</td><td>"+esc(m.referencia)+"</td><td>"+(m.tipo==="canje"&&!hecho?"<button data-rev="+m.id+">Deshacer</button>":"")+"</td></tr>"}).join("")+"</table></div>";
 document.getElementById("tarj").innerHTML=h;
 var b=document.getElementById("bCanje");if(b)b.onclick=function(){var m=document.getElementById("monto").value;if(!confirm("¿Descontar Q"+m+" de "+t.codigo+"?"))return;b.disabled=true;
  api("POST","/api/giftcards/canjear",{codigo:t.codigo,monto:m,referencia:document.getElementById("ref").value,donde:document.getElementById("donde").value,nota:document.getElementById("nota").value,forzar_vencida:t.estado==="vencida"})
  .then(function(r){msg("Listo: quedan "+q(r.saldo));buscar()}).catch(function(e){b.disabled=false;msg(e.message,1)})}}
document.addEventListener("click",function(e){var r=e.target.getAttribute("data-rev");if(!r)return;var n=prompt("¿Por qué se deshace este canje?","");if(n===null)return;
 api("POST","/api/giftcards/reversar",{movimiento:r,nota:n}).then(function(){msg("Canje deshecho");buscar()}).catch(function(e){msg(e.message,1)})});
document.getElementById("bBuscar").onclick=buscar;document.getElementById("codigo").onkeydown=function(e){if(e.key==="Enter")buscar()};
document.getElementById("bEmitir").onclick=function(){var f=document.getElementById("emitir");var o={};f.querySelectorAll("[data-c]").forEach(function(x){o[x.getAttribute("data-c")]=x.type==="checkbox"?x.checked:x.value});
 api("POST","/api/giftcards/emitir",o).then(function(r){msg("Emitida "+r.codigo);document.getElementById("codigo").value=r.codigo;buscar()}).catch(function(e){msg(e.message,1)})};
document.getElementById("bAnular").onclick=function(){if(!T)return msg("Buscá la tarjeta primero",1);var n=prompt("¿Por qué se anula "+T.codigo+"?","");if(!n)return;
 api("POST","/api/giftcards/anular",{codigo:T.codigo,nota:n}).then(function(){msg("Anulada");buscar()}).catch(function(e){msg(e.message,1)})};
document.getElementById("bRep").onclick=function(){var m=document.getElementById("mes").value;api("GET","/api/giftcards/reporte?mes="+m).then(function(r){var g=r.totales.giftcards;
 document.getElementById("rep").innerHTML="<table><tr><td>Saldo al inicio</td><td class=n>"+q(g.saldo_inicio)+"</td></tr><tr><td>Vendido ("+g.n_vendidas+")</td><td class=n>"+q(g.vendido)+"</td></tr><tr><td>Canjeado ("+g.n_canjes+")</td><td class=n>"+q(g.canjeado)+"</td></tr><tr><td>Anulado</td><td class=n>"+q(g.anulado)+"</td></tr><tr><td>Vencido</td><td class=n>"+q(g.vencido)+"</td></tr><tr><td><b>Saldo vivo (pasivo)</b></td><td class=n><b>"+q(g.saldo_cierre)+"</b></td></tr></table>"+
 (r.diferencias.length?"<p class=mal>"+r.diferencias.map(esc).join("<br>")+"</p>":"<p class=ok>Cuadra.</p>")+(r.avisos.length?"<p><small>"+r.avisos.map(esc).join("<br>")+"</small></p>":"")}).catch(function(e){msg(e.message,1)})};
document.getElementById("mes").value=new Date().toISOString().slice(0,7);`;

function canjeGiftcards() {
  const campo = (c, e, extra) => '<label>' + e + '</label><input data-c="' + c + '"' + (extra || '') + '>';
  return pagina('Gift cards',
    '<header class="top"><h1>Gift cards</h1><small>canje en sala y caja</small></header><main>' +
    '<div class="tarjeta"><label>Código</label><div class="fila" style="margin:0"><input id="codigo" placeholder="RSNT-XXXX-XXXX" autocapitalize="characters" style="flex:1;font-size:1.2rem"><button class="pri" id="bBuscar">Buscar</button></div></div>' +
    '<div id="tarj"></div>' +
    '<details class="tarjeta"><summary><b>Oficina (solo el dueño)</b></summary>' +
    '<h3>Emitir una vendida por depósito</h3><div id="emitir"><div class="dos"><div>' + campo('valor_q', 'Valor (Q)', ' inputmode="numeric" value="300"') + '</div><div>' + campo('referencia', 'Depósito (banco y número)') + '</div></div>' +
    '<div class="dos"><div>' + campo('comprador_nombre', 'Quién la compra') + campo('comprador_email', 'Su correo') + '</div><div>' + campo('destinatario_nombre', 'Para quién') + campo('destinatario_email', 'Su correo') + '</div></div>' +
    campo('mensaje', 'Mensaje') + '<label>Idioma</label><select data-c="idioma"><option value="es">Español</option><option value="en">English</option></select>' +
    '<label style="text-transform:none"><input type="checkbox" data-c="enviar_correo" style="width:auto"> Mandar el correo con la tarjeta</label><div class="fila"><button class="pri" id="bEmitir">Emitir</button><button id="bAnular">Anular la tarjeta buscada</button></div></div>' +
    '<h3>Reporte del mes</h3><div class="fila"><input id="mes" type="month" style="width:auto"><button id="bRep">Ver</button></div><div id="rep"></div></details></main>',
    CANJE_JS);
}

// ------------------------------------------------------------------------------------------------ Gift cards: compra (publica)

const COMPRA_JS = ESC_JS + `
var EN=new URLSearchParams(location.search).get("lang")==="en";var P=null,VAL=null;
var TX=EN?{t:"Rosanta gift card",m:"Choose an amount",o:"Other amount",de:"Your details",n:"Your name",e:"Your email",tel:"Phone (optional)",para:"Who is it for?",pn:"Their name",pe:"Their email (empty = we send it to you to print)",msj:"Message",f:"Send on (empty = right away)",mon:"Pay in",b:"Continue to payment",no:"Online purchase is not available yet. Write to us and we will sell it to you by bank transfer.",min:"From Q",esc:"Write to us",libre:"other amount from Q"}
 :{t:"Gift card Rosanta",m:"Elige un monto",o:"Otro monto",de:"Tus datos",n:"Tu nombre",e:"Tu correo",tel:"Teléfono (opcional)",para:"¿Para quién es?",pn:"Su nombre",pe:"Su correo (vacío = te la mandamos a ti para imprimir)",msj:"Mensaje",f:"Enviar el (vacío = apenas se pague)",mon:"Pagar en",b:"Ir a pagar",no:"La compra en línea todavía no está disponible. Escríbenos y te la vendemos por depósito.",min:"Desde Q",esc:"Escríbenos",libre:"otro monto desde Q"};
function el(id){return document.getElementById(id)}
function pintar(){var h="<h1 style=\\"font-family:var(--rosanta-font-title)\\">"+TX.t+"</h1>";
 if(!P.cobro_en_linea){var k=P.contacto||{},bt=[];
  if(k.whatsapp)bt.push("<a class=\\"btn pri\\" href=\\"https://wa.me/"+esc(String(k.whatsapp).replace(/[^0-9]/g,""))+"\\">WhatsApp</a>");
  if(k.correo)bt.push("<a class=btn href=\\"mailto:"+esc(k.correo)+"?subject=Gift%20card\\">"+esc(k.correo)+"</a>");
  el("app").innerHTML=h+"<div class=tarjeta><p>"+P.montos.map(function(m){return "Q"+m.q+" <small>≈ US$"+m.usd+"</small>"}).join(" · ")+" · "+TX.libre+P.minimo_q+"</p><div class=aviso>"+TX.no+"</div><div class=fila><b>"+TX.esc+":</b> "+bt.join(" ")+"</div></div>";return}
 h+="<div class=tarjeta><label>"+TX.m+"</label><div class=fila>"+P.montos.map(function(m){return "<button data-v="+m.q+">Q"+m.q+" <small>≈ US$"+m.usd+"</small></button>"}).join("")+"</div><label>"+TX.o+" ("+TX.min+P.minimo_q+")</label><input id=libre inputmode=numeric></div>"+
 "<div class=tarjeta><label>"+TX.de+"</label><div class=dos><input id=cn placeholder=\\""+TX.n+"\\"><input id=ce type=email placeholder=\\""+TX.e+"\\"></div><input id=ct placeholder=\\""+TX.tel+"\\" style=\\"margin-top:8px\\"></div>"+
 "<div class=tarjeta><label>"+TX.para+"</label><div class=dos><input id=dn placeholder=\\""+TX.pn+"\\"><input id=de type=email placeholder=\\""+TX.pe+"\\"></div><label>"+TX.msj+"</label><textarea id=msj maxlength=300></textarea><label>"+TX.f+"</label><input id=fe type=date>"+
 "<input id=sitio_web tabindex=-1 autocomplete=off style=\\"position:absolute;left:-9999px\\"></div>"+
 "<div class=tarjeta><label>"+TX.mon+"</label><select id=mon><option value=GTQ>Quetzales (GTQ)</option><option value=USD>US$ (USD)</option></select><div class=fila><button class=pri id=ir>"+TX.b+"</button></div></div>";
 el("app").innerHTML=h;
 el("ir").onclick=function(){var v=VAL||el("libre").value;var b=el("ir");b.disabled=true;
  var ps=new URLSearchParams(location.search),origen={};["utm_source","utm_medium","utm_campaign","gclid","fbclid"].forEach(function(k){if(ps.get(k))origen[k]=ps.get(k)});if(document.referrer)origen.referrer=document.referrer;
  fetch("/api/giftcards/pedido",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({valor_q:Number(v),moneda:el("mon").value,idioma:EN?"en":"es",
   comprador:{nombre:el("cn").value,email:el("ce").value,telefono:el("ct").value},destinatario:{nombre:el("dn").value,email:el("de").value},mensaje:el("msj").value,enviar_el:el("fe").value||null,sitio_web:el("sitio_web").value,origen:origen})})
  .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error);location.href=j.checkout_url})}).catch(function(e){b.disabled=false;alert(e.message)})}}
document.addEventListener("click",function(e){var b=e.target.closest("[data-v]");if(!b)return;VAL=Number(b.getAttribute("data-v"));document.querySelectorAll("[data-v]").forEach(function(x){x.classList.toggle("pri",x===b)});el("libre").value=""});
document.addEventListener("input",function(e){if(e.target.id==="libre"){VAL=null;document.querySelectorAll("[data-v]").forEach(function(x){x.classList.remove("pri")})}});
fetch("/api/giftcards/precios").then(function(r){return r.json()}).then(function(j){P=j;pintar()});`;

function compraGiftcard() {
  return pagina('Gift card', '<main style="max-width:640px"><div id="app">…</div></main>', COMPRA_JS).replace('<meta name="robots" content="noindex">', '');
}

module.exports = { contenidoWeb, vistaPrevia, canjeGiftcards, compraGiftcard };
