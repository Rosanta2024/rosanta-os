---
name: rosanta-cerebro
description: 'Cerebro maestro unificado de Rosanta (CORSAGA, S.A., restaurante "Cocina con Carisma" en Antigua Guatemala) y de todos los proyectos de Juanma. Cargar SIEMPRE al inicio de cualquier conversación sobre Rosanta o sus proyectos — Rosanta OS de 6 pilares (Marketing OS, Profit OS, Finanzas & Data OS, Back office, Web, Reservas), bot de WhatsApp/IG, intranet/ERP, recetario/costeo, maestro financiero, DRE, dashboards, marketing, ads, CRM, sitio web rosanta.rest — aunque el usuario no mencione "Rosanta" explícitamente. Disparadores: Rosanta, bot, intranet, ERP, recetario, costeo, leads, Apps Script, clasp, maestro, DRE, prime cost, food cost, Marketing OS, Profit OS, "¿en qué íbamos?", "retomemos", "continúa con", o cualquier tarea que dependa del contexto de proyectos anteriores. Si hay duda entre cargarla o no, cargarla.'
---

# Cerebro Rosanta

Este es el contexto maestro de Juanma y sus proyectos. Su propósito: que ninguna conversación arranque de cero, sin importar el proyecto o chat.

**Última actualización: 10 sep 2026 (v10).** Todo lo que Juanma diga en la conversación actual, o lo que exista en la memoria automática de la sesión, es MÁS RECIENTE que este archivo y manda sobre él. Este cerebro es la foto de partida, no la verdad eterna. El estado semana a semana vive en el artefacto `rosanta-seguimiento-semanal`, no aquí.

---

## Cambios clave del 10 sep 2026 (v10)

Día completo de trabajo en la **intranet** (Apps Script), ocho versiones publicadas (69 → **76**). Batería de pruebas: **71 OK · 0 fallas · 2 saltadas**. Detalle en `references/proyectos.md` §3.

- **El código de la intranet se movió** a `~/Dev/Rosanta/apps-script/rosanta-intranet`. La ruta vieja (`~/Documents/Claude/Projects/Claude/rosanta-intranet`) queda obsoleta. Deployment publicado: `AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb`.
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
7. **Los activadores se crean A MANO** (Editor › Activadores): `ScriptApp.newTrigger()` necesita el scope `script.scriptapp`, que el manifiesto no declara. Y que un activador esté guardado no prueba que corra.
8. **Mirar el conteo, no el color.** La prueba de permisos pasó en VERDE habiendo revisado 2 de 21 llamadas.
9. **Antes de nombrar una función nueva, verificar que no exista.** Los `.gs` comparten un solo ámbito global y un nombre repetido pisa al otro en silencio.

### Cómo se trabaja la intranet (reglas de Juanma)

- **No reescribir módulos que funcionan.** Los cambios son incrementales.
- **No cambiar roles ni permisos de la hoja USUARIOS sin pedirlo.**
- Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`. `clasp push` solo actualiza HEAD.
- Verificar = `clasp run correrPruebasTexto` (~170 s; la API corta seguido con ETIMEDOUT/ECONNRESET).

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
| **Back office / Operations Hub** | Drive, Apps Script, seguridad, artefactos | Activo |
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

1. **Saldo bancario de dos días.** Al 31 ago las dos cuentas suman **Q11,196.57** (BI Q11,165.90 + BAC Q30.67) contra ~Q163,000/mes de gasto. El forecast de caja pasa a ser el **primer** entregable del pilar, no el sexto.
2. **Alquiler al 16.9% de la venta** contra rango de sector 6–10%. Q206,760 en ocho meses; llevarlo al 10% liberaría ~Q84,000/año. Es la palanca más grande del DRE y **no se resuelve con datos sino con una decisión**.
3. **Los webhooks de reservas estuvieron 25 días mudos** y nadie se enteró (última reserva 6 ago, último carrito 7 ago). Causa probable: el Marketing OS tiene **cuatro deployments vivos** y dos (v2, v3) sirven código viejo que solo conoce `hook=sontickets`; una reserva enviada ahí devuelve unauthorized y se pierde sin rastro. Buenas: @HEAD y v18.
4. **Credenciales en texto plano.** La pestaña `config` de la hoja *Rosanta Marketing OS* guarda un token de larga duración de Meta (EAA…), una API key/JWT de Wix (IST.ey…) y el site id, en celdas normales. Con ese token se puede publicar y gastar en nombre de Rosanta.
5. **Meta de food cost mal puesta en la intranet:** `food_cost_objetivo_pct = 32` fijo, cuando el objetivo correcto es (mix cocina × 30%) + (mix barra × 20%) = **27.8%** con el mix real medido (cocina 77.9% / barra 22.1%).
6. **Nómina de febrero mal clasificada:** salió por BAC como TRANSFERENCIA_SALIENTE en vez de NOMINA. Afecta solo al DRE de caja.

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
- **Comando "Consolidar tablero":** al cerrar una sesión, los cierres se escriben en el acto en `rosanta-seguimiento-semanal`. Formato: `cerrado: …` / `pendiente-1: … — N# — proyecto`. La skill `cierre` maneja el ritual.
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

## Mapa de proyectos (estado al 6 sep 2026)

| Pilar / proyecto | Estado | Detalle |
|---|---|---|
| **Finanzas & Data OS** | ARRANCADO 2 sep. DRE v1 vivo, maestro nativo validado 8/8 meses. Falta: forecast de caja (N1), RAA, panel de integridad | `references/negocio.md`, `references/proyectos.md` §5 |
| **Profit OS** | En funcionamiento (S35). Recetario v14 nativo, inventarios integrados. Merma y SPLH diferidos | `references/proyectos.md` §2 |
| **Marketing OS** | En funcionamiento. Abierto: webhooks mudos, credenciales expuestas, encuesta a TripAdvisor | `references/marketing.md` |
| **Back office / Operations Hub** | Drive reorganizado por 6 pilares. Abierto: 4 subcarpetas del Hub vacías, credenciales en texto plano | `references/ecosistema.md` |
| **Web Rosanta** | Sitio multilingüe ES/EN vivo, carta 2027 en POS. Abierto: hreflang (Wix no responde) | `references/marketing.md` |
| **Reservas / Ticketing (WIX)** | Migración COMPLETA (10 ago). Abierto: webhooks mudos 25 días + falta monitor de caídas | `references/marketing.md` |
| Bot WhatsApp/IG | COMPLETO desde 17 jul. Sin pendientes | `references/proyectos.md` §1 |
| Intranet/ERP | **v76 publicada (10 sep), batería 71 OK / 0 fallas.** Acceso por token, rendimiento y permisos resueltos. Abierto: meta de food cost mal puesta; pantalla semanal de finanzas aprobada 3 sep | `references/proyectos.md` §3 |
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

Se actualiza reempaquetando la skill (Cowork no puede editar skills instaladas desde una sesión):

- Cuando Juanma diga "actualiza el cerebro", "guarda esto en el cerebro" o al cerrar una sesión con avances importantes: regenerar con el contexto nuevo, subir la versión y la fecha, empaquetar como `.skill` y entregarlo para reinstalar con Save skill.
- Lo hace también la tarea programada **`rosanta-cerebro-mantenimiento`** (día 1 de cada mes, 9:00).
- Integrar lo nuevo de la memoria automática y del tablero `rosanta-seguimiento-semanal`.
- Marcar lo obsoleto como obsoleto en vez de borrarlo, para que Juanma vea qué cambió.
- Si el cerebro contradice algo que Juanma dice hoy, **gana Juanma**; ofrecer actualizar el cerebro.
