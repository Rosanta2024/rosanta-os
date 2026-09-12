# Marketing, audiencias y estacionalidad (cosechado 12 jul 2026, act. 17 jul 2026)

> **SonTickets: vendido (17 jul), cerrado y con migración COMPLETA (26 jul 2026).** El histórico está exportado e incluido en WIX y las reservas corren sobre WIX. Toda mención de SonTickets abajo es histórica. Para carritos/retención: definir el mecanismo de captura de carritos en WIX.

Fuente principal: Doc "Plan_Campana_Rosanta_jun-dic2026" (`19qeBduU8QM-7MnMLzP7wkixa2VSD7kpjvBcNHj-fzVs`) y "Estrategia_Marketing_Rosanta_v2" (`1EPn41azfTWfDzPRM7xNxXbHr1_4OrSwAnWE3GL5zcPM`), en Drive › 02_OPERATIVO › 05_MARKETING&PUBLICIDAD.

## Reglas que cruzan todo

- **Rosanta NO hace delivery. Nunca se ofrece.**
- Voz: todo en afirmativo, segunda persona, cliente protagonista. Evitar "nuestro/our", abrir con "En Rosanta" o "Hola", em dashes y "cocina de autor". Personalización solo con first_name.
- Creativos: branding en primeros 3 s, CTA en últimos 2–3 s, todo video subtitulado. Benchmarks: Hook Rate ≥40–45%, retención ≥10–15%, costo por engagement < Q0.05.

## Audiencias (con datos, no supuestos)

1. **Turistas/expats angloparlantes (~80% del volumen)** — parejas 25–54, deciden rápido durante el viaje. Canal: Google/SEO/GBP/retargeting en inglés; las reseñas pesan mucho.
2. **Foodies locales (Antigua + Capital)** — parejas y grupos; celebraciones y eventos. Canal: Instagram y boca a boca, en español. Casi nunca llegan por Google.

Demografía Meta: 25–54 (pico 25–44), 57% mujeres, Antigua + Ciudad de Guatemala.

## Estacionalidad

- **Temporada alta de Antigua: noviembre–diciembre** (pico de turismo). Q4 = girar a conversión/reservas.
- Campaña 2026 en 3 fases: Awareness (jun–jul), Consideración/retargeting (ago–sep), Conversión (oct–dic: eventos, fin de año, celebraciones).
- Ventas semanales históricas oscilan fuerte (Q25.5K–75.3K); picos en S7 y S18 de 2026.
- **Curva estacional de ventas jul–dic 2026 (validada 13 jul, reemplaza el objetivo "+20% vs 2025", ya obsoleto porque 2026 vende ~2x vs 2025):** ventas sin IVA jul Q140K · ago Q170K · sep Q130K · oct Q140K · nov Q220K · dic Q240K ≈ Q1.04M en H2. Objetivo de invierno (jul–sep, lluvia = baja en Antigua): resultado operativo ≥0 cada mes con renta y nómina completas; EBITDA >10% se evalúa en Q4. Ojo: **sep 2025 cerraron por vacaciones del equipo** (52 tickets) — excluir del índice estacional; en 2026 abren en septiembre. Detalle en memoria `rosanta-curva-estacional-2026`.

## Campaña activa "Mesa Llena" (jun–dic 2026)

- Presupuesto US$440/mes: Awareness $240 ($8/día), evento del mes $100, eventos permanentes (bodas/privados) $100–120, tráfico sin cambios.
- 8 audiencias Meta (CA carritos/compradores/web/engagers + lookalikes + saved locales/turistas). Match quality objetivo ≥6.0.
- Recuperación de carritos (~184/mes, cifra de la era SonTickets): secuencia WhatsApp+email (+24h, +72h, cierre 7d; vía bot propio/CRM, GHL cerrado) + retargeting hasheado. Fuente nueva de carritos: flujo WIX (por confirmar). Meta: 10% fase 2, 15% fase 3.
- SEO turista: GBP en inglés, reseñas de turistas, /reservations y /menu para "best restaurant Antigua" etc. CTA siempre al sitio propio (el sistema anterior no era socio de Reserve with Google; verificar si el flujo WIX permite activarlo).
- Tablero semanal: pauta (Vanessa), contenido (Daniel), reservas (Juanma). Cadencia: 4 piezas/semana, publica martes y viernes.
- **GHL CERRADO definitivamente (12 jul 2026).** El plan original le asignaba Social Planner, secuencias de carritos (WhatsApp/email) y retención — esas funciones quedaron sin herramienta. **Próxima tarea del proyecto Pauta: crear el elemento que reemplaza a GHL** (calendario/publicación de contenido + recuperación de carritos + retención), alineado al stack interno (Apps Script/Sheets + Claude).

## Frentes activos jul 2026 (además de Mesa Llena)

- **Eventos y grupos = pilar continuo mes a mes** (mejora #1 del plan de impacto real, Q90–120K/año). NO se cierra: se trabaja cada mes. Julio al día (todas las cotizaciones enviadas, seguimiento a las últimas 10). Las cotizaciones salen con `rosanta-cotizador`; el menú **Para Compartir** correcto (entrantes de carta: Carpaccio de lomito, Pulpo a la parrilla, Queso horneado, Tabla de jamones y quesos; fuertes: Lomito en salsa de puerros, Pesca del día) ya está en memoria — NO usar Tapas Guatemaltecas en Para Compartir.
- **Ocupación entre semana** (mejora #3, Q60–100K/año): kit de ejecución listo 13 jul. 10 hoteles boutique en 2 rutas caminables desde Plaza Santa Rosa (día 1 noreste: El Convento, Casa Santo Domingo, Doña Leonor, Pensativo, Mestizo; día 2 centro/sur: San Rafael, Good Hotel, Panza Verde, Posada del Ángel, Porta). Airbnbs vía property managers y welcome books. Medición: QR con UTM único por hotel (Wix lo registra) + código en notas de la reserva (flujo WIX) + columna fuente del CRM; cruce cada lunes. Fam night con invitación lista (fecha en blanco a definir en equipo). "Noche de Lluvia" y su costeo quedan para la pauta de agosto (fuente: recetarios confirmados). PDF: `Rosanta_Ocupacion_Entre_Semana_Propuesta_2026-07-13.pdf`.
- **CRM para Vanessa:** Sheet espejo `CRM_Export_Vanessa` (id `19NEHGKGr4h229l0NmQf3vvw9kxsmxkcF8AizYyhucAo`, IMPORTRANGE del CRM maestro) con filtros por fecha/fuente/segmento/idioma para que Vanessa descargue contactos en CSV sin tocar el maestro. Se comparte SOLO este sheet con Vanessa. Detalle en memoria `rosanta-crm-export-vanessa`.

## Web y presencia

- Sitio: rosanta.rest (Wix). Páginas clave: /reservas, /reservations, /menu, política de privacidad real; T&C ya reemplazados.
- Reservas online: WIX (antes SonTickets) → dataset Meta "Rosanta Reservas". Verificar que los eventos del embudo sigan llegando tras la migración.
- Google Business Profile: acceso a la API solicitado (aprobación de Google pendiente al 8 jul; se re-verifica).
- Seguimiento off-site semanal (TripAdvisor + listicles) vía tarea programada.
