# Auditoría de la intranet · 14 sep 2026

Alcance: los 74 archivos de `~/Dev/Rosanta/apps-script/rosanta-intranet` (21.074 líneas), contra el despliegue publicado **@85**. Solo lectura: no se tocó código ni se corrió clasp. Cada hallazgo se verificó leyendo el cuerpo de la función, no por el nombre. Lo que depende del contenido real de las hojas (zona horaria del maestro, formato de exports del POS, encabezados de RESUMEN CMV) queda marcado como **no verificado**.

Método: seis lecturas paralelas por área (núcleo y auth · costeo y recetario · precios, POS y ventas · inventarios · finanzas · marketing, CRM y batería), más un barrido global de funciones públicas contra las llamadas de las vistas. Los hallazgos de mayor gravedad se releyeron una segunda vez en el código antes de entrar aquí.

---

## Resumen

| Gravedad | Cantidad | Qué significa |
|---|---:|---|
| Crítico | 7 | pisa datos de producción o abre la puerta a cualquiera con la URL |
| Alto | 24 | un número que miente o una escritura que se puede corromper por el camino normal |
| Medio | 30 | rendimiento, condiciones de carrera, fragilidad |
| Bajo / limpieza | ~45 | código muerto, scripts de un solo uso, comentarios viejos |

Tres causas raíz explican la mayoría:

1. **Toda función global sin guion bajo final es una puerta.** El despliegue es `access: ANYONE` y `executeAs: USER_DEPLOYING`. Cualquiera que cargue la URL, aunque aterrice en "Esta puerta está cerrada", tiene `google.script.run` contra las **52 funciones públicas sin guarda**, ejecutadas como Juanma. La batería solo audita las funciones que las vistas nombran; las otras pasan en verde sin haber sido miradas.
2. **La meta y el food cost viven en varios lugares.** El 30 está en cuatro sitios del código y en una copia congelada en `METAS!META_FOOD_PCT`; ninguna pantalla de Profit OS lee `PARAMETROS!food_cost_objetivo_pct`. La ficha calcula bruto, el tablero neto.
3. **Escrituras que confían en el cliente.** El rol viaja desde el navegador en nueve funciones del recetario; Marketing OS reemplaza pestañas enteras con lo que haya en el localStorage del dispositivo; el inventario propone al Banco el precio del mes anterior, no el vigente.

---

## 1. Críticos

### C1 · Nueve escrituras del recetario aceptan el rol que manda el navegador
`EdicionRecetario.js:466,485,546,564,598,641,677,709` y `CrearFicha.js:68`. `agregarLinea(ficha, producto, cantidad, unidad, quien, rol, area)` solo hace `exigirPermiso_(rol, …)` con el `rol` recibido. Las envolturas `web*` de `EdicionWeb.js` resuelven la identidad bien, pero las funciones de abajo son públicas: desde la consola de la página Denied, `google.script.run.crearFicha({…}, 'yo', 'dueno', 'COCINA')` crea una pestaña en el recetario v14. El propio `EdicionWeb.js:9-13` describe este riesgo y lo cierra solo para una de las dos puertas.
**Arreglo:** sufijo `_` a las nueve (`agregarLinea_`, `crearFicha_`, …) y actualizar los llamadores de servidor (`EdicionWeb.js`, `InventarioDatos.js`, `SincronizarPrecios.js:228,595`, `Proveedores.js`, `InventarioImport.js`, `Pruebas.js:1376,1544-1565`).

### C2 · `fijarUrlIntranet(url)` es pública y sin guarda: secuestro de enlaces y tokens
`FijarUrlIntranet.js:26`. Valida solo prefijo `https://script.google.com/` y sufijo `/exec`; la web app de un tercero cumple. Escrito `INTRANET_URL`, todas las tarjetas del panel, los botones "Panel principal" y los enlaces que mintea `generarTokensUsuarios()` mandan `?u=<token>` a esa app. Devuelve además la URL real anterior.
**Arreglo:** `soloDueno_()` al inicio (throw si `getUsuarioActual()` no es rol `dueno`); no devolver `antes`.

### C3 · `aplicarSincronizacion` y `sincronizarPreciosDeCierre` escriben el Banco sin guarda
`SincronizarPrecios.js:191` y `:83`. La segunda devuelve fila y precio actual de cada insumo; con eso se pasa el candado de la primera y se escribe cualquier precio. Además `APLICAR_SYNC.js:48` es el único script de aplicación **sin bandera de confirmación**: su lista `APROBADOS` del 24 de agosto sigue viva y escribe el Banco como `'APLICAR_SYNC'`.
**Arreglo:** sufijo `_` a las dos (todos sus llamadores son de servidor); borrar `APLICAR_SYNC.js`.

### C4 · Marketing OS reemplaza pestañas enteras con el localStorage del dispositivo
`Marketing.html:626` (`store` llama `osAutoPush`) → `:659-663` (replace masivo 1,2 s después) → `MarketingDatos.js:187-209` (`clearContents` + reescribe). Es el mecanismo que borró el plan aprobado el 4 de agosto; se sacó `calendario` del mapa pero **piezas, carritos, aprendizajes, propuestas y debates siguen adentro**. El arranque (`:1793-1797`) solo trae el calendario de la hoja; las otras cinco pestañas se traen a mano con "Traer de la Sheet". Verificado en el código: en un navegador nuevo o incógnito, `seedProps()` (`:1587`) lee `[]`, agrega la propuesta de Vanessa y dispara un replace que deja `propuestas` con una sola fila. Vanessa registrando un carrito desde un dispositivo sin pull reemplaza `carritos`, que alimenta el webhook de Wix.
**Arreglo:** replace → upsert fila por fila (como ya hace `calUpsertRemoto`) y pull de las cinco pestañas en el init. Mientras tanto, quitar `osAutoPush` de `store`.

### C5 · "Registrar precio" escribe sin área: el ajo de barra pisa el ajo de cocina
`CosteoJs_Acciones.html:46` manda `{producto, proveedor, precioCompra, factura}` sin `ins.area`; `Proveedores.js:125` llama `ubicarEnBanco_(datos.producto)` sin área, recorre las áreas y gana COCINA. `registrarPrecio` tampoco llama `exigirArea_`: un rol de sala puede escribir en cocina. Es el bug que `EdicionWeb.js:65-71` dice haber cerrado el 27 de agosto, pero este botón, el que usa la gente, quedó fuera. Ocho insumos se llaman igual en las dos áreas.
**Arreglo:** mandar `ins.area`, `ubicarEnBanco_(producto, area)`, `exigirArea_(usuario.rol, area)`, y columna AREA en PRECIOS y en la bitácora.

### C6 · `LICORES` suma al COGS pero no entra en ningún techo de compra
`FinanzasDatos.js:69` lo incluye en `FIN_COGS_CATS`; `:103-107` (`FIN_AREA_CAT`) no lo tiene; `_compra()` (`:458-460`) lo descarta en silencio con `if (!area) return`. Una compra de Q8.000 de licor sube el food cost en "La semana" y no aparece en "Qué se puede comprar › Barra": el techo de barra (20) queda sistemáticamente subestimado.
**Arreglo:** `LICORES: 'barra'` (y su variante `_EFECTIVO` si existe) más una prueba que exija `FIN_COGS_CATS ⊆ keys(FIN_AREA_CAT)`.

### C7 · Fuga de lectura por funciones públicas sin guarda
Devuelven datos a cualquiera con la URL: `correrPruebas()` y `correrPruebasTexto()` (`Pruebas.js:1421,1492`) y `CORRER_PRUEBAS()` traen correos del equipo, IDs de documentos, `INTRANET_URL` y, si falla la prueba de tarjetas, un href con token; `verCostosFaltantes()` (fichas, costos y Banco); `historialDe()` (bitácora); `verEstadoRecetarios()` (IDs de todas las hojas); `metaDiagnosticoJson()` (gasto por campaña crudo de Graph); `getDashboard()`, `getIngenieriaMenu()`, `listarCorridasSync()`, `probarSincronizacion()` (costos y márgenes); `verificarNombresPOS(id)` **abre cualquier spreadsheet** legible por Juanma y devuelve tres columnas. Con módulo `marketing` (no dueño): `driveDescargar(fileId)` (`Servicios.js:42`) devuelve **cualquier archivo de Drive** en base64.
**Arreglo:** sufijo `_` a lo que ninguna vista llama; `soloDueno_()` a lo que se corre desde el editor; lista blanca en `driveDescargar` (o borrarlo: es código muerto).

---

## 2. Altos

### Puerta trasera (misma causa que C1-C3, C7)
- **A1** `migrarRecetarioCocina(fileIdXlsx)` (`ConvertirRecetarios.js:104`) repunta `RECETARIO_COCINA_SHEET_ID` a cualquier xlsx que pase `verificarVlookups_`. Borrar el archivo.
- **A2** `importarInventario()` (`InventarioImport.js:377`) es un segundo motor de precios: escribe PRECIO, PRECIO COMPRA y PROVEEDOR en el Banco leyendo las hojas **viejas** (julio), sin regla del 10 %, sin corrida en SYNC_PRECIOS (no se deshace). Contradice el encabezado de fase 3. Archivar junto con `InventarioMigracion.js` (714 líneas, ya corrió el 12-sep).
- **A3** Escrituras y quema de cuota disparables por cualquiera: `instalarMetas`, `instalarRAA`, `generarTokensUsuarios` (mintea tokens), `regenerarIndice`, `refrescarResumenBitacora`, `cargarVentasPorProducto`, `refrescarSemaforoPrecios`, `calentarCaches` (40 s de CPU), `probarCosteo`/`DIAGNOSTICO` (borra el caché del recetario: todos vuelven a los 40 s fríos), `reporteHigiene` (40 s), `habilitarModulosDueno`, `setupInicial`, `latido`.
- **A4** La prueba "Toda llamada de las vistas verifica identidad" (`Pruebas.js:876-935`) solo mira funciones referenciadas desde vistas y busca el texto de la guarda **sin quitar comentarios**. Nueva prueba: enumerar `globalThis`, exigir guarda real o sufijo `_`, con lista blanca explícita.

### Datos que se pisan por el camino normal
- **A5** El inventario abre el mes copiando el PRECIO del mes anterior, no del Banco (`InventarioDatos.js:258-261`); al cerrar, si difiere < 10 % del Banco entra automático (`:1000-1005`). Jeffry sube el ajo en Productos el día 5; el cierre del 30 lo devuelve al precio viejo con bitácora "sync". Un precio **rechazado** vuelve a proponerse cada mes. Arreglo: al abrir, tomar el precio del Banco para los INSUMO conectados.
- **A6** Dos fuentes de propuesta de precios conviven: el semáforo mensual lee `INVENTARIO_CIERRE_SHEET_ID` (xlsx convertido a mano, `SincronizarPrecios.js:91`); la intranet ya aplica al cerrar mes. Si la intranet subió el lomito y el xlsx viejo dice el precio anterior, el semáforo propone "bajarlo" y `APLICAR_SEMAFORO` lo devuelve. Una sola fuente: que el semáforo lea el último mes CERRADO del inventario, o retirar el activador.
- **A7** Los exports del POS se procesan en el orden que devuelve Drive (`VentasPorProducto.js:415-436`, sin `sort`). Los exports son acumulativos y `escribirVentas_` reemplaza por rango: si S37 completo entra antes que S36 acumulado (con 7-8 sep parciales), esos dos días quedan parciales para siempre. Ahora que la carga es automática, ocurre solo. Ordenar por fecha ascendente antes del bucle.
- **A8** `PROVEEDORES` tiene dos esquemas: `Proveedores.js:32-34` crea `PROVEEDOR | ALIAS_EN_BANCO | CONTACTO | …`; `EdicionRecetario.js:685,698` escribe `nombre | nit | contacto | …`. El NIT cae en ALIAS_EN_BANCO y `aliasProveedores_()` lo vuelve alias. Además el proveedor creado no aparece en la pestaña ni en el datalist: "Crear" parece no hacer nada.
- **A9** Inyección de fórmulas desde CSV: `CrmDatos.js:246` y `MarketingDatos.js:178,179,203` escriben strings del navegador tal cual; una celda `=IMPORTRANGE(…)` queda como fórmula en la maestra. Anteponer `'` a lo que empiece por `= + - @`.
- **A10** Reactivar un producto de barra migrado falla: `ULTIMO MES` se escribió sin formato texto, Sheets lo guarda como fecha, `invTexto_(Date)` no matchea `^\d{4}-\d{2}$` (`InventarioDatos.js:493,733`). Se arregla solo tras el primer cierre.

### Números que mienten
- **A11** Meta de food cost en dos lugares otra vez: `instalarMetas()` congela `_finMetaFood()` en METAS y `_finMeta` (`FinanzasDatos.js:759`) prefiere `META_FOOD_PCT` sobre PARAMETROS. Si Juanma cambia PARAMETROS a 28, "La semana" y el RAA usan 28, la tarjeta de Metas sigue en 30. La prueba 1 de `PruebasFinanzas.js` no compara `getMetasData().meta_food` contra `d.meta_cogs`.
- **A12** Profit OS tiene tres food cost: fichas, tarjetas, higiene y "Precio para llegar a 30 %" usan precio **bruto** (`CosteoJs_Base.html:90`, `CosteoDatos.js:268`, fórmulas que escribe `CrearFicha.js:147-149`); tablero e ingeniería usan **neto /1,12** (`IngenieriaMenu.js:302,342`). Mismo plato: 26,5 % "en meta" en la ficha, 29,7 % en el tablero. La ficha marca "alto" solo si supera meta+5; el tablero cuenta cualquier exceso. El 30 está en `ConfigCosteo.js:16,125`, `CrearFicha.js:21` y en fórmulas de hoja; **ninguno lee PARAMETROS**. Barra: ficha meta plana 20, tablero 20-35 por categoría. Decidir neto, calcular una vez en servidor, metas desde PARAMETROS.
- **A13** Semanas con venta < Q1.000 se descartan (`FinanzasDatos.js:639`) y la móvil de 4 se calcula sobre índices consecutivos, no semanas consecutivas (`:651-656`). El COGS de esa semana no entra en ninguna semana. Con un cierre por vacaciones pasa seguro.
- **A14** Meses sin planilla: el total del año suma `labor = igss` solo (`:567-569,600-615`) y mejora prime cost y resultado; la semana usa `29000` mágico (`:640`). Dos bases en la misma pantalla.
- **A15** Ninguna normalización de fechas en los cortes de Finanzas (`:314-320,418-434,474-547`): si la zona horaria del maestro difiere de la del script, una venta del 31 a las 23:00 cambia de semana y de mes. Ventas por producto resta 6 h fijas (`VentasPorProducto.js:77-96`). **No verificado** contra la hoja; el desfase p120 ya se vio en el maestro.
- **A16** `avisoPrecios_` (`Dashboard.js:387`) compara contra `POS_CATALOGO_SHEET_ID` fijo, no contra `catalogoInfo_().id`: el aviso "N platos con precio distinto" sale contra un export viejo. Mismo error en `Pruebas.js:690`.
- **A17** La ventana de ingeniería de menú se ancla al último día cargado (`IngenieriaMenu.js:497-503`), incluido un día parcial: con carga automática, "4 semanas" puede terminar en miércoles y la popularidad se mueve. Anclar al último domingo.
- **A18** Un cierre sin precios numéricos da `inv = {}` → 0 cambios → semáforo AL DÍA sin vigilar nada (`SincronizarPrecios.js:98-111`, `SemaforoPrecios.js:95`).
- **A19** Un solo módulo `finanzas` para dos audiencias: para que Jeffry y José vean su techo de compra en Metas hay que darles `finanzas`, y con ese token `getFinanzasData(AUTH)` devuelve gasto personal del socio, devoluciones, saldos bancarios y planilla. Módulo `metas` aparte.
- **A20** Estados del calendario de Marketing que el modal no conoce (`Marketing.html:879` "Producción", `:1103` "Listo" vs select `:555-558` "Lista"): al editar, la pieza validada cae en "Idea" y `genPlan` la borra como regenerable.

### Rendimiento que se siente
- **A21** Cada escritura del recetario cuesta ~40 s (invalidar caché + `location.reload()` + modelo frío); registrar precio ~80 s (`Proveedores.js:163-165` reconstruye sin cachear y la vista recarga). Alta de insumo desde inventario: igual. Arreglo mínimo: cachear el modelo reconstruido; real: parchear `R[]/I[]` en el cliente con lo que devuelve el servidor.
- **A22** Los avisos del tablero no se piden en el camino normal: cuando el prefetch de `CosteoVista.html:183-195` ya llenó el caché, `pedirProfitOS` (`CosteoJs_Pintar.html:19-21`) sale sin llamar `pedirAvisos()`, que solo se invoca en los handlers de una llamada real (`:28,34`). La franja queda en "Buscando avisos…". Regresión del 14-sep. Llamar `pedirAvisos()` en `aplicarProfitOS`.
- **A23** `Utilities.formatDate` por fila en `crmContactos` (`CrmDatos.js:64-67,105-107`, tres veces por contacto, maestra de miles) y en `mktNormalize_` (`MarketingDatos.js:130-133`). Es el patrón que costó 10-97 s en `fechaVenta_`.
- **A24** `cargarVentasPorProducto` retiene el `ScriptLock` global durante toda la carga (listar Drive, convertir, leer, escribir) y lo comparte con inventario, Marketing y CRM (`VentasPorProducto.js:405`): el activador arranca y Jeffry recibe "Alguien está guardando" tras 20 s. Candado solo alrededor de `escribirVentas_`.

---

## 3. Medios

**Concurrencia y escrituras**
- M1 Ninguna escritura del recetario usa `LockService` (inventario y ventas sí). `agregarLinea` elige "primera fila libre" (`EdicionRecetario.js:514-527`): dos personas en la misma ficha se pisan sin error. `crearInsumo` (`:619 getLastRow()+1`) y `bitacoraLote_` (`:369`) igual.
- M2 `agregarLinea` no es idempotente: un reintento tras timeout duplica la línea.
- M3 `quitarLinea` borra las fórmulas E y F (`:556`); una línea escrita a mano después vale Q0. Limpiar solo B:D.
- M4 Alta de inventario no atómica: crea en el Banco antes que catálogo y mes (`InventarioDatos.js:427-447`); un fallo a mitad deja duplicado al reintentar. "No está: crearlo" sobre un producto ya conectado también duplica (`:528-551`).
- M5 `invGuardar_` compara contra la hoja, no contra lo que el cliente veía (`:321-336`): A y B guardando el mismo producto, gana el último sin aviso.
- M6 Cerrar con existencia > 0 y precio vacío valúa en 0 sin aviso (`:917`).
- M7 Cerveza: precio por lata contra presentación "caja de 24" → propuesta de −96 % cada mes; destilados "750 ml" vs "botella" nunca coinciden y quedan en `unidadDistinta` para siempre.
- M8 Aprobar/rechazar precios por número de fila (`:1128-1141`): si alguien ordena la hoja entre cargar y clicar, se aprueba otro producto.
- M9 `guardarRaa` sin lock (`RaaDatos.js:272-278`): dos guardados simultáneos apilan filas.
- M10 `VentasPorProducto.js:376-377` `clearContent()` + `setValues()` de 10 k filas sin respaldo: un timeout entre las dos deja VENTAS x PLATO vacía media hora.
- M11 `SincronizarPrecios.js:209,223-225` y `:516,541-545`: 1 `getValues` + 3 `setValue` por cambio (240 llamadas con 60 cambios).
- M12 `SemaforoPrecios.js:159` `h.clear()` antes de reconstruir: si falla a mitad, los tildes se pierden.

**Lógica**
- M13 `tocada()` marca todos los pre-elaborados como afectados en cualquier simulación (`CosteoJs_Base.html:127-131`), y el servidor les aplica merma del 10 % que la hoja no aplica (`CosteoDatos.js:207,261`).
- M14 Semana ISO sin año en cuatro lugares: `Latido.js:124-133` (desde enero 2027 el monitor de pauta no vuelve a avisar), `Marketing.html:1184-1193` (S1-2027 se pisa con S1-2026), `FinanzasDatos.js:314-320` (1-3 ene 2027 = S53 y se vuelve "última semana"), `RaaDatos.js:35` (RAA sin ANIO).
- M15 Comparativo hardcodeado a 2026 y `FIN_HOJA_2025` (`FinanzasDatos.js:1042`); el 1 de enero compara 2027 vacío contra 2025.
- M16 `Es_Personal` solo reconoce `'Sí'` exacto (`:485`); `SI`, `si`, `sí ` entran al DRE como gasto del negocio.
- M17 `_finNum` convierte "1,234.50" en 0 sin contar (`:322`); caja en texto → `dias_caja = 0` → RAA rojo con acción obligatoria (`:547`).
- M18 "Actualizar datos" no refresca PARAMETROS ni tipo de cambio (caché 6 h, `:126-153,383`).
- M19 Categorías del POS contra `COSTEO.metasBarra` sin normalizar (`IngenieriaMenu.js:223`); cocina con ficha toma categoría del recetario y sin ficha del POS (`:212,253`): la misma categoría se parte y el umbral 70 % se calcula sobre mitades. **No verificado** contra datos.
- M20 Un mes con gasto y sin venta desaparece del DRE (`FinanzasDatos.js:560`); UNIFORMES se evapora (`:269,569`); Metas mide ritmo por días calendario y no por días operados (`:936`).
- M21 `metaDiagnosticoJson` para usuarios con token siempre falla en el paso `mapeado` (`Servicios.js:225` sin auth); Graph `v19.0` vencida (`:68,255`).
- M22 XSS con contenido de terceros en Marketing: `page_name` y títulos de la Ad Library en `innerHTML` sin escapar (`Marketing.html:1485-1488,787,929,834`).
- M23 Errores tragados: `osAutoPush` `.catch(()=>{})` (`:662`): un rol contenido con `puede_editar=NO` guarda solo en localStorage sin aviso.

**Rendimiento y caché**
- M24 `resolverUsuario_` abre el Sheet de config y lee USUARIOS entera en **cada** llamada de `google.script.run` (`Config.js:74,108`): +300-500 ms por petición. Cachear 60-120 s.
- M25 `cargarVentasPorProducto` borra `COSTEO.cacheKey` (`VentasPorProducto.js:496`) aunque el modelo no lee ventas: cada export nuevo manda a alguien a los 40 s.
- M26 `finanzas_v4` no lo calienta `calentarCaches`; el payload de Finanzas puede superar los 100 KB de `CacheService` y entonces `cache.put` falla en silencio y cada apertura recalcula (`FinanzasDatos.js:376-378`). **No medido.**
- M27 `loadMeta()` hace 2 `UrlFetchApp` a Graph en cada apertura de Marketing OS, sin caché.
- M28 `Marketing.html` (142 KB, 1.802 líneas en una vista): el rol contenido recibe ~50 KB de JS de pauta y panel que no puede usar. Se puede partir con `incluirCrudo_` como CosteoVista.
- M29 `Latido.js` abre el Sheet de Marketing cuatro veces por corrida.
- M30 `SincronizarPrecios.js:272` `Drive.Files.copy` sin `supportsAllDrives` (la línea 254 sí lo pasa).

---

## 4. La batería de pruebas: qué no prueba

- Solo evalúa `Index` y `CosteoVista` vía `doGet`; el resto lo lee crudo.
- Solo audita funciones **referenciadas desde vistas**; las 52 públicas sin guarda quedan fuera.
- `GUARDA` busca texto en `String(fn)` sin quitar comentarios.
- Pasan en verde sin probar nada: "CRM (crmContactos)" `n >= 0` (`Pruebas.js:1270`), "Proveedores" cualquier objeto truthy (`:1264`), "Lo que escribe en lote no está en el desplegable" (comprueba su propia lista, `:1532-1540`), "Candado de unidad" (`:1288`), "Un token inventado no entra" (`:1403-1412`), los dos rechazos del RAA (`PruebasFinanzas.js:246,258`: cualquier excepción cuenta como rechazo, y con token la primera excepción es "No pude identificarte").
- Frágiles por texto literal: `'reconstruido: nada'` (`:805`, **no lo encontré en `CalentarCaches.js`**: puede estar fallando hoy), `'areaDeLaPagina_(area, u)'` con espacio exacto, `'a.nativa'`.
- La lista `VISTAS` está copiada tres veces (`:302,881,975`).
- Cero pruebas de inventario (fase 2 y 3 salieron a v85 sin cobertura), Metas, Comparativo, `_finSemanaISO`, la regla /1,12, la exclusión EVENTO, la móvil de 4. Todo el grupo 8 corre contra datos vivos: ninguna prueba distingue "la regla está bien" de "hoy no hay un caso que la ejercite".

---

## 5. Limpieza

**Borrar**
- `APLICAR_SYNC.js` (C3). `_logo_tmp.txt`, `PROMPT_CODE_2026-08-24.txt`, `PROMPT_PARA_CLAUDE_CODE.txt` (no suben, estorban).

**Archivar en `_archivo/` (ya corrieron o están reemplazados)**
- `InventarioMigracion.js` (714 líneas, corrió 12-sep), `InventarioImport.js` (A2), `ConvertirRecetarios.js` (no-op mientras existan las propiedades; A1), `APLICAR_BARRA.js` (26-ago), `REVERTIR_SYNC.js` (reemplazado por `webInventarioDeshacerPrecios` con guarda de dueño), `Diagnostico.js`, `DIAG_COSTOS.js`, `EstadoRecetarios.js`, `REGENERAR_INDICE.js`, `CORRER_PRUEBAS.js`, `habilitarModulosDueno` de `Setup.js`. Mejor: carpeta `_scripts/` ignorada en `.claspignore` y pegar en el editor cuando se usan.

**Funciones muertas (0 llamadores)**
`getDashboard`, `getIngenieriaMenu`, `refrescarCosteo`, `probarEdicion`, `mktReadAll`, `driveBuscarReportes`/`driveDescargar` y su cliente (`Marketing.html:1149-1171`), `webCambiarPrecioInsumo`/`webBuscarSimilares`/`webContenidosTipicos`/`webProbarConversion` (solo Pruebas), `ventanaVentas_`, `pestanaDeFicha_`/`esCocinaPOS_`/`ignorarEnVentas_`, `metaDiagnostico`, `tipoIcon`/`osConnected`/`osRenderConn` en Marketing.

**Otros**
- CSS muerto en `CosteoEstilos.html`: el bloque 41-199 está casi entero pisado por 200-310.
- IDs duplicados o en código: `MKT_SHEET_ID` en `Latido.js:40` y `MarketingDatos.js:12`; `RESENAS_SHEET_ID`, `AD_ACCOUNT_ID`, `FIN_MAESTRO_ID`, `FIN_PLANILLA_ID`, carpetas de `VentasPorProducto.js:28-29`, mientras el resto vive en Script Properties.
- Comentarios falsos: `Setup.js:80-81` ("sus IDs están en Config.gs"), `Servicios.js:13` (`README_FASE_A.md` no existe), `InventarioDatos.js:2` y `CosteoVista.html:32` ("solo lectura"), `HigieneGuia:23` ("cada quince minutos"; es 1 h), pie de Profit OS con "meta 30 %"/"meta 20 %" hardcodeados (`CosteoJs_Acciones.html:281-282`).
- Convención: `Servicios.js` y `MarketingDatos.js` llevan el token **último**; `DIAG_COSTOS.js` tiene `_dcQ` con guion bajo delante (pública).
- Manifiesto y `.claspignore`: correctos. Scopes cuadran con el uso real. Sin secretos en código.

---

## 6. Orden de ataque propuesto

1. **Cerrar la puerta trasera** (una sesión, sin tocar comportamiento): sufijo `_` a todo lo que ninguna vista llama; `soloDueno_()` a lo que se corre desde el editor o activador; prueba nueva que enumere `globalThis` y exija guarda o lista blanca. Cubre C1, C2, C3, C7, A1-A4.
2. **Marketing OS**: replace → upsert y pull en el init (C4). Estados del calendario (A20). Escape de terceros (M22).
3. **Profit OS, cinco arreglos de una línea cada uno**: área en registrar precio (C5), `pedirAvisos()` en `aplicarProfitOS` (A22), `catalogoInfo_().id` en `avisoPrecios_` (A16), `sort` por fecha en exports (A7), borrar `APLICAR_SYNC` (C3).
4. **Inventario**: precio de apertura desde el Banco (A5); una sola fuente para el semáforo (A6); `ULTIMO MES` como texto (A10).
5. **Finanzas**: `LICORES: 'barra'` (C6); `_finMeta` sin META_FOOD_PCT (A11); semanas y móvil (A13); meses sin planilla (A14); módulo `metas` aparte (A19).
6. **Una sola meta y un solo food cost**: neto en fichas, meta desde PARAMETROS, cálculo en servidor (A12).
7. **Limpieza** (sección 5) y `LockService` en el recetario (M1-M3).
8. **Rendimiento**: parchear el modelo en cliente en vez de recargar (A21), cachear USUARIOS (M24), candado acotado en ventas (A24).
9. **Batería**: fixtures sintéticos para Finanzas y pruebas de inventario (sección 4).

---

## 7. Propuestas: KPIs y visuales

Todo lo que sigue se calcula con datos que **ya existen** en las hojas, salvo donde se dice qué falta. Ordenado por lo que más cambia una decisión.

### Profit OS

| KPI / visual | Con qué datos | Qué decisión apoya |
|---|---|---|
| **CMV real vs teórico por área y mes** (el tile que hoy dice "Falta") | inventario inicial y final (ya, desde el cierre de mes), compras FEL por categoría → área (ya), ventas (ya). Falta: compras de mercado sin factura; `registrarPrecio` ya pide factura: pedir también **cantidad** y guardarla en PRECIOS | Merma implícita = real − teórico. Enciende el indicador que justifica el pilar. Merma quedó diferida como módulo; pero el dato por área ya se puede inferir |
| **Matriz de ingeniería con migración** (flecha desde la ventana anterior) | dos corridas de `ingenieriaDeMenu_` | qué plato cambió de cuadrante esta semana |
| **Margen de contribución total semanal, móvil 4** | ventas × costo firme | erosión de margen antes de que la vea Finanzas |
| **Food cost teórico ponderado por mix, semanal**, descompuesto en "efecto precio de insumos" y "efecto mix" | `cmvPonderado` por semana + BITACORA/SYNC_PRECIOS | si el CMV sube, ir a compras o a sala |
| **Exposición por insumo** (Σ cantidad × precio × unidades vendidas) y "un +10 % en este insumo mueve X puntos" | INDICE_INSUMO_RECETA × ventas | dónde negociar; hoy el semáforo ordena por % y una especia pesa igual que el lomito |
| **Cobertura del costeo (%)** con tendencia | RESUMEN CMV | el punto ciego baja o no |
| **Precios viejos ponderados por costo vendido** ("Q del costo vendido apoyado en precios de más de 60 días") | PRECIOS + BITACORA + ventas | qué precios pedir al proveedor |
| **Colchón de precio por plato** (`precioNeto − costo/meta`, en Q) | RESUMEN CMV | qué precios de carta tocar; es `vsMeta` por unidad |
| **Costo subió desde el último cambio de precio** | BITACORA `cambiarPrecioMenu` vs costo actual | repricing por deriva |
| **Elasticidad simple**: uds/día 4 semanas antes y después de cada cambio de precio, con su categoría como control | BITACORA + VENTAS x PLATO | sostener o revertir; declarar en pantalla que son pocos eventos |
| **Cortesías (Q0), anuladas y descuento % por semana y vendedor** | ya en el export, hoy se descartan (`VentasPorProducto.js:304-308`) | control de sala; primera pista del hueco real vs teórico |
| **Vendidos sin ficha con Q y unidades**, enlazados a Crear ficha | `sinEquivalencia` + `sinCosto` | qué ficha escribir primero |
| **Ticket medio, platos por ticket y mix por día de la semana** | doc id + fecha + cantidad | preparación y upsell por día |
| **Inventario**: valor por área y categoría (serie mensual), días de cobertura por insumo (existencia / consumo teórico diario), Pareto de insumos por costo, calidad del conteo (% sin contar, sin precio, sin conectar) | cierres + ventas + recetas; mínimo por producto requiere columna nueva | qué comprar el lunes, qué contar semanalmente (el 20 % que pesa) |

### Finanzas & Data

| KPI / visual | Con qué datos | Qué decisión apoya |
|---|---|---|
| **Piso Q18.896 y objetivo Q27.229 contra lo que deja la operación**, mes a mes con móvil de 3 | `meses[].neto`; guardar los dos umbrales en PARAMETROS | si Juanma puede retirar este mes y cuánto. Hoy `pers` y `dev` se leen y no se contrastan con nada. Es el N1 abierto (p122) |
| **Caja proyectada 30/60/90** | `caja` + proyección de venta de Metas − `gasto_dia` × días; faltan CxP (declararlo) | adelantar o frenar compras y retiros (p94) |
| **Sparkline de caja semanal** junto al semáforo de días de caja | `semanas[].caja`, ya existe | bache o tendencia |
| **Tendencia 13 semanas food/prime móvil 4** (línea; hoy solo tabla) | `cogs_m4`, `prime_m4` | disparar el RAA por pendiente, no por nivel |
| **Waterfall del DRE anual** | `total.ventas` → COGS → cada bloque → neto | qué bloque se lleva el resultado |
| **Heatmap 12 × 9 de gasto operativo por bloque vs banda** | `meses[].bloques`, ya viaja | exceso estructural o de un mes |
| **Ventas y comensales por día de la semana** (8-13 semanas) | acumulador en el bucle de ventas, cero lecturas extra | dónde apretar reservas, qué día hacer evento |
| **Ticket por cuenta vs ticket por comensal** y personas por cuenta | ambos disponibles | más mesas o mesas más grandes |
| **Punto de equilibrio diario y comensales/día** | `bev / días operados`; requiere `dias_cierre` en PARAMETROS | meta diaria para sala, en lenguaje de mesas |
| **Compra vs techo acumulado por área, semana a semana** | `compra[area].mes` + partir por semana | la decisión del lunes: cuánto llevar al mercado |
| **Costo del IVA no recuperado** (`efectivo × 12/112`) | integridad | cuánto vale formalizar la compra sin factura |
| **Semana contra la misma semana de 2025** | si `02b_Ventas_2025` trae fecha por fila (**no verificado**) | quitar estacionalidad del Δ semanal |

### Marketing y CRM

| KPI / visual | Con qué datos | Qué decisión apoya |
|---|---|---|
| **Embudo semanal lead → reserva → visita → cliente nuevo** | Conversaciones, reservas (Wix), `pauta_semanal`, carritos | dónde se cae la gente; presupuesto a alcance o a cierre |
| **ROAS y CAC por semana, 8 semanas, con gasto Google/Meta apilado** | `pauta_semanal` (hoy solo se muestra la última semana) | escalar o apagar por tendencia. Etiquetar "blended" mientras el ROAS atribuya el 100 % de reservas a medios |
| **Reseñas por semana + móvil de 4** (Google/TripAdvisor) | Control de Reseñas GBP, encuesta | correlar con piezas publicadas; activar la skill de reseñas cuando cae |
| **Tasa y tiempo de primera respuesta del bot** | timestamps de Conversaciones | cuándo hace falta humano en la consola |
| **Recurrentes vs nuevos por mes y LTV simple por segmento** | maestra (`ultima_reserva`, `fecha_alta`, `gasto_gtq`, `segmento`) | techo del CAC; a quién retener en enero-febrero |
| **Recuperación de carritos por toque (1/2/3) y canal** | `carritos` | si el toque 3 aporta o quema el número del bot |
| **Calendario vs realidad** (cumplimiento martes/viernes, piezas muertas en checklist) | `calendario.estado`, `piezas.score` | cadencia real de contenido |

### Visual, transversal
- Mostrar en la ficha CMV neto y bruto con el criterio del tablero; convertir Higiene en tiles con %; sparklines por insumo en el cajón del producto (el historial ya se lee ahí).
- Ninguna pantalla de Profit OS tiene una serie temporal, nada por insumo en el tablero, y ningún número es descargable: agregar "descargar CSV" a las tablas de ingeniería y de insumos.
- Devolver `zona` (verde/ámbar/rojo) desde el servidor en Finanzas: hoy los umbrales 60/65, 21/7 y −10 están duplicados en `RaaDatos.js` y `FinanzasVista.html`.

---

*Verificado dos veces en código: C1-C7, A5, A7, A16, A22, la ausencia de `sort` en la carga de exports y que `pedirAvisos()` solo se llama desde los handlers de una llamada real. No verificado: contenido real de USUARIOS, zona horaria del maestro, formato de los exports, encabezados de RESUMEN CMV, respuesta real de Graph, si `INVENTARIO_CIERRE_SHEET_ID` se sigue actualizando.*
