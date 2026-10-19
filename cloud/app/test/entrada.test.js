// La entrada del telefono (/intranet) y los iconos de Rosanta (19-oct-2026).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const E = require('../src/entrada');

async function servir(fn) {
  const app = express(); E.montarEntrada(app);
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}

test('Los iconos de Rosanta se sirven, y nada fuera de la lista', async () => {
  await servir(async (b) => {
    for (const f of ['apple-touch-icon.png', 'favicon-32.png', 'icono-192.png', 'icono-512.png']) {
      const r = await fetch(b + '/marca/' + f);
      assert.strictEqual(r.status, 200, f); assert.strictEqual(r.headers.get('content-type'), 'image/png');
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.deepStrictEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], f + ' es un PNG');
    }
    assert.strictEqual((await fetch(b + '/marca/..%2Fsrc%2Fentrada.js')).status, 404);
    assert.strictEqual((await fetch(b + '/marca/otro.png')).status, 404);
    const m = await (await fetch(b + '/marca/manifest.webmanifest')).json();
    assert.strictEqual(m.short_name, 'Rosanta'); assert.strictEqual(m.start_url, '/intranet');
  });
});

test('/intranet abre la intranet de siempre, con el mismo enlace; /intranet?instalar=1 lleva el icono', async () => {
  await servir(async (b) => {
    const a = await (await fetch(b + '/intranet?u=tok-juanma-123')).text();
    assert.ok(a.includes('location.replace(' + JSON.stringify(E.INTRANET_URL + '?u=tok-juanma-123') + ')'), 'redirige con el enlace');
    assert.match(a, /rel="apple-touch-icon" href="\/marca\/apple-touch-icon.png"/);
    const sin = await (await fetch(b + '/intranet')).text();
    assert.ok(sin.includes('location.replace(' + JSON.stringify(E.INTRANET_URL) + ')'), 'sin enlace: la sesion de Google');
    const i = await (await fetch(b + '/intranet?instalar=1&u=tok-juanma-123')).text();
    assert.match(i, /Agregar a inicio/);
    assert.ok(i.includes('history.replaceState(null,"","/intranet?u=tok-juanma-123")'), 'el acceso directo guarda /intranet sin "instalar"');
    assert.ok(!/location\.replace/.test(i), 'la pagina de instalar no se va sola');
  });
});

test('Un enlace con forma rara no se pega en la pagina (control negativo)', async () => {
  await servir(async (b) => {
    const t = await (await fetch(b + '/intranet?u=' + encodeURIComponent('"><script>alert(1)</script>'))).text();
    assert.ok(!t.includes('alert(1)'));
    assert.ok(t.includes('location.replace(' + JSON.stringify(E.INTRANET_URL) + ')'));
  });
  assert.strictEqual(E.enlaceLimpio('abc'), '', 'muy corto');
  assert.strictEqual(E.enlaceLimpio('tok-bueno-123'), 'tok-bueno-123');
});
