/**
 * Conversaciones reales → chats para reproducir (19-oct-2026).
 *
 * Lee las pestañas Conversaciones y Leads de Rosanta Leads (la copia que ya guarda la base para la
 * sombra 2) y arma, por contacto, la lista de lo que pasó en orden: mensajes del cliente, respuestas
 * del bot y respuestas de Juanma. A cada mensaje del cliente le pega lo que hizo el bot real
 * (si contesto, que accion tomo, si paso el chat a Juanma), para comparar.
 *
 * TODO sale anonimizado: telefonos, correos, ids y nombres se cambian por otros de mentira, siempre
 * los mismos para la misma persona. Nada con datos reales de clientes se guarda en la base ni en git.
 */

const VENTANA_RESPUESTA_MS = 3 * 60 * 1000;   // el bot real contesta en segundos; 3 min deja margen
const NOMBRES = ['Ana', 'Luis', 'Sofía', 'Carlos', 'Lucía', 'Mateo', 'Valeria', 'Diego', 'Camila', 'Pablo', 'Elena', 'Andrés',
  'Paula', 'Jorge', 'Mariana', 'Tomás', 'Daniela', 'Javier', 'Gabriela', 'Martín', 'Laura', 'Ricardo', 'Inés', 'Hugo'];

/** {$d:'2026-10-17T23:09:32'} (hora de Guatemala, como la guarda la copia) o Date o texto → ms. */
function ms(v) {
  if (v && typeof v === 'object' && v.$d) return Date.parse(v.$d + '-06:00');
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(String(v));
  return isNaN(t) ? NaN : t;
}

/** La accion final que dejo el bot (Leads: Accion + Resumen) en pocas categorias comparables. */
function categoria(accion, resumen) {
  const r = String(resumen || '');
  if (/^Reserva creada en Wix/.test(r)) return 'reserva_creada';
  if (/^Reserva CANCELADA por el bot/.test(r)) return 'reserva_cancelada';
  if (/^Reserva CAMBIADA por el bot/.test(r)) return 'reserva_cambiada';
  if (/^Consultó su reserva/.test(r)) return 'reserva_consultada';
  const a = String(accion || '');
  if (a === 'escalar_evento' || a === 'escalar_humano' || a === 'redirigir_reservas') return a;
  if (a === 'crear_reserva' || a === 'cancelar_reserva' || a === 'cambiar_reserva' || a === 'consultar_reserva') return a;
  return a ? 'responder_info' : '';
}

/** Anonimizador: mismo reemplazo para el mismo dato en toda la corrida. */
function crearAnonimizador() {
  const ids = new Map();
  const nombres = new Map();
  const correos = new Map();
  const tels = new Map();
  let n = 0;
  function id(canal, real) {
    const k = canal + '|' + real;
    if (!ids.has(k)) {
      n++;
      const num = String(n).padStart(4, '0');
      ids.set(k, canal === 'whatsapp' ? '5025550' + num : '9990000000' + num);
    }
    return ids.get(k);
  }
  function nombre(real) {
    const r = String(real || '').trim();
    if (!r) return '';
    if (!nombres.has(r)) nombres.set(r, NOMBRES[nombres.size % NOMBRES.length] + (nombres.size >= NOMBRES.length ? ' ' + Math.floor(nombres.size / NOMBRES.length) : ''));
    return nombres.get(r);
  }
  function correo(real) {
    const r = String(real || '').toLowerCase();
    if (!correos.has(r)) correos.set(r, 'cliente' + (correos.size + 1) + '@ejemplo.test');
    return correos.get(r);
  }
  function tel(real) {
    const r = String(real).replace(/\D/g, '');
    if (!tels.has(r)) tels.set(r, '555' + String(tels.size + 1).padStart(5, '0'));
    return tels.get(r);
  }
  /** Texto libre: correos, telefonos (8+ digitos), y el nombre del perfil de esa persona. */
  function texto(t, nombreReal) {
    let s = String(t == null ? '' : t);
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => correo(m));
    // Telefonos: 4-4 de Guatemala (con o sin codigo de pais) o 9 a 15 digitos seguidos. Las fechas (2026-10-25) no calzan.
    s = s.replace(/(\+\d{1,3}[\s-]?)?\b\d{4}[\s-]?\d{4}\b|\+?\b\d{9,15}\b/g, (m) => tel(m));
    String(nombreReal || '').split(/\s+/).filter((p) => p.length >= 3 && !/^juanma$/i.test(p)).forEach((p) => {
      const alias = nombre(nombreReal).split(' ')[0];
      s = s.replace(new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), alias);
    });
    return s;
  }
  return { id, nombre, correo, tel, texto };
}

/**
 * armarChats(conversaciones, leads, { desde, hasta }) — matrices con encabezado (como la copia).
 * Devuelve [{ canal, id, nombre, eventos: [{ t, tipo: 'cliente'|'bot'|'humano', texto, real? }] }]
 * con real = { contesto, respuesta, categoria, humano, idioma } en cada mensaje del cliente.
 */
function armarChats(conversaciones, leads, opciones) {
  const o = opciones || {};
  const desde = o.desde ? ms(o.desde) : -Infinity;
  const hasta = o.hasta ? ms(o.hasta) : Infinity;
  const an = o.anonimizador || crearAnonimizador();
  const porContacto = new Map();
  (conversaciones || []).slice(1).forEach((r) => {
    const t = ms(r[0]);
    const canal = String(r[1] || '').toLowerCase();
    if (isNaN(t) || canal === 'correo') return;   // el canal de correo deja borradores: no se reproduce
    const id = String(r[2] || '');
    if (!id) return;
    const k = canal + '|' + id;
    if (!porContacto.has(k)) porContacto.set(k, { canal, idReal: id, nombreReal: '', eventos: [] });
    const c = porContacto.get(k);
    if (r[3] && !c.nombreReal) c.nombreReal = String(r[3]);
    const dir = String(r[4] || ''), autor = String(r[5] || '');
    const tipo = dir === 'in' ? 'cliente' : (autor === 'humano' ? 'humano' : 'bot');
    c.eventos.push({ t, tipo, textoReal: String(r[6] == null ? '' : r[6]) });
  });
  // Leads por contacto (ID destino), en orden
  const leadsPor = new Map();
  (leads || []).slice(1).forEach((r) => {
    const id = String(r[11] || '');
    if (!id) return;
    if (!leadsPor.has(id)) leadsPor.set(id, []);
    leadsPor.get(id).push({ t: ms(r[0]), canal: String(r[1] || ''), idioma: String(r[2] || ''), accion: String(r[8] || ''),
      humano: String(r[9] || '') === 'Sí', original: String(r[10] || ''), resumen: String(r[7] || ''), nombre: String(r[3] || ''), email: String(r[14] || ''), respuesta: String(r[15] == null ? '' : r[15]), usado: false });
  });

  const chats = [];
  porContacto.forEach((c) => {
    c.eventos.sort((a, b) => a.t - b.t);
    const ls = leadsPor.get(c.idReal) || [];
    const ev = c.eventos;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.tipo !== 'cliente') continue;
      // Se empareja por Leads (cada respuesta del bot deja ahi el mensaje original y su respuesta): asi
      // dos mensajes seguidos del cliente, que el bot real atiende en paralelo, quedan bien pareados.
      const lead = ls.find((l) => !l.usado && l.original === e.textoReal && l.t >= e.t - 5000 && l.t - e.t <= VENTANA_RESPUESTA_MS);
      if (lead) lead.usado = true;
      let bot = null;
      if (lead && lead.respuesta) {
        const k = ev.findIndex((x, j) => j > i && x.tipo === 'bot' && x.respondeA === undefined && x.textoReal === lead.respuesta && x.t - e.t <= VENTANA_RESPUESTA_MS);
        bot = k >= 0 ? ev[k] : { textoReal: lead.respuesta };
        if (k >= 0) ev[k].respondeA = i;
      } else if (!lead) {
        // Filas viejas de Leads (o un mensaje que no dejo fila): la primera respuesta del bot antes del siguiente mensaje.
        for (let j = i + 1; j < ev.length && ev[j].t - e.t <= VENTANA_RESPUESTA_MS; j++) {
          if (ev[j].tipo === 'cliente') break;
          if (ev[j].tipo === 'bot' && ev[j].respondeA === undefined) { bot = ev[j]; ev[j].respondeA = i; break; }
        }
      }
      e.real = { contesto: !!bot, respuestaReal: bot ? bot.textoReal : '', categoria: lead ? categoria(lead.accion, lead.resumen) : '',
        humano: lead ? lead.humano : null, idioma: lead ? lead.idioma : '',
        resumen: lead ? lead.resumen : '', email: lead ? lead.email : '', nombreLead: lead ? lead.nombre : '' };
    }
    const enRango = ev.some((e) => e.tipo === 'cliente' && e.t >= desde && e.t < hasta);
    if (!enRango) return;
    const id = an.id(c.canal, c.idReal);
    const nombre = an.nombre(c.nombreReal);
    chats.push({
      canal: c.canal, id, nombre,
      eventos: ev.map((e) => {
        const x = { t: e.t, tipo: e.tipo, texto: an.texto(e.textoReal, c.nombreReal), enRango: e.t >= desde && e.t < hasta };
        if (e.tipo === 'bot' && e.respondeA === undefined) x.seguimiento = true;   // el bot escribio primero (vuelve de Juanma)
        if (e.real) x.real = Object.assign({}, e.real, { respuestaReal: an.texto(e.real.respuestaReal, c.nombreReal),
          resumen: an.texto(e.real.resumen, c.nombreReal), email: e.real.email ? an.correo(e.real.email) : '',
          nombreLead: e.real.nombreLead ? an.nombre(e.real.nombreLead) : '' });
        return x;
      })
    });
  });
  chats.sort((a, b) => a.eventos[0].t - b.eventos[0].t);
  return chats;
}

module.exports = { armarChats, crearAnonimizador, categoria, ms, VENTANA_RESPUESTA_MS };
