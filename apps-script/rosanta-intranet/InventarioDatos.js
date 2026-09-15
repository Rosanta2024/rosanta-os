/**
 * InventarioDatos.gs — Profit OS · pestana Inventarios. Entrega 1: VER, sin editar.
 *
 * Lee las dos hojas de inventario de Rosanta que creo la fase 1 (InventarioMigracion.gs,
 * 12-sep-2026): una por area, una pestana por mes (AAAA-MM) y el catalogo PRODUCTOS.
 * Sus IDs viven en las propiedades INV_COCINA_SHEET_ID e INV_BARRA_SHEET_ID. NO lee la
 * hoja de Jose ni las INVENTARIO_* viejas: desde la fase 1 esas quedan como historico.
 *
 * Formato que espera (lo escribio la migracion, informe de la fase 1):
 *   pestana de mes — fila 1: CIERRE | AAAA-MM | ESTADO | CERRADO | ORIGEN | ... (meta)
 *                    fila 3: ID | CATEGORIA | PRODUCTO | TIPO | PRESENTACION | PROVEEDOR |
 *                            PRECIO | EXISTENCIA | MONTO | CONTEO ORIGINAL | BLOQUE
 *                    filas con ID, y al final una fila TOTAL sin ID.
 *   PRODUCTOS      — fila 1: ID | AREA | CATEGORIA | PRODUCTO | TIPO | VINCULO |
 *                            PRODUCTO EN BANCO | PARECIDO | PRESENTACION | PROVEEDOR |
 *                            PRECIO ACTUAL | ACTIVO | ULTIMO MES
 * Las columnas se buscan por ETIQUETA, no por posicion, igual que el resto del modulo.
 *
 * TRES TRAMPAS DE SHEETS, las tres vistas en la fase 1:
 *   · el mes se toma del NOMBRE de la pestana, no de la celda B1: Sheets convierte el
 *     texto "2026-05" en una fecha, y lo mismo le pasa a ULTIMO MES.
 *   · el conteo de barra se escribio como "70%" y Sheets lo guarda como el numero 0.7.
 *     En DESTILADOS se muestra como porcentaje de botella.
 *   · google.script.run no devuelve objetos Date: todo valor sale convertido a texto o
 *     numero antes de viajar.
 *
 * Permisos: LEER, las dos areas para quien tenga el recetario (misma regla que las
 * fichas: ver lo del otro no rompe nada). Escribir llega en la entrega 2 y va a pasar
 * por exigirArea_, como toda escritura del modulo.
 */

var INV_DATOS = {
  propiedad: { COCINA: 'INV_COCINA_SHEET_ID', BARRA: 'INV_BARRA_SHEET_ID' },
  hojaProductos: 'productos',
  filaEncabezadoMes: 3,
  tolerancia: 0.05
};

/** La pestana entera de un area: todos sus meses y el catalogo, en una sola llamada. */
function webInventario(auth, area) {
  return edicionCorrer_(auth, function (u) {
    return invLeerArea_(areaLectura_(area, u));
  });
}

function invLeerArea_(area) {
  var clave = INV_DATOS.propiedad[area];
  if (!clave) throw new Error('Area sin inventario: "' + area + '".');
  var ss = abrirPorClave_(clave);
  if (!ss) throw new Error('Falta ' + clave + ': la hoja de inventario de ' + area + ' no esta configurada.');

  var meses = [], productos = null;
  ss.getSheets().forEach(function (h) {
    var nombre = h.getName().trim();
    if (/^\d{4}-\d{2}$/.test(nombre)) meses.push(invLeerMes_(h, nombre, area));
    else if (normalizar_(nombre) === INV_DATOS.hojaProductos) productos = invLeerProductos_(h, area);
  });
  if (!productos) throw new Error('La hoja de inventario de ' + area + ' no tiene la pestana PRODUCTOS.');
  meses.sort(function (a, b) { return a.mes < b.mes ? -1 : 1; });

  var ahora = new Date();
  return { area: area, meses: meses, productos: productos, leido: invFecha_(ahora) + ' ' + invDos_(ahora.getHours()) + ':' + invDos_(ahora.getMinutes()) };
}

function invLeerMes_(hoja, mes, area) {
  var d = hoja.getDataRange().getValues();
  var meta = d[0] || [], estado = '', origen = '', corrida = '', cerradoPor = '';
  for (var j = 0; j < meta.length - 1; j++) {
    var k = normalizar_(meta[j]);
    if (k === 'estado') estado = invTexto_(meta[j + 1]).toUpperCase();
    if (k === 'origen') origen = invTexto_(meta[j + 1]);
    if (k === 'corrida') corrida = invTexto_(meta[j + 1]);
    if (k === 'cerrado por') cerradoPor = invTexto_(meta[j + 1]);
  }

  var c = invColumnas_(d[INV_DATOS.filaEncabezadoMes - 1] || []);
  if (c['id'] == null || c['producto'] == null || c['monto'] == null) {
    throw new Error('La pestana ' + mes + ' de ' + area + ' no tiene el encabezado esperado en la fila ' +
                    INV_DATOS.filaEncabezadoMes + ' (ID, PRODUCTO, MONTO).');
  }

  var filas = [], totalHoja = null, suma = 0;
  for (var i = INV_DATOS.filaEncabezadoMes; i < d.length; i++) {
    var f = d[i], id = invTexto_(f[c['id']]), producto = invTexto_(f[c['producto']]);
    if (!id) {
      if (normalizar_(producto) === 'total') totalHoja = invNumero_(f[c['monto']]);
      continue;
    }
    var bloque = invTexto_(f[c['bloque']]), monto = invNumero_(f[c['monto']]) || 0;
    suma += monto;
    filas.push([id, invTexto_(f[c['categoria']]), producto, invTexto_(f[c['tipo']]),
                invTexto_(f[c['presentacion']]), invTexto_(f[c['proveedor']]),
                invNumero_(f[c['precio']]), invNumero_(f[c['existencia']]), monto,
                invConteo_(f[c['conteo original']], bloque), bloque]);
  }
  suma = Math.round(suma * 100) / 100;
  return {
    mes: mes, estado: estado, origen: origen, corrida: corrida, cerradoPor: cerradoPor, total: suma, totalHoja: totalHoja,
    // la fila TOTAL es texto escrito, no una formula: si alguien toca un monto y no la
    // corrige, la pantalla lo tiene que decir en vez de mostrar uno de los dos
    cuadra: totalHoja === null || Math.abs(totalHoja - suma) <= INV_DATOS.tolerancia,
    filas: filas
  };
}

function invLeerProductos_(hoja, area) {
  var d = hoja.getDataRange().getValues();
  var c = invColumnas_(d[0] || []);
  if (c['id'] == null || c['producto'] == null) {
    throw new Error('PRODUCTOS de ' + area + ' no tiene el encabezado esperado en la fila 1 (ID, PRODUCTO).');
  }
  var out = [];
  for (var i = 1; i < d.length; i++) {
    var f = d[i], id = invTexto_(f[c['id']]);
    if (!id) continue;
    var ultimo = f[c['ultimo mes']];
    out.push([id, invTexto_(f[c['categoria']]), invTexto_(f[c['producto']]), invTexto_(f[c['tipo']]),
              invTexto_(f[c['vinculo']]), invTexto_(f[c['producto en banco']]), invNumero_(f[c['parecido']]),
              invTexto_(f[c['presentacion']]), invTexto_(f[c['proveedor']]), invNumero_(f[c['precio actual']]),
              invTexto_(f[c['activo']]).toUpperCase(),
              ultimo instanceof Date ? invFecha_(ultimo).slice(0, 7) : invTexto_(ultimo)]);
  }
  return out;
}

/* ------------------------------------------------------------ utiles ---- */

/** { 'etiqueta normalizada' -> indice }. La primera aparicion gana. */
function invColumnas_(encabezado) {
  var c = {};
  encabezado.forEach(function (h, k) {
    var n = normalizar_(h);
    if (n && c[n] == null) c[n] = k;
  });
  return c;
}

/** Texto de una celda. Una fecha sale como AAAA-MM-DD, sin llamar a Utilities por celda. */
function invTexto_(v) {
  if (v == null) return '';
  if (v instanceof Date) return invFecha_(v);
  return String(v).trim();
}

function invNumero_(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var s = String(v == null ? '' : v).replace(/q/gi, '').replace(/[\s,]/g, '');
  if (!s || !/\d/.test(s)) return null;
  var n = Number(s);
  return isNaN(n) ? null : n;
}

/** El conteo como se ve: en destilados, Sheets devuelve 0.7 donde la persona escribio 70%. */
function invConteo_(v, bloque) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return '';
  if (typeof v === 'number') {
    if (bloque === 'DESTILADOS') return (Math.round(v * 1000) / 10) + '%';
    return String(Math.round(v * 100) / 100);
  }
  return String(v).trim();
}

function invFecha_(d) {
  return d.getFullYear() + '-' + invDos_(d.getMonth() + 1) + '-' + invDos_(d.getDate());
}

function invDos_(n) { return (n < 10 ? '0' : '') + n; }

/* ======================================================================
 * ENTREGA 2 — CARGAR (14-sep-2026)
 *
 * Cinco escrituras, todas con la misma forma que las del recetario:
 *   · web* resuelve identidad con edicionCorrer_ y el area con areaDeLaPagina_, que
 *     llama a exigirArea_: Jeffry (chef) escribe cocina, Jose (sala) barra, Juanma
 *     las dos. Leer, cualquiera con el recetario.
 *   · todo pasa por un candado (dos personas guardando el mismo mes a la vez se
 *     pisarian las columnas) y deja rastro en la BITACORA.
 *
 * REGLAS DEL MES
 *   · Solo el ULTIMO mes puede estar ABIERTO. Asi no hay que recorrer todas las
 *     pestanas para saber donde se escribe, y no pueden quedar dos conteos a medias.
 *   · Un mes CERRADO no se toca. Los migrados de la fase 1 estan todos cerrados.
 *   · Abrir el conteo crea la pestana del mes siguiente con los productos ACTIVOS del
 *     ultimo mes, su precio y su proveedor. Las existencias quedan VACIAS: vacio es
 *     "sin contar", que no es lo mismo que 0.
 *   · En un mes abierto MONTO y TOTAL son formulas (=precio*existencia, =SUM), asi la
 *     hoja cuadra sola aunque alguien la edite a mano. Los meses migrados tienen
 *     valores; no se reescriben.
 *   · Cerrar el mes es la entrega 3.
 *
 * TEXTO COMO TEXTO: Sheets convierte "2026-08" y "1/2" en fechas. Las celdas de texto
 * de un mes nuevo se formatean '@' antes de escribir.
 * ====================================================================== */

INV_DATOS.encabezadoMes = ['ID', 'CATEGORIA', 'PRODUCTO', 'TIPO', 'PRESENTACION', 'PROVEEDOR',
                           'PRECIO', 'EXISTENCIA', 'MONTO', 'CONTEO ORIGINAL', 'BLOQUE'];
INV_DATOS.tipos = ['INSUMO', 'PREPARADO', 'REVENTA', 'LIMPIEZA'];
INV_DATOS.bloquesBarra = ['DESTILADOS', 'VINOS', 'CERVEZA', 'INSUMOS'];
INV_DATOS.maxCambios = 600;

function webInventarioAbrirMes(auth, area) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invAbrirMes_(a, u); });
  }, 'inventario abrir mes ' + area);
}

function webInventarioGuardar(auth, area, mes, cambios) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invGuardar_(a, mes, cambios, u); });
  }, 'inventario guardar ' + area + ' ' + mes);
}

function webInventarioAlta(auth, area, datos, confirmar) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invAlta_(a, datos, !!confirmar, u); });
  }, 'inventario alta ' + (datos && datos.producto || ''));
}

function webInventarioActivo(auth, area, id, activo) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invActivo_(a, id, !!activo, u); });
  }, 'inventario ' + (activo ? 'reactivar ' : 'inactivar ') + id);
}

/** crear: null para conectar con un producto que ya esta en el Banco, o
 *  { unidadReceta, contenido, confirmar } para crearlo en el Banco con los datos del catalogo. */
function webInventarioClasificar(auth, area, id, tipo, banco, crear) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invClasificar_(a, id, tipo, banco, crear || null, u); });
  }, 'inventario clasificar ' + id);
}

/* ------------------------------------------------------- abrir el mes ---- */

function invAbrirMes_(area, u) {
  var ss = invHojaDe_(area);
  var ult = invUltimoMes_(ss);
  if (!ult) throw new Error('La hoja de ' + area + ' no tiene ningun mes del cual partir.');
  if (invEstado_(ult.d) === 'ABIERTO') {
    throw new Error('El conteo de ' + ult.mes + ' ya esta abierto. Hay que cerrarlo antes de abrir otro.');
  }
  var nuevo = invMesSiguiente_(ult.mes);
  if (ss.getSheetByName(nuevo)) throw new Error('Ya existe la pestana ' + nuevo + '.');

  var cat = invCatalogo_(ss), c = invColumnas_(ult.d[INV_DATOS.filaEncabezadoMes - 1]);
  var filas = [];
  for (var i = INV_DATOS.filaEncabezadoMes; i < ult.d.length; i++) {
    var f = ult.d[i], id = invTexto_(f[c['id']]);
    if (!id) continue;
    var p = cat.porId[id];
    if (p && invTexto_(p.fila[cat.c['activo']]).toUpperCase() === 'NO') continue;
    filas.push([id, invTexto_(f[c['categoria']]), invTexto_(f[c['producto']]), invTexto_(f[c['tipo']]),
                invTexto_(f[c['presentacion']]), invTexto_(f[c['proveedor']]),
                invNumero_(f[c['precio']]) === null ? '' : invNumero_(f[c['precio']]),
                '', '', '', invTexto_(f[c['bloque']])]);
  }
  if (!filas.length) throw new Error('El mes ' + ult.mes + ' no tiene productos activos para copiar.');

  var h = ss.insertSheet(nuevo, ult.hoja.getIndex());   // queda despues del ultimo mes
  invEscribirMes_(h, nuevo, 'ABIERTO', 'Abierto desde la intranet por ' + (u.nombre || u.email), filas);
  bitacoraLote_([[u.email, u.rol, 'inventario abrir mes', 'INVENTARIO ' + area, nuevo, 'ESTADO', '', 'ABIERTO',
                  filas.length + ' productos copiados de ' + ult.mes]]);
  return { mes: nuevo, desde: ult.mes, productos: filas.length };
}

/** Escribe una pestana de mes nueva: meta, encabezado, filas con formula y TOTAL. */
function invEscribirMes_(h, mes, estado, origen, filas) {
  var enc = INV_DATOS.encabezadoMes, ancho = enc.length, primera = INV_DATOS.filaEncabezadoMes + 1;
  var L = invLetras_(enc), n = filas.length, ultima = primera + n - 1;
  h.getRange(1, 1, 1, 8).setNumberFormat('@')
   .setValues([['CIERRE', mes, 'ESTADO', estado, 'ORIGEN', origen, 'CREADO', invAhora_()]]);
  h.getRange(INV_DATOS.filaEncabezadoMes, 1, 1, ancho).setValues([enc]).setFontWeight('bold');
  // texto como texto: A..F (ID a PROVEEDOR) y J..K (CONTEO y BLOQUE)
  h.getRange(primera, 1, n + 1, 6).setNumberFormat('@');
  h.getRange(primera, 10, n + 1, 2).setNumberFormat('@');
  var valores = filas.map(function (f, k) {
    var r = primera + k, fila = f.slice();
    fila[8] = '=' + L.precio + r + '*' + L.existencia + r;
    return fila;
  });
  valores.push(['', '', 'TOTAL', '', '', '', '', '', '=SUM(' + L.monto + primera + ':' + L.monto + ultima + ')', '', '']);
  h.getRange(primera, 1, valores.length, ancho).setValues(valores);
  h.setFrozenRows(INV_DATOS.filaEncabezadoMes);
}

/* ------------------------------------------------------------ guardar ---- */

/**
 * cambios: [{ id, existencia?, precio?, proveedor? }]. Un campo ausente no se toca;
 * existencia '' la vuelve "sin contar". La EXISTENCIA llega en su unidad: botellas en
 * destilados (la pantalla convierte el % antes de mandar).
 */
function invGuardar_(area, mes, cambios, u) {
  mes = String(mes || '');
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mes invalido: "' + mes + '".');
  if (!cambios || !cambios.length) throw new Error('No hay cambios para guardar.');
  if (cambios.length > INV_DATOS.maxCambios) throw new Error('Demasiados cambios juntos (' + cambios.length + ').');

  var h = invHojaDe_(area).getSheetByName(mes);
  if (!h) throw new Error('No existe la pestana ' + mes + ' en el inventario de ' + area + '.');
  var d = h.getDataRange().getValues();
  if (invEstado_(d) !== 'ABIERTO') throw new Error('El mes ' + mes + ' esta cerrado: no se edita.');
  var c = invColumnas_(d[INV_DATOS.filaEncabezadoMes - 1]);
  ['id', 'producto', 'proveedor', 'precio', 'existencia'].forEach(function (k) {
    if (c[k] == null) throw new Error('La pestana ' + mes + ' no tiene la columna ' + k.toUpperCase() + '.');
  });

  var filaDe = {};
  for (var i = INV_DATOS.filaEncabezadoMes; i < d.length; i++) {
    var id = invTexto_(d[i][c['id']]);
    if (id) filaDe[id] = i;
  }

  var rastro = [], hoja = 'INVENTARIO ' + area + ' ' + mes, tocadas = {}, provCambio = {};
  cambios.forEach(function (x) {
    var id = String(x && x.id || '').trim(), k = filaDe[id];
    if (k == null) throw new Error('El producto ' + id + ' no esta en ' + mes + '. Recarga la pagina.');
    var prod = invTexto_(d[k][c['producto']]);
    ['existencia', 'precio', 'proveedor'].forEach(function (campo) {
      if (!Object.prototype.hasOwnProperty.call(x, campo)) return;
      var nuevo = campo === 'proveedor' ? String(x[campo] == null ? '' : x[campo]).trim().slice(0, 120)
                                        : invValorNumerico_(x[campo], campo, prod);
      var antes = d[k][c[campo]];
      if (String(antes) === String(nuevo)) return;
      d[k][c[campo]] = nuevo;
      tocadas[id] = 1;
      if (campo === 'proveedor') provCambio[id] = nuevo;
      rastro.push([u.email, u.rol, 'inventario ' + campo, hoja, id + ' · ' + prod, campo, antes, nuevo, '']);
    });
  });
  if (!rastro.length) return { guardados: 0, productos: 0 };

  // Una escritura por columna, no una por celda. El candado de afuera garantiza que
  // nadie escribio entre la lectura y esto.
  var n = d.length - INV_DATOS.filaEncabezadoMes;
  ['proveedor', 'precio', 'existencia'].forEach(function (campo) {
    var col = c[campo];
    h.getRange(INV_DATOS.filaEncabezadoMes + 1, col + 1, n, 1)
     .setValues(d.slice(INV_DATOS.filaEncabezadoMes).map(function (f) { return [f[col]]; }));
  });
  bitacoraLote_(rastro);
  SpreadsheetApp.flush();

  // lo que el cambio arrastra al resto del recetario (regla de Juanma, 14-sep-2026)
  var ecos = invPropagarProveedores_(area, provCambio, u);
  return { guardados: rastro.length, productos: Object.keys(tocadas).length,
           proveedoresNuevos: ecos.nuevos, bancoActualizados: ecos.banco, avisos: ecos.avisos,
           recetario: ecos.nuevos.length > 0 || ecos.banco.length > 0 };
}

function invValorNumerico_(v, campo, prod) {
  if (v === '' || v == null) return '';
  var n = Number(String(v).replace(',', '.'));
  if (isNaN(n) || n < 0) throw new Error('La ' + campo + ' de ' + prod + ' no es un numero valido: "' + v + '".');
  if (campo === 'precio' && n === 0) throw new Error('El precio de ' + prod + ' tiene que ser mayor que cero, o quedar vacio.');
  if (n > 1000000) throw new Error('La ' + campo + ' de ' + prod + ' es demasiado grande: ' + n + '.');
  return Math.round(n * 10000) / 10000;
}

/* --------------------------------------------------------------- alta ---- */

/**
 * Producto nuevo: entra al catalogo PRODUCTOS y al mes abierto. Antes de crear avisa si
 * hay algo parecido en el catalogo (mismo criterio que el alta del Banco); un nombre
 * IDENTICO no se crea nunca, porque ahi el camino es reactivarlo.
 */
function invAlta_(area, datos, confirmar, u) {
  datos = datos || {};
  var producto = String(datos.producto || '').trim().replace(/\s+/g, ' ');
  var categoria = String(datos.categoria || '').trim();
  var tipo = String(datos.tipo || '').trim().toUpperCase();
  var presentacion = String(datos.presentacion || '').trim().slice(0, 60);
  var proveedor = String(datos.proveedor || '').trim().slice(0, 120);
  var banco = String(datos.banco || '').trim();
  var unidadReceta = String(datos.unidadReceta || '').trim();
  var contenido = datos.contenido === '' || datos.contenido == null ? null : Number(datos.contenido);
  if (producto.length < 2 || producto.length > 80) throw new Error('El nombre del producto tiene que tener entre 2 y 80 letras.');
  if (!categoria) throw new Error('Falta la categoria.');
  if (INV_DATOS.tipos.indexOf(tipo) === -1) throw new Error('Tipo invalido: "' + datos.tipo + '".');
  var precio = invValorNumerico_(datos.precio, 'precio', producto);
  var bloque = area === 'COCINA' ? categoria : String(datos.bloque || '').trim().toUpperCase();
  if (area === 'BARRA' && INV_DATOS.bloquesBarra.indexOf(bloque) === -1) throw new Error('Elegi el bloque de barra: destilados, vinos, cerveza o insumos.');

  var ss = invHojaDe_(area), cat = invCatalogo_(ss);
  var similares = [], maxId = 0;
  cat.filas.forEach(function (f) {
    var id = invTexto_(f[cat.c['id']]), p = invTexto_(f[cat.c['producto']]);
    maxId = Math.max(maxId, Number(id.replace(/\D/g, '')) || 0);
    if (normalizar_(p) === normalizar_(producto)) {
      throw new Error('Ya existe "' + p + '" en el catalogo (' + id + ', ' +
        (invTexto_(f[cat.c['activo']]).toUpperCase() === 'NO' ? 'inactivo: reactivalo desde Catalogo' : 'activo') + ').');
    }
    var s = similitud_(producto, p);
    if (s >= EDIT.umbralSimilitud || contieneAlOtro_(producto, p)) {
      similares.push({ id: id, producto: p, similitud: Math.round(s * 100),
                       activo: invTexto_(f[cat.c['activo']]).toUpperCase() !== 'NO' });
    }
  });
  if (similares.length && !confirmar) {
    similares.sort(function (a, b) { return b.similitud - a.similitud; });
    return { creado: false, similares: similares.slice(0, 8) };
  }

  var abierto = invMesAbierto_(ss);
  if (!abierto) throw new Error('No hay un conteo abierto en ' + area + '. Abri el mes antes de agregar productos.');

  var vinculo = 'NO APLICA', enBanco = '', bancoNuevo = false, provAlBanco = false, avisos = [];
  if (tipo === 'INSUMO') {
    var ya = banco ? null : invBuscarEnBanco_(area, producto);
    if (banco) {
      var fb = invFilaDelBanco_(area, banco);
      enBanco = fb.producto; vinculo = 'MANUAL';
      provAlBanco = !fb.proveedor && !!proveedor;
    } else if (ya) {
      // El Banco ya tiene ese mismo nombre: se conecta y no se crea otra fila. Pasa al
      // reintentar un alta que se corto despues de crearlo en el Banco (auditoria M4).
      enBanco = ya.producto; vinculo = 'EXACTO';
      provAlBanco = !ya.proveedor && !!proveedor;
    } else {
      // Regla de Juanma (14-sep-2026): lo que entra al inventario tiene que existir en
      // el resto del modulo. Un insumo nuevo entra tambien al Banco de Datos, y con eso
      // aparece en Productos y se puede usar en recetas y pre-elaborados. crearInsumo
      // trae su propio aviso de parecidos y su propio calculo de conversion.
      if (!(precio > 0)) throw new Error('Para darlo de alta en el Banco de Datos hace falta el precio.');
      if (!presentacion) throw new Error('Falta la presentacion: en el Banco es la unidad de compra (libra, 750 ml, caja...).');
      if (!unidadReceta) throw new Error('Falta la unidad de receta (g, ml, unidad): es como lo pide una receta.');
      var rb = crearInsumo_({ producto: producto, categoria: categoria, precioCompra: precio, unidadCompra: presentacion,
                             unidadReceta: unidadReceta, contenido: contenido, proveedor: proveedor },
                           u.email, u.rol, !!datos.confirmarBanco, area);
      if (!rb.ok) return { creado: false, banco: invRespuestaBanco_(rb) };
      enBanco = producto; vinculo = 'EXACTO'; bancoNuevo = true;
    }
  }
  var id = (area === 'COCINA' ? 'C-' : 'B-') + ('000' + (maxId + 1)).slice(-3);

  var fila = cat.encabezado.map(function () { return ''; });
  var poner = function (k, v) { if (cat.c[k] != null) fila[cat.c[k]] = v; };
  poner('id', id); poner('area', area); poner('categoria', categoria); poner('producto', producto);
  poner('tipo', tipo); poner('vinculo', vinculo); poner('producto en banco', enBanco);
  poner('presentacion', presentacion); poner('proveedor', proveedor); poner('precio actual', precio);
  poner('activo', 'SI'); poner('ultimo mes', abierto.mes);
  var r = cat.hoja.getLastRow() + 1, rango = cat.hoja.getRange(r, 1, 1, fila.length);
  rango.setNumberFormat('@');
  if (cat.c['precio actual'] != null) cat.hoja.getRange(r, cat.c['precio actual'] + 1).setNumberFormat('0.00##');
  rango.setValues([fila]);

  invInsertarEnMes_(abierto, [id, categoria, producto, tipo, presentacion, proveedor, precio, '', '', '', bloque]);
  bitacoraLote_([[u.email, u.rol, 'inventario alta', 'INVENTARIO ' + area + ' ' + abierto.mes, id + ' · ' + producto,
                  'PRODUCTO', '', producto, tipo + (enBanco ? ' · Banco: ' + enBanco : '') +
                  (similares.length ? ' · creado igual con ' + similares.length + ' parecido(s)' : '')]]);
  SpreadsheetApp.flush();

  if (provAlBanco) {
    try { asignarProveedor_(enBanco, proveedor, u.email, u.rol, area); }
    catch (e) { avisos.push(enBanco + ': ' + (e && e.message || e)); }
  }
  var provNuevos = [];
  if (proveedor) {
    try { provNuevos = invAsegurarProveedores_([proveedor], u); }
    catch (e) { avisos.push('Proveedores: ' + (e && e.message || e)); }
  }
  return { creado: true, id: id, mes: abierto.mes, banco: enBanco, bancoNuevo: bancoNuevo,
           proveedoresNuevos: provNuevos, avisos: avisos,
           recetario: bancoNuevo || provAlBanco || provNuevos.length > 0 };
}

/* ------------------------------------------------ activo / inactivo ---- */

function invActivo_(area, id, activo, u) {
  id = String(id || '').trim();
  var ss = invHojaDe_(area), cat = invCatalogo_(ss), p = cat.porId[id];
  if (!p) throw new Error('No existe el producto ' + id + ' en el catalogo de ' + area + '.');
  var prod = invTexto_(p.fila[cat.c['producto']]);
  var antes = invTexto_(p.fila[cat.c['activo']]).toUpperCase() === 'NO' ? 'NO' : 'SI', nuevo = activo ? 'SI' : 'NO';
  if (antes === nuevo) return { cambiado: false };

  var abierto = invMesAbierto_(ss), nota = '';
  if (abierto) {
    var c = invColumnas_(abierto.d[INV_DATOS.filaEncabezadoMes - 1]), k = -1;
    for (var i = INV_DATOS.filaEncabezadoMes; i < abierto.d.length; i++) {
      if (invTexto_(abierto.d[i][c['id']]) === id) { k = i; break; }
    }
    if (!activo && k >= 0) {
      var ex = invNumero_(abierto.d[k][c['existencia']]);
      if (ex > 0) {
        throw new Error(prod + ' tiene existencia contada en ' + abierto.mes + ' (' + ex + '). ' +
                        'Ponela en 0 o dejala vacia y guarda antes de inactivarlo.');
      }
      abierto.hoja.deleteRow(k + 1);   // el SUM del TOTAL se achica solo
      nota = 'sale del conteo de ' + abierto.mes;
    }
    if (activo && k < 0) {
      var previo = invFilaEnMes_(ss, invMesDeCelda_(p.fila[cat.c['ultimo mes']]), id);
      var bloque = previo ? previo.bloque : (area === 'COCINA' ? invTexto_(p.fila[cat.c['categoria']]) : '');
      if (!bloque) throw new Error('No encuentro en que bloque de barra iba ' + prod + '. Dalo de alta de nuevo.');
      var precio = invNumero_(p.fila[cat.c['precio actual']]);
      invInsertarEnMes_(abierto, [id, invTexto_(p.fila[cat.c['categoria']]), prod, invTexto_(p.fila[cat.c['tipo']]),
                                  invTexto_(p.fila[cat.c['presentacion']]), invTexto_(p.fila[cat.c['proveedor']]),
                                  precio === null ? '' : precio, '', '', '', bloque]);
      nota = 'entra al conteo de ' + abierto.mes;
    }
  }
  cat.hoja.getRange(p.r, cat.c['activo'] + 1).setValue(nuevo);
  bitacoraLote_([[u.email, u.rol, 'inventario ' + (activo ? 'reactivar' : 'inactivar'), 'INVENTARIO ' + area,
                  id + ' · ' + prod, 'ACTIVO', antes, nuevo, nota]]);
  SpreadsheetApp.flush();
  return { cambiado: true, nota: nota };
}

/* --------------------------------------------- clasificar y conectar ---- */

/**
 * Decide que es un producto y, si es INSUMO, con cual del Banco de Datos se conecta.
 * Un insumo sin producto del Banco no se acepta: para dejarlo pendiente no hace falta
 * tocar nada. PREPARADO, REVENTA y LIMPIEZA no se conectan nunca (vinculo NO APLICA).
 */
function invClasificar_(area, id, tipo, banco, crear, u) {
  id = String(id || '').trim();
  tipo = String(tipo || '').trim().toUpperCase();
  if (INV_DATOS.tipos.indexOf(tipo) === -1) throw new Error('Tipo invalido: "' + tipo + '".');
  var ss = invHojaDe_(area), cat = invCatalogo_(ss), p = cat.porId[id];
  if (!p) throw new Error('No existe el producto ' + id + ' en el catalogo de ' + area + '.');
  var prod = invTexto_(p.fila[cat.c['producto']]);

  var vinculo = 'NO APLICA', enBanco = '', bancoNuevo = false, provAlBanco = false;
  var provInv = cat.c['proveedor'] != null ? invTexto_(p.fila[cat.c['proveedor']]) : '';
  if (tipo === 'INSUMO') {
    var ya = crear ? invBuscarEnBanco_(area, prod) : null;
    if (ya) {
      // Pidio crearlo, pero el Banco ya tiene ese nombre (reintento, o ya estaba
      // conectado): se conecta con esa fila y no se crea otra (auditoria M4).
      enBanco = ya.producto; vinculo = 'EXACTO';
      provAlBanco = !ya.proveedor && !!provInv;
    } else if (crear) {
      // No esta en el Banco: se crea ahi con lo que ya sabe el catalogo (regla del 14-sep).
      var precio = cat.c['precio actual'] != null ? invNumero_(p.fila[cat.c['precio actual']]) : null;
      var pres = cat.c['presentacion'] != null ? invTexto_(p.fila[cat.c['presentacion']]) : '';
      var ur = String(crear.unidadReceta || '').trim();
      var cont = crear.contenido === '' || crear.contenido == null ? null : Number(crear.contenido);
      if (!(precio > 0)) throw new Error(prod + ' no tiene precio en el catalogo: cargalo en el conteo antes de crearlo en el Banco.');
      if (!pres) throw new Error(prod + ' no tiene presentacion, que en el Banco es la unidad de compra.');
      if (!ur) throw new Error('Falta la unidad de receta (g, ml, unidad).');
      var rb = crearInsumo_({ producto: prod, categoria: invTexto_(p.fila[cat.c['categoria']]), precioCompra: precio,
                             unidadCompra: pres, unidadReceta: ur, contenido: cont, proveedor: provInv },
                           u.email, u.rol, !!crear.confirmar, area);
      if (!rb.ok) return { cambiado: false, banco: invRespuestaBanco_(rb) };
      enBanco = prod; vinculo = 'EXACTO'; bancoNuevo = true;
    } else {
      if (!String(banco || '').trim()) throw new Error('Un insumo se conecta con un producto del Banco de Datos: elegi cual.');
      var fb = invFilaDelBanco_(area, banco);
      enBanco = fb.producto; vinculo = 'MANUAL';
      // si el Banco no sabe a quien se le compra y el inventario si, se lo pasa
      provAlBanco = !fb.proveedor && !!provInv;
    }
  }
  var antes = [invTexto_(p.fila[cat.c['tipo']]), invTexto_(p.fila[cat.c['vinculo']]), invTexto_(p.fila[cat.c['producto en banco']])];
  if (antes[0] === tipo && antes[2] === enBanco) return { cambiado: false };

  var fila = p.fila.slice();
  fila[cat.c['tipo']] = tipo;
  fila[cat.c['vinculo']] = vinculo;
  fila[cat.c['producto en banco']] = enBanco;
  if (cat.c['parecido'] != null) fila[cat.c['parecido']] = '';
  cat.hoja.getRange(p.r, 1, 1, fila.length).setValues([fila]);

  var abierto = invMesAbierto_(ss);
  if (abierto) {
    var c = invColumnas_(abierto.d[INV_DATOS.filaEncabezadoMes - 1]);
    for (var i = INV_DATOS.filaEncabezadoMes; i < abierto.d.length; i++) {
      if (invTexto_(abierto.d[i][c['id']]) === id) { abierto.hoja.getRange(i + 1, c['tipo'] + 1).setValue(tipo); break; }
    }
  }
  bitacoraLote_([[u.email, u.rol, 'inventario clasificar', 'INVENTARIO ' + area, id + ' · ' + prod,
                  'TIPO / BANCO', antes[0] + ' · ' + (antes[2] || antes[1]), tipo + (enBanco ? ' · ' + enBanco : ''), '']]);
  SpreadsheetApp.flush();

  var avisos = [], provNuevos = [];
  if (provAlBanco) {
    try { asignarProveedor_(enBanco, provInv, u.email, u.rol, area); }
    catch (e) { avisos.push(enBanco + ': ' + (e && e.message || e)); }
  }
  if ((bancoNuevo || provAlBanco) && provInv) {
    try { provNuevos = invAsegurarProveedores_([provInv], u); }
    catch (e) { avisos.push('Proveedores: ' + (e && e.message || e)); }
  }
  return { cambiado: true, tipo: tipo, banco: enBanco, bancoNuevo: bancoNuevo,
           proveedoresNuevos: provNuevos, avisos: avisos,
           recetario: bancoNuevo || provAlBanco || provNuevos.length > 0 };
}

/** { producto, proveedor } de un producto del Banco de Datos del area, o tira. */
function invFilaDelBanco_(area, nombre) {
  var fb = invBuscarEnBanco_(area, nombre);
  if (fb) return fb;
  throw new Error('"' + nombre + '" no esta en el Banco de Datos de ' + area.toLowerCase() +
                  '. Elegilo de la lista, o crealo en el Banco desde este mismo panel.');
}

/** Lo mismo, pero null si no esta. Nombre identico (normalizado); la primera fila gana. */
function invBuscarEnBanco_(area, nombre) {
  var k = normalizar_(nombre);
  var f = recetarioDe_(area).getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    var p = String(f[i][EDIT.col.producto - 1] || '').trim();
    if (p && normalizar_(p) === k) return { producto: p, proveedor: String(f[i][EDIT.col.proveedor - 1] || '').trim() };
  }
  return null;
}

/** Lo que contesto crearInsumo cuando NO creo, en la forma que entiende la pantalla. */
function invRespuestaBanco_(rb) {
  return { motivo: rb.motivo || '', similares: rb.similares || [],
           requiereContenido: !!rb.requiereContenido, tipicos: rb.tipicos || [] };
}

/* ------------------------------------- lo que arrastra al resto del modulo ---- */

/**
 * REGLA DE JUANMA, 14-sep-2026: lo que cambia en el inventario tiene que verse en el
 * resto de las pestanas. Para el proveedor eso son dos cosas:
 *   · si no existe en la hoja PROVEEDORES, se crea ahi (crearProveedor, con bitacora);
 *   · si el producto es un INSUMO conectado al Banco de SU area, el Banco toma ese
 *     proveedor (asignarProveedor). La pestana Proveedores se arma con el proveedor de
 *     cada producto del Banco: sin este paso, el proveedor nuevo no apareceria.
 * Tambien se actualiza la columna PROVEEDOR del catalogo PRODUCTOS.
 *
 * El PRECIO no viaja aca, a proposito: pasa al Banco al CERRAR el mes (entrega 3), con
 * la regla del 10% que decidio Juanma el 12-sep.
 *
 * Nunca tira: el inventario ya se guardo, y lo que no se pudo arrastrar vuelve en
 * avisos. Las escrituras de este bucle son una por producto con proveedor cambiado,
 * que en un cierre son pocos; las de asignarProveedor ya eran asi.
 */
function invPropagarProveedores_(area, provPorId, u) {
  var out = { nuevos: [], banco: [], avisos: [] }, ids = Object.keys(provPorId || {});
  if (!ids.length) return out;
  try { out.nuevos = invAsegurarProveedores_(ids.map(function (id) { return provPorId[id]; }), u); }
  catch (e) { out.avisos.push('No pude revisar la lista de proveedores: ' + (e && e.message || e)); }

  var cat;
  try { cat = invCatalogo_(invHojaDe_(area)); }
  catch (e) { out.avisos.push(String(e && e.message || e)); return out; }
  var cProv = cat.c['proveedor'];
  ids.forEach(function (id) {
    var p = cat.porId[id], prov = provPorId[id];
    if (!p) return;
    var prod = invTexto_(p.fila[cat.c['producto']]);
    try {
      if (cProv != null && invTexto_(p.fila[cProv]) !== prov) cat.hoja.getRange(p.r, cProv + 1).setValue(prov);
    } catch (e) { out.avisos.push(prod + ' (catalogo): ' + (e && e.message || e)); }
    if (!prov) return;
    var tipo = invTexto_(p.fila[cat.c['tipo']]), vinc = invTexto_(p.fila[cat.c['vinculo']]);
    var banco = invTexto_(p.fila[cat.c['producto en banco']]);
    if (tipo !== 'INSUMO' || !banco || vinc === 'PENDIENTE' || vinc === 'NO APLICA') return;
    if (vinc === 'OTRA_AREA') {
      out.avisos.push(prod + ' esta conectado al Banco de la otra area: ahi no se cambio el proveedor.');
      return;
    }
    try { asignarProveedor_(banco, prov, u.email, u.rol, area); out.banco.push(banco); }
    catch (e) { out.avisos.push(banco + ': ' + (e && e.message || e)); }
  });
  return out;
}

/** Crea en PROVEEDORES los que no existen (por nombre o alias). Devuelve los creados. */
function invAsegurarProveedores_(nombres, u) {
  var unicos = {};
  (nombres || []).forEach(function (n) { n = String(n || '').trim(); if (n) unicos[normalizar_(n)] = n; });
  var claves = Object.keys(unicos);
  if (!claves.length) return [];
  var ya = {}, h = hojaCosteo_().getSheetByName(COSTEO.hojas.proveedores);
  if (h && h.getLastRow() > 1) {
    h.getRange(2, 1, h.getLastRow() - 1, 2).getValues().forEach(function (f) {
      if (String(f[0] || '').trim()) ya[normalizar_(f[0])] = 1;
      String(f[1] || '').split(/[·,;|]/).forEach(function (a) { if (normalizar_(a)) ya[normalizar_(a)] = 1; });
    });
  }
  var alias = aliasProveedores_(), nuevos = [];
  claves.forEach(function (k) {
    if (ya[k] || alias[k]) return;
    // confirmar=true: la persona ya eligio escribirlo; el aviso de parecidos se lo da la
    // pantalla antes de mandar, con la lista que tiene a mano
    var r = crearProveedor_({ nombre: unicos[k], nota: 'alta desde el inventario' }, u.email, u.rol, true);
    if (r && r.ok) nuevos.push(unicos[k]);
  });
  return nuevos;
}

/* --------------------------------------------------- utiles de escritura ---- */

function invConCandado_(fn) {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) throw new Error('Alguien esta guardando en este momento. Proba de nuevo en unos segundos.');
  try { return fn(); } finally { candado.releaseLock(); }
}

function invHojaDe_(area) {
  var clave = INV_DATOS.propiedad[area];
  var ss = clave ? abrirPorClave_(clave) : null;
  if (!ss) throw new Error('Falta ' + clave + ': la hoja de inventario de ' + area + ' no esta configurada.');
  return ss;
}

/** El mes mas nuevo de la hoja, con sus datos. */
function invUltimoMes_(ss) {
  var nombres = ss.getSheets().map(function (h) { return h.getName().trim(); })
                  .filter(function (n) { return /^\d{4}-\d{2}$/.test(n); }).sort();
  if (!nombres.length) return null;
  var mes = nombres[nombres.length - 1], hoja = ss.getSheetByName(mes);
  return { mes: mes, hoja: hoja, d: hoja.getDataRange().getValues() };
}

/** El mes abierto, o null. Por regla solo puede serlo el ultimo. */
function invMesAbierto_(ss) {
  var u = invUltimoMes_(ss);
  return u && invEstado_(u.d) === 'ABIERTO' ? u : null;
}

function invEstado_(d) {
  var meta = d[0] || [];
  for (var j = 0; j < meta.length - 1; j++) {
    if (normalizar_(meta[j]) === 'estado') return invTexto_(meta[j + 1]).toUpperCase();
  }
  return '';
}

function invCatalogo_(ss) {
  var hoja = null;
  ss.getSheets().forEach(function (h) { if (normalizar_(h.getName()) === INV_DATOS.hojaProductos) hoja = h; });
  if (!hoja) throw new Error('La hoja de inventario no tiene la pestana PRODUCTOS.');
  var d = hoja.getDataRange().getValues(), c = invColumnas_(d[0] || []), porId = {}, filas = [];
  ['id', 'producto', 'tipo', 'vinculo', 'producto en banco', 'activo'].forEach(function (k) {
    if (c[k] == null) throw new Error('PRODUCTOS no tiene la columna ' + k.toUpperCase() + '.');
  });
  for (var i = 1; i < d.length; i++) {
    var id = invTexto_(d[i][c['id']]);
    if (!id) continue;
    porId[id] = { fila: d[i], r: i + 1 };
    filas.push(d[i]);
  }
  return { hoja: hoja, encabezado: d[0], c: c, porId: porId, filas: filas, d: d };
}

/** Bloque y precio con que un producto aparecio en un mes. Para reactivar en barra. */
function invFilaEnMes_(ss, mes, id) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return null;
  var h = ss.getSheetByName(mes);
  if (!h) return null;
  var d = h.getDataRange().getValues(), c = invColumnas_(d[INV_DATOS.filaEncabezadoMes - 1] || []);
  for (var i = INV_DATOS.filaEncabezadoMes; i < d.length; i++) {
    if (invTexto_(d[i][c['id']]) === id) return { bloque: invTexto_(d[i][c['bloque']]) };
  }
  return null;
}

/**
 * Agrega una fila al mes abierto, al final de su bloque y categoria (o antes del TOTAL
 * si es la primera), con su formula de monto, y rehace el SUM del TOTAL: una fila
 * insertada justo antes del TOTAL queda FUERA del rango y Sheets no lo agranda solo.
 */
function invInsertarEnMes_(abierto, fila) {
  var d = abierto.d, h = abierto.hoja, enc = d[INV_DATOS.filaEncabezadoMes - 1], c = invColumnas_(enc);
  var L = invLetras_(enc), primera = INV_DATOS.filaEncabezadoMes;   // indice 0 de la primera fila de datos
  var total = -1, ultimoIgual = -1;
  for (var i = primera; i < d.length; i++) {
    var id = invTexto_(d[i][c['id']]);
    if (!id && normalizar_(d[i][c['producto']]) === 'total') { total = i; break; }
    if (id && invTexto_(d[i][c['bloque']]) === fila[10] && invTexto_(d[i][c['categoria']]) === fila[1]) ultimoIgual = i;
  }
  if (total < 0) throw new Error('La pestana ' + abierto.mes + ' no tiene la fila TOTAL.');
  var pos = ultimoIgual >= 0 ? ultimoIgual + 1 : total;   // indice 0 donde queda la fila nueva
  h.insertRowBefore(pos + 1);
  var r = pos + 1, valores = [];
  enc.forEach(function (x, k) { valores[k] = ''; });
  var poner = function (k, v) { if (c[k] != null) valores[c[k]] = v; };
  poner('id', fila[0]); poner('categoria', fila[1]); poner('producto', fila[2]); poner('tipo', fila[3]);
  poner('presentacion', fila[4]); poner('proveedor', fila[5]); poner('precio', fila[6]); poner('existencia', '');
  poner('monto', '=' + L.precio + r + '*' + L.existencia + r); poner('bloque', fila[10]);
  var rango = h.getRange(r, 1, 1, valores.length);
  rango.setNumberFormat('@');
  [c['precio'], c['existencia'], c['monto']].forEach(function (k) { if (k != null) h.getRange(r, k + 1).setNumberFormat('0.00##'); });
  rango.setValues([valores]);
  var filaTotal = total + 2;   // 1-based, ya corrida por la insercion
  h.getRange(filaTotal, c['monto'] + 1).setFormula('=SUM(' + L.monto + (primera + 1) + ':' + L.monto + (filaTotal - 1) + ')');
}

/** Letras de columna de precio, existencia y monto, por etiqueta. */
function invLetras_(enc) {
  var c = invColumnas_(enc), letra = function (k) {
    var n = k + 1, s = '';
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  return { precio: letra(c['precio']), existencia: letra(c['existencia']), monto: letra(c['monto']) };
}

/** AAAA-MM de una celda. Sheets convierte el texto "2026-08" en fecha (auditoria A10). */
function invMesDeCelda_(v) {
  return v instanceof Date ? invFecha_(v).slice(0, 7) : invTexto_(v);
}

/** Dos precios de invNumero_ (numero o null) son el mismo, al centavo. */
function invMismoPrecio_(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < 0.005;
}

function invMesSiguiente_(mes) {
  var p = String(mes).split('-'), a = Number(p[0]), m = Number(p[1]) + 1;
  if (m > 12) { m = 1; a++; }
  return a + '-' + invDos_(m);
}

function invAhora_() {
  var d = new Date();
  return invFecha_(d) + ' ' + invDos_(d.getHours()) + ':' + invDos_(d.getMinutes());
}

/* ======================================================================
 * ENTREGA 3 — CERRAR EL MES Y LLEVAR LOS PRECIOS AL BANCO (14-sep-2026)
 *
 * Decisiones de Juanma del 12-sep, que esto ejecuta:
 *   · al cerrar, un precio que cambio MENOS de 10% entra solo al Banco de Datos;
 *   · uno de 10% O MAS espera a que Juanma lo apruebe en la intranet;
 *   · todo con registro y con deshacer;
 *   · nunca para PREPARADO (su costo lo da la receta), REVENTA ni LIMPIEZA.
 *
 * NO HAY UN SEGUNDO MOTOR DE PRECIOS. La escritura en el Banco es aplicarSincronizacion_()
 * y el deshacer es revertirSync_(), los dos de SincronizarPrecios.gs: mismos candados
 * (la fila se relee, un precio que cambio desde la propuesta se salta), mismo log
 * SYNC_PRECIOS con su CORRIDA y la misma BITACORA. Lo que cambia es de donde sale la
 * propuesta: del mes cerrado y del catalogo PRODUCTOS, en vez del .xlsx del cierre.
 *
 * PRECIOS_POR_APROBAR (hoja de costeo) es el registro de cada propuesta de un cierre:
 * PENDIENTE, AUTOMATICO, APROBADO, RECHAZADO, SALTADO o REEMPLAZADO. Las filas
 * AUTOMATICO y APROBADO llevan su CORRIDA, que es lo que se deshace.
 *
 * Solo se lleva un precio si la PRESENTACION del inventario es la misma unidad que la
 * UNIDAD_COMPRA del Banco (mismaUnidad_, el candado 1 del sync): el camote a Q20 la
 * unidad contra Q8 la libra es justo el error que ese candado ya cazo una vez.
 * ====================================================================== */

INV_DATOS.umbralAprobacion = 10;
INV_DATOS.hojaPorAprobar = 'PRECIOS_POR_APROBAR';
INV_DATOS.colsPorAprobar = ['FECHA', 'AREA', 'MES', 'PRODUCTO', 'PRECIO ANTERIOR', 'PRECIO NUEVO', 'VARIACION %',
                            'UNIDAD', 'PROVEEDOR', 'PROPUSO', 'ESTADO', 'RESOLVIO', 'FECHA RESOLUCION', 'CORRIDA', 'NOTA'];
INV_DATOS.vinculosConBanco = ['EXACTO', 'ALIAS', 'TIPEO', 'MANUAL'];

/**
 * ceros: true pone en 0 lo que quedo sin contar. sinPrecio: true cierra aunque haya
 * productos contados sin precio (su monto queda en Q0). Sin eso, devuelve las listas.
 */
function webInventarioCerrarMes(auth, area, mes, ceros, sinPrecio) {
  return edicionCorrer_(auth, function (u) {
    var a = areaDeLaPagina_(area, u);
    return invConCandado_(function () { return invCerrarMes_(a, String(mes || ''), !!ceros, u, !!sinPrecio); });
  }, 'inventario cerrar mes ' + area + ' ' + mes);
}

/** Lo que espera aprobacion y las tandas aplicadas. Leer lo puede cualquiera con el recetario. */
function webInventarioPrecios(auth) {
  return edicionCorrer_(auth, function (u) { return invPrecios_(u); });
}

/** pedidos: [{ fila, area, mes, producto, nuevo }], como los muestra la pantalla. */
function webInventarioResolverPrecios(auth, pedidos, aprobar) {
  return edicionCorrer_(auth, function (u) {
    invExigirDueno_(u);
    return invConCandado_(function () { return invResolverPrecios_(pedidos, !!aprobar, u); });
  }, 'inventario ' + (aprobar ? 'aprobar' : 'rechazar') + ' precios');
}

function webInventarioDeshacerPrecios(auth, corrida) {
  return edicionCorrer_(auth, function (u) {
    invExigirDueno_(u);
    var clave = String(corrida || '').trim();
    if (!/^\d{8}-\d{6}-[a-z0-9]{4}$/.test(clave)) throw new Error('Corrida invalida: "' + clave + '".');
    return invConCandado_(function () { return revertirSync_(clave, u.email, { simular: false }); });
  }, 'inventario deshacer precios ' + corrida);
}

function invExigirDueno_(u) {
  if (normalizar_(u && u.rol) !== 'dueno') throw new Error('Aprobar precios y deshacer tandas lo hace solo el rol dueno.');
}

/* ------------------------------------------------------------ cerrar ---- */

function invCerrarMes_(area, mes, ceros, u, sinPrecioOk) {
  var ss = invHojaDe_(area), ult = invUltimoMes_(ss);
  if (!ult || ult.mes !== mes) throw new Error('Solo se cierra el ultimo mes de ' + area + (ult ? ' (' + ult.mes + ')' : '') + '.');
  if (invEstado_(ult.d) !== 'ABIERTO') throw new Error('El mes ' + mes + ' ya esta cerrado.');
  var d = ult.d, h = ult.hoja, c = invColumnas_(d[INV_DATOS.filaEncabezadoMes - 1]);
  var primera = INV_DATOS.filaEncabezadoMes, filas = [], total = -1, sinContar = [], sinPrecio = [];
  for (var i = primera; i < d.length; i++) {
    var id = invTexto_(d[i][c['id']]);
    if (!id) { if (normalizar_(d[i][c['producto']]) === 'total') { total = i; break; } continue; }
    filas.push(i);
    var prod = invTexto_(d[i][c['producto']]), ex = invNumero_(d[i][c['existencia']]);
    if (ex === null) sinContar.push(prod);
    else if (ex > 0 && !(invNumero_(d[i][c['precio']]) > 0)) sinPrecio.push(prod);
  }
  if (total < 0) throw new Error('La pestana ' + mes + ' no tiene la fila TOTAL.');
  if (!filas.length) throw new Error('El mes ' + mes + ' no tiene productos.');
  // Contado y sin precio: su monto sale Q0 y el total del mes queda corto sin que nadie
  // lo note. Se pregunta, igual que lo sin contar (auditoria M6, 15-sep-2026).
  if ((sinContar.length && !ceros) || (sinPrecio.length && !sinPrecioOk)) {
    return { cerrado: false, sinContar: ceros ? [] : sinContar, sinPrecio: sinPrecioOk ? [] : sinPrecio };
  }

  // 1. precios al Banco. Va primero a proposito: si algo falla aca, el mes sigue abierto
  //    y reintentar es seguro, porque lo ya aplicado vuelve como "igual al Banco".
  //    Solo van los precios que CAMBIARON en este conteo: ver invPreciosEditados_.
  var cat = invCatalogo_(ss);
  var editados = invPreciosEditados_(ss, area, mes, d, c, filas);
  var prop = invPropuestaPrecios_(area, filas.map(function (k) { return d[k]; }), c, cat, editados);
  var corrida = '', aplicados = [];
  if (prop.auto.length) {
    corrida = aplicarSincronizacion_(area, prop.auto, u.email).corrida;
    aplicados = invHistorialPrecios_(area, prop.auto, u, 'cierre de inventario ' + mes + ' · corrida ' + corrida);
    invAnotar_(area, mes, prop.auto, u, 'AUTOMATICO', corrida, aplicados);
  }
  if (prop.aprobar.length) invAnotar_(area, mes, prop.aprobar, u, 'PENDIENTE', '', []);

  // 2. el catalogo toma el precio, el proveedor y la presentacion del mes que se cierra
  var cc = cat.c, cd = cat.d;
  filas.forEach(function (k) {
    var p = cat.porId[invTexto_(d[k][c['id']])];
    if (!p) return;
    var pr = invNumero_(d[k][c['precio']]);
    if (cc['precio actual'] != null && pr !== null) p.fila[cc['precio actual']] = pr;
    if (cc['proveedor'] != null) p.fila[cc['proveedor']] = invTexto_(d[k][c['proveedor']]);
    if (cc['presentacion'] != null) p.fila[cc['presentacion']] = invTexto_(d[k][c['presentacion']]);
    if (cc['ultimo mes'] != null) p.fila[cc['ultimo mes']] = mes;
  });
  if (cd.length > 1) {
    ['precio actual', 'proveedor', 'presentacion', 'ultimo mes'].forEach(function (k) {
      if (cc[k] == null) return;
      var rango = cat.hoja.getRange(2, cc[k] + 1, cd.length - 1, 1);
      if (k === 'ultimo mes') rango.setNumberFormat('@');
      rango.setValues(cd.slice(1).map(function (f) {
        var v = f[cc[k]];
        return [v instanceof Date ? invFecha_(v).slice(0, 7) : v];
      }));
    });
  }

  // 3. congelar: lo sin contar pasa a 0, y MONTO y TOTAL dejan de ser formula. Un mes
  //    cerrado no puede cambiar de valor porque alguien toco un precio en la hoja.
  var suma = 0;
  filas.forEach(function (k) {
    var ex = invNumero_(d[k][c['existencia']]);
    if (ex === null) { ex = 0; d[k][c['existencia']] = 0; }
    var monto = Math.round((invNumero_(d[k][c['precio']]) || 0) * ex * 100) / 100;
    d[k][c['monto']] = monto;
    suma += monto;
  });
  suma = Math.round(suma * 100) / 100;
  d[total][c['monto']] = suma;
  var alto = total - primera + 1;
  h.getRange(primera + 1, c['existencia'] + 1, alto, 1)
   .setValues(d.slice(primera, total + 1).map(function (f) { return [f[c['existencia']]]; }));
  h.getRange(primera + 1, c['monto'] + 1, alto, 1)
   .setValues(d.slice(primera, total + 1).map(function (f) { return [f[c['monto']]]; }));

  var meta = (d[0] || []).map(invTexto_);
  var jEstado = -1;
  for (var j = 0; j < meta.length - 1; j++) if (normalizar_(meta[j]) === 'estado') { jEstado = j; break; }
  if (jEstado < 0) throw new Error('La pestana ' + mes + ' no tiene ESTADO en la fila 1.');
  meta[jEstado + 1] = 'CERRADO';
  while (meta.length && meta[meta.length - 1] === '') meta.pop();
  meta = meta.concat(['CERRADO POR', (u.nombre || u.email) + ' · ' + invAhora_(), 'CORRIDA', corrida]);
  h.getRange(1, 1, 1, meta.length).setNumberFormat('@').setValues([meta]);

  bitacoraLote_([[u.email, u.rol, 'inventario cerrar mes', 'INVENTARIO ' + area, mes, 'ESTADO', 'ABIERTO', 'CERRADO',
                  'total Q' + suma + ' · ' + aplicados.length + ' precio(s) al Banco · ' + prop.aprobar.length +
                  ' por aprobar' + (sinContar.length ? ' · ' + sinContar.length + ' sin contar cerrados en 0' : '') +
                  (sinPrecio.length ? ' · ' + sinPrecio.length + ' contados sin precio (monto Q0)' : '') +
                  (corrida ? ' · corrida ' + corrida : '')]]);
  SpreadsheetApp.flush();

  olvidarAvisosDashboard_();     // el tablero avisa lo que quedo por aprobar

  // 4. el mes siguiente
  var siguiente = null, avisos = [];
  try { siguiente = invAbrirMes_(area, u).mes; }
  catch (e) { avisos.push('El mes quedo cerrado, pero no se pudo abrir el siguiente: ' + (e && e.message || e)); }

  return {
    cerrado: true, mes: mes, total: suma, sinContarEnCero: sinContar.length, sinPrecio: sinPrecio.length,
    sinEditar: prop.sinEditar, siguiente: siguiente,
    aplicados: aplicados, corrida: corrida,
    porAprobar: prop.aprobar.map(function (x) { return { producto: x.producto, de: x.precioViejo, a: x.precioNuevo, pct: x.pct }; }),
    unidadDistinta: prop.unidadDistinta, sinConectar: prop.sinConectar, iguales: prop.iguales,
    otros: prop.otros, avisos: avisos, recetario: aplicados.length > 0
  };
}

/**
 * Los productos cuyo precio CAMBIO en el conteo de este mes. { id: true }
 *
 * Auditoria A5, 15-sep-2026. Abrir el mes copia el precio del mes anterior, y el cierre
 * proponia al Banco TODO precio distinto del Banco. Si cocina corregia un precio en
 * Productos a mitad de mes, el cierre lo devolvia al valor viejo del inventario.
 * Ahora cuenta como cambiado:
 *   · un producto que estaba en el mes anterior y cuyo precio ya no es el de ese mes
 *     (da igual si se cambio en la intranet o a mano en la hoja);
 *   · uno que no estaba (alta o reactivado), solo si la BITACORA de este mes tiene su
 *     alta o un cambio de precio que no volvio al valor con que entro.
 */
function invPreciosEditados_(ss, area, mes, d, c, filas) {
  var out = {}, previo = {}, bit = null;
  var nombres = ss.getSheets().map(function (h) { return h.getName().trim(); })
                  .filter(function (n) { return /^\d{4}-\d{2}$/.test(n) && n < mes; }).sort();
  if (nombres.length) {
    var dp = ss.getSheetByName(nombres[nombres.length - 1]).getDataRange().getValues();
    var cp = invColumnas_(dp[INV_DATOS.filaEncabezadoMes - 1] || []);
    if (cp['id'] != null && cp['precio'] != null) {
      for (var i = INV_DATOS.filaEncabezadoMes; i < dp.length; i++) {
        var idp = invTexto_(dp[i][cp['id']]);
        if (idp) previo[idp] = invNumero_(dp[i][cp['precio']]);
      }
    }
  }
  filas.forEach(function (k) {
    var id = invTexto_(d[k][c['id']]), precio = invNumero_(d[k][c['precio']]);
    if (Object.prototype.hasOwnProperty.call(previo, id)) {
      if (!invMismoPrecio_(precio, previo[id])) out[id] = true;
      return;
    }
    if (bit === null) bit = invPreciosDeBitacora_(area, mes);
    var b = bit[id];
    if (b && (b.alta || !invMismoPrecio_(precio, b.antes))) out[id] = true;
  });
  return out;
}

/**
 * { id: { alta, antes } } de la BITACORA, solo de la pestana de este mes. antes es el
 * precio que tenia ANTES del primer cambio. La bitacora solo crece: sus filas estan en
 * orden de tiempo. Se leen cinco columnas, no la hoja entera.
 */
function invPreciosDeBitacora_(area, mes) {
  var out = {}, h = hojaCosteo_().getSheetByName(EDIT.hojaBitacora);
  if (!h || h.getLastRow() < 2) return out;
  var hoja = normalizar_('INVENTARIO ' + area + ' ' + mes);
  // D..H: ACCION, HOJA, REFERENCIA, CAMPO, ANTES
  h.getRange(2, 4, h.getLastRow() - 1, 5).getValues().forEach(function (f) {
    var accion = String(f[0] || '').trim();
    if (accion !== 'inventario precio' && accion !== 'inventario alta') return;
    if (normalizar_(f[1]) !== hoja) return;
    var id = String(f[2] || '').split(' · ')[0].trim();
    if (!id) return;
    var x = out[id] || (out[id] = { alta: false, antes: undefined });
    if (accion === 'inventario alta') x.alta = true;
    else if (x.antes === undefined) x.antes = invNumero_(f[4]);
  });
  return out;
}

/**
 * Que precios del mes van al Banco. NO escribe. Una sola lectura del Banco del area.
 * Devuelve { auto, aprobar, unidadDistinta, otros, sinConectar, iguales, sinEditar };
 * auto y aprobar tienen la forma que espera aplicarSincronizacion_(). editados
 * ({ id: true }) deja afuera lo que no cambio en el conteo; sin el, van todos.
 */
function invPropuestaPrecios_(area, filasMes, c, cat, editados) {
  var out = { auto: [], aprobar: [], unidadDistinta: [], otros: [], sinConectar: 0, iguales: 0, sinEditar: 0 };
  var banco = recetarioDe_(area).getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  var porNombre = {};
  for (var b = EDIT.filaPrimerDato - 1; b < banco.length; b++) {
    var kb = normalizar_(banco[b][EDIT.col.producto - 1]);
    if (kb) (porNombre[kb] = porNombre[kb] || []).push(b);
  }
  var vistos = {};
  filasMes.forEach(function (f) {
    var p = cat.porId[invTexto_(f[c['id']])];
    var tipo = p ? invTexto_(p.fila[cat.c['tipo']]) : invTexto_(f[c['tipo']]);
    if (tipo !== 'INSUMO') return;                 // preparado, reventa, limpieza: nunca
    var prod = invTexto_(f[c['producto']]);
    var vinc = p ? invTexto_(p.fila[cat.c['vinculo']]) : 'PENDIENTE';
    var nombreBanco = p ? invTexto_(p.fila[cat.c['producto en banco']]) : '';
    if (vinc === 'OTRA_AREA') { out.otros.push(prod + ': conectado al Banco de la otra area'); return; }
    if (INV_DATOS.vinculosConBanco.indexOf(vinc) === -1 || !nombreBanco) { out.sinConectar++; return; }
    var precio = invNumero_(f[c['precio']]);
    if (!(precio > 0)) return;
    if (editados && !editados[invTexto_(f[c['id']])]) { out.sinEditar++; return; }
    var k = normalizar_(nombreBanco), filasB = porNombre[k];
    if (!filasB) { out.otros.push(prod + ': "' + nombreBanco + '" ya no esta en el Banco'); return; }
    if (filasB.length > 1) { out.otros.push(prod + ': hay ' + filasB.length + ' filas "' + nombreBanco + '" en el Banco, no se adivina'); return; }
    if (vistos[k]) { out.otros.push(prod + ': otro producto del inventario ya lleva precio a "' + nombreBanco + '"'); return; }
    vistos[k] = 1;
    var fb = banco[filasB[0]];
    var fCompra = fb[EDIT.col.precioCompra - 1], dRec = fb[EDIT.col.precioReceta - 1];
    var uCompra = String(fb[EDIT.col.unidadCompra - 1] || '').trim(), pres = invTexto_(f[c['presentacion']]);
    if (typeof fCompra !== 'number' || !fCompra || typeof dRec !== 'number') {
      out.otros.push(prod + ': el Banco no tiene precio de compra o por unidad de receta');
      return;
    }
    if (!mismaUnidad_(uCompra, pres)) {
      out.unidadDistinta.push({ producto: prod, banco: nombreBanco, enBanco: 'Q' + fCompra + ' / ' + (uCompra || '?'),
                                enInventario: 'Q' + precio + ' / ' + (pres || '?') });
      return;
    }
    if (Math.abs(fCompra - precio) < 0.005) { out.iguales++; return; }
    var pct = Math.round((precio - fCompra) / fCompra * 1000) / 10;
    var cambio = { fila: filasB[0] + 1, producto: String(fb[EDIT.col.producto - 1]).trim(), precioViejo: fCompra,
                   precioNuevo: precio, unidad: uCompra, pct: pct, proveedor: '',
                   dNuevo: Math.round(precio * (dRec / fCompra) * 100000) / 100000 };
    (Math.abs(pct) < INV_DATOS.umbralAprobacion ? out.auto : out.aprobar).push(cambio);
  });
  return out;
}

/**
 * Deja cada precio que el Banco SI tomo en la pestana PRECIOS, que es de donde sale el
 * historial del panel de cada producto. Relee el Banco: aplicarSincronizacion puede
 * saltar filas, y un historial con un precio que no se aplico mentiria.
 * Devuelve los nombres que quedaron aplicados.
 */
function invHistorialPrecios_(area, cambios, u, nota) {
  var banco = recetarioDe_(area).getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  var ahora = new Date(), filas = [], hechos = [];
  cambios.forEach(function (x) {
    var fb = banco[x.fila - 1];
    if (!fb || normalizar_(fb[EDIT.col.producto - 1]) !== normalizar_(x.producto)) return;
    var f = fb[EDIT.col.precioCompra - 1];
    if (typeof f !== 'number' || Math.abs(f - x.precioNuevo) > 0.005) return;
    hechos.push(x.producto);
    filas.push([ahora, x.producto, String(fb[EDIT.col.proveedor - 1] || ''), x.precioNuevo, x.unidad, x.dNuevo, '', u.email, nota]);
  });
  if (filas.length) {
    var h = hojaCosteo_().getSheetByName(COSTEO.hojas.precios);
    if (h) h.getRange(h.getLastRow() + 1, 1, filas.length, 9).setValues(filas);
  }
  return hechos;
}

function invHojaPorAprobar_() {
  var ss = hojaCosteo_(), h = ss.getSheetByName(INV_DATOS.hojaPorAprobar), cols = INV_DATOS.colsPorAprobar;
  if (!h) {
    h = ss.insertSheet(INV_DATOS.hojaPorAprobar);
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

/**
 * Anota propuestas en PRECIOS_POR_APROBAR. Una propuesta nueva de un producto REEMPLAZA
 * a la que tuviera pendiente del mismo area: aprobar la vieja llevaria al Banco un
 * precio de un mes que ya no es el ultimo.
 */
function invAnotar_(area, mes, cambios, u, estado, corrida, hechos) {
  if (!cambios.length) return;
  var h = invHojaPorAprobar_(), cols = INV_DATOS.colsPorAprobar, ahora = new Date();
  var d = h.getDataRange().getValues(), c = invColumnas_(d[0]), nuevos = {}, tocadas = false;
  cambios.forEach(function (x) { nuevos[normalizar_(x.producto)] = 1; });
  for (var i = 1; i < d.length; i++) {
    if (invTexto_(d[i][c['estado']]).toUpperCase() !== 'PENDIENTE') continue;
    if (invTexto_(d[i][c['area']]).toUpperCase() !== area || !nuevos[normalizar_(d[i][c['producto']])]) continue;
    d[i][c['estado']] = 'REEMPLAZADO';
    d[i][c['nota']] = 'por el cierre de ' + mes;
    d[i][c['fecha resolucion']] = ahora;
    tocadas = true;
  }
  if (tocadas) {
    ['estado', 'nota', 'fecha resolucion'].forEach(function (k) {
      h.getRange(2, c[k] + 1, d.length - 1, 1).setValues(d.slice(1).map(function (f) { return [f[c[k]]]; }));
    });
  }
  var quien = u.nombre || u.email;
  var filas = cambios.map(function (x) {
    var fila = cols.map(function () { return ''; }), poner = function (k, v) { fila[cols.indexOf(k)] = v; };
    var ok = estado !== 'AUTOMATICO' || hechos.indexOf(x.producto) !== -1;
    poner('FECHA', ahora); poner('AREA', area); poner('MES', mes); poner('PRODUCTO', x.producto);
    poner('PRECIO ANTERIOR', x.precioViejo); poner('PRECIO NUEVO', x.precioNuevo); poner('VARIACION %', x.pct);
    poner('UNIDAD', x.unidad); poner('PROVEEDOR', x.proveedor || ''); poner('PROPUSO', quien);
    poner('ESTADO', ok ? estado : 'SALTADO');
    if (estado === 'AUTOMATICO') {
      poner('RESOLVIO', 'automatico: menos de ' + INV_DATOS.umbralAprobacion + '%');
      poner('FECHA RESOLUCION', ahora);
      poner('CORRIDA', corrida);
      if (!ok) poner('NOTA', 'el Banco no tomo el precio (ver SYNC_PRECIOS)');
    }
    return fila;
  });
  var r0 = h.getLastRow() + 1;
  h.getRange(r0, cols.indexOf('MES') + 1, filas.length, 1).setNumberFormat('@');
  h.getRange(r0, 1, filas.length, cols.length).setValues(filas);
}

/* ------------------------------------------------- aprobar y deshacer ---- */

/** Las filas (1-based) PENDIENTE de cada pedido, y los pedidos que ya no estan. */
function invElegirPendientes_(d, c, pedidos) {
  var filas = [], perdidos = [], usadas = {};
  var coincide = function (r, x) {
    var f = d[r - 1];
    return !!f && !usadas[r] && invTexto_(f[c['estado']]).toUpperCase() === 'PENDIENTE' &&
      invTexto_(f[c['area']]).toUpperCase() === x.area && invMesDeCelda_(f[c['mes']]) === x.mes &&
      normalizar_(f[c['producto']]) === normalizar_(x.producto) &&
      invMismoPrecio_(invNumero_(f[c['precio nuevo']]), x.nuevo);
  };
  pedidos.forEach(function (p) {
    if (!p || typeof p !== 'object') throw new Error('La lista de precios quedo vieja: recarga la pagina y volve a elegir.');
    var x = { area: String(p.area || '').trim().toUpperCase(), mes: String(p.mes || '').trim(),
              producto: String(p.producto || '').trim(), nuevo: invNumero_(p.nuevo) };
    var r = Number(p.fila);
    if (!(r >= 2 && coincide(r, x))) {
      r = -1;
      for (var i = 2; i <= d.length; i++) if (coincide(i, x)) { r = i; break; }
    }
    if (r < 0) { perdidos.push((x.producto || '?') + ': ya no esta pendiente (se resolvio o lo reemplazo otro cierre)'); return; }
    usadas[r] = 1;
    filas.push(r);
  });
  return { filas: filas, perdidos: perdidos };
}

function invPrecios_(u) {
  var out = { esDueno: normalizar_(u.rol) === 'dueno', pendientes: [], corridas: [] };
  var h = hojaCosteo_().getSheetByName(INV_DATOS.hojaPorAprobar);
  if (!h || h.getLastRow() < 2) return out;
  var d = h.getDataRange().getValues(), c = invColumnas_(d[0]), porCorrida = {}, orden = [];
  for (var i = 1; i < d.length; i++) {
    var f = d[i], estado = invTexto_(f[c['estado']]).toUpperCase(), mesV = f[c['mes']];
    var x = { fila: i + 1, area: invTexto_(f[c['area']]).toUpperCase(),
              mes: mesV instanceof Date ? invFecha_(mesV).slice(0, 7) : invTexto_(mesV),
              producto: invTexto_(f[c['producto']]), anterior: invNumero_(f[c['precio anterior']]),
              nuevo: invNumero_(f[c['precio nuevo']]), pct: invNumero_(f[c['variacion %']]),
              unidad: invTexto_(f[c['unidad']]), propuso: invTexto_(f[c['propuso']]) };
    if (estado === 'PENDIENTE') { out.pendientes.push(x); continue; }
    var corrida = invTexto_(f[c['corrida']]);
    if (!corrida || (estado !== 'AUTOMATICO' && estado !== 'APROBADO')) continue;
    if (!porCorrida[corrida]) {
      var fr = f[c['fecha resolucion']];
      porCorrida[corrida] = {
        clave: corrida, area: x.area,
        fecha: fr instanceof Date ? invFecha_(fr) + ' ' + invDos_(fr.getHours()) + ':' + invDos_(fr.getMinutes()) : invTexto_(fr),
        origen: (estado === 'AUTOMATICO' ? 'Cierre de ' : 'Aprobados de ') + x.mes + ' · ' + (x.area === 'BARRA' ? 'barra' : 'cocina') +
                (estado === 'APROBADO' ? ' · ' + invTexto_(f[c['resolvio']]) : ''),
        productos: [], vigentes: 0
      };
      orden.push(corrida);
    }
    porCorrida[corrida].productos.push(x.producto);
  }
  if (orden.length) {
    // cuantos precios de cada tanda siguen en el Banco: revertirSync_ marca las filas
    // deshechas como "OK (revertido)", asi que las que quedan en OK son las vigentes
    var sync = leerCorridas_(false);
    orden.forEach(function (k) { porCorrida[k].vigentes = sync.corridas[k] ? sync.corridas[k].ok : 0; });
  }
  out.corridas = orden.sort().reverse().slice(0, 20).map(function (k) { return porCorrida[k]; });
  return out;
}

/**
 * pedidos: [{ fila, area, mes, producto, nuevo }]. El numero de fila solo no alcanza
 * (auditoria M8): si alguien ordena o borra filas en la hoja entre que la pantalla leyo
 * y el clic, apunta a otro producto. Se busca por identidad; la fila es por donde empezar.
 */
function invResolverPrecios_(pedidos, aprobar, u) {
  var h = invHojaPorAprobar_(), d = h.getDataRange().getValues(), c = invColumnas_(d[0]);
  if (!Array.isArray(pedidos) || !pedidos.length) throw new Error('No hay precios elegidos.');
  var sel = invElegirPendientes_(d, c, pedidos);
  var ahora = new Date(), quien = u.nombre || u.email, porArea = {}, marcas = {};
  var res = { aprobados: 0, rechazados: 0, saltados: sel.perdidos, corridas: [], recetario: false };

  sel.filas.forEach(function (r) {
    var f = d[r - 1];
    if (invTexto_(f[c['estado']]).toUpperCase() !== 'PENDIENTE') return;
    if (!aprobar) { marcas[r] = ['RECHAZADO', '', '']; return; }
    var area = invTexto_(f[c['area']]).toUpperCase();
    (porArea[area] = porArea[area] || []).push(r);
  });

  Object.keys(porArea).forEach(function (area) {
    var banco = recetarioDe_(area).getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
    var cambios = [], filaDe = {};
    porArea[area].forEach(function (r) {
      var f = d[r - 1], prod = invTexto_(f[c['producto']]), k = normalizar_(prod);
      var anterior = invNumero_(f[c['precio anterior']]), nuevo = invNumero_(f[c['precio nuevo']]);
      var idx = [];
      for (var b = EDIT.filaPrimerDato - 1; b < banco.length; b++) {
        if (normalizar_(banco[b][EDIT.col.producto - 1]) === k) idx.push(b);
      }
      if (idx.length !== 1) { marcas[r] = ['SALTADO', idx.length ? 'hay varias filas con ese nombre en el Banco' : 'ya no esta en el Banco', '']; return; }
      var fb = banco[idx[0]], fCompra = fb[EDIT.col.precioCompra - 1], dRec = fb[EDIT.col.precioReceta - 1];
      if (typeof fCompra !== 'number' || anterior === null || Math.abs(fCompra - anterior) > 0.005) {
        marcas[r] = ['SALTADO', 'el precio del Banco cambio desde la propuesta (hoy Q' + fCompra + ')', ''];
        return;
      }
      if (typeof dRec !== 'number' || !fCompra || !(nuevo > 0)) { marcas[r] = ['SALTADO', 'sin factor de conversion en el Banco', '']; return; }
      var x = { fila: idx[0] + 1, producto: String(fb[EDIT.col.producto - 1]).trim(), precioViejo: fCompra, precioNuevo: nuevo,
                unidad: String(fb[EDIT.col.unidadCompra - 1] || '').trim(), proveedor: '',
                pct: Math.round((nuevo - fCompra) / fCompra * 1000) / 10,
                dNuevo: Math.round(nuevo * (dRec / fCompra) * 100000) / 100000 };
      cambios.push(x);
      filaDe[normalizar_(x.producto)] = r;
    });
    if (!cambios.length) return;
    var ap = aplicarSincronizacion_(area, cambios, u.email);
    var hechos = invHistorialPrecios_(area, cambios, u, 'aprobado por ' + quien + ' · corrida ' + ap.corrida);
    res.corridas.push(ap.corrida);
    cambios.forEach(function (x) {
      var r = filaDe[normalizar_(x.producto)];
      if (hechos.indexOf(x.producto) !== -1) { marcas[r] = ['APROBADO', '', ap.corrida]; res.aprobados++; }
      else marcas[r] = ['SALTADO', 'el Banco no tomo el precio (ver SYNC_PRECIOS)', ap.corrida];
    });
  });

  var rastro = [];
  Object.keys(marcas).forEach(function (r) {
    var m = marcas[r], f = d[r - 1];
    f[c['estado']] = m[0]; f[c['resolvio']] = quien; f[c['fecha resolucion']] = ahora;
    if (m[2]) f[c['corrida']] = m[2];
    if (m[1]) f[c['nota']] = m[1];
    if (m[0] === 'RECHAZADO') {
      res.rechazados++;
      rastro.push([u.email, u.rol, 'inventario rechazar precio', INV_DATOS.hojaPorAprobar, invTexto_(f[c['producto']]),
                   'precio compra', f[c['precio anterior']], f[c['precio nuevo']], 'rechazado: el Banco se queda con el anterior']);
    }
    if (m[0] === 'SALTADO') res.saltados.push(invTexto_(f[c['producto']]) + ': ' + m[1]);
  });
  if (Object.keys(marcas).length) {
    ['estado', 'resolvio', 'fecha resolucion', 'corrida', 'nota'].forEach(function (k) {
      h.getRange(2, c[k] + 1, d.length - 1, 1).setValues(d.slice(1).map(function (f) { return [f[c[k]]]; }));
    });
  }
  if (rastro.length) bitacoraLote_(rastro);
  SpreadsheetApp.flush();
  olvidarAvisosDashboard_();
  res.recetario = res.aprobados > 0;
  return res;
}
