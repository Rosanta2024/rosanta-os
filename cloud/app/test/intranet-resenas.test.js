// La pestaña Reseñas de la intranet (NubeResenas.js, 22-oct-2026): con 'base' abre el panel en vivo del servidor nuevo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ARCHIVO = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-intranet', 'NubeResenas.js');
function cargar(modo, opciones) {
  const o = opciones || {};
  const pedidos = [];
  const ctx = {
    CONFIG: { RESENAS_URL: 'https://script.google.com/macros/s/VIEJO/exec' },
    NUBE_ENSAYO_URL_: 'https://rosanta-nube-ensayo-512086396641.northamerica-south1.run.app',
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: (u) => { pedidos.push(u); if (modo === 'cae') throw new Error('sin red'); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ modo }) }; } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [['email', '', '', '', '', 'token'], ['restaurante@rosanta.rest', '', '', '', '', 'tok-de-la-hoja']] }) }) }) },
    getSheetId_: () => 'cfg',
    normalizar_: (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ARCHIVO, 'utf8'), ctx);
  return { ctx, pedidos };
}
const DUENO = { email: 'restaurante@rosanta.rest', rol: 'Dueño' };

test('Reseñas en la intranet: con puente (o sin servidor) el panel de siempre; con base, el del servidor nuevo con el enlace', () => {
  assert.strictEqual(cargar('puente').ctx.resenasDestino_(DUENO, 'abc', ''), 'https://script.google.com/macros/s/VIEJO/exec');
  assert.strictEqual(cargar('cae').ctx.resenasDestino_(DUENO, 'abc', ''), 'https://script.google.com/macros/s/VIEJO/exec');
  const c = cargar('base');
  assert.strictEqual(c.ctx.resenasDestino_(DUENO, 'abc', ''), 'https://rosanta-nube-512086396641.northamerica-south1.run.app/clientes/resenas?u=abc&dentro=1');
  assert.strictEqual(c.pedidos[0], 'https://rosanta-nube-512086396641.northamerica-south1.run.app/resenas/modo');
  // entro con la sesion de rosanta.rest (sin ?u=): el enlace sale de USUARIOS
  assert.match(cargar('base').ctx.resenasDestino_(DUENO, '', ''), /\?u=tok-de-la-hoja&dentro=1$/);
});

test('Reseñas en la intranet: ?nube=ensayo solo para el dueño, y sin enlace se queda el panel de siempre', () => {
  assert.match(cargar('puente').ctx.resenasDestino_(DUENO, 'abc', 'ensayo'), /^https:\/\/rosanta-nube-ensayo-.*\/clientes\/resenas\?u=abc&dentro=1$/);
  assert.strictEqual(cargar('puente').ctx.resenasDestino_({ email: 'x@rosanta.rest', rol: 'Cocina' }, 'abc', 'ensayo'), 'https://script.google.com/macros/s/VIEJO/exec');
  assert.strictEqual(cargar('base').ctx.resenasDestino_({ email: 'nadie@rosanta.rest', rol: 'Cocina' }, '', ''), 'https://script.google.com/macros/s/VIEJO/exec');
});
