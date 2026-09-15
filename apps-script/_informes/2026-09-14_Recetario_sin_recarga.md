# Recetario sin recarga · 14 sep 2026

Cocina reportó que al agregar productos a recetas nuevas la pantalla se ponía en blanco y tardaba en volver. Este informe describe cómo era el proceso de carga, por qué tardaba, qué se cambió y cómo se probó.

## Cómo era

Todos los botones que guardaban en Profit OS seguían el mismo camino:

1. El navegador llamaba a la función de escritura (`webAgregarLinea`, `webCrearFicha`, `webCrearInsumo`, `registrarPrecio`, etc.).
2. El servidor escribía en la hoja y terminaba con `invalidarCache_()`, que **borraba el recetario cacheado**.
3. El navegador hacía `location.reload()`.
4. La recarga pedía `getCosteoData`, que con el caché vacío **reconstruía el recetario entero** leyendo todas las pestañas de las dos hojas: unos 40 s medidos el 10-sep.

| Acción | Espera por acción, antes |
|---|---|
| Agregar un ingrediente | ~45 s de pantalla en blanco |
| Cambiar cantidad, quitar línea, precio de carta | ~45 s |
| Crear una ficha | ~45 s, y después buscarla y abrirla |
| Crear un producto | ~45 s |
| Registrar un precio de compra | ~80 s: el servidor reconstruía una vez para contar recetas, sin guardarlo, y la recarga reconstruía otra |
| Abrir la pestaña Higiene | ~40 s cada vez, aunque el recetario estuviera en caché |
| Alta desde Inventarios que llega al Banco | ~45 s |

Cargar una receta nueva de ocho ingredientes con dos productos nuevos eran unas once recargas: **más de ocho minutos de pantalla en blanco**. Además, cada export nuevo del POS borraba el mismo caché aunque el recetario no lee ventas, así que el siguiente en abrir también esperaba 40 s.

## Cómo queda

**En la pantalla**, cada guardado:

- aparece en el acto cuando se puede saber el resultado (agregar ingrediente, cantidad, quitar línea, precio de carta, crear ficha), marcado "guardando…";
- sale a una **fila de guardado**, de a uno. Una píldora abajo dice "Guardando en la hoja…" y "Guardado en la hoja";
- cuando vuelve, la ficha o el producto **releídos de la hoja** reemplazan a los de pantalla. Si falla, se deshace lo de pantalla y se avisa.

La página no se recarga nunca. Se puede cargar un ingrediente detrás de otro sin esperar: Enter en el producto salta a la cantidad, Enter en la cantidad agrega.

**En el servidor**, la escritura ya no borra el caché. Anota qué tocó (una ficha, un producto, un precio), relee **solo eso**, corrige el recetario cacheado y lo devuelve a la pantalla en `cambios`. Si no se puede corregir (caché vacío, candado ocupado, algo raro), borra el caché como antes y la pantalla pide el recetario de fondo, sin tapar nada.

| Acción | Ahora |
|---|---|
| Agregar, cantidad, quitar, precio de carta | inmediato en pantalla; la hoja confirma en unos segundos por detrás |
| Crear ficha | la ficha nueva se abre en el acto, lista para cargarle ingredientes |
| Ingrediente que no está en el Banco | ofrece crearlo sin salir de la receta y lo agrega al terminar |
| Crear producto, proveedor, registrar precio | unos segundos con el botón en "Guardando…", sin recargar |
| Higiene | sale del caché |
| Alta desde Inventarios | aplica lo releído; solo una tanda de precios pide el recetario de fondo |

## Por qué la fila de guardado es obligatoria

Con recarga no se podía hacer una segunda acción antes de que terminara la primera. Sin recarga sí, y aparecen dos carreras que corrompían datos en silencio:

- **Dos ingredientes a la vez eligen la misma fila libre.** `agregarLinea` busca la primera fila vacía de la ficha; dos llamadas simultáneas eligen la misma y la segunda pisa a la primera sin error. La fila de guardado las manda de a una.
- **Una inserción corre los números de fila.** Si la ficha no tiene filas libres, `agregarLinea` inserta una y todo lo de abajo baja uno. Un "cambiar la cantidad de la fila 12" pedido antes cambiaría el ingrediente de al lado. Por eso la pantalla no ofrece editar cantidades de una ficha mientras tiene algo guardándose, y el servidor verifica además que la fila siga siendo el ingrediente que la persona vio (`exigirMismaLinea_`).

## Errores encontrados en el camino y corregidos

- **Un producto con nombre parecido nunca se creaba ni se preguntaba.** La pregunta de duplicado viaja dentro de `resultado`, y la pantalla miraba el `ok` de afuera, que siempre es verdadero: recargaba y el producto no existía. Lo mismo con el contenido faltante de un envase y con los proveedores parecidos.
- **Registrar un precio escribía el proveedor "normalizado" en el Banco.** Mandaba el nombre que arma la pantalla ("Sin proveedor" o el alias oficial) y lo escribía encima de lo que había cargado cocina. Ya no lo manda.
- **Registrar un precio escribía en cocina aunque el producto fuera de barra, y el rol de sala podía hacerlo** (hallazgo C5 de la auditoría del mismo día). Ahora viaja el área y el servidor exige que el rol escriba en ella.
- **Las 30 fórmulas de una ficha nueva eran 30 llamadas al servicio.** Ahora es una.

## Archivos

| Archivo | Qué cambió |
|---|---|
| `CosteoDatos.js` | `enlazarModelo_` separado de `construirModelo_`; caché con marca de generación; `conCambiosDeModelo_`, `aplicarToques_`, `parchearCacheCosteo_`, `escalarRecetasPorInsumo_` |
| `EdicionRecetario.js` | `invalidarCache_(toque)`; `exigirMismaLinea_` en cantidad y quitar |
| `EdicionWeb.js` | `edicionCorrer_` devuelve `cambios`; cantidad y quitar reciben el producto esperado |
| `CrearFicha.js` | toque de ficha; fórmulas en una escritura |
| `Proveedores.js` | `registrarPrecio` con área y sin reconstruir; `reporteHigiene` desde el caché |
| `VentasPorProducto.js` | ya no borra el caché del recetario |
| `CosteoVista.html` | `adaptar` partido en `adaptarInsumo` y `adaptarReceta` |
| `CosteoJs_Base.html` | copia en pantalla: `enlazarModelo`, pendientes, `aplicarCambios`, `recargarModelo` |
| `CosteoJs_Pintar.html` | fila de guardado, píldora, redibujo del cajón sin perder lo que se escribe |
| `CosteoJs_Paneles.html` | líneas "guardando…", edición bloqueada mientras guarda, alta de producto desde la ficha |
| `CosteoJs_Acciones.html` | todos los botones sin `location.reload()` |
| `CosteoJs_Inventario.html` | `invDespues` aplica `cambios` en vez de recargar |
| `CosteoJs_Insumos.html`, `CosteoEstilos.html` | lista de proveedores nuevos; estilos de la píldora y las líneas pendientes |

La copia de `enlazarModelo_` en la pantalla (`enlazarModelo`) tiene que seguir igual a la del servidor. Si cambia una regla de enlace, cambia en los dos.

## Cómo se probó

Sin acceso a la batería en el navegador, se armó un simulador de hojas en Node que evalúa las fórmulas reales de las fichas (VLOOKUP al Banco, multiplicación, SUM, merma, CMV) y ejecuta el código real del servidor y de la pantalla. 48 comprobaciones, corridas cinco veces seguidas:

- `construirModelo_` después del cambio da el mismo modelo **byte a byte** que antes.
- Después de agregar, cambiar cantidad, quitar, crear ficha, crear producto, asignar proveedor y registrar precio, **el caché corregido es igual a reconstruir todo**.
- Después de `aplicarCambios`, **la pantalla es igual a recargar la página**.
- Un ingrediente en fila sigue visible cuando llega la confirmación de otro guardado.
- Cantidad con la fila corrida: no escribe y lo dice.
- Caché vacío, candado ocupado, fallo a mitad de escritura y reconstrucción cruzada con un guardado: el caché nunca queda a medias.
- La página armada con todos sus parciales compila, todas las llamadas nuevas pasan `AUTH` primero y la prueba de corchetes del proyecto no encuentra nada.

No se probó: el tiempo real de ida y vuelta en Apps Script, el comportamiento en el Chrome de cocina y la batería de `?page=pruebas`. Eso queda para la prueba en `/dev` antes de publicar.

## Lo que sigue lento y no se tocó

- **Cada llamada al servidor lee la hoja USUARIOS entera** para identificar a quien llama: medio segundo por guardado. Se nota menos porque la pantalla ya no espera, pero alarga la fila.
- **La primera apertura del día** sigue dependiendo de `calentarCaches` cada 5 minutos. Si el activador se apaga, el primero en abrir paga 40 s.
- **Una tanda de precios del cierre de inventario** sigue borrando el caché (`aplicarSincronizacion`); la pantalla lo pide de fondo.
