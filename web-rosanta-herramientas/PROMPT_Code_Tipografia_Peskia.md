# Prompt para Code · tipografía Peskia

Copiar todo lo que sigue.

---

Tarea de Editor de Wix. **No hay API para esto**: el Text Theme y el diseño de widgets viven solo en el Editor. Hazlo por navegador con mi sesión de Chrome.

## Contexto

Sitio: rosanta.rest
Editor: `https://restaurante04-rosanta.editor.wix.com/html/editor/web/renderer/edit/ef9512c1-be00-4456-8051-2eea87545e64?metaSiteId=47968b83-c2c2-4b11-8f94-ef2c7488debc`

**Qué pasó:** en **Site Design → Text theme → Heading font** se cambió la fuente de titulares del sitio a **Peskia Bold**. Antes de ese cambio, la fuente era **Avenir**.

En Wix el Text Theme es el valor por defecto de todo el sitio, así que esa fuente cae en cascada sobre cada encabezado, incluidos los 78 nombres de plato del widget de menú en la página "Menus (New)". Resultado: nombres de plato en Peskia, ilegibles a ese tamaño y en minúsculas.

## Regla de marca

- **Peskia:** solo titulares, **siempre en mayúsculas**, en grande. Es una fuente display.
- **Cuerpo, nombres de plato, descripciones:** Lato.

## Paso 1 · Averiguar si el widget tiene control propio de fuentes

En la página **Menus (New)**, doble clic sobre el menú hasta que arriba a la izquierda aparezca la etiqueta **#menus1**. Con un solo clic seleccionas la sección, no el elemento.

Aparece una barra vertical de iconos a la derecha. El **lápiz** despliega los botones *Manage Menus* y *Settings*, y hay un menú de **tres puntos**.

Busca algo tipo **Design** o **Change design**. Empieza por los tres puntos: el botón *Settings* me sacó del Editor al dashboard.

## Camino A · si el widget SÍ tiene control de fuentes propio

Configura dentro del widget:

- Nombres de plato → **Lato**
- Título del menú y títulos de sección → **Peskia, mayúsculas**, tamaño mayor al actual
- Descripciones y precios → dejar la sans legible que ya tienen

El Text Theme del sitio se queda como está. Fin de la tarea.

## Camino B · si el widget NO tiene control propio

Entonces el arreglo va desde arriba, y es en dos tiempos.

**B1. Devolver el tema.** Site Design → Text theme → Heading font → **Avenir**, que es lo que había antes.

Esto devuelve a legible todos los encabezados del sitio, incluidos los 78 nombres de plato. También quita Peskia de los titulares donde sí la queremos, y eso se arregla en B2.

**B2. Aplicar Peskia con pincel.** Los textos nativos de Wix sí se pueden seleccionar uno por uno y cambiarles la fuente sin tocar el tema.

**No adivines cuáles.** Recorre el sitio y hazme un inventario de los titulares candidatos: en qué página está cada uno, qué dice, y qué nivel es (H1, H2). Pásamelo y yo te digo cuáles llevan Peskia. Es decisión de marca, no técnica.

**Avísame antes de ejecutar B1**, porque cambia titulares de todo el sitio y quiero verlo antes.

## Advertencias

- **El Editor me expulsó al dashboard tres veces** mientras intentaba esto. Si te pasa, no insistas a ciegas: dime qué viste y paramos.
- **No publiques.** Guardar sí; publicar es decisión aparte y la tomo yo.
- No toques nada más del sitio.
- Si algo no cuadra con lo que digo aquí, verifica antes de afirmar.
