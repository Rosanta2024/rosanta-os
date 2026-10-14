#!/usr/bin/env python3
# Candado de clasp (14-oct-2026). Convierte en regla dura dos líneas del CLAUDE.md
# ("Trabajo con Apps Script"):
#   1. Nunca `clasp pull` dentro del repo: pisa el trabajo sin subir de todas las sesiones.
#      Bajar a una carpeta APARTE (fuera de ~/Dev/Rosanta) para comparar sí se permite.
#   2. Nada de `clasp create-version` / `update-deployment` / `deploy` de la intranet sin
#      sello vigente de la batería (?page=pruebas): posterior al último push y con 0 fallas.
#
# Uso (lo llama .claude/settings.json):
#   candado-clasp.py pre   -> PreToolUse  Bash: bloquea (deny) o anota el push
#   candado-clasp.py post  -> PostToolUse Bash: anota la hora en que terminó el push
#
# El sello lo escribe SOLO sellar-bateria.py, con el conteo que Juanma reporta.
import json
import os
import shlex
import sys
from datetime import datetime, timezone

INTRANET_SCRIPT_ID = "1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42"
SELLOS = os.path.expanduser(os.environ.get("ROSANTA_SELLOS_DIR", "~/.rosanta-sellos"))
SELLO = os.path.join(SELLOS, "bateria-intranet.json")
PUSH = os.path.join(SELLOS, "ultimo-push-intranet.json")
URL_BATERIA = ("https://script.google.com/a/macros/rosanta.rest/s/"
               "AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=pruebas")

PUBLICAR = {"create-version", "version", "update-deployment", "redeploy",
            "create-deployment", "deploy"}
PREFIJOS = {"npx", "env", "command", "time", "sudo", "exec", "nohup"}
OPC_CON_VALOR = {"-A", "--auth", "-u", "--user", "-I", "--ignore", "-P", "--project"}
SEPARADORES = {";", "&&", "||", "|", "&", "(", ")", "|&", ";;"}


def raices_repo():
    raices = {os.path.realpath(os.path.expanduser("~/Dev/Rosanta"))}
    if os.environ.get("CLAUDE_PROJECT_DIR"):
        raices.add(os.path.realpath(os.environ["CLAUDE_PROJECT_DIR"]))
    return raices


def dentro_de_repo(ruta):
    r = os.path.realpath(ruta)
    return any(r == raiz or r.startswith(raiz + os.sep) for raiz in raices_repo())


def resolver(base, ruta):
    return os.path.normpath(os.path.join(base, os.path.expanduser(ruta)))


def segmentos(comando):
    """Parte el comando en invocaciones simples. Devuelve listas de tokens."""
    salida = []
    for linea in comando.split("\n"):
        try:
            lx = shlex.shlex(linea, posix=True, punctuation_chars=True)
            lx.whitespace_split = True
            lx.commenters = "#"
            toks = list(lx)
        except ValueError:
            toks = linea.split()
        actual = []
        for t in toks:
            if t in SEPARADORES:
                if actual:
                    salida.append(actual)
                actual = []
            else:
                actual.append(t)
        if actual:
            salida.append(actual)
    return salida


def buscar_clasp_json(proyecto, directorio):
    """Devuelve la ruta del .clasp.json que clasp usaría, o None."""
    if proyecto:
        p = proyecto
        return os.path.join(p, ".clasp.json") if os.path.isdir(p) else p
    d = os.path.realpath(directorio)
    while True:
        c = os.path.join(d, ".clasp.json")
        if os.path.isfile(c):
            return c
        padre = os.path.dirname(d)
        if padre == d:
            return None
        d = padre


def leer_json(ruta):
    try:
        with open(ruta) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def invocaciones(comando, cwd):
    """Recorre el comando siguiendo los `cd` y devuelve cada clasp con su contexto."""
    dir_actual = cwd
    encontradas = []
    for toks in segmentos(comando):
        entorno = {}
        i = 0
        while i < len(toks) and "=" in toks[i] and not toks[i].startswith("-") \
                and toks[i].split("=", 1)[0].replace("_", "").isalnum():
            k, v = toks[i].split("=", 1)
            entorno[k] = v
            i += 1
        while i < len(toks) and toks[i] in PREFIJOS:
            i += 1
            while i < len(toks) and "=" in toks[i] and not toks[i].startswith("-"):
                k, v = toks[i].split("=", 1)
                entorno[k] = v
                i += 1
        if i >= len(toks):
            continue
        prog = toks[i]
        resto = toks[i + 1:]
        if prog in ("cd", "pushd"):
            destino = next((t for t in resto if not t.startswith("-")), "~")
            dir_actual = resolver(dir_actual, destino)
            continue
        if prog in ("bash", "sh", "zsh") and "-c" in resto:
            j = resto.index("-c")
            if j + 1 < len(resto):
                encontradas += invocaciones(resto[j + 1], dir_actual)
            continue
        if prog == "eval":
            encontradas += invocaciones(" ".join(resto), dir_actual)
            continue
        if os.path.basename(prog) not in ("clasp", "@google/clasp"):
            continue
        proyecto = entorno.get("clasp_config_project") or os.environ.get("clasp_config_project")
        sub = None
        j = 0
        while j < len(resto):
            t = resto[j]
            if t.startswith("-"):
                nombre = t.split("=", 1)[0]
                if nombre in ("-P", "--project"):
                    proyecto = t.split("=", 1)[1] if "=" in t else (resto[j + 1] if j + 1 < len(resto) else None)
                if nombre in OPC_CON_VALOR and "=" not in t:
                    j += 1
            elif sub is None:
                sub = t
            j += 1
        if proyecto:
            proyecto = resolver(dir_actual, proyecto)
        encontradas.append({"sub": sub, "dir": dir_actual, "proyecto": proyecto})
    return encontradas


def destino_pull(inv):
    cfg = buscar_clasp_json(inv["proyecto"], inv["dir"])
    if not cfg:
        return None, None
    datos = leer_json(cfg) or {}
    raiz = datos.get("rootDir") or ""
    return resolver(os.path.dirname(os.path.abspath(cfg)), raiz), datos.get("scriptId")


def es_intranet(inv):
    cfg = buscar_clasp_json(inv["proyecto"], inv["dir"])
    datos = leer_json(cfg) if cfg else None
    return bool(datos) and datos.get("scriptId") == INTRANET_SCRIPT_ID


def fecha(texto):
    try:
        f = datetime.fromisoformat(texto)
        return f if f.tzinfo else f.astimezone()
    except (TypeError, ValueError):
        return None


def estado_sello():
    """Devuelve (vigente, explicación)."""
    sello = leer_json(SELLO)
    if not sello:
        return False, "No hay sello de la batería (" + SELLO + ")."
    f_bat = fecha(sello.get("fecha_bateria"))
    if not f_bat:
        return False, "El sello está dañado: no tiene fecha_bateria legible."
    ok, fallas = sello.get("ok"), sello.get("fallas")
    if not isinstance(ok, int) or not isinstance(fallas, int) or ok <= 0:
        return False, "El sello no trae el conteo de la batería (OK y fallas)."
    if fallas != 0:
        return False, "La última batería registrada tiene %d falla(s)." % fallas
    push = leer_json(PUSH) or {}
    f_push = fecha(push.get("fecha"))
    if f_push and f_bat <= f_push:
        return False, ("El sello es de %s y el último push a la intranet fue el %s: "
                       "la batería no probó lo que hoy está en HEAD."
                       % (f_bat.strftime("%d-%m %H:%M"), f_push.strftime("%d-%m %H:%M")))
    return True, "Sello vigente: %d OK · 0 fallas (%s)." % (ok, f_bat.strftime("%d-%m %H:%M"))


def anotar_push(inv, comando):
    os.makedirs(SELLOS, exist_ok=True)
    tmp = PUSH + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"fecha": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
                   "directorio": inv["dir"], "comando": comando[:300]}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, PUSH)


def denegar(motivo):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": motivo,
    }}, ensure_ascii=False))
    sys.exit(0)


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else "pre"
    try:
        d = json.load(sys.stdin)
    except ValueError:
        return
    if d.get("tool_name") != "Bash":
        return
    comando = d.get("tool_input", {}).get("command", "") or ""
    if "clasp" not in comando:
        return
    cwd = d.get("cwd") or os.getcwd()
    invs = invocaciones(comando, cwd)

    if modo == "post":
        for inv in invs:
            if inv["sub"] == "push" and es_intranet(inv):
                anotar_push(inv, comando)
        return

    for inv in invs:
        sub = inv["sub"]
        if sub == "pull":
            destino, _ = destino_pull(inv)
            if destino and dentro_de_repo(destino):
                denegar(
                    "Bloqueado: `clasp pull` bajaría el proyecto DENTRO del repo (" + destino + ") "
                    "y pisaría el trabajo sin subir de todas las sesiones. "
                    "Para comparar, baja a una carpeta APARTE fuera de ~/Dev/Rosanta: "
                    "`mkdir -p <scratchpad>/bajada && cp .clasp.json <scratchpad>/bajada/ && "
                    "cd <scratchpad>/bajada && clasp pull` (con `--versionNumber N` para una versión), "
                    "y luego compara con `diff -r`. Si el .clasp.json copiado trae rootDir, déjalo vacío.")
        elif sub in PUBLICAR and es_intranet(inv):
            vigente, porque = estado_sello()
            if not vigente:
                denegar(
                    "Bloqueado: `clasp " + sub + "` publica la intranet y no hay sello vigente de la "
                    "batería. " + porque + " Para desbloquear: (1) que Juanma corra la batería en su "
                    "navegador, con rol dueño, contra lo que está en HEAD: " + URL_BATERIA + " ; "
                    "(2) que reporte el CONTEO (OK, fallas, avisos, saltadas), no solo el color; "
                    "(3) con ese conteo real, `python3 .claude/hooks/sellar-bateria.py --ok N "
                    "--fallas N --avisos N --saltadas N --fuente \"...\"`. Nunca crear el sello "
                    "sin un resultado real. Con fallas no se publica.")
        elif sub == "push" and es_intranet(inv):
            # Se anota ya en el Pre: un push cortado o fallido también invalida el sello.
            anotar_push(inv, comando)


if __name__ == "__main__":
    main()
