# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

VERDE="4A6741"; TIERRA="A0785A"; CREMA="F5EFE0"; COBRE="C9923F"; MARRON="3D2B1F"; AMBAR="FFF2CC"
FONT="Arial"
def F(sz=10,b=False,color=MARRON,italic=False): return Font(name=FONT,size=sz,bold=b,color=color,italic=italic)
def fill(h): return PatternFill("solid",fgColor=h)
thin=Side(style="thin",color="BFB4A0"); border=Border(left=thin,right=thin,top=thin,bottom=thin)
wrap=Alignment(wrap_text=True,vertical="top"); wrapc=Alignment(wrap_text=True,vertical="center")
wb=openpyxl.Workbook()

# ===== HOJA 1: INSTRUCCIONES =====
ws=wb.active; ws.title="📖 Instrucciones"; ws.sheet_view.showGridLines=False
ws.column_dimensions["A"].width=3; ws.column_dimensions["B"].width=108
def wr(row,text,sz=10,b=False,color=MARRON,bg=None,italic=False,h=None):
    c=ws.cell(row=row,column=2,value=text); c.font=F(sz,b,color,italic); c.alignment=wrap
    if bg: c.fill=fill(bg); ws.cell(row=row,column=1).fill=fill(bg)
    if h: ws.row_dimensions[row].height=h
r=1; ws.row_dimensions[1].height=30
wr(r,"ROSANTA · Organigrama y H.O.T. Canvas",16,True,"FFFFFF",VERDE,h=30); r+=1
wr(r,"Cocina con Carisma · Lección 2.2–2.3 · Estructura real del equipo (jul 2026)",9,False,"FFFFFF",VERDE,italic=True); r+=1
r+=1
wr(r,'PRIMERO LOS CUARTOS, LUEGO LAS PERSONAS',12,True,COBRE); r+=1
wr(r,'Tu empresa puede cumplir 100 años y seguirá habiendo cocina, sala, barra, mantenimiento y finanzas. Las personas cambian; la estructura no. Este organigrama es un diagnóstico de cómo fluyen HOY las decisiones.',10,h=44); r+=1
r+=1
wr(r,"CÓMO LEER EL ORGANIGRAMA (hoja 🏛️)",12,True,VERDE); r+=1
for t in [
 "Línea real = la persona resuelve con su jefe de área. Línea punteada = reporta a un jefe pero para todo te busca a ti (o es externo).",
 "Cuenta cuántas líneas llegan directo al CEO. La meta (Lección 2.9) es que Cocina resuelva con el Chef y Sala con José, para que te lleguen pocas líneas directas.",
 "Columna 'Contrato': En contrato = tiempo completo · Medio Tiempo · Externo.",
]:
    wr(r,t,10,h=30); r+=1
r+=1
wr(r,"CÓMO LLENAR EL H.O.T. CANVAS (hoja 🎩)",12,True,VERDE); r+=1
for t in [
 "Por persona: Hats (funciones reales) · Outcomes (métricas que posee) · Tareas recurrentes (D/S/M).",
 "Columna extra Rosanta: 'Ahora cubierto por artefacto/SOP' — qué de ese trabajo ya lo absorbió un panel, el bot, el maestro o un SOP.",
]:
    wr(r,t,10,bg=CREMA,h=30); r+=1
r+=1
wr(r,"MODELO DE TURNOS (resumen)",12,True,VERDE); r+=1
for t in [
 "• Días bajos (entre semana): 2 personas en sala = 1 mixólogo (José o Efraín, se turnan) + 1 mesero.",
 "• Fin de semana: 1 mixólogo + 2 meseros. Si las reservas muestran mucha gente: 2 mixólogos + 2 meseros.",
 "• Eventos: se suma personal según la cantidad de invitados.",
 "• Los 3 meseros son de medio tiempo y rotan por día.",
]:
    wr(r,t,10,bg=CREMA,h=24); r+=1

# ===== HOJA 2: ORGANIGRAMA =====
og=wb.create_sheet("🏛️ Organigrama"); og.sheet_view.showGridLines=False
for col,w in [("A",5),("B",30),("C",24),("D",22),("E",13),("F",12),("G",34)]: og.column_dimensions[col].width=w
og.merge_cells("A1:G1")
t=og.cell(1,1,"ROSANTA · Organigrama actual (jul 2026)"); t.font=F(15,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); og.row_dimensions[1].height=26
hdr=["Nivel","Cuarto / Puesto","Persona","Reporta a","Contrato","Línea","Notas"]
for c,h in enumerate(hdr,start=1):
    cell=og.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=wrapc; cell.border=border
og.row_dimensions[3].height=24
# nivel, puesto, persona, reporta, contrato, linea, nota, pendiente
rows=[
 ("0","Dirección — CEO","Juan Manuel Lemus","—","Socio","—","Socio fundador. Dirección, finanzas, reservas, marketing.",False),
 ("0","Dirección — Socio capitalista","Raúl Monterroso","—","Socio","—","CORSAGA, S.A.",False),
 ("1","Cocina — Jefe de Cocina / Chef","Jeffry López","CEO","En contrato","Real","Dueño del cuarto Cocina. CMV 30%.",False),
 ("2","Cocina — 2º de Cocina","Nadia del Águila","Jefe de Cocina","En contrato","Real","",False),
 ("2","Cocina — 3º de Cocina","Fernanda Pedroza","Jefe de Cocina","Medio Tiempo","Real","",False),
 ("2","Cocina — Lavaplatos / Steward","Yazmin","Jefe de Cocina","—","Real","Confirmar tipo de contrato.",False),
 ("1","Sala/Barra — Jefe de Sala, Supervisor y Mixólogo","José Mazate","CEO","En contrato","Real","Dueño del cuarto Sala + Barra. CMV barra 20%.",False),
 ("2","Sala/Barra — 2º de Sala / Mixólogo","Efraín Taquez","José Mazate","En contrato","Real","",False),
 ("2","Sala — Mesero","Marvin Pamal","José Mazate","Medio Tiempo","Real","Los 3 meseros son medio tiempo; se turnan por día.",False),
 ("2","Sala — Mesero","Eddy Cariño","José Mazate","Medio Tiempo","Real","",False),
 ("2","Sala — Mesero","Melvin Cojolón","José Mazate","Medio Tiempo","Real","",False),
 ("1","Mantenimiento — Jardinero y Mantenimiento","Mario Valle","CEO","—","Real","Confirmar tipo de contrato.",False),
 ("1","Administración — Contabilidad","Econtrista (externo)","CEO","Externo","Punteada","Recibe el reporte mensual del maestro.",False),
 ("1","Marketing — Pauta","Vanessa Wilches","CEO","Externo","Punteada","Hook rate, CPC, engagement (tablero semanal).",False),
 ("1","Marketing — Video y Fotografía","Daniel Flores","CEO","Externo","Punteada","Contenido: piezas, reels, foto.",False),
]
rr=4
for lvl,pos,per,rep,con,line,nota,pend in rows:
    vals=[lvl,pos,per,rep,con,line,nota]
    for c,v in enumerate(vals,start=1):
        cell=og.cell(rr,c,v); cell.border=border; cell.alignment=wrap; cell.font=F(9)
        if c==2: cell.font=F(9,True,VERDE)
        if c==3 and pend: cell.fill=fill(AMBAR)
        if c==6 and v=="Punteada": cell.font=F(9,True,COBRE)
    og.row_dimensions[rr].height=30; rr+=1
rr+=1
og.merge_cells(start_row=rr,start_column=1,end_row=rr,end_column=7)
og.cell(rr,1,"Diagnóstico: 6 líneas llegan directo al CEO (Chef, José, Mario, Contabilidad, Vanessa, Daniel). Bueno: ya tienes DOS jefes de área con equipo real (Chef en Cocina, José en Sala/Barra). Oportunidad (Lección 2.9): que Mantenimiento y Marketing también reporten a un jefe de operaciones, y confirmar que Cocina y Sala resuelvan sin escalar al CEO.").font=F(9,italic=True,color="6B5A45")
og.cell(rr,1).alignment=wrap; og.row_dimensions[rr].height=52
rr+=2
og.cell(rr,1,"MODELO DE STAFFING POR DÍA").font=F(11,True,VERDE); rr+=1
staff=[
 ("Días bajos (entre semana)","Sala: 2 personas = 1 mixólogo (José o Efraín, se turnan) + 1 mesero.  Cocina: se ajusta según reservas."),
 ("Fin de semana","Sala: 1 mixólogo + 2 meseros. Si las reservas muestran mucha gente: 2 mixólogos + 2 meseros. Cocina se ajusta igual según reservas."),
 ("Eventos","Se aumenta el personal de cocina y sala según la cantidad de invitados."),
 ("Meseros","Marvin, Eddy y Melvin son medio tiempo y rotan por día."),
]
og.cell(rr,1,"Escenario").font=F(9,True,"FFFFFF"); og.cell(rr,1).fill=fill(TIERRA); og.cell(rr,1).border=border
og.merge_cells(start_row=rr,start_column=2,end_row=rr,end_column=7)
og.cell(rr,2,"Personal en piso").font=F(9,True,"FFFFFF"); og.cell(rr,2).fill=fill(TIERRA); og.cell(rr,2).border=border
og.row_dimensions[rr].height=20; rr+=1
for esc,desc in staff:
    a=og.cell(rr,1,esc); a.font=F(9,True,VERDE); a.alignment=wrap; a.border=border; a.fill=fill(CREMA)
    og.merge_cells(start_row=rr,start_column=2,end_row=rr,end_column=7)
    b=og.cell(rr,2,desc); b.font=F(9); b.alignment=wrap; b.border=border
    og.row_dimensions[rr].height=30; rr+=1


# ===== HOJA 3: H.O.T. CANVAS =====
hc=wb.create_sheet("🎩 H.O.T. Canvas"); hc.sheet_view.showGridLines=False
for i,w in enumerate([26,18,34,32,30,34],start=1): hc.column_dimensions[get_column_letter(i)].width=w
hc.merge_cells("A1:F1")
t=hc.cell(1,1,"ROSANTA · H.O.T. Canvas (Hats · Outcomes · Tasks)"); t.font=F(15,True,"FFFFFF"); t.fill=fill(VERDE); t.alignment=Alignment(vertical="center"); hc.row_dimensions[1].height=26
hdr=["Puesto · Persona","Reporta a","Hats (funciones reales)","Outcomes que posee (medibles)","Tareas recurrentes (D/S/M)","Ahora cubierto por artefacto / SOP"]
for c,h in enumerate(hdr,start=1):
    cell=hc.cell(3,c,h); cell.font=F(9,True,"FFFFFF"); cell.fill=fill(TIERRA); cell.alignment=wrapc; cell.border=border
hc.row_dimensions[3].height=34
canvas=[
("CEO · Juan Manuel Lemus","—",
 "Dirección · Finanzas · Reservas · Marketing (supervisión) · Menú y precio · Compras · Reputación · Talento",
 "Margen de contribución · Crecimiento de ventas · EBITDA mensual · Ocupación entre semana",
 "D: reservas y correos del bot · S: sync con Chef y José, tablero de pauta · M: cierre financiero, reporte al contador",
 "Reservas → bot + CRM · Finanzas/reporte → rosanta-maestro · Cotizaciones → rosanta-cotizador · Reputación → panel-reseñas · Ads → auditoría Meta mensual",False),
("Socio capitalista · Raúl Monterroso","—","Aporte de capital (CORSAGA, S.A.)","Retorno de la inversión según acuerdo","Según acuerdo de socios","—",False),
("Jefe de Cocina / Chef · Jeffry López","CEO",
 "Dirige Cocina · Estándar de recetas y emplatado · Compras de cocina · Capacita a 2º/3º/lavaplatos · Control de merma",
 "CMV cocina 30% · Tiempo de salida de plato · % merma · Consistencia de recetas",
 "D: scorecard 7 pasos de cocina, mise en place · S: pedido a proveedores, inventario",
 "Costeo/recetario → hojas Barra/Cocina · Inventarios → rosanta-inventarios · Scorecard → plantilla 7 pasos",False),
("2º de Cocina · Nadia del Águila","Jefe de Cocina",
 "Producción en línea · Apoyo a jefatura · Emplatado","Tiempo de salida · Consistencia de emplatado","D: mise en place, servicio, cierre de estación",
 "Ficha técnica → recetario",False),
("3º de Cocina · Fernanda Pedroza (Medio Tiempo)","Jefe de Cocina",
 "Producción y prep en horas pico","Cumplimiento de mise en place · % merma en prep","D: prep del día",
 "Log de merma → rosanta-inventarios",False),
("Lavaplatos / Steward · Yazmin","Jefe de Cocina",
 "Lavado · Limpieza de cocina · Manejo de vajilla","Rotación de loza · Higiene de cocina","D: turno completo de stewarding","—",False),
("Jefe de Sala, Supervisor y Mixólogo · José Mazate","CEO",
 "Dirige Sala y Barra · Asigna mesas · Maneja quejas · Capacita meseros · Cuadra propinas · Coctelería",
 "Rotación de mesa · Ticket promedio · Satisfacción / reseñas · CMV barra 20%",
 "D: scorecard 7 pasos de sala, pre-turno · S: horarios, reseñas · M: reporte al CEO",
 "Reseñas → panel-reseñas · Reservas → SonTickets + bot · Scorecard → plantilla 7 pasos · Propinas → maestro",False),
("2º de Sala / Mixólogo · Efraín Taquez","José Mazate",
 "Coctelería · Apoyo a jefatura de sala · Inventario de barra","CMV barra 20% · Ventas de coctelería · Merma de barra",
 "D: montaje y cierre de barra, servicio · S: inventario de licores","Costeo de cóctel → recetario Barra",False),
("Meseros · Marvin Pamal · Eddy Cariño · Melvin Cojolón","José Mazate",
 "Servicio de mesa · Toma de orden · Upsell (postre/coctel/maridaje) · Limpieza de sección",
 "Rotación de sección · Upsell rate · Precisión de orden · Reseñas de servicio",
 "D: pre-turno, servicio, cierre de sección","—  (contacto directo; poco automatizable)",False),
("Jardinero y Mantenimiento · Mario Valle","CEO",
 "Mantenimiento del inmueble · Jardín y huerto · Reparaciones","Espacio impecable · Cero fallas que corten servicio · Huerto productivo",
 "D: ronda de mantenimiento · S: jardín/huerto","—",False),
("Contabilidad · Econtrista (externo)","CEO (punteada)",
 "Registro contable · IVA/FEL · Planilla/IGSS","Cierre contable a tiempo · Cumplimiento fiscal","M: recibir reporte y cerrar mes",
 "Reporte mensual → lo genera rosanta-maestro",False),
("Pauta · Vanessa Wilches","CEO (punteada)",
 "Gestión de campañas Meta · Optimización de anuncios · Reporte de pauta","Hook rate · CPC · Engagement · Costo por lead",
 "S: revisar tablero de pauta · M: cierre de campaña","Datos de pauta → tablero semanal · Auditoría Meta Ads → tarea mensual (día 25)",False),
("Video y Fotografía · Daniel Flores","CEO (punteada)",
 "Producción de video y foto · Reels · Contenido orgánico","Piezas publicadas · Alcance orgánico · Fatiga de creativo",
 "S: producir y entregar piezas · M: plan de contenido","Identidad/plantillas → rosanta-brand-guidelines · Distribución → bot IG",False),
]
rr=4
for rol,rep,hats,out,tasks,cov,pend in canvas:
    for c,v in enumerate([rol,rep,hats,out,tasks,cov],start=1):
        cell=hc.cell(rr,c,v); cell.border=border; cell.alignment=wrap; cell.font=F(9)
        if c==1: cell.font=F(9,True,VERDE)
        if c==1 and pend: cell.fill=fill(AMBAR)
        if c in (3,4,5): cell.fill=fill("FFFFFF")
        if c==6: cell.fill=fill(CREMA); cell.font=F(9,italic=True,color="5B4A38")
    hc.row_dimensions[rr].height=72; rr+=1

# ===== HOJA 4: DIAGNÓSTICO =====
dg=wb.create_sheet("🔎 Diagnóstico"); dg.sheet_view.showGridLines=False
for col,w in [("A",3),("B",32),("C",74)]: dg.column_dimensions[col].width=w
dg.row_dimensions[1].height=26
dg.cell(1,2,"ROSANTA · Qué revela el Canvas").font=F(15,True,VERDE)
findings=[
 ("Dos jefes de área reales (bien)","Chef dirige Cocina y José dirige Sala/Barra con equipo debajo. Ese es el avance del curso: ya no todo cuelga del CEO."),
 ("6 líneas directas al CEO","Chef, José, Mario, Contabilidad, Vanessa y Daniel te reportan directo. Considera un Jefe de Operaciones que agrupe Mantenimiento y Marketing para bajar tus líneas directas (Lección 2.9)."),
 ("Outcomes sin dueño","¿Quién posee 'ocupación entre semana', 'reseñas Google' y 'recuperación de carritos abandonados'? Asígnalos o se van a la deriva."),
 ("Contrato de Yazmin y Mario","Marca su tipo de contrato para tener la foto completa de planilla."),
 ("Lo que absorbieron artefactos/SOPs","Costeo (recetario), finanzas/reporte (maestro), reservas/leads (bot+CRM), reputación (panel-reseñas), cotizaciones (cotizador), pauta (tablero+auditoría). Reinvierte esas horas en construir la capa de jefes."),
]
rr=3
dg.cell(rr,2,"Hallazgo").font=F(9,True,"FFFFFF"); dg.cell(rr,2).fill=fill(TIERRA); dg.cell(rr,2).border=border; dg.cell(rr,2).alignment=wrapc
dg.cell(rr,3,"Qué hacer").font=F(9,True,"FFFFFF"); dg.cell(rr,3).fill=fill(TIERRA); dg.cell(rr,3).border=border; dg.cell(rr,3).alignment=wrapc
dg.row_dimensions[rr].height=22; rr+=1
for h,d in findings:
    a=dg.cell(rr,2,h); a.font=F(9,True,VERDE); a.alignment=wrap; a.border=border; a.fill=fill(CREMA)
    b=dg.cell(rr,3,d); b.font=F(9); b.alignment=wrap; b.border=border
    dg.row_dimensions[rr].height=54; rr+=1

out="/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Organigrama_HOT_Canvas.xlsx"
wb.save(out); print("guardado:",out)
