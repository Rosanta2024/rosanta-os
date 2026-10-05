/**
 * UN SOLO USO (28-sep-2026): los dobles conteos del DRE, confirmados por Juanma caso
 * por caso. Cambia la Categoria de 14 filas del maestro a PAGO_FACTURA_FEL (el pago
 * del banco de facturas que ya cuentan por FEL) o PERIODO_ANTERIOR (gasto de 2025).
 *
 * Solo el dueño, por ?page=reclasificar-dobles-28sep. Antes de escribir verifica que
 * la fila diga lo esperado (texto de la descripcion y monto al centavo); si no calza,
 * NO escribe esa fila y lo dice. Correrlo dos veces no cambia nada: una fila que ya
 * tiene la categoria nueva se salta. Retirar este archivo y su ruta despues de usarlo.
 */
var RECLAS_28SEP = [
  // [hoja, fila, texto que debe contener la descripcion, monto, categoria nueva]
  ['03_Banco_Industrial', 8, 'Renta Diciembre', 21560, 'PERIODO_ANTERIOR'],
  ['03_Banco_Industrial', 47, 'Doorways 1640907031', 290, 'PERIODO_ANTERIOR'],
  ['03_Banco_Industrial', 192, 'Doorways 1994474819', 355, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 262, 'PAGO CLARO', 378, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 344, 'Doorways 2311209694', 322.19, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 345, 'MC industrias 3928703043', 230, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 416, 'Marketing Abril 2026', 2250, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 693, 'PAGO CLARO', 777.46, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 720, 'Doorways 3332327238', 763, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 813, 'Doorways3332327238', 763, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 889, 'DoorwaysVarios', 703, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 943, 'EcontristaAgosto2026', 7720, 'PAGO_FACTURA_FEL'],
  ['03_Banco_Industrial', 1059, 'Marketing Agosto 2026', 2250, 'PAGO_FACTURA_FEL'],
  ['04_Banco_BAC', 222, 'Pago Eegsa', 8196.49, 'PAGO_FACTURA_FEL']
];
// columnas (1-based): descripcion, debito, categoria
var RECLAS_COLS = { '03_Banco_Industrial': [3, 4, 7], '04_Banco_BAC': [4, 5, 8] };

function reclasDobles28sep_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var out = [];
  try {
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
    RECLAS_28SEP.forEach(function (x) {
      var h = ss.getSheetByName(x[0]), c = RECLAS_COLS[x[0]];
      var desc = String(h.getRange(x[1], c[0]).getValue() || '');
      var monto = _finNum_(h.getRange(x[1], c[1]).getValue());
      var cel = h.getRange(x[1], c[2]), antes = String(cel.getValue() || '').trim();
      var fila = x[0] + ' fila ' + x[1] + ' · ' + desc + ' · Q' + monto;
      if (desc.toUpperCase().indexOf(x[2].toUpperCase()) === -1 || Math.abs(monto - x[3]) > 0.005) {
        out.push({ fila: fila, estado: 'NO CALZA: no se toco', antes: antes }); return;
      }
      if (antes === x[4]) { out.push({ fila: fila, estado: 'ya estaba', antes: antes }); return; }
      cel.setValue(x[4]);
      out.push({ fila: fila, estado: 'cambiada', antes: antes, despues: x[4] });
    });
    SpreadsheetApp.flush();
    // relee lo escrito: un "cambiada" que no quedo escrito es una mentira
    out.forEach(function (o, i) {
      if (o.estado !== 'cambiada') return;
      var x = RECLAS_28SEP[i], c = RECLAS_COLS[x[0]];
      var ahora = String(ss.getSheetByName(x[0]).getRange(x[1], c[2]).getValue() || '').trim();
      if (ahora !== x[4]) o.estado = 'NO QUEDO ESCRITA (lee ' + ahora + ')';
    });
  } finally { lock.releaseLock(); }
  try { CacheService.getScriptCache().remove(finCacheClave_()); } catch (e) { /* el cache vence solo */ }
  return out;
}

function reclasDobles28sepHtml_() {
  var r = reclasDobles28sep_();
  var ok = r.filter(function (o) { return o.estado === 'cambiada' || o.estado === 'ya estaba'; }).length;
  var html = '<div style="font-family:Arial,sans-serif;max-width:900px;margin:2rem auto">' +
    '<h2>Dobles conteos del DRE · 28-sep-2026</h2><p><b>' + ok + ' de ' + r.length + '</b> filas con su categoria nueva.</p>' +
    '<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px">' +
    '<tr><th>Fila</th><th>Antes</th><th>Estado</th></tr>' +
    r.map(function (o) {
      return '<tr><td>' + o.fila.replace(/</g, '&lt;') + '</td><td>' + o.antes + '</td><td>' + o.estado + (o.despues ? ' → ' + o.despues : '') + '</td></tr>';
    }).join('') + '</table></div>';
  return HtmlService.createHtmlOutput(html).setTitle('Reclasificacion 28-sep');
}
