# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

VERDE="4A6741"; TIERRA="A0785A"; CREMA="F5EFE0"; COBRE="C9923F"; MARRON="3D2B1F"
FV=PatternFill("solid",fgColor=VERDE); FSUB=PatternFill("solid",fgColor="EDE4D0")
FT=PatternFill("solid",fgColor=TIERRA); FAMBAR=PatternFill("solid",fgColor="FFF2CC")
thin=Side(style="thin",color="D8CDB5"); B=Border(left=thin,right=thin,top=thin,bottom=thin)
TITLE=Font(name="Arial",size=15,bold=True,color="FFFFFF")
SUBT=Font(name="Arial",size=10,italic=True,color="FFFFFF")
HW=Font(name="Arial",size=10,bold=True,color="FFFFFF")
SEC=Font(name="Arial",size=10,bold=True,color=VERDE)
TXT=Font(name="Arial",size=10,color=MARRON)
SM=Font(name="Arial",size=9,color="6B5A45")
wrap=Alignment(wrap_text=True,vertical="top"); ctr=Alignment(horizontal="center",vertical="center",wrap_text=True)
lft=Alignment(horizontal="left",vertical="center",wrap_text=True)
OUT="/sessions/clever-hopeful-pascal/mnt/outputs/"

def header(ws,title,sub,span):
    ws.sheet_view.showGridLines=False
    ws.merge_cells(f"A1:{span}1"); c=ws["A1"]; c.value=title; c.font=TITLE; c.fill=FV; c.alignment=Alignment(vertical="center",indent=1)
    ws.merge_cells(f"A2:{span}2"); c=ws["A2"]; c.value=sub; c.font=SUBT; c.fill=FV; c.alignment=Alignment(vertical="center",indent=1)
    ws.row_dimensions[1].height=24; ws.row_dimensions[2].height=15

def instr(ws, title, sub, lines, span="H"):
    header(ws,title,sub,span)
    r=4
    for kind,text in lines:
        c=ws.cell(row=r,column=1,value=text)
        if kind=="h": c.font=SEC; c.fill=FSUB
        else: c.font=TXT
        ws.merge_cells(start_row=r,start_column=1,end_row=r,end_column=8)
        c.alignment=lft; r+=1
    for col in "ABCDEFGH": ws.column_dimensions[col].width=16
    ws.column_dimensions["A"].width=22

# ================= 1.3 LOGINS Y HERRAMIENTAS =================
wb=openpyxl.Workbook(); ws=wb.active; ws.title="Instrucciones"
instr(ws,"BASE DE LOGINS Y HERRAMIENTAS — Rosanta","Lección 1.3 · Operations Hub · Cocina con Carisma",[
 ("h","Cómo usar esta plantilla"),
 ("p","Lista cada herramienta, plataforma y servicio que usa Rosanta."),
 ("p","1. Ve a la pestaña 'Base de Herramientas'."),
 ("p","2. Registra cada herramienta: POS, reservas, inventario/costeo, contabilidad, marketing, etc."),
 ("p","3. Incluye el correo asociado (NUNCA guardes contraseñas aquí)."),
 ("p","4. Anota quién tiene acceso y el costo mensual."),
 ("p","5. La columna Calidad de Datos (1-5) se llena con la Auditoría de Stack (Lección 1.9)."),
 ("h","Categorías"),
 ("p","POS · Reservas · Inventario/Costeo · Contabilidad · Marketing · Pagos · Otro"),
 ("h","Calidad de datos (1-5)"),
 ("p","1 = sin datos útiles · 2 = datos sucios/manuales · 3 = decente, requiere limpieza · 4 = bueno, exporta limpio · 5 = excelente, integra y en tiempo real"),
])

ws=wb.create_sheet("Base de Herramientas"); header(ws,"Base de Herramientas · Rosanta","Registro vivo de todo el stack",("G"))
cols=[("#",5),("Herramienta",22),("Categoría",16),("Correo asociado",26),("Quién tiene acceso",22),("Costo/mes (Q)",13),("Calidad datos (1-5)",13),("Notas",40)]
r=4
for i,(t,w) in enumerate(cols):
    col=chr(65+i); ws.column_dimensions[col].width=w
    c=ws.cell(row=r,column=i+1,value=t); c.font=HW; c.fill=FT; c.alignment=ctr; c.border=B
tools=[
 ("Posfile","POS","restaurante@rosanta.rest","Juanma, José","","3","Fuente de ventas y comensales. Fechas DD/MM/AAAA. Verificar exportación por ítem/daypart."),
 ("Banco Industrial (POS Neonet)","Pagos","—","Juanma","","3","Tasa 4.37% sobre venta bruta. Cta 6500002057. No usar para gift cards."),
 ("BAC Credomatic (POS)","Pagos","—","Juanma","","3","Tasa 4.574%. Cta 904802543. Usar para gift cards."),
 ("GoHighLevel (GHL)","CRM/Marketing","restaurante@rosanta.rest","Juanma","","4","CRM, email, bot IA, encuesta de satisfacción, QR. Suscripción."),
 ("WIX","Reservas/Dominio","restaurante@rosanta.rest","Juanma","","3","rosanta.rest y reservas. DNS por tercero."),
 ("Meta Ads","Marketing","—","Juanma, Vanessa","","4","Campañas awareness y tráfico. Retargeting de carritos por API."),
 ("Google Ads","Marketing","—","Juanma","","3","Campañas activas."),
 ("Canva","Diseño","restaurante@rosanta.rest","Juanma","","3","Gift cards y assets de marca."),
 ("Google Workspace","Correo/Otro","restaurante@rosanta.rest","Juanma","","3","Infraestructura de correo (con Mailgun vía GHL). Suscripción."),
 ("Recetario (Excel)","Inventario/Costeo","—","Juanma","0","2","Costeo manual de CMV. Sin teórico vs. real ni alertas de par. Bloquea Profit OS."),
 ("Maestro financiero v2 (Excel)","Contabilidad/Datos","—","Juanma","0","3","Validado a abril 2026. Manual; P&L no sale a 10 días del cierre."),
 ("Contador externo","Contabilidad","—","Contador","","3","Declaraciones SAT/IVA. Reportes mensuales en PDF."),
 ("Anthropic / Claude","Otro","restaurante@rosanta.rest","Juanma","","4","Hub operativo, análisis y contenido. Suscripción."),
 ("(Falta) Programación / SPLH","—","—","—","","1","No existe herramienta de horarios con ventas por hora-hombre. Bloquea control de labor."),
]
r=5
for t in tools:
    ws.cell(row=r,column=1,value=r-4).font=Font(name="Arial",size=9,bold=True,color=VERDE); ws.cell(row=r,column=1).alignment=ctr; ws.cell(row=r,column=1).border=B
    for j,val in enumerate(t):
        c=ws.cell(row=r,column=j+2,value=val); c.font=TXT if j!=0 else Font(name="Arial",size=10,bold=True,color=MARRON); c.alignment=wrap; c.border=B
    ws.row_dimensions[r].height=30; r+=1
ws.cell(row=r+1,column=5,value="TOTAL COSTO MENSUAL:").font=SEC
ws.cell(row=r+1,column=6,value=f"=SUM(F5:F{r-1})").font=SEC
wb.save(OUT+"Rosanta_1.3_Logins_y_Herramientas.xlsx"); print("1.3 ok")

# ================= 1.5 AUDITORÍA NIVELES DE GERENCIA =================
wb=openpyxl.Workbook(); ws=wb.active; ws.title="Instrucciones"
instr(ws,"AUDITORÍA DE NIVELES DE GERENCIA — Rosanta","Lección 1.5 · Los 4 niveles de calidad gerencial",[
 ("h","Cómo usar"),
 ("p","1. En 'Auditoría' lista a cada persona con puesto de mando o supervisión."),
 ("p","2. Asigna un nivel (1-4) con la guía de abajo y una frase de evidencia."),
 ("p","3. Define un objetivo de desarrollo: ¿qué lo sube un nivel? y una fecha."),
 ("h","Los 4 niveles"),
 ("p","Nivel 1 · Resultados financieros (Operador) — el más alto. Gestiona por números: labor, food cost, ventas. Sabe su % de labor de la semana pasada."),
 ("p","Nivel 2 · Resultados operativos (Ejecutor). Calidad, tiempos y satisfacción altos; aún no conecta con lo financiero."),
 ("p","Nivel 3 · Cantidad de esfuerzo (Trabajador). Presente y ocupado, pero medido por actividad, no por resultados."),
 ("p","Nivel 4 · Calidad de esfuerzo (El que intenta) — el más bajo. Buena actitud, sin resultado medible. Se retiene por lealtad."),
 ("p","La mayoría opera en Nivel 3 o 4. La meta no es despedir: es ver claro para desarrollar hacia arriba."),
])
ws=wb.create_sheet("Auditoría"); header(ws,"Auditoría de Gerencia · Rosanta","Puntajes propuestos, a validar por Juanma",("E"))
for col,w in zip("ABCDE",[5,22,22,10,55]): ws.column_dimensions[col].width=w
r=4
for i,t in enumerate(["#","Nombre","Puesto","Nivel (1-4)","Evidencia (¿por qué ese nivel?)"]):
    c=ws.cell(row=r,column=i+1,value=t); c.font=HW; c.fill=FT; c.alignment=ctr; c.border=B
mgrs=[
 ("José Mazate","Jefe de Sala / M1 Sala","2","Corre el servicio, maneja quejas (CERA) y cierra turno; aún no gestiona por números (labor/ventas por hora)."),
 ("Jeffry López","Jefe de Cocina / M1 Cocina","2","Mantiene calidad y consistencia; el food cost aún no se gestiona con datos (recetario/CMV/merma)."),
 ("Efraín Taquez","2º de Sala (supervisor apoyo)","3","Presente y trabajador; se mide por actividad, no por resultados del turno."),
 ("Marvin Pamal","Mixólogo / supervisor día bajo","3","En días bajos dirige el turno; sólido en barra, aún midiendo esfuerzo más que resultado. Con potencial."),
]
dvN=DataValidation(type="list",formula1='"1,2,3,4"',allow_blank=True); ws.add_data_validation(dvN)
r=5
for m in mgrs:
    ws.cell(row=r,column=1,value=r-4).font=Font(name="Arial",size=9,bold=True,color=VERDE); ws.cell(row=r,column=1).alignment=ctr; ws.cell(row=r,column=1).border=B
    for j,val in enumerate(m):
        c=ws.cell(row=r,column=j+2,value=val); c.font=TXT if j!=0 else Font(name="Arial",size=10,bold=True,color=MARRON); c.alignment=wrap; c.border=B
    dvN.add(ws.cell(row=r,column=4)); ws.row_dimensions[r].height=42; r+=1
# tabla de desarrollo
r+=1
for i,t in enumerate(["#","Nombre","Objetivo de desarrollo (sube 1 nivel)","Fecha","Notas"]):
    c=ws.cell(row=r,column=i+1,value=t); c.font=HW; c.fill=FT; c.alignment=ctr; c.border=B
dev=[
 ("José Mazate","Cerrar el turno leyendo los números (ventas, comensales, cortesías) y el cierre de caja. De Nivel 2 → 1.","30-60 días","Revisar juntos el reporte de cierre del sistema."),
 ("Jeffry López","Gestionar food cost con el recetario/CMV y un waste log semanal. De Nivel 2 → 1.","60 días","Depende de cerrar el recetario (Profit OS)."),
 ("Efraín Taquez","Dominar el checklist del turno y reportar resultados, no tareas. De Nivel 3 → 2.","45 días","Apoyar a José en piso."),
 ("Marvin Pamal","Correr el Modo Día Bajo completo y el cierre de caja con seguridad. De Nivel 3 → 2.","45 días","Ya lo cubre en días bajos."),
]
r+=1
for d in dev:
    ws.cell(row=r,column=1,value=r-1).font=Font(name="Arial",size=9,bold=True,color=VERDE); ws.cell(row=r,column=1).alignment=ctr; ws.cell(row=r,column=1).border=B
    for j,val in enumerate(d):
        c=ws.cell(row=r,column=j+2,value=val); c.font=TXT if j!=0 else Font(name="Arial",size=10,bold=True,color=MARRON); c.alignment=wrap; c.border=B
    ws.row_dimensions[r].height=42; r+=1
wb.save(OUT+"Rosanta_1.5_Auditoria_Niveles_Gerencia.xlsx"); print("1.5 ok")

# ================= 1.8 EXTRACCIÓN 5 NÚMEROS DEL P&L =================
wb=openpyxl.Workbook(); ws=wb.active; ws.title="Instrucciones"
instr(ws,"EXTRACCIÓN DE LOS 5 NÚMEROS DEL P&L — Rosanta","Lección 1.8 · Cómo leer tu P&L",[
 ("h","Cómo usar"),
 ("p","1. Toma los últimos 3 meses de P&L (fuente: Maestro financiero v2 / contador)."),
 ("p","2. Ingresa Ventas, CMV (COGS), Mano de obra y Utilidad neta por mes (en Q)."),
 ("p","3. Prime Cost (CMV + Mano de obra) y los % se calculan solos."),
 ("p","4. Compara contra los benchmarks y escribe tu diagnóstico de una frase."),
 ("h","Los 5 números"),
 ("p","Ventas · CMV (28-32%) · Mano de obra (25-30%) · Prime Cost = CMV+Labor (<60%) · Utilidad neta (10-15%)."),
 ("p","Prime Cost es EL número. Cada punto arriba de 60% es dinero que desaparece."),
 ("p","Si no tienes P&L limpios, ESE es tu diagnóstico: 'No puedo gestionar lo que no mido'."),
])
ws=wb.create_sheet("Extracción P&L"); header(ws,"Extracción P&L · Rosanta","Llenar con datos del Maestro v2 (últimos 3 meses)",("H"))
for col,w in zip("ABCDEFGH",[18,15,13,15,13,15,13,14]): ws.column_dimensions[col].width=w
hdr=["","Mes 1 (reciente)","% Ventas","Mes 2","% Ventas","Mes 3","% Ventas","Benchmark"]
r=4
for i,t in enumerate(hdr):
    c=ws.cell(row=r,column=i+1,value=t); c.font=HW; c.fill=FT; c.alignment=ctr; c.border=B
rows=[("Ventas",None),("CMV (COGS)","28-32%"),("Mano de obra","25-30%"),("Prime Cost","< 60%"),("Utilidad neta","10-15%")]
base=5
for k,(name,bench) in enumerate(rows):
    rr=base+k
    ws.cell(row=rr,column=1,value=name).font=SEC; ws.cell(row=rr,column=1).border=B; ws.cell(row=rr,column=1).alignment=lft
    for col in [2,4,6]:
        ws.cell(row=rr,column=col).border=B; ws.cell(row=rr,column=col).fill=FAMBAR; ws.cell(row=rr,column=col).alignment=ctr
    for col in [3,5,7]:
        ws.cell(row=rr,column=col).border=B; ws.cell(row=rr,column=col).alignment=ctr
        ws.cell(row=rr,column=col).number_format="0.0%"
    if bench: ws.cell(row=rr,column=8,value=bench).font=SM; ws.cell(row=rr,column=8).alignment=ctr; ws.cell(row=rr,column=8).border=B
# fórmulas
def pct(cell,valcol,rr): ws[cell]=f'=IF({valcol}{rr}="","",{valcol}{rr}/{valcol}5)'
for (vc,pc) in [("B","C"),("D","E"),("F","G")]:
    ws[f"{pc}6"]=f'=IF({vc}6="","",{vc}6/{vc}5)'   # CMV
    ws[f"{pc}7"]=f'=IF({vc}7="","",{vc}7/{vc}5)'   # labor
    ws[f"{vc}8"]=f'=IF({vc}6="","",{vc}6+{vc}7)'   # prime cost value
    ws[f"{pc}8"]=f'=IF({vc}8="","",{vc}8/{vc}5)'   # prime cost %
    ws[f"{pc}9"]=f'=IF({vc}9="","",{vc}9/{vc}5)'   # net
    ws[f"{vc}8"].fill=FAMBAR
# diagnóstico
r=base+6
ws.cell(row=r,column=1,value="DIAGNÓSTICO").font=HW; ws.cell(row=r,column=1).fill=FT
ws.merge_cells(start_row=r,start_column=1,end_row=r,end_column=8)
ws.cell(row=r+1,column=1,value="Mi mayor problema de P&L es:").font=SEC
ws.merge_cells(start_row=r+1,start_column=2,end_row=r+1,end_column=8); ws.cell(row=r+1,column=2).fill=FAMBAR; ws.cell(row=r+1,column=2).border=B
ws.cell(row=r+2,column=1,value="Porque:").font=SEC
ws.merge_cells(start_row=r+2,start_column=2,end_row=r+2,end_column=8); ws.cell(row=r+2,column=2).fill=FAMBAR; ws.cell(row=r+2,column=2).border=B
ws.cell(row=r+4,column=1,value="Nota: hoy Rosanta no lee estos 5 números por semana ni el prime cost en vivo. Extraerlos del Maestro v2 es el primer paso del Finance & Data OS (Curso 3).").font=SM
ws.merge_cells(start_row=r+4,start_column=1,end_row=r+4,end_column=8); ws.cell(row=r+4,column=1).alignment=wrap
wb.save(OUT+"Rosanta_1.8_Extraccion_5_Numeros_PL.xlsx"); print("1.8 ok")
print("TODO OK")
