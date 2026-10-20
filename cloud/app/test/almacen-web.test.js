const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../src/almacen-web');

const DIR = path.join(__dirname, '../../db/migraciones');
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sinComentarios = (s) => s.replace(/--[^\n]*/g, '');

/** CREATE TABLE x ( ... ); → { x: [columnas] } */
function columnas(sql) {
  const out = {};
  for (const m of sinComentarios(sql).matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
    out[m[1]] = m[2].split('\n').map((l) => l.trim()).filter((l) => /^[a-z_]+ /.test(l) && !/^(UNIQUE|CHECK|PRIMARY|CONSTRAINT)\b/i.test(l)).map((l) => l.split(/\s+/)[0]);
  }
  return out;
}

test('Las migraciones 053 y 054 existen, son solo aditivas y la app no puede borrar', () => {
  for (const f of ['053_contenido_web.sql', '054_giftcards_pagos.sql']) {
    const s = sinComentarios(leer(f));
    assert.doesNotMatch(s, /\b(DROP|ALTER|TRUNCATE|DELETE)\b/i, f + ' trae una sentencia que no es aditiva');
    assert.doesNotMatch(s, /GRANT[^;]*\bDELETE\b/i, f + ' le da DELETE a la app');
    assert.match(s, /GRANT /, f + ' sin GRANT');
  }
  // movimientos, versiones, bitacora y webhooks: solo agregar (y lo puntual que cambia de estado)
  const s54 = sinComentarios(leer('054_giftcards_pagos.sql')), s53 = sinComentarios(leer('053_contenido_web.sql'));
  assert.match(s54, /GRANT SELECT, INSERT ON gift_cards_movimientos TO app;/);
  assert.doesNotMatch(s54, /GRANT[^;]*UPDATE[^;(]*gift_cards_movimientos/);
  assert.match(s53, /GRANT SELECT, INSERT ON web_versiones, web_bitacora TO app;/);
});

test('Ninguna otra migracion usa los numeros 053-054 ni los nombres de tabla nuevos', () => {
  const otras = fs.readdirSync(DIR).filter((f) => !/^05[34]_/.test(f));
  assert.ok(!otras.some((f) => /^05[34]_/.test(f)));
  const nuevas = Object.keys(columnas(leer('053_contenido_web.sql') + leer('054_giftcards_pagos.sql')));
  for (const f of otras) {
    const s = sinComentarios(leer(f));
    nuevas.forEach((t) => assert.doesNotMatch(s, new RegExp('CREATE TABLE ' + t + '\\b'), f + ' ya crea ' + t));
  }
  assert.strictEqual(fs.readdirSync(DIR).filter((f) => /^05[34]_/.test(f)).length, 2);
});

test('El almacen usa exactamente las tablas y columnas de las migraciones', () => {
  const cols = columnas(leer('053_contenido_web.sql') + leer('054_giftcards_pagos.sql'));
  assert.deepStrictEqual(Object.keys(A.TABLAS).sort(), Object.keys(cols).sort());
  for (const t of Object.keys(A.TABLAS)) assert.deepStrictEqual(A.TABLAS[t].cols.slice().sort(), cols[t].slice().sort(), t);
});

test('Almacen en memoria: unicos, CHECK de saldo y transaccion que se deshace entera', async () => {
  const al = A.crearAlmacenMemoria();
  await al.insertar('web_ajustes', { clave: 'x', valor: { a: 1 }, actualizado_por: 'p' });
  await assert.rejects(al.insertar('web_ajustes', { clave: 'x', valor: {}, actualizado_por: 'p' }), (e) => e.code === '23505');
  const base = { monto: 300, comprador_nombre: 'A', destinatario_nombre: 'B', origen: 'intranet', creada_por: 'p', vence: '2027-10-20' };
  await assert.rejects(al.insertar('gift_cards', Object.assign({ codigo: 'RSNT-ABCD-2345', saldo: -1 }, base)), (e) => e.code === '23514');
  await assert.rejects(al.insertar('gift_cards', Object.assign({ codigo: 'RSNT-ABCD-2345', saldo: 301 }, base)), (e) => e.code === '23514');
  await assert.rejects(al.insertar('gift_cards', Object.assign({ codigo: 'RSNT-ABC0-2345', saldo: 1 }, base)), (e) => e.code === '23514', 'el 0 no esta en el alfabeto');
  await assert.rejects(al.transaccion(async (tx) => {
    await tx.insertar('gift_cards', Object.assign({ codigo: 'RSNT-ABCD-2345', saldo: 300 }, base));
    throw new Error('algo fallo');
  }));
  assert.strictEqual((await al.lista('gift_cards')).length, 0, 'la transaccion no dejo nada');
  assert.throws(() => A.TABLAS.nada.cols, TypeError);
  await assert.rejects(al.insertar('gift_cards', { columna_rara: 1 }), /no tiene la columna/);
  await assert.rejects(al.actualizar('gift_cards_movimientos', 1, { monto: 5 }), /no se cambia/, 'los movimientos no se editan');
});

test('Almacen Postgres: arma SQL con parametros y solo nombres de la lista', async () => {
  const vistas = [];
  const pool = { query: async (sql, p) => { vistas.push({ sql, p }); return { rows: [{ id: '7', saldo: '120.50', monto: '300.00' }] }; } };
  const al = A.crearAlmacenPg(pool);
  const f = await al.uno('gift_cards', { codigo: "RSNT-ABCD-2345'; DROP TABLE x;--" }, { bloquear: true });
  assert.strictEqual(f.id, 7); assert.strictEqual(f.saldo, 120.5, 'numeric llega como numero');
  assert.match(vistas[0].sql, /^SELECT \* FROM gift_cards WHERE codigo = \$1 ORDER BY id LIMIT 1 FOR UPDATE$/);
  assert.deepStrictEqual(vistas[0].p, ["RSNT-ABCD-2345'; DROP TABLE x;--"]);
  await al.lista('web_faq', { activa: true, categoria: null }, { orden: ['orden', 'id DESC'] });
  assert.match(vistas[1].sql, /WHERE activa = \$1 AND categoria IS NULL ORDER BY orden, id DESC$/);
  await assert.rejects(al.lista('web_faq', {}, { orden: ['id; DROP TABLE x'] }), /Orden desconocido/);
  await al.insertar('web_ajustes', { clave: 'k', valor: { a: 1 }, actualizado_por: 'p' });
  assert.match(vistas[2].sql, /^INSERT INTO web_ajustes \(clave, valor, actualizado_por\) VALUES \(\$1, \$2, \$3\) RETURNING \*$/);
  assert.strictEqual(vistas[2].p[1], '{"a":1}', 'jsonb va como texto JSON');
});
