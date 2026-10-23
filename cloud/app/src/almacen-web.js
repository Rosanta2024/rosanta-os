/**
 * Almacen de la web (contenido, gift cards y pagos en linea), 20-oct-2026, AYUDANTE 4.
 *
 * Una sola forma de leer y escribir las tablas de las migraciones 053, 054, 055 y 056 (web_blog), con dos motores:
 *   - crearAlmacenPg(pool): la base de verdad (pg.Pool). SQL con parametros; los nombres de tabla y columna
 *     salen SOLO de TABLAS (abajo), nunca de lo que manda el navegador.
 *   - crearAlmacenMemoria(): lo mismo en memoria, para las pruebas. Repite las reglas que importan de la base
 *     (unicos, saldo nunca negativo, transaccion que se deshace entera, candado por fila).
 *
 * No hay borrar: ni aca ni en la base (la app no tiene DELETE). Retirar algo es activo = false.
 *
 * Operaciones (las dos versiones):
 *   insertar(tabla, fila) → fila completa          (error.code '23505' si choca con un unico)
 *   actualizar(tabla, llave, cambios) → { antes, despues }   (null si no existe)
 *   uno(tabla, filtro, { bloquear }) → fila o null  (bloquear = SELECT ... FOR UPDATE)
 *   lista(tabla, filtro, { orden, limite, desde, hasta, campoFecha }) → filas
 *   transaccion(async (tx) => ...) → lo que devuelva; si tira, no queda nada escrito
 */

// Columnas que la app escribe o lee, por tabla. La prueba "almacen = migraciones" compara esto con los
// CREATE TABLE de 053, 054, 055 y 056: si alguien cambia una sin la otra, falla.
// dias: columnas `date` (pg las devuelve como Date a medianoche local; aca vuelven a 'AAAA-MM-DD').
const TABLAS = {
  web_ajustes: { llave: 'clave', cols: ['clave', 'valor', 'actualizado', 'actualizado_por'], json: ['valor'] },
  web_fotos: { llave: 'id', cols: ['id', 'ruta', 'url', 'url_chica', 'ancho', 'alto', 'bytes', 'tipo', 'huella', 'alt_es', 'alt_en', 'activa', 'subida', 'subida_por'], unicos: [['ruta'], ['huella']] },
  web_paginas: { llave: 'clave', cols: ['clave', 'ruta_en', 'ruta_es', 'titulo_en', 'titulo_es', 'descripcion_en', 'descripcion_es', 'foto_id', 'orden', 'activa', 'actualizado', 'actualizado_por'] },
  web_bloques: { llave: 'id', cols: ['id', 'pagina', 'clave', 'tipo', 'texto_en', 'texto_es', 'enlace', 'foto_id', 'orden', 'activo', 'actualizado', 'actualizado_por'], unicos: [['pagina', 'clave']] },
  web_menu_secciones: { llave: 'id', cols: ['id', 'clave', 'nombre_en', 'nombre_es', 'nota_en', 'nota_es', 'orden', 'activa', 'actualizado', 'actualizado_por'], unicos: [['clave']] },
  web_menu_platos: { llave: 'id', cols: ['id', 'seccion_id', 'nombre_en', 'nombre_es', 'descripcion_en', 'descripcion_es', 'precio_q', 'alergenos', 'etiquetas', 'foto_id', 'receta_id', 'orden', 'activo', 'actualizado', 'actualizado_por'], num: ['precio_q'] },
  web_faq: { llave: 'id', cols: ['id', 'categoria', 'pregunta_en', 'pregunta_es', 'respuesta_en', 'respuesta_es', 'orden', 'activa', 'actualizado', 'actualizado_por'] },
  web_eventos: { llave: 'id', cols: ['id', 'slug', 'titulo_en', 'titulo_es', 'descripcion_en', 'descripcion_es', 'inicio', 'fin', 'precio_q', 'cupo', 'foto_id', 'enlace', 'orden', 'activo', 'actualizado', 'actualizado_por'], unicos: [['slug']], num: ['precio_q'] },
  web_versiones: { llave: 'id', cols: ['id', 'publicada', 'publicada_por', 'nota', 'formato', 'contenido', 'huella', 'restaurada_de', 'reconstruccion', 'reconstruccion_detalle'], json: ['contenido'], soloAgregar: ['reconstruccion', 'reconstruccion_detalle'] },
  web_bitacora: { llave: 'id', cols: ['id', 'cuando', 'quien', 'rol', 'accion', 'tabla', 'registro_id', 'antes', 'despues'], json: ['antes', 'despues'], soloAgregar: [] },
  web_blog: { llave: 'id', cols: ['id', 'slug', 'orden', 'fecha', 'titulo_en', 'titulo_es', 'resumen_en', 'resumen_es', 'cuerpo_en', 'cuerpo_es', 'foto_id', 'activa', 'actualizado', 'actualizado_por'],
    unicos: [['slug']], dias: ['fecha'] },

  pagos_liquidaciones: { llave: 'id', cols: ['id', 'proveedor', 'referencia', 'fecha', 'monto', 'moneda', 'banco', 'banco_referencia', 'estado', 'diferencia', 'conciliada', 'nota', 'creada'], unicos: [['proveedor', 'referencia']], num: ['monto', 'diferencia'] },
  pagos_en_linea: { llave: 'id', cols: ['id', 'proveedor', 'tipo', 'proveedor_id', 'cobro_id', 'pago_original_id', 'fecha', 'moneda', 'bruto', 'comision', 'otros_cargos', 'neto', 'tipo_cambio', 'bruto_q', 'concepto', 'concepto_id', 'estado', 'fel_serie', 'fel_numero', 'fel_fecha', 'fel_url', 'fel_estado', 'liquidacion_id', 'crudo', 'creado', 'actualizado'], unicos: [['proveedor', 'tipo', 'proveedor_id']], json: ['crudo'], num: ['bruto', 'comision', 'otros_cargos', 'neto', 'tipo_cambio', 'bruto_q'] },
  pagos_webhooks: { llave: 'id', cols: ['id', 'proveedor', 'evento_id', 'tipo', 'recibido', 'procesado', 'resultado', 'cuerpo'], unicos: [['proveedor', 'evento_id']], json: ['cuerpo'], soloAgregar: ['procesado', 'resultado'] },
  gift_cards_pedidos: { llave: 'id', cols: ['id', 'ref', 'proveedor', 'cobro_id', 'valor_q', 'moneda_cobro', 'monto_cobro', 'tipo_cambio', 'comprador_nombre', 'comprador_email', 'comprador_telefono', 'destinatario_nombre', 'destinatario_email', 'mensaje', 'enviar_el', 'idioma', 'origen_trafico', 'estado', 'nota', 'creado', 'actualizado'], unicos: [['ref'], ['proveedor', 'cobro_id']], json: ['origen_trafico'], num: ['valor_q', 'monto_cobro', 'tipo_cambio'] },
  gift_cards: { llave: 'id', cols: ['id', 'codigo', 'monto', 'moneda', 'saldo', 'estado', 'emitida', 'vence', 'comprador_nombre', 'comprador_email', 'comprador_telefono', 'destinatario_nombre', 'destinatario_email', 'mensaje', 'idioma', 'enviar_el', 'aviso_estado', 'aviso_enviado', 'aviso_detalle', 'origen', 'pedido_id', 'pago_id', 'creada_por'], unicos: [['codigo']], num: ['monto', 'saldo'] },
  gift_cards_movimientos: { llave: 'id', cols: ['id', 'gift_card_id', 'cuando', 'tipo', 'monto', 'saldo_antes', 'saldo_despues', 'quien', 'rol', 'donde', 'referencia', 'movimiento_ref', 'pago_id', 'nota'], num: ['monto', 'saldo_antes', 'saldo_despues'], soloAgregar: [] },

  operadores_aliados: { llave: 'id', cols: ['id', 'nombre', 'razon_social', 'contacto_nombre', 'contacto_telefono', 'contacto_email', 'contacto_emergencia', 'licencia_inguat', 'licencia_vence',
    'seguro_aseguradora', 'seguro_poliza', 'seguro_vence', 'comision_tipo', 'comision_valor', 'acuerdo', 'requisitos', 'codigo_referido', 'estado', 'aviso_vencimiento', 'nota', 'actualizado', 'actualizado_por'],
    unicos: [['codigo_referido']], json: ['requisitos'], num: ['comision_valor'] },
  web_experiencias: { llave: 'id', cols: ['id', 'slug', 'operador_id', 'titulo_en', 'titulo_es', 'descripcion_en', 'descripcion_es', 'duracion_en', 'duracion_es', 'incluye_en', 'incluye_es',
    'punto_salida_en', 'punto_salida_es', 'temporada_en', 'temporada_es', 'dificultad', 'idiomas', 'precio_ref_q', 'foto_id', 'galeria', 'faq', 'orden', 'activa', 'actualizado', 'actualizado_por'],
    unicos: [['slug']], json: ['faq'], num: ['precio_ref_q'] },
  leads_adventures: { llave: 'id', cols: ['id', 'creado', 'experiencia_id', 'operador_id', 'codigo_referido', 'nombre', 'email', 'telefono', 'idioma', 'fecha_deseada', 'personas', 'mensaje',
    'combinar_cena', 'cena_fecha', 'cena_hora', 'cena_personas', 'cena_reserva_id', 'cena_estado', 'pipeline_id', 'estado', 'venta_q', 'comision_q', 'comision_registrada', 'ganchos',
    'origen_trafico', 'nota', 'actualizado'], json: ['ganchos', 'origen_trafico'], num: ['venta_q', 'comision_q'] }
};

// Las reglas CHECK de la base que protegen dinero, repetidas para el almacen en memoria.
const r2 = (x) => Math.round(Number(x) * 100) / 100;
const CHEQUEOS = {
  gift_cards: (f) => {
    if (!(f.saldo >= 0)) return 'gift_cards_saldo_check';
    if (f.saldo > f.monto) return 'gift_cards_check';
    if (!/^RSNT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(f.codigo)) return 'gift_cards_codigo_check';
    return null;
  },
  gift_cards_movimientos: (f) => {
    if (!(f.monto >= 0 && f.saldo_antes >= 0 && f.saldo_despues >= 0)) return 'gift_cards_movimientos_monto_check';
    const suma = ['venta', 'reverso_canje'].indexOf(f.tipo) !== -1;
    if (r2(f.saldo_despues) !== r2(suma ? f.saldo_antes + f.monto : f.saldo_antes - f.monto)) return 'gift_cards_movimientos_check';
    return null;
  },
  gift_cards_pedidos: (f) => (f.valor_q >= 200 ? null : 'gift_cards_pedidos_valor_q_check'),
  web_menu_platos: (f) => (f.precio_q == null || f.precio_q >= 0 ? null : 'web_menu_platos_precio_q_check'),
  operadores_aliados: (f) => (/^[A-Z0-9-]{3,20}$/.test(f.codigo_referido) ? null : 'operadores_aliados_codigo_referido_check'),
  leads_adventures: (f) => (!f.combinar_cena || (f.cena_fecha && f.cena_hora) ? null : 'leads_adventures_check')
};

function errorBase(code, constraint) {
  const e = new Error(code === '23505' ? 'Ya existe (' + constraint + ').' : 'La base rechazo el dato (' + constraint + ').');
  e.code = code; e.constraint = constraint;
  return e;
}

function spec(tabla) {
  const s = TABLAS[tabla];
  if (!s) throw new Error('Tabla desconocida: ' + tabla);
  return s;
}
function soloColumnas(tabla, obj) {
  const s = spec(tabla), out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (s.cols.indexOf(k) === -1) throw new Error('La tabla ' + tabla + ' no tiene la columna ' + k + '.');
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}
// pg arma una columna date a medianoche LOCAL (TZ=America/Guatemala); si llega a medianoche UTC (pg-mem), se lee en UTC.
const diaLocal = (d) => (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? d.toISOString().slice(0, 10)
  : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
/** pg devuelve numeric como texto: aca se pasa a numero (las cuentas de dinero se redondean a 2). */
function normalizar(tabla, fila) {
  if (!fila) return fila;
  const s = spec(tabla);
  (s.num || []).forEach((c) => { if (fila[c] !== null && fila[c] !== undefined) fila[c] = Number(fila[c]); });
  (s.dias || []).forEach((c) => { if (fila[c] instanceof Date) fila[c] = diaLocal(fila[c]); });
  if (fila.id !== undefined && fila.id !== null && s.llave === 'id') fila.id = Number(fila.id);
  return fila;
}

// ------------------------------------------------------------------------------------------------ Postgres

function sobreCliente(q) {
  return {
    async insertar(tabla, fila) {
      const f = soloColumnas(tabla, fila), s = spec(tabla), cols = Object.keys(f);
      const vals = cols.map((c) => ((s.json || []).indexOf(c) !== -1 ? JSON.stringify(f[c]) : f[c]));
      const sql = 'INSERT INTO ' + tabla + ' (' + cols.join(', ') + ') VALUES (' + cols.map((_, i) => '$' + (i + 1)).join(', ') + ') RETURNING *';
      return normalizar(tabla, (await q(sql, vals)).rows[0]);
    },
    async actualizar(tabla, llave, cambios) {
      const s = spec(tabla), f = soloColumnas(tabla, cambios), cols = Object.keys(f);
      if (s.soloAgregar && cols.some((c) => s.soloAgregar.indexOf(c) === -1)) throw new Error('En ' + tabla + ' no se cambia ' + cols.join(', ') + '.');
      if (!cols.length) throw new Error('Nada que cambiar.');
      const antes = (await q('SELECT * FROM ' + tabla + ' WHERE ' + s.llave + ' = $1 FOR UPDATE', [llave])).rows[0];
      if (!antes) return null;
      const vals = cols.map((c) => ((s.json || []).indexOf(c) !== -1 ? JSON.stringify(f[c]) : f[c]));
      const sql = 'UPDATE ' + tabla + ' SET ' + cols.map((c, i) => c + ' = $' + (i + 1)).join(', ') + ' WHERE ' + s.llave + ' = $' + (cols.length + 1) + ' RETURNING *';
      const despues = (await q(sql, vals.concat([llave]))).rows[0];
      return { antes: normalizar(tabla, antes), despues: normalizar(tabla, despues) };
    },
    async uno(tabla, filtro, o) {
      const r = await this.lista(tabla, filtro, Object.assign({}, o, { limite: 1 }));
      return r[0] || null;
    },
    async lista(tabla, filtro, o) {
      const s = spec(tabla), op = o || {}, f = soloColumnas(tabla, filtro || {});
      const usados = [], w = [];
      Object.keys(f).forEach((c) => {
        if (f[c] === null) { w.push(c + ' IS NULL'); return; }
        usados.push(f[c]); w.push(c + ' = $' + usados.length);
      });
      if (op.campoFecha) {
        if (s.cols.indexOf(op.campoFecha) === -1) throw new Error('Columna de fecha desconocida.');
        if (op.desde) { usados.push(op.desde); w.push(op.campoFecha + ' >= $' + usados.length); }
        if (op.hasta) { usados.push(op.hasta); w.push(op.campoFecha + ' < $' + usados.length); }
      }
      let sql = 'SELECT * FROM ' + tabla + (w.length ? ' WHERE ' + w.join(' AND ') : '');
      const orden = op.orden || [s.llave];
      orden.forEach((c) => { if (s.cols.indexOf(String(c).replace(/ (DESC|ASC)$/, '')) === -1) throw new Error('Orden desconocido.'); });
      sql += ' ORDER BY ' + orden.join(', ');
      if (op.limite) sql += ' LIMIT ' + Math.max(1, Math.floor(op.limite));
      if (op.bloquear) sql += ' FOR UPDATE';
      return (await q(sql, usados)).rows.map((x) => normalizar(tabla, x));
    }
  };
}

function crearAlmacenPg(pool) {
  const base = sobreCliente((sql, p) => pool.query(sql, p));
  return Object.assign(base, {
    async transaccion(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const r = await fn(sobreCliente((sql, p) => c.query(sql, p)));
        await c.query('COMMIT');
        return r;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
      } finally { c.release(); }
    }
  });
}

// ------------------------------------------------------------------------------------------------ Memoria

const DEFECTOS = {
  activa: true, activo: true, orden: 0, alt_es: '', alt_en: '', titulo_en: '', titulo_es: '', descripcion_en: '', descripcion_es: '',
  texto_en: '', texto_es: '', nota_en: '', nota_es: '', tipo: undefined, alergenos: [], etiquetas: [], categoria: 'general', nota: '',
  mensaje: '', idioma: 'es', referencia: '', origen_trafico: {}, comision: 0, otros_cargos: 0, galeria: [], faq: [], idiomas: [], requisitos: {}, ganchos: {},
  razon_social: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', contacto_emergencia: '', licencia_inguat: '', seguro_aseguradora: '', seguro_poliza: '',
  acuerdo: '', duracion_en: '', duracion_es: '', incluye_en: '', incluye_es: '', punto_salida_en: '', punto_salida_es: '', temporada_en: '', temporada_es: ''
};
const DEFECTOS_POR_TABLA = {
  web_bloques: { tipo: 'texto' },
  web_versiones: { reconstruccion: 'pendiente', nota: '' },
  web_blog: { resumen_en: '', resumen_es: '', cuerpo_en: '', cuerpo_es: '' },
  gift_cards: { moneda: 'GTQ', estado: 'activa', aviso_estado: 'pendiente' },
  gift_cards_pedidos: { estado: 'pendiente' },
  pagos_en_linea: { tipo: 'cobro', fel_estado: 'pendiente' },
  pagos_liquidaciones: { estado: 'sin_conciliar' },
  operadores_aliados: { estado: 'pausado', comision_tipo: 'porcentaje' },
  web_experiencias: { dificultad: 'moderada' },
  leads_adventures: { estado: 'nuevo', idioma: 'en', combinar_cena: false }
};
const FECHA_AHORA = { web_ajustes: 'actualizado', web_fotos: 'subida', web_paginas: 'actualizado', web_bloques: 'actualizado', web_menu_secciones: 'actualizado',
  web_menu_platos: 'actualizado', web_faq: 'actualizado', web_eventos: 'actualizado', web_versiones: 'publicada', web_bitacora: 'cuando', web_blog: 'actualizado',
  pagos_liquidaciones: 'creada', pagos_en_linea: 'creado', pagos_webhooks: 'recibido', gift_cards_pedidos: 'creado', gift_cards: 'emitida', gift_cards_movimientos: 'cuando',
  operadores_aliados: 'actualizado', web_experiencias: 'actualizado', leads_adventures: 'creado' };

const copiar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function crearAlmacenMemoria(opciones) {
  const o = opciones || {};
  const ahora = o.ahora || (() => new Date());
  let datos = {}; const seq = {};
  Object.keys(TABLAS).forEach((t) => { datos[t] = []; seq[t] = 0; });
  let cola = Promise.resolve();   // una transaccion a la vez (como el candado por fila de la base)

  const fechaJson = (d) => (d instanceof Date ? d.toISOString() : d);
  function chequear(tabla, fila, excepto) {
    const s = spec(tabla);
    (s.unicos || []).forEach((u) => {
      if (u.some((c) => fila[c] === null || fila[c] === undefined)) return;
      if (datos[tabla].some((x) => x !== excepto && u.every((c) => x[c] === fila[c]))) throw errorBase('23505', tabla + '_' + u.join('_') + '_key');
    });
    const ch = CHEQUEOS[tabla] && CHEQUEOS[tabla](fila);
    if (ch) throw errorBase('23514', ch);
  }

  const motor = {
    async insertar(tabla, fila) {
      const s = spec(tabla), f = soloColumnas(tabla, fila);
      const nueva = {};
      s.cols.forEach((c) => {
        const porTabla = DEFECTOS_POR_TABLA[tabla] || {};
        nueva[c] = c in f ? copiar(fechaJson(f[c])) : (c in porTabla ? copiar(porTabla[c]) : (c in DEFECTOS ? copiar(DEFECTOS[c]) : null));
      });
      if (s.llave === 'id') nueva.id = ++seq[tabla];
      const fc = FECHA_AHORA[tabla]; if (fc && !(fc in f)) nueva[fc] = ahora().toISOString();
      if (tabla === 'pagos_en_linea' && !('actualizado' in f)) nueva.actualizado = nueva.creado;
      if ((tabla === 'gift_cards_pedidos' || tabla === 'leads_adventures') && !('actualizado' in f)) nueva.actualizado = nueva.creado;
      if (nueva[s.llave] === null || nueva[s.llave] === undefined) throw errorBase('23502', tabla + '_' + s.llave);
      if (s.llave !== 'id' && datos[tabla].some((x) => x[s.llave] === nueva[s.llave])) throw errorBase('23505', tabla + '_pkey');
      chequear(tabla, nueva, null);
      datos[tabla].push(nueva);
      return copiar(nueva);
    },
    async actualizar(tabla, llave, cambios) {
      const s = spec(tabla), f = soloColumnas(tabla, cambios), cols = Object.keys(f);
      if (s.soloAgregar && cols.some((c) => s.soloAgregar.indexOf(c) === -1)) throw new Error('En ' + tabla + ' no se cambia ' + cols.join(', ') + '.');
      if (!cols.length) throw new Error('Nada que cambiar.');
      const fila = datos[tabla].find((x) => x[s.llave] === llave);
      if (!fila) return null;
      const antes = copiar(fila), nueva = Object.assign(copiar(fila), copiar(Object.fromEntries(cols.map((c) => [c, fechaJson(f[c])]))));
      chequear(tabla, nueva, fila);
      Object.assign(fila, nueva);
      return { antes, despues: copiar(fila) };
    },
    async uno(tabla, filtro, op) { return (await motor.lista(tabla, filtro, Object.assign({}, op, { limite: 1 })))[0] || null; },
    async lista(tabla, filtro, op) {
      const s = spec(tabla), f = soloColumnas(tabla, filtro || {}), p = op || {};
      let r = datos[tabla].filter((x) => Object.keys(f).every((c) => (f[c] === null ? x[c] === null || x[c] === undefined : x[c] === f[c])));
      if (p.campoFecha) {
        const t = (v) => new Date(v).getTime();
        if (p.desde) r = r.filter((x) => t(x[p.campoFecha]) >= t(p.desde));
        if (p.hasta) r = r.filter((x) => t(x[p.campoFecha]) < t(p.hasta));
      }
      const orden = (p.orden || [s.llave]).map((c) => { const m = String(c).split(' '); return { c: m[0], desc: m[1] === 'DESC' }; });
      r = r.slice().sort((a, b) => {
        for (const k of orden) { if (a[k.c] < b[k.c]) return k.desc ? 1 : -1; if (a[k.c] > b[k.c]) return k.desc ? -1 : 1; }
        return 0;
      });
      if (p.limite) r = r.slice(0, p.limite);
      return copiar(r);
    },
    async transaccion(fn) {
      const turno = cola.then(async () => {
        const foto = copiar(datos), fotoSeq = Object.assign({}, seq);
        try { return await fn(motor); } catch (e) { datos = foto; Object.assign(seq, fotoSeq); throw e; }
      });
      cola = turno.catch(() => {});
      return turno;
    },
    /** Solo pruebas: las filas tal cual. */
    _datos: () => datos
  };
  return motor;
}

module.exports = { TABLAS, crearAlmacenPg, crearAlmacenMemoria, r2 };
