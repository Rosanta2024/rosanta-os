/**
 * Canal de correo del bot en la nube (20-oct-2026). Corre Correo.js tal cual (revisarCorreosClientes, con la red de
 * cada hora) cada 5 minutos, con Gmail de verdad por la API.
 *
 * Interruptor en la base (tabla interruptores, módulo 'bot_correo'; la cambia el guion del día único), un minuto para ir y volver:
 *   'apps'   (por defecto) la nube no hace nada; atiende el bot de Apps Script, como hoy.
 *   'sombra' la nube LEE Gmail y piensa la respuesta (Claude y la consulta a Wix de verdad), pero no manda, no deja
 *            borradores, no avisa, no escribe hojas ni cambia reservas: anota lo que habría hecho en bot_correo_sombra
 *            para compararlo cada noche con lo que hizo el bot de Apps Script. Sus "vistos" van aparte (SOMBRA_CORREO_*).
 *   'nube'   la nube atiende el correo (y el bot de Apps Script, desde la @64, se hace a un lado al leer este interruptor).
 */
const { crearMotor } = require('./motor-bot');
const { crearRed, cargarEstado, guardarEstado, foto, modoModulo } = require('./vivo');
const { crearGmailSincrono } = require('./gmail-sincrono');
const { compararCorreoNoche } = require('./correo-comparar');

const LLAVES_CORREO = ['CORREO_DESDE', 'CORREO_VISTOS', 'CORREO_AVISADOS', 'CORREO_FALLAS', 'CORREO_RED_ULTIMA', 'CORREO_RED_AVISADOS', 'CORREO_NO_CLIENTE'];
const MODOS = ['apps', 'sombra', 'nube'];

function modoCorreo(pool) { return modoModulo(pool, 'bot_correo', 'apps', MODOS); }

function respuesta(code, cuerpo) {
  const t = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return { getResponseCode: () => code, getContentText: () => t, getBlob: () => ({ getContentType: () => 'application/json', getBytes: () => [], getName: () => '' }) };
}

/**
 * La red de la SOMBRA: Claude y la consulta de reservas de verdad; mandar por Meta y crear, cambiar o cancelar
 * en Wix se anotan y contestan como si hubieran salido bien, sin salir.
 */
function redSombra(redReal, wixOrigen, anotar) {
  return (url, opciones) => {
    const u = String(url);
    if (wixOrigen && u.indexOf(wixOrigen + '/_functions/') === 0) {
      const ruta = u.replace(/^.*\//, '');
      if (ruta === 'consultarBot') return redReal(u, opciones);
      const p = JSON.parse((opciones && opciones.payload) || '{}');
      delete p.secreto;
      anotar({ tipo: 'wix', ruta, payload: p });
      const r = { fecha: p.fecha || p.fecha_actual, hora: p.hora || p.hora_actual, personas: p.personas || 2, nombre: p.nombre || '', email: p.email || '' };
      if (ruta === 'cancelarBot') return respuesta(200, { ok: true, cancelada: r });
      if (ruta === 'cambiarBot') return respuesta(200, { ok: true, modo: 'modificada', vieja_cancelada: true, antes: { fecha: p.fecha_actual, hora: p.hora_actual, personas: p.personas || 2 }, ahora: r, nombre: r.nombre, email: r.email });
      return respuesta(200, { ok: true, id: 'sombra', estado: 'RESERVED' });
    }
    if (/^https:\/\/graph\.(facebook|instagram)\.com\//.test(u) && String((opciones && opciones.method) || 'get').toLowerCase() !== 'get') {
      anotar({ tipo: 'meta', payload: String((opciones && opciones.payload) || '').slice(0, 1500) });
      return respuesta(200, { messages: [{ id: 'sombra' }], message_id: 'sombra' });
    }
    return redReal(u, opciones);
  };
}

/**
 * crearCanalCorreo({ pool, espejo, leadsId, kb, claves, wixOrigen, accessToken, correo, pedido, soloSombra, libroSombra })
 *   accessToken(): token de Gmail (correo-vivo); correo(m): manda o encola un MailApp (solo en 'nube').
 *   soloSombra: el servidor no tiene el bot en vivo ('nube' no corre); libroSombra(): Rosanta Leads para la sombra.
 */
function crearCanalCorreo(deps) {
  const { red, permitido, esWix } = crearRed({ claves: deps.claves, wixOrigen: deps.wixOrigen, pedido: deps.pedido, gmail: true });

  async function minuto(forzar) {
    const modo = forzar || await modoCorreo(deps.pool);
    if (modo === 'apps') return { modo, omitido: true };
    if (modo === 'nube' && deps.soloSombra) return { modo, error: "Este servidor no tiene el bot en vivo (MODO_BOT=vivo): el correo en 'nube' no corre aquí." };
    deps.claves.GMAIL_TOKEN = await deps.accessToken();
    const estado = await cargarEstado(deps.pool);
    const antes = foto(estado);
    const sombra = modo === 'sombra';
    const anotado = [];
    if (sombra) {   // los "vistos" de la sombra son otros: nunca toca los del bot de Apps Script
      LLAVES_CORREO.forEach((k) => {
        const v = estado.props.get('SOMBRA_' + k);
        if (v === undefined) estado.props.delete(k); else estado.props.set(k, v);
      });
      if (!estado.props.has('CORREO_DESDE')) estado.props.set('CORREO_DESDE', String(Date.now()));   // solo correos nuevos
      // Sin el estado del bot importado: lo mínimo para que el código corra (en la sombra no sale nada por Meta).
      Object.entries(Object.assign({ SHEET_ID: deps.leadsId, KB_DOC_ID: 'kb', WIX_RESERVAS_URL: deps.wixOrigen + '/_functions/reservaBot',
        WA_PHONE_NUMBER_ID: 'sombra', OWNER_WA: 'sombra', BOTONES_MODO: 'todos', GRAPH_VERSION: 'v21.0' })).forEach(([k, v]) => { if (!estado.props.get(k)) estado.props.set(k, v); });
    } else if (!estado.props.get('CORREO_DESDE')) {
      throw new Error('El canal de correo en la nube necesita CORREO_DESDE importado del bot de Apps Script.');
    }
    const gmail = crearGmailSincrono({ pedido: red, escribir: !sombra });
    const ops = [], correos = [];
    // La sombra escribe en una copia en memoria (de la copia de Rosanta Leads que guarda la sombra 2, si no hay espejo).
    const libroLeads = sombra ? (deps.libroSombra ? await deps.libroSombra() : JSON.parse(JSON.stringify(deps.espejo.libro))) : deps.espejo.libro;
    const motor = crearMotor({ relojReal: true, estado, libros: { leads: libroLeads, [deps.leadsId]: libroLeads }, kb: await deps.kb(), gmail,
      red: sombra ? redSombra(red, deps.wixOrigen, (x) => anotado.push(x)) : red, permitido, esWix,
      correo: (m) => correos.push(m), alCambiarHoja: (op) => ops.push(op) });
    let error = null;
    try { motor.ctx.revisarCorreosClientes(); } catch (e) { error = e; }

    if (sombra) {
      const cambios = [];
      LLAVES_CORREO.forEach((k) => {
        const v = estado.props.has(k) ? estado.props.get(k) : null;
        if ((antes.props.get('SOMBRA_' + k) || null) !== v) cambios.push(['SOMBRA_' + k, v]);
      });
      for (const [k, v] of cambios) {
        await deps.pool.query(`INSERT INTO bot_estado (clave, tipo, valor, actualizado) VALUES ($1, 'prop', $2, now())
          ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now()`, [k, v]);
      }
      const filas = gmail.registro.map((x) => ({ tipo: x.tipo, hilo: x.hilo || '', mensaje: x.mensaje || '', para: x.para || '', asunto: x.asunto || '', cuerpo: x.cuerpo || '' }))
        .concat(correos.map((m) => ({ tipo: /Lead para atender|sin respuesta/.test(m.subject || '') ? 'aviso' : 'correo', hilo: '', mensaje: '', para: m.to || '', asunto: m.subject || '', cuerpo: m.body || '' })))
        .concat(anotado.map((x) => ({ tipo: x.tipo === 'wix' ? 'wix:' + x.ruta : 'whatsapp', hilo: '', mensaje: '', para: '', asunto: '', cuerpo: JSON.stringify(x.payload).slice(0, 1500) })));
      for (const f of filas) {
        await deps.pool.query('INSERT INTO bot_correo_sombra (tipo, hilo, mensaje, para, asunto, cuerpo) VALUES ($1,$2,$3,$4,$5,$6)', [f.tipo, f.hilo, f.mensaje, f.para, f.asunto, f.cuerpo]);
      }
      return { modo, anotado: filas.length, error: error ? String(error.message) : null };
    }
    await guardarEstado(deps.pool, antes, estado);
    await deps.espejo.aplicar(ops);
    for (const m of correos) await deps.correo(m);
    return { modo, salieron: gmail.registro.length, avisos: correos.length, cambiosHoja: ops.length, error: error ? String(error.message) : null };
  }

  /** La comparación de la noche (correo-comparar): Gmail con la misma red y el mismo token, solo lectura. */
  async function comparar(ahora) {
    deps.claves.GMAIL_TOKEN = await deps.accessToken();
    const gmail = crearGmailSincrono({ pedido: red, escribir: false });
    return compararCorreoNoche({ pool: deps.pool, gmail, ahora });
  }

  return { minuto, comparar, modo: () => modoCorreo(deps.pool) };
}

module.exports = { crearCanalCorreo, modoCorreo, redSombra, LLAVES_CORREO, MODOS };
