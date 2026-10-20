/**
 * Historial de reservas de Wix → rosanta-db (tablas wix_*, migracion 050). 20-oct-2026.
 *
 * SOLO LEE Wix. Las unicas llamadas permitidas son:
 *   POST https://www.wixapis.com/table-reservations/reservations/v1/reservations/query
 *   GET  https://www.wixapis.com/table-reservations/reservation-locations/v1/reservation-locations
 * Cualquier otra direccion o metodo se niega ANTES de salir (llamarWix).
 *
 * Se puede repetir: la llave es el id de Wix. Si una reserva cambio desde la corrida anterior, se
 * actualiza y el cambio queda en wix_reservas_cambios. Si no cambio, solo se marca ultima_vez.
 *
 * No imprime ni guarda en disco datos personales: el resumen lleva conteos e ids de Wix.
 * Las funciones puras (sin red ni base) estan exportadas para las pruebas.
 */
const crypto = require('crypto');

const WIX = 'https://www.wixapis.com';
const URL_QUERY = WIX + '/table-reservations/reservations/v1/reservations/query';
const URL_UBICACIONES = WIX + '/table-reservations/reservation-locations/v1/reservation-locations';
const PERMITIDAS = [
  { metodo: 'POST', url: URL_QUERY },
  { metodo: 'GET', url: URL_UBICACIONES }
];
const SITIO_POR_DEFECTO = '47968b83-c2c2-4b11-8f94-ef2c7488debc';   // wix.config.json de rosanta-wix (publico)
const CF_OPTIN = '88cadd96-c92b-40c4-8ef2-d0d2ad67acb5';
const CF_CONSUMO = 'bf07b3fc-04f2-4851-9a91-0ec9575ab099';
// Campos que, si cambian entre corridas, se anotan en wix_reservas_cambios.
const SEGUIDOS = ['estado', 'inicio', 'fin', 'personas', 'mesa_ids', 'notas_equipo', 'consumo_q', 'optin',
  'nombre', 'apellido', 'email', 'telefono', 'campos', 'estado_pago', 'archivada', 'motivo_rechazo'];

// ---------------------------------------------------------------- puras

/** JSON con las llaves ordenadas: la misma reserva da siempre la misma huella. */
function jsonEstable(x) {
  if (Array.isArray(x)) return '[' + x.map(jsonEstable).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + jsonEstable(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
function huella(obj) { return crypto.createHash('sha256').update(jsonEstable(obj)).digest('hex'); }

/** Ventanas de un mes [desde, hasta) en UTC, de AAAA-MM-DD a AAAA-MM-DD. */
function ventanas(desde, hasta) {
  const out = [];
  let a = new Date(desde + 'T00:00:00Z');
  const fin = new Date(hasta + 'T00:00:00Z');
  if (isNaN(a) || isNaN(fin) || a >= fin) throw new Error('Rango invalido: ' + desde + ' → ' + hasta);
  while (a < fin) {
    const b = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
    out.push([a.toISOString(), (b < fin ? b : fin).toISOString()]);
    a = b;
  }
  return out;
}

function lista(x) { return Array.isArray(x) ? x : []; }

/** Las mesas de una ubicacion (vigentes y borradas: las reservas viejas pueden nombrar una borrada). */
function mesasDeUbicacion(ub) {
  const tm = (ub && ub.configuration && ub.configuration.tableManagement) || {};
  const una = (t, borrada) => ({
    id: String(t.id || t._id || ''), ubicacion_id: String(ub.id || ub._id || ''), nombre: String(t.name || ''),
    asientos_min: t.seatsMin == null ? null : Number(t.seatsMin), asientos_max: t.seatsMax == null ? null : Number(t.seatsMax),
    activa: t.isActive == null ? null : !!t.isActive, borrada, crudo: t
  });
  return lista(tm.tableDefinitions).map((t) => una(t, false))
    .concat(lista(tm.deletedTableDefinitions).map((t) => una(t, true)))
    .filter((m) => m.id);
}

/** id del campo del formulario → nombre ("Alergias", "¿Dónde te quieres sentar?", "Ocasión"...). */
function camposDeUbicacion(ub) {
  const rf = (ub && ub.configuration && ub.configuration.reservationForm) || {};
  const m = {};
  lista(rf.customFieldDefinitions).forEach((c) => { const id = c.id || c._id; if (id) m[String(id)] = String(c.name || id); });
  m[CF_OPTIN] = m[CF_OPTIN] || 'Acepta contacto';
  m[CF_CONSUMO] = m[CF_CONSUMO] || 'Consumo total de la mesa (Q)';
  return m;
}

function monto(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function fecha(v) { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); }

/** Una reserva de la API → la fila de wix_reservas (sin importacion_id ni marcas de tiempo). */
function normalizarReserva(r, mapaMesas, mapaCampos) {
  const d = r.details || {};
  const p = r.reservee || {};
  const ids = lista(d.tables && d.tables.ids).map(String);
  const cf = p.customFields || {};
  const campos = {};
  Object.keys(cf).forEach((k) => { campos[(mapaCampos && mapaCampos[k]) || k] = cf[k]; });
  return {
    id: String(r.id || r._id || ''),
    revision: r.revision == null ? null : Number(r.revision),
    estado: String(r.status || ''),
    fuente: r.source ? String(r.source) : null,
    ubicacion_id: d.reservationLocationId ? String(d.reservationLocationId) : null,
    inicio: fecha(d.startDate),
    fin: fecha(d.endDate),
    personas: d.partySize == null ? null : Number(d.partySize),
    mesa_ids: ids,
    mesa_nombres: ids.map((i) => (mapaMesas && mapaMesas[i]) || i),
    nombre: p.firstName || null,
    apellido: p.lastName || null,
    email: p.email ? String(p.email).trim().toLowerCase() : null,
    telefono: p.phone || null,
    contacto_id: p.contactId || null,
    reservado_por_id: (r.reservedBy && r.reservedBy.contactId) || null,
    consentimiento: p.marketingConsent == null ? null : !!p.marketingConsent,
    campos,
    campos_ids: cf,
    optin: cf[CF_OPTIN] ? String(cf[CF_OPTIN]).toUpperCase() : null,
    consumo_q: monto(cf[CF_CONSUMO]),
    notas_equipo: r.teamMessage || null,
    motivo_rechazo: r.declineReason || null,
    estado_pago: r.paymentStatus || null,
    archivada: r.archived == null ? null : !!r.archived,
    creada: fecha(r.createdDate),
    cambiada: fecha(r.updatedDate),
    crudo: r,
    huella: huella(r)
  };
}

/** Que campos seguidos cambiaron entre la fila guardada y la nueva. */
function diferencias(antes, despues) {
  const norm = (k, v) => {
    if (v == null) return null;
    if (k === 'inicio' || k === 'fin') return new Date(v).toISOString();
    if (k === 'consumo_q') return Number(v);
    if (k === 'campos') return jsonEstable(v);
    if (Array.isArray(v)) return v.join('|');
    return v;
  };
  return SEGUIDOS.filter((k) => norm(k, antes[k]) !== norm(k, despues[k]));
}

/** ids de Wix creados o cambiados entre dos instantes (para reenviar por /hooks/reserva lo que no llego). */
function idsEnVentana(filas, desde, hasta) {
  const a = new Date(desde).getTime(), b = new Date(hasta).getTime();
  const en = (v) => { if (!v) return false; const t = new Date(v).getTime(); return t >= a && t <= b; };
  const ids = filas.filter((x) => en(x.creada) || en(x.cambiada)).map((x) => x.id);
  return { desde: new Date(a).toISOString(), hasta: new Date(b).toISOString(), ids };
}

function tel8(t) { const s = String(t || '').replace(/[^0-9]/g, ''); return s.length > 8 ? s.slice(-8) : s; }

/** Conteos sin datos personales. */
function resumir(filas) {
  const por = (f) => filas.reduce((m, x) => { const k = f(x) || '(vacio)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const nombresCampos = {};
  filas.forEach((x) => Object.keys(x.campos || {}).forEach((k) => { nombresCampos[k] = (nombresCampos[k] || 0) + 1; }));
  const inicios = filas.map((x) => x.inicio).filter(Boolean).sort();
  return {
    total: filas.length,
    por_estado: por((x) => x.estado),
    por_fuente: por((x) => x.fuente),
    por_anio: por((x) => (x.inicio || '').slice(0, 4)),
    con_mesa: filas.filter((x) => x.mesa_ids.length).length,
    con_notas: filas.filter((x) => x.notas_equipo).length,
    con_consumo: filas.filter((x) => x.consumo_q).length,
    archivadas: filas.filter((x) => x.archivada).length,
    campos_formulario: nombresCampos,
    primera: inicios[0] || null,
    ultima: inicios[inicios.length - 1] || null
  };
}

/**
 * Contra Marketing OS › reservas (filas_clientes, pestana 'reservas': llave = id de Wix) y el CRM
 * (pestana 'crm': llaves 'e:'+correo y 't:'+ultimos 8 del telefono). Devuelve conteos e ids de Wix.
 * mkt: [{ llave, estado }]; crm: Set de llaves.
 */
function comparar(filas, mkt, crm) {
  const wix = new Map(filas.map((x) => [x.id, x]));
  const enMkt = new Map((mkt || []).map((x) => [String(x.llave), x]));
  const soloWix = [], estadoDistinto = [];
  filas.forEach((x) => {
    const m = enMkt.get(x.id);
    if (!m) soloWix.push(x.id);
    else if (m.estado && String(m.estado).toUpperCase() !== x.estado) estadoDistinto.push(x.id);
  });
  const soloMkt = [...enMkt.keys()].filter((k) => !wix.has(k));
  let conCrm = 0, sinCrm = 0, sinContacto = 0;
  if (crm) {
    const vistos = new Set();
    filas.forEach((x) => {
      const k = [x.email ? 'e:' + x.email : null, tel8(x.telefono) ? 't:' + tel8(x.telefono) : null].filter(Boolean);
      if (!k.length) { sinContacto++; return; }
      const persona = k[0];
      if (vistos.has(persona)) return;
      vistos.add(persona);
      if (k.some((y) => crm.has(y))) conCrm++; else sinCrm++;
    });
  }
  return {
    marketing: { filas: enMkt.size, en_ambos: filas.length - soloWix.length, solo_wix: soloWix.length, solo_marketing: soloMkt.length,
      estado_distinto: estadoDistinto.length, ids_solo_marketing: soloMkt.slice(0, 50), ids_estado_distinto: estadoDistinto.slice(0, 50) },
    crm: crm ? { personas_en_crm: conCrm, personas_fuera_del_crm: sinCrm, reservas_sin_contacto: sinContacto } : null
  };
}

// ---------------------------------------------------------------- Wix (solo lectura)

function permitida(metodo, url) {
  const base = String(url).split('?')[0];
  return PERMITIDAS.some((p) => p.metodo === metodo && p.url === base);
}

async function llamarWix(cred, metodo, url, cuerpo, intento) {
  if (!permitida(metodo, url)) throw new Error('Llamada a Wix NO permitida (solo lectura): ' + metodo + ' ' + url.split('?')[0]);
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Authorization': cred.llave, 'wix-site-id': cred.sitio, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  if ((r.status === 429 || r.status >= 500) && (intento || 0) < 5) {
    await new Promise((ok) => setTimeout(ok, 1000 * Math.pow(2, intento || 0)));
    return llamarWix(cred, metodo, url, cuerpo, (intento || 0) + 1);
  }
  const texto = await r.text();
  if (!r.ok) throw new Error('Wix respondio ' + r.status + ' en ' + url.split('?')[0] + ': ' + texto.slice(0, 200));
  return JSON.parse(texto || '{}');
}

async function leerUbicaciones(cred) {
  const out = [];
  let cursor = null, vueltas = 0;
  do {
    const q = '?fieldsets=FULL&paging.limit=100' + (cursor ? '&paging.cursor=' + encodeURIComponent(cursor) : '');
    const d = await llamarWix(cred, 'GET', URL_UBICACIONES + q);
    lista(d.reservationLocations).forEach((x) => out.push(x));
    cursor = d.pagingMetadata && d.pagingMetadata.hasNext && d.pagingMetadata.cursors && d.pagingMetadata.cursors.next;
  } while (cursor && ++vueltas < 50);
  return out;
}

/** Todas las reservas de una consulta (con filtro opcional), siguiendo los cursores. */
async function leerConsulta(cred, filtro) {
  const out = [];
  let cuerpo = { query: Object.assign({ cursorPaging: { limit: 100 } }, filtro ? { filter: filtro, sort: [{ fieldName: 'details.startDate', order: 'ASC' }] } : {}) };
  for (let vueltas = 0; vueltas < 500; vueltas++) {
    const d = await llamarWix(cred, 'POST', URL_QUERY, cuerpo);
    lista(d.reservations).forEach((x) => out.push(x));
    const pm = d.pagingMetadata || {};
    const sig = pm.hasNext && pm.cursors && pm.cursors.next;
    if (!sig) return out;
    cuerpo = { query: { cursorPaging: { limit: 100, cursor: sig } } };
  }
  throw new Error('Demasiadas paginas: se corto para no quedar en un bucle.');
}

/** Mes por mes + una pasada completa sin filtro; se juntan por id (nada se pierde ni se duplica). */
async function leerReservas(cred, desde, hasta) {
  const porId = new Map();
  for (const [a, b] of ventanas(desde, hasta)) {
    const lote = await leerConsulta(cred, { 'details.startDate': { '$gte': a, '$lt': b } });
    lote.forEach((x) => porId.set(String(x.id || x._id), x));
  }
  const enVentanas = porId.size;
  const todas = await leerConsulta(cred, null);
  todas.forEach((x) => { const id = String(x.id || x._id); if (!porId.has(id)) porId.set(id, x); });
  return { reservas: [...porId.values()], en_ventanas: enVentanas, pasada_completa: todas.length };
}

// ---------------------------------------------------------------- base

async function existeTabla(c, nombre) { return !!(await c.query('SELECT to_regclass($1) AS t', [nombre])).rows[0].t; }

async function leerComparables(c) {
  if (!(await existeTabla(c, 'filas_clientes'))) return { mkt: null, crm: null, nota: 'filas_clientes no existe en esta base' };
  const r = await c.query("SELECT pestana, llave, celdas FROM filas_clientes WHERE pestana IN ('reservas','crm') AND borrada IS NULL");
  const mkt = [], crm = new Set();
  r.rows.forEach((x) => {
    if (x.pestana === 'crm') { crm.add(String(x.llave)); return; }
    const cel = x.celdas;
    // Orden de Marketing OS › reservas (Fase 2): id, fecha, nombre, email, telefono, personas, gasto, estado, optin.
    const estado = Array.isArray(cel) ? cel[7] : (cel && (cel.estado || cel.ESTADO));
    mkt.push({ llave: x.llave, estado });
  });
  return { mkt, crm };
}

async function guardar(c, imp, ubicaciones, mesas, filas) {
  for (const u of ubicaciones) {
    await c.query(`INSERT INTO wix_ubicaciones (id, nombre, revision, configuracion, crudo) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, revision = EXCLUDED.revision,
        configuracion = EXCLUDED.configuracion, crudo = EXCLUDED.crudo, actualizada = now()`,
    [String(u.id || u._id), (u.location && u.location.name) || u.name || null, u.revision == null ? null : String(u.revision), u.configuration || {}, u]);
  }
  for (const m of mesas) {
    await c.query(`INSERT INTO wix_mesas (id, ubicacion_id, nombre, asientos_min, asientos_max, activa, borrada, crudo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, asientos_min = EXCLUDED.asientos_min, asientos_max = EXCLUDED.asientos_max,
        activa = EXCLUDED.activa, borrada = EXCLUDED.borrada, crudo = EXCLUDED.crudo, actualizada = now()`,
    [m.id, m.ubicacion_id, m.nombre, m.asientos_min, m.asientos_max, m.activa, m.borrada, m.crudo]);
  }
  const cuenta = { nuevas: 0, cambiadas: 0, iguales: 0 };
  const cols = ['id', 'revision', 'estado', 'fuente', 'ubicacion_id', 'inicio', 'fin', 'personas', 'mesa_ids', 'mesa_nombres', 'nombre', 'apellido',
    'email', 'telefono', 'contacto_id', 'reservado_por_id', 'consentimiento', 'campos', 'campos_ids', 'optin', 'consumo_q', 'notas_equipo',
    'motivo_rechazo', 'estado_pago', 'archivada', 'creada', 'cambiada', 'crudo', 'huella'];
  for (const f of filas) {
    const prev = (await c.query('SELECT * FROM wix_reservas WHERE id = $1', [f.id])).rows[0];
    if (prev && prev.huella === f.huella) {
      await c.query('UPDATE wix_reservas SET ultima_vez = now() WHERE id = $1', [f.id]);
      cuenta.iguales++;
      continue;
    }
    const vals = cols.map((k) => f[k]);
    if (!prev) {
      await c.query('INSERT INTO wix_reservas (' + cols.join(',') + ', importacion_id) VALUES (' + cols.map((_, i) => '$' + (i + 1)).join(',') + ', $' + (cols.length + 1) + ')',
        vals.concat([imp]));
      cuenta.nuevas++;
      continue;
    }
    const camb = diferencias(prev, f);
    await c.query('UPDATE wix_reservas SET ' + cols.slice(1).map((k, i) => k + ' = $' + (i + 2)).join(', ') +
      ', ultima_vez = now(), importacion_id = $' + (cols.length + 1) + ' WHERE id = $1', vals.concat([imp]));
    if (camb.length) {
      const pick = (o) => camb.reduce((m, k) => { m[k] = o[k] == null ? null : o[k]; return m; }, {});
      await c.query('INSERT INTO wix_reservas_cambios (reserva_id, importacion_id, campos, antes, despues) VALUES ($1,$2,$3,$4,$5)',
        [f.id, imp, camb, JSON.stringify(pick(prev)), JSON.stringify(pick(f))]);
    }
    cuenta.cambiadas++;
  }
  return cuenta;
}

/**
 * Corre la importacion. o = { cred:{llave,sitio}, pool (opcional en seco), desde, hasta, seco }.
 * Devuelve el resumen (sin datos personales).
 */
async function importar(o) {
  const ubicaciones = await leerUbicaciones(o.cred);
  const mesas = [].concat(...ubicaciones.map(mesasDeUbicacion));
  const mapaMesas = {}; mesas.forEach((m) => { mapaMesas[m.id] = m.nombre; });
  const mapaCampos = Object.assign({}, ...ubicaciones.map(camposDeUbicacion));
  const leido = await leerReservas(o.cred, o.desde, o.hasta);
  const filas = leido.reservas.map((r) => normalizarReserva(r, mapaMesas, mapaCampos)).filter((f) => f.id);
  const resumen = Object.assign(resumir(filas), { en_ventanas: leido.en_ventanas, pasada_completa: leido.pasada_completa,
    ubicaciones: ubicaciones.length, mesas: mesas.length, mesas_borradas: mesas.filter((m) => m.borrada).length });
  if (o.ventanaCambios) resumen.ventana_cambios = idsEnVentana(filas, o.ventanaCambios[0], o.ventanaCambios[1]);
  if (!o.pool) return { modo: 'seco', resumen, comparacion: null };

  const c = await o.pool.connect();
  try {
    const comp = await leerComparables(c);
    const comparacion = comp.mkt ? comparar(filas, comp.mkt, comp.crm) : { nota: comp.nota };
    if (o.seco) return { modo: 'seco', resumen, comparacion };
    await c.query('BEGIN');
    const imp = (await c.query('INSERT INTO wix_importaciones (modo, desde, hasta) VALUES ($1,$2,$3) RETURNING id', ['base', o.desde, o.hasta])).rows[0].id;
    const cuenta = await guardar(c, imp, ubicaciones, mesas, filas);
    await c.query(`UPDATE wix_importaciones SET fin = now(), leidas = $2, nuevas = $3, cambiadas = $4, iguales = $5, mesas = $6,
      resumen = $7, comparacion = $8 WHERE id = $1`,
    [imp, filas.length, cuenta.nuevas, cuenta.cambiadas, cuenta.iguales, mesas.length, resumen, comparacion]);
    await c.query('COMMIT');
    return { modo: 'base', importacion: imp, cuenta, resumen, comparacion };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}

module.exports = {
  importar, jsonEstable, huella, ventanas, mesasDeUbicacion, camposDeUbicacion, normalizarReserva, diferencias,
  resumir, comparar, idsEnVentana, permitida, llamarWix, URL_QUERY, URL_UBICACIONES, SITIO_POR_DEFECTO
};
