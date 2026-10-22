/**
 * El bot en VIVO (19-oct-2026). CONSTRUIDO Y APAGADO: no corre hasta que Juanma diga que sí.
 *
 * Dos llaves para encenderlo (las dos):
 *   1. La variable MODO_BOT=vivo en el servicio. Sin ella no existe la ruta /webhook (404), como hoy.
 *   2. El interruptor en la base (tabla interruptores, módulo 'bot'; migración 013 de la Fase 2, la misma tabla para
 *      todos los módulos del día único; se cambia con la cuenta de migraciones): 'puente' (sin fila) le reenvía cada
 *      mensaje al bot de Apps Script tal cual, sin tocarlo; 'vivo' lo atiende el servidor nuevo.
 * Así Meta se puede apuntar al servidor nuevo con el interruptor en 'puente' (todo sigue igual) y el cambio
 * y la vuelta atrás son una sola fila (segundos), sin entrar a Meta.
 *
 * Red de seguridad: si atendiendo un mensaje algo falla ANTES de contestarle al cliente, el mismo mensaje
 * se le reenvía al bot de Apps Script, que sigue publicado igual.
 *
 * El codigo del bot es el mismo (motor-bot.js con red, estado y hojas de verdad). Un mensaje a la vez.
 */
const { execFileSync } = require('child_process');
const { crearMotor } = require('./motor-bot');

// Claves del bot: viven en Secret Manager (variables S_*), nunca en la base ni en el motor. El motor ve
// un marcador ('$WHATSAPP_TOKEN') y el pedido de verdad lo reemplaza en un proceso aparte.
const SECRETAS = ['WHATSAPP_TOKEN', 'IG_TOKEN', 'MESSENGER_TOKEN', 'ANTHROPIC_API_KEY', 'WIX_RESERVAS_SECRETO', 'VERIFY_TOKEN', 'WEBHOOK_SECRET'];
const MARCADOR = /\$(WHATSAPP_TOKEN|IG_TOKEN|MESSENGER_TOKEN|ANTHROPIC_API_KEY|WIX_RESERVAS_SECRETO|GMAIL_TOKEN)\b/g;

/**
 * El pedido de verdad, sincrono (el bot espera como con UrlFetchApp), con las claves puestas en el proceso hijo.
 * Fotos de la consola (19-oct-2026): una respuesta que no es texto vuelve en base64 (blob), y un payload con un
 * archivo (file: blob) se manda como formulario multipart, igual que UrlFetchApp.
 */
function pedidoConClaves(url, opciones, claves) {
  const guion = 'let d="";process.stdin.on("data",c=>d+=c).on("end",async()=>{const o=JSON.parse(d);' +
    'const R=s=>typeof s==="string"?s.replace(/\\$(WHATSAPP_TOKEN|IG_TOKEN|MESSENGER_TOKEN|ANTHROPIC_API_KEY|WIX_RESERVAS_SECRETO|GMAIL_TOKEN)\\b/g,(m,k)=>process.env["S_"+k]||""):s;' +
    'const h={};Object.keys(o.h||{}).forEach(k=>h[k]=R(o.h[k]));let body=R(o.b);' +
    'if(o.f){body=new FormData();Object.keys(o.f.campos).forEach(k=>body.append(k,R(o.f.campos[k])));body.append(o.f.campo,new Blob([Buffer.from(o.f.b64,"base64")],{type:o.f.mime}),o.f.nombre);delete h["content-type"];}' +
    'try{const r=await fetch(R(o.u),{method:o.m,headers:h,body,redirect:"follow"});const ct=r.headers.get("content-type")||"";' +
    'if(ct&&!/json|text|html|xml/.test(ct)){const b=Buffer.from(await r.arrayBuffer());process.stdout.write(JSON.stringify({c:r.status,b64:b.toString("base64"),mime:ct.split(";")[0]}));}' +
    'else process.stdout.write(JSON.stringify({c:r.status,t:await r.text()}));}' +
    'catch(e){process.stdout.write(JSON.stringify({c:599,t:String(e)}));}});';
  const env = { PATH: process.env.PATH };
  Object.keys(claves || {}).forEach((k) => { env['S_' + k] = claves[k]; });
  const headers = Object.assign({}, opciones.headers || {});
  if (opciones.contentType) headers['content-type'] = opciones.contentType;
  let payload, form;
  const p = opciones.payload;
  const campo = p && typeof p === 'object' ? Object.keys(p).find((k) => p[k] && p[k]._b64 !== undefined) : null;
  if (campo) {
    const campos = {};
    Object.keys(p).forEach((k) => { if (k !== campo) campos[k] = String(p[k]); });
    form = { campos, campo, b64: p[campo]._b64, mime: p[campo].getContentType(), nombre: p[campo].getName() };
  } else if (p !== undefined) payload = typeof p === 'string' ? p : JSON.stringify(p);
  const sal = execFileSync(process.execPath, ['-e', guion], { input: JSON.stringify({ u: url, m: (opciones.method || 'get').toUpperCase(), h: headers, b: payload, f: form }),
    env, maxBuffer: 80 * 1024 * 1024, timeout: 120000 });
  return JSON.parse(String(sal));
}

/** Un blob como el de Apps Script, con los bytes en base64 (para volver a mandarlo). */
function blob(b64, mime, nombre) {
  return { _b64: b64, getContentType: () => mime, getBytes: () => Array.from(Buffer.from(b64, 'base64')), getName: () => nombre || 'foto', setName() { return this; } };
}

function respuesta(code, t, b) {
  return { getResponseCode: () => code, getContentText: () => (t === undefined ? '' : String(t)),
    getBlob: () => b || { getContentType: () => 'application/json', getBytes: () => [], getName: () => '' } };
}

/** Hosts a los que el bot en vivo puede llamar. Cualquier otro: 403 sin salir. */
function crearRed(cfg) {
  const wix = cfg.wixOrigen;   // p.ej. https://www.rosanta.rest
  // La foto que sube la consola: Drive, compartida con enlace, por su id (enviarImagenPorCanal).
  const fotoDrive = (u) => /^https:\/\/drive\.google\.com\/uc\?export=download&id=[\w-]+$/.test(u);
  const ok = (u) => /^https:\/\/(graph\.facebook\.com|graph\.instagram\.com|api\.anthropic\.com)\//.test(u) || (wix && u.indexOf(wix + '/_functions/') === 0) || fotoDrive(u) ||
    (cfg.gmail && u.indexOf('https://gmail.googleapis.com/gmail/v1/users/me/') === 0);   // canal de correo (20-oct-2026)
  const red = (url, opciones) => {
    const u = String(url);
    if (!ok(u)) return respuesta(403, JSON.stringify({ error: 'El bot nuevo no llama a ' + u.slice(0, 60) }));
    const r = (cfg.pedido || pedidoConClaves)(u, opciones || {}, cfg.claves);
    if (r.b64 !== undefined) return respuesta(r.c, '', blob(r.b64, r.mime, 'foto'));
    return respuesta(r.c, r.t);
  };
  return { red, permitido: ok, esWix: (u) => !!wix && String(u).indexOf(wix + '/_functions/') === 0 };
}

/** Estado del bot (Propiedades + Cache) en la base. Las claves nunca se guardan. */
async function cargarEstado(pool) {
  const r = await pool.query('SELECT clave, tipo, valor, vence FROM bot_estado WHERE valor IS NOT NULL');
  const props = new Map(), cache = new Map();
  r.rows.forEach((x) => {
    if (x.tipo === 'prop') props.set(x.clave, x.valor);
    else if (!x.vence || new Date(x.vence).getTime() > Date.now()) cache.set(x.clave, { v: x.valor, vence: x.vence ? new Date(x.vence).getTime() : Date.now() + 21600000 });
  });
  SECRETAS.forEach((k) => props.set(k, '$' + k));
  return { props, cache };
}
function foto(estado) {
  return { props: new Map(estado.props), cache: new Map(Array.from(estado.cache.entries()).map(([k, e]) => [k, Object.assign({}, e)])) };
}
/** Guarda solo lo que cambio. Borrar = valor NULL. */
async function guardarEstado(pool, antes, despues) {
  const cambios = [];
  const fija = (k) => SECRETAS.includes(k) || k.indexOf('INTERRUPTOR_') === 0;   // los interruptores solo los cambia su ruta
  despues.props.forEach((v, k) => { if (fija(k)) return; if (antes.props.get(k) !== v) cambios.push([k, 'prop', v, null]); });
  antes.props.forEach((v, k) => { if (!fija(k) && !despues.props.has(k)) cambios.push([k, 'prop', null, null]); });
  despues.cache.forEach((e, k) => { const a = antes.cache.get(k); if (!a || a.v !== e.v || a.vence !== e.vence) cambios.push([k, 'cache', e.v, new Date(e.vence)]); });
  antes.cache.forEach((e, k) => { if (!despues.cache.has(k)) cambios.push([k, 'cache', null, null]); });
  for (const c of cambios) {
    await pool.query(`INSERT INTO bot_estado (clave, tipo, valor, vence, actualizado) VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (clave) DO UPDATE SET tipo = EXCLUDED.tipo, valor = EXCLUDED.valor, vence = EXCLUDED.vence, actualizado = now()`, c);
  }
  return cambios.length;
}

/** ¿Todo el webhook viene del número de WhatsApp pid? (Instagram y Messenger: no.) */
function esDelNumero(cuerpo, pid) {
  if (!cuerpo || cuerpo.object !== 'whatsapp_business_account') return false;
  const cambios = [];
  (cuerpo.entry || []).forEach((e) => (e.changes || []).forEach((c) => cambios.push(c)));
  return cambios.length > 0 && cambios.every((c) => String((c.value && c.value.metadata && c.value.metadata.phone_number_id) || '') === String(pid));
}

/** El modo de un módulo en la tabla interruptores (sin fila, o si la tabla no está: el modo seguro). */
async function modoModulo(pool, modulo, seguro, validos) {
  try {
    const r = await pool.query('SELECT modo FROM interruptores WHERE modulo = $1', [modulo]);
    const v = r.rows[0] && r.rows[0].modo;
    return validos.includes(v) ? v : seguro;
  } catch (e) { return seguro; }
}
function interruptor(pool) { return modoModulo(pool, 'bot', 'puente', ['puente', 'vivo']); }

/**
 * crearBotVivo({ pool, espejo, leadsId, kb, claves, wixOrigen, correo, reenviar, soloPuente, sombraViva })
 *   espejo: hojas-vivo (Rosanta Leads en memoria + copia a la hoja); kb(): texto de la base de conocimiento;
 *   correo(m): manda o encola el correo; reenviar(cuerpo): POST al bot de Apps Script (async).
 */
function crearBotVivo(deps) {
  let fila = Promise.resolve();   // un mensaje a la vez
  const enFila = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };
  const { red, permitido, esWix } = crearRed({ claves: deps.claves, wixOrigen: deps.wixOrigen, pedido: deps.pedido });

  async function correr(fn) {
    const estado = await cargarEstado(deps.pool);
    const antes = foto(estado);
    const ops = [];
    const kb = await deps.kb();
    const correos = [];
    const motor = crearMotor({ relojReal: true, estado, libros: { leads: deps.espejo.libro, [deps.leadsId]: deps.espejo.libro }, red, permitido, esWix, kb,
      correo: (m) => correos.push(m), alCambiarHoja: (op) => ops.push(op) });
    let error = null;
    try { fn(motor); } catch (e) { error = e; }
    await guardarEstado(deps.pool, antes, estado);
    await deps.espejo.aplicar(ops);
    for (const m of correos) await deps.correo(m);   // manda, o deja en bot_correos para reintentar
    return { motor, error, ops };
  }

  /** Un POST de Meta. query: los parametros de la URL (token). Devuelve el resultado anotado en bot_eventos. */
  function recibir(cuerpo, query) {
    return enFila(async () => {
      const t0 = Date.now();
      const objeto = cuerpo && cuerpo.object;
      // ENSAYO (20-oct-2026): solo el número de prueba. Cualquier otro (el real, si algo quedó mal suscrito en Meta),
      // Instagram o Messenger se ignora y se anota: ni se contesta ni se reenvía.
      if (deps.soloNumero && !esDelNumero(cuerpo, deps.soloNumero)) {
        await deps.pool.query('INSERT INTO bot_eventos (objeto, modo, resultado, error) VALUES ($1, $2, $3, $4)',
          [objeto || '', 'ensayo', 'ignorado_otro_numero', 'no es el numero de prueba']);
        return { modo: 'ensayo', resultado: 'ignorado_otro_numero', envios: 0, error: null };
      }
      // soloPuente: el servicio arrancó sin las claves de Meta (MODO_BOT=puente): nunca atiende, aunque la tabla diga 'vivo'.
      const modo = deps.soloPuente ? 'puente' : await interruptor(deps.pool);
      let resultado, envios = 0, err = null;
      if (modo !== 'vivo') {
        // Si el reenvío falla, el cliente se queda sin respuesta: se reintenta y, si igual falla, queda anotado con la
        // marca PUENTE_REENVIO_FALLO, que dispara la alerta por correo (Cloud Monitoring).
        let intento = 0;
        for (;;) {
          try { await deps.reenviar(cuerpo); break; } catch (e) {
            if (++intento >= 3) {
              console.error('PUENTE_REENVIO_FALLO ' + (objeto || '') + ': ' + String(e.message || e).slice(0, 200));
              await deps.pool.query('INSERT INTO bot_eventos (objeto, modo, resultado, error) VALUES ($1, $2, $3, $4)',
                [objeto || '', modo, 'reenvio_fallido', String(e.message || e).slice(0, 500)]);
              return { modo, resultado: 'reenvio_fallido', envios: 0, error: String(e.message || e) };
            }
            await new Promise((r) => setTimeout(r, deps.esperaReintento === undefined ? 1500 : deps.esperaReintento));
          }
        }
        resultado = 'reenviado';
        if (deps.sombraViva) deps.sombraViva.pensar(cuerpo, query);   // en su propia fila: no demora el próximo reenvío
      } else {
        try {
          const r = await correr((m) => {
            const salida = m.ctx.doPost({ parameter: { token: query && query.token }, postData: { contents: JSON.stringify(cuerpo) } });
            if (salida && salida.getContent && salida.getContent() === 'no') throw new Error('Webhook sin token valido (lo mismo que hace doPost).');
          });
          envios = r.motor.envios.length;
          // doPost atrapa sus errores y los deja en el registro: un error del bot sin ningun envio = el cliente quedo sin respuesta.
          // Sin ningun envio aceptado: o el bot tiro error, o intento contestar y Meta no acepto nada (p. ej. una clave mal
          // copiada). Si el bot se callo a proposito (chat en manos de Juanma) no hubo intentos y no se reenvia.
          const logErr = r.motor.logs.find((l) => /^Error doPost/.test(l));
          const errBot = r.error || (envios === 0 && logErr ? new Error(logErr) : null) ||
            (envios === 0 && r.motor.intentosEnvio.n > 0 ? new Error('Meta no acepto ninguno de ' + r.motor.intentosEnvio.n + ' envios') : null);
          if (errBot && envios === 0) { err = errBot; await deps.reenviar(cuerpo); resultado = 'reenviado_por_error'; }
          else { resultado = 'atendido'; if (errBot) err = errBot; }
        } catch (e) {
          err = e;
          await deps.reenviar(cuerpo).catch(() => {});
          resultado = 'reenviado_por_error';
        }
      }
      await deps.pool.query('INSERT INTO bot_eventos (objeto, modo, resultado, envios, ms, error) VALUES ($1,$2,$3,$4,$5,$6)',
        [objeto || '', modo, resultado, envios, Date.now() - t0, err ? String(err.message || err).slice(0, 500) : null]);
      return { modo, resultado, envios, error: err ? String(err.message || err) : null };
    });
  }

  /** Cada minuto (reloj, solo en vivo): lo que manda la consola, "devolver al bot" y los chats que vuelven al bot. */
  function minuto() {
    return enFila(async () => {
      if (deps.soloPuente || await interruptor(deps.pool) !== 'vivo') return { omitido: 'puente' };
      await deps.espejo.cargar(['Salientes', 'Leads']);   // la consola escribe en Salientes; el bot marca Enviado en Leads
      const r = await correr((m) => m.ctx.enviarRespuestasPendientes());
      return { envios: r.motor.envios.length, cambiosHoja: r.ops.length, error: r.error ? String(r.error.message) : null };
    });
  }

  /** Cada noche (reloj, solo en vivo): el resumen de lo que hizo el bot (ResumenDiario.js tal cual). */
  function resumen() {
    return enFila(async () => {
      if (deps.soloPuente || await interruptor(deps.pool) !== 'vivo') return { omitido: 'puente' };
      await deps.espejo.cargar(['Leads']);
      const r = await correr((m) => m.ctx.resumenDiarioBot());
      return { correos: r.motor.correos.length, error: r.error ? String(r.error.message) : null };
    });
  }

  /**
   * Reservas pedidas por el restaurante (Manual.js tal cual, 20-oct-2026): lo mismo que ?accion=reserva del bot de
   * Apps Script, con el mismo registro. No depende del interruptor: es una herramienta del restaurante, no un mensaje de cliente.
   */
  function reserva(pedido) {
    return enFila(async () => {
      let salida = null;
      const r = await correr((m) => { salida = m.ctx.rvManual(pedido); });
      if (r.error) throw r.error;
      return salida;
    });
  }

  return { recibir, minuto, resumen, reserva, interruptor: () => (deps.soloPuente ? Promise.resolve('puente') : interruptor(deps.pool)) };
}

/**
 * Refresco del token de Instagram desde el servidor (en Apps Script lo hacia refrescarTokenIG; el token vive 60 dias).
 * guardarSecreto(nombre, valor): agrega una version nueva en Secret Manager. La clave nunca se devuelve ni se registra.
 */
async function refrescarTokenIg(deps) {
  const r = (deps.pedido || pedidoConClaves)('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=$IG_TOKEN',
    { method: 'get' }, deps.claves);
  let j = {};
  try { j = JSON.parse(r.t || '{}'); } catch (e) { /* sin JSON */ }
  if (r.c !== 200 || !j.access_token) {
    return { ok: false, error: 'Instagram no renovo el token (HTTP ' + r.c + (j.error && j.error.message ? ': ' + String(j.error.message).slice(0, 120) : '') + ')' };
  }
  await deps.guardarSecreto('bot-ig-token', j.access_token);
  deps.claves.IG_TOKEN = j.access_token;   // el mismo objeto que usa la red: los proximos envios ya van con el nuevo
  return { ok: true, venceEnDias: j.expires_in ? Math.round(j.expires_in / 86400) : null };
}

module.exports = { esDelNumero, refrescarTokenIg, crearBotVivo, crearRed, pedidoConClaves, blob, cargarEstado, guardarEstado, foto, interruptor, modoModulo, SECRETAS };
