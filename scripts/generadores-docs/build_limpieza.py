# -*- coding: utf-8 -*-
import openpyxl, unicodedata, json
SRC='/sessions/clever-hopeful-pascal/mnt/uploads/Inventario_8_11_2026_21223.xlsx'
OUT='/sessions/clever-hopeful-pascal/mnt/outputs/rosanta_limpieza_pos.html'
def norm(s): return ''.join(c for c in unicodedata.normalize('NFD',str(s).lower()) if unicodedata.category(c)!='Mn').strip()
wb=openpyxl.load_workbook(SRC,data_only=True); ws=wb.active
rows=[]
hdr=None
for r in ws.iter_rows(values_only=True):
    if hdr is None: hdr=r; continue
    if r[2] is None: continue
    rows.append({'llave':r[0],'nombre':str(r[2]).strip(),'exist':r[3],'pv':r[4],'cat':str(r[6] or '').strip()})

KEEP=[ # patrones (normalizados) que SÍ están en la carta 2027 + altas + barra 2027
 'queso horneado','tartar de hongos','ensalada rosanta','ensalada con lomito','ensalada con camarones',
 'coliflor a la parrilla','pulpo a la parrilla','jamones y quesos','portobello','hamburguesa de lomito','lomito en tiras',
 'bol mediterraneo','vegetales fermentados','bock choy','bok choy','brocoli con nduja',
 'pasta del chef','pasta con lomito','pasta con camarones','pasta de la casa','arroz meloso',
 'pollo en salsa de tamarindo','costilla de cerdo','lomito rosanta','lomito a la parrilla','briskeat','brisket',
 'camarones al horno','pescado del dia','mar y tierra','estofado de rabo',
 'porcion pan','pan de la casa','gratin de papas','ejotes','mix de fritas',
 'cafe americano','cafe con leche','ginger beer','kombucha','limonada','naranjada','refresco de citronela','soda del dia',
 'agua con gas','manzanilla','gengibre','lemongrass','hierbaluisa','pachamama','jade negro',
 'gallo','cabro','monte carlo','antigua','michelada',
 'limoncello','grand marnier','carajillo','espresso martini','expresso martini',
 'mezcal a la pina','fufuruto','fufurufo','red pepper','negroni','remolacha','el colonial','el canche','la loteria',
 'la chef','la feria','chiatenango','chaitenango','boga','el mero','los penitentes','el cuaje','comal borracho','mimosa',
 'botran','colonial','zacapa','smirnoff','grey goose','ciroc','old parr','buchanan','johnnie walker','wild turkey',
 'glenmorangie','glenlivet','macallan','jameson','bombay','tanqueray','hendricks','jimador','don julio','1800 cristalino',
 'espadin','tobaciche','tobachiche','cuapreata','cupreata',
]
EVENT=['menu especial','eventos','especial dia','adicionales','promo','brunch','shot','digestivo']  # digestivo revisará luego
FOOD=['fuerte','entrante','guarniciones','postre']
COCTEL=['coctel autor','coctel casa','coctel jardin','coctel jardín']
VINO=['vino','espumante','vinos naturales']

keep=[]; baja_evt=[]; baja_food=[]; baja_coc=[]; rev_vino=[]; rev_licor=[]; rev_otro=[]
for it in rows:
    n=norm(it['nombre']); cat=norm(it['cat'])
    if it['nombre']=='Producto Personalizado':
        keep.append(it); continue
    matched=any(k in n for k in KEEP)
    is_event= any(e in cat for e in ['menu especial','eventos','especial dia','adicionales','promo','brunch','shot'])
    if is_event:
        baja_evt.append(it)
    elif matched:
        keep.append(it)
    elif any(f in cat for f in FOOD):
        baja_food.append(it)
    elif any(c in cat for c in COCTEL):
        baja_coc.append(it)
    elif any(v in cat for v in VINO):
        rev_vino.append(it)
    elif 'licor' in cat:
        rev_licor.append(it)
    else:
        rev_otro.append(it)

def fmt(it):
    pv=it['pv']
    pvs=(int(pv) if isinstance(pv,(int,float)) else pv)
    return "#{} · {} — Q{} — {}".format(it['llave'], it['nombre'], pvs, it['cat'])
def _k(z):
    try: return int(z['llave'])
    except: return 999999
def block(lst): return [fmt(x) for x in sorted(lst,key=_k)]

G=[
 ["BAJA · Menús de evento y temporada","Fin de Año, Boda, Eventos, Menú Especial, Especial Día, Adicionales, Promos, Brunch, Shots — ya no van en la carta", block(baja_evt)],
 ["BAJA · Platos descontinuados (comida)","Comida que no está en la carta 2027", block(baja_food)],
 ["BAJA · Cócteles fuera de la carta","Confirmar con barra antes de borrar", block(baja_coc)],
 ["REVISAR · Vinos y espumantes","¿Hay carta de vinos aparte? No borrar sin confirmar", block(rev_vino)],
 ["REVISAR · Licores / destilados","Muchos son back bar o ingrediente (p. ej. Campari para el Negroni). No borrar si se usan en recetas", block(rev_licor)],
 ["REVISAR · Bebidas, cafés y otros","Sodas, aguas y varios no verificados contra la carta", block(rev_otro)],
]
counts={g[0]:len(g[2]) for g in G}
print("KEEP:",len(keep))
for g in G: print(g[0],"→",len(g[2]))
print("TOTAL a decidir:",sum(len(g[2]) for g in G))

DATA=json.dumps(G,ensure_ascii=False)
html='''<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rosanta · Limpieza del POS</title><style>
:root{color-scheme:light;--verde:#4A6741;--tierra:#A0785A;--crema:#F5EFE0;--cobre:#C9923F;--marron:#3D2B1F;--linea:#e2d8c4;--rojo:#a3564a}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#fbf8f1;color:var(--marron);line-height:1.4;padding:0 0 70px}
.wrap{max-width:840px;margin:0 auto;padding:0 16px}
header{background:var(--verde);color:#fff;padding:20px 16px;text-align:center}
header .kick{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#e2dabf}header h1{font-size:20px;font-weight:600;margin-top:5px}header .sub{font-size:12px;color:#e9dfca;margin-top:6px}
.prog{position:sticky;top:0;z-index:5;background:#fbf8f1;border-bottom:1px solid var(--linea);padding:10px 16px;font-size:13px;text-align:center}.prog b{color:var(--verde)}
.bar{height:8px;background:#e7dfce;border-radius:6px;margin-top:6px;overflow:hidden}.bar>i{display:block;height:100%;background:var(--verde);width:0%}
.grp{margin-top:20px}.grp .band{color:#fff;border-radius:9px;padding:9px 13px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
.grp.baja .band{background:var(--rojo)}.grp.rev .band{background:var(--cobre)}
.band small{display:block;font-weight:400;font-size:11px;color:#fff;opacity:.85;margin-top:2px}.band .cnt{font-size:11px;opacity:.85}
.it{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--linea);border-top:none;padding:8px 12px}
.grp .it:first-of-type{border-top:1px solid var(--linea)}
.it .bx{flex-shrink:0;width:19px;height:19px;border:2px solid var(--tierra);border-radius:5px;margin-top:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff}
.it.done .bx{background:var(--verde);border-color:var(--verde)}.it .tx{font-size:13px;cursor:pointer}.it.done .tx{text-decoration:line-through;color:#9a8f7d}
.reset{display:block;margin:22px auto 0;background:none;border:1px solid var(--linea);color:var(--tierra);border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer}
</style></head><body>
<header><div class="kick">Rosanta · PosFile · Limpieza</div><h1>Dar de baja / revisar productos del POS</h1>
<div class="sub">Marca cada producto conforme lo das de baja (o lo revisas). Se guarda solo. Rojo = baja sugerida · dorado = revisar antes de borrar.</div></header>
<div class="prog"><span id="pt">0 de 0 · 0%</span><div class="bar"><i id="pb"></i></div></div>
<div class="wrap"><div id="app"></div><button class="reset" id="reset">Reiniciar marcas</button></div>
<script>
const KEY='rosanta_limpieza_pos_v1';const G=__DATA__;
let st={};try{st=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){st={}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}
const app=document.getElementById('app');
function render(){app.innerHTML='';let tot=0,done=0;
 G.forEach((grp,gi)=>{const isrev=grp[0].indexOf('REVISAR')===0;const d=document.createElement('div');d.className='grp '+(isrev?'rev':'baja');
  let gd=0;grp[2].forEach((t,ii)=>{if(st['g'+gi+'i'+ii])gd++});
  d.innerHTML='<div class="band"><span>'+grp[0]+(grp[1]?'<small>'+grp[1]+'</small>':'')+'</span><span class="cnt">'+gd+'/'+grp[2].length+'</span></div>';
  grp[2].forEach((t,ii)=>{const id='g'+gi+'i'+ii;tot++;if(st[id])done++;const it=document.createElement('div');it.className='it'+(st[id]?' done':'');
   it.innerHTML='<div class="bx">'+(st[id]?'✓':'')+'</div><div class="tx">'+t+'</div>';
   const tog=()=>{st[id]=!st[id];save();render()};it.querySelector('.bx').onclick=tog;it.querySelector('.tx').onclick=tog;d.appendChild(it);});
  app.appendChild(d);});
 const pct=tot?Math.round(done/tot*100):0;document.getElementById('pt').innerHTML='<b>'+done+'</b> de '+tot+' · '+pct+'%';document.getElementById('pb').style.width=pct+'%';}
document.getElementById('reset').onclick=()=>{if(confirm('¿Borrar todas las marcas?')){st={};save();render()}};render();
</script></body></html>'''
html=html.replace('__DATA__',DATA)
open(OUT,'w').write(html)
print("Guardado:",OUT)
