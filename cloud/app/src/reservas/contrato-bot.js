/**
 * Motor de reservas · contrato del BOT (20-oct-2026). El MISMO de http-functions.js de Wix (rosanta-wix main):
 *   GET  reservaPing    POST reservaBot     GET cancelarPing    POST cancelarBot    POST consultarBot    POST cambiarBot
 * Mismos campos de entrada, mismas respuestas, mismos "motivo" y mismos codigos HTTP (ok 200, badRequest 400,
 * serverError 500). Asi el bot solo cambia su URL base (WIX_RESERVAS_URL) y deriva las demas igual que hoy
 * (base.replace(/\/[^\/]*$/, '/cancelarBot')).
 *
 * El secreto viene en el cuerpo ("secreto") y se compara en tiempo constante con BOT_RESERVAS_SECRETO.
 * Cada funcion devuelve { status, body }; la ruta solo lo escribe.
 *
 * Diferencias a proposito con Wix (anotadas para la sombra):
 *   - "vigente" incluye la pendiente de aprobacion (Wix solo veia RESERVED): el cliente puede consultar o cancelar
 *     una reserva que el equipo aun no aprobo.
 *   - al cambiar, la reserva propia no se cuenta contra si misma (Wix la contaba hasta modificarla).
 *   - cambiarBot siempre modifica la misma reserva (modo 'modificada'): nunca hace falta "crear y cancelar".
 */
const crypto = require('crypto');
const C = require('./comun');
const D = require('./disponibilidad');

const BOT_MAX = 15;   // tope duro del contrato; el valor vivo sale de reglas_reservas.tope_bot

function res(status, body) { return { status, body }; }

/** Compara en tiempo constante. Sin secreto configurado, rechaza siempre. */
function secretoOk(valor, esperado) {
  if (!valor || !esperado) return false;
  const a = crypto.createHash('sha256').update(String(valor)).digest();
  const b = crypto.createHash('sha256').update(String(esperado)).digest();
  return crypto.timingSafeEqual(a, b) && String(valor).length === String(esperado).length;
}

function detalle(e) { return String((e && e.message) || e).slice(0, 300); }

/**
 * Crea el contrato. ctx = { motor, secreto (BOT_RESERVAS_SECRETO), registrar, avisos (opcional: el aviso grupo_grande) }.
 */
function crearContratoBot(ctx) {
  const motor = ctx.motor;
  const log = ctx.registrar || ((m) => console.log(m));

  function previo(d) {
    if (!d || typeof d !== 'object') return res(400, { ok: false, motivo: 'BODY_INVALIDO' });
    if (!secretoOk(d.secreto, ctx.secreto)) return res(400, { ok: false, motivo: 'SECRETO_INVALIDO' });
    return null;
  }

  async function topeBot() {
    try { return (await motor.config()).reglas.tope_bot || BOT_MAX; } catch (e) { return BOT_MAX; }
  }

  /** GET reservaPing: sin secreto ni datos personales. */
  async function reservaPing() {
    try {
      const fr = await motor.franjasBot(new Date(motor.reloj()), 2);
      return res(200, { ok: true, ubicacion: 'ok', franjas: fr.length, disponibles: fr.filter((s) => s.estado === 'AVAILABLE').length });
    } catch (e) {
      log('BOT PING error: ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO' });
    }
  }

  /** POST reservaBot { secreto, nombre, apellido, email, telefono, fecha, hora, personas, optin, canal } */
  async function reservaBot(d) {
    const p = previo(d); if (p) return p;
    const falta = [];
    if (!d.nombre) falta.push('nombre');
    if (!d.telefono) falta.push('telefono');
    if (!d.email) falta.push('email');
    if (!d.fecha) falta.push('fecha');
    if (!d.hora) falta.push('hora');
    if (falta.length) return res(400, { ok: false, motivo: 'FALTAN_DATOS', campos: falta });
    const personas = Number(d.personas);
    if (!Number.isInteger(personas) || personas < 1) return res(400, { ok: false, motivo: 'PERSONAS_INVALIDO' });
    const max = await topeBot();
    if (personas > max) {
      if (ctx.avisos) {
        Promise.resolve().then(() => ctx.avisos({ nombre: String(d.nombre), apellido: String(d.apellido || ''), email: String(d.email), telefono: C.telE164(d.telefono),
          fecha: String(d.fecha), hora: String(d.hora), personas, canal: String(d.canal || '') }, 'grupo_grande')).catch((e) => log('aviso grupo_grande: ' + detalle(e)));
      }
      return res(200, { ok: false, motivo: 'grupo_grande', max });
    }
    if (!C.RE_FECHA.test(String(d.fecha)) || !C.RE_HORA.test(String(d.hora))) return res(400, { ok: false, motivo: 'FECHA_INVALIDA' });
    const inicio = C.instante(d.fecha, d.hora);
    if (isNaN(inicio.getTime())) return res(400, { ok: false, motivo: 'FECHA_INVALIDA' });
    const ahora = motor.reloj();
    if (inicio.getTime() < ahora - 5 * 60000) return res(400, { ok: false, motivo: 'FECHA_EN_PASADO' });
    if (inicio.getTime() > ahora + 365 * 24 * 3600000) return res(400, { ok: false, motivo: 'FECHA_MUY_LEJANA' });

    try {
      const optin = String(d.optin || '').toUpperCase();
      const r = await motor.crear({
        nombre: String(d.nombre), apellido: String(d.apellido || ''), email: String(d.email), telefono: d.telefono, inicio, personas,
        origen: C.origenDeCanal(d.canal), canal: String(d.canal || ''), optin: optin === 'SI' ? true : optin === 'NO' ? false : null,
        idioma: String(d.idioma || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'
      }, { canal: 'bot', quien: 'bot:' + (d.canal || '?'), duplicados: 'bot' });
      if (r.duplicada) {
        log('BOT RESERVA duplicada - tel ...' + C.tel4(d.telefono) + ' - ' + d.fecha + ' ' + d.hora);
        return res(200, { ok: true, duplicada: true, estado: C.estadoWix(r.reserva.estado), id: r.reserva.id, inicio: inicio.toISOString(), hora: C.horaGt(inicio) });
      }
      if (!r.ok) {
        const alternativas = D.alternativas(r.libres || [], inicio, 4);
        log('BOT RESERVA sin disponibilidad - ' + d.fecha + ' ' + d.hora + ' - ' + personas + 'p - alternativas: ' + alternativas.join(', '));
        return res(200, { ok: false, motivo: 'sin_disponibilidad', alternativas });
      }
      log('BOT RESERVA OK - tel ...' + C.tel4(d.telefono) + ' - ' + personas + 'p - ' + d.fecha + ' ' + d.hora + ' - canal ' + (d.canal || '?'));
      return res(200, { ok: true, estado: C.estadoWix(r.reserva.estado), id: r.reserva.id, inicio: inicio.toISOString(), hora: C.horaGt(inicio) });
    } catch (e) {
      if (e && e.motivo === 'MOTOR_EN_WIX') return res(503, { ok: false, motivo: 'MOTOR_EN_WIX' });
      log('BOT RESERVA excepcion - tel ...' + C.tel4(d.telefono) + ' - ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO', detalle: detalle(e) });
    }
  }

  /** GET cancelarPing: cuantas reservas confirmadas hay hoy. Sin datos personales. */
  async function cancelarPing() {
    try {
      const hoy = C.diaGt(motor.reloj());
      const r = await motor.buscarVigentes({ fecha: hoy, telefono: '', email: '' });
      return res(200, { ok: true, dia: hoy, reservadas_hoy: r.todas });
    } catch (e) {
      log('BOT CANCELA PING error: ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO', detalle: detalle(e) });
    }
  }

  const fila = (r) => ({ fecha: C.diaGt(r.inicio), hora: C.horaGt(r.inicio), personas: r.personas });
  const nombreDe = (r) => String(r.nombre || '') + (r.apellido ? ' ' + r.apellido : '');

  /** POST cancelarBot { secreto, telefono, email, fecha?, hora?, todas? } */
  async function cancelarBot(d) {
    const p = previo(d); if (p) return p;
    const telC = C.tel8(d.telefono), mailC = C.correoClave(d.email);
    if (!telC && !mailC) return res(400, { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email'] });
    try {
      const b = await motor.buscarVigentes({ telefono: d.telefono, email: d.email, fecha: d.fecha, hora: d.hora });
      const mias = b.mias.slice(0, 10);
      if (!mias.length) {
        log('BOT CANCELA sin coincidencia - tel ...' + C.tel4(d.telefono) + ' - candidatas en el rango: ' + b.todas);
        return res(200, { ok: false, motivo: b.todas ? 'SIN_COINCIDENCIA' : 'NO_ENCONTRADA' });
      }
      const cancelar = (r) => motor.cambiarEstado(r.id, 'cancelada', { quien: 'bot', motivo: 'Cancelada por el cliente (bot)', soloDesde: C.VIGENTES });
      if (d.todas === true && mias.length > 1) {
        for (const r of mias) await cancelar(r);
        return res(200, { ok: true, canceladas: mias.length, cancelada: Object.assign(fila(mias[0]), { nombre: '', email: '' }) });
      }
      if (mias.length > 1) return res(200, { ok: false, motivo: 'VARIAS', cuantas: mias.length, opciones: mias.map(fila) });
      const r = mias[0];
      const hecho = await cancelar(r);
      if (!hecho.ok) throw new Error(hecho.mensaje || hecho.motivo);
      log('BOT CANCELA ok - ' + C.diaGt(r.inicio) + ' ' + C.horaGt(r.inicio) + ' - tel ...' + C.tel4(d.telefono));
      return res(200, { ok: true, cancelada: { nombre: nombreDe(r), email: String(r.email || ''), fecha: C.diaGt(r.inicio), hora: C.horaGt(r.inicio), personas: r.personas } });
    } catch (e) {
      if (e && e.motivo === 'MOTOR_EN_WIX') return res(503, { ok: false, motivo: 'MOTOR_EN_WIX' });
      log('BOT CANCELA excepcion - tel ...' + C.tel4(d.telefono) + ' - ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO', detalle: detalle(e) });
    }
  }

  /** POST consultarBot { secreto, telefono, email, nombre?, fecha?, detalle? }. SOLO LEE. */
  async function consultarBot(d) {
    const p = previo(d); if (p) return p;
    const telC = C.tel8(d.telefono), mailC = C.correoClave(d.email), nomC = C.nombreClave(d.nombre);
    if (!telC && !mailC && !nomC) return res(400, { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email', 'nombre'] });
    try {
      const b = await motor.buscarVigentes({ telefono: d.telefono, email: d.email, nombre: d.nombre, fecha: d.fecha });
      const mias = b.mias.slice(0, 10);
      if (!mias.length) {
        log('BOT CONSULTA sin coincidencia - tel ...' + C.tel4(d.telefono));
        return res(200, { ok: false, motivo: b.todas ? 'SIN_COINCIDENCIA' : 'NO_ENCONTRADA' });
      }
      return res(200, {
        ok: true,
        nombre: String(mias[0].nombre || ''),
        reservas: mias.slice().sort((a, x) => a.inicio - x.inicio).map((r) => {
          const x = fila(r);
          if (d.detalle === true) { x.id = r.id; x.nombre = nombreDe(r); x.email = String(r.email || ''); x.nota = String(r.nota_equipo || ''); }
          return x;
        })
      });
    } catch (e) {
      log('BOT CONSULTA excepcion - ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO', detalle: detalle(e) });
    }
  }

  /** POST cambiarBot { secreto, telefono, email, id?, fecha_actual?, hora_actual?, fecha?, hora?, personas?, nota?, canal? } */
  async function cambiarBot(d) {
    const p = previo(d); if (p) return p;
    const telC = C.tel8(d.telefono), mailC = C.correoClave(d.email);
    const porId = String(d.id || '').trim();
    if (!telC && !mailC && !porId) return res(400, { ok: false, motivo: 'FALTAN_DATOS', campos: ['telefono', 'email', 'id'] });
    const nota = String(d.nota || '').trim().slice(0, 500);
    try {
      let mias;
      if (porId) {
        mias = (await motor.buscarVigentes({ id: porId })).mias;
        if (!mias.length) return res(200, { ok: false, motivo: 'NO_ENCONTRADA' });
      } else {
        const b = await motor.buscarVigentes({ telefono: d.telefono, email: d.email, fecha: d.fecha_actual, hora: d.hora_actual });
        mias = b.mias.slice(0, 10);
        if (!mias.length) return res(200, { ok: false, motivo: b.todas ? 'SIN_COINCIDENCIA' : 'NO_ENCONTRADA' });
      }
      if (mias.length > 1) return res(200, { ok: false, motivo: 'VARIAS', cuantas: mias.length, opciones: mias.map(fila) });
      const vieja = mias[0];
      const antes = fila(vieja);
      const fecha = d.fecha ? String(d.fecha) : antes.fecha;
      const hora = d.hora ? String(d.hora) : antes.hora;
      const personas = d.personas ? Number(d.personas) : Number(antes.personas);
      if (!C.RE_FECHA.test(fecha) || !C.RE_HORA.test(hora)) return res(400, { ok: false, motivo: 'FECHA_INVALIDA', antes });
      if (!Number.isInteger(personas) || personas < 1) return res(400, { ok: false, motivo: 'PERSONAS_INVALIDO', antes });
      const max = await topeBot();
      if (personas > max) return res(200, { ok: false, motivo: 'grupo_grande', max, antes });
      const inicio = C.instante(fecha, hora);
      if (isNaN(inicio.getTime())) return res(400, { ok: false, motivo: 'FECHA_INVALIDA', antes });
      const ahora = motor.reloj();
      if (inicio.getTime() < ahora - 5 * 60000) return res(400, { ok: false, motivo: 'FECHA_EN_PASADO', antes });
      if (inicio.getTime() > ahora + 365 * 24 * 3600000) return res(400, { ok: false, motivo: 'FECHA_MUY_LEJANA', antes });
      const notaNueva = nota ? (vieja.nota_equipo ? String(vieja.nota_equipo) + ' | ' : '') + nota : '';
      const quien = 'bot:' + (d.canal || '?');
      const comun = { nombre: nombreDe(vieja), email: String(vieja.email || '') };
      if (fecha === antes.fecha && hora === antes.hora && personas === Number(antes.personas)) {
        if (!nota) return res(200, { ok: false, motivo: 'SIN_CAMBIOS', antes });
        const r = await motor.cambiar(vieja.id, { nota }, { canal: 'bot', quien });
        log('BOT CAMBIO solo nota - ' + antes.fecha + ' ' + antes.hora + ' - canal ' + (d.canal || '?'));
        return res(200, Object.assign({ ok: true, modo: 'nota', vieja_cancelada: true, antes, ahora: { fecha, hora, personas, id: vieja.id },
          nota: String((r.reserva && r.reserva.nota_equipo) || notaNueva) }, comun));
      }
      const r = await motor.cambiar(vieja.id, nota ? { inicio, personas, nota } : { inicio, personas }, { canal: 'bot', quien });
      if (!r.ok) {
        const libres = (r.libres || []).filter((s) => C.diaGt(s.startDate) === fecha);
        log('BOT CAMBIO sin disponibilidad - ' + fecha + ' ' + hora + ' - ' + personas + 'p - la reserva actual NO se toco');
        return res(200, { ok: false, motivo: libres.length ? 'sin_disponibilidad' : 'sin_disponibilidad_dia', alternativas: D.alternativas(libres, inicio, 4), antes });
      }
      log('BOT CAMBIO ok - ' + antes.fecha + ' ' + antes.hora + ' -> ' + fecha + ' ' + hora + ' - ' + personas + 'p - tel ...' + C.tel4(d.telefono) + ' - canal ' + (d.canal || '?'));
      return res(200, Object.assign({ ok: true, modo: 'modificada', vieja_cancelada: true, error_cancelar: '', error_modificar: '', antes,
        ahora: { fecha, hora, personas, id: vieja.id }, nota: notaNueva }, comun));
    } catch (e) {
      if (e && e.motivo === 'MOTOR_EN_WIX') return res(503, { ok: false, motivo: 'MOTOR_EN_WIX' });
      log('BOT CAMBIO excepcion - tel ...' + C.tel4(d.telefono) + ' - ' + detalle(e));
      return res(500, { ok: false, motivo: 'ERROR_INTERNO', detalle: detalle(e) });
    }
  }

  return { reservaPing, reservaBot, cancelarPing, cancelarBot, consultarBot, cambiarBot };
}

module.exports = { crearContratoBot, secretoOk, BOT_MAX };
