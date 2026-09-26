# Tablero global · Etapa 2: construido en disco, sin publicar · 25 sep 2026

Sesión "Rosanta KPIs Intranet". Catálogo y boceto en `Rosanta OS/03_Finance_Data_OS/KPIs/`. Parte de la @101 (22-sep). **Nada publicado ni pusheado:** `clasp` devuelve `invalid_grant · invalid_rapt` y solo Juanma puede correr `clasp login`.

## Decisiones de Juanma (25-sep)

1. **EBITDA: adelante.** Construido como `neto + Impuestos + venta de eventos`, sin sumar Bienes de uso.
2. **Inventarios se cierran desde la intranet.** El KPI de cierre lee el `ESTADO` de la fila 1 de cada pestaña `AAAA-MM`, que es lo que escribe la intranet al cerrar.
3. **Archivar duplicados solo si no daña nada.** Verificado: ningún código, tarea programada, skill instalada ni documento vivo de Drive referencia `Rosanta_Tablero_de_Metas.xlsx`, `rosanta_ruta_metas.html` ni `PnL_5_Numeros/` (solo los respaldos del cerebro en `tools/` y las auditorías del guardián, que son historia). El artefacto `rosanta-ruta-metas` ya no existe en `~/Claude/Artifacts`. `Rosanta_1.8_Extraccion_5_Numeros_PL.xlsx` ya fue movido a `PnL_5_Numeros/` el 24-sep por otra sesión. **Archivado con el sí de Juanma (25-sep):** los tres fueron a `Rosanta OS/_Archive/Tablero_Metas_2026-09-25/` con un `LEEME.txt`. Nada borrado.
4. **Meta del año y comisión de tarjeta:** recomendación en el mensaje de cierre; sin decidir.

## Qué se construyó (10 archivos tocados, 2 nuevos, 1 herramienta)

| Archivo | Qué |
|---|---|
| `FinanzasDatos.js` | campos nuevos por mes: `ebitda`, `ebitdap`, `eventos_n`, `sin_factura`, `sin_factura_iva`, `mb_comensal`, `com_lmx`, `com_lmx_dias`, `com_lmx_dia`, `medios`; totales del año; caché `finanzas_v11` |
| `InventarioDatos.js` | `invEstadoCierre_(hoy, diaLimite)`, `invTotalMes_`, `getInventarioCierre(auth)` |
| `CrmDatos.js` | `crmAltasPorMes_(anio)` (solo "Cliente que visitó", con tasa de lectura), `getCrmAltasMes(auth)` |
| `MarketingDatos.js` | `mktKpisMes_(anio, finanzas)` (CAC, ROAS proxy, eventos), `getMarketingKpisMes(auth)` |
| `TableroDatos.js` (nuevo) | `getTableroPilar(auth, pilar)`, `tabParametros_`, `tabZona_`, `tabTendencia_`, `tabMesCerrado_`; un pilar por llamada |
| `TableroVista.html` (nuevo) | seis pestañas, tarjetas con semáforo, meta y origen, tendencia y enlace a la pestaña del pilar |
| `Code.js` | ruta `?page=tablero`, rol dueño, misma guarda que `pruebas` |
| `Index.html` | puerta "Tablero global" solo para el rol dueño |
| `Pruebas.js` | `TableroVista` en las tres listas `VISTAS` |
| `PruebasFinanzas.js` | 6 pruebas nuevas al final del grupo 8 |
| `scripts/maestro-finanzas/generar_finanzas.py` | los mismos campos en `cinco.json`, para el A/B |
| `tools/harness-intranet/` (nuevo) | corre el código real en Node sobre el espejo, con mocks de Apps Script |

Las funciones públicas nuevas (`getTableroPilar`, `getInventarioCierre`, `getCrmAltasMes`, `getMarketingKpisMes`) pasan por `exigirModulo_(auth, 'finanzas')` + `invExigirDueno_(u)`, que la prueba "Ninguna funcion publica queda abierta" reconoce. Las privadas llevan guion bajo al final.

## Cotejo (harness, espejo del 21-sep 15:51)

- **Motor == Python en los 9 campos nuevos, los 9 meses.** EBITDA año Q58,311 (4.3%); compra sin factura año Q220,484; medios año Q16,521.
- Inventario al 25-sep con límite día 5: cocina último cerrado 2026-07, agosto `ABIERTO` (Q138 contados) → rojo, 20 días tarde; barra 2026-08 `CERRADO` (Q15,401.86) → verde. Al 3-sep el mismo dato da amarillo (dentro del plazo).
- CRM sintético: cuenta "Cliente que visitó" con y sin acento, fecha como Date o texto, y calcula la lectura.
- Tablero: los seis pilares responden; un token con rol chef es rechazado; K04, K06, K07, K09 y K10 son idénticos a su campo del motor.
- Pruebas nuevas: 5 OK, 1 AVISO (13 metas en defecto: faltan las filas en PARAMETROS).
- Diferencia de redondeo corregida en el Python (`round` al par contra `_finR_` medio arriba).

Lo que el harness NO cubre: Profit OS (`getProfitOS`, `getCmvRealTeorico`) porque necesita el POS y el recetario; el dibujo de `TableroVista` (HtmlService); la planilla (Sheet externo: nómina del respaldo, como el Python). Eso lo cubre la batería en el navegador después del push.

## Push y batería (25-sep, 17:45 a 18:05)

- `clasp login` de Juanma: el primero dijo "ya estás logueado" con la autorización muerta (tercer modo de falla de clasp, ya documentado). Arreglo: `clasp logout` y `clasp login` de nuevo. Verificado con `tokeninfo`: restaurante@rosanta.rest.
- **El despliegue estaba en la @123, no en la @101** que decía el cerebro: otras sesiones versionaron 22 veces entre el 22 y el 25-sep. Antes del push se comparó la @123 (bajada aparte) contra git `dc781c6`: difieren solo `EdicionRecetario.js` (candado "una unidad no puede ser un número", 23-sep) y `Latido.js` (sexta señal, p164), donde **git es más nuevo que lo publicado**. Mi push no pisó nada; la próxima versión lleva también esos dos cambios ajenos, que ya estaban en git.
- `clasp push` desde mi sesión y verificación bajando HEAD aparte: **HEAD == disco, 62 archivos**.
- Batería en `/dev?page=pruebas`, primera corrida: 125 OK · 1 falla · 4 avisos · 3 saltadas (204 s). La falla, "El calentador no reconstruye si el cache ya esta caliente", reconstruyó el recetario con el caché frío del primer arranque; no toca ningún archivo mío. Segunda corrida: **Intranet sana · 126 OK · 0 fallas · 4 avisos · 3 saltadas (177 s)**. Los 4 avisos: dos números de PRUEBAS_CFG de barra bajaron (7 sin match, 0 sin costo), la caja arranca de un saldo distinto al de la última semana, y el mío: 13 metas en defecto. Las 5 pruebas nuevas en OK; EBITDA del año en vivo Q54,227 (4.0%).
- `/dev?page=tablero` carga con las seis pestañas y sus puntos de semáforo (01, 02, 03 y 04 en rojo, 05 en ámbar, 06 gris). La pestaña 01 se leyó en pantalla: K01 Q1,308,046 sin meta; K02 septiembre parcial deja −Q5,953 contra piso Q6,287. **Los clics de la automatización no llegan a esta página** (ni a los botones de pestaña ni a las tarjetas, que son enlaces), así que las otras cinco pestañas las revisa Juanma en su Chrome.

## Publicado: @124 (25-sep, 18:10, con "publica" de Juanma)

`clasp create-version` → 124 · `clasp update-deployment -V 124` sobre `AKfycby814w…` · `list-deployments` releído tres veces: @124 · la @124 bajada aparte es idéntica al disco (62 archivos) · el panel principal en producción muestra la puerta "Tablero global" (solo dueño). Queda sin commitear en git hasta que Juanma lo pida.

## Cómo se publicó (para la próxima vez)

1. `clasp login` con restaurante@rosanta.rest (solo Juanma; abre el navegador).
2. `clasp list-versions`: confirmar que la última es la @101 publicada.
3. `clasp push` (sube el disco entero: `git status` limpio salvo estos archivos) y verificar bajando aparte.
4. Batería en `/dev?page=pruebas`: esperado 120 OK + 5 nuevas OK + 1 AVISO nuevo, más las 2 fallas conocidas del 22-sep.
5. Abrir `/dev?page=tablero` y mirar las seis pestañas; Profit OS tarda en frío.
6. Agregar las filas a `PARAMETROS` (tabla en `KPI_Definiciones.md` §8) y ver el "defecto" desaparecer con "Actualizar".
7. `clasp create-version` + `clasp update-deployment` solo con el sí explícito.

## Pendientes que deja

- Filas de `PARAMETROS` (13 en defecto + `meta_venta_anio`, `compra_sin_factura_max_pct`, `cac_max_q` sin meta) y la pestaña `METAS` (`instalarMetas()`).
- K08 comisión de tarjeta: elegir fuente (liquidaciones de VISANET y BAC Credomatic, recomendada).
- K18 reseñas: `RESENAS_SHEET_ID` y pestaña `RESENAS_TA`.
- Conflicto de meta de food cost entre el reporte semanal (26 / ponderado) y `PARAMETROS` (28 / 20).
- Archivar los duplicados del pilar 1 cuando Juanma diga sí.
- `generar_finanzas.py` sigue con la planilla de respaldo en código (no lee el Sheet de planilla).
