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

**Referencia medida el 2026-09-12** contra el espejo del 10-sep:

| | Valor |
|---|---|
| Ventas del año | Q1,261,109 |
| COGS · labor · prime · neto | 34.8% · 19.7% · 54.5% · −7.3% |
| Meta de food cost | 30.0% |
| S36 (31/08–06/09) | ventas Q41,707 · food móvil4 49.0% · prime móvil4 70.3% · caja Q24,011 (4.8 días) |
| Integridad | compra con factura 56.7% · 3 en POR_CLASIFICAR · fuga Q7,611.25 |

### Diferencias esperadas contra la intranet

- **La planilla devengada.** La intranet la lee del Sheet `Planilla 2026` (una pestaña
  `AAAA-MM` por mes). Este script la tiene **escrita a mano** en `PLANILLA`, hasta
  agosto. Cuando exista la pestaña `2026-09`, la mano de obra de septiembre va a subir
  en la intranet y no acá. **En ese caso el viejo es este script, no la intranet.**
  Para que el cotejo siga valiendo hay que agregar el mes a `PLANILLA` a mano.
- **El año incluye el mes en curso.** Los dos motores lo hacen igual, así que no es una
  diferencia; lo aclaro porque el prime del año sale optimista mientras el mes en curso
  no tenga planilla.

## Quién todavía lee los JSON

Hasta que se actualicen, lo único que los lee:

1. La tarea de Cowork **`rosanta-reporte-mensual`**, en su versión vieja. Su reemplazo,
   que ya no los usa, está en
   `Rosanta OS/03_Finance_Data_OS/2026-09-12_Tarea_reporte_mensual_v2.md`.
2. El prompt del **forecast de caja** (p94):
   `~/Dev/Rosanta/apps-script/_informes/2026-09-11_PROMPT_forecast_de_caja.md`.

Cuando los dos estén actualizados, los JSON quedan solo para el cotejo A/B.

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
