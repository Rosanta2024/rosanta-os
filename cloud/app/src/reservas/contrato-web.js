/**
 * Motor de reservas · contrato del FORMULARIO WEB (20-oct-2026). El MISMO de http-functions.js + reservations.web.js:
 *   GET  slots?date=AAAA-MM-DD&partySize=N   → 200 { slots: [{ startDate, manualApproval }] }
 *                                              400 { error: "Missing 'date' (YYYY-MM-DD)" } · 500 { error }
 *   POST reservar { firstName, lastName, phone, email, partySize, startDate, alergias, sentarse, conocio, optin }
 *        → 200 { ok:true, id, status: 'RESERVED'|'REQUESTED', modo, version } (el formulario mira ok y status)
 *        → 200 { ok:false, error }  (sin lugar, startDate invalido...)
 *        → 400 { ok:false, error: 'Missing required fields' } · 500 { ok:false, error }
 * El formulario manda el cuerpo como text/plain (para no disparar el preflight): se acepta igual.
 * Campos que el formulario de hoy no manda y el nuevo puede mandar: idioma ('es'|'en') y fuente_trafico (utm, gclid...).
 */
const C = require('./comun');

const VERSION = 'motor propio v1 · 2026-10-20';

function res(status, body) { return { status, body }; }

function crearContratoWeb(ctx) {
  const motor = ctx.motor;
  const log = ctx.registrar || ((m) => console.log(m));

  async function slots(query) {
    try {
      const date = query && query.date;
      const partySize = (query && query.partySize) || 2;
      if (!date) return res(400, { error: "Missing 'date' (YYYY-MM-DD)" });
      if (!C.fechaValida(date)) throw new Error('Fecha inválida: ' + String(date).slice(0, 40));
      return res(200, await motor.slotsWeb(String(date), Math.max(1, Number(partySize) || 2)));
    } catch (e) {
      return res(500, { error: String((e && e.message) || e) });
    }
  }

  /** data: el cuerpo ya leido (null si no era JSON). idiomaNavegador: de Accept-Language, si el formulario no manda idioma. */
  async function reservar(data, idiomaNavegador) {
    try {
      if (!data || typeof data !== 'object') throw new Error('Cuerpo invalido: se esperaba JSON.');
      const faltan = ['firstName', 'phone', 'email', 'startDate', 'partySize'].filter((k) => !data[k]);
      if (faltan.length) {
        log('RESERVA RECHAZADA · faltan: ' + faltan.join(', '));
        return res(400, { ok: false, error: 'Missing required fields' });
      }
      const inicio = new Date(data.startDate);
      if (isNaN(inicio.getTime())) return res(200, { ok: false, error: 'startDate inválido' });
      const personas = Number(data.partySize);
      if (!Number.isInteger(personas) || personas < 1) return res(200, { ok: false, error: 'partySize inválido' });
      const optin = String(data.optin || '').toUpperCase();
      const conocio = String(data.conocio || '').trim();
      const alergias = String(data.alergias || '').trim();
      const sentarse = String(data.sentarse || '').trim();
      const idioma = String(data.idioma || idiomaNavegador || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
      const r = await motor.crear({
        nombre: String(data.firstName || '').trim(), apellido: String(data.lastName || '').trim(),
        email: String(data.email || '').trim().toLowerCase(), telefono: data.phone, inicio, personas,
        origen: 'web', canal: 'web', optin: optin === 'SI' ? true : optin === 'NO' ? false : null, idioma,
        alergias: /^(ninguna|none)$/i.test(alergias) ? '' : alergias,
        sentarse: /sin preferencia|no preference/i.test(sentarse) ? '' : sentarse,
        conocio: conocio === '-' || conocio === '—' ? '' : conocio,
        fuente_trafico: data.fuente_trafico && typeof data.fuente_trafico === 'object' ? data.fuente_trafico : {}
      }, { canal: 'web', quien: 'web', duplicados: 'web' });
      if (!r.ok) {
        log('RESERVA FALLIDA · ' + personas + 'p · ' + inicio.toISOString() + ' · tel ...' + C.tel4(data.phone) + ' · ' + (r.franja && r.franja.motivo));
        return res(200, { ok: false, error: 'Time slot not available', motivo: (r.franja && r.franja.motivo) || 'sin_disponibilidad', version: VERSION });
      }
      log('RESERVA OK · ' + personas + 'p · ' + inicio.toISOString() + ' · tel ...' + C.tel4(data.phone) + (r.duplicada ? ' (repetida)' : ''));
      return res(200, { ok: true, id: r.reserva.id, status: C.estadoWix(r.reserva.estado), modo: 'base', errorVisitante: '', version: VERSION });
    } catch (e) {
      if (e && e.motivo === 'MOTOR_EN_WIX') return res(503, { ok: false, error: 'MOTOR_EN_WIX' });
      log('RESERVA EXCEPCION · ' + String((e && e.message) || e));
      return res(500, { ok: false, error: String((e && e.message) || e) });
    }
  }

  return { slots, reservar };
}

module.exports = { crearContratoWeb, VERSION };
