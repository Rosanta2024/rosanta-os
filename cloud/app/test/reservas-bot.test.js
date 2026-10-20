/**
 * Contrato del BOT: misma entrada y misma salida que http-functions.js de Wix (reservaPing, reservaBot, cancelarPing,
 * cancelarBot, consultarBot, cambiarBot), por HTTP de verdad contra el Router, con la base de mentira (pg-mem).
 * Los cuerpos esperados se escriben completos: si cambia una llave, la prueba se cae.
 */
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { baseLista } = require('./reservas-base');
const { crearRutasReservas } = require('../src/reservas/rutas');
const C = require('../src/reservas/comun');

const AHORA = C.instante('2026-11-03', '10:00').getTime();   // martes
const SECRETO = 'secreto-de-prueba-no-real';

async function montar(o) {
  o = o || {};
  const b = await baseLista(Object.assign({ ahora: AHORA }, o));
  const avisos = [];
  const app = express();
  const rutas = crearRutasReservas(Object.assign({ pool: b.pool, reloj: () => AHORA, secretos: { bot: SECRETO, enlace: 'enlace-de-prueba' },
    avisos: async (r, ev) => { avisos.push(ev); }, registrar: () => {} }, o.deps || {}));
  app.use('/api/reservas', rutas);
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port + '/api/reservas';
  // como el bot: WIX_RESERVAS_URL apunta a reservaBot y las demas se derivan cambiando el ultimo tramo
  const URL_BOT = base + '/bot/reservaBot';
  const url = (f) => URL_BOT.replace(/\/[^\/]*$/, '/' + f);
  const post = async (f, cuerpo, crudo) => {
    const r = await fetch(url(f), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: crudo || JSON.stringify(cuerpo) });
    return { status: r.status, body: await r.json() };
  };
  const get = async (f) => { const r = await fetch(url(f)); return { status: r.status, body: await r.json() }; };
  return { b, srv, post, get, avisos, motor: rutas.motor, cerrar: () => srv.close() };
}

const pedido = (extra) => Object.assign({ secreto: SECRETO, nombre: 'Lucia', apellido: 'Inventada', email: 'lucia@ejemplo.test',
  telefono: '50255552001', fecha: '2026-11-04', hora: '19:00', personas: 2, optin: 'SI', canal: 'whatsapp' }, extra || {});

test('bot · reservaPing y cancelarPing: misma forma que Wix, sin secreto ni datos', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.get('reservaPing'), { status: 200, body: { ok: true, ubicacion: 'ok', franjas: 13, disponibles: 5 } });
    await s.post('reservaBot', pedido({ fecha: '2026-11-03', hora: '20:00' }));
    assert.deepStrictEqual(await s.get('cancelarPing'), { status: 200, body: { ok: true, dia: '2026-11-03', reservadas_hoy: 1 } });
  } finally { s.cerrar(); }
});

test('bot · reservaBot: errores de entrada con los mismos motivos y codigos', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.post('reservaBot', null, 'esto no es json'), { status: 400, body: { ok: false, motivo: 'BODY_INVALIDO' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ secreto: 'otro' })), { status: 400, body: { ok: false, motivo: 'SECRETO_INVALIDO' } });
    assert.deepStrictEqual(await s.post('reservaBot', { secreto: SECRETO }),
      { status: 400, body: { ok: false, motivo: 'FALTAN_DATOS', campos: ['nombre', 'telefono', 'email', 'fecha', 'hora'] } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ personas: 2.5 })), { status: 400, body: { ok: false, motivo: 'PERSONAS_INVALIDO' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ personas: 0 })), { status: 400, body: { ok: false, motivo: 'PERSONAS_INVALIDO' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ fecha: '4/11/2026' })), { status: 400, body: { ok: false, motivo: 'FECHA_INVALIDA' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ hora: '7pm' })), { status: 400, body: { ok: false, motivo: 'FECHA_INVALIDA' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ fecha: '2026-11-02' })), { status: 400, body: { ok: false, motivo: 'FECHA_EN_PASADO' } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ fecha: '2027-11-04' })), { status: 400, body: { ok: false, motivo: 'FECHA_MUY_LEJANA' } });
  } finally { s.cerrar(); }
});

test('bot · grupo de 11 a 15 entra (confirmada, mesas juntas); 16 o mas → grupo_grande con max 15 y aviso', async () => {
  const s = await montar();
  try {
    const r = await s.post('reservaBot', pedido({ personas: 12 }));
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(Object.keys(r.body), ['ok', 'estado', 'id', 'inicio', 'hora']);
    assert.deepStrictEqual([r.body.ok, r.body.estado, r.body.inicio, r.body.hora], [true, 'RESERVED', '2026-11-05T01:00:00.000Z', '19:00']);
    assert.strictEqual((await s.motor.porId(r.body.id)).mesa_ids.length, 2);
    assert.strictEqual((await s.motor.porId(r.body.id)).origen, 'bot_whatsapp');
    const quince = await s.post('reservaBot', pedido({ personas: 15, hora: '13:00', telefono: '50255552002', email: 'otro@ejemplo.test' }));
    assert.strictEqual(quince.body.ok, true);
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ personas: 16 })), { status: 200, body: { ok: false, motivo: 'grupo_grande', max: 15 } });
    await new Promise((ok) => setTimeout(ok, 10));
    assert.ok(s.avisos.indexOf('grupo_grande') !== -1);
  } finally { s.cerrar(); }
});

test('bot · aprobacion manual: con aprobacion_bot = true, 11+ queda REQUESTED', async () => {
  const s = await montar({ reglas: [{ clave: 'aprobacion_bot', valor: true }] });
  try {
    const r = await s.post('reservaBot', pedido({ personas: 11 }));
    assert.strictEqual(r.body.estado, 'REQUESTED');
    const chico = await s.post('reservaBot', pedido({ personas: 4, hora: '13:00' }));
    assert.strictEqual(chico.body.estado, 'RESERVED');
  } finally { s.cerrar(); }
});

test('bot · fecha cerrada (lunes y 24-dic): sin_disponibilidad sin alternativas, como Wix', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ fecha: '2026-11-09' })), { status: 200, body: { ok: false, motivo: 'sin_disponibilidad', alternativas: [] } });
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ fecha: '2026-12-24' })), { status: 200, body: { ok: false, motivo: 'sin_disponibilidad', alternativas: [] } });
  } finally { s.cerrar(); }
});

test('bot · sin lugar a esa hora: las 4 mas cercanas DESPUES de la pedida (slotsAfter 12), mismo dia', async () => {
  const s = await montar();
  try {
    for (const n of [1, 2, 3, 4]) {   // ritmo: 4 reservas que empiezan a las 20:00
      assert.strictEqual((await s.post('reservaBot', pedido({ hora: '20:00', telefono: '5025555300' + n, email: 'r' + n + '@ejemplo.test' }))).body.ok, true);
    }
    assert.deepStrictEqual(await s.post('reservaBot', pedido({ hora: '20:00' })),
      { status: 200, body: { ok: false, motivo: 'sin_disponibilidad', alternativas: ['20:15', '20:30', '20:45', '21:00'] } });
  } finally { s.cerrar(); }
});

test('bot · duplicada por telefono (cualquier formato) y por correo; el correo distingue clientes con el numero del restaurante', async () => {
  const s = await montar();
  try {
    const a = await s.post('reservaBot', pedido());
    const dup = await s.post('reservaBot', pedido({ telefono: '+502 5555-2001' }));
    assert.deepStrictEqual(dup, { status: 200, body: { ok: true, duplicada: true, estado: 'RESERVED', id: a.body.id, inicio: '2026-11-05T01:00:00.000Z', hora: '19:00' } });
    // mismo telefono, otro correo: NO es duplicada (asi lo decide Wix desde el 17-oct)
    const otra = await s.post('reservaBot', pedido({ email: 'pareja@ejemplo.test' }));
    assert.strictEqual(otra.body.duplicada, undefined);
    assert.notStrictEqual(otra.body.id, a.body.id);
    // por correo el bot manda el telefono del restaurante: dos clientes distintos, dos reservas
    const RESTO = '50278000000';
    const c1 = await s.post('reservaBot', pedido({ telefono: RESTO, email: 'uno@ejemplo.test', hora: '13:00', canal: 'correo' }));
    const c2 = await s.post('reservaBot', pedido({ telefono: RESTO, email: 'dos@ejemplo.test', hora: '13:00', canal: 'correo' }));
    assert.ok(c1.body.ok && c2.body.ok && !c1.body.duplicada && !c2.body.duplicada);
    const c1bis = await s.post('reservaBot', pedido({ telefono: RESTO, email: 'UNO@ejemplo.test ', hora: '13:00', canal: 'correo' }));
    assert.strictEqual(c1bis.body.duplicada, true);
    assert.strictEqual(c1bis.body.id, c1.body.id);
    assert.strictEqual((await s.motor.porId(c1.body.id)).origen, 'bot_correo');
  } finally { s.cerrar(); }
});

test('bot · cancelarBot por telefono o por correo, VARIAS, hora, todas, NO_ENCONTRADA y SIN_COINCIDENCIA', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO }), { status: 400, body: { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email'] } });
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, telefono: '50255552001', fecha: '2026-11-04' }), { status: 200, body: { ok: false, motivo: 'NO_ENCONTRADA' } });
    await s.post('reservaBot', pedido());
    await s.post('reservaBot', pedido({ nombre: 'Pedro', email: 'pedro@ejemplo.test', telefono: '50255552999', hora: '13:00' }));
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, telefono: '50255550000', fecha: '2026-11-04' }), { status: 200, body: { ok: false, motivo: 'SIN_COINCIDENCIA' } });
    // por telefono (otro formato)
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, telefono: '5555-2001', fecha: '2026-11-04' }),
      { status: 200, body: { ok: true, cancelada: { nombre: 'Lucia Inventada', email: 'lucia@ejemplo.test', fecha: '2026-11-04', hora: '19:00', personas: 2 } } });
    // por correo, sin fecha (de ahora a 90 dias)
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, email: 'PEDRO@ejemplo.test' }),
      { status: 200, body: { ok: true, cancelada: { nombre: 'Pedro Inventada', email: 'pedro@ejemplo.test', fecha: '2026-11-04', hora: '13:00', personas: 2 } } });
    // dos el mismo dia: VARIAS; con la hora, la que dice
    await s.post('reservaBot', pedido({ hora: '13:00' }));
    await s.post('reservaBot', pedido({ hora: '20:30' }));
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, telefono: '50255552001', fecha: '2026-11-04' }),
      { status: 200, body: { ok: false, motivo: 'VARIAS', cuantas: 2, opciones: [{ fecha: '2026-11-04', hora: '13:00', personas: 2 }, { fecha: '2026-11-04', hora: '20:30', personas: 2 }] } });
    assert.strictEqual((await s.post('cancelarBot', { secreto: SECRETO, telefono: '50255552001', fecha: '2026-11-04', hora: '20:30' })).body.cancelada.hora, '20:30');
    // todas (limpieza de pruebas del bot)
    await s.post('reservaBot', pedido({ hora: '20:45' }));
    assert.deepStrictEqual(await s.post('cancelarBot', { secreto: SECRETO, telefono: '50255552001', fecha: '2026-11-04', todas: true }),
      { status: 200, body: { ok: true, canceladas: 2, cancelada: { fecha: '2026-11-04', hora: '13:00', personas: 2, nombre: '', email: '' } } });
    const h = await s.motor.historial((await s.motor.dia('2026-11-04')).reservas[0].id);
    assert.deepStrictEqual(h.map((x) => x.evento), ['creada', 'estado']);
  } finally { s.cerrar(); }
});

test('bot · consultarBot: por telefono, correo o nombre; detalle para el restaurante', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.post('consultarBot', { secreto: SECRETO, nombre: 'Lu' }), { status: 400, body: { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email', 'nombre'] } });
    const a = await s.post('reservaBot', pedido({ hora: '20:00' }));
    await s.post('reservaBot', pedido({ fecha: '2026-11-05', hora: '13:00', personas: 4 }));
    assert.deepStrictEqual(await s.post('consultarBot', { secreto: SECRETO, telefono: '+502 5555 2001' }),
      { status: 200, body: { ok: true, nombre: 'Lucia', reservas: [{ fecha: '2026-11-04', hora: '20:00', personas: 2 }, { fecha: '2026-11-05', hora: '13:00', personas: 4 }] } });
    assert.deepStrictEqual(await s.post('consultarBot', { secreto: SECRETO, email: 'lucia@ejemplo.test', fecha: '2026-11-04' }),
      { status: 200, body: { ok: true, nombre: 'Lucia', reservas: [{ fecha: '2026-11-04', hora: '20:00', personas: 2 }] } });
    assert.deepStrictEqual(await s.post('consultarBot', { secreto: SECRETO, nombre: 'lucía inventada', fecha: '2026-11-04', detalle: true }),
      { status: 200, body: { ok: true, nombre: 'Lucia', reservas: [{ fecha: '2026-11-04', hora: '20:00', personas: 2, id: a.body.id, nombre: 'Lucia Inventada', email: 'lucia@ejemplo.test', nota: '' }] } });
    assert.deepStrictEqual(await s.post('consultarBot', { secreto: SECRETO, telefono: '50255550000', fecha: '2026-11-04' }), { status: 200, body: { ok: false, motivo: 'SIN_COINCIDENCIA' } });
  } finally { s.cerrar(); }
});

test('bot · cambiarBot: cambio de hora en la MISMA reserva, SIN_CAMBIOS, solo nota, por id, y sin lugar no toca nada', async () => {
  const s = await montar();
  try {
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO }), { status: 400, body: { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email', 'id'] } });
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, telefono: '50255552001', fecha_actual: '2026-11-04' }), { status: 200, body: { ok: false, motivo: 'NO_ENCONTRADA' } });
    const a = await s.post('reservaBot', pedido());
    const antes = { fecha: '2026-11-04', hora: '19:00', personas: 2 };
    // cambio de hora
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, telefono: '50255552001', fecha_actual: '2026-11-04', hora: '20:30', canal: 'whatsapp' }),
      { status: 200, body: { ok: true, modo: 'modificada', vieja_cancelada: true, error_cancelar: '', error_modificar: '', antes,
        ahora: { fecha: '2026-11-04', hora: '20:30', personas: 2, id: a.body.id }, nota: '', nombre: 'Lucia Inventada', email: 'lucia@ejemplo.test' } });
    const ahora = { fecha: '2026-11-04', hora: '20:30', personas: 2 };
    // lo mismo otra vez: SIN_CAMBIOS
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, email: 'lucia@ejemplo.test', hora: '20:30' }), { status: 200, body: { ok: false, motivo: 'SIN_CAMBIOS', antes: ahora } });
    // solo la nota del equipo
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, nota: 'Llega con pastel', canal: 'restaurante' }),
      { status: 200, body: { ok: true, modo: 'nota', vieja_cancelada: true, antes: ahora, ahora: Object.assign({ id: a.body.id }, ahora), nota: 'Llega con pastel',
        nombre: 'Lucia Inventada', email: 'lucia@ejemplo.test' } });
    // nota que se suma
    const otra = await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, personas: 3, nota: 'Una silla para bebe' });
    assert.strictEqual(otra.body.nota, 'Llega con pastel | Una silla para bebe');
    assert.deepStrictEqual(otra.body.ahora, { fecha: '2026-11-04', hora: '20:30', personas: 3, id: a.body.id });
    // errores con "antes"
    const ant3 = { fecha: '2026-11-04', hora: '20:30', personas: 3 };
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, personas: 16 }), { status: 200, body: { ok: false, motivo: 'grupo_grande', max: 15, antes: ant3 } });
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, fecha: '2026-11-01' }), { status: 400, body: { ok: false, motivo: 'FECHA_EN_PASADO', antes: ant3 } });
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, fecha: '2027-12-01' }), { status: 400, body: { ok: false, motivo: 'FECHA_MUY_LEJANA', antes: ant3 } });
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, hora: '8pm' }), { status: 400, body: { ok: false, motivo: 'FECHA_INVALIDA', antes: ant3 } });
    // a un dia cerrado: sin_disponibilidad_dia y la reserva sigue igual
    assert.deepStrictEqual(await s.post('cambiarBot', { secreto: SECRETO, id: a.body.id, fecha: '2026-11-09' }),
      { status: 200, body: { ok: false, motivo: 'sin_disponibilidad_dia', alternativas: [], antes: ant3 } });
    const sigue = await s.motor.porId(a.body.id);
    assert.deepStrictEqual([C.diaGt(sigue.inicio), C.horaGt(sigue.inicio), sigue.personas, sigue.estado], ['2026-11-04', '20:30', 3, 'confirmada']);
    assert.deepStrictEqual((await s.motor.historial(a.body.id)).map((h) => h.evento), ['creada', 'cambiada', 'nota', 'cambiada']);
  } finally { s.cerrar(); }
});

test('bot · si la base se cae: 500 ERROR_INTERNO con detalle (como Wix)', async () => {
  const s = await montar();
  try {
    // el interruptor se lee (base), todo lo demas falla
    const caida = { query: async (sql) => { if (/interruptores/.test(sql)) return { rows: [{ modo: 'base' }] }; throw new Error('sin conexion'); },
      connect: async () => { throw new Error('sin conexion'); } };
    const app = express();
    app.use('/r', crearRutasReservas({ pool: caida, reloj: () => AHORA, secretos: { bot: SECRETO }, registrar: () => {} }));
    const srv = app.listen(0);
    try {
      const r = await fetch('http://127.0.0.1:' + srv.address().port + '/r/bot/reservaBot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido()) });
      assert.strictEqual(r.status, 500);
      assert.deepStrictEqual(await r.json(), { ok: false, motivo: 'ERROR_INTERNO', detalle: 'sin conexion' });
    } finally { srv.close(); }
  } finally { s.cerrar(); }
});
