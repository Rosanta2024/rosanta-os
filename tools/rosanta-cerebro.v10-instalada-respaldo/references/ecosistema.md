# Ecosistema de herramientas de Rosanta (act. 6 sep 2026)

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
| `rosanta-analista-pauta` | Diagnóstico Meta Ads contra benchmarks propios (escalar/ajustar/apagar) |
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
- `rosanta-intranet/` — código de la intranet (**se movió aquí; la ruta vieja en Documents/Claude quedó obsoleta**). Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`; `clasp push` solo actualiza HEAD.
- `panel-de-reseas-de-google/` — panel de reseñas.

Carpeta `~/Documents/Claude/Projects/Claude/`:
- `tools/ui-ux-pro-max/` — motor de diseño para dashboards. La identidad de `rosanta-brand-guidelines` manda sobre lo que sugiera el motor.

Carpeta `Maestro/` — `AppsScript_cargador.gs`, `generar_finanzas.py`, `generar_dashboard.py`, `PROMPT_ROAS_medios_vs_honorarios.md`, `INFORME_APPS_SCRIPT.md`.

## Artefactos (paneles vivos)

Auditoría cerrada en S35 bajo Rosanta OS de 6 pilares: **10 vivos, 9 borrados, 3 a referencia**. **La app no permite renombrar artefactos** (solo Pop out, Unpin, Move down, Delete), así que el mapa oficial es el archivo `_Indice_Artefactos.md`. Actualizar con `update_artifact`, no crear duplicados.

| Artefacto (id) | Qué es | Pilar |
|---|---|---|
| `rosanta-seguimiento-semanal` | **Memoria operativa**: pendientes por proyecto con niveles N1/N2/N3 e historial de cierres | Back office |
| `rosanta-dre-mensual` | DRE mensual: 5 números del P&L con semáforo, prime cost, equilibrio, simulador. **Vista Finanzas v1** | Finanzas & Data OS |
| `rosanta-finanzas-semanal` | Vista semanal de finanzas | Finanzas & Data OS |
| `rosanta-dashboard-semanal` | Dashboard semanal de ventas/COGS/margen. Se refresca los lunes 11:04 | Finanzas & Data OS |
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

Auxiliares recientes: `rosanta-honorarios-reclasificacion`, `rosanta-clasificacion-fijo-variable`, `rosanta-scorecard-7-pasos`, `rosanta-ruta-metas`, `sistema-marketing-rosanta`. Personales: `patagonia-feb-2027`, `mapa-trekkings-chalten`.

## Memoria operativa: el tablero

`rosanta-seguimiento-semanal` es la memoria OPERATIVA del cerebro. Datos en el bloque JSON `#seguimiento-data` con contrato `{pendientes:[{id,proyecto,texto,origen,estado,nivel,donde}], semanas:[…]}`.

- **Niveles:** N1 crítico (afecta dinero, datos o un canal hoy) · N2 impulso (desbloquea un proyecto activo) · N3 mantenimiento.
- **Comando "Consolidar tablero":** al cerrar una sesión, los cierres se escriben en el acto. Formato de registro: `cerrado: …` / `pendiente-1: … — N# — proyecto`.
- **Juanma dicta pendientes y cierres por chat**, no por el formulario del panel.
- La tarea `rosanta-cierre-semanal` (domingos 18:00) barre lo que quede suelto.
- **El cerebro guarda contexto estable; el tablero, el estado semana a semana. No duplicar.**
- Los pendientes cerrados se podan del JSON; su historia vive en `semanas[].consolidados` y las versiones completas en `versions/`.

## Automatizaciones (tareas programadas, al 6 sep 2026)

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `morning-brief-juanma` | L–V 6:02 | Brief diario con los 3 N1 del tablero |
| `rosanta-seguimiento-offsite` | Lunes 8:05 | Reputación TripAdvisor + listicles |
| `rosanta-analista-pauta-lunes` | Lunes 8:08 | Campañas Meta vs benchmarks + acciones para Vanessa |
| `rosanta-reporte-semanal` | Lunes 10:06 | Valida la carga automática, procesa PDF de bancos, genera el PDF semanal |
| `rosanta-dashboard-refresh` | Lunes 11:04 | Refresca el dashboard semanal. **Movido de 9:04 a 11:04** porque corría antes que el cargador y leía datos viejos |
| `rosanta-cierre-semanal` | Domingos 18:03 | Cierre de la semana → actualiza el tablero |
| `auditoria-meta-ads-rosanta-mensual` | Día 25, 8:00 | Auditoría mensual de Meta Ads |
| `rosanta-cerebro-mantenimiento` | Día 1, 9:00 | Propone la versión nueva de esta skill |

Además, el bot tiene triggers propios en Apps Script: envío de respuestas cada 1 min y refresco del token IG los lunes 9:00.

**Nota:** el `SKILL.md` de `rosanta-reporte-semanal` apuntaba al árbol de Drive equivocado — esa era la causa raíz de que el maestro y el dashboard se desfasaran en agosto. Ya está reescrito, con el roster completo del equipo y la regla de restaurantes.

## Flujo general

Cliente escribe (WhatsApp/IG) → **bot** clasifica y registra en Sheet de leads → alertas por correo → Juanma responde desde la hoja → paneles visualizan → si es evento: **rosanta-cotizador** genera la cotización → la reserva entra por **WIX** → webhook → Sheet Marketing OS → Meta CAPI → las ventas caen al **maestro nativo** vía cargador automático → **DRE mensual** y dashboard semanal → decisiones. El tablero `rosanta-seguimiento-semanal` guarda qué quedó pendiente en cada paso.
