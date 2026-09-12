/**
 * PROBAR_EDICION.gs — La prueba de humo de la capa de escritura, en un solo boton.
 *
 * POR QUE EXISTE, con un ejemplo de hoy: al darle Run sobre EdicionRecetario.gs, el
 * desplegable agarro editarCantidad —que ESCRIBE— y la corrio sin argumentos. La
 * freno el candado de permisos ("el rol undefined no puede editarCantidad"), asi
 * que no paso nada. Pero el desplegable eligio solo, y eligio una funcion de
 * escritura. Con un archivo de una funcion eso no puede pasar.
 *
 * NO ESCRIBE NADA. Solo lee y compara:
 *   - conversiones de unidad: que la libra de 453.592 y que el manojo BLOQUEE
 *   - deteccion de duplicados contra el Banco
 *   - quien puede hacer que, por rol
 *
 * QUE HAY QUE VER EN EL LOG:
 *   Libra -> g            factor 453.592
 *   Onza -> g             factor 28.3495
 *   Litro -> ml           factor 1000
 *   Manojo -> g (null)    BLOQUEA        <- esto es lo importante
 *   Manojo -> g (50)      factor 50
 *   Libra -> ml           BLOQUEA        <- peso contra volumen, no se convierte
 *
 * El manojo tiene que bloquear. En el Banco un manojo va de 20 g (romero) a 75 g
 * (albahaca): no hay tabla posible y el formulario debe obligar a capturar el
 * contenido. Si algun dia deja de bloquear, alguien metio una tabla que no existe.
 *
 * Y en permisos, cocina solo puede editarCantidad. Nada mas.
 */
function PROBAR_EDICION() {
  probarEdicion();
}
