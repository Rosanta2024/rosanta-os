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
  cac_max_q:                  { def: null, uso: 'K15 CAC maximo por cliente' },
  // Sistema de Medicion (27-sep-2026). Las que cambian por mes viven en METAS;
  // estas son el respaldo cuando el mes no tiene fila.
  eventos_mes_meta_q:         { def: null, uso: 'K17 eventos del mes en quetzales' },
  clientes_nuevos_mes_meta:   { def: null, uso: 'K24 clientes nuevos del mes' },
  resenas_semana_meta:        { def: null, uso: 'K18 reseñas nuevas por semana' },
  lectura_wix_meta_pct:       { def: null, uso: 'K20 lectura de Wix (mesas cerradas)' },
  repeticion_meta_pct:        { def: null, uso: 'K19 repeticion' }
};

var TAB_PILARES = ['fundamentos', 'management', 'finanzas', 'profit', 'marketing', 'expansion', 'metas'];

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
    else if (pilar === 'expansion') _tabExpansion_(out, P, hoy);
    else _tabMetas_(out, P, hoy);
  } catch (e) {
    out.error = String(e && e.message || e);
  }
  // Sistema de Medicion: las acciones de la semana van dentro de la lectura del pilar
  if (out.lectura) {
    try { out.lectura.acciones = medAcciones_(pilar); } catch (e2) { out.lectura.acciones = []; out.avisos.push('Acciones: ' + String(e2 && e2.message || e2)); }
    out.lectura.puede_escribir = true;
    out.lectura.equipo = MED_EQUIPO_;
  }
  return out;
}

// ------------------------------------------------------------- 01 Cascada
/*
 * Sistema de Medicion (27-sep-2026): la pestaña 01 dejo de ser "Fundamentos" y es la
 * portada del sistema. Arriba la higiene de datos, despues el N1 (lo que deja la
 * operacion y la venta del mes contra su meta), despues el numero de cada pilar. Sigue
 * sin calcular: medCascadaResumen_ junta campos de Caja, Finanzas, CRM e Inventario.
 * La clave interna sigue siendo 'fundamentos' para no romper enlaces ni pruebas.
 */
function _tabFundamentos_(out, P, hoy, auth) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var c = medCascadaResumen_(d, P, M, hoy);
  var cur = mc.en_curso || {};
  var ul = d.ultima || {};
  out.metas_mes = M;
  out.cascada = c;
  if (!M.hay_fila) out.avisos.push('No hay fila de ' + M.mes + ' en METAS: las metas del mes salen de PARAMETROS o no existen. Instalarlas en la pestaña "Metas y ajustes".');
  if (c.caja_error) out.avisos.push('Caja: ' + c.caja_error);

  // K02 lo que deja la operacion (N1)
  out.kpis.push(tabKpi_({
    clave: 'N1', nombre: 'Lo que deja la operacion contra el piso',
    valor: c.deja, unidad: 'Q', periodo: c.deja_periodo || '',
    meta: c.piso, meta_origen: 'COMPROMISOS',
    meta_texto: 'piso Q' + Math.round(c.piso_mes || 0).toLocaleString('es-GT') + ' · objetivo Q' + Math.round(c.objetivo_mes || 0).toLocaleString('es-GT'),
    zona: c.deja_zona, fuente: 'CajaDatos › meses[0].deja (escenario base)', enlace: 'finanzas&sub=caja',
    nota: c.falta_piso ? ('faltan Q' + Math.round(c.falta_piso).toLocaleString('es-GT') + ' para el piso' + (c.venta_piso_pct !== null && c.venta_piso_pct !== undefined ? ' (+' + c.venta_piso_pct + '% de venta)' : '')) : 'cubre el piso'
  }));
  // venta del mes, restaurante + eventos (N1)
  out.kpis.push(tabKpi_({
    clave: 'N1', nombre: 'Venta del mes, restaurante + eventos (proyeccion)',
    valor: c.venta_proy, unidad: 'Q', periodo: M.mes + (c.dia_corte ? ' · dia ' + c.dia_corte + ' de ' + c.dias_mes : ' · sin venta cargada'),
    meta: M.venta_total, meta_origen: M.venta_rest.origen,
    meta_texto: M.venta_total ? ('meta Q' + M.venta_total.toLocaleString('es-GT') + ' (restaurante Q' + M.venta_rest.valor.toLocaleString('es-GT') + ' + eventos Q' + (M.eventos.valor || 0).toLocaleString('es-GT') + ')' + (M.minimo.valor ? ' · minimo Q' + M.minimo.valor.toLocaleString('es-GT') : '')) : 'sin meta en METAS',
    zona: c.venta_zona, fuente: 'FinanzasDatos › meses[].ventas + eventos · METAS', enlace: 'finanzas&sub=metas',
    nota: 'acumulado Q' + Math.round(c.venta_acum).toLocaleString('es-GT') + (c.venta_eventos ? ' (eventos Q' + Math.round(c.venta_eventos).toLocaleString('es-GT') + ')' : '') +
          (c.venta_esperada ? ' · a la fecha la meta pide Q' + c.venta_esperada.toLocaleString('es-GT') : ''),
    estado: M.venta_total ? 'ok' : 'falta_meta'
  }));
  // los cuatro numeros de pilar
  out.pilares = [
    tabKpi_({ clave: '03 · Juanma', nombre: 'Días de caja', valor: d.dias_caja, unidad: 'dias',
      periodo: 'banco al ' + ((d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']) || '?'),
      meta: M.dias_caja.valor, meta_origen: M.dias_caja.origen, meta_texto: 'meta del mes ≥' + M.dias_caja.valor + ' · rojo bajo 3',
      zona: tabZona_(d.dias_caja, M.dias_caja.valor, 3, 'mayor'), enlace: 'finanzas&sub=caja', fuente: 'FinanzasDatos › dias_caja' }),
    tabKpi_({ clave: '05 · Juanma', nombre: 'Comensales del mes (ritmo)', valor: c.com_ritmo, unidad: 'comensales',
      periodo: M.mes + (mc.ultimo ? ' · ' + mc.ultimo.mes + ' cerro en ' + (mc.ultimo.com_est || '?') : ''),
      meta: M.comensales, meta_origen: M.venta_rest.origen,
      meta_texto: M.comensales ? ('meta ' + M.comensales + ' = Q' + M.venta_rest.valor.toLocaleString('es-GT') + ' ÷ Q' + M.ticket.valor) : 'sin meta',
      zona: c.com_zona, enlace: 'finanzas&sub=metas', fuente: 'FinanzasDatos › meses[].com_est = venta ÷ ticket' }),
    tabKpi_({ clave: '02 · José', nombre: 'Ticket por comensal (sin IVA)', valor: cur.tp || null, unidad: 'Q',
      periodo: M.mes + (mc.ultimo && mc.ultimo.tp ? ' · ' + mc.ultimo.mes + ' Q' + Math.round(mc.ultimo.tp) : ''),
      meta: M.ticket.valor, meta_origen: M.ticket.origen, meta_texto: 'meta Q' + M.ticket.valor + ' · rojo bajo Q' + Math.round(M.ticket.valor * 0.94),
      zona: tabZona_(cur.tp, M.ticket.valor, M.ticket.valor * 0.94, 'mayor'), enlace: 'finanzas&sub=semana', fuente: 'FinanzasDatos › meses[].tp' }),
    tabKpi_({ clave: '04 · Jeffry', nombre: 'Food cost real (móvil 4)', valor: ul.cogs_m4, unidad: '%',
      periodo: 'S' + ul.w, meta: M.food.valor, meta_origen: M.food.origen,
      meta_texto: M.food.valor ? ('tramo del mes ≤' + M.food.valor + '% · meta final ' + d.meta_cogs + '%') : ('meta ' + d.meta_cogs + '%'),
      zona: tabZona_(ul.cogs_m4, M.food.valor || d.meta_cogs, (M.food.valor || d.meta_cogs) + 3, 'menor'), enlace: 'costeo', fuente: 'FinanzasDatos › semanas[].cogs_m4' })
  ];
  out.pilares.forEach(function (k) { out.kpis.push(k); });
  // K01 venta del año contra la meta del año (contexto)
  var meta = P.meta_venta_anio.valor;
  var partes = String((d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '').split('/');
  var diaAnio = partes.length === 3
    ? Math.round((new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0])) - new Date(d.anio, 0, 1)) / 86400000) + 1 : null;
  var esperado = (meta && diaAnio) ? Math.round(meta * diaAnio / 365) : null;
  var anioTotal = d.total.ventas + (d.meses || []).reduce(function (a, x) { return a + (x.eventos || 0); }, 0);
  out.k01 = tabKpi_({
    clave: 'K01', nombre: 'Venta del año con eventos contra la meta del año', valor: Math.round(anioTotal), unidad: 'Q',
    periodo: d.anio, meta: meta, meta_origen: P.meta_venta_anio.origen,
    meta_texto: meta ? ('meta Q' + meta.toLocaleString('es-GT') + ' · a la fecha Q' + (esperado || 0).toLocaleString('es-GT')) : 'sin meta',
    zona: (meta && esperado) ? tabZona_(anioTotal, esperado, esperado * 0.9, 'mayor') : 'gris',
    fuente: 'FinanzasDatos › total.ventas + meses[].eventos', enlace: 'finanzas&sub=comparativo'
  });
  out.lectura = medLecturaFundamentos_(out, d, M, c, hoy);
  // La Vision ya no se repite en la Cascada (limpieza del 28-sep-2026): vive en el panel principal.
}

// ------------------------------------------------------------- 02 Management
/* Sistema de Medicion: el numero de sala es el ticket (José). Recibe ticket y lunes a
   miercoles desde Profit; los inventarios se mudaron a 04 Profit. */
function _tabManagement_(out, P, hoy) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var cur = mc.en_curso || {}, ult = mc.ultimo || {};
  out.kpis.push(tabKpi_({
    clave: 'K14a', nombre: 'Ticket por comensal (sin IVA) · José', valor: cur.tp || null, unidad: 'Q', periodo: M.mes + ' en curso',
    meta: M.ticket.valor, meta_origen: M.ticket.origen, meta_texto: 'meta Q' + M.ticket.valor + ' · rojo bajo Q' + Math.round(M.ticket.valor * 0.94),
    zona: tabZona_(cur.tp, M.ticket.valor, M.ticket.valor * 0.94, 'mayor'),
    tendencia: ult.tp ? tabTendencia_(cur.tp, ult.tp, ult.mes) : null,
    fuente: 'FinanzasDatos › meses[].tp (solo tickets con comensales)', enlace: 'finanzas&sub=semana',
    nota: 'Corregido el 27-sep: la venta de tickets sin comensales cargados ya no infla el ticket.'
  }));
  var lmx = cur.com_lmx_dia !== undefined && cur.com_lmx_dia !== null ? cur : ult;
  out.kpis.push(tabKpi_({
    clave: 'K14b', nombre: 'Comensales por dia, lunes a miercoles · José', valor: lmx.com_lmx_dia, unidad: 'comensales/dia',
    periodo: (lmx.mes || '') + ' · ' + (lmx.com_lmx_dias || 0) + ' dias',
    meta: M.lmx.valor, meta_origen: M.lmx.origen, meta_texto: 'meta ' + M.lmx.valor + ' por dia',
    zona: tabZona_(lmx.com_lmx_dia, M.lmx.valor, M.lmx.valor * 0.85, 'mayor'),
    tendencia: (lmx === cur && ult.com_lmx_dia) ? tabTendencia_(cur.com_lmx_dia, ult.com_lmx_dia, ult.mes) : null,
    fuente: 'FinanzasDatos › meses[].com_lmx_dia', enlace: 'finanzas&sub=comparativo'
  }));
  out.kpis.push(tabKpi_({
    clave: 'K21', nombre: 'Venta de lunes a miercoles · José', valor: cur.venta_lmx || null, unidad: 'Q', periodo: M.mes + ' en curso',
    meta: null, meta_origen: 'sin meta', meta_texto: 'se mide en octubre; meta desde noviembre',
    zona: 'gris', tendencia: ult.venta_lmx ? tabTendencia_(cur.venta_lmx, ult.venta_lmx, ult.mes + ' completo') : null,
    fuente: 'FinanzasDatos › meses[].venta_lmx', enlace: 'finanzas&sub=comparativo', estado: 'falta_meta'
  }));
  var lect = null, lectMes = '';
  try {
    var k = mktKpisMes_(d.anio, d);
    var km = k.meses[hoy.getMonth() + 1] || (mc.ultimo ? k.meses[mc.ultimo.m] : null);
    if (km) { lect = km.lectura; lectMes = km.mes; }
  } catch (e) { out.avisos.push('CRM: ' + String(e && e.message || e)); }
  out.kpis.push(tabKpi_({
    clave: 'K20', nombre: 'Lectura de Wix: mesas cerradas · José', valor: lect, unidad: '%', periodo: lectMes,
    meta: M.lectura.valor, meta_origen: M.lectura.origen, meta_texto: 'meta ' + M.lectura.valor + '% · bajo 50% no hay CAC',
    zona: tabZona_(lect, M.lectura.valor, 50, 'mayor'),
    fuente: 'CrmDatos › crmAltasPorMes_ (Cliente que visitó ÷ visitó + histórica)', enlace: 'marketing&sub=crm',
    nota: 'Seated al sentar la mesa, consumo al terminar. La lista de mesas por cerrar llega los lunes por correo.',
    estado: lect === null ? 'falta_dato' : 'ok'
  }));
  var rs = null;
  try { rs = medResenas_(hoy); } catch (e2) { out.avisos.push('Reseñas: ' + String(e2 && e2.message || e2)); }
  out.kpis.push(tabKpi_({
    clave: 'K18', nombre: 'Reseñas nuevas en Google, semana pasada · José', valor: rs ? rs.semana_pasada : null, unidad: 'reseñas',
    periodo: rs ? ('esta semana van ' + rs.esta_semana) : '',
    meta: M.resenas.valor, meta_origen: M.resenas.origen, meta_texto: 'meta ' + M.resenas.valor + ' por semana · rojo bajo ' + Math.max(M.resenas.valor - 1, 1),
    zona: rs ? tabZona_(rs.semana_pasada, M.resenas.valor, Math.max(M.resenas.valor - 1, 1), 'mayor') : 'gris',
    fuente: 'hoja del bot de reseñas de Google (Rosanta - Control de Reseñas GBP › Reseñas)',
    nota: rs ? ('promedio de las ultimas 4 semanas: ' + rs.prom_4 + ' por semana' + (rs.estrellas_4 !== null ? ' · ' + rs.estrellas_4 + '★' : '') + '. No cuenta la carga inicial del bot (' + rs.carga_inicial + ').') : 'sin dato',
    estado: rs ? 'ok' : 'falta_dato'
  }));
  out.lectura = medLecturaManagement_(out, d, M, hoy);
}

// ------------------------------------------------------------- 03 Finanzas
function _tabFinanzas_(out, P, hoy, auth) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var u = d.ultima || {};
  var fechaBanco = (d.integridad && d.integridad.ult && d.integridad.ult['03_Banco_Industrial']) || '';
  var MM = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  // K04 dias de caja: el primer numero del tablero
  out.kpis.push(tabKpi_({
    clave: 'K04', nombre: 'Dias de caja', valor: d.dias_caja, unidad: 'dias',
    periodo: 'banco al ' + fechaBanco,
    meta: MM.dias_caja.valor, meta_origen: MM.dias_caja.origen,
    meta_texto: 'meta del mes ≥' + MM.dias_caja.valor + ' dias · colchon ' + P.caja_colchon_dias.valor + ' · verde pleno desde ' + P.caja_dias_verde.valor,
    zona: tabZona_(d.dias_caja, MM.dias_caja.valor, 3, 'mayor'),
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
      nota: mt.meta ? ('avance ' + mt.avance + '% · proyeccion Q' + Number(mt.proyeccion || 0).toLocaleString('es-GT') + ' (' + mt.proyeccion_pct + '%)' +
                      (MM.eventos.valor ? ' · sin eventos: su meta aparte es Q' + MM.eventos.valor.toLocaleString('es-GT') + ' (05 Marketing)' : '')) : 'sin meta',
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
  out.lectura = medLecturaFinanzas_(out, d, MM, hoy);
}

// ------------------------------------------------------------- 04 Profit OS
/* Sistema de Medicion: el numero es el food cost real (Jeffry), contra el TRAMO del mes
   (METAS › TRAMO_FOOD_PCT) camino a la meta final de PARAMETROS, que no cambia. Recibe
   los inventarios (K03) desde Management; ticket y lunes a miercoles se fueron alla. */
function _tabProfit_(out, P, hoy, auth, conQ) {
  if (conQ === undefined) conQ = true;
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var u = d.ultima || {};
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var tramo = M.food.valor || d.meta_cogs;
  var teo = null;
  try {
    var po = getProfitOS(auth, 13);
    teo = po && po.tablero && po.tablero.ok ? po.tablero : null;
  } catch (e) { out.avisos.push('Profit OS: ' + String(e && e.message || e)); }
  out.kpis.push(tabKpi_({
    clave: 'K11', nombre: 'Food cost real (movil 4) · Jeffry', valor: u.cogs_m4, unidad: '%',
    periodo: 'S' + u.w + ' · sobre venta sin servicio',
    meta: tramo, meta_origen: M.food.valor ? 'METAS (tramo)' : 'PARAMETROS',
    meta_texto: 'tramo del mes ≤' + tramo + '% · meta final ' + d.meta_cogs + '% · barra ' + P.food_cost_barra_pct.valor + '%',
    zona: tabZona_(u.cogs_m4, tramo, tramo + 3, 'menor'),
    tendencia: mc.ultimo ? tabTendencia_(mc.ultimo.cogsp, mc.anterior ? mc.anterior.cogsp : null, mc.ultimo.mes + ' contra ' + (mc.anterior ? mc.anterior.mes : '') + ' (mes)') : null,
    fuente: 'FinanzasDatos › semanas[].cogs_m4 · Dashboard › cmv (teorico 13 semanas)', enlace: 'costeo',
    nota: teo ? ('teorico 13 semanas: global ' + Math.round(teo.cmv.global * 1000) / 10 + '% · cocina ' + Math.round(teo.cmv.cocina.cmv * 1000) / 10 + '% · barra ' + Math.round(teo.cmv.barra.cmv * 1000) / 10 + '%') : 'teorico de Profit OS no disponible',
    detalle: teo ? { teorico_global: teo.cmv.global, teorico_cocina: teo.cmv.cocina.cmv, teorico_barra: teo.cmv.barra.cmv, ciego_pct: teo.ciego.pctVenta } : null
  }));
  var rt = null;
  try { rt = getCmvRealTeorico(auth); } catch (e2) { out.avisos.push('Puente CMV: ' + String(e2 && e2.message || e2)); }
  var b = rt && rt.ok ? rt.bloque : null;
  var tb = M.brecha.valor || P.brecha_cmv_revisar_pts.valor;
  out.kpis.push(tabKpi_({
    clave: 'K12', nombre: 'Brecha CMV real contra teorico · Jeffry', valor: b ? b.brecha_pts : null, unidad: 'pts',
    periodo: b ? (b.desde + ' a ' + b.hasta + ' (' + b.meses + ' meses cerrados)') : '',
    meta: tb, meta_origen: M.brecha.valor ? 'METAS (tramo)' : P.brecha_cmv_revisar_pts.origen,
    meta_texto: 'tramo del mes ≤' + tb + ' pts · meta final ≤' + P.brecha_cmv_revisar_pts.valor + ' · sobre ' + P.brecha_cmv_auditar_pts.valor + ' auditar recepcion y porciones',
    zona: b ? tabZona_(b.brecha_pts, tb, tb + 2, 'menor') : 'gris',
    fuente: 'PuenteCmv › getCmvRealTeorico().bloque.brecha_pts', enlace: 'costeo',
    nota: b ? ('real ' + b.real_pct + '% · teorico ' + b.teorico_pct + '%' + (b.inv_cocina ? '' : ' · cocina sin inventario en el bloque: real sin ajustar') + (b.inv_barra ? '' : ' · barra sin inventario')) : (rt && rt.error ? rt.error : 'sin dato'),
    estado: b ? 'ok' : 'falta_dato',
    detalle: b ? { real_q: b.real, teorico_q: b.teorico, brecha_q: b.brecha_q, inv_cocina: b.inv_cocina, inv_barra: b.inv_barra } : null
  }));
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
  var rm = null, rma = null;
  try {
    rm = medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1);
    var pa = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    rma = medRetirosMes_(pa.getFullYear(), pa.getMonth() + 1);
  } catch (e4) { out.avisos.push('Retiros: ' + String(e4 && e4.message || e4)); }
  out.kpis.push(tabKpi_({
    clave: 'K22', nombre: 'Retiros de cajero con detalle · Jeffry', valor: rm ? (rm.n ? rm.pct : 100) : null, unidad: '%',
    periodo: rm ? (rm.mes + ' · ' + rm.con_detalle + ' de ' + rm.n + ' retiros · Q' + Math.round(rm.q - rm.q_con).toLocaleString('es-GT') + ' sin detalle') : '',
    meta: 100, meta_origen: 'plan', meta_texto: 'meta 100%: que se compro con cada retiro · rojo bajo 80%',
    zona: rm ? (rm.n ? tabZona_(rm.pct, 100, 80, 'mayor') : 'verde') : 'gris',
    fuente: 'maestro › retiros ATM en ALIMENTOS_EFECTIVO · Config › RETIROS_DETALLE', enlace: 'retiros',
    nota: (rma ? (rma.mes + ': ' + rma.con_detalle + ' de ' + rma.n + ' retiros con detalle (Q' + Math.round(rma.q).toLocaleString('es-GT') + '). ') : '') +
          'Se anotan en Profit OS › Cocina › Compras en efectivo (Jeffry o el dueño). El banco se carga cada 15 dias: un retiro nuevo aparece cuando entra el estado de cuenta.',
    estado: rm ? 'ok' : 'falta_dato'
  }));
  if (mc.ultimo) {
    out.kpis.push(tabKpi_({
      clave: 'K13', nombre: 'Margen bruto por comensal (contexto)', valor: mc.ultimo.mb_comensal, unidad: 'Q',
      periodo: mc.ultimo.mes + ' · ' + mc.ultimo.com + ' comensales',
      meta: null, meta_origen: 'sin meta', meta_texto: 'contexto: medir 3 meses antes de fijar meta',
      zona: 'gris',
      tendencia: tabTendencia_(mc.ultimo.mb_comensal, mc.anterior ? mc.anterior.mb_comensal : null),
      fuente: 'FinanzasDatos › meses[].mb_comensal = (venta sin servicio − COGS) ÷ comensales', enlace: 'finanzas&sub=comparativo',
      estado: 'falta_meta'
    }));
  }
  out.lectura = medLecturaProfit_(out, d, M, hoy, conQ);
}

// ------------------------------------------------------------- 05 Marketing
/* Sistema de Medicion: el numero es COMENSALES DEL MES (Juanma) = venta del restaurante
   ÷ ticket. Palancas: clientes nuevos y CAC (Vanessa), eventos en quetzales y repeticion
   (Juanma). ROAS queda como contexto: no se puede medir hasta optimizar a reserva real. */
function _tabMarketing_(out, P, hoy) {
  var d = _finDatos_(false);
  var mc = tabMesCerrado_(d, hoy);
  var Mt = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var c = medComRitmo_(d, hoy, Mt);            // sin Caja: Marketing no la necesita
  var cur = mc.en_curso || {}, ult = mc.ultimo || {};
  out.kpis.push(tabKpi_({
    clave: 'K23', nombre: 'Comensales del mes (ritmo) · Juanma', valor: c.com_ritmo, unidad: 'comensales',
    periodo: Mt.mes + (c.dia_corte ? ' · al dia ' + c.dia_corte : ''),
    meta: Mt.comensales, meta_origen: Mt.venta_rest.origen,
    meta_texto: Mt.comensales ? ('meta ' + Mt.comensales + ' = Q' + Mt.venta_rest.valor.toLocaleString('es-GT') + ' ÷ ticket Q' + Mt.ticket.valor) : 'sin meta en METAS',
    zona: c.com_zona, tendencia: ult.com_est ? tabTendencia_(c.com_ritmo, ult.com_est, ult.mes + ' completo') : null,
    fuente: 'FinanzasDatos › meses[].com_est = venta del restaurante ÷ ticket', enlace: 'finanzas&sub=metas',
    nota: 'comensales cargados en el POS: ' + (cur.com || 0) + ' (1 de cada 10 tickets viene sin comensales)'
  }));
  var k = mktKpisMes_(d.anio, d);
  if (k.altas_error) out.avisos.push('CRM: ' + k.altas_error);
  var Kc = k.meses[hoy.getMonth() + 1] || null, M = mc.ultimo ? k.meses[mc.ultimo.m] : null, A = mc.anterior ? k.meses[mc.anterior.m] : null;
  out.kpis.push(tabKpi_({
    clave: 'K24', nombre: 'Clientes nuevos del mes · Vanessa', valor: Kc ? Kc.altas : null, unidad: 'clientes',
    periodo: Mt.mes + ' en curso' + (M ? ' · ' + M.mes + ' cerro en ' + M.altas : ''),
    meta: Mt.clientes.valor, meta_origen: Mt.clientes.origen, meta_texto: 'meta ' + Mt.clientes.valor + ' · rojo bajo 30',
    zona: Kc ? tabZona_(Kc.altas, Mt.clientes.valor, 30, 'mayor') : 'gris',
    fuente: 'CrmDatos › crmAltasPorMes_ (segmento "Cliente que visitó")', enlace: 'marketing&sub=crm',
    nota: Kc && Kc.lectura !== null ? ('lectura de Wix ' + Kc.lectura + '%: si baja, este numero se queda corto') : 'sin altas este mes'
  }));
  if (M) {
    var lect = M.lectura;
    out.kpis.push(tabKpi_({
      clave: 'K15', nombre: 'CAC mensual · Vanessa', valor: M.publicable ? M.cac : null, unidad: 'Q/cliente',
      periodo: M.mes + ' · Q' + Number(M.medios || 0).toLocaleString('es-GT') + ' de medios ÷ ' + (M.altas === null ? '?' : M.altas) + ' clientes que visitaron',
      meta: P.cac_max_q.valor, meta_origen: P.cac_max_q.origen,
      meta_texto: P.cac_max_q.valor ? ('maximo Q' + P.cac_max_q.valor) : 'sin meta: medir 3 meses (cac_max_q)',
      zona: (M.publicable && P.cac_max_q.valor) ? tabZona_(M.cac, P.cac_max_q.valor, P.cac_max_q.valor * 1.33, 'menor') : 'gris',
      tendencia: (A && A.publicable && M.publicable) ? tabTendencia_(M.cac, A.cac) : null,
      fuente: 'MarketingDatos › mktKpisMes_ (medios de Finanzas ÷ altas "Cliente que visitó" del CRM)', enlace: 'marketing&sub=crm',
      nota: lect === null ? 'sin altas en el CRM ese mes'
          : ('lectura ' + lect + '%' + (M.comparable ? ' · comparable' : (M.publicable ? ' · inflado: publicar con aviso' : ' · bajo 50%: no se publica'))),
      estado: M.publicable ? (P.cac_max_q.valor ? 'ok' : 'falta_meta') : 'falta_dato',
      detalle: { medios: M.medios, altas: M.altas, historicas: M.historicas, lectura: lect, cac_crudo: M.cac }
    }));
  }
  out.kpis.push(tabKpi_({
    clave: 'K17', nombre: 'Eventos del mes, en quetzales · Juanma', valor: cur.eventos || 0, unidad: 'Q',
    periodo: Mt.mes + ' en curso · ' + (cur.eventos_n || 0) + ' eventos',
    meta: Mt.eventos.valor, meta_origen: Mt.eventos.origen, meta_texto: Mt.eventos.valor ? ('meta Q' + Mt.eventos.valor.toLocaleString('es-GT') + ' · rojo bajo la mitad') : 'sin meta',
    zona: Mt.eventos.valor ? tabZona_(cur.eventos || 0, Mt.eventos.valor, Mt.eventos.valor * 0.5, 'mayor') : 'gris',
    tendencia: ult.eventos !== undefined ? tabTendencia_(cur.eventos || 0, ult.eventos, ult.mes + ' completo') : null,
    fuente: 'FinanzasDatos › meses[].eventos', enlace: 'finanzas&sub=comparativo',
    nota: 'el numero de eventos (' + P.eventos_mes_meta.valor + ' al mes) queda como contexto'
  }));
  var rep = null, rMes = null, rAnt = null;
  try { rep = medRepeticion_(d.anio); rMes = rep[hoy.getMonth() + 1] || null; rAnt = mc.ultimo ? rep[mc.ultimo.m] || null : null; }
  catch (e3) { out.avisos.push('Repeticion: ' + String(e3 && e3.message || e3)); }
  var rUsa = rMes || rAnt;
  var metaRep = (P.repeticion_meta_pct && P.repeticion_meta_pct.valor) || 24;
  out.kpis.push(tabKpi_({
    clave: 'K19', nombre: 'Repeticion: reservas de clientes que ya vinieron · Juanma', valor: rUsa ? rUsa.pct : null, unidad: '%',
    periodo: rUsa ? ((rUsa === rMes ? Mt.mes : (mc.ultimo ? mc.ultimo.mes : '')) + ' · ' + rUsa.repetidos + ' de ' + (rUsa.nuevos + rUsa.repetidos) + ' reservas · ' + rUsa.semanas + ' semanas') : '',
    meta: metaRep, meta_origen: P.repeticion_meta_pct ? P.repeticion_meta_pct.origen : 'plan', meta_texto: 'meta ' + metaRep + '% · 28% en marzo · rojo bajo 20%',
    zona: rUsa ? tabZona_(rUsa.pct, metaRep, 20, 'mayor') : 'gris',
    tendencia: (rMes && rAnt && rUsa === rMes) ? tabTendencia_(rMes.pct, rAnt.pct, mc.ultimo.mes) : null,
    fuente: 'pauta_semanal › clientes_nuevos y repetidos (ClientesNuevos.js del Marketing OS, cada lunes)', enlace: 'marketing',
    nota: 'Una reserva es repetida si su email o telefono ya estaba en la CRM. Solo semanas cerradas.',
    estado: rUsa ? 'ok' : 'falta_dato'
  }));
  if (M) {
    out.kpis.push(tabKpi_({
      clave: 'K16', nombre: 'ROAS de pauta (contexto, no meta)', valor: M.roas, unidad: 'x',
      periodo: M.mes + ' · ' + M.roas_semanas + ' semanas de pauta_semanal',
      meta: null, meta_origen: 'contexto', meta_texto: 'no es meta: no se puede medir hasta que un anuncio optimice a reserva real',
      zona: 'gris', fuente: 'MarketingDatos › mktKpisMes_', enlace: 'marketing', estado: M.roas === null ? 'falta_dato' : 'ok'
    }));
  }
  out.lectura = medLecturaMarketing_(out, d, Mt, c, hoy);
}

// ------------------------------------------------------------- 06 Expansion
/* En pausa hasta 2027. Se activa con 3 meses seguidos cumpliendo las tres condiciones. */
function _tabExpansion_(out, P, hoy) {
  out.texto = 'En pausa hasta 2027. Se activa cuando se cumplan las tres condiciones de abajo durante 3 meses seguidos: ' +
              'caja con colchon, food cost en meta e inventarios a tiempo.';
  try {
    P = P || tabParametros_(); hoy = hoy || new Date();
    var d = _finDatos_(false), u = d.ultima || {};
    out.kpis.push(tabKpi_({ clave: 'C1', nombre: 'Días de caja ≥ ' + P.caja_dias_verde.valor, valor: d.dias_caja, unidad: 'dias',
      meta: P.caja_dias_verde.valor, meta_origen: P.caja_dias_verde.origen, meta_texto: 'condicion: ' + P.caja_dias_verde.valor + ' dias o mas',
      zona: d.dias_caja >= P.caja_dias_verde.valor ? 'verde' : 'rojo', fuente: 'FinanzasDatos › dias_caja', enlace: 'finanzas&sub=caja' }));
    out.kpis.push(tabKpi_({ clave: 'C2', nombre: 'Food cost en meta (' + d.meta_cogs + '%)', valor: u.cogs_m4, unidad: '%',
      meta: d.meta_cogs, meta_origen: 'PARAMETROS', meta_texto: 'condicion: movil 4 en la meta final',
      zona: u.cogs_m4 <= d.meta_cogs ? 'verde' : 'rojo', fuente: 'FinanzasDatos › semanas[].cogs_m4', enlace: 'costeo' }));
    var inv = invEstadoCierre_(hoy, P.inventario_cierre_dia.valor);
    var ok = inv.areas.COCINA.zona === 'verde' && inv.areas.BARRA.zona === 'verde';
    out.kpis.push(tabKpi_({ clave: 'C3', nombre: 'Inventarios antes del día ' + inv.dia_limite, valor: ok ? 'a tiempo' : 'atrasado', unidad: 'mes',
      meta: inv.dia_limite, meta_origen: P.inventario_cierre_dia.origen, meta_texto: 'condicion: cocina y barra cerradas a tiempo',
      zona: ok ? 'verde' : 'rojo', fuente: 'InventarioDatos › invEstadoCierre_', enlace: 'costeo',
      nota: 'cocina ' + (inv.areas.COCINA.ultimo_cerrado || 'ninguno') + ' · barra ' + (inv.areas.BARRA.ultimo_cerrado || 'ninguno') }));
  } catch (e) { out.avisos.push(String(e && e.message || e)); }
  out.lectura = medLecturaExpansion_(out);
}

// ------------------------------------------------------------- Metas y ajustes
/*
 * El control y los ajustes (seccion 4.3bis del plan). Muestra las filas de METAS, la
 * regla para subir o bajar, y una VISTA PREVIA de lo que diria la regla con los ultimos
 * 3 meses cerrados contra la meta del mes en curso. La regla formal corre en cada
 * recalibracion (15-nov, 15-ene, trimestral) y solo sobre meses que ya tengan meta.
 * Nada se cambia desde aqui salvo con el boton de instalar (instalarSistemaMedicion).
 */
function _tabMetas_(out, P, hoy) {
  var filas = [];
  try { filas = medMetasFilas_(); } catch (e) { out.avisos.push('METAS: ' + String(e && e.message || e)); }
  out.filas = filas;
  out.instalado = filas.some(function (f) { return f.origen.indexOf(MED_ORIGEN_) === 0; });
  out.parametros_plan = MED_PARAMETROS_.map(function (x) {
    var p = P[x.k];
    return { clave: x.k, plan: x.v, actual: p ? p.valor : null, origen: p ? p.origen : 'no existe' };
  });
  out.proxima = hoy < new Date(2026, 10, 15) ? '15-nov-2026' : (hoy < new Date(2027, 0, 15) ? '15-ene-2027' : 'la siguiente trimestral');

  var d = _finDatos_(false);
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var mHoy = hoy.getMonth() + 1;
  var cerrados = (d.meses || []).filter(function (x) { return x.m < mHoy; }).slice(-3);
  var altas = null;
  try { altas = crmAltasPorMes_(d.anio); } catch (e2) { altas = null; }
  function prev(nombre, meta, reales, sentido, escalon, ancla) {
    var v = reales.filter(function (x) { return x !== null && x !== undefined; });
    var prom = v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
    var r = { nombre: nombre, meta: meta, reales: reales, promedio: prom === null ? null : Math.round(prom * 10) / 10, propuesta: '', zona: 'gris' };
    if (ancla) { r.propuesta = 'Ancla: no se mueve por desempeño'; return r; }
    if (meta === null || meta === undefined || v.length < 3) { r.propuesta = 'Sin 3 meses con dato'; return r; }
    var mejor = function (x) { return sentido === 'mayor' ? x >= meta * 1.05 : x <= meta * 0.95; };
    var peor = function (x) { return sentido === 'mayor' ? x < meta : x > meta; };
    if (v.every(mejor)) {
      var tope = sentido === 'mayor' ? meta * (1 + escalon) : meta - escalon;
      var nueva = sentido === 'mayor' ? Math.min(prom, tope) : Math.max(prom, tope);
      r.propuesta = 'Subiria a ' + Math.round(nueva * 10) / 10; r.zona = 'verde';
    } else if (v.every(peor)) {
      r.propuesta = '3 meses en rojo: pasar los 3 filtros (dato, acciones, premisa) antes de bajar'; r.zona = 'rojo';
    } else { r.propuesta = 'Se mantiene'; r.zona = 'amarillo'; }
    return r;
  }
  out.meses_previa = cerrados.map(function (x) { return x.mes; });
  out.previa = [
    prev('Venta del restaurante (Q)', M.venta_rest.valor, cerrados.map(function (x) { return x.ventas; }), 'mayor', 0.10),
    prev('Comensales del mes', M.comensales, cerrados.map(function (x) { return x.com_est; }), 'mayor', 0.20),
    prev('Ticket por comensal (Q, sin IVA)', M.ticket.valor, cerrados.map(function (x) { return x.tp; }), 'mayor', 0.10),
    prev('Food cost del mes (%)', M.food.valor, cerrados.map(function (x) { return x.cogsp; }), 'menor', 2),
    prev('Clientes nuevos', M.clientes.valor, cerrados.map(function (x) { return altas && altas[x.m] ? altas[x.m].visito : null; }), 'mayor', 0.20),
    prev('Food cost final 28/20', d.meta_cogs, [], 'menor', 0, true),
    prev('Piso Q18,896', null, [], 'mayor', 0, true)
  ];
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
