/**
 * Batería del bot en sombra (19-oct-2026). Solo chats inventados: ningún dato real de clientes en git.
 * node --test test/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { crearMotor, ARCHIVOS, DIR } = require('../src/motor-bot');
const { armarChats, crearAnonimizador, categoria } = require('../src/conversaciones');
const { reproducirChat, resumir, compararTurno } = require('../src/reproductor');
const { crearServicioBot, versionBot, medianocheGt } = require('../src/servicio-bot');
const { crearAppBot } = require('../src/app-bot');

// ---------- Datos inventados con la forma de Rosanta Leads ----------
const H_CONV = ['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto'];
const H_LEADS = ['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo', 'Urgencia', 'Resumen', 'Acción', '¿Humano?', 'Mensaje original', 'ID destino (no tocar)', 'Respuesta', 'Enviado', 'Email', 'Respuesta_Bot'];
const d = (s) => ({ $d: s });   // como guarda la copia (hora de Guatemala)
function conv(t, canal, id, nombre, dir, autor, texto) { return [d(t), canal, id, nombre, dir, autor, texto]; }
function lead(t, canal, id, accion, humano, original, respuesta, resumen, email) {
  return [d(t), canal, 'es', '', '', 'consulta', 'tibio', resumen || 'x', accion, humano ? 'Sí' : 'No', original, id, '', '', email || '', respuesta];
}
const TEL = '50241234567';
function datosReserva() {
  const C = [H_CONV,
    conv('2026-10-18T19:00:00', 'whatsapp', TEL, 'Rocío Pérez', 'in', 'cliente', 'Hola, quiero reservar'),
    conv('2026-10-18T19:00:05', 'whatsapp', TEL, 'Rocío Pérez', 'out', 'bot', '¿Pongo la reserva a nombre de Rocío?'),
    conv('2026-10-18T19:01:00', 'whatsapp', TEL, 'Rocío Pérez', 'in', 'cliente', 'Sí, mañana 25 de octubre a las 8pm, 2 personas, rocio.perez@correo.com'),
    conv('2026-10-18T19:01:06', 'whatsapp', TEL, 'Rocío Pérez', 'out', 'bot', 'Listo, Rocío 🌿 reserva confirmada')];
  const L = [H_LEADS,
    lead('2026-10-18T19:00:05', 'whatsapp', TEL, 'responder_info', false, 'Hola, quiero reservar', '¿Pongo la reserva a nombre de Rocío?'),
    lead('2026-10-18T19:01:06', 'whatsapp', TEL, 'crear_reserva', false, 'Sí, mañana 25 de octubre a las 8pm, 2 personas, rocio.perez@correo.com',
      'Listo, Rocío 🌿 reserva confirmada', 'Reserva creada en Wix: 2026-10-25 20:00, 2 personas', 'rocio.perez@correo.com')];
  return { C, L };
}
function datosEscala() {
  const id = '50249998877';
  const C = [H_CONV,
    conv('2026-10-18T12:00:00', 'whatsapp', id, 'Marco', 'in', 'cliente', 'Me cobraron doble, quiero hablar con alguien'),
    conv('2026-10-18T12:00:06', 'whatsapp', id, 'Marco', 'out', 'bot', 'Lo reviso con Juanma. Te escribe Juanma en menos de una hora.'),
    conv('2026-10-18T12:05:00', 'whatsapp', id, 'Marco', 'in', 'cliente', 'ok, quedo atento')];   // el bot real se calló
  const L = [H_LEADS, lead('2026-10-18T12:00:06', 'whatsapp', id, 'escalar_humano', true, 'Me cobraron doble, quiero hablar con alguien',
    'Lo reviso con Juanma. Te escribe Juanma en menos de una hora.', 'Queja de cobro doble')];
  return { C, L, id };
}
const DESDE = '2026-10-18T00:00:00-06:00';

// ---------- Pruebas ----------
test('Las copias del bot son exactas a apps-script/bot-rosanta (la versión publicada)', () => {
  const origen = path.join(__dirname, '..', '..', '..', 'apps-script', 'bot-rosanta');
  if (!fs.existsSync(origen)) return;   // en Cloud Run no esta el repo
  const archivos = fs.readdirSync(origen).filter((f) => f.endsWith('.js'));
  assert.ok(archivos.length >= 10);
  archivos.forEach((f) => assert.strictEqual(fs.readFileSync(path.join(DIR, f), 'utf8'), fs.readFileSync(path.join(origen, f), 'utf8'), f + ' se separó: correr herramientas/traer-bot.sh después de publicar el bot'));
  ARCHIVOS.forEach((f) => assert.ok(archivos.includes(f), f));
});

test('La versión copiada está anotada y es la @58 o posterior', () => {
  const v = versionBot();
  assert.ok(v.numero >= 58, v.texto);
  assert.ok(v.desde > Date.parse('2026-10-17T00:00:00-06:00'));
  assert.ok(!/\n/.test(v.texto), 'solo la primera linea');
});

test('El motor carga el código real del bot sin tocar nada de afuera', () => {
  const m = crearMotor({});
  ['doPost', 'btAtender_', 'askClaude', 'rvCerrar', 'humEscalar_', 'notificarHumano', 'enviarRespuestasPendientes'].forEach((f) => assert.strictEqual(typeof m.ctx[f], 'function', f));
  assert.strictEqual(m.CONFIG.CLAUDE_MODEL, 'claude-sonnet-5-5');
  assert.strictEqual(m.ctx.Utilities.formatDate(new Date(Date.UTC(2026, 9, 19, 15, 5)), 'America/Guatemala', 'u d M H m HH:mm yyyy-MM-dd'), '1 19 10 9 5 09:05 2026-10-19');
  const r = m.ctx.UrlFetchApp.fetch('https://example.com/x', {});
  assert.strictEqual(r.getResponseCode(), 404);   // lo no previsto no sale
});

test('Reserva: la sombra crea en el Wix de mentira la misma reserva que creó el bot real', () => {
  const { C, L } = datosReserva();
  const chats = armarChats(C, L, { desde: DESDE });
  assert.strictEqual(chats.length, 1);
  const r = reproducirChat(chats[0], { modo: 'grabado' });
  assert.deepStrictEqual(r.errores, []);
  assert.strictEqual(r.turnos.length, 2);
  const t = r.turnos[1];
  assert.strictEqual(t.real.categoria, 'reserva_creada');
  assert.strictEqual(t.sombra.categoria, 'reserva_creada');
  assert.deepStrictEqual(t.sombra.wix, ['reservarBot']);
  assert.deepStrictEqual(compararTurno(t), []);
  assert.match(t.sombra.respuesta, /25 de octubre|20:00/);   // el texto de confirmación lo arma el bot, no el grabado
});

test('Pasar a Juanma: la sombra avisa por correo y se calla en el mensaje siguiente, igual que el real', () => {
  const { C, L } = datosEscala();
  const r = reproducirChat(armarChats(C, L, { desde: DESDE })[0], { modo: 'grabado' });
  assert.deepStrictEqual(r.errores, []);
  assert.strictEqual(r.turnos[0].sombra.avisoJuanma, true);
  assert.strictEqual(r.turnos[0].sombra.humano, true);
  assert.strictEqual(r.turnos[1].real.contesto, false);
  assert.strictEqual(r.turnos[1].sombra.contesto, false);
  assert.strictEqual(resumir([r]).iguales, 2);
});

test('Control negativo: si el bot dejara de callarse, la comparación lo detecta', () => {
  const { C, L } = datosEscala();
  const chat = armarChats(C, L, { desde: DESDE })[0];
  const original = vm.Script.prototype.runInContext;
  // Se rompe humCallado_ en una copia del motor: el bot ya no se calla al pasar a Juanma.
  const m = require('../src/motor-bot');
  const crear = m.crearMotor;
  m.crearMotor = (op) => { const x = crear(op); x.ctx.humCallado_ = () => false; return x; };
  try {
    delete require.cache[require.resolve('../src/reproductor')];
    const rep = require('../src/reproductor');
    const r = rep.reproducirChat(chat, { modo: 'grabado' });
    assert.ok(rep.resumir([r]).diferencias.length >= 1, 'tenía que aparecer la diferencia');
  } finally {
    m.crearMotor = crear;
    delete require.cache[require.resolve('../src/reproductor')];
    vm.Script.prototype.runInContext = original;
  }
});

test('Dos mensajes seguidos del cliente se atienden como en paralelo (el segundo no queda callado por el primero)', () => {
  const id = '50240001111';
  const C = [H_CONV,
    conv('2026-10-18T20:00:00', 'whatsapp', id, 'Inés', 'in', 'cliente', 'Hola, tengo una queja'),
    conv('2026-10-18T20:00:04', 'whatsapp', id, 'Inés', 'in', 'cliente', '¿Tienen mesa para hoy?'),
    conv('2026-10-18T20:00:08', 'whatsapp', id, 'Inés', 'out', 'bot', 'Lo veo con Juanma.'),
    conv('2026-10-18T20:00:09', 'whatsapp', id, 'Inés', 'out', 'bot', 'Para hoy hay lugar desde las 19:00.')];
  const L = [H_LEADS,
    lead('2026-10-18T20:00:08', 'whatsapp', id, 'escalar_humano', true, 'Hola, tengo una queja', 'Lo veo con Juanma.'),
    lead('2026-10-18T20:00:09', 'whatsapp', id, 'responder_info', false, '¿Tienen mesa para hoy?', 'Para hoy hay lugar desde las 19:00.')];
  const r = reproducirChat(armarChats(C, L, { desde: DESDE })[0], { modo: 'grabado' });
  assert.strictEqual(r.turnos[1].real.contesto, true);
  assert.strictEqual(r.turnos[1].sombra.contesto, true);
  assert.strictEqual(resumir([r]).diferencias.length, 0);
});

test('Anonimizado: ningún teléfono, correo ni nombre real queda en lo que se guarda', () => {
  const { C, L } = datosReserva();
  const chats = armarChats(C, L, { desde: DESDE });
  const r = reproducirChat(chats[0], { modo: 'grabado' });
  const todo = JSON.stringify({ chats, r });
  ['41234567', 'rocio.perez', 'Rocío', 'Pérez'].forEach((x) => assert.ok(!todo.includes(x), 'quedó: ' + x));
  const an = crearAnonimizador();
  assert.strictEqual(an.texto('llamame al +502 4123-4567 o a ana@x.com', ''), an.texto('llamame al +502 4123-4567 o a ana@x.com', ''));
});

test('Modo modelo: solo los mensajes del rango van al modelo; el contexto anterior va con el grabado', () => {
  const { C, L } = datosReserva();
  const chat = armarChats(C, L, { desde: '2026-10-18T19:00:30-06:00' })[0];
  const pedidos = [];
  const claudeModelo = (cuerpo) => {
    pedidos.push(cuerpo);
    assert.match(cuerpo.system, /BASE DE CONOCIMIENTO:\nKB de prueba/);
    const resp = { respuesta: 'Perfecto, la confirmo', lead: { idioma: 'es', nombre: 'Ana', email: 'cliente1@ejemplo.test', fecha: '2026-10-25', hora: '20:00', personas: '2',
      telefono: '', tipo: 'reserva', urgencia: 'caliente', resumen: 'reserva', accion: 'crear_reserva', requiere_humano: false, opciones: [], mostrar_menu: false } };
    return { code: 200, body: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify(resp) }] } };
  };
  const r = reproducirChat(chat, { modo: 'modelo', kb: 'KB de prueba', claudeModelo });
  assert.strictEqual(pedidos.length, 1);
  assert.strictEqual(r.turnos.length, 1);
  assert.strictEqual(r.turnos[0].sombra.categoria, 'reserva_creada');
  assert.ok(pedidos[0].messages.length >= 3, 'lleva el historial real del turno anterior');
});

test('Categorías: la acción final del bot se lee igual en el real y en la sombra', () => {
  assert.strictEqual(categoria('crear_reserva', 'Reserva creada en Wix: 2026-10-25 20:00, 2 personas'), 'reserva_creada');
  assert.strictEqual(categoria('responder_info', 'Reserva CANCELADA por el bot: x'), 'reserva_cancelada');
  assert.strictEqual(categoria('responder_info', 'Consultó su reserva: x'), 'reserva_consultada');
  assert.strictEqual(categoria('escalar_humano', 'algo'), 'escalar_humano');
  assert.strictEqual(categoria('', ''), '');
});

// ---------- Servicio y rutas, con una base de mentira ----------
function poolDeMentira(C, L, leida) {
  const guardado = { corridas: [], turnos: [] };
  return {
    guardado,
    query: async (sql, p) => {
      if (/FROM hojas_copia_f2/.test(sql)) return { rows: [{ pestana: 'Conversaciones', filas: C, leida }, { pestana: 'Leads', filas: L, leida }] };
      if (/INSERT INTO bot_corridas/.test(sql)) { guardado.corridas.push(p); return { rows: [{ id: guardado.corridas.length }] }; }
      if (/INSERT INTO bot_turnos/.test(sql)) { guardado.turnos.push(p); return { rows: [] }; }
      throw new Error('consulta no prevista: ' + sql);
    }
  };
}

test('Comparación de la noche: guarda la corrida y responde ok si la sombra hizo lo mismo', async () => {
  const { C, L } = datosReserva();
  const ahora = Date.parse('2026-10-19T00:30:00-06:00');
  const pool = poolDeMentira(C, L, new Date(ahora - 600000));
  const s = crearServicioBot({ pool, kb: async () => '', claveModelo: '' });
  const r = await s.compararNoche(ahora);
  assert.deepStrictEqual(r.problemas, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.modelo, null);   // sin clave no hay modo modelo
  assert.strictEqual(pool.guardado.corridas.length, 1);
  assert.strictEqual(pool.guardado.turnos.length, 2);
  assert.ok(!JSON.stringify(pool.guardado).includes('rocio.perez'));
});

test('Comparación de la noche: copia vieja → no ok (alerta)', async () => {
  const { C, L } = datosReserva();
  const ahora = Date.parse('2026-10-19T00:30:00-06:00');
  const s = crearServicioBot({ pool: poolDeMentira(C, L, new Date(ahora - 5 * 3600000)), kb: async () => '', claveModelo: '' });
  const r = await s.compararNoche(ahora);
  assert.strictEqual(r.ok, false);
});

test('Medianoche de Guatemala', () => {
  assert.strictEqual(new Date(medianocheGt(Date.parse('2026-10-19T00:30:00-06:00'))).toISOString(), '2026-10-19T06:00:00.000Z');
  assert.strictEqual(new Date(medianocheGt(Date.parse('2026-10-18T23:59:00-06:00'))).toISOString(), '2026-10-18T06:00:00.000Z');
});

test('Las tareas piden la clave; /salud no', async () => {
  const app = crearAppBot({ servicio: { compararNoche: async () => { throw new Error('no debía llegar'); } }, claveTareas: 'k', version: 't' });
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.strictEqual((await fetch(base + '/salud')).status, 200);
    assert.strictEqual((await fetch(base + '/tareas/comparar-bot-noche', { method: 'POST' })).status, 403);
    assert.strictEqual((await fetch(base + '/tareas/comparar-bot-noche', { method: 'POST', headers: { 'x-rosanta-tarea': 'mala' } })).status, 403);
    assert.strictEqual((await fetch(base + '/webhook', { method: 'POST' })).status, 404);   // no hay webhook de Meta
  } finally { srv.close(); }
});

test('Modo modelo: si Claude no contesta (clave mala), la noche lo marca como problema y no cuenta como igual', async () => {
  const { C, L } = datosReserva();
  const ahora = Date.parse('2026-10-19T00:30:00-06:00');
  const pool = poolDeMentira(C, L, new Date(ahora - 600000));
  const { crearClaudeModelo } = require('../src/servicio-bot');
  // Claude de mentira que contesta 401, como con una clave invalida. Nada sale a internet.
  const crearClaude = (gasto) => (cuerpo, aux) => crearClaudeModelo('x', gasto)(cuerpo, Object.assign({}, aux, { fetchSincrono: () => ({ c: 401, t: '{"error":{"message":"invalid x-api-key"}}' }) }));
  const s = crearServicioBot({ pool, kb: async () => 'KB', claveModelo: 'mala', crearClaude });
  const n = await s.compararNoche(ahora);
  assert.strictEqual(n.ok, false);
  assert.ok(n.problemas.some((p) => /Claude no contesto/.test(p)), JSON.stringify(n.problemas));
  assert.ok(n.modelo.resumen.modeloFallas >= 1);
});
