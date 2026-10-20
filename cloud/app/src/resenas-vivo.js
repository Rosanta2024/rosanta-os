/**
 * Reseñas EN VIVO desde la nube (21-oct-2026). Solo actua con el interruptor 'resenas' = 'base'; con 'puente'
 * (o sin fila) no hace nada y manda Apps Script, como hoy. Hace lo mismo que el bot de reseñas de Apps Script:
 *
 *   procesar (reloj cada hora): lee Google; cada reseña nueva se anota en resenas_gbp (escrito_por 'nube').
 *     Si ya tenia respuesta en Google → YA_TENIA_RESPUESTA. Si no, borrador con Claude y las reglas reales:
 *     4-5 estrellas y salida limpia → se publica sola (PUBLICADA_AUTO); lo demas → PENDIENTE_APROBAR y aviso
 *     por correo a restaurante@rosanta.rest con el enlace al panel.
 *   panel (Clientes › Reseñas, solo el dueño): publicar, editar lo publicado, guardar, regenerar y "no responder".
 *
 * Antes de publicar sola se vuelve a mirar la reseña en Google: si ya tiene respuesta (por ejemplo, la puso Apps
 * Script mientras la nube no contestaba), no se pisa. Se escribe en la base DESPUES de que Google confirme.
 *
 * Claves: GBP_OAUTH (gbp-oauth) y ANTHROPIC_RESENAS (la clave de Claude de las reseñas; la de produccion, no la
 * de la sombra).
 */
const B = require('./resenas-borrador');
const { crearLectorGbp, gbpDelEntorno } = require('./resenas-nube');

const MB_V4 = 'https://mybusiness.googleapis.com/v4';
const MAX_RESPUESTA = 4000;   // tope de Google
const MODOS = ['puente', 'base'];

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

function validarTexto(t) {
  const s = String(t || '').trim();
  if (!s) throw error(400, 'La respuesta está vacía.');
  if (s.length > MAX_RESPUESTA) throw error(400, 'La respuesta tiene ' + s.length + ' caracteres; el tope de Google es ' + MAX_RESPUESTA + '.');
  return s;
}

/** Lo unico que escribe en Google: la respuesta de una reseña (PUT .../reply, que pisa la anterior). */
function crearPublicadorGbp(cfg, opciones) {
  const o = opciones || {};
  const fetchFn = o.fetch || fetch;
  const lector = o.lector || crearLectorGbp(cfg, o);
  async function token() {   // el mismo permiso que el lector
    const a = cfg.oauth;
    if (!a || !a.refresh_token) throw error(503, 'Falta el permiso de Google Business (secreto gbp-oauth).');
    const r = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: a.client_id, client_secret: a.client_secret, refresh_token: a.refresh_token, grant_type: 'refresh_token' }).toString() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw error(502, 'Google no renovo el permiso de Business Profile.');
    return j.access_token;
  }
  async function publicar(ficha, reviewId, texto) {
    const t = validarTexto(texto);
    const url = MB_V4 + '/accounts/' + ficha.cuenta + '/locations/' + ficha.ubicacion + '/reviews/' + encodeURIComponent(reviewId) + '/reply';
    const r = await fetchFn(url, { method: 'PUT', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: t }) });
    if (!r.ok) throw error(502, 'Google no publico la respuesta (' + r.status + '): ' + (await r.text().catch(() => '')).slice(0, 200));
    return t;
  }
  /** La reseña de Google tal cual esta ahora (para no pisar una respuesta que ya existe). */
  async function una(ficha, reviewId) {
    return lector.gbpGet(MB_V4 + '/accounts/' + ficha.cuenta + '/locations/' + ficha.ubicacion + '/reviews/' + encodeURIComponent(reviewId));
  }
  return { publicar, una, lector };
}

/**
 * deps: { pool, gbp (cfg), claveClaude, fetch, avisar(asunto, cuerpo), urlPanel, lector, publicador, borrador }
 */
function crearResenasVivo(deps) {
  const cfg = deps.gbp || gbpDelEntorno(process.env);
  const lector = deps.lector || crearLectorGbp(cfg, { fetch: deps.fetch });
  // Publicar de verdad en Google solo con RESENAS_PUBLICAR=si (o deps.publicarDeVerdad). Si no, "en seco": hace
  // todo igual (lee, redacta, decide, anota en la base) pero en vez del PUT a Google anota lo que habria publicado.
  // Asi se ensaya en rosanta-nube-ensayo sin tocar la ficha publica.
  const deVerdad = deps.publicarDeVerdad !== undefined ? deps.publicarDeVerdad : process.env.RESENAS_PUBLICAR === 'si';
  const enSeco = [];
  const pubReal = deps.publicador || crearPublicadorGbp(cfg, { fetch: deps.fetch, lector });
  // Ensayo (RESENAS_ENSAYO=si, solo en rosanta-nube-ensayo): procesar acepta reseñas FALSAS (id 'ENSAYO-...') que se
  // suman a las de Google SOLO en memoria y en la base de ensayo. Nunca junto con publicar de verdad.
  const ensayo = deps.ensayo !== undefined ? deps.ensayo : process.env.RESENAS_ENSAYO === 'si';
  if (ensayo && deVerdad) throw new Error('RESENAS_ENSAYO y RESENAS_PUBLICAR no pueden ir juntos.');
  const esFalsa = (id) => /^ENSAYO-/.test(String(id));
  const unaSegura = async (f, id) => (esFalsa(id) ? {} : pubReal.una(f, id));
  const pub = deVerdad ? pubReal : { una: unaSegura, publicar: async (f, id, texto) => { const t = validarTexto(texto); enSeco.push({ review_id: id, texto: t }); return t; } };
  const Bo = deps.borrador || B;
  const clave = () => (deps.claveClaude !== undefined ? deps.claveClaude : process.env.ANTHROPIC_RESENAS);

  async function modo() {
    try {
      const r = await deps.pool.query('SELECT modo FROM interruptores WHERE modulo = $1', ['resenas']);
      return r.rows[0] && MODOS.indexOf(r.rows[0].modo) !== -1 ? r.rows[0].modo : 'puente';
    } catch (e) { return 'puente'; }
  }
  async function exigirBase() { if ((await modo()) !== 'base') throw error(409, 'Las reseñas todavía las maneja Apps Script (interruptor en puente).'); }

  async function guardarFila(f) {
    await deps.pool.query(`INSERT INTO resenas_gbp (review_id, fecha_detectada, estrellas, cliente, resena, respuesta, estado, aprobar, fecha_publicada, escrito_por, actualizado)
      VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, 'nube', now())
      ON CONFLICT (review_id) DO UPDATE SET respuesta = EXCLUDED.respuesta, estado = EXCLUDED.estado, aprobar = EXCLUDED.aprobar,
        fecha_publicada = coalesce(EXCLUDED.fecha_publicada, resenas_gbp.fecha_publicada), escrito_por = 'nube', actualizado = now()`,
    [f.review_id, f.estrellas || 0, f.cliente || '', f.resena || '', f.respuesta || '', f.estado, f.aprobar || '', f.fecha_publicada || null]);
  }

  /** El activador de cada hora. */
  async function procesar(falsas) {
    if ((await modo()) !== 'base') return { modo: 'puente', nuevas: 0, alertas: 0 };
    const g = await lector.resenas();
    if (falsas && falsas.length) {
      if (!ensayo) throw error(403, 'Las reseñas de prueba solo existen en el ensayo.');
      g.reviews = g.reviews.concat(falsas);
    }
    const ya = new Set((await deps.pool.query('SELECT review_id FROM resenas_gbp')).rows.map((x) => x.review_id));
    enSeco.length = 0;
    const out = { modo: 'base', en_seco: !deVerdad, nuevas: 0, auto: 0, para_aprobar: [], ya_tenian: 0, errores: [] };
    for (const r of g.reviews) {
      if (ya.has(r.review_id)) continue;
      out.nuevas++;
      try {
        if (r.respuesta) { await guardarFila(Object.assign({}, r, { estado: 'YA_TENIA_RESPUESTA' })); out.ya_tenian++; continue; }
        const red = await Bo.redactar(r, { clave: clave(), fetch: deps.fetch });
        if (red.decision === 'publicar_sola') {
          const ahora = await pub.una(g.ficha, r.review_id);
          if (ahora && ahora.reviewReply && ahora.reviewReply.comment) {
            await guardarFila(Object.assign({}, r, { respuesta: ahora.reviewReply.comment, estado: 'YA_TENIA_RESPUESTA' })); out.ya_tenian++; continue;
          }
          await pub.publicar(g.ficha, r.review_id, red.texto);
          await guardarFila(Object.assign({}, r, { respuesta: red.texto, estado: 'PUBLICADA_AUTO', fecha_publicada: new Date() }));
          out.auto++;
        } else {
          await guardarFila(Object.assign({}, r, { respuesta: red.texto, estado: 'PENDIENTE_APROBAR', aprobar: 'NO' }));
          out.para_aprobar.push({ review_id: r.review_id, estrellas: r.estrellas, cliente: r.cliente, resena: r.resena, borrador: red.texto });
        }
      } catch (e) { out.errores.push(r.review_id + ': ' + String(e.message || e).slice(0, 150)); }
    }
    if (out.para_aprobar.length && deps.avisar) await deps.avisar(asuntoPendientes(out.para_aprobar.length), cuerpoPendientes(out.para_aprobar, deps.urlPanel)).catch(() => {});
    out.alertas = out.errores.length;
    if (!deVerdad) out.habria_publicado = enSeco.slice();
    await deps.pool.query('INSERT INTO resenas_corridas (tarea, ok, resumen) VALUES ($1,$2,$3)',
      ['procesar', out.alertas === 0, JSON.stringify(Object.assign({}, out, { para_aprobar: out.para_aprobar.map((x) => x.review_id) }))]);
    return out;
  }

  async function fila(reviewId) {
    const r = await deps.pool.query('SELECT review_id, estrellas, cliente, resena, respuesta, estado FROM resenas_gbp WHERE review_id = $1', [String(reviewId)]);
    if (!r.rows[0]) throw error(404, 'Esa reseña no está en la base todavía.');
    return r.rows[0];
  }

  // ---- Las acciones del panel (mismos nombres que PanelServidor.js) ----
  async function publicarDesdePanel(reviewId, texto) {
    await exigirBase();
    validarTexto(texto);
    const f = await fila(reviewId);
    const t = await pub.publicar(await fichaActual(), f.review_id, texto);
    await guardarFila(Object.assign({}, f, { respuesta: t, estado: 'PUBLICADA_APROBADA', aprobar: 'SI', fecha_publicada: new Date() }));
    return { ok: true, estado: 'PUBLICADA_APROBADA', texto: t, en_seco: !deVerdad };
  }
  async function editarRespuestaPublicada(reviewId, texto) {
    await exigirBase();
    validarTexto(texto);
    const f = await fila(reviewId);
    const t = await pub.publicar(await fichaActual(), f.review_id, texto);
    await guardarFila(Object.assign({}, f, { respuesta: t, estado: 'PUBLICADA_EDITADA', aprobar: 'SI', fecha_publicada: new Date() }));
    return { ok: true, estado: 'PUBLICADA_EDITADA', texto: t, en_seco: !deVerdad };
  }
  async function guardarBorrador(reviewId, texto) {
    await exigirBase();
    const f = await fila(reviewId);
    const t = validarTexto(texto);
    const estado = /^PUBLICADA/.test(f.estado) ? f.estado : 'PENDIENTE_APROBAR';
    await guardarFila(Object.assign({}, f, { respuesta: t, estado, aprobar: 'NO' }));
    return { ok: true, estado, texto: t };
  }
  async function regenerarBorrador(reviewId) {
    await exigirBase();
    const f = await fila(reviewId);
    const red = await Bo.redactar(f, { clave: clave(), fetch: deps.fetch });
    await guardarFila(Object.assign({}, f, { respuesta: red.texto }));
    return { ok: true, texto: red.texto, confiable: red.confiable };
  }
  async function descartarBorrador(reviewId) {
    await exigirBase();
    const f = await fila(reviewId);
    await guardarFila(Object.assign({}, f, { estado: 'NO_RESPONDER', aprobar: 'NO' }));
    return { ok: true, estado: 'NO_RESPONDER' };
  }

  let ficha = null;
  async function fichaActual() {
    if (ficha) return ficha;
    if (cfg.cuenta && cfg.ubicacion) return (ficha = { cuenta: cfg.cuenta, ubicacion: cfg.ubicacion });
    return (ficha = (await lector.resenas()).ficha);
  }

  return { modo, enSeco: () => !deVerdad, ensayo, procesar, publicarDesdePanel, editarRespuestaPublicada, guardarBorrador, regenerarBorrador, descartarBorrador };
}

function asuntoPendientes(n) { return 'Rosanta: ' + n + ' reseña(s) para revisar'; }
/** Mismo correo que notificarPendientes_ de Apps Script, sin la hoja (ahora es el panel). */
function cuerpoPendientes(lista, urlPanel) {
  let c = 'Hay ' + lista.length + ' reseña(s) esperando tu aprobación antes de publicar.\n' +
    '(Son las de 1 a 3 estrellas, más cualquiera de 4-5 cuyo borrador no pasó la validación.)\n\n';
  lista.forEach((f) => { c += '- ' + f.estrellas + '★ de ' + (f.cliente || 'Anónimo') + '\n  Reseña: ' + (f.resena || '(sin texto)') + '\n  Borrador propuesto: ' + f.borrador + '\n\n'; });
  c += 'Para publicar: abrí el panel de reseñas, filtrá por "Sin responder", ajustá el texto y dale "Aprobar y publicar".\n';
  if (urlPanel) c += 'Panel: ' + urlPanel + '\n';
  return c;
}

module.exports = { crearResenasVivo, crearPublicadorGbp, validarTexto, cuerpoPendientes };
