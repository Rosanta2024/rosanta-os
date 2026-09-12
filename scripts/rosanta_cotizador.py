#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
ROSANTA · GENERADOR DE COTIZACIONES DE EVENTO
================================================================================
Formato "Versión Sofía Alonzo": header con versión, opciones con descripciones
de platos, detalle con saldo al cierre y equivalente por persona, condiciones
detalladas y página de aceptación con firma.

CÓMO USAR
---------
1. Edita SOLO el diccionario `cfg` de abajo (datos del cliente, personas,
   opciones de menú, extras).
2. Ejecuta:  python3 rosanta_cotizador.py
3. El PDF se genera en la ruta indicada en cfg["salida"].

ESTRUCTURA DE UNA OPCIÓN DE MENÚ (lista cfg["opciones"]):
  - Pon UNA sola opción si el cliente ya eligió (ej. solo Menú Eventos servido).
  - Pon DOS opciones (A y B) para un primer contacto donde el cliente compara.

TIPOS DE LÍNEA en cada opción ("lineas"):
  - por_persona:  precio fijo × número de personas
  - por_plato:    para entrantes Para Compartir (1 plato por cada N invitados)
  - cortesia:     muestra "Cortesía" y suma Q0 (ej. salón privado)

NOTAS
  - 15% servicio y 50% depósito se calculan automáticamente.
  - Para menú servido CON postre (tres tiempos) no se incluye descorche.
    Para menú SIN postre (dos tiempos) puedes activar el extra de descorche.
================================================================================
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, Image, KeepTogether, PageBreak)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from PIL import Image as PILImage, ImageChops
import math, os

# ============================================================================
# >>>>>>>>>>>>>>>>  EDITA AQUÍ: CONFIGURACIÓN DE LA COTIZACIÓN  <<<<<<<<<<<<<<<
# ============================================================================
cfg = {
    # ---- Encabezado / datos del evento ----
    "version":   "Versión 1 · Junio 2026",
    "cliente":   "Daniela Torres",
    "evento":    "Boda civil",
    "fecha":     "Sábado 19 de diciembre de 2026",
    "personas":  12,
    "ubicacion": "Rosanta · Antigua Guatemala",
    "formato":   "Menú servido de tres tiempos (entrante, fuerte y postre)",
    "saludo":    "Estimada Daniela:",
    # Párrafo de presentación. Usa {personas} si quieres insertar el número.
    "intro":     ("Será un gusto recibirla a usted y a sus invitados en Rosanta para "
                  "celebrar su boda civil. A continuación le presentamos nuestra propuesta "
                  "de menú servido de tres tiempos, con bebidas incluidas y alternativa "
                  "vegetariana y pescetariana, servida en nuestro salón privado. El precio "
                  "por persona varía según la selección final del menú."),

    # ---- Rutas ----
    # Por defecto usa la firma incluida en el propio skill (junto a este script).
    "firma_origen": os.path.join(os.path.dirname(os.path.abspath(__file__)), "Firma_Rosanta_VF.png"),
    "salida":       "/mnt/user-data/outputs/Rosanta_Cotizacion_DanielaTorres_19Dic2026.pdf",

    # ---- Bloque de bebidas (texto descriptivo, igual para todas las opciones) ----
    "bebidas_titulo": "Bebidas incluidas",
    "bebidas_texto":  ("A escoger por persona: 2 copas de vino o 2 cocteles de la casa, más "
                       "3 cervezas, mocktails o refrescos naturales (o 1 litro de agua "
                       "gasificada). Incluye agua natural. Cocteles de la casa: Paloma "
                       "Rosanta, Fufuro y Chambón. Vinos: Chardonnay y Cabernet Sauvignon "
                       "(Chile). Cerveza Gallo. Mocktail de temporada. Refrescos: limonada "
                       "y Rosa de Jamaica especiada."),

    # ---- OPCIONES DE MENÚ (1 o 2) ----
    # Cada opción se describe en la página 1 (secciones) y se cotiza en el detalle (lineas).
    "opciones": [
        {
            # Título: usa "Opción A. ..." cuando hay dos; sin "Opción" cuando hay una sola.
            "titulo_pagina1": "Menú para Eventos Especiales (servido)",
            "titulo_detalle": "Menú para Eventos Especiales (servido) · base Q320",
            "descripcion": "Servicio individual de tres tiempos. Cada comensal elige su entrante, fuerte y postre.",
            # Secciones de platos para la página 1 (cada una: subtítulo + lista de platos)
            "secciones": [
                ("Entrantes (a escoger)", [
                    ("Ensalada Rosanta", "Lechuga mixta, tomates rostizados, naranja, aguacate, melocotón grillado y encurtidos de la casa, con vinagreta de hierbabuena."),
                    ("Carpaccio de lomito", "Finas láminas de lomito de res, queso parmesano, cebollas encurtidas, alcaparras y confitura de limón. Acompañado de pan de la casa."),
                    ("Portobello a la parrilla", "En lechugas mixtas, tomates rostizados, naranja, aguacate, melocotón grillado, encurtidos de la casa y reducción de balsámico."),
                ]),
                ("Fuertes (a escoger)", [
                    ("Muslos de pollo a la naranja · Q320", "Muslos de pollo horneados con fondo de vegetales y salsa de naranja, sobre mix de vegetales rostizados y papa horneada."),
                    ("Lomito en salsa de puerros · Q350", "Lomito a la parrilla y salsa de puerros sobre cama de espinaca salteada y bastones de zanahoria glaseados."),
                    ("Robalo Meunière (pescetariano) · Q350", "Robalo a la Meunière con alcaparras, puré de pera y remolacha."),
                    ("Plato de quinoa (vegetariano) · Q320", "Quinoa salteada en aceite de sésamo, tomates cherry, aguacate, vegetales frescos, elote asado, chips de malanga y alioli de cilantro."),
                ]),
                ("Postres (a escoger)", [
                    ("Panacota de café y cardamomo", "Con una tierra de chocolate blanco y crema de limón."),
                    ("Carlota de fresa", "Crema y queso crema batidos, cubiertos de una mermelada de fresa."),
                ]),
            ],
            # Líneas de precio para el detalle
            "lineas": [
                {"tipo": "por_persona", "concepto": "Menú tres tiempos por persona",
                 "detalle": "Entrante, fuerte y postre a escoger.", "precio": 320},
                {"tipo": "por_persona", "concepto": "Bebidas por persona",
                 "detalle": "Vinos, cocteles de la casa, cerveza, mocktails y refrescos.", "precio": 150},
                # Ejemplo salón cortesía (descomenta para mostrarlo):
                # {"tipo": "cortesia", "concepto": "Salón privado", "detalle": "Sin cargo, cortesía de la casa."},
            ],
        },
        # ------------------------------------------------------------------
        # SEGUNDA OPCIÓN (Para Compartir). Descomenta este bloque completo
        # si necesitas presentar las dos opciones (primer contacto):
        # ------------------------------------------------------------------
        # {
        #     "titulo_pagina1": "Opción B. Menú Estilo Rosanta (Para Compartir)",
        #     "titulo_detalle": "Opción B. Menú Estilo Rosanta (Para Compartir)",
        #     "descripcion": "Formato para compartir al centro de la mesa, con entrantes de nuestra carta, fuerte a escoger y postre incluido.",
        #     "secciones": [
        #         ("Entrantes para compartir (varios de la carta)", [
        #             ("Selección de la carta", "Queso horneado, pulpo a la parrilla, carpaccio de lomito y tabla de jamones y quesos. Se sirven aproximadamente un plato por cada tres invitados."),
        #         ]),
        #         ("Fuertes (a escoger)", [
        #             ("Lomito en salsa de puerros", "Lomito a la parrilla y salsa de puerros sobre cama de espinaca salteada y bastones de zanahoria glaseados."),
        #             ("Pesca del día", "Servida con salsa de vino blanco aromatizada con salvia, puré de camote y zanahorias horneadas, ejotes tiernos y bok choy asado."),
        #         ]),
        #         ("Postre incluido", [
        #             ("Carlota de fresa o peras horneadas", "Peras horneadas con sirope de citronela, queso crema con mandarina y pistachos."),
        #         ]),
        #     ],
        #     "lineas": [
        #         {"tipo": "por_plato", "concepto": "Entrantes varios para compartir",
        #          "detalle": "Un plato aproximadamente por cada tres invitados.", "precio": 160, "por_cada": 3},
        #         {"tipo": "por_persona", "concepto": "Fuerte + postre por persona",
        #          "detalle": "Fuerte a escoger con postre incluido.", "precio": 230},
        #         {"tipo": "por_persona", "concepto": "Bebidas por persona",
        #          "detalle": "Vinos, cocteles de la casa, cerveza, mocktails y refrescos.", "precio": 150},
        #     ],
        # },
    ],

    # ---- EXTRA OPCIONAL: descorche de pastel (solo menús SIN postre) ----
    # Pon "extra_descorche": True para mostrar la sección. False para ocultarla.
    "extra_descorche": False,
    "extra_descorche_precio": 25,

    # ---- Texto al pie del detalle ----
    "nota_detalle": ("Los precios mostrados corresponden a una selección base. El monto final "
                     "se ajusta según los platos y bebidas elegidos por cada comensal. El salón "
                     "privado se ofrece sin cargo para este grupo."),

    # ---- Línea de aceptación (página final) ----
    "aceptacion": ("Confirmamos los términos de esta propuesta para la boda civil del 19 de "
                   "diciembre de 2026. El depósito del 50% queda como abono al total y garantiza "
                   "la fecha reservada."),
}
# ============================================================================
# >>>>>>>>>>>>>>>>>>>>  FIN DE LA CONFIGURACIÓN EDITABLE  <<<<<<<<<<<<<<<<<<<<<
# ============================================================================


# ---------------------------------------------------------------------------
# Constantes de marca y estilos (no es necesario editar debajo de esta línea)
# ---------------------------------------------------------------------------
VERDE = colors.HexColor('#456B50')   # Verde Bosque
LILA  = colors.HexColor('#A89DC8')   # Lila
CREMA = colors.HexColor('#F0EDE6')   # Crema
GRIS  = colors.HexColor('#555555')
FIRMA_CROP = '/tmp/firma_crop.png'

def preparar_firma(origen):
    """Recorta el espacio en blanco de la firma y la guarda en /tmp."""
    im = PILImage.open(origen).convert('RGB')
    bg = PILImage.new('RGB', im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg)
    bbox = diff.getbbox()
    (im.crop(bbox) if bbox else im).save(FIRMA_CROP)
    cropped = PILImage.open(FIRMA_CROP)
    return cropped.size  # (w, h) para mantener proporción

def money(x):
    return f"Q{x:,.2f}"

styles = getSampleStyleSheet()
H1   = ParagraphStyle('H1', parent=styles['Title'], textColor=VERDE, fontSize=20, spaceAfter=4, alignment=TA_CENTER)
H1L  = ParagraphStyle('H1L', parent=styles['Title'], textColor=VERDE, fontSize=17, spaceAfter=4, alignment=TA_LEFT)
SUB  = ParagraphStyle('SUB', parent=styles['Normal'], textColor=GRIS, fontSize=10.5, alignment=TA_LEFT, spaceAfter=10)
H2   = ParagraphStyle('H2', parent=styles['Heading2'], textColor=VERDE, fontSize=13, spaceBefore=12, spaceAfter=6)
H3   = ParagraphStyle('H3', parent=styles['Heading3'], textColor=LILA, fontSize=11, spaceBefore=8, spaceAfter=3)
BODY = ParagraphStyle('BODY', parent=styles['Normal'], fontSize=10, leading=14, alignment=TA_LEFT, spaceAfter=6)
DISH = ParagraphStyle('DISH', parent=styles['Normal'], fontSize=9.5, leading=12, spaceAfter=5)
DISHNAME = ParagraphStyle('DISHNAME', parent=styles['Normal'], fontSize=10, leading=12, textColor=VERDE, fontName='Helvetica-Bold')
SMALL = ParagraphStyle('SMALL', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=GRIS)
EQUIV = ParagraphStyle('EQUIV', parent=styles['Normal'], fontSize=9.5, leading=12, textColor=VERDE, fontName='Helvetica-Oblique', spaceBefore=4)
ITAL  = ParagraphStyle('ITAL', parent=styles['Normal'], fontSize=10, leading=14, fontName='Helvetica-Oblique', textColor=GRIS)
CELL  = ParagraphStyle('CELL', parent=styles['Normal'], fontSize=9.5, leading=12)

def cellpara(concepto, detalle):
    return Paragraph(f"<b>{concepto}</b><br/><font size=8 color='#555555'>{detalle}</font>", CELL)

def make_deco(version):
    def deco(canvas, doc):
        canvas.saveState()
        w, h = letter
        canvas.setFillColor(VERDE)
        canvas.rect(0, h-0.85*inch, w, 0.85*inch, fill=1, stroke=0)
        canvas.setFillColor(LILA)
        canvas.rect(0, h-0.89*inch, w, 0.04*inch, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 13)
        canvas.drawString(0.8*inch, h-0.45*inch, "ROSANTA")
        canvas.setFont('Helvetica-Oblique', 8.5)
        canvas.drawString(0.8*inch, h-0.62*inch, "Cocina con Carisma · Antigua Guatemala")
        canvas.setFont('Helvetica-Bold', 10)
        canvas.drawRightString(w-0.8*inch, h-0.45*inch, "COTIZACIÓN DE EVENTO")
        canvas.setFont('Helvetica', 7.5)
        canvas.drawRightString(w-0.8*inch, h-0.60*inch, version)
        canvas.setFillColor(GRIS)
        canvas.setFont('Helvetica', 8)
        canvas.drawString(0.8*inch, 0.5*inch, "Rosanta · Antigua Guatemala · restaurante@rosanta.rest · Tel (502) 7766-880")
        canvas.drawRightString(w-1.0*inch, 0.5*inch, str(doc.page))
        canvas.setFillColor(VERDE)
        canvas.circle(w-0.85*inch, 0.53*inch, 0.03*inch, fill=1, stroke=0)
        canvas.restoreState()
    return deco

def calcular_subtotal(lineas, personas):
    """Devuelve (filas_tabla, subtotal) para una lista de líneas."""
    filas, subtotal = [], 0
    for ln in lineas:
        if ln["tipo"] == "por_persona":
            sub = ln["precio"] * personas
            filas.append([cellpara(ln["concepto"], ln["detalle"]), money(ln["precio"]), str(personas), money(sub)])
        elif ln["tipo"] == "por_plato":
            cant = math.ceil(personas / ln.get("por_cada", 3))
            sub = ln["precio"] * cant
            filas.append([cellpara(ln["concepto"], ln["detalle"]), money(ln["precio"]), str(cant), money(sub)])
        elif ln["tipo"] == "cortesia":
            sub = 0
            filas.append([cellpara(ln["concepto"], ln.get("detalle", "")), "Cortesía", "1", money(0)])
        else:
            continue
        subtotal += sub
    return filas, subtotal

def bloque_detalle(titulo, filas, subtotal, personas):
    servicio = subtotal * 0.15
    total = subtotal + servicio
    deposito = total * 0.5
    rows = [["Concepto", "Precio Q", "Cant.", "Subtotal Q"]] + filas + [
        ["Subtotal", "", "", money(subtotal)],
        ["+ Servicio 15%", "", "", money(servicio)],
        ["TOTAL", "", "", money(total)],
        ["Depósito 50% para reservar", "", "", money(deposito)],
        ["Saldo al cierre del evento", "", "", money(deposito)],
    ]
    pt = Table(rows, colWidths=[3.1*inch, 1.0*inch, 0.7*inch, 1.4*inch])
    n = len(filas)
    pt.setStyle(TableStyle([
        ('FONT',(0,0),(-1,-1),'Helvetica',9.5),
        ('BACKGROUND',(0,0),(-1,0),VERDE),
        ('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('FONT',(0,0),(-1,0),'Helvetica-Bold',9.5),
        ('ALIGN',(1,0),(-1,-1),'RIGHT'),
        ('ALIGN',(2,0),(2,-1),'CENTER'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LINEBELOW',(0,0),(-1,0),0.6,VERDE),
        ('LINEBELOW',(0,1),(-1,n),0.3,CREMA),
        ('LINEABOVE',(0,n+1),(-1,n+1),0.6,LILA),
        ('FONT',(0,n+1),(-1,n+1),'Helvetica-Bold',9.5),
        ('FONT',(0,n+3),(-1,n+3),'Helvetica-Bold',11),
        ('TEXTCOLOR',(0,n+3),(-1,n+3),VERDE),
        ('BACKGROUND',(0,n+3),(-1,n+3),CREMA),
        ('TOPPADDING',(0,0),(-1,-1),5),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),
    ]))
    equiv = Paragraph(f"Equivalente a {money(total/personas)} por persona, todo incluido.", EQUIV)
    return [Paragraph(titulo, H2), pt, equiv, Spacer(1,14)], total

def generar(cfg):
    personas = cfg["personas"]
    fw, fh = preparar_firma(cfg["firma_origen"])
    os.makedirs(os.path.dirname(cfg["salida"]), exist_ok=True)

    doc = SimpleDocTemplate(cfg["salida"], pagesize=letter, topMargin=1.25*inch,
                            bottomMargin=0.85*inch, leftMargin=0.8*inch, rightMargin=0.8*inch)
    S = []

    # ---------------- PÁGINA 1 ----------------
    S.append(Paragraph(cfg["evento"], H1L))
    S.append(Paragraph(f"Cotización de Evento Privado · {personas} personas", SUB))

    info = [
        ["Cliente", cfg["cliente"]],
        ["Evento", cfg["evento"]],
        ["Fecha", cfg["fecha"]],
        ["Personas", f"{personas} invitados"],
        ["Ubicación", cfg["ubicacion"]],
        ["Formato", cfg["formato"]],
    ]
    t = Table(info, colWidths=[1.3*inch, 4.7*inch])
    t.setStyle(TableStyle([
        ('FONT',(0,0),(-1,-1),'Helvetica',10),
        ('FONT',(0,0),(0,-1),'Helvetica-Bold',10),
        ('TEXTCOLOR',(0,0),(0,-1),VERDE),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),5),
        ('LINEBELOW',(0,0),(-1,-2),0.4,CREMA),
    ]))
    S.append(t); S.append(Spacer(1,12))

    S.append(Paragraph(cfg["saludo"], BODY))
    S.append(Paragraph(cfg["intro"].format(personas=personas), BODY))

    # Descripción de cada opción (con sus secciones de platos)
    for op in cfg["opciones"]:
        S.append(Paragraph(op["titulo_pagina1"], H2))
        if op.get("descripcion"):
            S.append(Paragraph(op["descripcion"], BODY))
        for subtitulo, platos in op.get("secciones", []):
            S.append(Paragraph(subtitulo, H3))
            for nombre, desc in platos:
                S.append(Paragraph(nombre, DISHNAME))
                S.append(Paragraph(desc, DISH))

    # Bebidas (común)
    S.append(Paragraph(cfg["bebidas_titulo"], H2))
    S.append(Paragraph(cfg["bebidas_texto"], BODY))

    # ---------------- DETALLE ----------------
    # Si hay una sola opción cabe en la misma fluidez; con dos, salto de página.
    if len(cfg["opciones"]) >= 2:
        S.append(PageBreak())
    else:
        S.append(Spacer(1,16))

    S.append(Paragraph("DETALLE DE LA PROPUESTA", H1))
    S.append(Spacer(1,8))

    for op in cfg["opciones"]:
        filas, subtotal = calcular_subtotal(op["lineas"], personas)
        elementos, _ = bloque_detalle(op["titulo_detalle"], filas, subtotal, personas)
        for e in elementos:
            S.append(e)

    # Extra opcional: descorche de pastel + café
    if cfg.get("extra_descorche"):
        p = cfg["extra_descorche_precio"]
        sub = p * personas
        serv = sub * 0.15
        rows = [
            ["Concepto", "Precio Q", "Cant.", "Subtotal Q"],
            [cellpara("Descorche de pastel + café por persona", "Si traen su propio pastel."), money(p), str(personas), money(sub)],
            ["+ Servicio 15%", "", "", money(serv)],
            ["Total extra (si aplica)", "", "", money(sub+serv)],
        ]
        pt = Table(rows, colWidths=[3.1*inch, 1.0*inch, 0.7*inch, 1.4*inch])
        pt.setStyle(TableStyle([
            ('FONT',(0,0),(-1,-1),'Helvetica',9.5),
            ('BACKGROUND',(0,0),(-1,0),VERDE),
            ('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('FONT',(0,0),(-1,0),'Helvetica-Bold',9.5),
            ('ALIGN',(1,0),(-1,-1),'RIGHT'),
            ('ALIGN',(2,0),(2,-1),'CENTER'),
            ('LINEBELOW',(0,0),(-1,0),0.6,VERDE),
            ('LINEABOVE',(0,2),(-1,2),0.6,LILA),
            ('FONT',(0,3),(-1,3),'Helvetica-Bold',10),
            ('TEXTCOLOR',(0,3),(-1,3),VERDE),
            ('BACKGROUND',(0,3),(-1,3),CREMA),
            ('TOPPADDING',(0,0),(-1,-1),5),
            ('BOTTOMPADDING',(0,0),(-1,-1),5),
        ]))
        nota = Paragraph("El menú servido se ofrece sin postre. Como alternativa, ofrecemos el "
                         "descorche de pastel propio acompañado de café, que se agrega solo si usted lo desea.", SMALL)
        S.append(KeepTogether([Paragraph("Extra opcional · Descorche de pastel + café", H2), pt, Spacer(1,4), nota]))
        S.append(Spacer(1,8))

    S.append(Paragraph(cfg["nota_detalle"], SMALL))

    # ---------------- PÁGINA FINAL: CONDICIONES + ACEPTACIÓN ----------------
    S.append(PageBreak())
    S.append(Paragraph("CONDICIONES Y NOTAS", H1))
    S.append(Spacer(1,8))
    condiciones = [
        ("Reserva y pago", "Para garantizar la fecha del evento se requiere un depósito del 50%. El saldo se liquida el día del evento. El depósito se acredita al confirmar por escrito esta propuesta y completar la transferencia bancaria a la cuenta de Rosanta."),
        ("Vigencia de la propuesta", "Esta cotización es válida durante 15 días a partir de la fecha de emisión. Después de ese plazo, los precios pueden ajustarse según disponibilidad."),
        ("Servicio", "Se cobra el 15% sobre servicio, ya reflejado en el total. Incluye coordinación del evento, montaje y desmontaje, atención al cliente, gastos operativos del personal y limpieza."),
        ("Ajustes y alergias", "Cambios en cantidad de invitados se aceptan hasta 48 horas antes del evento. Favor informar cualquier alergia alimentaria al confirmar el menú definitivo."),
    ]
    for titulo, txt in condiciones:
        S.append(Paragraph(titulo, H3))
        S.append(Paragraph(txt, BODY))

    S.append(Spacer(1,10))
    S.append(Paragraph("ACEPTACIÓN", H1))
    S.append(Paragraph(cfg["aceptacion"], BODY))
    S.append(Spacer(1,18))

    firma = Image(FIRMA_CROP, width=1.6*inch, height=1.6*inch*fh/fw)
    sig = [
        [firma, ""],
        [Spacer(1,4), Spacer(1,4)],
        ["_______________________________", "_______________________________"],
        [Paragraph("<b>Por Rosanta</b>", BODY), Paragraph("<b>Por el Cliente</b>", BODY)],
        [Paragraph("Equipo de Eventos", SMALL), Paragraph(cfg["cliente"], SMALL)],
    ]
    st = Table(sig, colWidths=[3.0*inch, 3.0*inch])
    st.setStyle(TableStyle([
        ('ALIGN',(0,0),(0,0),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'BOTTOM'),
        ('TOPPADDING',(0,0),(-1,-1),1),
    ]))
    S.append(KeepTogether(st))
    S.append(Spacer(1,16))
    S.append(Paragraph("Agradecemos su confianza. Será un honor recibirla en Rosanta.", ITAL))

    deco = make_deco(cfg["version"])
    doc.build(S, onFirstPage=deco, onLaterPages=deco)
    print("PDF generado:", cfg["salida"])

if __name__ == "__main__":
    generar(cfg)
