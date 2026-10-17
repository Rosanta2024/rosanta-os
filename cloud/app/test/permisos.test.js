const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/permisos');

const M = P.cargarDeMigracion();
const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño', nombre: 'Juanma' };
const jeffry = { email: 'chef@gmail.com', rol: 'chef', nombre: 'Jeffry' };
const maco = { email: 'maco@gmail.com', rol: 'sala', nombre: 'Maco' };
const vanessa = { email: 'pauta@gmail.com', rol: 'pauta', nombre: 'Vanessa' };
const ok = (r) => r.ok;

// La matriz de Juanma (17-oct-2026), escrita aparte de la migracion a proposito: si alguien
// cambia la migracion sin cambiar el documento (o al reves), esta prueba falla.
// Columnas: dueño · cocina · sala · pauta.  T todo · I ingresar · V ver · - no lo ve
const MATRIZ = {
  pagos: 'T I I -', caja: 'T I I -', cierres: 'T - I -', recetario: 'T T T -', inventario: 'T I I -',
  finanzas: 'T - - -', reporte_semanal: 'T V V -',
  eventos: 'T - I -', crm: 'T - V V', reservas: 'T V I V', carritos: 'T - - V',
  resenas: 'T - - -', consola: 'T - - -',
  pauta: 'T - - I',
  tecnico: 'T - - -'
};
const NIVEL = { T: 'todo', I: 'ingresar', V: 'ver' };

test('La migracion 020 trae exactamente la matriz de Juanma', () => {
  const roles = ['dueno', 'chef', 'sala', 'pauta'];
  const esperado = [];
  for (const [parte, letras] of Object.entries(MATRIZ)) {
    letras.split(' ').forEach((l, i) => { if (l !== '-') esperado.push(roles[i] + '|' + parte + '|' + NIVEL[l]); });
  }
  const real = [...M.permisos.values()].map((f) => f.rol + '|' + f.parte + '|' + f.nivel);
  assert.deepStrictEqual(real.sort(), esperado.sort());
});

test('Las areas: cocina para Jeffry, barra para Maco, en pagos, recetario e inventario', () => {
  for (const parte of ['pagos', 'recetario', 'inventario']) {
    assert.strictEqual(M.permisos.get('chef|' + parte).area, 'cocina', parte);
    assert.strictEqual(M.permisos.get('sala|' + parte).area, 'barra', parte);
  }
  assert.ok(!ok(P.puede(M, jeffry, 'pagos', 'ingresar', { area: 'BARRA' })), 'Jeffry no anota en barra');
  assert.ok(ok(P.puede(M, jeffry, 'pagos', 'ingresar', { area: 'COCINA' })));
  assert.ok(!ok(P.puede(M, maco, 'recetario', 'corregir', { area: 'cocina' })), 'Maco no toca recetas de cocina');
});

test('El equipo corrige lo suyo en cualquier momento, y lo ajeno no', () => {
  const suyo = { area: 'cocina', escrito_por: 'Jeffry' };
  const ajeno = { area: 'cocina', escrito_por: 'Juanma' };
  assert.ok(ok(P.puede(M, jeffry, 'pagos', 'corregir', suyo)));
  assert.ok(ok(P.puede(M, jeffry, 'pagos', 'corregir', { area: 'cocina', escrito_por: 'chef@gmail.com' })), 'por correo tambien');
  const r = P.puede(M, jeffry, 'pagos', 'corregir', ajeno);
  assert.ok(!r.ok);
  assert.match(r.motivo, /lo anotó Juanma/);
  assert.ok(!ok(P.puede(M, jeffry, 'pagos', 'corregir', { area: 'cocina' })), 'sin autor no es suyo');
  assert.ok(ok(P.puede(M, juanma, 'pagos', 'corregir', { area: 'cocina', escrito_por: 'Jeffry' })), 'el dueño corrige lo ajeno');
  assert.ok(ok(P.puede(M, vanessa, 'pauta', 'corregir', { escrito_por: 'Vanessa' })));
  assert.ok(!ok(P.puede(M, vanessa, 'pauta', 'corregir', { escrito_por: 'Juanma' })));
});

test('Recetario: acceso total en su area (Juanma, 17-oct)', () => {
  assert.ok(ok(P.puede(M, jeffry, 'recetario', 'corregir', { area: 'cocina', escrito_por: 'Juanma' })));
});

test('Solo el dueño: banco, No pertenece, precio de venta, exportar, accesos, ajeno, dia cerrado', () => {
  for (const a of ['confirmar_banco', 'no_pertenece', 'precio_venta', 'exportar_contactos', 'dar_accesos', 'corregir_ajeno', 'corregir_dia_cerrado']) {
    assert.ok(ok(P.puede(M, juanma, 'pagos', a)), a);
    for (const u of [jeffry, maco, vanessa]) assert.ok(!ok(P.puede(M, u, 'recetario', a)), u.nombre + ' ' + a);
  }
});

test('Ver no deja escribir, y sin fila no se ve', () => {
  assert.ok(ok(P.puede(M, maco, 'crm', 'ver')));
  assert.ok(!ok(P.puede(M, maco, 'crm', 'ingresar')));
  assert.ok(ok(P.puede(M, jeffry, 'reservas', 'ver')));
  assert.ok(!ok(P.puede(M, jeffry, 'reservas', 'ingresar')));
  assert.ok(!ok(P.puede(M, jeffry, 'finanzas', 'ver')));
  assert.ok(!ok(P.puede(M, vanessa, 'eventos', 'ver')), 'pauta no ve el pipeline');
  assert.ok(ok(P.puede(M, maco, 'eventos', 'ingresar')), 'sala ingresa eventos');
  assert.ok(!ok(P.puede(M, { email: 'x', rol: 'contador' }, 'finanzas', 'ver')), 'contador sin filas todavia');
  assert.ok(!ok(P.puede(M, null, 'pagos', 'ver')));
});

test('Control negativo: una matriz con un permiso de mas no pasa la primera prueba', () => {
  const real = [...M.permisos.values()].map((f) => f.rol + '|' + f.parte + '|' + f.nivel);
  assert.notDeepStrictEqual(real.concat('pauta|finanzas|ver').sort(), real.sort());
  const M2 = P.armar([...M.permisos.values()].concat({ rol: 'pauta', parte: 'finanzas', nivel: 'ver', area: '*' }), []);
  assert.ok(ok(P.puede(M2, vanessa, 'finanzas', 'ver')), 'con la fila de mas, Vanessa veria Finanzas');
});
