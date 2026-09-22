# Marketing, web y reputación (act. 6 sep 2026)

Fuente principal: Doc "Plan_Campana_Rosanta_jun-dic2026" (`19qeBduU8QM-7MnMLzP7wkixa2VSD7kpjvBcNHj-fzVs`) y "Estrategia_Marketing_Rosanta_v2" (`1EPn41azfTWfDzPRM7xNxXbHr1_4OrSwAnWE3GL5zcPM`), en Drive › 02_OPERATIVO › 05_MARKETING&PUBLICIDAD.

> **SonTickets y GHL: cerrados.** La migración de reservas a WIX se **ejecutó el 10 ago 2026**. Toda mención histórica de SonTickets se conserva solo como contexto.

## Reglas que cruzan todo

- **Rosanta NO hace delivery y NO vende brunch.** Nunca se ofrecen.
- **Vocabulario prohibido:** "coctel de autor", "cocina de autor", "signature cocktails". Aquí se dice **gastrococtelería**. También prohibido **"leña de café"** — es **gravilea**.
- Voz: todo en afirmativo, segunda persona, cliente protagonista. Evitar "nuestro/our", abrir con "En Rosanta" o "Hola", em dashes. Personalización solo con first_name.
- Creativos: branding en primeros 3 s, CTA en últimos 2–3 s, todo video subtitulado. Benchmarks: Hook Rate ≥40–45%, retención ≥10–15%, costo por engagement < Q0.05.
- **Meta (Andromeda): las variantes de un mismo video se tratan como duplicado.** Diversificar = videos conceptualmente distintos sobre UN mismo concepto, jamás el mismo material con otro gancho.
- Todo copy pasa por `rosanta-kaprica` (formato) + `rosanta-brand-guidelines` (identidad).

## Audiencias

1. **Turistas/expats angloparlantes (~80% del volumen)** — parejas 25–54, deciden rápido durante el viaje. Canal: Google/SEO/GBP/retargeting en inglés; las reseñas pesan mucho.
2. **Foodies locales (Antigua + Capital)** — parejas y grupos; celebraciones y eventos. Canal: Instagram y boca a boca, en español. Casi nunca llegan por Google.

Demografía Meta: 25–54 (pico 25–44), 57% mujeres, Antigua + Ciudad de Guatemala.

## Estacionalidad

- **Temporada alta de Antigua: noviembre–diciembre.** Q4 = girar a conversión/reservas.
- Campaña 2026 en 3 fases: Awareness (jun–jul), Consideración/retargeting (ago–sep), Conversión (oct–dic).
- **Curva estacional jul–dic 2026** (validada 13 jul; reemplaza el "+20% vs 2025", obsoleto porque 2026 vende ~2x): ventas sin IVA jul Q140K · ago Q170K · sep Q130K · oct Q140K · nov Q220K · dic Q240K ≈ Q1.04M en H2. Objetivo de invierno (jul–sep): resultado operativo ≥0 cada mes con renta y nómina completas.
- **sep 2025 cerraron por vacaciones** (52 tickets) — excluir del índice estacional. En 2026 abren en septiembre.

## Campaña activa "Mesa Llena" (jun–dic 2026)

- Presupuesto US$440/mes: Awareness $240 ($8/día), evento del mes $100, eventos permanentes $100–120, tráfico sin cambios.
- 8 audiencias Meta (CA carritos/compradores/web/engagers + lookalikes + saved locales/turistas). Match quality objetivo ≥6.0.
- Recuperación de carritos: circuito WIX → webhook Apps Script → Sheet Marketing OS → Meta CAPI. Secuencia WhatsApp+email (+24h, +72h, cierre 7d). Meta: 10% fase 2, 15% fase 3. **Campañas de retención ya corriendo** (adelantadas al invierno).
- Tablero semanal: pauta (Vanessa), contenido (Daniel), reservas (Juanma). Cadencia: 4 piezas/semana, publica martes y viernes.
- **Google Ads reactivado** el 10 ago 2026 (método de pago actualizado, riesgo de suspensión resuelto).
- Plan de medios Ago–Oct de Vanessa aprobado con ajustes del Panel de Asesores (30 jul).

## Medición: ROAS, CAC y analítica

- **El ROAS separa inversión en medios de honorarios de gestión.** En el denominador solo entra Meta (`FACEBK`) y Google (`GOOGLE*ADS`). Los honorarios de quien gestiona la pauta cuentan en el bloque Marketing del DRE pero **NO en el ROAS** — mezclarlos hace que la pauta parezca rendir menos de lo que rinde. Prompt en `Maestro/PROMPT_ROAS_medios_vs_honorarios.md`. Revisar `PosPauta.js` y la hoja `06_Dashboard_Operativo` del maestro (filas 17–21; esa hoja tiene "Consumo asociado Q" en cero y el selector clavado en la semana 25).
- **CAC** ya montado dentro del Marketing OS.
- **Abierto:** analítica del sitio WIX — de dónde viene el tráfico y cuántos terminan reservando. En medición desde el 30 ago.

## Reputación

- **TripAdvisor sube en las tres métricas** contra el baseline del 17 jun: 9 → 12 reseñas, 4.1 → 4.4 estrellas, **#204 de 418 → #146 de 463** (58 posiciones con la lista creciendo 45 restaurantes). Trayectoria: 17 jun 9/4.1/#204 → 24 ago 11/4.4/#154 → 31 ago 12/4.4/#146.
- **Las reseñas de Google se responden automáticamente** por la plataforma de reservas. **Nunca listarlas como pendiente.** Existe además el panel de reseñas en Apps Script; su guard de validación está arreglado en local pero no en producción (ver `proyectos.md` §4).
- **Encuesta de satisfacción:** hoy manda el **100% de las 5★ a Google**, que ya tiene volumen. TripAdvisor tiene 12 y cada reseña ahí vale varias posiciones de ranking. Re-apuntarla es cambiar UNA propiedad: proyecto `rosanta-encuesta` (scriptId `1pLW0y8L9WBMdXw4fhHDoAQg4EUUYEDTdVwdkXUCoIt_3WFyz00P8wzLh`) › Propiedades del script › `GOOGLE_REVIEW_URL`. La lógica ya existe: 5★ redirigen, 1–4★ quedan en feedback interno.
  **OJO antes de tocarlo:** el Sheet donde cae la encuesta ("Recoleccion de data - Rosanta") es **propiedad de un tercero** (`Eli_Juli@lacocinaquesuena.com`), no de Rosanta. Pedir transferencia a restaurante@rosanta.rest o crear hoja propia y migrar el histórico.
- **Outreach a listicles:** los 6 blogs de "best restaurants in Antigua" revisados, ninguno incluye a Rosanta. Prioridad: **Travel With New Eyes** (roxana@travelwithneweyes.com) y **Thoroughly Travel** (hello@thoroughlytravel.com, Lucy) — ambos actualizando contenido 2026. Luego Adventures of A+K, Bucket List Bri, Sally Sees, The Nomad Almanac. Ángulo: farm-to-table con jardín + 50 posiciones de subida en TripAdvisor en 2 meses. Los correos están redactados en `outreach-blogs-p40.md`. **Verificar los precios antes de mandarlos.**
- **NO trabajamos con OpenTable.** Existe una ficha que dice que no aceptamos reservas y ChatGPT la cita; reclamarla o darla de baja.
- Seguimiento off-site semanal (TripAdvisor + listicles) vía la tarea programada `rosanta-seguimiento-offsite`.

## Web — rosanta.rest (Wix)

**Sitio multilingüe ES/EN completo y verificado en vivo** (19–20 ago 2026): home, menú, Gift Ideas, eventos, navegación y pie de página. Menú en español terminado: 18 descripciones de sección, 77 platos, etiquetas y variantes. SEO por idioma cargado en las 9 páginas.

### Reglas operativas de Wix (aprendidas a golpes)

1. **En la app de menús, editar el texto en inglés BORRA su traducción al español.** Primero se cierra el inglés, después se carga el español.
2. **Cargar la traducción no basta: solo publicar** invalida el caché de render de la página.
3. **El SEO por idioma se edita en el Editor con el selector en Spanish**, no en el Translation Manager.
4. **La altura del Embed HTML no se controla por Velo** (acepta la instrucción y no la aplica): es fija, 1019px escritorio / 832px móvil, con scroll interno.

### Decisiones y limpiezas

- **"Farm to Table" se queda en inglés** — es el término que buscan los turistas; el jardín vive en el cuerpo de la página.
- **Brunch de sábado eliminado** de la web; no se sirve desde hace más de un año.
- "Signature cocktails" eliminado de la descripción del menú en inglés (equivalente de "coctel de autor", venía de la carga original).
- Cruce corregido en los dos lomitos: Lomito Rosanta Q190 con Red Pepper, Lomito de la Casa Q180 con Chaitenango. Creamy Amaretto salía como Limoncello en español.
- Páginas viejas eliminadas y redirecciones verificadas; `/cocktails` lleva a `/full-menu`. `/events-1` pasó de tres líneas a contenido indexable en los dos idiomas. PDF público con datos de cliente eliminado de la página de eventos.
- El contador del Translation Manager bajó de 9350 a 4031 palabras reales al borrar las páginas basura.

### SEO

- **Menú web:** carta 2026-2027 servida desde GitHub Pages (`Rosanta2024/rosanta-menu`) en un iframe en `/menu-completo`. Cambiar precios = editar `index.html` en GitHub, sin tocar Wix.
- Datos estructurados Restaurant + Menu (78 platos con precios) en `/menu-completo`. **Se eliminó el `aggregateRating` auto-declarado** del schema global — Google lo prohíbe y puede sancionar el dominio.
- H1 y dos párrafos visibles inyectados por Custom Code. Bing Webmaster Tools verificado. `llms.txt` editado a mano (automático en pausa, reversible con "Reset to Default").
- **hreflang — abierto:** Wix **no emite hreflang en 8 de 9 páginas** pese a prometerlo por escrito en SEO Settings. Ya descartado canonical manual e idioma oculto (Spanish está VISIBLE, código `es`). Corre un parche por Custom Code en 5 páginas (`hreflang · home, gift-ideas, events, reservas, faq`), documentado en `RUNBOOK_hreflang_parche.md`. **Wix nunca respondió** al escalamiento del 20 ago (confirmado el 30 ago). Reabrir el chat de soporte (dashboard `47968b83`), pedir número de caso y exigir estado. Para verificar el fallo, usar una página sin parche como `/politica-de-privacidad`. **Quitar el parche cuando lo arreglen** o quedan etiquetas duplicadas.
- Google Business Profile: acceso a la API solicitado, aprobación pendiente; se re-verifica periódicamente.

## Frentes activos

- **Eventos y grupos = pilar continuo mes a mes** (mejora #1, Q90–120K/año). NO se cierra. Las cotizaciones salen con `rosanta-cotizador`.
- **Ocupación entre semana** (mejora #3, Q60–100K/año): kit listo. 10 hoteles boutique en 2 rutas caminables desde Plaza Santa Rosa (día 1 noreste: El Convento, Casa Santo Domingo, Doña Leonor, Pensativo, Mestizo; día 2 centro/sur: San Rafael, Good Hotel, Panza Verde, Posada del Ángel, Porta). Airbnbs vía property managers y welcome books. Medición: QR con UTM único por hotel + código en notas de la reserva + columna fuente del CRM; cruce cada lunes. Fam night con invitación lista (fecha por definir). PDF: `Rosanta_Ocupacion_Entre_Semana_Propuesta_2026-07-13.pdf`.
- **CRM para Vanessa:** Sheet espejo `CRM_Export_Vanessa` (`19NEHGKGr4h229l0NmQf3vvw9kxsmxkcF8AizYyhucAo`), con filtros por fecha/fuente/segmento/idioma. Se comparte SOLO ese sheet.
