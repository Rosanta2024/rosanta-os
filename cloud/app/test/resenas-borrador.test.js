// Borradores de reseñas con las reglas REALES del bot de reseñas (21-oct-2026). Sin red: Claude es de mentira.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/resenas-borrador');
const N = require('../src/resenas-nube');

function claudeFalso(texto, status) {
  const pedidos = [];
  const f = async (url, init) => {
    pedidos.push({ url, cuerpo: JSON.parse(init.body), clave: init.headers['x-api-key'] });
    if (status && status !== 200) return { ok: false, status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 1000, output_tokens: 60 } }) };
  };
  f.pedidos = pedidos;
  return f;
}
const LIMPIA = 'Mia, gracias por contarlo. Qué gusto que el lomito te haya dejado ganas de volver. La próxima mesa ya te espera.';

test('Reglas: se cargan del archivo real de Apps Script (prompt con las prohibiciones de siempre)', () => {
  const R = B.cargarReglas();
  const p = R.construirPrompt_(5, 'Mia Paz', 'Delicioso');
  assert.match(p, /NUNCA uses "nuestro"/);
  assert.match(p, /restaurante@rosanta\.rest/);
  assert.strictEqual(R.AUTO_MIN, 4);
  assert.match(p, /NUNCA nombres a nadie del equipo/);
  assert.match(p, /No inventes datos/);
  assert.match(p, /Prohibido repetir estas frases/);
  assert.doesNotMatch(p, /Juanma/);
});

test('Borrador: 5 estrellas y texto limpio → se publicaria sola; usa el modelo y la clave dados', async () => {
  const f = claudeFalso(LIMPIA);
  const r = await B.redactar({ estrellas: 5, cliente: 'Mia Paz', resena: 'Delicioso lomito' }, { clave: 'k', fetch: f });
  assert.strictEqual(r.decision, 'publicar_sola');
  assert.strictEqual(r.texto, LIMPIA);
  assert.strictEqual(f.pedidos[0].cuerpo.model, B.MODELO);
  assert.strictEqual(f.pedidos[0].clave, 'k');
  assert.ok(r.costo > 0 && r.costo < 0.01);
});

test('Borrador: el caso del 28-jul (nota del modelo pegada) se corta; el de 3 borradores va a aprobacion', async () => {
  const conNota = LIMPIA + '\n\n**[Note visible only to you]:** I responded in Spanish, is that ok?';
  const r1 = await B.redactar({ estrellas: 5, cliente: 'Mia', resena: 'x' }, { clave: 'k', fetch: claudeFalso(conNota) });
  assert.strictEqual(r1.texto, LIMPIA);
  const tres = 'Mia, gracias. Te esperamos.\nWait, I used the rule wrong. Let me try again.\nMia, gracias otra vez.';
  const r2 = await B.redactar({ estrellas: 5, cliente: 'Mia', resena: 'x' }, { clave: 'k', fetch: claudeFalso(tres) });
  assert.strictEqual(r2.texto, 'Mia, gracias. Te esperamos.');
  const sinPunto = await B.redactar({ estrellas: 4, cliente: 'Leo', resena: 'x' }, { clave: 'k', fetch: claudeFalso('Leo, gracias por la visita y por contarnos lo del servicio sin') });
  assert.strictEqual(sinPunto.decision, 'aprobar');
  assert.strictEqual(sinPunto.confiable, false);
});

test('Borrador: 3 estrellas siempre a aprobacion; si Claude falla, texto de respaldo y a aprobacion (revisor de marca)', async () => {
  const r = await B.redactar({ estrellas: 3, cliente: 'Leo', resena: 'Lento' }, { clave: 'k', fetch: claudeFalso(LIMPIA) });
  assert.strictEqual(r.decision, 'aprobar');
  const f = await B.redactar({ estrellas: 5, cliente: 'Ana Ruiz', resena: '' }, { clave: 'k', fetch: claudeFalso('', 529) });
  assert.strictEqual(f.fallo, '529');
  assert.match(f.texto, /^Ana, gracias/);
  assert.strictEqual(f.decision, 'aprobar');
  await assert.rejects(B.redactar({ estrellas: 5 }, { clave: '' }), (e) => e.status === 503);
});

test('Decision de la hoja: solo los estados que dicen que hizo Apps Script', () => {
  assert.strictEqual(B.decisionDeHoja('PUBLICADA_AUTO'), 'publicar_sola');
  assert.strictEqual(B.decisionDeHoja('PENDIENTE_APROBAR'), 'aprobar');
  assert.strictEqual(B.decisionDeHoja('PUBLICADA_APROBADA'), 'aprobar');
  assert.strictEqual(B.decisionDeHoja('YA_TENIA_RESPUESTA'), '');
  assert.strictEqual(B.decisionDeHoja('PUBLICADA_EDITADA'), '');
});

function baseBorradores(pendientes, gastado) {
  const ins = [], corridas = [];
  return { ins, corridas, query: async (sql, p) => {
    if (/sum\(costo_usd\)/.test(sql)) return { rows: [{ usd: gastado || 0 }] };
    if (/FROM resenas_gbp g/.test(sql)) return { rows: pendientes.slice(0, p[0]) };
    if (/INSERT INTO resenas_borradores/.test(sql)) { ins.push({ id: p[0], decision: p[5], hoja: p[6] }); return { rowCount: 1 }; }
    if (/INSERT INTO resenas_corridas/.test(sql)) { corridas.push(JSON.parse(p[2])); return { rowCount: 1 }; }
    throw new Error('consulta inesperada');
  } };
}

test('Sombra: compara la decision; un cambio en 4-5 estrellas se informa, no alerta', async () => {
  const pend = [
    { review_id: 'a', estrellas: 5, cliente: 'Mia', resena: 'x', estado: 'PUBLICADA_AUTO' },
    { review_id: 'b', estrellas: 3, cliente: 'Leo', resena: 'x', estado: 'PENDIENTE_APROBAR' },
    { review_id: 'c', estrellas: 5, cliente: 'Sol', resena: 'x', estado: 'PENDIENTE_APROBAR' }];   // Apps Script la freno (salida sucia)
  const pool = baseBorradores(pend);
  const r = await N.borradoresSombra({ pool, claveClaude: 'k', fetch: claudeFalso(LIMPIA) }, 5);
  assert.strictEqual(r.redactadas, 3);
  assert.strictEqual(r.iguales, 2);
  assert.deepStrictEqual(r.publicaria_sola, ['c']);
  assert.deepStrictEqual(r.regla_rota, []);
  assert.strictEqual(r.alertas, 0);
  assert.strictEqual(pool.corridas.length, 1);
});

test('Sombra: con el tope del mes alcanzado no llama a Claude', async () => {
  const f = claudeFalso(LIMPIA);
  const r = await N.borradoresSombra({ pool: baseBorradores([{ review_id: 'a', estrellas: 5, estado: 'PUBLICADA_AUTO' }], 2.5), claveClaude: 'k', fetch: f }, 5);
  assert.strictEqual(r.redactadas, 0);
  assert.strictEqual(f.pedidos.length, 0);
});

test('Bloqueo con codigo (revisor de marca): frases copiadas, relleno, el nombre del dueño y otros idiomas van a aprobacion', async () => {
  const R = B.cargarReglas();
  const bloqueadas = [
    'Laura, el lomito tiene algo especial en la cocina. El equipo se alegra de saberlo. Pronto te vemos de regreso.',
    'Lauren, so glad you came. The bar team puts real care into every glass. See you soon.',
    'Ana, gracias por venir a nuestro restaurante y por tus palabras. Vuelve pronto.',
    'Ana, Juanma y el equipo se alegran de leerte. Gracias por venir. Vuelve pronto.',
    'Marco, il risotto ha fatto centro. Il team in sala si prende cura di ogni tavolo. Sarà un piacere rivederti presto.',
    'Claire, merci pour ce beau message. Nous sommes ravis. À bientôt.',
    'Sofía, gracias por tu visita y por dejarnos esta calificación. Esperamos verte pronto de regreso.',
    'Laura, el lomito es uno de los platos que más dedicación recibe en la cocina. Gracias por venir. Vuelve pronto.',
    'Laura, fue una noche memorable para el equipo. Gracias por venir. Vuelve pronto.'];
  bloqueadas.forEach((t) => assert.strictEqual(R.respuestaPublicable_(t), false, t));
  ['Ana, el risotto y la terraza al atardecer, qué buena combinación. Vuelve cuando quieras.',
    'Glad the cocktails stood out during your visit. The note about the music is helpful. Feel free to share more at restaurante@rosanta.rest.'
  ].forEach((t) => assert.strictEqual(R.respuestaPublicable_(t), true, t));
  const r = await B.redactar({ estrellas: 5, cliente: 'Marco', resena: 'Cena bellissima' }, { clave: 'k', fetch: claudeFalso(bloqueadas[4]) });
  assert.strictEqual(r.decision, 'aprobar');
});

test('Idioma de la reseña: solo español o inglés se publican solas', async () => {
  const R = B.cargarReglas();
  assert.strictEqual(R.resenaEnEspanolOIngles_('Cena bellissima, il risotto era perfetto e il servizio gentile.'), false);
  assert.strictEqual(R.resenaEnEspanolOIngles_('Sehr leckeres Essen und tolle Atmosphäre, wir kommen wieder.'), false);
  assert.strictEqual(R.resenaEnEspanolOIngles_('Très bon repas, merci beaucoup.'), false);
  assert.strictEqual(R.resenaEnEspanolOIngles_('La comida muy rica y el servicio excelente, tres veces hemos venido.'), true);
  assert.strictEqual(R.resenaEnEspanolOIngles_('Great cocktails but the music was a bit loud.'), true);
  assert.strictEqual(R.resenaEnEspanolOIngles_(''), true);
  // Respuesta limpia en ingles a una reseña en italiano: igual va a aprobacion
  const r = await B.redactar({ estrellas: 5, cliente: 'Marco', resena: 'Cena bellissima, il risotto era perfetto e il servizio gentile.' },
    { clave: 'k', fetch: claudeFalso('Marco, the risotto clearly made the night. Thanks for writing. Come back when you are in Antigua again.') });
  assert.strictEqual(r.decision, 'aprobar');
});
