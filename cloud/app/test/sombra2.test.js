// Sombra 2: Caja chica y Compras en efectivo (17-oct-2026) y Clientes parte 1 (18-oct-2026).
// Corre con TZ=America/Guatemala (lo pone sellar-nube.py y Cloud Run). Datos inventados.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/copia-hojas');
const { crearMotor } = require('../src/motor-pagos');
const S = require('../src/sombra2/servicio-f2');
const K = require('../src/sombra2/comparar-f2');
const P = require('../src/sombra2/pantallas-f2');
const { crearAppF2 } = require('../src/sombra2/app-f2');
const U = require('../src/usuarios');
const PER = require('../src/permisos');
const MATRIZ = PER.cargarDeMigracion();
const { libros: librosPagos } = require('./fixtura');

const DIR = path.join(__dirname, '..', 'intranet');
const ORIGEN = path.join(__dirname, '..', '..', '..', 'apps-script', 'rosanta-intranet');
const leerLista = (l) => fs.readFileSync(path.join(DIR, l), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const CFG = C.LIBROS.config.id;
const SALA = { email: 'sala@x', rol: 'sala', modulos: ['pagos'], nombre: 'Maco' };
const DUENO = { email: 'd@x', rol: 'dueno', modulos: ['marketing'], nombre: 'Juanma' };
const MKT_U = { email: 'v@x', rol: 'pauta', modulos: ['marketing'], nombre: 'Vanessa' };
const CHEF = { email: 'c@x', rol: 'chef', modulos: ['recetario'], nombre: 'Jeffry' };

const EV_COLS = (() => { const s = fs.readFileSync(path.join(DIR, 'EventosDatos.js'), 'utf8'); return JSON.parse(s.match(/var EV_COLS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')); })();
const filaEv = (o) => EV_COLS.map((c) => (o[c] !== undefined ? o[c] : ''));

/** Libros de prueba: los de Pagos (con el config real), mas Caja, retiros, cierres y Marketing OS. */
function libros() {
  const L = librosPagos();
  const cfg = L.CFG; delete L.CFG; L[CFG] = cfg;
  cfg.CAJA_CHICA = [['FECHA', 'TIPO', 'CATEGORIA', 'CONCEPTO', 'MONTO', 'REFERENCIA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'],
    ['2026-10-14', 'CONTEO', '', '', 2700, '', 'Maco', new Date(2026, 9, 14, 22), 'c1', ''],
    ['2026-10-15', 'SALIDA', 'limpieza', 'Cloro', 40, '', 'Maco', new Date(2026, 9, 15, 12), 'c2', '']];
  cfg.RETIROS_SOLICITUDES = [['FECHA', 'LUGAR', 'MONTO', 'AREA', 'NOTA', 'ESCRITO POR', 'REGISTRADO', 'ID', 'ESTATUS'],
    ['2026-10-15', 'ATM 095 Agencia Recolección Antigua', 500, 'COCINA', '', 'Jeffry', new Date(2026, 9, 15, 9), 'r1', '']];
  cfg.CIERRES_DIARIOS = [['FECHA', 'GRAN_TOTAL', 'SIN_PROPINA', 'PROPINA', 'TARJETA', 'EFECTIVO', 'TRANSFERENCIA', 'PEDIDOS_YA', 'UBER_EATS', 'CORTESIA', 'TICKETS', 'PRODUCTOS', 'COMENSALES_RESERVA', 'CUADRA'],
    ['2026-10-14', 3000, 2700, 300, 2000, 1000, 0, 0, 0, 0, 10, 30, '', 'SI']];
  L[S.MKT_ID] = {
    cotizaciones: [EV_COLS,
      filaEv({ id: 'a', version: 2, cliente: 'Ana', etapa: 'cotizada', estado: 'cotizada', monto_q: 5000, fecha_evento: '2026-11-20', fecha_consulta: '2026-10-05', historial_json: '[]' }),
      filaEv({ id: 'b', version: 1, cliente: 'Beto', etapa: 'ganada', estado: 'ganada', monto_q: 9000, etapa_desde: '2026-10-10', fecha_consulta: '2026-10-01' })],
    revisiones: [['fecha', 'hora', 'resumen', 'contestaron', 'borradores'], ['2026-10-17', '07:15', 'ok', '0', '0']],
    reservas: [['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'],
      ['w1', '2026-10-10', 'Ana López', 'ana@x.com', '+502 5555 1234', 2, 450, 'SEATED', 'SI'],
      ['w2', '2026-10-20', 'Ana López', 'ana@x.com', '+502 5555 1234', 4, '', 'RESERVED', 'SI'],
      ['w3', '2026-10-12', 'Beto Ruiz', 'beto@x.com', '+1 555 000 9999', 3, '', 'CANCELED', 'NO']],
    carritos: [['id', 'fecha', 'nombre', 'canal', 'valor', 'estado', 'consentimiento', 'contacto'],
      ['k1', '2026-10-15', 'Carla', 'web', 600, 'nuevo', 'SI', '+502 4444 0000']]
  };
  // Marketing (contenido y pauta): encabezados reales de SCHEMA y PS_SCHEMA
  const M0 = S.crearMotores({}).marketing.ctx, vm = require('vm');
  const SC = vm.runInContext('SCHEMA', M0), PS = vm.runInContext('PS_SCHEMA', M0);
  ['calendario', 'piezas', 'pauta_semanal', 'aprendizajes', 'propuestas', 'briefs'].forEach((t) => { L[S.MKT_ID][t] = [SC[t].slice()]; });
  Object.keys(PS).forEach((t) => { L[S.MKT_ID][t] = [PS[t].slice()]; });
  L[S.MKT_ID].calendario.push(['cal-1', '2026-10-20', 'La fogata', 'VALOR', 'Ambientes', 'Idea', 'Instagram', '', '', '', 'See', '', '', '', '', '']);
  L[S.MKT_ID].reglas.push(['reservas_min_escalar', 6, 'volumen minimo', 'sistema', '2026-10-01']);
  L[S.MKT_ID].bitacora_pruebas.push(['b1', '2026-10-10', 'Juanma', 'h', 'c', 'x', 'conj', 'reservas', '', '', '', '', '', '', '', '', 'propuesta']);
  L[CFG].PARAMETROS = [['Parámetro', 'Valor']]; L[CFG].METAS = [['mes']];
  L[S.CRM_ID] = { Contactos: [['first_name', 'telefono', 'email', 'segmento', 'idioma', 'fuente', 'ultima_reserva', 'gasto_gtq'],
    ['Ana', '+502 5555 1234', 'ana@x.com', 'Cliente que visitó', 'ES', 'wix', '2026-10-10', 450],
    ['Beto', '+1 555 000 9999', 'beto@x.com', 'Reserva histórica', 'EN', 'wix', '', 0]] };
  L[S.LEADS_ID] = {
    Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto'],
      ['2026-10-09 18:00', 'whatsapp', '50255551234', 'Ana', 'entrante', 'cliente', 'Hola, quiero una mesa']],
    Fichas: [['canal', 'contacto_id', 'nombre', 'telefono', 'email', 'tipo'], ['whatsapp', '50255551234', 'Ana', '+502 5555 1234', '', 'reserva']],
    Leads: [['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo']]
  };
  return L;
}

test('Sombra 2: los archivos son copias exactas de la intranet', () => {
  const lista = ['LISTA-CAJA.txt', 'LISTA-CLIENTES.txt', 'LISTA-MARKETING.txt', 'LISTA-VISTAS-F2.txt'].flatMap(leerLista);
  ['CajaChica.js', 'ComprasEfectivo.js', 'EventosDatos.js', 'EventosVista.html', 'CrmDatos.js', 'CrmVista.html', 'PautaSistema.js', 'Marketing.html'].forEach((f) => assert.ok(lista.includes(f), f));
  const distintos = lista.filter((f) => fs.readFileSync(path.join(DIR, f), 'utf8') !== fs.readFileSync(path.join(ORIGEN, f), 'utf8'));
  assert.deepStrictEqual(distintos, [], 'correr cloud/herramientas/traer-intranet.sh');
});

test('Caja chica corre con el codigo real y sin escribir nada', () => {
  const M = S.crearMotores(libros());
  const r = M.caja.correr(SALA, 'getCajaChica', []);
  assert.deepStrictEqual(r.escrituras, {}, 'leer la caja no escribe');
  const d14 = r.resultado.dias.find((d) => d.fecha === '2026-10-14');
  // arranque 13-oct Q2,676 + efectivo del cierre Q1,000 = Q3,676 esperado; contado Q2,700
  assert.strictEqual(d14.esperado, 3676);
  assert.strictEqual(d14.contado, 2700);
  assert.strictEqual(d14.estado, 'Faltante');
  assert.ok(r.resultado.maestro && r.resultado.maestro.escrito === false, '07_Caja_Chica no se reescribe');
  assert.strictEqual(r.resultado.lectura_ahora, undefined, 'no intenta leer Gmail');
  assert.throws(() => M.caja.correr({ email: 'c', rol: 'chef', modulos: ['pagos'], nombre: 'Jeffry' }, 'getCajaChica', []), /la lleva Maco/);
});

test('Control negativo: sin anular, Caja chica intentaria escribir el maestro', () => {
  const M = crearMotor({ libros: libros(), configId: CFG, editables: {}, listas: S.MODULOS.caja.listas });
  M.ctx._cchLeerSiFaltan_ = () => null;   // solo Gmail anulado: la escritura del maestro queda viva
  const r = M.correr(SALA, 'getCajaChica', []).resultado;
  assert.match(r.aviso_maestro, /No pude escribir 07_Caja_Chica/, 'el codigo real si intenta escribir al leer');
});

test('Compras en efectivo corre con el codigo real', () => {
  const M = S.crearMotores(libros());
  const r = M.caja.correr(DUENO, 'getComprasEfectivo', []).resultado;
  assert.ok(r.resumen && typeof r.resumen.por_justificar === 'number');
  assert.strictEqual(r.solicitudes.length, 1);
});

test('Clientes corre con el codigo real: eventos, CRM, ficha, reservas y carritos', () => {
  const M = S.crearMotores(libros());
  const ev = M.clientes.correr(DUENO, 'getEventos', []).resultado;
  assert.deepStrictEqual(ev.filas.map((f) => f.id), ['a', 'b']);
  assert.strictEqual(M.clientes.correr(DUENO, 'getInformeEventos', [2026, 10]).resultado.actual.ganadas.n, 1);
  const cs = M.clientes.correr(DUENO, 'crmContactos', []).resultado;
  assert.deepStrictEqual(cs.map((c) => c.nombre), ['Ana', 'Beto']);
  assert.deepStrictEqual(M.clientes.correr(DUENO, 'crmClavesConChat', []).resultado, ['55551234']);
  const fi = M.clientes.correr(DUENO, 'crmFicha', ['+502 5555 1234', 'ana@x.com']).resultado;
  assert.strictEqual(fi.reservas.length, 2, 'sus dos reservas');
  assert.strictEqual(fi.totales.visitas, 1);
  assert.strictEqual(fi.chats.length, 1, 'su chat con el bot');
  assert.strictEqual(fi.bot && fi.bot.tipo, 'reserva', 'lo que ya sabe el bot (Fichas)');
  assert.deepStrictEqual(fi.avisos, []);
  const rs = M.clientes.correr(CHEF, 'clientesReservas', []).resultado;
  assert.deepStrictEqual(rs.map((r) => r.id), ['w2', 'w3', 'w1'], 'mas nuevas primero');
  assert.strictEqual(M.clientes.correr(MKT_U, 'clientesCarritos', []).resultado[0].valor, 600);
  assert.throws(() => M.clientes.correr(DUENO, 'guardarEventos', [[{ op: 'update', id: 'a', data: { notas: 'x' }, if_version: 2 }]]), /solo lectura/,
    'aun saltando el 409, la hoja es de solo lectura');
});

test('Clientes: la matriz de accesos de la base decide quien ve que (no los modulos de USUARIOS)', () => {
  const f2 = S.crearServicioF2({ query: async () => ({ rows: [] }) }, { permisos: MATRIZ });
  assert.deepStrictEqual(f2.partes(DUENO), ['eventos', 'crm', 'reservas', 'carritos', 'consola', 'resenas'], 'el dueño ve tambien Bot y Reseñas (solo el dueño, 020)');
  assert.deepStrictEqual(f2.partes(SALA), ['eventos', 'crm', 'reservas'], 'sala: sin carritos');
  assert.deepStrictEqual(f2.partes(MKT_U), ['crm', 'reservas', 'carritos'], 'pauta: no ve el pipeline');
  assert.deepStrictEqual(f2.partes(CHEF), ['reservas'], 'cocina: solo reservas');
  // la guarda va ANTES de todo: sin copia cargada, el que no puede igual recibe 403 (no 503)
  assert.throws(() => f2.llamar(MKT_U, 'getEventos', []), (e) => e.status === 403);
  assert.throws(() => f2.llamar(CHEF, 'crmContactos', []), (e) => e.status === 403);
  assert.throws(() => f2.llamar(SALA, 'clientesCarritos', []), (e) => e.status === 403);
  assert.throws(() => f2.llamar(SALA, 'guardarEventos', []), (e) => e.status === 409, 'sala si ingresa eventos, pero en sombra es 409');
  // control negativo: un pauta con el modulo "marketing" en USUARIOS igual no ve el pipeline
  assert.ok(MKT_U.modulos.includes('marketing'));
});

test('Marketing corre con el codigo real (token al final) y la matriz decide: dueño y pauta si, sala y cocina no', () => {
  const M = S.crearMotores(libros());
  const cal = S.correrUltimo(M.marketing, MKT_U, 'mktRead', ['calendario']).resultado;
  assert.deepStrictEqual(cal.map((c) => c.title), ['La fogata']);
  const t = S.correrUltimo(M.marketing, MKT_U, 'psTablero', []).resultado;
  assert.ok(t.semana && t.hoy, 'el tablero de pauta se arma');
  assert.ok(Array.isArray(S.correrUltimo(M.marketing, DUENO, 'psContextoCreativo', []).resultado.medir));
  // aun saltando el 409, el motor no puede escribir (no hay pestañas editables ni appendRow)
  assert.throws(() => S.correrUltimo(M.marketing, DUENO, 'mktUpsert', ['calendario', { id: 'x', title: 'y' }]), /solo lectura|no crea|appendRow/);
  const f2 = S.crearServicioF2({ query: async () => ({ rows: [] }) }, { permisos: MATRIZ });
  assert.ok(f2.puede(DUENO, 'pauta') && f2.puede(MKT_U, 'pauta'));
  assert.ok(!f2.puede(SALA, 'pauta') && !f2.puede(CHEF, 'pauta'));
  assert.throws(() => f2.llamar(SALA, 'mktRead', ['calendario']), (e) => e.status === 403);
  ['mktUpsert', 'psGuardarPrueba', 'metaEntities', 'askClaudeSrv', 'driveDescargar', 'getLecturaPauta'].forEach((n) =>
    assert.throws(() => f2.llamar(MKT_U, n, []), (e) => e.status === 409, n));
});

test('Cada llamada srv() de Marketing esta clasificada (y su lista blanca no tiene nada suelto)', () => {
  const html = fs.readFileSync(path.join(DIR, 'Marketing.html'), 'utf8');
  const blanca = JSON.parse(html.match(/const SRV_PERMITIDAS=new Set\((\[[\s\S]*?\])\)/)[1].replace(/'/g, '"'));
  assert.ok(blanca.length >= 15, 'leyo la lista blanca (' + blanca.length + ')');
  const sueltas = blanca.filter((n) => S.moduloDe(n) !== 'marketing');
  assert.deepStrictEqual(sueltas, [], 'una funcion nueva en SRV_PERMITIDAS: decidir si es lectura o escritura');
});

test('En sombra todo lo que escribe responde 409, y Pagos no se puede llamar desde aca', async () => {
  const f2 = S.crearServicioF2({ query: async () => ({ rows: [] }) }, { permisos: MATRIZ });
  S.MODULOS.caja.escritura.concat(S.MODULOS.clientes.escritura, S.MODULOS.marketing.escritura).forEach((n) => {
    assert.throws(() => f2.llamar(DUENO, n, []), (e) => e.status === 409, n);
  });
  assert.throws(() => f2.llamar(DUENO, 'getPagosProveedores', []), (e) => e.status === 404);
  assert.throws(() => f2.llamar(DUENO, 'registrarPagoFacturas', []), (e) => e.status === 404);
});

test('Cada llamada de las pantallas esta clasificada como lectura o escritura', () => {
  const llamadas = ['ProfitCajaJs.html', 'ProfitComprasJs.html', 'EventosVista.html', 'CrmVista.html'].flatMap((f) =>
    Array.from(fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/\.([A-Za-z_]\w*)\(AUTH\b/g)).map((m) => m[1]));
  assert.ok(llamadas.length >= 20, 'encontro las llamadas (' + llamadas.length + ')');
  const sueltas = llamadas.filter((n) => !S.moduloDe(n));
  assert.deepStrictEqual(sueltas, [], 'una funcion nueva de la pantalla: decidir si es lectura o escritura');
});

test('La comparacion da 0 diferencias con los mismos datos y avisa una diferencia sembrada', () => {
  const iguales = K.compararResumenes(K.armar(libros()), K.armar(libros()));
  assert.deepStrictEqual(iguales, []);
  const otra = libros();
  otra[CFG].CAJA_CHICA[1][4] = 2600;                     // otro conteo el 14-oct
  otra[S.MKT_ID].cotizaciones[1][EV_COLS.indexOf('monto_q')] = 5100;   // otro monto en el pipeline
  const d = K.compararResumenes(K.armar(otra), K.armar(libros()));
  assert.ok(d.some((x) => /caja día 2026-10-14 contado: copia 2600 · hojas 2700/.test(x)), d.join('\n'));
  assert.ok(d.some((x) => /eventos por_etapa cotizada q: copia 5100 · hojas 5000/.test(x)), d.join('\n'));
  const otra2 = libros();
  otra2[S.MKT_ID].reservas[2][7] = 'NO_SHOW';            // una reserva con otro estado
  otra2[S.CRM_ID].Contactos.pop();                       // un contacto menos
  const d2 = K.compararResumenes(K.armar(otra2), K.armar(libros()));
  assert.ok(d2.some((x) => /^reservas por_estado/.test(x)), d2.join('\n'));
  assert.ok(d2.some((x) => /crm contactos: copia 1 · hojas 2/.test(x)), d2.join('\n'));
  const otra3 = libros(); otra3[S.MKT_ID].calendario[1][5] = 'Lista';   // la pieza cambio de estado
  const d3 = K.compararResumenes(K.armar(otra3), K.armar(libros()));
  assert.ok(d3.some((x) => /^marketing calendario_por_estado/.test(x)), d3.join('\n'));
  const sinMkt = libros(); delete sinMkt[S.MKT_ID];
  assert.ok(K.compararResumenes(K.armar(sinMkt), K.armar(libros())).some((x) => /eventos: no se pudo armar con la copia/.test(x)),
    'las hojas tienen Marketing OS y la copia no: eso SI es diferencia');
  const avisos = [];
  assert.deepStrictEqual(K.compararResumenes(K.armar(sinMkt), K.armar(sinMkt), avisos), [], 'sin Marketing OS de los dos lados no es diferencia');
  assert.deepStrictEqual(avisos, ['eventos: Sin copia de Marketing OS', 'reservas: Sin copia de Marketing OS', 'carritos: Sin copia de Marketing OS', 'marketing: Sin copia de Marketing OS']);
});

test('Las pantallas se arman con el codigo real y sin scriptlets', () => {
  const caja = P.armarCaja(), compras = P.armarCompras();
  const ev = P.armarEventos({ usuario: SALA, authToken: 'tok-maco-12345' }), crm = P.armarCrm({ usuario: DUENO, authToken: 'tok-juanma-123' });
  assert.match(caja, /PF_CAJA\(document\.getElementById\("pf-host"\)/);
  assert.match(compras, /PF_COMPRAS\(document\.getElementById\("pf-host"\)/);
  [caja, compras, ev, crm, P.armarReservas(), P.armarCarritos()].forEach((h) => {
    assert.ok(!h.includes('<?'), 'sin scriptlets de Apps Script');
    assert.match(h, /\/api\/llamar\//, 'llama al servidor nuevo');
    assert.match(h, /Prueba en sombra/);
  });
  [ev, crm, P.armarReservas()].forEach((h) => assert.match(h, /\/api\/clientes\/partes/, 'lleva la barra de Clientes'));
  assert.match(ev, /← Panel principal/, 'la plantilla real: sala ve el enlace al panel (@212)');
  assert.ok(!P.armarEventos({ usuario: DUENO, authToken: 'tok-juanma-123' }).includes('← Panel principal'), 'el dueño no');
  assert.match(crm, /btnExportar/, 'exportar: solo el dueño');
  assert.ok(!P.armarCrm({ usuario: SALA, authToken: 'tok-maco-12345' }).includes('id="btnExportar"'), 'sala no exporta');
  assert.strictEqual(P.tokenLimpio('a"><script>'), '', 'un token raro no se pega en la pagina');
});

test('Plantilla: igual que HtmlService (<?= ?> escapa, <?!= ?> no, <? ?> es codigo)', () => {
  assert.strictEqual(P.plantilla('<? if (x) { ?>A<?= y ?><? } ?>|<?!= y ?>', { x: true, y: '<b>' }), 'A&lt;b&gt;|<b>');
  assert.strictEqual(P.plantilla('<? if (x) { ?>A<? } ?>', { x: false }), '');
});

// ---- La app web ----
function poolFalso(usuarios, fotos) {
  return { query: async (sql, p) => {
    if (/^SELECT 1/.test(sql)) return { rows: [{}] };
    if (/FROM usuarios WHERE token_huella/.test(sql)) return { rows: usuarios.filter((u) => u.token_huella === p[0]) };
    if (/FROM caja_fotos/.test(sql)) return { rows: fotos || [] };
    if (/^INSERT INTO tiempos/.test(sql)) return { rows: [] };
    throw new Error('consulta no esperada: ' + sql);
  } };
}
async function servir(deps, fn) {
  const srv = crearAppF2(deps).listen(0);
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}
const HOJA = [['correo', 'rol', 'modulos', 'edita', 'nombre', 'token'],
  ['sala@x', 'sala', 'pagos', 'SI', 'Maco', 'tok-maco'], ['d@x', 'Dueño', 'marketing', 'SI', 'Juanma', 'tok-juanma']];

test('La app de la sombra 2: enlace, 409 al escribir, tareas con clave y fotos solo del dueño', async () => {
  const pool = poolFalso(U.usuariosDeFilas(HOJA));
  const M = S.crearMotores(libros());
  const f2 = {
    estado: () => ({ modo: 'sombra' }),
    refrescar: async () => [],
    partes: (u) => S.partesVisibles(MATRIZ, u),
    puede: (u, p) => PER.puede(MATRIZ, u, p, 'ver').ok,
    llamar: (u, n, a) => {
      if (S.MODULOS.caja.escritura.includes(n)) { const e = new Error('Prueba en sombra'); e.status = 409; throw e; }
      return { resultado: M[S.moduloDe(n)].correr(u, n, a).resultado, ms: 1 };
    }
  };
  const deps = { pool, f2, comparar: async () => ({ copia_al_dia: false, diferencias: ['x'], celdas_error: {} }), claveTareas: 'clave-x',
    pantallas: { caja: P.armarCaja, compras: P.armarCompras, eventos: P.armarEventos, crm: P.armarCrm, marketing: P.armarMarketing, fotos: P.armarFotos, reservas: P.armarReservas, carritos: P.armarCarritos } };
  await servir(deps, async (b) => {
    const llamar = (n, tok, args) => fetch(b + '/api/llamar/' + n, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rosanta-u': tok || '' }, body: JSON.stringify(args || []) });
    assert.strictEqual((await llamar('getCajaChica', '')).status, 401);
    const r = await llamar('getCajaChica', 'tok-maco'); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.ok(j.resultado.dias.length > 0);
    assert.strictEqual((await llamar('registrarConteoCaja', 'tok-maco', ['2026-10-16', 100])).status, 409);
    assert.strictEqual((await fetch(b + '/tareas/comparar', { method: 'POST' })).status, 403, 'sin clave no corre la tarea');
    assert.strictEqual((await fetch(b + '/tareas/comparar', { method: 'POST', headers: { 'x-rosanta-tarea': 'clave-x' } })).status, 409, 'diferencia = 409 (alerta)');
    assert.strictEqual((await fetch(b + '/api/fotos-f2', { headers: { 'x-rosanta-u': 'tok-maco' } })).status, 403);
    assert.strictEqual((await fetch(b + '/api/fotos-f2', { headers: { 'x-rosanta-u': 'tok-juanma' } })).status, 200);
    for (const p of ['/caja', '/compras', '/clientes/reservas', '/clientes/carritos', '/sombra2/fotos']) assert.strictEqual((await fetch(b + p)).status, 200, p);
    assert.strictEqual((await fetch(b + '/clientes/eventos')).status, 401, 'eventos y CRM se arman para quien entra');
    assert.strictEqual((await fetch(b + '/clientes/crm?u=tok-juanma')).status, 200);
    assert.strictEqual((await fetch(b + '/clientes/eventos?u=tok-maco')).status, 200, 'sala ve eventos');
    const red = await fetch(b + '/clientes?u=tok-maco', { redirect: 'manual' });
    assert.strictEqual(red.status, 302); assert.match(red.headers.get('location'), /^\/clientes\/eventos\?u=tok-maco$/);
    const pa = await (await fetch(b + '/api/clientes/partes', { headers: { 'x-rosanta-u': 'tok-maco' } })).json();
    assert.deepStrictEqual(pa.partes, ['eventos', 'crm', 'reservas']);
    assert.strictEqual((await fetch(b + '/marketing?u=tok-juanma')).status, 200, 'dueño ve Marketing');
    assert.strictEqual((await fetch(b + '/marketing?u=tok-maco')).status, 403, 'sala no');
  });
});

test('La copia se salta las pestañas que la intranet todavia no creo (como las trata la intranet: vacias)', async () => {
  const sheets = { spreadsheets: { get: async ({ spreadsheetId }) => ({ data: { sheets: (spreadsheetId === CFG
    ? ['PAGOS_PROVEEDORES', 'FEL_CORREO', 'BANCO_CORREO', 'CAJA_CHICA', 'CIERRES_DIARIOS'] : ['01_FEL_Maestro']).map((t) => ({ properties: { title: t } })) } }) } };
  const L = await S.soloExistentes(sheets, S.LIBROS_CAJA);
  assert.ok(!L.config.pestanas.includes('RETIROS_SOLICITUDES'), 'la que no existe no se pide');
  assert.ok(L.config.pestanas.includes('CAJA_CHICA') && L.config.pestanas.includes('PAGOS_PROVEEDORES'));
  assert.strictEqual(L.compras.pestanas, '*', 'COMPRAS_2026 sigue entera');
  const sinRetiros = libros(); delete sinRetiros[CFG].RETIROS_SOLICITUDES;
  const r = S.crearMotores(sinRetiros).caja.correr(DUENO, 'getComprasEfectivo', []).resultado;
  assert.strictEqual(r.solicitudes.length, 0, 'Compras sin la pestaña = sin solicitudes, no un error');
});

test('Copia: un libro sin compartir es aviso; si ya se habia leido y deja de leerse, es falla', async () => {
  const filasDe = (L) => { const r = []; Object.keys(L).forEach((id) => Object.keys(L[id]).forEach((p) => r.push({ libro: id, pestana: p, filas: C.codificar(L[id][p]), leida: new Date() }))); return r; };
  let guardado = libros(); delete guardado[S.MKT_ID]; delete guardado[S.LEADS_ID];
  const pool = { query: async (sql) => { if (/^SELECT libro/.test(sql)) return { rows: filasDe(guardado) }; return { rows: [] }; },
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
  const negar = new Set([S.MKT_ID, S.LEADS_ID]);   // CRM si se lee
  const sheets = { spreadsheets: { get: async (q) => {
    if (negar.has(q.spreadsheetId)) throw new Error('The caller does not have permission');
    if (q.fields === 'sheets.properties.title') return { data: { sheets: [] } };
    return { data: { sheets: [] } };
  } } };
  const f2 = S.crearServicioF2(pool, { permisos: MATRIZ });
  await f2.cargar();
  const r = await f2.refrescar(sheets);
  assert.match(r.aviso, /sin leer todavia \(no compartido\): marketing: The caller does not have permission · leads: /);
  guardado = libros();            // ahora la copia SI tenia Marketing OS y Leads
  await f2.cargar();
  await assert.rejects(() => f2.refrescar(sheets), /dejaron de leerse: marketing: .* · leads: /);
});

test('Todo el JavaScript de las pantallas de la sombra 2 compila (y un error se detecta)', () => {
  const paginas = { caja: P.armarCaja(), compras: P.armarCompras(), fotos: P.armarFotos(), reservas: P.armarReservas(), carritos: P.armarCarritos(),
    eventos: P.armarEventos({ usuario: SALA, authToken: 'tok-maco-12345' }), crm: P.armarCrm({ usuario: DUENO, authToken: 'tok-juanma-123' }),
    marketing: P.armarMarketing({ usuario: MKT_U, authToken: 'tok-vanessa-12' }) };
  const scripts = (h) => [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let n = 0;
  Object.keys(paginas).forEach((k) => scripts(paginas[k]).forEach((js, i) => { n++; assert.doesNotThrow(() => new Function(js), k + ' script ' + i); }));   // eslint-disable-line no-new-func
  assert.ok(n >= 18, 'reviso ' + n + ' scripts');
  assert.match(paginas.marketing, /arguments, 0, -1\)/, 'Marketing manda el token al final: su traductor saca el ultimo');
  assert.throws(() => new Function(scripts('<script>var a = ;</script>')[0]), SyntaxError, 'control negativo');   // eslint-disable-line no-new-func
});
