/**
 * Pagos, Caja chica, Compras en efectivo y los cierres del dia en el servidor nuevo: la copia de las
 * hojas + UN motor (el codigo real de la intranet) + que se puede llamar segun los interruptores.
 *
 * INTERRUPTORES (PARAMETROS de Config; el servidor solo los obedece si MODO_PAGOS=vivo):
 *   motor_pagos   = base → Pagos guarda en la base (pagos_proveedores) y copia a PAGOS_PROVEEDORES.
 *   motor_caja    = base → Caja chica y Compras guardan en la base (filas_vivas: CAJA_CHICA y
 *                          RETIROS_SOLICITUDES; sus pagos van a pagos_proveedores). SOLO si Pagos tambien
 *                          esta en base: Caja y Compras escriben en PAGOS_PROVEEDORES.
 *   motor_cierres = base → los cierres del dia llegan por POST /tareas/cierre (el lector de la intranet)
 *                          y se guardan en la base (filas_vivas: CIERRES_DIARIOS), con copia a la hoja.
 * Cualquier otra cosa es sombra: la hoja manda, se copia e importa a la base cada 15 min y aca solo
 * se MUESTRA. Volver atras = poner el interruptor en sheets.
 *
 * Pagos y Caja corren en UN motor porque Caja escribe en PAGOS_PROVEEDORES: los dos tienen que ver la
 * misma memoria. Lo que la intranet siga guardando en la hoja (Caja y Compras con motor_caja = sheets)
 * entra por la importacion de cada 15 min.
 *
 * Guardar: el motor escribe en memoria; las filas tocadas se guardan en la base en UNA transaccion, de
 * a un guardado por vez; si la base falla, se descarta lo de memoria. Despues se copian a la hoja
 * (mismas columnas; si falla, se reintenta en cada refresco). Toda correccion o anulacion de una fila
 * que ya existia queda en la bitacora. Corregir algo de un MES CERRADO (meses_cerrados) es solo del
 * dueño (acciones_solo_dueno › corregir_dia_cerrado); lo ajeno lo niega el codigo de la intranet (@212).
 */
const C = require('./copia-hojas');
const { crearMotor } = require('./motor-pagos');
const IMP = require('./importar-pagos');
const EH = require('./escribir-hoja');
const F2 = require('./sombra2/servicio-f2');
const PERM = require('./permisos');

// Pagos: lo que la pantalla llama.
const LECTURA = ['getPagosProveedores', 'getBalanceProveedores', 'getFacturasParaDevolver'];
const ESCRITURA = ['registrarPagoFacturas', 'programarPagoFactura', 'registrarSaldoFavor', 'registrarCompraMercado',
  'anularMovimientoPago', 'traerFacturaAnterior', 'confirmarPosiblePago', 'descartarPosiblePago',
  'marcarFacturaParaIva', 'devolverFacturaParaIva', 'registrarDevolucionEquipo', 'agregarFacturaDeSuBolsa', 'agregarCompraDeSuBolsa'];
// Caja chica y Compras (inventario de la Fase 2, seccion 1.3).
const LECTURA_CAJA = ['getCajaChica', 'getFacturasParaCaja', 'getComprasEfectivo'];
const ESCRITURA_CAJA = ['registrarConteoCaja', 'registrarMovimientoCaja', 'pagarFacturaDeCaja', 'anularMovimientoCaja',
  'registrarRetiroYCompras', 'asignarFacturaACompra', 'anularCompraEfectivo', 'anularSolicitudRetiro'];
// Siguen en la intranet aunque el interruptor diga base: tocan el maestro, Gmail, Drive o Claude.
const SOLO_INTRANET = ['marcarFacturaParaIva', 'devolverFacturaParaIva', 'leerCierresCaja', 'leerComprobanteCompra'];

const PAG = 'PAGOS_PROVEEDORES';
// Las pestañas de Caja en la base (filas_vivas, migracion 005) y su llave.
const VIVAS = {
  CAJA_CHICA: { llave: 'ID', columnas: 'CCH_COLS_', parte: 'caja' },
  RETIROS_SOLICITUDES: { llave: 'ID', columnas: 'CPE_SOL_COLS_', parte: 'retiros' },   // parte propia desde la 022 (cocina sin Caja chica)
  CIERRES_DIARIOS: { llave: 'FECHA', columnas: 'CIE_COLS_', parte: 'cierres', fecha: true }
};
// Lo que se copia de las hojas: lo de Pagos + las tres pestañas de Caja (las que existan).
const LIBROS_VIVO = { maestro: C.LIBROS.maestro, compras: C.LIBROS.compras,
  config: { id: C.LIBROS.config.id, pestanas: C.LIBROS.config.pestanas.concat(Object.keys(VIVAS)) } };

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

/** Un interruptor de PARAMETROS en la copia de Config: 'base' o 'sheets' (por defecto). */
function interruptor(libros, clave) {
  const p = libros && libros[C.LIBROS.config.id] && libros[C.LIBROS.config.id].PARAMETROS;
  const f = (p || []).find((r) => String(r[0] || '').trim().toLowerCase() === (clave || 'motor_pagos'));
  return f && String(f[1] || '').trim().toLowerCase() === 'base' ? 'base' : 'sheets';
}

/** Que modulos estan en vivo, segun lo que permite el servidor y los interruptores. */
function modos(modoMax, libros) {
  const vivoOk = modoMax === 'vivo';
  const pagos = vivoOk && interruptor(libros, 'motor_pagos') === 'base';
  return { pagos, caja: pagos && interruptor(libros, 'motor_caja') === 'base', cierres: vivoOk && interruptor(libros, 'motor_cierres') === 'base' };
}

/** Las celdas de una fila codificada que dicen ser fecha ({$d}) y no tienen la forma AAAA-MM-DDTHH:MM:SS. */
function fechasMalas(fila) {
  return (fila || []).filter((x) => x && typeof x === 'object' && !(typeof x.$d === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(x.$d)));
}

/** La fecha de un registro (para la bitacora y los meses cerrados). */
function fechaDe(H, fila) {
  for (const col of ['FECHA PAGADO', 'FECHA', 'FECHA DE PAGAR']) {
    const i = H.indexOf(col);
    if (i < 0) continue;
    const x = fila[i];
    const s = x instanceof Date ? C.codificar([[x]])[0][0].$d.slice(0, 10) : String(x || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

/** bitacora: accion y fecha del registro. */
function bitacoraDe(H, antes, despues) {
  const est = String(despues[H.indexOf('ESTATUS DE PAGO')] || despues[H.indexOf('ESTATUS')] || '');
  const obj = (fila) => { const o = {}; H.forEach((h, j) => { o[h] = fila[j] instanceof Date ? C.codificar([[fila[j]]])[0][0].$d : fila[j]; }); return o; };
  return { accion: /^ANULADO/i.test(est) ? 'borrar' : 'corregir', fecha: fechaDe(H, despues), antes: obj(antes), despues: obj(despues) };
}

function crearServicioPagos(pool, opciones) {
  const o = opciones || {};
  const modoMax = o.modo || 'sombra';                       // lo que permite el servidor (MODO_PAGOS)
  const sheetsEscritura = o.sheetsEscritura || null;        // () => cliente de Sheets con permiso de escribir
  let motor = null, leida = null, error_ = null, libros = null, enVivo = { pagos: false, caja: false, cierres: false };
  let matriz = null;                                         // la matriz de accesos (tabla permisos)
  let cola = Promise.resolve();                              // un guardado por vez
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };
  // La copia a la hoja va en SU propia fila de espera (ensayo de Caja, 18-oct): en la de los guardados,
  // cada guardado esperaba la copia del anterior (~0.7 s de la API de Sheets). Solo lee lo ya guardado y
  // marca copiado si no cambio despues, asi que puede correr al lado de un guardado sin pisarlo.
  let colaCopia = Promise.resolve();
  const enColaCopia = (fn) => { const p = colaCopia.then(fn, fn); colaCopia = p.catch(() => {}); return p; };
  const cfgId = C.LIBROS.config.id;

  async function cargar() {
    const copia = await C.cargarCopia(pool);
    if (!copia.libros[C.LIBROS.maestro.id]) { motor = null; error_ = 'Todavia no hay copia de las hojas.'; return; }
    const L = copia.libros;
    enVivo = modos(modoMax, L);
    const cfg = L[cfgId];
    // La base manda en lo que esta en vivo: esas pestañas se arman desde la base (encabezado de la hoja)
    if (enVivo.pagos) cfg[PAG] = await IMP.matrizDesdeBase(pool, (cfg[PAG] || [])[0] || []);
    const editables = [];
    if (enVivo.pagos) editables.push(PAG);
    const m = crearMotor({ libros: L, configId: cfgId, editables: { [cfgId]: editables }, listas: ['LISTA.txt', 'LISTA-CAJA.txt'] });
    F2.anularEscriturasAlLeer(m.ctx);   // Caja chica: no leer Gmail ni reescribir 07_Caja_Chica al abrir
    for (const p of Object.keys(VIVAS)) {
      const vivo = (VIVAS[p].parte === 'cierres') ? enVivo.cierres : enVivo.caja;
      const enc = (cfg[p] && cfg[p][0] && cfg[p][0].length) ? cfg[p][0] : (m.ctx[VIVAS[p].columnas] || []).slice();
      if (vivo) cfg[p] = await IMP.matrizDesdeFilas(pool, p, enc);
      else if (!cfg[p]) cfg[p] = [enc];   // la intranet la crea con el primer movimiento; aca existe vacia
      if (vivo && VIVAS[p].parte !== 'cierres') editables.push(p);   // caja y retiros los guarda el servidor; los cierres llegan por /tareas/cierre
    }
    motor = m;
    try { matriz = await PERM.cargarDeBase(pool); } catch (e) { matriz = null; }
    libros = L; leida = copia.leida; error_ = null;
  }

  /** Copia a la hoja lo guardado en el servidor que todavia no esta copiado (o cambio despues). */
  async function copiarPendientes() {
    if (!sheetsEscritura) return { nuevas: 0, actualizadas: 0, pendientes: 0 };
    const S = sheetsEscritura(), out = { pendientes: 0, nuevas: 0, actualizadas: 0 };
    const suma = (h) => { out.nuevas += h.nuevas; out.actualizadas += h.actualizadas; };
    // actualizado como TEXTO: la base guarda microsegundos y un Date de JS solo milisegundos (ensayo del 18-oct)
    const r = await pool.query(`SELECT id, celdas, actualizado::text AS actualizado FROM pagos_proveedores
      WHERE origen = 'servidor' AND (copiado_a_hoja IS NULL OR actualizado > copiado_a_hoja) ORDER BY orden NULLS LAST, registrado`);
    if (r.rows.length) {
      suma(await EH.copiarFilas(S, cfgId, r.rows.map((x) => ({ id: x.id, fila: C.decodificar([x.celdas])[0] }))));
      for (const x of r.rows) await pool.query('UPDATE pagos_proveedores SET copiado_a_hoja = now() WHERE id = $1 AND actualizado = $2::timestamptz', [x.id, x.actualizado]);
      out.pendientes += r.rows.length;
    }
    for (const p of Object.keys(VIVAS)) {
      const f = await pool.query(`SELECT llave, celdas, actualizado::text AS actualizado FROM filas_vivas
        WHERE pestana = $1 AND origen = 'servidor' AND (copiado_a_hoja IS NULL OR actualizado > copiado_a_hoja) ORDER BY orden NULLS LAST, actualizado`, [p]);
      if (!f.rows.length) continue;
      const enc = libros && libros[cfgId] && libros[cfgId][p] && libros[cfgId][p][0];
      suma(await EH.copiarFilas(S, cfgId, f.rows.map((x) => ({ id: x.llave, fila: C.decodificar([x.celdas])[0] })),
        { pestana: p, llave: VIVAS[p].llave, llaveEsFecha: !!VIVAS[p].fecha, encabezado: enc }));
      for (const x of f.rows) await pool.query('UPDATE filas_vivas SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado = $3::timestamptz', [p, x.llave, x.actualizado]);
      out.pendientes += f.rows.length;
    }
    return out;
  }

  /** Copia las hojas, importa a la base lo que tiene la hoja, copia lo pendiente y rearma el motor. */
  async function refrescar(sheets) {
    const L = await F2.soloExistentes(sheets, LIBROS_VIVO);
    const resumen = await C.refrescarCopia(sheets, pool, { libros: L });
    const copia = await C.cargarCopia(pool);
    const m = modos(modoMax, copia.libros), cfg = copia.libros[cfgId] || {};
    // quien manda se decide con los interruptores que acaban de llegar en la copia
    const importacion = cfg[PAG] ? await enCola(() => IMP.importar(pool, cfg[PAG], { hojaManda: !m.pagos })) : null;
    const importacion_caja = [];
    for (const p of Object.keys(VIVAS)) {
      if (!cfg[p]) continue;
      const manda = VIVAS[p].parte === 'cierres' ? !m.cierres : !m.caja;
      importacion_caja.push(await enCola(() => IMP.importarFilas(pool, p, cfg[p], { llave: VIVAS[p].llave, hojaManda: manda })));
    }
    let copia_hoja = null;
    if (modoMax === 'vivo') copia_hoja = await enColaCopia(() => copiarPendientes()).catch((e) => ({ error: String(e.message || e) }));
    await enCola(() => cargar());
    return { pestanas: resumen, importacion, importacion_caja, copia_hoja, modo: enVivo.pagos ? 'vivo' : 'sombra', en_vivo: enVivo,
      interruptor: interruptor(copia.libros, 'motor_pagos') };
  }

  /** Guarda en la base (una transaccion) las filas que el motor toco, pestaña por pestaña. */
  async function guardar(usuario, escrituras) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const meses = new Set((await c.query('SELECT mes FROM meses_cerrados')).rows.map((x) => x.mes));
      for (const k of Object.keys(escrituras)) {
        const p = k.slice(k.indexOf('|') + 1);
        const M = motor.ctx.SpreadsheetApp.openById(cfgId).getSheetByName(p).getDataRange().getValues();
        const H = M[0].map((h) => String(h || '').trim());
        const col = p === PAG ? 'ID' : VIVAS[p].llave, iK = H.indexOf(col);
        for (const n of escrituras[k]) {
          const fila = M[n - 1], id = IMP.llave(fila[iK]);
          if (!id) throw new Error('El motor escribio una fila sin ' + col + ' en ' + p + '.');
          const celdas = JSON.stringify(C.codificar([fila])[0]);
          const previo = p === PAG
            ? (await c.query('SELECT celdas FROM pagos_proveedores WHERE id = $1 FOR UPDATE', [id])).rows[0]
            : (await c.query('SELECT celdas FROM filas_vivas WHERE pestana = $1 AND llave = $2 FOR UPDATE', [p, id])).rows[0];
          // MES CERRADO (decision de Juanma, 19-oct): el equipo no puede tocar nada de un mes cerrado, ni corregir ni
          // agregar con esa fecha; el dueño si, y queda en la bitacora. Se mira la fecha de antes y la de despues.
          const fAntes = previo ? fechaDe(H, C.decodificar([previo.celdas])[0]) : null, fDespues = fechaDe(H, fila);
          const cerrado = [fAntes, fDespues].find((f) => f && meses.has(f.slice(0, 7)));
          if (cerrado) {
            const r = matriz ? PERM.puede(matriz, usuario, p === PAG ? 'pagos' : VIVAS[p].parte, 'corregir_dia_cerrado')
              : require('./usuarios').normalizarRol(usuario.rol) === 'dueno' ? { ok: true } : { ok: false, motivo: 'Eso solo lo hace el dueño.' };
            if (!r.ok) throw error('Eso es de ' + cerrado.slice(0, 7) + ', un mes ya cerrado: ' + r.motivo, 403);
          }
          if (p === PAG) {
            const t = IMP.tipadas(H, fila);
            if (!previo) {
              await c.query(`INSERT INTO pagos_proveedores (id, area, proveedor, dte, fecha_de_pagar, fecha_pagado, cantidad_pagada, estatus, nit, detalle,
                escrito_por, registrado, celdas, orden, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                (SELECT coalesce(max(orden), 0) + 1 FROM pagos_proveedores), 'servidor')`, [id].concat(t, [celdas]));
            } else {
              await c.query(`UPDATE pagos_proveedores SET area=$2, proveedor=$3, dte=$4, fecha_de_pagar=$5, fecha_pagado=$6, cantidad_pagada=$7,
                estatus=$8, nit=$9, detalle=$10, escrito_por=$11, registrado=$12, celdas=$13, origen='servidor', actualizado=now() WHERE id=$1`, [id].concat(t, [celdas]));
            }
          } else {
            if (!previo) {
              await c.query(`INSERT INTO filas_vivas (pestana, llave, celdas, orden, origen) VALUES ($1,$2,$3,
                (SELECT coalesce(max(orden), 0) + 1 FROM filas_vivas WHERE pestana = $1), 'servidor')`, [p, id, celdas]);
            } else {
              await c.query(`UPDATE filas_vivas SET celdas = $3, origen = 'servidor', actualizado = now() WHERE pestana = $1 AND llave = $2`, [p, id, celdas]);
            }
          }
          if (previo || cerrado) {   // un registro NUEVO en un mes cerrado (solo el dueño) tambien queda: "corregir" con antes vacio
            const b = previo ? bitacoraDe(H, C.decodificar([previo.celdas])[0], fila) : Object.assign(bitacoraDe(H, fila, fila), { antes: null });
            await c.query(`INSERT INTO bitacora (quien, rol, parte, tabla, registro_id, accion, antes, despues, fecha_registro, mes_cerrado)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [usuario.email, usuario.rol, p === PAG ? 'pagos' : VIVAS[p].parte, p === PAG ? 'pagos_proveedores' : 'filas_vivas:' + p, id, b.accion,
              JSON.stringify(b.antes), JSON.stringify(b.despues), b.fecha || cerrado || null, !!cerrado]);
          }
        }
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }

  /**
   * Corregir o anular algo de un MES CERRADO es solo del dueño (matriz: corregir_dia_cerrado). Busca el
   * registro por su ID en las pestañas que se pueden escribir; si su fecha cae en un mes cerrado, pregunta.
   */
  async function revisarMesCerrado(usuario, args) {
    const id = IMP.llave(args && args[0]);
    if (!id) return;
    const meses = new Set((await pool.query('SELECT mes FROM meses_cerrados')).rows.map((x) => x.mes));
    if (!meses.size) return;
    for (const p of [PAG].concat(Object.keys(VIVAS))) {
      const M = libros && libros[cfgId] && libros[cfgId][p];
      if (!M || !M.length) continue;
      const H = M[0].map((h) => String(h || '').trim()), iId = H.indexOf('ID');
      if (iId < 0) continue;
      const fila = M.find((f, i) => i > 0 && IMP.llave(f[iId]) === id);
      if (!fila) continue;
      const f = fechaDe(H, fila);
      if (f && meses.has(f.slice(0, 7))) {
        const r = matriz ? PERM.puede(matriz, usuario, p === PAG ? 'pagos' : VIVAS[p].parte, 'corregir_dia_cerrado') : { ok: false, motivo: 'Eso solo lo hace el dueño.' };
        if (!r.ok) throw error('Ese movimiento es de ' + f.slice(0, 7) + ', un mes ya cerrado: ' + r.motivo, 403);
      }
      return;
    }
  }

  /** Corre una funcion como `usuario`. Devuelve { resultado, ms }. */
  async function llamar(usuario, nombre, args) {
    const dePagos = ESCRITURA.indexOf(nombre) !== -1, deCaja = ESCRITURA_CAJA.indexOf(nombre) !== -1;
    const escribe = dePagos || deCaja;
    if (!escribe && LECTURA.indexOf(nombre) === -1 && LECTURA_CAJA.indexOf(nombre) === -1 && SOLO_INTRANET.indexOf(nombre) === -1) {
      throw error('Esa funcion no esta disponible en el servidor nuevo.', 404);
    }
    if (SOLO_INTRANET.indexOf(nombre) !== -1) {
      throw error(/Iva/.test(nombre) ? 'Las facturas para reducir IVA se marcan en la intranet (Pagos › Para IVA): tocan el maestro.'
        : 'Esto se hace en la intranet: lee el correo o la foto con Google.', 409);
    }
    if (dePagos && !enVivo.pagos) throw error('Prueba en sombra: esta pantalla solo muestra. El pago guardalo en la intranet de siempre.', 409);
    if (deCaja && !enVivo.caja) throw error('Prueba en sombra: esta pantalla solo muestra. Anotalo en la intranet de siempre.', 409);
    if (!motor) throw error(error_ || 'El servidor nuevo todavia esta cargando.', 503);
    if (!escribe) { const t0 = Date.now(); const r = motor.correr(usuario, nombre, args || []); return { resultado: r.resultado, ms: Date.now() - t0 }; }
    return enCola(async () => {
      const t0 = Date.now();
      if (/^anular/.test(nombre)) await revisarMesCerrado(usuario, args);
      let r;
      try { r = motor.correr(usuario, nombre, args || []); } catch (e) { await cargar(); throw error(String(e.message || e), 400); }
      const permitidas = new Set([cfgId + '|' + PAG].concat(enVivo.caja ? [cfgId + '|CAJA_CHICA', cfgId + '|RETIROS_SOLICITUDES'] : []));
      const otras = Object.keys(r.escrituras).filter((k) => !permitidas.has(k));
      if (otras.length) { await cargar(); throw error('El guardado quiso escribir fuera de lo permitido (' + otras.join(', ') + '). No se guardo nada.', 500); }
      try { await guardar(usuario, r.escrituras); } catch (e) { await cargar(); if (e.status) throw e; throw error('No se guardo: ' + String(e.message || e) + '. Proba de nuevo.', 503); }
      const ms = Date.now() - t0;
      // la copia a la hoja va despues de responder: lo guardado ya esta a salvo en la base
      setImmediate(() => { enColaCopia(() => copiarPendientes()).catch((e) => console.error('Copia a la hoja pendiente:', e.message)); });
      return { resultado: r.resultado, ms };
    });
  }

  /**
   * Un cierre del dia que manda el lector de la intranet (motor_cierres = base). fila: la fila de
   * CIERRES_DIARIOS codificada (las fechas como {$d}); la FECHA puede venir como texto AAAA-MM-DD.
   */
  async function guardarCierre(filaCodificada) {
    if (!enVivo.cierres) throw error('Los cierres van a la hoja (motor_cierres = sheets).', 409);
    // una fecha mal escrita se rechaza: antes entraba como fecha invalida y la copia a la hoja quedaba en conflicto (ensayo del puente, 18-oct)
    const malas = fechasMalas(filaCodificada);
    if (malas.length) throw error('El cierre trae una fecha que no se entiende: ' + JSON.stringify(malas[0]).slice(0, 80), 400);
    return enCola(async () => {
      const fila = C.decodificar([filaCodificada])[0];
      const enc = libros[cfgId].CIERRES_DIARIOS[0].map((h) => String(h || '').trim()), iF = enc.indexOf('FECHA');
      if (typeof fila[iF] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fila[iF])) {
        const [y, mm, d] = fila[iF].split('-').map(Number); fila[iF] = new Date(y, mm - 1, d);   // como la guarda Sheets
      }
      const id = IMP.llave(fila[iF]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) throw error('El cierre no trae una FECHA valida.', 400);
      const celdas = JSON.stringify(C.codificar([fila])[0]);
      const r = await pool.query(`INSERT INTO filas_vivas (pestana, llave, celdas, orden, origen) VALUES ('CIERRES_DIARIOS', $1, $2,
          (SELECT coalesce(max(orden), 0) + 1 FROM filas_vivas WHERE pestana = 'CIERRES_DIARIOS'), 'servidor')
        ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now()
        RETURNING (xmax = 0) AS nuevo`, [id, celdas]);
      await cargar();
      setImmediate(() => { enColaCopia(() => copiarPendientes()).catch((e) => console.error('Copia a la hoja pendiente:', e.message)); });
      return { fecha: id, nuevo: r.rows[0].nuevo };
    });
  }

  return { cargar, refrescar, llamar, guardarCierre, copiarPendientes: () => enColaCopia(() => copiarPendientes()), copia: () => ({ libros, leida }),
    estado: () => ({ modo: enVivo.pagos ? 'vivo' : 'sombra', en_vivo: enVivo, modo_max: modoMax, interruptor: interruptor(libros, 'motor_pagos'),
      copia_leida: leida, listo: !!motor, error: error_ }) };
}

module.exports = { crearServicioPagos, LECTURA, ESCRITURA, LECTURA_CAJA, ESCRITURA_CAJA, SOLO_INTRANET, VIVAS, LIBROS_VIVO,
  interruptor, modos, bitacoraDe, fechaDe, fechasMalas };
