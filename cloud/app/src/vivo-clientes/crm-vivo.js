/**
 * Reservas, carritos y CRM en la base (20-oct-2026, orden del dia unico). Lo que hoy hace Marketing OS con
 * cada aviso de Wix, hecho por el servidor con el codigo real (motor-crm.js), la base como fuente y copia a
 * las hojas (Marketing OS › reservas y carritos; CRM Maestra).
 *
 * Interruptor (hooks_carrito / hooks_reserva en la tabla interruptores; lo lee hooks-wix.js):
 *   puente → Apps Script sigue escribiendo; aca solo se importa cada 15 min y se compara (sombra).
 *   base   → hooks-wix.js llama a atender(): guarda en la base en una transaccion y copia a las hojas.
 * Volver atras = puente: lo que se guardo en la base ya esta en las hojas (y si no, copiarPendientes).
 *
 * Quien mas escribe en esas hojas y sigue en Apps Script hasta despues del 5-nov: CerrarMesasNoShow y
 * ConsumoPendiente (reservas), la gente (notas y limpieza del CRM). Por eso, para estas tres pestañas,
 * LA HOJA MANDA al importar, salvo lo que el servidor todavia no copio (se copia antes de leer).
 * El activador alCambiarMarketingOS (sincronizarCRM) hay que apagarlo el dia del paso, o el CRM tiene dos
 * escritores (los dos llegan al mismo resultado porque CRMSync es idempotente, pero es una carrera).
 */
const C = require('../copia-hojas');
const IMP = require('../importar-pagos');
const MC = require('./motor-crm');
const CC = require('./copiar-clientes');
const LB = require('./libro-base');

const CRM_COLS = ['first_name', 'telefono', 'email', 'idioma', 'fuente', 'segmento', 'ultima_reserva', 'gasto_gtq', 'opt_in', 'notas', 'fecha_alta', 'ultimo_intento'];
const MKT_COLS = {
  reservas: ['id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'],
  carritos: ['id', 'fecha', 'nombre', 'canal', 'valor', 'estado', 'consentimiento', 'contacto']
};
const CANDADO = 4242012;   // el mismo que el pipeline: un guardado de Clientes por vez

/** Una pestaña desde filas_clientes: reservas/carritos lo mas nuevo arriba (orden negativo), el CRM en su orden. */
async function matriz(q, pestana, encabezado) {
  const r = await q.query('SELECT celdas FROM filas_clientes WHERE pestana = $1 AND borrada IS NULL ORDER BY orden NULLS LAST, llave', [pestana]);
  return [encabezado.slice()].concat(C.decodificar(r.rows.map((x) => x.celdas)));
}

/**
 * opciones: { leerMkt(pestanas) y leerCrm() → matrices (la API o, en las pruebas, una hoja en memoria);
 *   copiar(pestana, filas) → copia a la hoja; capi(evento) → Meta (opcional); ahora() }
 */
function crearCrmVivo(pool, opciones) {
  const o = opciones || {};
  const ahora = o.ahora || Date.now;
  const encabezados = { reservas: MKT_COLS.reservas, carritos: MKT_COLS.carritos, crm: CRM_COLS };
  let ultimaImportacion = null;

  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  async function datosDesdeBase(q) {
    return { reservas: await matriz(q, 'reservas', encabezados.reservas), carritos: await matriz(q, 'carritos', encabezados.carritos), crm: await matriz(q, 'crm', encabezados.crm) };
  }

  /** Un aviso de Wix en modo base: { estado, json } para hooks-wix.js. */
  /** opciones.interruptor === false: quien llama ya reviso el suyo (las rutas de la web: web_reservas). */
  function atender(hook, cuerpo, opciones) {
    return enCola(async () => {
      // un solo escritor: si el interruptor no dice base, el aviso lo escribe Apps Script (puente) y aca no
      if (!opciones || opciones.interruptor !== false) {
        const i = await pool.query('SELECT modo FROM interruptores WHERE modulo = $1', ['hooks_' + hook]).catch(() => ({ rows: [] }));
        if (!i.rows[0] || i.rows[0].modo !== 'base') return { estado: 409, json: { error: 'El interruptor hooks_' + hook + ' no está en base: lo escribe Apps Script.' } };
      }
      const c = await pool.connect();
      let r;
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
        r = MC.procesarAviso(await datosDesdeBase(c), hook, cuerpo);
        const t = ahora();
        let k = 0;
        for (const p of ['reservas', 'carritos']) {
          for (const x of r.cambios[p]) {
            // lo nuevo va arriba (como TABS_NUEVO_ARRIBA): orden negativo y decreciente; lo que ya estaba conserva su orden
            await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja)
              VALUES ($1,$2,$3,'servidor',$4,now(),NULL)
              ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL, borrada = NULL`,
            [p, x.id, JSON.stringify(C.codificar([x.fila])[0]), -Math.floor(t / 1000) * 100 - (k++)]);
          }
        }
        for (const x of r.cambios.crm) {
          if (!x.llave) continue;   // sin correo ni telefono: CRMSync no lo agrega
          await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja)
            VALUES ('crm',$1,$2,'servidor',$3,now(),NULL)
            ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL, borrada = NULL`,
          [x.llave, JSON.stringify(C.codificar([x.fila])[0]), x.pos]);
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      // despues de responder: la copia a las hojas y Meta (si fallan, se reintenta en la importacion)
      setImmediate(() => {
        copiarPendientes().catch((e) => console.error('Copia de Clientes a las hojas:', e.message));
        if (o.capi) r.capi.forEach((ev) => o.capi(ev).catch((e) => console.error('CAPI:', e.message)));
      });
      const ok = r.resultado && !r.resultado.error;
      return { estado: ok ? 200 : 400, json: r.resultado };
    });
  }

  /** Copia a las hojas lo que el servidor guardo y todavia no esta alla. */
  async function copiarPendientes() {
    if (!o.copiar) return { copiadas: 0 };
    let copiadas = 0;
    for (const p of ['reservas', 'carritos', 'crm']) {
      const r = await pool.query(`SELECT llave, celdas, actualizado::text AS act FROM filas_clientes
        WHERE pestana = $1 AND copiado_a_hoja IS NULL AND borrada IS NULL ORDER BY orden NULLS LAST, llave`, [p]);
      if (!r.rows.length) continue;
      // reservas/carritos: la mas nueva queda primera (insertar arriba en orden inverso no hace falta: van juntas)
      await o.copiar(p, r.rows.map((x) => ({ id: x.llave, llave: x.llave, fila: C.decodificar([x.celdas])[0] })));
      for (const x of r.rows) {
        await pool.query('UPDATE filas_clientes SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado::text = $3', [p, x.llave, x.act]);
      }
      copiadas += r.rows.length;
    }
    return { copiadas };
  }

  /** CRM: la hoja manda. Por llave (correo o telefono); lo que ya no esta en la hoja se marca borrada. */
  async function importarCrm(c, hoja) {
    if (hoja[0]) encabezados.crm = hoja[0].map(String);
    const base = new Map((await c.query("SELECT llave, celdas, borrada FROM filas_clientes WHERE pestana = 'crm' FOR UPDATE")).rows.map((x) => [x.llave, x]));
    const vistos = new Set(), problemas = [];
    let nuevas = 0, actualizadas = 0, borradas = 0;
    for (let r = 1; r < hoja.length; r++) {
      const llave = MC.llaveCrm(hoja[r]);
      if (!llave) continue;   // fila sin correo ni telefono: CRMSync tampoco la puede encontrar
      if (vistos.has(llave)) { problemas.push(llave.slice(0, 2) + '… repetido en el CRM (fila ' + (r + 1) + '): no se importa la segunda.'); continue; }
      vistos.add(llave);
      const celdas = C.codificar([hoja[r]])[0];
      const b = base.get(llave);
      if (!b) { await c.query("INSERT INTO filas_clientes (pestana, llave, celdas, orden, origen, copiado_a_hoja) VALUES ('crm',$1,$2,$3,'hoja',now())", [llave, JSON.stringify(celdas), r]); nuevas++; continue; }
      if (JSON.stringify(b.celdas) === JSON.stringify(celdas) && !b.borrada) { await c.query("UPDATE filas_clientes SET orden = $2 WHERE pestana = 'crm' AND llave = $1", [llave, r]); continue; }
      await c.query("UPDATE filas_clientes SET celdas = $2, orden = $3, origen = 'hoja', actualizado = now(), copiado_a_hoja = now(), borrada = NULL WHERE pestana = 'crm' AND llave = $1", [llave, JSON.stringify(celdas), r]);
      actualizadas++;
    }
    for (const [llave, b] of base) {
      if (!vistos.has(llave) && !b.borrada) { await c.query("UPDATE filas_clientes SET borrada = now() WHERE pestana = 'crm' AND llave = $1", [llave]); borradas++; }
    }
    return { pestana: 'crm', filas_hoja: hoja.length - 1, nuevas, actualizadas, borradas, problemas };
  }

  /** Trae las hojas a la base (cada 15 min, y antes de comparar). Primero copia lo pendiente. */
  function importar() {
    return enCola(async () => {
      await copiarPendientes();
      const mkt = await o.leerMkt(['reservas', 'carritos']);
      const crm = await o.leerCrm();
      const out = [];
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
        for (const p of ['reservas', 'carritos']) {
          const M = mkt[p] || [];
          if (M[0]) encabezados[p] = M[0].map(String);
          // espejo (20-oct-2026): una fila que sale de la hoja (limpieza a papelera, CerrarMesas…) queda `borrada` en la base
          out.push(await LB.importarEspejo(c, p, M.length ? M : [['id']], (f) => IMP.llave(f[0])));
        }
        out.push(await importarCrm(c, crm || []));
        for (const x of out) {
          await c.query('INSERT INTO filas_clientes_importaciones (pestana, filas_hoja, nuevas, actualizadas, problemas) VALUES ($1,$2,$3,$4,$5)',
            [x.pestana, x.filas_hoja, x.nuevas, x.actualizadas, JSON.stringify(x.problemas)]);
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      ultimaImportacion = new Date(ahora());
      return out;
    });
  }

  /**
   * La sombra de cada noche (con el interruptor en puente): despues de importar,
   *  (1) cada reserva que llego hoy por /hooks/reserva esta en la hoja con lo que mando Wix;
   *  (2) cada carrito que llego esta en la hoja (mismo contacto, fecha y valor);
   *  (3) CRMSync corrido por la nube sobre lo importado NO cambia nada: el CRM de Apps Script es el mismo
   *      que daria la nube.
   * desde: 'AAAA-MM-DD' (los avisos recibidos desde ese dia).
   */
  async function comparar(desde) {
    await importar();
    const datos = await datosDesdeBase(pool);
    const difs = [], avisos = [];
    const rec = await pool.query("SELECT hook, cuerpo, recibido FROM hooks_wix_recibidos WHERE recibido >= $1::date AND estado = 200 ORDER BY recibido", [desde]);
    const H = (p) => datos[p][0].map(String);
    const fechaTxt = (x) => (x instanceof Date ? C.codificar([[x]])[0][0].$d.slice(0, 10) : String(x || '').slice(0, 10));
    const reservas = new Map(datos.reservas.slice(1).map((f) => [String(f[0]), f]));
    for (const x of rec.rows.filter((r) => r.hook === 'reserva')) {
      const b = x.cuerpo, f = reservas.get(String(b.id));
      if (!f) { if (b.id) difs.push('Reserva ' + b.id + ': llegó por el receptor y no está en la hoja.'); else avisos.push('Reserva sin id (se guarda con id armado): no se compara.'); continue; }
      const h = H('reservas'), v = (n) => f[h.indexOf(n)];
      if (fechaTxt(v('fecha')) !== b.fecha) difs.push('Reserva ' + b.id + ': fecha ' + fechaTxt(v('fecha')) + ' en la hoja, ' + b.fecha + ' en el aviso.');
      if (String(v('estado') || '').toUpperCase() !== String(b.estado || '').toUpperCase() && !/SEATED|FINISHED|NO_SHOW|NOSHOW/.test(String(v('estado')).toUpperCase())) {
        avisos.push('Reserva ' + b.id + ': estado ' + v('estado') + ' en la hoja, ' + b.estado + ' en el último aviso (puede ser un aviso posterior).');
      }
    }
    const hc = H('carritos');
    const carritos = datos.carritos.slice(1).map((f) => ({ contacto: String(f[hc.indexOf('contacto')] || '').toLowerCase(), fecha: fechaTxt(f[hc.indexOf('fecha')]), valor: Number(f[hc.indexOf('valor')]) || 0 }));
    for (const x of rec.rows.filter((r) => r.hook === 'carrito')) {
      const b = x.cuerpo, contacto = String(b.email || b.telefono || '').toLowerCase();
      if (!carritos.some((c) => (c.contacto === contacto || c.contacto.replace(/\D/g, '') === contacto.replace(/\D/g, '')) && c.fecha === b.fecha && c.valor === (Number(b.valor) || 0))) {
        difs.push('Carrito del ' + b.fecha + ' (Q' + b.valor + '): llegó por el receptor y no está en la hoja.');
      }
    }
    const mc = MC.crearMotorCrm(datos);
    const sync = mc.correr('sincronizarCRM', []);
    const cambiaria = mc.cambios().crm;
    cambiaria.slice(0, 20).forEach((x) => difs.push('CRM ' + x.llave.slice(0, 2) + '…: la nube lo ' + (x.nueva ? 'agregaría' : 'cambiaría') + ' (Apps Script no lo tiene igual).'));
    if (cambiaria.length > 20) difs.push('… y ' + (cambiaria.length - 20) + ' filas más del CRM.');
    return { ok: !difs.length, recibidos: rec.rows.length, diferencias: difs, avisos, crm_sync: String(sync || '').split('\n').filter(Boolean) };
  }

  return { atender, importar, copiarPendientes, comparar, estado: () => ({ ultima_importacion: ultimaImportacion }) };
}

module.exports = { crearCrmVivo, CRM_COLS, MKT_COLS };
