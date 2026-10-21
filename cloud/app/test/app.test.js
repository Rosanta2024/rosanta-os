const test = require('node:test');
const assert = require('node:assert');
const { crearApp } = require('../src/app');
const U = require('../src/usuarios');

/** Base de mentira: guarda usuarios en memoria y entiende las consultas que usa la app. */
function poolFalso(opciones) {
  const o = opciones || {};
  const db = { usuarios: o.usuarios || [] };
  const query = async (sql, p) => {
    if (o.caida) throw new Error('sin conexion');
    if (/count\(\*\)::int AS n FROM usuarios/.test(sql)) return { rows: [{ n: db.usuarios.length }] };
    if (/FROM usuarios WHERE token_huella/.test(sql)) return { rows: db.usuarios.filter((u) => u.token_huella === p[0]) };
    if (/^BEGIN|^COMMIT|^ROLLBACK/.test(sql)) return { rows: [] };
    if (/^DELETE FROM usuarios/.test(sql)) { db.nuevo = []; return { rows: [] }; }
    if (/^INSERT INTO usuarios/.test(sql)) { db.nuevo.push({ email: p[0], rol: p[1], modulos: p[2], puede_editar: p[3], nombre: p[4], token_huella: p[5] }); return { rows: [] }; }
    throw new Error('consulta no esperada: ' + sql);
  };
  return {
    db,
    query,
    connect: async () => ({
      query: async (sql, p) => { const r = await query(sql, p); if (/^COMMIT/.test(sql)) db.usuarios = db.nuevo; return r; },
      release: () => {}
    })
  };
}

async function servir(deps, fn) {
  const srv = crearApp(deps).listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try { return await fn(base); } finally { srv.close(); }
}

const HOJA = [['correo', 'rol', 'modulos', 'edita', 'nombre', 'token'], ['chef@gmail.com', 'chef', 'pagos', 'NO', 'Jeffry', 'tok-jeffry']];

test('/salud responde con la base viva y avisa 503 si se cae', async () => {
  await servir({ pool: poolFalso({ usuarios: [{}, {}] }) }, async (b) => {
    const r = await fetch(b + '/salud'); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(j.usuarios, 2);
  });
  await servir({ pool: poolFalso({ caida: true }) }, async (b) => {
    const r = await fetch(b + '/salud');
    assert.strictEqual(r.status, 503, 'base caida = 503, no un 200 enganoso');
  });
});

test('/yo exige el enlace: sin token o con uno falso no entra nadie', async () => {
  const pool = poolFalso({ usuarios: U.usuariosDeFilas(HOJA) });
  await servir({ pool }, async (b) => {
    assert.strictEqual((await fetch(b + '/yo')).status, 401);
    assert.strictEqual((await fetch(b + '/yo?u=otro')).status, 401);
    const r = await fetch(b + '/yo?u=tok-jeffry'); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(j.nombre, 'Jeffry'); assert.deepStrictEqual(j.modulos, ['pagos']);
    assert.ok(!('email' in j) && !('token_huella' in j), '/yo no devuelve ni correo ni huella');
    const h = await fetch(b + '/yo', { headers: { 'x-rosanta-u': 'tok-jeffry' } });
    assert.strictEqual(h.status, 200, 'la pantalla manda el token en la cabecera');
  });
});

test('La copia de USUARIOS solo la dispara quien tiene la clave de tareas', async () => {
  const pool = poolFalso();
  const deps = { pool, claveTareas: 'clave-buena', leerUsuariosHoja: async () => HOJA };
  await servir(deps, async (b) => {
    assert.strictEqual((await fetch(b + '/tareas/sincronizar-usuarios', { method: 'POST' })).status, 403);
    assert.strictEqual((await fetch(b + '/tareas/sincronizar-usuarios', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave-mala' } })).status, 403);
    const r = await fetch(b + '/tareas/sincronizar-usuarios', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave-buena' } });
    const j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(j.usuarios, 1); assert.strictEqual(j.con_enlace, 1);
    assert.strictEqual(pool.db.usuarios[0].token_huella, U.huellaToken('tok-jeffry'));
  });
});

test('Sin clave de tareas configurada, la copia queda cerrada para todos', async () => {
  await servir({ pool: poolFalso(), leerUsuariosHoja: async () => HOJA }, async (b) => {
    const r = await fetch(b + '/tareas/sincronizar-usuarios', { method: 'POST', headers: { 'x-rosanta-tarea': '' } });
    assert.strictEqual(r.status, 403);
  });
});

test('Una hoja vacia no borra los usuarios que ya estan en la base', async () => {
  const pool = poolFalso({ usuarios: U.usuariosDeFilas(HOJA) });
  await servir({ pool, claveTareas: 'k', leerUsuariosHoja: async () => [HOJA[0]] }, async (b) => {
    const r = await fetch(b + '/tareas/sincronizar-usuarios', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(pool.db.usuarios.length, 1);
  });
});

test('/tareas/eco: con la clave 200, sin ella 403 (la bateria de la intranet prueba NUBE_CLAVE_TAREAS)', async () => {
  const { crearApp } = require('../src/app');
  const srv = crearApp({ pool: { query: async () => ({ rows: [] }) }, claveTareas: 'k' }).listen(0);
  const b = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.strictEqual((await fetch(b + '/tareas/eco', { method: 'POST', headers: { 'x-rosanta-tarea': 'k' } })).status, 200);
    assert.strictEqual((await fetch(b + '/tareas/eco', { method: 'POST', headers: { 'x-rosanta-tarea': 'otra' } })).status, 403);
    assert.strictEqual((await fetch(b + '/tareas/eco', { method: 'POST' })).status, 403);
  } finally { srv.close(); }
});
