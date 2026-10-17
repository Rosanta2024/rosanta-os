#!/usr/bin/env python3
"""
Simulador del candado de la nube (17-oct-2026). Corre candado-nube.py con comandos de mentira y
un HOME temporal (nunca toca ~/.rosanta-sellos). Correrlo despues de tocar el candado:

    python3 .claude/hooks/prueba-candado-nube.py
"""
import importlib.util, json, os, shutil, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
CANDADO = os.path.join(AQUI, 'candado-nube.py')
spec = importlib.util.spec_from_file_location('s', os.path.join(REPO, 'cloud', 'herramientas', 'sellar-nube.py'))
S = importlib.util.module_from_spec(spec); spec.loader.exec_module(S)


def correr(cmd, home):
    p = subprocess.run([sys.executable, CANDADO, 'pre'], input=json.dumps({'tool_input': {'command': cmd}, 'cwd': REPO}),
                       capture_output=True, text=True, env=dict(os.environ, HOME=home))
    return 'deny' if '"deny"' in p.stdout else 'pasa'


def sellar(home, **k):
    os.makedirs(os.path.join(home, '.rosanta-sellos'), exist_ok=True)
    s = {'total': 9, 'ok': 9, 'fallas': 0, 'huella': S.huella()}
    s.update(k)
    json.dump(s, open(os.path.join(home, '.rosanta-sellos', 'bateria-nube.json'), 'w'))


DEPLOY = 'gcloud run deploy rosanta-nube --source cloud/app --region northamerica-south1'
casos = []
home = tempfile.mkdtemp()
try:
    casos.append(('Sin sello no se publica', correr(DEPLOY, home), 'deny'))
    sellar(home)
    casos.append(('Con sello vigente se publica', correr(DEPLOY, home), 'pasa'))
    casos.append(('services update tambien pide sello (vigente: pasa)', correr('gcloud run services update rosanta-nube --region x', home), 'pasa'))
    sellar(home, huella='otra')
    casos.append(('Codigo cambiado despues del sello: no se publica', correr(DEPLOY, home), 'deny'))
    casos.append(('services replace con codigo cambiado: no', correr('~/google-cloud-sdk/bin/gcloud run services replace s.yaml', home), 'deny'))
    sellar(home, fallas=1, ok=8)
    casos.append(('Sello con fallas: no se publica', correr(DEPLOY, home), 'deny'))
    casos.append(('Borrar la base: bloqueado', correr('gcloud sql instances delete rosanta-db', home), 'deny'))
    casos.append(('Borrar una base de datos: bloqueado', correr('gcloud sql databases delete rosanta --instance rosanta-db', home), 'deny'))
    casos.append(('Quitar la proteccion: bloqueado', correr('gcloud sql instances patch rosanta-db --no-deletion-protection', home), 'deny'))
    casos.append(('Borrar con el si de Juanma: pasa', correr('ROSANTA_NUBE_BORRAR="prueba archivada" gcloud sql instances delete x', home), 'pasa'))
    casos.append(('Leer la base no se toca', correr('gcloud sql instances describe rosanta-db', home), 'pasa'))
    casos.append(('Un comando sin gcloud no se toca', correr('npm test', home), 'pasa'))
finally:
    shutil.rmtree(home, ignore_errors=True)

malos = 0
for nombre, obtenido, esperado in casos:
    ok = obtenido == esperado
    malos += not ok
    print(('OK   ' if ok else 'FALLA') + ' ' + nombre + ('' if ok else ' (dio %s, esperaba %s)' % (obtenido, esperado)))
print('%d/%d' % (len(casos) - malos, len(casos)))
sys.exit(1 if malos else 0)
