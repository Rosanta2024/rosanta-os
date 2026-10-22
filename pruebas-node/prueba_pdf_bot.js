/**
 * PDF desde la consola (22-oct-2026): corre enviarRespuestasPendientes REAL del bot con el motor de la nube
 * (Meta y Drive imitados) y revisa WhatsApp (document), Instagram y Messenger (file), y que las fotos sigan igual.
 * Uso: node pruebas-node/prueba_pdf_bot.js [carpeta del motor] (por defecto, el worktree de la nube)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const BOT = path.join(__dirname, '..', 'apps-script', 'bot-rosanta');
const MOTOR = process.argv[2] || path.join(process.env.HOME, 'Dev/Rosanta/.claude/worktrees/sad-merkle-6c168a/cloud/bot/src');

// El motor carga el bot de ../bot-rosanta: carpeta temporal con un enlace al bot que se prueba.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-pdf-'));
fs.mkdirSync(path.join(tmp, 'src'));
['motor-bot.js', 'reproductor.js', 'conversaciones.js'].forEach((f) => fs.copyFileSync(path.join(MOTOR, f), path.join(tmp, 'src', f)));
fs.symlinkSync(BOT, path.join(tmp, 'bot-rosanta'), 'dir');
const { crearMotor } = require(path.join(tmp, 'src', 'motor-bot.js'));

function respuesta(code, texto, blob) {
  return { getResponseCode: () => code, getContentText: () => texto || '', getHeaders: () => ({}),
    getBlob: () => blob || { getContentType: () => 'application/json', getBytes: () => [], getName: () => '' } };
}
function correr(filas) {
  const llamadas = [];
  const red = (url, op) => {
    llamadas.push({ url, op });
    if (/drive\.google\.com\/uc\?export=download/.test(url)) {
      const pdf = /id=pdf/.test(url);
      return respuesta(200, '', { getContentType: () => (pdf ? 'application/pdf' : 'image/jpeg'), getBytes: () => [1, 2, 3], getName: () => 'x', _b64: 'AQID' });
    }
    if (/\/media$/.test(url)) return respuesta(200, '{"id":"media-1"}');
    return respuesta(200, '{"messages":[{"id":"x"}],"message_id":"m"}');
  };
  const libro = { Leads: [['Fecha/Hora']], Conversaciones: [['Fecha/Hora', 'Canal', 'ContactoID', 'Nombre', 'Direccion', 'Autor', 'Texto']],
    Salientes: [['Fecha/Hora', 'Canal', 'ContactoID', 'Texto', 'Tipo', 'Enviado']].concat(filas) };
  const motor = crearMotor({ relojReal: true, libros: { leads: libro }, red, permitido: () => true, esWix: () => false,
    props: { WA_PHONE_NUMBER_ID: 'pid', WHATSAPP_TOKEN: 'wa', IG_TOKEN: 'ig', MESSENGER_TOKEN: 'ms' } });
  motor.ctx.enviarRespuestasPendientes();
  return { llamadas, libro, motor };
}
let n = 0;
const prueba = (t, fn) => { fn(); n++; console.log('OK ' + t); };
const ahora = new Date();

prueba('WhatsApp: el PDF se sube a Meta y va como "document" con su nombre y su pie; la fila queda enviada', () => {
  const r = correr([[ahora, 'whatsapp', '50255501111', 'Aquí tu comprobante', 'archivo:pdf123|Comprobante 22-oct.pdf', '']]);
  const up = r.llamadas.find((l) => /\/media$/.test(l.url));
  assert.ok(up, 'subió el archivo a /media');
  assert.strictEqual(up.op.payload.type, 'application/pdf');
  const msg = r.llamadas.find((l) => /\/messages$/.test(l.url));
  const p = JSON.parse(msg.op.payload);
  assert.strictEqual(p.type, 'document');
  assert.deepStrictEqual(p.document, { id: 'media-1', filename: 'Comprobante 22-oct.pdf', caption: 'Aquí tu comprobante' });
  assert.ok(r.libro.Salientes[1][5] instanceof Date || String(r.libro.Salientes[1][5]).length > 5, 'la fila de Salientes quedó con su fecha de enviado');
  assert.ok(r.libro.Conversaciones.some((f) => /📄 Comprobante 22-oct\.pdf/.test(String(f[6]))), 'queda en Conversaciones');
});

prueba('Instagram y Messenger: attachment "file" con el enlace de Drive, y el pie aparte', () => {
  ['instagram', 'messenger'].forEach((canal) => {
    const r = correr([[ahora, canal, '999001', 'Te mando el menú', 'archivo:pdf9|Menu.pdf', '']]);
    const envios = r.llamadas.filter((l) => /\/me\/messages$/.test(l.url)).map((l) => JSON.parse(l.op.payload));
    assert.strictEqual(envios[0].message.attachment.type, 'file', canal);
    assert.match(envios[0].message.attachment.payload.url, /uc\?export=download&id=pdf9$/);
    assert.ok(envios.some((e) => e.message && e.message.text === 'Te mando el menú'), canal + ': el pie va como texto');
    assert.ok(r.llamadas.some((l) => (canal === 'instagram' ? /graph\.instagram\.com/ : /graph\.facebook\.com/).test(l.url)), canal + ': su API');
  });
});

prueba('Las FOTOS siguen igual (type "image")', () => {
  const r = correr([[ahora, 'whatsapp', '50255501111', 'El jardín', 'imagen:foto1', '']]);
  const p = JSON.parse(r.llamadas.find((l) => /\/messages$/.test(l.url)).op.payload);
  assert.strictEqual(p.type, 'image');
  assert.strictEqual(p.image.caption, 'El jardín');
  const ig = correr([[ahora, 'instagram', '999001', '', 'imagen:foto1', '']]);
  assert.strictEqual(JSON.parse(ig.llamadas.find((l) => /me\/messages$/.test(l.url)).op.payload).message.attachment.type, 'image');
});

prueba('Si Drive no devuelve un PDF, no se manda nada y la fila queda con el error (no como enviada)', () => {
  const r = correr([[ahora, 'whatsapp', '50255501111', '', 'archivo:noespdf|x.pdf', '']]);
  assert.ok(!r.llamadas.some((l) => /\/messages$/.test(l.url)));
  assert.match(String(r.libro.Salientes[1][5]), /^ERROR: .*No se pudo bajar el PDF/);
});

prueba('Consola: acepta PDF hasta 25 MB y lo anota como archivo:<id>|<nombre>; fotos siguen con enviarImagen', () => {
  const C = path.join(__dirname, '..', 'apps-script', 'consola-de-respuestas-rosanta');
  const code = fs.readFileSync(path.join(C, 'Code.js'), 'utf8'), html = fs.readFileSync(path.join(C, 'Index.html'), 'utf8');
  assert.ok(/accept="image\/jpeg,image\/png,application\/pdf"/.test(html));
  assert.ok(/corre\.enviarArchivo\(/.test(html) && /corre\.enviarImagen\(/.test(html));
  assert.ok(/'archivo:' \+ file\.getId\(\) \+ '\|' \+ nombre/.test(code));
  assert.ok(/ARCHIVO_MAX_MB = 25/.test(code));
  assert.ok(/if \(mime !== 'image\/jpeg' && mime !== 'image\/png'\)/.test(code), 'enviarImagen sin cambios');
});

console.log('\n' + n + '/' + n + ' pruebas OK');
