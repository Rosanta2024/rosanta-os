# Prompt · Proyección de caja 30/60/90 para Rosanta

Pegar al arrancar una **sesión de Claude Code sobre `~/Dev/Rosanta/apps-script/rosanta-intranet`**: el forecast es código de la intranet. Está escrito para que se entienda en frío, sin haber visto la sesión donde salieron estos números.

---

Quiero construir la **proyección de caja a 30, 60 y 90 días** de Rosanta (CORSAGA, S.A., restaurante de gastrococtelería en Antigua Guatemala). Es el pendiente p94 del tablero `rosanta-seguimiento-semanal` y el único entregable del pilar Finanzas & Data que arranca de cero.

Carga el cerebro `rosanta-cerebro` para el contexto general. Abajo está todo lo que ya se midió el 11 de septiembre de 2026, para que no lo repitas.

## Actualización del 12 de septiembre de 2026: leer antes que todo lo demás

**Si algo de este bloque contradice lo de abajo, manda este bloque.** El análisis del 11-sep se conserva como estaba, pero dos cosas cambiaron de fondo.

### 1. Dónde vive: pestaña "Caja" de Finanzas, en la intranet

Decisión de Juanma del 12-sep. **No** va en un artefacto. El 12-sep la intranet pasó a ser la única superficie del pilar 3 (detalle en `Rosanta OS/03_Finance_Data_OS/2026-09-12_Unificacion_Intranet.md`), y los artefactos `rosanta-dre-mensual` y `rosanta-dashboard-semanal` se eliminaron. El shell de Finanzas (`SistemaFinanzas.html`) hoy tiene cuatro pestañas: La semana, Metas de la semana, 2026 contra 2025 y Escenarios. El forecast es la quinta.

### 2. El enfoque cambió: no es extracción, es tamaño

El documento que manda es **`Rosanta OS/03_Finance_Data_OS/2026-09-12_Objetivo_Operacional.md`**. Leelo entero antes de modelar. En corto:

| | Por mes | Naturaleza |
|---|---:|---|
| Retiro de Juanma | Q5,000 | fijo, sale todos los meses |
| Alquiler de su casa, US$1,800 @ ~7.72 | ~Q13,896 | fijo, sale todos los meses |
| **PISO** | **Q18,896** | |
| Devolución a Raúl | Q100,000 **una vez, en el primer trimestre** | flexible, puede ser menos |
| **OBJETIVO** (Raúl amortizado) | **Q27,229** | |

- La operación dejó **Q12,845/mes** en mayo a agosto.
- **No hay sobregasto.** En mayo a agosto se extrajo Q14,132/mes contra Q18,896 de necesidad real: Juanma se está quedando **corto en Q4,764 al mes**.
- Cubrir el piso pide **+5.4% de venta** (~Q8,600/mes); cubrir el objetivo, **+12.8%** (~Q20,500/mes).
- *"Cualquier trabajo que arranque proponiendo recortes personales está resolviendo el problema equivocado."*

Por eso **la frase de abajo "la caja está apretada por la extracción" quedó superada**, y los puntos 4 y 5 del pedido ya están reescritos: el retiro y el alquiler entran como **compromisos fijos**, la devolución a Raúl como **un pago fechado en el primer trimestre** (no en doceavos: la caja se rompe el día 15), y la pregunta del punto de quiebre es **cuánta venta adicional o cuánto costo menos** hace falta para no cruzar cero, no cuánto dejar de extraer.

### 3. Preguntas que ya se respondieron

- **Pregunta 1 (retiros del socio): respondida.** Eran tres acreedores y queda uno. Kristinsa (Q32,535) y Manuel Lemus (Q6,000) están pagados. Queda **Raúl**: se le pagaron Q50,000 en 2026 (fila del 18-feb) y **para 2027 el objetivo es Q100,000, una vez, en el primer trimestre**. Febrero no se repite como evento: se reemplaza por ese pago fechado.
- **Pregunta 2 (gasto personal): respondida.** No es una variable a recortar: es el piso de Q18,896.
- **Siguen abiertas la 3 (línea de crédito), la 4 (aguinaldo de diciembre) y la 5 (deuda fuera del banco).** Preguntalas.

### 4. De dónde se leen los datos en la intranet

- **Reusá el motor, no leas el maestro dos veces.** `_finDatos(forzar)` en `FinanzasDatos.js` ya trae `semanas` (la serie semanal, con ventas y COGS), `meses`, `caja` (último saldo BI + BAC), `gasto_dia`, `dias_caja` e `integridad`. Es privada: la llaman funciones que ya verificaron el permiso.
- **Planilla devengada:** `_finPlanilla()` la lee del Sheet `Planilla 2026` (pestañas `AAAA-MM`). **No la copies al código:** el diccionario de abajo es el respaldo que tiene el motor y ya se quedó en agosto.
- **Meta de food cost y tipo de cambio:** `_finParametro(clave, defecto)` sobre PARAMETROS del Sheet de config.
- **Para el calendario de pagos recurrentes** hace falta el saldo y los débitos por día de `03_Banco_Industrial` y `04_Banco_BAC`: leé cada hoja **una sola vez** (`getDataRange().getValues()`), nunca `SpreadsheetApp` dentro de un bucle.
- **Los compromisos que no salen del banco** (retiro, alquiler de la casa, el pago a Raúl con su fecha, aguinaldo) conviene guardarlos en **una pestaña `COMPROMISOS` del Sheet de config** que Juanma pueda editar, no en el código. Es la lección del 12-sep: un número escrito en dos lugares se desincroniza. El nombre `COMPROMISOS` estaba libre el 12-sep; verificalo de nuevo.
- `generar_finanzas.py` (hoy en `~/Dev/Rosanta/scripts/maestro-finanzas/`) **solo sirve para cotejar**. No es fuente del forecast.

### 5. Reglas técnicas de la intranet, sin excepción

1. **Shell:** en `SistemaFinanzas.html`, un botón `data-sub="caja"` y su URL en `URLS` (`?page=caja&embed=1`). En `Code.js`, sumar `'caja'` a la lista de subs válidos y el route `pagina === 'caja'` con `render_('CajaVista', { usuario, urlBase, authToken, mostrarVolver: !embebida })` y `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`. Sin ALLOWALL el shell no la embebe; sin `mostrarVolver` la plantilla revienta.
2. **Permiso:** `getCajaData(auth, forzar)` con **`exigirModulo_(auth, 'finanzas')` como primera línea**. doGet protege la página, no la función. Si guarda algo (por ejemplo, compromisos), la función de escritura también exige el módulo, y borra el cache que corresponda en el mismo lugar donde escribe.
3. **Nombres:** prefijo `caja` / `_caja`. El 12-sep no había ninguna función, variable ni archivo con "caja", "proyecc", "forecast" o "compromis"; verificalo de nuevo, porque todos los `.js` comparten un solo ámbito global.
4. **Llamadas desde la vista:** `var AUTH = '<?= authToken ?>';` y `google.script.run.getCajaData(AUTH, ...)` con el **nombre literal**. Nunca `run['nombre']()`: el barrido de pruebas no ve esa forma.
5. **Archivos nuevos en `.js`**, no `.gs`: `.clasp.json` sube solo `.js`. Los respaldos van a `_backups/` (hay `.claspignore`).
6. **Pruebas:** un grupo en `PruebasFinanzas.js`, y `'CajaVista'` en las **dos** listas `VISTAS` de `Pruebas.js`. Una prueba que compara tiene que dar SALTADA o FALLA cuando no hay nada que comparar, nunca OK.
7. **Otras sesiones:** antes de tocar `Code.js`, `Pruebas.js` o `SistemaFinanzas.html`, `ListAgents` y avisar por `SendMessage`. El 12-sep hubo cinco escribiendo la misma carpeta.
8. **Publicar:** `clasp push`, después la batería en `https://script.google.com/a/macros/rosanta.rest/s/AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=pruebas` (`clasp run` no funciona con el login actual; mirar el conteo, no el color), y recién ahí, **con autorización de Juanma**, `clasp create-version` + `clasp update-deployment -V <n> AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb`, **sin push**. Verificar bajando la versión aparte con `clasp pull --versionNumber <n>`. El equipo quedó en la **v80** el 12-sep.

## Dónde están los datos

- **Fuente única de verdad:** Google Sheet nativo `Rosanta_Reporte_Maestro_v2_2026`, id `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`.
- **Lo que se lee desde código:** el espejo `Rosanta_Maestro_ESPEJO.xlsx`, que un Apps Script exporta cada lunes a la misma carpeta. **Nunca se edita a mano.** Si hiciste un cambio en el Sheet, corre `generarEspejo()` antes de analizar o vas a leer datos viejos.
- **Carpeta del espejo:** `My Drive / Rosanta OS / 03_Finance_Data_OS / Maestro`.
- **Generador:** *(desactualizado)* ya no está en esa carpeta: vive en `~/Dev/Rosanta/scripts/maestro-finanzas/generar_finanzas.py` desde el 11-sep y **solo sirve para cotejar**. En la intranet los datos salen del motor (ver la actualización del 12-sep).
- **Hojas del maestro:** `01_FEL_Maestro`, `02_Ventas_Maestro`, `03_Banco_Industrial`, `04_Banco_BAC`, `05_Tarjeta_Credito_BAC`.

Los ocho meses del año están validados al centavo contra los PDF originales del banco: 8 de 8 en Banco Industrial y 8 de 8 en BAC. El dato bancario es confiable.

## El hallazgo central, ya medido *(11-sep; la lectura se corrigió el 12-sep, ver arriba)*

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

Del DRE anual, medido el 11-sep *(hoy vive en la intranet, pestañas La semana y Escenarios; el artefacto `rosanta-dre-mensual` se eliminó el 12-sep. Re-medí antes de citar)*:

- Ventas netas sin IVA y sin eventos: **Q1,220,487**
- COGS **Q450,227 (36.9%)** · gasto operativo **Q858,465 (70.3%)** · resultado **−Q88,205 (−7.2%)**
- Punto de equilibrio: **Q90,612 al mes** contra Q152,561 de venta real. El problema no es vender.
- Prime cost del año **56.9%**, bajo el límite de 60%. Pero julio 66.0% y agosto 67.5% se rompieron.
- Sobre rango: alquiler 16.9% (banda 6-10%), comisiones bancarias 6.2% (3-5%), honorarios 6.3% (1-3%), bienes de uso 5.3% (3-5%).
- Bajo rango: nómina 20.0%, ocho puntos **debajo** del piso del sector. El margen no se va en gente.
- **El alquiler ya se negoció a la baja y no hay más margen.** No reproponer renegociarlo.
- Meta de food cost: **30% fija**, decisión de negocio del 10 de septiembre. No es ponderada por mix.

Ojo con la diferencia entre las dos vistas: el P&L da −Q88,205 y la caja de operación da +Q188,547. No se contradicen. El P&L está en base devengada y neto de IVA; la caja incluye el IVA cobrado que todavía no se ha enterado, y no incluye devengos.

## Planilla devengada por mes, que es la que vale para costo laboral *(respaldo: la intranet la lee del Sheet, no la copies al código)*

`{1: 28850, 2: 28875, 3: 27600, 4: 27100, 5: 31925, 6: 29900, 7: 29010, 8: 31450}`

La nómina del banco **no** sirve para el costo laboral: el banco reparte los sueldos de un mes entre dos y eso hace saltar el prime cost de 40% a 76% sin que la operación cambie.

## Estacionalidad

- Temporada alta: **noviembre y diciembre**. Septiembre es históricamente flojo.
- La semana S36 (31 ago al 6 sep) fue **la venta semanal más alta de la serie**: Q41,707 con ticket de Q353.45 por comensal, +Q79.62 contra la semana anterior.
- Serie semanal completa de 2026: en la intranet, `_finDatos().semanas`. *(`pant.json` solo existe si se corre `generar_finanzas.py` para cotejar.)*

## Trampas del dato, verificadas. No volver a caer

1. **Traspasos entre cuentas propias.** Los créditos con glosa que contiene `CORSAGA` son transferencias de la empresa a sí misma: **Q35,800 en el año**. Si se cuentan como entrada, la caja de operación sale inflada.
2. **Base bruta contra base neta.** Mayo tiene dos reportes con cifras distintas y **las dos son correctas**: Q208,883.70 es bruto con IVA más eventos, Q186,503.30 es neto sin IVA más eventos. Toda serie mensual tiene que declarar su base o alguien va a "ver" una caída del 11% que no existe.
3. **Productos borrados del POS.** 875 de 9,666 líneas apuntan a productos que ya no están en el catálogo, Q69,163 o el 5.6% de la venta por líneas. Hay que imputar el precio modal del mismo producto en otros tickets antes de agrupar, o el análisis pierde justo a los platos estrella (Lomito Rosanta, Pulpo, Costilla).
4. **Fechas del FEL desfasadas un día.** Trece filas (984 a 996 de `01_FEL_Maestro`) tienen hora 22:00 o 23:00 y Apps Script y Python las leen con un día de diferencia. Una cruza de mes: GRUPO ECO, Q1,467.14, marzo o abril según quién pregunte.
5. **Las reglas 3 y 7 del generador saltan Q182,187** de pagos bancarios asumiendo que la factura ya entró por FEL. Está auditado y es correcto en agregado: hay Q280,229 de facturas contra esos Q182,187. La exposición real son unos Q15,400 y están identificados en el pendiente p121.

## Qué quiero que construyas

Una **proyección de caja a 30, 60 y 90 días** desde la fecha en que se corra, como **pestaña "Caja" de Finanzas en la intranet**, al lado de La semana (donde viven el RAA y el panel de integridad del dato) y de Escenarios. Ver la actualización del 12-sep arriba.

Que tenga:

1. **Calendario de compromisos**, no un promedio. Sacá del histórico bancario los pagos recurrentes con su fecha y monto típico: alquiler, planilla, IGSS, impuestos, seguridad (EX Security, Q250 al mes), internet, teléfonos, alquiler de equipo, tarjeta de crédito. Un promedio mensual esconde que la caja se rompe el día 15, no el día 30.
2. **Entradas modeladas sobre la estacionalidad real**, no sobre la media. Con la serie semanal de los 36 puntos que ya existe, y con noviembre y diciembre marcados como alta.
3. **Bandas**, no un número. Escenario base, uno pesimista y uno optimista, con el supuesto de cada uno escrito.
4. **El punto de quiebre.** Lo más importante: en qué fecha el saldo proyectado cruza cero en cada escenario, y **cuánta venta adicional (o cuánto costo menos) haría falta para que no cruce**, con el piso de Q18,896 y el pago a Raúl calendarizados como compromisos. *(Reescrito el 12-sep: antes decía "cuánto habría que dejar de extraer".)*
5. **La venta, el costo y la devolución a Raúl como variables; el piso como compromiso.** El retiro de Juanma (Q5,000) y el alquiler de su casa (US$1,800) salen sí o sí y no son palanca. La devolución a Raúl es flexible: Q100,000 en el primer trimestre, puede ser menos. Que el modelo deje mover eso y la venta. *(Reescrito el 12-sep: antes trataba toda la extracción como la palanca real.)*

## Preguntas que hay que responderle a Juanma antes de cerrar el modelo *(la 1 y la 2 se respondieron el 12-sep, ver arriba)*

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
