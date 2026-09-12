# Informe de auditoría · Apps Script Rosanta
**v5 · 31 ago 2026, 20:13 (America/Guatemala)** · v1 17:00 (sin credenciales), v2 17:45 (con `clasp`), v3 18:00, v3.1 los 3 activadores, v3.2 `rosanta-crm` eliminado, v3.3 `posActualizarPauta` ejecutado, v3.4 panel de reseñas desplegado, v3.5 snippet de Wix localizado, v3.6 causa acotada, v3.7 corrección grave (§5.7), v4 el latido, v4.1 credenciales migradas, **v4.2 Google Ads Script arreglado, **v5 `pauta_semanal` cerrada a escritores externos**.

> **Resultado del encargo: de 7 proyectos a 6.** `rosanta-crm` está en la papelera desde el 31-ago. Los otros seis no estaban reemplazados por la intranet: están embebidos en ella o hacen algo que nadie más hace.

> **Objetivo del encargo:** apagar los scripts que la intranet ya reemplazó, para bajar de siete proyectos a los que hagan falta.
> **Respuesta corta: la intranet reemplazó uno solo.** A los demás los *embebe por URL*, no los absorbió. §0.
>
> **[V]** verificado contra el entorno · **[I]** inferido con la evidencia citada · **[NV]** no verificado.

---

## 0 · El objetivo, contrastado con el entorno

La premisa era que varios proyectos nacieron antes que la intranet y ya sobran. **El entorno dice que no.** El `Code.js` de la intranet monta el Sistema de Marketing como un shell con cuatro sub-vistas (`os`, `resenas`, `crm`, `consola`), y dos de ellas son iframes a los `/exec` de otros proyectos. Verificado con `clasp`: el deployment **v9** de la consola *es* literalmente `CONSOLA_URL` de `Config.js:13`, y el **v11** del panel de reseñas *es* `RESENAS_URL` de la línea 14. Se ven "dentro" de la intranet, pero son los mismos proyectos corriendo detrás de un marco.

| Proyecto | ¿Reemplazado por la intranet? | Qué pasa si se apaga |
|---|---|---|
| **consola-de-respuestas** | **No.** La embebe. Única que escribe en `Salientes`; `CrmDatos.js` dice explícito "sólo LECTURA, responder sigue siendo trabajo de la consola" | Sin vía para responder mensajes |
| **panel-de-reseñas** | **No.** La embebe. Publicando en Google hoy mismo | Nadie responde reseñas |
| **bot-rosanta** | **No.** Nada en la intranet habla con Meta | Se cae WhatsApp e IG |
| **rosanta-encuesta** | **No.** Vive aparte, nadie la referencia | Se corta la máquina que genera reseñas |
| **rosanta-marketing-os** | **Parcial.** La intranet tiene su `MarketingDatos.js` sobre la misma hoja, pero marketing-os sigue siendo dueño de los dos webhooks de Wix, `PosPauta`, `WixReservasPauta` y `CRMSync` | Se cortan carritos, reservas y el dato de POS |
| **rosanta-crm** | **Sí, entero** | **Nada. ELIMINADO el 31-ago.** §4 |

**Sobre los deployments.** Marketing OS tiene **cuatro URLs vivas** y dos sirven código sin rama de reservas. Wix **no** las usa — apunta al v18, que está sano — así que son riesgo latente, no activo: conviene borrarlas por higiene. §5.6.

**Consolidar de verdad hacia la intranet** (mover el `doPost` y los tres jobs, convertir consola y reseñas en módulos nativos) es un proyecto aparte, no una limpieza.

---

## 1 · Estado de `clasp`

**Resuelto** desde la v2: `clasp show-authorized-user` → `restaurante@rosanta.rest`. En la v1 fallaba con `invalid_grant / invalid_rapt` por la política de reauth de Workspace.

**Limitaciones que quedan:**
- `clasp` 3.3.0 **no tiene ningún comando de activadores** (verificado sobre `--help`). Los triggers solo se ven en el IDE.
- `clasp run-function` **no sirve en estos proyectos**: usan el GCP por defecto (`clasp list-apis` → `GCP project ID is not set`), y ejecutar por API exige un GCP propio vinculado + Apps Script API + deployment *API ejecutable*. §5.4.
- **`clasp clone-script` ignora el flag `-P`** y escribe en el directorio de trabajo. Usar siempre `--rootDir`.

---

## 2 · Los 7 proyectos: verificado con `clasp pull` y diff real

| Proyecto | Local vs remoto (HEAD) **[V]** | Deployments | Versión publicada | ¿Publicada = HEAD? **[V]** |
|---|---|---|---|---|
| **rosanta-intranet** | Idéntico | 2 (HEAD + v54) | **v54** de 54 | **Sí, idéntica** |
| **bot-rosanta** | Idéntico | 3 (HEAD + v39 + v28) | **v39** de 39 | **Sí, idéntica** |
| **rosanta-marketing-os** | Idéntico (push de hoy 23:30Z) | **4** (HEAD + v18 + v2 + v3) | v18 de 18 | Solo difiere en `PosPauta.js`. §5.3 |
| **panel-de-reseñas** | **Difiere** — solo por el arreglo de §3.3, sin subir | 4 (HEAD + v11 + v2 + v1) | **v11** de 11 | **Sí** (v11 = remoto HEAD) |
| **consola-de-respuestas** | Idéntico | 2 (HEAD + v9) | **v9** de 9 | Sí **[I]** |
| **rosanta-encuesta** | Idéntico | 2 (HEAD + v3) | **v3** de 3 | Sí **[I]** |
| ~~**rosanta-crm**~~ | ~~Idéntico~~ | ~~1 (solo HEAD)~~ | ~~Ninguna~~ | **ELIMINADO 31-ago** |

### Las URLs, cruzadas con lo que usa el sistema **[V]**

| Deployment publicado | Coincide con |
|---|---|
| `AKfycbw0PnfbHHtxaCH8tZtYT0yMHFAsT1h2uZXZ1pz2GC_wiaOAWD8CZ5WoU2DVwtpK0DvIAg` (bot, v39) | La URL del webhook de Meta de `rosanta-cerebro/references/proyectos.md` ✓ |
| `AKfycbzzy8u-qu4uemXzgzPd1ylmDrTm5giV2qqpxYKUu88y28J1dZ3_yryBGaV97rQrU7BAzg` (consola, v9) | `CONSOLA_URL` de `Config.js:13` ✓ |
| `AKfycbygKOwpwfMUWzf4_E5ZyfIVtWf8XRhx6IvmCxkW5tIP3roFbf8wuyl0mqBn1Ie-K3xsMw` (reseñas, v11) | `RESENAS_URL` de `Config.js:14` ✓ |
| `AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb` (intranet, v54) | La URL "publicada" del comentario de `Config.js:35` ✓ |

Los cuatro cuadran, y sus deployments publicados sirven el código actual (comprobado clonando la versión desplegada y comparándola con HEAD). **La preocupación de "alguien pusheó sin versionar y el fix nunca entró" no aplica a ninguno de estos cuatro.**

### Todos los proyectos son standalone **[V]**

Consulta a la Apps Script API (`GET /v1/projects/{scriptId}`, scope `script.projects`). El campo `parentId` es el Drive ID del contenedor y viene vacío en scripts standalone:

```
rosanta-crm · bot-rosanta · rosanta-intranet · rosanta-marketing-os
consola-de-respuestas · panel-de-reseñas · rosanta-encuesta   →  parentId vacío
```

Ninguno está vinculado a una hoja. Importa sobre todo para `rosanta-crm`: §4.

---

## 3 · Panel de Reseñas de Google — **VIVO. Arreglado en local, falta subirlo.**

Acceso a la GBP API **confirmado**: la hoja `Rosanta - Control de Reseñas GBP` (`17VHTRhelYt…`) tiene ~95 filas continuas del 7-jul al 31-ago, y `listarResenas_()` lanza excepción si la API no devuelve 200. `ANTHROPIC_API_KEY` en uso: ~40 llamadas en 54 días con `max_tokens: 400`, **gasto trivial**. Sin solapamiento con la plataforma de reservas: GBP admite una sola respuesta por reseña y `procesarResenas()` salta las que ya tienen una. El `/exec` (v11) sirve código actual.

### 3.3 🔴 El fallo crítico, y el arreglo aplicado

`redactarRespuesta_()` devolvía `json.content[0].text` sin validar. Se publicaron en Google dos respuestas con el razonamiento interno del modelo:

| Fecha | Cliente | ★ | Qué se publicó |
|---|---|---|---|
| 28-jul | Lukas Lackner | 5 | Respuesta correcta en alemán **+ un bloque `**[Note visible only to you]:**`** |
| 28-ago | Sylvain Adnet | 4 | La deliberación sobre la regla de "nuestro" **+ tres borradores alternativos** |

Publicadas de verdad: `publicarRespuesta_()` lanza si Google no devuelve 200 y `registrar_(…'PUBLICADA_AUTO')` corre después. Un `PUBLICADA_AUTO` **es** un 200 de la GBP API.

**El arreglo** (respaldo: `_backups/Bot de Reseñas de Google.js.2026-08-31.bak`). El texto bueno estaba al principio en los dos casos, así que el guard **salva antes de descartar**:

1. `sanearRespuesta_()` corta en el primer marcador de razonamiento (`[Note`, `Wait,`, `Let me `, `the rules`, ` ``` `, `\n---`…), corta en la segunda aparición del saludo (varios borradores) y limpia negritas, comillas y separadores.
2. `respuestaPublicable_()` exige 40-600 caracteres, sin marcadores residuales, máximo 5 oraciones, y terminar en `.`/`!`/`?`/`…`.
3. `redactarRespuesta_()` devuelve `{texto, confiable}`. Si no es publicable, la reseña va a **`PENDIENTE_APROBAR` aunque sea de 5 estrellas**, con el texto salvado dentro. La caída es a revisión humana, no a un texto genérico.
4. Dos líneas al prompt: otros idiomas → responder en inglés sin comentarlo (fue lo que disparó el caso de Lukas), y prohibición de notas, alternativas y autocorrecciones.
5. El correo ya no dice "de 1 a 3 estrellas".

**Probado con `node`, 11/11:** los dos casos reales recuperan su texto bueno; 5 controles buenos (ES, EN, hebreo, francés, con emoji) pasan; 4 de basura van a aprobación.

**✅ Desplegado.** `clasp push` hecho el 31-ago a las 23:41:47Z (17:41 local). Verificado: `clasp pull` a un temporal + `diff -r` contra el working tree da **cero diferencias**, y el remoto contiene `sanearRespuesta_`. Sin colisiones de nombres en el ámbito global del proyecto (`PanelServidor.js` no declara ninguno de los símbolos nuevos, y no hay declaraciones top-level duplicadas).

Los activadores corren HEAD, así que el guard queda activo desde la siguiente pasada horaria de `procesarResenas`. **No hace falta redesplegar**: la v11 sirve el dashboard (`PanelServidor.js`), que no se tocó.

**Aún sin ejercitarse [NV]:** la hoja de control no se modifica desde las 14:16Z, o sea que desde el push no ha entrado ninguna reseña nueva. El guard solo se prueba de verdad cuando llegue una. Hasta entonces está desplegado pero no ejecutado en producción.

*Corrección de método: las v2, v3, v3.1, v3.2 y v3.3 de este informe daban este punto como pendiente. El push ocurrió a las 17:41 y el `clasp pull` en que se basaban era de las 17:20. Se reportó estado viejo durante cinco versiones por no re-verificar antes de publicar.*

Las dos respuestas publicadas las está corrigiendo Juanma a mano; textos limpios en §9.

---

## 4 · `rosanta-crm` — **100% código muerto. Se puede borrar entero.**

Las dos comprobaciones que bloqueaban la decisión están cerradas.

### 4.1 Es standalone, y eso mata todo `Code.js` **[V]**

`parentId` vacío en la Apps Script API = sin contenedor. Consecuencia directa:

- `master_()` (línea 39) llama `SpreadsheetApp.getActiveSpreadsheet()`, que en standalone devuelve `null`.
- `onOpen`, `showAddForm` y `showCsvForm` usan `SpreadsheetApp.getUi()`, que fuera de un contenedor no existe.
- Todo lo demás pasa por `master_()`.

**`onOpen`, `addContact`, `importCsvText` y `appendSonTickets` no pueden ejecutarse.** No están obsoletos: truenan en la primera línea. El "menú en la hoja" que se le atribuía **nunca existió**.

`appendSonTickets` además apunta a SonTickets, cerrado en julio: la última fila con esa fuente es del 2026-07-11.

### 4.2 `syncWixToMaestro` nunca escribió — y si se enciende, hace daño

Las Script Properties no se leen desde fuera, así que `WIX_SHEET_TAB` sigue sin leerse directamente. **Se resolvió por la huella en los datos**, que es inconfundible. El append de `syncWixToMaestro` (líneas 45-54) llena 8 columnas y deja 4 vacías:

| Escribe | Deja vacío |
|---|---|
| `first_name`, `telefono`, `email`, `fuente`='Wix', `ultima_reserva`, `gasto_gtq`, `notas` | `idioma`, `segmento`, `fecha_alta`, `ultimo_intento` |

Y escribe `opt_in` como **1 / 0 numérico**, mientras el resto del sistema usa `SI` / `NO` en texto.

En `Rosanta_CRM_Maestra` hay 8 filas con `fuente = Wix`. **Las ocho tienen `segmento` y `fecha_alta` rellenos**, y no hay un solo `opt_in` numérico en toda la hoja. Esa combinación es imposible viniendo de WixSync: la firma es de `CRMSync.js` del marketing-os, que sí escribe `idioma`, `segmento` y `fecha_alta`. **Cero filas atribuibles a `syncWixToMaestro`.** La hoja además tiene una sola pestaña **[I, fuerte]** — el lector de Drive devuelve una sola tabla, y sobre la hoja de Marketing OS el mismo lector devuelve las 9 — así que no hay pestaña alterna donde pudiera estar escribiendo.

**🔴 CORRECCIÓN (18:20).** La v3 de este informe afirmaba que `syncWixToMaestro` "nunca escribió una sola fila". **Eso estaba mal, y de la forma peligrosa.** Lo demostrado arriba vale solo para su rama de **append**. Su rama de **actualización** no deja ninguna firma: escribe `ultima_reserva`, `gasto_gtq` y `notas` sobre filas existentes, las mismas columnas que toca `CRMSync`. Si los contactos de Wix ya existían en la hoja, WixSync solo habría tomado ese camino y sería indistinguible.

Y el 31-ago se encontraron **3 activadores instalados** en `rosanta-crm` (borrados ese mismo día). Con triggers vivos, que estuviera corriendo y pisando datos deja de ser hipótesis. Lo que se puede afirmar hoy: **ninguna fila fue creada por `syncWixToMaestro`**; si actualizó filas existentes, es indeterminado. **[NV]**

**Si alguien lo enciende, destruye datos.** Su rama de actualización es un `setValue` a ciegas:

```js
if (c.valor) sh.getRange(r+1, H.gasto_gtq+1).setValue(c.valor);
```

Sin comparar nada. `CRMSync.actualizarFila_` en cambio solo escribe `gasto_gtq` si el valor nuevo es mayor. WixSync **pisa el gasto acumulado de cada contacto con el valor de una sola reserva de Wix**, y mete `opt_in` como 1/0 rompiendo la lógica de consentimiento. No es una función a rescatar.

**Dato que no cierra:** los tres activadores no generaron un solo correo de fallo. Búsqueda en Gmail de `apps-scripts-notifications@google.com` y de "Summary of failures" en todo el buzón: **cero resultados, nunca**. Eso descarta que apuntaran a `addContact`, `importCsvText` o `appendSonTickets`, que revientan en cada disparo por `getActiveSpreadsheet()` en `null` y habrían generado avisos. Es **consistente con que los tres apuntaran a `syncWixToMaestro`**, que no lanza: si no encuentra la pestaña hace `Logger.log` y retorna. Silencioso en los dos escenarios: tanto si no escribía nada como si escribía. Pendiente de confirmar con Juanma sobre qué funciones estaban. **[NV]**

### 4.3 El CRM son tres capas legítimas, y esta no es una de ellas

| Capa | Modo de escritura | Estado |
|---|---|---|
| **marketing-os** `CRMSync.js` | Merge campo a campo con reglas (`actualizarFila_`): `segmento` solo sube de rango, fechas solo si son más nuevas, `gasto_gtq` solo si es mayor, `notas` concatena | **Único escritor que actualiza filas existentes.** Vivo |
| **intranet** `CrmDatos.js` | Append puro: indexa por teléfono/email y omite los existentes | Vivo |
| **rosanta-crm** | Requiere contenedor (imposible) o pisa datos (`WixSync`) | **Muerto** |

### 4.4 Veredicto

**Se puede borrar el proyecto entero.** Lo que hacía ya lo cubren la intranet (alta y CSV) y marketing-os (merge con reglas), y el sync de Contactos de Wix nunca funcionó.

### ✅ EJECUTADO el 31-ago-2026

1. El proyecto tenía **3 activadores instalados**. Borrados.
2. **Proyecto eliminado.** Verificado con la Drive API: `Rosanta CRM` → `trashed: true`.
3. **La hoja `Rosanta_CRM_Maestra` está intacta** (`trashed: false`, 196 contactos). Solo se eliminó el script.

**Nota de método:** `projects.get` de la Apps Script API **sigue devolviendo los proyectos borrados** como si estuvieran vivos. Para saber si un proyecto existe de verdad hay que mirar `trashed` en la Drive API:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "https://www.googleapis.com/drive/v3/files/<scriptId>?fields=name,trashed"
```

**Recuperable durante 30 días** desde la papelera de Drive, y el código está en `~/Dev/Rosanta/apps-script/rosanta-crm/`, idéntico al remoto (verificado con `clasp pull` + diff antes de borrar).

### ⚠️ Revisión pendiente: posible daño en `gasto_gtq`

Si alguno de los tres activadores era `syncWixToMaestro` y llegó a correr, pudo haber pisado `gasto_gtq` de contactos existentes con el valor de **una sola reserva** de Wix en vez del acumulado, porque su rama de actualización es un `setValue` sin comparar. Borrar el script detiene el daño futuro pero **no repara el pasado**.

Cómo comprobarlo: contrastar `gasto_gtq` de los clientes más frecuentes en `Rosanta_CRM_Maestra` contra su histórico en los `ReporteVentas_*`. Si hay clientes con visitas repetidas y un `gasto_gtq` sospechosamente bajo, ahí está el daño, y se puede reconstruir desde el POS.

Con eso se pasa de **7 proyectos a 6**, que es todo lo que el objetivo permite.

---

## 5 · Marketing OS

### 5.1 El fallo, recapitulado **[V]**

`PosPauta.js` se arregló el 24-ago (carpeta `00_CIERRE_MAESTRO` → `Reportes semanales`, patrón `POS` → `ReporteVentas`) y **nunca se subió**. Producción leía una carpeta sin un solo archivo del POS, caía en `if (!archivos.length) { Logger.log(…); return; }` y salía en silencio. `comensales` y `ticket` vacíos desde la **S32**.

### 5.2 El arreglo aplicado

**Primero verifiqué el fix del 24-ago contra los datos reales**, porque al no haberse subido nunca, tampoco se había ejecutado nunca. Bajé `ReporteVentas_8_24_2026_102651.xlsx` de S34: **[V]**

- Columnas exactamente las que el código espera: `TicketId`, `Fecha` (d/m/yyyy), `TotalFinal`, `Notas` (= comensales), `Estado`, `Es Contable`.
- La última fila del export es un total sin `TicketId`: ya se descarta sola.
- El regex **excluye correctamente** `ReporteVentasProductos_*`, que corrompería el ratio.
- Inventario de las subcarpetas: **13 archivos** casan con el patrón. S19-S22 y S27-S35 tienen fuente; **S23-S26 no tienen ninguna**, así que esas semanas se quedan como están.

**Cambios en `PosPauta.js`** (respaldo: `_backups/PosPauta.js.2026-08-31.bak`):

- Los tres `Logger.log(…); return;` silenciosos ahora son **`throw`**. Apps Script manda el correo de activador fallido al dueño, sin necesidad de ningún scope OAuth nuevo.
- Los errores por archivo se acumulan y se avisan **después** de escribir las semanas buenas: un xlsx roto no cuesta las semanas que sí se calcularon.
- El mensaje de carpeta vacía lee el nombre desde Drive, para que no pueda volver a quedar desactualizado.
- Cabecera reescrita con el formato real del export.

**No se añadió `MailApp` ni `ScriptApp.newTrigger` a propósito:** cualquiera de los dos mete un scope OAuth nuevo en el proyecto que sirve el `/exec` de los webhooks, y eso obliga a re-autorizar. El trigger se crea desde la UI.

### 5.3 Desplegado **[V]**

`clasp push` hecho: remoto en **31-ago 23:30:11Z**, diff local↔remoto idéntico.

**No hace falta redesplegar.** Los activadores ejecutan HEAD, no una versión publicada, y `PosPauta` no es alcanzable por `/exec`. El deployment v18 conserva el `PosPauta.js` viejo (verificado: aún tiene `POSP_FOLDER_ID = '1tMVLLL…'`), y es irrelevante para el trigger. Dejarlo así es **más seguro**: no se toca el endpoint de los webhooks.

### 5.4 ✅ Ejecutado el 31-ago 18:09 — resultado

Intento de `clasp -P rosanta-marketing-os run-function posActualizarPauta`:

```
Exception: We're sorry, a server error occurred while reading from storage. Error code NOT_FOUND. []
```

Causa: `clasp list-apis` → **`GCP project ID is not set`**. El proyecto usa el GCP por defecto, y ejecutar por API exige un GCP propio vinculado, la Apps Script API habilitada y un deployment *API ejecutable*. Montarlo forzaría re-autorización del proyecto que recibe los webhooks, así que **no se hizo**.

Juanma lo corrió a mano desde el IDE el 31-ago a las 18:09 (hoja escrita a las `2026-09-01T00:09:37Z`). **Escribió las 13 semanas que tenían archivo**, exactamente las previstas:

| wk | comensales | ticket | Cambio |
|---|---|---|---|
| 19 | 158 | Q259.91 | fila nueva |
| 20 | 121 | Q277.69 | fila nueva |
| 21 | 177 | Q267.29 | fila nueva |
| 22 | 97 | Q299.77 | fila nueva |
| 27 | 85 | Q251.71 | sin cambio |
| 28 | 97 | Q260.68 | sin cambio |
| 29 | 131 | Q261.62 | sin cambio |
| 30 | 124 | Q254.48 | sin cambio |
| **31** | **69 → 131** | **253.59 → 249.66** | **corregida** |
| **32** | **123** | **Q256.15** | recuperada |
| **33** | **118** | **Q272.69** | recuperada |
| **34** | **139** | **Q284.70** | recuperada |
| **35** | **100** | **Q281.90** | recuperada |

S23-S26 siguen vacías: no tienen export.

**🔴 Hallazgo nuevo: la S31 no estaba vacía, estaba MAL.** Pasó de 69 a 131 comensales, casi el doble. La semana ISO 31 va del 27-jul al 2-ago, y el valor viejo salía del `POS 2026-07` mensual, que se corta el 31 de julio: **faltaban dos días**. El archivo semanal los trae completos.

Eso amplía el alcance del fallo original. No eran solo cuatro semanas en blanco, que al menos se ven: **también había un número incorrecto en una semana que se veía llena**, y esos no los cuestiona nadie. Cualquier semana ISO que cruce un fin de mes y se haya calculado solo desde un POS mensual tiene el mismo sesgo a la baja.

**Dato de negocio recuperado:** el ticket por comensal sube sin interrupción de la S31 a la S35 — 249.66 → 256.15 → 272.69 → 284.70 → 281.90, un **+13% en cinco semanas**. Los comensales caen en la S35 (100 contra 139 de la S34). Ese movimiento estuvo invisible cuatro semanas.

### 5.5 ✅ `pauta_semanal` fuera del SCHEMA (31-ago 20:20)

**Ejecutado.** Era el último agujero activo: `upsert()` escribe la fila completa de su SCHEMA de 8 columnas, así que un POST parcial con `{wk, mCosto}` vaciaba `gCosto`, `gClics`, `gImp` y `reservas`. Y había evidencia de que estaba pasando — los `mCosto` de S32-S34 no coincidían con los que devuelve la Graph API, señal de otro escritor con otra consulta.

| Prueba contra el endpoint en vivo | Antes | Después |
|---|---|---|
| `?tab=pauta_semanal` | devolvía las filas | **`{"error":"tab desconocida"}`** |
| `?tab=carritos` | filas | filas ✓ |
| `?tab=reservas` | filas | filas ✓ |

**Versión 19 creada y desplegada sobre el deployment existente** (`AKfycbzEv9C1gZ6…`, de v18 a v19 **conservando su id**), así que la URL que llaman el snippet de carritos y `crmReservas.js` no cambió. Se usó `update-deployment`, no `create-deployment`: crear uno nuevo habría dado otra URL y roto los webhooks.

Riesgo lateral cerrado de paso: `crearPestanas()` recorre las claves del SCHEMA y reescribe encabezados. Con `pauta_semanal` fuera ya no puede tocar los suyos, que son 12 mientras el SCHEMA conocía 8.

**Qué esperar:** el escritor fantasma empezará a recibir `tab desconocida`. Si tiene dueño, se quejará — y eso sería bueno, porque es la única vía que queda para identificarlo. Si nadie se queja en dos semanas, era un proceso huérfano.

**`pauta_semanal` queda con tres dueños y ninguna otra puerta:** Google Ads Script (Google y Meta), `WixReservasPauta` (reservas), `PosPauta` (comensales y ticket). El latido vigila las dos últimas cada martes.

#### Contexto original de la decisión

La intranet escribe `pauta_semanal` **directo con `SpreadsheetApp.openById()`** (`MarketingDatos.js:69-70`), igual que `PosPauta` y `WixReservasPauta`. Ninguno pasa por la API del Marketing OS.

El riesgo que cierra: `upsert()` escribe `getRange(fila, 1, 1, head.length)` con las 8 columnas del SCHEMA. **No** toca las columnas 9-12, pero **sí vacía** cualquiera de las 1-8 que no venga en el payload.

*(La verificación propuesta en las primeras versiones —"que la S34 conserve comensales y ticket"— era un falso verde: la S34 no los tenía. Se sustituyó por las tres pruebas de arriba, ya ejecutadas.)*

### 5.6 Dos deployments viejos que nadie usa

| Deployment | Versión | `hook=carrito` | `hook=reserva` | `SCHEMA.reservas` |
|---|---|---|---|---|
| `AKfycbyuXVzGU-IhG80WlWxXzDG0YNe2Vkf5rKGDFGMAax4x` | @HEAD | sí | sí | sí |
| `AKfycbzEv9C1gZ6-bODUyI2a5TPCtLVQGt5T-7gQs60TP8OYmDgymZTHQuv3hR-232cng7K3` | **v18 ← el que usa Wix** | sí | sí | sí |
| `AKfycbwUM-icAFh4XopinWtVFh20M5NleMb8cOE_TwS9ot7gB404m9iNcAPc_lwZpfNSSv2Xbw` | v2 | no | no | no |
| `AKfycbzCjzI_xpGwe4nkIRjYb2N_7s0fay7v4TJr6Szj_Q4ccV_Zhbc0qBT2uemBDoCKKgwHIg` | v3 | no | no | no |

El `doPost` de v2 y v3 tiene una sola rama, `if (e.parameter.hook === 'sontickets')`, y ninguna de reservas: una reserva enviada ahí devuelve `unauthorized` y se pierde. **Pero Wix no las usa.** Los dos archivos del sitio apuntan al **v18**:

| Archivo de Wix | URL | Query |
|---|---|---|
| `Carritos_WIX_Snippet.html` | deployment **v18** | `?token=rosanta2026xy&hook=sontickets` |
| `crmReservas.js` | deployment **v18** | `?token=rosanta2026xy&hook=reserva` |

Sus `updateTime` son del 30-jul y nadie los tocó después. **Riesgo real pero latente**: dos URLs vivas que aceptarían tráfico y lo tirarían si algún día alguien las copiara por error. Borrarlas es higiene barata, no urgencia.

**Sobre el hook `sontickets`:** el `Code.js` v3 renombró el hook a `carrito` el 4-ago avisando que había que cambiar el snippet, y el snippet sigue mandando el nombre viejo. No importa: la rama de compatibilidad **está viva en el v18 desplegado** (`Code.js:198`: `hook === 'carrito' || hook === 'sontickets'`), y en todo el proyecto la palabra aparece dos veces, ese `if` y un comentario. `intakeCarrito` no la menciona: **cero acoplamiento aguas abajo**. Limpiarlo es higiene, no arreglo.

**El endpoint está sano [V]:** un GET sin autenticar al `/exec` del v18 devuelve `{"error":"tab desconocida"}`, o sea que llega al código y lo ejecuta. `ANYONE_ANONYMOUS` intacto en el manifiesto del v18 y de HEAD. Y `var TOKEN = 'rosanta2026xy'` es idéntico en v2, v3, v18 y HEAD, y es el que manda Wix.

### 5.7 Los webhooks funcionan — y aquí hubo un error grave de este informe

**❌ CORRECCIÓN (31-ago 18:50). Las versiones v1 a v3.6 de este informe afirmaron que los webhooks llevaban 25 días sin recibir nada. Era falso, y el error era de lectura.**

`Code.js:303` declara `var TABS_NUEVO_ARRIBA = ['reservas', 'carritos']`, y `upsert()` inserta las filas nuevas de esas dos pestañas **en la fila 2, justo debajo del encabezado**. Al revisar la hoja se leyeron las **últimas** filas de cada bloque, que en una tabla que crece hacia arriba son las **más viejas**. Las fechas 2026-08-06 y 2026-08-07 no eran el último dato: eran el primero.

Estado real, leyendo por arriba: **[V]**

| Pestaña | Filas | Entradas recientes |
|---|---|---|
| `reservas` | 69 | Sara Pineda (30-ago), Karen Sun, Cecilia Leung, Alex Williams… |
| `carritos` | 39 | Sara (30-ago), Karen (30-ago), Cecilia (29-ago), Pamela (29-ago) |

Prueba independiente de la fecha de escritura: `intakeCarrito` genera el id como `'c' + Date.now()`, así que el id codifica el instante en que se escribió la fila. Decodificados:

```
c1788128242352 → 2026-08-30 22:17 UTC
c1788128199196 → 2026-08-30 22:16 UTC
c1788030363314 → 2026-08-29 19:06 UTC
c1788029084764 → 2026-08-29 18:44 UTC
```

Escritas el 29 y el 30 de agosto, antes de cualquier cambio de hoy. **El circuito de Wix nunca se rompió.**

**Verificación end-to-end (31-ago 18:43):** una reserva de prueba entró completa — `Restaurante PRUEBA Rosanta · 2026-08-31 · RESERVED · optin=SI`, primera fila de `reservas`. El circuito Wix → `doPost` → hoja funciona.

**Qué arrastró este error.** La hipótesis de los deployments zombi (§5.6), la del cableado perdido en `backend/events.js`, y la prioridad número uno de la recomendación. Nada de eso era real. También explica el "no hay ejecuciones de `doPost`" del panel de Ejecuciones: se buscó una avería que no existía.

**La lección, que es la del informe entero aplicada a sí mismo:** antes de leer una tabla hay que saber por qué extremo crece. El orden de las filas es parte del esquema, no un detalle de presentación.

### 5.8 ✅ Credenciales sacadas de la hoja (31-ago)

La pestaña `config` guardaba en celdas normales un token de larga duración de Meta (`A1`), la API key de Wix (`A2`) y el site id (`A3`). Las veía **cualquiera con permiso de lectura sobre el libro**, que es una audiencia mucho más amplia que la de un Script Property.

| Celda | Qué era | Destino |
|---|---|---|
| `A1` | Token de Meta | **Copia muerta.** No la leía nadie: el bueno vive en `META_CAPI_TOKEN` |
| `A2` | API key de Wix | `WIX_API_KEY` en Propiedades del script |
| `A3` | Site ID | `WIX_SITE_ID` en Propiedades del script |

**Ejecutado:** propiedades creadas, `wixCredenciales_()` lee de ellas, verificado con `reservasSemanaPasada()` (`S35 → 18 reservas · 56 comensales`), celdas vaciadas y pestaña `config` eliminada. **Cero referencias a esa pestaña en el proyecto.**

El cambio se subió con un repliegue transitorio a la hoja para que el orden de los pasos no importara; retirado una vez confirmado.

**Al rotar credenciales:** la API key de Wix se cambia **en un sitio**. El token de Meta vive **en dos** — `META_CAPI_TOKEN` en Marketing OS y `META_TOKEN` en la intranet, y `Servicios.js:17` dice que son el mismo. Cambiar solo uno deja al otro devolviendo `error 190` en silencio.

### 5.9 ✅ `WixReservasPauta` ya no se rinde en silencio (31-ago)

`contarReservas` devolvía `null` ante cualquier fallo, y `procesarSemana` escribía un `Logger.log` y se iba: esa semana se quedaba sin `reservas` **para siempre**, porque nadie la reintenta. Mismo patrón que costó cuatro semanas de comensales.

Ahora `wixFetch_()` distingue qué merece reintento, lección directa del 403 del 31-ago, que resultó ser una API key copiada a medias:

| Respuesta de Wix | Qué hace |
|---|---|
| 401 / 403 | Lanza **al primer intento**, señalando `WIX_API_KEY` / `WIX_SITE_ID` |
| 429 / 5xx | Reintenta 3 veces con espera creciente; si persiste, lanza |
| Cualquier otro | Lanza sin reintentar |

No queda un solo `return null` en el archivo. `backfillReservas` escribe las semanas que sí salen y avisa al final de las que no.

### 5.11 ✅ El Google Ads Script y el `BACKFILL` congelado (31-ago)

`gCosto`/`gClics`/`gImp` llevaban vacías desde la **S32**. El escritor no está en Apps Script: es un **Google Ads Script** (`Rosanta_GoogleAds_Script_pauta.js`) que corre dentro de Google Ads y llena Google **y** Meta. Por eso no aparecía en ninguna búsqueda del repo. Copia de referencia en `apps-script/_externos/`.

**Causa 1:** `var BACKFILL = [27,28,29,30,31]` quedó puesto desde un backfill del 5-ago. La cabecera del propio script decía que había que vaciarlo al terminar; no se hizo. Cada semana reprocesaba julio y **nunca escribía la semana en curso**. `gCosto` congelado exactamente en la S31, el último número del array.

**Causa 2, encadenada:** al reponer el token de Meta en `config!A1` se usó `META_CAPI_TOKEN`, que es del **Conversions API** y no tiene `ads_read`. Devolvió `HTTP 403 (#200) Ad account owner has NOT grant ads_management or ads_read`. El correcto es `META_TOKEN` de la intranet. **Queda desmentido el comentario de `Servicios.js:17`**, que afirma que ambos son el mismo token.

**Arreglado (v3 del script):** el modo backfill se anuncia en el log en cada corrida, 0 filas de `AdsApp` se reporta como problema en vez de escribirse como cero, y los fallos se acumulan y se lanzan **después** de escribir lo que sí salió. `LockService` no existe en Google Ads Scripts, así que este escritor se separa por horario: **programarlo en un día distinto al martes**.

**Verificado el 31-ago 20:04:** `pauta_semanal` completa de la S27 a la S35 en las tres fuentes.

**Dos señales de negocio que aparecieron al completar la tabla:**
- **Meta se desplomó en la S35**: Q580.78 → **Q40.28**, alcance 107,414 → 8,979. Caída del 93% con la semana cerrada. Coincide con la única bajada de comensales (139 → 100).
- **La S33 tuvo un tercio del gasto normal en Google** (Q5.23 y 68 clics, contra Q14-20 y 140-238 del resto).

### 5.10 ⚠️ Carrera latente al crear la fila de una semana **[V]**

`escribirReservas` (WixReservasPauta) y `posEscribirSemana_` (PosPauta) usan el mismo patrón: buscan la fila de la semana y, si no existe, `appendRow` + `getLastRow()`. **Ninguna usa `LockService`.**

Si los dos activadores cayeran en la misma ventana horaria con la fila aún sin crear, los dos añadirían una: dos filas para la misma semana, cada una con la mitad de los datos. El dashboard contaría mal y `latPauta_` del latido, que se queda con la primera coincidencia, podría leer la mitad vacía y avisar en falso.

**Mitigado por horario**, no por código: los activadores están escalonados en ventanas distintas (§6b). Si algún día se juntan, la carrera vuelve. La solución definitiva sería un `LockService` en las dos funciones de escritura — cuatro líneas, mismo proyecto.

---

## 6 · Encuesta y consola

**`rosanta-encuesta`**: el Sheet destino `Recolección de data - Rosanta` es **propiedad de `Eli_Juli@lacocinaquesuena.com`**, no de Rosanta. Funciona (v3 publicada = última versión), pero el dato de satisfacción vive en una hoja de un tercero. **[V]**

Re-apuntar a TripAdvisor sigue siendo correcto y sigue siendo una sola propiedad (`GOOGLE_REVIEW_URL`). Salvedad: desviar el flujo de 5★ enfría el circuito del panel de reseñas, que funciona bien. El trade-off vale la pena porque Google ya tiene volumen.

**`consola-de-respuestas`**: local = remoto, v9 publicada = `CONSOLA_URL`. No tocar. La cadena bot → `Conversaciones` → consola → `Salientes` → bot sigue sin verificarse de punta a punta. **[NV]**

---

## 6b · El latido — lo único que cambia el futuro

Los cuatro fallos de esta auditoría fueron **silenciosos**: `posActualizarPauta` cuatro semanas sin escribir, el panel publicando el razonamiento del modelo, la S31 con un número mal, y un informe que dio por caídos unos webhooks sanos. Ninguno lo detectó el sistema. El agujero es de atención, no de capacidad.

`Latido.js` está **en producción en la intranet** desde el 31-ago (push verificado: remoto idéntico al local, los 4 scopes intactos, web app sin tocar). Comprueba cuatro señales y **lanza excepción** si alguna está fría, que es como Apps Script manda el correo de activador fallido sin necesitar `script.send_mail`.

| Señal | Umbral | El fallo que habría cazado |
|---|---|---|
| `carritos` | 10 días sin filas nuevas | Una caída real del webhook |
| `reservas` | 10 días, ignorando fechas futuras | Ídem. Se descartan las futuras porque la columna `fecha` es la de la reserva, no la de llegada |
| `pauta · POS` | ninguna de las dos últimas semanas con `comensales` y `ticket` | Las 4 semanas de `posActualizarPauta` |
| `pauta · reservas` | ídem con `reservas` y `comensalesReserva` | `reservasSemanaPasada` muerto |
| Reseñas | 14 días sin filas nuevas | El panel de reseñas caído |

Son **cinco** señales y la de pauta va partida en dos a propósito: `comensales`/`ticket` los escribe `posActualizarPauta` y `reservas`/`comensalesReserva` los escribe `reservasSemanaPasada`. Con una sola señal, la muerte de uno quedaba tapada por el trabajo del otro sobre la misma fila.

**Verificado en verde el 31-ago 19:24**, con las cinco señales al día.

**Por qué dos semanas y no una.** El `ReporteVentas` se sube el lunes a hora variable — la S34 a las 10:27, la S35 a las 16:22. Exigir la última semana haría saltar el aviso todos los lunes, y un monitor que avisa en falso se ignora. El motivo está escrito en el código con esas fechas para que nadie lo "optimice" de vuelta.

**Horarios, corregidos el 31-ago.** Trazando la interacción entre los dos activadores apareció un desfase: `posActualizarPauta` corría los lunes 7-8am, *antes* de que se subiera el archivo que necesita, así que `pauta_semanal` iba estructuralmente una semana por detrás — y el latido, corriendo antes que él, habría avisado en falso. Ambos movidos al **martes**: el reporte se sube siempre el lunes, así que el martes está garantizado.

| Activador | Cuándo | Papel |
|---|---|---|
| `posActualizarPauta` (Marketing OS) | martes, **7-8am** | Crea la fila de la semana y pone `comensales` y `ticket` |
| `reservasSemanaPasada` (Marketing OS) | martes, **8-9am** | Encuentra la fila ya creada y rellena `reservas` y `comensalesReserva` |
| `latido` (intranet) | martes, **9-10am** | Revisa cuando los dos terminaron |

Las tres ventanas son distintas a propósito: evita la carrera de §5.10 y ordena el trabajo — el que crea la fila primero, el que la completa después, el que vigila al final. `reservasSemanaPasada` **no tenía activador** hasta el 31-ago: sus datos entraban solo cuando alguien se acordaba.

Efecto colateral bueno: los comensales y el ticket de la semana ahora aparecen el martes por la mañana, no ocho días después.

`latidoEnSeco()` corre las cuatro comprobaciones y escribe en el log qué habría avisado, sin lanzar nada. Ejecutarla cada vez que se toque un umbral.

---

## 7 · Plan de eliminación, por riesgo

| # | Qué | Riesgo | Verificación previa |
|---|---|---|---|
| 1 | ~~**`rosanta-crm` completo**~~ | — | ✅ **HECHO el 31-ago.** Activadores borrados y proyecto a la papelera. Queda pendiente contrastar `gasto_gtq` por si `syncWixToMaestro` llegó a correr (§4.4) |
| 2 | **Deployments v2 y v3 de marketing-os** | **Bajo.** Confirmado que Wix **no** los usa (§5.6). Higiene, no urgencia | Ninguna pendiente |
| 3 | Línea `pauta_semanal:` del `SCHEMA` de `Code.js` | **Bajo** | Los 3 checks de §5.5. Aquí **sí** hace falta push + versión + `redeploy` sobre el deployment que use Wix (no crear uno nuevo: cambiaría la URL) |
| 4 | Nada más | — | Reseñas, consola, bot, intranet, encuesta y el `/exec` del Marketing OS están vivos y con función |

**Cerrado el 31-ago:** `PosPauta` arreglado y ejecutado (13 semanas, S31 corregida) · guard de validación de reseñas en producción · `rosanta-crm` eliminado · latido con 5 señales y sus 3 activadores · credenciales fuera de la hoja · Google Ads Script arreglado y `pauta_semanal` completa S27-S35 · `pauta_semanal` cerrada a escritores externos.

**Queda solo higiene, sin urgencia:** borrar los deployments **v2 y v3** · limpiar el alias `sontickets` del `doPost` · `LockService` en las funciones de escritura si algún día se prefiere no depender del escalonado por horarios.

**Y una señal de negocio, que no es de plomería:** Meta cayó **93% en la S35** (Q580.78 → Q40.28, alcance 107,414 → 8,979), y es la única semana con bajada de comensales (139 → 100). Con la tabla completa por primera vez desde julio, es lo más accionable que dejó la auditoría.

<!-- lista histórica -->

**Cerrado el 31-ago:** `PosPauta` arreglado, desplegado y ejecutado (13 semanas, S31 corregida) · guard de validación de reseñas en producción · `rosanta-crm` eliminado · latido en producción con sus dos activadores (§6b).

**Lo que queda:**

1. ~~**Sacar el token de Meta y la key de Wix** de la hoja~~ ✅ hecho el 31-ago (§5.8).
2. ~~**`clasp push` del panel de reseñas**~~ ✅ hecho el 31-ago 17:41 (§3.4).
3. **Editar las 2 respuestas publicadas en Google** (en curso).
4. ~~**Investigar el silencio de los webhooks**~~ ❌ **No existía tal silencio.** Error de lectura de este informe, corregido en §5.7. El circuito Wix → `doPost` → hoja funciona, verificado end-to-end el 31-ago.
5. ~~**Borrar `rosanta-crm`**~~ ✅ hecho. Queda contrastar `gasto_gtq` (§4.4).
6. **Mover el token de Meta y la key de Wix** de la pestaña `config` a Script Properties.

---

## 8 · Lo que sigue sin verificar

| Qué | Por qué | Qué hace falta |
|---|---|---|
| **Sobre qué funciones estaban los 3 activadores de `rosanta-crm`** | Se borraron antes de registrarlos. Determina si `syncWixToMaestro` llegó a pisar datos | Preguntarle a Juanma, o revisar Ejecuciones si el historial sobrevive al borrado |
| **Activadores del resto de proyectos y su última ejecución** | `clasp` 3.3.0 no tiene comando de triggers; `tail-logs` tampoco sirve sin GCP propio | IDE → **Activadores** / **Ejecuciones**. Interesa `posActualizarPauta` y el panel de reseñas |
| **Si el editor de Wix tiene hoy lo mismo que las copias de Drive** | Las copias son del 30-jul y 3-ago y apuntan al v18 correcto (§5.6). Que el editor no haya cambiado no está comprobado | Abrir el editor de Wix. Site id `47968b83-c2c2-4b11-8f94-ef2c7488debc` |
| ~~**Ejecuciones de `doPost`**~~ | ✅ Comprobado el 31-ago: **ninguna en los últimos días**. Wix no llama (§5.6) | — |
| ~~**El cableado de Wix**~~ | ✅ Comprobado: `backend/events.js` llama a `enviarReservaAlCRM` en los dos handlers, y el circuito completo se verificó con una reserva de prueba (§5.7) | — |
| Script Properties (`WIX_SHEET_TAB`, `SPREADSHEET_ID`, `ACCOUNT_ID`, `LOCATION_ID`) | No hay API de lectura externa | IDE → Configuración del proyecto. *(`WIX_SHEET_TAB` quedó resuelto por los datos, §4.2. `ACCOUNT_ID`/`LOCATION_ID` están bien: sin ellos la GBP API no habría devuelto 200 durante 54 días.)* |
| ~~**Por qué `gCosto`/`gClics`/`gImp` paran en la S31**~~ | ✅ **RESUELTO el 31-ago (§5.11):** un `BACKFILL` congelado en el Google Ads Script | — |
| **Quién postea filas parciales de `pauta_semanal`** | Los `mCosto` que había en S32-S34 no coinciden con los que devuelve la Graph API: había **otro escritor** con una consulta distinta, y es el que borra las columnas de Google vía `upsert()` (§5.5). No está en el repo ni en las skills | Quitar `pauta_semanal` del SCHEMA de `Code.js` y ver si algo se queja |
| Cadena completa de la consola de chats | `SPREADSHEET_ID` es propiedad de script | Leerla y revisar la hoja `Rosanta Leads` |

---

## 9 · Comandos y textos listos

**Recuperar las 4 semanas de pauta.** En el IDE de [Rosanta Marketing OS](https://script.google.com/d/1quGqCLOam-crmOoj0ALklql1bLhm7wgVZTe67ilALJQEjRXrQgz26Dhr/edit), archivo `PosPauta.js`, ejecutar `posActualizarPauta`. Debe registrar `POS OK: N archivo(s), semanas actualizadas: …`. Si truena, el mensaje dice exactamente qué falta.

**Subir el guard de validación de reseñas** (los triggers corren HEAD: no hace falta versión ni redeploy):

```bash
cd ~/Dev/Rosanta/apps-script/panel-de-reseas-de-google && clasp push
```

**Las dos respuestas para pegar en Google.** En ambos casos el texto bueno es el primer párrafo: se borra lo que viene después.

Lukas Lackner (5★, 28-jul) — borrar desde el `---`:

```
Lukas, das freut uns sehr zu hören. Schön, dass der Service den Abend so besonders gemacht hat. Wir hoffen, dich bald wieder bei uns begrüßen zu dürfen!
```

Sylvain Adnet (4★, 28-ago) — borrar desde el `Wait, I used`:

```
Sylvain, thank you for taking a moment to rate your visit. Knowing the experience measured up means a lot. If there is anything that would make it better, write to restaurante@rosanta.rest.
```

---

## 10 · La regla

**El código local, el HEAD remoto y lo que sirve cada deployment son tres cosas distintas, y hay que mirar las tres.**

- `PosPauta`: el local estaba arreglado, el HEAD no. Leer el archivo daba la respuesta correcta al sistema equivocado.
- Deployments v2 y v3 de marketing-os: el HEAD está perfecto, y aun así hay dos URLs vivas sirviendo código de otra época. Wix no las usa, pero existen.
- **Y una cuarta, la más cara de todas, contra este informe.** Se dieron por caídos 25 días de webhooks leyendo el final de dos tablas que insertan por arriba (`TABS_NUEVO_ARRIBA`). Eso disparó tres hipótesis, una recomendación de prioridad equivocada y horas de investigación sobre una avería inexistente. **El orden de las filas es parte del esquema.** Antes de leer una tabla hay que saber por qué extremo crece — y el dato estaba en el mismo `Code.js` que ya se había leído entero.
- Panel de reseñas: local, HEAD y deployment coincidían, y el fallo estaba en la **salida en tiempo de ejecución**.
- `rosanta-crm`: el código se lee perfectamente bien, y no puede ejecutarse. Lo decisivo no estaba en el archivo sino en un campo de la API (`parentId`).
- Y dos más, contra este mismo informe. La v3 concluyó "`syncWixToMaestro` nunca escribió" a partir de una firma que **solo existe en una de sus dos ramas**: aparecieron 3 activadores y la conclusión se cayó. Una ausencia de evidencia en el camino A no dice nada del camino B.
- La v3.1 dio por vivo un proyecto ya borrado, porque `projects.get` de la Apps Script API devuelve los proyectos en papelera sin marcarlos. **La API que responde no es siempre la API que sabe.** Para existencia real, `trashed` de la Drive API.

Las verificaciones baratas que cubren casi todo:

```bash
clasp pull   # a un temporal, + diff -r   → local vs HEAD
```

```bash
clasp clone-script <scriptId> <versión> --rootDir <dir>   # qué sirve cada deployment
```

Y para saber si un proyecto está vinculado a una hoja, `GET https://script.googleapis.com/v1/projects/{scriptId}` y mirar `parentId`.

---

*Sin escrituras en producción: no se ejecutó ninguna función, no se creó ni modificó ningún deployment, no se tocó ninguna hoja. Los cambios de código están en `PosPauta.js` (ya en HEAD) y en `Bot de Reseñas de Google.js` (solo en local).*
