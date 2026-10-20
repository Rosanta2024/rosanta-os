/**
 * Comparación de cada noche del correo en sombra (20-oct-2026): bot_correo_sombra contra lo que hizo el bot de
 * Apps Script en Gmail. Gmail (por la API, vía gmail-sincrono) y la base de mentira; nada sale a internet.
 */
const test = require('node:test');
const assert = require('node:assert');
const { compararCorreoNoche, correoDe, esGrave } = require('../src/correo-comparar');
const { crearGmailSincrono } = require('../src/gmail-sincrono');
const { crearCanalCorreo } = require('../src/correo-canal');

const AHORA = Date.parse('2026-10-21T06:00:00Z');
const H = 3600 * 1000;
const NOSOTROS = 'Rosanta <restaurante@rosanta.rest>';

function msg(id, de, t, op) {
  const o = op || {};
  const headers = [{ name: 'From', value: de }, { name: 'Subject', value: o.asunto || 'Reserva' }];
  if (o.para) headers.push({ name: 'To', value: o.para });
  return { id, internalDate: String(t), labelIds: o.borrador ? ['DRAFT'] : ['INBOX'], payload: { mimeType: 'text/plain', headers, body: { data: '' } } };
}

/** Gmail de mentira por la API: hilos por id; la búsqueda devuelve los hilos cuyo filtro acepta la consulta. */
function gmailDeMentira(hilos, busquedas) {
  const consultas = [];
  const pedido = (url, op) => {
    assert.strictEqual(String(op.method || 'get').toLowerCase(), 'get', 'la comparación solo lee Gmail');
    assert.match(String(op.headers.Authorization), /\$GMAIL_TOKEN/, 'el token viaja como marcador');
    const r = (c, j) => ({ getResponseCode: () => c, getContentText: () => JSON.stringify(j) });
    let m = url.match(/\/threads\/([^?]+)\?format=full/);
    if (m) return hilos[m[1]] ? r(200, { id: m[1], messages: hilos[m[1]] }) : r(404, { error: 'not found' });
    m = url.match(/\/threads\?q=([^&]+)/);
    if (m) {
      const q = decodeURIComponent(m[1]);
      consultas.push(q);
      return r(200, { threads: (busquedas || []).filter((b) => b.si(q)).map((b) => ({ id: b.hilo })) });
    }
    return r(404, {});
  };
  return { pedido, consultas, gmail: crearGmailSincrono({ pedido, escribir: false }) };
}

function poolDeMentira(filas) {
  const tabla = filas.map((f, i) => Object.assign({ id: i + 1, hilo: '', mensaje: '', para: '', asunto: '', cuerpo: '', comparado: null }, f));
  return {
    tabla,
    query: async (sql, p) => {
      if (/WHERE tipo IN \('respuesta', 'borrador'\) AND comparado IS NULL AND cuando < \$1/.test(sql)) {
        return { rows: tabla.filter((f) => (f.tipo === 'respuesta' || f.tipo === 'borrador') && f.comparado === null && f.cuando < p[0]) };
      }
      if (/WHERE tipo = 'aviso' AND cuando >= \$1/.test(sql)) return { rows: tabla.filter((f) => f.tipo === 'aviso' && f.cuando >= p[0]) };
      if (/UPDATE bot_correo_sombra SET comparado = \$2 WHERE id = \$1/.test(sql)) { tabla.find((f) => f.id === p[0]).comparado = p[1]; return { rows: [] }; }
      throw new Error('consulta no prevista: ' + sql.slice(0, 80));
    }
  };
}
const fecha = (t) => new Date(t);
const aviso = (email, t) => ({ tipo: 'aviso', cuando: fecha(t), para: 'restaurante@rosanta.rest', asunto: '🔔 Lead para atender (correo) — ' + email });

test('Comparar correo: igual cuando el real hizo lo mismo (respuesta; borrador con su aviso)', async () => {
  const t0 = AHORA - 10 * H;
  const g = gmailDeMentira({
    h1: [msg('c1', 'Ana <ana@ejemplo.test>', t0), msg('r1', NOSOTROS, t0 + 4 * 60000)],
    h2: [msg('c2', 'Beto <beto@ejemplo.test>', t0), msg('d2', NOSOTROS, t0 + 3 * 60000, { borrador: true })],
    a2: [msg('av2', 'restaurante@rosanta.rest', t0 + 3 * 60000, { asunto: '🔔 Lead para atender (correo) — beto@ejemplo.test' })]
  }, [{ hilo: 'a2', si: (q) => /Lead para atender \(correo\)/.test(q) && q.indexOf('beto@ejemplo.test') >= 0 }]);
  const pool = poolDeMentira([
    { tipo: 'respuesta', cuando: fecha(t0 + 5 * 60000), hilo: 'h1', mensaje: 'c1', para: '"Ana" <ana@ejemplo.test>' },
    { tipo: 'borrador', cuando: fecha(t0 + 5 * 60000), hilo: 'h2', mensaje: 'c2', para: 'Beto <Beto@Ejemplo.test>' },
    aviso('beto@ejemplo.test', t0 + 5 * 60000)
  ]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.deepStrictEqual({ ok: r.ok, revisadas: r.revisadas, iguales: r.iguales, distintas: r.distintas.length }, { ok: true, revisadas: 2, iguales: 2, distintas: 0 });
  assert.deepStrictEqual(pool.tabla.map((f) => f.comparado), ['igual', 'igual', null], 'el aviso de la sombra no se marca: solo respuesta y borrador');
});

test('Comparar correo: distinto GRAVE (la sombra contestaría sola y el real dejó borrador) → ok=false', async () => {
  const t0 = AHORA - 5 * H;
  const g = gmailDeMentira({ h1: [msg('c1', 'ana@ejemplo.test', t0), msg('d1', NOSOTROS, t0 + 60000, { borrador: true })] });
  const pool = poolDeMentira([{ tipo: 'respuesta', cuando: fecha(t0 + 2 * 60000), hilo: 'h1', mensaje: 'c1', para: 'ana@ejemplo.test' }]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.distintas, [{ id: 1, hilo: 'h1', comparado: 'distinto: sombra=respuesta real=borrador', grave: true }]);
  assert.strictEqual(pool.tabla[0].comparado, 'distinto: sombra=respuesta real=borrador');
});

test('Comparar correo: distinto LEVE (borrador en los dos, pero el aviso real no llegó) → ok=true', async () => {
  const t0 = AHORA - 5 * H;
  const g = gmailDeMentira({
    h1: [msg('c1', 'Beto <beto@ejemplo.test>', t0), msg('d1', NOSOTROS, t0 + 60000, { borrador: true })],
    otro: [msg('av', 'restaurante@rosanta.rest', t0, { asunto: '🔔 Lead para atender (correo) — otra@ejemplo.test' })]
  }, [{ hilo: 'otro', si: (q) => /Lead para atender/.test(q) }]);   // la búsqueda trae un aviso de OTRO cliente: no cuenta
  const pool = poolDeMentira([{ tipo: 'borrador', cuando: fecha(t0 + 2 * 60000), hilo: 'h1', mensaje: 'c1', para: 'beto@ejemplo.test' }, aviso('beto@ejemplo.test', t0 + 2 * 60000)]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.distintas, [{ id: 1, hilo: 'h1', comparado: 'distinto: sombra=borrador+aviso real=borrador', grave: false }]);
  assert.ok(g.consultas.some((q) => /^subject:"Lead para atender \(correo\)" "beto@ejemplo\.test" after:\d+ before:\d+$/.test(q)), g.consultas.join(' | '));
});

test('Comparar correo: una fila de hace menos de 2 h no se compara (ni se toca Gmail)', async () => {
  const g = gmailDeMentira({});
  const pool = poolDeMentira([{ tipo: 'respuesta', cuando: fecha(AHORA - 1 * H), hilo: 'h1', mensaje: 'c1', para: 'ana@ejemplo.test' }]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.deepStrictEqual(r, { ok: true, revisadas: 0, iguales: 0, distintas: [], errores: [] });
  assert.strictEqual(pool.tabla[0].comparado, null);
  assert.strictEqual(g.consultas.length, 0);
});

test('Comparar correo, control negativo: lo nuestro ANTES del cliente, o de afuera, no es respuesta; ya comparadas no se repiten', async () => {
  const t0 = AHORA - 5 * H;
  const g = gmailDeMentira({ h1: [
    msg('viejo', NOSOTROS, t0 - H),                                   // contestamos ANTES del mensaje del cliente
    msg('c1', 'Ana <ana@ejemplo.test>', t0),
    msg('fw', 'Primo <rosanta.rest@gmail.com>', t0 + 60000),          // nombre parecido, pero no es @rosanta.rest
    msg('c1b', 'Ana <ana@ejemplo.test>', t0 + 2 * 60000)
  ] });
  const pool = poolDeMentira([
    { tipo: 'respuesta', cuando: fecha(t0 + 3 * 60000), hilo: 'h1', mensaje: 'c1', para: 'ana@ejemplo.test' },
    { tipo: 'respuesta', cuando: fecha(t0), hilo: 'h1', mensaje: 'c1', para: 'ana@ejemplo.test', comparado: 'igual' }
  ]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.revisadas, 1, 'la fila ya comparada no se vuelve a mirar');
  assert.strictEqual(pool.tabla[0].comparado, 'distinto: sombra=respuesta real=nada');
  assert.strictEqual(pool.tabla[1].comparado, 'igual');
  // Las reglas de gravedad, en las dos direcciones.
  assert.strictEqual(esGrave('respuesta', 'nada'), true);
  assert.strictEqual(esGrave('nada', 'respuesta'), true);
  assert.strictEqual(esGrave('borrador', 'respuesta'), false, 'Juanma mandó el borrador: leve');
  assert.strictEqual(esGrave('borrador', 'nada'), false);
  assert.strictEqual(esGrave('respuesta', 'respuesta'), false);
  assert.strictEqual(correoDe('"Ana, la de <x>" <Ana@Ejemplo.TEST>'), 'ana@ejemplo.test');
});

test('Comparar correo: hilo borrado = distinto leve; error de Gmail = fila sin comparar y ok=false', async () => {
  const t0 = AHORA - 5 * H;
  const g = gmailDeMentira({});
  const pool = poolDeMentira([{ tipo: 'borrador', cuando: fecha(t0), hilo: 'no-existe', mensaje: 'c', para: 'ana@ejemplo.test' }]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.strictEqual(pool.tabla[0].comparado, 'distinto: sombra=borrador real=sin hilo');
  assert.strictEqual(r.ok, true);
  const roto = crearGmailSincrono({ escribir: false, pedido: () => ({ getResponseCode: () => 500, getContentText: () => 'caído' }) });
  const pool2 = poolDeMentira([{ tipo: 'respuesta', cuando: fecha(t0), hilo: 'h1', mensaje: 'c', para: 'ana@ejemplo.test' }]);
  const r2 = await compararCorreoNoche({ pool: pool2, gmail: roto, ahora: AHORA });
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.errores.length, 1);
  assert.strictEqual(pool2.tabla[0].comparado, null, 'se reintenta la noche siguiente');
});

test('Comparar correo: borrador sin hilo (chat de Wix) se busca por destinatario', async () => {
  const t0 = AHORA - 5 * H;
  const g = gmailDeMentira({ d: [msg('d', NOSOTROS, t0 + 60000, { borrador: true, para: 'visita@ejemplo.test' })] },
    [{ hilo: 'd', si: (q) => /in:drafts in:sent\} to:visita@ejemplo\.test after:\d+$/.test(q) }]);
  const pool = poolDeMentira([{ tipo: 'borrador', cuando: fecha(t0 + 2 * 60000), para: 'visita@ejemplo.test', asunto: 'Re: tu mensaje a Rosanta' }]);
  const r = await compararCorreoNoche({ pool, gmail: g.gmail, ahora: AHORA });
  assert.strictEqual(pool.tabla[0].comparado, 'igual', g.consultas.join(' | '));
  assert.strictEqual(r.ok, true);
});

test('Ruta /tareas/comparar-correo-noche: pide la clave, arma Gmail con la red y el token, 409 si hay diferencia grave', async () => {
  const t0 = Date.now() - 5 * H;
  const g = gmailDeMentira({ h1: [msg('c1', 'ana@ejemplo.test', t0)] });
  const pedido = (url, op) => { const r = g.pedido(url, op); return { c: r.getResponseCode(), t: r.getContentText() }; };
  const pool = poolDeMentira([{ tipo: 'respuesta', cuando: fecha(t0 + 60000), hilo: 'h1', mensaje: 'c1', para: 'ana@ejemplo.test' }]);
  const claves = {};
  const canalCorreo = crearCanalCorreo({ pool, espejo: { libro: {}, aplicar: async () => 0 }, leadsId: 'l', kb: async () => 'KB', claves, wixOrigen: 'https://www.rosanta.rest',
    soloSombra: true, accessToken: async () => 'tok-gmail', correo: async () => {}, pedido });
  const { crearAppBot } = require('../src/app-bot');
  const srv = crearAppBot({ servicio: {}, claveTareas: 'clave', version: 't', canalCorreo, pool }).listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/tareas/comparar-correo-noche';
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    assert.strictEqual((await fetch(url, { method: 'POST' })).status, 403);
    assert.strictEqual(pool.tabla[0].comparado, null);
    const r = await fetch(url, { method: 'POST', headers: { 'x-rosanta-tarea': 'clave' } });
    assert.strictEqual(r.status, 409);
    const j = await r.json();
    assert.strictEqual(j.distintas[0].comparado, 'distinto: sombra=respuesta real=nada');
    assert.strictEqual(claves.GMAIL_TOKEN, 'tok-gmail', 'el token se pone en las claves, fuera del motor');
    const r2 = await fetch(url, { method: 'POST', headers: { 'x-rosanta-tarea': 'clave' } });
    assert.strictEqual(r2.status, 200, 'la segunda noche no hay nada pendiente');
  } finally { console.error = errorOriginal; srv.close(); }
  const sinCorreo = crearAppBot({ servicio: {}, claveTareas: 'clave', version: 't' }).listen(0);
  try {
    const r = await fetch('http://127.0.0.1:' + sinCorreo.address().port + '/tareas/comparar-correo-noche', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave' } });
    assert.strictEqual(r.status, 404, 'sin canal de correo la ruta no existe');
  } finally { sinCorreo.close(); }
});
