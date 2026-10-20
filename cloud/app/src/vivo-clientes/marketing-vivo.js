/**
 * Marketing (contenido y pauta) EN VIVO (20-oct-2026, orden del dia unico). La pantalla de Marketing SIGUE
 * en la intranet: ahi estan Meta, Claude y Drive, que el servidor no tiene. Lo que cambia es QUIEN ESCRIBE:
 * con PARAMETROS › motor_marketing = base, las 6 funciones de guardar de la intranet (mktUpsert, mktDelete,
 * calGuardarVersion, psGuardarRegla, psGuardarSupuesto, psGuardarPrueba) le pasan el pedido a este servidor
 * (NubeClientes.js › _mktDesvio_, POST /interno/marketing con la clave de tareas), que corre el MISMO codigo
 * sobre la base, guarda lo que cambio y lo copia a Marketing OS ANTES de contestar (la pantalla relee la hoja).
 * Volver atras = motor_marketing = sheets (lo guardado ya esta en la hoja).
 *
 * Quien mas escribe esas pestañas y sigue en Apps Script: la captura semanal de Meta (hechos_semana,
 * pixel_semana, estados_semana: solo se LEEN aca), el Ads Script, WixReservasPauta, PosPauta y ClientesNuevos
 * (pauta_semanal), la skill de pauta (aprendizajes). Por eso la hoja manda al importar, salvo lo que el
 * servidor todavia no copio.
 */
const C = require('../copia-hojas');
const { crearMotor } = require('../motor-pagos');
const LB = require('./libro-base');
const EH = require('../escribir-hoja');
const CC = require('./copiar-clientes');

const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
const LISTAS = ['LISTA.txt', 'LISTA-CLIENTES.txt', 'LISTA-MARKETING.txt'];
const ESCRIBE = ['calendario', 'calendario_versiones', 'piezas', 'propuestas', 'briefs', 'aprendizajes', 'pauta_semanal',
  'reglas', 'supuestos', 'bitacora_pruebas', 'papelera'];
const SOLO_LEE = ['hechos_semana', 'pixel_semana', 'estados_semana'];
const FUNCIONES = ['mktUpsert', 'mktDelete', 'calGuardarVersion', 'psGuardarRegla', 'psGuardarSupuesto', 'psGuardarPrueba'];
const CANDADO = 4242012;
/** Que pestañas escribe cada funcion (la sombra las lee frescas de la hoja antes de predecir). */
const TOCA = {
  mktUpsert: (a) => [a[0]], mktDelete: (a) => [a[0], 'papelera'], calGuardarVersion: () => ['calendario_versiones'],
  psGuardarRegla: () => ['reglas'], psGuardarSupuesto: () => ['supuestos'], psGuardarPrueba: () => ['bitacora_pruebas', 'supuestos', 'aprendizajes']
};   // el mismo de Clientes: un guardado en Marketing OS por vez

/** La llave de una fila: la columna A, salvo calendario_versiones (version + id) y papelera (fecha + pestaña + id). */
function llaveDe(pestana) {
  const t = (x) => (x instanceof Date ? C.codificar([[x]])[0][0].$d : String(x === undefined || x === null ? '' : x).trim());
  if (pestana === 'calendario_versiones') return (f) => (t(f[0]) && t(f[2]) ? t(f[0]) + '|' + t(f[2]) : '');
  if (pestana === 'papelera') return (f) => (t(f[0]) ? t(f[0]) + '|' + t(f[2]) + '|' + t(f[3]) : '');
  return (f) => t(f[0]);
}

/** Como lo deja setValues: el texto que parece numero o fecha se vuelve numero o fecha (motor-crm.comoSetValues). */
const { comoSetValues } = require('./motor-crm');

/**
 * opciones: { leerMkt(pestanas) → matrices; leerConfig() → { PARAMETROS, METAS }; copiar(pestana, cambios, bajas, encabezado);
 *             configId }
 */
function crearMarketingVivo(pool, opciones) {
  const o = opciones || {};
  const configId = o.configId || 'CONFIG';
  let encabezados = {}, config = null, ultimaImportacion = null;
  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  async function matriz(q, p) {
    const r = await q.query('SELECT celdas FROM filas_clientes WHERE pestana = $1 AND borrada IS NULL ORDER BY orden NULLS LAST, llave', [p]);
    if (!encabezados[p] && !r.rows.length) return null;   // la pestaña no existe (papelera, hasta el primer borrado)
    return [(encabezados[p] || []).slice()].concat(C.decodificar(r.rows.map((x) => x.celdas)));
  }

  /** Trae las hojas a la base (y Config a memoria). Primero copia lo pendiente. */
  function importar() {
    return enCola(() => importarSinCola());
  }
  async function importarSinCola() {
    await copiarPendientes();
    const hojas = await o.leerMkt(ESCRIBE.concat(SOLO_LEE));
    config = await o.leerConfig();
    const out = [];
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
      for (const p of ESCRIBE.concat(SOLO_LEE)) {
        if (!hojas[p]) continue;   // la pestaña no existe en la hoja
        if (hojas[p][0]) encabezados[p] = hojas[p][0].map(String);
        out.push(await LB.importarEspejo(c, p, hojas[p], llaveDe(p)));
      }
      for (const x of out) {
        await c.query('INSERT INTO filas_clientes_importaciones (pestana, filas_hoja, nuevas, actualizadas, problemas) VALUES ($1,$2,$3,$4,$5)',
          [x.pestana, x.filas_hoja, x.nuevas, x.actualizadas, JSON.stringify(x.problemas)]);
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    ultimaImportacion = new Date();
    return out;
  }

  /** Copia a la hoja altas, cambios y bajas que el servidor guardo y todavia no estan alla. */
  async function copiarPendientes() {
    if (!o.copiar) return { copiadas: 0 };
    let copiadas = 0;
    for (const p of ESCRIBE) {
      const r = await pool.query('SELECT llave, celdas, borrada, actualizado::text AS act FROM filas_clientes WHERE pestana = $1 AND copiado_a_hoja IS NULL ORDER BY orden NULLS LAST, llave', [p]);
      if (!r.rows.length) continue;
      const cambios = r.rows.filter((x) => !x.borrada).map((x) => ({ llave: x.llave, fila: C.decodificar([x.celdas])[0] }));
      const bajas = r.rows.filter((x) => x.borrada).map((x) => x.llave);
      await o.copiar(p, cambios, bajas, encabezados[p]);
      for (const x of r.rows) await pool.query('UPDATE filas_clientes SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado::text = $3', [p, x.llave, x.act]);
      copiadas += r.rows.length;
    }
    return { copiadas };
  }

  /**
   * Corre una de las 6 funciones sobre la base (c: cliente con el candado tomado). frescas: pestañas recien leidas
   * de la hoja que reemplazan a las de la base (la sombra). Devuelve { resultado, cambios: { pestana: { cambios, bajas } } }.
   */
  async function correrSobreLaBase(c, usuario, nombre, args, frescas) {
    const libro = {};
    for (const p of ESCRIBE.concat(SOLO_LEE, ['carritos', 'reservas'])) { const M = await matriz(c, p); if (M) libro[p] = M; }
    Object.keys(frescas || {}).forEach((p) => { libro[p] = frescas[p].map((f) => f.slice()); });
    const antes = Object.fromEntries(Object.keys(libro).map((p) => [p, libro[p].map((f) => f.slice())]));
    const editables = ESCRIBE.concat(['carritos']);
    const m = crearMotor({ libros: { [MKT_ID]: libro, [configId]: config }, configId, editables: { [MKT_ID]: editables }, listas: LISTAS });
    LB.completarHojas(m, { [MKT_ID]: libro, [configId]: config }, { [MKT_ID]: editables }, ['papelera']);
    // el token va AL FINAL en las funciones de Marketing (como correrUltimo de la sombra 2)
    m.ctx.__mkt = () => m.ctx[nombre].apply(null, (args || []).concat(['(token-verificado-por-el-servidor)']));
    const resultado = m.correr(usuario, '__mkt', []).resultado;
    const cambios = {};
    for (const p of editables) {
      if (!libro[p]) continue;
      if (!encabezados[p] && libro[p][0] && libro[p][0].length) encabezados[p] = libro[p][0].map(String);   // papelera recien creada
      const d = LB.diferencias(antes[p] || [libro[p][0]], libro[p], llaveDe(p));
      if (d.cambios.length || d.bajas.length) cambios[p] = { cambios: d.cambios.map((x) => Object.assign({}, x, { fila: comoSetValues(x.fila) })), bajas: d.bajas };
    }
    return { resultado, cambios };
  }

  /**
   * Una de las 6 funciones de guardar, como `usuario` (de la tabla usuarios). Devuelve lo que devuelve la funcion
   * de la intranet. La copia a la hoja va ANTES de contestar: la pantalla de la intranet relee la hoja.
   */
  function guardar(usuario, nombre, args) {
    if (FUNCIONES.indexOf(nombre) === -1) { const e = new Error('Esa función no se guarda en el servidor.'); e.status = 404; return Promise.reject(e); }
    return enCola(async () => {
      if (!config) await importarSinCola();   // recien arrancado: sin encabezados ni Config todavia
      const c = await pool.connect();
      let r;
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
        r = await correrSobreLaBase(c, usuario, nombre, args, null);
        for (const p of Object.keys(r.cambios)) {
          for (const x of r.cambios[p].cambios) {
            await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja)
              VALUES ($1,$2,$3,'servidor',$4,now(),NULL)
              ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL, borrada = NULL`,
            [p, x.llave, JSON.stringify(C.codificar([x.fila])[0]), x.pos]);
          }
          for (const k of r.cambios[p].bajas) {
            await c.query("UPDATE filas_clientes SET borrada = now(), origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL WHERE pestana = $1 AND llave = $2", [p, k]);
          }
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      await copiarPendientes();
      return r.resultado;
    });
  }

  /**
   * SOMBRA (motor_marketing = sombra): la intranet guarda en la hoja como siempre y, ANTES, manda aca el mismo pedido.
   * Se corre el mismo codigo sobre la base, con las pestañas que la funcion escribe recien leidas de la hoja, y se
   * guarda lo que HABRIA cambiado (marketing_sombra). No escribe nada mas. comparar() lo cruza con la hoja a la noche.
   */
  function ensayar(usuario, nombre, args) {
    if (FUNCIONES.indexOf(nombre) === -1) { const e = new Error('Esa función no se guarda en el servidor.'); e.status = 404; return Promise.reject(e); }
    return enCola(async () => {
      const t0 = Date.now();
      if (!config) await importarSinCola();
      const tocadas = TOCA[nombre](args || []).filter((p) => ESCRIBE.indexOf(p) !== -1 || p === 'carritos');
      const frescas = await o.leerMkt(tocadas);
      Object.keys(frescas).forEach((p) => { if (frescas[p][0]) encabezados[p] = frescas[p][0].map(String); });
      const c = await pool.connect();
      let r;
      try {
        await c.query('BEGIN');   // solo lectura: se deshace siempre
        r = await correrSobreLaBase(c, usuario, nombre, args, frescas).catch((e) => ({ resultado: { error: String(e.message || e) }, cambios: {} }));
      } finally { await c.query('ROLLBACK'); c.release(); }
      const prediccion = {};
      Object.keys(r.cambios).forEach((p) => { prediccion[p] = { cambios: r.cambios[p].cambios.map((x) => ({ llave: x.llave, celdas: C.codificar([x.fila])[0] })), bajas: r.cambios[p].bajas }; });
      await pool.query('INSERT INTO marketing_sombra (fn, email, prediccion, resultado, ms) VALUES ($1,$2,$3,$4,$5)',
        [nombre, usuario.email, JSON.stringify(prediccion), JSON.stringify(r.resultado === undefined ? null : r.resultado), Date.now() - t0]);
      return { ok: true, ms: Date.now() - t0 };
    });
  }

  /**
   * La comparacion de la noche: importa la hoja y revisa que cada prediccion del dia este en ella. Por llave la
   * ULTIMA prediccion (un cambio posterior la reemplaza). Si la llave no esta (un id nuevo que arma el codigo con la
   * hora, o la fecha de la papelera), se busca una fila igual sin contar la columna A.
   */
  async function comparar(desde) {
    await importar();
    const r = await pool.query('SELECT fn, prediccion, resultado FROM marketing_sombra WHERE cuando >= $1::date ORDER BY cuando, id', [desde]);
    const ultima = new Map(), bajas = new Map(), sinLlave = [];
    for (const x of r.rows) {
      for (const p of Object.keys(x.prediccion || {})) {
        for (const ch of x.prediccion[p].cambios) ultima.set(p + '\u0000' + ch.llave, { p, llave: ch.llave, celdas: ch.celdas, fn: x.fn });
        for (const k of x.prediccion[p].bajas) bajas.set(p + '\u0000' + k, { p, llave: k, fn: x.fn });
      }
    }
    const difs = [];
    const filas = {};
    const de = async (p) => (filas[p] = filas[p] || (await pool.query('SELECT llave, celdas, borrada FROM filas_clientes WHERE pestana = $1', [p])).rows);
    const sinA = (c) => JSON.stringify((c || []).slice(1));
    for (const x of ultima.values()) {
      if (bajas.has(x.p + '\u0000' + x.llave)) continue;
      const rows = await de(x.p);
      const b = rows.find((y) => y.llave === x.llave && !y.borrada);
      if (b) { if (JSON.stringify(b.celdas) !== JSON.stringify(x.celdas)) difs.push(x.fn + ': ' + x.p + ' › ' + x.llave + ' quedó distinta en la hoja.'); continue; }
      if (!rows.some((y) => !y.borrada && sinA(y.celdas) === sinA(x.celdas))) difs.push(x.fn + ': ' + x.p + ' › fila nueva (' + x.llave + ') que la hoja no tiene.');
    }
    for (const x of bajas.values()) {
      const rows = await de(x.p);
      if (rows.some((y) => y.llave === x.llave && !y.borrada)) difs.push(x.fn + ': ' + x.p + ' › ' + x.llave + ' debía salir y sigue en la hoja.');
    }
    const errores = r.rows.filter((x) => x.resultado && x.resultado.error).map((x) => x.fn + ': ' + x.resultado.error);
    return { ok: !difs.length, pedidos: r.rows.length, diferencias: difs, avisos: errores };
  }

  return { guardar, ensayar, comparar, importar, copiarPendientes, estado: () => ({ ultima_importacion: ultimaImportacion, config: !!config }) };
}

/**
 * La copia de verdad (Sheets API): una lectura y un batchUpdate por pestaña. Crea la pestaña si no existe
 * (papelera, con el primer borrado). reservas/carritos no pasan por aca (copiar-clientes.js).
 */
async function copiarMarketing(sheets, libroId, pestana, cambios, bajas, encabezado) {
  if (pestana === 'carritos') return CC.copiar(sheets, libroId, cambios.map((x) => ({ id: x.llave, fila: x.fila })), { pestana, llave: 'id' });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: libroId, fields: 'sheets.properties(sheetId,title)' });
  let s = meta.data.sheets.find((x) => x.properties.title === pestana);
  if (!s) {
    const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: [{ addSheet: { properties: { title: pestana, gridProperties: { frozenRowCount: 1 } } } }] } });
    s = { properties: r.data.replies[0].addSheet.properties };
    await sheets.spreadsheets.values.update({ spreadsheetId: libroId, range: "'" + pestana + "'!A1", valueInputOption: 'RAW', requestBody: { values: [(encabezado || []).map(String)] } });
  }
  // leida como getValues (fechas como fecha): asi la llave de cada fila se arma igual que en la base
  const valores = (await C.leerLibro(sheets, libroId, [pestana]))[pestana] || [];
  const plan = LB.planLlaves(valores, cambios, bajas, s.properties.sheetId, llaveDe(pestana), (x) => CC.celda(x, false));
  if (plan.requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: plan.requests } });
  return plan;
}

module.exports = { crearMarketingVivo, copiarMarketing, llaveDe, ESCRIBE, SOLO_LEE, FUNCIONES, LISTAS, MKT_ID };
