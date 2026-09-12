/**
 * SincronizarPrecios.gs — Profit OS · sincronizacion del Banco de Datos con el cierre mensual.
 *
 * Que resuelve: entre mayo y julio 2026 el lomito subio 19% y el brisket 21%, y el
 * recetario no se entero durante dos meses. Esto lee la pestana PRECIO PROVEEDORES del
 * cierre de inventario y actualiza el Banco, guardando el historico.
 *
 * NO escribe nada por su cuenta. sincronizarPreciosDeCierre() devuelve una propuesta;
 * hay que aprobarla y recien ahi aplicarSincronizacion() escribe.
 *
 * Depende de ConfigCosteo.gs (COSTEO, normalizar_, abrirPorClave_, hojaCosteo_).
 *
 * Propiedad de script nueva:
 *   INVENTARIO_CIERRE_SHEET_ID -> hoja NATIVA del cierre del mes en curso
 *   (los cierres llegan como .xlsx; usar convertirCierreANativa_() una vez por mes)
 */

var SYNC = {
  hojaPrecios: 'PRECIO PROVEEDORES',
  colProducto: 2,          // C — PRODUCTO
  colAnterior: 3,          // D — PRECIO ANTERIOR
  colActual:   4,          // E — PRECIO ACTUALIZADO
  colPresenta: 5,          // F — PRESENTACION
  colProveedor:6,          // G — PROVEEDOR
  alertaPct:   10,         // se marca todo movimiento de +-10% o mas
  hojaLog:     'SYNC_PRECIOS'
};

/** Equivalencias de unidad. Si no coinciden, NO se toca el precio: se reporta. */
function mismaUnidad_(a, b) {
  var na = normalizar_(a).replace(/\s+/g, '');
  var nb = normalizar_(b).replace(/\s+/g, '');
  if (na === nb) return true;
  // OJO: nada de alias de una sola letra. 'l' para litro hacia que 'libra' entrara
  // en el grupo de litro y el candado dejaba pasar una conversion equivocada.
  var grupos = [
    ['libra', 'libras', 'lb'],
    ['unidad', 'unidades', 'unida', 'pieza', 'piezas'],
    ['litro', 'litros', 'lt'],
    ['mililitro', 'ml'],
    ['gramo', 'gramos', 'gr'],
    ['manojo', 'manojos', 'atado'],
    ['onza', 'onzas'],
    ['frasco', 'frascos', 'bote', 'botes', 'tarro', 'tarros'],
    ['galon', 'galones'],
    ['lata', 'latas'],
    ['caja', 'cajas'],
    ['bolsa', 'bolsas'],
    ['saco', 'sacos'],
    ['rollo', 'rollos']
  ];
  for (var i = 0; i < grupos.length; i++) {
    var g = grupos[i], ha = false, hb = false;
    for (var j = 0; j < g.length; j++) {
      if (na.indexOf(g[j]) === 0) ha = true;
      if (nb.indexOf(g[j]) === 0) hb = true;
    }
    if (ha && hb) return true;
  }
  return false;
}

/**
 * Compara el Banco de Datos contra la pestana PRECIO PROVEEDORES del cierre.
 * Devuelve { cambios:[], alertas:[], unidadDistinta:[], sinMatch:[], resumen:{} }.
 * NO escribe.
 */
function sincronizarPreciosDeCierre(area) {
  area = area || 'COCINA';
  var cfg = null;
  for (var i = 0; i < COSTEO.areas.length; i++) if (COSTEO.areas[i].area === area) cfg = COSTEO.areas[i];
  if (!cfg) throw new Error('Area desconocida: ' + area);

  var ssRec = abrirPorClave_(cfg.clave);
  if (!ssRec) throw new Error('Falta la propiedad ' + cfg.clave);
  var ssInv = abrirPorClave_('INVENTARIO_CIERRE_SHEET_ID');
  if (!ssInv) throw new Error('Falta INVENTARIO_CIERRE_SHEET_ID. Convertí el cierre del mes con convertirCierreANativa_().');

  var hInv = ssInv.getSheetByName(SYNC.hojaPrecios);
  if (!hInv) throw new Error('El cierre no tiene la pestana "' + SYNC.hojaPrecios + '".');
  var inv = {};
  var filasInv = hInv.getDataRange().getValues();
  for (var r = 0; r < filasInv.length; r++) {
    var f = filasInv[r];
    var prod = String(f[SYNC.colProducto] || '').trim();
    var precio = f[SYNC.colActual];
    if (!prod || typeof precio !== 'number' || !precio) continue;
    if (normalizar_(prod) === 'producto') continue;          // encabezados repetidos por seccion
    inv[normalizar_(prod)] = {
      nombre: prod,
      precio: precio,
      anterior: (typeof f[SYNC.colAnterior] === 'number') ? f[SYNC.colAnterior] : null,
      unidad: String(f[SYNC.colPresenta] || '').trim(),
      proveedor: String(f[SYNC.colProveedor] || '').trim()
    };
  }

  var hBanco = ssRec.getSheetByName('BANCO DE DATOS');
  if (!hBanco) throw new Error('El recetario no tiene BANCO DE DATOS.');
  var banco = hBanco.getDataRange().getValues();

  var out = { cambios: [], alertas: [], unidadDistinta: [], sinMatch: [], iguales: 0, resumen: {} };
  var vistos = {};

  for (var b = 3; b < banco.length; b++) {            // fila 4 en adelante
    var fila = banco[b];
    var producto = String(fila[2] || '').trim();      // C
    if (!producto) continue;
    var k = normalizar_(producto);
    var m = inv[k];
    if (!m) continue;
    vistos[k] = true;

    var dRec = fila[3];                               // D — precio por unidad de receta
    var uRec = String(fila[4] || '').trim();          // E
    var fCompra = fila[5];                            // F — precio de compra
    var gUnidad = String(fila[6] || '').trim();       // G — unidad de compra

    if (typeof fCompra !== 'number' || !fCompra) continue;

    // CANDADO 1: si la unidad no coincide, no se toca. Asi se cazo el camote
    // (Q20/unidad en el Banco contra Q8/libra en el inventario).
    if (!mismaUnidad_(gUnidad, m.unidad)) {
      out.unidadDistinta.push({
        fila: b + 1, producto: producto,
        banco: fCompra + ' / ' + gUnidad,
        cierre: m.precio + ' / ' + m.unidad
      });
      continue;
    }

    if (Math.abs(fCompra - m.precio) < 0.005) { out.iguales++; continue; }

    // Se conserva el factor de conversion, igual que registrarPrecio en Proveedores.gs.
    var factor = (typeof dRec === 'number' && fCompra) ? (dRec / fCompra) : null;
    if (factor === null) {
      out.sinMatch.push({ fila: b + 1, producto: producto, motivo: 'sin precio por unidad de receta' });
      continue;
    }

    var pct = (m.precio - fCompra) / fCompra * 100;
    var cambio = {
      fila: b + 1,
      producto: producto,
      precioViejo: fCompra,
      precioNuevo: m.precio,
      unidad: gUnidad,
      unidadReceta: uRec,
      dViejo: dRec,
      dNuevo: Math.round(m.precio * factor * 100000) / 100000,
      pct: Math.round(pct * 10) / 10,
      proveedor: m.proveedor
    };
    out.cambios.push(cambio);
    if (Math.abs(pct) >= SYNC.alertaPct) out.alertas.push(cambio);
  }

  for (var kk in inv) if (!vistos[kk]) out.sinMatch.push({ producto: inv[kk].nombre, motivo: 'no existe en el Banco' });

  out.resumen = {
    area: area,
    enElCierre: Object.keys(inv).length,
    cambian: out.cambios.length,
    alertas: out.alertas.length,
    unidadDistinta: out.unidadDistinta.length,
    sinMatch: out.sinMatch.length,
    iguales: out.iguales
  };
  return out;
}

/**
 * Escribe los cambios aprobados y deja el historico.
 * `cambios` es el arreglo que devolvio sincronizarPreciosDeCierre (o un subconjunto).
 */
function aplicarSincronizacion(area, cambios, quien) {
  if (!cambios || !cambios.length) return { escritos: 0 };
  area = area || 'COCINA';
  var cfg = null;
  for (var i = 0; i < COSTEO.areas.length; i++) if (COSTEO.areas[i].area === area) cfg = COSTEO.areas[i];
  var ssRec = abrirPorClave_(cfg.clave);
  var hBanco = ssRec.getSheetByName('BANCO DE DATOS');

  var stamp = new Date();
  var log = [];
  for (var c = 0; c < cambios.length; c++) {
    var x = cambios[c];

    // CANDADO 2: se relee la fila antes de escribir. Si alguien la movio, se salta.
    var actual = hBanco.getRange(x.fila, 3, 1, 5).getValues()[0];  // C..G
    if (normalizar_(actual[0]) !== normalizar_(x.producto)) {
      log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
                quien || '', 'SALTADO: la fila ' + x.fila + ' ya no es ese producto']);
      continue;
    }
    if (typeof actual[3] === 'number' && Math.abs(actual[3] - x.precioViejo) > 0.005) {
      log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
                quien || '', 'SALTADO: el precio cambio desde la propuesta']);
      continue;
    }

    hBanco.getRange(x.fila, 4).setValue(x.dNuevo);      // D
    hBanco.getRange(x.fila, 6).setValue(x.precioNuevo); // F
    if (x.proveedor) hBanco.getRange(x.fila, 9).setValue(x.proveedor); // I
    log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
              quien || '', 'OK']);
  }

  var ssC = hojaCosteo_();
  var hLog = ssC.getSheetByName(SYNC.hojaLog);
  if (!hLog) {
    hLog = ssC.insertSheet(SYNC.hojaLog);
    hLog.appendRow(['FECHA','AREA','PRODUCTO','PRECIO ANTERIOR','PRECIO NUEVO','VARIACION %','PROVEEDOR','QUIEN','RESULTADO']);
    hLog.setFrozenRows(1);
  }
  hLog.getRange(hLog.getLastRow() + 1, 1, log.length, 9).setValues(log);

  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  var ok = 0;
  for (var j = 0; j < log.length; j++) if (log[j][8] === 'OK') ok++;
  return { escritos: ok, saltados: log.length - ok };
}

/**
 * Convierte el .xlsx del cierre a hoja nativa y guarda su ID.
 * Correr una vez al mes, despues del cierre.
 */
function convertirCierreANativa_(fileIdXlsx, nombre) {
  var recurso = {
    title: nombre || ('CIERRE ' + Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM')),
    mimeType: MimeType.GOOGLE_SHEETS
  };
  var copia = Drive.Files.copy(recurso, fileIdXlsx, { convert: true });
  PropertiesService.getScriptProperties().setProperty('INVENTARIO_CIERRE_SHEET_ID', copia.id);
  return copia.id;
}

/** Prueba de escritorio. Corre la comparacion y escribe el resultado en el Log. */
function probarSincronizacion() {
  var r = sincronizarPreciosDeCierre('COCINA');
  Logger.log('RESUMEN %s', JSON.stringify(r.resumen));
  Logger.log('--- cambian (%s) ---', r.cambios.length);
  r.cambios.forEach(function (c) {
    Logger.log('  %s  Q%s -> Q%s / %s  (%s%%)', c.producto, c.precioViejo, c.precioNuevo, c.unidad, c.pct);
  });
  Logger.log('--- alertas de %s%% o mas (%s) ---', SYNC.alertaPct, r.alertas.length);
  r.alertas.forEach(function (c) { Logger.log('  %s  %s%%', c.producto, c.pct); });
  Logger.log('--- unidad distinta, NO se tocan (%s) ---', r.unidadDistinta.length);
  r.unidadDistinta.forEach(function (c) {
    Logger.log('  %s  banco: %s   cierre: %s', c.producto, c.banco, c.cierre);
  });
  Logger.log('sin match: %s   |   iguales: %s', r.sinMatch.length, r.iguales);
}
