/**
 * REPORTE SEMANAL · PDF DESDE EL SERVIDOR (26-sep-2026)
 *
 * Arma el PDF del reporte semanal de operacion con LOS MISMOS DATOS que la pantalla
 * (_repDatos_, ReporteSemanalDatos.gs) y lo guarda en la carpeta de su semana,
 * Reportes 2026 / SXX / Rosanta_SXX_AAAA.pdf, que es de donde lo lee el tablero
 * (getTableroDocumentos) y de donde se manda al equipo.
 *
 * Decision de Juanma (25-sep-2026): el PDF se genera desde el servidor y se guarda en
 * la carpeta SXX; antes lo armaba a mano generar_reporte_semanal.py con Chrome headless
 * y todos los numeros escritos en constantes. Con esto la pantalla y el PDF salen del
 * mismo motor: no hay dos versiones del mismo numero.
 *
 * Como se convierte: HtmlService no corre JavaScript al convertir, asi que el HTML se
 * arma completo del lado del servidor (_repHtmlPdf_), con tablas y estilos simples que
 * el conversor a PDF de Apps Script si respeta (nada de grid ni flex; las barras de los
 * graficos son celdas con ancho en porcentaje). Utilities.newBlob(html).getAs(PDF).
 *
 * Nada se borra: si ya existe Rosanta_SXX_AAAA.pdf en la carpeta, se mueve a la
 * subcarpeta _Archive de esa misma semana con la fecha en el nombre, y recien entonces
 * se crea el nuevo. Se usa el servicio avanzado Drive v3 (drivesListar_), como el resto
 * de la intranet, porque las carpetas pueden vivir en unidades compartidas.
 *
 * Entradas:
 *   generarPdfReporteSemanal(auth, clave)   dueño; devuelve {id, nombre, carpeta, url, archivado}
 *   ruta ?page=reporte-semanal-pdf&semana=CLAVE (Code.gs): misma funcion, para el enlace
 *   "Guardar PDF en Drive" de la pantalla y del tablero.
 */

var REP_PDF = {
  carpeta: '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP',   // Reportes 2026 (la misma de TAB_DOCS.reportes)
  archivo: '_Archive',
  colores: { verde: '#4E6D5A', medio: '#57A77F', lila: '#AEAAE2', rojo: '#a23b3b', ambar: '#C89A3C',
             gris: '#52514e', linea: '#e3e1dc' }
};

function generarPdfReporteSemanal(auth, clave) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  return _repPdfGuardar_(Number(clave) || 0);
}

// ------------------------------------------------------------------ guardar en Drive

function _repPdfGuardar_(clave) {
  var d = _repDatos_(clave, false);
  var blob = _repPdfBlob_(d);
  var nombre = blob.getName();
  var carpeta = _repPdfCarpetaSemana_(d.semana.w);
  var archivado = null;

  // el que ya estaba se archiva con fecha, no se pisa
  var previos = drivesListar_("'" + carpeta.id + "' in parents and name = '" + nombre + "' and trashed = false");
  if (previos.length) {
    var arch = _repPdfSubcarpeta_(carpeta.id, REP_PDF.archivo);
    var sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyyMMdd-HHmm');
    previos.forEach(function (p) {
      var nuevoNombre = nombre.replace(/\.pdf$/i, '') + '_archivado-' + sello + '.pdf';
      Drive.Files.update({ name: nuevoNombre }, p.id, null,
                         { addParents: arch.id, removeParents: carpeta.id, supportsAllDrives: true });
      archivado = { id: p.id, nombre: nuevoNombre, carpeta: REP_PDF.archivo };
    });
  }

  var creado = Drive.Files.create({ name: nombre, parents: [carpeta.id], mimeType: 'application/pdf' }, blob,
                                  { supportsAllDrives: true, fields: 'id,name' });
  try { CacheService.getScriptCache().remove('tab_docs_v1'); } catch (e) { /* el tablero lo relee en 10 min */ }
  return { id: creado.id, nombre: creado.name, carpeta: carpeta.name, semana: d.semana.w, anio: d.semana.anio,
           url: 'https://drive.google.com/file/d/' + creado.id + '/view', archivado: archivado,
           gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
}

/** La carpeta SXX dentro de Reportes 2026; se crea si la semana todavia no la tiene. */
function _repPdfCarpetaSemana_(w) {
  var nombre = 'S' + (w < 10 ? '0' : '') + w;
  return _repPdfSubcarpeta_(REP_PDF.carpeta, nombre);
}

function _repPdfSubcarpeta_(padreId, nombre) {
  var hijas = drivesListar_("'" + padreId + "' in parents and name = '" + nombre +
                            "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  if (hijas.length) return { id: hijas[0].id, name: hijas[0].name, creada: false };
  var f = Drive.Files.create({ name: nombre, parents: [padreId], mimeType: 'application/vnd.google-apps.folder' },
                             null, { supportsAllDrives: true, fields: 'id,name' });
  return { id: f.id, name: f.name, creada: true };
}

// ------------------------------------------------------------------ el PDF

function _repPdfBlob_(d) {
  var html = _repHtmlPdf_(d);
  var nombre = 'Rosanta_S' + (d.semana.w < 10 ? '0' : '') + d.semana.w + '_' + d.semana.anio + '.pdf';
  return Utilities.newBlob(html, 'text/html', nombre.replace(/\.pdf$/, '.html'))
                  .getAs('application/pdf').setName(nombre);
}

/** El HTML completo y estatico del reporte, con los datos que ya calculo _repCalcular_. */
function _repHtmlPdf_(d) {
  var C = REP_PDF.colores;
  function q(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : 'Q' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function pct(n, dec) { return (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(dec === undefined ? 1 : dec) + '%'; }
  function num(n) { return (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US'); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function signo(n) { return n > 0 ? '+' : ''; }
  function color(z) { return { verde: '#2E6B3F', amarillo: C.ambar, rojo: C.rojo }[z] || '#c9c6c0'; }
  function kpis(lista) {
    // tarjetas en una tabla de N columnas: [zona, etiqueta, valor, detalle]
    var w = Math.floor(100 / lista.length);
    return '<table class="k"><tr>' + lista.map(function (x) {
      return '<td style="width:' + w + '%;border-left:5px solid ' + color(x[0]) + '"><div class="et">' + esc(x[1]) + '</div>' +
             '<div class="val">' + x[2] + '</div><div class="det">' + (x[3] || '') + '</div></td>';
    }).join('') + '</tr></table>';
  }
  function tabla(cabeceras, filas) {
    // la columna sin cabecera es la de la barra: ancho fijo para que la barra (un
    // borde de ancho %) tenga contra que medirse
    return '<table class="t"><tr>' + cabeceras.map(function (h, i) { return '<th' + (i ? '' : ' class="l"') + (h === '' ? ' style="width:22%"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr>' +
      filas.map(function (f) {
        var cls = f.cls ? ' class="' + f.cls + '"' : '';
        return '<tr' + cls + '>' + f.c.map(function (c, i) { return '<td' + (i ? '' : ' class="l"') + '>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>';
  }
  function barra(valor, tope, col) {
    // El conversor a PDF de Apps Script ignora el fondo de las celdas pero respeta los
    // bordes (26-sep-2026, visto en la S37): la barra es un borde grueso de ancho %.
    var w = tope ? Math.max(Math.round(valor / tope * 100), 2) : 0;
    return '<div style="width:' + w + '%;border-top:9px solid ' + col + ';font-size:1px;line-height:1px">&nbsp;</div>';
  }
  function zonaCosto(real, meta) { return (real === null || real === undefined) ? '' : (real <= meta ? 'verde' : (real <= meta + 3 ? 'amarillo' : 'rojo')); }

  var k = d.kpis, pe = d.equilibrio, fc = d.foodcost, r = d.reservas, pl = d.pl, p2 = d.personal, pm = p2.planilla_mes, cp = d.compras;
  var h = '';

  h += '<div class="cab"><div class="marca">ROSANTA</div><div class="tit">Reporte semanal de operación</div>' +
    '<div class="sub">Semana ' + d.semana.w + ' de ' + d.semana.anio + ' · ' + esc(d.semana.ini) + ' al ' + esc(d.semana.fin) +
    (d.semana.corta ? ' · semana corta' : '') + ' · generado ' + esc(d.gen) + '</div></div>';

  // 1
  h += '<h2>1 · La semana</h2>' + kpis([
    ['', 'Ventas', q(k.ventas), num(k.tickets) + ' tickets · ' + num(k.com) + ' comensales' + (k.ventas_dif_pct !== null ? ' · ' + signo(k.ventas_dif_pct) + pct(k.ventas_dif_pct) + ' vs semana anterior' : '')],
    [k.gasto_pct > 100 ? 'rojo' : '', 'Gasto total', q(k.gasto), pct(k.gasto_pct) + ' sobre ventas'],
    [k.resultado >= 0 ? 'verde' : 'rojo', 'Resultado del período', q(k.resultado), pct(k.resultado_pct) + ' sobre ventas'],
    [k.ticket_dif_pct === null ? '' : (k.ticket_dif_pct >= 0 ? 'verde' : 'rojo'), 'Ticket promedio por comensal', q(k.ticket), k.ticket_ant !== null ? signo(k.ticket_dif_pct) + pct(k.ticket_dif_pct) + ' contra ' + q(k.ticket_ant) + ' la semana anterior' : '']
  ]);

  // 2
  var tope = Math.max.apply(null, d.cuatro.map(function (x) { return x.ventas; }).concat([pe ? pe.pe_semana : 0, 1]));
  h += '<h2>2 · Cuatro semanas: ventas, comensales y ticket</h2>' +
    '<p class="nota">La semana en curso en rojo. Punto de equilibrio semanal' + (pe ? ' ' + q(pe.pe_semana) : '') + ': la fila del final.</p>' +
    tabla(['Semana', 'Ventas', '', 'Comensales', 'Ticket', 'Equilibrio'],
      d.cuatro.map(function (x) {
        return { c: ['S' + x.w + ' · ' + esc(x.ini) + ' al ' + esc(x.fin), q(x.ventas), barra(x.ventas, tope, x.actual ? C.rojo : C.verde), num(x.com), q(x.tp),
                     x.sobre_equilibrio === null ? '—' : (x.sobre_equilibrio ? '<span class="pos">✓ sobre</span>' : '<span class="neg">✗ bajo</span>')] };
      }).concat(pe ? [{ cls: 'total', c: ['Punto de equilibrio', q(pe.pe_semana), barra(pe.pe_semana, tope, C.rojo), '', '', ''] }] : []));
  if (pe) {
    h += kpis([
      ['', 'Punto de equilibrio semanal', q(pe.pe_semana), 'fijos ' + q(pe.fijo_semana) + ' por semana ÷ margen ' + pct(pe.mc)],
      [pe.venta_pct >= 100 ? 'verde' : 'rojo', 'Venta de la semana', pct(pe.venta_pct), 'del equilibrio'],
      [pe.brecha >= 0 ? 'verde' : 'rojo', 'Brecha al equilibrio', (pe.brecha >= 0 ? '+' : '−') + q(Math.abs(pe.brecha)), pe.brecha >= 0 ? 'por encima' : 'faltaron para llegar'],
      [pe.semanas_sobre === pe.de ? 'verde' : (pe.semanas_sobre ? 'amarillo' : 'rojo'), 'Semanas sobre equilibrio', pe.semanas_sobre + ' de ' + pe.de, 'últimas ' + pe.de]
    ]);
  }

  // 3
  var topeDia = Math.max.apply(null, d.dias.map(function (x) { return x.ventas; }).concat([pe ? pe.pe_dia : 0, 1]));
  h += '<h2 class="salto">3 · Ritmo de la semana</h2>' +
    '<p class="nota">Venta y comensales por día, comensales que vinieron con reserva y el equilibrio diario (semanal ÷ 7' + (pe ? ' = ' + q(pe.pe_dia) : '') + ').</p>' +
    tabla(['Día', 'Venta', '', 'Comensales', 'Con reserva', 'Walk-ins', 'Tickets', 'Equilibrio diario'],
      d.dias.map(function (x) {
        return { c: [esc(x.dia), '<span class="' + (x.sobre_equilibrio === false ? 'neg' : (x.sobre_equilibrio ? 'pos' : '')) + '">' + q(x.ventas) + '</span>',
                     barra(x.ventas, topeDia, x.sobre_equilibrio === false ? C.rojo : C.verde), num(x.com),
                     r.error ? '—' : num(x.personas) + (x.reservas_superan ? ' *' : ''), x.walkins === null ? '—' : num(x.walkins), num(x.tickets),
                     x.sobre_equilibrio === null ? '—' : (x.sobre_equilibrio ? '✓ sobre' : '✗ bajo')] };
      }));

  // 4
  h += '<h2>4 · Comensales y reservas</h2>';
  if (r.error) {
    h += '<p class="nota neg">No se pudieron leer las reservas: ' + esc(r.error) + '</p>';
  } else {
    var estados = Object.keys(r.con_estado || {}).map(function (e) { return esc(e) + ' ' + r.con_estado[e]; }).join(' · ');
    h += '<p class="nota">Estados en la pestaña reservas esta semana: ' + (estados || 'ninguno') + '. Cuentan como canceladas CANCEL, DECLIN y NO SHOW; como sin cerrar, RESERVED.</p>' +
      kpis([
        ['', 'Reservas de la semana', num(r.validas), num(r.personas) + ' personas · ' + num(r.total) + ' recibidas'],
        [r.canceladas_pct > 20 ? 'rojo' : (r.canceladas ? 'amarillo' : 'verde'), 'Canceladas', num(r.canceladas), pct(r.canceladas_pct) + ' · ' + num(r.personas_canceladas) + ' personas perdidas'],
        ['', 'Walk-ins', r.walkins === null ? '—' : num(r.walkins), pct(r.walkins_pct) + ' de los comensales'],
        [r.sin_cerrar ? 'amarillo' : 'verde', 'Reservas sin cerrar', num(r.sin_cerrar), 'siguen en RESERVED']
      ]) +
      tabla(['Día', 'Reservas', 'Personas', 'Comensales POS', 'Walk-ins', 'Canceladas'],
        d.dias.map(function (x) { return { c: [esc(x.dia), num(x.reservas), num(x.personas) + (x.reservas_superan ? ' *' : ''), num(x.com), x.walkins === null ? '—' : num(x.walkins), num(x.canceladas)] }; }));
  }

  // 5
  h += '<h2 class="salto">5 · Food cost</h2>' +
    '<p class="nota">Sobre venta sin IVA ni servicio, contra las metas de PARAMETROS: global ' + pct(fc.meta_global, 0) + ', cocina ' + pct(fc.cocina.meta, 0) + ', barra ' + pct(fc.barra.meta, 0) + '. ' + esc(fc.aviso_barra) + '</p>' +
    kpis([
      [zonaCosto(fc.semana_pct, fc.meta_global), 'Food cost de la semana', pct(fc.semana_pct), 'móvil de 4 semanas: ' + pct(fc.movil4_pct)],
      [zonaCosto(fc.mes_pct, fc.meta_global), 'Food cost del mes a la fecha', pct(fc.mes_pct), esc(fc.mes_nombre) + (fc.mes ? ' · cocina ' + q(fc.mes.cocina) + ' · barra ' + q(fc.mes.barra) : '')],
      [fc.cocina.exceso > 0 ? 'rojo' : 'verde', 'Cocina: exceso sobre objetivo', signo(fc.cocina.exceso) + q(fc.cocina.exceso), pct(fc.cocina.real_pct) + ' real contra ' + pct(fc.cocina.meta, 0)],
      [fc.barra.exceso > 0 ? 'rojo' : 'verde', 'Barra: exceso sobre objetivo', signo(fc.barra.exceso) + q(fc.barra.exceso), pct(fc.barra.real_pct) + ' real contra ' + pct(fc.barra.meta, 0)]
    ]) +
    tabla(['Área', 'Venta del área', 'Costo real', 'Costo a objetivo', 'Exceso', 'Real %', 'Objetivo %', 'Desvío'],
      [['Cocina', fc.cocina], ['Barra', fc.barra]].map(function (p) {
        var x = p[1];
        return { c: [p[0], q(x.venta), q(x.costo), q(x.a_meta), '<span class="' + (x.exceso > 0 ? 'neg' : 'pos') + '">' + signo(x.exceso) + q(x.exceso) + '</span>', pct(x.real_pct), pct(x.meta, 0),
                     x.desvio_pts === null ? '—' : '<span class="' + (x.desvio_pts > 0 ? 'neg' : 'pos') + '">' + signo(x.desvio_pts) + x.desvio_pts + ' pp</span>'] };
      })) +
    '<p class="nota">Mix de ventas: cocina ' + pct(d.areas.mix_cocina) + ' · barra ' + pct(d.areas.mix_cocina === null ? null : 100 - d.areas.mix_cocina) + '. ' + esc(d.areas.nota) + '</p>';
  if (cp && cp.semanas && cp.semanas.length) {
    h += '<h3>Compras contra su techo, cuatro semanas</h3><p class="nota">' + esc(cp.nota) + '</p>';
    [['Cocina', 'cocina', cp.meta_cocina], ['Barra', 'barra', cp.meta_barra]].forEach(function (a) {
      var filas = cp.semanas.map(function (x) { return x[a[1]]; });
      var topeC = Math.max.apply(null, filas.map(function (t) { return Math.max(t.compra, t.techo); }).concat([1]));
      var imp = cp.impacto[a[1]];
      h += '<h4>' + a[0] + ' · compra contra su techo (' + pct(a[2], 0) + ')</h4>' +
        tabla(['Semana', 'Compra', '', 'Techo', 'Exceso', 'Real %'],
          cp.semanas.map(function (x, i) {
            var t = filas[i], sobre = t.exceso !== null && t.exceso > 0;
            return { c: ['S' + x.w + (x.actual ? ' (en curso)' : ''), q(t.compra), barra(t.compra, topeC, sobre ? C.rojo : C.verde), q(t.techo),
                         t.exceso === null ? '—' : '<span class="' + (sobre ? 'neg' : 'pos') + '">' + signo(t.exceso) + q(t.exceso) + '</span>', pct(t.real_pct)] };
          })) +
        kpis([
          [imp.exceso > 0 ? 'rojo' : 'verde', 'Exceso de compra esta semana', signo(imp.exceso) + q(imp.exceso), 'sobre el techo de ' + q(filas[filas.length - 1].techo)],
          [imp.exceso > 0 ? 'rojo' : 'verde', 'Venta extra que exige', imp.venta_extra === null ? '—' : q(imp.venta_extra), 'para volver al equilibrio (× ' + (cp.factor === null ? '—' : cp.factor) + ')']
        ]);
    });
  }

  // 6
  h += '<h2 class="salto">6 · Cocina y Barra</h2>' + (d.areas.error ? '<p class="nota neg">' + esc(d.areas.error) + '</p>' : '');
  [['Cocina', d.areas.cocina, d.metas.food_cocina], ['Barra', d.areas.barra, d.metas.food_barra]].forEach(function (p) {
    var a = p[1];
    h += '<h3>' + p[0] + '</h3>' + kpis([
      ['', 'Venta del área', q(a.venta), pct(a.venta_pct) + ' de la venta de la semana'],
      ['', 'Costo del área', q(a.costo), 'compra de la semana (motor de Finanzas)'],
      [zonaCosto(a.costo_pct, p[2]), 'Costo / venta', pct(a.costo_pct), 'objetivo ' + pct(p[2], 0)],
      [a.margen >= 0 ? 'verde' : 'rojo', 'Margen bruto', q(a.margen), pct(a.margen_pct) + ' del área']
    ]);
    h += a.top.length ? tabla(['Producto', 'Unidades', 'Venta', '% del área'],
      a.top.map(function (x) { return { c: [esc(x.nombre), num(x.uds), q(x.venta), pct(x.pct)] }; })
        .concat([{ cls: 'total', c: ['Total ' + p[0].toLowerCase(), num(a.uds), q(a.venta), '100%'] }]))
      : '<p class="nota">Sin ventas por plato cargadas para esta semana.</p>';
  });

  // 7
  h += '<h2 class="salto">7 · Personal y P&amp;L semanal</h2>' + kpis([
    [p2.prime < 60 ? 'verde' : (p2.prime <= 65 ? 'amarillo' : 'rojo'), 'Prime cost', pct(p2.prime), 'móvil de 4: ' + pct(p2.prime_m4)],
    ['', 'Nómina devengada de la semana', q(p2.labor_semana), pct(p2.labor_pct) + ' de la venta · planilla del mes ÷ 4.345'],
    ['', 'Sueldos fijos del mes', pm ? q(pm.fija) : '—', pm ? ('planilla ' + esc(pm.desde) + (pm.origen === 'estimada' ? ' (estimada)' : '')) : 'sin planilla'],
    ['', 'Personal extra del mes', pm ? q(pm.extra) : '—', pm ? ('cocina ' + q(pm.extra_cocina) + ' · barra y sala ' + q(pm.extra_barra) + ' · ' + num(pm.n_extra) + ' personas') : '']
  ]) + '<p class="nota">' + esc(p2.nota) + '</p>';
  function fila(nombre, monto, cls) {
    return { cls: cls, c: [esc(nombre), q(monto), pl.gasto ? pct(monto / pl.gasto * 100) : '—', pl.ventas ? pct(monto / pl.ventas * 100) : '—'] };
  }
  h += tabla(['Concepto', 'Monto', '% del gasto', '% de ventas'],
    [fila('Mercadería cocina (alimentos, con y sin factura)', pl.cogs_cocina), fila('Mercadería barra (bebidas, coctelería, licores)', pl.cogs_barra), fila('COGS total', pl.cogs, 'total'),
     fila('Nómina devengada', pl.labor)]
    .concat(pl.secciones.map(function (s) { return fila(s.seccion, s.q); }))
    .concat([fila('GASTO TOTAL', pl.gasto, 'total'),
             { cls: 'total', c: ['Resultado', '<span class="' + (pl.resultado >= 0 ? 'pos' : 'neg') + '">' + q(pl.resultado) + '</span>', '', pct(pl.resultado_pct)] }])) +
    '<p class="nota">' + esc(pl.nota_nomina) + ' Marketing va incluido (' + q(pl.marketing) + '); sin marketing el resultado sería ' + q(pl.resultado_sin_marketing) + '.</p>';

  // 8
  h += '<h2 class="salto">8 · Cómo se construye el equilibrio, y las acciones</h2>';
  if (pe) {
    h += '<table class="dos"><tr><td>' +
      tabla(['Costos fijos (PRESUPUESTO)', 'Al mes'],
        pe.fijos.map(function (f) { return { c: [esc(f.seccion) + (f.del_mes ? ' (del mes)' : '') + (f.anual ? ' (anual ÷ 12)' : ''), q(f.mensual)] }; })
          .concat([{ cls: 'total', c: ['Fijos del mes', q(pe.fijo_mes)] }, { cls: 'total', c: ['Fijos por semana (÷ 4.345)', q(pe.fijo_semana)] }])) +
      '</td><td>' +
      tabla(['Variables, % de la venta', ''],
        pe.variables.map(function (x) { return { c: [esc(x.seccion), pct(x.pct)] }; })
          .concat([{ c: ['Total variable', pct(pe.variables_pct)] }, { c: ['Margen de contribución', pct(pe.mc)] },
                   { cls: 'total', c: ['Punto de equilibrio', q(pe.pe_semana) + ' / semana · ' + q(pe.pe_dia) + ' / día'] }])) +
      '</td></tr></table>' +
      '<p class="nota">' + esc(pe.nota) + '</p>';
  }
  var ac = d.acciones;
  h += '<h3>Acciones de la semana</h3>' +
    (ac.lista.length ? tabla(['Acción', 'Responsable', 'Por qué (el dato)'], ac.lista.map(function (a) { return { c: ['<b>' + esc(a.accion) + '</b>', esc(a.responsable), esc(a.porque)] }; }))
                     : '<p class="nota">Sin acciones escritas para esta semana.</p>');

  h += '<p class="pie">Rosanta · CORSAGA, S.A. · Fuentes: ' + esc(d.fuentes) + ' · Los responsables son departamentos: el documento no lleva nombres de personas.</p>';

  var css = 'body{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#1a1a1a;margin:0;padding:18px 22px}' +
    '.cab{border-bottom:3px solid ' + C.verde + ';padding-bottom:8px;margin-bottom:10px}' +
    '.marca{font-family:Georgia,serif;font-size:22px;letter-spacing:0.18em;color:' + C.verde + '}' +
    '.tit{font-family:Georgia,serif;font-size:19px;color:' + C.verde + ';margin-top:4px}' +
    '.sub{color:' + C.gris + ';margin-top:3px}' +
    'h2{font-family:Georgia,serif;font-size:15px;color:' + C.verde + ';margin:16px 0 4px;border-bottom:1px solid ' + C.linea + ';padding-bottom:3px}' +
    'h2.salto{page-break-before:always}' +
    'h3{font-family:Georgia,serif;font-size:12.5px;color:' + C.verde + ';margin:12px 0 4px}' +
    'h4{font-size:10.5px;color:' + C.gris + ';margin:8px 0 3px}' +
    '.nota{color:' + C.gris + ';font-size:9.5px;line-height:1.45;margin:3px 0 7px}' +
    'table{border-collapse:collapse;width:100%}' +
    'table.k{margin:4px 0 8px;table-layout:fixed}' +
    'table.k td{vertical-align:top;padding:6px 8px;border:1px solid ' + C.linea + ';border-left-width:5px}' +
    '.et{font-size:9px;color:' + C.gris + '}.val{font-size:17px;font-weight:bold;margin:2px 0 1px}.det{font-size:8.5px;color:' + C.gris + ';line-height:1.4}' +
    'table.t{margin:4px 0 8px}table.t th{background:' + C.verde + ';color:#fff;font-weight:bold;text-align:right;padding:4px 6px;font-size:9.5px}' +
    'table.t td{text-align:right;padding:3px 6px;border-bottom:1px solid ' + C.linea + ';font-size:9.5px}' +
    'table.t th.l,table.t td.l{text-align:left}table.t tr.total td{font-weight:bold;border-top:2px solid #bbb}' +
    'table.dos{table-layout:fixed}table.dos td{vertical-align:top;padding:0 6px 0 0;border:0}' +
    '.pos{color:#2E6B3F}.neg{color:' + C.rojo + '}' +
    '.pie{color:#8a8780;font-size:8.5px;margin-top:14px;border-top:1px solid ' + C.linea + ';padding-top:5px}';

  return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Rosanta · Reporte semanal S' + d.semana.w + '</title><style>' + css + '</style></head><body>' + h + '</body></html>';
}
