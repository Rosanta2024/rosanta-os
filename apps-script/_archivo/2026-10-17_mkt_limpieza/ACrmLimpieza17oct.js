/**
 * UNA VEZ (17-oct-2026, sesion C, decision de Juanma): saca del CRM 35 contactos repetidos por
 * telefono y la fila "Gabi" con el correo personal de Juanma. NO se pierden: cada fila se copia
 * entera a la pestaña "archivo_2026-10-17" de esta misma hoja (con el motivo) y despues se quita.
 * Busca cada fila por nombre + telefono + correo tal como se ven (no por numero de fila) y frena
 * si alguna no aparece exactamente una vez. Con CRM17_APLICAR = false solo informa.
 * Despues de correrla se archiva en apps-script/_archivo/.
 */
var CRM17_APLICAR = true;

function crmLimpieza17oct() {
  // La lista de las 36 filas (nombre, telefono, correo) NO se guarda en git: son datos de clientes.
  // Estan completas en la hoja Rosanta_CRM_Maestra, pestaña archivo_2026-10-17.
  var ITEMS = [];
  var hoja = abrirPestanaCRM_();   // la misma que usa CRMSync
  var ncol = hoja.getLastColumn();
  var vis = hoja.getRange(1, 1, hoja.getLastRow(), ncol).getDisplayValues();
  function buscar(k) {
    var f = [];
    for (var i = 1; i < vis.length; i++) {
      if (vis[i][0].trim() === k.n.trim() && vis[i][1].trim() === k.t.trim() && vis[i][2].trim().toLowerCase() === k.e.trim().toLowerCase()) f.push(i + 1);
    }
    return f;
  }
  var plan = [], problemas = [];
  ITEMS.forEach(function (it) {
    var s = buscar(it.sacar);
    if (s.length !== 1) { problemas.push('No la encuentro una sola vez (' + s.length + '): ' + JSON.stringify(it.sacar)); return; }
    var p = null;
    if (it.principal) {
      var pp = buscar(it.principal);
      if (pp.length !== 1) { problemas.push('Principal no unica (' + pp.length + '): ' + JSON.stringify(it.principal)); return; }
      p = pp[0];
    }
    plan.push({ fila: s[0], principal: p, it: it });
  });
  var msg = 'Filas en el CRM: ' + (vis.length - 1) + ' · a sacar: ' + plan.length + ' de ' + ITEMS.length + ' · problemas: ' + problemas.length;
  Logger.log(msg);
  problemas.forEach(function (x) { Logger.log('PROBLEMA ' + x); });
  plan.forEach(function (x) { Logger.log('fila ' + x.fila + ' ' + x.it.sacar.n + ' ' + x.it.sacar.t + (x.principal ? ' -> queda la fila ' + x.principal : '') + (x.it.nota_a_principal ? ' · nota: ' + x.it.nota_a_principal : '')); });
  if (problemas.length || !CRM17_APLICAR) return msg + (CRM17_APLICAR ? ' · NO SE ESCRIBIO NADA (hay problemas)' : ' · EN SECO: no se escribio nada');

  var libro = hoja.getParent();
  var arch = libro.getSheetByName('archivo_2026-10-17') || libro.insertSheet('archivo_2026-10-17', libro.getSheets().length);
  if (arch.getLastRow() === 0) arch.appendRow(vis[0].map(function (h) { return 'archivado_' + h; }).concat(['motivo', 'queda como', 'sacada el']));  // sin 'first_name' en la fila 1: abrirPestanaCRM_ no la confunde con el CRM
  var valores = hoja.getRange(1, 1, hoja.getLastRow(), ncol).getValues();
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  plan.forEach(function (x) {
    var q = x.principal ? vis[x.principal - 1].slice(0, 3).join(' · ') : '';
    arch.appendRow(valores[x.fila - 1].concat([x.it.motivo, q, hoy]));
    if (x.principal && x.it.nota_a_principal) {
      var c = hoja.getRange(x.principal, 10), ant = String(c.getValue() || '');
      if (ant.indexOf(x.it.nota_a_principal) === -1) c.setValue(ant ? ant + ' | ' + x.it.nota_a_principal : x.it.nota_a_principal);
    }
  });
  SpreadsheetApp.flush();
  if (arch.getLastRow() - 1 < plan.length) throw new Error('El archivo no tiene todas las filas: no se quito nada del CRM.');
  plan.map(function (x) { return x.fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { hoja.deleteRow(f); });
  SpreadsheetApp.flush();
  var despues = hoja.getLastRow() - 1;
  var fin = 'APLICADO: CRM ' + (vis.length - 1) + ' -> ' + despues + ' filas · archivadas ' + (arch.getLastRow() - 1);
  Logger.log(fin);
  return fin;
}
