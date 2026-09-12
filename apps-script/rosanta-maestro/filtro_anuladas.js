// ============================================================
// ROSANTA - Las facturas anuladas dejan de contarse como gasto
// Preparado el 2 sep 2026.
//
// QUE PASO
// El maestro importa de SAT las facturas de compra tal como estan, y
// guarda su estado en la columna H de 01_FEL_Maestro ("Vigente" o
// "Anulado"). Hay 7 anuladas en 2026.
//
// Cuando un proveedor se equivoca, anula la factura y emite otra el
// mismo dia. SAT conserva las dos. Verificado una por una: TODAS las
// anuladas tienen su reemplazo vigente del mismo proveedor y la misma
// fecha. O sea que nadie hizo nada mal, el gasto es legitimo y esta
// bien registrado.
//
// El problema es de lectura: las 151 formulas que suman el FEL nunca
// miran la columna H, asi que suman la anulada Y su reemplazo. Q2,280
// de gasto que no existio.
//
//   agosto  Q1,705.00   Econtrisa Q500 x2 (reemplazadas por una de
//                       Q1,680) y Elite Marcas Q705
//   julio   Q  325.00   Pescaderia El Tiburoncito
//   mayo    Q  250.00   Alquifiestas MEG
//
// Dos anuladas mas son de Q0.00 (Bufete Olivero, Don Tavito): suman
// cero y nunca hicieron dano, pero se filtran igual.
//
// Y TAMBIEN TOCA EL IVA
// La columna C de 07_Reporte_Mensual suma la columna K del FEL (el IVA
// credito) con las mismas formulas sin filtro, y de ahi sale
// C46 -> B64 "IVA Credito Fiscal" -> B65 "A pagar". O sea que se esta
// acreditando IVA de facturas anuladas: Q242.51 en 2026, y el IVA a
// pagar a SAT sale mas bajo de lo que es. Este parche tambien lo
// corrige, porque las formulas de la columna C estan entre las 151.
// Vale avisarle al contador: es cifra fiscal, no solo de gestion.
//
// LO QUE DELATA EL ORIGEN
// El lado de VENTAS si filtra: 07_Reporte_Mensual!B7 lleva
// '01b_FEL_Emitidas'!F4:F4000,"Vigente" desde siempre. La regla se
// conocia y se aplico a lo que se emite, no a lo que se recibe.
//
// QUE HACE ESTE SCRIPT
// Agrega el filtro de estado a las 151 formulas, en tres hojas:
//   04_Reporte_Semanal    41  (SUMPRODUCT)
//   05_Reporte_Contador   42  (SUMPRODUCT)
//   07_Reporte_Mensual    68  (SUMIFS, 22 con IF() anidado)
// 09_PnL_Mensual no se toca: lee de 07_Reporte_Mensual y hereda el
// arreglo solo.
//
//   SUMIFS      -> agrega  ,'01_FEL_Maestro'!H5:H4000,"Vigente"
//   SUMPRODUCT  -> agrega  *('01_FEL_Maestro'!H5:H4000="Vigente")
//
// No se usa regex. Se recorre cada formula contando parentesis y
// respetando comillas, para encontrar el cierre exacto de cada
// llamada. Las 22 con IF() anidado se romperian con un regex ingenuo
// y por eso no se uso uno.
//
// SEGURIDAD
//   · Arranca en PREVIEW: no escribe nada, solo dice que haria.
//   · Antes de escribir guarda las 151 formulas originales en una hoja
//     de respaldo, y restaurarAnuladas() las devuelve tal cual.
//   · Idempotente: una formula que ya filtra por H se salta.
//   · Si una formula mezcla SUMIFS y SUMPRODUCT no la toca y la
//     reporta, para revisarla a mano. Hoy no hay ninguna asi.
//
// USO
//   1. correr "filtrarAnuladas" tal cual -> lee el Log, no escribe
//   2. poner PREVIEW_ANU = false
//   3. correr "filtrarAnuladas" otra vez -> escribe y respalda
//   4. revisar el P&L de agosto: debe bajar Q1,705
//   Para deshacer: "restaurarAnuladas".
// ============================================================

var PREVIEW_ANU  = false;   // <-- poner en false para escribir de verdad

var SHEET_ID_ANU = '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk';
var HOJAS_ANU    = ['04_Reporte_Semanal', '05_Reporte_Contador', '07_Reporte_Mensual'];
var FEL_ANU      = "'01_FEL_Maestro'";
var RANGO_H      = "!H5:H4000";        // mismo rango 5:4000 que usan las 151 formulas
var RESPALDO_ANU = '_RESPALDO_FORMULAS_FEL';

/** Indice del ')' que cierra el '(' de la posicion ap.
 *  Cuenta anidamiento y no se deja confundir por parentesis dentro de
 *  un texto entre comillas. */
function _cierreAnu(t, ap) {
  var d = 0, q = false;
  for (var j = ap; j < t.length; j++) {
    var ch = t.charAt(j);
    if (ch === '"') { q = !q; continue; }
    if (q) continue;
    if (ch === '(') d++;
    else if (ch === ')') { d--; if (d === 0) return j; }
  }
  return -1;
}

/** Devuelve {txt, n, motivo}. n = cuantas llamadas se parchearon. */
function _parchearAnu(t) {
  if (t.indexOf(FEL_ANU) < 0) return { txt: t, n: 0, motivo: 'no lee el FEL' };
  if (t.indexOf(FEL_ANU + '!H') >= 0) return { txt: t, n: 0, motivo: 'ya filtra por estado' };

  var haySP = t.indexOf('SUMPRODUCT(') >= 0, haySI = t.indexOf('SUMIFS(') >= 0;
  if (haySP && haySI) return { txt: t, n: 0, motivo: 'mezcla SUMIFS y SUMPRODUCT: revisar a mano' };
  if (!haySP && !haySI) return { txt: t, n: 0, motivo: 'sin SUMIFS ni SUMPRODUCT' };

  var fn  = haySP ? 'SUMPRODUCT(' : 'SUMIFS(';
  var ins = haySP ? '*(' + FEL_ANU + RANGO_H + '="Vigente")'
                  : ',' + FEL_ANU + RANGO_H + ',"Vigente"';

  // Se anotan los cierres y se insertan de derecha a izquierda, para que
  // los indices de los anteriores no se corran.
  var sitios = [], k = 0;
  while (true) {
    k = t.indexOf(fn, k);
    if (k < 0) break;
    var ap = k + fn.length - 1, ci = _cierreAnu(t, ap);
    if (ci > 0 && t.substring(ap, ci).indexOf(FEL_ANU) >= 0) sitios.push(ci);
    k++;
  }
  for (var s = sitios.length - 1; s >= 0; s--) t = t.substring(0, sitios[s]) + ins + t.substring(sitios[s]);
  return { txt: t, n: sitios.length, motivo: null };
}

function filtrarAnuladas() {
  var ss = SpreadsheetApp.openById(SHEET_ID_ANU);
  var cambios = [], saltadas = {}, revisar = [];

  HOJAS_ANU.forEach(function (nom) {
    var sh = ss.getSheetByName(nom);
    if (!sh) { revisar.push('No existe la hoja ' + nom); return; }
    var rg = sh.getDataRange(), fs = rg.getFormulas();
    for (var r = 0; r < fs.length; r++) {
      for (var c = 0; c < fs[r].length; c++) {
        var t = fs[r][c];
        if (!t || t.indexOf(FEL_ANU) < 0) continue;
        var res = _parchearAnu(t.charAt(0) === '=' ? t.substring(1) : t);
        if (res.motivo) {
          saltadas[res.motivo] = (saltadas[res.motivo] || 0) + 1;
          if (res.motivo.indexOf('revisar') >= 0) revisar.push(nom + '!' + sh.getRange(r + 1, c + 1).getA1Notation());
          continue;
        }
        if (!res.n) continue;
        cambios.push({ hoja: nom, fila: r + 1, col: c + 1,
                       a1: sh.getRange(r + 1, c + 1).getA1Notation(),
                       vieja: t, nueva: '=' + res.txt });
      }
    }
  });

  Logger.log('Formulas a parchear: ' + cambios.length);
  for (var m in saltadas) Logger.log('  saltadas por "' + m + '": ' + saltadas[m]);
  revisar.forEach(function (x) { Logger.log('  REVISAR A MANO: ' + x); });

  if (!cambios.length) { Logger.log('Nada que hacer. Puede que ya se haya corrido.'); return; }

  var ej = cambios[0];
  Logger.log('Ejemplo · ' + ej.hoja + '!' + ej.a1);
  Logger.log('  antes:   ...' + ej.vieja.slice(-90));
  Logger.log('  despues: ...' + ej.nueva.slice(-90));

  if (PREVIEW_ANU) {
    Logger.log('');
    Logger.log('PREVIEW: no se escribio nada. Poner PREVIEW_ANU = false y volver a correr.');
    return;
  }

  // Respaldo antes de tocar nada. Sin esto no hay vuelta atras.
  var bk = ss.getSheetByName(RESPALDO_ANU);
  if (bk) ss.deleteSheet(bk);
  bk = ss.insertSheet(RESPALDO_ANU);
  bk.getRange(1, 1, 1, 4).setValues([['hoja', 'celda', 'formula original', 'guardado']]);
  var sello = new Date();
  bk.getRange(2, 1, cambios.length, 4).setValues(cambios.map(function (x) {
    return [x.hoja, x.a1, "'" + x.vieja, sello];   // apostrofo: se guarda como texto, no como formula
  }));
  bk.hideSheet();

  cambios.forEach(function (x) {
    ss.getSheetByName(x.hoja).getRange(x.fila, x.col).setFormula(x.nueva);
  });

  Logger.log('');
  Logger.log('LISTO: ' + cambios.length + ' formulas parcheadas.');
  Logger.log('Respaldo en la hoja oculta "' + RESPALDO_ANU + '". Para deshacer: restaurarAnuladas().');
  Logger.log('Revisar el P&L: agosto debe bajar Q1,705 · julio Q325 · mayo Q250.');
}

/** Devuelve las formulas al estado anterior usando la hoja de respaldo. */
function restaurarAnuladas() {
  var ss = SpreadsheetApp.openById(SHEET_ID_ANU);
  var bk = ss.getSheetByName(RESPALDO_ANU);
  if (!bk) throw new Error('No hay hoja de respaldo "' + RESPALDO_ANU + '". Nada que restaurar.');
  var d = bk.getDataRange().getValues(), n = 0;
  for (var r = 1; r < d.length; r++) {
    var hoja = d[r][0], a1 = d[r][1], form = String(d[r][2]);
    if (!hoja || !a1) continue;
    ss.getSheetByName(hoja).getRange(a1).setFormula(form);
    n++;
  }
  Logger.log('Restauradas ' + n + ' formulas desde el respaldo del ' + d[1][3] + '.');
  Logger.log('La hoja de respaldo se deja donde esta, por si hace falta otra vez.');
}

/** Control: que anuladas hay y cuanto pesan. Se puede correr cuando sea,
 *  no escribe nada. Util en cada cierre de mes. */
function revisarAnuladas() {
  var sh = SpreadsheetApp.openById(SHEET_ID_ANU).getSheetByName('01_FEL_Maestro');
  var d = sh.getDataRange().getValues(), tot = 0, n = 0;
  Logger.log('--- Facturas de compra ANULADAS ---');
  for (var r = 4; r < d.length; r++) {
    if (String(d[r][7]).trim() !== 'Anulado') continue;   // H = Estado
    var m = Number(d[r][9]) || 0;                          // J = Gran_Total
    tot += m; n++;
    Logger.log('  fila ' + (r + 1) + '  ' + d[r][6] + '  Q' + m.toFixed(2) + '  mes ' + d[r][15]);
  }
  Logger.log('  ' + n + ' anuladas, Q' + tot.toFixed(2) + ' que NO deben contarse como gasto.');
}
