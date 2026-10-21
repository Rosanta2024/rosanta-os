// La pestaña Eventos de la intranet abre la pantalla nueva del pipeline con motor_eventos = base (21-oct-2026).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { armarEventosVivo } = require('../src/vivo-clientes/pantalla');

const DIR = path.join(__dirname, '..', 'intranet');

function intranet(modo, usuarios) {
  const ctx = { console, JSON, Math, Date, String, Number, Object, Array, encodeURIComponent,
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => usuarios || [['email', 'b', 'c', 'd', 'e', 'token'], ['vane@x', '', '', '', '', 'tok-vane-1234']] }) }) }) },
    getSheetId_: () => 'CFG' };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'NubeClientes.js'), 'utf8'), ctx);
  ctx.eventosMotor_ = () => modo;
  return ctx;
}

test('Pestaña Eventos: con sheets, la de siempre; con base, la pantalla nueva dentro de la intranet con el enlace de la persona', () => {
  const B = 'https://script.google.com/a/x/exec';
  let c = intranet('sheets');
  assert.strictEqual(c.eventosUrl_(B, 'tok-1', { email: 'vane@x' }), B + '?page=eventos&u=tok-1');
  c = intranet('base');
  assert.match(c.eventosUrl_(B, 'tok-1', { email: 'vane@x' }), /^https:\/\/rosanta-clientes-.*\/clientes\/eventos\?u=tok-1&dentro=1$/);
  assert.match(c.eventosUrl_(B, '', { email: 'Vane@X' }), /\?u=tok-vane-1234&dentro=1$/, 'con la sesion de Google: su enlace de USUARIOS');
  assert.strictEqual(c.eventosUrl_(B, '', { email: 'nadie@x' }), B + '?page=eventos', 'sin enlace: la de siempre (solo consulta)');
});

test('La pantalla nueva dentro de la intranet va sin la barra de Clientes; suelta, con la barra', () => {
  const u = { email: 'd@x', rol: 'dueno', modulos: [], nombre: 'Juanma', puede_editar: true };
  const suelta = armarEventosVivo({ usuario: u, authToken: 'tok-1', vivo: true });
  const dentro = armarEventosVivo({ usuario: u, authToken: 'tok-1', vivo: true, dentro: true });
  assert.ok(suelta.length > dentro.length, 'la barra no va');
  assert.ok(/nb-aviso/.test(dentro), 'el aviso de "se guarda en la base" sigue');
});
