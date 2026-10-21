// El panel de reseñas en vivo en rosanta-nube (22-oct-2026): la pantalla real, la matriz y las acciones por resenas-vivo.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const RP = require('../src/resenas-panel');
const U = require('../src/usuarios');
const permisos = require('../src/permisos');

const M = permisos.cargarDeMigracion();
const DUENO = 'enlace-del-dueno-123456', OTRO = 'enlace-de-cocina-123456';
function base() {
  return { query: async (sql, p) => {
    if (/FROM usuarios WHERE token_huella/.test(sql)) {
      if (p[0] === U.huellaToken(DUENO)) return { rows: [{ email: 'restaurante@rosanta.rest', rol: 'Dueño', nombre: 'Dueño' }] };
      if (p[0] === U.huellaToken(OTRO)) return { rows: [{ email: 'cocina@rosanta.rest', rol: 'Cocina', nombre: 'Cocina' }] };
      return { rows: [] };
    }
    if (/FROM resenas_gbp_google g/.test(sql)) return { rows: [
      { review_id: 'g1', estrellas: 5, cliente: 'Ana', resena: 'Rico', t: new Date('2026-10-20T10:00:00Z'), respuesta: 'Ana, gracias.', borrador: null, estado: null },
      { review_id: 'g2', estrellas: 2, cliente: 'Leo', resena: 'Lento', t: new Date('2026-10-19T10:00:00Z'), respuesta: '', borrador: 'Leo, lo sentimos.', estado: 'PENDIENTE_APROBAR' },
      { review_id: 'g3', estrellas: 4, cliente: 'Sol', resena: 'Bien', t: new Date('2026-10-18T10:00:00Z'), respuesta: '', borrador: 'Sol, gracias.', estado: 'PUBLICADA_APROBADA' }] };
    if (/tarea = 'leer-google'/.test(sql)) return { rows: [{ resumen: { promedio: 4.8, total_google: 451 } }] };
    throw new Error('consulta inesperada: ' + sql.slice(0, 50));
  } };
}
async function servir(deps, fn) {
  const app = express(); app.use(express.json());
  RP.montarPanel(app, Object.assign({ pool: base(), matriz: M }, deps));
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const llamar = (b, n, args, u) => fetch(b + '/api/resenas/' + n, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': u }, body: JSON.stringify(args || []) });

test('Panel en vivo: la pantalla es la del panel de siempre, con la paleta y el traductor a /api/resenas; solo el dueño entra', async () => {
  await servir({}, async (b) => {
    const h = await (await fetch(b + '/clientes/resenas?u=' + DUENO + '&dentro=1')).text();
    assert.match(h, /Aprobar y publicar/);
    assert.match(h, /\/api\/resenas\//);
    assert.match(h, /--fondo/);   // paleta()
    assert.doesNotMatch(h, /TripAdvisor/);
    assert.strictEqual((await fetch(b + '/clientes/resenas?u=' + OTRO)).status, 403);
    assert.strictEqual((await fetch(b + '/clientes/resenas')).status, 401);
  });
});

test('Panel en vivo: getDatosDashboard sale de la base (451 de Google; lo recien publicado por la nube ya se ve como respondido)', async () => {
  await servir({}, async (b) => {
    const d = (await (await llamar(b, 'getDatosDashboard', [], DUENO)).json()).resultado;
    assert.strictEqual(d.total, 451);
    assert.strictEqual(d.average, 4.8);
    assert.strictEqual(d.reviews.find((r) => r.id === 'g2').borrador, 'Leo, lo sentimos.');
    assert.strictEqual(d.reviews.find((r) => r.id === 'g3').hasReply, true);
    assert.strictEqual((await llamar(b, 'getDatosDashboard', [], OTRO)).status, 403);
  });
});

test('Panel en vivo: publicar va a resenas-vivo.publicarDesdePanel; sin vivo o en puente, 409; funciones raras, 404', async () => {
  const llamadas = [];
  const vivo = { publicarDesdePanel: async (id, t) => { llamadas.push([id, t]); return { ok: true, estado: 'PUBLICADA_APROBADA' }; },
    guardarBorrador: async () => { throw Object.assign(new Error('Las reseñas todavía las maneja Apps Script (interruptor en puente).'), { status: 409 }); } };
  await servir({ vivo }, async (b) => {
    const r = await llamar(b, 'publicarDesdePanel', ['g2', 'Leo, lo sentimos. Escríbenos a restaurante@rosanta.rest.'], DUENO);
    assert.strictEqual((await r.json()).resultado.estado, 'PUBLICADA_APROBADA');
    assert.deepStrictEqual(llamadas, [['g2', 'Leo, lo sentimos. Escríbenos a restaurante@rosanta.rest.']]);
    assert.strictEqual((await llamar(b, 'guardarBorrador', ['g2', 'x'], DUENO)).status, 409);
    assert.strictEqual((await llamar(b, 'publicarDesdePanel', ['g2', 'x'], OTRO)).status, 403);
    assert.strictEqual((await llamar(b, 'publicarAprobadas', [], DUENO)).status, 404);
  });
  await servir({}, async (b) => assert.strictEqual((await llamar(b, 'publicarDesdePanel', ['g2', 'x'], DUENO)).status, 409));
});
