# Inventarios en Profit OS — Fase 1: hojas de Rosanta y migración (12 sep 2026)

**Hecho y verificado.** Existen las dos hojas de inventario de Rosanta con el histórico completo, y
cada mes cuadra al centavo contra el total que calcularon Jeffry y José. **Todavía no hay pantalla
en la intranet:** eso es la fase 2.

## Las dos hojas

| | ID | Pestañas |
|---|---|---|
| `Rosanta_Inventario_Cocina` | `1m9wAMdBbenaujlISI-l64CIfy7eib61xVqy3z7SpOuE` | LEEME · PRODUCTOS (216) · 2026-05 · 2026-07 |
| `Rosanta_Inventario_Barra` | `1V8fl-6vjFRnq42gDOH8trNluT-2NJ32I7LguEa-yImI` | LEEME · PRODUCTOS (93) · 2026-01 a 2026-08 |

Las dos son de `restaurante@rosanta.rest` y están en `Inventarios 2026`. Sus IDs quedaron en las
propiedades de script `INV_COCINA_SHEET_ID` e `INV_BARRA_SHEET_ID`. Las `INVENTARIO_*` que ya existían
no se tocaron.

**Formato de cada mes:** ID · CATEGORIA · PRODUCTO · TIPO · PRESENTACION · PROVEEDOR · PRECIO · EXISTENCIA ·
MONTO · CONTEO ORIGINAL · BLOQUE, más una fila TOTAL. **PRODUCTOS** agrega VINCULO, PRODUCTO EN BANCO,
PARECIDO, ACTIVO y ULTIMO MES.

## Decisiones de Juanma (12 sep)

- Una hoja por área, de Rosanta, con una pestaña por mes. Se terminan los `.xlsx`, las copias y la hoja
  en el Gmail de José.
- Precios hacia el Banco: automático si cambian menos de 10%; con aprobación si cambian 10% o más.
- Quitar un producto que se usa en recetas: queda inactivo y se avisa.
- Se cargan precios y existencias. Solo el cierre mensual: el control diario de cerveza y el
  inventario semanal siguen en la hoja de José.
- **Tres tipos:** INSUMO (su precio alimenta el Banco) · PREPARADO (lo cuenta el inventario, pero el
  precio lo da la receta) · REVENTA / LIMPIEZA (solo valorizan).
- Lo que no se vincula solo se resuelve desde la intranet, y lo resuelve quien conoce el producto.
- El cierre del 2 de febrero es el de enero (la pestaña de José se llama "Cierre Enero 2026").

## Cuadre (corrida real, idéntica a la corrida en seco)

| Área | Mes | Filas | Total |
|---|---|---:|---:|
| Cocina | 2026-05 | 216 | Q8,536.75 |
| Cocina | 2026-07 | 215 | Q7,684.21 |
| Barra | 2026-01 | 80 | Q14,600.86 |
| Barra | 2026-02 | 83 | Q14,605.55 |
| Barra | 2026-03 | 83 | Q15,043.04 |
| Barra | 2026-04 | 87 | Q15,360.17 |
| Barra | 2026-05 | 89 | Q16,175.76 |
| Barra | 2026-06 | 88 | Q15,210.33 |
| Barra | 2026-07 | 89 | Q13,724.14 |
| Barra | 2026-08 | 87 | Q16,076.86 |

Los 40 bloques (7 categorías + total por mes en cocina; destilados, vinos y cerveza por mes en barra)
cuadran con **diferencia 0**. Chequeo independiente: el informe contable de junio (`Rosanta_Inventarios_
Cierre_Junio_2026.xlsx`) da Q15,210.35 para barra en junio, contra Q15,210.33 migrado.

**La existencia sale del monto** (existencia = monto ÷ precio), no del conteo. En cocina el monto a
veces es conteo × precio y a veces libras × precio; en barra la botella va en %. El conteo original se
guarda al lado, sin tocar.

## Vínculos con el Banco de Datos

| | Exacto | Tipeo | Otra área | Pendiente |
|---|---:|---:|---:|---:|
| Cocina (216) | 153 | 7 | 4 | 52 |
| Barra (93) | 48 | 3 | 0 | 42 |

Solo se vincula lo seguro: nombre exacto, alias, la otra área o un tipeo con parecido ≥ 0.85. El umbral
del importador era 0.82, y con ese valor "Aceite de albahaca" terminaba vinculado a Albahaca. Tipeos que
se vincularon: Rib Eyed → Rib Eye, Aciete → Aceite de Oliva, Anis Extrella, Bock Choy, Lemon glass,
Remolachas, Zanahora baby, Quezalteca, Cinzano Viancob, LAN Reseva.

**Tipos.** Cocina: 132 insumos · 56 preparados · 17 de limpieza · 11 por clasificar. Barra: 55 insumos ·
21 de reventa · 17 por clasificar.

## Cómo se verificó

1. **Prueba local antes del push.** Se cargó el script real en node, con los helpers reales del repo y
   datos reales (barra desde el texto de la hoja, mayo desde el `.xlsx`, los dos Bancos). Resultado:
   8/8 meses de barra y mayo de cocina cuadrados.
2. **`migrarInventariosEnSeco()` en el editor.** "EN SECO TODO CUADRA". Informe:
   `_migracion_inventarios/202609121936_informe_en_seco.json`. Julio de cocina, que no se pudo probar en
   local, también cuadró.
3. **`migrarInventarios()` con aprobación de Juanma.** Se confirmó en pantalla qué función estaba
   seleccionada antes de ejecutar. Informe: `202609121939_informe_real.json`.
4. **Contenido de las hojas.** Las 10 pestañas de mes coinciden en filas y en la fila TOTAL. El catálogo de
   barra está completo (93). El de cocina se verificó abriendo la hoja: la fila 217 es C-216 y la 218
   está vacía.

**Trampa que aparece en esta verificación:** `read_file_content` del conector de Drive **recorta
en silencio las pestañas grandes**. Leyendo PRODUCTOS de cocina devolvió 190 de 216 productos, sin
aviso, y los que faltaban eran los últimos 26 seguidos. Un número incompleto sacado del conector no
alcanza para decir que faltan filas: hay que confirmarlo en la hoja.

**Otra: el push de Juanma no llegó la primera vez.** El proyecto seguía con 63 archivos. Se detectó
bajándolo a una carpeta aparte, y el segundo push sí subió. Verificar siempre contra lo que está en el
servidor.

## Lo que queda

- **Para preguntarle a José (barra):** Colonial con 480% en abril, Xibal Akbal con 310% en abril y mayo,
  Botran oro con 1000% en agosto. Se migraron tal cual.
- **Junio de cocina no está migrado.** "FIN JUNIO 26" no está en la carpeta de cocina. El informe
  contable de junio sí trae el detalle de cocina (Q6,914.83, producto, existencia, precio y monto, sin
  proveedor ni presentación). Se puede migrar desde ahí si Juanma lo decide.
- **Fase 2:** la pestaña Inventarios en Profit OS. Carga de existencia, precio y proveedor por mes;
  alta de productos con aviso de parecidos; productos inactivos; vincular los pendientes; "Cerrar mes".
  Permisos: chef → Cocina, sala → Barra, dueño → las dos.
- **Fase 3:** precios hacia el Banco al cerrar el mes (menos de 10% automático, 10% o más con aprobación;
  reutiliza el log y el deshacer de SincronizarPrecios). Nunca para PREPARADO, REVENTA ni LIMPIEZA.
- **Fase 4:** inventario inicial y final en el tablero. El CMV real además necesita las compras del
  mes (p88).
- `InventarioMigracion.js` es de un solo uso. Cuando la fase 2 esté andando, se archiva (p143).
- Desde que existan las hojas, la intranet debe leer de `INV_*_SHEET_ID` y no de la hoja de José.
  La hoja de José queda como histórico de consulta.

## Agregados del 12 sep, después de revisar con Juanma

**Existencias raras de barra (% de botella en la hoja de José):**

| Producto | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Colonial (750 ml) | 80 | 120 | 220 | 480 | 300 | 220 | 150 | 85 |
| Xibal Akbal (700 ml) | 0 | 80 | 140 | 310 | 310 | 290 | 265 | 165 |
| Botran oro (1000 ml) | — | — | — | — | 175 | 175 | 100 | **1000** |

Colonial y Xibal Akbal suben y bajan de forma pareja: parecen stock real (varias botellas compradas
juntas). Queda para José si mayo de Xibal se contó o se copió de abril. **Botran oro en agosto era un
error**: la columna de % tenía la medida en ml (1000). **Corregido a 100% (Q75) por decisión de Juanma**:
el total de barra de agosto pasó de Q16,076.86 a **Q15,401.86**. Lo hizo `corregirBotranOroAgosto()`, y
en la celda de conteo quedó escrito qué se corrigió.

**El artefacto `rosanta-inventarios-may-jun-2026`** (del 19 de agosto) trae los montos de mayo, junio y
julio. Contra lo migrado: barra coincide en los tres meses (±Q0.02) y cocina de mayo también. Julio de
cocina da Q5 menos, y la diferencia es solo la pimienta negra (el archivo de Jeffry tiene Q80 en
Verduras; el artefacto la parte en Q30 en Abarrotes y Q45 en Verduras). **Juanma decidió dejar lo del
archivo de Jeffry**, que además es más nuevo (27 de agosto).

**Junio de cocina, agregado.** Salió del informe contable de junio (hoja nativa
`Rosanta_Inventarios_Cierre_Junio_2026`, `1fPpls09CpKaJAwmVVxv5dwwy3rHMibqAKkNzmCKlEiw`), con
`migrarJunioCocina()`: 216 filas, 0 productos nuevos (todos existían en el catálogo), las 7 categorías y
el total (Q6,914.83) cuadran con diferencia 0. Coincide con el artefacto. La pestaña 2026-06 quedó entre
2026-05 y 2026-07. Proveedor y presentación se tomaron del catálogo.

**Estado final de las hojas, verificado leyéndolas:**
- Cocina: 2026-05 Q8,536.75 · **2026-06 Q6,914.83** · 2026-07 Q7,684.21.
- Barra: enero a julio sin cambios · **2026-08 Q15,401.86**.

**Trampa nueva: Sheets convierte "1000%" en el número 10.** La migración escribió el conteo de barra
como texto "70%", pero Sheets lo guarda como número con formato de porcentaje. Se ve 70%, pero
`getValues()` devuelve 0.7. La primera corrida de la corrección de Botran se negó por esto: esperaba
el texto "1000" y encontró 10, así que no escribió nada, que era lo correcto. Se ajustó el resguardo y
se corrió de nuevo. **La fase 2 tiene que leer el conteo de barra como fracción.**

**Productos sin conectar, lo que realmente importa:** de los 94 pendientes, solo 32 afectan precios (11
de cocina y 21 de barra). Los otros 62 son preparados, limpieza o reventa, que no llevan precio al
Banco. Varios de los 21 de barra probablemente también son reventa (Macallan y Red Label se venden por
trago).

**Estimación de la fase 2:** dos o tres sesiones como la de hoy, en tres entregas (ver sin editar ·
cargar existencias y precios, altas, inactivos y vínculos · cerrar mes y probar con Jeffry y José).
La fase 3 (precios hacia el Banco) es otra sesión.
