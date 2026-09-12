# Proyectos de Rosanta — detalle (act. 6 sep 2026)

Los proyectos se organizan en el **Rosanta OS de 6 pilares**: Marketing OS, Profit OS, Finanzas & Data OS, Back office/Operations Hub, Web Rosanta, Reservas/Ticketing (WIX). Drive está reorganizado igual.

---

## §1. Bot de WhatsApp + Instagram — COMPLETO

Bot que atiende WhatsApp e IG con Claude y registra leads clasificados en Google Sheet. Arquitectura: Meta → Google Apps Script → Claude → respuesta + Sheet. Todo interno.

**Infraestructura:**
- Apps Script standalone "Bot Rosanta". Webhook: `https://script.google.com/macros/s/AKfycbw0PnfbHHtxaCH8tZtYT0yMHFAsT1h2uZXZ1pz2GC_wiaOAWD8CZ5WoU2DVwtpK0DvIAg/exec`
- VERIFY_TOKEN: `rosanta-verifica-2026`. `WEBHOOK_SECRET` + `?token=` en la Callback URL. API key en Script Properties, nunca en memoria ni archivos.
- Sheet de leads: `1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc` (pestaña "Leads"). Base de conocimiento: `1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I`.
- App Meta "Bot Rosanta" (App ID 1885303292873087, business_id 1509242976228027), Live. IG @rosanta.rest (IG ID 17841457201371788), token IGAA con refresco automático los lunes 9:00.
- **WhatsApp: número +502 3082-6935 en la API con token PERMANENTE.** La app de WhatsApp Business fue eliminada del teléfono. Plantillas post-24h activas.

**Funcionando:** IG y WhatsApp end-to-end; respuesta humana desde la hoja (col M respuesta, col L destino, col N enviado, trigger cada 1 min); anti-loop `dentroDeLimite()` (15 msg/contacto en 3 min); pausa de 6h al responder humano; alertas por correo a restaurante@rosanta.rest en leads `urgencia:caliente`, `tipo:evento`, `tipo:queja` o `requiere_humano:true`, con bloque "PARA COTIZAR" cuando es evento.

**Reglas:** detecta idioma es/en; **NO toma reservas por chat** (redirige a rosanta.rest/reservas y /reservations); eventos escalan a Juanma; no inventa fuera de la base de conocimiento.

**Pendientes:** ninguno.
- ~~Migrar WhatsApp~~ HECHO (17 jul).
- ~~Messenger~~ HECHO — cerrado.
- ~~Notas de voz~~ **DESCARTADO** hasta que haya transcripción de audio nativa en Claude. No reproponerlo.
- ~~Retirar GHL~~ HECHO (12 jul).
- Vigilar App Review de Meta si crece el volumen.

**Uso nuevo del bot como sensor:** el conteo de escalaciones a WhatsApp sirve de proxy de caídas del sistema de reservas. 46 escalaciones en siete días fue la única señal de que las reservas estaban caídas (ago 2026). Ver §6.

**Lecciones (no repetir):** el prefill de JSON en `askClaude` ROMPIÓ el bot (doble `{`) — no perseguirlo. Un loop con otro bot de IG gastó créditos; si reincide, bloquear la cuenta en IG.

---

## §2. Profit OS — recetario, costeo e inventarios

En funcionamiento desde S35 (ago 2026). Sustituye al arreglo anterior de "recetario dentro de la intranet" y absorbió los inventarios, que dejan de ser un sistema aparte. Se cerró un bloque de **33 pendientes** arrastrados desde el 22 ago.

- **Fuente definitiva del recetario: hoja nativa v14** `1oxVJIaplR7Ofk4_lYgvIsOMBonUGrcoDa0J099vnlxg`. 33 platos mapeados; los VLOOKUP contra el Banco de Datos sobrevivieron la conversión.
- Hojas nativas previas: Barra `1LeoX3xpemoYEj130qnTTMzn4OCgLsZx1PvPRW-2LRnk`, Cocina `14PY5v69esGokwKEjB5PEjXQsgI_9-t633S8-oO26vOU`. **Las nativas mandan**; los xlsx son respaldo. Ojo: el recetario de barra apareció en la papelera el 10 sep 2026 — verificar que siga vivo antes de leerlo.
- **Banco de Datos limpiado** con `LIMPIAR_DOC.gs`: PREJIL→Perejil, PIMENTA NEGRA→Pimienta Negra, 4 duplicados borrados, con RESUMEN CMV idéntico antes y después.
- **MAPA POS de la v14 ejecutado:** 5 productos retirados, 7 activos sin ficha resueltos, 2 altas (Mousse y Peras, ~Q1,145/semana que se cobraban a mano).
- **Costeo de barra completo:** CMV por producto, cócteles con costo real del Recetario de Barra v5, costos de compra desde el Inventario Barra 2026 (costo por trago, copa y unidad).
- 125 recetas costeadas históricas (56 barra CMV obj 20%, 69 cocina CMV obj 30%).
- Especificación técnica: `2026-08-21_Profit_OS_Especificacion_Tecnica_v1.md`.

**DIFERIDOS por Juanma el 3 sep — no reproponer hasta que él lo decida:**
- **SPLH** (ventas por hora-hombre): imposible hoy, no se registran horas por turno ni por área y la planilla es mensual. El Tech Stack Audit lo marcaba como el gap #1 del stack. Hoja ya especificada: FECHA · TURNO · AREA · HORAS · VENTAS NETAS · SPLH · # COLABORADORES.
- **MERMA**: no existe ningún dato. Referencia de sector: bajo 2% de la venta. "Un mes no dice nada, tres sí". Hoja especificada: FECHA · TURNO · AREA · PRODUCTO (validado contra Banco de Datos) · CANTIDAD · UNIDAD · COSTO Q · MOTIVO · QUIEN REGISTRA. La captura tiene que tomar menos de diez segundos o nadie la usa.

**Abierto:** consolidar las compras dispersas de `04_Profit_OS/Proveedores/Historico_Compras/` para poder separar cuánto de la brecha de 9 puntos de CMV es fuga y cuánto es movimiento de inventario.

### Pendientes de cocina (decisión de Juanma: los trabaja cocina, no dirección)

Recetas, precios, costos, fichas y productos faltantes son responsabilidad de cocina. Al 10 sep 2026:
- **9 recetas de cocina sin costo**, de 75. Barra completa: 0 de 56.
- **2 platos del POS sin ficha:** Lomito Niños y Pasta Niños.
- **40 líneas fuera del banco**, 6 insumos sin proveedor, 2 sin precio de compra.

### Pendientes de dirección

- **Los 3 precios de cierre:** Pimienta, Camote, Papa.
- **La decisión sobre "deshacer"**, pendiente desde el 25 ago 2026.

---

## §3. Intranet / ERP

Web app Apps Script; Sheets/Drive como fuente de verdad; responsive.

**Estado al 12 sep 2026: v81 publicada (verificado con `clasp list-deployments`). Batería 88 OK · 0 fallas · 0 avisos · 2 saltadas (90).**
El número de versión envejece en horas (76 → 81 en una tarde): **verificar con `clasp list-deployments`**.
- **v79 (12-sep, 13:07):** unificación de la intranet + Finanzas. Panel de 5 tarjetas → 3 puertas (Finanzas & Data · Profit OS · Sistema de Marketing), shell `SistemaFinanzas` con lateral, `CosteoVista.html` partido en 11 parciales, 3 `.gs` duplicados archivados (31 funciones globales duplicadas → 0), RAA creada. Batería 90 · 0 fallas.
- **v80 (12-sep):** encima de la 79, **el CRM acepta token** y las pruebas nuevas del barrido. Contra la 79 cambiaron exactamente `CrmDatos.js`, `CrmVista.html`, `Pruebas.js` y `PruebasFinanzas.js`.
- **v81 (12-sep):** doble cabecera cerrada. Dentro del shell de Finanzas (`embed=1`) cada vista oculta su barra verde entera; abiertas directo no cambian. Cambian FinanzasVista, MetasVista, ComparativoVista y EscenariosVista, más el retiro de la prueba vieja de corchetes (Pruebas.js y PruebasFinanzas.js). Batería 90 · 88 OK · 0 fallas · 0 avisos. **Publicada y verificada: el equipo está en @81.** Ojo: la batería solo EVALÚA Index y CosteoVista; las vistas de Finanzas las lee crudas, así que después de tocar una plantilla hay que abrirla directa y embebida.
- Detalle del día: `~/Dev/Rosanta/apps-script/_informes/2026-09-12_Unificacion_intranet.md` y `SKILL.md` v12.

~~Estado al 10 sep 2026: Versión 76 publicada. Batería de pruebas 71 OK · 0 fallas · 2 saltadas.~~ (obsoleto)

### CRM con token (v80, 12 sep 2026)

**Síntoma:** quien entra con Gmail personal y `?u=<token>` no cargaba contactos, y quien tiene permiso de edición veía el botón de importar pero no le funcionaba. La batería lo marcaba como aviso: *"24 de 27 llamadas con token"*.

**Causa:** las tres funciones del CRM **nunca estuvieron abiertas** —`requiereCrm_` y `requiereEdicionCrm_` tenían `throw` real—, pero resolvían con `getUsuarioActual()` sin token, y `CrmVista.html` no declaraba `var AUTH`. Para un Gmail personal la sesión de Google no identifica a nadie. Misma clase de bug que el del recetario del 10-sep.

**Arreglo, en los dos lados:** `crmContactos(auth)`, `crmClavesConChat(auth)`, `crmImportarContactos(auth, filas)`; las dos guardas usan `resolverUsuario_(auth)` (sin token cae en la sesión, así la batería y el editor siguen andando); la vista declara `var AUTH` y lo pasa primero en las tres llamadas, con nombre literal. Único llamador interno: `Pruebas.js`, que llama `crmContactos()` sin argumentos y sigue funcionando. Respaldo: `rosanta-intranet/_backups/crm-token-2026-09-12/`.

**Barrido de las pruebas, ampliado en el mismo push** (sesión 0f): el intermediario `srv(fn, ...args)` de `Marketing.html` llama 11 funciones (14 llamadas) con el nombre en una variable, invisibles para el barrido. Las 11 tenían guarda —verificado leyendo el cuerpo: `requiereMarketing_`, `requiereEdicionMarketing_`, `requiereSoloMarketing_`, las tres con `resolverUsuario_(auth)` y `throw`—, así que no había puerta abierta, pero una función nueva sin guarda habría pasado en verde. Ahora:
- *Las llamadas de las vistas pasan el token*: cuenta también `srv('nombre', ...)` (auth último, aridad exacta, función existente) → **41/41**.
- *Toda llamada de las vistas verifica identidad*: suma las de `srv` y falla con `srv(variable)` → **36/36**.
- *Ninguna vista llama al servidor con el nombre en una variable* (nueva): 25 vistas, excepción explícita del dispatcher de Marketing reconocida por su texto; falla si ve menos de 10 llamadas `srv`. Hoy 36 `run` + 14 `srv`.
- La prueba vieja *Ninguna vista llama al servidor con corchetes* (5 vistas de Finanzas) **retirada por decisión de Juanma, 12-sep**: subido a HEAD (re-clonado, idéntico al disco) y verificado: **88 OK · 0 fallas · 0 avisos · 2 saltadas (90 pruebas)**. **Publicado en la versión 81** junto con la doble cabecera del shell de Finanzas; el equipo está en @81. Su regex sobre las 25 vistas daba falsos positivos (`conChat[k]` en `CrmVista`, `window.__POS_CACHE__[semanas]` en `CosteoJs_Pintar`).

- Código en **`~/Dev/Rosanta/apps-script/rosanta-intranet`** (la ruta vieja `~/Documents/Claude/Projects/Claude/rosanta-intranet` quedó obsoleta).
- scriptId `1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42`.
- Deployment publicado: `AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb`.
- Sheets: Config `1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw`, Recetario `14rlDIT0gTGYhUQHHbopX2dLHQfPQmOHu4q0SRhTKl5A`.
- ~~Usuarios y roles reales en USUARIOS~~ **HECHO el 10 ago 2026**.
- **Rol "contenido"** activo: ve solo Calendario, Creador Kaprica, Checklist y Manual, con permisos también del lado del servidor.
- Módulo Recetario funcionando (la fuente de verdad pasó a Profit OS, §2).

### Jornada del 10 sep 2026 — ocho versiones (69 → 76)

**Identidad (69, 70, 71).** Tres bugs encadenados; cada uno tapaba al siguiente. Jeffry (chef, Gmail personal, entra por `?u=<token>`) fue el primero en recorrer el camino completo.
- `INTRANET_URL` tenía el prefijo `/a/macros/rosanta.rest/`, que fuerza el login del dominio. Se arregla con `fijarUrlIntranet()`. **No fue una versión: es una propiedad del script.**
- `Index.html` imprimía la query con `<?= ?>` dentro de un `href`; el escapado contextual convertía `&u=` en `%26u%3d`, así que llegaba UN parámetro `page` con el token adentro y `doGet` caía en `getUsuarioActual()`.
- `doGet` ahora **rescata los enlaces viejos** (desarma `page=costeo&u=<token>`), porque los rotos ya estaban repartidos por WhatsApp y no se pueden retirar.
- `Denied.html` ahora dice el motivo: sin-token / token-desconocido / sesión sin fila en USUARIOS, más la cuenta de Google con la que llegó la visita.
- Las 6 llamadas del recetario viajaban sin el token.

**Rendimiento (72, 73, 74).** Abrir el recetario en frío pasó de **46,7 s a 0,44 s**.
- `fechaVenta_` llamaba a `Utilities.formatDate` una vez por fila sobre 9.502 filas. Reemplazado por aritmética (Guatemala es UTC-6 fijo): 10,36 s → 1,23 s, con los números idénticos (Q428.985,56 · CMV global 28,3201% · 212 fechas).
- `getAvisosDashboard` recorría Drive: 7,10 s → 0,03 s con cache de 30 min. `cargarVentasPorProducto()` **borra** ese cache al terminar.
- `COSTEO.cacheSegs` era 900 s y `getCosteoData` tarda 39,7 s en frío: el cache vencía entre una visita y la siguiente. Ahora 3600 s + `calentarCaches()` desde un activador cada 5 minutos, que no reconstruye si ya está caliente.

**Permisos (75).** `doGet` protege la PÁGINA, no la FUNCIÓN. Cuatro funciones no verificaban a quien las llamaba: `getProfitOS`, `getAvisosDashboard`, `getMetasData` y `getComparativoData` — **las dos últimas leen el maestro financiero entero**. Corregidas con `exigirModulo_(auth, modulo)`, nueva en `Config.gs`.

**Formato de reportes (76).** Desde S36 los reportes del POS se suben ya convertidos a hoja de Google; el cargador lee el nativo directo en vez de copiarlo. **El camino del `.xlsx` se queda**: S35 y anteriores lo necesitan.

**Carga de datos.** Se corrió `cargarVentasPorProducto()`: las ventas pasaron de terminar el 23 ago a terminar el **6 sep** (9.502 → 10.068 filas, 6 archivos registrados, 0 pendientes).

### Cómo publicar y verificar

- Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`. **`clasp push` solo actualiza HEAD.**
- **Verificar (desde el 12-sep-2026) = la batería en el navegador** sobre la URL `/dev` del deployment @HEAD: `https://script.google.com/a/macros/rosanta.rest/s/AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=pruebas` (solo rol dueño, ~130-170 s). `clasp run` ya no alcanza con el login actual (*"Unable to run script function"*). Desde Claude in Chrome la página es un iframe: no deja desplazar ni leer el texto; se lee con clic adentro + ⌘A + ⌘C + `pbpaste`. Antes de correrla, bajar HEAD a una carpeta aparte y comparar contra el disco: clasp llegó a decir *"Script is already up to date"* habiendo subido. **Nunca `clasp pull` sobre el repo compartido.**
- ~~Verificar = `clasp run correrPruebasTexto` (batería completa, ~170 s).~~ (obsoleto) La API corta seguido (ETIMEDOUT / ECONNRESET); si pasa, correr un solo grupo con un envoltorio que llame a `prPuentePOS_(res)` y devuelva `pruebasATexto_(res)`. El encabezado sale con "undefined fallas" porque los totales los calcula `correrPruebas()`; **el detalle por prueba sí es válido**.

### Reglas duras (de Juanma)

- **No reescribir módulos que funcionan.** Los cambios son incrementales.
- **No cambiar roles ni permisos de la hoja USUARIOS sin pedirlo.**
- Antes de nombrar una función nueva, verificar que no exista ya: los `.gs` comparten un solo ámbito global y un nombre repetido pisa al otro **en silencio**.

### Pendientes de sistema

- **Jose** (sala/barra) no ha probado su acceso por token.
- ~~CRM y marketing usan `getUsuarioActual()` en sus guardas, así que NO aceptan token. Inofensivo hoy porque solo Juanma tiene esos módulos.~~ **FALSO desde el 12-sep-2026, en las dos mitades.** CRM: resuelto en la v80 (ver "CRM con token"). Marketing: sus guardas ya resolvían con `resolverUsuario_(auth)` desde antes; se verificó leyendo el cuerpo de las tres. Y el "inofensivo porque solo Juanma los tiene" dejaba de ser cierto en cuanto otra persona tuviera el módulo: es el tipo de frase que hace que nadie lo mire.
- ~~Probar el CRM con un enlace real de Gmail.~~ **Probado el 12-sep-2026 por Juanma con el enlace de Jeffry: el token funciona.** La batería no alcanzaba para darlo por bueno, porque corre con la cuenta de Juanma y solo prueba que cada llamada lleva el token.
- **ABIERTO (N1): Jeffry NO debe tener acceso al CRM** (Juanma, 12-sep-2026). Es jefe de cocina; el CRM es del equipo de marketing. Que el CRM le haya cargado prueba que su fila de USUARIOS trae el módulo `crm`, y para entrar por Sistema de Marketing también `marketing` o `contenido`. Hoy su enlace expone los 3.535 contactos, con teléfono y correo. El arreglo es quitarle esos módulos en USUARIOS, y lo hace Juanma, que es quien decide los permisos. Revisar también la fila de Jose, que es de sala y barra. **Error de método de ese día:** la prueba se armó con Jeffry porque el cerebro decía que el CRM con token "es el caso de Jeffry y Jose", y nadie revisó qué módulos tenían. Antes de probar con el enlace de alguien, confirmar que esa persona debe tener el módulo.
- ~~ABIERTO: en producción el recuadro de los shells sale VACÍO.~~ **CERRADO el 12-sep-2026: era solo la ventana de automatización.** En el Chrome de Juanma el shell de Finanzas carga "La semana" con datos. La ventana que usa Claude en Chrome bloquea cookies de terceros y por eso el iframe salía en blanco, también el de Marketing. **Regla: un iframe vacío visto desde la automatización no prueba nada; se confirma en el Chrome de la persona.** La doble cabecera que quedaba (la vista repetía su barra verde dentro del shell) se cerró en la v81.
- **Opcional (p134, N3):** que `srv()` de `Marketing.html` valide `fn` contra una lista blanca declarada en la vista. El riesgo de regresión ya lo cubre el barrido; esto sería defensa extra y toca `Marketing.html`. Decisión de Juanma.
- **El latido corre los lunes y mira `pauta_semanal`, no si las ventas por producto están al día.** Ese hueco dejó los datos parados dos semanas sin avisar.

**OBSOLETO (resuelto; ver SKILL.md v11 y v12): la meta de food cost es 30% fijo por decisión de Juanma del 10-sep, y la fórmula del mix quedó descartada. El párrafo de abajo se conserva solo como historia.**
~~**Abierto (N1):**~~ la pestaña PARAMETROS de `Rosanta_Intranet_Config` tiene `food_cost_objetivo_pct = 32` fijo. El objetivo correcto depende del mix: (mix cocina × 30%) + (mix barra × 20%) = **27.8%** con el mix real (77.9/22.1). Con el número fijo el semáforo miente y hoy es 4 puntos más permisivo de lo debido. Mejor aún: convertirlo en fórmula del mix.

**Siguiente etapa aprobada el 3 sep:** pantalla semanal de finanzas para la intranet — prime cost semanal, semáforo de food cost, caja y comparativo vs semana anterior. Especificación para Code y forecast de caja.

**Otros pendientes:** distinguir sub-recetas de barra sin precio (salen verdes sin CMV); corregir fichas con alertas de unidades. La vista Finanzas ya no se construye aparte: la absorbió Finanzas & Data OS (§5).

---

## §4. Marketing OS

Ver `references/marketing.md` para el detalle de campaña, audiencias y reputación. Aquí lo técnico:

- Hoja **Rosanta Marketing OS** `1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc`.
- **N1 — CREDENCIALES EN TEXTO PLANO:** la pestaña `config` guarda en celdas normales un token de larga duración de Meta (EAA…), una API key/JWT de Wix (IST.ey…) y el site id. Con ese token se puede publicar y gastar en nombre de Rosanta. Las lee `WixReservasPauta.js` línea 54. Moverlas a Propiedades del script y revisar con quién está compartida la hoja.
- **N1 — CUATRO deployments vivos**, dos de ellos (v2 `AKfycbwUM-icAFh4…`, v3 `AKfycbzCjzI_xpGw…`) sirven código viejo que solo conoce `hook=sontickets`. Buenas: @HEAD `AKfycbyuXVzGU-…` y v18 `AKfycbzEv9C1gZ6-…`. Borrar v2 y v3 **después** de confirmar a dónde apunta Wix. Referencia: sección 5.6 de `INFORME_APPS_SCRIPT.md`.
- **Panel de reseñas:** el guard de validación está arreglado en local pero **no en producción**. Corta el texto en el primer marcador de razonamiento, exige respuesta publicable (40–600 caracteres, máx. 5 oraciones) y si no lo es la manda a aprobación humana. `cd ~/Dev/Rosanta/apps-script/panel-de-reseas-de-google && clasp push`. Los activadores corren HEAD, no hace falta redeploy. Nace de dos respuestas que se publicaron con el razonamiento del modelo adentro (34 y 3 días públicas).
- **`posActualizarPauta()`** debe correrse a mano una vez para recuperar S32–S35 de comensales y ticket: el fix del 24 ago nunca se había subido y producción leía una carpeta vacía en silencio.
- **Auditoría de los 7 proyectos de Apps Script** entregada el 31 ago: mapa de quién escribe qué Sheet, dos duplicaciones reales y dos falsas alarmas. Destapó cinco fallos que nadie veía.

---

## §5. Finanzas & Data OS

Arrancó el 2 sep 2026. Es el pilar que faltaba montar. Todo el detalle de números, fuentes y reglas de clasificación está en `references/negocio.md` — **leerlo antes de tocar nada financiero.**

**Lo construido:**
- Maestro migrado a Sheet nativo + cargador automático + patrón espejo para Python.
- Ocho meses validados al centavo contra los PDF del banco.
- DRE anual, los 5 números del P&L con semáforo, prime cost mensual con nómina devengada, gasto operativo contra rango, punto de equilibrio y simulador de escenarios.
- Artefacto **`rosanta-dre-mensual`** = vista Finanzas v1. Absorbe los pendientes viejos de "vista Finanzas de la intranet" y "los 5 números del P&L".

**Pendientes por orden:**
1. **Forecast de caja 30/60/90** — pasa a ser el primer entregable por el saldo de Q11,196 al 31 ago. Arranca de cero.
2. Automatizar la generación del reporte interno mensual (hoy se arma a mano).
3. Reclasificar la nómina de febrero (y meses 5 y 6) mal registrada como TRANSFERENCIA_SALIENTE en BAC.
4. Diseñar con Jeffry un registro simple de compra de mercado (fecha, proveedor, producto, monto) cruzable contra el recetario.
5. **Bloque RAA**: cada número fuera de rango con causa raíz escrita, responsable y acción.
6. **Panel de integridad del dato**: meses cuadrados contra PDF, % de compra con factura, partidas sin clasificar.
7. Documentar el cargador automático en la hoja `00_Instrucciones` — hoy solo Claude sabe cómo funciona.

---

## §6. Reservas / Ticketing (WIX)

- ~~Migración de SonTickets a WIX~~ **EJECUTADA el 10 ago 2026.** SonTickets vendido y cerrado; el histórico está exportado e incluido en WIX. Las reservas corren en `rosanta.rest/reservas`.
- Site Wix: `47968b83-c2c2-4b11-8f94-ef2c7488debc`.
- Carritos abandonados: circuito formulario WIX → webhook Apps Script → Sheet Marketing OS → Meta CAPI (AddToCart hasheado, dataset Rosanta Reservas).
- **N1 abierto — los webhooks estuvieron 25 días mudos** y nadie se enteró. Última reserva registrada: 6 ago. Último carrito: 7 ago. Causa probable: los deployments v2/v3 del Marketing OS (§4). Abrir el editor de Wix, encontrar el snippet del webhook y comparar su URL contra las cuatro.
- **Pendiente:** script que vigile caídas del sistema de reservas y avise por correo a restaurante@rosanta.rest. Señal disponible hoy: el conteo de escalaciones del bot (`rosanta-bot-panel`) como proxy.

---

## §7. Back office / Operations Hub

- **Drive reorganizado por los 6 pilares** de Rosanta OS (ejecutado en Code, S35).
- **Auditoría de artefactos cerrada:** 10 vivos, 9 borrados, 3 pasan a referencia. **La app no permite renombrar artefactos** (solo Pop out, Unpin, Move down, Delete), así que el mapa oficial es el archivo `_Indice_Artefactos.md`.
- **Abierto:** las cuatro subcarpetas del Operations Hub en `01_Business_Fundamentals` (`1twebbv6qCGWMY4BlTPYYnXsilR0-Al_y`) — Six_Pillar_Audit, PnL_5_Numeros, Identity_StopDoing, Tech_Stack_Audit — están **vacías**, con los archivos 1.3, 1.5 y 1.8 sueltos en la carpeta padre. Mover cada archivo es trabajo de cinco minutos. Juanma el 30 ago: "no lo recuerdo, debemos retomarlo" — reconstruir contexto antes de decidir si el esquema sigue vigente.
- **Abierto:** el `index.html` del tablero de seguimiento se revirtió una vez a una versión vieja mientras `versions/` ya tenía la nueva. Comparar contra el último archivo de `versions/` antes de editarlo a mano. Ruta: `~/Claude/Artifacts/rosanta-seguimiento-semanal/`.
- **Tech Stack Audit (1.9)** completado en ago: app por app, 34 oportunidades clasificadas entre activar ahora, más adelante, ya en uso y no aplica.

---

## §8. Dashboards

- `rosanta-dashboard-semanal` se refresca cada lunes desde el espejo del maestro. **Se movió a las 11:04** porque a las 9:04 corría antes que el cargador de las 10:06 y siempre leía datos viejos.
- Motor **ui-ux-pro-max** en `tools/ui-ux-pro-max/`: `python3 scripts/search.py "<query>" --design-system -p "Nombre"`. Da estructura y buenas prácticas; **la identidad de `rosanta-brand-guidelines` manda** sobre lo que sugiera el motor.
- Los dashboards sobre datos del bot siguen sin construirse; hoy la prioridad de visualización está en Finanzas & Data OS y Profit OS.
