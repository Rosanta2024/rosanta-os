/**
 * Motor de reservas · disponibilidad (20-oct-2026). PURO: sin red, sin base, sin reloj propio.
 *
 * Calcula, para un dia y un tamaño de grupo, cada franja con el mismo estado que da Wix (getTimeSlots):
 *   AVAILABLE | UNAVAILABLE | NON_WORKING_HOURS, y si pide aprobacion manual.
 * La salida web es la MISMA forma que GET /_functions/slots: { slots: [{ startDate, manualApproval }] }.
 *
 * Que mira, en este orden:
 *   1. horario de la semana (horario_reservas) o el horario especial del dia (cierres_reservas con cerrado = false),
 *      y los cierres (cerrado = true) → NON_WORKING_HOURS
 *   2. ya paso, aviso minimo, aviso maximo, reservas en linea apagadas o en pausa (solo web) → UNAVAILABLE
 *   3. tope de personas por canal (web 10, bot 15) → UNAVAILABLE
 *   4. ritmo por franja: reservas nuevas (partyPacing) y personas nuevas (seatPacing) → UNAVAILABLE
 *   5. una mesa o combinacion libre que alcance al grupo, durante toda la duracion → si no, UNAVAILABLE
 * Las reservas que ocupan mesa son las pendientes, confirmadas y "llego". Las que no traen mesa (Wix sin mesa
 * asignada) reciben una mesa "virtual" en orden de hora, para que igual cuenten.
 */
const C = require('./comun');

const MIN = 60000;

/** Duracion de la reserva segun el grupo: fila del horario > regla por tamaño (turnoverTimeRules) > por defecto. */
function duracionPara(reglas, personas, fila) {
  if (fila && fila.duracion_min) return fila.duracion_min;
  const r = (reglas.duraciones || []).find((d) => personas >= d.desde && personas <= d.hasta);
  return r ? r.minutos : reglas.duracion_min;
}

/** Los rangos abiertos del dia, en minutos desde la medianoche de Guatemala, con su fila de horario. */
function rangosAbiertos(config, fecha) {
  const ini = C.instante(fecha, '00:00').getTime(), fin = ini + 1440 * MIN;
  const especiales = (config.cierres || []).filter((c) => !c.cerrado && c.desde.getTime() < fin && c.hasta.getTime() > ini);
  if (especiales.length) {
    // El horario especial reemplaza al de la semana ese dia. Su "hasta" es el fin del rango (no entra).
    return especiales.map((c) => ({
      desde: Math.max(0, Math.round((c.desde.getTime() - ini) / MIN)),
      hasta: Math.min(1440, Math.round((c.hasta.getTime() - ini) / MIN)),
      inclusivo: false, fila: null
    }));
  }
  const dia = C.diaSemana(fecha);
  return (config.horario || []).filter((h) => h.dia_semana === dia).map((h) => ({
    desde: C.minutosDe(h.desde), hasta: C.minutosDe(h.hasta), inclusivo: !!config.reglas.cierre_inclusivo, fila: h
  }));
}

function cerradoEn(config, t) {
  return (config.cierres || []).some((c) => c.cerrado && c.desde.getTime() <= t && c.hasta.getTime() > t);
}

/** Copia de las reservas que ocupan, con inicio/fin en milisegundos y mesa asignada (real o virtual). */
function ocupacion(config, reservas, excluirId) {
  const lista = (reservas || [])
    .filter((r) => C.OCUPAN.indexOf(r.estado) !== -1 && (!excluirId || r.id !== excluirId))
    .map((r) => {
      const ini = new Date(r.inicio).getTime();
      const fin = r.fin ? new Date(r.fin).getTime() : ini + (Number(r.duracion_min) || config.reglas.duracion_min) * MIN;
      return { id: r.id, ini, fin, personas: Number(r.personas) || 0, mesas: (r.mesa_ids || []).map(String), virtual: false };
    })
    .sort((a, b) => a.ini - b.ini);
  if (config.reglas.usar_mesas && (config.mesas || []).length) {
    const conMesa = lista.filter((x) => x.mesas.length);
    lista.filter((x) => !x.mesas.length).forEach((x) => {
      const m = buscarMesa(config, conMesa, x.personas, x.ini, x.fin);
      if (m) { x.mesas = m; x.virtual = true; conMesa.push(x); }
    });
  }
  return lista;
}

function mesaLibre(ocupadas, mesaId, ini, fin) {
  return !ocupadas.some((o) => o.ini < fin && o.fin > ini && o.mesas.indexOf(mesaId) !== -1);
}

/**
 * La mesa (o combinacion) mas chica que alcanza y esta libre en [ini, fin). Primero las mesas sueltas.
 * preferidas: ids de mesa que el equipo pidio (si estan libres y alcanzan, se usan).
 */
function buscarMesa(config, ocupadas, personas, ini, fin, preferidas) {
  const activas = new Set((config.mesas || []).map((m) => m.id));
  if (preferidas && preferidas.length) {
    const cap = preferidas.reduce((s, id) => { const m = config.mesas.find((x) => x.id === id); return s + (m ? m.capacidad_max : 0); }, 0);
    if (preferidas.every((id) => activas.has(id) && mesaLibre(ocupadas, id, ini, fin)) && cap >= personas) return preferidas.slice();
    return null;
  }
  const sueltas = (config.mesas || [])
    .filter((m) => m.capacidad_min <= personas && m.capacidad_max >= personas)
    .sort((a, b) => a.capacidad_max - b.capacidad_max || a.orden - b.orden || (a.nombre < b.nombre ? -1 : 1));
  for (const m of sueltas) if (mesaLibre(ocupadas, m.id, ini, fin)) return [m.id];
  const combos = (config.combinaciones || [])
    .filter((c) => c.capacidad_min <= personas && c.capacidad_max >= personas && c.mesa_ids.every((id) => activas.has(id)))
    .sort((a, b) => a.capacidad_max - b.capacidad_max || a.mesa_ids.length - b.mesa_ids.length);
  for (const c of combos) if (c.mesa_ids.every((id) => mesaLibre(ocupadas, id, ini, fin))) return c.mesa_ids.slice();
  return null;
}

function topeCanal(reglas, canal) {
  if (canal === 'web') return reglas.tope_web;
  if (canal === 'bot') return reglas.tope_bot;
  return Infinity;   // equipo: el panel decide
}

/**
 * Evalua UN instante. o = { config, inicio (Date|ISO), personas, canal: 'web'|'bot'|'equipo', reservas, ahora (ms|Date),
 *   excluirId, mesasPreferidas, ocupadas (opcional, ya calculadas) }.
 * Devuelve { startDate, estado, manualApproval, mesa_ids, duracion_min, motivo }.
 */
function evaluar(o) {
  const config = o.config, reglas = config.reglas;
  const ini = new Date(o.inicio).getTime();
  const fecha = C.diaGt(ini);
  const minuto = Math.round((ini - C.instante(fecha, '00:00').getTime()) / MIN);
  const personas = Number(o.personas);
  const canal = o.canal || 'web';
  const ahora = new Date(o.ahora == null ? Date.now() : o.ahora).getTime();
  const sale = (estado, extra) => Object.assign({ startDate: new Date(ini).toISOString(), estado, manualApproval: false, mesa_ids: [],
    duracion_min: null, motivo: '' }, extra || {});

  // 1. horario
  const intervalo = reglas.intervalo_min;
  const rango = rangosAbiertos(config, fecha).find((r) => minuto >= r.desde && (r.inclusivo ? minuto <= r.hasta : minuto < r.hasta) &&
    (!r.fila || !r.fila.intervalo_min || (minuto - r.desde) % r.fila.intervalo_min === 0));
  // El equipo (telefono, walk-in) puede anotar fuera del horario de reservas en linea, pero no en un cierre.
  if ((!rango && canal !== 'equipo') || cerradoEn(config, ini)) return sale('NON_WORKING_HOURS', { motivo: 'cerrado' });
  // Las franjas van cada `intervalo` desde la medianoche: una hora fuera de la grilla (20:10) no es una franja.
  // El equipo si puede anotar a cualquier hora (walk-in).
  if (canal !== 'equipo' && minuto % intervalo !== 0) return sale('UNAVAILABLE', { motivo: 'fuera_de_grilla' });
  const fila = rango ? rango.fila : null;
  const duracion = duracionPara(reglas, personas, fila);

  // 2. tiempo y reservas en linea
  // El equipo puede anotar un walk-in o una reserva de hace un rato (hasta 12 h atras).
  if (ini < ahora - (canal === 'equipo' ? 12 * 60 * MIN : 0)) return sale('UNAVAILABLE', { motivo: 'paso', duracion_min: duracion });
  if (canal !== 'equipo') {
    if (ini < ahora + reglas.aviso_minimo_min * MIN) return sale('UNAVAILABLE', { motivo: 'aviso_minimo', duracion_min: duracion });
    if (ini > ahora + reglas.aviso_maximo_dias * 1440 * MIN) return sale('UNAVAILABLE', { motivo: 'aviso_maximo', duracion_min: duracion });
  }
  if (canal === 'web') {
    if (reglas.en_linea === false) return sale('UNAVAILABLE', { motivo: 'en_linea_apagado', duracion_min: duracion });
    if (reglas.pausa_hasta && ahora < new Date(reglas.pausa_hasta).getTime()) return sale('UNAVAILABLE', { motivo: 'pausa', duracion_min: duracion });
  }

  // 3. tope del canal
  if (!(personas >= 1) || personas > topeCanal(reglas, canal)) return sale('UNAVAILABLE', { motivo: 'tope', duracion_min: duracion });

  // 4. ritmo por franja
  const ocupadas = o.ocupadas || ocupacion(config, o.reservas, o.excluirId);
  const enFranja = ocupadas.filter((x) => x.ini >= ini && x.ini < ini + intervalo * MIN);
  const maxGrupos = fila && fila.max_grupos_franja != null ? fila.max_grupos_franja : reglas.ritmo_grupos;
  const maxPersonas = fila && fila.max_personas_franja != null ? fila.max_personas_franja : reglas.ritmo_personas;
  if (canal !== 'equipo') {
    if (maxGrupos != null && enFranja.length + 1 > maxGrupos) return sale('UNAVAILABLE', { motivo: 'ritmo_grupos', duracion_min: duracion });
    if (maxPersonas != null && enFranja.reduce((s, x) => s + x.personas, 0) + personas > maxPersonas) {
      return sale('UNAVAILABLE', { motivo: 'ritmo_personas', duracion_min: duracion });
    }
  }

  // 5. mesa
  let mesas = [];
  if (reglas.usar_mesas && (config.mesas || []).length) {
    mesas = buscarMesa(config, ocupadas, personas, ini, ini + duracion * MIN, o.mesasPreferidas);
    if (!mesas) return sale('UNAVAILABLE', { motivo: 'sin_mesa', duracion_min: duracion });
  }

  // aprobacion manual
  const umbral = fila && fila.aprobacion_manual_desde ? fila.aprobacion_manual_desde : reglas.aprobacion_desde;
  let manual = reglas.aprobacion === 'manual' || (reglas.aprobacion === 'grupos' && personas >= umbral);
  if (canal === 'bot' && !reglas.aprobacion_bot) manual = false;
  if (canal === 'equipo') manual = false;
  return sale('AVAILABLE', { manualApproval: manual, mesa_ids: mesas, duracion_min: duracion });
}

/**
 * Todas las franjas del dia (cada intervalo desde las 00:00 de Guatemala). o = { config, fecha, personas, canal, reservas,
 * ahora, excluirId }.
 */
function franjasDelDia(o) {
  const ocupadas = ocupacion(o.config, o.reservas, o.excluirId);
  const int = o.config.reglas.intervalo_min;
  const base = C.instante(o.fecha, '00:00').getTime();
  const out = [];
  for (let m = 0; m < 1440; m += int) out.push(evaluar(Object.assign({}, o, { inicio: base + m * MIN, ocupadas })));
  return out;
}

/** Franjas entre ancla - antes*intervalo y ancla + despues*intervalo, del mismo dia de Guatemala que el ancla. */
function ventana(franjas, ancla, antes, despues, intervalo) {
  const a = new Date(ancla).getTime(), dia = C.diaGt(a);
  const desde = a - antes * intervalo * MIN, hasta = a + despues * intervalo * MIN;
  return franjas.filter((f) => { const t = new Date(f.startDate).getTime(); return t >= desde && t <= hasta && C.diaGt(t) === dia; });
}

/**
 * Lo mismo que GET /_functions/slots?date=&partySize= : { slots: [{ startDate, manualApproval }] }.
 * partySize se interpreta igual que Wix: Math.max(1, Number(x) || 2).
 */
function slotsWeb(o) {
  const reglas = o.config.reglas;
  const personas = Math.max(1, Number(o.personas) || 2);
  const v = reglas.ventana_web;
  const ancla = C.instante(o.fecha, v.ancla);
  const todas = franjasDelDia(Object.assign({}, o, { personas, canal: 'web' }));
  return {
    slots: ventana(todas, ancla, v.antes, v.despues, reglas.intervalo_min)
      .filter((s) => s.estado === 'AVAILABLE')
      .map((s) => ({ startDate: s.startDate, manualApproval: s.manualApproval }))
  };
}

/** Lo que ve el bot (botSlots con slotsAfter: 12): desde la hora pedida, mismo dia. */
function franjasBot(o) {
  const reglas = o.config.reglas;
  const ini = new Date(o.inicio);
  const todas = franjasDelDia(Object.assign({}, o, { fecha: C.diaGt(ini), canal: 'bot' }));
  return ventana(todas, ini, 0, reglas.ventana_bot_despues, reglas.intervalo_min);
}

/** Las 4 horas libres mas cercanas a la pedida (mismo orden que http-functions.js). */
function alternativas(libres, inicio, n) {
  const t = new Date(inicio).getTime();
  return libres.map((s) => ({ s, dif: Math.abs(new Date(s.startDate).getTime() - t) }))
    .sort((a, b) => a.dif - b.dif).slice(0, n || 4).map((x) => C.horaGt(x.s.startDate));
}

module.exports = { duracionPara, rangosAbiertos, ocupacion, buscarMesa, evaluar, franjasDelDia, ventana, slotsWeb, franjasBot, alternativas };
