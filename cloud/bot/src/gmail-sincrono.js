/**
 * GmailApp del bot sobre la API de Gmail (20-oct-2026), para el canal de correo en la nube (Correo.js tal cual).
 *
 * Síncrono como en Apps Script: cada llamada va por pedido(url, opciones), el mismo que usa UrlFetchApp en vivo
 * (proceso aparte, con el token como marcador $GMAIL_TOKEN que se reemplaza fuera del motor).
 *
 * escribir: false (SOMBRA) → lee Gmail de verdad, pero reply, createDraftReply, createDraft y sendEmail NO salen:
 * quedan en registro[] para compararlos con lo que hizo el bot de Apps Script.
 *
 * Lo que Correo.js usa: GmailApp.search(q, start, max) → hilos con getId() y getMessages(); cada mensaje con getId,
 * getFrom, getTo, getSubject, getPlainBody, getDate, isDraft, reply(cuerpo, {name}), createDraftReply(cuerpo);
 * GmailApp.createDraft(to, asunto, cuerpo, {name}) y GmailApp.sendEmail(to, asunto, cuerpo, {name}).
 */
const API = 'https://gmail.googleapis.com/gmail/v1/users/me/';
const YO = 'restaurante@rosanta.rest';

function b64url(s) { return Buffer.from(String(s), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function deB64url(s) { return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function encab(m, n) {
  const h = ((m.payload && m.payload.headers) || []).find((x) => String(x.name).toLowerCase() === n.toLowerCase());
  return h ? String(h.value) : '';
}
/** El texto plano del mensaje: la parte text/plain; si no hay, el HTML sin etiquetas. */
function textoPlano(payload) {
  let plano = '', html = '';
  (function rec(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body && p.body.data && !plano) plano = deB64url(p.body.data);
    else if (p.mimeType === 'text/html' && p.body && p.body.data && !html) html = deB64url(p.body.data);
    (p.parts || []).forEach(rec);
  })(payload);
  if (plano) return plano;
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
/** Correo RFC 822 en UTF-8 (asunto codificado). extra: encabezados de respuesta (In-Reply-To, References). */
function mime(o) {
  const de = o.nombre ? '=?UTF-8?B?' + Buffer.from(o.nombre, 'utf8').toString('base64') + '?= <' + YO + '>' : YO;
  const l = ['From: ' + de, 'To: ' + o.para, 'Subject: =?UTF-8?B?' + Buffer.from(String(o.asunto || ''), 'utf8').toString('base64') + '?='];
  if (o.inReplyTo) l.push('In-Reply-To: ' + o.inReplyTo, 'References: ' + (o.references ? o.references + ' ' : '') + o.inReplyTo);
  l.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', String(o.cuerpo || ''));
  return l.join('\r\n');
}

/** crearGmailSincrono({ pedido, escribir, registro }) — pedido(url, opciones) → { getResponseCode, getContentText }. */
function crearGmailSincrono(deps) {
  const registro = deps.registro || [];
  const auth = { Authorization: 'Bearer $GMAIL_TOKEN' };
  const llamar = (ruta, metodo, cuerpo) => {
    const r = deps.pedido(API + ruta, { method: metodo || 'get', headers: auth, contentType: cuerpo ? 'application/json' : undefined,
      payload: cuerpo ? JSON.stringify(cuerpo) : undefined, muteHttpExceptions: true });
    const c = r.getResponseCode();
    if (c >= 300) throw new Error('Gmail ' + c + ' en ' + ruta.split('?')[0] + ': ' + String(r.getContentText()).slice(0, 160));
    return JSON.parse(r.getContentText() || '{}');
  };
  const salir = (tipo, datos, hacer) => {
    registro.push(Object.assign({ tipo }, datos));
    if (deps.escribir) hacer();
  };

  function mensaje(m, hiloId) {
    const asunto = encab(m, 'Subject');
    const responder = () => ({ para: encab(m, 'Reply-To') || encab(m, 'From'), asunto: /^re:/i.test(asunto) ? asunto : 'Re: ' + asunto,
      inReplyTo: encab(m, 'Message-ID') || encab(m, 'Message-Id'), references: encab(m, 'References') });
    return {
      getId: () => m.id,
      getFrom: () => encab(m, 'From'),
      getTo: () => encab(m, 'To'),
      getSubject: () => asunto,
      getPlainBody: () => textoPlano(m.payload),
      getDate: () => new Date(Number(m.internalDate)),
      isDraft: () => (m.labelIds || []).indexOf('DRAFT') >= 0,
      reply: (cuerpo, op) => {
        const o = Object.assign(responder(), { cuerpo, nombre: op && op.name });
        salir('respuesta', { hilo: hiloId, mensaje: m.id, para: o.para, cuerpo }, () => llamar('messages/send', 'post', { raw: b64url(mime(o)), threadId: hiloId }));
      },
      createDraftReply: (cuerpo) => {
        const o = Object.assign(responder(), { cuerpo });
        salir('borrador', { hilo: hiloId, mensaje: m.id, para: o.para, cuerpo }, () => llamar('drafts', 'post', { message: { raw: b64url(mime(o)), threadId: hiloId } }));
      }
    };
  }

  const hilo = (id) => {
    let msgs = null;   // se bajan solo si el bot los pide
    return { getId: () => id, getMessages: () => {
      if (!msgs) msgs = (llamar('threads/' + id + '?format=full').messages || []).map((m) => mensaje(m, id));
      return msgs;
    } };
  };

  return {
    search: (q, inicio, max) => {
      const lista = llamar('threads?q=' + encodeURIComponent(q) + '&maxResults=' + Math.min(Number(max) || 20, 100)).threads || [];
      return lista.slice(Number(inicio) || 0).map((t) => hilo(t.id));
    },
    // Solo lectura (la comparación de la noche, 20-oct-2026). Como en Apps Script: null si el hilo ya no existe.
    getThreadById: (id) => {
      const h = hilo(String(id));
      try { h.getMessages(); } catch (e) { if (/Gmail 404/.test(e.message)) return null; throw e; }
      return h;
    },
    createDraft: (para, asunto, cuerpo, op) => salir('borrador', { para, asunto, cuerpo },
      () => llamar('drafts', 'post', { message: { raw: b64url(mime({ para, asunto, cuerpo, nombre: op && op.name })) } })),
    sendEmail: (para, asunto, cuerpo, op) => salir('correo', { para, asunto, cuerpo },
      () => llamar('messages/send', 'post', { raw: b64url(mime({ para, asunto, cuerpo, nombre: op && op.name })) })),
    registro
  };
}

module.exports = { crearGmailSincrono, textoPlano, mime, b64url, deB64url };
