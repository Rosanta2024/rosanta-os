# Recetario + Proveedores — pendientes para el lunes

Cierre del 22 de agosto de 2026. El módulo quedó **publicado y funcionando** (Version 40).

> **Estos pendientes ya están cargados en el tracker maestro**
> (`~/Claude/Artifacts/rosanta-seguimiento-semanal/index.html`), 19 ítems bajo el proyecto
> *Recetario / costeo*. El tracker es la fuente; este documento queda como respaldo con el
> detalle largo.

## Decisiones resueltas el 22 ago

| Tema | Resolución |
|---|---|
| Recetario de barra | Manda la **hoja nativa** `1LeoX3xpemoYEj130qnTTMzn4OCgLsZx1PvPRW-2LRnk`. El `v5_corregido.xlsx` es su origen, convertido una hora después el mismo 12-jul. No compiten. **Archivar el xlsx, no borrarlo.** |
| Mix de Fritas | **Q45.** El recetario está bien; el POS dice Q40 y hay que corregirlo. |
| Papa | **Q7/libra**, marcado como **supuesto**: es la que ocupó contabilidad para valorizar el inventario, aunque la pestaña de precios del mismo archivo diga Q3. |
| Brisket | Sigue **abierto**. Decisión de dirección, con escenarios calculados. |

## Auditoría de la carta contra `Menu ES 2027 VF.pdf`

**31 de 31 precios alineados.** El recetario coincide con el menú en todos los platos
costeados, los 7 nuevos y las 4 guarniciones.

> **No había error en el Lomito Rosanta.** El 22 ago se bajó de Q190 a Q180 y luego se
> revirtió. El error vino de auditar contra `Menu 2027 VF.pdf` (18 ago), que todavía no
> tenía el plato: solo traía "LOMITO A LA PARRILLA Q180". El menú correcto,
> `Menu ES 2027 VF.pdf` (19 ago), trae **los dos**:
>
> - **LOMITO ROSANTA Q190** — gratín de papa y tocino, salsa de ajo confitado, gremolata,
>   zanahorias asadas. Calca la ficha.
> - **LOMITO DE LA CASA Q180** — puré de espinaca y romero, salsa de ajo negro, zanahorias
>   fermentadas. Es uno de los 7 sin receta.
>
> El único desalineado real es el **Mix de Fritas**, y no es del recetario sino del POS.

---

## Bloquean que el equipo lo use

| # | Pendiente | Quién | Detalle |
|---|---|---|---|
| 1 | **Accesos de Jeffry y José** | Juanma + yo | Ninguno de los dos puede entrar. Usan Gmail personal (`jeffryandersson102@gmail.com`, `jose.mazate321@gmail.com`) y el módulo resuelve al usuario con `getUsuarioActual()`, que devuelve vacío fuera del dominio. La página carga pero toda llamada de datos muere con "Sin acceso al recetario". La intranet ya tiene la solución (`resolverUsuario_(auth)` en `Config.js`); falta cablearla en los 5 puntos de entrada del módulo y que `CosteoVista` mande el token. Son unas 5 líneas. |
| 2 | **Alta en USUARIOS** | Juanma | Una vez cableado el token, agregar las dos filas con módulo `recetario` y correr `generarTokensUsuarios()` para sacar sus enlaces personales. |

---

## Decisiones que no son mías

| # | Pendiente | Quién | Detalle |
|---|---|---|---|
| 3 | **Cuál recetario de barra manda** | Dirección | Hay dos: la hoja nativa `1LeoX3xpemoYEj130qnTTMzn4OCgLsZx1PvPRW-2LRnk` (12 jul) y `Rosanta_Recetario_Barra_v5_corregido.xlsx`. El módulo apunta a la primera. Además sus precios son 2026 (Q70/Q65) y la carta 2027 pudo haberlos subido. |
| 4 | **Brisket a Q180 con 40% de CMV** | Dirección | La libra subió 21% y ya era el plato más caro de producir. A ese precio no llega a 30%. Es decisión de precio, no problema de datos. |
| 5 | **Papa: Q3 o Q7 la libra** | Administración | El archivo de julio se contradice: la lista de precios dice Q3, el bloque de existencias dice Q7. Quedó en Q7 por decisión documentada. |
| 6 | **Precio del Mix de Fritas** | Administración | Recetario dice Q45, POS dice Q40. |

---

## Datos que faltan de cocina

| # | Pendiente | Quién |
|---|---|---|
| 7 | Recetas de los 7 platos nuevos 2027. **Coliflor con Romesco primero** — vende 109 unidades al año | Cocina |
| 8 | Receta real del fetuccini — las tres pastas siguen con costeo provisional | Cocina |
| 9 | Rinde de chips de camote — se asumió 45% = 20 porciones | Cocina |
| 10 | Puré de plátano (80 g provisional), gratín mozzarella (300 g provisional), rendimiento de salsa de pasta (60% estimado) | Cocina |
| 11 | Precios de producción del inventario que no cuadran con las fichas: chips de malanga Q50/bolsa 5lb, gremolata Q35/L (ficha calcula Q205/L), puré de camote Q120/1.2L (ficha calcula Q55) | Cocina |

---

## Higiene de datos (no bloquean)

| # | Pendiente | Detalle |
|---|---|---|
| 12 | **38 líneas sin match en el Banco** | Cordiales y maceraciones de barra que se usan en cócteles pero no están dadas de alta como insumo. Se ven en la pestaña Higiene. |
| 13 | **Pre-elaborados de barra sin costo** | Bitter de Tabacco, Cordial de Pepino Zamat, Cordial de Rabano, Dilución de Remolacha y otros: ficha sin cantidades, igual que estaba la infusión de hierbas. Cada uno necesita que barra dicte gramajes. |
| 14 | **Cierre de agosto** | Julio es el último inventario que existe en Drive. |
| 15 | **Papelera de Drive** | 6 `.xlsx` viejos del recetario de cocina, la v9 nativa ya superada, y una hoja huérfana `Rosanta_Costeo_Proveedores` de 1 KB (`1MihkABY4fFGerdfz-o9tyl4UTJSTCe99hkEGdeU9qt4`) de un intento fallido. |
| 16 | **`ConvertirRecetarios.js` con IDs viejos** | Apunta a un xlsx de cocina que ya no se usa. No corre (está tras un `if`), pero confunde al que lo lea. |

---

## Deuda técnica

| # | Pendiente | Detalle |
|---|---|---|
| 17 | **`git init` en el proyecto** | `~/Dev/Rosanta/apps-script/rosanta-intranet` no está bajo control de versiones. Hoy cualquier borrado depende solo del historial de Apps Script. |
| 18 | **Decidir el futuro del importador de inventarios** | `InventarioImport.js` funciona y tiene sus candados, pero **no debe correrse contra la v11**: el recetario ya trae la sincronización de julio hecha a mano y con criterio que el importador no tiene. Hay que decidir quién manda antes de reactivarlo. |
