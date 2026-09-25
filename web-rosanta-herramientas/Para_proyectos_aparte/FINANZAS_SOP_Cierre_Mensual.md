# SOP 12 - Cierre mensual financiero y conciliación

**Responsable del proceso:** Gerencia (Juanma) | **Última actualización:** 31 de mayo de 2026 | **Revisión:** Mensual

---

## Propósito

Cerrar cada mes con cifras confiables: ventas, costos, COGS y margen, aplicando siempre las mismas reglas contables. Un cierre consistente permite tomar decisiones reales sobre el reto principal de Rosanta, que son los costos fijos.

## Alcance

**Incluye:** consolidación de ventas, conciliación de COGS, clasificación contable de facturas, revisión de gastos, cálculo de margen y reporte mensual.

**No incluye:** el cierre diario de caja (SOP 03) ni la declaración de impuestos formal, que la lleva la contabilidad externa.

## Roles

Gerencia (Juanma), administración o contabilidad, Supervisor / Jefe de turno (insumos del mes).

## Reglas contables fijas de Rosanta

- Proveedores con categoría "Misce" o sin clasificar en IF_COGS son facturas para crédito de IVA, no gasto operativo real.
- GRUPO ECO es proveedor de Categoría 2 (bebidas); cualquier factura marcada Misce se reclasifica a Categoría 2.
- Arrendamientos Santa Rosa (NIT 12749591) es Pequeño Contribuyente (FPEQ), sin crédito de IVA, aunque algún FEL muestre FACT.
- Tarjeta de crédito (Juan Lemus): los gastos personales (La Cosecha, San Martín, McDonald's, Macuá, Paraíso Azul, Casa Doña, Carmona, Finca Feliz, Man of War) se separan de los del restaurante. Desde mayo 2026 Juanma toma salario formal y los gastos se separan limpiamente.
- Datos de POS de Posfile en formato DD/MM/YYYY (parsear con dayfirst).

## Matriz RACI

| Paso | Responsable | Aprueba | Consulta | Informa |
|---|---|---|---|---|
| Consolidar ventas del mes | Administración | Gerencia | Supervisor | - |
| Clasificar facturas y gastos | Administración | Gerencia | - | - |
| Conciliar COGS | Gerencia | Gerencia | Cocina | - |
| Calcular margen y resultado | Gerencia | Gerencia | - | - |
| Reporte mensual | Gerencia | - | - | Socios |

## Flujo del proceso

```
Cierre del mes --> consolidar ventas (Posfile + formas de pago)
        |
        v
Reunir y clasificar facturas (reglas de IVA / categorias)
        |
        v
Conciliar COGS (compras vs consumo vs recetario)
        |
        v
Separar gastos personales vs restaurante
        |
        v
Calcular margen y resultado del mes
        |
        v
Reporte mensual a los socios + decisiones
```

## Pasos detallados

### Paso 1: Consolidar ventas
- **Quién:** Administración.
- **Cómo:** Reunir ventas del mes desde Posfile, desglosadas por forma de pago. Cuadrar contra los cierres diarios de caja (SOP 03).
- **Resultado:** Venta total del mes confirmada.

### Paso 2: Clasificar facturas y gastos
- **Quién:** Administración, aprobado por Gerencia.
- **Cómo:** Aplicar las reglas contables fijas (arriba). Separar crédito de IVA de gasto operativo real. Reclasificar lo que corresponda (ej. GRUPO ECO).
- **Resultado:** Gastos correctamente categorizados.

### Paso 3: Conciliar COGS
- **Quién:** Gerencia, con Cocina.
- **Cómo:** Comparar compras del mes contra consumo y contra el recetario. La conciliación de fondo y el baseline 2025 oficial (discrepancia de tres vías: Q263,597 vs Q324,581 vs Q381,944) se trabajan en el proyecto independiente de finanzas, no en este SOP.
- **Resultado:** COGS conciliado y confiable.

### Paso 4: Separar personal vs restaurante
- **Quién:** Administración.
- **Cómo:** Aislar los gastos personales de la tarjeta y el salario formal de Juanma, para que el resultado del restaurante quede limpio.

### Paso 5: Calcular margen y resultado
- **Quién:** Gerencia.
- **Cómo:** Calcular margen bruto, costos fijos (especialmente renta) y resultado del mes. Recordar que el CMV está dentro del benchmark de la región; el foco de análisis son los costos fijos.

### Paso 6: Reporte mensual
- **Quién:** Gerencia.
- **Cómo:** Preparar el reporte para los socios con ventas, COGS, margen, costos fijos y resultado, más decisiones para el mes siguiente. Reportar datos reales, sin maquillaje.
- **Resultado:** Mes cerrado y decisiones tomadas.

## Excepciones y casos especiales

| Situación | Qué hacer |
|---|---|
| Discrepancia en COGS | Investigar las tres fuentes antes de cerrar; no fijar baseline con datos inconsistentes. |
| Factura sin clasificar | No incluir como gasto operativo hasta clasificar correctamente. |
| Gasto personal en cuenta del restaurante | Reclasificar a personal y registrar. |
| Proveedor FPEQ con FEL que muestra FACT | Tratar como Pequeño Contribuyente, sin crédito de IVA. |

## Métricas

| Métrica | Meta | Cómo se mide |
|---|---|---|
| Cierre completado | Dentro de los primeros días del mes siguiente | Fecha de reporte |
| COGS conciliado | Sin discrepancias abiertas | Conciliación de tres vías |
| Margen bruto | Sostener o mejorar | Reporte mensual |
| Costos fijos sobre venta | Bajar la presión mes a mes | Reporte mensual |

## Documentos relacionados

- SOP 03 - Apertura y cierre de turno (cierre de caja)
- SOP 04 - Abastecimiento (facturas y categorías)
- SOP 09 - Ingeniería y cambio de menú (margen)
- Recetario y costeo (CMV) y reglas contables de Rosanta
