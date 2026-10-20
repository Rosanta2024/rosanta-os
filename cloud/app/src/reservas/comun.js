/**
 * Motor de reservas · utilidades comunes (20-oct-2026).
 *
 * Hora de Guatemala: UTC-6 FIJO (Guatemala no tiene horario de verano). Todo lo que entra o sale como
 * "fecha" (AAAA-MM-DD) u "hora" (HH:MM) es hora de Guatemala; lo que se guarda es un instante (Date / ISO UTC).
 * Son las mismas cuentas que http-functions.js de Wix (botHoraGt, botDiaGt, botTelE164, botTelClave...).
 */
const ZONA = '-06:00';
const DESFASE_MS = 6 * 3600000;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;

/** AAAA-MM-DD de Guatemala de un instante. '' si no es fecha. */
function diaGt(v) {
  const t = new Date(v).getTime();
  return isNaN(t) ? '' : new Date(t - DESFASE_MS).toISOString().substring(0, 10);
}
/** HH:MM de Guatemala de un instante. */
function horaGt(v) {
  const t = new Date(v).getTime();
  return isNaN(t) ? '' : new Date(t - DESFASE_MS).toISOString().substring(11, 16);
}
/** Instante de una fecha y hora de Guatemala. Offset explicito siempre. */
function instante(fecha, hora) {
  return new Date(String(fecha) + 'T' + String(hora || '00:00') + ':00' + ZONA);
}
/** 0 = domingo ... 6 = sabado, de una fecha AAAA-MM-DD. */
function diaSemana(fecha) {
  return new Date(String(fecha) + 'T12:00:00Z').getUTCDay();
}
/** Fecha AAAA-MM-DD + n dias. */
function sumarDias(fecha, n) {
  const d = new Date(String(fecha) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().substring(0, 10);
}
/** 'HH:MM' o 'HH:MM:SS' → minutos desde la medianoche. '24:00' = 1440. */
function minutosDe(hora) {
  const m = String(hora || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
/** Minutos → 'HH:MM'. */
function horaDeMinutos(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function fechaValida(f) {
  if (!RE_FECHA.test(String(f || ''))) return false;
  const d = new Date(String(f) + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().substring(0, 10) === String(f);
}

// ---------------------------------------------------------------- personas

/** Cualquier formato → E.164. 8 digitos sin prefijo = Guatemala (igual que botTelE164 / telE164 de Wix). */
function telE164(t) {
  let s = String(t || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.length === 8) s = '502' + s;
  return '+' + s;
}
/** Ultimos 8 digitos (esquiva +502 / sin prefijo / extranjero), como botTelClave. */
function tel8(t) {
  const s = String(t || '').replace(/[^0-9]/g, '');
  return s.length > 8 ? s.slice(-8) : s;
}
function correoClave(e) { return String(e || '').trim().toLowerCase(); }
/** Nombre sin acentos ni mayusculas; minimo 3 letras (botNombreClave). */
function nombreClave(n) {
  const s = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return s.length >= 3 ? s : '';
}
/** Llave del CRM, la misma de CRMSync: 'e:'+correo, o 't:'+ultimos 8 del telefono. */
function llaveCrm(email, telefono) {
  const e = correoClave(email);
  if (e) return 'e:' + e;
  const t = tel8(telefono);
  return t ? 't:' + t : null;
}
/** Ultimos 4 del telefono, para los registros sin datos personales completos. */
function tel4(t) { return String(t || '').slice(-4); }

// ---------------------------------------------------------------- estados

const ESTADOS = ['pendiente', 'confirmada', 'llego', 'termino', 'no_vino', 'cancelada', 'rechazada'];
/** Los que ocupan mesa y cuentan para el ritmo. */
const OCUPAN = ['pendiente', 'confirmada', 'llego'];
/** Los que el bot puede consultar, cambiar o cancelar (Wix: solo RESERVED; aqui tambien la pendiente). */
const VIGENTES = ['confirmada', 'pendiente'];

const A_WIX = { pendiente: 'REQUESTED', confirmada: 'RESERVED', llego: 'SEATED', termino: 'FINISHED', no_vino: 'NO_SHOW',
  cancelada: 'CANCELED', rechazada: 'DECLINED' };
const DE_WIX = { REQUESTED: 'pendiente', RESERVED: 'confirmada', SEATED: 'llego', FINISHED: 'termino', NO_SHOW: 'no_vino',
  CANCELED: 'cancelada', DECLINED: 'rechazada' };
function estadoWix(e) { return A_WIX[e] || String(e || '').toUpperCase(); }
function estadoDeWix(s) { return DE_WIX[String(s || '').toUpperCase()] || null; }

/** Canal del bot → origen de la reserva. */
function origenDeCanal(canal) {
  const c = String(canal || '').toLowerCase();
  if (c === 'whatsapp') return 'bot_whatsapp';
  if (c === 'instagram') return 'bot_instagram';
  if (c === 'messenger' || c === 'facebook') return 'bot_messenger';
  if (c === 'correo' || c === 'email') return 'bot_correo';
  if (c === 'restaurante') return 'restaurante';
  return 'bot';
}

module.exports = {
  ZONA, DESFASE_MS, RE_FECHA, RE_HORA, diaGt, horaGt, instante, diaSemana, sumarDias, minutosDe, horaDeMinutos, fechaValida,
  telE164, tel8, tel4, correoClave, nombreClave, llaveCrm,
  ESTADOS, OCUPAN, VIGENTES, estadoWix, estadoDeWix, origenDeCanal
};
