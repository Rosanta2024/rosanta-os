# Prompt para Code · regenerar el schema del menú

Copiar todo lo que sigue.

---

Regenera el JSON-LD del menú desde los datos limpios que ya están en Wix.

## Por qué

El bloque de datos estructurados que está hoy en producción, llamado **"Schema Menu Rosanta"** (Settings → Custom Code, panel en `/code-embed`, aplicado solo a la página *Menu Completo*), tiene dos defectos verificados:

- Las descripciones están **truncadas**, terminan en puntos suspensivos
- La **Ensalada Rosanta no tiene precio**, porque el generador no supo qué hacer con sus tres variantes

Google está recibiendo la carta incompleta. Ahora los 78 platos están correctos en Wix, así que la fuente buena es la API, no el generador viejo.

## Qué generar

**Solo el tipo `Menu`.** No incluyas `Restaurant`: ya existe un bloque aparte llamado **"Restaurant Schema Markup"** aplicado a todas las páginas, y duplicarlo sería peor que no tenerlo.

Antes de generar, **lee cómo está construido ese bloque de Restaurant** y, si tiene un `@id`, enlaza el menú a él con `hasMenu` o `isPartOf`, lo que corresponda según schema.org. Si no tiene `@id`, dímelo y decidimos.

## De dónde salen los datos

Por API, del menú **"Rosanta Menu"** (id `d4c6af0b-a216-46b0-ac39-9348d870a023`): sus 7 secciones en orden y los 78 items con nombre, descripción, precio y variantes.

Contenido en **inglés**, que es el idioma principal del sitio. Moneda **GTQ**.

## Los casos que rompieron el generador viejo

- **Platos con variantes de precio** (Rosanta Salad con Regular/Tenderloin/Shrimp, Pasta con With tenderloin/Shrimp, y los 13 vinos con Glass/Bottle): en schema.org un `MenuItem` admite **varias `offers`**, cada una con su `price`, su `priceCurrency` y su nombre de variante. Ningún plato debe quedar sin precio.
- **Descripciones completas**, sin truncar. Ese era el defecto principal.

## Qué entregar

Escribe el resultado en un archivo `schema-menu-rosanta-v2.html` en la carpeta del proyecto, listo para pegar, con el bloque `<script type="application/ld+json">` completo.

**No lo instales todavía.** El Custom Code no tiene API y además falta decidir en qué página va a vivir el menú. Solo genera el archivo.

Y hazme una comparación corta contra el bloque actual: cuántas descripciones estaban truncadas, cuántos platos sin precio, y cuántos items tiene cada versión. Quiero ver la mejora antes de reemplazar nada.

## Reglas

- No toques el sitio ni el Custom Code.
- Verifica el JSON-LD generado con el Rich Results Test de Google o un validador, y dime si pasa limpio.
- Si algo no cuadra con lo que digo aquí, verifica antes de afirmar.
