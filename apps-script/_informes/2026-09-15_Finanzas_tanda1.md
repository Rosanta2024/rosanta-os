# Finanzas & Data OS · Tanda 1 · 15 sep 2026

Datos que daban números mal. **Publicado en la @92** el 15-sep-2026, despliegue `AKfycby814…`. Juanma corrió la batería sobre HEAD: **103 OK · 0 fallas · 0 avisos · 3 saltadas** (192 s). Antes de publicar se comparó HEAD contra lo probado y contra el disco (55 archivos idénticos); después, la @92 bajada aparte contra HEAD, también idénticos. Commits `52eef87` … `7ac5a8a`. Maestro: 22 archivos.

**Año publicado** (espejo de las 13:21): resultado −Q44,650 (−3.5%) · prime cost 55.0% · fugas Q0 en las cuatro hojas. Intranet y `generar_finanzas.py`, iguales al centavo.

**Queda abierto:** identificar las 3 saltadas. Con la @88 eran 2; la batería no se pidió línea por línea.

## Qué cambió

| Id | Arreglo | Impacto medido (espejo del 14-sep) |
|---|---|---|
| p120 · A15 | Fecha con hora → su día (`_finDia_`, `dia()` en Python). Script `corregir_fechas_con_hora.js` para 157 filas. El cargador frena si la zona horaria del Sheet no es la del script | Junio −Q3,521 de venta, que pasan a julio; la factura de GRUPO ECO pasa de marzo a abril |
| A14 | Mes sin planilla → la última cargada, marcada «estimada». La semana ya no usa 29000 | Septiembre: +Q31,450 de mano de obra |
| M20 | UNIFORMES en bloque propio; el gasto de un mes sin venta va al año | +Q2,750 de gasto (jul-ago) |
| A13 · M14 | Semanas consecutivas con año (AAAAWW); las cortas y las sin venta entran a la móvil de 4 | Q0 hoy: ninguna semana de 2026 vende menos de Q1.000 |
| C6 | `LICORES: 'barra'` | Q0 hoy: la categoría no existe en el maestro |
| M17 | Números escritos como texto | Q0 hoy: no hay ninguno |
| p121 | Script `mercado_efectivo_p121.js`: 6 pagos a ALIMENTOS_EFECTIVO | +Q6,605 de COGS en jul-ago cuando se corra |

**Año, antes → después:** resultado −Q25,713 (−2.0%) → −Q59,913 (−4.6%); prime cost 53.7% → 56.2%. La diferencia es exactamente +Q31,450 + Q2,750.

## La fecha verdadera de las 157 filas (p120)

Todas las filas con hora caen al **día siguiente**. Se verificó contra las fuentes:
- ventas de julio: tickets 7013, 7019, 7047, 7048, 7083 y 7088;
- ventas de S37: tickets 7489, 7496 y 7531;
- FEL de S37: DTE 3948563532, 601312645, 3045082023 y 3523300253;
- GRUPO ECO 487473840 está en el export del 2º trimestre.

Hoy el Sheet está en Guatemala. La hora 22:00 en invierno y 23:00 en verano es la firma de una zona con horario de verano al momento de la carga.

## Verificación

- A/B intranet contra `generar_finanzas.py` sobre el espejo: igual al centavo en el total, en los 9 meses, en las 37 semanas y en los días de caja.
- Datos sintéticos: 12 de 12 OK con el código nuevo; el respaldo reproduce los 12 errores.
- `node --check` de los `.js` y del `<script>` de FinanzasVista, con control negativo; `py_compile`.
- Seis pruebas nuevas en `PruebasFinanzas.js`. «Ninguna fecha del maestro trae hora» va a dar AVISO hasta que se corra el script de fechas.

## Scripts del maestro, corridos por Juanma el 15-sep

- **Fechas:** 157 filas, espejo regenerado 12:50, ninguna fecha con hora en las cinco hojas. La primera corrida escribió 120 y **37 del FEL no aceptaron `setValue(Date)`, sin error**. El script releyó lo escrito, `diagnosticarFechasFEL` descartó fórmula, formato, merge, validación y protecciones, y la fecha escrita como texto `AAAA-MM-DD` entró a la primera. Regla nueva: en el maestro, una fecha se escribe como texto.
- **Mercado (p121):** 6 filas a ALIMENTOS_EFECTIVO, verificadas con la revisión (6 «ya estaban bien») y en el espejo. COGS de julio +Q3,019 y de agosto +Q3,586.

## Regla 13: la factura anulada no suma (hallazgo del 15-sep)

El motor y `generar_finanzas.py` no miraban la columna Estado del FEL. Contaban 15 facturas anuladas en SAT por Q7,535 como gasto; las fórmulas del maestro ya las filtraban desde el 2-sep. Ahora quedan fuera en los dos, con prueba en la batería y en la prueba sintética (13 de 13).

- **Con reemplazo:** 13 de las 15 tienen su factura vigente del mismo proveedor el mismo día.
- **Sin reemplazo dentro de ±5 días:** GRUPO ECO DTE 487473840 (Q1,467.14, 1-abr) y Distribuidora Los Alpes DTE 341132076 (Q1,500, 25-ene). Hay que confirmar con Juanma.

## Números finales sobre el espejo de las 12:50

| | Antes de la tanda | Después |
|---|---:|---:|
| Resultado del año | −Q25,713 (−2.0%) | −Q59,972 (−4.7%) |
| Prime cost | 53.7% | 56.4% |
| COGS | Q443,816 | Q446,592 |

Cómo se llega a esa diferencia:
- planilla estimada de septiembre: −Q31,450;
- Uniformes: −Q2,750;
- mercado sin factura: −Q6,605;
- anuladas fuera del cálculo: +Q6,546.

Intranet y Python dan lo mismo al centavo en el total, en los 9 meses, en las 37 semanas y en los días de caja.

## Decisiones de Juanma (15-sep, tarde) y lo que se hizo con cada una

1. **Mes en curso sin planilla:** se estima con la última planilla, en proporción a los días con venta cargada. Septiembre lleva 13/30 de la planilla de agosto (Q13,628). Aplicado en el motor y en Python, A/B al centavo; prueba sintética 13 de 13.
2. **Elder:** son pagos fraccionados de una factura de 2025. La regla 3 ya los deja fuera; no se toca.
3. **Anuladas sin reemplazo** (GRUPO ECO y Los Alpes): errores del proveedor. Quedan fuera del cálculo.
4. **Factura de la abogada (Q2,000):** pasa a SERVICIOS PROFESIONALES. Script `abogada_y_torre.js`, que también agrega el proveedor a `00_Proveedores`.
5. **Q500 «F-TORRE CUIDAD VIEJA» del 28-06:** retiro en efectivo para el mercado. Pasa a ALIMENTOS_EFECTIVO en el mismo script: como ALIMENTOS pagado desde el banco, la regla 3 lo saltaba.

**Batería sobre el HEAD anterior a este cambio:** 103 OK · 0 fallas · 0 avisos · 3 saltadas (181 s). Falta identificar las 3 saltadas: con la @88 eran 2.

**Año con el reparto** (espejo de las 12:50, antes del script de la abogada y la Torre): resultado −Q42,150 (−3.3%) · prime cost 55.0%.

## Pendiente

- Juanma: dry-run de los dos scripts del maestro y batería en `/dev`.
- Decisión: prorratear la planilla estimada del mes en curso. Hoy septiembre muestra prime 73.8% porque tiene la planilla completa contra medio mes de venta.
- Decisión: Elder (ver la respuesta del 15-sep).
- Pago de Q500 «F-TORRE CUIDAD VIEJA» del 28-06 sin factura, como ALIMENTOS.
- Respaldo: `rosanta-intranet/_backups/tanda1-finanzas-2026-09-15/`. Arnés en el scratchpad de la sesión (`sim/correr.js`, `sim/sintetico.js`).
