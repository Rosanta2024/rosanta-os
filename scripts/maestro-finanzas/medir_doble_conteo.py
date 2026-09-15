import openpyxl, re, sys, datetime, itertools
from collections import defaultdict, Counter
from openpyxl.styles import Font, PatternFill, Alignment
ESP, EXTR, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

# --- funciones identicas al extractor (se cargan de su codigo, no se reescriben)
src=open(SRC,encoding='utf-8').read()
def bloque(inicio, fin):
    i=src.index(inicio); j=src.index(fin, i); return src[i:j]
G={"re":re,"Counter":Counter}
exec(bloque("def up(s)", "def num(v)"), G)
exec(bloque('MES_FULL=', 'CONCEPTO='), G)
up, norm_letras, bi_patron = G["up"], G["norm_letras"], G["bi_patron"]

wb=openpyxl.load_workbook(ESP, data_only=True)
def num(v):
    try: return float(v or 0)
    except: return 0.0
def clv(v):
    x=str(v if v is not None else "").strip()
    return x[:-2] if x.endswith(".0") else x

# --- reglas de FinanzasDatos.js
FIN_COGS=["ALIMENTOS","BEBIDAS","COCTELERIA","LICORES"]; FIN_EFECTIVO=["ALIMENTOS_EFECTIVO","BEBIDAS_EFECTIVO","COCTELERIA_EFECTIVO"]
FIN_FUERA=["DEVOLUCION_INVERSION","CARGO_FRAUDULENTO","PAGO_TARJETA_CREDITO","PAGO_TARJETA","TRANSFERENCIA","TRANSFERENCIA_SALIENTE","PERSONAL","SALDO","POR_CLASIFICAR"]
FIN_SOLO_FEL=["GAS","ALQUILER_EQUIPO"]; BANCOS=["03_Banco_Industrial","04_Banco_BAC"]; USD=7.7
FIN_MAP={'ALQUILERES':'Inmueble y ocupacion','ALQUILER':'Inmueble y ocupacion','SERVICIOS_PUBLICOS':'Tarifas y servicios','SERVICIOS PUBLICOS':'Tarifas y servicios',
 'GAS':'Tarifas y servicios','TELEFONOS_Y_CELULARES':'Tarifas y servicios','ALQUILER_EQUIPO':'Tarifas y servicios','TELEFONOS Y CELULARES':'Tarifas y servicios',
 'SERVICIO DE INTERNET':'Tarifas y servicios','SERVICIOS_PROFESIONALES':'Prestadores y honorarios','SERVICIOS PROFESIONALES':'Prestadores y honorarios',
 'HONORARIOS CONTABLES':'Prestadores y honorarios','SERVICIO DE MONITOREO Y ALARMA':'Prestadores y honorarios','SUMINISTRO DE LIMPIEZA':'Prestadores y honorarios',
 'NOMINA':'Nomina y salarios','IGSS':'Nomina y salarios','PROPINAS_AL_EQUIPO':'Propinas al equipo','PROPINAS_PASSTHROUGH':'Propinas al equipo','UNIFORMES':'Nomina y salarios',
 'IMPUESTOS':'Impuestos','TRIBUTO':'Impuestos','COMISIONES_BANCARIAS':'Comisiones y cargos','COMISION TARJETA DE CREDITO':'Comisiones y cargos',
 'MARKETING_DIGITAL':'Marketing','CUOTAS_Y_SUSCRIPCIONES':'Marketing','CUOTAS Y SUSCRIPCIONES':'Marketing','MANTENIMIENTO':'Mantencion',
 'MANTENIMIENTO Y ACCESORIOS EQUIPO':'Mantencion','MATERIALES':'Mantencion','PAPELERIA_Y_UTILES':'Bienes de uso','PAPELERIA Y UTILES':'Bienes de uso',
 'ATENCION A CLIENTES':'Bienes de uso','GASTOS_ADMINISTRATIVOS':'Bienes de uso','GASTOS_VARIOS':'Bienes de uso','VIATICOS':'Bienes de uso',
 'PARQUEOS':'Bienes de uso','SEGUROS_Y_FIANZAS':'Bienes de uso','SEGUROS Y FIANZAS':'Bienes de uso','EVENTOS':'Bienes de uso'}
LIBROS=[("01_FEL_Maestro",10,0,14,15,11,"FEL"),("03_Banco_Industrial",4,0,7,8,0,"BI"),("04_Banco_BAC",5,0,8,9,0,"BAC"),("05_Tarjeta_Credito_BAC",3,4,5,6,0,"TARJETA")]
def destino(cat, hoja, esPers):
    if esPers or cat=="PERSONAL": return None,"personal"
    if cat=="DEVOLUCION_INVERSION": return None,"devolucion"
    if not cat or cat in FIN_FUERA or cat.startswith("INGRESO"): return None,"fuera"
    if cat in FIN_COGS: return (None,"regla 3: mercaderia del banco no suma") if hoja in BANCOS else ("COGS","suma")
    if cat in FIN_EFECTIVO: return "COGS","suma"
    if cat in ("ALQUILERES","ALQUILER") and hoja=="01_FEL_Maestro": return None,"alquiler se cuenta por banco"
    if cat in FIN_SOLO_FEL and hoja!="01_FEL_Maestro": return None,"regla 8: solo por FEL"
    if cat in FIN_MAP: return FIN_MAP[cat],"suma"
    return None,"sin mapear"

filas=[]; incl=defaultdict(float); rawref=[]
for hoja,cm,cu,cc,cp,civ,fu in LIBROS:
    sh=wb[hoja]
    for r in range(5,sh.max_row+1):
        f=sh.cell(r,1).value
        if not isinstance(f,datetime.datetime) or f.year!=2026: continue
        cat=str(sh.cell(r,cc).value or "").strip()
        qq=num(sh.cell(r,cm).value); uu=num(sh.cell(r,cu).value) if cu else 0.0
        q=qq+uu*USD
        esPers=str(sh.cell(r,cp).value or "").strip()=="Sí"
        blk,mot=destino(cat,hoja,esPers)
        if blk is None or q<=0: continue
        if fu=="FEL" and blk=="COGS": aporta=q-num(sh.cell(r,civ).value)
        else: aporta=q
        incl[fu]+=aporta
        filas.append(dict(fu=fu,hoja=hoja,fila=r,f=f,cat=cat,blk=blk,q=round(q,2),qq=round(qq,2),uu=uu,aporta=aporta,
            nit=clv(sh.cell(r,5).value) if fu=="FEL" else "", dte=clv(sh.cell(r,4).value) if fu=="FEL" else "", texto=str(sh.cell(r,{"FEL":7,"BI":3,"BAC":4,"TARJETA":2}[fu]).value or "").strip(),
            ref=clv(sh.cell(r,2).value) if fu in ("BI","BAC") else ""))

# --- codigos del maestro de proveedores (para vinculos)
ex=openpyxl.load_workbook(EXTR, read_only=True)
M=list(ex["Maestro"].iter_rows(values_only=True)); HM=M[0]; MR=[dict(zip(HM,x)) for x in M[1:]]
nit2cod={}; cod2nom={}; tarj2cod={}; cta2cod={}
for m in MR:
    cod2nom[m["CODIGO"]]=m["NOMBRE"]
    for n in str(m["NIT"] or "").split(", "):
        if n: nit2cod[n]=m["CODIGO"]
    for t in str(m["TEXTO EN TARJETA"] or "").split(" | "):
        if t: tarj2cod[up(t)]=m["CODIGO"]
    for c in str(m["CUENTAS BAC"] or "").split(", "):
        if c: cta2cod[c]=m["CODIGO"]
B=list(ex["BI_glosas"].iter_rows(values_only=True)); HB=B[0]
pat2link={}
for b in [dict(zip(HB,x)) for x in B[1:]]:
    ev=str(b["EVIDENCIA"] or "")
    if b["TIPO"]=="concepto sin nombre" or ev.startswith("sin coincidencia de nombre"): continue
    cods=re.findall(r"PRV-\d{4}", str(b["CODIGO SUGERIDO (no aplicado)"] or ""))
    if cods: pat2link[str(b["PATRON DE GLOSA"])]=(set(cods), "documentado" if b["TIPO"]=="vinculo documentado" else "sugerido")
C=list(ex["Candidatos_fusion"].iter_rows(values_only=True))
cand=defaultdict(set)
for c in C[1:]:
    cand[c[0]].add(c[3]); cand[c[3]].add(c[0])
def link(p):
    """codigos de proveedor FEL a los que este pago puede pertenecer, con el tipo de vinculo"""
    if p["fu"]=="BI":
        txt,comp=bi_patron(p["texto"])
        if txt in pat2link: return pat2link[txt]
    if p["fu"]=="TARJETA":
        c=tarj2cod.get(up(p["texto"]))
        if c: return ({c}|cand.get(c,set()), "candidato")
    if p["fu"]=="BAC":
        m_=re.search(r"TEF A\s*:\s*(\d+)", up(p["texto"]))
        if m_ and m_.group(1) in cta2cod:
            c=cta2cod[m_.group(1)]; return ({c}|cand.get(c,set()), "candidato")
    return (set(),"")

fel=[x for x in filas if x["fu"]=="FEL"]; pag=[x for x in filas if x["fu"]!="FEL"]
for x in fel: x["cod"]=nit2cod.get(x["nit"],"")
# vinculo por categoria unica: si solo 1-2 proveedores FEL usan esa categoria, la categoria identifica al proveedor
ncat=lambda c: c.replace("_"," ").upper().strip()
cat2cods=defaultdict(set)
for x in fel:
    if x["cod"]: cat2cods[ncat(x["cat"])].add(x["cod"])
NO_FACTURA={"NOMINA","IGSS","PROPINAS_AL_EQUIPO","PROPINAS_PASSTHROUGH","IMPUESTOS","TRIBUTO"}
pag2=[]
for p in pag:
    T=up(p["texto"])
    if T.startswith("ATM") or T.startswith("RETIRO"): continue          # un retiro de cajero no es el pago de una factura
    p["link"],p["tlink"]=link(p)
    cu=cat2cods.get(ncat(p["cat"]),set())
    if not p["link"] and 0<len(cu)<=2: p["link"],p["tlink"]=set(cu),"categoria unica"
    if p["cat"] in NO_FACTURA and not p["link"]: continue                 # planilla o impuesto sin vinculo: no puede ser el pago de una factura
    pag2.append(p)
pag=pag2
redondo=lambda q: abs(q/50-round(q/50))<1e-9
def ventana(p,x):
    dd=(p["f"]-x["f"]).days
    return (-5<=dd<=5) if p["fu"]=="TARJETA" else (-15<=dd<=60)
usados_f=set(); usados_p=set(); PARES=[]
def candidatos(filtro):
    o=[]
    for p in pag:
        if id(p) in usados_p or p["uu"]>0: continue
        for i,x in enumerate(fel):
            if i in usados_f: continue
            if abs(p["q"]-x["q"])<0.005 and ventana(p,x) and filtro(p,x): o.append((abs((p["f"]-x["f"]).days),id(p),i,p,x))
    o.sort(key=lambda t:(t[0],t[1],t[2])); return o
# paso 0: la glosa del pago cita el numero de DTE de una factura que suma al DRE (llave dura)
dte_idx=defaultdict(list)
for i,x in enumerate(fel):
    if x["dte"]: dte_idx[x["dte"]].append(i)
DTE_STATS=Counter()
for p in pag:
    if p["uu"]>0: continue
    nums=[n for n in re.findall(r"\d{7,10}", p["texto"]) if n in dte_idx]
    if not nums: continue
    DTE_STATS["pagos que citan una factura que suma"]+=1
    idxs=sorted({i for n in nums for i in dte_idx[n] if i not in usados_f})
    if not idxs: DTE_STATS["factura citada ya usada"]+=1; continue
    xs=[fel[i] for i in idxs]; qf=sum(x["q"] for x in xs)
    if abs(p["q"]-qf)<0.005: why,extra="cita el DTE de la factura, monto exacto",p["aporta"]
    elif abs(p["q"]-qf)<=1.0: why,extra="cita el DTE de la factura, monto redondeado (dif. Q%.2f)" % (p["q"]-qf),p["aporta"]
    elif p["q"]<qf: why,extra="cita el DTE de la factura, pago parcial (Q%.2f de Q%.2f)" % (p["q"],qf),p["aporta"]
    else: why,extra="cita el DTE, pero el pago supera la factura: solo se cuenta lo citado (Q%.2f de Q%.2f)" % (qf,p["q"]),qf
    for i in idxs: usados_f.add(i)
    usados_p.add(id(p)); DTE_STATS[why.split(",")[1].strip().split(" (")[0] if "," in why else why]+=1
    PARES.append(dict(conf="ALTA",why=why,tipo="DTE",p=p,xs=xs,dias=(p["f"]-xs[0]["f"]).days,extra=extra))

# paso 1: pagos vinculados al proveedor de la factura
for dd,ip,i,p,x in candidatos(lambda p,x: bool(x["cod"]) and x["cod"] in p["link"]):
    if ip in usados_p or i in usados_f: continue
    usados_p.add(ip); usados_f.add(i)
    PARES.append(dict(conf="ALTA",why="pago vinculado al proveedor de la factura (%s)" % p["tlink"],tipo="1 a 1",p=p,xs=[x],dias=dd))
# paso 2: un pago vinculado que cubre varias facturas de ese proveedor
por_cod=defaultdict(list)
for i,x in enumerate(fel):
    if x["cod"]: por_cod[x["cod"]].append((i,x))
for p in pag:
    if id(p) in usados_p or p["uu"]>0 or not p["link"]: continue
    hecho=False
    for cod in sorted(p["link"]):
        cands=[(i,x) for i,x in por_cod.get(cod,[]) if i not in usados_f and -15<=(p["f"]-x["f"]).days<=120]
        for k in (2,3,4):
            for combo in itertools.combinations(cands,k):
                if abs(sum(x["q"] for _,x in combo)-p["q"])<0.005:
                    for i,_ in combo: usados_f.add(i)
                    usados_p.add(id(p)); hecho=True
                    PARES.append(dict(conf="ALTA",why="un pago vinculado cubre %d facturas del proveedor (%s)" % (k,p["tlink"]),tipo="1 a %d"%k,p=p,xs=[x for _,x in combo],dias=None))
                    break
            if hecho: break
        if hecho: break
# paso 3: sin vinculo, solo monto exacto
op=candidatos(lambda p,x: True)
cuenta_f=Counter(); cuenta_p=Counter()
for _,ip,i,p,x in op: cuenta_p[ip]+=1; cuenta_f[i]+=1
for dd,ip,i,p,x in op:
    if ip in usados_p or i in usados_f: continue
    mismo=p["blk"]==x["blk"]; nr=not redondo(p["q"])
    cerca=(dd<=1) if p["fu"]=="TARJETA" else ((ncat(p["cat"])==ncat(x["cat"]) and dd<=30) or dd<=7)
    if mismo and nr and cerca: conf,why="ALTA","mismo bloque del DRE, monto exacto no redondo, %s" % ("mismo dia en tarjeta" if p["fu"]=="TARJETA" else ("misma categoria, a %d dias" % dd if ncat(p["cat"])==ncat(x["cat"]) else "a %d dias" % dd))
    elif mismo and nr: conf,why="MEDIA","mismo bloque y monto no redondo, pero lejos en fecha o con otra categoria"
    elif mismo and cuenta_p[ip]==1 and cuenta_f[i]==1: conf,why="MEDIA","monto redondo, mismo bloque y un solo candidato posible"
    else: conf,why="BAJA","monto que coincide sin vinculo: otro bloque del DRE o varios candidatos"
    usados_p.add(ip); usados_f.add(i)
    PARES.append(dict(conf=conf,why=why,tipo="1 a 1",p=p,xs=[x],dias=dd))

# --- verificaciones
assert len(usados_p)==len(PARES)
assert len(usados_f)==sum(len(pp["xs"]) for pp in PARES), (len(usados_f), sum(len(pp["xs"]) for pp in PARES))
ids=[id(pp["p"]) for pp in PARES]; assert len(ids)==len(set(ids))

# --- resumen
res=defaultdict(lambda: defaultdict(float)); prov=defaultdict(lambda: defaultdict(float))
for pp in PARES:
    res[pp["conf"]][pp["p"]["blk"]]+=pp.get("extra",pp["p"]["aporta"])
    cod=pp["xs"][0]["cod"]; prov[(cod,cod2nom.get(cod,pp["xs"][0]["texto"]))][pp["conf"]]+=pp.get("extra",pp["p"]["aporta"])
def ctrl(nombre, pred):
    hit=[pp for pp in PARES if pred(pp)]
    return "%s: %d pares · Q%s · %s" % (nombre, len(hit), f"{sum(pp.get('extra',pp['p']['aporta']) for pp in hit):,.2f}", Counter(pp["conf"] for pp in hit).most_common())
print("  filas que suman al DRE 2026:", {k:len([x for x in filas if x['fu']==k]) for k in ('FEL','BI','BAC','TARJETA')})
print("  pares encontrados: %d · por confianza: %s" % (len(PARES), dict(Counter(pp['conf'] for pp in PARES))))
print("  DTE citado en la glosa:", dict(DTE_STATS))
for conf in ("ALTA","MEDIA","BAJA"):
    tot=sum(res[conf].values())
    print("  %s · Q%s contado de mas" % (conf, f"{tot:,.2f}"))
    for b,v in sorted(res[conf].items(), key=lambda kv:-kv[1]): print("       %-28s Q%12s" % (b, f"{v:,.2f}"))
print()
print("  CONTROLES")
print("   ", ctrl("Edwin (NIT 82651086)", lambda pp: any(x["nit"]=="82651086" for x in pp["xs"])))
print("   ", ctrl("EX SECURITY", lambda pp: any("EX SECURITY" in up(x["texto"]) for x in pp["xs"])))
print("   ", ctrl("fisioterapia (NO debe aparecer)", lambda pp: any("FISIOTERAPIA" in up(x["texto"]) for x in pp["xs"])))
print("   ", ctrl("gas del banco (NO debe aparecer)", lambda pp: pp["p"]["cat"]=="GAS"))
print("   ", ctrl("planilla/impuestos SIN vinculo (NO debe aparecer)", lambda pp: pp["p"]["cat"] in NO_FACTURA and not pp["p"]["link"]))
print("   ", ctrl("retiros de cajero (NO debe aparecer)", lambda pp: up(pp["p"]["texto"]).startswith(("ATM","RETIRO"))))
print("   ", ctrl("EEGSA", lambda pp: any("ELECTRICA DE GUATEMALA" in up(x["texto"]) for x in pp["xs"])))
print("   ", ctrl("Doorways", lambda pp: any("DOORWAYS" in up(x["texto"]) for x in pp["xs"])))

# --- libro
out=openpyxl.Workbook(); H=Font(bold=True,color="FFFFFF"); F=PatternFill("solid",fgColor="4E6D5A")
def hoja(nom,cab,rows,anch):
    ws=out.create_sheet(nom); ws.append(cab)
    for c in ws[1]: c.font=H; c.fill=F; c.alignment=Alignment(wrap_text=True)
    for r in rows: ws.append(r)
    for i,w in enumerate(anch,1): ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width=w
    ws.freeze_panes="A2"; ws.auto_filter.ref=ws.dimensions
fmt=lambda d:d.strftime("%Y-%m-%d") if d else ""
hoja("Pares",["CONFIANZA","POR QUE","TIPO","BLOQUE DEL DRE","PAGO: FUENTE","PAGO: FECHA","PAGO: FILA","PAGO: REFERENCIA","PAGO: TEXTO","PAGO: CATEGORIA","CONTADO DE MAS Q",
      "FACTURA(S): FECHA","FACTURA(S): FILA","PROVEEDOR (codigo)","PROVEEDOR","NIT","CATEGORIA FEL","DIAS ENTRE FACTURA Y PAGO"],
     [[pp["conf"],pp["why"],pp["tipo"],pp["p"]["blk"],pp["p"]["fu"],fmt(pp["p"]["f"]),pp["p"]["fila"],pp["p"]["ref"],pp["p"]["texto"],pp["p"]["cat"],round(pp.get("extra",pp["p"]["aporta"]),2),
       ", ".join(fmt(x["f"]) for x in pp["xs"]), ", ".join(str(x["fila"]) for x in pp["xs"]), pp["xs"][0]["cod"], cod2nom.get(pp["xs"][0]["cod"],pp["xs"][0]["texto"]),
       pp["xs"][0]["nit"], ", ".join(sorted({x["cat"] for x in pp["xs"]})), pp["dias"] if pp["dias"] is not None else ""]
      for pp in sorted(PARES,key=lambda z:({"ALTA":0,"MEDIA":1,"BAJA":2}[z["conf"]],-z.get("extra",z["p"]["aporta"])))],
     [9,40,7,22,9,11,8,12,34,24,14,22,14,11,32,12,24,10])
hoja("Por_proveedor",["CODIGO","PROVEEDOR","ALTA Q","MEDIA Q","BAJA Q"],
     [[k[0],k[1],round(v["ALTA"],2),round(v["MEDIA"],2),round(v["BAJA"],2)] for k,v in sorted(prov.items(), key=lambda kv:-(kv[1]["ALTA"]+kv[1]["MEDIA"]))],[11,40,14,14,14])
hoja("Resumen",["CONFIANZA","BLOQUE DEL DRE","CONTADO DE MAS Q"],
     [[c,b,round(v,2)] for c in ("ALTA","MEDIA","BAJA") for b,v in sorted(res[c].items(), key=lambda kv:-kv[1])],[10,30,16])
ws=out.active; ws.title="LEEME"
for line in ["DOBLE CONTEO EN EL DRE · FACTURA FEL CONTRA SU PAGO POR BANCO O TARJETA",
 "Medido el 14 de septiembre de 2026 con el espejo del maestro de ese dia a las 15:51. Las correcciones hechas despues no estan.",
 "",
 "QUE SE BUSCO",
 "Una factura del FEL que SUMA al DRE y un pago del Banco Industrial, BAC o tarjeta que TAMBIEN SUMA, por el mismo gasto.",
 "Que suma y que no se decidio con las reglas exactas de FinanzasDatos.js: personal, FIN_FUERA, regla 3 (mercaderia del banco no suma), alquiler por banco, regla 8 (gas y alquiler de equipo solo por FEL), FIN_MAP.",
 "",
 "COMO SE EMPAREJO (nunca por parecido de nombre)",
 "PASO 0, llave dura: si la glosa del pago cita el numero de DTE de una factura que suma al DRE, se empareja con esa factura. Acepta monto exacto, redondeo de hasta Q1 y pagos parciales.",
 "Despues: monto exacto al centavo. Ventana: banco de 15 dias antes a 60 despues de la factura; tarjeta 5 dias.",
 "Cada factura y cada pago se usan una sola vez. Se empareja primero el par con menos dias de diferencia.",
 "Primero se emparejan los pagos VINCULADOS al proveedor de la factura (documentado, sugerido en el maestro de proveedores, candidato, o categoria que solo usa ese proveedor). Despues el resto, solo por monto.",
 "Un pago que cubre varias facturas solo se acepta si esta vinculado a ese proveedor. Retiros de cajero no participan. Nomina, propinas e impuestos solo participan si la glosa los vincula a un proveedor.",
 "",
 "CONFIANZA",
 "ALTA: la glosa cita el DTE; o pago vinculado al proveedor; o mismo bloque del DRE con monto no redondo y cerca (tarjeta: mismo dia; banco: misma categoria hasta 30 dias, u otra categoria del mismo bloque hasta 7).",
 "MEDIA: mismo bloque del DRE sin vinculo: monto no redondo pero lejos en fecha, o monto redondo con un solo candidato posible.",
 "BAJA: coincide el monto sin vinculo, en otro bloque o con varios candidatos. Probable casualidad: no se suma al titular.",
 "",
 "'CONTADO DE MAS' es lo que aporta el pago al DRE. La factura se considera la fuente buena, como ya hacen las reglas 3 y 8."]:
    ws.append([line])
ws.column_dimensions["A"].width=150; ws["A1"].font=Font(bold=True,size=14,color="4E6D5A")
out.save(OUT); print("\n  archivo:", OUT.split("/")[-1])
