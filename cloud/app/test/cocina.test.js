// Vista de cocina: solo cantidades, por dia y turno, 7 dias; bloqueos aparte; nada de datos de clientes. Sin red.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { baseLista } = require('./reservas-base');
const { crearMotor } = require('../src/reservas/motor');
const K = require('../src/cocina');
const C = require('../src/reservas/comun');

const AHORA = C.instante('2026-11-03', '10:00').getTime();

test('resumirSemana: dia, turno (almuerzo < 16:00), total y bloqueos', () => {
  const f = (d, h, p) => ({ inicio: C.instante(d, h), personas: p });
  const r = K.resumirSemana([f('2026-11-03', '13:00', 2), f('2026-11-03', '19:00', 4), f('2026-11-05', '20:00', 6), f('2026-11-20', '19:00', 9)],
    [{ desde: C.instante('2026-11-04', '00:00'), hasta: C.instante('2026-11-05', '00:00'), motivo: 'Evento privado' },
     { desde: C.instante('2026-11-06', '18:00'), hasta: C.instante('2026-11-06', '22:00'), motivo: 'Boda' }], '2026-11-03');
  assert.strictEqual(r.dias.length, 8);
  assert.deepStrictEqual([r.dias[0].almuerzo, r.dias[0].cena, r.dias[0].personas], [{ reservas: 1, personas: 2 }, { reservas: 1, personas: 4 }, 6]);
  assert.deepStrictEqual(r.dias[1].bloqueos, [{ motivo: 'Evento privado', todo_el_dia: true, desde: null, hasta: null }]);
  assert.deepStrictEqual(r.dias[3].bloqueos, [{ motivo: 'Boda', todo_el_dia: false, desde: '18:00', hasta: '22:00' }]);
  assert.deepStrictEqual(r.semana, { reservas: 3, personas: 12, almuerzo: 2, cena: 10 });   // la del 20 queda fuera de los 8 dias
});

test('la ruta: solo con enlace y permiso de ver; cuenta del motor sin nombres, sin canceladas', async () => {
  const b = await baseLista({ ahora: AHORA });
  const motor = crearMotor({ pool: b.pool, reloj: () => AHORA, ganchos: {}, registrar: () => {} });
  const cli = (n) => ({ nombre: 'Persona' + n, apellido: 'Secreta', email: 's' + n + '@ejemplo.test', telefono: '5555' + (1000 + n), origen: 'web', canal: 'web' });
  await motor.crear(Object.assign(cli(1), { inicio: C.instante('2026-11-03', '13:00'), personas: 2 }), { canal: 'equipo' });
  const r2 = await motor.crear(Object.assign(cli(2), { inicio: C.instante('2026-11-03', '19:00'), personas: 4 }), { canal: 'equipo' });
  await motor.crear(Object.assign(cli(3), { inicio: C.instante('2026-11-04', '19:30'), personas: 3 }), { canal: 'equipo' });
  await motor.cambiarEstado(r2.reserva.id, 'cancelada', { quien: 'prueba' });
  const usuarios = { chef: { email: 'chef@ejemplo.test', rol: 'chef' }, nadie: { email: 'x@ejemplo.test', rol: 'equipo' } };
  const app = express();
  app.use(K.crearRutasCocina({ pool: b.pool, reloj: () => AHORA, quien: async (req) => usuarios[req.get('x-rosanta-u') || req.query.u] || null,
    permisos: async (u) => (u.rol === 'chef' ? { ok: true } : { ok: false, motivo: 'Sin permiso' }) }));
  const s = http.createServer(app); await new Promise((ok) => s.listen(0, ok));
  const base = 'http://127.0.0.1:' + s.address().port;
  try {
    assert.strictEqual((await fetch(base + '/api/cocina/semana')).status, 401);
    assert.strictEqual((await fetch(base + '/api/cocina/semana', { headers: { 'x-rosanta-u': 'nadie' } })).status, 403);
    const r = await fetch(base + '/api/cocina/semana', { headers: { 'x-rosanta-u': 'chef' } });
    const txt = await r.text(); const d = JSON.parse(txt);
    assert.strictEqual(d.fuente, 'motor');
    assert.deepStrictEqual([d.dias[0].personas, d.dias[0].almuerzo.personas, d.dias[0].cena.personas], [2, 2, 0]);   // la cancelada no cuenta
    assert.strictEqual(d.dias[1].personas, 3);
    assert.ok(!/Persona|Secreta|ejemplo\.test|5555/.test(txt), 'sin datos de clientes');
    const html = await (await fetch(base + '/cocina')).text();
    assert.match(html, /Reservas de la semana/);
    assert.match(html, /history\.replaceState\(null, '', '\/cocina'\)/, 'el enlace se borra de la barra');
    assert.match(html, /sessionStorage/, 'recargar sigue funcionando');
  } finally { await new Promise((ok) => s.close(ok)); }
});
