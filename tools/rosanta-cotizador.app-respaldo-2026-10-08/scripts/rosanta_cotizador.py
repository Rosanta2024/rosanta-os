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
PERSONAS = 30

# ---- TEXTOS PERSUASIVOS OFICIALES (vigentes 7 ago 2026) ----
# Van TAL CUAL en toda cotizacion. Solo cambian nombre, fecha y datos.
# NO reescribir ni "mejorar" sin que Juanma lo pida.
TEXTOS = {
    "intro": ("Una fecha así merece más que un salón: merece un jardín. Esta propuesta "
              "reúne menú, espacio y precios, pensada para que su único pendiente sea "
              "llegar a celebrar."),
    "entrada_bebidas": "La barra acompaña del brindis a la sobremesa:",
    "entrada_terminos": "Lo importante, claro y por escrito:",
    "cierre": ("Ustedes eligen la fecha y llegan a celebrar; el jardín hace el resto. "
               "La mejor mesa es la sobremesa, y la suya ya tiene fecha."),
}

# Descripciones y notas oficiales de cada opcion. Copiar de aqui a OPCIONES.
TEXTOS_OPCION = {
    "A": {
        "descripcion": ("Tres tiempos servidos a la mesa, al ritmo de su celebración. "
                        "Cada invitado elige su menú y el equipo se ocupa de que todo "
                        "llegue a su punto y a su tiempo."),
        "nota": "Precios por persona. El 15% de servicio va detallado en la tabla.",
    },
    "B": {
        "descripcion": ("Así se come aquí: entrantes al centro, manos que se cruzan y una "
                        "conversación que arranca sola. Cada invitado elige su fuerte y lo "
                        "demás se comparte, como en las mesas que se recuerdan."),
        "nota": ("Los entrantes se comparten y se cobran por plato (1 por cada 3 invitados); "
                 "el fuerte va por persona."),
    },
    "C": {
        "descripcion": ("La celebración de pie. Bocados guatemaltecos que circulan entre sus "
                        "invitados y una barra abierta durante todo el servicio, para brindar, "
                        "conversar y moverse por el jardín a su ritmo."),
        "barra_titulo": "Barra libre",
        "barra_texto": ("Cocteles de temporada, vino, cerveza y mocktails, servidos durante "
                        "las tres horas del evento."),
        "nota": ("Las tapas se sirven por persona (6 piezas). La barra queda abierta durante "
                 "las tres horas de servicio."),
    },
}

CFG = {
    "cliente": "Nombre del Cliente",
    "evento": "Cena privada",
    "fecha": "Sábado 15 de agosto de 2026",
    "espacio": "Jardín de Rosanta",  # "Jardín Santa Rosa" PROHIBIDO: sub-marca descontinuada jun 2026
    "subtitulo": "Cena privada · Jardín de Rosanta",
    "saludo_nombre": "Nombre",   # -> "Hola Nombre,"
    "intro": TEXTOS["intro"],    # texto oficial; no cambiarlo
    "salida_nombre": "Cotizacion_Rosanta.pdf",
}

# ---- PORTADA (plantilla de diseno oficial de Juanma, 2 paginas) ----
# "eventos" | "boda" | None  (None solo para borradores internos)
PORTADA = "eventos"
PORTADA_CFG = {
    # Titulo grande en serif de la portada: nombre comercial del evento.
    "evento": "Cena de Aniversario",
    # Va como "Preparada para ___". Si lo pide un planner, aqui va el planner.
    "cliente": "Familia Herrera",
    # Linea de datos: si "linea_datos" queda en None se arma con fecha/personas/espacio.
    "fecha": "14 de noviembre, 2026",
    "personas": None,        # None = usa PERSONAS
    "espacio": "Jardín",
    "linea_datos": None,     # o un texto completo que sobreescribe la linea
}

# Cada opcion: titulo, descripcion, menus (titulo + platos), lineas de precio, nota.
# cantidad: "personas" | "porcada3" (ceil(PERSONAS/3), entrantes Para Compartir) | int fijo
OPCIONES = [
    {
        "titulo": "Opción A. Eventos Especiales (menú servido)",
        "descripcion": TEXTOS_OPCION["A"]["descripcion"],
        "menus": [
            {"titulo": "Menú 1. Pollo (Q320)",
             "platos": ["Entrante: (plato real de la carta)",
                        "Fuerte: (plato real de la carta)",
                        "Postre: (plato real de la carta)"]},
        ],
        "lineas": [("Menú servido tres tiempos", 320, "personas")],
        "nota": TEXTOS_OPCION["A"]["nota"],
    },
    {
        "titulo": "Opción B. Estilo Rosanta (Para Compartir)",
        "descripcion": TEXTOS_OPCION["B"]["descripcion"],
        "menus": [
            {"titulo": "Entrantes para compartir",
             "platos": ["(plato real de la carta)", "(plato real de la carta)"]},
            {"titulo": "Fuerte (elección individual)",
             "platos": ["(plato real de la carta)"]},
        ],
        "lineas": [("Entrantes para compartir (1 por cada 3 invitados)", 160, "porcada3"),
                   ("Fuerte con postre", 260, "personas")],
        "nota": TEXTOS_OPCION["B"]["nota"],
    },
    # Opcion C (Tapas Guatemaltecas y Barra Libre): SIEMPRE de ultima, nunca abre la
    # conversacion. Plantilla lista para copiar cuando toque:
    # {
    #     "titulo": "Opción C. Tapas Guatemaltecas y Barra Libre",
    #     "descripcion": TEXTOS_OPCION["C"]["descripcion"],
    #     "menus": [
    #         {"titulo": "Tapas Guatemaltecas (6 piezas por persona)", "platos": [...]},
    #         {"titulo": TEXTOS_OPCION["C"]["barra_titulo"],
    #          "platos": [TEXTOS_OPCION["C"]["barra_texto"]]},
    #     ],
    #     "lineas": [("Tapas Guatemaltecas (6 piezas)", 150, "personas"),
    #                ("Barra Libre", 200, "personas")],
    #     "nota": TEXTOS_OPCION["C"]["nota"],
    # },
]

# Poner BEBIDAS = None cuando la Opcion C va sola: la barra libre ya las lleva incluidas.
BEBIDAS = {
    "titulo": "Bebidas incluidas (ambas opciones)",
    "items": ["Paquete estándar (vino, cocteles, cerveza, mocktails y refrescos): Q150 por persona",
              "Alternativa sin alcohol (refrescos naturales): Q100 por persona"],
}

CONDICIONES = [
    "Se agrega 15% de servicio sobre el subtotal.",
    "Depósito del 50% para apartar su fecha; saldo al cierre del evento.",
    "Cotización válida por 15 días.",
    "Si los invitados eligen distintos menús el día del evento, el depósito se calcula "
    "al precio premium y se ajusta en el restaurante.",
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
    canvas.drawRightString(w - 2 * cm, h - 1.7 * cm, "COTIZACIÓN DE EVENTO")
    # footer
    canvas.setFillColor(VERDE)
    canvas.circle(2 * cm, 1.35 * cm, 0.09 * cm, stroke=0, fill=1)
    canvas.setFillColor(NEGRO)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2.3 * cm, 1.25 * cm, CONTACTO)
    canvas.drawRightString(w - 2 * cm, 1.25 * cm, "Página %d" % doc.page)
    canvas.restoreState()

def tabla_precios(opcion):
    filas = [["Concepto", "Precio", "Cant.", "Subtotal"]]
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
              ["", "", "Servicio 15%", q(servicio)],
              ["", "", "TOTAL", q(total)],
              ["", "", "Depósito 50% (reserva)", q(deposito)],
              ["", "", "Saldo al cierre", q(total - deposito)],
              ["", "", "Equivalente por persona", q(total / PERSONAS)]]
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
    el.append(Paragraph("Cotización de Evento Privado", S["titulo"]))
    el.append(Paragraph(CFG["subtitulo"], S["sub"]))

    datos = Table([["Cliente", CFG["cliente"]], ["Evento", CFG["evento"]],
                   ["Fecha", CFG["fecha"]], ["Personas", str(PERSONAS)],
                   ["Espacio", CFG["espacio"]]],
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
    el.append(Paragraph("Hola %s," % CFG["saludo_nombre"], S["body"]))
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
        bloque = [Paragraph("Detalle de precios. Opción %s" % letra, S["precio_lbl"]),
                  tabla_precios(op)]
        if op.get("nota"):
            bloque.append(Paragraph(op["nota"], S["nota"]))
        el.append(KeepTogether(bloque))

    # Bebidas: se omite por completo cuando BEBIDAS = None (Opcion C sola).
    if BEBIDAS:
        el.append(Paragraph(BEBIDAS["titulo"], S["h2"]))
        el.append(Paragraph(TEXTOS["entrada_bebidas"], S["body"]))
        for it in BEBIDAS["items"]:
            el.append(Paragraph("· " + it, S["body"]))

    el.append(Paragraph("Términos y Aceptación", S["h2"]))
    el.append(Paragraph(TEXTOS["entrada_terminos"], S["body"]))
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
                    ["Por Rosanta", "Por el Cliente"]],
                   colWidths=[8 * cm, 8 * cm])
    lineas.setStyle(TableStyle([
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (0, 2), (-1, 2), VERDE),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
    ]))
    el.append(KeepTogether([lineas, Spacer(1, 14),
                            Paragraph(TEXTOS["cierre"], S["body"])]))
    doc.build(el)
    print("PDF generado:", CFG["salida_nombre"])
    agregar_portada()


def agregar_portada():
    """Antepone la portada + 'Por que Rosanta' al PDF ya generado."""
    if not PORTADA:
        print("AVISO: PORTADA = None, la cotizacion sale SIN portada. "
              "Solo para borradores internos.")
        return
    try:
        from portada import anteponer_portada
    except ImportError as e:
        print("ERROR: no se pudo importar portada.py (%s). "
              "Copiar portada.py, plantillas/ y fuentes/ junto al script "
              "e instalar pymupdf: pip install pymupdf --break-system-packages" % e)
        return
    pcfg = dict(PORTADA_CFG)
    linea = pcfg.pop("linea_datos", None)
    pcfg["personas"] = pcfg.get("personas") or PERSONAS
    ruta = os.path.join(os.getcwd(), CFG["salida_nombre"])
    anteponer_portada(ruta, plantilla=PORTADA, linea_datos=linea, **pcfg)
    print("Portada '%s' agregada:" % PORTADA, CFG["salida_nombre"])


if __name__ == "__main__":
    construir()
