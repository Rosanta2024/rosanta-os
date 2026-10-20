/**
 * Conciliacion de los pagos en linea y reporte mensual de gift cards (AYUDANTE 4, 20-oct-2026). Estudio §8.3.
 * Mismo estilo que conciliar.js: devuelve { mes, ok, totales, diferencias, avisos }; una diferencia = ok false
 * (la tarea responde 409 y llega la alerta de siempre).
 *
 * 1. Reporte de gift cards del mes (para el DRE, el maestro y el contador):
 *      saldo al inicio + vendido − canjeado − anulado − vencido = saldo al cierre  (el saldo vivo es un PASIVO)
 *    Se arma con los movimientos, y se comprueba contra el saldo guardado de cada tarjeta.
 * 2. Liquidaciones de Recurrente: cada deposito tiene que ser igual a la suma de los netos de los pagos que
 *    incluye (cobros menos reembolsos), y tiene que aparecer en el banco del maestro (BI o BAC).
 *    Recurrente NO dice que pagos van en cada retiro (pregunta para Recurrente): mientras tanto se proponen
 *    los pagos mas viejos sin liquidar cuya suma da exacto el deposito.
 * 3. FEL: cuantos cobros siguen sin FEL (la emite Rosanta; el contador decide cuando para las gift cards).
 */
const { r2 } = require('./almacen-web');
const { formatDate } = require('./motor-pagos');

const ZONA = 'America/Guatemala';

/** Inicio del mes y del siguiente, en hora de Guatemala (UTC-6, sin horario de verano). */
function limitesMes(mes) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mes invalido: ' + mes);
  const [y, m] = mes.split('-').map(Number);
  const sig = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0');
  return { desde: new Date(mes + '-01T00:00:00-06:00').toISOString(), hasta: new Date(sig + '-01T00:00:00-06:00').toISOString(), siguiente: sig };
}
const efecto = (m) => {   // en el saldo vivo
  if (m.tipo === 'venta' || m.tipo === 'reverso_canje') return Number(m.monto);
  return -Number(m.monto);
};

/**
 * reporteGiftcards(movimientos, tarjetas, mes) — puro. movimientos y tarjetas: filas de la base.
 * Devuelve { mes, saldo_inicio, vendido, canjeado, anulado, vencido, saldo_cierre, n_vendidas, n_canjes, por_origen, diferencias }.
 */
function reporteGiftcards(movimientos, tarjetas, mes) {
  const { desde, hasta } = limitesMes(mes);
  const t0 = new Date(desde).getTime(), t1 = new Date(hasta).getTime();
  const out = { mes, saldo_inicio: 0, vendido: 0, canjeado: 0, anulado: 0, vencido: 0, saldo_cierre: 0, n_vendidas: 0, n_canjes: 0, por_origen: {}, por_vencer_60d: 0, diferencias: [] };
  const origen = {}; tarjetas.forEach((t) => { origen[t.id] = t.origen; });
  const porTarjeta = {};
  movimientos.slice().sort((a, b) => a.id - b.id).forEach((m) => {
    const t = new Date(m.cuando).getTime();
    // cadena de saldos de cada tarjeta: cada movimiento parte del saldo en que dejo el anterior
    const prev = porTarjeta[m.gift_card_id];
    if (prev !== undefined && r2(prev) !== r2(m.saldo_antes)) out.diferencias.push('Gift card ' + m.gift_card_id + ': el movimiento ' + m.id + ' parte de Q' + m.saldo_antes + ' y el anterior dejó Q' + prev);
    porTarjeta[m.gift_card_id] = Number(m.saldo_despues);
    if (t < t0) { out.saldo_inicio = r2(out.saldo_inicio + efecto(m)); return; }
    if (t >= t1) return;
    const q = Number(m.monto);
    if (m.tipo === 'venta') { out.vendido = r2(out.vendido + q); out.n_vendidas++; const o = origen[m.gift_card_id] || '?'; out.por_origen[o] = r2((out.por_origen[o] || 0) + q); }
    else if (m.tipo === 'canje') { out.canjeado = r2(out.canjeado + q); out.n_canjes++; }
    else if (m.tipo === 'reverso_canje') out.canjeado = r2(out.canjeado - q);
    else if (m.tipo === 'anulacion') out.anulado = r2(out.anulado + q);
    else if (m.tipo === 'vencimiento') out.vencido = r2(out.vencido + q);
  });
  out.saldo_cierre = r2(out.saldo_inicio + out.vendido - out.canjeado - out.anulado - out.vencido);
  // el saldo de cada tarjeta = lo que dicen sus movimientos
  tarjetas.forEach((t) => {
    const s = porTarjeta[t.id] === undefined ? 0 : porTarjeta[t.id];
    if (r2(s) !== r2(t.saldo)) out.diferencias.push('Gift card ' + t.codigo + ': saldo guardado Q' + t.saldo + ', los movimientos dicen Q' + s);
  });
  // si el mes ya termino (o es el actual), el saldo al cierre tiene que ser la suma de los saldos de hoy menos lo que paso despues
  const despues = movimientos.filter((m) => new Date(m.cuando).getTime() >= t1).reduce((a, m) => r2(a + efecto(m)), 0);
  const hoy = tarjetas.reduce((a, t) => r2(a + Number(t.saldo)), 0);
  if (r2(hoy - despues) !== out.saldo_cierre) out.diferencias.push('Saldo vivo al cierre: movimientos Q' + out.saldo_cierre + ', tarjetas Q' + r2(hoy - despues));
  // vencido "de hecho": activas con fecha pasada al cierre del mes, que la tarea todavia no marco (aviso para el contador)
  const finMes = formatDate(new Date(t1 - 1), ZONA, 'yyyy-MM-dd');
  const limite60 = formatDate(new Date(t1 - 1 + 60 * 86400000), ZONA, 'yyyy-MM-dd');
  out.vencidas_sin_marcar = tarjetas.filter((t) => t.estado === 'activa' && diaTxt(t.vence) < finMes).reduce((a, t) => r2(a + Number(t.saldo)), 0);
  out.por_vencer_60d = tarjetas.filter((t) => t.estado === 'activa' && diaTxt(t.vence) >= finMes && diaTxt(t.vence) <= limite60).reduce((a, t) => r2(a + Number(t.saldo)), 0);
  return out;
}
function diaTxt(x) { return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : formatDate(new Date(x), ZONA, 'yyyy-MM-dd'); }

/** Neto con signo de un pago (los reembolsos y contracargos restan). */
const netoConSigno = (p) => (p.tipo === 'cobro' ? Number(p.neto) : -Number(p.neto));

/** ¿Cuadra una liquidacion con sus pagos? → { ok, suma, diferencia } */
function cuadrarLiquidacion(liq, pagos) {
  const mios = pagos.filter((p) => p.liquidacion_id === liq.id && p.moneda === liq.moneda);
  const suma = r2(mios.reduce((a, p) => a + netoConSigno(p), 0));
  const diferencia = r2(Number(liq.monto) - suma);
  return { ok: Math.abs(diferencia) < 0.005, suma, diferencia, n: mios.length };
}

/**
 * Propone que pagos van en una liquidacion: los mas viejos sin liquidar (misma moneda, antes de la fecha del
 * deposito) hasta que la suma de netos de EXACTO el monto. null si ningun corte da exacto.
 */
function proponerAsignacion(liq, pagosSinLiquidar) {
  const limite = new Date(liq.fecha + 'T23:59:59-06:00').getTime();
  const cand = pagosSinLiquidar.filter((p) => p.moneda === liq.moneda && !p.liquidacion_id && new Date(p.fecha).getTime() <= limite)
    .sort((a, b) => (new Date(a.fecha) - new Date(b.fecha)) || (a.id - b.id));
  let suma = 0;
  for (let i = 0; i < cand.length; i++) {
    suma = r2(suma + netoConSigno(cand[i]));
    if (Math.abs(suma - Number(liq.monto)) < 0.005) return cand.slice(0, i + 1).map((p) => p.id);
    if (suma > Number(liq.monto) + 0.005 && cand.slice(i + 1).every((p) => p.tipo === 'cobro')) break;
  }
  return null;
}

/**
 * Movimientos del banco que parecen depositos de Recurrente, desde los libros del maestro (la misma copia que
 * usa conciliar.js): 03_Banco_Industrial y 04_Banco_BAC, con "RECURRENTE" en la descripcion.
 * → [{ banco, fecha: 'AAAA-MM-DD', monto, descripcion, ref }]
 */
function depositosRecurrenteDelMaestro(libroMaestro) {
  const out = [];
  [['03_Banco_Industrial', 'BI'], ['04_Banco_BAC', 'BAC']].forEach(([pest, banco]) => {
    const M = libroMaestro && libroMaestro[pest];
    if (!M) return;
    const iH = M.findIndex((f) => f && f.indexOf('Fecha') !== -1 && f.some((c) => /^Cr[eé]dito$/.test(String(c))));
    if (iH < 0) return;
    const H = M[iH], iF = H.indexOf('Fecha'), iD = H.findIndex((c) => /^Descripci[oó]n$/.test(String(c))), iC = H.findIndex((c) => /^Cr[eé]dito$/.test(String(c)));
    const iR = Math.max(H.indexOf('Docto'), H.indexOf('Referencia'));
    M.slice(iH + 1).forEach((f) => {
      const desc = String(f[iD] || '');
      const monto = Number(f[iC]) || 0;
      if (!/RECURRENTE/i.test(desc) || monto <= 0) return;
      const fecha = f[iF] instanceof Date ? formatDate(f[iF], ZONA, 'yyyy-MM-dd') : String(f[iF]).slice(0, 10);
      out.push({ banco, fecha, monto: r2(monto), descripcion: desc, ref: banco + '|' + fecha + '|' + (iR >= 0 ? f[iR] : '') + '|' + r2(monto) });
    });
  });
  return out;
}

const difDias = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);

/**
 * conciliarPagosLinea({ almacen, mes, depositos, guardar }) → { mes, ok, totales, diferencias, avisos }
 *   depositos: los del banco (depositosRecurrenteDelMaestro). Sin depositos, no se cruza con el banco (aviso).
 *   guardar: si true, asigna los pagos propuestos y anota el estado de cada liquidacion.
 */
async function conciliarPagosLinea(o) {
  const al = o.almacen, mes = o.mes;
  const { desde, hasta } = limitesMes(mes);
  const difs = [], avisos = [];

  // 1. gift cards
  const [movs, tarjetas] = await Promise.all([al.lista('gift_cards_movimientos', {}, { orden: ['id'] }), al.lista('gift_cards')]);
  const gc = reporteGiftcards(movs, tarjetas, mes);
  gc.diferencias.forEach((d) => difs.push('Gift cards: ' + d));
  if (gc.vencidas_sin_marcar > 0) avisos.push('Gift cards vencidas que siguen activas: Q' + gc.vencidas_sin_marcar + ' (falta que el contador diga cómo tratarlas).');

  // 2. pagos del mes
  const pagos = await al.lista('pagos_en_linea', {}, { orden: ['fecha', 'id'] });
  const delMes = pagos.filter((p) => new Date(p.fecha) >= new Date(desde) && new Date(p.fecha) < new Date(hasta));
  const tot = { GTQ: { bruto: 0, comision: 0, otros: 0, neto: 0, reembolsos: 0, n: 0 }, USD: { bruto: 0, comision: 0, otros: 0, neto: 0, reembolsos: 0, n: 0 }, bruto_q: 0 };
  delMes.forEach((p) => {
    const t = tot[p.moneda];
    if (p.tipo === 'cobro') { t.bruto = r2(t.bruto + p.bruto); t.comision = r2(t.comision + p.comision); t.otros = r2(t.otros + p.otros_cargos); t.n++; tot.bruto_q = r2(tot.bruto_q + p.bruto_q); }
    else t.reembolsos = r2(t.reembolsos + p.neto);
    t.neto = r2(t.neto + netoConSigno(p));
  });
  const sinFel = delMes.filter((p) => p.tipo === 'cobro' && p.fel_estado === 'pendiente').length;
  if (sinFel) avisos.push(sinFel + ' cobro(s) en línea sin FEL todavía.');
  // las gift cards vendidas en linea tienen que tener su cobro (y al reves)
  const cobrosGc = delMes.filter((p) => p.tipo === 'cobro' && p.concepto === 'gift_card');
  const tarjetasWeb = tarjetas.filter((t) => t.origen === 'web' && t.pago_id);
  cobrosGc.forEach((p) => { if (!p.concepto_id) difs.push('Cobro ' + p.proveedor_id + ' (gift card) sin tarjeta: revisar el pedido.'); });
  tarjetasWeb.forEach((t) => { if (!pagos.some((p) => p.id === t.pago_id)) difs.push('Gift card ' + t.codigo + ' sin su cobro en pagos_en_linea.'); });

  // 3. liquidaciones del mes contra sus pagos y contra el banco
  const liqs = (await al.lista('pagos_liquidaciones', {}, { orden: ['fecha', 'id'] })).filter((l) => diaTxt(l.fecha).slice(0, 7) === mes);
  const sinLiquidar = pagos.filter((p) => !p.liquidacion_id);
  const usados = new Set(), bancoUsado = new Set();   // no se marca nada en lo que llega
  const detalle = [];
  for (const l of liqs) {
    const liq = Object.assign({}, l, { fecha: diaTxt(l.fecha) });
    let c = cuadrarLiquidacion(liq, pagos);
    if (!c.n) {
      const ids = proponerAsignacion(liq, sinLiquidar.filter((p) => !usados.has(p.id)));
      if (ids) {
        ids.forEach((id) => usados.add(id));
        if (o.guardar) for (const id of ids) await al.actualizar('pagos_en_linea', id, { liquidacion_id: liq.id, actualizado: new Date().toISOString() });
        const asignados = pagos.map((p) => (ids.indexOf(p.id) !== -1 ? Object.assign({}, p, { liquidacion_id: liq.id }) : p));
        c = cuadrarLiquidacion(liq, asignados);
        avisos.push('Liquidación ' + liq.referencia + ': se le asignaron ' + ids.length + ' pago(s) por fecha y monto (Recurrente no dice cuáles van).');
      }
    }
    if (!c.ok) difs.push('Liquidación ' + liq.referencia + ' (' + liq.fecha + '): Recurrente depositó ' + liq.moneda + ' ' + liq.monto + ' y los pagos suman ' + c.suma + ' (diferencia ' + c.diferencia + ').');
    let banco = null;
    if (o.depositos) {
      banco = o.depositos.find((d) => Math.abs(d.monto - Number(liq.monto)) < 0.005 && Math.abs(difDias(d.fecha, liq.fecha)) <= 3 && !bancoUsado.has(d));
      if (banco) bancoUsado.add(banco);
      else difs.push('Liquidación ' + liq.referencia + ' (' + liq.fecha + ', ' + liq.monto + '): no aparece en el banco del maestro.');
    }
    if (o.guardar) await al.actualizar('pagos_liquidaciones', liq.id, { estado: c.ok && (banco || !o.depositos) ? 'cuadra' : 'diferencia', diferencia: c.diferencia,
      banco: banco ? banco.banco : liq.banco, banco_referencia: banco ? banco.ref : liq.banco_referencia, conciliada: new Date().toISOString() });
    detalle.push({ referencia: liq.referencia, fecha: liq.fecha, moneda: liq.moneda, monto: Number(liq.monto), suma_pagos: c.suma, diferencia: c.diferencia, banco: banco ? banco.ref : null });
  }
  if (o.depositos) o.depositos.filter((d) => d.fecha.slice(0, 7) === mes && !bancoUsado.has(d)).forEach((d) => difs.push('Depósito de Recurrente en ' + d.banco + ' del ' + d.fecha + ' por ' + d.monto + ' sin liquidación en la base.'));
  else avisos.push('No se cruzó con el banco (no llegaron los movimientos del maestro).');
  const cobradoSinLiquidar = pagos.filter((p) => !p.liquidacion_id && !usados.has(p.id) && p.tipo === 'cobro' && new Date(p.fecha) < new Date(hasta) && new Date(p.fecha) < new Date(Date.now() - 4 * 86400000));
  if (cobradoSinLiquidar.length) avisos.push(cobradoSinLiquidar.length + ' cobro(s) de hace más de 4 días sin liquidación (Recurrente acredita en 24 h hábiles).');

  return { mes, ok: difs.length === 0, totales: { giftcards: gc, pagos: tot, liquidaciones: detalle }, diferencias: difs, avisos };
}

module.exports = { conciliarPagosLinea, reporteGiftcards, cuadrarLiquidacion, proponerAsignacion, depositosRecurrenteDelMaestro, limitesMes };
