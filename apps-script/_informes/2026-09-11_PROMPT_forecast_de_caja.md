# Prompt · Proyección de caja 30/60/90 para Rosanta

Copiar y pegar en el proyecto **Finanzas & Data OS**. Está escrito para que se entienda en frío, sin haber visto la sesión donde salieron estos números.

---

Quiero construir la **proyección de caja a 30, 60 y 90 días** de Rosanta (CORSAGA, S.A., restaurante de gastrococtelería en Antigua Guatemala). Es el pendiente p94 del tablero `rosanta-seguimiento-semanal` y el único entregable del pilar Finanzas & Data que arranca de cero.

Carga el cerebro `rosanta-cerebro` para el contexto general. Abajo está todo lo que ya se midió el 11 de septiembre de 2026, para que no lo repitas.

## Dónde están los datos

- **Fuente única de verdad:** Google Sheet nativo `Rosanta_Reporte_Maestro_v2_2026`, id `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`.
- **Lo que se lee desde código:** el espejo `Rosanta_Maestro_ESPEJO.xlsx`, que un Apps Script exporta cada lunes a la misma carpeta. **Nunca se edita a mano.** Si hiciste un cambio en el Sheet, corre `generarEspejo()` antes de analizar o vas a leer datos viejos.
- **Carpeta:** `My Drive / Rosanta OS / 03_Finance_Data_OS / Maestro`. Hay que conectarla al chat para poder trabajarla.
- **Generador:** `generar_finanzas.py` en esa carpeta. Escribe `_datos_finanzas/dre5.json`, `cinco.json`, `pant.json` y `cobertura.json`.
- **Hojas del maestro:** `01_FEL_Maestro`, `02_Ventas_Maestro`, `03_Banco_Industrial`, `04_Banco_BAC`, `05_Tarjeta_Credito_BAC`.

Los ocho meses del año están validados al centavo contra los PDF originales del banco: 8 de 8 en Banco Industrial y 8 de 8 en BAC. El dato bancario es confiable.

## El hallazgo central, ya medido

**La caja no está apretada por la operación. Está apretada por la extracción.**

| Mes | Cobrado | Salidas de operación | Caja de operación | Personal | Retiros del socio | Neto |
|---|---|---|---|---|---|---|
| Ene | 153,784 | 128,022 | 25,761 | 31,660 | 6,000 | −11,899 |
| Feb | 190,177 | 129,175 | 61,002 | 30,081 | 82,535 | −51,614 |
| Mar | 175,909 | 154,209 | 21,700 | 9,919 | 0 | +11,782 |
| Abr | 165,153 | 136,408 | 28,744 | 3,512 | 1,000 | +24,233 |
| May | 185,523 | 160,163 | 25,360 | 15,173 | 6,000 | +4,187 |
| Jun | 142,275 | 151,001 | −8,725 | 2,444 | 4,790 | −15,959 |
| Jul | 128,164 | 131,186 | −3,023 | 31,830 | 0 | −34,853 |
| Ago | 162,861 | 143,725 | 19,136 | 11,928 | 0 | +7,208 |
| Sep (al 6) | 33,487 | 14,897 | 18,590 | 0 | 0 | +18,590 |
| **AÑO** | **1,337,332** | **1,148,786** | **+188,547** | **136,546** | **100,325** | **−48,325** |

- La operación genera **Q188,547** de caja en ocho meses y una semana. El negocio produce efectivo.
- Se extraen **Q236,871** entre gasto personal y retiros del socio: el **126%** de lo que genera.
- Promedio mensual: la operación deja **Q22,993**, se extraen **Q28,887**. Sale Q5,894 al mes más de lo que entra.
- Junio (−Q8,725) y julio (−Q3,023) son los únicos meses en que la operación misma quemó caja, y son los mismos dos meses del food cost más alto del año.
- Febrero concentra casi todo el retiro del año: Q82,535 de un total de Q100,325.

### El comportamiento del saldo

- Caja al 7 de septiembre: **Q24,011.41**, gasto diario de operación **Q5,009.35**, o sea **4.8 días** de cobertura.
- El saldo estuvo **por debajo de una semana de gasto 230 de 244 días con movimiento: el 94% del año**.
- Mínimo del año: **Q0.00 exactos, el 31 de julio**. Máximo: Q56,772.29, que son once días.
- No es un mal mes: es el modo normal de operar.

## Contexto del P&L, para no confundir caja con resultado

Del DRE anual ya construido (artefacto `rosanta-dre-mensual`):

- Ventas netas sin IVA y sin eventos: **Q1,220,487**
- COGS **Q450,227 (36.9%)** · gasto operativo **Q858,465 (70.3%)** · resultado **−Q88,205 (−7.2%)**
- Punto de equilibrio: **Q90,612 al mes** contra Q152,561 de venta real. El problema no es vender.
- Prime cost del año **56.9%**, bajo el límite de 60%. Pero julio 66.0% y agosto 67.5% se rompieron.
- Sobre rango: alquiler 16.9% (banda 6-10%), comisiones bancarias 6.2% (3-5%), honorarios 6.3% (1-3%), bienes de uso 5.3% (3-5%).
- Bajo rango: nómina 20.0%, ocho puntos **debajo** del piso del sector. El margen no se va en gente.
- **El alquiler ya se negoció a la baja y no hay más margen.** No reproponer renegociarlo.
- Meta de food cost: **30% fija**, decisión de negocio del 10 de septiembre. No es ponderada por mix.

Ojo con la diferencia entre las dos vistas: el P&L da −Q88,205 y la caja de operación da +Q188,547. No se contradicen. El P&L está en base devengada y neto de IVA; la caja incluye el IVA cobrado que todavía no se ha enterado, y no incluye devengos.

## Planilla devengada por mes, que es la que vale para costo laboral

`{1: 28850, 2: 28875, 3: 27600, 4: 27100, 5: 31925, 6: 29900, 7: 29010, 8: 31450}`

La nómina del banco **no** sirve para el costo laboral: el banco reparte los sueldos de un mes entre dos y eso hace saltar el prime cost de 40% a 76% sin que la operación cambie.

## Estacionalidad

- Temporada alta: **noviembre y diciembre**. Septiembre es históricamente flojo.
- La semana S36 (31 ago al 6 sep) fue **la venta semanal más alta de la serie**: Q41,707 con ticket de Q353.45 por comensal, +Q79.62 contra la semana anterior.
- Serie semanal completa de 2026 en `_datos_finanzas/pant.json`, campo `semanas`.

## Trampas del dato, verificadas. No volver a caer

1. **Traspasos entre cuentas propias.** Los créditos con glosa que contiene `CORSAGA` son transferencias de la empresa a sí misma: **Q35,800 en el año**. Si se cuentan como entrada, la caja de operación sale inflada.
2. **Base bruta contra base neta.** Mayo tiene dos reportes con cifras distintas y **las dos son correctas**: Q208,883.70 es bruto con IVA más eventos, Q186,503.30 es neto sin IVA más eventos. Toda serie mensual tiene que declarar su base o alguien va a "ver" una caída del 11% que no existe.
3. **Productos borrados del POS.** 875 de 9,666 líneas apuntan a productos que ya no están en el catálogo, Q69,163 o el 5.6% de la venta por líneas. Hay que imputar el precio modal del mismo producto en otros tickets antes de agrupar, o el análisis pierde justo a los platos estrella (Lomito Rosanta, Pulpo, Costilla).
4. **Fechas del FEL desfasadas un día.** Trece filas (984 a 996 de `01_FEL_Maestro`) tienen hora 22:00 o 23:00 y Apps Script y Python las leen con un día de diferencia. Una cruza de mes: GRUPO ECO, Q1,467.14, marzo o abril según quién pregunte.
5. **Las reglas 3 y 7 del generador saltan Q182,187** de pagos bancarios asumiendo que la factura ya entró por FEL. Está auditado y es correcto en agregado: hay Q280,229 de facturas contra esos Q182,187. La exposición real son unos Q15,400 y están identificados en el pendiente p121.

## Qué quiero que construyas

Una **proyección de caja a 30, 60 y 90 días** desde la fecha en que se corra, dentro del artefacto `rosanta-finanzas-semanal`, donde ya viven los bloques hermanos (RAA por desvío y panel de integridad del dato).

Que tenga:

1. **Calendario de compromisos**, no un promedio. Sacá del histórico bancario los pagos recurrentes con su fecha y monto típico: alquiler, planilla, IGSS, impuestos, seguridad (EX Security, Q250 al mes), internet, teléfonos, alquiler de equipo, tarjeta de crédito. Un promedio mensual esconde que la caja se rompe el día 15, no el día 30.
2. **Entradas modeladas sobre la estacionalidad real**, no sobre la media. Con la serie semanal de los 36 puntos que ya existe, y con noviembre y diciembre marcados como alta.
3. **Bandas**, no un número. Escenario base, uno pesimista y uno optimista, con el supuesto de cada uno escrito.
4. **El punto de quiebre.** Lo más importante: en qué fecha el saldo proyectado cruza cero en cada escenario, y cuánto habría que dejar de extraer para que no cruce.
5. **La extracción como variable, no como constante.** El modelo tiene que dejar mover el gasto personal y los retiros del socio, porque ahí está la palanca real.

## Preguntas que hay que responderle a Juanma antes de cerrar el modelo

1. **Los Q100,325 de retiros del socio.** ¿Son devolución de un aporte previo? ¿Queda saldo por devolver y en qué plazo? El de febrero, Q82,535, es casi todo el año: si fue un evento único, el modelo no debe repetirlo.
2. **El gasto personal por las cuentas de la empresa**, Q136,546 en el año y casi todo por tarjeta. ¿Sigue igual de aquí en adelante, se corta, o baja a un monto fijo mensual? Es el supuesto que más mueve el resultado.
3. **¿Hay línea de crédito disponible, y de cuánto?** Con 4.8 días de colchón, una línea cambia por completo la lectura del riesgo.
4. **El aguinaldo de diciembre** cae justo en el borde de la ventana de 90 días. ¿Se paga completo en la primera quincena o partido? Con la planilla en unos Q31,450 al mes, es el compromiso más grande del trimestre.
5. **¿Hay deuda o compromisos fuera del banco** que no aparezcan en el maestro? Préstamos personales al negocio, proveedores con crédito abierto, pagos diferidos.

## Reglas de la casa

- Español, conciso y directo. Sin em-dashes.
- Hechos concretos con cifras, nunca generalidades. Si algo no cuadra, decirlo en vez de suavizarlo.
- Confirmar la fuente antes de construir: preguntar si el dato de partida es el vigente.
- Instrucciones técnicas completas: punto de partida exacto, cada clic, cómo verificar cada paso.
- Al terminar, registrar el cierre en el tablero `rosanta-seguimiento-semanal` (pendientes p94 y p89).
