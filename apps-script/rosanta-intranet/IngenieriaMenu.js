/**
 * IngenieriaMenu.gs — La matriz de ingenieria de menu. Solo LEE.
 *
 * Cruza cuatro fuentes:
 *   RESUMEN CMV del recetario  -> costo, precio y categoria de COCINA
 *   catalogo del POS           -> costo (Pcompra), precio y categoria de BARRA
 *   VENTAS x PLATO             -> unidades, filtrando por ventana
 *   ConfigPOS.gs               -> el puente de nombres recetario <-> POS
 *
 * DOS REGLAS QUE NO SON DETALLES:
 *
 * 1. El margen usa el PRECIO DE CARTA VIGENTE, no el Precio_Venta de la linea. Las
 *    unidades son historia; la decision es hacia adelante. Entre enero y agosto
 *    cambiaron de precio el Lomito ROSANTA, la Coliflor, los cocteles, las cervezas
 *    Antigua y varios vinos: usar el precio historico daria un margen que ya no existe.
 *
 * 2. Solo entra a la clasificacion y al MC promedio lo que tiene COSTO FIRME.
 *    Cocina: ESTADO DEL COSTEO == 'costeado' exacto. Barra: Pcompra > 0.
 *    El resto sale como SIN CLASIFICAR y va al contador del punto ciego.
 *    Clasificar sin costo seria inventar, y una matriz con datos inventados es peor
 *    que no tener matriz.
 *
 * Y COMO SE CRUZA CADA LADO, QUE ES DISTINTO:
 *   COCINA por NOMBRE. La categoria la manda el recetario, no la linea de venta: el
 *     POS mete el mismo plato en 'Entrante', 'Fuerte' o 'General' segun quien marque.
 *   BARRA por NOMBRE + CATEGORIA DEL POS. 'Tinto - La Linda' es copa (Q65) y botella
 *     (Q350) con el mismo nombre. Cruzar solo por nombre da un margen inventado.
 */

var IMENU = {
  hojaVentas: 'VENTAS x PLATO',
  // Del catalogo del POS. Se busca por nombre de encabezado, no por posicion.
  encPos: { nombre: 'nombre', precio: 'pventa', costo: 'pcompra', categoria: 'categoria' },
  // De RESUMEN CMV. Tiene una columna A vacia, por eso POS_CFG usa colPlato:2.
  encCmv: { plato: 'plato', categoria: 'categoria', precio: 'precio 2027',
            costo: 'costo', estado: 'estado del costeo', pos: 'nombre en el pos' },
  estadoFirme: 'costeado',
  factorUmbral: 0.70,
  ventaMinimaAlMes: 1        // piso de demanda para la lista de sala
};

/* ==========================================================================
   LO QUE SE LEE
   ========================================================================== */

/** Indice por nombre de encabezado. Asumir el orden es como se rompio el cierre. */
function indicePorEncabezado_(fila) {
  var idx = {};
  fila.forEach(function (v, i) {
    var k = normalizar_(v);
    if (k && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

/** RESUMEN CMV del recetario de cocina, por nombre de plato normalizado. */
function leerResumenCMV_() {
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  if (!ss) throw new Error('Falta RECETARIO_COCINA_SHEET_ID');
  var h = ss.getSheetByName(POS_CFG.hojaResumen);
  if (!h) throw new Error('El recetario no tiene la pestana ' + POS_CFG.hojaResumen);

  var datos = h.getDataRange().getValues(), enc = -1, idx = {};
  for (var r = 0; r < Math.min(datos.length, 12) && enc === -1; r++) {
    var i = indicePorEncabezado_(datos[r]);
    if (i[IMENU.encCmv.plato] !== undefined && i[IMENU.encCmv.estado] !== undefined) { enc = r; idx = i; }
  }
  if (enc === -1) throw new Error('No encontre el encabezado de ' + POS_CFG.hojaResumen);

  var out = {};
  for (var f = enc + 1; f < datos.length; f++) {
    var fila = datos[f];
    var plato = String(fila[idx[IMENU.encCmv.plato]] || '').trim();
    if (!plato) continue;
    out[normalizar_(plato)] = {
      plato: plato,
      categoria: String(fila[idx[IMENU.encCmv.categoria]] || '').trim(),
      precio: Number(fila[idx[IMENU.encCmv.precio]]) || 0,
      costo: Number(fila[idx[IMENU.encCmv.costo]]) || 0,
      estado: normalizar_(fila[idx[IMENU.encCmv.estado]]),
      pos: String(fila[idx[IMENU.encCmv.pos]] || '').trim()
    };
  }
  return out;
}

/**
 * Catalogo del POS, por nombre + categoria. Devuelve tambien los duplicados: hay
 * casos como 'Wild Turkey 81', que aparece dos veces en Licor Copa con Pcompra 12.05
 * y 170 —el segundo cuesta mas que su precio de venta, o sea que esta mal—. Elegir en
 * silencio seria esconder un dato roto; se reporta y se toma el que tenga costo sano.
 */
function leerCatalogoPOS_() {
  // El catalogo se RESUELVE, no se lee de un id fijo. Ver catalogoPOS_ en ConfigPOS.gs:
  // la propiedad guardaba el id de un export concreto y la pantalla seguia leyendo el
  // viejo hasta que alguien la editara a mano. El nombre y la fecha viajan hacia
  // arriba para que la pantalla los muestre.
  // OJO CON EL NOMBRE: mas abajo el bucle usaba `var cat` para la categoria de cada
  // fila, y como var es de ambito de FUNCION eso pisaba este objeto. Para cuando se
  // armaba la respuesta, cat era la categoria de la ultima fila y la fecha del
  // catalogo salia null: la pantalla decia "sin fecha reconocible". Se rompio el
  // 30-ago-2026 al enchufar el resolvedor. Por eso este se llama catPOS y el del
  // bucle, categoria.
  var catPOS = catalogoPOS_();
  var ss = catPOS.ss;
  if (!ss) throw new Error('No pude abrir el catalogo del POS');
  var h = ss.getSheets()[0];
  var datos = h.getDataRange().getValues(), enc = -1, idx = {};
  for (var r = 0; r < Math.min(datos.length, 12) && enc === -1; r++) {
    var i = indicePorEncabezado_(datos[r]);
    if (i[IMENU.encPos.nombre] !== undefined && i[IMENU.encPos.costo] !== undefined) { enc = r; idx = i; }
  }
  if (enc === -1) throw new Error('No encontre el encabezado del catalogo del POS');

  var out = {}, porLlave = {}, porNombre = {}, duplicados = [];
  for (var f = enc + 1; f < datos.length; f++) {
    var fila = datos[f];
    var nombre = String(fila[idx[IMENU.encPos.nombre]] || '').trim();
    var categoria = String(fila[idx[IMENU.encPos.categoria]] || '').trim();
    if (!nombre || !categoria) continue;
    var reg = { nombre: nombre, categoria: categoria,
                precio: Number(fila[idx[IMENU.encPos.precio]]) || 0,
                costo: Number(fila[idx[IMENU.encPos.costo]]) || 0 };
    var llave = String(fila[idx['llave']] == null ? '' : fila[idx['llave']]).trim();
    if (llave) porLlave[llave] = reg;
    if (!porNombre[normalizar_(nombre)]) porNombre[normalizar_(nombre)] = reg;
    var k = normalizar_(nombre) + '|' + normalizar_(categoria);
    if (out[k]) {
      duplicados.push(nombre + ' (' + categoria + '): Q' + out[k].costo + ' y Q' + reg.costo);
      // se queda el de costo sano: mayor que cero y menor que el precio
      var viejoSano = out[k].costo > 0 && out[k].costo < out[k].precio;
      var nuevoSano = reg.costo > 0 && reg.costo < reg.precio;
      if (nuevoSano && !viejoSano) out[k] = reg;
      continue;
    }
    out[k] = reg;
  }
  return { porNombreCat: out, porLlave: porLlave, porNombre: porNombre, duplicados: duplicados,
           catalogo: { nombre: catPOS.nombre, fecha: catPOS.fecha ? catPOS.fecha.getTime() : null,
                       respaldo: catPOS.respaldo, aviso: catPOS.aviso } };
}

/** Las unidades de VENTAS x PLATO dentro de la ventana. */
function ventasDelRango_(desde, hasta) {
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) return { lineas: [], dias: 0, tickets: 0, venta: 0, desde: null, hasta: null };

  var datos = h.getRange(1, 1, h.getLastRow(), VENTAS.cols.length).getValues();
  var idx = indicePorEncabezado_(datos[0]);
  var cProd = idx['producto'], cFecha = idx['fecha'], cCat = idx['categoria'],
      cCant = idx['cantidad'], cTotal = idx['total'], cDoc = idx['doc id'];

  var lineas = [], tickets = {}, dias = {}, venta = 0, min = null, max = null;
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    var fecha = fechaVenta_(f[cFecha]);      // puede volver como Date desde Sheets
    if (!fecha || fecha < desde || fecha > hasta) continue;
    var cant = Number(f[cCant]) || 0, total = Number(f[cTotal]) || 0;
    lineas.push({ producto: String(f[cProd] || '').trim(),
                  categoria: String(f[cCat] || '').trim(), cantidad: cant, total: total });
    tickets[String(f[cDoc])] = true; dias[fecha] = true; venta += total;
    if (!min || fecha < min) min = fecha;
    if (!max || fecha > max) max = fecha;
  }
  return { lineas: lineas, dias: Object.keys(dias).length, tickets: Object.keys(tickets).length,
           venta: venta, desde: min, hasta: max };
}

/* ==========================================================================
   EL CALCULO
   ========================================================================== */

/**
 * `ventas` opcional: si viene, NO se vuelve a leer la hoja. Lo usa
 * ventasYVentana_(), que hace una sola lectura para la ventana y para el rango.
 * Sin eso, abrir el modulo leia la hoja de 9.500 filas CUATRO veces —dos por
 * llamada, y la pantalla hace dos— y eso solo eran 21 de los 40 segundos que
 * midio DIAG_TABLERO el 30-ago-2026.
 */
function ingenieriaDeMenu_(desde, hasta, ventas) {
  var v = ventas || ventasDelRango_(desde, hasta);
  var cmv = leerResumenCMV_();
  var cat = leerCatalogoPOS_();
  // Que categorias de barra entran, y las dos metas: de PARAMETROS (metasFoodCost_),
  // no escritas aca. Barra es plana desde el 14-sep-2026.
  var metas = {};
  (COSTEO.categoriasBarra || []).forEach(function (c) { metas[c] = true; });
  var metaCocina = metaDeArea_('COCINA') / 100, metaBarra = metaDeArea_('BARRA') / 100;

  // dias del periodo, por calendario: lo que se anualiza es tiempo transcurrido, no
  // dias con venta. x365/dias, no x12/meses: "meses del periodo" no es un numero,
  // es una decision, y dos implementaciones honestas darian resultados distintos.
  var dias = Math.round((new Date(hasta + 'T12:00:00Z') - new Date(desde + 'T12:00:00Z')) / 86400000) + 1;

  var prod = {}, sinEquivalencia = {};
  var mapa = mapaPOS_();

  // TIPEO: nombres mal escritos en el POS que apuntan a un producto real. La fila de
  // MAPA POS trae la LLAVE del producto bueno, asi que se resuelve por llave contra el
  // catalogo — no leyendo la nota, que es texto libre y se rompe al primer reword.
  var porTipeo = {};
  (mapa.tipo || []).forEach(function (t) {
    var bueno = t.llave && cat.porLlave[String(t.llave).trim()];
    if (bueno) porTipeo[normalizar_(t.pos)] = bueno.nombre;
  });

  // SIN FICHA: se venden y no tienen ficha. Son cocina SIN CLASIFICAR, no un nombre
  // desconocido: el sistema sabe perfectamente que son, lo que no sabe es cuanto cuestan.
  var sinFicha = {};
  (mapa.sinFicha || []).forEach(function (x) { sinFicha[normalizar_(x.pos)] = true; });

  // RETIRAR: siguen vivos en el POS pero YA NO ESTAN EN LA CARTA. Quedan fuera del
  // analisis igual que los IGNORAR. No es un tecnicismo: la matriz existe para decidir
  // que hacer con cada plato, y sobre uno que ya salio de la carta no hay nada que
  // decidir. Contarlos ademas ensucia el punto ciego —aparecen como "sin costo" cuando
  // en realidad estan dados de baja— y mueve los umbrales de popularidad de su
  // categoria con unidades que no van a volver.
  var retirados = {};
  (mapa.retirar || []).forEach(function (x) { retirados[normalizar_(x.pos)] = true; });

  // TODO lo que el bucle necesita, resuelto UNA vez.
  // ignorarEnVentas_(), fichaDesdePOS_() y esCocinaPOS_() llaman a mapaPOS_() por
  // dentro, y mapaPOS_() lee el cache y hace JSON.parse del mapa completo. Tres
  // llamadas por linea sobre 9.501 lineas son ~28.000 parseos: la pantalla tardaba
  // mas de seis minutos y no llegaba a pintar. Con las tablas locales es una sola vez.
  var ignorados = {};
  (mapa.ignorar || []).forEach(function (n) { ignorados[normalizar_(n)] = true; });
  var porPos = mapa.porPos || {};
  var catsCocina = {};
  (mapa.catCocina || []).forEach(function (c) { catsCocina[normalizar_(c)] = true; });
  var esCat = function (c) { return !!catsCocina[normalizar_(c)]; };

  v.lineas.forEach(function (l) {
    if (!l.producto || ignorados[normalizar_(l.producto)]) return;
    var nombre = porTipeo[normalizar_(l.producto)] || l.producto;
    if (retirados[normalizar_(nombre)]) return;

    // COCINA: por nombre. Si el nombre engancha con una ficha, es cocina, sin
    // importar en que categoria lo puso el POS.
    var ficha = porPos[normalizar_(nombre)] || null;
    if (ficha) {
      var reg = cmv[normalizar_(ficha)];
      if (reg) {
        var k = 'COCINA|' + normalizar_(ficha);
        if (!prod[k]) prod[k] = { area: 'COCINA', nombre: reg.plato, categoria: reg.categoria,
                                  precio: reg.precio, costo: reg.costo,
                                  firme: reg.estado === IMENU.estadoFirme, uds: 0, venta: 0 };
        prod[k].uds += l.cantidad; prod[k].venta += l.total;
        return;
      }
    }

    // BARRA: por nombre + categoria del POS.
    var kc = normalizar_(nombre) + '|' + normalizar_(l.categoria);
    var reg2 = cat.porNombreCat[kc];
    if (reg2 && metas[reg2.categoria]) {
      var k2 = 'BARRA|' + kc;
      if (!prod[k2]) prod[k2] = { area: 'BARRA', nombre: reg2.nombre, categoria: reg2.categoria,
                                  precio: reg2.precio, costo: reg2.costo,
                                  firme: reg2.costo > 0, uds: 0, venta: 0 };
      prod[k2].uds += l.cantidad; prod[k2].venta += l.total;
      return;
    }

    // Cocina sin ficha: la categoria de la linea o del catalogo dice que es cocina, o
    // MAPA POS lo tiene como SIN FICHA. Entra al analisis SIN CLASIFICAR y suma al
    // punto ciego, que es justo lo que ese contador tiene que mostrar. Mandarlo a
    // "sin equivalencia" lo escondia: parecia un nombre que nadie reconoce cuando en
    // realidad es un plato conocido al que le falta el costo.
    var enCat = cat.porNombre[normalizar_(nombre)];
    var esCocina = sinFicha[normalizar_(nombre)] || esCat(l.categoria) ||
                   (enCat && esCat(enCat.categoria));
    if (esCocina) {
      // Sin precio no es un producto de carta: no hay margen que calcular, la
      // popularidad no significa nada y no hay decision que tomar sobre el. Son items
      // de evento o de un dia —Pie Elote, Entremmet, Flight 3 Platos— que ni siquiera
      // estan en el catalogo del POS. Contarlos ademas mueve el umbral de popularidad
      // de su categoria con unidades que no representan un plato.
      var pc = cat.porNombre[normalizar_(nombre)];
      if (!pc || !(pc.precio > 0)) {
        var kx = l.producto + ' [' + l.categoria + ']';
        sinEquivalencia[kx] = (sinEquivalencia[kx] || 0) + l.cantidad;
        return;
      }
      var k3 = 'COCINA|' + normalizar_(nombre);
      if (!prod[k3]) prod[k3] = { area: 'COCINA', nombre: pc.nombre,
                                  categoria: pc.categoria, precio: pc.precio, costo: 0,
                                  firme: false, uds: 0, venta: 0 };
      prod[k3].uds += l.cantidad; prod[k3].venta += l.total;
      return;
    }

    var ks = l.producto + ' [' + l.categoria + ']';
    sinEquivalencia[ks] = (sinEquivalencia[ks] || 0) + l.cantidad;
  });

  /* EL PRECIO NETO, resuelto antes que nada porque lo usan los dos bloques de abajo.
     Todo margen y todo porcentaje se mide sobre la venta NETA (bruta / 1.12); ver el
     porque en COSTEO.iva.

     p.precio SE QUEDA BRUTO a proposito: el chequeo contra el POS compara precios de
     carta, no margenes, y ahi el bruto es el numero correcto. */
  var iva = COSTEO.iva || 1.12;
  Object.keys(prod).forEach(function (k) {
    var p = prod[k];
    p.precioNeto = p.precio / iva;
  });

  // Por categoria: umbral de popularidad y MC promedio. El MC promedio SOLO sobre
  // costo firme — si entrara lo no costeado, el promedio bajaria solo y todo pareceria
  // estrella.
  var porCat = {};
  Object.keys(prod).forEach(function (k) {
    var p = prod[k], c = p.area + '|' + p.categoria;
    if (!porCat[c]) porCat[c] = { area: p.area, categoria: p.categoria, uds: 0, n: 0,
                                  mcPorUds: 0, udsFirmes: 0 };
    porCat[c].uds += p.uds; porCat[c].n++;
    // Neto igual que el mc de cada producto. Si este quedara bruto y el individual
    // neto, mcNorm compararia peras con manzanas: TODO caeria por debajo del promedio
    // de su categoria y la matriz se vaciaria hacia caballo y perro.
    if (p.firme) { porCat[c].mcPorUds += (p.precioNeto - p.costo) * p.uds; porCat[c].udsFirmes += p.uds; }
  });
  Object.keys(porCat).forEach(function (c) {
    var g = porCat[c];
    g.umbral = g.n ? (1 / g.n) * IMENU.factorUmbral : 0;
    g.mcPromedio = g.udsFirmes ? g.mcPorUds / g.udsFirmes : 0;
  });

  // Clasificar
  var meses = dias / 30.44;
  Object.keys(prod).forEach(function (k) {
    var p = prod[k], g = porCat[p.area + '|' + p.categoria];
    p.mc = p.precioNeto - p.costo;
    p.contribucion = p.mc * p.uds;
    p.popularidad = g.uds ? p.uds / g.uds : 0;
    p.umbral = g.umbral;
    p.mcPromedio = g.mcPromedio;
    p.popNorm = g.umbral ? p.popularidad / g.umbral : 0;
    p.mcNorm = g.mcPromedio ? p.mc / g.mcPromedio : 0;
    p.udsAlMes = meses ? p.uds / meses : 0;

    var meta = p.area === 'COCINA' ? metaCocina : metaBarra;
    // Q/año contra meta. Positivo = se pierde plata contra el objetivo.
    p.vsMeta = (p.costo - p.precioNeto * meta) * p.uds * 365 / dias;
    p.meta = meta;
    p.cmv = p.precioNeto ? p.costo / p.precioNeto : 0;

    if (!p.firme) { p.clase = 'SIN CLASIFICAR'; return; }
    var pop = p.popularidad >= g.umbral, marg = p.mc >= g.mcPromedio;
    p.clase = pop ? (marg ? 'ESTRELLA' : 'CABALLO') : (marg ? 'ROMPECABEZAS' : 'PERRO');
  });

  // Totales por area
  var areas = {};
  ['COCINA', 'BARRA'].forEach(function (a) {
    var lista = Object.keys(prod).map(function (k) { return prod[k]; })
                      .filter(function (p) { return p.area === a; });
    var firmes = lista.filter(function (p) { return p.firme; });
    var conteo = { ESTRELLA: 0, CABALLO: 0, ROMPECABEZAS: 0, PERRO: 0, 'SIN CLASIFICAR': 0 };
    lista.forEach(function (p) { conteo[p.clase]++; });
    var costoT = 0, ventaT = 0, contrib = 0, recup = 0;
    firmes.forEach(function (p) {
      // ventaT NETA: es el denominador del CMV ponderado del area. Con la venta
      // bruta aca, cocina seguiria diciendo 26.5% mientras cada plato dice 29.7%.
      costoT += p.costo * p.uds; ventaT += p.precioNeto * p.uds;
      contrib += p.contribucion;
      if (p.vsMeta > 0) recup += p.vsMeta;
    });
    areas[a] = { productos: lista.length, firmes: firmes.length,
                 cmvPonderado: ventaT ? costoT / ventaT : 0,
                 contribucion: contrib, recuperable: recup, conteo: conteo, lista: lista };
  });

  return { desde: desde, hasta: hasta, dias: dias, tickets: v.tickets, venta: v.venta,
           diasConVenta: v.dias, areas: areas, porCat: porCat,
           sinEquivalencia: sinEquivalencia, duplicadosPOS: cat.duplicados,
           catalogo: cat.catalogo };
}

/* ==========================================================================
   LA PRUEBA CONTRA EL ORACULO
   ========================================================================== */

/**
 * El oraculo vive en Rosanta_Ingenieria_Menu_2027.xlsx, calculado sobre el POS del
 * 2-ene al 31-jul-2026. Que el filtro de fechas tenga que funcionar para que esto
 * pase es parte de la prueba: la hoja tiene cargado enero-a-agosto.
 */
function probarIngenieriaMenu(desde, hasta) {
  soloDueno_();
  desde = desde || '2026-01-02'; hasta = hasta || '2026-07-31';
  var r = ingenieriaDeMenu_(desde, hasta);

  Logger.log('=== %s -> %s · %s dias · %s tickets · venta Q%s ===',
             r.desde, r.hasta, r.dias, r.tickets, r.venta.toFixed(2));

  ['COCINA', 'BARRA'].forEach(function (a) {
    var x = r.areas[a], c = x.conteo;
    Logger.log('');
    Logger.log('%s', a);
    Logger.log('  productos con venta   %s', x.productos);
    Logger.log('  con costo firme       %s', x.firmes);
    Logger.log('  CMV ponderado         %s%%', (x.cmvPonderado * 100).toFixed(1));
    Logger.log('  contribucion          Q%s', Math.round(x.contribucion));
    Logger.log('  recuperable vs meta   Q%s/ano', Math.round(x.recuperable));
    Logger.log('  E/C/R/P               %s / %s / %s / %s',
               c.ESTRELLA, c.CABALLO, c.ROMPECABEZAS, c.PERRO);
    Logger.log('  sin clasificar        %s', c['SIN CLASIFICAR']);
  });

  // El detalle de cocina, para poder comparar producto por producto contra el Excel.
  // Los conteos solos no alcanzan: dicen que sobran cinco pero no cuales.
  Logger.log('');
  Logger.log('--- COCINA, producto por producto (%s) ---', r.areas.COCINA.lista.length);
  r.areas.COCINA.lista.slice().sort(function (a, b) { return b.uds - a.uds; })
    .forEach(function (p) {
      Logger.log('  %s uds · %s · %s · Q%s-Q%s · %s',
                 p.uds, p.clase, p.categoria, p.precio, p.costo, p.nombre);
    });

  var sin = Object.keys(r.sinEquivalencia);
  Logger.log('');
  Logger.log('sin equivalencia: %s nombres', sin.length);
  sin.sort(function (a, b) { return r.sinEquivalencia[b] - r.sinEquivalencia[a]; })
     .slice(0, 12).forEach(function (n) { Logger.log('   %s uds · %s', r.sinEquivalencia[n], n); });
  if (r.duplicadosPOS.length) {
    Logger.log('');
    Logger.log('OJO, duplicados en el catalogo del POS (mismo nombre y categoria):');
    r.duplicadosPOS.forEach(function (d) { Logger.log('   %s', d); });
  }
  return r;
}

/* ==========================================================================
   LO QUE PIDE LA PANTALLA
   ========================================================================== */

/**
 * La ventana se ancla a la ULTIMA FECHA CARGADA, no a hoy. Si el lunes no se carga
 * el export, "ultimas 13 semanas" contra hoy iria corriendo el piso y mostraria cada
 * vez menos datos sin decir por que. Anclada al dato, la ventana es estable y la
 * fecha de arriba delata sola que el feed quedo viejo.
 */
function ventanaVentas_(semanas) {
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) return null;
  var cFecha = VENTAS.cols.indexOf('FECHA') + 1;
  var col = h.getRange(2, cFecha, h.getLastRow() - 1, 1).getValues();
  var min = null, max = null;
  col.forEach(function (f) {
    var d = fechaVenta_(f[0]);
    if (!d) return;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  });
  if (!max) return null;
  if (!semanas) return { desde: min, hasta: max };          // todo
  var t = new Date(max + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() - (semanas * 7 - 1));
  var desde = Utilities.formatDate(t, 'UTC', 'yyyy-MM-dd');
  return { desde: desde < min ? min : desde, hasta: max };
}

/**
 * UNA SOLA LECTURA de la hoja de ventas, para la ventana Y para el rango.
 *
 * ventanaVentas_() leia la columna FECHA entera (4.9 s) solo para saber cual era la
 * ultima fecha cargada, y despues ventasDelRango_() volvia a leer la hoja completa
 * (5.9 s) y a parsear las mismas 9.500 fechas otra vez. Diez segundos por llamada,
 * y la pantalla hace dos llamadas.
 *
 * Aca la hoja se lee una vez, cada fecha se parsea una vez y se guarda; la ventana
 * se calcula sobre ese arreglo en memoria y el filtro tambien. Las dos funciones
 * viejas se quedan: probarIngenieriaMenu y la bateria las usan con fechas explicitas
 * y ahi no hay nada que compartir.
 */
function ventasYVentana_(semanas) {
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) return null;

  var datos = h.getRange(1, 1, h.getLastRow(), VENTAS.cols.length).getValues();
  var idx = indicePorEncabezado_(datos[0]);
  var cProd = idx['producto'], cFecha = idx['fecha'], cCat = idx['categoria'],
      cCant = idx['cantidad'], cTotal = idx['total'], cDoc = idx['doc id'];

  // Una pasada: parsear la fecha (lo caro) y quedarse con lo que hace falta.
  var filas = [], min = null, max = null;
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    var fecha = fechaVenta_(f[cFecha]);
    if (!fecha) continue;
    if (!min || fecha < min) min = fecha;
    if (!max || fecha > max) max = fecha;
    filas.push([fecha, String(f[cProd] || '').trim(), String(f[cCat] || '').trim(),
                Number(f[cCant]) || 0, Number(f[cTotal]) || 0, String(f[cDoc])]);
  }
  if (!max) return null;

  // La ventana, anclada a la ULTIMA FECHA CARGADA y no a hoy: si el lunes no se
  // carga el export, "ultimas 13 semanas" contra hoy iria corriendo el piso y
  // mostraria cada vez menos datos sin decir por que.
  var desde = min, hasta = max;
  if (semanas) {
    var t = new Date(max + 'T12:00:00Z');
    t.setUTCDate(t.getUTCDate() - (semanas * 7 - 1));
    desde = Utilities.formatDate(t, 'UTC', 'yyyy-MM-dd');
    if (desde < min) desde = min;
  }

  // El filtro, en memoria.
  var lineas = [], tickets = {}, dias = {}, venta = 0, dMin = null, dMax = null;
  for (var i = 0; i < filas.length; i++) {
    var x = filas[i];
    if (x[0] < desde || x[0] > hasta) continue;
    lineas.push({ producto: x[1], categoria: x[2], cantidad: x[3], total: x[4] });
    tickets[x[5]] = true; dias[x[0]] = true; venta += x[4];
    if (!dMin || x[0] < dMin) dMin = x[0];
    if (!dMax || x[0] > dMax) dMax = x[0];
  }
  return { ventas: { lineas: lineas, dias: Object.keys(dias).length,
                     tickets: Object.keys(tickets).length, venta: venta,
                     desde: dMin, hasta: dMax },
           desde: desde, hasta: hasta };
}

/**
 * Payload para la pestana. Solo lee.
 * `semanas`: 4, 13, o 0/null para todo el historico.
 */
function getIngenieriaMenu(semanas) {
  soloDueno_();
  var w = ventasYVentana_(semanas === undefined ? 13 : semanas);
  if (!w) return { ok: false, error: 'Todavia no hay ventas cargadas. Corré cargarVentasPorProducto().' };
  return menuDesdeR_(ingenieriaDeMenu_(w.desde, w.hasta, w.ventas));
}

/**
 * El payload de la pestana, a partir de un calculo YA HECHO.
 *
 * Existe partido en dos para que getProfitOS() pueda armar las dos pantallas con
 * una sola pasada. El tablero y la ingenieria de menu miran los mismos numeros
 * desde angulos distintos; calcularlos dos veces costaba diez segundos de mas y,
 * peor, abria la puerta a que un dia dijeran cosas distintas.
 */
function menuDesdeR_(r) {
  var cargado = ultimaCargaVentas_().cuando;

  var out = { ok: true, desde: r.desde, hasta: r.hasta, dias: r.dias, tickets: r.tickets,
              venta: r.venta, cargadoEl: cargado, catalogo: r.catalogo, areas: {} };


  ['COCINA', 'BARRA'].forEach(function (a) {
    var x = r.areas[a];
    var puntos = x.lista.map(function (p) {
      return { n: p.nombre, cat: p.categoria, clase: p.clase, uds: p.uds,
               // Los dos: el bruto es el precio de carta que la gente reconoce, el
               // neto es contra el que se mide el margen. Mostrar solo el bruto al
               // lado de un CMV neto deja un tooltip cuyos tres numeros no cierran
               // entre si, y eso hace desconfiar de toda la pantalla.
               precio: p.precio, precioNeto: p.precioNeto, costo: p.costo, cmv: p.cmv, mc: p.mc,
               contrib: p.contribucion, popNorm: p.popNorm, mcNorm: p.mcNorm,
               vsMeta: p.vsMeta, meta: p.meta, udsMes: p.udsAlMes, venta: p.venta };
    });
    var firmes = puntos.filter(function (p) { return p.clase !== 'SIN CLASIFICAR'; });
    var sinCosto = puntos.filter(function (p) { return p.clase === 'SIN CLASIFICAR'; })
                         .sort(function (a, b) { return b.venta - a.venta; });

    // La lista de sala necesita un PISO DE DEMANDA. Ordenada solo por margen, barra
    // proponia empujar el Macallan 12: una copa en ocho meses. Eso no es una decision,
    // es una corazonada.
    var empujar = firmes.filter(function (p) {
      return p.clase === 'ROMPECABEZAS' && p.udsMes >= IMENU.ventaMinimaAlMes;
    }).sort(function (a, b) { return b.mc - a.mc; });

    var fueraDeMeta = firmes.filter(function (p) { return p.vsMeta > 0; })
                            .sort(function (a, b) { return b.vsMeta - a.vsMeta; });

    out.areas[a] = {
      productos: x.productos, firmes: x.firmes, cmv: x.cmvPonderado,
      contribucion: x.contribucion, recuperable: x.recuperable, conteo: x.conteo,
      puntos: firmes, sinCosto: sinCosto, empujar: empujar, fueraDeMeta: fueraDeMeta,
      sinCostoUds: sinCosto.reduce(function (s, p) { return s + p.uds; }, 0),
      sinCostoVenta: sinCosto.reduce(function (s, p) { return s + p.venta; }, 0)
    };
  });
  return out;
}
