/* Rosanta · fuente del tráfico (versión propia de src/pages/masterPage.js de Wix).
 * Guarda la PRIMERA fuente del visitante (referido + utm + gclid/fbclid) en localStorage
 * ('trafficSource', mismo nombre que en Wix) y la expone para que viaje con la reserva y el
 * carrito en el campo "fuente". Agrega el canal "IA" (ChatGPT, Perplexity, Gemini, Copilot,
 * Claude): ChatGPT agrega utm_source=chatgpt.com a sus enlaces.
 */
(function (root) {
  'use strict';

  var IA = /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|claude\.ai|you\.com|phind\.com|meta\.ai)$/i;
  var CLAVE = 'trafficSource';

  function host(u) {
    try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /** Igual que masterPage.js (mismo orden de precedencia) + canal. */
  function detectar(url, referrer) {
    var q = {};
    try { new URL(url).searchParams.forEach(function (v, k) { q[k] = v; }); } catch (e) {}
    var source = 'direct';
    if (q.gclid) source = 'google_ads';
    else if (q.fbclid) source = 'facebook_ads';
    else if (q.igshid) source = 'instagram_ads';
    else if (q.utm_source) {
      source = q.utm_source.toLowerCase();
      if (q.utm_medium && /^(cpc|ppc|cpm|cpv|cpe|cpa|cpl|cpi|paid)$/i.test(q.utm_medium)) source = source + '_ads';
    } else if (referrer) {
      var d = host(referrer);
      if (IA.test(d)) source = 'referral_' + d;
      else if (/(^|\.)google\.(com|es|mx|ar|cl|co|pe|ve|cr|gt|hn|ni|pa|sv|py|uy|bo|ec)$/i.test(d)) {
        if (/maps\.google/i.test(referrer)) source = 'google_maps';
        else if (/business\.google|maps\.google.*business/i.test(referrer)) source = 'google_my_business';
        else source = 'google_organic';
      } else if (/(^|\.)facebook\.(com|es)$/i.test(d)) source = 'facebook_organic';
      else if (/(^|\.)instagram\.com$/i.test(d)) source = 'instagram_organic';
      else if (/whatsapp\.com|wa\.me/i.test(d)) source = 'whatsapp';
      else if (/bing\.com|yahoo\.com|duckduckgo\.com|yandex\.(com|ru)|baidu\.com/i.test(d)) source = d.split('.')[0] + '_organic';
      else if (d && d !== host(url)) source = 'referral_' + d;
    }
    return {
      source: source,
      canal: canal(source, q, referrer),
      firstLanding: url,
      referrer: referrer || '',
      gclid: q.gclid || '',
      fbclid: q.fbclid || '',
      utm_source: q.utm_source || '',
      utm_medium: q.utm_medium || '',
      utm_campaign: q.utm_campaign || '',
      utm_content: q.utm_content || '',
      utm_term: q.utm_term || '',
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
  }

  /** Canal agrupado: IA, Pago, Orgánico, Social, Referido, WhatsApp, Directo. */
  function canal(source, q, referrer) {
    var u = (q && q.utm_source || '').toLowerCase().replace(/^www\./, '');
    var r = host(referrer || '');
    if (IA.test(u) || IA.test(r) || /^(chatgpt|openai|perplexity|gemini|copilot|claude)/.test(u)) return 'IA';
    if (/_ads$/.test(source)) return 'Pago';
    if (/organic$/.test(source) && /^(google|bing|yahoo|duckduckgo|yandex|baidu)/.test(source)) return 'Orgánico';
    if (/^google_(maps|my_business)$/.test(source)) return 'Google Maps';
    if (/^(facebook|instagram)/.test(source) || /^(facebook|instagram|ig|fb)/.test(u)) return 'Social';
    if (source === 'whatsapp') return 'WhatsApp';
    if (source === 'direct') return 'Directo';
    if (/^referral_/.test(source)) return 'Referido';
    return 'Campaña';
  }

  function leer() {
    try { var s = root.localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  function iniciar() {
    var guardada = leer();
    if (guardada) {
      if (!guardada.canal) guardada.canal = canal(guardada.source || 'direct', { utm_source: guardada.utm_source }, guardada.referrer);
      return guardada;
    }
    var f = detectar(root.location.href, root.document.referrer);
    try { root.localStorage.setItem(CLAVE, JSON.stringify(f)); } catch (e) {}
    return f;
  }

  var api = { detectar: detectar, canal: canal, iniciar: iniciar, obtener: function () { return leer() || iniciar(); } };
  root.RosantaFuente = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (root.location && root.document) {
    var f = iniciar();
    root.dataLayer = root.dataLayer || [];
    root.dataLayer.push({ event: 'fuente_trafico', fuente_source: f.source, fuente_canal: f.canal });
  }
})(typeof window !== 'undefined' ? window : globalThis);
