#!/usr/bin/env python3
"""Banco de pruebas local de las vistas de Finanzas de la intranet.

Toma una vista real de rosanta-intranet, le saca los scriptlets de Apps Script,
le pega Estilos/Logo y le enchufa un google.script.run de mentira que devuelve
los datos de datos.js. Sirve SOLO para ver el diseño en el navegador sin publicar.
No toca el proyecto de Apps Script.

  python3 construir.py                 # arma todas las vistas en salida/
"""
import os, re, sys, json

BASE = os.path.expanduser('~/Dev/Rosanta/apps-script/rosanta-intranet')
AQUI = os.path.dirname(os.path.abspath(__file__))
SAL  = os.path.join(AQUI, 'salida')

# Lo que devuelve cada funcion del servidor, por nombre.
RESPUESTAS = {
    'getFinanzasData': 'MOCK_FIN', 'refrescarFinanzas': 'MOCK_FIN',
    'getMetasData': 'MOCK_METAS',
    'getComparativoData': 'MOCK_CMP',
    'getRaaData': 'MOCK_RAA', 'guardarRaa': 'MOCK_RAA',
}

STUB = """
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="datos.js"></script>
<script>
/* google.script.run de mentira: contesta con los datos locales, con un retardo
   corto para que se vea el estado "cargando" igual que en la intranet. */
(function () {
  var RESP = %s;
  function nuevo() {
    var ok = null, mal = null;
    var api = {
      withSuccessHandler: function (f) { ok = f; return api; },
      withFailureHandler: function (f) { mal = f; return api; }
    };
    Object.keys(RESP).forEach(function (nombre) {
      api[nombre] = function () {
        var d = window[RESP[nombre]];
        setTimeout(function () {
          try { ok && ok(JSON.parse(JSON.stringify(d))); }
          catch (e) { mal && mal(e); }
        }, 250);
      };
    });
    return api;
  }
  window.google = { script: { run: nuevo(), host: { close: function () {} } } };
  Object.defineProperty(window.google.script, 'run', { get: nuevo });
})();
</script>
"""

def incluir(m):
    """Resuelve include('X') / incluirCrudo_('X') pegando el archivo."""
    nombre = m.group(1)
    ruta = os.path.join(BASE, nombre + '.html')
    return open(ruta, encoding='utf-8').read() if os.path.exists(ruta) else ''

def limpiar(txt, ctx):
    # <?!= include('X') ?>  y  <?!= incluirCrudo_('X') ?>
    txt = re.sub(r"<\?!?=?\s*(?:include|incluirCrudo_)\(\s*'([^']+)'\s*\)\s*\?>", incluir, txt)
    # <? if (mostrarVolver) { ?> ... <? } ?>  -> se BORRA con su contenido.
    # En la intranet esa cabecera solo sale cuando la vista se abre sola; dentro
    # del shell (?embed=1) no se dibuja. Dejarla aca apilaba dos barras verdes y
    # ensuciaba la revision del diseño.
    txt = re.sub(r"<\?\s*if\s*\(\s*mostrarVolver\s*\)\s*\{\s*\?>.*?<\?\s*\}\s*\?>",
                 '', txt, flags=re.S)
    txt = re.sub(r"<\?\s*if\s*\([^)]*\)\s*\{\s*\?>", '', txt)
    txt = re.sub(r"<\?\s*\}\s*\?>", '', txt)
    # <?= expr ?> y <?!= expr ?> -> el valor del contexto, o vacio
    def val(m):
        e = m.group(1).strip()
        # <?!= JSON.stringify(x) ?> tiene que salir como literal JS valido, no
        # vacio: "var T = ;" es un error de sintaxis y mata el script entero.
        if 'JSON.stringify' in e:
            return '"semana"' if 'sub' in e else '""'
        for k, v in ctx.items():
            if e == k or e.startswith(k + '.') or e.startswith(k + ' '):
                return str(v)
        if 'getFullYear() - 1' in e: return '2025'
        if 'getFullYear()'     in e: return '2026'
        return ''
    txt = re.sub(r"<\?!?=\s*(.+?)\s*\?>", val, txt, flags=re.S)
    txt = re.sub(r"<\?.*?\?>", '', txt, flags=re.S)   # lo que quede
    return txt

CTX = {'usuario.nombre': 'Juanma', 'usuario.email': 'restaurante@rosanta.rest',
       'usuario': 'Juanma', 'urlBase': '#', 'authToken': 'demo', 'mostrarVolver': 'true',
       'sub': '"semana"'}

VISTAS = ['FinanzasVista', 'FinanzasGastoVista', 'MetasVista', 'ComparativoVista', 'EscenariosVista', 'CajaVista']

def main():
    os.makedirs(SAL, exist_ok=True)
    stub = STUB % json.dumps(RESPUESTAS)
    for v in VISTAS:
        ruta = os.path.join(BASE, v + '.html')
        if not os.path.exists(ruta):
            print('  falta', v); continue
        html = limpiar(open(ruta, encoding='utf-8').read(), CTX)
        html = html.replace('</head>', stub + '</head>', 1)
        open(os.path.join(SAL, v + '.html'), 'w', encoding='utf-8').write(html)
        print('  ok', v + '.html')
    # el shell, con las vistas locales adentro
    sh = limpiar(open(os.path.join(BASE, 'SistemaFinanzas.html'), encoding='utf-8').read(), CTX)
    sh = sh.replace('</head>', '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1"></head>', 1)
    sh = sh.replace("B + '?page=finanzas-semana&embed=1' + T", "'FinanzasVista.html'")
    sh = sh.replace("B + '?page=finanzas-gasto&embed=1' + T",  "'FinanzasGastoVista.html'")
    sh = sh.replace("B + '?page=metas&embed=1' + T",           "'MetasVista.html'")
    sh = sh.replace("B + '?page=comparativo&embed=1' + T",     "'ComparativoVista.html'")
    sh = sh.replace("B + '?page=escenarios&embed=1' + T",      "'EscenariosVista.html'")
    sh = sh.replace("B + '?page=caja&embed=1' + T",            "'CajaVista.html'")
    open(os.path.join(SAL, 'index.html'), 'w', encoding='utf-8').write(sh)
    print('  ok index.html (el shell)')
    for f in ['datos.js']:
        open(os.path.join(SAL, f), 'w', encoding='utf-8').write(
            open(os.path.join(AQUI, f), encoding='utf-8').read())

if __name__ == '__main__':
    main()
