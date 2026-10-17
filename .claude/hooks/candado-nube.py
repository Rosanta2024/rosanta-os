#!/usr/bin/env python3
"""
Candado de la nube (17-oct-2026, Fase 0 de la migracion). Hermano de candado-clasp.py.

Antes de cada comando Bash:
  1. Bloquea publicar el servidor de Cloud Run (gcloud run deploy / services replace / services
     update) si no hay un sello de la bateria de la nube con 0 fallas y la MISMA huella del codigo
     que hay en disco (cloud/herramientas/sellar-nube.py).
  2. Bloquea borrar la base o sus datos (gcloud sql instances delete / databases delete / backups
     delete, o quitar la proteccion contra borrado). Solo con el si de Juanma:
     ROSANTA_NUBE_BORRAR="motivo" <comando>.

El sello lo escribe SOLO sellar-nube.py despues de correr la bateria. Nunca crearlo ni editarlo
a mano para destrabar.
"""
import importlib.util, json, os, re, sys

SERVICIO_POR_DEFECTO = 'rosanta-nube'


def ruta_sello(servicio):
    # Un sello por servicio (17-oct-2026), igual que sellar-nube.py › rutas()
    base = 'bateria-nube' if servicio == SERVICIO_POR_DEFECTO else 'bateria-nube-' + servicio
    return os.path.expanduser('~/.rosanta-sellos/' + base + '.json')


def servicio_del_comando(cmd):
    m = re.search(r'\brun\s+(?:deploy|services\s+update)\s+([a-z][a-z0-9-]*)', cmd)
    return m.group(1) if m else SERVICIO_POR_DEFECTO


def bloquear(msg):
    # Mismo formato que candado-clasp.py › denegar
    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'PreToolUse',
        'permissionDecision': 'deny',
        'permissionDecisionReason': msg,
    }}, ensure_ascii=False))
    sys.exit(0)


def huella_actual(raiz_repo):
    ruta = os.path.join(raiz_repo, 'cloud', 'herramientas', 'sellar-nube.py')
    spec = importlib.util.spec_from_file_location('sellar_nube', ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.huella(os.path.join(raiz_repo, 'cloud'))


def raiz_del_comando(cmd, cwd):
    # Publicamos con --source <carpeta>; si no viene, la carpeta de trabajo.
    m = re.search(r'--source[= ]+(\S+)', cmd)
    d = os.path.abspath(os.path.join(cwd, os.path.expanduser(m.group(1)))) if m else cwd
    while d and d != '/':
        if os.path.isdir(os.path.join(d, 'cloud', 'herramientas')):
            return d
        d = os.path.dirname(d)
    return os.environ.get('CLAUDE_PROJECT_DIR') or cwd


def main():
    if len(sys.argv) < 2 or sys.argv[1] != 'pre':
        return 0
    try:
        datos = json.load(sys.stdin)
    except ValueError:
        return 0
    cmd = (datos.get('tool_input') or {}).get('command') or ''
    if 'gcloud' not in cmd:
        return 0
    cwd = datos.get('cwd') or os.getcwd()

    borrar = re.search(r'gcloud\s.*\bsql\s+(instances|databases|backups)\s+delete\b', cmd) or \
        re.search(r'gcloud\s.*\bsql\s+instances\s+patch\b.*--no-deletion-protection', cmd)
    if borrar and not re.search(r'ROSANTA_NUBE_BORRAR=("[^"]+"|\'[^\']+\'|\S+)', cmd):
        bloquear('Bloqueado: esto borra la base de Rosanta o sus respaldos (o le quita la proteccion). '
                 'Solo con el si explicito de Juanma: ROSANTA_NUBE_BORRAR="motivo" <comando>.')

    publicar = re.search(r'gcloud\s.*\brun\s+(deploy|services\s+(replace|update))\b', cmd)
    if not publicar:
        return 0
    servicio = servicio_del_comando(cmd)
    SELLO = ruta_sello(servicio)
    if not os.path.exists(SELLO):
        bloquear('Bloqueado: no hay sello de la bateria de la nube para ' + servicio + '. Correr: python3 cloud/herramientas/sellar-nube.py' + ('' if servicio == SERVICIO_POR_DEFECTO else ' --servicio ' + servicio))
    try:
        sello = json.load(open(SELLO))
    except ValueError:
        bloquear('Bloqueado: el sello de la nube no se puede leer. Volver a sellar con sellar-nube.py.')
    if sello.get('fallas', 1) != 0 or sello.get('ok') != sello.get('total'):
        bloquear('Bloqueado: el sello de la nube tiene fallas.')
    actual = huella_actual(raiz_del_comando(cmd, cwd))
    if sello.get('huella') != actual:
        bloquear('Bloqueado: el codigo de cloud/ cambio despues de la ultima bateria (sello %s, disco %s). '
                 'Correr: python3 cloud/herramientas/sellar-nube.py' % (str(sello.get('huella'))[:12], actual[:12]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
