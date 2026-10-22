/**
 * LOS ARCHIVOS DEL BANCO → EL CSV NORMALIZADO del cierre de bancos (22-oct-2026).
 *
 * El cargador del maestro (apps-script/rosanta-maestro/cierre_bancos.js, el mismo en Apps Script y en la nube) lee
 * SIEMPRE un CSV normalizado; este modulo lo arma desde lo que baja Juanma del banco. Lo usan:
 *   - cloud/herramientas/xls-a-csv-banco.js en la Mac (octubre: Apps Script todavia escribe y Drive NO convierte el
 *     .xls del BAC: queda una hoja vacia, probado el 22-oct-2026);
 *   - la precarga de proc-maestro.js en la nube (ROSANTA_NUBE.bancoANormalizado).
 *
 * Lee:
 *   BAC "Archivo excel (XLS)" (Transacciones del mes.xls, CDFV2), cuentas en quetzales y en dolares: encabezado
 *     Fecha | Referencia | Código | Descripción | Débitos | Créditos | Balance*, una fila "Saldo Inicial", los
 *     movimientos (fecha dd/mm/aaaa) y "Totales" (cantidad y monto de debitos y de creditos). Arriba: Producto
 *     (numero de cuenta), moneda y la fecha en que se genero.
 *   Tarjeta BAC: el CSV "Transacciones del periodo" (latin-1: Product, Name, Date (corte), ..., Cash payment;
 *     "Previous balance"; una seccion por tarjeta adicional; los cargos sin fecha son del corte) o un .xls con las
 *     mismas filas.
 * Con SheetJS oficial (cdn.sheetjs.com, xlsx-0.20.3; NO el "xlsx" 0.18.5 del registro de npm).
 *
 * La cuenta se decide por el NUMERO DE CUENTA o DE TARJETA del encabezado del archivo (nunca por el nombre) y el mes
 * por las fechas de los movimientos (o el corte). Una cuenta desconocida, un mes mezclado o un estado que no cuadra
 * consigo mismo → Error: no se adivina.
 */
const XLSX = require('xlsx');

/** Nombre fijo de cada cuenta (el CSV sale como "BAC Q 2026-10.csv"). La pestaña destino la decide el cargador. */
const NOMBRES = {
  '904802543': 'BAC Q',
  '905757274': 'BAC $',
  '4966-64**-****-2794': 'TC BAC'
};
const CAB_CUENTA = 'tipo,cuenta,moneda,fecha,referencia,codigo,descripcion,debito,credito,saldo,categoria';
const CAB_TARJETA = 'tipo,tarjeta,fecha,descripcion,quetzales,dolares,categoria';

const r2 = (n) => Math.round(n * 100) / 100;
const sinTilde = (s) => String(s === null || s === undefined ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const celda = (x) => (x === null || x === undefined ? '' : x);

function numero(x, que) {
  if (typeof x === 'number') return r2(x);
  const s = String(celda(x)).replace(/,/g, '').trim();
  if (s === '') return 0;
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(que + ': "' + x + '" no es un monto');
  return r2(Number(s));
}
function fechaDMA(s, que) {
  const m = String(celda(s)).trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!m) throw new Error(que + ': fecha ilegible "' + s + '"');
  return m[3] + '-' + m[2] + '-' + m[1];
}
/** Numero de serie de Excel (hora local de quien lo genero) → AAAA-MM-DD. */
function fechaSerie(n) {
  const d = new Date(Math.round((n - 25569) * 86400000));
  const p = (x) => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
const csvCampo = (x) => { const s = String(celda(x)); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (filas) => filas.map((f) => f.map(csvCampo).join(',')).join('\n') + '\n';
const monto = (n) => r2(n).toFixed(2);

/** Un solo mes en todas las fechas. */
function unMes(fechas, que) {
  const meses = [...new Set(fechas.map((f) => f.slice(0, 7)))];
  if (meses.length !== 1) throw new Error(que + ': trae movimientos de ' + (meses.join(', ') || 'ningun mes') + '; tiene que ser un solo mes.');
  return meses[0];
}

function nombreDe(cuenta, que) {
  const n = NOMBRES[cuenta];
  if (!n) throw new Error(que + ': la cuenta o tarjeta "' + cuenta + '" no es ninguna de las conocidas (' + Object.keys(NOMBRES).join(', ') + '). No se adivina.');
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// Cuenta BAC (quetzales o dolares), del .xls
// ---------------------------------------------------------------------------------------------------------------

/** filas (array de arrays, como sheet_to_json header:1) del .xls de una cuenta BAC → { texto, resumen }. */
function cuentaDeFilas(M, que) {
  const iEnc = M.findIndex((r) => sinTilde(r[0]) === 'fecha' && sinTilde(r[1]) === 'referencia');
  if (iEnc < 0) throw new Error(que + ': no encontre el encabezado Fecha | Referencia de "Transacciones del mes".');
  const H = M[iEnc].map(sinTilde);
  const col = (t) => { const i = H.findIndex((h) => h.indexOf(t) === 0); if (i < 0) throw new Error(que + ': falta la columna ' + t); return i; };
  const c = { fecha: col('fecha'), ref: col('referencia'), cod: col('codigo'), desc: col('descripcion'), deb: col('debitos'), cred: col('creditos'), bal: col('balance') };
  const prod = M.slice(0, iEnc).find((r) => sinTilde(r[0]) === 'producto');
  if (!prod) throw new Error(que + ': no trae la fila Producto (numero de cuenta).');
  const cuenta = String(celda(prod[1])).trim();
  const moneda = String(prod.slice(2).find((x) => /^(QTZ|USD)$/.test(String(x).trim())) || '').trim();
  if (!moneda) throw new Error(que + ': no trae la moneda (QTZ o USD) junto a la cuenta.');
  const gen = M.slice(0, iEnc).find((r) => sinTilde(r[0]) === 'fecha');
  const generado = gen && typeof gen[1] === 'number' ? fechaSerie(gen[1]) : '';

  let inicial = null, totales = null;
  const movs = [];
  for (let i = iEnc + 1; i < M.length; i++) {
    const r = M[i], que2 = que + ' fila ' + (i + 1);
    if (sinTilde(r[c.desc]) === 'saldo inicial') { inicial = numero(r[c.bal], que2); continue; }
    if (sinTilde(r[0]) === 'totales') {
      const v = r.slice(1).filter((x) => String(celda(x)).trim() !== '');
      if (v.length !== 4) throw new Error(que2 + ': la fila Totales no trae cantidad y monto de debitos y de creditos.');
      totales = { nDeb: numero(v[0], que2), deb: numero(v[1], que2), nCred: numero(v[2], que2), cred: numero(v[3], que2) };
      continue;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(celda(r[c.fecha])).trim())) continue;
    movs.push({ fecha: fechaDMA(r[c.fecha], que2), ref: String(celda(r[c.ref])).trim(), cod: String(celda(r[c.cod])).trim(),
      desc: String(celda(r[c.desc])), deb: numero(r[c.deb], que2), cred: numero(r[c.cred], que2), bal: numero(r[c.bal], que2) });
  }
  if (inicial === null) throw new Error(que + ': no trae el Saldo Inicial.');
  if (!totales) throw new Error(que + ': no trae la fila Totales.');
  if (!movs.length) throw new Error(que + ': no trae movimientos (sin ellos no se sabe el mes).');
  const mes = unMes(movs.map((m) => m.fecha), que);
  // el estado contra si mismo
  let s = inicial;
  movs.forEach((m, i) => {
    s = r2(s - m.deb + m.cred);
    if (s !== m.bal) throw new Error(que + ': la cadena de saldos se rompe en el movimiento ' + (i + 1) + ' (' + m.fecha + ').');
  });
  const deb = r2(movs.reduce((a, m) => a + m.deb, 0)), cred = r2(movs.reduce((a, m) => a + m.cred, 0));
  const nDeb = movs.filter((m) => m.deb).length, nCred = movs.filter((m) => m.cred).length;
  if (deb !== totales.deb || cred !== totales.cred || nDeb !== totales.nDeb || nCred !== totales.nCred) {
    throw new Error(que + ': los movimientos (' + nDeb + ' debitos, ' + nCred + ' creditos) no dan los Totales del banco (' + totales.nDeb + ', ' + totales.nCred + ').');
  }
  const nombre = nombreDe(cuenta, que);
  const filas = [CAB_CUENTA.split(','), ['INICIAL', cuenta, moneda, '', '', '', 'Saldo inicial', '', '', monto(inicial), '']];
  movs.forEach((m) => filas.push(['MOV', cuenta, moneda, m.fecha, m.ref, m.cod, m.desc, monto(m.deb), monto(m.cred), monto(m.bal), '']));
  filas.push(['TOTAL', cuenta, moneda, '', '', '', 'Totales del banco', monto(deb), monto(cred), monto(s), '']);
  if (generado) filas.push(['GENERADO', cuenta, moneda, generado, '', '', 'Fecha en que se bajo del banco', '', '', '', '']);
  return { texto: csv(filas), resumen: { formato: 'CUENTA', cuenta, moneda, mes, nombre: nombre + ' ' + mes + '.csv', movimientos: movs.length,
    debitos: deb, creditos: cred, inicial, final: s, generado } };
}

// ---------------------------------------------------------------------------------------------------------------
// Tarjeta BAC ("Transacciones del periodo")
// ---------------------------------------------------------------------------------------------------------------

/** filas de la tarjeta (del CSV o del .xls) → { texto, resumen }. */
function tarjetaDeFilas(M, que) {
  const t = (r, i) => String(celda(r[i])).trim();
  const iCab = M.findIndex((r) => /^pro0*duct/i.test(t(r, 0)) || /^producto/i.test(sinTilde(r[0])));
  if (iCab < 0 || !M[iCab + 1]) throw new Error(que + ': no encontre el encabezado Product | Name | Date de la tarjeta.');
  const H = M[iCab].map(sinTilde), v = M[iCab + 1];
  const iCash = H.findIndex((h) => /cash payment ?\/ ?local/.test(h) || /pago contado ?\/ ?monto local/.test(h));
  if (iCash < 0) throw new Error(que + ': no trae el pago de contado (Cash payment).');
  const tarjeta = t(v, 0), corte = fechaDMA(t(v, 2), que + ' fecha de corte');
  const contado = [numero(v[iCash], que), numero(v[iCash + 1], que)];
  let previo = null, sub = '';
  const movs = [];
  for (let i = iCab + 2; i < M.length; i++) {
    // el CSV del banco no usa comillas: una descripcion con coma ("TIENDA, CON COMA") llega partida y se vuelve a
    // unir con la coma original (los campos van separados por ", ")
    const crudo = M[i].map((x) => String(celda(x)));
    while (crudo.length && crudo[crudo.length - 1].trim() === '') crudo.pop();
    const r = crudo.map((x) => x.trim());
    if (!r.length) continue;
    if (/^current interest|^intereses corrientes/i.test(r[0])) break;
    if (r.length < 4) continue;
    if (/^date$|^fecha$/i.test(r[0])) continue;
    const que2 = que + ' fila ' + (i + 1);
    const q = numero(r[r.length - 2], que2), d = numero(r[r.length - 1], que2);
    const desc = crudo.slice(1, r.length - 2).join(',').trim();
    if (r[0] === '') {
      if (/^previous balance$|^saldo anterior$/i.test(desc)) { previo = [q, d]; continue; }
      if (/^\d{4}-\d{2}\*\*/.test(desc)) { sub = desc; continue; }
      if (/^(PUNTOS|ASIGNADO)\b/.test(desc)) continue;
      movs.push({ sub, fecha: corte, desc, q, d });
    } else {
      movs.push({ sub, fecha: fechaDMA(r[0], que2), desc, q, d });
    }
  }
  if (!previo) throw new Error(que + ': no trae el saldo anterior (Previous balance).');
  if (!movs.length) throw new Error(que + ': no trae movimientos.');
  const sq = r2(movs.reduce((a, m) => a + m.q, 0)), sd = r2(movs.reduce((a, m) => a + m.d, 0));
  if (r2(previo[0] + sq) !== contado[0] || r2(previo[1] + sd) !== contado[1]) {
    throw new Error(que + ': saldo anterior + movimientos no da el pago de contado del estado (quetzales o dolares).');
  }
  const mes = corte.slice(0, 7);
  const nombre = nombreDe(tarjeta, que);
  const filas = [CAB_TARJETA.split(','), ['CORTE', tarjeta, corte, 'Fecha de corte', '', '', ''], ['PREVIO', '', '', 'Saldo anterior', monto(previo[0]), monto(previo[1]), '']];
  movs.forEach((m) => filas.push(['MOV', m.sub, m.fecha, m.desc, monto(m.q), monto(m.d), '']));
  filas.push(['CONTADO', '', '', 'Pago de contado', monto(contado[0]), monto(contado[1]), '']);
  return { texto: csv(filas), resumen: { formato: 'TARJETA', cuenta: tarjeta, mes, nombre: nombre + ' ' + mes + '.csv', movimientos: movs.length,
    quetzales: sq, dolares: sd, previo, contado, corte } };
}

/** Una linea del CSV del banco (sin comillas: la descripcion puede traer comas). */
const lineaCsvBanco = (l) => l.split(',');

// ---------------------------------------------------------------------------------------------------------------
// La entrada
// ---------------------------------------------------------------------------------------------------------------

const CDFV2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const esCabeceraNormalizada = (texto) => {
  const l = String(texto).replace(/^﻿/, '').split(/\r?\n/)[0].trim().toLowerCase();
  return l === CAB_CUENTA || l === CAB_TARJETA;
};

/**
 * bytes de un archivo del banco → { texto, resumen } o null si no es un archivo del banco que se conozca.
 * Lanza Error si es del banco pero algo no cuadra (cuenta desconocida, mes mezclado, totales...).
 */
function normalizar(bytes, nombre) {
  const que = nombre || 'archivo';
  const b = Buffer.from(bytes);
  if (b.subarray(0, 4).equals(CDFV2) || /\.xlsx?$/i.test(nombre || '')) {
    let wb;
    try { wb = XLSX.read(b, { type: 'buffer', raw: false, cellDates: false }); } catch (e) { return null; }
    const M = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    if (M.some((r) => sinTilde(r[0]) === 'fecha' && sinTilde(r[1]) === 'referencia')) return cuentaDeFilas(M, que);
    if (M.some((r) => /^pro0*duct|^producto/i.test(String(r[0]).trim()))) return tarjetaDeFilas(M, que);
    return null;
  }
  const texto = b.toString('latin1');
  if (esCabeceraNormalizada(texto)) return null;   // ya es el normalizado
  if (/^Pro0*duct/i.test(texto.trim())) return tarjetaDeFilas(texto.split(/\r?\n/).map(lineaCsvBanco), que);
  return null;
}

module.exports = { NOMBRES, CAB_CUENTA, CAB_TARJETA, normalizar, cuentaDeFilas, tarjetaDeFilas, esCabeceraNormalizada, csv };
