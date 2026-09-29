// ============================================================================
// CARGA AUTOMATICA DEL BANCO AL MAESTRO (28-sep-2026, decision de Juanma)
// ============================================================================
/*
 * Antes, cada semana se escribia un script de un solo uso (cargar_banco_SXX.js) en el
 * proyecto del maestro y Juanma lo corria a mano en el editor: tres funciones por
 * semana, un archivo mas cada vez, y la S39 quedo sin cargar porque nadie lo corrio.
 *
 * Ahora la tarea del lunes (o una sesion) lee el PDF del banco, lo valida y deja
 * Maestro/_puente_reporte/banco_SXX.json:
 *   { hoja: '03_Banco_Industrial', semana: 'S39',
 *     totales: [[desde, hasta, debitos, creditos]],      // los impresos al pie del PDF
 *     filas:   [[fecha, docto, descripcion, debito, credito, categoria]] }
 * y el vigia (cada hora) lo carga con las mismas reglas del script de la S39:
 *   1. el encabezado de la hoja tiene que ser el de siempre;
 *   2. el lote tiene que sumar EXACTO los totales del banco, si no, no escribe;
 *   3. no repite filas (fecha + docto + debito + credito) que ya esten;
 *   4. relee lo escrito: fechas como fecha y las sumas otra vez contra el banco.
 * El resultado queda en resultado_banco_SXX.txt en la misma carpeta y el JSON se
 * renombra procesado_ (cargado) o revisar_ (frenado; no se reintenta solo).
 * Solo 03_Banco_Industrial por ahora: BAC y tarjeta son mensuales.
 */
var BANCO_HOJAS_ = { '03_Banco_Industrial': true };
var BANCO_FILA_ENC_ = 4;
var BANCO_ENC_ = ['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana'];

function _banNum_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _banDia_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    // regla 10 del motor: de 12:00 en adelante es el dia siguiente
    var d = new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
    return Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : '';
}

function _banClave_(fecha, docto, deb, cred) {
  return fecha + '|' + String(docto).replace(/\.0+$/, '').trim() + '|' + _banNum_(deb).toFixed(2) + '|' + _banNum_(cred).toFixed(2);
}

function _banCuadre_(totales, filas, leer, log) {
  var avisos = [];
  totales.forEach(function (T) {
    var deb = 0, cred = 0, n = 0;
    filas.forEach(function (f) { var x = leer(f); if (x.fecha >= T[0] && x.fecha <= T[1]) { deb += x.deb; cred += x.cred; n++; } });
    deb = _banNum_(deb); cred = _banNum_(cred);
    log.push('  ' + T[0] + ' a ' + T[1] + ': ' + n + ' filas · débitos ' + deb.toFixed(2) + ' · créditos ' + cred.toFixed(2));
    if (deb !== _banNum_(T[2]) || cred !== _banNum_(T[3])) {
      avisos.push('NO CUADRA ' + T[0] + ' a ' + T[1] + ': el banco imprime ' + _banNum_(T[2]).toFixed(2) + ' / ' + _banNum_(T[3]).toFixed(2));
    }
  });
  return avisos;
}

/** Carga UN lote. Devuelve { ok, escritas, log[] }. */
function _banCargarLote_(p) {
  var log = [], hoja = String(p.hoja || '');
  if (!BANCO_HOJAS_[hoja]) return { ok: false, escritas: 0, log: ['Hoja no permitida: "' + hoja + '".'] };
  var totales = p.totales || [], lote = p.filas || [];
  if (!totales.length || !lote.length) return { ok: false, escritas: 0, log: ['El lote no trae totales o filas.'] };
  var sh = SpreadsheetApp.openById(FIN_MAESTRO_ID).getSheetByName(hoja);
  if (!sh) return { ok: false, escritas: 0, log: ['No encuentro la hoja ' + hoja + '.'] };

  var avisos = [];
  var enc = sh.getRange(BANCO_FILA_ENC_, 1, 1, 11).getValues()[0].map(String);
  BANCO_ENC_.forEach(function (e, i) { if (enc[i].trim() !== e) avisos.push('Encabezado distinto en la columna ' + (i + 1) + ': "' + enc[i] + '"'); });
  log.push('El lote contra los totales del banco:');
  avisos = avisos.concat(_banCuadre_(totales, lote, function (f) { return { fecha: f[0], deb: _banNum_(f[3]), cred: _banNum_(f[4]) }; }, log));

  var datos = sh.getRange(1, 1, sh.getLastRow(), 11).getValues(), ya = {}, ultima = BANCO_FILA_ENC_;
  for (var r = BANCO_FILA_ENC_; r < datos.length; r++) {
    if (String(datos[r][0]).trim() === '' && String(datos[r][2]).trim() === '') continue;
    ultima = r + 1;
    ya[_banClave_(_banDia_(datos[r][0]), datos[r][1], datos[r][3], datos[r][4])] = 1;
  }
  var nuevas = lote.filter(function (f) { return !ya[_banClave_(f[0], f[1], f[3], f[4])]; });
  log.push('Última fila con datos: ' + ultima + ' · en el lote: ' + lote.length + ' · ya estaban: ' + (lote.length - nuevas.length) + ' · por agregar: ' + nuevas.length);
  if (nuevas.length && nuevas.length !== lote.length) avisos.push('Parte del lote ya estaba en la hoja: alguien cargó una parte a mano. No se escribe; revisar.');
  if (avisos.length) { log.push('AVISOS:'); avisos.forEach(function (a) { log.push('  ' + a); }); }
  if (avisos.length) return { ok: false, escritas: 0, log: log.concat(['NO se escribió nada.']) };
  if (!nuevas.length) return { ok: true, escritas: 0, log: log.concat(['Todo el lote ya estaba cargado. Nada que hacer.']) };

  var formulas = sh.getRange(ultima, 9, 1, 3).getFormulasR1C1()[0];
  var inicio = ultima + 1;
  var bloque = nuevas.map(function (f) {
    var q = String(f[0]).split('-'), d = new Date(Number(q[0]), Number(q[1]) - 1, Number(q[2]));
    return [f[0], f[1], f[2], _banNum_(f[3]), _banNum_(f[4]), '', f[5], (f[5] === 'PERSONAL' ? 'Si' : 'No'),
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || (_finClaveSemana_(d) % 100)];
  });
  sh.getRange(inicio, 1, bloque.length, 11).setValues(bloque);
  SpreadsheetApp.flush();

  var leido = sh.getRange(inicio, 1, bloque.length, 11).getValues(), malas = 0;
  leido.forEach(function (f, i) {
    var esFecha = Object.prototype.toString.call(f[0]) === '[object Date]';
    if (!esFecha || _banDia_(f[0]) !== nuevas[i][0]) { malas++; log.push('  FECHA MAL en la fila ' + (inicio + i) + ': quedó "' + f[0] + '", debía ser ' + nuevas[i][0]); }
  });
  log.push('Releído de la hoja, filas ' + inicio + ' a ' + (inicio + bloque.length - 1) + ':');
  var avL = _banCuadre_(totales, leido, function (f) { return { fecha: _banDia_(f[0]), deb: _banNum_(f[3]), cred: _banNum_(f[4]) }; }, log);
  if (malas || avL.length) {
    avL.forEach(function (a) { log.push('  ' + a); });
    return { ok: false, escritas: bloque.length, log: log.concat(['REVISAR: ' + malas + ' fecha(s) mal y ' + avL.length + ' cuadre(s) que no dan. Las filas QUEDARON escritas.']) };
  }
  return { ok: true, escritas: bloque.length, log: log.concat(['OK: ' + bloque.length + ' filas escritas y releídas.']) };
}

/** Lo llama vigiaCadaHora. Procesa cada banco_*.json de la carpeta del puente. */
function cargaBancoCadaHora_() {
  var carpeta = _puenteCarpeta_(), it = carpeta.getFiles(), lotes = [];
  while (it.hasNext()) { var f = it.next(); if (/^banco_.*\.json$/.test(f.getName())) lotes.push(f); }
  var out = [];
  lotes.forEach(function (f) {
    var nombre = f.getName(), r;
    try { r = _banCargarLote_(JSON.parse(f.getBlob().getDataAsString())); }
    catch (e) { r = { ok: false, escritas: 0, log: ['Error: ' + (e && e.message || e)] }; }
    var txt = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm') + ' · ' + nombre + '\n' + r.log.join('\n') + '\n';
    carpeta.createFile(nombre.replace(/^banco_/, 'resultado_banco_').replace(/\.json$/, '.txt'), txt, 'text/plain');
    f.setName((r.ok ? 'procesado_' : 'revisar_') + nombre);
    out.push(nombre + ': ' + (r.ok ? 'OK, ' + r.escritas + ' filas' : 'frenado'));
  });
  return out.length ? 'Banco: ' + out.join(' · ') : 'Banco: nada que cargar.';
}
