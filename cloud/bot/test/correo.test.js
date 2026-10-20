/**
 * Canal de correo del bot en la nube (20-oct-2026): Correo.js real con Gmail, Claude, Wix y la base de mentira.
 * Nada sale a internet.
 */
const test = require('node:test');
const assert = require('node:assert');
const { crearCanalCorreo, modoCorreo } = require('../src/correo-canal');
const { crearGmailSincrono, textoPlano, deB64url } = require('../src/gmail-sincrono');

const LEADS = 'leads-real';
const WIX = 'https://www.rosanta.rest';
const PROPS_BOT = { SHEET_ID: LEADS, KB_DOC_ID: 'kb', WIX_RESERVAS_URL: WIX + '/_functions/reservaBot', WA_PHONE_NUMBER_ID: 'pid', OWNER_WA: '50200000000', BOTONES_MODO: 'todos' };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

function poolDeMentira(inicial) {
  const estado = new Map(Object.entries(inicial || {}).map(([k, v]) => [k, { clave: k, tipo: 'prop', valor: v, vence: null }]));
  const sombra = [];
  return {
    estado, sombra,
    query: async (sql, p) => {
      if (/SELECT clave, tipo, valor, vence FROM bot_estado/.test(sql)) return { rows: Array.from(estado.values()).filter((x) => x.valor !== null) };
      if (/WHERE clave = 'INTERRUPTOR_CORREO'/.test(sql)) { const x = estado.get('INTERRUPTOR_CORREO'); return { rows: x ? [x] : [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor, vence/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: p[1], valor: p[2], vence: p[3] }); return { rows: [] }; }
      if (/VALUES \('INTERRUPTOR_CORREO', 'prop', \$1\)/.test(sql)) { estado.set('INTERRUPTOR_CORREO', { clave: 'INTERRUPTOR_CORREO', tipo: 'prop', valor: p[0] }); return { rows: [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor, actualizado\) VALUES \(\$1, 'prop'/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: 'prop', valor: p[1] }); return { rows: [] }; }
      if (/INSERT INTO bot_correo_sombra/.test(sql)) { sombra.push({ tipo: p[0], hilo: p[1], mensaje: p[2], para: p[3], asunto: p[4], cuerpo: p[5] }); return { rows: [] }; }
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

/** Gmail, Claude, Wix y Meta de mentira, síncronos (como pedidoConClaves). */
function mundo(op) {
  const o = op || {};
  const llamadas = [];
  const cuando = String(Date.now() - 60000);
  const hilo = { id: 'h-louise', messages: [{ id: 'm-louise', internalDate: cuando, labelIds: ['INBOX'], payload: { mimeType: 'multipart/alternative',
    headers: [{ name: 'From', value: '"Louise Thomas" <louise@ejemplo.test>' }, { name: 'Subject', value: 'Our reservation' }, { name: 'Message-ID', value: '<abc@mail>' }],
    parts: [{ mimeType: 'text/plain', body: { data: b64('Could we move Monday 5:30pm to Sunday Oct 25 at 6pm? Louise') } }] } }] };
  const lead = Object.assign({ idioma: 'en', nombre: 'Louise', telefono: '', email: '', fecha: '2026-10-25', fecha_actual: '2026-10-26', hora_actual: '17:30', hora: '18:00', personas: '3',
    tipo_evento: '', formato_menu: '', presupuesto: '', opciones: [], mostrar_menu: false, tipo: 'reserva', urgencia: 'tibio', resumen: 'Mover la reserva', accion: 'cambiar_reserva', requiere_humano: false }, o.lead || {});
  const pedido = (url, opciones) => {
    llamadas.push({ url, op: opciones });
    if (url.indexOf('gmail.googleapis.com') >= 0) {
      assert.match(String(opciones.headers.Authorization), /\$GMAIL_TOKEN/, 'el token viaja como marcador');
      if (/\/threads\?q=/.test(url)) return { c: 200, t: JSON.stringify({ threads: [{ id: hilo.id }] }) };
      if (/\/threads\/h-louise/.test(url)) return { c: 200, t: JSON.stringify(hilo) };
      if (/messages\/send|drafts/.test(url)) return { c: 200, t: '{"id":"enviado"}' };
    }
    if (url.indexOf('api.anthropic.com') >= 0) {
      return { c: 200, t: JSON.stringify({ model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify({ respuesta: o.respuesta || 'Let me check.', lead }) }] }) };
    }
    if (url.indexOf(WIX + '/_functions/') === 0) {
      const ruta = url.replace(/^.*\//, '');
      if (ruta === 'cambiarBot') return { c: 200, t: JSON.stringify(o.wixCambiar || { ok: true, modo: 'modificada', vieja_cancelada: true, antes: { fecha: '2026-10-26', hora: '17:30', personas: 3 }, ahora: { fecha: '2026-10-25', hora: '18:00', personas: 3 }, nombre: 'Louise Thomas', email: 'louise@ejemplo.test' }) };
      return { c: 200, t: '{"ok":true,"reservas":[]}' };
    }
    if (/graph\./.test(url)) return { c: 200, t: '{"messages":[{"id":"x"}]}' };
    return { c: 404, t: '{}' };
  };
  return { pedido, llamadas };
}

function canal(pool, m, espejo) {
  const correos = [];
  const c = crearCanalCorreo({ pool, espejo: espejo || espejoDeMentira(), leadsId: LEADS, kb: async () => 'KB', claves: {}, wixOrigen: WIX,
    accessToken: async () => 'tok-gmail', correo: async (x) => correos.push(x), pedido: m.pedido });
  return { c, correos };
}
const vistos = (pool, k) => JSON.parse((pool.estado.get(k) || {}).valor || '[]');

test('Correo en la nube: el interruptor arranca en "apps" y entonces la nube no toca Gmail', async () => {
  const pool = poolDeMentira(PROPS_BOT);
  const m = mundo();
  const { c } = canal(pool, m);
  assert.strictEqual(await modoCorreo(pool), 'apps');
  assert.deepStrictEqual(await c.minuto(), { modo: 'apps', omitido: true });
  assert.strictEqual(m.llamadas.length, 0);
});

test('Correo en SOMBRA: lee Gmail y piensa, pero no manda, no cambia Wix, no avisa ni escribe hojas; sus vistos van aparte', async () => {
  const pool = poolDeMentira(Object.assign({}, PROPS_BOT, { INTERRUPTOR_CORREO: 'sombra', CORREO_DESDE: '1', CORREO_VISTOS: '["viejo"]', SOMBRA_CORREO_DESDE: '1' }));
  const m = mundo();
  const espejo = espejoDeMentira();
  const { c, correos } = canal(pool, m, espejo);
  const r = await c.minuto();
  assert.strictEqual(r.modo, 'sombra');
  assert.ok(!m.llamadas.some((x) => /messages\/send|drafts/.test(x.url)), 'no sale nada por Gmail');
  assert.ok(!m.llamadas.some((x) => /cambiarBot|cancelarBot|reservaBot/.test(x.url)), 'no cambia Wix de verdad');
  assert.ok(!m.llamadas.some((x) => /graph\./.test(x.url)), 'no manda WhatsApp');
  assert.ok(m.llamadas.some((x) => /api\.anthropic\.com/.test(x.url)), 'sí piensa con Claude');
  assert.strictEqual(correos.length, 0);
  assert.strictEqual(espejo.aplicadas.length, 0, 'no escribe en Rosanta Leads');
  const tipos = pool.sombra.map((x) => x.tipo);
  assert.ok(tipos.includes('respuesta'), 'anota que habría contestado solo: ' + tipos.join(','));
  assert.ok(tipos.includes('wix:cambiarBot'));
  const resp = pool.sombra.find((x) => x.tipo === 'respuesta');
  assert.strictEqual(resp.hilo, 'h-louise');
  assert.strictEqual(resp.mensaje, 'm-louise');
  assert.deepStrictEqual(vistos(pool, 'SOMBRA_CORREO_VISTOS'), ['m-louise']);
  assert.deepStrictEqual(vistos(pool, 'CORREO_VISTOS'), ['viejo'], 'los vistos del bot de Apps Script no se tocan');
  await c.minuto();
  assert.strictEqual(pool.sombra.filter((x) => x.tipo === 'respuesta').length, 1, 'la vuelta siguiente no repite');
});

test('Correo en la NUBE: contesta en el mismo hilo (In-Reply-To) y guarda sus vistos', async () => {
  const pool = poolDeMentira(Object.assign({}, PROPS_BOT, { INTERRUPTOR_CORREO: 'nube', CORREO_DESDE: '1' }));
  const m = mundo();
  const espejo = espejoDeMentira();
  const { c } = canal(pool, m, espejo);
  const r = await c.minuto();
  assert.strictEqual(r.modo, 'nube');
  const envio = m.llamadas.find((x) => /messages\/send/.test(x.url));
  assert.ok(envio, 'salió la respuesta');
  const cuerpo = JSON.parse(envio.op.payload);
  assert.strictEqual(cuerpo.threadId, 'h-louise');
  const raw = deB64url(cuerpo.raw);
  assert.match(raw, /In-Reply-To: <abc@mail>/);
  assert.match(raw, /To: "Louise Thomas" <louise@ejemplo.test>/);
  assert.ok(m.llamadas.some((x) => /cambiarBot/.test(x.url)), 'el cambio sí va a Wix');
  assert.deepStrictEqual(vistos(pool, 'CORREO_VISTOS'), ['m-louise']);
  assert.ok(espejo.aplicadas.length > 0, 'deja registro en Rosanta Leads');
});

test('Correo en la NUBE: si no se resuelve, borrador en el hilo + aviso a Juanma (la regla de la @63)', async () => {
  const pool = poolDeMentira(Object.assign({}, PROPS_BOT, { INTERRUPTOR_CORREO: 'nube', CORREO_DESDE: '1' }));
  const m = mundo({ wixCambiar: { ok: false, motivo: 'SIN_COINCIDENCIA' } });
  const { c, correos } = canal(pool, m);
  await c.minuto();
  const borr = m.llamadas.find((x) => /\/drafts$/.test(x.url));
  assert.ok(borr, 'dejó borrador');
  assert.strictEqual(JSON.parse(borr.op.payload).message.threadId, 'h-louise');
  assert.ok(correos.some((x) => /Lead para atender \(correo\)/.test(x.subject)), 'avisó a Juanma');
  assert.ok(m.llamadas.some((x) => /graph\./.test(x.url) && /Lead para atender/.test(String(x.op.payload))), 'y por WhatsApp');
});

test('Gmail: texto del HTML cuando no hay parte plana, y los borradores se reconocen', () => {
  assert.strictEqual(textoPlano({ mimeType: 'text/html', body: { data: b64('<p>Hola<br>mundo &amp; más</p>') } }).trim(), 'Hola\nmundo & más');
  const g = crearGmailSincrono({ escribir: false, pedido: (u) => ({ getResponseCode: () => 200, getContentText: () => (/threads\?/.test(u) ? '{"threads":[{"id":"t"}]}'
    : JSON.stringify({ messages: [{ id: 'd', internalDate: '1', labelIds: ['DRAFT'], payload: { headers: [] } }] })) }) });
  const h = g.search('q', 0, 5);
  assert.strictEqual(h[0].getMessages()[0].isDraft(), true);
  h[0].getMessages()[0].reply('x');
  assert.strictEqual(g.registro[0].tipo, 'respuesta');
});

test('Correo: sin el bot en vivo, "nube" no corre; /correo/quien dice el modo sin clave y el interruptor pide la clave', async () => {
  const pool = poolDeMentira(Object.assign({}, PROPS_BOT, { INTERRUPTOR_CORREO: 'nube', CORREO_DESDE: '1' }));
  const m = mundo();
  const c = crearCanalCorreo({ pool, espejo: espejoDeMentira(), leadsId: LEADS, kb: async () => 'KB', claves: {}, wixOrigen: WIX, soloSombra: true,
    accessToken: async () => 'tok', correo: async () => {}, pedido: m.pedido });
  const r = await c.minuto();
  assert.match(r.error, /no tiene el bot en vivo/);
  assert.strictEqual(m.llamadas.length, 0);
  const { crearAppBot } = require('../src/app-bot');
  const app = crearAppBot({ servicio: {}, claveTareas: 'clave', version: 't', canalCorreo: c, pool });
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.deepStrictEqual(await (await fetch(base + '/correo/quien')).json(), { modo: 'nube' });
    assert.strictEqual((await fetch(base + '/tareas/interruptor-correo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"valor":"apps"}' })).status, 403);
    const ok = await fetch(base + '/tareas/interruptor-correo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rosanta-tarea': 'clave' }, body: '{"valor":"apps"}' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(pool.estado.get('INTERRUPTOR_CORREO').valor, 'apps');
  } finally { srv.close(); }
});
