/**
 * La tabla `envios` (migracion 052): cada aviso que sale, que esta en cola o que no salio, y por que.
 * Solo SELECT, INSERT y UPDATE: la app nunca borra. `q` es cualquier cosa con query(sql, params) (pg.Pool o pg-mem).
 *
 * IDEMPOTENCIA en dos pasos:
 *   1. apartar(): INSERT ... ON CONFLICT (clave) DO NOTHING con una `ficha` al azar, y despues se lee la fila por
 *      su clave. Si la ficha es la mia, el aviso es nuevo; si no, ya existia (otro reloj o el mismo evento dos veces).
 *      La clave es plantilla:reserva[:lo que lo hace distinto]:canal, UNIQUE en la base.
 *   2. reclamar(): UPDATE condicionado a los intentos que yo vi. Si dos procesos quieren mandar la misma fila a la
 *      vez, solo uno gana. A Resend ademas le llega la clave como Idempotency-Key.
 */
const crypto = require('crypto');

const MAX_INTENTOS = 3;
const COLS = 'id, clave, ficha, reserva_id, canal, plantilla, idioma, para_equipo, destinatario, modo, estado, proveedor, proveedor_id, ' +
  'intentos, programado_para, contexto, error, creado, enviado, actualizado';

const iso = (d) => new Date(d).toISOString();
function deFila(r) {
  if (!r) return null;
  const x = Object.assign({}, r);
  x.id = Number(r.id); x.intentos = Number(r.intentos);
  x.programado_para = r.programado_para ? iso(r.programado_para) : null;
  if (typeof x.contexto === 'string') { try { x.contexto = JSON.parse(x.contexto); } catch (e) { x.contexto = {}; } }
  x.contexto = x.contexto || {};
  return x;
}

function crearEnvios(q, reloj) {
  const ahora = () => iso(reloj ? reloj() : Date.now());
  return {
    /** f: { clave, reserva_id, canal, plantilla, idioma, para_equipo, destinatario, destinatario_huella, modo, programado_para, contexto }. */
    async apartar(f) {
      const ficha = crypto.randomUUID();
      await q.query(`INSERT INTO envios (clave, ficha, reserva_id, canal, plantilla, idioma, para_equipo, destinatario, destinatario_huella, modo,
          estado, intentos, programado_para, contexto, creado, actualizado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'programado', 0, $11, $12, $13, $13) ON CONFLICT (clave) DO NOTHING`,
      [f.clave, ficha, f.reserva_id, f.canal, f.plantilla, f.idioma, !!f.para_equipo, f.destinatario, f.destinatario_huella, f.modo,
        iso(f.programado_para || ahora()), JSON.stringify(f.contexto || {}), ahora()]);
      const r = await q.query('SELECT ' + COLS + ' FROM envios WHERE clave = $1', [f.clave]);
      const fila = deFila(r.rows[0]);
      return { fila, nuevo: !!fila && fila.ficha === ficha };
    },
    async reclamar(id, intentos) {
      const r = await q.query(`UPDATE envios SET intentos = intentos + 1, actualizado = $4
        WHERE id = $1 AND intentos = $2 AND estado IN ('programado', 'fallo') AND programado_para <= $4 AND intentos < $3 RETURNING id`,
      [id, intentos, MAX_INTENTOS, ahora()]);
      return r.rows.length === 1;
    },
    /** x: { estado, proveedor?, proveedor_id?, error? } */
    async marcar(id, x) {
      await q.query(`UPDATE envios SET estado = $2, proveedor = coalesce($3, proveedor), proveedor_id = coalesce($4, proveedor_id), error = $5,
          enviado = CASE WHEN $2 = 'enviado' THEN $6::timestamptz ELSE enviado END, actualizado = $6 WHERE id = $1`,
      [id, x.estado, x.proveedor || null, x.proveedor_id || null, x.error ? String(x.error).slice(0, 500) : null, ahora()]);
    },
    async anular(id, motivo) {
      await q.query(`UPDATE envios SET estado = 'anulado', error = $2, actualizado = $3 WHERE id = $1 AND estado IN ('programado', 'fallo')`,
        [id, String(motivo || '').slice(0, 500), ahora()]);
    },
    /** Lo que ya toca: programados cuya hora llego y fallos con intentos de sobra. */
    async pendientes(limite) {
      const r = await q.query('SELECT ' + COLS + ` FROM envios WHERE estado IN ('programado', 'fallo') AND intentos < $2 AND programado_para <= $1
        ORDER BY programado_para, id LIMIT $3`, [ahora(), MAX_INTENTOS, limite || 50]);
      return r.rows.map(deFila);
    },
    /** Los avisos de unas reservas (para el panel). Sin la huella ni la ficha. */
    async deReservas(ids) {
      if (!ids || !ids.length) return [];
      ids = ids.slice(0, 500);   // un dia; IN en vez de ANY (pg-mem no lo resuelve con indice)
      const r = await q.query(`SELECT id, reserva_id, canal, plantilla, idioma, para_equipo, destinatario, modo, estado, intentos, programado_para,
          enviado, error FROM envios WHERE reserva_id IN (` + ids.map((_, i) => '$' + (i + 1)).join(', ') + ') ORDER BY id', ids.map(String));
      return r.rows.map((x) => Object.assign({}, x, { id: Number(x.id), programado_para: x.programado_para ? iso(x.programado_para) : null,
        enviado: x.enviado ? iso(x.enviado) : null }));
    },
    /**
     * Lo que avisa el proveedor despues (webhook). ev: { proveedor, proveedor_id, evento_id, tipo, estado? }.
     * El mismo evento (svix-id) se anota una sola vez. El estado solo avanza: rebotado manda sobre entregado.
     */
    async eventoProveedor(ev) {
      if (ev.evento_id) {
        const ya = await q.query('SELECT id FROM envios_eventos WHERE evento_id = $1', [ev.evento_id]);
        if (ya.rows.length) return { nuevo: false, envio_id: null };
      }
      // el id de Resend es unico; el proveedor del envio puede ser 'resend' o 'sombra:resend'
      const f = await q.query('SELECT id, estado FROM envios WHERE proveedor_id = $1', [ev.proveedor_id]);
      const envio = f.rows[0] || null;
      await q.query('INSERT INTO envios_eventos (envio_id, proveedor, proveedor_id, evento_id, tipo, cuando) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (evento_id) DO NOTHING',
        [envio ? envio.id : null, ev.proveedor, ev.proveedor_id, ev.evento_id || null, ev.tipo, ahora()]);
      const ORDEN = { enviado: 1, entregado: 2, rebotado: 3 };
      if (envio && ev.estado && (ORDEN[ev.estado] || 0) > (ORDEN[envio.estado] || 0)) {
        await q.query('UPDATE envios SET estado = $2, actualizado = $3 WHERE id = $1', [envio.id, ev.estado, ahora()]);
      }
      return { nuevo: true, envio_id: envio ? Number(envio.id) : null };
    },
    async anotarReloj(x) {
      await q.query(`INSERT INTO avisos_relojes (tarea, inicio, fin, revisadas, nuevos, ya_estaban, enviados, fallas, detalle, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [x.tarea, iso(x.inicio), ahora(), x.revisadas || 0, x.nuevos || 0, x.ya_estaban || 0, x.enviados || 0, x.fallas || 0, JSON.stringify(x.detalle || {}), x.error || null]);
    },
    async ajustes() {
      try { return (await q.query('SELECT clave, valor FROM avisos_ajustes')).rows; } catch (e) { return []; }
    }
  };
}

module.exports = { MAX_INTENTOS, crearEnvios };
