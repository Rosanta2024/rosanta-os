// El puente de la pantalla nueva (18-oct-2026): "Leer cierres" y leer la foto del comprobante los corre
// la intranet que contiene la pantalla. Se prueba el TRADUCTOR con una ventana y un padre de mentira.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { TRADUCTOR } = require('../src/pantalla-pagos');

const GOOGLE = 'https://n-abc123-0lu-script.googleusercontent.com';

function armarVentana({ dentro = true, origenPadre = GOOGLE, salud = { pagos: { en_vivo: { cierres: false } } } } = {}) {
  const oyentes = [], enviados = [], fetches = [];
  const padre = { postMessage: (m, o) => enviados.push({ m, o }) };
  const win = {
    location: { search: dentro ? '?u=TOK&dentro=1' : '?u=TOK', ancestorOrigins: [origenPadre] },
    document: { referrer: '' },
    addEventListener: (t, f) => { if (t === 'message') oyentes.push(f); },
    AUTH: 'TOK',
  };
  win.parent = dentro ? padre : win;
  win.window = win;
  const respuestas = {
    '/salud': salud,
    '/api/llamar/getCajaChica': { resultado: { saldo: 123, origen: 'servidor' } },
    '/api/llamar/getPagos': { resultado: { ok: 1 } },
  };
  win.fetch = (url, op) => {
    fetches.push({ url, op });
    const j = respuestas[url] || { error: 'no' };
    return Promise.resolve({ ok: !!respuestas[url], status: respuestas[url] ? 200 : 409, json: () => Promise.resolve(j) });
  };
  const ctx = vm.createContext(Object.assign(win, { URLSearchParams, URL, Proxy, Promise, setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref(); return t; } }));
  vm.runInContext(TRADUCTOR, ctx);
  const responder = (data, origin = origenPadre, source = padre) => oyentes.forEach((f) => f({ data, origin, source }));
  return { win: ctx, enviados, fetches, responder, padre };
}
// lo que sale del vm es de otro "reino" (otro Array): se compara por su JSON
const igual = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
const esperar = () => new Promise((r) => setTimeout(r, 20));

test('dentro de la intranet, leerComprobanteCompra va al padre (Google) y la respuesta vuelve', async () => {
  const v = armarVentana();
  let ok = null;
  v.win.google.script.run.withSuccessHandler((r) => { ok = r; }).leerComprobanteCompra('TOK', { nombre: 'f.jpg', datos: 'AAA' });
  assert.strictEqual(v.enviados.length, 1);
  assert.strictEqual(v.enviados[0].o, GOOGLE);
  igual(v.enviados[0].m.rosantaPuente.nombre, 'leerComprobanteCompra');
  igual(v.enviados[0].m.rosantaPuente.args, [{ nombre: 'f.jpg', datos: 'AAA' }]);
  assert.strictEqual(v.fetches.length, 0, 'no se llama al servidor');
  v.responder({ rosantaPuenteResp: { id: v.enviados[0].m.rosantaPuente.id, ok: true, resultado: { compras: [1] } } });
  igual(ok, { compras: [1] });
});

test('una respuesta de otro origen o de otra ventana se ignora', async () => {
  const v = armarVentana();
  let ok = null;
  v.win.google.script.run.withSuccessHandler((r) => { ok = r; }).leerComprobanteCompra('TOK', {});
  const id = v.enviados[0].m.rosantaPuente.id;
  v.responder({ rosantaPuenteResp: { id, ok: true, resultado: 'malo' } }, 'https://evil.example');
  v.responder({ rosantaPuenteResp: { id, ok: true, resultado: 'malo' } }, GOOGLE, { otro: 1 });
  assert.strictEqual(ok, null);
});

test('el error de la intranet llega al manejador de error', async () => {
  const v = armarVentana();
  let mal = null;
  v.win.google.script.run.withFailureHandler((e) => { mal = e.message; }).leerCierresCaja('TOK');
  v.responder({ rosantaPuenteResp: { id: v.enviados[0].m.rosantaPuente.id, ok: false, error: 'Sin correo' } });
  assert.strictEqual(mal, 'Sin correo');
});

test('leerCierresCaja con cierres en sheets devuelve lo de la intranet tal cual', async () => {
  const v = armarVentana();
  let ok = null;
  v.win.google.script.run.withSuccessHandler((r) => { ok = r; }).leerCierresCaja('TOK');
  v.responder({ rosantaPuenteResp: { id: v.enviados[0].m.rosantaPuente.id, ok: true, resultado: { saldo: 9, lectura_ahora: { leidos: 1 } } } });
  await esperar();
  igual(ok, { saldo: 9, lectura_ahora: { leidos: 1 } });
});

test('leerCierresCaja con cierres en base: la caja la da el servidor, con la lectura de la intranet', async () => {
  const v = armarVentana({ salud: { pagos: { en_vivo: { cierres: true } } } });
  let ok = null;
  v.win.google.script.run.withSuccessHandler((r) => { ok = r; }).leerCierresCaja('TOK');
  v.responder({ rosantaPuenteResp: { id: v.enviados[0].m.rosantaPuente.id, ok: true, resultado: { saldo: 9, lectura_ahora: { leidos: 1 } } } });
  await esperar();
  igual(ok, { saldo: 123, origen: 'servidor', lectura_ahora: { leidos: 1 } });
});

test('fuera de la intranet, o con un padre que no es Google, va al servidor (que contesta 409)', async () => {
  for (const op of [{ dentro: false }, { origenPadre: 'https://evil.example' }]) {
    const v = armarVentana(op);
    let mal = null;
    v.win.google.script.run.withFailureHandler((e) => { mal = e.message; }).leerComprobanteCompra('TOK', {});
    await esperar();
    assert.strictEqual(v.enviados.length, 0);
    assert.strictEqual(v.fetches[0].url, '/api/llamar/leerComprobanteCompra');
    assert.ok(mal);
  }
});

test('las demas funciones nunca usan el puente', async () => {
  const v = armarVentana();
  let ok = null;
  v.win.google.script.run.withSuccessHandler((r) => { ok = r; }).getPagos('TOK');
  await esperar();
  assert.strictEqual(v.enviados.length, 0);
  igual(ok, { ok: 1 });
  assert.strictEqual(v.fetches[0].op.headers['x-rosanta-u'], 'TOK');
});
