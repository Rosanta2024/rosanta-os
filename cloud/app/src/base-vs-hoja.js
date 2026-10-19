/**
 * BASE CONTRA HOJA, mas alla de Pagos (19-oct-2026, plan acelerado de Juanma: la sombra se acorto a 1
 * semana y esto la compensa). Lo usan la comparacion de cada noche y la conciliacion del cierre de mes.
 *
 *   - Caja chica, retiros y cierres (filas_vivas, migracion 005): la base tiene las mismas filas que la
 *     hoja, sin faltantes, distintas ni repetidas.
 *   - 07_Caja_Chica del maestro (de ahi sale el DRE): tiene lo que la caja dice con los datos de la base,
 *     armado con el MISMO codigo de la intranet (cchFilasMaestro_). El vigia la regenera cada hora; se
 *     miran solo los dias ya pasados, para no confundir el atraso de una hora con un error.
 */
const C = require('./copia-hojas');
const IMP = require('./importar-pagos');
const { crearMotor } = require('./motor-pagos');

const VIVAS = { CAJA_CHICA: 'ID', RETIROS_SOLICITUDES: 'ID', CIERRES_DIARIOS: 'FECHA' };
const HOJA_07 = '07_Caja_Chica';
const MAX = 20;   // diferencias por tema: mas que eso no se lee

async function hayVivas(pool) {
  const r = await pool.query("SELECT to_regclass('public.filas_vivas') IS NOT NULL AS hay");
  return !!(r.rows[0] && r.rows[0].hay);
}

/** Lee pestañas una por una: la que no existe se salta; cualquier otro error (permiso, red) se avisa. */
async function leerPestanas(sheets, id, nombres) {
  const out = {};
  for (const n of nombres) {
    try { Object.assign(out, await C.leerLibro(sheets, id, [n])); } catch (e) {
      if (!/Unable to parse range|no existe/i.test(String(e && e.message))) throw e;
    }
  }
  return out;
}

/** Las hojas leidas de nuevo, directo de Google: lo de siempre + caja, retiros, cierres y 07_Caja_Chica. */
async function leerFresco(sheets) {
  const fresco = {};
  for (const k of Object.keys(C.LIBROS)) fresco[C.LIBROS[k].id] = await C.leerLibro(sheets, C.LIBROS[k].id, C.LIBROS[k].pestanas);
  Object.assign(fresco[C.LIBROS.config.id], await leerPestanas(sheets, C.LIBROS.config.id, Object.keys(VIVAS)));
  Object.assign(fresco[C.LIBROS.maestro.id], await leerPestanas(sheets, C.LIBROS.maestro.id, [HOJA_07]));
  return fresco;
}

/** Los mismos libros, con lo que manda la base en lugar de la hoja (Pagos y, si hay, caja/retiros/cierres). */
async function conLaBase(pool, fresco, vivas) {
  const cfg = C.LIBROS.config.id, L = Object.assign({}, fresco), c = Object.assign({}, fresco[cfg]);
  c.PAGOS_PROVEEDORES = await IMP.matrizDesdeBase(pool, (fresco[cfg].PAGOS_PROVEEDORES || [])[0] || []);
  if (vivas) for (const p of Object.keys(VIVAS)) if (c[p]) c[p] = await IMP.matrizDesdeFilas(pool, p, c[p][0]);
  L[cfg] = c;
  return L;
}

/** Caja, retiros y cierres: base = hoja. Devuelve textos (vacio si todo coincide). */
async function compararVivas(pool, fresco) {
  const out = [], hojas = fresco[C.LIBROS.config.id];
  for (const p of Object.keys(VIVAS)) {
    const hoja = hojas[p];
    if (!hoja || !hoja.length) continue;
    const k = VIVAS[p], iK = hoja[0].indexOf(k);
    const ids = hoja.slice(1).map((f) => IMP.llave(f[iK])).filter(Boolean);
    ids.filter((x, i) => ids.indexOf(x) !== i).slice(0, MAX).forEach((x) => out.push(p + ': ' + x + ' está repetido en la hoja'));
    const base = (await pool.query('SELECT llave AS id, celdas FROM filas_vivas WHERE pestana = $1', [p])).rows.map((x) => ({ id: x.id, celdas: x.celdas, origen: 'hoja' }));
    const plan = IMP.planificar(hoja, base, { llave: k });
    plan.nuevas.slice(0, MAX).forEach((x) => out.push(p + ': falta en la base ' + x.id));
    plan.actualizadas.slice(0, MAX).forEach((x) => out.push(p + ': ' + x.id + ' es distinto en la base y en la hoja'));
    plan.problemas.slice(0, MAX).forEach((x) => out.push(p + ': ' + x));
  }
  return out;
}

/** Lo que 07_Caja_Chica deberia tener, con el codigo de la intranet sobre `libros`. Filas [fecha, desc, monto, usd, cat, personal, origen, id]. */
function filas07Esperadas(libros) {
  const M = crearMotor({ libros, configId: C.LIBROS.config.id, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
  M.ctx.__filas07 = () => M.ctx.cchFilasMaestro_(M.ctx.cchEstado_(false));
  return M.correr(null, '__filas07', []).resultado;
}

/** Las filas de 07_Caja_Chica del maestro (desde la fila 5), como [fecha AAAA-MM-DD, desc, monto, usd, cat, personal, origen, id]. */
function filas07Hoja(fresco) {
  const h = fresco[C.LIBROS.maestro.id][HOJA_07];
  if (!h) return null;
  return h.slice(4).filter((r) => r.some((x) => x !== '' && x != null)).map((r) => [IMP.llave(r[0])].concat(r.slice(1)));
}

/** 07_Caja_Chica = lo esperado, en los dias anteriores a `hoy`. */
function comparar07(esperadas, enHoja, hoy) {
  if (!enHoja) return ['07_Caja_Chica: no está en el maestro'];
  const out = [], porId = (fs) => { const m = {}; fs.forEach((f) => { m[String(f[7])] = f; }); return m; };
  const E = porId(esperadas.filter((f) => f[0] < hoy)), H = porId(enHoja.filter((f) => f[0] < hoy));
  Object.keys(E).forEach((id) => {
    const e = E[id], h = H[id];
    if (!h) { out.push('07_Caja_Chica: falta ' + e[0] + ' ' + e[1] + ' (Q' + e[2] + ')'); return; }
    if (h[0] !== e[0] || Math.abs(Number(h[2]) - Number(e[2])) > 0.005 || String(h[4]) !== String(e[4])) {
      out.push('07_Caja_Chica: ' + id + ' dice ' + h[0] + ' Q' + h[2] + ' ' + h[4] + ', debería ' + e[0] + ' Q' + e[2] + ' ' + e[4]);
    }
  });
  Object.keys(H).filter((id) => !E[id]).forEach((id) => out.push('07_Caja_Chica: sobra ' + H[id][0] + ' ' + H[id][1] + ' (Q' + H[id][2] + ')'));
  return out.slice(0, MAX);
}

module.exports = { VIVAS, HOJA_07, hayVivas, leerFresco, conLaBase, compararVivas, filas07Esperadas, filas07Hoja, comparar07 };
