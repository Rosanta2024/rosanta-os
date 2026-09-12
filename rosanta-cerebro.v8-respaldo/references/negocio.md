# El negocio Rosanta — datos maestros (cosechado 12 jul 2026)

## El corazón en Drive

Carpeta raíz "corazón de Rosanta": `1ndxLpZqr-j4wdlpJN4FQDgWohL-NTlY0` (Drive de restaurante@rosanta.rest). Toda la información del negocio vive aquí:

- **01_PRODUCTIVO** (`1PZFeF-rSUxKCQ3e_lQlxkP2A5RdjK4Fx`): 01_VENTAS, 02_COMPRAS, 03_PAGOS, Clientes Totales, Doc "Menus - To print" (`1InheSqL56OPyUajmp-LLgkCkvDmEBVRXIjRqz8VHs9E`).
- **02_OPERATIVO** (`1W_VAonswBYKrrLUHRKdHgMpxxOzTfjTL`): 01_INMUEBLE_OCUPACION, 02_SERVICIOS, 03_FINANZAS, 04_EMPLEADOS, 05_ADMIN, 05_MARKETING&PUBLICIDAD, 06_NON-FOOD, AI Cockpit.

El conector de Google Drive de Cowork tiene acceso; navegar con `search_files(parentId=...)`.

**Carpeta "Gestion de Restaurantes"** (02_OPERATIVO › 05_MARKETING&PUBLICIDAD, `1RX2IUsa1DjgAUVY3ZP87Oo9X6ul4T_gt`): material de consultoría (dgimenezcoach, dic 2024) que es el ORIGEN metodológico de las herramientas actuales — el `DRE MASTER.xlsx` (`1lnA-Mj2oUaV3slnZ0Aaa4_xzkTdLrgoj`, P&L + break even con datos reales de un mes: venta Q1.27M, neto -9.5%) y el `SUP rest ROSANTA.xlsm` (costeo con catálogo real de ~70 insumos) fueron la base de los artefactos en funcionamiento (panel operativo, costeo/recetario). El formato del DRE será la plantilla del módulo Finanzas de la intranet. Los datos del DRE son históricos (no cuadran con el ritmo 2026); la fuente vigente de cifras es el maestro. `inventario.xlsx` y `check list mise en place.xlsx` son plantillas sin uso; subcarpeta Lecturas = 6 PDFs formativos.

## Menú

- Menú completo con precios: vive en el Doc base de conocimiento del bot (`1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I`) y en la skill `rosanta-cotizador` (menús de evento).
- "Menus - To print": menú Para Compartir bilingüe (tapas guatemaltecas: elote asado, pulpo, enchilada guatemalteca, róbalo en coco, pork belly & pepián; fuertes: lomo en salsa de puerro, costillas café-cardamomo, pesca del día meunière; postres: carlota de fresas, panna cotta café-cardamomo) + open bar (Paloma Rosanta, Fufuro, Chambón) + menú brunch (Q45–120).
- Cocina: natural, de temporada, guatemalteca contemporánea, maridada con coctelería moderna, en jardín. 125 recetas costeadas (56 barra CMV obj 20%, 69 cocina CMV obj 30%) — ver §2 de proyectos.md.

## Equipo y roles

- **Juanma** — dueño; reservas, finanzas, decisiones.
- **Vanessa** — pauta (revisa Hook Rate, CPC, engagement del tablero semanal).
- **Daniel** — contenido (piezas publicadas, orgánico, fatiga de creativo).
- **Wilson** — talento frente a cámara para gastrococtelería. OJO: NO es empleado de Rosanta (colaborador externo).
- Roles previstos en la intranet: dueno / contador / chef.
- SOPs y manuales (Drive › 02_OPERATIVO › 04_EMPLEADOS › Procedimientos): Manual_de_Servicio_Rosanta_v2 y Reducido, Manual de Procedimientos de Servicio (Supervisores `1TQUM7BzavTqlC38Lu_QsN2XUj5s7F7LbbtlfEmSg1w4` y Empleados `1IuVFTclJnMF-KTAcOhktouqDzilzEEnD7E2LtvERd5g`), SOP Sala, Proceso de Sala, Preguntas Frecuentes. También carpetas PLANILLAS, Propinas, IGSS.
- Más contexto operativo en el proyecto de Cowork "Rosanta Operations".

## Proveedores e insumos

~19 proveedores en los recetarios (snapshot panel operativo, jul 2026). Principales: **Los Alpes** y **Don Tavito** (los que más insumos surten), **Asuncion** (carnes/lomito), **Fogliasana** y **Parma** (quesos/italianos), **La Bodegona** (abarrotes), Prime Food, CMI, Mercado Rosanta, Belca, Marroquin, Xelac, Julio Hartman, Comesa, La Pasteleria, Juanitas, AgroChina, Nuevos Territorios, Fogliasana.

Insumos más caros: licores premium (Buchanan's 18 Q831, Don Julio Reposado Q528, etc.); en cocina: aceite de ajonjolí (Q305/L, el más caro por unidad), quesos Stilton/Tomino/Taleggio (Q157 c/u), Rib Eye (Q194/lb), entraña (Q108/lb). Fuente viva: recetarios nativos de Barra y Cocina (§2 proyectos.md).

## Números clave (referencia, jul 2026 — el dato vivo está en el maestro)

- Semana típica reciente (S26, 22–28 jun): ventas sin IVA Q36,828 · 142 comensales · ticket Q259 · COGS 32.4% · margen contribución 67.6%.
- Rango histórico S1–S26 2026: ventas Q25.5K–Q75.3K/semana (picos S18 y S7 ~Q73–75K); ticket Q250–507.
- Inventario físico consolidado mayo: Q24,712.
- **Costos fijos reales corregidos (13 jul):** nómina real ~Q31K/mes de salarios (planilla); **propinas Q8–9K/mes son passthrough, no costo** — el maestro las mezcla en "Nómina+propinas", separar al leer. Renta **Q20,425/mes** (2 quincenas de Q10,212.50 a Werner). Junio 2026 cerró **~en equilibrio** (±Q10K), no en pérdida — junio es históricamente el peor mes.
- Crecimiento 2026: vende ~2x vs 2025 (may +124%, jun +197%).
- Fuente autoritativa: `Rosanta_Reporte_Maestro_v2_2026.xlsx` (skill `rosanta-maestro`); vista: artefacto `rosanta-dashboard-semanal` (se refresca cada lunes).

## Plan "Mejoras con impacto real v2" (13 jul 2026)

Sustituye al doc de Oportunidades de Ahorro de abril. Impacto total realista: **Q280–390K/año** operativo. 8 palancas rankeadas: 1 Eventos/grupos Q90–120K · 2 Menu engineering Q65–100K · 3 Ocupación entre semana Q60–100K · 4 Fase 1 ahorro Q32.7K (fichas top 20, jiggers, waste log, inventario semanal, migración CENMA) · 5 Mercado con factura/IVA Q20–27K · 6 Comisiones tarjeta Q10–15K · 7 Septiembre abierto Q40–50K · 8 Nómina estacional Q6–10K.

Estado 13 jul: **Menu Engineering COMPLETADA**. Eventos = pilar continuo (no se cierra). Siguiente a trabajar: Ocupación entre semana. Mejora 5 (mercado con factura) EN CURSO: proveedor negociado que factura carnes/verduras, pendiente confirmar precios (el crédito IVA de 12% permite aceptar hasta ~10% más caro y aun así ganar). Mejora 6: el banco RECHAZÓ mejorar la tasa — queda mix de pago (transferencia/QR ~Q8–12K/año) y reintentar en Q4 con el volumen de nov–dic. Mejora 7 RESUELTA: nuevos horarios + vacaciones escalonadas, el restaurante se mantiene abierto en septiembre (deadline vacaciones era 15 ago). Mejora 8 DEFINIDA: staffing mínimo entre semana = 2 sala (coctelero + mesero) y 3 cocina por turno; findes 3 sala y 4 cocina. En pausa: consolidar proveedores de bebidas / negociación de volumen top 4.

Archivos: `Rosanta_Mejoras_Impacto_Real_v2_2026-07-13.pdf` + prompts por mejora `Rosanta_Prompts_Mejoras_2026-07-13.md`. Cada mejora se trabaja en su propio chat con su prompt. Sección visible en el artefacto `mandala-kalachakra-2x3x5`. Detalle en memorias `rosanta-mejoras-v2` y `rosanta-curva-estacional-2026`.

## Clientes y CRM

- CRM vivo: Google Sheet `Rosanta_CRM_Maestra` (`1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM`), leída en vivo por los artefactos `crm-rosanta-maestra` (resumen) y `rosanta-crm` (tabla completa).
- Campos: nombre, teléfono, email, idioma (EN turistas / ES foodies), fuente, segmento, última reserva, gasto GTQ. Segmentos: Lead → Cliente que visitó → Carrito abandonado → Cancelado → Reserva histórica.
- Reservas: **WIX** (SonTickets vendido y cerrado, jul 2026). **El histórico está exportado e incluido en WIX** (confirmado 26 jul): ~430 reservas (~50% con teléfono EE.UU./Canadá) y ~184 carritos/mes de la era SonTickets. Falta solo definir en WIX la captura de carritos para retención.
- Vinculado al dataset de Meta "Rosanta Reservas" (1107259034759950).
- Clientes top por gasto: se calculan en vivo en el CRM (no hay lista fija).
