/**
 * Pagos en el servidor nuevo (Fase 1, 17-oct-2026): la copia de las hojas + el motor + que se
 * puede llamar en cada etapa.
 *
 * Etapa 'sombra' (semanas 1-2): la hoja PAGOS_PROVEEDORES sigue mandando y se copia cada 15 min;
 * aca solo se MUESTRA. Cualquier funcion que escribe se rechaza.
 * Etapa 'vivo' (semanas 3-4): todavia no esta construida; se enciende con su propia version.
 */
const C = require('./copia-hojas');
const { crearMotor } = require('./motor-pagos');

// Lo que la pantalla de Pagos llama y solo lee.
const LECTURA = ['getPagosProveedores', 'getBalanceProveedores', 'getFacturasParaDevolver'];
// Lo que escribe (ProfitPagosJs.html, 17-oct-2026). En sombra se rechaza; en vivo se habilita.
const ESCRITURA = ['registrarPagoFacturas', 'programarPagoFactura', 'registrarSaldoFavor', 'registrarCompraMercado',
  'anularMovimientoPago', 'traerFacturaAnterior', 'confirmarPosiblePago', 'descartarPosiblePago',
  'marcarFacturaParaIva', 'devolverFacturaParaIva', 'registrarDevolucionEquipo', 'agregarFacturaDeSuBolsa', 'agregarCompraDeSuBolsa'];

function crearServicioPagos(pool, opciones) {
  const o = opciones || {};
  const modo = o.modo || 'sombra';
  let motor = null, leida = null, error = null;

  async function cargar() {
    const copia = await C.cargarCopia(pool);
    if (!copia.libros[C.LIBROS.maestro.id]) { motor = null; error = 'Todavia no hay copia de las hojas.'; return; }
    motor = crearMotor({ libros: copia.libros, configId: C.LIBROS.config.id, editables: {} });
    leida = copia.leida; error = null;
  }

  async function refrescar(sheets) {
    const resumen = await C.refrescarCopia(sheets, pool);
    await cargar();
    return resumen;
  }

  /** Corre una funcion de Pagos como `usuario`. Devuelve { resultado, ms }. */
  function llamar(usuario, nombre, args) {
    if (ESCRITURA.indexOf(nombre) !== -1 && modo === 'sombra') {
      const e = new Error('Prueba en sombra: esta pantalla solo muestra. El pago guardalo en la intranet de siempre.');
      e.status = 409; throw e;
    }
    if (LECTURA.indexOf(nombre) === -1) { const e = new Error('Esa funcion no esta disponible en el servidor nuevo.'); e.status = 404; throw e; }
    if (!motor) { const e = new Error(error || 'El servidor nuevo todavia esta cargando.'); e.status = 503; throw e; }
    const t0 = Date.now();
    const r = motor.correr(usuario, nombre, args || []);
    return { resultado: r.resultado, ms: Date.now() - t0 };
  }

  return { cargar, refrescar, llamar, estado: () => ({ modo, copia_leida: leida, listo: !!motor, error }) };
}

module.exports = { crearServicioPagos, LECTURA, ESCRITURA };
