/**
 * Contrato del FORMULARIO WEB (slots y reservar, igual que /_functions de Wix), CORS, el interruptor motor_reservas,
 * las rutas del panel del equipo con la matriz de permisos real (020/022) y el enlace firmado "Mi reserva".
 */
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { baseLista } = require('./reservas-base');
const { crearRutasReservas, ORIGENES } = require('../src/reservas/rutas');
const { firmarEnlace, verificarEnlace } = require('../src/reservas/enlaces');
const P = require('../src/permisos');
const C = require('../src/reservas/comun');

const AHORA = C.instante('2026-11-03', '10:00').getTime();
const USUARIOS = {
  'tok-dueno': { email: 'dueno@ejemplo.test', nombre: 'Dueño', rol: 'Dueño' },
  'tok-sala': { email: 'sala@ejemplo.test', nombre: 'Sala', rol: 'sala' },
  'tok-chef': { email: 'chef@ejemplo.test', nombre: 'Chef', rol: 'chef' }
};

async function montar(o) {
  o = o || {};
  const b = await baseLista(Object.assign({ ahora: AHORA }, o));
  const M = P.cargarDeMigracion();
  const app = express();
  const rutas = crearRutasReservas(Object.assign({
    pool: b.pool, reloj: () => AHORA, secretos: { bot: 'secreto-de-prueba', enlace: 'enlace-de-prueba' }, registrar: () => {},
    quien: async (req) => USUARIOS[req.get('x-rosanta-u') || req.query.u] || null,
    permisos: async (u, parte, accion, reg) => P.puede(M, u, parte, accion, reg)
  }, o.deps || {}));
  app.use('/api/reservas', rutas);
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port + '/api/reservas';
  const pedir = async (ruta, op) => {
    const r = await fetch(base + ruta, op || {});
    const texto = await r.text();
    return { status: r.status, headers: r.headers, body: texto ? JSON.parse(texto) : null };
  };
  const como = (tok) => ({
    get: (ruta) => pedir(ruta, { headers: { 'x-rosanta-u': tok } }),
    post: (ruta, cuerpo) => pedir(ruta, { method: 'POST', headers: { 'x-rosanta-u': tok, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) })
  });
  return { b, pedir, como, motor: rutas.motor, cerrar: () => srv.close() };
}

const FORM = { firstName: 'Mara', lastName: 'Inventada', phone: '+502 5555 4001', email: 'Mara@Ejemplo.test', partySize: 2,
  startDate: '2026-11-05T01:00:00.000Z', alergias: 'Ninguna', sentarse: 'Pergola', conocio: 'Instagram', optin: 'SI' };
const enviar = (s, cuerpo, origen) => s.pedir('/reservar', { method: 'POST', headers: Object.assign({ 'Content-Type': 'text/plain' }, origen ? { Origin: origen } : {}),
  body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });

// ---------------------------------------------------------------- slots y reservar

test('web · GET slots: misma respuesta que /_functions/slots', async () => {
  const s = await montar();
  try {
    const r = await s.pedir('/slots?date=2026-11-04&partySize=2');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(Object.keys(r.body), ['slots']);
    assert.strictEqual(r.body.slots.length, 37);
    assert.deepStrictEqual(r.body.slots[0], { startDate: '2026-11-04T18:00:00.000Z', manualApproval: false });
    assert.deepStrictEqual(await s.pedir('/slots?partySize=2').then((x) => [x.status, x.body]), [400, { error: "Missing 'date' (YYYY-MM-DD)" }]);
    const mala = await s.pedir('/slots?date=2026-13-40');
    assert.strictEqual(mala.status, 500);
    assert.match(mala.body.error, /Fecha inválida/);
    assert.deepStrictEqual((await s.pedir('/slots?date=2026-11-09&partySize=4')).body, { slots: [] });   // lunes cerrado
  } finally { s.cerrar(); }
});

test('web · POST reservar (texto plano, como el formulario): ok con status RESERVED, y REQUESTED desde 8', async () => {
  const s = await montar();
  try {
    const r = await enviar(s, FORM, 'https://www.rosanta.rest');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([r.body.ok, r.body.status, r.body.modo, r.body.errorVisitante], [true, 'RESERVED', 'base', '']);
    const g = await s.motor.porId(r.body.id);
    assert.deepStrictEqual([g.origen, g.email, g.telefono, g.alergias, g.sentarse, g.conocio, g.optin, g.consumo_q],
      ['web', 'mara@ejemplo.test', '+50255554001', '', 'Pergola', 'Instagram', true, null]);   // el formulario NUNCA escribe consumo
    // doble clic: la misma reserva, no dos
    const otra = await enviar(s, FORM, 'https://www.rosanta.rest');
    assert.strictEqual(otra.body.id, r.body.id);
    const grande = await enviar(s, Object.assign({}, FORM, { partySize: 8, phone: '55554002', email: 'g@ejemplo.test' }));
    assert.strictEqual(grande.body.status, 'REQUESTED');
  } finally { s.cerrar(); }
});

test('web · POST reservar: faltan datos → 400 (lo que mira el latido), sin lugar → ok:false, JSON roto → 500', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await enviar(s, {}).then((x) => [x.status, x.body]), [400, { ok: false, error: 'Missing required fields' }]);
    const lunes = await enviar(s, Object.assign({}, FORM, { startDate: '2026-11-10T01:00:00.000Z' }));
    assert.deepStrictEqual([lunes.status, lunes.body.ok, lunes.body.error], [200, false, 'Time slot not available']);
    const once = await enviar(s, Object.assign({}, FORM, { partySize: 11 }));
    assert.deepStrictEqual([once.body.ok, once.body.motivo], [false, 'tope']);
    assert.deepStrictEqual((await enviar(s, Object.assign({}, FORM, { startDate: 'mañana' }))).body, { ok: false, error: 'startDate inválido' });
    const roto = await enviar(s, '{roto');
    assert.deepStrictEqual([roto.status, roto.body.ok], [500, false]);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- CORS

test('CORS: solo rosanta.rest, www, nuevo y el iframe de Wix; otro sitio → 403; sin Origin (servidor) pasa', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(ORIGENES, ['https://www.rosanta.rest', 'https://rosanta.rest', 'https://nuevo.rosanta.rest', 'https://www-rosanta-rest.filesusr.com']);
    for (const o of ORIGENES) {
      const r = await s.pedir('/slots?date=2026-11-04&partySize=2', { headers: { Origin: o } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers.get('access-control-allow-origin'), o);
    }
    const pre = await s.pedir('/reservar', { method: 'OPTIONS', headers: { Origin: 'https://www-rosanta-rest.filesusr.com', 'Access-Control-Request-Method': 'POST' } });
    assert.strictEqual(pre.status, 204);
    assert.strictEqual(pre.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
    assert.strictEqual(pre.headers.get('access-control-allow-headers'), 'Content-Type');
    const mala = await enviar(s, FORM, 'https://rosanta.rest.ejemplo.test');
    assert.strictEqual(mala.status, 403);
    assert.strictEqual(mala.headers.get('access-control-allow-origin'), null);
    assert.strictEqual((await s.motor.dia('2026-11-04')).reservas.length, 0);   // no se creo nada
    const sinOrigen = await s.pedir('/slots?date=2026-11-04&partySize=2');
    assert.strictEqual(sinOrigen.headers.get('access-control-allow-origin'), null);
    // el bot no lleva CORS
    const bot = await s.pedir('/bot/reservaPing', { headers: { Origin: 'https://www.rosanta.rest' } });
    assert.strictEqual(bot.headers.get('access-control-allow-origin'), null);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- interruptor

test('interruptor motor_reservas = wix: las escrituras no entran a la base (MOTOR_EN_WIX) o van por el puente', async () => {
  const s = await montar({ modo: 'wix' });
  try {
    assert.deepStrictEqual(await enviar(s, FORM).then((x) => [x.status, x.body]), [503, { ok: false, error: 'MOTOR_EN_WIX' }]);
    const bot = await s.pedir('/bot/reservaBot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secreto: 'secreto-de-prueba', nombre: 'X', telefono: '1', email: 'x@ejemplo.test', fecha: '2026-11-04', hora: '19:00', personas: 2 }) });
    assert.deepStrictEqual([bot.status, bot.body], [503, { ok: false, motivo: 'MOTOR_EN_WIX' }]);
    // el secreto se revisa antes que todo
    const mal = await s.pedir('/bot/cancelarBot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secreto: 'no' }) });
    assert.deepStrictEqual([mal.status, mal.body], [400, { ok: false, motivo: 'SECRETO_INVALIDO' }]);
    // las lecturas las calcula el motor (sirve para la sombra)
    assert.strictEqual((await s.pedir('/slots?date=2026-11-04&partySize=2')).body.slots.length, 37);
    assert.strictEqual((await s.como('tok-dueno').post('/equipo/cierres', { fecha: '2026-11-11', motivo: 'x' })).body.motivo, 'MOTOR_EN_WIX');
  } finally { s.cerrar(); }
  const llamadas = [];
  const p = await montar({ modo: 'wix', deps: { puenteWix: async (nombre, x) => { llamadas.push([nombre, x.metodo]); return { status: 200, body: { ok: true, desde: 'wix' } }; } } });
  try {
    assert.deepStrictEqual((await enviar(p, FORM)).body, { ok: true, desde: 'wix' });
    assert.deepStrictEqual((await p.pedir('/slots?date=2026-11-04')).body, { ok: true, desde: 'wix' });
    assert.deepStrictEqual(llamadas, [['reservar', 'POST'], ['slots', 'GET']]);
  } finally { p.cerrar(); }
});

// ---------------------------------------------------------------- panel del equipo

test('equipo · quien entra y que puede (matriz 020: dueño todo, sala ingresar, chef ver)', async () => {
  const s = await montar();
  try {
    assert.strictEqual((await s.pedir('/equipo/dia?fecha=2026-11-04')).status, 401);
    const chef = s.como('tok-chef'), sala = s.como('tok-sala'), dueno = s.como('tok-dueno');
    assert.strictEqual((await chef.get('/equipo/dia?fecha=2026-11-04')).status, 200);
    assert.strictEqual((await chef.post('/equipo/reservas', { fecha: '2026-11-04', hora: '19:00', personas: 2, nombre: 'X', telefono: '55550000' })).status, 403);
    // sala: alta por telefono y walk-in
    const tel = await sala.post('/equipo/reservas', { fecha: '2026-11-04', hora: '19:00', personas: 4, nombre: 'Telefono Inventado', telefono: '55554100', nota_equipo: 'Ventana' });
    assert.strictEqual(tel.status, 200);
    assert.deepStrictEqual([tel.body.reserva.origen, tel.body.reserva.estado, tel.body.reserva.nota_equipo], ['telefono', 'confirmada', 'Ventana']);
    const walk = await sala.post('/equipo/reservas', { walk_in: true, personas: 2 });
    assert.deepStrictEqual([walk.body.reserva.origen, walk.body.reserva.estado, walk.body.reserva.canal], ['sala', 'llego', 'walk-in']);
    // sala: Llego / No vino / consumo
    const web = await enviar(s, FORM);
    assert.strictEqual((await sala.post('/equipo/reservas/' + web.body.id + '/estado', { estado: 'llego' })).body.reserva.estado, 'llego');
    assert.strictEqual((await sala.post('/equipo/reservas/' + web.body.id + '/consumo', { consumo_q: '845.50' })).body.reserva.consumo_q, 845.5);
    // sala corrige lo suyo, no lo de otros
    assert.strictEqual((await sala.post('/equipo/reservas/' + tel.body.reserva.id + '/estado', { estado: 'cancelada', motivo: 'llamo' })).status, 200);
    const otra = await enviar(s, Object.assign({}, FORM, { phone: '55554999', email: 'otra@ejemplo.test', startDate: '2026-11-05T02:00:00.000Z' }));
    assert.strictEqual((await sala.post('/equipo/reservas/' + otra.body.id + '/estado', { estado: 'cancelada' })).status, 403);
    assert.strictEqual((await sala.post('/equipo/cierres', { fecha: '2026-11-11', motivo: 'x' })).status, 403);
    // dueño: cancela cualquiera y cierra fechas
    assert.strictEqual((await dueno.post('/equipo/reservas/' + otra.body.id + '/estado', { estado: 'cancelada' })).body.reserva.estado, 'cancelada');
    const cierre = await dueno.post('/equipo/cierres', { fecha: '2026-11-11', motivo: 'Evento privado (prueba)' });
    assert.strictEqual(cierre.body.ok, true);
    assert.strictEqual((await dueno.get('/equipo/cierres')).body.cierres.filter((c) => c.origen === 'equipo').length, 1);
    assert.strictEqual((await dueno.post('/equipo/cierres/' + cierre.body.id + '/reabrir')).body.ok, true);
    // el dia
    const dia = await chef.get('/equipo/dia?fecha=2026-11-04');
    assert.strictEqual(dia.body.motor_reservas, 'base');
    assert.ok(dia.body.reservas.every((r) => r.enlace && Array.isArray(r.mesas)));
    const ficha = await chef.get('/equipo/reservas/' + web.body.id);
    assert.deepStrictEqual(ficha.body.historial.map((h) => h.evento), ['creada', 'estado', 'consumo']);
    assert.strictEqual(ficha.body.historial[1].quien, 'sala@ejemplo.test');
    const fr = await chef.get('/equipo/franjas?fecha=2026-11-04&personas=2');
    assert.ok(fr.body.franjas.length > 0 && fr.body.franjas.every((f) => f.hora && f.estado));
  } finally { s.cerrar(); }
});

test('equipo · aprobar o rechazar una pendiente; transicion invalida → 409', async () => {
  const s = await montar();
  try {
    const dueno = s.como('tok-dueno');
    const g = await enviar(s, Object.assign({}, FORM, { partySize: 9 }));
    assert.strictEqual(g.body.status, 'REQUESTED');
    assert.strictEqual((await dueno.post('/equipo/reservas/' + g.body.id + '/estado', { estado: 'confirmada' })).body.reserva.estado_wix, 'RESERVED');
    const h = await enviar(s, Object.assign({}, FORM, { partySize: 9, phone: '55554888', email: 'h@ejemplo.test', startDate: '2026-11-06T01:00:00.000Z' }));
    assert.strictEqual((await dueno.post('/equipo/reservas/' + h.body.id + '/estado', { estado: 'rechazada', motivo: 'Sin lugar en jardin' })).body.reserva.motivo_rechazo, 'Sin lugar en jardin');
    const inv = await dueno.post('/equipo/reservas/' + h.body.id + '/estado', { estado: 'llego' });
    assert.deepStrictEqual([inv.status, inv.body.motivo], [409, 'TRANSICION_INVALIDA']);
    assert.strictEqual((await dueno.post('/equipo/reservas/' + h.body.id + '/estado', { estado: 'otra cosa' })).status, 400);
  } finally { s.cerrar(); }
});

// ---------------------------------------------------------------- Mi reserva

test('Mi reserva: enlace firmado (sin cuenta) para ver, cambiar y cancelar; un codigo tocado no sirve', async () => {
  assert.strictEqual(verificarEnlace('k', firmarEnlace('k', 'abc-123')), 'abc-123');
  assert.strictEqual(verificarEnlace('otra', firmarEnlace('k', 'abc-123')), null);
  const s = await montar();
  try {
    const r = await enviar(s, FORM);
    const cod = firmarEnlace('enlace-de-prueba', r.body.id);
    assert.deepStrictEqual((await s.pedir('/mi/' + cod)).body, { ok: true, reserva: { fecha: '2026-11-04', hora: '19:00', personas: 2, estado: 'RESERVED',
      nombre: 'Mara', idioma: 'en', se_puede_cambiar: true } });
    const tocado = cod.slice(0, -1) + (cod.slice(-1) === 'A' ? 'B' : 'A');
    assert.strictEqual((await s.pedir('/mi/' + tocado)).status, 404);
    const c = await s.pedir('/mi/' + cod + '/cambiar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hora: '20:15', personas: 3 }) });
    assert.deepStrictEqual([c.body.reserva.hora, c.body.reserva.personas], ['20:15', 3]);
    const x = await s.pedir('/mi/' + cod + '/cancelar', { method: 'POST' });
    assert.strictEqual(x.body.reserva.estado, 'CANCELED');
    // repetir no rompe nada (idempotente); cambiar una cancelada ya no se puede
    assert.strictEqual((await s.pedir('/mi/' + cod + '/cancelar', { method: 'POST' })).body.reserva.estado, 'CANCELED');
    assert.strictEqual((await s.pedir('/mi/' + cod + '/cambiar', { method: 'POST', body: '{"hora":"21:00"}' })).status, 409);
  } finally { s.cerrar(); }
});
