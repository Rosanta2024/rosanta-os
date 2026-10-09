---
name: rosanta-cotizador
description: "Genera cotizaciones de evento en PDF para Rosanta (Cocina con Carisma, Antigua Guatemala) en el formato oficial, en español o en inglés. Usar SIEMPRE que Juanma pida armar, generar o actualizar una cotización (cotización, cotizar, propuesta económica, presupuesto de evento) para un cliente, ya sea menú servido individual (Eventos Especiales), Para Compartir, brindis, boda, o cualquier evento. Disparar con \"cotiza esto\", \"haz una cotización\", \"genera la cotización\", \"PARA COTIZAR\", \"propuesta para [cliente]\", \"presupuesto del evento\"."
---

# Rosanta — Generador de Cotizaciones de Evento

Genera el PDF de cotización en el formato oficial vigente de Rosanta usando
**`scripts/rosanta_cotizador.py`** (ReportLab + Pillow + PyMuPDF, parametrizado por el
bloque `CONFIGURACION` al inicio del script).

**Estilo de respuesta:** conciso. Verificar el PDF con previews antes de entregar.
Nunca inventar precios ni platos: usar el catálogo de abajo y los platos reales de la
carta, o confirmar con Juanma.

## Paso 0 — Verificar assets (obligatorio)

Antes de todo, confirmar que existen dentro de la skill:

- `scripts/rosanta_cotizador.py` y `scripts/Firma_Rosanta_VF.png`
- `scripts/portada.py`
- `scripts/plantillas/portada_eventos.pdf` y `scripts/plantillas/portada_boda.pdf`
- `scripts/fuentes/PlayfairDisplay-Regular.ttf` y `scripts/fuentes/Lato-Regular.ttf`

Si falta el script, NO improvisar un formato nuevo: avisar a Juanma. Si falta solo la
firma, el script genera el PDF con la línea de firma vacía e imprime un WARNING: avisar
a Juanma y pedirle el PNG antes de enviar la cotización al cliente. Si faltan las
plantillas o las fuentes, avisar a Juanma: **no se entrega una cotización sin portada**.

Para la portada en inglés hacen falta además Poppins-Regular, Poppins-Medium y
Lora-Italic-Variable. Suelen estar en `/usr/share/fonts/truetype/google-fonts/`; si no,
instalarlas o avisar a Juanma antes de generar.

> El script incluido fue reconstruido en jul 2026 a partir de la especificación
> oficial. La primera vez que se use, comparar la salida contra la última cotización
> aprobada y ajustar si algo difiere.

## Flujo de trabajo

1. Juanma entrega los datos del evento (suele pegar un bloque "PARA COTIZAR" con cliente,
   evento, menú, fecha, personas, formato de servicio, correo).
2. **Verificar la fecha antes de generar.** Si el año de la ficha ya pasó, casi siempre es
   error de dedo: confirmar con Juanma, no asumir.
3. Copiar **todo** `scripts/` a un directorio de trabajo (es de solo lectura en el skill):
   `rosanta_cotizador.py`, `portada.py`, `Firma_Rosanta_VF.png`, y las carpetas
   `plantillas/` y `fuentes/`.
4. Editar **solo el bloque `CONFIGURACION`** al inicio: `PERSONAS`, `IDIOMA`, `TIPO_CAMBIO`,
   `CFG` (datos del cliente), `PORTADA` + `PORTADA_IDIOMA` + `PORTADA_CFG` (portada),
   `OPCIONES` (menús y líneas de precio), `BEBIDAS`, `CONDICIONES`.
5. Instalar dependencias si falta alguna:
   `pip install reportlab pillow pymupdf --break-system-packages`.
6. Ejecutar `python3 rosanta_cotizador.py`. El script genera la cotización **y le antepone
   la portada automáticamente**.
7. Verificar con `pdftoppm -r 90 archivo.pdf prefijo -png` y revisar cada página
   (portada con los datos correctos, orden de secciones, precios, saludo, firma, sin
   texto cortado).
8. Entregar el PDF con `SendUserFile`. El nombre va en `CFG["salida_nombre"]`.

## Idioma del documento (`IDIOMA`, ago 2026)

Buena parte de los clientes de boda escriben en inglés. **El idioma lo manda el cliente:**
si escribió en inglés, la cotización va en inglés completa, portada incluida.

- `IDIOMA = "es"` (default) → todo en español.
- `IDIOMA = "en"` → las etiquetas fijas salen de `ETIQUETAS["en"]` (EVENT PROPOSAL,
  Private Event Proposal, Client/Event/Date/Guests/Space, Item/Price/Qty, Service 15%,
  Deposit 50%, Balance at close, Per person, Price breakdown, Terms and Acceptance,
  For Rosanta / For the Client, Page N) y los textos oficiales de `TEXTOS_EN` y
  `TEXTOS_OPCION_EN`.
- Los menús, bebidas y condiciones se escriben a mano en el idioma que toque.
- **`PORTADA_IDIOMA` debe ir igual que `IDIOMA`**, o sale un documento mitad y mitad.
- Saludo en inglés: "Hi [Name],". Nunca "Dear".
- "Cocina con Carisma" NO se traduce: es marca.

## Equivalente en dólares (`TIPO_CAMBIO`, sep 2026)

Para clientes extranjeros, la tabla puede mostrar el equivalente en US$.

- `TIPO_CAMBIO = None` (default) → solo quetzales.
- `TIPO_CAMBIO = 7.0` → agrega tres líneas al pie de la tabla (TOTAL, Depósito 50% y
  equivalente por persona, todos en US$) más la nota de tipo de cambio.
- **Tasa de referencia acordada: Q7.00 = US$1.00.** Es una tasa de conveniencia, no la del
  banco. Si Juanma pide otra, usar la suya.
- El cobro **siempre** se hace en quetzales. La nota bajo la tabla lo dice explícitamente:
  *"Reference exchange rate: Q7.00 = US$1.00. Charges are made in quetzales."*

## Portada (obligatoria en toda cotización que se envía al cliente)

Toda cotización sale con las **2 páginas de plantilla** diseñadas por Juanma (ago 2026),
antes de la cotización: portada con foto del jardín + página "Por qué Rosanta".

- `PORTADA = "boda"` → bodas, novios, cenas de ensayo (rehearsal dinner) y cotizaciones
  pedidas por wedding planners.
- `PORTADA = "eventos"` → todo lo demás (corporativo, graduación, aniversario, cumpleaños,
  bienvenida, brunch, cena privada).
- `PORTADA = None` → **solo** borradores internos. Nunca para un envío al cliente.

**El diseño de la plantilla NO se toca.** Lo único que cambia es el bloque de datos del
cliente de la página 1, vía `PORTADA_CFG`:

| Campo | Qué es | Ejemplo |
|---|---|---|
| `evento` | Título grande en serif verde | `"Boda de Nikita & Adam"` |
| `cliente` | Va como "Preparada para ___" ("Prepared for ___") | `"Patricia Monterroso"` |
| `fecha` | Fecha en texto | `"Jueves 6 de mayo, 2027"` |
| `personas` | `None` = usa `PERSONAS` | `120` |
| `espacio` | Espacio del evento | `"Rosanta completo"` |
| `linea_datos` | Sobreescribe la línea completa | `None` normalmente |

Reglas:

- Si la cotización la pide un **wedding planner**, en `cliente` va el planner y los novios
  van en `evento` (ej. evento `"Boda de Nikita & Adam"`, cliente `"Patricia Monterroso"`).
- El título del evento se centra y **se reduce solo** si no cabe. Mantenerlo corto
  (idealmente < 35 caracteres) para que conserve el tamaño del diseño.
- El resto de la página 1 (foto, wordmark, flor, coordenada 14° N · 91° W) y el diseño de
  la página 2 son fijos: no se editan. En español tampoco se tocan sus textos.
- La numeración interna de la cotización no cambia (la portada no lleva número de página).
- Implementación: `portada.py` (PyMuPDF). Repinta en blanco el bloque
  y reescribe con Playfair Display (título, `#4E6D5A`) y Lato Regular (datos, negro),
  que son los equivalentes libres de las tipografías del diseño original.
- Uso suelto (sin cotización): `python3 portada.py` genera `prueba_portada.pdf`, o
  `from portada import generar_portada`.

### Portada en inglés (`PORTADA_IDIOMA = "en"`, ago 2026)

La plantilla de Canva está en español. Con `PORTADA_IDIOMA = "en"`, `portada.py` repinta
**solo los textos**, sobre el mismo diseño, mismas posiciones y mismos colores:

- Página 1: la etiqueta, "Preparada para", "N personas" y la itálica del pie.
- Página 2: el título "Por qué Rosanta", el párrafo de entrada, los tres bloques 01/02/03
  y la itálica de cierre.
- **No se tocan** (son marca): el wordmark, `COCINA CON CARISMA`, la foto, la flor, la
  coordenada `14° N · 91° W` y el pie `Rosanta · Cocina con Carisma`.
- El texto inglés vive en el diccionario `EN` de `portada.py`. Cambiarlo ahí, no en línea.
- El bloque `01` en inglés dice "the pergola and the garden": se omite la chimenea a
  propósito, por la prohibición de mencionar el fuego (ver reglas de escritura).
- Si Juanma entrega plantillas de Canva nuevas, **hay que volver a medir** las constantes
  `P1_*` y `P2_*` de `portada.py`: están medidas sobre las plantillas de ago 2026.

#### Traducciones fijas de la portada (no reescribir)

| Español | Inglés |
|---|---|
| COTIZACIÓN DE EVENTO | EVENT PROPOSAL |
| Preparada para | Prepared for |
| N personas | N guests |
| El jardín completo, una sola mesa: la suya. | The whole garden, one table: yours. |
| Por qué Rosanta | Why Rosanta |
| La mejor mesa es la sobremesa. | The best seat is the one after dinner. |
| El jardín es suyo | The garden is yours |
| Del huerto al maridaje | From garden to pairing |
| Cuidado en cada detalle | Care in every detail |

El script calcula automáticamente: servicio 15%, total, depósito 50%, saldo al cierre,
equivalente por persona, equivalentes en US$ si hay `TIPO_CAMBIO`, recorte e inserción de
la firma oficial, y arma la tabla de precios de cada opción.

## Textos persuasivos oficiales (vigentes 7 ago 2026)

Van **tal cual** en toda cotización. Solo cambian nombre, fecha y datos. Están en los
diccionarios `TEXTOS` / `TEXTOS_OPCION` (y sus gemelos `TEXTOS_EN` / `TEXTOS_OPCION_EN`)
del script: no reescribirlos ni "mejorarlos".

**Saludo e intro**

> Hola [Nombre],
>
> Una fecha así merece más que un salón: merece un jardín. Esta propuesta reúne menú,
> espacio y precios, pensada para que su único pendiente sea llegar a celebrar.

**Opción A. Eventos Especiales (menú servido)**

> Tres tiempos servidos a la mesa, al ritmo de su celebración. Cada invitado elige su
> menú y el equipo se ocupa de que todo llegue a su punto y a su tiempo.

Nota bajo la tabla: *Precios por persona. El 15% de servicio va detallado en la tabla.*

**Opción B. Estilo Rosanta (Para Compartir)**

> Así se come aquí: entrantes al centro, manos que se cruzan y una conversación que
> arranca sola. Cada invitado elige su fuerte y lo demás se comparte, como en las mesas
> que se recuerdan.

Nota bajo la tabla: *Los entrantes se comparten y se cobran por plato (1 por cada 2
invitados); el fuerte va por persona.*

**Opción C. Tapas Guatemaltecas y Barra Libre**

> La celebración de pie. Bocados guatemaltecos que circulan entre sus invitados y una
> barra abierta durante todo el servicio, para brindar, conversar y moverse por el jardín
> a su ritmo.

Subtítulo de barra: **Barra libre** → *Cocteles de temporada, vino, cerveza y mocktails,
servidos durante las tres horas del evento.*

Nota bajo la tabla: *Las tapas se sirven por persona (6 piezas). La barra queda abierta
durante las tres horas de servicio.*

> Uso interno: la C va siempre de última y jamás abre la conversación.

**Bebidas incluidas** — línea de entrada antes de los paquetes:

> La barra acompaña del brindis a la sobremesa:

Cuando la Opción C va sola se **omite toda la sección** (poner `BEBIDAS = None`): la barra
libre ya las lleva incluidas.

**Términos y Aceptación** — línea de entrada antes de las condiciones:

> Lo importante, claro y por escrito:

Condiciones, en afirmativo:

- La reserva incluye 3 horas de servicio en el jardín, con el uso del espacio incluido:
  Rosanta no cobra alquiler del lugar.
- Se agrega 15% de servicio sobre el subtotal.
- Depósito del 50% para apartar su fecha; saldo al cierre del evento.
- Cotización válida por 15 días.
- Si los invitados eligen distintos menús el día del evento, el depósito se calcula al
  precio premium y se ajusta en el restaurante.

**Cierre del documento**

> Ustedes eligen la fecha y llegan a celebrar; el jardín hace el resto. La mejor mesa es
> la sobremesa, y la suya ya tiene fecha.

### Reglas de escritura para cualquier texto nuevo de esta sección

- Afirmativo siempre, sin comparaciones negativas.
- Segunda persona: saludo con "Hola [Nombre]," ("Hi [Name],") y cuerpo en usted/ustedes.
- El cliente es el protagonista.
- Titulares de sección en mayúsculas. Frases cortas.
- **Prohibido:** "nuestro/a" (y "our") · abrir con "En Rosanta" · em dashes · "Estimado/a"
  (y "Dear") · "coctel de autor" · "cocina de autor" · cualquier mención al fuego, la leña
  o la gravilea · "parrilla vista" · "chimenea de piedra" · "el local completo se reserva".

## Estructura del documento (ORDEN OFICIAL, obligatorio)

0. **Portada** (foto del jardín + datos del cliente) y **"Por qué Rosanta"**, desde la
   plantilla `plantillas/portada_[eventos|boda].pdf`.
1. Encabezado verde con franja lila, "ROSANTA / Cocina con Carisma", etiqueta "COTIZACIÓN DE EVENTO".
2. Título "Cotización de Evento Privado" + subtítulo del evento.
3. Tabla de datos (Cliente, Evento, Fecha, Personas, Espacio).
4. Saludo + introducción.
5. **Por cada opción, en este orden:** título de la opción, descripción, los menús/secciones
   con sus platos, la etiqueta de precios y **la tabla de precios de esa opción justo debajo
   de sus menús**, seguida de la nota. (NO agrupar las tablas al final.)
6. "Bebidas incluidas (ambas opciones)".
7. "Términos y Aceptación": condiciones + firma oficial sobre la línea "Por Rosanta" y
   "Por el Cliente", y frase de cierre.
8. Footer con datos de contacto, número de página y punto verde.

La etiqueta de la tabla es "Detalle de precios. Opción X" cuando hay varias opciones y
**"Detalle de precios" a secas cuando se cotiza una sola**. El script lo resuelve solo
según `len(OPCIONES)`.

## Reglas de negocio (aplicar siempre)

- **La tabla de precios va inmediatamente después de los menús de cada opción**, no agrupada
  al final. (Formato aprobado por Juanma, jun 2026.)
- **Saludo:** NUNCA usar "Estimado/Estimada/Estimados" ni "Dear". Empezar con
  "Hola [Nombre]," o "Hi [Name]," (cálido, cercano). El cuerpo sigue en "usted/ustedes".
- **Textos de venta:** usar los de la sección "Textos persuasivos oficiales" palabra por
  palabra. Si hace falta un texto nuevo, seguir las reglas de escritura de esa sección.
- **Firma:** SIEMPRE incrustar la firma oficial (`Firma_Rosanta_VF.png`). Nunca dejar solo una línea.
- **Platos reales:** usar los platos de la carta de Rosanta, no inventar. La carta bilingüe
  vive en el Doc de Drive "Menus - To print"
  (`1InheSqL56OPyUajmp-LLgkCkvDmEBVRXIjRqz8VHs9E`), con los nombres en inglés ya resueltos.
  Si no se tiene a mano, pedir confirmación a Juanma.
- En la Opción A (Eventos Especiales), **cada menú muestra su precio en el título**
  (ej. "Menú 1. Pollo (Q320)").
- Sin em dashes ni en dashes (reemplazar por punto, coma, dos puntos o paréntesis).
- **Primer contacto:** presentar Opción A (Eventos Especiales servido) y Opción B (Estilo
  Rosanta, Para Compartir). Tapas + Barra Libre es siempre el último recurso. Cuando el cliente
  ya eligió una opción, cotizar solo esa.
- **Para Compartir:** entrantes se cobran por plato, **1 plato por cada 2 invitados**
  (cantidad `"porcada2"`), no por persona. El fuerte (o fuerte con postre) sí va por persona.
  El ratio viejo 1:3 (`"porcada3"`) queda solo para reproducir cotizaciones anteriores a
  ago 2026.
- Cuando los invitados elijan distintos menús el día del evento, cotizar al precio premium
  para el depósito y ajustar en el restaurante.
- 15% servicio sobre subtotal. 50% depósito para reservar. Cotización válida 15 días.
- Decoración (Say Yes in Antigua): los precios del documento son costo; sumar 35% de margen
  y redondear a la centena más cercana.
- Tono y paleta según la skill `rosanta-brand-guidelines`.

## Cómo definir las líneas de precio

Cada opción tiene `lineas`, una lista de `(concepto, precio, cantidad)`. La `cantidad` puede ser:
- `"personas"` → usa el valor de `PERSONAS`.
- `"porcada2"` → 1 por cada 2 invitados (ceil(PERSONAS/2)); ratio vigente para entrantes
  Para Compartir.
- `"porcada3"` → 1 por cada 3 invitados; ratio antiguo, solo para cotizaciones viejas.
- un número entero fijo.

## Precios de catálogo (vigencia 2026 — si el evento es 2027+, confirmar con Juanma)

Menú para Eventos Especiales (servido, tres tiempos completos):
- Pollo y Vegetariano: Q320 (completo)
- Lomito y Pescetariano: Q350 (completo)
- Quitar entrante o postre: Q50 cada uno (descuento simétrico)

Menú Para Compartir:
- Entrantes: **Q170 por plato** compartido (rango Q160–175; Q170 es el precio de las
  cotizaciones aprobadas más recientes)
- Fuerte: Q210 · Fuerte con postre: Q260

Bebidas:
- Paquete estándar (mocktail de bienvenida + 2 bebidas con alcohol a elección): Q150/persona
- Solo refrescos naturales no alcohólicos: Q100/persona
- Barra Libre ilimitada: Q200/persona
- Descorche en evento (el cliente trae el licor, Rosanta opera la barra): Q120/persona,
  cobrado por persona, nunca por botella

Tapas Guatemaltecas: Q150/persona (6 piezas) o Q25/boquita individual. Barra Libre: Q200/persona.
Combo Tapas + Barra Libre: Q350/persona. (Último recurso, no abrir con esto.)

**Flight de tapas guatemaltecas: Q100/persona (3 piezas)**, servido a la llegada como
abreboca antes de los platos a compartir. Se combina con el menú Para Compartir.

Si Juanma da un precio distinto al catálogo, usar el de Juanma y avisarle de la
discrepancia para que actualice esta skill.

## Notas de implementación del PDF

- Paleta (Brand Kit anti-brand, jul 2026): Verde Bosque `#4E6D5A`, Lila `#AEAAE2`, Morado subtítulo `#8A7FA6`, Crema `#F2EEEB`, Negro `#000000`.
- Tipografía sans (Helvetica) en todo el cuerpo; títulos en verde y negrita.
- La firma se recorta con PIL `ImageChops.difference` y se guarda en `/tmp/firma_crop.png`
  (lo hace el propio script). `Firma_Rosanta_VF.png` debe estar junto al script.
- Verificación: `pdftoppm -r 90 file.pdf prefix -png`.
- Dependencias: `reportlab`, `pillow` y `pymupdf`
  (`pip install reportlab pillow pymupdf --break-system-packages` si falta alguna).
- Las plantillas de portada están recomprimidas a JPEG q82 (~1.2 MB cada una) para que
  la cotización final pese ~2.7 MB y viaje bien por correo. No reemplazarlas por los
  originales de Canva sin recomprimir.
- El PDF final pesa ~2.9 MB: **demasiado para adjuntarlo por el conector de Gmail**. Crear
  el borrador con `create_draft` y avisar a Juanma que adjunte el PDF a mano antes de enviar.