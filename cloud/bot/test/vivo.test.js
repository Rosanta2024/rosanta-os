/**
 * Bot en vivo, APAGADO (19-oct-2026): pruebas con Meta, Wix, Claude, Sheets, Gmail y la base de mentira.
 * Nada sale a internet salvo un servidor local para probar que las claves no viajan en la linea de comandos.
 */
const test = require('node:test');
const assert = require('node:assert');
const { refrescarTokenIg, crearBotVivo, crearRed, pedidoConClaves, guardarEstado, cargarEstado, foto, SECRETAS } = require('../src/vivo');
const { crearEspejo, leerCelda, escribirCelda, letra } = require('../src/hojas-vivo');
const { crearCorreo, armarMime } = require('../src/correo-vivo');
const { crearAppBot } = require('../src/app-bot');

const LEADS = 'leads-real';
const TOKEN = 'tok-webhook';

/** Base de mentira: bot_estado, bot_eventos, bot_correos. */
function poolDeMentira(inicial) {
  const estado = new Map(Object.entries(inicial || {}).map(([k, v]) => [k, { clave: k, tipo: 'prop', valor: v, vence: null }]));
  const eventos = [], correos = [];
  return {
    estado, eventos, correos,
    query: async (sql, p) => {
      if (/SELECT clave, tipo, valor, vence FROM bot_estado/.test(sql)) return { rows: Array.from(estado.values()).filter((x) => x.valor !== null) };
      if (/FROM interruptores WHERE modulo/.test(sql)) { const x = estado.get(p[0] === 'bot' ? 'INTERRUPTOR_BOT' : 'INTERRUPTOR_CORREO'); return { rows: x ? [{ modo: x.valor }] : [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor, vence/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: p[1], valor: p[2], vence: p[3] }); return { rows: [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor\) VALUES \('INTERRUPTOR_BOT'/.test(sql)) { estado.set('INTERRUPTOR_BOT', { clave: 'INTERRUPTOR_BOT', tipo: 'prop', valor: p[0] }); return { rows: [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor\) VALUES \(\$1, 'prop'/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: 'prop', valor: p[1] }); return { rows: [] }; }
      if (/INSERT INTO bot_eventos/.test(sql)) { eventos.push(p); return { rows: [] }; }
      if (/INSERT INTO bot_correos/.test(sql)) { correos.push(p); return { rows: [] }; }
      throw new Error('consulta no prevista: ' + sql.slice(0, 80));
    }
  };
}
function espejoDeMentira() {
  const libro = { Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto']],
    Leads: [['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo', 'Urgencia', 'Resumen', 'Acción', '¿Humano?', 'Mensaje original', 'ID destino (no tocar)', 'Respuesta', 'Enviado', 'Email', 'Respuesta_Bot']],
    Salientes: [['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']] };
  const aplicadas = [];
  return { libro, aplicadas, cargar: async () => {}, aplicar: async (ops) => { aplicadas.push(...ops); return ops.length; } };
}
const PROPS_BOT = { SHEET_ID: LEADS, KB_DOC_ID: 'kb', WIX_RESERVAS_URL: 'https://www.rosanta.rest/_functions/reservarBot', WA_PHONE_NUMBER_ID: 'pid', OWNER_WA: '50200000000', BOTONES_MODO: 'todos' };

/** Meta y Claude de mentira, sincronos (como pedidoConClaves). */
function pedidoDeMentira(opciones) {
  const o = opciones || {};
  const llamadas = [];
  const pedido = (url, op) => {
    llamadas.push({ url, op });
    if (url.indexOf('api.anthropic.com') >= 0) {
      if (o.claudeFalla) return { c: 500, t: '{"error":"x"}' };
      const r = { respuesta: '¡Hola! ¿En qué te ayudo?', lead: { idioma: 'es', nombre: '', telefono: '', email: '', fecha: '', fecha_actual: '', hora_actual: '', hora: '', personas: '',
        tipo_evento: '', formato_menu: '', presupuesto: '', opciones: [], mostrar_menu: false, tipo: 'consulta', urgencia: 'frio', resumen: 'saludo', accion: 'responder_info', requiere_humano: false } };
      return { c: 200, t: JSON.stringify({ model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify(r) }] }) };
    }
    if (/graph\./.test(url)) return o.metaFalla ? { c: 500, t: '{"error":{}}' } : { c: 200, t: '{"messages":[{"id":"x"}]}' };
    return { c: 404, t: '{}' };
  };
  return { pedido, llamadas };
}
function mensajeWa(texto, id) {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pid' }, contacts: [{ profile: { name: 'Ana' } }],
    messages: [{ id: id || 'wamid.1', from: '50255501111', type: 'text', text: { body: texto } }] } }] }] };
}
function armar(pool, opciones) {
  const espejo = espejoDeMentira();
  const reenviados = [];
  const m = pedidoDeMentira(opciones);
  const enviados = [];
  const bot = crearBotVivo({ pool, espejo, leadsId: LEADS, kb: async () => 'Base de prueba', claves: { WHATSAPP_TOKEN: 'secreto-wa' }, wixOrigen: 'https://www.rosanta.rest',
    pedido: m.pedido, correo: async (c) => { enviados.push(c); }, reenviar: async (c) => { reenviados.push(c); } });
  return { bot, espejo, reenviados, llamadas: m.llamadas, enviados };
}

test('Vivo: con el interruptor en puente (por defecto) cada mensaje se reenvía al bot de Apps Script, sin tocarlo', async () => {
  const pool = poolDeMentira(PROPS_BOT);
  const x = armar(pool);
  const r = await x.bot.recibir(mensajeWa('hola'), { token: TOKEN });
  assert.strictEqual(r.modo, 'puente');
  assert.strictEqual(r.resultado, 'reenviado');
  assert.strictEqual(x.reenviados.length, 1);
  assert.strictEqual(x.llamadas.length, 0, 'no llamó a Meta ni a Claude');
  assert.strictEqual(pool.eventos[0][2], 'reenviado');
  assert.deepStrictEqual(await x.bot.minuto(), { omitido: 'puente' });
});

test('Vivo: con el interruptor en vivo el código real del bot contesta por Meta, guarda el estado y copia a la hoja', async () => {
  const pool = poolDeMentira(Object.assign({ INTERRUPTOR_BOT: 'vivo', WEBHOOK_SECRET: 'no-se-guarda' }, PROPS_BOT));
  const x = armar(pool);
  const r = await x.bot.recibir(mensajeWa('hola'), { token: '$WEBHOOK_SECRET' });
  assert.strictEqual(r.resultado, 'atendido', JSON.stringify(r));
  assert.strictEqual(r.envios, 1);
  assert.strictEqual(x.reenviados.length, 0);
  const meta = x.llamadas.filter((l) => /graph\.facebook\.com\/.*\/messages/.test(l.url));
  assert.ok(meta.length >= 1);
  assert.match(JSON.stringify(meta[0].op.headers), /\$WHATSAPP_TOKEN/, 'el motor ve el marcador, no la clave');
  assert.ok(!JSON.stringify(x.llamadas).includes('secreto-wa'));
  assert.ok(x.espejo.aplicadas.some((op) => op.hoja === 'Conversaciones' && op.op === 'agregar'), 'anota en Conversaciones');
  assert.ok(x.espejo.aplicadas.some((op) => op.hoja === 'Leads'), 'anota en Leads');
  assert.ok(pool.estado.get('hist_50255501111'), 'el historial queda en la base');
  assert.ok(pool.estado.get('msg_wamid.1'), 'el mensaje queda como atendido (Meta reintenta)');
  SECRETAS.forEach((k) => assert.ok(!pool.estado.has(k) || pool.estado.get(k).valor !== '$' + k, k + ' no se guarda'));
  // Meta reintenta el mismo mensaje: no se contesta dos veces.
  const r2 = await x.bot.recibir(mensajeWa('hola'), { token: '$WEBHOOK_SECRET' });
  assert.strictEqual(r2.envios, 0);
  assert.strictEqual(x.reenviados.length, 0, 'un duplicado no se reenvía');
});

test('Vivo: red de seguridad — si Meta falla y el cliente quedó sin respuesta, el mensaje va al bot de Apps Script', async () => {
  const pool = poolDeMentira(Object.assign({ INTERRUPTOR_BOT: 'vivo' }, PROPS_BOT));
  const x = armar(pool, { metaFalla: true });
  // doPost atrapa el error de Meta y lo deja en el registro: sin ningún envío aceptado no hay respuesta.
  const r = await x.bot.recibir(mensajeWa('hola', 'wamid.9'), { token: '$WEBHOOK_SECRET' });
  assert.strictEqual(r.envios, 0);
  assert.strictEqual(r.resultado, 'reenviado_por_error');
  assert.strictEqual(x.reenviados.length, 1);
  assert.match(r.error, /Meta no acepto/);
  assert.strictEqual(pool.eventos[0][2], 'reenviado_por_error');
});

test('Vivo: solo llama a Meta, Claude y el Wix de Rosanta; cualquier otra dirección no sale', () => {
  const salidas = [];
  const { red, esWix } = crearRed({ wixOrigen: 'https://www.rosanta.rest', pedido: (u) => { salidas.push(u); return { c: 200, t: '{}' }; } });
  assert.strictEqual(red('https://evil.example.com/x', {}).getResponseCode(), 403);
  assert.strictEqual(red('https://www.rosanta.rest/otra', {}).getResponseCode(), 403);
  assert.strictEqual(red('https://www.rosanta.rest/_functions/consultarBot', {}).getResponseCode(), 200);
  assert.strictEqual(red('https://graph.facebook.com/v21.0/pid/messages', {}).getResponseCode(), 200);
  assert.ok(esWix('https://www.rosanta.rest/_functions/cancelarBot'));
  assert.strictEqual(salidas.length, 2);
});

test('Vivo: las claves se ponen en un proceso aparte (ni en el motor, ni en la línea de comandos)', async () => {
  // El servidor de prueba va en OTRO proceso: el pedido es sincrono y bloquea a este.
  const { spawn } = require('child_process');
  const srv = spawn(process.execPath, ['-e', 'require("http").createServer((q,s)=>{let b="";q.on("data",c=>b+=c);q.on("end",()=>{process.stderr.write(JSON.stringify({auth:q.headers.authorization,b,url:q.url})+"\\n");s.end("{}")})}).listen(0,function(){process.stdout.write(String(this.address().port)+"\\n")})']);
  try {
    const port = await new Promise((r) => srv.stdout.once('data', (d) => r(String(d).trim())));
    let visto = '';
    srv.stderr.on('data', (d) => { visto += d; });
    const r = pedidoConClaves('http://127.0.0.1:' + port + '/x?t=$IG_TOKEN', { method: 'post', headers: { Authorization: 'Bearer $WHATSAPP_TOKEN' }, payload: '{"secreto":"$WIX_RESERVAS_SECRETO"}' },
      { WHATSAPP_TOKEN: 'wa-123', IG_TOKEN: 'ig-456', WIX_RESERVAS_SECRETO: 'wix-789' });
    assert.strictEqual(r.c, 200);
    await new Promise((res) => setTimeout(res, 100));
    const v = JSON.parse(visto.trim().split('\n')[0]);
    assert.strictEqual(v.auth, 'Bearer wa-123');
    assert.strictEqual(v.url, '/x?t=ig-456');
    assert.strictEqual(v.b, '{"secreto":"wix-789"}');
  } finally { srv.kill(); }
});

test('Vivo: el estado nunca guarda claves ni el interruptor; borrar = NULL', async () => {
  const pool = poolDeMentira({ A: '1', B: '2' });
  const e = await cargarEstado(pool);
  const antes = foto(e);
  e.props.set('A', '9'); e.props.delete('B'); e.props.set('IG_TOKEN', 'real-token'); e.props.set('INTERRUPTOR_BOT', 'vivo');
  e.cache.set('hist_x', { v: '[]', vence: Date.now() + 60000 });
  await guardarEstado(pool, antes, e);
  assert.strictEqual(pool.estado.get('A').valor, '9');
  assert.strictEqual(pool.estado.get('B').valor, null);
  assert.ok(!pool.estado.has('IG_TOKEN'));
  assert.ok(!pool.estado.has('INTERRUPTOR_BOT'));
  assert.strictEqual(pool.estado.get('hist_x').tipo, 'cache');
});

test('Vivo: sin autorización de Gmail el correo queda pendiente (no se pierde)', async () => {
  const pool = poolDeMentira();
  const c = crearCorreo({ pool, gmail: null });
  assert.strictEqual(await c.enviar({ to: 'restaurante@rosanta.rest', subject: '🔔 Lead para atender', body: 'x' }), false);
  assert.strictEqual(pool.correos.length, 1);
  assert.match(armarMime('a@b.c', 'Ñandú', 'hola'), /Subject: =\?UTF-8\?B\?/);
});

test('Vivo: la copia a la hoja respeta fila y columna, y las fechas quedan como fecha', async () => {
  const pedidos = [];
  const sheets = { spreadsheets: { values: { update: async (p) => { pedidos.push(p); } }, batchUpdate: async (p) => { pedidos.push(p); return { data: { replies: [{ addSheet: { properties: { sheetId: 7 } } }] } }; } } };
  const e = crearEspejo({ sheets, id: LEADS });
  e.idsHoja.Salientes = 3;
  await e.aplicar([{ op: 'agregar', hoja: 'Conversaciones', fila: 12, valores: [[new Date(2026, 9, 19, 9, 5, 0), 'whatsapp', '502']] },
    { op: 'fijar', hoja: 'Salientes', fila: 4, col: 6, valores: [['x']] }, { op: 'borrar', hoja: 'Salientes', fila: 2, n: 3 }]);
  assert.strictEqual(pedidos[0].range, "'Conversaciones'!A12");
  assert.strictEqual(pedidos[0].requestBody.values[0][0], '2026-10-19 09:05:00');
  assert.strictEqual(pedidos[1].range, "'Salientes'!F4");
  assert.deepStrictEqual(pedidos[2].requestBody.requests[0].deleteDimension.range, { sheetId: 3, dimension: 'ROWS', startIndex: 1, endIndex: 4 });
  assert.ok(leerCelda('2026-10-19 09:05:00') instanceof Date);
  assert.strictEqual(escribirCelda(null), '');
  assert.strictEqual(letra(28), 'AB');
});

test('Vivo: el webhook verifica como el bot, ignora WhatsApp sin token y el interruptor pide la clave', async () => {
  const pool = poolDeMentira(PROPS_BOT);
  const x = armar(pool);
  const app = crearAppBot({ servicio: {}, claveTareas: 'k', version: 't', vivo: x.bot, correo: null, pool, verifyToken: 'vt', webhookSecret: TOKEN });
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.strictEqual(await (await fetch(base + '/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123')).text(), '123');
    assert.strictEqual((await fetch(base + '/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=1')).status, 403);
    await fetch(base + '/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mensajeWa('hola')) });
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(x.reenviados.length, 0, 'sin token no se atiende ni se reenvía');
    assert.deepStrictEqual(pool.eventos, [['whatsapp_business_account']], 'queda anotado como ignorado (sin token)');
    await fetch(base + '/webhook?token=' + TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mensajeWa('hola')) });
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(x.reenviados.length, 1, 'con token y en puente: al bot de siempre');
    // El interruptor ya no se cambia por el servidor (tabla interruptores, guion del día único): la ruta no existe.
    assert.strictEqual((await fetch(base + '/tareas/interruptor-bot', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rosanta-tarea': 'k' }, body: '{"valor":"vivo"}' })).status, 404);
    const imp = await (await fetch(base + '/tareas/importar-estado-bot', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rosanta-tarea': 'k' },
      body: JSON.stringify({ props: { OWNER_WA: '502', WHATSAPP_TOKEN: 'no', IG_TOKEN: 'no', ANTHROPIC_API_KEY: 'no', hum_502: '{"estado":"esperando"}' } }) })).json();
    assert.deepStrictEqual(imp, { ok: true, guardadas: 2, clavesOmitidas: 3 });
  } finally { srv.close(); }
});

test('Vivo: una foto de la consola por WhatsApp se baja de Drive, se sube a Meta como archivo y se manda por su id', async () => {
  const pool = poolDeMentira(Object.assign({ INTERRUPTOR_BOT: 'vivo' }, PROPS_BOT));
  const espejo = espejoDeMentira();
  espejo.libro.Salientes.push([new Date(), 'whatsapp', '50255501111', 'Así se ve la mesa', 'imagen:FOTO123', '']);
  const llamadas = [];
  const pedido = (url, op) => {
    llamadas.push({ url, op });
    if (url === 'https://drive.google.com/uc?export=download&id=FOTO123') return { c: 200, b64: Buffer.from('JPEGDATA').toString('base64'), mime: 'image/jpeg' };
    if (/\/media$/.test(url)) return { c: 200, t: '{"id":"media-1"}' };
    if (/\/messages$/.test(url)) return { c: 200, t: '{"messages":[{"id":"x"}]}' };
    return { c: 404, t: '{}' };
  };
  const bot = crearBotVivo({ pool, espejo, leadsId: LEADS, kb: async () => '', claves: {}, wixOrigen: 'https://www.rosanta.rest', pedido,
    correo: async () => {}, reenviar: async () => {} });
  const r = await bot.minuto();
  assert.strictEqual(r.error, null);
  const subida = llamadas.find((l) => /\/media$/.test(l.url));
  assert.ok(subida, 'subió la foto a Meta');
  assert.strictEqual(subida.op.payload.file._b64, Buffer.from('JPEGDATA').toString('base64'));
  assert.strictEqual(subida.op.payload.file.getContentType(), 'image/jpeg');
  const envio = llamadas.find((l) => /\/messages$/.test(l.url));
  assert.deepStrictEqual(JSON.parse(envio.op.payload).image, { id: 'media-1', caption: 'Así se ve la mesa' });
  assert.ok(espejo.aplicadas.some((op) => op.hoja === 'Salientes' && op.op === 'fijar'), 'marca Enviado en Salientes');
  assert.strictEqual(r.envios, 1);
});

test('Vivo: el formulario multipart lleva los bytes de la foto (proceso aparte, sin salir a internet)', async () => {
  const { spawn } = require('child_process');
  const srv = spawn(process.execPath, ['-e', 'require("http").createServer((q,s)=>{const b=[];q.on("data",c=>b.push(c));q.on("end",()=>{const t=Buffer.concat(b).toString("latin1");process.stderr.write(JSON.stringify({ct:q.headers["content-type"],auth:q.headers.authorization,tieneFoto:t.includes("JPEGDATA"),tieneCampo:t.includes("messaging_product")})+"\\n");s.setHeader("content-type","application/json");s.end("{\\"id\\":\\"m\\"}")})}).listen(0,function(){process.stdout.write(String(this.address().port)+"\\n")})']);
  try {
    const port = await new Promise((r) => srv.stdout.once('data', (d) => r(String(d).trim())));
    let visto = '';
    srv.stderr.on('data', (d) => { visto += d; });
    const { blob } = require('../src/vivo');
    const r = pedidoConClaves('http://127.0.0.1:' + port + '/media', { method: 'post', headers: { Authorization: 'Bearer $WHATSAPP_TOKEN' },
      payload: { messaging_product: 'whatsapp', type: 'image/jpeg', file: blob(Buffer.from('JPEGDATA').toString('base64'), 'image/jpeg', 'foto.jpg') } }, { WHATSAPP_TOKEN: 'wa-1' });
    assert.strictEqual(r.c, 200);
    await new Promise((res) => setTimeout(res, 100));
    const v = JSON.parse(visto.trim().split('\n')[0]);
    assert.match(v.ct, /multipart\/form-data/);
    assert.strictEqual(v.auth, 'Bearer wa-1');
    assert.ok(v.tieneFoto && v.tieneCampo);
  } finally { srv.kill(); }
});

test('Vivo: el token de Instagram se renueva, se guarda como versión nueva del secreto y nunca se devuelve', async () => {
  const claves = { IG_TOKEN: 'viejo' };
  const guardados = [];
  let urlVista = '';
  const r = await refrescarTokenIg({ claves, guardarSecreto: async (n, v) => { guardados.push([n, v]); },
    pedido: (u) => { urlVista = u; return { c: 200, t: '{"access_token":"nuevo-123","token_type":"bearer","expires_in":5184000}' }; } });
  assert.deepStrictEqual(r, { ok: true, venceEnDias: 60 });
  assert.match(urlVista, /access_token=\$IG_TOKEN$/, 'el token va como marcador');
  assert.deepStrictEqual(guardados, [['bot-ig-token', 'nuevo-123']]);
  assert.strictEqual(claves.IG_TOKEN, 'nuevo-123');
  assert.ok(!JSON.stringify(r).includes('nuevo-123'));
  const mal = await refrescarTokenIg({ claves, guardarSecreto: async () => { throw new Error('no debia guardar'); }, pedido: () => ({ c: 400, t: '{"error":{"message":"Session has expired"}}' }) });
  assert.strictEqual(mal.ok, false);
  assert.match(mal.error, /HTTP 400: Session has expired/);
});
