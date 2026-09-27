/**
 * PautaSistema.gs — sistema de decisión de pauta (27-sep-2026, Juanma).
 *
 * POR QUÉ EXISTE. Hasta esta fecha la pauta se decidía con tres opiniones que se
 * contradecían: el Panel de Asesores (retirado el 27-sep-2026), el Diagnóstico IA del Dashboard y los reportes
 * sueltos. Cada una leía datos distintos y todas cargaban los mismos supuestos sin
 * verificar ("VisitasIG rinde 20-100x", "US$440/mes", "184 carritos"). El Diagnóstico
 * IA recomendó escalar VisitasIG por CTR sin haber visto una sola reserva.
 *
 * EL PROCESO (sin juicio de IA; Juanma lo decidió así el 27-sep-2026):
 *
 *   HECHOS → VALIDACIÓN → REGLAS → DECISIÓN → APRENDIZAJE
 *
 *   1. Hechos      psCapturar_: Meta por conjunto + pixel + negocio, una vez por
 *                  semana, a hechos_semana y pixel_semana. Todo lo demás lee de ahí.
 *   2. Validación  psValidar_: las trampas conocidas se detectan por código. Un
 *                  conjunto en rojo queda "no evaluable" hasta corregirlo.
 *   3. Reglas      psEvaluar_: estados deterministas con umbrales de la pestaña
 *                  reglas, que solo edita el rol dueño.
 *   4. Decisión    una sola por semana, con la regla que la dispara. Juanma decide,
 *                  Vanessa ejecuta y la registra en bitacora_pruebas.
 *   5. Aprendizaje al leer una prueba, el veredicto actualiza supuestos y aprendizajes.
 *
 * Las pestañas de este archivo NO están en SCHEMA de MarketingDatos a propósito:
 * mktUpsert/mktReplace no pueden tocarlas, y el auto-sync del navegador (replace
 * masivo desde localStorage) tampoco. Solo se escriben por las funciones de aquí.
 *
 * pauta_semanal usa wk = número de semana ISO de 2026 (así la escriben Wix y POS).
 * Aquí la semana es "2026-W39" y se cruza por el número.
 */

var PS_PIXEL_ID = '1107259034759950';
var PS_TZ = 'America/Guatemala';

var PS_SCHEMA = {
  hechos_semana: ['id', 'semana', 'wk', 'campana', 'conjunto', 'conjunto_id', 'estado_meta', 'inicio',
                  'objetivo', 'optimiza_a', 'evento', 'tipo_resultado', 'resultado_nombre', 'resultados',
                  'reservas_atribuidas', 'gasto', 'alcance', 'impresiones', 'frecuencia', 'clics_enlace',
                  'ctr_enlace', 'cpc_enlace', 'hook', 'retencion', 'audiencias', 'audiencia_tam',
                  'semaforo', 'alertas', 'fecha_captura'],
  pixel_semana:  ['id', 'semana', 'wk', 'evento', 'conteo', 'url_top', 'pct_url_top', 'fecha_captura'],
  estados_semana: ['id', 'semana', 'conjunto_id', 'conjunto', 'tipo_resultado', 'semaforo', 'estado',
                   'regla', 'razon', 'accion', 'fecha'],
  supuestos:     ['id', 'afirmacion', 'estado', 'fuente', 'verificado_el', 'vence_el', 'como_verificar',
                  'notas', 'editado_por'],
  reglas:        ['id', 'valor', 'descripcion', 'editado_por', 'editado_el'],
  bitacora_pruebas: ['id', 'fecha', 'autor', 'hipotesis', 'cambio', 'conjunto_id', 'conjunto',
                     'metrica_juez', 'linea_base', 'fecha_inicio', 'fecha_lectura', 'resultado',
                     'veredicto', 'aprendizaje', 'supuesto_id', 'supuesto_queda', 'estado']
};

/* Estados de la bitácora. Solo el dueño mueve una prueba fuera de "propuesta". */
var PS_PRUEBA_ESTADOS = ['propuesta', 'en_curso', 'leida', 'descartada'];

/* Métricas que pueden juzgar una prueba. Ninguna es de creativo ni de costo por clic:
   eso diagnostica, no decide. */
var PS_METRICAS_JUEZ = {
  reservas_negocio:    'Reservas por semana (Wix, pauta_semanal)',
  comensales_negocio:  'Comensales por semana (POS, pauta_semanal)',
  newreservation_pixel: 'Reservas del pixel por semana (NewReservation)',
  reservas_atribuidas: 'Reservas atribuidas a la pauta por semana (Meta)'
};

/* ---------------------------------------------------------------- semillas --- */

var PS_REGLAS_BASE = [
  ['evento_conversion', 'NewReservation', 'Evento del pixel que cuenta como reserva real. Es el único resultado que puede justificar mover dinero.'],
  ['url_reservas', 'reserv', 'Fragmento de URL de la página de reservas, para contar sus vistas en el pixel.'],
  ['audiencia_min', 1000, 'Audiencia personalizada mínima para hablar de retargeting.'],
  ['factor_expansion', 3, 'Si el alcance supera este múltiplo de la audiencia, Meta está expandiendo a frío.'],
  ['ctr_alarma', 15, 'CTR de enlace (%) que, con CPC bajo, indica tráfico sin intención.'],
  ['cpc_alarma', 0.10, 'CPC de enlace (Q) por debajo del cual un CTR alto es alarma, no logro.'],
  ['frecuencia_fatiga', 3, 'Frecuencia semanal por encima de la cual hay fatiga.'],
  ['hook_min', 40, 'Hook mínimo (%) = reproducciones de 3 s ÷ impresiones.'],
  ['retencion_min', 10, 'Retención mínima (%) = ThruPlay ÷ impresiones.'],
  ['dias_minimos', 7, 'Días sin tocar un conjunto después de lanzarlo o cambiarlo, antes de juzgarlo.'],
  ['semanas_escalar', 2, 'Semanas seguidas de subida en reservas atribuidas para poder escalar.'],
  ['tope_cambio_pct', 20, 'Cambio máximo de presupuesto por decisión (%).'],
  ['dias_apagar', 14, 'Ventana para apagar un conjunto de conversión sin reservas.'],
  ['gasto_min_apagar', 150, 'Gasto mínimo (Q) en esa ventana antes de apagar por falta de reservas.'],
  ['home_max_pct', 80, 'Si más de este % de un evento intermedio dispara en la home, no mide intención.'],
  ['ratio_intermedio_max', 0.5, 'Si un evento intermedio supera esta fracción de los PageView, está contaminado.'],
  ['desfase_pixel_max', 50, 'Diferencia máxima (%) entre reservas del pixel y reservas de Wix antes de desconfiar del pixel.'],
  ['semanas_base', 4, 'Semanas previas que forman la línea base del negocio.']
];

var PS_SUPUESTOS_BASE = [
  ['s_newreservation', 'NewReservation del pixel cuenta reservas reales (~17 por semana, en línea con Wix).', 'verificado',
   'Estadísticas del dataset en Meta, 4 al 27-sep-2026: 68 eventos.', '2026-09-27', '2026-12-26',
   'Comparar NewReservation semanal contra reservas de pauta_semanal: el sistema lo revisa solo cada semana.'],
  ['s_vista_reservas', 'Vista_Reservas (id 2169262467156052) es un PageView de URL con "reserv", no una reserva.', 'verificado',
   'Regla de la conversión personalizada leída en Meta el 27-sep-2026.', '2026-09-27', '2027-03-27',
   'Leer la regla de la conversión personalizada en el Administrador de eventos.'],
  ['s_addtocart', 'AddToCart mide que alguien empezó a reservar.', 'falso',
   'Pixel 4 al 27-sep-2026: 5,524 AddToCart, todos en la home de rosanta.rest.', '2026-09-27', '2026-12-26',
   'El sistema revisa cada semana en qué URL dispara. Pasa a verificado cuando dispare al elegir fecha y hora.'],
  ['s_visitasig_20x', 'Las campañas de VisitasIG rinden 20-100x las transaccionales.', 'por_verificar',
   'Insight heredado. Comparaba resultados de tipos distintos (visitas al perfil contra conversiones).', '', '',
   'Solo se verifica con una prueba en la bitácora juzgada por reservas.'],
  ['s_presupuesto', 'El presupuesto base de pauta es US$440 al mes.', 'por_verificar',
   'Gasto real en Meta del 28-ago al 26-sep-2026: Q2,262 (unos US$290).', '', '',
   'Confirmar con Vanessa el presupuesto aprobado y compararlo con el gasto de hechos_semana.'],
  ['s_carritos_184', 'Se abandonan unos 184 carritos de reserva al mes.', 'por_verificar',
   'La cifra sale de AddToCart, que está contaminado.', '', '',
   'Recalcular cuando AddToCart dispare solo al empezar una reserva.'],
  ['s_audiencia_carrito', 'La audiencia "Empezó reserva y no completó (30d)" tiene unas 20 personas.', 'verificado',
   'Tamaño leído en Meta el 27-sep-2026.', '2026-09-27', '2026-10-27',
   'El sistema lee el tamaño de cada audiencia en cada captura.'],
  ['s_aprendizaje_50', 'Meta necesita unos 50 eventos por semana para salir de aprendizaje.', 'por_verificar',
   'Mecánica de plataforma, fuentes no oficiales.', '', '',
   'Vanessa lo confirma en el Centro de ayuda de Meta. Las mecánicas vencen a los 90 días.'],
  ['s_calibracion_7d', 'Cada edición significativa reinicia unos 7 días de calibración.', 'por_verificar',
   'Mecánica de plataforma, fuente no oficial (admove.ai).', '', '',
   'Vanessa lo confirma en el Centro de ayuda de Meta.'],
  ['s_andromeda', 'Meta agrupa creativos casi idénticos como duplicados (Andromeda).', 'por_verificar',
   'Verificado por la casa en jul-2026 con fuentes no oficiales.', '', '',
   'Vanessa lo reconfirma en Meta. Las mecánicas vencen a los 90 días.'],
  ['s_definicion_video', 'Hook = 3 s ÷ impresiones y retención = ThruPlay ÷ impresiones, igual que las columnas de Ads Manager.', 'por_verificar',
   'Definición usada por la captura automática.', '', '',
   'Comparar una semana de hechos_semana contra las columnas Tasa de Hook y Tasa de Retención de Ads Manager.']
];

/* ------------------------------------------------------------------ hojas ---- */

function psSheet_(tab) {
  var head = PS_SCHEMA[tab];
  if (!head) throw new Error('Pestaña del sistema de pauta desconocida: ' + tab);
  var ss = SpreadsheetApp.openById(MKT_SHEET_ID);
  var sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (tab === 'reglas') psSembrar_(sh, PS_REGLAS_BASE.map(function (r) {
      return [r[0], r[1], r[2], 'sistema', psHoy_()];
    }));
    if (tab === 'supuestos') psSembrar_(sh, PS_SUPUESTOS_BASE.map(function (r) {
      return r.concat(['', 'sistema']);
    }));
  }
  return sh;
}

function psSembrar_(sh, filas) {
  if (filas.length) sh.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
}

function psLeer_(tab) {
  var head = PS_SCHEMA[tab];
  var vals = psSheet_(tab).getDataRange().getValues();
  vals.shift();
  return vals.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = mktNormalize_(r[i]); });
    return o;
  });
}

/** Upsert por id (columna 1). */
function psUpsert_(tab, row) {
  var head = PS_SCHEMA[tab];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = psSheet_(tab);
    var vals = sh.getDataRange().getValues();
    var idx = -1;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(row.id)) { idx = i + 1; break; }
    }
    var viejo = {};
    if (idx > 0) head.forEach(function (h, k) { viejo[h] = vals[idx - 1][k]; });
    var linea = head.map(function (h) {
      return row[h] !== undefined && row[h] !== null ? row[h] : (viejo[h] !== undefined ? viejo[h] : '');
    });
    if (idx > 0) sh.getRange(idx, 1, 1, head.length).setValues([linea]);
    else sh.appendRow(linea);
    return { id: row.id, updated: idx > 0 };
  } finally {
    lock.releaseLock();
  }
}

/** Reemplaza todas las filas de una semana (la captura es idempotente). */
function psReemplazarSemana_(tab, semana, filas) {
  var head = PS_SCHEMA[tab];
  var col = head.indexOf('semana');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = psSheet_(tab);
    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][col]) === semana) sh.deleteRow(i + 1);
    }
    if (filas.length) {
      var data = filas.map(function (r) {
        return head.map(function (h) { return r[h] !== undefined && r[h] !== null ? r[h] : ''; });
      });
      sh.getRange(sh.getLastRow() + 1, 1, data.length, head.length).setValues(data);
    }
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ fechas --- */

function psHoy_() { return Utilities.formatDate(new Date(), PS_TZ, 'yyyy-MM-dd'); }

function psIso_(d) { return Utilities.formatDate(d, PS_TZ, 'yyyy-MM-dd'); }

/** Semana ISO de una fecha: {id:'2026-W39', anio, wk, lunes, domingo, desde, hasta}. */
function psSemanaDe_(fecha) {
  var d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  var dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  var anio = d.getUTCFullYear();
  var wk = Math.ceil(((d - new Date(Date.UTC(anio, 0, 1))) / 86400000 + 1) / 7);
  return psSemana_(anio, wk);
}

function psSemana_(anio, wk) {
  var ene4 = new Date(anio, 0, 4, 12);
  var lunes = new Date(ene4);
  lunes.setDate(ene4.getDate() - ((ene4.getDay() + 6) % 7) + (wk - 1) * 7);
  var domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    id: anio + '-W' + (wk < 10 ? '0' : '') + wk, anio: anio, wk: wk,
    lunes: lunes, domingo: domingo, desde: psIso_(lunes), hasta: psIso_(domingo)
  };
}

function psSemanaPorId_(id) {
  var m = /^(\d{4})-W(\d{1,2})$/.exec(String(id || ''));
  if (!m) return null;
  return psSemana_(Number(m[1]), Number(m[2]));
}

/** La última semana cerrada (la que terminó el domingo pasado). */
function psSemanaCerrada_() {
  var d = new Date();
  d.setDate(d.getDate() - 7);
  return psSemanaDe_(d);
}

function psDias_(desdeIso, hastaIso) {
  if (!desdeIso || !hastaIso) return null;
  var a = new Date(String(desdeIso).slice(0, 10) + 'T12:00:00');
  var b = new Date(String(hastaIso).slice(0, 10) + 'T12:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* ------------------------------------------------------------------ reglas --- */

/** Umbrales vigentes: los de la hoja, con los de base para lo que falte. */
function psReglas_() {
  var cfg = {};
  PS_REGLAS_BASE.forEach(function (r) { cfg[r[0]] = r[1]; });
  psLeer_('reglas').forEach(function (r) {
    if (!r.id || r.valor === '' || r.valor === null) return;
    var base = cfg[r.id];
    cfg[r.id] = (typeof base === 'number') ? Number(r.valor) : String(r.valor);
  });
  return cfg;
}

/* ----------------------------------------------------------------- captura --- */

/** Evento que cuenta una regla de pixel: {"and":[{"event":{"eq":"PageView"}}, …]}. */
function psEventoDeRegla_(regla) {
  var o = regla;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { return ''; } }
  var hallado = '';
  (function buscar(x) {
    if (hallado || !x || typeof x !== 'object') return;
    if (x.event && typeof x.event === 'object' && x.event.eq) { hallado = String(x.event.eq); return; }
    Object.keys(x).forEach(function (k) { buscar(x[k]); });
  })(o);
  return hallado;
}

var PS_EVENTOS_ESTANDAR = {
  ADD_TO_CART: 'AddToCart', PURCHASE: 'Purchase', LEAD: 'Lead', CONTENT_VIEW: 'ViewContent',
  COMPLETE_REGISTRATION: 'CompleteRegistration', INITIATED_CHECKOUT: 'InitiateCheckout',
  SEARCH: 'Search', CONTACT: 'Contact', SCHEDULE: 'Schedule', SUBMIT_APPLICATION: 'SubmitApplication'
};

var PS_ALCANCE = { REACH: 1, IMPRESSIONS: 1, THRUPLAY: 1, AD_RECALL_LIFT: 1, TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: 1 };

/**
 * Qué cuenta un conjunto como "resultado". Es la regla de oro del análisis de pauta:
 * sin esto, ordenar campañas por resultados compara visitas al perfil contra vistas
 * de página contra reservas, y no significa nada.
 *
 * Devuelve {tipo, evento, nombre, acciones:[action_type candidatos]}.
 * tipo: conversion | intermedio | vista_pagina | alcance | trafico | desconocido.
 */
function psQueCuenta_(adset, ccPorId, cfg) {
  var g = String(adset.optimization_goal || '');
  var po = adset.promoted_object || {};
  if (po.pixel_id || g === 'OFFSITE_CONVERSIONS' || g === 'VALUE') {
    var ev = '', nombre = '', acciones = [];
    if (po.custom_conversion_id) {
      var cc = ccPorId[po.custom_conversion_id];
      ev = cc ? psEventoDeRegla_(cc.rule) : '';
      nombre = cc ? cc.name : 'conversión ' + po.custom_conversion_id;
      acciones.push('offsite_conversion.custom.' + po.custom_conversion_id);
    } else if (po.custom_event_str) {
      ev = String(po.custom_event_str);
      nombre = ev;
    } else if (po.pixel_rule) {
      ev = psEventoDeRegla_(po.pixel_rule);
      nombre = ev + ' con regla';
    } else if (po.custom_event_type && PS_EVENTOS_ESTANDAR[po.custom_event_type]) {
      ev = PS_EVENTOS_ESTANDAR[po.custom_event_type];
      nombre = ev;
    }
    if (ev && !po.custom_conversion_id) {
      acciones.push('offsite_conversion.fb_pixel_custom.' + ev);
      acciones.push('offsite_conversion.fb_pixel_' + ev.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
    }
    var tipo = !ev ? 'desconocido'
      : ev === cfg.evento_conversion ? 'conversion'
      : (ev === 'PageView' || ev === 'ViewContent') ? 'vista_pagina'
      : 'intermedio';
    var etiqueta = tipo === 'conversion' ? 'reservas (' + nombre + ')'
      : tipo === 'vista_pagina' ? 'vistas de página (' + nombre + ')'
      : tipo === 'intermedio' ? 'eventos ' + ev + ' (' + nombre + ')'
      : 'conversión sin evento legible';
    return { tipo: tipo, evento: ev, nombre: etiqueta, acciones: acciones };
  }
  if (PS_ALCANCE[g]) {
    return { tipo: 'alcance', evento: g, nombre: g === 'THRUPLAY' ? 'reproducciones ThruPlay' : 'personas alcanzadas', acciones: [] };
  }
  var traf = {
    PROFILE_VISIT: ['visitas al perfil de IG', ['onsite_conversion.ig_profile_visit', 'ig_profile_visit', 'profile_visit']],
    LANDING_PAGE_VIEWS: ['vistas de la página de destino', ['landing_page_view', 'omni_landing_page_view']],
    LINK_CLICKS: ['clics al enlace', ['link_click']],
    POST_ENGAGEMENT: ['interacciones', ['post_engagement']],
    CONVERSATIONS: ['conversaciones iniciadas', ['onsite_conversion.messaging_conversation_started_7d']]
  }[g] || ['resultados de ' + (g || 'objetivo desconocido'), []];
  return { tipo: 'trafico', evento: g, nombre: traf[0], acciones: traf[1] };
}

function psSumaAcciones_(lista, tipos) {
  var total = null;
  (lista || []).forEach(function (a) {
    if (tipos.indexOf(a.action_type) !== -1) total = (total || 0) + Number(a.value || 0);
  });
  return total;
}

function psNum_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function psRedondear_(n, dec) {
  if (n === null || n === undefined || isNaN(n)) return '';
  var f = Math.pow(10, dec || 0);
  return Math.round(n * f) / f;
}

/** Todas las páginas de una lista de Graph. */
function psGraphTodo_(ruta, params) {
  var out = [], p = JSON.parse(JSON.stringify(params)), vueltas = 0;
  while (vueltas++ < 10) {
    var r = graph_(ruta, p);
    out = out.concat(r.data || []);
    var sig = r.paging && r.paging.cursors && r.paging.cursors.after;
    if (!sig || !(r.paging && r.paging.next)) break;
    p.after = sig;
  }
  return out;
}

/** Pixel de la semana: conteo por evento y URL donde más dispara cada uno. */
function psCapturarPixel_(sem, cfg) {
  var ini = Math.floor(new Date(sem.desde + 'T00:00:00-06:00').getTime() / 1000);
  var fin = Math.floor(new Date(sem.hasta + 'T23:59:59-06:00').getTime() / 1000);
  var base = { start_time: String(ini), end_time: String(fin) };

  var porEvento = {};
  (graph_(PS_PIXEL_ID + '/stats', Object.assign({ aggregation: 'event' }, base)).data || []).forEach(function (h) {
    (h.data || []).forEach(function (x) { porEvento[x.value] = (porEvento[x.value] || 0) + Number(x.count || 0); });
  });

  var filas = [];
  Object.keys(porEvento).forEach(function (ev) {
    var fila = { evento: ev, conteo: porEvento[ev], url_top: '', pct_url_top: '' };
    try {
      var porUrl = {};
      (graph_(PS_PIXEL_ID + '/stats', Object.assign({ aggregation: 'url', event: ev }, base)).data || []).forEach(function (h) {
        (h.data || []).forEach(function (x) {
          var u = String(x.value || '').replace(/[?#].*$/, '');
          porUrl[u] = (porUrl[u] || 0) + Number(x.count || 0);
        });
      });
      var top = Object.keys(porUrl).sort(function (a, b) { return porUrl[b] - porUrl[a]; })[0];
      var tot = Object.keys(porUrl).reduce(function (s, k) { return s + porUrl[k]; }, 0);
      if (top) { fila.url_top = top; fila.pct_url_top = psRedondear_(porUrl[top] / tot * 100, 1); }
      if (ev === 'PageView') {
        var vistas = 0;
        Object.keys(porUrl).forEach(function (u) {
          if (u.toLowerCase().indexOf(String(cfg.url_reservas).toLowerCase()) !== -1) vistas += porUrl[u];
        });
        filas.push({ evento: 'PageView·reservas', conteo: vistas, url_top: '', pct_url_top: '' });
      }
    } catch (e) { fila.url_top = 'no disponible: ' + String(e.message || e).slice(0, 80); }
    filas.push(fila);
  });
  return filas;
}

/**
 * Captura los hechos de una semana cerrada y los deja en la Sheet. Idempotente:
 * volver a correrla reemplaza las filas de esa semana.
 */
function psCapturar_(sem) {
  var cfg = psReglas_();
  var ahora = Utilities.formatDate(new Date(), PS_TZ, 'yyyy-MM-dd HH:mm');
  var tr = JSON.stringify({ since: sem.desde, until: sem.hasta });

  var ins = psGraphTodo_('act_' + AD_ACCOUNT_ID + '/insights', {
    level: 'adset', time_range: tr, limit: 500,
    fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,frequency,' +
            'inline_link_clicks,actions,conversions,video_thruplay_watched_actions'
  });
  var insPorId = {};
  ins.forEach(function (r) { insPorId[r.adset_id] = r; });

  var adsets = psGraphTodo_('act_' + AD_ACCOUNT_ID + '/adsets', {
    limit: 200,
    fields: 'id,name,effective_status,optimization_goal,promoted_object,targeting,start_time,campaign{name,objective}'
  });

  var cc = {};
  psGraphTodo_('act_' + AD_ACCOUNT_ID + '/customconversions', { fields: 'id,name,rule', limit: 100 })
    .forEach(function (c) { cc[c.id] = c; });
  var ccReserva = Object.keys(cc).filter(function (id) {
    return psEventoDeRegla_(cc[id].rule) === cfg.evento_conversion;
  });
  var accionesReserva = ['offsite_conversion.fb_pixel_custom.' + cfg.evento_conversion]
    .concat(ccReserva.map(function (id) { return 'offsite_conversion.custom.' + id; }));

  var tamAud = {};
  function tamano(id) {
    if (tamAud.hasOwnProperty(id)) return tamAud[id];
    try {
      var a = graph_(id, { fields: 'approximate_count_lower_bound' });
      tamAud[id] = psNum_(a.approximate_count_lower_bound);
    } catch (e) { tamAud[id] = null; }
    return tamAud[id];
  }

  var hechos = [];
  adsets.forEach(function (a) {
    var i = insPorId[a.id];
    var gasto = i ? psNum_(i.spend) || 0 : 0;
    if (!i && a.effective_status !== 'ACTIVE') return; // ni gastó ni está activo: no es de esta semana
    var q = psQueCuenta_(a, cc, cfg);
    var imp = i ? psNum_(i.impressions) : null;
    var clics = i ? psNum_(i.inline_link_clicks) : null;
    var vistas3s = i ? psSumaAcciones_(i.actions, ['video_view']) : null;
    var thru = i ? psSumaAcciones_(i.video_thruplay_watched_actions, ['video_view']) : null;
    var resultados = null;
    if (i) {
      if (q.tipo === 'alcance') resultados = q.evento === 'THRUPLAY' ? thru : psNum_(i.reach);
      else if (q.tipo === 'trafico' && q.evento === 'LINK_CLICKS') resultados = clics;
      else resultados = psSumaAcciones_(i.actions, q.acciones) || psSumaAcciones_(i.conversions, q.acciones);
    }
    var auds = ((a.targeting && a.targeting.custom_audiences) || []);
    var tam = null;
    auds.forEach(function (x) { var t = tamano(x.id); if (t !== null) tam = (tam || 0) + t; });
    hechos.push({
      id: sem.id + '|' + a.id, semana: sem.id, wk: sem.wk,
      campana: (a.campaign && a.campaign.name) || (i && i.campaign_name) || '',
      conjunto: a.name, conjunto_id: a.id, estado_meta: a.effective_status,
      inicio: a.start_time ? String(a.start_time).slice(0, 10) : '',
      objetivo: (a.campaign && a.campaign.objective) || '', optimiza_a: a.optimization_goal || '',
      evento: q.evento, tipo_resultado: q.tipo, resultado_nombre: q.nombre,
      resultados: resultados === null ? '' : resultados,
      reservas_atribuidas: i ? (psSumaAcciones_(i.actions, accionesReserva) ||
                                psSumaAcciones_(i.conversions, accionesReserva) || 0) : 0,
      gasto: psRedondear_(gasto, 2), alcance: i ? psNum_(i.reach) : 0, impresiones: imp || 0,
      frecuencia: i ? psRedondear_(psNum_(i.frequency), 2) : '',
      clics_enlace: clics || 0,
      ctr_enlace: imp ? psRedondear_((clics || 0) / imp * 100, 2) : '',
      cpc_enlace: clics ? psRedondear_(gasto / clics, 2) : '',
      hook: imp && vistas3s !== null ? psRedondear_(vistas3s / imp * 100, 1) : '',
      retencion: imp && thru !== null ? psRedondear_(thru / imp * 100, 1) : '',
      audiencias: auds.map(function (x) { return x.name; }).join(' · '),
      audiencia_tam: tam === null ? '' : tam,
      fecha_captura: ahora
    });
  });

  var pixel = [], pixelError = '';
  try { pixel = psCapturarPixel_(sem, cfg); } catch (e) { pixelError = String(e.message || e); }

  var ctx = { pixel: psIndicePixel_(pixel), cfg: cfg };
  hechos.forEach(function (h) {
    var al = psValidar_(h, ctx);
    h.semaforo = psSemaforo_(al);
    h.alertas = al.map(function (x) { return (x.nivel === 'rojo' ? '🔴 ' : '🟡 ') + x.texto; }).join('\n');
  });

  psReemplazarSemana_('hechos_semana', sem.id, hechos);
  psReemplazarSemana_('pixel_semana', sem.id, pixel.map(function (p) {
    return { id: sem.id + '|' + p.evento, semana: sem.id, wk: sem.wk, evento: p.evento, conteo: p.conteo,
             url_top: p.url_top, pct_url_top: p.pct_url_top, fecha_captura: ahora };
  }));

  var tab = psArmarTablero_(sem);
  psReemplazarSemana_('estados_semana', sem.id, tab.conjuntos.map(function (c) {
    return { id: sem.id + '|' + c.conjunto_id, semana: sem.id, conjunto_id: c.conjunto_id, conjunto: c.conjunto,
             tipo_resultado: c.tipo_resultado, semaforo: c.semaforo, estado: c.estado, regla: c.regla,
             razon: c.razon, accion: c.accion, fecha: ahora };
  }));
  return { semana: sem.id, conjuntos: hechos.length, eventosPixel: pixel.length, pixelError: pixelError };
}

/* -------------------------------------------------------------- validación --- */

function psIndicePixel_(filas) {
  var o = {};
  (filas || []).forEach(function (p) { o[p.evento] = p; });
  return o;
}

/** ¿Un evento intermedio del pixel mide intención, o dispara en cualquier visita? */
function psEventoContaminado_(ev, pixel, cfg) {
  var p = pixel[ev], pv = pixel.PageView;
  if (!p || ev === 'PageView' || ev === cfg.evento_conversion) return '';
  var home = /^https?:\/\/[^\/]+\/?$/.test(String(p.url_top || ''));
  if (home && Number(p.pct_url_top) >= cfg.home_max_pct) {
    return ev + ' dispara ' + p.pct_url_top + '% en la home (' + p.url_top + '): no mide intención.';
  }
  if (pv && Number(pv.conteo) > 0 && Number(p.conteo) / Number(pv.conteo) > cfg.ratio_intermedio_max) {
    return ev + ' equivale al ' + Math.round(Number(p.conteo) / Number(pv.conteo) * 100) +
           '% de los PageView: dispara casi con cualquier visita.';
  }
  return '';
}

/**
 * Las trampas conocidas, como código. Cada una existe porque ya costó una mala
 * decisión (ver supuestos y la regla de oro de la skill de pauta).
 */
function psValidar_(h, ctx) {
  var cfg = ctx.cfg, al = [];
  var gasto = Number(h.gasto) || 0, alcance = Number(h.alcance) || 0;
  var nombre = (h.campana + ' ' + h.conjunto).toLowerCase();
  var buscaVentas = /sales|conversions/i.test(String(h.objetivo)) || /reserv|venta|convers/.test(nombre);

  if (h.tipo_resultado === 'vista_pagina' && buscaVentas) {
    al.push({ nivel: 'rojo', codigo: 'disfraz',
      texto: 'Busca reservas pero optimiza a ' + h.resultado_nombre + ': es una vista de página, no una reserva.' });
  }
  if (h.tipo_resultado === 'intermedio') {
    var cont = psEventoContaminado_(h.evento, ctx.pixel, cfg);
    if (cont) al.push({ nivel: 'rojo', codigo: 'contaminado', texto: 'Optimiza a un evento que no sirve. ' + cont });
  }
  if (h.tipo_resultado === 'desconocido') {
    al.push({ nivel: 'amarillo', codigo: 'desconocido', texto: 'No pude leer qué evento cuenta este conjunto: revisarlo en Meta.' });
  }
  var tam = psNum_(h.audiencia_tam);
  if (tam !== null && tam < cfg.audiencia_min && alcance > cfg.factor_expansion * Math.max(tam, 1)) {
    al.push({ nivel: 'rojo', codigo: 'expansion',
      texto: 'La audiencia tiene ' + tam + ' personas y alcanzó ' + alcance + ': Meta expandió a frío, no es retargeting.' });
  }
  if (h.estado_meta === 'ACTIVE' && gasto < 1) {
    al.push({ nivel: 'amarillo', codigo: 'sin_entrega', texto: 'Activo pero Meta casi no lo entregó (Q' + gasto + ').' });
  }
  var ctr = psNum_(h.ctr_enlace), cpc = psNum_(h.cpc_enlace);
  if (ctr !== null && cpc !== null && ctr > cfg.ctr_alarma && cpc < cfg.cpc_alarma) {
    al.push({ nivel: 'amarillo', codigo: 'clic_sin_intencion',
      texto: 'CTR ' + ctr + '% con CPC Q' + cpc + ': tráfico barato sin intención probable.' });
  }
  var fr = psNum_(h.frecuencia);
  if (fr !== null && fr > cfg.frecuencia_fatiga) {
    al.push({ nivel: 'amarillo', codigo: 'fatiga', texto: 'Frecuencia ' + fr + ' en la semana: fatiga.' });
  }
  var hook = psNum_(h.hook), ret = psNum_(h.retencion);
  if (hook !== null && hook > 0 && hook < cfg.hook_min) {
    al.push({ nivel: 'amarillo', codigo: 'hook', texto: 'Hook ' + hook + '%, bajo el mínimo de ' + cfg.hook_min + '%.' });
  }
  if (ret !== null && ret > 0 && ret < cfg.retencion_min) {
    al.push({ nivel: 'amarillo', codigo: 'retencion', texto: 'Retención ' + ret + '%, bajo el mínimo de ' + cfg.retencion_min + '%.' });
  }
  return al;
}

function psSemaforo_(alertas) {
  if (alertas.some(function (a) { return a.nivel === 'rojo'; })) return 'rojo';
  if (alertas.length) return 'amarillo';
  return 'verde';
}

function psAlertasDeTexto_(txt) {
  return String(txt || '').split('\n').filter(String).map(function (l) {
    return { nivel: l.indexOf('🔴') === 0 ? 'rojo' : 'amarillo', texto: l.replace(/^(🔴|🟡)\s*/, '') };
  });
}

/* --------------------------------------------------------------- negocio ---- */

/**
 * pauta_semanal por número de semana ISO (así la escriben Wix y POS).
 * Lee la hoja directo y no por mktRead: mktRead pide la identidad de quien llama,
 * y el activador del lunes no trae sesión de usuario.
 */
function psNegocio_() {
  var porWk = {}, head = SCHEMA.pauta_semanal;
  var vals = mktSheet_('pauta_semanal').getDataRange().getValues();
  vals.shift();
  vals.map(function (fila) {
    var r = {};
    head.forEach(function (h, k) { r[h] = fila[k]; });
    return r;
  }).forEach(function (r) {
    var wk = parseInt(String(r.wk).replace(/\D/g, ''), 10);
    if (isNaN(wk)) return;
    porWk[wk] = { reservas: psNum_(r.reservas), comensales: psNum_(r.comensales),
                  clientes_nuevos: psNum_(r.clientes_nuevos), mCosto: psNum_(r.mCosto), gCosto: psNum_(r.gCosto) };
  });
  return porWk;
}

function psPromedio_(xs) {
  var v = xs.filter(function (x) { return x !== null && x !== undefined && !isNaN(x); });
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}

/* ---------------------------------------------------------------- motor ----- */

/**
 * Estado de un conjunto. Determinista: los mismos hechos y reglas dan el mismo estado.
 * `serie` = sus filas de hechos_semana en orden de semana, la última es la evaluada.
 */
function psEvaluarConjunto_(h, serie, cfg, hoy, pruebas, negocio) {
  var al = psAlertasDeTexto_(h.alertas);
  var rojo = al.filter(function (a) { return a.nivel === 'rojo'; })[0];
  if (rojo) {
    return { estado: 'CORREGIR', regla: 'R1 · Datos no evaluables', razon: rojo.texto,
             accion: psAccionCorregir_(rojo.texto) };
  }

  var enCurso = pruebas.filter(function (p) {
    return p.estado === 'en_curso' && String(p.conjunto_id) === String(h.conjunto_id);
  })[0];
  if (enCurso && psDias_(hoy, enCurso.fecha_lectura) > 0) {
    return { estado: 'ESPERAR', regla: 'R2 · Prueba en curso', razon: 'Prueba "' + enCurso.hipotesis + '" hasta el ' + enCurso.fecha_lectura + '.',
             accion: 'No tocar hasta la fecha de lectura.' };
  }
  var cambio = enCurso ? enCurso.fecha_inicio : h.inicio;
  var edad = psDias_(cambio, hoy);
  if (edad !== null && edad < cfg.dias_minimos) {
    return { estado: 'ESPERAR', regla: 'R2 · Ventana mínima', razon: 'Lleva ' + edad + ' días desde el último cambio; se juzga a los ' + cfg.dias_minimos + '.',
             accion: 'No tocar.' };
  }

  if (h.tipo_resultado === 'conversion' || h.tipo_resultado === 'intermedio') {
    var semanasApagar = Math.max(1, Math.ceil(cfg.dias_apagar / 7));
    var ventana = serie.slice(-semanasApagar);
    var gastoV = ventana.reduce(function (s, x) { return s + (Number(x.gasto) || 0); }, 0);
    var resV = ventana.reduce(function (s, x) { return s + (Number(x.reservas_atribuidas) || 0); }, 0);
    if (ventana.length >= semanasApagar && gastoV >= cfg.gasto_min_apagar && resV === 0) {
      return { estado: 'APAGAR', regla: 'R4 · Sin reservas', razon: 'Q' + psRedondear_(gastoV, 0) + ' en ' + ventana.length + ' semanas y 0 reservas atribuidas.',
               accion: 'Apagar y registrar el aprendizaje.' };
    }
    var n = cfg.semanas_escalar, ult = serie.slice(-(n + 1)).map(function (x) { return Number(x.reservas_atribuidas) || 0; });
    var sube = ult.length === n + 1 && ult.every(function (v, k) { return k === 0 || v > ult[k - 1]; });
    var neg = negocio[h.wk], base = psPromedio_(psSemanasPrevias_(h.wk, cfg.semanas_base).map(function (w) {
      return negocio[w] ? negocio[w].reservas : null;
    }));
    var negocioOk = neg && neg.reservas !== null && (base === null || neg.reservas >= base);
    if (sube && negocioOk) {
      return { estado: 'ESCALAR', regla: 'R3 · Reservas al alza', razon: 'Reservas atribuidas ' + ult.join(' → ') + ' y el negocio no bajó.',
               accion: 'Subir presupuesto hasta ' + cfg.tope_cambio_pct + '% y registrarlo como prueba.' };
    }
    return { estado: 'MANTENER', regla: 'R5 · Conversión estable', razon: 'Reservas atribuidas esta semana: ' + (Number(h.reservas_atribuidas) || 0) + '.',
             accion: 'No tocar.' };
  }

  var creativo = al.filter(function (a) { return /^(Hook|Retención|Frecuencia)/.test(a.texto); });
  if (creativo.length) {
    return { estado: 'AJUSTAR CREATIVO', regla: 'R6 · Creativo bajo mínimo', razon: creativo.map(function (a) { return a.texto; }).join(' '),
             accion: 'Rotar a un concepto de video distinto; presupuesto sin cambios.' };
  }
  return { estado: 'MANTENER', regla: 'R7 · Awareness y tráfico', razon: 'No se juzga por su propia métrica (' + h.resultado_nombre + ').',
           accion: 'Su presupuesto solo se mueve con una prueba en la bitácora juzgada por reservas.' };
}

function psAccionCorregir_(texto) {
  if (/vista de página/.test(texto)) return 'Cambiar el evento de optimización a la conversión de reserva, o renombrarlo como tráfico.';
  if (/evento que no sirve/.test(texto)) return 'Arreglar el disparo del evento en la web antes de optimizar a él.';
  if (/expandió a frío/.test(texto)) return 'Apagar el conjunto o rehacer la audiencia hasta superar el mínimo.';
  return 'Corregir antes de juzgar.';
}

function psSemanasPrevias_(wk, n) {
  var out = [];
  for (var k = 1; k <= n; k++) if (wk - k > 0) out.push(wk - k);
  return out;
}

/* Orden de prioridad para la decisión única de la semana. */
var PS_PRIORIDAD = { 'CORREGIR': 1, 'APAGAR': 2, 'ESCALAR': 3, 'AJUSTAR CREATIVO': 4 };

/** Todo lo que el tablero necesita para una semana, leído solo de la Sheet. */
function psArmarTablero_(sem) {
  var cfg = psReglas_(), hoy = psHoy_();
  var todos = psLeer_('hechos_semana');
  var hechos = todos.filter(function (h) { return h.semana === sem.id; });
  var pixel = psIndicePixel_(psLeer_('pixel_semana').filter(function (p) { return p.semana === sem.id; }));
  var pruebas = psLeer_('bitacora_pruebas');
  var negocio = psNegocio_();

  var conjuntos = hechos.map(function (h) {
    var serie = todos.filter(function (x) { return String(x.conjunto_id) === String(h.conjunto_id) && x.semana <= sem.id; })
      .sort(function (a, b) { return a.semana < b.semana ? -1 : 1; });
    var ev = psEvaluarConjunto_(h, serie, cfg, hoy, pruebas, negocio);
    return Object.assign({}, h, ev);
  }).sort(function (a, b) { return (Number(b.gasto) || 0) - (Number(a.gasto) || 0); });

  // Cuenta
  var neg = negocio[sem.wk] || null;
  var previas = psSemanasPrevias_(sem.wk, cfg.semanas_base);
  var baseRes = psPromedio_(previas.map(function (w) { return negocio[w] ? negocio[w].reservas : null; }));
  var baseCom = psPromedio_(previas.map(function (w) { return negocio[w] ? negocio[w].comensales : null; }));
  var nr = pixel[cfg.evento_conversion] ? Number(pixel[cfg.evento_conversion].conteo) : null;
  var vr = pixel['PageView·reservas'] ? Number(pixel['PageView·reservas'].conteo) : null;
  var alertasCuenta = [];
  if (!hechos.length) alertasCuenta.push({ nivel: 'rojo', texto: 'No hay hechos capturados de ' + sem.id + '. Presiona "Capturar semana".' });
  if (!neg || neg.reservas === null) alertasCuenta.push({ nivel: 'rojo', texto: 'Falta el dato de reservas de ' + sem.id + ' en pauta_semanal: sin el resultado del negocio no se decide.' });
  if (hechos.length && !Object.keys(pixel).length) alertasCuenta.push({ nivel: 'rojo', texto: 'No hay datos del pixel de ' + sem.id + '.' });
  if (neg && neg.reservas && nr !== null) {
    var desfase = Math.abs(nr - neg.reservas) / neg.reservas * 100;
    if (desfase > cfg.desfase_pixel_max) alertasCuenta.push({ nivel: 'amarillo',
      texto: 'El pixel contó ' + nr + ' reservas y Wix ' + neg.reservas + ' (' + Math.round(desfase) + '% de diferencia): revisar la instalación.' });
  }
  Object.keys(pixel).forEach(function (ev) {
    var c = psEventoContaminado_(ev, pixel, cfg);
    if (c) alertasCuenta.push({ nivel: 'amarillo', texto: c });
  });

  var decision = psDecisionSemana_(conjuntos, pruebas, hoy, alertasCuenta);

  return {
    semana: sem.id, desde: sem.desde, hasta: sem.hasta, hoy: hoy,
    cuenta: {
      reservas: neg ? neg.reservas : null, reservas_base: psRedondear_(baseRes, 1),
      comensales: neg ? neg.comensales : null, comensales_base: psRedondear_(baseCom, 1),
      clientes_nuevos: neg ? neg.clientes_nuevos : null,
      newreservation: nr, vistas_reservas: vr,
      tasa: (nr !== null && vr) ? psRedondear_(nr / vr * 100, 2) : null,
      gasto_meta: psRedondear_(hechos.reduce(function (s, h) { return s + (Number(h.gasto) || 0); }, 0), 2),
      reservas_atribuidas: hechos.reduce(function (s, h) { return s + (Number(h.reservas_atribuidas) || 0); }, 0),
      alertas: alertasCuenta
    },
    conjuntos: conjuntos,
    decision: decision,
    pixel: Object.keys(pixel).map(function (k) { return pixel[k]; })
  };
}

/**
 * UNA decisión por semana, por prioridad fija:
 *   1. leer la prueba que venció  2. no mover nada si hay una prueba en curso
 *   3. corregir datos  4. apagar  5. escalar  6. ajustar creativo  7. no mover nada.
 * Los datos de negocio faltantes bloquean todo lo que mueve dinero.
 */
function psDecisionSemana_(conjuntos, pruebas, hoy, alertasCuenta) {
  var vencida = pruebas.filter(function (p) { return p.estado === 'en_curso' && psDias_(hoy, p.fecha_lectura) <= 0; })[0];
  if (vencida) return { tipo: 'LEER PRUEBA', texto: 'Leer la prueba "' + vencida.hipotesis + '" (vencía el ' + vencida.fecha_lectura + ') y registrar el veredicto.', regla: 'R0 · Cerrar antes de abrir', prueba_id: vencida.id };
  var enCurso = pruebas.filter(function (p) { return p.estado === 'en_curso'; })[0];
  var sinNegocio = alertasCuenta.some(function (a) { return a.nivel === 'rojo'; });

  var candidatos = conjuntos.filter(function (c) { return PS_PRIORIDAD[c.estado]; })
    .sort(function (a, b) { return PS_PRIORIDAD[a.estado] - PS_PRIORIDAD[b.estado] || (Number(b.gasto) || 0) - (Number(a.gasto) || 0); });
  var corregir = candidatos.filter(function (c) { return c.estado === 'CORREGIR'; })[0];
  if (corregir) return { tipo: 'CORREGIR', texto: corregir.conjunto + ': ' + corregir.accion, razon: corregir.razon, regla: corregir.regla, conjunto_id: corregir.conjunto_id, conjunto: corregir.conjunto };
  if (enCurso) return { tipo: 'NO MOVER NADA', texto: 'Hay una prueba en curso ("' + enCurso.hipotesis + '") hasta el ' + enCurso.fecha_lectura + '. Un cambio a la vez.', regla: 'R0 · Un cambio a la vez' };
  if (sinNegocio) return { tipo: 'NO MOVER NADA', texto: 'Faltan hechos de la semana (ver alertas de la cuenta). Sin el resultado del negocio no se mueve dinero.', regla: 'R0 · Sin hechos no hay decisión' };
  var c = candidatos[0];
  if (c) return { tipo: c.estado, texto: c.conjunto + ': ' + c.accion, razon: c.razon, regla: c.regla, conjunto_id: c.conjunto_id, conjunto: c.conjunto };
  return { tipo: 'NO MOVER NADA', texto: 'Ninguna regla pide un cambio esta semana.', regla: 'R7 · Estabilidad' };
}

/* -------------------------------------------------- funciones de la pantalla --- */

function psEsDueno_(u) { return normalizar_(u && u.rol) === 'dueno'; }

/** Semanas con hechos capturados, la más reciente primero. */
function psSemanasCapturadas_() {
  var vistas = {};
  psLeer_('hechos_semana').forEach(function (h) { vistas[h.semana] = 1; });
  return Object.keys(vistas).sort().reverse();
}

function psTablero(semanaId, auth) {
  var u = requiereSoloMarketing_(auth);
  var semanas = psSemanasCapturadas_();
  var sem = psSemanaPorId_(semanaId) || psSemanaPorId_(semanas[0]) || psSemanaCerrada_();
  var t = psArmarTablero_(sem);
  t.semanas = semanas;
  t.semana_cerrada = psSemanaCerrada_().id;
  t.esDueno = psEsDueno_(u);
  t.puedeEditar = !!u.puedeEditar;
  t.reglas = psLeer_('reglas');
  t.supuestos = psLeer_('supuestos');
  t.pruebas = psLeer_('bitacora_pruebas').sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  t.metricas_juez = PS_METRICAS_JUEZ;
  t.linea_base = psLineasBase_(sem);
  return JSON.parse(JSON.stringify(t)); // google.script.run no pasa Date ni undefined
}

/** Línea base de cada métrica juez: promedio de las semanas previas. */
function psLineasBase_(sem) {
  var cfg = psReglas_(), negocio = psNegocio_();
  var previas = [sem.wk].concat(psSemanasPrevias_(sem.wk, cfg.semanas_base - 1));
  var pixel = psLeer_('pixel_semana'), hechos = psLeer_('hechos_semana');
  return {
    reservas_negocio: psRedondear_(psPromedio_(previas.map(function (w) { return negocio[w] ? negocio[w].reservas : null; })), 1),
    comensales_negocio: psRedondear_(psPromedio_(previas.map(function (w) { return negocio[w] ? negocio[w].comensales : null; })), 1),
    newreservation_pixel: psRedondear_(psPromedio_(previas.map(function (w) {
      var p = pixel.filter(function (x) { return Number(x.wk) === w && x.evento === cfg.evento_conversion; })[0];
      return p ? Number(p.conteo) : null;
    })), 1),
    reservas_atribuidas: psRedondear_(psPromedio_(previas.map(function (w) {
      var hs = hechos.filter(function (x) { return Number(x.wk) === w; });
      return hs.length ? hs.reduce(function (s, x) { return s + (Number(x.reservas_atribuidas) || 0); }, 0) : null;
    })), 1)
  };
}

/** Valor de una métrica juez entre dos fechas: promedio semanal. Para leer pruebas. */
function psValorMetrica_(metrica, desdeIso, hastaIso) {
  var cfg = psReglas_();
  var a = psSemanaDe_(new Date(String(desdeIso).slice(0, 10) + 'T12:00:00'));
  var b = psSemanaDe_(new Date(String(hastaIso).slice(0, 10) + 'T12:00:00'));
  var wks = [];
  for (var w = a.wk; w <= b.wk; w++) wks.push(w);
  if (metrica === 'reservas_negocio' || metrica === 'comensales_negocio') {
    var negocio = psNegocio_(), campo = metrica === 'reservas_negocio' ? 'reservas' : 'comensales';
    return psRedondear_(psPromedio_(wks.map(function (x) { return negocio[x] ? negocio[x][campo] : null; })), 1);
  }
  if (metrica === 'newreservation_pixel') {
    var pixel = psLeer_('pixel_semana');
    return psRedondear_(psPromedio_(wks.map(function (x) {
      var p = pixel.filter(function (r) { return Number(r.wk) === x && r.evento === cfg.evento_conversion; })[0];
      return p ? Number(p.conteo) : null;
    })), 1);
  }
  var hechos = psLeer_('hechos_semana');
  return psRedondear_(psPromedio_(wks.map(function (x) {
    var hs = hechos.filter(function (r) { return Number(r.wk) === x; });
    return hs.length ? hs.reduce(function (s, r) { return s + (Number(r.reservas_atribuidas) || 0); }, 0) : null;
  })), 1);
}

/** Captura a mano (botón). Por defecto la última semana cerrada. */
function psCapturarManual(semanaId, auth) {
  var u = requiereSoloMarketing_(auth);
  if (!u.puedeEditar) throw new Error('Tu usuario es de solo lectura.');
  var sem = psSemanaPorId_(semanaId) || psSemanaCerrada_();
  return psCapturar_(sem);
}

/**
 * Activador semanal (lunes). Captura la semana que cerró el domingo.
 * Va sin guarda de identidad porque la corre el activador; la bateria la tiene en
 * LIBRES. Solo lee Meta y escribe hechos de la semana cerrada, idempotente, y un
 * candado de caché evita que alguien la dispare en ráfaga desde el navegador.
 */
function psCapturaLunes() {
  var cache = CacheService.getScriptCache();
  if (cache.get('ps_captura_corriendo')) return { omitida: 'ya corrió en la última hora' };
  cache.put('ps_captura_corriendo', '1', 3600);
  return psCapturar_(psSemanaCerrada_());
}

function psGuardarRegla(id, valor, auth) {
  var u = requiereSoloMarketing_(auth);
  if (!psEsDueno_(u)) throw new Error('Las reglas las cambia solo el dueño. Proponé el cambio en la bitácora.');
  var base = PS_REGLAS_BASE.filter(function (r) { return r[0] === id; })[0];
  if (!base) throw new Error('Regla desconocida: ' + id);
  if (typeof base[1] === 'number' && isNaN(Number(valor))) throw new Error('La regla ' + id + ' lleva un número.');
  return psUpsert_('reglas', { id: id, valor: typeof base[1] === 'number' ? Number(valor) : String(valor),
                               editado_por: u.email, editado_el: psHoy_() });
}

function psGuardarSupuesto(row, auth) {
  var u = requiereSoloMarketing_(auth);
  if (!psEsDueno_(u)) throw new Error('Los supuestos los cambia solo el dueño.');
  row = row || {};
  if (!row.afirmacion && !row.id) throw new Error('Falta la afirmación.');
  if (row.estado && ['verificado', 'por_verificar', 'falso'].indexOf(row.estado) === -1) throw new Error('Estado inválido.');
  if (!row.id) row.id = 's' + Date.now();
  if (row.estado === 'verificado' && !row.verificado_el) row.verificado_el = psHoy_();
  row.editado_por = u.email;
  return psUpsert_('supuestos', row);
}

/**
 * Bitácora. Cualquiera con edición propone; solo el dueño pone una prueba en curso,
 * la cierra con veredicto o la descarta. Al cerrarla, el aprendizaje va a la pestaña
 * aprendizajes y el supuesto ligado queda como diga el veredicto.
 */
function psGuardarPrueba(row, auth) {
  var u = requiereSoloMarketing_(auth);
  if (!u.puedeEditar) throw new Error('Tu usuario es de solo lectura.');
  row = row || {};
  var previa = row.id ? psLeer_('bitacora_pruebas').filter(function (p) { return p.id === row.id; })[0] : null;
  var estado = row.estado || (previa && previa.estado) || 'propuesta';
  if (PS_PRUEBA_ESTADOS.indexOf(estado) === -1) throw new Error('Estado de prueba inválido.');
  var cambiaEstado = !previa ? estado !== 'propuesta' : estado !== previa.estado;
  if ((cambiaEstado || row.veredicto) && !psEsDueno_(u)) throw new Error('Aprobar, cerrar o descartar una prueba lo hace solo el dueño.');
  if (row.metrica_juez && !PS_METRICAS_JUEZ[row.metrica_juez]) throw new Error('Métrica juez inválida.');

  if (!previa) {
    if (!row.hipotesis || !row.cambio) throw new Error('Una prueba necesita hipótesis y cambio.');
    row.id = 'p' + Date.now();
    row.fecha = psHoy_();
    row.autor = u.email;
  }
  row.estado = estado;
  if (estado === 'en_curso' && (!previa || previa.estado !== 'en_curso')) {
    var otra = psLeer_('bitacora_pruebas').filter(function (p) { return p.estado === 'en_curso' && p.id !== row.id; })[0];
    if (otra) throw new Error('Ya hay una prueba en curso ("' + otra.hipotesis + '"). Un cambio a la vez.');
    var cfg = psReglas_();
    row.fecha_inicio = row.fecha_inicio || psHoy_();
    if (!row.fecha_lectura) {
      var f = new Date(row.fecha_inicio + 'T12:00:00');
      f.setDate(f.getDate() + Math.max(7, cfg.dias_minimos));
      row.fecha_lectura = psIso_(f);
    }
    var m = row.metrica_juez || (previa && previa.metrica_juez);
    if (!m) throw new Error('Elegí la métrica juez antes de arrancar la prueba.');
    if (row.linea_base === undefined || row.linea_base === '') {
      row.linea_base = (previa && previa.linea_base !== '') ? previa.linea_base : psLineasBase_(psSemanaCerrada_())[m];
    }
  }
  if (estado === 'leida') {
    var p = Object.assign({}, previa || {}, row);
    if (!p.veredicto) throw new Error('Para cerrar la prueba falta el veredicto.');
    if (!p.resultado && p.fecha_inicio && p.metrica_juez) {
      row.resultado = psValorMetrica_(p.metrica_juez, p.fecha_inicio, p.fecha_lectura || psHoy_());
    }
    if (p.aprendizaje) {
      psUpsertAprendizaje_({ id: 'apr_' + (row.id || previa.id), fecha: psHoy_(), fuente: 'prueba',
        hallazgo: p.aprendizaje, accion: 'Veredicto: ' + p.veredicto + ' · ' + p.hipotesis });
    }
    if (p.supuesto_id && ['verificado', 'falso'].indexOf(p.supuesto_queda) !== -1) {
      psUpsert_('supuestos', { id: p.supuesto_id, estado: p.supuesto_queda, verificado_el: psHoy_(),
        fuente: 'Prueba ' + (row.id || previa.id) + ': ' + p.veredicto, editado_por: u.email });
    }
  }
  return psUpsert_('bitacora_pruebas', row);
}

/** aprendizajes vive en SCHEMA de MarketingDatos: upsert por id sin tocar el resto. */
function psUpsertAprendizaje_(row) {
  var head = SCHEMA.aprendizajes;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = mktSheet_('aprendizajes');
    var vals = sh.getDataRange().getValues(), idx = -1;
    for (var i = 1; i < vals.length; i++) if (String(vals[i][0]) === row.id) { idx = i + 1; break; }
    var linea = head.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    if (idx > 0) sh.getRange(idx, 1, 1, head.length).setValues([linea]);
    else sh.appendRow(linea);
  } finally {
    lock.releaseLock();
  }
}

/** Para el estándar creativo de pauta: solo los supuestos verificados y vigentes. */
function psSupuestosVerificados(auth) {
  requiereMarketing_(null, auth);
  var hoy = psHoy_();
  var ok = psLeer_('supuestos').filter(function (s) {
    return s.estado === 'verificado' && (!s.vence_el || String(s.vence_el) >= hoy);
  });
  if (!ok.length) return '';
  return '\n\nHECHOS VERIFICADOS (solo estos se dan por ciertos; cualquier otra cifra es un supuesto y se dice así):\n' +
    ok.map(function (s) { return '- ' + s.afirmacion + ' (' + s.fuente + ')'; }).join('\n');
}
