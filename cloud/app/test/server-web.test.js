// rosanta-web montado de punta a punta (sin red): orden de los routers, cuerpo text/plain, CORS, cobros en pausa.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { baseLista, sentencias } = require('./reservas-base');
const { crearAppWeb, ganchoInterno, avisoJuanma } = require('../src/server-web');
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

test('los ganchos internos van a rosanta-clientes (CLIENTES_URL) con la clave de tareas; sin ella no salen', async () => {
  const pedidos = [];
  const f = async (url, o) => { pedidos.push({ url, clave: o.headers['x-rosanta-tarea'] }); return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
  assert.deepStrictEqual(await ganchoInterno({}, '/interno/web/crm-reserva', f)({ id: 1 }), { estado: 'sin_gancho' });
  assert.strictEqual(pedidos.length, 0);
  await ganchoInterno({ NUBE_URL: 'https://nube.prueba/' }, '/interno/web/crm-reserva', f)({ id: 1 });
  assert.strictEqual(pedidos.length, 0);   // rosanta-nube no conoce la web
  await ganchoInterno({ CLIENTES_URL: 'https://clientes.prueba/', CLAVE_TAREAS: 'k' }, '/interno/web/crm-reserva', f)({ id: 1 });
  assert.deepStrictEqual(pedidos, [{ url: 'https://clientes.prueba/interno/web/crm-reserva', clave: 'k' }]);
});

test('el aviso a Juanma sale por el correo de los avisos, solo a restaurante@, y no sale con los avisos apagados', async () => {
  const enviados = [];
  const correo = { enviar: async (m) => { enviados.push(m); return { id: 'r1' }; } };
  assert.deepStrictEqual(await avisoJuanma({ modo: 'apagado', correo })({ asunto: 'x', texto: 'y' }), { estado: 'apagado' });
  assert.strictEqual(enviados.length, 0);
  const r = await avisoJuanma({ modo: 'sombra', correo })({ asunto: 'Consulta de Adventures', texto: 'Acatenango <2 personas>' });
  assert.deepStrictEqual(r, { estado: 'enviado', id: 'r1' });
  assert.deepStrictEqual(enviados[0].to, ['restaurante@rosanta.rest']);
  assert.match(enviados[0].html, /&lt;2 personas&gt;/);
});

test('el aviso a Juanma arma el texto desde el lead de Adventures', async () => {
  const enviados = [];
  const correo = { enviar: async (m) => { enviados.push(m); return { id: 'r2' }; } };
  await avisoJuanma({ modo: 'vivo', correo })({ asunto: 'Adventures: consulta', lead: { titulo: 'Acatenango', operador: 'Aliado', codigo_referido: 'OP-01',
    nombre: 'Ana', email: 'a@ejemplo.test', telefono: null, idioma: 'en', fecha: '2026-12-01', personas: 2, mensaje: 'hola', cena: { fecha: '2026-12-02', hora: '19:00', personas: 2 } } });
  assert.match(enviados[0].texto, /Acatenango \(operador: Aliado, código OP-01\)/);
  assert.match(enviados[0].texto, /Cena en Rosanta: 2026-12-02 19:00 para 2/);
});

test('version de prueba (ENSAYO=si): noindex, la cotizacion no manda nada, el sitio se sirve y su origen pasa el CORS', async () => {
  const fs = require('fs'); const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitio-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Rosanta prueba</h1>'); fs.writeFileSync(path.join(dir, 'events-1.html'), '<h1>Eventos</h1>');
  const ORIGEN = 'https://rosanta-web-ensayo-512086396641.northamerica-south1.run.app';
  const s = await levantar({ ENSAYO: 'si', SITIO_DIR: dir, ORIGENES_EXTRA: ORIGEN });
  try {
    const r1 = await fetch(s.base + '/');
    assert.strictEqual(r1.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(await r1.text(), /Rosanta prueba/);
    assert.match(await (await fetch(s.base + '/events-1')).text(), /Eventos/);
    const r2 = await fetch(s.base + '/api/eventos/cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGEN },
      body: JSON.stringify({ nombre: 'Prueba', email: 'p@ejemplo.test', idioma: 'es' }) });
    assert.deepStrictEqual(await r2.json(), { ok: true, prueba: true });
    const r3 = await fetch(s.base + '/api/reservas/slots?date=2030-01-10&partySize=2', { headers: { Origin: ORIGEN } });
    assert.strictEqual(r3.status, 200);
  } finally { await s.cerrar(); }
  assert.deepStrictEqual(s.red, []);
});
