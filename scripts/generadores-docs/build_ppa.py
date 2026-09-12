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
wr(r,"ROSANTA · Auditoría de Presencia Física",16,True,"FFFFFF",VERDE,h=30); r+=1
wr(r,"Cocina con Carisma · Lección 2.6 · Overseas Hiring 101",9,False,"FFFFFF",VERDE,italic=True); r+=1
r+=1
wr(r,"EL PRINCIPIO",12,True,COBRE); r+=1
wr(r,"Toda tarea cae en una de dos categorías: de PRESENCIA FÍSICA (debe estar en el edificio: cocinar, servir, limpiar, recibir entregas) o NO FÍSICA (se puede hacer desde cualquier lugar: registro, facturación, redes, agenda, investigación, contabilidad, seguimientos). El filtro es uno solo: ¿requiere un cuerpo en el edificio? Si no, es candidata a overseas. El 20-40% del trabajo de un restaurante no necesita hacerse dentro del edificio.",10,h=58); r+=1
r+=1
wr(r,"TU PUNTO DE PARTIDA",12,True,VERDE); r+=1
for t in [
 "Ya tienes overseas funcionando: Vanessa (Pauta) desde Colombia, y Daniel (Video/Foto). El modelo te funciona.",
 "El Controlador (#1 de la lista genérica) tú lo resolviste como SISTEMA (Claude + artefactos), no como persona. Por eso tu #1 candidato HUMANO nuevo baja al Asistente Virtual general.",
 "Tu palanca sin explotar más grande es no física: ~184 carritos abandonados/mes con contacto. Un VA que los trabaje tiene ROI inmediato.",
]:
    wr(r,t,10,bg=CREMA,h=32); r+=1
r+=1
wr(r,"ERRORES COMUNES",12,True,VERDE); r+=1
for t in [
 "1. 'Mi negocio es muy pequeño para overseas': con una locación de $1M+ tienes suficiente trabajo no físico para al menos un overseas. Empieza con un VA y mide.",
 "2. Contratar overseas para roles del edificio: no pueden cocinar, servir ni limpiar. El test de presencia física es el filtro.",
 "3. No invertir en el onboarding: necesitan igual o más estructura que un local (usa el Playbook de la 2.7).",
]:
    wr(r,t,10,h=30); r+=1

# ===== AUDITORÍA =====
au=wb.create_sheet("📋 Auditoría de tareas"); au.sheet_view.showGridLines=False
for col,w in [("A",4),("B",34),("C",18),("D",12),("E",22),("F",26)]: au.column_dimensions[col].width=w
au.merge_cells("A1:F1")
t=au.cell(1,1,"ROSANTA · ¿Qué trabajo necesita estar en el edificio?"); t.font=F(13,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); au.row_dimensions[1].height=24
au.merge_cells("A2:F2")
au.cell(2,1,"Marca cada tarea. Suma las horas/sem de las NO físicas: ese es tu potencial overseas. Horas en ámbar (llénalas tú).").font=F(9,italic=True,color="6B5A45")
for c,h in enumerate(["#","Tarea","Física / No física","Horas/sem","Quién lo hace hoy","Candidato overseas"],start=1):
    cell=au.cell(4,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
au.row_dimensions[4].height=30
tasks=[
 ("Cocinar y emplatar","Física","","Cocina (Jeffry, Nadia, Fernanda)","— (queda local)"),
 ("Servir y atender la mesa","Física","","Sala (José, Efraín, meseros)","— (queda local)"),
 ("Coctelería en barra","Física","","Coctelero","— (queda local)"),
 ("Lavado de loza / limpieza","Física","","Yazmin","— (queda local)"),
 ("Mantenimiento y jardín","Física","","Mario Valle","— (queda local)"),
 ("Recibir entregas de proveedores","Física","","Jefe de turno / cocina","— (queda local)"),
 ("Registro contable y facturación FEL","No física","","Juanma + Econtrista","Econtrista (externo) / Sistema"),
 ("Verificación de números y análisis P&L","No física","","Juanma","Sistema Controlador (ya decidido)"),
 ("Reservas y seguimiento de leads","No física","","Juanma + bot","Asistente Virtual general"),
 ("Recuperación de carritos abandonados (~184/mes)","No física","","Nadie hoy","Asistente Virtual general (alto ROI)"),
 ("Gestión de reseñas","No física","","Panel + Juanma","VA / Marketing VA"),
 ("Pauta / anuncios Meta","No física","","Vanessa Wilches","YA overseas (Colombia)"),
 ("Contenido, video y foto","No física","","Daniel Flores","YA overseas"),
 ("Programación de publicaciones","No física","","Vanessa / Daniel","Asistente de Marketing/Contenido"),
 ("Seguimiento a proveedores y órdenes","No física","","Juanma","Asistente Virtual general"),
 ("Ventas y seguimiento de eventos/catering","No física","","Juanma + cotizador","Vendedor de catering (overseas)"),
]
rr=5
for i,(task,cls,hrs,who,cand) in enumerate(tasks,start=1):
    au.cell(rr,1,i).font=F(9,True); au.cell(rr,1).alignment=ctr; au.cell(rr,1).border=border
    au.cell(rr,2,task).font=F(9); au.cell(rr,2).alignment=wrap; au.cell(rr,2).border=border
    cc=au.cell(rr,3,cls); cc.font=F(9,True); cc.alignment=ctr; cc.border=border
    cc.fill=fill("E1F0E4" if cls=="Física" else AMBAR)
    hc=au.cell(rr,4,hrs); hc.border=border; hc.alignment=ctr; hc.fill=fill(AMBAR if cls=="No física" else "FFFFFF")
    au.cell(rr,5,who).font=F(9); au.cell(rr,5).alignment=wrap; au.cell(rr,5).border=border
    au.cell(rr,6,cand).font=F(9); au.cell(rr,6).alignment=wrap; au.cell(rr,6).border=border
    au.row_dimensions[rr].height=28; rr+=1
dv=DataValidation(type="list",formula1='"Física,No física"',allow_blank=True); au.add_data_validation(dv); dv.add(f"C5:C{rr-1}")
rr+=1
au.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=6)
au.cell(rr,1,"Suma las horas/sem de las filas 'No física' = tu total de trabajo remoto-capable. Ese número justifica cuántos overseas puedes soltar.").font=F(9,italic=True,color="6B5A45")
au.cell(rr,1).alignment=wrap; au.row_dimensions[rr].height=26

# ===== ECONOMÍA Y PRIORIDAD =====
ec=wb.create_sheet("📋 Economía y prioridad"); ec.sheet_view.showGridLines=False
for col,w in [("A",4),("B",26),("C",22),("D",22),("E",14)]: ec.column_dimensions[col].width=w
ec.merge_cells("A1:E1")
t=ec.cell(1,1,"ROSANTA · Economía local vs. overseas"); t.font=F(13,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); ec.row_dimensions[1].height=24
for c,h in enumerate(["#","Rol","Costo local (USD/mes)","Costo overseas (USD/mes)","Ahorro"],start=1):
    cell=ec.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=ctr; cell.border=border
ec.row_dimensions[3].height=28
econ=[
 ("VA general","$3,500-$4,500","$800-$1,500","60-75%"),
 ("Controlador","$5,000-$7,000","$1,500-$3,000","50-65%"),
 ("Social Media VA","$3,500-$5,000","$1,000-$2,000","55-70%"),
 ("Ventas de catering","$4,000-$6,000","$1,000-$2,500","55-70%"),
]
rr=4
for i,(rol,loc,ov,sv) in enumerate(econ,start=1):
    ec.cell(rr,1,i).font=F(9,True); ec.cell(rr,1).alignment=ctr; ec.cell(rr,1).border=border
    ec.cell(rr,2,rol).font=F(9,True,VERDE); ec.cell(rr,2).alignment=wrap; ec.cell(rr,2).border=border
    for c,v in [(3,loc),(4,ov),(5,sv)]:
        ec.cell(rr,c,v).font=F(9); ec.cell(rr,c).alignment=ctr; ec.cell(rr,c).border=border
    ec.row_dimensions[rr].height=24; rr+=1
rr+=1
ec.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=5)
ec.cell(rr,1,"PRIORIDAD DE CONTRATACIÓN (lista genérica → ajuste Rosanta)").font=F(10,True,COBRE); ec.cell(rr,1).fill=fill(CREMA); ec.row_dimensions[rr].height=18; rr+=1
prio=[
 ("1","Controlador ($500-$1,500) — mayor ROI. EN ROSANTA: resuelto como SISTEMA (Claude + artefactos)."),
 ("2","VA general ($800-$1,500) — libera admin/reservas/CRM. TU #1 CANDIDATO HUMANO NUEVO (carritos abandonados)."),
 ("3","Analista financiero ($1,500-$3,000) — P&L profundo, tendencias, forecast. Complementa el sistema."),
 ("4","Marketing VA ($1,000-$2,000) — redes, reseñas, contenido. YA cubierto en parte (Vanessa/Daniel); playbook 2.7 listo."),
 ("5","Vendedor de catering ($1,000-$2,500) — genera ingresos (tu palanca #1 de eventos)."),
]
for n,txt in prio:
    ec.cell(rr,1,n).font=F(9,True,COBRE); ec.cell(rr,1).alignment=ctr; ec.cell(rr,1).border=border
    ec.merge_cells(start_row=rr,start_column=2,end_row=rr,end_column=5)
    c=ec.cell(rr,2,txt); c.font=F(9); c.alignment=wrap; c.border=border; c.fill=fill(CREMA)
    ec.row_dimensions[rr].height=30; rr+=1
rr+=1
ec.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=5)
ec.cell(rr,1,"Tu #1 candidato: Asistente Virtual general (admin, reservas, CRM, carritos abandonados). El Playbook de la 2.7 ya está armado para un Asistente de Marketing/Contenido; decide con cuál arrancas.").font=F(9,italic=True,color="6B5A45")
ec.cell(rr,1).alignment=wrap; ec.row_dimensions[rr].height=32

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Auditoria_Presencia_Fisica.xlsx"
wb.save(out); print("guardado:",out)
