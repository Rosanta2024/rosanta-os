/**
 * Puente con "sombra viva" (20-oct-2026): cada mensaje real se reenvía al bot de Apps Script y además se piensa sin
 * mandar nada. Condición de Juanma: CERO envíos a clientes, probado aquí. Nada sale a internet.
 */
const test = require('node:test');
const assert = require('node:assert');
const { crearBotVivo } = require('../src/vivo');
const { crearSombraViva, mensajesDe } = require('../src/sombra-viva');
const { crearAppBot } = require('../src/app-bot');

const WIX = 'https://www.rosanta.rest';
const TOKEN = 'tok-webhook-real';

function pool(inicial) {
  const estado = new Map(Object.entries(inicial || {}).map(([k, v]) => [k, { clave: k, tipo: 'prop', valor: v, vence: null }]));
  const sv = [], eventos = [];
  return {
    estado, sv, eventos,
    query: async (sql, p) => {
      if (/FROM interruptores WHERE modulo/.test(sql)) { const x = estado.get('INTERRUPTOR_BOT'); return { rows: x ? [{ modo: x.valor }] : [] }; }
      if (/FROM bot_estado WHERE clave LIKE 'SV:%'/.test(sql)) return { rows: Array.from(estado.values()).filter((x) => x.clave.indexOf('SV:') === 0 && x.valor !== null) };
      if (/SELECT clave, tipo, valor, vence FROM bot_estado/.test(sql)) return { rows: Array.from(estado.values()).filter((x) => x.valor !== null) };
      if (/count\(\*\)::int AS n FROM bot_sombra_viva/.test(sql)) return { rows: [{ n: sv.filter((x) => x.estado === 'pensado').length }] };
      if (/INSERT INTO bot_sombra_viva .*'omitido_tope'/.test(sql)) { sv.push({ canal: p[0], contacto: p[1], estado: 'omitido_tope' }); return { rows: [] }; }
      if (/INSERT INTO bot_sombra_viva/.test(sql)) { sv.push({ canal: p[0], contacto: p[1], mensaje: p[2], cliente: p[3], respuesta: p[4], botones: JSON.parse(p[5]), acciones: JSON.parse(p[6]), estado: p[7], error: p[8] }); return { rows: [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor, vence/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: p[1], valor: p[2], vence: p[3] }); return { rows: [] }; }
      if (/INSERT INTO bot_eventos/.test(sql)) { eventos.push(p); return { rows: [] }; }
      if (/INSERT INTO bot_estado \(clave, tipo, valor\) VALUES \(\$1, 'prop'/.test(sql)) { estado.set(p[0], { clave: p[0], tipo: 'prop', valor: p[1] }); return { rows: [] }; }
      throw new Error('consulta no prevista: ' + sql.slice(0, 80));
    }
  };
}
const lead = (o) => Object.assign({ idioma: 'es', nombre: 'Ana', telefono: '', email: 'ana@ejemplo.test', fecha: '2026-12-05', fecha_actual: '', hora_actual: '', hora: '20:00', personas: '2',
  tipo_evento: '', formato_menu: '', presupuesto: '', opciones: [], mostrar_menu: false, tipo: 'reserva', urgencia: 'tibio', resumen: 'Reserva', accion: 'crear_reserva', requiere_humano: false }, o || {});
function mundo(o) {
  const llamadas = [];
  const pedido = (url, op) => {
    llamadas.push({ url, op });
    if (url.indexOf('api.anthropic.com') >= 0) return { c: 200, t: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ respuesta: (o && o.respuesta) || 'Listo, ¿a tu nombre?', lead: lead(o && o.lead) }) }] }) };
    if (url.indexOf(WIX + '/_functions/consultarBot') === 0) return { c: 200, t: '{"ok":true,"reservas":[]}' };
    return { c: 200, t: '{"messages":[{"id":"x"}]}' };
  };
  return { llamadas, pedido };
}
function wa(texto, id, de) {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pid-real' }, contacts: [{ profile: { name: 'Ana' } }],
    messages: [{ id: id || 'wamid.1', from: de || '50255501111', type: 'text', text: { body: texto } }] } }] }] };
}
function armar(p, o) {
  const m = mundo(o);
  const reenviados = [];
  const sombraViva = crearSombraViva({ pool: p, kb: async () => 'KB', wixOrigen: WIX, leadsId: 'leads', maxDia: (o && o.maxDia) || 40, pedido: m.pedido,
    claves: { ANTHROPIC_API_KEY: 'k', WIX_RESERVAS_SECRETO: 'w' } });
  const bot = crearBotVivo({ pool: p, soloPuente: true, sombraViva, espejo: { libro: {}, aplicar: async () => 0 }, leadsId: 'leads', kb: async () => 'KB', claves: {},
    wixOrigen: WIX, correo: async () => false, reenviar: async (c) => { reenviados.push(c); }, pedido: m.pedido });
  return { bot, sombraViva, m, reenviados };
}
const nadaSale = (llamadas) => llamadas.filter((l) => (/graph\.(facebook|instagram)\.com/.test(l.url) && String((l.op && l.op.method) || 'get').toLowerCase() !== 'get') ||
  /_functions\/(reservaBot|cambiarBot|cancelarBot)/.test(l.url) || /gmail\.googleapis/.test(l.url));

test('Sombra viva: reenvía al bot de siempre y piensa el mensaje SIN mandar nada (ni Meta, ni Wix, ni correo), aunque la tabla diga vivo', async () => {
  const p = pool({ INTERRUPTOR_BOT: 'vivo' });
  const x = armar(p);
  const r = await x.bot.recibir(wa('Quiero reservar el 5 de diciembre a las 8 pm para 2, mi correo es ana@ejemplo.test'), { token: '$WEBHOOK_SECRET' });
  assert.strictEqual(r.resultado, 'reenviado', 'en puente siempre contesta el bot de Apps Script');
  assert.strictEqual(x.reenviados.length, 1);
  await x.sombraViva.pensar({ object: 'nada' });   // espera a que termine la fila de la sombra
  assert.deepStrictEqual(nadaSale(x.m.llamadas), [], 'CERO envíos: ' + JSON.stringify(nadaSale(x.m.llamadas).map((l) => l.url)));
  assert.ok(x.m.llamadas.some((l) => /api\.anthropic\.com/.test(l.url)), 'sí piensa con Claude');
  const fila = p.sv.find((s) => s.estado === 'pensado');
  assert.ok(fila, JSON.stringify(p.sv));
  assert.strictEqual(fila.contacto, '50255501111');
  assert.ok(fila.respuesta.length > 0, 'anota lo que habría contestado');
  assert.ok(Array.from(p.estado.keys()).some((k) => k.indexOf('SV:') === 0), 'su estado va aparte, con el prefijo SV:');
  assert.ok(!p.estado.has('hist_50255501111'), 'no toca el estado del bot en vivo');
});

test('Sombra viva: tope de mensajes por día (gasto); los estados de entrega de WhatsApp y los ecos no cuentan', async () => {
  const p = pool();
  const x = armar(p, { maxDia: 1 });
  await x.bot.recibir(wa('hola', 'wamid.a'), { token: '$WEBHOOK_SECRET' });
  await x.bot.recibir(wa('otra vez', 'wamid.b'), { token: '$WEBHOOK_SECRET' });
  await x.sombraViva.pensar({ object: 'nada' });
  assert.strictEqual(p.sv.filter((s) => s.estado === 'pensado').length, 1);
  assert.strictEqual(p.sv.filter((s) => s.estado === 'omitido_tope').length, 1);
  assert.strictEqual(x.m.llamadas.filter((l) => /anthropic/.test(l.url)).length, 1, 'pasado el tope ya no llama a Claude');
  assert.strictEqual(x.reenviados.length, 2, 'el reenvío al bot de siempre no tiene tope');
  assert.deepStrictEqual(mensajesDe({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [{ id: 's' }] } }] }] }), []);
  assert.deepStrictEqual(mensajesDe({ object: 'instagram', entry: [{ messaging: [{ sender: { id: 'r' }, message: { is_echo: true, text: 'x' } }] }] }), []);
  assert.strictEqual(mensajesDe({ object: 'instagram', entry: [{ messaging: [{ sender: { id: '9' }, message: { mid: 'm', text: 'hola', attachments: [{ type: 'image' }] } }] }] })[0].texto, '📷 [Foto] hola');
});

test('Vivo (arreglo): con el token REAL de Meta en la URL, el bot atiende (antes se reenviaba por error)', async () => {
  const p = pool({ INTERRUPTOR_BOT: 'vivo', SHEET_ID: 'leads', KB_DOC_ID: 'kb', WIX_RESERVAS_URL: WIX + '/_functions/reservaBot', WA_PHONE_NUMBER_ID: 'pid-real', OWNER_WA: '50200000000', BOTONES_MODO: 'todos' });
  const m = mundo({ lead: { accion: 'responder_info', tipo: 'consulta' }, respuesta: '¡Hola! ¿En qué te ayudo?' });
  const reenviados = [];
  const espejo = { libro: { Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto']],
    Leads: [['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo', 'Urgencia', 'Resumen', 'Acción', '¿Humano?', 'Mensaje original', 'ID destino (no tocar)', 'Respuesta', 'Enviado', 'Email', 'Respuesta_Bot']],
    Salientes: [['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']] }, cargar: async () => {}, aplicar: async () => 0 };
  const bot = crearBotVivo({ pool: p, espejo, leadsId: 'leads', kb: async () => 'KB', claves: { WHATSAPP_TOKEN: 'wa' }, wixOrigen: WIX, pedido: m.pedido,
    correo: async () => {}, reenviar: async (c) => { reenviados.push(c); } });
  const app = crearAppBot({ servicio: {}, claveTareas: 'k', version: 't', vivo: bot, correo: null, pool: p, verifyToken: 'vt', webhookSecret: TOKEN });
  const srv = app.listen(0);
  try {
    await fetch('http://127.0.0.1:' + srv.address().port + '/webhook?token=' + TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(wa('hola')) });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(reenviados.length, 0, 'no se reenvía: lo atiende la nube');
    assert.strictEqual(p.eventos[0][2], 'atendido', JSON.stringify(p.eventos));
  } finally { srv.close(); }
});

test('Comparación de la noche: igual, grave (uno contesta y el otro no), leve si atendía una persona, y sin dato si la copia no lo tiene', async () => {
  const { compararVivaNoche } = require('../src/viva-comparar');
  const hora = (min) => ({ $d: new Date(Date.parse('2026-10-28T10:00:00-06:00') + min * 60000 - 6 * 3600000).toISOString().slice(0, 19) });
  const conv = [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto'],
    [hora(0), 'whatsapp', 'A', '', 'in', 'cliente', 'hola'], [hora(0.2), 'whatsapp', 'A', '', 'out', 'bot', '¡Hola!'],
    [hora(10), 'whatsapp', 'B', '', 'in', 'cliente', 'hola'],
    [hora(15), 'whatsapp', 'C', '', 'out', 'juanma', 'Hola, soy del equipo'], [hora(20), 'whatsapp', 'C', '', 'in', 'cliente', 'ok gracias']];
  const filas = [
    { id: 1, recibido: new Date(Date.parse('2026-10-28T10:00:00-06:00')), canal: 'whatsapp', contacto: 'A', respuesta: '¡Hola! ¿Qué tal?', acciones: { humano: false } },
    { id: 2, recibido: new Date(Date.parse('2026-10-28T10:10:00-06:00')), canal: 'whatsapp', contacto: 'B', respuesta: 'Hola, te ayudo', acciones: { humano: false } },
    { id: 3, recibido: new Date(Date.parse('2026-10-28T10:20:00-06:00')), canal: 'whatsapp', contacto: 'C', respuesta: 'De nada', acciones: { humano: false } },
    { id: 4, recibido: new Date(Date.parse('2026-10-28T11:00:00-06:00')), canal: 'whatsapp', contacto: 'D', respuesta: 'x', acciones: {} }];
  const upd = {};
  const p = { query: async (sql, a) => {
    if (/FROM hojas_copia_f2/.test(sql)) return { rows: [{ pestana: 'Conversaciones', filas: conv }, { pestana: 'Leads', filas: [[]] }] };
    if (/FROM bot_sombra_viva/.test(sql)) return { rows: filas };
    if (/UPDATE bot_sombra_viva/.test(sql)) { upd[a[0]] = { comparado: a[1], grave: a[2] }; return { rows: [] }; }
    throw new Error(sql);
  } };
  const r = await compararVivaNoche({ pool: p });
  assert.strictEqual(upd[1].comparado, 'igual');
  assert.strictEqual(upd[2].grave, true, 'B: la sombra contesta y el real se calló sin razón');
  assert.strictEqual(upd[3].grave, false, 'C: atendía una persona → leve');
  assert.ok(!upd[4], 'D: la copia no tiene el mensaje → sin dato, se reintenta');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.graves, 1);
  assert.strictEqual(r.sinDato, 1);
});

test('Puente: si el reenvío al bot de siempre falla, reintenta 3 veces y deja la marca PUENTE_REENVIO_FALLO (alerta)', async () => {
  const p = pool();
  let n = 0;
  const bot = crearBotVivo({ pool: p, soloPuente: true, esperaReintento: 0, espejo: { libro: {}, aplicar: async () => 0 }, leadsId: 'leads', kb: async () => '', claves: {}, wixOrigen: WIX,
    correo: async () => false, reenviar: async () => { n++; throw new Error('El bot de Apps Script contesto 503'); } });
  const errores = [];
  const orig = console.error; console.error = (m) => errores.push(String(m));
  try {
    const r = await bot.recibir(wa('hola'), { token: '$WEBHOOK_SECRET' });
    assert.strictEqual(r.resultado, 'reenvio_fallido');
  } finally { console.error = orig; }
  assert.strictEqual(n, 3);
  assert.ok(errores.some((m) => /^PUENTE_REENVIO_FALLO/.test(m)));
  assert.strictEqual(p.eventos[0][2], 'reenvio_fallido');
  let k = 0;
  const bot2 = crearBotVivo({ pool: p, soloPuente: true, esperaReintento: 0, espejo: { libro: {}, aplicar: async () => 0 }, leadsId: 'leads', kb: async () => '', claves: {}, wixOrigen: WIX,
    correo: async () => false, reenviar: async () => { if (++k < 2) throw new Error('una vez'); } });
  assert.strictEqual((await bot2.recibir(wa('hola'), { token: '$WEBHOOK_SECRET' })).resultado, 'reenviado', 'un fallo pasajero se recupera');
});

test('@68 en la nube: /bot/quien dice el modo (puente si el servicio es solo puente) e importar-estado-hoja nunca copia claves', async () => {
  const p = pool({ INTERRUPTOR_BOT: 'vivo' });
  const x = armar(p);
  const espejo = { libro: { EstadoBot: [['clave', 'valor', 'copiado'], ['hum_502555', '{"estado":"esperando"}', ''], ['BOTONES_MODO', 'todos', ''], ['WHATSAPP_TOKEN', 'no', ''], ['INTERRUPTOR_BOT', 'vivo', ''], ['CORREO_DESDE', '1', '']] },
    cargar: async () => {}, aplicar: async () => 0 };
  const app = crearAppBot({ servicio: {}, claveTareas: 'k', version: 't', vivo: x.bot, correo: null, pool: p, espejo, verifyToken: 'vt', webhookSecret: TOKEN });
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.deepStrictEqual(await (await fetch(base + '/bot/quien')).json(), { modo: 'puente' }, 'solo puente: aunque la tabla diga vivo');
    const r = await (await fetch(base + '/tareas/importar-estado-hoja', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } })).json();
    assert.deepStrictEqual(r, { ok: true, guardadas: 3, clavesOmitidas: 2 });
    assert.strictEqual(p.estado.get('hum_502555').valor, '{"estado":"esperando"}');
    assert.strictEqual(p.estado.get('WHATSAPP_TOKEN'), undefined);
    assert.strictEqual(p.estado.get('INTERRUPTOR_BOT').valor, 'vivo', 'el interruptor no lo pisa la importación');
    assert.strictEqual((await fetch(base + '/tareas/importar-estado-hoja', { method: 'POST' })).status, 403);
  } finally { srv.close(); }
  const bot2 = crearBotVivo({ pool: p, espejo, leadsId: 'leads', kb: async () => '', claves: {}, wixOrigen: WIX, correo: async () => {}, reenviar: async () => {} });
  assert.strictEqual(await bot2.interruptor(), 'vivo', 'en vivo dice lo que dice la tabla');
});
