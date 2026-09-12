# -*- coding: utf-8 -*-
import pandas as pd, unicodedata, openpyxl
from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
SRC='/sessions/clever-hopeful-pascal/mnt/uploads/ReporteVentasProductos_8_11_2026_204344.xlsx'
OUT='/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Comparativo_Menu2027_vs_Ventas.xlsx'
df=pd.read_excel(SRC); df.columns=[c.strip() for c in df.columns]
for c in ['Cantidad','Total','Precio_Venta']: df[c]=pd.to_numeric(df[c],errors='coerce').fillna(0)
df=df[df['Producto'].notna()].copy()
df['Prod']=df['Producto'].astype(str).str.split('|').str[0].str.strip()
df=df[df['Prod'].str.lower()!='nan']
g=df.groupby('Prod').agg(unid=('Cantidad','sum'),ingreso=('Total','sum'),
   cat=('Categoria',lambda s:s.mode().iat[0] if len(s.mode()) else ''),
   precio=('Precio_Venta',lambda s:s[s>0].median() if (s>0).any() else 0)).reset_index()
def norm(s): return ''.join(ch for ch in unicodedata.normalize('NFD',str(s).lower()) if unicodedata.category(ch)!='Mn')
g['n']=g['Prod'].map(norm)

# NUEVO MENÚ 2027: (nombre, precio_nuevo, [substrings alias en ventas])  alias vacío = plato nuevo sin historial
NUEVO=[
 ("Ensalada Rosanta",75,["ensalada rosanta"]),
 ("Ensalada Rosanta c/ Lomito",100,["ensalada con lomito"]),
 ("Ensalada Rosanta c/ Camarones",135,["ensalada con camarones"]),
 ("Queso Horneado",140,["queso horneado"]),
 ("Pulpo a la Parrilla",150,["pulpo a la parrilla"]),
 ("Tabla de Jamones y Quesos",210,["jamones y quesos"]),
 ("Hamburguesa Portobello",105,["hamburgesa portobello","hamburguesa porto"]),
 ("Hamburguesa Lomito en Tiras",130,["hamburguesa de lomito","hamburguesa de lomito"]),
 ("Tartar de Hongos",100,["tartar de hongos"]),
 ("Bol Mediterráneo",105,["bol mediterraneo"]),
 ("Vegetales Fermentados",115,[]),
 ("Bock Choy a la Parrilla",100,[]),
 ("Brócoli con Nduja",115,[]),
 ("Pasta de la Casa",155,["pasta del chef"]),
 ("Pasta de la Casa c/ Lomito",185,["pasta con lomito"]),
 ("Pasta de la Casa c/ Camarones",195,["pasta con camarones"]),
 ("Pollo en Salsa de Tamarindo",165,["pollo en salsa de tamarindo"]),
 ("Costillas de Cerdo",180,["costilla de cerdo"]),
 ("Lomito a la Parrilla",180,["lomito rosanta"]),
 ("Brisket en Salsa Borgolesa",180,["briskeat de res","brisket"]),
 ("Camarones al Horno",190,["camarones al horno"]),
 ("Pescado del Día",185,["pescado del dia"]),
 ("Estofado de Rabo",180,[]),
 ("Mar & Tierra",325,["mar y tierra"]),
 ("Gratín de Papas",35,["gratin de papas"]),
 ("Ejotes ajonjolí y ajo",40,["ejotes al aceite"]),
 ("Mix de Fritas",45,["mix de fritas"]),
 ("Pan de la casa",20,["porcion pan"]),
]
matched=set()
kept=[]; nuevos=[]
for nombre,pnew,aliases in NUEVO:
    rows=g[g['n'].apply(lambda x: any(a in x for a in aliases))] if aliases else g.iloc[0:0]
    if len(rows):
        for p in rows['Prod']: matched.add(p)
        unid=int(rows['unid'].sum()); ing=rows['ingreso'].sum(); pant=rows['precio'].median()
        kept.append([nombre,int(pant) if pant else '',pnew,(pnew-pant) if pant else '',unid,round(ing,0)])
    else:
        nuevos.append([nombre,pnew])

# ELIMINADOS: comida con ventas que NO están en el nuevo menú
foodcats=['Fuerte','Entrante','Guarniciones','Postre','Brunch Dulce']
drop=g[(g['cat'].isin(foodcats))&(~g['Prod'].isin(matched))].sort_values('ingreso',ascending=False)
drop=drop[drop['unid']>=3]

# ---- xlsx ----
VERDE="4A6741";TIERRA="A0785A";COBRE="C9923F";MARRON="3D2B1F"
FV=PatternFill("solid",fgColor=VERDE);FT=PatternFill("solid",fgColor=TIERRA)
FROJO=PatternFill("solid",fgColor="F0D6D3");FVERDES=PatternFill("solid",fgColor="E7F0E1");FAMB=PatternFill("solid",fgColor="F0E7D3")
thin=Side(style="thin",color="D8CDB5");B=Border(left=thin,right=thin,top=thin,bottom=thin)
TITLE=Font(name="Arial",size=15,bold=True,color="FFFFFF");SUB=Font(name="Arial",size=10,italic=True,color="FFFFFF")
HW=Font(name="Arial",size=9,bold=True,color="FFFFFF");SEC=Font(name="Arial",size=10,bold=True,color=VERDE);TXT=Font(name="Arial",size=9,color=MARRON)
ctr=Alignment(horizontal="center",vertical="center")
wb=openpyxl.Workbook()

def sheet(title,sub,span):
    ws=wb.create_sheet(title); ws.sheet_view.showGridLines=False
    ws.merge_cells(f"A1:{span}1");ws["A1"].value=title;ws["A1"].font=TITLE;ws["A1"].fill=FV;ws["A1"].alignment=Alignment(vertical="center",indent=1)
    ws.merge_cells(f"A2:{span}2");ws["A2"].value=sub;ws["A2"].font=SUB;ws["A2"].fill=FV;ws["A2"].alignment=Alignment(vertical="center",indent=1)
    ws.row_dimensions[1].height=22;ws.row_dimensions[2].height=14
    return ws
def hdr(ws,cols,r=4):
    for i,(t,w) in enumerate(cols):
        ws.column_dimensions[chr(65+i)].width=w
        c=ws.cell(row=r,column=i+1,value=t);c.font=HW;c.fill=FT;c.alignment=ctr;c.border=B

# Resumen
ws=wb.active;ws.title="Resumen";ws.sheet_view.showGridLines=False
ws.merge_cells("A1:C1");ws["A1"].value="ROSANTA · Menú 2027 vs. Ventas del año";ws["A1"].font=TITLE;ws["A1"].fill=FV;ws["A1"].alignment=Alignment(vertical="center",indent=1)
ws.merge_cells("A2:C2");ws["A2"].value="Comparativo del nuevo menú diseñado contra las ventas ene–jul 2026 (PosFile)";ws["A2"].font=SUB;ws["A2"].fill=FV
ws.row_dimensions[1].height=22
kept_ing=sum(r[5] for r in kept)
drop_ing=drop['ingreso'].sum()
subas=[r for r in kept if isinstance(r[3],(int,float)) and r[3]>0]
res=[("Platos del nuevo menú con historial de venta",f"{len(kept)}"),
 ("Platos nuevos SIN historial (a validar)",f"{len(nuevos)}"),
 ("Platos con venta que se ELIMINAN del menú",f"{len(drop)}"),
 ("Ingreso anual que aportaban los eliminados","Q {:,.0f}".format(drop_ing)),
 ("Eliminado de mayor venta","Coliflor en Romesco (revísalo)"),
 ("Platos que suben de precio",f"{len(subas)} (casi todos +Q10 a +Q15)"),
]
r=4
for k,v in res:
    ws.cell(row=r,column=1,value=k).font=SEC;ws.cell(row=r,column=1).border=B;ws.column_dimensions['A'].width=44
    ws.merge_cells(start_row=r,start_column=2,end_row=r,end_column=3)
    ws.cell(row=r,column=2,value=v).font=TXT;ws.cell(row=r,column=2).border=B;ws.column_dimensions['B'].width=16;ws.column_dimensions['C'].width=16
    ws.row_dimensions[r].height=20;r+=1

# Se mantienen
ws=sheet("Se mantienen","Platos del nuevo menú que ya se vendían · Δ precio y desempeño","F")
hdr(ws,[("Plato (menú 2027)",34),("Precio ant.",11),("Precio 2027",12),("Δ Q",8),("Unid vendidas",13),("Ingreso Q",12)])
rr=5
for row in sorted(kept,key=lambda x:-(x[5] or 0)):
    for i,val in enumerate(row):
        c=ws.cell(row=rr,column=i+1,value=val);c.border=B;c.font=TXT
        if i>0:c.alignment=ctr
    if isinstance(row[3],(int,float)) and row[3]>0: ws.cell(row=rr,column=4).fill=FVERDES
    rr+=1

# Nuevos
ws=sheet("Nuevos (a validar)","Platos del menú 2027 sin historial de venta: monitorear rotación desde el día 1","B")
hdr(ws,[("Plato nuevo",40),("Precio 2027",12)])
rr=5
for row in nuevos:
    ws.cell(row=rr,column=1,value=row[0]).border=B;ws.cell(row=rr,column=1).font=TXT
    ws.cell(row=rr,column=2,value=row[1]).border=B;ws.cell(row=rr,column=2).font=TXT;ws.cell(row=rr,column=2).alignment=ctr
    for cc in (1,2): ws.cell(row=rr,column=cc).fill=FAMB
    rr+=1

# Se eliminan
ws=sheet("Se eliminan","Platos con venta real que NO están en el menú 2027 (ingreso que se pierde)","D")
hdr(ws,[("Plato (se elimina)",34),("Categoría",16),("Unid",8),("Ingreso Q perdido",16)])
rr=5
for _,x in drop.iterrows():
    vals=[x['Prod'],str(x['cat']),int(x['unid']),round(x['ingreso'],0)]
    for i,val in enumerate(vals):
        c=ws.cell(row=rr,column=i+1,value=val);c.border=B;c.font=TXT
        if i>0:c.alignment=ctr
        c.fill=FROJO
    rr+=1
wb.save(OUT)
print("Guardado:",OUT)
print("Mantienen:",len(kept),"| Nuevos:",len(nuevos),"| Eliminados:",len(drop),"| Ing. perdido Q{:,.0f}".format(drop_ing))
print("\nELIMINADOS top:")
for _,x in drop.head(12).iterrows(): print("  Q{:>8,.0f}  {:>4}u  {}".format(x['ingreso'],int(x['unid']),x['Prod'][:38]))
print("\nNUEVOS sin historial:", [n[0] for n in nuevos])
