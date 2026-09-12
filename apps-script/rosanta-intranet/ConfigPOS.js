/**
 * ConfigPOS.gs — Profit OS · puente entre el recetario y el POS.
 *
 * REGLA: el POS manda en la nomenclatura. Si un nombre no coincide, se ajusta el
 * documento, nunca el POS.
 *
 * NO HAY DATOS EN ESTE ARCHIVO. Todo se lee del recetario:
 *
 *   RESUMEN CMV  columna B = plato · H = nombre en el POS · I = llave del POS
 *                columna K = nombre EXACTO de la pestana de la ficha
 *   MAPA POS     los productos que no son platos de la carta y las categorias de cocina
 *
 * Los cuatro postres no tienen producto propio en el POS: se venden por un unico
 * boton de postre a Q65 y la receta rota. Por eso su columna I va vacia.
 *                (la lectura se detiene en la fila marcada FIN)
 *
 * Se edita en el Excel, no aca. Asi no hay dos verdades que se puedan desincronizar.
 *
 * Depende de ConfigCosteo.gs (COSTEO, normalizar_, abrirPorClave_).
 */

var POS_CFG = {
  hojaResumen: 'RESUMEN CMV',
  hojaMapa:    'MAPA POS',
  colPlato:    2,    // B en RESUMEN CMV
  colNombrePos:8,    // H
  colLlave:    9,    // I
  colPestana: 11,    // K — nombre exacto de la pestana de la ficha
  cacheKey:    'pos_mapa_v2',
  cacheSegs:   900
};

/**
 * Lee las dos hojas y arma el mapa. Cacheado 15 minutos.
 * { platos:{plato:{pos,llave,pestana}}, porPos:{nombreNorm:plato},
 *   porPestana:{pestanaNorm:plato},
 *   ignorar:[], retirar:[], sinFicha:[], alta:[], tipo:[], catCocina:[] }
 */
function mapaPOS_(forzar) {
  var cache = CacheService.getScriptCache();
  if (!forzar) {
    var hit = cache.get(POS_CFG.cacheKey);
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  }

  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  if (!ss) throw new Error('Falta la propiedad RECETARIO_COCINA_SHEET_ID');

  var out = { platos: {}, porPos: {}, porPestana: {}, ignorar: [], retirar: [],
              sinFicha: [], alta: [], nota: [], tipo: [], catCocina: [] };

  // --- mapeo plato <-> POS, desde RESUMEN CMV
  var hR = ss.getSheetByName(POS_CFG.hojaResumen);
  if (!hR) throw new Error('El recetario no tiene la hoja ' + POS_CFG.hojaResumen);
  var fR = hR.getDataRange().getValues();
  for (var i = 0; i < fR.length; i++) {
    var plato = String(fR[i][POS_CFG.colPlato - 1] || '').trim();
    var nom   = String(fR[i][POS_CFG.colNombrePos - 1] || '').trim();
    if (!plato || !nom) continue;
    if (normalizar_(plato) === 'plato') continue;               // encabezado
    if (nom.toUpperCase().indexOf('FALTA DAR DE ALTA') === 0) continue;
    var llave = String(fR[i][POS_CFG.colLlave - 1] || '').trim();
    var pest  = String(fR[i][POS_CFG.colPestana - 1] || '').trim();
    out.platos[plato] = { pos: nom, llave: llave, pestana: pest };
    out.porPos[normalizar_(nom)] = plato;
    // la pestana va en MAYUSCULAS y 13 platos tienen ademas otro nombre de fondo:
    // sin este indice, nombrePOS_(pestana) nunca encontraba nada y fallaba callado.
    if (pest) out.porPestana[normalizar_(pest)] = plato;
  }

  // --- resto, desde MAPA POS
  var hM = ss.getSheetByName(POS_CFG.hojaMapa);
  if (hM) {
    var fM = hM.getDataRange().getValues();
    for (var j = 0; j < fM.length; j++) {
      var tipo = String(fM[j][1] || '').trim().toUpperCase();   // B
      var nomb = String(fM[j][2] || '').trim();                 // C
      if (tipo === 'FIN') break;        // la leyenda vive debajo; no es dato
      if (!nomb) continue;
      var reg = { pos: nomb, llave: String(fM[j][3] || '').trim(),
                  precio: fM[j][4], nota: String(fM[j][5] || '').trim() };
      if (tipo === 'IGNORAR')        out.ignorar.push(nomb);
      else if (tipo === 'RETIRAR')   out.retirar.push(reg);
      else if (tipo === 'SIN FICHA') out.sinFicha.push(reg);
      else if (tipo === 'ALTA')      out.alta.push(reg);
      else if (tipo === 'NOTA')      out.nota.push(reg);   // informativo, no es pendiente
      else if (tipo === 'TIPEO')     out.tipo.push(reg);   // TIPEO, no TIPO: TIPO es el encabezado de la columna
      else if (tipo === 'COCINA')    out.catCocina.push(nomb);
    }
  }
  if (!out.catCocina.length) {
    out.catCocina = ['Entrante', 'Fuerte', 'Guarniciones', 'Postre', 'Niños', 'Especial Día'];
  }

  try { cache.put(POS_CFG.cacheKey, JSON.stringify(out), POS_CFG.cacheSegs); } catch (e) {}
  return out;
}

/** Borra el cache. Correr despues de editar RESUMEN CMV o MAPA POS. */
function refrescarMapaPOS() {
  CacheService.getScriptCache().remove(POS_CFG.cacheKey);
  var m = mapaPOS_(true);
  var sinPestana = [];
  for (var p in m.platos) if (!m.platos[p].pestana) sinPestana.push(p);
  Logger.log('platos mapeados: %s | con pestana: %s | ignorar: %s | retirar: %s | sin ficha: %s | notas: %s',
             Object.keys(m.platos).length, Object.keys(m.porPestana).length,
             m.ignorar.length, m.retirar.length, m.sinFicha.length, m.nota.length);
  if (sinPestana.length) Logger.log('  SIN PESTANA EN LA COLUMNA K: %s', sinPestana.join(' · '));
  return m;
}

/**
 * Nombre del POS para una ficha del recetario.
 * Acepta el nombre de la pestana ("PASTA DEL DIA") o el nombre del plato
 * ("Pasta de la Casa"). Devuelve lo que le entra si no hay mapa.
 */
function nombrePOS_(ficha) {
  var reg = registroPlato_(ficha);
  return reg ? reg.pos : String(ficha).trim();
}

/** Registro completo del plato a partir de la pestana o del nombre del plato. null si no esta. */
function registroPlato_(ficha) {
  var m = mapaPOS_(), t = String(ficha).trim();
  if (m.platos[t]) return m.platos[t];                       // nombre del plato, exacto
  var n = normalizar_(t);
  if (m.porPestana[n]) return m.platos[m.porPestana[n]];     // nombre de la pestana
  for (var k in m.platos) if (normalizar_(k) === n) return m.platos[k];
  return null;
}

/** Pestana de la ficha para un plato o para un nombre del POS. null si no esta. */
function pestanaDeFicha_(algo) {
  var m = mapaPOS_(), t = String(algo).trim();
  var plato = m.platos[t] ? t : (m.porPos[normalizar_(t)] || null);
  if (!plato) { var reg = registroPlato_(t); return reg ? (reg.pestana || null) : null; }
  return m.platos[plato].pestana || null;
}

/** Ficha del recetario para un nombre del POS. null si no hay mapa. */
function fichaDesdePOS_(nombrePos) {
  return mapaPOS_().porPos[normalizar_(nombrePos)] || null;
}

/** true si el producto del POS es cocina (alimento). */
function esCocinaPOS_(categoria) {
  var c = String(categoria).trim(), lista = mapaPOS_().catCocina;
  for (var i = 0; i < lista.length; i++) if (normalizar_(lista[i]) === normalizar_(c)) return true;
  return false;
}

/** true si hay que excluir esa linea de ticket (producto dado de baja). */
function ignorarEnVentas_(nombrePos) {
  var t = normalizar_(nombrePos), lista = mapaPOS_().ignorar;
  for (var i = 0; i < lista.length; i++) if (normalizar_(lista[i]) === t) return true;
  return false;
}

/**
 * Compara el mapa contra el catalogo real del POS y avisa que se desalineo.
 * Correr cada vez que se reexporte el catalogo.
 */
function verificarNombresPOS(idCatalogoPOS) {
  var ss = SpreadsheetApp.openById(idCatalogoPOS);
  var filas = ss.getSheets()[0].getDataRange().getValues();
  var cat = {};
  for (var i = 1; i < filas.length; i++) {
    var n = filas[i][2];
    if (n) cat[normalizar_(n)] = { nombre: String(n).trim(), precio: filas[i][4], cat: filas[i][6] };
  }

  var m = mapaPOS_(true), rotos = [], preciosDistintos = [], ok = 0;
  var hR = abrirPorClave_('RECETARIO_COCINA_SHEET_ID').getSheetByName(POS_CFG.hojaResumen);
  var fR = hR.getDataRange().getValues();

  for (var plato in m.platos) {
    var v = cat[normalizar_(m.platos[plato].pos)];
    if (!v) { rotos.push(plato + '  ->  "' + m.platos[plato].pos + '" ya no esta en el POS'); continue; }
    ok++;
    for (var k = 0; k < fR.length; k++) {
      if (String(fR[k][POS_CFG.colPlato - 1] || '').trim() !== plato) continue;
      var pRec = fR[k][3];                                  // D — precio en el recetario
      if (typeof pRec === 'number' && typeof v.precio === 'number' && Math.abs(pRec - v.precio) > 0.005) {
        preciosDistintos.push(plato + ': recetario Q' + pRec + '  vs  POS Q' + v.precio);
      }
      break;
    }
  }

  Logger.log('vivos: %s | nombres rotos: %s | precios distintos: %s',
             ok, rotos.length, preciosDistintos.length);
  rotos.forEach(function (x) { Logger.log('  ROTO: %s', x); });
  preciosDistintos.forEach(function (x) { Logger.log('  PRECIO: %s', x); });
  return { ok: ok, rotos: rotos, precios: preciosDistintos };
}


/**
 * Prueba de humo del puente. Corre sola, no escribe nada.
 * Esperado con el recetario v16:
 *   platos 35 · con pestana 35 · resueltos por pestana 35 · rotos 0
 */
function probarPuentePOS() {
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  var m = mapaPOS_(true), rotos = [], ok = 0, sinHoja = [];
  for (var plato in m.platos) {
    var pest = m.platos[plato].pestana;
    if (!pest) { rotos.push(plato + ': columna K vacia'); continue; }
    if (!ss.getSheetByName(pest)) { sinHoja.push(plato + ' -> "' + pest + '"'); continue; }
    if (nombrePOS_(pest) === m.platos[plato].pos) ok++;
    else rotos.push(pest + ' -> nombrePOS_ devolvio "' + nombrePOS_(pest) + '"');
  }
  Logger.log('platos %s | resueltos por pestana %s | pestana inexistente %s | rotos %s',
             Object.keys(m.platos).length, ok, sinHoja.length, rotos.length);
  sinHoja.forEach(function (x) { Logger.log('  NO EXISTE LA PESTANA: %s', x); });
  rotos.forEach(function (x) { Logger.log('  ROTO: %s', x); });
  return { platos: Object.keys(m.platos).length, ok: ok, sinHoja: sinHoja, rotos: rotos };
}

/* ==========================================================================
   EL CATALOGO DEL POS SE RESUELVE SOLO

   POR QUE EXISTE, y es lo unico importante de este bloque:

   Hasta el 30-ago-2026 el catalogo se abria con abrirPorClave_('POS_CATALOGO_SHEET_ID'),
   o sea con el id de UN export concreto. Cada vez que se exporta el catalogo del POS
   aparece un archivo nuevo, y hasta que alguien editara la propiedad a mano la
   pantalla seguia leyendo el export viejo. Ese dia la propiedad apuntaba al
   Inventario_8_24 mientras el bueno era el del 8_30, con 61 precios distintos: la
   barra mostraba costos que ya no existian.

   No fallaba. MENTIA EN SILENCIO, que es peor: un error se ve, un dato viejo no.

   Un paso manual que hay que acordarse de hacer cada semana, cuyo olvido no produce
   ningun error visible, no es un proceso — es una trampa con retardo.
   ========================================================================== */

var CAT_POS = {
  prefijo: 'Inventario_',
  cacheKey: 'pos_catalogo_v1',
  cacheSegs: 900,           // 15 min: recorrer Drive en cada carga de pantalla es caro
  diasParaAvisar: 14        // arriba de esto la pantalla lo marca en rojo
};

/**
 * EL DIA del export, sacado del NOMBRE. Formato: Inventario_<M>_<D>_<AAAA>_<hora>
 *
 * El dia sale del nombre y no de modifiedTime porque si alguien vuelve a subir un
 * export viejo, su modifiedTime seria el mas nuevo y ganaria el archivo equivocado.
 * Y hay que PARSEAR LOS NUMEROS, no comparar el texto: ordenado como texto,
 * "Inventario_8_9_2026" queda DESPUES de "Inventario_8_24_2026".
 *
 * LA HORA NO SE USA, Y ES A PROPOSITO. El POS la escribe sin rellenar con ceros —
 * "20134" es 20:13:4 y "14658" es 14:6:58—, asi que un mismo texto admite mas de
 * una lectura valida: "14658" puede ser 1:46:58 o 14:06:58 y no hay forma de saber
 * cual. El 30-ago-2026 eso hizo que el resolvedor prefiriera el export de las 12:35
 * sobre el de las 14:06, leyendolo como la 1:46 de la madrugada.
 *
 * Dos exports del mismo dia se desempatan con modifiedTime, que si es inequivoco.
 * El riesgo que el nombre cubre —resubir un export de otro dia— sigue cubierto.
 */
function fechaDeNombreInventario_(nombre) {
  var m = String(nombre || '').match(/^~?n?a?t?i?v?a?\s*Inventario_(\d{1,2})_(\d{1,2})_(\d{4})_/);
  if (!m) return null;
  return new Date(+m[3], +m[1] - 1, +m[2]);   // medianoche: el dia, sin hora
}

/** El nombre sin el prefijo "~nativa ". Sirve para aparear un xlsx con su copia. */
function baseInventario_(nombre) {
  var n = String(nombre || '');
  return n.indexOf('~nativa ') === 0 ? n.slice('~nativa '.length) : n;
}

/**
 * El catalogo del POS que hay que leer HOY.
 *
 * Devuelve { ss, nombre, fecha, respaldo, aviso }. Nunca null y nunca falla en
 * silencio: si no encuentra nada cae a POS_CATALOGO_SHEET_ID y lo dice en el Log.
 *
 * `forzar` salta el cache.
 */
/**
 * QUE catalogo hay que leer, sin abrirlo.
 *
 * Va separado de catalogoPOS_ porque abrir la hoja es lo caro y no siempre hace
 * falta: la huella del cache del tablero (huellaDatos_ en Dashboard.gs) necesita
 * saber CUAL es el catalogo vigente, no leerlo. Del cache sale en microsegundos.
 *
 * Devuelve { id, nombre, fecha:Date|null, respaldo, aviso }.
 */
function catalogoInfo_(forzar) {
  var cache = CacheService.getScriptCache();
  if (!forzar) {
    var guardado = cache.get(CAT_POS.cacheKey);
    if (guardado) {
      try {
        var g = JSON.parse(guardado);
        return { id: g.id, nombre: g.nombre, fecha: g.fecha ? new Date(g.fecha) : null,
                 respaldo: !!g.respaldo, aviso: g.aviso || '' };
      } catch (e) { /* el cache no sirve: se resuelve de nuevo */ }
    }
  }
  var r = resolverCatalogoPOS_();
  try {
    cache.put(CAT_POS.cacheKey, JSON.stringify({
      id: r.id, nombre: r.nombre, fecha: r.fecha ? r.fecha.getTime() : null,
      respaldo: r.respaldo, aviso: r.aviso
    }), CAT_POS.cacheSegs);
  } catch (e) { /* que no se pueda cachear no puede romper la pantalla */ }
  return r;
}

/** El catalogo YA ABIERTO. Agrega `ss` a lo que devuelve catalogoInfo_. */
function catalogoPOS_(forzar) {
  var i = catalogoInfo_(forzar);
  return { ss: SpreadsheetApp.openById(i.id), nombre: i.nombre, fecha: i.fecha,
           respaldo: i.respaldo, aviso: i.aviso };
}

/** El trabajo sucio: recorrer Drive, elegir por fecha de nombre y convertir si hace falta. */
function resolverCatalogoPOS_() {
  var props = PropertiesService.getScriptProperties();
  var carpeta = props.getProperty('POS_CATALOGO_FOLDER_ID');
  var respaldoId = props.getProperty('POS_CATALOGO_SHEET_ID');

  function alRespaldo(motivo) {
    Logger.log('CATALOGO POS: %s. Caigo al respaldo POS_CATALOGO_SHEET_ID.', motivo);
    if (!respaldoId) throw new Error('No hay POS_CATALOGO_FOLDER_ID ni POS_CATALOGO_SHEET_ID.');
    var nom = '';
    try { nom = DriveApp.getFileById(respaldoId).getName(); } catch (e) {}
    return { id: respaldoId, nombre: nom, fecha: fechaDeNombreInventario_(nom),
             respaldo: true, aviso: motivo };
  }

  if (!carpeta) return alRespaldo('Falta la propiedad POS_CATALOGO_FOLDER_ID');

  // Recursivo: las subcarpetas (Precios POS, Inventarios, Cartas) ya existen y van a
  // seguir apareciendo. drivesListar_ vive en VentasPorProducto.gs y ya resuelve lo de
  // las unidades compartidas; no se escribe otra.
  var enCarpeta = [];
  try {
    juntarInventarios_(carpeta, enCarpeta, 0);
  } catch (e) {
    return alRespaldo('no pude leer la carpeta: ' + (e && e.message || e));
  }
  if (!enCarpeta.length) return alRespaldo('la carpeta no tiene ningun "' + CAT_POS.prefijo + '"');

  // El mas nuevo: primero por DIA del nombre, y dentro del mismo dia por
  // modifiedTime. Se miran nativas y xlsx por igual: si solo mirara nativas, el dia
  // que nadie convierta leeria en silencio el catalogo de la semana pasada — justo
  // el bug que esto viene a matar.
  enCarpeta.sort(function (a, b) {
    var d = b.fecha - a.fecha;
    return d !== 0 ? d : (b.mod - a.mod);
  });
  var elegido = enCarpeta[0];

  // Si ya existe la nativa de ESE MISMO export, se usa esa y no se convierte de nuevo.
  // Se aparea por NOMBRE BASE y no por fecha: ahora la fecha es solo el dia, y dos
  // exports del mismo dia la comparten.
  var base = baseInventario_(elegido.nombre);
  var mismaFecha = enCarpeta.filter(function (f) {
    return f.nativa && baseInventario_(f.nombre) === base;
  });

  var aviso = '';
  var id, nombre;
  if (mismaFecha.length) {
    id = mismaFecha[0].id; nombre = mismaFecha[0].nombre;
  } else if (elegido.nativa) {
    id = elegido.id; nombre = elegido.nombre;
  } else {
    // Es un .xlsx sin nativa. SpreadsheetApp.openById no abre un xlsx: se convierte.
    // Se reusa ventasConvertirANativa_ (firma Drive v3); la v2 no funciona aca.
    Logger.log('CATALOGO POS: el mas nuevo es un .xlsx sin convertir (%s). Lo convierto.', elegido.nombre);
    try {
      id = ventasConvertirANativa_(elegido.id, elegido.nombre, elegido.carpeta || carpeta);
      nombre = '~nativa ' + elegido.nombre;
      Logger.log('CATALOGO POS: copia nativa creada, id %s', id);
    } catch (e) {
      return alRespaldo('no pude convertir "' + elegido.nombre + '": ' + (e && e.message || e));
    }
  }

  // Y avisar si hay uno MAS NUEVO fuera de la carpeta —tipicamente en Downloads, donde
  // lo deja Drive Desktop—. Mover y convertir son dos pasos manuales y ninguno avisa
  // si se olvida; al menos que el Log lo diga.
  try {
    var sueltos = drivesListar_("name contains '" + CAT_POS.prefijo + "' and trashed = false")
      .filter(function (f) { return String(f.name).indexOf(CAT_POS.prefijo) === 0; })
      .map(function (f) { return { nombre: f.name, fecha: fechaDeNombreInventario_(f.name) }; })
      // Estrictamente de un dia POSTERIOR: dentro del mismo dia no se puede comparar
      // por nombre, y el xlsx del export elegido vive fuera de la carpeta de nativas.
      .filter(function (f) { return f.fecha && elegido.fecha && f.fecha > elegido.fecha; });
    if (sueltos.length) {
      aviso = 'hay un export mas nuevo sin archivar: ' + sueltos[0].nombre;
      Logger.log('CATALOGO POS: %s', aviso);
    }
  } catch (e) { /* el aviso es un extra: si falla, no rompe nada */ }

  Logger.log('CATALOGO POS: uso "%s" (%s)', nombre,
             elegido.fecha ? Utilities.formatDate(elegido.fecha, 'America/Guatemala', 'yyyy-MM-dd') : 'sin fecha');
  return { id: id, nombre: nombre, fecha: elegido.fecha, respaldo: false, aviso: aviso };
}

/** Recorre la carpeta y sus subcarpetas juntando los "Inventario_". */
function juntarInventarios_(carpetaId, out, nivel) {
  if (nivel > 4) return;                       // freno: una carpeta ciclica no cuelga esto
  var hijos = drivesListar_("'" + carpetaId + "' in parents and trashed = false");
  hijos.forEach(function (f) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      juntarInventarios_(f.id, out, nivel + 1);
      return;
    }
    // Prefijo EXACTO: en esa carpeta conviven cartas en PDF, comparativos y checklists.
    var nom = String(f.name);
    var esNativa = nom.indexOf('~nativa ') === 0;
    var base = esNativa ? nom.slice('~nativa '.length) : nom;
    if (base.indexOf(CAT_POS.prefijo) !== 0) return;
    var fecha = fechaDeNombreInventario_(base);
    if (!fecha) return;
    out.push({ id: f.id, nombre: nom, fecha: fecha, carpeta: carpetaId,
               mod: f.modifiedTime ? new Date(f.modifiedTime).getTime() : 0,
               nativa: f.mimeType === MimeType.GOOGLE_SHEETS });
  });
}
