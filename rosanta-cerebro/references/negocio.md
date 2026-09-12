# El negocio Rosanta — datos maestros (act. 6 sep 2026)

## Fuente financiera vigente (LEER PRIMERO)

**El maestro es un Google Sheet NATIVO:** `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`. Migrado el 2 sep 2026 por decisión de Juanma de alejarse del xlsx.

- ~~`Rosanta_Reporte_Maestro_v2_2026.xlsx` como fuente~~ **OBSOLETO.** Existían **tres** archivos distintos con ese nombre; se desactivaron y quedaron como `ZZ_ARCHIVO_`.
- **Espejo:** Apps Script exporta `Rosanta_Maestro_ESPEJO.xlsx` cada semana; Drive Desktop lo sincroniza y Python lo lee. Ese es el puente entre el Sheet vivo y las herramientas locales.
- **Cargador automático** (`Maestro/AppsScript_cargador.gs`): Juanma deja los archivos en la carpeta de la semana y el sistema los identifica **por contenido, no por nombre** (POS, FEL emitidas, FEL recibidas), convierte los .xls y lleva registro de lo procesado. Funciones: `cargarPendientes()`, `revisarPendientes()`, `instalarMenu()`, `instalarCargaAutomatica()`, `olvidarProgreso()`. Pendiente: documentarlo en la hoja `00_Instrucciones`.
- **Nómina: usar la planilla DEVENGADA**, no el banco. Sheets nativos: planilla `1dKTJ0KRKTyLyiQEZ2pCUh3i446Cy0S_yvmqp1ac_H_E` (el número es el "Sub total" de la columna "Salario base") y propinas `12wXn91gPp1vkwOsrLfD38wnifPFSz8lKwk2LvnASEEE`. Los .xlsx sueltos de Planilla_y_Propinas están obsoletos.
- **Validación:** los ocho meses de 2026 están cuadrados **al centavo** contra los PDF originales (8/8 Banco Industrial, 8/8 BAC).

## El DRE 2026 (construido 2–3 sep, ocho meses)

| Concepto | Monto | % de venta |
|---|---|---|
| Ventas | Q1,220,487 | 100% |
| COGS | Q450,227 | 36.9% |
| Gasto operativo | Q858,465 | 70.3% |
| **Resultado** | **−Q88,205** | **−7.2%** |

- **Punto de equilibrio: Q90,612/mes** contra Q152,561 de venta real. **El problema no es vender, es la estructura de costo.**
- **Prime cost: 56.9%** en el año (límite 60%). Enero–junio 49–59%; **julio 66.0% y agosto 67.5% se rompieron**.
- **Hallazgo de método:** el maestro es **base caja**, y eso rompía el prime cost mensual (saltaba de 40% a 76% sin que la operación cambiara). Conectando la planilla devengada, el rango se volvió señal real.

### Diagnóstico del gasto (contra rango de sector)

| Rubro | Real | Rango | Lectura |
|---|---|---|---|
| Alquiler | **16.9%** | 6–10% | **La palanca más grande. ~Q84K/año en juego** |
| Comisiones bancarias | 6.2% | 3–5% | El banco ya rechazó mejorar tasa |
| Honorarios | 6.3% | 1–3% | Sobre rango |
| Bienes de uso | 5.3% | 3–5% | Sobre rango |
| Nómina | 20.0% | ~28% piso | **8 puntos BAJO el piso: el margen no se va en gente** |

### Reglas de clasificación (corregidas 2–3 sep)

- IGSS y los pagos a Vanessa **no** son comisiones bancarias.
- Q82,535 que estaban en NOMINA sin serlo (Kristinsa y una distribución al socio) salieron del bloque.
- **Los consumos en restaurantes NO se clasifican por el nombre del comercio.** El mismo lugar puede ser comida personal de Juanma o comida con el equipo. Domino's y Casa Feliz quedaron como GASTOS_ADMINISTRATIVOS.
- Dos errores de parsing bancario corregidos: débito fantasma de Q86,055 en mayo (una coma en "ACH CORSAGA, SOCIEDAD AN A" partía la línea) y un crédito de Q800 perdido en marzo.
- **Abierto:** la nómina de febrero está mal clasificada — salió por BAC como TRANSFERENCIA_SALIENTE. Mismo patrón en meses 2, 5 y 6. Falta que Juanma identifique las cuentas destino.

### Alertas de caja y costo

- **Saldo bancario al 31 ago: Q11,196.57** (BI Q11,165.90 + BAC Q30.67) contra ~Q163,000/mes de gasto. A doce meses el problema es la estructura; a treinta días es que **no hay colchón**. El forecast de caja pasa a ser el primer entregable.
- **El COGS semanal es ruido, no señal:** semana a semana va de 16.4% a 68.1% (desviación 13.9 puntos) porque la compra no cae en la semana en que se consume. Con **media móvil de 4 semanas** la desviación baja a 4.9 puntos y aparece la señal: food cost en 30–31% en junio/inicio de julio, **47.1% en la S35**.
- **Brecha de 9 puntos entre CMV real y teórico:** 36.9% (base compra) contra 27.8% (base receta ponderada por mix). El umbral de Profit OS: 0–2 puntos es merma normal, 2–4 revisar porcionado, **más de 4 es fuga real**. Parte es movimiento de inventario, pero no se puede separar sin consolidar compras y contar inventario.
- **Banda de IVA:** 60.8% de la compra entra con factura. Eso permitió fijar CMV de cocina en 28.0% y de barra en 23.5%.
- **Q9,000 en efectivo sin explicar en agosto** y no existe registro de compras de cocina. El resto de la compra es mercado en efectivo categorizado como ALIMENTOS_EFECTIVO sin detalle.

### Mix de venta (medido 3 sep sobre las ventas 2026)

**Cocina 77.9% / barra 22.1%** → meta de food cost = (77.9 × 30%) + (22.1 × 20%) = **27.8%**, no 32%. Verificación cruzada de Profit OS a 7 meses: cocina Q527,855 vs barra Q159,757 = 76.8/23.2, consistente.

### Defectos conocidos del dato del POS

1. **El 5.6% de la venta del año está contra productos ELIMINADOS del catálogo**: la línea conserva el nombre pero el precio sale 0.00. Se recuperan imputando el precio del mismo producto en otros tickets.
2. **El Subtotal del ticket trae un 10% de servicio que NO está en los precios de los productos**, así que la suma de líneas nunca cuadra contra el total.
   Formato de la columna Productos (hoja `02_Ventas_Maestro`): `cantidad-Nombre#precio#descuento`, separado por `|`. Cobertura al parsear: 93.1%.
3. **Columna corrida en la planilla de agosto:** los Q6,158 bajo "Horas extras" son en realidad la propina de julio pagada en agosto. No afecta el costo laboral (se usa el Sub total de Salario base) pero conviene corregirlo.

### Reporte mensual

**El reporte del contador quedó DESCONTINUADO** y se reemplazó por un **reporte interno mensual**, que arrancó con el cierre de agosto. Carpeta: `1Dfkg52IphK3V1hWCaDQ2MAqqxzMQxmju`. El contenido vive en el artefacto `rosanta-dre-mensual`. Pendiente: automatizar la generación en vez de armarlo a mano.

## El corazón en Drive

Carpeta raíz: `1ndxLpZqr-j4wdlpJN4FQDgWohL-NTlY0` (Drive de restaurante@rosanta.rest).

- **01_PRODUCTIVO** (`1PZFeF-rSUxKCQ3e_lQlxkP2A5RdjK4Fx`): 01_VENTAS, 02_COMPRAS, 03_PAGOS, Clientes Totales, Doc "Menus - To print" (`1InheSqL56OPyUajmp-LLgkCkvDmEBVRXIjRqz8VHs9E`).
- **02_OPERATIVO** (`1W_VAonswBYKrrLUHRKdHgMpxxOzTfjTL`): 01_INMUEBLE_OCUPACION, 02_SERVICIOS, 03_FINANZAS, 04_EMPLEADOS, 05_ADMIN, 05_MARKETING&PUBLICIDAD, 06_NON-FOOD, AI Cockpit.

**Drive está reorganizado por los 6 pilares de Rosanta OS** (ejecutado en S35). Carpeta `01_Business_Fundamentals` (`1twebbv6qCGWMY4BlTPYYnXsilR0-Al_y`) con las subcarpetas del Operations Hub — **las cuatro están vacías** y los archivos 1.3, 1.5 y 1.8 siguen sueltos en la carpeta padre.

**Carpeta "Gestion de Restaurantes"** (`1RX2IUsa1DjgAUVY3ZP87Oo9X6ul4T_gt`): material de consultoría (dic 2024), origen metodológico del `DRE MASTER.xlsx` y del `SUP rest ROSANTA.xlsm`. Sus datos son históricos; **la fuente vigente de cifras es el maestro nativo**.

**Nota sobre The Scaling Engine OS:** el documento solo contiene el **Curso 1**. Los cursos 3 (Finance & Data) y 4 (Profit) **no existen en Drive**, solo la lista de nombres de entregables. No asumir que están.

## Menú

- Menú completo con precios: Doc base de conocimiento del bot (`1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I`) y skill `rosanta-cotizador` (menús de evento).
- **Carta 2026-2027 vigente y corriendo en el restaurante**, con el POS ya sincronizado (ago 2026): 212 productos con precios actualizados, 187 fuera de carta dados de baja, carta de vinos 2027 cargada (copa Q70), licor botella +7% redondeado a múltiplo de 5.
- Menú web: `rosanta.rest/menu-completo`, servido desde GitHub Pages (`Rosanta2024/rosanta-menu`). Cambiar precios = editar `index.html` en GitHub.
- **Para Compartir** correcto (entrantes de carta: Carpaccio de lomito, Pulpo a la parrilla, Queso horneado, Tabla de jamones y quesos; fuertes: Lomito en salsa de puerros, Pesca del día). **NO usar Tapas Guatemaltecas en Para Compartir.**
- **Rosanta NO vende brunch** (eliminado de la web en ago 2026, no se sirve desde hace más de un año). **NO hace delivery.**
- Cocina: natural, de temporada, guatemalteca contemporánea, maridada con **gastrococtelería**, en jardín. La leña de la parrilla es de **gravilea**, nunca "leña de café".

## Equipo y roles

- **Juanma** — dueño; reservas, finanzas, decisiones.
- **Vanessa** — pauta (Hook Rate, CPC, engagement). Sus pagos son honorarios, no comisiones bancarias.
- **Daniel** — contenido (orgánico, fatiga de creativo).
- **Jeffry** — cocina/operación; interlocutor para el registro de compras de mercado.
- **Wilson** — talento frente a cámara para gastrococtelería. **NO es empleado** (colaborador externo).
- Otros en planilla: Jose, Nadia, Efraín, Maco, Fernanda, Marvin, Eddy.
- **Usuarios y roles reales ya cargados en la intranet** (pestaña USUARIOS, 10 ago 2026). Roles: dueno / contador / chef / contenido.
- SOPs: Drive › 02_OPERATIVO › 04_EMPLEADOS › Procedimientos (Manual_de_Servicio_Rosanta_v2 y Reducido, Manual de Procedimientos de Servicio Supervisores `1TQUM7BzavTqlC38Lu_QsN2XUj5s7F7LbbtlfEmSg1w4` y Empleados `1IuVFTclJnMF-KTAcOhktouqDzilzEEnD7E2LtvERd5g`, SOP Sala, Proceso de Sala, FAQ). También PLANILLAS, Propinas, IGSS.

## Proveedores e insumos

~19 proveedores. Principales: **Los Alpes** y **Don Tavito**, **Asuncion** (carnes/lomito), **Fogliasana** y **Parma** (quesos/italianos), **La Bodegona** (abarrotes), Prime Food, CMI, Mercado Rosanta, Belca, Marroquin, Xelac, Julio Hartman, Comesa, La Pasteleria, Juanitas, AgroChina, Nuevos Territorios.

Insumos más caros: licores premium (Buchanan's 18 Q831, Don Julio Reposado Q528); cocina: aceite de ajonjolí Q305/L, quesos Stilton/Tomino/Taleggio Q157 c/u, Rib Eye Q194/lb, entraña Q108/lb.

Compras históricas dispersas en `04_Profit_OS/Proveedores/Historico_Compras/` **sin formato común** — consolidarlas es requisito para cerrar la brecha de CMV.

## Números de referencia operativa

- Semana típica S33 (ago): ventas Q34,558 · 118 comensales · ticket Q293 · COGS 37.1% · margen Q21,727 (62.9%).
- Ticket por comensal S32→S34: Q256.15 → Q272.69 → Q284.70 (tres semanas de alza).
- Rango histórico 2026: Q25.5K–Q75.3K/semana.
- Costos fijos: nómina ~Q31K/mes (agosto devengado Q31,450); **las propinas Q8–9K/mes son passthrough, no costo**. Renta Q20,425/mes (2 quincenas de Q10,212.50 a Werner) — pero ver la alerta del 16.9%.
- Inventario físico consolidado mayo: Q24,712.
- Crecimiento 2026: vende ~2x vs 2025.

## Plan "Mejoras con impacto real v2" (13 jul 2026)

Impacto realista **Q280–390K/año**. 8 palancas: 1 Eventos/grupos Q90–120K · 2 Menu engineering Q65–100K · 3 Ocupación entre semana Q60–100K · 4 Fase 1 ahorro Q32.7K · 5 Mercado con factura/IVA Q20–27K · 6 Comisiones tarjeta Q10–15K · 7 Septiembre abierto Q40–50K · 8 Nómina estacional Q6–10K.

Estado: ~~Menu Engineering~~ **COMPLETADA**. ~~Mejora 7 (septiembre abierto)~~ **RESUELTA** — nuevos horarios y vacaciones escalonadas, el restaurante abre en septiembre. ~~Mejora 8~~ **DEFINIDA** — staffing mínimo entre semana 2 sala + 3 cocina; findes 3 sala + 4 cocina. Mejora 5 EN CURSO. Mejora 6: el banco **rechazó** mejorar la tasa; queda mix de pago y reintentar en Q4. Eventos = pilar continuo. **Nueva palanca que supera a todas: el alquiler al 16.9%** (~Q84K/año).

## Clientes y CRM

- CRM vivo: Google Sheet `Rosanta_CRM_Maestra` (`1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM`).
- Campos: nombre, teléfono, email, idioma (EN turistas / ES foodies), fuente, segmento, última reserva, gasto GTQ. Segmentos: Lead → Cliente que visitó → Carrito abandonado → Cancelado → Reserva histórica.
- **Reservas: WIX.** Migración desde SonTickets **ejecutada el 10 ago 2026**. Histórico (~430 reservas, ~50% con teléfono EE.UU./Canadá) incluido.
- Sheet espejo para Vanessa: `CRM_Export_Vanessa` (`19NEHGKGr4h229l0NmQf3vvw9kxsmxkcF8AizYyhucAo`). Se comparte SOLO ese.
- Dataset de Meta "Rosanta Reservas" (1107259034759950).
- **Abierto:** confirmar si el proyecto Apps Script `rosanta-crm` está inerte (nunca tuvo versión desplegada, no tiene doGet ni doPost) y darlo de baja si aplica.
