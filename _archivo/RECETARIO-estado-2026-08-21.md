# Recetario + Proveedores en la intranet — estado al 21 ago 2026

Documento para retomar. Lo que está hecho, lo que falta y las trampas que ya me comí.

---

## 1 · Dónde vive todo

El proyecto **no** está en la ruta que decía el handoff original
(`~/Documents/Claude/Projects/Claude/rosanta-intranet/`). Está en:

```
~/Dev/Rosanta/apps-script/rosanta-intranet
```

y los archivos son **`.js`, no `.gs`**. El `.clasp.json` ya apunta bien.

| Cosa | ID |
|---|---|
| Proyecto Apps Script "Rosanta Intranet" | `1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42` |
| **Recetario cocina v11 (hoja NATIVA) — VIGENTE** | `17MHWnzLisvIDltQFgInkUEmBKcr3x0zJNwl9yAgLr3E` |
| ~~Recetario cocina v9~~ (superado, no usar) | `1C9eQkDYbJtSW-cQE_qNOdNgwKzUsVB-5UM-qvYZMmSk` |
| Recetario barra | `1LeoX3xpemoYEj130qnTTMzn4OCgLsZx1PvPRW-2LRnk` |
| Rosanta_Costeo_Proveedores | `1KvoEVKYMsF85PyyR8SLmocZaWO-PXMQaPhXI-z1Xy7M` |
| Inventario cocina (FIN_JULIO_26) | `1P0cp0xevmmqXg7DoLIqxucKTHfMeY-PTDprzFWthGOU` |
| Inventario barra (de José Mazate) | `1bjChxTx1wYy8zU0ELHKvuGb0Yb_DCfOfww9paj_dPk0` |
| Config intranet (hoja USUARIOS) | `1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw` |

Las cinco primeras ya están cargadas en **Propiedades de la secuencia de comandos**
con los nombres `RECETARIO_*_SHEET_ID`, `COSTEO_SHEET_ID` e `INVENTARIO_*_SHEET_ID`.

---

## 2 · Lo que quedó funcionando

**El recetario de cocina es hoja nativa.** La v9 no estaba en Drive, solo en el Mac. La subí
a `Rosanta OS/04_Profit_OS/Recetario` y la convertí con *Guardar como hoja de cálculo de
Google*. Los VLOOKUP sobrevivieron: verifiqué `ENSALADA ROSANTA!E5` y `QUESO HORNEADO!E6`,
las dos con `=IFERROR(VLOOKUP(Bn,'BANCO DE DATOS'!$C:$D,2,0),"")` viva.

**El módulo está instalado y desplegado en HEAD.** `ConfigCosteo.js`, `CosteoDatos.js`,
`Proveedores.js`, `CosteoVista.html`, más la ruta `?page=costeo` en `Code.js` y la tarjeta
del Index apuntando ahí.

**`crearHojaCosteo()` y `probarCosteo()` corrieron bien.** El log dio:

```
COCINA -> 31 platos | 40 pre-elaborados | 31 con CMV
BARRA  -> 27 platos | 29 pre-elaborados
CONTROL mix de fritas: 67.9 -> OK
CONTROL tabla de jamones y quesos: 23.0 -> OK
CONTROL gratin de papas: 19.8 -> OK
fichas sin ingredientes y sin precio: 1
```

Dos desviaciones contra lo esperado, las dos explicadas y benignas:

- **31 con CMV en vez de 24.** Son los 7 platos nuevos de la carta 2027. Sus fichas están
  vacías pero la celda CMV % ACTUAL dice `0.0%`, no está en blanco, y el contador cuenta
  "distinto de null". 31 − 7 = 24. La conversión a hoja nativa hizo que Google *calculara*
  esas fórmulas, que en el `.xlsx` venían sin valor; por eso el 24 de referencia era viejo.
- **1 ficha sin ingredientes.** Era `INFUSION DE HIERBAS DEL JARDIN`, ya resuelta (ver abajo).
  **No** era una hoja de control mal leída, así que no había que meterla en `tabsNoReceta`.

**El importador de inventarios existe y ya corrió.** `InventarioImport.js`, archivo nuevo
que no reescribe nada del módulo. Aplicó **26 precios** al Banco, sembró **12 proveedores**
y omitió 7 por salto sospechoso. El efecto se ve en RESUMEN CMV: el lomito subió de Q58 a
Q69 y arrastró a Lomito en Tiras (39.6 % → 41.9 %), Ensalada con Lomito (29.1 % → 31.3 %)
y Lomito Rosanta (25.6 % → 28.0 %).

**La infusión quedó costeada.** 2.5 g de cada hierba por 500 ml de agua → Q4.29 el batch,
rinde 500 ml, **Q0.008589 por ml**. En el Banco la celda quedó *enlazada a la ficha*, no
con el número pegado, así que si barra cambia la receta el precio se actualiza solo.

---

## 3 · El recetario viejo se retiró

`Recetario.js` y `RecetarioVista.html` **ya no existen** en el proyecto, y la ruta
`?page=recetario` se quitó de `Code.js`.

El motivo no fue estético: `leerFicha_` y `primerNumero_` estaban definidas **dos veces**,
en el módulo viejo y en el nuevo. En Apps Script todos los `.gs` comparten un único ámbito
global y gana la última definición cargada; `Recetario` ordena después de `CosteoDatos`,
así que el `leerFicha_` viejo pisaba al nuevo. El viejo devuelve `ingredientes: 0` — un
número — y por eso `crearHojaCosteo()` moría con `r.ingredientes.forEach is not a function`.

Si alguna vez hay que recuperarlos: están en el historial de versiones del proyecto de
Apps Script, y hay copias en Drive con el tamaño exacto — `Recetario.js` (5808 B,
`1cVoh4V2MPgoy1XZUUz5uxAF8SskaVJEB`) y `RecetarioVista.html` (7367 B,
`1am0WLzfy0JrO902u7lusJMo__EQ9M1_h`).

> El módulo de permiso `'recetario'` **sigue vivo** — es la puerta que usa todo lo demás.
> Lo que se retiró fue la vista vieja, no el permiso.

---

## 3.bis · Migración a v11 (22 ago)

El archivo vigente pasó a ser **`Rosanta_Recetario_Cocina_2027_v11.xlsx`**, no la v9 con la que
se instaló. Lo que se hizo:

- v11 subida a Drive y convertida a hoja nativa → `17MHWnzLisvIDltQFgInkUEmBKcr3x0zJNwl9yAgLr3E`.
- **VLOOKUP verificado post-conversión**: `ENSALADA ROSANTA!E5` sigue con
  `=IFERROR(VLOOKUP(B5,'BANCO DE DATOS'!$C:$D,2,0),"")` resolviendo. La ficha da Q11.92,
  idéntico al changelog.
- `RECETARIO_COCINA_SHEET_ID` repuntado a la v11.
- **`'cambios v11'` agregado a `COSTEO.tabsNoReceta`**: la v11 tiene 88 hojas, y la nueva es
  `CAMBIOS v11`. Sin esto el lector la toma como ficha de receta.
- Valores de control de `probarCosteo()` actualizados a los de v11:
  **mix de fritas 23.6 · tabla de jamones 22.6 · gratín 19.8** (los de v9 eran 67.9 / 23.0 / 19.8;
  el mix se desplomó porque la malanga pasó de Q45/libra a Q45/unidad).

### `probarCosteo()` contra la v11 — pasa limpio

```
COCINA -> 31 platos | 40 pre-elaborados | 31 con CMV | insumos 217
BARRA  -> 27 platos | 29 pre-elaborados | 27 con CMV | insumos 183
CONTROL mix de fritas: leido 23.6 esperado 23.6 -> OK
CONTROL tabla de jamones y quesos: leido 22.6 esperado 22.6 -> OK
CONTROL gratin de papas: leido 19.8 esperado 19.8 -> OK
lineas sin match en el Banco de Datos: 38
fichas sin ingredientes y sin precio: 0
```

**Los tres controles OK y cero fichas basura** — que era el objetivo del encargo original.
El cero salió de dos cosas: `CAMBIOS v11` excluida en `tabsNoReceta`, y la infusión de
hierbas del jardín ya con sus cantidades.

Las 38 "líneas sin match" son cordiales y maceraciones de barra que se usan en cócteles pero
no están dadas de alta como insumo. No es bloqueante; es material para la pestaña Higiene.

### La vista leyendo v11

Recorrida de nuevo sobre el test deployment. Los 12 platos visibles coinciden **exacto** con
la tabla del changelog:

| Plato | Changelog | Vista |
|---|---|---|
| Ensalada Rosanta | Q11.92 · 15.9% | Q11.92 · 15.9% |
| Ensalada con Lomito | Q31.01 · 31.0% | Q31.01 · 31.0% |
| Queso Horneado | Q42.55 · 30.4% | Q42.55 · 30.4% |
| Tabla de Jamones y Quesos | Q47.53 · 22.6% | Q47.53 · 22.6% |
| Tartar de Hongos | Q29.50 · 29.5% | Q29.50 · 29.5% |
| Lomito Rosanta | Q50.82 · 26.7% | Q50.82 · 26.7% |

Con la v11 casi toda la carta pasó a **EN META** (verde). El Queso Horneado bajó de 51.4% a
30.4% por la corrección del camembert a media unidad en v10.

### Cómo correr los chequeos sin equivocarse

Se agregó **`Diagnostico.gs`**, con una sola función: `DIAGNOSTICO()`, que llama a
`probarCosteo()`. Existe porque el desplegable del editor no fija la selección y el botón Run
ejecuta la primera función del archivo abierto — eso hizo correr `getCosteoData` tres veces
creyendo que se corría `probarCosteo`. Con un archivo de una sola función, Run no se puede
equivocar. Igual conviene confirmar en el panel de Ejecuciones qué corrió.

### El importador NO debe correrse contra la v11

`importarInventario()` se corrió sobre el Banco de **la v9**, que ya quedó fuera de uso, así que
esos 26 precios son agua pasada. **No hay que repetirlo sobre la v11**, porque la v11 ya trae
la sincronización de julio hecha a mano y con criterio, y el importador la desharía:

- La **papa** quedó en Q7 por decisión documentada (el archivo de julio se contradice
  consigo mismo: la lista de precios dice Q3 y el bloque de existencias dice Q7). El importador
  aplica Q3.
- La **malanga** pasó a Q45 por unidad con la ficha en 1 unidad; el importador la lee como otro
  producto y no entiende el cambio de unidad.
- La **mayonesa de aguacate** se corrigió de Q118.23 a Q6.07 leyendo su propia ficha, no el
  inventario.

Si en algún momento se quiere reactivar el importador para cocina, primero hay que decidir
quién manda: el inventario o las correcciones manuales del recetario.

## 4 · Lo que falta

### Publicado ✅ (22 ago)

El web app pasó a **Version 40**. La ruta `?page=costeo` está viva para el equipo en:

```
https://script.google.com/a/macros/rosanta.rest/s/AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb/exec?page=costeo
```

Verificado en producción: la pestaña **Productos** lista los 217 insumos con proveedor,
precio de compra y en cuántas recetas se usa cada uno (Lomito Q69/libra de Asunción en 5
recetas, Brisket Q40). Todo leyendo la v11.

**El paso 7 ya se hizo y pasó** (22 ago, sobre el *test deployment*
`https://script.google.com/macros/s/AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=costeo`):

- Toggle Cocina/Barra cambia la lista **y la meta**: cocina 31 de 71 con META 30 %,
  barra 27 de 56 con META 20 %.
- Ensalada Rosanta: **9 líneas**, subtotal Q11.11, costo Q12.22. El esperado era
  Q11.86 / Q13.04, y la diferencia es exactamente Q0.75 — el aguacate bajó de Q3.00 a
  Q1.50 con el import y la ficha lleva 0.5 unidad. Cuadra al centavo.
- El botón **"ver receta ›"** funciona: desde la Ensalada salta al pre-elaborado
  *Melocoton Macerado* (subtotal Q145.06, ~22 porciones, Q6.92 por porción). Resuelve bien
  el alias — en el Banco se llama "Melocotones macerados".
- **Higiene** carga: 38 líneas fuera del Banco, 7 fichas vacías (los platos nuevos 2027).
- **Cómo funciona** carga completa.

Cada ingrediente muestra además su proveedor, que es lo que sembró el importador.

> **Falta publicar.** Todo lo anterior se verificó en el deployment de prueba, que sirve
> HEAD y solo ve Juanma. Para que lo vea el equipo hace falta
> `Deploy > Manage deployments > Edit > New version`.

### Accesos

Ni Jeffry ni José pueden entrar todavía, y no es por permisos sino por diseño:

- **Chef · Jeffry Lopez** — `jeffryandersson102@gmail.com`
- **Mixólogo · José Mazate** — `jose.mazate321@gmail.com`

Los dos usan **Gmail personal**. El módulo resuelve al usuario con `getUsuarioActual()`,
que lee `Session.getActiveUser().getEmail()`, y en una web app *USER_DEPLOYING* + acceso
*ANYONE* eso viene vacío para quien no es del dominio. Resultado: la página carga (porque
`doGet` sí resuelve por `?u=<token>`) pero toda llamada de datos muere con
`Sin acceso al recetario` — peor que un rechazo limpio.

La intranet ya tiene la solución: `getUsuarioPorToken_()` y `resolverUsuario_(auth)` en
`Config.js`. Falta cablearla en los 5 puntos de entrada del módulo y hacer que
`CosteoVista.html` mande el `authToken`. Decisión del 21 ago: **no tocarlo todavía**, por
ahora lo usa solo Juanma. Cuando se retome, los dos van con el módulo `recetario` y ven
cocina y barra completas (ya aceptado).

### Pendientes menores

- **Valores de referencia de `probarCosteo()` viejos.** Los 67.9 / 23.0 / 19.8 son la foto
  de *antes* del import. La Tabla sigue en 23.0, pero Mix de Fritas y Gratín llevan papa
  (Q7 → Q3), así que bajaron. Quien corra `probarCosteo()` va a ver `REVISAR` y no es un
  error. Hay que actualizarlos en `CosteoDatos.js`.
- **7 precios omitidos** por salto > 60 %: Arugula, Limón, Pimienta Negra, Plátanos,
  Tomate Cherry, Uvas, Yuca. Si están bien, `importarInventario(true)` los aplica.
- **Mayo y junio de cocina siguen en `.xlsx`.** El importador solo puede leer julio, que es
  hoja nativa. Si se quiere histórico, hay que convertirlos.
- **Papelera de Drive**: quedaron 6 `.xlsx` viejos del recetario de cocina y una hoja
  huérfana `Rosanta_Costeo_Proveedores` de 1 KB (`1MihkABY4fFGerdfz-o9tyl4UTJSTCe99hkEGdeU9qt4`)
  del primer intento fallido. No los pude mandar a papelera desde la sesión.
- **`ConvertirRecetarios.js`** tiene IDs viejos apuntando a un xlsx de cocina que ya no se
  usa. No corre (está guardado tras un `if`), pero es una trampa para el próximo que lo lea.

---

## 5 · Trampas que ya me comí

**El desplegable de funciones del editor de Apps Script no fija la selección de forma
fiable.** Tres veces creí correr `probarCosteo()` o `importarInventario()` y en realidad
corrió `getCosteoData` o `previsualizarInventario`. **Siempre verificar en el panel de
Ejecuciones qué corrió de verdad** antes de dar por bueno un resultado. Pulsar `Escape`
después de elegir la función parece revertir la selección.

**`clasp` pierde la sesión** con `invalid_grant / invalid_rapt`. Se arregla con
`clasp login`; no hay forma de evitarlo desde un script.

**El proyecto no está bajo git.** Cualquier borrado depende del historial de Apps Script.
Valdría la pena un `git init`.

**El importador tiene dos candados y son necesarios.** No los quites:
- Los pre-elaborados (`Produccion Rosanta`) nunca se importan: su precio en el Banco es el
  costo del batch que sale de su ficha, y el inventario les pone el valor de un envase para
  contar existencias. La Salsa Bordolesa cuesta Q149.15 el batch y el inventario la valúa a
  Q26.50 el litro. No son el mismo número.
- Solo importa si la `PRESENTACION` del inventario equivale a la `UNIDAD_COMPRA` del Banco.
  Que difieran es normal y legítimo (se compra por unidad, se costea por libra), no es un
  error que haya que ir a arreglar.

---

## 6 · La rutina mensual, cuando esto quede andando

1. Cocina y barra cierran su inventario del mes en `Inventarios 2026`.
2. `previsualizarInventario()` — **siempre primero**, no escribe nada. Deja en el Log qué se
   va a aplicar, qué se salta y por qué.
3. Revisar los saltos sospechosos y los "sin match".
4. `importarInventario()`.
5. `probarCosteo()` para confirmar que el modelo sigue sano.
