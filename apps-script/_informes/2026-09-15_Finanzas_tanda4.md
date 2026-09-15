# Finanzas & Data OS · Tanda 4 · M9, M15 y M26 · 15 sep 2026

Tres hallazgos de la auditoría del 14-sep, revisados contra el código del día. **Publicado en la @96** el 15-sep, con "publica" de Juanma y la batería en verde ("intranet sana"). Antes de publicar se verificó la cuenta de clasp, que la última versión (@95) era la publicada y que HEAD (58 archivos) era idéntico a lo probado y al disco.

## Decisiones de Juanma (15-sep)

1. En 2027 las ventas de 2026 **se quedan en `02_Ventas_Maestro`** y el año nuevo se agrega abajo.
2. El calentador suma **solo Finanzas y la tarjeta real contra teórico**. Caja y RAA quedan como están.
3. Las tres van **en una sola versión**.

## M9 · El RAA guarda con candado

- **Qué pasaba:** `guardarRaa` buscaba la fila de la semana y el indicador y escribía sin candado. Si dos personas guardaban a la vez, las dos elegían la misma fila libre y una de las dos se perdía sin aviso.
- **Qué cambió:** la búsqueda y la escritura van dentro de `LockService`, con `tryLock(20000)`, igual que Inventarios. Si el candado está tomado, no escribe y avisa "Probá de nuevo en unos segundos". Los rechazos de validación siguen antes del candado.

## M15 · El año se calcula

- **Qué pasaba:** el comparativo tenía "2026" y la hoja de 2025 escritos a mano. El 1 de enero habría comparado 2027 contra 2025. Metas calculaba su "+20% contra el año pasado" siempre sobre 2025.
- **Qué cambió:**
  - **Lector único, `_finVentasAnio_(anio)`:**
    - 2025 y antes salen de `02b_Ventas_2025`, como siempre;
    - 2026 en adelante salen de `02_Ventas_Maestro`, con las mismas reglas del cálculo: Subtotal ÷ 1.12, sin eventos y con el día verdadero.
  - **Comparaciones:** el comparativo (`_finComparativo_`) y Metas (`_finBaseAnterior_`) comparan contra el año anterior del cálculo.
  - **Rótulos:** menú, título, leyenda, columnas y textos salen del año. La nota de septiembre de 2025 va por año.
  - **Compatibilidad:** `_finAnio2025_()` y `FIN_NOTAS_2025` se quedan porque la estacionalidad de la Caja los usa. Las claves `v25` y `v26` se quedan: 25 es el año anterior y 26 el del cálculo.
- **Verificado en Node:**
  - **2026:** leído con el lector nuevo, da la misma venta y los mismos tickets que el cálculo en los 9 meses.
  - **2025 y la base de Metas:** idénticas a las del código anterior.
  - **Comparativo de 2026:** idéntico al anterior, más `anio` y `anio_ant`.
  - **Enero de 2027 simulado:** compara contra 2026, enero queda como mes en curso y no aparece la nota de 2025. Sin datos del año anterior devuelve error y no se rompe.
  - **Pantalla con 2027:** "2027 contra 2026" en título, leyenda y columnas.

## M26 · Caché de Finanzas

- **Lo grave no se confirma:** la respuesta de Finanzas pesa **24.4 KB** contra un límite de 100 KB por clave.
- **Lo que sí faltaba:** el calentador no la incluía y el primero que abría la pestaña pagaba el cálculo.
- **Qué cambió:**
  - **Calentador:** `calentarCaches` calienta `finanzas` y `real contra teorico`, al final, después de recetario, tablero y avisos. El chequeo en caliente es solo `c.get` con la misma clave que usa la tarjeta (`cmvRealTeoricoClave_`).
  - **Prueba del calentador** (`Pruebas.js`): los precalienta antes de medir.
  - **Prueba nueva:** falla si la respuesta pasa de 80 KB.
- **Verificado en Node:** en frío reconstruye los dos y quedan en caché con la clave correcta; en caliente, "reconstruido: nada".
- **Coordinación:** con la sesión de Profit OS, que revisó el calentador. Sus cuatro observaciones ya se cumplían.

## Pruebas nuevas (grupo 8)

"El RAA guarda con candado", "El comparativo compara contra el año anterior", "Las ventas del año se leen igual que el calculo" y "La respuesta de Finanzas cabe en el cache". Con el código anterior las tres primeras fallan.

## Verificación

- **Node, con el código real sobre el espejo:** 20 OK, con A/B contra el respaldo de la tanda.
- **Regresión de la tarjeta real contra teórico:** 34 y 83 OK.
- **Scripts de Comparativo, Sistema Finanzas y Metas:** compilados.
- **Respaldos:** `rosanta-intranet/_backups/tanda4-2026-09-15/`.

## Pendiente

1. ~~Batería y publicación~~: hecho (@96).
2. **Vigilar el tiempo:** la prueba del calentador ahora precalienta Finanzas y la tarjeta. Si la batería pasa de ~240 s o esa prueba da AVISO, avisar a la sesión de Profit OS.
3. **Tanda 5:** p142 y A11.
