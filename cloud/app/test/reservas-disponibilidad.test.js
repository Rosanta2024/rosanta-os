/**
 * Motor de reservas: traductor de la configuracion de Wix y disponibilidad. Puro: sin red ni base.
 * La ubicacion de Wix es INVENTADA (test/fixturas/wix-ubicacion-inventada.json); la real llega el 23-oct.
 */
const test = require('node:test');
const assert = require('node:assert');
const W = require('../src/reservas/wix-config');
const D = require('../src/reservas/disponibilidad');
const C = require('../src/reservas/comun');
const { armarConfig, armarReglas } = require('../src/reservas/reglas');
const UB = require('./fixturas/wix-ubicacion-inventada.json');

const M = (n) => '70000000-0000-4000-8000-00000000000' + n;   // mesas del fixture
const AHORA = C.instante('2026-11-03', '10:00').getTime();      // martes 3-nov-2026, 10:00 Guatemala

function config(extra) {
  const t = W.traducirUbicacion(UB);
  return armarConfig({ reglas: t.reglas.concat(extra || []), mesas: t.mesas, combinaciones: t.combinaciones, horario: t.horario, cierres: t.cierres });
}
function rv(id, fecha, hora, personas, mesas, extra) {
  const inicio = C.instante(fecha, hora);
  const dur = (extra && extra.duracion_min) || D.duracionPara(config().reglas, personas, null);
  return Object.assign({ id, estado: 'confirmada', inicio, fin: new Date(inicio.getTime() + dur * 60000), personas, mesa_ids: mesas || [] }, extra || {});
}
const horas = (slots) => slots.map((s) => C.horaGt(s.startDate));

// ---------------------------------------------------------------- traductor

test('traductor: horario por dia, partido a medianoche (vie 12:00 → sab 00:30) y sin lunes', () => {
  const t = W.traducirUbicacion(UB);
  assert.deepStrictEqual(t.horario.map((h) => h.dia_semana + ' ' + h.desde + '-' + h.hasta), [
    '0 12:00-20:00', '2 12:00-21:00', '3 12:00-21:00', '4 12:00-21:00', '5 12:00-24:00', '6 00:00-00:30', '6 12:00-22:00']);
  assert.ok(t.horario.every((h) => h.origen === 'wix'));
});

test('traductor: un periodo que cruza el domingo y uno de semana completa', () => {
  assert.deepStrictEqual(W.horarioDePeriodos([{ openDay: 'SATURDAY', openTime: '22:00', closeDay: 'SUNDAY', closeTime: '02:00' }]),
    [{ dia_semana: 0, desde: '00:00', hasta: '02:00' }, { dia_semana: 6, desde: '22:00', hasta: '24:00' }]);
  const todo = W.horarioDePeriodos([{ openDay: 'MONDAY', openTime: '00:00', closeDay: 'MONDAY', closeTime: '00:00' }]);
  assert.strictEqual(todo.length, 7);
  assert.ok(todo.every((h) => h.desde === '00:00' && h.hasta === '24:00'));
});

test('traductor: reglas (aprobacion, ritmo, aviso, duraciones, intervalo)', () => {
  const r = armarReglas(W.traducirUbicacion(UB).reglas);
  assert.strictEqual(r.aprobacion, 'grupos');
  assert.strictEqual(r.aprobacion_desde, 8);
  assert.strictEqual(r.ritmo_personas, 24);
  assert.strictEqual(r.ritmo_grupos, 4);
  assert.strictEqual(r.aviso_minimo_min, 30);
  assert.strictEqual(r.aviso_maximo_dias, 365);
  assert.strictEqual(r.duracion_min, 120);
  assert.deepStrictEqual(r.duraciones, [{ desde: 1, hasta: 2, minutos: 90 }, { desde: 7, hasta: 15, minutos: 150 }]);
  assert.strictEqual(r.intervalo_min, 15);
  assert.strictEqual(r.tope_web, 10);
  assert.strictEqual(r.tope_bot, 15);          // no viene de Wix: queda la regla propia
  assert.strictEqual(r.en_linea, true);
  assert.strictEqual(r.usar_mesas, true);
  // pacing apagado → sin tope
  const sin = armarReglas(W.reglasDeConfiguracion({ onlineReservations: { seatPacing: { number: 5, enabled: false }, approval: { mode: 'AUTOMATIC' } },
    tableManagement: { mode: 'OFF' } }));
  assert.strictEqual(sin.ritmo_personas, null);
  assert.strictEqual(sin.aprobacion, 'automatica');
  assert.strictEqual(sin.usar_mesas, false);
});

test('traductor: mesas (zona del nombre, inactivas y borradas), combinaciones y cierres', () => {
  const t = W.traducirUbicacion(UB);
  assert.strictEqual(t.mesas.length, 10);
  const j1 = t.mesas.find((m) => m.nombre === 'Jardín 1');
  assert.deepStrictEqual([j1.zona, j1.capacidad_min, j1.capacidad_max, j1.activa], ['jardin', 4, 8, true]);
  assert.strictEqual(t.mesas.find((m) => m.nombre === 'Barra').activa, false);
  assert.strictEqual(t.mesas.find((m) => m.nombre === 'Fogata1').activa, false);
  assert.strictEqual(t.combinaciones.length, 3);
  assert.strictEqual(t.combinaciones[2].activa, false);   // nombra una mesa que no existe
  assert.ok(t.avisos.some((a) => /no estan/.test(a)));
  assert.strictEqual(t.cierres.length, 2);
  const navidad = t.cierres.find((c) => c.cerrado);
  assert.strictEqual(navidad.desde.toISOString(), '2026-12-24T06:00:00.000Z');   // sin zona = hora de Guatemala
  assert.strictEqual(navidad.hasta.toISOString(), '2026-12-25T06:00:00.000Z');
  assert.strictEqual(t.cierres.find((c) => !c.cerrado).desde.toISOString(), '2026-11-02T18:00:00.000Z');
});

test('traductor: reservas de wix_reservas → reservas (estados, HELD fuera, optin, alergias, llave CRM)', () => {
  const base = { id: 'w1', estado: 'RESERVED', fuente: 'ONLINE', inicio: '2026-11-04T01:00:00.000Z', fin: '2026-11-04T02:30:00.000Z', personas: 2,
    mesa_ids: [M(1)], nombre: 'Ana', apellido: 'Prueba', email: 'Ana@Ejemplo.TEST', telefono: '+502 5555-0101', optin: 'SI',
    campos: { '¿Alguna alergia alimentaria?': 'Ninguna', '¿Dónde prefieres sentarte?': 'Pergola', '¿Cómo nos conociste?': 'Instagram' },
    notas_equipo: 'Cumpleaños', consumo_q: null, creada: '2026-10-20T12:00:00Z' };
  const r = W.reservaDeWix(base, 120);
  assert.strictEqual(r.id, 'w1'); assert.strictEqual(r.id_externo, 'w1'); assert.strictEqual(r.origen, 'wix');
  assert.strictEqual(r.estado, 'confirmada'); assert.strictEqual(r.duracion_min, 90);
  assert.strictEqual(r.email, 'ana@ejemplo.test'); assert.strictEqual(r.telefono, '+50255550101');
  assert.strictEqual(r.llave_crm, 'e:ana@ejemplo.test'); assert.strictEqual(r.optin, true);
  assert.strictEqual(r.alergias, ''); assert.strictEqual(r.sentarse, 'Pergola'); assert.strictEqual(r.conocio, 'Instagram');
  assert.strictEqual(r.nota_equipo, 'Cumpleaños');
  const estados = { REQUESTED: 'pendiente', SEATED: 'llego', FINISHED: 'termino', NO_SHOW: 'no_vino', CANCELED: 'cancelada', DECLINED: 'rechazada' };
  Object.keys(estados).forEach((k) => assert.strictEqual(W.reservaDeWix(Object.assign({}, base, { estado: k }), 120).estado, estados[k]));
  assert.strictEqual(W.reservaDeWix(Object.assign({}, base, { estado: 'HELD' }), 120), null);
  const sinFin = W.reservaDeWix(Object.assign({}, base, { fin: null, email: null }), 120);
  assert.strictEqual(sinFin.duracion_min, 120);
  assert.strictEqual(sinFin.llave_crm, 't:55550101');
  const fut = W.reservasFuturasDeWix([base, Object.assign({}, base, { id: 'vieja', inicio: '2026-10-01T01:00:00Z' })], '2026-11-03', 120);
  assert.deepStrictEqual(fut.map((x) => x.id), ['w1']);
});

// ---------------------------------------------------------------- disponibilidad

test('slots: forma IDENTICA a GET /_functions/slots (solo startDate y manualApproval, ISO UTC)', () => {
  const r = D.slotsWeb({ config: config(), fecha: '2026-11-04', personas: 2, reservas: [], ahora: AHORA });
  assert.deepStrictEqual(Object.keys(r), ['slots']);
  assert.deepStrictEqual(r.slots[0], { startDate: '2026-11-04T18:00:00.000Z', manualApproval: false });
  assert.ok(r.slots.every((s) => Object.keys(s).join() === 'startDate,manualApproval'));
  assert.strictEqual(r.slots.length, 37);   // 12:00 a 21:00 cada 15 min (21:00 entra: closeTime = ultima hora para reservar)
  assert.strictEqual(C.horaGt(r.slots[36].startDate), '21:00');
});

test('slots: lunes cerrado, 24-dic cerrado, lunes festivo con horario especial', () => {
  assert.deepStrictEqual(D.slotsWeb({ config: config(), fecha: '2026-11-09', personas: 2, reservas: [], ahora: AHORA }).slots, []);
  assert.deepStrictEqual(D.slotsWeb({ config: config(), fecha: '2026-12-24', personas: 2, reservas: [], ahora: AHORA }).slots, []);
  const festivo = D.slotsWeb({ config: config(), fecha: '2026-11-02', personas: 2, reservas: [], ahora: C.instante('2026-11-01', '10:00') }).slots;
  assert.strictEqual(festivo.length, 32);   // 12:00 a 19:45 (el fin del horario especial no entra)
  assert.deepStrictEqual([C.horaGt(festivo[0].startDate), C.horaGt(festivo[31].startDate)], ['12:00', '19:45']);
});

test('slots: viernes hasta 23:45; la madrugada del sabado existe pero cae fuera de la ventana web (como Wix)', () => {
  assert.strictEqual(C.horaGt(D.slotsWeb({ config: config(), fecha: '2026-11-06', personas: 2, reservas: [], ahora: AHORA }).slots.slice(-1)[0].startDate), '23:45');
  const sab = D.franjasDelDia({ config: config(), fecha: '2026-11-07', personas: 2, canal: 'web', reservas: [], ahora: AHORA }).filter((f) => f.estado === 'AVAILABLE');
  assert.deepStrictEqual(horas(sab).slice(0, 3), ['00:00', '00:15', '00:30']);
  const web = D.slotsWeb({ config: config(), fecha: '2026-11-07', personas: 2, reservas: [], ahora: AHORA }).slots;
  assert.strictEqual(C.horaGt(web[0].startDate), '12:00');
});

test('slots: aviso minimo de 30 min, tope web, aprobacion manual desde 8 y partySize raro', () => {
  const tarde = C.instante('2026-11-03', '18:10').getTime();
  assert.strictEqual(C.horaGt(D.slotsWeb({ config: config(), fecha: '2026-11-03', personas: 2, reservas: [], ahora: tarde }).slots[0].startDate), '18:45');
  assert.deepStrictEqual(D.slotsWeb({ config: config(), fecha: '2026-11-04', personas: 11, reservas: [], ahora: AHORA }).slots, []);
  const ocho = D.slotsWeb({ config: config(), fecha: '2026-11-04', personas: 8, reservas: [], ahora: AHORA }).slots;
  assert.ok(ocho.length && ocho.every((s) => s.manualApproval === true));
  assert.ok(D.slotsWeb({ config: config(), fecha: '2026-11-04', personas: 7, reservas: [], ahora: AHORA }).slots.every((s) => !s.manualApproval));
  assert.strictEqual(D.slotsWeb({ config: config(), fecha: '2026-11-04', personas: 'abc', reservas: [], ahora: AHORA }).slots.length, 37);
});

test('duracion por tamaño de grupo (turnoverTimeRules) y por defecto', () => {
  const r = config().reglas;
  assert.deepStrictEqual([1, 2, 3, 6, 7, 15].map((p) => D.duracionPara(r, p, null)), [90, 90, 120, 120, 150, 150]);
});

test('mesas: si las 5 mesas de 2 estan ocupadas, la franja se cae; se libera al terminar la duracion', () => {
  const ocupadas = [M(1), M(2), M(3), M(4), M(5)].map((m, i) => rv('o' + i, '2026-11-04', '18:30', 2, [m]));
  const ev = (hora) => D.evaluar({ config: config(), inicio: C.instante('2026-11-04', hora), personas: 2, canal: 'web', reservas: ocupadas, ahora: AHORA });
  assert.strictEqual(ev('19:00').estado, 'UNAVAILABLE');
  assert.strictEqual(ev('19:00').motivo, 'sin_mesa');
  assert.strictEqual(ev('19:45').estado, 'UNAVAILABLE');    // las 5 siguen tomadas hasta las 20:00 (18:30 + 90 min)
  assert.strictEqual(ev('20:00').estado, 'AVAILABLE');
});

test('mesas: la mas chica que alcanza, y la combinacion para 12 (jardin 1 + 2)', () => {
  const cfg = config();
  assert.deepStrictEqual(D.evaluar({ config: cfg, inicio: C.instante('2026-11-04', '19:00'), personas: 2, canal: 'web', reservas: [], ahora: AHORA }).mesa_ids, [M(1)]);
  assert.deepStrictEqual(D.evaluar({ config: cfg, inicio: C.instante('2026-11-04', '19:00'), personas: 6, canal: 'web', reservas: [], ahora: AHORA }).mesa_ids, [M(6)]);
  assert.deepStrictEqual(D.evaluar({ config: cfg, inicio: C.instante('2026-11-04', '19:00'), personas: 12, canal: 'bot', reservas: [], ahora: AHORA }).mesa_ids, [M(7), M(8)]);
});

test('ritmo: 4 reservas que empiezan a las 19:00 cierran esa franja (partyPacing), no la siguiente', () => {
  const cuatro = [M(1), M(2), M(3), M(4)].map((m, i) => rv('p' + i, '2026-11-04', '19:00', 2, [m]));
  const ev = (hora) => D.evaluar({ config: config(), inicio: C.instante('2026-11-04', hora), personas: 2, canal: 'web', reservas: cuatro, ahora: AHORA });
  assert.strictEqual(ev('19:00').motivo, 'ritmo_grupos');
  assert.strictEqual(ev('19:15').estado, 'AVAILABLE');
  // las canceladas no cuentan
  cuatro[0].estado = 'cancelada';
  assert.strictEqual(ev('19:00').estado, 'AVAILABLE');
});

test('ritmo: maximo 24 personas nuevas por franja (seatPacing)', () => {
  const r = [rv('s1', '2026-11-04', '19:30', 8, [M(7)]), rv('s2', '2026-11-04', '19:30', 8, [M(8)]), rv('s3', '2026-11-04', '19:30', 4, [M(4)])];
  const ev = (p) => D.evaluar({ config: config(), inicio: C.instante('2026-11-04', '19:30'), personas: p, canal: 'web', reservas: r, ahora: AHORA });
  assert.strictEqual(ev(6).motivo, 'ritmo_personas');
  assert.strictEqual(ev(4).estado, 'AVAILABLE');
});

test('una reserva de Wix sin mesa igual ocupa una (asignacion virtual en orden de hora)', () => {
  const r = [rv('sin', '2026-11-04', '19:00', 8, []), rv('con', '2026-11-04', '19:00', 8, [M(8)])];
  const ev = D.evaluar({ config: config(), inicio: C.instante('2026-11-04', '19:15'), personas: 12, canal: 'bot', reservas: r, ahora: AHORA });
  assert.strictEqual(ev.estado, 'UNAVAILABLE');
  assert.strictEqual(ev.motivo, 'sin_mesa');
});

test('bot: ve desde la hora pedida hasta 12 franjas despues, mismo dia; alternativas por cercania', () => {
  const fr = D.franjasBot({ config: config(), inicio: C.instante('2026-11-04', '20:00'), personas: 2, reservas: [], ahora: AHORA });
  assert.deepStrictEqual(horas(fr), ['20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00']);
  const libres = fr.filter((s) => s.estado === 'AVAILABLE');
  assert.deepStrictEqual(horas(libres), ['20:00', '20:15', '20:30', '20:45', '21:00']);
  assert.deepStrictEqual(D.alternativas(libres, C.instante('2026-11-04', '20:40'), 4), ['20:45', '20:30', '21:00', '20:15']);
});

test('fuera de la grilla (20:10): el bot no la toma; el equipo si', () => {
  const t = C.instante('2026-11-04', '20:10');
  assert.strictEqual(D.evaluar({ config: config(), inicio: t, personas: 2, canal: 'bot', reservas: [], ahora: AHORA }).motivo, 'fuera_de_grilla');
  assert.strictEqual(D.evaluar({ config: config(), inicio: t, personas: 2, canal: 'equipo', reservas: [], ahora: AHORA }).estado, 'AVAILABLE');
});

test('pausa de reservas en linea: la web no ve nada, el bot si', () => {
  const cfg = config([{ clave: 'pausa_hasta', valor: '2026-11-05T00:00:00-06:00' }]);
  assert.deepStrictEqual(D.slotsWeb({ config: cfg, fecha: '2026-11-04', personas: 2, reservas: [], ahora: AHORA }).slots, []);
  assert.ok(D.franjasBot({ config: cfg, inicio: C.instante('2026-11-04', '19:00'), personas: 2, reservas: [], ahora: AHORA }).some((s) => s.estado === 'AVAILABLE'));
});

test('cierre parcial del equipo (19:00 a 21:00) apaga solo esas franjas', () => {
  const cfg = config();
  cfg.cierres.push({ desde: C.instante('2026-11-04', '19:00'), hasta: C.instante('2026-11-04', '21:00'), cerrado: true, motivo: 'evento' });
  const h = horas(D.slotsWeb({ config: cfg, fecha: '2026-11-04', personas: 2, reservas: [], ahora: AHORA }).slots);
  assert.ok(h.indexOf('18:45') !== -1 && h.indexOf('19:00') === -1 && h.indexOf('20:45') === -1 && h.indexOf('21:00') !== -1);
});
