/**
 * "Sombra viva" del bot (20-oct-2026, aprobada por Juanma). Con Meta apuntando a la nube en PUENTE, cada mensaje
 * real se le reenvía al bot de Apps Script (que es el que contesta) y, además, aquí se PIENSA con el código del bot
 * para saber qué habría contestado la nube. Nunca sale nada:
 *   - el servicio en puente no tiene las claves de Meta (no puede mandar aunque quisiera);
 *   - la red de la sombra contesta "ok" a todo envío a Meta y a todo crear/cambiar/cancelar en Wix sin salir
 *     (solo la consulta de reservas va de verdad, porque solo lee);
 *   - los correos (avisos a Juanma) se anotan y no se mandan; las hojas se escriben en una copia en memoria.
 * Su estado (historial, pausas, mensajes vistos) vive aparte en bot_estado con el prefijo "SV:".
 * Tope de mensajes por día (gasto de Claude): SV_MAX_DIA.
 */
const { crearMotor } = require('./motor-bot');
const { crearRed } = require('./vivo');
const { redSombra } = require('./correo-canal');

const PREFIJO = 'SV:';
const BASE_PROPS = { BOTONES_MODO: 'todos', GRAPH_VERSION: 'v21.0', OWNER_WA: 'juanma-sombra', WA_PHONE_NUMBER_ID: 'sombra',
  WHATSAPP_TOKEN: 'sin-token', IG_TOKEN: 'sin-token', MESSENGER_TOKEN: 'sin-token', ANTHROPIC_API_KEY: '$ANTHROPIC_API_KEY',
  WIX_RESERVAS_SECRETO: '$WIX_RESERVAS_SECRETO', VERIFY_TOKEN: 'sombra', WEBHOOK_SECRET: '$WEBHOOK_SECRET' };

async function cargar(pool, base) {
  const r = await pool.query("SELECT clave, tipo, valor, vence FROM bot_estado WHERE clave LIKE 'SV:%' AND valor IS NOT NULL");
  const props = new Map(Object.entries(base)), cache = new Map();
  r.rows.forEach((x) => {
    const k = x.clave.slice(PREFIJO.length);
    if (x.tipo === 'prop') props.set(k, x.valor);
    else if (!x.vence || new Date(x.vence).getTime() > Date.now()) cache.set(k, { v: x.valor, vence: x.vence ? new Date(x.vence).getTime() : Date.now() + 21600000 });
  });
  return { props, cache };
}
async function guardar(pool, antes, despues, base) {
  const cambios = [];
  despues.props.forEach((v, k) => { if (k in base && v === base[k]) return; if (antes.props.get(k) !== v) cambios.push([PREFIJO + k, 'prop', v, null]); });
  despues.cache.forEach((e, k) => { const a = antes.cache.get(k); if (!a || a.v !== e.v || a.vence !== e.vence) cambios.push([PREFIJO + k, 'cache', e.v, new Date(e.vence)]); });
  antes.cache.forEach((e, k) => { if (!despues.cache.has(k)) cambios.push([PREFIJO + k, 'cache', null, null]); });
  for (const c of cambios) {
    await pool.query(`INSERT INTO bot_estado (clave, tipo, valor, vence, actualizado) VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (clave) DO UPDATE SET tipo = EXCLUDED.tipo, valor = EXCLUDED.valor, vence = EXCLUDED.vence, actualizado = now()`, c);
  }
}

/** Los mensajes de clientes del webhook: [{ canal, contacto, id, texto }]. Los ecos (Juanma desde la app) no cuentan. */
function mensajesDe(cuerpo) {
  const out = [];
  if (!cuerpo) return out;
  if (cuerpo.object === 'whatsapp_business_account') {
    (cuerpo.entry || []).forEach((e) => (e.changes || []).forEach((c) => ((c.value && c.value.messages) || []).forEach((m) => {
      const t = m.type === 'text' ? (m.text && m.text.body) : m.type === 'image' ? '📷 [Foto] ' + ((m.image && m.image.caption) || '')
        : m.type === 'interactive' ? '🔘 ' + (((m.interactive || {}).button_reply || (m.interactive || {}).list_reply || {}).title || '') : '[' + m.type + ']';
      out.push({ canal: 'whatsapp', contacto: String(m.from), id: String(m.id || ''), texto: String(t || '').trim() });
    })));
  } else if (cuerpo.object === 'instagram' || cuerpo.object === 'page') {
    (cuerpo.entry || []).forEach((e) => (e.messaging || []).forEach((ev) => {
      const m = ev.message;
      if (!m || m.is_echo) return;
      const foto = (m.attachments || []).some((a) => a && a.type === 'image');
      out.push({ canal: cuerpo.object === 'instagram' ? 'instagram' : 'messenger', contacto: String(ev.sender && ev.sender.id), id: String(m.mid || ''),
        texto: String((foto ? '📷 [Foto] ' : '') + (m.text || '')).trim() });
    }));
  }
  return out;
}

/**
 * crearSombraViva({ pool, kb, claves: { ANTHROPIC_API_KEY, WIX_RESERVAS_SECRETO }, wixOrigen, leadsId, maxDia, pedido, libro })
 *   pensar(cuerpo, query): piensa el webhook (en su propia fila, después del reenvío). Nunca tira error.
 */
function crearSombraViva(deps) {
  const maxDia = Number(deps.maxDia || process.env.SV_MAX_DIA || 40);
  const { red, permitido } = crearRed({ claves: deps.claves, wixOrigen: deps.wixOrigen, pedido: deps.pedido });
  let fila = Promise.resolve();
  const base = Object.assign({ SHEET_ID: deps.leadsId, KB_DOC_ID: 'kb', WIX_RESERVAS_URL: deps.wixOrigen + '/_functions/reservaBot' }, BASE_PROPS);

  async function hoy() {
    const r = await deps.pool.query("SELECT count(*)::int AS n FROM bot_sombra_viva WHERE estado = 'pensado' AND recibido >= date_trunc('day', now() AT TIME ZONE 'America/Guatemala') AT TIME ZONE 'America/Guatemala'");
    return Number(r.rows[0] && r.rows[0].n) || 0;
  }

  async function pensarAhora(cuerpo, query) {
    const msgs = mensajesDe(cuerpo);
    if (cuerpo && cuerpo.object === 'whatsapp_business_account' && !msgs.length) return { omitido: 'sin mensajes' };   // estados de entrega
    if (msgs.length && await hoy() >= maxDia) {
      for (const m of msgs) {
        await deps.pool.query("INSERT INTO bot_sombra_viva (canal, contacto, mensaje_id, cliente, estado) VALUES ($1,$2,$3,$4,'omitido_tope')", [m.canal, m.contacto, m.id, m.texto.slice(0, 1000)]);
      }
      return { omitido: 'tope', maxDia };
    }
    const estado = await cargar(deps.pool, base);
    const antes = { props: new Map(estado.props), cache: new Map(Array.from(estado.cache.entries()).map(([k, e]) => [k, Object.assign({}, e)])) };
    const anotado = [];
    const libro = deps.libro ? await deps.libro() : { Leads: [[]], Conversaciones: [[]], Salientes: [[]] };
    const correos = [];
    const motor = crearMotor({ relojReal: true, estado, libros: { leads: libro, [deps.leadsId]: libro }, kb: await deps.kb(),
      red: redSombra(red, deps.wixOrigen, (x) => anotado.push(x)), permitido, esWix: (u) => String(u).indexOf(deps.wixOrigen + '/_functions/') === 0,
      correo: (m) => correos.push(m) });
    let error = null;
    // El token ya lo validó la ruta del webhook: aquí va el marcador (como en vivo).
    try { motor.ctx.doPost({ parameter: { token: query && query.token ? '$WEBHOOK_SECRET' : '' }, postData: { contents: JSON.stringify(cuerpo) } }); } catch (e) { error = e; }
    const logErr = motor.logs.find((l) => /^Error doPost/.test(l));
    if (!error && logErr) error = new Error(logErr);
    await guardar(deps.pool, antes, estado, base);
    const aviso = correos.some((c) => /Lead para atender|Foto de cliente/.test(c.subject || '')) ||
      motor.envios.some((e) => e.a === 'juanma-sombra');
    const wix = anotado.filter((x) => x.tipo === 'wix').map((x) => x.ruta);
    const leads = libro.Leads || [];
    for (const m of msgs) {
      const envs = motor.envios.filter((e) => e.a === m.contacto);
      const fila = leads.slice(1).filter((r) => String(r[11]) === m.contacto).pop();
      await deps.pool.query(`INSERT INTO bot_sombra_viva (canal, contacto, mensaje_id, cliente, respuesta, botones, acciones, estado, error)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [m.canal, m.contacto, m.id, m.texto.slice(0, 1000), envs.map((e) => e.texto).join('\n').slice(0, 3000),
        JSON.stringify(envs.reduce((a, e) => a.concat(e.botones || []), [])), JSON.stringify({ wix, aviso, humano: !!(fila && fila[9] === 'Sí') }),
        error ? 'error' : 'pensado', error ? String(error.message).slice(0, 300) : null]);
    }
    return { pensados: msgs.length, envios: motor.envios.length, error: error ? String(error.message) : null };
  }

  function pensar(cuerpo, query) {
    const p = fila.then(() => pensarAhora(cuerpo, query)).catch((e) => { console.error('sombra viva:', e.message); return { error: e.message }; });
    fila = p.catch(() => {});
    return p;
  }

  return { pensar, mensajesDe };
}

module.exports = { crearSombraViva, mensajesDe };
