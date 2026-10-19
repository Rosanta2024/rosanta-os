#!/usr/bin/env python3
"""
Sello de la bateria de la nube (17-oct-2026). Hermano de .claude/hooks/sellar-bateria.py.

    python3 cloud/herramientas/sellar-nube.py                       corre la bateria y, si da 0 fallas, sella rosanta-nube
    python3 cloud/herramientas/sellar-nube.py --servicio <nombre>   lo mismo para otro servicio de Cloud Run
    python3 cloud/herramientas/sellar-nube.py --huella              solo imprime la huella del codigo actual
    python3 cloud/herramientas/sellar-nube.py --servicio rosanta-bot-sombra   corre la bateria de cloud/bot (19-oct-2026)
    ... --carpeta bot                                               elegir a mano la carpeta cuya bateria se corre (app por defecto)

A diferencia de la intranet (cuya bateria corre en el navegador y la lee Juanma), esta bateria
corre aca mismo con Node: el conteo lo mide este script, nadie lo escribe a mano.

El sello vale SOLO para el codigo que se probo: guarda la huella (sha256) de cloud/app, cloud/bot (sin
node_modules) y cloud/db. Si cambia un archivo, la huella cambia y el candado
(.claude/hooks/candado-nube.py) no deja publicar hasta volver a sellar.
"""
import hashlib, json, os, re, subprocess, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../cloud

def rutas(servicio='rosanta-nube'):
    """Un sello por servicio de Cloud Run (17-oct-2026): sellar uno no pisa el de otro.
    rosanta-nube conserva el nombre de siempre (bateria-nube.json)."""
    if not re.match(r'^[a-z][a-z0-9-]{0,62}$', servicio):
        raise SystemExit('Nombre de servicio invalido: ' + servicio)
    base = 'bateria-nube' if servicio == 'rosanta-nube' else 'bateria-nube-' + servicio
    d = os.path.expanduser('~/.rosanta-sellos')
    return os.path.join(d, base + '.json'), os.path.join(d, base + '-historial.jsonl')


SELLO, HISTORIAL = rutas()
CARPETAS = ['app', 'bot', 'db']   # bot: el bot en sombra (19-oct-2026); cualquier cambio vence todos los sellos
# Que bateria corre cada servicio (carpeta con su package.json y test/); los demas, cloud/app.
CARPETA_POR_SERVICIO = {'rosanta-bot-sombra': 'bot', 'rosanta-bot-ensayo': 'bot'}
FUERA = {'node_modules', '.DS_Store', '__pycache__'}


def huella(raiz=RAIZ):
    h = hashlib.sha256()
    for c in CARPETAS:
        base = os.path.join(raiz, c)
        for d, subdirs, archivos in os.walk(base):
            subdirs[:] = sorted(s for s in subdirs if s not in FUERA)
            for a in sorted(archivos):
                if a in FUERA:
                    continue
                p = os.path.join(d, a)
                h.update(os.path.relpath(p, raiz).encode())
                h.update(b'\0')
                with open(p, 'rb') as f:
                    h.update(f.read())
                h.update(b'\0')
    return h.hexdigest()


def maximo_historico():
    m = 0
    if os.path.exists(HISTORIAL):
        for linea in open(HISTORIAL):
            try:
                m = max(m, json.loads(linea).get('total', 0))
            except ValueError:
                pass
    return m


def main():
    global SELLO, HISTORIAL
    servicio = 'rosanta-nube'
    if '--servicio' in sys.argv:
        servicio = sys.argv[sys.argv.index('--servicio') + 1]
        SELLO, HISTORIAL = rutas(servicio)
    carpeta = sys.argv[sys.argv.index('--carpeta') + 1] if '--carpeta' in sys.argv else CARPETA_POR_SERVICIO.get(servicio, 'app')
    if carpeta not in ('app', 'bot'):
        raise SystemExit('Carpeta invalida: ' + carpeta)
    if '--huella' in sys.argv:
        print(huella())
        return 0
    app = os.path.join(RAIZ, carpeta)
    antes = huella()
    t0 = time.time()
    p = subprocess.run(['node', '--test', '--test-reporter=tap'] + sorted(
        os.path.join('test', f) for f in os.listdir(os.path.join(app, 'test')) if f.endswith('.test.js')),
        cwd=app, capture_output=True, text=True, env=dict(os.environ, TZ='America/Guatemala'))
    salida = p.stdout + p.stderr
    def n(clave):
        m = re.search(r'^# ' + clave + r' (\d+)$', salida, re.M)
        return int(m.group(1)) if m else -1
    total, ok, fallas = n('tests'), n('pass'), n('fail')
    print('Bateria de la nube (cloud/%s): %d pruebas · %d OK · %d fallas · %.1f s' % (carpeta, total, ok, fallas, time.time() - t0))
    if total <= 0 or fallas != 0 or ok != total:
        print(salida[-3000:])
        print('NO se sella.')
        return 1
    if huella() != antes:
        print('El codigo cambio mientras corria la bateria. NO se sella: volver a correrla.')
        return 1
    maximo = maximo_historico()
    if total < maximo and '--acepto-conteo-menor' not in sys.argv:
        print('La bateria reviso %d pruebas y el maximo historico es %d. NO se sella sin --acepto-conteo-menor "motivo".' % (total, maximo))
        return 1
    os.makedirs(os.path.dirname(SELLO), exist_ok=True)
    sello = {'fecha': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'total': total, 'ok': ok, 'fallas': fallas, 'huella': antes}
    with open(SELLO, 'w') as f:
        json.dump(sello, f, indent=2)
    with open(HISTORIAL, 'a') as f:
        f.write(json.dumps(sello) + '\n')
    print('Sellado: ' + antes[:12] + ' · ' + os.path.basename(SELLO))
    return 0


if __name__ == '__main__':
    sys.exit(main())
