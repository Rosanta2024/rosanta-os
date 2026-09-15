# Finanzas & Data OS · Honorarios de marketing aparte de la pauta · 15 sep 2026

Pedido de Marketing OS para el CAC mensual (p10). **Publicado en la @98**; maestro aplicado y espejo por regenerar.

## Lo que se creía y lo que era

1. **"Los honorarios de la agencia están en `MARKETING_DIGITAL`".** No. Edwin Flores factura **Q2,000/mes** (feb–ago, Q14,000 en FEL) y sus pagos del banco ("Marketing Marzo26", "junio marketing", **Q16,250**) están en `SERVICIOS_PROFESIONALES`; la regla 9 ya los descuenta como pago de esa factura. Nunca estuvieron en marketing digital.
2. **"Las cuatro `BANCA ELECTRONICA` son la agencia".** No: son los **honorarios de Vanessa Wilches**, ~US$207 al mes de abril a julio por transferencia, y US$190 en agosto por PayPal. Confirmado por Juanma. Meta y Google se cobran siempre a la tarjeta del BAC.
3. **El CAC de Marketing sumaba solo la columna de quetzales de la tarjeta.** Los cargos de Google Ads van en la de **dólares**: la pauta de 2026 es **Q16,521**, no Q10,800. El motor sí convierte (×7.7); el CAC no.

## Qué se hizo

- **Categoría nueva `MARKETING_HONORARIOS`**, en el motor y en `generar_finanzas.py`, **en el mismo bloque Marketing** que la pauta: el DRE no se mueve.
- **Lote en el maestro** (`reclasificar_marketing.js`, 6 filas): las 4 transferencias a Vanessa y su PayPal a `MARKETING_HONORARIOS`; **MYFONTS** (US$18) a `CUOTAS_Y_SUSCRIPCIONES`.
- **`MARKETING_DIGITAL` queda solo con medios**, así que el CAC puede filtrar por categoría en vez de por el texto del banco, que es lo frágil: las transferencias de Vanessa dicen "BANCA ELECTRONICA".
- **Prueba nueva en el grupo 8:** las dos categorías tienen que caer en el bloque Marketing.

## Verificación

- **Node, 13 OK:** el script corrido sobre una copia del espejo (simulación, aplicación y segunda revisión), y el DRE comparado antes y después. **Bloque Marketing: Q51,446.26 en los dos casos.** Resultado del año sin cambio.
- **Control negativo:** con el motor anterior, esas filas caen fuera del mapa y el bloque Marketing baja a Q43,415. De ahí el orden: publicar el motor antes de aplicar el maestro.
- **Log de Juanma:** simulación 6 filas sin avisos; aplicación "Releidas: todo quedo escrito".
- **Subidas verificadas con bajada aparte:** intranet 58 archivos, maestro 24.

## Nota de proceso

Esta vez se publicó **sin batería previa**: Juanma aplicó el lote en el maestro antes de correrla y pidió publicar. Dejarlo sin publicar habría descuadrado el bloque Marketing del DRE en Q8,032 mientras tanto. La batería queda pendiente de correr sobre la @98.

## Pendiente

1. **Juanma:** `revisarReclasMarketing()` (0 filas, 6 ya estaban bien), `generarEspejo()` y la batería.
2. **Marketing OS:** cambiar el numerador del CAC a la categoría `MARKETING_DIGITAL` completa, con la columna de dólares convertida.
