/**
 * EstadoRecetarios.gs — Chequeo de solo lectura de las IDs del modulo de costeo.
 *
 * Un archivo con UNA sola funcion, por la misma razon que Diagnostico.gs: el
 * desplegable del editor no fija la seleccion y Run termina corriendo la primera.
 *
 * No escribe nada. Dice, por cada propiedad, si la ID existe y se puede abrir.
 */
function verEstadoRecetarios() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var claves = ['RECETARIO_COCINA_SHEET_ID', 'RECETARIO_BARRA_SHEET_ID',
                'COSTEO_SHEET_ID', 'INVENTARIO_CIERRE_SHEET_ID',
                'RECETARIO_COCINA_SHEET_ID_ANTERIOR', 'RECETARIO_FOTOS_FOLDER_ID'];
  var out = [];

  claves.forEach(function (k) {
    var id = props[k];
    if (!id) { out.push(k + ' -> (vacia)'); return; }
    try {
      var ss = SpreadsheetApp.openById(id);
      var hojas = ss.getSheets().map(function (h) { return h.getName(); });
      out.push(k + ' -> OK  "' + ss.getName() + '"  (' + hojas.length + ' hojas)  ' + id);
      out.push('      MAPA POS: ' + (ss.getSheetByName('MAPA POS') ? 'si' : 'no') +
               ' | RESUMEN CMV: ' + (ss.getSheetByName('RESUMEN CMV') ? 'si' : 'no') +
               ' | BANCO DE DATOS: ' + (ss.getSheetByName('BANCO DE DATOS') ? 'si' : 'no'));
    } catch (e) {
      out.push(k + ' -> ROTA  ' + id + '  (' + e.message + ')');
    }
  });

  var otras = Object.keys(props).filter(function (k) { return claves.indexOf(k) === -1; });
  out.push('otras propiedades: ' + (otras.length ? otras.join(', ') : '(ninguna)'));

  out.forEach(function (l) { Logger.log(l); });
  return out.join('\n');
}
