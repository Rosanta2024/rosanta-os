/**
 * Avisos de reservas · integracion con el MOTOR REAL (Ayudante 1) sobre pg-mem, con las migraciones 050, 051 y 052
 * tal cual: el gancho avisos(reserva, evento), el modo sombra, los relojes idempotentes, la reseña, el webhook de
 * Resend, "Mi reserva" y los permisos del panel (matriz real de la 020/022).
 * La red es un fetch falso: si algo intentara salir a otro lado, la prueba falla. Datos inventados.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { baseLista, sentencias } = require('./reservas-base');
const { crearRutasReservas } = require('../src/reservas/rutas');
const { verificarEnlace, firmarEnlace } = require('../src/reservas/enlaces');
const { crearAvisos } = require('../src/reservas-avisos/avisos');
const { crearRutasAvisos } = require('../src/reservas-avisos/rutas');
const { canalesDesdeEntorno } = require('../src/reservas-avisos/adaptadores');
const P = require('../src/permisos');
const C = require('../src/reservas/comun');

const MIG052 = fs.readFileSync(path.join(__dirname, '../../db/migraciones/052_reservas_avisos.sql'), 'utf8');
const SECRETO_ENLACE = 'enlace-de-prueba';
const CLAVE_TAREAS = 'clave-de-tareas-de-prueba';
const WEBHOOK = 'whsec_' + Buffer.from('webhook-de-prueba').toString('base64');
const USUARIOS = {
  'tok-dueno': { email: 'dueno@ejemplo.test', nombre: 'Dueño', rol: 'Dueño' },
  'tok-sala': { email: 'sala@ejemplo.test', nombre: 'Sala', rol: 'sala' },
  'tok-chef': { email: 'chef@ejemplo.test', nombre: 'Chef', rol: 'chef' }
};

/** La red de mentira: Resend y Meta contestan bien (o lo que diga `fallar`); cualquier otra direccion revienta. */
function red() {
  const llamadas = [];
  let n = 0;
  const fallar = {};
  const f = async (url, op) => {
    const body = JSON.parse(op.body);
    llamadas.push({ url, headers: op.headers, body });
    const ok = (status, j) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
    if (url === 'https://api.resend.com/emails') return fallar.resend ? ok(500, { message: 'caido' }) : ok(200, { id: 'em_' + (++n) });
    if (/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/.test(url)) {
      return fallar.meta ? ok(400, { error: { message: 'Template not approved' } }) : ok(200, { messages: [{ id: 'wamid.' + (++n) }] });
    }
    throw new Error('Salida a la red no permitida: ' + url);
  };
  return { f, llamadas, fallar, correos: () => llamadas.filter((x) => /resend/.test(x.url)), metas: () => llamadas.filter((x) => /facebook/.test(x.url)) };
}

async function montar(o) {
  o = o || {};
  const reloj = { t: o.ahora || C.instante('2026-11-02', '10:00').getTime() };   // lunes 2 de noviembre, 10:00
  const b = await baseLista({ ahora: reloj.t, modo: o.modo || 'base' });
  for (const s of sentencias(MIG052)) b.uno(s);
  for (const a of o.ajustes || []) await b.pool.query('UPDATE avisos_ajustes SET valor = $2 WHERE clave = $1', [a.clave, JSON.stringify(a.valor)]);
  const net = red();
  const env = Object.assign({ AVISOS_MODO: o.avisos || 'sombra', RESEND_API_KEY: 're_prueba' }, o.env || {});
  const log = [];
  const avisos = crearAvisos({ pool: b.pool, canales: canalesDesdeEntorno(env, net.f), secretoEnlace: o.sinSecreto ? undefined : SECRETO_ENLACE,
    basePanel: 'https://nube.ejemplo.test/reservas/panel', reloj: () => reloj.t, registrar: (m) => log.push(m) });
  const M = P.cargarDeMigracion();
  const comun = { quien: async (req) => USUARIOS[req.get('x-rosanta-u') || req.query.u] || null,
    permisos: async (u, parte, accion, reg) => P.puede(M, u, parte, accion, reg) };
  const rutas = crearRutasReservas(Object.assign({ pool: b.pool, reloj: () => reloj.t, secretos: { bot: 'secreto-bot', enlace: SECRETO_ENLACE },
    avisos: avisos.gancho, registrar: (m) => log.push(m) }, comun));
  const app = express();
  app.use('/api/reservas', rutas);
  app.use(crearRutasAvisos(Object.assign({ pool: b.pool, avisos, motor: rutas.motor, claveTareas: CLAVE_TAREAS, resendWebhookSecreto: WEBHOOK,
    reloj: () => reloj.t, registrar: (m) => log.push(m) }, comun)));
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const pedir = async (ruta, op) => {
    const r = await fetch(base + ruta, op || {});
    const texto = await r.text();
    let body = texto; try { body = JSON.parse(texto); } catch (e) { /* html */ }
    await rutas.motor.esperarGanchos();
    return { status: r.status, headers: r.headers, body };
  };
  const json = (metodo, cab) => (ruta, cuerpo) => pedir(ruta, { method: metodo, headers: Object.assign({ 'Content-Type': 'application/json' }, cab || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const como = (tok) => ({ get: (ruta) => pedir(ruta, { headers: { 'x-rosanta-u': tok } }), post: json('POST', { 'x-rosanta-u': tok }) });
  const tarea = (nombre, clave) => pedir('/tareas/avisos/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': clave === undefined ? CLAVE_TAREAS : clave } });
  const envios = async () => (await b.pool.query('SELECT * FROM envios ORDER BY id')).rows;
  return { b, reloj, net, avisos, motor: rutas.motor, pedir, post: json('POST'), como, tarea, envios, log, cerrar: () => srv.close() };
}

const FORM = { firstName: 'Mara', lastName: 'Inventada', phone: '+502 5555 4001', email: 'Mara@Ejemplo.test', partySize: 2,
  startDate: C.instante('2026-11-05', '19:00').toISOString(), alergias: 'Maní', sentarse: 'Pergola', conocio: 'Instagram', optin: 'SI' };
const reservarWeb = (s, extra, idioma) => s.pedir('/api/reservas/reservar', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'Accept-Language': idioma || 'en-US' },
  body: JSON.stringify(Object.assign({}, FORM, extra || {})) });

// ---------------------------------------------------------------- el gancho y la sombra

test('reserva por la web → confirmacion (con .ics y "Mi reserva") y aviso al equipo; en sombra TODO va a restaurante@', async () => {
  const s = await montar();
  try {
    const r = await reservarWeb(s);
    assert.strictEqual(r.body.status, 'RESERVED');
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => [x.plantilla, x.canal, x.estado, x.modo, x.idioma]),
      [['confirmacion', 'correo', 'enviado', 'sombra', 'en'], ['equipo_nueva', 'correo', 'enviado', 'sombra', 'es']]);
    assert.deepStrictEqual([e[0].destinatario, e[0].reserva_id], ['ma***@ejemplo.test', r.body.id]);
    assert.ok(!JSON.stringify(e).includes('mara@ejemplo.test'), 'la tabla no guarda el correo');
    const [cli, eq] = s.net.correos();
    assert.deepStrictEqual([cli.body.to, eq.body.to], [['restaurante@rosanta.rest'], ['restaurante@rosanta.rest']]);
    assert.match(cli.body.subject, /^\[SOMBRA → m\*\*\*@ejemplo\.test\] Your table is confirmed · Nov 5$/);
    assert.match(cli.body.text, /^Hi Mara,\n[\s\S]*Date: Thursday, November 5\nTime: 7:00 pm\nTable for: 2 guests/);
    assert.strictEqual(cli.headers['Idempotency-Key'], 'sombra-' + e[0].clave);
    // el enlace "Mi reserva" es el firmado del motor
    const cod = cli.body.text.match(/https:\/\/www\.rosanta\.rest\/r\/(\S+)/)[1];
    assert.strictEqual(verificarEnlace(SECRETO_ENLACE, cod), r.body.id);
    const ics = Buffer.from(cli.body.attachments[0].content, 'base64').toString();
    assert.match(ics, /DTSTART:20261106T010000Z/);
    assert.match(eq.body.subject, /^\[SOMBRA → r\*\*\*@rosanta\.rest\] Reserva nueva · Mara Inventada · 05\/11 19:00 · 2 personas$/);
    assert.match(eq.body.text, /Reserva nueva por la web\. Estado: confirmada\.[\s\S]*Mesa: \S+[\s\S]*ALERGIAS: Maní[\s\S]*Abrir el panel de reservas: https:\/\/nube\.ejemplo\.test\/reservas\/panel\?fecha=2026-11-05/);
    assert.ok(!/\$\{|\{[a-z_]+\}/.test(cli.body.text + eq.body.text));
    // el mismo evento otra vez (reintento del motor, doble clic): no sale nada nuevo
    await s.avisos.gancho(require('../src/reservas/ganchos').vista(await s.motor.porId(r.body.id)), 'creada');
    assert.strictEqual(s.net.correos().length, 2);
    assert.strictEqual((await s.envios()).length, 2);
  } finally { s.cerrar(); }
});

test('modo vivo: la confirmacion va al cliente, en español si reservo en español; apagado: no se anota nada', async () => {
  const s = await montar({ avisos: 'vivo' });
  try {
    const r = await reservarWeb(s, {}, 'es-GT');
    assert.strictEqual(r.body.status, 'RESERVED');
    const [cli, eq] = s.net.correos();
    assert.deepStrictEqual([cli.body.to, cli.body.from, cli.body.subject], [['mara@ejemplo.test'], 'Rosanta <reservas@rosanta.rest>', 'Tu mesa queda confirmada · 05/11']);
    assert.deepStrictEqual([eq.body.to, eq.body.subject.slice(0, 13)], [['restaurante@rosanta.rest'], 'Reserva nueva']);
  } finally { s.cerrar(); }
  const a = await montar({ avisos: 'apagado' });
  try {
    assert.strictEqual((await reservarWeb(a)).body.status, 'RESERVED');
    assert.deepStrictEqual([a.net.llamadas.length, (await a.envios()).length], [0, 0]);
    assert.deepStrictEqual((await a.tarea('recordatorios')).body, { ok: true, omitido: 'apagado' });
  } finally { a.cerrar(); }
});

test('mientras Wix mande (motor_reservas = wix) no sale ningun aviso propio, ni por el gancho ni por los relojes', async () => {
  const s = await montar({ modo: 'wix' });
  try {
    // una reserva que vino de Wix y esta en la base (carga desde wix_*)
    await s.b.pool.query(`INSERT INTO reservas (id, origen, id_externo, inicio, duracion_min, fin, personas, estado, nombre, email, telefono, creada)
      VALUES ('wix-1', 'wix', 'wix-1', $1, 120, $2, 2, 'confirmada', 'Lia', 'lia@ejemplo.test', '+50255550000', $3)`,
    [C.instante('2026-11-03', '19:00').toISOString(), C.instante('2026-11-03', '21:00').toISOString(), C.instante('2026-10-20', '10:00').toISOString()]);
    s.reloj.t = C.instante('2026-11-02', '20:30').getTime();
    assert.deepStrictEqual((await s.tarea('recordatorios')).body, { ok: true, omitido: 'wix_manda' });
    assert.deepStrictEqual(await s.avisos.gancho({ id: 'wix-1', origen: 'wix', estado: 'confirmada', inicio: C.instante('2026-11-03', '19:00').toISOString() }, 'creada'),
      [{ evento: 'creada', omitido: 'wix_manda' }]);
    assert.deepStrictEqual([s.net.llamadas.length, (await s.envios()).length], [0, 0]);
  } finally { s.cerrar(); }
});

test('si falta un dato el aviso no sale: sin RESERVAS_ENLACE_SECRETO la confirmacion queda "omitido" (el equipo si recibe el suyo)', async () => {
  const s = await montar({ sinSecreto: true });
  try {
    await reservarWeb(s);
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => [x.plantilla, x.estado]), [['confirmacion', 'omitido'], ['equipo_nueva', 'enviado']]);
    assert.strictEqual(e[0].error, 'Faltan datos: enlace');
    assert.strictEqual(s.net.correos().length, 1);
    // y una reserva sin correo (por telefono) no genera aviso al cliente
    const t = await s.como('tok-sala').post('/api/reservas/equipo/reservas', { fecha: '2026-11-04', hora: '13:00', personas: 2, nombre: 'Tono', telefono: '55559999' });
    assert.strictEqual(t.status, 200);
    assert.deepStrictEqual((await s.envios()).filter((x) => x.reserva_id === t.body.reserva.id).map((x) => x.plantilla), ['equipo_nueva']);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- pendiente, aprobar, rechazar, cambiar y cancelar

test('grupo con aprobacion: "solicitud recibida", el dueño aprueba → "confirmada" con .ics; otro rechazado → rechazo con el motivo', async () => {
  const s = await montar();
  try {
    const r = await reservarWeb(s, { partySize: 8, phone: '55554002', email: 'grupo@ejemplo.test' });
    assert.strictEqual(r.body.status, 'REQUESTED');
    const ap = await s.como('tok-dueno').post('/api/reservas/equipo/reservas/' + r.body.id + '/estado', { estado: 'confirmada' });
    assert.strictEqual(ap.status, 200);
    const otra = await reservarWeb(s, { partySize: 9, phone: '55554003', email: 'otro@ejemplo.test', startDate: C.instante('2026-11-06', '19:00').toISOString() });
    await s.como('tok-dueno').post('/api/reservas/equipo/reservas/' + otra.body.id + '/estado', { estado: 'rechazada', motivo: 'Ese dia tenemos un evento privado.' });
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => x.plantilla), ['pendiente', 'equipo_nueva', 'aprobada', 'pendiente', 'equipo_nueva', 'rechazada']);
    const correos = s.net.correos();
    assert.match(correos[0].body.text, /It isn't confirmed yet/);
    assert.ok(!correos[0].body.attachments.length, 'la solicitud no lleva .ics');
    assert.match(correos[1].body.text, /Estado: PENDIENTE DE APROBAR/);
    assert.match(correos[2].body.subject, /Your table is confirmed/);
    assert.strictEqual(correos[2].body.attachments[0].filename, 'rosanta.ics');
    assert.match(correos[5].body.text, /this time we don't have a table\.\nEse dia tenemos un evento privado\./);
  } finally { s.cerrar(); }
});

test('"Mi reserva" (enlace firmado del motor): cambiar → aviso de cambio con antes y ahora; cancelar → UNA cancelacion y aviso al equipo', async () => {
  const s = await montar();
  try {
    const r = await reservarWeb(s);
    const cod = firmarEnlace(SECRETO_ENLACE, r.body.id);
    const pag = await s.pedir('/r/' + cod);
    assert.strictEqual(pag.status, 200);
    assert.match(pag.headers.get('content-type'), /html/);
    assert.match(pag.body, /var API = '\/api\/reservas';/);
    assert.strictEqual(pag.headers.get('x-robots-tag'), 'noindex, nofollow');
    const mi = await s.pedir('/api/reservas/mi/' + cod);
    assert.deepStrictEqual([mi.body.reserva.hora, mi.body.reserva.estado, mi.body.reserva.se_puede_cambiar], ['19:00', 'RESERVED', true]);
    const cam = await s.post('/api/reservas/mi/' + cod + '/cambiar', { fecha: '2026-11-05', hora: '20:00', personas: 3 });
    assert.strictEqual(cam.status, 200);
    const can = await s.post('/api/reservas/mi/' + cod + '/cancelar');
    assert.strictEqual(can.status, 200);
    await s.post('/api/reservas/mi/' + cod + '/cancelar');   // segunda vez: el motor no la vuelve a cancelar
    await s.avisos.gancho(require('../src/reservas/ganchos').vista(await s.motor.porId(r.body.id)), 'cancelada');   // ni el gancho repetido
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => x.plantilla), ['confirmacion', 'equipo_nueva', 'cambio', 'cancelacion', 'equipo_cancelada']);
    const c = s.net.correos();
    assert.match(c[2].body.text, /Was: Thursday, November 5 at 7:00 pm, 2 guests\nNow: Thursday, November 5 at 8:00 pm, 3 guests/);
    assert.match(Buffer.from(c[2].body.attachments[0].content, 'base64').toString(), /SEQUENCE:2[\s\S]*DTSTART:20261106T020000Z/);
    assert.match(c[3].body.subject, /Your booking is cancelled$/);
    assert.match(Buffer.from(c[3].body.attachments[0].content, 'base64').toString(), /METHOD:CANCEL/);
    assert.match(c[4].body.text, /Se canceló una reserva \(la canceló el cliente desde Mi reserva\)/);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- relojes

test('reloj de recordatorios: 24 h antes y el mismo dia a las 12:00, idempotente (dos corridas, o dos a la vez, mandan uno)', async () => {
  const s = await montar();
  try {
    const r = await reservarWeb(s);   // el lunes 2 a las 10:00, para el jueves 5 a las 19:00
    const antes = s.net.correos().length;
    assert.strictEqual((await s.tarea('recordatorios', 'mala')).status, 403);
    assert.strictEqual((await s.tarea('recordatorios', '')).status, 403);
    s.reloj.t = C.instante('2026-11-04', '18:00').getTime();   // faltan 25 h
    assert.strictEqual((await s.tarea('recordatorios')).body.nuevos, 0);
    s.reloj.t = C.instante('2026-11-04', '19:15').getTime();   // faltan 23:45
    const a = await s.tarea('recordatorios');
    assert.deepStrictEqual([a.status, a.body.revisadas, a.body.nuevos, a.body.enviados], [200, 1, 1, 1]);
    const [b1, b2, b3] = await Promise.all([s.tarea('recordatorios'), s.tarea('recordatorios'), s.tarea('recordatorios')]);
    assert.deepStrictEqual([b1.body.nuevos, b2.body.nuevos, b3.body.nuevos], [0, 0, 0]);
    assert.strictEqual(s.net.correos().length, antes + 1);
    assert.match(s.net.correos()[antes].body.subject, /See you tomorrow at 7:00 pm$/);
    s.reloj.t = C.instante('2026-11-05', '12:15').getTime();
    assert.strictEqual((await s.tarea('recordatorios')).body.nuevos, 1);
    assert.strictEqual((await s.tarea('recordatorios')).body.ya_estaban, 1);
    assert.match(s.net.correos()[antes + 1].body.subject, /See you today at 7:00 pm$/);
    // si la hora cambia, toca un recordatorio nuevo para la hora nueva
    await s.como('tok-dueno').post('/api/reservas/equipo/reservas/' + r.body.id + '/cambiar', { hora: '20:30' });
    assert.strictEqual((await s.tarea('recordatorios')).body.nuevos, 1);
    const e = (await s.envios()).filter((x) => /^recordatorio/.test(x.plantilla));
    assert.deepStrictEqual(e.map((x) => [x.plantilla, x.estado]), [['recordatorio_24h', 'enviado'], ['recordatorio_dia', 'enviado'], ['recordatorio_dia', 'enviado']]);
    assert.strictEqual(new Set(e.map((x) => x.clave)).size, 3);
    const corridas = (await s.b.pool.query("SELECT * FROM avisos_relojes WHERE tarea = 'recordatorios'")).rows;
    assert.ok(corridas.length >= 7);
  } finally { s.cerrar(); }
});

test('recordatorio por WhatsApp (plantilla de Meta con el boton "Mi reserva"); si Meta lo rechaza, sale por correo', async () => {
  const s = await montar({ avisos: 'vivo', env: { WHATSAPP_AVISOS: 'encendido', WHATSAPP_TOKEN: 'token-de-prueba', WHATSAPP_PHONE_ID: '123' } });
  try {
    const r = await reservarWeb(s);
    assert.strictEqual(s.net.metas().length, 0, 'la confirmacion va por correo');
    s.reloj.t = C.instante('2026-11-04', '19:15').getTime();
    await s.tarea('recordatorios');
    const [m] = s.net.metas();
    assert.deepStrictEqual([m.body.to, m.body.template.name, m.body.template.language.code], ['50255554001', 'rosanta_reserva_recordatorio', 'en']);
    assert.deepStrictEqual(m.body.template.components[0].parameters.map((x) => x.text), ['Mara', 'Thursday, November 5', '7:00 pm', '2 guests']);
    assert.strictEqual(verificarEnlace(SECRETO_ENLACE, m.body.template.components[1].parameters[0].text), r.body.id);
    s.net.fallar.meta = true;
    s.reloj.t = C.instante('2026-11-05', '12:15').getTime();
    const x = await s.tarea('recordatorios');
    assert.strictEqual(x.status, 200);
    const e = (await s.envios()).filter((y) => y.plantilla === 'recordatorio_dia');
    assert.deepStrictEqual(e.map((y) => [y.canal, y.estado]), [['whatsapp', 'anulado'], ['correo', 'enviado']]);
    assert.match(e[0].error, /^WhatsApp fallo, salio por correo: Meta respondió 400: Template not approved/);
    assert.match(s.net.correos().pop().body.subject, /See you today at 7:00 pm/);
    // aunque Meta vuelva, la cola no le manda el mismo recordatorio otra vez (ni por WhatsApp ni por correo)
    s.net.fallar.meta = false;
    const n = s.net.llamadas.length;
    await s.tarea('recordatorios');
    assert.strictEqual(s.net.llamadas.length, n);
  } finally { s.cerrar(); }
});

test('reseña: "Termino" la programa 3 h despues; el reloj la manda una vez (local → Google, turista → TripAdvisor si hay enlace)', async () => {
  const s = await montar({ ahora: C.instante('2026-11-04', '10:00').getTime(),
    ajustes: [{ clave: 'resena_enlaces', valor: { google: 'https://g.page/r/CWMvHjpESP6vEAE/review', tripadvisor: 'https://www.tripadvisor.com/UserReviewEdit-prueba' } }] });
  try {
    const local = await reservarWeb(s, { startDate: C.instante('2026-11-04', '13:00').toISOString() });
    const turista = await reservarWeb(s, { phone: '+1 555 123 4567', email: 'tom@ejemplo.test', firstName: 'Tom', startDate: C.instante('2026-11-04', '13:30').toISOString() });
    const sinOptin = await reservarWeb(s, { phone: '55551111', email: 'no@ejemplo.test', optin: 'NO', startDate: C.instante('2026-11-04', '13:00').toISOString() });
    s.reloj.t = C.instante('2026-11-04', '15:00').getTime();
    for (const x of [local, turista, sinOptin]) {
      await s.como('tok-sala').post('/api/reservas/equipo/reservas/' + x.body.id + '/estado', { estado: 'llego' });
      await s.como('tok-sala').post('/api/reservas/equipo/reservas/' + x.body.id + '/estado', { estado: 'termino' });
    }
    let e = (await s.envios()).filter((x) => x.plantilla === 'resena');
    assert.deepStrictEqual(e.map((x) => [x.estado, C.horaGt(x.programado_para)]), [['programado', '18:00'], ['programado', '18:00']]);
    const antes = s.net.correos().length;
    s.reloj.t = C.instante('2026-11-04', '17:30').getTime();
    assert.strictEqual((await s.tarea('resenas')).body.enviados, 0);
    s.reloj.t = C.instante('2026-11-04', '18:10').getTime();
    const a = await s.tarea('resenas');
    assert.deepStrictEqual([a.body.enviados, a.body.ya_estaban], [2, 2]);
    assert.strictEqual((await s.tarea('resenas')).body.enviados, 0);
    const c = s.net.correos().slice(antes);
    assert.strictEqual(c.length, 2);
    assert.match(c[0].body.text, /a review on Google helps[\s\S]*Leave a review on Google: https:\/\/g\.page\/r\/CWMvHjpESP6vEAE\/review/);
    assert.match(c[1].body.text, /^Hi Tom,[\s\S]*Leave a review on TripAdvisor: https:\/\/www\.tripadvisor\.com\/UserReviewEdit-prueba/);
    e = await s.envios();
    assert.ok(!e.some((x) => x.plantilla === 'resena' && x.reserva_id === sinOptin.body.id), 'quien dijo NO al contacto no recibe la reseña');
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- webhook y grupo grande

test('webhook de Resend: firma Svix; entregado y rebotado se anotan una vez; firma mala → 401', async () => {
  const s = await montar();
  try {
    await reservarWeb(s);
    const envio = (await s.envios())[0];
    const firmar = (id, cuerpo) => {
      const ts = String(Math.floor(s.reloj.t / 1000));
      const f = crypto.createHmac('sha256', Buffer.from('webhook-de-prueba')).update(id + '.' + ts + '.' + cuerpo).digest('base64');
      return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v1,' + f, 'Content-Type': 'application/json' };
    };
    const ev = (tipo) => JSON.stringify({ type: tipo, created_at: '2026-11-02T16:00:00Z', data: { email_id: envio.proveedor_id } });
    const ok = await s.pedir('/hooks/resend', { method: 'POST', headers: firmar('msg_1', ev('email.delivered')), body: ev('email.delivered') });
    assert.deepStrictEqual([ok.status, ok.body], [200, { ok: true, nuevo: true }]);
    const otra = await s.pedir('/hooks/resend', { method: 'POST', headers: firmar('msg_1', ev('email.delivered')), body: ev('email.delivered') });
    assert.deepStrictEqual(otra.body, { ok: true, nuevo: false });
    assert.strictEqual((await s.envios())[0].estado, 'entregado');
    await s.pedir('/hooks/resend', { method: 'POST', headers: firmar('msg_2', ev('email.bounced')), body: ev('email.bounced') });
    assert.strictEqual((await s.envios())[0].estado, 'rebotado');
    await s.pedir('/hooks/resend', { method: 'POST', headers: firmar('msg_3', ev('email.delivered')), body: ev('email.delivered') });
    assert.strictEqual((await s.envios())[0].estado, 'rebotado', 'el estado solo avanza');
    const mala = await s.pedir('/hooks/resend', { method: 'POST', headers: Object.assign(firmar('msg_4', ev('email.delivered')), { 'svix-signature': 'v1,nada' }), body: ev('email.delivered') });
    assert.strictEqual(mala.status, 401);
    assert.strictEqual((await s.b.pool.query('SELECT count(*)::int AS n FROM envios_eventos')).rows[0].n, 3);
  } finally { s.cerrar(); }
});

test('grupo grande por el bot: aviso al equipo una sola vez, con los datos que mando el bot', async () => {
  const s = await montar();
  try {
    const bot = (personas) => s.post('/api/reservas/bot/reservaBot', { secreto: 'secreto-bot', nombre: 'Ana', apellido: 'Grupo', telefono: '55557777', email: 'ana@ejemplo.test',
      fecha: '2026-11-07', hora: '19:00', personas, canal: 'whatsapp' });
    const r = await bot(25);
    assert.strictEqual(r.body.motivo, 'grupo_grande');
    await new Promise((ok) => setTimeout(ok, 30));
    await bot(25);
    await new Promise((ok) => setTimeout(ok, 30));
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => [x.plantilla, x.estado]), [['equipo_grupo_grande', 'enviado']]);
    assert.match(s.net.correos()[0].body.subject, /Grupo grande por el bot · 25 personas · 07\/11 19:00$/);
    assert.match(s.net.correos()[0].body.text, /por el bot \(whatsapp\)[\s\S]*Nombre: Ana Grupo/);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- el panel y los permisos

test('panel: la pantalla, "quien soy", la semana y los avisos del dia; permisos de la matriz (sala y dueño anotan, cocina solo ve)', async () => {
  const s = await montar();
  try {
    await reservarWeb(s);
    const pag = await s.pedir('/reservas/panel?u=tok-chef');
    assert.strictEqual(pag.status, 200);
    assert.match(pag.body, /var API = '\/api\/reservas\/equipo'/);
    assert.ok(!/enlace-de-prueba|re_prueba|clave-de-tareas/.test(pag.body), 'la pantalla no lleva secretos');
    assert.strictEqual((await s.pedir('/reservas/panel/api/yo')).status, 401);
    const yo = {};
    for (const t of ['tok-dueno', 'tok-sala', 'tok-chef']) yo[t] = (await s.como(t).get('/reservas/panel/api/yo')).body.puede;
    assert.deepStrictEqual(yo, { 'tok-dueno': { ver: true, ingresar: true, corregir: true }, 'tok-sala': { ver: true, ingresar: true, corregir: false },
      'tok-chef': { ver: true, ingresar: false, corregir: false } });
    // cocina ve el dia, la semana y los avisos, pero no anota nada
    const chef = s.como('tok-chef');
    const dia = await chef.get('/api/reservas/equipo/dia?fecha=2026-11-05');
    assert.deepStrictEqual([dia.status, dia.body.reservas.length], [200, 1]);
    assert.ok(dia.body.mesas.some((m) => m.nombre === 'Pergola3'), 'el plano usa los nombres de Wix');
    const sem = await chef.get('/reservas/panel/api/semana?desde=2026-11-02');
    assert.deepStrictEqual(sem.body.dias.map((d) => d.reservas), [0, 0, 0, 1, 0, 0, 0]);
    assert.strictEqual(sem.body.dias[3].alergias, 1);
    const av = await chef.get('/reservas/panel/api/avisos?fecha=2026-11-05');
    assert.deepStrictEqual(av.body.avisos.map((x) => [x.plantilla, x.estado, x.destinatario]),
      [['confirmacion', 'enviado', 'ma***@ejemplo.test'], ['equipo_nueva', 'enviado', 're***@rosanta.rest']]);
    const id = dia.body.reservas[0].id;
    assert.strictEqual((await chef.post('/api/reservas/equipo/reservas', { fecha: '2026-11-05', hora: '13:00', personas: 2, nombre: 'X', telefono: '55550001' })).status, 403);
    assert.strictEqual((await chef.post('/api/reservas/equipo/reservas/' + id + '/estado', { estado: 'llego' })).status, 403);
    assert.strictEqual((await chef.post('/api/reservas/equipo/cierres', { fecha: '2026-11-20', motivo: 'x' })).status, 403);
    // sala: walk-in, Llegó y consumo; lo de otros (cancelar una reserva web) solo el dueño
    const sala = s.como('tok-sala');
    s.reloj.t = C.instante('2026-11-05', '19:05').getTime();
    const walk = await sala.post('/api/reservas/equipo/reservas', { walk_in: true, personas: 2 });
    assert.deepStrictEqual([walk.status, walk.body.reserva.estado, walk.body.reserva.origen], [200, 'llego', 'sala']);
    assert.strictEqual((await sala.post('/api/reservas/equipo/reservas/' + id + '/estado', { estado: 'llego' })).status, 200);
    assert.strictEqual((await sala.post('/api/reservas/equipo/reservas/' + id + '/consumo', { consumo_q: '450.50' })).body.reserva.consumo_q, 450.5);
    assert.strictEqual((await sala.post('/api/reservas/equipo/reservas/' + id + '/cambiar', { nota_equipo: 'x' })).status, 403);
    assert.strictEqual((await s.como('tok-dueno').post('/api/reservas/equipo/reservas/' + id + '/cambiar', { nota_equipo: 'Mesa cerca de la fuente' })).status, 200);
    // el walk-in no avisa al equipo (lo anoto la sala) ni al cliente
    assert.deepStrictEqual((await s.envios()).filter((x) => x.reserva_id === walk.body.reserva.id), []);
  } finally { s.cerrar(); }
});
