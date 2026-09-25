/*
 * ============================================================
 *  ROSANTA · backend/crmReservas.js
 *  Manda cada reserva de Wix al CRM, apenas ocurre.
 *  Creado: 3 de agosto de 2026
 * ------------------------------------------------------------
 *  Se conecta con intakeReserva() del Apps Script "Rosanta
 *  Marketing OS". Cubre las reservas hechas en la web y también
 *  las que el equipo mete desde el panel, porque los eventos de
 *  Wix se disparan igual en ambos casos.
 *
 *  Regla de oro: si el CRM falla, la reserva sigue su curso.
 *  Todo va envuelto en try/catch y nunca lanza el error hacia
 *  arriba. Jamás debe romper una reserva de un cliente.
 * ============================================================
 */

import { fetch } from 'wix-fetch';

const WEBHOOK_CRM =
  'https://script.google.com/macros/s/AKfycbzEv9C1gZ6-bODUyI2a5TPCtLVQGt5T-7gQs60TP8OYmDgymZTHQuv3hR-232cng7K3/exec'
  + '?token=rosanta2026xy&hook=reserva';

// Campo personalizado "Consumo total de la mesa (Q)"
const CAMPO_CONSUMO = 'bf07b3fc-04f2-4851-9a91-0ec9575ab099';

/**
 * Envía una reserva al CRM. Se le pasa la reserva tal como viene
 * del evento de Wix. Nunca lanza error.
 */
export async function enviarReservaAlCRM(reserva) {
  try {
    if (!reserva) return { ok: false, motivo: 'reserva vacía' };

    const detalles = reserva.details || {};
    const quien    = reserva.reservee || {};

    const nombre = [quien.firstName, quien.lastName]
      .filter(Boolean).join(' ').trim();

    const cuerpo = {
      id:       reserva._id || reserva.id || '',
      fecha:    aFecha(detalles.startDate || reserva.startDate),
      nombre:   nombre,
      email:    (quien.email || '').trim().toLowerCase(),
      telefono: (quien.phone || '').trim(),
      personas: Number(detalles.partySize || 0) || 0,
      gasto:    leerConsumo(reserva),
      estado:   (reserva.status || '').toString().toUpperCase()
    };

    // Sin ninguna forma de identificar a la persona, no vale la pena enviarla
    if (!cuerpo.id && !cuerpo.email && !cuerpo.telefono) {
      return { ok: false, motivo: 'reserva sin id ni contacto' };
    }

    const res = await fetch(WEBHOOK_CRM, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });

    const texto = await res.text();
    console.log('CRM reserva enviada:', cuerpo.id, cuerpo.estado, '→', texto);
    return { ok: true, respuesta: texto };

  } catch (err) {
    // A propósito solo se registra: una falla del CRM jamás rompe la reserva
    console.error('CRM reserva falló:', err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Fecha en formato yyyy-MM-dd, en hora de Guatemala.
 *
 * OJO, aquí hubo un error el 3-ago-2026: se formateaba con toISOString(), que
 * es UTC. Guatemala está en UTC-6 y Rosanta abre a las 5 de la tarde, así que
 * TODA reserva de la noche se guardaba con la fecha del día siguiente
 * (una reserva del 10 a las 6:15 PM se registraba como 11). Se detectó
 * comparando el dashboard de Wix contra la pestaña reservas.
 */
function aFecha(valor) {
  if (!valor) return '';
  const d = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(d.getTime())) return '';
  // 'en-CA' entrega justo yyyy-MM-dd; la zona hace el resto.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

/**
 * Lee el consumo del campo personalizado. Wix lo entrega en formatos
 * distintos según por dónde venga, así que se revisan todos.
 */
function leerConsumo(reserva) {
  const posibles = [
    reserva?.reservee?.customFields,
    reserva?.details?.customFields,
    reserva?.customFields
  ];

  for (const campos of posibles) {
    if (!campos) continue;

    // Formato objeto: { "<id>": "745" }
    if (!Array.isArray(campos) && typeof campos === 'object') {
      const v = campos[CAMPO_CONSUMO];
      if (v !== undefined && v !== null && v !== '') return aNumero(v);
    }

    // Formato lista: [{ id / fieldId / _id, value }]
    if (Array.isArray(campos)) {
      const hit = campos.find(c =>
        c && (c.id === CAMPO_CONSUMO || c.fieldId === CAMPO_CONSUMO || c._id === CAMPO_CONSUMO));
      if (hit && hit.value !== undefined && hit.value !== null && hit.value !== '') {
        return aNumero(hit.value);
      }
    }
  }
  return 0;
}

/** Convierte "Q1,250.50" o "1250.50" en 1250.5. */
function aNumero(v) {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
