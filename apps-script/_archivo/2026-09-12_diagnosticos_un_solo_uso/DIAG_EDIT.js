/** TEMPORAL - que puede editar Jeffry. Solo lee. */
function diagEdicion() {
  var out = [];
  var TOKS = { Jeffry: '4f108d0720954ad1', Jose: '4025e02bf2e84f25', Juanma: 'f47771ae509247f2' };

  out.push('=== FILA EN USUARIOS (incluye puede_editar) ===');
  var filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'))
                .getSheetByName('USUARIOS').getDataRange().getValues();
  out.push('  ' + filas[0].join('  |  '));
  for (var i = 1; i < filas.length; i++) {
    out.push('  ' + filas[i].slice(0, 6).join('  |  '));
  }

  out.push('');
  out.push('=== webEstadoEdicion POR PERSONA ===');
  Object.keys(TOKS).forEach(function (n) {
    var r;
    try { r = webEstadoEdicion(TOKS[n]); }
    catch (e) { out.push('  ' + n + ': *** EXCEPCION *** ' + e.message); return; }
    if (!r || !r.ok) { out.push('  ' + n + ': FALLA -> ' + (r && r.error)); return; }
    var d = r.resultado || {};
    out.push('  ' + n + ':');
    out.push('     puede: ' + JSON.stringify(d.puede || d));
    if (d.areas !== undefined) out.push('     areas: ' + JSON.stringify(d.areas));
    Object.keys(d).forEach(function (k) {
      if (k !== 'puede' && k !== 'areas') out.push('     ' + k + ': ' + JSON.stringify(d[k]));
    });
  });

  out.push('');
  out.push('=== TABLA DE PERMISOS POR ROL (EDIT.permisos) ===');
  try {
    out.push('  ' + JSON.stringify(EDIT.permisos));
  } catch (e) { out.push('  no pude leer EDIT.permisos: ' + e.message); }
  return out.join('\n');
}
