# Finanzas & Data OS · Tanda 5 · p142 y A11 · 15 sep 2026

Dos guardas de la batería. **Publicado en la @97** el 15-sep, con "publica" de Juanma. Batería: **118 OK · 0 fallas · 0 avisos · 3 saltadas · 173 s**. Un solo archivo tocado: `PruebasFinanzas.js`.

## Decisiones de Juanma (15-sep)

1. La prueba cubre **solo las vistas de Finanzas**. Las de Profit OS ya se evalúan por su ruta; Marketing y CRM son de otras sesiones.
2. La columna `META_FOOD_PCT` **se queda** en la pestaña METAS, muerta, cubierta por la prueba nueva.

## p142 · La batería ahora dibuja las vistas

- **Qué pasaba:** la batería solo evaluaba dos páginas, el panel y Profit OS. Las vistas de Finanzas se leían como texto con `getRawContent()`, así que un scriptlet mal cerrado pasaba en verde y la página no cargaba en producción. Pasó en la v81 (12-sep) y se cubrió a mano compilando cada plantilla.
- **Qué hace la prueba:** evalúa 15 dibujos con un usuario, una URL y un token de prueba:
  - **5 vistas** (La semana, Metas, Comparativo, Escenarios y Caja) **en sus dos modos**: con el botón "Panel principal" y embebidas en el shell;
  - **el shell** (`SistemaFinanzas`) **en sus 5 pestañas**.
- **Falla si** una revienta, sale con menos de 500 caracteres, no lleva el token o deja un scriptlet sin evaluar.
- **Control negativo adentro:** antes del barrido intenta dibujar una vista que no existe. Si eso no falla, el evaluador no está probando nada y la prueba lo dice en vez de quedar en verde. Es la única forma de probar el evaluador desde adentro: `HtmlService` no existe fuera de Apps Script.

## A11 · La meta de Metas

- **Qué pasaba:** `instalarMetas()` congeló la meta en la columna `META_FOOD_PCT` y `_finMeta_` la prefería sobre PARAMETROS. Cambiar PARAMETROS movía La semana y el RAA, y la tarjeta de Metas se quedaba en el número viejo. Se arregló el 14-sep y ninguna prueba lo cuidaba.
- **Qué hace la prueba:** compara la meta que devuelve Metas contra la de PARAMETROS y falla si se separan, nombrando la columna que volvería a mandar.

## Verificación

- **Node, con la prueba real:** 10 OK. El arnés simula el evaluador de Apps Script y ejerce la prueba con plantillas sanas, una rota, una vacía, una sin token, una con un scriptlet sin evaluar y con el evaluador muerto. En los cinco casos malos la prueba falla, y con las sanas da OK y reporta los 15 dibujos.
- **A11:** con una meta distinta en Metas, la guardiana falla y nombra `META_FOOD_PCT`.
- **Respaldo:** `rosanta-intranet/_backups/tanda5-2026-09-15/`.

## Pendiente

1. ~~Batería y publicación~~: hecho (@97).
2. **p162:** las 3 líneas SALTADA, que siguen sin verse. La prueba nueva no las explica: no salta, falla o pasa.
