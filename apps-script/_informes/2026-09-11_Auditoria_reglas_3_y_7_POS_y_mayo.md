# Auditoría de integridad del maestro

**Rosanta · 11 de septiembre de 2026** · cierra p100, p104 y p97

---

## 1 · Las reglas 3 y 7 no están borrando gasto (p100)

**La pregunta:** el maestro salta Q182,187 de pagos bancarios asumiendo que esa factura ya entró por FEL. El propio script advierte que los pagos sin factura detrás son gasto real que se borra del P&L. ¿Cuánto de eso es real?

**La respuesta, en agregado:**

| | |
|---|---|
| Pagos de banco descartados por reglas 3 y 7 | Q182,187.28 |
| Facturas FEL en esas mismas categorías | Q280,228.91 |
| **Diferencia** | **+Q98,041.63 a favor de las facturas** |

Hay **más facturas que pagos bancarios**, no al revés. Las facturas existen. La regla es correcta y no está erosionando el resultado de forma sistemática. La diferencia se explica sola: parte de la compra se paga con tarjeta y parte queda pendiente al cierre.

Un primer cruce uno a uno dio 85 pagos "sin contraparte" por Q102,065, pero ese número es un artefacto del método: las glosas dicen *Varios* una y otra vez porque **un pago cubre varias facturas**. Al reconciliar por proveedor en vez de por pago, casi todos cuadran o quedan con más facturado que pagado.

### Lo que sí hay que arreglar: Q6,672 de mercado mal categorizado

Seis pagos de compra de mercado en efectivo están como `ALIMENTOS` en vez de `ALIMENTOS_EFECTIVO`. Como `ALIMENTOS` es una categoría "con factura esperada", la regla 3 los salta — y como son compra en efectivo, esa factura no existe. **Ese gasto desaparece del P&L entero.**

| Fecha | Monto | Glosa | Dónde |
|---|---|---|---|
| 07/08 | Q1,500.00 | S31Mercado | Banco Industrial fila 921 |
| 03/08 | Q1,281.00 | S31mercado | fila 894 |
| 24/07 | Q1,241.00 | S30MercadoVarios | fila 860 |
| 29/07 | Q912.00 | S30Mariscos3555282157 | fila 884 |
| 29/07 | Q866.00 | S30MercadoVerduras | fila 887 |
| 03/08 | Q805.00 | S31Mariscos | fila 902 |
| 12/03 | Q67.24 | Supermercados La Torre | fila 271 · dudoso, un súper sí factura |

Casi todo es de julio y agosto — justo los dos meses con el food cost más alto del año. Al corregirlo, ese gasto vuelve al COGS y el food cost de esos meses sube, no baja. Es peor cifra y mejor dato.

### Dos proveedores que cobran y no facturan

| Proveedor | Cobrado del banco | Facturado por FEL |
|---|---|---|
| COMESA | Q3,628.00 (7 pagos) | **Q0.00** |
| Vinos de Altura | Q1,720.00 (3 pagos) | **Q0.00** |
| Elder | Q12,209.50 (8 pagos) | Q8,830.00 — faltan Q3,379.50 |

Eso no es un problema del script sino del proveedor: o factura y no se cargó la factura, o no factura. Mismo efecto que el mercado: al estar en categoría de mercadería, la regla 3 los salta y el gasto se pierde.

**Exposición real total: unos Q15,400**, no los Q182,127 del planteamiento original ni los Q102,065 del primer cruce.

---

## 2 · Las dos cifras de mayo son las dos correctas (p104)

No hay error. Son la misma venta en dos bases distintas, y las dos cuadran **al centavo** contra el maestro validado:

| Concepto | Monto |
|---|---|
| Bruto con IVA, sin eventos | Q205,963.70 |
| Eventos privados, neto | Q2,607.14 |
| **Bruto con IVA + eventos** | **Q208,883.70** ← el reporte del 2 de junio |
| Neto sin IVA, sin eventos | Q183,896.16 |
| **Neto sin IVA + eventos** | **Q186,503.30** ← el reporte del 7 de julio |

282 tickets en el mes. Entre un reporte y otro cambió el criterio: el de junio informaba bruto con IVA y el de julio pasó a neto sin IVA. Es un cambio de base, no una corrección.

**La consecuencia práctica:** si alguien compara mayo contra otro mes tomando el número de cada PDF, está comparando peras con manzanas y va a "ver" una caída del 11% que no existe. Cualquier serie mensual tiene que declarar su base.

---

## 3 · Los productos borrados del POS (p97)

De **9,666 líneas de producto** del año, **875 apuntan a productos que ya no están en el catálogo**: 860 marcadas `!producto-eliminado!` y 15 con precio 0.00.

Representan **Q69,163** imputando el precio de referencia, o sea el **5.6% de la venta por líneas** — confirma exactamente la cifra que se había estimado.

**El método de recuperación funciona:** imputar a cada línea el precio modal de ese mismo producto en otros tickets. La cobertura pasa de 94.4% a 100%.

Y hay un dato que cambia la lectura del problema. Los platos más afectados **son de la carta actual**, no productos viejos:

| Producto | Venta perdida |
|---|---|
| Lomito ROSANTA | Q4,950.00 |
| Pulpo a la Parrilla | Q3,220.00 |
| Costilla de Cerdo Salsa de Café y Cardamomo | Q3,040.00 |
| Agua Natural de la casa 1L | Q2,880.00 |
| Coliflor en Romesco | Q2,835.00 |
| Pasta del Chef | Q2,755.00 |
| Hamburguesa de Lomito | Q2,530.00 |
| Brisket de Res | Q2,475.00 |

Esto no es basura histórica: es el efecto de la limpieza del POS de agosto, cuando se dieron de baja 187 productos fuera de la carta 2027. Al borrar el producto del catálogo, los tickets históricos perdieron su referencia de precio. Cualquier análisis de ingeniería de menú que no impute pierde a los platos estrella justamente.

**Regla para cualquier análisis por plato:** imputar siempre el precio modal antes de agrupar. Sin eso, el Lomito Rosanta aparece vendiendo Q4,950 menos de lo que vendió.

---

## 4 · Texto para la hoja 00_Instrucciones (p91)

Listo para pegar en el maestro, en la hoja `00_Instrucciones`:

> **EL CARGADOR AUTOMÁTICO**
>
> El maestro se alimenta solo desde la carpeta de Drive "Reportes 2026" (id `1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP`), donde hay una subcarpeta por semana (S34, S35…) o por mes (2026-07).
>
> **Uso normal:** desde el maestro, menú **Rosanta → Cargar lo que falte**. No hay que editar código ni elegir carpetas.
>
> **Cómo identifica los archivos: por su CONTENIDO, no por el nombre.** Da igual cómo se llamen.
> - Tiene columna `TicketId` → es el POS → va a `02_Ventas_Maestro`
> - El emisor es CORSAGA (NIT 24185930) → FEL emitidas → van a `01b_FEL_Emitidas`
> - El emisor es otro → FEL recibidas → van a `01_FEL_Maestro`
> - Todo lo demás (PDF, zip, planilla) se ignora
>
> **Nunca duplica.** En FEL compara la pareja Serie + Número de DTE; en ventas, el TicketId. Correrlo dos veces no agrega nada la segunda vez.
>
> **Los estados de cuenta NO se cargan aquí.** Banco Industrial, BAC y tarjeta vienen en PDF y los procesa Claude una vez al mes, validando contra los totales impresos del banco.
>
> **Las funciones, si hace falta correrlas a mano desde el editor:**
> - `cargarPendientes()` — recorre todas las carpetas y carga lo que falte. Recuerda qué archivos ya procesó, así que la segunda corrida tarda segundos.
> - `revisarPendientes()` — lo mismo pero SIN escribir: solo informa. **Correr esta primero cuando haya dudas.**
> - `cargarUltimasSemanas()` / `revisarUltimasSemanas()` — igual, pero solo las últimas 3 semanas. Más rápido para el uso de cada lunes.
> - `instalarMenu()` — crea el menú "Rosanta" dentro del maestro. Se corre una sola vez.
> - `instalarCargaAutomatica()` — deja el activador por tiempo.
> - `verActivadores()` — lista qué activadores hay puestos.
> - `olvidarProgreso()` — borra el registro de archivos procesados y fuerza un re-escaneo completo. Solo si algo quedó mal cargado.
> - `generarEspejo()` — exporta `Rosanta_Maestro_ESPEJO.xlsx`, que es lo que leen las herramientas de análisis. **Correrlo después de cualquier cambio manual al maestro**, o el análisis sigue viendo datos viejos.
>
> **Si se queda sin tiempo:** Apps Script corta a los 6 minutos y el cargador se detiene solo a los 4.5. Avisa en el log y con volver a correrlo continúa donde iba.
>
> **Si algo falla:** correr `revisarPendientes()` y leer el registro de ejecución. Dice qué archivo no pudo identificar y por qué. El error más común es una carpeta con nombre que no sigue el patrón SXX o 2026-MM.
