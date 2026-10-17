/**
 * Importar a la base las filas de PAGOS_PROVEEDORES (decision de Juanma del 17-oct-2026, opcion a).
 *
 * En vivo, la base manda para lo que se guarda en el servidor nuevo; Caja chica y Compras en
 * efectivo siguen en la intranet y escriben en la hoja. Cada 15 min esto trae a la base lo que la
 * hoja tiene y la base no. En la sombra (hasta el 31-oct) se importa TODO, y la comparacion de la
 * noche revisa que base y hoja tengan las mismas filas: es el ensayo del modo en vivo.
 *
 * Reglas (que no se duplique ni se pierda ningun pago):
 *   - la llave es el ID de la fila; una fila sin ID o un ID repetido en la hoja es un problema y no se importa;
 *   - ID nuevo → se agrega; ID conocido con otra fila → si es de la hoja (origen 'hoja'), se actualiza
 *     (por ejemplo un ANULADO); si lo escribio el servidor, es un CONFLICTO: no se pisa, se avisa;
 *   - una fila que esta en la base y no en la hoja nunca se borra: se avisa (en la hoja no se borran filas).
 */
const C = require('./copia-hojas');

/** El ID como texto estable (4 IDs viejos quedaron como numero en la hoja). */
function llave(v) { return v === '' || v === null || v === undefined ? '' : String(v).trim(); }

/**
 * planificar(matrizHoja, filasBase) → { nuevas, actualizadas, problemas }
 * matrizHoja: la pestaña completa con encabezado (como getValues). filasBase: [{ id, celdas, origen, orden }]
 * con celdas ya codificadas (JSON). Funcion pura: no toca la base.
 */
function planificar(matrizHoja, filasBase) {
  const H = (matrizHoja[0] || []).map((h) => String(h || '').trim());
  const iId = H.indexOf('ID');
  if (iId < 0) throw new Error('PAGOS_PROVEEDORES no tiene la columna ID.');
  const base = new Map(filasBase.map((f) => [f.id, f]));
  const vistos = new Map();
  const problemas = [], nuevas = [], actualizadas = [], reordenar = [];
  for (let r = 1; r < matrizHoja.length; r++) {
    const fila = matrizHoja[r];
    const id = llave(fila[iId]);
    if (!id) { problemas.push('Fila ' + (r + 1) + ' de la hoja sin ID: no se importa.'); continue; }
    if (vistos.has(id)) { problemas.push('ID ' + id + ' repetido en la hoja (filas ' + (vistos.get(id) + 1) + ' y ' + (r + 1) + '): no se importa la segunda.'); continue; }
    vistos.set(id, r);
    const celdas = C.codificar([fila])[0];
    const b = base.get(id);
    if (!b) { nuevas.push({ id, celdas, orden: r, fila }); continue; }
    if (JSON.stringify(b.celdas) === JSON.stringify(celdas)) { if (b.orden !== r) reordenar.push({ id, orden: r }); continue; }
    if (b.origen === 'servidor') { problemas.push('Conflicto en ' + id + ': la hoja tiene otra version de un pago guardado en el servidor nuevo. No se piso.'); continue; }
    actualizadas.push({ id, celdas, orden: r, fila });
  }
  filasBase.forEach((b) => { if (b.origen === 'hoja' && !vistos.has(b.id)) problemas.push('El pago ' + b.id + ' esta en la base y ya no en la hoja.'); });
  return { nuevas, actualizadas, reordenar, problemas, filas_hoja: matrizHoja.length - 1, encabezado: H };
}

/** Columnas con tipo, para consultar (la verdad para Pagos esta en celdas). */
function tipadas(H, fila) {
  const v = (n) => fila[H.indexOf(n)];
  const texto = (x) => (x === '' || x === null || x === undefined ? '' : String(x));
  const fecha = (x) => { const s = x instanceof Date ? C.codificar([[x]])[0][0].$d.slice(0, 10) : texto(x).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
  const num = (x) => (typeof x === 'number' ? x : (x === '' ? null : (isFinite(Number(x)) ? Number(x) : null)));
  return [texto(v('AREA')), texto(v('PROVEEDOR')), texto(v('DTE')), fecha(v('FECHA DE PAGAR')), fecha(v('FECHA PAGADO')),
    num(v('CANTIDAD PAGADA')), texto(v('ESTATUS DE PAGO')), texto(v('NIT')), texto(v('DETALLE')), texto(v('ESCRITO POR')),
    v('REGISTRADO') instanceof Date ? v('REGISTRADO') : new Date()];
}

/** Aplica el plan en una transaccion y deja el resumen en pagos_importaciones. */
async function importar(pool, matrizHoja) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query('SELECT id, celdas, origen, orden FROM pagos_proveedores FOR UPDATE');
    const plan = planificar(matrizHoja, r.rows);
    const H = plan.encabezado;
    // la posicion en la hoja (si alguien la ordena, cambia; no es un cambio del pago)
    for (const x of plan.reordenar) await c.query('UPDATE pagos_proveedores SET orden = $2 WHERE id = $1', [x.id, x.orden]);
    for (const x of plan.actualizadas) {
      await c.query(`UPDATE pagos_proveedores SET area=$2, proveedor=$3, dte=$4, fecha_de_pagar=$5, fecha_pagado=$6, cantidad_pagada=$7,
        estatus=$8, nit=$9, detalle=$10, escrito_por=$11, registrado=$12, celdas=$13, orden=$14, actualizado=now() WHERE id=$1`,
      [x.id].concat(tipadas(H, x.fila), [JSON.stringify(x.celdas), x.orden]));
    }
    for (const x of plan.nuevas) {
      await c.query(`INSERT INTO pagos_proveedores (id, area, proveedor, dte, fecha_de_pagar, fecha_pagado, cantidad_pagada, estatus, nit, detalle,
        escrito_por, registrado, celdas, orden, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'hoja')`,
      [x.id].concat(tipadas(H, x.fila), [JSON.stringify(x.celdas), x.orden]));
    }
    await c.query('INSERT INTO pagos_importaciones (filas_hoja, nuevas, actualizadas, problemas) VALUES ($1,$2,$3,$4)',
      [plan.filas_hoja, plan.nuevas.length, plan.actualizadas.length, JSON.stringify(plan.problemas)]);
    await c.query('COMMIT');
    return { filas_hoja: plan.filas_hoja, nuevas: plan.nuevas.length, actualizadas: plan.actualizadas.length, problemas: plan.problemas };
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

/** PAGOS_PROVEEDORES armada desde la base (encabezado + filas en su orden), para correr Pagos sobre la base. */
async function matrizDesdeBase(pool, encabezado) {
  const r = await pool.query('SELECT celdas FROM pagos_proveedores ORDER BY orden NULLS LAST, registrado, id');
  return [encabezado.slice()].concat(C.decodificar(r.rows.map((x) => x.celdas)));
}

module.exports = { planificar, importar, matrizDesdeBase, llave, tipadas };
