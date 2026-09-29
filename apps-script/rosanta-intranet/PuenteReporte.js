// ============================================================================
// PUENTE CON EL REPORTE SEMANAL (28-sep-2026, decision de Juanma)
// ============================================================================
/*
 * El reporte semanal oficial lo arma la tarea del lunes en la Mac (formato v1.1,
 * Maestro/Rosanta_Formato_Reporte_Semanal.md) y propone las acciones de la semana que
 * viene, cada una amarrada a una meta de METAS. La Mac no puede escribir en la hoja de
 * config (clasp run no funciona en este proyecto), asi que el camino es Drive, igual
 * que el POS y el FEL:
 *
 *   1. EXPORTA (cada hora): Maestro/_puente_reporte/metas_acciones.json con las metas
 *      del mes actual y del siguiente (medMetasMes_), las anclas y las ACCIONES de las
 *      ultimas cuatro semanas. La tarea lo lee para proponer y para revisar lo de la
 *      semana pasada.
 *   2. IMPORTA: cada acciones_propuestas_*.json que deje la tarea en la misma carpeta
 *      entra a ACCIONES como "sugerida" (escrita por "Reporte semanal"), junto a las del
 *      vigia. Juanma las aprueba o descarta en el tablero. El archivo se renombra a
 *      procesado_* para no importarlo dos veces; ademas no se repite semana + accion.
 *
 * Lo corre vigiaCadaHora (los activadores usan HEAD). A mano: puenteReporteAhora().
 */
var PUENTE_CARPETA_ = '_puente_reporte';
var PUENTE_EXPORTA_ = 'metas_acciones.json';

function _puenteCarpeta_() {
  var maestro = DriveApp.getFileById(FIN_MAESTRO_ID).getParents().next();   // la carpeta Maestro
  var it = maestro.getFoldersByName(PUENTE_CARPETA_);
  return it.hasNext() ? it.next() : maestro.createFolder(PUENTE_CARPETA_);
}

function _puenteMetas_(anio, m, P) {
  var r = medMetasMes_(anio, m, P), out = { anio: anio, m: m, mes: r.mes, hay_fila: r.hay_fila };
  ['venta_rest', 'eventos', 'minimo', 'food', 'brecha', 'ticket', 'clientes', 'lmx', 'resenas', 'lectura'].forEach(function (k) {
    out[k] = r[k].valor; out[k + '_origen'] = r[k].origen;
  });
  out.venta_total = r.venta_total; out.comensales = r.comensales;
  return out;
}

/** Escribe metas_acciones.json. Devuelve cuantas acciones exporto. */
function _puenteExportar_(carpeta) {
  var hoy = new Date(), P = tabParametros_(), fc = metasFoodCost_();
  var sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
  var acciones = [];
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getDataRange().getValues(), head = v[0].map(String);
    var iP = head.indexOf('PORQUE'), iM = head.indexOf('META'), iR = head.indexOf('REGLA');
    var desde = medSemanaClave_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 28));
    for (var i = 1; i < v.length; i++) {
      var sem = String(v[i][0] || '');
      if (!sem || sem < desde) continue;
      acciones.push({ semana: sem, pilar: String(v[i][1] || ''), accion: String(v[i][2] || ''),
                      departamento: MED_PERSONA_A_DEPTO_[String(v[i][3])] || String(v[i][3] || ''),
                      fecha_limite: v[i][4] instanceof Date ? medFechaIso_(v[i][4]) : String(v[i][4] || '').slice(0, 10),
                      estado: String(v[i][5] || ''), escrito_por: String(v[i][6] || ''),
                      porque: iP >= 0 ? String(v[i][iP] || '') : '', meta: iM >= 0 ? String(v[i][iM] || '') : '',
                      regla: iR >= 0 ? String(v[i][iR] || '') : '' });
    }
  }
  var datos = {
    generado: Utilities.formatDate(hoy, 'America/Guatemala', "yyyy-MM-dd'T'HH:mm"),
    semana_en_curso: medSemanaClave_(hoy),
    metas_mes: _puenteMetas_(hoy.getFullYear(), hoy.getMonth() + 1, P),
    metas_mes_siguiente: _puenteMetas_(sig.getFullYear(), sig.getMonth() + 1, P),
    anclas: { food_cocina_pct: fc.COCINA, food_barra_pct: fc.BARRA,
              prime_max_pct: P.prime_cost_max_pct.valor, prime_rojo_pct: P.prime_cost_rojo_pct.valor,
              resenas_piso: MED_VISION_.resenas },
    // El punto de equilibrio de la ultima semana, del PRESUPUESTO (manda el PRESUPUESTO,
    // decision de Juanma del 28-sep-2026). Sale del mismo calculo del reporte y de Escenarios.
    equilibrio: (function () {
      try {
        var r = _repDatos_(0, false), e = r.equilibrio;
        return e ? { semana: 'S' + r.semana.w, pe_semana: e.pe_semana, pe_dia: e.pe_dia, fijo_semana: e.fijo_semana,
                     fijo_mes: e.fijo_mes, mc: e.mc, variables_pct: e.variables_pct, base: e.base } : null;
      } catch (eq) { return null; }
    })(),
    departamentos: Object.keys(MED_DEPTO_A_PERSONA_),
    acciones: acciones
  };
  var txt = JSON.stringify(datos, null, 1);
  var it = carpeta.getFilesByName(PUENTE_EXPORTA_);
  if (it.hasNext()) it.next().setContent(txt); else carpeta.createFile(PUENTE_EXPORTA_, txt, 'application/json');
  return acciones.length;
}

/** Importa las propuestas de la tarea del lunes. Devuelve cuantas acciones escribio. */
function _puenteImportar_(carpeta) {
  var archivos = [], it = carpeta.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/^acciones_propuestas_.*\.json$/.test(f.getName())) archivos.push(f); }
  if (!archivos.length) return 0;
  var sh = _vigHoja_(MED_ACC_HOJA_, MED_ACC_COLS_);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  function col(nombre) {
    var j = head.indexOf(nombre);
    if (j === -1) { j = head.length; head.push(nombre); sh.getRange(1, j + 1).setValue(nombre).setFontWeight('bold'); }
    return j;
  }
  var iP = col('PORQUE'), iM = col('META'), iR = col('REGLA');
  var v = sh.getDataRange().getValues(), ya = {};
  for (var i = 1; i < v.length; i++) ya[String(v[i][0]) + '|' + String(v[i][2]).trim().toLowerCase()] = true;
  var n = 0;
  archivos.forEach(function (f) {
    var p = JSON.parse(f.getBlob().getDataAsString());
    var sem = String(p.semana || '');
    if (!/^\d{4}-S\d{2}$/.test(sem)) throw new Error(f.getName() + ': semana invalida "' + sem + '" (se espera 2026-S40).');
    var anio = Number(sem.slice(0, 4)), w = Number(sem.slice(6));
    var ene4 = new Date(anio, 0, 4), lunes1 = new Date(anio, 0, 4 - ((ene4.getDay() || 7) - 1));
    var domingo = medFechaIso_(new Date(lunes1.getFullYear(), lunes1.getMonth(), lunes1.getDate() + (w - 1) * 7 + 6));
    (p.acciones || []).forEach(function (a) {
      var depto = String(a.departamento || ''), accion = String(a.accion || '').trim();
      if (!accion || !MED_DEPTO_A_PERSONA_[depto]) return;
      var clave = sem + '|' + accion.toLowerCase();
      if (ya[clave]) return;
      var fila = [sem, MED_DEPTO_A_PILAR_[depto], accion, MED_DEPTO_A_PERSONA_[depto], domingo, 'sugerida',
                  'Reporte semanal', new Date(), ''];
      while (fila.length < head.length) fila.push('');
      fila[iP] = String(a.porque || '') + (a.compromiso ? ' · Compromiso de la semana: ' + a.compromiso : '');
      fila[iM] = String(a.meta || '');
      fila[iR] = 'REPORTE-' + String(p.reporte || '');
      sh.appendRow(fila);
      ya[clave] = true; n++;
    });
    f.setName('procesado_' + f.getName());
  });
  SpreadsheetApp.flush();
  return n;
}

/** Lo llama vigiaCadaHora: primero importa (para que el export ya traiga lo nuevo). */
function puenteReporte_() {
  var carpeta = _puenteCarpeta_();
  var nuevas = _puenteImportar_(carpeta);
  var exportadas = _puenteExportar_(carpeta);
  return 'Puente del reporte: ' + nuevas + ' acciones importadas · ' + exportadas + ' exportadas.';
}

/** Herramienta de editor: corre el puente ya, sin esperar la hora. */
function puenteReporteAhora() {
  soloDueno_();
  var r = puenteReporte_();
  Logger.log(r);
  return r;
}
