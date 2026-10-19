// Clientes EN VIVO: el pipeline de eventos (19-oct-2026). Base y hoja en memoria, codigo real de la intranet
// (EventosDatos.js) y de Marketing OS (Cotizaciones.js). Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/copia-hojas');
const V = require('../src/vivo-clientes/servicio');
const PER = require('../src/permisos');
const MATRIZ = PER.cargarDeMigracion();

const DIR = path.join(__dirname, '..', 'intranet');
const MKT = 'HOJA-ENSAYO';
const DUENO = { email: 'd@x', rol: 'dueno', modulos: [], nombre: 'Juanma', puede_editar: true };
const SALA = { email: 's@x', rol: 'sala', modulos: [], nombre: 'Maco', puede_editar: true };
const PAUTA = { email: 'v@x', rol: 'pauta', modulos: ['marketing'], nombre: 'Vanessa', puede_editar: true };
const CHEF = { email: 'c@x', rol: 'chef', modulos: [], nombre: 'Jeffry', puede_editar: true };
const EV_COLS = JSON.parse(fs.readFileSync(path.join(DIR, 'EventosDatos.js'), 'utf8').match(/var EV_COLS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
const fila = (o) => EV_COLS.map((c) => (o[c] !== undefined ? o[c] : ''));

/** Base de mentira: entiende las consultas de filas_clientes que usa el servicio. */
function baseFalsa() {
  const t = new Map();   // 'pestana|llave' → { pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja }
  const imps = [];
  let reloj = 1;
  const filasDe = (p) => [...t.values()].filter((x) => x.pestana === p);
  const query = async (sql, a) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || /pg_advisory_xact_lock/.test(sql)) return { rows: [] };
    if (/^SELECT celdas FROM filas_clientes WHERE pestana = \$1 ORDER BY/.test(sql)) {
      return { rows: filasDe(a[0]).sort((x, y) => (x.orden ?? 1e9) - (y.orden ?? 1e9) || x.actualizado - y.actualizado).map((x) => ({ celdas: x.celdas })) };
    }
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja\)/.test(sql)) {
      const k = a[0] + '|' + a[1], prev = t.get(k);
      t.set(k, { pestana: a[0], llave: a[1], celdas: JSON.parse(a[2]), origen: 'servidor', orden: prev ? prev.orden : a[3], actualizado: reloj++, copiado_a_hoja: null });
      return { rows: [] };
    }
    if (/^SELECT llave, celdas, actualizado FROM filas_clientes WHERE pestana = \$1 AND copiado_a_hoja IS NULL/.test(sql)) {
      return { rows: filasDe(a[0]).filter((x) => !x.copiado_a_hoja).map((x) => ({ llave: x.llave, celdas: x.celdas, actualizado: x.actualizado })) };
    }
    if (/^UPDATE filas_clientes SET copiado_a_hoja = now\(\)/.test(sql)) {
      const x = t.get(a[0] + '|' + a[1]); if (x && x.actualizado === a[2]) x.copiado_a_hoja = reloj++; return { rows: [] };
    }
    if (/^SELECT llave AS id, celdas, origen, orden FROM filas_clientes WHERE pestana = \$1 FOR UPDATE/.test(sql)) {
      return { rows: filasDe(a[0]).map((x) => ({ id: x.llave, celdas: x.celdas, origen: x.origen, orden: x.orden })) };
    }
    if (/^UPDATE filas_clientes SET orden = \$3/.test(sql)) { t.get(a[0] + '|' + a[1]).orden = a[2]; return { rows: [] }; }
    if (/^UPDATE filas_clientes SET celdas = \$3, orden = \$4, origen = 'hoja'/.test(sql)) {
      Object.assign(t.get(a[0] + '|' + a[1]), { celdas: JSON.parse(a[2]), orden: a[3], origen: 'hoja', actualizado: reloj++, copiado_a_hoja: reloj++ }); return { rows: [] };
    }
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, orden, origen, copiado_a_hoja\)/.test(sql)) {
      t.set(a[0] + '|' + a[1], { pestana: a[0], llave: a[1], celdas: JSON.parse(a[2]), origen: 'hoja', orden: a[3], actualizado: reloj++, copiado_a_hoja: reloj++ }); return { rows: [] };
    }
    if (/^INSERT INTO filas_clientes_importaciones/.test(sql)) { imps.push({ pestana: a[0], problemas: JSON.parse(a[4]) }); return { rows: [] }; }
    throw new Error('consulta no esperada: ' + sql);
  };
  return { t, imps, query, connect: async () => ({ query, release: () => {} }) };
}

/** Hoja de mentira: matrices como getValues; copiar reescribe por llave o agrega al final (como copiarFilas). */
function hojaFalsa() {
  const h = {
    cotizaciones: [EV_COLS.slice(),
      fila({ id: 'ana-boda', version: 3, cliente: 'Ana', etapa: 'cotizada', estado: 'cotizada', monto_q: 5000, fecha_evento: '2026-11-20', historial_json: '[]', creado_por: '' }),
      fila({ id: 'beto-cena', version: 1, cliente: 'Beto', etapa: 'consulta', estado: 'consulta', monto_q: 0, historial_json: '[]' })],
    revisiones: [['fecha', 'hora', 'resumen', 'contestaron', 'borradores'], ['2026-10-18', '07:15', 'ok', '0', '0']]
  };
  return {
    h,
    leer: async (ps) => Object.fromEntries(ps.map((p) => [p, JSON.parse(JSON.stringify(h[p]))])),
    copiar: async (p, filas, op) => {
      const H = h[p][0].map(String), iL = H.indexOf(op.llave);
      filas.forEach((x) => {
        const r = h[p].findIndex((f, i) => i > 0 && String(f[iL]) === String(x.id));
        const nueva = H.map((_, j) => (x.fila[j] === undefined ? '' : x.fila[j]));
        if (r > 0) h[p][r] = nueva; else h[p].push(nueva);
      });
    }
  };
}

function armar(modoInicial) {
  const base = baseFalsa(), hoja = hojaFalsa();
  let modo = modoInicial || 'sheets';
  const v = V.crearServicioVivo(base, { mktId: MKT, permisos: MATRIZ, leerInterruptor: async () => modo, leerHoja: hoja.leer, copiar: hoja.copiar });
  return { base, hoja, v, poner: (m) => { modo = m; } };
}
const idsBase = (base, p) => [...base.t.values()].filter((x) => x.pestana === p).map((x) => x.llave).sort();
const idsHoja = (hoja, p) => hoja.h[p].slice(1).map((f) => String(f[0])).sort();
const esperarCopia = () => new Promise((r) => setTimeout(r, 20));

test('El codigo real de Marketing OS (Cotizaciones.js) es copia exacta', () => {
  const a = fs.readFileSync(path.join(DIR, 'mktos', 'Cotizaciones.js'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-marketing-os', 'Cotizaciones.js'), 'utf8');
  assert.strictEqual(a, b, 'copiar apps-script/rosanta-marketing-os/Cotizaciones.js');
});

test('Interruptor: solo "base" enciende; cualquier otra cosa es sheets', () => {
  assert.strictEqual(V.interruptor([['motor_eventos', 'base']]), 'base');
  assert.strictEqual(V.interruptor([['Motor_Eventos ', ' BASE ']]), 'base');
  assert.strictEqual(V.interruptor([['motor_eventos', 'sheets']]), 'sheets');
  assert.strictEqual(V.interruptor([]), 'sheets');
});

test('Con sheets: la hoja manda, la base copia, y el servidor no guarda (409)', async () => {
  const { base, hoja, v } = armar('sheets');
  await v.cargar();
  await v.importar();
  assert.deepStrictEqual(idsBase(base, 'cotizaciones'), idsHoja(hoja, 'cotizaciones'));
  await assert.rejects(() => v.llamar(DUENO, 'guardarEventos', [[{ op: 'set', id: 'nueva', data: { cliente: 'X' } }]]), (e) => e.status === 409);
  await assert.rejects(() => v.hook({ accion: 'batch', writes: [] }), (e) => e.status === 409);
  const r = await v.hook({ accion: 'list' });
  assert.strictEqual(r.filas.length, 2, 'leer si se puede: list sale de la base');
  // la intranet escribe en la hoja (todavia manda): la importacion lo trae, aunque sea una fila ya conocida
  hoja.h.cotizaciones[1][EV_COLS.indexOf('version')] = 4; hoja.h.cotizaciones[1][EV_COLS.indexOf('notas')] = 'llamar el lunes';
  const imp = await v.importar();
  assert.strictEqual(imp[0].actualizadas, 1);
  assert.match(JSON.stringify(base.t.get('cotizaciones|ana-boda').celdas), /llamar el lunes/);
});

test('Con base: la pantalla guarda en la base, copia a la hoja, y base = hoja sin duplicados', async () => {
  const { base, hoja, v, poner } = armar('sheets');
  await v.cargar(); await v.importar();
  poner('base'); await v.importar();   // el paso a vivo: se relee el interruptor
  assert.strictEqual(v.modo(), 'base');
  const r = await v.llamar(DUENO, 'guardarEventos', [[{ op: 'set', id: 'carla-coctel', data: { cliente: 'Carla', etapa: 'consulta', estado: 'consulta', pax: 40 } }]]);
  assert.ok(r.resultado.ok, JSON.stringify(r.resultado));
  assert.ok(r.ms < 1000, 'guardado en ' + r.ms + ' ms');
  const x = base.t.get('cotizaciones|carla-coctel');
  assert.strictEqual(x.origen, 'servidor');
  await esperarCopia();
  assert.deepStrictEqual(idsBase(base, 'cotizaciones'), idsHoja(hoja, 'cotizaciones'), 'base = hoja');
  assert.strictEqual(idsHoja(hoja, 'cotizaciones').filter((i) => i === 'carla-coctel').length, 1, 'una sola vez en la hoja');
  const imp = await v.importar();
  assert.deepStrictEqual(imp.map((i) => [i.nuevas, i.actualizadas, i.problemas.length]), [[0, 0, 0], [0, 0, 0]], 'importar otra vez no cambia nada');
});

test('Con base: version (todo o nada), sala solo corrige lo suyo y la matriz decide quien entra', async () => {
  const { base, v, poner } = armar('sheets');
  await v.cargar(); await v.importar(); poner('base'); await v.importar();
  const malo = await v.llamar(DUENO, 'guardarEventos', [[{ op: 'update', id: 'ana-boda', data: { notas: 'x' }, if_version: 2 }]]);
  assert.strictEqual(malo.resultado.ok, false, 'version vieja: no se escribe');
  assert.strictEqual(base.t.get('cotizaciones|ana-boda').origen, 'hoja', 'la fila no se toco');
  const bien = await v.llamar(DUENO, 'guardarEventos', [[{ op: 'update', id: 'ana-boda', data: { notas: 'x' }, if_version: 3 }]]);
  assert.strictEqual(bien.resultado.versiones['ana-boda'], 4);
  const s1 = await v.llamar(SALA, 'guardarEventos', [[{ op: 'set', id: 'dani-cumple', data: { cliente: 'Dani', etapa: 'consulta' } }]]);
  assert.ok(s1.resultado.ok, 'sala ingresa');
  const s2 = await v.llamar(SALA, 'guardarEventos', [[{ op: 'update', id: 'ana-boda', data: { notas: 'y' }, if_version: 4 }]]);
  assert.strictEqual(s2.resultado.ok, false, 'sala no corrige lo que anoto otro (codigo real @212)');
  await assert.rejects(() => v.llamar(PAUTA, 'getEventos', []), (e) => e.status === 403, 'pauta no ve el pipeline');
  await assert.rejects(() => v.llamar(CHEF, 'guardarEventos', [[]]), (e) => e.status === 403);
});

test('El hook de la revision diaria: mismo contrato que cotHook_, y escribe por la base', async () => {
  const { base, hoja, v, poner } = armar('sheets');
  await v.cargar(); await v.importar(); poner('base'); await v.importar();
  const g = await v.hook({ accion: 'get', id: 'beto-cena' });
  assert.strictEqual(g.fila.cliente, 'Beto');
  assert.deepStrictEqual(await v.hook({ accion: 'get', id: 'no' }), { ok: false, error: 'no existe', id: 'no' });
  const b = await v.hook({ accion: 'batch', writes: [{ op: 'update', id: 'beto-cena', if_version: 1, data: { etapa: 'cotizada', estado: 'cotizada' } }] });
  assert.deepStrictEqual(b, { ok: true, versiones: { 'beto-cena': 2 } });
  const rv = await v.hook({ accion: 'revision', revision: { fecha: '2026-10-19', hora: '07:15', resumen: 'nada nuevo', contestaron: 0, borradores: 1 } });
  assert.deepStrictEqual(rv, { ok: true });
  const rv2 = await v.hook({ accion: 'revision', revision: { fecha: '2026-10-19', hora: '07:20', resumen: 'otra vez', contestaron: 0, borradores: 1 } });
  assert.deepStrictEqual(rv2, { ok: true });
  assert.deepStrictEqual(idsBase(base, 'revisiones'), ['2026-10-18', '2026-10-19'], 'la fecha es la llave: no se duplica');
  await esperarCopia();
  assert.deepStrictEqual(idsHoja(hoja, 'revisiones'), ['2026-10-18', '2026-10-19']);
  assert.strictEqual(hoja.h.revisiones[2][1], '07:20');
  assert.deepStrictEqual(await v.hook({ accion: 'x' }), { ok: false, error: 'acción desconocida' });
});

test('Un cambio en la hoja de una fila del servidor es conflicto con base (no se pisa); con sheets, la hoja manda', async () => {
  const { base, hoja, v, poner } = armar('sheets');
  await v.cargar(); await v.importar(); poner('base'); await v.importar();
  await v.llamar(DUENO, 'guardarEventos', [[{ op: 'update', id: 'ana-boda', data: { notas: 'del servidor' }, if_version: 3 }]]);
  await esperarCopia();
  const r = hoja.h.cotizaciones.findIndex((f) => f[0] === 'ana-boda');
  hoja.h.cotizaciones[r][EV_COLS.indexOf('notas')] = 'alguien escribio en la hoja';
  const imp = await v.importar();
  assert.ok(imp[0].problemas.some((p) => /Conflicto en ana-boda/.test(p)), JSON.stringify(imp[0].problemas));
  assert.match(JSON.stringify(base.t.get('cotizaciones|ana-boda').celdas), /del servidor/, 'la base no se piso');
  // VUELTA ATRAS: interruptor en sheets → la hoja vuelve a mandar y el servidor deja de guardar
  poner('sheets');
  const imp2 = await v.importar();
  assert.strictEqual(imp2[0].actualizadas, 1, 'con sheets la hoja manda');
  assert.match(JSON.stringify(base.t.get('cotizaciones|ana-boda').celdas), /alguien escribio en la hoja/);
  await assert.rejects(() => v.llamar(DUENO, 'guardarEventos', [[]]), (e) => e.status === 409);
  assert.deepStrictEqual(idsBase(base, 'cotizaciones'), idsHoja(hoja, 'cotizaciones'), 'base = hoja despues de volver');
});

test('La app en vivo: el hook exige su clave, la pantalla el enlace y las tareas su clave', async () => {
  const { crearAppVivo } = require('../src/vivo-clientes/app');
  const U = require('../src/usuarios');
  const usuarios = U.usuariosDeFilas([['c', 'r', 'm', 'e', 'n', 't'], ['d@x', 'Dueño', '', 'SI', 'Juanma', 'tok-juanma-1'], ['v@x', 'pauta', 'marketing', 'SI', 'Vanessa', 'tok-vanessa-1']]);
  const pool = { query: async (sql, p) => { if (/FROM usuarios WHERE token_huella/.test(sql)) return { rows: usuarios.filter((u) => u.token_huella === p[0]) }; throw new Error(sql); } };
  const vivo = { estado: () => ({}), modo: () => 'base', puede: (u, p) => PER.puede(MATRIZ, u, p, 'ver').ok,
    llamar: async () => ({ resultado: 1, ms: 1 }), hook: async (b) => ({ ok: true, eco: b.accion }), importar: async () => [], copiarPendientes: async () => ({ copiadas: 0 }) };
  const CLAVE = 'una-clave-larga-de-prueba-123456';
  const srv = crearAppVivo({ pool, vivo, pantallaEventos: () => '<html>ok</html>', claveTareas: 'tarea-x', claveHook: CLAVE }).listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    const hook = (tok) => fetch(b + '/hooks/cotizaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok, accion: 'list' }) }).then((r) => r.json());
    assert.deepStrictEqual(await hook('otra'), { ok: false, error: 'unauthorized' });
    assert.deepStrictEqual(await hook(CLAVE), { ok: true, eco: 'list' });
    assert.strictEqual((await fetch(b + '/clientes/eventos')).status, 401);
    assert.strictEqual((await fetch(b + '/clientes/eventos?u=tok-vanessa-1')).status, 403, 'pauta no ve el pipeline');
    assert.strictEqual((await fetch(b + '/clientes/eventos?u=tok-juanma-1')).status, 200);
    assert.strictEqual((await fetch(b + '/tareas/importar', { method: 'POST' })).status, 403);
    assert.strictEqual((await fetch(b + '/tareas/importar', { method: 'POST', headers: { 'x-rosanta-tarea': 'tarea-x' } })).status, 200);
  } finally { srv.close(); }
});
