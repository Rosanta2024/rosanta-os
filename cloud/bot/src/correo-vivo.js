/**
 * Correo del bot en vivo (19-oct-2026, APAGADO). Lo que en Apps Script era MailApp.sendEmail (el aviso
 * "🔔 Lead para atender", que lee la revision diaria del pipeline, y los avisos de reservas) y GmailApp.createDraft
 * (respuestas de la consola a un correo) sale por la API de Gmail como restaurante@rosanta.rest.
 *
 * Necesita una autorizacion de Juanma una sola vez (secreto bot-gmail: client_id, client_secret, refresh_token).
 * Sin ella, o si Gmail falla, el correo queda en bot_correos y se reintenta cada minuto: no se pierde.
 */
function base64url(s) { return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

/** El correo en formato RFC 822 (UTF-8, asunto codificado). */
function armarMime(para, asunto, cuerpo) {
  return ['To: ' + para, 'Subject: =?UTF-8?B?' + Buffer.from(String(asunto), 'utf8').toString('base64') + '?=', 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', String(cuerpo)].join('\r\n');
}

/** crearCorreo({ pool, gmail, fetch }) — gmail: { client_id, client_secret, refresh_token } o null. */
function crearCorreo(deps) {
  const f = deps.fetch || fetch;
  let token = null, vence = 0;
  async function accessToken() {
    if (token && Date.now() < vence) return token;
    const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: deps.gmail.client_id, client_secret: deps.gmail.client_secret, refresh_token: deps.gmail.refresh_token, grant_type: 'refresh_token' }).toString() });
    const j = await r.json();
    if (!j.access_token) throw new Error('Gmail no dio permiso: ' + (j.error || r.status));
    token = j.access_token; vence = Date.now() + ((j.expires_in || 3600) - 120) * 1000;
    return token;
  }
  async function mandarGmail(m) {
    const raw = base64url(armarMime(m.to, m.subject, m.body || ''));
    const url = m.borrador ? 'https://gmail.googleapis.com/gmail/v1/users/me/drafts' : 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const r = await f(url, { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' },
      body: JSON.stringify(m.borrador ? { message: { raw } } : { raw }) });
    if (r.status >= 300) throw new Error('Gmail ' + r.status + ': ' + String(await r.text()).slice(0, 200));
  }
  /** Manda; si no se puede, queda pendiente. Nunca tira error (el bot ya contesto al cliente). */
  async function enviar(m) {
    const asunto = (m.borrador ? '[borrador] ' : '') + (m.subject || '');
    try {
      if (!deps.gmail) throw new Error('Falta la autorizacion de Gmail (secreto bot-gmail).');
      await mandarGmail(m);
      return true;
    } catch (e) {
      await deps.pool.query('INSERT INTO bot_correos (para, asunto, cuerpo, intentos, error) VALUES ($1,$2,$3,1,$4)', [m.to || '', asunto, m.body || '', String(e.message).slice(0, 300)]);
      return false;
    }
  }
  async function reintentar() {
    if (!deps.gmail) return 0;
    const r = await deps.pool.query('SELECT id, para, asunto, cuerpo FROM bot_correos WHERE enviado IS NULL AND intentos < 20 ORDER BY id LIMIT 20');
    let n = 0;
    for (const x of r.rows) {
      const borrador = x.asunto.indexOf('[borrador] ') === 0;
      try {
        await mandarGmail({ to: x.para, subject: borrador ? x.asunto.slice(11) : x.asunto, body: x.cuerpo, borrador });
        await deps.pool.query('UPDATE bot_correos SET enviado = now(), error = NULL WHERE id = $1', [x.id]); n++;
      } catch (e) { await deps.pool.query('UPDATE bot_correos SET intentos = intentos + 1, error = $2 WHERE id = $1', [x.id, String(e.message).slice(0, 300)]); }
    }
    return n;
  }
  return { enviar, reintentar, accessToken };
}

module.exports = { crearCorreo, armarMime, base64url };
