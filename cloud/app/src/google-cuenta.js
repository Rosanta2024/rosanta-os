/**
 * LA CUENTA DE GOOGLE DE ROSANTA EN LA NUBE (20-oct-2026, servicio de procesos).
 *
 * restaurante@rosanta.rest autorizo una vez (cloud/herramientas/autorizar-google.js) y el permiso vive en
 * Secret Manager (gmail-restaurante-oauth), que Cloud Run pasa como la variable GMAIL_OAUTH (JSON con
 * client_id, client_secret, refresh_token). Scopes: gmail.modify, gmail.send, drive.readonly, drive.file.
 *
 * El codigo de la intranet corre SINCRONICO (como Apps Script) y Gmail/Drive en Node son asincronicos. Por eso
 * cada proceso PRECARGA lo que va a necesitar (los mensajes, sus adjuntos, el texto de los PDF) con estas
 * funciones y despues corre el codigo real con un Gmail/Drive de mentira que contesta desde la precarga
 * (precargaGmail() → shimGmail()). Nada de HTTP sincronico.
 */
const URL_TOKEN = 'https://oauth2.googleapis.com/token';

function crearCuenta(opciones) {
  const o = opciones || {};
  const fetchFn = o.fetch || fetch;
  const cred = typeof o.credencial === 'string' ? JSON.parse(o.credencial) : o.credencial;
  if (!cred || !cred.refresh_token || !cred.client_id || !cred.client_secret) throw new Error('Falta el permiso de Google (GMAIL_OAUTH).');
  let token = null, vence = 0;

  async function accessToken() {
    if (token && Date.now() < vence - 60000) return token;
    const r = await fetchFn(URL_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cred.client_id, client_secret: cred.client_secret, refresh_token: cred.refresh_token, grant_type: 'refresh_token' }) });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error('Google no renovo el permiso de la cuenta (' + (j.error || r.status) + '): hay que volver a autorizar.');
    token = j.access_token; vence = Date.now() + 1000 * (j.expires_in || 3000);
    return token;
  }

  async function pedir(url, op) {
    const p = Object.assign({}, op || {});
    p.headers = Object.assign({ Authorization: 'Bearer ' + await accessToken() }, p.headers || {});
    for (let intento = 0; ; intento++) {
      const r = await fetchFn(url, p);
      if (r.status === 429 && intento < 4) { await new Promise((ok) => setTimeout(ok, 2000 * Math.pow(2, intento))); continue; }
      if (!r.ok) throw new Error('Google respondio ' + r.status + ' en ' + url.replace(/\?.*/, '') + ': ' + (await r.text()).slice(0, 200));
      return r;
    }
  }
  const json = async (url, op) => (await pedir(url, op)).json();
  const G = 'https://gmail.googleapis.com/gmail/v1/users/me';

  return {
    accessToken,
    /** Gmail.Users.Messages.list (solo ids). extra: { includeSpamTrash, pageToken } como el servicio avanzado. */
    gmailListar: (q, max, extra) => {
      const e = extra || {}, p = { q, maxResults: String(max || 60) };
      if (e.includeSpamTrash) p.includeSpamTrash = 'true';
      if (e.pageToken) p.pageToken = e.pageToken;
      return json(G + '/messages?' + new URLSearchParams(p));
    },
    /** Manda un correo de texto desde la cuenta (gmail.send). Para los avisos al dueño. */
    async gmailEnviar(para, asunto, cuerpo) {
      const enc = (t) => '=?UTF-8?B?' + Buffer.from(String(t), 'utf8').toString('base64') + '?=';
      const crudo = ['To: ' + para, 'Subject: ' + enc(asunto), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
        Buffer.from(String(cuerpo), 'utf8').toString('base64')].join('\r\n');
      return json(G + '/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: Buffer.from(crudo).toString('base64url') }) });
    },
    /** Gmail.Users.Messages.get, formato completo (como el servicio avanzado de Apps Script). */
    gmailMensaje: (id) => json(G + '/messages/' + encodeURIComponent(id) + '?format=full'),
    /** Gmail.Users.Messages.Attachments.get: {data: base64url}. */
    gmailAdjunto: (id, attId) => json(G + '/messages/' + encodeURIComponent(id) + '/attachments/' + encodeURIComponent(attId)),
    /**
     * El texto de un PDF como lo saca Apps Script: se sube convertido a Doc de Google, se exporta como texto y se
     * borra (drive.file: solo toca lo que crea esta misma app). Igual que _ciePdfTexto_ de la intranet.
     */
    async pdfATexto(bytes, nombre) {
      const limite = 'rosanta' + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: nombre || 'tmp_nube_pdf', mimeType: 'application/vnd.google-apps.document' });
      const cuerpo = Buffer.concat([
        Buffer.from('--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + limite + '\r\nContent-Type: application/pdf\r\n\r\n'),
        Buffer.from(bytes), Buffer.from('\r\n--' + limite + '--')]);
      const doc = await json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + limite }, body: cuerpo });
      try {
        return await (await pedir('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain')).text();
      } finally {
        await pedir('https://www.googleapis.com/drive/v3/files/' + doc.id, { method: 'DELETE' }).catch(() => {});
      }
    }
  };
}

/**
 * Precarga los mensajes de una busqueda de Gmail, completos y con sus adjuntos (los que pide `quiereAdjunto`).
 * Devuelve { lista, mensajes: {id: msg}, adjuntos: {'id|attId': {data}} } para shimGmail().
 * opciones: max (por pagina), quiereAdjunto(parte), incluirPapelera (includeSpamTrash, como FelCorreo y
 * BancoCorreo), paginas (cuantas paginas seguir, como el do/while de la intranet; por defecto 1). Con varias
 * paginas, la lista precargada queda en UNA sola (sin nextPageToken): el codigo real sale de su vuelta.
 */
async function precargaGmail(cuenta, q, opciones) {
  const o = opciones || {};
  let lista = null, tok = null, paginas = 0;
  do {
    const extra = {};
    if (o.incluirPapelera) extra.includeSpamTrash = true;
    if (tok) extra.pageToken = tok;
    const l = Object.keys(extra).length ? await cuenta.gmailListar(q, o.max || 60, extra) : await cuenta.gmailListar(q, o.max || 60);
    if (!lista) lista = Object.assign({}, l);
    else lista.messages = (lista.messages || []).concat(l.messages || []);
    tok = l && l.nextPageToken;
  } while (tok && ++paginas < (o.paginas || 1));
  if (lista && (o.paginas || 1) > 1) delete lista.nextPageToken;
  const mensajes = {}, adjuntos = {};
  for (const m of (lista.messages || [])) {
    const msg = await cuenta.gmailMensaje(m.id);
    mensajes[m.id] = msg;
    const cola = [msg.payload];
    while (cola.length) {
      const p = cola.shift();
      if (p && p.parts) cola.push(...p.parts);
      if (p && p.body && p.body.attachmentId && (!o.quiereAdjunto || o.quiereAdjunto(p))) {
        adjuntos[m.id + '|' + p.body.attachmentId] = await cuenta.gmailAdjunto(m.id, p.body.attachmentId);
      }
    }
  }
  return { q, lista, mensajes, adjuntos };
}

/** El servicio avanzado Gmail de Apps Script, sincronico, contestando desde una precarga. Solo lectura. */
function shimGmail(pre) {
  const no = (que) => () => { throw new Error('En la nube, Gmail.' + que + ' no esta disponible (solo lectura precargada).'); };
  return { Users: { Messages: {
    list: (_, op) => {
      if (op && op.q && pre.q && op.q !== pre.q) throw new Error('Se pidio una busqueda de Gmail que no se precargo: ' + op.q);
      return pre.lista;
    },
    get: (_, id) => { const m = pre.mensajes[id]; if (!m) throw new Error('Mensaje no precargado: ' + id); return m; },
    modify: no('Users.Messages.modify'), send: no('Users.Messages.send'), trash: no('Users.Messages.trash'),
    Attachments: { get: (_, id, att) => { const a = pre.adjuntos[id + '|' + att]; if (!a) throw new Error('Adjunto no precargado: ' + id); return a; } }
  } } };
}

module.exports = { crearCuenta, precargaGmail, shimGmail };
