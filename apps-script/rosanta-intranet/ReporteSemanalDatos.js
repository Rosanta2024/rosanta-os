/**
 * ReporteSemanalDatos.gs — el REPORTE SEMANAL DE OPERACION, en vivo. Pilar 3.
 *
 * Decision de Juanma (25-sep-2026): el reporte que se revisa cada semana con los jefes
 * de departamento deja de ser un PDF armado a mano (generar_reporte_semanal.py, que
 * tenia los numeros de la semana escritos como constantes) y pasa a ser una pantalla
 * de la intranet, con el PDF como descarga. Las 8 secciones y su orden son los del
 * formato cerrado el 23-sep sobre la S38 (rosanta-reporte-semanal-formato).
 *
 * CON LAS REGLAS DE LA INTRANET, no las del PDF (Juanma, 25-sep): venta neta =
 * Subtotal / 1.12 sin eventos; food cost sobre venta sin servicio contra la meta de
 * PARAMETROS (metasFoodCost_); nomina DEVENGADA de la planilla; compra con la regla 15;
 * equilibrio con el fijo y el margen de contribucion del motor. Si el PDF viejo y esta
 * pantalla dicen distinto, manda esta.
 *
 * NO CALCULA DE NUEVO lo que ya calcula FinanzasDatos: la semana (ventas, comensales,
 * compra por area, secciones del DRE, nomina, prime) sale de d.semanas[]; el mes de
 * d.meses[]. Lo que agrega, porque no existia por semana: la serie DIARIA de la
 * semana (02_Ventas_Maestro), las RESERVAS de la semana (pestana reservas de Rosanta
 * Marketing OS), los PLATOS mas vendidos por area (VENTAS x PLATO, via ventasDelRango_)
 * y las ACCIONES de la semana (pestana REPORTE_ACCIONES del Sheet de config, que se
 * escribe desde la pantalla).
 *
 * AMBITO GLOBAL: todo empieza con rep / _rep. Solo guardarAccionReporte escribe.
 */

var REP_HOJA_ACCIONES = 'REPORTE_ACCIONES';
var REP_COLS_ACCIONES = ['SEMANA', 'ACCION', 'RESPONSABLE', 'PORQUE', 'FECHA', 'ESCRITO_POR'];
// Responsables por DEPARTAMENTO, no por persona: es un documento interno de operacion
// y el formato no lleva nombres propios (decision de Juanma, 23-sep-2026).
// El reporte es de los supervisores (Juanma, 28-sep-2026): solo Cocina, Barra y Sala. Lo de
// Reservas y Administracion vive en su pilar (Marketing, Finanzas).
var REP_DEPARTAMENTOS = ['Cocina', 'Barra', 'Sala'];
var REP_TOP = 6;               // platos por area en la tabla de mas vendidos
var REP_SEMANAS_LISTA = 12;    // semanas que ofrece el selector
var REP_CACHE = 'rep_sem_v7_';   // v7: la seccion 8 trae aparte Reservas y Administracion (29-sep-2026)
var REP_CACHE_SEGS = 30 * 60;

// ------------------------------------------------------------------ entradas

function getReporteSemanal(auth, clave) {
  var u = exigirModulo_(auth, 'finanzas');
  return _repSinDireccion_(_repDatos_(Number(clave) || 0, false), u);
}

function refrescarReporteSemanal(auth, clave) {
  var u = exigirModulo_(auth, 'finanzas');
  return _repSinDireccion_(_repDatos_(Number(clave) || 0, true), u);
}

/** Las acciones de Reservas y Administracion (29-sep-2026) solo le llegan al dueño. */
function _repSinDireccion_(d, u) {
  if (normalizar_(u && u.rol) === 'dueno' || !d || !d.acciones) return d;
  d.acciones.direccion = [];
  return d;
}

/**
 * Las secciones del reporte que viven DENTRO de Profit OS (Juanma, 27-sep-2026: "reparte
 * cada seccion del reporte en su seccion de la intranet"). Dos pestañas:
 *   cocina     food cost, compra contra techo y platos de cocina (Jeffry y el dueño)
 *   barrasala  lo mismo de barra, mas comensales y reservas (José y el dueño)
 * Mismo calculo y misma cache que el reporte entero; lo que cambia es QUE sale: nada del
 * resultado de la casa (P&L, equilibrio, venta del dia), que es de Finanzas.
 */
var REP_AREAS_ROLES = { cocina: ['chef', 'dueno'], barrasala: ['sala', 'dueno'] };

function getReporteArea(auth, clave, area, forzar) {
  var u = exigirModulo_(auth, 'recetario');
  area = String(area || '');
  if (!REP_AREAS_ROLES.hasOwnProperty(area)) throw new Error('Area desconocida: ' + area);
  if (REP_AREAS_ROLES[area].indexOf(normalizar_(u.rol)) === -1) throw new Error('Esta pestaña es de ' + (area === 'cocina' ? 'cocina' : 'barra y sala') + ' y del dueño.');
  return _repRecortarArea_(_repDatos_(Number(clave) || 0, !!forzar), area);
}

function _repRecortarArea_(d, area) {
  return {
    area: area, semana: d.semana, semanas: d.semanas, gen: d.gen, fuentes: d.fuentes, notas: d.notas,
    metas: d.metas, foodcost: d.foodcost, compras: d.compras, areas: d.areas,
    reservas: area === 'barrasala' ? d.reservas : null,
    // por dia sin la venta: la venta de la casa es de Finanzas
    dias: area === 'barrasala' ? (d.dias || []).map(function (x) {
      return { dia: x.dia, com: x.com, personas: x.personas, walkins: x.walkins, reservas: x.reservas,
               canceladas: x.canceladas, reservas_superan: x.reservas_superan };
    }) : []
  };
}

function _repDatos_(clave, forzar) {
  var cache = CacheService.getScriptCache();
  // La llave lleva la ULTIMA semana del motor (clave, venta y comensales), no solo la
  // version del motor: finCacheClave_ es una version, no un sello de datos, y el 28-sep
  // (lunes) el reporte quedo cacheado con la S38 mientras el motor ya traia la S39 con
  // los datos del domingo. Leer el motor aqui es barato: viene de su propio cache.
  var dm = _finDatos_(false), um = (dm && dm.ultima) || {};
  var sello = (um.clave || 0) + '_' + Math.round(um.ventas || 0) + '_' + (um.com || 0);
  var k = REP_CACHE + (clave || 'ultima') + '_' + finCacheClave_() + '_' + sello;
  if (!forzar) {
    var g = cache.get(k);
    if (g) { try { return JSON.parse(g); } catch (e) { /* se recalcula */ } }
  }
  var out = _repCalcular_(clave);
  try { cache.put(k, JSON.stringify(out), REP_CACHE_SEGS); } catch (e2) { /* si no cabe, igual se devuelve */ }
  return out;
}

// ------------------------------------------------------------------ utilidades

function _repIso_(d) {
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Una fecha de una hoja: Date, o texto AAAA-MM-DD (con o sin hora). null si no. */
function _repFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '').trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '').trim());
  if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  return null;
}

var REP_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ------------------------------------------------------------------ el calculo

function _repCalcular_(clave) {
  var d = _finDatos_(false);
  var S = d.semanas || [];
  if (!S.length) throw new Error('El maestro no tiene semanas con venta todavia.');
  var idx = S.length - 1;
  if (clave) {
    for (var i = 0; i < S.length; i++) if (S[i].clave === clave) { idx = i; break; }
  }
  var s = S[idx];
  var lunes = _finLunesDeClave_(s.clave);
  var domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  var jueves = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 3);
  var mesN = jueves.getMonth() + 1;
  var mes = null;
  (d.meses || []).forEach(function (x) {
    if (x.m === mesN) mes = x;
  });
  var metas = metasFoodCost_();
  var notas = [];

  // ---- 1. la semana y las cuatro ----------------------------------------
  var ant = idx > 0 ? S[idx - 1] : null;
  var cuatro = S.slice(Math.max(0, idx - 3), idx + 1);

  // ---- 2. equilibrio semanal -------------------------------------------------
  // Con el PRESUPUESTO que Juanma definio el 22-sep (Rosanta_Intranet_Config ›
  // PRESUPUESTO), que es la estructura de costos de la casa, no un benchmark:
  //   fijos     las secciones tipo "fijo", el monto del mes de la semana si lo trae
  //             y si no el Valor mensual; entre 4.345 = fijos por semana
  //   variables las secciones tipo "%venta" (comisiones, propinas) mas la mercaderia,
  //             que va con la MOVIL DE 4 de compra sobre venta (regla 7: la semana
  //             cruda no es señal) — cociente de sumas de las 4 semanas
  //   PE        fijos por semana / (1 - variables)
  // Decidido por Juanma el 28-sep-2026: manda el PRESUPUESTO, aqui y en Escenarios, con
  // una sola funcion (_finEquilibrioPresu_, Presupuesto.js). La "referencia del motor"
  // (fijo y variable del banco: Q155,894 por semana con el margen de agosto) se retiro.
  var pe = null;
  var vC = 0, cC = 0;
  cuatro.forEach(function (x) { vC += x.ventas; cC += x.cogs; });
  var eq = _finEquilibrioPresu_(d.presupuesto, mesN, vC ? cC / vC * 100 : null);   // movil de 4
  if (!eq) {
    notas.push('Sin punto de equilibrio: falta la pestaña PRESUPUESTO del Sheet de config (instalarPresupuesto).');
  } else if (eq.pe_mes) {
    var fijoSem = eq.fijo_mes / FIN_SEMANAS_MES;
    pe = { fijos: eq.fijos, fijo_mes: eq.fijo_mes, fijo_semana: _finR_(fijoSem),
           variables: eq.pct_venta.concat([{ seccion: 'Mercaderia (compra, movil de 4 semanas)', pct: eq.merc_pct }]),
           variables_pct: _finR_(eq.merc_pct + eq.pct_total, 1), mc: eq.mc,
           pe_semana: _finR_(fijoSem / (eq.mc / 100)), pe_mes: eq.pe_mes,
           base: 'PRESUPUESTO · mercaderia movil de 4 (S' + cuatro[0].w + ' a S' + s.w + ')' };
  } else {
    notas.push('Sin equilibrio: el presupuesto no tiene fijos o el margen de contribucion no es positivo (mercaderia ' +
               (eq.merc_pct === null ? '—' : eq.merc_pct + '%') + ' + ' + eq.pct_total + '% de venta).');
  }
  var peDia = pe ? _finR_(pe.pe_semana / 7) : null;

  // ---- 3. la serie diaria (02_Ventas_Maestro, mismas reglas 1, 2 y 10) ------------
  var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
  var V = ss.getSheetByName('02_Ventas_Maestro').getDataRange().getValues();
  var dias = [];
  for (var k = 0; k < 7; k++) {
    var f = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + k);
    dias.push({ iso: _repIso_(f), dia: REP_DIAS[f.getDay()] + ' ' + f.getDate(), ventas: 0, com: 0, tickets: 0,
                reservas: 0, personas: 0, canceladas: 0, walkins: null, eventos: 0 });
  }
  var porIso = {};
  dias.forEach(function (x) { porIso[x.iso] = x; });
  for (var r = FIN_PRIMERA_FILA - 1; r < V.length; r++) {
    var fv = _finDia_(V[r][1]);
    if (!_finEsFecha_(fv) || fv < lunes || fv > domingo) continue;
    var dd = porIso[_repIso_(fv)];
    if (!dd) continue;
    var neto = _finNum_(V[r][3]) / 1.12;
    if ((String(V[r][7] || '') + String(V[r][11] || '')).toUpperCase().indexOf('EVENTO') !== -1) {
      dd.eventos += neto; continue;
    }
    dd.ventas += neto; dd.tickets += 1; dd.com += Math.round(_finNum_(V[r][8]));
  }

  // ---- 4. reservas de la semana (Rosanta Marketing OS › reservas) ----------------
  var reservas = { total: 0, validas: 0, personas: 0, canceladas: 0, personas_canceladas: 0,
                   sin_cerrar: 0, con_estado: {}, error: '' };
  try {
    var hr = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName('reservas');
    if (!hr) throw new Error('no existe la pestana reservas');
    var RV = hr.getDataRange().getValues();
    var cab = (RV[0] || []).map(function (c) { return _finSinAcentos_(String(c || '')).toLowerCase().trim(); });
    var cF = cab.indexOf('fecha'), cP = cab.indexOf('personas'), cE = cab.indexOf('estado');
    if (cF < 0) throw new Error('la pestana reservas no tiene columna fecha');
    for (var j = 1; j < RV.length; j++) {
      var fr = _repFecha_(RV[j][cF]);
      if (!fr || fr < lunes || fr > domingo) continue;
      var dr = porIso[_repIso_(fr)];
      var estado = String(cE >= 0 ? RV[j][cE] : '').toUpperCase().trim();
      var personas = cP >= 0 ? Math.round(_finNum_(RV[j][cP])) : 0;
      reservas.total += 1;
      reservas.con_estado[estado || '(sin estado)'] = (reservas.con_estado[estado || '(sin estado)'] || 0) + 1;
      var cancelada = /CANCEL|DECLIN|NO.?SHOW/.test(estado);
      if (cancelada) {
        reservas.canceladas += 1; reservas.personas_canceladas += personas;
        if (dr) dr.canceladas += 1;
        continue;
      }
      reservas.validas += 1; reservas.personas += personas;
      if (/^RESERV/.test(estado)) reservas.sin_cerrar += 1;
      if (dr) { dr.reservas += 1; dr.personas += personas; }
    }
  } catch (e) {
    reservas.error = String(e && e.message || e);
    notas.push('Reservas: ' + reservas.error);
  }
  dias.forEach(function (x) {
    x.ventas = _finR_(x.ventas); x.eventos = _finR_(x.eventos);
    // walk-ins = comensales del POS que no vinieron con reserva. Si las personas
    // reservadas superan a los comensales, se marca: alguien reservo y no se registro
    // en el POS, o la reserva se conto dos veces.
    x.walkins = reservas.error ? null : Math.max(x.com - x.personas, 0);
    x.reservas_superan = !reservas.error && x.personas > x.com;
    x.sobre_equilibrio = peDia !== null ? x.ventas >= peDia : null;
  });
  var comSemana = dias.reduce(function (a, x) { return a + x.com; }, 0);
  reservas.walkins = reservas.error ? null : Math.max(comSemana - reservas.personas, 0);
  reservas.walkins_pct = (!reservas.error && comSemana) ? _finR_(reservas.walkins / comSemana * 100, 1) : null;
  reservas.canceladas_pct = reservas.total ? _finR_(reservas.canceladas / reservas.total * 100, 1) : null;

  // ---- 5. platos y venta por area (VENTAS x PLATO) -------------------------------
  var areas = { cocina: { venta: 0, uds: 0, productos: {} }, barra: { venta: 0, uds: 0, productos: {} } };
  var sinArea = 0, ventaPlatos = 0;
  var platosError = '';
  // Venta por area de CADA una de las cuatro semanas (para el grafico de compras contra
  // su techo, 26-sep-2026): UNA lectura de VENTAS x PLATO sobre el rango de las cuatro,
  // repartida por semana con la fecha de cada linea. La semana en curso (la ultima)
  // alimenta ademas los platos y el mix, con las mismas lineas que antes.
  var lunes0 = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 7 * (cuatro.length - 1));
  var ventaSem = cuatro.map(function () { return { cocina: 0, barra: 0 }; });
  try {
    var vr = ventasDelRango_(_repIso_(lunes0), _repIso_(domingo));
    (vr.lineas || []).forEach(function (l) {
      if (!l.producto || ignorarEnVentas_(l.producto)) return;
      var a = esCocinaPOS_(l.categoria) ? 'cocina' : 'barra';
      var fl = _repFecha_(l.fecha);
      var iSem = fl ? Math.floor((fl - lunes0) / 864e5 / 7) : -1;
      if (iSem >= 0 && iSem < ventaSem.length) ventaSem[iSem][a] += l.total;
      if (iSem !== cuatro.length - 1) return;      // platos y mix: solo la semana en curso
      var A = areas[a];
      A.venta += l.total; A.uds += l.cantidad; ventaPlatos += l.total;
      var P = A.productos[l.producto] || (A.productos[l.producto] = { nombre: l.producto, uds: 0, venta: 0 });
      P.uds += l.cantidad; P.venta += l.total;
    });
  } catch (e2) {
    platosError = String(e2 && e2.message || e2);
    notas.push('Platos: ' + platosError);
  }
  function topDe(A) {
    var lista = Object.keys(A.productos).map(function (n) { return A.productos[n]; })
      .sort(function (x, y) { return y.venta - x.venta; });
    var top = lista.slice(0, REP_TOP).map(function (p) {
      return { nombre: p.nombre, uds: p.uds, venta: _finR_(p.venta), pct: A.venta ? _finR_(p.venta / A.venta * 100, 1) : 0 };
    });
    var resto = lista.slice(REP_TOP);
    if (resto.length) {
      var rv = resto.reduce(function (a, p) { return a + p.venta; }, 0), ru = resto.reduce(function (a, p) { return a + p.uds; }, 0);
      top.push({ nombre: 'Otros ' + resto.length + ' productos', uds: ru, venta: _finR_(rv), pct: A.venta ? _finR_(rv / A.venta * 100, 1) : 0, otros: true });
    }
    return top;
  }
  // La venta por plato del POS trae IVA; la base del food cost es sin IVA ni servicio
  // (regla 14). Se divide por 1.12 igual que hace el puente CMV.
  var ventaCocina = _finR_(areas.cocina.venta / 1.12), ventaBarra = _finR_(areas.barra.venta / 1.12);
  var mix = (ventaCocina + ventaBarra) ? _finR_(ventaCocina / (ventaCocina + ventaBarra) * 100, 1) : null;

  // ---- 6. food cost: compra de la semana por area (motor) contra la venta del area --
  function fc(costo, venta, meta) {
    return { costo: _finR_(costo), venta: venta, meta: meta,
             real_pct: venta ? _finR_(costo / venta * 100, 1) : null,
             a_meta: _finR_(venta * meta / 100),
             // sin venta del area (VENTAS x PLATO sin cargar) no hay exceso que medir
             exceso: venta ? _finR_(costo - venta * meta / 100) : null,
             desvio_pts: venta ? _finR_(costo / venta * 100 - meta, 1) : null };
  }
  var foodcost = {
    semana_pct: s.cogsp, movil4_pct: s.cogs_m4 === undefined ? null : s.cogs_m4,
    mes_pct: mes ? mes.cogsp : null, mes_nombre: mes ? mes.mes : '',
    meta_global: metas.global,
    cocina: fc(s.cocina, ventaCocina, metas.COCINA),
    barra: fc(s.barra, ventaBarra, metas.BARRA),
    mes: mes ? { cocina: _finR_(((d.compra || {}).cocina || { mes: {} }).mes[mesN] || 0),
                 barra: _finR_(((d.compra || {}).barra || { mes: {} }).mes[mesN] || 0),
                 ventas_ss: mes.ventas_ss } : null,
    aviso_barra: 'El costo de barra es compra contra venta de la misma semana, no costo de consumo: una ' +
                 'compra de inventario cae entera en la semana en que se paga.'
  };

  // ---- 6b. compras contra su techo, cuatro semanas (pedido de Juanma, 26-sep-2026) --
  // Para que cocina y barra VEAN que la compra pega directo en el equilibrio. Techo =
  // venta del area de esa semana x su meta. Lo comprado por encima del techo hay que
  // venderlo de vuelta: cada quetzal de exceso exige 1 / (margen de contribucion) de
  // venta extra para quedar en equilibrio. Compra por area = semanas[].cocina/.barra
  // del motor (la misma de la seccion 6); venta por area = VENTAS x PLATO sin IVA.
  function techoDe(compra, venta, meta) {
    var v = _finR_(venta / 1.12), techo = _finR_(v * meta / 100);
    return { compra: _finR_(compra), venta: v, techo: techo,
             exceso: v ? _finR_(compra - techo) : null,
             real_pct: v ? _finR_(compra / v * 100, 1) : null };
  }
  var factor = (pe && pe.mc > 0) ? _finR_(100 / pe.mc, 2) : null;
  function impactoDe(t) {
    var ex = t.exceso !== null && t.exceso > 0 ? t.exceso : 0;
    return { exceso: ex, venta_extra: factor ? _finR_(ex * factor) : null };
  }
  var comprasSem = cuatro.map(function (x, i) {
    return { w: x.w, actual: x.clave === s.clave,
             cocina: techoDe(x.cocina, ventaSem[i].cocina, metas.COCINA),
             barra: techoDe(x.barra, ventaSem[i].barra, metas.BARRA) };
  });
  var compras = {
    semanas: comprasSem, meta_cocina: metas.COCINA, meta_barra: metas.BARRA,
    mc: pe ? pe.mc : null, factor: factor,
    impacto: { cocina: impactoDe(comprasSem[comprasSem.length - 1].cocina),
               barra: impactoDe(comprasSem[comprasSem.length - 1].barra) },
    nota: 'El techo de compra es la venta del area de esa semana por su meta (' + metas.COCINA + '% cocina, ' +
          metas.BARRA + '% barra). Lo comprado por encima del techo no es un porcentaje: es venta que hay que ' +
          'recuperar. Con margen de contribucion ' + (pe ? pe.mc : '—') + '%, cada quetzal de exceso exige ' +
          (factor ? 'Q' + factor : '—') + ' de venta extra para volver al equilibrio.'
  };

  // ---- 7. personal y P&L semanal ------------------------------------------------
  var bloques = s.bloques || {};
  var secciones = [];
  var gastoSecciones = 0;
  // Los bloques del DRE (28-sep-2026). Del de Nomina se saca lo que el banco pago de
  // planilla e IGSS: la nomina entra devengada (s.labor). Quedan propinas y uniformes.
  var enSemana = {};
  Object.keys(bloques).forEach(function (b) {
    enSemana[b] = bloques[b] - (b === FIN_B.NOM ? (s.nom_banco || 0) : 0);
  });
  Object.keys(enSemana).sort(function (a, b) { return enSemana[b] - enSemana[a]; }).forEach(function (b) {
    if (Math.abs(enSemana[b]) < 0.005) return;
    secciones.push({ seccion: b === FIN_B.NOM ? 'Nómina: propinas y uniformes' : b, q: _finR_(enSemana[b]) });
    gastoSecciones += enSemana[b];
  });
  var comisiones = _finR_(bloques[FIN_B.FIN] || 0);
  var marketing = _finR_(bloques[FIN_B.MKT] || 0);
  var gasto = _finR_(s.cogs + gastoSecciones + s.labor);
  var resultado = _finR_(s.ventas - gasto);
  var pl = {
    ventas: s.ventas, cogs: s.cogs, cogs_cocina: s.cocina, cogs_barra: s.barra,
    labor: s.labor, labor_pct: s.laborp, secciones: secciones, comisiones: comisiones, marketing: marketing,
    gasto: gasto, gasto_pct: s.ventas ? _finR_(gasto / s.ventas * 100, 1) : null,
    resultado: resultado, resultado_pct: s.ventas ? _finR_(resultado / s.ventas * 100, 1) : null,
    resultado_sin_marketing: _finR_(resultado + marketing),
    nota_nomina: 'Nomina devengada: la planilla del mes entre ' + FIN_SEMANAS_MES + ' (regla 4), no el pago bancario de la semana.'
  };
  var planillaMes = mes && mes.planilla ? mes.planilla : null;
  var personal = {
    labor_semana: s.labor, labor_pct: s.laborp, prime: s.prime, prime_m4: s.prime_m4 === undefined ? null : s.prime_m4,
    planilla_mes: planillaMes ? { fija: planillaMes.fija, extra: planillaMes.extra, extra_cocina: planillaMes.extra_cocina,
                                  extra_barra: planillaMes.extra_barra, n_extra: planillaMes.n_extra,
                                  origen: planillaMes.origen, desde: planillaMes.desde ? FIN_MESES[planillaMes.desde - 1] : '' } : null,
    nota: 'El personal extra por semana pagada no existe en el motor: la planilla es mensual (Dias laborados vacio). Se muestra el reparto del mes.'
  };

  // ---- 8. acciones de la semana ------------------------------------------------
  var acciones = _repAcciones_(s.clave);

  // ---- las semanas que se pueden elegir ---------------------------------------
  var lista = S.slice(Math.max(0, S.length - REP_SEMANAS_LISTA)).reverse().map(function (x) {
    return { clave: x.clave, w: x.w, ini: x.ini, fin: x.fin, ventas: x.ventas };
  });

  return {
    semana: { clave: s.clave, w: s.w, ini: s.ini, fin: s.fin, anio: Math.floor(s.clave / 100),
              lunes: _repIso_(lunes), domingo: _repIso_(domingo), mes: mes ? mes.mes : FIN_MESES[mesN - 1],
              corta: !!s.corta, es_ultima: idx === S.length - 1 },
    kpis: {
      ventas: s.ventas, tickets: s.tickets, com: s.com, ticket: s.tp,
      ticket_ant: ant ? ant.tp : null, ticket_dif_pct: (ant && ant.tp) ? _finR_((s.tp - ant.tp) / ant.tp * 100, 1) : null,
      ventas_dif_pct: s.dv === undefined ? null : s.dv,
      gasto: gasto, gasto_pct: pl.gasto_pct, resultado: resultado, resultado_pct: pl.resultado_pct
    },
    cuatro: cuatro.map(function (x) {
      return { w: x.w, clave: x.clave, ini: x.ini, fin: x.fin, ventas: x.ventas, com: x.com, tp: x.tp,
               cogsp: x.cogsp, prime: x.prime, actual: x.clave === s.clave,
               sobre_equilibrio: pe ? x.ventas >= pe.pe_semana : null };
    }),
    equilibrio: pe ? {
      pe_semana: pe.pe_semana, pe_dia: peDia, pe_mes: pe.pe_mes, base: pe.base,
      fijo_mes: pe.fijo_mes, fijo_semana: pe.fijo_semana, fijos: pe.fijos,
      variables: pe.variables, variables_pct: pe.variables_pct, mc: pe.mc,
      venta_pct: _finR_(s.ventas / pe.pe_semana * 100, 1), brecha: _finR_(s.ventas - pe.pe_semana),
      semanas_sobre: cuatro.filter(function (x) { return x.ventas >= pe.pe_semana; }).length, de: cuatro.length,
      nota: 'Fijos y porcentajes de venta del PRESUPUESTO; mercaderia con la movil de 4 semanas. ' +
            'Es el mismo calculo del equilibrio de cada mes en Escenarios.'
    } : null,
    dias: dias,
    reservas: reservas,
    foodcost: foodcost,
    compras: compras,
    areas: {
      cocina: { venta: ventaCocina, venta_pct: s.ventas ? _finR_(ventaCocina / s.ventas * 100, 1) : null,
                costo: _finR_(s.cocina), costo_pct: ventaCocina ? _finR_(s.cocina / ventaCocina * 100, 1) : null,
                margen: _finR_(ventaCocina - s.cocina), margen_pct: ventaCocina ? _finR_((ventaCocina - s.cocina) / ventaCocina * 100, 1) : null,
                uds: areas.cocina.uds, top: topDe(areas.cocina) },
      barra: { venta: ventaBarra, venta_pct: s.ventas ? _finR_(ventaBarra / s.ventas * 100, 1) : null,
               costo: _finR_(s.barra), costo_pct: ventaBarra ? _finR_(s.barra / ventaBarra * 100, 1) : null,
               margen: _finR_(ventaBarra - s.barra), margen_pct: ventaBarra ? _finR_((ventaBarra - s.barra) / ventaBarra * 100, 1) : null,
               uds: areas.barra.uds, top: topDe(areas.barra) },
      mix_cocina: mix, venta_platos: _finR_(ventaPlatos / 1.12), error: platosError,
      nota: 'Venta por plato del POS sin IVA; no cuadra exacto con el ticket total: la diferencia son descuentos, servicio y partidas sin producto.'
    },
    personal: personal,
    pl: pl,
    acciones: acciones,
    departamentos: REP_DEPARTAMENTOS,
    semanas: lista,
    metas: { food_global: metas.global, food_cocina: metas.COCINA, food_barra: metas.BARRA },
    notas: notas,
    fuentes: 'POS (02_Ventas_Maestro y VENTAS x PLATO), FEL y bancos via FinanzasDatos, planilla devengada, reservas de Wix (Marketing OS).',
    gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm')
  };
}

/** Los fijos de la pestaña PRESUPUESTO, si existe: referencia al lado del fijo del motor. */
function _repFijosPresupuesto_(p) {
  if (!p || !p.existe || !p.secciones) return null;
  var lista = [], total = 0;
  Object.keys(p.secciones).forEach(function (k) {
    var x = p.secciones[k];
    if (!x || String(x.tipo || '').toLowerCase() !== 'fijo') return;
    var v = Number(x.valor || x.mensual || 0);
    if (!v) return;
    lista.push({ seccion: k, mensual: _finR_(v) }); total += v;
  });
  return lista.length ? { secciones: lista, total_mes: _finR_(total), total_semana: _finR_(total / FIN_SEMANAS_MES) } : null;
}

// ------------------------------------------------------------------ acciones

function _repHojaAcciones_(crear) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var h = ss.getSheetByName(REP_HOJA_ACCIONES);
  if (!h && crear) {
    h = ss.insertSheet(REP_HOJA_ACCIONES);
    h.getRange(1, 1, 1, REP_COLS_ACCIONES.length).setValues([REP_COLS_ACCIONES]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

/** OBSOLETA desde el 27-sep-2026: las acciones viven en ACCIONES (MedicionDatos). Queda
    solo por si alguien la corre desde el editor; ya no la lee nadie. */
function instalarReporteAcciones() {
  soloDueno_();
  var h = _repHojaAcciones_(true);
  Logger.log('REPORTE_ACCIONES lista: ' + h.getLastRow() + ' filas.');
}

function _repAcciones_(clave) {
  // Una sola lista (27-sep-2026): las acciones viven en ACCIONES, compartidas con los
  // pilares del tablero y con el vigia. Aqui se leen con el DEPARTAMENTO como responsable.
  try { return medAccionesReporte_(clave); }
  catch (e) { return { lista: [], existe: false, error: String(e && e.message || e) }; }
}

/**
 * Guarda una accion de la semana. Una fila por accion; se apilan (una semana suele
 * tener entre 4 y 8). Con candado, como el RAA (M9).
 */
function guardarAccionReporte(auth, datos) {
  var u = exigirModulo_(auth, 'finanzas');
  datos = datos || {};
  var clave = Number(datos.clave) || 0;
  var accion = String(datos.accion || '').trim();
  var responsable = String(datos.responsable || '').trim();
  var porque = String(datos.porque || '').trim();
  if (!clave) throw new Error('Falta la semana.');
  if (!accion) throw new Error('Falta la accion: que se hace distinto.');
  if (REP_DEPARTAMENTOS.indexOf(responsable) === -1) throw new Error('El responsable es un departamento: ' + REP_DEPARTAMENTOS.join(', ') + '.');
  if (!porque) throw new Error('Falta el porque, con el dato que lo respalda.');

  var candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) throw new Error('Alguien esta guardando una accion. Proba de nuevo en unos segundos.');
  try {
    medGuardarDesdeReporte_(clave, accion, responsable, porque, u);   // una sola lista: ACCIONES
  } finally { candado.releaseLock(); }
  // la pantalla vuelve a pedir el reporte: se invalida su cache
  try {
    CacheService.getScriptCache().removeAll([REP_CACHE + clave + '_' + finCacheClave_(), REP_CACHE + 'ultima_' + finCacheClave_()]);
  } catch (e) { /* no importa */ }
  return _repAcciones_(clave);
}

/** Borra una accion por su fila (solo dueño). */
function borrarAccionReporte(auth, fila) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  fila = Number(fila) || 0;
  if (fila < 2) throw new Error('Fila invalida.');
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) throw new Error('Alguien esta guardando una accion. Proba de nuevo en unos segundos.');
  var clave = 0;
  try {
    var h = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
    if (!h) throw new Error('No existe la pestaña ' + MED_ACC_HOJA_ + '.');
    var sem = String(h.getRange(fila, 1).getValue() || '');
    var m = /^(\d{4})-S(\d{2})$/.exec(sem);
    if (!m) throw new Error('Esa fila no es una accion.');
    clave = Number(m[1]) * 100 + Number(m[2]);
    // no se borra: se marca descartada, asi el tablero y el vigia ven lo mismo
    h.getRange(fila, 6).setValue('descartada');
    h.getRange(fila, 9).setValue(new Date());
    SpreadsheetApp.flush();
  } finally { candado.releaseLock(); }
  try {
    CacheService.getScriptCache().removeAll([REP_CACHE + clave + '_' + finCacheClave_(), REP_CACHE + 'ultima_' + finCacheClave_()]);
  } catch (e) { /* no importa */ }
  return _repAcciones_(clave);
}
