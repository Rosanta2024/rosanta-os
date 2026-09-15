/**
 * SincronizarPrecios.gs — Profit OS · sincronizacion del Banco de Datos con el cierre mensual.
 *
 * Que resuelve: entre mayo y julio 2026 el lomito subio 19% y el brisket 21%, y el
 * recetario no se entero durante dos meses. Esto lee la pestana PRECIO PROVEEDORES del
 * cierre de inventario y actualiza el Banco, guardando el historico.
 *
 * NO escribe nada por su cuenta. sincronizarPreciosDeCierre_() devuelve una propuesta;
 * hay que aprobarla y recien ahi aplicarSincronizacion_() escribe.
 *
 * Depende de ConfigCosteo.gs (COSTEO, normalizar_, abrirPorClave_, hojaCosteo_).
 *
 * Propiedad de script nueva:
 *   INVENTARIO_CIERRE_SHEET_ID -> hoja NATIVA del cierre del mes en curso
 *   (los cierres llegan como .xlsx; usar convertirCierreANativa_() una vez por mes)
 *
 * Requiere el servicio avanzado de Drive. Este proyecto lo tiene en v3.
 */

var SYNC = {
  hojaPrecios: 'PRECIO PROVEEDORES',
  colProducto: 2,          // C — PRODUCTO
  colAnterior: 3,          // D — PRECIO ANTERIOR
  colActual:   4,          // E — PRECIO ACTUALIZADO
  colPresenta: 5,          // F — PRESENTACION
  colProveedor:6,          // G — PROVEEDOR
  alertaPct:   10,         // se marca todo movimiento de +-10% o mas
  hojaLog:     'SYNC_PRECIOS',

  // El log nacio con 9 columnas y ya tiene datos reales (la corrida del 24 ago).
  // Las tres ultimas se agregaron despues, para poder DESHACER. Van AL FINAL a
  // proposito: asi los indices 0..8 no se mueven y lo que ya leia el log por
  // posicion sigue sirviendo.
  //   D ANTERIOR / PROVEEDOR ANTERIOR — sin esto revertir solo podia devolver el
  //     precio de compra y dejaba las otras dos celdas con el valor nuevo.
  //   CORRIDA — el identificador. NO alcanza con agrupar por FECHA: dos corridas
  //     en el mismo segundo se fusionaban en una sola y la reversion quedaba
  //     mezclada con lo que revirtio. Salio en la prueba, aplicando y revirtiendo
  //     seguido.
  colsLog: ['FECHA','AREA','PRODUCTO','PRECIO ANTERIOR','PRECIO NUEVO','VARIACION %',
            'PROVEEDOR','QUIEN','RESULTADO','D ANTERIOR','PROVEEDOR ANTERIOR','CORRIDA']
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
function sincronizarPreciosDeCierre_(area) {
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

  // Un cierre sin un solo precio numerico no es "nada cambio": es un cierre que no se
  // pudo leer —precios escritos como texto, pestana vacia, columna corrida—. Hasta el
  // 15-sep-2026 devolvia cero cambios y el semaforo quedaba AL DIA sin haber vigilado
  // nada. Ahora tira, y el semaforo lo escribe como ERROR.
  if (!Object.keys(inv).length) {
    throw new Error('El cierre "' + ssInv.getName() + '" no trae ningún precio numérico en "' +
                    SYNC.hojaPrecios + '": no se puede comparar contra el Banco.');
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
 * `cambios` es el arreglo que devolvio sincronizarPreciosDeCierre_ (o un subconjunto).
 */
function aplicarSincronizacion_(area, cambios, quien) {
  if (!cambios || !cambios.length) return { escritos: 0 };
  area = area || 'COCINA';
  var cfg = null;
  for (var i = 0; i < COSTEO.areas.length; i++) if (COSTEO.areas[i].area === area) cfg = COSTEO.areas[i];
  var ssRec = abrirPorClave_(cfg.clave);
  var hBanco = ssRec.getSheetByName('BANCO DE DATOS');

  var stamp = new Date();
  var idCorrida = nuevaCorrida_(stamp);
  var log = [];
  var bita = [];       // ver "LOS DOS LOGS" al pie del archivo
  for (var c = 0; c < cambios.length; c++) {
    var x = cambios[c];

    // CANDADO 2: se relee la fila antes de escribir. Si alguien la movio, se salta.
    // Se leen C..I (no C..G) porque el proveedor vive en I y hay que guardar el
    // valor VIEJO en el log: sin eso revertirSync_ no puede devolverlo.
    var actual = hBanco.getRange(x.fila, 3, 1, 7).getValues()[0];  // C..I
    var dViejo = actual[1];                                        // D
    var provViejo = actual[6];                                     // I
    if (normalizar_(actual[0]) !== normalizar_(x.producto)) {
      log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
                quien || '', 'SALTADO: la fila ' + x.fila + ' ya no es ese producto', '', '', idCorrida]);
      continue;
    }
    if (typeof actual[3] === 'number' && Math.abs(actual[3] - x.precioViejo) > 0.005) {
      log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
                quien || '', 'SALTADO: el precio cambio desde la propuesta', '', '', idCorrida]);
      continue;
    }

    hBanco.getRange(x.fila, 4).setValue(x.dNuevo);      // D
    hBanco.getRange(x.fila, 6).setValue(x.precioNuevo); // F
    if (x.proveedor) hBanco.getRange(x.fila, 9).setValue(x.proveedor); // I
    log.push([stamp, area, x.producto, x.precioViejo, x.precioNuevo, x.pct, x.proveedor,
              quien || '', 'OK', dViejo, provViejo, idCorrida]);
    // Misma forma que cambiarPrecioInsumo_() en EdicionRecetario.gs: el sync es otra
    // manera de cambiar el precio de compra, no un evento de otra especie.
    bita.push([quien, 'sync', 'sincronizarPrecios', 'BANCO DE DATOS', String(x.producto),
               'precio compra', x.precioViejo, x.precioNuevo,
               (x.pct >= 0 ? '+' : '') + x.pct + '% · corrida ' + idCorrida]);
  }

  var hLog = hojaLogSync_(true);
  hLog.getRange(hLog.getLastRow() + 1, 1, log.length, SYNC.colsLog.length).setValues(log);
  bitacoraLote_(bita, stamp);

  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  var ok = 0;
  for (var j = 0; j < log.length; j++) if (log[j][8] === 'OK') ok++;
  return { escritos: ok, saltados: log.length - ok, corrida: idCorrida };
}

/**
 * Convierte el .xlsx del cierre a hoja nativa y guarda su ID.
 * Correr una vez al mes, despues del cierre.
 */
function convertirCierreANativa_(fileIdXlsx, nombre) {
  // Si YA es una hoja de Google no hay nada que convertir: copiarla dejaria un
  // duplicado exacto y ademas el ID guardado apuntaria a la copia y no al archivo
  // que la gente ve en Drive. Desde sep-2026 los reportes se suben ya nativos.
  try {
    var info = Drive.Files.get(fileIdXlsx, { fields: 'mimeType,name', supportsAllDrives: true });
    if (info && info.mimeType === MimeType.GOOGLE_SHEETS) {
      PropertiesService.getScriptProperties().setProperty('INVENTARIO_CIERRE_SHEET_ID', fileIdXlsx);
      Logger.log('El cierre ya era nativo, no se copio: %s (%s)', fileIdXlsx, info.name);
      return fileIdXlsx;
    }
  } catch (e) {
    // Si no se puede consultar, se sigue por el camino de siempre: convertir.
    Logger.log('  (no pude ver el mimeType del cierre, lo convierto igual: %s)', e.message || e);
  }

  // OJO: el proyecto tiene el servicio avanzado de Drive en v3 (ver appsscript.json).
  // La firma original era la de v2 ({ title: ... } + { convert: true }); en v3 el campo
  // es `name` y la conversion se pide poniendo el mimeType destino en el recurso.
  var recurso = {
    name: nombre || ('CIERRE ' + Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM')),
    mimeType: MimeType.GOOGLE_SHEETS
  };
  var copia = Drive.Files.copy(recurso, fileIdXlsx);
  PropertiesService.getScriptProperties().setProperty('INVENTARIO_CIERRE_SHEET_ID', copia.id);
  Logger.log('Cierre convertido: %s -> %s (%s)', fileIdXlsx, copia.id, recurso.name);
  return copia.id;
}

/** Prueba de escritorio. Corre la comparacion y escribe el resultado en el Log. */
function probarSincronizacion() {
  soloDueno_();
  var r = sincronizarPreciosDeCierre_('COCINA');
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

/* ==========================================================================
   DESHACER
   --------------------------------------------------------------------------
   aplicarSincronizacion_() es lo primero del sistema que escribe EN LOTE. Sus dos
   candados protegen contra una propuesta VIEJA (la fila se movio, el precio cambio),
   no contra una propuesta EQUIVOCADA: si el .xlsx del cierre viene con una columna
   corrida, los dos candados pasan limpios y escribe decenas de precios malos de un
   saque. Esto es la salida de ese caso.

   No borra ni reescribe el historico: agrega la reversion como corrida propia y
   marca las filas originales, para que el log siga siendo un registro de lo que
   paso y no una foto del estado actual.
   ========================================================================== */

/**
 * Clave estable de una corrida. El log guarda un Date; comparar Dates entre Sheets
 * y JS pierde milisegundos, asi que se compara el texto al segundo.
 * Acepta un Date, una clave de fecha vieja, o un id de corrida.
 */
function claveCorrida_(fecha) {
  if (!fecha) return '';
  if (Object.prototype.toString.call(fecha) === '[object Date]') {
    return Utilities.formatDate(fecha, 'America/Guatemala', 'yyyy-MM-dd HH:mm:ss');
  }
  var s = String(fecha).trim();
  // Solo se recorta si TODO el texto es una clave de fecha. Anclado al final a
  // proposito: sin el $, cualquier id que empezara con pinta de fecha se recortaba
  // a 19 caracteres y perdia justo el sufijo que lo hace unico.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(s)) return s.slice(0, 19).replace('T', ' ');
  return s;
}

/**
 * Id unico y legible de una corrida: '20260826-183544-a3f2'.
 * El sufijo al azar es lo que evita que dos corridas del mismo segundo se pisen.
 */
function nuevaCorrida_(stamp) {
  var abc = 'abcdefghijkmnpqrstuvwxyz23456789';   // sin l/o/0/1, para leerlo en voz alta
  var suf = '';
  for (var i = 0; i < 4; i++) suf += abc.charAt(Math.floor(Math.random() * abc.length));
  return Utilities.formatDate(stamp, 'America/Guatemala', 'yyyyMMdd-HHmmss') + '-' + suf;
}

/**
 * La hoja de log, creandola si no existe y extendiendo el encabezado si quedo con
 * el ancho viejo. Es idempotente y NO toca los datos: las filas escritas antes de
 * la migracion quedan con las ultimas celdas vacias, y revertirSync_ lo contempla.
 */
function hojaLogSync_(permitirMigrar) {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(SYNC.hojaLog);

  // Los caminos de LECTURA (listarCorridasSync, la simulacion) pasan false y no
  // escriben ni una celda: extender el encabezado ya es una escritura, y una funcion
  // que se anuncia como "no escribe" tiene que no escribir. Leen igual, porque
  // indiceLog_ busca por nombre y las columnas que falten quedan undefined.
  if (!h) {
    if (!permitirMigrar) return null;
    h = ss.insertSheet(SYNC.hojaLog);
    h.appendRow(SYNC.colsLog);
    h.setFrozenRows(1);
    return h;
  }
  if (permitirMigrar && h.getLastColumn() < SYNC.colsLog.length) {
    var faltan = SYNC.colsLog.length - h.getMaxColumns();
    if (faltan > 0) h.insertColumnsAfter(h.getMaxColumns(), faltan);
    h.getRange(1, 1, 1, SYNC.colsLog.length).setValues([SYNC.colsLog]);
    h.setFrozenRows(1);
  }
  return h;
}

/** Encabezado del log -> indice de columna. Por NOMBRE, no por posicion. */
function indiceLog_(h) {
  var enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  var idx = {};
  for (var i = 0; i < enc.length; i++) idx[normalizar_(enc[i])] = i;
  return idx;
}

/** Agrupa el log por corrida. */
function leerCorridas_(permitirMigrar) {
  var h = hojaLogSync_(permitirMigrar);
  if (!h) return { hoja: null, idx: {}, corridas: {}, orden: [] };
  var idx = indiceLog_(h);
  var datos = h.getDataRange().getValues();
  var corridas = {}, orden = [];

  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    // Se agrupa por el id de CORRIDA. Las filas escritas antes de que esa columna
    // existiera caen al agrupado viejo por fecha, para que la corrida del 24-ago
    // siga siendo reversible.
    var id = (idx['corrida'] === undefined) ? '' : String(f[idx['corrida']] || '').trim();
    var clave = id || claveCorrida_(f[idx['fecha']]);
    if (!clave) continue;

    if (!corridas[clave]) {
      corridas[clave] = { clave: clave, fecha: claveCorrida_(f[idx['fecha']]),
                          area: f[idx['area']], quien: f[idx['quien']],
                          ok: 0, saltados: 0, revertidos: 0, esReversion: false, filas: [] };
      orden.push(clave);
    }
    var c = corridas[clave];
    var res = String(f[idx['resultado']] || '');
    if (res === 'OK') c.ok++;
    else if (res.indexOf('REVERTIDO') === 0) { c.revertidos++; c.esReversion = true; }
    else c.saltados++;

    // Fila "vieja" = escrita antes de que el log tuviera D ANTERIOR. Ahi el D hay
    // que derivarlo y el proveedor NO se puede devolver: vacio y "estaba vacio"
    // son indistinguibles.
    var dAnt = idx['d anterior'] === undefined ? '' : f[idx['d anterior']];
    c.filas.push({
      filaLog: r + 1,
      producto: f[idx['producto']],
      precioViejo: f[idx['precio anterior']],
      precioNuevo: f[idx['precio nuevo']],
      proveedor: f[idx['proveedor']],
      resultado: res,
      dViejo: dAnt,
      provViejo: idx['proveedor anterior'] === undefined ? '' : f[idx['proveedor anterior']],
      esFilaVieja: (typeof dAnt !== 'number')
    });
  }
  return { hoja: h, idx: idx, corridas: corridas, orden: orden };
}

/**
 * Que corridas hay y cuales se pueden deshacer. NO escribe: es seguro correrla
 * desde el desplegable del editor.
 */
function listarCorridasSync() {
  soloDueno_();
  var todo = leerCorridas_(false);
  if (!todo.orden.length) { Logger.log('El log SYNC_PRECIOS no tiene corridas.'); return []; }

  var out = [];
  Logger.log('%s corrida(s) en SYNC_PRECIOS:', todo.orden.length);
  for (var i = 0; i < todo.orden.length; i++) {
    var c = todo.corridas[todo.orden[i]];
    var estado = c.esReversion ? 'es una reversion'
               : (c.ok ? 'REVERSIBLE (' + c.ok + ' fila/s)' : 'no escribio nada');
    Logger.log('  %s | %s | %s | %s | aplicadas %s, saltadas %s | %s',
               c.clave, c.fecha, c.area, c.quien, c.ok, c.saltados, estado);
    out.push({ clave: c.clave, fecha: c.fecha, area: c.area, quien: c.quien, ok: c.ok, estado: estado });
  }
  Logger.log('Para deshacer una del cierre de inventario: Profit OS > Inventarios > Precios > Deshacer. ' +
             'Para las anteriores, REVERTIR_SYNC.gs quedo en apps-script/_archivo/2026-09-15_tanda4_scripts/: pegalo en el editor.');
  return out;
}

/**
 * Deshace una corrida de aplicarSincronizacion_().
 *
 *   clave  — la que muestra listarCorridasSync()
 *   quien  — queda en el log
 *   opts   — { simular: true } devuelve el plan y NO escribe
 *
 * Candados, en orden. Cualquiera que salte deja la fila como estaba y lo registra:
 *   A. el producto tiene que seguir existiendo en el Banco
 *   B. tiene que haber UNA sola fila con ese nombre (si hay dos, no adivina)
 *   C. el precio actual tiene que ser el que dejo la sincronizacion. Si alguien lo
 *      edito despues, revertir le pisaria el trabajo: se salta.
 *
 * El candado C es ademas lo que hace esto idempotente: corrido dos veces, la
 * segunda no encuentra nada que revertir.
 */
function revertirSync_(clave, quien, opts) {
  opts = opts || {};
  var simular = !!opts.simular;
  clave = claveCorrida_(clave);
  if (!clave) throw new Error('revertirSync_ necesita la clave de la corrida. Corré listarCorridasSync().');

  var todo = leerCorridas_(!simular);
  var corrida = todo.corridas[clave];
  if (!corrida) throw new Error('No hay corrida con clave "' + clave + '". Corré listarCorridasSync().');
  if (corrida.esReversion) throw new Error('La corrida ' + clave + ' ES una reversion. No se revierte una reversion.');

  var aplicadas = corrida.filas.filter(function (f) { return f.resultado === 'OK'; });
  if (!aplicadas.length) {
    return { corrida: clave, simulado: simular, revertidos: 0, saltados: 0, plan: [],
             nota: 'Esa corrida no dejo nada aplicado (o ya se revirtio).' };
  }

  var area = corrida.area || 'COCINA';
  var cfg = null;
  for (var i = 0; i < COSTEO.areas.length; i++) if (COSTEO.areas[i].area === area) cfg = COSTEO.areas[i];
  if (!cfg) throw new Error('Area desconocida en el log: ' + area);
  var hBanco = abrirPorClave_(cfg.clave).getSheetByName('BANCO DE DATOS');
  if (!hBanco) throw new Error('El recetario no tiene BANCO DE DATOS.');

  // El log no guarda el numero de fila —y es mejor asi, las filas se mueven—.
  // Se busca por nombre normalizado, igual que todo el resto del modulo.
  var banco = hBanco.getDataRange().getValues();
  var porProducto = {};
  for (var b = 3; b < banco.length; b++) {
    var p = normalizar_(banco[b][2]);
    if (!p) continue;
    if (!porProducto[p]) porProducto[p] = [];
    porProducto[p].push(b + 1);
  }

  var stamp = new Date();
  var idReversion = nuevaCorrida_(stamp);
  var plan = [], log = [], marcar = [], bita = [];

  for (var j = 0; j < aplicadas.length; j++) {
    var f = aplicadas[j];
    var nota = '';
    var filas = porProducto[normalizar_(f.producto)];

    if (!filas || !filas.length)      nota = 'SALTADO: "' + f.producto + '" ya no esta en el Banco';
    else if (filas.length > 1)        nota = 'SALTADO: hay ' + filas.length + ' filas llamadas "' + f.producto + '", no se adivina cual';

    if (nota) {
      plan.push({ producto: f.producto, accion: nota });
      log.push([stamp, area, f.producto, f.precioNuevo, f.precioViejo, '', f.proveedor,
                quien || '', nota, '', '', idReversion]);
      continue;
    }

    var fila = filas[0];
    var act = hBanco.getRange(fila, 3, 1, 7).getValues()[0];   // C..I
    var fActual = act[3];                                      // F
    var dActual = act[1];                                      // D

    // CANDADO C
    if (typeof fActual !== 'number' || Math.abs(fActual - f.precioNuevo) > 0.005) {
      nota = 'SALTADO: el precio ya no es el que dejo la sincronizacion (Q' + fActual + ', se esperaba Q' + f.precioNuevo + ')';
      plan.push({ producto: f.producto, accion: nota });
      log.push([stamp, area, f.producto, f.precioNuevo, f.precioViejo, '', f.proveedor,
                quien || '', nota, '', '', idReversion]);
      continue;
    }

    // D: del log si esta; si la fila es vieja, se deriva. aplicarSincronizacion
    // conserva el factor (dNuevo = precioNuevo * dViejo/precioViejo), asi que
    // dViejo = dActual * precioViejo/precioNuevo. Se redondea igual que alla.
    var dDestino = f.dViejo;
    if (f.esFilaVieja) {
      dDestino = (typeof dActual === 'number' && f.precioNuevo)
        ? Math.round(dActual * (f.precioViejo / f.precioNuevo) * 100000) / 100000
        : null;
      nota = 'fila de log vieja: D derivado' + (f.proveedor ? ', proveedor NO devuelto' : '');
    }

    if (!simular) {
      hBanco.getRange(fila, 6).setValue(f.precioViejo);                              // F
      if (typeof dDestino === 'number') hBanco.getRange(fila, 4).setValue(dDestino); // D
      // El proveedor solo se devuelve si la sincronizacion lo habia escrito Y el log
      // guardo el anterior. En las filas viejas '' significa "no se", no "vacio".
      if (f.proveedor && !f.esFilaVieja) hBanco.getRange(fila, 9).setValue(f.provViejo);
      marcar.push(f.filaLog);
      bita.push([quien, 'sync', 'revertirSync', 'BANCO DE DATOS', String(f.producto),
                 'precio compra', f.precioNuevo, f.precioViejo,
                 'deshace la corrida ' + clave + (nota ? ' · ' + nota : '')]);
    }

    plan.push({ producto: f.producto, fila: fila, de: f.precioNuevo, a: f.precioViejo, nota: nota });
    log.push([stamp, area, f.producto, f.precioNuevo, f.precioViejo, '', f.provViejo, quien || '',
              'REVERTIDO de ' + clave, dActual, f.proveedor, idReversion]);
  }

  if (simular) {
    return { corrida: clave, simulado: true,
             revertirian: plan.filter(function (p) { return !p.accion; }).length,
             saltarian: plan.filter(function (p) { return !!p.accion; }).length, plan: plan };
  }

  // Las filas originales pasan de 'OK' a 'OK (revertido)'. Con eso una segunda
  // corrida no las vuelve a tomar, y el log sigue contando la historia completa.
  if (marcar.length) {
    var cRes = todo.idx['resultado'] + 1;
    var min = Math.min.apply(null, marcar), max = Math.max.apply(null, marcar);
    var col = todo.hoja.getRange(min, cRes, max - min + 1, 1).getValues();
    for (var m = 0; m < marcar.length; m++) col[marcar[m] - min][0] = 'OK (revertido)';
    todo.hoja.getRange(min, cRes, max - min + 1, 1).setValues(col);
  }

  var hLog = hojaLogSync_(true);
  hLog.getRange(hLog.getLastRow() + 1, 1, log.length, SYNC.colsLog.length).setValues(log);
  bitacoraLote_(bita, stamp);
  CacheService.getScriptCache().remove(COSTEO.cacheKey);

  var rev = 0;
  for (var k = 0; k < log.length; k++) if (String(log[k][8]).indexOf('REVERTIDO') === 0) rev++;
  return { corrida: clave, simulado: false, revertidos: rev, saltados: log.length - rev,
           reversion: idReversion, plan: plan };
}

/* ==========================================================================
   LOS DOS LOGS — quien escribe donde, y por que son dos
   --------------------------------------------------------------------------
   Hasta el 26-ago-2026 este modulo escribia SOLO en SYNC_PRECIOS y el resto del
   sistema SOLO en BITACORA. Eran dos rastros de auditoria que nadie cruzaba: para
   contestar "quien tocó el precio del lomito" habia que mirar en dos lados y
   ninguno de los dos tenia la historia completa. Ahora todo cambio de precio pasa
   por BITACORA, venga de donde venga.

   BITACORA — la pregunta humana: "quien tocó esto, cuando, de cuanto a cuanto".
     Una fila por celda que efectivamente CAMBIO. Formato identico al de
     cambiarPrecioInsumo_(), porque un sync no es un evento de otra especie: es otra
     manera de cambiar el precio de compra. Los saltados NO van aca: un salto no es
     un cambio.
     El ROL queda en 'sync' —no es un rol de exigirPermiso_, es la marca de que lo
     escribio la maquina y no una persona desde la interfaz.

   SYNC_PRECIOS — la pregunta de la maquina: "que hizo esta corrida y como la
     deshago". Guarda lo que BITACORA no tiene y el deshacer necesita: D ANTERIOR,
     PROVEEDOR ANTERIOR, CORRIDA, y ademas las filas SALTADAS con su motivo.
     revertirSync_ lee de aca, nunca de BITACORA.

   La regla, si se agrega algo que escriba: BITACORA es el registro, SYNC_PRECIOS es
   el mecanismo. Un cambio que no aparezca en BITACORA es un cambio invisible.
   ========================================================================== */
