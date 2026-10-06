// ============================================================
// ROSANTA - Tarjeta de credito BI (4042-****-****-4132): hoja nueva y carga ago-sep 2026
// Un solo uso (5-oct-2026). Se saca del proyecto apenas corre y queda en
// apps-script/_archivo/2026-10-05_carga_septiembre_bancos.
//
// Fuentes: capturas de Bi Banking "Detalle de movimientos tarjeta de credito"
//   Reportes Mensual/2026-08/Screenshot 2026-10-05 at 6.28.33 PM.png  (Mes Anterior 2)
//     saldo anterior 0.00 -> saldo final 578.05
//   Reportes Mensual/2026-09/TC - Bi 2026-09                          (Mes Anterior)
//     saldo anterior 578.05 -> saldo final 854.26
// Las compras de julio (27-31/07) vienen en el estado de agosto: se cargan con su fecha.
// Categorias: las mismas de la FEL de cada proveedor, para que la regla 15 las case.
// Clinica de Fisioterapia = PERSONAL (Juanma, 5-oct-2026).
//
// Ademas corrige 03_Banco_Industrial fila 928 (10/08, JOCOTENANGO, Q4,132.58): es el pago
// de esta tarjeta y estaba como VIATICOS. Pasa a PAGO_TARJETA_CREDITO.
//
//   clasp run revisarTarjetaBI   no escribe
//   clasp run cargarTarjetaBI
// ============================================================

var ZT_HOJA = '06_Tarjeta_Credito_BI';
var ZT_MODELO = '05_Tarjeta_Credito_BAC';

// [fecha, descripcion, quetzales, dolares, categoria]   (pago = negativo, como en la BAC)
var ZT_AGO = [
  ['2026-07-27', 'LA BODEGONA ANTIGUA GT', 498.15, 0, 'ALIMENTOS'],
  ['2026-07-27', 'DISTRIBUIDORA Y COMERC GT', 122.95, 0, 'ALIMENTOS'],
  ['2026-07-30', 'PARMA VEL GT', 488.75, 0, 'ALIMENTOS'],
  ['2026-07-31', 'COBRO POR SOBREGIRO', 102.68, 0, 'COMISIONES_BANCARIAS'],
  ['2026-07-31', 'IVA/COBRO SOBREGIR', 12.32, 0, 'COMISIONES_BANCARIAS'],
  ['2026-07-31', 'LA TORRE ANTIGUA 2 CR GT', 536.45, 0, 'ALIMENTOS'],
  ['2026-07-31', 'AVICOLA VILLALOBOS GT', 699.57, 0, 'ALIMENTOS'],
  ['2026-08-04', 'BELCA CC GT', 1671.71, 0, 'ALIMENTOS'],
  ['2026-08-10', 'PAGO AGENC 220909', -4132.58, 0, 'PAGO_TARJETA'],
  ['2026-08-12', 'ESTACION DE SERVICIO E GT', 578.05, 0, 'VIATICOS']
];
var ZT_SEP = [
  ['2026-08-26', 'CLINICA DE FISIOTERAPI GT', 375.00, 0, 'PERSONAL'],
  ['2026-09-15', 'INTERES MORATORIO (BI)', 8.88, 0, 'COMISIONES_BANCARIAS'],
  ['2026-09-16', 'PAGO TARJETA X61601211', -200.00, 0, 'PAGO_TARJETA'],
  ['2026-09-30', 'INTER/DEVENGADO (BI)', 92.33, 0, 'COMISIONES_BANCARIAS']
];
// [lote, saldo anterior, saldo final] de cada captura
var ZT_CUADRES = [[ZT_AGO, 0, 578.05], [ZT_SEP, 578.05, 854.26]];

function _ztNum_(v) { var n = Number(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }

function _ztCorrer_(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID), log = [escribir ? '=== CARGA ===' : '=== REVISION, no escribe ==='], frenos = [];

  ZT_CUADRES.forEach(function (c, i) {
    var s = _ztNum_(c[1] + c[0].reduce(function (a, f) { return a + f[2]; }, 0));
    log.push('captura ' + (i ? 'sep' : 'ago') + ': ' + c[1].toFixed(2) + ' + lote = ' + s.toFixed(2) + ' contra ' + c[2].toFixed(2));
    if (s !== c[2]) frenos.push('NO CUADRA la captura ' + (i ? 'sep' : 'ago'));
  });

  var modelo = ss.getSheetByName(ZT_MODELO), hoja = ss.getSheetByName(ZT_HOJA);
  var enc = modelo.getRange(4, 1, 1, 9).getValues()[0].map(String);
  log.push('encabezado del modelo: ' + enc.join(' | '));
  if (hoja && hoja.getLastRow() > 4) frenos.push('la hoja ' + ZT_HOJA + ' ya existe y tiene datos');

  // la fila 928 del BI
  var bi = ss.getSheetByName('03_Banco_Industrial'), f928 = bi.getRange(928, 1, 1, 8).getValues()[0];
  var ok928 = String(f928[2]).indexOf('JOCOTENANGO') === 0 && _ztNum_(f928[3]) === 4132.58 && String(f928[6]) === 'VIATICOS';
  log.push('BI fila 928: ' + f928[2] + ' · ' + f928[3] + ' · ' + f928[6] + (ok928 ? ' -> se corrige' : ' -> NO coincide, no se toca'));

  frenos.forEach(function (f) { log.push('FRENO: ' + f); });
  if (!escribir) return log.join('\n');
  if (frenos.length) { log.push('>> NO se escribio nada.'); return log.join('\n'); }

  if (!hoja) {
    hoja = ss.insertSheet(ZT_HOJA, modelo.getIndex());   // queda justo despues de la BAC
    modelo.getRange(1, 1, 4, 9).copyTo(hoja.getRange(1, 1, 4, 9));
    for (var c = 1; c <= 9; c++) hoja.setColumnWidth(c, modelo.getColumnWidth(c));
    hoja.setFrozenRows(modelo.getFrozenRows());
    hoja.getRange(1, 1).setValue('TARJETA DE CRÉDITO BI — 4042-****-****-4132 (CORSAGA, S.A.)');
    hoja.getRange(2, 1).setValue('Cargos a la tarjeta de Banco Industrial, desde jul-2026. Fuente: captura de Bi Banking del mes. ' +
                                 'Los pagos salen de la cuenta BI 6500002057 (alli van como PAGO_TARJETA_CREDITO).');
  }

  // Año, Mes y Semana: como en la ultima fila de la BAC (formula o valor)
  var formulas = modelo.getRange(modelo.getLastRow(), 7, 1, 3).getFormulasR1C1()[0];
  var filas = ZT_AGO.concat(ZT_SEP).map(function (f) {
    var p = f[0].split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return [f[0], f[1], f[2], f[3], f[4], f[4] === 'PERSONAL' ? 'Sí' : 'No',
            formulas[0] || d.getFullYear(), formulas[1] || (d.getMonth() + 1), formulas[2] || _zsSemanaISO_(d)];
  });
  hoja.getRange(5, 1, filas.length, 9).setValues(filas);
  modelo.getRange(5, 1, 1, 9).copyFormatToRange(hoja, 1, 9, 5, 4 + filas.length);
  if (ok928) bi.getRange(928, 7).setValue('PAGO_TARJETA_CREDITO');
  SpreadsheetApp.flush();

  var leido = hoja.getRange(5, 1, filas.length, 9).getValues(), malas = 0, s = 0;
  leido.forEach(function (w, i) { if (!(w[0] instanceof Date) || _zsDia_(w[0]) !== filas[i][0]) malas++; s += _ztNum_(w[2]); });
  log.push(ZT_HOJA + ': ' + filas.length + ' filas (5 a ' + (4 + filas.length) + ') · fechas mal: ' + malas + ' · suma Q ' + _ztNum_(s).toFixed(2) + ' (debe ser 854.26)');
  log.push('BI fila 928 ahora: ' + bi.getRange(928, 7).getValue());
  return log.join('\n');
}

function revisarTarjetaBI() { return _ztCorrer_(false); }
function cargarTarjetaBI()  { return _ztCorrer_(true); }

function _zsDia_(v) { var d = _fechaCarga(v); return d ? Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd') : ''; }
function _zsSemanaISO_(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  var ene1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - ene1) / 86400000) + 1) / 7);
}
