# ROSANTA OS — Brief de organización para Code

> Documento maestro para un agente de código (Claude Code). Objetivo doble:
> 1. **Reorganizar** todas las carpetas (computadora local + Google Drive) al formato Rosanta OS.
> 2. **Estandarizar** de aquí en adelante todas las tareas y proyectos bajo ese mismo formato.
>
> Autor del contexto: Juanma (Juan Manuel Lemus) · restaurante@rosanta.rest
> Fecha: 17 ago 2026

---

## 1. Contexto del negocio

- **Rosanta** — restaurante de gastrococtelería en Antigua, Guatemala. Cocina creativa de temporada + mixología. Ingredientes locales y sostenibles.
- **Entidad legal:** CORSAGA, S.A. · **Dueño/operador:** Juanma.
- **Stack actual:**
  - **Google Drive** (cuenta `restaurante@rosanta.rest`) = hub de archivos. **Este es el destino a reorganizar.**
  - **PosFile** (`system.posfile.com`) = POS/facturación (FEL).
  - **WIX** (`rosanta.rest`) = sitio + reservas/ticketing (migrando desde SonTickets).
  - **Intranet propia** en Google Apps Script (marketing activo; finanzas/otros por activar).
  - **Meta Ads + Instagram/Facebook** orgánico.
  - **Cowork/Claude** = artefactos vivos (tracker, dashboards, checklists) — NO son archivos de Drive, se listan aparte en §6.
- **Maestro financiero:** `Rosanta_Reporte_Maestro_v2_2026.xlsx` (en Drive).

---

## 2. El marco: Rosanta OS (The Scaling Engine OS, Alex Yanovsky)

Metodología de 6 pilares donde cada uno se construye sobre el anterior. **La organización de carpetas y de proyectos se hace por estos 6 pilares.** Marcos transversales: 3 niveles de propiedad (Operador → Gerente de gerentes → Dueño) y el Freedom Asset Blueprint (Operaciones · Liderazgo · Economía).

| # | Pilar (sección) | Qué cubre | Temas / entregables |
|---|---|---|---|
| 1 | **Business Fundamentals** | Base: identidad, metas, alfabetización financiera, herramientas | Six-Pillar Audit, Stop Doing List, Management Level Audit, 5-Element Map, Owner Dependency Score, extracción de 5 números del P&L, Tech Stack Audit, Operations Hub |
| 2 | **Management OS** | Contratar, entrenar y delegar propiedad de tareas | Organigrama, H.O.T. Canvas, Replacement Ladder, scorecards de 7 pasos, mapas de proceso (apertura/cierre, FOH, BOH), pipeline de contratación, ritmos de reunión, procedimientos (SOP) |
| 3 | **Finance & Data OS** | Números y decisiones con data | Data Integrity Audit, hoja de métricas, chart of accounts, conciliación de planilla, separación del P&L, break-even, modelos de escenarios, forecaster, flujo de caja, dashboards de KPIs |
| 4 | **Profit OS** | Margen: que la venta deje utilidad | Costeo de recetas, Menu Profitability Matrix, planes de precio, bitácora de merma, comparador de proveedores, horarios, SPLH, AOV, LTV, reparto de utilidades |
| 5 | **Marketing OS** | Adquisición, retención y marca sin descontar | Marketing Readiness Scorecard, channel tracker, cálculo de CAC, dashboard de KPIs, base de influencers, calendario de contenido, auditoría de delivery, lead capture, pipeline de catering |
| 6 | **Expansion OS** | Escalar (solo con 1–5 sólidos) | Expansion Readiness Test, franquicia, estructura de entidad, inversionistas, pitch deck, location scorecard, ghost kitchen, secuencia de lanzamiento, 9-Figure Roadmap |

Regla mental: **1** pone la base, **2** arma el equipo, **3** da los números, **4** exprime el margen, **5** trae y retiene clientes, **6** replica el modelo.

---

## 3. Objetivo del trabajo de Code

**(A) Reorganización.** Inventariar todo lo que existe hoy (Drive + carpetas locales de la Mac), proponer un árbol nuevo bajo el formato del §4, y migrar cada archivo/carpeta a su lugar sin perder nada.

**(B) Estándar a futuro.** Dejar establecida la convención (§4, §7) para que todo proyecto o tarea nuevo nazca ya clasificado por pilar.

---

## 4. Taxonomía objetivo (Operations Hub = 6 pilares)

Carpeta raíz única en Drive. Las 6 secciones del Operations Hub SON los 6 pilares. Prefijos numéricos para orden fijo.

```
Rosanta OS/                         ← hub único (raíz)
├── 00_Admin/                       ← legal CORSAGA, contratos, Logins & Tools DB, accesos, este brief
│   ├── Logins_y_Herramientas.xlsx
│   └── Legal_CORSAGA/
├── 01_Business_Fundamentals/
│   ├── Six_Pillar_Audit/
│   ├── Identity_StopDoing/
│   ├── PnL_5_Numeros/
│   └── Tech_Stack_Audit/
├── 02_Management_OS/
│   ├── Organigrama_HOT_Canvas/
│   ├── Replacement_Ladder/
│   ├── Scorecards_7_pasos/
│   ├── Procedimientos_SOP/        ← Sala, Barra, M1, Cocina
│   ├── Mapas_de_Proceso/          ← apertura/cierre, FOH, BOH
│   └── Contratacion/
├── 03_Finance_Data_OS/
│   ├── Maestro/                    ← Rosanta_Reporte_Maestro_v2_2026.xlsx
│   ├── Bancos_y_Conciliaciones/    ← BI, BAC, TC, FEL, POS
│   ├── Planilla_y_Propinas/
│   ├── DRE_y_BreakEven/
│   ├── KPIs_Dashboard/
│   └── Reportes_Contador/
├── 04_Profit_OS/
│   ├── Recetario/
│   ├── Costeo/                     ← costos de compra barra, costeo por trago
│   ├── Ingenieria_de_Menu/
│   ├── Carta_y_Precios_POS/        ← carta 2027, cambios/actualización POS, inventarios
│   ├── Proveedores/
│   └── Merma_y_Horarios_SPLH/
├── 05_Marketing_OS/
│   ├── Scorecard_Marketing/
│   ├── Contenido_y_Calendario/
│   ├── Pauta_Meta_y_CAC/
│   ├── Resenas_y_Reputacion/
│   ├── CRM_y_Retencion/
│   ├── SEO_Local/
│   ├── Reservas_WIX/               ← migración SonTickets→WIX, analítica del sitio
│   └── Eventos_y_Cotizaciones/
├── 06_Expansion_OS/                ← vacío por ahora (placeholder)
├── _Templates/                     ← plantillas OS (1.x, 2.x) reutilizables
├── _Inbox/                         ← todo lo nuevo o sin clasificar entra aquí y se rutea
└── _Archive/                       ← temporadas viejas, versiones anteriores, descontinuados
```

### Convención de nombres de archivo
`AAAA-MM-DD_Tema_vN.ext` (fecha ISO al inicio para ordenar). Ejemplos:
`2026-08-17_Costos_Compra_Barra_v1.xlsx`, `2026-08-12_Procedimiento_Sala_v3.docx`.
- Sin espacios raros ni acentos en nombres de carpeta (usar guion bajo). Sí acentos en títulos internos.
- Versionar con `_vN`; la última versión vive en la carpeta, las anteriores van a `_Archive/`.

---

## 4-bis. Carpetas locales (Mac) — documentos y código

En la Mac viven dos cosas distintas que **no van al mismo lado**: (a) los **documentos/entregables** que se generan o descargan, y (b) los **repositorios de código** (Apps Script/clasp, scripts, sitio). El código NO se archiva en el árbol de pilares; se agrupa aparte.

**Dónde inventariar (rutas típicas):**
- `~/Downloads` — bandeja de exports (POS, banco, inventarios). Es el `_Inbox` de facto.
- `~/Desktop` y `~/Documents` — documentos sueltos.
- `~/Claude/Artifacts/` — artefactos vivos de Cowork. **Solo lectura / referencia, NO mover.**
- Repos de código donde estén: detectarlos buscando `.git`, `package.json`, `.clasp.json`, `appsscript.json`.
- iCloud Drive, si aplica.

**Estructura objetivo local:**
```
~/Rosanta OS/                 ← espejo local de DOCUMENTOS (mismos 6 pilares que Drive)
│   00_Admin, 01_Business_Fundamentals … 06_Expansion_OS, _Templates, _Inbox, _Archive
│   (ideal: que esta carpeta SEA la de Google Drive sincronizada, para que local y nube sean lo mismo)
~/Dev/Rosanta/                ← TODO el código, un repo por carpeta
├── intranet-apps-script/
├── bot-whatsapp/
├── sitio-wix/                (si aplica)
└── scripts/                  ← utilitarios sueltos
```

**Reglas específicas locales:**
- **Documentos** → `~/Rosanta OS/<pilar>/…` con la convención de nombres del §4. Si `~/Rosanta OS/` es la carpeta de Drive sincronizada, se archiva una sola vez y queda en ambos lados.
- **Código** → cada repo es **unidad atómica**: no reorganizar por dentro, no mover `.git`, no tocar `node_modules`/`build`/`dist` ni archivos ignorados por git. Solo agrupar los repos bajo `~/Dev/Rosanta/`.
- **Downloads/Desktop = inbox:** barrer cada archivo a su pilar; lo dudoso a `_Inbox/`.
- No confundir un **export de datos** (documento → pilar) con un **archivo de un repo** (queda dentro del repo).

---

## 5. Reglas de mapeo (a qué pilar va cada cosa)

| Si el archivo/tema es sobre… | Va a |
|---|---|
| Auditorías del negocio, identidad, tech stack, este OS | **01** Business Fundamentals |
| Organigrama, roles, SOP/procedimientos, scorecards de gente, contratación | **02** Management OS |
| Maestro, bancos, planilla, P&L, break-even, KPIs financieros, contador | **03** Finance & Data OS |
| Recetas, costeo, ingeniería de menú, carta/precios, POS de producto, proveedores, merma | **04** Profit OS |
| Contenido, pauta, CAC, reseñas, CRM, SEO, reservas/WIX, eventos/cotizaciones | **05** Marketing OS |
| Multi-unidad, franquicia, inversionistas, nuevas ubicaciones | **06** Expansion OS |
| Legal, contratos, accesos, base de logins | **00** Admin |
| Plantilla reutilizable | **_Templates** |
| **Repositorio de código** (git, clasp, scripts, sitio) | **`~/Dev/Rosanta/`** (NO al árbol de pilares) |
| Export de Downloads (POS, banco, inventario) | Pilar que corresponda (03 Finance / 04 Profit) o **_Inbox** |
| No estás seguro | **_Inbox** (nunca borrar; rutear después) |

**Casos de duda ya resueltos:**
- CAC → Marketing OS (no finanzas).
- 5 números del P&L y KPIs financieros → Finance & Data OS (intranet de finanzas).
- Reservas/ticketing (WIX) → Marketing OS (canal de venta), subcarpeta Reservas_WIX.
- Inventarios del POS y cambios de carta → Profit OS (Carta_y_Precios_POS).

---

## 6. Estado actual por pilar (para contexto de Code)

Existe pero probablemente **disperso** en Drive y en carpetas locales. Ubicarlo y moverlo:

- **01 Business Fundamentals:** comparativo Six-Pillar hecho; plantillas 1.3 (Logins), 1.5 (Niveles de gerencia), 1.8 (5 números P&L) adaptadas; Tech Stack Audit cerrado; documento `The scaling Engine OS.docx`.
- **02 Management OS:** casi todo construido — organigrama, H.O.T. Canvas, Replacement Ladder, clasificación de jugadores, pipeline, ritmos de reunión, panel 3 señales, mapas apertura/cierre + FOH + BOH, scorecard 7 pasos, y **procedimientos** de Sala, Barra, M1 y Cocina (docx).
- **03 Finance & Data OS:** `Rosanta_Reporte_Maestro_v2_2026.xlsx`; conciliaciones BI/BAC/TC; planilla/propinas. **Pendiente:** vista Finanzas v1 (DRE) + 5 números semanales.
- **04 Profit OS:** costeo de barra (`Rosanta_Costos_Compra_Barra.xlsx`), ingeniería de menú, carta 2027, checklists de cambios/actualización del POS, inventarios PosFile, recetario de barra y de cocina.
- **05 Marketing OS:** scorecard con meta de reseñas; contenido y pauta; CRM; SEO local; cotizaciones de eventos. **Pendiente:** CAC + analítica WIX.
- **06 Expansion OS:** nada aún.

**Artefactos vivos en Cowork** (NO son archivos de Drive; dejarlos referenciados en un índice, no moverlos): `rosanta-seguimiento-semanal` (tracker), `rosanta-actualizar-precios-pos`, `rosanta-costos-compra-barra`, `rosanta-stack-audit`, `rosanta-crm`, `panel-operativo-rosanta`, `morning-brief-juanma`, entre otros.

---

## 7. Estándar para tareas y proyectos futuros

- **Todo proyecto nace con su pilar.** Nombre de carpeta de proyecto: `PILAR-Nombre` con código de pilar: `BF`, `MGMT`, `FIN`, `PROFIT`, `MKT`, `EXP`. Ej.: `FIN-Finanzas_v1`, `MKT-CAC_WIX`.
- **Tracker maestro:** artefacto `rosanta-seguimiento-semanal`. Cada pendiente lleva `proyecto` (alineado al pilar), `nivel` (N1 crítico / N2 impulso / N3 mantenimiento) y `donde` (dónde retomarlo). El ritual de cierre (skill `cierre`, comando "Consolidar tablero") lo mantiene al día.
- **Entregables de cada sesión** se guardan en la subcarpeta del pilar correspondiente, con el nombre versionado del §4, y se referencian en el tracker.
- **_Inbox como puerta de entrada:** lo que no se clasifica al instante cae en `_Inbox/` y se rutea en el siguiente cierre.
- **Artefactos vivos:** viven en Cowork, NO se mueven al Drive. Cada pilar lleva un `_Indice_Artefactos.md` que los referencia (ver `_Indice_Artefactos.md` maestro entregado). Opcional: renombrarlos con el prefijo `Rosanta · 0X` para agruparlos en la barra lateral de Claude.
- **Proyectos de Claude:** nombrar `Rosanta · 0X [Pilar] · [Tema]` (mismo esquema); los no-Rosanta se prefijan `Personal ·` o con el nombre del cliente.

---

## 8. Reglas de ejecución para Code (no romper nada)

1. **Primero inventario, luego plan, luego mover.** Generar un `INDICE_ANTES.md` con todo lo encontrado (ruta, tamaño, fecha) antes de tocar nada.
2. **Dry-run obligatorio:** proponer el mapeo completo (origen → destino) en una tabla y esperar aprobación de Juanma antes de ejecutar movimientos.
3. **Nunca borrar.** Mover = copiar al destino, verificar, y solo entonces retirar el original a `_Archive/` (no a la papelera).
4. **Google Drive es cloud-only / streaming.** No forzar la descarga masiva de archivos. Trabajar con la API de Drive o mover por referencia; avisar antes de descargar lotes grandes.
5. **Log de cada movimiento** en `LOG_MIGRACION.md` (origen, destino, timestamp).
6. **Duplicados:** detectarlos por nombre+hash; conservar la última versión en la carpeta y las demás en `_Archive/`.
7. **Confirmar antes de cualquier acción irreversible** o que afecte accesos/compartidos.
8. **Código = intocable por dentro.** Tratar cada repo git como unidad atómica: no reorganizar su interior, no mover `.git`, no tocar `node_modules`/`build`/`dist` ni lo ignorado por git. Solo agrupar repos bajo `~/Dev/Rosanta/`. No mezclar código con documentos.
9. **Al terminar:** entregar `INDICE_DESPUES.md` (árbol final) y un `README.md` en la raíz `Rosanta OS/` explicando la estructura y el estándar del §7.

---

## 9. Entregables esperados de Code

1. `INDICE_ANTES.md` — inventario actual (Drive + local: Downloads, Desktop, Documents).
2. Tabla de mapeo propuesta (origen → destino) para aprobación.
3. Árbol `Rosanta OS/` (Drive + espejo local) y `~/Dev/Rosanta/` creados según §4 y §4-bis.
4. `LOG_MIGRACION.md` — bitácora de movimientos.
5. `INDICE_REPOS.md` — lista de repos de código (ruta, propósito, a qué pilar del negocio sirve).
6. `INDICE_DESPUES.md` + `README.md` en la raíz.
7. `_Indice_Artefactos.md` (maestro en `00_Admin/` + bloque por pilar en cada carpeta) — ya entregado, integrar.
8. Confirmación de que los artefactos vivos de Cowork quedaron referenciados (no movidos).

---

### Anexo — rutas conocidas
- **Drive (hub a reorganizar):** cuenta `restaurante@rosanta.rest` (Google Drive).
- **Maestro financiero:** `Rosanta_Reporte_Maestro_v2_2026.xlsx`.
- **Documento fuente del método:** `The scaling Engine OS.docx`.
- **Tracker de tareas:** artefacto Cowork `rosanta-seguimiento-semanal` (no es archivo de Drive).
