/**
 * Comparacion automatica de Pagos (Fase 1, 17-oct-2026).
 *
 * La pantalla nueva corre el mismo codigo que la intranet, asi que solo puede dar distinto por los
 * DATOS: una copia atrasada o una celda que se convirtio mal. Esto vigila eso:
 *   1. lee las hojas de nuevo, directo de Google, y arma Pagos con eso ("fresco");
 *   2. arma Pagos con la copia que usa la pantalla ("copia");
 *   3. compara los totales del recuadro de arriba y el cuadre por proveedor, y cuenta las celdas
 *      con error (#REF!, #N/A...) del maestro.
 * Guarda la foto en pagos_fotos. Si algo no coincide, la tarea responde 409 y el reloj lo marca
 * como fallido (y llega el correo de alerta).
 */
const C = require('./copia-hojas');
const { crearMotor, formatDate } = require('./motor-pagos');
const IMP = require('./importar-pagos');

const DUENO = { email: 'comparacion@servidor', rol: 'dueno', modulos: ['pagos'], nombre: 'Comparación automática' };
const CAMPOS_CUADRE = ['n', 'facturado', 'pagado', 'pendiente', 'abonadas', 'de_mas', 'favor', 'por_confirmar'];

/** Los numeros del recuadro de arriba, calculados igual que ProfitPagosJs.html. */
function resumen(pantalla, hoyIso) {
  const abiertas = pantalla.facturas.filter((f) => f.saldo > 0.01 || f.estado === 'Banco por confirmar');
  const q = abiertas.reduce((a, f) => a + f.saldo, 0);
  return {
    por_pagar_n: abiertas.length,
    por_pagar_q: Math.round(q * 100) / 100,
    vence_hoy: abiertas.filter((f) => f.fecha_pagar && f.fecha_pagar <= hoyIso).length,
    cuadre: pantalla.cuadre.map((x) => {
      const o = { nit: x.nit, proveedor: x.proveedor };
      CAMPOS_CUADRE.forEach((k) => { o[k] = x[k]; });
      return o;
    })
  };
}

/** Lo que cambia entre dos resumenes (lista de textos; vacia si son iguales). */
function diferencias(a, b) {
  const out = [];
  ['por_pagar_n', 'por_pagar_q', 'vence_hoy'].forEach((k) => {
    if (Math.abs((a[k] || 0) - (b[k] || 0)) > 0.005) out.push(k + ': copia ' + a[k] + ' · hojas ' + b[k]);
  });
  const porNit = (r) => { const m = {}; r.cuadre.forEach((x) => { m[x.nit] = x; }); return m; };
  const A = porNit(a), B = porNit(b);
  Object.keys(Object.assign({}, A, B)).sort().forEach((nit) => {
    const x = A[nit], y = B[nit];
    if (!x || !y) { out.push((x || y).proveedor + ' (' + nit + '): solo en ' + (x ? 'la copia' : 'las hojas')); return; }
    CAMPOS_CUADRE.forEach((k) => {
      if (Math.abs((x[k] || 0) - (y[k] || 0)) > 0.005) out.push(x.proveedor + ' (' + nit + ') ' + k + ': copia ' + x[k] + ' · hojas ' + y[k]);
    });
  });
  return out;
}

/** {pestana: cantidad} de celdas con error en los libros leidos. */
function celdasConError(libros) {
  const out = {};
  Object.keys(libros).forEach((id) => Object.keys(libros[id]).forEach((p) => {
    let n = 0;
    libros[id][p].forEach((r) => r.forEach((x) => { if (typeof x === 'string' && /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)$/.test(x)) n++; }));
    if (n) out[p] = n;
  }));
  return out;
}

/**
 * comparar({ pool, sheets, librosCopia, copiaLeida, ahora }) → la foto (y la guarda).
 * librosCopia: lo que usa la pantalla en este momento.
 */
async function comparar(o) {
  const hoy = formatDate(o.ahora || new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  const fresco = {};
  for (const k of Object.keys(C.LIBROS)) fresco[C.LIBROS[k].id] = await C.leerLibro(o.sheets, C.LIBROS[k].id, C.LIBROS[k].pestanas);
  const arma = (libros) => resumen(crearMotor({ libros, configId: C.LIBROS.config.id }).correr(DUENO, 'getPagosProveedores', []).resultado, hoy);
  const rCopia = arma(o.librosCopia);
  const rFresco = arma(fresco);
  const difs = diferencias(rCopia, rFresco);
  // La base (opcion a, 17-oct): las mismas filas que la hoja, y Pagos armado desde la base = desde la hoja
  const cfg = C.LIBROS.config.id, hojaPag = fresco[cfg].PAGOS_PROVEEDORES;
  const matrizBase = await IMP.matrizDesdeBase(o.pool, hojaPag[0] || []);
  const plan = IMP.planificar(hojaPag, matrizBase.slice(1).map((f, i) => ({ id: IMP.llave(f[(hojaPag[0] || []).indexOf('ID')]), celdas: C.codificar([f])[0], origen: 'hoja', orden: i })));
  plan.nuevas.forEach((x) => difs.push('Base: falta el pago ' + x.id + ' que esta en la hoja'));
  plan.actualizadas.forEach((x) => difs.push('Base: el pago ' + x.id + ' es distinto al de la hoja'));
  plan.problemas.forEach((x) => difs.push('Base: ' + x));
  const conBase = Object.assign({}, fresco, { [cfg]: Object.assign({}, fresco[cfg], { PAGOS_PROVEEDORES: matrizBase }) });
  diferencias(arma(conBase), rFresco).forEach((d) => difs.push('Pagos desde la base: ' + d.replace('copia ', 'base ')));
  const errores = celdasConError(fresco);
  const foto = {
    por_pagar_n: rFresco.por_pagar_n, por_pagar_q: rFresco.por_pagar_q, vence_hoy: rFresco.vence_hoy, cuadre: rFresco.cuadre,
    copia_leida: o.copiaLeida || null, copia_al_dia: difs.length === 0, diferencias: difs, celdas_error: errores
  };
  await o.pool.query(
    `INSERT INTO pagos_fotos (por_pagar_n, por_pagar_q, vence_hoy, cuadre, copia_leida, copia_al_dia, diferencias, celdas_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [foto.por_pagar_n, foto.por_pagar_q, foto.vence_hoy, JSON.stringify(foto.cuadre), foto.copia_leida, foto.copia_al_dia,
      JSON.stringify(foto.diferencias), JSON.stringify(foto.celdas_error)]);
  return foto;
}

module.exports = { comparar, resumen, diferencias, celdasConError };
