/**
 * ROSANTA · BOT — DIAGNÓSTICO DE CANALES (16-oct-2026), SOLO LECTURA.
 * Pregunta: ¿por qué Instagram no registró nada del 26-sep al 7-oct?
 * Cuenta, en la bandeja de Meta, los mensajes de clientes de ese tramo y los
 * compara con lo que el bot anotó en Conversaciones. Si Meta tiene mensajes que
 * el bot no anotó, el webhook no los entregó. No cambia nada ni manda mensajes.
 * Archivo aparte (no toca Code.js) para que al abrirlo quede elegida esta función.
 */
function diagnosticoCanales() {
  var v = CONFIG.GRAPH_VERSION;
  var desde = new Date('2026-09-20T00:00:00-06:00'), hasta = new Date('2026-10-12T00:00:00-06:00');
  var hueco = [new Date('2026-09-26T11:28:00-06:00'), new Date('2026-10-07T15:51:00-06:00')];
  function dia(d) { return Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd'); }

  // 1) Activadores del bot (¿existe el refresco semanal del token de IG?)
  try {
    console.log('Activadores: ' + ScriptApp.getProjectTriggers().map(function (t) {
      return t.getHandlerFunction() + '(' + t.getEventType() + ')';
    }).join(', '));
  } catch (e) { console.log('Activadores → no se pudieron leer: ' + e); }

  // 2) Lo que el bot anotó en Conversaciones, por día, en el tramo
  var anotados = {};
  try {
    var hoja = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('Conversaciones');
    var n = hoja.getLastRow();
    var ini = Math.max(2, n - 4000);
    hoja.getRange(ini, 1, n - ini + 1, 5).getValues().forEach(function (r) {
      if (!(r[0] instanceof Date) || r[0] < desde || r[0] >= hasta || r[4] !== 'in') return;
      var k = r[1] + '|' + dia(r[0]);
      anotados[k] = (anotados[k] || 0) + 1;
    });
  } catch (e) { console.log('Conversaciones → ' + e); }

  // 3) Lo que Meta tiene en la bandeja (mensajes de clientes, no los nuestros)
  function bandeja(nombre, base, token, propio, extra) {
    var porDia = {}, total = 0, enHueco = [], url = base + '/me/conversations?' + extra +
      'fields=updated_time,messages.limit(100){created_time,from}&limit=50';
    var paginas = 0;
    try {
      while (url && paginas < 15) {
        paginas++;
        var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
        if (r.getResponseCode() !== 200) { console.log(nombre + ' → HTTP ' + r.getResponseCode() + ': ' + r.getContentText().substring(0, 500)); return; }
        var j = JSON.parse(r.getContentText());
        var masViejo = null;
        (j.data || []).forEach(function (c) {
          var ut = new Date(c.updated_time);
          if (!masViejo || ut < masViejo) masViejo = ut;
          ((c.messages && c.messages.data) || []).forEach(function (m) {
            var t = new Date(m.created_time);
            var de = m.from || {};
            if (t < desde || t >= hasta || String(de.id) === String(propio)) return;
            if (propio === null && de.username && /rosanta/i.test(de.username)) return;
            total++;
            var k = dia(t);
            porDia[k] = (porDia[k] || 0) + 1;
            if (t >= hueco[0] && t < hueco[1]) enHueco.push(Utilities.formatDate(t, 'America/Guatemala', 'dd-MMM HH:mm') + ' ' + (de.username || de.name || de.id));
          });
        });
        url = (j.paging && j.paging.next && masViejo && masViejo >= desde) ? j.paging.next : null;
      }
    } catch (e) { console.log(nombre + ' → EXCEPCIÓN ' + e); return; }
    console.log(nombre + ' · mensajes de clientes en Meta del 20-sep al 11-oct: ' + total + ' (' + paginas + ' páginas)');
    Object.keys(porDia).sort().forEach(function (k) {
      var canal = nombre === 'Instagram' ? 'instagram' : 'messenger';
      console.log('   ' + k + ': Meta ' + porDia[k] + ' · bot anotó ' + (anotados[canal + '|' + k] || 0));
    });
    console.log(nombre + ' · DENTRO DEL HUECO (26-sep 11:28 → 7-oct 15:51): ' + enHueco.length +
      (enHueco.length ? '\n   ' + enHueco.join('\n   ') : ''));
  }

  var igId = null;
  try {
    var me = UrlFetchApp.fetch('https://graph.instagram.com/' + v + '/me?fields=user_id,username', { headers: { Authorization: 'Bearer ' + CONFIG.IG_TOKEN }, muteHttpExceptions: true });
    console.log('Instagram cuenta → HTTP ' + me.getResponseCode() + ': ' + me.getContentText().substring(0, 300));
    var jm = JSON.parse(me.getContentText());
    igId = jm.user_id || jm.id || null;
  } catch (e) { console.log('Instagram cuenta → ' + e); }
  try {
    var s = UrlFetchApp.fetch('https://graph.instagram.com/' + v + '/me/subscribed_apps', { headers: { Authorization: 'Bearer ' + CONFIG.IG_TOKEN }, muteHttpExceptions: true });
    console.log('Instagram suscripción → HTTP ' + s.getResponseCode() + ': ' + s.getContentText().replace(/"id":"\d+"/g, '').substring(0, 500));
  } catch (e) { console.log('Instagram suscripción → ' + e); }
  bandeja('Instagram', 'https://graph.instagram.com/' + v, CONFIG.IG_TOKEN, igId, 'platform=instagram&');

  var pageId = null;
  try {
    var mp = UrlFetchApp.fetch('https://graph.facebook.com/' + v + '/me?fields=id,name', { headers: { Authorization: 'Bearer ' + CONFIG.MESSENGER_TOKEN }, muteHttpExceptions: true });
    console.log('Página → HTTP ' + mp.getResponseCode() + ': ' + mp.getContentText().substring(0, 200));
    pageId = JSON.parse(mp.getContentText()).id || null;
    var sp = UrlFetchApp.fetch('https://graph.facebook.com/' + v + '/me/subscribed_apps', { headers: { Authorization: 'Bearer ' + CONFIG.MESSENGER_TOKEN }, muteHttpExceptions: true });
    console.log('Página suscripción → HTTP ' + sp.getResponseCode() + ': ' + sp.getContentText().substring(0, 500));
  } catch (e) { console.log('Página → ' + e); }
  bandeja('Messenger', 'https://graph.facebook.com/' + v, CONFIG.MESSENGER_TOKEN, pageId, '');

  console.log('Fin. Si Meta tiene mensajes DENTRO DEL HUECO y el bot anotó 0 esos días, el webhook no los entregó.');
}
