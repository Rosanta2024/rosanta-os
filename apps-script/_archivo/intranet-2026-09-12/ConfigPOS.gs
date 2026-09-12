/**
 * ConfigPOS.gs — Profit OS · puente entre el recetario y el POS.
 *
 * REGLA: el POS manda en la nomenclatura. Si un nombre no coincide, se ajusta el
 * documento, nunca el POS.
 *
 * NO HAY DATOS EN ESTE ARCHIVO. Todo se lee del recetario:
 *
 *   RESUMEN CMV  columna B = plato · H = nombre en el POS · I = llave del POS
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
  cacheKey:    'pos_mapa_v1',
  cacheSegs:   900
};

/**
 * Lee las dos hojas y arma el mapa. Cacheado 15 minutos.
 * { platos:{ficha:{pos,llave}}, porPos:{nombreNorm:ficha},
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

  var out = { platos: {}, porPos: {}, ignorar: [], retirar: [], sinFicha: [],
              alta: [], nota: [], tipo: [], catCocina: [] };

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
    out.platos[plato] = { pos: nom, llave: llave };
    out.porPos[normalizar_(nom)] = plato;
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
  Logger.log('platos mapeados: %s | ignorar: %s | retirar: %s | sin ficha: %s | notas: %s',
             Object.keys(m.platos).length, m.ignorar.length, m.retirar.length,
             m.sinFicha.length, m.nota.length);
  return m;
}

/** Nombre del POS para una ficha del recetario. Devuelve la ficha si no hay mapa. */
function nombrePOS_(ficha) {
  var m = mapaPOS_().platos[String(ficha).trim()];
  return m ? m.pos : String(ficha).trim();
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
