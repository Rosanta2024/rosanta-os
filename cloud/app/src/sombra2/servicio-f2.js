/**
 * Servidor en sombra de la Fase 2 (Caja chica y Compras en efectivo) y de Clientes › Eventos
 * (17-oct-2026, rama claude/nube-fase2-mkt). Servicio de Cloud Run APARTE: rosanta-nube-sombra2.
 *
 * Mismo patron que Pagos (servicio-pagos.js), sin tocar sus archivos ni sus tablas:
 *   - corre el CODIGO REAL de la intranet (cloud/app/intranet/, listas LISTA-CAJA.txt y
 *     LISTA-EVENTOS.txt) con crearMotor({ listas });
 *   - lee de su propia copia de las hojas, la tabla hojas_copia_f2 (migracion 010);
 *   - solo MUESTRA: toda funcion que escribe responde 409.
 *
 * Lo unico que se cambia del codigo de la intranet son dos funciones de Caja chica que, al LEER,
 * escriben: _cchLeerSiFaltan_ (lee Gmail si falta un cierre) y cchSincronizarMaestro_ (reescribe
 * 07_Caja_Chica del maestro). En la sombra no hacen nada; los cierres los sigue leyendo la intranet.
 */
const C = require('../copia-hojas');
const { crearMotor } = require('../motor-pagos');

const TABLA = 'hojas_copia_f2';
const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';   // Rosanta Marketing OS

// Lo que lee Caja chica / Compras: lo de Pagos + sus tres pestañas de Config.
const LIBROS_CAJA = {
  maestro: C.LIBROS.maestro,
  config: { id: C.LIBROS.config.id, pestanas: C.LIBROS.config.pestanas.concat(['CAJA_CHICA', 'RETIROS_SOLICITUDES', 'CIERRES_DIARIOS']) },
  compras: C.LIBROS.compras
};
// Lo que lee Eventos: el pipeline de Marketing OS (hoy la hoja manda).
const LIBROS_EVENTOS = { marketing: { id: MKT_ID, pestanas: ['cotizaciones', 'revisiones'] } };

const MODULOS = {
  caja: {
    listas: ['LISTA.txt', 'LISTA-CAJA.txt'],
    lectura: ['getCajaChica', 'getFacturasParaCaja', 'getComprasEfectivo'],
    escritura: ['registrarConteoCaja', 'registrarMovimientoCaja', 'pagarFacturaDeCaja', 'anularMovimientoCaja', 'leerCierresCaja',
      'registrarRetiroYCompras', 'asignarFacturaACompra', 'anularCompraEfectivo', 'anularSolicitudRetiro', 'leerComprobanteCompra'],
    libros: LIBROS_CAJA,
    aviso: 'Prueba en sombra: esta pantalla solo muestra. Anotalo en la intranet de siempre.'
  },
  eventos: {
    listas: ['LISTA-EVENTOS.txt'],
    lectura: ['getEventos', 'getInformeEventos'],
    escritura: ['guardarEventos'],
    libros: LIBROS_EVENTOS,
    aviso: 'Prueba en sombra: esta pantalla solo muestra. Los cambios del pipeline se hacen en la intranet de siempre.'
  }
};

/** Las dos funciones de Caja chica que escriben al leer: en la sombra no hacen nada. */
function anularEscriturasAlLeer(ctx) {
  ctx._cchLeerSiFaltan_ = () => null;
  ctx.cchSincronizarMaestro_ = (E) => ({ filas: ctx.cchFilasMaestro_(E).length, escrito: false });
}

/** Un motor por modulo, sobre los libros de la copia. */
function crearMotores(libros) {
  const caja = crearMotor({ libros, configId: C.LIBROS.config.id, editables: {}, listas: MODULOS.caja.listas });
  anularEscriturasAlLeer(caja.ctx);
  const eventos = crearMotor({ libros, configId: C.LIBROS.config.id, editables: {}, listas: MODULOS.eventos.listas });
  return { caja, eventos };
}

/**
 * Deja en cada libro solo las pestañas que existen hoy. La intranet crea algunas recien con el
 * primer movimiento (RETIROS_SOLICITUDES, CAJA_CHICA...) y, mientras no existen, las trata como
 * vacias; la API de Sheets en cambio rechaza todo el pedido si una no existe.
 */
async function soloExistentes(sheets, libros) {
  const out = {};
  for (const k of Object.keys(libros)) {
    const L = libros[k];
    if (L.pestanas === '*') { out[k] = L; continue; }
    const m = await sheets.spreadsheets.get({ spreadsheetId: L.id, fields: 'sheets.properties.title' });
    const hay = new Set(m.data.sheets.map((x) => x.properties.title));
    out[k] = { id: L.id, pestanas: L.pestanas.filter((n) => hay.has(n)) };
  }
  return out;
}

function moduloDe(nombre) {
  return Object.keys(MODULOS).find((m) => MODULOS[m].lectura.includes(nombre) || MODULOS[m].escritura.includes(nombre)) || null;
}

function crearServicioF2(pool) {
  let motores = null, libros = null, leida = null, error = null;

  async function cargar() {
    const copia = await C.cargarCopia(pool, { tabla: TABLA });
    if (!copia.libros[C.LIBROS.maestro.id]) { motores = null; error = 'Todavia no hay copia de las hojas.'; return; }
    libros = copia.libros; leida = copia.leida;
    motores = crearMotores(libros); error = null;
  }

  /**
   * Copia las hojas: primero las de Caja y despues las de Eventos, por separado, para que si
   * Marketing OS no se puede leer (no compartida) la copia de Caja quede igual. Si una falla, tira
   * al final (el reloj lo marca y llega el correo de alerta).
   */
  async function refrescar(sheets) {
    const resumen = [];
    resumen.push(...await C.refrescarCopia(sheets, pool, { libros: await soloExistentes(sheets, LIBROS_CAJA), tabla: TABLA }));
    let errEventos = null;
    try { resumen.push(...await C.refrescarCopia(sheets, pool, { libros: await soloExistentes(sheets, LIBROS_EVENTOS), tabla: TABLA })); } catch (e) { errEventos = e; }
    await cargar();
    if (errEventos) { const e = new Error('Caja copiada; Eventos no: ' + (errEventos.message || errEventos)); e.resumen = resumen; throw e; }
    return resumen;
  }

  /** Corre una funcion como `usuario`. Devuelve { resultado, ms, modulo }. */
  function llamar(usuario, nombre, args) {
    const m = moduloDe(nombre);
    if (!m) { const e = new Error('Esa funcion no esta disponible en el servidor nuevo.'); e.status = 404; throw e; }
    if (MODULOS[m].escritura.includes(nombre)) { const e = new Error(MODULOS[m].aviso); e.status = 409; throw e; }
    if (!motores) { const e = new Error(error || 'El servidor nuevo todavia esta cargando.'); e.status = 503; throw e; }
    const t0 = Date.now();
    const r = motores[m].correr(usuario, nombre, args || []);
    return { resultado: r.resultado, ms: Date.now() - t0, modulo: m };
  }

  return {
    cargar, refrescar, llamar,
    copia: () => ({ libros, leida }),
    estado: () => ({ modo: 'sombra', copia_leida: leida, listo: !!motores, error,
      eventos: !!(libros && libros[MKT_ID]) })
  };
}

module.exports = { crearServicioF2, soloExistentes, crearMotores, anularEscriturasAlLeer, moduloDe, MODULOS, LIBROS_CAJA, LIBROS_EVENTOS, TABLA, MKT_ID };
