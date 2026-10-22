// ============================================================
// ROSANTA - Cargos SIN FECHA de la tarjeta BAC, enero a abril 2026 (22-oct-2026)
//
// Separado del cierre de mes a proposito (decision de Juanma, 22-oct-2026). El ensayo del
// cierre de bancos encontro que en 05_Tarjeta_Credito_BAC faltan, de enero a abril, los dos
// cargos que el estado de la tarjeta trae SIN FECHA: "INTERES COM" y "CARGOS POR SERVICIO MES
// ANTERIOR" (de mayo en adelante si estan, con la fecha del corte). Este script carga SOLO esas
// filas, con la fecha de corte de cada estado.
//
// De donde: los CSV que bajo Juanma del BAC ("Transacciones del periodo"), en la carpeta de
// Drive BANCOS/Tarjeta de Credito - BAC/BAC_TC 2026 (CSF_CARPETA). El mes sale de la fecha de
// corte del archivo, no del nombre. Los montos NO estan en este codigo: se leen del archivo.
//
// Cada estado se valida ENTERO antes (saldo anterior + movimientos = pago de contado) con el
// mismo codigo del cierre de mes (cierre_bancos.js); si no cuadra, ese mes no se toca.
// Nunca duplica: llave fecha + descripcion + quetzales + dolares (la de la tarjeta en el cierre).
// Categoria por las reglas de CB_REGLAS: el interes, CB_CAT_INTERES (cierre_bancos.js, una sola constante);
// los cargos por servicio, COMISIONES_BANCARIAS.
// Las filas van al final de la pestaña (despues de octubre), con su fecha de corte.
//
// Y RECLASIFICA (decision de Juanma, 22-oct-2026): Netflix, Spotify y Apple son gasto del
// restaurante. Las filas de ENERO a JULIO de 05_Tarjeta_Credito_BAC con esa descripcion que
// quedaron en PERSONAL pasan a CUOTAS_Y_SUSCRIPCIONES con Es_Personal = No. Solo cambia esas dos
// celdas, y solo si la fila sigue diciendo lo que se leyo (fecha, descripcion, montos, PERSONAL)
// y el total de filas es el que se reviso (CSF_RECLAS_ESPERADAS); si no, no cambia ninguna.
//
//   revisarCargosSinFechaTcBac()   no escribe: dice que filas cargaria y cuales reclasificaria
//   cargarCargosSinFechaTcBac()
// Ensayo de solo lectura: node cloud/herramientas/ensayo-cargos-sin-fecha-tc.js
// Cuando corra, se saca del proyecto a apps-script/_archivo/ como los demas lotes.
// ============================================================

var CSF_CARPETA = '1DY3-hLOs4h5AX-nKPtgw-n5z6GOvwpY_';   // BANCOS/Tarjeta de Credito - BAC/BAC_TC 2026
var CSF_MESES = ['2026-01', '2026-02', '2026-03', '2026-04'];
var CSF_CONCEPTOS = /^(INTERES COM|CARGOS POR SERVICIO MES ANTERIOR)$/;
var CSF_HOJA_TC = '05_Tarjeta_Credito_BAC';
var CSF_RECLAS = /^(NETFLIX|SPOTIFY|APPLE\.COM)/i;
// De enero a julio (Juanma aprobo la lista el 22-oct-2026): Netflix y Spotify de ene-jun y Apple del 8-jul. Netflix y
// Spotify de julio ya estaban en CUOTAS.
var CSF_RECLAS_MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
var CSF_RECLAS_ESPERADAS = 12;  // 6 de Netflix, 5 de Spotify y 1 de Apple: si no son exactamente estas, no se cambia ninguna

/** Las filas a reclasificar: [{ fila, dia, desc, q, d }] (05_Tarjeta_Credito_BAC, ene-jul, PERSONAL). */
function _csfReclasLeer(sh) {
  var ultima = sh.getLastRow(), out = [];
  if (ultima <= CB_FILA_ENC) return out;
  var v = sh.getRange(CB_FILA_ENC + 1, 1, ultima - CB_FILA_ENC, 6).getValues();
  for (var i = 0; i < v.length; i++) {
    var dia = _cbDia(v[i][0]);
    if (CSF_RECLAS_MESES.indexOf(dia.slice(0, 7)) === -1) continue;
    if (!CSF_RECLAS.test(_cbDesc(v[i][1])) || _norm(v[i][4]) !== 'PERSONAL') continue;
    out.push({ fila: CB_FILA_ENC + 1 + i, dia: dia, desc: _norm(v[i][1]), q: _numero(v[i][2]), d: _numero(v[i][3]) });
  }
  return out;
}

/** Reclasifica (con escribir) y devuelve { cambiadas, avisos }. */
function _csfReclasificar(ss, escribir) {
  var sh = ss.getSheetByName(CSF_HOJA_TC), avisos = [];
  var filas = _csfReclasLeer(sh);
  filas.forEach(function (x) { Logger.log('  reclasificar ' + CSF_HOJA_TC + ' fila ' + x.fila + ' · ' + x.dia + ' · ' + x.desc + ' · PERSONAL -> CUOTAS_Y_SUSCRIPCIONES'); });
  if (filas.length !== CSF_RECLAS_ESPERADAS) {
    if (filas.length) avisos.push('Reclasificacion: hay ' + filas.length + ' filas y la revision encontro ' + CSF_RECLAS_ESPERADAS +
                                  '. Alguien las toco: no se cambia ninguna. >> NO se escribio nada.');
    else Logger.log('  No queda ninguna fila de Netflix, Spotify o Apple en PERSONAL de ene-jul.');
    return { cambiadas: 0, avisos: avisos };
  }
  if (!escribir) return { cambiadas: filas.length, avisos: avisos };
  var cambiadas = 0;
  filas.forEach(function (x) {
    var w = sh.getRange(x.fila, 1, 1, 6).getValues()[0];   // se relee la fila justo antes de tocarla
    var igual = _cbDia(w[0]) === x.dia && _norm(w[1]) === x.desc && _numero(w[2]) === x.q && _numero(w[3]) === x.d && _norm(w[4]) === 'PERSONAL';
    if (!igual) { avisos.push(CSF_HOJA_TC + ' fila ' + x.fila + ': ya no coincide con lo que se leyo; no se toco.'); return; }
    sh.getRange(x.fila, 5, 1, 2).setValues([['CUOTAS_Y_SUSCRIPCIONES', 'No']]);
    cambiadas++;
  });
  SpreadsheetApp.flush();
  var mal = filas.filter(function (x) { var w = sh.getRange(x.fila, 5, 1, 2).getValues()[0]; return _norm(w[0]) !== 'CUOTAS_Y_SUSCRIPCIONES' || _norm(w[1]) !== 'No'; }).length;
  if (mal) avisos.push('Reclasificacion: ' + mal + ' fila(s) no se releyeron como CUOTAS_Y_SUSCRIPCIONES / No.');
  return { cambiadas: cambiadas, avisos: avisos };
}

/** El CSV del banco de la tarjeta (sin comillas, separado por ", ") -> el CSV normalizado de TARJETA. */
function _csfBancoATexto(texto) {
  var ls = String(texto || '').split(/\r?\n/), i0 = -1;
  for (var i = 0; i < ls.length; i++) if (/^Pro0*duct/i.test(ls[i].trim())) { i0 = i; break; }
  if (i0 < 0 || !ls[i0 + 1]) return null;
  var tr = function (x) { return String(x).trim(); };
  var H = ls[i0].split(',').map(function (x) { return tr(x).toLowerCase(); }), v = ls[i0 + 1].split(',').map(tr);
  var iCash = -1;
  for (var h = 0; h < H.length; h++) if (/cash payment ?\/ ?local/.test(H[h])) { iCash = h; break; }
  var fecha = function (s) { var m = tr(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : tr(s); };
  var esc = function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  var filas = [CB_CAB_TARJETA.split(','), ['CORTE', v[0], fecha(v[2]), 'Fecha de corte', '', '', '']];
  var previo = null, sub = '', movs = [];
  for (var k = i0 + 2; k < ls.length; k++) {
    var crudo = ls[k].split(',');
    while (crudo.length && tr(crudo[crudo.length - 1]) === '') crudo.pop();
    if (!crudo.length) continue;
    if (/^current interest/i.test(tr(crudo[0]))) break;
    if (crudo.length < 4 || /^date$/i.test(tr(crudo[0]))) continue;
    var q = tr(crudo[crudo.length - 2]), d = tr(crudo[crudo.length - 1]);
    var desc = crudo.slice(1, crudo.length - 2).join(',').trim();
    if (tr(crudo[0]) === '') {
      if (/^previous balance$/i.test(desc)) { previo = [q, d]; continue; }
      if (/^\d{4}-\d{2}\*\*/.test(desc)) { sub = desc; continue; }
      if (/^(PUNTOS|ASIGNADO)\b/.test(desc)) continue;
      movs.push(['MOV', sub, fecha(v[2]), desc, q, d, '']);
    } else movs.push(['MOV', sub, fecha(crudo[0]), desc, q, d, '']);
  }
  if (previo) filas.push(['PREVIO', '', '', 'Saldo anterior', previo[0], previo[1], '']);
  filas = filas.concat(movs);
  if (iCash >= 0) filas.push(['CONTADO', '', '', 'Pago de contado', v[iCash], v[iCash + 1], '']);
  return filas.map(function (f) { return f.map(esc).join(','); }).join('\n');
}

function _csfCorrer(escribir) {
  var ss = SpreadsheetApp.openById(SHEET_ID_CARGA);
  _zonaCargaIgual_(ss);
  var it = DriveApp.getFolderById(CSF_CARPETA).getFiles(), porMes = {}, avisos = [], total = 0;
  while (it.hasNext()) {
    var f = it.next();
    if (!/\.csv$/i.test(f.getName())) continue;
    var t = _csfBancoATexto(f.getBlob().getDataAsString('ISO-8859-1'));
    var n = t ? _cbLeerNormalizado(t) : null;
    if (!n || n.formato !== 'TARJETA') continue;
    var mes = String(n.corte).slice(0, 7);
    if (CSF_MESES.indexOf(mes) === -1) continue;
    (porMes[mes] = porMes[mes] || []).push({ nombre: f.getName(), n: n });
  }
  Logger.log(escribir ? '=== Cargos sin fecha de la tarjeta BAC (ene-abr) y reclasificacion (ene-jul) ===' : '=== Cargos sin fecha de la tarjeta BAC: revision, no se escribe ===');
  CSF_MESES.forEach(function (mes) {
    var g = porMes[mes] || [];
    if (!g.length) { avisos.push(mes + ': no encontre el CSV de la tarjeta con corte en ese mes.'); return; }
    if (g.length > 1) { avisos.push(mes + ': hay ' + g.length + ' CSV con corte en ese mes (' + g.map(function (x) { return x.nombre; }).join(', ') + '). No se adivina. >> NO se escribio nada.'); return; }
    var n = g[0].n;
    var soloSinFecha = function (m) { return m.fecha === n.corte && CSF_CONCEPTOS.test(m.desc); };
    Logger.log(g[0].nombre + '  corte ' + n.corte + ' · ' + n.movs.filter(soloSinFecha).length + ' cargo(s) sin fecha');
    var r = _cbCargarNormalizado(ss, n, mes, g[0].nombre, escribir, soloSinFecha);
    total += r.nuevas;
    avisos = avisos.concat(r.avisos);
  });
  Logger.log((escribir ? 'Filas nuevas en total: ' : 'Filas que agregaria: ') + total);
  var rc = _csfReclasificar(ss, escribir);
  avisos = avisos.concat(rc.avisos);
  Logger.log((escribir ? 'Filas reclasificadas: ' : 'Filas que reclasificaria: ') + rc.cambiadas);
  if (avisos.length) { Logger.log('--- REVISAR ---'); avisos.forEach(function (x) { Logger.log('  ' + x); }); }
  return { cargos: total, reclasificadas: rc.cambiadas };
}

function revisarCargosSinFechaTcBac() { return _csfCorrer(false); }
function cargarCargosSinFechaTcBac()  { return _csfCorrer(true); }
