/**
 * CMV SIN IVA EN LAS HOJAS DE LOS RECETARIOS — script de un solo uso (p189, 27-sep-2026).
 *
 * Decision de Juanma: "Deja todo CMV sin IVA". La intranet mide asi desde el 14-sep,
 * pero las formulas de las hojas seguian dividiendo entre el precio de carta CON IVA
 * y el precio sugerido usaba la meta vieja escrita a mano (0.3 cocina, 0.2 barra).
 *
 * Correr desde el editor, en este orden:
 *   1. cmvSinIvaRevisar()  -> no escribe nada. Lee el registro: cuantas formulas cambia
 *                             por regla y cuales NO reconoce. Si hay "NO RECONOCIDAS"
 *                             que deberian cambiar, parar y avisar.
 *   2. cmvSinIvaAplicar()  -> escribe, relee y verifica. Idempotente: una formula que
 *                             ya divide entre 1.12 se salta.
 * Despues de correrlo: archivar este archivo fuera del proyecto (apps-script/_archivo/).
 *
 * Solo toca formulas que calzan EXACTO con los patrones leidos el 27-sep:
 *   cocina ficha  CMV % ACTUAL      =IFERROR(F23/E2,"")        -> =IFERROR(F23/(E2/1.12),"")
 *   cocina ficha  PRECIO SUGERIDO   =IFERROR(F23/0.3,"")       -> =IFERROR(F23/0.28*1.12,"")
 *   cocina RESUMEN CMV col F        =IFERROR('X'!F23/'X'!E2,"") y =IFERROR(E36/D36,"")
 *   barra ficha   CMV % ACTUAL      =IF(C2="","",E12/C2)       -> =IF(C2="","",E12/(C2/1.12))
 *   barra ficha   PRECIO SUGERIDO   =E12/0.2                   -> =E12/0.2*1.12
 *   barra ESCENARIO PRECIOS 2026 F  =E5/D5 ;  VENTAS 2026 J  =I4/H4
 * La meta del sugerido sale de PARAMETROS (metaDeArea_), no de la formula vieja.
 */
var CMVIVA_ = 1.12;

function cmvSinIvaRevisar() { return cmvSinIvaCorrer_(false); }
function cmvSinIvaAplicar() { return cmvSinIvaCorrer_(true); }

function cmvSinIvaCorrer_(escribir) {
  var quien = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (quien !== 'restaurante@rosanta.rest') throw new Error('Solo el dueno corre este script desde el editor.');
  var libros = [
    { clave: 'RECETARIO_COCINA_SHEET_ID', area: 'COCINA' },
    { clave: 'RECETARIO_BARRA_SHEET_ID',  area: 'BARRA' }
  ];
  var total = { cambios: 0, verificados: 0, noReconocidas: 0 };
  libros.forEach(function (lib) {
    var ss = SpreadsheetApp.openById(getSheetId_(lib.clave));
    var meta = metaDeArea_(lib.area) / 100;
    var cuenta = {}, noRec = [], cambios = [];
    ss.getSheets().forEach(function (sh) {
      var nombre = sh.getName();
      var rango = sh.getDataRange();
      var f = rango.getFormulas(), v = rango.getValues();
      for (var i = 0; i < f.length; i++) {
        for (var j = 0; j < f[i].length; j++) {
          var fo = f[i][j];
          var etiquetaB = String(v[i][1] || '').trim().toUpperCase();   // cocina: columna B
          var etiquetaA = String(v[i][0] || '').trim().toUpperCase();   // barra: columna A
          var r = cmvSinIvaRegla_(lib.area, nombre, j, fo, etiquetaA, etiquetaB, meta);
          if (r === 'hecha') { cuenta['ya sin IVA'] = (cuenta['ya sin IVA'] || 0) + 1; continue; }
          if (r === 'rara') { noRec.push(nombre + '!' + cmvCelda_(i, j) + ' ' + fo); continue; }
          if (!r) continue;
          cuenta[r.regla] = (cuenta[r.regla] || 0) + 1;
          cambios.push({ sh: sh, fila: i + 1, col: j + 1, antes: fo, despues: r.formula,
                         etiqueta: r.etiqueta, colEtiqueta: r.colEtiqueta });
        }
      }
      // Textos que explican la vara: se actualizan para que no contradigan la formula.
      if (lib.area === 'COCINA' && /^RESUMEN/i.test(nombre)) {
        var b2 = String(sh.getRange('B2').getValue() || '');
        if (/^Meta de CMV/i.test(b2) && !/sin IVA/i.test(b2)) cambios.push({ sh: sh, texto: 'B2',
          valor: 'Meta de CMV en cocina: ' + Math.round(meta * 100) + '% sobre precio SIN IVA (precio de carta / 1.12)' });
      }
    });
    Logger.log('== %s (%s, meta %s%%) ==', lib.area, ss.getName(), Math.round(meta * 100));
    Object.keys(cuenta).forEach(function (k) { Logger.log('  %s: %s', k, cuenta[k]); });
    Logger.log('  cambios a escribir: %s', cambios.length);
    cambios.slice(0, 3).forEach(function (c) {
      if (c.texto) Logger.log('    ej. %s!%s -> texto "%s"', c.sh.getName(), c.texto, c.valor);
      else Logger.log('    ej. %s!%s  %s  ->  %s', c.sh.getName(), cmvCelda_(c.fila - 1, c.col - 1), c.antes, c.despues);
    });
    if (noRec.length) {
      Logger.log('  NO RECONOCIDAS (%s), no se tocan:', noRec.length);
      noRec.forEach(function (x) { Logger.log('    %s', x); });
    }
    total.noReconocidas += noRec.length;

    if (escribir) {
      cambios.forEach(function (c) {
        if (c.texto) { c.sh.getRange(c.texto).setValue(c.valor); return; }
        c.sh.getRange(c.fila, c.col).setFormula(c.despues);
        if (c.etiqueta) c.sh.getRange(c.fila, c.colEtiqueta).setValue(c.etiqueta);
      });
      SpreadsheetApp.flush();
      var malos = cambios.filter(function (c) {
        if (c.texto) return String(c.sh.getRange(c.texto).getValue()) !== c.valor;
        return c.sh.getRange(c.fila, c.col).getFormula() !== c.despues;
      });
      total.cambios += cambios.length;
      total.verificados += cambios.length - malos.length;
      Logger.log('  ESCRITOS %s · verificados al releer %s', cambios.length, cambios.length - malos.length);
      malos.forEach(function (c) { Logger.log('    NO QUEDO: %s', c.sh.getName() + '!' + (c.texto || cmvCelda_(c.fila - 1, c.col - 1))); });
    }
  });
  var fin = escribir
    ? 'APLICADO: ' + total.verificados + ' de ' + total.cambios + ' cambios verificados; no reconocidas: ' + total.noReconocidas
    : 'REVISION (no se escribio nada). No reconocidas: ' + total.noReconocidas + '. Si todo cuadra, correr cmvSinIvaAplicar().';
  console.log(fin);
  return fin;
}

/* Devuelve {regla, formula, etiqueta, colEtiqueta}, 'hecha' si ya esta sin IVA, 'rara' si
   es una celda que deberia cambiar pero no calza con el patron, o null si no aplica. */
function cmvSinIvaRegla_(area, hoja, col, fo, etA, etB, meta) {
  if (!fo) return null;
  var yaHecha = fo.indexOf('1.12') !== -1;
  var m;
  if (area === 'COCINA') {
    if (etB.indexOf('CMV % ACTUAL') === 0 && col === 5) {
      if (yaHecha) return 'hecha';
      m = /^=IFERROR\((F\d+)\/E2,""\)$/.exec(fo);
      return m ? { regla: 'ficha CMV', formula: '=IFERROR(' + m[1] + '/(E2/' + CMVIVA_ + '),"")',
                   etiqueta: 'CMV % ACTUAL (sin IVA)', colEtiqueta: 2 } : 'rara';
    }
    if (etB.indexOf('PRECIO SUGERIDO') === 0 && col === 5) {
      if (yaHecha) return 'hecha';
      m = /^=IFERROR\((F\d+)\/0?\.\d+,""\)$/.exec(fo);
      return m ? { regla: 'ficha sugerido', formula: '=IFERROR(' + m[1] + '/' + meta + '*' + CMVIVA_ + ',"")',
                   etiqueta: 'PRECIO SUGERIDO CON IVA (CMV ' + Math.round(meta * 100) + '% sin IVA)', colEtiqueta: 2 } : 'rara';
    }
    if (/^RESUMEN/i.test(hoja) && col === 5 && fo.indexOf('/') !== -1) {
      if (yaHecha) return 'hecha';
      m = /^=IFERROR\(('[^']+'!F\d+)\/('[^']+'!E2),""\)$/.exec(fo);
      if (m) return { regla: 'resumen CMV', formula: '=IFERROR(' + m[1] + '/(' + m[2] + '/' + CMVIVA_ + '),"")' };
      m = /^=IFERROR\((E\d+)\/(D\d+),""\)$/.exec(fo);
      if (m) return { regla: 'resumen CMV postres', formula: '=IFERROR(' + m[1] + '/(' + m[2] + '/' + CMVIVA_ + '),"")' };
      return 'rara';
    }
    return null;
  }
  // BARRA: etiquetas en la columna A, formulas en la E (indice 4)
  if (etA.indexOf('CMV % ACTUAL') === 0 && col === 4) {
    if (yaHecha) return 'hecha';
    m = /^=IF\(C2="","",(E\d+)\/C2\)$/.exec(fo);
    return m ? { regla: 'ficha CMV', formula: '=IF(C2="","",' + m[1] + '/(C2/' + CMVIVA_ + '))',
                 etiqueta: 'CMV % ACTUAL (sin IVA)', colEtiqueta: 1 } : 'rara';
  }
  if (etA.indexOf('PRECIO SUGERIDO') === 0 && col === 4) {
    if (yaHecha) return 'hecha';
    m = /^=(E\d+)\/0?\.\d+$/.exec(fo);
    return m ? { regla: 'ficha sugerido', formula: '=' + m[1] + '/' + meta + '*' + CMVIVA_,
                 etiqueta: 'PRECIO SUGERIDO CON IVA (CMV ' + Math.round(meta * 100) + '% sin IVA)', colEtiqueta: 1 } : 'rara';
  }
  if (/^ESCENARIO PRECIOS/i.test(hoja) && col === 5 && fo.indexOf('/') !== -1) {
    if (yaHecha) return 'hecha';
    m = /^=(E\d+)\/(D\d+)$/.exec(fo);
    return m ? { regla: 'escenario CMV', formula: '=' + m[1] + '/(' + m[2] + '/' + CMVIVA_ + ')' } : 'rara';
  }
  if (/^VENTAS 2026/i.test(hoja) && col === 9 && fo.indexOf('/') !== -1) {
    if (yaHecha) return 'hecha';
    m = /^=(I\d+)\/(H\d+)$/.exec(fo);
    return m ? { regla: 'ventas CMV', formula: '=' + m[1] + '/(' + m[2] + '/' + CMVIVA_ + ')' } : 'rara';
  }
  return null;
}

function cmvCelda_(i, j) {
  var s = '', n = j + 1;
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s + (i + 1);
}
