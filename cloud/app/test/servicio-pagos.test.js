// Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/copia-hojas');
const { libros } = require('./fixtura');
const { crearServicioPagos, LECTURA, ESCRITURA } = require('../src/servicio-pagos');
const { crearApp } = require('../src/app');
const U = require('../src/usuarios');
const pantalla = require('../src/pantalla-pagos');
const fs = require('fs');
const path = require('path');

/** La copia guardada en la base, como la devolveria hojas_copia (libro CFG = Config). */
function poolConCopia() {
  const L = libros();
  const filas = [];
  Object.keys(L).forEach((libro) => Object.keys(L[libro]).forEach((p) =>
    filas.push({ libro: libro === 'CFG' ? C.LIBROS.config.id : libro, pestana: p, filas: JSON.parse(JSON.stringify(C.codificar(L[libro][p]))), leida: new Date() })));
  const tiempos = [];
  const usuarios = U.usuariosDeFilas([['c', 'r', 'm', 'e', 'n', 't'], ['chef@x', 'chef', 'pagos', 'NO', 'Jeffry', 'tok-chef'], ['otro@x', 'chef', 'recetario', 'NO', 'Otro', 'tok-otro']]);
  return {
    tiempos,
    query: async (sql, p) => {
      if (/FROM hojas_copia/.test(sql)) return { rows: filas };
      if (/FROM usuarios WHERE token_huella/.test(sql)) return { rows: usuarios.filter((u) => u.token_huella === p[0]) };
      if (/INSERT INTO tiempos/.test(sql)) { tiempos.push(p); return { rows: [] }; }
      throw new Error('consulta no esperada ' + sql);
    }
  };
}

async function servir(deps, fn) {
  const srv = crearApp(deps).listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const llamar = (b, nombre, args, tok) => fetch(b + '/api/llamar/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok || '' }, body: JSON.stringify(args || []) });

test('En sombra la pantalla muestra y NO guarda nada', async () => {
  const pool = poolConCopia();
  const P = crearServicioPagos(pool, { modo: 'sombra' });
  await P.cargar();
  const deps = { pool, pagos: P, anotarTiempo: (t) => pool.query('INSERT INTO tiempos', [t.accion, t.donde, t.ms, t.quien]) };
  await servir(deps, async (b) => {
    const r = await llamar(b, 'getPagosProveedores', [], 'tok-chef');
    const j = await r.json();
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(j.resultado.facturas.map((f) => f.dte).sort(), ['1001', '1002']);
    const w = await llamar(b, 'registrarPagoFacturas', [['111|1001'], 'Pagado de caja', '2026-10-17'], 'tok-chef');
    assert.strictEqual(w.status, 409);
    assert.match((await w.json()).error, /solo muestra/);
    const otra = await (await llamar(b, 'getPagosProveedores', [], 'tok-chef')).json();
    assert.strictEqual(otra.resultado.facturas.find((f) => f.dte === '1001').estado, 'Pendiente', 'nada cambio');
  });
  assert.ok(pool.tiempos.some((t) => t[0] === 'Pagos · getPagosProveedores' && t[1] === 'servidor'), 'cada llamada deja su tiempo');
});

test('Sin enlace no hay Pagos; sin modulo, el mensaje de la intranet', async () => {
  const pool = poolConCopia();
  const P = crearServicioPagos(pool, { modo: 'sombra' }); await P.cargar();
  await servir({ pool, pagos: P }, async (b) => {
    assert.strictEqual((await llamar(b, 'getPagosProveedores', [], '')).status, 401);
    const r = await llamar(b, 'getPagosProveedores', [], 'tok-otro');
    assert.strictEqual(r.status, 400);
    assert.match((await r.json()).error, /no tiene pagos/);
  });
});

test('Solo se puede llamar lo que la pantalla de Pagos usa', async () => {
  const pool = poolConCopia();
  const P = crearServicioPagos(pool, { modo: 'sombra' }); await P.cargar();
  await servir({ pool, pagos: P }, async (b) => {
    for (const fn of ['_finCalcular_', 'getUsuarioPorToken_', 'generarTokensUsuarios', 'constructor', '__proto__']) {
      const r = await llamar(b, fn, [], 'tok-chef');
      assert.ok(r.status === 404, fn + ' dio ' + r.status);
    }
  });
});

test('La lista de funciones cubre todo lo que llama la pantalla de Pagos', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'intranet', 'ProfitPagosJs.html'), 'utf8');
  const llamadas = Array.from(new Set((html.match(/\.([a-zA-Z_]+)\(AUTH/g) || []).map((x) => x.slice(1, -5))));
  assert.ok(llamadas.length >= 15, 'control: la pantalla llama a ' + llamadas.length);
  const faltan = llamadas.filter((n) => LECTURA.indexOf(n) === -1 && ESCRITURA.indexOf(n) === -1);
  assert.deepStrictEqual(faltan, [], 'cada funcion de la pantalla esta clasificada como lectura o escritura');
});

test('La pagina de Pagos se arma y sus scripts compilan', () => {
  const h = pantalla.armar({ sombra: true });
  assert.match(h, /Prueba en sombra/);
  assert.match(h, /window\.PF_PAGOS = function/);
  assert.match(h, /window\.PF_ERROR = function/);
  assert.match(h, /window\.PF_DONDE = function/);
  assert.match(h, /--rosanta-verde:/, 'la paleta viene de PaletaServidor.js');
  const scripts = h.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.slice(8, -9));
  scripts.forEach((x) => assert.doesNotThrow(() => new Function(x)));
});
