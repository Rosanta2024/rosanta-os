/**
 * InventarioConsolidado.gs — Profit OS · Inventarios · consolidado para Contabilidad (8-oct-2026).
 *
 * Arma el mismo informe que se hacia a mano hasta junio
 * (Rosanta_Inventarios_Cierre_Junio_2026.xlsx): Resumen por area y categoria, y el
 * detalle de Barra y de Cocina. Lo deja como .xlsx en la carpeta del mes de
 * Reportes 2026 / Reportes Mensual / AAAA-MM, que es donde Contabilidad descarga el
 * cierre. NO calcula nada nuevo: cada monto es el de la pestaña del mes en
 * Rosanta_Inventario_Cocina / _Barra (lo mismo que muestra "El mes").
 *
 * Reglas:
 *  - Solo un mes CERRADO en las dos areas. Con un conteo abierto los montos todavia se mueven.
 *  - Si ya habia un consolidado de ese mes, se archiva con fecha en AAAA-MM/_Archive: no se pisa.
 *  - Antes de guardar, el total que calcula la hoja (formulas) tiene que dar lo mismo que la
 *    suma de la intranet. Si no, no se guarda nada.
 *  - Se arma en una hoja de Google temporal, se exporta a .xlsx y la temporal va a la papelera.
 *  - Paleta vigente de marca (la de junio era la anterior).
 */

var INV_CONS = {
  carpetaMensual: 'Reportes Mensual',   // dentro de REP_PDF.carpeta (Reportes 2026)
  archivo: '_Archive',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // bloques de barra en el orden del informe de junio
  bloques: [['DESTILADOS', 'Licores y destilados'], ['VINOS', 'Vinos'], ['CERVEZA', 'Cerveza y bebidas'],
            ['INSUMOS', 'Insumos de barra']],
  c: { verde: '#4E6D5A', medio: '#57A77F', lila: '#AEAAE2', crema: '#F2EEEB', negro: '#000000',
       gris: '#555555', sub: '#EAF3EC', blanco: '#FFFFFF' },
  q: '"Q"#,##0.00',
  // Como las nombraba el informe de junio. Solo la etiqueta del Excel: la hoja no se toca.
  // Llave = categoria de la hoja en mayusculas y sin tildes.
  etiquetas: { 'AVES Y LACTEOS': 'Aves y lácteos', 'PRODUCCION ROSANTA': 'Producción Rosanta (elaborados)',
               'DOORWAYS-VIJUASA': 'Insumos de limpieza (Doorways/Vijusa)', 'DOORWAYS-VIJUSA': 'Insumos de limpieza (Doorways/Vijusa)' }
};

/** Monto a centavos: lo que se ve en cada linea es lo que suma el subtotal. */
function invConsQ_(n) { return n == null || n === '' ? '' : Math.round(Number(n) * 100) / 100; }

/** Pantalla: genera el consolidado del mes (AAAA-MM). Escribe solo en la carpeta de reportes. */
function webInventarioConsolidado(auth, mes) {
  return edicionCorrer_(auth, function (u) {
    return invConCandado_(function () { return invConsolidado_(String(mes || ''), u); });
  }, 'inventario consolidado');
}

function invConsolidado_(mes, u) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mes invalido: "' + mes + '". Se espera AAAA-MM.');
  var datos = invConsolidadoDatos_(mes);
  var ss = SpreadsheetApp.create('_temp_consolidado_inventarios_' + mes + '_' + Date.now());
  var tempId = ss.getId();
  try {
    var celdaTotal = invConsEscribir_(ss, datos);
    SpreadsheetApp.flush();
    var deLaHoja = Math.round(Number(ss.getSheetByName('Resumen').getRange(celdaTotal).getValue()) * 100) / 100;
    // cada linea va redondeada al centavo: se tolera medio centavo por linea
    var tol = 0.01 + 0.005 * (datos.cocina.filas.length + datos.barra.filas.length);
    if (Math.abs(deLaHoja - datos.total) > tol) {
      throw new Error('El total del consolidado (Q' + deLaHoja + ') no da lo mismo que el inventario (Q' + datos.total +
                      '). No se guardo nada.');
    }
    var blob = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + tempId + '/export?mimeType=' +
                                 encodeURIComponent(INV_CONS.xlsx),
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (blob.getResponseCode() !== 200) throw new Error('No se pudo exportar a Excel (' + blob.getResponseCode() + ').');
    var nombre = 'Rosanta_Inventarios_Cierre_' + datos.mesNombre + '_' + datos.anio + '.xlsx';
    var carpeta = invConsCarpetaMes_(mes);
    var archivado = invConsArchivarPrevio_(carpeta.id, nombre);
    var creado = Drive.Files.create({ name: nombre, parents: [carpeta.id], mimeType: INV_CONS.xlsx },
                                    blob.getBlob().setName(nombre).setContentType(INV_CONS.xlsx),
                                    { supportsAllDrives: true, fields: 'id,name' });
    try { bitacora_(u.email, u.rol, 'inventario consolidado', 'INVENTARIO', mes, 'ARCHIVO', archivado ? archivado.nombre : '', nombre, 'Q' + datos.total); } catch (e) {}
    return {
      mes: mes, nombre: creado.name, id: creado.id, carpeta: 'Reportes Mensual / ' + carpeta.name,
      url: 'https://drive.google.com/file/d/' + creado.id + '/view',
      total: datos.total, barra: datos.barra.total, cocina: datos.cocina.total, archivado: archivado,
      gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm')
    };
  } finally {
    try { Drive.Files.update({ trashed: true }, tempId, null, { supportsAllDrives: true }); } catch (e) { /* queda en Mi unidad */ }
  }
}

/* ------------------------------------------------------------ los datos ---- */

function invConsolidadoDatos_(mes) {
  var out = { mes: mes, anio: mes.slice(0, 4), mesNombre: invConsMes_(mes) };
  var faltan = [];
  ['COCINA', 'BARRA'].forEach(function (area) {
    var d = invLeerArea_(area), m = null;
    d.meses.forEach(function (x) { if (x.mes === mes) m = x; });
    if (!m) { faltan.push(area.toLowerCase() + ' no tiene ' + mes); return; }
    if (m.estado !== 'CERRADO') { faltan.push(area.toLowerCase() + ' tiene ' + mes + ' ' + (m.estado || 'sin estado').toLowerCase()); return; }
    if (!m.cuadra) faltan.push('la fila TOTAL de ' + area.toLowerCase() + ' ' + mes + ' no cuadra con sus productos');
    out[area.toLowerCase()] = { total: m.total, cierre: m.cerradoPor || m.origen || '', filas: m.filas };
  });
  if (faltan.length) throw new Error('Todavia no se puede: ' + faltan.join('; ') + '. El consolidado va con los dos inventarios cerrados.');
  out.total = Math.round((out.cocina.total + out.barra.total) * 100) / 100;
  return out;
}

function invConsMes_(mes) {
  var n = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return n[Number(mes.slice(5, 7)) - 1];
}

/** "AVES Y LACTEOS" -> "Aves y lacteos": como vino en la hoja, solo la mayuscula inicial. */
function invConsTitulo_(s) {
  s = String(s || '').trim();
  if (!s) return 'Sin categoria';
  var llave = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (INV_CONS.etiquetas[llave]) return INV_CONS.etiquetas[llave];
  if (s !== s.toUpperCase()) return s;
  s = s.charAt(0) + s.slice(1).toLowerCase();
  // los nombres propios que aparecen en las categorias de la hoja
  return s.replace(/\b(rosanta|doorways|vijusa)\b/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
}

/** Agrupa filas por una clave, en el orden en que aparecen. */
function invConsGrupos_(filas, clave) {
  var orden = [], g = {};
  filas.forEach(function (f) { var k = clave(f); if (!g[k]) { g[k] = []; orden.push(k); } g[k].push(f); });
  return orden.map(function (k) { return { k: k, filas: g[k] }; });
}

/* --------------------------------------------------------- la planilla ---- */

/** Una hoja como lista de filas [B, C, D, E] mas el estilo de cada fila. */
function invConsHoja_() {
  var filas = [];
  return {
    filas: filas,
    add: function (vals, estilo) { filas.push({ v: vals, e: estilo || '' }); return filas.length; },   // numero de fila
    blanco: function () { filas.push({ v: [], e: '' }); return filas.length; }
  };
}

function invConsEscribir_(ss, d) {
  var C = INV_CONS.c;

  // ---- Barra
  var B = invConsHoja_(), subBarra = {}, totBarraFilas = [], sinValor = [];
  B.add(['BARRA — DETALLE (Cierre ' + d.mesNombre + ' ' + d.anio + ')'], 'titulo');
  B.blanco();
  INV_CONS.bloques.forEach(function (bl) {
    var filas = d.barra.filas.filter(function (f) { return (f[10] || 'INSUMOS') === bl[0]; });
    if (!filas.length) return;
    // un bloque sin ningun monto (los insumos de barra: cafe, azucar) no se lista; va en la nota
    if (!filas.some(function (f) { return Math.abs(f[8] || 0) > 0.005; })) {
      sinValor.push(bl[1].toLowerCase() + ' (' + filas.map(function (f) { return f[2]; }).join(', ') + ')');
      return;
    }
    var vinos = bl[0] === 'VINOS';
    B.add([bl[1].toUpperCase(), '', 'Monto (GTQ)'], 'seccion');
    if (vinos) B.add(['', 'Unidades', ''], 'colhead');
    var desde = B.filas.length + 1;
    if (bl[0] === 'DESTILADOS') {
      invConsGrupos_(filas, function (f) { return f[1]; }).forEach(function (g) {
        B.add([invConsTitulo_(g.k)], 'subgrupo');
        g.filas.forEach(function (f) { B.add(['   ' + f[2], '', invConsQ_(f[8] || 0)], 'item'); });
      });
    } else {
      filas.forEach(function (f) {
        B.add(vinos ? [f[2] + (f[5] ? ' · ' + f[5] : ''), f[7] == null ? '' : f[7], invConsQ_(f[8] || 0)]
                    : ['   ' + f[2], '', invConsQ_(f[8] || 0)], vinos ? 'itemvino' : 'item');
      });
    }
    var hasta = B.filas.length;
    var r = B.add(['Subtotal ' + bl[1], '', '=SUM(D' + desde + ':D' + hasta + ')'], 'subtotal');
    subBarra[bl[0]] = { fila: r, nombre: bl[1] };
    totBarraFilas.push('D' + r);
    B.blanco();
  });
  var rTotB = B.add(['TOTAL BARRA', '', '=' + totBarraFilas.join('+')], 'total');

  // ---- Cocina
  var K = invConsHoja_(), subCocina = [], totCocinaFilas = [];
  K.add(['COCINA — DETALLE (Cierre ' + d.mesNombre + ' ' + d.anio + ')'], 'titulo');
  K.blanco();
  invConsGrupos_(d.cocina.filas, function (f) { return f[1]; }).forEach(function (g) {
    var nom = invConsTitulo_(g.k);
    K.add([nom.toUpperCase(), 'Existencias', 'Precio', 'Monto (GTQ)'], 'seccion4');
    var desde = K.filas.length + 1;
    g.filas.forEach(function (f) {
      K.add(['   ' + f[2], f[7] == null ? '' : Math.round(f[7] * 100) / 100, invConsQ_(f[6]), invConsQ_(f[8] || 0)], 'item4');
    });
    var r = K.add(['Subtotal ' + nom, '', '', '=SUM(E' + desde + ':E' + K.filas.length + ')'], 'subtotal4');
    subCocina.push({ fila: r, nombre: nom });
    totCocinaFilas.push('E' + r);
    K.blanco();
  });
  var rTotK = K.add(['TOTAL COCINA', '', '', '=' + totCocinaFilas.join('+')], 'total4');

  // ---- Resumen
  var R = invConsHoja_();
  R.blanco();
  R.add(['ROSANTA'], 'marca');
  R.add(['Cocina con Carisma'], 'lema');
  R.blanco();
  R.add(['INFORME DE INVENTARIOS — CIERRE ' + d.mesNombre.toUpperCase() + ' ' + d.anio], 'informe');
  R.add(['CORSAGA, S.A.  ·  Mes: ' + d.mes + '  ·  Moneda: Quetzales (GTQ)'], 'meta');
  R.add(['Documento para Contabilidad'], 'doc');
  R.blanco();
  R.add(['VALUACIÓN POR ÁREA Y CATEGORÍA', '', 'Monto (GTQ)'], 'banda');
  R.add(['Categoría', '', 'Monto (GTQ)'], 'colres');
  R.add(['BARRA'], 'area');
  var dB = R.filas.length + 1;
  INV_CONS.bloques.forEach(function (bl) {
    if (subBarra[bl[0]]) R.add(['   ' + bl[1], '', '=Barra!D' + subBarra[bl[0]].fila], 'linea');
  });
  var rSubB = R.add(['Subtotal Barra', '', '=SUM(D' + dB + ':D' + R.filas.length + ')'], 'subres');
  R.blanco();
  R.add(['COCINA'], 'area');
  var dK = R.filas.length + 1;
  subCocina.forEach(function (s) { R.add(['   ' + s.nombre, '', '=Cocina!E' + s.fila], 'linea'); });
  var rSubK = R.add(['Subtotal Cocina', '', '=SUM(D' + dK + ':D' + R.filas.length + ')'], 'subres');
  R.blanco();
  var rTot = R.add(['INVENTARIO TOTAL AL CIERRE', '', '=D' + rSubB + '+D' + rSubK], 'totres');
  R.blanco();
  R.add(['Notas:'], 'notat');
  [
    '•  Valuación: existencia por precio del mes, tal como quedó en el cierre de cada área en la intranet (Profit OS › Inventarios).',
    '•  En licores y destilados la existencia es fracción de botella; en vinos, unidades. Cada monto va redondeado al centavo.',
    '•  Cierre de barra: ' + (d.barra.cierre || '—') + '.  Cierre de cocina: ' + (d.cocina.cierre || '—') + '.',
    '•  Fuentes: Rosanta_Inventario_Barra y Rosanta_Inventario_Cocina, pestaña ' + d.mes + '.',
    '•  Generado el ' + Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm') + '.'
  ].concat(sinValor.map(function (t) { return '•  Sin valuación en el inventario, no se listan: ' + t + '.'; }))
   .forEach(function (t) { R.add([t], 'nota'); });

  // ---- volcar
  var hR = ss.getSheets()[0].setName('Resumen');
  var hB = ss.insertSheet('Barra'), hK = ss.insertSheet('Cocina');
  invConsVolcar_(hR, R, 3, [3, 42, 18, 14]);
  invConsVolcar_(hB, B, 3, [3, 40, 12, 14]);
  invConsVolcar_(hK, K, 4, [3, 34, 12, 12, 14]);
  return 'D' + rTot;
}

/** Escribe valores (columna B en adelante) y aplica estilos agrupados en RangeList. */
function invConsVolcar_(h, H, ancho, anchos) {
  var n = H.filas.length;
  if (h.getMaxRows() < n + 2) h.insertRowsAfter(h.getMaxRows(), n + 2 - h.getMaxRows());
  var vals = H.filas.map(function (f) {
    var x = f.v.slice(0, ancho); while (x.length < ancho) x.push(''); return x;
  });
  h.getRange(1, 2, n, ancho).setValues(vals);
  h.setHiddenGridlines(true);
  anchos.forEach(function (w, i) { h.setColumnWidth(i + 1, w * 7); });
  var ultima = String.fromCharCode(65 + ancho);   // C, D o E
  var monto = ultima;                              // la ultima columna es el monto
  var grupos = {};
  H.filas.forEach(function (f, i) { if (f.e) (grupos[f.e] = grupos[f.e] || []).push(i + 1); });
  var C = INV_CONS.c, A = function (filas, c1, c2) { return filas.map(function (r) { return c1 + r + ':' + (c2 || c1) + r; }); };
  var est = function (filas, rango, o) {
    if (!filas || !filas.length) return;
    var rl = h.getRangeList(rango);
    rl.setFontFamily('Arial');
    if (o.size) rl.setFontSize(o.size);
    if (o.bold) rl.setFontWeight('bold');
    if (o.italic) rl.setFontStyle('italic');
    if (o.color) rl.setFontColor(o.color);
    if (o.fill) rl.setBackground(o.fill);
  };
  var todo = function (filas) { return A(filas, 'B', ultima); };
  var g = grupos;
  // Resumen
  est(g.marca, todo(g.marca || []), { size: 22, bold: true, color: C.verde });
  est(g.lema, todo(g.lema || []), { size: 10, italic: true, color: C.medio });
  est(g.informe, todo(g.informe || []), { size: 13, bold: true, color: C.negro });
  est(g.meta, todo(g.meta || []), { size: 9, color: C.gris });
  est(g.doc, todo(g.doc || []), { size: 9, italic: true, color: C.lila });
  est(g.banda, todo(g.banda || []), { size: 11, bold: true, color: C.blanco, fill: C.verde });
  est(g.colres, todo(g.colres || []), { size: 9, bold: true, color: C.gris });
  est(g.area, todo(g.area || []), { size: 10, bold: true, color: C.verde, fill: C.crema });
  est(g.linea, todo(g.linea || []), { size: 10, color: C.negro });
  est(g.subres, todo(g.subres || []), { size: 10, bold: true, color: C.negro, fill: C.sub });
  est(g.totres, todo(g.totres || []), { size: 12, bold: true, color: C.blanco, fill: C.verde });
  est(g.notat, todo(g.notat || []), { size: 9, bold: true, color: C.gris });
  est(g.nota, todo(g.nota || []), { size: 8, color: C.gris });
  // Detalle
  est(g.titulo, todo(g.titulo || []), { size: 12, bold: true, color: C.verde });
  ['seccion', 'seccion4'].forEach(function (k) { est(g[k], todo(g[k] || []), { size: 10, bold: true, color: C.blanco, fill: C.verde }); });
  est(g.colhead, todo(g.colhead || []), { size: 8, bold: true, color: C.gris });
  est(g.subgrupo, todo(g.subgrupo || []), { size: 9, bold: true, color: C.medio });
  ['item', 'itemvino', 'item4'].forEach(function (k) { est(g[k], todo(g[k] || []), { size: 9, color: C.negro }); });
  ['subtotal', 'subtotal4'].forEach(function (k) { est(g[k], todo(g[k] || []), { size: 10, bold: true, color: C.negro, fill: C.sub }); });
  ['total', 'total4'].forEach(function (k) { est(g[k], todo(g[k] || []), { size: 11, bold: true, color: C.blanco, fill: C.verde }); });
  // formatos de numero y alineacion
  h.getRange(1, ancho + 1, n, 1).setNumberFormat(INV_CONS.q).setHorizontalAlignment('right');
  if (ancho === 4) h.getRange(1, 4, n, 1).setNumberFormat(INV_CONS.q);       // precio en cocina
  if (ancho >= 3) h.getRange(1, 3, n, 1).setHorizontalAlignment('center');   // unidades / existencias
  var bordes = (g.colres || []).concat(g.area || [], g.linea || [], g.subres || [], g.totres || []);
  if (bordes.length) h.getRangeList(todo(bordes)).setBorder(true, null, true, null, null, null, '#c9c6c0', SpreadsheetApp.BorderStyle.SOLID);
}

/* ----------------------------------------------------------- la carpeta ---- */

/** Reportes 2026 / Reportes Mensual / AAAA-MM. Acepta "2026-09 (1)" si no hay una limpia. */
function invConsCarpetaMes_(mes) {
  var mens = drivesListar_("'" + REP_PDF.carpeta + "' in parents and name = '" + INV_CONS.carpetaMensual +
                           "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  if (!mens.length) throw new Error('No encontre la carpeta "' + INV_CONS.carpetaMensual + '" dentro de Reportes 2026.');
  var hijas = drivesListar_("'" + mens[0].id + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  var exacta = hijas.filter(function (f) { return f.name === mes; })[0];
  var parecida = hijas.filter(function (f) { return f.name.indexOf(mes) === 0; })[0];
  if (exacta || parecida) return exacta || parecida;
  var f = Drive.Files.create({ name: mes, parents: [mens[0].id], mimeType: 'application/vnd.google-apps.folder' },
                             null, { supportsAllDrives: true, fields: 'id,name' });
  return { id: f.id, name: f.name };
}

function invConsArchivarPrevio_(carpetaId, nombre) {
  var previos = drivesListar_("'" + carpetaId + "' in parents and name = '" + nombre + "' and trashed = false");
  if (!previos.length) return null;
  var arch = _repPdfSubcarpeta_(carpetaId, INV_CONS.archivo), out = null;
  var sello = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyyMMdd-HHmm');
  previos.forEach(function (p) {
    var nuevo = nombre.replace(/\.xlsx$/i, '') + '_archivado-' + sello + '.xlsx';
    Drive.Files.update({ name: nuevo }, p.id, null, { addParents: arch.id, removeParents: carpetaId, supportsAllDrives: true });
    out = { id: p.id, nombre: nuevo };
  });
  return out;
}
