/**
 * Motor de reservas · reglas por defecto y armado de la configuracion (20-oct-2026). Puro: sin red ni base.
 *
 * Lo que manda es la tabla reglas_reservas (migracion 051); lo que no tenga fila toma el valor de aqui.
 * La configuracion completa que usa el motor es:
 *   { reglas, mesas, combinaciones, horario, cierres }
 */
const C = require('./comun');

const POR_DEFECTO = Object.freeze({
  tope_web: 10,              // el formulario ofrece de 1 a 10
  tope_bot: 15,              // BOT_MAX de http-functions.js
  evento_desde: 16,          // mas de 15 → evento (grupo_grande)
  aprobacion: 'grupos',      // automatica | manual | grupos
  aprobacion_desde: 11,
  aprobacion_bot: false,     // el bot confirma directo, como hoy
  intervalo_min: 15,
  duracion_min: 120,
  duraciones: [],            // [{ desde, hasta, minutos }]
  ritmo_personas: null,
  ritmo_grupos: null,
  aviso_minimo_min: 0,
  aviso_maximo_dias: 365,
  en_linea: true,
  pausa_hasta: null,
  usar_mesas: true,
  // Ventana que pide Wix: el formulario ancla a las 19:00 con 40 franjas antes y 24 despues; el bot ancla a la
  // hora pedida con 12 despues (reservations.web.js getSlots / http-functions.js botSlots).
  ventana_web: { ancla: '19:00', antes: 40, despues: 24 },
  ventana_bot_despues: 12,
  // closeTime de Wix es "la ultima hora en que se puede reservar": la franja de "hasta" entra. A confirmar en la sombra.
  cierre_inclusivo: true
});

function num(v, d) { const n = Number(v); return v == null || v === '' || !isFinite(n) ? d : n; }

/** Filas de reglas_reservas ({ clave, valor }) → reglas completas. Las claves desconocidas se ignoran. */
function armarReglas(filas) {
  const r = JSON.parse(JSON.stringify(POR_DEFECTO));
  (filas || []).forEach((f) => {
    if (!f || !(f.clave in r)) return;
    let v = f.valor;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* texto plano */ } }
    r[f.clave] = v;
  });
  ['tope_web', 'tope_bot', 'evento_desde', 'aprobacion_desde', 'intervalo_min', 'duracion_min', 'aviso_minimo_min', 'aviso_maximo_dias']
    .forEach((k) => { r[k] = num(r[k], POR_DEFECTO[k]); });
  ['ritmo_personas', 'ritmo_grupos'].forEach((k) => { r[k] = r[k] == null ? null : num(r[k], null); });
  if (['automatica', 'manual', 'grupos'].indexOf(r.aprobacion) === -1) r.aprobacion = POR_DEFECTO.aprobacion;
  r.duraciones = Array.isArray(r.duraciones) ? r.duraciones.map((d) => ({ desde: num(d.desde, 1), hasta: num(d.hasta, 10000), minutos: num(d.minutos, r.duracion_min) })) : [];
  return r;
}

function horaTexto(t) {
  if (t instanceof Date) return C.horaGt(t);
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
}

/** Filas de la base → configuracion del motor. Solo lo activo. */
function armarConfig(f) {
  const x = f || {};
  return {
    reglas: armarReglas(x.reglas),
    mesas: (x.mesas || []).filter((m) => m.activa !== false).map((m) => ({
      id: String(m.id), nombre: String(m.nombre || m.id), zona: String(m.zona || ''),
      capacidad_min: Number(m.capacidad_min) || 0, capacidad_max: Number(m.capacidad_max) || 0, orden: Number(m.orden) || 0
    })),
    combinaciones: (x.combinaciones || []).filter((m) => m.activa !== false).map((m) => ({
      id: String(m.id), mesa_ids: (m.mesa_ids || []).map(String),
      capacidad_min: Number(m.capacidad_min) || 0, capacidad_max: Number(m.capacidad_max) || 0
    })),
    horario: (x.horario || []).filter((h) => h.activo !== false).map((h) => ({
      dia_semana: Number(h.dia_semana), desde: horaTexto(h.desde), hasta: horaTexto(h.hasta),
      intervalo_min: h.intervalo_min == null ? null : Number(h.intervalo_min),
      duracion_min: h.duracion_min == null ? null : Number(h.duracion_min),
      max_personas_franja: h.max_personas_franja == null ? null : Number(h.max_personas_franja),
      max_grupos_franja: h.max_grupos_franja == null ? null : Number(h.max_grupos_franja),
      aprobacion_manual_desde: h.aprobacion_manual_desde == null ? null : Number(h.aprobacion_manual_desde)
    })),
    cierres: (x.cierres || []).filter((c) => c.activo !== false).map((c) => ({
      id: c.id, desde: new Date(c.desde), hasta: new Date(c.hasta), cerrado: c.cerrado !== false, motivo: String(c.motivo || '')
    }))
  };
}

module.exports = { POR_DEFECTO, armarReglas, armarConfig };
