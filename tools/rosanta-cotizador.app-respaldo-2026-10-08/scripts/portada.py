# -*- coding: utf-8 -*-
"""
Rosanta · Portada + página "Por qué Rosanta" para las cotizaciones de evento.

Toma la plantilla de 2 páginas diseñada en Canva (plantillas/portada_eventos.pdf
o plantillas/portada_boda.pdf), reemplaza ÚNICAMENTE el bloque de datos del
cliente de la página 1 (título del evento, "Preparada para ...", y la línea
fecha · personas · espacio) y deja el resto del diseño intacto.

Uso desde rosanta_cotizador.py:

    from portada import anteponer_portada
    anteponer_portada(
        cotizacion_pdf="Cotizacion_Rosanta_X.pdf",
        plantilla="eventos",              # "eventos" | "boda"
        evento="Cena de Aniversario",
        cliente="Familia Herrera",
        fecha="14 de noviembre, 2026",
        personas=40,
        espacio="Jardín",
    )

Requisitos: pymupdf (pip install pymupdf --break-system-packages)
"""

import os

import pymupdf

# ---------------------------------------------------------------- constantes
_DIR = os.path.dirname(os.path.abspath(__file__))
PLANTILLAS = os.path.join(_DIR, "plantillas")
FUENTES = os.path.join(_DIR, "fuentes")

SERIF = os.path.join(FUENTES, "PlayfairDisplay-Regular.ttf")   # títulos
SANS = os.path.join(FUENTES, "Lato-Regular.ttf")               # datos del cliente

VERDE = (0x4E / 255, 0x6D / 255, 0x5A / 255)   # Verde Bosque
NEGRO = (0, 0, 0)

# Geometría medida sobre las plantillas del 7 ago 2026 (612 x 792 pt, origen arriba-izq.).
# Si Juanma entrega plantillas nuevas, volver a medir: el bloque blanco tiene que quedar
# entre la etiqueta "COTIZACIÓN DE EVENTO" (tinta hasta y=649.5) y la coordenada
# "14° N · 91° W" (tinta desde y=738.5).
CENTRO_X = 306.0
BLOQUE = pymupdf.Rect(30, 653.5, 582, 737.5)   # zona blanca que se repinta
TITULO_BASELINE = 688.0
TITULO_SIZE = 22.8
TITULO_ANCHO_MAX = 440.0
LINEA1_BASELINE = 714.0
LINEA1_SIZE = 10.5
LINEA2_BASELINE = 732.75
LINEA2_SIZE = 9.49
LINEA_ANCHO_MAX = 470.0


def _ancho(texto, fontfile, size):
    f = pymupdf.Font(fontfile=fontfile)
    return f.text_length(texto, fontsize=size)


def _centrado(page, texto, fontfile, fontname, size, baseline, color, ancho_max):
    """Escribe una línea centrada, reduciendo el tamaño si no cabe."""
    if not texto:
        return
    while size > 7 and _ancho(texto, fontfile, size) > ancho_max:
        size -= 0.25
    x = CENTRO_X - _ancho(texto, fontfile, size) / 2.0
    page.insert_text(
        (x, baseline), texto,
        fontfile=fontfile, fontname=fontname, fontsize=size, color=color,
    )


def generar_portada(salida, plantilla="eventos", evento="Cotización de Evento",
                    cliente="", fecha="", personas=None, espacio="Jardín",
                    linea_datos=None):
    """Genera el PDF de 2 páginas (portada + 'Por qué Rosanta') personalizado."""
    ruta = os.path.join(PLANTILLAS, f"portada_{plantilla}.pdf")
    if not os.path.exists(ruta):
        raise FileNotFoundError(
            f"No existe la plantilla {ruta}. Las plantillas oficiales son "
            f"portada_eventos.pdf y portada_boda.pdf."
        )
    for f in (SERIF, SANS):
        if not os.path.exists(f):
            raise FileNotFoundError(f"Falta la fuente {f}.")

    doc = pymupdf.open(ruta)
    page = doc[0]

    # 1. borrar el bloque variable (el fondo ahí es blanco puro)
    page.draw_rect(BLOQUE, color=None, fill=(1, 1, 1), overlay=True)

    # 2. reescribir
    _centrado(page, evento, SERIF, "PlayfairDisplay", TITULO_SIZE,
              TITULO_BASELINE, VERDE, TITULO_ANCHO_MAX)

    if cliente:
        _centrado(page, f"Preparada para {cliente}", SANS, "LatoRegular",
                  LINEA1_SIZE, LINEA1_BASELINE, NEGRO, LINEA_ANCHO_MAX)

    if linea_datos is None:
        partes = [p for p in (fecha,
                              f"{personas} personas" if personas else "",
                              espacio) if p]
        linea_datos = " · ".join(partes)
    if linea_datos:
        _centrado(page, linea_datos, SANS, "LatoRegular", LINEA2_SIZE,
                  LINEA2_BASELINE, NEGRO, LINEA_ANCHO_MAX)

    doc.save(salida, garbage=3, deflate=True)
    doc.close()
    return salida


def anteponer_portada(cotizacion_pdf, salida=None, **kwargs):
    """Genera la portada y la pega delante del PDF de la cotización."""
    salida = salida or cotizacion_pdf
    tmp = cotizacion_pdf + ".portada.tmp.pdf"
    generar_portada(tmp, **kwargs)

    final = pymupdf.open(tmp)
    cot = pymupdf.open(cotizacion_pdf)
    final.insert_pdf(cot)
    cot.close()
    final.save(salida, garbage=3, deflate=True)
    final.close()
    os.remove(tmp)
    return salida


if __name__ == "__main__":
    generar_portada(
        "prueba_portada.pdf", plantilla="eventos",
        evento="Cena de Aniversario", cliente="Familia Herrera",
        fecha="14 de noviembre, 2026", personas=40, espacio="Jardín",
    )
    print("OK -> prueba_portada.pdf")
