# ROSANTA OS — Auditoría total (artefactos · proyectos · carpetas)

> Objetivo: que cada artefacto, proyecto y archivo quede correctamente identificado dentro de su pilar.
> Fecha: 24 ago 2026 · Autor del contexto: Juanma

---

## 0. Estructura en Drive — estado (verificado)

La carpeta raíz **`Rosanta OS`** ya existe con todos los pilares:
`00_Admin · 01_Business_Fundamentals · 02_Management_OS (→ Procedimientos_SOP) · 03_Finance_Data_OS · 04_Profit_OS · 05_Marketing_OS · 06_Expansion_OS · _Archive · README.md`

**Falta crear:** `_Templates/` y `_Inbox/`.

---

## 1. Artefactos (Cowork) — 28 en total

Renombrar = manual en la app (no hay API). Solo se renombran los **vivos**.

### ✅ Renombrar (9 vivos)
| Artefacto actual | Nombre nuevo |
|---|---|
| Rosanta Seguimiento Semanal | `Rosanta · 00 Admin · Seguimiento Semanal` |
| Morning Brief Juanma | `Rosanta · 00 Admin · Morning Brief` |
| Panel Operativo Rosanta | `Rosanta · 03 Finanzas · Panel Operativo` |
| Rosanta Dashboard Semanal | `Rosanta · 03 Finanzas · Dashboard Semanal` |
| Costeo Barra Rosanta | `Rosanta · 04 Profit · Costeo Barra` |
| Rosanta Costos Compra Barra | `Rosanta · 04 Profit · Costos Compra Barra` |
| Rosanta Actualizar Precios Pos | `Rosanta · 04 Profit · Actualizar Precios POS` |
| Sistema Marketing Rosanta | `Rosanta · 05 Marketing · Sistema Marketing` |
| Rosanta Crm | `Rosanta · 05 Marketing · CRM` |

### 📦 Archivar / despinnear (one-off que ya cumplieron)
| Artefacto | Motivo |
|---|---|
| Rosanta Cambios Pos 2027 | POS ya actualizado |
| Rosanta Limpieza Pos | POS ya depurado |
| Rosanta Stack Audit | convertido en pendientes del tracker |
| Rosanta Checklist Sop Sala | revisión de José cerrada; final = docx |
| Rosanta Checklist M1 Sala | idem |
| Rosanta Inventarios May Jun 2026 | periodo viejo |
| Rosanta Comparativo Bio Gbp | puntual |

### 🗑️ Consolidar / borrar
| Artefacto | Acción |
|---|---|
| **Crm Rosanta Maestra** | Archivar. UI vieja del CRM. |
| **Crm Buscador Contactos** | Archivar. UI vieja del CRM. |
| **Rosanta Crm** | ⭐ **VIGENTE** (el más nuevo, combina buscador + KPIs). Queda como el CRM. |
| **Rosanta Tracker Workshop** | Borrar. Reemplazado por Seguimiento Semanal. |

> Nota CRM: los tres artefactos leen la MISMA Google Sheet `Rosanta_CRM_Maestra` (esa es la data maestra real, vive en Drive). Solo sobran las UIs. `rosanta-crm` es la buena.

### 🧩 Dejar como referencia (renombrar solo si los vas a mantener pinned)
Rosanta Sistema Consolidado · Rosanta Management Os · Rosanta Ruta Metas · Rosanta Scorecard 7 Pasos · Panel Resenas Rosanta · Rosanta Bot Panel.

### 🚫 Fuera de Rosanta OS (personales — no tocar)
Plan Utg 42k · Mapa Trekkings Chalten · Patagonia Feb 2027 · Mandala Kalachakra 2x3x5.

---

## 2. Proyectos (Claude) — verificar tus renombres

Convención: `Rosanta · 0X [Pilar] · [Tema]`.

| Proyecto (original) | Debería ser | Pilar |
|---|---|---|
| Reportes Financieros *(maestro)* | `Rosanta · 03 Finanzas · Maestro y reportes` | 03 |
| Rosanta Costeos y Precios | `Rosanta · 04 Profit · Costeos y precios` | 04 |
| Rosanta Operations *(SOP/cocina)* | `Rosanta · 02 Management · Operaciones y SOP` | 02 |
| Rosanta Pauta / Marketing Digital | `Rosanta · 05 Marketing · Pauta y contenido` | 05 |
| Rosanta - Branding | `Rosanta · 05 Marketing · Branding` | 05 |
| Cotizaciones de Clientes | `Rosanta · 05 Marketing · Eventos y cotizaciones` | 05 |

**Duplicados a fusionar (ojo):**
- **Rosanta Operations** aparecía 2 veces → deja 1; el genérico vuélvelo `Rosanta · 00 General / Hub` o fusiónalo.
- **Reportes Financieros** aparecía 2 veces → consolidar en 1.

**No-Rosanta (dejar aparte):** SIC (x2), Preguntas a Claude, JD Textiles, Safe Tour Certifica, Claude, How to use Claude → prefijo `Personal ·` o nombre del cliente.

---

## 3. Archivos en Drive

Esqueleto de pilares ya creado. El **inventario archivo por archivo** (qué hay hoy suelto y a qué pilar mandarlo) lo ejecuta **Code** con el `ROSANTA_OS_Brief_para_Code.md` → entrega `INDICE_ANTES.md` + tabla de mapeo para tu aprobación.

Archivos clave conocidos y su destino (referencia para Code):
| Archivo | Pilar |
|---|---|
| Rosanta_Reporte_Maestro_v2_2026.xlsx | 03 Finance / Maestro |
| Rosanta_CRM_Maestra (Sheet) | 05 Marketing / CRM_y_Retencion |
| Recetario de cocina y de barra | 04 Profit / Recetario |
| Rosanta_Costos_Compra_Barra.xlsx | 04 Profit / Costeo |
| Inventarios PosFile | 04 Profit / Carta_y_Precios_POS |
| 4 Procedimientos (Sala, Barra, M1, Día Bajo) .docx | 02 Management / Procedimientos_SOP |
| The scaling Engine OS.docx + plantillas 1.x | 01 Business Fundamentals / _Templates |
| Menú 2027 VF.pdf, Carta de vinos, Design.pdf | 04 Profit / Carta_y_Precios_POS |

---

## 4. Acciones inmediatas (checklist)

- [ ] Renombrar los **9 artefactos vivos** (tabla §1).
- [ ] Archivar los **7 one-off** + **2 CRM viejos** → mover a `_Archive` (o despinnear).
- [ ] Borrar **Rosanta Tracker Workshop**.
- [ ] Verificar que los **proyectos** renombrados coincidan con §2; **fusionar los 2 duplicados**.
- [ ] Crear en Drive **`_Templates/`** y **`_Inbox/`**.
- [ ] Subir los **4 SOP finalizados** a `02_Management_OS/Procedimientos_SOP/`.
- [ ] Dejar el **`_Indice_Artefactos.md`** en `00_Admin/` (y bloque por pilar).
- [ ] Correr **Code** con el brief para el inventario y mapeo de archivos.

---

### Resumen ejecutivo
- **Artefactos:** 9 se renombran, 9 se archivan (7 one-off + 2 CRM viejos), 1 se borra, 6 de referencia, 4 personales.
- **CRM:** `rosanta-crm` es el vigente; la data vive en la Sheet `Rosanta_CRM_Maestra`.
- **Proyectos:** alinear a `Rosanta · 0X`, fusionar 2 duplicados.
- **Carpetas:** estructura lista; faltan `_Templates` y `_Inbox`; el barrido de archivos lo hace Code.
