/**
 * EdicionWeb.gs — La puerta entre el navegador y la capa de escritura.
 *
 * POR QUE EXISTE, y es lo unico importante de este archivo:
 *
 *   Las funciones de EdicionRecetario.gs reciben el rol COMO PARAMETRO:
 *       editarCantidad(ficha, fila, cantidad, quien, rol)
 *
 *   Eso esta bien mientras las llame un humano desde el editor. Pero google.script.run
 *   expone al navegador cualquier funcion global, y los parametros los pone el cliente.
 *   Si la pagina llamara directo a editarCantidad, cualquiera con la consola abierta
 *   podria mandar rol:'dueno' y el candado de permisos no serviria de nada: estaria
 *   preguntandole al que toca la puerta quien es.
 *
 *   Por eso NINGUNA funcion de este archivo acepta "quien" ni "rol". Los resuelve el
 *   servidor con resolverUsuario_(), y recien entonces llama a la de abajo.
 *
 * REGLA: la pagina llama SOLO a las funciones web*. Nunca a las de EdicionRecetario.gs.
 *
 * El parametro `auth` es el token del enlace personal, no una credencial: sirve para
 * identificar a quien entra con Gmail. Sin el, se usa el correo de la sesion. Un token
 * invalido no da acceso, da null y la llamada muere.
 *
 * Todas devuelven la misma forma:
 *     { ok: true,  ...datos }
 *     { ok: false, error: 'texto para mostrarle a la persona' }
 * Asi la pagina nunca tiene que interpretar una excepcion.
 */

/** Identidad resuelta del lado del servidor. Tira si no hay nadie. */
function edicionQuien_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volve a entrar con tu enlace.');
  if (!usuarioTieneModulo(u, 'recetario')) throw new Error('Tu cuenta no tiene el recetario.');
  return u;
}

/**
 * Envuelve una operacion: resuelve identidad, corre, y nunca deja escapar una excepcion.
 *
 * `accion` (opcional, solo en las que escriben): si la operacion falla, el intento
 * queda en la BITACORA como "ERROR · accion" con el mensaje que vio la persona.
 * Hasta el 14-sep-2026 un intento fallido no dejaba rastro: Jeffry paso dias sin
 * poder cargar el Bok Choy y la bitacora solo mostraba lo que SI habia funcionado.
 */
function edicionCorrer_(auth, fn, accion) {
  var u = null;
  try {
    u = edicionQuien_(auth);
    var r = fn(u);
    return { ok: true, resultado: r === undefined ? null : r };
  } catch (e) {
    var msg = String(e && e.message || e);
    if (accion) {
      // el rastro nunca puede tapar el error original
      try { bitacora_(u ? u.email : '', u ? u.rol : '', 'ERROR · ' + accion, '', '', '', '', '', msg); } catch (e2) {}
    }
    return { ok: false, error: msg };
  }
}

/**
 * EL AREA — resuelta y validada aca, igual que la identidad.
 *
 * Historia, porque explica la forma: hasta el 27-ago-2026 las 11 escrituras de
 * EdicionRecetario.gs y CrearFicha.gs abrian RECETARIO_COCINA_SHEET_ID a mano. La
 * vista mostraba las dos areas, y hay ocho productos que se llaman IGUAL en cocina y
 * en barra —ajo, apio, limon, sal fina, azucar blanca, fresas y las dos cebollas—.
 * Editar el ajo de BARRA encontraba el de COCINA y le escribia encima. Sin error.
 * Primero se tapo rechazando todo lo que no fuera cocina; ahora las funciones saben
 * de areas y el area viaja hasta la hoja.
 *
 * POR QUE EL AREA PUEDE VENIR DEL CLIENTE, Y EL ROL NO:
 *   el rol dice QUE podes hacer — si lo mandara el navegador, cualquiera se declara
 *   dueno y el candado de permisos no sirve de nada.
 *   el area dice SOBRE QUE — y por eso viene del cliente pero NO se le cree: se
 *   valida contra COSTEO.areas y despues contra las areas del rol.
 *
 * QUE CAMBIO EL 30-ago-2026: hasta esa fecha esta funcion devolvia el area que
 * pidiera el navegador, sin mirar quien preguntaba. Con Jeffry (cocina) y Jose
 * (barra) usando la pantalla, eso significaba que cualquiera de los dos podia
 * cambiar la pestana de area y escribir en la del otro. Ahora exigirArea_ lo corta,
 * y lo corta ACA: es el unico lugar por donde pasan las nueve escrituras, asi que
 * no hay forma de agregar una decima y olvidarse del candado.
 *
 * El defecto ya no es COCINA fija: es la primera area del rol. Para "sala", asumir
 * cocina era asumir justo el area prohibida.
 */
function areaDeLaPagina_(area, u) {
  if (area == null || String(area).trim() === '') {
    var d = areaPorDefecto_(u.rol);
    if (!d) throw new Error('Tu rol "' + u.rol + '" no tiene ningun area donde escribir.');
    return d;
  }
  return exigirArea_(u.rol, area);
}

/**
 * Para las ayudas del formulario, que solo LEEN. Valida el area pero no exige el
 * permiso: buscar un producto parecido en el Banco de cocina no le hace nada a
 * cocina, y negarlo solo dejaria a la persona sin el aviso de duplicado.
 */
function areaLectura_(area, u) {
  if (area == null || String(area).trim() === '') return areaPorDefecto_(u.rol) || 'COCINA';
  return areaValida_(area);
}

/* ==========================================================================
   QUE PUEDE HACER QUIEN ENTRA — para pintar los botones
   ========================================================================== */

/**
 * La pagina pide esto al cargar y esconde lo que la persona no puede hacer.
 * OJO: esto es para la INTERFAZ, no es el candado. El candado real vuelve a
 * verificarse en cada operacion, del lado del servidor. Esconder un boton no
 * protege nada; solo evita que alguien intente algo que le van a negar.
 */
function webEstadoEdicion(auth) {
  return edicionCorrer_(auth, function (u) {
    var acciones = ['editarCantidad', 'agregarLinea', 'quitarLinea', 'cambiarPrecio',
                    'cambiarPrecioMenu', 'crearFicha', 'crearInsumo', 'crearProveedor'];
    var puede = {};
    acciones.forEach(function (a) { puede[a] = puede_(u.rol, a); });
    // areas: sin esto la pantalla le ofrece a Jose los botones de cocina y el
    // servidor se los rechaza uno por uno. Ofrecer algo que se va a negar no es
    // seguridad, es una trampa.
    return { email: u.email, nombre: u.nombre, rol: u.rol, puede: puede,
             areas: areasDe_(u.rol) };
  });
}

/* ==========================================================================
   1. EDITAR RECETAS
   ========================================================================== */

function webEditarCantidad(auth, ficha, fila, cantidadNueva, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return editarCantidad(ficha, fila, cantidadNueva, u.email, u.rol, a);
  }, 'editarCantidad ' + ficha);
}

function webAgregarLinea(auth, ficha, producto, cantidad, unidad, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return agregarLinea(ficha, producto, cantidad, unidad, u.email, u.rol, a);
  }, 'agregarLinea ' + ficha + ' · ' + producto);
}

function webQuitarLinea(auth, ficha, fila, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return quitarLinea(ficha, fila, u.email, u.rol, a);
  }, 'quitarLinea ' + ficha);
}

function webCambiarPrecioMenu(auth, ficha, precioNuevo, motivo, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return cambiarPrecioMenu(ficha, precioNuevo, u.email, u.rol, motivo, a);
  }, 'cambiarPrecioMenu ' + ficha);
}

/**
 * Crear una receta desde cero. Es la escritura mas grande que se puede pedir desde
 * el navegador: crea una pestaña entera. La logica vive en CrearFicha.gs.
 */
function webCrearFicha(auth, datos, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return crearFicha(datos, u.email, u.rol, a);
  }, 'crearFicha ' + (datos && datos.nombre || ''));
}

/* ==========================================================================
   2. PRODUCTOS Y PROVEEDORES
   ========================================================================== */

function webCrearInsumo(auth, datos, confirmar, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return crearInsumo(datos, u.email, u.rol, confirmar, a);
  }, 'crearInsumo ' + (datos && datos.producto || ''));
}

function webCambiarPrecioInsumo(auth, producto, precioNuevo, motivo, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return cambiarPrecioInsumo(producto, precioNuevo, u.email, u.rol, motivo, a);
  }, 'cambiarPrecio ' + producto);
}

function webCrearProveedor(auth, datos, confirmar) {
  return edicionCorrer_(auth, function (u) {
    return crearProveedor(datos, u.email, u.rol, confirmar);
  }, 'crearProveedor ' + (datos && datos.nombre || ''));
}

function webAsignarProveedor(auth, producto, proveedor, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return asignarProveedor(producto, proveedor, u.email, u.rol, a);
  }, 'asignarProveedor ' + producto);
}

/* ==========================================================================
   3. AYUDAS DEL FORMULARIO — solo leen
   ========================================================================== */

/** Antes de crear un insumo: que se le parece en el Banco. Evita duplicados. */
function webBuscarSimilares(auth, nombre, area) {
  return edicionCorrer_(auth, function (u) { return buscarSimilares_(nombre, areaLectura_(area, u)); });
}

/**
 * Para el campo "contenido" cuando la unidad de compra es un envase.
 * Un manojo va de 20 g a 75 g segun la hierba: no hay tabla, hay que preguntar.
 */
function webContenidosTipicos(auth, unidadCompra, unidadReceta, area) {
  return edicionCorrer_(auth, function (u) {
    return contenidosTipicos_(unidadCompra, unidadReceta, areaLectura_(area, u));
  });
}

/** Prueba la conversion sin escribir, para avisar en el formulario antes de guardar. */
function webProbarConversion(auth, unidadCompra, unidadReceta, contenido) {
  return edicionCorrer_(auth, function () {
    return factorConversion_(unidadCompra, unidadReceta, contenido);
  });
}
