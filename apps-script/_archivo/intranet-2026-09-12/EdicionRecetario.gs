/**
 * EdicionRecetario.gs — Profit OS · capa de escritura del recetario.
 *
 * Hasta ahora el modulo solo leia. Esto agrega tres cosas:
 *   1. editar recetas      (cambiar cantidades, agregar y quitar lineas, cambiar el precio)
 *   2. agregar productos   (dar de alta un insumo en el Banco de Datos)
 *   3. agregar proveedores (y ajustar precios y demas variables)
 *
 * TODA escritura queda en la hoja BITACORA con quien, cuando y el valor anterior.
 * Nada se escribe sin pasar por validar_() primero.
 *
 * Depende de ConfigCosteo.gs (COSTEO, normalizar_, abrirPorClave_, hojaCosteo_).
 */

var EDIT = {
  hojaBanco:    'BANCO DE DATOS',
  hojaBitacora: 'BITACORA',
  filaPrimerDato: 4,          // el Banco arranca en la fila 4
  // columnas del Banco
  col: { categoria:2, producto:3, precioReceta:4, unidadReceta:5,
         precioCompra:6, unidadCompra:7, conversion:8, proveedor:9 },
  // que puede hacer cada rol
  permisos: {
    chef:          ['editarCantidad','agregarLinea','quitarLinea','crearInsumo','crearProveedor','cambiarPrecio','cambiarPrecioMenu'],
    cocina:        ['editarCantidad'],
    administracion:['crearInsumo','crearProveedor','cambiarPrecio','cambiarPrecioMenu'],
    direccion:     ['editarCantidad','agregarLinea','quitarLinea','crearInsumo','crearProveedor','cambiarPrecio','cambiarPrecioMenu']
  },
  umbralSimilitud: 0.82       // arriba de esto se considera posible duplicado
};

/* ==========================================================================
   CONVERSION DE UNIDADES
   El nudo del asunto. Tres casos, y solo el tercero necesita preguntar.
   ========================================================================== */

/** Peso y volumen: equivalencia fija, no se pregunta nada. */
var UNIDADES_ESTANDAR = {
  'libra': { a:'g',  factor:453.592 },
  'lb':    { a:'g',  factor:453.592 },
  'onza':  { a:'g',  factor:28.3495 },
  'oz':    { a:'g',  factor:28.3495 },
  'kilo':  { a:'g',  factor:1000    },
  'kg':    { a:'g',  factor:1000    },
  'gramo': { a:'g',  factor:1       },
  'litro': { a:'ml', factor:1000    },
  'lt':    { a:'ml', factor:1000    },
  'galon': { a:'ml', factor:3785.41 },
  'mililitro': { a:'ml', factor:1   }
};

/**
 * Envases y atados: el contenido cambia por producto, NO hay tabla posible.
 * En el Banco actual un manojo va de 20 g (romero) a 75 g (albahaca), y un bote
 * de 100 g (polvo para hornear) a 400 g (mantequilla de mani).
 * Para estas unidades el formulario OBLIGA a capturar el contenido.
 */
var UNIDADES_ENVASE = ['manojo','atado','frasco','bote','tarro','lata','bolsa','caja',
                       'saco','bloque','pieza','paquete','rollo','bandeja','racimo'];

function tipoDeUnidad_(unidadCompra) {
  var u = normalizar_(unidadCompra);
  if (UNIDADES_ESTANDAR[u]) return 'estandar';
  for (var i = 0; i < UNIDADES_ENVASE.length; i++) {
    if (u.indexOf(UNIDADES_ENVASE[i]) === 0) return 'envase';
  }
  // "750ml", "165 ml", "8 onzas", "17.6 l": traen el contenido en el nombre
  if (/^[\d.,]+\s*(ml|l|lt|g|gr|kg|oz|onzas?)\b/.test(u)) return 'rotulada';
  return 'directa';   // unidad = unidad, factor 1
}

/**
 * Cuantas unidades de receta trae una unidad de compra.
 * `contenido` solo hace falta cuando tipoDeUnidad_ devuelve 'envase'.
 * Devuelve { ok, factor, motivo }.
 */
function factorConversion_(unidadCompra, unidadReceta, contenido) {
  var uc = normalizar_(unidadCompra), ur = normalizar_(unidadReceta);
  if (uc === ur) return { ok:true, factor:1 };

  var tipo = tipoDeUnidad_(uc);

  if (tipo === 'estandar') {
    var e = UNIDADES_ESTANDAR[uc];
    if (e.a !== ur) {
      return { ok:false, motivo:'Se compra en ' + unidadCompra + ' (peso) y la receta pide ' +
               unidadReceta + '. No se puede convertir peso a volumen sin la densidad.' };
    }
    return { ok:true, factor:e.factor };
  }

  if (tipo === 'rotulada') {
    var m = uc.match(/^([\d.,]+)\s*(ml|l|lt|g|gr|kg|oz|onzas?)/);
    var n = parseFloat(String(m[1]).replace(',', '.')), u2 = m[2];
    var f = n;
    if (u2 === 'l' || u2 === 'lt') f = n * 1000;
    if (u2 === 'kg') f = n * 1000;
    if (u2 === 'oz' || u2.indexOf('onza') === 0) f = n * 28.3495;
    return { ok:true, factor:f };
  }

  if (tipo === 'envase') {
    if (!contenido || !(contenido > 0)) {
      return { ok:false, requiereContenido:true,
               motivo:'Falta el contenido: cuantos ' + unidadReceta + ' trae un ' + unidadCompra +
                      '. No se puede asumir — en el Banco un manojo va de 20 a 75 gramos segun la hierba.' };
    }
    return { ok:true, factor:Number(contenido) };
  }

  if (!contenido || !(contenido > 0)) {
    return { ok:false, requiereContenido:true,
             motivo:'Falta el contenido: cuantos ' + unidadReceta + ' trae un ' + unidadCompra + '.' };
  }
  return { ok:true, factor:Number(contenido) };
}

/**
 * Valores tipicos de una unidad de envase, sacados de los insumos que ya existen.
 * Es una AYUDA para quien captura, no un valor que se aplique solo.
 */
function contenidosTipicos_(unidadCompra, unidadReceta) {
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var f = ss.getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  var uc = normalizar_(unidadCompra), ur = normalizar_(unidadReceta), out = [];
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    if (normalizar_(f[i][EDIT.col.unidadCompra - 1]) !== uc) continue;
    if (normalizar_(f[i][EDIT.col.unidadReceta - 1]) !== ur) continue;
    var d = f[i][EDIT.col.precioReceta - 1], p = f[i][EDIT.col.precioCompra - 1];
    if (typeof d !== 'number' || typeof p !== 'number' || !d) continue;
    out.push({ producto: String(f[i][EDIT.col.producto - 1]).trim(),
               contenido: Math.round(p / d * 10) / 10 });
  }
  out.sort(function (a, b) { return b.contenido - a.contenido; });
  return out;
}

/* ==========================================================================
   DUPLICADOS
   El Banco ya tiene "Perejil" y "Prejil", "Alcaparras Baby" y "Alcaparras Babe".
   Sin este chequeo se multiplican.
   ========================================================================== */

function similitud_(a, b) {
  a = normalizar_(a); b = normalizar_(b);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  var largo = Math.max(a.length, b.length);
  var m = [];
  for (var i = 0; i <= a.length; i++) m[i] = [i];
  for (var j = 0; j <= b.length; j++) m[0][j] = j;
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1,
                         m[i-1][j-1] + (a.charAt(i-1) === b.charAt(j-1) ? 0 : 1));
    }
  }
  return 1 - m[a.length][b.length] / largo;
}

/** Insumos parecidos a `nombre`. Se le muestran a quien captura ANTES de crear. */
function buscarSimilares_(nombre) {
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var f = ss.getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  var out = [];
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    var p = f[i][EDIT.col.producto - 1];
    if (!p) continue;
    var s = similitud_(nombre, p);
    if (s >= EDIT.umbralSimilitud) {
      out.push({ fila: i + 1, producto: String(p).trim(), similitud: Math.round(s * 100),
                 precio: f[i][EDIT.col.precioCompra - 1],
                 unidad: String(f[i][EDIT.col.unidadCompra - 1] || '').trim() });
    }
  }
  out.sort(function (a, b) { return b.similitud - a.similitud; });
  return out;
}

/* ==========================================================================
   PERMISOS Y BITACORA
   ========================================================================== */

function puede_(rol, accion) {
  var lista = EDIT.permisos[normalizar_(rol)] || [];
  return lista.indexOf(accion) >= 0;
}

function exigirPermiso_(rol, accion) {
  if (!puede_(rol, accion)) {
    throw new Error('El rol "' + rol + '" no puede ' + accion + '.');
  }
}

function bitacora_(quien, rol, accion, hoja, referencia, campo, antes, despues, nota) {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(EDIT.hojaBitacora);
  if (!h) {
    h = ss.insertSheet(EDIT.hojaBitacora);
    h.appendRow(['FECHA','QUIEN','ROL','ACCION','HOJA','REFERENCIA','CAMPO','ANTES','DESPUES','NOTA']);
    h.setFrozenRows(1);
  }
  h.appendRow([new Date(), quien || '', rol || '', accion, hoja, referencia,
               campo || '', antes === undefined ? '' : antes,
               despues === undefined ? '' : despues, nota || '']);
}

function invalidarCache_() {
  var c = CacheService.getScriptCache();
  c.remove(COSTEO.cacheKey);
  try { c.remove(POS_CFG.cacheKey); } catch (e) {}
}

/* ==========================================================================
   1. EDITAR RECETAS
   ========================================================================== */

/** Localiza el bloque de ingredientes de una ficha: { colBase, filaHeader, filaSubtotal }. */
function bloqueFicha_(hoja) {
  var f = hoja.getDataRange().getValues(), header = null, colBase = null, subtotal = null;
  for (var i = 0; i < Math.min(f.length, 45); i++) {
    for (var c = 0; c < 3; c++) {
      var v = normalizar_(f[i][c]);
      if (v === 'ingrediente' && header === null) { header = i + 1; colBase = c + 1; }
      if (v.indexOf('subtotal') === 0 && subtotal === null) subtotal = i + 1;
    }
  }
  if (header === null || subtotal === null) throw new Error('No pude ubicar el bloque de ingredientes en "' + hoja.getName() + '".');
  return { colBase: colBase, filaHeader: header, filaSubtotal: subtotal };
}

/** Cambia la cantidad de una linea. Es lo unico que puede hacer cocina. */
function editarCantidad(ficha, fila, cantidadNueva, quien, rol) {
  exigirPermiso_(rol, 'editarCantidad');
  if (!(cantidadNueva > 0)) throw new Error('La cantidad tiene que ser mayor que cero.');
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(ficha);
  if (!h) throw new Error('No existe la ficha "' + ficha + '".');
  var b = bloqueFicha_(h);
  if (fila <= b.filaHeader || fila >= b.filaSubtotal) throw new Error('La fila ' + fila + ' no es una linea de ingrediente.');

  var producto = h.getRange(fila, b.colBase).getValue();
  if (!producto) throw new Error('La fila ' + fila + ' esta vacia.');
  var antes = h.getRange(fila, b.colBase + 1).getValue();
  h.getRange(fila, b.colBase + 1).setValue(cantidadNueva);

  bitacora_(quien, rol, 'editarCantidad', ficha, String(producto), 'cantidad', antes, cantidadNueva, '');
  invalidarCache_();
  return { ok:true, producto:String(producto), antes:antes, despues:cantidadNueva };
}

/** Agrega una linea. El producto TIENE que existir en el Banco. */
function agregarLinea(ficha, producto, cantidad, unidad, quien, rol) {
  exigirPermiso_(rol, 'agregarLinea');
  if (!(cantidad > 0)) throw new Error('La cantidad tiene que ser mayor que cero.');

  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var banco = ss.getSheetByName(EDIT.hojaBanco).getDataRange().getValues();
  var encontrado = null;
  for (var i = EDIT.filaPrimerDato - 1; i < banco.length; i++) {
    if (normalizar_(banco[i][EDIT.col.producto - 1]) === normalizar_(producto)) {
      encontrado = { nombre: String(banco[i][EDIT.col.producto - 1]).trim(),
                     unidad: String(banco[i][EDIT.col.unidadReceta - 1] || '').trim() };
      break;
    }
  }
  if (!encontrado) {
    throw new Error('"' + producto + '" no esta en el Banco de Datos. Primero hay que darlo de alta como producto.');
  }

  var h = ss.getSheetByName(ficha);
  if (!h) throw new Error('No existe la ficha "' + ficha + '".');
  var b = bloqueFicha_(h);

  // primera fila libre entre el header y el subtotal
  var destino = null;
  for (var r = b.filaHeader + 1; r < b.filaSubtotal; r++) {
    if (!h.getRange(r, b.colBase).getValue()) { destino = r; break; }
  }
  if (!destino) {
    h.insertRowBefore(b.filaSubtotal);
    destino = b.filaSubtotal;
  }

  h.getRange(destino, b.colBase).setValue(encontrado.nombre);
  h.getRange(destino, b.colBase + 1).setValue(cantidad);
  h.getRange(destino, b.colBase + 2).setValue(unidad || encontrado.unidad);
  // la formula de precio: la misma que usan todas las fichas
  h.getRange(destino, b.colBase + 3).setFormula(
    "=IFERROR(VLOOKUP(" + h.getRange(destino, b.colBase).getA1Notation() +
    ",'" + EDIT.hojaBanco + "'!$C:$D,2,0),\"\")");
  h.getRange(destino, b.colBase + 4).setFormula(
    "=IF(OR(" + h.getRange(destino, b.colBase + 1).getA1Notation() + "=\"\"," +
    h.getRange(destino, b.colBase + 3).getA1Notation() + "=\"\"),\"\"," +
    h.getRange(destino, b.colBase + 1).getA1Notation() + "*" +
    h.getRange(destino, b.colBase + 3).getA1Notation() + ")");

  bitacora_(quien, rol, 'agregarLinea', ficha, encontrado.nombre, 'linea', '',
            cantidad + ' ' + (unidad || encontrado.unidad), 'fila ' + destino);
  invalidarCache_();
  return { ok:true, fila:destino, producto:encontrado.nombre };
}

/** Quita una linea. Deja el rastro en la bitacora. */
function quitarLinea(ficha, fila, quien, rol) {
  exigirPermiso_(rol, 'quitarLinea');
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(ficha);
  if (!h) throw new Error('No existe la ficha "' + ficha + '".');
  var b = bloqueFicha_(h);
  if (fila <= b.filaHeader || fila >= b.filaSubtotal) throw new Error('La fila ' + fila + ' no es una linea de ingrediente.');

  var producto = h.getRange(fila, b.colBase).getValue();
  var cantidad = h.getRange(fila, b.colBase + 1).getValue();
  if (!producto) throw new Error('La fila ' + fila + ' ya esta vacia.');
  for (var c = 0; c < 5; c++) h.getRange(fila, b.colBase + c).clearContent();

  bitacora_(quien, rol, 'quitarLinea', ficha, String(producto), 'linea', cantidad, '', 'fila ' + fila);
  invalidarCache_();
  return { ok:true, producto:String(producto) };
}

/** Cambia el precio de carta de un plato. */
function cambiarPrecioMenu(ficha, precioNuevo, quien, rol, motivo) {
  exigirPermiso_(rol, 'cambiarPrecioMenu');
  if (!(precioNuevo > 0)) throw new Error('El precio tiene que ser mayor que cero.');
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(ficha);
  if (!h) throw new Error('No existe la ficha "' + ficha + '".');
  var f = h.getDataRange().getValues(), fila = null, col = null;
  for (var i = 0; i < Math.min(f.length, 8); i++) {
    for (var c = 0; c < 5; c++) {
      if (normalizar_(f[i][c]).indexOf('precio menu') === 0) {
        for (var k = c + 1; k < 6; k++) {
          if (typeof f[i][k] === 'number') { fila = i + 1; col = k + 1; break; }
        }
      }
    }
  }
  if (!fila) throw new Error('No encontre el PRECIO MENU en "' + ficha + '".');
  var antes = h.getRange(fila, col).getValue();
  h.getRange(fila, col).setValue(precioNuevo);
  bitacora_(quien, rol, 'cambiarPrecioMenu', ficha, ficha, 'precio menu', antes, precioNuevo, motivo || '');
  invalidarCache_();
  return { ok:true, antes:antes, despues:precioNuevo };
}

/* ==========================================================================
   2. AGREGAR PRODUCTOS
   ========================================================================== */

/**
 * Da de alta un insumo en el Banco de Datos.
 * datos = { categoria, producto, precioCompra, unidadCompra, unidadReceta, contenido, proveedor }
 * `contenido` solo hace falta si la unidad de compra es un envase.
 *
 * Si hay nombres parecidos y no se manda confirmar:true, NO crea: devuelve los similares.
 */
function crearInsumo(datos, quien, rol, confirmar) {
  exigirPermiso_(rol, 'crearInsumo');
  if (!datos || !datos.producto) throw new Error('Falta el nombre del producto.');
  if (!(datos.precioCompra > 0)) throw new Error('El precio de compra tiene que ser mayor que cero.');
  if (!datos.unidadCompra)  throw new Error('Falta la unidad de compra.');
  if (!datos.unidadReceta)  throw new Error('Falta la unidad de receta.');

  var similares = buscarSimilares_(datos.producto);
  if (similares.length && !confirmar) {
    return { ok:false, motivo:'posible duplicado', similares:similares };
  }

  var conv = factorConversion_(datos.unidadCompra, datos.unidadReceta, datos.contenido);
  if (!conv.ok) {
    return { ok:false, motivo:conv.motivo, requiereContenido: !!conv.requiereContenido,
             tipicos: conv.requiereContenido ? contenidosTipicos_(datos.unidadCompra, datos.unidadReceta) : [] };
  }

  var precioReceta = datos.precioCompra / conv.factor;
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(EDIT.hojaBanco);
  var fila = h.getLastRow() + 1;

  h.getRange(fila, EDIT.col.categoria).setValue(datos.categoria || 'SIN CATEGORIA');
  h.getRange(fila, EDIT.col.producto).setValue(String(datos.producto).trim());
  h.getRange(fila, EDIT.col.precioReceta).setValue(Math.round(precioReceta * 100000) / 100000);
  h.getRange(fila, EDIT.col.unidadReceta).setValue(datos.unidadReceta);
  h.getRange(fila, EDIT.col.precioCompra).setValue(datos.precioCompra);
  h.getRange(fila, EDIT.col.unidadCompra).setValue(datos.unidadCompra);
  h.getRange(fila, EDIT.col.conversion).setValue(
    'Q' + datos.precioCompra + ' / ' + conv.factor + ' ' + datos.unidadReceta +
    ' por ' + datos.unidadCompra + ' · alta ' +
    Utilities.formatDate(new Date(), 'America/Guatemala', 'dd-MMM-yyyy'));
  h.getRange(fila, EDIT.col.proveedor).setValue(datos.proveedor || '');

  bitacora_(quien, rol, 'crearInsumo', EDIT.hojaBanco, String(datos.producto).trim(), 'alta', '',
            'Q' + datos.precioCompra + ' / ' + datos.unidadCompra,
            'factor ' + conv.factor + (similares.length ? ' · se confirmo pese a ' + similares.length + ' parecidos' : ''));
  invalidarCache_();
  return { ok:true, fila:fila, precioReceta:precioReceta, factor:conv.factor };
}

/** Cambia el precio de compra de un insumo y recalcula su precio por unidad de receta. */
function cambiarPrecioInsumo(producto, precioNuevo, quien, rol, motivo) {
  exigirPermiso_(rol, 'cambiarPrecio');
  if (!(precioNuevo > 0)) throw new Error('El precio tiene que ser mayor que cero.');
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(EDIT.hojaBanco);
  var f = h.getDataRange().getValues(), fila = null;
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    if (normalizar_(f[i][EDIT.col.producto - 1]) === normalizar_(producto)) { fila = i + 1; break; }
  }
  if (!fila) throw new Error('"' + producto + '" no esta en el Banco de Datos.');

  var antesCompra = h.getRange(fila, EDIT.col.precioCompra).getValue();
  var antesReceta = h.getRange(fila, EDIT.col.precioReceta).getValue();
  // se conserva el factor, igual que registrarPrecio en Proveedores.gs
  var factor = (antesCompra && antesCompra !== 0) ? (antesReceta / antesCompra) : null;
  if (factor === null) throw new Error('No puedo conservar la conversion de "' + producto + '": el precio anterior es cero.');

  h.getRange(fila, EDIT.col.precioCompra).setValue(precioNuevo);
  h.getRange(fila, EDIT.col.precioReceta).setValue(Math.round(precioNuevo * factor * 100000) / 100000);

  var pct = antesCompra ? Math.round((precioNuevo - antesCompra) / antesCompra * 1000) / 10 : 0;
  bitacora_(quien, rol, 'cambiarPrecio', EDIT.hojaBanco, String(producto), 'precio compra',
            antesCompra, precioNuevo, (pct >= 0 ? '+' : '') + pct + '%' + (motivo ? ' · ' + motivo : ''));
  invalidarCache_();
  return { ok:true, antes:antesCompra, despues:precioNuevo, variacion:pct };
}

/* ==========================================================================
   3. AGREGAR PROVEEDORES
   ========================================================================== */

/**
 * Da de alta un proveedor. Chequea parecidos igual que los insumos:
 * hoy conviven "Los Alpes" y "DISTRIBUIDORA DE ALIMENTOS LOS ALPES",
 * y "Licorera", "LICORERA" y "LICORERA NACIONAL".
 */
function crearProveedor(datos, quien, rol, confirmar) {
  exigirPermiso_(rol, 'crearProveedor');
  if (!datos || !datos.nombre) throw new Error('Falta el nombre del proveedor.');

  var ss = hojaCosteo_();
  var h = ss.getSheetByName(COSTEO.hojas.proveedores);
  if (!h) {
    h = ss.insertSheet(COSTEO.hojas.proveedores);
    h.appendRow(['PROVEEDOR','NIT','CONTACTO','TELEFONO','CORREO','DIAS DE ENTREGA','NOTA','ALTA']);
    h.setFrozenRows(1);
  }
  var f = h.getDataRange().getValues(), similares = [];
  for (var i = 1; i < f.length; i++) {
    if (!f[i][0]) continue;
    var s = similitud_(datos.nombre, f[i][0]);
    if (s >= 0.72) similares.push({ fila:i + 1, nombre:String(f[i][0]).trim(), similitud:Math.round(s * 100) });
  }
  if (similares.length && !confirmar) {
    return { ok:false, motivo:'posible duplicado', similares:similares };
  }

  h.appendRow([String(datos.nombre).trim(), datos.nit || '', datos.contacto || '',
               datos.telefono || '', datos.correo || '', datos.diasEntrega || '',
               datos.nota || '', new Date()]);

  bitacora_(quien, rol, 'crearProveedor', COSTEO.hojas.proveedores, String(datos.nombre).trim(),
            'alta', '', datos.nit || '', similares.length ? 'se confirmo pese a ' + similares.length + ' parecidos' : '');
  invalidarCache_();
  return { ok:true };
}

/** Asigna o cambia el proveedor de un insumo. */
function asignarProveedor(producto, proveedor, quien, rol) {
  exigirPermiso_(rol, 'crearProveedor');
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(EDIT.hojaBanco);
  var f = h.getDataRange().getValues(), fila = null;
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    if (normalizar_(f[i][EDIT.col.producto - 1]) === normalizar_(producto)) { fila = i + 1; break; }
  }
  if (!fila) throw new Error('"' + producto + '" no esta en el Banco de Datos.');
  var antes = h.getRange(fila, EDIT.col.proveedor).getValue();
  h.getRange(fila, EDIT.col.proveedor).setValue(proveedor);
  bitacora_(quien, rol, 'asignarProveedor', EDIT.hojaBanco, String(producto), 'proveedor', antes, proveedor, '');
  invalidarCache_();
  return { ok:true, antes:antes, despues:proveedor };
}

/* ==========================================================================
   PRUEBAS
   ========================================================================== */

function probarEdicion() {
  Logger.log('--- conversion ---');
  [['Libra','g',null],['Onza','g',null],['Litro','ml',null],['750ml','ml',null],
   ['Manojo','g',null],['Manojo','g',50],['Unidad','unidad',null],['Libra','ml',null]].forEach(function (c) {
    var r = factorConversion_(c[0], c[1], c[2]);
    Logger.log('  %s -> %s (contenido %s):  %s', c[0], c[1], c[2],
               r.ok ? ('factor ' + r.factor) : ('BLOQUEA · ' + r.motivo));
  });

  Logger.log('--- duplicados ---');
  ['Perejil','Alcaparras Baby','Cilantro fresco','Xylitol'].forEach(function (n) {
    var s = buscarSimilares_(n);
    Logger.log('  "%s": %s parecidos %s', n, s.length,
               s.length ? JSON.stringify(s.slice(0, 3)) : '');
  });

  Logger.log('--- permisos ---');
  ['chef','cocina','administracion'].forEach(function (rol) {
    Logger.log('  %s: editarCantidad=%s crearInsumo=%s crearProveedor=%s',
               rol, puede_(rol, 'editarCantidad'), puede_(rol, 'crearInsumo'), puede_(rol, 'crearProveedor'));
  });
}
