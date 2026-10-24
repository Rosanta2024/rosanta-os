/**
 * Reproductor (19-oct-2026): le pasa al bot en sombra, en el mismo orden y a la misma hora, los
 * mensajes reales de un chat, y compara cada respuesta con lo que hizo el bot real.
 *
 * Dos modos:
 *   - 'grabado': Claude contesta lo mismo que contesto el bot real (sacado de Leads). Gratis.
 *     Prueba la tuberia: que el codigo calle donde callo, reserve donde reservo, avise a Juanma
 *     donde aviso, arme los botones y el bloque del pipeline, sin romperse.
 *   - 'modelo': Claude de verdad, con la base de conocimiento de hoy. Prueba las decisiones.
 *     Cuesta: solo los mensajes dentro del rango [desde, hasta) van al modelo; los de antes
 *     (contexto) van con el grabado.
 *
 * El historial que ve el modelo antes de cada mensaje es el REAL (lo que el cliente y el bot de
 * verdad se dijeron), no el de la sombra: asi cada mensaje se compara con el mismo punto de partida.
 */
const { crearMotor } = require('./motor-bot');
const { categoria } = require('./conversaciones');

const HIST_MS = 30 * 60 * 1000;   // el historial del bot vive 30 min en el cache (saveHistory)
const TICK_MS = 31 * 60 * 1000;
const RAFAGA_MS = 15 * 1000;    // mensajes del cliente a menos de 15 s: el bot real los atiende a la vez   // el bot retoma un chat a los 30 min sin que Juanma escriba

/** Lo que el bot real decidio, puesto como respuesta del modelo (modo grabado). */
function leadGrabado(real, nombreChat) {
  const r = real || {};
  const lead = { canal: '', idioma: r.idioma || 'es', nombre: r.nombreLead || nombreChat || '', telefono: '', email: r.email || '',
    fecha: '', fecha_actual: '', hora_actual: '', hora: '', personas: '', tipo_evento: '', formato_menu: '', presupuesto: '',
    // El tipo real de Leads (22-oct-2026): sin él, un evento que pasa a una persona se trataba como consulta y la sombra
    // se callaba en los mensajes siguientes (el bot real no se calla en eventos). Caso Ashley, 21-oct.
    opciones: [], mostrar_menu: false, tipo: r.tipoLead || 'consulta', urgencia: 'tibio', resumen: r.resumen || '', accion: 'responder_info',
    requiere_humano: !!r.humano };
  const res = String(r.resumen || '');
  // El resumen de una reserva ("Reserva creada en Wix: ...") lo escribe el codigo cuando Wix confirma: el modelo no lo trae.
  if (/^(Reserva (creada|CANCELADA|CAMBIADA)|Consultó su reserva)/.test(res)) lead.resumen = '';
  let m;
  switch (r.categoria) {
    case 'reserva_creada':
      m = res.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}), (\d+) personas/);
      Object.assign(lead, { accion: 'crear_reserva', tipo: 'reserva', fecha: m ? m[1] : '', hora: m ? m[2] : '', personas: m ? m[3] : '' });
      break;
    case 'reserva_cancelada':
      m = res.match(/(\d{4}-\d{2}-\d{2})/);
      Object.assign(lead, { accion: 'cancelar_reserva', tipo: 'reserva', fecha: m ? m[1] : '' });
      break;
    case 'reserva_cambiada':
      m = res.match(/(\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2}) → (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2}), (\d+) personas/);
      Object.assign(lead, { accion: 'cambiar_reserva', tipo: 'reserva', fecha_actual: m ? m[1] : '', hora_actual: m ? m[2] : '',
        fecha: m ? m[3] : '', hora: m ? m[4] : '', personas: m ? m[5] : '' });
      break;
    case 'reserva_consultada':
      Object.assign(lead, { accion: 'consultar_reserva', tipo: 'reserva' });
      break;
    case 'escalar_evento':
      Object.assign(lead, { accion: 'escalar_evento', tipo: 'evento', requiere_humano: true });
      break;
    case '':
      break;
    default:
      lead.accion = r.categoria;
  }
  return lead;
}

/** Un Wix de mentira con memoria por chat. Si piden consultar/cancelar/cambiar sin reserva conocida, supone una (el cliente reservo por la web). */
function crearWix(fijar) {
  const reservas = [];
  const supuesta = (p) => ({ fecha: p.fecha || p.fecha_actual || '2026-12-31', hora: p.hora_actual || '19:00', personas: 2, nombre: 'Cliente', email: p.email || '' });
  return function wix(ruta, p) {
    const forzado = fijar && fijar(ruta, p);
    if (forzado) return forzado;
    if (ruta === 'consultarBot') {
      const lista = reservas.length ? reservas : [supuesta(p)];
      return { code: 200, body: { ok: true, reservas: lista, nombre: lista[0].nombre } };
    }
    if (ruta === 'cancelarBot') {
      const c = reservas.pop() || supuesta(p);
      return { code: 200, body: { ok: true, cancelada: c } };
    }
    if (ruta === 'cambiarBot') {
      const antes = reservas.pop() || supuesta(p);
      const ahora = { fecha: p.fecha || antes.fecha, hora: p.hora || antes.hora, personas: p.personas || antes.personas };
      reservas.push(Object.assign({}, antes, ahora));
      return { code: 200, body: { ok: true, antes, ahora, nombre: antes.nombre, email: antes.email, vieja_cancelada: true, modo: 'modificada' } };
    }
    reservas.push({ fecha: p.fecha, hora: p.hora, personas: p.personas, nombre: [p.nombre, p.apellido].filter(Boolean).join(' '), email: p.email });
    return { code: 200, body: { ok: true, id: 'sombra-' + reservas.length } };
  };
}

/** El mensaje como lo manda Meta. Un "🔘 X" se manda como el boton X. */
function webhook(canal, id, nombre, texto, n) {
  const mid = 'sombra-' + id + '-' + n;
  const boton = String(texto).indexOf('🔘 ') === 0 ? String(texto).slice(3) : null;
  // 23-oct-2026: Conversaciones anota las fotos como "📷 [Foto] pie" o "📷 [Foto sin texto]". Se repiten como foto de verdad
  // (si no, la sombra las veía como texto y contestaba otra cosa que el bot real).
  const f = String(texto).match(/^📷 \[Foto(?: sin texto)?\]\s*(.*)$/);
  if (f) {
    const pie = (f[1] || '').trim();
    if (canal === 'whatsapp') {
      return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'wa-sombra' }, contacts: [{ profile: { name: nombre } }],
        messages: [{ id: mid, from: id, type: 'image', image: Object.assign({ id: 'foto-' + n, mime_type: 'image/jpeg' }, pie ? { caption: pie } : {}) }] } }] }] };
    }
    return { object: canal === 'instagram' ? 'instagram' : 'page', entry: [{ messaging: [{ sender: { id }, recipient: { id: 'rosanta' },
      message: Object.assign({ mid, attachments: [{ type: 'image', payload: { url: 'https://ejemplo.test/foto-' + n + '.jpg' } }] }, pie ? { text: pie } : {}) }] }] };
  }
  if (canal === 'whatsapp') {
    const msg = boton
      ? { id: mid, from: id, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'OPT|es|' + boton, title: boton } } }
      : { id: mid, from: id, type: 'text', text: { body: texto } };
    return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'wa-sombra' },
      contacts: [{ profile: { name: nombre } }], messages: [msg] } }] }] };
  }
  const message = boton ? { mid, text: boton, quick_reply: { payload: 'OPT|es|' + boton } } : { mid, text: texto };
  return { object: canal === 'instagram' ? 'instagram' : 'page', entry: [{ messaging: [{ sender: { id }, recipient: { id: 'rosanta' }, message }] }] };
}

/** El historial real antes del mensaje i (como lo habria tenido el bot de verdad), o null si ya habia vencido. */
function historiaReal(eventos, i) {
  let ultimoBot = -1;
  for (let j = i - 1; j >= 0; j--) if (eventos[j].tipo === 'bot') { ultimoBot = j; break; }
  if (ultimoBot < 0 || eventos[i].t - eventos[ultimoBot].t > HIST_MS) return null;
  const h = [];
  for (let j = 0; j < i; j++) {
    const e = eventos[j];
    if (e.tipo === 'cliente' && e.real && e.real.contesto) {
      h.push({ role: 'user', content: e.texto });
      h.push({ role: 'assistant', content: JSON.stringify({ respuesta: e.real.respuestaReal, lead: { accion: e.real.categoria || 'responder_info' } }) });
    }
  }
  return h.slice(-8);
}

/**
 * reproducirChat(chat, { modo, kb, claudeModelo }) → { turnos, seguimientos, errores }.
 * claudeModelo(cuerpo, aux) → { code, body } (solo en modo 'modelo').
 */
function reproducirChat(chat, opciones) {
  const o = opciones || {};
  let turno = null;   // el mensaje que se esta reproduciendo
  const claude = (cuerpo, aux) => {
    if (o.modo === 'modelo' && turno && turno.enRango) return o.claudeModelo(cuerpo, aux);
    const real = turno && turno.real;
    if (!real || !real.contesto) {
      if (turno) turno.sinGrabado = true;   // el real no contesto: no hay nada que imitar
      return { code: 200, body: { model: 'grabado', content: [{ type: 'text', text: JSON.stringify({ respuesta: '(sin respuesta grabada)', lead: leadGrabado({}, chat.nombre) }) }] } };
    }
    const lead = leadGrabado(real, chat.nombre);
    return { code: 200, body: { model: 'grabado', content: [{ type: 'text', text: JSON.stringify({ respuesta: real.respuestaReal, lead }) }] } };
  };
  const motor = crearMotor({ claude, wix: crearWix(), kb: o.kb || '', nombresIg: { [chat.id]: chat.nombre } });
  const turnos = [], seguimientos = [], errores = [];
  const ev = chat.eventos;
  let tPrevio = null;
  let humAntesPrevio = null;   // estado 'hum_' antes del mensaje anterior del cliente

  const tick = (t) => {
    motor.reloj.poner(t);
    const antes = motor.envios.length;
    try { motor.ctx.enviarRespuestasPendientes(); } catch (e) { errores.push('trigger: ' + e.message); }
    motor.envios.slice(antes).forEach((s) => { if (s.a === chat.id) seguimientos.push({ t, sombra: true, texto: s.texto }); });
  };

  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (tPrevio !== null && e.t - tPrevio > TICK_MS) tick(tPrevio + TICK_MS);
    if (tPrevio !== null) tick(e.t - 1000);
    tPrevio = e.t;
    motor.reloj.poner(e.t);
    if (e.tipo === 'bot') {
      if (e.seguimiento) seguimientos.push({ t: e.t, real: true, texto: e.texto });
      continue;
    }
    if (e.tipo === 'humano') {
      const sal = motor.libros.leads.Salientes;
      sal.push([new Date(e.t), chat.canal, chat.id, e.texto, 'libre', '']);
      try { motor.ctx.enviarRespuestasPendientes(); } catch (x) { errores.push('humano: ' + x.message); }
      continue;
    }
    // Mensaje del cliente
    const h = historiaReal(ev, i);
    if (h) motor.ctx.CacheService.getScriptCache().put('hist_' + chat.id, JSON.stringify(h), 1800);
    else motor.ctx.CacheService.getScriptCache().remove('hist_' + chat.id);
    // Dos mensajes seguidos del cliente (antes de que el bot conteste) los atiende el bot real EN PARALELO:
    // el segundo ve el estado de antes del primero. Se imita eso con el estado "pasar a Juanma".
    const clave = 'hum_' + chat.id;
    const enRafaga = i > 0 && ev[i - 1].tipo === 'cliente' && e.t - ev[i - 1].t <= RAFAGA_MS;
    const humTrasPrevio = motor.props.has(clave) ? motor.props.get(clave) : null;
    if (enRafaga) { if (humAntesPrevio === null) motor.props.delete(clave); else motor.props.set(clave, humAntesPrevio); }
    else humAntesPrevio = humTrasPrevio;
    turno = { enRango: e.enRango, real: e.real };
    const n0 = { envios: motor.envios.length, leads: motor.libros.leads.Leads.length, correos: motor.correos.length, wix: motor.wixLlamadas.length, claude: motor.claudePedidos.length };
    try { motor.recibir(webhook(chat.canal, chat.id, chat.nombre, e.texto, i)); } catch (x) { errores.push('mensaje ' + i + ': ' + x.message); }
    if (enRafaga && humTrasPrevio !== null && !motor.props.has(clave)) motor.props.set(clave, humTrasPrevio);
    const envs = motor.envios.slice(n0.envios).filter((s) => s.a === chat.id);
    const leadsNuevos = motor.libros.leads.Leads.slice(Math.max(n0.leads, 1)).filter((r) => String(r[11]) === chat.id);
    const ult = leadsNuevos[leadsNuevos.length - 1];
    const correos = motor.correos.slice(n0.correos);
    const sombra = {
      contesto: envs.length > 0,
      respuesta: envs.map((s) => s.texto).join('\n'),
      botones: envs.reduce((a, s) => a.concat(s.botones || []), []),
      categoria: ult ? categoria(ult[8], ult[7]) : '',
      humano: ult ? ult[9] === 'Sí' : null,
      idioma: ult ? String(ult[2] || '') : '',
      avisoJuanma: correos.some((c) => /Lead para atender/.test(c.asunto || '')),
      pipeline: correos.some((c) => /DATOS_PIPELINE/.test(c.cuerpo || '')),
      wix: motor.wixLlamadas.slice(n0.wix).map((w) => w.ruta),
      usoModelo: motor.claudePedidos.length > n0.claude,
      sinGrabado: !!turno.sinGrabado
    };
    if (e.enRango) turnos.push({ t: e.t, i, cliente: e.texto, real: e.real, sombra });
  }
  return { canal: chat.canal, id: chat.id, nombre: chat.nombre, turnos, seguimientos, errores, logs: motor.logs.filter((l) => /error|excepci|Error/.test(l)).slice(0, 20) };
}

/** Compara un turno: lo que importa para el cliente y para Juanma. */
function compararTurno(t) {
  const r = t.real || {}, s = t.sombra;
  const dif = [];
  if (r.contesto !== s.contesto) dif.push(r.contesto ? 'la sombra no contestó' : 'la sombra contestó y el bot real no');
  if (r.contesto && s.contesto) {
    if (r.categoria && s.categoria && r.categoria !== s.categoria) dif.push('acción: real ' + r.categoria + ' · sombra ' + s.categoria);
    if (r.humano !== null && s.humano !== null && r.humano !== s.humano) dif.push(r.humano ? 'el real pasó el chat a Juanma y la sombra no' : 'la sombra pasó el chat a Juanma y el real no');
    if (r.idioma && s.idioma && r.idioma !== s.idioma) dif.push('idioma: real ' + r.idioma + ' · sombra ' + s.idioma);
  }
  return dif;
}

function resumir(resultados) {
  const out = { chats: resultados.length, turnos: 0, iguales: 0, contesto: { igual: 0, total: 0 }, accion: { igual: 0, total: 0 },
    juanma: { igual: 0, total: 0 }, reservas: { real: 0, sombra: 0 }, errores: 0, diferencias: [] };
  resultados.forEach((c) => {
    out.errores += c.errores.length;
    c.turnos.forEach((t) => {
      out.turnos++;
      const r = t.real || {}, s = t.sombra;
      out.contesto.total++; if (r.contesto === s.contesto) out.contesto.igual++;
      if (r.contesto && s.contesto && r.categoria && s.categoria) { out.accion.total++; if (r.categoria === s.categoria) out.accion.igual++; }
      if (r.contesto && s.contesto && r.humano !== null && s.humano !== null) { out.juanma.total++; if (r.humano === s.humano) out.juanma.igual++; }
      if (r.categoria === 'reserva_creada') out.reservas.real++;
      if (s.categoria === 'reserva_creada') out.reservas.sombra++;
      const dif = compararTurno(t);
      if (!dif.length) out.iguales++;
      else out.diferencias.push({ chat: c.id, canal: c.canal, t: t.t, cliente: String(t.cliente).slice(0, 300), dif,
        real: String(r.respuestaReal || '').slice(0, 500), sombra: String(s.respuesta || '').slice(0, 500) });
    });
  });
  return out;
}

module.exports = { reproducirChat, compararTurno, resumir, leadGrabado, crearWix, webhook, historiaReal };
