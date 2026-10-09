---
name: bebidas-van-en-la-tabla
description: Las bebidas se cobran dentro de la tabla de precios de la cotización, no solo como sección informativa.
type: feedback
sources: [cowork-import]
imported_at: 2026-09-15T08:11:57Z
---

Corrección de Juanma (12 sep 2026, cotización de Indira Rafael): la cotización salió con las bebidas solo listadas en la sección "Bebidas" y él pidió agregarlas.

**Regla: el paquete de bebidas va como línea de cobro en la tabla de precios**, con su precio por persona y la cantidad = número de invitados. Por defecto se cotiza el **paquete Q150** (mocktail de bienvenida + 2 bebidas con alcohol). La sección "Bebidas" queda igual, pero sirve para explicar qué incluye lo cotizado y para ofrecer la Barra Libre Q200 como alternativa de servicio ilimitado.

**Why:** un evento sin bebidas en la tabla deja el total incompleto y el cliente compara mal el precio por persona.

**How to apply:** en `OPCIONES[...]["lineas"]` del script agregar `("Paquete de bebidas (mocktail de bienvenida y 2 bebidas con alcohol)", 150, "personas")` después del fuerte. Si el cliente ya eligió Barra Libre, esa línea va a Q200. Relacionado: [[precio-barra-libre]], [[cotizacion-formato-precio-por-opcion]].
