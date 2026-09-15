# Finanzas & Data OS · Tanda 2 · Pestaña Caja · 15 sep 2026

Pendientes **p94** (proyección de caja a 30/60/90 días) y **p122** (objetivo operacional). Diseño aprobado por Juanma el 15-sep. **Publicado en la @93** el 15-sep, después de la batería: **108 OK · 0 fallas · 0 avisos · 3 saltadas**.

## Qué hay

- **`CajaDatos.js`**
  - Calendario día por día desde el último saldo cargado, hasta hoy + 90 días.
  - Tres escenarios (pesimista, base y optimista), medidos de cómo salieron las últimas 20 semanas contra el promedio de sus 8 anteriores.
  - La fecha en que cada escenario cruza cero y la fecha en que cruza el colchón de 7 días de gasto. El colchón se exige desde el día 30.
  - Cuánta venta adicional, o cuánto costo menos al mes, hace falta para no cruzarlos.
  - Por mes: lo que deja la operación contra el piso y el objetivo, y la venta adicional para cubrir cada uno.
  - Compromisos en la pestaña **COMPROMISOS** del Sheet de config. `instalarCompromisos()` la crea, con guarda de dueño. Mientras no exista se usan los de por defecto y la pantalla lo avisa.
  - Semanas con su año (M14).
- **`CajaVista.html`**
  - Gráfico del saldo con la banda de escenarios, las líneas de cero y colchón, y marcas de 30, 60 y 90 días. Tooltip con cursor y teclado.
  - Tablas por mes (p122), por semana y de compromisos, y la lista de supuestos.
  - Controles: estacionalidad, venta, costo y el pago a Raúl.
- **Conexión y pruebas**
  - Ruta `caja` y botón en el shell.
  - `CajaVista` en las tres listas `VISTAS`.
  - Cinco pruebas nuevas en `PruebasFinanzas.js`.

## Decisiones de Juanma que usa

- **Aguinaldo:** 50% el 10-dic y 50% el 20-ene.
- **Deuda y crédito:** no hay línea de crédito ni deuda fuera del banco.
- **Retiro:** Q5,000 al mes, en retiros semanales.
- **Alquiler de la casa:** US$1,800, cuando hay suficiente en bancos. En el modelo se paga el primer día en que el saldo lo cubre dejando el colchón.
- **Raúl:** Q100,000 el 15-mar-2027.
- **Colchón:** 7 días de gasto.
- **Estacionalidad:** la de 2025, con selector.
- **Datos:** las transferencias a la cuenta 974954208 son el retiro de Juanma y pasan a PERSONAL. Las del 18-ago a Fernanda y Jeffry son planilla y pasan a NOMINA. Script `retiros_y_nomina.js` en el maestro, pendiente de correr.

## Hallazgos de datos (no estaban en ningún pendiente)

1. **La columna Saldo del Banco Industrial no sirve como serie.**
   - Está vacía en mayo (0 de 156 filas) y en casi todo junio (13 de 132).
   - Dentro de un mismo día, el orden de las filas no es el del banco en 57 de 147 días.
   - El motor reconstruye el saldo de cada banco con sus movimientos, anclado en el último saldo que trae el estado de cuenta. Los movimientos están cuadrados contra los PDF.
2. **Traspasos entre bancos sin casar.**
   - Nueve salidas del BAC ("TF: ACH INMEDIATO/PERSONAS 900", categoría TRANSFERENCIA) llegan el mismo día y por el mismo monto al BI como "ACH CORSAGA": Q30,800 de abril a agosto.
   - El DRE no se afecta, porque TRANSFERENCIA ya queda fuera.
   - La caja las casa por monto y ±2 días.
3. **La extracción real no se parece al piso.** La salida por retiros, personal, devolución y pago de tarjeta fue Q21,675 en marzo, Q44,375 en abril, Q26,309 en mayo, Q24,553 en junio, Q11,500 en julio y Q26,254 en agosto. El pago de tarjeta lleva cargos personales y también del negocio.

## Prueba contra el pasado

Proyección desde cuatro cortes con los datos que había ese día, comparada contra el saldo real reconstruido. "Operativo" descuenta la extracción real y suma los compromisos del modelo, para medir solo la operación.

| Corte | Estacionalidad | Días | Error medio (saldo) | Error medio (operativo) | Real dentro de la banda (operativo) |
|---|---|---:|---:|---:|---:|
| 6-abr | 2025 | 90 | Q86,818 | Q64,902 | 13 de 90 |
| 4-may | 2025 | 90 | Q91,241 | Q89,605 | 3 de 90 |
| 8-jun | 2025 | 90 | Q21,806 | Q23,389 | 75 de 90 |
| 8-jun | mitad | 90 | Q15,746 | Q13,825 | 79 de 90 |
| 8-jun | sin | 90 | Q11,377 | Q11,397 | 78 de 90 |
| 6-jul | 2025 | 62 | Q16,415 | Q21,567 | 31 de 62 |
| 6-jul | sin | 62 | Q36,187 | Q41,527 | 2 de 62 |

Lectura:
- **Costo de operación:** se proyecta bien (±10% por mes).
- **Por qué fallan abril y mayo:** es la venta. El modelo parte del nivel de enero a abril (~Q46,000 por semana) y desde junio la venta cayó a ~Q33,000. En mayo entró al banco solo el 69% de lo vendido, contra el 90% habitual.
- **Estacionalidad:** ningún modo gana en todos los cortes. La de 2025 acierta desde julio y falla desde junio.

**La proyección es un calendario de riesgo, no una predicción de venta.**

## Proyección de hoy (espejo del 15-sep 13:21, compromisos por defecto)

| | Pesimista | Base | Optimista |
|---|---|---|---|
| Cruza cero | 4-oct | 26-oct | no cruza |
| Punto más bajo | −Q24,614 (4-nov) | −Q12,529 (4-nov) | Q16,987 |

- **Saldo de partida:** Q24,011 al 6-sep, ya bajo el colchón de Q34,569.
- **Para no cruzar cero (base):** +6.7% de venta, o Q6,464 menos de costo al mes.
- **Para tener el colchón desde el día 30:** +34.2% de venta, o Q32,205 menos al mes.
- **Sin estacionalidad:** el base cruza cero el 31-oct y llega a −Q34,277 el 14-dic.
- **p122:** septiembre y octubre dejan Q1,834 y −Q230 contra un piso de Q18,860. Con la estacionalidad de 2025, noviembre y diciembre cubren el piso y el objetivo.

## Verificación

- `node --check` de todos los `.js`.
- Scripts de `CajaVista` y `SistemaFinanzas` compilados, con control negativo.
- Motor corrido en Node sobre el espejo: los Q559,846 de débitos de la ventana caen todos en un grupo.
- Vista vista en el navegador con la salida real:
  - el tooltip queda dentro de la tarjeta;
  - sin desbordes horizontales a 375 px;
  - consola sin errores.
- Color de la línea `#2E7D52` validado con el validador de dataviz: banda, croma y contraste contra blanco.
- HEAD verificado con bajada aparte: 57 archivos.

## Cierre

- **Maestro:** `retiros_y_nomina.js` corrido. 19 filas por Q16,890: 17 retiros a PERSONAL (Q15,240) y 2 de planilla a NOMINA (Q1,650). Releídas, sin avisos. El comentario del script decía Q14,240 por error de suma; corregido en git, sube con el próximo push del maestro.
- **Intranet:** pestaña COMPROMISOS instalada (la prueba de compromisos pasó sin aviso). Publicado en la @93 tras verificar la cuenta de clasp, que la última versión era la publicada (@92) y que HEAD (57 archivos) era idéntico a lo probado.
- **Tablero:** p94 y p89 hechos; p122 sigue activo con el camino decidido; p162 actualizado.

## Decisiones de Juanma del cierre (15-sep)

1. **Estacionalidad por defecto:** sigue la de 2025.
2. **Camino de p122** (recomendación aceptada):
   - **Septiembre y octubre:** la meta es no cruzar cero, no el piso. Pide +6.7% de venta, unos Q2,500 más por semana sobre ~Q37,700. Cubrir el piso esos meses pediría +18% y +21%.
   - **Fecha del piso: noviembre 2026.** Con la estacionalidad de 2025, noviembre deja ~Q51,000 y cubre piso y objetivo sin venta adicional.
   - **Mezcla:** casi toda venta, porque el problema es tamaño. El costo es respaldo, solo operativo y nunca personal: Q6,464/mes menos equivale al +6.7%.
   - **Punto de control a mediados de noviembre:** si la venta semanal no sube cerca de 40% (factor 1.42 de 2025), se activa la palanca de costo operativo.

## Pendiente

1. **p162:** identificar las 3 saltadas (pedir las líneas SALTADA).
2. **p122:** revisar el punto de control a mediados de noviembre.
3. **Tandas siguientes:** 3 (p96 con datos limpios), 4 (M9, M15, M26), 5 (p142, A11).
