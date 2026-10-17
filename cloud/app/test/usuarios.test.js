const test = require('node:test');
const assert = require('node:assert');
const U = require('../src/usuarios');

const FILAS = [
  ['correo', 'rol', 'modulos', 'puede editar', 'nombre', 'token'],
  ['Restaurante@Rosanta.rest ', 'Dueño', 'finanzas, pagos ,recetario', 'SI', 'Juanma', 'abc123'],
  ['chef@gmail.com', 'chef', 'recetario,pagos', 'no', 'Jeffry', ''],
  ['', 'sala', 'pagos', 'NO', 'fila sin correo', 'zzz'],
  ['sala@gmail.com', 'sala', '', '', 'Maco', '  tok-maco  ']
];

test('La hoja USUARIOS se lee igual que Config.js de la intranet', () => {
  const us = U.usuariosDeFilas(FILAS);
  assert.strictEqual(us.length, 3, 'la fila sin correo no entra');
  assert.strictEqual(us[0].email, 'restaurante@rosanta.rest', 'correo en minusculas y sin espacios');
  assert.deepStrictEqual(us[0].modulos, ['finanzas', 'pagos', 'recetario']);
  assert.strictEqual(us[0].puede_editar, true);
  assert.strictEqual(us[1].puede_editar, false);
  assert.deepStrictEqual(us[2].modulos, [], 'sin modulos = lista vacia, no [""]');
});

test('El token nunca se guarda tal cual: solo su huella', () => {
  const us = U.usuariosDeFilas(FILAS);
  for (const u of us) assert.ok(!JSON.stringify(u).includes('abc123') && !JSON.stringify(u).includes('tok-maco'));
  assert.strictEqual(us[0].token_huella, U.huellaToken('abc123'));
  assert.strictEqual(us[2].token_huella, U.huellaToken('tok-maco'), 'el token se recorta como en Config.js');
  assert.strictEqual(us[1].token_huella, '', 'sin token = sin huella');
  assert.match(us[0].token_huella, /^[0-9a-f]{64}$/);
});

test('Un correo repetido en la hoja frena la copia', () => {
  assert.throws(() => U.usuariosDeFilas([FILAS[0], FILAS[2], ['CHEF@gmail.com', 'sala', '', '', '', '']]), /repite el correo chef@gmail.com/);
});

test('El modulo se exige igual que usuarioTieneModulo (el rol dueño no abre todo solo)', () => {
  const us = U.usuariosDeFilas(FILAS);
  assert.strictEqual(U.tieneModulo(us[0], 'pagos'), true);
  assert.strictEqual(U.tieneModulo(us[0], 'marketing'), false);
  assert.strictEqual(U.tieneModulo(null, 'pagos'), false);
  assert.strictEqual(U.normalizarRol('Dueño'), 'dueno');
});
