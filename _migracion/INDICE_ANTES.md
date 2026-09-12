# INDICE_ANTES.md — Inventario previo a la migración

> Rosanta OS · generado el 2026-08-24 · **nada se ha movido todavía**

Fuentes recorridas: Google Drive (`restaurante@rosanta.rest`, sincronizado en `~/My Drive`), `~/Downloads`, `~/Desktop`, `~/Documents`, `~/Capturas`, `~/Dev`, iCloud Drive y el directorio de salidas de Cowork.

## 0. Resumen

| Área | Elementos | Peso | Estado |
|---|---:|---:|---|
| Google Drive · `Rosanta OS/` | 6 784 rutas (6 011 archivos) | — (cloud) | Ya migrado en su mayoría |
| `~/Downloads` | 744 archivos + 8 carpetas | 1.6 GB | **Sin clasificar** — inbox de facto |
| `~/Desktop` | 6 archivos | 2.4 MB | Sin clasificar |
| `~/Documents` | solo `Claude/Projects` (metadatos de la app) | 1.4 MB | No requiere acción |
| `~/Capturas` | 228 screenshots | 36 MB | Volcado — se deja en su lugar |
| Cowork · `outputs/` | 130 archivos + 4 carpetas | 12 MB | **Sin clasificar** — mezcla código + entregables |
| `~/Dev/Rosanta` | 10 repos/carpetas | 60 MB | Ya agrupado correctamente |
| iCloud Drive | sin contenido de Rosanta | — | Sin acción |

**Total de elementos evaluados para mover: 1 109.**

## 1. Google Drive — `Rosanta OS/` (estado actual)

La raíz y los 6 pilares ya existen. Distribución de archivos por pilar:

```
Rosanta OS/
├── 00_Admin/                        413 archivos
│   ├── Apps_Script_e_IA/             81   ├── Inmueble_y_Ocupacion/  141
│   ├── Historico_Admin/             139   ├── Legal_CORSAGA/          16
│   ├── Migracion_2026-08/             9   └── Servicios_del_Local/    24
├── 01_Business_Fundamentals/         41 archivos
│   └── Identity_StopDoing · PnL_5_Numeros · Six_Pillar_Audit · Tech_Stack_Audit (1 c/u)
│      + 37 archivos SUELTOS en la raíz del pilar  ← incluye 18 plantillas del método
├── 02_Management_OS/                197 archivos
│   ├── Empleados/                   174   ├── Procedimientos_SOP/      9
│   └── Contratacion · Mapas_de_Proceso · Organigrama_HOT_Canvas · Replacement_Ladder
│       · Scorecards_7_pasos (1 c/u)  + 8 archivos SUELTOS en la raíz
├── 03_Finance_Data_OS/            4 032 archivos
│   ├── Bancos_y_Conciliaciones/   3 152   ├── Finanzas & Contabilidad/ 583
│   ├── Historico_Ventas/            266   ├── MAESTRO (1)/             17
│   ├── KPIs_Dashboard/                7   ├── Rentabilidad /            5
│   └── Planilla_y_Propinas/           1
├── 04_Profit_OS/                    465 archivos
│   ├── Ingenieria_de_Menu/          183   ├── Proveedores/           178
│   ├── Carta_y_Precios_POS/          58   ├── Recetario/              23
│   ├── Costeo/                       19   └── Merma_y_Horarios_SPLH/   1
├── 05_Marketing_OS/                 861 archivos
│   ├── Historico_Marketing/         327   ├── Workspace_Pauta/       180
│   ├── CRM_y_Retencion/             112   ├── Marca_y_Assets/         71
│   ├── Eventos_y_Cotizaciones/       71   ├── Contenido_y_Calendario/ 34
│   ├── Rosanta (1)/                  16   ├── 1. Entregables/         10
│   ├── 3. IA Gastronomico/            9   ├── 2. Trafico/              6
│   ├── Pauta_Meta_y_CAC/              4   ├── Resenas_y_Reputacion/    2
│   ├── SEO_Local/                     2   ├── Reservas_WIX/            1
│   └── Scorecard_Marketing/           1   + 14 archivos SUELTOS en la raíz
├── 06_Expansion_OS/                   1 archivo (placeholder)
├── _Archive/                          4 backups del Maestro
└── README.md

```

**Faltan por crear:** `_Templates/` y `_Inbox/`.

**Anomalías detectadas en Drive** (a corregir en la ejecución):

| Qué | Dónde | Problema |
|---|---|---|
| 18 archivos `Copy of (2.x) … Scaling Engine OS` | `01_Business_Fundamentals/` | Son plantillas del pilar 02 → van a `_Templates/` |
| `Copy of (1.3/1.5/1.8) …` | `01_Business_Fundamentals/`, `00_Admin/` | Idem → `_Templates/` |
| 8 SOP sueltos (`SOP Rosanta`, `Rosanta SOPs`, `Manual del Empleado`…) | raíz de `02_Management_OS/` | Deben estar en `Procedimientos_SOP/` |
| 7 menús/cartas PDF (`Menu2025_VF`, `Menu navideño`…) | raíz de `05_Marketing_OS/` | Regla §5: carta → `04_Profit_OS/Carta_y_Precios_POS/` |
| `Contrato Rosanta FIRMADO.pdf`, `Contrato Rosanta.gdoc` | raíz de `05_Marketing_OS/` | Legal → `00_Admin/Legal_CORSAGA/` |
| `Registro de ventas - Rosanta.gsheet` | raíz de `05_Marketing_OS/` | Ventas → `03_Finance_Data_OS/Historico_Ventas/` |
| `MAESTRO (1)/`, `Rosanta (1)/`, `Rentabilidad ` (espacio final) | 03 y 05 | Nombres con sufijo de duplicado / espacio final |
| `Finanzas & Contabilidad/` con `&` y espacios | 03 | Convención §4: sin espacios ni `&` |
| `1. Entregables`, `2. Trafico`, `3. IA Gastronomico` | 05 | Numeración paralela ajena al estándar |

## 2. Mac local — detalle por origen


### ~/Downloads — 752 elementos · 2 GB

| Destino propuesto | Elementos |
|---|---:|
| `~/Rosanta OS/03_Finance_Data_OS/Bancos_y_Conciliaciones/Comprobantes_2026` | 154 |
| `~/Rosanta OS/05_Marketing_OS/Marca_y_Assets/Piezas` | 73 |
| `~/Rosanta OS/_Inbox/Revisar_Imagenes` | 66 |
| `~/Rosanta OS/03_Finance_Data_OS/Bancos_y_Conciliaciones/3_Bancos` | 66 |
| `~/Rosanta OS/05_Marketing_OS/Eventos_y_Cotizaciones` | 58 |
| `~/My Drive/PERSONAL/SafeTour_INGUAT` | 50 |
| `~/Rosanta OS/05_Marketing_OS/Marca_y_Assets/Brand Kit` | 22 |
| `~/Rosanta OS/05_Marketing_OS/Contenido_y_Calendario` | 21 |
| `~/Rosanta OS/03_Finance_Data_OS/Historico_Ventas` | 21 |
| `~/My Drive/PERSONAL/Mentoria_MOW` | 19 |
| `~/Rosanta OS/_Templates/Scaling_Engine_OS` | 18 |
| `~/Rosanta OS/04_Profit_OS/Recetario` | 16 |
| `~/Rosanta OS/04_Profit_OS/Carta_y_Precios_POS` | 14 |
| `~/Rosanta OS/04_Profit_OS/Carta_y_Precios_POS/Inventarios` | 13 |
| `~/Rosanta OS/05_Marketing_OS/3. IA Gastronomico/Academia de IA` | 12 |
| `~/Rosanta OS/00_Admin/Legal_CORSAGA` | 11 |
| `~/My Drive/PERSONAL/Trekking_Viajes` | 10 |
| `~/Rosanta OS/05_Marketing_OS/Reservas_WIX` | 10 |
| `~/My Drive/PERSONAL/Acatenango_Aventuras` | 9 |
| `~/Rosanta OS/05_Marketing_OS/Pauta_Meta_y_CAC` | 9 |
| `~/Rosanta OS/_Inbox` | 8 |
| `~/Rosanta OS/03_Finance_Data_OS/Planilla_y_Propinas` | 8 |
| `~/Rosanta OS/01_Business_Fundamentals` | 6 |
| `~/Rosanta OS/05_Marketing_OS/CRM_y_Retencion` | 6 |
| `~/Rosanta OS/02_Management_OS` | 6 |
| `~/Rosanta OS/05_Marketing_OS/Scorecard_Marketing` | 5 |
| `~/Rosanta OS/01_Business_Fundamentals/Referencias` | 4 |
| `~/Rosanta OS/03_Finance_Data_OS/Finanzas & Contabilidad/00_CIERRE_MAESTRO` | 4 |
| `~/Rosanta OS/05_Marketing_OS/Marca_y_Assets` | 4 |
| `~/Rosanta OS/03_Finance_Data_OS/Finanzas & Contabilidad/IMPUESTOS` | 3 |
| `~/My Drive/PERSONAL/SIC` | 3 |
| `~/Rosanta OS/04_Profit_OS/Costeo` | 3 |
| `~/Rosanta OS/03_Finance_Data_OS/Finanzas & Contabilidad/Reportes_Contador` | 3 |
| `~/Rosanta OS/00_Admin/Servicios_del_Local` | 3 |
| `~/Rosanta OS/04_Profit_OS/Ingenieria_de_Menu` | 3 |
| `~/Dev/Rosanta/apps-script/_paquetes-instalacion` | 3 |
| `~/My Drive/PERSONAL/Varios` | 2 |
| `~/Dev/Rosanta/tools` | 2 |
| `~/Rosanta OS/05_Marketing_OS/SEO_Local` | 1 |
| `~/Rosanta OS/03_Finance_Data_OS/KPIs_Dashboard` | 1 |
| `~/Rosanta OS/04_Profit_OS/Proveedores` | 1 |
| `~/Dev/Rosanta/scripts` | 1 |

### ~/Desktop — 6 elementos · 2 MB

| Destino propuesto | Elementos |
|---|---:|
| `~/Rosanta OS/04_Profit_OS/Carta_y_Precios_POS` | 4 |
| `~/My Drive/PERSONAL/Mentoria_MOW` | 2 |

### Cowork/outputs — 123 elementos · 11 MB

| Destino propuesto | Elementos |
|---|---:|
| `~/Dev/Rosanta/scripts/generadores-docs` | 43 |
| `~/Rosanta OS/02_Management_OS` | 41 |
| `~/Rosanta OS/_Archive/Intermedios_Cowork_2026-08` | 15 |
| `~/Rosanta OS/01_Business_Fundamentals` | 10 |
| `~/Rosanta OS/00_Admin` | 4 |
| `~/Rosanta OS/04_Profit_OS/Carta_y_Precios_POS` | 3 |
| `~/Rosanta OS/03_Finance_Data_OS/Finanzas & Contabilidad/00_CIERRE_MAESTRO` | 2 |
| `~/Rosanta OS/04_Profit_OS/Costeo` | 2 |
| `~/Rosanta OS/04_Profit_OS/Ingenieria_de_Menu` | 1 |
| `(sin cambio) queda donde esta` | 1 |
| `~/Dev/Rosanta/site_repo` | 1 |

### ~/Capturas — 228 screenshots · 36 MB

Volcado de capturas de pantalla de julio–agosto 2026. **Propuesta: no mover.** No son entregables; moverlos a un pilar sólo ensucia el árbol. Si quieres, se archivan comprimidos en `_Archive/`.

### ~/Documents · iCloud Drive

`~/Documents/Claude/Projects/` contiene metadatos de la app (Reportes Financieros, Costeos, Rosanta Pauta, Presupuestos, Claude AI…), no documentos de negocio. iCloud Drive no tiene material de Rosanta. **Sin acción.**

## 3. Repositorios de código detectados

Todos ya viven bajo `~/Dev/Rosanta/`. Marcadores usados: `.git`, `package.json`, `.clasp.json`, `appsscript.json`.

| Repo | Marcador | Propósito | Pilar al que sirve |
|---|---|---|---|
| `apps-script/rosanta-intranet` | clasp | Intranet propia (recetario, costeo, finanzas) | 02 / 03 / 04 |
| `apps-script/rosanta-crm` | clasp | CRM en Apps Script (Sheet `Rosanta_CRM_Maestra`) | 05 Marketing |
| `apps-script/bot-rosanta` | clasp | Bot de WhatsApp / IG | 05 Marketing |
| `apps-script/rosanta-marketing-os` | clasp | Módulo Marketing OS de la intranet | 05 Marketing |
| `apps-script/panel-de-reseas-de-google` | clasp | Panel de reseñas de Google | 05 Marketing |
| `apps-script/consola-de-respuestas-rosanta` | clasp | Consola de respuestas a reseñas | 05 Marketing |
| `apps-script/rosanta-encuesta` | clasp | Encuesta de satisfacción | 05 Marketing |
| `rosanta-intranet-CONGELADO-jul2026` | git + appsscript | Snapshot congelado de la intranet (jul 2026) | Histórico |
| `rosanta-design-system` | package.json | Design system (tokens, assets) | 05 Marketing |
| `sitio-wix` | — | Contenido y prompts del sitio WIX + menús | 05 Marketing / 04 Profit |
| `rosanta-cerebro` | — | Skill `rosanta-cerebro` (contexto del negocio) | 00 Admin |
| `tools/` | git (ui-ux-pro-max) | Skills y utilidades de desarrollo | 00 Admin |

**A incorporar** (hoy fuera de `~/Dev/Rosanta/`):

| Origen | Qué es | Destino |
|---|---|---|
| `~/Downloads/intranet/`, `~/Downloads/modulo/` | Paquetes `.gs`+`.html` de instalación del módulo Costeo/Proveedores | `~/Dev/Rosanta/apps-script/_paquetes-instalacion/` |
| `~/Downloads/Rosanta_Modulo_Recetario_v2.zip` y 2 zips `_Proveedores_intranet` | Idem, comprimidos (2 son idénticos) | idem |
| `Cowork/outputs/site_repo/` | Repo git suelto | `~/Dev/Rosanta/site_repo/` |
| `Cowork/outputs/build_*.py` · `build_*.js` (36) | Generadores de los .docx/.xlsx/.pdf entregados | `~/Dev/Rosanta/scripts/generadores-docs/` |
| `~/Downloads/rosanta_cotizador.py` | Script del cotizador | `~/Dev/Rosanta/scripts/` |
| `Cowork/outputs/node_modules/` | Dependencias | **No se toca** |

## 4. Duplicados exactos (md5)

9 grupos · **12 copias sobrantes**. Se conserva una y el resto va a `_Archive/`.

| Se conserva | Copias idénticas a archivar |
|---|---|
| `Rosanta_Recetario_Proveedores_intranet.zip` | `Rosanta_Recetario_Proveedores_intranet_1.zip` |
| `Rosanta_Reunion enviar juanma.docx` | `Rosanta_Reunion enviar juanma (4).docx`, `Rosanta_Reunion enviar juanma (2).docx`, `Rosanta_Reunion enviar juanma (3).docx`, `Rosanta_Reunion enviar juanma (1).docx` |
| `174539_JUAN_6500002057_202682020428.pdf` | `174539_JUAN_6500002057_202682020428 (1).pdf` |
| `Rosanta_Recetario_Cocina_ enviar juanma.xlsx` | `Rosanta_Recetario_Cocina_ enviar juanma (1).xlsx` |
| `lu633d92j1.tmp` | `Rosanta_Guion_Entrenamiento_Scorecard.pdf` |
| `lu1103igzsm.tmp` | `Rosanta_Manual_CERA.pdf` |
| `index.html` | `Rosanta_Checklist_3_Procedimientos_Sala_para_Jose.html` |
| `lu513hhmsg.tmp` | `Rosanta_SOP_Sala.pdf` |
| `lu513i8ma4.tmp` | `Rosanta_Manual_LAST.pdf` |

Además hay ~40 pares casi-idénticos por sufijo `(1)`/`(2)`/`.pdf.pdf` (p. ej. `Cotizacion_Rosanta_DianaSciarrillo_BrunchBuffet_11Jul2026 (1..3).pdf`) que se resuelven conservando la fecha más reciente.

## 5. Artefactos vivos de Cowork — NO se tocan

20 artefactos en `~/Claude/Artifacts/` (16 de Rosanta + 4 personales) y 16 tareas programadas en `~/Claude/Scheduled/`. **No son archivos de Drive y quedan fuera de la migración.** Su clasificación por pilar vive en `_Indice_Artefactos.md`, que se coloca en `00_Admin/`.
