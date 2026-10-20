// La cuenta de Google de la nube (20-oct-2026): renovar el permiso, precargar Gmail y el shim sincronico.
const test = require('node:test');
const assert = require('node:assert');
const { crearCuenta, precargaGmail, shimGmail } = require('../src/google-cuenta');

const CRED = { client_id: 'c', client_secret: 's', refresh_token: 'r' };
function fetchFalso(rutas) {
  const pedidos = [];
  const f = async (url, op) => {
    pedidos.push({ url, op });
    const k = Object.keys(rutas).find((x) => url.startsWith(x));
    const v = k ? rutas[k] : { status: 404, j: {} };
    const r = typeof v === 'function' ? v(url, op) : v;
    return { ok: r.status === undefined || r.status < 300, status: r.status || 200, json: async () => r.j, text: async () => r.t || JSON.stringify(r.j || {}) };
  };
  f.pedidos = pedidos;
  return f;
}

test('Renueva el permiso una vez y lo reusa; sin permiso, mensaje claro', async () => {
  const f = fetchFalso({ 'https://oauth2.googleapis.com/token': { j: { access_token: 'AT', expires_in: 3600 } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?': { j: { messages: [] } } });
  const c = crearCuenta({ credencial: CRED, fetch: f });
  await c.gmailListar('x'); await c.gmailListar('y');
  assert.strictEqual(f.pedidos.filter((p) => /token$/.test(p.url)).length, 1);
  assert.strictEqual(f.pedidos[1].op.headers.Authorization, 'Bearer AT');
  assert.throws(() => crearCuenta({ credencial: {} }), /GMAIL_OAUTH/);
  const malo = crearCuenta({ credencial: CRED, fetch: fetchFalso({ 'https://oauth2.googleapis.com/token': { status: 400, j: { error: 'invalid_grant' } } }) });
  await assert.rejects(() => malo.accessToken(), /invalid_grant.*volver a autorizar/);
});

test('Precarga mensajes y adjuntos; el shim contesta igual que el servicio avanzado y no escribe', async () => {
  const msg = { id: 'm1', payload: { headers: [{ name: 'Subject', value: 'Cierre' }], parts: [{ filename: 'a.pdf', body: { attachmentId: 'at1' } }, { filename: 'b.txt', body: { attachmentId: 'at2' } }] } };
  const f = fetchFalso({ 'https://oauth2.googleapis.com/token': { j: { access_token: 'AT', expires_in: 3600 } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?': { j: { messages: [{ id: 'm1' }] } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/m1?': { j: msg },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/m1/attachments/at1': { j: { data: 'JVBE' } } });
  const pre = await precargaGmail(crearCuenta({ credencial: CRED, fetch: f }), 'from:x', { quiereAdjunto: (p) => /\.pdf$/.test(p.filename) });
  const G = shimGmail(pre);
  assert.deepStrictEqual(G.Users.Messages.list('me', { q: 'from:x' }), { messages: [{ id: 'm1' }] });
  assert.strictEqual(G.Users.Messages.get('me', 'm1').payload.headers[0].value, 'Cierre');
  assert.deepStrictEqual(G.Users.Messages.Attachments.get('me', 'm1', 'at1'), { data: 'JVBE' });
  assert.throws(() => G.Users.Messages.Attachments.get('me', 'm1', 'at2'), /no precargado/);
  assert.throws(() => G.Users.Messages.list('me', { q: 'otra' }), /no se precargo/);
  assert.throws(() => G.Users.Messages.modify('me', 'm1', {}), /no esta disponible/);
});

test('PDF a texto: sube convertido, exporta y BORRA el Doc aunque falle el export', async () => {
  let borrado = 0;
  const f = fetchFalso({ 'https://oauth2.googleapis.com/token': { j: { access_token: 'AT', expires_in: 3600 } },
    'https://www.googleapis.com/upload/drive/v3/files': { j: { id: 'D1' } },
    'https://www.googleapis.com/drive/v3/files/D1/export': { t: 'TEXTO DEL CIERRE' },
    'https://www.googleapis.com/drive/v3/files/D1': (u, op) => { if (op.method === 'DELETE') borrado++; return { j: {} }; } });
  const c = crearCuenta({ credencial: CRED, fetch: f });
  assert.strictEqual(await c.pdfATexto(Buffer.from('%PDF'), 'x'), 'TEXTO DEL CIERRE');
  assert.strictEqual(borrado, 1);
  const subida = f.pedidos.find((p) => /upload/.test(p.url));
  assert.match(subida.op.headers['Content-Type'], /multipart\/related/);
  assert.match(subida.op.body.toString(), /application\/vnd\.google-apps\.document/);
});

test('Precarga con papelera y varias paginas (FelCorreo/BancoCorreo): una sola lista, sin nextPageToken', async () => {
  const f = fetchFalso({ 'https://oauth2.googleapis.com/token': { j: { access_token: 'AT', expires_in: 3600 } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?': (url) => ({ j: /pageToken=p2/.test(url)
      ? { messages: [{ id: 'm2' }] } : { messages: [{ id: 'm1' }], nextPageToken: 'p2' } }),
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/m1?': { j: { id: 'm1', payload: {} } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/m2?': { j: { id: 'm2', payload: {} } } });
  const pre = await precargaGmail(crearCuenta({ credencial: CRED, fetch: f }), 'from:sat', { max: 100, paginas: 5, incluirPapelera: true });
  const listas = f.pedidos.filter((p) => /messages\?/.test(p.url));
  assert.strictEqual(listas.length, 2);
  assert.ok(listas.every((p) => /includeSpamTrash=true/.test(p.url) && /maxResults=100/.test(p.url)));
  assert.deepStrictEqual(pre.lista, { messages: [{ id: 'm1' }, { id: 'm2' }] });
  assert.deepStrictEqual(Object.keys(pre.mensajes), ['m1', 'm2']);
  // sin opciones, igual que antes: una pagina y sin includeSpamTrash
  const g = fetchFalso({ 'https://oauth2.googleapis.com/token': { j: { access_token: 'AT', expires_in: 3600 } },
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?': { j: { messages: [], nextPageToken: 'p2' } } });
  const pre2 = await precargaGmail(crearCuenta({ credencial: CRED, fetch: g }), 'x');
  assert.strictEqual(g.pedidos.filter((p) => /messages\?/.test(p.url)).length, 1);
  assert.ok(!/includeSpamTrash/.test(g.pedidos[1].url));
  assert.strictEqual(pre2.lista.nextPageToken, 'p2', 'con una pagina la lista queda como la dio Gmail');
});
