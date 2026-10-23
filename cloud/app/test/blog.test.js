// Blog del sitio nuevo (056) y el editor solo para Juanma: versiones, volver atras, permisos, formato y vista previa.
// Datos inventados; almacen en memoria; nada sale a la red.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const P = require('../src/permisos');
const PW = require('../src/permisos-web');
const A = require('../src/almacen-web');
const W = require('../src/contenido-web');
const AD = require('../src/adaptadores-web');
const { crearRutasContenidoWeb } = require('../src/rutas-web');
const pantallas = require('../src/pantallas-web');

const M = PW.conPropuesta(P.cargarDeMigracion());
const juanma = { email: 'dueno@ejemplo.test', rol: 'Dueño', nombre: 'Juanma' };
const vanessa = { email: 'vanessa@ejemplo.test', rol: 'pauta', nombre: 'Vanessa' };
const maco = { email: 'maco@ejemplo.test', rol: 'sala', nombre: 'Maco' };
const EJEMPLO = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../web/contenido/ejemplo-contenido.json'), 'utf8'));
const SIN_BLOG = Object.assign({}, EJEMPLO, { blog: undefined });
const status = (n) => (e) => e.status === n;

async function armar(contenido, matriz) {
  const almacen = A.crearAlmacenMemoria();
  await W.sembrar(almacen, contenido || SIN_BLOG, 'prueba');
  const reconstruir = AD.reconstruirDoble();
  const C = W.crearContenidoWeb({ almacen, matriz: matriz || M, fotos: AD.fotosDoble(), reconstruir });
  return { almacen, C, reconstruir };
}
const RW = require('../src/rutas-web');
const ENTRADA = { slug: 'que-comer-en-antigua', fecha: '2026-11-10', titulo_es: 'Qué comer en Antigua', titulo_en: 'What to eat in Antigua' };

test('Blog: sin entradas la llave "blog" no existe y la huella es la de siempre; con una entrada activa, sale en el formato 1', async () => {
  const { almacen, C } = await armar();
  const antes = await W.armarContenido(almacen);
  assert.ok(!('blog' in antes), 'sin blog, el contenido queda igual que antes de la 056');
  const h0 = W.huella(antes);
  const e = await C.crear(juanma, 'blog', Object.assign({ resumen_es: 'Resumen', resumen_en: 'Summary', cuerpo_es: 'Hola **mundo**.\n\n- uno\n- dos', cuerpo_en: 'Hi.' }, ENTRADA));
  const con = await W.armarContenido(almacen);
  assert.notStrictEqual(W.huella(con), h0);
  assert.deepStrictEqual(con.blog, [{ id: e.id, slug: 'que-comer-en-antigua', orden: 0, fecha: '2026-11-10', titulo: { es: 'Qué comer en Antigua', en: 'What to eat in Antigua' },
    resumen: { es: 'Resumen', en: 'Summary' }, cuerpo: { es: 'Hola **mundo**.\n\n- uno\n- dos', en: 'Hi.' }, foto: null }]);
  // retirada: no sale, y si no queda ninguna, la llave desaparece (y la huella vuelve a la de antes)
  await C.activar(juanma, 'blog', e.id, false);
  const sin = await W.armarContenido(almacen);
  assert.ok(!('blog' in sin));
  assert.strictEqual(W.huella(sin), h0);
});

test('Blog: la mas nueva primero; el orden desempata el mismo dia; falta el ingles = no se publica', async () => {
  const { almacen, C } = await armar();
  const base = { titulo_es: 'T', titulo_en: 'T', cuerpo_es: 'x', cuerpo_en: 'x' };
  await C.crear(juanma, 'blog', Object.assign({ slug: 'vieja', fecha: '2026-10-01' }, base));
  await C.crear(juanma, 'blog', Object.assign({ slug: 'nueva-b', fecha: '2026-11-01', orden: 2 }, base));
  await C.crear(juanma, 'blog', Object.assign({ slug: 'nueva-a', fecha: '2026-11-01', orden: 1 }, base));
  assert.deepStrictEqual((await W.armarContenido(almacen)).blog.map((b) => b.slug), ['nueva-a', 'nueva-b', 'vieja']);
  const x = await C.crear(juanma, 'blog', { slug: 'sin-ingles', fecha: '2026-11-02', titulo_es: 'Solo español', titulo_en: 'x', cuerpo_es: 'Texto' });
  await assert.rejects(C.publicar(juanma), (e) => e.status === 400 && e.faltan.some((f) => /Blog › sin-ingles › texto: falta el inglés/.test(f)));
  await C.editar(juanma, 'blog', x.id, { cuerpo_en: 'Text' });
  assert.strictEqual((await C.publicar(juanma, 'blog')).version, 1);
});

test('Blog: versionado como lo demas: publicar, cambiar, publicar y volver atras deja el blog como estaba', async () => {
  const { almacen, C } = await armar();
  const e = await C.crear(juanma, 'blog', Object.assign({ cuerpo_es: 'Versión uno', cuerpo_en: 'Version one' }, ENTRADA));
  const v1 = await C.publicar(juanma, 'con el primer artículo');
  await C.editar(juanma, 'blog', e.id, { cuerpo_es: 'Versión dos', titulo_en: 'Changed', fecha: '2026-11-12' });
  const otra = await C.crear(juanma, 'blog', { slug: 'segunda', fecha: '2026-11-11', titulo_es: 'Dos', titulo_en: 'Two', cuerpo_es: 'b', cuerpo_en: 'b' });
  const v2 = await C.publicar(juanma, 'dos artículos');
  assert.strictEqual((await C.publicado()).blog.length, 2);
  assert.strictEqual((await C.publicado(v1.version)).blog[0].cuerpo.es, 'Versión uno', 'la version vieja sigue igual');
  const v3 = await C.volverA(juanma, v1.version);
  assert.strictEqual(v3.version, v2.version + 1);
  const pub = await C.publicado();
  assert.strictEqual(pub.blog.length, 1);
  assert.deepStrictEqual([pub.blog[0].cuerpo.es, pub.blog[0].titulo.en, pub.blog[0].fecha], ['Versión uno', 'What to eat in Antigua', '2026-11-10']);
  // el borrador quedo igual a la version 1: la segunda entrada, retirada (no borrada)
  const b = await C.borrador(juanma);
  assert.strictEqual(b.blog.find((x) => x.id === otra.id).activa, false);
  assert.strictEqual(b.blog.find((x) => x.id === e.id).cuerpo_es, 'Versión uno');
  assert.strictEqual(b.cambios_sin_publicar, false);
  // y una version publicada ANTES de que existiera el blog lo deja todo retirado
  const { almacen: al2, C: C2 } = await armar();
  const viejo = await C2.publicar(juanma, 'sin blog');
  await C2.crear(juanma, 'blog', Object.assign({ cuerpo_es: 'a', cuerpo_en: 'a' }, ENTRADA));
  await C2.publicar(juanma, 'con blog');
  await C2.volverA(juanma, viejo.version);
  assert.ok(!('blog' in (await C2.publicado())));
  assert.strictEqual((await al2.lista('web_blog'))[0].activa, false);
  assert.ok(almacen);
});

test('Blog: solo el dueño lo escribe, aunque alguien tenga "ingresar" en web; pauta y sala no ven nada', async () => {
  const M2 = { permisos: new Map(M.permisos), soloDueno: M.soloDueno };
  M2.permisos.set('pauta|web', { rol: 'pauta', parte: 'web', nivel: 'ingresar', area: '*' });
  const { C } = await armar(null, M2);
  const e = await C.crear(juanma, 'blog', Object.assign({ cuerpo_es: 'a', cuerpo_en: 'a' }, ENTRADA));
  await assert.rejects(C.crear(vanessa, 'blog', Object.assign({}, ENTRADA, { slug: 'otro' })), (x) => x.status === 403 && /dueño/.test(x.message));
  await assert.rejects(C.editar(vanessa, 'blog', e.id, { cuerpo_es: 'b' }), status(403));
  await assert.rejects(C.activar(vanessa, 'blog', e.id, false), status(403));
  await assert.rejects(C.publicar(vanessa), status(403));
  // con la propuesta de hoy (solo el dueño en web), ni siquiera ven el borrador
  const { C: C3 } = await armar();
  for (const u of [vanessa, maco]) {
    await assert.rejects(C3.borrador(u), status(403));
    await assert.rejects(C3.crear(u, 'blog', ENTRADA), status(403));
    await assert.rejects(C3.vistaPrevia(u), status(403));
  }
});

test('Blog: el markdown simple se valida al guardar (sin HTML ni javascript:) y se convierte escapando todo', async () => {
  const { C } = await armar();
  const mal = [['<script>alert(1)</script>', /sin HTML/], ['Mirá [esto](javascript:alert(1))', /tiene que empezar con https/], ['[x](//otro.sitio)', /tiene que empezar/],
    ['[x](data:text/html,hola)', /tiene que empezar/]];
  for (const [cuerpo, re] of mal) await assert.rejects(C.crear(juanma, 'blog', Object.assign({ cuerpo_es: cuerpo }, ENTRADA)), (e) => e.status === 400 && re.test(e.message), cuerpo);
  await assert.rejects(C.crear(juanma, 'blog', Object.assign({}, ENTRADA, { slug: 'con.punto' })), status(400));
  await assert.rejects(C.crear(juanma, 'blog', Object.assign({}, ENTRADA, { fecha: '31/10/2026' })), status(400));
  await assert.rejects(C.crear(juanma, 'blog', Object.assign({}, ENTRADA, { fecha: '' })), status(400));
  await C.crear(juanma, 'blog', Object.assign({ cuerpo_es: 'Ver [el menú](/es/full-menu), [Google](https://g.page/x) o [escribinos](mailto:hola@ejemplo.test). 3 < 5' }, ENTRADA));
  await assert.rejects(C.crear(juanma, 'blog', ENTRADA), status(409), 'slug repetido');

  const html = W.markdownAHtml('Hola **mundo** & "amigos"\nsegunda línea\n\n- uno [menú](/full-menu)\n- **dos**\n\n<b>no</b> [mal](javascript:x) [web](https://rosanta.rest/a?b=1&c=2)');
  assert.strictEqual(html, '<p>Hola <strong>mundo</strong> &#38; &#34;amigos&#34;<br>segunda línea</p>\n' +
    '<ul><li>uno <a href="/full-menu">menú</a></li><li><strong>dos</strong></li></ul>\n' +
    '<p>&#60;b&#62;no&#60;/b&#62; mal <a href="https://rosanta.rest/a?b=1&#38;c=2" rel="noopener">web</a></p>');
  assert.strictEqual(W.markdownAHtml(''), '');
});

test('Blog: sembrar() lo carga desde el formato y el ejemplo del contrato va y vuelve igual', async () => {
  const almacen = A.crearAlmacenMemoria();
  const r = await W.sembrar(almacen, EJEMPLO, 'prueba');
  assert.strictEqual(r.blog, 2);
  const c = await W.armarContenido(almacen);
  const sinIds = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v)));
  assert.deepStrictEqual(sinIds(c.blog), sinIds(EJEMPLO.blog));
  assert.deepStrictEqual(Object.keys(EJEMPLO.blog[0]).sort(), ['cuerpo', 'fecha', 'foto', 'id', 'orden', 'resumen', 'slug', 'titulo']);
});

test('Si el codigo sale antes que la 056 (no existe web_blog), el contenido sigue funcionando sin blog', async () => {
  const almacen = A.crearAlmacenMemoria();
  await W.sembrar(almacen, SIN_BLOG, 'prueba');
  const real = almacen.lista;
  almacen.lista = async (t, f, o) => { if (t === 'web_blog') { const e = new Error('relation "web_blog" does not exist'); e.code = '42P01'; throw e; } return real(t, f, o); };
  const C = W.crearContenidoWeb({ almacen, matriz: M, fotos: AD.fotosDoble(), reconstruir: AD.reconstruirDoble() });
  assert.ok(!('blog' in (await W.armarContenido(almacen))));
  assert.deepStrictEqual((await C.borrador(juanma)).blog, []);
  const v = await C.publicar(juanma, 'sin 056');
  await C.publicar(juanma, 'otra').catch(() => {});
  assert.strictEqual((await C.volverA(juanma, v.version)).version >= v.version, true);
});

// ---------------------------------------------------------------- HTTP: todas las rutas de edicion exigen al dueño

async function servidor() {
  const { C } = await armar();
  const USU = { 'tok-juanma': juanma, 'tok-vanessa': vanessa, 'tok-maco': maco };
  const app = express();
  app.use(crearRutasContenidoWeb({ contenido: C, identificar: async (t) => USU[t] || null }));
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, ok));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const pedir = async (metodo, ruta, tok, cuerpo, tipo) => {
    const r = await fetch(base + ruta, { method: metodo, headers: Object.assign({ 'Content-Type': tipo || 'application/json' }, tok ? { 'x-rosanta-u': tok } : {}),
      body: cuerpo === undefined ? undefined : (Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo)) });
    const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch (e) { /* html */ }
    return { status: r.status, body: j, headers: r.headers };
  };
  return { C, pedir, cerrar: () => new Promise((ok) => srv.close(ok)) };
}

test('Editor solo para Juanma: cada ruta de edicion y publicacion rechaza a pauta y sala (403) y sin enlace (401)', async () => {
  const s = await servidor();
  try {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24)]);
    const RUTAS = [
      ['GET', '/api/web/borrador'], ['GET', '/api/web/vista-previa'], ['GET', '/api/web/versiones'], ['GET', '/api/web/bitacora'],
      ['POST', '/api/web/publicar', {}], ['POST', '/api/web/versiones/1/volver', {}], ['POST', '/api/web/ajustes/tipo_cambio_usd', { q_por_usd: 7.7 }],
      ['POST', '/api/web/fotos', png, 'image/png'], ['POST', '/api/web/fotos/1/chica', png, 'image/png'],
      ['POST', '/api/web/blog', ENTRADA], ['PATCH', '/api/web/blog/1', { cuerpo_es: 'x' }], ['POST', '/api/web/blog/1/activo', { activo: false }],
      ['POST', '/api/web/bloques', { pagina: 'inicio', clave: 'x.y' }], ['PATCH', '/api/web/faq/1', { respuesta_es: 'x' }], ['POST', '/api/web/faq/1/activo', { activo: false }],
      ['POST', '/api/web/paginas', { clave: 'nueva', ruta_en: '/n', ruta_es: '/es/n' }], ['PATCH', '/api/web/platos/1', { precio_q: 1 }]
    ];
    for (const [m, ruta, cuerpo, tipo] of RUTAS) {
      assert.strictEqual((await s.pedir(m, ruta, null, cuerpo, tipo)).status, 401, m + ' ' + ruta + ' sin enlace');
      for (const tok of ['tok-vanessa', 'tok-maco']) assert.strictEqual((await s.pedir(m, ruta, tok, cuerpo, tipo)).status, 403, m + ' ' + ruta + ' ' + tok);
    }
    // Juanma si: crea una entrada, la ve en la vista previa y la publica; el sitio la lee sin identificarse
    const e = await s.pedir('POST', '/api/web/blog', 'tok-juanma', Object.assign({ cuerpo_es: 'Hola', cuerpo_en: 'Hi' }, ENTRADA));
    assert.strictEqual(e.status, 200);
    const vp = await s.pedir('GET', '/api/web/vista-previa', 'tok-juanma');
    assert.strictEqual(vp.status, 200);
    assert.strictEqual(vp.body.contenido.blog[0].slug, ENTRADA.slug);
    assert.deepStrictEqual(vp.body.faltan, []);
    assert.strictEqual((await s.pedir('GET', '/api/web/contenido')).status, 404, 'nada publicado todavia');
    assert.strictEqual((await s.pedir('POST', '/api/web/publicar', 'tok-juanma', { nota: 'blog' })).body.version, 1);
    const pub = await s.pedir('GET', '/api/web/contenido');
    // la entrada tiene fecha futura (10-nov): publicada, pero oculta en lo publico hasta su fecha (Juanma, 23-oct)
    if (ENTRADA.fecha > RW.hoyGuatemala()) assert.strictEqual(pub.body.blog, undefined);
    else assert.strictEqual(pub.body.blog[0].titulo.en, ENTRADA.titulo_en);
    // las pantallas son HTML sin datos: los datos solo salen por la API con el enlace
    const pv = await s.pedir('GET', '/contenido-web/vista-previa?u=tok-vanessa');
    assert.strictEqual(pv.status, 200);
    assert.doesNotMatch(String(pv.body), /que-comer-en-antigua|Qué comer/);
    assert.match(String((await s.pedir('GET', '/contenido-web')).body), /data-tab="blog">Blog</);
  } finally { await s.cerrar(); }
});

test('La vista previa trae el conversor de markdown y pinta el blog (JS valido)', () => {
  const h = pantallas.vistaPrevia();
  const js = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];   // la ultima (la primera es la de la paleta)
  assert.doesNotThrow(() => new Function(js));   // eslint-disable-line no-new-func
  assert.match(js, /var markdownAHtml=function markdownAHtml\(md\)/);
  assert.match(js, /PG==="blog"/);
  // el mismo codigo que se prueba arriba es el que corre en la pagina
  assert.ok(js.includes('var markdownAHtml=' + W.markdownAHtml.toString() + ';'));
});

test('blog: las entradas con fecha futura quedan ocultas hasta su fecha (Juanma, 23-oct)', () => {
  const RW = require('../src/rutas-web');
  const c = { formato: 1, blog: [{ slug: 'manana', fecha: '2026-11-10' }, { slug: 'hoy', fecha: '2026-11-03' }, { slug: 'ayer', fecha: '2026-11-02' }] };
  assert.deepStrictEqual(RW.sinBlogFuturo(c, '2026-11-03').blog.map((b) => b.slug), ['hoy', 'ayer']);
  assert.strictEqual(RW.sinBlogFuturo({ formato: 1, blog: [{ slug: 'x', fecha: '2027-01-01' }] }, '2026-11-03').blog, undefined);
  assert.strictEqual(c.blog.length, 3, 'la version guardada no cambia');
  assert.strictEqual(RW.hoyGuatemala(Date.parse('2026-11-04T05:00:00Z')), '2026-11-03');   // 23:00 del 3 en Guatemala
});
