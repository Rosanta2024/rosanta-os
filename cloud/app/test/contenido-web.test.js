const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const P = require('../src/permisos');
const PW = require('../src/permisos-web');
const A = require('../src/almacen-web');
const W = require('../src/contenido-web');
const AD = require('../src/adaptadores-web');
const { crearRutasContenidoWeb } = require('../src/rutas-web');

const M = PW.conPropuesta(P.cargarDeMigracion());
const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño', nombre: 'Juanma' };
const vanessa = { email: 'vanessa@prueba.test', rol: 'pauta', nombre: 'Vanessa' };
const dani = { email: 'dani@prueba.test', rol: 'pauta', nombre: 'Dani' };
const maco = { email: 'maco@prueba.test', rol: 'sala', nombre: 'Maco' };
const EJEMPLO = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../web/contenido/ejemplo-contenido.json'), 'utf8'));

function armar(o) {
  const almacen = A.crearAlmacenMemoria();
  const fotos = AD.fotosDoble(), reconstruir = AD.reconstruirDoble(o);
  const C = W.crearContenidoWeb({ almacen, matriz: M, fotos, reconstruir });
  return { almacen, fotos, reconstruir, C };
}
async function sembrado(o) {
  const x = armar(o);
  const r = await W.sembrar(x.almacen, EJEMPLO, 'prueba');
  assert.ok(r.sembrado);
  return x;
}
const sinIds = (c) => JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' ? undefined : v)));
const status = (n) => (e) => e.status === n;

test('Sembrar el ejemplo y armarlo de nuevo da el mismo contenido (el formato va y vuelve)', async () => {
  const { almacen } = await sembrado();
  const c = await W.armarContenido(almacen);
  const quitar = (x) => { const y = sinIds(x); ['version', 'publicada', 'huella', 'alergenos', 'etiquetas', 'giftcards'].forEach((k) => delete y[k]); return y; };
  assert.deepStrictEqual(quitar(c), quitar(EJEMPLO));
  assert.strictEqual(c.menu[0].platos[0].precio_usd_ref, 11, 'Q85 / 7.7 ≈ US$11');
  assert.strictEqual(Object.keys(c.alergenos).length, 14);
  const otra = await W.sembrar(almacen, EJEMPLO, 'prueba');
  assert.strictEqual(otra.sembrado, false, 'no siembra dos veces');
});

test('Permisos: Vanessa y Dani editan el borrador; publicar y volver atrás solo el dueño; sala no ve', async () => {
  const { C } = await sembrado();
  const b = await C.borrador(vanessa);
  assert.deepStrictEqual(b.yo, { puede_editar: true, puede_publicar: false, puede_precios: false });
  const bloque = b.bloques.find((x) => x.clave === 'heroe.titulo');
  await C.editar(vanessa, 'bloques', bloque.id, { texto_es: 'Título nuevo de Vanessa' });
  await C.editar(dani, 'faq', b.faq[0].id, { respuesta_en: 'New answer by Dani.' });
  await assert.rejects(C.publicar(vanessa), status(403));
  await assert.rejects(C.publicar(dani), status(403));
  await assert.rejects(C.volverA(dani, 1), status(403));
  await assert.rejects(C.borrador(maco), status(403));
  await assert.rejects(C.editar(maco, 'faq', b.faq[0].id, { respuesta_en: 'x' }), status(403));
  await assert.rejects(C.crear(vanessa, 'paginas', { clave: 'nueva', ruta_en: '/nueva', ruta_es: '/es/nueva' }), status(403), 'crear paginas es del dueño');
  const v = await C.publicar(juanma, 'primera');
  assert.strictEqual(v.version, 1);
  assert.strictEqual((await C.publicado()).paginas.inicio.bloques['heroe.titulo'].es, 'Título nuevo de Vanessa');
  assert.strictEqual((await C.borrador(juanma)).yo.puede_publicar, true);
});

test('Sin las filas de la sesion C nadie puede nada (falla cerrada)', async () => {
  const almacen = A.crearAlmacenMemoria();
  const C = W.crearContenidoWeb({ almacen, matriz: P.cargarDeMigracion(), fotos: AD.fotosDoble(), reconstruir: AD.reconstruirDoble() });
  await assert.rejects(C.borrador(juanma), status(403));
  await assert.rejects(C.publicar(juanma), status(403));
});

test('El precio de un plato lo cambia solo el dueño; el texto lo cambia cualquiera del equipo web', async () => {
  const { C } = await sembrado();
  const plato = (await C.borrador(juanma)).platos[0];
  await assert.rejects(C.editar(vanessa, 'platos', plato.id, { precio_q: 95 }), (e) => e.status === 403 && /dueño/.test(e.message));
  await C.editar(vanessa, 'platos', plato.id, { precio_q: '85', descripcion_es: 'Otra descripción' });   // mismo precio: pasa
  await assert.rejects(C.crear(vanessa, 'platos', { seccion_id: plato.seccion_id, nombre_es: 'N', nombre_en: 'N', precio_q: 50 }), status(403));
  await C.crear(vanessa, 'platos', { seccion_id: plato.seccion_id, nombre_es: 'Sin precio', nombre_en: 'No price' });
  const r = await C.editar(juanma, 'platos', plato.id, { precio_q: 'Q95.00' });
  assert.strictEqual(r.precio_q, 95);
  await assert.rejects(C.ajustar(vanessa, 'tipo_cambio_usd', { q_por_usd: 7.8 }), status(403));
  await C.ajustar(juanma, 'tipo_cambio_usd', { q_por_usd: '7.80' });
  assert.strictEqual((await C.vistaPrevia(juanma)).contenido.ajustes.tipo_cambio_usd, 7.8);
});

test('Validaciones: alérgenos de la lista, enlaces seguros, foto que exista', async () => {
  const { C } = await sembrado();
  const b = await C.borrador(juanma);
  await assert.rejects(C.editar(vanessa, 'platos', b.platos[0].id, { alergenos: ['gluten', 'kriptonita'] }), (e) => e.status === 400 && /kriptonita/.test(e.message));
  const boton = b.bloques.find((x) => x.tipo === 'enlace');
  await assert.rejects(C.editar(vanessa, 'bloques', boton.id, { enlace: 'javascript:alert(1)' }), status(400));
  await assert.rejects(C.editar(vanessa, 'bloques', boton.id, { enlace: '//otro.sitio' }), status(400));
  await C.editar(vanessa, 'bloques', boton.id, { enlace: 'https://wa.me/50200000000' });
  await assert.rejects(C.editar(vanessa, 'platos', b.platos[0].id, { foto_id: 999 }), status(400));
  await assert.rejects(C.editar(vanessa, 'platos', 999, { nombre_es: 'x' }), status(404));
  await assert.rejects(C.editar(vanessa, 'nada', 1, { x: 1 }), status(404));
});

test('Versiones: cada publicación queda guardada; volver atrás publica la vieja y deja el borrador igual', async () => {
  const { C, almacen, reconstruir } = await sembrado();
  const b = await C.borrador(juanma);
  const titulo = b.bloques.find((x) => x.clave === 'heroe.titulo');
  const faq = b.faq[0];
  const v1 = await C.publicar(juanma, 'v1');
  await assert.rejects(C.publicar(juanma, 'igual'), (e) => e.status === 409 && /No hay cambios/.test(e.message));
  await C.editar(vanessa, 'bloques', titulo.id, { texto_es: 'Título de la v2', texto_en: 'V2 headline' });
  await C.activar(vanessa, 'faq', faq.id, false);
  await C.crear(vanessa, 'faq', { pregunta_es: '¿Nueva?', pregunta_en: 'New?', respuesta_es: 'Sí', respuesta_en: 'Yes' });
  const v2 = await C.publicar(juanma, 'v2');
  let pub = await C.publicado();
  assert.strictEqual(pub.version, v2.version);
  assert.strictEqual(pub.paginas.inicio.bloques['heroe.titulo'].es, 'Título de la v2');
  assert.deepStrictEqual(pub.faq.map((q) => q.pregunta.es), ['¿Nueva?']);
  assert.strictEqual((await C.publicado(v1.version)).paginas.inicio.bloques['heroe.titulo'].es, 'Título de ejemplo', 'la v1 sigue guardada');

  const v3 = await C.volverA(juanma, v1.version);
  pub = await C.publicado();
  assert.strictEqual(pub.version, v3.version);
  assert.strictEqual(pub.huella, v1.huella, 'el sitio vuelve a ser exactamente la v1');
  const borr = await C.vistaPrevia(juanma);
  assert.strictEqual(borr.huella, v1.huella, 'y el borrador también');
  assert.strictEqual(borr.contenido.faq.length, 1);
  assert.strictEqual(borr.contenido.faq[0].pregunta.es, '¿Pregunta de ejemplo?');
  const vs = await C.versiones(juanma);
  assert.deepStrictEqual(vs.map((x) => x.id), [3, 2, 1]);
  assert.strictEqual(vs[0].restaurada_de, 1);
  assert.strictEqual(reconstruir.pedidos.length, 3, 'cada publicación pide reconstruir el sitio');
  const bit = await almacen.lista('web_bitacora');
  assert.ok(bit.some((x) => x.accion === 'volver_atras' && x.tabla === 'web_faq'), 'la vuelta queda en la bitácora');
  assert.ok(bit.some((x) => x.accion === 'editar' && x.quien === vanessa.email && x.antes.texto_es === 'Título de ejemplo'));
  assert.ok(bit.filter((x) => x.accion === 'publicar').every((x) => x.quien === juanma.email));
});

test('No se publica con textos sin traducir; el gancho caído no pierde la versión', async () => {
  const { C } = await sembrado({ falla: true });
  const b = await C.borrador(juanma);
  await C.editar(vanessa, 'faq', b.faq[0].id, { respuesta_en: '' });
  await assert.rejects(C.publicar(juanma), (e) => e.status === 400 && e.faltan.some((f) => /falta el inglés/.test(f)));
  await C.editar(vanessa, 'faq', b.faq[0].id, { respuesta_en: 'Answer' });
  const v = await C.publicar(juanma);
  assert.strictEqual(v.reconstruccion, 'error');
  assert.match(v.detalle, /gancho caido/);
  assert.strictEqual((await C.publicado()).version, v.version);
  assert.strictEqual((await C.versiones(juanma))[0].reconstruccion, 'error');
});

test('Sin gancho configurado: la versión queda y dice sin_gancho', async () => {
  const r = await AD.reconstruirPorUrl({}).reconstruir({ version_id: 1 });
  assert.strictEqual(r.estado, 'sin_gancho');
  const llamadas = [];
  const g = AD.reconstruirPorUrl({ url: 'https://gancho.prueba/x', clave: 'k', fetch: async (u, o) => { llamadas.push({ u, o }); return { ok: true, status: 200 }; } });
  assert.strictEqual((await g.reconstruir({ version_id: 4, huella: 'h' })).estado, 'pedida');
  assert.strictEqual(llamadas[0].o.headers['x-rosanta-tarea'], 'k');
  assert.deepStrictEqual(JSON.parse(llamadas[0].o.body), { version: 4, huella: 'h' });
});

// Una imagen PNG minima (1x1) y un WebP VP8X de 800x600 de mentira: alcanza para tipo y medidas
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c50000000049454e44ae426082', 'hex');
function webp(ancho, alto) {
  const b = Buffer.alloc(40); b.write('RIFF', 0); b.writeUInt32LE(32, 4); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUInt32LE(10, 16);
  b.writeUIntLE(ancho - 1, 24, 3); b.writeUIntLE(alto - 1, 27, 3); return b;
}

test('Fotos: se reconoce el tipo y la medida, se guarda en el depósito (doble) y no se duplica', async () => {
  const { C, fotos } = armar();
  assert.deepStrictEqual(W.medidas(PNG, 'image/png'), { ancho: 1, alto: 1 });
  const f = await C.subirFoto(vanessa, webp(800, 600), { alt_es: 'Cóctel', alt_en: 'Cocktail' });
  assert.strictEqual(f.ancho, 800); assert.strictEqual(f.alto, 600); assert.strictEqual(f.tipo, 'image/webp');
  assert.match(f.url, /^https:\/\/fotos\.prueba\/web\/fotos\/\d{4}\/\d{2}\/[0-9a-f]{20}\.webp$/);
  const otra = await C.subirFoto(dani, webp(800, 600));
  assert.strictEqual(otra.id, f.id, 'la misma foto dos veces es una sola');
  const ch = await C.subirFoto(vanessa, PNG, { chicaDe: f.id });
  assert.match(ch.url_chica, /-chica\.png$/);
  assert.strictEqual(Object.keys(fotos.guardadas).length, 2);
  await assert.rejects(C.subirFoto(vanessa, Buffer.from('<svg onload=alert(1)>aaaaaaaaaaaaaaaa')), status(400));
  await assert.rejects(C.subirFoto(maco, PNG), status(403));
  await C.editar(vanessa, 'fotos', f.id, { alt_en: 'A cocktail' });
  await C.activar(vanessa, 'fotos', f.id, false);
  await assert.rejects(C.crear(vanessa, 'fotos', {}), status(400));
});

test('Rutas: la pantalla, la API con el enlace, las fotos en binario y el contenido público', async () => {
  const { C } = await sembrado();
  const tokens = { 'tok-juanma': juanma, 'tok-vanessa': vanessa };
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(crearRutasContenidoWeb({ contenido: C, identificar: async (t) => tokens[t] || null }));
  const srv = app.listen(0); const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    let r = await fetch(base + '/contenido-web?u=tok-vanessa');
    assert.strictEqual(r.status, 200); assert.match(await r.text(), /Contenido web/);
    r = await fetch(base + '/api/web/borrador'); assert.strictEqual(r.status, 401);
    r = await fetch(base + '/api/web/borrador', { headers: { 'x-rosanta-u': 'falso' } }); assert.strictEqual(r.status, 401);
    r = await fetch(base + '/api/web/borrador', { headers: { 'x-rosanta-u': 'tok-vanessa' } });
    const b = await r.json(); assert.strictEqual(b.yo.puede_publicar, false);
    const faq = b.faq[0];
    r = await fetch(base + '/api/web/faq/' + faq.id, { method: 'PATCH', headers: { 'x-rosanta-u': 'tok-vanessa', 'Content-Type': 'application/json' }, body: JSON.stringify({ respuesta_es: 'Nueva respuesta' }) });
    assert.strictEqual(r.status, 200);
    r = await fetch(base + '/api/web/publicar', { method: 'POST', headers: { 'x-rosanta-u': 'tok-vanessa', 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 403);
    r = await fetch(base + '/api/web/contenido'); assert.strictEqual(r.status, 404, 'nada publicado todavía');
    r = await fetch(base + '/api/web/publicar', { method: 'POST', headers: { 'x-rosanta-u': 'tok-juanma', 'Content-Type': 'application/json' }, body: JSON.stringify({ nota: 'ok' }) });
    assert.strictEqual(r.status, 200);
    r = await fetch(base + '/api/web/contenido');
    assert.strictEqual(r.status, 200); assert.match(r.headers.get('cache-control'), /public/);
    const pub = await r.json(); assert.strictEqual(pub.formato, 1); assert.strictEqual(pub.faq[0].respuesta.es, 'Nueva respuesta');
    assert.ok(!JSON.stringify(pub).includes('@'), 'el contenido público no lleva correos de quien editó');
    r = await fetch(base + '/api/web/fotos?ancho=800&alto=600', { method: 'POST', headers: { 'x-rosanta-u': 'tok-vanessa', 'Content-Type': 'image/webp' }, body: webp(800, 600) });
    assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).ancho, 800);
    r = await fetch(base + '/api/web/fotos', { method: 'POST', headers: { 'x-rosanta-u': 'tok-vanessa', 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 400);
  } finally { srv.close(); }
});
