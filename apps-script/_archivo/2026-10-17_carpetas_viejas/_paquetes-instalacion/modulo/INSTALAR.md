# Recetario Visual + Proveedores · instalación en la intranet

Revisión del 21 de agosto de 2026. Cinco archivos. No se toca ninguna ficha ni el Banco
de Datos a mano: las hojas nativas siguen siendo la fuente de verdad y el equipo puede
seguir editándolas igual.

| Archivo | Qué hace |
|---|---|
| `ConfigCosteo.gs` | IDs, metas de CMV por área, exclusiones, alias de sub-recetas |
| `CosteoDatos.gs` | Lee Banco de Datos + fichas y arma el modelo (cacheado 15 min) |
| `Proveedores.gs` | Hoja de proveedores, registro de precios con fecha y factura, índice insumo→receta |
| `CosteoVista.html` | La interfaz: recetas, productos, proveedores, higiene y la guía del equipo |
| `CodeGs_agregar.txt` | Lo que hay que añadir a `Code.gs` e `Index.html` |

---

## 0 · Antes de nada: convertir los recetarios a hojas nativas

**Esto es bloqueante.** `SpreadsheetApp.openById` solo abre hojas nativas de Google. Los
recetarios hoy son archivos `.xlsx` guardados en Drive y el módulo no los puede leer.

1. Decidir cuál es el archivo oficial. Hoy hay varias copias con nombres parecidos.

   > **Desactualizado (10-sep-2026).** Este paso decía que el vigente era
   > `Rosanta_Recetario_Cocina_2027_v9.xlsx`. Ya no: el recetario de cocina vivo es la hoja
   > **nativa** `Rosanta_Recetario_Cocina_2027_v16`, y el de barra también es nativo. La
   > conversión de este paso 0 ya se hizo, así que si estás instalando hoy, saltátelo y
   > copiá los dos IDs de Propiedades del script del proyecto Rosanta Intranet. Escribir
   > una versión concreta en un instalador es lo que hizo envejecer este documento: no la
   > vuelvas a escribir.
2. Abrirlo en Google Sheets → **Archivo › Guardar como hoja de cálculo de Google**.
3. Copiar el ID nuevo de la URL.
4. **Borrar las copias viejas.** Tener tres archivos con el mismo nombre ya provocó una
   vez que se trabajara sobre versiones distintas.
5. Verificar que los `VLOOKUP` de las fichas sobrevivieron a la conversión: abrir dos o
   tres fichas y confirmar que la columna PRECIO UNIT. sigue calculando. De eso depende
   todo el mecanismo de `registrarPrecio`.

Mismo procedimiento para el recetario de barra.

```
clasp push
```

---

## 1 · Propiedades del script

Proyecto › Configuración del proyecto › Propiedades de la secuencia de comandos:

| Propiedad | Valor |
|---|---|
| `RECETARIO_COCINA_SHEET_ID` | el ID de la **v9** convertida en el paso 0 |
| `RECETARIO_BARRA_SHEET_ID` | el ID del recetario de barra convertido |
| `COSTEO_SHEET_ID` | lo crea el paso 2, no ponerlo a mano |

> **No reutilizar el ID viejo.** La versión anterior de este instalador apuntaba a
> `Rosanta_Recetario_Cocina_2027_v2`. Entre la v2 y la v9 pasaron cuatro rondas con cocina:
> el gratín sin crema, el pan a 300 g, brisket y costillas costeados con la sub-receta,
> los cuatro quesos de la Tabla, la Salsa de Chile Cobanero y las porciones de puré.
> Con la v2 el módulo mostraría números viejos con cara de definitivos.

---

## 2 · Correr una vez desde el editor

```
crearHojaCosteo()
```

Crea `Rosanta_Costeo_Proveedores` con tres pestañas:

- **PROVEEDORES** — sembrada con los nombres que hoy aparecen en el Banco de Datos.
  Completar contacto y teléfono a mano. La columna `ALIAS_EN_BANCO` unifica los que están
  escritos de dos formas: poné el nombre oficial en la primera columna y los alias
  separados por `·` en la segunda. El módulo la lee y deja de depender de la lista
  quemada en el código.
- **PRECIOS** — el histórico. Una fila por precio que entra: fecha, producto, proveedor,
  precio, unidad, factura y quién lo cargó. Esto es el pendiente #24 del recetario.
- **INDICE_INSUMO_RECETA** — qué receta usa qué producto, con su área. Regenerable con
  `regenerarIndice()`.

---

## 3 · Verificar antes de abrir la vista al equipo

```
probarCosteo()
```

El lector recorre las filas buscando etiquetas, y **las fichas no tienen todas la misma
estructura**: en unas el encabezado INGREDIENTE está en la fila 4 y en otras en la 5. Por
eso hay que comparar contra números conocidos antes de confiar en el módulo.

Con el recetario v9 y el de barra v5, el Log tiene que decir:

```
COCINA -> 31 platos | 40 pre-elaborados | 24 con CMV
BARRA  -> 27 platos | 29 pre-elaborados
CONTROL mix de fritas: leido 67.9 esperado 67.9 -> OK
CONTROL tabla de jamones y quesos: leido 23.0 esperado 23.0 -> OK
CONTROL gratin de papas: leido 19.8 esperado 19.8 -> OK
fichas sin ingredientes y sin precio: 0
```

Si aparecen fichas basura, es que una hoja de control se está leyendo como receta:
agregar su nombre a `COSTEO.tabsNoReceta` en `ConfigCosteo.gs`.

Las 7 fichas de plato vacías que sí deben aparecer son los platos nuevos de la carta 2027
que cocina todavía no dictó: Coliflor con Romesco, Brócoli con Nduja, Bok Choy,
Vegetales Fermentados, Arroz Meloso, Lomito de la Casa y Estofado de Rabo.

Después:

```
reporteHigiene()
```

o la pestaña **Higiene** de la vista, que muestra lo mismo sin entrar al editor.

---

## 4 · Cómo se actualiza un precio

Vista → **Productos** → tocar el producto → escribir el precio de compra nuevo →
**Registrar precio**.

Qué pasa por dentro:

1. Se guarda la fila en `PRECIOS` con fecha, factura y usuario.
2. Se actualiza el Banco de Datos **conservando el factor de conversión original**
   (`precio por unidad de receta ÷ precio de compra`), así que no hay que reinterpretar
   el texto de la columna CONVERSIÓN, que está escrito de quince formas distintas.
3. Los VLOOKUP de las fichas recalculan solos. No se toca ninguna pestaña de receta.
4. Se limpia el caché y la vista muestra el CMV nuevo de cada receta afectada.

El botón **Simular** hace lo mismo sin guardar nada: sirve para ver el impacto de una
subida antes de aceptarla. La barra lila de arriba muestra cuántos platos se salen de meta.

> Un producto sin `PRECIO_COMPRA` en el Banco no se puede registrar: no hay con qué
> calcular el factor. La pestaña Higiene los lista. Hay que corregirlos a mano una vez.

---

## 5 · Qué cambió respecto de la primera versión

| | Antes | Ahora |
|---|---|---|
| Meta de CMV | 30% para todo, también para los cócteles | 30% en cocina, 20% en barra, por receta |
| Cocina y barra | mezcladas en la misma grilla | filtro de área en la barra superior |
| Hojas de control | 5 se leían como recetas, más 5 fichas archivadas | excluidas por nombre y por prefijo `ZZ ARCHIVO` |
| Pre-elaborados de barra | sin costo unitario (buscaba "costo por porción") | lee cualquier "COSTO POR …": porción, ml o gramo |
| Ingrediente → sub-receta | había que pasar por el panel del producto | botón "ver receta ›" en la línea |
| Historial de precios | se guardaba pero no se mostraba | visible en el panel del producto |
| Higiene | solo desde el editor | pestaña en la vista |
| Alias de proveedor | lista quemada en el código | se lee de la hoja PROVEEDORES |

---

## 6 · La guía del equipo vive adentro

La pestaña **Cómo funciona** de la vista explica en lenguaje llano de dónde salen los números,
cómo leer una ficha, qué significan los colores, la diferencia entre Simular y Registrar, y qué
hacer cuando algo no cuadra. Está dentro de la intranet a propósito: detrás del mismo login y en
el mismo lugar donde el equipo ya trabaja, en vez de un documento suelto que se pierde.

Si cambia algo del proceso, se edita `vistaGuia()` en `CosteoVista.html` y se hace push. No hay
que avisarle a nadie ni volver a repartir un archivo.

## 7 · Lo que queda para una v2

- Fotos de plato: falta `RECETARIO_FOTOS_FOLDER_ID` y una columna FOTO en el índice.
- Cargar una lista de precios completa pegando el PDF o Excel del proveedor.
- Que el equipo edite ingredientes desde la vista (hoy solo lectura + precios).
- Cruzar el CMV con las ventas del POS para priorizar qué precio mover primero.
