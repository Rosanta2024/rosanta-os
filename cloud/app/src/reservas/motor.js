/**
 * Motor de reservas · operaciones (20-oct-2026): crear, cambiar, cancelar, consultar, estados, consumo y cierres.
 *
 * Cada escritura: transaccion + candado por fecha (almacen.enTransaccion). Dentro del candado se vuelve a leer
 * todo (configuracion y reservas del dia) y se recalcula la disponibilidad: lo que se vio antes de entrar no vale.
 * Cada cambio queda en reservas_historial. Los ganchos (avisos, crm, capi, espejoWix) corren DESPUES del COMMIT
 * y nunca tumban la reserva.
 *
 * Interruptor motor_reservas (tabla interruptores, cache de 30 s; sin fila = 'wix'):
 *   'wix'  → Wix manda. El motor calcula (sombra) pero NO escribe: cualquier escritura devuelve MOTOR_EN_WIX.
 *   'base' → manda la base.
 *
 * deps: { pool, reloj, ganchos: { avisos, crm, capi, espejoWix }, nuevoId, registrar, escribirEnModoWix }
 */
const crypto = require('crypto');
const C = require('./comun');
const A = require('./almacen');
const D = require('./disponibilidad');
const G = require('./ganchos');
const { armarConfig } = require('./reglas');

const CACHE_MS = 30000;
const MIN = 60000;

/** Transiciones de estado que se permiten desde el panel. */
const TRANSICIONES = {
  pendiente: ['confirmada', 'rechazada', 'cancelada'],
  confirmada: ['llego', 'no_vino', 'cancelada'],
  llego: ['termino', 'no_vino', 'confirmada'],
  no_vino: ['llego', 'confirmada'],
  termino: ['llego'],
  cancelada: [],
  rechazada: []
};
const EVENTO_DE_ESTADO = { confirmada: 'aprobada', rechazada: 'rechazada', cancelada: 'cancelada', llego: 'llego', termino: 'termino', no_vino: 'no_vino' };

class ErrorMotor extends Error {
  constructor(motivo, mensaje, status) { super(mensaje || motivo); this.motivo = motivo; this.status = status || 409; }
}

function crearMotor(deps) {
  const pool = deps.pool;
  const reloj = () => new Date(deps.reloj ? deps.reloj() : Date.now()).getTime();
  const nuevoId = deps.nuevoId || (() => crypto.randomUUID());
  const ganchos = deps.ganchos || {};
  const registrar = deps.registrar || ((m) => console.error(m));
  const cache = {};
  const enVuelo = new Set();

  async function interruptor(modulo, porDefecto) {
    const c = cache[modulo];
    if (c && reloj() - c.t < CACHE_MS) return c.v;
    const v = await A.interruptor(pool, modulo, porDefecto);
    cache[modulo] = { t: reloj(), v };
    return v;
  }
  const modo = async () => ((await interruptor('motor_reservas', 'wix')) === 'base' ? 'base' : 'wix');
  function olvidarInterruptores() { Object.keys(cache).forEach((k) => delete cache[k]); }

  async function exigirBase() {
    if ((await modo()) !== 'base' && !deps.escribirEnModoWix) throw new ErrorMotor('MOTOR_EN_WIX', 'Las reservas todavia las maneja Wix (motor_reservas = wix).', 409);
  }

  async function config(q) { return armarConfig(await A.leerConfig(q || pool)); }

  /** Reservas que pueden tocar el dia (incluye las que vienen de la noche anterior). */
  async function reservasDelDia(q, fecha) {
    return A.reservasEntre(q || pool, C.instante(C.sumarDias(fecha, -1), '00:00'), C.instante(C.sumarDias(fecha, 2), '00:00'));
  }

  // ---------------------------------------------------------------- ganchos (despues del COMMIT)

  function disparar(reserva, evento, que, antes) {
    const v = G.vista(reserva);
    const extra = { antes: antes ? G.vista(antes) : null };
    const tareas = [];
    const correr = (nombre, fn) => {
      if (!fn) return;
      const p = Promise.resolve().then(fn).catch((e) => registrar('reservas · gancho ' + nombre + ' (' + evento + ', ' + v.id + '): ' + String((e && e.message) || e)));
      tareas.push(p);
    };
    if (ganchos.avisos && (!que || que.avisos !== false)) correr('avisos', () => ganchos.avisos(v, evento, extra));
    if (ganchos.crm && (!que || que.crm !== false)) correr('crm', () => ganchos.crm(G.payloadCrm(reserva)));
    if (ganchos.capi && que && que.capi) correr('capi', () => ganchos.capi(G.payloadCapi(reserva, 'NewReservation')));
    if (ganchos.espejoWix && reserva.origen !== 'wix') {
      correr('espejoWix', async () => {
        if ((await modo()) !== 'base') return;
        if ((await interruptor('espejo_wix_reservas', 'apagado')) !== 'encendido') return;
        return ganchos.espejoWix(v, evento);
      });
    }
    tareas.forEach((p) => { enVuelo.add(p); p.finally(() => enVuelo.delete(p)); });
  }
  /** Para las pruebas y para apagar el servidor con calma: espera a que terminen los ganchos. */
  async function esperarGanchos() { while (enVuelo.size) await Promise.allSettled([...enVuelo]); }

  // ---------------------------------------------------------------- lectura

  async function slotsWeb(fecha, personas, excluirId) {
    const [cfg, reservas] = await Promise.all([config(), reservasDelDia(null, fecha)]);
    return D.slotsWeb({ config: cfg, fecha, personas, reservas, ahora: reloj(), excluirId: excluirId || null });
  }

  /** Franjas del bot desde `inicio` (mismo dia). */
  async function franjasBot(inicio, personas, excluirId) {
    const fecha = C.diaGt(inicio);
    const [cfg, reservas] = await Promise.all([config(), reservasDelDia(null, fecha)]);
    return D.franjasBot({ config: cfg, inicio, personas, reservas, ahora: reloj(), excluirId });
  }

  /** Todas las franjas del dia con su estado y motivo (para el panel). */
  async function franjasDia(fecha, personas, canal) {
    const [cfg, reservas] = await Promise.all([config(), reservasDelDia(null, fecha)]);
    return D.franjasDelDia({ config: cfg, fecha, personas, canal: canal || 'equipo', reservas, ahora: reloj() });
  }

  /** Reservas que EMPIEZAN ese dia (todos los estados), con el nombre de las mesas. */
  async function dia(fecha) {
    const [cfg, lista] = await Promise.all([config(), A.reservasQueEmpiezan(pool, C.instante(fecha, '00:00'), new Date(C.instante(C.sumarDias(fecha, 1), '00:00').getTime() - 1))]);
    const nombres = {}; cfg.mesas.forEach((m) => { nombres[m.id] = m.nombre; });
    const reservas = lista.map((r) => Object.assign(G.vista(r), { mesas: r.mesa_ids.map((id) => nombres[id] || id) }));
    const activas = reservas.filter((r) => C.OCUPAN.indexOf(r.estado) !== -1 || r.estado === 'termino');
    return { fecha, reservas, mesas: cfg.mesas, resumen: { reservas: activas.length, personas: activas.reduce((s, r) => s + r.personas, 0),
      pendientes: reservas.filter((r) => r.estado === 'pendiente').length } };
  }

  async function porId(id) { return A.porId(pool, id); }
  async function historial(id) { return A.historial(pool, id); }

  /** Rango del bot: el dia pedido, o de ahora-1h a ahora+90 dias (botRango de http-functions.js). */
  function rangoBot(fecha) {
    if (fecha && C.RE_FECHA.test(String(fecha))) return { desde: C.instante(fecha, '00:00'), hasta: new Date(String(fecha) + 'T23:59:59' + C.ZONA) };
    const t = reloj();
    return { desde: new Date(t - 3600000), hasta: new Date(t + 90 * 86400000) };
  }

  /**
   * Vigentes (confirmada/pendiente) de una persona. f = { telefono, email, nombre, fecha, hora, id }.
   * Devuelve { todas: n vigentes en el rango, mias: [...] } ordenadas por hora.
   */
  async function buscarVigentes(f) {
    if (f.id) {
      const r = await A.porId(pool, f.id);
      const mias = r && C.VIGENTES.indexOf(r.estado) !== -1 ? [r] : [];
      return { todas: mias.length, mias };
    }
    const rango = rangoBot(f.fecha);
    const todas = await A.reservasQueEmpiezan(pool, rango.desde, rango.hasta, C.VIGENTES);
    const telC = C.tel8(f.telefono), mailC = C.correoClave(f.email), nomC = C.nombreClave(f.nombre);
    const mias = todas.filter((r) => (telC && C.tel8(r.telefono) === telC) || (mailC && C.correoClave(r.email) === mailC) ||
      (nomC && C.nombreClave((r.nombre || '') + ' ' + (r.apellido || '')).indexOf(nomC) >= 0))
      .filter((r) => !f.hora || C.horaGt(r.inicio) === String(f.hora));
    return { todas: todas.length, mias };
  }

  // ---------------------------------------------------------------- escritura

  /**
   * Crea una reserva. d = { nombre, apellido, email, telefono, inicio, personas, origen, canal, optin, alergias, sentarse,
   *   conocio, nota_equipo, fuente_trafico, idioma, mesa_ids, estado, cotizacion_id }.
   * o = { canal: 'web'|'bot'|'equipo', quien, forzar, duplicados: 'bot'|'web' }.
   * Devuelve { ok:true, reserva, duplicada? } | { ok:false, motivo, franja, libres }.
   */
  async function crear(d, o) {
    o = o || {};
    await exigirBase();
    const inicio = new Date(d.inicio);
    const fecha = C.diaGt(inicio);
    const canal = o.canal || 'web';
    const r = await A.enTransaccion(pool, [fecha], async (c) => {
      const ahora = reloj();
      const reservas = await reservasDelDia(c, fecha);
      // duplicados, dentro del candado
      if (o.duplicados === 'bot') {
        const t8 = C.tel8(d.telefono), mail = C.correoClave(d.email);
        const igual = reservas.find((x) => new Date(x.inicio).getTime() === inicio.getTime() && x.estado !== 'cancelada' &&
          C.tel8(x.telefono) === t8 && (!mail || !x.email || C.correoClave(x.email) === mail));
        if (igual) return { ok: true, duplicada: true, reserva: igual };
      } else if (o.duplicados === 'web') {
        const t8 = C.tel8(d.telefono);
        const igual = reservas.find((x) => new Date(x.inicio).getTime() === inicio.getTime() && C.VIGENTES.indexOf(x.estado) !== -1 &&
          t8 && C.tel8(x.telefono) === t8 && ahora - new Date(x.creada).getTime() < 10 * MIN);
        if (igual) return { ok: true, duplicada: true, reserva: igual };
      }
      const cfg = await config(c);
      const ocupadas = D.ocupacion(cfg, reservas);
      const franja = D.evaluar({ config: cfg, inicio, personas: d.personas, canal, reservas, ocupadas, ahora, mesasPreferidas: d.mesa_ids && d.mesa_ids.length ? d.mesa_ids : null,
        zonas: C.zonasDe(d.sentarse) });
      if (franja.estado !== 'AVAILABLE' && !o.forzar) {
        const libres = D.franjasBot({ config: cfg, inicio, personas: d.personas, reservas, ahora }).filter((s) => s.estado === 'AVAILABLE');
        return { ok: false, motivo: 'sin_disponibilidad', franja, libres };
      }
      const duracion = franja.duracion_min || D.duracionPara(cfg.reglas, d.personas, null);
      const email = d.email ? C.correoClave(d.email) : null;
      const telefono = d.telefono ? C.telE164(d.telefono) : null;
      const estado = d.estado || (franja.manualApproval ? 'pendiente' : 'confirmada');
      const nueva = {
        id: d.id || nuevoId(), origen: d.origen, canal: String(d.canal || ''), inicio, duracion_min: duracion,
        fin: new Date(inicio.getTime() + duracion * MIN), personas: Number(d.personas),
        mesa_ids: franja.mesa_ids && franja.mesa_ids.length ? franja.mesa_ids : (d.mesa_ids || []),
        estado, aprobacion_manual: !!franja.manualApproval,
        nombre: String(d.nombre || '').trim(), apellido: String(d.apellido || '').trim(), email, telefono, llave_crm: C.llaveCrm(email, telefono),
        idioma: d.idioma === 'en' ? 'en' : 'es', optin: d.optin == null ? null : !!d.optin,
        alergias: String(d.alergias || ''), sentarse: String(d.sentarse || ''), conocio: String(d.conocio || ''),
        nota_equipo: String(d.nota_equipo || '').slice(0, 2000), fuente_trafico: d.fuente_trafico || {}, cotizacion_id: d.cotizacion_id || null,
        creada: new Date(ahora)
      };
      const guardada = await A.insertar(c, nueva);
      await A.anotar(c, guardada.id, o.quien || canal, 'creada', { despues: { estado, inicio: inicio.toISOString(), personas: nueva.personas,
        mesa_ids: nueva.mesa_ids, origen: nueva.origen, forzada: !!(o.forzar && franja.estado !== 'AVAILABLE') } }, ahora);
      return { ok: true, reserva: guardada };
    });
    if (r.ok && !r.duplicada) {
      const ev = r.reserva.estado === 'pendiente' ? 'pendiente' : (r.reserva.estado === 'llego' ? 'llego' : 'creada');
      disparar(r.reserva, ev, { capi: r.reserva.estado === 'confirmada' });
    }
    return r;
  }

  /**
   * Cambia hora, personas, mesa o nota de la MISMA reserva (no cancela y crea: el cliente nunca pierde su mesa).
   * c = { inicio?, personas?, mesa_ids?, nota? (se agrega), nota_equipo? (reemplaza) }. o = { canal, quien, forzar }.
   * Devuelve { ok:true, reserva, antes } | { ok:false, motivo, libres, antes }.
   */
  async function cambiar(id, cambio, o) {
    o = o || {};
    await exigirBase();
    const previa = await A.porId(pool, id);
    if (!previa) throw new ErrorMotor('NO_ENCONTRADA', 'No encontre esa reserva.', 404);
    const nuevoInicio = cambio.inicio ? new Date(cambio.inicio) : previa.inicio;
    const fechas = [C.diaGt(previa.inicio), C.diaGt(nuevoInicio)];
    const r = await A.enTransaccion(pool, fechas, async (c) => {
      const ahora = reloj();
      const vieja = await A.porId(c, previa.id);
      if (C.OCUPAN.indexOf(vieja.estado) === -1 && !o.forzar) return { ok: false, motivo: 'NO_VIGENTE', antes: vieja };
      const personas = cambio.personas ? Number(cambio.personas) : vieja.personas;
      const mueve = nuevoInicio.getTime() !== vieja.inicio.getTime() || personas !== vieja.personas ||
        (cambio.mesa_ids && cambio.mesa_ids.join('|') !== vieja.mesa_ids.join('|'));
      const upd = {};
      if (mueve) {
        const fecha = C.diaGt(nuevoInicio);
        const reservas = await reservasDelDia(c, fecha);
        const cfg = await config(c);
        const franja = D.evaluar({ config: cfg, inicio: nuevoInicio, personas, canal: o.canal || 'bot', reservas, ahora, excluirId: vieja.id,
          mesasPreferidas: cambio.mesa_ids && cambio.mesa_ids.length ? cambio.mesa_ids : null });
        if (franja.estado !== 'AVAILABLE' && !o.forzar) {
          const libres = D.franjasBot({ config: cfg, inicio: nuevoInicio, personas, reservas, ahora, excluirId: vieja.id }).filter((s) => s.estado === 'AVAILABLE');
          return { ok: false, motivo: 'sin_disponibilidad', franja, libres, antes: vieja };
        }
        const duracion = franja.duracion_min || D.duracionPara(cfg.reglas, personas, null);
        Object.assign(upd, { inicio: nuevoInicio, personas, duracion_min: duracion, fin: new Date(nuevoInicio.getTime() + duracion * MIN),
          mesa_ids: franja.mesa_ids && franja.mesa_ids.length ? franja.mesa_ids : (cambio.mesa_ids || vieja.mesa_ids) });
      }
      if (cambio.nota) upd.nota_equipo = ((vieja.nota_equipo ? vieja.nota_equipo + ' | ' : '') + String(cambio.nota)).slice(0, 2000);
      if (cambio.nota_equipo != null) upd.nota_equipo = String(cambio.nota_equipo).slice(0, 2000);
      if (cambio.alergias != null && String(cambio.alergias) !== String(vieja.alergias || '')) upd.alergias = String(cambio.alergias).slice(0, 1000);
      if (!Object.keys(upd).length) return { ok: false, motivo: 'SIN_CAMBIOS', antes: vieja };
      const nueva = await A.actualizar(c, vieja.id, upd, ahora);
      const pick = (x) => ({ inicio: new Date(x.inicio).toISOString(), personas: x.personas, mesa_ids: x.mesa_ids, nota_equipo: x.nota_equipo, alergias: x.alergias || '' });
      await A.anotar(c, vieja.id, o.quien || o.canal || 'bot', mueve ? 'cambiada' : 'nota', { antes: pick(vieja), despues: pick(nueva) }, ahora);
      return { ok: true, reserva: nueva, antes: vieja, mueve };
    });
    if (r.ok) disparar(r.reserva, r.mueve ? 'cambiada' : 'nota', { avisos: r.mueve, crm: r.mueve }, r.antes);
    return r;
  }

  /**
   * Cambia el estado. o = { quien, motivo, forzar, soloDesde: [estados permitidos de origen] (el bot: VIGENTES) }.
   * Al volver a ocupar mesa (no_vino → llego, etc.) revisa que la mesa siga libre.
   */
  async function cambiarEstado(id, nuevo, o) {
    o = o || {};
    await exigirBase();
    if (C.ESTADOS.indexOf(nuevo) === -1) throw new ErrorMotor('ESTADO_INVALIDO', 'Estado desconocido: ' + nuevo, 400);
    const previa = await A.porId(pool, id);
    if (!previa) throw new ErrorMotor('NO_ENCONTRADA', 'No encontre esa reserva.', 404);
    const r = await A.enTransaccion(pool, [C.diaGt(previa.inicio)], async (c) => {
      const ahora = reloj();
      const vieja = await A.porId(c, previa.id);
      if (vieja.estado === nuevo) return { ok: true, reserva: vieja, igual: true };
      const permitido = o.soloDesde ? o.soloDesde.indexOf(vieja.estado) !== -1 : (TRANSICIONES[vieja.estado] || []).indexOf(nuevo) !== -1;
      if (!permitido) return { ok: false, motivo: 'TRANSICION_INVALIDA', mensaje: 'No se puede pasar de ' + vieja.estado + ' a ' + nuevo + '.', antes: vieja };
      if (C.OCUPAN.indexOf(nuevo) !== -1 && C.OCUPAN.indexOf(vieja.estado) === -1 && vieja.mesa_ids.length && !o.forzar) {
        const reservas = await reservasDelDia(c, C.diaGt(vieja.inicio));
        const choca = reservas.some((x) => x.id !== vieja.id && C.OCUPAN.indexOf(x.estado) !== -1 && x.inicio < vieja.fin && x.fin > vieja.inicio &&
          x.mesa_ids.some((m) => vieja.mesa_ids.indexOf(m) !== -1));
        if (choca) return { ok: false, motivo: 'MESA_OCUPADA', mensaje: 'Esa mesa ya la tomo otra reserva.', antes: vieja };
      }
      const upd = { estado: nuevo };
      if (nuevo === 'cancelada') { upd.motivo_cancelacion = o.motivo || null; upd.cancelada_por = o.quien || null; }
      if (nuevo === 'rechazada') upd.motivo_rechazo = o.motivo || null;
      const nueva = await A.actualizar(c, vieja.id, upd, ahora);
      await A.anotar(c, vieja.id, o.quien || 'sistema', 'estado', { antes: { estado: vieja.estado }, despues: { estado: nuevo, motivo: o.motivo || null } }, ahora);
      return { ok: true, reserva: nueva, antes: vieja };
    });
    if (r.ok && !r.igual) disparar(r.reserva, EVENTO_DE_ESTADO[nuevo] || nuevo, { capi: nuevo === 'confirmada' && r.antes.estado === 'pendiente' }, r.antes);
    return r;
  }

  async function consumo(id, monto, o) {
    o = o || {};
    await exigirBase();
    const texto = String(monto == null ? '' : monto);
    const n = Number(texto.replace(/[^0-9.\-]/g, ''));
    if (!/\d/.test(texto) || !isFinite(n) || n < 0) throw new ErrorMotor('MONTO_INVALIDO', 'El consumo va en quetzales, sin letras.', 400);
    const previa = await A.porId(pool, id);
    if (!previa) throw new ErrorMotor('NO_ENCONTRADA', 'No encontre esa reserva.', 404);
    const r = await A.enTransaccion(pool, [C.diaGt(previa.inicio)], async (c) => {
      const vieja = await A.porId(c, previa.id);
      const nueva = await A.actualizar(c, vieja.id, { consumo_q: Math.round(n * 100) / 100 }, reloj());
      await A.anotar(c, vieja.id, o.quien || 'sistema', 'consumo', { antes: { consumo_q: vieja.consumo_q }, despues: { consumo_q: nueva.consumo_q } }, reloj());
      return { ok: true, reserva: nueva };
    });
    disparar(r.reserva, 'consumo', { avisos: false });
    return r;
  }

  // ---------------------------------------------------------------- cierres

  /** Cierra un dia entero (fecha) o un rango (desde/hasta en hora de Guatemala). */
  async function cerrar(c, o) {
    await exigirBase();
    let desde, hasta;
    if (c.fecha) {
      if (!C.fechaValida(c.fecha)) throw new ErrorMotor('FECHA_INVALIDA', 'La fecha va como AAAA-MM-DD.', 400);
      const ultima = c.hasta_fecha && C.fechaValida(c.hasta_fecha) ? c.hasta_fecha : c.fecha;
      desde = C.instante(c.fecha, '00:00'); hasta = C.instante(C.sumarDias(ultima, 1), '00:00');
    } else { desde = new Date(c.desde); hasta = new Date(c.hasta); }
    if (isNaN(desde) || isNaN(hasta) || hasta <= desde) throw new ErrorMotor('RANGO_INVALIDO', 'El cierre necesita un rango valido.', 400);
    const id = await A.insertarCierre(pool, { desde, hasta, cerrado: c.cerrado !== false, motivo: c.motivo || '', origen: c.origen || 'equipo',
      cotizacion_id: c.cotizacion_id || null, id_externo: c.id_externo || null, por: (o && o.quien) || '' });
    // Las reservas vigentes que caen en el cierre NO se cancelan solas: el equipo decide (se devuelven para avisar).
    const afectadas = (await A.reservasQueEmpiezan(pool, desde, new Date(hasta.getTime() - 1), C.VIGENTES)).map(G.vista);
    return { ok: true, id, desde: desde.toISOString(), hasta: hasta.toISOString(), afectadas };
  }
  async function reabrir(id) { await exigirBase(); const r = await A.apagarCierre(pool, id); return r ? { ok: true, id: r.id } : { ok: false, motivo: 'NO_ENCONTRADO' }; }
  async function cierres() { return A.listarCierres(pool, new Date(reloj() - 86400000)); }

  return { modo, olvidarInterruptores, config, slotsWeb, franjasBot, franjasDia, dia, porId, historial, rangoBot, buscarVigentes,
    crear, cambiar, cambiarEstado, consumo, cerrar, reabrir, cierres, esperarGanchos, reloj };
}

module.exports = { crearMotor, ErrorMotor, TRANSICIONES };
