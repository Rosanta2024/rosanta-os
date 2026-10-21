// Formulario de cotización de eventos (rosanta-web → pipeline de rosanta-clientes + aviso a Juanma). Sin red.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const Q = require('../src/cotizacion-web');

const AHORA = Date.parse('2026-11-10T16:00:00Z');
const LLAVES = ['id', 'tipo', 'tipo_evento', 'nombre', 'email', 'telefono', 'idioma', 'fecha', 'personas', 'menu', 'presupuesto', 'mensaje', 'origen'];

test('arma SIEMPRE las 13 llaves, normaliza y valida', () => {
  const a = Q.armarCotizacion({ nombre: ' Ana ', email: 'Ana@Ejemplo.Test', idioma: 'en', tipo_evento: 'boda', fecha: '2026-12-12', personas: '80', menu: 'especiales',
    presupuesto: 'Q40,000', mensaje: 'Jardín', origen: { utm_source: 'chatgpt.com', 'mal llave!': 'x' }, sobra: 'no' }, AHORA, () => 'u1');
  assert.deepStrictEqual(Object.keys(a.cuerpo), LLAVES);
  assert.deepStrictEqual([a.cuerpo.email, a.cuerpo.personas, a.cuerpo.tipo_evento, a.cuerpo.telefono], ['ana@ejemplo.test', 80, 'boda', null]);
  assert.deepStrictEqual(a.cuerpo.origen, { utm_source: 'chatgpt.com', 'mal_llave_': 'x' });
  const min = Q.armarCotizacion({ nombre: 'Beto', email: 'b@ejemplo.test', idioma: 'es' }, AHORA, () => 'u2');
  assert.deepStrictEqual([min.cuerpo.tipo_evento, min.cuerpo.menu, min.cuerpo.fecha, min.cuerpo.personas], ['otro', 'no_se', null, null]);
  assert.ok(Q.armarCotizacion({ nombre: 'X', email: 'malo' }, AHORA, () => 'u').error);
  assert.ok(Q.armarCotizacion({ nombre: 'X', email: 'x@e.test', fecha: '2026-11-01' }, AHORA, () => 'u').error);   // pasada
  assert.ok(Q.armarCotizacion({ nombre: 'X', email: 'x@e.test', sitio_web: 'bot' }, AHORA, () => 'u').error);       // trampa
});

async function servidor(deps) {
  const app = express(); app.use(Q.crearRutasCotizacion(Object.assign({ reloj: () => AHORA, nuevoId: () => 'u1' }, deps)));
  const s = http.createServer(app); await new Promise((ok) => s.listen(0, ok));
  return { url: 'http://127.0.0.1:' + s.address().port, cerrar: () => new Promise((ok) => s.close(ok)) };
}

test('la ruta manda al pipeline y avisa a Juanma; si el pipeline falla el aviso lo dice; sin nada, 503', async () => {
  const pipe = [], avisos = [];
  let s = await servidor({ pipeline: async (c) => { pipe.push(c); return { id: 'cotizacion-web-u1' }; }, avisarJuanma: async (m) => { avisos.push(m); return { estado: 'enviado' }; } });
  const cuerpo = JSON.stringify({ nombre: 'Ana', email: 'ana@ejemplo.test', idioma: 'es', tipo_evento: 'privado', personas: 20 });
  let r = await fetch(s.url + '/api/eventos/cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.rosanta.rest' }, body: cuerpo });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('access-control-allow-origin'), 'https://www.rosanta.rest');
  assert.deepStrictEqual(Object.keys(pipe[0]), LLAVES);
  assert.match(avisos[0].texto, /Tipo: privado/);
  r = await fetch(s.url + '/api/eventos/cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example' }, body: cuerpo });
  assert.strictEqual(r.status, 403);
  await s.cerrar();

  avisos.length = 0;
  s = await servidor({ pipeline: async () => { throw new Error('caido'); }, avisarJuanma: async (m) => { avisos.push(m); return { estado: 'enviado' }; } });
  r = await fetch(s.url + '/api/eventos/cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });
  assert.strictEqual(r.status, 200);
  assert.match(avisos[0].texto, /no entró al pipeline/);
  await s.cerrar();

  s = await servidor({ pipeline: async () => ({ estado: 'sin_gancho' }), avisarJuanma: async () => ({ estado: 'apagado' }) });
  r = await fetch(s.url + '/api/eventos/cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });
  assert.strictEqual(r.status, 503);
  assert.match((await r.json()).error, /3082 6935/);
  await s.cerrar();
});
