/**
 * Clientes › Bot y Clientes › Reseñas y encuesta, en sombra (19-oct-2026). Datos inventados.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { crearServicioClientes2, datosDesdeHoja, datosEncuesta, FUNCIONES, LEADS_ID, MKT_ID } = require('../src/clientes2/servicio');
const { GBP_ID, ENCUESTA_ID, PARTES, LIBROS } = require('../src/clientes2/partes');
const pant = require('../src/clientes2/pantallas');
const { DIR } = require('../src/clientes2/motor-gas');

const d = (s) => new Date(s);
function copiaDeMentira() {
  return { leida: d('2026-10-19T08:00:00-06:00'), libros: {
    [LEADS_ID]: {
      Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto'],
        [d('2026-10-18T19:00:00-06:00'), 'whatsapp', '50255501111', 'Ana', 'in', 'cliente', 'Hola, ¿tienen mesa?'],
        [d('2026-10-18T19:00:05-06:00'), 'whatsapp', '50255501111', 'Ana', 'out', 'bot', 'Sí, ¿para cuántos?'],
        [d('2026-10-18T20:00:00-06:00'), 'instagram', '999001', 'Luis', 'in', 'cliente', 'Hi!']],
      Fichas: [['clave', 'canal', 'contacto_id', 'nombre', 'email'], ['whatsapp|50255501111', 'whatsapp', '50255501111', 'Ana', 'ana@ejemplo.test']],
      Leads: [['Fecha/Hora']]
    },
    [MKT_ID]: { cotizaciones: [['id_chat', 'email', 'telefono', 'contacto', 'etapa', 'fecha_evento'], ['whatsapp|50255501111', '', '', '', 'cotizada', '2026-12-05']] },
    [GBP_ID]: {
      'Reseñas': [['Fecha detectada', 'ReviewId', 'Estrellas', 'Cliente', 'Reseña original', 'Respuesta (editable)', 'Estado', 'Aprobar (SI/NO)', 'Fecha publicada'],
        [d('2026-10-10T10:00:00-06:00'), 'r1', 5, 'Mia', 'Delicioso', 'Gracias Mia', 'PUBLICADA_AUTO', '', ''],
        [d('2026-10-12T10:00:00-06:00'), 'r2', 3, 'Leo', 'Lento', 'Gracias por contarnos', 'PENDIENTE_APROBAR', 'NO', '']],
      TripAdvisor: [['Fecha detectada', 'ReviewId', 'Estrellas', 'Cliente', 'Titulo', 'Reseña original', 'Respuesta sugerida', 'Estado', 'Respuesta en TripAdvisor', 'Fecha marcada', 'URL'],
        [d('2026-10-01T10:00:00-06:00'), 't1', 4, 'Sam', 'Nice', 'Good', 'Thanks', 'PENDIENTE', '', '', '']]
    },
    [ENCUESTA_ID]: { 'Encuesta 2026': [['Fecha', 'Calificación', '¿Qué podríamos mejorar?'], [d('2026-10-01'), 5, ''], [d('2026-10-02'), 3, 'La música']] }
  } };
}
const pool = { query: async () => ({ rows: [] }) };
const servicio = (puede) => crearServicioClientes2({ pool, copia: copiaDeMentira, puede: puede || (() => true) });

test('Clientes2: la consola y el panel de reseñas son copias exactas de sus proyectos de Apps Script', () => {
  const raiz = path.join(__dirname, '..', '..', '..', 'apps-script');
  if (!fs.existsSync(raiz)) return;
  [['consola-de-respuestas-rosanta', ['Code.js', 'Index.html']],
    ['panel-de-reseas-de-google', ['Bot de Reseñas de Google.js', 'PanelServidor.js', 'TripAdvisor.js', 'Panel de Reseñas de Google.html']]].forEach(([p, fs2]) => fs2.forEach((f) =>
    assert.strictEqual(fs.readFileSync(path.join(DIR, p, f), 'utf8'), fs.readFileSync(path.join(raiz, p, f), 'utf8'), p + '/' + f + ' se separó: volver a copiarlo cuando ese proyecto publique')));
});

test('Clientes2: las partes son las de la matriz 020 (consola y reseñas) y traen sus hojas', () => {
  assert.deepStrictEqual(PARTES, ['consola', 'resenas']);
  const m = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migraciones', '020_permisos.sql'), 'utf8');
  PARTES.forEach((p) => assert.match(m, new RegExp("'clientes',\\s*'" + p + "'")));
  assert.strictEqual(LIBROS.resenas.id, GBP_ID);
  assert.strictEqual(LIBROS.encuesta.id, ENCUESTA_ID);
});

test('Clientes2: la consola real lee chats, mensajes y lo que ya sabe el bot desde la copia', async () => {
  const s = servicio();
  const th = await s.llamar({}, 'consola', 'getThreads', [300]);
  assert.strictEqual(th.length, 2);
  assert.strictEqual(th[0].canal, 'instagram');   // el mas nuevo primero
  assert.strictEqual(th[0].pendiente, true);
  assert.strictEqual((await s.llamar({}, 'consola', 'getMensajes', ['whatsapp', '50255501111'])).length, 2);
  const f = await s.llamar({}, 'consola', 'getFicha', ['whatsapp', '50255501111']);
  assert.strictEqual(f.email, 'ana@ejemplo.test');
  assert.match(f.etapa_pipeline, /Cotizada · evento 2026-12-05/);
});

test('Clientes2: mandar, devolver al bot, publicar y guardar responden 409 (solo muestra)', async () => {
  const s = servicio();
  for (const [p, lista] of Object.entries(FUNCIONES)) {
    for (const n of lista.escritura) {
      await assert.rejects(s.llamar({}, p, n, ['whatsapp', '1', 'hola']), (e) => e.status === 409, p + '.' + n);
    }
  }
  await assert.rejects(s.llamar({}, 'consola', 'hojaSalientes_', []), (e) => e.status === 404);
  await assert.rejects(s.llamar({}, 'resenas', 'publicarAprobadas', []), (e) => e.status === 404);
});

test('Clientes2: sin permiso de la matriz no se lee nada (control negativo)', async () => {
  const s = servicio((u, p) => p === 'resenas');
  await assert.rejects(s.llamar({}, 'consola', 'getThreads', []), (e) => e.status === 403);
  assert.ok((await s.llamar({}, 'resenas', 'encuesta', [])).total === 2);
});

test('Clientes2: reseñas desde la hoja de control y TripAdvisor con el código real', async () => {
  const s = servicio();
  const g = await s.llamar({}, 'resenas', 'getDatosDashboard', []);
  assert.strictEqual(g.total, 2);
  assert.strictEqual(g.average, 4);
  assert.deepStrictEqual(g.dist, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
  const r2 = g.reviews.find((r) => r.id === 'r2');
  assert.strictEqual(r2.hasReply, false);
  assert.strictEqual(r2.borrador, 'Gracias por contarnos');
  const ta = await s.llamar({}, 'resenas', 'getDatosTripAdvisor', []);
  assert.strictEqual(ta.reviews.length, 1);
  assert.strictEqual(ta.configurada, false);
  assert.deepStrictEqual(datosDesdeHoja(null).reviews, []);
  // Sin pestaña TripAdvisor (la hoja real hoy no la tiene): vacio, sin error
  const sinTA = copiaDeMentira(); delete sinTA.libros[GBP_ID].TripAdvisor;
  const s2 = crearServicioClientes2({ pool, copia: () => sinTA, puede: () => true });
  assert.deepStrictEqual((await s2.llamar({}, 'resenas', 'getDatosTripAdvisor', [])).reviews, []);
});

test('Clientes2: encuesta (promedio y las de 5 estrellas que van a Google)', () => {
  const e = datosEncuesta(copiaDeMentira().libros[ENCUESTA_ID]['Encuesta 2026']);
  assert.strictEqual(e.total, 2);
  assert.strictEqual(e.promedio, 4);
  assert.strictEqual(e.cinco, 1);
  assert.strictEqual(e.respuestas[0].comentario, 'La música');   // la mas nueva primero
});

test('Clientes2: las pantallas avisan que es sombra y llaman solo a funciones clasificadas', () => {
  const llamadas = (h) => Array.from(h.matchAll(/(?:google\.script\.run|run)[\s\S]{0,400}?\.(\w+)\(/g)).map((m) => m[1]);
  const pares = { consola: [pant.armarConsola(), pant.armarBotSombra()], resenas: [pant.armarResenas(), pant.armarEncuesta()] };
  for (const [parte, hs] of Object.entries(pares)) {
    const ok = FUNCIONES[parte].lectura.concat(FUNCIONES[parte].escritura, ['withSuccessHandler', 'withFailureHandler']);
    hs.forEach((h) => {
      assert.match(h, /Prueba en sombra|Bot en sombra/);
      assert.match(h, new RegExp("/api/clientes2/" + parte + "/"));
      llamadas(h).filter((n) => /^(get|bot|enc|pub|edit|guard|regen|desc|marc|envi|devol)/.test(n)).forEach((n) => assert.ok(ok.includes(n), parte + ': ' + n + ' sin clasificar'));
    });
  }
});
