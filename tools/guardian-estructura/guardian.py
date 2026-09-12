#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Guardián de estructura — Rosanta OS
Valida las reglas del README de `~/My Drive/Rosanta OS/` y reporta violaciones.

Por defecto SOLO REPORTA. Con --fix mueve a `_Archive/` o `_Inbox/`; nunca borra.

Uso:
    python3 guardian.py                  # reporte
    python3 guardian.py --dry-run-fix    # imprime qué movería --fix, sin tocar nada
    python3 guardian.py --fix            # aplica los movimientos seguros
    python3 guardian.py --realias        # repara los alias rotos
    python3 guardian.py --inbox-dias 14  # cambia el umbral de la regla 7
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from collections import defaultdict

HOME = os.path.expanduser("~")
DRIVE = os.path.join(HOME, "My Drive", "Rosanta OS")
PROJECTS = os.path.join(HOME, "Documents", "Claude", "Projects")
CLAUDE_APP = os.path.join(HOME, "Claude")
DEV = os.path.join(HOME, "Dev", "Rosanta")

AUDITORIAS = os.path.join(DRIVE, "00_Admin", "Auditorias")
ARCHIVE = os.path.join(DRIVE, "_Archive")
INBOX = os.path.join(DRIVE, "_Inbox")

# Ruido del sistema de archivos: nunca es una violación.
RUIDO = {".DS_Store", "Icon\r", "Icon", ".localized", "desktop.ini"}

# Regla 1: lo único que puede vivir en la raíz de Rosanta OS.
RAIZ_PERMITIDA = {"README.md"}

# Regla 2: lo único real tolerado dentro de Documents/Claude/Projects.
PROJECTS_EXCEPCIONES = {"_migracion_nube"}

# Regla 3: extensiones que cuentan como código.
EXT_CODIGO_DURO = {".gs", ".js", ".ts", ".py", ".sh"}
EXT_CODIGO_BLANDO = {".html", ".json"}  # a menudo son entregables, no código
EXT_CODIGO = EXT_CODIGO_DURO | EXT_CODIGO_BLANDO

# Regla 5: punteros de Google.
EXT_PUNTERO = {".gdoc": ".docx", ".gsheet": ".xlsx", ".gslides": ".pptx", ".gform": None}

# Regla 6: norma de nombres, vigente desde esta fecha hacia adelante.
FECHA_NORMA = dt.date(2026, 8, 18)
RE_NOMBRE_OK = re.compile(r"^\d{4}-\d{2}-\d{2}_.+?(_v\d+)?\.[A-Za-z0-9]+$")

PILARES = [
    "00_Admin", "01_Business_Fundamentals", "02_Management_OS",
    "03_Finance_Data_OS", "04_Profit_OS", "05_Marketing_OS",
    "06_Expansion_OS", "_Templates", "_Inbox", "_Archive",
]

# Las dos puertas de la raíz: alias a las otras dos capas, para que
# `Rosanta OS/` sea el único árbol que hay que abrir. Son symlinks a propósito
# — el código y la carpeta de la app NO se sincronizan con Drive.
PUERTAS = {
    "_Codigo": os.path.join(HOME, "Dev", "Rosanta"),
    "_App": os.path.join(HOME, "Claude"),
}

CRITICAS = {"R4", "R3"}  # alias roto y código en Drive


class Violacion(object):
    def __init__(self, regla, ruta, detalle="", severidad="menor", fix=None):
        self.regla = regla
        self.ruta = ruta
        self.detalle = detalle
        self.severidad = severidad
        self.fix = fix  # ("archivar"|"inbox", destino) o None


def es_ruido(nombre):
    return nombre in RUIDO or nombre.startswith("Icon\r") or nombre.startswith("._")


def rel(path, base):
    try:
        return os.path.relpath(path, base)
    except ValueError:
        return path


def pilar_de(path):
    r = rel(path, DRIVE)
    return r.split(os.sep)[0] if os.sep in r else "(raíz)"


def caminar(raiz, saltar_archive=True):
    """Recorre `raiz` sin seguir symlinks. Devuelve (dirpath, dirnames, filenames)."""
    for dirpath, dirnames, filenames in os.walk(raiz, followlinks=False):
        dirnames[:] = [
            d for d in dirnames
            if not d.startswith(".tmp.drive")
            and d not in {".git", "node_modules"}
            and not (saltar_archive and os.path.join(dirpath, d) == ARCHIVE)
        ]
        yield dirpath, dirnames, filenames


# --------------------------------------------------------------------------
# Reglas
# --------------------------------------------------------------------------

def regla1_raiz(v):
    """Nada se guarda en la raíz de Rosanta OS."""
    if not os.path.isdir(DRIVE):
        return
    for nombre in sorted(os.listdir(DRIVE)):
        ruta = os.path.join(DRIVE, nombre)
        if es_ruido(nombre) or nombre in RAIZ_PERMITIDA:
            continue
        if nombre in PUERTAS:
            # Las puertas son alias, no carpetas. Que apunten a donde deben lo
            # revisa la regla 4; acá solo se comprueba que no las hayan
            # reemplazado por una carpeta real (que sí se sincronizaría).
            if not os.path.islink(ruta):
                v.append(Violacion(
                    "R1", ruta,
                    "`%s` tiene que ser un alias, no una carpeta real: adentro "
                    "de Drive el código se sincroniza y se corrompe" % nombre,
                    "crítica", None))
            continue
        if os.path.islink(ruta) or os.path.isdir(ruta):
            if nombre not in PILARES:
                v.append(Violacion(
                    "R1", ruta, "carpeta en la raíz que no es un pilar del README",
                    "menor", ("inbox", os.path.join(INBOX, nombre))))
            continue
        v.append(Violacion(
            "R1", ruta, "archivo suelto en la raíz", "menor",
            ("inbox", os.path.join(INBOX, nombre))))


def regla2_projects(v):
    """En Documents/Claude/Projects solo debe haber alias."""
    if not os.path.isdir(PROJECTS):
        return
    for dirpath, dirnames, filenames in os.walk(PROJECTS, followlinks=False):
        r = rel(dirpath, PROJECTS)
        primero = r.split(os.sep)[0] if r != "." else "."
        if primero in PROJECTS_EXCEPCIONES:
            dirnames[:] = []
            continue
        # ¿Esta carpeta real es una "centralita" (contiene al menos un alias)?
        tiene_alias = any(
            os.path.islink(os.path.join(dirpath, n)) for n in dirnames + filenames)
        if dirpath != PROJECTS and not tiene_alias and not dirnames:
            # Solo se reporta: una carpeta vacía acá suele ser un proyecto que la
            # app acaba de crear, y moverla rompe la vinculación. La borra Juanma
            # desde la app, no el guardián. (Salió de la corrida del 2026-09-11.)
            v.append(Violacion(
                "R2", dirpath,
                "carpeta real vacía — si ya no es un proyecto de la app, "
                "borrala desde la app; el guardián no la mueve",
                "menor", None))
        for n in filenames:
            ruta = os.path.join(dirpath, n)
            if es_ruido(n) or os.path.islink(ruta):
                continue
            nota = "archivo real (no alias)"
            if tiene_alias and n in {"LEEME.txt", "README.md", ".probe"}:
                nota = "archivo real, tolerado: nota de la centralita de alias"
                v.append(Violacion("R2", ruta, nota, "informativo", None))
                continue
            v.append(Violacion(
                "R2", ruta, nota, "menor",
                ("inbox", os.path.join(INBOX, n))))


def cargar_excepciones():
    """Rutas (relativas a Rosanta OS) que `--fix` nunca debe archivar.

    Son herramientas vivas que leen datos guardados al lado suyo en Drive:
    moverlas las rompe. Se reportan igual, como aviso, pero sin acción.
    """
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "excepciones.txt")
    if not os.path.exists(p):
        return set()
    salida = set()
    for linea in open(p, encoding="utf-8"):
        linea = linea.split("#")[0].strip()
        if linea:
            salida.add(linea)
    return salida


EXCEPCIONES = cargar_excepciones()


def regla3_codigo_en_drive(v):
    """El código nunca va en Drive."""
    for dirpath, dirnames, filenames in caminar(DRIVE):
        for n in filenames:
            if es_ruido(n):
                continue
            ext = os.path.splitext(n)[1].lower()
            if ext not in EXT_CODIGO:
                continue
            ruta = os.path.join(dirpath, n)
            if rel(ruta, DRIVE) in EXCEPCIONES:
                v.append(Violacion(
                    "R3", ruta,
                    "herramienta viva: lee datos de al lado. En la lista de "
                    "excepciones; --fix no la toca", "informativo", None))
                continue
            if ext in EXT_CODIGO_DURO:
                v.append(Violacion(
                    "R3", ruta, "código ejecutable dentro de Drive", "crítica",
                    ("archivar", None)))
            else:
                v.append(Violacion(
                    "R3", ruta,
                    "%s — revisar: puede ser un entregable, no código" % ext,
                    "menor", None))


def regla4_alias_rotos(v):
    """Alias cuyo destino no existe, o que dejaron de apuntar a donde deben."""
    # Las dos puertas de la raíz de Rosanta OS.
    for nombre, esperado in PUERTAS.items():
        ruta = os.path.join(DRIVE, nombre)
        if not os.path.lexists(ruta):
            v.append(Violacion(
                "R4", ruta, "falta la puerta `%s` → %s" % (nombre, esperado),
                "crítica", None))
            continue
        if not os.path.islink(ruta):
            continue  # ya lo reportó la regla 1
        destino = os.readlink(ruta)
        if not os.path.exists(ruta):
            v.append(Violacion(
                "R4", ruta, "alias roto → %s" % destino, "crítica", None))
        elif os.path.realpath(ruta) != os.path.realpath(esperado):
            v.append(Violacion(
                "R4", ruta,
                "apunta a %s; debería apuntar a %s" % (destino, esperado),
                "crítica", None))

    for raiz in (PROJECTS, CLAUDE_APP):
        if not os.path.isdir(raiz):
            continue
        for dirpath, dirnames, filenames in os.walk(raiz, followlinks=False):
            for n in list(dirnames) + list(filenames):
                ruta = os.path.join(dirpath, n)
                if not os.path.islink(ruta):
                    continue
                destino = os.readlink(ruta)
                if not os.path.exists(ruta):
                    v.append(Violacion(
                        "R4", ruta, "alias roto → %s" % destino, "crítica", None))


def regla5_punteros(v):
    """Punteros de Google sin archivo real al lado."""
    for dirpath, dirnames, filenames in caminar(DRIVE):
        presentes = set(filenames)
        for n in filenames:
            base, ext = os.path.splitext(n)
            ext = ext.lower()
            if ext not in EXT_PUNTERO:
                continue
            destino = EXT_PUNTERO[ext]
            ruta = os.path.join(dirpath, n)
            if destino is None:
                v.append(Violacion(
                    "R5", ruta, "formulario: no se puede exportar a Office",
                    "informativo", None))
                continue
            # ¿existe un archivo real con el mismo nombre base, con o sin fecha?
            # Se compara sin espacios en los bordes: varios nombres en Drive los
            # tienen (y alguno arranca con un espacio de ancho cero).
            base_n = base.strip()
            hay = False
            for otro in presentes:
                if not otro.endswith(destino):
                    continue
                otro_n = re.sub(r"^\d{4}-\d{2}-\d{2}_", "",
                                os.path.splitext(otro)[0]).strip()
                if otro_n == base_n or otro_n.endswith("_" + base_n):
                    hay = True
                    break
            if not hay:
                v.append(Violacion(
                    "R5", ruta, "sin %s real al lado" % destino, "menor", None))


def regla6_nombres(v):
    """Nombres fuera de norma en archivos creados desde 2026-08-18."""
    for dirpath, dirnames, filenames in caminar(DRIVE):
        for n in filenames:
            if es_ruido(n) or n.startswith("."):
                continue
            ruta = os.path.join(dirpath, n)
            try:
                st = os.stat(ruta)
            except OSError:
                continue
            # birthtime en macOS; si no está, mtime.
            nacido = getattr(st, "st_birthtime", None) or st.st_mtime
            fecha = dt.date.fromtimestamp(nacido)
            if fecha < FECHA_NORMA:
                continue
            if RE_NOMBRE_OK.match(n):
                continue
            v.append(Violacion(
                "R6", ruta, "creado %s · no cumple AAAA-MM-DD_Tema_vN.ext" % fecha,
                "menor", None))


def regla7_inbox(v, dias):
    """_Inbox/ con más de N días sin vaciar."""
    if not os.path.isdir(INBOX):
        return
    pendientes = []
    for dirpath, dirnames, filenames in os.walk(INBOX, followlinks=False):
        for n in filenames:
            if es_ruido(n):
                continue
            pendientes.append(os.path.join(dirpath, n))
    if not pendientes:
        return
    ahora = time.time()
    viejos = []
    for p in pendientes:
        try:
            edad = (ahora - os.stat(p).st_mtime) / 86400.0
        except OSError:
            continue
        if edad > dias:
            viejos.append((p, edad))
    for p, edad in sorted(viejos, key=lambda x: -x[1]):
        v.append(Violacion(
            "R7", p, "lleva %.0f días en _Inbox (umbral %d)" % (edad, dias),
            "menor", None))


# --------------------------------------------------------------------------
# Reporte
# --------------------------------------------------------------------------

TITULOS = {
    "R1": "Regla 1 — archivos sueltos en la raíz de Rosanta OS",
    "R2": "Regla 2 — archivos reales en Documents/Claude/Projects (solo debe haber alias)",
    "R3": "Regla 4 del README — código dentro de Drive",
    "R4": "Alias rotos (las 2 puertas de la raíz, Projects y ~/Claude)",
    "R5": "Punteros de Google sin archivo real al lado",
    "R6": "Nombres fuera de norma (archivos creados desde 2026-08-18)",
    "R7": "_Inbox/ sin vaciar",
}
ORDEN = ["R4", "R3", "R1", "R2", "R5", "R6", "R7"]


def escribir_reporte(viols, dias, destino, segundos):
    hoy = dt.date.today().isoformat()
    por_regla = defaultdict(list)
    for x in viols:
        por_regla[x.regla].append(x)

    reales = [x for x in viols if x.severidad != "informativo"]
    criticas = [x for x in reales if x.severidad == "crítica"]
    menores = [x for x in reales if x.severidad == "menor"]

    L = []
    L.append("# Guardián de estructura — Rosanta OS")
    L.append("**Corrida:** %s · **Duración:** %.1f s · "
             "**Umbral _Inbox:** %d días" % (hoy, segundos, dias))
    L.append("")
    L.append("Este reporte solo describe. No movió ni borró nada. "
             "Para aplicar los arreglos seguros: "
             "`python3 tools/guardian-estructura/guardian.py --dry-run-fix` "
             "y luego `--fix`.")
    L.append("")
    L.append("## Resumen por regla")
    L.append("")
    L.append("| Regla | Violaciones | Críticas | Menores |")
    L.append("|---|---:|---:|---:|")
    for k in ORDEN:
        items = [x for x in por_regla.get(k, []) if x.severidad != "informativo"]
        nc = len([x for x in items if x.severidad == "crítica"])
        L.append("| %s | %d | %d | %d |"
                 % (TITULOS[k], len(items), nc, len(items) - nc))
    L.append("")

    for k in ORDEN:
        items = por_regla.get(k, [])
        L.append("## %s" % TITULOS[k])
        L.append("")
        if not items:
            L.append("Sin hallazgos.")
            L.append("")
            continue
        if k == "R5":
            # agrupado por pilar
            por_pilar = defaultdict(list)
            for x in items:
                por_pilar[pilar_de(x.ruta)].append(x)
            for pil in sorted(por_pilar):
                lst = por_pilar[pil]
                L.append("### %s — %d punteros" % (pil, len(lst)))
                L.append("")
                for x in sorted(lst, key=lambda y: y.ruta):
                    L.append("- `%s` — %s" % (rel(x.ruta, DRIVE), x.detalle))
                L.append("")
            continue
        if k == "R3":
            duros = [x for x in items if x.severidad == "crítica"]
            blandos = [x for x in items if x.severidad != "crítica"]
            L.append("### Código ejecutable (.gs .js .ts .py .sh) — %d, "
                     "crítico" % len(duros))
            L.append("")
            for x in sorted(duros, key=lambda y: y.ruta):
                L.append("- `%s`" % rel(x.ruta, DRIVE))
            L.append("")
            L.append("### .html / .json — %d, revisar uno por uno" % len(blandos))
            L.append("")
            L.append("Muchos son entregables exportados (reportes, artefactos), "
                     "no código. El guardián no los mueve.")
            L.append("")
            for x in sorted(blandos, key=lambda y: y.ruta):
                L.append("- `%s`" % rel(x.ruta, DRIVE))
            L.append("")
            continue
        for x in sorted(items, key=lambda y: y.ruta):
            base = DRIVE if x.ruta.startswith(DRIVE) else HOME
            marca = "" if x.severidad != "informativo" else " _(informativo)_"
            L.append("- `%s` — %s%s" % (rel(x.ruta, base), x.detalle, marca))
        L.append("")

    L.append("---")
    L.append("")
    L.append("**%d violaciones · %d críticas · %d menores**"
             % (len(reales), len(criticas), len(menores)))
    L.append("")

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))
    return len(reales), len(criticas), len(menores)


# --------------------------------------------------------------------------
# --fix
# --------------------------------------------------------------------------

def destino_unico(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists("%s_%d%s" % (base, i, ext)):
        i += 1
    return "%s_%d%s" % (base, i, ext)


def aplicar_fix(viols, seco):
    hoy = dt.date.today().isoformat()
    lote = os.path.join(ARCHIVE, "Guardian_%s" % hoy)
    hechos = []
    for x in viols:
        if not x.fix:
            continue
        modo, destino = x.fix
        if modo == "archivar":
            sub = rel(x.ruta, DRIVE)
            destino = os.path.join(lote, sub)
        destino = destino_unico(destino)
        hechos.append((x.ruta, destino))
        if seco:
            continue
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        os.rename(x.ruta, destino)
    return hechos


# --------------------------------------------------------------------------
# --realias
# --------------------------------------------------------------------------

def _candidatos(nombre, raices):
    """Todas las carpetas llamadas `nombre` dentro de `raices`."""
    salida = []
    for raiz in raices:
        if not os.path.isdir(raiz):
            continue
        for dirpath, dirnames, _ in os.walk(raiz, followlinks=False):
            dirnames[:] = [
                d for d in dirnames
                if d not in {".git", "node_modules"}
                and not d.startswith(".tmp.drive")
                and os.path.join(dirpath, d) != ARCHIVE
            ]
            if nombre in dirnames:
                salida.append(os.path.join(dirpath, nombre))
    return salida


def _puntaje(candidato, viejo):
    """Cuántos tramos finales de la ruta comparten. Más = mejor."""
    a = os.path.normpath(candidato).split(os.sep)
    b = os.path.normpath(viejo).split(os.sep)
    n = 0
    while n < min(len(a), len(b)) and a[-1 - n] == b[-1 - n]:
        n += 1
    return n


def buscar_destino(viejo):
    """Adónde debería apuntar ahora un alias cuyo destino era `viejo`.

    Devuelve (ruta, None) si hay un único mejor candidato, o (None, motivo).
    """
    nombre = os.path.basename(os.path.normpath(viejo))
    if not nombre:
        return None, "el destino viejo no tiene nombre"
    # Se busca primero donde vivía; si no aparece, en la otra capa.
    principal = DRIVE if viejo.startswith(DRIVE) else DEV
    otra = DEV if principal is DRIVE else DRIVE
    for raices in ([principal], [otra]):
        cands = _candidatos(nombre, raices)
        if not cands:
            continue
        mejor = max(_puntaje(c, viejo) for c in cands)
        top = [c for c in cands if _puntaje(c, viejo) == mejor]
        if len(top) == 1:
            return top[0], None
        return None, "hay %d carpetas llamadas `%s`: %s" % (
            len(top), nombre, " · ".join(rel(c, principal) for c in top))
    return None, "no encontré ninguna carpeta llamada `%s`" % nombre


def aplicar_realias(viols, seco):
    """Repara los alias rotos. Nunca borra: el roto se archiva."""
    hoy = dt.date.today().isoformat()
    lote = os.path.join(ARCHIVE, "Alias_rotos_%s" % hoy)
    hechos, sin_resolver = [], []

    for x in viols:
        if x.regla != "R4" or x.severidad != "crítica":
            continue
        nombre = os.path.basename(x.ruta)

        # Las dos puertas de la raíz tienen destino declarado: no hay que buscarlo.
        if x.ruta == os.path.join(DRIVE, nombre) and nombre in PUERTAS:
            destino, motivo = PUERTAS[nombre], None
            if not os.path.isdir(destino):
                destino, motivo = None, "su destino declarado no existe: %s" % destino
        elif os.path.lexists(x.ruta) and os.path.islink(x.ruta):
            destino, motivo = buscar_destino(os.readlink(x.ruta))
        else:
            destino, motivo = None, "el alias ya no está"

        if not destino:
            sin_resolver.append((x.ruta, motivo))
            continue

        hechos.append((x.ruta, destino))
        if seco:
            continue
        if os.path.lexists(x.ruta):
            guardado = destino_unico(os.path.join(lote, nombre + ".roto"))
            os.makedirs(os.path.dirname(guardado), exist_ok=True)
            os.rename(x.ruta, guardado)
        os.symlink(destino, x.ruta)

    return hechos, sin_resolver


def main():
    ap = argparse.ArgumentParser(description="Guardián de estructura de Rosanta OS")
    ap.add_argument("--fix", action="store_true",
                    help="mueve a _Archive/ o _Inbox/. Nunca borra.")
    ap.add_argument("--dry-run-fix", action="store_true",
                    help="imprime lo que haría --fix, sin tocar nada")
    ap.add_argument("--realias", action="store_true",
                    help="repara los alias rotos buscando la carpeta por nombre. "
                         "El alias roto se archiva; nunca se borra.")
    ap.add_argument("--dry-run-realias", action="store_true",
                    help="imprime qué repararía --realias, sin tocar nada")
    ap.add_argument("--inbox-dias", type=int, default=7)
    ap.add_argument("--salida", default=None,
                    help="ruta del reporte (default: 00_Admin/Auditorias/)")
    ap.add_argument("--json", default=None, help="volcado adicional en JSON")
    args = ap.parse_args()

    if not os.path.isdir(DRIVE):
        sys.exit("No encuentro %s" % DRIVE)

    t0 = time.time()
    viols = []
    regla1_raiz(viols)
    regla2_projects(viols)
    regla3_codigo_en_drive(viols)
    regla4_alias_rotos(viols)
    regla5_punteros(viols)
    regla6_nombres(viols)
    regla7_inbox(viols, args.inbox_dias)
    dur = time.time() - t0

    destino = args.salida or os.path.join(
        AUDITORIAS, "%s_Guardian.md" % dt.date.today().isoformat())
    total, crit, men = escribir_reporte(viols, args.inbox_dias, destino, dur)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump([{"regla": x.regla, "ruta": x.ruta,
                        "detalle": x.detalle, "severidad": x.severidad}
                       for x in viols], fh, ensure_ascii=False, indent=2)

    print("Reporte: %s" % destino)
    print("%d violaciones · %d críticas · %d menores  (%.1f s)"
          % (total, crit, men, dur))

    if args.dry_run_realias or args.realias:
        hechos, sin_resolver = aplicar_realias(viols, seco=not args.realias)
        etiqueta = "REPARÓ" if args.realias else "REPARARÍA"
        print("\n--- %s %d alias ---" % (etiqueta, len(hechos)))
        for ruta, destino in hechos:
            print("%s\n   -> %s" % (ruta, destino))
        if not hechos:
            print("(ningún alias roto que reparar)")
        if sin_resolver:
            print("\n--- %d sin resolver, hay que decidir a mano ---"
                  % len(sin_resolver))
            for ruta, motivo in sin_resolver:
                print("%s\n   %s" % (ruta, motivo))

    if args.dry_run_fix or args.fix:
        hechos = aplicar_fix(viols, seco=not args.fix)
        etiqueta = "HARÍA" if not args.fix else "MOVIÓ"
        print("\n--- %s %d movimientos ---" % (etiqueta, len(hechos)))
        for origen, dest in hechos:
            print("%s\n   -> %s" % (origen, dest))
        if not hechos:
            print("(nada que mover)")


if __name__ == "__main__":
    main()
