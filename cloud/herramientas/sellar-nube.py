#!/usr/bin/env python3
"""
Sello de la bateria de la nube (17-oct-2026). Hermano de .claude/hooks/sellar-bateria.py.

    python3 cloud/herramientas/sellar-nube.py            corre la bateria y, si da 0 fallas, sella
    python3 cloud/herramientas/sellar-nube.py --huella   solo imprime la huella del codigo actual

A diferencia de la intranet (cuya bateria corre en el navegador y la lee Juanma), esta bateria
corre aca mismo con Node: el conteo lo mide este script, nadie lo escribe a mano.

El sello vale SOLO para el codigo que se probo: guarda la huella (sha256) de cloud/app (sin
node_modules) y cloud/db. Si cambia un archivo, la huella cambia y el candado
(.claude/hooks/candado-nube.py) no deja publicar hasta volver a sellar.
"""
import hashlib, json, os, re, subprocess, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../cloud
SELLO = os.path.expanduser('~/.rosanta-sellos/bateria-nube.json')
HISTORIAL = os.path.expanduser('~/.rosanta-sellos/bateria-nube-historial.jsonl')
CARPETAS = ['app', 'db']
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
    if '--huella' in sys.argv:
        print(huella())
        return 0
    app = os.path.join(RAIZ, 'app')
    antes = huella()
    t0 = time.time()
    p = subprocess.run(['node', '--test', '--test-reporter=tap'] + sorted(
        os.path.join('test', f) for f in os.listdir(os.path.join(app, 'test')) if f.endswith('.test.js')),
        cwd=app, capture_output=True, text=True)
    salida = p.stdout + p.stderr
    def n(clave):
        m = re.search(r'^# ' + clave + r' (\d+)$', salida, re.M)
        return int(m.group(1)) if m else -1
    total, ok, fallas = n('tests'), n('pass'), n('fail')
    print('Bateria de la nube: %d pruebas · %d OK · %d fallas · %.1f s' % (total, ok, fallas, time.time() - t0))
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
    print('Sellado: ' + antes[:12])
    return 0


if __name__ == '__main__':
    sys.exit(main())
