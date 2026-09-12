# Informe · ROAS: inversión en medios vs honorarios de gestión

**Rosanta · 10 de septiembre de 2026**
Respuesta al prompt `PROMPT_ROAS_medios_vs_honorarios.md`, entregado a Code el 2 de septiembre.

---

## Veredicto

**Ya está resuelto, en los dos lados, y desde el 2 y 3 de septiembre.** El trabajo se hizo y quedó documentado dentro del propio código; lo único que faltaba era este informe de vuelta. No hay nada que cambiar.

La regla quedó implementada así:

> En el denominador del ROAS entra **solo la compra de audiencia en plataforma**: Meta Ads y Google Ads. Quedan fuera los honorarios de quien gestiona la pauta, la producción de contenido y las suscripciones de herramientas. Esos honorarios **sí** cuentan en el bloque Marketing del DRE, porque la banda de referencia del sector (4% a 8% de la venta) se mide sobre el gasto total de marketing, gestión incluida.

Son dos preguntas distintas y ahora cada una tiene su número: *cuánto pesa marketing en mi operación* y *qué devuelve cada quetzal de pauta*.

---

## Lado 1 · La intranet

Archivo: `rosanta-intranet/Marketing.html`, función `computeRoas()`.

El denominador nunca toca el maestro financiero. Sale de dos fuentes que por construcción ya son solo medios:

| Dato | Origen |
|---|---|
| `mCosto` | Meta Graph API, escrito por el Google Ads Script |
| `gCosto` | Google Ads Script, `metrics.cost_micros` |

Como ninguna de las dos lee la categoría `MARKETING_DIGITAL` del maestro, los honorarios no tienen por dónde entrar. La regla está escrita como comentario de bloque encima de la función, con la advertencia de no cambiarla sin leerla.

Tres arreglos de fondo que vinieron con el mismo cambio y que importan tanto como la separación:

- **Periodo alineado.** Antes el ROAS tomaba el gasto vivo de Meta del selector de arriba, que por defecto son 30 días, y lo dividía contra el ingreso de una sola semana. Además no incluía el gasto de Google. Dos errores en direcciones opuestas que se cancelaban a medias y que nadie podía leer por separado. Hoy ROAS, ROI y CAC comparten la misma semana ISO y el mismo denominador.
- **Plataforma sin dato ≠ plataforma sin gasto.** Si el Google Ads Script no escribió la semana, el denominador queda corto y el ROAS sale alto. Ahora la tarjeta lo avisa en pantalla en vez de dejarlo pasar.
- **Sin datos no se inventa un ratio.** Antes salía "0.00x · En pérdida" cuando faltaba el dato, que es justo la lectura que hace apagar una campaña que va bien. Hoy muestra un guion y dice por qué.

## Lado 2 · El maestro

Archivo: `rosanta-maestro/instalarBloqueMarketing.js`, bloque MARKETING de la hoja `06_Dashboard_Operativo`.

El criterio de identificación de medios, cuando el gasto se lee desde el maestro, es la descripción del cargo en la tarjeta:

- Meta → la descripción trae **`FACEBK`**
- Google → la descripción trae **`GOOGLE*ADS`** (el asterisco es literal; en el SUMIFS va escapado como `~*`)

Todo lo demás de `MARKETING_DIGITAL` es gestión, contenido o herramientas.

Estructura del bloque:

| Fila | Qué es | Entra al ROAS |
|---|---|---|
| Medios · Meta Ads | TC BAC, descripción `FACEBK` | Sí |
| Medios · Google Ads | TC BAC, descripción `GOOGLE*ADS`, convertido de USD | Sí |
| **Subtotal MEDIOS** | los dos anteriores | **Este y solo este es el denominador** |
| Gestión de pauta con factura | FEL por NIT | No |
| Gestión sin factura y herramientas | banco + tarjeta `MARKETING_DIGITAL` que no sea medios | No |
| **TOTAL MARKETING** | los tres bloques | banda del sector 4–8% |

El propio código deja la prueba cruzada escrita: *"el subtotal de medios de este bloque es exactamente el denominador del ROAS de la intranet. Si algún día no cuadran, uno de los dos está mal."*

## Detalle que valía la pena resolver

**A Vanessa se le paga por dos vías.** Normalmente cobra por transferencia del Banco Industrial, pero en agosto la transferencia no pasó y se le pagó por PayPal con la tarjeta. Es el mismo gasto por otro canal, y si el bloque leyera una sola fuente, agosto saldría con la gestión subvaluada. Por eso la fila de gestión sin factura lee las dos: la fila del banco más lo que en la tarjeta está como `MARKETING_DIGITAL` y no es medios. Ese resto también recoge herramientas de marketing, y está bien que las recoja: la banda de 4–8% mide el gasto de marketing completo.

## De qué depende que esto siga siendo cierto

Dos cosas que ya se hicieron y que, si alguien las revierte, hacen mentir al bloque:

1. **`recategorizar_pauta`** sacó de `MARKETING_DIGITAL` los pagos de Edwin y de la empresa de monitoreo. Sin eso, la fila de gestión sin factura sale inflada en unos Q16,500.
2. **`filtro_anuladas`** hizo que el gasto FEL deje de contar facturas anuladas.

Y una condición operativa: el cargo de tarjeta de Vanessa tiene que quedar categorizado como `MARKETING_DIGITAL`. De eso se encarga `recategorizar_pauta`.

## Si algún día hace falta el número con gestión incluida

Va **aparte y con otro nombre** — por ejemplo "costo total de adquisición" — nunca sobrescribiendo el ROAS. La razón es la de siempre: si el honorario entra al denominador, la pauta parece rendir menos de lo que rinde, y escalar o apagar campañas se decide con un número equivocado.

---

## Lo único que queda por verificar en pantalla

Dos cosas que el código no puede comprobar solo:

1. Que el **Subtotal MEDIOS** del maestro cuadre contra la **Inversión medios** que muestra la intranet para la misma semana. Si no cuadran, uno de los dos está mal.
2. La hoja `06_Dashboard_Operativo` tenía dos defectos anotados: *Consumo asociado Q* en cero y el selector clavado en la semana 25. Conviene mirarlos de paso, aunque no afectan al ROAS.
