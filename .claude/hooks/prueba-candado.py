#!/usr/bin/env python3
# Simulador del candado de clasp (candado-clasp.py). No toca nada real:
#   - arma un repo de juguete en una carpeta temporal, con historia de ramas y merges;
#   - pone un `clasp` FALSO primero en el PATH (su "pull" copia una carpeta que hace de servidor);
#   - los sellos van a ROSANTA_SELLOS_DIR temporal, nunca a ~/.rosanta-sellos.
# Uso: python3 .claude/hooks/prueba-candado.py   (sale con 1 si algo falla)
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(AQUI, "candado-clasp.py")
INTRANET = "1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42"

BASE = tempfile.mkdtemp(prefix="sim-candado-")
REPO = os.path.join(BASE, "repo")
INTRA = os.path.join(REPO, "apps-script", "rosanta-intranet")
OTRO = os.path.join(REPO, "apps-script", "otro")
SERVIDOR = os.path.join(BASE, "servidor")
SELLOS = os.path.join(BASE, "sellos")
BIN = os.path.join(BASE, "bin")
APARTE = os.path.join(BASE, "aparte")

resultados = []


def escribir(ruta, texto):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w") as f:
        f.write(texto)


def git(*args):
    return subprocess.run(["git", "-C", REPO, "-c", "user.name=sim", "-c", "user.email=sim@x",
                           "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"] + list(args),
                          capture_output=True, text=True, check=True).stdout.strip()


def commit(msg, **archivos):
    for nombre, texto in archivos.items():
        escribir(os.path.join(INTRA, nombre.replace("__", ".")), texto)
    git("add", "-A")
    git("commit", "-q", "-m", msg)


def preparar():
    # clasp falso: "pull" copia la carpeta SERVIDOR al directorio actual; lo demas no hace nada
    escribir(os.path.join(BIN, "clasp"),
             "#!/bin/sh\nif [ \"$1\" = pull ]; then cp -R \"$SIM_SERVIDOR\"/. . 2>/dev/null; fi\nexit 0\n")
    os.chmod(os.path.join(BIN, "clasp"), stat.S_IRWXU)
    os.makedirs(REPO)
    git("init", "-q", "-b", "main")
    escribir(os.path.join(INTRA, ".clasp.json"), json.dumps({"scriptId": INTRANET, "rootDir": ""}))
    escribir(os.path.join(OTRO, ".clasp.json"), json.dumps({"scriptId": "OTRO-SCRIPT", "rootDir": ""}))
    escribir(os.path.join(OTRO, "X.js"), "x")
    commit("c1", A__js="A v1", B__html="B b1", appsscript__json="{}", C__gs="C g1")
    commit("c2", A__js="A v2", C__gs="C g2")
    git("checkout", "-q", "-b", "otra")            # rama de otra sesion, nunca traida
    commit("otra", A__js="A de otra sesion")
    git("checkout", "-q", "main")
    git("checkout", "-q", "-b", "lado")            # rama que si se trae con merge
    commit("lado", B__html="B del lado")
    git("checkout", "-q", "main")
    git("merge", "-q", "--no-ff", "-m", "merge lado", "lado")
    commit("c4", B__html="B b4")
    commit("c5", A__js="A v3")                     # HEAD: el ultimo commit cambio A.js


def servidor(**cambios):
    """El servidor = lo que hay en HEAD, con los cambios pedidos (None borra)."""
    shutil.rmtree(SERVIDOR, ignore_errors=True)
    os.makedirs(SERVIDOR)
    base = {"A.js": "A v3", "B.html": "B b4", "appsscript.json": "{}", "C.js": "C g2"}
    for k, v in cambios.items():
        base[k.replace("__", ".")] = v
    for k, v in base.items():
        if v is not None:
            escribir(os.path.join(SERVIDOR, k), v)


def vaciar_servidor():
    shutil.rmtree(SERVIDOR, ignore_errors=True)
    os.makedirs(SERVIDOR)


def limpiar_sellos():
    shutil.rmtree(SELLOS, ignore_errors=True)
    os.makedirs(SELLOS)


def correr(comando, cwd=INTRA, modo="pre", herramienta="Bash", env_extra=None):
    env = dict(os.environ)
    env.pop("ROSANTA_PUSH_PISAR", None)
    env.update({"PATH": BIN + os.pathsep + env["PATH"], "SIM_SERVIDOR": SERVIDOR,
                "ROSANTA_SELLOS_DIR": SELLOS, "CLAUDE_PROJECT_DIR": REPO})
    env.update(env_extra or {})
    entrada = json.dumps({"tool_name": herramienta, "tool_input": {"command": comando}, "cwd": cwd})
    r = subprocess.run([sys.executable, HOOK, modo], input=entrada, env=env,
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        return "error", r.stderr[-300:]
    if not r.stdout.strip():
        return "permite", ""
    d = json.loads(r.stdout)["hookSpecificOutput"]
    return ("frena" if d["permissionDecision"] == "deny" else d["permissionDecision"]), d["permissionDecisionReason"]


def caso(nombre, esperado, obtenido, extra_ok=True):
    ok = obtenido[0] == esperado and extra_ok
    resultados.append(ok)
    print(("OK   " if ok else "FALLA") + "  " + nombre + ("" if ok else "  -> " + obtenido[0] + ": " + obtenido[1][:300]))


def sello(fallas=0, hace_min=0):
    f = (datetime.now(timezone.utc) - timedelta(minutes=hace_min)).astimezone().isoformat(timespec="seconds")
    escribir(os.path.join(SELLOS, "bateria-intranet.json"),
             json.dumps({"fecha_bateria": f, "ok": 190, "fallas": fallas}))


def push_registrado(hace_min):
    f = (datetime.now(timezone.utc) - timedelta(minutes=hace_min)).astimezone().isoformat(timespec="seconds")
    escribir(os.path.join(SELLOS, "ultimo-push-intranet.json"), json.dumps({"fecha": f}))


def main():
    preparar()
    print("Simulador del candado en", BASE)

    # --- 1. clasp pull dentro del repo
    print("\n# pull")
    caso("pull dentro de la intranet se frena", "frena", correr("clasp pull"))
    caso("pull con bash -c dentro del repo se frena", "frena",
         correr("bash -c 'cd %s && clasp pull'" % INTRA, cwd=REPO))
    caso("false && cd ... && pull se frena igual", "frena",
         correr("false && cd apps-script/rosanta-intranet && clasp pull", cwd=REPO))
    os.makedirs(APARTE)
    shutil.copy(os.path.join(INTRA, ".clasp.json"), APARTE)
    caso("pull en carpeta aparte fuera del repo pasa", "permite", correr("cd %s && clasp pull" % APARTE))
    caso("pull -P a una copia fuera del repo pasa", "permite",
         correr("clasp pull -P %s" % os.path.join(APARTE, ".clasp.json")))

    # --- 2. publicar sin sello
    print("\n# publicar")
    limpiar_sellos()
    caso("create-version sin sello se frena", "frena", correr("clasp create-version 'x'"))
    sello(fallas=0)
    caso("create-version con sello vigente pasa", "permite", correr("clasp create-version 'x'"))
    sello(fallas=2)
    caso("sello con fallas se frena", "frena", correr("clasp update-deployment -V 9 ABC"))
    sello(fallas=0, hace_min=30)
    push_registrado(hace_min=5)
    caso("sello anterior al ultimo push se frena", "frena", correr("clasp update-deployment -V 9 ABC"))
    limpiar_sellos()
    caso("deploy de otro proyecto no pide sello", "permite", correr("clasp deploy", cwd=OTRO))

    # --- 3. push que no pisa (worktree sin foto: SELLOS vacio en cada caso)
    print("\n# push")
    limpiar_sellos(); servidor()
    caso("servidor igual al disco pasa", "permite", correr("clasp push"))
    caso("el pre deja anotado el push", "permite", ("permite", ""),
         os.path.isfile(os.path.join(SELLOS, "ultimo-push-intranet.json")))

    limpiar_sellos(); servidor(A__js="A v2")
    caso("NUEVO sin foto: servidor = HEAD~1 en archivo que cambio el ultimo commit, pasa", "permite",
         correr("clasp push"))
    limpiar_sellos(); servidor(A__js="A v1")
    caso("NUEVO sin foto: servidor = version mas vieja de la rama, pasa", "permite", correr("clasp push"))
    limpiar_sellos(); servidor(B__html="B del lado")
    caso("NUEVO sin foto: servidor = commit de una rama ya traida con merge, pasa", "permite",
         correr("clasp push"))
    limpiar_sellos(); servidor(C__js="C g1")
    caso("NUEVO: .gs en git y .js en el servidor, version vieja, pasa", "permite", correr("clasp push"))
    limpiar_sellos(); servidor(A__js="A de otra sesion")
    r = correr("clasp push")
    caso("NUEVO: servidor = commit de otra rama NO traida, se frena", "frena", r, "A.js" in r[1])
    limpiar_sellos(); servidor(A__js="A que nunca se commiteo")
    r = correr("clasp push")
    caso("NUEVO: contenido que no esta en ninguna historia, se frena y nombra el archivo", "frena", r,
         "A.js" in r[1])
    limpiar_sellos(); servidor(Z__js="archivo nuevo de otra sesion")
    r = correr("clasp push")
    caso("archivo que solo existe en el servidor se frena", "frena", r, "Z.js" in r[1])
    limpiar_sellos(); servidor(A__js="A que nunca se commiteo")
    caso("con ROSANTA_PUSH_PISAR pasa aunque haya ajeno", "permite",
         correr("ROSANTA_PUSH_PISAR='prueba' clasp push"))
    limpiar_sellos(); vaciar_servidor()
    caso("si el pull aparte no trae nada, se frena", "frena", correr("clasp push"))

    # cambios propios sin commit + foto del ultimo push
    limpiar_sellos(); servidor()
    escribir(os.path.join(INTRA, "A.js"), "A cambio local sin commit")
    caso("disco cambiado sin commit, servidor = HEAD, pasa", "permite", correr("clasp push"))
    correr("clasp push", modo="post")
    caso("el post guarda la foto del push", "permite", ("permite", ""),
         any(n.startswith("push-foto-") for n in os.listdir(SELLOS)))
    servidor(A__js="A cambio local sin commit")
    escribir(os.path.join(INTRA, "A.js"), "A otro cambio local")
    caso("servidor = lo que esta carpeta subio la vez anterior (foto), pasa", "permite", correr("clasp push"))
    git("checkout", "-q", "--", ".")

    # --- 4. lo que no es clasp
    print("\n# otros")
    caso("comando sin clasp no hace nada", "permite", correr("ls -la"))
    caso("herramienta que no es Bash no hace nada", "permite", correr("clasp pull", herramienta="Read"))

    total, bien = len(resultados), sum(resultados)
    print("\n%d/%d" % (bien, total))
    shutil.rmtree(BASE, ignore_errors=True)
    sys.exit(0 if bien == total else 1)


if __name__ == "__main__":
    main()
