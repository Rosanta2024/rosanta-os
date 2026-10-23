/**
 * Avisos de reservas (Ayudante 2, 20-oct-2026): lo que se le manda al cliente y al equipo cuando pasa algo con una
 * reserva, y los relojes de recordatorios y reseñas. Tablas: migracion 052. Textos: cloud/app/avisos/*.md.
 *
 * Se engancha al motor (Ayudante 1) como su gancho `avisos(reserva, evento)`:
 *     const avisos = crearAvisos({ pool, ... });
 *     crearRutasReservas({ pool, avisos: avisos.gancho, ... })
 * El motor llama al gancho DESPUES del COMMIT y nunca se cae si el gancho falla.
 *
 * MODOS (AVISOS_MODO): apagado (por defecto: no se anota ni se manda nada) | sombra (todo va SOLO a
 * restaurante@rosanta.rest, con el destinatario real tapado en el asunto) | vivo (al cliente).
 * Mientras Wix mande (interruptor motor_reservas = 'wix') no sale ningun aviso propio: Wix manda los suyos.
 * Confirmacion por correo; recordatorio por WhatsApp (plantilla de utilidad de Meta) si WHATSAPP_AVISOS=encendido,
 * y si no (o si Meta falla) por correo.
 *
 * deps: { pool, canales: { modo, correo, whatsapp } (adaptadores.canalesDesdeEntorno), secretoEnlace
 *         (RESERVAS_ENLACE_SECRETO), baseEnlace ('https://www.rosanta.rest/r/'), basePanel, correoEquipo, reloj,
 *         registrar, plantillas }
 * NADA sale a la red sin un adaptador: las pruebas pasan adaptadores falsos.
 */
const crypto = require('crypto');
const A = require('../reservas/almacen');
const C = require('../reservas/comun');
const G = require('../reservas/ganchos');
const { firmarEnlace } = require('../reservas/enlaces');
const F = require('./formato');
const T = require('./textos');
const { crearEnvios } = require('./envios');
const { armarIcs } = require('./ics');

const H = 3600000;
const CORREO_EQUIPO = 'restaurante@rosanta.rest';

/** Los valores por defecto. Los mismos que inserta la migracion 052 en avisos_ajustes (hay una prueba que lo revisa). */
const AJUSTES = {
  resena_regla: { modo: 'telefono', local_prefijos: ['+502'], sin_telefono_local_si_idioma: ['es'], local: 'google', turista: 'tripadvisor' },
  resena_enlaces: { google: 'https://g.page/r/CWMvHjpESP6vEAE/review', tripadvisor: null },
  resena_espera_min: 180,
  resena_silencio: { desde: '21:30', hasta: '09:00', mover_a: '10:00' },
  resena_tope_horas: 48,
  resena_respeta_optin: true,
  recordatorio_24h: true,
  recordatorio_dia: true,
  recordatorio_dia_hora: '12:00',
  canales: { recordatorio_24h: ['whatsapp', 'correo'], recordatorio_dia: ['whatsapp', 'correo'] },
  equipo_silenciar_origen: ['sala'],
  enlace_reservar: { en: 'https://www.rosanta.rest/reservas', es: 'https://www.rosanta.rest/reservas' }
};

function unirAjustes(filas) {
  const out = JSON.parse(JSON.stringify(AJUSTES));
  for (const f of filas || []) {
    let v = f.valor;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* texto suelto */ } }
    out[f.clave] = v && typeof v === 'object' && !Array.isArray(v) && out[f.clave] && typeof out[f.clave] === 'object' && !Array.isArray(out[f.clave])
      ? Object.assign({}, out[f.clave], v) : v;
  }
  return out;
}

const NOMBRE_SITIO = { google: 'Google', tripadvisor: 'TripAdvisor' };
/** 'google' o 'tripadvisor' para esta reserva, segun la regla. */
function sitioResena(r, regla) {
  const R = regla || AJUSTES.resena_regla;
  if (R.modo === 'google' || R.modo === 'tripadvisor') return R.modo;
  const tel = String(r.telefono || '').replace(/[^0-9+]/g, '');
  const local = tel
    ? (R.local_prefijos || []).some((p) => tel.startsWith(p) || ('+' + tel).startsWith(p))
    : (R.sin_telefono_local_si_idioma || []).indexOf(F.idioma(r.idioma)) !== -1;
  return local ? R.local : R.turista;
}
/** { sitio, nombre, url } o null. Si el sitio elegido no tiene enlace, se usa el otro. */
function enlaceResena(r, aj) {
  const enlaces = (aj && aj.resena_enlaces) || {};
  let s = sitioResena(r, aj && aj.resena_regla);
  if (!T.enlaceSeguro(enlaces[s])) s = Object.keys(enlaces).find((k) => T.enlaceSeguro(enlaces[k])) || null;
  return s ? { sitio: s, nombre: NOMBRE_SITIO[s] || s, url: enlaces[s] } : null;
}

/** Hora de la reseña: la espera despues de "Termino"; si cae de noche, a la mañana siguiente. */
function horaResena(desde, aj) {
  const a = aj || AJUSTES;
  let t = new Date(new Date(desde).getTime() + (Number(a.resena_espera_min) || 180) * 60000);
  const s = a.resena_silencio;
  if (s && s.desde && s.hasta) {
    const hm = C.horaGt(t);
    if (hm >= s.desde || hm < s.hasta) t = C.instante(hm >= s.desde ? C.diaGt(t.getTime() + 24 * H) : C.diaGt(t), s.mover_a || s.hasta);
  }
  return t;
}

/** ¿Que recordatorios tocan para esta reserva ahora? Pura. */
function recordatoriosQueTocan(r, ahora, aj) {
  const a = aj || AJUSTES;
  const out = [];
  if (r.estado !== 'confirmada') return out;
  const ini = new Date(r.inicio).getTime(), t = new Date(ahora).getTime();
  const creada = r.creada ? new Date(r.creada).getTime() : 0;
  const falta = ini - t;
  // el dia anterior: faltan 24 h o menos (y mas de 12, por si el reloj estuvo parado) y se reservo con mas de 24 h
  if (a.recordatorio_24h !== false && falta <= 24 * H && falta > 12 * H && ini - creada > 24 * H) out.push('recordatorio_24h');
  // el mismo dia desde las 12:00: falta 1 h o mas y se reservo antes de esa hora
  const hoy = C.diaGt(t), corte = C.instante(hoy, a.recordatorio_dia_hora || '12:00').getTime();
  if (a.recordatorio_dia !== false && C.diaGt(ini) === hoy && t >= corte && falta >= H && creada < corte) out.push('recordatorio_dia');
  return out;
}

const ORIGEN_TXT = { web: 'la web', bot_whatsapp: 'el bot (WhatsApp)', bot_instagram: 'el bot (Instagram)', bot_messenger: 'el bot (Messenger)',
  bot_correo: 'el bot (correo)', bot: 'el bot', restaurante: 'el restaurante', telefono: 'teléfono', sala: 'walk-in', evento: 'evento', wix: 'Wix' };
const ESTADO_TXT = { pendiente: 'PENDIENTE DE APROBAR', confirmada: 'confirmada', llego: 'llegó', termino: 'terminó', no_vino: 'no vino',
  cancelada: 'cancelada', rechazada: 'rechazada' };

function quienCancelo(quien) {
  const q = String(quien || '');
  if (q === 'cliente:enlace') return 'la canceló el cliente desde Mi reserva';
  if (/^bot/.test(q)) return 'la canceló el cliente por el bot';
  if (q === 'web') return 'la canceló el cliente por la web';
  return q ? 'la canceló ' + q : 'sin dato de quién';
}

function crearAvisos(deps) {
  const d = deps || {};
  const pool = d.pool;
  const reloj = () => new Date(d.reloj ? d.reloj() : Date.now()).getTime();
  const registrar = d.registrar || ((m) => console.error(m));
  const canales = d.canales || { modo: 'apagado' };
  const modo = ['sombra', 'vivo'].indexOf(canales.modo) !== -1 ? canales.modo : 'apagado';
  const P = d.plantillas || T.cargar();
  const correoEquipo = d.correoEquipo || CORREO_EQUIPO;
  if (!/@rosanta\.rest$/i.test(correoEquipo)) throw new Error('El correo del equipo tiene que ser de rosanta.rest.');
  const baseEnlace = String(d.baseEnlace || 'https://www.rosanta.rest/r/').replace(/\/?$/, '/');
  const envios = crearEnvios(pool, reloj);
  const cache = {};

  async function guardado(nombre, fn, ms) {
    const c = cache[nombre];
    if (c && reloj() - c.t < ms) return c.v;
    const v = await fn();
    cache[nombre] = { t: reloj(), v };
    return v;
  }
  const ajustes = () => guardado('ajustes', async () => unirAjustes(await envios.ajustes()), 5 * 60000);
  const modoMotor = () => guardado('motor', async () => ((await A.interruptor(pool, 'motor_reservas', 'wix')) === 'base' ? 'base' : 'wix'), 30000);
  function olvidar() { Object.keys(cache).forEach((k) => delete cache[k]); }

  const enlace = (id) => (d.secretoEnlace && id ? baseEnlace + firmarEnlace(d.secretoEnlace, id) : '');
  const codigo = (id) => (d.secretoEnlace && id ? firmarEnlace(d.secretoEnlace, id) : '');

  async function nombresMesas(ids) {
    if (!ids || !ids.length) return '';
    try {
      const r = await pool.query('SELECT id, nombre FROM mesas');
      const n = {}; r.rows.forEach((m) => { n[m.id] = m.nombre; });
      return ids.map((x) => n[x] || x).join(' + ');
    } catch (e) { return ids.join(' + '); }
  }

  /** La linea "sábado 24 de octubre a las 19:30, 4 personas". */
  function linea(inicio, personas, idi) {
    return F.fechaBonita(inicio, idi) + (idi === 'es' ? ' a las ' : ' at ') + F.horaBonita(inicio, idi) + ', ' + F.personasTexto(personas, idi);
  }

  async function datosPara(fila, r, aj) {
    const idi = fila.idioma;
    const cx = fila.contexto || {};
    const p = F.partes(r.inicio);
    const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const er = fila.plantilla === 'resena' ? enlaceResena(r, aj) : null;
    return {
      nombre: F.primerNombre(r.nombre),
      nombre_completo: [r.nombre, r.apellido].filter(Boolean).join(' ').trim(),
      fecha: F.fechaBonita(r.inicio, idi),
      fecha_corta: idi === 'es' ? String(p.dia).padStart(2, '0') + '/' + String(p.mes).padStart(2, '0') : MES[p.mes - 1] + ' ' + p.dia,
      hora: F.horaBonita(r.inicio, idi),
      personas: F.personasTexto(r.personas, idi),
      enlace: enlace(r.id),
      enlace_reservar: ((aj.enlace_reservar || {})[idi]) || '',
      antes: cx.antes ? linea(cx.antes.inicio, cx.antes.personas, idi) : '',
      ahora: linea(r.inicio, r.personas, idi),
      motivo: cx.motivo || '',
      sitio_resena: er ? er.nombre : '',
      enlace_resena: er ? er.url : '',
      origen: ORIGEN_TXT[r.origen] || String(r.origen || ''),
      estado: ESTADO_TXT[r.estado] || String(r.estado || ''),
      mesa: fila.para_equipo ? await nombresMesas(r.mesa_ids) : '',
      telefono: r.telefono || '',
      correo: r.email || '',
      idioma_cliente: F.idioma(r.idioma) === 'es' ? 'español' : 'inglés',
      alergias: r.alergias || '',
      notas: r.nota_equipo || '',
      enlace_panel: d.basePanel ? String(d.basePanel) + (d.basePanel.indexOf('?') === -1 ? '?' : '&') + 'fecha=' + C.diaGt(r.inicio) : '',
      quien_cancela: cx.quien_cancela || 'sin dato de quién',
      canal: r.canal || ''
    };
  }

  /** A donde iria el aviso: { canal, valor } o null. */
  function destinoCliente(r, plantilla, aj, soloCorreo) {
    const lista = soloCorreo ? ['correo'] : ((aj.canales || {})[plantilla] || ['correo']);
    for (const canal of lista) {
      if (canal === 'correo' && F.correoValido(r.email)) return { canal, valor: String(r.email).trim().toLowerCase() };
      if (canal === 'whatsapp' && canales.whatsapp && T.WHATSAPP_DE[plantilla] && F.telefonoValido(r.telefono)) return { canal, valor: C.telE164(r.telefono) };
    }
    return null;
  }

  /**
   * Anota un aviso (idempotente) y, si ya es la hora, lo manda.
   * o: { distinto, cuando, contexto, soloCorreo }. Devuelve { plantilla, clave?, estado, nuevo } o { plantilla, omitido }.
   */
  async function programar(r, plantilla, o) {
    o = o || {};
    if (modo === 'apagado') return { plantilla, omitido: 'apagado' };
    const aj = await ajustes();
    const equipo = T.DEL_EQUIPO.indexOf(plantilla) !== -1;
    const dest = equipo ? { canal: 'correo', valor: correoEquipo } : destinoCliente(r, plantilla, aj, o.soloCorreo);
    if (!dest) return { plantilla, omitido: 'sin_contacto' };
    const clave = [plantilla, r.id].concat(o.distinto ? [o.distinto] : []).concat([dest.canal]).join(':');
    const ap = await envios.apartar({ clave, reserva_id: r.id, canal: dest.canal, plantilla, idioma: equipo ? 'es' : F.idioma(r.idioma), para_equipo: equipo,
      destinatario: F.enmascarar(dest.canal, dest.valor), destinatario_huella: F.huellaDestino(dest.canal === 'correo' ? dest.valor : dest.valor.replace(/[^0-9]/g, '')),
      modo, programado_para: o.cuando || new Date(reloj()), contexto: Object.assign({}, o.contexto || {}, o.distinto ? { distinto: o.distinto } : {}) });
    if (!ap.nuevo) return { plantilla, clave, estado: ap.fila.estado, nuevo: false };
    if (new Date(ap.fila.programado_para).getTime() > reloj()) return { plantilla, clave, estado: 'programado', nuevo: true };
    return Object.assign({ plantilla, clave, nuevo: true }, await procesar(ap.fila, r));
  }

  /** ¿Sigue teniendo sentido mandarlo con la reserva como esta ahora? '' = si; si no, el motivo. */
  function yaNoAplica(fila, r, aj) {
    if (!r) return 'la reserva ya no existe';
    const p = fila.plantilla, cx = fila.contexto || {};
    if (p === 'recordatorio_24h' || p === 'recordatorio_dia') {
      if (r.estado !== 'confirmada') return 'la reserva ya no esta confirmada';
      if (cx.inicio && new Date(cx.inicio).getTime() !== new Date(r.inicio).getTime()) return 'la reserva cambio de hora';
      if (new Date(r.inicio).getTime() <= reloj()) return 'la reserva ya paso';
    }
    if (p === 'resena') {
      if (r.estado !== 'termino') return 'la reserva ya no esta en Termino';
      if (reloj() - new Date(fila.programado_para).getTime() > (Number(aj.resena_tope_horas) || 48) * H) return 'paso el tope de la reseña';
    }
    if ((p === 'confirmacion' || p === 'aprobada') && r.estado !== 'confirmada') return 'la reserva ya no esta confirmada';
    if (p === 'pendiente' && r.estado !== 'pendiente') return 'la reserva ya no esta pendiente';
    if (p === 'espera_mesa_libre' && ['esperando', 'avisado'].indexOf(r.estado) === -1) return 'ya no esta en la lista de espera';
    return '';
  }

  async function leerReserva(fila) {
    // el aviso de grupo grande no tiene reserva y la tabla no guarda sus datos de contacto: si fallo, no se reintenta
    if (String(fila.reserva_id).startsWith('grupo:')) return null;
    // el aviso de la lista de espera (LISTA_ESPERA=encendida): la persona de la lista, a la hora que se le ofrecio
    if (String(fila.reserva_id).startsWith('espera:')) {
      const LE = require('../reservas/lista-espera');
      const x = await pool.query('SELECT * FROM lista_espera WHERE id = $1', [Number(String(fila.reserva_id).slice(7))]);
      const f = LE.deFila(x.rows[0]);
      return f ? LE.comoReserva(f, (fila.contexto && fila.contexto.inicio) || C.instante(f.fecha, f.aviso_hora || f.desde || '19:00')) : null;
    }
    return G.vista(await A.porId(pool, fila.reserva_id));
  }

  /** Manda un envio ya anotado. r: la reserva (vista del motor); si no viene, se lee de la base. */
  async function procesar(fila, r0) {
    if (!(await envios.reclamar(fila.id, fila.intentos))) return { estado: 'ocupado' };
    let r;
    try { r = r0 || await leerReserva(fila); } catch (e) {
      await envios.marcar(fila.id, { estado: 'fallo', error: 'No pude leer la reserva: ' + e.message });
      return { estado: 'fallo' };
    }
    const aj = await ajustes();
    const motivo = yaNoAplica(fila, r, aj);
    if (motivo) { await envios.anular(fila.id, motivo); return { estado: 'anulado', motivo }; }
    try {
      const datos = await datosPara(fila, r, aj);
      if (fila.canal === 'whatsapp') {
        const w = T.armarWhatsapp(P, fila.plantilla, fila.idioma, datos, codigo(r.id));
        if (w.faltan.length) { await envios.marcar(fila.id, { estado: 'omitido', error: 'Faltan datos: ' + w.faltan.join(', ') }); return { estado: 'omitido', faltan: w.faltan }; }
        let res, proveedor;
        try {
          if (modo === 'sombra') {
            proveedor = canales.correo.nombre;
            res = await canales.correo.enviarWhatsappComoCorreo({ to: r.telefono, plantilla: w.nombre_meta, idioma: w.idioma,
              cuerpo: w.texto + '\n\n[' + w.boton + '] ' + datos.enlace, idempotencia: fila.clave, etiquetas: [{ name: 'plantilla', value: fila.plantilla }] });
          } else {
            proveedor = canales.whatsapp.nombre;
            res = await canales.whatsapp.enviar(Object.assign({ to: r.telefono, plantilla: w.nombre_meta }, w));
          }
        } catch (e) {
          // Meta fallo (plantilla sin aprobar, numero sin WhatsApp...): el aviso sale por correo
          // (el WhatsApp queda anulado: si Meta se recupera, un reintento no le manda el mismo aviso dos veces)
          await envios.marcar(fila.id, { estado: 'anulado', error: ('WhatsApp fallo, salio por correo: ' + String(e.message || e)) });
          const otro = await programar(r, fila.plantilla, { distinto: fila.contexto.distinto, contexto: fila.contexto, soloCorreo: true });
          return { estado: 'fallo', error: String(e.message || e), respaldo: otro };
        }
        await envios.marcar(fila.id, { estado: 'enviado', proveedor, proveedor_id: res && res.id });
        return { estado: 'enviado' };
      }
      const m = T.armarCorreo(P, fila.plantilla, fila.idioma, datos);
      if (m.faltan.length) { await envios.marcar(fila.id, { estado: 'omitido', error: 'Faltan datos: ' + m.faltan.join(', ') }); return { estado: 'omitido', faltan: m.faltan }; }
      const adjuntos = [];
      if (T.CON_ICS.indexOf(fila.plantilla) !== -1 || fila.plantilla === 'cancelacion') {
        adjuntos.push({ nombre: 'rosanta.ics', tipo: 'text/calendar', contenido: armarIcs(r, { idioma: fila.idioma, enlace: datos.enlace,
          secuencia: Number(r.version) || 0, ahora: reloj(), cancelada: fila.plantilla === 'cancelacion' }) });
      }
      const para = fila.para_equipo ? correoEquipo : String(r.email).trim().toLowerCase();
      const asunto = m.asunto;   // en sombra, el adaptador le pone "[SOMBRA → ...]"
      const res = await canales.correo.enviar({ to: [para], asunto, texto: m.texto, html: m.html, adjuntos, idempotencia: fila.clave,
        etiquetas: [{ name: 'plantilla', value: fila.plantilla }] });
      await envios.marcar(fila.id, { estado: 'enviado', proveedor: canales.correo.nombre, proveedor_id: res && res.id });
      return { estado: 'enviado' };
    } catch (e) {
      await envios.marcar(fila.id, { estado: 'fallo', error: String((e && e.message) || e) });
      return { estado: 'fallo', error: String((e && e.message) || e) };
    }
  }

  async function procesarPendientes(limite) {
    const filas = await envios.pendientes(limite || 50);
    const out = { revisados: filas.length, enviados: 0, fallas: 0, anulados: 0, omitidos: 0 };
    for (const f of filas) {
      const x = await procesar(f);
      if (x.estado === 'enviado') out.enviados++; else if (x.estado === 'fallo') out.fallas++;
      else if (x.estado === 'anulado') out.anulados++; else if (x.estado === 'omitido') out.omitidos++;
    }
    return out;
  }

  /** Los datos del historial que la vista del motor no trae: el "antes" de un cambio y quien cancelo. */
  async function delHistorial(id, evento) {
    try {
      const h = (await A.historial(pool, id)).filter((x) => x.evento === evento);
      return h[h.length - 1] || null;
    } catch (e) { return null; }
  }

  /**
   * EL GANCHO DEL MOTOR: avisos(reserva, evento). reserva = ganchos.vista() del motor (o, en grupo_grande, los datos
   * que mando el bot). Devuelve la lista de lo que hizo con cada aviso.
   */
  async function alEvento(r, evento, extra) {
    const antesMotor = extra && extra.antes;   // el motor ya manda como estaba antes; el historial queda de respaldo
    if (modo === 'apagado' || !r) return [];
    if ((await modoMotor()) !== 'base') return [{ evento, omitido: 'wix_manda' }];
    const aj = await ajustes();
    const out = [];
    const sumar = async (pl, o) => { out.push(await programar(r, pl, o)); };
    const cliente = r.origen !== 'wix';   // lo que vino de Wix ya recibio los avisos de Wix
    const alEquipo = (aj.equipo_silenciar_origen || []).indexOf(r.origen) === -1;
    switch (evento) {
      case 'creada':
        if (cliente && r.estado === 'confirmada') await sumar('confirmacion');
        if (alEquipo) await sumar('equipo_nueva');
        break;
      case 'pendiente':
        if (cliente) await sumar('pendiente');
        if (alEquipo) await sumar('equipo_nueva');
        break;
      case 'aprobada': await sumar('aprobada'); break;
      case 'rechazada': await sumar('rechazada', { contexto: { motivo: r.motivo_rechazo || '' } }); break;
      case 'cambiada': {
        const h = antesMotor ? null : await delHistorial(r.id, 'cambiada');
        const a = antesMotor ? { inicio: antesMotor.inicio, personas: antesMotor.personas } : (h && h.cambio && h.cambio.antes);
        await sumar('cambio', { distinto: new Date(r.inicio).toISOString() + '/' + r.personas,
          contexto: a ? { antes: { inicio: a.inicio, personas: a.personas }, inicio: new Date(r.inicio).toISOString() } : { inicio: new Date(r.inicio).toISOString() } });
        break;
      }
      case 'cancelada': {
        const h = r.cancelada_por ? null : await delHistorial(r.id, 'estado');
        await sumar('cancelacion');
        await sumar('equipo_cancelada', { contexto: { motivo: r.motivo_cancelacion || '', quien_cancela: quienCancelo(r.cancelada_por || (h && h.quien)) } });
        break;
      }
      case 'termino':
        if (aj.resena_respeta_optin !== false && r.optin === false) { out.push({ plantilla: 'resena', omitido: 'sin_optin' }); break; }
        await sumar('resena', { cuando: horaResena(reloj(), aj) });
        break;
      case 'grupo_grande': {
        const inicio = C.instante(r.fecha, r.hora);
        const id = 'grupo:' + crypto.createHash('sha256').update([C.tel8(r.telefono), C.correoClave(r.email), r.fecha, r.hora, r.personas].join('|')).digest('hex').slice(0, 16);
        const g = Object.assign({}, r, { id, inicio: inicio.toISOString(), origen: 'bot', estado: 'pendiente', mesa_ids: [] });
        out.push(await programar(g, 'equipo_grupo_grande'));
        break;
      }
      default: break;   // llego, no_vino, consumo, nota: sin aviso
    }
    return out;
  }

  /** Una corrida del reloj de recordatorios. Idempotente: correrlo dos veces (o dos a la vez) no manda nada dos veces. */
  async function relojRecordatorios() {
    const inicio = new Date(reloj());
    if (modo === 'apagado') return { omitido: 'apagado' };
    if ((await modoMotor()) !== 'base') return { omitido: 'wix_manda' };
    const aj = await ajustes();
    const lista = await A.reservasQueEmpiezan(pool, inicio, new Date(inicio.getTime() + 25 * H), ['confirmada']);
    const out = { revisadas: lista.length, nuevos: 0, ya_estaban: 0, omitidos: 0, enviados: 0, fallas: 0 };
    for (const fila of lista) {
      const r = G.vista(fila);
      for (const pl of recordatoriosQueTocan(Object.assign({}, r, { creada: fila.creada }), inicio, aj)) {
        const x = await programar(r, pl, { distinto: r.inicio, contexto: { inicio: r.inicio } });
        if (x.omitido) out.omitidos++;
        else if (!x.nuevo) out.ya_estaban++;
        else { out.nuevos++; if (x.estado === 'enviado') out.enviados++; if (x.estado === 'fallo') out.fallas++; }
      }
    }
    out.cola = await procesarPendientes();
    await envios.anotarReloj(Object.assign({ tarea: 'recordatorios', inicio, detalle: { omitidos: out.omitidos, cola: out.cola } }, out)).catch((e) => registrar('avisos · reloj: ' + e.message));
    return out;
  }

  /** Una corrida del reloj de reseñas: programa las que falten (Termino de las ultimas 48 h) y manda las que ya tocan. */
  async function relojResenas() {
    const inicio = new Date(reloj());
    if (modo === 'apagado') return { omitido: 'apagado' };
    if ((await modoMotor()) !== 'base') return { omitido: 'wix_manda' };
    const aj = await ajustes();
    const tope = (Number(aj.resena_tope_horas) || 48) * H;
    const lista = await A.reservasQueEmpiezan(pool, new Date(inicio.getTime() - tope - 24 * H), inicio, ['termino']);
    const out = { revisadas: lista.length, nuevos: 0, ya_estaban: 0, omitidos: 0, enviados: 0, fallas: 0 };
    for (const fila of lista) {
      const termino = new Date(fila.actualizada || fila.fin).getTime();
      if (inicio.getTime() - termino > tope) continue;
      const r = G.vista(fila);
      if (aj.resena_respeta_optin !== false && r.optin === false) { out.omitidos++; continue; }
      const x = await programar(r, 'resena', { cuando: horaResena(termino, aj) });
      if (x.omitido) out.omitidos++; else if (!x.nuevo) out.ya_estaban++; else out.nuevos++;
    }
    out.cola = await procesarPendientes();
    out.enviados = out.cola.enviados; out.fallas = out.cola.fallas;
    await envios.anotarReloj(Object.assign({ tarea: 'resenas', inicio, detalle: { omitidos: out.omitidos, cola: out.cola } }, out)).catch((e) => registrar('avisos · reloj: ' + e.message));
    return out;
  }

  /** Webhook de Resend (ya con la firma revisada) → envios_eventos y el estado del envio. */
  async function deResend(ev, eventoId) {
    const tipo = ev && ev.type;
    const id = ev && ev.data && ev.data.email_id;
    if (!tipo || !id) return { nuevo: false };
    const ESTADO = { 'email.delivered': 'entregado', 'email.bounced': 'rebotado', 'email.complained': 'rebotado' };
    return envios.eventoProveedor({ proveedor: 'resend', proveedor_id: String(id), evento_id: eventoId || null, tipo, estado: ESTADO[tipo] });
  }

  /** El gancho para el motor: nunca lanza (el motor igual lo protege) y deja rastro de los errores. */
  async function gancho(r, evento, extra) {
    try { return await alEvento(r, evento, extra); } catch (e) { registrar('avisos · ' + evento + ': ' + String((e && e.message) || e)); throw e; }
  }

  return { modo, gancho, alEvento, programar, procesar, procesarPendientes, relojRecordatorios, relojResenas, deResend, ajustes, olvidar,
    deReservas: (ids) => envios.deReservas(ids), enlace, envios };
}

module.exports = { AJUSTES, CORREO_EQUIPO, crearAvisos, unirAjustes, sitioResena, enlaceResena, horaResena, recordatoriosQueTocan, quienCancelo };
