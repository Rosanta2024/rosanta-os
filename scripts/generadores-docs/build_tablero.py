# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
VERDE="4A6741"; TIERRA="A0785A"; CREMA="F5EFE0"; COBRE="C9923F"; MARRON="3D2B1F"; AMBAR="FFF2CC"
def F(sz=10,b=False,color=MARRON,it=False): return Font(name="Arial",size=sz,bold=b,color=color,italic=it)
def fill(h): return PatternFill("solid",fgColor=h)
thin=Side(style="thin",color="CCC7BA"); border=Border(left=thin,right=thin,top=thin,bottom=thin)
wrap=Alignment(wrap_text=True,vertical="center"); ctr=Alignment(horizontal="center",vertical="center",wrap_text=True)
wb=openpyxl.Workbook()

# ---- Instrucciones ----
ins=wb.active; ins.title="📖 Cómo usar"; ins.sheet_view.showGridLines=False
ins.column_dimensions["A"].width=3; ins.column_dimensions["B"].width=104
def wr(r,t,sz=10,b=False,color=MARRON,bg=None,it=False,h=None):
    c=ins.cell(r,2,t); c.font=F(sz,b,color,it); c.alignment=Alignment(wrap_text=True,vertical="top")
    if bg: c.fill=fill(bg); ins.cell(r,1).fill=fill(bg)
    if h: ins.row_dimensions[r].height=h
r=1; ins.row_dimensions[1].height=30
wr(r,"ROSANTA · Tablero de Metas (fuente única)",16,True,"FFFFFF",VERDE,h=30); r+=1
wr(r,"Cocina con Carisma · Sistema ↔ Estrategia · Reconciliado con Mejoras v2 y POS 2026",9,False,"FFFFFF",VERDE,it=True); r+=1
r+=1
wr(r,"QUÉ ES",12,True,COBRE); r+=1
wr(r,"Esta es la ÚNICA fuente de verdad de tus metas. Antes vivían sueltas y con cifras distintas (mi propuesta vs. Mejoras v2). Aquí quedan reconciliadas con datos reales del maestro y del POS. El Panel de 3 señales (Daily Flash / Weekly / Monthly) es solo una VISTA de este tablero según la columna Frecuencia.",10,h=52); r+=1
r+=1
wr(r,"CÓMO SE LEE CADA META",12,True,VERDE); r+=1
for t in ["• Objetivo: a cuál de las 5 grandes metas pertenece.",
          "• KPI · Meta · Base/actual: qué se mide, a dónde queremos llegar y de dónde partimos (dato real).",
          "• Frecuencia: cada cuánto se revisa (define en qué vista del panel aparece).",
          "• Fuente independiente: de dónde sale el dato (nunca de la persona medida).",
          "• Dueño: quién la posee. · Palanca: qué iniciativa de Mejoras v2 la mueve."]:
    wr(r,t,10,bg=CREMA,h=20); r+=1
r+=1
wr(r,"NOTA",12,True,VERDE); r+=1
wr(r,"La ESTRATEGIA para alcanzar estas metas (cómo mover cada número) es un tema aparte, marcado como prioridad #1 al terminar el sistema, empezando por ocupación entre semana.",10,bg=AMBAR,h=32)

# ---- Tablero ----
tb=wb.create_sheet("🎯 Tablero de Metas"); tb.sheet_view.showGridLines=False
widths=[22,26,26,22,14,22,18,10]
for i,w in enumerate(widths,1): tb.column_dimensions[get_column_letter(i)].width=w
tb.merge_cells("A1:H1")
t=tb.cell(1,1,"ROSANTA · Tablero de Metas — fuente única"); t.font=F(14,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); tb.row_dimensions[1].height=24
hdr=["Objetivo","KPI","Meta","Base / actual (dato real)","Frecuencia","Fuente independiente","Dueño","Palanca"]
for c,h in enumerate(hdr,1):
    cell=tb.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
tb.row_dimensions[3].height=30

data=[
 ("A · Crecer ingresos","Ventas del mes","Curva H2: jul 140K · ago 170K · sep 130K · oct 140K · nov 220K · dic 240K","jun Q137K (equilibrio)","Mensual","POS / maestro","Juanma","1·2·3"),
 ("A · Crecer ingresos","Ticket promedio","≥ Q280","~Q280 (2026)","Semanal","POS","Jeffry / José","2"),
 ("A · Crecer ingresos","Comensales/día lun–mié","16 (base 15 · stretch 18)","jul 12.5/día · jun 8.9","Semanal","POS (columna Notas)","Juanma / José","3"),
 ("A · Crecer ingresos","Eventos por mes","≥ 2","—","Mensual","Agenda / POS","Juanma","1"),
 ("B · Proteger margen","CMV cocina","≤ 30%","~30%","Semanal","Recetario + inventario","Jeffry","4·5"),
 ("B · Proteger margen","CMV barra","≤ 20%","por medir","Semanal","Recetario + inventario","José","4"),
 ("B · Proteger margen","Prime cost (CMV+labor)","≤ 55%","~52% (30%+22%)","Mensual","Maestro","Juanma","4·8"),
 ("B · Proteger margen","Merma","≤ 3%","por medir (waste log)","Semanal","Waste log / inventario","Jeffry","4"),
 ("B · Proteger margen","% mano de obra","≤ 23%","~22% (Q31K/ventas)","Semanal","Planilla + POS","José / Jeffry","8"),
 ("B · Proteger margen","Comisión de tarjeta","≤ 4%","5.5% (jun Q7,594)","Mensual","Maestro","Juanma","6"),
 ("C · Experiencia y reputación","Rotación de mesa","45 min","por medir","Semanal","POS","José","Servicio FOH"),
 ("C · Experiencia y reputación","Reseñas (rating)","≥ 4.7★","por medir","Semanal","panel-reseñas","José","QR / SEO"),
 ("C · Experiencia y reputación","Precisión de orden","[definir]","—","Diario","Scorecard 7 pasos","José","Servicio FOH"),
 ("D · Marketing que convierte","ROAS de pauta","≥ 3x","por medir","Semanal","Tablero de pauta (Meta)","Vanessa","Mesa Llena"),
 ("D · Marketing que convierte","Carritos recuperados","[definir meta]","~184/mes disponibles","Mensual","CRM / SonTickets","VA / Vanessa","1"),
 ("D · Marketing que convierte","Reservas","[definir meta]","por medir","Semanal","SonTickets","Host","Mesa Llena"),
 ("E · Rentabilidad","Ventas vs break-even","> Q137K/mes","jun ~equilibrio","Mensual","Maestro","Juanma","todas"),
 ("E · Rentabilidad","Margen de contribución","~67%","~67%","Mensual","Maestro","Juanma","4·5"),
 ("E · Rentabilidad","EBITDA","> 10% (Q4)","por medir","Mensual","Maestro","Juanma","todas"),
]
obj_colors={"A":"E7F0E1","B":"F3EAD9","C":"E9EEF3","D":"F3E9EE","E":"EFEFE7"}
rr=4; last_obj=None
for row in data:
    obj=row[0]; key=obj.split(" ")[0]
    for c,v in enumerate(row,1):
        cell=tb.cell(rr,c,v); cell.border=border; cell.alignment=Alignment(wrap_text=True,vertical="center")
        cell.font=F(9,True,VERDE) if c==1 else F(9)
        if c==1: cell.fill=fill(obj_colors[key])
        if c==3: cell.fill=fill("FBF6E8")
        if 'definir' in str(v) or 'por medir' in str(v): cell.fill=fill(AMBAR)
    tb.row_dimensions[rr].height=30; rr+=1
rr+=1
tb.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=8)
tb.cell(rr,1,"Ámbar = pendiente de medir o de definir meta (rotación, reseñas, merma, CMV barra, carritos, reservas, EBITDA). Se completan cuando arranque el scorecard/controlador.").font=F(8,it=True,color="6B5A45")
tb.cell(rr,1).alignment=Alignment(wrap_text=True); tb.row_dimensions[rr].height=26

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Tablero_de_Metas.xlsx"
wb.save(out); print("guardado:",out)
