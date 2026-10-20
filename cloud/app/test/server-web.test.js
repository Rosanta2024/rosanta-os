// rosanta-web montado de punta a punta (sin red): orden de los routers, cuerpo text/plain, CORS, cobros en pausa.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { baseLista, sentencias } = require('./reservas-base');
const { crearAppWeb, ganchoInterno } = require('../src/server-web');
const { crearAlmacenMemoria } = require('../src/almacen-web');
const P = require('../src/permisos');

const MIG052 = fs.readFileSync(path.join(__dirname, '../../db/migraciones/052_reservas_avisos.sql'), 'utf8');

async function levantar(env) {
  const b = await baseLista();
  for (const s of sentencias(MIG052)) b.uno(s);
  const red = [];
  const fetchFalso = async (url) => { red.push(url); return { ok: true, status: 200, json: async () => ({}) }; };
  const matriz = P.cargarDeMigracion();
  const { app, pasarela } = crearAppWeb({ pool: b.pool, matriz: () => matriz, almacenWeb: crearAlmacenMemoria(), fetch: fetchFalso,
    canales: { modo: 'apagado' }, env: Object.assign({ CLAVE_TAREAS: 'tarea-prueba', BOT_RESERVAS_SECRETO: 'bot-prueba', RESERVAS_ENLACE_SECRETO: 'enlace-prueba' }, env || {}) });
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, ok));
  const base = 'http://127.0.0.1:' + srv.address().port;
  return { base, cerrar: () => new Promise((ok) => srv.close(ok)), red, pasarela };
}

test('rosanta-web: salud, reservas con text/plain y CORS, cobros en pausa, 404 propio', async () => {
  const s = await levantar();
  try {
    assert.deepStrictEqual(await (await fetch(s.base + '/salud')).json(), { ok: true, servicio: 'rosanta-web' });

    // El formulario manda text/plain: con el router ANTES del json global, un cuerpo vacio da 400 "Missing required fields"
    const r1 = await fetch(s.base + '/api/reservas/reservar', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://www.rosanta.rest' }, body: '{}' });
    assert.strictEqual(r1.status, 400);
    assert.match(await r1.text(), /Missing required fields/);
    assert.strictEqual(r1.headers.get('access-control-allow-origin'), 'https://www.rosanta.rest');

    // Origen ajeno: negado
    const r2 = await fetch(s.base + '/api/reservas/slots?date=2030-01-10&partySize=2', { headers: { Origin: 'https://otro.example' } });
    assert.strictEqual(r2.status, 403);

    // Bot: el secreto equivocado da SECRETO_INVALIDO (mismo contrato que Wix)
    const r3 = await fetch(s.base + '/api/reservas/bot/reservaBot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secreto: 'no' }) });
    assert.strictEqual(r3.status, 400);
    assert.strictEqual((await r3.json()).motivo, 'SECRETO_INVALIDO');

    // Cobros en pausa: PASARELA=ninguna → el webhook de cualquier proveedor no existe
    assert.strictEqual(s.pasarela.encendido, false);
    const r4 = await fetch(s.base + '/api/pagos/webhook/recurrente', { method: 'POST', body: '{}' });
    assert.strictEqual(r4.status, 404);

    // Tareas sin clave: negadas
    const r5 = await fetch(s.base + '/tareas/avisos/recordatorios', { method: 'POST' });
    assert.strictEqual(r5.status, 403);

    // Lo que no existe
    assert.strictEqual((await fetch(s.base + '/no-existe')).status, 404);
  } finally { await s.cerrar(); }
  assert.deepStrictEqual(s.red, []);   // nada salio a la red
});

test('los ganchos internos sin NUBE_URL no salen a la red; con NUBE_URL llevan la clave de tareas', async () => {
  const pedidos = [];
  const f = async (url, o) => { pedidos.push({ url, clave: o.headers['x-rosanta-tarea'] }); return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
  assert.deepStrictEqual(await ganchoInterno({}, '/interno/web/crm-reserva', f)({ id: 1 }), { estado: 'sin_gancho' });
  assert.strictEqual(pedidos.length, 0);
  await ganchoInterno({ NUBE_URL: 'https://nube.prueba/', CLAVE_TAREAS: 'k' }, '/interno/web/crm-reserva', f)({ id: 1 });
  assert.deepStrictEqual(pedidos, [{ url: 'https://nube.prueba/interno/web/crm-reserva', clave: 'k' }]);
});
