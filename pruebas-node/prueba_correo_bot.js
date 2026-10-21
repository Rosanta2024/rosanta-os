/**
 * Prueba del canal de correo del bot y de las reservas pedidas por el restaurante (19-oct-2026, caso Louise).
 * Corre el código REAL de apps-script/bot-rosanta (Correo.js, Manual.js, Reservas.js, Cambiar.js, Cancelar.js)
 * con Gmail, Wix, WhatsApp y las hojas imitados. Uso: node pruebas-node/prueba_correo_bot.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const DIR = process.env.BOT_DIR || path.join(__dirname, '..', 'apps-script', 'bot-rosanta');

function mundo(opciones) {
  opciones = opciones || {};
  const cacheMem = Object.assign({}, opciones.cache || {});
  const props = {}, avisos = { mail: [], wa: [], wix: [], leads: [], conv: [], borradores: [], respuestas: [], humano: [] };
  const fmt = (d, tz, f) => {
    const g = new Date(d.getTime() - 6 * 3600000);   // Guatemala, UTC-6 sin horario de verano
    const z = (n) => String(n).padStart(2, '0');
    return f.replace('yyyy', g.getUTCFullYear()).replace('MM', z(g.getUTCMonth() + 1)).replace('dd', z(g.getUTCDate()))
      .replace('HH', z(g.getUTCHours())).replace('mm', z(g.getUTCMinutes())).replace(/^H$/, String(g.getUTCHours())).replace(/^m$/, String(g.getUTCMinutes()));
  };
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, parseInt,
    Logger: { log: () => {} },
    PROPS: { getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate: fmt },
    MailApp: { sendEmail: (o) => { if (opciones.mailRoto) throw new Error('cuota'); avisos.mail.push(o); } },
    GmailApp: { search: () => opciones.hilos || [], sendEmail: (to, a, b) => avisos.respuestas.push({ to, b }), createDraft: (to, a, b) => avisos.borradores.push({ to, b }) },
    ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    UrlFetchApp: { fetch: (url, o) => {
      if (/\/correo\/quien$/.test(url)) {   // @64: la nube dice quién atiende el correo
        avisos.quien = (avisos.quien || 0) + 1;
        if (opciones.quien === 'caida') throw new Error('sin red');
        return { getResponseCode: () => (opciones.quien ? 200 : 404), getContentText: () => JSON.stringify({ modo: opciones.quien }) };
      }
      const datos = JSON.parse(o.payload); const fn = url.split('/').pop(); avisos.wix.push({ fn, datos });
      const r = (opciones.wix && opciones.wix[fn]) ? opciones.wix[fn](datos) : { ok: false, motivo: 'NO_ENCONTRADA' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(r) };
    } },
    CacheService: { getScriptCache: () => ({ get: (k) => (cacheMem[k] === undefined ? null : cacheMem[k]), put: (k, v) => { cacheMem[k] = v; } }) },
    sendWhatsApp: (pid, to, t) => { if (opciones.waRoto) throw new Error('meta'); avisos.wa.push(t); },
    logMensaje: (...a) => avisos.conv.push(a),
    logLead: (lead) => avisos.leads.push(lead),
    fichaActualizar_: () => {},
    botEnPausa: (id) => !!(opciones.pausa && opciones.pausa === id),
    cotizacionEnviada_: () => false,
    notificarHumano: (canal, lead) => avisos.humano.push(lead),
    btAtender_: (canal, id, nombre, entrada) => {
      if (opciones.atender) return opciones.atender(canal, id, entrada, ctx);
      return { respuesta: 'What email did you book with?', lead: { tipo: 'reserva', resumen: 'Quiere mover su reserva', requiere_humano: false } };
    }
  };
  ctx.PropertiesService = { getScriptProperties: () => ctx.PROPS };
  props.CORREO_DESDE = String(Date.parse('2026-10-15T00:00:00Z'));
  props.CORREO_RED_ULTIMA = '9000000000000000';   // la red se prueba aparte, con su propio reloj
  props.OWNER_WA = '50200000000'; props.WA_PHONE_NUMBER_ID = '123';
  props.WIX_RESERVAS_URL = 'https://www.rosanta.rest/_functions/reservaBot'; props.WIX_RESERVAS_SECRETO = 'sec-prueba';
  vm.createContext(ctx);
  ['Reservas.js', 'Cambiar.js', 'Cancelar.js', 'Correo.js', 'Manual.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  // Lo que en producción vive en Code.js y no se carga aquí
  vm.runInContext('rvHistoria = function () {}; rvCorreoCliente = function (d, caso) { __correoCliente.push(caso); };', ctx);
  ctx.__correoCliente = avisos.correoCliente = [];
  return { ctx, props, avisos };
}

let n = 0;
function mensaje(id, from, cuerpo, fechaIso, extra) {
  return Object.assign({ getId: () => id, getFrom: () => from, getPlainBody: () => cuerpo, getSubject: () => 'Reservation Oct 26',
    getDate: () => new Date(fechaIso), isDraft: () => false,
    reply: function (b) { this._w.respuestas.push({ to: from, b }); }, createDraftReply: function (b) { this._w.borradores.push({ to: from, b }); } }, extra || {});
}
function hilo(id, msgs, w) { msgs.forEach((m) => { m._w = w.avisos; }); return { getId: () => id, getMessages: () => msgs }; }
function prueba(nombre, fn) { fn(); n++; console.log('OK ' + nombre); }
const LOUISE = '"Louise Thomas" <louiseramseythomas@gmail.com>';

// ---------------- Punto 1: ningún correo de cliente sin respuesta y sin aviso ----------------
prueba('Borrador (Louise): le llega a Juanma el aviso por WhatsApp y correo, y recién ahí queda visto', () => {
  const w = mundo(); const opc = w;
  const h = hilo('h1', [mensaje('m1', LOUISE, 'Could we move to Sunday 6pm?', '2026-10-19T11:33:00Z')], w);
  opc.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.strictEqual(w.avisos.borradores.length, 1);
  assert.strictEqual(w.avisos.wa.filter((t) => /Lead para atender \(correo\)/.test(t)).length, 1);
  assert.ok(w.avisos.wa[0].indexOf('mail.google.com/mail/u/0/#all/h1') > 0, 'trae el enlace al hilo');
  assert.ok(w.avisos.mail.some((m) => /Lead para atender \(correo\)/.test(m.subject)));
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_VISTOS), ['m1']);
  w.ctx.revisarCorreosClientes();   // la vuelta siguiente no repite nada
  assert.strictEqual(w.avisos.borradores.length, 1);
  assert.strictEqual(w.avisos.wa.filter((t) => /Lead para atender/.test(t)).length, 1);
});

prueba('Si el bot falla a la mitad, NO queda visto: reintenta y a la tercera avisa a Juanma', () => {
  const w = mundo({ atender: () => { throw new Error('Claude 529'); } });
  const h = hilo('h2', [mensaje('m2', LOUISE, 'Hello?', '2026-10-19T17:35:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_VISTOS), []);
  assert.strictEqual(w.avisos.wa.length, 0);
  w.ctx.revisarCorreosClientes();
  w.ctx.revisarCorreosClientes();
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_VISTOS), ['m2']);
  assert.strictEqual(w.avisos.wa.filter((t) => /falló 3 veces/.test(t)).length, 1);
});

prueba('Si el aviso no sale (sin WhatsApp ni correo), tampoco queda visto', () => {
  const w = mundo({ mailRoto: true, waRoto: true });
  const h = hilo('h3', [mensaje('m3', LOUISE, 'Hi', '2026-10-19T11:33:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_VISTOS), []);
});

prueba('Cambio hecho en Wix: se contesta solo y NO molesta a Juanma', () => {
  const w = mundo({ atender: (c, id, e, ctx) => { vm.runInContext("CORREO_AUTO = { cuerpo: 'Done, Sunday 6pm.', asunto: 'x', caso: 'cambiada' }", ctx); return { respuesta: 'x', lead: { tipo: 'reserva', resumen: 'Reserva CAMBIADA por el bot' } }; } });
  const h = hilo('h4', [mensaje('m4', LOUISE, 'Move to Sunday 6pm', '2026-10-19T11:33:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.strictEqual(w.avisos.respuestas.length, 1);
  assert.strictEqual(w.avisos.wa.length, 0);
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_VISTOS), ['m4']);
});

prueba('Proveedor o publicidad: ni borrador ni aviso, y la red de cada hora lo salta', () => {
  const w = mundo({ atender: () => ({ respuesta: 'x', lead: { tipo: 'otro', resumen: 'newsletter' } }) });
  const h = hilo('h5', [mensaje('m5', 'news@tienda.com', 'Oferta', '2026-10-19T11:33:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.strictEqual(w.avisos.borradores.length + w.avisos.wa.length, 0);
  assert.deepStrictEqual(JSON.parse(w.props.CORREO_NO_CLIENTE), ['h5']);
});

prueba('Bot en pausa con el cliente, o borrador viejo sin mandar: aviso a Juanma (antes se perdía en silencio)', () => {
  const w = mundo({ pausa: 'louiseramseythomas@gmail.com' });
  const h = hilo('h6', [mensaje('m6', LOUISE, 'Any news?', '2026-10-19T17:35:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.ok(/en pausa/.test(w.avisos.wa[0]));
  const w2 = mundo();
  const h2 = hilo('h7', [mensaje('b7', 'restaurante@rosanta.rest', 'borrador', '2026-10-19T10:00:00Z', { isDraft: () => true }),
    mensaje('m7', LOUISE, 'Hello again', '2026-10-19T17:35:00Z')], w2);
  w2.ctx.GmailApp.search = () => [h2];
  w2.ctx.revisarCorreosClientes();
  assert.ok(/borrador sin mandar/.test(w2.avisos.wa[0]));
});

prueba('Evento que pide persona: sale el aviso con el bloque del pipeline (notificarHumano), uno solo', () => {
  const w = mundo({ atender: () => ({ respuesta: 'Gracias, te mandamos la cotización', lead: { tipo: 'evento', requiere_humano: true, resumen: 'Boda 80' } }) });
  const h = hilo('h8', [mensaje('m8', 'novia@x.com', 'Boda para 80', '2026-10-19T15:00:00Z')], w);
  w.ctx.GmailApp.search = () => [h];
  w.ctx.revisarCorreosClientes();
  assert.strictEqual(w.avisos.humano.length, 1);
  assert.strictEqual(w.avisos.wa.length, 0);
});

// ---------------- @64: quién atiende el correo (día único del paso a la nube) ----------------
prueba('@64: si la nube dice "nube", el bot de Apps Script no lee ni contesta; "sombra", sin respuesta o caída: atiende', () => {
  const correr = (quien, cache) => {
    const w = mundo({ quien, cache });
    let leyo = false;
    w.ctx.GmailApp.search = () => { leyo = true; return []; };
    w.ctx.revisarCorreosClientes();
    return { leyo, w };
  };
  assert.strictEqual(correr('nube').leyo, false);
  assert.strictEqual(correr('sombra').leyo, true);
  assert.strictEqual(correr('apps').leyo, true);
  assert.strictEqual(correr(undefined).leyo, true, '404: la nube todavía no tiene el canal');
  assert.strictEqual(correr('caida').leyo, true, 'caída y sin respuesta anterior: atiende (mejor dos que ninguno)');
  assert.strictEqual(correr('caida', { correo_quien: 'nube' }).leyo, false, 'caída: usa la última respuesta');
});

// ---------------- Punto 2: red de seguridad cada hora, de 8 a 21 ----------------
prueba('Red: correo de cliente sin respuesta hace más de 2 h → WhatsApp a Juanma, una sola vez por correo', () => {
  const w = mundo();
  const viejo = hilo('r1', [mensaje('x1', '"Joe" <joe@pwc.com>', 'Final count 14', '2026-10-19T14:00:00Z')], w);   // 8:00 GT
  const nuevo = hilo('r2', [mensaje('x2', '"Ana" <ana@x.com>', 'Hola', '2026-10-19T16:30:00Z')], w);           // 10:30 GT
  const nuestro = hilo('r3', [mensaje('x3', '"Juanma" <restaurante@rosanta.rest>', 'Listo', '2026-10-19T12:00:00Z')], w);
  const conBorrador = hilo('r4', [mensaje('x4', '"Jacob" <j@gmail.com>', 'Confirm 12', '2026-10-18T14:00:00Z'),
    mensaje('b4', 'restaurante@rosanta.rest', 'borrador', '2026-10-19T16:01:00Z', { isDraft: () => true })], w);
  w.ctx.GmailApp.search = () => [viejo, nuevo, nuestro, conBorrador];
  delete w.props.CORREO_RED_ULTIMA;
  const p = w.ctx.correoRed_(new Date('2026-10-19T17:00:00Z'));   // 11:00 GT
  assert.deepStrictEqual(Array.from(p, (x) => x.id).sort(), ['x1', 'x4']);
  assert.ok(/hay borrador sin mandar/.test(w.avisos.wa[0]));
  assert.strictEqual(w.ctx.correoRed_(new Date('2026-10-19T17:20:00Z')), null, 'no corre dos veces en la misma hora');
  assert.deepStrictEqual(Array.from(w.ctx.correoRed_(new Date('2026-10-19T19:01:00Z')), (x) => x.id), ['x2'], 'no repite los ya avisados');
  assert.strictEqual(w.ctx.correoRed_(new Date('2026-10-20T03:30:00Z')), null, '21:30 GT: fuera de horario');
  assert.strictEqual(w.ctx.correoRed_(new Date('2026-10-20T13:30:00Z')), null, '7:30 GT: fuera de horario');
});

prueba('Red: busca también los eventos (Cotizaciones) y deja fuera SAT, bancos y proveedores', () => {
  const w = mundo();
  const q = w.ctx.CORREO_RED_BUSQUEDA || vm.runInContext('CORREO_RED_BUSQUEDA', w.ctx);
  assert.ok(/label:01-clientes--reservas--cotizaciones/.test(q) && !/-label:01-clientes--reservas--cotizaciones/.test(q));
  ['-from:sat.gob.gt', '-from:notificacionesbi.com.gt', '-from:baccredomatic.com', '-from:rosanta.rest'].forEach((x) => assert.ok(q.indexOf(x) >= 0, x));
});

// ---------------- Punto 3: reservas pedidas por el restaurante, por la API ----------------
const louiseWix = {
  consultarBot: (d) => ({ ok: true, nombre: 'Anna', reservas: [{ fecha: '2026-10-26', hora: '17:30', personas: 3, id: 'res-1', nombre: 'Anna Thomas', email: 'louiseramseythomas@gmail.com', nota: '' }] }),
  cambiarBot: (d) => ({ ok: true, modo: 'modificada', vieja_cancelada: true, antes: { fecha: '2026-10-26', hora: '17:30', personas: 3 },
    ahora: { fecha: d.fecha, hora: d.hora, personas: 3, id: d.id }, nota: d.nota, nombre: 'Anna Thomas', email: 'louiseramseythomas@gmail.com' })
};
prueba('Louise en segundos: buscar por nombre y cambiar al domingo 6 pm con la nota, sin escribirle a la clienta', () => {
  const w = mundo({ wix: louiseWix });
  const b = w.ctx.rvManual({ accion: 'buscar', nombre: 'Thomas' });
  assert.strictEqual(w.avisos.wix[0].fn, 'consultarBot');
  assert.strictEqual(w.avisos.wix[0].datos.detalle, true);
  const r = w.ctx.rvManual({ accion: 'cambiar', id: b.reservas[0].id, fecha: '2026-10-25', hora: '6:00 pm', nota: 'Pidió mesa adentro por si llueve', quien: 'Central' });
  assert.ok(r.ok);
  const enviado = w.avisos.wix[1];
  assert.strictEqual(enviado.fn, 'cambiarBot');
  assert.strictEqual(enviado.datos.id, 'res-1');
  assert.strictEqual(enviado.datos.fecha, '2026-10-25');
  assert.strictEqual(enviado.datos.hora, '18:00');
  assert.strictEqual(enviado.datos.nota, 'Pidió mesa adentro por si llueve');
  assert.strictEqual(enviado.datos.secreto, 'sec-prueba');
  assert.ok(/^Reserva CAMBIADA por el restaurante \(Central\): 2026-10-26 17:30 → 2026-10-25 18:00/.test(w.avisos.leads[0].resumen), 'registro en Leads = resumen de la noche');
  assert.ok(w.avisos.conv.some((c) => c[1] === 'louiseramseythomas@gmail.com' && /Hecho en Wix por el restaurante/.test(c[5])));
  assert.deepStrictEqual(w.avisos.correoCliente, [], 'a la clienta no se le escribe');
  assert.ok(w.avisos.wa.some((t) => /Reserva CAMBIADA/.test(t)), 'el equipo se entera como siempre');
});

prueba('Desde la web: secreto equivocado no hace nada; cancelar sin fecha no se acepta', () => {
  const w = mundo({ wix: louiseWix });
  const mal = JSON.parse(w.ctx.rvmWeb_({ postData: { contents: JSON.stringify({ secreto: 'otro', accion: 'cambiar', id: 'res-1', fecha: '2026-10-25' }) } }).t);
  assert.strictEqual(mal.motivo, 'SECRETO_INVALIDO');
  assert.strictEqual(w.avisos.wix.length, 0);
  const sinFecha = w.ctx.rvManual({ accion: 'cancelar', email: 'a@b.com' });
  assert.strictEqual(sinFecha.motivo, 'FALTAN_DATOS');
  const bien = JSON.parse(w.ctx.rvmWeb_({ postData: { contents: JSON.stringify({ secreto: 'sec-prueba', accion: 'buscar', email: 'louiseramseythomas@gmail.com' }) } }).t);
  assert.ok(bien.ok);
});

prueba('Code.js manda ?accion=reserva a Manual.js antes que la guardia de Meta', () => {
  const code = fs.readFileSync(path.join(DIR, 'Code.js'), 'utf8');
  const i = code.indexOf("e.parameter.accion === 'reserva'"), j = code.indexOf('Guardia del webhook');
  assert.ok(i > 0 && i < j);
});

prueba('@67: el correo de confirmación cierra con "Te esperamos en Rosanta." (la mesa puede ser jardín, pérgola, cava o salón)', () => {
  const c = fs.readFileSync(path.join(DIR, 'Cancelar.js'), 'utf8');
  assert.ok(c.indexOf("Te esperamos en Rosanta.\\n\\nPara cambiarla") > 0 && c.indexOf('See you at Rosanta.') > 0);
  assert.ok(!/Te esperamos en el jard|See you in the garden/.test(c));
});

console.log('\n' + n + '/' + n + ' pruebas OK');
