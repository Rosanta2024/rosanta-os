// Sombra 2 (Caja chica, Compras en efectivo y Clientes › Eventos), 17-oct-2026.
// Corre con TZ=America/Guatemala (lo pone sellar-nube.py y Cloud Run). Datos inventados.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/copia-hojas');
const { crearMotor } = require('../src/motor-pagos');
const S = require('../src/sombra2/servicio-f2');
const K = require('../src/sombra2/comparar-f2');
const P = require('../src/sombra2/pantallas-f2');
const { crearAppF2 } = require('../src/sombra2/app-f2');
const U = require('../src/usuarios');
const { libros: librosPagos } = require('./fixtura');

const DIR = path.join(__dirname, '..', 'intranet');
const ORIGEN = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-intranet');
const leerLista = (l) => fs.readFileSync(path.join(DIR, l), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const CFG = C.LIBROS.config.id;
const SALA = { email: 'sala@x', rol: 'sala', modulos: ['pagos'], nombre: 'Maco' };
const DUENO = { email: 'd@x', rol: 'dueno', modulos: ['marketing'], nombre: 'Juanma' };
const MKT_U = { email: 'v@x', rol: 'pauta', modulos: ['marketing'], nombre: 'Vanessa' };

const EV_COLS = (() => { const s = fs.readFileSync(path.join(DIR, 'EventosDatos.js'), 'utf8'); return JSON.parse(s.match(/var EV_COLS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')); })();
const filaEv = (o) => EV_COLS.map((c) => (o[c] !== undefined ? o[c] : ''));

/** Libros de prueba: los de Pagos (con el config real), mas Caja, retiros, cierres y Marketing OS. */
function libros() {
  const L = librosPagos();
  const cfg = L.CFG; delete L.CFG; L[CFG] = cfg;
  cfg.CAJA_CHICA = [['FECHA', 'TIPO', 'CATEGORIA', 'CONCEPTO', 'MONTO', 'REFERENCIA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'],
    ['2026-10-14', 'CONTEO', '', '', 2700, '', 'Maco', new Date(2026, 9, 14, 22), 'c1', ''],
    ['2026-10-15', 'SALIDA', 'limpieza', 'Cloro', 40, '', 'Maco', new Date(2026, 9, 15, 12), 'c2', '']];
  cfg.RETIROS_SOLICITUDES = [['FECHA', 'LUGAR', 'MONTO', 'AREA', 'NOTA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'],
    ['2026-10-15', 'ATM 095 Agencia Recolección Antigua', 500, 'COCINA', '', 'Jeffry', new Date(2026, 9, 15, 9), 'r1', '']];
  cfg.CIERRES_DIARIOS = [['FECHA', 'GRAN_TOTAL', 'SIN_PROPINA', 'PROPINA', 'TARJETA', 'EFECTIVO', 'TRANSFERENCIA', 'PEDIDOS_YA', 'UBER_EATS', 'CORTESIA', 'TICKETS', 'PRODUCTOS', 'COMENSALES_RESERVA', 'CUADRA'],
    ['2026-10-14', 3000, 2700, 300, 2000, 1000, 0, 0, 0, 0, 10, 30, '', 'SI']];
  L[S.MKT_ID] = {
    cotizaciones: [EV_COLS,
      filaEv({ id: 'a', version: 2, cliente: 'Ana', etapa: 'cotizada', estado: 'cotizada', monto_q: 5000, fecha_evento: '2026-11-20', fecha_consulta: '2026-10-05', historial_json: '[]' }),
      filaEv({ id: 'b', version: 1, cliente: 'Beto', etapa: 'ganada', estado: 'ganada', monto_q: 9000, etapa_desde: '2026-10-10', fecha_consulta: '2026-10-01' })],
    revisiones: [['fecha', 'hora', 'resumen', 'contestaron', 'borradores'], ['2026-10-17', '07:15', 'ok', '0', '0']]
  };
  return L;
}

test('Sombra 2: los archivos son copias exactas de la intranet', () => {
  const lista = ['LISTA-CAJA.txt', 'LISTA-EVENTOS.txt', 'LISTA-VISTAS-F2.txt'].flatMap(leerLista);
  assert.ok(lista.includes('CajaChica.js') && lista.includes('ComprasEfectivo.js') && lista.includes('EventosDatos.js') && lista.includes('EventosVista.html'));
  const distintos = lista.filter((f) => fs.readFileSync(path.join(DIR, f), 'utf8') !== fs.readFileSync(path.join(ORIGEN, f), 'utf8'));
  assert.deepStrictEqual(distintos, [], 'correr cloud/herramientas/traer-intranet.sh');
});

test('Caja chica corre con el codigo real y sin escribir nada', () => {
  const M = S.crearMotores(libros());
  const r = M.caja.correr(SALA, 'getCajaChica', []);
  assert.deepStrictEqual(r.escrituras, {}, 'leer la caja no escribe');
  const d14 = r.resultado.dias.find((d) => d.fecha === '2026-10-14');
  // arranque 13-oct Q2,676 + efectivo del cierre Q1,000 = Q3,676 esperado; contado Q2,700
  assert.strictEqual(d14.esperado, 3676);
  assert.strictEqual(d14.contado, 2700);
  assert.strictEqual(d14.estado, 'Faltante');
  assert.ok(r.resultado.maestro && r.resultado.maestro.escrito === false, '07_Caja_Chica no se reescribe');
  assert.strictEqual(r.resultado.lectura_ahora, undefined, 'no intenta leer Gmail');
  assert.throws(() => M.caja.correr({ email: 'c', rol: 'chef', modulos: ['pagos'], nombre: 'Jeffry' }, 'getCajaChica', []), /la lleva Maco/);
});

test('Control negativo: sin anular, Caja chica intentaria escribir el maestro', () => {
  const M = crearMotor({ libros: libros(), configId: CFG, editables: {}, listas: S.MODULOS.caja.listas });
  M.ctx._cchLeerSiFaltan_ = () => null;   // solo Gmail anulado: la escritura del maestro queda viva
  const r = M.correr(SALA, 'getCajaChica', []).resultado;
  assert.match(r.aviso_maestro, /No pude escribir 07_Caja_Chica/, 'el codigo real si intenta escribir al leer');
});

test('Compras en efectivo corre con el codigo real', () => {
  const M = S.crearMotores(libros());
  const r = M.caja.correr(DUENO, 'getComprasEfectivo', []).resultado;
  assert.ok(r.resumen && typeof r.resumen.por_justificar === 'number');
  assert.strictEqual(r.solicitudes.length, 1);
});

test('Eventos corre con el codigo real y respeta la guarda de la intranet', () => {
  const M = S.crearMotores(libros());
  const ev = M.eventos.correr(MKT_U, 'getEventos', []).resultado;
  assert.deepStrictEqual(ev.filas.map((f) => f.id), ['a', 'b']);
  const inf = M.eventos.correr(MKT_U, 'getInformeEventos', [2026, 10]).resultado;
  assert.strictEqual(inf.actual.ganadas.n, 1);
  assert.throws(() => M.eventos.correr(SALA, 'getEventos', []), /módulo de marketing/);
  assert.throws(() => M.eventos.correr(MKT_U, 'guardarEventos', [[{ op: 'update', id: 'a', data: { notas: 'x' }, if_version: 2 }]]), /solo lectura/,
    'aun saltando el 409, la hoja es de solo lectura');
});

test('En sombra todo lo que escribe responde 409, y Pagos no se puede llamar desde aca', async () => {
  const f2 = S.crearServicioF2({ query: async () => ({ rows: [] }) });
  S.MODULOS.caja.escritura.concat(S.MODULOS.eventos.escritura).forEach((n) => {
    assert.throws(() => f2.llamar(DUENO, n, []), (e) => e.status === 409, n);
  });
  assert.throws(() => f2.llamar(DUENO, 'getPagosProveedores', []), (e) => e.status === 404);
  assert.throws(() => f2.llamar(DUENO, 'registrarPagoFacturas', []), (e) => e.status === 404);
});

test('Cada llamada de las tres pantallas esta clasificada como lectura o escritura', () => {
  const llamadas = ['ProfitCajaJs.html', 'ProfitComprasJs.html', 'EventosVista.html'].flatMap((f) =>
    Array.from(fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/\.([A-Za-z_]\w*)\(AUTH\b/g)).map((m) => m[1]));
  assert.ok(llamadas.length >= 16, 'encontro las llamadas (' + llamadas.length + ')');
  const sueltas = llamadas.filter((n) => !S.moduloDe(n));
  assert.deepStrictEqual(sueltas, [], 'una funcion nueva de la pantalla: decidir si es lectura o escritura');
});

test('La comparacion da 0 diferencias con los mismos datos y avisa una diferencia sembrada', () => {
  const iguales = K.compararResumenes(K.armar(libros()), K.armar(libros()));
  assert.deepStrictEqual(iguales, []);
  const otra = libros();
  otra[CFG].CAJA_CHICA[1][4] = 2600;                     // otro conteo el 14-oct
  otra[S.MKT_ID].cotizaciones[1][EV_COLS.indexOf('monto_q')] = 5100;   // otro monto en el pipeline
  const d = K.compararResumenes(K.armar(otra), K.armar(libros()));
  assert.ok(d.some((x) => /caja día 2026-10-14 contado: copia 2600 · hojas 2700/.test(x)), d.join('\n'));
  assert.ok(d.some((x) => /eventos por_etapa cotizada q: copia 5100 · hojas 5000/.test(x)), d.join('\n'));
  const sinMkt = libros(); delete sinMkt[S.MKT_ID];
  assert.ok(K.compararResumenes(K.armar(sinMkt), K.armar(libros())).some((x) => /eventos: no se pudo armar con la copia/.test(x)));
});

test('Las pantallas se arman con el codigo real y sin scriptlets', () => {
  const caja = P.armarCaja(), compras = P.armarCompras(), ev = P.armarEventos();
  assert.match(caja, /PF_CAJA\(document\.getElementById\("pf-host"\)/);
  assert.match(compras, /PF_COMPRAS\(document\.getElementById\("pf-host"\)/);
  [caja, compras, ev].forEach((h) => {
    assert.ok(!h.includes('<?'), 'sin scriptlets de Apps Script');
    assert.match(h, /\/api\/llamar\//, 'lleva el traductor de google.script.run');
    assert.match(h, /Prueba en sombra/);
  });
  assert.match(ev, /const AUTH = new URLSearchParams\(location\.search\)/);
});

// ---- La app web ----
function poolFalso(usuarios, fotos) {
  return { query: async (sql, p) => {
    if (/^SELECT 1/.test(sql)) return { rows: [{}] };
    if (/FROM usuarios WHERE token_huella/.test(sql)) return { rows: usuarios.filter((u) => u.token_huella === p[0]) };
    if (/FROM caja_fotos/.test(sql)) return { rows: fotos || [] };
    if (/^INSERT INTO tiempos/.test(sql)) return { rows: [] };
    throw new Error('consulta no esperada: ' + sql);
  } };
}
async function servir(deps, fn) {
  const srv = crearAppF2(deps).listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const HOJA = [['correo', 'rol', 'modulos', 'edita', 'nombre', 'token'],
  ['sala@x', 'sala', 'pagos', 'SI', 'Maco', 'tok-maco'], ['d@x', 'Dueño', 'marketing', 'SI', 'Juanma', 'tok-juanma']];

test('La app de la sombra 2: enlace, 409 al escribir, tareas con clave y fotos solo del dueño', async () => {
  const pool = poolFalso(U.usuariosDeFilas(HOJA));
  const M = S.crearMotores(libros());
  const f2 = {
    estado: () => ({ modo: 'sombra' }),
    refrescar: async () => [],
    llamar: (u, n, a) => {
      if (S.MODULOS.caja.escritura.includes(n)) { const e = new Error('Prueba en sombra'); e.status = 409; throw e; }
      return { resultado: M.caja.correr(u, n, a).resultado, ms: 1 };
    }
  };
  const deps = { pool, f2, comparar: async () => ({ copia_al_dia: false, diferencias: ['x'], celdas_error: {} }), claveTareas: 'clave-x',
    pantallas: { caja: P.armarCaja, compras: P.armarCompras, eventos: P.armarEventos, fotos: P.armarFotos } };
  await servir(deps, async (b) => {
    const llamar = (n, tok, args) => fetch(b + '/api/llamar/' + n, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok || '' }, body: JSON.stringify(args || []) });
    assert.strictEqual((await llamar('getCajaChica', '')).status, 401);
    const r = await llamar('getCajaChica', 'tok-maco'); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.ok(j.resultado.dias.length > 0);
    assert.strictEqual((await llamar('registrarConteoCaja', 'tok-maco', ['2026-10-16', 100])).status, 409);
    assert.strictEqual((await fetch(b + '/tareas/comparar', { method: 'POST' })).status, 403, 'sin clave no corre la tarea');
    assert.strictEqual((await fetch(b + '/tareas/comparar', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave-x' } })).status, 409, 'diferencia = 409 (alerta)');
    assert.strictEqual((await fetch(b + '/api/fotos-f2', { headers: { 'x-rosanta-u': 'tok-maco' } })).status, 403);
    assert.strictEqual((await fetch(b + '/api/fotos-f2', { headers: { 'x-rosanta-u': 'tok-juanma' } })).status, 200);
    for (const p of ['/caja', '/compras', '/clientes/eventos', '/sombra2/fotos']) assert.strictEqual((await fetch(b + p)).status, 200, p);
  });
});
