/**
 * @70 (Ashley, 21-oct-2026): avisos a Juanma que sí llegan. Corre el código REAL del bot con el motor de la nube
 * (Meta, Claude, hojas y correo imitados). Uso: node pruebas-node/prueba_avisos_bot.js [carpeta del motor]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const BOT = path.join(__dirname, '..', 'apps-script', 'bot-rosanta');
const MOTOR = process.argv[2] || path.join(process.env.HOME, 'Dev/Rosanta/.claude/worktrees/sad-merkle-6c168a/cloud/bot/src');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-avisos-'));
fs.mkdirSync(path.join(tmp, 'src'));
['motor-bot.js', 'reproductor.js', 'conversaciones.js'].forEach((f) => fs.copyFileSync(path.join(MOTOR, f), path.join(tmp, 'src', f)));
fs.symlinkSync(BOT, path.join(tmp, 'bot-rosanta'), 'dir');
const { crearMotor } = require(path.join(tmp, 'src', 'motor-bot.js'));

const OWNER = '50231337459', ASHLEY = '16074236092';
const resp = (code, cuerpo) => ({ getResponseCode: () => code, getContentText: () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
  getBlob: () => ({ getContentType: () => 'application/json', getBytes: () => [], getName: () => '' }) });
const LIBRO = () => ({ Leads: [['Fecha/Hora', 'Canal', 'Idioma', 'Nombre', 'Teléfono', 'Tipo', 'Urgencia', 'Resumen', 'Acción', '¿Humano?', 'Mensaje original', 'ID destino (no tocar)', 'Respuesta', 'Enviado', 'Email', 'Respuesta_Bot']],
  Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto']], Salientes: [['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']] });

function mundo(op) {
  const o = op || {};
  const meta = [];
  const lead = Object.assign({ idioma: 'en', nombre: 'Ashley', telefono: '', email: '', fecha: '', fecha_actual: '', hora_actual: '', hora: '', personas: '',
    tipo_evento: '', formato_menu: '', presupuesto: '', opciones: [], mostrar_menu: false, tipo: 'evento', urgencia: 'tibio',
    resumen: 'Asks about table layout for the dinner', accion: 'responder_info', requiere_humano: false }, o.lead || {});
  const red = (url, opt) => {
    if (/api\.anthropic\.com/.test(url)) return resp(200, { content: [{ type: 'text', text: JSON.stringify({ respuesta: o.respuesta || "I don't have the table layout. Someone from the restaurant will get in touch with you as soon as possible.", lead }) }] });
    meta.push({ url, cuerpo: JSON.parse(opt.payload || '{}') });
    return resp(200, { messages: [{ id: 'wamid.aviso' + meta.length }] });
  };
  const libro = o.libro || LIBRO();
  const motor = crearMotor({ relojReal: true, libros: { leads: libro }, red, permitido: () => true, esWix: () => false,
    props: Object.assign({ OWNER_WA: OWNER, WA_PHONE_NUMBER_ID: 'pid', WHATSAPP_TOKEN: 'wa', CONSOLE_URL: 'https://consola.test' }, o.props || {}) });
  return { motor, meta, libro };
}
const wa = (de, texto) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pid' }, contacts: [{ profile: { name: 'Ashley' } }],
  messages: [{ id: 'wamid.c' + Math.random(), from: de, type: 'text', text: { body: texto } }] } }] }] });
const recibir = (m, cuerpo) => m.motor.ctx.doPost({ parameter: { token: m.motor.ctx.PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET') }, postData: { contents: JSON.stringify(cuerpo) } });
const aJuanma = (m) => m.meta.filter((x) => x.cuerpo.to === OWNER);
const asuntos = (m) => m.motor.correos.map((c) => c.asunto);
let n = 0; const prueba = (t, fn) => { fn(); n++; console.log('OK ' + t); };

prueba('Ashley (ventana de Juanma cerrada, sin plantilla): la promesa sin marca avisa; no se intenta el WhatsApp libre y sale el correo URGENTE; queda anotado', () => {
  const m = mundo();
  recibir(m, wa(ASHLEY, 'How will the tables be set up?'));
  assert.ok(asuntos(m).some((a) => /Lead para atender \(whatsapp\)/.test(a)), 'el correo de siempre: ' + asuntos(m).join(' | '));
  assert.strictEqual(aJuanma(m).length, 0, 'no se intenta un WhatsApp libre que Meta va a descartar');
  assert.ok(asuntos(m).some((a) => /^⚠️ URGENTE: un cliente espera respuesta \(WhatsApp · Ashley …6092\)/.test(a)), asuntos(m).join(' | '));
  const av = m.libro.AvisosJuanma;
  assert.ok(av && av.length === 2 && av[1][4] === 'ventana_cerrada' && av[1][5] === 'no' && av[1][2] === '…6092', JSON.stringify(av));
  const leadRow = m.libro.Leads[m.libro.Leads.length - 1];
  assert.strictEqual(leadRow[9], 'Sí', '¿Humano? = Sí aunque el modelo no lo marcó');
});

prueba('Ashley, segundo mensaje del evento a los minutos: vuelve a avisar (el freno de 48 h solo quita el bloque de cotización)', () => {
  const m = mundo();
  recibir(m, wa(ASHLEY, 'How will the tables be set up?'));
  const antes = asuntos(m).filter((a) => /Lead para atender/.test(a)).length;
  recibir(m, wa(ASHLEY, 'They already sent me a proposal, I just want to know about the seating'));
  const lead = asuntos(m).filter((a) => /Lead para atender/.test(a));
  assert.strictEqual(lead.length, antes + 1, 'otro aviso');
  const ultimo = m.motor.correos.filter((c) => /Lead para atender/.test(c.asunto)).pop();
  assert.ok(!/PARA COTIZAR/.test(ultimo.cuerpo), 'sin repetir el bloque de cotización');
});

prueba('Ventana de Juanma abierta: va el WhatsApp libre, Meta lo acepta y NO sale el correo URGENTE; si después Meta avisa "failed", sí', () => {
  const m = mundo();
  recibir(m, wa(OWNER, 'hola, soy Juanma'));
  assert.ok(Number(m.motor.ctx.PropertiesService.getScriptProperties().getProperty('OWNER_ULTIMO_MSG')) > 0);
  m.meta.length = 0; m.motor.correos.length = 0;
  recibir(m, wa(ASHLEY, 'How will the tables be set up?'));
  assert.strictEqual(aJuanma(m).length, 1);
  assert.ok(!asuntos(m).some((a) => /URGENTE/.test(a)));
  const wamid = 'wamid.aviso' + m.meta.length;
  recibir(m, { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pid' },
    statuses: [{ id: wamid, status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }] } }] }] });
  assert.ok(asuntos(m).some((a) => /URGENTE/.test(a)), 'el failed de Meta dispara el URGENTE');
  assert.ok(m.libro.AvisosJuanma.some((r) => r[4] === 'estado' && r[5] === 'falló' && /131047/.test(r[6])));
});

prueba('Con la plantilla aprobada: va por plantilla (llega aunque la ventana esté cerrada) con 5 variables sin datos personales', () => {
  const m = mundo({ props: { AVISO_PLANTILLA: 'aviso_chat_pendiente' }, lead: { email: 'ash@ejemplo.test', resumen: 'Mi tarjeta 4111 1111 y correo ash@ejemplo.test' } });
  recibir(m, wa(ASHLEY, 'How will the tables be set up?'));
  const p = aJuanma(m)[0].cuerpo;
  assert.strictEqual(p.type, 'template');
  assert.strictEqual(p.template.name, 'aviso_chat_pendiente');
  const vars = p.template.components[0].parameters.map((x) => x.text);
  assert.strictEqual(vars.length, 5);
  assert.deepStrictEqual(vars.slice(0, 4), ['WhatsApp', 'Ashley', '6092', 'evento']);
  assert.ok(!JSON.stringify(vars).match(/@|4111/), 'ni correo ni tarjeta en la plantilla');
  assert.ok(!asuntos(m).some((a) => /URGENTE/.test(a)));
});

prueba('Resumen de la noche: PENDIENTES arriba con su hora límite y "⚠️ N chats esperan respuesta" en el asunto; lo ya contestado no cuenta', () => {
  const m = mundo();
  const libro = m.libro;
  const hace = (h) => new m.motor.ctx.Date(Date.now() - h * 3600000);   // el Date del motor (como en Apps Script)
  libro.Leads.push([hace(2), 'whatsapp', 'en', 'Ashley', '', 'evento', 'tibio', 'mesas', 'escalar_humano', 'Sí', '', ASHLEY, '', '', '', '']);
  libro.Conversaciones.push([hace(2), 'whatsapp', ASHLEY, 'Ashley', 'in', 'cliente', 'tables?']);
  libro.Leads.push([hace(3), 'instagram', 'es', 'Leo', '', 'queja', 'tibio', 'cobro', 'escalar_humano', 'Sí', '', '999001', '', '', '', '']);
  libro.Conversaciones.push([hace(3), 'instagram', '999001', 'Leo', 'in', 'cliente', 'cobro doble']);
  libro.Conversaciones.push([hace(1), 'instagram', '999001', 'Leo', 'out', 'humano', 'Ya lo vemos']);
  m.motor.ctx.resumenDiarioBot();
  const c = m.motor.correos.pop();
  assert.match(c.asunto, /^⚠️ 1 chat espera respuesta · Rosanta · Lo que hizo el bot hoy/);
  assert.match(c.cuerpo, /^PENDIENTES SIN RESPONDER \(1\)\n• Ashley \(whatsapp …6092\) · evento · contestar antes de /);
  assert.ok(!/Leo/.test(c.cuerpo.split('Lo que hizo el bot hoy')[0]), 'Leo ya fue contestado');
});

prueba('Recordatorio: a ~4 h del cierre de la ventana sale un aviso, una sola vez', () => {
  const m = mundo({ props: { OWNER_ULTIMO_MSG: String(Date.now()) } });
  const libro = m.libro;
  const hace = (h) => new m.motor.ctx.Date(Date.now() - h * 3600000);
  libro.Leads.push([hace(20.5), 'whatsapp', 'en', 'Ashley', '', 'evento', 'tibio', 'mesas', 'escalar_humano', 'Sí', '', ASHLEY, '', '', '', '']);
  libro.Conversaciones.push([hace(20.5), 'whatsapp', ASHLEY, 'Ashley', 'in', 'cliente', 'tables?']);
  assert.strictEqual(m.motor.ctx.avisoRecordatorios_(), 1);
  assert.match(aJuanma(m)[0].cuerpo.text.body, /^⏰ Quedan ~4 h para contestarle a Ashley/);
  m.motor.ctx.PropertiesService.getScriptProperties().deleteProperty('AVISO_REVISION');
  assert.strictEqual(m.motor.ctx.avisoRecordatorios_(), 0, 'no repite');
});

console.log('\n' + n + '/' + n + ' pruebas OK');
