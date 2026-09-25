# SEO del menú · qué pegar y dónde

El contenido dentro de un iframe no cuenta como contenido de la página de Wix. Estas tres piezas devuelven a la página lo que el iframe se lleva.

---

## 1. Texto visible fuera del iframe

Va en la página **Menu Completo**, arriba del elemento HTML. Son dos elementos de texto de Wix, no imágenes.

### Título (H1)

```
Menú de Rosanta · Antigua Guatemala
```

En Wix, selecciona el texto y en el panel de estilos elige **Título 1 (H1)**. Es lo que Google lee primero y hoy la página no tiene ninguno.

### Párrafo 1

```
Cocina de temporada en el corazón de Antigua Guatemala. Nuestra carta cambia con lo que da el jardín y lo que traen los productores cercanos, así que siempre hay algo nuevo que probar. Aquí encuentras el menú completo, con precios actualizados, en español e inglés.
```

### Párrafo 2

```
El menú incluye entradas, opciones saludables, hamburguesas, platos fuertes, guarniciones, café y bebidas de la casa, la carta de cócteles de autor y la carta de vinos. Si prefieres verlo en la mesa, el mismo menú está impreso en el restaurante.
```

Estos dos párrafos usan las palabras por las que ya te buscan (rosanta, antigua guatemala) más las que faltan (menú, carta, precios, cócteles, vinos).

---

## 2. Enlace desde el footer

En el pie del sitio, agrega un enlace de texto que diga **Menú** y apunte a la página Menu Completo.

Un enlace en el footer aparece en todas las páginas del sitio. Eso le dice a Google que esa página es importante y la hace fácil de rastrear desde cualquier punto.

---

## 3. Datos estructurados

El archivo `rosanta-schema-menu.html` trae dos bloques de código listos para pegar.

**Qué contienen:** la ficha del restaurante en Antigua Guatemala, y el menú completo con las 7 secciones y 78 platos y bebidas, cada uno con su descripción y su precio en quetzales.

**Dónde se pega:** en el dashboard de Wix, Settings → Custom Code → Add Code.

- Pegar el contenido completo del archivo
- Ubicación: **Head**
- Aplicar a: **páginas específicas**, y elegir solo Menu Completo
- Cargar: **una vez**

**Antes de pegarlo, revisa una línea.** El código usa esta URL:

```
https://www.rosanta.rest/menu-completo
```

Si el slug real de tu página es otro, cámbialo. Lo ves en Wix, en la configuración de la página, en el campo de la URL. Aparece tres veces en el archivo.

**Cómo verificar que quedó bien:** después de publicar, pega la URL de la página en el Rich Results Test de Google. Debe reconocer Restaurant y Menu sin errores.

---

## Qué esperar

Esto no da resultados el mismo día. Google necesita volver a rastrear la página.

- **Semana 1:** verificar en Search Console que la página está indexada
- **Semanas 2 a 4:** empiezan a aparecer impresiones para búsquedas de menú y carta
- **Referencia:** hoy tus consultas principales son rosanta, rosanta antigua guatemala y rosanta antigua

Los datos estructurados además habilitan que Google muestre platos y precios directamente en el resultado de búsqueda, que es donde se gana el clic contra los otros restaurantes de Antigua.
