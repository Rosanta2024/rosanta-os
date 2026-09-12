# INDICE_REPOS.md — Código de Rosanta

> Todo el código vive en `~/Dev/Rosanta/`. **No entra al árbol de pilares.**

> Cada repo es unidad atómica: no se reorganiza por dentro, no se toca `.git`, `node_modules`, `dist` ni `build`.

> Actualizado: 2026-08-24

## Apps Script (clasp) — `~/Dev/Rosanta/apps-script/`

| Repo | Propósito | Pilar al que sirve |
|---|---|---|
| `rosanta-intranet` | Intranet propia: recetario, costeo, proveedores, vista de finanzas | 02 Management · 03 Finance · 04 Profit |
| `rosanta-crm` | CRM en vivo. Data en la Sheet `Rosanta_CRM_Maestra` | 05 Marketing |
| `bot-rosanta` | Bot de WhatsApp / Instagram | 05 Marketing |
| `rosanta-marketing-os` | Módulo Marketing OS de la intranet | 05 Marketing |
| `panel-de-reseas-de-google` | Panel de reseñas de Google Business Profile | 05 Marketing |
| `consola-de-respuestas-rosanta` | Consola para responder reseñas | 05 Marketing |
| `rosanta-encuesta` | Encuesta de satisfacción del comensal | 05 Marketing |
| `_paquetes-instalacion/` | Paquetes `.gs`+`.html` listos para pegar en Apps Script (módulo Costeo/Proveedores/Recetario) | 04 Profit |
| `_backups/` | Respaldos de versiones anteriores de los scripts | — |

## Otros repos y carpetas de código

| Ruta | Marcador | Propósito | Pilar |
|---|---|---|---|
| `rosanta-intranet-CONGELADO-jul2026/` | `.git` + `appsscript.json` | Snapshot congelado de la intranet (jul 2026). Referencia histórica. | — |
| `rosanta-design-system/` | `package.json` | Design system: tokens, assets, bundle | 05 Marketing |
| `sitio-wix/` | — | Contenido, prompts y menús del sitio WIX; branding | 05 Marketing · 04 Profit |
| `rosanta-cerebro/` | `SKILL.md` | Skill con el contexto del negocio | 00 Admin |
| `tools/` | `.git` (ui-ux-pro-max) | Skills y utilidades: `abogado-del-diablo`, `rosanta-brand`, `rosanta-logo`, `ui-ux-pro-max` | 00 Admin |
| `scripts/generadores-docs/` | — | 43 generadores (`build_*.py` / `build_*.js`) que producen los .docx/.xlsx/.pdf de los pilares 01–05 | transversal |
| `scripts/rosanta_cotizador.py` | — | Generador de cotizaciones de evento | 05 Marketing |
| `_migracion/` | — | Inventario y mapeo de esta migración | 00 Admin |
| `_retirado-recetario-viejo-2026-08-21/` | — | Recetario anterior, retirado | 04 Profit |

## Notas

- `Cowork/outputs/node_modules/` **no se movió**: son dependencias, no código fuente.

- `site_repo/` (venía en los outputs de Cowork) resultó ser un repo git **vacío** —0 commits, 0 archivos—; se retiró a `~/_Migrado_2026-08-24/`.

- Marcadores usados para detectar repos: `.git`, `package.json`, `.clasp.json`, `appsscript.json`.
