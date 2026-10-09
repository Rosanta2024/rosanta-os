---
name: conversion-usd-clientes-extranjeros
description: Toda cotización a cliente extranjero lleva la conversión a US$ (TIPO_CAMBIO = 7.0), sin excepción, aunque escriba en español
metadata:
  type: feedback
---

Toda cotización para un cliente extranjero lleva la conversión a dólares: TOTAL, depósito 50% y monto por persona en US$, más la nota de tipo de cambio. Tasa de referencia Q7.00 = US$1.00. Desde el 2-oct-2026 la nota dice que se cotiza en quetzales y que el depósito puede transferirse en dólares (cuenta USD, ver [[correo-cuenta-dolares-clientes-extranjeros]]) y se acredita a la tasa del banco del día.

**Why:** Juanma, 2-oct-2026: "Cuando los clientes sean extranjeros. Toda cotización debe llevar la conversión."

**How to apply:** En `rosanta_cotizador.py`, `TIPO_CAMBIO = 7.0`. Con `IDIOMA = "en"` ya viene así por defecto y el script avisa si se quita. Lo que decide es que el cliente sea extranjero, no el idioma: un extranjero que escribe en español también lleva la conversión, y ahí hay que ponerla a mano. Solo los clientes locales van sin US$. Ver [[correo-idioma-del-cliente]] y [[rutas-de-pago-clientes-extranjeros]].
