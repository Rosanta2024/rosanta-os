"""p96 · puente de CMV teorico a real, por mes. Todo sin IVA y sin servicio.

Real   = compra del mes (motor FinanzasDatos sobre el espejo, por area) - variacion de inventario
Teorico= costo de ficha de lo firme + lo ciego al CMV pagado de su area + lo fuera al CMV mezclado
"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
T = {x['mes']: x for x in json.load(open(os.path.join(D, 'teorico_log.json')))}

# Motor (sim_v5/p96.js) sobre el espejo del 15-sep 13:21
COMPRA_C = {1: 41043, 2: 46986, 3: 37526, 4: 34103, 5: 41359, 6: 33553, 7: 36333, 8: 57127}
COMPRA_B = {1: 15534, 2: 15408, 3: 17198, 4: 11598, 5: 12189, 6: 7588, 7: 8990, 8: 11634}
COGS_FIN = {1: 56577, 2: 62393, 3: 54724, 4: 45701, 5: 53548, 6: 41140, 7: 45323, 8: 68761}
VENTA_FIN = {1: 143277, 2: 184852, 3: 162337, 4: 159917, 5: 183896, 6: 129807, 7: 118663, 8: 137739}
# Cierres de inventario (fase 1, cuadrados al centavo)
INV_B = {1: 14600.86, 2: 14605.55, 3: 15043.04, 4: 15360.17, 5: 16175.76, 6: 15210.33, 7: 13724.14, 8: 16076.86}
INV_C = {5: 8536.75, 7: 7684.21}

for m in COMPRA_C:   # control: las dos areas suman el COGS del mes
    assert abs(COMPRA_C[m] + COMPRA_B[m] - COGS_FIN[m]) <= 2, m

def fila(m):
    t = T['2026-%02d' % m]
    V = t['venta_neta']; c, b, fu = t['cocina'], t['barra'], t['fuera']
    dB = INV_B[m] - INV_B[m - 1] if m > 1 else None
    realB = COMPRA_B[m] - (dB or 0)
    realC = COMPRA_C[m]
    costo_f = c['costo_teorico'] + b['costo_teorico']
    ciego = c['venta_ciego'] * c['cmv_pagado'] / 100 + b['venta_ciego'] * b['cmv_pagado'] / 100
    mezcla = costo_f / (c['venta_firme'] + b['venta_firme'])
    fuera = fu['venta'] * mezcla
    teo = costo_f + ciego + fuera
    return dict(m=m, V=V, realC=realC, realB=realB, dB=dB, real=realC + realB, costo_f=costo_f,
                ciego=ciego, fuera=fuera, teo=teo, fin_pct=COGS_FIN[m] / VENTA_FIN[m] * 100,
                cC=c, cB=b, fu=fu)

F = [fila(m) for m in range(1, 9)]
p = lambda a, b: a / b * 100
print('mes | fin% (con servicio) | venta POS | real   real% | teorico  teo% | brecha Q  pts | cocina real%/teo% | barra real%/teo%  (dInv barra)')
for f in F:
    vC = f['cC']['venta_firme'] + f['cC']['venta_ciego']; vB = f['cB']['venta_firme'] + f['cB']['venta_ciego']
    teoC = f['cC']['costo_teorico'] + f['cC']['venta_ciego'] * f['cC']['cmv_pagado'] / 100
    teoB = f['cB']['costo_teorico'] + f['cB']['venta_ciego'] * f['cB']['cmv_pagado'] / 100
    print('%02d  |  %4.1f | %8.0f | %7.0f %5.1f | %7.0f %5.1f | %7.0f %5.1f | %5.1f / %4.1f | %5.1f / %4.1f  (%s)' % (
        f['m'], f['fin_pct'], f['V'], f['real'], p(f['real'], f['V']), f['teo'], p(f['teo'], f['V']),
        f['real'] - f['teo'], p(f['real'] - f['teo'], f['V']), p(f['realC'], vC), p(teoC, vC),
        p(f['realB'], vB), p(teoB, vB), 'sin dic' if f['dB'] is None else '%+.0f' % f['dB']))

def bloque(ms, nombre, invC=0.0):
    S = lambda k: sum(f[k] for f in F if f['m'] in ms)
    V, real, teo = S('V'), S('real') - invC, S('teo')
    cogs = sum(COGS_FIN[m] for m in ms); vfin = sum(VENTA_FIN[m] for m in ms)
    print('\n%s: venta POS Q%.0f · real Q%.0f (%.1f%%) · teorico Q%.0f (%.1f%%) · brecha Q%.0f = %.1f pts · Finanzas hoy %.1f%%' % (
        nombre, V, real, p(real, V), teo, p(teo, V), real - teo, p(real - teo, V), p(cogs, vfin)))
    print('   teorico: firme Q%.0f + ciego Q%.0f + fuera Q%.0f' % (S('costo_f'), S('ciego'), S('fuera')))
    return real - teo, V

bloque(range(1, 9), 'ENE-AGO')
bloque(range(2, 9), 'FEB-AGO (barra con inventario)')
bloque([6, 7], 'JUN-JUL (cocina y barra con inventario)', invC=INV_C[7] - INV_C[5])
