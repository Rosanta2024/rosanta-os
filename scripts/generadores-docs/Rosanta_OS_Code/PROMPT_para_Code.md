# Prompt para Code — Terminar la reorganización Rosanta OS

> Pégale este texto a Code y adjúntale los 3 archivos de este paquete
> (ROSANTA_OS_Brief_para_Code.md, ROSANTA_OS_Auditoria.md, _Indice_Artefactos.md).

---

Eres un agente de código. Vas a terminar la reorganización de archivos de Rosanta
siguiendo el sistema "Rosanta OS" (6 pilares). Trabaja de forma segura y por fases.

CONTEXTO
- Negocio: Rosanta (CORSAGA, S.A.), restaurante en Antigua, Guatemala. Dueño: Juanma
  (restaurante@rosanta.rest). Hub de archivos = Google Drive de esa cuenta.
- Documentos de referencia adjuntos (léelos primero):
  1) ROSANTA_OS_Brief_para_Code.md  → la especificación completa (taxonomía, reglas de mapeo,
     convención de nombres, reglas de ejecución seguras).
  2) ROSANTA_OS_Auditoria.md        → estado de artefactos/proyectos/carpetas y acciones.
  3) _Indice_Artefactos.md          → índice de artefactos por pilar (va en 00_Admin).
- Los 6 pilares: 01 Business Fundamentals, 02 Management OS, 03 Finance & Data OS,
  04 Profit OS, 05 Marketing OS, 06 Expansion OS. Más 00_Admin, _Templates, _Inbox, _Archive.

ESTADO ACTUAL (ya hecho, NO recrear)
- En Google Drive ya existe la carpeta raíz "Rosanta OS" con:
  00_Admin, 01_Business_Fundamentals, 02_Management_OS (con subcarpeta Procedimientos_SOP),
  03_Finance_Data_OS, 04_Profit_OS, 05_Marketing_OS, 06_Expansion_OS, _Archive y README.md.
- FALTAN por crear: _Templates y _Inbox.
- Los ARTEFACTOS de Claude/Cowork NO se tocan (no hay API; los gestiona el usuario). Solo se
  referencian con _Indice_Artefactos.md.

OBJETIVO
Que todo archivo (Drive + Mac local) y todo repo de código queden correctamente ubicados
dentro de su pilar, sin perder nada, y dejar índices que lo documenten.

TAREAS (en este orden)
1) INVENTARIO. Recorre Google Drive y las carpetas locales (~/Downloads, ~/Desktop, ~/Documents,
   iCloud si aplica) y genera `INDICE_ANTES.md` (ruta, tipo, tamaño, fecha) de todo lo de Rosanta.
   Detecta repos de código buscando .git, package.json, .clasp.json, appsscript.json.
2) MAPEO (dry-run). Propón una tabla origen→destino para cada archivo/carpeta según las reglas del
   Brief (§5). NO muevas nada todavía: espera mi aprobación.
3) EJECUCIÓN (tras aprobación):
   - Crea `_Templates/` y `_Inbox/` en "Rosanta OS".
   - Mueve cada archivo a su pilar. Mover = copiar al destino, verificar, y recién entonces
     retirar el original a `_Archive/` (NUNCA borrar, nunca vaciar papelera).
   - Google Drive es cloud-only/streaming: trabaja por API o pide confirmación antes de descargar
     lotes grandes.
   - Código: agrupa los repos bajo `~/Dev/Rosanta/`. Cada repo es unidad atómica: no reorganices
     su interior, no muevas .git, no toques node_modules/dist/build ni lo ignorado por git.
   - Coloca `_Indice_Artefactos.md` en `00_Admin/`.
4) ENTREGABLES: `LOG_MIGRACION.md` (cada movimiento con timestamp), `INDICE_REPOS.md`
   (repos: ruta, propósito, pilar del negocio al que sirve), `INDICE_DESPUES.md` (árbol final)
   y actualiza el `README.md` de la raíz con la estructura y el estándar.

REGLAS DE SEGURIDAD (obligatorias)
- Nunca borrar; solo mover a _Archive.
- Confirmar conmigo antes de cualquier acción irreversible o que afecte accesos/compartidos.
- Respetar que los artefactos de Cowork y los proyectos de Claude NO son tu tarea.
- Ante duda de clasificación → carpeta `_Inbox/` y me consultas.

Empieza por el paso 1 (INDICE_ANTES.md) y la tabla de mapeo del paso 2, y detente ahí para que
yo apruebe antes de mover nada.
