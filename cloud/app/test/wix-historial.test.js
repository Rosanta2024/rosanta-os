// Pruebas del importador del historial de Wix (sin red ni base). node --test test/wix-historial.test.js
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/wix-historial');

const UB = {
  id: 'loc1', location: { name: 'Rosanta' }, revision: '7',
  configuration: {
    tableManagement: {
      tableDefinitions: [{ id: 't1', name: 'Pergola3', seatsMin: 2, seatsMax: 4, isActive: true }],
      deletedTableDefinitions: [{ id: 't9', name: 'Vieja', seatsMin: 1, seatsMax: 2 }]
    },
    reservationForm: { customFieldDefinitions: [{ id: 'cfA', name: 'Alergias' }, { id: 'cfZ', name: '¿Dónde te quieres sentar?' }] }
  }
};
const R = {
  id: 'r1', status: 'RESERVED', source: 'ONLINE', revision: '3',
  details: { reservationLocationId: 'loc1', startDate: '2026-11-01T01:00:00Z', endDate: '2026-11-01T03:00:00Z', partySize: 4, tables: { ids: ['t1', 't9'] } },
  reservee: { firstName: 'Ana', lastName: 'B', email: ' Ana@X.com ', phone: '+50255551234', marketingConsent: true,
    customFields: { cfA: 'Nueces', cfZ: 'Pergola', '88cadd96-c92b-40c4-8ef2-d0d2ad67acb5': 'si', 'bf07b3fc-04f2-4851-9a91-0ec9575ab099': 'Q1,250.50' } },
  teamMessage: 'Aniversario', createdDate: '2026-10-20T14:05:00Z', updatedDate: '2026-10-20T14:05:00Z', paymentStatus: 'FREE', archived: false
};

test('solo deja salir las dos llamadas de lectura', () => {
  assert.ok(H.permitida('POST', H.URL_QUERY));
  assert.ok(H.permitida('GET', H.URL_UBICACIONES + '?fieldsets=FULL'));
  assert.ok(!H.permitida('PATCH', 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/r1'));
  assert.ok(!H.permitida('POST', 'https://www.wixapis.com/table-reservations/reservations/v1/reservations'));
  assert.ok(!H.permitida('GET', H.URL_QUERY));
  return assert.rejects(H.llamarWix({ llave: 'x', sitio: 'y' }, 'DELETE', H.URL_QUERY), /NO permitida/);
});

test('mesas vigentes y borradas, con su nombre', () => {
  const m = H.mesasDeUbicacion(UB);
  assert.deepStrictEqual(m.map((x) => [x.id, x.nombre, x.borrada]), [['t1', 'Pergola3', false], ['t9', 'Vieja', true]]);
});

test('normaliza una reserva con todos sus campos', () => {
  const f = H.normalizarReserva(R, { t1: 'Pergola3', t9: 'Vieja' }, H.camposDeUbicacion(UB));
  assert.strictEqual(f.email, 'ana@x.com');
  assert.deepStrictEqual(f.mesa_nombres, ['Pergola3', 'Vieja']);
  assert.strictEqual(f.campos['Alergias'], 'Nueces');
  assert.strictEqual(f.campos['¿Dónde te quieres sentar?'], 'Pergola');
  assert.strictEqual(f.optin, 'SI');
  assert.strictEqual(f.consumo_q, 1250.5);
  assert.strictEqual(f.notas_equipo, 'Aniversario');
  assert.strictEqual(f.personas, 4);
  assert.strictEqual(f.revision, 3);
  assert.strictEqual(f.huella, H.huella(R));
});

test('la huella no depende del orden de las llaves', () => {
  assert.strictEqual(H.huella({ a: 1, b: { c: 2, d: 3 } }), H.huella({ b: { d: 3, c: 2 }, a: 1 }));
});

test('detecta los cambios entre dos corridas', () => {
  const a = H.normalizarReserva(R, {}, {});
  const b = H.normalizarReserva(Object.assign({}, R, { status: 'CANCELED', details: Object.assign({}, R.details, { partySize: 2 }) }), {}, {});
  assert.deepStrictEqual(H.diferencias(a, b).sort(), ['estado', 'personas']);
  assert.deepStrictEqual(H.diferencias(a, a), []);
  // la base devuelve fechas como Date y numeric como texto: no cuenta como cambio
  const comoBase = Object.assign({}, a, { inicio: new Date(a.inicio), consumo_q: '1250.50' });
  const conConsumo = H.normalizarReserva(R, {}, H.camposDeUbicacion(UB));
  assert.ok(!H.diferencias(Object.assign({}, conConsumo, { inicio: new Date(conConsumo.inicio), consumo_q: '1250.50' }), conConsumo).length);
  assert.ok(comoBase);
});

test('ventanas de un mes cubren todo el rango sin huecos', () => {
  const v = H.ventanas('2026-01-15', '2026-04-01');
  assert.strictEqual(v[0][0], '2026-01-15T00:00:00.000Z');
  for (let i = 1; i < v.length; i++) assert.strictEqual(v[i][0], v[i - 1][1]);
  assert.strictEqual(v[v.length - 1][1], '2026-04-01T00:00:00.000Z');
  assert.throws(() => H.ventanas('2026-05-01', '2026-01-01'));
});

test('compara con Marketing OS y el CRM sin datos personales', () => {
  const f1 = H.normalizarReserva(R, {}, {});
  const f2 = H.normalizarReserva(Object.assign({}, R, { id: 'r2', status: 'CANCELED', reservee: { firstName: 'C', phone: '+50211112222' } }), {}, {});
  const c = H.comparar([f1, f2], [{ llave: 'r1', estado: 'reserved' }, { llave: 'r3', estado: 'RESERVED' }], new Set(['e:ana@x.com']));
  assert.strictEqual(c.marketing.en_ambos, 1);
  assert.strictEqual(c.marketing.solo_wix, 1);
  assert.deepStrictEqual(c.marketing.ids_solo_marketing, ['r3']);
  assert.strictEqual(c.marketing.estado_distinto, 0);
  assert.deepStrictEqual(c.crm, { personas_en_crm: 1, personas_fuera_del_crm: 1, reservas_sin_contacto: 0 });
  assert.ok(!JSON.stringify(c).includes('ana@x.com'));
});

test('ids creados o cambiados en la ventana de Fase 2 (20-oct 7:58–8:26 GT)', () => {
  const f = H.normalizarReserva(R, {}, {});
  const fuera = H.normalizarReserva(Object.assign({}, R, { id: 'r5', createdDate: '2026-10-19T10:00:00Z', updatedDate: '2026-10-19T10:00:00Z' }), {}, {});
  const v = H.idsEnVentana([f, fuera], '2026-10-20T07:58:00-06:00', '2026-10-20T08:26:59-06:00');
  assert.deepStrictEqual(v.ids, ['r1']);
});

test('el resumen no lleva nombres, correos ni telefonos', () => {
  const s = JSON.stringify(H.resumir([H.normalizarReserva(R, {}, H.camposDeUbicacion(UB))]));
  assert.ok(!/Ana|ana@x|5555/.test(s));
});

test('lee todo con cursores, junta ventanas y pasada completa sin duplicar, y no escribe en Wix', async () => {
  const todas = Array.from({ length: 230 }, (_, i) => ({ id: 'x' + i, status: 'RESERVED', details: { startDate: new Date(Date.UTC(2026, i % 12, 5)).toISOString(), partySize: 2 }, reservee: {} }));
  todas.push({ id: 'sinfecha', status: 'CANCELED', details: {}, reservee: {} });   // solo la ve la pasada completa
  const llamadas = [];
  const viejo = global.fetch;
  global.fetch = async (url, o) => {
    llamadas.push(o.method + ' ' + url.split('?')[0]);
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (o.method === 'GET') return ok({ reservationLocations: [UB], pagingMetadata: { hasNext: false } });
    const q = JSON.parse(o.body).query;
    let lista = todas;
    const st = q.filter && q.filter['details.startDate'];
    if (st) lista = todas.filter((r) => r.details.startDate && r.details.startDate >= st.$gte && r.details.startDate < st.$lt);
    const desde = q.cursorPaging.cursor ? Number(q.cursorPaging.cursor.split(':')[1]) : 0;
    const clave = q.cursorPaging.cursor ? q.cursorPaging.cursor.split(':')[0] : JSON.stringify(q.filter || {});
    if (q.cursorPaging.cursor) lista = global.__cache[clave];
    global.__cache = global.__cache || {}; global.__cache[clave] = lista;
    const pag = lista.slice(desde, desde + 100);
    const hasNext = desde + 100 < lista.length;
    return ok({ reservations: pag, pagingMetadata: { hasNext, cursors: { next: hasNext ? clave + ':' + (desde + 100) : null } } });
  };
  try {
    const r = await H.importar({ cred: { llave: 'k', sitio: 's' }, pool: null, desde: '2026-01-01', hasta: '2027-01-01' });
    assert.strictEqual(r.resumen.total, 231);
    assert.strictEqual(r.resumen.en_ventanas, 230);
    assert.strictEqual(r.resumen.mesas, 2);
    assert.ok(llamadas.every((l) => l.startsWith('POST https://www.wixapis.com/table-reservations/reservations/v1/reservations/query') || l.startsWith('GET https://www.wixapis.com/table-reservations/reservation-locations/v1/reservation-locations')));
  } finally { global.fetch = viejo; }
});
