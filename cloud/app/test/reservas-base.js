/**
 * Base de mentira para las pruebas del motor de reservas: pg-mem (Postgres en memoria, sin red) con la
 * migracion 051 tal cual, mas la tabla interruptores de la 013 y las wix_* de la 050.
 *
 * pg-mem no tiene candados: este archivo imita pg_advisory_xact_lock con un candado en memoria por llave, que
 * se suelta en el COMMIT o el ROLLBACK, igual que Postgres. Asi la prueba de concurrencia es de verdad: si el
 * motor no pidiera el candado, las reservas simultaneas se pisarian.
 */
const fs = require('fs');
const path = require('path');
const { newDb, DataType } = require('pg-mem');

const MIG = path.join(__dirname, '../../db/migraciones');

/** Parte un .sql en sentencias, respetando las comillas. Sin comentarios ni GRANT (pg-mem no tiene roles). */
function sentencias(sql) {
  const sinComentarios = sql.split('\n').map((l) => { let enComilla = false; for (let i = 0; i < l.length; i++) {
    if (l[i] === "'") enComilla = !enComilla; else if (!enComilla && l[i] === '-' && l[i + 1] === '-') return l.slice(0, i); } return l; }).join('\n');
  const out = []; let actual = '', enComilla = false;
  for (const ch of sinComentarios) {
    if (ch === "'") enComilla = !enComilla;
    if (ch === ';' && !enComilla) { if (actual.trim()) out.push(actual.trim()); actual = ''; } else actual += ch;
  }
  if (actual.trim()) out.push(actual.trim());
  return out.filter((s) => !/^GRANT\b/i.test(s));
}

function crearBase(opciones) {
  const o = opciones || {};
  const db = newDb();
  db.public.registerFunction({
    name: 'regexp_replace', args: [DataType.text, DataType.text, DataType.text, DataType.text], returns: DataType.text,
    implementation: (s, re, rep, flags) => String(s == null ? '' : s).replace(new RegExp(re, flags), rep)
  });
  db.public.registerFunction({ name: 'right', args: [DataType.text, DataType.integer], returns: DataType.text,
    implementation: (s, n) => String(s == null ? '' : s).slice(-n) });
  db.public.none("CREATE TABLE interruptores (modulo text PRIMARY KEY, modo text NOT NULL, cambiado timestamptz NOT NULL DEFAULT now(), por text NOT NULL DEFAULT '')");
  for (const f of ['050_wix_historial.sql', '051_reservas_motor.sql']) {
    for (const s of sentencias(fs.readFileSync(path.join(MIG, f), 'utf8'))) {
      if (/CREATE INDEX wix_reservas_(email|tel8)|CREATE INDEX reservas_(tel8|email|llave_crm)/.test(s)) continue;   // indices de expresion: pg-mem no los necesita
      db.public.none(s);
    }
  }
  if (o.modo) db.public.none("UPDATE interruptores SET modo = '" + o.modo + "' WHERE modulo = 'motor_reservas'");

  const { Pool } = db.adapters.createPg();
  const real = new Pool();
  const candados = new Map();   // llave → promesa de la cola
  const pedidos = [];           // [{ llave }] para las pruebas

  async function tomar(llave) {
    const antes = candados.get(llave) || Promise.resolve();
    let soltar;
    const mio = new Promise((ok) => { soltar = ok; });
    const cola = antes.then(() => mio);
    candados.set(llave, cola);
    await antes;
    return () => { soltar(); if (candados.get(llave) === cola) candados.delete(llave); };
  }

  // OJO: pg-mem no aisla transacciones (todas comparten la base). Las pruebas que corren transacciones a la vez
  // lo hacen sobre la MISMA fecha: ahi el unico orden es el del candado, que es justo lo que se prueba.

  const pool = {
    query: (sql, p) => real.query(sql, p),
    async connect() {
      const c = await real.connect();
      const mios = [];
      const terminar = () => { mios.splice(0).forEach((s) => s()); };
      return {
        async query(sql, p) {
          const s = String(sql).trim();
          if (/pg_advisory_xact_lock/.test(s)) {
            const llave = p.join(':');
            pedidos.push({ llave });
            if (!o.sinCandado) mios.push(await tomar(llave));   // sinCandado: para mostrar que sin el se pisan
            return { rows: [{}] };
          }
          if (/^(COMMIT|ROLLBACK)/i.test(s)) {
            try { return await c.query(sql, p); } finally { terminar(); }
          }
          return c.query(sql, p);
        },
        release() { terminar(); c.release(); }
      };
    },
    end: () => real.end()
  };
  return { db, pool, pedidos, sql: (s) => db.public.many(s), uno: (s) => db.public.none(s) };
}

/**
 * Base lista: carga la ubicacion INVENTADA (fixturas/wix-ubicacion-inventada.json) en wix_ubicaciones, corre la
 * carga desde Wix (asi tambien se prueba carga-wix.js) y deja motor_reservas en `modo` (por defecto 'base').
 * extra: filas de reglas_reservas para pisar ({ clave, valor }).
 */
async function baseLista(o) {
  o = o || {};
  const UB = require('./fixturas/wix-ubicacion-inventada.json');
  const { cargarDesdeWix } = require('../src/reservas/carga-wix');
  const b = crearBase({ sinCandado: o.sinCandado });
  await b.pool.query('INSERT INTO wix_ubicaciones (id, nombre, configuracion, crudo) VALUES ($1, $2, $3, $4)',
    [UB.id, 'Rosanta (prueba)', JSON.stringify(UB.configuration), JSON.stringify(UB)]);
  for (const w of o.wix || []) await insertarWix(b.pool, w);
  b.carga = await cargarDesdeWix(b.pool, { ahora: o.ahora || Date.now() });
  for (const r of o.reglas || []) {
    await b.pool.query('UPDATE reglas_reservas SET valor = $2 WHERE clave = $1', [r.clave, JSON.stringify(r.valor)]);
  }
  b.uno("UPDATE interruptores SET modo = '" + (o.modo || 'base') + "' WHERE modulo = 'motor_reservas'");
  return b;
}

/** Una reserva cruda de Wix (forma de la API) → wix_reservas, con el normalizador real de la 050. */
async function insertarWix(pool, cruda) {
  const H = require('../src/wix-historial');
  const f = H.normalizarReserva(cruda, {}, { 'aaaaaaaa-0000-4000-8000-0000000000a1': '¿Alguna alergia alimentaria?' });
  const cols = ['id', 'revision', 'estado', 'fuente', 'ubicacion_id', 'inicio', 'fin', 'personas', 'mesa_ids', 'mesa_nombres', 'nombre', 'apellido',
    'email', 'telefono', 'contacto_id', 'reservado_por_id', 'consentimiento', 'campos', 'campos_ids', 'optin', 'consumo_q', 'notas_equipo',
    'motivo_rechazo', 'estado_pago', 'archivada', 'creada', 'cambiada', 'crudo', 'huella'];
  await pool.query('INSERT INTO wix_reservas (' + cols.join(',') + ') VALUES (' + cols.map((_, i) => '$' + (i + 1)).join(',') + ')',
    cols.map((k) => (k === 'campos' || k === 'campos_ids' || k === 'crudo') ? JSON.stringify(f[k]) : f[k]));
}

module.exports = { crearBase, sentencias, baseLista, insertarWix };
