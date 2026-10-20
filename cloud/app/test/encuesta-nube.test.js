// La encuesta en la nube (21-oct-2026): recibe lo que manda el /exec viejo, con interruptor; y la pagina de plan B.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');
const E = require('../src/encuesta-nube');
const R = require('../src/resenas-nube');

function baseFalsa(modo) {
  const guardadas = [];
  return { guardadas, query: async (sql, p) => {
    if (/FROM interruptores/.test(sql)) { if (modo === null) throw new Error('sin tabla'); return { rows: modo ? [{ modo }] : [] }; }
    if (/INSERT INTO encuesta_respuestas/.test(sql)) { guardadas.push({ calificacion: p[0], mejorar: p[1], huella: p[2] }); return { rows: [{ fecha: '2026-10-21T12:00:00' }] }; }
    throw new Error('consulta inesperada');
  } };
}
async function servir(deps, fn) {
  const app = express(); app.use(express.json());
  E.montarEncuesta(app, deps);
  app.use((err, req, res, next) => res.status(500).json({ error: String(err.message) }));   // eslint-disable-line no-unused-vars
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const mandar = (b, cuerpo, tipo) => fetch(b + '/encuesta/respuesta', { method: 'POST', headers: { 'Content-Type': tipo || 'application/json' }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });

test('Encuesta: en puente (o sin tabla) no guarda y le dice a Apps Script que escriba la hoja como siempre', async () => {
  for (const modo of [null, undefined, 'puente']) {
    const pool = baseFalsa(modo);
    await servir({ pool }, async (b) => {
      const r = await mandar(b, { rating: 3, feedback: 'La música', via: 'exec' });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(await r.json(), { ok: true, modo: 'puente', redirect: null });
      assert.strictEqual(pool.guardadas.length, 0);
    });
  }
});

test('Encuesta: en base guarda (origen nube) y solo las 5 estrellas llevan a Google', async () => {
  const pool = baseFalsa('base');
  await servir({ pool }, async (b) => {
    const r3 = await (await mandar(b, { rating: 3, feedback: 'Lento', via: 'exec' })).json();
    assert.strictEqual(r3.modo, 'base');
    assert.strictEqual(r3.redirect, null);
    const r5 = await (await mandar(b, JSON.stringify({ rating: 5, feedback: '', lang: 'en' }), 'text/plain')).json();
    assert.strictEqual(r5.redirect, E.GOOGLE_REVIEW_URL);
    assert.strictEqual(pool.guardadas.length, 2);
    assert.match(pool.guardadas[0].huella, /^nube-exec-/);
    assert.match(pool.guardadas[1].huella, /^nube-pagina-/);
  });
});

test('Encuesta: robots, cuerpos raros y abuso no escriben nada', async () => {
  const pool = baseFalsa('base');
  await servir({ pool, limites: { ip: 3, total: 100 } }, async (b) => {
    assert.deepStrictEqual(await (await mandar(b, { rating: 5, website: 'spam.com' })).json(), { ok: true, redirect: null });
    assert.strictEqual((await mandar(b, { rating: 9 })).status, 400);
    assert.strictEqual((await mandar(b, { rating: 4, otra: 1 })).status, 400);
    assert.strictEqual((await mandar(b, 'no json', 'text/plain')).status, 429);   // la 4a del minuto desde la misma IP
    assert.strictEqual(pool.guardadas.length, 0);
  });
  assert.strictEqual(E.limpiarRespuesta({ rating: 3, feedback: 'x'.repeat(2001) }).error, 'comentario muy largo');
  assert.strictEqual(E.limpiarRespuesta({ rating: 2.5 }).error, 'calificacion invalida');
});

test('Encuesta: la pagina de plan B es la misma de Apps Script, con el envio cambiado a la nube', async () => {
  await servir({ pool: baseFalsa('base') }, async (b) => {
    const html = await (await fetch(b + '/encuesta')).text();
    assert.match(html, /Escribir mi reseña en Google/);
    assert.match(html, /fetch\("\/encuesta\/respuesta"/);
  });
  // el shim responde a la misma forma de llamada que usa Index.html
  const shim = /<script>(window\.google=.*?)<\/script>/.exec(E.armarPagina('<head></head>'))[1];
  const llamadas = [];
  const ctx = { window: {}, fetch: async (u, o) => { llamadas.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ ok: true }) }; } };
  vm.createContext(ctx); vm.runInContext(shim, ctx);
  await new Promise((ok) => ctx.window.google.script.run.withSuccessHandler(ok).withFailureHandler(ok).enviarRespuesta({ rating: 4, feedback: 'x' }));
  ctx.window.google.script.run.enviarRespuesta({ rating: 5 });
  assert.deepStrictEqual(llamadas.map((x) => x.rating), [4, 5]);
});

test('Encuesta: la copia de la hoja no vuelve a subir las filas marcadas "nube"; las "sin-nube" si', () => {
  const d = (s) => new Date(s);
  const f = R.filasEncuesta([['Fecha', 'Calificación', 'Mejorar'],
    [d('2026-10-21T10:00:00-06:00'), 4, 'a', 'nube'], [d('2026-10-21T11:00:00-06:00'), 2, 'b', 'sin-nube'], [d('2026-10-21T12:00:00-06:00'), 5, '']]);
  assert.deepStrictEqual(f.map((x) => x.calificacion), [2, 5]);
});

test('Encuesta: la copia de rosanta-encuesta en la nube es igual a la de Apps Script, y el /exec le habla a rosanta-nube', () => {
  const raiz = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-encuesta');
  if (!fs.existsSync(raiz)) return;
  ['Code.js', 'Index.html'].forEach((n) => assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'proyectos', 'rosanta-encuesta', n), 'utf8'),
    fs.readFileSync(path.join(raiz, n), 'utf8'), n + ' se separo'));
  const code = fs.readFileSync(path.join(raiz, 'Code.js'), 'utf8');
  assert.match(code, /NUBE_ENCUESTA_URL = 'https:\/\/rosanta-nube-[a-z0-9-]+\.a\.run\.app\/encuesta\/respuesta'/);
  assert.match(code, /if \(rating >= 5\) \{\n\s+return \{ redirect: CFG\.GOOGLE_REVIEW_URL \};/);   // la regla de las 5 estrellas sigue igual
});
