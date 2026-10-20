// Ajustes del motor pedidos por el panel y Adventures (21-oct-2026): franjas de "Mi reserva" sin contar la propia,
// alergias en el cambio, el "antes" y quien cancelo en el gancho, y la cena combinada de Adventures. Sin red.
const test = require('node:test');
const assert = require('node:assert');
const { baseLista } = require('./reservas-base');
const { crearMotor } = require('../src/reservas/motor');
const { cenaAdventures } = require('../src/server-web');
const C = require('../src/reservas/comun');

const AHORA = C.instante('2026-11-03', '10:00').getTime();
const cliente = (n, extra) => Object.assign({ nombre: 'Cliente' + n, apellido: 'Prueba', email: 'c' + n + '@ejemplo.test',
  telefono: '5555' + String(1000 + n), origen: 'web', canal: 'web', optin: true }, extra || {});

async function preparar() {
  const b = await baseLista({ ahora: AHORA });
  const vistos = [];
  const motor = crearMotor({ pool: b.pool, reloj: () => AHORA, registrar: () => {},
    ganchos: { avisos: async (r, ev, extra) => { vistos.push({ ev, r, extra }); } } });
  return { motor, vistos };
}

test('"Mi reserva": las franjas no cuentan la propia reserva como ocupada', async () => {
  const { motor } = await preparar();
  const inicio = C.instante('2026-11-04', '19:00');
  const hechas = [];
  for (let n = 1; n <= 60; n++) {
    const r = await motor.crear(Object.assign(cliente(n), { inicio, personas: 2 }), { canal: 'web', quien: 'prueba' });
    if (!r.ok) break;
    hechas.push(r.reserva.id);
  }
  assert.ok(hechas.length > 0);
  const hora = (s) => (s.slots || []).map((x) => new Date(x.startDate).getTime());
  const sin = await motor.slotsWeb('2026-11-04', 2);
  const con = await motor.slotsWeb('2026-11-04', 2, hechas[0]);
  assert.ok(hora(sin).indexOf(inicio.getTime()) === -1, 'sin excluir, las 19:00 estan llenas');
  assert.ok(hora(con).indexOf(inicio.getTime()) !== -1, 'excluyendo la propia, las 19:00 vuelven a estar libres');
});

test('cambiar acepta alergias, y el gancho recibe el "antes" y quien cancelo', async () => {
  const { motor, vistos } = await preparar();
  const r = await motor.crear(Object.assign(cliente(1), { inicio: C.instante('2026-11-04', '19:00'), personas: 2 }), { canal: 'web' });
  assert.ok(r.ok);
  const c1 = await motor.cambiar(r.reserva.id, { alergias: 'Nueces' }, { canal: 'equipo', quien: 'sala' });
  assert.ok(c1.ok);
  assert.strictEqual((await motor.porId(r.reserva.id)).alergias, 'Nueces');
  const c2 = await motor.cambiar(r.reserva.id, { inicio: C.instante('2026-11-04', '20:00') }, { canal: 'equipo', quien: 'sala' });
  assert.ok(c2.ok);
  await motor.cambiarEstado(r.reserva.id, 'cancelada', { quien: 'cliente:enlace', motivo: 'prueba' });
  await motor.esperarGanchos();
  const cambio = vistos.find((v) => v.ev === 'cambiada');
  assert.strictEqual(cambio.extra.antes.hora, '19:00');
  assert.strictEqual(cambio.r.hora, '20:00');
  const cancel = vistos.find((v) => v.ev === 'cancelada');
  assert.strictEqual(cancel.r.cancelada_por, 'cliente:enlace');
  assert.strictEqual(cancel.extra.antes.estado, 'confirmada');
});

test('la cena combinada de Adventures crea la reserva en el motor (contrato del AYUDANTE 4)', async () => {
  const { motor } = await preparar();
  const ok = await cenaAdventures(motor, { fecha: '2026-11-04', hora: '19:00', personas: 2, nombre: 'Aventurera', email: 'a@ejemplo.test',
    telefono: '55551234', idioma: 'en', codigo: 'OP-01', nota: 'después del Acatenango' });
  assert.ok(ok.id);
  const r = await motor.porId(ok.id);
  assert.strictEqual(r.canal, 'adventures');
  assert.match(r.nota_equipo, /Adventures OP-01/);
  assert.deepStrictEqual(await cenaAdventures(motor, { fecha: 'mal', hora: 'x' }), { id: null, motivo: 'fecha_invalida' });
  assert.deepStrictEqual(await cenaAdventures(motor, { fecha: '2026-11-04', hora: '7pm' }), { id: null, motivo: 'fecha_invalida' });
});
