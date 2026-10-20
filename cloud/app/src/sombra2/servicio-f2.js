/**
 * Servidor en sombra 2 (rosanta-nube-sombra2, rama claude/nube-fase2-mkt): Caja chica y Compras en
 * efectivo (Fase 2, 17-oct-2026) y la seccion CLIENTES parte 1 (18-oct-2026): pipeline de eventos,
 * CRM y ficha de cliente, reservas y carritos.
 *
 * Mismo patron que Pagos (servicio-pagos.js), sin tocar sus archivos ni sus tablas:
 *   - corre el CODIGO REAL de la intranet (cloud/app/intranet/, listas LISTA-CAJA.txt y
 *     LISTA-CLIENTES.txt) con crearMotor({ listas });
 *   - lee de su propia copia de las hojas (tabla hojas_copia_f2, migracion 010);
 *   - solo MUESTRA: toda funcion que escribe responde 409.
 *
 * Lo que se cambia del codigo de la intranet, y nada mas:
 *   - Caja chica: _cchLeerSiFaltan_ (lee Gmail) y cchSincronizarMaestro_ (reescribe 07_Caja_Chica)
 *     no hacen nada, porque escriben al LEER.
 *   - Clientes: quien ve que lo decide la MATRIZ DE ACCESOS de la base (tabla permisos, migracion
 *     020; decision de Juanma), no los modulos de la hoja USUARIOS. Por eso las guardas de la
 *     intranet (requiereCrm_, requiereEventos_, requiereMarketing_) se reemplazan por "ya lo
 *     autorizo el servidor", y el servidor pregunta a la matriz antes de cada llamada.
 *   - leadsSheetId_ busca Rosanta Leads en Drive; aca se le da el id directo.
 * Y dos funciones NUEVAS de solo lectura que la intranet no tiene como pantalla:
 *   clientesReservas (usa crmReservasFilas_ real) y clientesCarritos (usa mktRead real).
 *
 * MARKETING (contenido y pauta, 19-oct-2026): Marketing.html real, con PautaSistema.js. Su pantalla
 * manda el token como ULTIMO argumento (srv(fn, ...args, AUTH)), por eso corre con correrUltimo.
 * Lo que sale a Meta, Claude o Drive, y la lectura del pilar (que es el tablero de Finanzas, fase 3),
 * sigue SOLO en la intranet: aca responde 409.
 */
const C = require('../copia-hojas');
const { crearMotor } = require('../motor-pagos');
const P = require('../permisos');

const TABLA = 'hojas_copia_f2';
const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';    // Rosanta Marketing OS
const CRM_ID = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';    // Rosanta_CRM_Maestra
const LEADS_ID = '1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc';  // Rosanta Leads

// Lo que lee Caja chica / Compras: lo de Pagos + sus tres pestañas de Config. Obligatorio.
const LIBROS_CAJA = {
  maestro: C.LIBROS.maestro,
  config: { id: C.LIBROS.config.id, pestanas: C.LIBROS.config.pestanas.concat(['CAJA_CHICA', 'RETIROS_SOLICITUDES', 'CIERRES_DIARIOS', 'PARAMETROS', 'METAS']) },
  compras: C.LIBROS.compras
};
// Lo que lee Clientes. Cada libro se copia por separado: si uno todavia no esta compartido con el
// servidor, los demas siguen (ver refrescar).
const LIBROS_CLIENTES = {
  marketing: { id: MKT_ID, pestanas: ['cotizaciones', 'revisiones', 'reservas', 'carritos',
    // Marketing (contenido y pauta). NO 'config': tiene el token de Meta.
    'calendario', 'calendario_versiones', 'piezas', 'pauta_semanal', 'aprendizajes', 'propuestas', 'briefs',
    'hechos_semana', 'pixel_semana', 'estados_semana', 'reglas', 'supuestos', 'bitacora_pruebas'] },
  crm: { id: CRM_ID, pestanas: '*' },          // crmContactos busca la pestaña por encabezado
  leads: { id: LEADS_ID, pestanas: ['Conversaciones', 'Fichas', 'Leads'] }
};
// Compatibilidad con la primera version (Eventos solo).
// Hojas de las partes que suma src/clientes2/partes.js (reseñas y encuesta, 19-oct-2026).
try { Object.assign(LIBROS_CLIENTES, require('../clientes2/partes').LIBROS || {}); } catch (e) { /* sin clientes2 */ }
const LIBROS_EVENTOS = { marketing: LIBROS_CLIENTES.marketing };

const MODULOS = {
  caja: {
    listas: ['LISTA.txt', 'LISTA-CAJA.txt'],
    lectura: ['getCajaChica', 'getFacturasParaCaja', 'getComprasEfectivo'],
    escritura: ['registrarConteoCaja', 'registrarMovimientoCaja', 'pagarFacturaDeCaja', 'anularMovimientoCaja', 'leerCierresCaja',
      'registrarRetiroYCompras', 'asignarFacturaACompra', 'anularCompraEfectivo', 'anularSolicitudRetiro', 'leerComprobanteCompra'],
    aviso: 'Prueba en sombra: esta pantalla solo muestra. Anotalo en la intranet de siempre.'
  },
  clientes: {
    listas: ['LISTA-CLIENTES.txt'],
    lectura: ['getEventos', 'getInformeEventos', 'crmContactos', 'crmClavesConChat', 'crmFicha', 'clientesReservas', 'clientesCarritos'],
    escritura: ['guardarEventos', 'crmImportarContactos'],
    aviso: 'Prueba en sombra: esta pantalla solo muestra. Los cambios se hacen en la intranet de siempre.'
  },
  marketing: {
    listas: ['LISTA.txt', 'LISTA-CLIENTES.txt', 'LISTA-MARKETING.txt'],
    tokenAlFinal: true,
    lectura: ['mktRead', 'psTablero', 'psContextoCreativo'],
    escritura: ['mktUpsert', 'mktDelete', 'calGuardarVersion', 'psCapturarManual', 'psGuardarPrueba', 'psGuardarSupuesto', 'psGuardarRegla',
      // lo que sale a Meta, Claude o Drive, y la lectura del pilar: todavia solo en la intranet
      'metaEntities', 'adLibrarySearch', 'askClaudeSrv', 'driveBuscarReportes', 'driveDescargar', 'getLecturaPauta'],
    aviso: 'Prueba en sombra: esta pantalla solo muestra. Guardar, Meta, Claude y Drive se siguen usando en la intranet de siempre.'
  }
};

// Que parte de la matriz de accesos (tabla permisos, seccion clientes) pide cada funcion.
const PARTE = {
  getEventos: 'eventos', getInformeEventos: 'eventos', guardarEventos: 'eventos',
  crmContactos: 'crm', crmClavesConChat: 'crm', crmFicha: 'crm', crmImportarContactos: 'crm',
  clientesReservas: 'reservas', clientesCarritos: 'carritos'
};
MODULOS.marketing.lectura.concat(MODULOS.marketing.escritura).forEach((n) => { PARTE[n] = 'pauta'; });   // matriz: seccion marketing
// Partes que suma la sesion del bot (consola, reseñas, encuesta) en su propio archivo, si existe:
// src/clientes2/partes.js exporta { PARTES: ['consola', ...] }. Asi no hace falta editar este archivo.
const PARTES_EXTRA = (() => { try { return require('../clientes2/partes').PARTES || []; } catch (e) { return []; } })();
const PARTES_CLIENTES = ['eventos', 'crm', 'reservas', 'carritos'].concat(PARTES_EXTRA);

/** Las dos funciones de Caja chica que escriben al leer: en la sombra no hacen nada. */
function anularEscriturasAlLeer(ctx) {
  ctx._cchLeerSiFaltan_ = () => null;
  ctx.cchSincronizarMaestro_ = (E) => ({ filas: ctx.cchFilasMaestro_(E).length, escrito: false });
}

/** Clientes: la matriz manda (ya la consulto el servidor), las guardas de la intranet solo identifican. */
function prepararClientes(ctx) {
  const yaAutorizado = (a, b) => {
    const u = ctx.resolverUsuario_(typeof a === 'string' && b !== undefined ? b : a);
    if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
    return u;
  };
  ctx.requiereCrm_ = yaAutorizado;
  ctx.requiereEventos_ = yaAutorizado;
  ctx.requiereMarketing_ = (tab, auth) => yaAutorizado(auth);
  ctx.requiereSoloMarketing_ = (auth) => yaAutorizado(auth);
  ctx.requiereEdicionMarketing_ = (tab, auth) => yaAutorizado(auth);
  ctx.leadsSheetId_ = () => LEADS_ID;
  // Reservas: las filas tal como las lee el CRM real (crmReservasFilas_), mas nuevas primero.
  ctx.clientesReservas = (auth) => {
    yaAutorizado(auth);
    return ctx.crmReservasFilas_().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  };
  // Carritos: la pestaña como la lee Marketing (mktRead real).
  ctx.clientesCarritos = (auth) => ctx.mktRead('carritos', auth)
    .sort((a, b) => (String(a.fecha) < String(b.fecha) ? 1 : String(a.fecha) > String(b.fecha) ? -1 : 0));
}

/** Un motor por modulo, sobre los libros de la copia. */
function crearMotores(libros) {
  const caja = crearMotor({ libros, configId: C.LIBROS.config.id, editables: {}, listas: MODULOS.caja.listas });
  anularEscriturasAlLeer(caja.ctx);
  const clientes = crearMotor({ libros, configId: C.LIBROS.config.id, editables: {}, listas: MODULOS.clientes.listas });
  prepararClientes(clientes.ctx);
  const marketing = crearMotor({ libros, configId: C.LIBROS.config.id, editables: {}, listas: MODULOS.marketing.listas });
  prepararClientes(marketing.ctx);
  return { caja, clientes, marketing };
}

/**
 * Como motor.correr, pero con el token al FINAL (las funciones de Marketing son f(...args, auth)).
 * El motor no tiene hojas editables aca, asi que cualquier escritura tira "solo lectura".
 */
function correrUltimo(motor, usuario, nombre, args) {
  const ctx = motor.ctx;
  if (typeof ctx[nombre] !== 'function') throw new Error('La intranet no tiene la funcion ' + nombre + '.');
  const u = usuario && { email: usuario.email, rol: usuario.rol, modulos: usuario.modulos || [], puedeEditar: !!usuario.puede_editar, nombre: usuario.nombre };
  ctx.resolverUsuario_ = () => u || null;
  ctx._PAG_LEIDO_ = { movs: null, hojas: {}, ss: null, escribio: false };
  try {
    const r = ctx[nombre].apply(null, (args || []).concat(['(token-verificado-por-el-servidor)']));
    return { resultado: JSON.parse(JSON.stringify(r === undefined ? null : r)), escrituras: {} };
  } finally { ctx.resolverUsuario_ = () => null; }
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

/** Las partes de Clientes que el usuario puede VER segun la matriz. */
function partesVisibles(M, usuario) {
  return PARTES_CLIENTES.filter((p) => P.puede(M, usuario, p, 'ver').ok);
}

/**
 * opciones.permisos: la matriz ya armada (pruebas). Sin eso, se lee de la base al cargar.
 */
function crearServicioF2(pool, opciones) {
  const o = opciones || {};
  let motores = null, libros = null, leida = null, error = null, M = o.permisos || null;

  async function cargar() {
    if (!o.permisos) M = await P.cargarDeBase(pool);
    const copia = await C.cargarCopia(pool, { tabla: TABLA });
    if (!copia.libros[C.LIBROS.maestro.id]) { motores = null; error = 'Todavia no hay copia de las hojas.'; return; }
    libros = copia.libros; leida = copia.leida;
    motores = crearMotores(libros); error = null;
  }

  /**
   * Copia las hojas: primero las de Caja (obligatorias) y despues cada libro de Clientes por
   * separado. Un libro que NUNCA se pudo leer (todavia no compartido con el servidor) es aviso y
   * no dispara la alerta; uno que ya se habia leido y deja de leerse, si es falla.
   */
  async function refrescar(sheets) {
    const resumen = [];
    resumen.push(...await C.refrescarCopia(sheets, pool, { libros: await soloExistentes(sheets, LIBROS_CAJA), tabla: TABLA }));
    const fallas = [], avisos = [];
    for (const k of Object.keys(LIBROS_CLIENTES)) {
      const L = { [k]: LIBROS_CLIENTES[k] };
      try { resumen.push(...await C.refrescarCopia(sheets, pool, { libros: await soloExistentes(sheets, L), tabla: TABLA })); } catch (e) {
        const msg = k + ': ' + (e.message || e);
        if (libros && libros[LIBROS_CLIENTES[k].id]) fallas.push(msg); else avisos.push(msg);
      }
    }
    await cargar();
    if (avisos.length) resumen.aviso = 'Caja copiada; sin leer todavia (no compartido): ' + avisos.join(' · ');
    if (fallas.length) { const e = new Error('Caja copiada; dejaron de leerse: ' + fallas.join(' · ')); e.resumen = resumen; throw e; }
    return resumen;
  }

  /** Corre una funcion como `usuario`. Devuelve { resultado, ms, modulo }. */
  function llamar(usuario, nombre, args) {
    const m = moduloDe(nombre);
    if (!m) { const e = new Error('Esa funcion no esta disponible en el servidor nuevo.'); e.status = 404; throw e; }
    if (PARTE[nombre]) {
      if (!M) { const e = new Error('El servidor nuevo todavia esta cargando los permisos.'); e.status = 503; throw e; }
      const v = P.puede(M, usuario, PARTE[nombre], 'ver');
      if (!v.ok) { const e = new Error(v.motivo); e.status = 403; throw e; }
    }
    if (MODULOS[m].escritura.includes(nombre)) { const e = new Error(MODULOS[m].aviso); e.status = 409; throw e; }
    if (!motores) { const e = new Error(error || 'El servidor nuevo todavia esta cargando.'); e.status = 503; throw e; }
    const t0 = Date.now();
    const r = MODULOS[m].tokenAlFinal ? correrUltimo(motores[m], usuario, nombre, args) : motores[m].correr(usuario, nombre, args || []);
    return { resultado: r.resultado, ms: Date.now() - t0, modulo: m };
  }

  return {
    cargar, refrescar, llamar,
    partes: (usuario) => (M ? partesVisibles(M, usuario) : []),
    puede: (usuario, parte) => !!(M && P.puede(M, usuario, parte, 'ver').ok),
    consolaUrl: () => { try { return motores ? String(require('vm').runInContext('typeof CONFIG !== "undefined" ? CONFIG.CONSOLA_URL : ""', motores.clientes.ctx) || '') : ''; } catch (e) { return ''; } },
    copia: () => ({ libros, leida }),
    estado: () => ({ modo: 'sombra', copia_leida: leida, listo: !!motores, error, permisos: !!M,
      libros: Object.fromEntries(Object.keys(LIBROS_CLIENTES).map((k) => [k, !!(libros && libros[LIBROS_CLIENTES[k].id])])) })
  };
}

module.exports = { crearServicioF2, soloExistentes, crearMotores, correrUltimo, anularEscriturasAlLeer, prepararClientes, moduloDe, partesVisibles,
  MODULOS, PARTE, PARTES_CLIENTES, LIBROS_CAJA, LIBROS_CLIENTES, LIBROS_EVENTOS, TABLA, MKT_ID, CRM_ID, LEADS_ID };
