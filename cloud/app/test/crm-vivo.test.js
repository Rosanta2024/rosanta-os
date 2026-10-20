// Reservas, carritos y CRM en la base (20-oct-2026): codigo real de Marketing OS (Code.js, CRMSync.js),
// base y hojas en memoria. Corre con TZ=America/Guatemala.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MC = require('../src/vivo-clientes/motor-crm');
const CC = require('../src/vivo-clientes/copiar-clientes');
const CV = require('../src/vivo-clientes/crm-vivo');

const DIR = path.join(__dirname, '..', 'intranet');
const CRMH = CV.CRM_COLS;
const d = (s) => { const [y, m, x] = s.split('-').map(Number); return new Date(y, m - 1, x); };

/** Hojas como hoy (tipos medidos en las reales): fechas como Date, telefono de reservas como numero. */
function hojas() {
  return {
    reservas: [CV.MKT_COLS.reservas.slice(), ['r1', d('2026-10-02'), 'Ana Paz', 'ana@gmail.com', 50255551234, 2, 0, 'CONFIRMED', 'SI']],
    carritos: [CV.MKT_COLS.carritos.slice(), ['c1', d('2026-10-01'), 'Beto', 'Email', 259, 'Pendiente', 'SI', 'beto@gmail.com']],
    crm: [CRMH.slice(), ['Ana', '50255551234', 'ana@gmail.com', 'ES', 'Wix', 'Reserva histórica', d('2026-10-02'), 0, 'SI', '', d('2026-10-02'), '']]
  };
}

/** Base de mentira: las consultas de filas_clientes y hooks_wix_recibidos que usa crm-vivo. */
function baseFalsa() {
  const t = new Map();
  let reloj = 1;
  const recibidos = [];
  const interruptores = { hooks_carrito: 'base', hooks_reserva: 'base' };
  const filas = (p) => [...t.values()].filter((x) => x.pestana === p);
  const act = (x) => '2026-10-20 10:00:00.' + String(x.actualizado).padStart(6, '0') + '-06';
  const query = async (sql, a) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || /pg_advisory_xact_lock/.test(sql)) return { rows: [] };
    if (/^SELECT celdas FROM filas_clientes WHERE pestana = \$1 AND borrada IS NULL ORDER BY/.test(sql)) {
      return { rows: filas(a[0]).filter((x) => !x.borrada).sort((x, y) => (x.orden ?? 1e15) - (y.orden ?? 1e15) || (x.llave < y.llave ? -1 : 1)).map((x) => ({ celdas: x.celdas })) };
    }
    let m = /^INSERT INTO filas_clientes \(pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja\) VALUES \((\$1|'crm'),/.exec(sql);
    if (m) {
      const [p, ll, cel, ord] = m[1] === '$1' ? a : ['crm'].concat(a);
      const prev = t.get(p + '|' + ll);
      t.set(p + '|' + ll, { pestana: p, llave: ll, celdas: JSON.parse(cel), origen: 'servidor', orden: prev ? prev.orden : ord, actualizado: reloj++, copiado_a_hoja: null, borrada: null });
      return { rows: [] };
    }
    if (/^SELECT llave, celdas, actualizado::text AS act FROM filas_clientes WHERE pestana = \$1 AND copiado_a_hoja IS NULL/.test(sql)) {
      return { rows: filas(a[0]).filter((x) => !x.copiado_a_hoja && !x.borrada).map((x) => ({ llave: x.llave, celdas: x.celdas, act: act(x) })) };
    }
    if (/^UPDATE filas_clientes SET copiado_a_hoja = now\(\) WHERE pestana = \$1 AND llave = \$2 AND actualizado::text = \$3/.test(sql)) {
      const x = t.get(a[0] + '|' + a[1]); if (x && act(x) === a[2]) x.copiado_a_hoja = reloj++; return { rows: [] };
    }
    if (/^SELECT llave AS id, celdas, origen, orden FROM filas_clientes WHERE pestana = \$1 AND borrada IS NULL FOR UPDATE/.test(sql)) {
      return { rows: filas(a[0]).filter((x) => !x.borrada).map((x) => ({ id: x.llave, celdas: x.celdas, origen: x.origen, orden: x.orden })) };
    }
    if (/^UPDATE filas_clientes SET orden = \$3 WHERE pestana = \$1/.test(sql)) { t.get(a[0] + '|' + a[1]).orden = a[2]; return { rows: [] }; }
    if (/^UPDATE filas_clientes SET celdas = \$3, orden = \$4, origen = 'hoja'/.test(sql)) {
      Object.assign(t.get(a[0] + '|' + a[1]), { celdas: JSON.parse(a[2]), orden: a[3], origen: 'hoja', actualizado: reloj++, copiado_a_hoja: reloj++ }); return { rows: [] };
    }
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, orden, origen, copiado_a_hoja\) VALUES \(\$1/.test(sql)) {
      t.set(a[0] + '|' + a[1], { pestana: a[0], llave: a[1], celdas: JSON.parse(a[2]), origen: 'hoja', orden: a[3], actualizado: reloj++, copiado_a_hoja: reloj++, borrada: null }); return { rows: [] };
    }
    if (/^SELECT llave, celdas, borrada FROM filas_clientes WHERE pestana = 'crm' FOR UPDATE/.test(sql)) return { rows: filas('crm').map((x) => ({ llave: x.llave, celdas: x.celdas, borrada: x.borrada })) };
    if (/^INSERT INTO filas_clientes \(pestana, llave, celdas, orden, origen, copiado_a_hoja\) VALUES \('crm'/.test(sql)) {
      t.set('crm|' + a[0], { pestana: 'crm', llave: a[0], celdas: JSON.parse(a[1]), origen: 'hoja', orden: a[2], actualizado: reloj++, copiado_a_hoja: reloj++, borrada: null }); return { rows: [] };
    }
    if (/^UPDATE filas_clientes SET orden = \$2 WHERE pestana = 'crm'/.test(sql)) { t.get('crm|' + a[0]).orden = a[1]; return { rows: [] }; }
    if (/^UPDATE filas_clientes SET celdas = \$2, orden = \$3, origen = 'hoja'.*pestana = 'crm'/.test(sql)) {
      Object.assign(t.get('crm|' + a[0]), { celdas: JSON.parse(a[1]), orden: a[2], origen: 'hoja', actualizado: reloj++, copiado_a_hoja: reloj++, borrada: null }); return { rows: [] };
    }
    if (/^UPDATE filas_clientes SET borrada = now\(\) WHERE pestana = 'crm'/.test(sql)) { t.get('crm|' + a[0]).borrada = reloj++; return { rows: [] }; }
    if (/^INSERT INTO filas_clientes_importaciones/.test(sql)) return { rows: [] };
    if (/^SELECT hook, cuerpo, recibido FROM hooks_wix_recibidos/.test(sql)) return { rows: recibidos };
    if (/^SELECT modo FROM interruptores WHERE modulo = \$1/.test(sql)) return { rows: interruptores[a[0]] ? [{ modo: interruptores[a[0]] }] : [] };
    throw new Error('consulta no esperada: ' + sql);
  };
  return { t, recibidos, interruptores, query, connect: async () => ({ query, release: () => {} }) };
}

/** Las hojas en memoria, con los planes de copia de verdad (planArriba / planCrm) aplicados a mano. */
function armar() {
  const h = hojas(), base = baseFalsa();
  const aplicar = (p, filas) => {
    const M = h[p];
    const plan = p === 'crm' ? CC.planCrm(M, filas, 1) : CC.planArriba(M, filas, 1, { pestana: p, llave: 'id' });
    const valor = (c) => { const u = c.userEnteredValue; if (!u) return ''; if ('stringValue' in u) return u.stringValue; const n = u.numberValue; return c.userEnteredFormat && /DATE/.test(c.userEnteredFormat.numberFormat.type) ? (() => { const x = new Date(Math.round((n - 25569) * 86400000)); return new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCHours(), x.getUTCMinutes(), x.getUTCSeconds()); })() : n; };
    for (const r of plan.requests) {
      if (r.updateCells) r.updateCells.rows.forEach((row, i) => { M[r.updateCells.range.startRowIndex + i] = row.values.map(valor); });
      if (r.insertDimension) { const g = r.insertDimension.range; M.splice(g.startIndex, 0, ...new Array(g.endIndex - g.startIndex).fill(null).map(() => [])); }
      if (r.appendCells) r.appendCells.rows.forEach((row) => M.push(row.values.map(valor)));
    }
    return plan;
  };
  const copias = [];
  const v = CV.crearCrmVivo(base, {
    leerMkt: async () => ({ reservas: JSON.parse(JSON.stringify(h.reservas), rev), carritos: JSON.parse(JSON.stringify(h.carritos), rev) }),
    leerCrm: async () => JSON.parse(JSON.stringify(h.crm), rev),
    copiar: async (p, filas) => { copias.push({ p, n: filas.length }); aplicar(p, filas); }
  });
  return { h, base, v, copias };
}
// JSON con fechas: vuelve a Date lo que tiene forma de fecha ISO
function rev(k, x) { return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) ? new Date(x) : x; }
const esperar = () => new Promise((r) => setTimeout(r, 20));
const sinFecha = (M) => JSON.stringify(M.map((f) => f.map((x) => (x instanceof Date ? 'D' + x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate() : x))));

test('Code.js y CRMSync.js de Marketing OS son copias exactas', () => {
  for (const f of ['Code.js', 'CRMSync.js']) {
    const a = fs.readFileSync(path.join(DIR, 'mktos', f), 'utf8');
    const b = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-marketing-os', f), 'utf8');
    assert.strictEqual(a, b, 'copiar apps-script/rosanta-marketing-os/' + f + ' (bash cloud/herramientas/traer-intranet.sh)');
  }
});

test('Motor: un carrito corre intakeCarrito y sincronizarCRM reales; nada sale a Meta desde el codigo copiado', () => {
  const r = MC.procesarAviso(hojas(), 'carrito', { nombre: 'Carla Ruiz', email: 'carla@gmail.com', telefono: '', valor: 518, consentimiento: 'SI', fecha: '2026-10-20' });
  assert.ok(r.resultado.ok); assert.strictEqual(r.resultado.capi, 'en cola (servidor)');
  assert.deepStrictEqual(r.capi, [{ email: 'carla@gmail.com', tel: '', valor: 518 }]);
  assert.strictEqual(r.cambios.carritos.length, 1);
  assert.ok(r.cambios.carritos[0].fila[1] instanceof Date, 'la fecha queda como fecha (como setValues)');
  assert.strictEqual(r.libros[MC.MKT_ID].carritos[1][2], 'Carla Ruiz', 'el carrito nuevo va arriba');
  const crm = r.cambios.crm.find((x) => x.llave === 'e:carla@gmail.com');
  assert.ok(crm && crm.nueva); assert.strictEqual(crm.fila[5], 'Carrito abandonado');
  assert.ok(r.cambios.crm.find((x) => x.llave === 'e:beto@gmail.com'), 'el carrito viejo de Beto tambien entra al CRM (como en Apps Script)');
});

test('Motor: una reserva cierra el carrito de esa persona; las de prueba no entran al CRM; el CRM es de solo lectura fuera de su pestaña', () => {
  const r = MC.procesarAviso(hojas(), 'reserva', { id: 'r2', fecha: '2026-10-21', nombre: 'Beto Gómez', email: 'beto@gmail.com', telefono: '', personas: 4, gasto: 0, estado: 'CONFIRMED', optin: 'NO' });
  assert.strictEqual(r.resultado.carritosCerrados, 1);
  assert.strictEqual(r.cambios.carritos[0].fila[5], 'Completado');
  const p = MC.procesarAviso(hojas(), 'reserva', { id: 'PRUEBA-1', fecha: '2026-10-21', nombre: 'PRUEBA nube', email: 'prueba@example.com', telefono: '', personas: 2, gasto: 0, estado: 'CONFIRMED', optin: 'NO' });
  assert.ok(!p.cambios.crm.some((x) => /example/.test(x.llave)), 'CRMSync excluye @example.com');
  assert.ok(MC.procesarAviso(hojas(), 'reserva', { nombre: 'sin nada' }).resultado.error, 'sin id ni contacto: error y nada escrito');
});

test('Copia: reservas y carritos nuevos arriba, los que ya estan en su lugar; CRM por correo o telefono, el telefono como texto', () => {
  const M = [['id', 'fecha'], ['a', 1], ['b', 2]];
  const p = CC.planArriba(M, [{ id: 'b', fila: ['b', 3] }, { id: 'n', fila: ['n', d('2026-10-20')] }], 9, { llave: 'id' });
  assert.strictEqual(p.requests[0].updateCells.range.startRowIndex, 2, 'b se actualiza donde esta, antes de abrir lugar');
  assert.deepStrictEqual([p.requests[1].insertDimension.range.startIndex, p.requests[1].insertDimension.range.endIndex, p.requests[2].updateCells.range.startRowIndex], [1, 2, 1], 'la nueva va en la fila 2');
  assert.strictEqual(p.requests[2].updateCells.rows[0].values[1].userEnteredFormat.numberFormat.type, 'DATE');
  const K = [CRMH, ['Ana', '50255551234', 'ana@gmail.com'], ['Tel', '50244443333', '']];
  const q = CC.planCrm(K, [{ llave: 't:44443333', fila: ['Tel', '50244443333', 'tel@gmail.com'] }, { llave: 'e:nuevo@gmail.com', fila: ['Nu', 50211112222, 'nuevo@gmail.com'] }], 7);
  assert.strictEqual(q.requests[0].updateCells.range.startRowIndex, 2, 'encontrada por telefono aunque ahora tenga correo');
  assert.strictEqual(q.requests[1].appendCells.rows[0].values[1].userEnteredValue.stringValue, '50211112222');
  assert.strictEqual(q.requests[1].appendCells.rows[0].values[1].userEnteredFormat.numberFormat.type, 'TEXT');
});

test('En base: el aviso se guarda en la base, se copia a las hojas, y base = hojas; importar despues no cambia nada', async () => {
  const { h, base, v } = armar();
  await v.importar();
  const r = await v.atender('reserva', { id: 'r2', fecha: '2026-10-21', nombre: 'Beto Gómez', email: 'beto@gmail.com', telefono: '50244443333', personas: 4, gasto: 0, estado: 'CONFIRMED', optin: 'SI' });
  assert.strictEqual(r.estado, 200); assert.strictEqual(r.json.id, 'r2');
  assert.strictEqual(base.t.get('reservas|r2').origen, 'servidor');
  await esperar();
  assert.strictEqual(h.reservas[1][0], 'r2', 'la reserva nueva quedo arriba en la hoja');
  assert.strictEqual(h.reservas[1][4], 50244443333, 'el telefono como numero, como lo deja setValues');
  assert.strictEqual(h.carritos[1][5], 'Completado');
  assert.ok(h.crm.some((f) => f[2] === 'beto@gmail.com'), 'Beto entro al CRM');
  assert.ok([...base.t.values()].every((x) => x.copiado_a_hoja), 'todo copiado');
  const imp = await v.importar();
  assert.deepStrictEqual(imp.map((x) => [x.pestana, x.nuevas, x.actualizadas]), [['reservas', 0, 0], ['carritos', 0, 0], ['crm', 0, 0]], 'lo copiado vuelve igual: sin cambios falsos');
});

test('La hoja manda: CerrarMesasNoShow cambia una reserva y la gente edita o limpia el CRM; la base lo sigue', async () => {
  const { h, base, v } = armar();
  await v.importar();
  h.reservas[1][7] = 'NO_SHOW';
  h.crm[1][9] = 'Nota de Vanessa';
  h.crm.push(['Dora', '', 'dora@gmail.com', '', 'Manual', 'Lead', '', 0, 'NO', '', '', '']);
  let imp = await v.importar();
  assert.deepStrictEqual(imp.map((x) => [x.nuevas, x.actualizadas]), [[0, 1], [0, 0], [1, 1]]);
  h.crm.splice(2, 1);   // limpieza: Dora se borra de la hoja
  imp = await v.importar();
  assert.strictEqual(imp[2].borradas, 1);
  assert.ok(base.t.get('crm|e:dora@gmail.com').borrada, 'se marca borrada, no se borra');
  const r = await v.atender('carrito', { nombre: 'Dora', email: 'dora@gmail.com', telefono: '', valor: 259, consentimiento: 'NO', fecha: '2026-10-20' });
  assert.strictEqual(r.estado, 200);
  await esperar();
  assert.ok(h.crm.some((f) => f[2] === 'dora@gmail.com'), 'vuelve a entrar si llega otro aviso');
  assert.strictEqual(base.t.get('crm|e:dora@gmail.com').borrada, null);
});

test('Sombra: avisos recibidos que estan en la hoja y CRM igual = 0 diferencias; lo que falta, o un CRM distinto, se ve', async () => {
  const { h, base, v } = armar();
  base.recibidos.push({ hook: 'reserva', cuerpo: { id: 'r1', fecha: '2026-10-02', estado: 'CONFIRMED' } },
    { hook: 'carrito', cuerpo: { email: 'beto@gmail.com', fecha: '2026-10-01', valor: 259 } });
  // el CRM como lo dejo Apps Script: Beto ya entro por su carrito
  h.crm.push(['Beto', '', 'beto@gmail.com', '', 'Wix', 'Carrito abandonado', '', 0, 'SI', 'Intento 2026-10-01 · Q259', d('2026-10-20'), d('2026-10-01')]);
  let c = await v.comparar('2026-10-01');
  assert.deepStrictEqual(c.diferencias, []); assert.strictEqual(c.recibidos, 2);
  base.recibidos.push({ hook: 'reserva', cuerpo: { id: 'r9', fecha: '2026-10-20', estado: 'CONFIRMED' } },
    { hook: 'carrito', cuerpo: { email: 'zoe@gmail.com', fecha: '2026-10-20', valor: 518 } });
  h.crm.pop();   // Apps Script no sincronizo a Beto
  c = await v.comparar('2026-10-01');
  assert.strictEqual(c.diferencias.length, 3, c.diferencias.join(' | '));
  assert.match(c.diferencias.join(' '), /r9/); assert.match(c.diferencias.join(' '), /Q518/); assert.match(c.diferencias.join(' '), /agregaría/);
  assert.ok(!/beto@gmail/.test(c.diferencias.join(' ')), 'sin datos personales en el informe');
});

test('CAPI: el servidor arma el mismo evento que sendToCAPI de Code.js (comparado con el codigo real)', async () => {
  const vm = require('vm');
  const crypto = require('crypto');
  const CAPI = require('../src/vivo-clientes/capi');
  let enviado = null;
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'META_CAPI_TOKEN' ? 'tok' : null) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, computeDigest: (a, s) => [...crypto.createHash('sha256').update(String(s), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)) },
    UrlFetchApp: { fetch: (url, o) => { enviado = { url, payload: JSON.parse(o.payload) }; return { getResponseCode: () => 200 }; } },
    SpreadsheetApp: {}, LockService: {}, Logger: { log: () => {} }, ContentService: {}, console, JSON, Math, Date, String, Number, Object, Array, encodeURIComponent
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'mktos', 'Code.js'), 'utf8'), ctx);
  assert.strictEqual(ctx.sendToCAPI('carla@gmail.com', '+502 4444-1111', 518), 'enviado');
  const real = enviado.payload;
  const nube = CAPI.evento('carla@gmail.com', '+502 4444-1111', 518, real.data[0].event_time);
  assert.deepStrictEqual(nube, real);
  assert.match(enviado.url, new RegExp('/' + CAPI.DATASET + '/events\\?access_token='));
  let llamado = null;
  const enviar = CAPI.crearCapi({ token: 'tok', fetch: async (u, o) => { llamado = { u, b: JSON.parse(o.body) }; return { status: 200 }; }, ahora: () => 1e12 });
  assert.strictEqual(await enviar({ email: 'carla@gmail.com', tel: '', valor: 518 }), 'enviado');
  assert.strictEqual(llamado.b.data[0].event_time, 1e9);
  assert.strictEqual(await CAPI.crearCapi({ token: '' })({ email: 'x' }), 'omitido (sin META_CAPI_TOKEN)');
});

test('/interno/aviso: solo con la clave de tareas, vuelve a limpiar el cuerpo y pasa a crm.atender', async () => {
  const { crearAppVivo } = require('../src/vivo-clientes/app');
  const atendidos = [];
  const crm = { atender: async (h, c) => { atendidos.push([h, c]); return { estado: 200, json: { ok: true, id: 'r2' } }; }, estado: () => ({}) };
  const app = crearAppVivo({ pool: {}, vivo: { estado: () => ({}) }, crm, claveTareas: 'clave-de-tareas-larga' });
  const srv = app.listen(0); const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    const post = (cuerpo, clave) => fetch(b + '/interno/aviso', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, clave ? { 'x-rosanta-tarea': clave } : {}), body: JSON.stringify(cuerpo) });
    const R = { id: 'r2', fecha: '2026-10-21', nombre: 'Beto', email: 'beto@gmail.com', telefono: '', personas: 4, gasto: 0, estado: 'CONFIRMED', optin: 'SI' };
    assert.strictEqual((await post({ hook: 'reserva', cuerpo: R })).status, 403);
    assert.strictEqual((await post({ hook: 'reserva', cuerpo: R }, 'otra')).status, 403);
    assert.strictEqual((await post({ hook: 'reserva', cuerpo: Object.assign({ tab: 'usuarios' }, R) }, 'clave-de-tareas-larga')).status, 400);
    assert.strictEqual((await post({ hook: 'borrar', cuerpo: R }, 'clave-de-tareas-larga')).status, 400);
    assert.strictEqual(atendidos.length, 0);
    const r = await post({ hook: 'reserva', cuerpo: R }, 'clave-de-tareas-larga');
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { ok: true, id: 'r2' });
    assert.deepStrictEqual(atendidos, [['reserva', R]]);
  } finally { srv.close(); }
});

test('Un solo escritor: con el interruptor en puente (o sin fila), /interno/aviso no guarda nada (409)', async () => {
  const { base, v, h } = armar();
  await v.importar();
  const antes = JSON.stringify([...base.t.values()].map((x) => x.celdas));
  base.interruptores.hooks_reserva = 'puente';
  const r = await v.atender('reserva', { id: 'r5', fecha: '2026-10-21', nombre: 'Eva', email: 'eva@gmail.com', telefono: '', personas: 2, gasto: 0, estado: 'CONFIRMED', optin: 'SI' });
  assert.strictEqual(r.estado, 409);
  delete base.interruptores.hooks_carrito;
  assert.strictEqual((await v.atender('carrito', { nombre: 'Eva', email: 'eva@gmail.com', telefono: '', valor: 1, consentimiento: 'NO', fecha: '2026-10-20' })).estado, 409);
  await esperar();
  assert.strictEqual(JSON.stringify([...base.t.values()].map((x) => x.celdas)), antes);
  assert.ok(!h.reservas.some((f) => f[0] === 'r5'));
});
