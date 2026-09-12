/**
 * Servicios.gs — lo que en Cowork daba window.cowork (módulo Marketing).
 *
 * El sistema de Marketing usaba window.cowork.callMcpTool / askClaude para
 * cuatro cosas: Meta Ads (Dashboard), Drive (reportes semanales de Google Ads),
 * Ad Library (Espía) y Claude (Creador Kaprica). Ese puente NO existe fuera de
 * Cowork, así que aquí se reimplementa del lado del servidor.
 *
 * Estado por servicio:
 *  - Drive:  IMPLEMENTADO y sin credenciales extra (DriveApp usa la sesión).
 *  - Meta / Ad Library / Claude: requieren token en Propiedades del script.
 *    Sin token devuelven un error limpio y el módulo lo muestra en pantalla.
 *    Ver README_FASE_A.md > "Servicios pendientes".
 *
 * Propiedades del script (Configuración del proyecto > Propiedades):
 *   META_TOKEN        access token de sistema con ads_read/ads_management.
 *                     Es el mismo que Marketing OS ya usa como META_CAPI_TOKEN.
 *   ANTHROPIC_API_KEY para el Creador Kaprica.
 */

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

// ------------------------------------------------------------------ Drive
// Reportes semanales Rosanta_Reporte_Sxx.html que alimentan la serie de Google Ads.

/** Devuelve {files:[{id,title}]} — misma forma que daba el MCP de Drive. */
function driveBuscarReportes(auth) {
  requiereSoloMarketing_(auth);
  var it = DriveApp.searchFiles(
    'title contains "Rosanta_Reporte_S" and mimeType = "text/html" and trashed = false');
  var files = [];
  while (it.hasNext() && files.length < 30) {
    var f = it.next();
    files.push({ id: f.getId(), title: f.getName() });
  }
  return { files: files };
}

/** Devuelve {content:<base64>} — el cliente lo decodifica con b64utf8(). */
function driveDescargar(fileId, auth) {
  requiereSoloMarketing_(auth);
  var blob = DriveApp.getFileById(fileId).getBlob();
  return { content: Utilities.base64Encode(blob.getBytes()) };
}

// ------------------------------------------------------------------- Meta
// OJO: implementación SIN VERIFICAR. No se pudo probar en esta sesión porque
// clasp no tiene sesión y no hay META_TOKEN cargado. Revisar contra la
// respuesta real de Graph antes de darla por buena.

var AD_ACCOUNT_ID = '780001897477414';

/**
 * Campañas + insights del período. Devuelve {ad_entities:[...]} para que el
 * Dashboard lo consuma igual que consumía el MCP.
 */
/** GET a Graph con manejo de error uniforme. */
function graph_(ruta, params) {
  var tok = prop_('META_TOKEN');
  if (!tok) throw new Error('Falta META_TOKEN en Propiedades del script. El Dashboard queda sin data de Meta hasta cargarlo.');
  var qs = [];
  Object.keys(params).forEach(function (k) {
    qs.push(k + '=' + encodeURIComponent(params[k]));
  });
  qs.push('access_token=' + encodeURIComponent(tok));
  var url = 'https://graph.facebook.com/v19.0/' + ruta + '?' + qs.join('&');

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    var e = body.error || {};
    throw new Error('Meta ' + res.getResponseCode() + ' en /' + ruta + ': ' +
      (e.message || 'error desconocido') +
      (e.error_user_msg ? ' — ' + e.error_user_msg : ''));
  }
  return body;
}

/*
 * Métricas por campaña. Dos llamadas y un join por campaign_id.
 *
 * El intento anterior pedía insights como campo anidado sobre /campaigns
 * (insights.date_preset(x){...}) y Graph lo rechaza con "Invalid argument".
 * La forma soportada es el endpoint dedicado /insights con level=campaign;
 * nombre, estado y objetivo no viven ahí, así que salen de /campaigns aparte.
 *
 * 'frequency' a nivel campaña es válido en cuentas normales, pero según la
 * configuración Graph puede rechazarlo. Si eso pasa, se reintenta sin él en
 * vez de tumbar todo el Dashboard: es una columna, no la tabla.
 */
var META_INSIGHT_FIELDS = ['campaign_id', 'campaign_name', 'spend', 'impressions',
                           'reach', 'clicks', 'ctr', 'cpm', 'cpc', 'frequency'];

function metaInsights_(datePreset) {
  var pedir = function (campos) {
    return graph_('act_' + AD_ACCOUNT_ID + '/insights', {
      level: 'campaign',
      fields: campos.join(','),
      date_preset: datePreset || 'last_30d',
      limit: 500
    });
  };
  try {
    return { data: (pedir(META_INSIGHT_FIELDS).data || []), sinFrequency: false };
  } catch (err) {
    if (String(err).toLowerCase().indexOf('frequency') === -1) throw err;
    var sinFreq = META_INSIGHT_FIELDS.filter(function (f) { return f !== 'frequency'; });
    return { data: (pedir(sinFreq).data || []), sinFrequency: true };
  }
}

function metaEntities(datePreset, auth) {
  requiereSoloMarketing_(auth);

  var ins = metaInsights_(datePreset);
  var porId = {};
  ins.data.forEach(function (r) { if (r.campaign_id) porId[r.campaign_id] = r; });

  // Nombre/estado/objetivo: no existen en /insights.
  var camps = graph_('act_' + AD_ACCOUNT_ID + '/campaigns', {
    fields: 'name,status,objective',
    limit: 500
  }).data || [];

  var vistos = {};
  var ents = camps.map(function (c) {
    var i = porId[c.id] || {};
    vistos[c.id] = 1;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      spend: i.spend, impressions: i.impressions, reach: i.reach, clicks: i.clicks,
      ctr: i.ctr, cpm: i.cpm, cpc: i.cpc, frequency: i.frequency
    };
  });

  // Campañas con gasto que /campaigns no devolvió (borradas, o fuera del limit):
  // el nombre lo trae el propio insight, así que igual se muestran.
  ins.data.forEach(function (r) {
    if (r.campaign_id && !vistos[r.campaign_id]) {
      ents.push({
        id: r.campaign_id, name: r.campaign_name || '(sin nombre)',
        status: '', objective: '',
        spend: r.spend, impressions: r.impressions, reach: r.reach, clicks: r.clicks,
        ctr: r.ctr, cpm: r.cpm, cpc: r.cpc, frequency: r.frequency
      });
    }
  });

  return { ad_entities: ents, sinFrequency: ins.sinFrequency };
}

/**
 * Diagnóstico: corré esto desde el editor y pegame el Log.
 * Muestra el JSON crudo de la primera fila de cada llamada, que es lo único
 * que confirma el mapeo de verdad — el resto es suposición.
 */
function metaDiagnostico() {
  var ins = metaInsights_('last_30d');
  Logger.log('INSIGHTS: %s filas | frequency omitido: %s', ins.data.length, ins.sinFrequency);
  Logger.log('INSIGHTS fila[0] CRUDA:\n%s', JSON.stringify(ins.data[0] || null, null, 2));

  var camps = graph_('act_' + AD_ACCOUNT_ID + '/campaigns', { fields: 'name,status,objective', limit: 5 }).data || [];
  Logger.log('CAMPAIGNS: %s filas', camps.length);
  Logger.log('CAMPAIGNS fila[0] CRUDA:\n%s', JSON.stringify(camps[0] || null, null, 2));

  var out = metaEntities('last_30d');
  Logger.log('ad_entities: %s | fila[0] YA MAPEADA (esto es lo que ve el Dashboard):\n%s',
    out.ad_entities.length, JSON.stringify(out.ad_entities[0] || null, null, 2));
  return out.ad_entities[0] || null;
}

/**
 * Nombres de las propiedades del script, para cazar claves mal nombradas.
 * Devuelve SOLO los nombres y el largo del valor: nunca el valor, que un token
 * no tiene por que aparecer en una pagina web ni en un log.
 */
function propsDiagnostico() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var esperadas = ['META_TOKEN', 'ANTHROPIC_API_KEY', 'CONFIG_SHEET_ID', 'LEADS_SHEET_ID'];
  var lista = Object.keys(props).sort().map(function (k) {
    return { nombre: k, largoDelValor: String(props[k] || '').length };
  });
  var faltan = esperadas.filter(function (k) { return !props.hasOwnProperty(k); });
  return {
    registradas: lista,
    esperadasQueFaltan: faltan,
    nota: faltan.length
      ? 'Los nombres distinguen mayusculas. Si arriba hay una clave parecida a una que falta, esta mal nombrada: renombrala exactamente asi.'
      : 'Todas las esperadas estan registradas.'
  };
}

/**
 * Lo mismo que metaDiagnostico() pero para verlo en el navegador (?page=diag),
 * sin depender del editor de Apps Script ni de su cache. Devuelve datos, no
 * texto: la pagina los formatea.
 */
function metaDiagnosticoJson() {
  var salida = { ok: true, pasos: {} };
  try {
    var ins = metaInsights_('last_30d');
    salida.pasos.insights = {
      filas: ins.data.length,
      frequencyOmitido: ins.sinFrequency,
      filaCruda: ins.data[0] || null
    };
  } catch (err) {
    salida.ok = false;
    salida.pasos.insights = { error: String(err && err.message || err) };
  }
  try {
    var camps = graph_('act_' + AD_ACCOUNT_ID + '/campaigns',
                       { fields: 'name,status,objective', limit: 5 }).data || [];
    salida.pasos.campaigns = { filas: camps.length, filaCruda: camps[0] || null };
  } catch (err2) {
    salida.ok = false;
    salida.pasos.campaigns = { error: String(err2 && err2.message || err2) };
  }
  try {
    var out = metaEntities('last_30d');
    salida.pasos.mapeado = {
      filas: out.ad_entities.length,
      frequencyOmitido: out.sinFrequency,
      filaQueVeElDashboard: out.ad_entities[0] || null
    };
  } catch (err3) {
    salida.ok = false;
    salida.pasos.mapeado = { error: String(err3 && err3.message || err3) };
  }
  return salida;
}

/**
 * Espía: anuncios activos de la competencia. SIN VERIFICAR (ver nota arriba).
 *
 * El Espía consume la forma que devolvía el MCP —{results:{ads:[…]}}, con
 * ad_creation_time en epoch y ad_creative_link_title en singular—, que NO es
 * la de Graph. Por eso aquí se mapea explícitamente: devolver el JSON crudo
 * de Graph dejaría payload.results en undefined y el módulo reventaría.
 */
function adLibrarySearch(params, auth) {
  requiereSoloMarketing_(auth);
  var tok = prop_('META_TOKEN');
  if (!tok) throw new Error('Falta META_TOKEN en Propiedades del script. El Espía queda sin data hasta cargarlo.');

  var p = params || {};
  var paises = p.countries && p.countries.length ? p.countries : ['GT'];
  var campos = 'id,page_name,ad_creative_bodies,ad_creative_link_titles,' +
               'ad_delivery_start_time,ad_snapshot_url,publisher_platforms';
  var url = 'https://graph.facebook.com/v19.0/ads_archive' +
    '?ad_type=ALL' +
    '&ad_reached_countries=' + encodeURIComponent(JSON.stringify(paises)) +
    '&ad_active_status=' + encodeURIComponent(p.ad_active_status || 'ACTIVE') +
    '&search_terms=' + encodeURIComponent(p.search_terms || '') +
    '&fields=' + encodeURIComponent(campos) +
    '&limit=' + (p.limit || 25) +
    '&access_token=' + encodeURIComponent(tok);

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    throw new Error('Ad Library respondió ' + res.getResponseCode() + ': ' +
      ((body.error && body.error.message) || 'error desconocido'));
  }

  var ads = (body.data || []).map(function (a) {
    var t = a.ad_delivery_start_time ? new Date(a.ad_delivery_start_time).getTime() : 0;
    return {
      id: a.id,
      page_name: a.page_name || '(sin página)',
      ad_creative_link_title: (a.ad_creative_link_titles && a.ad_creative_link_titles[0]) ||
                              (a.ad_creative_bodies && a.ad_creative_bodies[0]) || '',
      ad_creation_time: t ? Math.floor(t / 1000) : null, // el cliente hace *1000
      ad_snapshot_url: a.ad_snapshot_url || '',
      publisher_platforms: a.publisher_platforms || []
    };
  });
  return { results: { ads: ads, estimated_total_count: ads.length } };
}

// ----------------------------------------------------------------- Claude
// Creador Kaprica. SIN VERIFICAR: falta ANTHROPIC_API_KEY para probarlo.

function askClaudeSrv(prompt, auth) {
  requiereMarketing_(null, auth);
  var key = prop_('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en Propiedades del script. El Creador Kaprica queda sin generación hasta cargarla.');

  // claude-opus-4-8: el modelo mas capaz. Kaprica escribe copy en voz de marca,
  // que es justo donde se nota. Sin bloque 'thinking': en Opus 4.8 omitirlo
  // corre sin pensar, y UrlFetchApp corta a los 60s — el pensamiento nos comeria
  // ese presupuesto. Por lo mismo max_tokens queda moderado: subirlo alarga la
  // respuesta y arriesga el timeout de Apps Script.
  var payload = {
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [{ role: 'user', content: String(prompt) }]
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    throw new Error('Claude respondió ' + res.getResponseCode() + ': ' +
      ((body.error && body.error.message) || 'error desconocido'));
  }
  return (body.content || []).map(function (b) { return b.text || ''; }).join('').trim();
}

/**
 * Investigación en vivo para el 🧠 Panel de Asesores.
 *
 * Corre ANTES del debate, en su propia llamada de google.script.run (así el
 * timeout de 60s de UrlFetch no se suma al del debate). Usa la búsqueda web
 * nativa de la API de Claude (máx 3 búsquedas) para verificar HOY lo que
 * dependa de mecánica actual de plataforma. Si falla o tarda de más, el
 * cliente lo tolera: el debate corre igual y lo declara, y aplica la regla
 * de humildad temporal con máximo rigor.
 */
function panelInvestigar(tema, auth) {
  requiereSoloMarketing_(auth);
  var key = prop_('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en Propiedades del script.');

  var payload = {
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{ role: 'user', content:
      'Eres el investigador del panel de asesores de marketing de Rosanta (restaurante de gastrococtelería en Antigua Guatemala; pauta en Meta Ads con presupuesto pequeño). Tema del debate de hoy:\n' + String(tema) +
      '\n\nBusca en la web SOLO lo que dependa de mecánica o datos ACTUALES relevantes al tema: algoritmos de entrega y tratamiento de creativos en Meta, formatos y políticas vigentes, benchmarks recientes, cambios de plataforma de los últimos meses. Máximo 3 búsquedas; si el tema depende de cero mecánica actual, responde "Sin dependencias de mecánica actual" y nada más.\nEntrega en español, máximo 15 líneas: **Hallazgos verificados hoy**, cada hallazgo en 1-2 líneas CON su fuente y URL visible entre paréntesis. Distingue documentación oficial de blogs de agencias. Si algo relevante quedó sin poder verificarse, dilo. Solo evidencia, sin recomendaciones.' }]
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    throw new Error('Investigación en vivo falló: ' +
      ((body.error && body.error.message) || ('HTTP ' + res.getResponseCode())));
  }
  return (body.content || []).map(function (b) { return b.text || ''; }).join('').trim();
}
