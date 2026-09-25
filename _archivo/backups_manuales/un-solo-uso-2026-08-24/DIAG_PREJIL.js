/**
 * DIAG_PREJIL.gs — De un solo uso. Borrar cuando se resuelva.
 *
 * Pregunta concreta: la ficha Gremolata pide "PREJIL" y en el .xlsx de la v16 esa
 * fila del Banco quedo renombrada a "ZZ DUP · Prejil" al marcar duplicados. Si eso
 * mismo pasa en la hoja viva, el VLOOKUP devuelve vacio y 50 g de perejil no se
 * estan costeando. Pero la bateria reporto 2 huerfanos en cocina, no 3.
 *
 * Una de las dos cosas esta mal. Esto lee la hoja VIVA y no pasa por Pruebas.gs,
 * asi que saca mi codigo de prueba de la ecuacion.
 *
 * NO ESCRIBE NADA.
 */
function DIAG_PREJIL() {
  var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
  Logger.log('Documento: %s', ss.getName());

  // 1. que dice el Banco vivo
  var b = ss.getSheetByName('BANCO DE DATOS').getDataRange().getValues();
  Logger.log('--- filas del Banco que se parecen a perejil ---');
  for (var i = 0; i < b.length; i++) {
    var p = String(b[i][2] || '');
    if (normalizar_(p).indexOf('rejil') > -1) {
      Logger.log('  fila %s: "%s"   D=%s   F=%s / %s', i + 1, p, b[i][3], b[i][5], b[i][6]);
    }
  }

  // 2. que pide la ficha y cuanto le da la hoja
  var g = ss.getSheetByName('Gremolata').getDataRange().getValues();
  Logger.log('--- la ficha Gremolata, como la ve la hoja viva ---');
  for (var r = 0; r < Math.min(g.length, 12); r++) {
    if (!g[r][1]) continue;
    Logger.log('  fila %s: "%s"  cant=%s  precio=%s  total=%s',
               r + 1, g[r][1], g[r][2], g[r][4], g[r][5]);
  }

  // 3. que dice el modelo, sin filtros mios
  var m = construirModelo_(), huerfanos = [];
  m.recetas.forEach(function (rec) {
    rec.ingredientes.forEach(function (ing) {
      if (ing.insumo === null) huerfanos.push(rec.area + ' · ' + rec.nombre + ' > ' + ing.nombre);
    });
  });
  Logger.log('--- TODOS los ingredientes sin match, sin filtrar (%s) ---', huerfanos.length);
  huerfanos.forEach(function (h) { Logger.log('  ' + h); });
}
