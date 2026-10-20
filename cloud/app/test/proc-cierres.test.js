// Procesos en la nube: "Leer cierres" con el codigo real de la intranet y Gmail/Drive de mentira (20-oct-2026).
// Corre con TZ=America/Guatemala. Los textos de los cierres son los que saco Drive de los PDF reales de PosFile
// (tools/harness-intranet/fixtures, copiados en test/fixturas).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const C = require('../src/copia-hojas');
const { libros } = require('./fixtura');
const { crearServicioPagos } = require('../src/servicio-pagos');
const { crearCuenta } = require('../src/google-cuenta');
const P = require('../src/proc-cierres');

const CLAVE = 'clave-de-prueba';
const CFG = C.LIBROS.config.id;
const TXT = (d) => fs.readFileSync(path.join(__dirname, 'fixturas', 'cierre_drive_2026-10-' + d + '.txt'), 'utf8');
const CIE_COLS = ['FECHA', 'GRAN_TOTAL', 'SIN_PROPINA', 'PROPINA', 'TARJETA', 'EFECTIVO', 'TRANSFERENCIA', 'PEDIDOS_YA', 'UBER_EATS', 'CORTESIA',
  'TICKETS', 'PRODUCTOS', 'COMENSALES_RESERVA', 'CUADRA', 'MENSAJE_ID', 'LEIDO', 'GASTOS_POS', 'DOCUMENTOS', 'FORMATO', 'TEXTO_SI_NO_CUADRA'];

/** La base de mentira: la copia de las hojas (hojas_copia), filas_vivas y, si se pide, la copia de reservas. */
function poolFalso(params, opciones) {
  const o = opciones || {};
  const L = libros();
  L.CFG.PARAMETROS = params;
  L.CFG.CIERRES_DIARIOS = [CIE_COLS.slice()];
  const vivas = new Map();   // llave -> { celdas, orden }
  const pool = {
    vivas,
    query: async (sql, p) => {
      if (/FROM hojas_copia_f2/.test(sql)) {
        if (!o.reservas) throw new Error('relation "hojas_copia_f2" does not exist');
        return { rows: [{ filas: C.codificar(o.reservas), leida: new Date(2026, 9, 20, 6) }] };
      }
      if (/FROM hojas_copia/.test(sql)) {
        const filas = [];
        Object.keys(L).forEach((libro) => Object.keys(L[libro]).forEach((pe) =>
          filas.push({ libro: libro === 'CFG' ? CFG : libro, pestana: pe, filas: JSON.parse(JSON.stringify(C.codificar(L[libro][pe]))), leida: new Date() })));
        return { rows: filas };
      }
      if (/SELECT celdas FROM filas_vivas WHERE pestana = \$1 ORDER BY/.test(sql)) {
        if (p[0] !== 'CIERRES_DIARIOS') return { rows: [] };
        return { rows: Array.from(vivas.values()).sort((a, b) => a.orden - b.orden).map((x) => ({ celdas: x.celdas })) };
      }
      if (/INSERT INTO filas_vivas .*ON CONFLICT/s.test(sql)) {
        const nuevo = !vivas.has(p[0]);
        vivas.set(p[0], { celdas: JSON.parse(p[1]), orden: nuevo ? vivas.size + 1 : vivas.get(p[0]).orden });
        return { rows: [{ nuevo }] };
      }
      if (/FROM permisos|FROM acciones_solo_dueno/.test(sql)) throw new Error('sin tabla de permisos en la prueba');
      throw new Error('consulta no esperada ' + sql);
    }
  };
  pool.poner = (k, v) => { const f = params.find((r) => r[0] === k); if (f) f[1] = v; else params.push([k, v]); };
  return pool;
}

/** Gmail y Drive de mentira: cada correo trae un "PDF" cuyo contenido dice que texto le devuelve Drive. */
function googleFalso(correos, opciones) {
  const o = opciones || {};
  const b64 = (s) => Buffer.from(s).toString('base64url');
  const pedidos = [];
  const f = async (url, op) => {
    pedidos.push({ url, op });
    const resp = (status, j, t) => ({ ok: status < 300, status, json: async () => j, text: async () => (t !== undefined ? t : JSON.stringify(j)) });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return resp(200, { access_token: 'AT', expires_in: 3600 });
    const G = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    if (url.startsWith(G + '?')) {
      if (o.sinPermiso) return resp(403, { error: { message: 'Request had insufficient authentication scopes.' } });
      return resp(200, { messages: correos.slice().reverse().map((c) => ({ id: c.id })) });   // Gmail: el mas nuevo primero
    }
    const mAtt = /messages\/([^/]+)\/attachments\/([^/?]+)/.exec(url);
    if (mAtt) return resp(200, { data: b64('%PDF-' + correos.find((c) => c.id === mAtt[1]).dia) });
    const mMsg = /messages\/([^/?]+)\?format=full/.exec(url);
    if (mMsg) {
      const c = correos.find((x) => x.id === mMsg[1]);
      return resp(200, { id: c.id, payload: { headers: [{ name: 'Subject', value: 'Cierre de Caja ' + c.dia + '/10/2026 22:00' }],
        parts: [{ filename: 'cuerpo.html', body: {} }, { filename: 'cierre.pdf', body: { attachmentId: 'at-' + c.id } }] } });
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      const dia = /%PDF-(\d{2})/.exec(op.body.toString())[1];
      return resp(200, { id: 'DOC' + dia });
    }
    const mExp = /drive\/v3\/files\/DOC(\d{2})\/export/.exec(url);
    if (mExp) return resp(200, null, TXT(mExp[1]));
    if (/drive\/v3\/files\/DOC/.test(url) && op.method === 'DELETE') return resp(204, {}, '');
    return resp(404, {}, 'no esperado ' + url);
  };
  f.pedidos = pedidos;
  return crearCuenta({ credencial: { client_id: 'c', client_secret: 's', refresh_token: 'r' }, fetch: f });
}

async function armar(params, opciones) {
  const o = opciones || {};
  const pool = poolFalso(params, o);
  const pagos = crearServicioPagos(pool, { modo: o.modoMax || 'vivo' });
  await pagos.cargar();
  const app = express();
  app.use(express.json());
  P.montar(app, { pool, pagos, cuenta: o.cuenta === undefined ? googleFalso(o.correos || []) : o.cuenta, claveTareas: CLAVE });
  return { pool, pagos, app };
}
async function pedir(app, cuerpo, clave) {
  const srv = app.listen(0);
  try {
    const r = await fetch('http://127.0.0.1:' + srv.address().port + '/tareas/procesos/cierres', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rosanta-tarea': clave === undefined ? CLAVE : clave }, body: JSON.stringify(cuerpo || {}) });
    return { status: r.status, j: await r.json() };
  } finally { srv.close(); }
}
const PARAM = (proc, cierres) => [['parametro', 'valor'], ['motor_cierres', cierres || 'sheets'], ['proc_cierres', proc]];
const CORREOS = [{ id: 'm12', dia: '12' }, { id: 'm13', dia: '13' }];

test('El interruptor de procesos: apps | sombra | nube; cualquier otra cosa es apps', () => {
  const L = (v) => ({ [CFG]: { PARAMETROS: [['parametro', 'valor'], ['proc_cierres', v]] } });
  assert.strictEqual(P.interruptorProc(L(' Nube '), 'proc_cierres'), 'nube');
  assert.strictEqual(P.interruptorProc(L('sombra'), 'proc_cierres'), 'sombra');
  assert.strictEqual(P.interruptorProc(L('base'), 'proc_cierres'), 'apps');
  assert.strictEqual(P.interruptorProc(L(''), 'proc_cierres'), 'apps');
  assert.strictEqual(P.interruptorProc({}, 'proc_cierres'), 'apps');
});

test('Sin la clave de tareas, 403; con proc_cierres = apps no hace nada (ni toca Gmail)', async () => {
  const cuenta = googleFalso(CORREOS);
  const { app } = await armar(PARAM('apps'), { cuenta });
  assert.strictEqual((await pedir(app, {}, 'otra')).status, 403);
  const r = await pedir(app);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.j.modo, 'apps');
});

test('nube sin motor_cierres = base: 409 con mensaje claro, sin leer nada', async () => {
  const { app, pool } = await armar(PARAM('nube', 'sheets'));
  const r = await pedir(app);
  assert.strictEqual(r.status, 409);
  assert.match(r.j.error, /motor_cierres = base/);
  assert.strictEqual(pool.vivas.size, 0);
  // y con motor_cierres = base pero el servicio sin MODO_PAGOS=vivo, tampoco
  const s = await armar(PARAM('nube', 'base'), { modoMax: 'sombra' });
  assert.strictEqual((await pedir(s.app)).status, 409);
});

test('Gmail sin permiso: error claro (502) que dice que hay que volver a autorizar', async () => {
  const { app } = await armar(PARAM('sombra'), { cuenta: googleFalso(CORREOS, { sinPermiso: true }) });
  const r = await pedir(app);
  assert.strictEqual(r.status, 502);
  assert.match(r.j.error, /Gmail no dejó leer.*403.*volver a autorizar/s);
  const sinCuenta = await armar(PARAM('sombra'), { cuenta: null });
  const r2 = await pedir(sinCuenta.app);
  assert.strictEqual(r2.status, 503);
  assert.match(r2.j.error, /GMAIL_OAUTH/);
});

test('nube: guarda con guardarCierre (base + copia), y leer otra vez o un reenvio del mismo dia NO duplica', async () => {
  const correos = CORREOS.slice();
  const { app, pool } = await armar(PARAM('nube', 'base'), { correos });
  const r = await pedir(app, { dias: 20 });
  assert.strictEqual(r.status, 200, JSON.stringify(r.j));
  assert.deepStrictEqual(r.j.guardados.map((g) => [g.fecha, g.nuevo]), [['2026-10-12', true], ['2026-10-13', true]]);
  assert.deepStrictEqual(Array.from(pool.vivas.keys()).sort(), ['2026-10-12', '2026-10-13']);
  const f13 = pool.vivas.get('2026-10-13').celdas;
  assert.deepStrictEqual(f13[0], { $d: '2026-10-13T00:00:00' }, 'la FECHA como la guarda Sheets');
  assert.strictEqual(f13[1], 3129.5, 'el total del cierre real del 13-oct');
  assert.strictEqual(f13[4], 3129.5, 'todo con tarjeta');
  assert.strictEqual(f13[13], 'SI');
  assert.strictEqual(f13[14], 'm13');
  assert.match(f13[15].$d, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'LEIDO es una fecha valida (fechasMalas)');
  assert.strictEqual(f13[12], '', 'sin copia de reservas ni valor previo, los comensales van vacios');
  assert.match(r.j.comensales, /no hay copia de reservas/);

  // otra vez: los que cuadran se saltan (regla de la intranet), no se convierte ningun PDF
  const r2 = await pedir(app);
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(r2.j.lectura.repetidos, 2);
  assert.strictEqual(r2.j.guardados.length, 0);

  // PosFile reenvia el 13: se lee, pisa el mismo dia y sigue habiendo UNA fila por fecha
  correos.push({ id: 'm13b', dia: '13' });
  const r3 = await pedir(app);
  assert.strictEqual(r3.status, 200, JSON.stringify(r3.j));
  assert.deepStrictEqual(r3.j.guardados, [{ fecha: '2026-10-13', nuevo: false }]);
  assert.strictEqual(pool.vivas.size, 2);
  assert.strictEqual(pool.vivas.get('2026-10-13').celdas[14], 'm13b');
});

test('sombra: igual a la base → 200 y no escribe; una diferencia → 409 con la fecha y la columna', async () => {
  const params = PARAM('nube', 'base');
  const { app, pool, pagos } = await armar(params, { correos: CORREOS });
  assert.strictEqual((await pedir(app)).status, 200);   // la base queda con lo que leeria la intranet
  pool.poner('proc_cierres', 'sombra'); await pagos.cargar();
  const antes = JSON.stringify(Array.from(pool.vivas.entries()));
  const r = await pedir(app);
  assert.strictEqual(r.status, 200, JSON.stringify(r.j));
  assert.deepStrictEqual([r.j.modo, r.j.leidos, r.j.iguales, r.j.distintos.length], ['sombra', 2, 2, 0]);
  assert.strictEqual(JSON.stringify(Array.from(pool.vivas.entries())), antes, 'en sombra no se escribe nada');

  // alguien corrigio la tarjeta del 12 en la hoja (o el lector cambio): la sombra lo marca
  pool.vivas.get('2026-10-12').celdas[4] = 1;
  const d = await pedir(app);
  assert.strictEqual(d.status, 409);
  assert.strictEqual(d.j.iguales, 1);
  assert.deepStrictEqual(d.j.distintos.map((x) => [x.fecha, x.columnas.map((c) => c.columna)]), [['2026-10-12', ['TARJETA']]]);
});

test('sombra con un dia que la base no tiene: 409 "no está en la base"', async () => {
  const { app, pool } = await armar(PARAM('sombra'), { correos: [{ id: 'm13', dia: '13' }] });
  const r = await pedir(app);
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(r.j.distintos, [{ fecha: '2026-10-13', motivo: 'no está en la base (CIERRES_DIARIOS)' }]);
  assert.strictEqual(pool.vivas.size, 0);
});

test('Comensales: la funcion real de la intranet sobre la copia de reservas (sin canceladas)', async () => {
  const reservas = [['fecha', 'personas', 'estado'], [new Date(2026, 9, 13), 4, 'CONFIRMADA'], [new Date(2026, 9, 13), 2, 'CANCELADA'], ['2026-10-13', 3, ''], [new Date(2026, 9, 12), 5, '']];
  const { app, pool } = await armar(PARAM('nube', 'base'), { correos: CORREOS, reservas });
  const r = await pedir(app);
  assert.strictEqual(r.status, 200, JSON.stringify(r.j));
  assert.match(r.j.comensales, /reservas/);
  assert.strictEqual(pool.vivas.get('2026-10-13').celdas[12], 7);
  assert.strictEqual(pool.vivas.get('2026-10-12').celdas[12], 5);
});

// ---- La foto del comprobante (preparada; sigue en SOLO_INTRANET) ----
function fetchClaude(respuesta, status) {
  const pedidos = [];
  const f = async (url, op) => { pedidos.push({ url, op }); return { status: status || 200, json: async () => respuesta } };
  f.pedidos = pedidos;
  return f;
}
const CHEF = { email: 'chef@x', rol: 'chef', modulos: ['pagos'], nombre: 'Jeffry' };
const FOTO = [{ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'AAAA' }];

test('Comprobante: con proc_comprobante = apps no corre (409)', async () => {
  const pool = poolFalso(PARAM('apps')); const pagos = crearServicioPagos(pool, { modo: 'vivo' }); await pagos.cargar();
  await assert.rejects(() => P.leerComprobanteNube({ pagos, apiKey: 'k', fetch: fetchClaude({}) }, CHEF, FOTO), (e) => e.status === 409 && /intranet/.test(e.message));
});

test('Comprobante en la nube: el pedido EXACTO de la intranet a Claude, la foto en Drive (o pendiente) y no escribe nada', async () => {
  const params = PARAM('apps'); params.push(['proc_comprobante', 'nube']);
  const pool = poolFalso(params); const pagos = crearServicioPagos(pool, { modo: 'vivo' }); await pagos.cargar();
  const resp = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ compras: [{ proveedor: 'Mercado', detalle: 'tomate', total: 45, nit: '', factura: '', metodo: 'efectivo' }] }) }] };
  const f = fetchClaude(resp);
  const guardadas = [];
  const r = await P.leerComprobanteNube({ pagos, apiKey: 'k-prueba', fetch: f,
    guardarFoto: async (a) => { guardadas.push(a); return 'https://drive.google.com/file/d/F1/view'; } }, CHEF, FOTO);
  assert.strictEqual(f.pedidos.length, 1);
  const p = f.pedidos[0];
  assert.strictEqual(p.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(p.op.headers['x-api-key'], 'k-prueba');
  assert.strictEqual(p.op.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(p.op.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const body = JSON.parse(p.op.body);
  assert.strictEqual(body.model, 'claude-opus-5', 'CPE_MODELO_ de la intranet');
  assert.strictEqual(body.messages[0].content[0].source.data, 'AAAA');
  assert.strictEqual(body.output_config.format.type, 'json_schema');
  assert.deepStrictEqual(r.compras.map((c) => [c.proveedor, c.total]), [['Mercado', 45]]);
  assert.strictEqual(r.archivo_url, 'https://drive.google.com/file/d/F1/view');
  assert.strictEqual(r.foto, 'guardada');
  assert.strictEqual(guardadas[0].carpeta, 'Comprobantes_compras');
  assert.match(guardadas[0].nombre, /^\d{4}-\d{2}-\d{2}_\d{4}_ticket\.jpg$/);

  // sin quien guarde la foto: la lectura sale igual, con la foto pendiente y sin enlace
  const s = await P.leerComprobanteNube({ pagos, apiKey: 'k', fetch: fetchClaude(resp) }, CHEF, FOTO);
  assert.deepStrictEqual([s.foto, s.archivo_url, s.compras.length], ['pendiente', '', 1]);
  // las validaciones de la intranet siguen mandando (400), y Claude con error → 502
  await assert.rejects(() => P.leerComprobanteNube({ pagos, apiKey: 'k', fetch: fetchClaude(resp) }, CHEF, [{ nombre: 'a.pdf', mime: 'application/pdf', datos: 'x' }]), (e) => e.status === 400 && /JPG o PNG/.test(e.message));
  await assert.rejects(() => P.leerComprobanteNube({ pagos, apiKey: 'k', fetch: fetchClaude({ error: { message: 'overloaded' } }, 529) }, CHEF, FOTO), (e) => e.status === 502 && /529.*overloaded/.test(e.message));
});
