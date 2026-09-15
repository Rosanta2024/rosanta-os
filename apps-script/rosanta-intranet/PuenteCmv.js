/**
 * PuenteCmv.gs — p96: el CMV TEORICO de cada mes, por area, y su cruce contra el real.
 * Solo LEE.
 *
 * Dos puertas:
 *   revisarPuenteCmv()      la corre Juanma en el editor y pega el registro.
 *   getCmvRealTeorico(auth) la llama el tablero de Profit OS, APARTE de getProfitOS:
 *                           corre ingenieriaDeMenu_ una vez por mes y no puede frenar
 *                           las otras tarjetas. Cacheada 3 horas.
 *
 * POR QUE NO ALCANZA EL TABLERO: el tablero da una ventana de 4, 13 o 52 semanas y el
 * real de Finanzas es por mes. Aca se corre el MISMO calculo (ingenieriaDeMenu_) una
 * vez por mes, sin copiar su matematica: si el teorico de aca y el del tablero se
 * calcularan distinto, el puente mediria la diferencia entre dos programas y no la
 * merma.
 *
 * DOS TEORICOS, y no son lo mismo:
 *   carta   costo de ficha / precio de carta VIGENTE sin IVA. Es el del tablero.
 *   pagado  costo de ficha / lo que se cobro ESE mes sin IVA. Es el comparable contra
 *           el real: si un plato subio de precio en junio, el de carta hace ver enero
 *           mejor de lo que fue.
 * Los dos usan el costo ACTUAL de la ficha: no hay historia de costos por mes.
 *
 * LO QUE NO TIENE COSTO se cuenta aparte, en quetzales sin IVA:
 *   ciego   producto conocido sin costo firme (cocina sin costear, barra sin Pcompra)
 *   fuera   lineas que no se asignan a ningun producto: eventos, paquetes, brunch,
 *           ignorados y retirados. Su compra SI esta en el real.
 * VENTAS x PLATO no trae el 10% de servicio: toda venta de aca va sin IVA y sin
 * servicio, que es la base de la meta (decision de Juanma, 15-sep-2026).
 */

var PUENTE_CMV = { prefijo: 'cmv_rt_v1_', cacheSegs: 3 * 60 * 60, mesesBloque: 3 };

/** La clave del cache de la tarjeta. La usan getCmvRealTeorico y calentarCaches. */
function cmvRealTeoricoClave_(huella) {
  return PUENTE_CMV.prefijo + huella + '_' + finCacheClave_();
}

function revisarPuenteCmv(desde, hasta) {
  soloDueno_();
  var out = _puenteTeoricoMeses_(desde, hasta);
  if (!out) { Logger.log('VENTAS x PLATO esta vacia.'); return null; }
  out.forEach(function (fila) {
    var c = fila.cocina, b = fila.barra;
    Logger.log('%s (%s a %s) · venta sin IVA Q%s · COCINA %s%% pagado, %s%% carta, ciego Q%s · ' +
               'BARRA %s%% pagado, %s%% carta, ciego Q%s · fuera Q%s',
               fila.mes, fila.desde, fila.hasta, fila.venta_neta, c.cmv_pagado, c.cmv_carta, c.venta_ciego,
               b.cmv_pagado, b.cmv_carta, b.venta_ciego, fila.fuera.venta);
  });
  // El registro para pegar: lo lee el puente fuera de linea.
  Logger.log('JSON %s', JSON.stringify(out));
  return out;
}

/** El teorico de cada mes con venta cargada. null si VENTAS x PLATO esta vacia. */
function _puenteTeoricoMeses_(desde, hasta) {
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) return null;

  // Una sola lectura, como ventasYVentana_, pero agrupada por mes.
  var datos = h.getRange(1, 1, h.getLastRow(), VENTAS.cols.length).getValues();
  var idx = indicePorEncabezado_(datos[0]);
  var cProd = idx['producto'], cFecha = idx['fecha'], cCat = idx['categoria'],
      cCant = idx['cantidad'], cTotal = idx['total'], cDoc = idx['doc id'];

  var meses = {};
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r], fecha = fechaVenta_(f[cFecha]);
    if (!fecha || (desde && fecha < desde) || (hasta && fecha > hasta)) continue;
    var m = fecha.slice(0, 7);
    var M = meses[m] || (meses[m] = { lineas: [], tickets: {}, dias: {}, venta: 0,
                                      desde: fecha, hasta: fecha });
    var total = Number(f[cTotal]) || 0;
    M.lineas.push({ producto: String(f[cProd] || '').trim(), categoria: String(f[cCat] || '').trim(),
                    cantidad: Number(f[cCant]) || 0, total: total });
    M.tickets[String(f[cDoc])] = true; M.dias[fecha] = true; M.venta += total;
    if (fecha < M.desde) M.desde = fecha;
    if (fecha > M.hasta) M.hasta = fecha;
  }

  var iva = COSTEO.iva || 1.12;
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var pct = function (a, b) { return b ? r2(a / b * 100) : null; };
  var out = [];

  Object.keys(meses).sort().forEach(function (m) {
    var M = meses[m];
    var v = { lineas: M.lineas, dias: Object.keys(M.dias).length,
              tickets: Object.keys(M.tickets).length, venta: M.venta,
              desde: M.desde, hasta: M.hasta };
    var res = ingenieriaDeMenu_(M.desde, M.hasta, v);
    var fila = { mes: m, desde: M.desde, hasta: M.hasta, dias: v.dias, tickets: v.tickets,
                 venta_neta: r2(M.venta / iva) };
    var asignada = 0;

    ['COCINA', 'BARRA'].forEach(function (a) {
      var x = { costo: 0, pagado: 0, carta: 0, ciego: 0, udsCiego: 0, firmes: 0 };
      res.areas[a].lista.forEach(function (p) {
        asignada += p.venta;
        if (p.firme) {
          x.firmes++;
          x.costo += p.costo * p.uds;
          x.pagado += p.venta / iva;
          x.carta += p.precioNeto * p.uds;
        } else {
          x.ciego += p.venta / iva;
          x.udsCiego += p.uds;
        }
      });
      fila[a.toLowerCase()] = {
        costo_teorico: r2(x.costo), venta_firme: r2(x.pagado), venta_ciego: r2(x.ciego),
        uds_ciego: x.udsCiego, cmv_pagado: pct(x.costo, x.pagado), cmv_carta: pct(x.costo, x.carta),
        firmes: x.firmes, productos: res.areas[a].lista.length
      };
    });

    var sin = res.sinEquivalencia;
    var nombres = Object.keys(sin).sort(function (a, b) { return sin[b] - sin[a]; });
    fila.fuera = { venta: r2((M.venta - asignada) / iva), nombres: nombres.length,
                   top: nombres.slice(0, 5) };
    out.push(fila);
  });
  return out;
}

/* ==========================================================================
   REAL CONTRA TEORICO, para el tablero de Profit OS (p96 parte B, 15-sep-2026)
   ========================================================================== */

/**
 * La tarjeta "CMV real contra teorico". El titular es el BLOQUE de los ultimos meses
 * cerrados y no un mes suelto: la compra va a saltos (una caja de vino se paga una
 * semana y se toma en tres) y un mes solo movia la brecha de -1 a +18 puntos.
 */
function getCmvRealTeorico(auth) {
  var u = exigirModulo_(auth, 'recetario');
  // La clave junta las dos fuentes: la huella de ventas, bitacora y catalogo del POS
  // (el teorico) y la del calculo de Finanzas (el real).
  var huella = huellaDatos_();
  var clave = huella ? cmvRealTeoricoClave_(huella) : '';
  var cache = CacheService.getScriptCache();
  if (clave) {
    try {
      var guardado = cache.get(clave);
      if (guardado) { var g = JSON.parse(guardado); g.deCache = true; return _puenteParaQuien_(g, u); }
    } catch (e) { /* cache invalida: se recalcula */ }
  }
  var res;
  try { res = _cmvRealTeorico_(); }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  if (clave && res.ok) {
    try {
      var txt = JSON.stringify(res);
      if (txt.length < 90000) cache.put(clave, txt, PUENTE_CMV.cacheSegs);
    } catch (e) { /* si no cabe, no se cachea */ }
  }
  return _puenteParaQuien_(res, u);
}

/**
 * Los quetzales de venta y compra son dato de Finanzas y el modulo recetario lo tienen
 * tambien cocina y barra. Decision de Juanma (15-sep-2026): quien no es el dueño recibe
 * porcentajes y brecha en puntos, sin montos. El cache guarda la respuesta
 * completa y se filtra al devolver.
 */
function _puenteParaQuien_(res, u) {
  var dueno = !!u && String(u.email || '').toLowerCase().trim() === DUENO_CORREO_;
  if (dueno || !res || !res.ok) return res;
  var MONTOS = ['venta', 'compra', 'real', 'teorico', 'teorico_firme', 'teorico_ciego',
                'teorico_fuera', 'brecha_q'];
  var sinMontos = function (f) {
    var o = {};
    Object.keys(f).forEach(function (k) { if (MONTOS.indexOf(k) === -1) o[k] = f[k]; });
    return o;
  };
  return { ok: true, gen: res.gen, deCache: res.deCache, solo_porcentajes: true,
           bloque: sinMontos(res.bloque), meses: res.meses.map(sinMontos), notas: res.notas };
}

function _cmvRealTeorico_() {
  var teo = _puenteTeoricoMeses_();
  if (!teo || !teo.length) return { ok: false, error: 'Todavia no hay ventas por plato cargadas.' };
  var d = _finDatos_(false);
  var inv = { COCINA: _puenteInventario_('COCINA'), BARRA: _puenteInventario_('BARRA') };
  var notas = [];
  ['COCINA', 'BARRA'].forEach(function (a) {
    if (inv[a].error) notas.push('No se pudo leer el inventario de ' + a.toLowerCase() + ': ' + inv[a].error);
  });

  // Meses CERRADOS del año del calculo de Finanzas, con la venta por plato completa
  // (hasta tres dias antes de fin de mes, por si cerro el ultimo lunes).
  var hoy = new Date();
  var mesHoy = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2);
  var porMes = {}, cerrados = [];
  teo.forEach(function (t) {
    var y = Number(t.mes.slice(0, 4)), m = Number(t.mes.slice(5, 7));
    if (t.mes >= mesHoy || y !== d.anio) return;
    if (Number(t.hasta.slice(8, 10)) < new Date(y, m, 0).getDate() - 3) {
      notas.push(t.mes + ' queda fuera: la venta por plato llega solo hasta el ' + t.hasta + '.');
      return;
    }
    porMes[t.mes] = t;
    cerrados.push(t.mes);
  });
  if (!cerrados.length) return { ok: false, error: 'Todavia no hay un mes cerrado con venta por plato completa.' };

  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  function mesAnterior(mes) {
    var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1;
    if (!m) { y--; m = 12; }
    return y + '-' + ('0' + m).slice(-2);
  }
  // Consumo = compra de los meses + inventario al cierre del mes anterior - inventario
  // al cierre del ultimo. Sin los dos cierres, el real queda en la compra sin ajustar.
  function real(area, meses) {
    var A = (d.compra && d.compra[area.toLowerCase()]) || { mes: {} }, q = 0;
    meses.forEach(function (mes) { q += Number((A.mes || {})[Number(mes.slice(5, 7))]) || 0; });
    var ini = inv[area].totales[mesAnterior(meses[0])], fin = inv[area].totales[meses[meses.length - 1]];
    var con = ini != null && fin != null;
    return { compra: q, real: con ? q + ini - fin : q, conInventario: con };
  }
  function fila(meses) {
    var venta = 0, firme = 0, ciego = 0, fuera = 0;
    meses.forEach(function (mes) {
      var t = porMes[mes], c = t.cocina, b = t.barra;
      var f = c.costo_teorico + b.costo_teorico, vf = c.venta_firme + b.venta_firme;
      venta += t.venta_neta;
      firme += f;
      ciego += c.venta_ciego * (c.cmv_pagado || 0) / 100 + b.venta_ciego * (b.cmv_pagado || 0) / 100;
      fuera += vf ? t.fuera.venta * f / vf : 0;
    });
    var rc = real('COCINA', meses), rb = real('BARRA', meses);
    var re = rc.real + rb.real, te = firme + ciego + fuera;
    return {
      desde: meses[0], hasta: meses[meses.length - 1], meses: meses.length,
      venta: r2(venta), compra: r2(rc.compra + rb.compra), real: r2(re),
      teorico: r2(te), teorico_firme: r2(firme), teorico_ciego: r2(ciego), teorico_fuera: r2(fuera),
      real_pct: venta ? r1(re / venta * 100) : null, teorico_pct: venta ? r1(te / venta * 100) : null,
      brecha_q: r2(re - te), brecha_pts: venta ? r1((re - te) / venta * 100) : null,
      inv_cocina: rc.conInventario, inv_barra: rb.conInventario
    };
  }

  var bloque = fila(cerrados.slice(-PUENTE_CMV.mesesBloque));
  notas.push('Real y teórico sobre venta sin IVA ni servicio. El teórico usa el costo actual ' +
             'de cada ficha; lo que no tiene costo firme se estima al CMV de su área.');
  if (!bloque.inv_cocina) notas.push('Cocina sin cierre de inventario al inicio o al final del ' +
                                     'bloque: su real es la compra sin ajustar.');
  if (!bloque.inv_barra) notas.push('Barra sin cierre de inventario al inicio o al final del ' +
                                    'bloque: su real es la compra sin ajustar.');

  return {
    ok: true, gen: d.gen, bloque: bloque,
    meses: cerrados.map(function (mes) { return fila([mes]); }),
    notas: notas
  };
}

/** Total de cada cierre de inventario de un area, por AAAA-MM. Si falla, vacio y el error. */
function _puenteInventario_(area) {
  try {
    var tot = {};
    invLeerArea_(area).meses.forEach(function (m) { tot[m.mes] = m.total; });
    return { totales: tot };
  } catch (e) {
    return { totales: {}, error: String(e && e.message || e) };
  }
}
