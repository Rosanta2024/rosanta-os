/**
 * PuenteCmv.gs — p96: el CMV TEORICO de cada mes, por area, para cruzarlo contra el
 * real de Finanzas. Solo LEE. Lo corre Juanma en el editor y pega el registro.
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
function revisarPuenteCmv(desde, hasta) {
  soloDueno_();
  var h = hojaCosteo_().getSheetByName(IMENU.hojaVentas);
  if (!h || h.getLastRow() < 2) { Logger.log('VENTAS x PLATO esta vacia.'); return null; }

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

    var c = fila.cocina, b = fila.barra;
    Logger.log('%s (%s a %s) · venta sin IVA Q%s · COCINA %s%% pagado, %s%% carta, ciego Q%s · ' +
               'BARRA %s%% pagado, %s%% carta, ciego Q%s · fuera Q%s',
               m, M.desde, M.hasta, fila.venta_neta, c.cmv_pagado, c.cmv_carta, c.venta_ciego,
               b.cmv_pagado, b.cmv_carta, b.venta_ciego, fila.fuera.venta);
  });

  // El registro para pegar: lo lee el puente fuera de linea.
  Logger.log('JSON %s', JSON.stringify(out));
  return out;
}
