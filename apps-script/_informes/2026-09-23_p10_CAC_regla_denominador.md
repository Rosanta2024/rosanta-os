# p10 · El conflicto del CAC: cuál es el denominador

23 de septiembre de 2026 · **Decisión de Juanma, 23-sep: el denominador son solo los
clientes que visitaron.** Este informe se escribió primero recomendando otra cosa y
quedó corregido; el argumento que se descartó está al final, porque explica qué hay
que vigilar para que esta regla no engañe.

## El conflicto

p10 definía el denominador como "clientes nuevos del mes, contados desde el CRM por
`fecha_alta`. Ahí caen TODAS las capturas de clientes nuevos". El problema es que en
el CRM "capturas" y "clientes" no son lo mismo.

Segmentos del CRM hoy (3,566 filas):

| segmento | filas |
|---|---|
| Lead (volcado histórico de GHL, sin `fecha_alta`) | 2,569 |
| Cliente que visitó | 442 |
| Carrito abandonado | 248 |
| Cancelado | 195 |
| Reserva histórica | 112 |

Un carrito abandonado es alguien que empezó una reserva y no la terminó. Un cancelado
canceló. Una "Reserva histórica" es una reserva que llegó al CRM pero cuya mesa nadie
marcó en Wix, así que no se sabe si la persona vino. Los tres tienen `fecha_alta`, y
ninguno es un cliente adquirido. Por eso agosto daba tres CAC distintos con el mismo
gasto: 72 altas, 58 reservas o 33 visitas confirmadas.

El rango Q116–Q38 que quedó escrito en p163 es exactamente esto: era el mismo mes
leído con dos denominadores. No era un dato dudoso, eran dos definiciones.

## La regla

**Denominador = altas del mes con segmento `Cliente que visitó`.** Nada más. Un CAC
cuenta clientes que entraron al restaurante, no reservas que quizá no se presentaron.

**Numerador = solo medios.** Categoría `MARKETING_DIGITAL` del maestro completa, con
los cargos en dólares convertidos (×7.7): los de Google Ads entran por la columna de
dólares de la tarjeta BAC, y por eso la pauta 2026 es Q16,521 y no Q10,800. Los
honorarios de gestión viven en `MARKETING_HONORARIOS` y NO entran, misma regla que
el ROAS.

**Publicar siempre la tasa de lectura al lado, y esto no es opcional con esta regla.**
`Cliente que visitó / (Cliente que visitó + Reserva histórica)`. Mide qué porcentaje
de las reservas del mes tiene la visita registrada. Es la condición que dice si el
CAC del mes se puede leer:

- **lectura ≥ 90%** → el CAC del mes es comparable.
- **lectura entre 50% y 90%** → el CAC sale inflado. Publicarlo con la advertencia.
- **lectura < 50%** → el mes no se publica. No hay CAC, hay un dato faltante.

Desde el 23-sep esa tasa se vigila sola: es la sexta señal de `Latido.gs` en la
intranet (p164), que avisa por correo cuando cae bajo el umbral.

## Denominador ya calculado

Leído del CRM en vivo el 23-sep-2026, después de la corrida de `sincronizarCRM` de
las 14:34 que subió 18 filas a "Cliente que visitó".

| mes | **denominador** | reservas del mes | lectura | ¿se puede leer? |
|---|---|---|---|---|
| ene | **47** | 47 | 100% | sí |
| feb | **47** | 47 | 100% | sí |
| mar | **41** | 41 | 100% | sí |
| abr | **15** | 15 | 100% | sí, pero ver abajo |
| may | **59** | 60 | 98% | sí |
| jun | **35** | 35 | 100% | sí |
| jul | **31** | 31 | 100% | piso, ver abajo |
| ago | **33** | 58 | 57% | inflado |
| sep (al 23) | **7** | 38 | 18% | **no** |

Tres avisos de lectura sobre esta tabla:

**Abril sigue sin explicar.** 15 clientes contra un rango normal de 31 a 59, con
lectura del 100%: no es que no se registrara quién vino, es que no entraron reservas.
El CAC de abril va a salir disparado y no es que la pauta haya fallado. Marcarlo como
no comparable, no como un mes caro.

**Julio está reconstruido a mano.** Las 15 altas del 15-sep salieron de cruzar el
export de SonTickets; del 23 al 31 de julio no hay dato en ningún archivo y
SonTickets está cerrado. El 31 es un piso, no el número real.

**Agosto y septiembre no son meses caros, son meses mal registrados.** Agosto tuvo 58
reservas y solo 33 marcadas: su CAC va a salir cerca del doble de lo real. Septiembre
con 18% no se publica. La causa está resuelta desde hoy (p163: el consumo se registra
marcando SEATED, sin cerrar la mesa ni disparar el correo de reseña), así que a partir
de octubre la lectura debería volver al 90% y estos dos meses quedan como un hueco
conocido, no como una tendencia.

## Qué falta para cerrar p10

El numerador mes a mes, que sale del maestro y lo tiene Finanzas. Con la columna de
denominador de arriba y esa columna, el CAC queda cerrado sin nada más que construir.

## El argumento que se descartó, y qué vigilar por eso

La primera versión de este informe proponía usar las reservas del mes (visitó +
histórica) en vez de solo las visitas confirmadas. El motivo: el número de "Cliente
que visitó" depende de que alguien marque la mesa en Wix, que es un hábito del equipo
y no un resultado de marketing, así que el CAC puede duplicarse un mes sin que la
pauta haya cambiado nada. Agosto es exactamente ese caso.

Juanma eligió la regla estricta el 23-sep, y es defendible: un CAC debe contar
clientes reales. Pero el riesgo del argumento descartado no desaparece por elegir la
otra regla, solo hay que administrarlo. De ahí que la tasa de lectura sea obligatoria
al lado del número y que haya un umbral explícito por debajo del cual el mes no se
publica. Sin esa guarda, esta regla convierte un descuido del salón en una conclusión
falsa sobre la pauta.
