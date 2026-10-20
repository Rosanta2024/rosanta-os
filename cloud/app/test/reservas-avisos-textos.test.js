/**
 * Avisos de reservas · lo que no necesita base: las plantillas EN/ES (ninguna variable sin reemplazar, y si falta un
 * dato el aviso no sale), las 3 de WhatsApp, el .ics, las reglas de recordatorios y reseñas, los adaptadores
 * (Resend, sombra, Meta) con un fetch falso y la firma del webhook. Nada sale a la red.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const T = require('../src/reservas-avisos/textos');
const F = require('../src/reservas-avisos/formato');
const AV = require('../src/reservas-avisos/avisos');
const AD = require('../src/reservas-avisos/adaptadores');
const { armarIcs } = require('../src/reservas-avisos/ics');
const C = require('../src/reservas/comun');
const { crearBase, sentencias } = require('./reservas-base');

const P = T.cargar();
const LLENOS = {
  nombre: 'Mara', nombre_completo: 'Mara Inventada', fecha: 'Thursday, November 5', fecha_corta: 'Nov 5', hora: '7:00 pm', personas: '2 guests',
  enlace: 'https://www.rosanta.rest/r/abc.def', enlace_reservar: 'https://www.rosanta.rest/reservas', antes: 'Wednesday, November 4 at 7:00 pm, 2 guests',
  ahora: 'Thursday, November 5 at 7:00 pm, 2 guests', motivo: 'Evento privado', sitio_resena: 'Google', enlace_resena: 'https://g.page/r/x/review',
  origen: 'la web', estado: 'confirmada', mesa: 'Pergola3', telefono: '+50255554001', correo: 'mara@ejemplo.test', idioma_cliente: 'inglés',
  alergias: 'Maní', notas: 'Cumpleaños', enlace_panel: 'https://nube.ejemplo.test/reservas/panel?fecha=2026-11-05', quien_cancela: 'la canceló el cliente', canal: 'whatsapp'
};
const sinRestos = (s, donde) => {
  assert.ok(!/[{}]/.test(s), donde + ': quedo una llave: ' + s.match(/.{0,30}[{}].{0,30}/));
  assert.ok(!/\$\{|\[si |\[no |\[boton |undefined|null/.test(s), donde + ': quedo algo sin llenar');
};

test('plantillas: los 9 avisos al cliente en inglés y en español, sin variables sin reemplazar', () => {
  for (const idi of ['en', 'es']) {
    for (const k of T.DEL_CLIENTE) {
      const m = T.armarCorreo(P, k, idi, LLENOS);
      assert.deepStrictEqual(m.faltan, [], k + '.' + idi);
      assert.strictEqual(m.idioma, idi);
      sinRestos(m.asunto, k + '.' + idi + ' asunto');
      sinRestos(m.texto, k + '.' + idi + ' texto');
      sinRestos(m.html, k + '.' + idi + ' html');
      assert.match(m.texto, /Rosanta\nAntigua Guatemala$/, 'firma');
      assert.ok(!/anticipo|deposit|pago|payment|tarjeta|card/i.test(m.texto), k + '.' + idi + ': no se mencionan pagos');
    }
  }
  // la politica en la confirmacion y los recordatorios
  assert.match(T.armarCorreo(P, 'confirmacion', 'en', LLENOS).texto, /at least 24 hours ahead[\s\S]*20 minutes/);
  assert.match(T.armarCorreo(P, 'confirmacion', 'es', LLENOS).texto, /24 horas de anticipación[\s\S]*20 minutos/);
  assert.match(T.armarCorreo(P, 'recordatorio_dia', 'es', LLENOS).texto, /20 minutos/);
  // el boton del correo lleva el enlace "Mi reserva"
  assert.match(T.armarCorreo(P, 'confirmacion', 'en', LLENOS).html, /href="https:\/\/www\.rosanta\.rest\/r\/abc\.def"/);
});

test('plantillas del equipo (solo español): reserva nueva, cancelada y grupo grande; nada de ${guestFirstName}', () => {
  for (const k of T.DEL_EQUIPO) {
    const m = T.armarCorreo(P, k, 'en', LLENOS);
    assert.strictEqual(m.idioma, 'es');
    assert.deepStrictEqual(m.faltan, []);
    sinRestos(m.asunto + m.texto, k);
    assert.ok(!/Rosanta\nAntigua Guatemala$/.test(m.texto), 'sin firma de cliente');
  }
  const n = T.armarCorreo(P, 'equipo_nueva', 'es', LLENOS);
  assert.match(n.asunto, /^Reserva nueva · Mara Inventada · Nov 5 7:00 pm · 2 guests$/);
  assert.match(n.texto, /ALERGIAS: Maní/);
  // sin los datos opcionales, esas lineas no salen (y el aviso igual sale)
  const corto = T.armarCorreo(P, 'equipo_nueva', 'es', Object.assign({}, LLENOS, { alergias: '', mesa: '', notas: '', enlace_panel: '' }));
  assert.deepStrictEqual(corto.faltan, []);
  assert.ok(!/ALERGIAS|Mesa:|Notas:|panel/.test(corto.texto));
});

test('si falta un dato, el aviso no sale (faltan) y nunca queda un hueco en el texto', () => {
  const sinEnlace = T.armarCorreo(P, 'confirmacion', 'en', Object.assign({}, LLENOS, { enlace: '' }));
  assert.deepStrictEqual(sinEnlace.faltan, ['enlace']);
  const sinFecha = T.armarCorreo(P, 'recordatorio_24h', 'es', Object.assign({}, LLENOS, { fecha: undefined, hora: null }));
  assert.deepStrictEqual(sinFecha.faltan.sort(), ['fecha', 'hora']);
  const sinResena = T.armarCorreo(P, 'resena', 'en', Object.assign({}, LLENOS, { enlace_resena: '' }));
  assert.deepStrictEqual(sinResena.faltan, ['enlace_resena']);
  // sin nombre no falta nada: saluda sin nombre
  const sinNombre = T.armarCorreo(P, 'confirmacion', 'es', Object.assign({}, LLENOS, { nombre: '' }));
  assert.deepStrictEqual(sinNombre.faltan, []);
  assert.match(sinNombre.texto, /^Hola,\n/);
  assert.match(T.armarCorreo(P, 'confirmacion', 'en', LLENOS).texto, /^Hi Mara,\n/);
});

test('el archivo de textos rechaza ${...}, {{...}} y datos que no existen', () => {
  assert.throws(() => T.leerArchivo('## x\nAsunto: Hola\n\nHola ${guestFirstName}'), /\$\{/);
  assert.throws(() => T.leerArchivo('## x\nAsunto: Hola\n\nHola {guestFirstName}'), /no existe/);
  assert.throws(() => T.leerArchivo('## x\nAsunto: Hola\n\n[si cosa] Hola'), /no es un dato/);
  assert.throws(() => T.leerArchivo('## x\n\nHola'), /Asunto/);
  assert.throws(() => T.leerArchivo('## whatsapp.x\nMeta: rosanta_x\nParametros: nombre\n\nHola {{1}} {{2}}'), /no cuadran/);
  // una carpeta con un idioma incompleto no carga
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avisos-'));
  fs.writeFileSync(path.join(dir, 'plantillas.en.md'), fs.readFileSync(path.join(T.DIR, 'plantillas.en.md'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'plantillas.es.md'), fs.readFileSync(path.join(T.DIR, 'plantillas.es.md'), 'utf8').replace('## resena', '## resena_vieja'));
  assert.throws(() => T.cargar(dir), /falta el aviso resena/);
});

test('WhatsApp: las 3 plantillas de utilidad para Meta, en los dos idiomas, con el boton "Mi reserva"', () => {
  for (const idi of ['en', 'es']) {
    for (const k of T.DE_WHATSAPP) {
      const pl = P[idi]['whatsapp.' + k];
      assert.match(pl.meta, /^rosanta_reserva_/);
      assert.strictEqual(pl.categoria, 'Utility');
      assert.ok(pl.boton);
    }
    const w = T.armarWhatsapp(P, 'recordatorio_dia', idi, { nombre: 'Mara', fecha: 'x', hora: '19:00', personas: '2' }, 'codigo.firmado');
    assert.deepStrictEqual([w.nombre_meta, w.parametros, w.boton_sufijo, w.faltan], ['rosanta_reserva_recordatorio', ['Mara', 'x', '19:00', '2'], 'codigo.firmado', []]);
    assert.ok(!/\{\{/.test(w.texto));
    assert.deepStrictEqual(T.armarWhatsapp(P, 'cambio', idi, { nombre: 'Mara' }, '').faltan, ['ahora', 'enlace']);
  }
  assert.strictEqual(P.en['whatsapp.recordatorio'].meta, P.es['whatsapp.recordatorio'].meta);
});

test('.ics: UID fijo por reserva, hora UTC, lineas de 75 octetos y CANCEL para la cancelacion', () => {
  const r = { id: 'res-1', inicio: '2026-11-05T01:00:00.000Z', duracion_min: 120, personas: 4 };
  const a = armarIcs(r, { idioma: 'es', enlace: 'https://www.rosanta.rest/r/' + 'x'.repeat(90), secuencia: 2, ahora: Date.UTC(2026, 10, 1) });
  assert.match(a, /UID:reserva-res-1@rosanta\.rest/);
  assert.match(a, /DTSTART:20261105T010000Z\r\nDTEND:20261105T030000Z/);
  assert.match(a, /SUMMARY:Rosanta · mesa para 4 personas/);
  assert.match(a, /SEQUENCE:2/);
  a.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l) <= 75, 'linea larga: ' + l));
  assert.match(armarIcs(r, { cancelada: true }), /METHOD:CANCEL[\s\S]*STATUS:CANCELLED/);
});

test('reglas: recordatorios (24 h y el mismo dia a las 12:00), hora de la reseña y Google o TripAdvisor', () => {
  const ini = C.instante('2026-11-05', '20:00');
  const r = { estado: 'confirmada', inicio: ini.toISOString(), creada: C.instante('2026-11-01', '10:00').toISOString() };
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-04', '19:00')), []);           // faltan 25 h
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-04', '20:30')), ['recordatorio_24h']);
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-05', '11:59')), []);           // ni 24 h (faltan 8) ni las 12:00
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-05', '12:15')), ['recordatorio_dia']);
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-05', '19:30')), []);           // falta menos de 1 h
  assert.deepStrictEqual(AV.recordatoriosQueTocan(Object.assign({}, r, { estado: 'cancelada' }), C.instante('2026-11-05', '12:15')), []);
  // reservada el mismo dia despues de las 12:00, o con menos de 24 h: no hace falta recordarle
  assert.deepStrictEqual(AV.recordatoriosQueTocan(Object.assign({}, r, { creada: C.instante('2026-11-05', '12:05').toISOString() }), C.instante('2026-11-05', '12:15')), []);
  assert.deepStrictEqual(AV.recordatoriosQueTocan(Object.assign({}, r, { creada: C.instante('2026-11-04', '21:00').toISOString() }), C.instante('2026-11-04', '21:30')), []);
  assert.deepStrictEqual(AV.recordatoriosQueTocan(r, C.instante('2026-11-05', '12:15'), Object.assign({}, AV.AJUSTES, { recordatorio_dia: false })), []);

  assert.strictEqual(C.horaGt(AV.horaResena(C.instante('2026-11-05', '15:00'))), '18:00');
  const noche = AV.horaResena(C.instante('2026-11-05', '20:00'));       // 23:00 → a la mañana siguiente
  assert.deepStrictEqual([C.diaGt(noche), C.horaGt(noche)], ['2026-11-06', '10:00']);
  const madrugada = AV.horaResena(C.instante('2026-11-05', '23:30'));   // 02:30 → esa misma mañana
  assert.deepStrictEqual([C.diaGt(madrugada), C.horaGt(madrugada)], ['2026-11-06', '10:00']);

  assert.strictEqual(AV.sitioResena({ telefono: '+50255554001' }), 'google');
  assert.strictEqual(AV.sitioResena({ telefono: '+15551234567' }), 'tripadvisor');
  assert.strictEqual(AV.sitioResena({ telefono: '', idioma: 'es' }), 'google');
  assert.strictEqual(AV.sitioResena({ telefono: '', idioma: 'en' }), 'tripadvisor');
  assert.strictEqual(AV.sitioResena({ telefono: '+15551234567' }, { modo: 'google' }), 'google');
  // sin enlace de TripAdvisor (hoy) cae a Google; con enlace, el turista va a TripAdvisor
  assert.strictEqual(AV.enlaceResena({ telefono: '+15551234567' }, AV.AJUSTES).sitio, 'google');
  const conTa = AV.unirAjustes([{ clave: 'resena_enlaces', valor: { tripadvisor: 'https://www.tripadvisor.com/UserReviewEdit-x' } }]);
  assert.deepStrictEqual(AV.enlaceResena({ telefono: '+15551234567' }, conTa), { sitio: 'tripadvisor', nombre: 'TripAdvisor', url: 'https://www.tripadvisor.com/UserReviewEdit-x' });
  assert.strictEqual(conTa.resena_enlaces.google, AV.AJUSTES.resena_enlaces.google);   // unir no pisa lo que no viene
  assert.strictEqual(AV.enlaceResena({}, AV.unirAjustes([{ clave: 'resena_enlaces', valor: { google: null, tripadvisor: null } }])), null);
});

test('los valores por defecto del codigo son los mismos que inserta la migracion 052', async () => {
  const b = crearBase();
  const sql = fs.readFileSync(path.join(__dirname, '../../db/migraciones/052_reservas_avisos.sql'), 'utf8');
  for (const s of sentencias(sql)) b.uno(s);
  const filas = (await b.pool.query('SELECT clave, valor FROM avisos_ajustes')).rows;
  assert.deepStrictEqual(filas.map((f) => f.clave).sort(), Object.keys(AV.AJUSTES).sort());
  for (const f of filas) assert.deepStrictEqual(f.valor, AV.AJUSTES[f.clave], f.clave);   // jsonb llega ya leido (pg y pg-mem)
  assert.ok(!/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i.test(sql.replace(/--[^\n]*/g, '')), 'la 052 es solo aditiva');
  assert.ok(!/GRANT[^;]*DELETE/i.test(sql), 'la app nunca borra');
});

// ---------------------------------------------------------------- adaptadores

function fetchFalso(respuesta) {
  const llamadas = [];
  const f = async (url, op) => {
    llamadas.push({ url, headers: op.headers, body: JSON.parse(op.body) });
    const r = typeof respuesta === 'function' ? respuesta(url) : respuesta;
    return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body) };
  };
  f.llamadas = llamadas;
  return f;
}

test('Resend: desde reservas@rosanta.rest, responde a restaurante@, adjunto en base64 e Idempotency-Key; sin llave no sale', async () => {
  const f = fetchFalso({ status: 200, body: { id: 'em_1' } });
  const c = AD.crearCorreoResend({ apiKey: 're_prueba', fetch: f });
  const r = await c.enviar({ to: ['mara@ejemplo.test'], asunto: 'Hola', texto: 't', html: '<p>t</p>', idempotencia: 'confirmacion:r1:correo',
    adjuntos: [{ nombre: 'rosanta.ics', tipo: 'text/calendar', contenido: 'BEGIN:VCALENDAR' }] });
  assert.deepStrictEqual(r, { id: 'em_1' });
  const ll = f.llamadas[0];
  assert.strictEqual(ll.url, AD.RESEND_URL);
  assert.deepStrictEqual([ll.body.from, ll.body.to, ll.body.reply_to], ['Rosanta <reservas@rosanta.rest>', ['mara@ejemplo.test'], 'restaurante@rosanta.rest']);
  assert.strictEqual(Buffer.from(ll.body.attachments[0].content, 'base64').toString(), 'BEGIN:VCALENDAR');
  assert.strictEqual(ll.headers['Idempotency-Key'], 'confirmacion:r1:correo');
  await assert.rejects(AD.crearCorreoResend({ fetch: f }).enviar({ to: ['x@ejemplo.test'] }), /RESEND_API_KEY/);
  assert.strictEqual(f.llamadas.length, 1);
  await assert.rejects(AD.crearCorreoResend({ apiKey: 'k', fetch: fetchFalso({ status: 429, body: { message: 'lento' } }) }).enviar({ to: ['x@ejemplo.test'] }), /429/);
});

test('sombra: TODO va a restaurante@rosanta.rest con el destinatario tapado; el WhatsApp llega como correo', async () => {
  const f = fetchFalso({ status: 200, body: { id: 'em_2' } });
  const { modo, correo, whatsapp } = AD.canalesDesdeEntorno({ AVISOS_MODO: 'sombra', RESEND_API_KEY: 're_prueba' }, f);
  assert.deepStrictEqual([modo, whatsapp], ['sombra', null]);
  await correo.enviar({ to: ['mara@ejemplo.test'], asunto: 'Tu mesa', texto: 't', html: 'h', idempotencia: 'k1' });
  await correo.enviarWhatsappComoCorreo({ to: '+50255554001', plantilla: 'rosanta_reserva_recordatorio', idioma: 'es', cuerpo: 'Hola Mara' });
  assert.deepStrictEqual(f.llamadas.map((x) => x.body.to), [['restaurante@rosanta.rest'], ['restaurante@rosanta.rest']]);
  assert.strictEqual(f.llamadas[0].body.subject, '[SOMBRA → m***@ejemplo.test] Tu mesa');
  assert.match(f.llamadas[1].body.subject, /^\[SOMBRA WhatsApp → \+•+4001\] rosanta_reserva_recordatorio$/);
  assert.ok(!/mara@ejemplo|55554001/.test(JSON.stringify(f.llamadas.map((x) => x.body))), 'el dato real no viaja en la sombra');
  assert.throws(() => AD.crearSombra(correo, { destino: 'alguien@gmail.com' }), /rosanta\.rest/);
  assert.strictEqual(AD.canalesDesdeEntorno({}, f).modo, 'apagado');
});

test('WhatsApp de Meta: plantilla con parametros y boton de enlace; apagado si no se enciende', async () => {
  const f = fetchFalso({ status: 200, body: { messages: [{ id: 'wamid.1' }] } });
  const w = AD.canalesDesdeEntorno({ AVISOS_MODO: 'vivo', WHATSAPP_AVISOS: 'encendido', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: '123' }, f).whatsapp;
  const r = await w.enviar({ to: '+502 5555 4001', plantilla: 'rosanta_reserva_recordatorio', idioma: 'es', parametros: ['Mara', 'jueves', '19:00', '2 personas'], boton_sufijo: 'cod.firma' });
  assert.deepStrictEqual(r, { id: 'wamid.1' });
  const b = f.llamadas[0].body;
  assert.match(f.llamadas[0].url, /\/123\/messages$/);
  assert.deepStrictEqual([b.to, b.template.name, b.template.language.code], ['50255554001', 'rosanta_reserva_recordatorio', 'es']);
  assert.deepStrictEqual(b.template.components[1], { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'cod.firma' }] });
  assert.strictEqual(AD.canalesDesdeEntorno({ AVISOS_MODO: 'vivo' }, f).whatsapp, null);
});

test('firma del webhook de Resend (Svix): buena, cambiada, vieja o sin secreto', () => {
  const secreto = 'whsec_' + Buffer.from('secreto-de-prueba-123').toString('base64');
  const cuerpo = '{"type":"email.delivered","data":{"email_id":"em_1"}}';
  const ts = String(Math.floor(Date.UTC(2026, 10, 3, 16) / 1000));
  const firma = crypto.createHmac('sha256', Buffer.from('secreto-de-prueba-123')).update('msg_1.' + ts + '.' + cuerpo).digest('base64');
  const cab = { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': 'v1,otra v1,' + firma };
  const ahora = Date.UTC(2026, 10, 3, 16, 2);
  assert.strictEqual(AD.firmaResendValida(secreto, cab, cuerpo, ahora), true);
  assert.strictEqual(AD.firmaResendValida(secreto, cab, cuerpo.replace('delivered', 'bounced'), ahora), false);
  assert.strictEqual(AD.firmaResendValida(secreto, cab, cuerpo, ahora + 600000), false);
  assert.strictEqual(AD.firmaResendValida('', cab, cuerpo, ahora), false);
});

test('formato: fechas en hora de Guatemala, primer nombre, mascaras y huellas', () => {
  const i = '2026-11-05T01:30:00.000Z';   // 4 de noviembre 19:30 en Guatemala
  assert.deepStrictEqual([F.fechaBonita(i, 'es'), F.horaBonita(i, 'es'), F.fechaBonita(i, 'en'), F.horaBonita(i, 'en')],
    ['miércoles 4 de noviembre', '19:30', 'Wednesday, November 4', '7:30 pm']);
  assert.deepStrictEqual([F.personasTexto(1, 'es'), F.personasTexto(4, 'en')], ['1 persona', '4 guests']);
  assert.strictEqual(F.primerNombre('  mara josé inventada'), 'Mara');
  assert.deepStrictEqual([F.enmascarar('correo', 'mara@ejemplo.test'), F.enmascarar('whatsapp', '+50255554001')], ['ma***@ejemplo.test', '+502 ••••4001']);
  assert.match(F.huellaDestino('Mara@Ejemplo.test'), /^[0-9a-f]{64}$/);
  assert.strictEqual(F.idioma('es-GT'), 'es');
  assert.strictEqual(F.idioma(''), 'en');   // ingles es el principal
});
