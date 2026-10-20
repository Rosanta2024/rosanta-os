// Reseñas y encuesta en la base (21-oct-2026): copia de las hojas y lector de Google Business en solo lectura.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const R = require('../src/resenas-nube');

const d = (s) => new Date(s);
const CAB = ['Fecha detectada', 'ReviewId', 'Estrellas', 'Cliente', 'Reseña original', 'Respuesta (editable)', 'Estado', 'Aprobar (SI/NO)', 'Fecha publicada'];
const HOJA_RESENAS = [CAB,
  [d('2026-10-10T10:00:00-06:00'), 'r1', 5, 'Mia Paz', 'Delicioso', 'Mia, gracias.', 'PUBLICADA_AUTO', '', ''],
  [d('2026-10-12T10:00:00-06:00'), 'r2', 3, 'Leo', 'Lento', 'Borrador viejo', 'PENDIENTE_APROBAR', 'NO', ''],
  [d('2026-10-13T10:00:00-06:00'), 'r2', 3, 'Leo', 'Lento', 'Borrador nuevo', 'PENDIENTE_APROBAR', 'NO', ''],
  ['', '', '', '', '', '', '', '', '']];
const HOJA_ENCUESTA = [['Fecha', 'Calificación', '¿Qué podríamos mejorar?'],
  [d('2026-10-01T12:00:00-06:00'), 5, ''], [d('2026-10-01T12:00:00-06:00'), 5, ''], [d('2026-10-02T13:00:00-06:00'), 3, 'La música'], ['', '', '']];   // la fila vacia del final la quita la lectura (como getDataRange)

/** Base de mentira con lo justo para estas tablas. */
function baseFalsa() {
  const t = { resenas_gbp: new Map(), resenas_gbp_google: new Map(), encuesta: new Map(), corridas: [] };
  const q = async (sql, p) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
    if (/INSERT INTO resenas_gbp \(/.test(sql)) {
      const ya = t.resenas_gbp.get(p[0]);
      if (ya && ya.escrito_por !== 'hoja') return { rowCount: 0, rows: [] };
      t.resenas_gbp.set(p[0], { review_id: p[0], estrellas: p[2], respuesta: p[5], estado: p[6], fila_hoja: p[9], escrito_por: 'hoja' });
      return { rowCount: 1, rows: [] };
    }
    if (/INSERT INTO encuesta_respuestas/.test(sql)) {
      if (t.encuesta.has(p[3])) return { rowCount: 0, rows: [] };
      t.encuesta.set(p[3], { fecha: p[0], calificacion: p[1], mejorar: p[2] });
      return { rowCount: 1, rows: [] };
    }
    if (/INSERT INTO resenas_gbp_google/.test(sql)) { t.resenas_gbp_google.set(p[0], { review_id: p[0], respuesta: p[6] }); return { rowCount: 1, rows: [] }; }
    if (/INSERT INTO resenas_corridas/.test(sql)) { t.corridas.push({ tarea: p[0], ok: p[1], resumen: JSON.parse(p[2]) }); return { rowCount: 1, rows: [] }; }
    if (/SELECT review_id, estado, respuesta, fecha_detectada, fecha_publicada FROM resenas_gbp/.test(sql)) return { rows: Array.from(t.resenas_gbp.values()) };
    throw new Error('consulta inesperada: ' + sql.slice(0, 60));
  };
  return { t, query: q, connect: async () => ({ query: q, release: () => {} }) };
}

/** leerLibro llama spreadsheets.get con includeGridData: se arma la respuesta de la API desde las matrices. */
function sheetsFalso(libros) {
  const celda = (v) => (v instanceof Date
    ? { effectiveValue: { numberValue: (v.getTime() - v.getTimezoneOffset() * 60000) / 86400000 + 25569 }, effectiveFormat: { numberFormat: { type: 'DATE_TIME' } } }
    : v === '' ? {} : typeof v === 'number' ? { effectiveValue: { numberValue: v } } : { effectiveValue: { stringValue: String(v) } });
  return { spreadsheets: { get: async ({ spreadsheetId, ranges }) => ({ data: { sheets: ranges.map((r) => {
    const n = r.slice(1, -1);
    return { properties: { title: n }, data: [{ rowData: (libros[spreadsheetId][n] || []).map((f) => ({ values: f.map(celda) })) }] };
  }) } }) } };
}
const SHEETS = () => sheetsFalso({ [R.GBP_ID]: { 'Reseñas': HOJA_RESENAS }, [R.ENCUESTA_ID]: { 'Encuesta 2026': HOJA_ENCUESTA } });

test('Reseñas: la hoja → una fila por reseña (gana la mas nueva) y sin filas vacias', () => {
  const f = R.filasResenas(HOJA_RESENAS);
  assert.strictEqual(f.length, 2);
  const r2 = f.find((x) => x.review_id === 'r2');
  assert.strictEqual(r2.respuesta, 'Borrador nuevo');
  assert.strictEqual(r2.fila_hoja, 4);
  assert.throws(() => R.filasResenas([['otra', 'cosa'], [1, 2]]), /ReviewId/);
});

test('Encuesta: huella estable; dos respuestas identicas en el mismo segundo cuentan las dos', () => {
  const a = R.filasEncuesta(HOJA_ENCUESTA), b = R.filasEncuesta(HOJA_ENCUESTA);
  assert.strictEqual(a.length, 3);
  assert.notStrictEqual(a[0].huella, a[1].huella);
  assert.deepStrictEqual(a.map((x) => x.huella), b.map((x) => x.huella));
});

test('Copiar hojas: copia, se puede repetir sin duplicar, y no pisa lo que ya escribio la nube', async () => {
  const pool = baseFalsa();
  const r1 = await R.copiarHojas({ pool, sheets: SHEETS });
  assert.deepStrictEqual(r1, { resenas: 2, encuesta: 3, encuesta_nuevas: 3, encuesta_filas_saltadas: 0 });
  const r2 = await R.copiarHojas({ pool, sheets: SHEETS });
  assert.strictEqual(r2.encuesta_nuevas, 0);
  assert.strictEqual(pool.t.encuesta.size, 3);
  pool.t.resenas_gbp.get('r2').escrito_por = 'nube';
  pool.t.resenas_gbp.get('r2').respuesta = 'De la nube';
  await R.copiarHojas({ pool, sheets: SHEETS });
  assert.strictEqual(pool.t.resenas_gbp.get('r2').respuesta, 'De la nube');
  assert.strictEqual(pool.t.corridas.filter((c) => c.tarea === 'copiar-hojas').length, 3);
});

// ---- Google Business, solo lectura ------------------------------------------------------------------------
const OAUTH = { client_id: 'cid', client_secret: 'cs', refresh_token: 'rt' };
function googleFalso(paginas, opciones) {
  const o = opciones || {};
  const pedidos = [];
  let fallas = o.fallas || 0;
  const fetchFn = async (url, init) => {
    pedidos.push({ url, metodo: init.method });
    const j = (b, s) => ({ ok: (s || 200) < 300, status: s || 200, json: async () => b, text: async () => JSON.stringify(b) });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return j({ access_token: 'at', expires_in: 3600 });
    if (url.startsWith('https://mybusinessaccountmanagement')) return j({ accounts: [{ name: 'accounts/111' }] });
    if (url.startsWith('https://mybusinessbusinessinformation')) return j({ locations: [{ name: 'locations/999', title: 'Rosanta' }, { name: 'locations/5', title: 'Otro' }] });
    if (url.includes('/reviews')) {
      if (fallas > 0) { fallas--; return j({ error: 'ocupado' }, 503); }
      const m = /pageToken=([^&]+)/.exec(url);
      return j(paginas[m ? Number(m[1]) : 0]);
    }
    return j({}, 404);
  };
  return { fetchFn, pedidos };
}
const rev = (id, estrellas, respuesta, creada) => ({ reviewId: id, starRating: estrellas, reviewer: { displayName: 'X' }, comment: 'c',
  createTime: creada || '2026-10-01T10:00:00Z', updateTime: creada || '2026-10-01T10:00:00Z', reviewReply: respuesta ? { comment: respuesta, updateTime: '2026-10-02T10:00:00Z' } : undefined });

test('Lector GBP: busca la ficha de Rosanta, pagina, y SOLO hace GET', async () => {
  const g = googleFalso([{ averageRating: 4.8, totalReviewCount: 3, reviews: [rev('r1', 'FIVE', 'Mia, gracias.')], nextPageToken: '1' },
    { reviews: [rev('r2', 'THREE'), rev('r3', 'FOUR', 'ok')] }], { fallas: 1 });
  const L = R.crearLectorGbp({ oauth: OAUTH }, { fetch: g.fetchFn, espera: async () => {} });
  const r = await L.resenas();
  assert.strictEqual(r.reviews.length, 3);
  assert.strictEqual(r.promedio, 4.8);
  assert.deepStrictEqual(r.ficha, { cuenta: '111', ubicacion: '999' });
  assert.strictEqual(r.reviews[1].estrellas, 3);
  assert.ok(g.pedidos.filter((p) => !p.url.startsWith('https://oauth2')).every((p) => p.metodo === 'GET'), 'a Google solo se le pide con GET');
  assert.ok(g.pedidos.some((p) => /accounts\/111\/locations\/999\/reviews/.test(p.url)));
  await assert.rejects(L.gbpGet('https://mybusiness.googleapis.com/v4/x/reply', 'PUT'), /solo lee/);
});

test('Lector GBP: sin el secreto gbp-oauth contesta 503 y no llama a nadie', async () => {
  const g = googleFalso([]);
  await assert.rejects(R.crearLectorGbp({ oauth: null }, { fetch: g.fetchFn }).resenas(), (e) => e.status === 503);
  assert.strictEqual(g.pedidos.length, 0);
  assert.deepStrictEqual(R.gbpDelEntorno({ GBP_OAUTH: 'no es json' }).oauth, null);
});

test('Comparar: alerta lo no atendido, lo publicado que no esta en Google y respuestas distintas; informa historicas y editadas', () => {
  const ahora = Date.parse('2026-10-21T12:00:00Z');
  const google = [
    { review_id: 'r1', respuesta: 'Mia,  gracias.' },                                                          // igual (espacios no cuentan)
    { review_id: 'r2', respuesta: '' },                                                                        // pendiente en las dos: normal
    { review_id: 'r3', respuesta: '' },                                                                        // la hoja dice publicada: alerta
    { review_id: 'r4', respuesta: 'Distinta', respuesta_fecha: new Date('2026-10-10T10:00:00Z') },             // distinta, misma fecha: alerta
    { review_id: 'r7', respuesta: 'Corregida', respuesta_fecha: new Date('2026-08-31T10:00:00Z') },            // corregida despues en Google: info
    { review_id: 'r5', respuesta: '', creada: new Date('2026-10-21T11:30:00Z') },                              // nueva de hace 30 min: todavia no
    { review_id: 'r6', respuesta: '', creada: new Date('2026-10-20T11:30:00Z') },                              // vieja y sin atender: alerta
    { review_id: 'r8', respuesta: 'Contestada en 2025', creada: new Date('2025-05-01T10:00:00Z') }];           // historica: info
  const hoja = [{ review_id: 'r1', estado: 'PUBLICADA_AUTO', respuesta: 'Mia, gracias.' }, { review_id: 'r2', estado: 'PENDIENTE_APROBAR', respuesta: 'b' },
    { review_id: 'r3', estado: 'PUBLICADA_APROBADA', respuesta: 'x' },
    { review_id: 'r4', estado: 'PUBLICADA_AUTO', respuesta: 'Otra', fecha_detectada: new Date('2026-10-10T09:00:00Z') },
    { review_id: 'r7', estado: 'PUBLICADA_AUTO', respuesta: 'Con la nota del modelo', fecha_detectada: new Date('2026-08-28T10:00:00Z') }];
  const c = R.comparar(google, hoja, ahora);
  assert.deepStrictEqual(c.diferencias, { sin_atender: ['r6'], publicada_sin_respuesta: ['r3'], respuesta_distinta: ['r4'] });
  assert.deepStrictEqual(c.editadas_en_google, ['r7']);
  assert.strictEqual(c.historicas, 1);
  assert.strictEqual(c.alertas, 3);
  assert.strictEqual(c.sin_responder, 4);
});

async function servir(deps, fn) {
  const app = express(); app.use(express.json());
  R.montarResenas(app, Object.assign({ claveTareas: 'clave-de-prueba-123' }, deps));
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const tarea = (b, ruta, clave) => fetch(b + ruta, { method: 'POST', headers: { 'x-rosanta-tarea': clave === undefined ? 'clave-de-prueba-123' : clave } });

test('Rutas: sin clave de tarea 403; copiar 200; leer Google 409 cuando hay algo que mirar', async () => {
  const pool = baseFalsa();
  const g = googleFalso([{ averageRating: 4.5, totalReviewCount: 2, reviews: [rev('r1', 'FIVE', 'Mia, gracias.'), rev('r9', 'FOUR')] }]);
  await servir({ pool, sheets: SHEETS, gbp: { oauth: OAUTH, cuenta: '1', ubicacion: '2' }, fetch: g.fetchFn }, async (b) => {
    assert.strictEqual((await tarea(b, '/tareas/resenas/copiar-hojas', 'mala')).status, 403);
    const c = await tarea(b, '/tareas/resenas/copiar-hojas');
    assert.strictEqual(c.status, 200);
    assert.strictEqual((await c.json()).resenas, 2);
    const l = await tarea(b, '/tareas/resenas/leer-google');
    const j = await l.json();
    assert.strictEqual(l.status, 409);   // r9 esta en Google sin respuesta y no en la hoja
    assert.deepStrictEqual(j.diferencias.sin_atender, ['r9']);
    assert.strictEqual(pool.t.resenas_gbp_google.size, 2);
    assert.strictEqual(pool.t.corridas.at(-1).ok, false);
  });
});

test('Migracion 040: solo tablas nuevas, sin TripAdvisor, y app no borra', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migraciones', '040_resenas_encuesta.sql'), 'utf8');
  const sinComentarios = m.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentarios, /ALTER TABLE|DROP |DELETE|TRUNCATE/i);
  assert.doesNotMatch(sinComentarios, /resenas_ta|tripadvisor/i);
  assert.doesNotMatch(sinComentarios, /GRANT[^;]*DELETE/i);
  ['resenas_gbp', 'resenas_gbp_google', 'encuesta_respuestas', 'resenas_corridas'].forEach((t) => assert.match(sinComentarios, new RegExp('CREATE TABLE ' + t + ' ')));
});

test('Modo: /resenas/modo dice puente sin tabla o sin fila, y base cuando el interruptor lo dice', async () => {
  for (const [filas, esperado] of [[null, 'puente'], [[], 'puente'], [[{ modo: 'base' }], 'base'], [[{ modo: 'cualquiera' }], 'puente']]) {
    const pool = { query: async () => { if (filas === null) throw new Error('sin tabla'); return { rows: filas }; } };
    await servir({ pool }, async (b) => assert.deepStrictEqual(await (await fetch(b + '/resenas/modo')).json(), { modo: esperado }));
  }
});

test('Apps Script: los activadores y el panel viejo le preguntan a la nube antes de leer o publicar', () => {
  const dir = path.join(__dirname, '..', 'proyectos', 'panel-de-reseas-de-google');
  const bot = fs.readFileSync(path.join(dir, 'Bot de Reseñas de Google.js'), 'utf8');
  const panel = fs.readFileSync(path.join(dir, 'PanelServidor.js'), 'utf8');
  assert.match(bot, /function procesarResenas\(\) \{\n\s+if \(mandaLaNube_\(\)\)/);
  assert.match(bot, /function publicarAprobadas\(\) \{\n\s+if \(mandaLaNube_\(\)\)/);
  assert.match(panel, /function publicarDesdePanel\(reviewId, texto\) \{\n\s+if \(mandaLaNube_\(\)\)/);
  assert.match(panel, /function editarRespuestaPublicada\(reviewId, texto\) \{\n\s+if \(mandaLaNube_\(\)\)/);
  assert.match(bot, /NUBE_RESENAS_MODO_URL = 'https:\/\/rosanta-nube-[a-z0-9-]+\.a\.run\.app\/resenas\/modo'/);
});
