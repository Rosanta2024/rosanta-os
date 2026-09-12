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
wr(r,"ROSANTA · Mapeo Avanzado de Procesos",16,True,"FFFFFF",VERDE,h=30); r+=1
wr(r,"Cocina con Carisma · Lección 2.13 · Cada pregunta que te hace el equipo es un mapa que falta",9,False,"FFFFFF",VERDE,italic=True); r+=1
r+=1
wr(r,"CÓMO ENCONTRAR LOS MAPAS QUE FALTAN",12,True,COBRE); r+=1
wr(r,"Los 5 mapas core cubren lo fundamental. Pero cada restaurante tiene procesos únicos que causan confusión cuando no están documentados. La forma más rápida de encontrarlos: anota TODA pregunta que te haga el equipo durante un día completo de operación.",10,h=44); r+=1
r+=1
wr(r,"LOS 5 TIPOS DE PREGUNTA (ejemplos Rosanta)",12,True,VERDE); r+=1
for t in [
 "'¿Cómo hago...?' → 'una reserva de grupo grande o un evento' → Mapa faltante: Reservas de grupo/eventos.",
 "'¿Qué hago cuando...?' → 'se agota un plato (86) en pleno servicio' o 'hay un no-show' → Mapa: Manejo de 86 y no-shows.",
 "'¿Quién maneja...?' → 'la trampa de grasa / una falla de mantenimiento' → Mapa: Mantenimiento y proveedores (Mario Valle).",
 "'¿Está bien...?' → 'dar una cortesía o descuento a un cliente frecuente' → Mapa: Política de cortesías y descuentos.",
 "'¿Dónde está...?' → 'el respaldo de X insumo' → Mapa: Organización y almacenamiento.",
]:
    wr(r,t,10,h=30); r+=1
r+=1
wr(r,"MATRIZ DE PRIORIDAD",12,True,VERDE); r+=1
for t in [
 "ALTA — la pregunta sale 3+ veces por semana O equivocarse cuesta dinero.",
 "MEDIA — pregunta semanal, crea inconsistencia.",
 "BAJA — ocasional, bajo riesgo.",
]:
    wr(r,t,10,bg=CREMA,h=20); r+=1
wr(r,"Documenta primero las de prioridad ALTA. Cada mapa toma 15-30 min y elimina la pregunta para siempre.",10,italic=True,h=22); r+=1
r+=1
wr(r,"NOTA ROSANTA",12,True,VERDE); r+=1
wr(r,"Rosanta NO hace delivery, así que el ejemplo de delivery del curso se reemplazó por procesos tuyos reales. La hoja 'Ejemplo de mapa' trae uno listo (Cortesías y descuentos), que además alimenta al Sistema Controlador: toda cortesía se registra en el POS y se cruza en el Daily Flash.",10,bg=CREMA,h=40)

# ===== TRACKER =====
tr=wb.create_sheet("📋 Auditoría de preguntas"); tr.sheet_view.showGridLines=False
for col,w in [("A",4),("B",34),("C",16),("D",22),("E",14),("F",22),("G",14),("H",12)]: tr.column_dimensions[col].width=w
tr.merge_cells("A1:H1")
t=tr.cell(1,1,"ROSANTA · Auditoría de preguntas (rastrea un día completo)"); t.font=F(13,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); tr.row_dimensions[1].height=24
tr.merge_cells("A2:H2")
tr.cell(2,1,"Las primeras filas son candidatos probables (edítalos). Las demás, para que anotes lo que realmente te preguntan.").font=F(9,italic=True,color="6B5A45")
hdr=["#","Pregunta / tema","Quién preguntó","Categoría","Frec/sem","Mapa faltante","¿Existe mapa?","Prioridad"]
for c,h in enumerate(hdr,start=1):
    cell=tr.cell(4,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
tr.row_dimensions[4].height=32
seed=[
 ("¿Está bien dar cortesía/descuento a un cliente frecuente?","Mesero","¿Está bien...?","3+","Política de cortesías y descuentos","No","Alta"),
 ("¿Qué hago cuando un cliente se queja en la mesa?","Mesero","¿Qué hago cuando...?","3+","Manejo de queja en mesa","Parcial","Alta"),
 ("¿Qué hago cuando se agota un plato (86) en servicio?","Cocina/Sala","¿Qué hago cuando...?","Semanal","Manejo de 86 en servicio","No","Media"),
 ("¿Cómo manejo una reserva de grupo grande o evento?","Host/Sala","¿Cómo hago...?","Semanal","Reservas de grupo/eventos","Parcial","Media"),
 ("¿Qué hago cuando hay un no-show o cancelación tardía?","Host","¿Qué hago cuando...?","Semanal","No-shows y cancelaciones","No","Media"),
 ("¿Quién maneja la trampa de grasa / una falla de mantenimiento?","Cocina","¿Quién maneja...?","Ocasional","Mantenimiento y proveedores","No","Baja"),
]
rr=5
for i,(q,who,cat,freq,mapa,exist,prio) in enumerate(seed,start=1):
    tr.cell(rr,1,i).font=F(9,True); tr.cell(rr,1).alignment=ctr; tr.cell(rr,1).border=border
    tr.cell(rr,2,q).font=F(9); tr.cell(rr,2).alignment=wrap; tr.cell(rr,2).border=border; tr.cell(rr,2).fill=fill(CREMA)
    tr.cell(rr,3,who).font=F(9); tr.cell(rr,3).alignment=wrap; tr.cell(rr,3).border=border
    tr.cell(rr,4,cat).font=F(9); tr.cell(rr,4).alignment=wrap; tr.cell(rr,4).border=border
    tr.cell(rr,5,freq).font=F(9); tr.cell(rr,5).alignment=ctr; tr.cell(rr,5).border=border
    tr.cell(rr,6,mapa).font=F(9); tr.cell(rr,6).alignment=wrap; tr.cell(rr,6).border=border
    ec=tr.cell(rr,7,exist); ec.font=F(9); ec.alignment=ctr; ec.border=border; ec.fill=fill("E1F0E4" if exist=="Sí" else AMBAR)
    pc=tr.cell(rr,8,prio); pc.font=F(9,True); pc.alignment=ctr; pc.border=border; pc.fill=fill(AMBAR if prio=="Alta" else CREMA)
    tr.row_dimensions[rr].height=30; rr+=1
for i in range(7,15):
    tr.cell(rr,1,i).font=F(9,True); tr.cell(rr,1).alignment=ctr
    for c in range(1,9):
        tr.cell(rr,c).border=border; tr.cell(rr,c).alignment=wrap; tr.cell(rr,c).font=F(9)
    tr.row_dimensions[rr].height=22; rr+=1
last=rr-1
dvc=DataValidation(type="list",formula1='"¿Cómo hago...?,¿Qué hago cuando...?,¿Quién maneja...?,¿Está bien...?,¿Dónde está...?"',allow_blank=True); tr.add_data_validation(dvc); dvc.add(f"D5:D{last}")
dve=DataValidation(type="list",formula1='"Sí,No,Parcial"',allow_blank=True); tr.add_data_validation(dve); dve.add(f"G5:G{last}")
dvp=DataValidation(type="list",formula1='"Alta,Media,Baja"',allow_blank=True); tr.add_data_validation(dvp); dvp.add(f"H5:H{last}")
rr+=1
tr.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=8)
tr.cell(rr,1,"TOP 3 MAPAS A CONSTRUIR: #1 Cortesías y descuentos (Alta, cuesta dinero) · #2 Manejo de queja en mesa (Alta, afecta reseñas) · #3 Manejo de 86 en servicio.").font=F(9,italic=True,color="6B5A45")
tr.cell(rr,1).alignment=wrap; tr.row_dimensions[rr].height=28

# ===== EJEMPLO DE MAPA =====
ex=wb.create_sheet("📋 Ejemplo de mapa"); ex.sheet_view.showGridLines=False
for col,w in [("A",4),("B",40),("C",60)]: ex.column_dimensions[col].width=w
ex.merge_cells("A1:C1")
t=ex.cell(1,1,"ROSANTA · Mapa ejemplo — Política de cortesías y descuentos"); t.font=F(13,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); ex.row_dimensions[1].height=24
ex.merge_cells("A2:C2")
ex.cell(2,1,"15 min de escritura. Elimina la pregunta '¿está bien dar...?' para siempre. Toda cortesía se registra en el POS (control del Sistema Controlador).").font=F(9,italic=True,color="6B5A45"); ex.row_dimensions[2].height=28
for c,h in enumerate(["#","Situación","Qué hacer"],start=1):
    cell=ex.cell(4,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=wrapc; cell.border=border
ex.row_dimensions[4].height=18
steps=[
 ("Cliente frecuente o cumpleaños","Cortesía de postre o coctel de bienvenida. Hasta [Qmonto] sin autorización. Registrar en POS como cortesía con motivo."),
 ("Error de cocina (plato mal hecho o tardío)","Disculpa, ofrecer rehacer o descuento. Registrar en POS como cortesía con motivo 'error cocina'."),
 ("Queja de calidad en mesa","Escuchar, disculpa sincera, rehacer o descuento. Si es mayor a [Qmonto], decide el jefe de turno."),
 ("Descuento a grupo o evento","Solo con cotización aprobada (usar el cotizador). Nada de descuentos improvisados a grupos."),
 ("Recurrente (3+ cortesías de la misma causa en una semana)","Escalar al jefe de área para causa raíz. El Sistema Controlador ya cruza anulaciones/cortesías en el Daily Flash."),
]
rr=5
for i,(sit,act) in enumerate(steps,start=1):
    ex.cell(rr,1,i).font=F(9,True); ex.cell(rr,1).alignment=ctr; ex.cell(rr,1).border=border
    ex.cell(rr,2,sit).font=F(9,True,VERDE); ex.cell(rr,2).alignment=wrap; ex.cell(rr,2).border=border
    c=ex.cell(rr,3,act); c.font=F(9); c.alignment=wrap; c.border=border; c.fill=fill(CREMA)
    ex.row_dimensions[rr].height=40; rr+=1
ex.cell(rr+1,2,"[Qmonto] en ámbar = define tú los límites de autorización.").font=F(9,italic=True,color="6B5A45")
c=ex.cell(rr+1,2); 
# small amber marker cell
ex.cell(rr+1,3,"Sugerencia: cortesía de cortesía hasta ~Q75 sin autorización; arriba de eso, jefe de turno.").font=F(9); ex.cell(rr+1,3).fill=fill(AMBAR); ex.cell(rr+1,3).alignment=wrap; ex.row_dimensions[rr+1].height=28

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Mapeo_Avanzado.xlsx"
wb.save(out); print("guardado:",out)
