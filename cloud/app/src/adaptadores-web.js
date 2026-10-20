/**
 * Adaptadores de la web (AYUDANTE 4, 20-oct-2026): todo lo que sale del servidor pasa por aca, para que las
 * pruebas usen DOBLES y nada real se toque hasta encenderlo.
 *
 *   fotos        { guardar(ruta, buffer, tipo) → url publica }            Cloud Storage
 *   reconstruir  { reconstruir({ version_id, huella }) → { estado, detalle } }   gancho del sitio Astro
 *   avisos       { giftCardEmitida({ tarjeta, para, idioma }) → { ok, detalle } } correo (lo envia el AYUDANTE 2)
 *   fel          { alPagar(pago) → { fel_estado, detalle } }                el certificador FEL de Rosanta (sin integrar)
 *   (Recurrente: recurrente.js)
 *
 * Variables (Secret Manager / Cloud Run), NINGUNA existe todavia:
 *   WEB_FOTOS_BUCKET          deposito publico de las fotos (p. ej. rosanta-web-fotos)
 *   SITIO_RECONSTRUIR_URL     a donde se pide la reconstruccion (Cloud Build trigger webhook o similar)
 *   SITIO_RECONSTRUIR_CLAVE   la clave de ese pedido
 */

// ---------------------------------------------------------------- fotos

/** Cloud Storage por la API JSON, con la cuenta del servicio (google-auth-library ya esta en el paquete). */
function fotosCloudStorage(o) {
  const bucket = o && o.bucket;
  if (!bucket) throw new Error('Falta WEB_FOTOS_BUCKET.');
  let cliente = null;
  const auth = () => {
    if (!cliente) { const { GoogleAuth } = require('google-auth-library'); cliente = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/devstorage.read_write'] }); }
    return cliente;
  };
  return {
    async guardar(ruta, buffer, tipo) {
      if (!/^web\/fotos\/[\w./-]+$/.test(ruta) || ruta.indexOf('..') !== -1) throw new Error('Ruta de foto invalida.');
      const c = await auth().getClient();
      await c.request({ url: 'https://storage.googleapis.com/upload/storage/v1/b/' + encodeURIComponent(bucket) + '/o', method: 'POST',
        params: { uploadType: 'media', name: ruta }, headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=31536000, immutable' }, body: buffer });
      return 'https://storage.googleapis.com/' + bucket + '/' + ruta.split('/').map(encodeURIComponent).join('/');
    }
  };
}

function fotosDoble() {
  const guardadas = {};
  return { guardadas, async guardar(ruta, buffer, tipo) { guardadas[ruta] = { bytes: buffer.length, tipo }; return 'https://fotos.prueba/' + ruta; } };
}

// ---------------------------------------------------------------- reconstruccion del sitio

/** POST a la URL configurada. Sin URL: no pide nada y lo dice (estado sin_gancho). */
function reconstruirPorUrl(o) {
  const url = o && o.url, clave = o && o.clave, fetchFn = (o && o.fetch) || fetch;
  return {
    async reconstruir(v) {
      if (!url) return { estado: 'sin_gancho', detalle: 'Falta SITIO_RECONSTRUIR_URL: el sitio se reconstruye a mano.' };
      if (!/^https:\/\//.test(url)) throw new Error('SITIO_RECONSTRUIR_URL tiene que ser https.');
      const r = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': clave || '' },
        body: JSON.stringify({ version: v.version_id, huella: v.huella }) });
      if (!r.ok) return { estado: 'error', detalle: 'El gancho contestó ' + r.status };
      return { estado: 'pedida', detalle: 'Pedida (' + r.status + ')' };
    }
  };
}

function reconstruirDoble(o) {
  const pedidos = [];
  return { pedidos, async reconstruir(v) { pedidos.push(v); if (o && o.falla) throw new Error('gancho caido'); return { estado: 'pedida', detalle: 'doble' }; } };
}

// ---------------------------------------------------------------- avisos (correo de la gift card)

/**
 * Interfaz para el AYUDANTE 2 (correos con Resend). Recibe la tarjeta y a quien va; arma el correo con la
 * plantilla EN/ES (revisada por el revisor de marca) y adjunta la tarjeta (tarjetaSvg de giftcards.js, o el
 * PDF que haga su modulo). Hasta que exista, el servidor usa avisosSinCorreo: no manda nada y lo anota.
 */
function avisosSinCorreo() {
  return { async giftCardEmitida() { return { ok: false, detalle: 'Sin adaptador de correo todavía (AYUDANTE 2).' }; } };
}
function avisosDoble(o) {
  const enviados = [];
  return { enviados, async giftCardEmitida(x) { if (o && o.falla) throw new Error('correo caido'); enviados.push(x); return { ok: true, detalle: 'doble' }; } };
}

// ---------------------------------------------------------------- FEL

/**
 * Gancho de la FEL. Rosanta la emite con su certificador (Estudio §8.3, preguntas 8 y 22): hoy no hay
 * integracion. Devuelve 'pendiente' para que el reporte la muestre como "por facturar".
 * OJO: Recurrente manda `tax_invoice_url` y tiene "reemitir el DTE de un intent": puede que Recurrente
 * certifique una FEL por su cuenta. Si es asi, la guardamos en fel_url y se decide con el contador.
 */
function felSinIntegrar() {
  return { async alPagar() { return { fel_estado: 'pendiente', detalle: 'La FEL la emite Rosanta con su certificador (sin integrar).' }; } };
}
function felDoble() {
  const pedidas = [];
  return { pedidas, async alPagar(p) { pedidas.push(p); return { fel_estado: 'pendiente', detalle: 'doble' }; } };
}

module.exports = { fotosCloudStorage, fotosDoble, reconstruirPorUrl, reconstruirDoble, avisosSinCorreo, avisosDoble, felSinIntegrar, felDoble };
