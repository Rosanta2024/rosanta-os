# Generador del maestro financiero

`generar_finanzas.py` lee el espejo del maestro y produce cuatro JSON.

**Desde el 2026-09-12 no alimenta ninguna pantalla.** La única superficie del pilar
de Finanzas es la **intranet**, y la intranet lee el Sheet nativo del maestro en vivo
(`FinanzasDatos.gs`). **Nunca leyó estos JSON**, aunque este README decía lo contrario
antes del 12-sep.

**El código vive acá. Los datos siguen en Drive.** Es la regla 4 del README de
Rosanta OS. Hasta el 2026-09-11 los `.py` estaban en la carpeta de Drive junto a sus
datos; se mudaron y las rutas quedaron parametrizadas en `rutas.py`.

## Para qué sirve hoy: validador A/B

Es el **mismo cálculo que la intranet, leído por otro camino**: espejo `.xlsx` y
Python, en vez de Sheet nativo y Apps Script. Si los dos dan distinto, uno de los dos
se desvió. Es la única comprobación independiente de que los números de la intranet
son los que eran.

Para cotejar sin escribir en Drive:

```bash
cd ~/Dev/Rosanta/scripts/maestro-finanzas && python3 generar_finanzas.py \
  "$HOME/My Drive/Rosanta OS/03_Finance_Data_OS/Maestro/Rosanta_Maestro_ESPEJO.xlsx" \
  --datos /tmp/ab
```

**Referencia medida el 2026-09-23** contra el espejo del 21-sep 15:51 (datos hasta el
20 de septiembre):

| | Valor |
|---|---|
| Ventas del año | Q1,308,046 |
| COGS · labor · prime · neto | 38.9% · 20.6% · 55.9% · −4.6% |
| Meta de food cost | 28.0% |
| S38 (14/09–20/09) | ventas Q19,309 · food móvil4 43.1% · prime móvil4 63.9% · caja Q24,011 (4.7 días) |
| Integridad | compra con factura 55.1% · 0 en POR_CLASIFICAR · fuga Q0.00 |

**El food cost va sobre VENTA SIN SERVICIO** (regla 14, decisión de Juanma del 15-sep):
la venta que trae el maestro incluye el 10% de servicio, y la meta y las fichas no. Por eso
la columna dice `food%ss`. Prime, neto y el resto del DRE siguen sobre la venta total.

La tabla anterior —medida el 12-sep contra el espejo del 10-sep— traía Q1,261,109, neto
−7.3%, meta 30%, 3 partidas en POR_CLASIFICAR y fuga Q7,611.25. Cambió por cuatro cosas, no
por un error: entraron dos semanas más de datos, la meta pasó a 28% sobre venta sin servicio,
se clasificaron las tres partidas sueltas y **la regla 9 se retiró** (ver abajo).

### La regla que manda hoy: la 15, "la factura manda"

El 23-sep-2026 se retiró la **regla 9** —saltaba el pago de una lista de 7 proveedores
asumiendo que su factura ya venía por FEL, sin verificarlo— y la reemplazó la **regla 15**:
cada pago se casa con UNA factura del mismo bloque del DRE, mismo monto (±Q0.01) y emitida
entre 45 días antes y 10 después, y sólo entonces se salta. Un pago sin factura cuenta como
gasto, que es lo conservador.

**Las dos implementaciones tienen que seguir siendo la misma:** `casar_pagos()` acá y
`_finCasarPagos_` en `FinanzasDatos.js` de la intranet. Si una cambia y la otra no, el A/B
deja de valer y no lo avisa nadie.

Lo que la regla 15 saltó en la corrida del 23-sep, para cotejar contra la intranet:

| Hoja | Saltado por tener factura FEL |
|---|---|
| `03_Banco_Industrial` | Q35,308.98 |
| `05_Tarjeta_Credito_BAC` | Q5,843.09 |
| `04_Banco_BAC` | Q1,510.60 |
| Reglas 3, 7 y 15 juntas | Q225,715.80 |

**Límite conocido (p192):** la regla 15 casa UNA factura por pago, así que un pago que cubre
varias facturas del mismo proveedor no casa con ninguna y vuelve a sumar. Mientras eso siga
abierto, el cotejo va a dar igual de los dos lados y los dos van a estar contando de más.
**Medido el 23-sep sobre el espejo del 21-sep:** de 181 pagos en esos seis bloques, 84 casan
uno a uno (Q42,913) y 97 quedan sueltos (Q105,100). Buscando entre los sueltos los que sean la
suma de 2 o 3 facturas del MISMO NIT dentro de la misma ventana, aparecen 2 casos por Q1,027.46
y sólo uno es real: Claro (NIT 9929290), Q388.58 + Q388.88 = Q777.46 pagados el 11-jun por el
portal del BI. El otro es coincidencia de monto. O sea que el agujero existe pero hoy vale
unos Q777, no miles.

### Diferencias esperadas contra la intranet

- **La planilla devengada.** La intranet la lee del Sheet `Planilla 2026` (una pestaña
  `AAAA-MM` por mes). Este script la tiene **escrita a mano** en `PLANILLA`, y hoy llega
  **hasta agosto**. Septiembre sale *estimado* de este lado y real del lado de la intranet,
  así que la mano de obra de septiembre, su prime y su neto NO tienen que cuadrar. **El viejo
  es este script, no la intranet.** Para que el cotejo del mes en curso valga, hay que agregar
  el mes a `PLANILLA` a mano.
- **El año incluye el mes en curso.** Los dos motores lo hacen igual, así que no es una
  diferencia; lo aclaro porque el prime del año sale optimista mientras el mes en curso
  no tenga planilla.

## Quién lee los JSON: nadie, salvo el cotejo A/B

Desde la tarde del 12-sep no los consume ninguna tarea ni ningún prompt:

1. La tarea de Cowork **`rosanta-reporte-mensual`** se reemplazó por una que verifica el
   cierre del mes sin calcular números ni leer JSON. Se probó con *Run now*: *"Agosto 2026:
   COMPLETO"*.
2. El prompt del **forecast de caja** (p94) ahora construye la pestaña "Caja" de Finanzas
   en la intranet, leyendo del motor (`_finDatos`), no de `pant.json`.

Los JSON quedan como salida del cotejo: se generan solo cuando alguien corre este script.

## Lo que se jubiló el 2026-09-12

| Qué | Dónde quedó |
|---|---|
| `generar_dashboard.py` | `_archivo/2026-09-12_generar_dashboard.py` |
| `Rosanta_Dashboard.html` y `Rosanta_Dashboard_ARTIFACT.html` | `Rosanta OS/_Archive/Unificacion_2026-09-12/03_Finance_Data_OS/Maestro/` |
| Tarea de Cowork `rosanta-dashboard-refresh` | borrada en la app. Su carpeta sigue en `~/Claude/Scheduled/`, sin horario |
| Artefacto `rosanta-dashboard-semanal` | ya no se actualiza |

Se archivó, no se borró: las huellas md5 de los tres archivos se verificaron antes y
después de moverlos. Nada en `~/Dev` importaba ni ejecutaba `generar_dashboard.py`, y la
única tarea que lo corría era la que se borró.

El detalle completo está en
`Rosanta OS/03_Finance_Data_OS/2026-09-12_Unificacion_Intranet.md`.

## Dónde busca los datos

`rutas.py` resuelve la carpeta en este orden:

1. `--datos RUTA` en la línea de comandos
2. la variable de entorno `ROSANTA_MAESTRO_DIR`
3. el default, `~/My Drive/Rosanta OS/03_Finance_Data_OS/Maestro`

Sin `--datos`, lee y escribe en esa carpeta de Drive: el espejo y los cuatro JSON en
`_datos_finanzas/`. Acepta la ruta del espejo como primer argumento posicional.

## La fuente

El espejo **no se edita a mano**: lo exporta cada lunes un Apps Script desde el Sheet
nativo `Rosanta_Reporte_Maestro_v2_2026`
(`1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`). Ese Sheet es la fuente de verdad
financiera — no el `.xlsx`, que es solo el espejo que las herramientas locales saben
leer. Si hubo cambios en el Sheet, correr `generarEspejo()` antes de cotejar.

El código del exportador está en `~/Dev/Rosanta/apps-script/rosanta-maestro`.

## Verificación de la mudanza (2026-09-11)

Se corrieron las dos versiones —la vieja con `BASE = dirname(__file__)` y la nueva con
`rutas.py`— contra una copia del mismo espejo. Los seis archivos de salida (los cuatro
JSON y los dos dashboards, hoy archivados) salieron **byte a byte idénticos**.
