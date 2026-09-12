# -*- coding: utf-8 -*-
import openpyxl, json, math
SRC='/sessions/clever-hopeful-pascal/mnt/uploads/Inventario_8_17_2026_115527.xlsx'
OUT='/sessions/clever-hopeful-pascal/mnt/outputs/rosanta_actualizar_precios.html'
wb=openpyxl.load_workbook(SRC,data_only=True); ws=wb.active
data=[r for r in list(ws.iter_rows(values_only=True))[1:] if r[2] is not None]

# Precio objetivo carta 2027 por LLAVE (solo donde está confirmado). El resto = precio actual (editable).
TARGET={
 # Comida
 3:75, 6:135, 4:100, 1:140, 7:150, 10:210, 8:105, 183:130, 2:100, 302:105,
 161:155, 253:185, 255:195, 326:165, 12:180, 11:180, 344:180, 17:190, 16:185, 162:325,
 370:115, 382:115, 383:100, 384:115, 385:180, 386:165,
 146:20, 19:40, 20:45, 18:35,
 # Cócteles de autor 80
 81:80,387:80,192:80,89:80,311:80,184:80,86:80,84:80,88:80,87:80,83:80,348:80,82:80,341:80,
 # Cócteles de casa 75
 95:75,174:75,313:75,274:75,193:75,349:75,96:75,342:75,
 # Cóctel jardín
 93:65,
 # Digestivos
 160:70,159:70,305:60,
 # Bebidas
 191:25,128:25,97:40,98:40,99:40,152:40,100:40,101:40,103:35,
 130:35,131:35,132:35,330:45,345:45,331:45,346:45,295:35,296:35,
 # Cervezas
 105:35,107:40,106:40,108:45,109:45,139:25,
 # Destilados copa
 51:50,52:50,53:60,54:70,55:110,56:50,58:70,59:75,60:70,61:75,64:75,70:70,367:70,
 66:75,67:75,68:130,358:130,69:60,75:50,76:60,77:85,270:90,78:75,
 306:75,278:75,337:75,339:75,
 # Vinos por copa (carta de vinos 2027 = Q70)
 116:70,175:70,133:70,145:70,247:70,368:70,
 # Vinos por botella
 135:350,176:350,120:350,136:350,   # La Linda / Mariluna tinto / Mariluna blanco / La Val = 350
 114:535,   # Pulenta
 246:375,   # Bohigas Garnatxa Negra
 258:510,   # Santiago Ruiz
 314:375,   # Salentein Killka
 119:375,   # Pasión de Bodal (rosado) — carta corregida (405 era taclazo)
 115:350,369:350,  # Cousiño Cabernet / Chardonnay → Don Luis 350
 # Cava / espumante
 122:375,   # Cava Bohigas Brut Reserva
}
# Notas por llave
NOTE={
 11:"Renombrar → Lomito a la Parrilla",
 344:"Renombrar → Brisket en Salsa Bordelesa",
 278:"Consolidar en 'Mezcal Artesanal' (306)",
 337:"Consolidar en 'Mezcal Artesanal' (306)",
 339:"Consolidar en 'Mezcal Artesanal' (306)",
 70:"Duplicado con 367 — dejar uno",
 367:"Duplicado con 70 — dejar uno",
 68:"Duplicado con 358 — dejar uno",
 358:"Duplicado con 68 — dejar uno",
 56:"Duplicado con 332 — dejar uno",
 207:"Welcome cocktail — precio de evento",
 # vinos
 115:"Carta: Cabernet 'Don Luis' — renombrar",
 368:"Carta: Cabernet 'Don Luis' — renombrar",
 369:"Carta: Chardonnay 'Don Luis' — renombrar",
 247:"Chardonnay por copa (Don Luis)",
 315:"En carta Killka es solo botella (no copa)",
 156:"En carta Pasión es solo botella (no copa)",
 197:"No está en la carta de vinos 2027",
 347:"No está en la carta de vinos 2027",
}
# categorías consideradas fuera de carta (revisar, sin objetivo prefijado)
REVISAR_CAT={'Eventos','Especial Día','Adicionales','Menú Especial','Brunch Dulce','Brunch Cocteleria','General'}

# --- Membresía en la carta 2027 (LISTA BLANCA exacta) ---
# Fuentes: Menú 2027 VF (comida + bebidas), Carta de Vinos 2027, y la barra
# (cócteles de autor/casa/jardín + destilados de carta por copa y botella).
CARTA_LLAVES={
 # COMIENZOS / PARA EMPEZAR
 3,4,6, 370,384,1,7,10, 2,383,302,382,
 # HAMBURGUESAS (en el POS están como 'Entrante')
 8,183,
 # FUERTES
 161,253,255, 386,326,12,11,344,385,16,17,162,
 # GUARNICIONES
 146,19,18,20,
 # BEBIDAS: café, refrescos, tés, infusiones
 191,128, 103,97,98,99,152,100,101, 130,131,132, 330,331,
 # CERVEZAS
 139,105,107,106,108,109,
 # DIGESTIVOS
 160,159,305,
 # CÓCTELES autor / casa / jardín
 81,387,192,89,311,184,86,84,88,87,83,348,82,341,
 95,174,313,274,193,349,96,342, 93,
 # DESTILADOS copa (carta)
 51,52,53,54,55,56,58,59,60,61,64,70,367,66,67,68,358,69,75,76,77,270,78,306,278,337,339,
 # DESTILADOS botella (carta)
 21,22,23,24,25,28,29,30,31,34,36,37,38,39,45,46,47,48,142,333,336,338,276,
 # VINOS (carta de vinos 2027)
 116,175,133,145,247,368, 135,176,120,136,114,246,258,314,119,115,369, 122,
}
def en_carta(llave,cat):
    return llave in CARTA_LLAVES

ORDER=['Entrante','Fuerte','Guarniciones','Postre','Coctel Autor','Coctel Casa','Coctel Jardín',
 'Digestivo','Licor Copa','Licor Botella','Vino Copa','Vino Botella','Espumante','Cerveza',
 'Refresco & Agua','Café & Té','Brunch Dulce','Brunch Cocteleria','Especial Día','Adicionales','Eventos','Menú Especial','General']

groups={}
for r in data:
    try: llave=int(r[0])
    except: llave=r[0]
    nombre=str(r[2]).strip(); actual=r[4]; cat=str(r[6] or '').strip()
    try: actual=float(actual)
    except: actual=0
    sug=TARGET.get(llave, actual)
    # Licor Botella: +7% redondeado hacia arriba al múltiplo de 5
    if cat=='Licor Botella' and actual and actual>0:
        sug=int(math.ceil(actual*1.07/5.0)*5)
    note=NOTE.get(llave,'')
    carta=1 if en_carta(llave,cat) else 0
    groups.setdefault(cat,[]).append([llave,nombre,actual,sug,note,carta])

G=[]
for cat in ORDER:
    if cat in groups:
        items=sorted(groups[cat],key=lambda x:(x[0] if isinstance(x[0],int) else 9999))
        G.append([cat,items])
# cualquier categoría no listada
for cat in groups:
    if cat not in ORDER:
        G.append([cat,sorted(groups[cat],key=lambda x:str(x[0]))])

DATA=json.dumps(G,ensure_ascii=False)
def _ll(x):
    try: return int(x)
    except: return x
ncambios=sum(1 for r in data if TARGET.get(_ll(r[0])) is not None and float(r[4] or 0)!=TARGET[_ll(r[0])])
print("Productos:",len(data),"| con objetivo prefijado:",sum(1 for r in data if _ll(r[0]) in TARGET),"| cambian precio:",ncambios)

HTML=r'''<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rosanta · Actualizar precios del POS</title><style>
:root{color-scheme:light;--verde:#4A6741;--tierra:#A0785A;--crema:#F5EFE0;--cobre:#C9923F;--marron:#3D2B1F;--linea:#e2d8c4;
 --sube:#3c6b32;--baja:#a3564a;--igual:#8a7a5c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#fbf8f1;color:var(--marron);line-height:1.4;padding:0 0 80px}
.wrap{max-width:900px;margin:0 auto;padding:0 12px}
header{background:var(--verde);color:#fff;padding:18px 16px;text-align:center}
header .kick{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#e2dabf}
header h1{font-size:19px;font-weight:600;margin-top:5px}header .sub{font-size:12px;color:#e9dfca;margin-top:5px}
.ctrl{position:sticky;top:0;z-index:8;background:#fbf8f1;border-bottom:1px solid var(--linea);padding:9px 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center}
.ctrl input[type=search]{flex:1;min-width:150px;max-width:300px;font-size:13px;padding:6px 10px;border:1px solid var(--linea);border-radius:8px;background:#fff;color:var(--marron);font-family:inherit}
.ctrl select{font-size:12.5px;padding:6px 8px;border:1px solid var(--linea);border-radius:8px;background:#fff;color:var(--marron);font-family:inherit}
.chip{font-size:12px;font-weight:600;padding:6px 12px;border-radius:20px;border:1px solid var(--linea);background:#fff;color:var(--tierra);cursor:pointer;user-select:none}
.chip.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.prog{position:sticky;top:47px;z-index:7;background:#fbf8f1;border-bottom:1px solid var(--linea);padding:7px 12px;font-size:12.5px;text-align:center}
.prog b{color:var(--verde)}.bar{height:7px;background:#e7dfce;border-radius:6px;margin-top:5px;overflow:hidden;max-width:520px;margin-left:auto;margin-right:auto}.bar>i{display:block;height:100%;background:var(--verde);width:0}
table{width:100%;border-collapse:collapse;background:#fff;font-size:12.5px}
thead th{position:sticky;top:88px;background:var(--tierra);color:#fff;font-size:11px;font-weight:600;padding:7px 8px;text-align:left;border:1px solid #cbb48f}
thead th.n{text-align:right}
tbody td{padding:5px 8px;border:1px solid var(--linea);vertical-align:middle}
td.ckc{text-align:center;width:34px}
.ck{width:20px;height:20px;border:2px solid var(--tierra);border-radius:5px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:13px}
tr.done .ck{background:var(--verde);border-color:var(--verde)}
tr.done td{color:#a89c88;text-decoration:line-through;text-decoration-color:#c9bda3}
tr.done .ck,tr.done input{text-decoration:none}
td.cod{text-align:center;width:66px}
td.cod .cb{display:inline-block;font-weight:800;color:#fff;background:var(--cobre);border-radius:7px;padding:3px 8px;font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:.3px}
td.act{text-align:right;color:#8a7a5c;font-variant-numeric:tabular-nums;width:70px}
td.nue{text-align:right;width:92px}
input.px{width:74px;font-size:13px;padding:5px 6px;border:1px solid var(--cobre);border-radius:7px;background:#FFF7E0;color:var(--marron);text-align:right;font-family:inherit;font-weight:700}
td.est{width:74px;text-align:center}
.b{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px}
.b.sube{background:#e7f0e1;color:var(--sube)}.b.baja{background:#f3d9d4;color:var(--baja)}.b.igual{background:#efe9db;color:var(--igual)}
.catrow td{background:#f4eede;color:var(--verde);font-weight:700;font-size:11.5px;letter-spacing:.5px;text-transform:uppercase}
.note{font-size:10.5px;color:var(--cobre);display:block;margin-top:1px}
.cta{display:inline-block;font-size:9.5px;font-weight:800;color:#fff;background:var(--verde);border-radius:9px;padding:1px 7px;margin-right:6px;letter-spacing:.4px;vertical-align:middle}
td.carta-cell{width:70px;text-align:center}
.dash{color:#c3b79d}
.foot{font-size:11px;color:var(--tierra);text-align:center;margin-top:12px;padding:0 12px}
.reset{display:block;margin:14px auto 0;background:none;border:1px solid var(--linea);color:var(--tierra);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer}
</style></head><body>
<header><div class="kick">Rosanta · PosFile</div><h1>Actualizar precios del POS · carta 2027</h1>
<div class="sub">Ve producto por producto: verifica el precio nuevo, cámbialo en el POS y tacha. El precio nuevo es editable.</div></header>
<div class="ctrl">
 <input type="search" id="q" placeholder="Buscar código o nombre…">
 <select id="cat"></select>
 <span class="chip" id="cartachip">Solo carta 2027</span>
 <span class="chip" id="chgchip">Solo con cambio</span>
 <span class="chip" id="hidechip">Ocultar tachados</span>
</div>
<div class="prog"><span id="pt">0 de 0 · 0%</span><div class="bar"><i id="pb"></i></div></div>
<div class="wrap"><div id="app"></div><button class="reset" id="reset">Reiniciar (marcas y precios)</button><div class="foot" id="foot"></div></div>
<script>
const G=__DATA__;
const KEY='rosanta_precios_pos_v1';
let st={done:{},px:{},q:'',cat:'all',onlyChg:false,hideDone:false,onlyCarta:false};
try{Object.assign(st,JSON.parse(localStorage.getItem(KEY))||{})}catch(e){}
if(!st.done)st.done={};if(!st.px)st.px={};
const $=s=>document.querySelector(s);
function save(){try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}
const q=v=>'Q'+Number(v).toLocaleString('es-GT',{maximumFractionDigits:2});
// catálogo de categorías
(function(){const sel=$('#cat');let o='<option value=\"all\">Todas las categorías</option>';G.forEach(g=>{o+='<option value=\"'+g[0]+'\">'+g[0]+'</option>'});sel.innerHTML=o;sel.value=st.cat;})();
$('#q').value=st.q;
$('#cartachip').classList.toggle('on',st.onlyCarta);
$('#chgchip').classList.toggle('on',st.onlyChg);
$('#hidechip').classList.toggle('on',st.hideDone);
function nuevoDe(llave,sug){return (st.px[llave]!==undefined)?st.px[llave]:sug;}
function estado(actual,nuevo){const a=+actual,n=+nuevo;if(isNaN(n))return['',''];if(n>a)return['sube','sube'];if(n<a)return['baja','baja'];return['igual','igual'];}
window.setPx=function(llave,val){const n=parseFloat(val);if(isNaN(n)){delete st.px[llave]}else{st.px[llave]=n}save();render()};
window.togD=function(llave){if(st.done[llave])delete st.done[llave];else st.done[llave]=1;save();render()};
function render(){
 const app=$('#app');app.innerHTML='';
 const term=(st.q||'').toLowerCase().trim();
 let tot=0,done=0,shown=0;
 G.forEach(g=>{
  const [cat,items]=g;
  if(st.cat!=='all'&&st.cat!==cat)return;
  let body='',ncat=0;
  items.forEach(it=>{
   const [llave,nombre,actual,sug,note,carta]=it;
   tot++; const dn=!!st.done[llave]; if(dn)done++;
   const nuevo=nuevoDe(llave,sug);
   const [ecls,etxt]=estado(actual,nuevo);
   if(st.onlyCarta&&!carta)return;
   if(st.onlyChg&&ecls!=='sube'&&ecls!=='baja')return;
   if(term&&(String(llave)+' '+nombre.toLowerCase()).indexOf(term)<0)return;
   if(st.hideDone&&dn)return;
   shown++;ncat++;
   body+='<tr class=\"'+(dn?'done':'')+'\">'
    +'<td class=\"ckc\"><span class=\"ck\" onclick=\"togD('+"'"+llave+"'"+')\">'+(dn?'✓':'')+'</span></td>'
    +'<td class=\"cod\"><span class=\"cb\">#'+llave+'</span></td>'
    +'<td class=\"carta-cell\">'+(carta?'<span class=\"cta\">CARTA</span>':'<span class=\"dash\">—</span>')+'</td>'
    +'<td>'+nombre+(note?'<span class=\"note\">'+note+'</span>':'')+'</td>'
    +'<td class=\"act\">'+q(actual)+'</td>'
    +'<td class=\"nue\"><input class=\"px\" type=\"number\" step=\"1\" value=\"'+nuevo+'\" oninput=\"setPx('+"'"+llave+"'"+',this.value)\"></td>'
    +'<td class=\"est\">'+(etxt?'<span class=\"b '+ecls+'\">'+etxt+'</span>':'')+'</td>'
   +'</tr>';
  });
  if(ncat>0){
   app.insertAdjacentHTML('beforeend','<table><tbody><tr class=\"catrow\"><td colspan=\"7\">'+cat+' · '+ncat+'</td></tr>'
    +'<tr><th class=\"ckc\"></th><th style=\"text-align:center\">Código POS</th><th style=\"text-align:center\">Carta</th><th>Producto</th><th class=\"n\">Actual</th><th class=\"n\">Precio nuevo</th><th class=\"n\">Cambio</th></tr>'
    +body+'</tbody></table>');
  }
 });
 const pct=tot?Math.round(done/tot*100):0;
 $('#pt').innerHTML='<b>'+done+'</b> de '+tot+' actualizados · '+pct+'% · '+shown+' en pantalla';
 $('#pb').style.width=pct+'%';
 $('#foot').textContent='Precio nuevo editable (amarillo). Verde = sube · rojo = baja · gris = igual. Fuente objetivo: carta 2027. Los que no tienen objetivo confirmado quedan en su precio actual para que lo edites.';
}
$('#q').oninput=()=>{st.q=$('#q').value;save();render()};
$('#cat').onchange=()=>{st.cat=$('#cat').value;save();render()};
$('#cartachip').onclick=()=>{st.onlyCarta=!st.onlyCarta;$('#cartachip').classList.toggle('on',st.onlyCarta);save();render()};
$('#chgchip').onclick=()=>{st.onlyChg=!st.onlyChg;$('#chgchip').classList.toggle('on',st.onlyChg);save();render()};
$('#hidechip').onclick=()=>{st.hideDone=!st.hideDone;$('#hidechip').classList.toggle('on',st.hideDone);save();render()};
$('#reset').onclick=()=>{if(confirm('¿Borrar marcas y precios editados?')){st.done={};st.px={};save();render()}};
render();
</script></body></html>'''
HTML=HTML.replace('__DATA__',DATA)
open(OUT,'w').write(HTML)
print("Guardado:",OUT)
