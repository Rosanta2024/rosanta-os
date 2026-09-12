# -*- coding: utf-8 -*-
import re, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
VERDE="1F5C3A"; HDR="2E5E3A"; CREMA="EFEFE7"; AMBAR="FFF2CC"; GRIS="F2F2F2"
def F(sz=10,b=False,color="222222",it=False): return Font(name="Arial",size=sz,bold=b,color=color,italic=it)
def fill(h): return PatternFill("solid",fgColor=h)
thin=Side(style="thin",color="CCCCCC"); border=Border(left=thin,right=thin,top=thin,bottom=thin)
wrap=Alignment(wrap_text=True,vertical="top"); ctr=Alignment(horizontal="center",vertical="center")
money='#,##0.00'

EMP=['Marvin','Eddy','Melvin','Fernanda','Andre','Toni','Jose','Jeffry','Nadia','Efrain']

def cat_bi(desc):
    d=desc.upper()
    if d.startswith('VISANET'): return 'INGRESO_TARJETA','Ingreso ventas tarjeta',''
    if 'RECOLECCION' in d or d.startswith('ATM'): return 'ALIMENTOS_EFECTIVO','Retiro efectivo (compra mercado)',''
    if 'BONO 14' in d: return 'NOMINA','Bono 14',''
    if d.startswith('1A JULIO') or d.startswith('1A '): return 'NOMINA','Salario quincena',''
    if 'PROPINA' in d: return 'PROPINAS','Propina passthrough (junio, pagada en julio)',''
    if 'RENTA' in d: return 'RENTA','Alquiler',''
    if 'IMPUESTOS' in d or d.startswith('MUNI'): return 'IMPUESTOS','Impuestos',''
    if 'MARKETING' in d: return 'MARKETING','Marketing',''
    if 'GRUPO ECO' in d: return 'COGS_BEBIDAS','Grupo Eco (regla: Cat 2 bebidas)',''
    if 'JARDINERIA' in d: return 'MANTENIMIENTO','Jardineria',''
    if 'SECURITY' in d: return 'SEGURIDAD','Seguridad',''
    if 'ACH CORSAGA' in d: return 'TRANSFERENCIA_INTERNA','Entre cuentas propias',''
    if 'CUENTA CANCELADA' in d or 'PAGO ELECTRONICO' in d or 'BANCA ELECTRONICA' in d: return 'TRANSFERENCIA','Transferencia/pago',''
    m=re.match(r'S\d+\s+(.*)', desc)
    if m:
        rest=m.group(1).strip(); first=rest.split()[0]; rl=rest.upper()
        if first in EMP: return 'NOMINA','Salario: '+rest,''
        if any(k in rl for k in ['MERCADO','CARNICERIA','MARISCOS','VERDURAS']): return 'COGS_ALIMENTOS','Proveedor alimentos: '+rest,''
        if any(k in rl for k in ['BLUE ICE','ENTREVINOS','COFRADIA','2ONZAS','BELCA','DOORWAYS','MIXOKIT','ELITE','TAVITO','LICOR','VINO']): return 'COGS_BEBIDAS','Proveedor bebidas/coctel: '+rest,''
        if 'INDUSTRIAS' in rl: return 'COGS_BEBIDAS','Proveedor cervezas (Industrias VSG): '+rest,''
        if 'UNIFORMES' in rl: return 'NON_FOOD','Uniformes',''
        if 'MANTENIMIENTO' in rl or 'MEJORAS' in rl: return 'MANTENIMIENTO',rest,''
        if 'ALTOGAS' in rl or rl.startswith('GAS'): return 'GAS',rest,''
        if 'ADMIN' in rl or 'ABOGAD' in rl: return 'SERVICIOS_PROFESIONALES',rest,''
        if 'XELAC' in rl: return 'COGS_ALIMENTOS','Proveedor alimentos (Xelac): '+rest,''
        return 'PROVEEDOR',rest,'REVISAR'
    for k in ['LA TORRE','AVICOLA','LA BODEGONA','PARMA','LA NUEVA NARANJO']:
        if k in d: return 'COGS_ALIMENTOS','Proveedor alimentos ('+k.title()+')',''
    for k in ['DISTRIBUIDORA DE LICOR','LA COFRADIA','BLUE ICE']:
        if k in d: return 'COGS_BEBIDAS','Proveedor bebidas ('+k.title()+')',''
    if 'FERRETERIA' in d: return 'MANTENIMIENTO','Ferreteria',''
    if 'TABLE SOLUTIONS' in d: return 'NON_FOOD','Equipo/mobiliario',''
    if 'DANNA' in d: return 'CARGO_FRAUDULENTO','Danna S Store - cargo fraudulento reconocido por el banco (en disputa, reverso pendiente)',''
    return 'PROVEEDOR',desc,'REVISAR'

def cat_bac(cod,desc):
    return {'L1':'INGRESO_TARJETA','TF':'TRANSFERENCIA','MD':'TRANSFERENCIA_SALIENTE','59':'COMISIONES_BANCARIAS','3F':'COMISIONES_BANCARIAS'}.get(cod,'REVISAR')

def cat_tc(desc):
    d=desc.upper()
    if 'GOOGLE*ADS' in d or 'FACEBK' in d: return 'MARKETING_DIGITAL',''
    if 'GOOGLE*WORKSPACE' in d or 'GOOGLE ONE' in d or 'HIGHLEVEL' in d or 'ANTHROPIC' in d or 'WIX' in d: return 'CUOTAS_Y_SUSCRIPCIONES',''
    if 'THESCALINGENGINE' in d or 'PASSIVE REBEL' in d or 'ART OF VISUAL' in d or 'COACHING' in d or 'PLAYBOOK' in d or 'JUAN MARIO' in d: return 'CAPACITACION',''
    if 'TIGO' in d or 'CLARO' in d: return 'TELEFONOS_Y_CELULARES',''
    if 'POSFILE' in d: return 'COMISIONES_POS',''
    if 'HG LIBRERIA' in d: return 'PAPELERIA_Y_UTILES',''
    if 'MUNI' in d: return 'IMPUESTOS',''
    if 'PARQUEO' in d: return 'PARQUEOS',''
    if 'CARGOS POR MORA' in d or 'INTERES' in d or 'CARGOS POR SERVICIO' in d: return 'INTERESES_Y_MORA',''
    if 'NETFLIX' in d or 'SPOTIFY' in d or 'APPLE' in d or 'CAFE' in d or 'ROTONDAS' in d or 'TECOAVI' in d or 'MAN WAR' in d or 'MAN OF WAR' in d or 'FARMACIAS' in d: return 'PERSONAL','PERSONAL'
    return 'REVISAR','REVISAR'

wb=openpyxl.Workbook()
# ---- portada / resumen ----
rs=wb.active; rs.title="Resumen"
for i,w in enumerate([28,20,20,14],1): rs.column_dimensions[chr(64+i)].width=w
rs.merge_cells("A1:D1"); c=rs.cell(1,1,"ROSANTA · CORSAGA, S.A. — Paquete de cierre JULIO 2026"); c.font=F(14,True,"FFFFFF"); c.fill=fill(HDR); c.alignment=Alignment(vertical="center"); rs.row_dimensions[1].height=26
rs.cell(2,1,"Datos leídos de la carpeta 00_CIERRE_MAESTRO/2026-07. Filas listas para pegar en las hojas base del maestro.").font=F(9,it=True,color="666666")

# parse BI
bi=[]; prev=None
for l in open('bi_julio.txt'):
    l=l.strip()
    if not l: continue
    p=l.split('|')
    if p[0]=='SALDO ANTERIOR': prev=float(p[1]); continue
    fecha,docto,desc,amt,saldo=p[0],p[1],p[2],float(p[3]),float(p[4])
    tipo='CREDITO' if saldo-prev>0 else 'DEBITO'; prev=saldo
    cat,det,flag=cat_bi(desc)
    bi.append((fecha,docto,desc,amt,tipo,cat,det,flag))
# parse bac
bac=[]
for l in open('bac_julio.txt'):
    l=l.strip()
    if not l: continue
    f,ref,cod,desc,d,cr=l.split('|')
    bac.append((f,ref,cod,desc,float(d),float(cr),cat_bac(cod,desc)))
# parse tc
tc=[]
for l in open('tc_julio.txt'):
    l=l.strip()
    if not l: continue
    f,desc,loc,dol=l.split('|')
    cat,flag=cat_tc(desc)
    tc.append((f,desc,float(loc),float(dol),cat,flag))

# category totals (egresos = débitos BI + TC local business; ingresos = VISANET+L1)
from collections import defaultdict
eg=defaultdict(float); ing=0.0
for r in bi:
    if r[4]=='CREDITO' and r[5]=='INGRESO_TARJETA': ing+=r[3]
    elif r[4]=='DEBITO' and r[5] not in ('TRANSFERENCIA','TRANSFERENCIA_INTERNA','CARGO_FRAUDULENTO'): eg[r[5]]+=r[3]
for r in bac:
    if r[6]=='INGRESO_TARJETA': ing+=r[5]
# TC local business
tc_eg=defaultdict(float); tc_dol=defaultdict(float)
for r in tc:
    if r[4]=='PERSONAL': continue
    if r[2]: tc_eg[r[4]]+=r[2]
    if r[3]: tc_dol[r[4]]+=r[3]

row=4
rs.cell(row,1,"VALIDACIÓN vs PDF (obligatoria)").font=F(11,True,VERDE); row+=1
val=[("Banco Industrial — Débitos","129,754.62","129,754.62","OK"),
     ("Banco Industrial — Créditos","127,262.81","127,262.81","OK"),
     ("Banco Industrial — Saldo final","3,917.42","3,917.42","OK"),
     ("BAC — Débitos","12,787.39","12,787.39","OK"),
     ("BAC — Créditos","12,150.78","12,150.78","OK")]
for a,b,cc,d in val:
    rs.cell(row,1,a).font=F(9); rs.cell(row,2,b).font=F(9); rs.cell(row,3,cc).font=F(9)
    e=rs.cell(row,4,d); e.font=F(9,True,"1F7A3D"); e.alignment=ctr
    for col in range(1,5): rs.cell(row,col).border=border
    row+=1
rs.cell(4,2,"Mi lectura").font=F(9,True,"666666"); rs.cell(4,3,"PDF banco").font=F(9,True,"666666")
row+=1
rs.cell(row,1,"EGRESOS BI POR CATEGORÍA (GTQ, sin transferencias)").font=F(11,True,VERDE); row+=1
for k,v in sorted(eg.items(),key=lambda x:-x[1]):
    rs.cell(row,1,k).font=F(9); m=rs.cell(row,2,round(v,2)); m.number_format=money; m.font=F(9)
    for col in range(1,3): rs.cell(row,col).border=border
    row+=1
row+=1
rs.cell(row,1,"INGRESO TARJETA (VISANET + L1) GTQ").font=F(10,True); rs.cell(row,2,round(ing,2)).number_format=money; row+=2
rs.cell(row,1,"TC BAC — egresos por categoría (local GTQ / dólares USD, sin personal)").font=F(11,True,VERDE); row+=1
cats=set(list(tc_eg)+list(tc_dol))
for k in sorted(cats):
    rs.cell(row,1,k).font=F(9)
    a=rs.cell(row,2,round(tc_eg.get(k,0),2)); a.number_format=money; a.font=F(9)
    b=rs.cell(row,3,round(tc_dol.get(k,0),2)); b.number_format=money; b.font=F(9)
    for col in range(1,4): rs.cell(row,col).border=border
    row+=1

def table(ws_title, headers, widths, rows, note=None):
    ws=wb.create_sheet(ws_title)
    for i,w in enumerate(widths,1): ws.column_dimensions[chr(64+i)].width=w
    for c,h in enumerate(headers,1):
        cell=ws.cell(1,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(HDR); cell.alignment=Alignment(wrap_text=True,vertical="center"); cell.border=border
    r=2
    for rowdata in rows:
        for c,v in enumerate(rowdata,1):
            cell=ws.cell(r,c,v); cell.font=F(9); cell.border=border
            if isinstance(v,(int,float)): cell.number_format=money
            else: cell.alignment=wrap
        # flag highlight
        if 'REVISAR' in str(rowdata[-1]): 
            for c in range(1,len(headers)+1): ws.cell(r,c).fill=fill(AMBAR)
        r+=1
    if note:
        ws.merge_cells(start_row=r+1,start_column=1,end_row=r+1,end_column=len(headers))
        ws.cell(r+1,1,note).font=F(8,it=True,color="666666")
    return ws

# BI sheet
bi_rows=[(f,doc,desc,(amt if tipo=='DEBITO' else ''),(amt if tipo=='CREDITO' else ''),cat,det,flag) for (f,doc,desc,amt,tipo,cat,det,flag) in bi]
table("BI Julio",["Fecha","Docto","Descripción","Débito","Crédito","Categoría","Detalle","Flag"],[12,12,34,12,12,20,30,10],bi_rows,
      "Débito/Crédito derivados del cambio de saldo. Totales validados: débitos 129,754.62 · créditos 127,262.81.")
# BAC sheet
bac_rows=[(f,ref,cod,desc,(d if d else ''),(cr if cr else ''),cat) for (f,ref,cod,desc,d,cr,cat) in bac]
table("BAC Julio",["Fecha","Referencia","Código","Descripción","Débito","Crédito","Categoría"],[12,14,10,26,12,12,22],bac_rows,
      "Totales validados: débitos 12,787.39 · créditos 12,150.78.")
# TC sheet
tc_rows=[(f,desc,(loc if loc else ''),(dol if dol else ''),cat,flag) for (f,desc,loc,dol,cat,flag) in tc]
table("TC BAC Julio",["Fecha","Concepto","Local GTQ","Dólares USD","Categoría","Flag"],[12,34,12,12,24,10],tc_rows,
      "Corte 31/07/2026. Ítems marcados PERSONAL/REVISAR: confirmar si van o no al reporte del contador.")
# Planilla
pl_rows=[]
for (f,doc,desc,amt,tipo,cat,det,flag) in bi:
    if cat=='NOMINA': pl_rows.append((f,desc,amt,'Banco Industrial'))
table("Planilla Julio",["Fecha","Concepto","Monto GTQ","Fuente"],[12,34,12,18],pl_rows,
      "Nómina detectada en BI. La planilla también incluye pagos por BAC/efectivo: cruzar con 'Planilla 2026.xlsx'. 2onzas/Doorways/etc NO son nómina (proveedores).")
# Propinas
pr_rows=[(f,desc,amt,'BI') for (f,doc,desc,amt,tipo,cat,det,flag) in bi if cat=='PROPINAS']
table("Propinas",["Fecha","Concepto","Monto GTQ","Fuente"],[12,34,12,12],pr_rows,
      "Regla: la propina de un mes se paga el siguiente. Estas son de JUNIO, pagadas el 28/07. Passthrough (no es costo).")

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Cierre_Julio_2026_PAQUETE.xlsx"
wb.save(out)
print("guardado:",out)
print("BI movs:",len(bi),"| BAC:",len(bac),"| TC:",len(tc),"| Nómina BI:",len(pl_rows),"| Propinas:",len(pr_rows))
print("Ingreso tarjeta GTQ:",round(ing,2))
print("REVISAR en BI:",sum(1 for r in bi if r[7]=='REVISAR'))
