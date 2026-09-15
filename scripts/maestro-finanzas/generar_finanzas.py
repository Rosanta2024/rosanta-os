#!/usr/bin/env python3
"""
Rosanta · Finance & Data OS — generador de datos de los tres artefactos financieros.

Lee el espejo del maestro y produce tres JSON:
  dre5.json    -> rosanta-dre-mensual (bloques de gasto contra referencia del sector)
  cinco.json   -> los 5 numeros del P&L con nomina devengada
  pant.json    -> rosanta-finanzas-semanal (pantalla de la intranet)

REGLAS QUE NO SE PUEDEN CAMBIAR SIN ROMPER LOS NUMEROS
------------------------------------------------------
1. Ventas netas = Subtotal / 1.12. El POS muestra precios con IVA incluido.
2. Se excluye toda fila con EVENTO en Notas o Productos: los eventos privados son
   ingreso adicional, no venta de restaurante.
3. COGS = FEL + tarjeta en las 4 categorias de mercaderia, MAS las categorias
   SIN FACTURA del banco (EFECTIVO_CATS). NO se suma la mercaderia del banco:
   ese es el pago de la misma factura que ya viene por FEL.
   El COGS del FEL va NETO DE IVA: ese IVA es credito recuperable, no costo.
   La compra SIN FACTURA va en bruto, porque ahi el IVA va embebido y no se
   recupera — por eso el mismo plato comprado sin factura cuesta 12% mas.
   Corregido el 4-sep-2026: se contaba todo en bruto e inflaba el food cost del
   año en 2 puntos, de 35.0% a 37.0%.
   "EFECTIVO" no quiere decir "pagado en efectivo": quiere decir SIN FACTURA.
   Por eso si entra al COGS, porque no viene por ningun otro lado. El cruce del
   4-sep-2026 encontro Q32,212 de compra sin factura que se estaba borrando:
   Elite, que no emitio una sola factura en 2026, mas mercado y carniceria.
4. La nomina es DEVENGADA, del Sheet de planilla, no del pago bancario. El banco
   reparte los sueldos de un mes entre dos y eso hace saltar el prime cost de
   40% a 76% sin que la operacion cambie.
5. Las propinas van en su PROPIO bloque, no dentro de Nomina y salarios.
   Siguen dentro del gasto porque el cobro ya esta en la venta: el Subtotal del
   POS incluye el 10% de servicio. Si el cobro entra al ingreso y el pago no
   entra al costo, el P&L infla la utilidad. Lo que se evita es que contaminen
   el bloque de nomina, que es el que se compara contra la banda de 25-30%.
   PENDIENTE de fondo: si ese 10% deberia salir tambien de la venta. Eso baja la
   venta del año de ~1,220,000 a ~1,110,000 y mueve todos los ratios; es
   decision contable, para verla con el contador.
6. Semana = semana ISO.
7. Hay categorias que solo se cuentan por FEL (SOLO_FEL): el movimiento del
   banco es el pago de esa misma factura. Sin la regla habia doble conteo:
   Q12,661 de GAS en FEL contra Q8,456 en Banco Industrial, los dos sumando.
8. Hay proveedores que SIEMPRE facturan por FEL (PAGO_DE_FACTURA): su pago de
   banco o tarjeta es el pago de esa factura y no se suma. El banco no trae NIT,
   asi que el pago se reconoce por su texto. Medido el 14-sep-2026 con
   medir_doble_conteo.py: Q49,629 del año se contaban dos veces. En la intranet
   es la regla 9 (alla el 8 ya estaba tomado).

FUENTES
-------
Maestro (Sheet nativo 1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk), leido por el
espejo Rosanta_Maestro_ESPEJO.xlsx que genera Apps Script cada semana.

Planilla devengada — Sheet nativo:
  https://docs.google.com/spreadsheets/d/1dKTJ0KRKTyLyiQEZ2pCUh3i446Cy0S_yvmqp1ac_H_E
  Una pestana por mes. El numero que se usa es el "Sub total" de la columna
  "Salario base". Los .xlsx sueltos de Planilla_y_Propinas quedaron obsoletos.

Propinas — Sheet nativo:
  https://docs.google.com/spreadsheets/d/12wXn91gPp1vkwOsrLfD38wnifPFSz8lKwk2LvnASEEE
  Se usa solo como referencia; no entra al costo laboral.

Uso:  python3 generar_finanzas.py [ruta_al_espejo] [--datos CARPETA]
"""
import openpyxl, datetime, json, os, sys, re, calendar
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rutas

# El codigo vive en ~/Dev/Rosanta; los datos siguen en Drive. Ver rutas.py.
DATOS = rutas.datos()
ESPEJO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DATOS, "Rosanta_Maestro_ESPEJO.xlsx")
OUT = os.path.join(DATOS, "_datos_finanzas")
os.makedirs(OUT, exist_ok=True)

# ---- planilla devengada por mes (Sub total de Salario base) ----
# Actualizar al cerrar cada mes desde el Sheet nativo de planilla.
PLANILLA = {1: 28850, 2: 28875, 3: 27600, 4: 27100,
            5: 31925, 6: 29900, 7: 29010, 8: 31450}

MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
COGS_CATS = {'ALIMENTOS','BEBIDAS','COCTELERIA','LICORES'}
# Las hojas de banco. La mercaderia pagada desde CUALQUIERA de las dos es el
# pago de una factura que ya vino por FEL, no una compra aparte. Hasta el
# 4-sep-2026 la regla 3 solo miraba Banco Industrial, y al conectar el BAC eso
# dejo un doble conteo: el pago a Tavito de Q223.59 contra sus dos facturas del
# 27/02, que suman exactamente ese monto.
BANCOS = {'03_Banco_Industrial', '04_Banco_BAC'}
# compra SIN FACTURA. Entra al COGS porque no llega por FEL.
EFECTIVO_CATS = {'ALIMENTOS_EFECTIVO', 'BEBIDAS_EFECTIVO', 'COCTELERIA_EFECTIVO'}
# Categorias que SIEMPRE vienen con factura: se cuentan por FEL y el movimiento
# del banco se salta, porque es el pago de esa misma factura.
SOLO_FEL = {'GAS', 'ALQUILER_EQUIPO'}
# Proveedores que SIEMPRE facturan por FEL: su pago desde banco o tarjeta es el
# pago de esa misma factura y se salta (regla 8). El banco no trae NIT, asi que
# el pago se reconoce por el texto del movimiento y, donde el texto no alcanza,
# tambien por la categoria. El NIT es para cotejar contra la factura.
# Quedan fuera a proposito: Tigo, que paga 2.5 veces lo que factura, y los
# comercios de tarjeta (PriceSmart, gasolineras), que no siempre dan FEL.
# Mismo listado en FinanzasDatos.gs (FIN_PAGO_DE_FACTURA).
# (proveedor, NIT, hojas, patron del texto o None, categorias o None)
_BI, _BAC, _TC = '03_Banco_Industrial', '04_Banco_BAC', '05_Tarjeta_Credito_BAC'
PAGO_DE_FACTURA = [
    ('EEGSA', '326445', {_BI, _BAC}, r'EEGSA', None),
    ('Claro', '9929290', {_BI}, r'CLARO', None),
    ('Doorways', '96569239', {_BI}, r'DOORWAY', None),
    ('Doorways', '96569239', {_BAC}, r'TEF A ?: ?902410067', None),
    ('Posfile', '107902699', {_BI, _TC}, r'POSFILE', None),
    ('EX Security', '104313218', {_BI}, None, {'SERVICIO DE MONITOREO Y ALARMA'}),
    ('Edwin Flores', '82651086', {_BI}, r'MARKETING|CONTENIDO', {'SERVICIOS_PROFESIONALES'}),
    ('Aseguradora La Ceiba', '5022193', {_BI}, r'SEGURO', {'SEGUROS_Y_FIANZAS'}),
]
# columna del texto del movimiento en cada hoja de pago
DESC = {_BI: 3, _BAC: 4, _TC: 2}


def pago_de_factura(ws, r, hoja, c):
    # El proveedor si la fila es el pago de una factura FEL; si no, ''.
    if hoja not in DESC:
        return ''
    t = re.sub(r'\s+', ' ', str(ws.cell(r, DESC[hoja]).value or '').upper())
    for prov, _nit, hojas, patron, cats in PAGO_DE_FACTURA:
        if hoja in hojas and (patron is None or re.search(patron, t)) \
                and (cats is None or c in cats):
            return prov
    return ''

# categoria -> (bloque del DRE, tipo F=fijo S=semivariable V=variable)
MAP = {
 'ALQUILERES':('Inmueble y ocupacion','F'), 'ALQUILER':('Inmueble y ocupacion','F'),
 'SERVICIOS_PUBLICOS':('Tarifas y servicios','V'), 'SERVICIOS PUBLICOS':('Tarifas y servicios','V'),
 'GAS':('Tarifas y servicios','V'), 'TELEFONOS_Y_CELULARES':('Tarifas y servicios','F'),
 # el alquiler de la maquina de agua: contrato mensual fijo, no mercaderia.
 # Estaba como BEBIDAS e inflaba el food cost casi un punto.
 'ALQUILER_EQUIPO':('Tarifas y servicios','F'),
 'TELEFONOS Y CELULARES':('Tarifas y servicios','F'), 'SERVICIO DE INTERNET':('Tarifas y servicios','F'),
 'SERVICIOS_PROFESIONALES':('Prestadores y honorarios','F'), 'SERVICIOS PROFESIONALES':('Prestadores y honorarios','F'),
 'HONORARIOS CONTABLES':('Prestadores y honorarios','F'), 'SERVICIO DE MONITOREO Y ALARMA':('Prestadores y honorarios','F'),
 'SUMINISTRO DE LIMPIEZA':('Prestadores y honorarios','S'),
 'NOMINA':('Nomina y salarios','S'), 'IGSS':('Nomina y salarios','S'),
 'PROPINAS_AL_EQUIPO':('Propinas al equipo','V'), 'PROPINAS_PASSTHROUGH':('Propinas al equipo','V'),
 # UNIFORMES en bloque propio (Juanma, 15-sep-2026). Dentro de Nomina y salarios
 # se perdia: la nomina del DRE se reemplaza por la planilla devengada.
 'UNIFORMES':('Uniformes','V'),
 'IMPUESTOS':('Impuestos','V'), 'TRIBUTO':('Impuestos','V'),
 'COMISIONES_BANCARIAS':('Comisiones y cargos','V'), 'COMISION TARJETA DE CREDITO':('Comisiones y cargos','V'),
 'MARKETING_DIGITAL':('Marketing','S'), 'CUOTAS_Y_SUSCRIPCIONES':('Marketing','F'),
 'CUOTAS Y SUSCRIPCIONES':('Marketing','F'),
 'MANTENIMIENTO':('Mantencion','V'), 'MANTENIMIENTO Y ACCESORIOS EQUIPO':('Mantencion','V'),
 'MATERIALES':('Mantencion','V'),
 'PAPELERIA_Y_UTILES':('Bienes de uso','V'), 'PAPELERIA Y UTILES':('Bienes de uso','V'),
 'ATENCION A CLIENTES':('Bienes de uso','V'), 'GASTOS_ADMINISTRATIVOS':('Bienes de uso','V'),
 'GASTOS_VARIOS':('Bienes de uso','V'), 'VIATICOS':('Bienes de uso','V'),
 'PARQUEOS':('Bienes de uso','V'), 'SEGUROS_Y_FIANZAS':('Bienes de uso','F'),
 'SEGUROS Y FIANZAS':('Bienes de uso','F'), 'EVENTOS':('Bienes de uso','V')}

REF = {'Inmueble y ocupacion':(6,10), 'Tarifas y servicios':(4,6),
       'Prestadores y honorarios':(1,3), 'Nomina y salarios':(25,30),
       'Impuestos':(0,0), 'Comisiones y cargos':(3,5), 'Marketing':(4,8),
       'Mantencion':(2,4), 'Bienes de uso':(3,5),
       'Propinas al equipo':(0, 0),   # no tiene banda: es pass-through del cliente
       'Uniformes':(0, 0)}            # sin banda del sector

FUERA = {'DEVOLUCION_INVERSION','CARGO_FRAUDULENTO','PAGO_TARJETA_CREDITO','PAGO_TARJETA',
         'TRANSFERENCIA','TRANSFERENCIA_SALIENTE','PERSONAL','SALDO','POR_CLASIFICAR',
         'ANULADA'}   # regla 13

# hoja -> (col monto, col categoria, col es_personal)
# 04_Banco_BAC entro al calculo el 4-sep-2026. Antes solo se usaba para el saldo
# bancario, y eso dejaba Q279,521 del año fuera del DRE. De esos, Q59,496 son
# gasto real; el resto es pago de tarjeta, retiros del socio y gasto personal,
# que siguen fuera por FUERA / Es_Personal.
LIBROS = [('01_FEL_Maestro', 10, 14, 15),
          ('03_Banco_Industrial', 4, 7, 8),
          ('04_Banco_BAC', 5, 8, 9),
          ('05_Tarjeta_Credito_BAC', 3, 5, 6)]

wb = openpyxl.load_workbook(ESPEJO, data_only=True)
V = wb['02_Ventas_Maestro']
ANIO = 2026


def dia(d):
    """El DIA de una fecha del maestro, a medianoche (p120 / A15, 15-sep-2026).

    157 filas se guardaron con 22:00 o 23:00 porque Apps Script escribio la
    medianoche de Guatemala en un Sheet que estaba en otra zona horaria. Se
    verifico contra las fuentes (reporte del POS de S37 y de julio, FEL de S37):
    en TODAS la fecha verdadera es el DIA SIGUIENTE. Una hora de 12:00 o mas se
    lleva al dia siguiente; una menor, al mismo dia. Mismo criterio que
    _finDia_ en FinanzasDatos.gs.
    """
    if not isinstance(d, datetime.datetime) or not (d.hour or d.minute):
        return d
    base = datetime.datetime(d.year, d.month, d.day)
    return base + datetime.timedelta(days=1) if d.hour >= 12 else base


for _h, _c in [('01_FEL_Maestro', 1), ('02_Ventas_Maestro', 2), ('03_Banco_Industrial', 1),
               ('04_Banco_BAC', 1), ('05_Tarjeta_Credito_BAC', 1)]:
    _ws = wb[_h]
    for _r in range(5, _ws.max_row + 1):
        _v = _ws.cell(_r, _c).value
        if isinstance(_v, datetime.datetime) and (_v.hour or _v.minute):
            _ws.cell(_r, _c).value = dia(_v)

# regla 13 (15-sep-2026): una factura ANULADA en SAT no es gasto. Se le pone la
# categoria ANULADA en memoria (no en el archivo) y ANULADA esta en FUERA. Mismo
# criterio que FinanzasDatos.gs. Antes se sumaban 15 anuladas, Q7,535 en 2026.
_fel_an = wb['01_FEL_Maestro']
for _r in range(5, _fel_an.max_row + 1):
    if str(_fel_an.cell(_r, 8).value or '').strip() == 'Anulado':
        _fel_an.cell(_r, 14).value = 'ANULADA'


def ultimo_devengado(m):
    """(monto, origen) de la mano de obra del mes (A14, decision de Juanma 15-sep-2026).

    La planilla del mes si existe; si no, la del ultimo mes anterior que la tenga
    ('estimada'); si no hay anterior, la siguiente. Mismo criterio que
    _finUltimoDevengado_ en FinanzasDatos.gs. Reemplaza al 29000 fijo de la semana.
    """
    if PLANILLA.get(m):
        return PLANILLA[m], 'planilla'
    for k in list(range(m - 1, 0, -1)) + list(range(m + 1, 13)):
        if PLANILLA.get(k):
            return PLANILLA[k], 'estimada'
    return 0, 'sin dato'


def numero(v):
    """Un numero de celda, aunque venga como texto '1,234.50' (M17). None si no es numero."""
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        t = re.sub(r'[Q\s,]', '', v)
        try:
            return float(t) if t else None
        except ValueError:
            return None
    return None


def es_evento(r):
    t = (str(V.cell(r, 8).value or '') + str(V.cell(r, 12).value or '')).upper()
    return 'EVENTO' in t


def filas_venta():
    for r in range(5, V.max_row + 1):
        f = V.cell(r, 2).value
        if isinstance(f, datetime.datetime) and f.year == ANIO:
            yield r, f


def monto(ws, r, col, hoja):
    q = ws.cell(r, col).value or 0
    if hoja.startswith('05'):           # tarjeta: hay columna en dolares
        q += (ws.cell(r, 4).value or 0) * 7.7
    return q


def costo(ws, r, col, hoja):
    """Lo que de verdad cuesta la mercaderia: el FEL, neto de su IVA.

    El IVA de una compra con factura se recupera como credito, asi que no es
    costo. La columna 11 del FEL trae el monto exacto y vale 0 en las facturas
    de pequeño contribuyente, que no lo llevan: netear por esa columna maneja
    los dos casos sin suponer una tasa.

    La tarjeta (05_) no tiene columna de IVA, asi que ahi se queda en bruto.
    Son unos Q5,000 de mercaderia al año; si algun dia importa, hay que traer
    el IVA de esas compras.
    """
    q = monto(ws, r, col, hoja)
    if hoja.startswith('01'):
        q -= (ws.cell(r, 11).value or 0)
    return q


# ==================== 1. DRE mensual ====================
serie = []
sin_venta = []   # meses con gasto y sin venta (M20)
for m in range(1, 13):
    ven = ev = 0.0
    com = 0
    for r, f in filas_venta():
        if f.month != m:
            continue
        n = (V.cell(r, 4).value or 0) / 1.12
        if es_evento(r):
            ev += n
            continue
        ven += n
        try:
            com += int(float(V.cell(r, 9).value or 0))   # Sheets exporta enteros como float
        except (TypeError, ValueError):
            pass
    cog = dev = pers = 0.0
    bl, tip = defaultdict(float), defaultdict(float)
    for hoja, mc, cc, pc in LIBROS:
        ws = wb[hoja]
        for r in range(5, ws.max_row + 1):
            d = ws.cell(r, 1).value
            if not (isinstance(d, datetime.datetime) and d.year == ANIO and d.month == m):
                continue
            q = monto(ws, r, mc, hoja)
            c = ws.cell(r, cc).value
            if c == 'ANULADA':                      # regla 13
                continue
            if ws.cell(r, pc).value == 'Sí' or c == 'PERSONAL':
                pers += q; continue
            if c == 'DEVOLUCION_INVERSION':
                dev += q; continue
            if c in FUERA or not c or str(c).startswith('INGRESO'):
                continue
            if c in COGS_CATS:
                if hoja not in BANCOS:              # regla 3
                    cog += costo(ws, r, mc, hoja)   # neto de IVA
                continue
            if c in EFECTIVO_CATS:
                cog += q; continue
            if c in ('ALQUILERES', 'ALQUILER') and hoja == '01_FEL_Maestro':
                continue                             # el alquiler se cuenta por banco
            if c in SOLO_FEL and hoja != '01_FEL_Maestro':
                continue                             # regla 7: se cuentan por FEL
            if pago_de_factura(ws, r, hoja, c):
                continue                             # regla 8: pago de una factura FEL
            if c in MAP:
                bl[MAP[c][0]] += q
                tip[MAP[c][1]] += q

    gop = sum(x for k, x in bl.items() if k != 'Impuestos')
    if not ven:
        # M20 (15-sep-2026): un mes con gasto y sin venta (los primeros dias del
        # mes, antes de cargar el POS) no se pinta, pero su dinero SI va al año.
        if cog or gop:
            sin_venta.append({'m': m, 'mes': MESES[m-1], 'cogs': round(cog, 2),
                              'gop': round(gop, 2),
                              'nomina_banco': round(bl.get('Nomina y salarios', 0), 2)})
        continue
    serie.append({'mes': MESES[m-1], 'm': m, 'ventas': round(ven, 2),
                  'eventos': round(ev, 2), 'comensales': com,
                  'cogs': round(cog, 2), 'gop': round(gop, 2),
                  'imp': round(bl.get('Impuestos', 0), 2),
                  'dev': round(dev, 2), 'pers': round(pers, 2),
                  'bloques': {k: round(x, 2) for k, x in bl.items()},
                  'tipo': {t: round(tip.get(t, 0), 2) for t in 'FSV'}})

BLOQUES = [b for b in REF if any(s['bloques'].get(b) for s in serie)]
tot = {k: round(sum(s[k] for s in serie), 2)
       for k in ['ventas', 'cogs', 'gop', 'imp', 'dev', 'eventos', 'comensales', 'pers']}
for x in sin_venta:
    tot['cogs'] = round(tot['cogs'] + x['cogs'], 2)
    tot['gop'] = round(tot['gop'] + x['gop'], 2)
tot['bloques'] = {b: round(sum(s['bloques'].get(b, 0) for s in serie), 2) for b in BLOQUES}
tot['tipo'] = {t: round(sum(s['tipo'][t] for s in serie), 2) for t in 'FSV'}
tot['res'] = round(tot['ventas'] - tot['cogs'] - tot['gop'], 2)
DRE = {'serie': serie, 'tot': tot, 'ref': REF, 'bloques': BLOQUES}
json.dump(DRE, open(os.path.join(OUT, 'dre5.json'), 'w'))


# ==================== 2. Los 5 numeros ====================
# ultima venta cargada del año (con eventos, como ultVenta en FinanzasDatos.gs)
ULT_VENTA = max((f for _r, f in filas_venta()), default=None)

cinco = []
for s in serie:
    m = s['m']
    cog = igss = 0.0
    for hoja, mc, cc, pc in LIBROS:
        ws = wb[hoja]
        for r in range(5, ws.max_row + 1):
            d = ws.cell(r, 1).value
            if not (isinstance(d, datetime.datetime) and d.year == ANIO and d.month == m):
                continue
            if ws.cell(r, pc).value == 'Sí':
                continue
            c = ws.cell(r, cc).value
            q = monto(ws, r, mc, hoja)
            if c in COGS_CATS and hoja not in BANCOS:
                cog += costo(ws, r, mc, hoja)
            elif c in EFECTIVO_CATS:
                cog += q
            elif c == 'IGSS':
                igss += q
    lab_mes, origen = ultimo_devengado(m)
    dev = lab_mes if origen == 'planilla' else None
    # el mes EN CURSO con planilla estimada: solo la parte de los dias con venta
    # cargada (Juanma, 15-sep-2026). Mismo criterio que FinanzasDatos.gs.
    if origen == 'estimada' and ULT_VENTA and ULT_VENTA.month == m:
        lab_mes = lab_mes * ULT_VENTA.day / calendar.monthrange(ANIO, m)[1]
    lab = lab_mes + igss
    gop = s['gop'] - s['bloques'].get('Nomina y salarios', 0) + lab
    cinco.append({'mes': s['mes'], 'ventas': s['ventas'], 'cogs': round(cog, 2),
                  'labor': round(lab, 2), 'igss': round(igss, 2),
                  'devengado': dev is not None, 'labor_origen': origen, 'gop': round(gop, 2),
                  'neto': round(s['ventas'] - cog - gop, 2)})
T5 = {k: round(sum(c[k] for c in cinco), 2) for k in ['ventas', 'cogs', 'labor', 'gop', 'neto']}
for x in sin_venta:   # M20: el dinero de un mes sin venta va al año, sin su nomina de banco
    _g = x['gop'] - x['nomina_banco']
    T5['cogs'] = round(T5['cogs'] + x['cogs'], 2)
    T5['gop'] = round(T5['gop'] + _g, 2)
    T5['neto'] = round(T5['neto'] - x['cogs'] - _g, 2)
json.dump({'meses': cinco, 'tot': T5}, open(os.path.join(OUT, 'cinco.json'), 'w'), ensure_ascii=False)


# ==================== 3. Pantalla semanal ====================
sem = defaultdict(lambda: {'v': 0.0, 'c': 0, 't': 0, 'cogs': 0.0, 'ini': None, 'fin': None})
for r, f in filas_venta():
    if es_evento(r):
        continue
    d = sem[tuple(f.isocalendar()[:2])]     # (año ISO, semana), como la clave AAAAWW
    d['v'] += (V.cell(r, 4).value or 0) / 1.12
    d['t'] += 1
    try:
        d['c'] += int(float(V.cell(r, 9).value or 0))
    except (TypeError, ValueError):
        pass
    d['ini'] = min(d['ini'] or f, f)
    d['fin'] = max(d['fin'] or f, f)

for hoja, mc, cc, pc in LIBROS:
    ws = wb[hoja]
    for r in range(5, ws.max_row + 1):
        d0 = ws.cell(r, 1).value
        if not (isinstance(d0, datetime.datetime) and d0.year == ANIO):
            continue
        if ws.cell(r, pc).value == 'Sí':
            continue
        c = ws.cell(r, cc).value
        w = tuple(d0.isocalendar()[:2])
        # A13: la compra de una semana sin venta tambien cuenta (antes se saltaba)
        if (c in COGS_CATS and hoja not in BANCOS) or c in EFECTIVO_CATS:
            sem[w]['cogs'] += costo(ws, r, mc, hoja)

# saldo bancario: el ultimo de cada banco en cada semana; se arrastra al armar S
saldo_ult = {}
for hoja, sc, key in [('03_Banco_Industrial', 6, 'bi'), ('04_Banco_BAC', 7, 'bac')]:
    ws = wb[hoja]; last = {}
    for r in range(5, ws.max_row + 1):
        d = ws.cell(r, 1).value
        if isinstance(d, datetime.datetime) and d.year == ANIO:
            s = numero(ws.cell(r, sc).value)
            if s is not None:
                last[tuple(d.isocalendar()[:2])] = s
    saldo_ult[key] = last

# A13 (decision de Juanma, 15-sep-2026): semanas CONSECUTIVAS de la primera a la
# ultima con venta. Una semana corta o sin venta queda y entra a la movil de 4.
S = []
con_venta = sorted(k for k, x in sem.items() if x['v'] > 0)
if con_venta:
    prev = {'bi': 0, 'bac': 0}
    orden = {k: sorted(v) for k, v in saldo_ult.items()}
    pos = {'bi': 0, 'bac': 0}
    lunes = datetime.date.fromisocalendar(con_venta[0][0], con_venta[0][1], 1)
    while tuple(lunes.isocalendar()[:2]) <= con_venta[-1]:
        k = tuple(lunes.isocalendar()[:2])
        d = sem.get(k) or {'v': 0.0, 'c': 0, 't': 0, 'cogs': 0.0, 'ini': None, 'fin': None}
        ini = d['ini'] or datetime.datetime(lunes.year, lunes.month, lunes.day)
        fin = d['fin'] or ini + datetime.timedelta(days=6)
        for b in ('bi', 'bac'):
            while pos[b] < len(orden[b]) and orden[b][pos[b]] <= k:
                prev[b] = saldo_ult[b][orden[b][pos[b]]]
                pos[b] += 1
        lab = ultimo_devengado(ini.month)[0] / 4.345    # regla 11 (antes: 29000 fijo)
        v = d['v']
        S.append({'w': k[1], 'ini': ini.strftime('%d/%m'), 'fin': fin.strftime('%d/%m'),
                  'ventas': round(v, 2), 'com': d['c'], 'tickets': d['t'],
                  'tp': round(v / d['c'], 2) if d['c'] else 0,
                  'cogs': round(d['cogs'], 2),
                  'cogsp': round(d['cogs'] / v * 100, 1) if v else None,
                  'labor': round(lab, 2), 'laborp': round(lab / v * 100, 1) if v else None,
                  'prime': round((d['cogs'] + lab) / v * 100, 1) if v else None,
                  'caja': round(prev['bi'] + prev['bac'], 2), 'corta': v < 1000})
        lunes += datetime.timedelta(days=7)

# media movil de 4: cociente de las sumas, NO promedio de porcentajes
for i, s in enumerate(S):
    if i < 3:
        continue
    w4 = S[i-3:i+1]
    vv = sum(x['ventas'] for x in w4)
    cc = sum(x['cogs'] for x in w4)
    ll = sum(x['labor'] for x in w4)
    s['cogs_m4'] = round(cc / vv * 100, 1) if vv else None
    s['prime_m4'] = round((cc + ll) / vv * 100, 1) if vv else None

for i, s in enumerate(S):
    if i == 0:
        continue
    p = S[i-1]
    s['dv'] = round((s['ventas'] - p['ventas']) / p['ventas'] * 100, 1) if p['ventas'] else 0
    s['dc'] = s['com'] - p['com']
    s['dtp'] = round(s['tp'] - p['tp'], 2)

# mix cocina/barra desde la columna Productos, para la meta ponderada de food cost
BARRA_W = set("""tinto blanco rosado cava espumante vino copa cerveza gallo cabro moza corona
heineken michelada chelada agua limonada naranjada soda coca cola ginger beer kombucha te cafe
capuchino latte espresso americano infusion jugo mezcal tequila ron whisky vodka gin ginebra
zacapa macallan negroni fashion margarita mojito daiquiri martini spritz coctel flight flaght
shot digestivo amaretto limoncello baileys licor aperol campari syrah malbec cabernet chardonnay
sauvignon prosecco sangria pinot callia bohigas pulenta""".split())
BARRA_F = ['mezcal a la pina','fufuruto','red pepper','sin novia','beetrot','el colonial','cousino',
 'cusino','chiatenango','chaitenango','la chef','la feria','el canche','la loteria','los penitentes',
 'el mero','muy noble','la linda','mariluna','la val','maracuya']
COCINA_F = ['costilla','camaron','camarones','pasta','lomito','pescado','pulpo','brisket','briskeat',
 'pollo','queso','coliflor','hamburgues','hamburgesa','quinoa','tartar','ensalada','jamones','bol ',
 'tofu','mix de fritas','porcion','pan','gratin','papa','peras','charlotta','panacotta','chilaquiles',
 'mar y tierra','mousse','postre','sopa','ceviche','arroz','vegetales','brocoli','bok choy','estofado',
 'fetuccini','nduja','romesco','platano','camote','chips','leche']
OTRO_F = ['evento','anticipo','paquete','brunch','platillos','propina','servicio','admin','gift',
 'descuento','cortesia','deposito']

def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9 ]', ' ', s)

def _area(nombre):
    s = _norm(nombre)
    if any(k in s for k in OTRO_F):   return 'OTRO'
    if any(k in s for k in COCINA_F): return 'COCINA'
    if any(k in s for k in BARRA_F):  return 'BARRA'
    if set(s.split()) & BARRA_W:      return 'BARRA'
    return 'COCINA'

# precio de referencia: los productos eliminados del POS salen con precio 0.00
ref_precio = defaultdict(lambda: defaultdict(int))
crudo = []
for r, f in filas_venta():
    s = str(V.cell(r, 12).value or '')
    if not s or s == 'None':
        continue
    crudo.append(s)
    for mm in re.finditer(r'(\d+)-(.*?)╣([\d.]+)╣', s):
        p = float(mm.group(3))
        if p > 0:
            ref_precio[mm.group(2).strip()][p] += int(mm.group(1))
REF_P = {k: max(d.items(), key=lambda t: t[1])[0] for k, d in ref_precio.items()}

area = defaultdict(float)
for s in crudo:
    for it in s.split('|'):
        mm = re.match(r'^\s*(\d+)-(.*?)╣([\d.]+)╣', it)
        if mm:
            qy, nom, p = int(mm.group(1)), mm.group(2).strip(), float(mm.group(3))
            if p == 0:
                p = REF_P.get(nom, 0)
            area[_area(nom)] += qy * p
            continue
        m2 = re.match(r'^\s*(\d+)-(.*?)-\(!producto-eliminado!\)', it)
        if m2:
            nom = m2.group(2).strip()
            p = REF_P.get(nom)
            if p:
                area[_area(nom)] += int(m2.group(1)) * p

rest = area['COCINA'] + area['BARRA']
mix_c = round(area['COCINA'] / rest * 100, 1)
mix_b = round(100 - mix_c, 1)

# META DE FOOD COST: 28% FIJO. Decision de Juanma, 10-sep-2026 (30) y 14-sep-2026 (28).
#
# Hasta hoy esto era  mix_c/100*30 + mix_b/100*20,  o sea la meta ponderada por
# la mezcla de venta cocina/barra, que con el mix real daba 27.8%. Se descarto a
# proposito: una meta que se mueve sola cada semana no sirve para dirigir, porque
# el equipo nunca sabe contra que numero esta jugando y una mejora del mix se lee
# como un empeoramiento del food cost. La meta es una decision de negocio, no un
# resultado del calculo.
#
# El mix se sigue calculando y se sigue publicando en PANT['mix']: es informacion
# util para leer el food cost, solo que ya no define la meta.
#
# Los otros dos lugares donde vive este numero, y que tienen que decir lo mismo:
#   · Rosanta_Intranet_Config > PARAMETROS > food_cost_objetivo_pct  (= 28)
#   · la intranet la lee de ahi para todo (metasFoodCost_ en ConfigCosteo.js)
meta_cogs = 28.0

# integridad del dato
POR = 0; ult = {}
for hoja, cc in [('01_FEL_Maestro', 14), ('03_Banco_Industrial', 7), ('04_Banco_BAC', 8),
                 ('05_Tarjeta_Credito_BAC', 5), ('02_Ventas_Maestro', None)]:
    ws = wb[hoja]; mx = None
    colf = 2 if hoja.startswith('02') else 1
    for r in range(5, ws.max_row + 1):
        d = ws.cell(r, colf).value
        if isinstance(d, datetime.datetime):
            mx = max(mx or d, d)
        if cc and ws.cell(r, cc).value == 'POR_CLASIFICAR':
            POR += 1
    ult[hoja] = mx.strftime('%d/%m/%Y') if mx else '—'

fel_c = sum(wb['01_FEL_Maestro'].cell(r, 10).value or 0
            for r in range(5, wb['01_FEL_Maestro'].max_row + 1)
            if isinstance(wb['01_FEL_Maestro'].cell(r, 1).value, datetime.datetime)
            and wb['01_FEL_Maestro'].cell(r, 1).value.year == ANIO
            and wb['01_FEL_Maestro'].cell(r, 14).value in COGS_CATS)
efe_c = sum(wb['03_Banco_Industrial'].cell(r, 4).value or 0
            for r in range(5, wb['03_Banco_Industrial'].max_row + 1)
            if isinstance(wb['03_Banco_Industrial'].cell(r, 1).value, datetime.datetime)
            and wb['03_Banco_Industrial'].cell(r, 1).value.year == ANIO
            and wb['03_Banco_Industrial'].cell(r, 7).value in EFECTIVO_CATS)

gasto_mes = round((T5['cogs'] + T5['gop']) / len(cinco), 2)
PANT = {'semanas': S, 'meta_cogs': meta_cogs, 'meta_prime': 60.0,
        'mix': {'cocina': mix_c, 'barra': mix_b},
        'caja': S[-1]['caja'], 'gasto_dia': round(gasto_mes / 30, 2),
        'dias_caja': round(S[-1]['caja'] / (gasto_mes / 30), 1),
        'integridad': {'meses_bi': 8, 'meses_bac': 8, 'por_clasificar': POR, 'ult': ult,
                       'factura_pct': round(fel_c / (fel_c + efe_c) * 100, 1),
                       'fel': round(fel_c, 2), 'efectivo': round(efe_c, 2)},
        'gen': datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}
json.dump(PANT, open(os.path.join(OUT, 'pant.json'), 'w'), ensure_ascii=False)


# ==================== resumen en consola ====================
print(f"Espejo: {ESPEJO}")
print(f"Salida: {OUT}\n")
print("LOS 5 NUMEROS (nomina devengada)")
print("  mes | ventas  | COGS%  | labor% | prime% |  neto%")
for c in cinco:
    v = c['ventas']
    print("  %s | %7.0f | %5.1f%% | %5.1f%% | %5.1f%% | %6.1f%%" % (
        c['mes'], v, c['cogs']/v*100, c['labor']/v*100,
        (c['cogs']+c['labor'])/v*100, c['neto']/v*100))
print("  AÑO | %7.0f | %5.1f%% | %5.1f%% | %5.1f%% | %6.1f%%" % (
    T5['ventas'], T5['cogs']/T5['ventas']*100, T5['labor']/T5['ventas']*100,
    (T5['cogs']+T5['labor'])/T5['ventas']*100, T5['neto']/T5['ventas']*100))
print(f"\nMIX  cocina {mix_c}% / barra {mix_b}%  ->  meta de food cost {meta_cogs}%")
u = S[-1]
print(f"SEMANA S{u['w']} ({u['ini']}-{u['fin']}): ventas Q{u['ventas']:,.0f} · "
      f"food cost movil4 {u.get('cogs_m4')}% · prime movil4 {u.get('prime_m4')}% · "
      f"caja Q{u['caja']:,.0f} ({PANT['dias_caja']} dias)")
print(f"INTEGRIDAD  compra con factura {PANT['integridad']['factura_pct']}% · "
      f"{POR} en POR_CLASIFICAR")


# ==================== 4. Cobertura: que dinero NO llega al DRE ====================
# Control agregado el 3-sep-2026. Existe porque una reclasificacion se escribio
# contra la hoja sin mirar esta capa: 04_Banco_BAC no esta en LIBROS, asi que
# nada de lo que se clasifique ahi mueve el DRE. Este bloque no cambia ningun
# numero; solo reporta. Si una categoria no esta en MAP ni en FUERA, el dinero
# se cae en silencio, y eso es exactamente lo que aqui se hace visible.

TODOS_LOS_LIBROS = [('01_FEL_Maestro', 10, 14, 15),
                    ('03_Banco_Industrial', 4, 7, 8),
                    ('04_Banco_BAC', 5, 8, 9),
                    ('05_Tarjeta_Credito_BAC', 3, 5, 6)]

HOJAS_LEIDAS = {h for h, _, _, _ in LIBROS}


def _destino(c, hoja, prov=''):
    """Donde termina una fila con esta categoria. Espeja la logica del bloque 1."""
    if c == 'PERSONAL':                              return 'personal'
    if c == 'DEVOLUCION_INVERSION':                  return 'devolucion'
    if not c:                                        return 'SIN CATEGORIA'
    if str(c).startswith('INGRESO'):                 return 'ingreso'
    if c == 'POR_CLASIFICAR':                        return 'POR CLASIFICAR'
    if c in FUERA:                                   return 'fuera (a proposito)'
    if c in COGS_CATS:
        return 'COGS' if hoja not in BANCOS else 'REGLA 3: no suma'
    if c in EFECTIVO_CATS:                           return 'COGS'
    if c in ('ALQUILERES', 'ALQUILER') and hoja == '01_FEL_Maestro':
        return 'alquiler por banco: no suma'
    if c in SOLO_FEL and hoja != '01_FEL_Maestro':
        return 'REGLA 7: ya vino por FEL'
    if prov:                                         return 'REGLA 8: pago de factura FEL'
    if c in MAP:                                     return 'DRE · ' + MAP[c][0]
    return 'CATEGORIA DESCONOCIDA'


cob = {}
desconocidas = defaultdict(float)
saltado = defaultdict(float)     # regla 8: pago saltado por proveedor
for hoja, mc, cc, pc in TODOS_LOS_LIBROS:
    ws = wb[hoja]
    d = defaultdict(float)
    for r in range(5, ws.max_row + 1):
        f = ws.cell(r, 1).value
        if not (isinstance(f, datetime.datetime) and f.year == ANIO):
            continue
        c = ws.cell(r, cc).value
        q = monto(ws, r, mc, hoja)
        prov = pago_de_factura(ws, r, hoja, c)
        dest = ('anulada en SAT' if c == 'ANULADA'
                else 'personal' if ws.cell(r, pc).value == 'Sí' else _destino(c, hoja, prov))
        if not hoja in HOJAS_LEIDAS:
            dest = 'HOJA NO LEIDA'
        if dest == 'REGLA 8: pago de factura FEL':
            saltado[prov] += q
        if dest == 'CATEGORIA DESCONOCIDA':
            desconocidas[str(c)] += q
        d[dest] += q
    cob[hoja] = {k: round(v, 2) for k, v in sorted(d.items())}

# Fuga = dinero que no llega al DRE y nadie decidio que asi fuera.
# La regla 3 y el alquiler por banco SI son decisiones, y van aparte.
PERDIDO = ('HOJA NO LEIDA', 'CATEGORIA DESCONOCIDA', 'SIN CATEGORIA', 'POR CLASIFICAR')
A_REVISAR = ('REGLA 3: no suma', 'REGLA 7: ya vino por FEL', 'REGLA 8: pago de factura FEL')
fugas = {h: round(sum(v for k, v in d.items() if k in PERDIDO), 2) for h, d in cob.items()}

json.dump({'cobertura': cob, 'fugas': fugas,
           'desconocidas': {k: round(v, 2) for k, v in desconocidas.items()}},
          open(os.path.join(OUT, 'cobertura.json'), 'w'), ensure_ascii=False)

print("\nCOBERTURA  que pasa con cada quetzal de 2026 (control, no cambia numeros)")
for hoja, d in cob.items():
    marca = '' if hoja in HOJAS_LEIDAS else '   <-- NO ESTA EN LIBROS'
    print("  %s%s" % (hoja, marca))
    for k, v in sorted(d.items(), key=lambda x: -x[1]):
        alerta = '  <<< FUGA' if k in PERDIDO else ('  <  revisar' if k in A_REVISAR else '')
        print("     %-34s Q%10s%s" % (k, format(v, ',.2f'), alerta))
if desconocidas:
    print("  CATEGORIAS QUE NO ESTAN NI EN MAP NI EN FUERA (se caen en silencio):")
    for k, v in sorted(desconocidas.items(), key=lambda x: -x[1]):
        print("     %-34s Q%10s" % (k, format(v, ',.2f')))
# La regla 8 solo es segura mientras el proveedor siga facturando. Si lo saltado
# del año pasa de 1.3 veces su factura, la regla esta borrando gasto real.
fel_nit = defaultdict(float)
_fel = wb['01_FEL_Maestro']
for r in range(5, _fel.max_row + 1):
    f = _fel.cell(r, 1).value
    if isinstance(f, datetime.datetime) and f.year == ANIO and _fel.cell(r, 14).value != 'ANULADA':
        nit = re.sub(r'\.0$', '', str(_fel.cell(r, 5).value or '').strip())
        fel_nit[nit] += _fel.cell(r, 10).value or 0
print("\nREGLA 8  pago saltado contra la factura FEL del año, por NIT")
for prov, nit in dict((p[0], p[1]) for p in PAGO_DE_FACTURA).items():
    pago, fac = saltado.get(prov, 0), fel_nit.get(nit, 0)
    alerta = '  <<< paga mas de lo que factura' if pago > 1.3 * fac else ''
    print("  %-21s NIT %-10s pago Q%10s  factura Q%10s%s"
          % (prov, nit, format(pago, ',.2f'), format(fac, ',.2f'), alerta))
tot_fuga = round(sum(fugas.values()), 2)
rev = round(sum(v for d in cob.values() for k, v in d.items() if k in A_REVISAR), 2)
print("  FUGA (nadie decidio que se cayera):        Q%s" % format(tot_fuga, ',.2f'))
print("  Reglas 3, 7 y 8, pagos de facturas que ya vinieron por FEL: Q%s" % format(rev, ',.2f'))
print("  De esos, los que NO tengan factura son gasto real que se esta borrando.")
