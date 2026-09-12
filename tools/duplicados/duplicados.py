#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Duplicados reales — Rosanta OS + Dev/Rosanta

Hashea por contenido (md5) y reporta los grupos idénticos, ordenados por
espacio recuperable. NO MUEVE NADA: solo escribe el reporte.

Uso:
    python3 duplicados.py
    python3 duplicados.py --salida /ruta/reporte.md
"""

import argparse
import datetime as dt
import hashlib
import os
from collections import defaultdict

HOME = os.path.expanduser("~")
DRIVE = os.path.join(HOME, "My Drive", "Rosanta OS")
DEV = os.path.join(HOME, "Dev", "Rosanta")
AUDITORIAS = os.path.join(DRIVE, "00_Admin", "Auditorias")

IGNORA_NOMBRE = {".DS_Store", "Icon", "Icon\r", ".localized", "desktop.ini"}
IGNORA_DIR = {".git", "node_modules", "_Archive"}

# Carpetas o nombres que delatan una copia de trabajo, no el original.
PISTAS_COPIA = ("_bak", "backup", "backups", "_old", "copia de", "copy of",
                " copia", " copy", "duplicados", "zz_archivo", "_migracion",
                "respaldo", "sin titulo", "untitled")
# Los `Historico_*` son los volcados de la migración: hogar de paso, no destino.
PISTA_HISTORICO = "historico"


def ignorar(nombre):
    return (nombre in IGNORA_NOMBRE or nombre.startswith("._")
            or nombre.startswith("Icon\r"))


def listar(raices):
    salida = []
    for raiz in raices:
        for dirpath, dirnames, filenames in os.walk(raiz, followlinks=False):
            dirnames[:] = [d for d in dirnames
                           if d not in IGNORA_DIR
                           and not d.startswith(".tmp.drive")]
            for n in filenames:
                if ignorar(n):
                    continue
                p = os.path.join(dirpath, n)
                if os.path.islink(p):
                    continue
                try:
                    tam = os.path.getsize(p)
                except OSError:
                    continue
                if tam == 0:
                    continue
                salida.append((tam, p))
    return salida


def md5(path, bloque=1 << 20):
    h = hashlib.md5()
    try:
        with open(path, "rb") as fh:
            while True:
                b = fh.read(bloque)
                if not b:
                    break
                h.update(b)
    except OSError:
        return None
    return h.hexdigest()


RE_SUFIJO_COPIA = None  # se compila al vuelo abajo


def puntaje_conservar(path):
    """Menor puntaje = mejor candidato a conservar.

    Señales, de más a menos peso:
      1. no parece una copia de trabajo (`_bak`, `Copia de`, `(1)`, `ZZ_ARCHIVO`);
      2. no está en un `Historico_*` (esos son el volcado de la migración);
      3. el código gana si vive en `~/Dev/Rosanta/` (regla 4 del README);
      4. a igualdad, la ruta más específica: la más profunda dentro del pilar;
      5. desempate final: el nombre más corto (sin sufijos de copia).
    """
    import re
    nombre = os.path.basename(path)
    bajo = path.lower()
    p = 0

    if any(x in bajo for x in PISTAS_COPIA):
        p += 200
    if re.search(r"\(\d+\)(\.[A-Za-z0-9]+)?$", nombre):
        p += 200
    if PISTA_HISTORICO in bajo:
        p += 80

    es_codigo = os.path.splitext(path)[1].lower() in (
        ".gs", ".js", ".ts", ".py", ".sh")
    if path.startswith(DEV):
        p -= 60 if es_codigo else 10
    elif path.startswith(DRIVE) and es_codigo:
        p += 60  # código en Drive: nunca es el original

    base = DRIVE if path.startswith(DRIVE) else DEV
    profundidad = os.path.relpath(path, base).count(os.sep)
    p -= min(profundidad, 8) * 2

    p += len(nombre) / 100.0
    return p


def etiqueta(path):
    if path.startswith(DRIVE):
        return "Drive: " + os.path.relpath(path, DRIVE)
    if path.startswith(DEV):
        return "Dev: " + os.path.relpath(path, DEV)
    return path


def humano(n):
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024 or u == "GB":
            return "%.0f %s" % (n, u) if u == "B" else "%.1f %s" % (n, u)
        n /= 1024.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=None)
    args = ap.parse_args()

    archivos = listar([DRIVE, DEV])

    # prefiltro por tamaño: solo se hashea lo que puede colisionar
    por_tam = defaultdict(list)
    for tam, p in archivos:
        por_tam[tam].append(p)
    candidatos = [p for tam, ps in por_tam.items() if len(ps) > 1 for p in ps]

    por_hash = defaultdict(list)
    for p in candidatos:
        h = md5(p)
        if h:
            por_hash[h].append(p)

    grupos = []
    for h, ps in por_hash.items():
        if len(ps) < 2:
            continue
        tam = os.path.getsize(ps[0])
        recuperable = tam * (len(ps) - 1)
        ordenados = sorted(ps, key=puntaje_conservar)
        grupos.append((recuperable, tam, h, ordenados))
    grupos.sort(reverse=True)

    total_rec = sum(g[0] for g in grupos)
    total_dup = sum(len(g[3]) - 1 for g in grupos)

    hoy = dt.date.today().isoformat()
    L = []
    L.append("# Duplicados por contenido — Rosanta OS + Dev/Rosanta")
    L.append("**Corrida:** %s" % hoy)
    L.append("")
    L.append("Comparación por **contenido** (md5), no por nombre. "
             "Ignorados: `.DS_Store`, `Icon`, `._*`, `.git/`, `node_modules/`, "
             "`_Archive/` y los archivos de 0 bytes.")
    L.append("")
    L.append("**Este reporte no movió nada.** El *conservar* es una "
             "recomendación automática, no un veredicto: pierde la ruta que "
             "huele a copia (`_bak`, `Copia de`, `(1)`, `ZZ_ARCHIVO`) y la que "
             "está en un `Historico_*`; a igualdad gana la ruta más profunda "
             "dentro del pilar. Donde las dos rutas son legítimas —el mismo PDF "
             "archivado en dos pilares con sentido— hay que mirarlo a ojo.")
    L.append("")
    L.append("| | |")
    L.append("|---|---:|")
    L.append("| Archivos revisados | %d |" % len(archivos))
    L.append("| Hasheados (colisión de tamaño) | %d |" % len(candidatos))
    L.append("| Grupos con contenido idéntico | %d |" % len(grupos))
    L.append("| Archivos sobrantes | %d |" % total_dup)
    L.append("| Espacio recuperable | **%s** |" % humano(total_rec))
    L.append("")
    # Cruce: código que está en Drive y ya existe idéntico en Dev.
    EXT_CODIGO = {".gs", ".js", ".ts", ".py", ".sh", ".html", ".json"}
    cruce = []
    for rec, tam, h, ps in grupos:
        if not any(os.path.splitext(p)[1].lower() in EXT_CODIGO for p in ps):
            continue
        en_drive = [p for p in ps if p.startswith(DRIVE)]
        en_dev = [p for p in ps if p.startswith(DEV)]
        if en_drive and en_dev:
            cruce.append((en_drive, en_dev))
    if cruce:
        n = sum(len(d) for d, _ in cruce)
        L.append("## Código en Drive que ya existe idéntico en Dev — %d archivos"
                 % n)
        L.append("")
        L.append("El cruce más accionable del reporte: rompen la regla 4 del "
                 "README y el original ya está a salvo en `~/Dev/Rosanta/`. "
                 "Archivarlos no pierde nada.")
        L.append("")
        for en_drive, en_dev in cruce:
            for p in en_drive:
                L.append("- `%s`" % etiqueta(p))
            for q in en_dev:
                L.append("  - idéntico a `%s`" % etiqueta(q))
        L.append("")

    L.append("## Grupos, de mayor a menor espacio recuperable")
    L.append("")

    for i, (rec, tam, h, ps) in enumerate(grupos, 1):
        L.append("### %d. %s recuperables · %d copias · %s c/u"
                 % (i, humano(rec), len(ps), humano(tam)))
        L.append("")
        L.append("`md5 %s`" % h)
        L.append("")
        L.append("- **conservar** → `%s`" % etiqueta(ps[0]))
        for p in ps[1:]:
            L.append("- archivar → `%s`" % etiqueta(p))
        L.append("")

    L.append("---")
    L.append("")
    L.append("**%d grupos · %d archivos sobrantes · %s recuperables**"
             % (len(grupos), total_dup, humano(total_rec)))
    L.append("")

    destino = args.salida or os.path.join(AUDITORIAS, "%s_Duplicados.md" % hoy)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))

    print("Reporte: %s" % destino)
    print("%d grupos · %d archivos sobrantes · %s recuperables"
          % (len(grupos), total_dup, humano(total_rec)))


if __name__ == "__main__":
    main()
