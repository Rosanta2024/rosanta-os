const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const P = require('../src/permisos');
const PW = require('../src/permisos-web');
const A = require('../src/almacen-web');
const W = require('../src/contenido-web');
const AV = require('../src/adventures');
const AD = require('../src/adaptadores-web');
const { crearRutasAdventures } = require('../src/rutas-web');

// Datos inventados: ningún operador ni cliente real.
const M = PW.conPropuesta(P.cargarDeMigracion());
const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño' };
const vanessa = { email: 'vanessa@prueba.test', rol: 'pauta' };
const status = (n) => (e) => e.status === n;
const HOY = new Date('2026-11-10T16:00:00Z');   // 10-nov en Guatemala

function ganchosDobles(o) {
  const llamados = { pipeline: [], avisarJuanma: [], crearReserva: [] };
  return {
    llamados,
    pipeline: async (x) => { llamados.pipeline.push(x); if (o && o.pipelineFalla) throw new Error('pipeline caído'); return { id: 'ev_' + x.id }; },
    avisarJuanma: async (x) => { llamados.avisarJuanma.push(x); return {}; },
    crearReserva: async (x) => { llamados.crearReserva.push(x); return o && o.sinMesa ? { id: null, motivo: 'sin_disponibilidad' } : { id: 'res_1' }; }
  };
}

async function armar(o) {
  let ahora = (o && o.ahora) || HOY;
  const almacen = A.crearAlmacenMemoria({ ahora: () => ahora });
  const reconstruir = AD.reconstruirDoble();
  const C = W.crearContenidoWeb({ almacen, matriz: M, fotos: AD.fotosDoble(), reconstruir, ahora: () => ahora });
  const ganchos = ganchosDobles(o);
  const S = AV.crearAdventures({ almacen, matriz: M, contenido: C, ganchos, ahora: () => ahora });
  // un operador con licencia y seguro hasta el 5-dic, y una ficha
  const op = await C.crear(juanma, 'operadores', { nombre: 'Volcanes Ejemplo S.A.', codigo_referido: 'acat-01' });
  assert.strictEqual(op.estado, 'pausado', 'un operador nuevo empieza pausado');
  assert.strictEqual(op.codigo_referido, 'ACAT-01');
  await assert.rejects(C.activar(juanma, 'operadores', op.id, true), (e) => e.status === 409 && /licencia/.test(e.message));
  await C.editar(juanma, 'operadores', op.id, { licencia_inguat: 'INGUAT-0000', licencia_vence: '2026-12-05', seguro_aseguradora: 'Aseguradora Ejemplo',
    seguro_poliza: 'POL-1', seguro_vence: '2027-06-30', comision_tipo: 'porcentaje', comision_valor: 10, requisitos: { inguat_registro: true, seguro_rc_accidentes: true, otra: true } });
  await C.activar(juanma, 'operadores', op.id, true);
  const exp = await C.crear(juanma, 'experiencias', { slug: 'acatenango-ejemplo', operador_id: op.id, titulo_es: 'Acatenango de ejemplo', titulo_en: 'Sample Acatenango',
    descripcion_es: 'Descripción de ejemplo.', descripcion_en: 'Sample description.', duracion_es: '2 días', duracion_en: '2 days', dificultad: 'dificil', idiomas: ['es', 'en'],
    precio_ref_q: 600, faq: 'Qué llevo? | Ropa abrigada | What to bring? | Warm clothes' });
  return { almacen, C, S, op, exp, ganchos, reconstruir, mover: (d) => { ahora = d; } };
}

test('Ficha: sale con el operador, el aviso legal y schema TouristTrip + Offer + FAQPage', async () => {
  const { C, op } = await armar();
  const op2 = (await C.borrador(juanma)).operadores.find((x) => x.id === op.id);
  assert.deepStrictEqual(Object.keys(op2.requisitos).sort(), AV.REQUISITOS.slice().sort(), 'solo los requisitos de la lista');
  const v = await C.vistaPrevia(juanma);
  assert.deepStrictEqual(v.fuera, []);
  const x = v.contenido.adventures.experiencias[0];
  assert.strictEqual(x.slug, 'acatenango-ejemplo');
  assert.deepStrictEqual(x.ruta, { en: '/adventures/acatenango-ejemplo', es: '/es/adventures/acatenango-ejemplo' });
  assert.deepStrictEqual(x.operador, { id: op.id, nombre: 'Volcanes Ejemplo S.A.', licencia_inguat: 'INGUAT-0000', codigo_referido: 'ACAT-01' });
  assert.match(x.aviso_legal.es, /la organiza y opera Volcanes Ejemplo S\.A\., empresa independiente registrada en INGUAT con el n\.º INGUAT-0000\. Rosanta solo la recomienda/);
  assert.match(x.aviso_legal.en, /operated by Volcanes Ejemplo S\.A\./);
  const [trip, faq] = x.schema.en;
  assert.strictEqual(trip['@type'], 'TouristTrip');
  assert.strictEqual(trip.url, 'https://rosanta.rest/adventures/acatenango-ejemplo');
  assert.deepStrictEqual(trip.provider, { '@type': 'Organization', name: 'Volcanes Ejemplo S.A.' });
  assert.deepStrictEqual([trip.offers.price, trip.offers.priceCurrency], ['600.00', 'GTQ']);
  assert.strictEqual(trip.disambiguatingDescription, x.aviso_legal.en, 'el aviso legal va también en los datos estructurados');
  assert.strictEqual(faq['@type'], 'FAQPage');
  assert.strictEqual(faq.mainEntity[0].name, 'What to bring?');
  assert.strictEqual(x.schema.es[0].url, 'https://rosanta.rest/es/adventures/acatenango-ejemplo');
  assert.ok(!JSON.stringify(v.contenido.adventures).includes('POL-1'), 'la póliza, la comisión y el contacto no salen al sitio');
  assert.ok(!JSON.stringify(v.contenido.adventures).includes('comision'));
});

test('Sin licencia o seguro vigente la ficha no sale; pausado tampoco', async () => {
  const { C, op } = await armar();
  await C.editar(juanma, 'operadores', op.id, { seguro_vence: '2026-11-01' });
  let v = await C.vistaPrevia(juanma);
  assert.strictEqual(v.contenido.adventures.experiencias.length, 0);
  assert.match(v.fuera[0], /el seguro venció el 2026-11-01/);
  await C.editar(juanma, 'operadores', op.id, { seguro_vence: '2027-06-30' });
  await C.activar(juanma, 'operadores', op.id, false);
  v = await C.vistaPrevia(juanma);
  assert.match(v.fuera[0], /pausado/);
  await assert.rejects(C.crear(juanma, 'experiencias', { slug: 'x', operador_id: 999, titulo_es: 'x', titulo_en: 'x' }), status(400));
  await assert.rejects(C.editar(juanma, 'experiencias', 1, { dificultad: 'extrema' }), status(400));
  await assert.rejects(C.editar(juanma, 'experiencias', 1, { idiomas: ['klingon'] }), status(400));
  await assert.rejects(C.editar(juanma, 'experiencias', 1, { faq: 'una línea mal hecha' }), status(400));
  await assert.rejects(C.editar(juanma, 'operadores', op.id, { codigo_referido: 'no vale!' }), status(400));
  await assert.rejects(C.editar(juanma, 'operadores', op.id, { licencia_vence: '31/12/2026' }), status(400));
});

test('Solo el dueño: operadores, experiencias y consultas', async () => {
  const { C, S, op, exp } = await armar();
  await assert.rejects(C.crear(vanessa, 'operadores', { nombre: 'x', codigo_referido: 'XXX' }), status(403));
  await assert.rejects(C.editar(vanessa, 'experiencias', exp.id, { titulo_es: 'x' }), status(403));
  await assert.rejects(C.activar(vanessa, 'operadores', op.id, false), status(403));
  await assert.rejects(S.leads(vanessa), status(403));
  await assert.rejects(S.resumenOperadores(vanessa), status(403));
});

test('Versiones: la ficha entra en la publicación y vuelve atrás con ella', async () => {
  const { C, exp } = await armar();
  const v1 = await C.publicar(juanma, 'v1');
  assert.strictEqual((await C.publicado()).adventures.experiencias[0].titulo.es, 'Acatenango de ejemplo');
  await C.editar(juanma, 'experiencias', exp.id, { titulo_es: 'Acatenango cambiado', precio_ref_q: 650 });
  await C.publicar(juanma, 'v2');
  assert.strictEqual((await C.publicado()).adventures.experiencias[0].precio_ref_q, 650);
  await C.volverA(juanma, v1.version);
  const pub = await C.publicado();
  assert.strictEqual(pub.huella, v1.huella);
  const b = await C.borrador(juanma);
  assert.deepStrictEqual([b.experiencias[0].titulo_es, b.experiencias[0].precio_ref_q], ['Acatenango de ejemplo', 600]);
});

test('Consulta: crea el lead con el código del operador, llama al pipeline (tipo adventure), avisa y reserva la cena', async () => {
  const { S, almacen, ganchos, op } = await armar();
  const r = await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'Visitante Prueba', email: 'visitante@prueba.test', idioma: 'en', fecha: '2026-11-20', personas: 2,
    mensaje: 'Hola', cena: { fecha: '2026-11-21', hora: '19:30' }, origen: { utm_source: 'google' } });
  assert.deepStrictEqual([r.ok, r.cena.estado], [true, 'reservada']);
  assert.match(r.mensaje, /Thank you/);
  const l = (await almacen.lista('leads_adventures'))[0];
  assert.deepStrictEqual([l.operador_id, l.codigo_referido, l.estado, l.pipeline_id, l.cena_reserva_id, l.cena_personas], [op.id, 'ACAT-01', 'nuevo', 'ev_' + l.id, 'res_1', 2]);
  assert.strictEqual(ganchos.llamados.pipeline[0].tipo, 'adventure');
  assert.strictEqual(ganchos.llamados.pipeline[0].codigo_referido, 'ACAT-01');
  assert.deepStrictEqual(ganchos.llamados.crearReserva[0], { fecha: '2026-11-21', hora: '19:30', personas: 2, nombre: 'Visitante Prueba', email: 'visitante@prueba.test',
    telefono: null, idioma: 'en', origen: 'adventures', codigo: 'ACAT-01', nota: 'Después de: Acatenango de ejemplo' });
  assert.match(ganchos.llamados.avisarJuanma[0].asunto, /Adventures: consulta/);
  // sin cena: no se llama al motor
  await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'Otra', email: 'otra@prueba.test', idioma: 'es' });
  assert.strictEqual(ganchos.llamados.crearReserva.length, 1);
});

test('Consulta: si un gancho falla o no hay mesa, el lead queda igual; validaciones y fichas que no salen', async () => {
  const { S, almacen } = await armar({ pipelineFalla: true, sinMesa: true });
  const r = await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', idioma: 'es', cena: { fecha: '2026-11-21', hora: '20:00', personas: 4 } });
  assert.strictEqual(r.cena.estado, 'sin_disponibilidad');
  const l = (await almacen.lista('leads_adventures'))[0];
  assert.deepStrictEqual([l.pipeline_id, l.ganchos.pipeline.estado, l.cena_reserva_id], [null, 'error', null]);
  await assert.rejects(S.consulta({ experiencia: 'no-existe', nombre: 'V', email: 'v@prueba.test' }), status(404));
  await assert.rejects(S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'no-es-correo' }), status(400));
  await assert.rejects(S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', cena: {} }), status(400));
  await assert.rejects(S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', fecha: '2026-01-01' }), status(400), 'no en el pasado');
  await assert.rejects(S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', sitio_web: 'spam' }), status(400));
  // sin ganchos inyectados: el lead queda y la cena queda pendiente (la confirma el equipo)
  const S2 = AV.crearAdventures({ almacen, matriz: M, ahora: () => HOY });
  const r2 = await S2.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', cena: { fecha: '2026-11-21', hora: '20:00' } });
  assert.strictEqual(r2.cena.estado, 'pendiente');
});

test('Comisión: al marcar vendido se calcula con el acuerdo del operador (o la escribe el dueño)', async () => {
  const { S } = await armar();
  const { id } = await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', personas: 2 });
  await S.actualizarLead(juanma, id, { estado: 'pasado_al_operador' });
  const l = await S.actualizarLead(juanma, id, { estado: 'vendido', venta_q: '1,200' });
  assert.deepStrictEqual([l.estado, l.venta_q, l.comision_q], ['vendido', 1200, 120]);
  assert.ok(l.comision_registrada);
  const l2 = await S.actualizarLead(juanma, id, { comision_q: 100 });
  assert.strictEqual(l2.comision_q, 100);
  await assert.rejects(S.actualizarLead(juanma, id, { estado: 'inventado' }), status(400));
  const res = await S.resumenOperadores(juanma);
  assert.deepStrictEqual([res[0].leads, res[0].vendidos, res[0].comision_q], [1, 1, 100]);
});

test('Vencimientos: aviso a 30 días una sola vez; al vencer se pausa y sus fichas salen del sitio solas', async () => {
  const x = await armar();
  await x.C.publicar(juanma, 'con Acatenango');
  // 10-nov: la licencia vence el 5-dic (25 días) → aviso
  let r = await x.S.revisarVencimientos();
  assert.strictEqual(r.avisos.length, 1);
  assert.match(r.avisos[0].texto, /licencia de INGUAT vence el 2026-12-05/);
  r = await x.S.revisarVencimientos();
  assert.strictEqual(r.avisos.length, 0, 'no se repite el aviso');
  // el borrador tiene un cambio sin publicar: la pausa NO lo publica
  await x.C.editar(juanma, 'faq', (await x.C.crear(juanma, 'faq', { pregunta_es: 'p', pregunta_en: 'q', respuesta_es: 'r', respuesta_en: 'a' })).id, { respuesta_es: 'sin publicar' });
  x.mover(new Date('2026-12-06T16:00:00Z'));
  r = await x.S.revisarVencimientos();
  assert.strictEqual(r.pausados.length, 1);
  assert.strictEqual(x.ganchos.llamados.avisarJuanma.filter((a) => /pausado/.test(a.asunto)).length, 1);
  const pub = await x.C.publicado();
  assert.strictEqual(pub.version, r.republicada.version);
  assert.strictEqual(pub.adventures.experiencias.length, 0, 'la ficha salió del sitio');
  assert.strictEqual(pub.faq.length, 0, 'y no se colaron cambios del borrador');
  const vs = await x.C.versiones(juanma);
  assert.strictEqual(vs[0].publicada_por, 'sistema'); assert.match(vs[0].nota, /Pausa automática: Volcanes Ejemplo/);
  assert.strictEqual(x.reconstruir.pedidos.length, 2, 'y se pidió reconstruir el sitio');
  const op = (await x.C.borrador(juanma)).operadores[0];
  assert.strictEqual(op.estado, 'vencido');
  await assert.rejects(x.C.activar(juanma, 'operadores', op.id, true), (e) => e.status === 409 && /licencia/.test(e.message));
  r = await x.S.revisarVencimientos();
  assert.deepStrictEqual([r.pausados.length, r.republicada], [0, null], 'la segunda vez no hace nada');
});

test('Rutas: la consulta es pública; leads y la tarea con su llave', async () => {
  const { S } = await armar();
  const app = express();
  app.use(express.json());
  app.use(crearRutasAdventures({ adventures: S, claveTareas: 'k', identificar: async (t) => ({ d: juanma, p: vanessa })[t] || null }));
  const srv = app.listen(0), b = 'http://127.0.0.1:' + srv.address().port;
  try {
    let r = await fetch(b + '/api/adventures/consulta', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiencia: 'acatenango-ejemplo', nombre: 'V', email: 'v@prueba.test', idioma: 'es' }) });
    assert.strictEqual(r.status, 200); assert.match((await r.json()).mensaje, /Gracias/);
    r = await fetch(b + '/api/adventures/leads'); assert.strictEqual(r.status, 401);
    r = await fetch(b + '/api/adventures/leads', { headers: { 'x-rosanta-u': 'p' } }); assert.strictEqual(r.status, 403);
    r = await fetch(b + '/api/adventures/leads', { headers: { 'x-rosanta-u': 'd' } }); assert.strictEqual((await r.json()).length, 1);
    r = await fetch(b + '/tareas/adventures-vencimientos', { method: 'POST' }); assert.strictEqual(r.status, 403);
    r = await fetch(b + '/tareas/adventures-vencimientos', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } }); assert.strictEqual(r.status, 200);
  } finally { srv.close(); }
});
