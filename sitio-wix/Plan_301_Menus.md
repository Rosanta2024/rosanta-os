# Plan de redirecciones · consolidar todo en /menu-completo
### Rosanta · 15 de agosto de 2026

**Decisión tomada:** las páginas viejas de menú y las seis páginas sueltas de secciones se redirigen a `/menu-completo`. Una sola fuente de verdad.

---

## Por qué, en una línea

Hoy `/cocktails` anuncia **Q70** para los Signature y el menú real cobra **Q80**. Cada página estática es una copia que se desactualiza sola, y ya pasó. Con el menú viviendo en la app de Wix, esto solo se resuelve teniendo una sola página.

---

## Las redirecciones

### Menús viejos

```
/menú-español    → /menu-completo
/english-menu    → /menu-completo
```

### Páginas sueltas de secciones

```
/para-empezar            → /menu-completo
/something-to-start-with → /menu-completo
/something-stronger      → /menu-completo
/cocktails               → /menu-completo
/beverages-and-wines     → /menu-completo
/spirits-and-liqueurs    → /menu-completo
```

Ojo: en el Editor existen además **Algo más fuerte, Cócteles, Bebidas y Vinos, Licores y Digestivos**, que son las contrapartes en español y **no aparecen en el sitemap**. Antes de borrarlas hay que confirmar si están ocultas de buscadores o simplemente sin indexar. Si están publicadas, necesitan su 301 igual.

---

## Dónde se configuran

Dashboard → **Marketing & SEO** → **SEO Tools** → **URL Redirect Manager**.

Se agrega una por una: URL vieja, URL nueva, tipo **301** (permanente).

---

## El orden importa

Hacerlo al revés rompe la navegación o deja páginas huérfanas indexadas.

**1. Primero, la navegación.**
Hoy el menú de arriba tiene **MENU → Español / English**, apuntando a las páginas viejas. Cambiarlo por un solo ítem **MENU** que apunte a `/menu-completo`.

Mientras la navegación siga mandando a las viejas, el visitante viaja a una página que va a desaparecer.

**2. Después, los 301.**
Se crean las ocho redirecciones de arriba.

**3. Luego, ocultar las páginas viejas.**
No borrarlas todavía. Ocultarlas de buscadores y quitarlas del menú. Si algo sale mal, se revierte con un clic.

**4. Observar dos semanas** en Search Console: que las viejas salgan del índice, que `/menu-completo` suba en impresiones, y que el tráfico total no caiga.

**5. Recién entonces, borrarlas.** Los 301 se quedan para siempre, aunque la página ya no exista.

---

## Un detalle que hay que arreglar de paso

La página `/cocktails` cierra con **© 2025 Rosanta**. El pie está desactualizado en al menos esa página. Vale revisar si es del pie global del sitio o solo de esa plantilla vieja.

---

## Lo que NO se toca

- **`/menu-completo`**: es el destino de todo, no se redirige a ningún lado.
- **`/events` vs `/events-1`**: pendiente aparte, necesita su propia decisión.
- **Las páginas de brunch**: no están en el sitemap y no se sabe si están activas. Revisar antes de incluirlas.

---

## Qué esperar

Las redirecciones tardan semanas en procesarse. Es normal ver movimiento en las posiciones mientras Google reasigna la autoridad de ocho URLs hacia una sola.

El beneficio: `/menu-completo` concentra todo lo que estaba repartido, y ya no existe ninguna página capaz de mostrarle a un cliente un precio que no cobras.
