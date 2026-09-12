/**
 * VentasPorProducto.gs — El feed de ventas del POS hacia el libro de costeo.
 *
 * Lo corre Juanma los lunes, sin argumentos, despues de dejar el export en la carpeta
 * de la semana. No hay ids que pegar ni archivos que elegir: LA CARPETA ES LA
 * INTERFAZ.
 *
 * De donde lee, y por que de dos lados:
 *   1. 04_Profit_OS/Ingenieria_de_Menu — la carpeta dedicada al indicador, donde ya
 *      estan los exports de junio, julio y agosto.
 *   2. Las subcarpetas S## de Reportes 2026 — la rutina semanal de siempre.
 * Buscar en las dos no cuesta nada y hace que no importe donde se deje el archivo.
 *
 * EL PREFIJO TIENE QUE SER EXACTO. En esas mismas carpetas conviven:
 *   ReporteVentas_...        -> tickets, otro reporte
 *   RepProductosConsolid_... -> el consolidado. NO SIRVE: no tiene fecha, asi que no
 *                               se puede acumular sin doble conteo, y su columna
 *                               Ganancia es falsa para cocina porque Precio_Compra
 *                               viene en cero (reporta 100% de margen).
 * Agarrar el equivocado rompe todo en silencio.
 *
 * Los exports son ACUMULATIVOS desde enero, no incrementales: el de agosto contiene a
 * los de junio y julio. Por eso la idempotencia es por rango de fechas y no por llave.
 */

var VENTAS = {
  carpetas: [
    { id: '1AGdd-5ETnXkUIDB0ISCGu0BNV9mZpk6c', nombre: 'Ingenieria_de_Menu', recursiva: false },
    { id: '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP', nombre: 'Reportes 2026',      recursiva: true  }
  ],
  prefijo: 'ReporteVentasProductos',
  hoja:    'VENTAS x PLATO',
  hojaLog: 'SYNC_VENTAS',

  cols: ['DOC ID', 'FECHA', 'PRODUCTO POS', 'PRODUCTO', 'CATEGORIA', 'CANTIDAD',
         'PRECIO VENTA', 'DESCUENTO', 'TOTAL', 'VENDEDOR', 'CARGADO EL'],

  colsLog: ['CARGADO EL', 'ARCHIVO', 'CARPETA', 'FILE ID', 'DESDE', 'HASTA',
            'LINEAS CARGADAS', 'UNIDADES', 'TOTAL Q', 'ANULADAS', 'OTRAS EN Q0',
            'ID DE LA COPIA NATIVA'],

  // Encabezados del export, normalizados. Se busca POR NOMBRE, no por posicion:
  // asumir el orden es como se rompio el cierre.
  enc: {
    doc: 'doc id', fecha: 'fecha_emision', producto: 'producto', categoria: 'categoria',
    cantidad: 'cantidad', precio: 'precio_venta', descuento: 'descuento',
    compra: 'precio_compra', total: 'total', vendedor: 'vendedor'
  }
};

/* ==========================================================================
   LIMPIEZA — las tres reglas
   ========================================================================== */

/**
 * El nombre sin el sufijo del POS. "Tartar de Hongos | Producto No confirmado*"
 * y "Tartar de Hongos" son el MISMO producto: 16 aparecen de las dos formas en una
 * sola semana y sin esto cada uno se parte en dos.
 */
function limpiarNombreProducto_(nombre) {
  var s = String(nombre == null ? '' : nombre);
  var i = s.indexOf('|');
  return (i === -1 ? s : s.slice(0, i)).replace(/\s+/g, ' ').trim();
}

/**
 * true si la linea es una ANULACION: se marco un producto, se borro y se volvio a
 * marcar. Valen cero, asi que no mueven ninguna cifra de dinero — son invisibles en
 * cualquier cuadre de venta y solo inflan el conteo de unidades, que es exactamente
 * lo que mide la popularidad. En enero-agosto son 1073 lineas: el 10.3%.
 */
function esLineaAnulada_(nombreCrudo, total) {
  return Number(total) === 0 && normalizar_(nombreCrudo).indexOf('eliminado') !== -1;
}

/** La fecha del export viene DD/MM/YYYY. Tambien puede llegar como Date. */
function fechaVenta_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    // Guatemala es UTC-6 FIJO: no tiene horario de verano desde 2006. Por eso la
    // fecha de pared se saca restando seis horas y leyendo las partes en UTC, y no
    // con Utilities.formatDate. El resultado es identico, no una aproximacion.
    //
    // POR QUE IMPORTA: formatDate no es JavaScript, es una llamada al servicio de
    // Apps Script. Cada una cruza el puente a Java y cuesta milisegundos. Sobre las
    // 9.502 filas de VENTAS x PLATO eso era entre 16 y 97 segundos —el tiempo
    // bailaba porque dependia de la carga del lado de Google, no del calculo— y se
    // pagaba entero cada vez que un cambio de precio invalidaba el cache del
    // tablero. El 10-sep-2026 Jeffry lo reporto como "el panel carga lento".
    // Es el mismo error que en 2026-08-30, cuando eran 28.000 JSON.parse en un
    // bucle: la trampa de Apps Script no es el codigo pesado, son las llamadas a
    // servicio adentro de un bucle.
    var t = new Date(v.getTime() - 6 * 3600000);
    return t.getUTCFullYear() + '-' +
           ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' +
           ('0' + t.getUTCDate()).slice(-2);
  }
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);      // DD/MM/YYYY
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                // ya normalizada
  if (m) return m[0];
  return '';
}

/* ==========================================================================
   DRIVE
   ========================================================================== */

/**
 * Los ReporteVentasProductos de las dos carpetas, con su carpeta de origen.
 *
 * Usa el servicio avanzado Drive v3 y NO DriveApp. La razon: estas carpetas viven en
 * una unidad compartida —el libro de costeo cuelga de 0ALlxQ-J2MzVbUk9PVA, y los ids
 * que empiezan con 0A son unidades compartidas— y DriveApp.getFolderById() falla ahi.
 * El 27-ago-2026 la primera version con DriveApp devolvio "no pude abrir la carpeta"
 * para las DOS, teniendo los ids correctos y el scope de drive declarado.
 * Drive v3 lo resuelve con supportsAllDrives + includeItemsFromAllDrives.
 */
function ventasArchivosEnDrive_() {
  var out = [];
  VENTAS.carpetas.forEach(function (c) {
    try {
      juntarVentasDeCarpeta_(c.id, c.nombre, c.recursiva, out);
    } catch (e) {
      // El mensaje va COMPLETO: un catch mudo aca deja el diagnostico a ciegas.
      Logger.log('OJO: no pude leer la carpeta %s (%s) — %s', c.nombre, c.id, e.message || e);
    }
  });
  return out;
}

/** Lista un nivel con Drive v3, paginando. */
function drivesListar_(consulta) {
  var out = [], token = null;
  do {
    var r = Drive.Files.list({
      q: consulta,
      // modifiedTime lo necesita el resolvedor del catalogo del POS para desempatar
      // dos exports del MISMO dia: la hora del nombre viene sin ceros a la izquierda
      // y es ambigua. Pedirlo no le cuesta nada a los otros usos.
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
      pageSize: 200,
      pageToken: token,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives'
    });
    (r.files || []).forEach(function (f) { out.push(f); });
    token = r.nextPageToken;
  } while (token);
  return out;
}

function juntarVentasDeCarpeta_(carpetaId, etiqueta, recursiva, out) {
  drivesListar_("'" + carpetaId + "' in parents and trashed = false").forEach(function (f) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      // Las subcarpetas S## de Reportes 2026.
      if (recursiva) juntarVentasDeCarpeta_(f.id, etiqueta + '/' + f.name, true, out);
      return;
    }
    // PREFIJO EXACTO: ReporteVentas_ y RepProductosConsolid_ viven en las mismas
    // carpetas y no sirven.
    if (String(f.name).indexOf(VENTAS.prefijo) !== 0) return;
    // nativa: desde S36 (sep-2026) los reportes se suben ya convertidos a hoja de
    // Google, por decision del proyecto. Un origen nativo NO hay que copiarlo: se
    // lee tal cual. Misma marca que usa catalogoArchivos_ en ConfigPOS.gs.
    out.push({ id: f.id, nombre: f.name, carpeta: etiqueta,
               nativa: f.mimeType === MimeType.GOOGLE_SHEETS });
  });
}

/**
 * .xlsx -> hoja nativa. MISMO mecanismo que convertirCierreANativa_ en
 * SincronizarPrecios.gs: Drive avanzado v3, campo `name` y el mimeType destino en el
 * recurso. La firma v2 ({title} + {convert:true}) NO funciona en este proyecto.
 * La copia queda junto al original y su id va al log, para poder rastrear que se leyo.
 */
/**
 * La copia nativa de este export, si ya existe.
 *
 * POR QUE: cargarVentasPorProducto convertia el .xlsx CADA VEZ que lo procesaba,
 * sin mirar si ya habia una. El 30-ago-2026 la carpeta Ingenieria_de_Menu tenia
 * NUEVE copias para cuatro exports —el del 26-ago convertido tres veces—, unos
 * 600 KB de basura que nadie iba a limpiar. No rompia nada (el filtro de prefijo
 * las ignora porque empiezan con "~nativa " y no con "ReporteVentasProductos"),
 * pero cada corrida dejaba mas.
 *
 * Se busca por NOMBRE EXACTO. El nombre de un export trae la fecha y la hora hasta
 * el segundo, asi que dos archivos con el mismo nombre son el mismo export.
 *
 * Si la busqueda falla, devuelve null y se convierte: duplicar una copia es un
 * desperdicio, no convertir seria un error.
 */
function ventasNativaExistente_(nombre) {
  try {
    var buscado = '~nativa ' + nombre;
    var q = "name = '" + String(buscado).replace(/'/g, "\\'") + "'" +
            " and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
    var hallados = drivesListar_(q);
    return hallados.length ? hallados[0].id : null;
  } catch (e) {
    Logger.log('  (no pude comprobar si ya habia copia nativa: %s)', e.message || e);
    return null;
  }
}

function ventasConvertirANativa_(fileId, nombre, carpetaId) {
  var recurso = { name: '~nativa ' + nombre, mimeType: MimeType.GOOGLE_SHEETS };
  if (carpetaId) recurso.parents = [carpetaId];
  // supportsAllDrives por lo mismo que el listado: el origen esta en una unidad
  // compartida y sin esto la copia falla con "File not found".
  var copia = Drive.Files.copy(recurso, fileId, { supportsAllDrives: true });
  return copia.id;
}

/* ==========================================================================
   HOJAS
   ========================================================================== */

function hojaVentas_() {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(VENTAS.hoja);
  if (!h) {
    h = ss.insertSheet(VENTAS.hoja);
    h.appendRow(VENTAS.cols);
    h.setFrozenRows(1);
  }
  return h;
}

function hojaSyncVentas_() {
  var ss = hojaCosteo_();
  var h = ss.getSheetByName(VENTAS.hojaLog);
  if (!h) {
    h = ss.insertSheet(VENTAS.hojaLog);
    h.appendRow(VENTAS.colsLog);
    h.setFrozenRows(1);
  }
  return h;
}

/** Los fileId ya cargados. Es lo que evita el doble conteo. */
function ventasYaCargados_() {
  var h = hojaSyncVentas_();
  var out = {};
  if (h.getLastRow() < 2) return out;
  var col = VENTAS.colsLog.indexOf('FILE ID') + 1;
  h.getRange(2, col, h.getLastRow() - 1, 1).getValues().forEach(function (f) {
    var id = String(f[0] || '').trim();
    if (id) out[id] = true;
  });
  return out;
}

/* ==========================================================================
   LECTURA Y CUADRE
   ========================================================================== */

/**
 * Lee la hoja nativa ya convertida y devuelve las filas limpias.
 * NO escribe. Si el cuadre falla, devuelve el error y el llamador rechaza la carga
 * entera: mejor no cargar nada que cargar la mitad.
 */
function leerExportVentas_(ssId) {
  var hojas = SpreadsheetApp.openById(ssId).getSheets();
  if (!hojas.length) return { error: 'El archivo convertido no tiene hojas.' };
  var datos = hojas[0].getDataRange().getValues();
  if (datos.length < 2) return { error: 'El archivo no tiene filas.' };

  // El encabezado, por NOMBRE
  var idx = {}, encFila = -1;
  for (var r = 0; r < Math.min(datos.length, 10) && encFila === -1; r++) {
    var fila = datos[r].map(normalizar_);
    if (fila.indexOf(VENTAS.enc.doc) !== -1 && fila.indexOf(VENTAS.enc.producto) !== -1) {
      encFila = r;
      for (var k in VENTAS.enc) idx[k] = fila.indexOf(VENTAS.enc[k]);
    }
  }
  if (encFila === -1) return { error: 'No encontre el encabezado (Doc ID / Producto).' };
  var faltan = Object.keys(VENTAS.enc).filter(function (k) { return idx[k] === -1; });
  if (faltan.length) return { error: 'Faltan columnas: ' + faltan.join(', ') };

  var filas = [], anuladas = 0, anuladasUds = 0, cero = 0, ceroUds = 0;
  var sumaConDoc = 0, totalDelArchivo = null, unidades = 0;
  var desde = null, hasta = null, tickets = {}, productos = {}, productosCrudos = {}, ticketsConDoc = {};

  for (var i = encFila + 1; i < datos.length; i++) {
    var f = datos[i];
    var doc = String(f[idx.doc] == null ? '' : f[idx.doc]).trim();
    var total = Number(f[idx.total]) || 0;

    // REGLA 3: la fila de total no tiene Doc ID. Es la ultima y trae el total.
    if (!doc) {
      if (total) totalDelArchivo = total;
      continue;
    }

    sumaConDoc += total;
    ticketsConDoc[doc] = true;
    var crudo = String(f[idx.producto] == null ? '' : f[idx.producto]);
    var cant = Number(f[idx.cantidad]) || 0;

    // REGLA 1: las anuladas fuera.
    if (esLineaAnulada_(crudo, total)) { anuladas++; anuladasUds += cant; continue; }

    // Cortesias y texto libre: tampoco son venta, pero se reportan aparte porque es
    // comida que salio sin cobrarse y hoy no se registra en ningun lado.
    if (total === 0) { cero++; ceroUds += cant; continue; }

    var fecha = fechaVenta_(f[idx.fecha]);
    if (!fecha) continue;
    if (!desde || fecha < desde) desde = fecha;
    if (!hasta || fecha > hasta) hasta = fecha;

    // REGLA 2: se cuenta la linea, se le quita el sufijo.
    var limpio = limpiarNombreProducto_(crudo);
    tickets[doc] = true;
    productos[normalizar_(limpio)] = true;
    productosCrudos[limpio] = true;   // sin normalizar: "Lomito de la Casa" != "Lomito de la casa"
    unidades += cant;

    filas.push([doc, fecha, crudo.trim(), limpio, String(f[idx.categoria] || '').trim(),
                cant, Number(f[idx.precio]) || 0, Number(f[idx.descuento]) || 0,
                total, String(f[idx.vendedor] || '').trim(), null]);
  }

  // CUADRE OBLIGATORIO. La suma de las filas con Doc ID contra la fila de total.
  if (totalDelArchivo === null) {
    return { error: 'El archivo no trae fila de total: sin ella no se puede cuadrar.' };
  }
  if (Math.abs(sumaConDoc - totalDelArchivo) > 0.005) {
    return { error: 'NO CUADRA: las filas suman Q' + sumaConDoc.toFixed(2) +
                    ' y la fila de total dice Q' + Number(totalDelArchivo).toFixed(2) +
                    '. No se escribe nada.' };
  }

  return {
    filas: filas, desde: desde, hasta: hasta,
    conDoc: filas.length + anuladas + cero, sumaConDoc: sumaConDoc,
    totalDelArchivo: totalDelArchivo, unidades: unidades,
    anuladas: anuladas, anuladasUds: anuladasUds, cero: cero, ceroUds: ceroUds,
    tickets: Object.keys(tickets).length, productos: Object.keys(productos).length,
    ticketsConDoc: Object.keys(ticketsConDoc).length,
    productosCrudos: Object.keys(productosCrudos).length
  };
}

/**
 * Escribe reemplazando POR RANGO DE FECHAS.
 *
 * NO se deduplica por llave y no es un descuido: DOC ID + PRODUCTO colisiona 11 veces
 * en una sola semana —la linea anulada y la real comparten llave— y agregarle
 * Comentario_Producto tampoco la vuelve unica. Borrar el rango y reescribir es a
 * prueba de balas: cargar dos veces el mismo archivo deja el mismo resultado, y
 * cargar rangos traslapados tambien.
 */
function escribirVentas_(filas, desde, hasta, cuando) {
  var h = hojaVentas_();
  var cFecha = VENTAS.cols.indexOf('FECHA');
  var previas = [];
  if (h.getLastRow() > 1) {
    h.getRange(2, 1, h.getLastRow() - 1, VENTAS.cols.length).getValues().forEach(function (f) {
      // OJO: la fecha se escribe como texto 'yyyy-MM-dd' pero Sheets la guarda como
      // Date, y al releerla vuelve un objeto. String(Date) da "Sun Aug 23 2026...",
      // que comparado alfabeticamente contra '2026-01-02' SIEMPRE es mayor: ninguna
      // fila caia dentro del rango y el borrado no borraba nada. El 27-ago-2026 eso
      // dejo la hoja con 32.888 filas en vez de 9.501, apilando los cuatro archivos
      // acumulativos. Se normaliza con la misma funcion que lee el export.
      var d = fechaVenta_(f[cFecha]);
      if (!d || d < desde || d > hasta) previas.push(f);   // lo de afuera se queda
    });
  }
  filas.forEach(function (f) { f[VENTAS.cols.length - 1] = cuando; });

  var todo = previas.concat(filas);
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, VENTAS.cols.length).clearContent();
  if (todo.length) h.getRange(2, 1, todo.length, VENTAS.cols.length).setValues(todo);
  return { reemplazadas: (h.getLastRow() - 1) - previas.length, total: todo.length };
}

/* ==========================================================================
   LA FUNCION DEL LUNES
   ========================================================================== */

function cargarVentasPorProducto() {
  // Esta corrida resuelve el aviso "exports del POS sin cargar". Se borra el cache
  // de avisos para que desaparezca en el acto y no dentro de media hora.
  if (typeof olvidarAvisosDashboard_ === 'function') olvidarAvisosDashboard_();
  var cuando = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var enDrive = ventasArchivosEnDrive_();
  var yaEstan = ventasYaCargados_();
  var pendientes = enDrive.filter(function (a) { return !yaEstan[a.id]; });

  Logger.log('%s archivo(s) con el prefijo "%s" · %s ya cargados · %s pendientes',
             enDrive.length, VENTAS.prefijo, enDrive.length - pendientes.length, pendientes.length);
  if (!pendientes.length) { Logger.log('Nada nuevo que cargar.'); return { pendientes: 0 }; }

  var log = hojaSyncVentas_(), resumen = [];

  for (var i = 0; i < pendientes.length; i++) {
    var a = pendientes[i];
    Logger.log('--- %s  (%s) ---', a.nombre, a.carpeta);

    var copiaId = null, r;
    try {
      // TRES CAMINOS, en orden de menos trabajo a mas:
      //   1. el archivo YA es nativo  -> se lee directo, sin copiar nada;
      //   2. hay una copia nativa suya -> se reusa;
      //   3. es .xlsx sin copia        -> se convierte.
      //
      // El caso 1 existe desde sep-2026: se decidio subir los reportes ya convertidos
      // a hoja de Google. Sin este atajo, cada corrida creaba un "~nativa <nombre>"
      // de un archivo que ya estaba en el formato bueno — un duplicado exacto. Es la
      // misma basura que ya se combatio el 30-ago-2026, cuando Ingenieria_de_Menu
      // tenia NUEVE copias para cuatro exports. El caso 3 se queda: los reportes
      // anteriores a S36, como el de S35, todavia son .xlsx y hay que poder releerlos.
      if (a.nativa) {
        copiaId = a.id;
        Logger.log('  ya es nativo, lo leo directo: %s', copiaId);
      } else {
        copiaId = ventasNativaExistente_(a.nombre);
        if (copiaId) {
          Logger.log('  ya habia copia nativa, la reuso: %s', copiaId);
        } else {
          copiaId = ventasConvertirANativa_(a.id, a.nombre, null);
          Logger.log('  .xlsx convertido, copia nativa creada: %s', copiaId);
        }
      }
      r = leerExportVentas_(copiaId);
    } catch (e) {
      Logger.log('  ERROR: %s', e.message || e);
      resumen.push({ archivo: a.nombre, error: String(e.message || e) });
      continue;
    }

    if (r.error) {
      Logger.log('  RECHAZADO: %s', r.error);
      resumen.push({ archivo: a.nombre, error: r.error });
      continue;
    }

    Logger.log('  rango %s -> %s · %s filas con Doc ID · suma Q%s (cuadra con Q%s)',
               r.desde, r.hasta, r.conDoc, r.sumaConDoc.toFixed(2), Number(r.totalDelArchivo).toFixed(2));
    Logger.log('  anuladas descartadas: %s lineas · %s uds', r.anuladas, r.anuladasUds);
    Logger.log('  otras en Q0 (cortesias y texto libre): %s lineas · %s uds', r.cero, r.ceroUds);
    Logger.log('  VALIDAS: %s lineas · %s uds · %s tickets · %s productos distintos',
               r.filas.length, r.unidades, r.tickets, r.productos);
    Logger.log('  (para comparar con el oraculo: %s tickets contando los que solo tienen anuladas · %s productos SIN normalizar)',
               r.ticketsConDoc, r.productosCrudos);

    var esc = escribirVentas_(r.filas, r.desde, r.hasta, cuando);
    log.appendRow([cuando, a.nombre, a.carpeta, a.id, r.desde, r.hasta,
                   r.filas.length, r.unidades, r.sumaConDoc, r.anuladas, r.cero, copiaId]);

    resumen.push({ archivo: a.nombre, carpeta: a.carpeta, desde: r.desde, hasta: r.hasta,
                   conDoc: r.conDoc, validas: r.filas.length, unidades: r.unidades,
                   suma: r.sumaConDoc, anuladas: r.anuladas, anuladasUds: r.anuladasUds,
                   cero: r.cero, ceroUds: r.ceroUds, tickets: r.tickets,
                   productos: r.productos, enLaHoja: esc.total });
    Logger.log('  escrito. La hoja queda con %s filas.', esc.total);
  }

  CacheService.getScriptCache().remove(COSTEO.cacheKey);
  Logger.log('');
  Logger.log('Las copias nativas quedaron en Drive con el prefijo "~nativa ": son');
  Logger.log('desechables, su id esta en %s por si hay que auditar que se leyo.', VENTAS.hojaLog);
  Logger.log('Si ya existia la copia de un export, se reuso en vez de crear otra.');
  return { pendientes: pendientes.length, archivos: resumen };
}
