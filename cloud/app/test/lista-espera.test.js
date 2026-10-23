// Lista de espera (LISTA_ESPERA=encendida; 051 + 056): validacion, apagado = 404, aviso cuando se libera lugar,
// idempotencia y la pestaña del panel. Motor y avisos REALES sobre pg-mem; la red es falsa (Resend). Datos inventados.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { baseLista, sentencias } = require('./reservas-base');
const { crearRutasReservas } = require('../src/reservas/rutas');
const { crearAvisos } = require('../src/reservas-avisos/avisos');
const { canalesDesdeEntorno } = require('../src/reservas-avisos/adaptadores');
const { crearAppWeb } = require('../src/server-web');
const { crearAlmacenMemoria } = require('../src/almacen-web');
const LE = require('../src/reservas/lista-espera');
const T = require('../src/reservas-avisos/textos');
const C = require('../src/reservas/comun');
const P = require('../src/permisos');

const MIG = path.join(__dirname, '../../db/migraciones');
const MIG052 = fs.readFileSync(path.join(MIG, '052_reservas_avisos.sql'), 'utf8');
// de la 056, lo de lista_espera (web_blog necesita las tablas de la 053, que pg-mem no carga aca)
const MIG056 = sentencias(fs.readFileSync(path.join(MIG, '056_blog.sql'), 'utf8')).filter((s) => /lista_espera/.test(s));
const AHORA = C.instante('2026-11-02', '10:00').getTime();   // lunes 2 de noviembre, 10:00
const FECHA = '2026-11-05';                                    // jueves
const USUARIOS = { 'tok-dueno': { email: 'dueno@ejemplo.test', rol: 'Dueño' }, 'tok-sala': { email: 'sala@ejemplo.test', rol: 'sala' }, 'tok-chef': { email: 'chef@ejemplo.test', rol: 'chef' } };

function red() {
  const llamadas = []; let n = 0; const fallar = {};
  const f = async (url, op) => {
    llamadas.push({ url, body: JSON.parse(op.body) });
    if (url === 'https://api.resend.com/emails') {
      const st = fallar.resend ? 500 : 200;
      return { ok: st < 300, status: st, text: async () => JSON.stringify(fallar.resend ? { message: 'caido' } : { id: 'em_' + (++n) }) };
    }
    throw new Error('Salida a la red no permitida: ' + url);
  };
  return { f, llamadas, fallar };
}

/** Motor + avisos + lista de espera, como los monta server-web.js con LISTA_ESPERA=encendida. */
async function montar(o) {
  o = o || {};
  const reloj = { t: AHORA };
  const b = await baseLista({ ahora: reloj.t });
  for (const s of sentencias(MIG052)) b.uno(s);
  for (const s of MIG056) b.uno(s);
  const net = red();
  const log = [];
  const avisos = crearAvisos({ pool: b.pool, canales: canalesDesdeEntorno({ AVISOS_MODO: o.avisos || 'sombra', RESEND_API_KEY: 're_prueba' }, net.f),
    secretoEnlace: 'enlace-prueba', reloj: () => reloj.t, registrar: (m) => log.push(m) });
  let espera = null;
  const M = P.cargarDeMigracion();
  const rutas = crearRutasReservas({ pool: b.pool, reloj: () => reloj.t, secretos: { bot: 'bot', enlace: 'enlace-prueba' }, registrar: (m) => log.push(m),
    avisos: LE.conListaEspera(avisos.gancho, { alLiberar: (...a) => espera.alLiberar(...a) }, (m) => log.push(m)),
    quien: async (req) => USUARIOS[req.get('x-rosanta-u')] || null, permisos: async (u, parte, accion, reg) => P.puede(M, u, parte, accion, reg) });
  espera = LE.crearListaEspera({ pool: b.pool, motor: rutas.motor, avisos, reloj: () => reloj.t, registrar: (m) => log.push(m) });
  const app = express();
  app.set('trust proxy', true);
  app.use('/api/reservas', rutas);
  app.use('/api/reservas', LE.crearRutasListaEspera({ espera, reloj: () => reloj.t, quien: async (req) => USUARIOS[req.get('x-rosanta-u')] || null,
    permisos: async (u, parte, accion) => P.puede(M, u, parte, accion) }));
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, ok));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const pedir = async (metodo, ruta, cuerpo, cab) => {
    const r = await fetch(base + ruta, { method: metodo, headers: Object.assign({ 'Content-Type': 'application/json' }, cab || {}), body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    await rutas.motor.esperarGanchos();
    const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch (e) { /* texto */ }
    return { status: r.status, body: j, headers: r.headers };
  };
  const filas = async () => (await b.pool.query('SELECT * FROM lista_espera ORDER BY id')).rows.map(LE.deFila);
  const envios = async () => (await b.pool.query("SELECT * FROM envios WHERE plantilla = 'espera_mesa_libre' ORDER BY id")).rows;
  const libres = async (personas) => (await rutas.motor.franjasDia(FECHA, personas || 2, 'web')).filter((f) => f.estado === 'AVAILABLE').map((f) => C.horaGt(f.startDate));
  const reservar = async (hora, personas, extra) => {
    const r = await rutas.motor.crear(Object.assign({ nombre: 'Cliente', apellido: 'Inventado', email: 'cliente@ejemplo.test', telefono: '+50255550000',
      inicio: C.instante(FECHA, hora), personas: personas || 2, origen: 'web', canal: 'web' }, extra || {}), { canal: 'web', quien: 'web' });
    await rutas.motor.esperarGanchos();
    assert.ok(r.ok, 'reserva de prueba: ' + JSON.stringify(r.motivo));
    return r.reserva;
  };
  return { b, reloj, net, avisos, motor: rutas.motor, espera, pedir, filas, envios, libres, reservar, log, cerrar: () => new Promise((ok) => srv.close(ok)) };
}

const PERSONA = { fecha: FECHA, desde: '18:00', hasta: '21:00', personas: 2, nombre: 'Ana Espera', email: 'Ana@Ejemplo.test', telefono: '5555 1111', idioma: 'es', fuente: 'web' };
const WEB = { Origin: 'https://www.rosanta.rest' };

test('validar(): fecha, rango de horas, personas, nombre, correo, telefono y fuente', () => {
  const ok = LE.validar(PERSONA, AHORA, 10);
  assert.deepStrictEqual(ok.fila, { fecha: FECHA, desde: '18:00', hasta: '21:00', personas: 2, nombre: 'Ana Espera', email: 'ana@ejemplo.test',
    telefono: '+50255551111', llave_crm: 'e:ana@ejemplo.test', idioma: 'es', origen: 'web', fuente_trafico: {} });
  const mal = (cambio) => LE.validar(Object.assign({}, PERSONA, cambio), AHORA, 10).body.motivo;
  assert.strictEqual(mal({ fecha: '2026-11-31' }), 'FECHA_INVALIDA');
  assert.strictEqual(mal({ fecha: '2026-11-01' }), 'FECHA_EN_PASADO');
  assert.strictEqual(mal({ fecha: '2027-06-01' }), 'FECHA_LEJANA');
  assert.strictEqual(mal({ desde: '7pm' }), 'HORA_INVALIDA');
  assert.strictEqual(mal({ hasta: '24:30' }), 'HORA_INVALIDA');
  assert.strictEqual(mal({ desde: '21:00', hasta: '18:00' }), 'RANGO_INVALIDO');
  assert.strictEqual(mal({ fecha: '2026-11-02', desde: '08:00', hasta: '09:30' }), 'FECHA_EN_PASADO');
  assert.strictEqual(mal({ personas: 0 }), 'PERSONAS_INVALIDO');
  assert.strictEqual(mal({ personas: 11 }), 'PERSONAS_INVALIDO');
  assert.strictEqual(mal({ personas: 2.5 }), 'PERSONAS_INVALIDO');
  assert.strictEqual(mal({ nombre: '  ' }), 'FALTA_NOMBRE');
  assert.strictEqual(mal({ email: 'sin-arroba' }), 'CORREO_INVALIDO');
  assert.strictEqual(mal({ telefono: '123' }), 'TELEFONO_INVALIDO');
  assert.strictEqual(LE.validar(null, AHORA, 10).body.motivo, 'CUERPO_INVALIDO');
  const sinTel = LE.validar(Object.assign({}, PERSONA, { telefono: '', idioma: 'en-US', fuente: { utm_source: 'ig', 'mal clave': 'x', gclid: 5 } }), AHORA, 10).fila;
  assert.deepStrictEqual([sinTel.telefono, sinTel.idioma, sinTel.origen, sinTel.fuente_trafico], [null, 'en', 'web', { utm_source: 'ig' }]);
  assert.strictEqual(LE.validar(Object.assign({}, PERSONA, { fuente: 'bot_whatsapp' }), AHORA, 10).fila.origen, 'bot_whatsapp');
  assert.strictEqual(LE.validar(Object.assign({}, PERSONA, { fuente: 'DROP TABLE' }), AHORA, 10).fila.origen, 'web');
});

test('horaLibre(): la hora liberada si cae en el rango; si no, la libre mas cercana dentro del rango; nada si no hay', () => {
  const fr = (h, e) => ({ startDate: C.instante(FECHA, h).toISOString(), estado: e || 'AVAILABLE' });
  const lista = [fr('17:00'), fr('18:30'), fr('19:00', 'NO_TABLES'), fr('20:00'), fr('21:30')];
  const f = { desde: '18:00', hasta: '21:00' };
  assert.strictEqual(LE.horaLibre(lista, f, '20:00', AHORA), '20:00');
  assert.strictEqual(LE.horaLibre(lista, f, '19:00', AHORA), '18:30', '19:00 no esta libre: la mas cercana (empate: la mas temprana)');
  assert.strictEqual(LE.horaLibre(lista, { desde: '22:00', hasta: '23:00' }, '19:00', AHORA), null);
  assert.strictEqual(LE.horaLibre(lista, f, '20:00', C.instante(FECHA, '20:30').getTime()), null, 'lo que ya paso no cuenta');
});

test('la plantilla espera_mesa_libre existe en ES y EN, con el enlace para reservar y sin datos sin llenar', () => {
  const PL = T.cargar();
  const datos = { nombre: 'Ana', fecha: 'jueves 5 de noviembre', fecha_corta: '05/11', hora: '19:00', personas: '2 personas', enlace_reservar: 'https://www.rosanta.rest/reservas' };
  for (const idi of ['es', 'en']) {
    const m = T.armarCorreo(PL, LE.PLANTILLA, idi, datos);
    assert.deepStrictEqual(m.faltan, [], idi);
    assert.match(m.html, /href="https:\/\/www\.rosanta\.rest\/reservas"/);
    assert.ok(!/[{}]|\[si |\[boton /.test(m.texto + m.asunto), idi);
  }
  assert.match(T.armarCorreo(PL, LE.PLANTILLA, 'es', datos).asunto, /^Se liberó una mesa · 05\/11 19:00$/);
  assert.deepStrictEqual(T.armarCorreo(PL, LE.PLANTILLA, 'es', Object.assign({}, datos, { enlace_reservar: '' })).faltan, ['enlace_reservar'], 'sin enlace no sale');
});

test('rosanta-web: con LISTA_ESPERA apagada (por defecto) la ruta no existe (404); encendida, anota con CORS', async () => {
  for (const env of [{}, { LISTA_ESPERA: 'encendida' }]) {
    const b = await baseLista();
    for (const s of sentencias(MIG052)) b.uno(s);
    for (const s of MIG056) b.uno(s);
    const red = [];
    const { app, espera } = crearAppWeb({ pool: b.pool, matriz: () => P.cargarDeMigracion(), almacenWeb: crearAlmacenMemoria(), canales: { modo: 'apagado' },
      fetch: async (u) => { red.push(u); return { ok: true, status: 200, json: async () => ({}) }; }, env: Object.assign({ CLAVE_TAREAS: 't', RESERVAS_ENLACE_SECRETO: 'e' }, env) });
    const srv = http.createServer(app);
    await new Promise((ok) => srv.listen(0, ok));
    const base = 'http://127.0.0.1:' + srv.address().port;
    const manana = C.sumarDias(C.diaGt(Date.now()), 2);
    try {
      const r = await fetch(base + '/api/reservas/lista-espera', { method: 'POST', headers: Object.assign({ 'Content-Type': 'text/plain' }, WEB),
        body: JSON.stringify(Object.assign({}, PERSONA, { fecha: manana })) });
      const eq = await fetch(base + '/api/reservas/equipo/lista-espera?fecha=' + manana);
      if (!env.LISTA_ESPERA) {
        assert.strictEqual(espera, null);
        assert.deepStrictEqual([r.status, eq.status], [404, 404]);
        assert.strictEqual((await fetch(base + '/api/reservas/lista-espera', { method: 'OPTIONS', headers: WEB })).status, 404);
        // y lo de siempre sigue igual
        assert.strictEqual((await fetch(base + '/api/reservas/slots?date=' + manana + '&partySize=2', { headers: WEB })).status, 200);
        continue;
      }
      assert.strictEqual(r.status, 200);
      const j = await r.json();
      assert.deepStrictEqual(Object.keys(j), ['ok', 'id']);
      assert.strictEqual(j.ok, true);
      assert.strictEqual(r.headers.get('access-control-allow-origin'), 'https://www.rosanta.rest');
      assert.strictEqual(eq.status, 401, 'la lista del equipo pide el enlace');
      const pre = await fetch(base + '/api/reservas/lista-espera', { method: 'OPTIONS', headers: Object.assign({ 'Access-Control-Request-Method': 'POST' }, WEB) });
      assert.strictEqual(pre.status, 204);
      const ajeno = await fetch(base + '/api/reservas/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example' }, body: '{}' });
      assert.strictEqual(ajeno.status, 403);
      const malo = await fetch(base + '/api/reservas/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fecha: 'mañana' }) });
      assert.strictEqual(malo.status, 400);
      assert.deepStrictEqual(await malo.json(), { ok: false, motivo: 'FECHA_INVALIDA', error: 'La fecha va como AAAA-MM-DD.' });
      // la misma persona otra vez ese dia: el mismo id (no se duplica)
      const otra = await fetch(base + '/api/reservas/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, PERSONA, { fecha: manana, desde: '19:00' })) });
      assert.deepStrictEqual(await otra.json(), { ok: true, id: j.id });
      assert.strictEqual((await b.pool.query('SELECT count(*)::int AS n FROM lista_espera')).rows[0].n, 1);
    } finally { await new Promise((ok) => srv.close(ok)); }
    assert.deepStrictEqual(red, []);
  }
});

test('se cancela una reserva → correo "se libero una mesa" al PRIMERO de la lista con lugar en su horario; idempotente', async () => {
  const s = await montar();
  try {
    const libres = await s.libres(2);
    assert.ok(libres.indexOf('19:00') !== -1, 'el dia de prueba tiene 19:00 libre');
    const rv = await s.reservar('19:00', 2);
    // tres personas en la lista: una fuera de horario (nunca hay lugar), y dos en orden de llegada
    const fuera = await s.pedir('POST', '/api/reservas/lista-espera', Object.assign({}, PERSONA, { email: 'temprano@ejemplo.test', desde: '07:00', hasta: '08:00' }), WEB);
    const ana = await s.pedir('POST', '/api/reservas/lista-espera', PERSONA, WEB);
    s.reloj.t += 60000;
    const beto = await s.pedir('POST', '/api/reservas/lista-espera', Object.assign({}, PERSONA, { nombre: 'Beto', email: 'beto@ejemplo.test', idioma: 'en' }), WEB);
    assert.deepStrictEqual([fuera.status, ana.status, beto.status], [200, 200, 200]);
    const antes = s.net.llamadas.length;

    const c = await s.pedir('POST', '/api/reservas/equipo/reservas/' + rv.id + '/estado', { estado: 'cancelada', motivo: 'prueba' }, { 'x-rosanta-u': 'tok-dueno' });
    assert.strictEqual(c.status, 200);
    const f = await s.filas();
    assert.deepStrictEqual(f.map((x) => [x.email.split('@')[0], x.estado]), [['temprano', 'esperando'], ['ana', 'avisado'], ['beto', 'esperando']]);
    const a = f[1];
    assert.strictEqual(a.aviso_por, 'cancelada:' + rv.id + ':v2');
    assert.strictEqual(a.aviso_hora, '19:00', 'se le ofrece la hora que se libero');
    assert.match(a.aviso_envio, /^espera_mesa_libre:espera:\d+:cancelada:/);
    const e = await s.envios();
    assert.deepStrictEqual(e.map((x) => [x.reserva_id, x.estado, x.modo, x.idioma, x.destinatario]), [['espera:' + a.id, 'enviado', 'sombra', 'es', 'an***@ejemplo.test']]);
    // el correo (en sombra va a restaurante@, con el destinatario tapado)
    const correos = s.net.llamadas.slice(antes).filter((x) => /Se liberó/.test(x.body.subject));
    assert.strictEqual(correos.length, 1);
    assert.deepStrictEqual(correos[0].body.to, ['restaurante@rosanta.rest']);
    assert.match(correos[0].body.subject, /^\[SOMBRA → a\*\*\*@ejemplo\.test\] Se liberó una mesa · 05\/11 19:00$/);
    assert.match(correos[0].body.text, /^Hola Ana,[\s\S]*Fecha: jueves 5 de noviembre\nHora: 19:00\nMesa para: 2 personas[\s\S]*Reservar esta mesa: https:\/\/www\.rosanta\.rest\/reservas/);
    assert.ok(!JSON.stringify(e).includes('ana@ejemplo.test'), 'la tabla de envios no guarda el correo');

    // IDEMPOTENCIA: el mismo gancho otra vez (reintento, doble clic) no avisa a nadie mas ni manda otro correo
    const n = s.net.llamadas.length;
    const vista = require('../src/reservas/ganchos').vista(await s.motor.porId(rv.id));
    assert.deepStrictEqual(await s.espera.alLiberar(vista, 'cancelada', {}), { ya_avisado: a.id });
    await Promise.all([s.espera.alLiberar(vista, 'cancelada', {}), s.espera.alLiberar(vista, 'cancelada', {})]);
    assert.strictEqual(s.net.llamadas.length, n);
    assert.strictEqual((await s.filas()).find((x) => x.email === 'beto@ejemplo.test').estado, 'esperando');
    assert.strictEqual((await s.envios()).length, 1);

    // otra liberacion (se MUEVE una reserva de las 20:00 a las 21:00): le toca a Beto, en ingles
    const r2 = await s.reservar('20:00', 2, { email: 'otro@ejemplo.test', telefono: '+50255550001' });
    const m = await s.pedir('POST', '/api/reservas/equipo/reservas/' + r2.id + '/cambiar', { hora: '21:00' }, { 'x-rosanta-u': 'tok-dueno' });
    assert.strictEqual(m.status, 200);
    const b2 = (await s.filas()).find((x) => x.email === 'beto@ejemplo.test');
    assert.deepStrictEqual([b2.estado, b2.aviso_hora, b2.aviso_por], ['avisado', '20:00', 'cambiada:' + r2.id + ':v2']);
    assert.ok(s.net.llamadas.some((x) => /A table opened up · Nov 5 8:00 pm$/.test(x.body.subject)));
    // la del horario imposible sigue esperando; y un cambio que no libera nada (solo una nota) no avisa
    await s.pedir('POST', '/api/reservas/equipo/reservas/' + r2.id + '/cambiar', { nota_equipo: 'ventana' }, { 'x-rosanta-u': 'tok-dueno' });
    assert.strictEqual((await s.envios()).length, 2);
    assert.strictEqual((await s.filas())[0].estado, 'esperando');
    assert.ok(!s.log.some((l) => /lista de espera · (cancelada|cambiada):/.test(l)), s.log.join('\n'));
  } finally { await s.cerrar(); }
});

test('si Resend falla, el aviso queda en la cola y el reintento lo manda (lee a la persona de la lista); con avisos apagados no avisa', async () => {
  const s = await montar();
  try {
    const rv = await s.reservar('19:00', 2);
    await s.pedir('POST', '/api/reservas/lista-espera', PERSONA, WEB);
    s.net.fallar.resend = true;
    await s.pedir('POST', '/api/reservas/equipo/reservas/' + rv.id + '/estado', { estado: 'cancelada' }, { 'x-rosanta-u': 'tok-dueno' });
    assert.deepStrictEqual((await s.envios()).map((x) => x.estado), ['fallo']);
    s.net.fallar.resend = false;
    s.reloj.t += 5 * 60000;
    await s.avisos.procesarPendientes();
    assert.deepStrictEqual((await s.envios()).map((x) => x.estado), ['enviado']);
    // despues el equipo la marca como "ya reservo" desde el panel
    assert.strictEqual((await s.espera.marcar((await s.filas())[0].id, 'reservo', 'sala@ejemplo.test')).status, 200);
  } finally { await s.cerrar(); }
  const a = await montar({ avisos: 'apagado' });
  try {
    const rv = await a.reservar('19:00', 2);
    await a.pedir('POST', '/api/reservas/lista-espera', PERSONA, WEB);
    await a.pedir('POST', '/api/reservas/equipo/reservas/' + rv.id + '/estado', { estado: 'cancelada' }, { 'x-rosanta-u': 'tok-dueno' });
    assert.deepStrictEqual((await a.filas()).map((x) => x.estado), ['esperando'], 'el equipo avisa a mano desde el panel');
    assert.strictEqual(a.net.llamadas.length, 0);
  } finally { await a.cerrar(); }
});

test('panel de Sala: la lista del dia y marcar avisado / ya reservo (permisos de reservas)', async () => {
  const s = await montar({ avisos: 'apagado' });
  try {
    const id = (await s.pedir('POST', '/api/reservas/lista-espera', PERSONA, WEB)).body.id;
    const id2 = (await s.pedir('POST', '/api/reservas/lista-espera', Object.assign({}, PERSONA, { email: 'beto@ejemplo.test', nombre: 'Beto' }), WEB)).body.id;
    assert.strictEqual((await s.pedir('GET', '/api/reservas/equipo/lista-espera?fecha=' + FECHA)).status, 401);
    // cocina ve cuantos vienen (reservas: ver) pero no marca nada
    assert.strictEqual((await s.pedir('GET', '/api/reservas/equipo/lista-espera?fecha=' + FECHA, undefined, { 'x-rosanta-u': 'tok-chef' })).status, 200);
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id + '/estado', { estado: 'avisado' }, { 'x-rosanta-u': 'tok-chef' })).status, 403);
    const l = await s.pedir('GET', '/api/reservas/equipo/lista-espera?fecha=' + FECHA, undefined, { 'x-rosanta-u': 'tok-sala' });
    assert.strictEqual(l.status, 200);
    assert.deepStrictEqual(l.body.lista.map((x) => [x.id, x.nombre, x.desde, x.hasta, x.personas, x.estado, x.email]),
      [[id, 'Ana Espera', '18:00', '21:00', 2, 'esperando', 'ana@ejemplo.test'], [id2, 'Beto', '18:00', '21:00', 2, 'esperando', 'beto@ejemplo.test']]);
    const sala = { 'x-rosanta-u': 'tok-sala' };
    const av = await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id + '/estado', { estado: 'avisado' }, sala);
    assert.deepStrictEqual([av.status, av.body.item.estado, av.body.item.aviso_automatico, !!av.body.item.avisado], [200, 'avisado', false, true]);
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id + '/estado', { estado: 'reservo' }, sala)).body.item.estado, 'reservo');
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id + '/estado', { estado: 'avisado' }, sala)).status, 409, 'ya reservo');
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id2 + '/estado', { estado: 'borrar' }, sala)).status, 400);
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/999/estado', { estado: 'avisado' }, sala)).status, 404);
    assert.strictEqual((await s.pedir('POST', '/api/reservas/equipo/lista-espera/' + id2 + '/estado', { estado: 'reservo', reserva_id: 'no-existe' }, sala)).status, 400);
    const f = (await s.filas()).find((x) => x.id === id);
    assert.strictEqual(f.actualizada_por, 'sala@ejemplo.test');
  } finally { await s.cerrar(); }
});

test('el panel trae la pestaña "Lista de espera" escondida (aparece solo si la ruta existe) y su JS es valido', () => {
  const h = fs.readFileSync(path.join(__dirname, '../reservas/panel.html'), 'utf8');
  assert.match(h, /<button data-v="espera" id="tabEspera" hidden>Lista de espera<\/button>/);
  const js = h.split('<script>')[1].split('</script>')[0];
  assert.doesNotThrow(() => new Function(js));   // eslint-disable-line no-new-func
  assert.match(js, /\/lista-espera\?fecha=' \+ hoyGT\(\)\)\.then\(function \(\) \{ \$\('tabEspera'\)\.hidden = false; \}\)/);
});
