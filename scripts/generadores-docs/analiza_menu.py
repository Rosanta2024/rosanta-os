# -*- coding: utf-8 -*-
import pandas as pd, numpy as np
SRC='/sessions/clever-hopeful-pascal/mnt/uploads/ReporteVentasProductos_8_11_2026_204344.xlsx'
df=pd.read_excel(SRC)
df.columns=[c.strip() for c in df.columns]
df['Prod']=df['Producto'].astype(str).str.split('|').str[0].str.strip()
for col in ['Cantidad','Precio_Venta','Descuento','Precio_Compra','Total']:
    df[col]=pd.to_numeric(df[col],errors='coerce').fillna(0)
df['fecha']=pd.to_datetime(df['fecha_Emision'],dayfirst=True,errors='coerce')
print('Filas:',len(df),'| Rango:',df['fecha'].min().date(),'a',df['fecha'].max().date())
print('Tickets:',df['Doc ID'].nunique(),'| Productos distintos:',df['Prod'].nunique())
print('Ingreso total Q:',round(df['Total'].sum(),2),'| Unidades:',int(df['Cantidad'].sum()))
print('Filas con costo>0:',int((df['Precio_Compra']>0).sum()),'de',len(df))

g=df.groupby('Prod').agg(unid=('Cantidad','sum'),ingreso=('Total','sum'),
    cat=('Categoria',lambda s:s.mode().iat[0] if len(s.mode()) else '')).reset_index()
g=g.sort_values('ingreso',ascending=False)
tot=df['Total'].sum()
print('\n--- TOP 15 por INGRESO ---')
for _,r in g.head(15).iterrows():
    print('%10.0f %5du  %-16s %s'%(r['ingreso'],int(r['unid']),str(r['cat'])[:16],r['Prod'][:34]))
print('\n--- TOP 12 por UNIDADES ---')
for _,r in g.sort_values('unid',ascending=False).head(12).iterrows():
    print('%5du  %9.0f  %s'%(int(r['unid']),r['ingreso'],r['Prod'][:34]))
print('\n--- Ingreso por CATEGORIA (top 14) ---')
c=df.groupby('Categoria').agg(ingreso=('Total','sum'),unid=('Cantidad','sum')).sort_values('ingreso',ascending=False)
for cat,r in c.head(14).iterrows():
    print('%11.0f  %5.1f%%  %6du  %s'%(r['ingreso'],100*r['ingreso']/tot,int(r['unid']),cat))
# concentración
gc=g.sort_values('ingreso',ascending=False).copy(); gc['cum']=gc['ingreso'].cumsum()/tot*100
n10=(gc['cum']<=0).sum()
print('\nTop 10 productos = %.1f%% del ingreso'%(gc.head(10)['ingreso'].sum()/tot*100))
print('Top 20 productos = %.1f%% del ingreso'%(gc.head(20)['ingreso'].sum()/tot*100))
print('Productos que suman 80%% del ingreso:', int((gc['cum']<=80).sum())+1,'de',len(gc))
g.to_pickle('/sessions/clever-hopeful-pascal/mnt/outputs/_menu_g.pkl')
print('\nOK guardado agregado')
PY
