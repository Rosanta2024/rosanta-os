/**
 * Motor de reservas · traductor de la configuracion de Wix (20-oct-2026). PURO: sin red ni base.
 *
 * Entra lo que guardo el importador de la 050:
 *   - wix_ubicaciones.crudo (la reservationLocation completa) o solo .configuracion
 *   - filas de wix_reservas (ya normalizadas por wix-historial.js › normalizarReserva)
 * Sale lo que va a las tablas de la 051: mesas, mesas_combinaciones, horario_reservas, cierres_reservas,
 * reglas_reservas y reservas (origen 'wix', id_externo = id de Wix).
 *
 * Forma de Wix: https://dev.wix.com/docs/api-reference/business-solutions/restaurants/reservations/reservation-locations/list-reservation-locations.md
 * La configuracion REAL llega el 23-oct (llave wix-api-key). Hasta entonces se prueba con un fixture inventado.
 */
const C = require('./comun');

const DIAS = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
const SEMANA = 7 * 1440;

function lista(x) { return Array.isArray(x) ? x : []; }
function idDe(x) { return String((x && (x.id || x._id)) || ''); }

/** "Pergola3" → "pergola"; "Jardín 2" → "jardin"; "Barra" → "barra". */
function zonaDeNombre(nombre) {
  const s = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim();
  return s.split(/\s+/)[0] || '';
}

/** La configuracion, venga la ubicacion completa (crudo) o solo configuration. */
function configuracionDe(ub) {
  if (!ub) return {};
  if (ub.configuration) return ub.configuration;
  if (ub.configuracion) return ub.configuracion;
  return ub;
}

/** businessSchedule.periods → filas de horario_reservas, partidas por dia (un periodo de vie 17:00 a sab 01:00 da dos filas). */
function horarioDePeriodos(periodos) {
  const filas = [];
  lista(periodos).forEach((p) => {
    const dA = DIAS[String(p.openDay || '').toUpperCase()], dC = DIAS[String(p.closeDay || '').toUpperCase()];
    const mA = C.minutosDe(p.openTime), mC = C.minutosDe(p.closeTime);
    if (dA == null || dC == null || isNaN(mA) || isNaN(mC)) return;
    const a = dA * 1440 + mA;
    let b = dC * 1440 + mC;
    if (b <= a) b += SEMANA;   // cruza el domingo (o abre la semana completa)
    for (let d = Math.floor(a / 1440); d * 1440 < b; d++) {
      const ini = Math.max(a, d * 1440), fin = Math.min(b, (d + 1) * 1440);
      if (fin <= ini) continue;
      filas.push({ dia_semana: d % 7, desde: C.horaDeMinutos(ini - d * 1440), hasta: C.horaDeMinutos(fin - d * 1440) });
    }
  });
  // Si dos periodos dan la misma llave (dia, desde), queda el de "hasta" mayor.
  const porLlave = new Map();
  filas.forEach((f) => {
    const k = f.dia_semana + '|' + f.desde, prev = porLlave.get(k);
    if (!prev || C.minutosDe(f.hasta) > C.minutosDe(prev.hasta)) porLlave.set(k, f);
  });
  return [...porLlave.values()].sort((x, y) => x.dia_semana - y.dia_semana || C.minutosDe(x.desde) - C.minutosDe(y.desde));
}

/** Fecha de Wix sin zona → hora de Guatemala. Con Z u offset se respeta. */
function instanteWix(v) {
  const s = String(v || '');
  if (!s) return null;
  const conZona = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(conZona ? s : (s.length === 10 ? s + 'T00:00:00' : s) + C.ZONA);
  return isNaN(d) ? null : d;
}

/** specialHourPeriod → filas de cierres_reservas (cerrado = isClosed; abierto = horario especial). */
function cierresDePeriodos(especiales) {
  return lista(especiales).map((p) => {
    const desde = instanteWix(p.startDate), hasta = instanteWix(p.endDate);
    if (!desde || !hasta || hasta <= desde) return null;
    return { desde, hasta, cerrado: p.isClosed !== false, motivo: String(p.comment || (p.isClosed !== false ? 'Cerrado (Wix)' : 'Horario especial (Wix)')),
      origen: 'wix', id_externo: 'wix:' + desde.toISOString() + '|' + hasta.toISOString() };
  }).filter(Boolean);
}

function minutosAviso(n) {
  if (!n || n.number == null) return null;
  const u = String(n.unit || 'MINUTES').toUpperCase();
  return Number(n.number) * (u === 'DAYS' ? 1440 : u === 'HOURS' ? 60 : 1);
}

/** onlineReservations + tableManagement → filas { clave, valor } de reglas_reservas. Solo lo que Wix trae. */
function reglasDeConfiguracion(cfg) {
  const o = cfg.onlineReservations || {};
  const r = [];
  const pon = (clave, valor) => { if (valor !== undefined) r.push({ clave, valor }); };
  const ps = o.partySize || o.partiesSize;
  if (ps && ps.max) pon('tope_web', Number(ps.max));         // copia fiel para la sombra (la web ofrece 1 a 10)
  if (ps && ps.min) pon('wix_minimo_personas', Number(ps.min));
  const ap = o.approval || {};
  if (ap.mode) {
    const modo = { AUTOMATIC: 'automatica', MANUAL: 'manual', MANUAL_FOR_LARGE_PARTIES: 'grupos' }[String(ap.mode).toUpperCase()];
    if (modo) pon('aprobacion', modo);
    const mf = ap.manualForLargePartiesOptions || {};
    if (modo === 'grupos' && mf.partySizeThreshold) pon('aprobacion_desde', Number(mf.partySizeThreshold));
    if (mf.considerTablesForManualApproval != null) pon('wix_aprobacion_considera_mesas', !!mf.considerTablesForManualApproval);
  }
  if (o.seatPacing) pon('ritmo_personas', o.seatPacing.enabled ? Number(o.seatPacing.number) : null);
  if (o.partyPacing) pon('ritmo_grupos', o.partyPacing.enabled ? Number(o.partyPacing.number) : null);
  const amin = minutosAviso(o.minimumReservationNotice);
  if (amin != null) pon('aviso_minimo_min', amin);
  const amax = minutosAviso(o.maximumReservationNotice);
  if (amax != null) pon('aviso_maximo_dias', Math.floor(amax / 1440));
  if (o.defaultTurnoverTime != null) pon('duracion_min', Number(o.defaultTurnoverTime));
  const reglasT = lista(o.turnoverTimeRules).map((t) => ({ desde: Number(t.seatsMin), hasta: Number(t.seatsMax), minutos: Number(t.minutes) }))
    .concat(lista(o.turnoverRules).map((t) => ({ desde: Number(t.minSeats || t.seatsMin), hasta: Number(t.maxSeats || t.seatsMax), minutos: Number(t.minutes) })))
    .filter((t) => t.desde && t.hasta && t.minutos);
  if (o.turnoverTimeRules || o.turnoverRules) pon('duraciones', reglasT);
  if (o.timeSlotInterval != null) pon('intervalo_min', Number(o.timeSlotInterval));
  if (o.onlineReservationsEnabled != null) pon('en_linea', !!o.onlineReservationsEnabled);
  const pausa = o.pauseSettings && o.pauseSettings.standardReservations && o.pauseSettings.standardReservations.pauseUntil;
  pon('pausa_hasta', pausa || null);
  const tm = cfg.tableManagement || {};
  if (tm.mode) pon('usar_mesas', String(tm.mode).toUpperCase() !== 'OFF');
  return r;
}

/**
 * La ubicacion completa de Wix → todo lo de la 051. Devuelve
 * { mesas, combinaciones, horario, cierres, reglas, avisos } (avisos: lo que no se pudo traducir, sin datos personales).
 */
function traducirUbicacion(ub) {
  const cfg = configuracionDe(ub);
  const o = cfg.onlineReservations || {};
  const tm = cfg.tableManagement || {};
  const avisos = [];
  const mesas = lista(tm.tableDefinitions).map((t, i) => ({ t, i, activa: t.isActive !== false }))
    .concat(lista(tm.deletedTableDefinitions).map((t, i) => ({ t, i: 1000 + i, activa: false })))
    .filter((x) => idDe(x.t))
    .map((x) => ({
      id: idDe(x.t), nombre: String(x.t.name || idDe(x.t)), zona: zonaDeNombre(x.t.name),
      capacidad_min: Number(x.t.seatsMin) || 0, capacidad_max: Math.max(1, Number(x.t.seatsMax) || 0),
      activa: x.activa, orden: x.i, origen: 'wix'
    }));
  const ids = new Set(mesas.map((m) => m.id));
  const combinaciones = lista(tm.tableCombinations).filter((c) => idDe(c) || lista(c.tableIds).length).map((c) => {
    const mesa_ids = lista(c.tableIds).map(String);
    const faltan = mesa_ids.filter((x) => !ids.has(x));
    if (faltan.length) avisos.push('La combinacion ' + (idDe(c) || mesa_ids.join('+')) + ' nombra mesas que no estan: ' + faltan.join(', '));
    return { id: idDe(c) || 'combo:' + mesa_ids.slice().sort().join('+'), mesa_ids, capacidad_min: Number(c.seatsMin) || 0,
      capacidad_max: Math.max(1, Number(c.seatsMax) || 0), activa: c.isActive !== false && !faltan.length, origen: 'wix' };
  });
  const bs = (o.businessSchedule && lista(o.businessSchedule.periods).length) ? o.businessSchedule
    : ((ub && ub.location && ub.location.businessSchedule) || {});
  const horario = horarioDePeriodos(bs.periods).map((h) => Object.assign(h, { origen: 'wix' }));
  if (!horario.length) avisos.push('Wix no trae horario de reservas (businessSchedule): el motor no daria ninguna franja.');
  const especiales = lista(bs.specialHourPeriod).concat(lista(o.businessSchedule && o.businessSchedule !== bs ? o.businessSchedule.specialHourPeriod : []));
  const cierres = cierresDePeriodos(especiales);
  if (cfg.paymentPolicy && cfg.paymentPolicy.paymentPolicyType && cfg.paymentPolicy.paymentPolicyType !== 'UNKNOWN_PAYMENT_POLICY') {
    avisos.push('Wix cobra por reserva (' + cfg.paymentPolicy.paymentPolicyType + '): el motor propio todavia no cobra anticipos.');
  }
  return { mesas, combinaciones, horario, cierres, reglas: reglasDeConfiguracion(cfg), avisos };
}

// ---------------------------------------------------------------- reservas de wix_reservas

/** Valor de un campo del formulario por su nombre (mismas expresiones que valorCampo de reservations.web.js). */
function campoPorNombre(campos, re) {
  const k = Object.keys(campos || {}).find((n) => re.test(String(n).toLowerCase()));
  const v = k ? campos[k] : '';
  return v == null ? '' : String(v);
}

/**
 * Una fila de wix_reservas → fila de reservas (origen 'wix'). null si no se copia (HELD: un carrito de Wix, no una reserva).
 * La reserva conserva el id de Wix como id propio y como id_externo: asi el bot, la Central y "Mi reserva"
 * siguen encontrandola con el mismo id despues del cambio.
 */
function reservaDeWix(w, duracionPorDefecto) {
  const estado = C.estadoDeWix(w.estado);
  if (!estado || !w.id || !w.inicio || !w.personas) return null;
  const inicio = new Date(w.inicio);
  let fin = w.fin ? new Date(w.fin) : null;
  if (!fin || isNaN(fin) || fin <= inicio) fin = new Date(inicio.getTime() + (duracionPorDefecto || 120) * 60000);
  const campos = w.campos || {};
  const optin = String(w.optin || '').toUpperCase();
  const email = w.email ? C.correoClave(w.email) : null;
  const telefono = w.telefono ? C.telE164(w.telefono) : null;
  const alergias = campoPorNombre(campos, /alerg|allerg/);
  return {
    id: String(w.id), origen: 'wix', id_externo: String(w.id), canal: String(w.fuente || '').toLowerCase(),
    inicio, fin, duracion_min: Math.round((fin - inicio) / 60000), personas: Number(w.personas),
    mesa_ids: (w.mesa_ids || []).map(String), estado, aprobacion_manual: estado === 'pendiente',
    nombre: String(w.nombre || ''), apellido: String(w.apellido || ''), email, telefono, llave_crm: C.llaveCrm(email, telefono),
    idioma: 'es',
    optin: optin === 'SI' || optin === 'SÍ' ? true : optin === 'NO' ? false : (w.consentimiento == null ? null : !!w.consentimiento),
    alergias: /^(ninguna|none|n\/a)$/i.test(alergias.trim()) ? '' : alergias,
    sentarse: campoPorNombre(campos, /sentar|seat|indoor|pergola|garden|prefer/),
    conocio: campoPorNombre(campos, /conoc|find us|hear|referral|social|google/),
    nota_equipo: String(w.notas_equipo || ''), consumo_q: w.consumo_q == null ? null : Number(w.consumo_q),
    motivo_rechazo: w.motivo_rechazo || null, creada: w.creada ? new Date(w.creada) : new Date()
  };
}

/** Las que se copian: desde el inicio de `desdeFecha` (AAAA-MM-DD de Guatemala) en adelante. */
function reservasFuturasDeWix(filas, desdeFecha, duracionPorDefecto) {
  const t = C.instante(desdeFecha, '00:00').getTime();
  return lista(filas).filter((w) => w.inicio && new Date(w.inicio).getTime() >= t)
    .map((w) => reservaDeWix(w, duracionPorDefecto)).filter(Boolean);
}

module.exports = { DIAS, zonaDeNombre, horarioDePeriodos, cierresDePeriodos, instanteWix, reglasDeConfiguracion, traducirUbicacion,
  reservaDeWix, reservasFuturasDeWix };
