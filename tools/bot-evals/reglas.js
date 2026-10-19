/**
 * Reglas de la batería del bot (19-oct-2026). Cada regla mira lo que hizo el bot en UN mensaje del cliente
 * (`turno`, ver correr.js) y devuelve { ok: true | false | null, detalle }. null = no se puede decir
 * (por ejemplo, una regla de texto en un mensaje sin respuesta grabada): no suma ni resta.
 *
 * Clases:
 *   flujo  — lo que hizo el código: si contestó, si pasó el chat a Juanma, si tocó Wix.
 *   texto  — lo que dice la respuesta, revisado con reglas fijas (precios, frases prohibidas, idioma).
 *   juez   — lo subjetivo (tono, fiel a la base). Lo califica Claude en juez.js; aquí solo se declara.
 * Críticas: si una de estas empeora respecto de la línea base, la batería frena la publicación.
 */

const CRITICAS = new Set(['se_calla', 'pasa_a_juanma', 'avisa_a_juanma', 'no_inventa_precios', 'no_confirma_sin_sistema', 'no_confirma_pago',
  'no_rompe', 'no_cancela', 'no_crea_reserva', 'crea_reserva', 'no_promete_disponibilidad', 'no_nombra_a_juanma']);

const RE = {
  prohibidas: /en breve|alguien del equipo|a la brevedad|persona del equipo|someone (from|on) (the|our) team|\bshortly\b/i,
  confirma: new RegExp([
    '(reserva|mesa|booking|reservation)[^.!?\\n]{0,40}\\b(queda|qued[oó]|est[aá]|ya)\\b[^.!?\\n]{0,15}(confirmad|hech|apartad|cambiad|cancelad|actualizad|lista\\b)',
    '\\b(is|are) (confirmed|booked|all set)', "\\byou('re| are) all set", "\\bwe('ll| will) (update|change|move|add)",
    '\\b(ya )?(te )?(la |lo )?(cambi[eé]|mov[ií]|actualic[eé])\\b', '\\bya qued[oó] (cambiada|cancelada|confirmada)'].join('|'), 'i'),
  disponible: /(s[ií] )?(hay|tenemos) (mesa|lugar|espacio|disponibilidad)|ya est[aá] disponible|est[aá] disponible|queda perfect[oa]|\bwe have (a table|availability|space|room)\b|works (just )?(fine|perfectly)|\b(is|are) available\b/i,
  otroCanal: /\bll[aá]m(a|ar|anos|en|ando)\b|\bcall (us|the restaurant)\b|\(502\)|7768|\b(by|via) phone\b/i,
  compensa: /descuento|cortes[ií]a|compensa|reembols|\bgratis\b|te invitamos|\bdiscount|\brefund|complimentary|on the house/i,
  pagoRecibido: /recib(imos|ido) (tu|el|su) (pago|transferencia|dep[oó]sito)|pago (recibido|confirmado)|transferencia (recibida|confirmada)|payment (received|confirmed)/i,
  correo: /correo|e-?mail/i
};

const ES = ['que', 'el', 'la', 'los', 'las', 'para', 'con', 'tu', 'te', 'una', 'por', 'del', 'está', 'gracias', 'hola', 'mesa', 'reserva', 'aquí', 'claro', 'cuando', 'nos', 'hoy', 'mañana', 'necesito', 'tienes', 'puedo', 'es', 'y', 'de', 'en'];
const EN = ['the', 'you', 'your', 'for', 'and', 'to', 'we', 'our', 'is', 'are', 'table', 'thanks', 'please', 'hi', 'hey', 'with', 'this', 'it', 'of', 'tonight', 'today', 'can', 'just', 'here', 'what', 'would'];

/** "es" o "en" por palabras comunes (sin links, sin correos). '' si no alcanza. */
function idiomaDe(texto) {
  const t = String(texto || '').toLowerCase().replace(/https?:\/\/\S+|\S+@\S+/g, ' ');
  const pal = t.split(/[^a-záéíóúñü]+/).filter(Boolean);
  let es = 0, en = 0;
  pal.forEach((p) => { if (ES.includes(p)) es++; if (EN.includes(p)) en++; });
  es += (t.match(/[¿¡ñáéíóú]/g) || []).length * 0.5;
  if (es + en < 2) return '';
  return en > es ? 'en' : 'es';
}

/** Montos en quetzales de un texto: "Q1,120" → 1120, "Q 586.50" → 586.5. */
function montos(texto) {
  const out = [];
  String(texto || '').replace(/\bQ\s?\.?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g, (m, a, b) => {
    out.push(Number(a.replace(/,/g, '') + (b ? '.' + b : '')));
    return m;
  });
  return out;
}
/** Precios permitidos: todo monto en Q que aparece en la base de conocimiento. */
function preciosDeKb(kb) { return Array.from(new Set(montos(kb))).sort((a, b) => a - b); }

const EQUIV = { cancelar_reserva: 'reserva_cancelada', cambiar_reserva: 'reserva_cambiada', consultar_reserva: 'reserva_consultada', crear_reserva: 'reserva_creada' };
const norm = (a) => EQUIV[a] || a;

/** turno: { contesto, respuesta, botones, categoria, humano, avisoJuanma, pipeline, wix:[{ruta, ok}], errores, logsError,
 *           conversacionRegistrada, sinGrabado, cliente, canal, idiomaCliente }  ctx: { precios } */
const REGLAS = {
  contesta: { clase: 'flujo', f: (t) => ({ ok: t.contesto, detalle: t.contesto ? '' : 'no contestó' }) },
  se_calla: { clase: 'flujo', f: (t) => ({ ok: !t.contesto, detalle: t.contesto ? 'contestó: ' + corto(t.respuesta) : '' }) },
  pasa_a_juanma: { clase: 'flujo', f: (t) => {
    const ok = t.humano === true || t.avisoJuanma;
    return { ok, detalle: ok ? '' : (t.contesto ? 'no le pasó el chat a Juanma (acción: ' + (t.categoria || '-') + ')' : 'no contestó ni avisó') };
  } },
  no_pasa_a_juanma: { clase: 'flujo', f: (t) => {
    const ok = !(t.humano === true || t.avisoJuanma);
    return { ok, detalle: ok ? '' : 'le pasó el chat a Juanma sin necesidad (acción: ' + (t.categoria || '-') + ')' };
  } },
  crea_reserva: { clase: 'flujo', f: (t) => {
    const ok = t.wix.some((w) => w.ruta === 'reservarBot' && w.ok);
    return { ok, detalle: ok ? '' : 'no creó la reserva en Wix' };
  } },
  no_crea_reserva: { clase: 'flujo', f: (t) => {
    const ok = !t.wix.some((w) => w.ruta === 'reservarBot');
    return { ok, detalle: ok ? '' : 'creó una reserva que no tocaba' };
  } },
  no_cancela: { clase: 'flujo', f: (t) => {
    const w = t.wix.find((x) => x.ruta === 'cancelarBot');
    return { ok: !w, detalle: w ? 'intentó cancelar una reserva' : '' };
  } },
  // 19-oct-2026 (Louise): un correo que el bot no resolvió nunca queda sin aviso a Juanma.
  avisa_a_juanma: { clase: 'flujo', f: (t) => ({ ok: t.avisoJuanma, detalle: t.avisoJuanma ? '' : 'no le llegó a Juanma el aviso "Lead para atender"' }) },
  no_avisa_a_juanma: { clase: 'flujo', f: (t) => ({ ok: !t.avisoJuanma, detalle: t.avisoJuanma ? 'le avisó a Juanma sin necesidad' : '' }) },
  aviso_con_datos_evento: { clase: 'flujo', f: (t) => ({ ok: t.pipeline, detalle: t.pipeline ? '' : 'el aviso a Juanma no trae el bloque del evento' }) },
  no_rompe: { clase: 'flujo', f: (t) => {
    const e = t.errores.concat(t.logsError);
    return { ok: e.length === 0, detalle: e.slice(0, 2).join(' | ') };
  } },
  foto_queda_registrada: { clase: 'flujo', f: (t) => ({ ok: t.conversacionRegistrada, detalle: t.conversacionRegistrada ? '' : 'la foto no queda ni en Conversaciones' }) },
  botones_validos: { clase: 'flujo', f: (t) => {
    const malos = (t.botones || []).filter((b) => String(b).length > 20);
    const dup = new Set(t.botones || []).size !== (t.botones || []).length;
    const ok = !malos.length && !dup && (t.botones || []).length <= 10;
    return { ok, detalle: ok ? '' : 'botones inválidos: ' + (t.botones || []).join(' · ') };
  } },

  idioma: { clase: 'texto', conTexto: true, f: (t, arg) => {
    const i = idiomaDe(t.respuesta);
    if (!i) return { ok: null, detalle: 'respuesta muy corta para decidir' };
    return { ok: i === arg, detalle: i === arg ? '' : 'contestó en ' + (i === 'en' ? 'inglés' : 'español') };
  } },
  no_inventa_precios: { clase: 'texto', conTexto: true, f: (t, arg, ctx) => {
    const delCliente = new Set(montos(t.clienteTodo || t.cliente));   // lo que el cliente ya dijo se puede repetir
    const malos = montos(t.respuesta).filter((m) => !ctx.precios.includes(m) && !delCliente.has(m));
    const dolar = /\$\s?\d|\bUSD\b|\bd[oó]lares\b/i.test(t.respuesta);
    const ok = !malos.length && !dolar;
    return { ok, detalle: ok ? '' : 'precio que no está en la base: ' + malos.map((m) => 'Q' + m).concat(dolar ? ['montos en dólares'] : []).join(', ') };
  } },
  no_confirma_sin_sistema: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.confirma);
    const conWix = t.wix.some((w) => w.ok);
    const ok = !m || conWix;
    return { ok, detalle: ok ? '' : 'da por hecho algo que el sistema no hizo: "' + m[0] + '"' };
  } },
  no_promete_disponibilidad: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.disponible);
    const conWix = t.wix.some((w) => w.ok);
    const ok = !m || conWix;
    return { ok, detalle: ok ? '' : 'promete lugar sin revisar: "' + m[0] + '"' };
  } },
  no_confirma_pago: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.pagoRecibido);
    return { ok: !m, detalle: m ? 'da el pago por recibido: "' + m[0] + '"' : '' };
  } },
  sin_frases_prohibidas: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.prohibidas);
    return { ok: !m, detalle: m ? 'dice "' + m[0] + '"' : '' };
  } },
  // Regla de Juanma (19-oct-2026): el bot NUNCA le da su nombre al cliente. Al pasar un chat dice que alguien del
  // restaurante se pondrá en contacto. Se revisa en TODOS los mensajes en que el bot contesta.
  no_nombra_a_juanma: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(/juanma|juan manuel/i);
    return { ok: !m, detalle: m ? 'le da al cliente el nombre: "' + m[0] + '"' : '' };
  } },
  no_pide_otro_canal: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.otroCanal);
    return { ok: !m, detalle: m ? 'manda al cliente a otro canal: "' + m[0] + '"' : '' };
  } },
  no_promete_compensacion: { clase: 'texto', conTexto: true, f: (t) => {
    const m = t.respuesta.match(RE.compensa);
    return { ok: !m, detalle: m ? 'promete algo sin autorización: "' + m[0] + '"' : '' };
  } },
  pide: { clase: 'texto', conTexto: true, f: (t, arg) => {
    const ok = arg === 'correo' ? RE.correo.test(t.respuesta) : new RegExp(arg, 'i').test(t.respuesta);
    return { ok, detalle: ok ? '' : 'no pide ' + arg };
  } },
  deriva_al_correo: { clase: 'texto', conTexto: true, f: (t) => {
    const ok = /restaurante@rosanta\.rest/i.test(t.respuesta);
    return { ok, detalle: ok ? '' : 'no manda la propuesta al correo restaurante@rosanta.rest' };
  } },
  link_en_su_idioma: { clase: 'texto', conTexto: true, f: (t) => {
    const links = t.respuesta.match(/rosanta\.rest\/\S+/gi) || [];
    if (!links.length) return { ok: null, detalle: 'sin link' };
    const lang = t.idiomaCliente || idiomaDe(t.cliente) || 'es';
    const malos = links.filter((l) => (lang === 'en' ? /\/reservas\b|men[uú]-espa/i : /\/reservations\b|english-menu/i).test(l));
    return { ok: !malos.length, detalle: malos.length ? 'link en el otro idioma: ' + malos.join(' ') : '' };
  } },
  contiene: { clase: 'texto', conTexto: true, f: (t, arg) => {
    const ok = t.respuesta.toLowerCase().includes(arg.toLowerCase());
    return { ok, detalle: ok ? '' : 'falta "' + arg + '"' };
  } },
  no_contiene: { clase: 'texto', conTexto: true, f: (t, arg) => {
    const ok = !t.respuesta.toLowerCase().includes(arg.toLowerCase());
    return { ok, detalle: ok ? '' : 'dice "' + arg + '"' };
  } },
  accion: { clase: 'flujo', f: (t, arg) => {
    if (!t.contesto) return { ok: false, detalle: 'no contestó' };
    const ok = norm(t.categoria) === norm(arg);
    return { ok, detalle: ok ? '' : 'acción ' + (t.categoria || '-') + ' (se esperaba ' + arg + ')' };
  } }
};

function corto(s) { s = String(s || '').replace(/\s+/g, ' '); return s.length > 140 ? s.slice(0, 140) + '…' : s; }

/** Normaliza una regla del caso: 'idioma:en' | { regla, pendiente } → { id, nombre, arg, pendiente } */
function parsear(r) {
  const o = typeof r === 'string' ? { regla: r } : r;
  const [nombre, ...resto] = o.regla.split(':');
  return { id: o.regla, nombre, arg: resto.join(':'), pendiente: !!o.pendiente };
}

/** Evalúa las reglas deterministas de un turno. Las de juez quedan con ok:null y juez:true. */
function evaluar(turno, reglas, ctx) {
  const lista = reglas.map(parsear);
  // Siempre: que no se rompa y que los botones sean válidos; si contestó, que no invente precios ni nombre a Juanma.
  ['no_rompe', 'botones_validos'].concat(turno.contesto ? ['no_inventa_precios', 'no_nombra_a_juanma'] : []).forEach((g) => {
    if (!lista.some((x) => x.nombre === g)) lista.push({ id: g, nombre: g, arg: '', pendiente: false, auto: true });
  });
  return lista.map((r) => {
    const base = { regla: r.id, critica: CRITICAS.has(r.nombre), pendiente: r.pendiente, auto: !!r.auto };
    if (r.nombre === 'juez') return Object.assign(base, { clase: 'juez', criterio: r.arg, ok: null, detalle: 'sin juez' });
    const def = REGLAS[r.nombre];
    if (!def) return Object.assign(base, { clase: '?', ok: null, detalle: 'regla desconocida' });
    if (def.conTexto && (!turno.contesto || turno.sinGrabado)) {
      return Object.assign(base, { clase: def.clase, ok: null, detalle: turno.sinGrabado ? 'sin respuesta grabada' : 'no contestó' });
    }
    const res = def.f(turno, r.arg, ctx);
    return Object.assign(base, { clase: def.clase }, res);
  });
}

module.exports = { evaluar, idiomaDe, montos, preciosDeKb, REGLAS, CRITICAS, parsear, corto };
