#!/usr/bin/env python3
# Candado de clasp (14-oct-2026). Convierte en regla dura dos líneas del CLAUDE.md
# ("Trabajo con Apps Script"):
#   1. Nunca `clasp pull` dentro del repo: pisa el trabajo sin subir de todas las sesiones.
#      Bajar a una carpeta APARTE (fuera de ~/Dev/Rosanta) para comparar sí se permite.
#   2. Nada de `clasp create-version` / `update-deployment` / `deploy` de la intranet sin
#      sello vigente de la batería (?page=pruebas): posterior al último push y con 0 fallas.
#   3. (14-oct-2026, noche) Nada de `clasp push` de la intranet que PISE trabajo ajeno. Antes
#      de subir se baja el HEAD del servidor a una carpeta temporal fuera del repo, y cada
#      archivo del servidor tiene que ser conocido por la carpeta que sube: igual a lo que va
#      a subir, igual a alguna versión de la historia de su rama (cualquier commit alcanzable
#      desde HEAD, 15-oct-2026), o igual a lo que esa misma carpeta subió la vez
#      anterior. Si no, otra sesión subió algo que esta no tiene y el push se frena con la
#      lista de archivos. Salida explícita, solo con el sí de Juanma:
#      ROSANTA_PUSH_PISAR="motivo" clasp push
#
# Uso (lo llama .claude/settings.json):
#   candado-clasp.py pre   -> PreToolUse  Bash: bloquea (deny) o anota el push
#   candado-clasp.py post  -> PostToolUse Bash: anota la hora en que terminó el push
#
# El sello lo escribe SOLO sellar-bateria.py, con el conteo que Juanma reporta.
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
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
        encontradas.append({"sub": sub, "dir": dir_actual, "proyecto": proyecto, "entorno": entorno})
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


# ---------------------------------------------------------------- 3. el push no pisa
EXT_SUBEN = (".js", ".gs", ".html", ".json")


def _sha(datos):
    return hashlib.sha256(datos).hexdigest()


def _foto_ruta(raiz):
    clave = hashlib.sha256(os.path.realpath(raiz).encode()).hexdigest()[:16]
    return os.path.join(SELLOS, "push-foto-" + clave + ".json")


def _archivos(raiz):
    """Los archivos de una carpeta que clasp subiria, relativos y sin _backups ni .clasp.json."""
    out = {}
    for d, subdirs, files in os.walk(raiz):
        subdirs[:] = [x for x in subdirs if x not in ("_backups", "node_modules", ".git")]
        for f in files:
            if not f.endswith(EXT_SUBEN) or f == ".clasp.json":
                continue
            ruta = os.path.join(d, f)
            rel = os.path.relpath(ruta, raiz)
            with open(ruta, "rb") as h:
                out[rel] = _sha(h.read())
    return out


def _sin_ext(rel):
    # clasp baja los .gs como .js: se compara por nombre sin extension de codigo
    base, ext = os.path.splitext(rel)
    return base + (".js" if ext in (".gs", ".js") else ext)


HISTORIA_MAX = 200  # versiones por archivo que se buscan hacia atras


def _en_historia(raiz, archivos):
    """Los rels cuyo contenido del servidor aparece en algun commit alcanzable desde HEAD.

    archivos = {rel: ruta del archivo bajado}. Un worktree nuevo no tiene foto de push y, si
    su ultimo commit cambio un archivo, el servidor trae la version de un commit ANTERIOR de la
    misma rama (main o un merge ya traido): eso no es trabajo ajeno. Se compara el blob de git
    del contenido bajado contra cada version de esa ruta en la historia de HEAD; lo que no esta
    en la historia (otra rama sin traer, o nunca commiteado) sigue siendo ajeno."""
    ok = set()
    try:
        r = subprocess.run(["git", "-C", raiz, "rev-parse", "--show-toplevel", "--show-prefix"],
                           capture_output=True, text=True, timeout=20, check=True).stdout.split("\n")
        top, pref = r[0], r[1].strip()
    except Exception:
        return ok
    for rel, ruta in archivos.items():
        # clasp baja los .gs como .js: en git puede estar con cualquiera de las dos
        candidatas = [pref + rel]
        if rel.endswith(".js"):
            candidatas.append(pref + rel[:-3] + ".gs")
        try:
            with open(ruta, "rb") as h:
                blob = subprocess.run(["git", "-C", top, "hash-object", "--path=" + candidatas[0], "--stdin"],
                                      input=h.read(), capture_output=True, timeout=20,
                                      check=True).stdout.decode().strip()
            commits = subprocess.run(["git", "-C", top, "log", "--full-history", "--format=%H",
                                      "-n", str(HISTORIA_MAX), "HEAD", "--"] + candidatas,
                                     capture_output=True, text=True, timeout=30).stdout.split()
            if not commits:
                continue
            pedido = "".join("%s:%s\n" % (c, p) for c in commits for p in candidatas)
            r = subprocess.run(["git", "-C", top, "cat-file", "--batch-check=%(objectname)"],
                               input=pedido, capture_output=True, text=True, timeout=30)
            if blob in r.stdout.split():
                ok.add(rel)
        except Exception:
            continue
    return ok


def guardar_foto(inv):
    """Despues de un push: lo que esta carpeta subio, para no frenarse a si misma la proxima vez."""
    raiz, _ = destino_pull(inv)
    if not raiz:
        return
    os.makedirs(SELLOS, exist_ok=True)
    foto = {_sin_ext(k): v for k, v in _archivos(raiz).items()}
    with open(_foto_ruta(raiz), "w") as f:
        json.dump({"fecha": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
                   "raiz": raiz, "archivos": foto}, f, indent=1)


def verificar_push(inv):
    """(ok, motivo). Baja el HEAD aparte y busca archivos que esta carpeta no conoce."""
    raiz, _ = destino_pull(inv)
    cfg = buscar_clasp_json(inv["proyecto"], inv["dir"])
    if not raiz or not cfg:
        return True, ""
    tmp = tempfile.mkdtemp(prefix="candado-push-")
    try:
        datos = leer_json(cfg) or {}
        datos["rootDir"] = ""
        with open(os.path.join(tmp, ".clasp.json"), "w") as f:
            json.dump(datos, f)
        try:
            r = subprocess.run(["clasp", "pull"], cwd=tmp, capture_output=True, text=True, timeout=150)
        except Exception as e:
            return False, "no pude bajar el HEAD del servidor para comparar (" + str(e)[:120] + ")"
        servidor = {_sin_ext(k): v for k, v in _archivos(tmp).items()}
        if not servidor:
            return False, ("no pude bajar el HEAD del servidor para comparar (clasp pull no trajo archivos: " +
                           (r.stderr or r.stdout or "")[-200:].strip() + ")")
        local = {_sin_ext(k): v for k, v in _archivos(raiz).items()}
        foto = (leer_json(_foto_ruta(raiz)) or {}).get("archivos", {})
        dudosos = [rel for rel, h in servidor.items() if h != local.get(rel) and h != foto.get(rel)]
        if not dudosos:
            return True, ""
        rutas = {_sin_ext(k): os.path.join(tmp, k) for k in _archivos(tmp)}
        conocidos = _en_historia(raiz, {rel: rutas[rel] for rel in dudosos})
        ajenos = [rel for rel in dudosos if rel not in conocidos]
        if not ajenos:
            return True, ""
        return False, ("en el servidor hay %d archivo(s) que esta carpeta no tiene ni en disco, ni en la "
                       "historia de su rama, ni en su ultimo push: %s. Otra sesion subio trabajo que aca no "
                       "esta; este push lo borraria." % (len(ajenos), ", ".join(sorted(ajenos)[:12])))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


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
                try:
                    guardar_foto(inv)
                except Exception:
                    pass
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
            pisar = inv.get("entorno", {}).get("ROSANTA_PUSH_PISAR") or os.environ.get("ROSANTA_PUSH_PISAR")
            if not pisar:
                ok, porque = verificar_push(inv)
                if not ok:
                    denegar(
                        "Bloqueado: `clasp push` de la intranet. " + porque + " Que hacer: (1) averiguar "
                        "que sesion lo subio (ListAgents / preguntar) y traer su commit a esta carpeta "
                        "(git merge), o pedirle que haga commit primero; (2) volver a hacer push. Solo si "
                        "Juanma dice que se puede pisar: ROSANTA_PUSH_PISAR=\"motivo\" clasp push.")
            # Se anota ya en el Pre: un push cortado o fallido también invalida el sello.
            anotar_push(inv, comando)


if __name__ == "__main__":
    main()
