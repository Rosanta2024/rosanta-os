/**
 * SISTEMA DE MEDICION (27-sep-2026)
 *
 * Especificacion: Rosanta OS / 02_Management_OS / 2026-09-27_Sistema_de_Medicion_Rosanta.md
 *
 * Una sola cadena de metas: venta del mes -> un numero por pilar -> palancas. Este archivo
 * NO calcula ningun numero de negocio: lee las metas del mes (pestaña METAS, con columnas
 * nuevas a la derecha de las cinco de siempre), las instala cuando Juanma lo pide, y arma
 * la franja "Tu semana" del panel principal con campos que ya calculan los motores.
 *
 * METAS: las columnas 1 a 5 son las de siempre (ANIO, MES, META_VENTA, META_FOOD_PCT,
 * ORIGEN) y _finMeta_ las sigue leyendo igual. META_VENTA es la venta del RESTAURANTE,
 * sin eventos, porque K05 la compara contra la venta sin eventos. META_FOOD_PCT se sigue
 * ignorando (decision del 14-sep: la meta de food cost es la de PARAMETROS); el tramo del
 * mes hacia esa meta va en TRAMO_FOOD_PCT, que es otra cosa.
 *
 * AMBITO GLOBAL: todo empieza con med / _med y lo privado termina en guion bajo.
 */

var MED_COLS_EXTRA = ['META_EVENTOS_Q', 'MINIMO_VENTA_TOTAL', 'TRAMO_FOOD_PCT', 'TRAMO_BRECHA_PTS',
                      'META_TICKET_Q', 'META_CLIENTES_NUEVOS', 'META_LMX_DIA', 'META_RESENAS_SEM',
                      'META_LECTURA_PCT', 'META_DIAS_CAJA'];

/* Las metas del plan (seccion 3). Septiembre es de transicion: su venta es la automatica
   que ya mostraba la intranet (maximo entre +20% del año anterior y el promedio de 3
   meses), congelada para que el tablero tenga contra que medir desde hoy. */
var MED_ORIGEN_ = 'Sistema de Medicion v1 (27-sep-2026)';
var MED_PLAN_ = [
  // anio, mes, venta rest., eventos, minimo total, food, brecha, ticket, clientes, lmx, reseñas, lectura, dias caja
  [2026,  9, 128736,     0, 120000, 36, 5, 245, 40, 14, 3, 70,  5, 'transicion: meta automatica congelada'],
  [2026, 10, 142000,  8000, 140000, 36, 5, 245, 40, 14, 3, 70,  5, 'no cruzar cero; el piso (Q163,400) es excelencia'],
  [2026, 11, 154000, 15000, 163400, 34, 4, 245, 50, 15, 4, 85,  7, 'piso'],
  [2026, 12, 205000, 15000, 182700, 33, 3, 255, 55, 16, 5, 90, 12, 'objetivo']
];

/* PARAMETROS: lo que el sistema agrega (si falta) o ajusta (si tiene el valor viejo). */
var MED_PARAMETROS_ = [
  { k: 'meta_venta_anio',          v: 1930000, viejo: 1950000 },
  { k: 'ticket_promedio_meta_q',   v: 245,     viejo: 280 },     // pasa a base sin IVA
  { k: 'eventos_mes_meta_q',       v: 8000 },
  { k: 'clientes_nuevos_mes_meta', v: 40 },
  { k: 'resenas_semana_meta',      v: 3 },
  { k: 'lectura_wix_meta_pct',     v: 70 },
  { k: 'repeticion_meta_pct',      v: 24 }
];

/** Todas las filas de METAS, con las columnas nuevas por nombre. [] si no existe. */
function medMetasFilas_() {
  var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(FIN_HOJA_METAS);
  if (!hoja) return [];
  var v = hoja.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0].map(function (h) { return String(h || '').trim().toUpperCase(); });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var anio = Number(v[i][0]), m = Number(v[i][1]);
    if (!anio || !m) continue;
    var f = { anio: anio, m: m, mes: FIN_MESES[m - 1], venta: _finNum_(v[i][2]) || null,
              origen: String(v[i][4] || '').trim(), fila: i + 1 };
    MED_COLS_EXTRA.forEach(function (c) {
      var j = head.indexOf(c);
      var x = j >= 0 ? v[i][j] : '';
      f[c.toLowerCase()] = (x === '' || x === null || isNaN(Number(x))) ? null : Number(x);
    });
    out.push(f);
  }
  return out;
}

/**
 * Las metas de UN mes, cada una con su origen: la fila de METAS si la trae, si no
 * PARAMETROS, si no null ("sin meta"). P es tabParametros_().
 */
/** Texto de una meta que puede faltar: nunca imprime "null" (28-sep-2026). */
function medMetaTxt_(v, antes, despues, siFalta) {
  if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return siFalta === undefined ? 'sin meta' : siFalta;
  return (antes || '') + v + (despues || '');
}

function medMetasMes_(anio, m, P) {
  var fila = null;
  try { medMetasFilas_().forEach(function (f) { if (f.anio === anio && f.m === m) fila = f; }); } catch (e) { fila = null; }
  function de(col, param) {
    if (fila && fila[col] !== null && fila[col] !== undefined) return { valor: fila[col], origen: 'METAS' };
    if (param && P && P[param] && P[param].valor !== null && P[param].valor !== undefined) {
      return { valor: P[param].valor, origen: P[param].origen };
    }
    return { valor: null, origen: 'sin meta' };
  }
  var r = {
    anio: anio, m: m, mes: FIN_MESES[m - 1], hay_fila: !!fila, origen_fila: fila ? fila.origen : '',
    venta_rest: fila && fila.venta ? { valor: fila.venta, origen: 'METAS' } : { valor: null, origen: 'sin meta' },
    eventos:    de('meta_eventos_q', 'eventos_mes_meta_q'),
    minimo:     de('minimo_venta_total'),
    food:       de('tramo_food_pct', 'food_cost_objetivo_pct'),     // sin tramo del mes, la meta final
    brecha:     de('tramo_brecha_pts', 'brecha_cmv_revisar_pts'),
    ticket:     de('meta_ticket_q', 'ticket_promedio_meta_q'),
    clientes:   de('meta_clientes_nuevos', 'clientes_nuevos_mes_meta'),
    lmx:        de('meta_lmx_dia', 'comensales_lmx_meta'),
    resenas:    de('meta_resenas_sem', 'resenas_semana_meta'),
    lectura:    de('meta_lectura_pct', 'lectura_wix_meta_pct'),
    dias_caja:  de('meta_dias_caja', 'caja_colchon_dias')
  };
  var vt = r.venta_rest.valor, ev = r.eventos.valor || 0, tk = r.ticket.valor;
  r.venta_total = vt ? vt + ev : null;
  r.comensales = (vt && tk) ? Math.round(vt / tk) : null;     // comensales = venta del restaurante / ticket
  return r;
}

/**
 * Instala el sistema: METAS (sep a dic de 2026, con las columnas nuevas) y las filas
 * de PARAMETROS. Lo llama el boton de la pestaña "Metas y ajustes" del tablero, solo
 * el rol dueño. Idempotente: correrlo dos veces no duplica nada.
 *
 * NO pisa lo que haya escrito Juanma: una fila de METAS que ya existe se deja como esta
 * salvo que su ORIGEN diga PROVISIONAL o este vacio, y un parametro solo se ajusta si
 * tiene exactamente el valor viejo. Todo lo que cambia —y todo lo que NO cambia y por
 * que— sale en el reporte, con el valor anterior para poder deshacerlo a mano.
 */
function instalarSistemaMedicion(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var rep = [];

    // ---- METAS
    var head = FIN_METAS_COLS.concat(MED_COLS_EXTRA);
    var hoja = ss.getSheetByName(FIN_HOJA_METAS);
    if (!hoja) {
      hoja = ss.insertSheet(FIN_HOJA_METAS);
      hoja.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      hoja.setFrozenRows(1);
      rep.push('METAS: pestaña creada con ' + head.length + ' columnas.');
    } else {
      var actual = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0]
                     .map(function (h) { return String(h || '').trim().toUpperCase(); });
      MED_COLS_EXTRA.forEach(function (c) {
        if (actual.indexOf(c) === -1) {
          var col = actual.length + 1;
          hoja.getRange(1, col).setValue(c).setFontWeight('bold');
          actual.push(c);
          rep.push('METAS: columna nueva ' + c + '.');
        }
      });
      head = actual;
    }
    var datos = hoja.getDataRange().getValues();
    MED_PLAN_.forEach(function (p) {
      var fila = [p[0], p[1], p[2], '', MED_ORIGEN_ + ' · ' + p[13]];
      var extra = { META_EVENTOS_Q: p[3], MINIMO_VENTA_TOTAL: p[4], TRAMO_FOOD_PCT: p[5], TRAMO_BRECHA_PTS: p[6],
                    META_TICKET_Q: p[7], META_CLIENTES_NUEVOS: p[8], META_LMX_DIA: p[9], META_RESENAS_SEM: p[10],
                    META_LECTURA_PCT: p[11], META_DIAS_CAJA: p[12] };
      var completa = head.map(function (h, j) { return j < 5 ? fila[j] : (extra.hasOwnProperty(h) ? extra[h] : ''); });
      var existe = -1;
      for (var i = 1; i < datos.length; i++) {
        if (Number(datos[i][0]) === p[0] && Number(datos[i][1]) === p[1]) { existe = i; break; }
      }
      var nombre = FIN_MESES[p[1] - 1] + ' ' + p[0];
      if (existe === -1) {
        hoja.appendRow(completa);
        datos.push(completa);
        rep.push('METAS: ' + nombre + ' agregado (restaurante Q' + p[2].toLocaleString('es-GT') + ' + eventos Q' + p[3].toLocaleString('es-GT') + ').');
      } else {
        var origen = String(datos[existe][4] || '').trim();
        if (origen && origen.toUpperCase().indexOf('PROVISIONAL') !== 0 && origen.indexOf(MED_ORIGEN_) !== 0) {
          rep.push('METAS: ' + nombre + ' NO se toco: ya tenia una meta escrita (' + origen + ', Q' + datos[existe][2] + ').');
        } else {
          rep.push('METAS: ' + nombre + ' actualizado (antes Q' + datos[existe][2] + ', origen "' + origen + '").');
          hoja.getRange(existe + 1, 1, 1, completa.length).setValues([completa]);
        }
      }
    });
    hoja.setColumnWidth(5, 380);

    // ---- PARAMETROS
    var hp = ss.getSheetByName('PARAMETROS');
    if (!hp) throw new Error('No existe la pestaña PARAMETROS.');
    var pv = hp.getDataRange().getValues();
    MED_PARAMETROS_.forEach(function (x) {
      var fila = -1;
      for (var i = 1; i < pv.length; i++) if (String(pv[i][0] || '').trim() === x.k) { fila = i; break; }
      if (fila === -1) {
        hp.appendRow([x.k, x.v]);
        pv.push([x.k, x.v]);
        rep.push('PARAMETROS: ' + x.k + ' = ' + x.v + ' (nueva).');
      } else if (x.viejo !== undefined && Number(pv[fila][1]) === x.viejo) {
        hp.getRange(fila + 1, 2).setValue(x.v);
        rep.push('PARAMETROS: ' + x.k + ' ' + x.viejo + ' -> ' + x.v + '.');
      } else if (Number(pv[fila][1]) !== x.v) {
        rep.push('PARAMETROS: ' + x.k + ' NO se toco: tiene ' + pv[fila][1] + ' (el plan dice ' + x.v + ').');
      }
    });
    SpreadsheetApp.flush();

    // las metas viven en caches: sin esto el tablero seguiria con las viejas hasta 10 min
    try {
      var c = CacheService.getScriptCache();
      c.removeAll(MED_PARAMETROS_.map(function (x) { return 'fin_par_v2_' + x.k; }));
    } catch (e) { /* el cache vence solo */ }

    // relee lo escrito: un "listo" sin releer es una afirmacion, no una verificacion
    var n = medMetasFilas_().filter(function (f) { return f.origen.indexOf(MED_ORIGEN_) === 0; }).length;
    rep.push('Verificado: ' + n + ' de ' + MED_PLAN_.length + ' meses de METAS con el origen del sistema.');
    return { ok: n === MED_PLAN_.length, reporte: rep };
  } finally {
    lock.releaseLock();
  }
}

/**
 * La franja "Tu semana" del panel principal. Cada rol ve SU numero:
 *   dueno  lo que deja la operacion, venta del mes, comensales, dias de caja, datos que fallan
 *   chef   food cost contra el tramo, brecha, inventario de cocina (solo %, sin quetzales)
 *   sala   ticket, lunes a miercoles, lectura de Wix, inventario de barra
 * Cualquier otro rol: null (la franja no aparece). No calcula: son campos de los motores.
 */
function getMiSemana(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  return medMiSemana_(u, normalizar_(u.rol), auth);
}

/** La franja de un rol. `rol` puede venir forzado: la pantalla de Sala la pide como 'sala'. */
function medMiSemana_(u, rol, auth) {
  if (rol !== 'dueno' && rol !== 'chef' && rol !== 'sala' && rol !== 'pauta') return null;
  var hoy = new Date();
  var d = _finDatos_(false);
  var P = tabParametros_();
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var mc = tabMesCerrado_(d, hoy);
  var cur = mc.en_curso || {};
  var out = { rol: rol, nombre: u.nombre || '', mes: M.mes, items: [] };
  function it(nombre, valor, texto, zona) { out.items.push({ nombre: nombre, valor: valor, texto: texto, zona: zona }); }

  if (rol === 'dueno') {
    var c = medCascadaResumen_(d, P, M, hoy);
    it('Lo que deja la operación', c.deja !== null ? medQ_(c.deja) : '—',
       'lo que falta del mes · piso Q' + Math.round(c.piso || 0).toLocaleString('es-GT') + ' en proporción', c.deja_zona);
    it('Venta del mes (proyección)', c.venta_proy ? 'Q' + Math.round(c.venta_proy).toLocaleString('es-GT') : '—',
       M.venta_total ? 'meta Q' + M.venta_total.toLocaleString('es-GT') : 'sin meta', c.venta_zona);
    it('Comensales (ritmo)', c.com_ritmo !== null ? String(c.com_ritmo) : '—',
       M.comensales ? 'meta ' + M.comensales : 'sin meta', c.com_zona);
    it('Días de caja', d.dias_caja, 'meta ≥' + M.dias_caja.valor, tabZona_(d.dias_caja, M.dias_caja.valor, 3, 'mayor'));
    it('Datos que fallan', c.higiene_malos + ' de 4', 'sin dato no hay semáforo', c.higiene_malos ? 'rojo' : 'verde');
    return out;
  }
  if (rol === 'pauta') {
    var cr = medComRitmo_(d, hoy, M);
    var k = null;
    try { k = mktKpisMes_(d.anio, d); } catch (e0) { k = null; }
    var Kc = k ? k.meses[hoy.getMonth() + 1] : null, Ku = (k && mc.ultimo) ? k.meses[mc.ultimo.m] : null;
    it('Clientes nuevos del mes', Kc && Kc.altas !== null ? String(Kc.altas) : '—', medMetaTxt_(M.clientes.valor, 'meta ') + ' · "Cliente que visitó"',
       Kc ? tabZona_(Kc.altas, M.clientes.valor, 30, 'mayor') : 'gris');
    it('CAC ' + (Ku ? Ku.mes : ''), Ku && Ku.publicable && Ku.cac !== null ? 'Q' + Math.round(Ku.cac) : 'no se publica',
       medMetaTxt_(P.cac_max_q.valor, 'máximo Q') + (Ku && Ku.lectura !== null ? ' · lectura ' + Ku.lectura + '%' : ''),
       Ku && Ku.publicable ? tabZona_(Ku.cac, P.cac_max_q.valor, P.cac_max_q.valor * 1.33, 'menor') : 'gris');
    var semCom = (d.ultima || {}).com;
    var metaSem = M.comensales ? Math.round(M.comensales / new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() * 7) : null;
    it('Comensales, última semana', semCom !== undefined ? String(semCom) : '—', metaSem ? 'meta ' + metaSem + ' por semana (POS)' : 'sin meta',
       metaSem ? tabZona_(semCom, metaSem, metaSem * 0.9, 'mayor') : 'gris');
    it('Comensales del mes (ritmo)', cr.com_ritmo !== null ? String(cr.com_ritmo) : '—', M.comensales ? 'meta ' + M.comensales : 'sin meta', cr.com_zona);
    return out;
  }
  var inv = invEstadoCierre_(hoy, P.inventario_cierre_dia.valor);
  if (rol === 'chef') {
    var ul = d.ultima || {};
    it('Food cost real (móvil 4)', medMetaTxt_(ul.cogs_m4, '', '%', '—'), medMetaTxt_(M.food.valor, 'tramo ≤', '%') + ' · meta ' + d.meta_cogs + '%',
       tabZona_(ul.cogs_m4, M.food.valor, M.food.valor + 3, 'menor'));
    var b = null;
    try { var rt = getCmvRealTeorico(auth); b = rt && rt.ok ? rt.bloque : null; } catch (e) { b = null; }
    it('Brecha real contra teórico', b ? (b.brecha_pts > 0 ? '+' : '') + b.brecha_pts + ' pts' : '—',
       medMetaTxt_(M.brecha.valor, 'tramo ≤', ' pts'), b ? tabZona_(b.brecha_pts, M.brecha.valor, M.brecha.valor + 2, 'menor') : 'gris');
    var rc = inv.areas.COCINA;
    it('Inventario de cocina', rc.ultimo_cerrado || 'ninguno', 'esperado ' + inv.esperado + ' antes del día ' + inv.dia_limite, rc.zona);
    try {
      var rm = medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1);
      it('Retiros de cajero con detalle', rm.n ? rm.con_detalle + ' de ' + rm.n : 'ninguno', 'anotar qué se compró · meta 100%',
         rm.n ? tabZona_(rm.pct, 100, 80, 'mayor') : 'verde');
    } catch (e1) { /* sin banco: la franja sigue */ }
    out.enlace = { texto: 'Anotar retiros', page: 'retiros' };
    return out;
  }
  // sala
  it('Ticket por comensal', cur.tp ? 'Q' + Math.round(cur.tp) : '—', 'meta Q' + M.ticket.valor + ' sin IVA',
     tabZona_(cur.tp, M.ticket.valor, M.ticket.valor * 0.94, 'mayor'));
  var lmx = cur.com_lmx_dia !== undefined && cur.com_lmx_dia !== null ? cur.com_lmx_dia : (mc.ultimo ? mc.ultimo.com_lmx_dia : null);
  it('Comensales L–X por día', lmx !== null ? String(lmx) : '—', 'meta ' + M.lmx.valor,
     tabZona_(lmx, M.lmx.valor, M.lmx.valor * 0.85, 'mayor'));
  var lect = null;
  try { var k = mktKpisMes_(d.anio, d); lect = k.meses[hoy.getMonth() + 1] ? k.meses[hoy.getMonth() + 1].lectura : null; } catch (e2) { lect = null; }
  it('Lectura de Wix', lect !== null ? lect + '%' : '—', medMetaTxt_(M.lectura.valor, 'meta ', '%') + ' · mesas cerradas',
     tabZona_(lect, M.lectura.valor, 50, 'mayor'));
  var rb = inv.areas.BARRA;
  it('Inventario de barra', rb.ultimo_cerrado || 'ninguno', 'esperado ' + inv.esperado, rb.zona);
  try {
    var rs = medResenas_(hoy);
    it('Reseñas de Google esta semana', String(rs.esta_semana), medMetaTxt_(M.resenas.valor, 'meta ') + ' · la semana pasada ' + rs.semana_pasada,
       tabZona_(rs.esta_semana, M.resenas.valor, Math.max(M.resenas.valor - 1, 1), 'mayor'));
  } catch (e3) { /* sin la hoja del bot: la franja sigue */ }
  out.enlace = { texto: 'Abrir Sala', page: 'sala' };
  return out;
}

/**
 * El resumen de la cascada que usan el tablero (pestaña Cascada) y la franja del dueño.
 * Solo junta campos de los motores y los compara contra las metas del mes.
 */
function medCascadaResumen_(d, P, M, hoy) {
  var mc = tabMesCerrado_(d, hoy);
  var cur = mc.en_curso || {};
  var r = { higiene: [], higiene_malos: 0 };

  // ---- N1 · lo que deja la operacion (Caja, escenario base, mes en curso en proporcion)
  try {
    var cj = _cajaDatos_(_cajaOpciones_({}));
    var mesCaja = (cj.meses || [])[0] || null;
    r.deja = mesCaja ? mesCaja.deja : null;
    r.piso = mesCaja ? mesCaja.piso : cj.piso_mes;
    r.objetivo = mesCaja ? mesCaja.objetivo : cj.objetivo_mes;
    r.piso_mes = cj.piso_mes; r.objetivo_mes = cj.objetivo_mes;
    r.deja_periodo = mesCaja ? mesCaja.mes + (mesCaja.completo ? '' : ' (parcial, en proporcion)') : '';
    r.falta_piso = mesCaja ? mesCaja.falta_piso : null;
    r.venta_piso_pct = mesCaja ? mesCaja.venta_piso_pct : null;
    r.deja_zona = mesCaja ? tabZona_(mesCaja.deja, mesCaja.objetivo, mesCaja.piso, 'mayor') : 'gris';
  } catch (e) { r.deja = null; r.deja_zona = 'gris'; r.caja_error = String(e && e.message || e); }

  // ---- N1 · venta del mes, restaurante + eventos, con su ritmo
  var ult = (d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '';
  var pt = ult.split('/');
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  var diaCorte = (pt.length === 3 && Number(pt[1]) === hoy.getMonth() + 1 && Number(pt[2]) === hoy.getFullYear()) ? Number(pt[0]) : 0;
  r.dia_corte = diaCorte; r.dias_mes = diasMes;
  r.venta_rest = cur.ventas || 0;
  r.venta_eventos = cur.eventos || 0;
  // Los cierres diarios de PosFile (CierresDiarios.gs) adelantan la venta de los dias que
  // la carga del lunes todavia no trae. Misma base que el motor: GRAN TOTAL (con el 10%
  // de servicio) / 1.12. El cierre no separa eventos: entran como restaurante.
  r.cierres_dias = 0; r.cierres_venta = 0; r.cierre_ultimo = null;
  try {
    var cies = cieTodos_(), mesTxt = hoy.getFullYear() + '-' + (hoy.getMonth() < 9 ? '0' : '') + (hoy.getMonth() + 1);
    var corteIso = diaCorte ? mesTxt + '-' + (diaCorte < 10 ? '0' : '') + diaCorte : mesTxt + '-00';
    Object.keys(cies).sort().forEach(function (f) {
      if (f.slice(0, 7) !== mesTxt) return;
      r.cierre_ultimo = f;
      if (f <= corteIso) return;
      r.cierres_venta += cies[f].gran_total / 1.12; r.cierres_dias++;
      diaCorte = Math.max(diaCorte, Number(f.slice(8, 10)));
    });
    r.venta_rest += r.cierres_venta;
    r.dia_corte = diaCorte;
  } catch (eC) { /* sin cierres: queda la carga del lunes */ }
  r.venta_acum = r.venta_rest + r.venta_eventos;
  // el restaurante se proyecta por dias; los eventos no (ya cerrados, no son ritmo)
  r.venta_proy = diaCorte ? Math.round(r.venta_rest / diaCorte * diasMes + r.venta_eventos) : null;
  r.venta_esperada = (M.venta_total && diaCorte) ? Math.round(M.venta_total * diaCorte / diasMes) : null;
  var minimo = M.minimo.valor;
  r.venta_zona = r.venta_proy === null || !M.venta_total ? 'gris'
    : tabZona_(r.venta_proy, M.venta_total, minimo || M.venta_total * 0.93, 'mayor');

  // ---- comensales del mes
  var cr = medComRitmo_(d, hoy, M);
  r.com_ritmo = cr.com_ritmo; r.com_zona = cr.com_zona;

  // ---- higiene de datos (N4)
  function h(nombre, zona, texto, duenio) {
    r.higiene.push({ nombre: nombre, zona: zona, texto: texto, dueno: duenio });
    if (zona === 'rojo' || zona === 'gris') r.higiene_malos++;
  }
  var lect = null;
  try { var k = mktKpisMes_(d.anio, d); var km = k.meses[hoy.getMonth() + 1] || (mc.ultimo ? k.meses[mc.ultimo.m] : null); lect = km ? km.lectura : null; }
  catch (e2) { lect = null; }
  h('Lectura de Wix', tabZona_(lect, M.lectura.valor, 50, 'mayor'),
    lect === null ? 'sin altas este mes' : lect + '% · ' + medMetaTxt_(M.lectura.valor, 'meta ', '%'), 'José');
  try {
    var inv = invEstadoCierre_(hoy, P.inventario_cierre_dia.valor);
    var zc = inv.areas.COCINA.zona, zb = inv.areas.BARRA.zona;
    var peor = (zc === 'rojo' || zb === 'rojo') ? 'rojo' : ((zc === 'amarillo' || zb === 'amarillo') ? 'amarillo' : (zc === 'verde' && zb === 'verde' ? 'verde' : 'gris'));
    h('Inventarios cerrados', peor, 'cocina ' + (inv.areas.COCINA.ultimo_cerrado || 'ninguno') + ' · barra ' + (inv.areas.BARRA.ultimo_cerrado || 'ninguno') + ' · esperado ' + inv.esperado, 'Jeffry · José');
  } catch (e3) { h('Inventarios cerrados', 'gris', String(e3 && e3.message || e3), 'Jeffry · José'); }
  var diasDesde = function (txt) {
    var p = String(txt || '').split('/');
    if (p.length !== 3) return null;
    return Math.floor((hoy - new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]))) / 86400000);
  };
  var dPos = diasDesde(ult), dBan = diasDesde(d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']);
  var zCarga = (dPos === null || dBan === null) ? 'gris'
    : ((dPos > 14 || dBan > 30) ? 'rojo' : ((dPos > 8 || dBan > 16) ? 'amarillo' : 'verde'));
  h('Carga al día', zCarga, 'POS al ' + (ult || '?') + ' · banco al ' + ((d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']) || '?'), 'Juanma');
  try {
    var rm = medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1);
    h('Retiros de cajero con detalle', rm.n ? tabZona_(rm.pct, 100, 80, 'mayor') : 'verde',
      rm.n ? rm.con_detalle + ' de ' + rm.n + ' (Q' + Math.round(rm.q - rm.q_con).toLocaleString('es-GT') + ' sin detalle)' : 'ningún retiro este mes', 'Jeffry');
  } catch (e4) { h('Retiros de cajero con detalle', 'gris', String(e4 && e4.message || e4), 'Jeffry'); }
  return r;
}

/**
 * Comensales del mes al ritmo: comensales estimados al dia del corte (venta ÷ ticket),
 * llevados al mes completo. Lo usan la Cascada, 05 Marketing y la franja del dueño.
 */
function medComRitmo_(d, hoy, M) {
  var mc = tabMesCerrado_(d, hoy), cur = mc.en_curso || {};
  var ult = (d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '';
  var pt = ult.split('/');
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  var diaCorte = (pt.length === 3 && Number(pt[1]) === hoy.getMonth() + 1 && Number(pt[2]) === hoy.getFullYear()) ? Number(pt[0]) : 0;
  var ritmo = (cur.com_est && diaCorte) ? Math.round(cur.com_est / diaCorte * diasMes) : null;
  return { com_ritmo: ritmo, dia_corte: diaCorte,
           com_zona: (ritmo !== null && M.comensales) ? tabZona_(ritmo, M.comensales, M.comensales * 0.9, 'mayor') : 'gris' };
}

// ============================================================================
// FUENTES QUE FALTABAN (27-sep-2026, segunda tanda)
// ============================================================================

/* Reseñas: la hoja del bot de Google (proyecto panel-de-reseas-de-google), pestaña
   "Reseñas". Una fila por reseña que el bot detecta. La primera corrida (7-jul-2026)
   cargo de golpe todas las reseñas viejas: ese dia no cuenta como reseñas nuevas. */
var MED_RESENAS_ID_ = '17VHTRhelYtEKXjkf4dckPRrAwjif8owu22OLMxBl9bo';   // Rosanta - Control de Reseñas GBP

/** Reseñas nuevas por semana ISO (clave AAAAWW) con su promedio de estrellas. */
function medResenas_(hoy) {
  hoy = hoy || new Date();
  var sh = SpreadsheetApp.openById(MED_RESENAS_ID_).getSheetByName('Reseñas');
  if (!sh) throw new Error('No existe la pestaña Reseñas en la hoja del bot de Google.');
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h || '').trim(); });
  var iF = head.indexOf('Fecha detectada'), iE = head.indexOf('Estrellas');
  if (iF < 0) throw new Error('La pestaña Reseñas no tiene la columna "Fecha detectada".');
  var filas = [];
  for (var i = 1; i < v.length; i++) {
    var f = v[i][iF] instanceof Date ? v[i][iF] : new Date(v[i][iF]);
    if (isNaN(f)) continue;
    filas.push({ f: f, e: Number(v[i][iE]) || 0 });
  }
  if (!filas.length) return { semanas: {}, primera: null };
  var primera = filas.reduce(function (a, x) { return x.f < a ? x.f : a; }, filas[0].f);
  var diaCarga = _finDDMM_(primera) + '/' + primera.getFullYear();
  var semanas = {};
  filas.forEach(function (x) {
    if (_finDDMM_(x.f) + '/' + x.f.getFullYear() === diaCarga) return;      // la carga inicial
    var k = _finClaveSemana_(x.f);
    if (!semanas[k]) semanas[k] = { n: 0, suma: 0 };
    semanas[k].n++; semanas[k].suma += x.e;
  });
  var kHoy = _finClaveSemana_(hoy);
  var kAnt = _finClaveSemana_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7));
  var ult4 = [];
  for (var w = 1; w <= 4; w++) ult4.push(_finClaveSemana_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7 * w)));
  var n4 = 0, s4 = 0;
  ult4.forEach(function (k) { if (semanas[k]) { n4 += semanas[k].n; s4 += semanas[k].suma; } });
  return { semanas: semanas, carga_inicial: diaCarga,
           esta_semana: semanas[kHoy] ? semanas[kHoy].n : 0,
           semana_pasada: semanas[kAnt] ? semanas[kAnt].n : 0,
           prom_4: Math.round(n4 / 4 * 10) / 10,
           estrellas_4: n4 ? Math.round(s4 / n4 * 10) / 10 : null };
}

/* Repeticion: pauta_semanal ya trae, por semana, clientes_nuevos y repetidos (los
   escribe ClientesNuevos.js del Marketing OS cada lunes: una reserva es "repetida" si
   su email o telefono ya estaba en la CRM o en una semana anterior). El mes se asigna
   por fecha_registro, igual que el ROAS de mktKpisMes_. */
function medRepeticion_(anio) {
  var v = mktSheet_('pauta_semanal').getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h || '').trim(); });
  var iF = head.indexOf('fecha_registro'), iN = head.indexOf('clientes_nuevos'), iR = head.indexOf('repetidos');
  if (iF < 0 || iN < 0 || iR < 0) throw new Error('pauta_semanal no tiene fecha_registro, clientes_nuevos o repetidos.');
  var out = {};
  for (var i = 1; i < v.length; i++) {
    var raw = v[i][iF];
    var f = raw instanceof Date ? raw : (/^\d{4}-\d{2}-\d{2}/.test(String(raw || '')) ? new Date(String(raw).slice(0, 10) + 'T12:00:00') : null);
    if (!f || isNaN(f.getTime()) || f.getFullYear() !== anio) continue;
    if (v[i][iN] === '' || v[i][iR] === '') continue;                 // semana sin calcular
    var m = f.getMonth() + 1;
    if (!out[m]) out[m] = { nuevos: 0, repetidos: 0, semanas: 0 };
    out[m].nuevos += Number(v[i][iN]) || 0;
    out[m].repetidos += Number(v[i][iR]) || 0;
    out[m].semanas++;
  }
  Object.keys(out).forEach(function (m) {
    var x = out[m], base = x.nuevos + x.repetidos;
    x.pct = base ? Math.round(x.repetidos / base * 1000) / 10 : null;
  });
  return out;
}

/* Retiros de cajero: el banco los trae como "ATM ... AGENCIA ..." en ALIMENTOS_EFECTIVO,
   sin decir que se compro (agosto: Q21,800 en 18 retiros). El detalle lo anota quien
   compro, en la pestaña RETIROS_DETALLE de Rosanta_Intranet_Config, desde la intranet.
   Un retiro "tiene detalle" si hay una fila con la misma fecha y el mismo monto. */
var MED_RETIROS_HOJA_ = 'RETIROS_DETALLE';
var MED_RETIROS_COLS_ = ['FECHA', 'MONTO', 'DETALLE', 'AREA', 'ESCRITO_POR', 'REGISTRADO'];

function medFechaIso_(d) {
  return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}

/** Los retiros de cajero de un mes, con su detalle si ya se anoto. */
function medRetirosMes_(anio, m) {
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var lista = [];
  [['03_Banco_Industrial', 'BI'], ['04_Banco_BAC', 'BAC']].forEach(function (b) {
    var sh = ss.getSheetByName(b[0]);
    if (!sh) return;
    var v = sh.getDataRange().getValues();
    var hi = -1;
    for (var i = 0; i < Math.min(v.length, 10); i++) if (v[i].map(String).indexOf('Categoría') >= 0) { hi = i; break; }
    if (hi < 0) return;
    var H = v[hi].map(function (h) { return String(h || '').trim(); });
    var iF = H.indexOf('Fecha'), iD = H.indexOf('Descripción'), iDe = H.indexOf('Débito'), iC = H.indexOf('Categoría');
    for (var r = hi + 1; r < v.length; r++) {
      if (String(v[r][iC] || '').trim() !== 'ALIMENTOS_EFECTIVO') continue;
      var desc = String(v[r][iD] || '').trim();
      // Solo retiros de cajero. El banco los escribe de varias formas: "ATM 095 AGENCIA",
      // "ATM095AGENCIA..." (agosto, sin espacio), "RETIRO ...", "A-PASEO", "F-TORRE". Lo que
      // ya dice que se compro ("S31Mercado", "LA BODEGONA") no es un retiro sin detalle.
      if (!/^(ATM|RETIRO|A-|F-)/i.test(desc)) continue;
      var f = _finDia_(v[r][iF]);
      if (!_finEsFecha_(f) || f.getFullYear() !== anio || f.getMonth() + 1 !== m) continue;
      lista.push({ fecha: medFechaIso_(f), monto: _finR_(_finNum_(v[r][iDe])), desc: desc, banco: b[1] });
    }
  });
  var det = [];
  try {
    var hd = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_RETIROS_HOJA_);
    if (hd && hd.getLastRow() > 1) {
      det = hd.getDataRange().getValues().slice(1).map(function (x) {
        var f = x[0] instanceof Date ? medFechaIso_(x[0]) : String(x[0] || '').slice(0, 10);
        return { fecha: f, monto: _finR_(_finNum_(x[1])), detalle: String(x[2] || ''), area: String(x[3] || ''), usado: false };
      });
    }
  } catch (e) { det = []; }
  lista.forEach(function (x) {
    for (var i = 0; i < det.length; i++) {
      if (!det[i].usado && det[i].fecha === x.fecha && Math.abs(det[i].monto - x.monto) < 0.01) {
        x.detalle = det[i].detalle; x.area = det[i].area; det[i].usado = true; break;
      }
    }
  });
  lista.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var con = lista.filter(function (x) { return x.detalle; });
  var q = function (arr) { return _finR_(arr.reduce(function (a, x) { return a + x.monto; }, 0)); };
  return { anio: anio, m: m, mes: FIN_MESES[m - 1], lista: lista, n: lista.length, con_detalle: con.length,
           q: q(lista), q_con: q(con), pct: lista.length ? Math.round(con.length / lista.length * 1000) / 10 : null };
}

function medPuedeRetiros_(u) {
  var r = normalizar_(u && u.rol);
  if (r !== 'dueno' && r !== 'chef') throw new Error('Anotar retiros lo hace cocina (chef) o el dueño.');
}

/** La pantalla de retiros: este mes y el anterior. */
function getRetirosPendientes(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  medPuedeRetiros_(u);
  var hoy = new Date();
  var ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return { actual: medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1),
           anterior: medRetirosMes_(ant.getFullYear(), ant.getMonth() + 1) };
}

/** Anota que se compro con un retiro de cajero. Devuelve la lista actualizada. */
function registrarRetiro(auth, fecha, monto, detalle, area) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  medPuedeRetiros_(u);
  fecha = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha invalida: ' + fecha);
  monto = Number(monto);
  if (!(monto > 0)) throw new Error('Monto invalido.');
  detalle = String(detalle || '').trim();
  if (detalle.length < 3) throw new Error('Escribi que se compro (al menos una palabra).');
  area = String(area || '').toUpperCase() === 'BARRA' ? 'BARRA' : 'COCINA';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var sh = ss.getSheetByName(MED_RETIROS_HOJA_);
    if (!sh) {
      sh = ss.insertSheet(MED_RETIROS_HOJA_);
      sh.getRange(1, 1, 1, MED_RETIROS_COLS_.length).setValues([MED_RETIROS_COLS_]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow([fecha, monto, detalle.slice(0, 300), area, u.nombre || u.email || '', new Date()]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  var p = fecha.split('-');
  var r = medRetirosMes_(Number(p[0]), Number(p[1]));
  var ok = r.lista.some(function (x) { return x.fecha === fecha && Math.abs(x.monto - monto) < 0.01 && x.detalle; });
  return { ok: ok, mes: r,
           aviso: ok ? '' : 'Quedo anotado, pero no hay un retiro de cajero de Q' + monto + ' el ' + fecha + ' en el banco cargado. Revisa la fecha y el monto.' };
}

/* ---- Sala (José) ---- */

/** Mesas de los ultimos 7 dias que faltan cerrar en Wix. Misma regla que el correo de los lunes. */
function medMesasPorCerrar_(hoy) {
  hoy = hoy || new Date();
  var v = mktSheet_('reservas').getDataRange().getValues();
  var H = v[0].map(function (h) { return String(h || '').trim(); });
  var iId = H.indexOf('id'), iF = H.indexOf('fecha'), iN = H.indexOf('nombre'), iE = H.indexOf('email'),
      iP = H.indexOf('personas'), iG = H.indexOf('gasto'), iS = H.indexOf('estado');
  var hasta = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
  var desde = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7));
  var falta = [], sinCerrar = [];
  for (var i = 1; i < v.length; i++) {
    var raw = v[i][iF];
    var f = raw instanceof Date ? medFechaIso_(raw) : String(raw || '').slice(0, 10);
    if (!f || f < desde || f > hasta) continue;
    var txt = (String(v[i][iN] || '') + ' ' + String(v[i][iE] || '')).toLowerCase();
    if (/(^|[\s@._-])(prueba|test)([\s@._-]|$)/.test(txt)) continue;
    var est = String(v[i][iS] || '').replace(/\\/g, '').trim().toUpperCase();
    var it = { id: String(v[i][iId] || ''), fecha: f, nombre: String(v[i][iN] || '').trim(), personas: Number(v[i][iP]) || 0, estado: est };
    if ((est === 'SEATED' || est === 'FINISHED') && !(Number(v[i][iG]) > 0)) falta.push(it);
    else if (est === 'RESERVED') sinCerrar.push(it);
  }
  var ord = function (a, b) { return a.fecha < b.fecha ? -1 : 1; };
  return { desde: desde, hasta: hasta, falta_consumo: falta.sort(ord), sin_cerrar: sinCerrar.sort(ord),
           wix: 'https://manage.wix.com/dashboard/47968b83-c2c2-4b11-8f94-ef2c7488debc/wix-table-reservations/table-reservations?viewId=all&reservationId=' };
}

/** La pantalla de Sala: el numero de José, sus palancas y lo que tiene que hacer hoy. */
function getSala(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  if (rol !== 'sala' && rol !== 'dueno') throw new Error('Sala es para el rol sala y el dueño.');
  var hoy = new Date();
  var out = { gen: Utilities.formatDate(hoy, 'America/Guatemala', 'dd/MM/yyyy HH:mm'), avisos: [] };
  try { out.semana = medMiSemana_(u, 'sala', auth); } catch (e) { out.avisos.push('Números: ' + String(e && e.message || e)); }
  try { out.mesas = medMesasPorCerrar_(hoy); } catch (e2) { out.avisos.push('Reservas: ' + String(e2 && e2.message || e2)); }
  try { out.resenas = medResenas_(hoy); delete out.resenas.semanas; } catch (e3) { out.avisos.push('Reseñas: ' + String(e3 && e3.message || e3)); }
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, tabParametros_());
  out.meta_resenas = M.resenas.valor;
  // el huddle: lo de ayer, del POS
  try {
    var d = _finDatos_(false);
    var ult = (d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '';
    out.pos_al = ult;
    var ul = d.ultima || {};
    out.semana_pos = { w: ul.w, ini: ul.ini, fin: ul.fin, com: ul.com, tp: ul.tp, ventas: ul.ventas };
  } catch (e4) { out.avisos.push('POS: ' + String(e4 && e4.message || e4)); }
  return out;
}

// ============================================================================
// LECTURA DE CADA PILAR, CON EL MOLDE DEL REPORTE SEMANAL (27-sep-2026)
// ============================================================================
/*
 * Juanma: "la unica pestaña que esta clara es la del reporte semanal". El reporte se lee
 * de arriba abajo, pregunta por pregunta, y termina en acciones. Las pestañas de pilar
 * eran una rejilla de tarjetas con codigos. Cada pilar se lee ahora en cinco pasos:
 *   1 la pregunta y su numero · 2 la ruta · 3 que lo mueve · 4 con que no contamos ·
 *   5 que hacemos esta semana.
 * Lo arma el SERVIDOR, una vez, con los mismos campos de las tarjetas (no calcula nada
 * nuevo), y lo pintan igual el tablero y cada modulo (LecturaJs.html). Las tarjetas de
 * siempre quedan debajo, plegadas en "Como se calcula".
 */

var MED_ACC_HOJA_ = 'ACCIONES';
var MED_ACC_COLS_ = ['SEMANA', 'PILAR', 'ACCION', 'DUENO', 'FECHA_LIMITE', 'ESTADO', 'ESCRITO_POR', 'CREADA', 'CERRADA'];
var MED_PILAR_NOMBRE_ = { fundamentos: 'Meta del negocio', management: 'Sala', finanzas: 'Finanzas',
                          profit: 'Profit OS', marketing: 'Marketing', expansion: 'Expansión' };
var MED_EQUIPO_ = ['Juanma', 'José', 'Jeffry', 'Vanessa', 'Efraín', 'Nadia'];

function medQ_(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : (n < 0 ? '−' : '') + 'Q' + Math.round(Math.abs(n)).toLocaleString('es-GT'); }
function medKpi_(out, clave) { var r = null; (out.kpis || []).forEach(function (k) { if (k.clave === clave) r = k; }); return r; }
function medSemanaClave_(d) { var k = _finClaveSemana_(d); return Math.floor(k / 100) + '-S' + (k % 100 < 10 ? '0' : '') + (k % 100); }

/** Las ultimas n semanas de un campo de semanas[] del motor. */
function medSerie_(d, campo, n, fn) {
  var S = (d.semanas || []).filter(function (s) { return !s.corta; }).slice(-(n || 8));
  return S.map(function (s) { return { et: 'S' + s.w, v: fn ? fn(s) : s[campo] }; });
}

/** Las acciones de un pilar: las de esta semana y las viejas que siguen pendientes. */
function medAcciones_(pilar) {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), sem = medSemanaClave_(new Date()), out = [];
  for (var i = 1; i < v.length; i++) {
    if (pilar && String(v[i][1]) !== pilar) continue;
    var estado = String(v[i][5] || 'pendiente');
    if (String(v[i][0]) !== sem && estado !== 'pendiente') continue;
    var fl = v[i][4] instanceof Date ? medFechaIso_(v[i][4]) : String(v[i][4] || '').slice(0, 10);
    out.push({ fila: i + 1, semana: String(v[i][0]), pilar: String(v[i][1]), accion: String(v[i][2]), dueno: String(v[i][3]), escrito_por: String(v[i][6] || ''),
               fecha: fl, estado: estado, atrasada: estado === 'pendiente' && fl && fl < medFechaIso_(new Date()) });
  }
  return out;
}

/** Anota una accion de la reunion del lunes. Solo el dueño. */
function guardarAccion(auth, pilar, accion, dueno, fecha) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  if (!MED_PILAR_NOMBRE_[pilar]) throw new Error('Pilar desconocido: ' + pilar);
  accion = String(accion || '').trim();
  if (accion.length < 5) throw new Error('Escribi la accion: una conducta concreta.');
  if (MED_EQUIPO_.indexOf(dueno) === -1) throw new Error('El dueño tiene que ser una persona del equipo.');
  fecha = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Falta la fecha limite.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var sh = ss.getSheetByName(MED_ACC_HOJA_);
    if (!sh) {
      sh = ss.insertSheet(MED_ACC_HOJA_);
      sh.getRange(1, 1, 1, MED_ACC_COLS_.length).setValues([MED_ACC_COLS_]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow([medSemanaClave_(new Date()), pilar, accion.slice(0, 300), dueno, fecha, 'pendiente', u.nombre || u.email || '', new Date(), '']);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return medAcciones_(pilar);
}

/** Marca una accion como hecha o descartada. Solo el dueño. */
function marcarAccion(auth, fila, estado, textoEsperado) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  if (['hecha', 'descartada', 'pendiente'].indexOf(estado) === -1) throw new Error('Estado invalido.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var pilar = '';
  try {
    var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
    if (!sh) throw new Error('No hay acciones.');
    var fila_ = sh.getRange(Number(fila), 1, 1, MED_ACC_COLS_.length).getValues()[0];
    // la fila se verifica por su texto: si alguien inserto una fila en medio, no se marca otra accion
    if (String(fila_[2]) !== String(textoEsperado)) throw new Error('La accion cambio de lugar en la hoja: recarga el tablero.');
    pilar = String(fila_[1]);
    sh.getRange(Number(fila), 6).setValue(estado);
    sh.getRange(Number(fila), 9).setValue(estado === 'pendiente' ? '' : new Date());
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return medAcciones_(pilar);
}

/**
 * La lectura de un pilar desde un MODULO (no el tablero): Finanzas, Profit OS, Marketing
 * y Sala muestran arriba el mismo bloque que el tablero. Quien la pide:
 *   dueno  cualquier pilar
 *   chef   profit (sin quetzales, regla del 15-sep)
 *   sala   management y profit (la barra es de José; sin quetzales)
 *   pauta  marketing
 *   modulo finanzas  finanzas
 */
function getLecturaPilar(auth, pilar) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  var ok = rol === 'dueno' ||
           (pilar === 'profit' && (rol === 'chef' || rol === 'sala')) ||   // barra es de José
           (pilar === 'management' && rol === 'sala') ||
           (pilar === 'marketing' && rol === 'pauta') ||
           (pilar === 'finanzas' && usuarioTieneModulo(u, 'finanzas'));
  if (!ok) throw new Error('Este bloque no es de tu area.');
  var P = tabParametros_(), hoy = new Date();
  var out = { pilar: pilar, kpis: [], avisos: [], parametros: P };
  var conQ = rol === 'dueno';
  if (pilar === 'fundamentos') _tabFundamentos_(out, P, hoy, auth);
  else if (pilar === 'management') _tabManagement_(out, P, hoy);
  else if (pilar === 'finanzas') _tabFinanzas_(out, P, hoy, auth);
  else if (pilar === 'profit') _tabProfit_(out, P, hoy, auth, conQ);
  else if (pilar === 'marketing') _tabMarketing_(out, P, hoy);
  else if (pilar === 'expansion') _tabExpansion_(out, P, hoy);
  else throw new Error('Pilar desconocido: ' + pilar);
  var L = out.lectura || null;
  if (L) {
    try { L.acciones = medAcciones_(pilar); } catch (e) { L.acciones = []; }
    L.puede_escribir = false;          // en los modulos las acciones se leen; se escriben en el tablero
  }
  return { lectura: L, avisos: out.avisos, gen: Utilities.formatDate(hoy, 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
}

/* ---- los constructores: uno por pilar. Reciben lo que ya calculo su _tab*_. ---- */

function medZonaTexto_(z, si, casi, no) { return z === 'verde' ? si : (z === 'amarillo' ? casi : (z === 'rojo' ? no : 'Sin dato suficiente para responder.')); }
function medPal_(nombre, dueno, k, hoyTxt, metaTxt, nota) {
  return { nombre: nombre, dueno: dueno, hoy: hoyTxt, meta: metaTxt, zona: k ? k.zona : 'gris', nota: nota || '' };
}

function medLecturaFundamentos_(out, d, M, c, hoy) {
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  var metaSem = M.venta_total ? Math.round(M.venta_total / diasMes * 7) : null;
  var L = { pilar: 'fundamentos', titulo: 'Meta del negocio', dueno: 'Juanma',
    pregunta: '¿La operación deja lo que necesitamos este mes?',
    zona: c.venta_zona,
    respuesta: medZonaTexto_(c.venta_zona,
      'Vamos en meta: la venta de ' + M.mes + ' proyecta ' + medQ_(c.venta_proy) + ' contra ' + medQ_(M.venta_total) + '.',
      'Vamos cerca: la venta de ' + M.mes + ' proyecta ' + medQ_(c.venta_proy) + ' y la meta es ' + medQ_(M.venta_total) + '.',
      'No: la venta de ' + M.mes + ' proyecta ' + medQ_(c.venta_proy) + ' y la meta es ' + medQ_(M.venta_total) + '.'),
    numero: { valor: medQ_(c.venta_proy), etiqueta: 'venta de ' + M.mes + ' al ritmo actual', meta: M.venta_total ? 'meta ' + medQ_(M.venta_total) : 'sin meta', zona: c.venta_zona },
    extras: [{ valor: medQ_(c.deja), etiqueta: 'lo que deja la operación (resto del mes) · piso ' + medQ_(c.piso), zona: c.deja_zona }],
    serie: { titulo: 'Venta por semana, contra la meta semanal', unidad: 'Q', sentido: 'mayor', meta: metaSem,
             puntos: medSerie_(d, 'ventas', 8) },
    palancas: (out.pilares || []).map(function (k) {
      var fmt = k.unidad === 'Q' ? medQ_(k.valor) : (k.unidad === '%' ? k.valor + '%' : k.valor);
      return { nombre: k.nombre, dueno: String(k.clave).split('·')[1] ? String(k.clave).split('·')[1].trim() : '', hoy: fmt,
               meta: String(k.meta_texto || '').replace(/^meta (del mes )?/, ''), zona: k.zona, nota: '' };
    }),
    faltantes: (c.higiene || []).filter(function (h) { return h.zona !== 'verde'; }).map(function (h) { return { texto: h.nombre + ': ' + h.texto + ' (' + h.dueno + ')', zona: h.zona }; }),
    como: 'Venta = comensales × ticket + eventos. Lo que deja sale de la pestaña Caja (escenario base, mes en curso en proporción). Metas: pestaña METAS.'
  };
  return L;
}

function medLecturaManagement_(out, d, M, hoy) {
  var tk = medKpi_(out, 'K14a'), lmx = medKpi_(out, 'K14b'), lec = medKpi_(out, 'K20'), res = medKpi_(out, 'K18'), vl = medKpi_(out, 'K21');
  var mesas = null;
  try { mesas = medMesasPorCerrar_(hoy); } catch (e) { mesas = null; }
  var nMesas = mesas ? mesas.falta_consumo.length + mesas.sin_cerrar.length : null;
  var falt = [];
  if (nMesas) falt.push({ texto: nMesas + ' mesas de los últimos 7 días sin cerrar en Wix: sin eso Marketing no puede medir el CAC.', zona: 'rojo' });
  if (lec && lec.zona !== 'verde') falt.push({ texto: 'Lectura de Wix del mes: ' + (lec.valor === null ? 'sin dato' : lec.valor + '%') + ' (' + medMetaTxt_(M.lectura.valor, 'meta ', '%') + ').', zona: lec.zona });
  if (!res || res.estado !== 'ok') falt.push({ texto: 'No se pudo leer la hoja del bot de reseñas.', zona: 'gris' });
  return { pilar: 'management', titulo: 'Sala', dueno: 'José',
    pregunta: '¿Vendemos suficiente por persona?',
    zona: tk ? tk.zona : 'gris',
    respuesta: medZonaTexto_(tk && tk.zona, 'Sí. El ticket está en ' + medQ_(tk && tk.valor) + ' sin IVA; la meta del mes es Q' + M.ticket.valor + '.',
      'Casi. El ticket está en ' + medQ_(tk && tk.valor) + ' y la meta es Q' + M.ticket.valor + '.',
      'No. El ticket está en ' + medQ_(tk && tk.valor) + ' y la meta es Q' + M.ticket.valor + '.'),
    numero: { valor: medQ_(tk && tk.valor), etiqueta: 'ticket por comensal, sin IVA · ' + M.mes, meta: 'meta Q' + M.ticket.valor, zona: tk ? tk.zona : 'gris' },
    extras: [],
    serie: { titulo: 'Ticket por semana, contra la meta', unidad: 'Q', sentido: 'mayor', meta: M.ticket.valor, puntos: medSerie_(d, 'tp', 8) },
    palancas: [
      medPal_('Mesas cerradas en Wix (lectura)', 'José', lec, lec && lec.valor !== null ? lec.valor + '%' : '—', medMetaTxt_(M.lectura.valor, '', '%'), 'Seated al sentar; el consumo al terminar.'),
      medPal_('Comensales por día, lunes a miércoles', 'José', lmx, lmx && lmx.valor !== null ? String(lmx.valor) : '—', medMetaTxt_(M.lmx.valor), 'Ocupación entre semana, sin descuentos de precio.'),
      medPal_('Reseñas nuevas en Google (semana pasada)', 'Meseros', res, res && res.valor !== null ? String(res.valor) : '—', medMetaTxt_(M.resenas.valor, '', ' por semana'), 'Pedirlas en el huddle.'),
      medPal_('Venta de lunes a miércoles', 'José', vl, medQ_(vl && vl.valor), 'se mide en octubre', '')
    ],
    faltantes: falt,
    como: 'Ticket = venta sin IVA de los tickets con comensales ÷ comensales. Lectura = "Cliente que visitó" ÷ (visitó + histórica) en el CRM. Reseñas: hoja del bot de Google, sin la carga inicial del 7-jul.'
  };
}

function medLecturaFinanzas_(out, d, M, hoy) {
  var k4 = medKpi_(out, 'K04'), k6 = medKpi_(out, 'K06'), k9 = medKpi_(out, 'K09'), k7 = medKpi_(out, 'K07'), k10 = medKpi_(out, 'K10'), k5 = medKpi_(out, 'K05');
  var banco = (d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']) || '';
  var gd = d.gasto_dia || 0;
  var pct9 = k9 && k9.detalle ? k9.detalle.pct_compra : null;
  return { pilar: 'finanzas', titulo: 'Finanzas', dueno: 'Juanma',
    pregunta: '¿Tenemos caja para aguantar el mes?',
    zona: k4 ? k4.zona : 'gris',
    respuesta: medZonaTexto_(k4 && k4.zona, 'Sí: ' + d.dias_caja + ' días de caja, la meta del mes es ' + M.dias_caja.valor + '.',
      'Justo: ' + d.dias_caja + ' días de caja contra una meta de ' + M.dias_caja.valor + '. Un mes flojo nos deja sin colchón.',
      'No: ' + d.dias_caja + ' días de caja contra una meta de ' + M.dias_caja.valor + '.'),
    numero: { valor: d.dias_caja + ' días', etiqueta: 'días de caja · banco al ' + banco, meta: 'meta ≥' + M.dias_caja.valor + ' · 21 antes del 15-mar', zona: k4 ? k4.zona : 'gris' },
    extras: k5 ? [{ valor: medQ_(k5.valor), etiqueta: 'venta del mes a la fecha (restaurante)', zona: k5.zona }] : [],
    serie: { titulo: 'Días de caja por semana', unidad: 'días', sentido: 'mayor', meta: M.dias_caja.valor,
             puntos: medSerie_(d, 'caja', 8, function (s) { return gd ? Math.round(s.caja / gd * 10) / 10 : null; }) },
    palancas: [
      medPal_('Prime cost (móvil 4)', 'Juanma', k6, k6 ? k6.valor + '%' : '—', 'verde bajo 60%', ''),
      medPal_('Compra sin factura', 'Juanma', k9, pct9 !== null ? pct9 + '% de la compra' : '—', '≤45% oct · ≤30% ene', 'El IVA de esa compra no se recupera.'),
      medPal_('Resultado del último mes', 'Juanma', k7, k7 ? medQ_(k7.valor) : '—', 'desde cero', k7 ? k7.periodo : ''),
      medPal_('EBITDA del último mes', 'Juanma', k10, k10 ? medQ_(k10.valor) : '—', '10% de la venta', '')
    ],
    faltantes: [{ texto: 'El banco está cargado al ' + banco + '. Los días de caja valen a esa fecha.', zona: 'amarillo' }].concat(
      (medKpi_(out, 'K08') ? [{ texto: 'Comisión de tarjeta: falta la venta bruta con tarjeta.', zona: 'gris' }] : [])),
    como: 'Días de caja = saldo de bancos ÷ gasto por día. Prime = (compra + mano de obra) ÷ venta, móvil de 4 semanas. Compra sin factura = categorías _EFECTIVO del banco.'
  };
}

function medLecturaProfit_(out, d, M, hoy, conQ) {
  var k11 = medKpi_(out, 'K11'), k12 = medKpi_(out, 'K12'), c3 = medKpi_(out, 'K03a'), b3 = medKpi_(out, 'K03b'), k22 = medKpi_(out, 'K22');
  var tramo = M.food.valor || d.meta_cogs, u = d.ultima || {};
  var rm = null;
  try { rm = medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1); } catch (e) { rm = null; }
  var falt = [];
  if (c3 && c3.zona !== 'verde') falt.push({ texto: 'Inventario de cocina: último cerrado ' + c3.valor + '. Sin el cierre, la brecha real no se puede ajustar.', zona: c3.zona });
  if (b3 && b3.zona !== 'verde') falt.push({ texto: 'Inventario de barra: último cerrado ' + b3.valor + '.', zona: b3.zona });
  if (rm && rm.n && rm.con_detalle < rm.n) falt.push({ texto: (rm.n - rm.con_detalle) + ' retiros de cajero sin detalle este mes' + (conQ ? ' (' + medQ_(rm.q - rm.q_con) + ')' : '') + ': anotar qué se compró en Profit OS › Cocina › Compras en efectivo.', zona: 'rojo' });
  // Profit es cocina Y barra (Juanma, 27-sep-2026): el numero es el food cost de las dos
  // juntas y debajo va cada area de la semana, del mismo calculo que el reporte semanal.
  var fc = null;
  try { fc = _repDatos_(0, false).foodcost; } catch (e2) { fc = null; }
  function zonaArea(x) { return !x || x.real_pct === null || x.real_pct === undefined ? 'gris' : (x.real_pct <= x.meta ? 'verde' : (x.real_pct <= x.meta + 3 ? 'amarillo' : 'rojo')); }
  var extras = fc ? [
    { valor: fc.cocina.real_pct === null ? '—' : fc.cocina.real_pct + '%', etiqueta: 'cocina esta semana · meta ' + fc.cocina.meta + '% · Jeffry', zona: zonaArea(fc.cocina) },
    { valor: fc.barra.real_pct === null ? '—' : fc.barra.real_pct + '%', etiqueta: 'barra esta semana · meta ' + fc.barra.meta + '% · José', zona: zonaArea(fc.barra) }
  ] : [];
  return { pilar: 'profit', titulo: 'Profit OS', dueno: 'Jeffry (cocina) · José (barra)',
    pregunta: '¿Se nos va la plata en la mercadería, cocina y barra?',
    zona: k11 ? k11.zona : 'gris',
    respuesta: medZonaTexto_(k11 && k11.zona, 'No. El food cost está en ' + u.cogs_m4 + '%, dentro del tramo del mes (≤' + tramo + '%).',
      'Un poco. El food cost está en ' + u.cogs_m4 + '% y el tramo del mes es ≤' + tramo + '%.',
      'Sí. El food cost está en ' + u.cogs_m4 + '% y el tramo del mes es ≤' + tramo + '%. La meta final es ' + d.meta_cogs + '%.'),
    numero: { valor: medMetaTxt_(u.cogs_m4, '', '%', '—'), etiqueta: 'food cost de cocina y barra juntas, móvil de 4 semanas · S' + u.w, meta: 'tramo ≤' + tramo + '% · meta ' + d.meta_cogs + '%', zona: k11 ? k11.zona : 'gris' },
    extras: extras,
    serie: { titulo: 'Food cost por semana (móvil 4), contra el tramo', unidad: '%', sentido: 'menor', meta: tramo, puntos: medSerie_(d, 'cogs_m4', 8) },
    palancas: [
      medPal_('Food cost de cocina, semana', 'Jeffry', fc ? { zona: zonaArea(fc.cocina) } : null, fc && fc.cocina.real_pct !== null ? fc.cocina.real_pct + '%' : '—', fc ? '≤' + fc.cocina.meta + '%' : '—', 'Detalle en la pestaña Cocina.'),
      medPal_('Food cost de barra, semana', 'José', fc ? { zona: zonaArea(fc.barra) } : null, fc && fc.barra.real_pct !== null ? fc.barra.real_pct + '%' : '—', fc ? '≤' + fc.barra.meta + '%' : '—', 'Detalle en la pestaña Barra y Sala.'),
      medPal_('Brecha real contra teórico', 'Jeffry', k12, k12 && k12.valor !== null ? (k12.valor > 0 ? '+' : '') + k12.valor + ' pts' : '—', '≤' + (M.brecha.valor || 2) + ' pts', 'Recepción, almacén y porciones.'),
      medPal_('Retiros de cajero con detalle', 'Jeffry', k22, rm ? rm.con_detalle + ' de ' + rm.n : '—', '100%', ''),
      medPal_('Inventario de cocina cerrado', 'Jeffry', c3, c3 ? String(c3.valor) : '—', 'antes del día 5', ''),
      medPal_('Inventario de barra cerrado', 'José', b3, b3 ? String(b3.valor) : '—', 'antes del día 5', '')
    ],
    faltantes: falt,
    como: 'Food cost = compra (FEL neto + sin factura + tarjeta) ÷ venta sin IVA ni servicio, móvil de 4 semanas. Brecha = real − teórico de las fichas en los últimos meses cerrados.'
  };
}

function medLecturaMarketing_(out, d, M, c, hoy) {
  var k23 = medKpi_(out, 'K23'), k24 = medKpi_(out, 'K24'), k15 = medKpi_(out, 'K15'), k17 = medKpi_(out, 'K17'), k19 = medKpi_(out, 'K19');
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  var metaSem = M.comensales ? Math.round(M.comensales / diasMes * 7) : null;
  var falt = [];
  if (!k15 || k15.estado !== 'ok') falt.push({ texto: 'El CAC no se puede publicar: menos de la mitad de las mesas se cerraron en Wix (depende de Sala).', zona: 'rojo' });
  else if (k15.nota && k15.nota.indexOf('inflado') > -1) falt.push({ texto: 'El CAC sale inflado: la lectura de Wix está bajo 90%.', zona: 'amarillo' });
  return { pilar: 'marketing', titulo: 'Marketing', dueno: 'Juanma · palanca de Vanessa',
    pregunta: '¿Vienen suficientes personas?',
    zona: c.com_zona,
    respuesta: medZonaTexto_(c.com_zona, 'Sí. Al ritmo actual llegamos a ' + c.com_ritmo + ' comensales; la meta es ' + M.comensales + '.',
      'Casi. Al ritmo actual llegamos a ' + c.com_ritmo + ' comensales y la meta es ' + M.comensales + '.',
      'No. Al ritmo actual llegamos a ' + c.com_ritmo + ' comensales y la meta es ' + M.comensales + '.'),
    numero: { valor: c.com_ritmo === null ? '—' : String(c.com_ritmo), etiqueta: 'comensales de ' + M.mes + ' al ritmo actual', meta: M.comensales ? 'meta ' + M.comensales : 'sin meta', zona: c.com_zona },
    extras: [],
    serie: { titulo: 'Comensales por semana (POS), contra la meta semanal', unidad: '', sentido: 'mayor', meta: metaSem, puntos: medSerie_(d, 'com', 8) },
    palancas: [
      medPal_('Clientes nuevos del mes', 'Vanessa', k24, k24 && k24.valor !== null ? String(k24.valor) : '—', medMetaTxt_(M.clientes.valor), 'Pauta optimizada a reserva real.'),
      medPal_('CAC', 'Vanessa', k15, k15 && k15.valor !== null ? medQ_(k15.valor) : 'no se publica', '≤Q60', k15 ? k15.periodo : ''),
      medPal_('Eventos cerrados, en Q', 'Juanma', k17, k17 ? medQ_(k17.valor) : '—', M.eventos.valor ? medQ_(M.eventos.valor) : '—', 'Seguimiento de cotizaciones.'),
      medPal_('Repetición', 'Juanma', k19, k19 && k19.valor !== null ? k19.valor + '%' : '—', '24% → 28% en marzo', '')
    ],
    faltantes: falt,
    como: 'Comensales del mes = venta del restaurante ÷ ticket (1 de cada 10 tickets viene sin comensales en el POS). Clientes nuevos = altas "Cliente que visitó" del CRM. Las decisiones de pauta: pestaña ⚖️ Decisiones.'
  };
}

function medLecturaExpansion_(out) {
  var ks = out.kpis || [];
  var ok = ks.filter(function (k) { return k.zona === 'verde'; }).length;
  return { pilar: 'expansion', titulo: 'Expansión', dueno: 'Juanma',
    pregunta: '¿Ya estamos listos para crecer?',
    zona: ok === ks.length && ks.length ? 'verde' : 'rojo',
    respuesta: 'Todavía no. Se cumplen ' + ok + ' de ' + ks.length + ' condiciones y hacen falta las tres durante 3 meses seguidos.',
    numero: { valor: ok + ' de ' + ks.length, etiqueta: 'condiciones que se cumplen hoy (hacen falta 3 meses seguidos)', meta: 'meta ' + ks.length + ' de ' + ks.length, zona: ok === ks.length && ks.length ? 'verde' : 'rojo' },
    extras: [], serie: null,
    palancas: ks.map(function (k) { return { nombre: k.nombre, dueno: k.clave === 'C1' ? 'Juanma' : 'Jeffry', hoy: k.unidad === '%' ? k.valor + '%' : String(k.valor), meta: k.meta_texto, zona: k.zona, nota: '' }; }),
    faltantes: [],
    como: 'Pilar en pausa hasta 2027 por regla del método: no se mide expansión mientras la caja no tenga colchón, el food cost no esté en meta y el inventario no cierre a tiempo.'
  };
}

/** Para Marketing.html, que llama por srv() con el token al FINAL: la lectura de Marketing. */
function getLecturaPauta(auth) {
  var u = resolverUsuario_(auth);                // la guarda va aqui tambien: la bateria lee el cuerpo
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  return getLecturaPilar(auth, 'marketing');
}

// ============================================================================
// UNA SOLA LISTA DE ACCIONES (27-sep-2026, decision de Juanma)
// ============================================================================
/*
 * El reporte semanal tenia su propia lista (REPORTE_ACCIONES, responsable por
 * departamento) y los pilares la suya (ACCIONES, dueño con nombre). Dos listas de
 * "que hacemos esta semana" es el problema que el Sistema de Medicion vino a quitar.
 * Ahora todo vive en ACCIONES. El reporte muestra el DEPARTAMENTO (su regla del
 * 23-sep: sin nombres propios) y el tablero y los mensajes muestran la PERSONA.
 */
var MED_DEPTO_A_PERSONA_ = { 'Cocina': 'Jeffry', 'Barra': 'José', 'Sala': 'José', 'Reservas': 'Vanessa', 'Administración': 'Juanma' };
var MED_DEPTO_A_PILAR_ = { 'Cocina': 'profit', 'Barra': 'profit', 'Sala': 'management', 'Reservas': 'marketing', 'Administración': 'finanzas' };
/** El departamento de una accion: José es Barra en Profit OS y Sala en lo demas (28-sep-2026). */
function medDeptoDe_(persona, pilar) {
  persona = String(persona || '');
  if (persona === 'José' && String(pilar) === 'profit') return 'Barra';
  return MED_PERSONA_A_DEPTO_[persona] || persona;
}
var MED_PERSONA_A_DEPTO_ = { 'Jeffry': 'Cocina', 'José': 'Sala', 'Efraín': 'Sala', 'Vanessa': 'Reservas', 'Juanma': 'Administración', 'Nadia': 'Administración' };

function medClaveATexto_(clave) { clave = Number(clave); return Math.floor(clave / 100) + '-S' + ((clave % 100) < 10 ? '0' : '') + (clave % 100); }

/** Las acciones de UNA semana (clave AAAAWW), en la forma que usa el reporte semanal. */
function medAccionesReporte_(clave) {
  var out = { lista: [], existe: false };
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
  if (!sh) return out;
  out.existe = true;
  var v = sh.getDataRange().getValues(), head = v[0].map(String), iP = head.indexOf('PORQUE'), sem = medClaveATexto_(clave);
  // La semana siguiente (28-sep-2026): lo que proponen el reporte y el vigia para ella,
  // para aprobarlo o descartarlo desde la seccion 8 del reporte. Sin las descartadas.
  var lun = _finLunesDeClave_(clave), iM = head.indexOf('META');
  var semSig = medSemanaClave_(new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 7));
  out.semana_siguiente = semSig; out.siguiente = [];
  // Solo lo de los supervisores: Cocina, Barra y Sala (REP_DEPARTAMENTOS).
  function deSupervisor(r) { return REP_DEPARTAMENTOS.indexOf(medDeptoDe_(r[3], r[1])) !== -1; }
  for (var j = 1; j < v.length; j++) {
    if (String(v[j][0]) !== semSig || String(v[j][5] || '') === 'descartada' || !deSupervisor(v[j])) continue;
    out.siguiente.push({ fila: j + 1, accion: String(v[j][2] || ''),
                         responsable: medDeptoDe_(v[j][3], v[j][1]),
                         porque: iP >= 0 ? String(v[j][iP] || '') : '', meta: iM >= 0 ? String(v[j][iM] || '') : '',
                         escrito_por: String(v[j][6] || ''), estado: String(v[j][5] || '') });
  }
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) !== sem || !deSupervisor(v[i])) continue;
    var est = String(v[i][5] || '');
    if (est === 'descartada' || est === 'sugerida') continue;       // el reporte muestra lo aprobado
    out.lista.push({ fila: i + 1, accion: String(v[i][2] || ''),
                     responsable: medDeptoDe_(v[i][3], v[i][1]),
                     porque: iP >= 0 ? String(v[i][iP] || '') : '',
                     fecha: v[i][7] instanceof Date ? _finFecha_(v[i][7]) : String(v[i][7] || ''),
                     escrito_por: String(v[i][6] || ''), estado: est });
  }
  return out;
}

/** Guarda una accion que viene del reporte (departamento + por que) en ACCIONES. */
function medGuardarDesdeReporte_(clave, accion, depto, porque, u) {
  var sh = _vigHoja_(MED_ACC_HOJA_, MED_ACC_COLS_);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var iP = head.indexOf('PORQUE');
  if (iP === -1) { iP = head.length; sh.getRange(1, iP + 1).setValue('PORQUE').setFontWeight('bold'); }
  // fecha limite: el domingo de esa semana ISO
  var anio = Math.floor(clave / 100), w = clave % 100;
  var ene4 = new Date(anio, 0, 4), lunes1 = new Date(anio, 0, 4 - ((ene4.getDay() || 7) - 1));
  var domingo = new Date(lunes1.getFullYear(), lunes1.getMonth(), lunes1.getDate() + (w - 1) * 7 + 6);
  var fila = [medClaveATexto_(clave), MED_DEPTO_A_PILAR_[depto] || 'finanzas', accion, MED_DEPTO_A_PERSONA_[depto] || 'Juanma',
              medFechaIso_(domingo), 'pendiente', u.nombre || u.email || '', new Date(), ''];
  while (fila.length < iP) fila.push('');
  fila[iP] = porque;
  sh.appendRow(fila);
  SpreadsheetApp.flush();
}

// ============================================================================
// VISION 2027 (27-sep-2026, aprobada por Juanma)
// ============================================================================
/*
 * La punta de la cadena: vision → meta del negocio → un numero por pilar → palancas.
 * Se muestra arriba del Panel principal (todo el equipo) y arriba de la Cascada del
 * tablero. El avance de cada punto sale de los motores; el equipo lo ve en porcentajes
 * y fechas, y solo el dueño ve los quetzales (el piso es su costo de vida personal).
 * Documento: Rosanta OS / 01_Business_Fundamentals / 2026-09-27_Vision_2027.md
 */
var MED_VISION_ = {
  titulo: 'En 2027 Rosanta se paga sola.',
  texto: 'Cubre todos los meses el costo de vida de su dueño, devuelve lo invertido a Raúl, hace de los eventos ' +
         'su segunda línea de negocio y funciona una semana completa sin Juanma, sin bajar la experiencia de mesa ' +
         'ni la cocina de temporada.',
  venta_2027: 2100000, eventos_pct: 15, food_pct: 28, ebitda_pct: 10, caja_dias: 21,
  resenas: 4.8,        // piso duro (Juanma, 27-sep-2026): 'no debemos bajar nunca de 4.8'
  ensayo: '2027-06-01', semana_sin_juanma: '2027-10-18'
};

function medVision_(u) {
  var rol = normalizar_(u && u.rol), conQ = rol === 'dueno', hoy = new Date();
  var V = MED_VISION_, puntos = [];
  function p(nombre, hoyTxt, meta, zona) { puntos.push({ nombre: nombre, hoy: hoyTxt, meta: meta, zona: zona || 'gris' }); }
  var d = null, P = null, M = null, c = null;
  try { d = _finDatos_(false); P = tabParametros_(); M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P); } catch (e) { d = null; }
  if (d) {
    var totV = d.total.ventas, totE = (d.meses || []).reduce(function (a, x) { return a + (x.eventos || 0); }, 0);
    if (conQ) {
      try { c = medCascadaResumen_(d, P, M, hoy); } catch (e2) { c = null; }
      p('Se paga sola', c && c.deja !== null ? 'deja ' + medQ_(c.deja) + ' (mes en curso, en proporción)' : '—',
        'piso Q18,896 los 12 meses · venta ' + medQ_(V.venta_2027), c ? c.deja_zona : 'gris');
    }
    // Limpieza del 28-sep-2026 (Juanma): fuera los puntos que eran texto fijo y siempre salian en gris
    // ('Devuelve lo invertido', 'Sin Juanma' y 'Se paga sola' para quien no es dueño). Siguen en el texto.
    var pe = (totV + totE) ? Math.round(totE / (totV + totE) * 1000) / 10 : null;
    p('Eventos, segunda línea', pe !== null ? pe + '% del ingreso ' + d.anio : '—', V.eventos_pct + '% del ingreso',
      pe === null ? 'gris' : (pe >= V.eventos_pct ? 'verde' : (pe >= V.eventos_pct / 2 ? 'amarillo' : 'rojo')));
    var u4 = d.ultima || {};
    p('Rentable: food cost', medMetaTxt_(u4.cogs_m4, '', '%', '—'), V.food_pct + '%', tabZona_(u4.cogs_m4, V.food_pct, V.food_pct + 5, 'menor'));
    if (conQ) {        // la salud de la caja la ve el dueño, no el equipo
      p('Rentable: EBITDA del año', d.total.ebitdap + '%', 'más de ' + V.ebitda_pct + '%', tabZona_(d.total.ebitdap, V.ebitda_pct, 0, 'mayor'));
      p('Rentable: días de caja', String(d.dias_caja), V.caja_dias + ' días', tabZona_(d.dias_caja, V.caja_dias, 7, 'mayor'));
    }
  }
  var rs = null;
  try { rs = medResenas_(hoy); } catch (e3) { rs = null; }
  p('Sin bajar la experiencia', rs && rs.estrellas_4 !== null ? rs.estrellas_4 + '★ en las reseñas de las últimas 4 semanas' : 'sin dato de reseñas',
    'nunca bajo ' + V.resenas + '★', rs && rs.estrellas_4 !== null ? (rs.estrellas_4 >= V.resenas ? 'verde' : 'rojo') : 'gris');
  return { titulo: V.titulo, texto: V.texto, puntos: puntos, con_q: conQ };
}

/** La vision para el panel principal y el tablero. Cualquiera identificado la ve. */
function getVision(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  return medVision_(u);
}
