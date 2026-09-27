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
    food:       de('tramo_food_pct'),
    brecha:     de('tramo_brecha_pts'),
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
    it('Lo que deja la operación', c.deja !== null ? 'Q' + Math.round(c.deja).toLocaleString('es-GT') : '—',
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
    it('Clientes nuevos del mes', Kc && Kc.altas !== null ? String(Kc.altas) : '—', 'meta ' + M.clientes.valor + ' · "Cliente que visitó"',
       Kc ? tabZona_(Kc.altas, M.clientes.valor, 30, 'mayor') : 'gris');
    it('CAC ' + (Ku ? Ku.mes : ''), Ku && Ku.publicable && Ku.cac !== null ? 'Q' + Math.round(Ku.cac) : 'no se publica',
       'máximo Q' + P.cac_max_q.valor + (Ku && Ku.lectura !== null ? ' · lectura ' + Ku.lectura + '%' : ''),
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
    it('Food cost real (móvil 4)', ul.cogs_m4 + '%', 'tramo ≤' + M.food.valor + '% · meta ' + d.meta_cogs + '%',
       tabZona_(ul.cogs_m4, M.food.valor, M.food.valor + 3, 'menor'));
    var b = null;
    try { var rt = getCmvRealTeorico(auth); b = rt && rt.ok ? rt.bloque : null; } catch (e) { b = null; }
    it('Brecha real contra teórico', b ? (b.brecha_pts > 0 ? '+' : '') + b.brecha_pts + ' pts' : '—',
       'tramo ≤' + M.brecha.valor + ' pts', b ? tabZona_(b.brecha_pts, M.brecha.valor, M.brecha.valor + 2, 'menor') : 'gris');
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
  it('Lectura de Wix', lect !== null ? lect + '%' : '—', 'meta ' + M.lectura.valor + '% · mesas cerradas',
     tabZona_(lect, M.lectura.valor, 50, 'mayor'));
  var rb = inv.areas.BARRA;
  it('Inventario de barra', rb.ultimo_cerrado || 'ninguno', 'esperado ' + inv.esperado, rb.zona);
  try {
    var rs = medResenas_(hoy);
    it('Reseñas de Google esta semana', String(rs.esta_semana), 'meta ' + M.resenas.valor + ' · la semana pasada ' + rs.semana_pasada,
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
    lect === null ? 'sin altas este mes' : lect + '% · meta ' + M.lectura.valor + '%', 'José');
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

/** La franja "Mi palanca" arriba del Dashboard de Pauta: la vista de Vanessa (rol pauta). El dueño ve la misma. */
function getMiPalancaPauta(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
  var rol = normalizar_(u.rol);
  if (rol !== 'pauta' && rol !== 'dueno') return null;
  return medMiSemana_(u, 'pauta', auth);
}
