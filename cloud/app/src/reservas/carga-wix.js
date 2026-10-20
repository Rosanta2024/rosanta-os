/**
 * Motor de reservas · carga inicial desde las tablas wix_* (migracion 050) a las de la 051. 20-oct-2026.
 *
 * NO llama a Wix: lee lo que ya guardo el importador del historial (wix_ubicaciones, wix_reservas).
 * Se puede repetir:
 *   - mesas, combinaciones, horario y cierres de origen 'wix' se apagan (activo/activa = false) y se vuelven a
 *     encender con lo que diga Wix hoy (la app no borra);
 *   - reglas: se pisan las claves que trae Wix (por = 'carga-wix'); las demas quedan;
 *   - reservas: las futuras de Wix entran con origen 'wix' e id = id de Wix. Si ya estaban, se actualizan solo si
 *     cambio algo, y queda en reservas_historial (evento 'carga'). Las de otro origen no se tocan nunca.
 * Con motor_reservas = 'base' NO corre (la base ya manda; la configuracion la edita el equipo), salvo forzar.
 * seco = true: hace todo dentro de la transaccion y al final ROLLBACK (para ver los conteos sin escribir).
 * Devuelve conteos y avisos, sin datos personales.
 */
const C = require('./comun');
const A = require('./almacen');
const W = require('./wix-config');
const { armarReglas } = require('./reglas');

const UBICACION_ROSANTA = '93076d06-553f-46eb-a43c-fa007db98226';   // BOT_LOC de http-functions.js
const SEGUIDOS = ['estado', 'inicio', 'fin', 'personas', 'mesa_ids', 'nombre', 'apellido', 'email', 'telefono', 'optin', 'nota_equipo',
  'consumo_q', 'alergias', 'sentarse', 'conocio', 'motivo_rechazo'];

function igual(k, a, b) {
  const n = (v) => (v == null ? null : (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join('|') : (k === 'consumo_q' ? Number(v) : v)));
  return n(a) === n(b);
}

class Seco extends Error {}

async function cargarDesdeWix(pool, o) {
  o = o || {};
  const ahora = new Date(o.ahora || Date.now());
  const modo = await A.interruptor(pool, 'motor_reservas', 'wix');
  if (modo === 'base' && !o.forzar) throw new Error('motor_reservas = base: la base ya manda, no se recarga desde Wix (usar forzar si de verdad hace falta).');
  const ubs = (await pool.query('SELECT id, configuracion, crudo FROM wix_ubicaciones')).rows;
  if (!ubs.length) throw new Error('wix_ubicaciones esta vacia: primero corre el importador del historial (llave del 23-oct).');
  const ub = ubs.find((u) => u.id === (o.ubicacion || UBICACION_ROSANTA)) || ubs[0];
  const t = W.traducirUbicacion(ub.crudo && ub.crudo.configuration ? ub.crudo : { configuration: ub.configuracion });
  if (ubs.length > 1) t.avisos.push('Hay ' + ubs.length + ' ubicaciones en Wix; se uso ' + ub.id + '.');
  const reglas = armarReglas(t.reglas);
  const desde = C.diaGt(ahora);
  const filasWix = (await pool.query('SELECT * FROM wix_reservas WHERE inicio >= $1 AND (ubicacion_id IS NULL OR ubicacion_id = $2)',
    [C.instante(desde, '00:00').toISOString(), ub.id])).rows;
  const reservas = W.reservasFuturasDeWix(filasWix, desde, reglas.duracion_min);
  const cuenta = { mesas: t.mesas.length, combinaciones: t.combinaciones.length, horario: t.horario.length, cierres: t.cierres.length,
    reglas: t.reglas.length, reservas_wix: filasWix.length, reservas_nuevas: 0, reservas_cambiadas: 0, reservas_iguales: 0, reservas_de_otro_origen: 0,
    sin_copiar: filasWix.length - reservas.length };

  try {
    await A.enTransaccion(pool, [], async (c) => {
      await c.query("UPDATE mesas SET activa = false, actualizada = now() WHERE origen = 'wix'");
      for (const m of t.mesas) {
        await c.query(`INSERT INTO mesas (id, nombre, zona, capacidad_min, capacidad_max, activa, orden, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,'wix')
          ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, zona = EXCLUDED.zona, capacidad_min = EXCLUDED.capacidad_min,
          capacidad_max = EXCLUDED.capacidad_max, activa = EXCLUDED.activa, orden = EXCLUDED.orden, actualizada = now()`,
        [m.id, m.nombre, m.zona, m.capacidad_min, m.capacidad_max, m.activa, m.orden]);
      }
      await c.query("UPDATE mesas_combinaciones SET activa = false, actualizada = now() WHERE origen = 'wix'");
      for (const m of t.combinaciones) {
        await c.query(`INSERT INTO mesas_combinaciones (id, mesa_ids, capacidad_min, capacidad_max, activa, origen) VALUES ($1,$2,$3,$4,$5,'wix')
          ON CONFLICT (id) DO UPDATE SET mesa_ids = EXCLUDED.mesa_ids, capacidad_min = EXCLUDED.capacidad_min, capacidad_max = EXCLUDED.capacidad_max,
          activa = EXCLUDED.activa, actualizada = now()`, [m.id, m.mesa_ids, m.capacidad_min, m.capacidad_max, m.activa]);
      }
      await c.query("UPDATE horario_reservas SET activo = false, actualizado = now() WHERE origen = 'wix'");
      for (const h of t.horario) {
        await c.query(`INSERT INTO horario_reservas (dia_semana, desde, hasta, activo, origen) VALUES ($1,$2,$3,true,'wix')
          ON CONFLICT (dia_semana, desde) DO UPDATE SET hasta = EXCLUDED.hasta, activo = true, origen = 'wix', actualizado = now()`,
        [h.dia_semana, h.desde, h.hasta === '24:00' ? '23:59' : h.hasta]);
      }
      await c.query("UPDATE cierres_reservas SET activo = false WHERE origen = 'wix'");
      for (const x of t.cierres) {
        await c.query(`INSERT INTO cierres_reservas (desde, hasta, cerrado, motivo, origen, id_externo, por) VALUES ($1,$2,$3,$4,'wix',$5,'carga-wix')
          ON CONFLICT (id_externo) DO UPDATE SET cerrado = EXCLUDED.cerrado, motivo = EXCLUDED.motivo, activo = true`,
        [x.desde.toISOString(), x.hasta.toISOString(), x.cerrado, x.motivo, x.id_externo]);
      }
      for (const r of t.reglas) {
        await c.query(`INSERT INTO reglas_reservas (clave, valor, nota, por) VALUES ($1,$2,'de la configuracion de Wix','carga-wix')
          ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, cambiado = now(), por = 'carga-wix'`, [r.clave, JSON.stringify(r.valor)]);
      }
      for (const r of reservas) {
        const prev = await A.porId(c, r.id);
        if (!prev) {
          await A.insertar(c, r);
          await A.anotar(c, r.id, 'carga-wix', 'carga', { despues: { estado: r.estado, inicio: r.inicio.toISOString(), personas: r.personas } }, ahora);
          cuenta.reservas_nuevas++;
          continue;
        }
        if (prev.origen !== 'wix') { cuenta.reservas_de_otro_origen++; continue; }
        const camb = SEGUIDOS.filter((k) => !igual(k, prev[k], r[k]));
        if (!camb.length) { cuenta.reservas_iguales++; continue; }
        const upd = {}; camb.forEach((k) => { upd[k] = r[k]; });
        if (upd.inicio || upd.fin) upd.duracion_min = r.duracion_min;
        if (upd.email !== undefined || upd.telefono !== undefined) upd.llave_crm = r.llave_crm;
        await A.actualizar(c, prev.id, upd, ahora);
        const pick = (x) => camb.reduce((m, k) => { m[k] = x[k] instanceof Date ? x[k].toISOString() : (x[k] == null ? null : x[k]); return m; }, {});
        // en el historial solo los nombres de los campos que cambiaron para los datos personales
        const sinDatos = (x) => { const y = pick(x); ['nombre', 'apellido', 'email', 'telefono'].forEach((k) => { if (k in y) y[k] = '(cambio)'; }); return y; };
        await A.anotar(c, prev.id, 'carga-wix', 'carga', { campos: camb, antes: sinDatos(prev), despues: sinDatos(r) }, ahora);
        cuenta.reservas_cambiadas++;
      }
      if (o.seco) throw new Seco('seco');
    });
  } catch (e) {
    if (!(e instanceof Seco)) throw e;
  }
  return { modo: o.seco ? 'seco' : 'base', ubicacion: ub.id, desde, cuenta, avisos: t.avisos };
}

module.exports = { cargarDesdeWix, UBICACION_ROSANTA };
