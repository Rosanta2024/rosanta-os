/**
 * Motor de reservas · lo que se le pasa a los ganchos (20-oct-2026). Puro.
 *
 * Los ganchos son adaptadores INYECTADOS (nada de red aqui):
 *   avisos(reserva, evento, { antes })  correos (antes = la vista de la reserva ANTES del cambio o del cambio de estado, o null)
 *                            correos y WhatsApp (AYUDANTE 2). evento: creada | pendiente | aprobada | rechazada | cambiada |
 *                            cancelada | llego | termino | no_vino | consumo | grupo_grande
 *   crm(payload)             el MISMO cuerpo que manda hoy crmReservas.js de Wix (para que Fase 2 lo reciba igual)
 *   capi(evento)             Meta CAPI (NewReservation), con event_id = id de la reserva (deduplica con el pixel)
 *   espejoWix(reserva, ev)   copia en Wix. APAGADO por defecto (interruptor espejo_wix_reservas); nunca corre en pruebas.
 * Si un gancho falla, la reserva NO se cae: el error solo se registra.
 */
const C = require('./comun');

/**
 * Cuerpo de crmReservas.js › enviarReservaAlCRM:
 *   { id, fecha (AAAA-MM-DD Guatemala), nombre, email, telefono, personas, gasto, estado (RESERVED...), optin (SI|NO|'') }
 * El id es el de Wix si la reserva vino de Wix (asi Marketing OS no la duplica), si no el propio.
 */
function payloadCrm(r) {
  return {
    id: r.id_externo || r.id || '',
    fecha: r.inicio ? C.diaGt(r.inicio) : '',
    nombre: [r.nombre, r.apellido].filter(Boolean).join(' ').trim(),
    email: String(r.email || '').trim().toLowerCase(),
    telefono: String(r.telefono || '').trim(),
    personas: Number(r.personas || 0) || 0,
    gasto: Number(r.consumo_q || 0) || 0,
    estado: C.estadoWix(r.estado),
    optin: r.optin === true ? 'SI' : r.optin === false ? 'NO' : ''
  };
}

/** Lo que necesita capi.js (sendCapiEvent): nombre del evento, event_id y los datos (se hashean del lado del adaptador). */
function payloadCapi(r, evento) {
  return {
    evento: evento || 'NewReservation',
    event_id: String(r.id_externo || r.id),
    event_time: Math.floor(new Date(r.creada || Date.now()).getTime() / 1000),
    event_source_url: 'https://www.rosanta.rest/reservas',
    user: { email: r.email || '', phone: r.telefono || '', firstName: r.nombre || '', lastName: r.apellido || '', externalId: r.llave_crm || '' },
    fuente_trafico: r.fuente_trafico || {},
    origen: r.origen
  };
}

/** La reserva que ven los ganchos (sin columnas internas). */
function vista(r) {
  if (!r) return null;
  return {
    id: r.id, id_externo: r.id_externo || null, origen: r.origen, canal: r.canal || '', estado: r.estado, estado_wix: C.estadoWix(r.estado),
    fecha: C.diaGt(r.inicio), hora: C.horaGt(r.inicio), inicio: new Date(r.inicio).toISOString(), fin: new Date(r.fin).toISOString(),
    duracion_min: r.duracion_min, personas: r.personas, mesa_ids: r.mesa_ids || [], aprobacion_manual: !!r.aprobacion_manual,
    nombre: r.nombre || '', apellido: r.apellido || '', email: r.email || '', telefono: r.telefono || '', llave_crm: r.llave_crm || null,
    idioma: r.idioma || 'es', optin: r.optin == null ? null : !!r.optin, alergias: r.alergias || '', sentarse: r.sentarse || '',
    conocio: r.conocio || '', nota_equipo: r.nota_equipo || '', consumo_q: r.consumo_q == null ? null : Number(r.consumo_q),
    motivo_cancelacion: r.motivo_cancelacion || null, cancelada_por: r.cancelada_por || null, motivo_rechazo: r.motivo_rechazo || null, version: r.version || 1
  };
}

module.exports = { payloadCrm, payloadCapi, vista };
