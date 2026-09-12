# Proyectos de Rosanta — detalle (al 12 jul 2026)

## §1. Bot de WhatsApp + Instagram

Bot que atiende WhatsApp e IG de Rosanta con Claude y registra leads clasificados en Google Sheet. Arquitectura: Meta → Google Apps Script → Claude → respuesta + Sheet. Todo interno.

**Infraestructura:**
- Proyecto Apps Script standalone "Bot Rosanta". Webhook: `https://script.google.com/macros/s/AKfycbw0PnfbHHtxaCH8tZtYT0yMHFAsT1h2uZXZ1pz2GC_wiaOAWD8CZ5WoU2DVwtpK0DvIAg/exec`
- VERIFY_TOKEN: rosanta-verifica-2026. API key en Script Properties (nunca en memoria/archivos).
- Sheet de leads: `1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc` (pestaña "Leads"). Doc base de conocimiento: `1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I`. Modelo: claude-sonnet-4-6.
- App Meta "Bot Rosanta" (App ID 1885303292873087, business_id 1509242976228027), publicada Live. IG @rosanta.rest (IG ID 17841457201371788), token IGAA de ~60 días con refresco automático semanal (lunes 9h, avisa por correo si falla).

**Funcionando:**
- IG vivo end-to-end desde 14 jun: recibe DM, responde con tono Rosanta, redirige reservas a rosanta.rest/reservas, registra lead.
- Respuesta humana desde la hoja: col M = respuesta, trigger cada 1 min la envía por el canal. Col L = ID destino, col N = enviado.
- Anti-loop: `dentroDeLimite()` con CacheService, límite 15 mensajes/contacto en 3 min.
- Modo pausa 6h al responder humano (vía hoja, y en IG también desde la app por detección is_echo).
- Alertas por correo (desde 28 jun): leads `urgencia:caliente`, `tipo:evento`, `tipo:queja` o `requiere_humano:true` → correo a ALERT_EMAIL (restaurante@rosanta.rest), con bloque "PARA COTIZAR" cuando es evento.
- Webhook protegido con token (10 jul): `WEBHOOK_SECRET` + `?token=` en Callback URL. WhatsApp e IG protegidos.

**Reglas del bot:** detecta idioma es/en; NO toma reservas por chat (redirige a rosanta.rest/reservas y /reservations); eventos escalan a Juanma; no inventa fuera de la base de conocimiento.

**Pendientes:**
1. **WhatsApp (retomar aquí):** migrar el número principal +502 3082-6935. GHL YA CERRADO (12 jul 2026), así que ya no hay coexistencia que cuidar: conectar el número en app Bot Rosanta → Use cases → WhatsApp → API Setup → desplegable "From" (el WABA está en el mismo Business Manager). WHATSAPP_TOKEN sigue placeholder; falta SMS de verificación. Ya se agregó método de pago al WABA (habilita plantillas / fix ventana 24h).
2. **Messenger:** cerrar el carve-out del guardia (`object 'page'` pasa sin token); primero guardar bien el token en su Callback URL en Meta.
3. **Notas de voz:** hoy el bot ignora todo lo no-texto (`if (msg.type !== 'text') return`). Próxima mejora acordada.
4. ~~Retirar GHL~~ HECHO — GHL cerrado definitivamente el 12 jul 2026. Sus funciones de marketing (social planner, carritos, retención) pasan al nuevo elemento del proyecto Pauta (ver marketing.md).
5. Vigilar App Review de Meta si crece el volumen.

**Lecciones (no repetir):**
- El prefill de JSON en askClaude ROMPIÓ el bot (doble `{`). Revertido; si algún día se optimiza el genérico ocasional, sería con caché de prompts, nunca prefill. Decisión: no perseguirlo más.
- Loop con otro bot de IG gastó créditos → de ahí el anti-loop. Corte inmediato si reincide: bloquear la cuenta en IG.

## §2. Intranet/ERP

Web app Apps Script; Sheets/Drive como fuente de verdad; usuarios Juanma + 2-5 personas con roles (dueno/contador/chef); responsive. Módulos v1: Finanzas (espejo del Reporte Maestro xlsx, solo lectura) y Recetario/costeo (editable). Fase 2: leads del bot, cotizaciones. Fase 3: inventario (catálogo compartido; cierres físicos mensuales barra+cocina en Drive, consolidado mayo Q24,712).

**Estado (11 jul):**
- clasp instalado/logueado; scriptId `1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42`; código en `~/Documents/Claude/Projects/Claude/rosanta-intranet/` (Code.gs, Config.gs, Recetario.gs, RecetarioVista.html, Index/Denied/Estilos.html, CLAUDE.md). Git al día salvo push pendiente de la última corrección.
- Sheets creados: Config `1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw`, Recetario `14rlDIT0gTGYhUQHHbopX2dLHQfPQmOHu4q0SRhTKl5A`.
- Panel con login, rol dueno y tarjetas con marca: verificado.
- **Módulo Recetario FUNCIONANDO:** 125 recetas (56 cócteles barra, merma 3%/CMV obj 20%; 69 platillos cocina, merma 10%/CMV obj 30%). 72 en objetivo, 7 por revisar, 46 pendientes (mayoría sub-recetas sin precio, normal).
- **Fuente definitiva del recetario:** hojas nativas Rosanta_Recetario_Barra `1LeoX3xpemoYEj130qnTTMzn4OCgLsZx1PvPRW-2LRnk` y Rosanta_Recetario_Cocina `14PY5v69esGokwKEjB5PEjXQsgI_9-t633S8-oO26vOU` (el equipo edita las nativas; los xlsx son respaldo).
- Trucos técnicos: etiquetas de ficha no están en la primera celda de la fila; google.script.run elimina nulls (usar `== null` en cliente); .gs y .html no pueden compartir nombre.

**Obsoletos:** hojas Rosanta_Insumos/Platillos/Recetas de la skill rosanta-recetario-costeo (skill por actualizar en Settings), Sheet "Rosanta_Recetario" del setupInicial (borrar de Drive), ImportarInsumos.gs (eliminado).

**Pendientes:** push de la corrección; usuarios/roles reales en USUARIOS; Sheet espejo del maestro financiero; vistas Finanzas y Recetario (tarjetas apuntan a #) — **la vista Finanzas tomará el formato del DRE MASTER.xlsx** (P&L por rubro + break even + ticket medio; ver "Gestion de Restaurantes" en negocio.md) alimentado con datos del maestro; distinguir sub-recetas de barra sin precio (salen verdes sin CMV); corregir fichas con alertas de unidades (ej. Queso Horneado CMV 4450%). Plan completo: `Rosanta_Intranet_Plan_2026-07-11.md`.

## §3. Dashboards

Pendiente construirlos sobre los datos del bot (Google Sheet). Motor **ui-ux-pro-max** instalado en `tools/ui-ux-pro-max/` (workspace `~/Documents/Claude/Projects/Claude/`): `python3 scripts/search.py "<query>" --design-system -p "Nombre"` genera sistema de diseño; sin dependencias pip. La identidad de `rosanta-brand-guidelines` manda sobre lo que sugiera el motor. Falta definir qué visualizar primero (ventas/día, propinas, FEL…).

## §4. Marketing / ads / CRM (exploratorio, jun 2026)

> Actualización 13–14 jul: el marketing dejó de ser solo exploratorio. Hay un plan operativo con 8 palancas (**Mejoras impacto real v2**, Q280–390K/año — ver negocio.md) y frentes activos (**eventos como pilar mensual**, **ocupación entre semana**, **CRM_Export_Vanessa**) detallados en `marketing.md`. Leer esa referencia primero para cualquier tarea de marketing/eventos.

- Auditoría SEO + visibilidad en IA (GEO/AEO) de rosanta.rest — notas A–F, solo lectura.
- claude-ads (SOLO Meta) en Claude Code; Rosanta corre Meta ads. Requiere gasto mensual aprox. y Ad Account ID.
- Comparar CRM para salir del Google Sheet: Auto-CRM (self-hosted) vs nube. Claves: acceso (solo compu vs teléfono/equipo) y uso (pipeline catering/eventos vs base de leads del bot).
- Skill `rosanta-eventos` pendiente de instalar en Cowork (Configuración › Capacidades).
