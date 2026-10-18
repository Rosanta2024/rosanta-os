/**
 * Pagos en el servidor nuevo: la copia de las hojas + el motor + que se puede llamar en cada etapa.
 *
 * SOMBRA (hasta el 31-oct-2026): la hoja PAGOS_PROVEEDORES manda; se copia e importa a la base cada
 * 15 min y aca solo se MUESTRA. Toda funcion que escribe se rechaza.
 *
 * EN VIVO (18-oct-2026, construido y ensayado sobre una copia de Config): la BASE manda.
 *   - Se enciende solo si el servidor lo permite (MODO_PAGOS=vivo) Y la hoja Config dice
 *     PARAMETROS › motor_pagos = base. Cualquier otra combinacion es sombra (volver atras = poner
 *     motor_pagos = sheets en la hoja).
 *   - Guardar: el motor (codigo real de la intranet) escribe en su PAGOS_PROVEEDORES en memoria, armada
 *     desde la base; las filas tocadas se guardan en la base en UNA transaccion, de a un guardado por
 *     vez. Si la base falla, se descarta lo de memoria y se responde que no se guardo.
 *   - Despues se copian a la hoja (mismas columnas). Si la hoja falla, el pago NO se pierde: queda en
 *     la base marcado sin copiar y se reintenta en cada refresco.
 *   - Toda correccion o anulacion de una fila que ya existia queda en la bitacora (antes y despues).
 *   - Lo que Caja chica y Compras siguen guardando en la hoja desde la intranet entra por la
 *     importacion de cada 15 min (importar-pagos.js), igual que en sombra.
 */
const C = require('./copia-hojas');
const { crearMotor } = require('./motor-pagos');
const IMP = require('./importar-pagos');
const EH = require('./escribir-hoja');

// Lo que la pantalla de Pagos llama y solo lee.
const LECTURA = ['getPagosProveedores', 'getBalanceProveedores', 'getFacturasParaDevolver'];
// Lo que escribe (ProfitPagosJs.html, 17-oct-2026). En sombra se rechaza; en vivo se habilita.
const ESCRITURA = ['registrarPagoFacturas', 'programarPagoFactura', 'registrarSaldoFavor', 'registrarCompraMercado',
  'anularMovimientoPago', 'traerFacturaAnterior', 'confirmarPosiblePago', 'descartarPosiblePago',
  'marcarFacturaParaIva', 'devolverFacturaParaIva', 'registrarDevolucionEquipo', 'agregarFacturaDeSuBolsa', 'agregarCompraDeSuBolsa'];
// Escriben tambien en el MAESTRO (la Categoria de 01_FEL_Maestro): el servidor no escribe el maestro,
// asi que en vivo siguen en la intranet (Pagos › Para IVA). Lo que anotan en la hoja entra por la importacion.
const SOLO_INTRANET = ['marcarFacturaParaIva', 'devolverFacturaParaIva'];
const PAG = 'PAGOS_PROVEEDORES';

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

/** PARAMETROS › motor_pagos de la copia de Config: 'base' o 'sheets' (por defecto). */
function interruptor(libros) {
  const p = libros && libros[C.LIBROS.config.id] && libros[C.LIBROS.config.id].PARAMETROS;
  const f = (p || []).find((r) => String(r[0] || '').trim().toLowerCase() === 'motor_pagos');
  return f && String(f[1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets';
}

/** bitacora: accion y fecha del registro. */
function bitacoraDe(H, antes, despues) {
  const est = String(despues[H.indexOf('ESTATUS DE PAGO')] || '');
  const f = String(despues[H.indexOf('FECHA PAGADO')] || despues[H.indexOf('FECHA DE PAGAR')] || '').slice(0, 10);
  const obj = (fila) => { const o = {}; H.forEach((h, j) => { o[h] = fila[j] instanceof Date ? C.codificar([[fila[j]]])[0][0].$d : fila[j]; }); return o; };
  return { accion: /^ANULADO/i.test(est) ? 'borrar' : 'corregir', fecha: /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null, antes: obj(antes), despues: obj(despues) };
}

function crearServicioPagos(pool, opciones) {
  const o = opciones || {};
  const modoMax = o.modo || 'sombra';                       // lo que permite el servidor (MODO_PAGOS)
  const sheetsEscritura = o.sheetsEscritura || null;        // () => cliente de Sheets con permiso de escribir
  let motor = null, leida = null, error_ = null, libros = null, modo = 'sombra', interruptor_ = 'sheets';
  let cola = Promise.resolve();                              // un guardado por vez
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  async function cargar() {
    const copia = await C.cargarCopia(pool);
    if (!copia.libros[C.LIBROS.maestro.id]) { motor = null; error_ = 'Todavia no hay copia de las hojas.'; return; }
    interruptor_ = interruptor(copia.libros);
    modo = modoMax === 'vivo' && interruptor_ === 'base' ? 'vivo' : 'sombra';
    const L = copia.libros;
    if (modo === 'vivo') {
      // La base manda: PAGOS_PROVEEDORES se arma desde la base (encabezado de la hoja)
      const cfg = L[C.LIBROS.config.id];
      cfg[PAG] = await IMP.matrizDesdeBase(pool, (cfg[PAG] || [])[0] || []);
    }
    motor = crearMotor({ libros: L, configId: C.LIBROS.config.id, editables: modo === 'vivo' ? { [C.LIBROS.config.id]: [PAG] } : {} });
    libros = L; leida = copia.leida; error_ = null;
  }

  /** Copia a la hoja lo guardado en el servidor que todavia no esta copiado (o cambio despues). */
  async function copiarPendientes() {
    if (!sheetsEscritura) return { nuevas: 0, actualizadas: 0, pendientes: 0 };
    const r = await pool.query(`SELECT id, celdas, actualizado FROM pagos_proveedores
      WHERE origen = 'servidor' AND (copiado_a_hoja IS NULL OR actualizado > copiado_a_hoja) ORDER BY orden NULLS LAST, registrado`);
    if (!r.rows.length) return { nuevas: 0, actualizadas: 0, pendientes: 0 };
    const filas = r.rows.map((x) => ({ id: x.id, fila: C.decodificar([x.celdas])[0] }));
    const hecho = await EH.copiarFilas(sheetsEscritura(), C.LIBROS.config.id, filas);
    for (const x of r.rows) await pool.query('UPDATE pagos_proveedores SET copiado_a_hoja = now() WHERE id = $1 AND actualizado = $2', [x.id, x.actualizado]);
    return Object.assign({ pendientes: r.rows.length }, hecho);
  }

  /** Copia las hojas, importa a la base lo que tiene la hoja, copia lo pendiente y rearma el motor. */
  async function refrescar(sheets) {
    const resumen = await C.refrescarCopia(sheets, pool);
    const copia = await C.cargarCopia(pool);
    const hoja = copia.libros[C.LIBROS.config.id] && copia.libros[C.LIBROS.config.id][PAG];
    // quien manda se decide con el interruptor que acaba de llegar en la copia
    const mandaLaHoja = !(modoMax === 'vivo' && interruptor(copia.libros) === 'base');
    const importacion = hoja ? await enCola(() => IMP.importar(pool, hoja, { hojaManda: mandaLaHoja })) : null;
    let copia_hoja = null;
    if (modoMax === 'vivo') copia_hoja = await enCola(() => copiarPendientes()).catch((e) => ({ error: String(e.message || e) }));
    await enCola(() => cargar());
    return { pestanas: resumen, importacion, copia_hoja, modo, interruptor: interruptor_ };
  }

  /** Guarda en la base (una transaccion) las filas que el motor toco. */
  async function guardar(usuario, filasTocadas) {
    const cfg = C.LIBROS.config.id;
    const M = motor.ctx.SpreadsheetApp.openById(cfg).getSheetByName(PAG).getDataRange().getValues();
    const H = M[0].map((h) => String(h || '').trim()), iId = H.indexOf('ID');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const meses = new Set((await c.query('SELECT mes FROM meses_cerrados')).rows.map((x) => x.mes));
      for (const n of filasTocadas) {
        const fila = M[n - 1], id = IMP.llave(fila[iId]);
        if (!id) throw new Error('El motor escribio una fila sin ID.');
        const celdas = JSON.stringify(C.codificar([fila])[0]);
        const previo = (await c.query('SELECT celdas FROM pagos_proveedores WHERE id = $1 FOR UPDATE', [id])).rows[0];
        const t = IMP.tipadas(H, fila);
        if (!previo) {
          await c.query(`INSERT INTO pagos_proveedores (id, area, proveedor, dte, fecha_de_pagar, fecha_pagado, cantidad_pagada, estatus, nit, detalle,
            escrito_por, registrado, celdas, orden, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            (SELECT coalesce(max(orden), 0) + 1 FROM pagos_proveedores), 'servidor')`, [id].concat(t, [celdas]));
        } else {
          await c.query(`UPDATE pagos_proveedores SET area=$2, proveedor=$3, dte=$4, fecha_de_pagar=$5, fecha_pagado=$6, cantidad_pagada=$7,
            estatus=$8, nit=$9, detalle=$10, escrito_por=$11, registrado=$12, celdas=$13, origen='servidor', actualizado=now() WHERE id=$1`, [id].concat(t, [celdas]));
          const b = bitacoraDe(H, C.decodificar([previo.celdas])[0], fila);
          await c.query(`INSERT INTO bitacora (quien, rol, parte, tabla, registro_id, accion, antes, despues, fecha_registro, mes_cerrado)
            VALUES ($1,$2,'pagos','pagos_proveedores',$3,$4,$5,$6,$7,$8)`,
          [usuario.email, usuario.rol, id, b.accion, JSON.stringify(b.antes), JSON.stringify(b.despues), b.fecha, !!b.fecha && meses.has(b.fecha.slice(0, 7))]);
        }
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }

  /** Corre una funcion de Pagos como `usuario`. Devuelve { resultado, ms, copia }. */
  async function llamar(usuario, nombre, args) {
    const escribe = ESCRITURA.indexOf(nombre) !== -1;
    if (!escribe && LECTURA.indexOf(nombre) === -1) throw error('Esa funcion no esta disponible en el servidor nuevo.', 404);
    if (escribe && modo !== 'vivo') throw error('Prueba en sombra: esta pantalla solo muestra. El pago guardalo en la intranet de siempre.', 409);
    if (escribe && SOLO_INTRANET.indexOf(nombre) !== -1) throw error('Las facturas para reducir IVA se marcan en la intranet (Pagos › Para IVA): tocan el maestro.', 409);
    if (!motor) throw error(error_ || 'El servidor nuevo todavia esta cargando.', 503);
    if (!escribe) { const t0 = Date.now(); const r = motor.correr(usuario, nombre, args || []); return { resultado: r.resultado, ms: Date.now() - t0 }; }
    return enCola(async () => {
      const t0 = Date.now();
      let r;
      try { r = motor.correr(usuario, nombre, args || []); } catch (e) { await cargar(); throw error(String(e.message || e), 400); }
      const tocadas = r.escrituras[C.LIBROS.config.id + '|' + PAG] || [];
      const otras = Object.keys(r.escrituras).filter((k) => k !== C.LIBROS.config.id + '|' + PAG);
      if (otras.length) { await cargar(); throw error('El guardado quiso escribir fuera de Pagos (' + otras.join(', ') + '). No se guardo nada.', 500); }
      try { await guardar(usuario, tocadas); } catch (e) { await cargar(); throw error('No se guardo: ' + String(e.message || e) + '. Proba de nuevo.', 503); }
      const ms = Date.now() - t0;
      // la copia a la hoja va despues de responder: el pago ya esta a salvo en la base
      setImmediate(() => { enCola(() => copiarPendientes()).catch((e) => console.error('Copia a la hoja pendiente:', e.message)); });
      return { resultado: r.resultado, ms };
    });
  }

  return { cargar, refrescar, llamar, copiarPendientes: () => enCola(() => copiarPendientes()), copia: () => ({ libros, leida }),
    estado: () => ({ modo, modo_max: modoMax, interruptor: interruptor_, copia_leida: leida, listo: !!motor, error: error_ }) };
}

module.exports = { crearServicioPagos, LECTURA, ESCRITURA, SOLO_INTRANET, interruptor, bitacoraDe };
