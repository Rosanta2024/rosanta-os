# -*- coding: utf-8 -*-
"""
Rosanta · Cotizacion de Evento (v3, ago 2026)
Corrige la muestra de Design: logo oficial incrustado como imagen, titulares
en serif de marca EN MAYUSCULAS, y los textos finales aprobados.

Editar solo el bloque CONFIGURACION. Ejecutar: python3 rosanta_cotizacion_final.py
Assets requeridos junto al script:
  logo_verde.png, logo_blanco.png, Firma_Rosanta_VF.png,
  img-000.jpg (portada), img-001/002/003.jpg (pagina 2),
  Playfair-400.ttf, Playfair-700.ttf, Poppins-*.ttf

TIPOGRAFIA: los titulares deben ir en PESKIA. Peskia no esta disponible en este
entorno, asi que se usa Playfair Display, el fallback aprobado en la guia de marca.
Para la version de produccion, sustituir Playfair-400/700.ttf por los archivos de
PESKIA y cambiar TITULAR_TTF/TITULAR_TTF_BOLD. Nada mas cambia.
"""
import math, os, sys

# ============================ CONFIGURACION ============================
PERSONAS = 30

CFG = {
    "cliente": "María Fernanda López",
    "evento": "Cena de Aniversario",
    "fecha": "Sábado 14 de noviembre de 2026",
    "espacio": "Jardín de Rosanta",
    "subtitulo": "Cena de aniversario · Jardín de Rosanta",
    "saludo_nombre": "María Fernanda",
    "preparada_para": "Preparada para María Fernanda López",
    "linea_datos": "Sábado 14 de noviembre de 2026  ·  30 personas  ·  Jardín de Rosanta",
    "intro": ("Una fecha así merece más que un salón: merece un jardín. Esta propuesta "
              "reúne menú, espacio y precios, pensada para que su único pendiente sea "
              "llegar a celebrar."),
    "cierre": ("Ustedes eligen la fecha y llegan a celebrar; el jardín hace el resto. "
               "La mejor mesa es la sobremesa, y la suya ya tiene fecha."),
    "salida_nombre": "MUESTRA_Cotizacion_Rosanta_FINAL.pdf",
}

# --- Pagina "Por que Rosanta" (textos finales aprobados) ---
PORQUE = {
    "titulo": "POR QUÉ ROSANTA",
    "intro": ("Un jardín en el corazón de Antigua, cocina natural de temporada y una barra "
              "donde el coctel se sienta a la mesa. Las celebraciones que empiezan aquí se "
              "quedan a vivir la sobremesa."),
    "bloques": [
        ("01", "El jardín es suyo",
         "El jardín se prepara para ustedes: pérgola, mesas y chimenea listas para su "
         "evento. Tres horas de servicio con el alquiler incluido. Cada rincón trabaja "
         "para su celebración."),
        ("02", "Del huerto al maridaje",
         "La carta la deciden el huerto y la temporada. Verduras cortadas el mismo día y "
         "un coctel que hace pareja con cada plato, de igual a igual. Cocina natural, de "
         "productores que conocemos por su nombre."),
        ("03", "Cuidado en cada detalle",
         "Un equipo que recibe, sirve y acompaña el ritmo de la mesa, para que su única "
         "tarea sea brindar. Del jardín a su mesa, con la calma que una celebración de "
         "verdad merece."),
    ],
    "frase": "La mejor mesa es la sobremesa.",
    "fotos": ["img-001.jpg", "img-002.jpg", "img-003.jpg"],
}

FOTO_PORTADA = "img-000.jpg"

OPCIONES = [
    {
        "titulo": "OPCIÓN ÚNICA. ESTILO ROSANTA (PARA COMPARTIR)",
        "descripcion": "Entrantes al centro para compartir y fuerte individual.",
        "menus": [
            {"titulo": "Entrantes para compartir",
             "platos": ["Carpaccio", "Pulpo", "Queso horneado", "Tabla de jamones y quesos"]},
            {"titulo": "Fuerte (elección individual)",
             "platos": ["Lomito en salsa de puerros", "Pesca del día"]},
        ],
        "lineas": [("Entrantes para compartir (1 por cada 3 invitados)", 160, "porcada3"),
                   ("Fuerte con postre", 260, "personas")],
        "nota": ("Los entrantes se comparten y se cobran por plato (1 por cada 3 invitados); "
                 "el fuerte va por persona."),
    },
]

# Bloque listo para pegar dentro de OPCIONES cuando el cliente pida formato de pie.
# Regla de negocio: va SIEMPRE de ultima y jamas abre la conversacion.
# Pendiente: sustituir la lista de tapas por las piezas reales que confirme Juanma.
OPCION_C_TAPAS = {
    "titulo": "OPCIÓN C. TAPAS GUATEMALTECAS Y BARRA LIBRE",
    "descripcion": ("La celebración de pie. Bocados guatemaltecos que circulan entre sus "
                    "invitados y una barra abierta durante todo el servicio, para brindar, "
                    "conversar y moverse por el jardín a su ritmo."),
    "menus": [
        {"titulo": "Tapas guatemaltecas (6 piezas por persona)",
         "platos": ["(pieza real por confirmar)", "(pieza real por confirmar)",
                    "(pieza real por confirmar)", "(pieza real por confirmar)",
                    "(pieza real por confirmar)", "(pieza real por confirmar)"]},
        {"titulo": "Barra libre",
         "platos": ["Cocteles de temporada, vino, cerveza y mocktails, servidos durante "
                    "las tres horas del evento."]},
    ],
    "lineas": [("Tapas guatemaltecas (6 piezas por persona)", 150, "personas"),
               ("Barra libre", 200, "personas")],
    "nota": ("Las tapas se sirven por persona (6 piezas). La barra queda abierta durante "
             "las tres horas de servicio."),
}

# Poner en False cuando la unica opcion cotizada sea la C: la barra libre ya
# lleva las bebidas incluidas y esta seccion duplicaria el cobro.
MOSTRAR_BEBIDAS = True

BEBIDAS = {
    "titulo": "BEBIDAS INCLUIDAS",
    "intro": "La barra acompaña del brindis a la sobremesa:",
    "items": ["Paquete estándar (vino, cocteles, cerveza, mocktails y refrescos): Q150 por persona",
              "Alternativa sin alcohol (refrescos naturales): Q100 por persona"],
}

TERMINOS = {
    "titulo": "TÉRMINOS Y ACEPTACIÓN",
    "intro": "Lo importante, claro y por escrito:",
    "items": [
        "Se agrega 15% de servicio sobre el subtotal.",
        "Depósito del 50% para apartar su fecha; saldo al cierre del evento.",
        "Cotización válida por 15 días.",
        "Si los invitados eligen distintos menús el día del evento, el depósito se calcula "
        "al precio premium y se ajusta en el restaurante.",
    ],
}

CONTACTO = "Rosanta · Cocina con Carisma · Antigua Guatemala · restaurante@rosanta.rest"

TITULAR_TTF      = "Playfair-400.ttf"   # <- sustituir por PESKIA regular en produccion
TITULAR_TTF_BOLD = "Playfair-700.ttf"   # <- sustituir por PESKIA bold en produccion
# ========================= FIN CONFIGURACION ==========================

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, Image, KeepTogether,
                                PageBreak, NextPageTemplate)

VERDE  = HexColor("#4E6D5A")
LILA   = HexColor("#AEAAE2")
MORADO = HexColor("#8A7FA6")
CREMA  = HexColor("#F2EEEB")
NEGRO  = HexColor("#000000")
GRIS   = HexColor("#3A3A3A")

BASE = os.path.dirname(os.path.abspath(__file__))
P = lambda n: os.path.join(BASE, n)

# ---------- tipografia ----------
def registrar_fuentes():
    faltan = []
    pares = [("Titular", TITULAR_TTF), ("Titular-Bold", TITULAR_TTF_BOLD),
             ("Cuerpo", "Poppins-Light.ttf"), ("Cuerpo-Bold", "Poppins-Medium.ttf"),
             ("Cuerpo-Reg", "Poppins-Regular.ttf"), ("Cuerpo-It", "Poppins-Italic.ttf")]
    for nombre, archivo in pares:
        ruta = P(archivo)
        if not os.path.exists(ruta):
            faltan.append(archivo); continue
        pdfmetrics.registerFont(TTFont(nombre, ruta))
    if faltan:
        print("ERROR: faltan fuentes: %s" % ", ".join(faltan), file=sys.stderr)
        sys.exit(1)
    if "PESKIA" not in TITULAR_TTF.upper():
        print("AVISO: titulares en %s (fallback aprobado). Sustituir por PESKIA "
              "para la version de produccion." % TITULAR_TTF)

def q(n):
    return "Q{:,.2f}".format(n)

def cantidad_de(spec):
    if spec == "personas":
        return PERSONAS
    if spec == "porcada3":
        return math.ceil(PERSONAS / 3)
    return int(spec)

def preparar_firma():
    src = P("Firma_Rosanta_VF.png")
    if not os.path.exists(src):
        print("WARNING: falta Firma_Rosanta_VF.png. El PDF ira sin firma.", file=sys.stderr)
        return None
    try:
        from PIL import Image as PImage, ImageChops
        im = PImage.open(src).convert("RGB")
        bg = PImage.new("RGB", im.size, (255, 255, 255))
        bbox = ImageChops.difference(im, bg).getbbox()
        if bbox:
            im = im.crop(bbox)
        out = "/tmp/firma_crop.png"
        im.save(out)
        return out
    except Exception as e:
        print("WARNING: no se pudo recortar la firma (%s)." % e, file=sys.stderr)
        return src

def logo(canvas, archivo, x, y, ancho, anclaje="left"):
    """Dibuja el logo oficial (PNG) conservando proporcion. Nunca texto."""
    ruta = P(archivo)
    if not os.path.exists(ruta):
        print("ERROR: falta el logo %s. El wordmark JAMAS se escribe con texto." % archivo,
              file=sys.stderr)
        sys.exit(1)
    img = ImageReader(ruta)
    iw, ih = img.getSize()
    alto = ancho * ih / iw
    if anclaje == "center":
        x = x - ancho / 2.0
    canvas.drawImage(img, x, y, width=ancho, height=alto, mask="auto")
    return alto

def flor(canvas, cx, cy, r=0.115 * cm, sep=0.15 * cm, color=LILA):
    """Flor de 4 petalos, elemento grafico firma."""
    canvas.saveState()
    canvas.setFillColor(color)
    for dx, dy in ((-sep, 0), (sep, 0), (0, -sep), (0, sep)):
        canvas.circle(cx + dx, cy + dy, r, stroke=0, fill=1)
    canvas.restoreState()

def _ancho(texto, fuente, tam, tracking):
    a = pdfmetrics.stringWidth(texto, fuente, tam)
    if tracking and len(texto) > 1:
        a += tracking * (len(texto) - 1)
    return a

def texto_track(canvas, texto, x, y, fuente, tam, color, tracking=0.0, alineacion="left"):
    """Dibuja texto con tracking (letter-spacing). alineacion: left|center|right."""
    a = _ancho(texto, fuente, tam, tracking)
    if alineacion == "center":
        x = x - a / 2.0
    elif alineacion == "right":
        x = x - a
    # saveState/restoreState: el charSpace se queda pegado en el canvas y
    # contamina los Paragraph que se dibujen despues.
    canvas.saveState()
    t = canvas.beginText(x, y)
    t.setFont(fuente, tam)
    t.setFillColor(color)
    t.setCharSpace(tracking)
    t.textOut(texto)
    canvas.drawText(t)
    canvas._charSpace = 0
    canvas.restoreState()

def texto_centrado(canvas, texto, y, fuente, tam, color, tracking=0.0):
    texto_track(canvas, texto, letter[0] / 2.0, y, fuente, tam, color,
                tracking, alineacion="center")

# ---------- estilos ----------
S = {
    "h1":   ParagraphStyle("h1", fontName="Titular-Bold", fontSize=21, textColor=VERDE,
                           leading=25, spaceAfter=3),
    "sub":  ParagraphStyle("sub", fontName="Cuerpo", fontSize=10.5, textColor=MORADO,
                           spaceAfter=11, leading=14),
    "h2":   ParagraphStyle("h2", fontName="Titular-Bold", fontSize=13.5, textColor=VERDE,
                           spaceBefore=11, spaceAfter=4, leading=16),
    "h3":   ParagraphStyle("h3", fontName="Cuerpo-Bold", fontSize=10.5, textColor=NEGRO,
                           spaceBefore=7, spaceAfter=1, leading=13.5),
    "body": ParagraphStyle("body", fontName="Cuerpo", fontSize=9.8, textColor=GRIS,
                           leading=13.6, alignment=TA_LEFT),
    "body2":ParagraphStyle("body2", fontName="Cuerpo", fontSize=9.5, textColor=GRIS,
                           leading=13.4, alignment=TA_LEFT),
    "nota": ParagraphStyle("nota", fontName="Cuerpo-It", fontSize=8.3, textColor=MORADO,
                           leading=11.5, spaceBefore=4),
    "plbl": ParagraphStyle("plbl", fontName="Cuerpo-Bold", fontSize=9.5, textColor=MORADO,
                           spaceBefore=7, spaceAfter=3),
    "colnum": ParagraphStyle("colnum", fontName="Cuerpo-Bold", fontSize=8.5,
                             textColor=HexColor("#57A77F"), spaceAfter=1),
    "coltit": ParagraphStyle("coltit", fontName="Cuerpo-Bold", fontSize=10,
                             textColor=NEGRO, spaceAfter=4, leading=13),
}

# ======================= PAGINA 1 · PORTADA =======================
def portada(canvas, doc):
    canvas.saveState()
    w, h = letter
    # foto a sangre en la mitad superior
    foto_h = h * 0.575
    img = ImageReader(P(FOTO_PORTADA))
    iw, ih = img.getSize()
    escala = max(w / iw, foto_h / ih)
    dw, dh = iw * escala, ih * escala
    canvas.saveState()
    pth = canvas.beginPath()
    pth.rect(0, h - foto_h, w, foto_h)
    canvas.clipPath(pth, stroke=0, fill=0)
    canvas.drawImage(img, (w - dw) / 2.0, h - foto_h - (dh - foto_h) / 2.0,
                     width=dw, height=dh, mask=None)
    canvas.restoreState()
    # filete lila bajo la foto
    canvas.setFillColor(LILA)
    canvas.rect(0, h - foto_h - 0.11 * cm, w, 0.11 * cm, stroke=0, fill=1)

    y = h - foto_h - 2.55 * cm
    logo(canvas, "logo_verde.png", w / 2.0, y, 5.2 * cm, anclaje="center")
    y -= 0.68 * cm
    texto_centrado(canvas, "COCINA CON CARISMA", y, "Cuerpo", 7.5, VERDE, tracking=2.2)
    y -= 1.15 * cm
    flor(canvas, w / 2.0, y)
    y -= 1.05 * cm
    texto_centrado(canvas, "COTIZACIÓN DE EVENTO", y, "Cuerpo", 7.5, MORADO, tracking=2.4)
    y -= 1.25 * cm
    texto_centrado(canvas, CFG["evento"].upper(), y, "Titular-Bold", 21, VERDE, tracking=1.2)
    y -= 0.95 * cm
    texto_centrado(canvas, CFG["preparada_para"], y, "Cuerpo", 9.5, GRIS)
    y -= 0.58 * cm
    texto_centrado(canvas, CFG["linea_datos"], y, "Cuerpo", 9, GRIS)

    texto_centrado(canvas, "14° N · 91° W", 1.9 * cm, "Cuerpo", 7.5, MORADO, tracking=1.6)
    canvas.restoreState()

# =================== PAGINA 2 · POR QUE ROSANTA ===================
def pagina_porque(canvas, doc):
    canvas.saveState()
    w, h = letter
    m = 2.1 * cm
    ancho = w - 2 * m

    logo(canvas, "logo_verde.png", m, h - 2.1 * cm, 3.0 * cm)
    texto_track(canvas, "14° N · 91° W", w - m, h - 2.0 * cm, "Cuerpo", 7.5, MORADO,
                tracking=1.4, alineacion="right")

    y = h - 3.5 * cm
    p = Paragraph(PORQUE["titulo"], ParagraphStyle("t", parent=S["h1"], fontSize=23,
                                                   leading=27))
    pw, ph = p.wrapOn(canvas, ancho, 3 * cm)
    p.drawOn(canvas, m, y - ph)
    y -= ph + 0.45 * cm

    p = Paragraph(PORQUE["intro"], ParagraphStyle("i", parent=S["body"], fontSize=10.2,
                                                  leading=15.5))
    pw, ph = p.wrapOn(canvas, ancho * 0.94, 4 * cm)
    p.drawOn(canvas, m, y - ph)
    y -= ph + 0.9 * cm

    # tres fotos
    gap = 0.42 * cm
    cw = (ancho - 2 * gap) / 3.0
    ch = 6.6 * cm
    for i, f in enumerate(PORQUE["fotos"]):
        x = m + i * (cw + gap)
        img = ImageReader(P(f))
        iw, ih = img.getSize()
        escala = max(cw / iw, ch / ih)
        dw, dh = iw * escala, ih * escala
        canvas.saveState()
        pth = canvas.beginPath(); pth.rect(x, y - ch, cw, ch)
        canvas.clipPath(pth, stroke=0, fill=0)
        canvas.drawImage(img, x - (dw - cw) / 2.0, y - ch - (dh - ch) / 2.0,
                         width=dw, height=dh, mask=None)
        canvas.restoreState()
    y -= ch + 0.85 * cm

    # tres columnas de texto
    for i, (num, titulo, cuerpo) in enumerate(PORQUE["bloques"]):
        x = m + i * (cw + gap)
        yy = y
        ph_head = 0
        head = Paragraph('<font color="#57A77F">%s</font>&nbsp;&nbsp;%s' % (num, titulo),
                         S["coltit"])
        pw, ph_head = head.wrapOn(canvas, cw, 2 * cm)
        head.drawOn(canvas, x, yy - ph_head)
        body = Paragraph(cuerpo, S["body2"])
        pw, ph_b = body.wrapOn(canvas, cw, 6 * cm)
        body.drawOn(canvas, x, yy - ph_head - 0.18 * cm - ph_b)

    # cierre
    flor(canvas, w / 2.0, 6.1 * cm)
    canvas.setFont("Titular", 13)
    canvas.setFillColor(MORADO)
    canvas.drawCentredString(w / 2.0, 5.2 * cm, PORQUE["frase"])

    # pie
    canvas.setFont("Cuerpo", 7.5)
    canvas.setFillColor(GRIS)
    canvas.drawCentredString(w / 2.0, 1.6 * cm, "Rosanta  ·  Cocina con Carisma")
    canvas.restoreState()

# =============== PAGINAS 3-4 · COTIZACION (header/footer) ===============
def encabezado_footer(canvas, doc):
    canvas.saveState()
    w, h = letter
    canvas.setFillColor(VERDE)
    canvas.rect(0, h - 2.6 * cm, w, 2.6 * cm, stroke=0, fill=1)
    canvas.setFillColor(LILA)
    canvas.rect(0, h - 2.75 * cm, w, 0.15 * cm, stroke=0, fill=1)
    logo(canvas, "logo_blanco.png", 2 * cm, h - 1.62 * cm, 3.1 * cm)
    texto_track(canvas, "COCINA CON CARISMA", 2 * cm, h - 2.12 * cm, "Cuerpo", 7.5,
                white, tracking=1.3)
    texto_track(canvas, "COTIZACIÓN DE EVENTO", w - 2 * cm, h - 1.72 * cm, "Cuerpo", 7.5,
                white, tracking=1.3, alineacion="right")
    # footer
    flor(canvas, 2.15 * cm, 1.33 * cm, r=0.07 * cm, sep=0.095 * cm, color=VERDE)
    canvas.setFillColor(GRIS)
    canvas.setFont("Cuerpo", 7.5)
    canvas.drawString(2.65 * cm, 1.25 * cm, CONTACTO)
    canvas.drawRightString(w - 2 * cm, 1.25 * cm, "Página %d" % (doc.page - 2))
    canvas.restoreState()

def tabla_precios(opcion):
    filas = [["Concepto", "Precio", "Cant.", "Subtotal"]]
    subtotal = 0.0
    for concepto, precio, cant_spec in opcion["lineas"]:
        cant = cantidad_de(cant_spec)
        sub = precio * cant
        subtotal += sub
        filas.append([Paragraph(concepto, S["body2"]), q(precio), str(cant), q(sub)])
    servicio = round(subtotal * 0.15, 2)
    total = subtotal + servicio
    deposito = round(total * 0.50, 2)
    filas += [["", "", "Subtotal", q(subtotal)],
              ["", "", "Servicio 15%", q(servicio)],
              ["", "", "TOTAL", q(total)],
              ["", "", "Depósito 50% (reserva)", q(deposito)],
              ["", "", "Saldo al cierre", q(total - deposito)],
              ["", "", "Equivalente por persona", q(total / PERSONAS)]]
    t = Table(filas, colWidths=[9.4 * cm, 2.3 * cm, 2.6 * cm, 2.7 * cm])
    n = len(opcion["lineas"])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), VERDE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Cuerpo-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Cuerpo"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.8),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, n), [white, CREMA]),
        ("LINEABOVE", (2, n + 1), (-1, n + 1), 0.75, LILA),
        ("FONTNAME", (2, n + 3), (-1, n + 3), "Cuerpo-Bold"),
        ("TEXTCOLOR", (2, n + 3), (-1, n + 3), VERDE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.1),
        ("TOPPADDING", (0, 0), (-1, -1), 3.1),
    ]))
    return t

def construir():
    registrar_fuentes()
    salida = os.path.join(os.getcwd(), CFG["salida_nombre"])
    doc = BaseDocTemplate(salida, pagesize=letter,
                          leftMargin=2 * cm, rightMargin=2 * cm,
                          topMargin=3.4 * cm, bottomMargin=2.2 * cm,
                          title="Cotización de Evento · Rosanta", author="Rosanta")
    vacio = Frame(0, 0, letter[0], 0.4 * cm, id="vacio",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([
        PageTemplate(id="portada", frames=[vacio], onPage=portada),
        PageTemplate(id="porque",  frames=[vacio], onPage=pagina_porque),
        PageTemplate(id="cotiza",  frames=[frame], onPage=encabezado_footer),
    ])

    el = []
    el.append(NextPageTemplate("porque")); el.append(PageBreak())
    el.append(NextPageTemplate("cotiza")); el.append(PageBreak())

    el.append(Paragraph("COTIZACIÓN DE EVENTO PRIVADO", S["h1"]))
    el.append(Paragraph(CFG["subtitulo"], S["sub"]))

    datos = Table([["Cliente", CFG["cliente"]], ["Evento", CFG["evento"]],
                   ["Fecha", CFG["fecha"]], ["Personas", str(PERSONAS)],
                   ["Espacio", CFG["espacio"]]],
                  colWidths=[3.2 * cm, 13.8 * cm])
    datos.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Cuerpo-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Cuerpo"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), VERDE),
        ("TEXTCOLOR", (1, 0), (1, -1), GRIS),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CREMA, white]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.4), ("TOPPADDING", (0, 0), (-1, -1), 4.4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    el.append(datos)
    el.append(Spacer(1, 12))
    el.append(Paragraph("Hola %s," % CFG["saludo_nombre"], S["body"]))
    el.append(Spacer(1, 5))
    el.append(Paragraph(CFG["intro"], S["body"]))

    unica = len(OPCIONES) == 1
    for i, op in enumerate(OPCIONES):
        el.append(Paragraph(op["titulo"], S["h2"]))
        el.append(Paragraph(op["descripcion"], S["body"]))
        for m in op["menus"]:
            el.append(Paragraph(m["titulo"], S["h3"]))
            for plato in m["platos"]:
                el.append(Paragraph("· " + plato, S["body"]))
        etiqueta = "Detalle de precios" if unica else \
                   "Detalle de precios. Opción %s" % chr(ord("A") + i)
        bloque = [Paragraph(etiqueta, S["plbl"]), tabla_precios(op)]
        if op.get("nota"):
            bloque.append(Paragraph(op["nota"], S["nota"]))
        el.append(KeepTogether(bloque))

    # Bebidas y Terminos van completos: el titulo nunca queda huerfano al pie.
    if MOSTRAR_BEBIDAS:
        bloque_bebidas = [Paragraph(BEBIDAS["titulo"], S["h2"]),
                          Paragraph(BEBIDAS["intro"], S["body"]), Spacer(1, 3)]
        bloque_bebidas += [Paragraph("· " + it, S["body"]) for it in BEBIDAS["items"]]
        el.append(KeepTogether(bloque_bebidas))

    bloque_terminos = [Paragraph(TERMINOS["titulo"], S["h2"]),
                       Paragraph(TERMINOS["intro"], S["body"]), Spacer(1, 3)]
    bloque_terminos += [Paragraph("· " + c, S["body"]) for c in TERMINOS["items"]]
    el.append(KeepTogether(bloque_terminos))
    el.append(Spacer(1, 26))

    firma_path = preparar_firma()
    if firma_path:
        from PIL import Image as PImage
        iw, ih = PImage.open(firma_path).size
        fw = 4.4 * cm
        firma_cell = Image(firma_path, width=fw, height=fw * ih / iw)
    else:
        firma_cell = Spacer(1, 1.4 * cm)
    lineas = Table([[firma_cell, ""],
                    ["_______________________", "_______________________"],
                    ["Por Rosanta", "Por el Cliente"]],
                   colWidths=[8 * cm, 8 * cm])
    lineas.setStyle(TableStyle([
        ("FONTNAME", (0, 1), (-1, -1), "Cuerpo"),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (0, 2), (-1, 2), VERDE),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
    ]))
    el.append(KeepTogether([lineas, Spacer(1, 16),
                            Paragraph(CFG["cierre"], S["body"])]))
    doc.build(el)
    print("PDF generado:", salida)

if __name__ == "__main__":
    construir()
