# Ecosistema de herramientas de Rosanta (al 26 jul 2026)

Mapa de skills, artefactos y cómo se conectan. Usar la herramienta correcta según la tarea; si dos aplican, combinarlas (ej. visual-storytelling-docs para estructura + rosanta-brand-guidelines para identidad).

## Skills instaladas en Cowork

### Núcleo y marca

| Skill | Para qué | Conexiones |
|---|---|---|
| `rosanta-cerebro` | Esta: contexto maestro de todo | Índice de todo lo demás |
| `rosanta-brand-guidelines` | Identidad anti-brand COMPLETA (integrada 26 jul desde el Anti-Brand Sprint): 5 pilares, el enemigo, los 4 filos, la flor, Fresco & Fuego, coordenada 14·91, paleta HEX del Brand Kit, tipografía, voz, checklist. OBLIGATORIA en todo contenido Rosanta | Se COMBINA con visual-storytelling-docs (formato obligatorio de todo diseño). "Jardín Santa Rosa" prohibida. Doc fuente en `references/anti-brand-sprint.md` dentro de la skill |
| `rosanta-kaprica` | Formato creativo de TODO copy: micro-ficción, cliente protagonista, giro final a reserva | Se combina con brand-guidelines en cada pieza escrita |
| `visual-storytelling-docs` | Documentos (PDF/Word) con diseño intencional, no genérico | **FORMATO OBLIGATORIO de todo diseño Rosanta junto con brand-guidelines**: storytelling = estructura, brand-guidelines = identidad |
| `abogado-del-diablo` | Crítica brutal / pre-mortem cuando Juanma la pida | Aplicar a cualquier plan o idea nueva |

### Suite de pauta y marketing (creada 15 jul, purgada de SonTickets/GHL el 26 jul)

| Skill | Para qué |
|---|---|
| `rosanta-analista-pauta` | Diagnóstico Meta Ads contra benchmarks propios (escalar/ajustar/apagar) |
| `rosanta-espia-pauta` | Inteligencia competitiva vía Ad Library de Meta |
| `rosanta-autopsia-contenido` | Forense del contenido orgánico → decisiones de calendario |
| `rosanta-seo-local` | SEO local + AI-SEO (GBP, sitio, FAQ, presencia en IAs) |
| `rosanta-retencion` | Carritos abandonados, re-enganche CRM y campañas de temporada |
| `rosanta-resenas` | Respuestas a reseñas ES/EN + auditoría de reputación |

### Operación y finanzas

| Skill | Para qué | Conexiones |
|---|---|---|
| `rosanta-cotizador` | Cotizaciones de evento en PDF, formato oficial | Recibe bloques "PARA COTIZAR" que genera el bot (§1 proyectos) |
| `rosanta-maestro` | Reporte financiero maestro (Rosanta_Reporte_Maestro_v2_2026.xlsx en Drive): POS/FEL/bancos, planilla, propinas, reporte al contador | Fuente del futuro módulo Finanzas de la intranet (§2) |

### Decisiones de inventario (auditoría 26 jul 2026)

- `rosanta-recetario-costeo`: DESINSTALADA. La fuente real son las hojas nativas Barra/Cocina (§2 proyectos).
- `rosanta-eventos`: **DESCARTADA — no se creará (decisión de Juanma, 26 jul).** No reproponerla. La info del evento del mes sigue en la Sección 12 del Doc.
- Desinstaladas también: `xlsx-pro`, `pdf-pro` (duplicados viejos), `internal-comms` (genérica sin uso). `mcp-builder` se conserva.

## Herramientas locales (carpeta `~/Documents/Claude/Projects/Claude/`)

- `tools/ui-ux-pro-max/` — motor de diseño para dashboards: `python3 scripts/search.py "<query>" --design-system -p "Nombre"`. Estructura/buenas prácticas; el brand manda en identidad.
- `tools/abogado-del-diavolo/` (SKILL.md original de abogado-del-diablo, respaldo).
- `rosanta-intranet/` — código de la intranet (§2 proyectos).

## Artefactos (paneles vivos en Cowork)

Se abren desde Cowork y se refrescan con datos de conectores. Actualizar con `update_artifact`, no crear duplicados.

| Artefacto (id) | Qué es | Última act. |
|---|---|---|
| `mandala-kalachakra-2x3x5` | Proyecto SIC / Ruta 2x3x5: mejoras de impacto real v2, curva estacional y objetivos financieros | 13 jul |
| `panel-operativo-rosanta` | Panel operativo general | 12 jul |
| `rosanta-crm` | CRM sobre los leads | 10 jul |
| `crm-buscador-contactos` | Buscador de contactos del CRM | 10 jul |
| `crm-rosanta-maestra` | Vista maestra del CRM | 10 jul |
| `panel-resenas-rosanta` | Panel de reseñas | 6 jul |
| `rosanta-inventarios-may-jun-2026` | Inventarios may–jun 2026 (cierres físicos) | 3 jul |
| `rosanta-dashboard-semanal` | Dashboard semanal | 30 jun |
| `rosanta-bot-panel` | Panel de los leads del bot (Sheet de leads, §1) | 29 jun |

Nota: los tres artefactos CRM se solapan; hay una tarea pendiente (jun 2026) de decidir CRM definitivo (§4 proyectos). Al decidirlo, consolidar o retirar los sobrantes.

## Memoria operativa: tablero de seguimiento

El artefacto `rosanta-seguimiento-semanal` es la memoria OPERATIVA del cerebro: pendientes activos por proyecto e historial de cierres semanales. Datos en su bloque JSON `#seguimiento-data`. Lo actualiza la tarea programada `rosanta-cierre-semanal` (domingos 18:00) leyendo las sesiones de la semana. Al terminar o descubrir una tarea en cualquier chat, considerar reflejarla ahí (o avisar que el cierre dominical la recogerá). Si Juanma pide "consolida el tablero", reconciliar manualmente. El cerebro (skill) guarda contexto estable; el tablero, el estado semana a semana — no duplicar.

## Automatizaciones (tareas programadas de Cowork, al 12 jul 2026)

Activas cada domingo: `rosanta-cierre-semanal` (18:00, cierre semanal de proyectos → actualiza el tablero de seguimiento). Mensual: `rosanta-cerebro-mantenimiento` (día 1, 9:00, propone la versión nueva de esta skill). Activas cada lunes: `rosanta-seguimiento-offsite` (8:05, reputación TripAdvisor/listicles), `rosanta-dashboard-refresh` (9:04, refresca el dashboard semanal desde el maestro), `rosanta-reporte-semanal` (10:06, actualiza el maestro vía Chrome + PDF de marca; fin de mes exporta reporte del contador). Mensual: `auditoria-meta-ads-rosanta-mensual` (día 25, 8:00). Además el bot tiene sus propios triggers en Apps Script: envío de respuestas cada 1 min y refresco del token IG los lunes 9:00. Hilo abierto: aprobación de la API de Google Business Profile (se re-verifica periódicamente).

## Flujo general del ecosistema

Cliente escribe (WhatsApp/IG) → **bot** clasifica y registra en Sheet de leads → alertas por correo → Juanma responde desde la hoja → paneles (`rosanta-bot-panel`, CRMs) visualizan → si es evento: **rosanta-cotizador** genera la cotización → finanzas caen al **maestro** (rosanta-maestro) → la **intranet** será la vista única para el equipo (Finanzas + Recetario).
