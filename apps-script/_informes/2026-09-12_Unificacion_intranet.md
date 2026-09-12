# Unificación de la intranet — 12 sep 2026

**PUBLICADO: versión 79, 12 sep 2026 13:07.**

Tres cosas, en este orden: se destrabó el push, se partió el archivo de 122 KB y el
panel principal pasó de cinco tarjetas a tres puertas. Nada de esto está publicado
todavía: el token de clasp está vencido y la batería no se pudo correr.

## 1. El push estaba trabado

`clasp status` respondía **"Conflicting files found"**. Sobrevivían tres `.gs` del 24 de
agosto al lado de su `.js` nuevo, y `.clasp.json` subía las dos extensiones: en Apps
Script las dos son el mismo archivo de servidor, así que eran **31 funciones globales
duplicadas** en un solo ámbito. Es el mismo problema que ya está documentado en
`Code.js` cuando la vista vieja de recetario pisó a la nueva.

Antes de mover nada se verificó que los `.gs` no tuvieran código propio: **toda** función
definida en cada uno existe también en su `.js`, y el `.js` es más nuevo y más grande en
los tres casos.

| archivo | `.gs` | `.js` |
|---|---|---|
| ConfigPOS | 163 líneas (24 ago) | 426 líneas (30 ago) |
| EdicionRecetario | 511 líneas (24 ago) | 689 líneas (30 ago) |
| SincronizarPrecios | 253 líneas (24 ago) | 608 líneas (10 sep) |

Los tres, más `Recetario_Rosanta_v11_intranet.html` (107 KB que no referencia nadie, de la
vista retirada el 21 ago), están en `_archivo/intranet-2026-09-12/`. **No se borró nada.**
`.clasp.json` ahora sube solo `.js`, para que un `.gs` suelto no vuelva a colisionar.

Resultado: 54 archivos rastreados, sin conflictos, **288 funciones globales y 0 duplicadas**.

## 2. CosteoVista.html: de 2.000 líneas a 194

Tenía el estilo, las siete pestañas, los paneles y el arranque en un solo archivo. Quedó
el esqueleto —cabecera, pestañas, secciones vacías y el orden de carga— y once parciales:

| parcial | líneas | qué tiene |
|---|---:|---|
| CosteoEstilos | 462 | el CSS del módulo |
| CosteoJs_Base | 215 | datos, estado, helpers, cálculo de costo y CMV, filtros |
| CosteoJs_Recetas | 37 | pestaña Recetas |
| CosteoJs_Insumos | 48 | pestaña Productos |
| CosteoJs_Proveedores | 29 | pestaña Proveedores |
| CosteoJs_Menu | 273 | ingeniería de menú |
| CosteoJs_Inicio | 137 | tablero operativo |
| CosteoJs_HigieneGuia | 96 | Higiene y Cómo funciona |
| CosteoJs_Pintar | 113 | llamadas al servidor, `pintar()`, cajón lateral |
| CosteoJs_Paneles | 124 | los paneles del cajón |
| CosteoJs_Acciones | 313 | `linea()`, listeners y arranque |

**Los `CosteoJs_*` no son islas.** Son el cuerpo de `iniciarApp()` pegado como texto: comparten
un solo ámbito, así que el orden importa y ninguno se puede llamar por separado.

Dos decisiones que hay que conocer antes de tocarlos:

- Se pegan con **`incluirCrudo_()`**, no con `include()`. `include()` lee con
  `createHtmlOutputFromFile`, que **sanitiza** —sobre este mismo archivo devolvía 108.722 de
  121.691 caracteres— y se comería pedazos de JavaScript sin avisar. `incluirCrudo_()` usa
  `getRawContent()`.
- Lleva **guion bajo a propósito**: devuelve el código fuente de cualquier archivo del
  proyecto, y una función sin guion bajo la puede llamar cualquiera con `google.script.run`.
  Desde la plantilla sirve igual, porque los scriptlets corren del lado del servidor.

Verificación del corte: se reconstruyó el archivo original pegando los parciales y dio
**122.147 bytes exactos, cero diferencia**, con las 15 líneas de referencia en su número
original. El respaldo del archivo entero, antes del corte, quedó en
`_archivo/intranet-2026-09-12/CosteoVista.PRE-SPLIT.html`.

Las dos pruebas de `Pruebas.js` que barren las vistas buscando llamadas sin token **ya
incluyen los diez parciales**. Sus llamadas se fueron con ellos: lo que no se lee, no se
protege.

## 3. El panel principal: de cinco tarjetas a tres puertas

Tres de las cinco tarjetas eran el mismo pilar y el mismo permiso (`finanzas`): el panel
mezclaba pilares con vistas de adentro y crecía una tarjeta por pantalla nueva.

Ahora hay un shell **`SistemaFinanzas`** con panel lateral —La semana · Metas de la semana ·
2026 contra 2025—, con el mismo patrón y los mismos estilos `.sm-*` que el de Marketing: el
lateral cambia de vista en el cliente, sin recargar, y cada vista conserva su scroll.

- `?page=finanzas` es el shell. Las de adentro: `?page=finanzas-semana`, `?page=metas`,
  `?page=comparativo`.
- **Los enlaces directos siguen sirviendo** —el de Metas anda circulando por el equipo—, con
  su botón "Panel principal" intacto.
- Dentro del shell las tres se abren con `&embed=1`, que esconde ese botón: ahí adentro se
  saltaba el lateral y sacaba al usuario de la sección de un clic.
- Las tres pasaron a `setXFrameOptionsMode(ALLOWALL)`, que es lo que el shell necesita para
  embeberlas.

El panel queda en: **Finanzas & Data · Profit OS · Sistema de Marketing** (o Contenido).
La tarjeta de Profit OS dice ahora lo que de verdad hay adentro: el tablero y la ingeniería
de menú, además del recetario, los productos y los proveedores.

## Estado al cierre (12 sep, 12:25)

**Publicado como versión 79** (antes estaba la 78).

- **Login.** El token vencido se reemplazó, pero el primer `clasp login` quedó a nombre de
  `juanma.lemus@gmail.com` aunque clasp imprimió "You are logged in as restaurante@rosanta.rest".
  Se detectó pidiendo `tokeninfo` del access_token de `~/.clasprc.json`: **no creerle al mensaje
  de clasp, verificar la cuenta del token.** El segundo intento dio 400 porque Chrome mandó
  `authuser=1`; se resolvió pegando la URL de autorización en una ventana de incógnito.
- **Antes del push** se bajó lo vivo a una carpeta aparte: el `CosteoVista.html` publicado era
  **idéntico byte a byte** al respaldo pre-corte. El corte se hizo sobre lo que corre, no sobre
  una copia vieja.
- **Push.** Clasp contestó "Script is already up to date", pero entró: el proyecto pasó de 54 a
  **69 archivos** y los 69 son idénticos a los de disco. Verificar contra lo vivo, no contra lo
  que imprime clasp.
- **`clasp run` ya no alcanza.** Con el cliente OAuth por defecto de clasp funciona push, pull y
  list-deployments, pero `scripts.run` contesta "Unable to run script function": pide el cliente
  del proyecto (`clasp-creds.json`). La batería se corrió desde el navegador, contra el código
  subido: `…/s/AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=pruebas` (solo rol dueño).

**Batería: 89 pruebas · 84 OK · 2 fallas · 1 aviso · 2 saltadas · 217,7 s.** Son las 73 de
antes más las 16 nuevas de Finanzas: no encogió. **Grupos 1 a 7 sin fallas**, lo de esta sesión
incluido; "Las tarjetas del panel conservan el token" da 3, que es el panel nuevo.

Las dos fallas son del grupo 8, del pilar Finanzas (otra sesión trabajando en paralelo):

1. *La pestaña RAA existe* — esperada. Se crea una vez con `instalarRAA()`.
2. *La planilla se lee del Sheet, no del código* — **no esperada**: 0 meses del Sheet, 8 del
   respaldo hardcodeado. Además deja dos pruebas en verde que no midieron nada ("El Sheet de
   planilla y el respaldo no se contradicen", sin meses comunes; y "Las dos lógicas espejo",
   Q0 contra Q0).

**Se publica una sola vez, cuando Finanzas resuelva la planilla.** Dos `create-version`
seguidos publicarían lo de una sesión a medias.

### Verificación local previa

Lo que sí se verificó en local: `clasp status` limpio, 0 funciones duplicadas, el render de
CosteoVista con sus once parciales pegados **pasa el parser de JavaScript**, y todas las
variables de plantilla de cada vista coinciden con las que `Code.js` le pasa.

## Publicación (12 sep, 13:07)

- **RAA creada** antes de publicar: `instalarRAA()` desde el editor, con la cuenta de rosanta
  (13:01:16 → 13:01:19, sin pedir permisos). La pestaña quedó en `Rosanta_Intranet_Config`,
  no en el maestro.
- **Batería contra HEAD: "Intranet sana", 87 OK · 0 fallas · 1 aviso · 2 saltadas = 90.** El aviso
  es el del token del CRM (24 de 27).
- **Última comprobación antes de congelar:** HEAD se bajó otra vez y era idéntico a lo que midió
  la batería. Lo confirmaron por separado esta sesión y la de Finanzas.
- **Se publicó SIN `clasp push`.** Había tres sesiones más con cambios en disco sin probar (CRM,
  pruebas). `create-version` congela lo que está en el servidor, no lo del disco.
- **Verificado:** el deployment del equipo está en `@79`, y `clasp pull --versionNumber 79` dio
  69 archivos idénticos a lo probado.

Queda afuera de la 79, para la próxima versión: el token del CRM (CrmVista.html, CrmDatos.js) y
los barridos nuevos de pruebas (Pruebas.js, PruebasFinanzas.js). Los coordinan las sesiones del
pilar 03: un solo push, batería, y la versión 80 la autoriza Juanma.

## Verificación en producción (versión 79, 13:10)

Recorrida con la cuenta de rosanta sobre el enlace `/exec` publicado:

- **Panel principal:** tres tarjetas — Finanzas & Data · Profit OS · Sistema de Marketing.
- **Profit OS, las siete pestañas con datos:** Inicio (tablero), Ingeniería de menú (matriz:
  7 estrella · 7 caballo · 4 rompecabezas · 3 perro · 16 sin costo), Recetas (35 de 75), Productos
  (217), Proveedores, Higiene (40 líneas fuera del Banco, las mismas 9 fichas vacías) y Cómo
  funciona. **El corte en parciales funciona en producción.**
- **La semana abierta sola** (`?page=finanzas-semana&embed=1`): carga con datos y sin el botón
  "Panel principal", como tiene que ser.

**ABIERTO — el recuadro de los shells sale vacío.** Finanzas & Data muestra el lateral con sus
cuatro vistas, pero el recuadro de la derecha queda en blanco a los 30 s. **El shell de Marketing,
que ya existía, sale igual de vacío en la misma ventana**, así que no lo introdujo el shell nuevo:
es el embebido por iframe. `Code.js` ya lo advertía ("el iframe del shell depende de cookies de
terceros y Chrome ya las está retirando"), y por eso Daniel y Vanessa entran directo a Marketing
OS sin pasar por el shell. Falta confirmar si pasa también en el Chrome normal de Juanma o solo en
la ventana de automatización. Si pasa en el suyo, los dos shells están rotos para el equipo y hay
que cambiar el lateral para que navegue en vez de embeber.

## Versión 80 (publicada después, por las sesiones del pilar 03)

El equipo quedó en **@80**. Se bajó con `clasp pull --versionNumber 80` y se comparó contra la 79:
cambian **solo cuatro archivos**, todos del CRM y de pruebas: `CrmDatos.js`, `CrmVista.html`,
`Pruebas.js` y `PruebasFinanzas.js`. **Los 15 archivos de la unificación son idénticos a la 79**;
`CosteoVista` re-armado desde sus parciales sigue dando el original, y las listas VISTAS de
`Pruebas.js` siguen llevando los `CosteoJs_*` y `SistemaFinanzas`. Lo de esta sesión viaja intacto
en la 80.

## Cierre del recuadro vacío (12 sep)

**No era un fallo: era la ventana de automatización.** En el Chrome de Juanma, perfil Work, el shell de
Finanzas & Data carga "La semana" con sus datos dentro del recuadro. La ventana que maneja Claude en
Chrome bloquea cookies de terceros y por eso el iframe salía en blanco, igual en el shell de Marketing.
Un iframe vacío visto desde la automatización no prueba nada; se confirma en el Chrome de la persona.

Queda un detalle visual en el shell: **doble cabecera.** La barra verde del shell ("FINANZAS & DATA")
y, adentro del recuadro, la barra verde de la propia vista ("FINANZAS"). Con `embed=1` ya se oculta
el botón "Panel principal" de la vista, pero no su barra entera.

## Versión 81 — doble cabecera (en preparación)

Aprobada por Juanma. Dentro del shell, cada vista de Finanzas oculta su barra `<header class="app">`
ENTERA con `?embed=1`, no solo el botón "Panel principal". Cambian cuatro vistas: FinanzasVista,
MetasVista, ComparativoVista y EscenariosVista. No se toca `Code.js`: `mostrarVolver` ya llegaba en
los cuatro `render_`. Abiertas directo, las vistas se ven igual que antes.

- Se preparó sobre copias en el scratchpad. En las cuatro queda igual la cantidad de `if`, cierres,
  `header` y enlaces "volver".
- Antes de copiar al repo se verificó que los cuatro archivos siguieran idénticos a las copias
  tomadas, para no pisar a otra sesión. Después de copiar, disco contra HEAD = exactamente esos cuatro.
- Mismo día: `CLAUDE.md` actualizado. La batería se corre en el navegador, más las reglas de clasp,
  sesiones en paralelo, parciales e iframes. El respaldo del anterior quedó en `tools/`.

Falta: el resultado de la batería de la sesión 0f (su cambio de pruebas ya está en HEAD). Después,
push de Juanma, batería, `create-version` 81 y `update-deployment`.

**Chequeo de plantillas antes del push.** La batería evalúa solo dos páginas: el panel
(`Pruebas.js:226`, `Index.evaluate()`) y Profit OS (`Pruebas.js:270`, `doGet` con `page=costeo`).
Esa segunda arma CosteoVista con sus once parciales, así que **las baterías de hoy ya dibujaron del
lado del servidor el CosteoVista partido**. Las demás vistas, incluidas las cuatro de Finanzas y
SistemaFinanzas, solo se leen con `getRawContent()`: ahí un scriptlet mal cerrado pasa en verde y
en producción rompe la vista entera. Para
cubrirlo, cada plantilla se convirtió al JavaScript que arma HtmlTemplate (texto → salida literal,
`<?= ?>` y `<?!= ?>` → expresión, `<? ?>` → código) y se pasó por `node --check`. Resultado: las
cuatro vistas de Finanzas compilan antes y después del cambio, y también SistemaFinanzas, Index y
CosteoVista. Control negativo sobre una copia: un `if` sin cerrar, un cierre de más y un
`<?# ?>` los detecta los tres. El chequeo sí es capaz de fallar.

Sugerencia pendiente, de la sesión 6b, no hecha: una prueba que evalúe las cinco vistas de Finanzas
(las cuatro más SistemaFinanzas) con `mostrarVolver` en true y en false, con usuario, urlBase y
authToken de prueba, y confirme que no revientan. Cerraría ese hueco para siempre.

**Push de la 81 verificado.** Juanma subió; HEAD bajado aparte = disco (68 archivos + manifiesto), y
las cuatro vistas en HEAD son byte a byte las preparadas. Abiertas en `/dev` (código subido), las
ocho combinaciones se dibujan sin error y con datos:

| vista | directa | `embed=1` |
|---|---|---|
| La semana (FinanzasVista) | barra + "Panel principal" | sin barra |
| Metas | barra + "Panel principal" | sin barra |
| 2026 contra 2025 | barra + "Panel principal" | sin barra |
| Escenarios | barra + "Panel principal" + "Ir a Finanzas" | sin barra ni "Ir a Finanzas" |

**Batería de la 81 contra HEAD:** "Intranet sana", 88 OK · 0 fallas · 0 avisos · 2 saltadas = 90,
en 150,4 s. Es el mismo número que dio 0f antes del cambio: las cuatro barras no movieron nada.
Listo para `create-version` 81 + `update-deployment`.

## Versión 81 publicada (12 sep)

**El equipo está en @81.** Se bajó con `clasp pull --versionNumber 81`: es idéntica, archivo por
archivo, al HEAD que dio 90 · 88 OK · 0 fallas · 0 avisos. Contra la 80 cambian solo las cuatro vistas
de Finanzas y las dos pruebas de la sesión 0f. Juanma confirmó en `/exec`, desde su Chrome, una
sola barra verde dentro del shell. **La doble cabecera queda cerrada.**

Con esto la unificación queda terminada: panel de tres puertas, Profit OS en parciales, shell de
Finanzas con lateral y una sola cabecera, y el push destrabado. Lo abierto de la intranet ya no es
de esta sesión: probar el CRM con el enlace de un usuario real (p138, pilar 03).
