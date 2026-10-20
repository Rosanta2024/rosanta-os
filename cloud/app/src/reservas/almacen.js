/**
 * Motor de reservas · acceso a la base (20-oct-2026). Solo SELECT, INSERT y UPDATE: la app NUNCA borra.
 *
 * Todo lo que escribe va dentro de enTransaccion(pool, fechas, fn): BEGIN, un candado por cada fecha
 * (pg_advisory_xact_lock(51, AAAAMMDD), en orden para no trabarse), fn(cliente), COMMIT. El candado se suelta
 * solo al terminar la transaccion. Asi dos personas que reservan el mismo dia se ponen en fila: la segunda
 * ve la mesa que tomo la primera.
 *
 * `q` es cualquier cosa con query(sql, params): un pg.Pool, un cliente de una transaccion o pg-mem en las pruebas.
 */
const CLASE_CANDADO = 51;   // el numero de la migracion: no choca con otros candados

const COLS = ['id', 'origen', 'id_externo', 'canal', 'inicio', 'duracion_min', 'fin', 'personas', 'mesa_ids', 'estado',
  'aprobacion_manual', 'nombre', 'apellido', 'email', 'telefono', 'llave_crm', 'idioma', 'optin', 'alergias', 'sentarse',
  'conocio', 'nota_equipo', 'consumo_q', 'fuente_trafico', 'cotizacion_id', 'motivo_cancelacion', 'cancelada_por', 'motivo_rechazo'];

/** Fila de la base → objeto con tipos de JS (numeric llega como texto). */
function deFila(r) {
  if (!r) return null;
  const x = Object.assign({}, r);
  x.inicio = new Date(r.inicio); x.fin = new Date(r.fin);
  x.personas = Number(r.personas); x.duracion_min = Number(r.duracion_min);
  x.mesa_ids = Array.isArray(r.mesa_ids) ? r.mesa_ids.map(String) : [];
  x.consumo_q = r.consumo_q == null ? null : Number(r.consumo_q);
  x.version = r.version == null ? 1 : Number(r.version);
  if (typeof x.fuente_trafico === 'string') { try { x.fuente_trafico = JSON.parse(x.fuente_trafico); } catch (e) { x.fuente_trafico = {}; } }
  return x;
}

function aParam(k, v) {
  if (k === 'fuente_trafico') return JSON.stringify(v || {});
  if (v instanceof Date) return v.toISOString();
  return v === undefined ? null : v;
}

/** AAAA-MM-DD → AAAAMMDD (entero), la segunda llave del candado. */
function llaveFecha(fecha) { return Number(String(fecha).replace(/-/g, '')); }

async function enTransaccion(pool, fechas, fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const unicas = [...new Set((fechas || []).filter(Boolean))].sort();
    for (const f of unicas) await c.query('SELECT pg_advisory_xact_lock($1, $2)', [CLASE_CANDADO, llaveFecha(f)]);
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function leerConfig(q) {
  const [reglas, mesas, combinaciones, horario, cierres] = await Promise.all([
    q.query('SELECT clave, valor FROM reglas_reservas'),
    q.query('SELECT id, nombre, zona, capacidad_min, capacidad_max, activa, orden FROM mesas WHERE activa ORDER BY orden, nombre'),
    q.query('SELECT id, mesa_ids, capacidad_min, capacidad_max, activa FROM mesas_combinaciones WHERE activa'),
    q.query(`SELECT dia_semana, desde::text AS desde, hasta::text AS hasta, intervalo_min, duracion_min, max_personas_franja,
      max_grupos_franja, aprobacion_manual_desde, activo FROM horario_reservas WHERE activo`),
    q.query('SELECT id, desde, hasta, cerrado, motivo, activo FROM cierres_reservas WHERE activo')
  ]);
  return { reglas: reglas.rows, mesas: mesas.rows, combinaciones: combinaciones.rows, horario: horario.rows, cierres: cierres.rows };
}

/** Todas las reservas (cualquier estado) que se cruzan con [desde, hasta). */
async function reservasEntre(q, desde, hasta) {
  const r = await q.query('SELECT * FROM reservas WHERE inicio < $2 AND fin > $1 ORDER BY inicio, creada',
    [new Date(desde).toISOString(), new Date(hasta).toISOString()]);
  return r.rows.map(deFila);
}

/** Reservas que EMPIEZAN en [desde, hasta], en los estados pedidos. */
async function reservasQueEmpiezan(q, desde, hasta, estados) {
  const r = await q.query('SELECT * FROM reservas WHERE inicio >= $1 AND inicio <= $2 ORDER BY inicio, creada',
    [new Date(desde).toISOString(), new Date(hasta).toISOString()]);
  return r.rows.map(deFila).filter((x) => !estados || estados.indexOf(x.estado) !== -1);
}

/** Por id propio o por id de Wix. */
async function porId(q, id) {
  const r = await q.query('SELECT * FROM reservas WHERE id = $1 OR id_externo = $1', [String(id)]);
  return deFila(r.rows.find((x) => x.id === String(id)) || r.rows[0]);
}

async function insertar(q, res) {
  const cols = COLS.filter((k) => res[k] !== undefined);
  await q.query('INSERT INTO reservas (' + cols.join(', ') + ', creada, actualizada) VALUES (' + cols.map((_, i) => '$' + (i + 1)).join(', ') +
    ', $' + (cols.length + 1) + ', $' + (cols.length + 1) + ')', cols.map((k) => aParam(k, res[k])).concat([new Date(res.creada || Date.now()).toISOString()]));
  return porId(q, res.id);
}

/** Cambia solo las columnas que vienen; sube la version. */
async function actualizar(q, id, cambios, cuando) {
  const cols = Object.keys(cambios).filter((k) => COLS.indexOf(k) !== -1 && k !== 'id');
  if (!cols.length) return porId(q, id);
  await q.query('UPDATE reservas SET ' + cols.map((k, i) => k + ' = $' + (i + 2)).join(', ') + ', actualizada = $' + (cols.length + 2) +
    ', version = version + 1 WHERE id = $1', [id].concat(cols.map((k) => aParam(k, cambios[k]))).concat([new Date(cuando || Date.now()).toISOString()]));
  return porId(q, id);
}

async function anotar(q, reservaId, quien, evento, cambio, cuando) {
  await q.query('INSERT INTO reservas_historial (reserva_id, quien, evento, cambio, cuando) VALUES ($1, $2, $3, $4, $5)',
    [reservaId, String(quien || ''), evento, JSON.stringify(cambio || {}), new Date(cuando || Date.now()).toISOString()]);
}

async function historial(q, reservaId) {
  const r = await q.query('SELECT id, reserva_id, cuando, quien, evento, cambio FROM reservas_historial WHERE reserva_id = $1 ORDER BY id', [reservaId]);
  return r.rows.map((x) => Object.assign({}, x, { cambio: typeof x.cambio === 'string' ? JSON.parse(x.cambio) : x.cambio }));
}

/** El modo de un interruptor (tabla de la 013). Sin tabla o sin fila: el valor por defecto. */
async function interruptor(q, modulo, porDefecto) {
  try {
    const r = await q.query('SELECT modo FROM interruptores WHERE modulo = $1', [modulo]);
    return (r.rows[0] && r.rows[0].modo) || porDefecto;
  } catch (e) { return porDefecto; }
}

// ---------------------------------------------------------------- cierres

async function insertarCierre(q, c) {
  const r = await q.query(`INSERT INTO cierres_reservas (desde, hasta, cerrado, motivo, origen, id_externo, cotizacion_id, por)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
  [new Date(c.desde).toISOString(), new Date(c.hasta).toISOString(), c.cerrado !== false, c.motivo || '', c.origen || 'equipo',
    c.id_externo || null, c.cotizacion_id || null, c.por || '']);
  return r.rows[0].id;
}
async function apagarCierre(q, id) {
  const r = await q.query('UPDATE cierres_reservas SET activo = false WHERE id = $1 RETURNING id, desde, hasta', [id]);
  return r.rows[0] || null;
}
async function listarCierres(q, desde) {
  const r = await q.query('SELECT id, desde, hasta, cerrado, motivo, origen, activo, por FROM cierres_reservas WHERE activo AND hasta > $1 ORDER BY desde',
    [new Date(desde).toISOString()]);
  return r.rows;
}

module.exports = { CLASE_CANDADO, COLS, deFila, llaveFecha, enTransaccion, leerConfig, reservasEntre, reservasQueEmpiezan, porId, insertar,
  actualizar, anotar, historial, interruptor, insertarCierre, apagarCierre, listarCierres };
