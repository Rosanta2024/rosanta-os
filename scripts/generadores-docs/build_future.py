# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
VERDE="4A6741"; TIERRA="A0785A"; CREMA="F5EFE0"; COBRE="C9923F"; MARRON="3D2B1F"; AMBAR="FFF2CC"
FONT="Arial"
def F(sz=10,b=False,color=MARRON,italic=False): return Font(name=FONT,size=sz,bold=b,color=color,italic=italic)
def fill(h): return PatternFill("solid",fgColor=h)
thin=Side(style="thin",color="BFB4A0"); border=Border(left=thin,right=thin,top=thin,bottom=thin)
wrap=Alignment(wrap_text=True,vertical="top"); wrapc=Alignment(wrap_text=True,vertical="center"); ctr=Alignment(horizontal="center",vertical="center",wrap_text=True)
wb=openpyxl.Workbook()

# ===== INSTRUCCIONES =====
ws=wb.active; ws.title="📖 Instrucciones"; ws.sheet_view.showGridLines=False
ws.column_dimensions["A"].width=3; ws.column_dimensions["B"].width=108
def wr(row,text,sz=10,b=False,color=MARRON,bg=None,italic=False,h=None):
    c=ws.cell(row=row,column=2,value=text); c.font=F(sz,b,color,italic); c.alignment=wrap
    if bg: c.fill=fill(bg); ws.cell(row=row,column=1).fill=fill(bg)
    if h: ws.row_dimensions[row].height=h
r=1; ws.row_dimensions[1].height=30
wr(r,"ROSANTA · Organigrama Futuro (6-12 meses)",16,True,"FFFFFF",VERDE,h=30); r+=1
wr(r,"Cocina con Carisma · Lección 2.8 · Diseña la estructura para operar sin ti",9,False,"FFFFFF",VERDE,italic=True); r+=1
r+=1
wr(r,"LA IDEA",12,True,COBRE); r+=1
wr(r,"El organigrama actual mostró la realidad. Este diseña el futuro: la estructura que necesita el negocio para operar sin ti. Los cuartos importan más que las personas. La meta es SALIR de cuartos, no agregar nombres. Si sigues en 3+ cuartos, rediséñalo.",10,h=44); r+=1
r+=1
wr(r,"LOS 5 CUARTOS FUNCIONALES",12,True,VERDE); r+=1
for t in [
 "Cocina — producción, prep, calidad, CMV.",
 "Sala (FOH) + Barra — experiencia del cliente, servicio, coctelería.",
 "Finanzas — P&L, contabilidad, planilla, verificación (tu Sistema Controlador).",
 "Growth — marketing, contenido, eventos, catering.",
 "People — contratar, entrenar, gestionar al equipo (tú, hasta tener GM).",
]:
    wr(r,t,10,h=22); r+=1
r+=1
wr(r,"NIVELES DE GESTIÓN",12,True,VERDE); r+=1
for t in [
 "M1 · Líder de turno — un turno, un área (ej. Efraín en sala; responsable de turno de cocina).",
 "M2 · Jefe de departamento — un depto en todos los turnos (ej. Jeffry en Cocina; José en Sala/Barra).",
 "M3 · Gerente General — toda la locación (futuro: José o contratación; hoy lo haces tú).",
 "M4 · Gerente de área — varias locaciones (a futuro, no aplica aún).",
]:
    wr(r,t,10,bg=CREMA,h=22); r+=1
r+=1
wr(r,"LOS 3 TIERS DE CONTRATACIÓN",12,True,VERDE); r+=1
for t in [
 "Tier 1 (0-3 meses) · Reemplazo — te saca de los cuartos donde aún estás; libera horas ya.",
 "Tier 2 (3-6 meses) · Profesionalización — cambia 'suficiente' por profesional; crea consistencia y datos.",
 "Tier 3 (6-12 meses) · Growth — agrega capacidad que hoy no tienes. Solo funciona si Tier 1 y 2 están sólidos.",
]:
    wr(r,t,10,h=22); r+=1
r+=1
wr(r,"ERRORES COMUNES",12,True,VERDE); r+=1
for t in [
 "1. Diseñar a 5 años. Esto es a 6-12 meses; las cosas cambian rápido.",
 "2. Contratar Tier 3 antes que Tier 1. Cada tier crea la base del siguiente.",
 "3. Dejarte en todos los cuartos. Si sigues en Cocina, Sala y Finanzas, no es futuro: es tu presente con nombres nuevos.",
]:
    wr(r,t,10,h=22); r+=1

# ===== ROOM ASSIGNMENTS =====
ra=wb.create_sheet("🏢 Cuartos"); ra.sheet_view.showGridLines=False
for col,w in [("A",4),("B",22),("C",34),("D",36),("E",16)]: ra.column_dimensions[col].width=w
ra.merge_cells("A1:E1")
t=ra.cell(1,1,"ROSANTA · Asignación de cuartos"); t.font=F(14,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); ra.row_dimensions[1].height=24
hdr=["","Cuarto","Quién está ahora","Quién debería estar (6-12 meses)","¿Sigues tú?"]
for c,h in enumerate(hdr,start=1):
    cell=ra.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
ra.row_dimensions[3].height=32
rooms=[
 ("Cocina","Jeffry López (M2) · Nadia, Fernanda, Yazmin","Jeffry consolidado (M2) con su equipo","No"),
 ("Sala (FOH) + Barra","José Mazate (M2) · Efraín (M1) · meseros · host","José → Jefe de Operaciones (M3) o nuevo jefe de sala (M2); Efraín sube a M1 fijo","No"),
 ("Finanzas","Sistema Controlador (Claude + artefactos) + Econtrista + tú supervisas","Sistema Controlador + capa de verificación + Econtrista (tú solo revisas)","Parcial"),
 ("Growth","Vanessa (Pauta, Colombia) + Daniel (Video/Foto) + tú (eventos/estrategia)","+ Asistente de Marketing/Contenido + Coordinador de Eventos y Catering (tú solo estrategia)","Parcial"),
 ("People","Tú (CEO)","GM / Jefe de Operaciones (José) + tú como dueño","Sí"),
]
rr=4
for room,now,fut,you in rooms:
    ra.cell(rr,2,room).font=F(9,True,VERDE); ra.cell(rr,2).alignment=wrap; ra.cell(rr,2).border=border
    ra.cell(rr,3,now).font=F(9); ra.cell(rr,3).alignment=wrap; ra.cell(rr,3).border=border
    c=ra.cell(rr,4,fut); c.font=F(9); c.alignment=wrap; c.border=border; c.fill=fill(CREMA)
    yc=ra.cell(rr,5,you); yc.font=F(9,True); yc.alignment=ctr; yc.border=border
    yc.fill=fill(AMBAR if you!="No" else "E1F0E4")
    ra.row_dimensions[rr].height=44; rr+=1
dv=DataValidation(type="list",formula1='"Sí,Parcial,No"',allow_blank=True); ra.add_data_validation(dv); dv.add(f"E4:E8")
rr+=1
ra.merge_cells(start_row=rr,start_column=2,end_row=rr,end_column=5)
ra.cell(rr,2,"Hoy sigues en Finanzas, Growth y People. La meta a 12 meses: salir de Finanzas (sistema + capa de verificación), reducir Growth a solo estrategia, y pasar People a un GM (José). Quedarías como dueño/visionario, no operador.").font=F(9,italic=True,color="6B5A45")
ra.cell(rr,2).alignment=wrap; ra.row_dimensions[rr].height=44

# ===== HIRING TIERS =====
ht=wb.create_sheet("📋 Tiers de contratación"); ht.sheet_view.showGridLines=False
for col,w in [("A",6),("B",38),("C",16),("D",20),("E",18),("F",16)]: ht.column_dimensions[col].width=w
ht.merge_cells("A1:F1")
t=ht.cell(1,1,"ROSANTA · Tiers de contratación (secuencia)"); t.font=F(14,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); ht.row_dimensions[1].height=24
hdr=["Tier","Rol / movimiento","Cuarto","Costo mensual (Q, aprox)","Horas recuperadas/sem","Fecha objetivo"]
for c,h in enumerate(hdr,start=1):
    cell=ht.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
ht.row_dimensions[3].height=34
def tierhdr(row,txt,sub):
    ht.merge_cells(start_row=row,start_column=1,end_row=row,end_column=6)
    c=ht.cell(row,1,txt+" — "+sub); c.font=F(10,True,COBRE); c.fill=fill(CREMA); c.alignment=wrapc
    ht.row_dimensions[row].height=20
def hire(row,tier,role,room,cost,hrs,date):
    ht.cell(row,1,tier).font=F(9,True); ht.cell(row,1).alignment=ctr; ht.cell(row,1).border=border
    ht.cell(row,2,role).font=F(9); ht.cell(row,2).alignment=wrap; ht.cell(row,2).border=border
    ht.cell(row,3,room).font=F(9); ht.cell(row,3).alignment=ctr; ht.cell(row,3).border=border
    for c,v in [(4,cost),(5,hrs),(6,date)]:
        cell=ht.cell(row,c,v); cell.font=F(9); cell.alignment=ctr; cell.border=border; cell.fill=fill(AMBAR)
    ht.row_dimensions[row].height=32

rr=4
tierhdr(rr,"TIER 1 (0-3 meses)","Reemplazo: libera horas ya"); rr+=1
r_t1a=rr; hire(rr,"1","Asistente de Marketing y Contenido (overseas, LatAm)","Growth",5500,6,"[fecha]"); rr+=1
hire(rr,"1","Formalizar el Sistema Controlador (Claude + artefactos)","Finanzas",800,5,"[en curso]"); rr+=1
r_t1b=rr-1
tierhdr(rr,"TIER 2 (3-6 meses)","Profesionalización: consistencia y datos"); rr+=1
r_t2a=rr; hire(rr,"2","Desarrollar a José → Jefe de Operaciones (M3) [interno]","People",4000,12,"[fecha]"); rr+=1
hire(rr,"2","Coordinador de Eventos y Catering (palanca #1 de ingresos)","Growth",6000,5,"[fecha]"); rr+=1
r_t2b=rr-1
tierhdr(rr,"TIER 3 (6-12 meses)","Growth: capacidad nueva"); rr+=1
r_t3a=rr; hire(rr,"3","Consolidar GM / Jefe de Operaciones (José formal)","People",0,8,"[fecha]"); rr+=1
hire(rr,"3","Backfill M1 en sala (Efraín fijo) + escalar contenido/eventos","Sala (FOH)",2000,4,"[fecha]"); rr+=1
r_t3b=rr-1
rr+=1
ht.cell(rr,3,"TOTAL MENSUAL (Q):").font=F(10,True,VERDE)
ht.cell(rr,4,f"=SUM(D{r_t1a}:D{r_t1b},D{r_t2a}:D{r_t2b},D{r_t3a}:D{r_t3b})").font=F(10,True); ht.cell(rr,4).border=border; ht.cell(rr,4).alignment=ctr
rr+=1
ht.merge_cells(start_row=rr,start_column=2,end_row=rr,end_column=6)
ht.cell(rr,2,"Costos en Q aprox (overseas convertido, ~$1=Q7.8). GM consolidado va en 0 para no duplicar el ajuste de José del Tier 2. Ajusta las celdas ámbar a tus números y fechas reales.").font=F(8,italic=True,color="6B5A45")
ht.cell(rr,2).alignment=wrap; ht.row_dimensions[rr].height=30
dvr=DataValidation(type="list",formula1='"Cocina,Sala (FOH),Finanzas,Growth,People"',allow_blank=True); ht.add_data_validation(dvr); dvr.add(f"C{r_t1a}:C{r_t3b}")

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Organigrama_Futuro.xlsx"
wb.save(out); print("guardado:",out)
