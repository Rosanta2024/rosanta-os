// Procesos FEL y banco (20-oct-2026): el codigo real de FelCorreo.js / BancoCorreo.js con Gmail precargado.
// Corre con TZ=America/Guatemala. Mensajes armados a mano con la forma de los reales (datos inventados).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const C = require('../src/copia-hojas');
const { crearCuenta } = require('../src/google-cuenta');
const { montarProcesos, modoProceso, compararConHoja } = require('../src/proc-fel-banco');

const CFG = C.LIBROS.config.id;
const CLAVE = 'clave-de-prueba';
const FEC_H = ['FECHA', 'TIPO', 'SERIE', 'NUMERO', 'NIT', 'NOMBRE', 'ESTABLECIMIENTO', 'MONEDA', 'MONTO', 'AUTORIZACION', 'MENSAJE_ID', 'LEIDO'];
const BCO_H = ['FECHA', 'HORA', 'MEDIO', 'BANCO_DESTINO', 'CUENTA', 'NOMBRE', 'DESCRIPCION', 'MONTO', 'MENSAJE_ID', 'LEIDO'];

// ---- los correos ----
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const tabla = (pares) => '<html><body><table>' + pares.map(([k, v]) => '<tr><td><b>' + k + '</b></td><td>' + v + '</td></tr>').join('') + '</table></body></html>';
const mensaje = (id, html, internalDate) => ({ id, internalDate: String(internalDate || Date.UTC(2026, 9, 13, 16, 0)),
  payload: { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('ver en HTML') } }, { mimeType: 'text/html', body: { data: b64(html) } }] } });
const avisoFel = (numero, monto, nit) => tabla([['Tipo', 'FACT - Factura'], ['N&uacute;mero Autorizaci&oacute;n', 'AB12-' + numero], ['Serie', 'AB12CD34'],
  ['N&uacute;mero', numero], ['Emisor', (nit || '12345678') + ' - DISTRIBUIDORA LA ESQUINA, S.A.'], ['Establecimiento', '1 - LA ESQUINA ANTIGUA'],
  ['Fecha de Emisi&oacute;n', '2026-10-13T09:41:00-06:00'], ['Monto', 'GTQ - ' + monto]]);
const avisoBanco = (q, origen) => tabla([['Banco', 'BANCO INDUSTRIAL'], ['Generado por', origen || 'CORSAGA, S.A.'], ['Banco', 'BANRURAL'],
  ['Cuenta', '3-445-01234-5'], ['Nombre', 'LAVANDERIA EL SOL'], ['Descripci&oacute;n de pago', 'Lavanderia Octubre'], ['Cr&eacute;dito de', 'Q.' + q]]);

/** fetch falso de Google: token, lista y mensajes. Anota cada pedido (para ver que nada escribe en Gmail). */
function google(mensajes, opciones) {
  const o = opciones || {};
  const pedidos = [];
  const f = async (url, op) => {
    pedidos.push({ url, metodo: (op && op.method) || 'GET' });
    const r = (status, j) => ({ ok: status < 300, status, json: async () => j, text: async () => JSON.stringify(j) });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return o.sinPermiso ? r(400, { error: 'invalid_grant' }) : r(200, { access_token: 'AT', expires_in: 3600 });
    const m = /\/users\/me\/messages\/([^/?]+)\?format=full$/.exec(url);
    if (m) return mensajes[m[1]] ? r(200, mensajes[m[1]]) : r(404, {});
    if (/\/users\/me\/messages\?/.test(url)) return r(200, { messages: Object.keys(mensajes).map((id) => ({ id, threadId: id })), resultSizeEstimate: 2 });
    return r(404, {});
  };
  f.pedidos = pedidos;
  return f;
}

// ---- la base de mentira: hojas_copia + filas_vivas ----
function base(libros) {
  const vivas = new Map();   // 'pestana|llave' → { pestana, llave, celdas, orden, origen, actualizado, copiado_a_hoja }
  let reloj = 0;
  const corridas = [];
  const q = async (sql, p) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    if (/FROM hojas_copia/.test(sql)) {
      const rows = [];
      Object.keys(libros).forEach((l) => Object.keys(libros[l]).forEach((pe) => rows.push({ libro: l, pestana: pe, filas: JSON.parse(JSON.stringify(C.codificar(libros[l][pe]))), leida: new Date() })));
      return { rows };
    }
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    const de = (pe) => Array.from(vivas.values()).filter((x) => x.pestana === pe).sort((a, b) => a.orden - b.orden);
    if (/^SELECT llave AS id, celdas, origen, orden FROM filas_vivas WHERE pestana = \$1 FOR UPDATE/.test(sql)) return { rows: de(p[0]).map((x) => ({ id: x.llave, celdas: x.celdas, origen: x.origen, orden: x.orden })) };
    if (/^UPDATE filas_vivas SET orden = \$3/.test(sql)) { vivas.get(p[0] + '|' + p[1]).orden = p[2]; return { rows: [] }; }
    if (/^UPDATE filas_vivas SET celdas = \$3, orden = \$4, origen = 'hoja'/.test(sql)) { Object.assign(vivas.get(p[0] + '|' + p[1]), { celdas: JSON.parse(p[2]), orden: p[3], origen: 'hoja', actualizado: ++reloj }); return { rows: [] }; }
    if (/^INSERT INTO filas_vivas \(pestana, llave, celdas, orden, origen\) VALUES \(\$1,\$2,\$3,\$4,'hoja'\)/.test(sql)) {
      vivas.set(p[0] + '|' + p[1], { pestana: p[0], llave: p[1], celdas: JSON.parse(p[2]), orden: p[3], origen: 'hoja', actualizado: ++reloj, copiado_a_hoja: null }); return { rows: [] };
    }
    if (/^INSERT INTO filas_vivas_importaciones/.test(sql)) return { rows: [] };
    if (/^SELECT celdas FROM filas_vivas WHERE pestana = \$1 ORDER BY/.test(sql)) return { rows: de(p[0]).map((x) => ({ celdas: x.celdas })) };
    if (/^INSERT INTO filas_vivas .*'servidor'\) ON CONFLICT \(pestana, llave\) DO NOTHING RETURNING llave/.test(sql)) {
      const k = p[0] + '|' + p[1];
      if (vivas.has(k)) return { rows: [] };
      vivas.set(k, { pestana: p[0], llave: p[1], celdas: JSON.parse(p[2]), orden: de(p[0]).reduce((a, x) => Math.max(a, x.orden), 0) + 1, origen: 'servidor', actualizado: ++reloj, copiado_a_hoja: null });
      return { rows: [{ llave: p[1] }] };
    }
    if (/^SELECT llave, celdas, actualizado::text AS actualizado FROM filas_vivas WHERE pestana = \$1 AND origen = 'servidor'/.test(sql)) {
      return { rows: de(p[0]).filter((x) => x.origen === 'servidor' && (x.copiado_a_hoja === null || x.actualizado > x.copiado_a_hoja)).map((x) => ({ llave: x.llave, celdas: x.celdas, actualizado: String(x.actualizado) })) };
    }
    if (/^UPDATE filas_vivas SET copiado_a_hoja = now\(\)/.test(sql)) { const x = vivas.get(p[0] + '|' + p[1]); if (x && String(x.actualizado) === p[2]) x.copiado_a_hoja = x.actualizado; return { rows: [] }; }
    if (/^INSERT INTO procesos_corridas/.test(sql)) { corridas.push(p); return { rows: [] }; }
    throw new Error('consulta no esperada: ' + sql);
  };
  return { vivas, corridas, query: q, connect: async () => ({ query: q, release: () => {} }) };
}

/** Sheets de mentira para la copia a la hoja (copiarFilas). */
function sheetsFalso(pestanas) {
  const lotes = [];
  return { lotes, spreadsheets: {
    get: async () => ({ data: { sheets: Object.keys(pestanas).map((t, i) => ({ properties: { title: t, sheetId: 10 + i } })) } }),
    values: { get: async ({ range }) => ({ data: { values: pestanas[range.replace(/'/g, '')] } }) },
    batchUpdate: async ({ requestBody }) => { lotes.push(requestBody.requests); return { data: {} }; }
  } };
}

function libros(param, fel, banco) {
  return { [CFG]: { PARAMETROS: [['parametro', 'valor']].concat(param), FEL_CORREO: fel || [FEC_H.slice()], BANCO_CORREO: banco || [BCO_H.slice()] } };
}
const CRED = { client_id: 'c', client_secret: 's', refresh_token: 'r' };

async function servir(deps, fn) {
  const app = express();
  app.use(express.json());
  montarProcesos(app, Object.assign({ claveTareas: CLAVE }, deps));
  const srv = app.listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const tarea = async (b, nombre, clave) => {
  const r = await fetch(b + '/tareas/procesos/' + nombre, { method: 'POST', headers: { 'x-rosanta-tarea': clave === undefined ? CLAVE : clave } });
  return { status: r.status, j: await r.json() };
};
// la fila de FEL_CORREO que la intranet ya tiene para un aviso (como la lee la copia: textos, numero, LEIDO fecha)
const filaFel = (id, numero, monto) => ['2026-10-13', 'FACT', 'AB12CD34', numero, '12345678', 'DISTRIBUIDORA LA ESQUINA, S.A.', 'LA ESQUINA ANTIGUA', 'GTQ', monto, 'AB12-' + numero, id, new Date(2026, 9, 13, 9, 45, 0)];

test('El interruptor: apps por defecto; sombra y nube solo escritos asi', () => {
  const L = (v) => libros([['proc_fel', v]]);
  assert.strictEqual(modoProceso(L('sombra'), 'proc_fel'), 'sombra');
  assert.strictEqual(modoProceso(L(' Nube '), 'proc_fel'), 'nube');
  assert.strictEqual(modoProceso(L(''), 'proc_fel'), 'apps');
  assert.strictEqual(modoProceso(L('base'), 'proc_fel'), 'apps', 'una palabra de otro interruptor no enciende nada');
  assert.strictEqual(modoProceso(L('nube'), 'proc_banco'), 'apps', 'cada proceso tiene su interruptor');
  assert.strictEqual(modoProceso({}, 'proc_fel'), 'apps');
});

test('apps: responde {modo:apps} sin tocar Google ni la base; sin clave, 403', async () => {
  const f = google({});
  const pool = base(libros([['proc_fel', 'apps']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    assert.deepStrictEqual(await tarea(b, 'fel'), { status: 200, j: { modo: 'apps' } });
    assert.deepStrictEqual(await tarea(b, 'banco'), { status: 200, j: { modo: 'apps' } }, 'sin la fila proc_banco tambien es apps');
    assert.strictEqual((await tarea(b, 'fel', 'otra')).status, 403);
    assert.strictEqual((await tarea(b, 'fel', '')).status, 403);
  });
  assert.strictEqual(f.pedidos.length, 0);
  assert.strictEqual(pool.vivas.size, 0);
});

test('FEL en sombra igual: lee con el codigo real, cuenta lo que falta y no escribe en ningun lado', async () => {
  const f = google({ m1: mensaje('m1', avisoFel('1001', '1,234.50')), m2: mensaje('m2', avisoFel('1002', '300.00')) });
  const pool = base(libros([['proc_fel', 'sombra']], [FEC_H.slice(), filaFel('m1', '1001', 1234.5)]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.strictEqual(r.j.modo, 'sombra');
    assert.strictEqual(r.j.leidos, 2);
    assert.strictEqual(r.j.nuevas_que_faltan_en_hoja, 1);
    assert.strictEqual(r.j.distintas, 0);
    assert.deepStrictEqual(r.j.errores, []);
    const falta = r.j.detalle.faltan[0];
    assert.strictEqual(falta.mensaje_id, 'm2');
    assert.deepStrictEqual([falta.fila.FECHA, falta.fila.NUMERO, falta.fila.NIT, falta.fila.MONTO, falta.fila.MONEDA, falta.fila.ESTABLECIMIENTO],
      ['2026-10-13', '1002', '12345678', '300', 'GTQ', 'LA ESQUINA ANTIGUA']);
  });
  const lista = f.pedidos.find((p) => /messages\?/.test(p.url));
  assert.match(decodeURIComponent(lista.url.replace(/\+/g, ' ')), /q=from:notificacionesfel@sat\.gob\.gt newer_than:21d/);
  assert.match(lista.url, /includeSpamTrash=true/, 'como la intranet: tambien la papelera');
  assert.ok(f.pedidos.every((p) => p.metodo === 'GET' || /oauth2/.test(p.url)), 'a Gmail solo se le pide leer');
  assert.strictEqual(pool.vivas.size, 0, 'la sombra no guarda nada en la base');
  assert.strictEqual(pool.corridas.length, 1, 'la corrida queda anotada');
});

test('FEL en sombra distinta: 409 con la columna que no coincide', async () => {
  const f = google({ m1: mensaje('m1', avisoFel('1001', '1,234.50')) });
  const pool = base(libros([['proc_fel', 'sombra']], [FEC_H.slice(), filaFel('m1', '1001', 1234)]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.j.distintas, 1);
    assert.strictEqual(r.j.nuevas_que_faltan_en_hoja, 0);
    assert.deepStrictEqual(r.j.detalle.distintas[0], { mensaje_id: 'm1', columnas: [{ columna: 'MONTO', hoja: '1234', nube: '1234.5' }] });
  });
});

test('La comparacion ignora LEIDO y acepta numero contra texto con el mismo valor', () => {
  const nube = [filaFel('m1', '1001', 1234.5)];
  nube[0][11] = new Date();
  const hoja = [FEC_H.slice(), filaFel('m1', 1001, '1234.50')];
  assert.deepStrictEqual(compararConHoja(hoja, FEC_H, nube), []);
});

test('Banco en sombra: fecha y hora de Guatemala, cuenta solo digitos; lo que no sale de CORSAGA se anota como la intranet', async () => {
  const f = google({ t1: mensaje('t1', avisoBanco('1,500.00'), Date.UTC(2026, 9, 16, 20, 15)), t2: mensaje('t2', avisoBanco('99.00', 'OTRA EMPRESA'), Date.UTC(2026, 9, 17, 1, 5)) });
  const pool = base(libros([['proc_banco', 'sombra']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'banco');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.strictEqual(r.j.leidos, 2);
    assert.strictEqual(r.j.nuevas_que_faltan_en_hoja, 2);
    const [a, o] = r.j.detalle.faltan;
    assert.deepStrictEqual([a.fila.FECHA, a.fila.HORA, a.fila.MEDIO, a.fila.BANCO_DESTINO, a.fila.CUENTA, a.fila.NOMBRE, a.fila.DESCRIPCION, a.fila.MONTO],
      ['2026-10-16', '14:15', 'Banco BI', 'BANRURAL', '3445012345', 'LAVANDERIA EL SOL', 'Lavanderia Octubre', '1500']);
    assert.deepStrictEqual([o.fila.FECHA, o.fila.HORA, o.fila.NOMBRE], ['2026-10-16', '19:05', 'no es transferencia de CORSAGA'], 'la 1:05 UTC del 17 es el 16 en Guatemala');
  });
  const lista = f.pedidos.find((p) => /messages\?/.test(p.url));
  assert.match(decodeURIComponent(lista.url.replace(/\+/g, ' ')), /from:bibanking@notificacionesbi\.com\.gt subject:"Notificación operación" newer_than:60d/);
});

test('FEL en nube: importa la hoja, guarda lo nuevo, lo copia a la hoja y no duplica (ni un aviso repetido de SAT)', async () => {
  const msgs = { m1: mensaje('m1', avisoFel('1001', '1,234.50')), m2: mensaje('m2', avisoFel('1002', '300.00')),
    m3: mensaje('m3', avisoFel('1002', '300.00')) };   // SAT avisa dos veces la misma factura
  const f = google(msgs);
  const hoja = [FEC_H.slice(), filaFel('m1', '1001', 1234.5)];
  const pool = base(libros([['proc_fel', 'nube']], hoja));
  const S = sheetsFalso({ FEL_CORREO: [FEC_H.slice(), ['2026-10-13', 'FACT', 'AB12CD34', '1001', '12345678', 'x', 'x', 'GTQ', 1234.5, 'a', 'm1', 46300]] });
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }), sheetsEscritura: () => S }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.deepStrictEqual([r.j.modo, r.j.leidos, r.j.nuevas], ['nube', 3, 1]);
    assert.deepStrictEqual([r.j.importacion.nuevas, r.j.importacion.problemas.length], [1, 0], 'la fila de la hoja entro a la base');
    assert.deepStrictEqual([r.j.copia_hoja.nuevas, r.j.copia_hoja.actualizadas], [1, 0]);
    const ap = S.lotes[0].find((x) => x.appendCells).appendCells;
    assert.strictEqual(ap.sheetId, 10);
    assert.strictEqual(ap.rows[0].values[FEC_H.indexOf('MENSAJE_ID')].userEnteredValue.stringValue, 'm2');
    assert.strictEqual(ap.rows[0].values[FEC_H.indexOf('NUMERO')].userEnteredValue.stringValue, '1002', 'el numero va como texto');
    assert.strictEqual(ap.rows[0].values[FEC_H.indexOf('LEIDO')].userEnteredFormat.numberFormat.type, 'DATE_TIME');
    const v = pool.vivas.get('FEL_CORREO|m2');
    assert.strictEqual(v.origen, 'servidor');
    assert.ok(v.copiado_a_hoja, 'marcada como copiada');
    assert.ok(!pool.vivas.has('FEL_CORREO|m3'), 'el segundo aviso de la misma factura no se anota');
    // otra corrida con la MISMA copia (la hoja todavia no refresco): nada nuevo, nada que copiar
    const r2 = await tarea(b, 'fel');
    assert.strictEqual(r2.status, 200, JSON.stringify(r2.j));
    assert.deepStrictEqual([r2.j.nuevas, r2.j.copia_hoja.pendientes], [0, 0]);
    assert.strictEqual(S.lotes.length, 1);
  });
  assert.strictEqual(pool.vivas.size, 2);
  assert.ok(f.pedidos.every((p) => p.metodo === 'GET' || /oauth2/.test(p.url)), 'tampoco en nube se toca Gmail');
});

test('Nube sin permiso de escribir en Sheets: guarda en la base y deja la copia pendiente', async () => {
  const f = google({ t1: mensaje('t1', avisoBanco('250.00'), Date.UTC(2026, 9, 16, 15, 0)) });
  const pool = base(libros([['proc_banco', 'nube']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'banco');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.deepStrictEqual([r.j.nuevas, r.j.copia_hoja.pendientes], [1, 1]);
    assert.match(r.j.copia_hoja.aviso, /queda en la base/);
  });
  assert.strictEqual(pool.vivas.get('BANCO_CORREO|t1').copiado_a_hoja, null);
});

test('Sin permiso de Gmail: error claro (503) y nada guardado', async () => {
  const pool = base(libros([['proc_fel', 'sombra'], ['proc_banco', 'nube']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: process.env.NO_EXISTE }) }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 503);
    assert.match(r.j.error, /GMAIL_OAUTH/);
  });
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: google({}, { sinPermiso: true }) }) }, async (b) => {
    const r = await tarea(b, 'banco');
    assert.strictEqual(r.status, 503);
    assert.match(r.j.error, /No se pudo leer Gmail.*invalid_grant.*volver a autorizar/);
  });
  await servir({ pool }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 503);
    assert.match(r.j.error, /GMAIL_OAUTH/);
  });
  assert.strictEqual(pool.vivas.size, 0);
});

test('Un correo que el codigo no puede leer sale como error y la sombra da 409 (mirar el conteo, no el color)', async () => {
  const f = google({ t1: mensaje('t1', avisoBanco('10.00'), 'fecha-rota') });   // internalDate invalido: formatDate tira
  const pool = base(libros([['proc_banco', 'sombra']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'banco');
    assert.strictEqual(r.status, 409, JSON.stringify(r.j));
    assert.deepStrictEqual([r.j.distintas, r.j.nuevas_que_faltan_en_hoja], [0, 0]);
    assert.match(r.j.errores[0], /^t1: /);
  });
});

test('Sin cuerpo no es un aviso: se anota como "no es aviso de DTE", igual que la intranet', async () => {
  const f = google({ x1: { id: 'x1', internalDate: '0', payload: null } });
  const pool = base(libros([['proc_fel', 'sombra']]));
  await servir({ pool, cuentaGoogle: () => crearCuenta({ credencial: CRED, fetch: f }) }, async (b) => {
    const r = await tarea(b, 'fel');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.strictEqual(r.j.detalle.faltan[0].fila.NOMBRE, 'no es aviso de DTE');
  });
});
