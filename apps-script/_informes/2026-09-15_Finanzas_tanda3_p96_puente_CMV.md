# Finanzas & Data OS · Tanda 3 · p96: CMV real contra teórico · 15 sep 2026

**Conclusión:** los "9 puntos" de p96 eran real contra **meta**, no contra teórico. Medido con la misma vara, enero–agosto:

| | % sobre venta sin IVA ni servicio |
|---|---:|
| Meta | 28.0% |
| Teórico (lo que dicen las fichas por lo vendido) | 31.8% |
| Real (compra ± inventario) | 37.1% |

- **3.8 puntos** son de las fichas y los precios: aun sin merma, las recetas vendidas cuestan más que la meta.
- **5.3 puntos (Q60,926)** son la brecha real: merma, porcionado, fuga o compra sin detalle. Está arriba del umbral de 4 puntos de Profit OS.

## Decisiones de Juanma (15-sep)

1. El semáforo de food cost de Finanzas se mide sobre venta **sin servicio**, igual que la meta. Va en la tanda de pantalla.
2. Eventos y paquetes van **en los dos lados**: su venta y su compra.
3. **No hay comida de personal**.

## Cómo se midió

- **Teórico.** `revisarPuenteCmv()` (nuevo, `PuenteCmv.js`, solo lectura con guarda de dueño) corre `ingenieriaDeMenu_` una vez por mes sobre VENTAS x PLATO. Juanma lo corrió en el editor.
  - La venta de enero a julio coincide al centavo con el reporte del POS leído aparte en Python.
  - Prueba en Node con el código real: 83 OK, y dos controles negativos fallan.
- **Real.** La compra por área del motor `FinanzasDatos` sobre el espejo del 15-sep 13:21, menos la variación de inventario.
  - Cocina y barra suman el COGS de cada mes (diferencia máxima Q1).
  - Inventario de barra: cierres de enero a agosto.
  - Inventario de cocina: solo hay mayo y julio, así que la variación se aplica en el bloque junio–julio.
- **Misma venta en los dos lados:** VENTAS x PLATO, sin IVA y sin el 10% de servicio. La venta de Finanzas incluye el servicio: enero Q143,277 contra Q130,011.
- **Lo que no tiene costo de ficha se estima:**
  - **ciego** (producto conocido sin costo firme): al CMV de su área;
  - **fuera** (eventos, paquetes, brunch y productos sin equivalencia): al CMV mezclado del mes.
  - Teórico de enero a agosto: firme Q254,537 + ciego Q55,195 + fuera Q56,035.

Scripts: `scripts/maestro-finanzas/p96_2026-09-15/` (`puente.py` y el registro `teorico_log.json`).

## Por mes

| Mes | Finanzas hoy (con servicio) | Real | Teórico | Brecha | Puntos |
|---|---:|---:|---:|---:|---:|
| Ene | 39.5% | 43.5% | 32.2% | Q14,664 | 11.3 (sin inventario de diciembre) |
| Feb | 33.8% | 35.0% | 32.3% | Q4,867 | 2.7 |
| Mar | 33.7% | 36.8% | 31.6% | Q7,637 | 5.2 |
| Abr | 28.6% | 31.3% | 32.5% | −Q1,849 | −1.3 |
| May | 29.1% | 31.1% | 32.2% | −Q1,977 | −1.2 |
| Jun | 31.7% | 33.4% | 31.7% | Q2,180 | 1.7 |
| Jul | 38.2% | 40.0% | 30.8% | Q10,754 | 9.2 |
| Ago | 49.9% | 48.4% | 30.4% | Q24,650 | 18.0 |

| Bloque | Real | Teórico | Brecha |
|---|---:|---:|---:|
| Enero–agosto | 37.1% | 31.8% | 5.3 pts |
| Febrero–agosto (barra con inventario) | 36.3% | 31.7% | 4.5 pts |
| Junio–julio (las dos áreas con inventario) | 36.9% | 31.3% | 5.7 pts |

**Lectura:**
- **Un mes suelto no sirve:** la compra va a saltos y cocina no tiene inventario mensual. Los bloques dan entre 4.5 y 5.7 puntos.
- **El teórico es estable,** 30–33% todos los meses. Lo que se mueve es el real.

## Dónde se concentra

- **Agosto es el 40% de la brecha del año (Q24,650).**
  - La compra de cocina fue de Q57,127: con factura Q26,551 (la más alta del año) y sin factura Q30,576.
  - De lo sin factura, **Q21,800 son 18 retiros de cajero sin detalle, del 11 al 29-ago**: de Q100 a Q2,000 cada uno y nunca más de Q3,000 en un día. (Corregido: el primer informe decía Q23,300 por un error de suma.)
  - Hasta el 7-ago las filas decían qué se compró ("S31Mercado", "S31CarneaJeffry").
- **Compra de cocina sin factura:**

  | | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|
  | Sin factura | 26,231 | 25,400 | 21,600 | 23,300 | 30,166 | 21,400 | 13,109 | 30,576 |
  | Con factura | 14,811 | 21,586 | 15,926 | 10,803 | 11,193 | 12,153 | 23,224 | 26,551 |

  Es el 58% de la compra de cocina del año y no dice qué se compró (p88).
- **Revisada:** la transferencia del BAC de Q2,520 del 20-ago, marcada ALIMENTOS_EFECTIVO, no tiene su crédito en el BI. No es un traspaso entre bancos.

## Límites

- **Costo de ficha actual:** no hay historia de costos por mes. Si los insumos subieron durante el año, el teórico de los primeros meses queda alto y la brecha de esos meses, corta.
- **Reparto por área no confiable:** "fuera" incluye bebidas de barra sin equivalencia en el catálogo (Chardonnay Copa, Blanco La Val), así que el denominador de barra queda corto. Por eso la conclusión va sobre el total.
- **Lo que no se puede separar todavía:** merma, porcionado y fuga. Hace falta:
  - inventario mensual de cocina (Inventarios fase 2);
  - el detalle de la compra sin factura (p88).

## 3.4A · Food cost de Finanzas sobre venta sin servicio (publicado en la @94)

**Publicado el 15-sep en la @94**, con "publica" de Juanma.
- **Batería sobre HEAD:** 111 OK · 0 fallas · 0 avisos · 3 saltadas.
- **Antes de publicar se verificó:**
  - la cuenta de clasp;
  - la última versión (@93) era la publicada;
  - HEAD (58 archivos) idéntico a lo probado y al disco.

Decisiones de Juanma: el techo de compra también va sin servicio; el prime cost sigue sobre la venta total; A se publica sola, antes que B.

- **Regla 14:**
  - **Base de cada ticket:** Costo + Ganancia (cols 6 y 7) ÷ 1.12. En 1,797 de 1,902 tickets es exactamente Subtotal ÷ 1.10.
  - **Excepción:** si la base viene vacía o mayor que el Subtotal (tarjeta de regalo), vale el Subtotal.
- **Qué cambia:**
  - food cost de meses, año y semanas, y la móvil 4;
  - tarjeta de food del RAA: su costo en Q va sobre venta sin servicio;
  - techo de compra de Metas: se multiplica por la proporción sin servicio del año (0.9058) y baja cerca de 9%. Cocina queda en Q25,436 al mes contra Q28,080, barra en Q5,154 contra Q5,690, sobre el espejo del 15-sep;
  - rótulos de La semana y Metas;
  - caché `finanzas_v7`.
- **Qué no cambia:** venta, mano de obra, prime cost, neto, bloques del DRE, margen de contribución y equilibrio.
- **Efecto sobre el espejo del 15-sep:** food cost del año de 34.7% a 38.3%. Prime cost se queda en 55.0%. Proporción venta total ÷ sin servicio: 1.104.
- **Verificación:**
  - **A/B contra `generar_finanzas.py`** (mismo cambio en el espejo Python): 9 meses y 37 semanas con los mismos porcentajes. Única diferencia: un centavo de redondeo en la venta sin servicio de la S29.
  - **Pruebas nuevas en el grupo 8:** "El food cost va sobre la venta sin servicio", "Semanas y meses usan la misma venta sin servicio" y "El prime cost sigue sobre la venta total". Con el motor anterior las dos primeras fallan.
  - **Resto:** tarjeta del RAA y techo de Metas probados en Node contra su fórmula; scripts de las dos vistas compilados, con control negativo.
  - **HEAD** verificado con bajada aparte: 58 archivos. Commit 280b608.
- **Profit OS** confirmó que su teórico ya es costo ÷ (precio ÷ 1.12), sin servicio: las dos bases quedan comparables.

## 3.4B · Tarjeta "CMV real contra teórico" en el tablero de Profit OS (subida a HEAD, sin publicar)

Diseño acordado con la sesión de Profit OS, que dio visto bueno para tocar solo la tarjeta y su pedido.

- **Servidor** (`PuenteCmv.js`, de Finanzas):
  - **Llamada:** `getCmvRealTeorico(auth)`, con `exigirModulo_(auth, 'recetario')`. Va aparte de `getProfitOS`, como los avisos, porque corre `ingenieriaDeMenu_` una vez por mes.
  - **Caché:** 3 horas, con clave `huellaDatos_()` + `finCacheClave_()`.
  - **Titular:** el bloque de los últimos 3 meses cerrados. Un mes cuenta como cerrado si su venta por plato llega hasta tres días antes de fin de mes.
  - **Real:** compra por área de `FinanzasDatos` + inventario al cierre del mes anterior − inventario al cierre del último mes. Sin los dos cierres de un área, queda la compra sin ajustar y se marca.
  - **Teórico:** firme + ciego al CMV de su área + fuera al CMV mezclado.
  - **Base:** todo sobre venta sin IVA ni servicio.
  - **Permisos:** quien no es dueño recibe solo porcentajes y brecha en puntos, sin montos. Queda así hasta que Juanma decida si cocina y barra ven quetzales de compra.
  - **Refactor:** `revisarPuenteCmv()` y la tarjeta usan el mismo `_puenteTeoricoMeses_()`.
- **Pantalla** (archivos de Profit OS, solo lo acordado):
  - `CosteoJs_Pintar.html`: `pedirCmvReal()`, llamada desde `aplicarProfitOS` al lado de `pedirAvisos()`, para no repetir el bug A22.
  - `CosteoJs_Inicio.html`: solo el bloque `tReal`.
    - **Valor:** la brecha en puntos. **Sub:** rango ("jun–ago"), real y teórico.
    - **Color:** bajo −2 puntos `--bajo` (dato incompleto, no buena noticia); de −2 a 2, `--meta`; de 2 a 4, `color-mix(--alto 60%, --muted)`; más de 4, `--alto`.
    - **Estados:** "Buscando…" mientras no llega; si falla, o si la brecha, el real, el teórico o los meses no vienen válidos, el "Falta" de antes. Así un null no tira `vistaInicio()` ni deja el tablero en blanco (revisión de la sesión de Profit OS).
  - `Dashboard.js` no se tocó.
- **Verificación:**
  - **Node, con el código real:** servidor 34 OK, con motor de Finanzas sobre el espejo, POS real, inventarios de la fase 1 y el filtro de dueño. Regresión del puente: 83 OK.
  - **Tarjeta:** dibujada en sus 5 estados; las notas salen escapadas.
  - **HEAD:** verificado con bajada aparte.
- **Pregunta abierta a Juanma:** ¿cocina y barra pueden ver los quetzales de venta y compra de la tarjeta?

## Pendiente

1. **Tanda de pantalla (3.4):**
   - semáforo de Finanzas sobre venta sin servicio (decisión 1);
   - el indicador real contra teórico en Profit OS, coordinado con esa sesión.
2. **p88:** detalle de los 18 retiros de cajero de agosto (Q21,800) y registro de mercado.
3. **Fichas y precios (3.8 puntos):** es ingeniería de menú. El tablero ya da el "recuperable contra meta" por plato.
4. **p111:** las fichas sin costo siguen sumando al ciego (Q20,082 de cocina en agosto).
