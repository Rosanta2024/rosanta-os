---
name: rosanta-cerebro
description: 'Cerebro maestro unificado de Rosanta (CORSAGA, S.A., restaurante "Cocina con Carisma" en Antigua Guatemala) y de todos los proyectos de Juanma. Cargar SIEMPRE al inicio de cualquier conversación sobre Rosanta o sus proyectos — bot de WhatsApp/IG, intranet/ERP, recetario/costeo, finanzas, dashboards, marketing, ads, CRM, sitio web rosanta.rest — aunque el usuario no mencione "Rosanta" explícitamente. Disparadores: Rosanta, bot, intranet, ERP, recetario, costeo, leads, Apps Script, clasp, maestro financiero, "¿en qué íbamos?", "retomemos", "continúa con", o cualquier tarea que dependa del contexto de proyectos anteriores. Si hay duda entre cargarla o no, cargarla.'
---

# Cerebro Rosanta

Este es el contexto maestro de Juanma y sus proyectos. Su propósito: que ninguna conversación arranque de cero, sin importar el proyecto o chat.

**Última actualización: 1 ago 2026 (v8).** Todo lo que Juanma diga en la conversación actual, o lo que exista en la memoria automática de la sesión, es MÁS RECIENTE que este archivo y manda sobre él. Este cerebro es la foto de partida, no la verdad eterna.

**Cambios clave del 1 ago 2026 (mantenimiento mensual):**
- **Sistema de reservas WIX AMPLIADO y en producción (fin jul):** formulario propio con teléfono libre (extranjeros ya pueden reservar), panel del mesero que captura el consumo por mesa y alimenta el KPI, el CRM de WIX acumula ese consumo como **Valor Total por cliente**, reporte semanal automático los lunes 8am por correo (promedio por mesa, por persona y desglose; job `jobs.config` en el backend de WIX) y correo de TripAdvisor post-visita SOLO a quien realmente cenó. Todo publicado.
- **Pendientes nuevos del frente web/marketing:** Google Ads (#15), retargeting cuando Dani entregue el video, y decidir en qué reporte existente se incorpora el consumo por mesa.
- Ecosistema puesto al día: artefactos `sistema-marketing-rosanta` (Marketing OS) y `rosanta-management-os` agregados al mapa; tarea programada `rosanta-analista-pauta-lunes` registrada; skills `calibrar-respuestas` (cargar siempre) y `active-living-design` (marca personal de Juanma) en el inventario.

**Cambios clave del 30 jul 2026:**
- **La identidad se llama "LA SEGUNDA COSECHA"**, no "La Segunda Floración" (ese nombre quedó obsoleto; el documento fuente y las versiones viejas de las skills lo traían mal). Corrección directa de Juanma.
- **Documentos: fondo BLANCO y CERO cajas de texto.** El Crema sigue siendo fondo en redes/menús/flyers, pero en briefings, reportes, propuestas y guiones el fondo de color y las tarjetas redondeadas delatan "hecho por IA". El estándar es editorial: tipografía, jerarquía y aire. Detalle completo en `rosanta-brand-guidelines` § Documentos · reglas duras. Referencia viva: `Rosanta_Briefing_LlegarARosanta_3Videos.pdf`.
- **Meta (Andromeda): las variantes de un mismo video se tratan como duplicado.** En pauta, diversificar = videos conceptualmente distintos (otras tomas, otro ritmo) sobre UN mismo concepto, jamás el mismo material con otro gancho. Lo detectó Vanessa y lo confirmó la investigación; el panel de asesores ya lo tiene incorporado.
- **Marketing OS ampliado**: módulos 🧠 Panel de Asesores (6 lentes de expertos REALES con metodología escrita + investigación web en vivo antes de cada debate + regla de humildad temporal) y 📥 Propuestas del equipo (dentro de 🎯 Estrategia). Regla de la casa para módulos con "asesores": expertos reales verificables con link a su contenido, jamás personas inventadas, y nunca atribuirles citas (siempre "Lente X").
- **Carritos abandonados VIVOS de nuevo**: circuito completo formulario WIX → webhook Apps Script → Sheet Marketing OS → Meta CAPI (AddToCart hasheado, dataset Rosanta Reservas). Sustituye el flujo muerto de SonTickets.
- **Rol "contenido" en la intranet**: usuarios que solo ven Calendario, Creador Kaprica, Checklist y Manual (para el equipo de producción), con permisos también del lado del servidor.

**Cambios clave del 26 jul 2026:**
- **Auditoría de skills.** Desinstaladas: `xlsx-pro`, `pdf-pro` (duplicados viejos de `xlsx`/`pdf`) e `internal-comms` (genérica sin uso). `mcp-builder` se conserva por decisión de Juanma. **`rosanta-eventos` queda DESCARTADA: no se creará; no reproponerla.** Purga de referencias SonTickets/GHL aplicada a `rosanta-retencion`, `rosanta-seo-local` y `rosanta-analista-pauta`.
- **SonTickets y GHL: cerrados y desinstalados.** Las reservas corren en rosanta.rest/reservas sobre WIX. **Migración CERRADA: el histórico de SonTickets está exportado e incluido en WIX** (confirmado por Juanma, 26 jul). Solo queda definir el mecanismo de captura de carritos en WIX para retención.
- **Anti-brand INTEGRADO a `rosanta-brand-guidelines` (26 jul).** Fuente: `Rosanta_Anti-Brand_Sprint.pdf` (Drive, jul 2026; el doc lo titula "La Segunda Floración", pero **el nombre vigente es "La Segunda Cosecha"** — ver cambios del 30 jul); el doc completo vive en la skill como `references/anti-brand-sprint.md`. Incluye: 5 pilares, el enemigo (trampa para turistas + barra de licuadora), los 4 filos, la flor (botánica y de 4 pétalos), Fresco & Fuego · Urban Garden, arquetipo Cuidador/Explorador, frases firma y reglas de emojis. **OJO — la paleta HEX cambió con el Brand Kit del sprint:** Verde Bosque #4E6D5A, Verde Medio #57A77F, Lila #AEAAE2, Crema #F2EEEB, Negro #000000 (la pre-sprint #456B50/#4CAF7D/#A89DC8/#F0EDE6/#1A1A1A queda obsoleta). El script de `rosanta-cotizador` ya usa la paleta nueva (actualizado 26 jul). Complemento estructural: el playbook Visual Storytelling (The Passive Rebel) ya está aplicado vía `visual-storytelling-docs`; el PDF/md queda en Drive y en el proyecto Pauta como consulta (copyright: no re-publicar).

**Cambios clave del 17 jul 2026:**
- **Bot WhatsApp/IG: COMPLETO.** WhatsApp vivo desde semanas con token PERMANENTE (número +502 3082-6935 en la API, app de WhatsApp Business eliminada del teléfono). Mensajería post-24h activada (plantillas). Messenger cerrado y notas de voz descartadas (ver decisión abajo). El proyecto Bot ya no tiene pendientes.
- **SonTickets SE VENDIÓ** → migrar reservas/ticketing de vuelta a WIX. PRIORIDAD N1 nueva. Impacta CRM (append obsoleto), bot (redirección de reservas) y retención (carritos). Ver marketing.md y negocio.md.
- **Notas de voz del bot: DESCARTADO** hasta que exista transcripción de audio nativa en Claude (sin proveedor externo tipo Whisper/OpenAI). Clientes casi no mandan audio; no vale el costo/complejidad. No reproponerlo antes de eso.

## Quién es Juanma y qué es Rosanta

- Juanma Lemus, dueño de **Rosanta** ("Cocina con Carisma"), restaurante en Antigua Guatemala. Empresa: CORSAGA, S.A. Correo de trabajo: restaurante@rosanta.rest. Sitio: rosanta.rest.
- Está en Plaza/Parque Santa Rosa ("Santa Rosa" vale solo como nombre del lugar físico y su parqueo).
- **PROHIBIDO usar "Jardín Santa Rosa"** — sub-marca descontinuada (jun 2026). Removida de `rosanta-brand-guidelines` el 17 jul 2026 (ya no aparece como sub-marca ni como disparador). Regla dura: nunca usarla.
- **Firma de marca: coordenada 14·91** (Antigua, punto fijo). Forma oficial escrita **14° N · 91° W**; forma corta **14·91 / #1491** para logo, hashtag y redes. Va igual en cada plato como sello, sin sufijos por platillo. Detalle completo en `rosanta-brand-guidelines`.
- Stack elegido: todo interno con Google (Apps Script, Sheets, Drive) + Claude. Sin n8n, Make ni plataformas externas. GHL (GoHighLevel) CERRADO definitivamente el 12 jul 2026; su reemplazo de marketing es la próxima tarea del proyecto Pauta (ver marketing.md).

## Mapa de proyectos (estado al 1 ago 2026)

| Proyecto | Estado | Detalle |
|---|---|---|
| Bot WhatsApp/IG | COMPLETO (17 jul): WhatsApp + IG vivos, token permanente, plantillas post-24h | `references/proyectos.md` §1 |
| Reservas/Ticketing → WIX | COMPLETO y AMPLIADO (fin jul): reservas propias + carritos vivos (WIX → Apps Script → Sheet → Meta CAPI) + consumo por mesa → CRM (Valor Total) + reporte semanal lunes 8am + correo TripAdvisor selectivo | `references/marketing.md`, `references/negocio.md` |
| Intranet/ERP | En construcción; Recetario funcionando, Finanzas y USUARIOS pendientes (para más adelante) | `references/proyectos.md` §2 |
| Maestro financiero | Operativo (skill `rosanta-maestro`, xlsx en Drive) | usar esa skill |
| Dashboards de datos del bot | Pendiente; motor ui-ux-pro-max instalado en `tools/` | `references/proyectos.md` §3 |
| Marketing/ads/CRM | Campaña "Mesa Llena" activa jun–dic 2026. Plan de medios Ago–Oct de Vanessa aprobado con ajustes por el Panel de Asesores (30 jul) | `references/marketing.md` |
| Mejoras impacto real v2 | Activo (13 jul): 8 palancas rankeadas, Q280–390K/año | `references/negocio.md` |
| Eventos y grupos | Pilar continuo mes a mes (mejora #1); julio al día | `references/marketing.md` |
| Ocupación entre semana | Kit de ejecución listo (13 jul): 10 hoteles, fam night | `references/marketing.md` |
| Sistema Operativo / SIC | Mandala V4 + Ruta 2×3×5 en las 6 dimensiones (artefacto). Social = Niños de Guatemala + plato solidario | proyecto SIC (aparte) |

Antes de trabajar en cualquiera de estos, lee la sección correspondiente de `references/proyectos.md`.

## Datos maestros del negocio

`references/negocio.md` tiene el mapa del "corazón de Rosanta" en Drive (carpetas 01_PRODUCTIVO / 02_OPERATIVO con IDs), menú, equipo y roles (Juanma, Vanessa, Daniel, Wilson), SOPs, proveedores e insumos caros, números clave de referencia y el CRM. `references/marketing.md` tiene audiencias (80% turista angloparlante / foodie local), estacionalidad (alta nov–dic), la campaña activa y las reglas de voz. Leerlos antes de cualquier tarea de negocio, contenido o análisis.

## Ecosistema: skills, artefactos y conexiones

El mapa de qué herramienta usar para qué — skills instaladas (brand guidelines, cotizador, maestro, etc.), herramientas locales en `tools/`, los 8 artefactos/paneles vivos y el flujo que los conecta — está en `references/ecosistema.md`. Leerlo antes de crear contenido, paneles o documentos, para reutilizar lo que ya existe en vez de duplicarlo.

## Reglas de trabajo con Juanma (siempre aplican)

1. **Confirmar la fuente de datos ANTES de construir.** Si un análisis depende de una pestaña/Sheet/export, preguntar primero si es la fuente vigente (¿o hay algo más nuevo tipo POS/FEL?) y cómo tratar huecos. Lección del 12 jul 2026.
2. **NO mencionar la rotación de la API key de Anthropic.** Juanma pidió explícitamente que no se le vuelva a preguntar.
3. **Marca (FORMATO OBLIGATORIO de TODO diseño Rosanta)**: la combinación **anti-branding + storytelling es el estándar establecido para todo diseño, sin excepción**. Toda salida visual/escrita pasa por `rosanta-brand-guidelines` (identidad anti-brand completa: 5 pilares, el enemigo, los 4 filos, la flor, Fresco & Fuego, coordenada 14·91, HEX del Brand Kit, sin Jardín Santa Rosa) COMBINADA con `visual-storytelling-docs` (estructura/diseño intencional, no genérico ni "look de IA"). Regla: storytelling para la estructura + brand-guidelines para la identidad. **En documentos: fondo blanco y cero cajas de texto** (regla del 30 jul). Para cotizaciones usar `rosanta-cotizador`; para finanzas `rosanta-maestro`.
4. **Abogado del diablo**: cuando Juanma pida crítica sin filtros ("hazlo pedazos", "pre-mortem", "red team"), aplicar el método completo de la skill `abogado-del-diablo` — brutal con la idea, nunca con la persona.
5. **Rosanta NO hace delivery.** Nunca ofrecerlo ni mencionarlo en ningún contenido.
6. Juanma prefiere respuestas concisas y directas, en español.

## Cómo mantener vivo este cerebro

Este cerebro se actualiza reempaquetando la skill (Cowork no puede editar skills instaladas desde una sesión):

- Cuando Juanma diga "actualiza el cerebro", "guarda esto en el cerebro" o al cerrar una sesión con avances importantes: regenerar la skill con el contexto nuevo (actualizar fechas de "última actualización"), empaquetarla como `.skill` y entregarla para que la reinstale con el botón Save skill.
- Al actualizar, integrar también lo nuevo de la memoria automática de la sesión si existe.
- Marcar lo obsoleto como obsoleto en vez de borrarlo silenciosamente, para que Juanma vea qué cambió.
- Si este cerebro contradice algo que Juanma dice hoy, gana Juanma; ofrecer actualizar el cerebro.
