# -*- coding: utf-8 -*-
"""
Rosanta - Generador de Cotizaciones de Evento (v2, reconstruido jul 2026)
Editar SOLO el bloque CONFIGURACION. Ejecutar: python3 rosanta_cotizador.py
Dependencias: reportlab, pillow. Requiere Firma_Rosanta_VF.png junto al script
(si falta, el PDF se genera con linea de firma vacia y se imprime un WARNING).

NOTA: este script fue reconstruido a partir de la especificacion del SKILL.md
(jul 2026). Validar la primera salida contra una cotizacion aprobada por Juanma.
"""
import math, os, sys

# ============================ CONFIGURACION ============================
PERSONAS = 80

CFG = {
    "cliente": "Mollie Deadwyler and Clarisa",
    "evento": "Private event (full restaurant)",
    "fecha": "To be confirmed · November or December 2026",
    "espacio": "Full restaurant (exclusive use)",
    "subtitulo": "Private event · Exclusive use of the full restaurant",
    "saludo_nombre": "Mollie and Clarisa",
    "intro": ("Thank you for your interest in celebrating with us. It will be a "
              "pleasure to host you with the entire restaurant reserved exclusively "
              "for you and your guests. There is no rental fee for the venue: the "
              "reservation includes 3 hours of service with the full restaurant. "
              "Below you will find the menu and prices to confirm your reservation."),
    "salida_nombre": "Rosanta_Quote_MollieClarisa_PrivateEvent_NovDec2026.pdf",
}

OPCIONES = [
    {
        "titulo": "Option A. Rosanta Style Menu (To Share) and Open Bar",
        "descripcion": ("A shared, center-of-the-table format: a variety of starters "
                        "from our menu, followed by a main course of individual "
                        "choice, accompanied by an open bar throughout the event."),
        "menus": [
            {"titulo": "Starters to share (center of the table)",
             "platos": [
                "Beef tenderloin carpaccio: thin slices of beef tenderloin, parmesan, pickled onions, capers and lemon confiture, with house bread.",
                "Grilled octopus: paprika potatoes, pea puree, lemon verbena mayonnaise, orange supreme and roasted tomatoes.",
                "Baked cheese: in pepitoria sauce, with red wine macerated strawberries, tomato compote, caramelized onions and toasted house bread.",
                "Cheese and charcuterie board: selection of aged cheeses and cured hams, house pickles and fresh fruit.",
             ]},
            {"titulo": "Main course (individual choice)",
             "platos": [
                "Beef tenderloin in leek sauce, over sauteed spinach and glazed carrots.",
                "Catch of the day, with white wine and sage sauce, sweet potato puree, roasted carrots, green beans and roasted bok choy.",
                "Vegetarian alternative: quinoa bowl.",
             ]},
            {"titulo": "Open Bar",
             "platos": [
                "House cocktails, wine and beer, unlimited service throughout the event.",
                "Glassware, ice, mixers and bartenders provided by Rosanta.",
                "Mocktails and natural juices for guests who prefer non-alcoholic options.",
             ]},
        ],
        "lineas": [
            ("Starters to share (1 plate per every 3 guests)", 170, "porcada3"),
            ("Main course (per person)", 210, "personas"),
            ("Open Bar (unlimited service)", 200, "personas"),
        ],
        "nota": ("Starters charged per shared plate; main course and Open Bar per "
                 "person. Does not include the 15% service charge (detailed in the table)."),
    },
]

BEBIDAS = {
    "titulo": "Drinks",
    "items": [
        "The Open Bar includes house cocktails, wine, beer, mocktails and natural juices, with no consumption limit during the event.",
        "All liquor, glassware and bar equipment are provided by Rosanta.",
    ],
}

CONDICIONES = [
    "Exclusive use of the entire restaurant is included in the event reservation, at no additional rental fee.",
    "The reservation includes 3 hours of service with the full venue. Afterwards, your guests are welcome to stay at the restaurant ordering on their own account.",
    "A 15% service charge is added to the subtotal.",
    "A 50% deposit reserves the date; the balance is settled at the close of the event.",
    "The exact date (November or December 2026) is confirmed with the deposit, subject to availability.",
    "This quote is valid for 15 days.",
]

CONTACTO = "Rosanta · Cocina con Carisma · Antigua Guatemala · restaurante@rosanta.rest"
# ========================= FIN CONFIGURACION ==========================

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, Image, KeepTogether)

VERDE  = HexColor("#4E6D5A")  # Verde Bosque · Brand Kit anti-brand jul 2026
LILA   = HexColor("#AEAAE2")
MORADO = HexColor("#8A7FA6")
CREMA  = HexColor("#F2EEEB")
NEGRO  = HexColor("#000000")

BASE = os.path.dirname(os.path.abspath(__file__))
FIRMA_SRC = os.path.join(BASE, "Firma_Rosanta_VF.png")

def q(n):
    return "Q{:,.2f}".format(n)

def cantidad_de(spec):
    if spec == "personas":
        return PERSONAS
    if spec == "porcada3":
        return math.ceil(PERSONAS / 3)
    return int(spec)

def preparar_firma():
    """Recorta la firma (fondo blanco) y devuelve ruta o None."""
    if not os.path.exists(FIRMA_SRC):
        print("WARNING: no se encontró Firma_Rosanta_VF.png junto al script. "
              "El PDF llevará solo la línea de firma. Avisar a Juanma.", file=sys.stderr)
        return None
    try:
        from PIL import Image as PImage, ImageChops
        im = PImage.open(FIRMA_SRC).convert("RGB")
        bg = PImage.new("RGB", im.size, (255, 255, 255))
        bbox = ImageChops.difference(im, bg).getbbox()
        if bbox:
            im = im.crop(bbox)
        out = "/tmp/firma_crop.png"
        im.save(out)
        return out
    except Exception as e:
        print("WARNING: no se pudo recortar la firma (%s); se usa original." % e, file=sys.stderr)
        return FIRMA_SRC

# ---------- estilos ----------
S = {
    "titulo":  ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=20,
                              textColor=VERDE, spaceAfter=2, leading=24),
    "sub":     ParagraphStyle("sub", fontName="Helvetica", fontSize=11,
                              textColor=MORADO, spaceAfter=10),
    "h2":      ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13,
                              textColor=VERDE, spaceBefore=12, spaceAfter=4),
    "h3":      ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11,
                              textColor=NEGRO, spaceBefore=8, spaceAfter=2),
    "body":    ParagraphStyle("body", fontName="Helvetica", fontSize=10,
                              textColor=NEGRO, leading=14, alignment=TA_LEFT),
    "nota":    ParagraphStyle("nota", fontName="Helvetica-Oblique", fontSize=8.5,
                              textColor=MORADO, leading=11, spaceBefore=3),
    "precio_lbl": ParagraphStyle("plbl", fontName="Helvetica-Bold", fontSize=10,
                                 textColor=MORADO, spaceBefore=8, spaceAfter=3),
}

def encabezado_footer(canvas, doc):
    canvas.saveState()
    w, h = letter
    # franja verde superior con linea lila
    canvas.setFillColor(VERDE)
    canvas.rect(0, h - 2.6 * cm, w, 2.6 * cm, stroke=0, fill=1)
    canvas.setFillColor(LILA)
    canvas.rect(0, h - 2.75 * cm, w, 0.15 * cm, stroke=0, fill=1)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(2 * cm, h - 1.45 * cm, "ROSANTA")
    canvas.setFont("Helvetica", 9)
    canvas.drawString(2 * cm, h - 1.95 * cm, "Cocina con Carisma")
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawRightString(w - 2 * cm, h - 1.7 * cm, "EVENT QUOTE")
    # footer
    canvas.setFillColor(VERDE)
    canvas.circle(2 * cm, 1.35 * cm, 0.09 * cm, stroke=0, fill=1)
    canvas.setFillColor(NEGRO)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2.3 * cm, 1.25 * cm, CONTACTO)
    canvas.drawRightString(w - 2 * cm, 1.25 * cm, "Page %d" % doc.page)
    canvas.restoreState()

def tabla_precios(opcion):
    filas = [["Item", "Price", "Qty", "Subtotal"]]
    subtotal = 0.0
    for concepto, precio, cant_spec in opcion["lineas"]:
        cant = cantidad_de(cant_spec)
        sub = precio * cant
        subtotal += sub
        filas.append([Paragraph(concepto, S["body"]), q(precio), str(cant), q(sub)])
    servicio = round(subtotal * 0.15, 2)
    total = subtotal + servicio
    deposito = round(total * 0.50, 2)
    filas += [["", "", "Subtotal", q(subtotal)],
              ["", "", "15% service", q(servicio)],
              ["", "", "TOTAL", q(total)],
              ["", "", "50% deposit (reservation)", q(deposito)],
              ["", "", "Balance at close", q(total - deposito)],
              ["", "", "Per-person equivalent", q(total / PERSONAS)]]
    t = Table(filas, colWidths=[8.2 * cm, 2.6 * cm, 3.2 * cm, 3.0 * cm])
    n = len(opcion["lineas"])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), VERDE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, n), [white, CREMA]),
        ("LINEABOVE", (2, n + 1), (-1, n + 1), 0.75, LILA),
        ("FONTNAME", (2, n + 3), (-1, n + 3), "Helvetica-Bold"),   # TOTAL
        ("TEXTCOLOR", (2, n + 3), (-1, n + 3), VERDE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def construir():
    doc = BaseDocTemplate(os.path.join(os.getcwd(), CFG["salida_nombre"]),
                          pagesize=letter,
                          leftMargin=2 * cm, rightMargin=2 * cm,
                          topMargin=3.4 * cm, bottomMargin=2.2 * cm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=encabezado_footer)])

    el = []
    el.append(Paragraph("Private Event Quote", S["titulo"]))
    el.append(Paragraph(CFG["subtitulo"], S["sub"]))

    datos = Table([["Client", CFG["cliente"]], ["Event", CFG["evento"]],
                   ["Date", CFG["fecha"]], ["Guests", str(PERSONAS)],
                   ["Venue", CFG["espacio"]]],
                  colWidths=[3.2 * cm, 13.8 * cm])
    datos.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), VERDE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CREMA, white]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    el.append(datos)
    el.append(Spacer(1, 10))
    el.append(Paragraph("Hi %s," % CFG["saludo_nombre"], S["body"]))
    el.append(Spacer(1, 4))
    el.append(Paragraph(CFG["intro"], S["body"]))

    for i, op in enumerate(OPCIONES):
        letra = chr(ord("A") + i)
        el.append(Paragraph(op["titulo"], S["h2"]))
        el.append(Paragraph(op["descripcion"], S["body"]))
        for m in op["menus"]:
            el.append(Paragraph(m["titulo"], S["h3"]))
            for plato in m["platos"]:
                el.append(Paragraph("· " + plato, S["body"]))
        # tabla de precios INMEDIATAMENTE despues de los menus de la opcion
        bloque = [Paragraph("Price details. Option %s" % letra, S["precio_lbl"]),
                  tabla_precios(op)]
        if op.get("nota"):
            bloque.append(Paragraph(op["nota"], S["nota"]))
        el.append(KeepTogether(bloque))

    el.append(Paragraph(BEBIDAS["titulo"], S["h2"]))
    for it in BEBIDAS["items"]:
        el.append(Paragraph("· " + it, S["body"]))

    el.append(Paragraph("Terms and Acceptance", S["h2"]))
    for c in CONDICIONES:
        el.append(Paragraph("· " + c, S["body"]))
    el.append(Spacer(1, 22))

    firma_path = preparar_firma()
    if firma_path:
        from PIL import Image as PImage
        iw, ih = PImage.open(firma_path).size
        fw = 4.2 * cm
        firma_cell = Image(firma_path, width=fw, height=fw * ih / iw)
    else:
        firma_cell = Spacer(1, 1.4 * cm)
    lineas = Table([[firma_cell, ""],
                    ["_______________________", "_______________________"],
                    ["For Rosanta", "For the Client"]],
                   colWidths=[8 * cm, 8 * cm])
    lineas.setStyle(TableStyle([
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (0, 2), (-1, 2), VERDE),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
    ]))
    el.append(KeepTogether([lineas, Spacer(1, 14),
                            Paragraph("It will be our pleasure to host you and make "
                                      "your event a memorable experience.", S["body"])]))
    doc.build(el)
    print("PDF generado:", CFG["salida_nombre"])

if __name__ == "__main__":
    construir()
