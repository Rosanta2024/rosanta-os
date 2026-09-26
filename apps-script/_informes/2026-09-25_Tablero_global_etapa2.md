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
- `/dev?page=tablero` carga con las seis pestañas y sus puntos de semáforo (01, 02, 03 y 04 en rojo, 05 en ámbar, 06 gris). La pestaña 01 se leyó en pantalla: K01 Q1,308,046 sin meta; K02 septiembre parcial deja −Q5,953 contra piso Q6,287. **Los clics de la automatización no llegan a esta página** (ni a los botones de pestaña ni a las tarjetas, que son enlaces), así que las otras cinco pestañas las revisó Juanma en su Chrome después de publicar: "se ven bien las seis" (25-sep).

## Publicado: @124 (25-sep, 18:10, con "publica" de Juanma)

`clasp create-version` → 124 · `clasp update-deployment -V 124` sobre `AKfycby814w…` · `list-deployments` releído tres veces: @124 · la @124 bajada aparte es idéntica al disco (62 archivos) · el panel principal en producción muestra la puerta "Tablero global" (solo dueño). Queda sin commitear en git hasta que Juanma lo pida.

## Segunda tanda (25-sep, noche): el reporte semanal y la auditoría de Meta Ads

Pedido de Juanma después de ver el tablero: (1) el reporte semanal como pestaña adicional; (2) la auditoría de Meta Ads en los KPIs de Marketing. Ninguno se recalcula: son documentos que ya existen.

- `TableroDatos.js` › `getTableroDocumentos(auth)`: lista con Drive v3 (`drivesListar_`) los `Rosanta_SXX_2026.pdf` de las carpetas `SXX` de Reportes 2026 y los `Plan_Meta_Ads_*.docx` del Workspace de Marketing OS. Caché 10 min. Guarda de dueño.
- `TableroVista.html`: pestaña "Reporte semanal" (selector de semana + visor de Drive embebido + enlace) y tarjetas del plan de Meta Ads al pie de 05 Marketing (últimos tres, el último en verde). "Actualizar" no duplica las tarjetas.
- `PruebasFinanzas.js`: prueba "El tablero encuentra el reporte semanal y el plan de Meta Ads en Drive".
- Pendiente de decisión: para que la auditoría sea un KPI con semáforo (score y grado A–F), la tarea del día 3 tendría que escribir una fila en una pestaña `AUDITORIA_META` de `Rosanta Marketing OS`. Es un cambio al prompt de la tarea.
- Push a HEAD verificado (62 archivos idénticos). Batería: **Intranet sana · 127 OK · 0 fallas · 4 avisos · 3 saltadas (216 s)**; la prueba nueva de documentos en OK. Los 4 avisos, los mismos de la corrida anterior. La pestaña "Reporte semanal" y las tarjetas del plan las revisa Juanma en su Chrome (los clics de la automatización no llegan). Sin publicar hasta su "publica".

## Tercera tanda (25-sep, noche): el reporte semanal EN VIVO

Decisiones de Juanma: (1) el reporte se calcula con las reglas de la intranet, no con las del PDF; (2) el PDF lo genera el servidor y lo guarda en la carpeta `SXX` (pendiente, tanda siguiente). Hallazgo previo: `generar_reporte_semanal.py` no calcula nada, es una plantilla con los numeros de la semana escritos como constantes por la sesion del lunes.

- **`ReporteSemanalDatos.js` (nuevo):** `getReporteSemanal(auth, clave)` arma las 8 secciones del formato S38 desde `_finDatos_` (semana, cuatro semanas, compra por area, secciones del DRE, nomina devengada, prime, equilibrio del ultimo mes cerrado) y agrega lo que no existia por semana: serie diaria (02_Ventas_Maestro), reservas de la semana (pestaña `reservas` de Marketing OS: validas, personas, canceladas, sin cerrar en RESERVED, walk-ins por dia), platos mas vendidos por area (VENTAS x PLATO via `ventasDelRango_` + `esCocinaPOS_`) y acciones de la semana (pestaña nueva `REPORTE_ACCIONES` del config: SEMANA · ACCION · RESPONSABLE por departamento · PORQUE · FECHA · ESCRITO_POR; `guardarAccionReporte` con candado, `borrarAccionReporte` solo dueño; la pestaña se crea sola al guardar la primera).
- **`ReporteSemanalVista.html` (nueva):** `?page=reporte-semanal` (modulo finanzas; `&embed=1` dentro del tablero), selector de las ultimas 12 semanas, Actualizar, Imprimir/PDF (impresion del navegador mientras no exista el PDF del servidor), formulario de acciones.
- **Tablero:** la pestaña "Reporte semanal" embebe la pantalla y abajo deja los PDF de cada semana para descargar.
- **Pruebas:** la vista en las tres listas `VISTAS` y en el dibujo de vistas de Finanzas; prueba "El reporte semanal en vivo cuadra con la semana del motor" (suma de dias = venta de la semana, comensales, compra por area, gasto del P&L; AVISO si falta la pestaña de acciones).
- **Harness (espejo del 21-sep, reservas sinteticas):** S38: suma de dias Q19,309.36 contra Q19,309.38 de la semana; 82 comensales en los dos lados; reservas 3 validas / 1 cancelada / 1 sin cerrar; P&L gasto Q15,290, resultado Q4,020. Los platos salen vacios en el harness (VENTAS x PLATO no esta en los mocks).
- **Lo que el reporte en vivo NO trae todavia:** personal extra por semana pagada (la planilla es mensual; se muestra el reparto del mes), comision de tarjeta separada del bloque Comisiones y cargos, y el PDF del servidor.

## Publicado: @125 (25-sep, noche, con "publica" de Juanma)

`create-version` → 125 · `update-deployment -V 125` · releído tres veces · la @125 bajada aparte es idéntica al disco (64 archivos). Batería previa sobre este mismo HEAD (salvo el ajuste de la prueba nueva, que solo baja su costo): 126 OK · 0 fallas · 6 avisos · 3 saltadas.

## Correccion despues de la @125 (25-sep, noche): equilibrio semanal y estados de reservas

Al leer la @125 en produccion, dos numeros no servian:
- **Equilibrio semanal Q155,894.** Salia del equilibrio mensual del motor (Escenarios) del ultimo mes cerrado: agosto tiene margen de contribucion 8.3% (fijo Q55,919 con variable del banco Q57,607) y el cociente explota; con base de 4 meses daba Q89,543. Ese calculo es coherente mes a mes ("7 de 9 meses bajo el equilibrio"), pero no sirve como vara semanal. **Ahora el equilibrio semanal se arma con el PRESUPUESTO** que Juanma definio el 22-sep: fijos (Inmueble Q20,212.50 · Nomina Q29,000 · Tarifas Q6,600 · Prestadores Q5,500 · Marketing Q5,700, con el mes si lo trae) = Q67,012.50 al mes = Q15,423 por semana; variables = %venta del presupuesto (comisiones 6.5, propinas 4.24) mas la mercaderia con la movil de 4 (compra ÷ venta de las 4 semanas). Harness: margen 50.3%, **PE Q30,641 por semana** (el PDF de la S38 tenia Q35,097 con su propia estructura). El mensual del motor queda como referencia en la seccion 8. **Decision pendiente de Juanma: confirmar que esta es la vara semanal.**
- **Reservas de la S38: 13 canceladas de 14.** El PDF de esa semana decia 4 de 14. La pantalla ahora muestra el desglose de estados de la pestaña `reservas` para esa semana, para ver si la diferencia es de datos (estados cambiados en Wix despues del 23-sep) o del criterio (cuentan como canceladas CANCEL, DECLIN y NO SHOW; sin cerrar, RESERVED).

**Batería sobre este HEAD corregido (25-sep, noche):** 127 OK · 0 fallas · 5 avisos · 3 saltadas · 237 s. Los avisos son los ya conocidos (la caja arranca del saldo de los bancos; falta la pestaña REPORTE_ACCIONES, se crea al guardar la primera acción; 13 metas en defecto). Ninguna falla. Juanma confirmó el 26-sep: "sí, por presupuesto" y "publica".

## Publicado: @126 (26-sep, con "publica" de Juanma)

`clasp logout` + `clasp login` (la sesión había vencido otra vez con `invalid_rapt`) · HEAD de Apps Script idéntico al disco (64 archivos) · `create-version` → 126 · `update-deployment -V 126` · releído tres veces · la @126 bajada aparte es idéntica al disco. Commit `c0a0cb7` en `main` con los siete archivos del reporte semanal.

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
