#!/usr/bin/env node
/**
 * Batería del bot (evals), 19-oct-2026. Corre los casos de casos.json contra el CÓDIGO REAL del bot
 * (apps-script/bot-rosanta) con el motor de la sombra (cloud/bot/src/motor-bot.js: Meta, Wix, Claude, correo y
 * hojas imitados; nada sale a nadie) y califica cada regla.
 *
 *   node tools/bot-evals/correr.js                       modo grabado: gratis, sin red, determinista
 *   node tools/bot-evals/correr.js --comparar tools/bot-evals/linea-base.json
 *                                                        sale con código 1 si algo que pasaba ahora falla
 *   ANTHROPIC_SOMBRA=… node tools/bot-evals/correr.js --juez --kb kb.txt
 *                                                        + juez (Haiku) para tono y fidelidad a la base
 *   ANTHROPIC_SOMBRA=… node tools/bot-evals/correr.js --modo modelo --juez --kb kb.txt --max-usd 1
 *                                                        el modelo de verdad contesta los turnos evaluados
 *
 * Modos:
 *   grabado  Claude "contesta" lo que contestó el bot real en ese chat (o lo reconstruido en el caso). Prueba el
 *            código de la versión que se va a publicar: cuándo se calla, cuándo pasa a Juanma, Wix, botones.
 *            Las reglas de texto califican la respuesta que de verdad recibió el cliente.
 *   modelo   Claude de verdad, con la base de conocimiento de hoy, en los turnos evaluados. Prueba el prompt.
 *            Solo con la clave de la sombra (variable ANTHROPIC_SOMBRA); pensado para correr en la nube.
 *
 * Opciones: --bot <carpeta> (por defecto apps-script/bot-rosanta) · --motor <carpeta con motor-bot.js>
 *           --casos <json> · --solo ID,ID · --kb <txt> · --juez · --max-usd N (tope de gasto, por defecto 1)
 *           --salida <json> · --etiqueta "@58" · --comparar <json> · --detalle
 * La clave nunca se imprime ni se guarda: va por variable de entorno a un proceso aparte (fetchSincrono).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('./reglas');
const { crearJuez } = require('./juez');

const RAIZ = path.resolve(__dirname, '..', '..');
const PRECIO_BOT = { entrada: 2 / 1e6, salida: 10 / 1e6 };   // claude-sonnet-5-5 (el modelo del bot), US$ por token

// ---------- argumentos ----------
const A = process.argv.slice(2);
const arg = (k, def) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : def; };
const tiene = (k) => A.includes(k);
const op = {
  bot: path.resolve(RAIZ, arg('--bot', 'apps-script/bot-rosanta')),
  motor: arg('--motor', ''),
  casos: path.resolve(arg('--casos', path.join(__dirname, 'casos.json'))),
  solo: (arg('--solo', '') || '').split(',').filter(Boolean),
  kb: arg('--kb', ''),
  juez: tiene('--juez'),
  modo: arg('--modo', 'grabado'),
  maxUsd: Number(arg('--max-usd', '1')),
  salida: arg('--salida', ''),
  etiqueta: arg('--etiqueta', ''),
  comparar: arg('--comparar', ''),
  detalle: tiene('--detalle')
};
const CLAVE = process.env.ANTHROPIC_SOMBRA || '';
if ((op.juez || op.modo === 'modelo') && !CLAVE) {
  console.error('Sin la clave de la sombra (ANTHROPIC_SOMBRA) no corre ni el juez ni el modo modelo. Corre sin --juez y en modo grabado, o en la nube.');
  process.exit(3);
}
if (op.juez && !op.kb) { console.error('El juez necesita la base de conocimiento: --kb <archivo de texto>.'); process.exit(3); }

// ---------- motor de la sombra ----------
function buscarMotor() {
  const cand = [];
  if (op.motor) cand.push(path.resolve(op.motor));
  cand.push(path.join(RAIZ, 'cloud', 'bot', 'src'));
  try {   // mientras la sombra no esté en main: el worktree de la rama claude/nube-bot-sombra (solo se lee)
    const wt = execFileSync('git', ['-C', RAIZ, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
    wt.split('\n\n').forEach((b) => { const m = b.match(/^worktree (.+)$/m); if (m && /branch refs\/heads\/claude\/nube-bot-sombra$/m.test(b)) cand.push(path.join(m[1], 'cloud', 'bot', 'src')); });
  } catch (e) { /* sin git: solo las rutas de arriba */ }
  const ok = cand.find((d) => ['motor-bot.js', 'reproductor.js', 'conversaciones.js'].every((f) => fs.existsSync(path.join(d, f))));
  if (!ok) { console.error('No encuentro el motor de la sombra (cloud/bot/src/motor-bot.js). Pásalo con --motor.'); process.exit(3); }
  return ok;
}
/** El motor carga el bot de ../bot-rosanta: se copia a una carpeta temporal con un enlace al bot que se quiere probar. */
function prepararMotor(src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-evals-'));
  fs.mkdirSync(path.join(tmp, 'src'));
  ['motor-bot.js', 'reproductor.js', 'conversaciones.js'].forEach((f) => fs.copyFileSync(path.join(src, f), path.join(tmp, 'src', f)));
  fs.symlinkSync(op.bot, path.join(tmp, 'bot-rosanta'), 'dir');
  const motor = require(path.join(tmp, 'src', 'motor-bot.js'));
  const rep = require(path.join(tmp, 'src', 'reproductor.js'));
  const nuevos = fs.readdirSync(op.bot).filter((f) => /\.(js|gs)$/.test(f) && !motor.ARCHIVOS.includes(f) && f !== 'PruebaEscaladas.js');
  return { motor, rep, tmp, nuevos };
}

function versionBot() {
  let commit = '';
  try { commit = execFileSync('git', ['-C', RAIZ, 'log', '-1', '--format=%h %cs', '--', op.bot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { /* */ }
  let sucio = false;
  try { sucio = !!execFileSync('git', ['-C', RAIZ, 'status', '--porcelain', '--', op.bot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { /* */ }
  return (op.etiqueta ? op.etiqueta + ' · ' : '') + commit + (sucio ? ' + cambios sin commit' : '');
}

// ---------- un caso ----------
function correrCaso(caso, n, M, ctx) {
  const { crearMotor, fetchSincrono } = M.motor;
  const { leadGrabado, crearWix, webhook, historiaReal } = M.rep;
  const id = caso.canal === 'whatsapp' ? '5025559' + String(n).padStart(4, '0') : caso.canal === 'correo' ? (caso.correo || 'cliente' + n + '@ejemplo.test')
    : '99999000' + String(n).padStart(4, '0');
  // caso.wix: { ruta: cuerpo } fija lo que contesta Wix (p. ej. que con esa dirección no hay reserva).
  const wixBase = crearWix(caso.wix ? (ruta) => (caso.wix[ruta] ? { code: 200, body: caso.wix[ruta] } : null) : undefined);
  const salCorreo = { respuestas: [], borradores: [] };
  const wixLog = [];
  const wix = (ruta, p) => { const r = wixBase(ruta, p); wixLog.push({ ruta, ok: r.code < 300 && !(r.body && r.body.ok === false) }); return r; };
  let turno = null;
  const respuestaClaude = (respuesta, lead) => ({ code: 200, body: { model: 'grabado', content: [{ type: 'text', text: JSON.stringify({ respuesta, lead }) }] } });
  const claude = (cuerpo, aux) => {
    if (op.modo === 'modelo' && turno && turno.evaluar) return ctx.claudeModelo(cuerpo, aux);
    const g = turno && turno.grabado;
    if (!g || !g.respuesta) { if (turno) turno.sinGrabado = true; return respuestaClaude('(sin respuesta grabada)', leadGrabado({}, caso.perfil)); }
    const lead = Object.assign(leadGrabado(Object.assign({}, g, { nombreLead: g.nombre }), caso.perfil), g.lead || {});
    return respuestaClaude(g.respuesta, lead);
  };
  const motor = crearMotor({ claude, wix, kb: ctx.kb || '', nombresIg: { [id]: caso.perfil } });
  const cache = motor.ctx.CacheService.getScriptCache();
  if (caso.estado === 'pausa_app') cache.put('pausa_' + id, '1', 21600);   // Juanma escribió desde la app (eco de Meta)

  // Formato del reproductor, para armar el historial real de cada mensaje.
  const ev = caso.eventos.map((e) => ({ t: Date.parse(e.t), tipo: e.de === 'cliente' ? 'cliente' : e.de === 'juanma' ? 'humano' : 'bot', texto: e.texto,
    real: e.de === 'cliente' ? { contesto: !!(e.grabado && e.grabado.respuesta), respuestaReal: (e.grabado && e.grabado.respuesta) || '', categoria: (e.grabado && e.grabado.categoria) || '' } : undefined }));
  const turnos = [];
  const errores = [];
  let tPrevio = null, humAntesPrevio = null;
  const tick = (t) => { motor.reloj.poner(t); try { motor.ctx.enviarRespuestasPendientes(); } catch (e) { errores.push('reloj: ' + e.message); } };

  caso.eventos.forEach((e, i) => {
    const t = ev[i].t;
    if (tPrevio !== null && t - tPrevio > 31 * 60000) tick(tPrevio + 31 * 60000);
    if (tPrevio !== null) tick(t - 1000);
    tPrevio = t;
    motor.reloj.poner(t);
    if (e.de === 'bot') return;
    if (e.de === 'juanma') {   // Juanma contesta desde la consola (Salientes) y el bot se entera
      motor.libros.leads.Salientes.push([new Date(t), caso.canal, id, e.texto, 'libre', '']);
      try { motor.ctx.enviarRespuestasPendientes(); } catch (x) { errores.push('juanma: ' + x.message); }
      return;
    }
    // Mensaje del cliente
    if (e.de === 'cliente' && !e.foto) {
      const h = historiaReal(ev, i);
      if (h) cache.put('hist_' + id, JSON.stringify(h), 1800); else cache.remove('hist_' + id);
    }
    // Ráfaga: dos mensajes del cliente a menos de 15 s los atiende el bot real en paralelo (el segundo ve el estado de antes del primero).
    const clave = 'hum_' + id;
    const enRafaga = i > 0 && caso.eventos[i - 1].de === 'cliente' && t - ev[i - 1].t <= 15000;
    const humTras = motor.props.has(clave) ? motor.props.get(clave) : null;
    if (enRafaga) { if (humAntesPrevio === null) motor.props.delete(clave); else motor.props.set(clave, humAntesPrevio); } else humAntesPrevio = humTras;

    turno = { evaluar: !!e.reglas, grabado: e.grabado || null, sinGrabado: false };
    const n0 = { envios: motor.envios.length, leads: motor.libros.leads.Leads.length, correos: motor.correos.length, wix: wixLog.length,
      conv: motor.libros.leads.Conversaciones.length, logs: motor.logs.length, claude: motor.claudePedidos.length };
    const errTurno = [];
    const c0 = { r: salCorreo.respuestas.length, b: salCorreo.borradores.length };
    try {
      if (caso.canal === 'correo') correoRecibir(motor, id, caso.perfil, e.texto, t, i, salCorreo);
      else motor.recibir(e.foto ? webhookFoto(caso.canal, id, caso.perfil, e.texto, i) : webhook(caso.canal, id, caso.perfil, e.texto, i));
    } catch (x) { errTurno.push('mensaje ' + i + ': ' + x.message); }
    if (enRafaga && humTras !== null && !motor.props.has(clave)) motor.props.set(clave, humTras);
    if (!e.reglas) { errores.push(...errTurno); return; }

    // Por correo "contestó" = salió la respuesta sola; un borrador no le llega al cliente (Juanma tiene que mandarlo).
    const envs = caso.canal === 'correo' ? salCorreo.respuestas.slice(c0.r).map((b) => ({ a: id, texto: b }))
      : motor.envios.slice(n0.envios).filter((s) => s.a === id);
    const borradores = salCorreo.borradores.slice(c0.b);
    const leadsN = motor.libros.leads.Leads.slice(Math.max(n0.leads, 1)).filter((r) => String(r[11]) === id);
    const ult = leadsN[leadsN.length - 1];
    const correos = motor.correos.slice(n0.correos);
    const res = {
      cliente: e.texto || (e.foto ? '(foto)' : ''), canal: caso.canal, t: e.t,
      clienteTodo: caso.eventos.slice(0, i + 1).filter((x) => x.de === 'cliente').map((x) => x.texto || '').join('\n'),
      contesto: envs.length > 0,
      respuesta: envs.map((s) => s.texto).concat(borradores).join('\n'),
      borrador: borradores.length > 0,
      botones: envs.reduce((a, s) => a.concat(s.botones || []), []),
      categoria: ult ? M.rep.categoriaDe(ult[8], ult[7]) : '',
      humano: ult ? ult[9] === 'Sí' : null,
      idiomaCliente: (e.grabado && e.grabado.idioma) || R.idiomaDe(e.texto),
      avisoJuanma: correos.some((c) => /Lead para atender/.test(c.asunto || '')),
      pipeline: correos.some((c) => /PARA COTIZAR|DATOS_PIPELINE/.test(c.cuerpo || '')),
      wix: wixLog.slice(n0.wix),
      conversacionRegistrada: motor.libros.leads.Conversaciones.slice(n0.conv).some((r) => String(r[2]) === id && r[4] === 'in'),
      usoModelo: motor.claudePedidos.length > n0.claude,
      sinGrabado: turno.sinGrabado && op.modo !== 'modelo',
      errores: errTurno,
      logsError: motor.logs.slice(n0.logs).filter((l) => /error|excepci|no previsto/i.test(l)).slice(0, 5)
    };
    const reglas = R.evaluar(res, e.reglas, ctx);
    // Juez: los criterios subjetivos de este turno, en una sola llamada.
    const ids = reglas.filter((r) => r.clase === 'juez').map((r) => r.criterio);
    if (ids.length && ctx.juzgar) {
      if (!res.contesto || res.sinGrabado) reglas.filter((r) => r.clase === 'juez').forEach((r) => { r.detalle = res.contesto ? 'sin respuesta grabada' : 'no contestó'; });
      else {
        const v = ctx.juzgar({ ids, kb: ctx.kb, canal: caso.canal, t: e.t, cliente: res.cliente, respuesta: res.respuesta,
          contexto: caso.eventos.slice(0, i).filter((x) => x.texto).map((x) => ({ de: x.de, texto: x.texto })) });
        reglas.filter((r) => r.clase === 'juez').forEach((r) => {
          if (!v) r.detalle = 'sin cupo para el juez';
          else if (v._error) r.detalle = 'juez: ' + v._error;
          else if (v[r.criterio]) { r.ok = v[r.criterio].ok; r.detalle = v[r.criterio].ok ? '' : v[r.criterio].motivo; }
        });
      }
    }
    turnos.push({ i, cliente: R.corto(res.cliente), respuesta: res.respuesta, categoria: res.categoria, humano: res.humano, wix: res.wix.map((w) => w.ruta), reglas });
  });
  return { id: caso.id, grupo: caso.grupo, titulo: caso.titulo, turnos, errores };
}

/** Un correo del cliente, por el camino real del canal de correo (revisarCorreosClientes con Gmail imitado). */
function correoRecibir(motor, email, nombre, texto, t, n, sal) {
  const msg = { getId: () => 'eval-' + email + '-' + n, getFrom: () => '"' + nombre + '" <' + email + '>', getPlainBody: () => texto,
    getSubject: () => 'Reservation', getDate: () => new Date(t), isDraft: () => false,
    reply: (b) => sal.respuestas.push(b), createDraftReply: (b) => sal.borradores.push(b) };
  motor.ctx.GmailApp.search = () => [{ getId: () => 'hilo-' + email, getMessages: () => [msg] }];
  motor.props.set('CORREO_DESDE', String(t - 60000));
  motor.props.set('CORREO_RED_ULTIMA', String(t));   // la red de cada hora no corre en la batería
  motor.ctx.revisarCorreosClientes();
}

function webhookFoto(canal, id, nombre, texto, n) {
  const mid = 'eval-' + id + '-' + n;
  if (canal === 'whatsapp') {
    return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'wa-sombra' }, contacts: [{ profile: { name: nombre } }],
      messages: [{ id: mid, from: id, type: 'image', image: Object.assign({ id: 'foto-' + n, mime_type: 'image/jpeg' }, texto ? { caption: texto } : {}) }] } }] }] };
  }
  return { object: canal === 'instagram' ? 'instagram' : 'page', entry: [{ messaging: [{ sender: { id }, recipient: { id: 'rosanta' },
    message: Object.assign({ mid, attachments: [{ type: 'image', payload: { url: 'https://ejemplo.test/foto-' + n + '.jpg' } }] }, texto ? { text: texto } : {}) }] }] };
}

// ---------- resumen ----------
function resumir(resultados) {
  const r = { casos: resultados.length, casosOk: 0, reglas: { ok: 0, falla: 0, sinDato: 0, pendientes: 0 }, porGrupo: {}, porRegla: {}, porClase: {}, fallas: [], pendientes: [] };
  resultados.forEach((c) => {
    const g = r.porGrupo[c.grupo] = r.porGrupo[c.grupo] || { casos: 0, casosOk: 0, ok: 0, falla: 0 };
    g.casos++;
    let fallo = false;
    c.turnos.forEach((t) => t.reglas.forEach((x) => {
      const pr = r.porRegla[x.regla.split(':')[0]] = r.porRegla[x.regla.split(':')[0]] || { ok: 0, falla: 0 };
      if (x.pendiente) { r.reglas.pendientes++; r.pendientes.push({ caso: c.id, turno: t.i, regla: x.regla, ok: x.ok, detalle: x.detalle }); return; }
      const pc = r.porClase[x.clase] = r.porClase[x.clase] || { ok: 0, falla: 0 };
      if (x.ok === true) { r.reglas.ok++; g.ok++; pr.ok++; pc.ok++; } else if (x.ok === false) {
        r.reglas.falla++; g.falla++; pr.falla++; pc.falla++; fallo = true;
        r.fallas.push({ caso: c.id, grupo: c.grupo, turno: t.i, regla: x.regla, critica: x.critica, clase: x.clase, detalle: x.detalle, cliente: t.cliente, respuesta: R.corto(t.respuesta) });
      } else r.reglas.sinDato++;
    }));
    if (c.errores.length) fallo = true;
    if (!fallo) { r.casosOk++; g.casosOk++; }
  });
  const ev = r.reglas.ok + r.reglas.falla;
  r.puntaje = ev ? Math.round(1000 * r.reglas.ok / ev) / 10 : 0;
  return r;
}

function comparar(actual, base) {
  const k = (c, t, x) => c.id + '#' + t.i + '#' + x.regla;
  const antes = new Map();
  base.resultados.forEach((c) => c.turnos.forEach((t) => t.reglas.forEach((x) => antes.set(k(c, t, x), x.ok))));
  const regresiones = [], mejoras = [];
  actual.forEach((c) => c.turnos.forEach((t) => t.reglas.forEach((x) => {
    const b = antes.get(k(c, t, x));
    if (x.pendiente) return;
    if (b === true && x.ok === false) regresiones.push({ caso: c.id, turno: t.i, regla: x.regla, critica: x.critica, detalle: x.detalle, respuesta: R.corto(t.respuesta) });
    if (b === false && x.ok === true) mejoras.push({ caso: c.id, turno: t.i, regla: x.regla });
  })));
  return { regresiones, mejoras };
}

// ---------- principal ----------
function main() {
  const src = buscarMotor();
  const M = prepararMotor(src);
  M.rep.categoriaDe = require(path.join(M.tmp, 'src', 'conversaciones.js')).categoria;
  const datos = JSON.parse(fs.readFileSync(op.casos, 'utf8'));
  const casos = datos.casos.filter((c) => !op.solo.length || op.solo.includes(c.id));
  const kb = op.kb ? fs.readFileSync(op.kb, 'utf8') : '';
  const precios = kb ? R.preciosDeKb(kb) : JSON.parse(fs.readFileSync(path.join(__dirname, 'precios-base.json'), 'utf8')).precios;
  const gastoBot = { llamadas: 0, entrada: 0, salida: 0, usd: 0, fallas: 0 };
  const gastoJuez = { llamadas: 0, entrada: 0, salida: 0, usd: 0 };
  const sinCupo = () => gastoBot.usd + gastoJuez.usd >= op.maxUsd;
  const ctx = { precios, kb };
  if (op.modo === 'modelo') {
    ctx.claudeModelo = (cuerpo, aux) => {
      if (sinCupo()) return { code: 529, body: { error: { message: 'tope de gasto de la batería' } } };
      const r = M.motor.fetchSincrono('https://api.anthropic.com/v1/messages', { method: 'post', headers: aux.headers, payload: JSON.stringify(cuerpo) }, { CLAVE_HIJO: CLAVE });
      let body = r.t;
      try { body = JSON.parse(r.t); if (body.usage) { gastoBot.llamadas++; gastoBot.entrada += body.usage.input_tokens || 0; gastoBot.salida += body.usage.output_tokens || 0; gastoBot.usd = gastoBot.entrada * PRECIO_BOT.entrada + gastoBot.salida * PRECIO_BOT.salida; } } catch (e) { /* el bot maneja la respuesta rota */ }
      if (r.c !== 200) gastoBot.fallas++;
      return { code: r.c, body };
    };
  }
  if (op.juez) ctx.juzgar = crearJuez({ fetchSincrono: M.motor.fetchSincrono, clave: CLAVE, gasto: gastoJuez, sinCupo });

  const t0 = Date.now();
  const resultados = casos.map((c, n) => correrCaso(c, n + 1, M, ctx));
  const resumen = resumir(resultados);
  const salida = { fecha: new Date().toISOString(), version: versionBot(), modo: op.modo, juez: op.juez, casosArchivo: path.relative(RAIZ, op.casos),
    motor: path.relative(RAIZ, src) || src, segundos: Math.round((Date.now() - t0) / 100) / 10,
    gasto: { bot: gastoBot, juez: gastoJuez, totalUsd: Math.round(1e4 * (gastoBot.usd + gastoJuez.usd)) / 1e4 }, resumen, resultados };
  if (M.nuevos.length) salida.aviso = 'El bot tiene archivos que el motor no carga: ' + M.nuevos.join(', ') + ' (actualizar ARCHIVOS en motor-bot.js).';
  let cmp = null;
  if (op.comparar) { cmp = comparar(resultados, JSON.parse(fs.readFileSync(op.comparar, 'utf8'))); salida.comparacion = cmp; }
  if (op.salida) fs.writeFileSync(op.salida, JSON.stringify(salida, null, 1) + '\n');
  fs.rmSync(M.tmp, { recursive: true, force: true });

  // Informe corto, en español
  const L = [];
  L.push('Batería del bot · ' + salida.version + ' · modo ' + op.modo + (op.juez ? ' + juez' : '') + ' · ' + salida.segundos + ' s');
  L.push('Puntaje: ' + resumen.puntaje + '% de las reglas (' + resumen.reglas.ok + ' pasan, ' + resumen.reglas.falla + ' fallan, ' + resumen.reglas.sinDato + ' sin dato' + (resumen.reglas.pendientes ? ', ' + resumen.reglas.pendientes + ' pendientes de decisión' : '') + ')');
  const NOMBRE_CLASE = { flujo: 'flujo (lo que hace el código: callarse, pasar a Juanma, Wix)', texto: 'texto (lo que dice la respuesta' + (op.modo === 'grabado' ? ' que recibió el cliente real' : '') + ')', juez: 'juez (tono, fiel a la base)' };
  Object.entries(resumen.porClase).forEach(([k, v]) => L.push('  ' + (NOMBRE_CLASE[k] || k) + ': ' + v.ok + ' ok, ' + v.falla + ' fallas'));
  L.push('Casos sin ninguna falla: ' + resumen.casosOk + ' de ' + resumen.casos);
  Object.entries(resumen.porGrupo).forEach(([g, v]) => L.push('  ' + g.padEnd(22) + v.casosOk + '/' + v.casos + ' casos · ' + v.ok + ' ok, ' + v.falla + ' fallas'));
  if (salida.gasto.totalUsd) L.push('Gasto: US$' + salida.gasto.totalUsd + ' (bot ' + gastoBot.llamadas + ' llamadas, juez ' + gastoJuez.llamadas + ')');
  if (salida.aviso) L.push('AVISO: ' + salida.aviso);
  const errs = resultados.filter((c) => c.errores.length);
  if (errs.length) L.push('ERRORES al reproducir: ' + errs.map((c) => c.id + ' ' + c.errores[0]).join(' | '));
  if (resumen.fallas.length) {
    L.push('', 'Fallas' + (op.detalle ? '' : ' (las críticas primero; --detalle para ver la respuesta)') + ':');
    resumen.fallas.slice().sort((a, b) => b.critica - a.critica).forEach((f) => {
      L.push('  ' + (f.critica ? '!! ' : '   ') + f.caso + ' #' + f.turno + ' ' + f.regla + ' — ' + f.detalle);
      if (op.detalle) L.push('       cliente: ' + f.cliente + '\n       bot: ' + f.respuesta);
    });
  }
  if (cmp) {
    L.push('', 'Contra ' + op.comparar + ': ' + cmp.regresiones.length + ' regresiones, ' + cmp.mejoras.length + ' mejoras');
    cmp.regresiones.forEach((x) => L.push('  ' + (x.critica ? '!! ' : '   ') + x.caso + ' #' + x.turno + ' ' + x.regla + ' — ' + x.detalle));
    cmp.mejoras.forEach((x) => L.push('   + ' + x.caso + ' #' + x.turno + ' ' + x.regla));
  }
  console.log(L.join('\n'));
  if (cmp && cmp.regresiones.length) process.exit(1);
  if (errs.length) process.exit(2);
}

main();
