// Rutas internas para rosanta-web (20-oct-2026): contrato acordado con el equipo "Web propia sin Wix".
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const W = require('../src/vivo-clientes/web');
const { crearAppVivo } = require('../src/vivo-clientes/app');

const CLAVE = 'clave-de-tareas-larga';
const RESERVA = { id: 'wix-abc-123', fecha: '2026-11-12', nombre: 'Ana López', email: 'ana@gmail.com', telefono: '+50255551234', personas: 2, gasto: 0, estado: 'RESERVED', optin: 'SI' };
const CAPI = { evento: 'NewReservation', event_id: 'wix-abc-123', event_time: 1793000000, event_source_url: 'https://www.rosanta.rest/reservas',
  user: { email: 'Ana@Gmail.com', phone: '+502 5555 1234', firstName: 'Ana', lastName: 'López', externalId: 'c-9' }, fuente_trafico: { utm_source: 'ig' }, origen: 'web' };
const ADV = { id: 41, tipo: 'adventure', experiencia: 'acatenango', titulo: 'Volcán Acatenango', operador: 'Operador X', codigo_referido: 'OPX1',
  nombre: 'Tom Smith', email: 'tom@gmail.com', telefono: null, idioma: 'en', fecha: '2026-11-20', personas: 3, mensaje: 'Sunrise please',
  cena: { fecha: '2026-11-21', hora: '19:00', personas: 3 }, origen: { utm_source: 'operador' } };

function armar(modos) {
  const anotados = [], llamadas = [];
  const pool = { query: async (sql, a) => {
    if (/FROM interruptores/.test(sql)) return { rows: modos[a[0]] ? [{ modo: modos[a[0]] }] : [] };
    if (/INSERT INTO hooks_wix_recibidos/.test(sql)) { anotados.push({ hook: a[0], modo: a[2], estado: a[3] }); return { rows: [] }; }
    throw new Error('consulta no esperada ' + sql);
  } };
  const crm = { estado: () => ({}), atender: async (h, c, o) => { llamadas.push(['crm', h, c, o]); return { estado: 200, json: { ok: true, id: c.id } }; } };
  const vivo = { estado: () => ({}), hook: async (b) => { llamadas.push(['pipeline', b]); return { ok: true, versiones: {} }; } };
  const capiReserva = async (c) => { llamadas.push(['capi', c]); return 'enviado'; };
  const app = crearAppVivo({ pool, vivo, crm, capiReserva, claveTareas: CLAVE, hoy: () => '2026-11-09' });
  return { app, anotados, llamadas };
}
async function servir(modos, fn) {
  const a = armar(modos); const srv = a.app.listen(0);
  const post = (ruta, cuerpo, clave) => fetch('http://127.0.0.1:' + srv.address().port + '/interno/web/' + ruta, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, clave === null ? {} : { 'x-rosanta-tarea': clave || CLAVE }), body: JSON.stringify(cuerpo) });
  try { return await fn(post, a); } finally { srv.close(); }
}

test('Web, en sombra (por defecto): 202 { sombra: true }, se anota y NO escribe ni manda nada', async () => {
  await servir({}, async (post, a) => {
    let r = await post('crm-reserva', RESERVA);
    assert.strictEqual(r.status, 202); assert.deepStrictEqual(await r.json(), { sombra: true });
    r = await post('capi', CAPI); assert.strictEqual(r.status, 202); assert.deepStrictEqual(await r.json(), { sombra: true, prueba: false });
    r = await post('pipeline-adventure', ADV); assert.strictEqual(r.status, 202);
    assert.deepStrictEqual(await r.json(), { sombra: true, id: 'sombra-adventure-acatenango-41' });
    assert.strictEqual(a.llamadas.length, 0, 'ni Marketing OS, ni Meta, ni el pipeline');
    assert.deepStrictEqual(a.anotados.map((x) => [x.hook, x.modo, x.estado]), [['web-crm-reserva', 'sombra', 202], ['web-capi', 'sombra', 202], ['web-pipeline-adventure', 'sombra', 202]]);
  });
});

test('Web, en base: crm-reserva pasa por el camino de /hooks/reserva (sin pedir hooks_reserva); capi manda; adventure crea la fila', async () => {
  await servir({ web_reservas: 'base', web_capi: 'base', web_adventures: 'base' }, async (post, a) => {
    let r = await post('crm-reserva', RESERVA);
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { ok: true, id: 'wix-abc-123' });
    assert.deepStrictEqual(a.llamadas[0], ['crm', 'reserva', RESERVA, { interruptor: false }]);
    r = await post('capi', CAPI); assert.deepStrictEqual(await r.json(), { ok: true, capi: 'enviado' });
    r = await post('pipeline-adventure', ADV);
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { id: 'adventure-acatenango-41' });
    const w = a.llamadas[2][1].writes[0];
    assert.strictEqual(w.id, 'adventure-acatenango-41');
    assert.strictEqual(w.data.evento, 'Adventure: Volcán Acatenango'); assert.strictEqual(w.data.canal_detalle, 'adventures');
    assert.strictEqual(w.data.fecha_evento, '2026-11-20'); assert.strictEqual(w.data.pax, 3); assert.strictEqual(w.data.notas, 'Sunrise please');
    const x = JSON.parse(w.data.extra_json);
    assert.strictEqual(x.tipo, 'adventure'); assert.deepStrictEqual(x.fechas, ['2026-11-20']); assert.deepStrictEqual(x.cena_combinada, ADV.cena); assert.strictEqual(x.referido, 'OPX1');
  });
});

test('Web: las pruebas internas no van a Meta; un reintento del mismo lead devuelve el mismo id', async () => {
  await servir({ web_capi: 'base', web_adventures: 'base' }, async (post, a) => {
    const r = await post('capi', Object.assign({}, CAPI, { user: Object.assign({}, CAPI.user, { email: 'prueba-bot@rosanta.rest' }) }));
    assert.deepStrictEqual(await r.json(), { ok: true, omitido: 'reserva de prueba' });
    assert.strictEqual(a.llamadas.length, 0);
  });
  const a = armar({ web_adventures: 'base' });
  a.app.locals = {};
  const vivo2 = { estado: () => ({}), hook: async () => ({ ok: false, error: 'falta if_version para una fila que ya existe', id: 'adventure-acatenango-41' }) };
  const app = crearAppVivo({ pool: { query: async (s, x) => (/interruptores/.test(s) ? { rows: [{ modo: 'base' }] } : { rows: [] }) }, vivo: vivo2, crm: { estado: () => ({}) }, claveTareas: CLAVE });
  const srv = app.listen(0);
  try {
    const r = await fetch('http://127.0.0.1:' + srv.address().port + '/interno/web/pipeline-adventure', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': CLAVE }, body: JSON.stringify(ADV) });
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { id: 'adventure-acatenango-41' });
  } finally { srv.close(); }
});

test('Web: clave, forma fija (campos de mas → 400), interruptor apagado → 409', async () => {
  await servir({ web_reservas: 'apagado' }, async (post, a) => {
    assert.strictEqual((await post('crm-reserva', RESERVA, null)).status, 403);
    assert.strictEqual((await post('crm-reserva', RESERVA, 'otra')).status, 403);
    assert.strictEqual((await post('crm-reserva', Object.assign({ tab: 'x' }, RESERVA))).status, 400);
    assert.strictEqual((await post('crm-reserva', Object.assign({}, RESERVA, { estado: 'BORRAR' }))).status, 400);
    assert.strictEqual((await post('crm-reserva', RESERVA)).status, 409);
    assert.strictEqual((await post('capi', Object.assign({}, CAPI, { event_id: '' }))).status, 400);
    assert.strictEqual((await post('capi', Object.assign({}, CAPI, { evento: 'Purchase' }))).status, 400);
    const sinUna = Object.assign({}, ADV); delete sinUna.origen;
    assert.strictEqual((await post('pipeline-adventure', sinUna)).status, 400, 'van las 15 llaves');
    assert.strictEqual((await post('pipeline-adventure', Object.assign({}, ADV, { email: 'Tom@Gmail.com' }))).status, 400, 'correo en minusculas');
    assert.strictEqual((await post('pipeline-adventure', Object.assign({}, ADV, { fecha: ['2026-11-20'] }))).status, 400, 'una sola fecha');
    assert.strictEqual((await post('otra-cosa', {})).status, 404);
    assert.strictEqual(a.llamadas.length, 0);
  });
});

test('CAPI de la web: el mismo hash que capi.js de Wix (correo en minusculas, telefono solo digitos)', () => {
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const ev = W.eventoReserva(W.limpiarCapi(CAPI).cuerpo).data[0];
  assert.strictEqual(ev.event_name, 'NewReservation'); assert.strictEqual(ev.event_id, 'wix-abc-123'); assert.strictEqual(ev.action_source, 'website');
  assert.deepStrictEqual(ev.user_data.em, [sha('ana@gmail.com')]);
  assert.deepStrictEqual(ev.user_data.ph, [sha('50255551234')]);
  assert.deepStrictEqual(ev.user_data.fn, [sha('ana')]); assert.deepStrictEqual(ev.user_data.external_id, [sha('c-9')]);
  assert.ok(!('fuente_trafico' in ev) && !('origen' in ev), 'la fuente del trafico no va a Meta');
});

const COT = { id: '3f2b6c1e-9a4d-4e2b-8c1f-0a9b8c7d6e5f', tipo: 'evento', tipo_evento: 'boda', nombre: 'Laura Pérez', email: 'laura@gmail.com',
  telefono: '+1 555 0100', idioma: 'es', fecha: '2027-02-14', personas: 60, menu: 'degustacion', presupuesto: 'Q40,000', mensaje: 'Jardín, de noche', origen: { utm_source: 'google' } };

test('pipeline-cotizacion ("Request a quote"): sombra 202 con id provisional; base crea la fila con presupuesto y menú en sus columnas', async () => {
  await servir({}, async (post, a) => {
    const r = await post('pipeline-cotizacion', COT);
    assert.strictEqual(r.status, 202);
    assert.deepStrictEqual(await r.json(), { sombra: true, id: 'sombra-cotizacion-web-' + COT.id });
    assert.strictEqual(a.llamadas.length, 0);
  });
  await servir({ web_cotizaciones: 'base' }, async (post, a) => {
    const r = await post('pipeline-cotizacion', COT);
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { id: 'cotizacion-web-' + COT.id });
    const w = a.llamadas[0][1].writes[0];
    assert.strictEqual(w.data.evento, 'Cotización web: boda'); assert.strictEqual(w.data.canal_detalle, 'cotizacion');
    assert.strictEqual(w.data.presupuesto, 'Q40,000'); assert.strictEqual(w.data.formato_menu, 'degustacion'); assert.strictEqual(w.data.pax, 60);
    assert.strictEqual(w.data.fecha_evento, '2027-02-14'); assert.strictEqual(w.data.notas, 'Jardín, de noche');
    assert.deepStrictEqual(JSON.parse(w.data.extra_json), { tipo: 'evento', tipo_evento: 'boda', menu: 'degustacion', presupuesto: 'Q40,000', origen: { utm_source: 'google' }, web_id: COT.id });
  });
  await servir({ web_cotizaciones: 'apagado' }, async (post, a) => {
    assert.strictEqual((await post('pipeline-cotizacion', COT)).status, 409);
    for (const malo of [Object.assign({ extra: 1 }, COT), Object.assign({}, COT, { id: COT.id.toUpperCase() }), Object.assign({}, COT, { tipo_evento: 'fiesta' }),
      Object.assign({}, COT, { menu: 'pizza' }), Object.assign({}, COT, { email: 'Laura@gmail.com' }), Object.assign({}, COT, { fecha: ['2027-02-14'] })]) {
      assert.strictEqual((await post('pipeline-cotizacion', malo)).status, 400, JSON.stringify(malo).slice(0, 60));
    }
    const sin = Object.assign({}, COT); delete sin.presupuesto;
    assert.strictEqual((await post('pipeline-cotizacion', sin)).status, 400, 'van las 13 llaves');
    assert.strictEqual(a.llamadas.length, 0);
  });
});
