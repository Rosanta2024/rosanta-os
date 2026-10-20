// Receptores de Wix en rosanta-nube (20-oct-2026): carritos y reservas, con modo puente al /exec viejo.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const H = require('../src/hooks-wix');

const LLAVE_C = 'llave-carrito-de-prueba', LLAVE_R = 'llave-reserva-de-prueba';
const CARRITO = { nombre: 'Ana López', email: 'ana@ejemplo.com', telefono: '+502 5555 1234', valor: 518, consentimiento: 'SI', fecha: '2026-10-20' };
const RESERVA = { id: 'abc-123', fecha: '2026-10-21', nombre: 'Ana López', email: 'ana@ejemplo.com', telefono: '50255551234', personas: 2, gasto: 0, estado: 'CONFIRMED', optin: 'SI' };

/** modos = null: la migracion 013 todavia no esta aplicada (no existen las tablas). */
function baseFalsa(modos) {
  const recibidos = [];
  return {
    recibidos,
    consultas: 0,
    async query(sql, p) {
      this.consultas += 1;
      if (/FROM interruptores/.test(sql)) { if (modos === null) throw new Error('no existe la tabla'); return { rows: modos[p[0]] ? [{ modo: modos[p[0]] }] : [] }; }
      if (/INSERT INTO hooks_wix_recibidos/.test(sql)) { if (modos === null) throw new Error('no existe la tabla'); recibidos.push({ hook: p[0], cuerpo: JSON.parse(p[1]), modo: p[2], estado: p[3] }); return { rows: [] }; }
      throw new Error('consulta inesperada');
    }
  };
}

async function servir(deps, fn) {
  const app = express(); app.use(express.json({ limit: '200kb' }));
  const enviados = [];
  const fetchFalso = deps.fetch || (async (url, o) => { enviados.push({ url, cuerpo: JSON.parse(o.body) }); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, carrito: 'c1' }) }; });
  H.montarHooks(app, Object.assign({ tokens: { carrito: [LLAVE_C], reserva: [LLAVE_R] }, execUrl: 'https://exec.falso/exec' }, deps, { fetch: fetchFalso }));
  app.use((err, req, res, next) => res.status(500).json({ error: String(err.message) }));   // como el de app.js  // eslint-disable-line no-unused-vars
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port, enviados); } finally { srv.close(); }
}

test('Carrito como lo manda el formulario (sendBeacon, text/plain): puente al /exec con la misma llave y se guarda', async () => {
  const pool = baseFalsa(null);   // sin tabla de interruptores todavia: puente
  await servir({ pool }, async (b, enviados) => {
    const r = await fetch(b + '/hooks/carrito?token=' + LLAVE_C + '&hook=carrito', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(CARRITO) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true, carrito: 'c1' });
    assert.strictEqual(enviados.length, 1);
    assert.strictEqual(enviados[0].url, 'https://exec.falso/exec?token=' + LLAVE_C + '&hook=carrito');
    assert.deepStrictEqual(enviados[0].cuerpo, CARRITO);
    assert.strictEqual(pool.recibidos.length, 0, 'sin tabla no se guarda, y no frena');
  });
});

test('Reserva como la manda crmReservas.js (JSON): puente y queda guardada', async () => {
  const guardados = [];
  const p2 = { async query(sql, p) { if (/INSERT/.test(sql)) { guardados.push(p); return { rows: [] }; } return { rows: [] }; } };
  await servir({ pool: p2 }, async (b, enviados) => {
    const r = await fetch(b + '/hooks/reserva?token=' + LLAVE_R + '&hook=reserva', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(RESERVA) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(enviados[0].cuerpo, RESERVA);
    assert.match(enviados[0].url, /hook=reserva$/);
    assert.strictEqual(guardados.length, 1);
    assert.strictEqual(guardados[0][0], 'reserva'); assert.strictEqual(guardados[0][2], 'puente'); assert.strictEqual(guardados[0][3], 200);
  });
});

test('Llaves: cada receptor solo acepta la suya; sin llave cargada, 401 a todo', async () => {
  await servir({ pool: baseFalsa({}) }, async (b, enviados) => {
    const post = (ruta, tok) => fetch(b + ruta + '?token=' + tok, { method: 'POST', body: JSON.stringify(ruta.includes('carrito') ? CARRITO : RESERVA) });
    assert.strictEqual((await post('/hooks/carrito', LLAVE_R)).status, 401, 'la de reservas no abre carritos');
    assert.strictEqual((await post('/hooks/reserva', LLAVE_C)).status, 401, 'la de carritos (publica) no abre reservas');
    assert.strictEqual((await post('/hooks/carrito', 'rosanta2026xy')).status, 401, 'la vieja ya no entra');
    assert.strictEqual((await post('/hooks/carrito', '')).status, 401);
    assert.strictEqual(enviados.length, 0);
  });
  await servir({ pool: baseFalsa({}), tokens: {} }, async (b) => {
    assert.strictEqual((await fetch(b + '/hooks/carrito?token=', { method: 'POST', body: JSON.stringify(CARRITO) })).status, 401);
  });
  assert.deepStrictEqual(H.tokensDelEntorno({ HOOK_TOKENS_CARRITO: ' abcdefgh12 , corta', HOOK_TOKENS_RESERVA: '' }), { carrito: ['abcdefgh12'], reserva: [] });
});

test('El carrito solo puede crear un carrito: forma fija, tamaño maximo, nada de mas', async () => {
  const malos = [
    [], 'texto', Object.assign({}, CARRITO, { tab: 'usuarios' }), Object.assign({}, CARRITO, { nombre: '' }),
    Object.assign({}, CARRITO, { email: '', telefono: '' }), Object.assign({}, CARRITO, { email: 'no-es-correo' }),
    Object.assign({}, CARRITO, { valor: -5 }), Object.assign({}, CARRITO, { valor: 1e9 }), Object.assign({}, CARRITO, { nombre: { a: 1 } }),
    Object.assign({}, CARRITO, { nombre: 'x'.repeat(500) }), Object.assign({}, CARRITO, { telefono: '<script>' }),
    Object.assign({}, CARRITO, { consentimiento: 'QUIZAS' }), Object.assign({}, CARRITO, { fecha: '20/10/2026' })
  ];
  for (const m of malos) assert.ok(H.limpiarCarrito(m).error, JSON.stringify(m).slice(0, 60));
  assert.deepStrictEqual(H.limpiarCarrito(CARRITO).cuerpo, CARRITO);
  await servir({ pool: baseFalsa({}) }, async (b, enviados) => {
    const r = await fetch(b + '/hooks/carrito?token=' + LLAVE_C, { method: 'POST', body: '{no es json' });
    assert.strictEqual(r.status, 400);
    const grande = await fetch(b + '/hooks/carrito?token=' + LLAVE_C, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({}, CARRITO, { nombre: 'x'.repeat(20000) })) });
    assert.strictEqual(grande.status, 413);
    assert.strictEqual(enviados.length, 0);
  });
  assert.ok(H.limpiarReserva({ nombre: 'sin contacto' }).error);
  assert.ok(H.limpiarReserva(Object.assign({}, RESERVA, { action: 'delete' })).error);
  assert.deepStrictEqual(H.limpiarReserva(RESERVA).cuerpo, RESERVA);
});

test('Limite por minuto: por IP y total en carritos; se libera al minuto siguiente', async () => {
  let t = 1000000;
  await servir({ pool: baseFalsa({}), ahora: () => t, limites: { carritoIp: 3, carritoTotal: 100 } }, async (b, enviados) => {
    const post = () => fetch(b + '/hooks/carrito?token=' + LLAVE_C, { method: 'POST', body: JSON.stringify(CARRITO) });
    const estados = [];
    for (let i = 0; i < 5; i++) estados.push((await post()).status);
    assert.deepStrictEqual(estados, [200, 200, 200, 429, 429]);
    assert.strictEqual(enviados.length, 3);
    t += 61000;
    assert.strictEqual((await post()).status, 200);
  });
});

test('Interruptor en la base: puente por defecto; base sin enBase sigue en puente; base con enBase no toca el /exec; caché 30 s', async () => {
  const modos = { hooks_carrito: 'base' };
  let t = 5000000;
  const pool = baseFalsa(modos);
  await servir({ pool, ahora: () => t }, async (b, enviados) => {
    const post = () => fetch(b + '/hooks/carrito?token=' + LLAVE_C, { method: 'POST', body: JSON.stringify(CARRITO) });
    assert.strictEqual((await post()).status, 200);
    assert.strictEqual(enviados.length, 1, 'sin enBase montado, base = puente');
    assert.strictEqual(pool.recibidos[0].modo, 'puente');
  });
  const atendidos = [];
  const pool2 = baseFalsa(modos);
  await servir({ pool: pool2, ahora: () => t, enBase: async (h, c) => { atendidos.push([h, c]); return { estado: 200, json: { ok: true, en: 'base' } }; } }, async (b, enviados) => {
    const post = () => fetch(b + '/hooks/carrito?token=' + LLAVE_C, { method: 'POST', body: JSON.stringify(CARRITO) });
    assert.deepStrictEqual(await (await post()).json(), { ok: true, en: 'base' });
    assert.strictEqual(enviados.length, 0); assert.strictEqual(atendidos.length, 1);
    modos.hooks_carrito = 'puente';           // vuelta atras
    await post();
    assert.strictEqual(enviados.length, 0, 'dentro de los 30 s sigue en base (caché)');
    t += 31000;
    await post();
    assert.strictEqual(enviados.length, 1, 'pasados 30 s vuelve al puente');
    modos.hooks_carrito = 'cualquier-cosa';
    t += 31000;
    await post();
    assert.strictEqual(enviados.length, 2, 'un modo desconocido es puente');
  });
});

test('Si el /exec falla o tarda, Wix recibe 502 (crmReservas solo lo registra) y queda guardado', async () => {
  const guardados = [];
  const pool = { async query(sql, p) { if (/INSERT/.test(sql)) guardados.push(p); return { rows: [] }; } };
  await servir({ pool, fetch: async () => { throw new Error('ECONNRESET'); } }, async (b) => {
    const r = await fetch(b + '/hooks/reserva?token=' + LLAVE_R, { method: 'POST', body: JSON.stringify(RESERVA) });
    assert.strictEqual(r.status, 502);
    assert.strictEqual(guardados[0][3], 502);
  });
  await servir({ pool, fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ error: 'unauthorized' }) }) }, async (b) => {
    assert.strictEqual((await fetch(b + '/hooks/reserva?token=' + LLAVE_R, { method: 'POST', body: JSON.stringify(RESERVA) })).status, 502, 'un error del /exec no se disfraza de exito');
  });
});

test('enBaseHttp: le pasa el aviso a rosanta-clientes con la clave de tareas; si no contesta, 502', async () => {
  let visto = null;
  const f = H.enBaseHttp({ url: 'https://clientes.falso/', clave: 'clave-t', fetch: async (u, o) => { visto = { u, h: o.headers, b: JSON.parse(o.body) }; return { status: 200, text: async () => '{"ok":true,"id":"r2"}' }; } });
  const r = await f('reserva', RESERVA);
  assert.deepStrictEqual([r.estado, r.json], [200, { ok: true, id: 'r2' }]);
  assert.strictEqual(visto.u, 'https://clientes.falso/interno/aviso');
  assert.strictEqual(visto.h['x-rosanta-tarea'], 'clave-t');
  assert.deepStrictEqual(visto.b, { hook: 'reserva', cuerpo: RESERVA });
  assert.strictEqual((await H.enBaseHttp({ url: 'x', clave: 'c', fetch: async () => { throw new Error('caido'); } })('carrito', CARRITO)).estado, 502);
  assert.strictEqual((await H.enBaseHttp({ url: 'x', clave: 'c', fetch: async () => ({ status: 500, text: async () => 'boom' }) })('carrito', CARRITO)).estado, 502);
  assert.strictEqual((await H.enBaseHttp({ url: 'x', clave: 'c', fetch: async () => ({ status: 400, text: async () => '{"error":"reserva sin id ni contacto"}' }) })('reserva', RESERVA)).estado, 400);
});
