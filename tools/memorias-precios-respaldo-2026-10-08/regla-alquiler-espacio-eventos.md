---
name: regla-alquiler-espacio-eventos
description: "Cuándo se cobra alquiler del espacio en eventos privados (umbral 25 pax o Q15,000) y precio reducido para brunch"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4fe6e692-ea9f-4fc1-9798-06552ed34239
  modified: 2026-09-13T02:32:09.874Z
---

Regla de alquiler del espacio (Juanma, 2026-09-12):

- El espacio va sin alquiler solo para grupos de más de 25 personas o consumos de Q15,000 o más.
- Por debajo de ese umbral **se cobra alquiler del espacio**.
- Brunch lleva un alquiler más bajo que el normal: **Q1,500** (primer caso: María José Porres, 15 pax, 29 nov 2026).

- **El alquiler va siempre fuera del 15% de servicio.** El servicio se calcula solo sobre alimentos y bebidas; el alquiler se suma aparte al total. Los Q15,000 del umbral se cuentan sin el alquiler.
- Precio del alquiler para eventos que no son brunch (Juanma, 2-oct-2026): **Q2,500 en fin de semana (viernes, sábado y domingo) y Q1,500 entre semana (lunes a jueves)**. (Antes era caso por caso.)

**Why:** la skill rosanta-cotizador dice "Rosanta no cobra alquiler del lugar" y la plantilla "Por qué Rosanta" dice "con el alquiler incluido". Eso solo vale arriba del umbral.
- En la cotización se deja la página "Por qué Rosanta" (no se quita) y se agrega una nota al final: "Nota: el alquiler del espacio va incluido en eventos de más de 25 personas o con consumo superior a Q15,000."

**How to apply:** en grupos de 25 personas o menos y por debajo de Q15,000, agregar la línea "Alquiler del espacio" en la tabla y quitar de los términos la condición "Rosanta no cobra alquiler". Avisar de la contradicción con la página 2 de la portada. Relacionado: [[precios-brunch-evento-2027]]
