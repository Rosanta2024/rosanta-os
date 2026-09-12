# Limpieza de páginas basura
### Rosanta · 15 de agosto de 2026

Nueve páginas duplicadas quedaron publicadas de trabajos anteriores. Google las rastrea, las compara con las páginas buenas y concluye que el sitio repite contenido. Eso diluye la autoridad de las que sí importan.

---

## Las nueve

Todas confirmadas hoy en `rosanta.rest/pages-sitemap.xml`:

| # | Página | Es duplicado de |
|---|---|---|
| 1 | `/copy-of-algo-más-fuerte` | Algo más fuerte |
| 2 | `/copia-de-brunch` | Brunch |
| 3 | `/copia-de-brunch-1` | Brunch |
| 4 | `/copia-de-brunch-inglés` | Brunch inglés |
| 5 | `/copy-of-para-empezar` | Para empezar |
| 6 | `/copy-of-para-empezar-1` | Para empezar |
| 7 | `/copia-de-para-empezar` | Para empezar |
| 8 | `/copy-of-licores-y-digestivos` | Licores y digestivos |
| 9 | `/blank` | nada, es una página vacía |

**Verificado hoy:** ninguna de las nueve está enlazada desde el sitio. Se revisaron todos los enlaces de la home y ninguno apunta a ellas. Son huérfanas: Google llegó a ellas por el sitemap, no por navegación.

Eso quiere decir que borrarlas **no rompe ningún camino del visitante**. Es la mejor situación posible para una limpieza.

---

## Lo único que falta verificar, y lo tienes que hacer tú

**Google Search Console → Rendimiento → Páginas.**

Filtra por cada una de las nueve URLs y mira si alguna tiene clics o impresiones en los últimos 3 meses.

- **Cero clics y cero impresiones** en las nueve: adelante sin más, es lo más probable.
- **Alguna tiene tráfico**: no la borres todavía. Avísame y vemos si conviene redirigirla o quedársela.

Esto importa porque una página duplicada que igual recibe visitas está resolviendo la búsqueda de alguien. Borrarla sin redirección pierde esa visita.

---

## El método, en tres pasos

No se borran de golpe. El orden existe para poder dar marcha atrás.

### Paso 1 · Ocultarlas de buscadores

Para cada una, en el Editor:

1. Panel de páginas → clic en los tres puntos de la página → **SEO Basics**
2. Busca la opción que dice que la página aparezca en resultados de búsqueda y **desactívala**
3. Guarda

Esto le pone `noindex`. La página sigue existiendo y sigue accesible por URL directa, pero Google deja de mostrarla y con el tiempo la saca del índice.

**Por qué primero esto y no borrar:** si algo sale mal, se vuelve a activar con un clic. Un borrado no se deshace.

### Paso 2 · Observar dos semanas

En Search Console, revisa que las nueve vayan saliendo del índice y que **el tráfico total del sitio no baje**. Dos semanas es el mínimo razonable para que Google reprocese.

Si el tráfico se mantiene, que es lo esperable, sigue al paso 3.

### Paso 3 · Borrarlas con redirección

Recién ahora se borran. Y cada una necesita un **301** hacia su reemplazo:

```
/copy-of-algo-más-fuerte        → /menu-completo
/copia-de-brunch                → /menu-completo
/copia-de-brunch-1              → /menu-completo
/copia-de-brunch-inglés         → /menu-completo
/copy-of-para-empezar           → /menu-completo
/copy-of-para-empezar-1         → /menu-completo
/copia-de-para-empezar          → /menu-completo
/copy-of-licores-y-digestivos   → /menu-completo
/blank                          → /
```

Los 301 se configuran en el Dashboard, en **Marketing & SEO → SEO Tools → URL Redirect Manager**.

**Por qué el 301 y no borrar seco:** sin él, cualquier enlace externo que apunte a esas URLs manda al visitante a un error 404, y el historial que Google acumuló se pierde en vez de transferirse.

---

## Un pendiente aparte que apareció en el sitemap

Existen **`/events` y `/events-1`**, dos páginas de eventos. La que está enlazada en tu navegación es `/events-1`.

O sea que `/events` es probablemente otra huérfana, pero con un nombre que un visitante podría escribir a mano o que Google podría preferir. **No la metas en la limpieza todavía.** Antes hay que confirmar cuál de las dos es la buena y si tienen contenido distinto. Es una decisión tuya y merece su propia revisión.

---

## Qué esperar

Menos duplicados significa que Google reparte mejor su presupuesto de rastreo entre las páginas que sí quieres posicionar. No es un salto de tráfico inmediato: es quitar ruido para que lo bueno pese más.

El efecto se nota en semanas, no en días.
