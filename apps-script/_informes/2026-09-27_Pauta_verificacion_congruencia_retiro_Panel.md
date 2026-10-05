# Pauta: verificación de la @131, congruencia con Medición y retiro del Panel

27-sep-2026 · Propuesta para Juanma. **No se ha tocado código.** Se ejecuta solo con su "sí".

Revisado: 128 archivos .js/.html de `apps-script/` (sin respaldos), la Sheet "Rosanta Marketing OS" (16 pestañas, conector de Drive), el plan `02_Management_OS/2026-09-27_Sistema_de_Medicion_Rosanta.md`, 3 archivos del cerebro y 8 memorias viejas de Cowork en `Workspace_Pauta/_memoria_cowork/`.

---

## 1. Verificación de lo publicado

| Qué | Estado | Cómo lo sé |
|---|---|---|
| Despliegue en la @131 | OK | `clasp list-deployments`: `@131 Sistema de Medicion v1 + Decisiones de pauta`. Git limpio, HEAD = 3c2cd87 |
| Pestañas del sistema | OK, 5 de 6 | `hechos_semana`, `pixel_semana`, `reglas`, `supuestos`, `bitacora_pruebas` existen. `estados_semana` nace con la primera captura |
| `reglas` con umbrales | OK | 18 reglas, todas "sistema · 2026-09-27" |
| `supuestos` | OK | 11 filas: 3 verificados, 1 falso (AddToCart), 7 por verificar |
| **Captura** | **NO PROBADA** | `hechos_semana` y `pixel_semana` tienen solo el encabezado: el botón "📥 Capturar semana" nunca escribió |
| Activador `psCapturaLunes` | Sin confirmar | Los activadores solo se ven en el editor. Pasos para Juanma en el chat |
| Batería en el servidor | Pendiente | La corre Juanma en `?page=pruebas` |
| Pantalla ⚖️ en producción | Pendiente | La revisa Juanma en su Chrome (los clics de automatización no llegan a Apps Script) |

**Dato que apareció:** la pestaña `debates` tiene un debate **de hoy** ("Muéstrame la estrategia propuesta para octubre"). El Panel se sigue usando.

---

## 2. Congruencia con el Sistema de Medición

**Diagnóstico.** La regla que mueve dinero (R3 · ESCALAR) pide que las "reservas atribuidas" de un conjunto suban dos semanas seguidas y que las reservas de Wix no bajen de su promedio. Las dos mitades fallan:

1. **Reservas atribuidas por conjunto no son fiables hoy.** Toda la cuenta hace ~17 NewReservation por semana y, según el aprendizaje del 23-sep, el único conjunto optimizado a NewReservation está apagado. Repartidas entre conjuntos quedan en 0, 1 o 2: "subir dos semanas seguidas" es 0 → 1 → 2, o sea ruido. Es la misma métrica que Medición descartó como North Star, entrando por la puerta de atrás. (AddToCart ya está bien tratado: el sistema lo marca contaminado y el supuesto está en "falso".)
2. **La decisión no mira el número del negocio.** Compara reservas de Wix contra su propio promedio, no comensales contra la meta del mes (580 en octubre) ni clientes nuevos contra la meta de Vanessa (40). Y los clientes nuevos dependen de que José cierre mesas: con lectura de 18% en septiembre, ese dato hoy no juzga nada (regla de Medición: con lectura <50% no hay CAC, hay dato faltante).

**Propuesta (tres cambios en PautaSistema.js, nada en MedicionDatos.js):**

- **A. Piso de volumen para escalar.** Regla nueva `reservas_min_escalar` (propuesta: 6 reservas atribuidas sumando las 2 semanas). Por debajo, el conjunto queda en MANTENER con la razón "volumen insuficiente para juzgar". La serie al alza sigue siendo condición, pero ya no alcanza.
- **B. "El negocio no baja" = contra la meta, no contra sí mismo.** Para ESCALAR: comensales de la semana ≥ ritmo semanal de la meta del mes (meta ÷ semanas del mes) **y** reservas de Wix ≥ su base. Si la lectura de Wix del mes es ≥50%, además clientes nuevos al ritmo de su meta; si es <50%, se dice "clientes nuevos sin dato" y no se usa. La meta se lee de la misma fuente que ya usa la franja "Mi palanca" (función existente, solo lectura).
- **C. Métrica juez de las pruebas.** Entra `clientes_nuevos_negocio` (con la guarda de lectura). Sale `reservas_atribuidas`, que queda como columna de diagnóstico. Juez posible: reservas Wix, comensales, clientes nuevos, NewReservation del pixel a nivel cuenta.

Además, la tarjeta de la cuenta en ⚖️ muestra comensales de la semana contra ritmo de meta y clientes nuevos con su lectura, para que la decisión y la meta se vean en la misma pantalla.

---

## 3. Retiro del Panel de Asesores (inventario)

**24 sitios en 5 archivos del código vivo**, más documentación:

| Archivo | Sitios | Qué |
|---|---|---|
| `Marketing.html` | 20 | pestaña 🧠 (nav + sección 316-341), `ASESORES`, `PANEL_PROMPT`, `renderPanel`/`debatir`/`debReplica`/`renderDebHist`, botón "Debatir en el panel" de Propuestas, `rosanta_deb` en `OS_MAP` y en Traer/Enviar/Exportar, Estrategia "AI CMO" (título, `estRegen`, PDF), `SAVANNAH` + `genPauta` + 2 notas "Lente Savannah", 5 párrafos del Manual, aviso "Apruébalas en el Panel de Asesores" |
| `Servicios.js` | 1 | `panelInvestigar` (búsqueda web del Panel) |
| `MarketingDatos.js` | 1 | `debates` en `SCHEMA` |
| `PautaSistema.js` | 2 | comentarios que citan al Panel |
| `rosanta-marketing-os/Code.js` | historia | semillas de aprendizajes de agosto: proyecto viejo, no se toca |

**Qué se quita:** pestaña 🧠 completa, debates, `panelInvestigar`, AI CMO, lente Loomer (ya no tenía uso fuera del Panel), `debates` de `SCHEMA`.

**La Estrategia, que dependía de ellos.** Su texto fijo contradice a Medición en cinco puntos: North Star "reservas atribuidas/mes (SonTickets con UTM)", presupuesto US$440 (supuesto por verificar), Fase 1 "con la campaña de VisitasIG" (supuesto por verificar), KPIs de salud de pauta como KPIs maestros, y "cada lunes el analista de pauta reporta" (retirado). Propuesta:
- El North Star y los KPIs pasan a apuntar al Sistema de Medición: comensales del mes, clientes nuevos y CAC ≤Q60 con su guarda.
- **Se retira "🔄 Regenerar con aprendizajes"**: es el AI CMO con otro botón, o sea la tercera voz. La estrategia se reescribe a mano cuando Juanma lo decida. `EST_CONTEXT` + `psSupuestosVerificados` se quedan solo si otro generador los usa; si no, salen.
- **Propuestas del equipo** se quedan, y "Debatir en el panel" pasa a "Registrar como prueba" (bitácora).

**Datos, sin borrar.** La pestaña `debates` se renombra a `debates_OBSOLETO_2026-09-27`, con una nota en A1 de otra pestaña o en la primera fila: "Panel de Asesores retirado el 27-sep-2026 por decisión de Juanma: tercera voz que contradecía al sistema de decisión y al de Medición. Solo historial." Al salir de `SCHEMA`, `mktReplace` ya no la puede tocar. Los 3 aprendizajes de agosto con fuente "Panel de Asesores" se quedan, pero el Creador no los lee (ver 4c).

**Aviso a la otra sesión.** Nota en el cerebro y memoria del proyecto: "Panel retirado, no construir sobre él". La sesión "Panel de asesores de marketing" no se toca; si Juanma quiere, se le manda el aviso.

---

## 4. Estándar creativo de pauta (sucesor de la lente Savannah)

- **a)** `SAVANNAH` → `ESTANDAR_PAUTA`: las seis reglas como regla de la casa, sin nombres ni URLs. Siguen las prohibiciones ("de autor", "signature", "Jardín Santa Rosa", "leña de café"). A cámara: Jeffry, Maco o clientes reales.
- **b)** "Qué medir a los 7 días" deja de tener números fijos: el prompt recibe los umbrales de `reglas` y solo los supuestos **verificados** (`psSupuestosVerificados`). Hoy `s_definicion_video` (hook y retención) está por verificar, así que **el hook rate no se pide**; entra solo cuando Juanma verifique ese supuesto. El juez de cada concepto: reservas / clientes nuevos.
- **c)** Botón **"Registrar como prueba"** por concepto → `psGuardarPrueba` con hipótesis, cambio único (el concepto nuevo) y métrica juez (reservas Wix o clientes nuevos). Entra como `propuesta`: la regla de una prueba en curso a la vez y "solo el dueño la arranca" ya la cumple el servidor. El Creador lee como contexto solo los aprendizajes con fuente `prueba` (los que dejó una prueba leída), no los del Panel.
- **d) Skill local `rosanta-pauta-creativa`: no por ahora.** Serían dos copias del mismo estándar y se desalinean en semanas (pasó con el cerebro y con Wilson). Si hace falta usarlo fuera, la skill lee la constante del repo en vez de copiarla.

---

## 5. Commits y batería

1. Retiro del Panel y de las lentes.
2. Estándar creativo de pauta + "Registrar como prueba".
3. Congruencia con Medición (A, B, C).

**MIN_SRV:** Marketing tiene hoy 26 llamadas `srv('…')`. Sale `panelInvestigar` (−1) y entra un `psGuardarPrueba` (+1): queda en ~26, lejos del mínimo de 10. No hace falta bajarlo; se corrige el comentario que dice "14".

**Pruebas nuevas:**
- `ESTANDAR_PAUTA` no nombra personas (Savannah, Sanchez, Loomer, Wilson, URLs de expertos).
- Marketing.html ya no llama `panelInvestigar` ni escribe `debates`.
- Registrar como prueba entra como `propuesta`, y una segunda prueba `en_curso` se rechaza.
- R3 no escala bajo el piso de volumen, ni con comensales bajo el ritmo de meta.
- Clientes nuevos como juez se rechaza con lectura <50%.

Todo con el arnés de Node y `node --check` por plantilla. Publicar solo con batería en /dev y el "sí" de Juanma. Vuelta atrás: `update-deployment` a la @131.

---

## 6. Aviso para Vanessa (borrador)

> Vanessa, dos cambios en la pestaña de Marketing de la intranet:
>
> **1. El botón 🧠 Diagnóstico IA ya no existe.** Recomendaba escalar campañas mirando CTR y costo por clic sin ver una sola reserva. Ya no se decide así.
>
> **2. Las decisiones salen ahora de ⚖️ Decisiones de pauta.** Cada lunes:
> 1. Entrá a Marketing › ⚖️ Decisiones de pauta.
> 2. Arriba sale **una sola decisión de la semana** (por ejemplo "corregir", "apagar", "no mover nada") con la regla que la dispara. Esa es la acción de la semana.
> 3. Si un conjunto sale en 🔴, primero se corrige el dato; hasta entonces no se juzga.
> 4. Ejecutás la decisión en Meta y la anotás en la **bitácora de pruebas**: qué cambiaste, por qué y con qué número se va a juzgar. Solo corre una prueba a la vez, y la arranca Juanma.
> 5. Lo que se juzga son reservas y clientes nuevos, no clics.
>
> **3. Arriba del Dashboard de Pauta está tu franja "Mi palanca":** clientes nuevos del mes contra tu meta (octubre 40), el CAC contra Q60 y los comensales del mes. Si el CAC sale en gris no es tuyo: significa que falta cerrar mesas en Wix y el dato no se puede leer.

---

## 7. Ejecución (27-sep-2026, tarde, con el "sí" de Juanma)

| Commit | Qué |
|---|---|
| `0f2dc6f` | Retiro del Panel, lentes, AI CMO; `debates` fuera de `SCHEMA`; Estrategia apunta al Sistema de Medición; `harness-pauta.js` |
| `acd6b3d` | `ESTANDAR_PAUTA`, `psContextoCreativo`, "Registrar como prueba" (Creador y Propuestas), `psReglasPrueba_` |
| `beec65e` | R3 amarrada a Medición (`reservas_min_escalar`, `lectura_min_juez`, `psMetasSemana_`), `clientes_nuevos_negocio` entra y `reservas_atribuidas` sale como juez, tarjetas de la cuenta |

- Arnés (`node tools/harness-intranet/harness-pauta.js`): grupo 9 con **26 pruebas, 26 OK**; guardas de srv(): 65 llamadas con cerradura, 26 `srv('…')` en Marketing (mínimo 10, sin cambio). Controles negativos: la prueba del estándar falla si se mete un nombre; el compilador de plantillas falla con JS roto.
- `node --check` a los 37 `.js` y a los `<script>` de todas las plantillas: OK.
- Antes del push, HEAD bajado aparte = commit 3c2cd87 (73 archivos, sin diferencias). Después del push, HEAD bajado aparte = git. **Producción sigue en la @131.**
- `MedicionDatos.js`, `TableroDatos.js` y `CrmDatos.js` no se tocaron: solo se leen.
- Cerebro v29 instalado en las dos rutas y en `rosanta-cerebro/`; memoria del proyecto; las dos memorias viejas de Cowork del Panel quedaron marcadas OBSOLETO.

**Falta, de Juanma:** capturar la semana, confirmar el activador, correr la batería en /dev, renombrar la pestaña `debates`, dar el sí para publicar (y decidir si se envía el aviso a Vanessa).

**29-sep-2026:** el aviso a Vanessa (actualizado a la @156) lo envió Juanma por WhatsApp, junto con el de recargar Marketing y el del vigía a José y Jeffry. Textos en `2026-09-29_p209_avisos_equipo.md`.
