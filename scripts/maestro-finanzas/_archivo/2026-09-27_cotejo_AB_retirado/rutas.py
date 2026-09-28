# -*- coding: utf-8 -*-
"""Dónde están los datos del maestro.

El código vive en `~/Dev/Rosanta/` (regla 4 del README de Rosanta OS) y los
datos siguen en Drive. Este módulo es lo único que sabe de esa separación:
los generadores le preguntan a él y no vuelven a usar `dirname(__file__)`
para buscar archivos.

Orden de resolución:
  1. `--datos RUTA` en la línea de comandos
  2. la variable de entorno `ROSANTA_MAESTRO_DIR`
  3. el default: `~/My Drive/Rosanta OS/03_Finance_Data_OS/Maestro`
"""

import os
import sys

DEFECTO = os.path.expanduser(
    "~/My Drive/Rosanta OS/03_Finance_Data_OS/Maestro")


def datos(argv=None):
    """Devuelve la carpeta de datos y saca `--datos` de `argv`.

    Muta `sys.argv` (o el `argv` que se le pase) para que los scripts puedan
    seguir leyendo su argumento posicional del espejo como siempre.
    """
    if argv is None:
        argv = sys.argv
    ruta = None
    i = 1
    while i < len(argv):
        if argv[i] == "--datos" and i + 1 < len(argv):
            ruta = argv[i + 1]
            del argv[i:i + 2]
            continue
        if argv[i].startswith("--datos="):
            ruta = argv[i].split("=", 1)[1]
            del argv[i]
            continue
        i += 1

    ruta = ruta or os.environ.get("ROSANTA_MAESTRO_DIR") or DEFECTO
    ruta = os.path.expanduser(ruta)
    if not os.path.isdir(ruta):
        raise SystemExit(
            "No encuentro la carpeta de datos del maestro:\n  %s\n"
            "Pasala con --datos RUTA o poné ROSANTA_MAESTRO_DIR." % ruta)
    return ruta
