---
name: rosanta-cerebro
description: 'Cerebro maestro unificado de Rosanta (CORSAGA, S.A., restaurante "Cocina con Carisma" en Antigua Guatemala) y de todos los proyectos de Juanma. Cargar SIEMPRE al inicio de cualquier conversación sobre Rosanta o sus proyectos — Rosanta OS de 6 pilares (Marketing OS, Profit OS, Finanzas & Data OS, Back office, Web, Reservas), bot de WhatsApp/IG, intranet/ERP, recetario/costeo, maestro financiero, DRE, dashboards, marketing, ads, CRM, sitio web rosanta.rest — aunque el usuario no mencione "Rosanta" explícitamente. Disparadores: Rosanta, bot, intranet, ERP, recetario, costeo, leads, Apps Script, clasp, maestro, DRE, prime cost, food cost, Marketing OS, Profit OS, "¿en qué íbamos?", "retomemos", "continúa con", o cualquier tarea que dependa del contexto de proyectos anteriores. Si hay duda entre cargarla o no, cargarla.'
---

# Cerebro Rosanta

Este es el contexto maestro de Juanma y sus proyectos. Su propósito: que ninguna conversación arranque de cero, sin importar el proyecto o chat.

**Última actualización: 16 sep 2026 (v18).** Todo lo que Juanma diga en la conversación actual, o lo que exista en la memoria automática de la sesión, es MÁS RECIENTE que este archivo y manda sobre él. Este cerebro es la foto de partida, no la verdad eterna. El estado semana a semana vive en el artefacto `rosanta-seguimiento-semanal`, no aquí.

---

## Cierre del 16 sep 2026 (v18): mantenimiento mensual, deriva corregida

Pasada mensual de `rosanta-cerebro-mantenimiento`. **No hubo jornada de trabajo nueva**: el contenido sustantivo del mes ya entró por las sesiones (v9 → v17, del 6 al 15 de septiembre). Lo que esta versión arregla es la **deriva entre lo que el cerebro dice y lo que existe de verdad**, verificado contra `list_scheduled_tasks` y `list_artifacts`, no contra la memoria.

### 1. Tareas programadas: la tabla de `ecosistema.md` estaba vencida

| Lo que decía el cerebro | Lo que hay de verdad (16-sep) |
|---|---|
| `rosanta-reporte-semanal` lunes 10:06 | **Lunes 16:06** (`0 16 * * 1`) |
| `rosanta-seguimiento-offsite` lunes 8:05, activa | **Apagada** (`enabled: false`) desde antes del 14-sep |
| `rosanta-dashboard-refresh` lunes 11:04 | **Ya no existe.** Coherente con que la intranet sea la única superficie del pilar 3 |
| — | **`rosanta-reporte-mensual`, día 3 a las 9:00**, existía y no estaba escrita: verifica que el mes anterior esté completo en el maestro y avisa qué falta. No calcula ni toca artefactos |

Sin cambio: `morning-brief-juanma` (L–V 6:02), `rosanta-analista-pauta-lunes` (lunes 8:08), `rosanta-cierre-semanal` (domingos 18:03), `auditoria-meta-ads-rosanta-mensual` (día 25, 8:00), `rosanta-cerebro-mantenimiento` (día 1, 9:00).

### 2. Artefactos de Finanzas: ya no existen como artefacto

`rosanta-dre-mensual`, `rosanta-finanzas-semanal` y `rosanta-dashboard-semanal` **no están en el manifiesto**. Es la consecuencia de la decisión del 12-sep (v12 §1): **la intranet es la única superficie del pilar 3**. Quedan escritos como retirados para que nadie los busque ni los reconstruya. Tampoco está `patagonia-feb-2027` (sí `mapa-trekkings-chalten`). El último artefacto creado es del 2-sep (`rosanta-honorarios-reclasificacion`): **en dos semanas no se creó ninguno**, señal de que el trabajo migró a la intranet, no de que se haya parado.

### 3. Números obsoletos marcados donde vivían

El `−Q88,205 / −7.2%` de `references/negocio.md` estaba señalado como obsoleto en el SKILL.md desde la v16, pero **seguía escrito sin marcar en la referencia**, que es donde alguien lo iba a leer. Ya está tachado con el número vigente al lado (**Q1,288,737 de venta · COGS 34.7% · prime cost 55.0% · −Q44,650 / −3.5%**, espejo del 15-sep). Mismo tratamiento para el forecast de caja, que era el "primer entregable" del pilar y **está hecho** desde la @93 (pestaña Caja).

### 4. Regla que deja esta pasada

**El cerebro se verifica contra las herramientas, no contra sí mismo.** Tareas programadas y artefactos se leen con `list_scheduled_tasks` y `list_artifacts` antes de darlos por ciertos: las dos tablas se habían quedado en el 6-sep mientras el resto del cerebro iba por el 15-sep. Cuando una sesión retire una tarea o un artefacto, borrarlo de `ecosistema.md` en el mismo movimiento.

---

## Cierre del 15 sep 2026, tarde (v17): pestaña Caja y camino al piso

**El equipo está en la @98** · batería 119 OK · 0 fallas · 0 avisos · 3 saltadas. (verificado con `clasp list-deployments`; HEAD de 58 archivos idéntico a lo probado). La @93 trajo la pestaña Caja, la @94 el food cost sin servicio, la @95 la tarjeta real contra teórico de Profit OS (+12.3 pts jun–ago), la @96 la tanda 4, la @97 la tanda 5 y la @98 la categoría MARKETING_HONORARIOS.

### Marketing: honorarios aparte de la pauta (@98)

- **`MARKETING_HONORARIOS`**: mismo bloque Marketing del DRE que la pauta, así que el resultado no cambia; existe para que el CAC excluya honorarios **por categoría** y no por el texto del banco.
- **Vanessa Wilches** (marketing digital): 4 transferencias "BANCA ELECTRONICA" de abr–jul (~US$207/mes) y PayPal de agosto (US$190) = Q8,032. **No eran pauta.**
- **Edwin Flores** (agencia, Q2,000/mes): siempre estuvo en `SERVICIOS_PROFESIONALES` y la regla 9 descuenta sus pagos de banco. No tocarlo.
- **Meta y Google se cobran a la tarjeta del BAC**, en la **columna de dólares**: la pauta 2026 es **Q16,521**, no Q10,800. Quien sume solo quetzales pierde el Google Ads. **Las 3 saltadas de la batería están identificadas** (p162, cerrado): RECETARIO_FOTOS_FOLDER_ID sin configurar (Profit OS), "Meta (red)" que se salta a propósito (`PRUEBAS_CFG.incluirRed = true` para incluirla) y el cierre de inventario de barra sin mes abierto. Ninguna es de Finanzas.

### Tanda 4 (M9, M15, M26)

- **RAA:** `guardarRaa` escribe con `LockService`; sin candado dos guardados a la vez perdían uno.
- **El año se calcula (M15):** comparativo y metas van contra el **año anterior**, no contra 2025 fijo. `_finVentasAnio_(anio)` lee 2025 de `02b_Ventas_2025` y **2026 en adelante de `02_Ventas_Maestro`**, que sigue acumulando años (decisión de Juanma: en 2027 no se mueve nada). `_finAnio2025_` y `FIN_NOTAS_2025` se quedan porque la Caja los usa.
- **La batería dibuja las vistas de Finanzas (tanda 5, p142):** las 5 vistas en sus dos modos y el shell en sus 5 pestañas, con control negativo adentro (si dibujar una vista inexistente no falla, lo dice). Antes solo las leía crudas y un scriptlet mal cerrado pasaba en verde. Guardiana de A11: la meta de Metas tiene que ser la de PARAMETROS.
- **Cachés (M26):** `calentarCaches` calienta Finanzas y la tarjeta real contra teórico. **La respuesta de Finanzas pesa 24 KB de los 100 KB del límite: el riesgo que marcaba la auditoría no existía.**

Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-15_Finanzas_tanda2_Caja.md`.

### 1. Qué es la pestaña Caja (p94 hecho, p89 hecho)

- Intranet › Finanzas › Caja (`CajaDatos.js`, `CajaVista.html`). Calendario día por día desde el último saldo hasta hoy + 90 días, escenarios pesimista/base/optimista, fecha en que cruza cero y el colchón de **7 días de gasto** (exigido desde el día 30), y cuánta venta o costo hace falta.
- **Compromisos** en la pestaña `COMPROMISOS` de `Rosanta_Intranet_Config` (ya instalada): retiro Q5,000/mes en retiros semanales, alquiler de la casa US$1,800 cuando alcance, Raúl Q100,000 el 15-mar-2027. Aguinaldo 50% el 10-dic y 50% el 20-ene. No hay línea de crédito ni deuda fuera del banco.
- **Estacionalidad por defecto: la de 2025** (Juanma, 15-sep), con selector.
- **Es un calendario de riesgo, no una predicción de venta.** La prueba contra el pasado mostró que el costo se proyecta bien (±10%) y que el error viene de la venta.
- Proyección del 15-sep: el base **cruza cero el 26-oct**; +6.7% de venta o Q6,464/mes menos de costo lo evitan. Saldo de partida Q24,011, ya bajo el colchón.

### 2. Camino al piso decidido (p122, sigue activo)

Piso Q18,860/mes, objetivo Q27,193/mes.
1. **Septiembre y octubre: no cruzar cero**, no el piso. +6.7% de venta ≈ Q2,500 más por semana.
2. **Fecha del piso: noviembre 2026.** Con la estacionalidad de 2025 noviembre deja ~Q51,000.
3. **Mezcla: casi toda venta** (el problema es tamaño). El costo es respaldo, **solo operativo, nunca personal**.
4. **Punto de control a mediados de noviembre:** si la venta semanal no sube cerca de 40%, se activa la palanca de costo operativo.

### 2b. p96 medido (tanda 3, mismo día)

**Los "9 puntos" de p96 eran real contra META, no contra teórico.** Enero–agosto, sobre venta sin IVA ni servicio: meta 28.0% · **teórico 31.8%** · **real 37.1%**.
- **3.8 puntos** vienen de las fichas y los precios de carta.
- **5.3 puntos (Q60,926)** son la brecha real.

Detalles:
- **Agosto** es el 40% de la brecha: Q21,800 en 18 retiros de cajero sin detalle (del 11 al 29-ago, máximo Q2,000 por retiro), marcados como ALIMENTOS_EFECTIVO.
- **Base de la venta (regla 14, publicada en la @94):** la venta de Finanzas incluye el 10% de servicio y la ficha no. Desde la @94 el food cost de Finanzas, su móvil 4, la tarjeta de food del RAA y el techo de compra van sobre venta sin servicio: la base de cada ticket es Costo + Ganancia ÷ 1.12. **Prime cost, neto y DRE siguen sobre la venta total** (Juanma). Food cost del año: 34.7% → 38.3%. Batería de la @94: 111 OK · 0 fallas · 3 saltadas.
- **Tarjeta "CMV real contra teórico" del tablero de Profit OS (parte B):** `getCmvRealTeorico(auth)` en `PuenteCmv.js`, pedida aparte desde `aplicarProfitOS`. Muestra la brecha de los últimos 3 meses cerrados (≤2 merma normal, 2–4 revisar porcionado, >4 fuga; bajo −2 es dato incompleto). **Decisión de Juanma: quien no es dueño ve solo porcentajes, sin quetzales.**
- **Retiros de cajero (decisión de Juanma, 15-sep):** son compras de mercado y se quedan en `ALIMENTOS_EFECTIVO`. Lo que falta no es la clasificación sino el detalle de qué se compró (p88).
- **Eventos:** van en los dos lados, su venta y su compra.
- **No hay comida de personal.**
- **Herramientas:**
  - `revisarPuenteCmv()` en `PuenteCmv.js` da el teórico por mes;
  - el puente está en `scripts/maestro-finanzas/p96_2026-09-15/`.
- **Informe:** `_informes/2026-09-15_Finanzas_tanda3_p96_puente_CMV.md`.

### 3. Hechos de datos que no hay que re-investigar

- **La columna Saldo del BI no sirve como serie** (vacía en mayo y casi todo junio, orden intradía distinto al banco). La caja reconstruye el saldo con movimientos, anclado en el último saldo del estado de cuenta.
- **Traspasos BAC → BI:** "TF: ACH INMEDIATO/PERSONAS 900" del BAC llega el mismo día como "ACH CORSAGA" al BI (Q30,800 abr-ago). No es gasto.
- **Transferencias a la cuenta 974954208 = retiro de Juanma → PERSONAL.** Corregidas 17 filas (Q15,240). Las del 18-ago a Fernanda y Jeffry (Q1,650) son planilla → NOMINA: algunos de cocina no tienen cuenta y Jeffry les entrega el efectivo.

---

## Cierre del 15 sep 2026 (v16): Finanzas & Data OS, tanda 1

**El equipo quedó en la @92** (verificado: la @92 bajada aparte, idéntica a lo que se probó). Batería sobre esa versión: **103 OK · 0 fallas · 0 avisos · 3 saltadas**. Con la @88 las saltadas eran 2; la nueva no está identificada.

Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-15_Finanzas_tanda1.md`.

### 1. Números del año con el cálculo nuevo (espejo del 15-sep, 13:21)

Ventas Q1,288,737 · COGS 34.7% · prime cost 55.0% · **resultado −Q44,650 (−3.5%)** · fugas Q0.
- Intranet y `generar_finanzas.py` dan lo mismo al centavo.
- **OBSOLETO:** el −Q88,205 / −7.2% de `references/negocio.md`. Eran 8 meses con las reglas viejas.

### 2. Reglas nuevas del cálculo (motor y Python, las dos)

| Regla | Qué hace |
|---|---|
| 10 | Una fecha con hora se lleva a su día: de 12:00 en adelante, el día siguiente |
| 11 | Un mes sin planilla usa la última cargada. **El mes en curso lleva solo la parte de los días con venta cargada** (Juanma, 15-sep). Se acabó el 29000 fijo de la semana |
| 12 | UNIFORMES es su propio bloque |
| 13 | **Una factura con Estado "Anulado" no suma.** Se sumaban 15 anuladas, Q7,535 |

Además:
- Semanas con año (AAAAWW) y consecutivas. Las cortas y las sin venta entran a la móvil de 4, por decisión de Juanma.
- `LICORES` pasa a barra.
- Los números escritos como texto se leen.
- Un mes con gasto y sin venta suma al año.

### 3. El maestro, corregido por Juanma con scripts de simulación

- **157 fechas** (38 FEL + 119 ventas) movidas a su día verdadero.
- **p121:** 6 pagos de mercado, Q6,605, a ALIMENTOS_EFECTIVO.
- **Abogada:** la factura de Q2,000 pasa a SERVICIOS PROFESIONALES y el proveedor entra a `00_Proveedores`.
- **Retiro de mercado:** Q500 "F-TORRE CUIDAD VIEJA" del 28-06 a ALIMENTOS_EFECTIVO.

### 4. Hechos verificados que no hay que re-investigar

- **Zona horaria:** el Sheet maestro está en (GMT-06:00) Guatemala, locale es_MX.
- **Filas a 22/23 h:** eran del **día siguiente**. Verificado contra el reporte del POS (julio y S37) y el FEL de S37. Queda **OBSOLETA** la hipótesis de p120 de que el Sheet mostraba la fecha real. Nacieron por escribir la medianoche de Guatemala en un Sheet que estaba en otra zona; `cargador.js` ahora frena si las zonas difieren.
- **Proveedores que sí facturan:**
  - COMESA: 7 facturas por Q3,628, igual a lo pagado.
  - Vinos de Altura: factura como **VIÑEDOS DE ALTURA / ENTREVINOS** (NIT 74382489).
  - La Torre Q67.24: tiene su factura.
- **Elder:** Q2,285 y Q2,385 son pagos fraccionados de una factura de 2025; la regla 3 los deja fuera.
- **Anuladas sin reemplazo:** GRUPO ECO Q1,467.14 (1-abr) y Los Alpes Q1,500 (25-ene). Son errores del proveedor y quedan fuera.

### 5. Decisiones de Juanma del día

- **Pago a Raúl:** Q100,000 el **15 de marzo de 2027**.
- **Máquina de agua de GRUPO ECO:** la mensualidad bajó de Q1,467.14 a **Q1,250**, negociado.

### 6. Reglas técnicas nuevas

1. **En el maestro, una fecha se escribe como TEXTO `AAAA-MM-DD`.** `setValue(new Date(...))` no cambió 37 celdas del FEL y no dio error; como texto entraron a la primera.
2. **Un script de datos relee lo que escribió** (`flush` y lectura en la misma corrida). El primer "157 escritas" era mentira para 37 filas, y solo lo destapó volver a correr la revisión.
3. **El total de la batería sube al agregar pruebas.** Si suben las saltadas, pedir las líneas antes de publicar.

### 7. Pendiente del pilar

- **Tanda 2** (p94 pestaña Caja + p122). Faltan respuestas de Juanma:
  - línea de crédito;
  - aguinaldo;
  - deuda fuera del banco;
  - mezcla entre vender más y bajar costo;
  - fecha para llegar al piso.
- **Tandas 3-5:** p96, robustez y batería.
- Identificar las 3 saltadas.
- Actualizar en el tablero p15, p120 y p121.

---

## Cierre del 14 sep 2026 (v15): la intranet de Profit OS

**Estado al cierre: el equipo está en la @88** (verificado con `clasp list-deployments`). Batería
sobre esa versión: **89 OK · 0 fallas · 2 avisos · 2 saltadas (93 pruebas)**. Los dos avisos no
son errores: el calentador de cachés tardó 6,7 s (Drive lento; avisa arriba de 5 s) y el cierre
de inventario propone bajar el **Tomate Ciruelo de Q7 a Q5 (−28,6%)** en el Banco.

Tres versiones en el día, para no confundirlas:

| | Qué trajo | Batería |
|---|---|---|
| v86 | recetario sin recarga | 89 OK · 0 fallas · 1 aviso (92) |
| v87 | la "regla 9" de Finanzas, creada por OTRA sesión y nunca desplegada sola | — |
| **v88** | meta 28% sin IVA desde PARAMETROS (**idéntica a la 87 + lo mío**, ver §4) | **89 OK · 0 fallas · 2 avisos (93)** |

### 1. Auditoría completa de la intranet

- Informe con archivo y línea: `~/Dev/Rosanta/apps-script/_informes/2026-09-14_Auditoria_intranet_Profit_OS.md`.
  Página: https://claude.ai/artifact/DGJDtLYyHGaiaNiG2DeNGB
- **7 críticos, 24 altos, 30 medios.** Causa raíz principal: el despliegue es `access: ANYONE` +
  `executeAs: USER_DEPLOYING`, así que **toda función global sin guion bajo final se puede llamar
  con `google.script.run` desde cualquier página del despliegue, incluida "Esta puerta está
  cerrada"**, ejecutándose como Juanma. Había 52 públicas sin guarda. **La batería no lo ve:**
  solo audita las funciones que las vistas nombran.
- **Cerrados hoy:** C5 (registrar precio sin área: el ajo de barra pisaba el de cocina y sala
  escribía en cocina), A11 (Metas usaba su copia congelada de la meta), A12 (tres food cost
  distintos), M25 (cada export del POS borraba el caché del recetario), Higiene en 40 s.
- **Siguen abiertos, en este orden:** C1 las nueve escrituras de `EdicionRecetario.js`/`CrearFicha.js`
  aceptan el ROL que manda el cliente · C2 `fijarUrlIntranet` pública (secuestro de enlaces y
  tokens) · C3 `aplicarSincronizacion`/`sincronizarPreciosDeCierre` públicas y `APLICAR_SYNC.js`
  sin bandera · C4 Marketing OS: `store()` → `mktReplace` pisa piezas, carritos, propuestas y
  debates con el localStorage del dispositivo · C6 `LICORES` suma al COGS pero no al techo de
  barra · C7 fugas de lectura por funciones públicas. Arreglo general: sufijo `_` a lo que ninguna
  vista llama, guarda de dueño a lo de editor, y una prueba que enumere `globalThis`.

### 2. El recetario ya no recarga la página (v86)

- **Síntoma de cocina:** cada ingrediente agregado dejaba la pantalla en blanco ~45 s. **Causa:**
  toda escritura terminaba en `invalidarCache_()` (borraba el modelo cacheado) y la pantalla
  hacía `location.reload()`: la recarga reconstruía leyendo las dos hojas enteras (~40 s). Una
  receta de 8 ingredientes con 2 productos nuevos eran más de 8 minutos en blanco. Registrar
  un precio, ~80 s.
- **Ahora:** la escritura ANOTA qué tocó (ficha, producto, precio), relee solo eso, corrige el
  modelo cacheado y lo devuelve en `cambios` (`conCambiosDeModelo_`, `aplicarToques_`,
  `parchearCacheCosteo_` en `CosteoDatos.js`). La pantalla corrige su copia (`aplicarCambios`),
  guarda en una fila de a uno con una píldora "Guardando en la hoja…", abre la ficha nueva en el
  acto y ofrece crear un producto que no está en el Banco sin salir de la receta. Enter carga rápido.
- **Bugs corregidos de paso:** crear un producto o proveedor parecido a otro no hacía nada ni
  preguntaba (la pregunta viaja dentro de `resultado` y la pantalla miraba el `ok` de afuera);
  registrar precio escribía "Sin proveedor" encima del proveedor del Banco.
- **Reglas para no romperlo:**
  1. Una escritura nueva del recetario llama `invalidarCache_({ficha|insumo|precio, area})`.
     A secas cuenta como "no se sabe qué cambió" y borra el caché.
  2. `enlazarModelo_` (servidor) y `enlazarModelo` (`CosteoJs_Base.html`) son copias.
  3. **La fila de guardado es obligatoria:** dos `agregarLinea` simultáneos eligen la misma fila
     libre y se pisan; una inserción corre los números de fila. Por eso la pantalla no deja editar
     cantidades de una ficha con algo en fila y el servidor verifica `exigirMismaLinea_`.
  4. Marca de generación del caché: una reconstrucción de 40 s que se cruza con un guardado no
     guarda el modelo viejo.
- Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-14_Recetario_sin_recarga.md`.

### 3. Meta de food cost: 28%, sobre precio sin IVA, de un solo lugar (v88)

**Decisión de Juanma (14-sep-2026):** CMV sobre precio **neto**; meta **28%** global y de cocina;
barra **20% plana**. **OBSOLETO:** el "30% fijo" del 10-sep, el techo "cocina 30", la tabla
`metasBarra` por categoría (20 a 35%) y `FIN_META_AREA` (ya no existe).

- **Una sola fuente:** `Rosanta_Intranet_Config` › `PARAMETROS` › `food_cost_objetivo_pct` = **28**
  (Juanma ya la cambió) y `food_cost_barra_pct` (la fila no existe: vale 20). Las lee
  `metasFoodCost_()` en `ConfigCosteo.js`, y de ahí salen el semáforo y el techo de compra de
  Finanzas, las fichas, la ingeniería de menú, el tablero y las fichas nuevas.
  `generar_finanzas.py` usa `meta_cogs = 28.0`.
- **El CMV de la ficha subió ~12%** (26,5% → 29,7% el mismo plato): ahora es igual al tablero.
  Precio sugerido = precio de carta con IVA que deja el CMV sin IVA en la meta.
- **Las fórmulas de las hojas NO cambiaron:** la celda "CMV % ACTUAL" de cada pestaña sigue sobre
  precio con IVA y no coincide con la intranet. "Sobre meta" sigue marcando desde meta + 5 puntos.
- Números de control de la batería pasados a sin IVA (×1,12): ensalada 16,8 · tabla de jamones
  25,3 · gratín 22,2 · mix de fritas 26,4 · peras 22,1.
- **Una meta dentro de un cálculo cacheado es una meta vieja.** Para que cambiar la celda se vea
  en el acto hubo que meter la meta en la clave de tres cachés (tablero `claveProfitOS_`,
  Finanzas `finCacheClave_`, RAA) y renombrar el de parámetros a `fin_par_v2_` con 10 min en vez
  de 6 h: la versión anterior había dejado el 30 guardado 6 horas bajo el mismo nombre, y la
  batería leyó 30 con la celda en 28.

### 4. La v88 salió con código de otra sesión que la batería no había probado

Otra sesión subió la **regla 9 de Finanzas** —siete proveedores que siempre facturan por FEL
(EEGSA, Claro, Doorways, Posfile, EX Security, Edwin Flores, Aseguradora La Ceiba): su pago de
banco o tarjeta no suma; quita **Q49,629 de doble conteo del 2026**— y creó la v87 a las ~21:50,
**después** de la batería de Juanma. La v88 quedó idéntica a la 87. Se verificó HEAD == disco ==
git y dio verde porque git ya tenía ese commit. Juanma corrió la batería sobre lo publicado:
0 fallas, la prueba nueva de la regla 9 en OK. **Queda publicada y probada.**

### 5. Reglas nuevas, cada una de algo que pasó hoy

1. **Antes de `create-version`, `clasp list-versions`:** si la última no es la publicada, otra
   sesión versionó algo. Y comparar HEAD contra la bajada del momento de la batería, no solo
   contra el disco.
2. **Una verificación que baja 0 archivos da el mismo verde que una que bajó todo.** clasp falló
   con `ENOTFOUND` (sin red), la bajada quedó vacía y el comparador dijo "HEAD == disco". Exigir el
   conteo: 66 archivos.
3. **Si el total de la batería sube y los OK no,** alguna prueba pasó de OK a aviso: pedir las
   líneas, no suponer.
4. **Probar escrituras sin batería:** se armó un simulador de hojas en Node que evalúa las
   fórmulas de las fichas y corre el código real del servidor y de la pantalla (53
   comprobaciones). Quedó en el scratchpad de la sesión, no en el repo.

### 6. Pendientes que deja

- Tomate Ciruelo Q7 → Q5: confirmar con Jeffry y, si es real, Productos › Registrar precio.
- Los 6 críticos abiertos de la auditoría (§1).
- Las hojas de las fichas siguen mostrando CMV con IVA; la banda +5 de "Sobre meta"; cada llamada
  al servidor lee la hoja USUARIOS entera (~0,5 s).

---

## Cena Romántica y cuenta de cobro (12 sep 2026 · noche, v14)

- **Cena Romántica para Dos: Q900, valorada en Q1,120.** La de **Q800 / valorada en Q1,000 queda OBSOLETA**. Contenido: Pulpo a la parrilla, dos Lomitos a la Parrilla (lomito de la casa), postre para compartir, botella de Cabernet Sauvignon y decoración. Reserva con 24 h. **Anticipo 50% = Q450** por transferencia; el resto, el día de la cena. Detalle y la advertencia del cálculo (a carta suma Q1,075) en `references/negocio.md` › Menú.
- **Cuenta BAC Monetaria de cobro a clientes: `904802543`** (9 dígitos, confirmada contra los estados de cuenta del BAC). El Doc del bot tenía `9048025432`, que **estaba mal** y la usaban las gift cards.
- **El bot lee su conocimiento del Google Doc `1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I` en vivo, con caché de 10 min** (`Code.js` › `getKnowledgeBase`). Cambiar un precio para el bot = editar ese Doc; no hace falta publicar código. El `.md` de `00_Admin/Apps_Script_e_IA/` es solo una copia de referencia y el bot **no** lo lee. El conector de Drive de Claude **no puede editar el cuerpo de un Doc** (solo título y carpeta): se edita desde el navegador.
- **Web actualizada a Q900 por Juanma (12 sep 2026)**, a mano en Wix. **Ojo:** `sitio-wix/cargar-tanda3.js` todavía trae el texto de Q800; si se vuelve a correr ese cargador, pisa el precio nuevo.
- **Carta del bot = carta 2027 (12 sep 2026).** Fuente: `04_Profit_OS/Ingenieria_de_Menu/MENU_Legado/MENUS_VF/Cartas - Menu 2027/Menu ES 2027 VF.pdf` (19-ago, la más reciente; trae **dos lomitos: Lomito Rosanta Q190 y Lomito de la Casa Q180**) y `Menu Vinos 2027.pdf` (copa Q70, botellas Q350–Q535). Decisiones de Juanma: **en el bot solo llevan precio los platos y los vinos**; cócteles, licores, cervezas y bebidas sin alcohol se mencionan como "amplia carta de licores por copa y por botella", **sin precios**. **Postres: sin lista**, "según los productos de temporada".
- **Precio mínimo de cualquier copa: Q70, confirmado por Juanma (12 sep 2026).** Vale igual para licores y vinos. Queda obsoleto lo que dice el POS del 24-ago (Botran Q50, Colonial Q60, etc.). Los precios por copa de cada licor salen del checklist del 30-ago (`2026-08-30_Actualizacion_POS_Checklist.html`), que ya no hay que tratar como propuesta. En el bot los licores siguen **sin precio**, por decisión de Juanma.

---

## Regla dura: un proveedor se identifica por NIT (14 sep 2026)

**Nunca filtrar facturas por un pedazo del nombre del emisor. El identificador es el
NIT**, que es el identificador tributario y es único. Regla dada por Juanma.

Se paga con un ejemplo real. El 12-sep se movieron **23 facturas por Q11,845.10** de
`COCTELERIA` a `ALIMENTOS` con un filtro `"LICO" in Nombre_Emisor`, creyendo que eran de
Migdalia Lico. Hay **tres** proveedores cuyo nombre contiene "LICO":

| Emisor | NIT | Establecimiento |
|---|---|---|
| MIGDALIA AZUCENA, LICO LÓPEZ | 110989163 | Distribuidora de Alimentos Los Alpes |
| CRISTINA, ANONA LICO | 52496325 | Doña Mina y Don Rolando (verduras) |
| DISTRIBUIDORA DE **LICO**RES, S.A. | 345377 | **LA NACIONAL** |

Las 23 eran del tercero: **un distribuidor de licor**. Entró compra de licor al food
cost, que es el número que se mide contra la meta de 28% (30% hasta el 14-sep). Los NIT no se parecen en nada:
con el NIT el error era imposible.

**Y ojo con los tres primeros:** Juanma dejó de comprarle a Migdalia y hoy le compra a
**Anona** (Doña Mina y Don Rolando). Son proveedores distintos de verdura, no el mismo
con otro nombre.

Dos corolarios que también costaron:

- **Un número que se mueve mucho después de un cambio propio no es un hallazgo.**
  "La coctelería estaba inflada en más de un tercio" no era un descubrimiento: era el
  efecto de haberla vaciado. Antes de reportar un salto, descartar que lo haya causado
  uno mismo.
- **No bundlear un juicio nuevo dentro de una corrección.** Al revertir un error se
  restaura el estado anterior exacto; si además hay dudas sobre si ese estado era el
  correcto, eso es una decisión aparte y se toma aparte.

## Cierre del 12 sep 2026 · tarde (v13)

Sesión de limpieza de pendientes. **De 35 activos a 23.** Lo que sigue no es el listado —
ese vive en el tablero— sino lo que cambió de entender.

### Lo que se cerró tocando producción

- **La encuesta de satisfacción dejó de escribir en la hoja de un tercero.** Caía en
  `Recolección de data - Rosanta`, propiedad de `Eli_Juli@lacocinaquesuena.com`, con quien
  Rosanta ya no trabaja. Se copió a
  `05_Marketing_OS/Resenas_y_Reputacion/Rosanta_Encuesta_Satisfaccion`
  (`1zZuqsBgjC3hYRJfdXe6zz8SxYCNbMBtBDvc3qy1nPf0`) y se publicó en la **v5**.
- **Las tres URLs de `Config.gs` de la intranet** perdieron el prefijo `/a/macros/rosanta.rest/`,
  y hay una prueba nueva que falla si vuelven a torcerse. **Publicado en la v82.** El mismo push
  sacó del proyecto vivo los 6 diagnósticos archivados: quedan 7 scripts sueltos, no 13.
  *Al verificar un redeploy, releer `clasp list-deployments` hasta que confirme: el primero
  después del redeploy todavía decía @81.*
- **La documentación del cargador** ya vive en `00_Instrucciones` del maestro, filas 77-97,
  y esa hoja ahora dice **16 hojas**, no 14.
- **6 diagnósticos de un solo uso** salieron de `rosanta-intranet` a `_archivo/`.

### Reglas nuevas, cada una pagada con un error de hoy

1. **`prop_('X') || defecto` significa que el defecto es el ÚLTIMO recurso, no el valor.**
   El primer arreglo de la encuesta respetaba la propiedad `SHEET_ID` ignorando solo el id
   ajeno exacto. Se publicó, se envió una respuesta real y la fila cayó **igual** en la hoja
   del tercero: la propiedad tiene ese id en una variante que `===` no atrapa, y no se puede
   leer desde fuera del editor. Cuando una propiedad de script puede pisar un valor crítico y
   no se puede leer, **dejar de consultarla**.
2. **Leer el código no prueba dónde cae el dato.** Lo único que lo probó fue mandar una
   respuesta de verdad por el formulario y mirar el `modifiedTime` de las **dos** hojas.
3. **Documentación que vive en el repo no existe para quien usa la herramienta.** Mismo
   patrón dos veces hoy: el texto del cargador en `_informes/`, y un puntero `.gsheet` en
   `CRM_y_Retencion` que seguía abriendo la hoja ajena aunque el código ya estaba corregido.
   **Al corregir un destino, barrer también los punteros de Drive.**
4. **Una guarda que vigila una instancia de un problema que tiene tres da la misma sensación
   de cubierto que una que las vigila todas.** La prueba del `/a/` existía desde el 10-sep y
   estaba bien escrita: miraba `INTRANET_URL` y no las otras dos URLs del mismo archivo.
5. **El texto de un pendiente es una afirmación vieja, no una fuente.** Hoy fallaron cuatro:
   `p143` llamaba "scripts de un solo uso" a 7 herramientas que el código vivo manda a correr;
   `p80` decía que seguía expuesta una key que estaba en Propiedades desde el 31-ago; `p71`
   proponía como palanca gratis algo que ya tenía su propio canal; `p110` apuntaba a una hoja
   donde el dato no está.
6. **Preguntar "quién es este proveedor" y cotejar contra la hoja vale más que cualquiera de
   las dos cosas por separado.** De siete identificaciones que dio Juanma, cuatro cuadraban y
   **tres no**, y ninguna de esas tres estaba marcada como pendiente.
7. **Un `for` de zsh sobre una variable sin comillas no separa la lista.** Un chequeo de
   seguridad devolvió "limpio" sin haber leído un solo archivo. Un verificador que no encuentra
   nada porque no leyó nada da el mismo verde que uno que leyó todo.

### Antes de preguntar quién es un proveedor, leer `Establecimiento`

**`01_FEL_Maestro` tiene una columna `Establecimiento` y está poblada en las 1,018 facturas,
sin una sola vacía.** `Nombre_Emisor` trae el nombre legal o de la persona; `Establecimiento`
trae el nombre comercial. Hay **107 proveedores** donde los dos no coinciden.

Los dos "destinatarios sin identificar" de `p102` estaban ahí todo el tiempo:
`GRUPO AGMN, S.A.` → **Clínica de Fisioterapia Roca**, y
`Edi Joaquín Gaitán García` → **Alquifiestas MEG**. El pendiente mandaba al Histórico
transaccional del banco para algo que estaba en la columna de al lado. Y Migdalia Lico figura
como **Distribuidora de Alimentos Los Alpes**: el nombre comercial decía "alimentos" mientras
23 de sus facturas vivían en `COCTELERIA`.

### Finanzas: lo que apareció y todavía no se escribió

**Hay un lote de 39 reclasificaciones subido a `rosanta-maestro` y SIN CORRER.** Está en
`reclasificar_sin_clasificar.js`. Empezó siendo 3 filas y creció a 39 al cotejar proveedores:

| Qué | Filas | Monto |
|---|---|---|
| Migdalia Lico, `COCTELERIA` → `ALIMENTOS` | 23 | Q11,845.10 |
| GRUPO ECO, `BEBIDAS` → `ALQUILER_EQUIPO` | 2 | Q2,717.14 |
| Jonas Dobias (BAC), → `PERSONAL` | 2 | Q2,000.00 |
| Alquifiestas MEG, `MANTENIMIENTO…` → `EVENTOS` | 6 | Q2,241.00 |
| Las 3 originales de `p119` | 3 | Q7,611.25 |

Para correrlo: `revisarSinClasificar()` **y leer el log**; solo si dice "Sin avisos",
`reclasificarSinClasificar()` y después **`generarEspejo()`**.

- **GRUPO AGMN, S.A. = Clínica de Fisioterapia Roca.** Se identificó desde el propio FEL, sin
  pedirle nada al banco: 17 facturas cuyos pagos del BAC calzan el mismo día y por el mismo
  monto. Estaba como `VIATICOS`/`Es_Personal=No` en el FEL y `PERSONAL`/`Sí` en el BAC — **el
  mismo gasto con dos clasificaciones opuestas en dos pestañas.** Juanma ya lo corrigió.
- **El desfase horario (`p120`) dejó de ser teórico.** `reclasificar_ECO.js` del 4-sep movió
  8 de las 10 mensualidades del alquiler de la máquina de agua; la del **31/03 23:00**, que
  Apps Script lee como 01/04, quedó fuera de la lista y sigue en `BEBIDAS`. El script reportó
  éxito sobre las 8 que sí estaban en su lista.
- **Los Q21,000 del 04/02 quedan sin explicación** (`p101` cerrado): el banco ve lo mismo que
  nosotros. Ya están como `PERSONAL` y caen fuera de la ventana may-ago, así que no mueven la
  extracción medida.

### Verificado y que conviene no volver a dudar

- **El activador de `latido()` existe y corre**: última corrida lunes 8 sep 09:30, 0% de error.
  Se ve **solo** en la página de Activadores del editor — ni `clasp` ni la API los listan, y
  buscar el correo de fallo no sirve porque `latido` avisa lanzando excepción: si nunca
  encontró nada frío, nunca hubo correo.
- **El QR manda a Google y los correos del día después mandan a TripAdvisor.** Son dos canales
  distintos y no hay nada que reasignar (`p71` cerrado por decisión de Juanma).
- **Solo Juanma tiene acceso a la hoja `Rosanta Marketing OS`**, así que el token de Meta en
  `config!A1` queda como riesgo aceptado y entendido (`p80` cerrado).

## Cambios clave del 12 sep 2026 (v12)

Dos frentes en paralelo: **la unificación del pilar 3 en la intranet** (hecha por las
sesiones de Finanzas y Profit) y el cierre de la arquitectura de archivos. Detalle completo
en `Rosanta OS/03_Finance_Data_OS/2026-09-12_Unificacion_Intranet.md`.

### 1. La intranet es la ÚNICA superficie del pilar 3

Motor único: **`FinanzasDatos.gs`**, que lee el Sheet nativo del maestro **en vivo**. Toma la
meta de food cost y el tipo de cambio de `PARAMETROS`, y la planilla devengada del Sheet de
planilla (una pestaña `AAAA-MM` por mes). Con eso quedan **resueltas** dos alertas viejas: la
meta de 27.8 mal puesta en la intranet y la planilla escrita en dos lugares.

**Pantallas nuevas:** RAA (pestaña `RAA` en **`Rosanta_Intranet_Config`**, no en el maestro,
creada con `instalarRAA()`) y **Escenarios**, que reemplaza al artefacto `rosanta-dre-mensual`.

**El panel pasó de 5 tarjetas a 3 puertas** (Finanzas & Data · Profit OS · Sistema de
Marketing), con el shell `SistemaFinanzas` y su lateral: La semana · Metas · 2026 contra 2025
· Escenarios. `CosteoVista.html` se partió de 2.000 líneas en **11 parciales**, con la
reconstrucción verificada byte a byte, y se archivaron **3 `.gs` duplicados** que tenían 31
funciones globales repetidas — ahora 0. Detalle en
`~/Dev/Rosanta/apps-script/_informes/2026-09-12_Unificacion_intranet.md`.

**Jubilados el 12-sep:** `generar_dashboard.py` (a `_archivo/`), los `Rosanta_Dashboard*.html`,
la tarea de Cowork `rosanta-dashboard-refresh` (borrada) y el artefacto
`rosanta-dashboard-semanal`. **`generar_finanzas.py` se queda como validador A/B**: es el mismo
cálculo por otro camino —espejo `.xlsx` y Python contra Sheet nativo y Apps Script— y si los
dos dan distinto, uno se desvió. Es la única comprobación independiente que hay.

**Versión: v81 publicada el 12-sep-2026.** Batería **88 OK · 0 fallas · 0 avisos · 2 saltadas**
(90 pruebas). Las tres versiones del día, para no confundirlas:

| | Qué trajo | Batería |
|---|---|---|
| v79 | unificación: panel de 3 puertas, shell `SistemaFinanzas`, Finanzas con planilla y RAA | 90 · 0 fallas |
| v80 | token en las tres funciones del CRM y las pruebas nuevas (srv, corchetes, grupo 8) | 91 · 89 OK |
| **v81** | doble cabecera del shell y retiro de la prueba vieja de corchetes | **90 · 88 OK** |

El token funciona de punta a punta, verificado con el enlace de Jeffry.

> **Qué está probado y qué no, al cierre del 12-sep.** Lo verificado es que **el token
> funciona**: con el enlace de Jeffry en incógnito la intranet saluda "Hola Jeffry · rol:
> chef" y le muestra **solo Profit OS**. Esa misma pantalla es evidencia de que Jeffry **no**
> tiene `crm`, `marketing` ni `contenido` — si los tuviera, vería esas puertas.
>
> **Lo que NO está probado es el CRM con un Gmail real.** Hubo un reporte de que el CRM
> cargaba con el enlace de Jeffry, pero contradice la captura y el código: `?page=crm` exige
> `usuarioTieneModulo(usuario, 'crm')` (Code.js:165) y la puerta de Marketing exige
> `marketing` o `contenido` (Code.js:92). Lo más probable es que esa prueba corriera sobre la
> sesión de Juanma. **La prueba definitiva, pendiente:** enlace de Jeffry en incógnito
> **sin ninguna sesión de Google**, con `&page=crm`.

**Pantallas nuevas:** RAA (pestaña `RAA` en **`Rosanta_Intranet_Config`**, no en el maestro,
creada con `instalarRAA()`) y **Escenarios**, que reemplaza al artefacto `rosanta-dre-mensual`.

**El panel pasó de 5 tarjetas a 3 puertas** (Finanzas & Data · Profit OS · Sistema de
Marketing), con el shell `SistemaFinanzas` y su lateral: La semana · Metas · 2026 contra 2025
· Escenarios. `CosteoVista.html` se partió de 2.000 líneas en **11 parciales**, con la
reconstrucción verificada byte a byte, y se archivaron **3 `.gs` duplicados** que tenían 31
funciones globales repetidas — ahora 0. Detalle en
`~/Dev/Rosanta/apps-script/_informes/2026-09-12_Unificacion_intranet.md`.

### 2. Reglas técnicas nuevas (cada una de un incidente del día)

> **Todas son la misma regla vista por otra puerta: reconocer un patrón no es verificar.**
> El 12-sep se cometió cuatro veces en un día. La batería pasaba en verde porque buscaba
> `run.nombre(` y la llamada usaba corchetes. Un barrido dijo que el CRM estaba abierto
> porque buscaba `exigirModulo_` y la convención del repo era `requiere*_`. Se dio por hecho
> que Dev era un repo git por ver un `.git` sin mirar de quién era. Y se estuvo a punto de
> rehacer el panel entero por un iframe que salía vacío **solo** en la ventana de
> automatización. Cuando algo se da por bueno, **abrir el contenido**: el cuerpo de la guarda,
> el destino del `.git`, el navegador de la persona.

1. **Una guarda se verifica LEYENDO SU CUERPO, no reconociendo su nombre.** Los dos errores
   se cometieron el mismo día, uno en cada dirección. Método: (1) encontrar la llamada,
   (2) confirmar que se le pasa `auth`, (3) abrir el cuerpo y confirmar el `throw`.
2. **Una prueba que compara tiene que saltarse o fallar cuando no hay nada que comparar.**
   Una comparación sin datos que devuelve "igual" es una prueba en verde que no probó nada.
3. **Publicar = `create-version` + `update-deployment`, sin `push`**, y con HEAD verificado
   bajándolo aparte y comparando.
4. **Las carpetas de `~/Claude/Scheduled/` NO reflejan qué tareas existen.** Manda la app: una
   tarea borrada deja su carpeta en disco. No inventariar tareas leyendo esa carpeta.

### 3. Pendientes que deja el pilar 3

- Pegar en Cowork la tarea mensual nueva, que **verifica el cierre y avisa, sin calcular
  números** (`03_Finance_Data_OS/2026-09-12_Tarea_reporte_mensual_v2.md`).
- Actualizar el prompt del forecast de caja (p94), que todavía apunta a los JSON viejos.

### 4. Dos números de food cost que NO son el mismo, y conviven a propósito

> **OBSOLETO desde el 14-sep-2026 (v15):** la meta pasó a **28%** (global y cocina) y barra
> **20% plana**, y las dos salen de `PARAMETROS` por `metasFoodCost_`. `FIN_META_AREA` ya no
> existe. Siguen siendo dos usos distintos —el semáforo mide, el techo limita la compra—, pero ya
> no son números escritos a mano en dos lugares. La tabla de abajo queda como historia.

Decidido por Juanma el 12-sep-2026. **No reproponer unificarlos.**

| | Valor | Qué es |
|---|---|---|
| **Meta global de food cost** | **30% fijo** | el **semáforo**: contra qué se mide el resultado. Vive en `PARAMETROS!food_cost_objetivo_pct` |
| **Techo de compra por área** | **cocina 30 · barra 20** | la **herramienta de compra**: cuánto se puede comprar esta semana. Vive en `FIN_META_AREA` de `FinanzasDatos.gs` |

El primero mide lo que pasó; el segundo limita lo que se va a gastar. Que la barra tenga un
techo más bajo que la meta global no es una inconsistencia: es que la barra deja más margen y
su compra se aprieta más. No hubo que tocar código — `FIN_META_AREA.barra` ya valía 20.

---

## Cambios clave del 11 sep 2026 (v11)

Día de **arquitectura de archivos**, no de negocio. Ningún número del DRE cambió. Lo que
cambió es dónde vive cada cosa y qué lo vigila. Reportes en
`Rosanta OS/00_Admin/Auditorias/` (carpeta nueva): `2026-09-11_Guardian.md`,
`_Duplicados.md`, `_Inspeccion_carpeta_Claude.md`, `_Conversion_punteros.log`,
`_Rescate_Documents.log`, `_Sesion_Code.log`.

### 1. Rosanta OS es la puerta única (regla 0 nueva del README)

Se agregaron dos **alias** en la raíz de `~/My Drive/Rosanta OS/`:

- `_Codigo` → `~/Dev/Rosanta`
- `_App` → `~/Claude`

Abrir `Rosanta OS` ahora muestra todo: los 6 pilares, el código y la carpeta de la app.
**Son symlinks a propósito y tienen que seguir siéndolo.** Si alguna se convierte en
carpeta real, Drive Desktop empieza a sincronizar los `.git` y `node_modules` de adentro
y corrompe los repos. El guardián revisa las tres cosas —que existan, que sean alias y
que apunten a donde deben— y cualquiera de las tres sale como crítica.

**Por qué NO se movieron Dev ni ~/Claude adentro de Drive:** `Dev` tiene dos `node_modules`
(466 archivos que npm reescribe seguido) y `~/Claude` toca ~19 archivos por día él solo. Un
sincronizador encima de eso produce archivos `(1)` y carpetas corruptas.

> **RESUELTO el 12-sep-2026: `~/Dev/Rosanta` YA es un repositorio git.** Primer commit
> `00eae34`, 465 archivos, rama `main`, identidad local al repo. Fuera del historial:
> `node_modules/`, `_backups/`, **`clasp-creds.json`** (cliente OAuth con `client_secret`) y
> `tools/ui-ux-pro-max-skill/` (repo de terceros). `_archivo/` sí entra: es historia de código.
> **El `.gitignore` se escribió ANTES del primer `add`** — sacar un secreto del historial
> después es mucho más trabajo que ignorarlo antes. **Desde ahora: `git status` antes de
> escribir y `git diff` para ver qué tocó otra sesión.**
>
> El texto de abajo queda como registro de por qué hizo falta:
>
> **Hasta el 12-sep-2026 `~/Dev/Rosanta` NO era un repositorio git.**
> `git rev-parse` contesta "not a git repository". El único `.git` en todo Dev está en
> `tools/ui-ux-pro-max-skill/`, que es una skill de terceros y no cubre nada de Rosanta.
> **Ningún código de Rosanta tiene control de versiones**: ni la intranet, ni el maestro, ni
> el sitio. La única red son los respaldos manuales de `_backups/`, que son voluntarios —
> el 12-sep se modificó `SistemaFinanzas.html` sin dejar uno.
> Eso importó ese día: **cinco sesiones escribían `rosanta-intranet` a la vez.** Si dos tocan
> el mismo archivo, gana el último que guarda y no queda rastro. Ver el pendiente abierto.

### 2. Cero código ejecutable en Drive

Se archivaron **73 archivos** `.gs/.js/.ts/.py/.sh` a `_Archive/Guardian_2026-09-11/`,
conservando la ruta relativa. Nada se borró. Hoy quedan **0** fuera de `_Archive/`.

Los **dos generadores del maestro se mudaron** a `~/Dev/Rosanta/scripts/maestro-finanzas/`:
`generar_finanzas.py` y `generar_dashboard.py`, más un `rutas.py` que es lo único que sabe
dónde están los datos (`--datos RUTA` > `ROSANTA_MAESTRO_DIR` > el default en Drive).
**El espejo, `_datos_finanzas/` y los dos `Rosanta_Dashboard*.html` siguen en Drive**: son
datos y entregables. Verificado A/B contra el mismo espejo: las seis salidas, byte a byte
idénticas.

### 3. Tres herramientas nuevas en `~/Dev/Rosanta/tools/`

| Herramienta | Qué hace |
|---|---|
| `guardian-estructura/` | valida las 7 reglas del README en <1 s sobre los ~6.800 archivos. Solo reporta; `--fix` mueve a `_Archive/` o `_Inbox/` y `--realias` repara los alias rotos. **Ninguno borra.** Los dos tienen su `--dry-run-*` |
| `duplicados/` | hashea por contenido (md5) y agrupa; solo reporta |
| `convertir-punteros/` | `.gdoc/.gsheet/.gslides` → `.docx/.xlsx/.pptx` al lado del puntero, sin borrarlo |

### 4. Los punteros de Google

En Rosanta OS hay **426 punteros** (131 `.gdoc`, 291 `.gsheet`, 3 `.gslides`, 1 `.gform`).
Un `.gdoc` es un JSON de ~180 bytes con el ID: **Cowork y Claude no lo pueden leer.**

Se convirtieron **12** (los que Cowork necesitaba, venían del knowledge de claude.ai).
Quedan **374 sin archivo real al lado**, listados por pilar en el reporte del guardián.
**No convertirlos en bloque:** muchos `.gsheet` son hojas vivas que Juanma edita en Google,
y una copia `.xlsx` al lado se desactualiza el mismo día. Se convierte por demanda.
`.gform` no se puede exportar a Office (403).

**Un alias no guarda información.** `Documents/Claude/Projects/Rosanta Pauta` son 70 bytes
que apuntan a `05_Marketing_OS/Workspace_Pauta` (143 archivos, 19 MB). No hay copia ni
duplicado: es la misma carpeta vista por otra puerta. Borrar el alias no libera nada y
desvincula el proyecto de Cowork — si un proyecto ya no se usa, se elimina **desde la app**,
que se lleva el alias con él.

**Auth:** `clasp-creds.json` es solo un cliente OAuth — no trae tokens ni scopes — y el
token de clasp (`~/.clasprc.json`) no incluye `drive.readonly`. Los 12 se exportaron con el
**conector de Google Drive de Claude**. El conversor propio lleva su OAuth con scope
`drive.readonly` y guarda el token en `~/.rosanta-drive-token.json`.

### 5. `~/Documents` pasó de 11 MB a 268 KB, y se ocultó

**No se puede borrar**, por dos razones: está sincronizada con **iCloud** (Escritorio y
Documentos activado), y adentro viven los **9 alias** de `Claude/Projects/` que son la
vinculación de cada proyecto de Cowork con su carpeta. Eso no es información: es un enlace,
y no hay copia en ningún lado.

Lo que sí se hizo: de los 23 archivos reales que había, **8 estaban repetidos** en Drive
(fueron a `_Archive/Duplicados_Documents_2026-09-11/`) y **8 eran únicos** y se repartieron
a su pilar. Quedan los 9 alias, los 6 `.md` de `_migracion_nube/` y el LEEME de la
centralita. La carpeta se ocultó del Finder con `chflags hidden ~/Documents` (revertir con
`chflags nohidden`).

### 6. `~/Claude` está sana

15 MB, 267 archivos: 23 artefactos con su historial, 17 tareas programadas y 2 alias.
**Cero archivos duplican contenido de Drive o de Dev**, comparado por md5. Es el caché de
la app, no una cuarta capa; no se toca ni se renombra. Lo único que sobra son
`Finanzas_preview.html` y `Metas_preview.html` en la raíz — del 4-sep, con la **paleta
vieja** incrustada.

### 7. Duplicados: 1,0 GB recuperable

**396 grupos** idénticos por contenido, **520 archivos sobrantes**. El 70% del peso son
videos de marca copiados 3 y 4 veces en `05_Marketing_OS`. El reporte recomienda cuál
conservar pero **no mueve nada**: es decisión a ojo.

### Reglas nuevas (cada una salió de algo que pasó hoy)

1. **Apps Script busca las carpetas de Drive por ID, no por ruta** (`getFolderById`). Mover
   carpetas en Drive **no rompe nada** del código. Las dos únicas excepciones se buscan por
   **nombre** y por eso no se pueden renombrar: la hoja `Rosanta Leads` y
   `Rosanta_Maestro_ESPEJO.xlsx`. Lo único que sí se rompe al mover una carpeta son los
   **alias**, y en silencio: la app sigue listando el proyecto pero no ve nada. Por eso el
   ritual después de reorganizar es **correr el guardián** y, si aparece alguna crítica,
   **`--realias`**, que busca la carpeta por nombre y reconecta. Si hay varias con el mismo
   nombre no adivina: las lista.
2. **Antes de archivar un script, mirar si lee datos de al lado.** `generar_finanzas.py`
   (tocado el día anterior) resolvía `BASE = dirname(__file__)`: archivarlo lo rompía. Se
   devolvió en el acto y después se mudó bien.
3. **Una carpeta vacía en `Documents/Claude/Projects/` no se mueve.** Suele ser un proyecto
   que la app acaba de crear; moverla lo desvincula. El guardián solo la reporta.
4. **El `birthtime` en Drive Desktop sí conserva la fecha real** — sirve para la regla de
   nombres. Pero en archivos rescatados o vueltos a descargar se pierde y quedan todos con
   la fecha de hoy.
5. **Los symlinks dentro de una carpeta de Drive sobreviven:** Drive Desktop no los sube ni
   los rompe. Es lo que hace posible la regla 0.
6. **claude.ai queda FUERA del stack (11 sep 2026).** Juanma borró los tres proyectos de la
   nube y decidió no volver a usarlo para nada. **No proponer guardar nada ahí, ni el
   knowledge de un proyecto.** Todo vive en las tres capas: Drive (datos), Dev (código) y
   Projects (alias). Esto termina la duplicidad entre "proyectos de la nube" y "proyectos
   locales con carpeta conectada", que era la causa del falso diagnóstico de proyectos
   idénticos. Costo del cierre, medido: se perdieron 3 PDFs de lectura de terceros y 3 notas
   de trabajo de la intranet, todas cubiertas por otra vía. **Ningún dato de negocio.**
7. **Hay DOS almacenes de artefactos y son distintos.** `~/Claude/Artifacts/` tiene los **23**
   de Cowork, que se actualizan con `update_artifact` por id — **ahí vive
   `rosanta-seguimiento-semanal`**. La galería `claude.ai/code/artifact/…` tiene los **10**
   publicados desde una sesión, y el tablero **nunca estuvo ahí**. El 11 sep una sesión buscó
   en la galería, no lo encontró y concluyó que se había borrado; estuvo a un paso de
   reconstruirlo desde cero sobre 62 versiones de historial. **Antes de dar por perdido un
   artefacto, mirar el archivo en `~/Claude/Artifacts/<id>/index.html`.**

---

## Cambios clave del 10 sep 2026 (v10)

Día completo de trabajo en la **intranet** (Apps Script), ocho versiones publicadas (69 → **76**). Batería de pruebas: **71 OK · 0 fallas · 2 saltadas**. Detalle en `references/proyectos.md` §3.

- **El código de la intranet se movió** a `~/Dev/Rosanta/apps-script/rosanta-intranet`. La ruta vieja (`~/Documents/Claude/Projects/Claude/rosanta-intranet`) queda obsoleta. Deployment publicado: `AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb`. **Al cierre del 12-sep-2026 ese deployment está en la v81, no en la 76: cinco versiones más en una sola tarde.** Por eso un número de versión escrito no sirve: **verificarlo con `clasp list-deployments` antes de dar por buena una versión de memoria.**
- **Acceso por token resuelto.** El equipo con Gmail personal (fuera del dominio rosanta.rest) entra con `?u=<token>`. Jeffry (chef) fue el primero en recorrer el camino completo. Eran **tres bugs encadenados**, cada uno tapando al siguiente.
- **El recetario en frío pasó de 46,7 s a 0,44 s.** La causa no era cómputo sino llamadas a servicio dentro de bucles.
- **Agujero de permisos cerrado:** `doGet` protege la PÁGINA, no la FUNCIÓN. Cuatro funciones no verificaban a quien las llamaba — dos de ellas leían el maestro financiero entero. Se corrigió con `exigirModulo_(auth, modulo)`.
- **Desde S36 los reportes del POS se suben ya convertidos a hoja de Google** y el cargador lee el nativo directo. El camino del `.xlsx` se mantiene porque S35 y anteriores lo necesitan.
- **Ventas por producto al día:** de terminar el 23 ago a terminar el 6 sep (9.502 → 10.068 filas).

### Reglas técnicas de Apps Script (cada una salió de un bug real, no repetirlas)

1. **El token va como PRIMER argumento.** Servidor: `resolverUsuario_(auth)` o `exigirModulo_(auth, modulo)`, nunca `getUsuarioActual()` a secas. Vista: `var AUTH = '<?= authToken ?>';` declarado una vez y pasado en TODAS las llamadas a `google.script.run`. `doGet` resuelve la identidad UNA vez al abrir; cada `google.script.run` es una petición nueva.
2. **Dentro de un `href` la query va SIN escapar:** `<?!= qs ?>`, no `<?= qs ?>` — el escapado contextual convierte `&u=` en `%26u%3d`. **Apps Script NO tiene sintaxis de comentario `<?# ?>`**: se parsea como scriptlet y tira SyntaxError.
3. **Nada de `Utilities.*`, `SpreadsheetApp.*` ni `DriveApp.*` dentro de un bucle.** Son llamadas a servicio, no JavaScript. Si un tramo mide 10 s en una corrida y 97 s en otra del mismo día, es latencia de servicio, no cómputo.
4. **Para leer el contenido de una vista:** `createTemplateFromFile(v).getRawContent()`. `createHtmlOutputFromFile` **sanitiza** (devolvía 108.722 de 121.691 caracteres y rechaza Marketing con "Malformed HTML content").
5. **Un cache sin su invalidación es otra regresión.** Al cachear algo accionable, borrar ese cache donde se ejecuta la acción que lo resuelve.
6. **Un corte de red NO significa que la escritura no ocurrió.** `clasp run` devolvió ECONNRESET y la carga sí se había completado. Verificar estado antes de reintentar: reintentar habría duplicado dos semanas de ventas.
6bis. **`clasp` falla de DOS formas distintas y las dos terminan igual: no podés publicar.**
   Pasó el 12-sep-2026 en una hora. (a) `~/.clasprc.json` con un token de la **cuenta
   personal**: la API contesta *"The caller does not have permission"* y **nunca dice que el
   problema es la cuenta**. (b) El archivo **vacío** (`{"tokens": {}}`, 18 bytes): contesta
   *"No credentials found"*. Distinto síntoma, misma parálisis. El arreglo de las dos es
   `clasp login` con **restaurante@rosanta.rest**, pero si no distinguís el síntoma buscás
   en el lugar equivocado. Confirmado también: **clasp 3.3.0 sigue usando `~/.clasprc.json`**
   — no hay `~/.config/clasp`.
6ter. **No creerle a lo que clasp IMPRIME.** Dos mentiras vistas el 12-sep-2026:
   *"You are logged in as restaurante@rosanta.rest"* apareció con un token de
   `juanma.lemus@gmail.com`, y *"Script is already up to date"* apareció con un push que sí
   subió 15 archivos. **La cuenta se verifica** con `tokeninfo` del access_token; **un push o
   una versión se verifican** bajando el proyecto —o `clasp pull --versionNumber N`— a una
   carpeta **aparte** y comparando archivo por archivo.
6quater. **Nunca `clasp pull` sobre el repo.** Pisa lo que haya en disco, incluido el trabajo
   sin guardar de las otras sesiones. Siempre a una carpeta aparte.
6quinquies. **Si hay cambios de otras sesiones en disco sin probar, se publica con
   `create-version` + `update-deployment` y SIN `push`.** `create-version` congela lo que está
   en el servidor, no lo del disco: es la forma de sacar una versión sin arrastrar trabajo ajeno
   a medio hacer.
6sexies. **`include()` SANITIZA** (usa `createHtmlOutputFromFile`), así que no sirve para
   parciales con JavaScript: se come contenido. Para eso está **`incluirCrudo_()`**, con
   `getRawContent`. El guion bajo final es a propósito: devuelve código fuente, y sin él
   cualquiera podría llamarla desde `google.script.run`.
6septies. **Una vista partida en parciales tiene que tener sus parciales en las listas `VISTAS`
   de `Pruebas.js`**, o las llamadas de esos parciales quedan sin proteger y la prueba sigue
   en verde. Mismo punto ciego de siempre, por otra puerta.
6decies. **La batería solo EVALÚA dos páginas: `Index` y `CosteoVista`** (vía `doGet`). Las
   demás vistas las lee **crudas**, sin ejecutarlas. Un scriptlet mal cerrado en una vista de
   Finanzas **pasa en verde**. Después de tocar una plantilla hay que **abrirla, directa y
   embebida**; y antes de publicar, compilar cada plantilla a JavaScript y pasarla por
   `node --check` con control negativo, que es lo que se hizo para la v81.
6nonies. **Un iframe vacío visto desde la ventana de automatización NO prueba nada.** Esa
   ventana bloquea cookies de terceros, así que cualquier contenido embebido sale en blanco.
   Pasó el 12-sep: se dio por roto el shell de Finanzas —y de paso el de Marketing, que
   funcionaba desde antes— y estuvo a punto de rehacerse el lateral para que navegara en vez
   de embeber. **Juanma lo abrió en su Chrome y cargaba perfecto.** Lo que se ve embebido se
   confirma en el navegador de la persona, no en el de la automatización.
6octies. **Si `clasp login` da 400 por `authuser=1`** (varias cuentas abiertas en Chrome):
   pegar la URL de autorización en una ventana de **incógnito**.
7. **Los activadores se crean A MANO** (Editor › Activadores): `ScriptApp.newTrigger()` necesita el scope `script.scriptapp`, que el manifiesto no declara. Y que un activador esté guardado no prueba que corra.
8. **Mirar el conteo, no el color.** La prueba de permisos pasó en VERDE habiendo revisado 2 de 21 llamadas.
   **Segundo caso, 12-sep-2026, peor que el primero:** el barrido de `Pruebas.js` solo reconoce
   llamadas con la forma `run.nombre(`, y la vista llamaba con `run['getFinanzasData']()`.
   La llamada era **invisible para la prueba**, así que el grupo pasaba en verde con
   `getFinanzasData` sin guarda — o sea con la puerta abierta al maestro entero.
   **Las llamadas a `google.script.run` se escriben SIEMPRE con el nombre literal**, nunca
   con corchetes. Si hay un dispatcher genérico, **cada nombre que pase por él necesita su
   propio chequeo de guarda**, porque el barrido no lo va a ver. **La prueba vigente** se llama
   *"Ninguna vista llama al servidor con el nombre en una variable"* (`Pruebas.js`) y se apoya
   en el helper **`_prLlamadasConCorchetes`** de `PruebasFinanzas.js`: recorre la cadena de
   handlers con **paréntesis balanceados** y marca solo si el corchete viene pegado al último
   `)`. Cubre las 25 vistas, con el dispatcher de `Marketing.html` como excepción declarada.

   **Citar las pruebas por NOMBRE, no por número de línea**: los números se mueven con cada
   edición.

   Como antecedente, la primera versión fue una ventana fija:
   `/google\.script\.run[\s\S]{0,400}?\[\s*[a-zA-Z_$]/`. Encontró el bug original, pero
   sobre las 25 vistas daba **falsos positivos** —corchetes de array dentro del handler— y se
   retiró en la v81. **No copiarla.**

      La regla general: **una prueba que busca por patrón de texto solo encuentra el patrón
   que conoce.**
8bis. **`clasp push` sube TODO lo que hay en la carpeta si no existe `.claspignore`.** Y como
   todos los `.js` comparten un solo ámbito global, un respaldo de `Code.js` subido al lado de
   `Code.js` redefine cada función y gana el que cargue último — sin un solo error. El
   `.claspignore` de `rosanta-intranet` (creado el 12-sep-2026) excluye `_backups/**`, `*.bak`,
   `.git/**`, `node_modules/**` y `*.md`. **Cualquier repo de Apps Script nuevo necesita el
   suyo antes del primer push.**
8ter. **Una guarda se verifica LEYENDO SU CUERPO, no reconociendo su nombre.** Los dos
   errores posibles se cometieron el 12-sep, uno en cada dirección: un barrido que busca
   `exigirModulo_` no ve `requiereCrm_` y reporta abierto lo que está cerrado —hace perder
   tiempo—; y un barrido que ve `requiereAlgo_()` y concluye "cerrado" sin abrirla puede
   estar bendiciendo una guarda que no niega nada —eso es un incidente—. El método correcto
   son tres pasos: **(1)** encontrar la llamada a la guarda, **(2)** confirmar que se le pasa
   `auth`, **(3)** abrir el cuerpo de la guarda y confirmar que hay un `throw` ante usuario
   inexistente o sin módulo.
9. **Antes de nombrar una función nueva, verificar que no exista.** Los `.gs` comparten un solo ámbito global y un nombre repetido pisa al otro en silencio.

### Cómo se trabaja la intranet (reglas de Juanma)

- **No reescribir módulos que funcionan.** Los cambios son incrementales.
- **No cambiar roles ni permisos de la hoja USUARIOS sin pedirlo.**
- Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`. `clasp push` solo actualiza HEAD.
- **Verificar YA NO es `clasp run`.** Con el login actual `clasp run-function correrPruebasTexto`
  contesta *"Unable to run script function"*. La batería se corre **en el navegador**, sobre el
  `/dev` del @HEAD: `…AKfycbxw_…/dev?page=pruebas`. Para leerla desde Claude in Chrome el iframe
  no deja scrollear ni `get_page_text`: clic adentro, `cmd+a`, `cmd+c`, `pbpaste`.

---

## Cambios clave del 6 sep 2026 (v9)

Esta versión cierra una brecha de tres semanas: la v8 quedó al 14 ago y las referencias al 26 jul. Se integran las semanas S35 (24–30 ago) y S36 (31 ago–3 sep) y el bloque de POS/sitio del 10–20 ago.

### 1. Estructura nueva: Rosanta OS de 6 pilares

El mapa viejo de "proyectos sueltos" quedó obsoleto. Todo se organiza ahora en **6 pilares**, y Drive está reorganizado igual:

| Pilar | Qué cubre | Estado |
|---|---|---|
| **Finanzas & Data OS** | Maestro, DRE, P&L, prime cost, caja | Arrancó 2 sep. Vista v1 viva |
| **Profit OS** | Recetario, costeo, inventarios, merma | En funcionamiento desde S35 |
| **Marketing OS** | Pauta, CAC, ROAS, reseñas, carritos, encuesta | En funcionamiento |
| **Back office / Operations Hub** | **12 sep:** Rosanta OS es la puerta única (`_Codigo`/`_App`), una **centralita por proyecto** en `Documents/Claude/Projects/` con solo alias adentro, 0 código en Drive, guardián vivo y **`~/Dev/Rosanta` ya es repo git**. Abierto: 232 MB en duplicados chicos, 374 punteros, la key de Wix en texto plano | `references/ecosistema.md` |
| **Web Rosanta** | rosanta.rest (Wix), SEO, multilingüe | Activo |
| **Reservas / Ticketing (WIX)** | Reservas, webhooks, monitoreo | Activo, con fallo abierto |

Auditoría de artefactos cerrada bajo esta estructura: **10 vivos, 9 borrados, 3 pasan a referencia**. Hallazgo de producto: **la app no permite renombrar artefactos** (solo Pop out, Unpin, Move down, Delete), así que el mapa oficial pasa a ser el archivo `_Indice_Artefactos.md`.

### 2. Finanzas & Data OS — el pilar nuevo (arrancó 2 sep 2026)

- **El maestro migró a Google Sheet NATIVO** `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`. Decisión de Juanma de alejarse del xlsx. **El .xlsx ya NO es la fuente**; existe un espejo `Rosanta_Maestro_ESPEJO.xlsx` que Apps Script exporta cada semana para que las herramientas locales de Python lo lean vía Drive Desktop. Se encontraron y desactivaron **tres archivos distintos** llamados `Rosanta_Reporte_Maestro_v2_2026`; los sobrantes quedaron como `ZZ_ARCHIVO_`.
- **Cargador automático** en Apps Script: Juanma deja los archivos en la carpeta de la semana y el sistema los identifica **por contenido, no por nombre** (POS / FEL emitidas / FEL recibidas), convierte los .xls y lleva registro de lo procesado. Código en `Maestro/AppsScript_cargador.gs`.
- **Los ocho meses del año validados al centavo** contra los PDF originales: 8/8 en Banco Industrial y 8/8 en BAC.
- **DRE anual construido:** ventas Q1,220,487 · COGS Q450,227 (36.9%) · gasto operativo Q858,465 (70.3%) · **resultado −Q88,205 (−7.2%)**. Equilibrio en Q90,612/mes contra Q152,561 de venta real. Lectura: **el problema no es vender, es la estructura de costo.**
- **Prime cost** calculado por primera vez: 56.9% en el año (bajo el límite de 60%), pero **julio 66.0% y agosto 67.5%** se rompieron contra 49–59% de enero a junio.
- **Hallazgo de método (importante):** el maestro es **base caja**, y eso rompía el prime cost mensual (saltaba de 40% a 76% sin que la operación cambiara). Se conectó la **planilla devengada** como fuente de nómina y el rango se volvió señal real.
- **Reporte del contador DESCONTINUADO** → reemplazado por un **reporte interno mensual**, que arrancó con el cierre de agosto. Carpeta: `1Dfkg52IphK3V1hWCaDQ2MAqqxzMQxmju`.
- Artefacto: **`rosanta-dre-mensual`** (vista Finanzas v1: los 5 números del P&L con semáforo contra benchmark del sector, prime cost mensual, gasto operativo contra rango, punto de equilibrio y simulador de escenarios).

### 3. Alertas rojas abiertas (N1) — leer antes de proponer cualquier cosa

**Revisadas el 11 sep 2026 contra el tablero.** Cuatro de las seis que traía la v9 se
cerraron o cambiaron de forma. No reproponer las cerradas.

1. **La caja: el problema es la extracción, no la operación.** Medido el 11 sep sobre ocho
   meses y una semana: la operación **genera Q188,547** (cobrado Q1,337,332 − salidas de
   operación Q1,148,786). Lo que descuadra es la extracción: **Q136,546 de gasto personal
   por las cuentas de la empresa + Q100,325 de retiros del socio = Q236,871**, el **126%**
   de lo que el negocio produce. Resultado de caja del año: **−Q48,325**. En promedio la
   operación deja Q22,993/mes y se extraen Q28,887.
   El saldo bajo no es un mal mes: estuvo bajo una semana de gasto **230 de 244 días** con
   movimiento (94% del año), tocó **Q0.00 exactos el 31 de julio** y su máximo anual fueron
   Q56,772, que duraron once días. Junio (−Q8,725) y julio (−Q3,023) son los dos únicos
   meses en que la operación misma quemó caja, y son los del food cost más alto.
   **Pendiente vivo (p122, N1):** definir un nivel de extracción sostenible. Es una decisión
   de Juanma, no un análisis. El forecast a 30/60/90 es p94, con diagnóstico completo y
   prompt de arranque ya entregado.

2. **Devoluciones de inversión: eran tres acreedores, queda uno.** Kristinsa
   (Q32,535) y Manuel Lemus (Q6,000) **ya están pagados en su totalidad**. Queda
   **Raúl, el socio**, a quien en 2026 se le pagaron Q50,000 (la fila del 18-feb).
   **Para 2027 el objetivo es Q100,000**, una vez al año y en el primer trimestre.
   La categoría `DEVOLUCION_INVERSION` estaba bien puesta: los Q100,325 de 2026 son
   los tres acreedores. **La carga no sube en 2027** — es el mismo total, concentrado
   en una sola persona.

   **Raúl puede recibir menos**, pero Q100,000 es el número que se intenta entregar.
   Eso lo hace distinto del retiro y del alquiler, que salen sí o sí.

3. **La vara de la caja son DOS umbrales, no uno** (Juanma, 12 sep 2026):

   | | Por mes | Naturaleza |
   |---|---:|---|
   | Retiro de Juanma | Q5,000 | fijo |
   | Alquiler de su casa, US$1,800 | ~Q13,896 | fijo |
   | **PISO** | **Q18,896** | **sale sí o sí** |
   | Devolución a Raúl, Q100,000/año | Q8,333 | objetivo, flexible |
   | **OBJETIVO** | **Q27,229** | |

   Contra los **Q12,845/mes** que dejó la operación en may–ago:

   - cubrir el **piso** pide **+Q6,051/mes** → **+5.4% de venta** (~Q8,600/mes más)
   - cubrir el **objetivo** pide **+Q14,384/mes** → **+12.8% de venta** (~Q20,500/mes)

   **No hay sobregasto: hay un problema de tamaño.** En may–ago se extrajo Q14,132/mes
   de personal contra Q18,896 de necesidad real — Juanma se está quedando **corto en
   Q4,764/mes**, no pasándose. La pregunta del pilar no es cómo recortar la extracción
   sino cómo la operación llega a Q18,896 primero y a Q27,229 después. Un 5% de venta
   es una meta, no un milagro.

   **Y la palanca ya está identificada, en el pilar 4.** La pantalla de Profit OS tiene medido
   al 12-sep: **Q24,983/año recuperables contra meta** (33 productos por encima de su costo
   objetivo — el Brisket en Salsa Bordelesa solo son Q9,838, con 44.8% contra 30%) y
   **Q38,320/año de oportunidad en sala** (9 rompecabezas con venta al menos mensual). Son
   **Q63,303/año = Q5,275/mes**, o sea el **87% del hueco contra el piso** y el 37% contra el
   objetivo.

   Eso cambia la conversación: el hueco **no se cierra solo vendiendo más**. Una parte grande
   sale de costo, con trabajo que el pilar 4 ya hizo y que está con nombre y monto por
   producto. **No hay que buscar la palanca: hay que ejecutarla.**

   **Documento de arranque, autocontenido:**
   `Rosanta OS/03_Finance_Data_OS/2026-09-12_Objetivo_Operacional.md`. Se trabaja en
   **sesión dedicada** del pilar, amarrado al forecast de caja (p94). Trae también lo que
   tiene margen: el tipo de cambio de los cargos en dólares (73% del gasto personal), y
   cuánto del histórico se marcó con la regla de clasificación vieja.

4. **Meta de food cost: ~~30% fijo~~ 28% desde el 14-sep-2026, sobre precio sin IVA (ver v15).** Decisión de Juanma del 10 sep, corregida el 14. **Queda descartada** la
   fórmula del mix y el 27.8% ponderado que traía la v9 — eso es **obsoleto, no repetirlo**.
   Ya está aplicado en los tres lugares donde vivía: intranet (`PARAMETROS!B3`, de 32 a 30),
   `generar_finanzas.py` (de la fórmula a 30.0 fijo, con el razonamiento escrito en el
   código) y el recetario, que ya estaba bien. El mix se sigue publicando como información,
   pero deja de definir la meta.

5. **Alquiler: CERRADO como palanca.** Juanma confirma que ya se negoció a la baja y no hay
   más margen. Pasa de pendiente a **restricción conocida** de la estructura de costo. No
   reproponer bajarlo.

6. **Reservas: CERRADO.** El canal se rehízo en Claude Code: el cliente reserva desde el chat
   del bot, la reserva se crea en Wix y el bot confirma; por el mismo camino cancela. Cierra
   el N1 de los webhooks mudos que venía del 6 de agosto. Abierto menor: confirmar que el
   activador de `latido()` existe (p107), y borrar los deployments v2 y v3 del Marketing OS,
   que siguen siendo dos URLs vivas que se tragan tráfico (p82, N3).

7. **Credenciales: matizado.** El **token de Meta en `config!A1` NO es un descuido** — lo lee
   un Google Ads Script, que corre fuera de Apps Script y no tiene `PropertiesService`, así
   que la celda es la única alternativa a hardcodearlo. La mitigación real es **restringir el
   acceso a la hoja y rotar**, no mudarlo. Lo que sigue siendo exposición real es la API
   key/JWT de Wix y el site id en esa misma pestaña.

8. **Nómina de febrero: CERRADO.** Las 73 filas se reclasificaron el 7 sep y las seis
   transferencias del 16/02 ya dicen NOMINA; el maestro y el espejo se regeneraron.

**Del 10-11 sep, para no volver a asustarse:** el recetario de barra nativo estuvo en la
**papelera de Drive** con borrado a 30 días mientras la intranet lo leía todos los días.
Se restauró el mismo día que se descubrió (27 fichas, 29 sub-recetas, Banco de 200 insumos).
Causa raíz: vivía en `Downloads`. Ya está en `04_Profit_OS/Recetario`, al lado del de cocina.

### 4. Profit OS (S35)

Recetario y costeo pasan a tablero propio; se cerró un bloque de 33 pendientes arrastrados desde el 22 ago. Recetario migrado a **v14 en hoja nativa** `1oxVJIaplR7Ofk4_lYgvIsOMBonUGrcoDa0J099vnlxg` (33 platos mapeados, VLOOKUP contra el Banco de Datos sobrevivieron). Banco de Datos limpiado. Inventarios integrados a Profit OS (dejan de ser sistema aparte). MAPA POS ejecutado: 5 productos retirados, 7 activos sin ficha resueltos, 2 altas (~Q1,145/semana que se cobraban a mano).

**Diferidos por Juanma el 3 sep — no reproponerlos hasta que él lo decida:** SPLH (ventas por hora-hombre, imposible hoy porque no se registran horas por turno) y **merma** (no existe ningún dato).

### 5. Web, sitio y POS (10–20 ago)

- **Sitio multilingüe ES/EN completo y verificado en vivo.** Menú en español terminado: 18 descripciones de sección, 77 platos, etiquetas y variantes.
- **Brunch eliminado de la web** — no se sirve desde hace más de un año. (Coherente con "Rosanta NO vende brunch", v8.)
- Decisión de marca: **"Farm to Table" se queda en inglés** porque es el término que buscan los turistas; el jardín vive en el cuerpo de la página.
- **Reglas operativas de Wix (no repetir errores):** (a) editar el texto en inglés en la app de menús **borra su traducción al español** → primero se cierra el inglés, después se carga el español; (b) cargar la traducción no basta, **solo publicar** invalida el caché de render; (c) el SEO por idioma se edita **en el Editor con el selector en Spanish**, no en el Translation Manager.
- **hreflang:** Wix no lo emite en 8 de 9 páginas pese a prometerlo por escrito. Corre un parche por Custom Code en 5 páginas (`RUNBOOK_hreflang_parche.md`); Wix **nunca respondió** al escalamiento. Quitar el parche cuando lo arreglen o quedan etiquetas duplicadas.
- **POS y carta 2026-2027:** 187 productos fuera de carta dados de baja, 71 cambios de precio, precios de los 212 productos actualizados, carta de vinos 2027 cargada, etiqueta de carta 2027 marcada (144 de 212). **La carta nueva ya corre en el restaurante con el POS sincronizado.**
- **Google Ads reactivado** el 10 ago (método de pago actualizado, riesgo de suspensión resuelto).

### 6. Marketing y reputación

- **TripAdvisor sube en las tres métricas** contra el baseline del 17 jun: 9 → 12 reseñas, 4.1 → 4.4 estrellas, #204 de 418 → **#146 de 463** (58 posiciones, con la lista creciendo).
- **La encuesta de satisfacción manda el 100% de las 5★ a Google**, que ya tiene volumen. Re-apuntarla a TripAdvisor es cambiar UNA propiedad del script y es la palanca más barata. **Ojo:** el Sheet donde cae la encuesta es propiedad de un tercero (`Eli_Juli@lacocinaquesuena.com`), no de Rosanta — resolver antes.
- **ROAS:** en el denominador solo entra inversión en medios (FACEBK, GOOGLE*ADS). **Los honorarios de gestión de pauta cuentan en el bloque Marketing del DRE pero NO en el ROAS.**
- **El COGS semanal no es señal, es ruido** (desviación 13.9 puntos). Usar **media móvil de 4 semanas** como número principal; la semana cruda solo como contexto.

### 7. Reglas nuevas de trabajo

- **Las reseñas de Google se responden automáticamente** por la plataforma de reservas. Nunca listarlas como pendiente.
- **Comando "Consolidar tablero":** al cerrar una sesión, los cierres se escriben en el acto en `rosanta-seguimiento-semanal`. El tablero es un archivo local: `~/Claude/Artifacts/rosanta-seguimiento-semanal/index.html`, con los datos en el `<script id="seguimiento-data">`. **Desde Claude Code se edita ese JSON directo y se deja copia en `versions/`** — el cierre dominical automático solo lee sesiones de Cowork, así que todo lo que pasa en Claude Code hay que escribirlo a mano o se pierde. Formato: `cerrado: …` / `pendiente-1: … — N# — proyecto`. La skill `cierre` maneja el ritual.
- **Los consumos en restaurantes NO se clasifican por el nombre del comercio.** El mismo lugar puede ser comida personal de Juanma o comida con el equipo.

---

## Cambios clave anteriores (vigentes)

### 14 ago 2026
- **PROHIBIDO decir "leña de café". No existe.** La leña de la parrilla es de **gravilea**, el árbol que da sombra a los cafetales. Se compra a fincas de café con prácticas regenerativas; no se nombran fincas ni certificaciones en público sin consentimiento escrito. Sirve como prueba de origen del farm to table.
- **Vocabulario prohibido:** "coctel de autor" y "cocina de autor". Aquí se dice **gastrococtelería**. La lista dura vive en `rosanta-brand-guidelines`, que hay que cargar antes de escribir cualquier texto de Rosanta.
- **Rosanta NO vende brunch** y **NO trabaja con OpenTable.** Existe una ficha en OpenTable que dice que no acepta reservas y ChatGPT la cita; reclamarla o darla de baja.
- **Menú web:** carta 2026-2027 (7 secciones plegables, ES/EN) servida desde GitHub Pages (`Rosanta2024/rosanta-menu`) en un iframe en `rosanta.rest/menu-completo`. Cambiar precios = editar `index.html` en GitHub, sin tocar Wix. **La altura del Embed HTML de Wix no se controla por Velo**: fija, 1019px escritorio / 832px móvil, con scroll interno.
- **SEO:** datos estructurados Restaurant + Menu en `/menu-completo`; se eliminó el `aggregateRating` auto-declarado (Google lo prohíbe); Bing Webmaster verificado; `llms.txt` editado a mano.

### 30 jul 2026
- **La identidad se llama "LA SEGUNDA COSECHA"**, no "La Segunda Floración" (obsoleto).
- **Documentos: fondo BLANCO y CERO cajas de texto.** El Crema sigue siendo fondo en redes/menús/flyers, pero en briefings, reportes, propuestas y guiones el fondo de color y las tarjetas redondeadas delatan "hecho por IA". Estándar editorial: tipografía, jerarquía y aire.
- **Meta (Andromeda): las variantes de un mismo video se tratan como duplicado.** Diversificar = videos conceptualmente distintos sobre UN mismo concepto, jamás el mismo material con otro gancho.
- **Panel de Asesores:** expertos reales verificables con link a su contenido, jamás personas inventadas, y nunca atribuirles citas (siempre "Lente X").
- **Rol "contenido" en la intranet:** ve solo Calendario, Creador Kaprica, Checklist y Manual, con permisos también del lado del servidor.

### 26 jul 2026
- **Anti-brand INTEGRADO a `rosanta-brand-guidelines`**: 5 pilares, el enemigo (trampa para turistas + barra de licuadora), los 4 filos, la flor, Fresco & Fuego · Urban Garden, arquetipo Cuidador/Explorador, frases firma, reglas de emojis. **Paleta HEX vigente:** Verde Bosque #4E6D5A, Verde Medio #57A77F, Lila #AEAAE2, Crema #F2EEEB, Negro #000000. (La pre-sprint #456B50/#4CAF7D/#A89DC8/#F0EDE6/#1A1A1A está obsoleta.)
- Desinstaladas: `xlsx-pro`, `pdf-pro`, `internal-comms`, `rosanta-recetario-costeo`. **`rosanta-eventos` DESCARTADA — no se creará. No reproponerla.**
- **SonTickets y GHL: cerrados.** Migración a WIX **ejecutada el 10 ago 2026**.

### 17 jul 2026
- **Bot WhatsApp/IG: COMPLETO.** WhatsApp vivo con token permanente (+502 3082-6935 en la API). Plantillas post-24h activadas. Messenger cerrado.
- **Notas de voz del bot: DESCARTADO** hasta que exista transcripción de audio nativa en Claude. No reproponerlo antes de eso.

---

## Quién es Juanma y qué es Rosanta

- Juanma Lemus, dueño de **Rosanta** ("Cocina con Carisma"), restaurante en Antigua Guatemala. Empresa: CORSAGA, S.A. Correo: restaurante@rosanta.rest. Sitio: rosanta.rest.
- Está en Plaza/Parque Santa Rosa ("Santa Rosa" vale solo como nombre del lugar físico y su parqueo).
- **PROHIBIDO usar "Jardín Santa Rosa"** — sub-marca descontinuada (jun 2026). Regla dura: nunca usarla.
- **Firma de marca: coordenada 14·91.** Forma oficial **14° N · 91° W**; corta **14·91 / #1491**. Igual en cada plato como sello, sin sufijos por platillo.
- Stack: todo interno con Google (Apps Script, Sheets, Drive) + Claude. Sin n8n, Make ni plataformas externas. GHL y SonTickets cerrados.

## Mapa de proyectos (estado al 15 sep 2026)

| Pilar / proyecto | Estado | Detalle |
|---|---|---|
| **Finanzas & Data OS** | ARRANCADO 2 sep. Maestro nativo validado 8/8 meses, cálculo nuevo (reglas 10–14), ~~forecast de caja~~ **HECHO** (pestaña Caja, @93). Falta: panel de integridad, registro de compra de mercado, documentar el cargador | `references/negocio.md`, `references/proyectos.md` §5 |
| **Profit OS** | En funcionamiento (S35). Recetario v14 nativo, inventarios integrados. Merma y SPLH diferidos | `references/proyectos.md` §2 |
| **Marketing OS** | En funcionamiento. Abierto: webhooks mudos, credenciales expuestas, encuesta a TripAdvisor | `references/marketing.md` |
| **Back office / Operations Hub** | **11 sep:** Rosanta OS es la puerta única (`_Codigo`/`_App`), 0 código en Drive, guardián vivo. Abierto: 1,0 GB en duplicados, 374 punteros, credenciales en texto plano | `references/ecosistema.md` |
| **Web Rosanta** | Sitio multilingüe ES/EN vivo, carta 2027 en POS. Abierto: hreflang (Wix no responde) | `references/marketing.md` |
| **Reservas / Ticketing (WIX)** | Migración COMPLETA (10 ago). Abierto: webhooks mudos 25 días + falta monitor de caídas | `references/marketing.md` |
| Bot WhatsApp/IG | COMPLETO desde 17 jul. Sin pendientes | `references/proyectos.md` §1 |
| Intranet/ERP | **El equipo está en la @98 (15 sep): pestaña Caja, food cost sin servicio, tarjeta real contra teórico, MARKETING_HONORARIOS. Batería 119 OK · 0 fallas · 0 avisos · 3 saltadas, las 3 identificadas. Abiertos 6 críticos de la auditoría del 14-sep (ver v15 §1).** Antes, al 14 sep: v88. Antes, al 12 sep: v81. Token verificado con Jeffry; el CRM con token queda **cerrado por decisión de Juanma**, con la batería de la v80 como evidencia. Abierto: Jose no probó su acceso, marcadores con la URL vieja `/a/macros/`, y 13 scripts de un solo uso viviendo en el proyecto vivo. | `references/proyectos.md` |
| Mejoras impacto real v2 | Activo: 8 palancas, Q280–390K/año | `references/negocio.md` |
| Eventos y grupos | Pilar continuo mes a mes (mejora #1) | `references/marketing.md` |
| Sistema Operativo / SIC | Mandala V4 + Ruta 2×3×5. Social = Niños de Guatemala + plato solidario | proyecto SIC (aparte) |
| Personal: UTG 42K | Plan de 15 semanas para la Ultramaratón Guatemala 42K (21 nov 2026). Artefacto `plan-utg-42k` | fuera de Rosanta |

Antes de trabajar en cualquiera, lee la sección correspondiente de `references/proyectos.md`.

## Datos maestros del negocio

`references/negocio.md`: mapa del "corazón de Rosanta" en Drive, menú, equipo y roles, SOPs, proveedores, **el DRE y los números vigentes**, y el CRM. `references/marketing.md`: audiencias (80% turista angloparlante / foodie local), estacionalidad (alta nov–dic), campaña activa, reputación y reglas de voz. Leerlos antes de cualquier tarea de negocio, contenido o análisis.

## Ecosistema: skills, artefactos y conexiones

`references/ecosistema.md` tiene el mapa de skills instaladas, herramientas locales, artefactos vivos, tareas programadas y el flujo que los conecta. Leerlo antes de crear contenido, paneles o documentos, para reutilizar en vez de duplicar.

## Reglas de trabajo con Juanma (siempre aplican)

1. **Confirmar la fuente de datos ANTES de construir.** Si un análisis depende de una pestaña/Sheet/export, preguntar primero si es la fuente vigente y cómo tratar huecos. Hoy la fuente financiera es el **Sheet nativo del maestro**, no el xlsx.
2. **NO mencionar la rotación de la API key de Anthropic.** Juanma pidió explícitamente que no se le vuelva a preguntar.
3. **Marca (FORMATO OBLIGATORIO de TODO diseño Rosanta):** anti-branding + storytelling, sin excepción. Toda salida pasa por `rosanta-brand-guidelines` (identidad) COMBINADA con `visual-storytelling-docs` (estructura). En documentos: **fondo blanco y cero cajas de texto**. Para copy: `rosanta-kaprica`. Cotizaciones: `rosanta-cotizador`. Finanzas: `rosanta-maestro`.
4. **Abogado del diablo:** cuando Juanma pida crítica sin filtros, aplicar el método completo de `abogado-del-diablo` — brutal con la idea, nunca con la persona.
5. **Rosanta NO hace delivery y NO vende brunch.** Nunca ofrecerlos.
6. **Calibrar el detalle:** explicaciones y diagnósticos cortos y directos; instrucciones técnicas que Juanma va a ejecutar, completas y paso a paso (skill `calibrar-respuestas`).
7. Respuestas concisas y en español.

## Cómo mantener vivo este cerebro

**Claude Code lo actualiza solo. No se le pide a Juanma que instale nada** — orden explícita del 11-sep-2026. La skill instalada es escribible desde la sesión; el procedimiento completo, con la ruta, está en `~/Dev/Rosanta/CLAUDE.md`, sección "Al CERRAR la sesión".

- Cuando Juanma diga "actualiza el cerebro", "guarda esto en el cerebro" o al cerrar una sesión con avances importantes: regenerar partiendo de la **instalada**, subir versión y fecha, escribir encima, verificar leyendo desde la ruta instalada, y sincronizar la copia de `~/Dev/Rosanta/rosanta-cerebro/` más el `.skill` de respaldo en `tools/`.
- Lo hace también la tarea programada **`rosanta-cerebro-mantenimiento`** (día 1 de cada mes, 9:00).
- Integrar lo nuevo de la memoria automática y del tablero `rosanta-seguimiento-semanal`.
- Marcar lo obsoleto como obsoleto en vez de borrarlo, para que Juanma vea qué cambió, **y marcarlo donde vive el dato** (la referencia), no solo en el SKILL.md.
- **Verificar contra las herramientas, no contra el propio cerebro:** `list_scheduled_tasks` y `list_artifacts` antes de dar por ciertas las tablas de `ecosistema.md`. Si una sesión retira una tarea o un artefacto, borrarlo de la tabla en el mismo movimiento.
- Si el cerebro contradice algo que Juanma dice hoy, **gana Juanma**; ofrecer actualizar el cerebro.
