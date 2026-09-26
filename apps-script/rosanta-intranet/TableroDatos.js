/**
 * TableroDatos.gs — el TABLERO GLOBAL: la foto grande de los 6 pilares de Rosanta OS.
 * Solo el rol dueño. Nacio el 25-sep-2026 (catalogo en 03_Finance_Data_OS/KPIs/).
 *
 * LA REGLA QUE LO HACE FUNCIONAR: NO CALCULA NADA.
 *   Cada numero se toma tal cual del motor de su pilar:
 *     Finanzas    FinanzasDatos.gs (_finDatos_, getMetasData)   Caja  CajaDatos.gs (_cajaDatos_)
 *     Profit OS   Dashboard.gs (getProfitOS) y PuenteCmv.gs (getCmvRealTeorico)
 *     Management  InventarioDatos.gs (invEstadoCierre_)
 *     Marketing   MarketingDatos.gs (mktKpisMes_), que junta Finanzas y CrmDatos.gs
 *   Si un KPI no existe en ningun motor, se construye en el motor de su pilar, nunca
 *   aca. Lo unico que hace este archivo es (1) elegir QUE campo mostrar, (2) leer la
 *   META de PARAMETROS, (3) ponerle semaforo comparando valor contra meta y
 *   (4) poner al lado el mismo campo del mes anterior. La bateria lo vigila: cada
 *   valor del tablero tiene que ser identico al campo del motor del que sale.
 *
 * METAS: viven en Rosanta_Intranet_Config › PARAMETROS. Los defectos de abajo son
 * SOLO el ultimo recurso si la fila no existe, y la tarjeta dice "defecto" para
 * que se vea. Ninguna meta se escribe aca como si fuera la vigente.
 *
 * Una llamada por pilar (getTableroPilar) y no una sola: Profit OS tarda 20-40 s en
 * frio y no puede frenar a los otros cinco. La pantalla pide los seis en paralelo.
 *
 * AMBITO GLOBAL: todo empieza con tab / _tab. Solo LEE.
 */

var TAB_PARAMETROS = {
  meta_venta_anio:            { def: null, uso: 'K01 venta del año' },
  caja_colchon_dias:          { def: 7,    uso: 'K04 dias de caja: rojo por debajo' },
  caja_dias_verde:            { def: 21,   uso: 'K04 dias de caja: verde desde' },
  prime_cost_max_pct:         { def: 60,   uso: 'K06 prime cost: verde por debajo' },
  prime_cost_rojo_pct:        { def: 65,   uso: 'K06 prime cost: rojo por encima' },
  compra_sin_factura_max_pct: { def: null, uso: 'K09 compra sin factura, % de la compra del mes' },
  ebitda_meta_pct:            { def: 10,   uso: 'K10 EBITDA, % de la venta' },
  brecha_cmv_revisar_pts:     { def: 2,    uso: 'K12 brecha real contra teorico: revisar' },
  brecha_cmv_auditar_pts:     { def: 4,    uso: 'K12 brecha real contra teorico: auditar' },
  inventario_cierre_dia:      { def: 5,    uso: 'K03 dia limite para cerrar el mes anterior' },
  ticket_promedio_meta_q:     { def: 280,  uso: 'K14 ticket por comensal' },
  comensales_lmx_meta:        { def: 16,   uso: 'K14 comensales por dia lunes a miercoles' },
  eventos_mes_meta:           { def: 2,    uso: 'K17 eventos por mes' },
  roas_meta:                  { def: 3,    uso: 'K16 ROAS de pauta' },
  cac_max_q:                  { def: null, uso: 'K15 CAC maximo por cliente' }
};

var TAB_PILARES = ['fundamentos', 'management', 'finanzas', 'profit', 'marketing', 'expansion'];

/** Las metas, leidas UNA vez de PARAMETROS, con su origen. */
function tabParametros_() {
  var hoja = {};
  try {
    var filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'))
                  .getSheetByName('PARAMETROS').getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      var k = String(filas[i][0] || '').trim(), v = Number(filas[i][1]);
      if (k && !isNaN(v)) hoja[k] = v;
    }
  } catch (e) { /* sin config: todo queda en defecto y la pantalla lo dice */ }
  var out = {};
  Object.keys(TAB_PARAMETROS).forEach(function (k) {
    var enHoja = hoja.hasOwnProperty(k);
    out[k] = { valor: enHoja ? hoja[k] : TAB_PARAMETROS[k].def,
               origen: enHoja ? 'PARAMETROS' : (TAB_PARAMETROS[k].def === null ? 'sin meta' : 'defecto'),
               uso: TAB_PARAMETROS[k].uso };
  });
  // las de food cost salen del mismo lugar que todo el sistema
  var fc = metasFoodCost_();
  out.food_cost_objetivo_pct = { valor: fc.global, origen: 'PARAMETROS', uso: 'K11 food cost global y cocina' };
  out.food_cost_barra_pct = { valor: fc.BARRA, origen: hoja.hasOwnProperty('food_cost_barra_pct') ? 'PARAMETROS' : 'defecto',
                              uso: 'K11 food cost de barra' };
  return out;
}

/** Semaforo: 'menor' = mejor cuanto mas bajo (costo); 'mayor' = mejor cuanto mas alto. */
function tabZona_(valor, verde, rojo, sentido) {
  if (valor === null || valor === undefined || isNaN(valor)) return 'gris';
  if (verde === null || verde === undefined) return 'gris';
  if (sentido === 'menor') {
    if (valor <= verde) return 'verde';
    if (rojo !== null && rojo !== undefined && valor > rojo) return 'rojo';
    return (rojo === null || rojo === undefined) ? 'rojo' : 'amarillo';
  }
  if (valor >= verde) return 'verde';
  if (rojo !== null && rojo !== undefined && valor < rojo) return 'rojo';
  return (rojo === null || rojo === undefined) ? 'rojo' : 'amarillo';
}

/** Tendencia contra el valor anterior: diferencia y % (null si no hay con que). */
function tabTendencia_(actual, anterior, etiqueta) {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined) return null;
  var dif = Math.round((actual - anterior) * 100) / 100;
  return { anterior: anterior, dif: dif,
           pct: anterior ? Math.round((actual - anterior) / Math.abs(anterior) * 1000) / 10 : null,
           etiqueta: etiqueta || 'mes anterior' };
}

/** Una tarjeta. Todo lo que la pantalla necesita para pintar sin pensar. */
function tabKpi_(o) {
  return {
    clave: o.clave, nombre: o.nombre, valor: (o.valor === undefined) ? null : o.valor,
    unidad: o.unidad || '', periodo: o.periodo || '',
    meta: (o.meta === undefined) ? null : o.meta, meta_texto: o.meta_texto || '',
    meta_origen: o.meta_origen || '', zona: o.zona || 'gris',
    tendencia: o.tendencia || null, fuente: o.fuente || '', enlace: o.enlace || '',
    nota: o.nota || '', estado: o.estado || 'ok', detalle: o.detalle || null
  };
}

/** El ultimo mes CERRADO con venta (m < mes en curso) y el anterior a ese. */
function tabMesCerrado_(d, hoy) {
  var mHoy = hoy.getMonth() + 1, cerrados = [];
  (d.meses || []).forEach(function (x) { if (x.m < mHoy) cerrados.push(x); });
  var enCurso = null;
  (d.meses || []).forEach(function (x) { if (x.m === mHoy) enCurso = x; });
  return { ultimo: cerrados.length ? cerrados[cerrados.length - 1] : null,
           anterior: cerrados.length > 1 ? cerrados[cerrados.length - 2] : null,
           en_curso: enCurso };
}

/**
 * El tablero de UN pilar. `pilar` es una de TAB_PILARES. Cada motor va en su try:
 * si uno falla, la tarjeta lo dice y el resto del pilar sigue.
 */
function getTableroPilar(auth, pilar) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  if (TAB_PILARES.indexOf(pilar) === -1) throw new Error('Pilar desconocido: ' + pilar);
  var P = tabParametros_();
  var hoy = new Date();
  var out = { pilar: pilar, kpis: [], avisos: [], parametros: P,
              gen: Utilities.formatDate(hoy, 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
  try {
    if (pilar === 'fundamentos') _tabFundamentos_(out, P, hoy, auth);
    else if (pilar === 'management') _tabManagement_(out, P, hoy);
    else if (pilar === 'finanzas') _tabFinanzas_(out, P, hoy, auth);
    else if (pilar === 'profit') _tabProfit_(out, P, hoy, auth);
    else if (pilar === 'marketing') _tabMarketing_(out, P, hoy);
    else _tabExpansion_(out);
  } catch (e) {
    out.error = String(e && e.message || e);
  }
  return out;
}

// ------------------------------------------------------------- 01 Fundamentos
function _tabFundamentos_(out, P, hoy, auth) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var meta = P.meta_venta_anio.valor;
  // avance esperado: la parte del año transcurrida hasta la ultima venta cargada
  var ult = (d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '';
  var partes = ult.split('/');
  var diaAnio = partes.length === 3
    ? Math.round((new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0])) - new Date(d.anio, 0, 1)) / 86400000) + 1
    : null;
  var esperado = (meta && diaAnio) ? Math.round(meta * diaAnio / 365) : null;
  out.kpis.push(tabKpi_({
    clave: 'K01', nombre: 'Venta del año contra la meta del año',
    valor: d.total.ventas, unidad: 'Q', periodo: d.anio + ' al ' + ult,
    meta: meta, meta_origen: P.meta_venta_anio.origen,
    meta_texto: meta ? ('meta Q' + meta.toLocaleString('es-GT') + ' · a la fecha deberiamos llevar Q' + (esperado || 0).toLocaleString('es-GT')) : 'sin meta en PARAMETROS (meta_venta_anio)',
    zona: (meta && esperado) ? tabZona_(d.total.ventas, esperado, esperado * 0.9, 'mayor') : 'gris',
    tendencia: mc.ultimo ? tabTendencia_(mc.ultimo.ventas, mc.anterior ? mc.anterior.ventas : null, 'venta ' + mc.ultimo.mes + ' contra ' + (mc.anterior ? mc.anterior.mes : '')) : null,
    fuente: 'FinanzasDatos › total.ventas', enlace: 'finanzas&sub=comparativo',
    estado: meta ? 'ok' : 'falta_meta',
    detalle: { avance_pct: meta ? Math.round(d.total.ventas / meta * 1000) / 10 : null, esperado: esperado }
  }));
  var cj = _cajaDatos_(_cajaOpciones_({}));
  var mesCaja = (cj.meses || [])[0] || null;    // el mes en curso, en proporcion
  out.kpis.push(tabKpi_({
    clave: 'K02', nombre: 'Lo que deja la operacion contra el piso y el objetivo',
    valor: mesCaja ? mesCaja.deja : null, unidad: 'Q', periodo: mesCaja ? mesCaja.mes + (mesCaja.completo ? '' : ' (parcial, en proporcion)') : '',
    meta: mesCaja ? mesCaja.piso : cj.piso_mes, meta_origen: 'COMPROMISOS',
    meta_texto: mesCaja ? ('piso Q' + mesCaja.piso.toLocaleString('es-GT') + ' · objetivo Q' + mesCaja.objetivo.toLocaleString('es-GT')) : '',
    zona: mesCaja ? tabZona_(mesCaja.deja, mesCaja.objetivo, mesCaja.piso, 'mayor') : 'gris',
    tendencia: (cj.meses && cj.meses.length > 1) ? tabTendencia_(cj.meses[1].deja, mesCaja.deja, cj.meses[1].mes + ' proyectado') : null,
    fuente: 'CajaDatos › meses[].deja, piso, objetivo (escenario base)', enlace: 'finanzas&sub=caja',
    nota: mesCaja && mesCaja.falta_piso ? ('faltan Q' + mesCaja.falta_piso.toLocaleString('es-GT') + ' para el piso' + (mesCaja.venta_piso_pct !== null ? ' (+' + mesCaja.venta_piso_pct + '% de venta)' : '')) : 'cubre el piso',
    detalle: { piso_mes: cj.piso_mes, objetivo_mes: cj.objetivo_mes, falta_objetivo: mesCaja ? mesCaja.falta_objetivo : null }
  }));
}

// ------------------------------------------------------------- 02 Management
function _tabManagement_(out, P, hoy) {
  var inv = invEstadoCierre_(hoy, P.inventario_cierre_dia.valor);
  ['COCINA', 'BARRA'].forEach(function (area) {
    var r = inv.areas[area];
    out.kpis.push(tabKpi_({
      clave: area === 'COCINA' ? 'K03a' : 'K03b',
      nombre: 'Inventario al dia · ' + (area === 'COCINA' ? 'Cocina (Jeffry)' : 'Barra (José)'),
      valor: r.ultimo_cerrado || 'ninguno', unidad: 'mes', periodo: 'esperado ' + inv.esperado,
      meta: P.inventario_cierre_dia.valor, meta_origen: P.inventario_cierre_dia.origen,
      meta_texto: 'el mes anterior cerrado antes del dia ' + inv.dia_limite,
      zona: r.zona,
      fuente: 'InventarioDatos › invEstadoCierre_ (ESTADO de la fila 1 de cada pestaña)', enlace: 'costeo',
      nota: r.error ? r.error : (inv.esperado + ': ' + r.estado_esperado + (r.dias_atraso ? ' · ' + r.dias_atraso + ' dias despues del limite' : '')),
      estado: r.error ? 'error' : 'ok',
      detalle: { ultimo_total: r.ultimo_total, total_esperado: r.total_esperado, cerrado_por: r.cerrado_por }
    }));
  });
  out.avisos.push('Primer KPI del pilar. Los siguientes llegan con el scorecard de sala.');
}

// ------------------------------------------------------------- 03 Finanzas
function _tabFinanzas_(out, P, hoy, auth) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var u = d.ultima || {};
  var fechaBanco = (d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']) || '';
  // K04 dias de caja: el primer numero del tablero
  out.kpis.push(tabKpi_({
    clave: 'K04', nombre: 'Dias de caja', valor: d.dias_caja, unidad: 'dias',
    periodo: 'banco al ' + fechaBanco,
    meta: P.caja_colchon_dias.valor, meta_origen: P.caja_colchon_dias.origen,
    meta_texto: 'colchon ' + P.caja_colchon_dias.valor + ' dias · verde desde ' + P.caja_dias_verde.valor,
    zona: tabZona_(d.dias_caja, P.caja_dias_verde.valor, P.caja_colchon_dias.valor, 'mayor'),
    tendencia: null,
    fuente: 'FinanzasDatos › dias_caja = caja ÷ gasto_dia', enlace: 'finanzas&sub=caja',
    nota: 'Q' + Number(d.caja || 0).toLocaleString('es-GT') + ' en bancos · Q' + Number(d.gasto_dia || 0).toLocaleString('es-GT') + ' de gasto por dia',
    detalle: { caja: d.caja, gasto_dia: d.gasto_dia }
  }));
  // K05 venta del mes contra su meta (Metas)
  var mt = null;
  try { mt = getMetasData(auth, false); } catch (e) { out.avisos.push('Metas: ' + String(e && e.message || e)); }
  if (mt && !mt.error) {
    out.kpis.push(tabKpi_({
      clave: 'K05', nombre: 'Venta del mes contra su meta',
      valor: mt.acumulado, unidad: 'Q', periodo: mt.mes + ' · dia ' + mt.dias.corridos + ' de ' + mt.dias.total,
      meta: mt.meta ? mt.meta.venta : null, meta_origen: mt.meta ? (mt.meta.automatica ? 'automatica (sin pestaña METAS)' : 'METAS') : 'sin meta',
      meta_texto: mt.meta ? ('meta Q' + Number(mt.meta.venta).toLocaleString('es-GT') + ' · ' + (mt.meta.origen || '')) : '',
      zona: (mt.meta && mt.esperado !== undefined) ? tabZona_(mt.acumulado, mt.esperado, mt.esperado * 0.9, 'mayor') : 'gris',
      tendencia: mc.ultimo ? tabTendencia_(mt.proyeccion, mc.ultimo.ventas, 'proyeccion contra ' + mc.ultimo.mes) : null,
      fuente: 'FinanzasDatos › getMetasData (acumulado, meta, proyeccion)', enlace: 'finanzas&sub=metas',
      nota: mt.meta ? ('avance ' + mt.avance + '% · proyeccion Q' + Number(mt.proyeccion || 0).toLocaleString('es-GT') + ' (' + mt.proyeccion_pct + '%)') : 'sin meta',
      estado: mt.meta ? 'ok' : 'falta_meta'
    }));
  }
  // K06 prime cost movil 4
  out.kpis.push(tabKpi_({
    clave: 'K06', nombre: 'Prime cost (movil 4)', valor: u.prime_m4, unidad: '%',
    periodo: 'S' + u.w + ' · ' + u.ini + ' al ' + u.fin,
    meta: P.prime_cost_max_pct.valor, meta_origen: P.prime_cost_max_pct.origen,
    meta_texto: 'verde bajo ' + P.prime_cost_max_pct.valor + ' · rojo sobre ' + P.prime_cost_rojo_pct.valor,
    zona: tabZona_(u.prime_m4, P.prime_cost_max_pct.valor, P.prime_cost_rojo_pct.valor, 'menor'),
    tendencia: mc.ultimo ? tabTendencia_(mc.ultimo.primep, mc.anterior ? mc.anterior.primep : null, mc.ultimo.mes + ' contra ' + (mc.anterior ? mc.anterior.mes : '') + ' (mes)') : null,
    fuente: 'FinanzasDatos › semanas[].prime_m4', enlace: 'finanzas&sub=semana',
    nota: 'año ' + d.total.primep + '%'
  }));
  // K07 resultado neto del mes cerrado
  if (mc.ultimo) {
    out.kpis.push(tabKpi_({
      clave: 'K07', nombre: 'Resultado neto del mes', valor: mc.ultimo.neto, unidad: 'Q',
      periodo: mc.ultimo.mes + (mc.ultimo.devengado ? '' : ' (planilla estimada)'),
      meta: 0, meta_origen: 'regla', meta_texto: 'verde desde cero · referencia del sector 10-15%',
      zona: tabZona_(mc.ultimo.neto, 0, 0, 'mayor'),
      tendencia: tabTendencia_(mc.ultimo.neto, mc.anterior ? mc.anterior.neto : null),
      fuente: 'FinanzasDatos › meses[].neto', enlace: 'finanzas&sub=comparativo',
      nota: mc.ultimo.netop + '% de la venta · año Q' + Number(d.total.neto).toLocaleString('es-GT') + ' (' + d.total.netop + '%)'
    }));
  }
  // K08 comision de tarjeta: falta el dato
  out.kpis.push(tabKpi_({
    clave: 'K08', nombre: 'Comision de tarjeta, medida', valor: null, unidad: '%',
    zona: 'gris', estado: 'falta_dato',
    fuente: 'depositos INGRESO_TARJETA del maestro (netos) contra la venta bruta con tarjeta',
    nota: 'FALTA DATO: la venta bruta cobrada con tarjeta. El maestro trae los depositos ya netos (VISANET, AFI LIQ) y el banco no separa la comision.'
  }));
  // K09 compra sin factura del mes cerrado
  if (mc.ultimo) {
    var pctSF = mc.ultimo.cogs ? Math.round(mc.ultimo.sin_factura / mc.ultimo.cogs * 1000) / 10 : null;
    out.kpis.push(tabKpi_({
      clave: 'K09', nombre: 'Compra sin factura', valor: mc.ultimo.sin_factura, unidad: 'Q',
      periodo: mc.ultimo.mes,
      meta: P.compra_sin_factura_max_pct.valor, meta_origen: P.compra_sin_factura_max_pct.origen,
      meta_texto: P.compra_sin_factura_max_pct.valor ? ('maximo ' + P.compra_sin_factura_max_pct.valor + '% de la compra') : 'sin meta en PARAMETROS (compra_sin_factura_max_pct)',
      zona: P.compra_sin_factura_max_pct.valor ? tabZona_(pctSF, P.compra_sin_factura_max_pct.valor, P.compra_sin_factura_max_pct.valor * 1.5, 'menor') : 'gris',
      tendencia: tabTendencia_(mc.ultimo.sin_factura, mc.anterior ? mc.anterior.sin_factura : null),
      fuente: 'FinanzasDatos › meses[].sin_factura (bancos, categorias _EFECTIVO)', enlace: 'finanzas&sub=gasto',
      nota: (pctSF !== null ? pctSF + '% de la compra del mes · ' : '') + 'IVA que no se recupera: Q' + Number(mc.ultimo.sin_factura_iva || 0).toLocaleString('es-GT') + ' · año Q' + Number(d.total.sin_factura || 0).toLocaleString('es-GT'),
      estado: P.compra_sin_factura_max_pct.valor ? 'ok' : 'falta_meta',
      detalle: { pct_compra: pctSF, iva: mc.ultimo.sin_factura_iva }
    }));
    // K10 EBITDA del mes cerrado
    out.kpis.push(tabKpi_({
      clave: 'K10', nombre: 'EBITDA del mes', valor: mc.ultimo.ebitda, unidad: 'Q', periodo: mc.ultimo.mes,
      meta: P.ebitda_meta_pct.valor, meta_origen: P.ebitda_meta_pct.origen,
      meta_texto: 'meta ' + P.ebitda_meta_pct.valor + '% de la venta',
      zona: tabZona_(mc.ultimo.ebitdap, P.ebitda_meta_pct.valor, 0, 'mayor'),
      tendencia: tabTendencia_(mc.ultimo.ebitda, mc.anterior ? mc.anterior.ebitda : null),
      fuente: 'FinanzasDatos › meses[].ebitda = neto + Impuestos + venta de eventos', enlace: 'finanzas&sub=comparativo',
      nota: mc.ultimo.ebitdap + '% de la venta · año Q' + Number(d.total.ebitda || 0).toLocaleString('es-GT') + ' (' + d.total.ebitdap + '%)',
      detalle: { imp: mc.ultimo.imp, eventos: mc.ultimo.eventos, neto: mc.ultimo.neto }
    }));
  }
}

// ------------------------------------------------------------- 04 Profit OS
function _tabProfit_(out, P, hoy, auth) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var u = d.ultima || {};
  // K11 food cost real (movil 4) contra la meta; el teorico por area viene de Profit OS
  var teo = null;
  try {
    var po = getProfitOS(auth, 13);
    teo = po && po.tablero && po.tablero.ok ? po.tablero : null;
  } catch (e) { out.avisos.push('Profit OS: ' + String(e && e.message || e)); }
  out.kpis.push(tabKpi_({
    clave: 'K11', nombre: 'Food cost real (movil 4) contra la meta', valor: u.cogs_m4, unidad: '%',
    periodo: 'S' + u.w + ' · sobre venta sin servicio',
    meta: d.meta_cogs, meta_origen: 'PARAMETROS', meta_texto: 'meta ' + d.meta_cogs + '% · cocina ' + P.food_cost_objetivo_pct.valor + ' · barra ' + P.food_cost_barra_pct.valor,
    zona: tabZona_(u.cogs_m4, d.meta_cogs, d.meta_cogs + 3, 'menor'),
    tendencia: mc.ultimo ? tabTendencia_(mc.ultimo.cogsp, mc.anterior ? mc.anterior.cogsp : null, mc.ultimo.mes + ' contra ' + (mc.anterior ? mc.anterior.mes : '') + ' (mes)') : null,
    fuente: 'FinanzasDatos › semanas[].cogs_m4 · Dashboard › cmv (teorico 13 semanas)', enlace: 'costeo',
    nota: teo ? ('teorico 13 semanas: global ' + Math.round(teo.cmv.global * 1000) / 10 + '% · cocina ' + Math.round(teo.cmv.cocina.cmv * 1000) / 10 + '% · barra ' + Math.round(teo.cmv.barra.cmv * 1000) / 10 + '%') : 'teorico de Profit OS no disponible',
    detalle: teo ? { teorico_global: teo.cmv.global, teorico_cocina: teo.cmv.cocina.cmv, teorico_barra: teo.cmv.barra.cmv, ciego_pct: teo.ciego.pctVenta } : null
  }));
  // K12 brecha real contra teorico
  var rt = null;
  try { rt = getCmvRealTeorico(auth); } catch (e2) { out.avisos.push('Puente CMV: ' + String(e2 && e2.message || e2)); }
  var b = rt && rt.ok ? rt.bloque : null;
  out.kpis.push(tabKpi_({
    clave: 'K12', nombre: 'Brecha CMV real contra teorico', valor: b ? b.brecha_pts : null, unidad: 'pts',
    periodo: b ? (b.desde + ' a ' + b.hasta + ' (' + b.meses + ' meses cerrados)') : '',
    meta: P.brecha_cmv_revisar_pts.valor, meta_origen: P.brecha_cmv_revisar_pts.origen,
    meta_texto: 'hasta ' + P.brecha_cmv_revisar_pts.valor + ' normal · hasta ' + P.brecha_cmv_auditar_pts.valor + ' revisar porcionado · mas: auditar recepcion, almacen y porciones',
    zona: b ? tabZona_(b.brecha_pts, P.brecha_cmv_revisar_pts.valor, P.brecha_cmv_auditar_pts.valor, 'menor') : 'gris',
    fuente: 'PuenteCmv › getCmvRealTeorico().bloque.brecha_pts', enlace: 'costeo',
    nota: b ? ('real ' + b.real_pct + '% · teorico ' + b.teorico_pct + '%' + (b.inv_cocina ? '' : ' · cocina sin inventario en el bloque: real sin ajustar') + (b.inv_barra ? '' : ' · barra sin inventario')) : (rt && rt.error ? rt.error : 'sin dato'),
    estado: b ? 'ok' : 'falta_dato',
    detalle: b ? { real_q: b.real, teorico_q: b.teorico, brecha_q: b.brecha_q, inv_cocina: b.inv_cocina, inv_barra: b.inv_barra } : null
  }));
  // K13 margen bruto por comensal
  if (mc.ultimo) {
    out.kpis.push(tabKpi_({
      clave: 'K13', nombre: 'Margen bruto por comensal', valor: mc.ultimo.mb_comensal, unidad: 'Q',
      periodo: mc.ultimo.mes + ' · ' + mc.ultimo.com + ' comensales',
      meta: null, meta_origen: 'sin meta', meta_texto: 'medir 3 meses antes de fijar meta',
      zona: 'gris',
      tendencia: tabTendencia_(mc.ultimo.mb_comensal, mc.anterior ? mc.anterior.mb_comensal : null),
      fuente: 'FinanzasDatos › meses[].mb_comensal = (venta sin servicio − COGS) ÷ comensales', enlace: 'finanzas&sub=comparativo',
      estado: 'falta_meta'
    }));
    // K14 ticket promedio y comensales lunes a miercoles
    out.kpis.push(tabKpi_({
      clave: 'K14a', nombre: 'Ticket por comensal', valor: u.tp, unidad: 'Q', periodo: 'S' + u.w,
      meta: P.ticket_promedio_meta_q.valor, meta_origen: P.ticket_promedio_meta_q.origen,
      meta_texto: 'meta Q' + P.ticket_promedio_meta_q.valor,
      zona: tabZona_(u.tp, P.ticket_promedio_meta_q.valor, P.ticket_promedio_meta_q.valor * 0.9, 'mayor'),
      tendencia: tabTendencia_(u.tp, u.tp - (u.dtp || 0), 'semana anterior'),
      fuente: 'FinanzasDatos › semanas[].tp', enlace: 'finanzas&sub=semana'
    }));
    out.kpis.push(tabKpi_({
      clave: 'K14b', nombre: 'Comensales por dia, lunes a miercoles', valor: mc.ultimo.com_lmx_dia, unidad: 'comensales/dia',
      periodo: mc.ultimo.mes + ' · ' + mc.ultimo.com_lmx_dias + ' dias',
      meta: P.comensales_lmx_meta.valor, meta_origen: P.comensales_lmx_meta.origen,
      meta_texto: 'meta ' + P.comensales_lmx_meta.valor + ' por dia',
      zona: tabZona_(mc.ultimo.com_lmx_dia, P.comensales_lmx_meta.valor, P.comensales_lmx_meta.valor * 0.75, 'mayor'),
      tendencia: tabTendencia_(mc.ultimo.com_lmx_dia, mc.anterior ? mc.anterior.com_lmx_dia : null),
      fuente: 'FinanzasDatos › meses[].com_lmx_dia', enlace: 'finanzas&sub=comparativo'
    }));
  }
}

// ------------------------------------------------------------- 05 Marketing
function _tabMarketing_(out, P, hoy) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var k = mktKpisMes_(d.anio, d);
  if (k.altas_error) out.avisos.push('CRM: ' + k.altas_error);
  var M = mc.ultimo ? k.meses[mc.ultimo.m] : null, A = mc.anterior ? k.meses[mc.anterior.m] : null;
  if (M) {
    var lect = M.lectura;
    out.kpis.push(tabKpi_({
      clave: 'K15', nombre: 'CAC mensual', valor: M.publicable ? M.cac : null, unidad: 'Q/cliente',
      periodo: M.mes + ' · Q' + Number(M.medios || 0).toLocaleString('es-GT') + ' de medios ÷ ' + (M.altas === null ? '?' : M.altas) + ' clientes que visitaron',
      meta: P.cac_max_q.valor, meta_origen: P.cac_max_q.origen,
      meta_texto: P.cac_max_q.valor ? ('maximo Q' + P.cac_max_q.valor) : 'sin meta: medir 3 meses (cac_max_q)',
      zona: (M.publicable && P.cac_max_q.valor) ? tabZona_(M.cac, P.cac_max_q.valor, P.cac_max_q.valor * 1.5, 'menor') : 'gris',
      tendencia: (A && A.publicable && M.publicable) ? tabTendencia_(M.cac, A.cac) : null,
      fuente: 'MarketingDatos › mktKpisMes_ (medios de Finanzas ÷ altas "Cliente que visitó" del CRM)', enlace: 'marketing&sub=crm',
      nota: lect === null ? 'sin altas en el CRM ese mes'
          : ('lectura ' + lect + '%' + (M.comparable ? ' · comparable' : (M.publicable ? ' · inflado: publicar con aviso' : ' · bajo 50%: no se publica'))),
      estado: M.publicable ? (P.cac_max_q.valor ? 'ok' : 'falta_meta') : 'falta_dato',
      detalle: { medios: M.medios, altas: M.altas, historicas: M.historicas, lectura: lect, cac_crudo: M.cac }
    }));
    out.kpis.push(tabKpi_({
      clave: 'K16', nombre: 'ROAS de pauta (estimado)', valor: M.roas, unidad: 'x',
      periodo: M.mes + ' · ' + M.roas_semanas + ' semanas de pauta_semanal',
      meta: P.roas_meta.valor, meta_origen: P.roas_meta.origen, meta_texto: 'meta ' + P.roas_meta.valor + 'x',
      zona: M.roas === null ? 'gris' : tabZona_(M.roas, P.roas_meta.valor, 1, 'mayor'),
      tendencia: (A && A.roas !== null) ? tabTendencia_(M.roas, A.roas) : null,
      fuente: 'MarketingDatos › mktKpisMes_ (comensales × ticket de pauta_semanal ÷ medios)', enlace: 'marketing',
      nota: 'proxy blended hasta que Wix mande el consumo por reserva (p163)',
      estado: M.roas === null ? 'falta_dato' : 'ok'
    }));
    out.kpis.push(tabKpi_({
      clave: 'K17', nombre: 'Eventos por mes', valor: M.eventos_n, unidad: 'eventos', periodo: M.mes,
      meta: P.eventos_mes_meta.valor, meta_origen: P.eventos_mes_meta.origen, meta_texto: 'meta ' + P.eventos_mes_meta.valor + ' al mes',
      zona: tabZona_(M.eventos_n, P.eventos_mes_meta.valor, 0, 'mayor'),
      tendencia: A ? tabTendencia_(M.eventos_n, A.eventos_n) : null,
      fuente: 'FinanzasDatos › meses[].eventos_n', enlace: 'finanzas&sub=comparativo',
      nota: 'venta de eventos Q' + Number(M.eventos_q || 0).toLocaleString('es-GT')
    }));
  }
  out.kpis.push(tabKpi_({
    clave: 'K18', nombre: 'Reseñas', valor: null, unidad: '★', zona: 'gris', estado: 'falta_dato',
    fuente: 'bot de reseñas de Google (hoja propia) · TripAdvisor a mano',
    nota: 'FALTA FUENTE: conectar la hoja del bot de Google (RESENAS_SHEET_ID) y una pestaña RESENAS_TA para TripAdvisor.'
  }));
  out.kpis.push(tabKpi_({
    clave: 'K19', nombre: 'Clientes que vuelven en 90 dias', valor: null, unidad: '%', zona: 'gris', estado: 'falta_dato',
    fuente: 'CRM (fecha_alta, ultima_reserva, gasto)',
    nota: 'FALTA DATO: depende del webhook de cierre de reserva de Wix (p163).'
  }));
}

// ------------------------------------------------------------- 06 Expansion
function _tabExpansion_(out) {
  out.texto = 'Este pilar se activa cuando los pilares 1 a 5 esten solidos. Regla del metodo: no se ' +
              'mide expansion mientras la caja no tenga colchon, el food cost no este en meta y el ' +
              'inventario no cierre a tiempo.';
}

// ------------------------------------------------------------- documentos
/**
 * Los DOCUMENTOS que el tablero muestra tal cual, sin recalcular nada (pedido de
 * Juanma, 25-sep-2026):
 *   · el reporte semanal de operacion: Rosanta_SXX_2026.pdf, uno por carpeta SXX de
 *     Reportes 2026 (regla de Juanma: si un reporte no esta en la carpeta de su semana,
 *     no existe). Lo genera la tarea rosanta-reporte-semanal cada lunes.
 *   · el plan mensual de Meta Ads: Plan_Meta_Ads_<Mes>_<Año>_Vanessa.docx en el
 *     Workspace de Marketing OS. Lo deja la auditoria mensual (dia 3).
 * Se listan con el servicio avanzado Drive v3 (drivesListar_, VentasPorProducto.gs),
 * que es lo unico que funciona en esas carpetas. Solo LEE.
 */
var TAB_DOCS = {
  reportes: { carpeta: '1PlWKHpl40qPIGkyF3Ej9rrDjHZFQ4SYP', patron: /^Rosanta_S(\d{2})_(\d{4})\.pdf$/i },   // Reportes 2026
  planes:   { carpeta: '18T6Ik4MJ8DroQGBdiYEM56hHHVkF0Skj', patron: /^Plan_Meta_Ads_(.+)\.docx$/i },      // Workspace_Marketing OS
  cacheSegs: 10 * 60
};

function getTableroDocumentos(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var cache = CacheService.getScriptCache(), k = 'tab_docs_v1';
  var g = cache.get(k);
  if (g) { try { return JSON.parse(g); } catch (e) { /* se recalcula */ } }
  var out = { reportes: [], planes: [], avisos: [],
              gen: Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
  try {
    // las subcarpetas SXX, y adentro el PDF de esa semana
    drivesListar_("'" + TAB_DOCS.reportes.carpeta + "' in parents and trashed = false").forEach(function (f) {
      if (f.mimeType !== 'application/vnd.google-apps.folder' || !/^S\d{2}$/i.test(String(f.name))) return;
      drivesListar_("'" + f.id + "' in parents and trashed = false").forEach(function (p) {
        var m = TAB_DOCS.reportes.patron.exec(String(p.name));
        if (!m) return;
        out.reportes.push({ id: p.id, nombre: p.name, semana: Number(m[1]), anio: Number(m[2]),
                            carpeta: f.name, modificado: String(p.modifiedTime || '').slice(0, 10),
                            url: 'https://drive.google.com/file/d/' + p.id + '/view',
                            preview: 'https://drive.google.com/file/d/' + p.id + '/preview' });
      });
    });
    out.reportes.sort(function (a, b) { return (b.anio - a.anio) || (b.semana - a.semana); });
  } catch (e) { out.avisos.push('Reportes semanales: ' + String(e && e.message || e)); }
  try {
    drivesListar_("'" + TAB_DOCS.planes.carpeta + "' in parents and trashed = false").forEach(function (p) {
      var m = TAB_DOCS.planes.patron.exec(String(p.name));
      if (!m) return;
      out.planes.push({ id: p.id, nombre: p.name, titulo: m[1].replace(/_/g, ' '),
                        modificado: String(p.modifiedTime || '').slice(0, 10),
                        url: 'https://drive.google.com/file/d/' + p.id + '/view' });
    });
    out.planes.sort(function (a, b) { return a.modificado < b.modificado ? 1 : -1; });
  } catch (e2) { out.avisos.push('Planes de Meta Ads: ' + String(e2 && e2.message || e2)); }
  try { cache.put(k, JSON.stringify(out), TAB_DOCS.cacheSegs); } catch (e3) { /* no importa */ }
  return out;
}
