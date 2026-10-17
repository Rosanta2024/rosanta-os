#!/usr/bin/env python3
"""Escaladas, reservas y eventos del bot, de cada 10 chats (16-oct-2026).

Uso:  python3 medir.py <Rosanta_Leads.xlsx> <desde AAAA-MM-DD> <hasta AAAA-MM-DD> [--detalle]
      (hasta es exclusivo). El .xlsx se baja de la hoja "Rosanta Leads"
      (Archivo › Descargar › Microsoft Excel), o con el conector de Drive.

Criterio (el mismo que reprodujo la línea base del cerebro v44: 3.7 ≈ 3.8):
  chat      = un contacto (canal + ID destino, o teléfono) con al menos una fila en Leads
  a persona = alguna fila con ¿Humano? = Sí
  reserva   = alguna fila con resumen "Reserva creada en Wix"
  evento    = alguna fila con tipo = evento
Se excluyen las filas de prueba (mensaje con "PRUEBA") y el canal correo (la linea base es de chats;
--con-correo lo incluye).
--detalle lista los chats que pasaron a persona, para leer el motivo en Conversaciones.
"""
import sys, datetime as dt, collections
import openpyxl

def fecha(x):
    if isinstance(x, dt.datetime): return x
    for f in ('%d/%m/%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S'):
        try: return dt.datetime.strptime(str(x)[:19], f)
        except ValueError: pass
    return None

def ident(v):
    s = str(v or '').strip()
    return s[:-2] if s.endswith('.0') else s

def main():
    if len(sys.argv) < 4: sys.exit(__doc__)
    ruta, desde, hasta = sys.argv[1], dt.datetime.fromisoformat(sys.argv[2]), dt.datetime.fromisoformat(sys.argv[3])
    wb = openpyxl.load_workbook(ruta, read_only=True)
    filas = [tuple(list(r) + [None] * 16)[:16] for r in list(wb['Leads'].iter_rows(values_only=True))[1:]]
    chats = collections.defaultdict(list)
    for r in filas:
        f = fecha(r[0])
        if not f or not (desde <= f < hasta) or 'PRUEBA' in str(r[10] or ''): continue
        if r[1] == 'correo' and '--con-correo' not in sys.argv: continue   # la linea base es de chats (WhatsApp, IG, Messenger)
        chats[(r[1], ident(r[11]) or ident(r[4]) or 'sin-id-' + str(f))].append(r)
    n = len(chats)
    if not n: sys.exit('Sin chats en ese rango.')
    persona = [k for k, v in chats.items() if any(r[9] == 'Sí' for r in v)]
    reservas = sum(1 for v in chats.values() if any('creada en wix' in str(r[7] or '').lower() for r in v))
    eventos = sum(1 for v in chats.values() if any(r[5] == 'evento' for r in v))
    print(f'{desde.date()} → {hasta.date()}: {n} chats')
    print(f'  pasan a persona: {len(persona)}  = {10*len(persona)/n:.1f} de cada 10')
    print(f'  reservas Wix:    {reservas}  = {10*reservas/n:.1f} de cada 10')
    print(f'  piden evento:    {eventos}  = {10*eventos/n:.1f} de cada 10')
    if '--detalle' in sys.argv:
        for k in persona:
            r = next(r for r in chats[k] if r[9] == 'Sí')
            print(f'  · {fecha(r[0]):%m-%d %H:%M} {k[0]} {k[1]} [{r[8]}] {str(r[7] or "")[:90]}')

if __name__ == '__main__':
    main()
