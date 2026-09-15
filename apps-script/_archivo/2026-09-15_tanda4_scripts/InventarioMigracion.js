/**
 * InventarioMigracion.gs — Profit OS · fase 1 de la pestana Inventarios.
 *
 * Crea las dos hojas de inventario de Rosanta (una por area, una pestana por mes) y
 * copia el historico desde los archivos que hoy llevan Jeffry (cocina) y Jose (barra).
 * Decisiones de Juanma del 12-sep-2026:
 *   · las hojas son de restaurante@rosanta.rest, no de nadie del equipo: la de barra
 *     vivia en el Gmail personal de Jose, y la intranet la leia todos los dias;
 *   · solo el cierre mensual: el control diario de cerveza y el inventario semanal se
 *     quedan en la hoja de Jose;
 *   · tres tipos de producto: INSUMO (su precio alimenta el Banco de Datos), PREPARADO
 *     (el inventario lo cuenta, pero su precio lo da la receta) y REVENTA / LIMPIEZA
 *     (solo valorizan el inventario, no tocan el Banco);
 *   · el vinculo con el Banco se decide en la intranet: aca solo se vincula lo seguro y
 *     el resto queda PENDIENTE para que lo resuelva quien conoce el producto;
 *   · el cierre contado el 2 de febrero es el de ENERO: cada cierre se cuenta al
 *     arrancar el mes siguiente ("JULIO 03.08.26").
 *
 * DOS PASOS, A PROPOSITO
 *   1. migrarInventariosEnSeco() — lee todo, arma las filas, vincula, cuadra cada mes
 *      contra el total de la hoja original y deja un informe .json en Drive. No crea
 *      ninguna hoja.
 *   2. migrarInventarios() — lo mismo y, SOLO si todo cuadra, crea las dos hojas. Un
 *      area que ya tiene su hoja no se vuelve a crear: correrlo dos veces no duplica.
 *
 * NADA de esto toca el Banco de Datos ni los archivos originales. Lo unico que crea son
 * archivos nuevos: las dos hojas, los informes y la copia nativa del .xlsx de mayo
 * (Apps Script no lee un .xlsx sin convertirlo).
 *
 * LA EXISTENCIA SALE DEL MONTO, NO DEL CONTEO. En cocina el monto a veces es conteo x
 * precio ("Costilla porcion": 3 x Q20) y a veces libras x precio ("Lomito": 3 lb x Q69),
 * segun la unidad; en barra la botella va en % ("Botran oro" con 1000% = 10 botellas).
 * El monto de cada fila es lo que la persona valoro, asi que existencia = monto / precio
 * y el mes cuadra por construccion. El conteo original se guarda al lado, sin tocar.
 *
 * Es de un solo uso. Cuando la pestana Inventarios este andando, se archiva (p143).
 */

var INV_MIG = {
  carpetaDestino: '1ae8DZrqHZ7IaAZTRqnK_Frg3gLAA8nET',   // Inventarios 2026
  carpetaCocina:  '1_Wpj5vhj_YpFcZarKpxn5FwXwxZj1Dsr',   // Inventarios Cocina 2026
  barraId:        '1bjChxTx1wYy8zU0ELHKvuGb0Yb_DCfOfww9paj_dPk0',   // la hoja de Jose
  cocina: [
    { mes: '2026-05', nombre: 'FIN MAYO 26.xlsx' },
    { mes: '2026-07', id: '1P0cp0xevmmqXg7DoLIqxucKTHfMeY-PTDprzFWthGOU' }   // FIN_JULIO_26
  ],
  // titulo de la pestana de barra -> mes. El orden importa: "2 de febrero" va antes
  // que "febrero", o enero se leeria como febrero.
  mesesBarra: [
    ['2 de febrero', '2026-01'], ['febrero', '2026-02'], ['marzo', '2026-03'],
    ['abril', '2026-04'], ['mayo', '2026-05'], ['junio', '2026-06'],
    ['julio', '2026-07'], ['agosto', '2026-08']
  ],
  tolerancia: 0.05,        // quetzales de diferencia que se aceptan al cuadrar un bloque
  umbralTipeo: 0.85,       // parecido minimo para vincular solo. 0.82 vinculaba "Aceite de albahaca" con Albahaca
  pctRaro: 300,            // un destilado con mas de 300% de existencia se reporta
  propiedad: { COCINA: 'INV_COCINA_SHEET_ID', BARRA: 'INV_BARRA_SHEET_ID' },
  nombre:    { COCINA: 'Rosanta_Inventario_Cocina', BARRA: 'Rosanta_Inventario_Barra' },
  carpetaInforme: '_migracion_inventarios',
  dueno: 'restaurante@rosanta.rest',
  encabezadoMes: ['ID', 'CATEGORIA', 'PRODUCTO', 'TIPO', 'PRESENTACION', 'PROVEEDOR',
                  'PRECIO', 'EXISTENCIA', 'MONTO', 'CONTEO ORIGINAL', 'BLOQUE'],
  encabezadoProductos: ['ID', 'AREA', 'CATEGORIA', 'PRODUCTO', 'TIPO', 'VINCULO',
                        'PRODUCTO EN BANCO', 'PARECIDO', 'PRESENTACION', 'PROVEEDOR',
                        'PRECIO ACTUAL', 'ACTIVO', 'ULTIMO MES']
};

/* ---------------------------------------------------------------- puertas ---- */

/** Paso 1. No crea hojas: arma todo, cuadra y deja el informe. */
function migrarInventariosEnSeco() {
  invMigExigirDueno_();
  var res = invMigArmar_();
  var informe = invMigInforme_(res, 'en_seco');
  Logger.log('EN SECO %s. Informe: %s', res.ok ? 'TODO CUADRA' : 'NO CUADRA', informe);
  return res.ok;
}

/** Paso 2. Crea las hojas solo si todo cuadra, y nunca dos veces la misma area. */
function migrarInventarios() {
  invMigExigirDueno_();
  var res = invMigArmar_();
  var informe = invMigInforme_(res, 'real');
  if (!res.ok) throw new Error('No cuadra: no se creo ninguna hoja. Informe: ' + informe);

  var props = PropertiesService.getScriptProperties();
  ['COCINA', 'BARRA'].forEach(function (area) {
    var ya = props.getProperty(INV_MIG.propiedad[area]);
    if (ya) { Logger.log('%s ya tenia hoja (%s): no se toca.', area, ya); return; }
    var id = invMigCrearHoja_(area, res.areas[area], res.stamp);
    // se guarda apenas se crea: si la otra area falla, al reintentar esta no se duplica
    props.setProperty(INV_MIG.propiedad[area], id);
    Logger.log('%s creada: %s', area, id);
  });
}

/**
 * Las dos puertas son publicas para poder correrlas desde el editor, y por eso mismo
 * google.script.run las alcanza. Sin esto, cualquiera con la intranet abierta podria
 * crear hojas en el Drive de Rosanta.
 */
function invMigExigirDueno_() {
  var yo = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (yo !== INV_MIG.dueno) {
    throw new Error('La migracion se corre desde el editor con la cuenta ' + INV_MIG.dueno +
                    '. Sesion actual: "' + yo + '".');
  }
}

/* ------------------------------------------------------------- armado ---- */

function invMigArmar_() {
  var errores = [];
  var stamp = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var idx = indexarBancos_();

  var barra = invMigLeerBarra_(SpreadsheetApp.openById(INV_MIG.barraId), errores);

  var mesesCocina = {};
  INV_MIG.cocina.forEach(function (c) {
    try {
      var id = c.id || invMigNativaDeXlsx_(c.nombre);
      mesesCocina[c.mes] = invMigCierreCocina_(SpreadsheetApp.openById(id), c.nombre || id, errores);
    } catch (e) {
      errores.push('Cocina ' + c.mes + ': ' + (e && e.message || e));
    }
  });

  var areas = {
    COCINA: invMigArea_('COCINA', mesesCocina, idx),
    BARRA:  invMigArea_('BARRA', barra, idx)
  };
  var ok = !errores.length && areas.COCINA.cuadra && areas.BARRA.cuadra &&
           Object.keys(mesesCocina).length === INV_MIG.cocina.length &&
           Object.keys(barra).length === INV_MIG.mesesBarra.length;
  return { ok: ok, stamp: stamp, errores: errores, areas: areas };
}

/* -------------------------------------------------------------- barra ---- */

function invMigLeerBarra_(ss, errores) {
  var meses = {};
  ss.getSheets().forEach(function (hoja) {
    var d = hoja.getDataRange().getValues();
    var tit = invMigBuscar_(d, 0, Math.min(6, d.length), function (t) { return t.indexOf('cierre') === 0; });
    if (!tit) return;   // listas de precios, semanal, etc.: no son cierres

    var titulo = String(d[tit.f][tit.c]).trim(), tn = normalizar_(titulo), mes = null;
    for (var k = 0; k < INV_MIG.mesesBarra.length; k++) {
      if (tn.indexOf(INV_MIG.mesesBarra[k][0]) !== -1) { mes = INV_MIG.mesesBarra[k][1]; break; }
    }
    if (!mes) { errores.push('Barra, pestana "' + hoja.getName() + '": no reconozco el mes de "' + titulo + '"'); return; }
    if (meses[mes]) { errores.push('Barra: dos pestanas para ' + mes + ' ("' + meses[mes].origen + '" y "' + hoja.getName() + '")'); return; }
    meses[mes] = invMigCierreBarra_(hoja.getName() + ' · ' + titulo, d, errores);
  });
  return meses;
}

/**
 * Un cierre de barra son tres bloques con total propio, mas insumos sin precio:
 *   destilados — Precios | Medida (ml) | ... | % en existencia | ... | Inv Final (Q)
 *   vinos      — Casa | Unidades | Distribuidor | Precio U | Total, a la derecha
 *   cerveza    — Precio (caja) | unidades por caja | dias... | Final (Q), abajo
 * Las columnas se buscan por ETIQUETA: las pestanas viejas tienen una columna de mas.
 */
function invMigCierreBarra_(origen, d, errores) {
  var r = { origen: origen, filas: [], bloques: {}, rarezas: [] };
  var h = invMigBuscar_(d, 0, Math.min(12, d.length), function (t) { return t === 'medida (ml)'; });
  if (!h) { errores.push(origen + ': sin encabezado "Medida (ml)"'); return r; }

  var enc = d[h.f].map(function (v) { return normalizar_(v); });
  var cMl = h.c, cPrecio = enc.indexOf('precios'), cPct = enc.indexOf('% en existencia'), cFinal = enc.indexOf('inv final');
  if (cPrecio < 1 || cFinal < 0) { errores.push(origen + ': no ubico "Precios" o "Inv Final"'); return r; }
  var cProd = cPrecio - 1;

  var fCerveza = -1, fVinos = -1, cCasa = -1;
  for (var i = h.f + 1; i < d.length; i++) {
    if (fCerveza < 0 && normalizar_(d[i][cProd]) === 'cerveza') fCerveza = i;
    if (fVinos < 0) {
      for (var j = 0; j < d[i].length - 1; j++) {
        if (normalizar_(d[i][j]) === 'casa' && normalizar_(d[i][j + 1]) === 'unidades') { fVinos = i; cCasa = j; break; }
      }
    }
  }
  if (fCerveza < 0) { errores.push(origen + ': sin bloque de cerveza'); return r; }

  // destilados
  var categoria = '', totalDest = null;
  for (i = h.f + 1; i < fCerveza; i++) {
    var prod = String(d[i][cProd] || '').trim();
    var precio = invMigNum_(d[i][cPrecio]), fin = invMigNum_(d[i][cFinal]);
    if (prod && precio === null) { categoria = prod; continue; }
    if (prod && precio !== null) {
      var monto = fin || 0, pct = cPct >= 0 ? invMigNum_(d[i][cPct]) : null;
      r.filas.push({ bloque: 'DESTILADOS', categoria: categoria, producto: prod,
                     presentacion: invMigNum_(d[i][cMl]) ? invMigNum_(d[i][cMl]) + ' ml' : '',
                     proveedor: '', precio: precio, monto: monto,
                     existencia: precio > 0 ? monto / precio : 0,
                     conteo: pct === null ? '' : pct + '%' });
      if (pct !== null && pct > INV_MIG.pctRaro) r.rarezas.push(prod + ': ' + pct + '% de existencia');
      continue;
    }
    if (!prod && fin !== null && fin > 0) totalDest = fin;   // la ultima suma antes de la cerveza
  }
  r.bloques.DESTILADOS = { fuente: totalDest };

  // vinos e insumos (columna a la derecha)
  if (fVinos >= 0) {
    var totalVinos = null, enInsumos = false;
    for (i = fVinos + 1; i < d.length; i++) {
      var casa = String(d[i][cCasa] || '').trim(), n = normalizar_(casa);
      if (normalizar_(d[i][cCasa + 3]).indexOf('total') === 0) { totalVinos = invMigNum_(d[i][cCasa + 4]); continue; }
      if (n === 'insumos') { enInsumos = true; continue; }
      if (!casa) { if (enInsumos) break; continue; }
      if (enInsumos) {
        r.filas.push({ bloque: 'INSUMOS', categoria: 'Insumos de barra', producto: casa, presentacion: '',
                       proveedor: String(d[i][cCasa + 2] || '').trim(), precio: null, monto: 0,
                       existencia: invMigNum_(d[i][cCasa + 1]) || 0, conteo: '' });
        continue;
      }
      var pu = invMigNum_(d[i][cCasa + 3]);
      if (pu === null) continue;
      var uni = invMigNum_(d[i][cCasa + 1]) || 0, tot = invMigNum_(d[i][cCasa + 4]);
      var mv = tot !== null ? tot : uni * pu;
      r.filas.push({ bloque: 'VINOS', categoria: 'Vinos', producto: casa, presentacion: 'botella',
                     proveedor: String(d[i][cCasa + 2] || '').trim(), precio: pu, monto: mv,
                     existencia: pu > 0 ? mv / pu : 0, conteo: uni });
    }
    r.bloques.VINOS = { fuente: totalVinos };
  }

  // cerveza y refrescos: precio por caja / unidades por caja = precio por unidad
  var totalCerv = null;
  for (i = fCerveza + 1; i < d.length; i++) {
    var pc = String(d[i][cProd] || '').trim();
    var caja = invMigNum_(d[i][cPrecio]), porCaja = invMigNum_(d[i][cMl]), fc = invMigNum_(d[i][cFinal]);
    if (pc && caja !== null) {
      var unidad = porCaja > 0 ? caja / porCaja : caja, mc = fc || 0;
      r.filas.push({ bloque: 'CERVEZA', categoria: 'Cervezas y refrescos', producto: pc,
                     presentacion: porCaja ? 'caja de ' + porCaja : '', proveedor: '',
                     precio: unidad, monto: mc, existencia: unidad > 0 ? mc / unidad : 0, conteo: '' });
      continue;
    }
    if (!pc && fc !== null && fc > 0) totalCerv = fc;
  }
  r.bloques.CERVEZA = { fuente: totalCerv };
  return r;
}

/* ------------------------------------------------------------- cocina ---- */

/**
 * Un cierre de cocina son tres pestanas: precios (PRODUCTO | PRECIO ANTERIOR | PRECIO
 * ACTUALIZADO | PRESENTACION | PROVEEDOR), existencias (PRODUCTO | EXISTENCAS | EN LIBRAS
 * o POR PRESENTACION | PRECIO | MONTO, con un TOTAL por categoria) y resumen (TOTAL EN
 * COCINA ROSANTA). Se reconocen por su encabezado, no por el nombre de la pestana.
 */
function invMigCierreCocina_(ss, origen, errores) {
  var r = { origen: origen, filas: [], bloques: {}, rarezas: [] };
  var hojas = ss.getSheets().map(function (h) { return { nombre: h.getName(), d: h.getDataRange().getValues() }; });
  var tiene = function (x, etiqueta) { return !!invMigBuscar_(x.d, 0, x.d.length, function (t) { return t === etiqueta; }); };
  var pPrecios = hojas.filter(function (x) { return tiene(x, 'precio actualizado'); })[0];
  var pConteo  = hojas.filter(function (x) { return tiene(x, 'existencas') || tiene(x, 'existencias'); })[0];
  var pResumen = hojas.filter(function (x) {
    return !!invMigBuscar_(x.d, 0, x.d.length, function (t) { return t.indexOf('total en cocina') === 0; });
  })[0];
  if (!pConteo) { errores.push(origen + ': sin pestana de existencias'); return r; }

  // precios, presentacion y proveedor por producto
  var info = {};
  if (pPrecios) {
    invMigBloquesCocina_(pPrecios.d, 'precio anterior').forEach(function (b) {
      b.filas.forEach(function (f) {
        var prod = String(f[b.c] || '').trim();
        if (!prod) return;
        var k = normalizar_(prod);
        (info[k] = info[k] || []).push({
          grupo: invMigGrupoCocina_(b.categoria),
          presentacion: String(f[b.c + 3] || '').trim(), proveedor: String(f[b.c + 4] || '').trim()
        });
      });
    });
  }

  invMigBloquesCocina_(pConteo.d, 'existencas', 'existencias').forEach(function (b) {
    var grupo = invMigGrupoCocina_(b.categoria), suma = null;
    b.filas.forEach(function (f) {
      var prod = String(f[b.c] || '').trim(), celdas = f.map(function (v) { return normalizar_(v); });
      var monto = invMigNum_(f[b.c + 4]), precio = invMigNum_(f[b.c + 3]);
      // el total a veces trae etiqueta ("TOTAL", "total") y a veces es solo el numero
      if (celdas.indexOf('total') !== -1 || (!prod && monto !== null && invMigNum_(f[b.c + 1]) === null)) {
        suma = monto !== null ? monto : invMigUltimoNumero_(f);
        return;
      }
      if (!prod) return;
      var ex = info[normalizar_(prod)] || [];
      var par = ex.filter(function (e) { return e.grupo === grupo; })[0] || ex[0] || {};
      var m = monto || 0;
      if (m > 0 && !(precio > 0)) r.rarezas.push(prod + ': monto Q' + m + ' sin precio');
      r.filas.push({ bloque: b.categoria, categoria: b.categoria, producto: prod,
                     presentacion: par.presentacion || '', proveedor: par.proveedor || '',
                     precio: precio, monto: m, existencia: precio > 0 ? m / precio : 0,
                     conteo: invMigNum_(f[b.c + 1]) === null ? '' : invMigNum_(f[b.c + 1]) });
    });
    r.bloques[b.categoria] = { fuente: suma };
  });

  if (pResumen) {
    var t = invMigBuscar_(pResumen.d, 0, pResumen.d.length, function (x) { return x.indexOf('total en cocina') === 0; });
    r.bloques._TOTAL = { fuente: invMigUltimoNumero_(pResumen.d[t.f]) };
  } else {
    errores.push(origen + ': sin pestana de resumen, no hay total contra que cuadrar');
  }
  return r;
}

/** Bloques de una pestana de cocina: la fila de encabezado y su categoria (el titulo de arriba). */
function invMigBloquesCocina_(d, segunda, segundaAlt) {
  var bloques = [], actual = null, titulo = '';
  for (var i = 0; i < d.length; i++) {
    var fila = d[i], c = -1;
    for (var j = 0; j < fila.length - 1; j++) {
      var s = normalizar_(fila[j + 1]);
      if (normalizar_(fila[j]) === 'producto' && (s === segunda || s === segundaAlt)) { c = j; break; }
    }
    if (c >= 0) { actual = { categoria: titulo || 'SIN CATEGORIA', c: c, filas: [] }; bloques.push(actual); continue; }
    var llenas = fila.filter(function (v) { return String(v == null ? '' : v).trim(); });
    if (llenas.length === 1 && invMigNum_(llenas[0]) === null && normalizar_(llenas[0]) !== 'total') {
      titulo = String(llenas[0]).replace(/\s+\.\s*$/, '').trim();
      actual = null;
      continue;
    }
    if (actual) actual.filas.push(fila);
  }
  return bloques;
}

/** "PRODUCCION ROSANTA" y "DOORWAYS-VIJUSA" cambian el tipo; el resto es un solo grupo. */
function invMigGrupoCocina_(categoria) {
  var c = normalizar_(categoria);
  if (c.indexOf('produccion rosanta') === 0) return 'PREPARADO';
  // el informe contable la llama "INSUMOS DE LIMPIEZA (DOORWAYS/VIJUSA)"
  if (c.indexOf('doorways') !== -1 || c.indexOf('insumos de limpieza') === 0) return 'LIMPIEZA';
  return 'GENERAL';
}

function invMigNativaDeXlsx_(nombre) {
  var carpeta = invMigCarpetaInforme_();
  var copiaNombre = '_mig ' + nombre.replace(/\.xlsx$/i, '');
  var ya = carpeta.getFilesByName(copiaNombre);
  if (ya.hasNext()) return ya.next().getId();
  var it = DriveApp.getFolderById(INV_MIG.carpetaCocina).getFilesByName(nombre);
  if (!it.hasNext()) throw new Error('No encuentro "' + nombre + '" en Inventarios Cocina 2026');
  // Drive v3 (ver appsscript.json): la conversion se pide con el mimeType destino
  return Drive.Files.copy({ name: copiaNombre, mimeType: MimeType.GOOGLE_SHEETS, parents: [carpeta.getId()] },
                          it.next().getId()).id;
}

/* ------------------------------------------------ vinculo, tipo, cuadre ---- */

function invMigArea_(area, meses, idx) {
  var vinculos = {}, catalogo = {}, cuadre = [], cuadra = true, rarezas = [];
  var claves = Object.keys(meses).sort();

  claves.forEach(function (mes) {
    var m = meses[mes];
    m.filas.forEach(function (f) {
      var nk = normalizar_(f.producto);
      var v = vinculos[nk] || (vinculos[nk] = invMigVincular_(idx, area, f.producto));
      f.tipo = invMigTipo_(area, f, v);
      var clave = (f.tipo === 'PREPARADO' ? 'P' : f.tipo === 'LIMPIEZA' ? 'L' : f.bloque === 'INSUMOS' ? 'I' : 'G') + '|' + nk;
      f.clave = clave;
      var c = catalogo[clave] || (catalogo[clave] = {
        area: area, categoria: f.categoria, producto: f.producto, tipo: f.tipo,
        vinculo: v.como, banco: v.banco, parecido: v.parecido || '', presentacion: '', proveedor: '',
        precio: null, ultimoMes: ''
      });
      // lo mas reciente manda: los meses van en orden
      c.categoria = f.categoria; c.producto = f.producto; c.ultimoMes = mes;
      if (f.presentacion) c.presentacion = f.presentacion;
      if (f.proveedor) c.proveedor = f.proveedor;
      if (f.precio !== null) c.precio = f.precio;
    });

    Object.keys(m.bloques).forEach(function (b) {
      var fuente = m.bloques[b].fuente;
      var calc = m.filas.reduce(function (s, f) { return s + (b === '_TOTAL' || f.bloque === b ? f.monto : 0); }, 0);
      var dif = fuente === null ? null : Math.round((calc - fuente) * 100) / 100;
      var ok = fuente !== null && Math.abs(dif) <= INV_MIG.tolerancia;
      if (!ok) cuadra = false;
      cuadre.push({ mes: mes, bloque: b, fuente: fuente, calculado: Math.round(calc * 100) / 100, diferencia: dif, ok: ok });
    });
    m.rarezas.forEach(function (x) { rarezas.push(mes + ' · ' + x); });
  });

  // IDs estables: por categoria y producto, en el orden en que se leen
  var ultimo = claves[claves.length - 1], n = 0, pre = area === 'COCINA' ? 'C-' : 'B-';
  Object.keys(catalogo).sort(function (a, b) {
    var x = catalogo[a], y = catalogo[b];
    return (x.categoria + '|' + x.producto).localeCompare(y.categoria + '|' + y.producto);
  }).forEach(function (k) {
    catalogo[k].id = pre + ('000' + (++n)).slice(-3);
    catalogo[k].activo = catalogo[k].ultimoMes === ultimo ? 'SI' : 'NO';
  });
  claves.forEach(function (mes) { meses[mes].filas.forEach(function (f) { f.id = catalogo[f.clave].id; }); });

  var porVinculo = {};
  Object.keys(catalogo).forEach(function (k) { var v = catalogo[k].vinculo; porVinculo[v] = (porVinculo[v] || 0) + 1; });
  return { meses: meses, catalogo: catalogo, cuadre: cuadre, cuadra: cuadra && claves.length > 0,
           rarezas: rarezas, porVinculo: porVinculo, productos: n };
}

/** Solo lo seguro: exacto, alias, la otra area o un tipeo claro. El resto, a la intranet. */
function invMigVincular_(idx, area, producto) {
  var k = normalizar_(producto), ficha = function (b, como, s) {
    return { banco: b.producto, como: como, parecido: s || '' };
  };
  if (idx[area + '|' + k]) return ficha(idx[area + '|' + k], 'EXACTO');
  var al = INVENTARIO.alias[k];
  if (al && idx[area + '|' + normalizar_(al)]) return ficha(idx[area + '|' + normalizar_(al)], 'ALIAS');
  var otra = area === 'COCINA' ? 'BARRA' : 'COCINA';
  if (idx[otra + '|' + k]) return ficha(idx[otra + '|' + k], 'OTRA_AREA');

  var mejor = null, s = 0;
  Object.keys(idx).forEach(function (key) {
    if (key.indexOf(area + '|') !== 0) return;
    var v = similitud_(producto, idx[key].producto);
    if (v > s) { s = v; mejor = idx[key]; }
  });
  if (mejor && s >= INV_MIG.umbralTipeo) return ficha(mejor, 'TIPEO', Math.round(s * 100) / 100);
  return { banco: '', como: 'PENDIENTE', parecido: '' };
}

function invMigTipo_(area, f, v) {
  if (area === 'COCINA') {
    var g = invMigGrupoCocina_(f.categoria);
    if (g !== 'GENERAL') return g;
    return v.como === 'PENDIENTE' ? 'POR CLASIFICAR' : 'INSUMO';
  }
  if (f.bloque === 'INSUMOS') return 'INSUMO';
  if (v.como !== 'PENDIENTE') return 'INSUMO';
  // un destilado que no esta en el Banco puede ser un vinculo que falta ("Amaretto Cream")
  if (f.bloque === 'DESTILADOS') return 'POR CLASIFICAR';
  return 'REVENTA';   // vinos, cervezas y refrescos que no estan en ninguna receta
}

/* ------------------------------------------------------------- salida ---- */

function invMigCarpetaInforme_() {
  var dest = DriveApp.getFolderById(INV_MIG.carpetaDestino);
  var it = dest.getFoldersByName(INV_MIG.carpetaInforme);
  return it.hasNext() ? it.next() : dest.createFolder(INV_MIG.carpetaInforme);
}

/** El informe es un .json en Drive: se lee entero, sin depender del registro del editor. */
function invMigInforme_(res, modo) {
  var nombre = res.stamp.replace(/[: ]/g, '').replace(/-/g, '') + '_informe_' + modo + '.json';
  invMigCarpetaInforme_().createFile(nombre, JSON.stringify(res, null, 1), MimeType.PLAIN_TEXT);
  ['COCINA', 'BARRA'].forEach(function (a) {
    var x = res.areas[a];
    Logger.log('%s: %s productos, vinculos %s, %s', a, x.productos, JSON.stringify(x.porVinculo), x.cuadra ? 'cuadra' : 'NO CUADRA');
    x.cuadre.filter(function (c) { return !c.ok; }).forEach(function (c) {
      Logger.log('   %s %s: fuente %s, calculado %s, diferencia %s', c.mes, c.bloque, c.fuente, c.calculado, c.diferencia);
    });
  });
  res.errores.forEach(function (e) { Logger.log('ERROR: %s', e); });
  return nombre;
}

function invMigCrearHoja_(area, datos, stamp) {
  var ss = SpreadsheetApp.create(INV_MIG.nombre[area]);
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(INV_MIG.carpetaDestino));

  var leeme = ss.getSheets()[0];
  leeme.setName('LEEME');
  var lineas = [
    ['Inventario de ' + area.toLowerCase() + ' de Rosanta. Se carga desde la intranet (Profit OS › Inventarios).'],
    ['Una pestana por mes (AAAA-MM). Un mes CERRADO no se edita.'],
    ['PRODUCTOS es el catalogo: tipo, vinculo con el Banco de Datos y si esta activo.'],
    ['Tipos: INSUMO (su precio alimenta el Banco) · PREPARADO (lo cuenta el inventario, el precio lo da la receta) · REVENTA / LIMPIEZA (solo valorizan).'],
    ['Vinculo PENDIENTE o tipo POR CLASIFICAR: lo resuelve cocina o barra desde la intranet.'],
    ['Migrado el ' + stamp + ' desde los archivos originales, que no se tocaron.']
  ];
  leeme.getRange(1, 1, lineas.length, 1).setValues(lineas);

  var cat = datos.catalogo, filasProd = Object.keys(cat).map(function (k) { return cat[k]; })
    .sort(function (a, b) { return a.id.localeCompare(b.id); })
    .map(function (c) {
      return [c.id, c.area, c.categoria, c.producto, c.tipo, c.vinculo, c.banco, c.parecido,
              c.presentacion, c.proveedor, c.precio === null ? '' : c.precio, c.activo, c.ultimoMes];
    });
  var hp = ss.insertSheet('PRODUCTOS');
  invMigEscribir_(hp, INV_MIG.encabezadoProductos, filasProd, 1);

  Object.keys(datos.meses).sort().forEach(function (mes) {
    var m = datos.meses[mes], ancho = INV_MIG.encabezadoMes.length;
    var filas = m.filas.map(function (f) {
      return [f.id, f.categoria, f.producto, f.tipo, f.presentacion, f.proveedor,
              f.precio === null ? '' : f.precio, Math.round(f.existencia * 10000) / 10000, f.monto, f.conteo, f.bloque];
    });
    var total = m.filas.reduce(function (s, f) { return s + f.monto; }, 0);
    filas.push(['', '', 'TOTAL', '', '', '', '', '', Math.round(total * 100) / 100, '', '']);
    var h = ss.insertSheet(mes);
    var meta = ['CIERRE', mes, 'ESTADO', 'CERRADO', 'ORIGEN', m.origen, 'MIGRADO', stamp, '', '', ''];
    h.getRange(1, 1, 1, ancho).setValues([meta]);
    invMigEscribir_(h, INV_MIG.encabezadoMes, filas, 3);
  });
  SpreadsheetApp.flush();
  return ss.getId();
}

function invMigEscribir_(hoja, encabezado, filas, filaEnc) {
  hoja.getRange(filaEnc, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight('bold');
  if (filas.length) hoja.getRange(filaEnc + 1, 1, filas.length, encabezado.length).setValues(filas);
  hoja.setFrozenRows(filaEnc);
}

/* ------------------------------------------------------------ utiles ---- */

function invMigBuscar_(d, desde, hasta, prueba) {
  for (var i = desde; i < hasta; i++) {
    for (var j = 0; j < d[i].length; j++) if (prueba(normalizar_(d[i][j]))) return { f: i, c: j };
  }
  return null;
}

function invMigUltimoNumero_(fila) {
  for (var j = fila.length - 1; j >= 0; j--) { var n = invMigNum_(fila[j]); if (n !== null) return n; }
  return null;
}

/** Numero de una celda: nativo, o texto con Q, espacios y separadores de cualquiera de los dos estilos. */
function invMigNum_(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var s = String(v == null ? '' : v).replace(/q/gi, '').replace(/\s/g, '');
  if (!s || !/\d/.test(s)) return null;
  var coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (coma > -1) s = s.replace(',', '.');
  var n = Number(s);
  return isNaN(n) ? null : n;
}

/* ======================================================================
 * AGREGADOS DEL 12-SEP-2026, despues de la migracion (decisiones de Juanma)
 *
 *   · JUNIO DE COCINA. "FIN JUNIO 26" no esta en la carpeta de cocina, pero el informe
 *     contable de junio (hoja nativa Rosanta_Inventarios_Cierre_Junio_2026) trae el
 *     detalle: producto, existencias, precio y monto por categoria. Su total, Q6,914.83,
 *     coincide con el artefacto de inventarios. No trae proveedor ni presentacion: salen
 *     del catalogo PRODUCTOS.
 *   · BOTRAN ORO, AGOSTO. En la hoja de Jose la columna "% en existencia" dice 1000 —
 *     el tamano de la botella en ml—, cuando julio decia 100. Se corrige a 100% (Q75) y
 *     la celda de conteo deja escrito que se corrigio.
 * ====================================================================== */

INV_MIG.junioCocina = { mes: '2026-06', id: '1fPpls09CpKaJAwmVVxv5dwwy3rHMibqAKkNzmCKlEiw', hoja: 'Cocina' };
// nombres del informe contable -> los del catalogo, para que junio se filtre igual que mayo y julio
INV_MIG.categoriasJunio = {
  'carnes': 'CARNES', 'mariscos': 'MARISCOS', 'aves y lacteos': 'AVES Y LACTEOS',
  'abarrotes': 'ABARROTES', 'verduras y especias': 'VERDURAS Y ESPECIAS',
  'produccion rosanta (elaborados)': 'PRODUCCION ROSANTA',
  'insumos de limpieza (doorways/vijusa)': 'DOORWAYS-VIJUASA'
};

function migrarJunioCocinaEnSeco() {
  soloDueno_(); return invMigJunio_(false); }
function migrarJunioCocina() {
  soloDueno_(); return invMigJunio_(true); }

function invMigJunio_(escribir) {
  invMigExigirDueno_();
  var cfg = INV_MIG.junioCocina;
  var idHoja = PropertiesService.getScriptProperties().getProperty(INV_MIG.propiedad.COCINA);
  if (!idHoja) throw new Error('Todavia no existe la hoja de cocina (' + INV_MIG.propiedad.COCINA + ').');
  var ss = SpreadsheetApp.openById(idHoja);
  if (ss.getSheetByName(cfg.mes)) throw new Error('La pestana ' + cfg.mes + ' ya existe en la hoja de cocina: no se toca.');
  var julio = ss.getSheetByName('2026-07');
  var fuente = SpreadsheetApp.openById(cfg.id).getSheetByName(cfg.hoja);
  if (!fuente) throw new Error('El informe de junio no tiene la pestana "' + cfg.hoja + '".');

  // --- leer el informe: encabezado "<CATEGORIA> | Existencias | Precio | Monto", filas, "Subtotal ...", "TOTAL COCINA"
  var d = fuente.getDataRange().getValues();
  var filas = [], bloques = {}, cols = null, categoria = '', total = null, errores = [];
  for (var i = 0; i < d.length; i++) {
    var jEx = -1;
    for (var j = 1; j < d[i].length; j++) if (normalizar_(d[i][j]) === 'existencias') { jEx = j; break; }
    if (jEx > 0) {
      var nc = normalizar_(d[i][jEx - 1]);
      categoria = INV_MIG.categoriasJunio[nc] || String(d[i][jEx - 1]).trim();
      if (!INV_MIG.categoriasJunio[nc]) errores.push('Categoria sin equivalencia: "' + d[i][jEx - 1] + '"');
      cols = { prod: jEx - 1, ex: jEx, pre: jEx + 1, mon: jEx + 2 };
      continue;
    }
    if (!cols) continue;
    var etiqueta = String(d[i][cols.prod] == null ? '' : d[i][cols.prod]).trim(), en = normalizar_(etiqueta);
    if (!etiqueta) continue;
    if (en.indexOf('subtotal') === 0) { bloques[categoria] = { fuente: invMigNum_(d[i][cols.mon]) }; continue; }
    if (en.indexOf('total cocina') === 0) { total = invMigNum_(d[i][cols.mon]); continue; }
    var precio = invMigNum_(d[i][cols.pre]), monto = invMigNum_(d[i][cols.mon]), ex = invMigNum_(d[i][cols.ex]);
    if (precio === null && monto === null && ex === null) continue;
    filas.push({ bloque: categoria, categoria: categoria, producto: etiqueta, precio: precio,
                 monto: monto || 0, existencia: precio > 0 ? (monto || 0) / precio : 0,
                 conteo: ex === null ? '' : ex });
  }
  bloques._TOTAL = { fuente: total };

  // --- catalogo: el mismo producto conserva su ID; lo que no esta, entra con el ID siguiente
  var hp = ss.getSheetByName('PRODUCTOS'), cat = hp.getDataRange().getValues(), enc = cat[0];
  var col = {}; enc.forEach(function (h, k) { col[normalizar_(h)] = k; });
  var porClave = {}, maxId = 0;
  for (i = 1; i < cat.length; i++) {
    var id = String(cat[i][col['id']] || '');
    if (!id) continue;
    maxId = Math.max(maxId, Number(id.replace(/\D/g, '')) || 0);
    var t = String(cat[i][col['tipo']]);
    porClave[(t === 'PREPARADO' ? 'P' : t === 'LIMPIEZA' ? 'L' : 'G') + '|' + normalizar_(cat[i][col['producto']])] = cat[i];
  }
  var idx = null, nuevos = [];
  filas.forEach(function (f) {
    var g = invMigGrupoCocina_(f.categoria), clave = (g === 'PREPARADO' ? 'P' : g === 'LIMPIEZA' ? 'L' : 'G') + '|' + normalizar_(f.producto);
    var c = porClave[clave];
    if (c) {
      f.id = c[col['id']]; f.tipo = c[col['tipo']];
      f.presentacion = c[col['presentacion']] || ''; f.proveedor = c[col['proveedor']] || '';
      return;
    }
    idx = idx || indexarBancos_();
    var v = invMigVincular_(idx, 'COCINA', f.producto);
    f.id = 'C-' + ('000' + (++maxId)).slice(-3); f.tipo = invMigTipo_('COCINA', f, v);
    f.presentacion = ''; f.proveedor = '';
    // no esta en julio, que es el ultimo mes: entra inactivo
    var fila = enc.map(function () { return ''; });
    fila[col['id']] = f.id; fila[col['area']] = 'COCINA'; fila[col['categoria']] = f.categoria;
    fila[col['producto']] = f.producto; fila[col['tipo']] = f.tipo; fila[col['vinculo']] = v.como;
    fila[col['producto en banco']] = v.banco; fila[col['parecido']] = v.parecido;
    fila[col['precio actual']] = f.precio === null ? '' : f.precio; fila[col['activo']] = 'NO'; fila[col['ultimo mes']] = cfg.mes;
    porClave[clave] = fila; nuevos.push(fila);
  });

  // --- cuadre
  var cuadre = [], cuadra = total !== null && filas.length > 0;
  Object.keys(bloques).forEach(function (b) {
    var fte = bloques[b].fuente;
    var calc = filas.reduce(function (s, f) { return s + (b === '_TOTAL' || f.bloque === b ? f.monto : 0); }, 0);
    var dif = fte === null ? null : Math.round((calc - fte) * 100) / 100;
    var ok = fte !== null && Math.abs(dif) <= INV_MIG.tolerancia;
    if (!ok) cuadra = false;
    cuadre.push({ bloque: b, fuente: fte, calculado: Math.round(calc * 100) / 100, diferencia: dif, ok: ok });
  });
  if (errores.length) cuadra = false;

  var res = { ok: cuadra, escribir: escribir, mes: cfg.mes, filas: filas.length, nuevos: nuevos.length,
              cuadre: cuadre, errores: errores, stamp: Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm') };
  Logger.log('JUNIO COCINA %s: %s filas, %s productos nuevos, %s', escribir ? 'REAL' : 'EN SECO', filas.length, nuevos.length, cuadra ? 'CUADRA' : 'NO CUADRA');
  cuadre.forEach(function (c) { Logger.log('   %s %s: fuente %s, calculado %s, diferencia %s', c.ok ? 'ok ' : 'MAL', c.bloque, c.fuente, c.calculado, c.diferencia); });
  errores.forEach(function (e) { Logger.log('ERROR: %s', e); });
  invMigCarpetaInforme_().createFile(res.stamp.replace(/[: -]/g, '') + '_junio_cocina_' + (escribir ? 'real' : 'en_seco') + '.json',
                                     JSON.stringify({ res: res, filas: filas, nuevos: nuevos }, null, 1), MimeType.PLAIN_TEXT);
  if (!escribir) return res;
  if (!cuadra) throw new Error('Junio no cuadra: no se escribio nada.');

  // --- escribir: la pestana va entre 2026-05 y 2026-07
  var h = julio ? ss.insertSheet(cfg.mes, julio.getIndex() - 1) : ss.insertSheet(cfg.mes);
  var ancho = INV_MIG.encabezadoMes.length;
  var valores = filas.map(function (f) {
    return [f.id, f.categoria, f.producto, f.tipo, f.presentacion, f.proveedor, f.precio === null ? '' : f.precio,
            Math.round(f.existencia * 10000) / 10000, f.monto, f.conteo, f.bloque];
  });
  var suma = filas.reduce(function (s, f) { return s + f.monto; }, 0);
  valores.push(['', '', 'TOTAL', '', '', '', '', '', Math.round(suma * 100) / 100, '', '']);
  h.getRange(1, 1, 1, ancho).setValues([['CIERRE', cfg.mes, 'ESTADO', 'CERRADO', 'ORIGEN',
    'Informe contable de junio (Rosanta_Inventarios_Cierre_Junio_2026)', 'MIGRADO', res.stamp, '', '', '']]);
  invMigEscribir_(h, INV_MIG.encabezadoMes, valores, 3);
  if (nuevos.length) hp.getRange(hp.getLastRow() + 1, 1, nuevos.length, enc.length).setValues(nuevos);
  SpreadsheetApp.flush();
  Logger.log('Pestana %s creada con %s filas; %s productos nuevos en PRODUCTOS.', cfg.mes, filas.length, nuevos.length);
  return res;
}

function corregirBotranOroAgosto() {
  invMigExigirDueno_();
  var idHoja = PropertiesService.getScriptProperties().getProperty(INV_MIG.propiedad.BARRA);
  if (!idHoja) throw new Error('Todavia no existe la hoja de barra.');
  var h = SpreadsheetApp.openById(idHoja).getSheetByName('2026-08');
  if (!h) throw new Error('La hoja de barra no tiene la pestana 2026-08.');
  var d = h.getDataRange().getValues(), col = {};
  d[2].forEach(function (x, k) { col[normalizar_(x)] = k; });   // el encabezado va en la fila 3
  var fBotran = -1, fTotal = -1;
  for (var i = 3; i < d.length; i++) {
    var p = normalizar_(d[i][col['producto']]);
    if (p === 'botran oro') fBotran = i;
    if (p === 'total') fTotal = i;
  }
  if (fBotran < 0 || fTotal < 0) throw new Error('No encuentro la fila de Botran oro o la de TOTAL en 2026-08.');
  var monto = invMigNum_(d[fBotran][col['monto']]), precio = invMigNum_(d[fBotran][col['precio']]);
  var conteo = String(d[fBotran][col['conteo original']]);
  // Sheets convierte el texto "1000%" en el NUMERO 10 con formato de porcentaje: en la celda
  // se ve 1000%, pero getValues() devuelve 10. La primera corrida se nego por eso (bien).
  var esMil = conteo.indexOf('1000') === 0 || invMigNum_(d[fBotran][col['conteo original']]) === 10;
  // solo corrige el error que se vio: si ya no dice 1000% y Q750, alguien ya lo toco
  if (monto !== 750 || !esMil || precio !== 75) {
    throw new Error('Botran oro no esta como se esperaba (monto ' + monto + ', precio ' + precio + ', conteo "' + conteo + '"): no se toca.');
  }
  var antes = invMigNum_(d[fTotal][col['monto']]);
  var suma = 0;
  for (i = 3; i < fTotal; i++) suma += (i === fBotran ? 75 : (invMigNum_(d[i][col['monto']]) || 0));
  suma = Math.round(suma * 100) / 100;
  h.getRange(fBotran + 1, col['existencia'] + 1).setValue(1);
  h.getRange(fBotran + 1, col['monto'] + 1).setValue(75);
  h.getRange(fBotran + 1, col['conteo original'] + 1).setValue('1000% en la hoja de Jose (era la medida en ml); corregido a 100% por Juanma, 12-sep-2026');
  h.getRange(fTotal + 1, col['monto'] + 1).setValue(suma);
  SpreadsheetApp.flush();
  Logger.log('Botran oro corregido: Q750 -> Q75. Total de agosto: Q%s -> Q%s', antes, suma);
  return { antes: antes, despues: suma };
}
