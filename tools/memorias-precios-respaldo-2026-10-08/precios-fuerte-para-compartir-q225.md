---
name: precios-fuerte-para-compartir-q225
description: Precios vigentes de los fuertes Para Compartir (Lomito Q225, Pollo Q210), el tier premium/estándar y la regla de redondeo de Juanma al subir precios.
type: project
sources: [cowork-import]
imported_at: 2026-09-15T08:12:14Z
---

Definido por Juanma el 12 sep 2026, cotizando el aniversario de Indira Rafael.

**Fuertes del menú Para Compartir (sin postre), con tier:**
- **Lomito en salsa de puerros: Q225** (premium). Sale de Q210 + 7% = Q224.70, redondeado hacia arriba.
- **Muslos de pollo a la naranja: Q210** (estándar). Sale de aplicar la misma proporción que en el menú servido (Pollo Q320 / Lomito Q350 = 0.914): Q225 × 0.914 = Q205.71, redondeado al siguiente múltiplo de 5.

**Pollo y lomito NO valen lo mismo.** El catálogo de Para Compartir traía un solo precio de fuerte (Q210) y por eso es fácil equivocarse: Juanma corrigió que el pollo siempre va por debajo del lomito, igual que en el menú servido.

**Regla de redondeo al subir precios:** precio actual + el porcentaje que indique Juanma, **redondeado al siguiente valor "exacto"**, es decir múltiplos de 5 (55, 60, 225). Nunca valores intermedios (nada de Q224.70 ni Q227).

**Cómo se arma en el PDF:**
- En el menú, el precio va junto a cada fuerte entre paréntesis: "Lomito en salsa de puerros (Q225)", "Muslos de pollo a la naranja (Q210)".
- En la tabla, una sola línea al precio premium: "Fuerte, elección individual (precio premium, ajustable)" a Q225, y la condición de siempre (si eligen distintos menús, el depósito se calcula al premium y se ajusta en el restaurante).

La **pesca del día quedó fuera** de la oferta Para Compartir (Juanma pidió eliminarla). El plato de quinoa vegetariano tampoco se listó en esa cotización; confirmar con él si se vuelve a incluir.

Los entrantes siguen en Q170 por plato (1 por cada 2 invitados); Juanma no pidió subirlos. El fuerte con postre (antes Q260) todavía no se ha recalculado: preguntar antes de usarlo.

Relacionado: [[menu-para-compartir-platos]], [[cotizacion-formato-precio-por-opcion]].

> **Nota del 23-sep-2026.** Estos precios ya están en la skill `rosanta-cotizador`, que vive en
> `~/.claude/skills/` desde hoy. Si Juanma vuelve a mover precios, hay que tocar la skill y esta
> memoria en la misma pasada.

> **Fuerte con postre, resuelto el 23-sep-2026: Lomito Q275 · Pollo Q260.** Se calculó con la
> regla de la casa, no con un porcentaje: en el menú servido quitar el postre descuenta **Q50**,
> así que agregarlo suma lo mismo (225+50 y 210+50). Los dos caen en múltiplo de Q5, así que la
> regla de redondeo no cambia nada. El Q260 viejo sobrevive, pero ahora es el precio del pollo,
> no el precio único. Ya está en la skill `rosanta-cotizador` y en la plantilla de
> `rosanta_cotizador.py`, que además quedó con los entrantes a Q170 «por cada 2» (traía Q160
> «por cada 3», el ratio viejo) y las bebidas con Barra Libre a Q225.

