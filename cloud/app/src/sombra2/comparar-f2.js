/**
 * Comparacion de cada noche de la sombra 2 (Caja chica, Compras en efectivo y Eventos), 17-oct-2026.
 *
 * Igual que comparar-pagos.js: el servidor corre el MISMO codigo que la intranet, asi que solo
 * puede dar distinto por los DATOS (una copia atrasada o una celda mal convertida). Cada noche:
 *   1. relee las hojas directo de Google y arma cada pantalla con eso ("hojas");
 *   2. la arma con la copia que usa la pantalla ("copia");
 *   3. compara los numeros que importan y cuenta celdas con error.
 * Guarda la foto en caja_fotos. Si algo no coincide, la tarea responde 409, el reloj lo marca y
 * llega el correo de alerta.
 */
const C = require('../copia-hojas');
const { formatDate } = require('../motor-pagos');
const { crearMotores, soloExistentes, LIBROS_CAJA, LIBROS_EVENTOS, MKT_ID } = require('./servicio-f2');
const { celdasConError } = require('../comparar-pagos');

const DUENO = { email: 'comparacion@servidor', rol: 'dueno', modulos: ['pagos', 'marketing'], nombre: 'Comparación automática' };
const CAMPOS_DIA = ['inicial', 'efectivo', 'correcciones', 'entradas', 'salidas', 'esperado', 'contado', 'diferencia', 'estado'];
const CAMPOS_CAJA = ['saldo', 'descuadres', 'faltante', 'sobrante', 'sin_conteo', 'sin_cierre'];
const CAMPOS_COMPRAS = ['retirado', 'registrado', 'por_justificar', 'retiros_sin_justificar', 'debito_sin_registro', 'q_debito_sin_registro', 'sin_solicitud'];

const r2 = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 100) / 100);

/** Lo que se compara de cada pantalla (numeros que ve la persona). */
function resumenCaja(c) {
  const o = {}; CAMPOS_CAJA.forEach((k) => { o[k] = r2(c.resumen[k]); });
  o.dias = (c.dias || []).map((d) => { const x = { fecha: d.fecha }; CAMPOS_DIA.forEach((k) => { x[k] = k === 'estado' ? d[k] : r2(d[k]); }); return x; });
  return o;
}
function resumenCompras(c) { const o = {}; CAMPOS_COMPRAS.forEach((k) => { o[k] = r2(c.resumen[k]); }); return o; }
function resumenEventos(ev) {
  const porEtapa = {};
  (ev.filas || []).forEach((f) => {
    const e = String(f.etapa || f.estado || 'sin etapa').toLowerCase();
    const x = porEtapa[e] || (porEtapa[e] = { n: 0, q: 0 });
    x.n++; x.q = r2(x.q + (Number(f.monto_q) || 0));
  });
  const versiones = {}; (ev.filas || []).forEach((f) => { versiones[f.id] = f.version; });
  return { filas: (ev.filas || []).length, por_etapa: porEtapa, versiones };
}

/** Lista de textos con lo que cambia entre dos objetos planos o anidados (vacia si son iguales). */
function diferencias(a, b, prefijo) {
  const out = [];
  const p = prefijo ? prefijo + ' ' : '';
  const claves = Array.from(new Set(Object.keys(a || {}).concat(Object.keys(b || {})))).sort();
  claves.forEach((k) => {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    if (x && typeof x === 'object' && y && typeof y === 'object') { out.push(...diferencias(x, y, p + k)); return; }
    if (typeof x === 'number' && typeof y === 'number') { if (Math.abs(x - y) > 0.005) out.push(p + k + ': copia ' + x + ' · hojas ' + y); return; }
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(p + k + ': copia ' + JSON.stringify(x) + ' · hojas ' + JSON.stringify(y));
  });
  return out;
}

/** Los dias de la caja comparados por fecha (asi el aviso dice que dia). */
function difCaja(a, b) {
  const sinDias = (o) => { const x = Object.assign({}, o); delete x.dias; return x; };
  const out = diferencias(sinDias(a), sinDias(b), 'caja');
  const porFecha = (o) => { const m = {}; o.dias.forEach((d) => { m[d.fecha] = d; }); return m; };
  out.push(...diferencias(porFecha(a), porFecha(b), 'caja día'));
  return out;
}

/** Arma los tres resumenes con unos libros. Un modulo que no se puede armar queda como { error }. */
function armar(libros) {
  const M = crearMotores(libros);
  const intento = (f) => { try { return f(); } catch (e) { return { error: String(e.message || e) }; } };
  return {
    caja: intento(() => resumenCaja(M.caja.correr(DUENO, 'getCajaChica', []).resultado)),
    compras: intento(() => resumenCompras(M.caja.correr(DUENO, 'getComprasEfectivo', []).resultado)),
    eventos: libros[MKT_ID] ? intento(() => resumenEventos(M.eventos.correr(DUENO, 'getEventos', []).resultado)) : { error: 'Sin copia de Marketing OS' }
  };
}

/** Compara lo armado con la copia contra lo armado con las hojas. */
function compararResumenes(copia, hojas) {
  const difs = [];
  ['caja', 'compras', 'eventos'].forEach((m) => {
    if (hojas[m].error) { difs.push(m + ': no se pudo armar con las hojas (' + hojas[m].error + ')'); return; }
    if (copia[m].error) { difs.push(m + ': no se pudo armar con la copia (' + copia[m].error + ')'); return; }
    difs.push(...(m === 'caja' ? difCaja(copia[m], hojas[m]) : diferencias(copia[m], hojas[m], m)));
  });
  return difs;
}

/** Lee las hojas de nuevo, directo de Google. Si Marketing OS no se puede leer, sigue sin el. */
async function leerFresco(sheets) {
  const fresco = {};
  const caja = await soloExistentes(sheets, LIBROS_CAJA);
  for (const k of Object.keys(caja)) fresco[caja[k].id] = await C.leerLibro(sheets, caja[k].id, caja[k].pestanas);
  try {
    const ev = await soloExistentes(sheets, LIBROS_EVENTOS);
    fresco[MKT_ID] = await C.leerLibro(sheets, MKT_ID, ev.marketing.pestanas);
  } catch (e) { /* queda sin eventos: armar() lo dice */ }
  return fresco;
}

/** comparar({ pool, sheets, librosCopia, copiaLeida, ahora }) → la foto (y la guarda). */
async function comparar(o) {
  const fresco = await leerFresco(o.sheets);
  const copia = armar(o.librosCopia || {});
  const hojas = armar(fresco);
  const difs = compararResumenes(copia, hojas);
  const foto = {
    cuando_gt: formatDate(o.ahora || new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm'),
    caja: hojas.caja.error ? null : (({ dias, ...r }) => r)(hojas.caja), compras: hojas.compras.error ? null : hojas.compras,
    eventos: hojas.eventos.error ? null : { filas: hojas.eventos.filas, por_etapa: hojas.eventos.por_etapa },
    copia_leida: o.copiaLeida || null, copia_al_dia: difs.length === 0, diferencias: difs, celdas_error: celdasConError(fresco)
  };
  await o.pool.query(
    `INSERT INTO caja_fotos (caja, compras, eventos, copia_leida, copia_al_dia, diferencias, celdas_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [JSON.stringify(foto.caja), JSON.stringify(foto.compras), JSON.stringify(foto.eventos), foto.copia_leida, foto.copia_al_dia,
      JSON.stringify(foto.diferencias), JSON.stringify(foto.celdas_error)]);
  return foto;
}

module.exports = { comparar, armar, compararResumenes, resumenCaja, resumenCompras, resumenEventos, diferencias, difCaja };
