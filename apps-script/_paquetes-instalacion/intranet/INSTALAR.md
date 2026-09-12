# Recetario Visual + Proveedores · instalación en la intranet

Cinco archivos nuevos. No se toca ninguna ficha ni el Banco de Datos a mano: las hojas
nativas siguen siendo la fuente de verdad y el equipo puede seguir editándolas igual.

## 1 · Copiar los archivos

Al proyecto `~/Documents/Claude/Projects/Claude/rosanta-intranet/`:

| Archivo | Qué hace |
|---|---|
| `ConfigCosteo.gs` | IDs, metas de CMV por área, nombres de hojas, helpers |
| `CosteoDatos.gs` | Lee Banco de Datos + fichas y arma el modelo normalizado (cacheado 15 min) |
| `Proveedores.gs` | Hoja de proveedores, registro de precios con fecha y factura, índice insumo→receta |
| `CosteoVista.html` | La interfaz (recetas, productos, proveedores) |
| `CodeGs_agregar.txt` | Las tres líneas que hay que añadir a `Code.gs` e `Index.html` |

```
clasp push
```

## 2 · Propiedades del script

Proyecto › Configuración del proyecto › Propiedades de la secuencia de comandos:

| Propiedad | De dónde sale el valor |
|---|---|
| `RECETARIO_COCINA_SHEET_ID` | copiarlo del proyecto vivo (ver abajo). Hoy es la hoja nativa `Rosanta_Recetario_Cocina_2027_v16` |
| `RECETARIO_BARRA_SHEET_ID` | copiarlo del proyecto vivo. Es la hoja **nativa** de barra, no el `.xlsx` |
| `COSTEO_SHEET_ID` | lo crea el paso 3, no ponerlo a mano |

**No copiar IDs de este archivo. Copiarlos del proyecto que está corriendo.**

Abrir el proyecto **Rosanta Intranet** en el editor de Apps Script → Configuración del
proyecto → Propiedades de la secuencia de comandos, y copiar de ahí los dos valores. Ese
es el único lugar donde los IDs están garantizadamente vivos.

> **Por qué esta regla, con el caso del 10-sep-2026.** Este instalador traía los IDs
> escritos a mano y los dos habían quedado obsoletos sin que nadie lo notara:
> `RECETARIO_COCINA_SHEET_ID` apuntaba a la `v2` cuando el recetario vivo ya iba en la
> `v16` (catorce versiones y varias rondas de costeo de por medio), y el ID de barra
> directamente **ya no existe**: no responde por ninguna vía desde restaurante@rosanta.rest.
> Quien reinstalara desde aquí habría arrancado leyendo números viejos con cara de
> definitivos, o una hoja inexistente. Un ID escrito en un instalador envejece solo; el
> proyecto vivo no.

> **Ojo con el recetario de barra:** existe además un `Rosanta_Recetario_Barra_v5_corregido.xlsx`
> del 12 de julio de 2026 que ya divergió de la hoja nativa (contaba un producto duplicado
> que en la viva no existe). `SpreadsheetApp` no abre archivos `.xlsx`, así que la propiedad
> tiene que apuntar sí o sí a la hoja nativa. Si alguien encuentra el `.xlsx` primero, va a
> costear con datos de julio.

## 3 · Correr una vez desde el editor

```
crearHojaCosteo()
```

Crea `Rosanta_Costeo_Proveedores` con tres pestañas:

- **PROVEEDORES** — sembrada con los 28 nombres que hoy aparecen en el Banco de Datos.
  Completar contacto y teléfono a mano; la columna `ALIAS_EN_BANCO` sirve para unificar
  los que están escritos de dos formas (Tavito / Don Tavito).
- **PRECIOS** — el histórico. Una fila por precio que entra: fecha, producto, proveedor,
  precio, unidad, factura y quién lo cargó. Esto es el pendiente #24 del recetario.
- **INDICE_INSUMO_RECETA** — qué receta usa qué producto. Regenerable con `regenerarIndice()`.

Después, para verificar que las fichas se leen bien:

```
probarCosteo()     // deja en el Log cuántas recetas e insumos encontró
reporteHigiene()   // líneas fuera del banco, fichas vacías, platos sobre meta
```

## 4 · Cómo se actualiza un precio

En la vista → **Productos** → tocar el producto → escribir el precio de compra nuevo →
**Registrar precio**.

Qué pasa por dentro:

1. Se guarda la fila en `PRECIOS` con fecha, factura y usuario.
2. Se actualiza el Banco de Datos **conservando el factor de conversión original**
   (`precio por unidad de receta ÷ precio de compra`), así que no hay que reinterpretar
   el texto de la columna CONVERSIÓN.
3. Los VLOOKUP de las fichas recalculan solos. No se toca ninguna pestaña de receta.
4. Se limpia el caché y la vista muestra el CMV nuevo de cada receta afectada.

El botón **Simular** hace lo mismo pero sin guardar nada: sirve para ver el impacto de
una subida antes de aceptarla.

## 5 · Lo que queda para una v2

- Fotos de plato: la ficha ya tiene el lugar; falta `RECETARIO_FOTOS_FOLDER_ID` y una
  columna FOTO en el índice de cada área.
- Cargar una lista de precios completa pegando el PDF/Excel del proveedor.
- Que el equipo edite ingredientes desde la vista (hoy solo lectura + precios).
