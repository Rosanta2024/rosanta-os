# Ecosistema de herramientas de Rosanta (act. 16 sep 2026)

> **ACTUALIZADO EL 23-SEP-2026 — leer esto antes que el resto de este archivo.**
> Todo se mudó a **Claude Code**. Las tareas programadas son routines en `~/.claude/scheduled-tasks/`
> (ocho, listadas en el SKILL.md v24); Cowork quedó sin tareas y solo conserva el proyecto SIC.
> Las 18 skills propias viven en `~/.claude/skills/` y esa es la copia que se edita; la de
> claude.ai es un caché que se pisa al sincronizar. Los artefactos ya no son archivos de
> `~/Claude/Artifacts/`: son Artifacts publicados, con enlace propio, listados en
> `Rosanta 03 Finanzas/_archivo/artefactos-publicados.md`. `update_artifact`, `list_artifacts`,
> `present_files` y `window.cowork.callMcpTool` **no existen en Code**: los equivalentes son la
> herramienta Artifact, `SendUserFile` y la capacidad `mcp` del artefacto.
> Lo que siga abajo y contradiga esto, está viejo.


Mapa de skills, artefactos y automatizaciones. Usar la herramienta correcta según la tarea; si dos aplican, combinarlas.

## Skills instaladas

### Núcleo y marca

| Skill | Para qué | Conexiones |
|---|---|---|
| `rosanta-cerebro` | Esta: contexto maestro de todo | Índice de todo lo demás |
| `rosanta-brand-guidelines` | Identidad anti-brand COMPLETA: 5 pilares, el enemigo, los 4 filos, la flor, Fresco & Fuego, coordenada 14·91, paleta HEX del Brand Kit, tipografía, voz, vocabulario prohibido, checklist. **OBLIGATORIA en todo contenido Rosanta** | Se COMBINA con `visual-storytelling-docs`. Doc fuente en `references/anti-brand-sprint.md` dentro de la skill |
| `rosanta-kaprica` | Formato creativo de TODO copy: micro-ficción, cliente protagonista, giro final a reserva | Se combina con brand-guidelines en cada pieza escrita |
| `visual-storytelling-docs` | Documentos con diseño intencional, no genérico | **FORMATO OBLIGATORIO junto con brand-guidelines**: storytelling = estructura, brand-guidelines = identidad. En documentos: fondo blanco, cero cajas de texto |
| `calibrar-respuestas` | Calibra el nivel de detalle: explicaciones cortas, instrucciones técnicas completas paso a paso | Cargar al inicio de cualquier conversación |
| `cierre` | Ritual de cierre de sesión: resumen + propuesta de pendientes con nivel N1/N2/N3 → consolida al tablero | Escribe en `rosanta-seguimiento-semanal` |
| `abogado-del-diablo` | Crítica brutal / pre-mortem cuando Juanma la pida | Aplicar a cualquier plan o idea nueva |

### Suite de pauta y marketing

| Skill | Para qué |
|---|---|
| `rosanta-analista-pauta` | Diagnóstico Meta Ads contra benchmarks propios (escalar/ajustar/apagar). Desde la @100 el mismo criterio corre dentro de la intranet con Lente Loomer + AI CMO; la skill queda para análisis a mano en chat |
| `rosanta-espia-pauta` | Inteligencia competitiva vía Ad Library de Meta |
| `rosanta-autopsia-contenido` | Forense del contenido orgánico → decisiones de calendario |
| `rosanta-seo-local` | SEO local + AI-SEO (GBP, sitio, FAQ, presencia en IAs) |
| `rosanta-retencion` | Carritos abandonados, re-enganche CRM y campañas de temporada |
| `rosanta-resenas` | Respuestas a reseñas ES/EN + auditoría de reputación. **Ojo: las de Google ya se responden solas** |

### Operación y finanzas

| Skill | Para qué | Conexiones |
|---|---|---|
| `rosanta-cotizador` | Cotizaciones de evento en PDF, formato oficial, ES/EN | Recibe bloques "PARA COTIZAR" que genera el bot |
| `rosanta-maestro` | Reporte financiero maestro: POS/FEL/bancos, planilla, propinas, reporte mensual | **La fuente ya NO es el xlsx sino el Sheet nativo** `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`. El reporte del contador quedó descontinuado |

### Decisiones de inventario (no reproponer)

- `rosanta-recetario-costeo`: DESINSTALADA. La fuente real es Profit OS (hoja nativa v14).
- **`rosanta-eventos`: DESCARTADA — no se creará.** Decisión de Juanma (26 jul). No reproponerla.
- Desinstaladas: `xlsx-pro`, `pdf-pro` (duplicados), `internal-comms` (sin uso). `mcp-builder` se conserva.

## Herramientas locales

Carpeta `~/Dev/Rosanta/apps-script/` — proyectos Apps Script versionados con clasp:
- `rosanta-intranet/` — código de la intranet (**se movió aquí; la ruta vieja en Documents/Claude quedó obsoleta**). Alias vivo: `Documents/Claude/Projects/Rosanta (1)/codigo-intranet`. Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`; `clasp push` solo actualiza HEAD.
- `panel-de-reseas-de-google/` — panel de reseñas.

Carpeta `~/Dev/Rosanta/tools/` — utilidades y skills:
- `guardian-estructura/` — valida las 7 reglas del README de Rosanta OS en menos de 1 s. **Solo reporta**; `--fix` mueve a `_Archive/` o `_Inbox/` y `--realias` reconecta los alias rotos (busca la carpeta por nombre; si hay varias, no adivina). Ninguno borra: el alias roto se archiva en `_Archive/Alias_rotos_FECHA/`. Correrlo después de cualquier reorganización de carpetas — es lo único que avisa si se rompió un alias.
- `duplicados/` — agrupa por md5. Solo reporta.
- `convertir-punteros/` — `.gdoc/.gsheet/.gslides` → archivo real al lado del puntero. Por demanda, nunca en bloque.
- `ui-ux-pro-max/` — motor de diseño para dashboards. La identidad de `rosanta-brand-guidelines` manda sobre lo que sugiera el motor.

Carpeta `~/Dev/Rosanta/scripts/maestro-finanzas/` — `generar_finanzas.py` (produce los 4 JSON de `_datos_finanzas/`) y `generar_dashboard.py` (produce los dos `Rosanta_Dashboard*.html`). **El código está acá; los datos siguen en Drive**, en `03_Finance_Data_OS/Maestro/`. `rutas.py` resuelve dónde: `--datos RUTA` > `ROSANTA_MAESTRO_DIR` > el default.

Carpeta `03_Finance_Data_OS/Maestro/` en Drive — solo datos y entregables: `Rosanta_Maestro_ESPEJO.xlsx`, `_datos_finanzas/`, los dashboards, `README_scripts.md`, `INFORME_APPS_SCRIPT.md`, `PROMPT_ROAS_medios_vs_honorarios.md`.

**Las tres capas y la puerta única (11 sep 2026):** `~/My Drive/Rosanta OS/` guarda los datos, `~/Dev/Rosanta/` el código, y `~/Documents/Claude/Projects/` solo alias. Desde el 11-sep se entra por una sola puerta: `Rosanta OS/_Codigo` → `~/Dev/Rosanta` y `Rosanta OS/_App` → `~/Claude`, dos **alias** en la raíz. Si alguna se vuelve carpeta real, Drive sincroniza `.git` y `node_modules` y corrompe los repos. `~/Documents` no se borra (iCloud + los 9 alias son la vinculación de los proyectos de Cowork) y está oculta con `chflags hidden`.

## Artefactos (paneles vivos)

Auditoría cerrada en S35 bajo Rosanta OS de 6 pilares: **10 vivos, 9 borrados, 3 a referencia**. **La app no permite renombrar artefactos** (solo Pop out, Unpin, Move down, Delete), así que el mapa oficial es el archivo `_Indice_Artefactos.md`. Actualizar con `update_artifact`, no crear duplicados.

| Artefacto (id) | Qué es | Pilar |
|---|---|---|
| `rosanta-seguimiento-semanal` | **Memoria operativa**: pendientes por proyecto con niveles N1/N2/N3 e historial de cierres | Back office |
| ~~`rosanta-dre-mensual`~~ · ~~`rosanta-finanzas-semanal`~~ · ~~`rosanta-dashboard-semanal`~~ | **RETIRADOS — no están en el manifiesto (verificado 16-sep).** Todo Finanzas vive en la intranet (decisión del 12-sep: una sola superficie). No reconstruirlos como artefacto | Finanzas & Data OS |
| `panel-operativo-rosanta` | Panel operativo general | Profit OS |
| `rosanta-inventarios-may-jun-2026` | Inventarios (integrados a Profit OS) | Profit OS |
| `costeo-barra-rosanta` / `rosanta-costos-compra-barra` | Costeo y costos de compra de barra | Profit OS |
| `rosanta-actualizar-precios-pos` | Actualización de precios de la carta 2027 en el POS | Profit OS |
| `rosanta-bot-panel` | Panel de leads del bot. Sirve de proxy de caídas de reservas | Marketing OS |
| `panel-resenas-rosanta` | Panel de reseñas | Marketing OS |
| `rosanta-crm` | CRM sobre los leads | Marketing OS |
| `rosanta-management-os` / `rosanta-sistema-consolidado` | Sistema de gestión | Back office |
| `mandala-kalachakra-2x3x5` | Proyecto SIC / Ruta 2×3×5, mejoras de impacto real | SIC |
| `morning-brief-juanma` | Brief diario L–V con los 3 N1 del tablero | Personal |
| `plan-utg-42k` | Plan de la Ultramaratón Guatemala 42K (21 nov 2026) | Personal |

Auxiliares recientes: `rosanta-honorarios-reclasificacion`, `rosanta-clasificacion-fijo-variable`, `rosanta-scorecard-7-pasos`, `rosanta-ruta-metas`, `sistema-marketing-rosanta`. Personales: `mapa-trekkings-chalten`, `plan-utg-42k` (~~`patagonia-feb-2027`~~ tampoco está en el manifiesto).

**Verificado el 16-sep:** el último artefacto creado es del 2-sep. Dos semanas sin artefactos nuevos no es parálisis: el trabajo se mudó a la intranet.

## Memoria operativa: el tablero

`rosanta-seguimiento-semanal` es la memoria OPERATIVA del cerebro. Datos en el bloque JSON `#seguimiento-data` con contrato `{pendientes:[{id,proyecto,texto,origen,estado,nivel,donde}], semanas:[…]}`.

- **Niveles:** N1 crítico (afecta dinero, datos o un canal hoy) · N2 impulso (desbloquea un proyecto activo) · N3 mantenimiento.
- **Comando "Consolidar tablero":** al cerrar una sesión, los cierres se escriben en el acto. Formato de registro: `cerrado: …` / `pendiente-1: … — N# — proyecto`.
- **Juanma dicta pendientes y cierres por chat**, no por el formulario del panel.
- La tarea `rosanta-cierre-semanal` (domingos 18:00) barre lo que quede suelto.
- **El cerebro guarda contexto estable; el tablero, el estado semana a semana. No duplicar.**
- Los pendientes cerrados se podan del JSON; su historia vive en `semanas[].consolidados` y las versiones completas en `versions/`.

## Automatizaciones (tareas programadas, verificadas con `list_scheduled_tasks` el 16 sep 2026)

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `morning-brief-juanma` | L–V 6:02 | Brief diario con los 3 N1 del tablero |
| ~~`rosanta-seguimiento-offsite`~~ | ~~Lunes 8:05~~ | **APAGADA** (`enabled: false`). Reputación TripAdvisor + listicles. No asumirla viva |
| ~~`rosanta-analista-pauta-lunes`~~ | ~~Lunes 8:08~~ | **RETIRADA por Juanma el 16-sep-2026 (noche).** El análisis vive en la intranet (🧠 Diagnóstico IA, Lente Loomer + AI CMO, @100). Se perdió con ella la escritura automática del hallazgo semanal en `aprendizajes`: pendiente |
| `rosanta-reporte-semanal` | **Lunes 16:06** | Valida la carga automática, procesa PDF de bancos, genera el PDF semanal. **Era 10:06** |
| ~~`rosanta-dashboard-refresh`~~ | — | **YA NO EXISTE.** El dashboard semanal dejó de ser artefacto: la intranet es la única superficie del pilar 3 |
| `rosanta-cierre-semanal` | Domingos 18:03 | Cierre de la semana → actualiza el tablero |
| `rosanta-reporte-mensual` | **Día 3, 9:00** | Verifica que el mes anterior esté completo en el maestro (bancos, ventas, facturas, tarjeta, planilla) y avisa qué falta. **No calcula números ni toca artefactos** |
| `auditoria-meta-ads-rosanta-mensual` | Día 25, 8:00 | Auditoría mensual de Meta Ads |
| `rosanta-cerebro-mantenimiento` | Día 1, 9:00 | Propone la versión nueva de esta skill |

Además, el bot tiene triggers propios en Apps Script: envío de respuestas cada 1 min y refresco del token IG los lunes 9:00.

**Nota:** el `SKILL.md` de `rosanta-reporte-semanal` apuntaba al árbol de Drive equivocado — esa era la causa raíz de que el maestro y el dashboard se desfasaran en agosto. Ya está reescrito, con el roster completo del equipo y la regla de restaurantes.

## Flujo general

Cliente escribe (WhatsApp/IG) → **bot** clasifica y registra en Sheet de leads → alertas por correo → Juanma responde desde la hoja → paneles visualizan → si es evento: **rosanta-cotizador** genera la cotización → la reserva entra por **WIX** → webhook → Sheet Marketing OS → Meta CAPI → las ventas caen al **maestro nativo** vía cargador automático → **DRE mensual** y dashboard semanal → decisiones. El tablero `rosanta-seguimiento-semanal` guarda qué quedó pendiente en cada paso.
