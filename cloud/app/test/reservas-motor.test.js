/**
 * Motor de reservas sobre una base de mentira (pg-mem, con la migracion 051 tal cual). Sin red.
 * Los ganchos son espias en memoria: no sale ningun correo, ni mensaje, ni llamada a Meta o a Wix.
 */
const test = require('node:test');
const assert = require('node:assert');
const { baseLista, crearBase } = require('./reservas-base');
const { crearMotor, ErrorMotor } = require('../src/reservas/motor');
const { cargarDesdeWix } = require('../src/reservas/carga-wix');
const C = require('../src/reservas/comun');
const UB = require('./fixturas/wix-ubicacion-inventada.json');

const M = (n) => '70000000-0000-4000-8000-00000000000' + n;
const AHORA = C.instante('2026-11-03', '10:00').getTime();
const T = (f, h) => C.instante(f, h);

function espias() {
  const e = { avisos: [], crm: [], capi: [], espejo: [], log: [] };
  e.ganchos = {
    avisos: async (r, ev) => { e.avisos.push([ev, r.id]); },
    crm: async (p) => { e.crm.push(p); },
    capi: async (p) => { e.capi.push(p); },
    espejoWix: async () => { e.espejo.push(1); throw new Error('el espejo a Wix NO debe correr en pruebas'); }
  };
  return e;
}

async function preparar(o) {
  o = o || {};
  const b = await baseLista(Object.assign({ ahora: AHORA }, o));
  const e = espias();
  const motor = crearMotor({ pool: b.pool, reloj: () => AHORA, ganchos: e.ganchos, registrar: (m) => e.log.push(m) });
  return { b, e, motor };
}
const cliente = (n, extra) => Object.assign({ nombre: 'Cliente' + n, apellido: 'Prueba', email: 'cliente' + n + '@ejemplo.test',
  telefono: '5555' + String(1000 + n), origen: 'web', canal: 'web', optin: true }, extra || {});

// ---------------------------------------------------------------- carga desde Wix

test('carga desde wix_*: mesas, horario, cierres y reglas; repetible; las HELD no entran', async () => {
  const wix = (id, estado, hora) => ({ id, revision: '1', status: estado, source: 'ONLINE',
    details: { reservationLocationId: UB.id, startDate: T('2026-11-04', hora).toISOString(), endDate: new Date(T('2026-11-04', hora).getTime() + 90 * 60000).toISOString(),
      partySize: 2, tables: { ids: [M(1)] } },
    reservee: { firstName: 'Inventada', lastName: id, email: id + '@ejemplo.test', phone: '+50255550' + id.slice(-3), customFields: { '88cadd96-c92b-40c4-8ef2-d0d2ad67acb5': 'SI' } },
    createdDate: '2026-10-20T15:00:00Z' });
  const { b, motor } = await preparar({ modo: 'wix', wix: [wix('wx-001', 'RESERVED', '19:00'), wix('wx-002', 'HELD', '19:30')] });
  assert.deepStrictEqual([b.carga.cuenta.mesas, b.carga.cuenta.horario, b.carga.cuenta.cierres, b.carga.cuenta.reservas_nuevas, b.carga.cuenta.sin_copiar], [10, 7, 2, 1, 1]);
  const r = await motor.porId('wx-001');
  assert.deepStrictEqual([r.origen, r.id_externo, r.estado, r.optin, r.mesa_ids[0]], ['wix', 'wx-001', 'confirmada', true, M(1)]);
  // segunda corrida: nada cambia
  const otra = await cargarDesdeWix(b.pool, { ahora: AHORA });
  assert.strictEqual(otra.cuenta.reservas_iguales, 1);
  assert.strictEqual(otra.cuenta.reservas_nuevas, 0);
  // Wix la cancela → se actualiza y queda en el historial
  await b.pool.query("UPDATE wix_reservas SET estado = 'CANCELED' WHERE id = 'wx-001'");
  const tercera = await cargarDesdeWix(b.pool, { ahora: AHORA });
  assert.strictEqual(tercera.cuenta.reservas_cambiadas, 1);
  assert.strictEqual((await motor.porId('wx-001')).estado, 'cancelada');
  assert.deepStrictEqual((await motor.historial('wx-001')).map((h) => h.evento), ['carga', 'carga']);
  // con la base mandando no se recarga
  b.uno("UPDATE interruptores SET modo = 'base' WHERE modulo = 'motor_reservas'");
  await assert.rejects(cargarDesdeWix(b.pool, { ahora: AHORA }), /motor_reservas = base/);
});

test('carga desde wix_* en seco: muestra los conteos y no escribe', async () => {
  const b = crearBase();
  await b.pool.query('INSERT INTO wix_ubicaciones (id, nombre, configuracion, crudo) VALUES ($1, $2, $3, $4)', [UB.id, 'x', JSON.stringify(UB.configuration), JSON.stringify(UB)]);
  // pg-mem no deshace un ROLLBACK: se mira que la transaccion termine en ROLLBACK y nunca en COMMIT (Postgres deshace).
  const dichas = [];
  const pool = { query: (s, p) => b.pool.query(s, p), connect: async () => { const c = await b.pool.connect();
    return { query: (s, p) => { dichas.push(String(s).trim().split(/\s+/)[0].toUpperCase()); return c.query(s, p); }, release: () => c.release() }; } };
  const r = await cargarDesdeWix(pool, { ahora: AHORA, seco: true });
  assert.strictEqual(r.modo, 'seco');
  assert.strictEqual(r.cuenta.mesas, 10);
  assert.strictEqual(dichas[0], 'BEGIN');
  assert.strictEqual(dichas[dichas.length - 1], 'ROLLBACK');
  assert.ok(dichas.indexOf('COMMIT') === -1);
});

// ---------------------------------------------------------------- crear

test('crear: confirma, asigna la mesa mas chica, guarda E.164 y llave CRM, anota el historial y avisa', async () => {
  const { motor, e } = await preparar();
  const r = await motor.crear(Object.assign(cliente(1), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web', quien: 'web' });
  await motor.esperarGanchos();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.reserva.estado, 'confirmada');
  assert.deepStrictEqual(r.reserva.mesa_ids, [M(1)]);
  assert.strictEqual(r.reserva.telefono, '+50255551001');
  assert.strictEqual(r.reserva.llave_crm, 'e:cliente1@ejemplo.test');
  assert.strictEqual(r.reserva.duracion_min, 90);
  assert.deepStrictEqual((await motor.historial(r.reserva.id)).map((h) => [h.quien, h.evento]), [['web', 'creada']]);
  assert.deepStrictEqual(e.avisos, [['creada', r.reserva.id]]);
  // el MISMO cuerpo que crmReservas.js de Wix
  assert.deepStrictEqual(e.crm, [{ id: r.reserva.id, fecha: '2026-11-04', nombre: 'Cliente1 Prueba', email: 'cliente1@ejemplo.test',
    telefono: '+50255551001', personas: 2, gasto: 0, estado: 'RESERVED', optin: 'SI' }]);
  assert.strictEqual(e.capi.length, 1);
  assert.strictEqual(e.capi[0].evento, 'NewReservation');
  assert.strictEqual(e.capi[0].event_id, r.reserva.id);
  assert.strictEqual(e.espejo.length, 0);   // apagado
});

test('crear: grupo de 8 por la web queda pendiente (aprobacion manual); sin CAPI hasta que se apruebe', async () => {
  const { motor, e } = await preparar();
  const r = await motor.crear(Object.assign(cliente(2), { inicio: T('2026-11-04', '19:00'), personas: 8 }), { canal: 'web' });
  await motor.esperarGanchos();
  assert.strictEqual(r.reserva.estado, 'pendiente');
  assert.strictEqual(r.reserva.aprobacion_manual, true);
  assert.deepStrictEqual(e.avisos.map((a) => a[0]), ['pendiente']);
  assert.strictEqual(e.capi.length, 0);
  const ap = await motor.cambiarEstado(r.reserva.id, 'confirmada', { quien: 'dueno@ejemplo.test' });
  await motor.esperarGanchos();
  assert.strictEqual(ap.reserva.estado, 'confirmada');
  assert.deepStrictEqual(e.avisos.map((a) => a[0]), ['pendiente', 'aprobada']);
  assert.strictEqual(e.capi.length, 1);
  assert.strictEqual(e.crm.slice(-1)[0].estado, 'RESERVED');
});

test('concurrencia: 5 personas piden a la vez la ULTIMA mesa → una sola la toma (candado por fecha)', async () => {
  const { motor, b } = await preparar();
  for (const n of [1, 2, 3, 4]) {   // 4 de las 5 mesas de 2 tomadas desde las 18:30
    assert.ok((await motor.crear(Object.assign(cliente(10 + n), { inicio: T('2026-11-04', '18:30'), personas: 2 }), { canal: 'web' })).ok);
  }
  const antes = b.pedidos.length;
  const intentos = await Promise.all([1, 2, 3, 4, 5].map((n) =>
    motor.crear(Object.assign(cliente(20 + n), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })));
  assert.strictEqual(intentos.filter((x) => x.ok).length, 1);
  assert.deepStrictEqual(intentos.filter((x) => !x.ok).map((x) => x.franja.motivo), ['sin_mesa', 'sin_mesa', 'sin_mesa', 'sin_mesa']);
  assert.deepStrictEqual(b.pedidos.slice(antes).map((p) => p.llave), Array(5).fill('51:20261104'));
  // ninguna mesa queda con dos reservas a la vez
  const dia = (await motor.dia('2026-11-04')).reservas.filter((r) => r.estado === 'confirmada');
  const usadas = dia.map((r) => r.mesa_ids[0]);
  assert.strictEqual(new Set(usadas).size, usadas.length);
});

test('concurrencia (control): SIN el candado, las mismas 5 se pisan la mesa', async () => {
  const { motor } = await preparar({ sinCandado: true });
  for (const n of [1, 2, 3, 4]) await motor.crear(Object.assign(cliente(10 + n), { inicio: T('2026-11-04', '18:30'), personas: 2 }), { canal: 'web' });
  const intentos = await Promise.all([1, 2, 3, 4, 5].map((n) =>
    motor.crear(Object.assign(cliente(20 + n), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })));
  assert.ok(intentos.filter((x) => x.ok).length > 1, 'sin candado deberian colarse varias: si no, la prueba de arriba no prueba nada');
});

test('las reservas que vinieron de Wix ocupan su mesa', async () => {
  const { motor, b } = await preparar({ modo: 'wix', wix: [{ id: 'wx-100', status: 'RESERVED', source: 'OFFLINE',
    details: { reservationLocationId: UB.id, startDate: T('2026-11-04', '19:00').toISOString(), endDate: T('2026-11-04', '20:30').toISOString(), partySize: 2, tables: { ids: [M(1)] } },
    reservee: { firstName: 'Inventada', phone: '+50255550100' } }] });
  b.uno("UPDATE interruptores SET modo = 'base' WHERE modulo = 'motor_reservas'");
  const r = await motor.crear(Object.assign(cliente(3), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' });
  assert.deepStrictEqual(r.reserva.mesa_ids, [M(2)]);
});

// ---------------------------------------------------------------- cambiar, estados, consumo

test('cambiar: la MISMA reserva cambia de hora, libera la mesa vieja y queda en el historial', async () => {
  const { motor, e } = await preparar();
  const r = (await motor.crear(Object.assign(cliente(4), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  const c = await motor.cambiar(r.id, { inicio: T('2026-11-04', '21:00') }, { canal: 'bot', quien: 'bot:whatsapp' });
  await motor.esperarGanchos();
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.reserva.id, r.id);
  assert.strictEqual(C.horaGt(c.reserva.inicio), '21:00');
  assert.strictEqual(c.reserva.version, 2);
  const h = await motor.historial(r.id);
  assert.deepStrictEqual(h.map((x) => x.evento), ['creada', 'cambiada']);
  assert.strictEqual(C.horaGt(h[1].cambio.antes.inicio), '19:00');
  assert.ok(e.avisos.some((a) => a[0] === 'cambiada'));
  // la mesa de las 19:00 quedo libre
  const otra = await motor.crear(Object.assign(cliente(5), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' });
  assert.deepStrictEqual(otra.reserva.mesa_ids, [M(1)]);
});

test('cambiar a una hora llena: no toca nada y devuelve las libres', async () => {
  const { motor } = await preparar();
  for (const n of [1, 2, 3, 4]) await motor.crear(Object.assign(cliente(30 + n), { inicio: T('2026-11-04', '20:00'), personas: 2 }), { canal: 'web' });   // ritmo: 4 grupos a las 20:00
  const r = (await motor.crear(Object.assign(cliente(6), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  const c = await motor.cambiar(r.id, { inicio: T('2026-11-04', '20:00') }, { canal: 'bot' });
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.motivo, 'sin_disponibilidad');
  assert.ok(c.libres.length > 0);
  assert.strictEqual(C.horaGt((await motor.porId(r.id)).inicio), '19:00');
});

test('estados: llego → termino; transicion invalida; volver a ocupar una mesa ya tomada', async () => {
  const { motor, e } = await preparar();
  const r = (await motor.crear(Object.assign(cliente(7), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  assert.strictEqual((await motor.cambiarEstado(r.id, 'llego', { quien: 'sala@ejemplo.test' })).reserva.estado, 'llego');
  assert.strictEqual((await motor.cambiarEstado(r.id, 'termino', { quien: 'sala@ejemplo.test' })).reserva.estado, 'termino');
  await motor.esperarGanchos();
  assert.deepStrictEqual(e.avisos.map((a) => a[0]), ['creada', 'llego', 'termino']);   // termino → la reseña (AYUDANTE 2)
  const x = (await motor.crear(Object.assign(cliente(8), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  await motor.cambiarEstado(x.id, 'cancelada', { quien: 'bot' });
  const inv = await motor.cambiarEstado(x.id, 'llego', {});
  assert.strictEqual(inv.motivo, 'TRANSICION_INVALIDA');
  // no_vino libera la mesa; si otro la toma, "llego" ya no puede volver
  const y = (await motor.crear(Object.assign(cliente(9), { inicio: T('2026-11-05', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  await motor.cambiarEstado(y.id, 'no_vino', {});
  const z = (await motor.crear(Object.assign(cliente(10), { inicio: T('2026-11-05', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  assert.deepStrictEqual(z.mesa_ids, y.mesa_ids);
  assert.strictEqual((await motor.cambiarEstado(y.id, 'llego', {})).motivo, 'MESA_OCUPADA');
});

test('consumo: lo anota el equipo, va al CRM como gasto y queda en el historial', async () => {
  const { motor, e } = await preparar();
  const r = (await motor.crear(Object.assign(cliente(11), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' })).reserva;
  const c = await motor.consumo(r.id, 'Q1,250.50', { quien: 'sala@ejemplo.test' });
  await motor.esperarGanchos();
  assert.strictEqual(c.reserva.consumo_q, 1250.5);
  assert.strictEqual(e.crm.slice(-1)[0].gasto, 1250.5);
  assert.deepStrictEqual((await motor.historial(r.id)).map((h) => h.evento), ['creada', 'consumo']);
  await assert.rejects(motor.consumo(r.id, 'mucho'), (err) => err.motivo === 'MONTO_INVALIDO');
});

// ---------------------------------------------------------------- cierres e interruptor

test('cerrar una fecha: no hay franjas, devuelve las reservas afectadas; reabrir la devuelve', async () => {
  const { motor } = await preparar();
  await motor.crear(Object.assign(cliente(12), { inicio: T('2026-11-11', '19:00'), personas: 2 }), { canal: 'web' });
  const c = await motor.cerrar({ fecha: '2026-11-11', motivo: 'Evento privado (prueba)' }, { quien: 'dueno@ejemplo.test' });
  assert.strictEqual(c.afectadas.length, 1);
  assert.deepStrictEqual((await motor.slotsWeb('2026-11-11', 2)).slots, []);
  assert.strictEqual((await motor.cierres()).filter((x) => x.origen === 'equipo').length, 1);
  await motor.reabrir(c.id);
  assert.strictEqual((await motor.slotsWeb('2026-11-11', 2)).slots.length, 37);
});

test('con motor_reservas = wix el motor calcula pero NO escribe', async () => {
  const { motor } = await preparar({ modo: 'wix' });
  assert.strictEqual(await motor.modo(), 'wix');
  assert.ok((await motor.slotsWeb('2026-11-04', 2)).slots.length > 0);
  await assert.rejects(motor.crear(Object.assign(cliente(13), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' }),
    (err) => err instanceof ErrorMotor && err.motivo === 'MOTOR_EN_WIX');
});

test('si un gancho falla, la reserva queda igual (solo se registra)', async () => {
  const b = await baseLista({ ahora: AHORA });
  const log = [];
  const motor = crearMotor({ pool: b.pool, reloj: () => AHORA, registrar: (m) => log.push(m), ganchos: { crm: async () => { throw new Error('Marketing OS caido'); } } });
  const r = await motor.crear(Object.assign(cliente(14), { inicio: T('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' });
  await motor.esperarGanchos();
  assert.strictEqual(r.ok, true);
  assert.ok(await motor.porId(r.reserva.id));
  assert.ok(log.some((m) => /gancho crm/.test(m) && /Marketing OS caido/.test(m)));
});
