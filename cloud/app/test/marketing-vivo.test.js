// Marketing (contenido y pauta) en vivo (20-oct-2026): las 6 funciones de guardar de la intranet, corridas por el
// servidor con el codigo real (MarketingDatos.js, PautaSistema.js) sobre la base, y copiadas a la hoja.
const test = require('node:test');
const assert = require('node:assert');
const MV = require('../src/vivo-clientes/marketing-vivo');
const LB = require('../src/vivo-clientes/libro-base');
const CC = require('../src/vivo-clientes/copiar-clientes');

const DUENO = { email: 'd@x', rol: 'dueno', modulos: ['marketing'], nombre: 'Juanma', puede_editar: true };
const PAUTA = { email: 'v@x', rol: 'pauta', modulos: ['marketing'], nombre: 'Vanessa', puede_editar: true };
const CHEF = { email: 'c@x', rol: 'chef', modulos: [], nombre: 'Jeffry', puede_editar: true };
const CAL = ['id', 'date', 'title', 'tipo', 'eje', 'estado', 'canal', 'notas', 'contenido', 'hook', 'stdc', 'metrica', 'utm', 'embudo', 'formato', 'uso'];
const d = (s) => { const [y, m, x] = s.split('-').map(Number); return new Date(y, m - 1, x); };

function hojas() {
  return {
    calendario: [CAL.slice(), ['c1', d('2026-11-02'), 'Fogata', 'VALOR', '', 'Idea', 'IG', '', '', '', '', '', '', '', '', '']],
    calendario_versiones: [['version', 'snapshot', 'id', 'date', 'title', 'tipo', 'eje', 'estado', 'canal', 'notas', 'contenido', 'hook', 'stdc', 'metrica', 'utm', 'embudo', 'formato', 'uso']],
    piezas: [['id', 'name', 'score', 'total', 'fecha']],
    propuestas: [['id', 'fecha', 'autor', 'titulo', 'estado', 'contenido']],
    briefs: [['id', 'brief', 'actualizado']],
    aprendizajes: [['id', 'fecha', 'fuente', 'hallazgo', 'accion'], ['a1', d('2026-10-01'), 'prueba', 'x', 'y']],
    pauta_semanal: [['wk', 'gCosto', 'gClics', 'gImp', 'mCosto', 'mAlcance', 'reservas', 'fecha_registro', 'comensales', 'comensalesReserva', 'ticket', 'clientes_nuevos', 'repetidos'], [42, 100, 10, 1000, 200, 5000, 30, '', 300, 60, 250, 12, 3]],
    reglas: [['id', 'valor', 'descripcion', 'editado_por', 'editado_el'], ['dias_minimos', 14, 'Días mínimos de una prueba', 'sistema', '2026-10-01']],
    supuestos: [['id', 'afirmacion', 'estado', 'fuente', 'verificado_el', 'vence_el', 'como_verificar', 'notas', 'editado_por']],
    bitacora_pruebas: [['id', 'fecha', 'autor', 'hipotesis', 'cambio', 'conjunto_id', 'conjunto', 'metrica_juez', 'linea_base', 'fecha_inicio', 'fecha_lectura', 'resultado', 'veredicto', 'aprendizaje', 'supuesto_id', 'supuesto_queda', 'estado']],
    hechos_semana: [['id', 'semana']], pixel_semana: [['id', 'semana']], estados_semana: [['id', 'semana']]
  };
}

/** Base de mentira: las consultas de filas_clientes que usan marketing-vivo y libro-base. */
function baseFalsa() {
  const t = new Map();
  let reloj = 1;
  const act = (x) => 'A' + x.actualizado;
  const de = (p) => [...t.values()].filter((x) => x.pestana === p);
  const query = async (sql, a) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || /pg_advisory_xact_lock/.test(sql)) return { rows: [] };
    if (/^SELECT celdas FROM filas_clientes WHERE pestana = \$1 AND borrada IS NULL ORDER BY/.test(sql)) return { rows: de(a[0]).filter((x) => !x.borrada).sort((x, y) => x.orden - y.orden || (x.llave < y.llave ? -1 : 1)).map((x) => ({ celdas: x.celdas })) };
    if (/^SELECT llave, celdas, borrada, copiado_a_hoja FROM filas_clientes WHERE pestana = \$1 FOR UPDATE/.test(sql)) return { rows: de(a[0]).map((x) => ({ llave: x.llave, celdas: x.celdas, borrada: x.borrada, copiado_a_hoja: x.copiado_a_hoja })) };
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, orden, origen, copiado_a_hoja\) VALUES \(\$1,\$2,\$3,\$4,'hoja',now\(\)\)/.test(sql)) { t.set(a[0] + '|' + a[1], { pestana: a[0], llave: a[1], celdas: JSON.parse(a[2]), orden: a[3], origen: 'hoja', actualizado: reloj++, copiado_a_hoja: reloj++, borrada: null }); return { rows: [] }; }
    if (/^UPDATE filas_clientes SET orden = \$3 WHERE pestana = \$1 AND llave = \$2$/.test(sql)) { t.get(a[0] + '|' + a[1]).orden = a[2]; return { rows: [] }; }
    if (/^UPDATE filas_clientes SET celdas = \$3, orden = \$4, origen = 'hoja'/.test(sql)) { Object.assign(t.get(a[0] + '|' + a[1]), { celdas: JSON.parse(a[2]), orden: a[3], origen: 'hoja', actualizado: reloj++, copiado_a_hoja: reloj++, borrada: null }); return { rows: [] }; }
    if (/^UPDATE filas_clientes SET borrada = now\(\) WHERE pestana = \$1 AND llave = \$2$/.test(sql)) { t.get(a[0] + '|' + a[1]).borrada = reloj++; return { rows: [] }; }
    if (/^INSERT INTO filas_clientes_importaciones/.test(sql)) return { rows: [] };
    if (/^SELECT llave, celdas, borrada, actualizado::text AS act FROM filas_clientes WHERE pestana = \$1 AND copiado_a_hoja IS NULL/.test(sql)) return { rows: de(a[0]).filter((x) => x.copiado_a_hoja === null).map((x) => ({ llave: x.llave, celdas: x.celdas, borrada: x.borrada, act: act(x) })) };
    if (/^UPDATE filas_clientes SET copiado_a_hoja = now\(\) WHERE pestana = \$1 AND llave = \$2 AND actualizado::text = \$3/.test(sql)) { const x = t.get(a[0] + '|' + a[1]); if (x && act(x) === a[2]) x.copiado_a_hoja = reloj++; return { rows: [] }; }
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja\) VALUES \(\$1,\$2,\$3,'servidor'/.test(sql)) {
      const prev = t.get(a[0] + '|' + a[1]);
      t.set(a[0] + '|' + a[1], { pestana: a[0], llave: a[1], celdas: JSON.parse(a[2]), orden: prev ? prev.orden : a[3], origen: 'servidor', actualizado: reloj++, copiado_a_hoja: null, borrada: null }); return { rows: [] };
    }
    if (/^UPDATE filas_clientes SET borrada = now\(\), origen = 'servidor'/.test(sql)) { Object.assign(t.get(a[0] + '|' + a[1]), { borrada: reloj++, origen: 'servidor', actualizado: reloj++, copiado_a_hoja: null }); return { rows: [] }; }
    throw new Error('consulta no esperada: ' + sql);
  };
  return { t, query, connect: async () => ({ query, release: () => {} }) };
}

/** La hoja en memoria con el plan de copia de verdad (planLlaves) aplicado. */
function armar() {
  const h = hojas(), base = baseFalsa(), copias = [];
  const valor = (c) => { const u = c.userEnteredValue; if (!u) return ''; if ('stringValue' in u) return u.stringValue; if ('boolValue' in u) return u.boolValue; const n = u.numberValue; return c.userEnteredFormat && /DATE/.test(c.userEnteredFormat.numberFormat.type) ? (() => { const x = new Date(Math.round((n - 25569) * 86400000)); return new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCHours(), x.getUTCMinutes(), x.getUTCSeconds()); })() : n; };
  const v = MV.crearMarketingVivo(base, {
    configId: 'CFG',
    leerMkt: async (ps) => Object.fromEntries(ps.filter((p) => h[p]).map((p) => [p, h[p].map((f) => f.slice())])),
    leerConfig: async () => ({ PARAMETROS: [['clave', 'valor']], METAS: [['mes']] }),
    copiar: async (p, cambios, bajas, enc) => {
      copias.push({ p, cambios: cambios.length, bajas: bajas.length });
      if (!h[p]) h[p] = [enc.slice()];
      const plan = LB.planLlaves(h[p], cambios, bajas, 1, MV.llaveDe(p), (x) => CC.celda(x, false));
      for (const r of plan.requests) {
        if (r.updateCells) r.updateCells.rows.forEach((row, i) => { h[p][r.updateCells.range.startRowIndex + i] = row.values.map(valor); });
        if (r.deleteDimension) h[p].splice(r.deleteDimension.range.startIndex, 1);
        if (r.appendCells) r.appendCells.rows.forEach((row) => h[p].push(row.values.map(valor)));
      }
    }
  });
  return { h, base, v, copias };
}
const filaDe = (h, p, id) => h[p].find((f, i) => i > 0 && String(f[0]) === id);

test('mktUpsert del calendario: lo corre el codigo real, queda en la base y en la hoja ANTES de contestar', async () => {
  const { h, base, v } = armar();
  await v.importar();
  const r = await v.guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'c2', date: '2026-11-05', title: 'Huerto', tipo: 'COMUNIDAD', estado: 'Idea' }]);
  assert.strictEqual(r.key, 'c2'); assert.strictEqual(r.updated, false);
  const f = filaDe(h, 'calendario', 'c2');
  assert.ok(f, 'ya esta en la hoja al contestar');
  assert.ok(f[1] instanceof Date, 'la fecha como fecha (setValues)');
  assert.strictEqual(base.t.get('calendario|c2').origen, 'servidor');
  assert.ok(base.t.get('calendario|c2').copiado_a_hoja, 'marcada como copiada');
  const r2 = await v.guardar(PAUTA, 'mktUpsert', ['calendario', { id: 'c1', date: '2026-11-02', title: 'Fogata', tipo: 'VALOR', estado: 'Lista', hook: 'chispa', stdc: 'See', metrica: 'hook rate' }]);
  assert.strictEqual(r2.updated, true);
  assert.strictEqual(filaDe(h, 'calendario', 'c1')[5], 'Lista');
  assert.strictEqual(h.calendario.length, 3, 'sin duplicados');
  const imp = await v.importar();
  assert.ok(imp.every((x) => x.nuevas === 0 && x.actualizadas === 0 && x.borradas === 0), 'lo copiado vuelve igual: ' + JSON.stringify(imp.filter((x) => x.nuevas || x.actualizadas || x.borradas)));
});

test('mktDelete: la fila va a la papelera (que se crea con el primer borrado) y sale del calendario, en la base y en la hoja', async () => {
  const { h, base, v } = armar();
  await v.importar();
  const r = await v.guardar(DUENO, 'mktDelete', ['calendario', 'c1']);
  assert.deepStrictEqual(r, { deleted: 'c1', papelera: true });
  assert.ok(!filaDe(h, 'calendario', 'c1'), 'salio de la hoja');
  assert.ok(base.t.get('calendario|c1').borrada, 'en la base queda marcada, no se borra');
  assert.strictEqual(h.papelera.length, 2, 'la papelera nueva tiene encabezado y la fila');
  assert.strictEqual(h.papelera[0][0], 'borrado_el'); assert.strictEqual(h.papelera[1][2], 'calendario'); assert.strictEqual(h.papelera[1][3], 'c1');
  const imp = await v.importar();
  assert.ok(imp.every((x) => !x.nuevas && !x.actualizadas && !x.borradas), JSON.stringify(imp));
});

test('Pauta: reglas y supuestos solo el dueño; la regla valida su tipo; nada se escribe si la funcion se niega', async () => {
  const { h, base, v } = armar();
  await v.importar();
  await assert.rejects(() => v.guardar(PAUTA, 'psGuardarRegla', ['dias_minimos', 21]), /solo el dueño/);
  await assert.rejects(() => v.guardar(DUENO, 'psGuardarRegla', ['dias_minimos', 'muchos']), /número/);
  await assert.rejects(() => v.guardar(CHEF, 'mktUpsert', ['calendario', { id: 'x' }]));
  assert.strictEqual(filaDe(h, 'reglas', 'dias_minimos')[1], 14);
  assert.ok([...base.t.values()].every((x) => x.origen === 'hoja'), 'nada del servidor');
  const r = await v.guardar(DUENO, 'psGuardarRegla', ['dias_minimos', 21]);
  assert.strictEqual(r.updated, true);
  assert.strictEqual(filaDe(h, 'reglas', 'dias_minimos')[1], 21);
  const s = await v.guardar(DUENO, 'psGuardarSupuesto', [{ afirmacion: 'El jardín vende más los sábados', estado: 'por_verificar' }]);
  assert.match(s.id, /^s\d+$/);
  assert.strictEqual(filaDe(h, 'supuestos', s.id)[8], 'd@x');
});

test('calGuardarVersion: guarda la foto del calendario; las versiones se distinguen por version + id', async () => {
  const { h, v } = armar();
  await v.importar();
  const filas = [{ id: 'c1', date: '2026-11-02', title: 'Fogata' }, { id: 'c2', date: '2026-11-05', title: 'Huerto' }];
  await v.guardar(DUENO, 'calGuardarVersion', ['v1', filas]);
  await v.guardar(DUENO, 'calGuardarVersion', ['v2', filas]);
  assert.strictEqual(h.calendario_versiones.length, 5, '2 versiones × 2 filas + encabezado');
  assert.strictEqual(new Set(h.calendario_versiones.slice(1).map((f) => f[0] + '|' + f[2])).size, 4);
});

test('Una funcion que no es de guardar no pasa (404); la hoja manda en lo que escriben otros (pauta_semanal del Ads Script)', async () => {
  const { h, base, v } = armar();
  await v.importar();
  await assert.rejects(() => v.guardar(DUENO, 'askClaudeSrv', ['hola']), (e) => e.status === 404);
  await assert.rejects(() => v.guardar(DUENO, 'getUsuarios', []), (e) => e.status === 404);
  h.pauta_semanal[1][1] = 140;   // el Ads Script actualiza el costo de Google
  h.hechos_semana.push(['h1', '2026-W43']);   // la captura semanal de Meta
  const imp = await v.importar();
  assert.strictEqual(imp.find((x) => x.pestana === 'pauta_semanal').actualizadas, 1);
  assert.strictEqual(imp.find((x) => x.pestana === 'hechos_semana').nuevas, 1);
  assert.strictEqual(base.t.get('pauta_semanal|42').celdas[1], 140);
});

test('planLlaves: cambios en su lugar, bajas de abajo hacia arriba, altas al final', () => {
  const M = [['id', 'x'], ['a', 1], ['b', 2], ['c', 3]];
  const p = LB.planLlaves(M, [{ llave: 'b', fila: ['b', 20] }, { llave: 'n', fila: ['n', 9] }], ['a', 'c', 'zz'], 7, (f) => String(f[0]), (x) => CC.celda(x, false));
  assert.strictEqual(p.requests[0].updateCells.range.startRowIndex, 2);
  assert.deepStrictEqual(p.requests.filter((r) => r.deleteDimension).map((r) => r.deleteDimension.range.startIndex), [3, 1], 'de abajo hacia arriba');
  assert.ok(p.requests[p.requests.length - 1].appendCells);
  assert.deepStrictEqual([p.altas, p.cambios, p.bajas], [1, 1, 2]);
});

test('psGuardarPrueba: cualquiera con edicion propone; arrancarla es del dueño; queda en bitacora_pruebas', async () => {
  const { h, v } = armar();
  await v.importar();
  const r = await v.guardar(PAUTA, 'psGuardarPrueba', [{ hipotesis: 'Un reel del huerto trae más reservas', cambio: 'Reel nuevo en el conjunto A', metrica_juez: 'reservas_negocio' }]);
  const f = filaDe(h, 'bitacora_pruebas', r.id);
  assert.ok(f, JSON.stringify(r)); assert.strictEqual(f[16], 'propuesta'); assert.strictEqual(f[2], 'v@x');
  await assert.rejects(() => v.guardar(PAUTA, 'psGuardarPrueba', [{ id: r.id, estado: 'en_curso' }]), /solo el dueño/);
  assert.strictEqual(filaDe(h, 'bitacora_pruebas', r.id)[16], 'propuesta');
});

test('importarEspejo no pisa lo que el servidor todavia no copio (alta, cambio ni baja)', async () => {
  const base = baseFalsa();
  base.t.set('reglas|a', { pestana: 'reglas', llave: 'a', celdas: ['a', 2], orden: 1, origen: 'servidor', actualizado: 1, copiado_a_hoja: null, borrada: null });
  base.t.set('reglas|b', { pestana: 'reglas', llave: 'b', celdas: ['b', 5], orden: 2, origen: 'servidor', actualizado: 2, copiado_a_hoja: null, borrada: 9 });
  base.t.set('reglas|n', { pestana: 'reglas', llave: 'n', celdas: ['n', 7], orden: 3, origen: 'servidor', actualizado: 3, copiado_a_hoja: null, borrada: null });
  const c = await base.connect();
  const r = await LB.importarEspejo(c, 'reglas', [['id', 'valor'], ['a', 1], ['b', 5]], (f) => String(f[0]));
  assert.deepStrictEqual(base.t.get('reglas|a').celdas, ['a', 2], 'el cambio del servidor no se pisa con el valor viejo de la hoja');
  assert.ok(base.t.get('reglas|b').borrada, 'la baja del servidor no se deshace');
  assert.ok(!base.t.get('reglas|n').borrada, 'el alta del servidor no se marca borrada por no estar en la hoja');
  assert.deepStrictEqual([r.nuevas, r.actualizadas, r.borradas], [0, 0, 0]);
});

test('/interno/marketing: clave de tareas, interruptor en base, la persona por su correo; si no, nada', async () => {
  const { crearAppVivo } = require('../src/vivo-clientes/app');
  const llamados = [];
  let modo = 'sheets';
  const pool = { query: async (sql, a) => ({ rows: a[0] === 'v@x' ? [PAUTA] : [] }) };
  const app = crearAppVivo({ pool, vivo: { estado: () => ({}) }, claveTareas: 'clave-de-tareas-larga', leerModoMarketing: async () => modo,
    marketing: { guardar: async (u, fn, args) => { llamados.push([u.email, fn, args]); return { key: 'c9' }; }, importar: async () => [] } });
  const srv = app.listen(0); const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    const post = (cuerpo, clave) => fetch(b + '/interno/marketing', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, clave ? { 'x-rosanta-tarea': clave } : {}), body: JSON.stringify(cuerpo) });
    const C1 = { fn: 'mktUpsert', args: ['calendario', { id: 'c9' }], email: 'V@x' };
    assert.strictEqual((await post(C1)).status, 403, 'sin clave');
    assert.strictEqual((await post(C1, 'clave-de-tareas-larga')).status, 409, 'con sheets, la intranet escribe');
    modo = 'base';
    assert.strictEqual((await post(Object.assign({}, C1, { email: 'nadie@x' }), 'clave-de-tareas-larga')).status, 403);
    assert.strictEqual(llamados.length, 0);
    const r = await post(C1, 'clave-de-tareas-larga');
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { resultado: { key: 'c9' } });
    assert.deepStrictEqual(llamados, [['v@x', 'mktUpsert', ['calendario', { id: 'c9' }]]]);
  } finally { srv.close(); }
});

test('En la intranet (NUBE_SERVIDOR_ false): con motor_marketing = base, las 6 funciones mandan el pedido a la nube y no escriben; con sheets, escriben como siempre', () => {
  const { crearMotor } = require('../src/motor-pagos');
  const libro = hojas();
  const m = crearMotor({ libros: { [MV.MKT_ID]: libro, CFG: { PARAMETROS: [['clave', 'valor']] } }, configId: 'CFG', editables: { [MV.MKT_ID]: MV.ESCRIBE }, listas: MV.LISTAS });
  LB.completarHojas(m, { [MV.MKT_ID]: libro }, { [MV.MKT_ID]: MV.ESCRIBE }, ['papelera']);
  const enviados = [];
  let modo = 'base';
  m.ctx.NUBE_SERVIDOR_ = false;
  m.ctx._nubeInterruptor_ = (clave) => (clave === 'motor_marketing' ? modo : 'sheets');
  m.ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'NUBE_CLAVE_TAREAS' ? 'clave-t' : null) }) };
  m.ctx.UrlFetchApp = { fetch: (url, o) => { enviados.push({ url, h: o.headers, b: JSON.parse(o.payload) }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ resultado: { key: 'c7', updated: false } }) }; } };
  const correr = (fn, args) => { m.ctx.__x = () => m.ctx[fn].apply(null, args.concat(['tok'])); return m.correr(PAUTA, '__x', []).resultado; };
  assert.deepStrictEqual(correr('mktUpsert', ['calendario', { id: 'c7', title: 'X' }]), { key: 'c7', updated: false });
  assert.strictEqual(enviados.length, 1);
  assert.match(enviados[0].url, /rosanta-clientes-.*\/interno\/marketing$/);
  assert.strictEqual(enviados[0].h['x-rosanta-tarea'], 'clave-t');
  assert.deepStrictEqual(enviados[0].b, { fn: 'mktUpsert', args: ['calendario', { id: 'c7', title: 'X' }], email: 'v@x' });
  assert.ok(!libro.calendario.some((f) => f[0] === 'c7'), 'la intranet no escribio en la hoja');
  for (const [fn, args] of [['mktDelete', ['calendario', 'c1']], ['calGuardarVersion', ['v1', []]], ['psGuardarRegla', ['dias_minimos', 3]], ['psGuardarSupuesto', [{ afirmacion: 'a' }]], ['psGuardarPrueba', [{ hipotesis: 'h', cambio: 'c' }]]]) {
    correr(fn, args);
    assert.strictEqual(enviados[enviados.length - 1].b.fn, fn, fn + ' tambien se desvia');
  }
  assert.strictEqual(enviados.length, 6);
  m.ctx.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 409, getContentText: () => '{"error":"Marketing todavía se guarda en la intranet"}' }) };
  assert.throws(() => correr('mktUpsert', ['calendario', { id: 'c8' }]), /todavía se guarda en la intranet/, 'un error de la nube llega tal cual a la pantalla');
  modo = 'sheets';
  const r = correr('mktUpsert', ['calendario', { id: 'c8', title: 'Y' }]);
  assert.strictEqual(r.key, 'c8');
  assert.ok(libro.calendario.some((f) => f[0] === 'c8'), 'con sheets escribe en la hoja como siempre');
});
