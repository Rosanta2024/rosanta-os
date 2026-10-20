// Reseñas en vivo desde la nube (21-oct-2026): solo con el interruptor en 'base'. Google y Claude de mentira.
const test = require('node:test');
const assert = require('node:assert');
const V = require('../src/resenas-vivo');

function base(modo, filas) {
  const t = new Map((filas || []).map((f) => [f.review_id, f]));
  const corridas = [];
  return { t, corridas, query: async (sql, p) => {
    if (/FROM interruptores/.test(sql)) return { rows: modo ? [{ modo }] : [] };
    if (/SELECT review_id FROM resenas_gbp$/.test(sql.trim())) return { rows: Array.from(t.keys()).map((review_id) => ({ review_id })) };
    if (/FROM resenas_gbp WHERE review_id/.test(sql)) return { rows: t.has(p[0]) ? [t.get(p[0])] : [] };
    if (/INSERT INTO resenas_gbp/.test(sql)) { t.set(p[0], { review_id: p[0], estrellas: p[1], cliente: p[2], resena: p[3], respuesta: p[4], estado: p[5], aprobar: p[6] }); return { rowCount: 1 }; }
    if (/INSERT INTO resenas_corridas/.test(sql)) { corridas.push(Object.assign({ ok: p[1] }, JSON.parse(p[2]))); return { rowCount: 1 }; }
    throw new Error('consulta inesperada: ' + sql.slice(0, 50));
  } };
}
const FICHA = { cuenta: '1', ubicacion: '2' };
function falsos(google, opciones) {
  const o = opciones || {};
  const publicadas = [];
  const lector = { resenas: async () => ({ reviews: google, ficha: FICHA }), gbpGet: async () => ({}) };
  const publicador = { publicar: async (f, id, texto) => { if (o.falla) throw new Error('503'); publicadas.push({ id, texto }); return texto; },
    una: async (f, id) => (o.yaRespondida === id ? { reviewReply: { comment: 'puesta por Apps Script' } } : {}) };
  const borrador = { redactar: async (r) => (r.estrellas >= 4 ? { texto: 'Gracias, ' + r.cliente + '.', confiable: true, decision: 'publicar_sola' }
    : { texto: 'Lo sentimos.', confiable: true, decision: 'aprobar' }) };
  return { lector, publicador, borrador, publicadas };
}
const g = (id, estrellas, respuesta) => ({ review_id: id, estrellas, cliente: 'C' + id, resena: 'x', respuesta: respuesta || '' });

test('Vivo: con el interruptor en puente (o sin fila) no lee ni publica nada', async () => {
  for (const modo of [null, 'puente']) {
    const f = falsos([g('a', 5)]);
    const pool = base(modo);
    const v = V.crearResenasVivo(Object.assign({ pool, claveClaude: 'k' }, f));
    assert.strictEqual((await v.procesar()).modo, 'puente');
    assert.strictEqual(f.publicadas.length, 0);
    await assert.rejects(v.publicarDesdePanel('a', 'hola'), (e) => e.status === 409);
  }
});

test('Vivo: 4-5 se publican solas, 1-3 a aprobacion con correo, las ya respondidas no se tocan', async () => {
  const f = falsos([g('a', 5), g('b', 2), g('c', 4, 'ya tenia'), g('d', 5), g('viejo', 5)], { yaRespondida: 'd' });
  const pool = base('base', [{ review_id: 'viejo', estado: 'PUBLICADA_AUTO' }]);
  const avisos = [];
  const v = V.crearResenasVivo(Object.assign({ pool, claveClaude: 'k', avisar: async (a, c) => avisos.push({ a, c }), urlPanel: 'https://panel' }, f));
  const r = await v.procesar();
  assert.strictEqual(r.nuevas, 4);
  assert.strictEqual(r.auto, 1);
  assert.deepStrictEqual(f.publicadas.map((x) => x.id), ['a']);
  assert.strictEqual(pool.t.get('a').estado, 'PUBLICADA_AUTO');
  assert.strictEqual(pool.t.get('b').estado, 'PENDIENTE_APROBAR');
  assert.strictEqual(pool.t.get('c').estado, 'YA_TENIA_RESPUESTA');
  assert.strictEqual(pool.t.get('d').estado, 'YA_TENIA_RESPUESTA');   // Apps Script la contesto mientras tanto: no se pisa
  assert.strictEqual(avisos.length, 1);
  assert.match(avisos[0].c, /2★ de Cb/);
  assert.doesNotMatch(avisos[0].c, /Juanma/);
  assert.strictEqual(pool.corridas.at(-1).ok, true);
});

test('Vivo: si Google falla al publicar, la fila no queda diciendo que se publico', async () => {
  const f = falsos([g('a', 5)], { falla: true });
  const pool = base('base');
  const r = await V.crearResenasVivo(Object.assign({ pool, claveClaude: 'k' }, f)).procesar();
  assert.strictEqual(r.errores.length, 1);
  assert.strictEqual(pool.t.has('a'), false);
  assert.strictEqual(pool.corridas.at(-1).ok, false);
});

test('Vivo: el panel publica, guarda, regenera y descarta sobre la base', async () => {
  const f = falsos([]);
  const pool = base('base', [{ review_id: 'b', estrellas: 2, cliente: 'Leo', resena: 'x', respuesta: 'borrador', estado: 'PENDIENTE_APROBAR' }]);
  const v = V.crearResenasVivo(Object.assign({ pool, claveClaude: 'k', gbp: { oauth: {}, cuenta: '1', ubicacion: '2' } }, f));
  assert.strictEqual((await v.guardarBorrador('b', 'Otro texto.')).estado, 'PENDIENTE_APROBAR');
  assert.strictEqual(pool.t.get('b').respuesta, 'Otro texto.');
  assert.strictEqual((await v.regenerarBorrador('b')).texto, 'Lo sentimos.');
  const p = await v.publicarDesdePanel('b', 'Leo, lo sentimos. Escríbenos a restaurante@rosanta.rest.');
  assert.strictEqual(p.estado, 'PUBLICADA_APROBADA');
  assert.deepStrictEqual(f.publicadas.map((x) => x.id), ['b']);
  assert.strictEqual((await v.guardarBorrador('b', 'cambio')).estado, 'PUBLICADA_APROBADA');   // guardar no la devuelve a pendiente
  assert.strictEqual((await v.descartarBorrador('b')).estado, 'NO_RESPONDER');
  await assert.rejects(v.publicarDesdePanel('b', '   '), (e) => e.status === 400);
  await assert.rejects(v.publicarDesdePanel('zzz', 'hola'), (e) => e.status === 404);
  assert.throws(() => V.validarTexto('x'.repeat(4001)), /tope de Google/);
});
