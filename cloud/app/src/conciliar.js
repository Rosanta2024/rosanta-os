/**
 * CONCILIACION DEL CIERRE DE MES (19-oct-2026). Compensa haber acortado la sombra a 1 semana (decision de
 * Juanma): la sombra de Pagos iba a incluir un cierre de mes y ya no lo incluye. Corre el ultimo dia del
 * mes en la noche y el dia 1 en la mañana (Cloud Scheduler), y se puede pedir a mano para cualquier mes.
 *
 * Mira, con la base y con las hojas lado a lado:
 *   - Pagos: el cuadre por proveedor completo (el mismo codigo de la pantalla) y lo pagado en el mes.
 *   - Caja chica: movimientos del mes por tipo, retiros del mes, y 07_Caja_Chica del maestro (DRE).
 *   - Cierres del dia: cuantos dias y la venta del mes; los dias sin cierre o que no cuadran son AVISOS.
 *   - Fila por fila: base = hoja en las cuatro pestañas (sin faltantes, distintas ni repetidas).
 * Guarda el resultado en `conciliaciones` (migracion 006). Con una diferencia, la tarea responde 409 y
 * llega el correo de alerta (la misma alarma de las tareas automaticas).
 */
const C = require('./copia-hojas');
const IMP = require('./importar-pagos');
const { crearMotor, formatDate } = require('./motor-pagos');
const { resumen, diferencias } = require('./comparar-pagos');
const B = require('./base-vs-hoja');

const DUENO = { email: 'conciliacion@servidor', rol: 'dueno', modulos: ['pagos'], nombre: 'Conciliación de mes' };
const r2 = (x) => Math.round(x * 100) / 100;
const anulado = (x) => /ANULAD/i.test(String(x || ''));

/** El mes que toca: del 28 en adelante, el mes en curso; antes, el anterior. */
function mesQueToca(ahora) {
  const hoy = formatDate(ahora || new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  const [y, m, d] = hoy.split('-').map(Number);
  if (d >= 28) return hoy.slice(0, 7);
  return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
}

/** Filas del mes de una matriz: {n, q, por: {grupo: {n, q}}}. Sin las anuladas. */
function totalMes(M, mes, colFecha, colMonto, colEstado, colGrupo) {
  const out = { n: 0, q: 0, por: {} };
  if (!M || !M.length) return out;
  const H = M[0], iF = H.indexOf(colFecha), iQ = H.indexOf(colMonto), iE = colEstado ? H.indexOf(colEstado) : -1, iG = colGrupo ? H.indexOf(colGrupo) : -1;
  M.slice(1).forEach((f) => {
    if (IMP.llave(f[iF]).slice(0, 7) !== mes || (iE >= 0 && anulado(f[iE]))) return;
    const q = Number(f[iQ]) || 0;
    out.n++; out.q = r2(out.q + q);
    if (iG >= 0) { const g = String(f[iG] || '—'); out.por[g] = out.por[g] || { n: 0, q: 0 }; out.por[g].n++; out.por[g].q = r2(out.por[g].q + q); }
  });
  return out;
}

/** Lo que cambia entre dos totales (base, hoja). */
function compararTotal(nombre, base, hoja, out) {
  if (base.n !== hoja.n || Math.abs(base.q - hoja.q) > 0.005) out.push(nombre + ': base ' + base.n + ' · Q' + base.q + ' / hoja ' + hoja.n + ' · Q' + hoja.q);
  Object.keys(Object.assign({}, base.por, hoja.por)).forEach((g) => {
    const a = base.por[g] || { n: 0, q: 0 }, b = hoja.por[g] || { n: 0, q: 0 };
    if (a.n !== b.n || Math.abs(a.q - b.q) > 0.005) out.push(nombre + ' › ' + g + ': base ' + a.n + ' · Q' + a.q + ' / hoja ' + b.n + ' · Q' + b.q);
  });
}

/** Los dias del mes hasta ayer (o hasta fin de mes si ya paso). */
function diasDelMes(mes, hoy) {
  const [y, m] = mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), out = [];
  for (let d = 1; d <= n; d++) { const f = mes + '-' + String(d).padStart(2, '0'); if (f < hoy) out.push(f); }
  return out;
}

/**
 * conciliarMes({ pool, sheets, mes?, ahora?, exigir07? }) → { mes, ok, totales, diferencias, avisos } (y lo guarda).
 * exigir07: con Caja en vivo, una diferencia en 07_Caja_Chica cuenta; si no (la regenera la pantalla vieja), es aviso.
 */
async function conciliarMes(o) {
  const ahora = o.ahora || new Date(), hoy = formatDate(ahora, 'America/Guatemala', 'yyyy-MM-dd');
  const mes = o.mes || mesQueToca(ahora);
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mes invalido: ' + mes);
  const cfg = C.LIBROS.config.id, difs = [], avisos = [];
  const vivas = await B.hayVivas(o.pool);
  const fresco = await B.leerFresco(o.sheets);
  const conBase = await B.conLaBase(o.pool, fresco, vivas);
  const H = fresco[cfg], K = conBase[cfg];

  // Pagos: cuadre por proveedor con el mismo codigo de la pantalla, y lo pagado en el mes
  const arma = (libros) => resumen(crearMotor({ libros, configId: cfg }).correr(DUENO, 'getPagosProveedores', []).resultado, hoy);
  diferencias(arma(conBase), arma(fresco)).forEach((d) => difs.push('Pagos: ' + d.replace('copia ', 'base ')));
  const pagos = { base: totalMes(K.PAGOS_PROVEEDORES, mes, 'FECHA PAGADO', 'CANTIDAD PAGADA', 'ESTATUS DE PAGO', 'AREA'),
                  hoja: totalMes(H.PAGOS_PROVEEDORES, mes, 'FECHA PAGADO', 'CANTIDAD PAGADA', 'ESTATUS DE PAGO', 'AREA') };
  compararTotal('Pagado en el mes', pagos.base, pagos.hoja, difs);

  // Caja chica y retiros del mes
  const caja = { base: totalMes(K.CAJA_CHICA, mes, 'FECHA', 'MONTO', 'ESTATUS', 'TIPO'), hoja: totalMes(H.CAJA_CHICA, mes, 'FECHA', 'MONTO', 'ESTATUS', 'TIPO') };
  compararTotal('Caja chica', caja.base, caja.hoja, difs);
  const retiros = { base: totalMes(K.RETIROS_SOLICITUDES, mes, 'FECHA', 'MONTO', 'ESTATUS', 'AREA'), hoja: totalMes(H.RETIROS_SOLICITUDES, mes, 'FECHA', 'MONTO', 'ESTATUS', 'AREA') };
  compararTotal('Retiros', retiros.base, retiros.hoja, difs);

  // 07_Caja_Chica del maestro: lo del mes, contra lo que la caja dice con la base
  const esperadas = B.filas07Esperadas(conBase), enHoja = B.filas07Hoja(fresco);
  const delMes = (fs) => (fs || []).filter((f) => String(f[0]).slice(0, 7) === mes && f[0] < hoy);
  const suma = (fs) => ({ n: fs.length, q: r2(fs.reduce((a, f) => a + (Number(f[2]) || 0), 0)), por: {} });
  const maestro07 = { esperado: suma(delMes(esperadas)), en_maestro: suma(delMes(enHoja)) };
  const d07 = B.comparar07(delMes(esperadas), enHoja && delMes(enHoja), hoy);
  (o.exigir07 ? difs : avisos).push(...d07);

  // Cierres del dia: venta del mes; los dias que faltan o no cuadran son avisos (es el dato, no la mudanza)
  const cierres = { base: totalMes(K.CIERRES_DIARIOS, mes, 'FECHA', 'GRAN_TOTAL'), hoja: totalMes(H.CIERRES_DIARIOS, mes, 'FECHA', 'GRAN_TOTAL') };
  compararTotal('Cierres del día', cierres.base, cierres.hoja, difs);
  if (K.CIERRES_DIARIOS) {
    const iF = K.CIERRES_DIARIOS[0].indexOf('FECHA'), iC = K.CIERRES_DIARIOS[0].indexOf('CUADRA'), hay = {};
    K.CIERRES_DIARIOS.slice(1).forEach((f) => { hay[IMP.llave(f[iF])] = String(f[iC]); });
    const faltan = diasDelMes(mes, hoy).filter((d) => !hay[d]), noCuadran = Object.keys(hay).filter((d) => d.slice(0, 7) === mes && hay[d] !== 'SI').sort();
    if (faltan.length) avisos.push('Días sin cierre de PosFile: ' + faltan.join(', ') + ' (puede ser un día cerrado)');
    if (noCuadran.length) avisos.push('Cierres que no cuadran: ' + noCuadran.join(', '));
  }

  // Fila por fila
  if (vivas) (await B.compararVivas(o.pool, fresco)).forEach((d) => difs.push(d));
  else avisos.push('La base todavía no tiene caja, retiros ni cierres (migración 005): se comparó solo la hoja contra sí misma.');

  const totales = { pagos, caja, retiros, maestro07, cierres };
  const ok = difs.length === 0;
  await o.pool.query('INSERT INTO conciliaciones (mes, ok, totales, diferencias, avisos) VALUES ($1,$2,$3,$4,$5)',
    [mes, ok, JSON.stringify(totales), JSON.stringify(difs), JSON.stringify(avisos)]);
  return { mes, ok, totales, diferencias: difs, avisos };
}

module.exports = { conciliarMes, mesQueToca, totalMes, diasDelMes };
