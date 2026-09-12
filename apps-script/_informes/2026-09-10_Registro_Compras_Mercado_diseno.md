# Registro de compras de mercado · diseño

**Rosanta · 10 de septiembre de 2026** · responde al pendiente p88

---

## El problema, en una línea

El 60.8% de la compra entra con factura y se puede auditar. El resto es mercado en efectivo que hoy cae al maestro como `ALIMENTOS_EFECTIVO` sin decir qué se compró — solo en agosto son unos Q9,000 sin explicar. Mientras eso siga así, el CMV de cocina no se puede cruzar contra el recetario, y la brecha de 9 puntos de p96 no se puede separar entre merma, porcionado y fuga.

## El principio de diseño

**Un registro que exige perfección no se llena.** Jeffry vuelve del mercado con una bolsa y, con suerte, un papel. Si la hoja le pide el nombre exacto del Banco de Datos, el precio unitario y la unidad canónica antes de dejarlo guardar, la abandona en tres días y volvemos a Q9,000 sin explicar.

Por eso el diseño separa lo **obligatorio** de lo **deseable**, y deja que lo deseable se complete después, una vez por semana, por alguien sentado frente a una computadora.

- **Obligatorio en el momento:** fecha, quién compró, cuánto gastó en total.
- **Deseable en el momento:** el desglose por producto.
- **Se arregla después:** que el nombre del producto coincida con el Banco de Datos.

## Estructura

Tres pestañas en un Sheet propio. No meterlo en `COMPRAS_2026`: esa hoja es para compras con DTE y factura, y tiene otra lógica (fechas de pago, estatus). Mezclarlas hace que ninguna de las dos se pueda leer.

### Pestaña 1 · `RETIROS`

El control total. Una fila por cada salida de efectivo, que es lo que ya existe en el banco y no depende de que nadie recuerde nada.

| Columna | Qué va | Cómo se llena |
|---|---|---|
| `ID_RETIRO` | R-2026-W37-01 | fórmula |
| `FECHA` | fecha del retiro | del estado de cuenta |
| `MONTO Q` | monto retirado | del estado de cuenta |
| `ORIGEN` | ATM / Bancared / caja | del estado de cuenta |
| `QUIEN RECIBE` | Jeffry, Nadia… | lo pone Juanma |
| `REGISTRADO Q` | suma de las compras que apuntan a este retiro | fórmula |
| `DIFERENCIA` | monto − registrado | fórmula |

Esta pestaña se puede prellenar sola desde el maestro: los retiros de ATM y Bancared de `03_Banco_Industrial` ya están identificados.

### Pestaña 2 · `COMPRAS`

El detalle. Una fila por producto comprado.

| Columna | Obligatorio | Notas |
|---|---|---|
| `FECHA` | sí | por defecto, hoy |
| `ID_RETIRO` | sí | desplegable de la pestaña RETIROS |
| `QUIEN COMPRA` | sí | desplegable con el equipo |
| `LUGAR` | sí | desplegable: Mercado, La Bodegona, Los Alpes, otro |
| `PRODUCTO (como se dijo)` | sí | **texto libre, sin restricción** |
| `CANTIDAD` | no | número |
| `UNIDAD` | no | desplegable: g, ml, unidad, libra, manojo, caja |
| `MONTO Q` | sí | lo que pagó por ese producto |
| `PRODUCTO (Banco de Datos)` | no | desplegable validado contra el Banco · **se llena después** |
| `PRECIO / UNIDAD` | no | fórmula: monto ÷ cantidad |

La columna clave es la doble de producto. **`PRODUCTO (como se dijo)` es texto libre a propósito**: Jeffry escribe "tomate", "manojo de cilantro" o "chile pimiento" y sigue. `PRODUCTO (Banco de Datos)` es el desplegable canónico y lo llena quien haga el cuadre semanal. Sin esa segunda columna no hay forma de cruzar contra el recetario; sin la primera, nadie llena la hoja.

### Pestaña 3 · `CUADRE`

Una fila por semana ISO: retirado, registrado, diferencia, % del efectivo explicado, y cuántas filas quedan sin mapear al Banco de Datos.

Ese último número es el termómetro. Si sube semana tras semana, el mapeo se está abandonando y la hoja se está muriendo.

## La regla que lo vuelve un control y no un deseo

**La suma de `COMPRAS` de una semana tiene que cuadrar contra los retiros de efectivo de esa semana en el maestro.** Si no cuadra, o falta registrar compras o sobra efectivo sin explicar — y las dos cosas hay que saberlas.

Meta realista: llegar a **80% del efectivo explicado** en el primer mes. No 100%. Siempre va a haber un retiro que se usó para otra cosa, y perseguir el último 20% es lo que hace que la gente odie el sistema.

## Cómo se conecta con el recetario

Una vez que hay dos o tres meses con la columna del Banco de Datos llena:

1. Suma por producto y por semana → **compra real en efectivo por insumo**.
2. Cruzar contra el **consumo teórico** (fichas del recetario × ventas por plato del POS).
3. La diferencia, junto con la parte facturada, es la brecha real de p96 — y ahí sí se puede decir si es merma, porcionado o fuga.

También sirve de entrada para algo que hoy no existe: **precios de compra actualizados**. Hoy el Banco de Datos tiene precios de fecha variable, algunos de febrero. Si el registro trae `PRECIO / UNIDAD` real cada semana, se puede ver qué insumo se disparó y cuándo — que es la mitad de la explicación de por qué el food cost subió de 30-31% en junio a 47% en la S35.

## Puesta en marcha

**Semana 1 · papel o WhatsApp.** Que Jeffry mande una foto del papel o un mensaje al grupo con lo que compró y cuánto. Nadie llena un Sheet desde el mercado. El objetivo de esta semana es medir cuánto detalle sale de forma natural, no capturarlo bien.

**Semana 2 · la hoja, llenada por otro.** Alguien pasa lo de Jeffry a la hoja al final del día. Se mide cuánto tarda. Si tarda más de diez minutos por semana, el diseño está mal y hay que simplificarlo antes de seguir.

**Semana 3 en adelante · captura directa.** El Sheet en el teléfono de Jeffry, con los desplegables ya cargados. Solo cuando ya se sabe que el flujo funciona.

**Más adelante, si aguanta:** una pantalla en la intranet. Ya existe el rol de usuario limitado, así que la pantalla puede mostrar solo el formulario. Pero no construir software antes de que exista el hábito: si la hoja no se llena, la pantalla tampoco.

## Lo que hay que decidir antes de armarla

Tres cosas que necesitan tu criterio, no el mío:

1. **Quién hace el cuadre semanal** y en qué momento. Es el paso que sostiene todo y es el primero que se cae.
2. **Si el desglose por producto es obligatorio o deseable.** Yo lo pondría deseable el primer mes, para no matar la costumbre antes de que nazca. Pero sin desglose no hay cruce contra el recetario, así que en algún momento tiene que volverse obligatorio.
3. **Qué pasa cuando no cuadra.** Si no hay consecuencia ni conversación, la diferencia crece y el registro se vuelve decorativo.
