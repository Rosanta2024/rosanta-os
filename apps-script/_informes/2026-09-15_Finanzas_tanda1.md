# Finanzas & Data OS · Tanda 1 · 15 sep 2026

Datos que daban números mal. Commit `52eef87`, subido a HEAD de la intranet (55 archivos) y del maestro (21). **No publicado**: el equipo sigue en la @91.

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

## Pendiente

- Juanma: dry-run de los dos scripts del maestro y batería en `/dev`.
- Decisión: prorratear la planilla estimada del mes en curso. Hoy septiembre muestra prime 73.8% porque tiene la planilla completa contra medio mes de venta.
- Decisión: Elder (ver la respuesta del 15-sep).
- Pago de Q500 «F-TORRE CUIDAD VIEJA» del 28-06 sin factura, como ALIMENTOS.
- Respaldo: `rosanta-intranet/_backups/tanda1-finanzas-2026-09-15/`. Arnés en el scratchpad de la sesión (`sim/correr.js`, `sim/sintetico.js`).
