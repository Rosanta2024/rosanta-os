/**
 * Por dónde salen los avisos. Cada adaptador recibe `fetch` de afuera: en las pruebas es un doble y
 * NADA sale a la red.
 *
 *   Resend (correo)     POST https://api.resend.com/emails · llave RESEND_API_KEY (Secret Manager; hoy no existe)
 *                       desde reservas@rosanta.rest, con respuesta a restaurante@rosanta.rest
 *   Sombra              envuelve al de correo: TODO va solo a restaurante@rosanta.rest, con el destinatario
 *                       real tapado en el asunto. Lo que iba por WhatsApp también llega como correo.
 *   WhatsApp (Meta)     POST https://graph.facebook.com/<versión>/<PHONE_ID>/messages, plantillas de utilidad con
 *                       botón de enlace (https://www.rosanta.rest/r/{{1}}). Apagado por defecto (WHATSAPP_AVISOS=encendido).
 *   Webhook de Resend   firmaResendValida(): firma Svix (svix-id, svix-timestamp, svix-signature) con RESEND_WEBHOOK_SECRETO.
 */
const crypto = require('crypto');
const { ocultarCorreo, ocultarTelefono } = require('./formato');

const RESEND_URL = 'https://api.resend.com/emails';
const CORREO_SOMBRA = 'restaurante@rosanta.rest';

class ErrorEnvio extends Error {
  constructor(mensaje, opciones) { super(mensaje); this.reintentable = !!(opciones && opciones.reintentable); this.status = opciones && opciones.status; }
}

async function leerRespuesta(r) {
  const t = await r.text().catch(() => '');
  try { return JSON.parse(t); } catch (e) { return { crudo: t.slice(0, 300) }; }
}

/** Correo por Resend. */
function crearCorreoResend(cfg) {
  const c = cfg || {};
  const f = c.fetch || globalThis.fetch;
  const remitente = c.remitente || 'Rosanta <reservas@rosanta.rest>';
  return {
    canal: 'correo', nombre: 'resend',
    async enviar(m) {
      if (!c.apiKey) throw new ErrorEnvio('Falta RESEND_API_KEY: el correo no salió.');
      const cuerpo = {
        from: remitente,
        to: [].concat(m.to),
        subject: m.asunto,
        html: m.html,
        text: m.texto,
        reply_to: c.responderA || CORREO_SOMBRA,
        tags: (m.etiquetas || []).map((e) => ({ name: e.name, value: String(e.value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) })),
        attachments: (m.adjuntos || []).map((a) => ({ filename: a.nombre, content: Buffer.from(a.contenido, 'utf8').toString('base64'), content_type: a.tipo }))
      };
      const cab = { Authorization: 'Bearer ' + c.apiKey, 'Content-Type': 'application/json' };
      if (m.idempotencia) cab['Idempotency-Key'] = String(m.idempotencia).slice(0, 256);
      const r = await f(RESEND_URL, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo) });
      const j = await leerRespuesta(r);
      if (!r.ok) throw new ErrorEnvio('Resend respondió ' + r.status + ': ' + String(j.message || j.name || j.crudo || '').slice(0, 200), { reintentable: r.status === 429 || r.status >= 500, status: r.status });
      if (!j.id) throw new ErrorEnvio('Resend no devolvió el id del correo.');
      return { id: String(j.id) };
    }
  };
}

/** Sombra: cualquier correo va SOLO a restaurante@ (o al destino que se pase, que también debe ser de rosanta.rest). */
function crearSombra(correo, cfg) {
  const destino = (cfg && cfg.destino) || CORREO_SOMBRA;
  if (!/@rosanta\.rest$/i.test(destino)) throw new Error('La sombra solo puede mandar a una casilla de rosanta.rest.');
  return {
    canal: 'correo', nombre: 'sombra:' + correo.nombre, sombra: true,
    async enviar(m) {
      const real = [].concat(m.to).map(ocultarCorreo).join(', ');
      return correo.enviar(Object.assign({}, m, { to: [destino], asunto: '[SOMBRA → ' + real + '] ' + m.asunto, idempotencia: m.idempotencia ? 'sombra-' + m.idempotencia : undefined }));
    },
    /** Lo que iba por WhatsApp, como correo a restaurante@ para revisarlo. */
    async enviarWhatsappComoCorreo(w) {
      const texto = 'Este mensaje habría salido por WhatsApp a ' + ocultarTelefono(w.to) + ' con la plantilla ' + w.plantilla + ' (' + w.idioma + '):\n\n' + w.cuerpo;
      return correo.enviar({ to: [destino], asunto: '[SOMBRA WhatsApp → ' + ocultarTelefono(w.to) + '] ' + w.plantilla, texto,
        html: '<pre style="font-family:inherit;white-space:pre-wrap">' + texto.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x])) + '</pre>',
        etiquetas: w.etiquetas, idempotencia: w.idempotencia ? 'sombra-' + w.idempotencia : undefined });
    }
  };
}

/** WhatsApp por la Cloud API de Meta: solo plantillas aprobadas (fuera de la ventana de 24 h no se puede otra cosa). */
function crearWhatsappMeta(cfg) {
  const c = cfg || {};
  const f = c.fetch || globalThis.fetch;
  const version = c.version || 'v21.0';
  const idiomas = Object.assign({ es: 'es', en: 'en' }, c.idiomas || {});
  return {
    canal: 'whatsapp', nombre: 'meta',
    async enviar(w) {
      if (!c.token || !c.phoneId) throw new ErrorEnvio('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID: el WhatsApp no salió.');
      const to = String(w.to || '').replace(/[^0-9]/g, '');
      if (to.length < 8) throw new ErrorEnvio('Teléfono inválido para WhatsApp.');
      const cuerpo = {
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: w.plantilla, language: { code: idiomas[w.idioma] || 'en' },
          components: [{ type: 'body', parameters: (w.parametros || []).map((t) => ({ type: 'text', text: String(t) })) }]
            .concat(w.boton_sufijo ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(w.boton_sufijo) }] }] : []) }
      };
      const r = await f('https://graph.facebook.com/' + version + '/' + encodeURIComponent(c.phoneId) + '/messages', {
        method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await leerRespuesta(r);
      if (!r.ok) throw new ErrorEnvio('Meta respondió ' + r.status + ': ' + String((j.error && j.error.message) || j.crudo || '').slice(0, 200), { reintentable: r.status === 429 || r.status >= 500, status: r.status });
      const id = j.messages && j.messages[0] && j.messages[0].id;
      if (!id) throw new ErrorEnvio('Meta no devolvió el id del mensaje.');
      return { id: String(id) };
    }
  };
}

/**
 * Arma los canales según el entorno. modo: 'apagado' (default) | 'sombra' | 'vivo'.
 * env: { AVISOS_MODO, RESEND_API_KEY, AVISOS_REMITENTE, WHATSAPP_AVISOS, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID }
 */
function canalesDesdeEntorno(env, fetchImpl) {
  const e = env || {};
  const modo = ['sombra', 'vivo'].indexOf(e.AVISOS_MODO) !== -1 ? e.AVISOS_MODO : 'apagado';
  const resend = crearCorreoResend({ apiKey: e.RESEND_API_KEY, remitente: e.AVISOS_REMITENTE, fetch: fetchImpl });
  const correo = modo === 'sombra' ? crearSombra(resend, { destino: e.AVISOS_SOMBRA_CORREO }) : resend;
  const whatsapp = e.WHATSAPP_AVISOS === 'encendido'
    ? crearWhatsappMeta({ token: e.WHATSAPP_TOKEN, phoneId: e.WHATSAPP_PHONE_ID, version: e.WHATSAPP_VERSION, fetch: fetchImpl })
    : null;
  return { modo, correo, whatsapp };
}

function iguales(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** Firma de los webhooks de Resend (Svix): "v1,<base64>" de HMAC-SHA256(id.timestamp.cuerpo); 5 minutos de margen. */
function firmaResendValida(secreto, cab, cuerpo, ahoraMs) {
  const id = cab['svix-id'], ts = cab['svix-timestamp'], firmas = String(cab['svix-signature'] || '');
  if (!secreto || !id || !ts || !firmas) return false;
  if (Math.abs((ahoraMs || Date.now()) / 1000 - Number(ts)) > 300) return false;
  const llave = Buffer.from(String(secreto).replace(/^whsec_/, ''), 'base64');
  const esperada = crypto.createHmac('sha256', llave).update(id + '.' + ts + '.' + cuerpo).digest('base64');
  return firmas.split(' ').some((f) => { const i = f.indexOf(','); return f.slice(0, i) === 'v1' && iguales(f.slice(i + 1), esperada); });
}

module.exports = { firmaResendValida, RESEND_URL, CORREO_SOMBRA, ErrorEnvio, crearCorreoResend, crearSombra, crearWhatsappMeta, canalesDesdeEntorno };
